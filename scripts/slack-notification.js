#!/usr/bin/env node

/**
 * Slack Notification Script for Test Results
 * 
 * Usage:
 * node scripts/slack-notification.js <workflow-name> <environment> <run-id> <results-file>
 * 
 * Example:
 * node scripts/slack-notification.js "Daily Regression Tests" "develop" "16831267668" "playwright-report/results.xml"
 */

import fs from 'fs';
import path from 'path';
import { FlakyTestAnalyzer } from './flaky_analysis/flaky-test-analyzer.js';

// Get command line arguments
const [,, workflowName, environment, runId, resultsFile, testrailRunId, publicReportUrl, flakyAnalysisFile] = process.argv;

if (!workflowName || !environment || !runId || !resultsFile) {
    console.error('Usage: node scripts/slack-notification.js <workflow-name> <environment> <run-id> <results-file> [testrail-run-id] [public-report-url] [flaky-analysis-file]');
    process.exit(1);
}

// Get environment variables
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_UPLOAD_CHANNEL = process.env.SLACK_UPLOAD_CHANNEL || 'general';
const GITHUB_SERVER_URL = process.env.GITHUB_SERVER_URL || 'https://github.com';
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
const GITHUB_ACTOR = process.env.GITHUB_ACTOR || 'unknown';
const TESTRAIL_HOST = process.env.TESTRAIL_HOST;
const TESTRAIL_PROJECT_NAME = process.env.TESTRAIL_PROJECT_NAME;

if (!SLACK_WEBHOOK_URL) {
    console.error('SLACK_WEBHOOK_URL environment variable is required');
    process.exit(1);
}

if (!GITHUB_REPOSITORY) {
    console.error('GITHUB_REPOSITORY environment variable is required');
    process.exit(1);
}

function parseTestResults(filePath) {
    if (!fs.existsSync(filePath)) {
        console.log(`Results file not found: ${filePath}`);
        return {
            total: 0,
            passed: 0,
            failed: 0,
            flaky: 0,
            skipped: 0
        };
    }

    // Use the FlakyTestAnalyzer for proper analysis
    const analyzer = new FlakyTestAnalyzer();
    const analysis = analyzer.analyzeTestResults(filePath);
    
    // Calculate totals from all tests (including stable ones)
    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    
    // Count from flaky tests
    analysis.flakyTests.forEach(test => {
        totalTests++;
        totalPassed += test.passes;
        totalFailed += test.fails;
        totalSkipped += test.skipped;
    });
    
    // Count from stable tests (we need to get this from the analyzer)
    const content = fs.readFileSync(filePath, 'utf8');
    const allTestCases = analyzer.extractTestCases(content);
    const testGroups = analyzer.groupTestCases(allTestCases);
    
    for (const [testName, cases] of testGroups) {
        // Skip if already counted in flaky tests
        if (analysis.flakyTests.find(t => t.name === testName)) {
            continue;
        }
        
        const testAnalysis = analyzer.analyzeTestGroup(testName, cases);
        totalTests++;
        totalPassed += testAnalysis.passes;
        totalFailed += testAnalysis.fails;
        totalSkipped += testAnalysis.skipped;
    }
    
    return {
        total: totalTests,
        passed: totalPassed,
        failed: totalFailed,
        flaky: analysis.flakyTests.length, // Number of flaky tests, not retries
        skipped: totalSkipped
    };
}

function generateVisualDots(results) {
    let dots = '';
    
    // Green dots for passed tests
    for (let i = 0; i < results.passed; i++) {
        dots += '🟢';
    }
    
    // Red dots for failed tests
    for (let i = 0; i < results.failed; i++) {
        dots += '🔴';
    }
    
    // Yellow dots for flaky tests (not skipped)
    for (let i = 0; i < results.flaky; i++) {
        dots += '🟡';
    }
    
    // Gray dots for skipped tests
    for (let i = 0; i < results.skipped; i++) {
        dots += '⚪';
    }
    
    return dots;
}

function determineStatus(results) {
    if (results.total === 0) {
        return {
            status: '❌ NO TESTS RUN',
            color: '#ff0000',
            emoji: '❌'
        };
    }
    
    const passRate = (results.passed / results.total) * 100;
    
    if (passRate === 100) {
        return {
            status: '✅ ALL TESTS PASSED',
            color: '#36a64f',
            emoji: '✅'
        };
    } else if (results.failed > 0) {
        return {
            status: '❌ TESTS FAILED',
            color: '#ff0000',
            emoji: '❌'
        };
    } else if (results.flaky > 0) {
        return {
            status: '⚠️ FLAKY TESTS DETECTED',
            color: '#ffa500',
            emoji: '⚠️'
        };
    } else {
        return {
            status: '⚠️ SOME TESTS SKIPPED',
            color: '#ffa500',
            emoji: '⚠️'
        };
    }
}

function calculateDuration(results) {
    // Simple duration calculation - in a real scenario you might want to parse actual timing
    if (results.total === 0) return '< 1s';
    if (results.total <= 5) return '~5s';
    if (results.total <= 10) return '~10s';
    return `~${Math.ceil(results.total * 2)}s`;
}

function getFailedTestNames(filePath) {
    if (!fs.existsSync(filePath)) return '';
    
    const content = fs.readFileSync(filePath, 'utf8');
    const failedNames = [];
    const lines = content.split('\n');
    let currentSuite = '';
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Track current test suite (describe block)
        const suiteMatch = line.match(/<testsuite[^>]*name="([^"]*)"[^>]*>/);
        if (suiteMatch) {
            currentSuite = suiteMatch[1];
        }
        
        // Find test cases with failures
        const testMatch = line.match(/<testcase[^>]*name="([^"]*)"[^>]*>/);
        if (testMatch) {
            const testName = testMatch[1];
            const nextLine = lines[i + 1];
            if (nextLine && nextLine.includes('<failure')) {
                // Format: Describe -> Test Name
                // Handle edge case: if suite already ends with " -> " or " › ", don't add another
                const separator = (currentSuite.endsWith(' -> ') || currentSuite.endsWith(' › ')) ? '' : ' -> ';
                failedNames.push(`${currentSuite}${separator}${testName}`);
            }
        }
    }
    
    return failedNames.slice(0, 5).map(name => `- ${name}`).join('\n');
}

function getFlakyAnalysisSummary(flakyAnalysisFile) {
    if (!flakyAnalysisFile || !fs.existsSync(flakyAnalysisFile)) {
        return null;
    }

    try {
        const analysis = JSON.parse(fs.readFileSync(flakyAnalysisFile, 'utf8'));
        return {
            total: analysis.summary?.total || 0,
            flaky: analysis.summary?.flaky || 0,
            threshold: analysis.summary?.threshold || 20,
            flakyTests: analysis.flakyTests || []
        };
    } catch (error) {
        console.error(`Error reading flaky analysis: ${error.message}`);
        return null;
    }
}

function createSlackMessage(workflowName, environment, runId, results, status, visualDots, duration, failedTestNames, testrailRunId, flakyAnalysisFile) {
    const currentTime = new Date().toISOString();
    const pipelineType = environment === 'develop' ? 'UI' : 'API';
    
    // Create TestRail link if run ID is available
    let testrailLink = '';
    console.log(`🔍 Debug - testrailRunId: ${testrailRunId}, TESTRAIL_HOST: ${TESTRAIL_HOST}`);
    console.log(`🔍 Debug - testrailRunId type: ${typeof testrailRunId}, length: ${testrailRunId ? testrailRunId.length : 0}`);
    console.log(`🔍 Debug - TESTRAIL_HOST type: ${typeof TESTRAIL_HOST}, length: ${TESTRAIL_HOST ? TESTRAIL_HOST.length : 0}`);
    
    if (testrailRunId && TESTRAIL_HOST) {
        // Convert TestRail API host to web URL format
        let testrailWebUrl;
        if (TESTRAIL_HOST.includes('/api/')) {
            testrailWebUrl = TESTRAIL_HOST.replace('/api/', '/index.php?/runs/view/');
        } else {
            // If TESTRAIL_HOST doesn't contain /api/, assume it's the base URL
            testrailWebUrl = `${TESTRAIL_HOST}/index.php?/runs/view/`;
        }
        testrailLink = `${testrailWebUrl}${testrailRunId}&group_by=cases:section_id&group_order=asc&display=tree`;
        console.log(`🔗 TestRail link constructed: ${testrailLink}`);
        console.log(`🔗 TestRail link length: ${testrailLink.length}`);
        
        // Validate the link format
        if (!testrailLink.startsWith('http')) {
            console.log(`⚠️ TestRail link doesn't start with http: ${testrailLink}`);
            testrailLink = ''; // Reset if invalid
        }
    } else {
        console.log(`❌ TestRail link not created - testrailRunId: ${testrailRunId}, TESTRAIL_HOST: ${TESTRAIL_HOST}`);
    }
    
    const message = {
        blocks: [
            {
                type: "header",
                text: {
                    type: "plain_text",
                    text: `${workflowName} - ${environment.charAt(0).toUpperCase() + environment.slice(1)}`
                }
            },
            {
                type: "section",
                fields: [
                    {
                        type: "mrkdwn",
                        text: `*📊 Total Tests:* ${results.total}`
                    },
                    {
                        type: "mrkdwn",
                        text: `*✅ Passed:* ${results.passed}`
                    },
                    {
                        type: "mrkdwn",
                        text: `*⚪ Skipped:* ${results.skipped}`
                    },
                    {
                        type: "mrkdwn",
                        text: `*❌ Failed:* ${results.failed}`
                    },
                    {
                        type: "mrkdwn",
                        text: `*⏱️ Duration:* ${duration}`
                    },
                    {
                        type: "mrkdwn",
                        text: `*🟡 Flaky:* ${results.flaky}`
                    }
                ]
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*Visual Test Results:*\n${visualDots}`
                }
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*${status.emoji} Status:* ${status.status} | Duration: ${duration}`
                }
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*🔗 Run ID:* ${runId}`
                }
            }
        ]
    };

    // Add failed tests section if there are failures
    if (results.failed > 0 && failedTestNames) {
        message.blocks.push({
            type: "section",
            text: {
                type: "mrkdwn",
                text: `*❌ Failed Tests (${results.failed}):*\n${failedTestNames}`
            }
        });
    }

    // Add flaky analysis section if available
    const flakyAnalysis = getFlakyAnalysisSummary(flakyAnalysisFile);
    if (flakyAnalysis && flakyAnalysis.flaky > 0) {
        const flakyTestNames = flakyAnalysis.flakyTests
            .slice(0, 3)
            .map(test => `- ${test.name}: ${test.flakinessPercent}% flaky (${test.passes}P/${test.fails}F)`)
            .join('\n');
        
        message.blocks.push({
            type: "section",
            text: {
                type: "mrkdwn",
                text: `*🟡 Flaky Tests (≥${flakyAnalysis.threshold}% threshold):*\n${flakyTestNames}`
            }
        });
    }

    // Add links section
    let linksText = `*🔗 Related Links:*\n• <${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${runId}|GitHub Actions Run>`;
    
    console.log(`🔗 Debug - testrailLink: ${testrailLink}`);
    console.log(`🔗 Debug - publicReportUrl: ${publicReportUrl}`);
    
    if (testrailLink) {
        linksText += `\n<${testrailLink}|TestRail Report>`;
        console.log(`✅ TestRail link added to Slack message`);
    } else {
        console.log(`❌ TestRail link not added - link is empty`);
    }

    
    message.blocks.push(
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: linksText
            }
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `*👤 Triggered by:* ${GITHUB_ACTOR}`
            }
        },
        {
            type: "context",
            elements: [
                {
                    type: "mrkdwn",
                    text: `🤖 Pipeline ${pipelineType} regression run | Generated at ${currentTime}`
                }
            ]
        }
    );

    return {
        ...message,
        attachments: [
            {
                color: status.color
            }
        ]
    };
}

async function sendSlackNotification(message) {
    try {
        const response = await fetch(SLACK_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        console.log('✅ Slack notification sent successfully');
        return true;
    } catch (error) {
        console.error('❌ Failed to send Slack notification:', error.message);
        return false;
    }
}

async function uploadFileToSlack(filePath, filename, fileType = 'auto') {
    try {
        const fs = await import('fs');
        if (!fs.existsSync(filePath)) {
            console.log(`⚠️ File not found: ${filePath}`);
            return null;
        }
        if (!SLACK_BOT_TOKEN) {
            console.log(`⚠️ SLACK_BOT_TOKEN not available, skipping file upload: ${filename}`);
            return null;
        }
        const { execSync } = await import('child_process');
        const safeFilename = filename.replace(/"/g, '\\"');
        const cmd = `curl -sS -f -X POST https://slack.com/api/files.upload -H "Authorization: Bearer ${SLACK_BOT_TOKEN}" -F channels=${SLACK_UPLOAD_CHANNEL} -F initial_comment=\"${safeFilename}\" -F file=@\"${filePath}\"`;
        let out;
        try {
            out = execSync(cmd, { encoding: 'utf8' });
        } catch (e) {
            console.error(`❌ Slack upload failed via curl: ${e.message}`);
            return null;
        }
        let parsed;
        try { parsed = JSON.parse(out); } catch { parsed = { ok: false, error: 'parse_error', raw: out }; }
        if (parsed.ok) {
            const permalink = parsed.file && parsed.file.permalink ? parsed.file.permalink : null;
            console.log(`✅ File uploaded to Slack: ${permalink || filename}`);
            return permalink;
        } else {
            console.error(`❌ Slack file upload failed: ${parsed.error || 'unknown_error'}`);
            return null;
        }
    } catch (error) {
        console.error(`❌ Failed to upload file to Slack: ${error.message}`);
        return null;
    }
}

// Main execution
async function main() {
    console.log(`📊 Processing test results for ${workflowName} in ${environment}`);
    
    const results = parseTestResults(resultsFile);
    const status = determineStatus(results);
    const visualDots = generateVisualDots(results);
    const duration = calculateDuration(results);
    const failedTestNames = getFailedTestNames(resultsFile);
    
    console.log('📈 Test Results:', results);
    console.log('🎯 Status:', status.status);
    
    const message = createSlackMessage(
        workflowName,
        environment,
        runId,
        results,
        status,
        visualDots,
        duration,
        failedTestNames,
        testrailRunId,
        flakyAnalysisFile
    );
    
    // Send the main notification first
    const success = await sendSlackNotification(message);
    
    // Upload PDF report if available
    const fs = await import('fs');
    let pdfFile = '';
    try {
        const { execSync } = await import('child_process');
        const latest = execSync('ls -1t testrail_reports/*.pdf 2>/dev/null | head -1', { encoding: 'utf8' }).trim();
        if (latest) pdfFile = latest;
    } catch {}
    if (!pdfFile) {
        const fallback = `testrail-report-${testrailRunId}.pdf`;
        if (fs.existsSync(fallback)) pdfFile = fallback;
    }
    if (pdfFile && fs.existsSync(pdfFile)) {
        console.log(`📄 Uploading PDF report: ${pdfFile}`);
        const pdfUrl = await uploadFileToSlack(pdfFile, pdfFile.split('/').pop());
        if (pdfUrl) {
            console.log(`✅ PDF report uploaded: ${pdfUrl}`);
        } else {
            console.log(`⚠️ PDF report upload failed`);
        }
    } else {
        console.log(`⚠️ PDF report not found in expected locations`);
    }
    
    // Upload failed test videos if available
    if (results.failed > 0) {
        const videoDir = 'test-results';
        if (fs.existsSync(videoDir)) {
            console.log(`🎥 Uploading failed test videos...`);
            const { execSync } = await import('child_process');
            
            try {
                const videoFiles = execSync(`find ${videoDir} -name "*.webm" -o -name "*.mp4"`, { encoding: 'utf8' }).trim().split('\n');
                
                if (videoFiles.length === 0 || (videoFiles.length === 1 && videoFiles[0] === '')) {
                    console.log(`⚠️ No video files found in ${videoDir}`);
                } else {
                    console.log(`📹 Found ${videoFiles.length} video files`);
                    
                    for (const videoFile of videoFiles) {
                        if (videoFile && fs.existsSync(videoFile)) {
                            const filename = videoFile.split('/').pop();
                            console.log(`📹 Uploading video: ${filename}`);
                            const videoUrl = await uploadFileToSlack(videoFile, filename);
                            if (videoUrl) {
                                console.log(`✅ Video uploaded: ${videoUrl}`);
                            } else {
                                console.log(`⚠️ Video upload failed: ${filename}`);
                            }
                        }
                    }
                }
            } catch (error) {
                console.log(`⚠️ Error finding video files: ${error.message}`);
            }
        } else {
            console.log(`⚠️ Video directory not found: ${videoDir}`);
        }
    } else {
        console.log(`ℹ️ No failed tests, skipping video uploads`);
    }
    
    process.exit(success ? 0 : 1);
}

main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
});
