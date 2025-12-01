#!/usr/bin/env node
/**
 * Test Documentation Generator
 * 
 * This script analyzes all test files and generates/updates documentation
 * following the TEST_DOCUMENTATION_TEMPLATE.md format.
 * 
 * Features:
 * - Detects new tests and creates documentation entries
 * - Updates existing tests if they've changed
 * - Handles template changes and updates all documentation backwards
 * - Preserves manual edits where possible
 * 
 * Usage:
 *   node scripts/generate-test-documentation.js [--update-all] [--template-version=X.X]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const TESTS_DIR = path.join(__dirname, '../tests');
const DOCS_DIR = path.join(__dirname, '../documentation');
const TEMPLATE_FILE = path.join(DOCS_DIR, 'TEST_DOCUMENTATION_TEMPLATE.md');
const OUTPUT_FILE = path.join(DOCS_DIR, 'AUTOMATED_TEST_DOCUMENTATION.md');
const METADATA_FILE = path.join(DOCS_DIR, '.test-docs-metadata.json');

// Template version tracking
const CURRENT_TEMPLATE_VERSION = '1.0';

/**
 * Load template and extract structure
 */
function loadTemplate() {
    const templateContent = fs.readFileSync(TEMPLATE_FILE, 'utf-8');
    return {
        version: CURRENT_TEMPLATE_VERSION,
        content: templateContent
    };
}

/**
 * Load metadata for tracking
 */
function loadMetadata() {
    if (fs.existsSync(METADATA_FILE)) {
        return JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
    }
    return {
        templateVersion: null,
        lastRun: null,
        testHashes: {}
    };
}

/**
 * Save metadata for tracking
 */
function saveMetadata(metadata) {
    fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
}

/**
 * Calculate hash of test file content
 */
function calculateHash(content) {
    return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Parse test file and extract information using regex patterns
 */
function parseTestFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    const testInfo = {
        filePath: path.relative(TESTS_DIR, filePath),
        fileName: path.basename(filePath),
        tests: [],
        imports: [],
        constants: {},
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

    // Extract API endpoints (common patterns)
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

    // Convert Set to Array
    testInfo.uiTestIds = Array.from(testInfo.uiTestIds);

    return testInfo;
}

/**
 * Extract helper functions for data extraction
 */
function extractBusinessContext(content) {
    const match = content.match(/(?:Business|Context|Requirement|Purpose)[:\s]+([^\n]+)/i);
    return match ? match[1].trim() : null;
}

function extractUserRole(content) {
    const roleMatch = content.match(/(?:role|Role)[:\s]*['"`]([^'"`]+)['"`]/);
    return roleMatch ? `\`${roleMatch[1]}\`` : null;
}

function extractPrerequisites(content) {
    if (content.includes('beforeAll') || content.includes('beforeEach')) {
        return 'Test setup performed in beforeAll/beforeEach hooks';
    }
    return null;
}

function extractTestDataSetup(content) {
    const setups = [];
    if (content.includes('createSession') || content.includes('generateSession')) {
        setups.push('Session created via API or UI');
    }
    if (content.includes('createUser') || content.includes('createMember')) {
        setups.push('User/member created via API');
    }
    return setups.length > 0 ? setups.join('; ') : null;
}

function extractUsers(content) {
    const userMatches = Array.from(content.matchAll(/(?:email|user)[:\s]*['"`]([^'"`@]+@[^'"`]+)['"`]/g));
    const users = userMatches.map(m => m[1]).filter((v, i, a) => a.indexOf(v) === i);
    return users.length > 0 ? users.join(', ') : null;
}

function extractSessions(content) {
    if (content.includes('session') && (content.includes('rentBudget') || content.includes('rent_budget'))) {
        return 'Session with rent budget configuration';
    }
    return null;
}

function extractMockData(imports) {
    const mockImports = imports.filter(imp => 
        imp.includes('mock') || imp.includes('fixture') || imp.includes('payload')
    );
    return mockImports.length > 0 ? mockImports.join(', ') : null;
}

function extractApiPayloads(content) {
    const payloads = [];
    if (content.includes('PERSONA_PAYLOAD')) payloads.push('PERSONA');
    if (content.includes('VERIDOCS_PAYLOAD')) payloads.push('VERIDOCS');
    if (content.includes('ATOMIC_PAYLOAD')) payloads.push('ATOMIC');
    return payloads.length > 0 ? `Simulation payloads (${payloads.join(', ')})` : null;
}

function extractExpectedOutcomes(content) {
    const expectMatches = Array.from(content.matchAll(/expect\([^)]+\)\.(toBe|toEqual|toContain|toBeVisible|toBeEnabled)\([^)]+\)/g));
    const outcomes = expectMatches.slice(0, 10).map(m => `- ${m[0]}`);
    return outcomes.length > 0 ? outcomes.join('\n') : null;
}

function extractTestSteps(content) {
    // Extract step patterns from comments or code structure
    const stepComments = Array.from(content.matchAll(/(?:Step\s+\d+|#\s*Step\s+\d+)[:\s]+([^\n]+)/gi));
    if (stepComments.length > 0) {
        return stepComments.map((match, idx) => 
            `${idx + 1}. **Step ${idx + 1}**\n   - Action: ${match[1].trim()}\n   - Input: {Extracted from test code}\n   - Expected Result: {Extracted from test code}`
        ).join('\n\n');
    }
    
    // Fallback: basic structure
    return `1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*`;
}

function extractValidationPoints(content) {
    const validationMatches = Array.from(content.matchAll(/expect\([^)]+\)/g));
    const validations = validationMatches.slice(0, 15).map(m => `- ${m[0]}`);
    return validations.length > 0 ? validations.join('\n') : null;
}

function extractCleanup(content) {
    if (content.includes('afterAll') || content.includes('cleanup')) {
        return 'Cleanup performed in afterAll hook or cleanup helper';
    }
    return null;
}

function extractDependencies(imports) {
    const utils = imports.filter(imp => imp.includes('utils') || imp.includes('helper'));
    return utils.length > 0 ? utils.map(i => `- \`${i}\``).join('\n') : null;
}

function extractKnownIssues(content) {
    const issueMatch = content.match(/(?:TODO|FIXME|KNOWN_ISSUE|LIMITATION)[:\s]+([^\n]+)/i);
    return issueMatch ? issueMatch[1].trim() : null;
}

function extractRelatedTests(content) {
    const relatedMatches = Array.from(content.matchAll(/(?:related|similar|see)[:\s]+([a-z_]+\.spec\.js)/gi));
    const related = relatedMatches.map(m => `- \`${m[1]}\``);
    return related.length > 0 ? related.join('\n') : null;
}

/**
 * Generate documentation entry for a test
 */
function generateTestEntry(testInfo, test, template) {
    const timestamp = new Date().toISOString();
    const testId = testInfo.describeName || testInfo.fileName.replace('.spec.js', '');
    
    // Extract more details from test code
    const testContent = fs.readFileSync(path.join(TESTS_DIR, testInfo.filePath), 'utf-8');
    
    // Try to extract purpose from comments
    const purposeMatch = testContent.match(/\/\*\*[\s\S]*?\*\//) || 
                        testContent.match(/\/\/\s*Purpose:([^\n]+)/);
    const purpose = purposeMatch ? 
        (purposeMatch[0].includes('Purpose:') ? 
            testContent.match(/Purpose:([^\n]+)/)?.[1]?.trim() : 
            purposeMatch[0].replace(/\/\*\*|\*\/|\*/g, '').trim()) : 
        'Validates functionality as described in test name';

    return `### \`${testInfo.fileName}\` → \`${test.name}\`

**Test ID:** \`${testId}\`  
**Test File:** \`${testInfo.filePath}\`  
**Last Updated:** \`${timestamp}\`  
**Status:** \`active\`

#### Test Scenario

**Purpose:** ${purpose}

**Business Context:** ${extractBusinessContext(testContent) || '{data not found for this field}'}

**Test Conditions:**
- **Application:** \`${testInfo.applicationName || '{data not found for this field}'}\`
- **User Role:** ${extractUserRole(testContent) || '{data not found for this field}'}
- **Environment:** \`staging|production\`
- **Prerequisites:** ${extractPrerequisites(testContent) || '{data not found for this field}'}
- **Test Data Setup:** ${extractTestDataSetup(testContent) || '{data not found for this field}'}

**Test Data Used:**
- **Users:** ${extractUsers(testContent) || '{data not found for this field}'}
- **Sessions:** ${extractSessions(testContent) || '{data not found for this field}'}
- **Applications:** ${testInfo.applicationName || '{data not found for this field}'}
- **Mock Data:** ${extractMockData(testInfo.imports) || '{data not found for this field}'}
- **API Payloads:** ${extractApiPayloads(testContent) || '{data not found for this field}'}

**Expected Outcomes:**
${extractExpectedOutcomes(testContent) || '- {data not found for this field}'}

#### Test Case

**Test Steps:**

${extractTestSteps(testContent)}

**Validation Points:**
${extractValidationPoints(testContent) || '- {data not found for this field}'}

**Cleanup:**
${extractCleanup(testContent) || '{data not found for this field}'}

**API Endpoints Used:**
${testInfo.apiEndpoints.length > 0 ? 
    testInfo.apiEndpoints.map(ep => `- \`${ep.method} ${ep.url}\` - {Purpose}`).join('\n') : 
    '- {data not found for this field}'}

**UI Test IDs Used:**
${testInfo.uiTestIds.length > 0 ? 
    testInfo.uiTestIds.map(id => `- \`${id}\` - {Purpose}`).join('\n') : 
    '- {data not found for this field}'}

**Tags:** ${test.tags.length > 0 ? test.tags.map(t => `\`${t}\``).join(', ') : '\`{data not found for this field}\`'}

**Dependencies:**
${extractDependencies(testInfo.imports) || '- {data not found for this field}'}

**Known Issues/Limitations:**
${extractKnownIssues(testContent) || '{data not found for this field}'}

**Related Tests:**
${extractRelatedTests(testContent) || '- {data not found for this field}'}

---

**Last Updated:** ${new Date(timestamp).toLocaleString('en-US', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} UTC (\`${timestamp}\`)
---
`;
}

/**
 * Find all test files recursively
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
 * Parse existing documentation to preserve manual edits
 */
function parseExistingDocumentation(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const entries = {};
    
    // Split by test entries (### markers)
    const testBlocks = content.split(/^### /m);
    
    for (const block of testBlocks.slice(1)) {
        const testNameMatch = block.match(/^`([^`]+)` → `([^`]+)`/);
        if (testNameMatch) {
            const key = `${testNameMatch[1]} →`;
            entries[key] = '### ' + block.split(/\n---/)[0];
        }
    }
    
    return entries;
}

/**
 * Main documentation generation function
 */
function generateDocumentation(options = {}) {
    const { updateAll = false, templateVersion = CURRENT_TEMPLATE_VERSION } = options;
    
    console.log('📚 Starting test documentation generation...');
    console.log(`Template Version: ${templateVersion}`);
    
    // Load template and metadata
    const template = loadTemplate();
    const metadata = loadMetadata();
    
    // Check if template has changed
    const templateChanged = metadata.templateVersion !== templateVersion;
    if (templateChanged) {
        console.log('⚠️  Template version changed - will update all documentation');
    }
    
    // Find all test files
    const testFiles = findTestFiles(TESTS_DIR);
    console.log(`Found ${testFiles.length} test files`);
    
    // Load existing documentation if it exists
    let existingDocs = {};
    if (fs.existsSync(OUTPUT_FILE) && !updateAll && !templateChanged) {
        existingDocs = parseExistingDocumentation(OUTPUT_FILE);
    }
    
    // Process each test file
    const newEntries = [];
    const updatedEntries = [];
    const newTestFiles = [];
    
    for (const testFile of testFiles) {
        try {
            const testInfo = parseTestFile(testFile);
            const content = fs.readFileSync(testFile, 'utf-8');
            const hash = calculateHash(content);
            
            // Check if test has changed
            const existingHash = metadata.testHashes[testInfo.filePath];
            const isNewTest = !existingHash;
            const hasChanged = !existingHash || existingHash !== hash || templateChanged;
            
            if (hasChanged || updateAll) {
                if (isNewTest) {
                    console.log(`Processing NEW: ${testInfo.fileName} (${testInfo.tests.length} test(s))`);
                    newTestFiles.push(testInfo.fileName);
                } else {
                    console.log(`Processing UPDATED: ${testInfo.fileName} (${testInfo.tests.length} test(s))`);
                }
                
                // Generate entries for each test in the file
                for (const test of testInfo.tests) {
                    const entry = generateTestEntry(testInfo, test, template);
                    newEntries.push(entry);
                    
                    if (existingHash) {
                        updatedEntries.push(`${testInfo.filePath} → ${test.name}`);
                    }
                }
                
                // Update hash
                metadata.testHashes[testInfo.filePath] = hash;
            } else {
                console.log(`Skipping unchanged: ${testInfo.fileName}`);
                // Preserve existing entry
                for (const test of testInfo.tests) {
                    const existingKey = `${testInfo.fileName} →`;
                    if (existingDocs[existingKey]) {
                        newEntries.push(existingDocs[existingKey]);
                    } else {
                        // Generate new entry if not found in existing docs
                        const entry = generateTestEntry(testInfo, test, template);
                        newEntries.push(entry);
                    }
                }
            }
        } catch (error) {
            console.error(`Error processing ${testFile}:`, error.message);
        }
    }
    
    // Generate final documentation
    const header = `# Automated Test Documentation

**Generated:** ${new Date().toISOString()}  
**Template Version:** ${templateVersion}  
**Total Tests Documented:** ${newEntries.length}

> **Note:** This documentation is auto-generated. To update the format, modify \`TEST_DOCUMENTATION_TEMPLATE.md\` and regenerate.

---

## Test Documentation

`;
    
    const footer = `
---

## Documentation Metadata

- **Last Generated:** ${new Date().toISOString()}
- **Template Version:** ${templateVersion}
- **Tests Processed:** ${testFiles.length}
- **New/Updated Entries:** ${updatedEntries.length}
- **Unchanged Entries:** ${testFiles.length - updatedEntries.length}

## How to Update Documentation

1. Modify \`TEST_DOCUMENTATION_TEMPLATE.md\` if you want to change the format
2. Run: \`node scripts/generate-test-documentation.js --update-all\`
3. Review generated documentation and commit changes
`;

    const documentation = header + newEntries.join('\n\n') + footer;
    
    // Write documentation
    fs.writeFileSync(OUTPUT_FILE, documentation, 'utf-8');
    
    // Update metadata
    metadata.templateVersion = templateVersion;
    metadata.lastRun = new Date().toISOString();
    saveMetadata(metadata);
    
    const newTestsCount = newTestFiles.length;
    const updatedTestsCount = updatedEntries.length;
    
    console.log(`\n✅ Documentation generated: ${OUTPUT_FILE}`);
    console.log(`   - New test files: ${newTestsCount}`);
    console.log(`   - Updated test entries: ${updatedTestsCount}`);
    console.log(`   - Total entries: ${newEntries.length}`);
    console.log(`   - Tests processed: ${testFiles.length}`);
    
    // Output structured statistics for CI/CD parsing
    console.log(`\n##DOC_STATS_START##`);
    console.log(`NEW_TESTS:${newTestsCount}`);
    console.log(`UPDATED_TESTS:${updatedTestsCount}`);
    console.log(`NEW_UPDATED:${updatedEntries.length}`);
    console.log(`TOTAL_ENTRIES:${newEntries.length}`);
    console.log(`TESTS_PROCESSED:${testFiles.length}`);
    console.log(`##DOC_STATS_END##`);
}

// CLI handling
const args = process.argv.slice(2);
const options = {
    updateAll: args.includes('--update-all'),
    templateVersion: args.find(arg => arg.startsWith('--template-version='))?.split('=')[1] || CURRENT_TEMPLATE_VERSION
};

try {
    generateDocumentation(options);
} catch (error) {
    console.error('❌ Error generating documentation:', error);
    process.exit(1);
}
