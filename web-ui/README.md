# 🚀 Verifast Test Runner Web UI

A beautiful web interface for selecting test cases and triggering GitHub Actions workflows to run Playwright tests.

## ✨ Features

- **🎯 Test Case Selection**: Choose specific test cases or use quick selectors (Smoke, Regression)
- **🌍 Environment Selection**: Run tests in develop, staging, or production
- **🌐 Browser Selection**: Choose Chromium, Firefox, or WebKit
- **📋 Custom Descriptions**: Add notes to your test runs
- **🔗 GitHub Integration**: Directly triggers GitHub Actions workflows
- **📱 Responsive Design**: Works on desktop and mobile
- **⚡ Real-time Feedback**: See workflow status and links

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd web-ui
npm install
```

### 2. Configure GitHub Token
Set your GitHub Personal Access Token as an environment variable:

```bash
export GITHUB_TOKEN=your_github_personal_access_token
```

**Required Token Permissions:**
- `repo` (Full control of private repositories)
- `workflow` (Update GitHub Action workflows)

### 3. Start the Server
```bash
npm start
```

The web UI will be available at: http://localhost:3000

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | Yes |
| `PORT` | Server port (default: 3000) | No |

### GitHub Repository

The web UI is configured to work with:
- **Repository**: `rentify-admin/web-app-ui-test-framework`
- **Workflow**: `testrail-trigger.yml`

## 📖 Usage

### 1. Open the Web UI
Navigate to http://localhost:3000

### 2. Select Environment
Choose from:
- **Develop**: Development environment
- **Staging**: Staging environment  
- **Production**: Production environment

### 3. Select Browser
Choose from:
- **Chromium**: Default browser
- **Firefox**: Firefox browser
- **WebKit**: Safari/WebKit browser

### 4. Select Test Cases
- **Individual Selection**: Check specific test cases
- **Quick Selectors**:
  - **Select All**: Choose all test cases
  - **Deselect All**: Clear all selections
  - **Smoke Tests**: Select only smoke tests
  - **Regression Tests**: Select only regression tests

### 5. Add Description (Optional)
Add any notes about the test run.

### 6. Run Tests
Click "🚀 Run Selected Tests" to trigger the GitHub Actions workflow.

## 🔗 Integration

### GitHub Actions Workflow
The web UI triggers the `testrail-trigger.yml` workflow with:
- Selected test case IDs
- Environment configuration
- Browser selection
- Custom description

### TestRail Integration
- Test results are automatically uploaded to TestRail
- Failed test videos are attached to TestRail cases
- Public reports are generated with QR codes
- Slack notifications are sent with all links

## 🛠️ Development

### Local Development
```bash
npm run dev
```

This starts the server with nodemon for automatic restarts.

### API Endpoints

#### POST `/api/trigger-workflow`
Triggers a GitHub Actions workflow.

**Request Body:**
```json
{
  "case_ids": "1,2,3",
  "environment": "develop",
  "browser": "chromium",
  "description": "Custom test run",
  "testrail_user": "web-ui"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Workflow triggered successfully",
  "workflow_id": "123456",
  "github_actions_url": "https://github.com/rentify-admin/web-app-ui-test-framework/actions"
}
```

#### GET `/api/health`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "github_token_configured": true
}
```

## 🚀 Deployment

### Option 1: Local Deployment
```bash
npm start
```

### Option 2: Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Option 3: Cloud Deployment
Deploy to platforms like:
- **Vercel**: Serverless deployment
- **Heroku**: Container deployment
- **AWS**: EC2 or Lambda deployment
- **Google Cloud**: App Engine or Cloud Run

## 🔒 Security

### GitHub Token Security
- Store tokens securely (use environment variables)
- Use tokens with minimal required permissions
- Rotate tokens regularly
- Never commit tokens to version control

### CORS Configuration
The web UI is designed for local use. For production deployment, configure CORS appropriately.

## 🐛 Troubleshooting

### Common Issues

#### 1. "GitHub token not configured"
**Solution**: Set the `GITHUB_TOKEN` environment variable.

#### 2. "GitHub API error: 401"
**Solution**: Check token permissions and validity.

#### 3. "GitHub API error: 404"
**Solution**: Verify repository name and workflow file exists.

#### 4. Workflow not triggered
**Solution**: Check GitHub Actions logs and webhook configuration.

### Debug Mode
Enable debug logging:
```bash
DEBUG=* npm start
```

## 📞 Support

For issues and questions:
1. Check the troubleshooting section
2. Review GitHub Actions logs
3. Check the main test framework documentation

## 🔄 Updates

To update the web UI:
1. Pull latest changes
2. Run `npm install` (if dependencies changed)
3. Restart the server

---

**Happy Testing! 🚀**
