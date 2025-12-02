#!/usr/bin/env node
/**
 * Merge Documentation - Smart Update Strategy
 * 
 * Merges new AI-generated documentation with existing documentation:
 * - Keeps unchanged test entries
 * - Adds new test entries
 * - Updates modified test entries
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXISTING_DOC_FILE = path.join(__dirname, '../../documentation/EXISTING_DOCUMENTATION.md');
const NEW_BATCHES_DIR = path.join(__dirname, '../../documentation/batches');
const TESTS_TO_PROCESS_FILE = path.join(__dirname, '../../documentation/tests-to-process.txt');
const OUTPUT_FILE = path.join(__dirname, '../../documentation/CONSOLIDATED_DOCUMENTATION.md');

/**
 * Extract test entries from markdown
 */
function extractTestEntries(markdown) {
    const entries = new Map();
    
    // Split by H2 headers (## 🧪)
    const sections = markdown.split(/(?=## 🧪)/);
    
    for (const section of sections) {
        if (!section.trim() || !section.includes('## 🧪')) continue;
        
        // Extract test file name from the entry
        // Format: ## 🧪 `filename.spec.js` → `Test Name`
        const match = section.match(/## 🧪 `([^`]+)`/);
        if (match) {
            const testFile = match[1];
            entries.set(testFile, section.trim());
        }
    }
    
    return entries;
}

/**
 * Get list of tests that were processed in this run
 */
function getProcessedTests() {
    if (!fs.existsSync(TESTS_TO_PROCESS_FILE)) {
        return new Set();
    }
    
    const content = fs.readFileSync(TESTS_TO_PROCESS_FILE, 'utf-8');
    const tests = content.split('\n')
        .filter(t => t.trim())
        .map(t => path.basename(t)); // Get just the filename
    
    return new Set(tests);
}

/**
 * Load new entries from batch files
 */
function loadNewEntries() {
    const entries = new Map();
    
    if (!fs.existsSync(NEW_BATCHES_DIR)) {
        return entries;
    }
    
    const batchFiles = fs.readdirSync(NEW_BATCHES_DIR)
        .filter(f => f.startsWith('batch-') && f.endsWith('.json'))
        .sort();
    
    for (const file of batchFiles) {
        const data = JSON.parse(fs.readFileSync(path.join(NEW_BATCHES_DIR, file), 'utf-8'));
        const batchEntries = data.entries || data;
        
        for (const entry of batchEntries) {
            if (entry.fileName && entry.markdown) {
                entries.set(entry.fileName, entry.markdown.trim());
            }
        }
    }
    
    return entries;
}

/**
 * Main merge logic
 */
async function main() {
    console.log('🔄 Merging documentation (smart update)...\n');
    
    // Load existing documentation
    let existingEntries = new Map();
    if (fs.existsSync(EXISTING_DOC_FILE)) {
        const existingContent = fs.readFileSync(EXISTING_DOC_FILE, 'utf-8');
        existingEntries = extractTestEntries(existingContent);
        console.log(`✅ Loaded ${existingEntries.size} existing entries`);
    } else {
        console.log('📝 No existing documentation found (first run)');
    }
    
    // Load new entries from this run
    const newEntries = loadNewEntries();
    console.log(`✅ Loaded ${newEntries.size} new/updated entries from AI analysis`);
    
    // Get list of tests that were processed
    const processedTests = getProcessedTests();
    console.log(`📋 Tests processed in this run: ${processedTests.size}`);
    
    // Merge strategy
    const finalEntries = new Map();
    let added = 0;
    let updated = 0;
    let kept = 0;
    
    // 1. Keep all existing entries that weren't processed (unchanged tests)
    for (const [testFile, markdown] of existingEntries.entries()) {
        if (!processedTests.has(testFile)) {
            finalEntries.set(testFile, markdown);
            kept++;
        }
    }
    
    // 2. Add/update entries from new AI analysis
    for (const [testFile, markdown] of newEntries.entries()) {
        if (existingEntries.has(testFile)) {
            updated++;
        } else {
            added++;
        }
        finalEntries.set(testFile, markdown);
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 MERGE SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Kept (unchanged):  ${kept}`);
    console.log(`   Updated:           ${updated}`);
    console.log(`   Added (new):       ${added}`);
    console.log(`   Total entries:     ${finalEntries.size}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Generate header
    const generatedBy = process.env.GIT_USER_NAME || process.env.GITHUB_ACTOR || 'Automated Workflow';
    const currentDate = new Date().toISOString().split('T')[0];
    
    const header = `# UI Test Documentation

## 📚 Test Documentation

> **Generated:** ${currentDate}  
> **Total Tests:** ${finalEntries.size}  
> **Generated by:** ${generatedBy}

---

`;
    
    // Sort entries by test file name for consistency
    const sortedEntries = Array.from(finalEntries.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([_, markdown]) => markdown);
    
    const footer = `\n\n---\n\n_Last Updated: ${new Date().toLocaleString('en-US', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} UTC_\n`;
    
    // Write consolidated documentation
    const finalContent = header + sortedEntries.join('\n\n') + footer;
    fs.writeFileSync(OUTPUT_FILE, finalContent);
    
    console.log(`✅ Merged documentation written to ${path.basename(OUTPUT_FILE)}\n`);
    
    // Save as "existing" for next run
    fs.writeFileSync(EXISTING_DOC_FILE, finalContent);
    console.log(`💾 Saved as existing documentation for next run\n`);
    
    console.log(`##MERGE_STATS_START##`);
    console.log(`TOTAL_ENTRIES:${finalEntries.size}`);
    console.log(`ADDED:${added}`);
    console.log(`UPDATED:${updated}`);
    console.log(`KEPT:${kept}`);
    console.log(`##MERGE_STATS_END##`);
}

main().catch(e => {
    console.error('❌', e);
    process.exit(1);
});

