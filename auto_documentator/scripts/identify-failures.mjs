#!/usr/bin/env node
/**
 * Identify Failed Tests and Working Providers
 * 
 * Analyzes batch results to find:
 * 1. Which tests failed
 * 2. Which providers are working (have successes)
 * 3. Prepares retry strategy
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BATCHES_DIR = path.join(__dirname, '../../documentation');
const OUTPUT_FILE = path.join(__dirname, '../../documentation/failed-tests.txt');
const STATS_FILE = path.join(__dirname, '../../documentation/batch-stats.json');
const TESTS_TO_PROCESS_FILE = path.join(__dirname, '../../documentation/tests-to-process.txt');

/**
 * Get all test files (returns both basename and full path for mapping)
 */
function getAllTests() {
    const output = execSync('find tests -name "*.spec.js" -o -name "*.test.js"', {
        cwd: path.join(__dirname, '../..'),
        encoding: 'utf-8'
    });
    
    const allFiles = output.split('\n').filter(f => f.trim());
    
    // Return Map: basename -> full relative path
    const testMap = new Map();
    for (const file of allFiles) {
        const basename = path.basename(file);
        testMap.set(basename, file);
    }
    
    return testMap;
}

/**
 * Main
 */
function main() {
    console.log('🔍 Analyzing batch results...\n');
    
    // Find all batch result files
    const batchFiles = fs.readdirSync(BATCHES_DIR)
        .filter(f => f.startsWith('batch-') && f.endsWith('.json'))
        .sort();
    
    if (batchFiles.length === 0) {
        console.log('⚠️  No batch files found');
        process.exit(0);
    }
    
    const documentedTests = new Set();
    const batchStats = [];
    
    // Analyze each batch
    for (const file of batchFiles) {
        const batchNum = file.match(/batch-(\d+)\.json/)[1];
        const data = JSON.parse(fs.readFileSync(path.join(BATCHES_DIR, file), 'utf-8'));
        const entries = data.entries || [];
        
        const successCount = entries.length;
        const hasSuccess = successCount > 0;
        
        // Track documented tests
        entries.forEach(e => {
            if (e.fileName) documentedTests.add(e.fileName);
        });
        
        batchStats.push({
            batch: parseInt(batchNum),
            successes: successCount,
            isWorking: hasSuccess
        });
        
        console.log(`📦 Batch ${batchNum}: ${successCount} successes ${hasSuccess ? '✅' : '❌'}`);
    }
    
    // Determine which tests to check for failures
    // If tests-to-process.txt exists, we're in change-detection mode - only check those tests
    // Otherwise, check all tests (full run mode)
    let testsToCheck;
    let testCheckMode;
    
    if (fs.existsSync(TESTS_TO_PROCESS_FILE)) {
        // Change detection mode: only check tests that were supposed to be processed
        const testsToProcess = fs.readFileSync(TESTS_TO_PROCESS_FILE, 'utf-8')
            .split('\n')
            .filter(f => f.trim());
        testsToCheck = testsToProcess;
        testCheckMode = 'change-detection';
        console.log(`📋 Change detection mode: Checking only ${testsToCheck.length} test(s) that were scheduled for processing\n`);
    } else {
        // Full run mode: check all tests
        const allTestsMap = getAllTests();
        testsToCheck = Array.from(allTestsMap.values()); // Use full paths
        testCheckMode = 'full-run';
        console.log(`📂 Full run mode: Checking all tests in repository\n`);
    }
    
    // Get all tests map for basename -> path lookup
    const allTestsMap = getAllTests();
    
    // Find failed tests (tests that were supposed to be processed but aren't documented)
    // Convert testsToCheck to basenames for comparison with documentedTests Set
    const testsToCheckBasenames = testsToCheck.map(fullPath => path.basename(fullPath));
    const failedTestsBasenames = testsToCheckBasenames.filter(basename => !documentedTests.has(basename));
    
    // Map back to full paths (preserve original paths from tests-to-process.txt if available)
    const failedTests = failedTestsBasenames.map(basename => {
        // Try to find in testsToCheck first (preserves original path structure)
        const fromCheck = testsToCheck.find(t => path.basename(t) === basename);
        if (fromCheck) return fromCheck;
        // Fallback to allTestsMap lookup
        return allTestsMap.get(basename) || basename;
    });
    
    const totalTestsToCheck = testsToCheck.length;
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 ANALYSIS SUMMARY');
    console.log(`   Mode:             ${testCheckMode}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Tests checked:    ${totalTestsToCheck}`);
    console.log(`   Documented:       ${documentedTests.size}`);
    console.log(`   Failed:           ${failedTests.length}`);
    console.log(`   Success rate:     ${totalTestsToCheck > 0 ? ((documentedTests.size / totalTestsToCheck) * 100).toFixed(1) : 0}%`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Identify working batches
    const workingBatches = batchStats.filter(b => b.isWorking).map(b => b.batch);
    
    if (workingBatches.length > 0) {
        console.log('✅ Working batches (providers):');
        workingBatches.forEach(b => console.log(`   Batch ${b}`));
        console.log('');
    }
    
    if (failedTests.length > 0) {
        console.log('❌ Failed tests to retry:');
        failedTests.forEach(t => console.log(`   ${t}`));
        console.log('');
        
        // Save failed tests with their full relative paths (already include 'tests/' prefix)
        fs.writeFileSync(OUTPUT_FILE, failedTests.join('\n'));
        console.log(`💾 Saved ${failedTests.length} failed tests for retry\n`);
    }
    
    // Save stats
    fs.writeFileSync(STATS_FILE, JSON.stringify({
        mode: testCheckMode,
        totalTests: totalTestsToCheck,
        documented: documentedTests.size,
        failed: failedTests.length,
        workingBatches: workingBatches,
        needsRetry: failedTests.length > 0
    }, null, 2));
    
    console.log(`failed-count=${failedTests.length}`);
    console.log(`working-batches=${workingBatches.join(',')}`);
}

main();

