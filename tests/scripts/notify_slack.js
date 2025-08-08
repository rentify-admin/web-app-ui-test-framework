import dotenv from 'dotenv';
import fs from 'fs';
import { parseString } from 'xml2js';

dotenv.config();

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;

// Argumentos: repo, branch, email, outcome, test_type, run_id, testrail_data, github_event_name, github_base_ref
const [,, repo, branch, email, outcome, test_type, run_id, testrail_data, github_event_name, github_base_ref] = process.argv;

// Constants inspired by slack-test-reporter
const EMOJIS = {
  TEST_TUBE: '🧪',
  CHECK_MARK: '✅',
  X_MARK: '❌',
  FAST_FORWARD: '⏭️',
  HOURGLASS: '⏳',
  QUESTION: '❓',
  FALLEN_LEAF: '🍂',
  CHART: '📊',
  LINK: '🔗',
  USER: '👤',
  NOTE: '📝'
};

const MESSAGES = {
  RESULT_PASSED: 'All tests passed! 🎉',
  RESULT_FAILED: (failed) => `${failed} test(s) failed`,
  DURATION_LESS_THAN_ONE: 'Duration: < 1s',
  DURATION_FORMAT: 'Duration: %s'
};

const BLOCK_TYPES = {
  SECTION: 'section',
  DIVIDER: 'divider',
  CONTEXT: 'context'
};

const TEXT_TYPES = {
  MRKDWN: 'mrkdwn',
  PLAIN_TEXT: 'plain_text'
};

// Function to parse JUnit XML and extract test results
function parseTestResults(xmlPath = 'playwright-report/results.xml') {
  try {
    if (!fs.existsSync(xmlPath)) {
      console.log(`Test results file not found: ${xmlPath}`);
      return { total: 0, passed: 0, failed: 0, skipped: 0, failedTests: [] };
    }

    const xmlContent = fs.readFileSync(xmlPath, 'utf8');
    
    return new Promise((resolve, reject) => {
      parseString(xmlContent, (err, result) => {
        if (err) {
          console.error('Error parsing XML:', err);
          resolve({ total: 0, passed: 0, failed: 0, skipped: 0, failedTests: [] });
          return;
        }

        const testsuites = result.testsuites || result.testsuite;
        if (!testsuites) {
          resolve({ total: 0, passed: 0, failed: 0, skipped: 0, failedTests: [] });
          return;
        }

        let total = 0;
        let passed = 0;
        let failed = 0;
        let skipped = 0;
        let failedTests = [];

        // Handle both single testsuite and multiple testsuites
        const suites = Array.isArray(testsuites.testsuite) ? testsuites.testsuite : [testsuites.testsuite];
        
        suites.forEach(suite => {
          if (suite.$.tests) total += parseInt(suite.$.tests);
          if (suite.$.failures) failed += parseInt(suite.$.failures);
          if (suite.$.skipped) skipped += parseInt(suite.$.skipped);
          
          // Calculate passed tests
          const suitePassed = parseInt(suite.$.tests) - parseInt(suite.$.failures || 0) - parseInt(suite.$.skipped || 0);
          passed += suitePassed;

          // Extract failed test details
          if (suite.testcase) {
            suite.testcase.forEach(testcase => {
              if (testcase.failure) {
                failedTests.push({
                  name: testcase.$.name,
                  class: testcase.$.classname,
                  message: testcase.failure[0]._ || testcase.failure[0].$.message || 'Test failed'
                });
              }
            });
          }
        });

        resolve({ total, passed, failed, skipped, failedTests });
      });
    });
  } catch (error) {
    console.error('Error reading test results:', error);
    return { total: 0, passed: 0, failed: 0, skipped: 0, failedTests: [] };
  }
}

async function getSlackUserIdByEmail(email) {
  try {
    const res = await fetch('https://slack.com/api/users.lookupByEmail', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `email=${email}`
    });
    const data = await res.json();
    if (data.ok) return data.user.id;
    return null;
  } catch (error) {
    console.error('Error looking up Slack user:', error);
    return null;
  }
}

// Function to determine event type and create appropriate link
function getEventInfo(branch, github_event_name, github_base_ref) {
  let eventType = '';
  let eventLink = '';
  let eventEmoji = '';

  if (github_event_name === 'pull_request') {
    if (github_base_ref === 'develop') {
      eventType = 'PR to develop';
      eventEmoji = '🔀';
    } else {
      eventType = 'PR to other branch';
      eventEmoji = '🔀';
    }
    
    // Extract PR number from branch name (e.g., "1517/merge" -> 1517)
    const prNumber = branch.includes('/merge') ? branch.split('/')[0] : branch;
    eventLink = `https://github.com/${repo}/pull/${prNumber}`;
    
  } else if (github_event_name === 'push') {
    if (branch === 'develop') {
      eventType = 'Push to develop';
      eventEmoji = '🚀';
      eventLink = `https://github.com/${repo}/tree/develop`;
    } else if (branch === 'staging') {
      eventType = 'Deploy to Staging';
      eventEmoji = '🎯';
      eventLink = `https://github.com/${repo}/tree/staging`;
    } else if (branch.includes('/merge')) {
      // This is a push to a PR branch (e.g., after PR update)
      eventType = 'Push to existing PR';
      eventEmoji = '📝';
      const prNumber = branch.split('/')[0];
      eventLink = `https://github.com/${repo}/pull/${prNumber}`;
    } else {
      eventType = 'Push to feature branch';
      eventEmoji = '📝';
      eventLink = `https://github.com/${repo}/tree/${branch}`;
    }
  } else {
    eventType = 'Unknown event';
    eventEmoji = '❓';
    eventLink = `https://github.com/${repo}`;
  }

  return { eventType, eventLink, eventEmoji };
}

(async function sendSlackMessage() {
  try {
    let mention = email;
    console.log('Email:', email);
    console.log('SLACK_BOT_TOKEN available:', !!SLACK_BOT_TOKEN);
    
    if (email && SLACK_BOT_TOKEN) {
      const userId = await getSlackUserIdByEmail(email);
      console.log('Slack User ID:', userId);
      if (userId) {
        mention = `<@${userId}>`;
      }
    }
    
    // Parse test results from JUnit XML
    const testResults = await parseTestResults();
    console.log('Test results:', testResults);
    console.log('Outcome parameter:', outcome);
    console.log('Failed tests count:', testResults.failed);
    console.log('Is success based on failed count:', testResults.failed === 0);
    
    // Determine emoji and status based on test results (not just outcome)
    const isSuccess = testResults.failed === 0;
    const emoji = isSuccess ? '✅' : '❌';
    const status = isSuccess ? 'PASSED' : 'FAILED';
    
    // Create GitHub Actions link
    const githubRunLink = run_id ? 
      `https://github.com/${repo}/actions/runs/${run_id}` : 
      'Run not available';

    // Create TestRail report links
    let testrailLinks = '';
    if (testrail_data) {
      try {
        console.log('Parsing TestRail data...');
        console.log('TestRail data length:', testrail_data.length);
        console.log('TestRail data preview:', testrail_data.substring(0, 100));
        
        const testrailInfo = JSON.parse(testrail_data);
        console.log('TestRail data parsed successfully');
        console.log('TestRail data keys:', Object.keys(testrailInfo));
        
        if (testrailInfo.runIds && testrailInfo.runIds.length > 0) {
          // Create browser-specific TestRail links
          const browsers = ['chromium', 'firefox', 'webkit'];
          testrailLinks = testrailInfo.runIds.map((runId, index) => {
            const browser = browsers[index] || 'unknown';
            const testTag = testrailInfo.tag || 'test';
            return `<${testrailInfo.reportUrl}${runId}|📊 Test Report for: ${testTag} tests in ${browser}>`;
          }).join('\n• ');
        } else {
          console.log('No TestRail run IDs found in data');
        }
      } catch (error) {
        console.error('Error parsing TestRail data:', error);
        console.error('Raw TestRail data:', testrail_data);
      }
    } else {
      console.log('No TestRail data provided');
    }

    // Create links section
    let linksSection = `• <${githubRunLink}|🔗 GitHub Actions Run>\n`;
    
    if (testrailLinks) {
      linksSection += `• ${testrailLinks}\n`;
    }
    
    // Determine test set and blocking note
    let testSet = '';
    let note = '';
    
    if (test_type && test_type.includes('Core')) {
      testSet = 'Core functionality tests (@core)';
      note = 'Tests do not block PR merge';
    } else if (test_type && test_type.includes('Smoke')) {
      testSet = 'Smoke test suite (@smoke)';
      note = 'Tests do not block merge';
    } else if (test_type && test_type.includes('Regression')) {
      testSet = 'Full regression test suite (@regression)';
      note = 'Tests do not block deployment';
    } else {
      testSet = test_type || 'Playwright Tests';
      note = 'Tests do not block operations';
    }
    
    // Create test result blocks inspired by slack-test-reporter
    let blocks = [];
    
    if (testResults.total > 0) {
      const passRate = ((testResults.passed / testResults.total) * 100).toFixed(1);
      const duration = testResults.duration || 0;
      
      // Create test summary line
      let testSummary = `${EMOJIS.TEST_TUBE} ${testResults.total} | ${EMOJIS.CHECK_MARK} ${testResults.passed} | ${EMOJIS.X_MARK} ${testResults.failed}`;
      
      if (testResults.skipped > 0) {
        testSummary += ` | ${EMOJIS.FAST_FORWARD} ${testResults.skipped}`;
      }
      
      // Create result text - always show actual test results
      const resultText = testResults.failed > 0 
        ? MESSAGES.RESULT_FAILED(testResults.failed)
        : MESSAGES.RESULT_PASSED;
      
      // Create duration text
      const durationText = duration < 1 
        ? MESSAGES.DURATION_LESS_THAN_ONE
        : `Duration: ${Math.round(duration)}s`;
      
          // Get event information
    const eventInfo = getEventInfo(branch, github_event_name, github_base_ref);
    
    // Create build info with event type and link
    const buildInfo = `Run ID: ${run_id} | ${eventInfo.eventEmoji} ${eventInfo.eventType}: <${eventInfo.eventLink}|Click here>`;
      
      // Main test result block with event type
      blocks.push({
        type: BLOCK_TYPES.SECTION,
        text: {
          type: TEXT_TYPES.MRKDWN,
          text: `*${eventInfo.eventEmoji} ${eventInfo.eventType}*\n${testSummary}\n${resultText} | ${durationText}\n${buildInfo}`
        }
      });
      
      // Add progress bar for visual feedback
      const progressBar = createProgressBar(testResults.passed, testResults.total);
      if (progressBar) {
        blocks.push({
          type: BLOCK_TYPES.SECTION,
          text: {
            type: TEXT_TYPES.MRKDWN,
            text: progressBar
          }
        });
      }
      
      // Failed tests block (only if there are failures)
      if (testResults.failed > 0 && testResults.failedTests.length > 0) {
        let failedTestsText = `${EMOJIS.X_MARK} *Failed Tests (${testResults.failedTests.length}):*\n`;
        testResults.failedTests.slice(0, 5).forEach((test, index) => {
          failedTestsText += `${index + 1}. \`${test.name}\`\n   _${test.class}_\n`;
        });
        if (testResults.failedTests.length > 5) {
          failedTestsText += `   ... and ${testResults.failedTests.length - 5} more tests failed`;
        }
        
        blocks.push({
          type: BLOCK_TYPES.SECTION,
          text: {
            type: TEXT_TYPES.MRKDWN,
            text: failedTestsText
          }
        });
      }
    } else {
      // No test results available
      const eventInfo = getEventInfo(branch, github_event_name, github_base_ref);
      blocks.push({
        type: BLOCK_TYPES.SECTION,
        text: {
          type: TEXT_TYPES.MRKDWN,
          text: `${emoji} *${test_type} ${status}*\n${eventInfo.eventEmoji} ${eventInfo.eventType}\n⚠️ No test results available`
        }
      });
    }
    
    // Add divider
    blocks.push({
      type: BLOCK_TYPES.DIVIDER
    });
    
    // Links and metadata block
    const metadataText = `${linksSection}\n${EMOJIS.USER} Triggered by: ${mention}\n${EMOJIS.NOTE} ${note}`;
    
    blocks.push({
      type: BLOCK_TYPES.SECTION,
      text: {
        type: TEXT_TYPES.MRKDWN,
        text: metadataText
      }
    });
    
    // Helper function for progress bar
    function createProgressBar(passed, total, width = 20) {
      if (total === 0) return '';
      
      const passRate = passed / total;
      const passedBlocks = Math.round(passRate * width);
      const failedBlocks = width - passedBlocks;
      
      const passedBar = '🟢'.repeat(passedBlocks);
      const failedBar = '🔴'.repeat(failedBlocks);
      
      return `${passedBar}${failedBar}`;
    }
    
    // Create message using Slack blocks for better formatting
    const message = {
      text: `${emoji} *${test_type} ${status}*`,
      blocks: blocks
    };
    
    console.log('Sending Slack message:', JSON.stringify(message, null, 2));
    
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
    
    if (!response.ok) {
      console.error('Failed to send Slack message:', response.status, response.statusText);
    } else {
      console.log('Slack message sent successfully');
    }
  } catch (error) {
    console.error('Error sending Slack message:', error);
  }
})(); 