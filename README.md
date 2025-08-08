# Web App UI Test Framework

This repository contains the UI test framework for the Verifast Web Application using Playwright.

## 🚀 Quick Start

### Prerequisites
- Node.js 20 or higher
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd web-app-ui-test-framework
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install Playwright browsers**
   ```bash
   npm run install-browsers
   ```

4. **Set up environment variables**
   ```bash
   # For development environment
   cp .env.develop .env
   
   # For staging environment
   cp .env.staging .env
   
   # Or use environment-specific scripts
   npm run test:develop  # Uses .env.develop
   npm run test:staging  # Uses .env.staging
   ```

### Running Tests

#### Basic Commands
```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests for specific browser
npm run test:chromium
npm run test:firefox
npm run test:webkit

# Run tests for specific environment
npm run test:develop  # Uses .env.develop
npm run test:staging  # Uses .env.staging
```

#### Advanced Commands
```bash
# Run E2E tests with browser installation
npm run e2e-test

# Run tests with TestRail integration
npm run run-all-tests-chromium
npm run run-all-tests-firefox
npm run run-all-tests-webkit

# Local regression testing with TestRail integration
npm run local-regression                    # Run against develop (default)
npm run local-regression:develop            # Run against develop environment
npm run local-regression:staging            # Run against staging environment
npm run local-regression:develop-no-uploads # Run develop without document upload tests
npm run local-regression:staging-no-uploads # Run staging without document upload tests
```

## 📁 Project Structure

```
web-app-ui-test-framework/
├── tests/
│   ├── *.spec.js              # Test files (25 files)
│   ├── utils/                 # Utility functions (20 files)
│   ├── scripts/               # Test scripts and automation
│   ├── test_config/           # Test configuration files
│   ├── test_files/            # Test resources and files
│   └── README.md              # Test documentation
├── scripts/                   # Local regression scripts
│   ├── local-regression-testrail.sh    # Main regression script
│   └── README-local-regression.md      # Script documentation
├── playwright.config.js       # Playwright configuration
├── package.json               # Dependencies and scripts
├── .gitignore                 # Git ignore rules
└── README.md                  # This file
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file with the following variables:

```bash
# Test Environment
APP_ENV=development
APP_URL=https://dev.verifast.app
API_URL=https://api-dev.verifast.app

# TestRail Integration
TESTRAIL_HOST=
TESTRAIL_PROJECT_ID=
TESTRAIL_SUITE_ID=
TESTRAIL_USER=
TESTRAIL_API_KEY=

# Slack Integration
SLACK_WEBHOOK_URL=
SLACK_BOT_TOKEN=

# GitHub Integration
GITHUB_TOKEN=
```

### Test Tags

Tests are organized using tags:
- `@core` - Core functionality tests
- `@smoke` - Smoke tests for critical paths
- `@regression` - Full regression test suite

## 🧪 Test Categories

### Core Tests (25 files)
- User permissions and authentication
- Application management
- Document upload and verification
- Financial workflows
- Property administration
- Staff user workflows
- Co-applicant scenarios
- Bank statement processing

### Test Utilities
- Session management
- Application workflows
- Permission checks
- Document handling
- Form interactions
- Page objects

## 🔄 CI/CD Integration

This framework integrates with:
- **GitHub Actions** - Automated test execution
- **TestRail** - Test case management and reporting
- **Slack** - Test result notifications

### Available Workflows

#### 1. Daily Regression Tests - Develop
- **Schedule**: Daily at 10:00 AM UTC
- **Environment**: Development
- **Browser**: Chromium
- **Features**: 
  - Automated TestRail test run creation
  - Slack notifications with detailed results
  - Manual trigger available

#### 2. Staging Regression Tests
- **Schedule**: On-demand (manual trigger)
- **Environment**: Staging or Production (selectable)
- **Browser**: Chromium
- **Features**:
  - Environment selection via workflow inputs
  - Automated TestRail test run creation
  - Slack notifications with detailed results

### Cross-Repository Workflow
The test framework is triggered by the main web-app repository and runs tests based on:
- Pull requests to develop branch
- Pushes to develop branch
- Pushes to staging branch

### Required GitHub Secrets
The workflows require the following secrets to be configured in the repository:

```bash
# TestRail Configuration
TESTRAIL_HOST=your-testrail-instance.testrail.io
TESTRAIL_PROJECT_ID=your-project-id
TESTRAIL_SUITE_ID=your-suite-id
TESTRAIL_USER=your-testrail-username
TESTRAIL_API_KEY=your-testrail-api-key

# Slack Integration
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/your/webhook/url
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
```

## 🧪 Local Regression Testing

The framework includes comprehensive local regression testing capabilities with TestRail integration.

### Local Regression Scripts

The `scripts/` directory contains:
- **`local-regression-testrail.sh`** - Main regression testing script
- **`README-local-regression.md`** - Detailed documentation

### Features

- **Environment Support**: Test against develop, staging, or custom environments
- **TestRail Integration**: Automatic upload of results to TestRail
- **Document Upload Filtering**: Option to skip document upload tests for faster feedback
- **Retry Configuration**: Configurable retries and timeouts
- **HTML Reports**: Automatic report generation and browser opening

### Prerequisites

1. **TestRail CLI**: Install with `pip3 install trcli`
2. **Environment Files**: Create `tests/.env.develop` and `tests/.env.staging`
3. **TestRail Credentials**: Configure in environment files

### Environment Files

Create environment files in the `tests/` directory:

```bash
# tests/.env.develop
TESTRAIL_HOST=https://verifast.testrail.io
TESTRAIL_API_KEY=your-api-key
TESTRAIL_PROJECT_NAME="Verifast Core"
TESTRAIL_USER=your-email@verifast.com
TESTRAIL_SUITE_ID=1
APP_URL=https://dev.verifast.app
API_URL=https://api-dev.verifast.app

# tests/.env.staging
TESTRAIL_HOST=https://verifast.testrail.io
TESTRAIL_API_KEY=your-api-key
TESTRAIL_PROJECT_NAME="Verifast Core"
TESTRAIL_USER=your-email@verifast.com
TESTRAIL_SUITE_ID=1
APP_URL=https://staging.verifast.app
API_URL=https://api-staging.verifast.app
```

For detailed usage instructions, see `scripts/README-local-regression.md`.

## 🛠️ Development

### Adding New Tests
1. Create a new `.spec.js` file in the `tests/` directory
2. Use existing utility functions from `tests/utils/`
3. Add appropriate tags for test categorization
4. Update documentation if needed

### Local Development
```bash
# Run tests in watch mode
npm run test:ui

# Run specific test file
npx playwright test tests/your-test.spec.js

# Run tests with specific tag
npx playwright test --grep "@smoke"
```

## 📊 Reporting

### Test Reports
- **HTML Reports**: Generated in `playwright-report/`
- **JUnit XML**: Available for CI/CD integration
- **TestRail Integration**: Automatic test case updates
- **Slack Notifications**: Real-time test results

### Viewing Reports
```bash
# Open HTML report
npx playwright show-report

# Generate PDF report
npm run generate-report
```

## 🚨 Troubleshooting

### Common Issues

1. **Browser Installation**
   ```bash
   npm run install-deps
   npm run install-browsers
   ```

2. **Environment Variables**
   - Ensure `.env` file exists
   - Check all required variables are set

3. **Test Failures**
   - Check application is running
   - Verify environment URLs are correct
   - Review test logs in `test-results/`

### Getting Help
- Check the test documentation in `tests/README.md`
- Review existing test examples
- Check GitHub Actions logs for CI/CD issues

## 📝 Contributing

1. Follow existing test patterns
2. Add appropriate tags to new tests
3. Update documentation as needed
4. Ensure tests pass locally before committing

## 🔗 Related Repositories

- **Web App**: Main application repository
- **API Test Framework**: Backend API testing
- **Test Documentation Bot**: Automated documentation

---

For more detailed information, see the test documentation in `tests/README.md`.
