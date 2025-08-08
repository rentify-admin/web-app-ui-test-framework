#!/usr/bin/env node

/**
 * TestRail Case Synchronization Script
 * 
 * This script reads all Playwright test files and syncs them with TestRail
 * using TRCLI. It will:
 * 1. Parse all test files in the tests/ directory
 * 2. Extract test names, tags, and case IDs
 * 3. Check if cases exist in TestRail Master suite
 * 4. Create missing cases using TRCLI
 * 5. Update existing cases with proper tags
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration
const TESTS_DIR = './tests';
const TESTRAIL_HOST = process.env.TESTRAIL_HOST;
const TESTRAIL_USER = process.env.TESTRAIL_USER;
const TESTRAIL_API_KEY = process.env.TESTRAIL_API_KEY;
const TESTRAIL_PROJECT_ID = process.env.TESTRAIL_PROJECT_ID || '1';
const TESTRAIL_SUITE_ID = process.env.TESTRAIL_SUITE_ID || '1'; // Master suite

// TestRail API configuration
const testrailApi = axios.create({
    baseURL: `${TESTRAIL_HOST}/index.php?/api/v2/`,
    auth: {
        username: TESTRAIL_USER,
        password: TESTRAIL_API_KEY
    },
    headers: {
        'Content-Type': 'application/json'
    }
});

// Validate environment variables
if (!TESTRAIL_HOST || !TESTRAIL_USER || !TESTRAIL_API_KEY) {
    console.error('❌ Missing required environment variables:');
    console.error('   TESTRAIL_HOST, TESTRAIL_USER, TESTRAIL_API_KEY');
    console.error('   Please check your .env file or environment variables.');
    process.exit(1);
}

/**
 * Extract case ID from test name
 * @param {string} testName - Test name
 * @returns {string|null} Case ID if found
 */
function extractCaseId(testName) {
    // Pattern: C42 - Description
    const match = testName.match(/^(C\d+)\s*-\s*(.*)/);
    return match ? match[1] : null;
}

/**
 * Extract tags from test configuration
 * @param {string} fileContent - File content
 * @param {number} lineNumber - Line number where test starts
 * @returns {string[]} Array of tags
 */
function extractTags(fileContent, lineNumber) {
    const lines = fileContent.split('\n');
    const tagLine = lines[lineNumber];
    
    if (tagLine && tagLine.includes('tag:')) {
        // Extract tags from tag: ['@core', '@smoke', '@regression']
        const tagMatch = tagLine.match(/tag:\s*\[(.*?)\]/);
        if (tagMatch) {
            return tagMatch[1]
                .split(',')
                .map(tag => tag.trim().replace(/['"]/g, ''))
                .filter(tag => tag.startsWith('@'));
        }
    }
    
    return [];
}

/**
 * Parse test files and extract test information
 * @returns {Array} Array of test objects
 */
function parseTestFiles() {
    const tests = [];
    
    if (!fs.existsSync(TESTS_DIR)) {
        console.error(`❌ Tests directory not found: ${TESTS_DIR}`);
        process.exit(1);
    }
    
    const testFiles = fs.readdirSync(TESTS_DIR)
        .filter(file => file.endsWith('.spec.js'))
        .map(file => path.join(TESTS_DIR, file));
    
    console.log(`📁 Found ${testFiles.length} test files`);
    
    for (const filePath of testFiles) {
        const fileName = path.basename(filePath);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const lines = fileContent.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Look for test declarations
            if (line.includes('test(') && line.includes("'")) {
                // Extract test name
                const nameMatch = line.match(/test\s*\(\s*['"`]([^'"`]+)['"`]/);
                if (nameMatch) {
                    const testName = nameMatch[1];
                    const caseId = extractCaseId(testName);
                    const tags = extractTags(fileContent, i + 1); // Next line usually has tags
                    
                    tests.push({
                        name: testName,
                        caseId: caseId,
                        tags: tags,
                        file: fileName,
                        line: i + 1
                    });
                }
            }
        }
    }
    
    return tests;
}

/**
 * Get existing cases from TestRail using API
 * @returns {Array} Array of existing case objects
 */
async function getExistingCases() {
    try {
        console.log('🔍 Fetching existing cases from TestRail...');
        
        let allCases = [];
        let offset = 0;
        const limit = 250;
        
        while (true) {
            const response = await testrailApi.get(`/get_cases/${TESTRAIL_PROJECT_ID}`, {
                params: {
                    suite_id: TESTRAIL_SUITE_ID,
                    limit: limit,
                    offset: offset
                }
            });
            
            const cases = response.data.cases || [];
            allCases.push(...cases);
            
            if (cases.length < limit) {
                break;
            }
            
            offset += limit;
        }
        
        console.log(`✅ Found ${allCases.length} existing cases in TestRail`);
        return allCases;
        
    } catch (error) {
        console.error('❌ Error fetching existing cases:', error.response?.data || error.message);
        return [];
    }
}

/**
 * Create a new case in TestRail using API
 * @param {Object} test - Test object
 * @returns {boolean} Success status
 */
async function createCase(test) {
    try {
        console.log(`📝 Creating case: ${test.name}`);
        
        // Prepare case data
        const caseData = {
            title: test.name,
            type_id: 1, // Functional
            priority_id: 2, // Medium
            custom_automation_id: test.caseId || `AUTO_${Date.now()}`,
            custom_tags: test.tags.join(','),
            custom_description: `Automatically created from Playwright test\nFile: ${test.file}\nLine: ${test.line}\nTags: ${test.tags.join(', ')}`
        };
        
        // Create case using TestRail API
        const response = await testrailApi.post(`/add_case/${TESTRAIL_SUITE_ID}`, caseData);
        
        console.log(`✅ Created case: ${test.name} (ID: ${response.data.id})`);
        return true;
        
    } catch (error) {
        console.error(`❌ Error creating case ${test.name}:`, error.response?.data || error.message);
        return false;
    }
}

/**
 * Update existing case with new tags
 * @param {Object} existingCase - Existing case from TestRail
 * @param {Object} test - Test object
 * @returns {boolean} Success status
 */
async function updateCase(existingCase, test) {
    try {
        console.log(`🔄 Updating case: ${test.name}`);
        
        // Merge existing tags with new tags
        const existingTags = existingCase.custom_tags ? existingCase.custom_tags.split(',') : [];
        const newTags = test.tags.filter(tag => !existingTags.includes(tag));
        
        if (newTags.length === 0) {
            console.log(`ℹ️  Case ${test.name} already has all tags`);
            return true;
        }
        
        const updatedTags = [...existingTags, ...newTags].join(',');
        
        // Update case using TestRail API
        const updateData = {
            custom_tags: updatedTags
        };
        
        // If case doesn't have automation_id, add it
        if (!existingCase.custom_automation_id && test.caseId) {
            updateData.custom_automation_id = test.caseId;
        }
        
        await testrailApi.post(`/update_case/${existingCase.id}`, updateData);
        
        console.log(`✅ Updated case: ${test.name} with tags: ${newTags.join(', ')}`);
        return true;
        
    } catch (error) {
        console.error(`❌ Error updating case ${test.name}:`, error.response?.data || error.message);
        return false;
    }
}

/**
 * Main synchronization function
 */
async function syncTestCases() {
    console.log('🚀 Starting TestRail case synchronization...\n');
    
    // Parse test files
    const tests = parseTestFiles();
    console.log(`📊 Found ${tests.length} tests in files\n`);
    
    // Get existing cases from TestRail
    const existingCases = await getExistingCases();
    
    // Create maps for quick lookup
    const casesByTitle = new Map();
    const casesByAutomationId = new Map();
    
    if (Array.isArray(existingCases)) {
        existingCases.forEach(case_ => {
            casesByTitle.set(case_.title, case_);
            if (case_.custom_automation_id) {
                casesByAutomationId.set(case_.custom_automation_id, case_);
            }
        });
    }
    
    // Process each test
    let created = 0;
    let updated = 0;
    let skipped = 0;
    
    console.log('🔄 Processing tests...\n');
    
    for (const test of tests) {
        // Skip tests without tags
        if (test.tags.length === 0) {
            console.log(`⚠️  Skipping test without tags: ${test.name}`);
            skipped++;
            continue;
        }
        
        let existingCase = null;
        
        // Try to find by automation ID first
        if (test.caseId) {
            existingCase = casesByAutomationId.get(test.caseId);
        }
        
        // Fallback to title matching
        if (!existingCase) {
            existingCase = casesByTitle.get(test.name);
        }
        
        if (existingCase) {
            // Update existing case
            if (await updateCase(existingCase, test)) {
                updated++;
            }
        } else {
            // Create new case
            if (await createCase(test)) {
                created++;
            }
        }
    }
    
    // Summary
    console.log('\n📈 Synchronization Summary:');
    console.log(`   ✅ Created: ${created} cases`);
    console.log(`   🔄 Updated: ${updated} cases`);
    console.log(`   ⏭️  Skipped: ${skipped} cases`);
    console.log(`   📊 Total processed: ${tests.length} tests`);
    
    if (created > 0 || updated > 0) {
        console.log('\n🎉 Synchronization completed successfully!');
    } else {
        console.log('\nℹ️  No changes needed - all cases are up to date.');
    }
}

/**
 * Display test summary
 */
function displayTestSummary() {
    const tests = parseTestFiles();
    
    console.log('📊 Test Summary:');
    console.log(`   Total tests: ${tests.length}`);
    
    const tagCounts = {};
    const caseIdCounts = {};
    
    tests.forEach(test => {
        test.tags.forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
        
        if (test.caseId) {
            caseIdCounts[test.caseId] = (caseIdCounts[test.caseId] || 0) + 1;
        }
    });
    
    console.log('\n🏷️  Tag distribution:');
    Object.entries(tagCounts).forEach(([tag, count]) => {
        console.log(`   ${tag}: ${count} tests`);
    });
    
    console.log('\n🆔 Case ID distribution:');
    Object.entries(caseIdCounts).forEach(([caseId, count]) => {
        console.log(`   ${caseId}: ${count} tests`);
    });
    
    const testsWithoutCaseId = tests.filter(test => !test.caseId).length;
    console.log(`   Tests without Case ID: ${testsWithoutCaseId}`);
}

// Command line argument handling
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    console.log(`
TestRail Case Synchronization Script

Usage: node sync-testrail-cases.js [options]

Options:
  --summary, -s    Show test summary only (no sync)
  --help, -h       Show this help message

Environment Variables:
  TESTRAIL_HOST           TestRail instance URL
  TESTRAIL_USER           TestRail username
  TESTRAIL_API_KEY        TestRail API key
  TESTRAIL_PROJECT_ID     TestRail project ID (default: 1)
  TESTRAIL_SUITE_ID       TestRail suite ID (default: 1)

Examples:
  node sync-testrail-cases.js              # Sync all cases
  node sync-testrail-cases.js --summary    # Show summary only
`);
    process.exit(0);
}

if (args.includes('--summary') || args.includes('-s')) {
    displayTestSummary();
} else {
    syncTestCases().catch(error => {
        console.error('❌ Synchronization failed:', error);
        process.exit(1);
    });
} 