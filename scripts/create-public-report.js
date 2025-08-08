#!/usr/bin/env node

import { TestRailIntegration } from './testrail-integration.js';
import QRCode from 'qrcode';

class PublicReportGenerator {
  constructor(config) {
    this.integration = new TestRailIntegration(config);
  }

  async createPublicReport(runId, options = {}) {
    const defaultOptions = {
      expires_in: '7d',
      allow_attachments: true,
      allow_comments: false
    };

    const finalOptions = { ...defaultOptions, ...options };

    try {
      console.log(`🔗 Creating public report for TestRail run ${runId}...`);
      
      // Create public link
      const publicLink = await this.integration.createPublicReport(runId, finalOptions);
      
      // Generate QR code
      const qrCodeDataUrl = await this.generateQRCode(publicLink.url);
      
      // Get run summary
      const summary = await this.integration.getRunSummary(runId);
      
      const report = {
        runId,
        url: publicLink.url,
        qrCode: qrCodeDataUrl,
        expiresAt: publicLink.expires_at,
        summary,
        createdAt: new Date().toISOString()
      };

      console.log(`✅ Public report created successfully!`);
      console.log(`📊 Run Summary:`);
      console.log(`   • Total: ${summary.total}`);
      console.log(`   • Passed: ${summary.passed}`);
      console.log(`   • Failed: ${summary.failed}`);
      console.log(`   • Blocked: ${summary.blocked}`);
      console.log(`   • Retest: ${summary.retest}`);
      console.log(`   • Untested: ${summary.untested}`);
      console.log(`🔗 Public URL: ${publicLink.url}`);
      console.log(`⏰ Expires: ${publicLink.expires_at}`);

      return report;
    } catch (error) {
      console.error(`❌ Failed to create public report: ${error.message}`);
      throw error;
    }
  }

  async generateQRCode(url) {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(url, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      return qrCodeDataUrl;
    } catch (error) {
      console.error(`❌ Failed to generate QR code: ${error.message}`);
      return null;
    }
  }

  async saveReportToFile(report, filename = null) {
    if (!filename) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      filename = `public-report-${report.runId}-${timestamp}.json`;
    }

    try {
      const fs = await import('fs');
      const reportData = JSON.stringify(report, null, 2);
      fs.writeFileSync(filename, reportData);
      
      console.log(`💾 Report saved to: ${filename}`);
      return filename;
    } catch (error) {
      console.error(`❌ Failed to save report: ${error.message}`);
      throw error;
    }
  }

  async createEnhancedSlackMessage(report, workflowName, environment) {
    const { summary, url, qrCode, expiresAt } = report;
    
    const status = summary.failed === 0 ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED';
    const color = summary.failed === 0 ? 'good' : 'danger';
    
    const message = {
      text: `🧪 Public Test Report Available`,
      attachments: [{
        color,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: `📊 ${workflowName} - ${environment.toUpperCase()}`
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Status:* ${status}\n*TestRail Run ID:* ${report.runId}`
            }
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*📈 Total:* ${summary.total}`
              },
              {
                type: "mrkdwn",
                text: `*✅ Passed:* ${summary.passed}`
              },
              {
                type: "mrkdwn",
                text: `*❌ Failed:* ${summary.failed}`
              },
              {
                type: "mrkdwn",
                text: `*⏸️ Blocked:* ${summary.blocked}`
              }
            ]
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*🔗 Public Report:* <${url}|View Report>\n*⏰ Expires:* ${new Date(expiresAt).toLocaleString()}`
            }
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `🤖 Public report generated at ${new Date().toISOString()}`
              }
            ]
          }
        ]
      }]
    };

    return message;
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

  const generator = new PublicReportGenerator(config);
  
  const runId = process.argv[2];
  const saveToFile = process.argv[3] === '--save';

  if (!runId) {
    console.log('Usage: node create-public-report.js <runId> [--save]');
    process.exit(1);
  }

  generator.createPublicReport(runId)
    .then(async (report) => {
      if (saveToFile) {
        await generator.saveReportToFile(report);
      }
      
      // Generate enhanced Slack message
      const slackMessage = await generator.createEnhancedSlackMessage(
        report, 
        'Automated Regression Tests', 
        'development'
      );
      
      console.log('\n📱 Enhanced Slack Message:');
      console.log(JSON.stringify(slackMessage, null, 2));
    })
    .catch(console.error);
}

export { PublicReportGenerator };
