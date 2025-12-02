#!/usr/bin/env node
/**
 * Test OpenAI API integration for test documentation
 * Tests with a single test file to verify the setup
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TESTS_DIR = path.join(__dirname, '../tests');
const QODO_PROMPT_FILE = path.join(__dirname, 'qodo-prompt-template.md');

// Get API key from environment
const OPENAI_API_KEY = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
    console.error('❌ AI_API_KEY or OPENAI_API_KEY environment variable is required');
    process.exit(1);
}

console.log('🔑 API Key found:', OPENAI_API_KEY.substring(0, 20) + '...');

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
});

async function testWithSingleFile() {
    try {
        // Use the application_create_delete_test.spec.js as test case
        const testFile = path.join(TESTS_DIR, 'application_create_delete_test.spec.js');
        
        if (!fs.existsSync(testFile)) {
            console.error(`❌ Test file not found: ${testFile}`);
            process.exit(1);
        }
        
        console.log('📄 Reading test file:', path.basename(testFile));
        const testContent = fs.readFileSync(testFile, 'utf-8');
        
        console.log('📝 Loading prompt template...');
        const promptTemplate = fs.readFileSync(QODO_PROMPT_FILE, 'utf-8');
        
        // Create the full prompt
        const fullPrompt = `${promptTemplate}

## Test File to Analyze

\`\`\`javascript
${testContent}
\`\`\`

Please analyze this test file and return ONLY the JSON structure as specified in the output format above. Do not include any markdown formatting or explanation, just the raw JSON object.`;
        
        console.log('\n🤖 Calling OpenAI API to analyze test file...');
        console.log('   Model: gpt-4o-mini');
        console.log('   Prompt length:', fullPrompt.length, 'characters');
        
        // Call OpenAI API
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'You are a test documentation expert. Analyze test files and return structured JSON documentation. Return ONLY valid JSON, no markdown formatting.'
                },
                {
                    role: 'user',
                    content: fullPrompt
                }
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' }
        });
        
        console.log('\n✅ API call successful!');
        console.log('   Response tokens:', response.usage?.total_tokens || 'N/A');
        
        // Parse the JSON response
        const content = response.choices[0].message.content;
        console.log('\n📊 Raw response content (first 500 chars):');
        console.log(content.substring(0, 500));
        
        let parsedResult;
        try {
            parsedResult = JSON.parse(content);
            console.log('\n✅ JSON parsing successful!');
            console.log('\n📋 Parsed structure:');
            console.log('   Test file:', parsedResult.testFile || 'N/A');
            console.log('   Number of tests:', parsedResult.tests?.length || 0);
            
            if (parsedResult.tests && parsedResult.tests.length > 0) {
                console.log('\n🧪 First test:');
                const firstTest = parsedResult.tests[0];
                console.log('   Test name:', firstTest.testName || 'N/A');
                console.log('   Purpose:', firstTest.purpose || 'N/A');
                console.log('   Tags:', firstTest.tags || 'N/A');
                console.log('   Test steps:', firstTest.testSteps?.length || 0);
                console.log('   API endpoints:', firstTest.apiEndpoints?.length || 0);
                console.log('   UI test IDs:', firstTest.uiTestIds?.length || 0);
            }
            
            // Save the result for inspection
            const outputFile = path.join(__dirname, 'test-openai-result.json');
            fs.writeFileSync(outputFile, JSON.stringify(parsedResult, null, 2));
            console.log('\n💾 Full result saved to:', outputFile);
            
            console.log('\n✅ Test completed successfully!');
            console.log('   The OpenAI API is working correctly.');
            console.log('   Ready to process all test files.');
            
        } catch (parseError) {
            console.error('\n❌ Failed to parse JSON:', parseError.message);
            console.error('   Raw content:', content);
            process.exit(1);
        }
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.response) {
            console.error('   Response data:', error.response.data);
        }
        console.error('   Stack:', error.stack);
        process.exit(1);
    }
}

// Run the test
testWithSingleFile();

