#!/usr/bin/env node
/**
 * AI-Powered Batch Test Documentation Generator
 * 
 * Uses multiple AI API keys with smart balancing to analyze tests
 * and generate natural language documentation.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AI_PROMPT_FILE = path.join(__dirname, 'ai-test-analyzer-prompt.md');
const OUTPUT_DIR = path.join(__dirname, '../documentation');

// Get batch file and batch number from command line
const batchFile = process.argv[2];
const batchNumber = process.argv[3] || '0';

if (!batchFile) {
    console.error('❌ Usage: node ai-batch-processor.js <batch-file> [batch-number]');
    process.exit(1);
}

// Collect all available API keys
const API_KEYS = [
    process.env.AI_API_KEY,
    process.env.AI_API_KEY_2,
    process.env.AI_API_KEY_3,
    process.env.AI_API_KEY_4,
    process.env.AI_API_KEY_5,
    process.env.AI_API_KEY_6,
    process.env.AI_API_KEY_7,
].filter(key => key && key.length > 0);

if (API_KEYS.length === 0) {
    console.error('❌ No AI API keys found in environment');
    console.error('   Please set at least one of: AI_API_KEY, AI_API_KEY_2, ..., AI_API_KEY_7');
    process.exit(1);
}

console.log(`🔑 Found ${API_KEYS.length} API key(s) for load balancing`);

// Create OpenAI clients for each API key
const openaiClients = API_KEYS.map(key => new OpenAI({ apiKey: key }));

// Track API usage for balancing
let currentKeyIndex = parseInt(batchNumber) % API_KEYS.length; // Start with different key per batch
let apiCallCounts = new Array(API_KEYS.length).fill(0);

/**
 * Get next OpenAI client with round-robin balancing
 */
function getNextClient() {
    const client = openaiClients[currentKeyIndex];
    const keyNumber = currentKeyIndex + 1;
    apiCallCounts[currentKeyIndex]++;
    
    // Move to next key for next call
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
    
    return { client, keyNumber };
}

/**
 * Analyze test file with AI
 */
async function analyzeTestWithAI(testFilePath, retryCount = 0) {
    try {
        const fileName = path.basename(testFilePath);
        const testContent = fs.readFileSync(testFilePath, 'utf-8');
        const promptTemplate = fs.readFileSync(AI_PROMPT_FILE, 'utf-8');
        
        const fullPrompt = `${promptTemplate}

## Test File to Analyze

\`\`\`javascript
${testContent}
\`\`\`

Analyze this test file and return the JSON structure as specified above.`;
        
        const { client, keyNumber } = getNextClient();
        
        console.log(`   🤖 Analyzing with AI (Key #${keyNumber})...`);
        
        try {
            const response = await client.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert test documentation analyst. Analyze test files and return structured JSON. Return ONLY valid JSON, no markdown formatting.'
                    },
                    {
                        role: 'user',
                        content: fullPrompt
                    }
                ],
                temperature: 0.2,
                response_format: { type: 'json_object' }
            });
            
            const content = response.choices[0].message.content;
            const result = JSON.parse(content);
            
            console.log(`   ✅ AI analysis completed (${response.usage?.total_tokens || 'N/A'} tokens)`);
            
            return result;
            
        } catch (apiError) {
            // Handle rate limits with retry
            if (apiError.status === 429 && retryCount < API_KEYS.length * 2) {
                const waitTime = 2; // Wait 2 seconds
                console.log(`   ⏳ Rate limit hit (Key #${keyNumber}), waiting ${waitTime}s...`);
                await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
                return analyzeTestWithAI(testFilePath, retryCount + 1);
            }
            
            console.log(`   ⚠️  AI API failed (Key #${keyNumber}):`, apiError.message?.substring(0, 100));
            return null;
        }
        
    } catch (error) {
        console.error(`   ❌ Error analyzing ${path.basename(testFilePath)}:`, error.message);
        return null;
    }
}

/**
 * Generate markdown entry from AI analysis
 */
function generateMarkdownEntry(aiResult, fileName, filePath) {
    if (!aiResult) return null;
    
    const timestamp = new Date().toISOString();
    const humanReadableTime = new Date(timestamp).toLocaleString('en-US', { 
        timeZone: 'UTC', 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: false 
    });
    
    // Format steps and verifications
    const stepsTable = aiResult.stepsAndVerifications && aiResult.stepsAndVerifications.length > 0
        ? aiResult.stepsAndVerifications.map(s => 
            `| **${s.step}** | ${s.action || 'N/A'} | ${s.verification || 'N/A'} |`
        ).join('\n')
        : '| N/A | N/A | N/A |';
    
    // Format data used
    const dataUsed = aiResult.dataUsed || {};
    const formatDataList = (list) => list && list.length > 0 ? list.join(', ') : 'N/A';
    
    // Format functionalities
    const functionalities = aiResult.functionalitiesCovered && aiResult.functionalitiesCovered.length > 0
        ? aiResult.functionalitiesCovered.map(f => `- ${f}`).join('\n')
        : '- N/A';
    
    // Format tags
    const tags = aiResult.tags && aiResult.tags.length > 0
        ? aiResult.tags.join(' ')
        : 'N/A';
    
    return `## 🧪 \`${fileName}\` → \`${aiResult.testTitle || 'N/A'}\`

**Summary:** ${aiResult.summary || 'N/A'}

**Tags:** ${tags}

### Functionalities Covered

${functionalities}

### Test Data Used

| Data Type | Details |
|-----------|---------|
| **Users** | ${formatDataList(dataUsed.users)} |
| **Applications** | ${formatDataList(dataUsed.applications)} |
| **Sessions** | ${formatDataList(dataUsed.sessions)} |
| **API Payloads** | ${formatDataList(dataUsed.apiPayloads)} |
| **Other Data** | ${formatDataList(dataUsed.otherData)} |

### Steps & Verifications

| Step | Action | Verification |
|------|--------|--------------|
${stepsTable}

---

**Last Updated:** ${humanReadableTime} UTC

---
`;
}

/**
 * Main function
 */
async function main() {
    console.log(`📦 Processing batch ${batchNumber} with AI analysis...`);
    
    // Read batch file
    if (!fs.existsSync(batchFile)) {
        console.error(`❌ Batch file not found: ${batchFile}`);
        process.exit(1);
    }
    
    const testFiles = fs.readFileSync(batchFile, 'utf-8')
        .split('\n')
        .filter(line => line.trim().length > 0);
    
    console.log(`✅ Found ${testFiles.length} test files in batch`);
    console.log(`🔑 Using ${API_KEYS.length} API keys with smart balancing`);
    
    const entries = [];
    let processedCount = 0;
    let aiSuccessCount = 0;
    
    for (const testFile of testFiles) {
        try {
            const fullPath = path.join(__dirname, '..', testFile);
            const fileName = path.basename(testFile);
            
            if (!fs.existsSync(fullPath)) {
                console.log(`   ⚠️  File not found: ${testFile}`);
                continue;
            }
            
            console.log(`\n📄 ${fileName}`);
            
            // Analyze with AI
            const aiResult = await analyzeTestWithAI(fullPath);
            
            if (aiResult) {
                const markdown = generateMarkdownEntry(aiResult, fileName, path.relative(path.join(__dirname, '../tests'), fullPath));
                if (markdown) {
                    entries.push({
                        fileName,
                        markdown,
                        aiResult
                    });
                    aiSuccessCount++;
                }
            }
            
            processedCount++;
            
            // Small delay to avoid overwhelming APIs
            await new Promise(resolve => setTimeout(resolve, 100));
            
        } catch (error) {
            console.error(`❌ Error processing ${testFile}:`, error.message);
        }
    }
    
    // Save batch results
    const outputFile = path.join(OUTPUT_DIR, `batch-${batchNumber}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(entries, null, 2));
    
    console.log(`\n✅ Batch ${batchNumber} processing complete:`);
    console.log(`   Tests processed: ${processedCount}`);
    console.log(`   AI analyses successful: ${aiSuccessCount}`);
    console.log(`   Entries generated: ${entries.length}`);
    console.log(`\n📊 API key usage distribution:`);
    apiCallCounts.forEach((count, idx) => {
        console.log(`   Key #${idx + 1}: ${count} calls`);
    });
    
    return {
        batchNumber,
        testsProcessed: processedCount,
        entriesGenerated: entries.length,
        aiSuccessCount
    };
}

main().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
});

