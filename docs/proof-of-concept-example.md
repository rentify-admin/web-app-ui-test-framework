# Test-Owned Data: Proof of Concept
## Ready-to-Use Implementation Example

**Purpose**: Demonstrate the Test-Owned Data pattern with real code that can be run immediately
**Status**: Ready for pilot testing
**Timeline**: Can be tested within 1 day

---

## Quick Start Guide

### 1. Copy Factory Files to Your Project

Create these files in your test framework:

**File Structure**:
```
/Users/isecco/Code/verifast/web-app-ui-test-framework/
├── tests/
│   ├── factories/
│   │   ├── application-factory.js  ← CREATE THIS
│   │   └── session-factory.js      ← CREATE THIS
│   ├── fixtures/
│   │   └── test-data-fixture.js    ← CREATE THIS
│   └── examples/
│       └── migrated-test-example.spec.js  ← CREATE THIS
```

---

## Factory Implementations

### File 1: Application Factory

**Path**: `/Users/isecco/Code/verifast/web-app-ui-test-framework/tests/factories/application-factory.js`

```javascript
/**
 * Application Factory for Test Data Management
 *
 * This factory creates applications via API for test isolation.
 * It tracks created applications and provides automatic cleanup.
 *
 * Benefits:
 * - True test isolation (no shared seeded data)
 * - Fast (API vs UI, 0.5-1s vs 15-30s)
 * - Self-documenting (test shows exactly what app it needs)
 * - Automatic cleanup (no manual deletion needed)
 *
 * Usage:
 *   const factory = new ApplicationFactory(request, authToken);
 *   const app = await factory.create({ applicantTypes: ['International'] });
 *   await factory.cleanup(); // or automatic via fixture
 */

import { app as appConfig } from '~/tests/test_config';

export class ApplicationFactory {
    constructor(apiRequestContext, authToken) {
        this.api = apiRequestContext;
        this.token = authToken;
        this.created = [];
        this.baseUrl = appConfig.urls.api;
    }

    /**
     * Create application with sensible defaults
     *
     * @param {Object} config - Application configuration
     * @param {string} [config.organizationName='Verifast'] - Organization name
     * @param {string} [config.applicationName] - Auto-generated if not provided
     * @param {Array<string>} [config.applicantTypes=['Affordable Occupant']] - Applicant types
     * @param {string} [config.workflowTemplate='basic-workflow'] - Workflow template
     * @param {string} [config.flagCollection='Standard'] - Flag collection
     * @param {string} [config.minimumAmount='500'] - Minimum amount
     * @param {boolean} [config.enableMX=false] - Enable MX integration
     * @param {boolean} [config.enablePlaid=false] - Enable Plaid integration
     *
     * @returns {Promise<Object>} Created application with id, name, etc.
     *
     * @example
     * // Simple creation with defaults
     * const app = await factory.create();
     *
     * @example
     * // Create with specific configuration
     * const app = await factory.create({
     *     applicantTypes: ['International', 'Employed'],
     *     enableMX: true,
     *     minimumAmount: '1000'
     * });
     */
    async create(config = {}) {
        // Generate unique name to prevent collisions
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substr(2, 9);

        const defaults = {
            organizationName: 'Verifast',
            applicationName: `AutoTest_${timestamp}_${randomId}`,
            applicantTypes: ['Affordable Occupant'],
            workflowTemplate: 'basic-workflow',
            flagCollection: 'Standard',
            minimumAmount: '500',
            enableMX: false,
            enablePlaid: false,
        };

        const appConfig = { ...defaults, ...config };

        console.log(`📝 Creating application via API: ${appConfig.applicationName}`);

        try {
            // TODO: Replace with actual endpoint - this is a placeholder
            // Based on existing code pattern, likely POST /applications
            const response = await this.api.post(`${this.baseUrl}/applications`, {
                headers: {
                    Authorization: `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                data: {
                    organization_name: appConfig.organizationName,
                    name: appConfig.applicationName,
                    applicant_types: appConfig.applicantTypes,
                    workflow_template: appConfig.workflowTemplate,
                    flag_collection: appConfig.flagCollection,
                    minimum_amount: appConfig.minimumAmount,
                    settings: {
                        enable_mx: appConfig.enableMX,
                        enable_plaid: appConfig.enablePlaid
                    }
                }
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

        } catch (error) {
            console.error(`❌ Application creation failed:`, error.message);
            throw error;
        }
    }

    /**
     * Create financial-only application (common pattern)
     * Preset for applications that only verify financial data
     *
     * @param {Object} overrides - Additional configuration
     * @returns {Promise<Object>} Created application
     *
     * @example
     * const app = await factory.createFinancialOnly({
     *     minimumAmount: '800'
     * });
     */
    async createFinancialOnly(overrides = {}) {
        console.log('📊 Creating financial-only application...');
        return this.create({
            applicantTypes: ['Financial Only'],
            enableMX: true,
            enablePlaid: true,
            workflowTemplate: 'financial-verification-only',
            ...overrides
        });
    }

    /**
     * Create full screening application (common pattern)
     * Preset for full ID + Financial + Employment screening
     *
     * @param {Object} overrides - Additional configuration
     * @returns {Promise<Object>} Created application
     */
    async createFullScreening(overrides = {}) {
        console.log('📋 Creating full screening application...');
        return this.create({
            applicantTypes: ['Affordable Occupant', 'Affordable Primary'],
            workflowTemplate: 'Autotest-full-id-fin-employ-simulation',
            flagCollection: 'High Risk',
            minimumAmount: '500',
            ...overrides
        });
    }

    /**
     * Create international applicant application
     *
     * @param {Object} overrides - Additional configuration
     * @returns {Promise<Object>} Created application
     */
    async createInternational(overrides = {}) {
        console.log('🌍 Creating international application...');
        return this.create({
            applicantTypes: ['International'],
            ...overrides
        });
    }

    /**
     * Get application by ID
     *
     * @param {string} applicationId - Application ID
     * @returns {Promise<Object>} Application data
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

    /**
     * Cleanup all created applications
     * Call in test.afterAll() or automatically via fixture
     *
     * @returns {Promise<void>}
     */
    async cleanup() {
        if (this.created.length === 0) {
            console.log('ℹ️  No applications to cleanup');
            return;
        }

        console.log(`🧹 Cleaning up ${this.created.length} application(s)...`);

        let successCount = 0;
        let failCount = 0;

        for (const appId of this.created) {
            try {
                // Use existing cleanup helper pattern
                const deleteResponse = await this.api.delete(
                    `${this.baseUrl}/applications/${appId}`,
                    {
                        headers: { Authorization: `Bearer ${this.token}` }
                    }
                );

                if (deleteResponse.ok() || deleteResponse.status() === 204) {
                    console.log(`  ✅ Deleted application: ${appId}`);
                    successCount++;
                } else {
                    console.warn(`  ⚠️  Failed to delete application ${appId}: ${deleteResponse.status()}`);
                    failCount++;
                }
            } catch (error) {
                console.error(`  ❌ Error deleting application ${appId}:`, error.message);
                failCount++;
            }
        }

        console.log(`🧹 Cleanup complete: ${successCount} deleted, ${failCount} failed`);
        this.created = [];
    }
}
```

---

### File 2: Session Factory

**Path**: `/Users/isecco/Code/verifast/web-app-ui-test-framework/tests/factories/session-factory.js`

```javascript
/**
 * Session Factory for Test Data Management
 *
 * Enhanced version of generate-session-form.js that creates sessions via API.
 * Reuses 90% of existing code patterns.
 *
 * Benefits:
 * - Faster than UI flow (0.3-0.5s vs 5-10s)
 * - Automatic cleanup (including co-applicants)
 * - Consistent naming (reuses naming-helper.js)
 * - Tracks created sessions for cleanup
 */

import { app as appConfig } from '~/tests/test_config';
import { addPrefix, addEmailSuffix } from '~/tests/utils/naming-helper';

export class SessionFactory {
    constructor(apiRequestContext, authToken) {
        this.api = apiRequestContext;
        this.token = authToken;
        this.created = [];
        this.baseUrl = appConfig.urls.api;
    }

    /**
     * Create session via API
     *
     * @param {Object} config - Session configuration
     * @param {string} config.applicationId - Application ID (required)
     * @param {Object} [config.userData] - User data
     * @param {string} [config.userData.first_name='Test'] - First name
     * @param {string} [config.userData.last_name='User'] - Last name
     * @param {string} [config.userData.email='test@verifast.com'] - Email
     * @param {number} [config.rentBudget=500] - Rent budget
     *
     * @returns {Promise<Object>} Created session with id, invite link, etc.
     *
     * @example
     * const session = await factory.create({
     *     applicationId: app.id,
     *     userData: { first_name: 'John', last_name: 'Doe' },
     *     rentBudget: 1000
     * });
     */
    async create(config = {}) {
        if (!config.applicationId) {
            throw new Error('applicationId is required for session creation');
        }

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

        console.log(`📝 Creating session via API: ${sessionData.email}`);

        try {
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

        } catch (error) {
            console.error(`❌ Session creation failed:`, error.message);
            throw error;
        }
    }

    /**
     * Cleanup all created sessions
     * Handles co-applicants automatically (deletes children first)
     *
     * @returns {Promise<void>}
     */
    async cleanup() {
        if (this.created.length === 0) {
            console.log('ℹ️  No sessions to cleanup');
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
            console.log(`  ✅ Deleted session: ${sessionId}`);
        } else {
            console.warn(`  ⚠️  Failed to delete session ${sessionId}: ${deleteResponse.status()}`);
        }
    }
}
```

---

### File 3: Test Data Fixture

**Path**: `/Users/isecco/Code/verifast/web-app-ui-test-framework/tests/fixtures/test-data-fixture.js`

```javascript
/**
 * Test Data Fixture - Provides factories with automatic cleanup
 *
 * This fixture extends Playwright's base test to provide automatic
 * test data creation and cleanup using the factory pattern.
 *
 * Usage:
 *   import { test, expect } from '~/tests/fixtures/test-data-fixture';
 *
 *   test('My test', async ({ page, testData }) => {
 *     const app = await testData.applications.create({ ... });
 *     const session = await testData.sessions.create({ applicationId: app.id });
 *     // Test logic
 *     // Cleanup automatic
 *   });
 */

import { test as base, expect } from '@playwright/test';
import { ApplicationFactory } from '~/tests/factories/application-factory';
import { SessionFactory } from '~/tests/factories/session-factory';
import { authenticateAdmin } from '~/tests/utils/cleanup-helper';

/**
 * Extended test with testData fixture
 */
export const test = base.extend({
    /**
     * testData fixture provides factories with automatic cleanup
     *
     * Properties:
     * - applications: ApplicationFactory instance
     * - sessions: SessionFactory instance
     * - authToken: Admin auth token (for direct API calls)
     */
    testData: async ({ request }, use) => {
        console.log('🔧 Setting up test data fixture...');

        // Authenticate once per test
        const authToken = await authenticateAdmin(request);

        if (!authToken) {
            throw new Error('Failed to authenticate for test data setup');
        }

        // Create factory instances
        const applications = new ApplicationFactory(request, authToken);
        const sessions = new SessionFactory(request, authToken);

        console.log('✅ Test data fixture ready');

        // Provide to test
        await use({
            applications,
            sessions,
            authToken
        });

        // Automatic cleanup after test
        console.log('🧹 Test data fixture: Starting automatic cleanup...');

        try {
            // Sessions first (may reference applications)
            await sessions.cleanup();
            // Then applications
            await applications.cleanup();

            console.log('✅ Test data fixture: Cleanup complete');
        } catch (error) {
            console.error('❌ Test data fixture: Cleanup failed:', error.message);
            // Don't throw - cleanup failures shouldn't fail tests
        }
    }
});

// Re-export expect for convenience
export { expect };
```

---

## Proof of Concept Test

### File 4: Example Migrated Test

**Path**: `/Users/isecco/Code/verifast/web-app-ui-test-framework/tests/examples/migrated-test-example.spec.js`

```javascript
/**
 * PROOF OF CONCEPT: Migrated Test Example
 *
 * This test demonstrates the Test-Owned Data pattern.
 * Compare to original: financial_mx_2_attempts_success_and_failed_password.spec.js
 *
 * Key improvements:
 * - No hardcoded application names
 * - True test isolation
 * - Faster setup (API vs UI)
 * - Automatic cleanup
 * - Self-documenting (test shows exact requirements)
 */

import { test, expect } from '~/tests/fixtures/test-data-fixture';
import loginForm from '~/tests/utils/login-form';
import { admin } from '~/tests/test_config';
import { gotoApplicationsPage, searchApplication } from '~/tests/utils/applications-page';
import { setupInviteLinkSession } from '~/tests/utils/session-flow';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

test.describe('PROOF OF CONCEPT: Test-Owned Data Pattern', () => {

    test('Should create isolated test data and run test', {
        tag: ['@poc', '@test-owned-data'],
    }, async ({ page, browser, testData }) => {

        // ====================================================================
        // IMPROVEMENT 1: Create application via API (fast, isolated)
        // ====================================================================
        console.log('📝 Step 1: Creating test application via factory...');

        // Before: Searched for hardcoded 'AutoTest - Financial Only, MX and Plaid'
        // After: Create exactly what we need
        const application = await testData.applications.createFinancialOnly({
            minimumAmount: '500'
            // All other settings from preset (enableMX: true, enablePlaid: true)
        });

        console.log(`✅ Created application: ${application.id} (${application.name})`);

        // ====================================================================
        // IMPROVEMENT 2: No search needed - direct navigation
        // ====================================================================
        console.log('📝 Step 2: Admin login and navigate to application...');

        const adminAuthToken = await loginForm.adminLoginAndNavigate(page, admin);
        expect(adminAuthToken).toBeTruthy();

        // Before: Search for application in list (slow, brittle)
        // await gotoApplicationsPage(page);
        // await searchApplication(page, 'AutoTest - Financial Only, MX and Plaid');

        // After: Navigate directly (faster, guaranteed to exist)
        await page.goto(`${page.url()}/applications/${application.id}/invite`);

        // ====================================================================
        // IMPROVEMENT 3: Create session via API or UI (your choice)
        // ====================================================================
        console.log('📝 Step 3: Creating session...');

        // Option A: Create via API (faster - 0.3-0.5s vs 5-10s)
        const session = await testData.sessions.create({
            applicationId: application.id,
            userData: {
                first_name: 'FinMX',
                last_name: 'Test',
                email: 'finmx_test@verifast.com'
            },
            rentBudget: 500
        });

        console.log(`✅ Created session via API: ${session.id}`);

        // Option B: Create via UI (if testing session creation UI)
        // const generateForm = await page.locator('#generate-session-form');
        // await expect(generateForm).toBeVisible();
        // await generateSessionForm.fill(page, userData);
        // const sessionData = await generateSessionForm.submit(page);

        // ====================================================================
        // IMPROVEMENT 4: Test logic (unchanged - same as before)
        // ====================================================================
        console.log('📝 Step 4: Running test logic...');

        // Rest of test remains the same as original
        // - Navigate to session invite link
        // - Complete workflow
        // - Verify results

        // For POC, just verify session was created correctly
        const applicantPage = await browser.newPage();
        await applicantPage.goto(session.invite_link);

        await setupInviteLinkSession(applicantPage);

        // Verify on financial step
        await expect(applicantPage.getByTestId('connect-bank')).toBeVisible({ timeout: 10000 });

        console.log('✅ Test logic complete');

        // ====================================================================
        // IMPROVEMENT 5: Cleanup automatic (no manual cleanup needed)
        // ====================================================================
        console.log('📝 Step 5: Cleanup will happen automatically via fixture');

        // Before: Manual cleanup in afterAll
        // test.afterAll(async ({ request }) => {
        //   await cleanupSession(request, sessionId, allTestsPassed);
        // });

        // After: Automatic cleanup via fixture
        // - Session deleted automatically
        // - Application deleted automatically
        // - No manual tracking needed

        await applicantPage.close();
    });

    test('Should demonstrate preset patterns', {
        tag: ['@poc', '@presets'],
    }, async ({ testData }) => {

        console.log('📝 Demonstrating factory presets...');

        // Preset 1: Financial-only application
        const financialApp = await testData.applications.createFinancialOnly();
        console.log(`✅ Financial app: ${financialApp.id}`);

        // Preset 2: Full screening application
        const fullScreeningApp = await testData.applications.createFullScreening();
        console.log(`✅ Full screening app: ${fullScreeningApp.id}`);

        // Preset 3: International application
        const internationalApp = await testData.applications.createInternational();
        console.log(`✅ International app: ${internationalApp.id}`);

        // All will be cleaned up automatically
        console.log('✅ All applications will be cleaned up automatically');
    });

    test('Should demonstrate custom configuration', {
        tag: ['@poc', '@custom'],
    }, async ({ testData }) => {

        console.log('📝 Demonstrating custom configuration...');

        // Create application with specific requirements
        const customApp = await testData.applications.create({
            applicantTypes: ['Employed', 'Self-Employed', 'International'],
            workflowTemplate: 'custom-workflow',
            flagCollection: 'High Risk',
            minimumAmount: '1500',
            enableMX: true,
            enablePlaid: false
        });

        console.log(`✅ Custom app created: ${customApp.id}`);
        console.log(`   Applicant types: ${customApp.applicant_types?.join(', ') || 'N/A'}`);
        console.log(`   Workflow: ${customApp.workflow_template || 'N/A'}`);

        // Create session for this application
        const session = await testData.sessions.create({
            applicationId: customApp.id,
            userData: {
                first_name: 'Custom',
                last_name: 'Test'
            },
            rentBudget: 1500
        });

        console.log(`✅ Session created: ${session.id}`);

        // Cleanup automatic
    });
});
```

---

## How to Run the Proof of Concept

### Step 1: Create Factory Files

```bash
# Create directories
mkdir -p /Users/isecco/Code/verifast/web-app-ui-test-framework/tests/factories
mkdir -p /Users/isecco/Code/verifast/web-app-ui-test-framework/tests/fixtures
mkdir -p /Users/isecco/Code/verifast/web-app-ui-test-framework/tests/examples

# Copy factory files from this document
# (See implementations above)
```

### Step 2: Verify API Endpoints

**IMPORTANT**: The factories use placeholder API endpoints. You need to verify these match your actual API:

```javascript
// In application-factory.js, line ~75
POST `${this.baseUrl}/applications`

// In session-factory.js, line ~60
POST `${this.baseUrl}/sessions`

// DELETE endpoints for cleanup
DELETE `${this.baseUrl}/applications/${id}`
DELETE `${this.baseUrl}/sessions/${id}`
```

**Action Required**:
1. Check your API documentation for correct endpoints
2. Update factory code if endpoints differ
3. Verify request/response formats match your API

### Step 3: Run POC Tests

```bash
# Run POC tests only
npx playwright test tests/examples/migrated-test-example.spec.js

# Run with UI mode to see what's happening
npx playwright test tests/examples/migrated-test-example.spec.js --ui

# Run specific test
npx playwright test tests/examples/migrated-test-example.spec.js --grep "@presets"
```

### Step 4: Review Results

**Expected Output**:
```
🔧 Setting up test data fixture...
✅ Test data fixture ready

📝 Step 1: Creating test application via factory...
📝 Creating financial-only application...
📝 Creating application via API: AutoTest_1737583200000_abc123xyz
✅ Created application: app-uuid-here (AutoTest_1737583200000_abc123xyz)

📝 Step 2: Admin login and navigate to application...
✅ Admin authenticated

📝 Step 3: Creating session...
📝 Creating session via API: autotest - finmx test+autotest@verifast.com
✅ Created session via API: session-uuid-here

📝 Step 4: Running test logic...
✅ Test logic complete

📝 Step 5: Cleanup will happen automatically via fixture
🧹 Test data fixture: Starting automatic cleanup...
🧹 Cleaning up 1 session(s)...
  ✅ Deleted session: session-uuid-here
🧹 Cleaning up 1 application(s)...
  ✅ Deleted application: app-uuid-here
✅ Test data fixture: Cleanup complete
```

---

## Validation Checklist

After running POC, verify:

- [ ] Applications are created successfully
- [ ] Sessions are created successfully
- [ ] Tests can use created data
- [ ] Cleanup deletes applications
- [ ] Cleanup deletes sessions
- [ ] Tests run faster than UI-based creation
- [ ] Tests are isolated (run test multiple times in parallel)

---

## Troubleshooting POC

### Issue: "Application creation failed: 404"

**Cause**: API endpoint doesn't exist or is different

**Solution**:
1. Check API documentation
2. Update endpoint in factory
3. Verify authentication is correct

### Issue: "Session creation failed: 400"

**Cause**: Request body format doesn't match API

**Solution**:
1. Check API documentation for session creation
2. Update sessionData format in factory
3. Verify all required fields are provided

### Issue: "Cleanup failed"

**Cause**: Delete endpoints require different authentication or don't exist

**Solution**:
1. Verify delete endpoints exist
2. Check authentication (should use same token as create)
3. Add error handling for missing entities

### Issue: "Tests still reference seeded applications"

**Cause**: Using old test pattern instead of fixture

**Solution**:
```javascript
// Wrong - old pattern
import { test } from '@playwright/test';
test('My test', async ({ page }) => {
    await searchApplication(page, 'Seeded App Name');
});

// Right - new pattern
import { test } from '~/tests/fixtures/test-data-fixture';
test('My test', async ({ page, testData }) => {
    const app = await testData.applications.create({ ... });
});
```

---

## Next Steps After POC

1. **Validate POC results** with team (1 day)
2. **Refine factories** based on actual API (2-3 days)
3. **Convert 5 real tests** as pilot (1 week)
4. **Measure performance** vs current approach (2 days)
5. **Get approval** to proceed with full migration

---

## Metrics to Collect

### During POC

**Speed**:
- [ ] Application creation time: ______ seconds (target: 0.5-1s)
- [ ] Session creation time: ______ seconds (target: 0.3-0.5s)
- [ ] Total test overhead: ______ seconds (target: 1-2s)

**Reliability**:
- [ ] Application creation success rate: ______ %
- [ ] Session creation success rate: ______ %
- [ ] Cleanup success rate: ______ %

**Comparison**:
- [ ] Old pattern test time: ______ seconds
- [ ] New pattern test time: ______ seconds
- [ ] Improvement: ______ % faster

---

## Success Criteria

**POC is successful if**:
- ✅ Applications are created in <1 second
- ✅ Sessions are created in <0.5 seconds
- ✅ Cleanup works 100% of the time
- ✅ Tests are faster than UI-based approach
- ✅ Tests are isolated (no interference)
- ✅ Code is clear and maintainable
- ✅ Team understands the pattern

**If POC fails**:
- Identify blockers
- Adjust approach
- Re-run POC
- No commitment yet - just learning

---

**Document Location**: `/Users/isecco/Code/verifast/web-app-ui-test-framework/docs/proof-of-concept-example.md`

**Related Documents**:
- Main Review: `/Users/isecco/Code/verifast/web-app-ui-test-framework/docs/test-data-management-review.md`
- Implementation Guide: `/Users/isecco/Code/verifast/web-app-ui-test-framework/docs/test-owned-data-implementation-guide.md`
- Risk Assessment: `/Users/isecco/Code/verifast/web-app-ui-test-framework/docs/option-comparison-risk-assessment.md`
