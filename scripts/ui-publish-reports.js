#!/usr/bin/env node

const dotenv = require('dotenv');
const fs = require('fs');
const axios = require('axios');
const xml2js = require('xml2js');

dotenv.config();

const TESTRAIL_HOST = process.env.TESTRAIL_HOST;
const TESTRAIL_PROJECT_ID = process.env.TESTRAIL_PROJECT_ID;
const TESTRAIL_SUITE_ID = process.env.TESTRAIL_SUITE_ID;
const TESTRAIL_USER = process.env.TESTRAIL_USER;
const TESTRAIL_API_KEY = process.env.TESTRAIL_API_KEY;

if (!TESTRAIL_HOST || !TESTRAIL_PROJECT_ID || !TESTRAIL_USER || !TESTRAIL_API_KEY || !TESTRAIL_SUITE_ID) {
    console.error('❌ Missing TestRail credentials');
    process.exit(1);
}

const testrail = axios.create({
    baseURL: `${TESTRAIL_HOST}/index.php?/api/v2/`,
    auth: { username: TESTRAIL_USER, password: TESTRAIL_API_KEY },
});

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {};
    for (let i = 0; i < args.length; i += 2) {
        if (args[i].startsWith('--')) {
            options[args[i].slice(2)] = args[i + 1];
        }
    }
    return options;
}

async function parseJunitXml(xmlPath = 'playwright-report/results.xml') {
    try {
        if (!fs.existsSync(xmlPath)) {
            console.error(`❌ File not found: ${xmlPath}`);
            return { total: 0, passed: 0, failed: 0, skipped: 0, testCases: [] };
        }
        
        const xmlContent = fs.readFileSync(xmlPath, 'utf8');
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(xmlContent);
        
        let total = 0, passed = 0, failed = 0, skipped = 0, testCases = [];
        
        const testsuites = result.testsuites || result.testsuite;
        const suites = Array.isArray(testsuites.testsuite) ? testsuites.testsuite : [testsuites];
        
        suites.forEach(suite => {
            if (!suite || !suite.testcase) return;
            const cases = Array.isArray(suite.testcase) ? suite.testcase : [suite.testcase];
            
            cases.forEach(testcase => {
                total++;
                const tc = {
                    name: testcase.$.name || testcase.$.classname,
                    classname: testcase.$.classname || '',
                    time: parseFloat(testcase.$.time || 0),
                    failure: !!testcase.failure,
                    error: !!testcase.error,
                    skipped: !!testcase.skipped,
                    status: testcase.failure ? 'failed' : (testcase.skipped ? 'skipped' : 'passed'),
                    message: ''
                };
                
                if (testcase.failure) {
                    tc.message = Array.isArray(testcase.failure) ? testcase.failure[0]._ || testcase.failure[0] : testcase.failure._ || testcase.failure;
                    failed++;
                } else if (testcase.skipped) {
                    skipped++;
                } else {
                    passed++;
                }
                testCases.push(tc);
            });
        });
        
        return { total, passed, failed, skipped, testCases };
    } catch (error) {
        console.error('❌ Error parsing XML:', error.message);
        return { total: 0, passed: 0, failed: 0, skipped: 0, testCases: [] };
    }
}

async function findOrCreateTestCasesByTag(tag, testResults) {
    try {
        console.log(`🔍 Finding/creating test cases for tag: ${tag}`);
        const executedTests = testResults.filter(test => test.status !== 'skipped');
        console.log(`✅ Found ${executedTests.length} executed tests`);
        
        if (executedTests.length === 0) return new Map();
        
        console.log(`📡 Fetching existing cases from TestRail...`);
        const response = await testrail.get(`get_cases/${TESTRAIL_PROJECT_ID}&suite_id=${TESTRAIL_SUITE_ID}`);
        const existingTestCases = response.data.cases || [];
        console.log(`✅ Found ${existingTestCases.length} existing cases`);
        
        const existingCaseMap = new Map();
        existingTestCases.forEach(tc => existingCaseMap.set(tc.title, tc));
        
        const caseIdMap = new Map();
        const testsToCreate = [];
        const testsToUpdate = [];
        
        console.log('\n📋 Processing tests:');
        for (const testResult of executedTests) {
            const testName = testResult.name;
            console.log(`  • ${testName} (${testResult.status})`);
            
            if (existingCaseMap.has(testName)) {
                const existingCase = existingCaseMap.get(testName);
                caseIdMap.set(testName, existingCase.id);
                console.log(`    ✅ Matched existing case ID: ${existingCase.id}`);
                
                const currentTags = existingCase.custom_tags || '';
                if (!currentTags.includes(tag)) {
                    testsToUpdate.push({
                        caseId: existingCase.id,
                        newTags: currentTags ? `${currentTags},${tag}` : tag
                    });
                    console.log(`    🏷️  Will add tag: ${tag}`);
                }
            } else {
                console.log(`    ➕ Will create new case`);
                testsToCreate.push({
                    title: testName,
                    type_id: 1,
                    priority_id: 2,
                    custom_tags: tag,
                    refs: testResult.classname || '',
                    custom_description: `UI test: ${testName}`
                });
            }
        }
        
        if (testsToUpdate.length > 0) {
            console.log(`\n🔄 Updating ${testsToUpdate.length} cases...`);
            for (const testToUpdate of testsToUpdate) {
                try {
                    await testrail.post(`update_case/${testToUpdate.caseId}`, {
                        custom_tags: testToUpdate.newTags
                    });
                    console.log(`  ✅ Updated case ${testToUpdate.caseId}`);
                } catch (err) {
                    console.error(`  ❌ Error: ${err.message}`);
                }
            }
        }
        
        if (testsToCreate.length > 0) {
            console.log(`\n➕ Creating ${testsToCreate.length} new cases...`);
            for (const testToCreate of testsToCreate) {
                try {
                    const createResponse = await testrail.post(`add_case/${TESTRAIL_SUITE_ID}`, testToCreate);
                    const newCaseId = createResponse.data.id;
                    caseIdMap.set(testToCreate.title, newCaseId);
                    console.log(`  ✅ Created: ${testToCreate.title} (ID: ${newCaseId})`);
                } catch (err) {
                    console.error(`  ❌ Error creating "${testToCreate.title}": ${err.message}`);
                }
            }
        }
        
        console.log(`\n✅ Total processed: ${caseIdMap.size} cases`);
        return caseIdMap;
        
    } catch (err) {
        console.error(`❌ Error: ${err.message}`);
        return new Map();
    }
}

async function createTestRun(tag, testType, caseIds, customRunName) {
    try {
        const runName = customRunName || `UI Test Run - ${testType} - ${tag}`;
        const description = `UI Test Automation
• Type: ${testType}
• Tag: ${tag}
• Run ID: ${process.env.GITHUB_RUN_ID || 'Unknown'}
• Branch: ${process.env.GITHUB_REF_NAME || 'Unknown'}`;
        
        console.log(`\n🚀 Creating run: ${runName}`);
        const caseIdArray = Array.from(caseIds.values());
        console.log(`📊 Cases: ${caseIdArray.length}`);
        
        const runResponse = await testrail.post('add_run/' + TESTRAIL_PROJECT_ID, {
            name: runName,
            description,
            suite_id: TESTRAIL_SUITE_ID,
            include_all: true
        });
        
        const runId = runResponse.data.id;
        console.log(`✅ Run created: ${runId}`);
        
        if (caseIds.size > 0) {
            await testrail.post(`update_run/${runId}`, {
                include_all: false,
                case_ids: caseIdArray
            });
            console.log(`✅ Added ${caseIdArray.length} cases to run`);
        }
        
        return { runId };
    } catch (err) {
        console.error(`❌ Error creating run: ${err.message}`);
        return null;
    }
}

async function addResultsToRun(runId, testcases, caseIdMap, tag) {
    try {
        console.log(`\n📤 Adding results to run ${runId}...`);
        let successCount = 0, failureCount = 0;
        
        for (const tc of testcases) {
            const case_id = caseIdMap.get(tc.name);
            if (!case_id) continue;
            
            let status_id = tc.failure || tc.error ? 5 : (tc.skipped ? 2 : 1);
            let comment = tc.failure || tc.error ? (tc.message || 'Failed') : (tc.skipped ? 'Skipped' : 'Passed');
            
            if (status_id === 5) failureCount++;
            else if (status_id === 1) successCount++;
            
            try {
                await testrail.post(`add_result_for_case/${runId}/${case_id}`, {
                    status_id,
                    comment: `${comment}\nDuration: ${tc.time}s\nTag: ${tag}`,
                });
            } catch (err) {
                console.error(`  ❌ Error for case ${case_id}`);
            }
        }
        
        console.log(`\n📊 Results: ${successCount} passed, ${failureCount} failed`);
    } catch (err) {
        console.error(`❌ Error adding results: ${err.message}`);
    }
}

(async () => {
    try {
        console.log('🎯 UI TestRail Publisher\n');
        const options = parseArgs();
        const tag = options.tag || 'untagged';
        const testType = options['test-type'] || 'UI Tests';
        
        console.log(`📋 Tag: ${tag}, Type: ${testType}\n`);
        
        const testResults = await parseJunitXml();
        console.log(`📊 Results: ${testResults.total} total, ${testResults.passed} passed, ${testResults.failed} failed`);
        
        const executedTests = testResults.testCases.filter(tc => tc.status !== 'skipped');

        if (testResults.total === 0) {
            const outputData = {
                runIds: [],
                reportUrl: `${TESTRAIL_HOST}/index.php?/runs/view/`,
                testType, tag, totalRuns: 0, error: 'No results'
            };
            fs.writeFileSync('testrail_output.json', JSON.stringify(outputData, null, 2));
            return;
        }

        const caseIdMap = await findOrCreateTestCasesByTag(tag, testResults.testCases);
        if (caseIdMap.size === 0) {
            console.error('\n❌ No cases found/created');
            process.exit(1);
        }
        
        const result = await createTestRun(tag, testType, caseIdMap, options['run-name']);
        if (!result) process.exit(1);
        
        await addResultsToRun(result.runId, testResults.testCases, caseIdMap, tag);
        
        const outputData = {
            runIds: [result.runId],
            reportUrl: `${TESTRAIL_HOST}/index.php?/runs/view/${result.runId}`,
            testType, tag, totalRuns: 1,
            testResults: {
                total: testResults.total,
                passed: testResults.passed,
                failed: testResults.failed,
                skipped: testResults.skipped
            }
        };
        
        fs.writeFileSync('testrail_output.json', JSON.stringify(outputData, null, 2));
        console.log(`\n✅ SUCCESS! Run: ${result.runId}`);
        console.log(`📊 URL: ${outputData.reportUrl}`);
        
    } catch (error) {
        console.error('\n💥 Fatal error:', error.message);
        process.exit(1);
    }
})();

