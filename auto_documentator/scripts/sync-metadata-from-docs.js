#!/usr/bin/env node
/**
 * Sync Metadata from Existing Documentation
 * 
 * Downloads existing documentation and creates metadata for already-documented tests.
 * This prevents re-processing tests that are already in Coda/Notion.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXISTING_DOC_FILE = path.join(__dirname, '../../documentation/EXISTING_DOCUMENTATION.md');
const METADATA_FILE = path.join(__dirname, '../../documentation/test-metadata.json');

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
 * Extract test file names from existing documentation
 */
function extractDocumentedTests(markdown) {
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
 * Main sync logic
 */
function main() {
    console.log('🔄 Syncing metadata from existing documentation...\n');
    
    // Check if existing documentation exists
    if (!fs.existsSync(EXISTING_DOC_FILE)) {
        console.log('📝 No existing documentation found - nothing to sync');
        process.exit(0);
    }
    
    // Load existing documentation
    const docContent = fs.readFileSync(EXISTING_DOC_FILE, 'utf-8');
    const documentedTests = extractDocumentedTests(docContent);
    
    console.log(`✅ Found ${documentedTests.size} documented tests in existing docs\n`);
    
    // Load existing metadata (if any)
    let metadata = {};
    if (fs.existsSync(METADATA_FILE)) {
        try {
            metadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
            console.log(`📋 Loaded ${Object.keys(metadata).length} existing metadata entries\n`);
        } catch (error) {
            console.log('⚠️  Failed to load metadata, starting fresh\n');
        }
    }
    
    // Update metadata for documented tests
    let added = 0;
    let skipped = 0;
    
    for (const testFileName of documentedTests) {
        // Find the full path to the test file
        const testPath = `tests/${testFileName}`;
        const fullPath = path.join(__dirname, '../..', testPath);
        
        if (!fs.existsSync(fullPath)) {
            console.log(`   ⚠️  Test file not found: ${testFileName}`);
            skipped++;
            continue;
        }
        
        // Skip if already in metadata
        if (metadata[testPath]) {
            console.log(`   ⏭️  Already in metadata: ${testFileName}`);
            skipped++;
            continue;
        }
        
        // Add to metadata
        const hash = getFileHash(fullPath);
        const timestamp = getFileTimestamp(fullPath);
        
        metadata[testPath] = {
            hash: hash,
            timestamp: timestamp,
            lastProcessed: new Date().toISOString(),
            source: 'synced-from-docs'
        };
        
        console.log(`   ✅ Added to metadata: ${testFileName}`);
        added++;
    }
    
    // Save updated metadata
    fs.mkdirSync(path.dirname(METADATA_FILE), { recursive: true });
    fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SYNC SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Tests in docs:     ${documentedTests.size}`);
    console.log(`   Added to metadata: ${added}`);
    console.log(`   Already tracked:   ${skipped}`);
    console.log(`   Total in metadata: ${Object.keys(metadata).length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (added > 0) {
        console.log('✅ Metadata synced! Future runs will skip these tests.\n');
    } else {
        console.log('ℹ️  No new tests to sync.\n');
    }
}

main();

