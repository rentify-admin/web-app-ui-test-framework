#!/usr/bin/env node
/**
 * Extract Individual Test Cases
 * 
 * Parses test files to extract individual test cases (taggedTest, test, it blocks)
 * instead of treating entire files as single units.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_FILE = path.join(__dirname, '../../documentation/test-cases.json');

/**
 * Extract test cases from a file
 */
function extractTestCases(filePath, fileContent) {
    const testCases = [];
    
    // Pattern for taggedTest (API tests)
    const taggedTestPattern = /taggedTest\(\s*['"`]([^'"`]+)['"`]\s*,\s*(\{[^}]*\}|\[[^\]]*\])/g;
    
    // Pattern for test() (UI tests)  
    const testPattern = /test\(\s*['"`]([^'"`]+)['"`]\s*,\s*(\{[^}]*\})?/g;
    
    // Pattern for test.describe
    const describePattern = /test\.describe\(\s*['"`]([^'"`]+)['"`]/g;
    
    // Extract describe blocks for context
    const describes = [];
    let match;
    while ((match = describePattern.exec(fileContent)) !== null) {
        describes.push(match[1]);
    }
    
    // Extract taggedTest calls
    let index = 0;
    while ((match = taggedTestPattern.exec(fileContent)) !== null) {
        const testName = match[1];
        const tagsMatch = match[2];
        
        // Extract tags from the tags object/array
        const tags = [];
        const tagPattern = /['"`]([^'"`]+)['"`]/g;
        let tagMatch;
        while ((tagMatch = tagPattern.exec(tagsMatch)) !== null) {
            tags.push(tagMatch[1]);
        }
        
        testCases.push({
            id: `${path.basename(filePath)}-${index}`,
            name: testName,
            file: filePath,
            type: 'taggedTest',
            tags: tags,
            suite: describes[0] || path.basename(filePath, '.test.js'),
            lineNumber: fileContent.substring(0, match.index).split('\n').length
        });
        
        index++;
    }
    
    // Extract test() calls
    while ((match = testPattern.exec(fileContent)) !== null) {
        const testName = match[1];
        const tagsMatch = match[2] || '';
        
        // Extract tags
        const tags = [];
        const tagPattern = /['"`]([^'"`]+)['"`]/g;
        let tagMatch;
        while ((tagMatch = tagPattern.exec(tagsMatch)) !== null) {
            tags.push(tagMatch[1]);
        }
        
        testCases.push({
            id: `${path.basename(filePath)}-${index}`,
            name: testName,
            file: filePath,
            type: 'test',
            tags: tags,
            suite: describes[0] || path.basename(filePath, '.spec.js'),
            lineNumber: fileContent.substring(0, match.index).split('\n').length
        });
        
        index++;
    }
    
    return testCases;
}

/**
 * Calculate hash for a test case
 */
function hashTestCase(testCase) {
    const data = JSON.stringify({
        name: testCase.name,
        file: testCase.file,
        tags: testCase.tags
    });
    return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Main
 */
function main() {
    console.log('🔍 Extracting individual test cases...\n');
    
    // Find all test files
    const output = execSync('find tests -name "*.spec.js" -o -name "*.test.js"', {
        cwd: path.join(__dirname, '../..'),
        encoding: 'utf-8'
    });
    
    const testFiles = output.split('\n').filter(f => f.trim()).sort();
    
    console.log(`📁 Found ${testFiles.length} test files\n`);
    
    const allTestCases = [];
    
    for (const testFile of testFiles) {
        const fullPath = path.join(__dirname, '../..', testFile);
        
        if (!fs.existsSync(fullPath)) continue;
        
        const content = fs.readFileSync(fullPath, 'utf-8');
        const testCases = extractTestCases(testFile, content);
        
        if (testCases.length > 0) {
            console.log(`📄 ${testFile}: ${testCases.length} test case(s)`);
            
            // Add hash to each test case
            testCases.forEach(tc => {
                tc.hash = hashTestCase(tc);
                allTestCases.push(tc);
            });
        }
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 EXTRACTION SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Test files:       ${testFiles.length}`);
    console.log(`   Test cases:       ${allTestCases.length}`);
    console.log(`   taggedTest:       ${allTestCases.filter(t => t.type === 'taggedTest').length}`);
    console.log(`   test():           ${allTestCases.filter(t => t.type === 'test').length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Save test cases
    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allTestCases, null, 2));
    
    console.log(`✅ Saved ${allTestCases.length} test cases to test-cases.json\n`);
    console.log(`test-cases-count=${allTestCases.length}`);
}

main();

