#!/usr/bin/env node
/**
 * AI-Powered Test Analyzer - Dedicated Provider Mode
 * 
 * Each batch uses ONE dedicated AI provider to avoid conflicts.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AI_PROMPT_FILE = path.join(__dirname, '../prompts/test-analyzer-prompt.md');
const OUTPUT_DIR = path.join(__dirname, '../../documentation');

const batchFile = process.argv[2];
const batchNumber = parseInt(process.argv[3]) || 0;

if (!batchFile) {
    console.error('❌ Usage: node ai-analyzer.js <batch-file> <batch-number>');
    process.exit(1);
}

// AI Providers - Each batch gets ONE dedicated provider
const AI_PROVIDERS = [
    { name: 'OpenAI-Key1', apiKey: process.env.AI_API_KEY, type: 'openai', model: 'gpt-4o-mini' },
    { name: 'OpenAI-Key2', apiKey: process.env.AI_API_KEY_6, type: 'openai', model: 'gpt-4o-mini' },
    { name: 'OpenAI-Key3', apiKey: process.env.AI_API_KEY_7, type: 'openai', model: 'gpt-4o-mini' },
    { name: 'OR-Llama-70B', apiKey: process.env.AI_API_KEY_5, type: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free' },
    { name: 'OR-Llama-3B', apiKey: process.env.AI_API_KEY_5, type: 'openrouter', model: 'meta-llama/llama-3.2-3b-instruct:free' },
    { name: 'OR-Gemma-27B', apiKey: process.env.AI_API_KEY_5, type: 'openrouter', model: 'google/gemma-3-27b-it:free' },
    { name: 'OR-Gemma-12B', apiKey: process.env.AI_API_KEY_5, type: 'openrouter', model: 'google/gemma-3-12b-it:free' },
    { name: 'OR-Mistral-24B', apiKey: process.env.AI_API_KEY_5, type: 'openrouter', model: 'mistralai/mistral-small-3.1-24b-instruct:free' },
    { name: 'OR-Qwen-Coder', apiKey: process.env.AI_API_KEY_5, type: 'openrouter', model: 'qwen/qwen3-coder:free' },
    { name: 'OR-Trinity', apiKey: process.env.AI_API_KEY_2, type: 'openrouter', model: 'arcee-ai/trinity-mini:free' }
].filter(p => p.apiKey && p.apiKey.length > 10);

// Dedicated provider for this batch
const DEDICATED_PROVIDER = AI_PROVIDERS[batchNumber % AI_PROVIDERS.length];

if (!DEDICATED_PROVIDER) {
    console.error(`❌ No provider available for batch ${batchNumber}`);
    process.exit(1);
}

console.log(`🎯 Batch ${batchNumber} - Dedicated Provider: ${DEDICATED_PROVIDER.name}`);

/**
 * Call AI provider with timeout
 */
async function callAI(provider, systemPrompt, userPrompt) {
    const TIMEOUT_MS = 45000;
    
    const apiCall = async () => {
        if (provider.type === 'openai') {
            const client = new OpenAI({ apiKey: provider.apiKey, timeout: TIMEOUT_MS });
            const response = await client.chat.completions.create({
                model: provider.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.1,
                response_format: { type: 'json_object' }
            });
            return JSON.parse(response.choices[0].message.content);
        } else if (provider.type === 'openrouter') {
            const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                model: provider.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.1
            }, {
                timeout: TIMEOUT_MS,
                headers: {
                    'Authorization': `Bearer ${provider.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const content = response.data.choices[0].message.content;
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            return JSON.parse(jsonMatch ? jsonMatch[0] : content);
        }
        
        throw new Error(`Unsupported provider type: ${provider.type}`);
    };
    
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), TIMEOUT_MS)
    );
    
    return Promise.race([apiCall(), timeoutPromise]);
}

/**
 * Analyze single test
 */
async function analyzeTest(testFilePath) {
    const fileName = path.basename(testFilePath);
    const testContent = fs.readFileSync(testFilePath, 'utf-8');
    const promptTemplate = fs.readFileSync(AI_PROMPT_FILE, 'utf-8');
    
    const systemPrompt = "You are an expert test documentation analyst. Return ONLY valid JSON.";
    const userPrompt = `${promptTemplate}\n\n## Test File to Analyze\n\n\`\`\`javascript\n${testContent}\n\`\`\``;
    
    console.log(`\n📄 ${fileName}`);
    
    const MAX_RETRIES = 3;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`   🤖 Attempt ${attempt}/${MAX_RETRIES} with ${DEDICATED_PROVIDER.name}...`);
            
            const result = await callAI(DEDICATED_PROVIDER, systemPrompt, userPrompt);
            
            // Score quality
            let score = 0;
            if (result.summary && result.summary.length > 50) score += 20;
            if (result.functionalitiesCovered?.length > 0) score += 15;
            if (result.stepsAndVerifications?.length > 0) score += 25;
            if (result.dataUsed?.users?.length > 0) score += 10;
            if (result.dataUsed?.applications?.length > 0) score += 10;
            if (result.dataUsed?.otherData?.length > 0) score += 10;
            if (result.tags?.length > 0) score += 10;
            
            console.log(`   ✅ Success (Score: ${score}/100)`);
            return result;
            
        } catch (error) {
            const errorMsg = error.message?.substring(0, 80) || error.toString().substring(0, 80);
            console.log(`   ❌ Attempt ${attempt} failed: ${errorMsg}`);
            
            if (attempt < MAX_RETRIES) {
                const waitTime = attempt * 5; // 5s, 10s, 15s
                console.log(`   ⏳ Waiting ${waitTime}s before retry...`);
                await new Promise(r => setTimeout(r, waitTime * 1000));
            }
        }
    }
    
    console.log(`   ❌ All ${MAX_RETRIES} attempts failed`);
    return null;
}

/**
 * Generate markdown
 */
function generateMarkdown(aiResult, fileName) {
    if (!aiResult) return null;
    
    const formatArray = (arr) => arr && arr.length > 0 ? arr.map(item => `- ${item}`).join('\n') : '- {data not found}';
    const formatInline = (arr) => arr && arr.length > 0 ? arr.map(t => `\`${t}\``).join(' ') : '{data not found}';
    
    const stepsTable = aiResult.stepsAndVerifications?.map(s => 
        `| **${s.step}** | ${s.action || '{data not found}'} | ${s.verification || '{data not found}'} |`
    ).join('\n') || '| {data not found} | {data not found} | {data not found} |';
    
    return `
## 🧪 \`${fileName}\` → \`${aiResult.testTitle || '{data not found}'}\`

**Summary:** ${aiResult.summary || '{data not found}'}

**Tags:** ${formatInline(aiResult.tags)}

**Functionalities Covered:**
${formatArray(aiResult.functionalitiesCovered)}

**Test Data Used:**

| Data Type | Details |
|-----------|---------|
| **Users** | ${aiResult.dataUsed?.users?.join(', ') || '{data not found}'} |
| **Applications** | ${aiResult.dataUsed?.applications?.join(', ') || '{data not found}'} |
| **Sessions** | ${aiResult.dataUsed?.sessions?.join(', ') || '{data not found}'} |
| **API Payloads** | ${aiResult.dataUsed?.apiPayloads?.join(', ') || '{data not found}'} |
| **Other Data** | ${aiResult.dataUsed?.otherData?.join(', ') || '{data not found}'} |

**Steps & Verifications:**

| Step | Action | Verification |
|------|--------|--------------|
${stepsTable}

---
`;
}

/**
 * Main
 */
async function main() {
    const testFiles = fs.readFileSync(batchFile, 'utf-8').split('\n').filter(f => f.trim());
    
    console.log(`\n📦 Processing ${testFiles.length} tests sequentially`);
    console.log(`🔒 Using dedicated provider only (no fallback)`);
    console.log('');
    
    const results = [];
    
    for (const testFile of testFiles) {
        if (!testFile.trim()) continue;
        
        const aiResult = await analyzeTest(testFile);
        
        if (aiResult) {
            results.push({
                fileName: path.basename(testFile),
                filePath: testFile,
                aiResult: aiResult,
                markdown: generateMarkdown(aiResult, path.basename(testFile))
            });
        }
        
        // Small delay between tests to avoid rate limits
        await new Promise(r => setTimeout(r, 1000));
    }
    
    // Save JSON
    const jsonFile = path.join(OUTPUT_DIR, `batch-${batchNumber}.json`);
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(jsonFile, JSON.stringify({
        entries: results
    }, null, 2));
    
    console.log(`\n✅ Batch ${batchNumber} complete:`);
    console.log(`   Tests processed: ${testFiles.length}`);
    console.log(`   AI analyses successful: ${results.length}\n`);
}

main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
