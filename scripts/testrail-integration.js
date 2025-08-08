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
    if (!runId) {
      console.log('⚠️ No TestRail run ID provided, skipping video processing');
      return;
    }

    console.log(`🎥 Processing videos for TestRail run: ${runId}`);
    
    try {
      const videoFiles = this.findVideoFiles(testResultsDir);
      console.log(`Found ${videoFiles.length} video files to process...`);
      
      let attachedCount = 0;
      
      for (const videoFile of videoFiles) {
        try {
          const testName = this.extractTestNameFromFileName(videoFile);
          console.log(`🔍 Processing video for test: ${testName}`);
          
          if (!testName || testName === 'video') {
            console.log(`⚠️ Skipping video with invalid test name: ${videoFile}`);
            continue;
          }
          
          const caseId = await this.findCaseIdByTestName(testName);
          
          if (caseId) {
            console.log(`📎 Attaching video to case ${caseId} for test: ${testName}`);
            await this.attachVideo(runId, caseId, videoFile);
            attachedCount++;
          } else {
            console.log(`⚠️ No TestRail case found for test: ${testName}`);
          }
        } catch (error) {
          console.error(`❌ Error processing video ${videoFile}: ${error.message}`);
        }
      }
      
      console.log(`✅ Attached ${attachedCount} videos to TestRail cases`);
      return attachedCount;
    } catch (error) {
      console.error(`❌ Error in attachVideosForFailedTests: ${error.message}`);
      throw error;
    }
  }

  findVideoFiles(testResultsDir) {
    if (!fs.existsSync(testResultsDir)) {
      console.log(`No test results directory found: ${testResultsDir}`);
      return [];
    }

    const videoFiles = [];
    const videoExtensions = ['.webm', '.mp4', '.avi', '.mov'];

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
    return videoFiles;
  }

  extractTestNameFromFileName(fileName) {
    // Remove file extension
    const nameWithoutExt = fileName.replace(/\.(webm|mp4|avi)$/i, '');
    
    // Remove common suffixes like -retry1, -retry2, etc.
    const nameWithoutRetry = nameWithoutExt.replace(/-retry\d+$/, '');
    
    // Extract the actual test name from the path
    // Example: test-results/test-name-test-name-chromium/video.webm
    // Should extract: test-name-test-name
    const parts = nameWithoutRetry.split('/');
    const lastPart = parts[parts.length - 1];
    
    // Remove browser suffix if present
    const nameWithoutBrowser = lastPart.replace(/-chromium$/, '');
    
    // If the name is just "video", try to get it from the directory name
    if (nameWithoutBrowser === 'video') {
      const dirName = parts[parts.length - 2];
      if (dirName && dirName !== 'test-results') {
        return dirName.replace(/-chromium$/, '');
      }
    }
    
    return nameWithoutBrowser;
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

  async exportPdf(runId) {
    try {
      console.log(`📄 Exporting TestRail run ${runId} as PDF...`);
      
      // TestRail doesn't have a direct PDF export API, so we'll use the web interface
      const pdfUrl = `${this.api.host.replace('/api/', '/index.php?/runs/view/')}${runId}&format=pdf`;
      
      // Download the PDF using curl
      const { execSync } = await import('child_process');
      const fs = await import('fs');
      
      const pdfFilename = `testrail-report-${runId}.pdf`;
      const authHeader = `-H "Authorization: Basic ${Buffer.from(`${this.api.username}:${this.api.apiKey}`).toString('base64')}"`;
      
      try {
        execSync(`curl -L ${authHeader} "${pdfUrl}" -o "${pdfFilename}"`, { stdio: 'inherit' });
        
        if (fs.existsSync(pdfFilename)) {
          console.log(`✅ PDF exported successfully: ${pdfFilename}`);
          return pdfFilename;
        } else {
          console.log(`⚠️ PDF export failed, file not created`);
          return null;
        }
      } catch (curlError) {
        console.log(`⚠️ PDF export via curl failed: ${curlError.message}`);
        return null;
      }
    } catch (error) {
      console.error(`❌ Failed to export PDF: ${error.message}`);
      return null;
    }
  }

  async prepareSlackVideos(runId) {
    try {
      console.log(`📹 Preparing videos for Slack attachment...`);
      
      const fs = await import('fs');
      const path = await import('path');
      
      const videoDir = 'test-results';
      if (!fs.existsSync(videoDir)) {
        console.log(`⚠️ No test-results directory found`);
        return [];
      }
      
      const videoFiles = this.findVideoFiles(videoDir);
      const failedVideos = [];
      
      for (const videoFile of videoFiles) {
        const testName = this.extractTestNameFromFileName(videoFile);
        const caseId = await this.findCaseIdByTestName(testName);
        
        if (caseId) {
          failedVideos.push({
            path: videoFile,
            testName,
            caseId,
            filename: path.basename(videoFile)
          });
        }
      }
      
      console.log(`✅ Found ${failedVideos.length} videos for Slack attachment`);
      return failedVideos;
    } catch (error) {
      console.error(`❌ Failed to prepare videos for Slack: ${error.message}`);
      return [];
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
        .then(attachments => console.log(`Attached ${attachments} videos`))
        .catch(console.error);
      break;
      
    case 'export-pdf':
      integration.exportPdf(runId)
        .then(pdfFile => {
          if (pdfFile) {
            console.log(`PDF exported: ${pdfFile}`);
          } else {
            console.log('PDF export failed');
          }
        })
        .catch(console.error);
      break;
      
    case 'prepare-slack-videos':
      integration.prepareSlackVideos(runId)
        .then(videos => console.log(`Prepared ${videos.length} videos for Slack`))
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
      console.log('Usage: node testrail-integration.js [attach-videos|export-pdf|prepare-slack-videos|create-public-link|close-run] <runId>');
  }
}
