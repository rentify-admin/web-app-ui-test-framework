#!/usr/bin/env node
/**
 * Update Coda Documentation using QODO CLI
 * 
 * Uses the QODO CLI to analyze test files and generate structured documentation,
 * then outputs the documentation (since Coda API doesn't support content updates).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TESTS_DIR = path.join(__dirname, '../tests');
const TEMPLATE_FILE = path.join(__dirname, '../documentation/TEST_DOCUMENTATION_TEMPLATE.md');
const QODO_PROMPT_FILE = path.join(__dirname, 'qodo-prompt-template.md');
const OUTPUT_DIR = path.join(__dirname, '../documentation');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'QODO_GENERATED_DOCUMENTATION.md');

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
 * Use QODO CLI to analyze a test file
 */
async function analyzeTestWithQodoCLI(testFilePath) {
    try {
        const fileName = path.basename(testFilePath);
        const promptTemplate = fs.readFileSync(QODO_PROMPT_FILE, 'utf-8');
        
        console.log(`   🤖 Analyzing ${fileName} with QODO CLI...`);
        
        // Create a temporary prompt file
        const tempPromptFile = path.join(__dirname, '.temp-qodo-prompt.txt');
        fs.writeFileSync(tempPromptFile, promptTemplate);
        
        // Use QODO CLI to analyze the test file
        // qodo analyze command with custom prompt
        const command = `qodo analyze "${testFilePath}" --prompt-file "${tempPromptFile}" --format json`;
        
        try {
            const { stdout, stderr } = await execPromise(command, {
                timeout: 60000,
                maxBuffer: 1024 * 1024 * 10 // 10MB buffer
            });
            
            if (stderr) {
                console.log(`   ⚠️  QODO stderr:`, stderr);
            }
            
            // Parse JSON response
            let result;
            try {
                result = JSON.parse(stdout);
            } catch (parseError) {
                // Try to extract JSON from output
                const jsonMatch = stdout.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    result = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error(`Could not parse QODO output: ${stdout.substring(0, 500)}`);
                }
            }
            
            console.log(`   ✅ QODO analysis completed for ${fileName}`);
            
            // Clean up temp file
            if (fs.existsSync(tempPromptFile)) {
                fs.unlinkSync(tempPromptFile);
            }
            
            return result;
            
        } catch (execError) {
            console.log(`   ⚠️  QODO CLI command failed:`, execError.message);
            
            // Clean up temp file
            if (fs.existsSync(tempPromptFile)) {
                fs.unlinkSync(tempPromptFile);
            }
            
            // If QODO CLI doesn't work, return null
            return null;
        }
        
    } catch (error) {
        console.error(`   ❌ Error analyzing ${path.basename(testFilePath)}:`, error.message);
        return null;
    }
}

/**
 * Generate documentation entry from QODO result
 */
function generateEntryFromQodo(qodoResult, fileName, filePath) {
    if (!qodoResult || !qodoResult.tests || qodoResult.tests.length === 0) {
        return null;
    }
    
    const entries = [];
    const timestamp = new Date().toISOString();
    
    for (const test of qodoResult.tests) {
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
    
    return entries.join('\n\n');
}

/**
 * Main function
 */
async function main() {
    console.log('📚 Starting QODO-powered documentation generation...');
    
    // Find all test files
    const testFiles = findTestFiles(TESTS_DIR);
    console.log(`✅ Found ${testFiles.length} test files`);
    
    const stats = {
        processed: 0,
        succeeded: 0,
        failed: 0,
        totalEntries: 0
    };
    
    const allEntries = [];
    
    // Process each test file with QODO CLI
    for (const testFile of testFiles) {
        try {
            const fileName = path.basename(testFile);
            const filePath = path.relative(TESTS_DIR, testFile);
            
            console.log(`\n📄 Processing: ${fileName}`);
            stats.processed++;
            
            // Analyze with QODO CLI
            const qodoResult = await analyzeTestWithQodoCLI(testFile);
            
            if (qodoResult) {
                const entry = generateEntryFromQodo(qodoResult, fileName, filePath);
                if (entry) {
                    allEntries.push(entry);
                    stats.succeeded++;
                    stats.totalEntries += (qodoResult.tests || []).length;
                } else {
                    console.log(`   ⚠️  No documentation generated for ${fileName}`);
                }
            } else {
                console.log(`   ⚠️  QODO analysis failed for ${fileName}`);
                stats.failed++;
            }
            
        } catch (error) {
            console.error(`❌ Error processing ${testFile}:`, error.message);
            stats.failed++;
        }
    }
    
    // Generate final documentation
    const header = `# 📚 Test Documentation (QODO-Generated)

> **Auto-generated:** ${new Date().toISOString()}  
> **Total Tests:** ${stats.totalEntries}  
> **Generated by:** QODO AI

---

## 📊 Generation Statistics

| Metric | Value |
|--------|-------|
| **Files Processed** | ${stats.processed} |
| **Successful Analyses** | ${stats.succeeded} |
| **Failed Analyses** | ${stats.failed} |
| **Total Test Entries** | ${stats.totalEntries} |

---

`;
    
    const footer = `\n\n---\n\n**Last Updated:** ${new Date().toLocaleString('en-US', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} UTC (\`${new Date().toISOString()}\`)\n`;
    
    const fullContent = header + allEntries.join('\n\n') + footer;
    
    // Write to output file
    fs.writeFileSync(OUTPUT_FILE, fullContent, 'utf-8');
    
    console.log('\n✅ Documentation generated successfully');
    console.log(`   Output: ${OUTPUT_FILE}`);
    console.log(`   Total entries: ${stats.totalEntries}`);
    
    // Output statistics for workflow
    console.log('\n##QODO_STATS_START##');
    console.log(`FILES_PROCESSED:${stats.processed}`);
    console.log(`SUCCEEDED:${stats.succeeded}`);
    console.log(`FAILED:${stats.failed}`);
    console.log(`TOTAL_ENTRIES:${stats.totalEntries}`);
    console.log('##QODO_STATS_END##');
    
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

