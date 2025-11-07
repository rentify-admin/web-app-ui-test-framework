#!/usr/bin/env node

/**
 * TestRail UI Test Results Publisher
 * 
 * Publishes JUnit XML results to TestRail with exact case name matching
 * to prevent duplicate case creation.
 * 
 * Uses existing TestRailAPI infrastructure for consistency.
 */

import { TestRailAPI } from '../utils/testrail-api.js';
import fs from 'fs';

class UIResultsPublisher {
  constructor(config) {
    this.api = new TestRailAPI(config);
    this.config = config;
  }

  /**
   * Parse JUnit XML manually (avoiding xml2js dependency)
   */
  parseJunitXml(xmlPath = 'playwright-report/results.xml') {
    if (!fs.existsSync(xmlPath)) {
      console.error(`❌ File not found: ${xmlPath}`);
      return { total: 0, passed: 0, failed: 0, skipped: 0, testCases: [] };
    }

    const xmlContent = fs.readFileSync(xmlPath, 'utf8');
    const testCases = [];
    let total = 0, passed = 0, failed = 0, skipped = 0;

    // Simple regex-based XML parsing (works for our specific JUnit format)
    const testcaseRegex = /<testcase\s+([^>]+)>([\s\S]*?)<\/testcase>/g;
    let match;

    while ((match = testcaseRegex.exec(xmlContent)) !== null) {
      const attributes = match[1];
      const content = match[2];

      // Extract attributes
      const nameMatch = attributes.match(/name="([^"]*)"/);
      const classnameMatch = attributes.match(/classname="([^"]*)"/);
      const timeMatch = attributes.match(/time="([^"]*)"/);

      const testCase = {
        name: nameMatch ? nameMatch[1] : '',
        classname: classnameMatch ? classnameMatch[1] : '',
        time: timeMatch ? parseFloat(timeMatch[1]) : 0,
        failure: content.includes('<failure'),
        error: content.includes('<error'),
        skipped: content.includes('<skipped'),
        message: ''
      };

      // Extract failure message if present
      if (testCase.failure) {
        const failureMatch = content.match(/<failure[^>]*>([\s\S]*?)<\/failure>/);
        if (failureMatch) {
          testCase.message = failureMatch[1].trim();
        }
      }

      // Determine status
      if (testCase.failure || testCase.error) {
        testCase.status = 'failed';
        failed++;
      } else if (testCase.skipped) {
        testCase.status = 'skipped';
        skipped++;
      } else {
        testCase.status = 'passed';
        passed++;
      }

      total++;
      testCases.push(testCase);
    }

    return { total, passed, failed, skipped, testCases };
  }

  /**
   * Find or create test cases using EXACT title matching
   */
  async findOrCreateCases(tag, testResults) {
    console.log(`🔍 Finding/creating test cases for tag: ${tag}`);
    
    const executedTests = testResults.filter(test => test.status !== 'skipped');
    console.log(`✅ Found ${executedTests.length} executed tests`);

    if (executedTests.length === 0) return new Map();

    console.log(`📡 Fetching existing cases from TestRail...`);
    
    // Use existing API method
    const response = await this.api.getCases(this.config.suiteId);
    const existingCases = response.cases || [];
    console.log(`✅ Found ${existingCases.length} existing cases`);

    // Create exact match map (key = exact title)
    const existingCaseMap = new Map();
    existingCases.forEach(tc => existingCaseMap.set(tc.title, tc));

    const caseIdMap = new Map();
    const casesToCreate = [];
    const casesToUpdate = [];

    console.log('\n📋 Processing tests:');
    for (const testResult of executedTests) {
      const testName = testResult.name;
      console.log(`  • ${testName} (${testResult.status})`);

      // EXACT match - no fuzzy logic
      if (existingCaseMap.has(testName)) {
        const existingCase = existingCaseMap.get(testName);
        caseIdMap.set(testName, existingCase.id);
        console.log(`    ✅ Matched existing case ID: ${existingCase.id}`);

        // Check if tag needs to be added
        const currentTags = existingCase.custom_tags || '';
        if (!currentTags.includes(tag)) {
          casesToUpdate.push({
            id: existingCase.id,
            tags: currentTags ? `${currentTags},${tag}` : tag
          });
          console.log(`    🏷️  Will add tag: ${tag}`);
        }
      } else {
        console.log(`    ➕ Will create new case`);
        casesToCreate.push({
          name: testName,
          classname: testResult.classname
        });
      }
    }

    // Update existing cases with tags
    if (casesToUpdate.length > 0) {
      console.log(`\n🔄 Updating ${casesToUpdate.length} cases...`);
      for (const caseToUpdate of casesToUpdate) {
        try {
          await this.api.updateCase(caseToUpdate.id, {
            custom_tags: caseToUpdate.tags
          });
          console.log(`  ✅ Updated case ${caseToUpdate.id}`);
        } catch (err) {
          console.error(`  ❌ Error updating case ${caseToUpdate.id}: ${err.message}`);
        }
      }
    }

    // Create new cases
    if (casesToCreate.length > 0) {
      console.log(`\n➕ Creating ${casesToCreate.length} new cases...`);
      for (const caseToCreate of casesToCreate) {
        try {
          const newCase = await this.api.addCase(this.config.suiteId, {
            title: caseToCreate.name,
            type_id: 1,
            priority_id: 2,
            custom_tags: tag,
            refs: caseToCreate.classname || '',
            custom_description: `UI test: ${caseToCreate.name}`
          });
          caseIdMap.set(caseToCreate.name, newCase.id);
          console.log(`  ✅ Created: ${caseToCreate.name} (ID: ${newCase.id})`);
        } catch (err) {
          console.error(`  ❌ Error creating "${caseToCreate.name}": ${err.message}`);
        }
      }
    }

    console.log(`\n✅ Total processed: ${caseIdMap.size} cases`);
    return caseIdMap;
  }

  /**
   * Create test run with specific cases
   */
  async createRun(tag, testType, caseIds, customRunName) {
    const runName = customRunName || `UI Test Run - ${testType} - ${tag}`;
    const description = `UI Test Automation
• Type: ${testType}
• Tag: ${tag}
• Run ID: ${process.env.GITHUB_RUN_ID || 'Unknown'}
• Branch: ${process.env.GITHUB_REF_NAME || 'Unknown'}`;

    console.log(`\n🚀 Creating run: ${runName}`);
    const caseIdArray = Array.from(caseIds.values());
    console.log(`📊 Cases: ${caseIdArray.length}`);

    // Create run (include_all: false, specific cases only)
    const run = await this.api.createRun({
      name: runName,
      description,
      suite_id: this.config.suiteId,
      include_all: false,
      case_ids: caseIdArray
    });

    console.log(`✅ Run created: ${run.id}`);
    return run;
  }

  /**
   * Add test results to run
   */
  async addResults(runId, testCases, caseIdMap, tag) {
    console.log(`\n📤 Adding results to run ${runId}...`);
    const results = [];

    for (const tc of testCases) {
      const caseId = caseIdMap.get(tc.name);
      if (!caseId) continue;

      const statusId = tc.failure || tc.error ? 5 : (tc.skipped ? 2 : 1);
      const comment = tc.failure || tc.error ? (tc.message || 'Failed') : (tc.skipped ? 'Skipped' : 'Passed');

      results.push({
        case_id: caseId,
        status_id: statusId,
        comment: `${comment}\nDuration: ${tc.time}s\nTag: ${tag}`
      });
    }

    // Use existing batch method
    await this.api.addResultsForCases(runId, results);

    const passedCount = results.filter(r => r.status_id === 1).length;
    const failedCount = results.filter(r => r.status_id === 5).length;
    console.log(`\n📊 Results: ${passedCount} passed, ${failedCount} failed`);
  }

  /**
   * Publish complete workflow
   */
  async publish(options) {
    const { tag, testType, runName } = options;

    console.log('🎯 UI TestRail Publisher\n');
    console.log(`📋 Tag: ${tag}, Type: ${testType}\n`);

    const testResults = this.parseJunitXml();
    console.log(`📊 Results: ${testResults.total} total, ${testResults.passed} passed, ${testResults.failed} failed`);

    if (testResults.total === 0) {
      const output = {
        runIds: [],
        reportUrl: `${this.config.host}/index.php?/runs/view/`,
        testType,
        tag,
        totalRuns: 0,
        error: 'No results'
      };
      fs.writeFileSync('testrail_output.json', JSON.stringify(output, null, 2));
      return output;
    }

    const caseIdMap = await this.findOrCreateCases(tag, testResults.testCases);
    if (caseIdMap.size === 0) {
      throw new Error('No cases found/created');
    }

    const run = await this.createRun(tag, testType, caseIdMap, runName);
    await this.addResults(run.id, testResults.testCases, caseIdMap, tag);

    const output = {
      runIds: [run.id],
      reportUrl: `${this.config.host}/index.php?/runs/view/${run.id}`,
      testType,
      tag,
      totalRuns: 1,
      testResults: {
        total: testResults.total,
        passed: testResults.passed,
        failed: testResults.failed,
        skipped: testResults.skipped
      }
    };

    fs.writeFileSync('testrail_output.json', JSON.stringify(output, null, 2));
    console.log(`\n✅ SUCCESS! Run: ${run.id}`);
    console.log(`📊 URL: ${output.reportUrl}`);

    return output;
  }
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (args[i].startsWith('--')) {
      options[args[i].slice(2)] = args[i + 1];
    }
  }

  const config = {
    host: process.env.TESTRAIL_HOST,
    username: process.env.TESTRAIL_USER,
    apiKey: process.env.TESTRAIL_API_KEY,
    projectId: process.env.TESTRAIL_PROJECT_ID,
    suiteId: process.env.TESTRAIL_SUITE_ID
  };

  const publisher = new UIResultsPublisher(config);
  
  publisher.publish({
    tag: options.tag || 'untagged',
    testType: options['test-type'] || 'UI Tests',
    runName: options['run-name']
  }).catch(error => {
    console.error('\n💥 Fatal error:', error.message);
    process.exit(1);
  });
}

export { UIResultsPublisher };

