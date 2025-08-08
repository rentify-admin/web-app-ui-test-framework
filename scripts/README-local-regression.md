# Local Regression TestRail Script

This script runs all Playwright tests with retry configuration and generates TestRail reports. It uses environment files from the `tests/` directory.

## 🚀 Quick Start

### Prerequisites

1. **Node.js and npm** - Ensure you have Node.js installed
2. **TestRail CLI (trcli)** - Install with: `pip3 install trcli`
3. **Environment Files** - Located in `tests/.env.*` files

### Environment Files

The script uses environment files from the `tests/` directory:

- **`tests/.env.develop`** - Development environment configuration
- **`tests/.env.staging`** - Staging environment configuration

These files contain:
- TestRail credentials and configuration
- Application URLs
- Slack webhook settings
- GitHub variables

## 📋 Usage

### Basic Usage

```bash
# Run against develop environment (default)
npm run local-regression

# Run against staging environment
npm run local-regression:staging

# Run against develop environment
npm run local-regression:develop
```

### Skip Document Upload Tests

```bash
# Run develop without document upload tests
npm run local-regression:develop-no-uploads

# Run staging without document upload tests
npm run local-regression:staging-no-uploads
```

### Direct Script Usage

```bash
# Basic usage
./scripts/local-regression-testrail.sh

# With specific environment
./scripts/local-regression-testrail.sh --staging

# Skip document upload tests
./scripts/local-regression-testrail.sh --develop --skip-document-upload

# Custom environment file
./scripts/local-regression-testrail.sh --env production
```

## 🔧 Configuration

### Script Configuration

The script is configured with:
- **Browser**: Chromium (default)
- **Max Retries**: 3 per test
- **Timeout**: 5 minutes per test
- **TestRail Integration**: Automatic report generation

### Environment Variables

Required environment variables (set in `tests/.env.*` files):

```bash
# TestRail Configuration
TESTRAIL_HOST=https://verifast.testrail.io
TESTRAIL_API_KEY=your-api-key
TESTRAIL_PROJECT_NAME="Verifast Core"
TESTRAIL_USER=your-email@verifast.com
TESTRAIL_SUITE_ID=1

# Application URLs
APP_URL=https://dev.verifast.app  # or staging URL
API_URL=https://api-dev.verifast.app  # or staging API URL
```

## 📊 Test Execution

### What the Script Does

1. **Environment Setup**
   - Loads environment variables from `tests/.env.*` files
   - Validates required TestRail configuration
   - Installs npm dependencies and Playwright browsers

2. **Playwright Configuration**
   - Updates `playwright.config.js` for retries and timeout
   - Creates backup of original configuration
   - Restores original config on exit

3. **Test Execution**
   - Runs all tests with specified browser
   - Filters out `@document-upload` tests if requested
   - Generates JUnit XML report

4. **TestRail Integration**
   - Uploads results to TestRail using `trcli`
   - Creates test run with proper naming
   - Links results to TestRail cases

5. **Reporting**
   - Shows test results summary
   - Opens HTML report in browser
   - Displays failed test details

### Test Filtering

The script can exclude document upload tests:

```bash
# Exclude tests tagged with @document-upload
--skip-document-upload
```

This uses Playwright's `--grep-invert` option to filter out tests.

## 🛠️ Troubleshooting

### Common Issues

#### 1. Environment File Not Found
```
❌ Environment file not found: tests/.env.develop
```

**Solution**: Ensure environment files exist in `tests/` directory.

#### 2. Missing TestRail Variables
```
❌ Missing required environment variables: TESTRAIL_HOST
```

**Solution**: Check your `tests/.env.*` files for required variables.

#### 3. TRCLI Not Found
```
zsh: command not found: trcli
```

**Solution**: Install TestRail CLI:
```bash
pip3 install trcli
```

#### 4. Network Connectivity Issues
```
net::ERR_NAME_NOT_RESOLVED at https://dev.verifast.app/
```

**Solution**: 
- Check VPN connection
- Verify environment URLs are correct
- Try staging environment instead

### Debug Mode

To see more detailed output, you can run the script with verbose logging:

```bash
# Run with debug output
DEBUG=true ./scripts/local-regression-testrail.sh --develop
```

## 📈 Test Results

### Success Criteria

The script is successful when:
- ✅ All tests complete (pass/fail/skip)
- ✅ JUnit XML report is generated
- ✅ TestRail report is uploaded
- ✅ HTML report opens in browser

### Expected Output

```
========================================
  Local Regression Execution Script
========================================
Timestamp: 20241220_143022
Environment: develop
Environment File: tests/.env.develop
Test Run Name: Local Regression Run - develop - 20241220_143022
Browser: chromium
Max Retries: 3
Timeout per test: 300000ms
Skip Document Upload Tests: true

✅ All required environment variables are set
✅ Dependencies installed successfully
✅ Playwright configuration updated
✅ Tests completed
✅ TestRail report generated successfully

Test Results Summary
==================
Total tests: 25
Passed: 20
Failed: 3
Skipped: 2

========================================
  Local Regression Execution Complete!
========================================
```

## 🔄 Integration with CI/CD

This script is designed for local development and testing. For CI/CD integration, use the existing pipeline scripts:

- `tests/scripts/publish-reports.js` - For CI/CD TestRail integration
- `tests/scripts/notify_slack.js` - For Slack notifications
- `tests/scripts/generate-testrail-report.js` - For PDF report generation

## 📝 Best Practices

### 1. Environment Management
- Keep environment files in `tests/` directory
- Use different files for different environments
- Never commit sensitive credentials

### 2. Test Execution
- Run against staging for production-like testing
- Use document upload filtering for faster feedback
- Monitor test timeouts and adjust as needed

### 3. TestRail Integration
- Verify TestRail credentials before running
- Check TestRail case mapping
- Review uploaded results in TestRail

### 4. Troubleshooting
- Check environment file paths
- Verify network connectivity
- Review Playwright configuration
- Check TestRail API access

## 🎯 Next Steps

After running the script:

1. **Review HTML Report** - Check detailed test results
2. **Check TestRail** - Verify uploaded results
3. **Investigate Failures** - Debug any failed tests
4. **Update Tests** - Fix issues and re-run as needed

---

**Note**: This script is designed for local development and testing. For production CI/CD, use the existing pipeline integration scripts. 