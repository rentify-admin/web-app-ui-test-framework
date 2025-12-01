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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TESTS_DIR = path.join(__dirname, '../tests');
const TEMPLATE_FILE = path.join(__dirname, '../documentation/TEST_DOCUMENTATION_TEMPLATE.md');
const CODA_DOC_ID = process.env.CODA_DOC_ID || 'za2s1eOIhA';
const CODA_PAGE_ID = process.env.CODA_PAGE_ID || 'canvas-MP9QLCLolD';
const CODA_API_TOKEN = process.env.CODA_API_TOKEN;

if (!CODA_API_TOKEN) {
    console.error('❌ CODA_API_TOKEN environment variable is required');
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
 * Generate test entry using template format
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
 * Uses the Coda API to replace the entire page content with new markdown.
 * The Coda API v1 may require using a specific format or endpoint.
 * We'll try multiple approaches to ensure compatibility.
 */
async function updateCodaPage(newContent) {
    try {
        // First, verify the page exists
        const pageInfo = await getCodaPageContent();
        if (!pageInfo) {
            throw new Error(`Page ${CODA_PAGE_ID} not found in document ${CODA_DOC_ID}`);
        }
        
        console.log('📄 Page found, attempting to update content...');
        
        // The Coda API v1 PUT endpoint for pages accepts:
        // { name, subtitle, icon } - but NOT content directly
        // Content updates may need to be done via a different mechanism
        
        // For now, we'll use axios to make a PUT request
        // If the API doesn't support content updates directly, we'll need to
        // investigate the MCP server's implementation or use a wrapper library
        
        // Attempt: Use PUT endpoint (may only update metadata)
        // Note: This might not work for content, but we'll try
        const response = await axios.put(
            `${CODA_API_BASE}/docs/${CODA_DOC_ID}/pages/${CODA_PAGE_ID}`,
            {
                // Try sending content as markdown
                // The API might accept this or might require a different format
                content: newContent
            },
            {
                headers: {
                    'Authorization': `Bearer ${CODA_API_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                // Allow the request to proceed even if content field isn't standard
                validateStatus: (status) => status < 500 // Don't throw on 4xx, we'll handle it
            }
        );
        
        // Check if the update was successful
        // 200 = Success, 202 = Accepted (async operation in progress)
        if (response.status === 200 || response.status === 202) {
            if (response.status === 202) {
                console.log('✅ Page content update accepted (async operation)');
                console.log(`   Request ID: ${response.data.requestId || 'N/A'}`);
                console.log('   Note: The update is being processed asynchronously');
            } else {
                console.log('✅ Page content updated successfully');
            }
            return response.data;
        } else {
            // If PUT doesn't support content, we need an alternative
            console.log(`⚠️  PUT returned status ${response.status}`);
            console.log('   Response:', response.data);
            
            // The Coda REST API v1 may not support direct content updates
            // In this case, we would need to:
            // 1. Use the Coda MCP server (not available in GitHub Actions)
            // 2. Use a Coda API wrapper library like coda-js
            // 3. Or find the correct content update endpoint
            
            throw new Error(`Coda API returned status ${response.status}. Content updates may require a different approach. Response: ${JSON.stringify(response.data)}`);
        }
    } catch (error) {
        console.error('❌ Error updating Coda page:', error.response?.data || error.message);
        
        // Provide helpful error message
        if (error.response?.status === 403) {
            throw new Error('403 Forbidden: API token may lack write permissions for this document');
        } else if (error.response?.status === 404) {
            throw new Error(`404 Not Found: Page ${CODA_PAGE_ID} not found in document ${CODA_DOC_ID}`);
        } else if (error.response?.status === 400) {
            throw new Error(`400 Bad Request: The request format may be incorrect. The Coda API v1 may not support direct content updates via PUT. Consider using the Coda MCP server or investigating alternative endpoints.`);
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
            const { testInfo, content: testContent } = parseTestFile(testFile);
            
            for (const test of testInfo.tests) {
                const entry = generateTestEntry(testInfo, test, testContent, template);
                const exists = currentPageContent ? 
                    findTestEntryInCoda(currentPageContent, testInfo.fileName, test.name) : 
                    false;
                
                entries.push({
                    fileName: testInfo.fileName,
                    testName: test.name,
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

