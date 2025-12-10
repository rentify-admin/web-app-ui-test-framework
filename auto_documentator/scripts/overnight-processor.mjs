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
import { execSync } from 'child_process';
import OpenAI from 'openai';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AI_PROMPT_FILE = path.join(__dirname, '../prompts/test-analyzer-prompt.md');
const OUTPUT_DIR = path.join(__dirname, '../../documentation');

const batchNumber = parseInt(process.argv[2]) || 0;

// TOP PERFORMING PROVIDERS ONLY (100% success rate)
const PROVIDERS = [
    { name: 'OR-Llama-70B', apiKey: process.env.AI_API_KEY_5, type: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free' },
    { name: 'OR-Gemma-27B', apiKey: process.env.AI_API_KEY_5, type: 'openrouter', model: 'google/gemma-3-27b-it:free' }
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
 * Find file by basename if it doesn't exist at original path
 */
function findFileByBasename(originalPath) {
    const basename = path.basename(originalPath);
    
    try {
        const output = execSync(`find tests -name "${basename}" -type f`, {
            cwd: path.join(__dirname, '../..'),
            encoding: 'utf-8'
        });
        
        const matches = output.split('\n').filter(f => f.trim());
        
        if (matches.length === 0) {
            return null;
        }
        
        if (matches.length === 1) {
            return matches[0];
        }
        
        // Multiple matches - prefer the one that's different from original
        const originalBasenameDir = path.dirname(originalPath);
        const differentMatch = matches.find(m => path.dirname(m) !== originalBasenameDir);
        
        return differentMatch || matches[0];
    } catch (error) {
        return null;
    }
}

/**
 * Analyze test with test-case awareness
 * Returns: { aiResult, actualPath } or null
 */
async function analyzeTest(testFilePath) {
    const fileName = path.basename(testFilePath);
    
    // Resolve file path and check existence
    const fullPath = path.isAbsolute(testFilePath)
        ? testFilePath
        : path.join(__dirname, '../..', testFilePath);
    
    let actualPath = fullPath;
    let actualTestFile = testFilePath;
    
    if (!fs.existsSync(fullPath)) {
        console.log(`   ⚠️  File not found at original path, searching...`);
        const foundPath = findFileByBasename(testFilePath);
        
        if (foundPath) {
            actualPath = path.join(__dirname, '../..', foundPath);
            actualTestFile = foundPath;
            console.log(`   ✅ Found file at: ${foundPath}`);
        } else {
            throw new Error(`File not found: ${testFilePath}`);
        }
    }
    
    const testContent = fs.readFileSync(actualPath, 'utf-8');
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
        const aiResult = await callAI(systemPrompt, userPrompt);
        console.log(`   ✅ Success with ${PROVIDER.name}`);
        return { aiResult, actualPath: actualTestFile };
    } catch (error) {
        console.log(`   ❌ Failed: ${error.message?.substring(0, 60)}`);
        return null;
    }
}

/**
 * Generate markdown with test cases
 */
function generateMarkdown(aiResult, fileName) {
    if (!aiResult) return null;
    
    const formatArray = (arr) => arr && arr.length > 0 ? arr.map(item => `- ${item}`).join('\n') : '- {data not found}';
    const formatInline = (arr) => arr && arr.length > 0 ? arr.map(t => `\`${t}\``).join(' ') : '{data not found}';
    
    // Format test cases list
    const testCasesList = aiResult.testCases && aiResult.testCases.length > 0 
        ? aiResult.testCases.map((tc, i) => {
            const tags = tc.tags && tc.tags.length > 0 ? ` | Tags: ${tc.tags.map(t => `\`${t}\``).join(' ')}` : '';
            return `${i + 1}. **${tc.name}**${tags}\n   - ${tc.description || 'Test case description'}`;
          }).join('\n')
        : '- {test cases not found}';
    
    const stepsTable = aiResult.stepsAndVerifications?.map(s => 
        `| **${s.step}** | ${s.action || '{data not found}'} | ${s.verification || '{data not found}'} |`
    ).join('\n') || '| {data not found} | {data not found} | {data not found} |';
    
    return `
## 🧪 \`${fileName}\` → \`${aiResult.testTitle || '{data not found}'}\`

**Summary:** ${aiResult.summary || '{data not found}'}

**File Tags:** ${formatInline(aiResult.tags)}

### 📋 Test Cases in this File

${testCasesList}

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
    const testsFile = path.join(__dirname, '../../documentation/tests-to-process.txt');
    
    // If tests-to-process.txt exists, use it (change detection mode)
    if (fs.existsSync(testsFile)) {
        const allTests = fs.readFileSync(testsFile, 'utf-8').split('\n').filter(f => f.trim());
        
        console.log(`📋 Processing from change detection: ${allTests.length} total tests`);
        
        // Distribute: each batch gets every Nth test where N = number of providers
        const myTests = [];
        for (let i = batchNumber; i < allTests.length; i += PROVIDERS.length) {
            myTests.push(allTests[i]);
        }
        
        return myTests;
    }
    
    // Fallback: find all tests (first run or manual trigger)
    const output = execSync('find tests -name "*.spec.js" -o -name "*.test.js"', {
        cwd: path.join(__dirname, '../..'),
        encoding: 'utf-8'
    });
    
    const allTests = output.split('\n').filter(f => f.trim()).sort();
    
    console.log(`📂 Processing all tests: ${allTests.length} total`);
    
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
        
        try {
            const result = await analyzeTest(testFile);
            
            if (result && result.aiResult) {
                // Use actual path if file was found in different location
                const actualPath = result.actualPath || testFile;
                results.push({
                    fileName: path.basename(actualPath),
                    filePath: actualPath, // Actual path used (may differ if file was moved)
                    aiResult: result.aiResult,
                    markdown: generateMarkdown(result.aiResult, path.basename(actualPath))
                });
                successful++;
            } else {
                failed++;
            }
        } catch (error) {
            // File not found (even after search) - skip this test
            console.log(`   ❌ Skipping: ${error.message}`);
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

