#!/usr/bin/env node
/**
 * Update Coda Documentation using QODO API and Coda MCP tools
 * 
 * 1. Uses QODO API (OpenAI-compatible) to analyze each test file
 * 2. Generates documentation using the template
 * 3. Updates Coda page using the local MCP server tools
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import OpenAI from 'openai';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TESTS_DIR = path.join(__dirname, '../tests');
const QODO_PROMPT_FILE = path.join(__dirname, 'qodo-prompt-template.md');
const CODA_DOC_ID = process.env.CODA_DOC_ID || 'dza2s1eOIhA';
const CODA_PAGE_ID = process.env.CODA_PAGE_ID || 'suLCLolD';
const CODA_API_TOKEN = process.env.CODA_API_TOKEN;
const AI_API_KEY = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;

if (!CODA_API_TOKEN) {
    console.error('❌ CODA_API_TOKEN environment variable is required');
    process.exit(1);
}

if (!AI_API_KEY) {
    console.error('❌ AI_API_KEY or OPENAI_API_KEY environment variable is required');
    process.exit(1);
}

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: AI_API_KEY,
});

/**
 * Find all test files
 */
function findTestFiles(dir) {
    const files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            files.push(...findTestFiles(fullPath));
        } else if (entry.name.endsWith('.spec.js') || entry.name.endsWith('.test.js')) {
            files.push(fullPath);
        }
    }
    
    return files;
}

/**
 * Use AI (OpenAI) to analyze a test file
 */
async function analyzeTestWithAI(testFilePath) {
    try {
        const fileName = path.basename(testFilePath);
        const promptTemplate = fs.readFileSync(QODO_PROMPT_FILE, 'utf-8');
        const testContent = fs.readFileSync(testFilePath, 'utf-8');
        
        console.log(`   🤖 Analyzing ${fileName} with AI...`);
        
        // Create a combined prompt with the test content
        const fullPrompt = `${promptTemplate}

## Test File to Analyze

\`\`\`javascript
${testContent}
\`\`\`

Please analyze this test file and return ONLY the JSON structure as specified in the output format above. Do not include any markdown formatting or explanation, just the raw JSON object.`;
        
        try {
            // Call OpenAI API using the SDK
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "You are a test documentation expert. Analyze test files and return structured JSON documentation. Return ONLY valid JSON, no markdown formatting or explanations."
                    },
                    {
                        role: "user",
                        content: fullPrompt
                    }
                ],
                temperature: 0.1,
                response_format: { type: "json_object" }
            });
            
            // Extract JSON from response
            const content = completion.choices[0].message.content;
            const result = JSON.parse(content);
            
            console.log(`   ✅ AI analysis completed for ${fileName}`);
            console.log(`   Found ${result.tests?.length || 0} test(s)`);
            
            return result;
            
        } catch (apiError) {
            console.log(`   ⚠️  AI API failed:`, apiError.message);
            return null;
        }
        
    } catch (error) {
        console.error(`   ❌ Error with AI for ${path.basename(testFilePath)}:`, error.message);
        return null;
    }
}

/**
 * Generate documentation entry from QODO result
 */
function generateEntryFromQodo(qodoResult, fileName, filePath) {
    if (!qodoResult || !qodoResult.tests || qodoResult.tests.length === 0) {
        return [];
    }
    
    const entries = [];
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
    
    for (const test of qodoResult.tests) {
        const testId = test.testId || fileName.replace('.spec.js', '');
        
        // Format test steps
        const testStepsRows = test.testSteps && test.testSteps.length > 0
            ? test.testSteps.map(step => 
                `| **${step.stepNumber}. ${step.stepName}** | ${step.action || 'N/A'} | ${step.input || 'N/A'} | ${step.expectedResult || 'N/A'} | ${step.apiCalls && step.apiCalls.length > 0 ? step.apiCalls.map(c => `\`${c}\``).join(', ') : 'N/A'} | ${step.uiElements && step.uiElements.length > 0 ? step.uiElements.map(e => `\`${e}\``).join(', ') : 'N/A'} |`
            ).join('\n')
            : '| N/A | N/A | N/A | N/A | N/A | N/A |';
        
        const entry = `### 🧪 \`${fileName}\` → \`${test.testName}\`

| Field | Value |
|-------|-------|
| **Test ID** | \`${testId}\` |
| **Test File** | \`${filePath}\` |
| **Last Updated** | \`${timestamp}\` |
| **Status** | \`active\` |

---

## 📋 Test Scenario

> **Purpose:** ${test.purpose || 'N/A'}

> **Business Context:** ${test.businessContext || 'N/A'}

### Test Conditions

| Condition | Value |
|-----------|-------|
| **Application** | \`${test.application || 'N/A'}\` |
| **User Role** | ${test.userRole ? `\`${test.userRole}\`` : 'N/A'} |
| **Environment** | \`${test.environment || 'staging|production'}\` |
| **Prerequisites** | ${test.prerequisites && test.prerequisites.length > 0 ? test.prerequisites.join(', ') : 'N/A'} |
| **Test Data Setup** | ${test.testDataSetup || 'N/A'} |

### Test Data Used

| Data Type | Details |
|-----------|---------|
| **Users** | ${test.users && test.users.length > 0 ? test.users.join(', ') : 'N/A'} |
| **Sessions** | ${test.sessions || 'N/A'} |
| **Applications** | ${test.applications || 'N/A'} |
| **Mock Data** | ${test.mockData && test.mockData.length > 0 ? test.mockData.join(', ') : 'N/A'} |
| **API Payloads** | ${test.apiPayloads && test.apiPayloads.length > 0 ? test.apiPayloads.join(', ') : 'N/A'} |

### Expected Outcomes

${test.expectedOutcomes && test.expectedOutcomes.length > 0 ? test.expectedOutcomes.map(o => `- ✅ ${o}`).join('\n') : '- ✅ N/A'}

---

## 📝 Test Case

### Test Steps

| Step | Action | Input | Expected Result | API Calls | UI Elements |
|------|--------|-------|-----------------|-----------|-------------|
${testStepsRows}

### Validation Points

${test.validationPoints && test.validationPoints.length > 0 ? test.validationPoints.map(v => `- ✅ ${v}`).join('\n') : '- ✅ N/A'}

### Cleanup

${test.cleanup && test.cleanup.length > 0 ? test.cleanup.map(c => `- 🗑️ ${c}`).join('\n') : 'N/A'}

### API Endpoints Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
${test.apiEndpoints && test.apiEndpoints.length > 0 ? test.apiEndpoints.map(ep => `| \`${ep.method}\` | \`${ep.endpoint}\` | ${ep.purpose || 'N/A'} |`).join('\n') : '| N/A | N/A | N/A |'}

### UI Test IDs Used

| Test ID | Purpose |
|---------|---------|
${test.uiTestIds && test.uiTestIds.length > 0 ? test.uiTestIds.map(ui => `| \`${typeof ui === 'object' ? ui.testId : ui}\` | ${typeof ui === 'object' && ui.purpose ? ui.purpose : 'N/A'} |`).join('\n') : '| N/A | N/A |'}

### Tags

${test.tags && test.tags.length > 0 ? test.tags.map(t => `\`${t}\``).join(' ') : '\`N/A\`'}

### Dependencies

${test.dependencies && test.dependencies.length > 0 ? test.dependencies.map(d => `- 📦 \`${d}\``).join('\n') : '- 📦 N/A'}

### Known Issues/Limitations

⚠️ ${test.knownIssues || 'None documented'}

### Related Tests

${test.relatedTests && test.relatedTests.length > 0 ? test.relatedTests.map(t => `- 🔗 \`${t}\``).join('\n') : '- 🔗 N/A'}

---

**Last Updated:** ${humanReadableTime} UTC (\`${timestamp}\`)

---
`;
        
        entries.push(entry);
    }
    
    return entries;
}

/**
 * Update Coda page using Coda API with contentUpdate
 */
async function updateCodaPage(content) {
    try {
        console.log('\n📤 Updating Coda page using Coda API...');
        
        // Use the Coda API contentUpdate feature (from the web search results)
        const response = await axios.put(
            `https://coda.io/apis/v1/docs/${CODA_DOC_ID}/pages/${CODA_PAGE_ID}`,
            {
                contentUpdate: {
                    insertionMode: 'replace',
                    canvasContent: {
                        format: 'markdown',
                        content: content
                    }
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${CODA_API_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            }
        );
        
        console.log(`   ✅ Coda page updated successfully`);
        console.log(`   Response status: ${response.status}`);
        
        return true;
        
    } catch (error) {
        console.error(`   ❌ Coda API error:`, error.response?.data || error.message);
        
        // If API update fails, save documentation locally
        const outputFile = path.join(__dirname, '../documentation/AI_GENERATED_FOR_CODA.md');
        fs.writeFileSync(outputFile, content, 'utf-8');
        console.log(`   📄 Documentation saved to: ${outputFile}`);
        console.log(`   💡 Please update Coda manually`);
        
        // Return false but don't throw - we still generated the documentation
        return false;
    }
}

/**
 * Main function
 */
async function main() {
    console.log('📚 Starting documentation generation with OpenAI + Coda...');
    
    // Initialize OpenAI client
    const openaiClient = new OpenAI({
        apiKey: OPENAI_API_KEY,
    });
    
    // Find all test files
    const testFiles = findTestFiles(TESTS_DIR);
    console.log(`✅ Found ${testFiles.length} test files`);
    
    const stats = {
        new: 0,
        updated: 0,
        errors: 0
    };
    
    const allEntries = [];
    
    // Process each test file with OpenAI
    for (const testFile of testFiles) {
        try {
            const fileName = path.basename(testFile);
            const filePath = path.relative(TESTS_DIR, testFile);
            
            console.log(`\n📄 Processing: ${fileName}`);
            
            // Analyze with AI (OpenAI)
            const qodoResult = await analyzeTestWithAI(testFile, openaiClient);
            
            if (qodoResult && qodoResult.tests && qodoResult.tests.length > 0) {
                const entries = generateEntryFromQodo(qodoResult, fileName, filePath);
                allEntries.push(...entries);
                stats.new += entries.length;
                console.log(`   ✅ Generated ${entries.length} entry/entries`);
            } else {
                console.log(`   ⚠️  No tests found in QODO result for ${fileName}`);
                stats.errors++;
            }
            
        } catch (error) {
            console.error(`❌ Error processing ${testFile}:`, error.message);
            stats.errors++;
        }
    }
    
    // Build final content
    const header = `# 📚 Automated Test Documentation

> **Auto-generated:** ${new Date().toISOString()}  
> **Total Tests:** ${allEntries.length}  
> **Generated by:** QODO AI + Coda MCP

---

## 📊 Documentation Statistics

| Metric | Value |
|--------|-------|
| **Total Tests Documented** | ${allEntries.length} |
| **New Entries** | ${stats.new} |
| **Errors** | ${stats.errors} |
| **Last Generated** | ${new Date().toISOString()} |

---

## 🧪 Test Entries

*All test documentation entries are listed below. Each entry was analyzed by QODO AI and follows the standardized template format.*

---

`;
    
    const footer = `\n\n---\n\n**Last Updated:** ${new Date().toLocaleString('en-US', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} UTC (\`${new Date().toISOString()}\`)\n`;
    
    const fullContent = header + allEntries.join('\n\n') + footer;
    
    // Update Coda page using Coda API
    await updateCodaPage(fullContent);
    
    // Output statistics for workflow
    console.log('\n📊 Update Statistics:');
    console.log(`   - New entries: ${stats.new}`);
    console.log(`   - Updated entries: ${stats.updated}`);
    console.log(`   - Total entries: ${allEntries.length}`);
    console.log(`   - Errors: ${stats.errors}`);
    
    // Output structured stats for workflow parsing
    console.log('\n##STATS_START##');
    console.log(`NEW_ENTRIES:${stats.new}`);
    console.log(`UPDATED_ENTRIES:${stats.updated}`);
    console.log(`TOTAL_ENTRIES:${allEntries.length}`);
    console.log(`ERRORS:${stats.errors}`);
    console.log('##STATS_END##');
    
    return stats;
}

// Check if this is the main module
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     import.meta.url.endsWith(process.argv[1]) ||
                     process.argv[1] && import.meta.url.includes(process.argv[1].replace(/\\/g, '/'));

if (isMainModule || import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('❌ Error:', error);
        console.error('Stack:', error.stack);
        process.exit(1);
    });
}

export { main };

