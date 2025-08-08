#!/usr/bin/env node

console.log('🔧 TestRail Custom Configuration Guide');
console.log('=====================================\n');

console.log('📋 Current Issue:');
console.log('• No "Environment" field visible in TestRail');
console.log('• No "Start Test Run" button');
console.log('• Need to configure custom fields first\n');

console.log('🚀 Solution Options:\n');

console.log('Option 1: Configure Custom Fields (Recommended)');
console.log('==============================================');
console.log('1. Go to TestRail Admin → Custom Fields');
console.log('2. Click "Add Custom Field"');
console.log('3. Configure Environment Field:');
console.log('   • Type: Dropdown');
console.log('   • Name: Environment');
console.log('   • System Name: custom_environment');
console.log('   • Options: develop, staging, production');
console.log('   • Apply to: Test Runs');
console.log('   • Required: Yes');
console.log('4. Save the field');
console.log('5. Refresh your TestRail page\n');

console.log('Option 2: Use Description Field (Quick Fix)');
console.log('===========================================');
console.log('If you can\'t add custom fields, use the Description field:');
console.log('1. In the "Description" field, add:');
console.log('   ENVIRONMENT: develop');
console.log('   or');
console.log('   ENVIRONMENT: staging');
console.log('2. Our webhook will parse this automatically\n');

console.log('Option 3: Use References Field');
console.log('==============================');
console.log('Use the References field to specify environment:');
console.log('1. In "References" field, enter:');
console.log('   env:develop');
console.log('   or');
console.log('   env:staging\n');

console.log('Option 4: Use Milestone for Environment');
console.log('======================================');
console.log('Create milestones for each environment:');
console.log('1. Go to Admin → Milestones');
console.log('2. Create milestones:');
console.log('   • "Develop Environment"');
console.log('   • "Staging Environment"');
console.log('3. Select appropriate milestone when creating test run\n');

console.log('🔧 Webhook Configuration Update');
console.log('==============================');
console.log('Update your webhook body to handle multiple field sources:');
console.log(JSON.stringify({
  "event_type": "testrail-run-request",
  "client_payload": {
    "run_id": "{run_id}",
    "case_ids": "{case_ids}",
    "environment": "{custom_environment|description|references|milestone}",
    "testrail_user": "{user}"
  }
}, null, 2));

console.log('\n📝 Step-by-Step Setup:\n');

console.log('Step 1: Add Custom Fields');
console.log('-------------------------');
console.log('1. TestRail Admin → Custom Fields');
console.log('2. Add "Environment" dropdown field');
console.log('3. Add "Browser" dropdown field');
console.log('4. Apply both to "Test Runs"\n');

console.log('Step 2: Configure Webhook');
console.log('-------------------------');
console.log('1. TestRail Admin → Integrations → Webhooks');
console.log('2. Add webhook with updated configuration');
console.log('3. Set triggers: "Test Run Created", "Test Run Updated"\n');

console.log('Step 3: Test the Integration');
console.log('----------------------------');
console.log('1. Go to your test suite');
console.log('2. Select test cases');
console.log('3. Click "Add Test Run"');
console.log('4. Fill in required fields:');
console.log('   • Name: "Automated Test Run"');
console.log('   • Environment: Select from dropdown');
console.log('   • Description: Add any additional info');
console.log('5. Click "Add Test Run"');
console.log('6. Check GitHub Actions for triggered workflow\n');

console.log('🔍 Troubleshooting:');
console.log('------------------');
console.log('• If custom fields don\'t appear: Clear browser cache');
console.log('• If webhook doesn\'t trigger: Check TestRail webhook logs');
console.log('• If environment not detected: Check field mapping in webhook');
console.log('• If GitHub Actions fails: Check workflow logs\n');

console.log('📞 Alternative Commands:');
console.log('----------------------');
console.log('For immediate testing without webhook setup:');
console.log('• npm run testrail:run-selected "1" develop');
console.log('• npm run testrail:run-selected "1,2,3" staging');
console.log('');
console.log('For setup guidance:');
console.log('• npm run testrail:setup-guide');
console.log('• node scripts/testrail-custom-setup.js\n');

console.log('✅ Expected Result:');
console.log('==================');
console.log('After setup, when you create a test run:');
console.log('1. You\'ll see "Environment" dropdown field');
console.log('2. Select "develop" or "staging"');
console.log('3. Click "Add Test Run"');
console.log('4. Webhook automatically triggers GitHub Actions');
console.log('5. Tests run and results are uploaded back to TestRail');
console.log('6. Slack notification is sent with all links');
