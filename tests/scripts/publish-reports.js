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
    const testRailsErrorEnv = {
        TESTRAIL_HOST: !!TESTRAIL_HOST,
        TESTRAIL_PROJECT_ID: !!TESTRAIL_PROJECT_ID,
        TESTRAIL_USER: !!TESTRAIL_USER,
        TESTRAIL_API_KEY: !!TESTRAIL_API_KEY,
        TESTRAIL_SUITE_ID: !!TESTRAIL_SUITE_ID
    };
    console.error('TestRail environment error. ENV Status:', JSON.stringify(testRailsErrorEnv));
    process.exit(1);
}

const testrail = axios.create({
    baseURL: `${TESTRAIL_HOST}/index.php?/api/v2/`,
    auth: {
        username: TESTRAIL_USER,
        password: TESTRAIL_API_KEY,
    },
});

const RESULTS_FILE = 'playwright-report/results.xml';

async function parseJUnitGroupedByBrowser(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error(`Results file not found: ${filePath}`);
        console.log('Available files in playwright-report directory:');
        try {
            const files = fs.readdirSync('playwright-report');
            files.forEach(file => console.log(`  - ${file}`));
        } catch (err) {
            console.error('Could not read playwright-report directory:', err.message);
        }
        console.log('Available XML files in current directory:');
        try {
            const allFiles = fs.readdirSync('.');
            const xmlFiles = allFiles.filter(file => file.endsWith('.xml'));
            xmlFiles.forEach(file => console.log(`  - ${file}`));
        } catch (err) {
            console.error('Could not read current directory:', err.message);
        }
        return {};
    }
    
    const xml = fs.readFileSync(filePath, 'utf-8');
    const result = await parseStringPromise(xml);
    const browserGroups = {};
    const suites = result.testsuites?.testsuite || [];
    console.log(suites);
    for (const suite of suites) {
        const browser = suite.$.hostname || 'unknown';
        if (!browserGroups[browser]) browserGroups[browser] = [];
        const cases = suite.testcase || [];
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
    return browserGroups;
}

async function createTestPlan(browser, tag, testType, caseIds) {
    try {
        const now = new Date().toISOString();
        const timestamp = new Date().toLocaleString('en-US', { 
            timeZone: 'UTC',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        // Create dynamic run name based on browser and tag
        const runName = `Automated Playwright Run - ${browser} - ${tag}`;
        
        const description = `Automated Playwright test run
• Browser: ${browser}
• Tag: ${tag || 'None'}
• Environment: GitHub Actions
• Run ID: ${process.env.GITHUB_RUN_ID || 'Unknown'}`;
        
        console.log(`Creating TestRail run: ${runName}`);
        console.log(`Using ${caseIds.length} case IDs: [${caseIds.join(', ')}]`);
        console.log(`TestRail run will contain ONLY these ${caseIds.length} test cases (no untested cases)`);
        
        // Step 1: Create a test run with include_all: true (TestRail requirement)
        const runResponse = await testrail.post('add_run/' + TESTRAIL_PROJECT_ID, {
            name: runName,
            description,
            suite_id: TESTRAIL_SUITE_ID,
            include_all: true // TestRail requires this initially
        });
        
        const runId = runResponse.data.id;
        console.log(`Created TestRail run ID: ${runId} for browser: ${browser}`);
        
        // Step 2: Add specific cases to the run
        if (caseIds.length > 0) {
            console.log(`Adding ${caseIds.length} specific cases to run ${runId}`);
            await testrail.post(`update_run/${runId}`, {
                include_all: false,
                case_ids: caseIds
            });
            console.log(`Successfully added ${caseIds.length} cases to run ${runId}`);
        }
        
        // Store the run ID instead of plan ID for later use
        return { runId, planId: null };
        
    } catch (err) {
        console.error(`Error creating TestRail run - ${browser}: ${err.message}`);
        if (err.response) {
            console.error('TestRail API response:', err.response.data);
        }
        return null;
    }
}

async function findOrCreateTestCasesByTag(tag, testResults) {
    try {
        console.log(`Finding/creating test cases for tag: ${tag}`);
        
        // Get ALL test cases from the Master suite (no tag filter)
        const response = await testrail.get(`get_cases/${TESTRAIL_PROJECT_ID}&suite_id=${TESTRAIL_SUITE_ID}`);
        const existingTestCases = response.data.cases || [];
        
        console.log(`Found ${existingTestCases.length} existing test cases in Master suite`);
        
        // Create a map of existing test cases by title for quick lookup
        const existingCaseMap = new Map();
        existingTestCases.forEach(tc => {
            existingCaseMap.set(tc.title, tc);
        });
        
        const caseIdMap = new Map(); // Map test name to case ID
        const testsToCreate = [];
        const testsToUpdate = [];
        
        // Process each test result
        for (const testResult of testResults) {
            const testName = testResult.name;
            
            // Check if test case already exists
            if (existingCaseMap.has(testName)) {
                const existingCase = existingCaseMap.get(testName);
                caseIdMap.set(testName, existingCase.id);
                
                // Check if the tag is missing from custom_tags
                const currentTags = existingCase.custom_tags || '';
                if (!currentTags.includes(tag)) {
                    testsToUpdate.push({
                        caseId: existingCase.id,
                        currentTags: currentTags,
                        newTags: currentTags ? `${currentTags},${tag}` : tag
                    });
                }
            } else {
                // Test case doesn't exist, we'll create it
                testsToCreate.push({
                    title: testName,
                    type_id: 1, // Functional test type
                    priority_id: 2, // Medium priority
                    custom_tags: tag,
                    refs: testResult.classname || '',
                    custom_description: `Automatically created test case for Playwright test: ${testName}\nClass: ${testResult.classname || 'N/A'}`
                });
            }
        }
        
        // Update existing test cases with missing tags
        if (testsToUpdate.length > 0) {
            console.log(`Updating ${testsToUpdate.length} existing test cases with tag: ${tag}`);
            
            for (const testToUpdate of testsToUpdate) {
                try {
                    await testrail.post(`update_case/${testToUpdate.caseId}`, {
                        custom_tags: testToUpdate.newTags
                    });
                    console.log(`Updated test case ID ${testToUpdate.caseId} with tags: ${testToUpdate.newTags}`);
                } catch (err) {
                    console.error(`Error updating test case ${testToUpdate.caseId}: ${err.message}`);
                    if (err.response) {
                        console.error('TestRail API response:', err.response.data);
                    }
                }
            }
        }
        
        // Create new test cases if needed
        if (testsToCreate.length > 0) {
            console.log(`Creating ${testsToCreate.length} new test cases in TestRail...`);
            
            for (const testToCreate of testsToCreate) {
                try {
                    const createResponse = await testrail.post(`add_case/${TESTRAIL_SUITE_ID}`, testToCreate);
                    const newCaseId = createResponse.data.id;
                    caseIdMap.set(testToCreate.title, newCaseId);
                    console.log(`Created test case: ${testToCreate.title} (ID: ${newCaseId})`);
                } catch (err) {
                    console.error(`Error creating test case ${testToCreate.title}: ${err.message}`);
                    if (err.response) {
                        console.error('TestRail API response:', err.response.data);
                    }
                }
            }
        }
        
        // Convert map to array of case IDs in the same order as testResults
        const caseIds = testResults.map(testResult => caseIdMap.get(testResult.name)).filter(id => id);
        
        console.log(`Total test cases processed: ${caseIds.length}`);
        console.log(`Case ID mapping:`, Object.fromEntries(caseIdMap));
        console.log(`Test cases that will be included in TestRail run:`);
        testResults.forEach((testResult, index) => {
            const caseId = caseIdMap.get(testResult.name);
            console.log(`  ${index + 1}. "${testResult.name}" -> Case ID: ${caseId || 'NOT FOUND'}`);
        });
        
        return caseIds;
        
    } catch (err) {
        console.error(`Error finding/creating test cases for tag ${tag}: ${err.message}`);
        if (err.response) {
            console.error('TestRail API response:', err.response.data);
        }
        return [];
    }
}

async function addResultsToRunWithCaseIds(runId, testcases, caseIds, tag) {
    try {
        console.log(`Adding ${testcases.length} test cases to run ${runId} using ${caseIds.length} case IDs`);
        
        // Create a map of test names to case IDs for quick lookup
        const caseIdMap = new Map();
        caseIds.forEach((caseId, index) => {
            if (index < testcases.length) {
                caseIdMap.set(testcases[index].name, caseId);
            }
        });
        
        for (const tc of testcases) {
            const case_id = caseIdMap.get(tc.name);
            
            if (!case_id) {
                console.log(`No TestRail case ID found for test: ${tc.name}`);
                continue;
            }
            
            // Determine status
            let status_id;
            let comment = '';
            
            if (tc.failure || tc.error) {
                status_id = 5; // Failed
                comment = tc.message || 'Test failed';
            } else if (tc.skipped) {
                status_id = 2; // Blocked
                comment = 'Test skipped';
            } else {
                status_id = 1; // Passed
                comment = 'Test passed';
            }
            
            try {
                console.log(`Adding result for case ${case_id}: status ${status_id}`);
                await testrail.post(`add_result_for_case/${runId}/${case_id}`, {
                    status_id,
                    comment: `${comment}\nTest: ${tc.name}\nDuration: ${tc.time}s\nTag: ${tag}`,
                });
            } catch (err) {
                console.error(`Error adding result for case ${case_id}: ${err.message}`);
                if (err.response) {
                    console.error('TestRail API response:', err.response.data);
                }
            }
        }
    } catch (err) {
        console.error(`Error adding results to run ${runId}: ${err.message}`);
        if (err.response) {
            console.error('TestRail API response:', err.response.data);
        }
    }
}

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {};
    
    for (let i = 0; i < args.length; i += 2) {
        if (args[i].startsWith('--')) {
            const key = args[i].slice(2);
            const value = args[i + 1];
            options[key] = value;
        }
    }
    
    return options;
}

(async () => {
    try {
        const options = parseArgs();
        const tag = options.tag;
        const testType = options['test-type'];
        
        console.log(`Publishing results with tag: ${tag || 'none'}, test type: ${testType || 'default'}`);
        console.log(`TestRail Host: ${TESTRAIL_HOST}`);
        console.log(`TestRail Project ID: ${TESTRAIL_PROJECT_ID}`);
        console.log(`TestRail Suite ID: ${TESTRAIL_SUITE_ID}`);
        
        if (!fs.existsSync(RESULTS_FILE)) {
            console.error(`Report file not found: ${RESULTS_FILE}`);
            process.exit(1);
        }
        
        const browserGroups = await parseJUnitGroupedByBrowser(RESULTS_FILE);
        console.log(`Found ${Object.keys(browserGroups).length} browser groups:`, Object.keys(browserGroups));

        if (Object.keys(browserGroups).length === 0) {
            console.warn('No test results found. Creating empty TestRail output.');
            const outputData = {
                runIds: [],
                planIds: [],
                reportUrl: `${TESTRAIL_HOST}/index.php?/plans/view/`,
                testType: testType,
                tag: tag,
                totalPlans: 0,
                error: 'No test results found'
            };
            fs.writeFileSync('testrail_output.json', JSON.stringify(outputData, null, 2));
            console.log('Empty TestRail output created due to no test results');
            return;
        }

        const runIds = [];
        for (const browser of Object.keys(browserGroups)) {
            const testcases = browserGroups[browser];
            console.log(`Processing ${testcases.length} test cases for browser: ${browser}`);
            
            // Find or create test cases in TestRail
            const caseIds = await findOrCreateTestCasesByTag(tag, testcases);
            console.log(`Found/created ${caseIds.length} test cases for browser: ${browser}`);
            
            const result = await createTestPlan(browser, tag, testType, caseIds);
            if (!result || !result.runId) {
                console.error(`Failed to create run for browser: ${browser}`);
                continue;
            }
            
            // Add results using the case IDs we found/created
            await addResultsToRunWithCaseIds(result.runId, testcases, caseIds, tag);
            runIds.push(result.runId);
            console.log(`Successfully processed browser: ${browser} with run ID: ${result.runId}`);
        }
        
        // Write run IDs to file for pipeline capture
        if (runIds.length > 0) {
            const outputData = {
                runIds: runIds,
                planIds: [], // No plans, only runs
                reportUrl: `${TESTRAIL_HOST}/index.php?/runs/view/`,
                testType: testType,
                tag: tag,
                totalRuns: runIds.length
            };
            fs.writeFileSync('testrail_output.json', JSON.stringify(outputData, null, 2));
            console.log(`TestRail run IDs saved: ${runIds.join(',')}`);
            console.log(`TestRail report URL: ${outputData.reportUrl}`);
        } else {
            console.warn('No TestRail runs were created');
            // Create empty output file
            const outputData = {
                runIds: [],
                planIds: [],
                reportUrl: `${TESTRAIL_HOST}/index.php?/runs/view/`,
                testType: testType,
                tag: tag,
                totalRuns: 0
            };
            fs.writeFileSync('testrail_output.json', JSON.stringify(outputData, null, 2));
        }
    } catch (error) {
        console.error('Fatal error in publish-reports.js:', error);
        process.exit(1);
    }
})();