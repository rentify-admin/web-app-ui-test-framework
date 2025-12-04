#!/usr/bin/env node
/**
 * AI Analyzer with Multi-Provider Retry
 * 
 * Processes tests with intelligent retry across ALL available providers
 * to maximize success rate in a single run.
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
    console.error('❌ Usage: node ai-analyzer-multi-retry.js <batch-file> <batch-number>');
    process.exit(1);
}

// ALL available providers - prioritized by reliability
const ALL_PROVIDERS = [
    // OpenAI (most reliable, fastest)
    { name: 'OpenAI-1', apiKey: process.env.AI_API_KEY, type: 'openai', model: 'gpt-4o-mini', priority: 1 },
    { name: 'OpenAI-2', apiKey: process.env.AI_API_KEY_6, type: 'openai', model: 'gpt-4o-mini', priority: 1 },
    { name: 'OpenAI-3', apiKey: process.env.AI_API_KEY_7, type: 'openai', model: 'gpt-4o-mini', priority: 1 },
    // OpenRouter (good fallbacks)
    { name: 'OR-Llama-70B', apiKey: process.env.AI_API_KEY_5, type: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free', priority: 2 },
    { name: 'OR-Mistral', apiKey: process.env.AI_API_KEY_5, type: 'openrouter', model: 'mistralai/mistral-small-3.1-24b-instruct:free', priority: 2 },
    { name: 'OR-Gemma-27B', apiKey: process.env.AI_API_KEY_5, type: 'openrouter', model: 'google/gemma-3-27b-it:free', priority: 3 },
    { name: 'OR-Qwen', apiKey: process.env.AI_API_KEY_5, type: 'openrouter', model: 'qwen/qwen3-coder:free', priority: 3 }
].filter(p => p.apiKey && p.apiKey.length > 10)
 .sort((a, b) => a.priority - b.priority); // Best providers first

console.log(`🎯 Batch ${batchNumber} - ${ALL_PROVIDERS.length} providers available\n`);

/**
 * Call AI with timeout
 */
async function callAI(provider, systemPrompt, userPrompt) {
    const TIMEOUT_MS = 30000;
    
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
    };
    
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS)
    );
    
    return Promise.race([apiCall(), timeoutPromise]);
}

/**
 * Calculate quality score
 */
function scoreResult(result) {
    let score = 0;
    if (result.summary && result.summary.length > 50) score += 20;
    if (result.functionalitiesCovered?.length > 0) score += 15;
    if (result.stepsAndVerifications?.length > 0) score += 25;
    if (result.dataUsed?.users?.length > 0) score += 10;
    if (result.dataUsed?.applications?.length > 0) score += 10;
    if (result.dataUsed?.otherData?.length > 0) score += 10;
    if (result.tags?.length > 0) score += 10;
    return score;
}

/**
 * Analyze test with MULTI-PROVIDER RETRY
 */
async function analyzeTestMultiRetry(testFilePath) {
    const fileName = path.basename(testFilePath);
    const testContent = fs.readFileSync(testFilePath, 'utf-8');
    const promptTemplate = fs.readFileSync(AI_PROMPT_FILE, 'utf-8');
    
    const systemPrompt = "You are an expert test documentation analyst. Return ONLY valid JSON.";
    const userPrompt = `${promptTemplate}\n\n## Test File to Analyze\n\n\`\`\`javascript\n${testContent}\n\`\`\``;
    
    console.log(`\n📄 ${fileName}`);
    
    let bestResult = null;
    let bestScore = 0;
    
    // Try ALL providers until we get a good result
    for (const provider of ALL_PROVIDERS) {
        try {
            console.log(`   🤖 Trying ${provider.name}...`);
            
            const result = await callAI(provider, systemPrompt, userPrompt);
            const score = scoreResult(result);
            
            console.log(`   ✅ Score: ${score}/100`);
            
            if (score > bestScore) {
                bestScore = score;
                bestResult = result;
            }
            
            // If we got a great result (>80), stop trying
            if (score >= 80) {
                console.log(`   🎯 Excellent result! Using this.`);
                break;
            }
            
            // Small delay between providers
            await new Promise(r => setTimeout(r, 500));
            
        } catch (error) {
            const msg = error.message?.substring(0, 50) || error.toString().substring(0, 50);
            console.log(`   ⏭️  ${provider.name} failed: ${msg}`);
            
            // If rate limited, skip remaining providers with same key
            if (error.message?.includes('429')) {
                console.log(`   ⚠️  Rate limited, trying different provider...`);
            }
        }
    }
    
    if (bestResult && bestScore >= 50) {
        console.log(`   ✅ SUCCESS - Final score: ${bestScore}/100`);
        return bestResult;
    }
    
    console.log(`   ❌ All providers failed or low quality (best: ${bestScore}/100)`);
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
    
    console.log(`📦 Processing ${testFiles.length} tests with multi-provider retry\n`);
    
    const results = [];
    
    for (const testFile of testFiles) {
        if (!testFile.trim()) continue;
        
        const aiResult = await analyzeTestMultiRetry(testFile);
        
        if (aiResult) {
            results.push({
                fileName: path.basename(testFile),
                filePath: testFile,
                aiResult: aiResult,
                markdown: generateMarkdown(aiResult, path.basename(testFile))
            });
        }
    }
    
    // Save JSON
    const jsonFile = path.join(OUTPUT_DIR, `batch-${batchNumber}.json`);
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(jsonFile, JSON.stringify({
        entries: results
    }, null, 2));
    
    console.log(`\n✅ Batch ${batchNumber} complete:`);
    console.log(`   Tests processed: ${testFiles.length}`);
    console.log(`   Successful: ${results.length}\n`);
}

main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});

