#!/usr/bin/env node
/**
 * Generate Documentation for a Batch of Tests
 * 
 * Processes a subset of test files and generates documentation entries
 * using regex-based parsing (no AI required).
 * Outputs results as JSON for consolidation.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATE_FILE = path.join(__dirname, '../documentation/TEST_DOCUMENTATION_TEMPLATE.md');
const OUTPUT_DIR = path.join(__dirname, '../documentation');

// Get batch file and batch number from command line
const batchFile = process.argv[2];
const batchNumber = process.argv[3] || '0';

if (!batchFile) {
    console.error('❌ Usage: node generate-batch-documentation.js <batch-file> [batch-number]');
    process.exit(1);
}

/**
 * Parse test file using regex (from generate-test-documentation.js)
 */
function parseTestFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    const testInfo = {
        filePath: path.relative(path.join(__dirname, '../tests'), filePath),
        fileName: path.basename(filePath),
        tests: [],
        imports: [],
        apiEndpoints: [],
        uiTestIds: new Set(),
        describeName: null,
        applicationName: null
    };

    // Extract test.describe name
    const describeMatch = content.match(/test\.describe\(['"`]([^'"`]+)['"`]/);
    if (describeMatch) {
        testInfo.describeName = describeMatch[1];
    }

    // Extract test() calls with tags
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
 * Generate test entry
 */
function generateTestEntry(testInfo, test, testContent) {
    const timestamp = new Date().toISOString();
    const testId = testInfo.describeName || testInfo.fileName.replace('.spec.js', '');
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

    return {
        fileName: testInfo.fileName,
        filePath: testInfo.filePath,
        testName: test.name,
        testId: testId,
        tags: test.tags,
        applicationName: testInfo.applicationName,
        apiEndpoints: testInfo.apiEndpoints,
        uiTestIds: testInfo.uiTestIds,
        imports: testInfo.imports,
        timestamp: timestamp,
        humanReadableTime: humanReadableTime
    };
}

/**
 * Main function
 */
async function main() {
    console.log(`📦 Processing batch ${batchNumber}...`);
    
    // Read batch file
    if (!fs.existsSync(batchFile)) {
        console.error(`❌ Batch file not found: ${batchFile}`);
        process.exit(1);
    }
    
    const testFiles = fs.readFileSync(batchFile, 'utf-8')
        .split('\n')
        .filter(line => line.trim().length > 0);
    
    console.log(`✅ Found ${testFiles.length} test files in batch`);
    
    const entries = [];
    let processedCount = 0;
    
    for (const testFile of testFiles) {
        try {
            const fullPath = path.join(__dirname, '..', testFile);
            
            if (!fs.existsSync(fullPath)) {
                console.log(`   ⚠️  File not found: ${testFile}`);
                continue;
            }
            
            const { testInfo, content: testContent } = parseTestFile(fullPath);
            
            for (const test of testInfo.tests) {
                const entry = generateTestEntry(testInfo, test, testContent);
                entries.push(entry);
            }
            
            processedCount++;
            
        } catch (error) {
            console.error(`❌ Error processing ${testFile}:`, error.message);
        }
    }
    
    // Save batch results as JSON
    const outputFile = path.join(OUTPUT_DIR, `batch-${batchNumber}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(entries, null, 2));
    
    console.log(`\n✅ Batch ${batchNumber} processing complete:`);
    console.log(`   Tests processed: ${processedCount}`);
    console.log(`   Entries generated: ${entries.length}`);
    console.log(`   Output: ${outputFile}`);
    
    return {
        batchNumber,
        testsProcessed: processedCount,
        entriesGenerated: entries.length
    };
}

main().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
});

