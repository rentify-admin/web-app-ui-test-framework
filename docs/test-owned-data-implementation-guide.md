# Test-Owned Data Implementation Guide
## Practical Reference for Test Engineers

**Status**: Recommended Alternative to Option D
**Timeline**: 12 weeks phased implementation
**Risk Level**: LOW (incremental, reversible)

---

## Table of Contents
1. [Quick Start](#quick-start)
2. [Factory Pattern Reference](#factory-pattern-reference)
3. [Migration Checklist](#migration-checklist)
4. [Code Examples](#code-examples)
5. [Troubleshooting](#troubleshooting)

---

## Quick Start

### For Test Developers (After Migration)

**Old Pattern (Depends on Seeders)**:
```javascript
test('My test', async ({ page }) => {
    // Search for seeded application (brittle)
    await searchApplication(page, 'AutoTest - Financial Only, MX and Plaid');

    // Create session (good - already isolated)
    const session = await generateSessionForm.submit(page);
});
```

**New Pattern (Test-Owned Data)**:
```javascript
import { ApplicationFactory, SessionFactory } from '~/tests/factories';
import { useTestData } from '~/tests/fixtures';

test('My test', async ({ page, testData }) => {
    // Create application on-demand (isolated, no seeder dependency)
    const app = await testData.applications.create({
        applicationName: 'My Test App',
        enableMX: true
    });

    // Use created application
    await searchApplication(page, app.name);

    // Create session (same as before)
    const session = await testData.sessions.create({
        applicationId: app.id,
        userData: { first_name: 'Test', last_name: 'User' }
    });

    // Cleanup automatic via testData fixture
});
```

**Key Changes**:
1. Import factories and fixture
2. Create application via factory instead of searching seeded data
3. Cleanup handled automatically
4. Test is self-contained and isolated

---

## Factory Pattern Reference

### 1. ApplicationFactory

**Location**: `/Users/isecco/Code/verifast/web-app-ui-test-framework/tests/factories/application-factory.js`

```javascript
import { randomUUID } from 'crypto';
import { app as appConfig } from '~/tests/test_config';

/**
 * Factory for creating test applications via API
 * Tracks created applications for automatic cleanup
 *
 * @example
 * const factory = new ApplicationFactory(request, authToken);
 * const app = await factory.create({ applicationName: 'Test App' });
 * await factory.cleanup(); // Delete all created applications
 */
export class ApplicationFactory {
    constructor(apiRequestContext, authToken) {
        this.api = apiRequestContext;
        this.token = authToken;
        this.created = []; // Track for cleanup
        this.baseUrl = appConfig.urls.api;
    }

    /**
     * Create application with sensible defaults
     * @param {Object} config - Application configuration
     * @returns {Promise<Object>} Created application data
     */
    async create(config = {}) {
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substr(2, 9);

        const defaults = {
            organizationName: 'Verifast',
            applicationName: `AutoTest_${timestamp}_${randomId}`,
            applicantTypes: ['Affordable Occupant'], // Safe default
            workflowTemplate: 'basic-workflow',
            flagCollection: 'Standard',
            minimumAmount: '500',
            enableMX: false,
            enablePlaid: false,
            // Add other sensible defaults
        };

        const appConfig = { ...defaults, ...config };

        console.log(`📝 Creating application: ${appConfig.applicationName}`);

        // Create via API (endpoint to be determined based on existing API structure)
        const response = await this.api.post(`${this.baseUrl}/applications`, {
            headers: {
                Authorization: `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            },
            data: appConfig
        });

        if (!response.ok()) {
            const errorText = await response.text();
            throw new Error(`Application creation failed: ${response.status()} - ${errorText}`);
        }

        const responseData = await response.json();
        const application = responseData.data;

        // Track for cleanup
        this.created.push(application.id);

        console.log(`✅ Created application: ${application.id} (${application.name})`);

        return application;
    }

    /**
     * Create application with specific workflow template
     * @param {string} templateName - Workflow template name
     * @param {Object} overrides - Additional configuration
     */
    async createWithWorkflow(templateName, overrides = {}) {
        return this.create({
            workflowTemplate: templateName,
            ...overrides
        });
    }

    /**
     * Create financial-only application (common pattern)
     */
    async createFinancialOnly(overrides = {}) {
        return this.create({
            applicantTypes: ['Financial Only'],
            enableMX: true,
            enablePlaid: true,
            workflowTemplate: 'financial-verification-only',
            ...overrides
        });
    }

    /**
     * Create full screening application (another common pattern)
     */
    async createFullScreening(overrides = {}) {
        return this.create({
            applicantTypes: ['Affordable Occupant', 'Affordable Primary'],
            workflowTemplate: 'Autotest-full-id-fin-employ-simulation',
            flagCollection: 'High Risk',
            ...overrides
        });
    }

    /**
     * Cleanup all created applications
     * Call in test.afterAll() or automatically via fixture
     */
    async cleanup() {
        if (this.created.length === 0) {
            console.log('ℹ️ No applications to cleanup');
            return;
        }

        console.log(`🧹 Cleaning up ${this.created.length} application(s)...`);

        for (const appId of this.created) {
            try {
                const deleteResponse = await this.api.delete(
                    `${this.baseUrl}/applications/${appId}`,
                    {
                        headers: { Authorization: `Bearer ${this.token}` }
                    }
                );

                if (deleteResponse.ok() || deleteResponse.status() === 204) {
                    console.log(`✅ Deleted application: ${appId}`);
                } else {
                    console.warn(`⚠️ Failed to delete application ${appId}: ${deleteResponse.status()}`);
                }
            } catch (error) {
                console.error(`❌ Error deleting application ${appId}:`, error.message);
            }
        }

        this.created = [];
    }

    /**
     * Get application by ID
     */
    async get(applicationId) {
        const response = await this.api.get(
            `${this.baseUrl}/applications/${applicationId}`,
            {
                headers: { Authorization: `Bearer ${this.token}` }
            }
        );

        if (!response.ok()) {
            throw new Error(`Get application failed: ${response.status()}`);
        }

        const data = await response.json();
        return data.data;
    }
}
```

### 2. SessionFactory (Enhanced Version)

**Location**: `/Users/isecco/Code/verifast/web-app-ui-test-framework/tests/factories/session-factory.js`

```javascript
import { randomUUID } from 'crypto';
import { app as appConfig } from '~/tests/test_config';
import { addPrefix, addEmailSuffix } from '~/tests/utils/naming-helper';

/**
 * Enhanced SessionFactory - builds on existing generate-session-form.js pattern
 * Provides API-first session creation for test isolation
 */
export class SessionFactory {
    constructor(apiRequestContext, authToken) {
        this.api = apiRequestContext;
        this.token = authToken;
        this.created = []; // Track for cleanup
        this.baseUrl = appConfig.urls.api;
    }

    /**
     * Create session via API (faster than UI flow)
     * @param {Object} config - Session configuration
     * @param {string} config.applicationId - Application ID (required)
     * @param {Object} config.userData - User data (optional)
     * @param {number} config.rentBudget - Rent budget (optional)
     */
    async create(config = {}) {
        if (!config.applicationId) {
            throw new Error('applicationId is required for session creation');
        }

        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substr(2, 6);

        const defaultUserData = {
            first_name: 'Test',
            last_name: 'User',
            email: 'test@verifast.com',
        };

        const userData = { ...defaultUserData, ...config.userData };

        // Apply naming conventions (consistent with existing pattern)
        const sessionData = {
            application_id: config.applicationId,
            first_name: addPrefix(userData.first_name),
            last_name: userData.last_name,
            email: addEmailSuffix(userData.email, randomSuffix),
            rent_budget: config.rentBudget || 500,
        };

        console.log(`📝 Creating session: ${sessionData.email}`);

        const response = await this.api.post(`${this.baseUrl}/sessions`, {
            headers: {
                Authorization: `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            },
            data: sessionData
        });

        if (!response.ok()) {
            const errorText = await response.text();
            throw new Error(`Session creation failed: ${response.status()} - ${errorText}`);
        }

        const responseData = await response.json();
        const session = responseData.data;

        // Track for cleanup (including co-applicants)
        this.created.push({
            id: session.id,
            children: session.children || []
        });

        console.log(`✅ Created session: ${session.id} (${sessionData.email})`);

        return session;
    }

    /**
     * Create session with co-applicant
     */
    async createWithCoApplicant(config = {}) {
        const primarySession = await this.create(config);

        // Create co-applicant session
        const coAppConfig = {
            ...config,
            userData: {
                first_name: 'CoApplicant',
                last_name: 'Test',
                email: 'coapp@verifast.com',
                ...config.coApplicantData
            }
        };

        const coApplicantSession = await this.create(coAppConfig);

        // Link co-applicant to primary (API endpoint to be determined)
        await this.linkCoApplicant(primarySession.id, coApplicantSession.id);

        return {
            primary: primarySession,
            coApplicant: coApplicantSession
        };
    }

    /**
     * Cleanup all created sessions
     */
    async cleanup() {
        if (this.created.length === 0) {
            console.log('ℹ️ No sessions to cleanup');
            return;
        }

        console.log(`🧹 Cleaning up ${this.created.length} session(s)...`);

        for (const sessionInfo of this.created) {
            try {
                // Delete co-applicants first (if any)
                if (sessionInfo.children && sessionInfo.children.length > 0) {
                    for (const child of sessionInfo.children) {
                        await this.deleteSession(child.id);
                    }
                }

                // Delete primary session
                await this.deleteSession(sessionInfo.id);
            } catch (error) {
                console.error(`❌ Error deleting session ${sessionInfo.id}:`, error.message);
            }
        }

        this.created = [];
    }

    async deleteSession(sessionId) {
        const deleteResponse = await this.api.delete(
            `${this.baseUrl}/sessions/${sessionId}`,
            {
                headers: { Authorization: `Bearer ${this.token}` }
            }
        );

        if (deleteResponse.ok() || deleteResponse.status() === 204) {
            console.log(`✅ Deleted session: ${sessionId}`);
        } else {
            console.warn(`⚠️ Failed to delete session ${sessionId}: ${deleteResponse.status()}`);
        }
    }

    async linkCoApplicant(primarySessionId, coApplicantSessionId) {
        // Implementation depends on API endpoint
        // This is a placeholder
        console.log(`🔗 Linking co-applicant ${coApplicantSessionId} to ${primarySessionId}`);
    }
}
```

### 3. Test Fixture (Auto-Cleanup)

**Location**: `/Users/isecco/Code/verifast/web-app-ui-test-framework/tests/fixtures/test-data-fixture.js`

```javascript
import { test as base } from '@playwright/test';
import { ApplicationFactory } from '~/tests/factories/application-factory';
import { SessionFactory } from '~/tests/factories/session-factory';
import { authenticateAdmin } from '~/tests/utils/cleanup-helper';

/**
 * Test data fixture - provides factories with automatic cleanup
 *
 * Usage:
 * import { test } from '~/tests/fixtures/test-data-fixture';
 *
 * test('My test', async ({ page, testData }) => {
 *   const app = await testData.applications.create({ ... });
 *   // Test logic
 *   // Cleanup automatic
 * });
 */
export const test = base.extend({
    testData: async ({ request }, use) => {
        // Authenticate once per test
        const authToken = await authenticateAdmin(request);

        // Create factory instances
        const applications = new ApplicationFactory(request, authToken);
        const sessions = new SessionFactory(request, authToken);

        // Provide to test
        await use({
            applications,
            sessions,
            authToken // In case test needs it directly
        });

        // Automatic cleanup after test
        console.log('🧹 Test data fixture: Starting automatic cleanup...');
        await sessions.cleanup();
        await applications.cleanup();
        console.log('✅ Test data fixture: Cleanup complete');
    }
});

export { expect } from '@playwright/test';
```

---

## Migration Checklist

### Phase 1: Foundation (Weeks 1-2)

**Week 1: Factory Implementation**
- [ ] Create `/tests/factories/` directory
- [ ] Implement ApplicationFactory
  - [ ] Basic create() method
  - [ ] Cleanup() method
  - [ ] Common preset methods (createFinancialOnly, etc.)
- [ ] Implement SessionFactory
  - [ ] Basic create() method
  - [ ] Cleanup() method
  - [ ] Co-applicant support
- [ ] Create test-data-fixture.js
- [ ] Unit test factories (create + cleanup)

**Week 2: Documentation & Examples**
- [ ] Write factory API documentation
- [ ] Create example test file
- [ ] Record demo video for team
- [ ] Present to team for feedback
- [ ] Adjust based on feedback

### Phase 2: Pilot (Weeks 3-4)

**Week 3: Convert Pilot Tests**
- [ ] Select 10 representative tests:
  - [ ] 2 simple tests (single application, single session)
  - [ ] 3 medium tests (application + session + co-applicant)
  - [ ] 2 complex tests (multiple applications/sessions)
  - [ ] 3 external integration tests (MX/Plaid)
- [ ] Convert selected tests
- [ ] Run pilot tests in parallel with originals
- [ ] Collect metrics:
  - [ ] Execution time comparison
  - [ ] Failure rate comparison
  - [ ] Developer feedback

**Week 4: Validate & Iterate**
- [ ] Analyze pilot results
- [ ] Identify patterns/issues
- [ ] Refine factory APIs
- [ ] Update documentation
- [ ] Get team sign-off to proceed

### Phase 3: Gradual Migration (Weeks 5-10)

**Weekly Cadence (6 weeks)**:
- [ ] Week 5: Convert 10-12 tests
- [ ] Week 6: Convert 10-12 tests
- [ ] Week 7: Convert 10-12 tests
- [ ] Week 8: Convert 10-12 tests
- [ ] Week 9: Convert 10-12 tests
- [ ] Week 10: Convert remaining tests

**Per-Week Process**:
1. Select batch of tests to migrate
2. Create feature branch
3. Convert tests using factories
4. Run full regression suite
5. Code review (2 reviewers)
6. Merge if green
7. Monitor CI for 24 hours
8. Rollback if issues detected

### Phase 4: Optimization (Weeks 11-12)

**Week 11: Mock Strategy**
- [ ] Implement MX mock
- [ ] Implement Plaid mock
- [ ] Add @unit and @integration tags
- [ ] Create fast test variants
- [ ] Update CI to run unit tests first

**Week 12: Final Cleanup**
- [ ] Remove seeder references from docs
- [ ] Update onboarding documentation
- [ ] Record training videos
- [ ] Celebrate success

---

## Code Examples

### Example 1: Simple Test Migration

**Before** (application_create_delete_test.spec.js):
```javascript
import { test, expect } from '@playwright/test';
import loginForm from '~/tests/utils/login-form';
import { admin } from '~/tests/test_config';
import { completeApplicationFlow } from '~/tests/utils/application-management';
import { getRandomNumber } from '~/tests/utils/helper';

test('Should create and delete application', async ({ page }) => {
    await loginForm.fill(page, admin);
    await loginForm.submitAndSetLocale(page);

    const appConfig = {
        organizationName: 'Verifast',
        applicationName: `AutoTest Create_Delete_${getRandomNumber()}`,
        applicantTypes: ['Affordable Occupant'],
        workflowTemplate: 'Autotest-full-id-fin-employ-simulation',
        flagCollection: 'High Risk',
        minimumAmount: '500'
    };

    await completeApplicationFlow(page, appConfig);
    // Test includes deletion
});
```

**After** (using factories):
```javascript
import { test, expect } from '~/tests/fixtures/test-data-fixture';
import loginForm from '~/tests/utils/login-form';
import { admin } from '~/tests/test_config';

test('Should create and delete application', async ({ page, testData }) => {
    // Login (same as before)
    await loginForm.fill(page, admin);
    await loginForm.submitAndSetLocale(page);

    // Create application via API (much faster than UI)
    const application = await testData.applications.create({
        organizationName: 'Verifast',
        applicantTypes: ['Affordable Occupant'],
        workflowTemplate: 'Autotest-full-id-fin-employ-simulation',
        flagCollection: 'High Risk',
        minimumAmount: '500'
    });

    // Verify application exists in UI
    await page.goto(`/applications/${application.id}`);
    await expect(page.getByTestId('application-name')).toHaveText(application.name);

    // Deletion happens automatically via fixture cleanup
    // Or test can explicitly delete to verify UI:
    await page.getByTestId('delete-application').click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText('Application deleted')).toBeVisible();
});
```

**Benefits**:
- Faster (API vs UI for creation)
- Clearer intent (test focuses on verification, not setup)
- Automatic cleanup
- Isolated (unique application per test run)

### Example 2: Complex Test Migration

**Before** (financial_mx_2_attempts_success_and_failed_password.spec.js - lines 146-171):
```javascript
test('Financial - mx - 2 attempts', async ({ page, browser }) => {
    // Login
    const adminAuthToken = await loginForm.adminLoginAndNavigate(page, admin);

    // Navigate to applications
    await gotoApplicationsPage(page);

    // Search for SEEDED application (BRITTLE)
    const applicationName = 'AutoTest - Financial Only, MX and Plaid'
    await searchApplication(page, applicationName);

    // Click application
    const appNameCol = page.getByTestId('application-table-name-col')
        .filter({ hasText: applicationName }).first();
    await appNameCol.click();

    // Generate session (already isolated - good!)
    const userData = {
        first_name: 'FinMX',
        last_name: 'Test',
        email: 'finmx_test@verifast.com'
    };
    await generateSessionForm.fill(page, userData);
    const sessionData = await generateSessionForm.submit(page);

    // ... rest of test
});
```

**After** (using factories):
```javascript
import { test, expect } from '~/tests/fixtures/test-data-fixture';

test('Financial - mx - 2 attempts', async ({ page, browser, testData }) => {
    // Login
    const adminAuthToken = await loginForm.adminLoginAndNavigate(page, admin);

    // Create application on-demand (ISOLATED, FAST)
    const application = await testData.applications.createFinancialOnly({
        applicationName: 'Test Financial MX',
        // Configuration explicit in test
    });

    // Navigate directly to application
    await page.goto(`/applications/${application.id}/invite`);

    // Generate session (same as before - already good pattern)
    const session = await testData.sessions.create({
        applicationId: application.id,
        userData: {
            first_name: 'FinMX',
            last_name: 'Test',
            email: 'finmx_test@verifast.com'
        }
    });

    // Or use UI flow if testing session generation UI:
    // await generateSessionForm.fill(page, userData);
    // const sessionData = await generateSessionForm.submit(page);

    // ... rest of test (unchanged)

    // Cleanup automatic via fixture
});
```

**Benefits**:
- No seeder dependency
- Application created with exact requirements
- 30-60 seconds faster (no search, direct navigation)
- True isolation (parallel tests don't interfere)

### Example 3: Test with Mock (Fast Variant)

```javascript
import { test, expect } from '~/tests/fixtures/test-data-fixture';
import { MXMock } from '~/tests/mocks';

// Original integration test (runs @integration tag)
test('Financial - mx integration @integration @slow', async ({ page, testData }) => {
    const app = await testData.applications.createFinancialOnly();
    const session = await testData.sessions.create({ applicationId: app.id });

    // Real MX integration - takes 5-7 minutes
    // ... full MX flow with real widgets
});

// Fast unit test (runs @unit tag, in every PR)
test('Financial - mx UI flow @unit @fast', async ({ page, testData }) => {
    const app = await testData.applications.createFinancialOnly();
    const session = await testData.sessions.create({ applicationId: app.id });

    // Mock MX responses
    await MXMock.mockSuccessfulConnection(page);
    await MXMock.mockFailedConnection(page);

    // Test UI rendering and state transitions
    // Completes in 30-60 seconds

    // Verify UI shows correct states
    await expect(page.getByTestId('connection-status')).toHaveText('Completed');
    await expect(page.getByTestId('connection-error')).toHaveText('Failed');
});
```

**CI Strategy**:
```yaml
# .github/workflows/test.yml
jobs:
  unit-tests:
    name: Fast Unit Tests
    run: npx playwright test --grep "@unit"
    # Runs on every PR - 5-10 minutes

  integration-tests:
    name: Full Integration Tests
    run: npx playwright test --grep "@integration"
    # Runs nightly or on release branches - 25-30 minutes
```

---

## Troubleshooting

### Issue 1: Factory Cleanup Fails

**Symptom**: Applications/sessions not deleted after test

**Diagnosis**:
```javascript
// Check factory instance
console.log('Applications created:', testData.applications.created);
console.log('Sessions created:', testData.sessions.created);
```

**Solutions**:
1. Ensure using `test` from fixture (not base Playwright test)
2. Check authentication token is valid
3. Verify API delete endpoints return 200/204
4. Check for cascading delete constraints (delete sessions before applications)

### Issue 2: Test Fails with "Application Not Found"

**Symptom**: Test can't find created application

**Diagnosis**:
```javascript
const app = await testData.applications.create({ ... });
console.log('Created app ID:', app.id);
console.log('Created app name:', app.name);

// Verify application exists
const fetchedApp = await testData.applications.get(app.id);
console.log('Fetched app:', fetchedApp);
```

**Solutions**:
1. Check application creation API response
2. Verify application was actually created (database query)
3. Check for race conditions (wait for creation to complete)
4. Ensure organization exists (if required)

### Issue 3: Parallel Tests Interfere

**Symptom**: Tests pass individually but fail when run in parallel

**Diagnosis**:
1. Check if tests share any resources (unlikely with factories)
2. Verify unique naming (factories use timestamps + random IDs)
3. Check for global state modifications

**Solutions**:
```javascript
// Ensure unique identifiers
const app = await testData.applications.create({
    applicationName: `Test_${Date.now()}_${Math.random().toString(36)}`
});

// Or let factory handle it (already includes uniqueness)
const app = await testData.applications.create({
    // Factory adds unique suffix automatically
});
```

### Issue 4: Slow Test Execution

**Symptom**: Tests slower than expected with factories

**Diagnosis**:
```javascript
console.time('Application creation');
const app = await testData.applications.create({ ... });
console.timeEnd('Application creation');

console.time('Session creation');
const session = await testData.sessions.create({ ... });
console.timeEnd('Session creation');
```

**Solutions**:
1. **Use mocks for external services** (MX, Plaid)
2. **Batch create** if test needs multiple applications
3. **Reuse applications** across tests in same file (beforeAll)
4. **Profile API endpoints** - some may be slow

**Example - Reuse for Speed**:
```javascript
test.describe('Application settings tests', () => {
    let sharedApp;

    test.beforeAll(async ({ request }) => {
        const token = await authenticateAdmin(request);
        const factory = new ApplicationFactory(request, token);
        sharedApp = await factory.create({ ... });
    });

    test('Test 1', async ({ page }) => {
        // Use sharedApp
    });

    test('Test 2', async ({ page }) => {
        // Use same sharedApp (faster)
    });

    test.afterAll(async ({ request }) => {
        // Cleanup sharedApp
    });
});
```

---

## Performance Benchmarks

### Expected Timings (After Migration)

**Application Creation**:
- UI flow: 15-30 seconds
- API factory: **0.5-1 second** (20-30x faster)

**Session Creation**:
- UI flow: 5-10 seconds
- API factory: **0.3-0.5 seconds** (10-20x faster)

**Full Test Suite (72 tests, 4 shards)**:
- Current (with seeders): ~25 minutes
- With factories (no mocks): **~18 minutes** (28% faster)
- With factories + mocks: **~10 minutes** (60% faster)

**Per-Test Overhead**:
- Current (seeder dependency): ~5-10 seconds
- Factories (no mocks): **~1-2 seconds**
- Factories + mocks: **~0.5-1 second**

---

## Next Steps

1. **Review this guide** with team (1 week)
2. **Implement factories** (Week 1-2 of timeline)
3. **Pilot migration** (Week 3-4 of timeline)
4. **Full migration** (Week 5-10 of timeline)
5. **Optimize** (Week 11-12 of timeline)

---

## Additional Resources

**File Locations**:
- Factory implementations: `/Users/isecco/Code/verifast/web-app-ui-test-framework/tests/factories/`
- Test fixture: `/Users/isecco/Code/verifast/web-app-ui-test-framework/tests/fixtures/test-data-fixture.js`
- Existing cleanup helper: `/Users/isecco/Code/verifast/web-app-ui-test-framework/tests/utils/cleanup-helper.js`
- Existing session form: `/Users/isecco/Code/verifast/web-app-ui-test-framework/tests/utils/generate-session-form.js`

**Existing Patterns to Leverage**:
- Authentication: `authenticateAdmin()` in cleanup-helper.js
- Session creation: `generateSessionForm.js` (lines 1-93)
- Cleanup: `cleanupSession()` in cleanup-helper.js (lines 232-257)

**Questions? Contact**:
- Test automation lead
- Engineering team lead
