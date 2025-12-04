#!/usr/bin/env node
/**
 * Update Notion Page
 * 
 * Reads the consolidated documentation and updates a Notion page
 * with proper formatting, tables, and rich text.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@notionhq/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOC_FILE = path.join(__dirname, '../../documentation/CONSOLIDATED_DOCUMENTATION.md');
const NOTION_SECRET = process.env.NOTION_SECRET;
const NOTION_PAGE_ID = process.env.NOTION_PAGE_ID || '2bdd92a99cff809e98ddcec14e6b7bdc';

if (!NOTION_SECRET) {
    console.error('❌ NOTION_SECRET environment variable is required');
    process.exit(1);
}

if (!NOTION_PAGE_ID) {
    console.error('❌ NOTION_PAGE_ID environment variable is required');
    process.exit(1);
}

const notion = new Client({ auth: NOTION_SECRET });

/**
 * Parse markdown bold/italic/code into Notion rich text
 */
function parseRichText(text) {
    const richTextArray = [];
    
    // Handle code blocks first (backticks)
    const codePattern = /`([^`]+)`/g;
    let lastIndex = 0;
    let match;
    
    while ((match = codePattern.exec(text)) !== null) {
        // Add text before code
        if (match.index > lastIndex) {
            const beforeText = text.substring(lastIndex, match.index);
            richTextArray.push(...parseBoldItalic(beforeText));
        }
        
        // Add code
        richTextArray.push({
            type: 'text',
            text: { content: match[1] },
            annotations: { code: true }
        });
        
        lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
        richTextArray.push(...parseBoldItalic(text.substring(lastIndex)));
    }
    
    return richTextArray.length > 0 ? richTextArray : [{ type: 'text', text: { content: text } }];
}

/**
 * Parse bold and italic
 */
function parseBoldItalic(text) {
    const result = [];
    
    // Simple bold parsing (**text**)
    const boldPattern = /\*\*([^*]+)\*\*/g;
    let lastIndex = 0;
    let match;
    
    while ((match = boldPattern.exec(text)) !== null) {
        if (match.index > lastIndex) {
            result.push({
                type: 'text',
                text: { content: text.substring(lastIndex, match.index) }
            });
        }
        
        result.push({
            type: 'text',
            text: { content: match[1] },
            annotations: { bold: true }
        });
        
        lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < text.length) {
        result.push({
            type: 'text',
            text: { content: text.substring(lastIndex) }
        });
    }
    
    return result.length > 0 ? result : [{ type: 'text', text: { content: text } }];
}

/**
 * Convert a markdown table to Notion table
 */
function createNotionTable(tableRows) {
    if (tableRows.length < 2) return null; // Need at least header + 1 row
    
    // Parse header
    const headerCells = tableRows[0].split('|').map(c => c.trim()).filter(c => c);
    const numCols = headerCells.length;
    
    if (numCols === 0) return null;
    
    // Skip separator line (tableRows[1] with dashes)
    const dataRows = tableRows.slice(2);
    
    // Create table block
    const tableBlock = {
        object: 'block',
        type: 'table',
        table: {
            table_width: numCols,
            has_column_header: true,
            has_row_header: false,
            children: []
        }
    };
    
    // Add header row
    tableBlock.table.children.push({
        object: 'block',
        type: 'table_row',
        table_row: {
            cells: headerCells.map(cell => parseRichText(cell))
        }
    });
    
    // Add data rows
    for (const row of dataRows) {
        if (!row.trim()) continue;
        
        const cells = row.split('|').map(c => c.trim()).filter(c => c);
        
        // Pad with empty cells if needed
        while (cells.length < numCols) {
            cells.push('');
        }
        
        tableBlock.table.children.push({
            object: 'block',
            type: 'table_row',
            table_row: {
                cells: cells.slice(0, numCols).map(cell => parseRichText(cell || ' '))
            }
        });
    }
    
    return tableBlock;
}

/**
 * Convert markdown test entry to Notion blocks
 */
function convertTestEntryToBlocks(entryMarkdown) {
    const blocks = [];
    const lines = entryMarkdown.split('\n');
    
    let i = 0;
    let inTable = false;
    let tableLines = [];
    
    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();
        
        // Skip empty lines and separators
        if (!trimmed || trimmed === '---') {
            i++;
            continue;
        }
        
        // Detect table start
        if (trimmed.startsWith('|') && !inTable) {
            inTable = true;
            tableLines = [trimmed];
            i++;
            continue;
        }
        
        // Continue collecting table lines
        if (inTable && trimmed.startsWith('|')) {
            tableLines.push(trimmed);
            i++;
            continue;
        }
        
        // End of table
        if (inTable && !trimmed.startsWith('|')) {
            const tableBlock = createNotionTable(tableLines);
            if (tableBlock) {
                blocks.push(tableBlock);
            }
            inTable = false;
            tableLines = [];
            // Don't increment i - process this line as normal content
        }
        
        // H2: Test name
        if (trimmed.startsWith('## 🧪')) {
            const content = trimmed.substring(2).trim();
            blocks.push({
                object: 'block',
                type: 'heading_2',
                heading_2: {
                    rich_text: parseRichText(content),
                    is_toggleable: true
                }
            });
        }
        // H3: Section headers
        else if (trimmed.startsWith('### ')) {
            const content = trimmed.substring(4).trim();
            blocks.push({
                object: 'block',
                type: 'heading_3',
                heading_3: {
                    rich_text: parseRichText(content)
                }
            });
        }
        // Bulleted list
        else if (trimmed.startsWith('- ')) {
            const content = trimmed.substring(2).trim();
            blocks.push({
                object: 'block',
                type: 'bulleted_list_item',
                bulleted_list_item: {
                    rich_text: parseRichText(content)
                }
            });
        }
        // Regular paragraph
        else if (trimmed.length > 0 && !trimmed.startsWith('**Last Updated:**')) {
            blocks.push({
                object: 'block',
                type: 'paragraph',
                paragraph: {
                    rich_text: parseRichText(trimmed)
                }
            });
        }
        
        i++;
    }
    
    // Handle any remaining table
    if (inTable && tableLines.length > 0) {
        const tableBlock = createNotionTable(tableLines);
        if (tableBlock) {
            blocks.push(tableBlock);
        }
    }
    
    return blocks;
}

/**
 * Clear existing page content
 */
async function clearNotionPage() {
    console.log('   🗑️  Clearing existing content...');
    
    let hasMore = true;
    let cursor = undefined;
    let deletedCount = 0;
    
    while (hasMore) {
        const response = await notion.blocks.children.list({
            block_id: NOTION_PAGE_ID,
            start_cursor: cursor,
            page_size: 100
        });
        
        for (const block of response.results) {
            try {
                await notion.blocks.delete({ block_id: block.id });
                deletedCount++;
            } catch (e) {
                // Ignore errors
            }
        }
        
        hasMore = response.has_more;
        cursor = response.next_cursor;
    }
    
    console.log(`   ✅ Cleared ${deletedCount} existing blocks`);
}

/**
 * Update Notion page (INCREMENTAL - does NOT clear existing content)
 */
async function updateNotionPage(content, headerBlocks = []) {
    try {
        console.log('📤 Updating Notion page (incremental)...');
        
        // DO NOT clear page - this preserves existing content
        // Only append new or changed entries
        
        console.log('   ℹ️  Skipping page clear (incremental update)');
        
        // Split into test entries
        const entries = content.split(/(?=## 🧪)/).filter(e => e.trim());
        
        console.log(`   📝 Processing ${entries.length} test entries...`);
        
        let totalBlocksAdded = 0;
        let processedEntries = 0;
        
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            
            try {
                const blocks = convertTestEntryToBlocks(entry);
                
                if (blocks.length === 0) continue;
                
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
                
                processedEntries++;
                
                if ((i + 1) % 5 === 0) {
                    console.log(`   📝 Progress: ${i + 1}/${entries.length} entries`);
                }
                
                // Small delay to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 150));
                
            } catch (error) {
                console.error(`   ⚠️  Entry ${i + 1} failed:`, error.message);
            }
        }
        
        console.log(`\n✅ Notion page updated`);
        console.log(`   Entries: ${processedEntries}/${entries.length}`);
        console.log(`   Blocks: ${totalBlocksAdded}`);
        
        return true;
        
    } catch (error) {
        console.error(`❌ Notion error:`, error.message);
        
        if (error.status === 401) {
            console.error('   → Check NOTION_SECRET');
        } else if (error.status === 404) {
            console.error('   → Check NOTION_PAGE_ID');
        }
        
        throw error;
    }
}

/**
 * Create header blocks for Notion page
 */
function createHeaderBlocks(content) {
    // Extract metadata from content
    const generatedMatch = content.match(/\*\*Generated:\*\*\s+([^\n]+)/);
    const totalTestsMatch = content.match(/\*\*Total Tests:\*\*\s+(\d+)/);
    const generatedByMatch = content.match(/\*\*Generated by:\*\*\s+([^\n]+)/);
    
    const generated = generatedMatch ? generatedMatch[1].trim() : new Date().toISOString().split('T')[0];
    const totalTests = totalTestsMatch ? totalTestsMatch[1].trim() : '0';
    const generatedBy = generatedByMatch ? generatedByMatch[1].trim() : 'Automated Workflow';
    
    return [
        {
            object: 'block',
            type: 'heading_1',
            heading_1: {
                rich_text: [{ type: 'text', text: { content: 'UI Test Documentation' } }],
                color: 'default'
            }
        },
        {
            object: 'block',
            type: 'heading_2',
            heading_2: {
                rich_text: [
                    { type: 'text', text: { content: '📚 ' }, annotations: {} },
                    { type: 'text', text: { content: 'Test Documentation' }, annotations: {} }
                ],
                color: 'default'
            }
        },
        {
            object: 'block',
            type: 'quote',
            quote: {
                rich_text: [
                    { type: 'text', text: { content: 'Generated: ' }, annotations: { bold: true } },
                    { type: 'text', text: { content: generated }, annotations: {} }
                ],
                color: 'default'
            }
        },
        {
            object: 'block',
            type: 'quote',
            quote: {
                rich_text: [
                    { type: 'text', text: { content: 'Total Tests: ' }, annotations: { bold: true } },
                    { type: 'text', text: { content: totalTests }, annotations: {} }
                ],
                color: 'default'
            }
        },
        {
            object: 'block',
            type: 'quote',
            quote: {
                rich_text: [
                    { type: 'text', text: { content: 'Generated by: ' }, annotations: { bold: true } },
                    { type: 'text', text: { content: generatedBy }, annotations: {} }
                ],
                color: 'default'
            }
        },
        {
            object: 'block',
            type: 'divider',
            divider: {}
        }
    ];
}

/**
 * Main
 */
async function main() {
    console.log('📚 Notion Documentation Update\n');
    
    if (!fs.existsSync(DOC_FILE)) {
        console.error(`❌ File not found: ${DOC_FILE}`);
        console.log('⚠️  No documentation generated yet - skipping Notion update');
        process.exit(0); // Exit gracefully
    }
    
    const content = fs.readFileSync(DOC_FILE, 'utf-8');
    
    if (!content || content.trim().length === 0) {
        console.log('⚠️  Documentation file is empty - skipping Notion update');
        process.exit(0); // Exit gracefully
    }
    
    console.log(`✅ Loaded ${(content.length / 1024).toFixed(2)} KB\n`);
    
    // Update Notion page (clears first, then adds header + content)
    await updateNotionPage(content, createHeaderBlocks(content));
    
    console.log('\n✅ Complete');
}

main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});

