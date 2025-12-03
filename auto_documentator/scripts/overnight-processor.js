#!/usr/bin/env node
/**
 * Overnight Test Processor
 * 
 * Processes ALL tests with 20-second delays between each.
 * One provider per batch for reliability.
 * Designed to run overnight.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import axios from 'axios';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AI_PROMPT_FILE = path.join(__dirname, '../prompts/test-analyzer-prompt.md');
const OUTPUT_DIR = path.join(__dirname, '../../documentation');

const batchNumber = parseInt(process.argv[2]) || 0;

// One provider per batch
const PROVIDERS = [
    { name: 'OpenAI-1', apiKey: process.env.AI_API_KEY, type: 'openai', model: 'gpt-4o-mini' },
    { name: 'OpenAI-2', apiKey: process.env.AI_API_KEY_6, type: 'openai', model: 'gpt-4o-mini' },
    { name: 'OpenAI-3', apiKey: process.env.AI_API_KEY_7, type: 'openai', model: 'gpt-4o-mini' },
    { name: 'OR-Llama-70B', apiKey: process.env.AI_API_KEY_5, type: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free' },
    { name: 'OR-Mistral', apiKey: process.env.AI_API_KEY_5, type: 'openrouter', model: 'mistralai/mistral-small-3.1-24b-instruct:free' },
    { name: 'OR-Gemma-27B', apiKey: process.env.AI_API_KEY_5, type: 'openrouter', model: 'google/gemma-3-27b-it:free' },
    { name: 'OR-Qwen', apiKey: process.env.AI_API_KEY_5, type: 'openrouter', model: 'qwen/qwen3-coder:free' }
].filter(p => p.apiKey && p.apiKey.length > 10);

const PROVIDER = PROVIDERS[batchNumber % PROVIDERS.length];

console.log(`\n🌙 OVERNIGHT PROCESSOR - Batch ${batchNumber}`);
console.log(`🤖 Provider: ${PROVIDER.name}`);
console.log(`⏱️  20 second delay between tests\n`);

/**
 * Call AI
 */
async function callAI(systemPrompt, userPrompt) {
    const TIMEOUT_MS = 60000; // 60 seconds for overnight run
    
    const apiCall = async () => {
        if (PROVIDER.type === 'openai') {
            const client = new OpenAI({ apiKey: PROVIDER.apiKey, timeout: TIMEOUT_MS });
            const response = await client.chat.completions.create({
                model: PROVIDER.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.1,
                response_format: { type: 'json_object' }
            });
            return JSON.parse(response.choices[0].message.content);
        } else if (PROVIDER.type === 'openrouter') {
            const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                model: PROVIDER.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.1
            }, {
                timeout: TIMEOUT_MS,
                headers: {
                    'Authorization': `Bearer ${PROVIDER.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const content = response.data.choices[0].message.content;
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            return JSON.parse(jsonMatch ? jsonMatch[0] : content);
        }
    };
    
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS)
    );
    
    return Promise.race([apiCall(), timeoutPromise]);
}

/**
 * Analyze test
 */
async function analyzeTest(testFilePath) {
    const fileName = path.basename(testFilePath);
    const testContent = fs.readFileSync(testFilePath, 'utf-8');
    const promptTemplate = fs.readFileSync(AI_PROMPT_FILE, 'utf-8');
    
    const systemPrompt = "You are an expert test documentation analyst. Return ONLY valid JSON.";
    const userPrompt = `${promptTemplate}\n\n## Test File to Analyze\n\n\`\`\`javascript\n${testContent}\n\`\`\``;
    
    console.log(`\n📄 ${fileName}`);
    
    try {
        const result = await callAI(systemPrompt, userPrompt);
        console.log(`   ✅ Success with ${PROVIDER.name}`);
        return result;
    } catch (error) {
        console.log(`   ❌ Failed: ${error.message?.substring(0, 60)}`);
        return null;
    }
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
 * Find tests for this batch
 */
function getTestsForBatch() {
    const output = execSync('find tests -name "*.spec.js" -o -name "*.test.js"', {
        cwd: path.join(__dirname, '../..'),
        encoding: 'utf-8'
    });
    
    const allTests = output.split('\n').filter(f => f.trim()).sort();
    
    // Distribute: each batch gets every Nth test where N = number of providers
    const myTests = [];
    for (let i = batchNumber; i < allTests.length; i += PROVIDERS.length) {
        myTests.push(allTests[i]);
    }
    
    return myTests;
}

/**
 * Sleep helper
 */
function sleep(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

/**
 * Main
 */
async function main() {
    const testFiles = getTestsForBatch();
    
    console.log(`📦 Processing ${testFiles.length} tests`);
    console.log(`⏱️  Estimated time: ${(testFiles.length * 20 / 60).toFixed(1)} minutes\n`);
    
    const results = [];
    let successful = 0;
    let failed = 0;
    
    for (let i = 0; i < testFiles.length; i++) {
        const testFile = testFiles[i];
        
        console.log(`[${i + 1}/${testFiles.length}] Processing...`);
        
        const aiResult = await analyzeTest(testFile);
        
        if (aiResult) {
            results.push({
                fileName: path.basename(testFile),
                filePath: testFile,
                aiResult: aiResult,
                markdown: generateMarkdown(aiResult, path.basename(testFile))
            });
            successful++;
        } else {
            failed++;
        }
        
        // Wait 20 seconds before next test (except last one)
        if (i < testFiles.length - 1) {
            console.log(`   ⏳ Waiting 20 seconds...`);
            await sleep(20);
        }
    }
    
    // Save JSON
    const jsonFile = path.join(OUTPUT_DIR, `batch-${batchNumber}.json`);
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(jsonFile, JSON.stringify({
        entries: results
    }, null, 2));
    
    console.log(`\n✅ Batch ${batchNumber} complete!`);
    console.log(`   Successful: ${successful}/${testFiles.length}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Success rate: ${((successful / testFiles.length) * 100).toFixed(1)}%\n`);
}

main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});

