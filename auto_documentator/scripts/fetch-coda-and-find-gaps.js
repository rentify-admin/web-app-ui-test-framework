#!/usr/bin/env node
/**
 * Fetch Coda Content and Find Documentation Gaps
 * 
 * Downloads current Coda page, extracts documented tests,
 * and identifies which tests need to be documented.
 * 
 * This makes Coda the single source of truth.
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CODA_DOC_ID = process.env.CODA_DOC_ID || 'dza2s1eOIhA';
const CODA_PAGE_ID = process.env.CODA_PAGE_ID || 'suLCLolD';
const CODA_API_TOKEN = process.env.CODA_API_TOKEN;

const OUTPUT_FILE = path.join(__dirname, '../../documentation/tests-to-process.txt');
const CODA_BACKUP_FILE = path.join(__dirname, '../../documentation/CODA_CURRENT.md');

/**
 * Fetch current Coda page content
 */
async function fetchCodaContent() {
    if (!CODA_API_TOKEN) {
        console.log('⚠️  No CODA_API_TOKEN - skipping Coda fetch');
        return null;
    }
    
    try {
        console.log('📥 Fetching current Coda page content...');
        
        const response = await axios.get(
            `https://coda.io/apis/v1/docs/${CODA_DOC_ID}/pages/${CODA_PAGE_ID}/content`,
            {
                headers: {
                    'Authorization': `Bearer ${CODA_API_TOKEN}`
                }
            }
        );
        
        const content = response.data.content || '';
        console.log(`✅ Downloaded ${(content.length / 1024).toFixed(2)} KB from Coda\n`);
        
        // Save backup
        fs.mkdirSync(path.dirname(CODA_BACKUP_FILE), { recursive: true });
        fs.writeFileSync(CODA_BACKUP_FILE, content);
        
        return content;
        
    } catch (error) {
        console.error('❌ Failed to fetch Coda:', error.message);
        return null;
    }
}

/**
 * Extract documented test filenames from markdown
 */
function extractDocumentedTests(markdown) {
    if (!markdown) return new Set();
    
    const testFiles = new Set();
    
    // Match: ## 🧪 `filename.spec.js` → `Test Name`
    const pattern = /## 🧪 `([^`]+)`/g;
    let match;
    
    while ((match = pattern.exec(markdown)) !== null) {
        testFiles.add(match[1]);
    }
    
    return testFiles;
}

/**
 * Find all test files in the repository
 */
function findAllTests() {
    const output = execSync('find tests -name "*.spec.js" -o -name "*.test.js"', {
        cwd: path.join(__dirname, '../..'),
        encoding: 'utf-8'
    });
    
    return output.split('\n').filter(f => f.trim()).sort();
}

/**
 * Main
 */
async function main() {
    console.log('🔍 Finding documentation gaps...\n');
    
    // Fetch current Coda content
    const codaContent = await fetchCodaContent();
    const documentedTests = extractDocumentedTests(codaContent);
    
    console.log(`📊 Currently documented in Coda: ${documentedTests.size} tests\n`);
    
    if (documentedTests.size > 0) {
        console.log('Documented tests:');
        for (const test of Array.from(documentedTests).sort()) {
            console.log(`   ✅ ${test}`);
        }
        console.log('');
    }
    
    // Find all tests
    const allTests = findAllTests();
    console.log(`📂 Total tests in repository: ${allTests.length}\n`);
    
    // Find missing tests
    const missingTests = [];
    
    for (const testPath of allTests) {
        const testFileName = path.basename(testPath);
        
        if (!documentedTests.has(testFileName)) {
            missingTests.push(testPath);
        }
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 GAP ANALYSIS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Total tests:     ${allTests.length}`);
    console.log(`   Documented:      ${documentedTests.size}`);
    console.log(`   Missing:         ${missingTests.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (missingTests.length > 0) {
        console.log('Missing tests to process:');
        for (const test of missingTests) {
            console.log(`   📝 ${path.basename(test)}`);
        }
        console.log('');
    }
    
    // Save list of tests to process
    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, missingTests.join('\n'));
    
    console.log(`✅ Saved ${missingTests.length} tests to process\n`);
    console.log(`tests-to-process=${missingTests.length}`);
}

main().catch(e => {
    console.error('❌', e);
    process.exit(1);
});

