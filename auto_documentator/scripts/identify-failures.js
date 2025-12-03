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

/**
 * Get all test files
 */
function getAllTests() {
    const output = execSync('find tests -name "*.spec.js" -o -name "*.test.js"', {
        cwd: path.join(__dirname, '../..'),
        encoding: 'utf-8'
    });
    
    return output.split('\n').filter(f => f.trim()).map(f => path.basename(f));
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
    
    // Find all tests
    const allTests = getAllTests();
    
    // Find failed tests
    const failedTests = allTests.filter(test => !documentedTests.has(test));
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 ANALYSIS SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Total tests:      ${allTests.length}`);
    console.log(`   Documented:       ${documentedTests.size}`);
    console.log(`   Failed:           ${failedTests.length}`);
    console.log(`   Success rate:     ${((documentedTests.size / allTests.length) * 100).toFixed(1)}%`);
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
        
        // Save failed tests
        fs.writeFileSync(OUTPUT_FILE, failedTests.map(t => `tests/${t}`).join('\n'));
        console.log(`💾 Saved ${failedTests.length} failed tests for retry\n`);
    }
    
    // Save stats
    fs.writeFileSync(STATS_FILE, JSON.stringify({
        totalTests: allTests.length,
        documented: documentedTests.size,
        failed: failedTests.length,
        workingBatches: workingBatches,
        needsRetry: failedTests.length > 0
    }, null, 2));
    
    console.log(`failed-count=${failedTests.length}`);
    console.log(`working-batches=${workingBatches.join(',')}`);
}

main();

