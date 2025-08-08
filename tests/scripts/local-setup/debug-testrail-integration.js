#!/usr/bin/env node

import dotenv from 'dotenv';
import fs from 'fs';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';

dotenv.config();

const TESTRAIL_HOST = process.env.TESTRAIL_HOST;
const TESTRAIL_PROJECT_ID = process.env.TESTRAIL_PROJECT_ID;
const TESTRAIL_SUITE_ID = process.env.TESTRAIL_SUITE_ID;
const TESTRAIL_USER = process.env.TESTRAIL_USER;
const TESTRAIL_API_KEY = process.env.TESTRAIL_API_KEY;

if (!TESTRAIL_HOST || !TESTRAIL_PROJECT_ID || !TESTRAIL_USER || !TESTRAIL_API_KEY || !TESTRAIL_SUITE_ID) {
    console.error('❌ Missing TestRail environment variables');
    console.error('Required: TESTRAIL_HOST, TESTRAIL_PROJECT_ID, TESTRAIL_USER, TESTRAIL_API_KEY, TESTRAIL_SUITE_ID');
    process.exit(1);
}

const testrail = axios.create({
    baseURL: `${TESTRAIL_HOST}/index.php?/api/v2/`,
    auth: {
        username: TESTRAIL_USER,
        password: TESTRAIL_API_KEY,
    },
});

// Debug logging utility
function debugLog(section, message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`\n🔍 [${timestamp}] ${section}: ${message}`);
    if (data) {
        console.log('📊 Data:', JSON.stringify(data, null, 2));
    }
}

async function parseJUnitXML(filePath) {
    debugLog('JUnit XML Parsing', `Reading file: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
        debugLog('JUnit XML Parsing', `❌ File not found: ${filePath}`);
        return {};
    }
    
    const xml = fs.readFileSync(filePath, 'utf-8');
    debugLog('JUnit XML Parsing', `✅ File read successfully (${xml.length} characters)`);
    
    const result = await parseStringPromise(xml);
    const browserGroups = {};
    const suites = result.testsuites?.testsuite || [];
    
    debugLog('JUnit XML Parsing', `Found ${suites.length} test suites`);
    
    for (const suite of suites) {
        const browser = suite.$.hostname || 'unknown';
        if (!browserGroups[browser]) browserGroups[browser] = [];
        
        const cases = suite.testcase || [];
        debugLog('JUnit XML Parsing', `Browser ${browser}: ${cases.length} test cases`);
        
        for (const c of cases) {
            browserGroups[browser].push({
                name: c.$.name,
                classname: c.$.classname,
                time: c.$.time,
                failure: c.failure ? true : false,
                error: c.error ? true : false,
                skipped: c.skipped ? true : false,
                message: c.failure ? c.failure[0]._ || c.failure[0].$.message || '' : '',
            });
        }
    }
    
    debugLog('JUnit XML Parsing', `Final browser groups:`, Object.keys(browserGroups));
    return browserGroups;
}

async function getTestRailCases() {
    debugLog('TestRail Cases', `Fetching all cases from suite ${TESTRAIL_SUITE_ID}`);
    
    try {
        const response = await testrail.get(`get_cases/${TESTRAIL_PROJECT_ID}&suite_id=${TESTRAIL_SUITE_ID}`);
        const cases = response.data.cases || [];
        
        debugLog('TestRail Cases', `✅ Found ${cases.length} existing test cases`);
        
        // Create detailed mapping
        const caseMap = new Map();
        const titleToId = new Map();
        
        cases.forEach(tc => {
            caseMap.set(tc.id, tc);
            titleToId.set(tc.title, tc.id);
        });
        
        debugLog('TestRail Cases', `Created mappings: ${caseMap.size} by ID, ${titleToId.size} by title`);
        
        return { cases, caseMap, titleToId };
    } catch (err) {
        debugLog('TestRail Cases', `❌ Error fetching cases: ${err.message}`);
        if (err.response) {
            debugLog('TestRail Cases', `API Response:`, err.response.data);
        }
        return { cases: [], caseMap: new Map(), titleToId: new Map() };
    }
}

async function matchTestCases(testResults, titleToId) {
    debugLog('Case Matching', `Matching ${testResults.length} test results to TestRail cases`);
    
    const matchedCases = [];
    const unmatchedTests = [];
    const caseIds = [];
    
    for (const testResult of testResults) {
        const testName = testResult.name;
        const caseId = titleToId.get(testName);
        
        if (caseId) {
            matchedCases.push({
                testName,
                caseId,
                testResult
            });
            caseIds.push(caseId);
            debugLog('Case Matching', `✅ Matched: "${testName}" -> Case ID ${caseId}`);
        } else {
            unmatchedTests.push(testName);
            debugLog('Case Matching', `❌ No match: "${testName}"`);
        }
    }
    
    debugLog('Case Matching', `Summary: ${matchedCases.length} matched, ${unmatchedTests.length} unmatched`);
    debugLog('Case Matching', `Case IDs to include: [${caseIds.join(', ')}]`);
    
    return { matchedCases, unmatchedTests, caseIds };
}

async function createTestRailPlan(browser, tag, caseIds) {
    debugLog('TestRail Run Creation', `Creating run for browser: ${browser}, tag: ${tag}`);
    debugLog('TestRail Run Creation', `Will include ${caseIds.length} case IDs: [${caseIds.join(', ')}]`);
    
    const runName = `DEBUG - Automated Playwright Run - ${browser} - ${tag}`;
    
    try {
        // Step 1: Create a test run with include_all: true (TestRail requirement)
        const runPayload = {
            name: runName,
            description: `Debug TestRail Run\nBrowser: ${browser}\nTag: ${tag}\nCase IDs: ${caseIds.join(', ')}`,
            suite_id: TESTRAIL_SUITE_ID,
            include_all: true // TestRail requires this initially
        };
        
        debugLog('TestRail Run Creation', `API Payload:`, runPayload);
        
        const runResponse = await testrail.post('add_run/' + TESTRAIL_PROJECT_ID, runPayload);
        
        const runId = runResponse.data.id;
        debugLog('TestRail Run Creation', `✅ Created run ID: ${runId}`);
        debugLog('TestRail Run Creation', `Run URL: ${TESTRAIL_HOST}/index.php?/runs/view/${runId}`);
        
        // Step 2: Add specific cases to the run
        if (caseIds.length > 0) {
            debugLog('TestRail Run Creation', `Adding ${caseIds.length} specific cases to run ${runId}`);
            await testrail.post(`update_run/${runId}`, {
                include_all: false,
                case_ids: caseIds
            });
            debugLog('TestRail Run Creation', `Successfully added ${caseIds.length} cases to run ${runId}`);
        }
        
        return runId;
    } catch (err) {
        debugLog('TestRail Run Creation', `❌ Error creating run: ${err.message}`);
        if (err.response) {
            debugLog('TestRail Run Creation', `API Response:`, err.response.data);
        }
        return null;
    }
}

async function verifyTestRailRun(runId) {
    debugLog('Run Verification', `Verifying run ID: ${runId}`);
    
    try {
        const runResponse = await testrail.get(`get_run/${runId}`);
        const run = runResponse.data;
        
        debugLog('Run Verification', `Run name: ${run.name}`);
        debugLog('Run Verification', `Run description: ${run.description}`);
        debugLog('Run Verification', `Run include_all: ${run.include_all}`);
        debugLog('Run Verification', `Run case_ids: [${(run.case_ids || []).join(', ')}]`);
        debugLog('Run Verification', `Run URL: ${TESTRAIL_HOST}/index.php?/runs/view/${run.id}`);
        
        // Check if the run has tests (cases)
        if (run.tests) {
            debugLog('Run Verification', `Run has ${run.tests.length} tests/cases`);
            debugLog('Run Verification', `Test IDs: [${run.tests.map(t => t.case_id).join(', ')}]`);
        } else {
            debugLog('Run Verification', `Run has no tests field`);
        }
        
        // Try to get tests from the run using the get_tests API
        try {
            const testsResponse = await testrail.get(`get_tests/${runId}`);
            const tests = testsResponse.data.tests || [];
            debugLog('Run Verification', `Found ${tests.length} tests in run via get_tests API`);
            if (tests.length > 0) {
                debugLog('Run Verification', `Test case IDs: [${tests.map(t => t.case_id).join(', ')}]`);
            }
        } catch (err) {
            debugLog('Run Verification', `Error getting tests: ${err.message}`);
        }
        
        return run;
    } catch (err) {
        debugLog('Run Verification', `❌ Error verifying run: ${err.message}`);
        return null;
    }
}

async function main() {
    const args = process.argv.slice(2);
    const tag = args[0] || 'core';
    
    debugLog('Main', `Starting debug session for tag: ${tag}`);
    debugLog('Main', `TestRail Configuration:`, {
        host: TESTRAIL_HOST,
        projectId: TESTRAIL_PROJECT_ID,
        suiteId: TESTRAIL_SUITE_ID,
        user: TESTRAIL_USER
    });
    
    // Step 1: Parse JUnit XML
    const browserGroups = await parseJUnitXML('playwright-report/results.xml');
    
    if (Object.keys(browserGroups).length === 0) {
        debugLog('Main', `❌ No test results found. Exiting.`);
        return;
    }
    
    // Step 2: Get TestRail cases
    const { cases, caseMap, titleToId } = await getTestRailCases();
    
    // Step 3: Process each browser
    for (const browser of Object.keys(browserGroups)) {
        debugLog('Main', `\n🚀 Processing browser: ${browser}`);
        
        const testResults = browserGroups[browser];
        debugLog('Main', `Test results for ${browser}:`, testResults.map(t => t.name));
        
        // Step 4: Match test cases
        const { matchedCases, unmatchedTests, caseIds } = await matchTestCases(testResults, titleToId);
        
        // Step 5: Create TestRail plan
        const planId = await createTestRailPlan(browser, tag, caseIds);
        
        if (planId) {
            // Step 6: Verify the plan
            await verifyTestRailRun(planId);
        }
        
        // Step 7: Summary for this browser
        debugLog('Main', `\n📋 Summary for ${browser}:`);
        debugLog('Main', `  - Total test results: ${testResults.length}`);
        debugLog('Main', `  - Matched to TestRail: ${matchedCases.length}`);
        debugLog('Main', `  - Unmatched tests: ${unmatchedTests.length}`);
        debugLog('Main', `  - Case IDs included: ${caseIds.length}`);
        
        if (unmatchedTests.length > 0) {
            debugLog('Main', `  - Unmatched test names:`, unmatchedTests);
        }
    }
    
    debugLog('Main', `\n✅ Debug session completed`);
}

main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
}); 