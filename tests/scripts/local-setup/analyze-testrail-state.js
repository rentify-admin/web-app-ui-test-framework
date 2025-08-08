#!/usr/bin/env node

import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const TESTRAIL_HOST = process.env.TESTRAIL_HOST;
const TESTRAIL_PROJECT_ID = process.env.TESTRAIL_PROJECT_ID;
const TESTRAIL_SUITE_ID = process.env.TESTRAIL_SUITE_ID;
const TESTRAIL_USER = process.env.TESTRAIL_USER;
const TESTRAIL_API_KEY = process.env.TESTRAIL_API_KEY;

if (!TESTRAIL_HOST || !TESTRAIL_PROJECT_ID || !TESTRAIL_USER || !TESTRAIL_API_KEY || !TESTRAIL_SUITE_ID) {
    console.error('❌ Missing TestRail environment variables');
    process.exit(1);
}

const testrail = axios.create({
    baseURL: `${TESTRAIL_HOST}/index.php?/api/v2/`,
    auth: {
        username: TESTRAIL_USER,
        password: TESTRAIL_API_KEY,
    },
});

function printSection(title) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 ${title}`);
    console.log(`${'='.repeat(60)}`);
}

function printSubSection(title) {
    console.log(`\n📋 ${title}`);
    console.log(`${'-'.repeat(40)}`);
}

async function analyzeTestRailState() {
    printSection('TestRail State Analysis');
    
    try {
        // Get all cases from the Master suite
        printSubSection('Fetching Test Cases from Master Suite');
        const response = await testrail.get(`get_cases/${TESTRAIL_PROJECT_ID}&suite_id=${TESTRAIL_SUITE_ID}`);
        const cases = response.data.cases || [];
        
        console.log(`✅ Found ${cases.length} test cases in Master suite`);
        
        // Analyze case structure
        printSubSection('Case Structure Analysis');
        if (cases.length > 0) {
            const sampleCase = cases[0];
            console.log('Sample case structure:');
            console.log(JSON.stringify(sampleCase, null, 2));
        }
        
        // Analyze titles and potential matching issues
        printSubSection('Title Analysis');
        const titles = cases.map(tc => tc.title);
        const titleLengths = titles.map(title => title.length);
        
        console.log(`Title length statistics:`);
        console.log(`  - Shortest: ${Math.min(...titleLengths)} characters`);
        console.log(`  - Longest: ${Math.max(...titleLengths)} characters`);
        console.log(`  - Average: ${Math.round(titleLengths.reduce((a, b) => a + b, 0) / titleLengths.length)} characters`);
        
        // Find potential duplicate titles
        const titleCounts = {};
        titles.forEach(title => {
            titleCounts[title] = (titleCounts[title] || 0) + 1;
        });
        
        const duplicates = Object.entries(titleCounts).filter(([title, count]) => count > 1);
        if (duplicates.length > 0) {
            console.log(`⚠️  Found ${duplicates.length} duplicate titles:`);
            duplicates.forEach(([title, count]) => {
                console.log(`  - "${title}" (${count} times)`);
            });
        } else {
            console.log(`✅ No duplicate titles found`);
        }
        
        // Analyze custom fields
        printSubSection('Custom Fields Analysis');
        const customFields = new Set();
        cases.forEach(tc => {
            Object.keys(tc).forEach(key => {
                if (key.startsWith('custom_')) {
                    customFields.add(key);
                }
            });
        });
        
        console.log(`Custom fields found: ${Array.from(customFields).join(', ')}`);
        
        // Check for automation_id field
        const hasAutomationId = cases.some(tc => tc.custom_automation_id);
        console.log(`Has custom_automation_id: ${hasAutomationId ? '✅ Yes' : '❌ No'}`);
        
        // Check for custom_tags field
        const hasCustomTags = cases.some(tc => tc.custom_tags);
        console.log(`Has custom_tags: ${hasCustomTags ? '✅ Yes' : '❌ No'}`);
        
        // Analyze tags
        printSubSection('Tag Analysis');
        const allTags = new Set();
        cases.forEach(tc => {
            if (tc.custom_tags) {
                const tags = tc.custom_tags.split(',').map(tag => tag.trim());
                tags.forEach(tag => allTags.add(tag));
            }
        });
        
        console.log(`All tags found: ${Array.from(allTags).join(', ')}`);
        
        // Count cases by tag
        const tagCounts = {};
        cases.forEach(tc => {
            if (tc.custom_tags) {
                const tags = tc.custom_tags.split(',').map(tag => tag.trim());
                tags.forEach(tag => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                });
            }
        });
        
        console.log(`Cases per tag:`);
        Object.entries(tagCounts).forEach(([tag, count]) => {
            console.log(`  - @${tag}: ${count} cases`);
        });
        
        // Find cases without tags
        const untaggedCases = cases.filter(tc => !tc.custom_tags || tc.custom_tags.trim() === '');
        console.log(`Cases without tags: ${untaggedCases.length}`);
        
        if (untaggedCases.length > 0) {
            console.log(`Sample untagged cases:`);
            untaggedCases.slice(0, 5).forEach(tc => {
                console.log(`  - ID ${tc.id}: "${tc.title}"`);
            });
        }
        
        // Analyze recent plans/runs
        printSubSection('Recent Plans Analysis');
        try {
            const plansResponse = await testrail.get(`get_plans/${TESTRAIL_PROJECT_ID}`);
            const plans = plansResponse.data.plans || [];
            
            console.log(`Found ${plans.length} total plans`);
            
            // Get recent plans (last 10)
            const recentPlans = plans.slice(0, 10);
            console.log(`Recent plans:`);
            
            for (const plan of recentPlans) {
                console.log(`  - Plan ${plan.id}: "${plan.name}" (${plan.created_on})`);
                
                // Get plan details
                try {
                    const planDetails = await testrail.get(`get_plan/${plan.id}`);
                    const entries = planDetails.data.entries || [];
                    
                    for (const entry of entries) {
                        const runs = entry.runs || [];
                        for (const run of runs) {
                            console.log(`    └─ Run ${run.id}: "${run.name}" (include_all: ${run.include_all}, cases: ${run.case_ids ? run.case_ids.length : 'all'})`);
                        }
                    }
                } catch (err) {
                    console.log(`    └─ Error getting plan details: ${err.message}`);
                }
            }
        } catch (err) {
            console.log(`Error fetching plans: ${err.message}`);
        }
        
        printSection('Analysis Complete');
        console.log(`\n📊 Summary:`);
        console.log(`  - Total cases in Master suite: ${cases.length}`);
        console.log(`  - Cases with tags: ${cases.length - untaggedCases.length}`);
        console.log(`  - Cases without tags: ${untaggedCases.length}`);
        console.log(`  - Duplicate titles: ${duplicates.length}`);
        console.log(`  - Has automation_id: ${hasAutomationId ? 'Yes' : 'No'}`);
        
    } catch (error) {
        console.error('❌ Error analyzing TestRail state:', error.message);
        if (error.response) {
            console.error('API Response:', error.response.data);
        }
    }
}

analyzeTestRailState(); 