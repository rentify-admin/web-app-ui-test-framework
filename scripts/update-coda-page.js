#!/usr/bin/env node
/**
 * Update Coda Page
 * 
 * Reads the consolidated documentation and updates the Coda page
 * using the contentUpdate API endpoint.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOC_FILE = path.join(__dirname, '../documentation/CONSOLIDATED_DOCUMENTATION.md');
const CODA_DOC_ID = process.env.CODA_DOC_ID || 'dza2s1eOIhA';
const CODA_PAGE_ID = process.env.CODA_PAGE_ID || 'suLCLolD';
const CODA_API_TOKEN = process.env.CODA_API_TOKEN;

if (!CODA_API_TOKEN) {
    console.error('❌ CODA_API_TOKEN environment variable is required');
    process.exit(1);
}

async function main() {
    console.log('📤 Updating Coda page using Coda API...');
    
    // Read consolidated documentation
    if (!fs.existsSync(DOC_FILE)) {
        console.error(`❌ Documentation file not found: ${DOC_FILE}`);
        process.exit(1);
    }
    
    const content = fs.readFileSync(DOC_FILE, 'utf-8');
    const contentSizeKB = (content.length / 1024).toFixed(2);
    const contentSizeChars = content.length;
    
    console.log(`✅ Loaded documentation (${contentSizeKB} KB, ${contentSizeChars} characters)`);
    
    // Coda API limit: 100,000 characters
    const CODA_CHAR_LIMIT = 100000;
    
    if (contentSizeChars > CODA_CHAR_LIMIT) {
        console.log(`⚠️  Content exceeds Coda's ${CODA_CHAR_LIMIT} character limit`);
        console.log(`   Splitting update into multiple parts...`);
        
        // Split content by test entries (## headers)
        const entries = content.split(/(?=## 🧪)/);
        const header = entries[0]; // Everything before first test entry
        const testEntries = entries.slice(1);
        
        console.log(`   Found ${testEntries.length} test entries to process`);
        
        // First, replace page with header
        console.log(`\n📡 Step 1: Replace page with header...`);
        await updateCodaContent(header, 'replace');
        
        // Then append test entries in batches
        const BATCH_SIZE = 5; // Append 5 entries at a time
        for (let i = 0; i < testEntries.length; i += BATCH_SIZE) {
            const batch = testEntries.slice(i, i + BATCH_SIZE);
            const batchContent = batch.join('\n\n');
            
            console.log(`\n📡 Step ${Math.floor(i / BATCH_SIZE) + 2}: Appending entries ${i + 1}-${Math.min(i + BATCH_SIZE, testEntries.length)}...`);
            await updateCodaContent(batchContent, 'append');
            
            // Small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log(`\n✅ All content updated successfully in multiple parts`);
        return true;
        
    } else {
        console.log('📡 Calling Coda API with contentUpdate (single update)...');
        return await updateCodaContent(content, 'replace');
    }
}

/**
 * Update Coda page content
 */
async function updateCodaContent(content, mode = 'replace') {
    try {
        const response = await axios.put(
            `https://coda.io/apis/v1/docs/${CODA_DOC_ID}/pages/${CODA_PAGE_ID}`,
            {
                contentUpdate: {
                    insertionMode: mode, // 'replace' or 'append'
                    canvasContent: {
                        format: 'markdown',
                        content: content
                    }
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${CODA_API_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000,
                validateStatus: (status) => status < 500
            }
        );
        
        if (response.status === 200 || response.status === 202) {
            console.log(`   ✅ Content updated (${mode} mode)`);
            return true;
        } else {
            console.error(`   ❌ Unexpected status: ${response.status}`);
            console.error(`   Response:`, JSON.stringify(response.data, null, 2));
            throw new Error(`Coda API returned status ${response.status}`);
        }
        
    } catch (error) {
        console.error(`   ❌ Coda API error:`, error.response?.data?.message || error.message);
        
        if (error.response?.data) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Message: ${error.response.data.message}`);
        }
        
        throw error;
    }
}

main().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
});

