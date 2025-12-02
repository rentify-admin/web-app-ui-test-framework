#!/usr/bin/env node
/**
 * Test OpenAI Integration
 * Test with one test file to verify the AI analysis works
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const QODO_PROMPT_FILE = path.join(__dirname, 'qodo-prompt-template.md');
const TEST_FILE = path.join(__dirname, '../tests/application_create_delete_test.spec.js');
const AI_API_KEY = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;

if (!AI_API_KEY) {
    console.error('❌ AI_API_KEY or OPENAI_API_KEY environment variable is required');
    process.exit(1);
}

async function testAnalysis() {
    console.log('🧪 Testing OpenAI integration with one test file...\n');
    
    // Load prompt template
    const promptTemplate = fs.readFileSync(QODO_PROMPT_FILE, 'utf-8');
    const testContent = fs.readFileSync(TEST_FILE, 'utf-8');
    const fileName = path.basename(TEST_FILE);
    
    console.log(`📄 Test file: ${fileName}`);
    console.log(`📏 File size: ${testContent.length} chars\n`);
    
    // Create full prompt
    const fullPrompt = `${promptTemplate}

## Test File to Analyze

\`\`\`javascript
${testContent}
\`\`\`

Please analyze this test file and return ONLY the JSON structure as specified in the output format above. Do not include any markdown formatting or explanation, just the raw JSON object.`;
    
    console.log(`📏 Prompt size: ${fullPrompt.length} chars\n`);
    
    try {
        console.log('🤖 Calling OpenAI API...\n');
        
        const openai = new OpenAI({
            apiKey: AI_API_KEY,
        });
        
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
        
        console.log('✅ API call successful!\n');
        
        // Parse response
        const content = completion.choices[0].message.content;
        const result = JSON.parse(content);
        
        console.log('📊 Parsed Result:');
        console.log(JSON.stringify(result, null, 2));
        
        console.log('\n✅ Test successful!');
        console.log(`   Tests found: ${result.tests?.length || 0}`);
        
        if (result.tests && result.tests.length > 0) {
            const firstTest = result.tests[0];
            console.log(`\n📝 First test details:`);
            console.log(`   Name: ${firstTest.testName}`);
            console.log(`   Purpose: ${firstTest.purpose?.substring(0, 100)}...`);
            console.log(`   Test steps: ${firstTest.testSteps?.length || 0}`);
            console.log(`   API endpoints: ${firstTest.apiEndpoints?.length || 0}`);
            console.log(`   UI test IDs: ${firstTest.uiTestIds?.length || 0}`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('   API Response:', error.response.data);
        }
        process.exit(1);
    }
}

testAnalysis();

