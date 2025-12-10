#!/usr/bin/env node
/**
 * Retry Failed Tests with Working Providers
 * 
 * Takes failed tests and retries them ONLY with providers that
 * had successes in the first phase.
 * 
 * Uses 1 minute delays between tests (strict).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import OpenAI from 'openai';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AI_PROMPT_FILE = path.join(__dirname, '../prompts/test-analyzer-prompt.md');
const OUTPUT_DIR = path.join(__dirname, '../../documentation');
const FAILED_TESTS_FILE = path.join(__dirname, '../../documentation/failed-tests.txt');

const workingBatch = parseInt(process.argv[2]); // Which working batch/provider to use

// TOP PERFORMING PROVIDERS ONLY (100% success rate)
const ALL_PROVIDERS = [
    { batch: 0, name: 'OR-Llama-70B', apiKey: process.env.AI_API_KEY_5, type: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free' },
    { batch: 1, name: 'OR-Gemma-27B', apiKey: process.env.AI_API_KEY_5, type: 'openrouter', model: 'google/gemma-3-27b-it:free' }
].filter(p => p.apiKey && p.apiKey.length > 10);

const PROVIDER = ALL_PROVIDERS.find(p => p.batch === workingBatch);

if (!PROVIDER) {
    console.error(`❌ No provider for batch ${workingBatch}`);
    process.exit(1);
}

console.log(`\n🔄 RETRY PHASE - Using working provider: ${PROVIDER.name}`);
console.log(`⏱️  STRICT 1 minute delay between tests\n`);

/**
 * Call AI
 */
async function callAI(systemPrompt, userPrompt) {
    const TIMEOUT_MS = 60000;
    
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
 * Extract test cases from file
 */
function extractTestCasesFromFile(fileContent) {
    const testCases = [];
    
    // Pattern for taggedTest (API tests)
    const taggedTestPattern = /taggedTest\(\s*['"`]([^'"`]+)['"`]/g;
    // Pattern for test() (UI tests)
    const testPattern = /test\(\s*['"`]([^'"`]+)['"`]/g;
    
    let match;
    
    // Extract taggedTest calls
    while ((match = taggedTestPattern.exec(fileContent)) !== null) {
        testCases.push({ name: match[1], type: 'taggedTest' });
    }
    
    // Extract test() calls
    while ((match = testPattern.exec(fileContent)) !== null) {
        testCases.push({ name: match[1], type: 'test' });
    }
    
    return testCases;
}

/**
 * Analyze test with test-case awareness
 */
async function analyzeTest(testFilePath) {
    const fileName = path.basename(testFilePath);
    
    // Resolve file path (handle both relative and absolute)
    const fullPath = path.isAbsolute(testFilePath)
        ? testFilePath
        : path.join(__dirname, '../..', testFilePath);
    
    // Verify file exists
    if (!fs.existsSync(fullPath)) {
        throw new Error(`File not found: ${testFilePath}`);
    }
    
    const testContent = fs.readFileSync(fullPath, 'utf-8');
    const promptTemplate = fs.readFileSync(AI_PROMPT_FILE, 'utf-8');
    
    // Extract individual test cases
    const testCases = extractTestCasesFromFile(testContent);
    const testCaseList = testCases.map((tc, i) => `${i + 1}. ${tc.name}`).join('\n');
    
    const systemPrompt = "You are an expert test documentation analyst. Return ONLY valid JSON.";
    const userPrompt = `${promptTemplate}

## Test File Information

File: ${fileName}
Individual Test Cases in this file (${testCases.length}):
${testCaseList}

## Full Test File Code

\`\`\`javascript
${testContent}
\`\`\`

Please document ALL ${testCases.length} test cases listed above.`;
    
    console.log(`\n📄 ${fileName} (${testCases.length} test cases)`);
    
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
 * Find file by basename if it doesn't exist at original path
 * Searches the entire tests directory for a file with the same name
 */
function findFileByBasename(originalPath) {
    const basename = path.basename(originalPath);
    
    try {
        // Search for files with this basename in the tests directory
        const output = execSync(`find tests -name "${basename}" -type f`, {
            cwd: path.join(__dirname, '../..'),
            encoding: 'utf-8'
        });
        
        const matches = output.split('\n').filter(f => f.trim());
        
        if (matches.length === 0) {
            return null; // File not found anywhere
        }
        
        if (matches.length === 1) {
            return matches[0]; // Found exactly one match - likely the moved file
        }
        
        // Multiple matches found - prefer the one that's different from original
        const originalBasenameDir = path.dirname(originalPath);
        const differentMatch = matches.find(m => path.dirname(m) !== originalBasenameDir);
        
        return differentMatch || matches[0]; // Return different location or first match
    } catch (error) {
        // find command failed or no matches
        return null;
    }
}

/**
 * Sleep with strict timing
 */
async function strictSleep(seconds) {
    const startTime = Date.now();
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    const elapsed = (Date.now() - startTime) / 1000;
    console.log(`   ⏱️  Waited exactly ${elapsed.toFixed(1)}s\n`);
}

/**
 * Main
 */
async function main() {
    if (!fs.existsSync(FAILED_TESTS_FILE)) {
        console.log('✅ No failed tests - all succeeded!');
        process.exit(0);
    }
    
    const failedTests = fs.readFileSync(FAILED_TESTS_FILE, 'utf-8')
        .split('\n')
        .filter(f => f.trim());
    
    console.log(`📦 Retrying ${failedTests.length} failed tests`);
    console.log(`⏱️  1 MINUTE strict delay between tests\n`);
    console.log(`   Estimated time: ${failedTests.length} minutes\n`);
    
    const results = [];
    let successful = 0;
    let failed = 0;
    
    for (let i = 0; i < failedTests.length; i++) {
        const testFile = failedTests[i];
        
        console.log(`[${i + 1}/${failedTests.length}] Retrying...`);
        
        // Check if file exists before processing
        let actualTestFile = testFile;
        let fullPath = path.isAbsolute(testFile) 
            ? testFile 
            : path.join(__dirname, '../..', testFile);
        
        if (!fs.existsSync(fullPath)) {
            console.log(`   ⚠️  File not found at original path: ${testFile}`);
            console.log(`   🔍 Searching for file by basename...`);
            
            // Try to find the file in a different location
            const foundPath = findFileByBasename(testFile);
            
            if (foundPath) {
                actualTestFile = foundPath;
                fullPath = path.join(__dirname, '../..', foundPath);
                console.log(`   ✅ Found file at new location: ${foundPath}`);
                console.log(`   📝 Using updated path for processing`);
            } else {
                console.log(`   ❌ File not found anywhere - may have been deleted`);
                console.log(`   ⏭️  Skipping this test`);
                failed++;
                
                // Still wait before next test (except last)
                if (i < failedTests.length - 1) {
                    console.log(`   ⏳ STRICT 1 MINUTE WAIT...`);
                    await strictSleep(60);
                }
                continue;
            }
        }
        
        const aiResult = await analyzeTest(actualTestFile);
        
        if (aiResult) {
            results.push({
                fileName: path.basename(actualTestFile),
                filePath: actualTestFile, // Use actual path (may be different if file was moved)
                aiResult: aiResult,
                markdown: generateMarkdown(aiResult, path.basename(actualTestFile))
            });
            successful++;
        } else {
            failed++;
        }
        
        // STRICT 1 minute wait before next test (except last)
        if (i < failedTests.length - 1) {
            console.log(`   ⏳ STRICT 1 MINUTE WAIT...`);
            await strictSleep(60);
        }
    }
    
    // Save retry results
    const jsonFile = path.join(OUTPUT_DIR, `batch-retry-${workingBatch}.json`);
    fs.writeFileSync(jsonFile, JSON.stringify({
        entries: results
    }, null, 2));
    
    console.log(`\n✅ Retry phase complete!`);
    console.log(`   Successful: ${successful}/${failedTests.length}`);
    console.log(`   Still failed: ${failed}`);
    console.log(`   Recovery rate: ${((successful / failedTests.length) * 100).toFixed(1)}%\n`);
}

main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});

