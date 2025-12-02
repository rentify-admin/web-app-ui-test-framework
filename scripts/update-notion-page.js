#!/usr/bin/env node
/**
 * Update Notion Page
 * 
 * Reads the consolidated documentation and updates a Notion page
 * using the Notion API.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@notionhq/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOC_FILE = path.join(__dirname, '../documentation/CONSOLIDATED_DOCUMENTATION.md');
const NOTION_SECRET = process.env.NOTION_SECRET;
const NOTION_PAGE_ID = process.env.NOTION_PAGE_ID;

if (!NOTION_SECRET) {
    console.error('❌ NOTION_SECRET environment variable is required');
    process.exit(1);
}

if (!NOTION_PAGE_ID) {
    console.error('❌ NOTION_PAGE_ID environment variable is required');
    process.exit(1);
}

// Initialize Notion client
const notion = new Client({ auth: NOTION_SECRET });

/**
 * Convert markdown test entry to Notion blocks
 */
function convertTestEntryToBlocks(entryMarkdown) {
    const blocks = [];
    
    // Split into lines
    const lines = entryMarkdown.split('\n').filter(l => l.trim());
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip separators
        if (trimmed === '---') continue;
        
        // Headers (H2, H3, H4)
        if (trimmed.startsWith('## ')) {
            blocks.push({
                object: 'block',
                type: 'heading_2',
                heading_2: {
                    rich_text: [{
                        type: 'text',
                        text: { content: trimmed.substring(3).replace(/`/g, '') }
                    }]
                }
            });
        } else if (trimmed.startsWith('### ')) {
            blocks.push({
                object: 'block',
                type: 'heading_3',
                heading_3: {
                    rich_text: [{
                        type: 'text',
                        text: { content: trimmed.substring(4) }
                    }]
                }
            });
        } else if (trimmed.startsWith('####')) {
            // Notion doesn't have H4, use H3 or paragraph
            blocks.push({
                object: 'block',
                type: 'paragraph',
                paragraph: {
                    rich_text: [{
                        type: 'text',
                        text: { content: trimmed.substring(5) },
                        annotations: { bold: true }
                    }]
                }
            });
        }
        // Table rows (simplified - Notion tables are complex)
        else if (trimmed.startsWith('|') && !trimmed.includes('---')) {
            const cells = trimmed.split('|').map(c => c.trim()).filter(c => c);
            if (cells.length > 0) {
                blocks.push({
                    object: 'block',
                    type: 'paragraph',
                    paragraph: {
                        rich_text: [{
                            type: 'text',
                            text: { content: cells.join(' | ') }
                        }]
                    }
                });
            }
        }
        // List items
        else if (trimmed.startsWith('- ')) {
            blocks.push({
                object: 'block',
                type: 'bulleted_list_item',
                bulleted_list_item: {
                    rich_text: [{
                        type: 'text',
                        text: { content: trimmed.substring(2) }
                    }]
                }
            });
        }
        // Regular text
        else if (trimmed.length > 0 && !trimmed.startsWith('**Last Updated:**')) {
            blocks.push({
                object: 'block',
                type: 'paragraph',
                paragraph: {
                    rich_text: [{
                        type: 'text',
                        text: { content: trimmed }
                    }]
                }
            });
        }
    }
    
    return blocks;
}

/**
 * Update Notion page
 */
async function updateNotionPage(content) {
    try {
        console.log('📤 Updating Notion page...');
        
        // First, archive all existing blocks (clear the page)
        console.log('   🗑️  Clearing existing content...');
        
        const existingPage = await notion.blocks.children.list({
            block_id: NOTION_PAGE_ID,
            page_size: 100
        });
        
        // Archive existing blocks
        for (const block of existingPage.results) {
            try {
                await notion.blocks.delete({ block_id: block.id });
            } catch (e) {
                // Ignore errors when deleting blocks
            }
        }
        
        console.log(`   ✅ Cleared ${existingPage.results.length} existing blocks`);
        
        // Split content into test entries
        const entries = content.split(/(?=## 🧪)/).filter(e => e.trim());
        
        console.log(`   📝 Adding ${entries.length} test entries...`);
        
        // Add entries in batches (Notion limits: 100 blocks per request)
        let totalBlocksAdded = 0;
        
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            
            try {
                const blocks = convertTestEntryToBlocks(entry);
                
                // Notion API limit: max 100 blocks per request
                const MAX_BLOCKS_PER_REQUEST = 100;
                
                for (let j = 0; j < blocks.length; j += MAX_BLOCKS_PER_REQUEST) {
                    const batchBlocks = blocks.slice(j, j + MAX_BLOCKS_PER_REQUEST);
                    
                    await notion.blocks.children.append({
                        block_id: NOTION_PAGE_ID,
                        children: batchBlocks
                    });
                    
                    totalBlocksAdded += batchBlocks.length;
                }
                
                if ((i + 1) % 10 === 0) {
                    console.log(`   📝 Progress: ${i + 1}/${entries.length} entries added`);
                }
                
                // Small delay to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`   ⚠️  Failed to add entry ${i + 1}:`, error.message);
            }
        }
        
        console.log(`\n✅ Notion page updated successfully`);
        console.log(`   Total blocks added: ${totalBlocksAdded}`);
        console.log(`   Total entries: ${entries.length}`);
        
        return true;
        
    } catch (error) {
        console.error(`❌ Notion API error:`, error.message);
        console.error(`   Code:`, error.code);
        
        if (error.status === 401) {
            console.error('   Authentication failed - check NOTION_SECRET');
        } else if (error.status === 404) {
            console.error('   Page not found - check NOTION_PAGE_ID');
        }
        
        throw error;
    }
}

/**
 * Main function
 */
async function main() {
    console.log('📚 Updating Notion documentation...');
    
    // Read consolidated documentation
    if (!fs.existsSync(DOC_FILE)) {
        console.error(`❌ Documentation file not found: ${DOC_FILE}`);
        process.exit(1);
    }
    
    const content = fs.readFileSync(DOC_FILE, 'utf-8');
    console.log(`✅ Loaded documentation (${(content.length / 1024).toFixed(2)} KB)`);
    
    await updateNotionPage(content);
    
    console.log('\n✅ Notion update completed successfully');
}

main().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
});

