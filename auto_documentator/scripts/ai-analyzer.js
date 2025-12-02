#!/usr/bin/env node
/**
 * AI-Powered Test Analyzer with Advanced Model Balancing
 * 
 * Uses multiple AI providers with smart load balancing across parallel batches.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import axios from 'axios';
import { isProviderRateLimited, markProviderRateLimited, markProviderWorking } from './shared-rate-limiter.js';
import { isModelBusy, markModelBusy, markModelAvailable, cleanupStaleLocks } from './model-balancer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AI_PROMPT_FILE = path.join(__dirname, '../prompts/test-analyzer-prompt.md');
const OUTPUT_DIR = path.join(__dirname, '../../documentation');

const batchFile = process.argv[2];
const batchNumber = process.argv[3] || '0';

if (!batchFile) {
    console.error('❌ Usage: node ai-analyzer.js <batch-file> [batch-number]');
    process.exit(1);
}

// AI Providers - Multiple OpenAI keys + Many free OpenRouter models
const AI_PROVIDERS = [
    // OpenAI Keys (3 RPM each = 12 RPM total)
    {
        name: 'OpenAI-Key1',
        apiKey: process.env.AI_API_KEY,
        type: 'openai',
        model: 'gpt-4o-mini'
    },
    {
        name: 'OpenAI-Key2',
        apiKey: process.env.AI_API_KEY_6,
        type: 'openai',
        model: 'gpt-4o-mini'
    },
    {
        name: 'OpenAI-Key3',
        apiKey: process.env.AI_API_KEY_7,
        type: 'openai',
        model: 'gpt-4o-mini'
    },
    {
        name: 'OpenAI-Key4',
        apiKey: process.env.AI_API_KEY_8,
        type: 'openai',
        model: 'gpt-4o-mini'
    },
    // OpenRouter Models (all using AI_API_KEY_5)
    {
        name: 'OR-TNG-Chimera',
        apiKey: process.env.AI_API_KEY_5,
        type: 'openrouter',
        model: 'tngtech/tng-r1t-chimera:free'
    },
    {
        name: 'OR-KAT-Coder',
        apiKey: process.env.AI_API_KEY_5,
        type: 'openrouter',
        model: 'kwaipilot/kat-coder-pro:free'
    },
    {
        name: 'OR-Grok-Fast',
        apiKey: process.env.AI_API_KEY_5,
        type: 'openrouter',
        model: 'x-ai/grok-4.1-fast:free'
    },
    {
        name: 'OR-Nemotron-VL',
        apiKey: process.env.AI_API_KEY_5,
        type: 'openrouter',
        model: 'nvidia/nemotron-nano-12b-v2-vl:free'
    },
    {
        name: 'OR-Nemotron-9B',
        apiKey: process.env.AI_API_KEY_5,
        type: 'openrouter',
        model: 'nvidia/nemotron-nano-9b-v2:free'
    },
    {
        name: 'OR-GPT-OSS',
        apiKey: process.env.AI_API_KEY_5,
        type: 'openrouter',
        model: 'openai/gpt-oss-20b:free'
    },
    {
        name: 'OR-Qwen-Coder',
        apiKey: process.env.AI_API_KEY_5,
        type: 'openrouter',
        model: 'qwen/qwen3-coder:free'
    },
    {
        name: 'OR-Kimi-K2',
        apiKey: process.env.AI_API_KEY_5,
        type: 'openrouter',
        model: 'moonshotai/kimi-k2:free'
    },
    {
        name: 'OR-Gemma-3n-E2B',
        apiKey: process.env.AI_API_KEY_5,
        type: 'openrouter',
        model: 'google/gemma-3n-e2b-it:free'
    },
    {
        name: 'OR-DeepSeek-Chimera',
        apiKey: process.env.AI_API_KEY_5,
        type: 'openrouter',
        model: 'tngtech/deepseek-r1t2-chimera:free'
    },
    {
        name: 'OR-Gemma-3n-E4B',
        apiKey: process.env.AI_API_KEY_5,
        type: 'openrouter',
        model: 'google/gemma-3n-e4b-it:free'
    },
    {
        name: 'OR-Gemma-4B',
        apiKey: process.env.AI_API_KEY_5,
        type: 'openrouter',
        model: 'google/gemma-3-4b-it:free'
    },
    {
        name: 'OR-Gemma-12B',
        apiKey: process.env.AI_API_KEY_5,
        type: 'openrouter',
        model: 'google/gemma-3-12b-it:free'
    },
    {
        name: 'OR-Gemma-27B',
        apiKey: process.env.AI_API_KEY_5,
        type: 'openrouter',
        model: 'google/gemma-3-27b-it:free'
    },
    {
        name: 'OR-Llama-70B',
        apiKey: process.env.AI_API_KEY_5,
        type: 'openrouter',
        model: 'meta-llama/llama-3.3-70b-instruct:free'
    },
    {
        name: 'OR-Llama-3B',
        apiKey: process.env.AI_API_KEY_5,
        type: 'openrouter',
        model: 'meta-llama/llama-3.2-3b-instruct:free'
    },
    {
        name: 'OR-DeepSeek-R1T',
        apiKey: process.env.AI_API_KEY_5,
        type: 'openrouter',
        model: 'tngtech/deepseek-r1t-chimera:free'
    },
    {
        name: 'OR-Mistral-24B',
        apiKey: process.env.AI_API_KEY_5,
        type: 'openrouter',
        model: 'mistralai/mistral-small-3.1-24b-instruct:free'
    },
    // OpenRouter Trinity (separate key)
    {
        name: 'OR-Trinity',
        apiKey: process.env.AI_API_KEY_2,
        type: 'openrouter',
        model: 'arcee-ai/trinity-mini:free'
    }
].filter(p => p.apiKey && p.apiKey.length > 10);

console.log(`🔑 Available AI providers: ${AI_PROVIDERS.length}`);
AI_PROVIDERS.forEach((p, i) => console.log(`   ${i + 1}. ${p.name}`));

// Cleanup stale locks on startup
cleanupStaleLocks();

let currentProviderIndex = parseInt(batchNumber) % Math.max(AI_PROVIDERS.length, 1);

/**
 * Call AI provider with timeout
 */
async function callAIProvider(provider, systemPrompt, userPrompt) {
    const TIMEOUT_MS = 45000;
    
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), TIMEOUT_MS)
    );
    
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
    
    return Promise.race([apiCall(), timeoutPromise]);
}

/**
 * Calculate quality score
 */
function calculateQualityScore(result) {
    let score = 0;
    if (result.summary && result.summary.length > 50) score += 20;
    if (result.functionalitiesCovered?.length > 0) score += 15;
    if (result.stepsAndVerifications?.length > 0) score += 25;
    if (result.dataUsed?.users?.length > 0) score += 10;
    if (result.dataUsed?.applications?.length > 0) score += 10;
    if (result.dataUsed?.otherData?.length > 0) score += 10;
    if (result.tags?.length > 0) score += 10;
    return Math.min(100, score);
}

/**
 * Analyze test with AI fallback and smart balancing
 */
async function analyzeTestWithFallback(testFilePath) {
    const fileName = path.basename(testFilePath);
    const testContent = fs.readFileSync(testFilePath, 'utf-8');
    const promptTemplate = fs.readFileSync(AI_PROMPT_FILE, 'utf-8');
    
    const systemPrompt = "You are an expert test documentation analyst. Return ONLY valid JSON.";
    const userPrompt = `${promptTemplate}\n\n## Test File to Analyze\n\n\`\`\`javascript\n${testContent}\n\`\`\``;
    
    console.log(`\n📄 ${fileName}`);
    
    let bestResult = null;
    let bestScore = 0;
    let attempts = 0;
    const MAX_ATTEMPTS = Math.min(AI_PROVIDERS.length, 5);
    
    while (attempts < MAX_ATTEMPTS && bestScore < 85) {
        // Find next available provider (not busy, not rate limited)
        let provider = null;
        let providerIdx = currentProviderIndex;
        
        for (let i = 0; i < AI_PROVIDERS.length; i++) {
            const idx = (providerIdx + i) % AI_PROVIDERS.length;
            const candidate = AI_PROVIDERS[idx];
            
            // Skip if rate limited globally
            if (isProviderRateLimited(candidate.name)) {
                continue;
            }
            
            // Skip if model is busy in another batch
            if (isModelBusy(candidate.name)) {
                continue;
            }
            
            provider = candidate;
            providerIdx = idx;
            break;
        }
        
        if (!provider) {
            console.log(`   ⏳ All models busy or rate limited - waiting 2s...`);
            await new Promise(r => setTimeout(r, 2000));
            cleanupStaleLocks(); // Clean up any stale locks
            continue;
        }
        
        attempts++;
        console.log(`   🤖 Attempt ${attempts}: ${provider.name}...`);
        
        // Mark model as busy
        markModelBusy(provider.name, batchNumber);
        
        try {
            const result = await callAIProvider(provider, systemPrompt, userPrompt);
            const score = calculateQualityScore(result);
            
            console.log(`   📊 Score: ${score}/100`);
            
            markProviderWorking(provider.name);
            
            if (score > bestScore) {
                bestScore = score;
                bestResult = result;
            }
            
            if (score >= 85) {
                console.log(`   ✅ Excellent result (${score}/100)`);
                break;
            }
            
            await new Promise(r => setTimeout(r, 500));
            
        } catch (error) {
            console.log(`   ❌ ${provider.name} failed:`, error.message?.substring(0, 80));
            
            if (error.status === 429 || error.response?.status === 429) {
                console.log(`   🚫 Rate limit - marking as unavailable`);
                markProviderRateLimited(provider.name);
            } else if (error.status === 402 || error.response?.status === 402) {
                console.log(`   🚫 Payment required - marking as unavailable`);
                markProviderRateLimited(provider.name);
            } else if (error.status === 401 || error.response?.status === 401) {
                console.log(`   🚫 Auth error - marking as unavailable`);
                markProviderRateLimited(provider.name);
            }
        } finally {
            // Always free up the model
            markModelAvailable(provider.name);
        }
        
        currentProviderIndex = (providerIdx + 1) % AI_PROVIDERS.length;
    }
    
    if (!bestResult) {
        console.log(`   ❌ All attempts failed`);
        return null;
    }
    
    console.log(`   ✅ Final score: ${bestScore}/100`);
    return bestResult;
}

/**
 * Generate markdown from AI result
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
 * Main execution
 */
async function main() {
    const testFiles = fs.readFileSync(batchFile, 'utf-8').split('\n').filter(f => f.trim());
    
    console.log(`📦 AI Analysis - Batch ${batchNumber}`);
    console.log(`✅ Processing ${testFiles.length} tests with AI fallback\n`);
    
    const results = [];
    
    for (const testFile of testFiles) {
        if (!testFile.trim()) continue;
        
        const aiResult = await analyzeTestWithFallback(testFile);
        
        if (aiResult) {
            results.push({
                fileName: path.basename(testFile),
                filePath: testFile,
                aiResult: aiResult,
                markdown: generateMarkdown(aiResult, path.basename(testFile))
            });
        }
    }
    
    // Save JSON results
    const jsonFile = path.join(OUTPUT_DIR, `batch-${batchNumber}.json`);
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(jsonFile, JSON.stringify({
        batchNumber: parseInt(batchNumber),
        testsProcessed: testFiles.length,
        aiSuccess: results.length,
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
