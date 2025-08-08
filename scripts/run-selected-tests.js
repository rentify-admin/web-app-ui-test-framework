#!/usr/bin/env node

import { TestRailIntegration } from './testrail-integration.js';
import { TestCaseMapper } from './test-case-mapper.js';

class TestRunner {
  constructor() {
    this.config = {
      host: process.env.TESTRAIL_HOST,
      username: process.env.TESTRAIL_USER,
      apiKey: process.env.TESTRAIL_API_KEY,
      projectId: process.env.TESTRAIL_PROJECT_ID,
      suiteId: process.env.TESTRAIL_SUITE_ID
    };
    
    this.integration = new TestRailIntegration(this.config);
    this.mapper = new TestCaseMapper(this.config);
  }

  async runSelectedTests(caseIds, environment = 'develop') {
    console.log(`🧪 Running selected tests for cases: ${caseIds.join(', ')}`);
    console.log(`🌐 Environment: ${environment}`);
    
    try {
      // Step 1: Create TestRail run
      console.log('\n📊 Step 1: Creating TestRail run...');
      const run = await this.integration.createRunFromSelection(
        caseIds,
        environment,
        {
          name: `Manual Selection - ${environment} - ${new Date().toISOString()}`,
          description: `Test run created manually for cases: ${caseIds.join(', ')}`
        }
      );
      
      console.log(`✅ TestRail run created: ${run.name} (ID: ${run.id})`);

      // Step 2: Generate test filter
      console.log('\n🎯 Step 2: Generating test filter...');
      const testFilter = await this.mapper.generateTestFilter(caseIds);
      console.log(`✅ Test filter: ${testFilter}`);

      // Step 3: Run tests
      console.log('\n🚀 Step 3: Running tests...');
      const { execSync } = await import('child_process');
      
      const command = `npx playwright test --project=chromium ${testFilter}`;
      console.log(`Executing: ${command}`);
      
      try {
        execSync(command, { stdio: 'inherit' });
        console.log('✅ Tests completed successfully');
      } catch (error) {
        console.log('⚠️ Some tests failed, but continuing with results upload');
      }

      // Step 4: Upload results to TestRail
      console.log('\n📤 Step 4: Uploading results to TestRail...');
      const { execSync } = await import('child_process');
      
      const trcliCommand = `trcli -y -h ${this.config.host} --project "${process.env.TESTRAIL_PROJECT_NAME}" --username ${this.config.username} --key ${this.config.apiKey} parse_junit --title "Manual Run - ${environment} - ${new Date().toISOString()}" --suite-id ${this.config.suiteId} --case-matcher "name" --case-fields "custom_environment:${environment}" --result-fields "custom_browser:chromium" --file playwright-report/results.xml`;
      
      try {
        const output = execSync(trcliCommand, { encoding: 'utf8' });
        console.log('✅ Results uploaded to TestRail');
        console.log('Output:', output);
      } catch (error) {
        console.log('⚠️ Failed to upload results:', error.message);
      }

      // Step 5: Process videos
      console.log('\n🎥 Step 5: Processing videos...');
      try {
        await this.integration.attachVideosForFailedTests(run.id);
        console.log('✅ Videos processed');
      } catch (error) {
        console.log('⚠️ Video processing failed:', error.message);
      }

      // Step 6: Create public report
      console.log('\n🔗 Step 6: Creating public report...');
      try {
        const { PublicReportGenerator } = await import('./create-public-report.js');
        const generator = new PublicReportGenerator(this.config);
        const report = await generator.createPublicReport(run.id);
        console.log(`✅ Public report created: ${report.url}`);
      } catch (error) {
        console.log('⚠️ Public report creation failed:', error.message);
      }

      // Step 7: Send Slack notification
      console.log('\n📤 Step 7: Sending Slack notification...');
      try {
        const { execSync } = await import('child_process');
        const slackCommand = `node scripts/slack-notification.js "Manual Test Run" "${environment}" "manual-${Date.now()}" "playwright-report/results.xml" "${run.id}"`;
        execSync(slackCommand, { stdio: 'inherit' });
        console.log('✅ Slack notification sent');
      } catch (error) {
        console.log('⚠️ Slack notification failed:', error.message);
      }

      console.log('\n🎉 Test run completed successfully!');
      console.log(`📊 TestRail Run ID: ${run.id}`);
      console.log(`🔗 Check results in TestRail and Slack`);

    } catch (error) {
      console.error('❌ Test run failed:', error.message);
      process.exit(1);
    }
  }

  async listAvailableCases() {
    try {
      console.log('📋 Available TestRail Cases:');
      const cases = await this.integration.api.getCases();
      
      cases.slice(0, 10).forEach(testCase => {
        console.log(`  ${testCase.id}: ${testCase.title}`);
      });
      
      if (cases.length > 10) {
        console.log(`  ... and ${cases.length - 10} more cases`);
      }
      
      console.log(`\nTotal cases: ${cases.length}`);
    } catch (error) {
      console.error('❌ Failed to list cases:', error.message);
    }
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new TestRunner();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'run':
      const caseIds = process.argv[3] ? process.argv[3].split(',').map(Number) : [1];
      const environment = process.argv[4] || 'develop';
      
      if (!caseIds || caseIds.length === 0) {
        console.log('❌ Please provide case IDs');
        console.log('Usage: node scripts/run-selected-tests.js run "1,2,3" [environment]');
        process.exit(1);
      }
      
      runner.runSelectedTests(caseIds, environment);
      break;
      
    case 'list':
      runner.listAvailableCases();
      break;
      
    default:
      console.log('Usage: node scripts/run-selected-tests.js [run|list] [caseIds] [environment]');
      console.log('');
      console.log('Examples:');
      console.log('  node scripts/run-selected-tests.js run "1,2,3" develop');
      console.log('  node scripts/run-selected-tests.js run "1" staging');
      console.log('  node scripts/run-selected-tests.js list');
      console.log('');
      console.log('This script allows you to:');
      console.log('✅ Run selected tests without webhook setup');
      console.log('✅ Create TestRail runs manually');
      console.log('✅ Upload results and videos');
      console.log('✅ Generate public reports');
      console.log('✅ Send Slack notifications');
  }
}

export { TestRunner };
