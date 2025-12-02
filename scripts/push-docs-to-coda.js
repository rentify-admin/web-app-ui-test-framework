#!/usr/bin/env node
/**
 * Push Test Documentation to Coda
 * 
 * Reads the generated AUTOMATED_TEST_DOCUMENTATION.md and pushes all test entries to Coda
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCS_FILE = path.join(__dirname, '../documentation/AUTOMATED_TEST_DOCUMENTATION.md');
const CODA_DOC_ID = 'za2s1eOIhA';
const CODA_PAGE_ID = 'canvas-MP9QLCLolD';

/**
 * Parse test entries from markdown file
 */
function parseTestEntries(content) {
    const entries = [];
    
    // Split by test entry markers - handle both with and without emoji
    const testPattern = /^### (?:🧪 )?`([^`]+)` → `([^`]+)`/m;
    const testBlocks = content.split(testPattern);
    
    // Skip first element (header content before first test)
    for (let i = 1; i < testBlocks.length; i += 3) {
        if (i + 2 < testBlocks.length) {
            const fileName = testBlocks[i];
            const testName = testBlocks[i + 1];
            let entryContent = testBlocks[i + 2];
            
            // Extract entry until next test or end of document
            const nextTestMatch = entryContent.match(/\n### (?:🧪 )?`/);
            if (nextTestMatch) {
                entryContent = entryContent.substring(0, nextTestMatch.index);
            }
            
            // Remove trailing separators
            entryContent = entryContent.replace(/\n---\n*$/, '').trim();
            
            entries.push({
                fileName,
                testName,
                content: `### 🧪 \`${fileName}\` → \`${testName}\`\n\n${entryContent}`
            });
        }
    }
    
    return entries;
}

/**
 * Get current Coda page content
 */
async function getCodaPageContent() {
    try {
        // This would use the Coda MCP, but for now we'll read what we know exists
        // In a real implementation, we'd use the MCP server
        return null;
    } catch (error) {
        console.error('Error getting Coda content:', error);
        return null;
    }
}

/**
 * Main function
 */
async function main() {
    console.log('📚 Reading generated documentation...');
    
    if (!fs.existsSync(DOCS_FILE)) {
        console.error(`❌ Documentation file not found: ${DOCS_FILE}`);
        console.error('   Run: npm run docs:generate');
        process.exit(1);
    }
    
    const content = fs.readFileSync(DOCS_FILE, 'utf-8');
    const entries = parseTestEntries(content);
    
    console.log(`✅ Found ${entries.length} test entries`);
    
    // For now, we'll create a script that can be run manually or integrated
    // Since we can't directly call MCP from Node.js script, we'll output instructions
    console.log('\n📋 To push all entries to Coda:');
    console.log(`   1. Use Coda MCP to append content to page: ${CODA_PAGE_ID}`);
    console.log(`   2. Total entries to add: ${entries.length}`);
    console.log(`   3. Each entry is formatted according to the template`);
    
    // Generate a combined content string
    const header = `# 📚 Automated Test Documentation

> **Auto-generated:** ${new Date().toISOString()}  
> **Total Tests:** ${entries.length}  
> **Source:** Generated from \`AUTOMATED_TEST_DOCUMENTATION.md\`

---

`;
    
    const allEntries = entries.map(e => e.content).join('\n\n---\n\n');
    const footer = `\n\n---\n\n**Last Updated:** ${new Date().toLocaleString('en-US', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} UTC (\`${new Date().toISOString()}\`)\n`;
    
    const fullContent = header + allEntries + footer;
    
    // Save to a file that can be used to update Coda
    const outputFile = path.join(__dirname, '../documentation/CODA_CONTENT.md');
    fs.writeFileSync(outputFile, fullContent, 'utf-8');
    
    console.log(`\n✅ Generated Coda content file: ${outputFile}`);
    console.log(`   Size: ${(fullContent.length / 1024).toFixed(2)} KB`);
    console.log(`   Entries: ${entries.length}`);
    
    return {
        entries: entries.length,
        content: fullContent,
        outputFile
    };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('❌ Error:', error);
        process.exit(1);
    });
}

export { main, parseTestEntries };

