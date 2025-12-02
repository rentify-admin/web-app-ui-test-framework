#!/usr/bin/env node
/**
 * Consolidate AI-Generated Documentation
 * 
 * Reads all AI-generated batch JSON files and consolidates them
 * into a single markdown documentation file.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BATCHES_DIR = path.join(__dirname, '../documentation/batches');
const OUTPUT_FILE = path.join(__dirname, '../documentation/AI_GENERATED_DOCUMENTATION.md');

/**
 * Main function
 */
async function main() {
    console.log('📚 Consolidating AI-generated documentation...');
    
    if (!fs.existsSync(BATCHES_DIR)) {
        console.error(`❌ Batches directory not found: ${BATCHES_DIR}`);
        process.exit(1);
    }
    
    // Find all batch JSON files
    const batchFiles = fs.readdirSync(BATCHES_DIR)
        .filter(f => f.startsWith('batch-') && f.endsWith('.json'))
        .sort();
    
    console.log(`✅ Found ${batchFiles.length} batch files`);
    
    const allEntries = [];
    let batchesProcessed = 0;
    let totalTests = 0;
    
    for (const batchFile of batchFiles) {
        try {
            const fullPath = path.join(BATCHES_DIR, batchFile);
            const batchData = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
            
            console.log(`   📦 ${batchFile}: ${batchData.length} entries`);
            
            // Extract markdown from each entry
            for (const entry of batchData) {
                if (entry.markdown) {
                    allEntries.push(entry.markdown);
                    totalTests++;
                }
            }
            
            batchesProcessed++;
            
        } catch (error) {
            console.error(`❌ Error processing ${batchFile}:`, error.message);
        }
    }
    
    console.log(`\n✅ Consolidated ${totalTests} test entries from ${batchesProcessed} batches`);
    
    // Generate final documentation
    const header = `# 📚 Test Documentation

> **Auto-generated with AI Analysis**  
> **Generated:** ${new Date().toISOString()}  
> **Total Tests:** ${totalTests}

This documentation was automatically generated using AI to analyze test files and extract structured information in natural language.

---

## 📊 Statistics

| Metric | Value |
|--------|-------|
| **Total Tests** | ${totalTests} |
| **Batches Processed** | ${batchesProcessed} |
| **Last Updated** | ${new Date().toISOString()} |

---

`;
    
    const footer = `\n\n---\n\n**Documentation Generated:** ${new Date().toLocaleString('en-US', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} UTC\n`;
    
    const fullContent = header + allEntries.join('\n\n') + footer;
    
    // Save consolidated documentation
    fs.writeFileSync(OUTPUT_FILE, fullContent, 'utf-8');
    
    console.log(`\n✅ Documentation saved to: ${OUTPUT_FILE}`);
    console.log(`   Size: ${(fullContent.length / 1024).toFixed(2)} KB`);
    console.log(`   Characters: ${fullContent.length}`);
    
    // Output statistics
    console.log('\n##CONSOLIDATE_STATS_START##');
    console.log(`TOTAL_ENTRIES:${totalTests}`);
    console.log(`BATCHES_PROCESSED:${batchesProcessed}`);
    console.log('##CONSOLIDATE_STATS_END##');
    
    return {
        totalEntries: totalTests,
        batchesProcessed
    };
}

main().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
});

