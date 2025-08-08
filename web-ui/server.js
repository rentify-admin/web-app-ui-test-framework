const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const TestRailWebUI = require('./testrail-integration');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// GitHub configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = 'rentify-admin/web-app-ui-test-framework';

// TestRail configuration
const testrailConfig = {
    host: process.env.TESTRAIL_HOST,
    user: process.env.TESTRAIL_USER,
    apiKey: process.env.TESTRAIL_API_KEY,
    projectId: process.env.TESTRAIL_PROJECT_ID,
    suiteId: process.env.TESTRAIL_SUITE_ID
};

const testrail = new TestRailWebUI(testrailConfig);

// API endpoint to trigger GitHub Actions workflow
app.post('/api/trigger-workflow', async (req, res) => {
    try {
        const { case_ids, environment, browser, description, testrail_user } = req.body;

        if (!GITHUB_TOKEN) {
            return res.status(500).json({ 
                error: 'GitHub token not configured. Please set GITHUB_TOKEN environment variable.' 
            });
        }

        // Prepare the payload for GitHub Actions
        const payload = {
            event_type: 'testrail-run-request',
            client_payload: {
                case_ids: case_ids,
                environment: environment,
                browser: browser,
                description: description,
                testrail_user: testrail_user || 'web-ui'
            }
        };

        // Trigger GitHub Actions workflow
        const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
            method: 'POST',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        res.json({
            success: true,
            message: 'Workflow triggered successfully',
            workflow_id: result.id,
            github_actions_url: `https://github.com/${GITHUB_REPO}/actions`
        });

    } catch (error) {
        console.error('Error triggering workflow:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        github_token_configured: !!GITHUB_TOKEN,
        testrail_configured: !!(testrailConfig.host && testrailConfig.user && testrailConfig.apiKey)
    });
});

// API endpoint to get test cases
app.get('/api/test-cases', async (req, res) => {
    try {
        const cases = await testrail.getTestCases();
        res.json(cases);
    } catch (error) {
        console.error('Error fetching test cases:', error);
        res.status(500).json({ error: error.message });
    }
});

// API endpoint to get test cases by tag
app.get('/api/test-cases/tag/:tag', async (req, res) => {
    try {
        const cases = await testrail.getTestCasesByTag(req.params.tag);
        res.json(cases);
    } catch (error) {
        console.error('Error fetching test cases by tag:', error);
        res.status(500).json({ error: error.message });
    }
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Verifast Test Runner Web UI running on http://localhost:${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
    
    if (!GITHUB_TOKEN) {
        console.warn('⚠️  GITHUB_TOKEN not set. Please configure it to enable workflow triggering.');
    }
});
