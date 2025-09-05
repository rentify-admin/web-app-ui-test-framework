# Verifast Web-App UI Test Framework — Comprehensive Documentation

## Repository Overview

### Purpose
- **Repository**: `@web-app-ui-test-framework/`
- **Goal**: End-to-end and integration UI testing for the Verifast Web Application.
- **Tech Stack**: Playwright, Node.js (ESM), TestRail integration, Slack notifications, GitHub Actions.

### High-level Capabilities
- Tag-driven test selection (`@core`, `@smoke`, `@regression`, `@document-upload`).
- Local and CI execution with retries, HTML/JUnit reports, and video on failure.
- TestRail automation: run creation, JUnit upload (TRCLI), public report links, PDF export, video attachments.
- Slack notifications with pass/fail summaries, links, optional file uploads, and flaky analysis summary.

## Repository Structure

```
web-app-ui-test-framework/
├── .github/workflows/                # CI workflows (daily develop, staging, TestRail-trigger)
├── scripts/                          # TestRail, flaky analysis, Slack, local regression
│   ├── flaky_analysis/               # Flakiness analyzer and tagger
│   ├── create-public-report.js       # Public TestRail report + QR code
│   ├── run-selected-tests.js         # Run only mapped TestRail cases
│   ├── setup-testrail-webhook*.js    # Webhook config and manual guide
│   ├── slack-notification.js         # Slack message + uploads
│   ├── test-case-mapper.js           # Case-title ↔ test-name mapping
│   ├── test-enhanced-features.js     # Capability self-test (TestRail + Slack)
│   └── local-regression-testrail.sh  # Local regression runner with TRCLI
├── tests/                            # Playwright tests and util modules
│   ├── *.spec.js                     # Specs (application, permissions, financial, heartbeat, etc.)
│   ├── heartbeat_completed_application_click_check.spec.js  # New heartbeat coverage
│   ├── frontend_heartbeat.spec.js    # Heartbeat/system checks
│   ├── frontent-session-heartbeat.spec.js                   # Session heartbeat
│   ├── utils/                        # Page objects, flows, helpers
│   │   ├── session-flow.js           # Core flows: Plaid, uploads, Persona ID, waits
│   │   ├── applications-page.js      # App table/search/invite/edit helpers
│   │   ├── application-management.js # Create/edit workflows end-to-end
│   │   ├── document-upload-utils.js  # Upload + verification helpers
│   │   ├── report-page.js            # Report assertions and navigation
│   │   ├── login-form.js             # Auth helpers
│   │   ├── api-data-manager.js       # Dynamic test data and cleanup
│   │   └── ...
│   ├── test_config/                  # App/API URLs and credentials fixtures
│   └── test_files/                   # Sample files: bank statements, paystubs, ID images
├── playwright.config.js              # Retries, reporters, baseURL, device/project config
├── package.json                      # Scripts and deps
├── jsconfig.json                     # Path mapping for `~/*`
└── REPOSITORY_DOCUMENTATION.md       # This document
```

## Execution & Scripts

### NPM Scripts (from `package.json`)
- `test`: Run tests (all) with Playwright.
- `test:ui`: Open Playwright UI mode.
- `test:chromium|firefox|webkit`: Browser-specific runs.
- `test:develop|test:staging`: One-off runs with `APP_ENV` set.
- `test:develop-progress|test:staging-progress`: Run with simple progress wrapper.
- `install-browsers|install-deps`: Install Playwright and system deps.
- `e2e-test|e2e-ui`: Install then run tests (CLI or UI).
- `run-all-tests-<browser>`: Run, emit JUnit to `playwright-report/results-<browser>.xml`, upload to TestRail via TRCLI, then open HTML report.
- Local regression (TestRail integrated):
  - `local-regression`
  - `local-regression:develop|staging`
  - `local-regression:*‑no-uploads` (omit `@document-upload`)
- TestRail helpers:
  - `testrail:setup-webhook|test|simulate` (manual config flow)
  - `testrail:generate-mapping|validate` (case ↔ test mapping)
  - `testrail:run-selected|list` (selective execution by case IDs)
  - `testrail:create-public-report` (public link + QR)
- Flaky analysis & tagging:
  - `flaky:analyze` (defaults)
  - `flaky:analyze:strict|lenient` (threshold/min-runs)
  - `flaky:tag` (add `@flaky` to tests found)
  - `flaky:clean` (remove `@flaky` tags)

### Typical Local Commands
```bash
# All tests (chromium project by default)
npm test

# Run by tag
npx playwright test --grep "@core"
npx playwright test --grep "@regression"
npx playwright test --grep-invert "@document-upload"

# Local regression (develop) with TestRail upload
npm run local-regression:develop

# Open HTML report
npx playwright show-report
```

## Playwright Configuration

Key settings from `playwright.config.js`:
- `fullyParallel: true`, `workers: 1` on CI for stability.
- `retries: 3` (CI and local) and `timeout: 100_000` per test.
- Reporters: `html`, `junit` → `playwright-report/results.xml`, and `list`.
- `use.baseURL = process.env.APP_URL`.
- `use.trace = 'on-first-retry'`.
- `use.video = 'retain-on-failure'`.
- Project: `chromium` with permissive context options for media/clipboard.
- Env file auto-load: `APP_ENV` → `.env.develop` or `.env.staging`.

## CI/CD Workflows (GitHub Actions)

### 1) Daily Regression Tests — Develop (`.github/workflows/daily-regression-develop.yml`)
- Trigger: Cron daily at 10:00 UTC + manual.
- Stack: Node 20, `npx playwright install --with-deps chromium`.
- Run: `npx playwright test --project=chromium --grep-invert "@document-upload"`.
- Artifacts: `playwright-report/`, `test-results/`.
- TestRail: parse `playwright-report/results.xml` with TRCLI; set custom fields (`custom_environment:development`, `custom_browser:chromium`). Extract run ID for downstream.
- Optional: TRCLI report run to produce PDFs.
- Extras: Export PDF via `scripts/testrail-integration.js export-pdf <runId>`, attach videos, flaky analysis/tagging, Slack notification with links + analysis JSON.

### 2) Staging Regression Tests (`.github/workflows/staging-regression.yml`)
- Trigger: Manual with `environment` choice (`staging|production`).
- Sets `APP_ENV`, `APP_URL`, `API_URL` from repo variables.
- Run: Focused heartbeat (`--grep "C40 - Frontend Heartbeat"`).
- Artifacts, TestRail upload, PDF creation, flaky analysis, Slack notification similar to daily develop.

### 3) TestRail Triggered Tests (`.github/workflows/testrail-trigger.yml`)
- Trigger: `repository_dispatch` (`testrail-run-request`).
- Payload parsing: `run_id`, `case_ids`, `environment`, `testrail_user`.
- Env resolution: `develop` or `staging` from payload/description/references fallback.
- Test filter: Generated via `scripts/test-case-mapper.js filter` based on case titles → test names; fallback to `--grep-invert '@document-upload'`.
- Run: `npx playwright test --project=chromium $TEST_FILTER`.
- Upload to TestRail (TRCLI), flaky analysis, attach failed videos, create public report, Slack notify, and close original triggering run.

### Required GitHub Secrets/Vars
- Secrets: `TESTRAIL_HOST`, `TESTRAIL_PROJECT_ID`, `TESTRAIL_SUITE_ID`, `TESTRAIL_PROJECT_NAME`, `TESTRAIL_USER`, `TESTRAIL_API_KEY`, `SLACK_WEBHOOK_URL`, `SLACK_BOT_TOKEN`.
- Vars (example fallbacks used): `APP_URL`, `API_URL`, `STAGING_APP_URL`, `STAGING_API_URL`, `PROD_APP_URL`, `PROD_API_URL`, `SLACK_UPLOAD_CHANNEL`.

## Test Inventory & Categories

### Representative Areas
- **Application Management**: create, edit, ID template settings, workflow isolation, copy/invite flows.
- **Financial & Documents**: Plaid (positive/negative), MX attempts, bank statement parsing, paystub uploads, PDF downloads.
- **Co-Applicant & Household**: income ratio effects, household with flag errors, multi-applicant flows.
- **Permissions & Roles**: staff/user/org member permissions, property admin.
- **System/Heartbeat**: session heartbeat, skip-button visibility, completed application heartbeat checks.

### Notable Specs (examples)
- `application_create_delete_test.spec.js`, `application_edit_id_template_settings.spec.js`
- `application_flow_with_id_only.spec.js` (`@document-upload`)
- `bank_statement_transaction_parsing.spec.js`
- `check_coapp_income_ratio_exceede_flag.spec.js`
- `co_app_household_with_flag_errors.spec.js`
- `staff_user_permissions_test.spec.js`, `user_permissions_verify.spec.js`, `property_admin_permission_test.spec.js`
- `frontend_heartbeat.spec.js`, `frontent-session-heartbeat.spec.js`, `heartbeat_completed_application_click_check.spec.js`
- `skip_button_visibility_logic.spec.js`

### Utilities (selected)
- `tests/utils/session-flow.js`: Persona ID, Plaid connect, uploads, waits, helpers for rent/state/applicant selection; robust waiters (`waitForPlaidConnectionCompletion`, `waitForPaystubConnectionCompletion`).
- `tests/utils/report-page.js`: flag checks (`markFlagAsIssue|NonIssue`), financial section validation, PDF export, navigation helpers.
- `tests/utils/applications-page.js`: search, invite, edit workflow, persona template utilities.
- `tests/utils/document-upload-utils.js`: paystub document upload and verification.
- `tests/utils/api-data-manager.js`: entity create/cleanup with auth and UUID helpers.

## Environment & Configuration

### Env Files
- `.env.develop` and `.env.staging` are auto-loaded via `APP_ENV`.

### Required Variables (local/CI)
```bash
# App/API endpoints
APP_ENV=development|staging
APP_URL=https://dev.verifast.app
API_URL=https://api-dev.verifast.app

# TestRail
TESTRAIL_HOST=https://<org>.testrail.io
TESTRAIL_PROJECT_ID=<id>
TESTRAIL_SUITE_ID=<id>
TESTRAIL_PROJECT_NAME="Verifast Core"
TESTRAIL_USER=<email>
TESTRAIL_API_KEY=<key>

# Slack (optional uploads require bot token)
SLACK_WEBHOOK_URL=
SLACK_BOT_TOKEN=
SLACK_UPLOAD_CHANNEL=
```

### Dependencies
- Node.js 20+
- Playwright browsers (`npx playwright install --with-deps` on CI)
- TRCLI (`pip install trcli`) for TestRail JUnit upload

## Reporting & Integrations

### Reports
- HTML: `playwright-report/` (open via `npx playwright show-report`).
- JUnit XML: `playwright-report/results.xml` (or browser-specific variants).

### TestRail
- Upload via TRCLI in workflows and local regression script.
- Public report links and QR via `scripts/create-public-report.js`.
- Optional PDF export via `scripts/testrail-integration.js export-pdf <runId>`.
- Failed test videos attached to cases when matched; always prepared for Slack uploads.

### Slack
- `scripts/slack-notification.js` builds a rich summary with:
  - Totals, pass/fail/flaky/skipped counts.
  - Visual dot bar, duration heuristic.
  - Links: GitHub Actions run, TestRail run, optional public report.
  - Optional uploads: latest TestRail PDF, failed test videos (requires `SLACK_BOT_TOKEN`).

### Flaky Analysis
- `scripts/flaky_analysis/flaky-test-analyzer.js` parses JUnit to compute flakiness with thresholds and min run counts; exports JSON.
- `scripts/flaky_analysis/flaky-test-tagger.js` can tag tests with `@flaky` or clean them.

## Operational Guidance

### Local Regression (with TestRail)
```bash
# Default (develop)
npm run local-regression

# Staging
npm run local-regression:staging

# Skip document uploads (faster feedback)
npm run local-regression:develop-no-uploads
```
What it does:
- Loads `tests/.env.*`, validates TestRail vars.
- Installs deps and browsers, sets retries/timeout, runs Playwright.
- Produces JUnit XML and uploads via TRCLI, prints summary, opens HTML report.

### Selective Test Runs from TestRail
```bash
# Generate/update mapping from TestRail case titles to Playwright tests
npm run testrail:generate-mapping

# Run a subset by case IDs (creates run, filters tests, uploads results)
npm run testrail:run-selected
```

## Maintenance & Best Practices
- Keep selectors stable using `data-testid` where available.
- Prefer utility helpers over inline logic; expand `tests/utils/` as needed.
- Use tags for intent grouping and pipeline selection.
- Avoid hardcoding secrets; rely on env/secrets.
- Video on failure and trace on first retry are enabled for debuggability.

## Troubleshooting
- Browser install issues: `npm run install-deps && npm run install-browsers`.
- No tests run / 0 totals: verify `APP_URL`, `API_URL`, and network/VPN access.
- TRCLI missing: `pip install trcli` and ensure it’s on `PATH`.
- Slack upload failures: ensure `SLACK_BOT_TOKEN` and channel are set.
- Heartbeat/skip tests: validate feature flags and test data availability.

## Recent Changes & Notes
- Updated heartbeat coverage: `tests/heartbeat_completed_application_click_check.spec.js` added.
- Multiple test updates to permissions, heartbeat, and `tests/utils/session-flow.js` for stability and waits.
- CI workflows enhanced for robust TestRail run extraction, PDF export, flaky tagging, and Slack messaging.

---

Documentation Version: 1.1  
Last Updated: 2025-09-02  
Repository Status: Active Development  
Test Coverage: Extensive (multi-domain specs, utilities)  
CI/CD: Scheduled daily (develop), on-demand (staging), and TestRail-triggered runs


