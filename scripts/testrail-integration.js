#!/usr/bin/env node

import { TestRailAPI } from '../utils/testrail-api.js';
import fs from 'fs';
import path from 'path';

class TestRailIntegration {
  constructor(config) {
    this.api = new TestRailAPI(config);
    this.config = config;
  }

  async createRunFromSelection(caseIds, environment, options = {}) {
    const defaultOptions = {
      name: `Automated Run - ${environment} - ${new Date().toISOString()}`,
      description: `Automated test run triggered from TestRail for ${environment} environment`,
      suite_id: this.config.suiteId,
      case_ids: caseIds,
      environment: environment
    };

    const runData = { ...defaultOptions, ...options };

    try {
      console.log(`Creating TestRail run with ${caseIds.length} cases for ${environment}...`);
      const run = await this.api.robustApiCall(() => this.api.createRun(runData));
      
      console.log(`✅ TestRail run created successfully: ${run.name} (ID: ${run.id})`);
      return run;
    } catch (error) {
      console.error(`❌ Failed to create TestRail run: ${error.message}`);
      throw error;
    }
  }

  async updateResults(runId, results) {
    console.log(`Updating ${results.length} results for run ${runId}...`);
    
    const batchSize = 250; // TestRail API limit
    const batches = [];
    
    for (let i = 0; i < results.length; i += batchSize) {
      batches.push(results.slice(i, i + batchSize));
    }

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} results)...`);
      
      try {
        await this.api.robustApiCall(() => this.api.addResultsForCases(runId, batch));
        console.log(`✅ Batch ${i + 1} processed successfully`);
      } catch (error) {
        console.error(`❌ Failed to process batch ${i + 1}: ${error.message}`);
        throw error;
      }
    }
  }

  async attachVideo(runId, caseId, videoPath) {
    if (!fs.existsSync(videoPath)) {
      console.warn(`⚠️ Video file not found: ${videoPath}`);
      return null;
    }

    try {
      console.log(`Attaching video to case ${caseId}: ${path.basename(videoPath)}`);
      const attachment = await this.api.robustApiCall(() => 
        this.api.addAttachment(runId, caseId, videoPath)
      );
      
      console.log(`✅ Video attached successfully: ${attachment.filename}`);
      return attachment;
    } catch (error) {
      console.error(`❌ Failed to attach video: ${error.message}`);
      return null;
    }
  }

  async attachVideosForFailedTests(runId, testResultsDir = 'test-results') {
    if (!fs.existsSync(testResultsDir)) {
      console.log(`No test results directory found: ${testResultsDir}`);
      return [];
    }

    const attachments = [];
    const videoExtensions = ['.webm', '.mp4', '.avi', '.mov'];

    try {
      // Find all video files in test results
      const videoFiles = [];
      const findVideos = (dir) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          
          if (stat.isDirectory()) {
            findVideos(filePath);
          } else if (videoExtensions.includes(path.extname(file).toLowerCase())) {
            videoFiles.push(filePath);
          }
        }
      };

      findVideos(testResultsDir);

      console.log(`Found ${videoFiles.length} video files to process...`);

      for (const videoPath of videoFiles) {
        // Extract test name from video filename
        const fileName = path.basename(videoPath, path.extname(videoPath));
        const testName = this.extractTestNameFromFileName(fileName);
        
        if (testName) {
          // Find corresponding TestRail case ID
          const caseId = await this.findCaseIdByTestName(testName);
          
          if (caseId) {
            const attachment = await this.attachVideo(runId, caseId, videoPath);
            if (attachment) {
              attachments.push({
                caseId,
                testName,
                videoPath,
                attachment
              });
            }
          } else {
            console.warn(`⚠️ No TestRail case found for test: ${testName}`);
          }
        }
      }

      console.log(`✅ Attached ${attachments.length} videos to TestRail cases`);
      return attachments;
    } catch (error) {
      console.error(`❌ Error processing videos: ${error.message}`);
      return attachments;
    }
  }

  extractTestNameFromFileName(fileName) {
    // Common patterns for Playwright video filenames
    const patterns = [
      /^(.+)-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/, // UUID pattern
      /^(.+)-[0-9]+$/, // Number pattern
      /^(.+)$/ // Fallback: use entire name
    ];

    for (const pattern of patterns) {
      const match = fileName.match(pattern);
      if (match) {
        return match[1].replace(/[-_]/g, ' ').trim();
      }
    }

    return null;
  }

  async findCaseIdByTestName(testName) {
    try {
      // This is a simplified approach - in a real implementation,
      // you might want to maintain a mapping between test names and case IDs
      // or use TestRail's search functionality
      
      // For now, we'll try to find cases that contain the test name
      const cases = await this.api.getCases();
      
      const matchingCase = cases.find(testCase => 
        testCase.title.toLowerCase().includes(testName.toLowerCase()) ||
        testName.toLowerCase().includes(testCase.title.toLowerCase())
      );

      return matchingCase ? matchingCase.id : null;
    } catch (error) {
      console.error(`Error finding case ID for test "${testName}": ${error.message}`);
      return null;
    }
  }

  async createPublicReport(runId, options = {}) {
    const defaultOptions = {
      expires_in: '7d',
      allow_attachments: true,
      allow_comments: false
    };

    const finalOptions = { ...defaultOptions, ...options };

    try {
      console.log(`Creating public link for run ${runId}...`);
      const publicLink = await this.api.robustApiCall(() => 
        this.api.createPublicLink(runId, finalOptions)
      );
      
      console.log(`✅ Public link created: ${publicLink.url}`);
      return publicLink;
    } catch (error) {
      console.error(`❌ Failed to create public link: ${error.message}`);
      throw error;
    }
  }

  async closeRun(runId) {
    try {
      console.log(`Closing TestRail run ${runId}...`);
      await this.api.robustApiCall(() => this.api.closeRun(runId));
      console.log(`✅ TestRail run ${runId} closed successfully`);
    } catch (error) {
      console.error(`❌ Failed to close run: ${error.message}`);
      throw error;
    }
  }

  async getRunSummary(runId) {
    try {
      const run = await this.api.getRun(runId);
      const results = await this.api.getResultsForRun(runId);
      
      const summary = {
        id: run.id,
        name: run.name,
        status: run.status,
        total: results.length,
        passed: results.filter(r => r.status_id === 1).length,
        failed: results.filter(r => r.status_id === 5).length,
        blocked: results.filter(r => r.status_id === 2).length,
        retest: results.filter(r => r.status_id === 4).length,
        untested: results.filter(r => r.status_id === 3).length
      };

      return summary;
    } catch (error) {
      console.error(`Error getting run summary: ${error.message}`);
      throw error;
    }
  }
}

// Export for use in other modules
export { TestRailIntegration };

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const config = {
    host: process.env.TESTRAIL_HOST,
    username: process.env.TESTRAIL_USER,
    apiKey: process.env.TESTRAIL_API_KEY,
    projectId: process.env.TESTRAIL_PROJECT_ID,
    suiteId: process.env.TESTRAIL_SUITE_ID
  };

  const integration = new TestRailIntegration(config);
  
  // Example usage
  const command = process.argv[2];
  const runId = process.argv[3];

  switch (command) {
    case 'attach-videos':
      integration.attachVideosForFailedTests(runId)
        .then(attachments => console.log(`Attached ${attachments.length} videos`))
        .catch(console.error);
      break;
      
    case 'create-public-link':
      integration.createPublicReport(runId)
        .then(link => console.log(`Public link: ${link.url}`))
        .catch(console.error);
      break;
      
    case 'close-run':
      integration.closeRun(runId)
        .then(() => console.log('Run closed successfully'))
        .catch(console.error);
      break;
      
    default:
      console.log('Usage: node testrail-integration.js [attach-videos|create-public-link|close-run] <runId>');
  }
}
