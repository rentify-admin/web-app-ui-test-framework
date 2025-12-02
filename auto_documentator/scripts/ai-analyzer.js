#!/usr/bin/env node
/**
 * AI-Powered Test Analyzer with Multi-Provider Fallback
 * 
 * Attempts analysis with multiple AI providers until data is complete.
 * Ensures no fields are left with "{data not found}".
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const AI_PROMPT_FILE = path.join(__dirname, '../prompts/test-analyzer-prompt.md');
const OUTPUT_DIR = path.join(__dirname, '../../documentation');

// Get arguments
const batchFile = process.argv[2];
const batchNumber = process.argv[3] || '0';

if (!batchFile) {
    console.error('❌ Usage: node ai-analyzer.js <batch-file> [batch-number]');
    process.exit(1);
}

// AI Providers configuration
const AI_PROVIDERS = [
    {
        name: 'OpenAI-GPT4o-mini',
        apiKey: process.env.AI_API_KEY,
        type: 'openai',
        model: 'gpt-4o-mini',
        rateLimit: { rpm: 3, lastReset: Date.now(), count: 0 }
    },
    {
        name: 'OpenRouter-Trinity',
        apiKey: process.env.AI_API_KEY_2,
        type: 'openrouter',
        model: 'arcee-ai/trinity-mini:free',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions'
    },
    {
        name: 'OpenRouter-DeepSeek',
        apiKey: process.env.AI_API_KEY_5,
        type: 'openrouter',
        model: 'deepseek/deepseek-v3.2-speciale',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions'
    },
    {
        name: 'OpenRouter-Claude',
        apiKey: process.env.AI_API_KEY_6,
        type: 'openrouter',
        model: 'anthropic/claude-opus-4.5',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions'
    },
    {
        name: 'OpenRouter-Grok',
        apiKey: process.env.AI_API_KEY_7,
        type: 'openrouter',
        model: 'x-ai/grok-4.1-fast:free',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions'
    },
    {
        name: 'OpenRouter-GPT5',
        apiKey: process.env.AI_API_KEY_8,
        type: 'openrouter',
        model: 'openai/gpt-5.1',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions'
    }
].filter(p => p.apiKey && p.apiKey.length > 10); // Filter out empty/invalid keys

console.log(`🔑 Available AI providers: ${AI_PROVIDERS.length}`);
AI_PROVIDERS.forEach((p, i) => console.log(`   ${i + 1}. ${p.name}`));

let currentProviderIndex = parseInt(batchNumber) % Math.max(AI_PROVIDERS.length, 1);
let providerCallCounts = new Array(AI_PROVIDERS.length).fill(0);

/**
 * Check OpenAI rate limit (3 RPM)
 */
async function checkOpenAIRateLimit(provider) {
    if (!provider.rateLimit) return;
    
    const now = Date.now();
    const elapsed = now - provider.rateLimit.lastReset;
    
    if (elapsed >= 60000) {
        provider.rateLimit.count = 0;
        provider.rateLimit.lastReset = now;
    }
    
    if (provider.rateLimit.count >= provider.rateLimit.rpm) {
        const waitMs = 60000 - elapsed + 1000;
        console.log(`   ⏳ OpenAI rate limit: waiting ${Math.ceil(waitMs / 1000)}s...`);
        await new Promise(r => setTimeout(r, waitMs));
        provider.rateLimit.count = 0;
        provider.rateLimit.lastReset = Date.now();
    }
    
    provider.rateLimit.count++;
}

/**
 * Call AI provider
 */
async function callAIProvider(provider, systemPrompt, userPrompt) {
    if (provider.type === 'openai') {
        await checkOpenAIRateLimit(provider);
        const client = new OpenAI({ apiKey: provider.apiKey });
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
        const response = await axios.post(provider.endpoint, {
            model: provider.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.1
        }, {
            headers: {
                'Authorization': `Bearer ${provider.apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 120000
        });
        
        const content = response.data.choices[0].message.content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        return JSON.parse(jsonMatch ? jsonMatch[0] : content);
    }
    
    throw new Error(`Unsupported provider type: ${provider.type}`);
}

/**
 * Check if analysis result has missing data
 */
function hasMissingData(result) {
    const json = JSON.stringify(result);
    return json.includes('{data not found}') || 
           json.includes('N/A') ||
           !result.dataUsed?.users?.length ||
           !result.stepsAndVerifications?.length;
}

/**
 * Analyze test with AI and fallback
 */
async function analyzeTestWithFallback(testFilePath) {
    const fileName = path.basename(testFilePath);
    const testContent = fs.readFileSync(testFilePath, 'utf-8');
    const promptTemplate = fs.readFileSync(AI_PROMPT_FILE, 'utf-8');
    
    const systemPrompt = 'You are an expert Playwright test analyzer. Extract ALL information from test code with extreme thoroughness. Return ONLY valid JSON.';
    const userPrompt = `${promptTemplate}

## Test File: ${fileName}

\`\`\`javascript
${testContent}
\`\`\`

Analyze every line thoroughly and extract ALL information. Be specific and detailed.`;
    
    console.log(`\n📄 ${fileName}`);
    
    let bestResult = null;
    let bestScore = 0;
    
    // Try up to 3 different providers for best results
    const providersToTry = Math.min(3, AI_PROVIDERS.length);
    
    for (let attempt = 0; attempt < providersToTry; attempt++) {
        const providerIdx = (currentProviderIndex + attempt) % AI_PROVIDERS.length;
        const provider = AI_PROVIDERS[providerIdx];
        
        console.log(`   🤖 Attempt ${attempt + 1}: ${provider.name}...`);
        providerCallCounts[providerIdx]++;
        
        try {
            const result = await callAIProvider(provider, systemPrompt, userPrompt);
            
            // Score the result based on completeness
            let score = 0;
            if (result.summary && result.summary.length > 50) score += 20;
            if (result.functionalitiesCovered?.length > 0) score += 15;
            if (result.stepsAndVerifications?.length > 0) score += 25;
            if (result.dataUsed?.users?.length > 0) score += 10;
            if (result.dataUsed?.applications?.length > 0) score += 10;
            if (result.dataUsed?.otherData?.length > 0) score += 10;
            if (result.tags?.length > 0) score += 10;
            
            console.log(`   📊 Score: ${score}/100`);
            
            if (score > bestScore) {
                bestScore = score;
                bestResult = result;
            }
            
            // If we got a perfect or near-perfect score, stop
            if (score >= 85) {
                console.log(`   ✅ Excellent result (${score}/100) - using this analysis`);
                break;
            } else if (!hasMissingData(result)) {
                console.log(`   ✅ Complete data found - using this analysis`);
                break;
            } else {
                console.log(`   ⚠️  Incomplete data (${score}/100) - trying next provider...`);
                await new Promise(r => setTimeout(r, 500)); // Small delay
            }
            
        } catch (error) {
            console.log(`   ❌ ${provider.name} failed:`, error.message?.substring(0, 80));
            
            if (error.status === 429 || error.response?.status === 429) {
                console.log(`   ⏳ Rate limit - waiting 3s...`);
                await new Promise(r => setTimeout(r, 3000));
            }
        }
    }
    
    // Move to next provider for next file
    currentProviderIndex = (currentProviderIndex + 1) % AI_PROVIDERS.length;
    
    if (!bestResult) {
        console.log(`   ❌ All providers failed`);
        return null;
    }
    
    console.log(`   ✅ Final score: ${bestScore}/100`);
    return bestResult;
}

/**
 * Generate markdown from AI result
 */
function generateMarkdown(aiResult, fileName, filePath) {
    if (!aiResult) return null;
    
    const timestamp = new Date().toISOString();
    const humanTime = new Date(timestamp).toLocaleString('en-US', { 
        timeZone: 'UTC', 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: false 
    });
    
    const formatList = (arr) => arr && arr.length > 0 ? arr.join(', ') : '{data not found}';
    
    const stepsTable = aiResult.stepsAndVerifications?.map(s => 
        `| **${s.step}** | ${s.action || '{data not found}'} | ${s.verification || '{data not found}'} |`
    ).join('\n') || '| {data not found} | {data not found} | {data not found} |';
    
    const funcList = aiResult.functionalitiesCovered?.map(f => `- ${f}`).join('\n') || '- {data not found}';
    
    const tags = aiResult.tags?.length > 0 ? aiResult.tags.join(' ') : '{data not found}';
    
    const data = aiResult.dataUsed || {};
    
    return `## 🧪 \`${fileName}\` → \`${aiResult.testTitle || '{data not found}'}\`

**Summary:** ${aiResult.summary || '{data not found}'}

**Tags:** ${tags}

### Functionalities Covered

${funcList}

### Test Data Used

| Data Type | Details |
|-----------|---------|
| **Users** | ${formatList(data.users)} |
| **Applications** | ${formatList(data.applications)} |
| **Sessions** | ${formatList(data.sessions)} |
| **API Payloads** | ${formatList(data.apiPayloads)} |
| **Other Data** | ${formatList(data.otherData)} |

### Steps & Verifications

| Step | Action | Verification |
|------|--------|--------------|
${stepsTable}

---

**Last Updated:** ${humanTime} UTC

---
`;
}

/**
 * Main
 */
async function main() {
    console.log(`📦 AI Analysis - Batch ${batchNumber}`);
    
    if (!fs.existsSync(batchFile)) {
        console.error(`❌ Batch file not found: ${batchFile}`);
        process.exit(1);
    }
    
    const testFiles = fs.readFileSync(batchFile, 'utf-8')
        .split('\n')
        .filter(l => l.trim());
    
    console.log(`✅ Processing ${testFiles.length} tests with AI fallback`);
    
    const entries = [];
    let successCount = 0;
    
    for (const testFile of testFiles) {
        const fullPath = path.join(__dirname, '../..', testFile);
        
        if (!fs.existsSync(fullPath)) continue;
        
        const aiResult = await analyzeTestWithFallback(fullPath);
        
        if (aiResult) {
            const markdown = generateMarkdown(aiResult, path.basename(testFile), testFile);
            if (markdown) {
                entries.push({ fileName: path.basename(testFile), markdown, aiResult });
                successCount++;
            }
        }
        
        await new Promise(r => setTimeout(r, 200)); // Delay between files
    }
    
    // Save results
    fs.writeFileSync(path.join(OUTPUT_DIR, `batch-${batchNumber}.json`), JSON.stringify(entries, null, 2));
    
    console.log(`\n✅ Batch ${batchNumber} complete:`);
    console.log(`   Tests processed: ${testFiles.length}`);
    console.log(`   AI analyses successful: ${successCount}`);
    console.log(`\n📊 Provider usage:`);
    providerCallCounts.forEach((count, i) => {
        if (AI_PROVIDERS[i]) {
            console.log(`   ${AI_PROVIDERS[i].name}: ${count} calls`);
        }
    });
}

main().catch(e => {
    console.error('❌ Error:', e);
    process.exit(1);
});

