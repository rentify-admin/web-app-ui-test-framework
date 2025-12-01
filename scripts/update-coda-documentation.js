#!/usr/bin/env node
/**
 * Update Coda Documentation
 * 
 * Reads test files, uses template to format entries, and updates Coda page directly.
 * For each test:
 * - If exists and needs update -> Update using template
 * - If doesn't exist -> Create new entry using template
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import Coda from 'coda-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TESTS_DIR = path.join(__dirname, '../tests');
const TEMPLATE_FILE = path.join(__dirname, '../documentation/TEST_DOCUMENTATION_TEMPLATE.md');
const QODO_PROMPT_TEMPLATE = path.join(__dirname, 'qodo-prompt-template.md');
const CODA_DOC_ID = process.env.CODA_DOC_ID || 'dza2s1eOIhA';
const CODA_PAGE_ID = process.env.CODA_PAGE_ID || 'suLCLolD';
const CODA_API_TOKEN = process.env.CODA_API_TOKEN;
const QODO_API_KEY = process.env.QODO_API_KEY;
const QODO_API_URL = process.env.QODO_API_URL || 'https://api.qodo.ai/v1/chat/completions';

if (!CODA_API_TOKEN) {
    console.error('❌ CODA_API_TOKEN environment variable is required');
    process.exit(1);
}

if (!QODO_API_KEY) {
    console.error('❌ QODO_API_KEY environment variable is required');
    process.exit(1);
}

const CODA_API_BASE = 'https://coda.io/apis/v1';

/**
 * Load template
 */
function loadTemplate() {
    const template = fs.readFileSync(TEMPLATE_FILE, 'utf-8');
    return template;
}

/**
 * Load QODO prompt template
 */
function loadQodoPrompt() {
    const prompt = fs.readFileSync(QODO_PROMPT_TEMPLATE, 'utf-8');
    return prompt;
}

/**
 * Call QODO API to parse test file and generate structured documentation
 */
async function parseTestWithQodo(testFilePath, testContent) {
    try {
        const promptTemplate = loadQodoPrompt();
        const fileName = path.basename(testFilePath);
        
        // Construct the full prompt
        const fullPrompt = `${promptTemplate}

## Test File to Analyze

\`\`\`javascript
${testContent}
\`\`\`

Please analyze this test file and return the JSON structure as specified in the output format above.`;

        console.log(`   🤖 Calling QODO API for ${fileName}...`);
        
        // Call QODO API
        const response = await axios.post(
            QODO_API_URL,
            {
                model: 'gpt-4', // or whatever model QODO uses
                messages: [
                    {
                        role: 'system',
                        content: 'You are a test documentation expert. Analyze test files and return structured JSON documentation.'
                    },
                    {
                        role: 'user',
                        content: fullPrompt
                    }
                ],
                temperature: 0.3, // Lower temperature for more consistent output
                response_format: { type: 'json_object' } // Request JSON response
            },
            {
                headers: {
                    'Authorization': `Bearer ${QODO_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000 // 60 second timeout
            }
        );
        
        // Extract JSON from response
        let parsedData;
        try {
            const content = response.data.choices[0].message.content;
            // Try to parse as JSON
            parsedData = typeof content === 'string' ? JSON.parse(content) : content;
        } catch (parseError) {
            console.error(`   ⚠️  Failed to parse QODO response as JSON: ${parseError.message}`);
            // Try to extract JSON from markdown code blocks
            const jsonMatch = response.data.choices[0].message.content.match(/```json\n([\s\S]*?)\n```/) ||
                            response.data.choices[0].message.content.match(/```\n([\s\S]*?)\n```/);
            if (jsonMatch) {
                parsedData = JSON.parse(jsonMatch[1]);
            } else {
                throw new Error('Could not extract JSON from QODO response');
            }
        }
        
        console.log(`   ✅ QODO analysis completed for ${fileName}`);
        return parsedData;
        
    } catch (error) {
        console.error(`   ❌ QODO API error for ${path.basename(testFilePath)}:`, error.response?.data || error.message);
        throw error;
    }
}

/**
 * Parse test file (reuse logic from generate-test-documentation.js)
 */
function parseTestFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    const testInfo = {
        filePath: path.relative(TESTS_DIR, filePath),
        fileName: path.basename(filePath),
        tests: [],
        imports: [],
        apiEndpoints: [],
        uiTestIds: new Set(),
        describeName: null
    };

    // Extract test.describe name
    const describeMatch = content.match(/test\.describe\(['"`]([^'"`]+)['"`]/);
    if (describeMatch) {
        testInfo.describeName = describeMatch[1];
    }

    // Extract test() calls
    const testRegex = /test\(['"`]([^'"`]+)['"`]\s*,\s*\{[^}]*tag:\s*\[([^\]]+)\][^}]*\}/g;
    let testMatch;
    while ((testMatch = testRegex.exec(content)) !== null) {
        const testName = testMatch[1];
        const tagsStr = testMatch[2];
        const tags = tagsStr.split(',').map(t => t.trim().replace(/['"`]/g, ''));
        testInfo.tests.push({ name: testName, tags });
    }

    // Fallback: extract test names without tags
    if (testInfo.tests.length === 0) {
        const simpleTestRegex = /test\(['"`]([^'"`]+)['"`]/g;
        while ((testMatch = simpleTestRegex.exec(content)) !== null) {
            testInfo.tests.push({ name: testMatch[1], tags: [] });
        }
    }

    // Extract imports
    const importRegex = /import\s+(?:(?:\{[^}]+\}|\w+)\s+from\s+)?['"`]([^'"`]+)['"`]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
        testInfo.imports.push(match[1]);
    }

    // Extract application name
    const appNameMatches = [
        content.match(/(?:applicationName|appName|const\s+\w*app\w*\s*=\s*)['"`]([^'"`]+)['"`]/),
        content.match(/['"`](AutoTest[^'"`]+|Autotest[^'"`]+)['"`]/)
    ];
    for (const match of appNameMatches) {
        if (match) {
            testInfo.applicationName = match[1];
            break;
        }
    }

    // Extract API endpoints
    const apiPatterns = [
        /(?:apiClient|request)\.(get|post|patch|put|delete)\(['"`]([^'"`]+)['"`]/g,
        /['"`](GET|POST|PATCH|PUT|DELETE)\s+([\/\w-]+)['"`]/g
    ];
    for (const pattern of apiPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const method = match[1]?.toUpperCase() || match[1];
            const url = match[2];
            if (method && url) {
                testInfo.apiEndpoints.push({ method, url });
            }
        }
    }

    // Extract UI test IDs
    const testIdRegex = /getByTestId\(['"`]([^'"`]+)['"`]\)/g;
    let testIdMatch;
    while ((testIdMatch = testIdRegex.exec(content)) !== null) {
        testInfo.uiTestIds.add(testIdMatch[1]);
    }

    testInfo.uiTestIds = Array.from(testInfo.uiTestIds);

    return { testInfo, content };
}

/**
 * Generate test entry from QODO analysis result
 */
function generateTestEntryFromQodo(qodoTest, fileName, filePath, template) {
    const timestamp = new Date().toISOString();
    const testId = qodoTest.testId || fileName.replace('.spec.js', '');
    const humanReadableTime = new Date(timestamp).toLocaleString('en-US', { 
        timeZone: 'UTC', 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: false 
    });

    // Format test steps table
    const testStepsRows = qodoTest.testSteps && qodoTest.testSteps.length > 0
        ? qodoTest.testSteps.map(step => 
            `| **${step.stepNumber}. ${step.stepName}** | ${step.action || '{data not found for this field}'} | ${step.input || '{data not found for this field}'} | ${step.expectedResult || '{data not found for this field}'} | ${step.apiCalls && step.apiCalls.length > 0 ? step.apiCalls.join(', ') : '{data not found for this field}'} | ${step.uiElements && step.uiElements.length > 0 ? step.uiElements.map(id => `\`${id}\``).join(', ') : '{data not found for this field}'} |`
        ).join('\n')
        : '| {data not found for this field} | {data not found for this field} | {data not found for this field} | {data not found for this field} | {data not found for this field} | {data not found for this field} |';

    // Format expected outcomes
    const expectedOutcomes = qodoTest.expectedOutcomes && qodoTest.expectedOutcomes.length > 0
        ? qodoTest.expectedOutcomes.map(outcome => `- ✅ ${outcome}`).join('\n')
        : '- ✅ {data not found for this field}';

    // Format validation points
    const validationPoints = qodoTest.validationPoints && qodoTest.validationPoints.length > 0
        ? qodoTest.validationPoints.map(validation => `- ✅ ${validation}`).join('\n')
        : '- ✅ {data not found for this field}';

    // Format cleanup
    const cleanup = qodoTest.cleanup && qodoTest.cleanup.length > 0
        ? qodoTest.cleanup.map(item => `- 🗑️ ${item}`).join('\n')
        : '{data not found for this field}';

    // Format API endpoints
    const apiEndpointsRows = qodoTest.apiEndpoints && qodoTest.apiEndpoints.length > 0
        ? qodoTest.apiEndpoints.map(ep => 
            `| \`${ep.method || 'N/A'}\` | \`${ep.endpoint || 'N/A'}\` | ${ep.purpose || '{data not found for this field}'} |`
        ).join('\n')
        : '| {data not found for this field} | {data not found for this field} | {data not found for this field} |';

    // Format UI test IDs
    const uiTestIdsRows = qodoTest.uiTestIds && qodoTest.uiTestIds.length > 0
        ? qodoTest.uiTestIds.map(ui => 
            `| \`${ui.testId || ui}\` | ${typeof ui === 'object' && ui.purpose ? ui.purpose : '{data not found for this field}'} |`
        ).join('\n')
        : '| {data not found for this field} | {data not found for this field} |';

    // Format tags
    const tags = qodoTest.tags && qodoTest.tags.length > 0
        ? qodoTest.tags.map(t => `\`${t}\``).join(' ')
        : '\`{data not found for this field}\`';

    // Format dependencies
    const dependencies = qodoTest.dependencies && qodoTest.dependencies.length > 0
        ? qodoTest.dependencies.map(dep => `- 📦 \`${dep}\``).join('\n')
        : '- 📦 {data not found for this field}';

    // Format related tests
    const relatedTests = qodoTest.relatedTests && qodoTest.relatedTests.length > 0
        ? qodoTest.relatedTests.map(test => `- 🔗 \`${test}\``).join('\n')
        : '- 🔗 {data not found for this field}';

    // Format prerequisites
    const prerequisites = qodoTest.prerequisites && qodoTest.prerequisites.length > 0
        ? qodoTest.prerequisites.join(', ')
        : '{data not found for this field}';

    return `### 🧪 \`${fileName}\` → \`${qodoTest.testName}\`

| Field | Value |
|-------|-------|
| **Test ID** | \`${testId}\` |
| **Test File** | \`${filePath}\` |
| **Last Updated** | \`${timestamp}\` |
| **Status** | \`active\` |

---

## 📋 Test Scenario

> **Purpose:** ${qodoTest.purpose || '{data not found for this field}'}

> **Business Context:** ${qodoTest.businessContext || '{data not found for this field}'}

### Test Conditions

| Condition | Value |
|-----------|-------|
| **Application** | \`${qodoTest.application || '{data not found for this field}'}\` |
| **User Role** | ${qodoTest.userRole ? `\`${qodoTest.userRole}\`` : '{data not found for this field}'} |
| **Environment** | \`${qodoTest.environment || 'staging|production'}\` |
| **Prerequisites** | ${prerequisites} |
| **Test Data Setup** | ${qodoTest.testDataSetup || '{data not found for this field}'} |

### Test Data Used

| Data Type | Details |
|-----------|---------|
| **Users** | ${qodoTest.users && qodoTest.users.length > 0 ? qodoTest.users.join(', ') : '{data not found for this field}'} |
| **Sessions** | ${qodoTest.sessions || '{data not found for this field}'} |
| **Applications** | ${qodoTest.applications || '{data not found for this field}'} |
| **Mock Data** | ${qodoTest.mockData && qodoTest.mockData.length > 0 ? qodoTest.mockData.join(', ') : '{data not found for this field}'} |
| **API Payloads** | ${qodoTest.apiPayloads && qodoTest.apiPayloads.length > 0 ? qodoTest.apiPayloads.join(', ') : '{data not found for this field}'} |

### Expected Outcomes

${expectedOutcomes}

---

## 📝 Test Case

### Test Steps

| Step | Action | Input | Expected Result | API Calls | UI Elements |
|------|--------|-------|-----------------|-----------|-------------|
${testStepsRows}

### Validation Points

${validationPoints}

### Cleanup

${cleanup}

### API Endpoints Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
${apiEndpointsRows}

### UI Test IDs Used

| Test ID | Purpose |
|---------|---------|
${uiTestIdsRows}

### Tags

${tags}

### Dependencies

${dependencies}

### Known Issues/Limitations

⚠️ ${qodoTest.knownIssues || '{data not found for this field}'}
💡 {Workarounds if any}

### Related Tests

${relatedTests}

---

**Last Updated:** ${humanReadableTime} UTC (\`${timestamp}\`)

---
`;
}

/**
 * Generate test entry using template format (legacy - kept for fallback)
 */
function generateTestEntry(testInfo, test, testContent, template) {
    const timestamp = new Date().toISOString();
    const testId = testInfo.describeName || testInfo.fileName.replace('.spec.js', '');
    
    // Extract purpose
    const purposeMatch = testContent.match(/\/\*\*[\s\S]*?\*\//) || 
                        testContent.match(/\/\/\s*Purpose:([^\n]+)/);
    const purpose = purposeMatch ? 
        (testContent.match(/Purpose:([^\n]+)/)?.[1]?.trim() || 
         purposeMatch[0].replace(/\/\*\*|\*\/|\*/g, '').trim()) : 
        'Validates functionality as described in test name';

    // Helper extraction functions (simplified)
    const extractBusinessContext = (content) => {
        const match = content.match(/(?:Business|Context|Requirement|Purpose)[:\s]+([^\n]+)/i);
        return match ? match[1].trim() : null;
    };

    const extractUserRole = (content) => {
        const roleMatch = content.match(/(?:role|Role)[:\s]*['"`]([^'"`]+)['"`]/);
        return roleMatch ? `\`${roleMatch[1]}\`` : null;
    };

    const extractPrerequisites = (content) => {
        if (content.includes('beforeAll') || content.includes('beforeEach')) {
            return 'Test setup performed in beforeAll/beforeEach hooks';
        }
        return null;
    };

    const extractTestDataSetup = (content) => {
        const setups = [];
        if (content.includes('createSession') || content.includes('generateSession')) {
            setups.push('Session created via API or UI');
        }
        if (content.includes('createUser') || content.includes('createMember')) {
            setups.push('User/member created via API');
        }
        return setups.length > 0 ? setups.join('; ') : null;
    };

    const extractUsers = (content) => {
        const userMatches = Array.from(content.matchAll(/(?:email|user)[:\s]*['"`]([^'"`@]+@[^'"`]+)['"`]/g));
        const users = userMatches.map(m => m[1]).filter((v, i, a) => a.indexOf(v) === i);
        return users.length > 0 ? users.join(', ') : null;
    };

    const extractSessions = (content) => {
        if (content.includes('session') && (content.includes('rentBudget') || content.includes('rent_budget'))) {
            return 'Session with rent budget configuration';
        }
        return null;
    };

    const extractMockData = (imports) => {
        const mockImports = imports.filter(imp => 
            imp.includes('mock') || imp.includes('fixture') || imp.includes('payload')
        );
        return mockImports.length > 0 ? mockImports.join(', ') : null;
    };

    const extractApiPayloads = (content) => {
        const payloads = [];
        if (content.includes('PERSONA_PAYLOAD')) payloads.push('PERSONA');
        if (content.includes('VERIDOCS_PAYLOAD')) payloads.push('VERIDOCS');
        if (content.includes('ATOMIC_PAYLOAD')) payloads.push('ATOMIC');
        return payloads.length > 0 ? `Simulation payloads (${payloads.join(', ')})` : null;
    };

    const extractExpectedOutcomes = (content) => {
        const expectMatches = Array.from(content.matchAll(/expect\([^)]+\)\.(toBe|toEqual|toContain|toBeVisible|toBeEnabled)\([^)]+\)/g));
        const outcomes = expectMatches.slice(0, 10).map(m => `- ✅ ${m[0]}`);
        return outcomes.length > 0 ? outcomes.join('\n') : null;
    };

    const extractTestSteps = (content) => {
        const stepComments = Array.from(content.matchAll(/(?:Step\s+\d+|#\s*Step\s+\d+)[:\s]+([^\n]+)/gi));
        if (stepComments.length > 0) {
            return stepComments.map((match, idx) => 
                `${idx + 1}. **Step ${idx + 1}**\n   - Action: ${match[1].trim()}\n   - Input: {Extracted from test code}\n   - Expected Result: {Extracted from test code}`
            ).join('\n\n');
        }
        return `1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*`;
    };

    const extractValidationPoints = (content) => {
        const validationMatches = Array.from(content.matchAll(/expect\([^)]+\)/g));
        const validations = validationMatches.slice(0, 15).map(m => `- ✅ ${m[0]}`);
        return validations.length > 0 ? validations.join('\n') : null;
    };

    const extractCleanup = (content) => {
        if (content.includes('afterAll') || content.includes('cleanup')) {
            return 'Cleanup performed in afterAll hook or cleanup helper';
        }
        return null;
    };

    const extractDependencies = (imports) => {
        const utils = imports.filter(imp => imp.includes('utils') || imp.includes('helper'));
        return utils.length > 0 ? utils.map(i => `- 📦 \`${i}\``).join('\n') : null;
    };

    const extractKnownIssues = (content) => {
        const issueMatch = content.match(/(?:TODO|FIXME|KNOWN_ISSUE|LIMITATION)[:\s]+([^\n]+)/i);
        return issueMatch ? issueMatch[1].trim() : null;
    };

    const extractRelatedTests = (content) => {
        const relatedMatches = Array.from(content.matchAll(/(?:related|similar|see)[:\s]+([a-z_]+\.spec\.js)/gi));
        const related = relatedMatches.map(m => `- 🔗 \`${m[1]}\``);
        return related.length > 0 ? related.join('\n') : null;
    };

    // Generate entry using template format
    const humanReadableTime = new Date(timestamp).toLocaleString('en-US', { 
        timeZone: 'UTC', 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: false 
    });

    return `### 🧪 \`${testInfo.fileName}\` → \`${test.name}\`

| Field | Value |
|-------|-------|
| **Test ID** | \`${testId}\` |
| **Test File** | \`${testInfo.filePath}\` |
| **Last Updated** | \`${timestamp}\` |
| **Status** | \`active\` |

---

## 📋 Test Scenario

> **Purpose:** ${purpose}

> **Business Context:** ${extractBusinessContext(testContent) || '{data not found for this field}'}

### Test Conditions

| Condition | Value |
|-----------|-------|
| **Application** | \`${testInfo.applicationName || '{data not found for this field}'}\` |
| **User Role** | ${extractUserRole(testContent) || '{data not found for this field}'} |
| **Environment** | \`staging|production\` |
| **Prerequisites** | ${extractPrerequisites(testContent) || '{data not found for this field}'} |
| **Test Data Setup** | ${extractTestDataSetup(testContent) || '{data not found for this field}'} |

### Test Data Used

| Data Type | Details |
|-----------|---------|
| **Users** | ${extractUsers(testContent) || '{data not found for this field}'} |
| **Sessions** | ${extractSessions(testContent) || '{data not found for this field}'} |
| **Applications** | ${testInfo.applicationName || '{data not found for this field}'} |
| **Mock Data** | ${extractMockData(testInfo.imports) || '{data not found for this field}'} |
| **API Payloads** | ${extractApiPayloads(testContent) || '{data not found for this field}'} |

### Expected Outcomes

${extractExpectedOutcomes(testContent) || '- ✅ {data not found for this field}'}

---

## 📝 Test Case

### Test Steps

${extractTestSteps(testContent)}

### Validation Points

${extractValidationPoints(testContent) || '- ✅ {data not found for this field}'}

### Cleanup

${extractCleanup(testContent) || '{data not found for this field}'}

### API Endpoints Used

${testInfo.apiEndpoints.length > 0 ? 
    testInfo.apiEndpoints.map(ep => `| \`${ep.method}\` | \`${ep.url}\` | {Purpose} |`).join('\n') : 
    '| - | - | {data not found for this field} |'}

### UI Test IDs Used

${testInfo.uiTestIds.length > 0 ? 
    testInfo.uiTestIds.map(id => `| \`${id}\` | {Purpose} |`).join('\n') : 
    '| - | {data not found for this field} |'}

### Tags

${test.tags.length > 0 ? test.tags.map(t => `\`${t}\``).join(' ') : '\`{data not found for this field}\`'}

### Dependencies

${extractDependencies(testInfo.imports) || '- 📦 {data not found for this field}'}

### Known Issues/Limitations

${extractKnownIssues(testContent) || '✅ None documented'}

### Related Tests

${extractRelatedTests(testContent) || '- 🔗 {data not found for this field}'}

---

**Last Updated:** ${humanReadableTime} UTC (\`${timestamp}\`)

---
`;
}

/**
 * Get current Coda page content
 */
async function getCodaPageContent() {
    try {
        // Get page info
        const pageResponse = await axios.get(
            `${CODA_API_BASE}/docs/${CODA_DOC_ID}/pages/${CODA_PAGE_ID}`,
            {
                headers: {
                    'Authorization': `Bearer ${CODA_API_TOKEN}`
                }
            }
        );
        
        // Try to get page content as markdown
        try {
            const contentResponse = await axios.get(
                `${CODA_API_BASE}/docs/${CODA_DOC_ID}/pages/${CODA_PAGE_ID}/content`,
                {
                    headers: {
                        'Authorization': `Bearer ${CODA_API_TOKEN}`,
                        'Accept': 'text/markdown'
                    }
                }
            );
            return {
                ...pageResponse.data,
                content: contentResponse.data
            };
        } catch (contentError) {
            // Content endpoint might not be available, return page info only
            return pageResponse.data;
        }
    } catch (error) {
        if (error.response?.status === 404) {
            return null;
        }
        throw error;
    }
}

/**
 * Check if test entry exists in Coda page
 */
function findTestEntryInCoda(pageContent, fileName, testName) {
    if (!pageContent) return null;
    
    // Try to get page content as markdown
    const content = pageContent.content || '';
    const searchPattern = new RegExp(`### 🧪? \\\`${fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\\` → \\\`${testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\\``);
    
    if (searchPattern.test(content)) {
        return true;
    }
    
    return false;
}

/**
 * Update Coda page content
 * 
 * The Coda API v1 PUT endpoint for pages only updates metadata (name, subtitle, icon).
 * To update content, we need to use the content import endpoint or a different method.
 * 
 * Based on Coda API documentation, content updates may require:
 * 1. Using the content import endpoint (if available)
 * 2. Using the MCP server's method (not available in GitHub Actions)
 * 3. Or using a workaround with the page update endpoint
 * 
 * Let's try using POST to the content endpoint with markdown format.
 */
async function updateCodaPage(newContent) {
    try {
        // First, verify the page exists
        const pageInfo = await getCodaPageContent();
        if (!pageInfo) {
            throw new Error(`Page ${CODA_PAGE_ID} not found in document ${CODA_DOC_ID}`);
        }
        
        console.log('📄 Page found, attempting to update content...');
        
        // IMPORTANT: The Coda REST API v1 does NOT support direct page content updates
        // Neither the REST API nor coda-js library support updating page content
        // 
        // The only way to update page content programmatically is via:
        // 1. The Coda MCP server (coda-mcp package) - not available in GitHub Actions
        // 2. Manual update via Coda UI
        // 3. Using Coda tables instead of pages (tables support row updates)
        //
        // For now, we'll log a clear error message explaining the limitation
        console.log('❌ ERROR: Coda API v1 does not support direct page content updates');
        console.log('');
        console.log('   The Coda REST API v1 PUT /pages/{pageId} endpoint only accepts:');
        console.log('   - name (page title)');
        console.log('   - subtitle');
        console.log('   - icon');
        console.log('   It does NOT accept content.');
        console.log('');
        console.log('   Solutions:');
        console.log('   1. Use the Coda MCP server locally (coda-mcp package)');
        console.log('   2. Use Coda tables instead of pages for structured content');
        console.log('   3. Use a webhook to trigger MCP server updates from GitHub Actions');
        console.log('   4. Manually update content via Coda UI');
        console.log('');
        console.log('   For automated updates in CI/CD, consider:');
        console.log('   - Setting up a local server that runs the MCP server');
        console.log('   - Using Coda tables with row-based updates');
        console.log('   - Using a different documentation platform that supports API updates');
        
        throw new Error('Coda API v1 does not support direct page content updates. Use the MCP server, Coda tables, or manual updates.');
        
    } catch (error) {
        console.error('❌ Error updating Coda page:', error.response?.data || error.message);
        
        // Provide helpful error message
        if (error.response?.status === 403) {
            throw new Error('403 Forbidden: API token may lack write permissions for this document');
        } else if (error.response?.status === 404) {
            throw new Error(`404 Not Found: Page ${CODA_PAGE_ID} not found in document ${CODA_DOC_ID}`);
        } else if (error.response?.status === 400) {
            throw new Error(`400 Bad Request: The request format may be incorrect. Response: ${JSON.stringify(error.response?.data)}`);
        }
        
        throw error;
    }
}

/**
 * Find all test files
 */
function findTestFiles(dir) {
    const files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            files.push(...findTestFiles(fullPath));
        } else if (entry.name.endsWith('.spec.js') || entry.name.endsWith('.test.js')) {
            files.push(fullPath);
        }
    }
    
    return files;
}

/**
 * Main function
 */
async function main() {
    console.log('📚 Starting Coda documentation update...');
    
    // Load template
    const template = loadTemplate();
    console.log('✅ Template loaded');
    
    // Get current Coda page content
    console.log('📄 Fetching current Coda page content...');
    let currentPageContent;
    try {
        currentPageContent = await getCodaPageContent();
        console.log('✅ Current page content fetched');
    } catch (error) {
        console.log('⚠️  Could not fetch current page content, will create new');
        currentPageContent = null;
    }
    
    // Find all test files
    const testFiles = findTestFiles(TESTS_DIR);
    console.log(`✅ Found ${testFiles.length} test files`);
    
    // Process each test file
    const stats = {
        new: 0,
        updated: 0,
        unchanged: 0,
        errors: 0
    };
    
    const entries = [];
    const errors = [];
    
    for (const testFile of testFiles) {
        try {
            const testContent = fs.readFileSync(testFile, 'utf-8');
            const fileName = path.basename(testFile);
            
            console.log(`\n📄 Processing: ${fileName}`);
            
            // Call QODO to parse the test file
            const qodoResult = await parseTestWithQodo(testFile, testContent);
            
            // Process each test from QODO result
            if (!qodoResult.tests || qodoResult.tests.length === 0) {
                console.log(`   ⚠️  No tests found in QODO result for ${fileName}`);
                continue;
            }
            
            for (const qodoTest of qodoResult.tests) {
                // Generate entry using QODO data
                const entry = generateTestEntryFromQodo(qodoTest, fileName, path.relative(TESTS_DIR, testFile), template);
                const exists = currentPageContent ? 
                    findTestEntryInCoda(currentPageContent, fileName, qodoTest.testName) : 
                    false;
                
                entries.push({
                    fileName: fileName,
                    testName: qodoTest.testName,
                    entry,
                    exists
                });
                
                if (exists) {
                    stats.updated++;
                } else {
                    stats.new++;
                }
            }
        } catch (error) {
            console.error(`❌ Error processing ${testFile}:`, error.message);
            errors.push({ file: testFile, error: error.message });
            stats.errors++;
        }
    }
    
    // Build final content
    const header = `# 📚 Automated Test Documentation

> **Auto-generated:** ${new Date().toISOString()}  
> **Total Tests:** ${entries.length}  
> **Template Version:** 1.0  
> **Source:** Auto-generated from test files

> **Note:** This documentation is automatically generated daily. Each test entry follows the standardized template format.

---

## 📊 Documentation Statistics

| Metric | Value |
|--------|-------|
| **Total Tests Documented** | ${entries.length} |
| **New Entries** | ${stats.new} |
| **Updated Entries** | ${stats.updated} |
| **Template Version** | 1.0 |
| **Last Generated** | ${new Date().toISOString()} |

---

## 🧪 Test Entries

*All test documentation entries are listed below. Each entry follows the standardized template format with Test Scenario and Test Case sections.*

---

`;
    
    const allEntries = entries.map(e => e.entry).join('\n\n');
    const footer = `\n\n---\n\n**Last Updated:** ${new Date().toLocaleString('en-US', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} UTC (\`${new Date().toISOString()}\`)\n`;
    
    const fullContent = header + allEntries + footer;
    
    // Update Coda page
    console.log('\n📤 Updating Coda page...');
    try {
        await updateCodaPage(fullContent);
        console.log('✅ Coda page updated successfully');
    } catch (error) {
        console.error('❌ Failed to update Coda page:', error.message);
        throw error;
    }
    
    // Output statistics for workflow
    console.log('\n📊 Update Statistics:');
    console.log(`   - New entries: ${stats.new}`);
    console.log(`   - Updated entries: ${stats.updated}`);
    console.log(`   - Total entries: ${entries.length}`);
    console.log(`   - Errors: ${stats.errors}`);
    
    // Output structured stats for workflow parsing
    console.log('\n##CODA_STATS_START##');
    console.log(`NEW_ENTRIES:${stats.new}`);
    console.log(`UPDATED_ENTRIES:${stats.updated}`);
    console.log(`TOTAL_ENTRIES:${entries.length}`);
    console.log(`ERRORS:${stats.errors}`);
    console.log('##CODA_STATS_END##');
    
    return {
        new: stats.new,
        updated: stats.updated,
        total: entries.length,
        errors: stats.errors
    };
}

// Check if this is the main module
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     import.meta.url.endsWith(process.argv[1]) ||
                     process.argv[1] && import.meta.url.includes(process.argv[1].replace(/\\/g, '/'));

if (isMainModule || import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('❌ Error:', error);
        console.error('Stack:', error.stack);
        process.exit(1);
    });
}

export { main };

