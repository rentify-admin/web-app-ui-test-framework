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
    console.log('📤 Updating Coda page...');
    
    // Read consolidated documentation
    if (!fs.existsSync(DOC_FILE)) {
        console.error(`❌ Documentation file not found: ${DOC_FILE}`);
        process.exit(1);
    }
    
    const content = fs.readFileSync(DOC_FILE, 'utf-8');
    console.log(`✅ Loaded documentation (${(content.length / 1024).toFixed(2)} KB)`);
    
    // Update Coda page using contentUpdate API
    try {
        const response = await axios.put(
            `https://coda.io/apis/v1/docs/${CODA_DOC_ID}/pages/${CODA_PAGE_ID}`,
            {
                contentUpdate: {
                    insertionMode: 'replace',
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
                timeout: 60000
            }
        );
        
        console.log(`✅ Coda page updated successfully`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Doc ID: ${CODA_DOC_ID}`);
        console.log(`   Page ID: ${CODA_PAGE_ID}`);
        
        return true;
        
    } catch (error) {
        console.error(`❌ Coda API error:`, error.response?.data || error.message);
        
        if (error.response?.status === 400) {
            console.error('   The contentUpdate endpoint may not be available or the format is incorrect');
            console.error('   Response:', JSON.stringify(error.response.data, null, 2));
        }
        
        throw error;
    }
}

main().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
});

