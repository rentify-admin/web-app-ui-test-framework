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
import { FlakyTestAnalyzer } from './flaky-test-analyzer.js';

// Get command line arguments
const [,, workflowName, environment, runId, resultsFile, testrailRunId, publicReportUrl, flakyAnalysisFile] = process.argv;

if (!workflowName || !environment || !runId || !resultsFile) {
    console.error('Usage: node scripts/slack-notification.js <workflow-name> <environment> <run-id> <results-file> [testrail-run-id] [public-report-url] [flaky-analysis-file]');
    process.exit(1);
}

// Get environment variables
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
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
    const failedMatches = content.match(/<testcase[^>]*name="([^"]*)"[^>]*>\s*<failure/g);
    
    if (!failedMatches) return '';
    
    const failedNames = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
        const match = line.match(/<testcase[^>]*name="([^"]*)"[^>]*>/);
        if (match) {
            const testName = match[1];
            const nextLine = lines[lines.indexOf(line) + 1];
            if (nextLine && nextLine.includes('<failure')) {
                failedNames.push(testName);
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

function createSlackMessage(workflowName, environment, runId, results, status, visualDots, duration, failedTestNames, testrailRunId, publicReportUrl, flakyAnalysisFile) {
    const currentTime = new Date().toISOString();
    const pipelineType = environment === 'develop' ? 'UI' : 'API';
    
    // Create TestRail link if run ID is available
    let testrailLink = '';
    console.log(`🔍 Debug - testrailRunId: ${testrailRunId}, TESTRAIL_HOST: ${TESTRAIL_HOST}`);
    console.log(`🔍 Debug - testrailRunId type: ${typeof testrailRunId}, length: ${testrailRunId ? testrailRunId.length : 0}`);
    console.log(`🔍 Debug - TESTRAIL_HOST type: ${typeof TESTRAIL_HOST}, length: ${TESTRAIL_HOST ? TESTRAIL_HOST.length : 0}`);
    
    if (testrailRunId && TESTRAIL_HOST) {
        // Convert TestRail API host to web URL format
        const testrailWebUrl = TESTRAIL_HOST.replace('/api/', '/index.php?/runs/view/');
        testrailLink = `${testrailWebUrl}${testrailRunId}&group_by=cases:section_id&group_order=asc&display=tree`;
        console.log(`🔗 TestRail link constructed: ${testrailLink}`);
        console.log(`🔗 TestRail link length: ${testrailLink.length}`);
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
        linksText += `\n• <${testrailLink}|TestRail Report>`;
        console.log(`✅ TestRail link added to Slack message`);
    } else {
        console.log(`❌ TestRail link not added - link is empty`);
    }
    if (publicReportUrl) {
        linksText += `\n• <${publicReportUrl}|Public Report>`;
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
        publicReportUrl,
        flakyAnalysisFile
    );
    
    const success = await sendSlackNotification(message);
    process.exit(success ? 0 : 1);
}

main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
});
