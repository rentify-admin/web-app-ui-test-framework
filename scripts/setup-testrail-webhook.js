#!/usr/bin/env node

import { TestRailAPI } from '../utils/testrail-api.js';

class TestRailWebhookSetup {
  constructor(config) {
    this.api = new TestRailAPI(config);
    this.githubToken = process.env.GITHUB_TOKEN;
    this.githubRepo = process.env.GITHUB_REPOSITORY;
  }

  async setupWebhook() {
    if (!this.githubToken || !this.githubRepo) {
      throw new Error('GITHUB_TOKEN and GITHUB_REPOSITORY environment variables are required');
    }

    const webhookConfig = {
      name: 'GitHub Actions Trigger',
      url: `https://api.github.com/repos/${this.githubRepo}/dispatches`,
      headers: {
        'Authorization': `token ${this.githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: {
        event_type: 'testrail-run-request',
        client_payload: {
          run_id: '{run_id}',
          case_ids: '{case_ids}',
          environment: '{environment}',
          testrail_user: '{user}'
        }
      }
    };

    try {
      console.log('🔧 Setting up TestRail webhook...');
      console.log(`📋 Webhook Configuration:`);
      console.log(`   • Name: ${webhookConfig.name}`);
      console.log(`   • URL: ${webhookConfig.url}`);
      console.log(`   • Event Type: ${webhookConfig.body.event_type}`);
      
      // Note: TestRail webhook API might not be available in all instances
      // This is a template for manual setup
      console.log('\n📝 Manual Setup Instructions:');
      console.log('1. Go to TestRail Admin → Integrations → Webhooks');
      console.log('2. Click "Add Webhook"');
      console.log('3. Use the following configuration:');
      console.log('\n--- Webhook Configuration ---');
      console.log(JSON.stringify(webhookConfig, null, 2));
      console.log('\n--- End Configuration ---');
      
      console.log('\n✅ Webhook configuration ready for manual setup');
      return webhookConfig;
    } catch (error) {
      console.error('❌ Failed to setup webhook:', error.message);
      throw error;
    }
  }

  async testWebhookConnection() {
    try {
      console.log('🧪 Testing webhook connection...');
      
      // Test GitHub API access
      const response = await fetch(`https://api.github.com/repos/${this.githubRepo}`, {
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} - ${response.statusText}`);
      }

      console.log('✅ GitHub API connection successful');
      console.log('✅ Repository access confirmed');
      
      return true;
    } catch (error) {
      console.error('❌ Webhook connection test failed:', error.message);
      throw error;
    }
  }

  async createTestRunFromSelection(caseIds, environment) {
    try {
      console.log(`🔧 Creating test run from selection...`);
      console.log(`   • Cases: ${caseIds.join(', ')}`);
      console.log(`   • Environment: ${environment}`);
      
      const run = await this.api.createRun({
        name: `Manual Selection - ${environment} - ${new Date().toISOString()}`,
        description: `Test run created from manual case selection`,
        suite_id: this.api.suiteId,
        case_ids: caseIds,
        environment: environment
      });

      console.log(`✅ Test run created: ${run.name} (ID: ${run.id})`);
      return run;
    } catch (error) {
      console.error('❌ Failed to create test run:', error.message);
      throw error;
    }
  }

  async triggerGitHubWorkflow(runId, caseIds, environment, testrailUser) {
    try {
      console.log('🚀 Triggering GitHub Actions workflow...');
      
      const payload = {
        event_type: 'testrail-run-request',
        client_payload: {
          run_id: runId,
          case_ids: caseIds.join(','),
          environment: environment,
          testrail_user: testrailUser
        }
      };

      const response = await fetch(`https://api.github.com/repos/${this.githubRepo}/dispatches`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
      }

      console.log('✅ GitHub Actions workflow triggered successfully');
      console.log(`📊 Check the workflow at: https://github.com/${this.githubRepo}/actions`);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to trigger workflow:', error.message);
      throw error;
    }
  }

  async simulateWebhookTrigger(caseIds = [1, 2, 3], environment = 'develop') {
    try {
      console.log('🎭 Simulating webhook trigger...');
      
      // Create a test run
      const run = await this.createTestRunFromSelection(caseIds, environment);
      
      // Trigger the workflow
      await this.triggerGitHubWorkflow(
        run.id,
        caseIds,
        environment,
        'test-user'
      );
      
      console.log('✅ Webhook simulation completed');
      return run;
    } catch (error) {
      console.error('❌ Webhook simulation failed:', error.message);
      throw error;
    }
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const config = {
    host: process.env.TESTRAIL_HOST,
    username: process.env.TESTRAIL_USER,
    apiKey: process.env.TESTRAIL_API_KEY,
    projectId: process.env.TESTRAIL_PROJECT_ID,
    suiteId: process.env.TESTRAIL_SUITE_ID
  };

  const setup = new TestRailWebhookSetup(config);
  
  const command = process.argv[2];

  switch (command) {
    case 'setup':
      setup.setupWebhook()
        .then(() => console.log('Webhook setup completed'))
        .catch(console.error);
      break;
      
    case 'test':
      setup.testWebhookConnection()
        .then(() => console.log('Connection test completed'))
        .catch(console.error);
      break;
      
    case 'simulate':
      const caseIds = process.argv[3] ? process.argv[3].split(',').map(Number) : [1, 2, 3];
      const environment = process.argv[4] || 'develop';
      
      setup.simulateWebhookTrigger(caseIds, environment)
        .then((run) => console.log(`Simulation completed for run ${run.id}`))
        .catch(console.error);
      break;
      
    default:
      console.log('Usage: node setup-testrail-webhook.js [setup|test|simulate] [caseIds] [environment]');
      console.log('  setup     - Generate webhook configuration for manual setup');
      console.log('  test      - Test GitHub API connection');
      console.log('  simulate  - Simulate webhook trigger with test run');
      console.log('');
      console.log('Examples:');
      console.log('  node setup-testrail-webhook.js setup');
      console.log('  node setup-testrail-webhook.js test');
      console.log('  node setup-testrail-webhook.js simulate "1,2,3" develop');
  }
}

export { TestRailWebhookSetup };
