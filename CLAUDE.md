# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Playwright-based E2E test framework for Verifast Web Application. Tests cover user permissions, application workflows, session management, document handling, and financial verification flows.

## Common Commands

```bash
# Run all tests
npm test

# Run tests with Playwright UI (visual debugging)
npm run test:ui

# Run single test file
npx playwright test tests/your-test.spec.js

# Run tests by tag
npx playwright test --grep "@core"
npx playwright test --grep "@smoke"
npx playwright test --grep "@regression"

# Run against specific environment
npm run test:develop   # Development (.env.develop)
npm run test:staging   # Staging (.env.staging)
npm run test:rc        # RC (.env.rc)

# Open last test report
npx playwright show-report

# Local regression with TestRail integration
npm run local-regression:develop
npm run local-regression:staging
```

## Environment Setup

Environment files live in the root directory (`.env.develop`, `.env.staging`, `.env.rc`). Key variables:
- `APP_URL` - Web app base URL
- `API_URL` - API base URL
- `TESTRAIL_*` - TestRail integration credentials

Environment is selected via `APP_ENV` env variable or the npm script used.

## Architecture

### Test Organization
- `tests/*.spec.js` - Main test files
- `tests/permissions-tests/` - Permission-based test suites
- `tests/credit-tests/` - Credit/background screening tests
- `tests/rent-budget-settings-tests/` - Rent budget configuration tests
- `tests/verisync-tests/` - VeriSync integration tests

### Utilities (`tests/utils/`)
Key utilities for test implementation:
- `api-data-manager.js` - API client for test data setup/cleanup with `ApiDataManager` class
- `session-generator.js` - `createPermissionTestSession()` creates complete test sessions
- `application-builder.js` - `ApplicationBuilder` class for programmatic app creation
- `session-utils.js` - `loginWith()`, `findSessionLocator()`, session navigation helpers
- `permission-checks.js` - Reusable permission assertion functions
- `section-checks.js` - UI section validation helpers
- `login-form.js` / `login-helper.js` - Login form automation
- `cleanup-helper.js` - Test cleanup utilities

### Configuration (`tests/test_config/`)
- `app.js` - Environment URLs from process.env
- `admin.js`, `user.js`, `staff.js` - Test user credentials
- `session.js` - Session configuration

### Test Fixtures
Import from `tests/fixtures/api-data-fixture.js` for `dataManager` fixture providing `ApiDataManager` instance:
```javascript
import { test, expect } from './fixtures/api-data-fixture';
```

### Mock Data
`tests/mock-data/` contains simulator payloads for identity, financial, and employment verification.

## Test Patterns

### Test Tagging
Tests use Playwright's tag system. Common tags:
- `@core` - Essential functionality (PR checks)
- `@smoke` - Core + additional smoke tests (develop push)
- `@regression` - Full suite (staging push)
- `@staging-ready`, `@rc-ready` - Environment-specific tests

```javascript
test('Test name', { tag: ['@core', '@smoke', '@regression'] }, async ({ page }) => {
  // test implementation
});
```

### Serial Test Suites
For tests sharing state (like a session), use serial mode:
```javascript
test.describe.configure({
  mode: 'serial',
  timeout: 240000
});
```

### Session Creation Pattern
```javascript
const { sessionId, applicantContext } = await createPermissionTestSession(adminPage, browser, {
  applicationName: 'Autotest - UI permissions tests',
  firstName: 'Test',
  lastName: 'User',
  email: `test-${Date.now()}@verifast.com`,
  rentBudget: '2500',
  useCorrectMockData: true
});
```

### API Data Management
```javascript
// Authenticate
await dataManager.authenticate(admin.email, admin.password);

// Create entities
await dataManager.createEntities({
  users: [{ email: 'test@verifast.com', ...overrides }],
  applications: [{ name: 'Test App', ...overrides }]
});

// Cleanup
await dataManager.cleanupAll();
```

## CI/CD Integration

- GitHub Actions runs tests on PR/push to develop/staging
- TestRail integration for test case management
- Slack notifications for test results
- Tests never block merges - run in parallel and report results
