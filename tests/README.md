# Automated Testing Suite (`/tests`)

This directory contains the end-to-end (E2E) and integration tests for the project, using [Playwright](https://playwright.dev/) as the main testing framework. The suite is designed to cover user flows, permissions, session management, and reporting, and is integrated with TestRail for test management and reporting.

## Structure Overview

```
tests/
  ├── application_flow_with_id_only.spec.js
  ├── user_permissions_verify.spec.js
  ├── user_flags_approve_reject_test.spec.js
  ├── staff_user_permissions_test.spec.js
  ├── utils/
  ├── test_files/
  └── test_config/
```

### Test Files

- **application_flow_with_id_only.spec.js**  
  Tests the "ID only" application flow, including admin login, application search, session generation, and applicant ID verification (with file upload).

- **user_permissions_verify.spec.js**  
  Comprehensive test suite for verifying user permissions, including session actions, flag management, report export, document upload, and more.

- **user_flags_approve_reject_test.spec.js**  
  Focuses on session flagging and the approve/reject workflow, including applicant session creation, flag visibility, and financial document upload.

- **staff_user_permissions_test.spec.js**  
  Tests staff role permissions, including user creation, application visibility, session details, and report export.

### `/utils` - Test Utilities

Reusable helpers and abstractions to keep test files clean and DRY:

- **login-form.js**  
  Functions to fill and submit the login form.

- **generate-session-form.js**  
  Functions to fill and submit the session generation form.

- **user-create-form.js**  
  Functions to fill and submit the user creation form.

- **applications-page.js**  
  Helpers to navigate and filter the applications page.

- **session-flow.js**  
  Automates the process of uploading financial statements during a session.

- **report-page.js**  
  Contains utilities for:
  - Approving and rejecting sessions (`checkSessionApproveReject`)
  - Checking the presence and correctness of session flags (`checkAllFlagsSection`)
  - Verifying UI elements related to session reports

- **wait-response.js**  
  Utility to wait for and parse JSON API responses, with error handling.

- **helper.js**  
  Small helpers for URL joining and regex escaping.

### `/test_files` - Test Resources

Contains files used as input for tests, such as:

- **test_bank_statement.pdf**  
  Used for simulating bank statement uploads in financial verification flows.

- **passport.jpg**  
  Used for simulating ID document uploads during applicant verification.

### `/test_config` - Test Configuration

Centralized configuration for test users and environments:

- **app.js**  
  Exposes environment variables for API and app URLs.

- **user.js**  
  Default test user credentials and organization/role.

- **admin.js**  
  Default admin credentials.

- **index.js**  
  Exports all configs for easy import.

## Test Selection Strategy

The CI/CD pipeline automatically selects tests based on the deployment context:

| Event Type | Branch | Test Tag | Test Count | Description |
|------------|--------|----------|------------|-------------|
| Pull Request | Any branch → develop | `@core` | 7 | Essential functionality tests |
| Push | develop | `@smoke` | 9 | Core + additional smoke tests |
| Push | staging | `@regression` | 23 | Full test suite |
| Other Events | Any other branch | `@core` | 7 | Default to core tests |

Tests are tagged using Playwright's proper tagging system:
```javascript
test('C37 - Financial verification flow', { tag: ['@core', '@smoke', '@regression'] }, async ({ page }) => {
  // Test implementation
});
```
```

## Report Generation & TestRail Integration

### Playwright Reports

- Each test run generates Playwright HTML reports in the `playwright-report/` directory
- Reports are compressed and uploaded as GitHub artifacts
- Video recordings are enabled for failed tests

### TestRail Integration

- **Dynamic Test Plans**: Creates TestRail plans on-the-fly for each browser and test type
- **PDF Reports**: Generates TestRail PDF reports (Run Summary) for each test run
- **Tag-based Filtering**: Supports dynamic tags and automatically includes matching test cases
- **Multi-browser Support**: Uses TestRail configurations to run the same suite across browsers

#### TestRail Scripts

- **publish-reports.js**: Creates TestRail plans, maps test cases, and publishes results
- **generate-testrail-report.js**: Generates PDF reports using TestRail API
- **notify_slack.js**: Sends Slack notifications with links to all reports

#### Example (from pipeline):

```yaml
- name: Publish results to TestRail
  run: |
    node tests/scripts/publish-reports.js \
      --tag "${{ steps.test_tag.outputs.tag }}" \
      --test-type "${{ steps.test_tag.outputs.test_type }}"

- name: Generate TestRail PDF Report
  run: |
    node tests/scripts/generate-testrail-report.js \
      --testrail-data '${{ steps.testrail_info.outputs.testrail_data }}' \
      --template-id 12345 \
      --output-file testrail-report-${{ github.run_id }}.pdf
```

## Quick Start

1. **Download the project from here:**
   https://github.com/your-org/your-repo

2. **Switch to the correct branch:**
   ```sh
    git checkout develop
    ```

3. **Change to the test folder:**
   ```sh
    cd verifast/web-app/tests
    ```

4. **Run all Playwright tests for a specific browser:**
   Use one of the following commands depending on the browser you want to test:

   - **Chromium:**
     ```sh
     npm run run-all-tests-chromium
     ```
   - **Firefox:**
     ```sh
     npm run run-all-tests-firefox
     ```
   - **WebKit:**
     ```sh
     npm run run-all-tests-webkit
     ```

   Each command will:
   - Run all Playwright tests for the selected browser
   - Generate a JUnit XML report for TestRail
   - Upload the results to TestRail
   - Open the HTML report automatically after the tests finish

5. **Run tests by tag:**
   ```sh
   # Run core tests only
   npx playwright test --grep "@core"
   
   # Run regression tests only
   npx playwright test --grep "@regression"
   
   # Run smoke tests only
   npx playwright test --grep "@smoke"
   ```

6. **Check the result reports here:**
   The HTML report will open automatically after the tests finish. If not, you can open it manually:
   ```sh
    npx playwright show-report
    ```
   The report is located in the `playwright-report/` folder. 

## Notes

- All test data (users, sessions, files) is generated and cleaned up automatically.
- Sensitive credentials are managed via environment variables and GitHub secrets.
- The suite is designed to be robust, maintainable, and easy to extend for new flows or integrations.
- Tests never block merges or deployments - they run in parallel and report results.
- Slack notifications include links to GitHub Actions, TestRail plans, Playwright HTML reports, and TestRail PDF reports. 