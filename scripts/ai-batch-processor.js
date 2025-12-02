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
import axios from 'axios';

// Gemini import is optional - will be loaded lazily if needed
let GoogleGenerativeAI = null;

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

// Configure AI providers
const AI_PROVIDERS = [
    // Provider 1: OpenAI (3 RPM rate limit)
    {
        name: 'OpenAI',
        apiKey: process.env.AI_API_KEY,
        type: 'openai',
        model: 'gpt-4o-mini',
        rateLimit: { requestsPerMinute: 3, lastResetTime: Date.now(), requestCount: 0 }
    },
    // Provider 2: OpenRouter - Trinity Mini (free)
    {
        name: 'OpenRouter-Trinity',
        apiKey: process.env.AI_API_KEY_2,
        type: 'openrouter',
        model: 'arcee-ai/trinity-mini:free',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions'
    },
    // Provider 3: Google Gemini
    {
        name: 'Google-Gemini-1',
        apiKey: process.env.AI_API_KEY_3,
        type: 'gemini',
        model: 'gemini-1.5-flash'
    },
    // Provider 4: Google Gemini (second key)
    {
        name: 'Google-Gemini-2',
        apiKey: process.env.AI_API_KEY_4,
        type: 'gemini',
        model: 'gemini-1.5-flash'
    },
    // Provider 5: OpenRouter - DeepSeek
    {
        name: 'OpenRouter-DeepSeek',
        apiKey: process.env.AI_API_KEY_5,
        type: 'openrouter',
        model: 'deepseek/deepseek-v3.2-speciale',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions'
    },
    // Provider 6: OpenRouter - Claude
    {
        name: 'OpenRouter-Claude',
        apiKey: process.env.AI_API_KEY_6,
        type: 'openrouter',
        model: 'anthropic/claude-opus-4.5',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions'
    },
    // Provider 7: OpenRouter - Grok (free)
    {
        name: 'OpenRouter-Grok',
        apiKey: process.env.AI_API_KEY_7,
        type: 'openrouter',
        model: 'x-ai/grok-4.1-fast:free',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions'
    },
    // Provider 8: OpenRouter - GPT-5.1
    {
        name: 'OpenRouter-GPT5',
        apiKey: process.env.AI_API_KEY_8,
        type: 'openrouter',
        model: 'openai/gpt-5.1',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions'
    }
].filter(provider => provider.apiKey && provider.apiKey.length > 0);

if (AI_PROVIDERS.length === 0) {
    console.error('❌ No AI API keys found in environment');
    process.exit(1);
}

console.log(`🔑 Found ${AI_PROVIDERS.length} AI provider(s):`);
AI_PROVIDERS.forEach((p, idx) => console.log(`   ${idx + 1}. ${p.name} (${p.type})`));

// Track API usage
let currentProviderIndex = parseInt(batchNumber) % AI_PROVIDERS.length;
let apiCallCounts = new Array(AI_PROVIDERS.length).fill(0);

/**
 * Check and enforce rate limits
 */
async function checkRateLimit(provider) {
    if (!provider.rateLimit) return; // No rate limit configured
    
    const now = Date.now();
    const timeSinceReset = now - provider.rateLimit.lastResetTime;
    
    // Reset counter every minute
    if (timeSinceReset >= 60000) {
        provider.rateLimit.requestCount = 0;
        provider.rateLimit.lastResetTime = now;
    }
    
    // Check if we've hit the limit
    if (provider.rateLimit.requestCount >= provider.rateLimit.requestsPerMinute) {
        const waitTime = Math.ceil((60000 - timeSinceReset) / 1000);
        console.log(`   ⏳ Rate limit reached for ${provider.name}, waiting ${waitTime}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
        provider.rateLimit.requestCount = 0;
        provider.rateLimit.lastResetTime = Date.now();
    }
    
    provider.rateLimit.requestCount++;
}

/**
 * Get next provider with round-robin balancing
 */
function getNextProvider() {
    const provider = AI_PROVIDERS[currentProviderIndex];
    const providerNumber = currentProviderIndex + 1;
    apiCallCounts[currentProviderIndex]++;
    
    // Move to next provider for next call
    currentProviderIndex = (currentProviderIndex + 1) % AI_PROVIDERS.length;
    
    return { provider, providerNumber };
}

/**
 * Analyze test file with AI (multi-provider support)
 */
async function analyzeTestWithAI(testFilePath, retryCount = 0) {
    try {
        const fileName = path.basename(testFilePath);
        const testContent = fs.readFileSync(testFilePath, 'utf-8');
        const promptTemplate = fs.readFileSync(AI_PROMPT_FILE, 'utf-8');
        
        const systemPrompt = 'You are an expert test documentation analyst. Analyze test files and return structured JSON. Return ONLY valid JSON, no markdown formatting.';
        const userPrompt = `${promptTemplate}

## Test File to Analyze

\`\`\`javascript
${testContent}
\`\`\`

Analyze this test file and return the JSON structure as specified above.`;
        
        const { provider, providerNumber } = getNextProvider();
        
        console.log(`   🤖 Analyzing with ${provider.name}...`);
        
        try {
            let result;
            
            switch (provider.type) {
                case 'openai':
                    result = await callOpenAI(provider, systemPrompt, userPrompt);
                    break;
                case 'openrouter':
                    result = await callOpenRouter(provider, systemPrompt, userPrompt);
                    break;
                case 'gemini':
                    result = await callGemini(provider, systemPrompt, userPrompt);
                    break;
                default:
                    throw new Error(`Unknown provider type: ${provider.type}`);
            }
            
            console.log(`   ✅ Analysis completed with ${provider.name}`);
            
            return result;
            
        } catch (apiError) {
            // Handle rate limits and auth errors with retry using different provider
            if ((apiError.status === 429 || apiError.status === 401 || apiError.response?.status === 429 || apiError.response?.status === 401) && retryCount < AI_PROVIDERS.length * 2) {
                const waitTime = apiError.status === 429 || apiError.response?.status === 429 ? 2 : 0;
                
                if (waitTime > 0) {
                    console.log(`   ⏳ Rate limit on ${provider.name}, waiting ${waitTime}s...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
                } else {
                    console.log(`   ⚠️  ${provider.name} failed (401), trying next provider...`);
                }
                
                return analyzeTestWithAI(testFilePath, retryCount + 1);
            }
            
            console.log(`   ⚠️  ${provider.name} failed:`, apiError.message?.substring(0, 100) || apiError.response?.data?.error?.message?.substring(0, 100));
            
            // Try next provider
            if (retryCount < AI_PROVIDERS.length) {
                return analyzeTestWithAI(testFilePath, retryCount + 1);
            }
            
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
    console.log(`\n📊 AI provider usage distribution:`);
    apiCallCounts.forEach((count, idx) => {
        if (AI_PROVIDERS[idx]) {
            console.log(`   ${AI_PROVIDERS[idx].name}: ${count} calls`);
        }
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

