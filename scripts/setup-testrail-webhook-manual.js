#!/usr/bin/env node

console.log('🔧 TestRail Webhook Setup Guide');
console.log('================================\n');

console.log('📋 Prerequisites:');
console.log('1. GitHub Personal Access Token (with repo permissions)');
console.log('2. TestRail Admin access');
console.log('3. Your TestRail instance URL\n');

console.log('🚀 Step-by-Step Instructions:\n');

console.log('Step 1: Get GitHub Token');
console.log('------------------------');
console.log('1. Go to: https://github.com/settings/tokens');
console.log('2. Click "Generate new token (classic)"');
console.log('3. Give it a name like "TestRail Integration"');
console.log('4. Select "repo" permissions');
console.log('5. Click "Generate token"');
console.log('6. Copy the token (you\'ll need it for Step 3)\n');

console.log('Step 2: Access TestRail Admin');
console.log('-----------------------------');
console.log('1. Go to your TestRail instance');
console.log('2. Click on your profile → "Administration"');
console.log('3. In the left sidebar, click "Integrations"');
console.log('4. Click "Webhooks"\n');

console.log('Step 3: Create Webhook');
console.log('----------------------');
console.log('1. Click "Add Webhook"');
console.log('2. Fill in the following details:\n');

const webhookConfig = {
  name: "GitHub Actions Trigger",
  url: "https://api.github.com/repos/rentify-admin/web-app-ui-test-framework/dispatches",
  headers: {
    "Authorization": "token YOUR_GITHUB_TOKEN_HERE",
    "Accept": "application/vnd.github.v3+json",
    "Content-Type": "application/json"
  },
  body: {
    "event_type": "testrail-run-request",
    "client_payload": {
      "run_id": "{run_id}",
      "case_ids": "{case_ids}",
      "environment": "{environment}",
      "testrail_user": "{user}"
    }
  }
};

console.log('📝 Webhook Configuration:');
console.log(JSON.stringify(webhookConfig, null, 2));
console.log('\n⚠️  IMPORTANT: Replace "YOUR_GITHUB_TOKEN_HERE" with your actual GitHub token!\n');

console.log('Step 4: Configure Webhook Triggers');
console.log('----------------------------------');
console.log('1. In the webhook settings, configure triggers:');
console.log('   - Select "Test Run Created"');
console.log('   - Select "Test Run Updated"');
console.log('2. Set environment variables:');
console.log('   - environment: develop (for development runs)');
console.log('   - environment: staging (for staging runs)');
console.log('3. Click "Save"\n');

console.log('Step 5: Test the Webhook');
console.log('-------------------------');
console.log('1. Go back to your test suite');
console.log('2. Select a few test cases');
console.log('3. Click "Run Test"');
console.log('4. In the run creation page:');
console.log('   - Set environment to "develop" or "staging"');
console.log('   - Click "Start Test Run"');
console.log('5. Check GitHub Actions: https://github.com/rentify-admin/web-app-ui-test-framework/actions\n');

console.log('Step 6: Verify Integration');
console.log('--------------------------');
console.log('1. Check GitHub Actions for new workflow run');
console.log('2. Check Slack for notification');
console.log('3. Check TestRail for results and videos');
console.log('4. Check public report link in Slack\n');

console.log('🔍 Troubleshooting:');
console.log('------------------');
console.log('• If webhook doesn\'t trigger: Check TestRail webhook logs');
console.log('• If GitHub Actions fails: Check workflow logs');
console.log('• If no tests run: Check test case mapping');
console.log('• If no videos: Check test-results directory exists\n');

console.log('📞 Need Help?');
console.log('-------------');
console.log('• Check TestRail webhook documentation');
console.log('• Review GitHub Actions logs');
console.log('• Verify all environment variables are set\n');

console.log('✅ Setup Complete!');
console.log('==================');
console.log('Once configured, every time you:');
console.log('1. Select test cases in TestRail');
console.log('2. Click "Run Test"');
console.log('3. Choose environment');
console.log('4. Start the run');
console.log('');
console.log('The system will automatically:');
console.log('✅ Trigger GitHub Actions workflow');
console.log('✅ Run only selected tests');
console.log('✅ Upload results to TestRail');
console.log('✅ Attach videos for failed tests');
console.log('✅ Generate public report');
console.log('✅ Send Slack notification');
