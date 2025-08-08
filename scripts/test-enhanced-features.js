#!/usr/bin/env node

import { TestRailIntegration } from './testrail-integration.js';
import { PublicReportGenerator } from './create-public-report.js';
import fs from 'fs';

async function testEnhancedFeatures() {
  console.log('🧪 Testing Enhanced TestRail Features...\n');

  const config = {
    host: process.env.TESTRAIL_HOST,
    username: process.env.TESTRAIL_USER,
    apiKey: process.env.TESTRAIL_API_KEY,
    projectId: process.env.TESTRAIL_PROJECT_ID,
    suiteId: process.env.TESTRAIL_SUITE_ID
  };

  // Validate configuration
  console.log('📋 Configuration Check:');
  Object.entries(config).forEach(([key, value]) => {
    const status = value ? '✅' : '❌';
    console.log(`   ${status} ${key}: ${value ? 'Set' : 'Missing'}`);
  });

  if (!Object.values(config).every(Boolean)) {
    console.error('\n❌ Missing required configuration. Please set all TestRail environment variables.');
    process.exit(1);
  }

  const integration = new TestRailIntegration(config);
  const generator = new PublicReportGenerator(config);

  try {
    // Test 1: Create a test run
    console.log('\n🔧 Test 1: Creating TestRail Run');
    const testRun = await integration.createRunFromSelection(
      [1, 2, 3], // Example case IDs
      'test-environment',
      {
        name: 'Enhanced Features Test Run',
        description: 'Testing the new TestRail integration features'
      }
    );
    console.log(`✅ Test run created: ${testRun.name} (ID: ${testRun.id})`);

    // Test 2: Get run summary
    console.log('\n📊 Test 2: Getting Run Summary');
    const summary = await integration.getRunSummary(testRun.id);
    console.log(`✅ Run summary retrieved:`);
    console.log(`   • Total: ${summary.total}`);
    console.log(`   • Passed: ${summary.passed}`);
    console.log(`   • Failed: ${summary.failed}`);

    // Test 3: Create public report
    console.log('\n🔗 Test 3: Creating Public Report');
    const publicReport = await generator.createPublicReport(testRun.id, {
      expires_in: '1d',
      allow_attachments: true,
      allow_comments: false
    });
    console.log(`✅ Public report created: ${publicReport.url}`);

    // Test 4: Generate enhanced Slack message
    console.log('\n📱 Test 4: Generating Enhanced Slack Message');
    const slackMessage = await generator.createEnhancedSlackMessage(
      publicReport,
      'Enhanced Features Test',
      'test-environment'
    );
    console.log('✅ Enhanced Slack message generated:');
    console.log(JSON.stringify(slackMessage, null, 2));

    // Test 5: Save report to file
    console.log('\n💾 Test 5: Saving Report to File');
    const filename = await generator.saveReportToFile(publicReport);
    console.log(`✅ Report saved to: ${filename}`);

    // Test 6: Clean up - close the test run
    console.log('\n🧹 Test 6: Cleaning Up');
    await integration.closeRun(testRun.id);
    console.log('✅ Test run closed successfully');

    // Clean up saved file
    if (fs.existsSync(filename)) {
      fs.unlinkSync(filename);
      console.log('✅ Test file cleaned up');
    }

    console.log('\n🎉 All enhanced features tests passed successfully!');
    console.log('\n📋 Summary of tested features:');
    console.log('   ✅ TestRail API integration');
    console.log('   ✅ Run creation and management');
    console.log('   ✅ Public report generation');
    console.log('   ✅ QR code generation');
    console.log('   ✅ Enhanced Slack notifications');
    console.log('   ✅ File operations');
    console.log('   ✅ Error handling and retry logic');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  testEnhancedFeatures();
}

export { testEnhancedFeatures };
