#!/usr/bin/env node
/**
 * Detect New or Changed Tests
 * 
 * Compares current test files against stored metadata to determine
 * which tests need to be documented (new or changed since last run).
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const METADATA_FILE = path.join(__dirname, '../../documentation/test-metadata.json');
const OUTPUT_FILE = path.join(__dirname, '../../documentation/tests-to-process.txt');

/**
 * Calculate SHA256 hash of file content
 */
function getFileHash(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Get file modification timestamp
 */
function getFileTimestamp(filePath) {
    const stats = fs.statSync(filePath);
    return stats.mtimeMs;
}

/**
 * Load existing metadata
 */
function loadMetadata() {
    if (!fs.existsSync(METADATA_FILE)) {
        console.log('📝 No metadata file found - first run, all tests will be processed');
        return {};
    }
    
    try {
        const data = fs.readFileSync(METADATA_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('⚠️  Failed to load metadata, treating as first run:', error.message);
        return {};
    }
}

/**
 * Find all test files
 */
function findTestFiles() {
    const output = execSync('find tests -name "*.spec.js" -o -name "*.test.js"', {
        cwd: path.join(__dirname, '../..'),
        encoding: 'utf-8'
    });
    
    return output.split('\n').filter(f => f.trim()).sort();
}

/**
 * Detect changes
 */
function detectChanges() {
    const forceFullRun = process.env.FORCE_FULL_DOC_RUN === 'true';
    
    console.log('🔍 Detecting new or changed tests...\n');
    
    const currentTests = findTestFiles();
    
    // Optional full-run mode: process ALL tests, ignoring metadata
    if (forceFullRun) {
        console.log('🚨 FORCE FULL DOC RUN ENABLED - processing ALL tests from codebase\n');
        
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 FULL RUN SUMMARY');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`   Total tests:      ${currentTests.length}`);
        console.log(`   New tests:        ${currentTests.length}`);
        console.log(`   Changed tests:    0`);
        console.log(`   Unchanged tests:  0`);
        console.log(`   To process:       ${currentTests.length}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        // Save all tests to process
        fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
        fs.writeFileSync(OUTPUT_FILE, currentTests.join('\n'));
        
        console.log(`🚀 Will process ${currentTests.length} test(s) (FULL RUN)\n`);
        return currentTests.length;
    }
    
    // Normal incremental mode (metadata-based)
    const metadata = loadMetadata();
    
    const newTests = [];
    const changedTests = [];
    const unchangedTests = [];
    
    for (const testFile of currentTests) {
        const fullPath = path.join(__dirname, '../..', testFile);
        
        if (!fs.existsSync(fullPath)) {
            console.log(`⚠️  Skipping missing file: ${testFile}`);
            continue;
        }
        
        const currentHash = getFileHash(fullPath);
        const currentTimestamp = getFileTimestamp(fullPath);
        
        if (!metadata[testFile]) {
            // New test
            newTests.push(testFile);
            console.log(`✨ NEW: ${testFile}`);
        } else {
            const stored = metadata[testFile];
            
            if (stored.hash !== currentHash) {
                // Content changed
                changedTests.push(testFile);
                console.log(`📝 CHANGED: ${testFile}`);
            } else {
                // Unchanged
                unchangedTests.push(testFile);
            }
        }
    }
    
    const testsToProcess = [...newTests, ...changedTests];
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 CHANGE DETECTION SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Total tests:      ${currentTests.length}`);
    console.log(`   New tests:        ${newTests.length}`);
    console.log(`   Changed tests:    ${changedTests.length}`);
    console.log(`   Unchanged tests:  ${unchangedTests.length}`);
    console.log(`   To process:       ${testsToProcess.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (testsToProcess.length === 0) {
        console.log('✅ All tests are up to date! No processing needed.\n');
    } else {
        console.log(`🚀 Will process ${testsToProcess.length} test(s)\n`);
    }
    
    // Save list of tests to process
    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, testsToProcess.join('\n'));
    
    // Return count for GitHub Actions output
    return testsToProcess.length;
}

// Run
const count = detectChanges();
console.log(`tests-to-process=${count}`);

