#!/usr/bin/env node
/**
 * Update Test Metadata
 * 
 * After successful AI processing, update metadata file with
 * current hashes and timestamps for all processed tests.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const METADATA_FILE = path.join(__dirname, '../../documentation/test-metadata.json');
const PROCESSED_TESTS_FILE = path.join(__dirname, '../../documentation/tests-to-process.txt');

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
 * Update metadata
 */
function updateMetadata() {
    console.log('💾 Updating test metadata...\n');
    
    // Load existing metadata
    let metadata = {};
    if (fs.existsSync(METADATA_FILE)) {
        try {
            metadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
        } catch (error) {
            console.error('⚠️  Failed to load existing metadata:', error.message);
        }
    }
    
    // Load list of processed tests
    if (!fs.existsSync(PROCESSED_TESTS_FILE)) {
        console.log('ℹ️  No processed tests file found - nothing to update');
        return;
    }
    
    const processedTests = fs.readFileSync(PROCESSED_TESTS_FILE, 'utf-8')
        .split('\n')
        .filter(f => f.trim());
    
    console.log(`📝 Updating metadata for ${processedTests.length} test(s)\n`);
    
    let updated = 0;
    let failed = 0;
    
    for (const testFile of processedTests) {
        const fullPath = path.join(__dirname, '../..', testFile);
        
        if (!fs.existsSync(fullPath)) {
            console.log(`   ⚠️  File not found: ${testFile}`);
            failed++;
            continue;
        }
        
        try {
            const hash = getFileHash(fullPath);
            const timestamp = getFileTimestamp(fullPath);
            
            metadata[testFile] = {
                hash: hash,
                timestamp: timestamp,
                lastProcessed: new Date().toISOString()
            };
            
            updated++;
            console.log(`   ✅ ${testFile}`);
        } catch (error) {
            console.log(`   ❌ Failed to process ${testFile}: ${error.message}`);
            failed++;
        }
    }
    
    // Save updated metadata
    fs.mkdirSync(path.dirname(METADATA_FILE), { recursive: true });
    fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 METADATA UPDATE SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Updated:  ${updated}`);
    console.log(`   Failed:   ${failed}`);
    console.log(`   Total in metadata: ${Object.keys(metadata).length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('✅ Metadata updated successfully!\n');
}

// Run
updateMetadata();

