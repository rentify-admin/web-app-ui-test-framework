# Test Data Management System Review
## Senior Test Engineer Perspective

**Reviewer**: Senior Test Automation Engineer
**Date**: 2026-01-22
**Project**: Verifast UI Test Framework (Playwright 1.52.0, 72 test files)

---

## Executive Summary

**RECOMMENDATION: REJECT Option D (Hybrid) - Propose Alternative Test-Centric Approach**

The proposed hybrid solution introduces significant test infrastructure complexity without addressing the root cause: **tests depend on external seeder state instead of owning their test data**. This violates fundamental test automation principles and will create a maintenance nightmare.

### Critical Issues Identified
1. **Architectural Mismatch**: Database snapshots + entity registries are infrastructure solutions to a test design problem
2. **Hidden Dependencies**: Tests still reference seeded data, now through an indirection layer
3. **Debugging Complexity**: New failure modes (snapshot failures, registry sync issues, factory API errors)
4. **Migration Risk**: 72 test files, 23 using beforeAll hooks - massive refactor with unclear rollback path
5. **CI/CD Impact**: 4-shard parallelization will be compromised by snapshot restore overhead

---

## 1. Test Architecture Impact Analysis

### Current State
```javascript
// Current Test Pattern (from financial_mx_2_attempts_success_and_failed_password.spec.js)
test('Financial - mx - 2 attempts', async ({ page, browser }) => {
    // Search for hardcoded seeded application
    const applicationName = 'AutoTest - Financial Only, MX and Plaid'
    await searchApplication(page, applicationName);

    // Create session dynamically via API
    const sessionData = await generateSessionForm.submit(page);
    const sessionId = sessionData.data?.id;
});
```

**Analysis**: Tests already create dynamic data (sessions via API) but depend on pre-seeded applications by name. This is a **partial isolation pattern**.

### Proposed Impact with Option D

#### Phase 1: Snapshot Restore (CRITICAL FAILURE POINT)
```bash
# Before CI runs
pg_restore --clean --if-exists snapshot.dump
```

**Problems**:
1. **Shard Parallelization Broken**: All 4 shards need identical snapshot state
   - Current: Tests run in parallel across shards independently
   - Proposed: Snapshot must be restored before shard execution
   - Impact: **Test startup time +30-60 seconds per shard**

2. **Local Development Complexity**:
   ```bash
   # Developer workflow becomes:
   $ git pull
   $ npm run db:snapshot:restore  # New required step
   $ npm test
   # Test fails → Debug → Change code → Retest
   $ npm run db:snapshot:restore  # Must restore again if data changed
   ```
   - Current: `npm test` just works
   - Proposed: Developers need local snapshot infrastructure

3. **Snapshot Drift**:
   - Seeders change → Snapshot outdated → Tests fail cryptically
   - Who maintains snapshots? When are they updated?
   - Version control for snapshots? (Binary files in Git = bad)

#### Phase 2-3: Entity Registry + Factory API

```javascript
// Proposed pattern
const applicationId = await registry.lookup('application', 'Financial Only MX');
```

**New Failure Modes**:
1. **Registry Out of Sync**: Seeder changes but registry not updated
2. **Name Collisions**: Two applications with similar names
3. **Factory API Latency**: Every test needs API calls to create/lookup data
4. **Network Dependencies**: Factory API becomes single point of failure

### Verdict: REJECTED
- **Test Parallelization**: DEGRADED (snapshot restore bottleneck)
- **Local Development**: SIGNIFICANTLY WORSE (new infrastructure requirements)
- **CI Pipeline**: SLOWER (snapshot overhead + factory API calls)

---

## 2. Test Reliability Assessment

### Current Flakiness Sources
From the codebase analysis:
- **3 retries configured** (Line 41, playwright.config.js)
- **100s timeout** (Line 56)
- **Extensive polling patterns** (e.g., lines 236-315 in financial test)

```javascript
// Example: Polling for MX connection completion (160 seconds max)
const maxPollingAttempts = 80; // 80 attempts = 160 seconds max
const pollingInterval = 2000; // 2 seconds
```

**Root Causes**:
1. External service dependencies (MX, Plaid)
2. Async state propagation (income source generation, approval status)
3. Shared seeded data state

### Will Proposed Solution Reduce Flakiness?

**NO - It will likely INCREASE flakiness:**

1. **New Timing Issues**:
   - Snapshot restore must complete before tests start
   - Factory API must respond before tests can lookup data
   - Registry updates must propagate across shards

2. **New Race Conditions**:
   ```javascript
   // Shard 1 and Shard 2 both lookup same application
   const app = await registry.lookup('application', 'Test App');
   // Both create sessions against same application
   // Session state interference possible
   ```

3. **Existing Issues Remain**:
   - External service dependencies (MX/Plaid) unchanged
   - Async state propagation unchanged
   - Test still waits for approval status polling

### Verdict: REJECTED
- **Flakiness Reduction**: NONE - introduces new failure modes
- **Debugging**: HARDER (more layers to debug through)
- **Test Isolation**: NOT ACHIEVED (still sharing application entities)

---

## 3. Test Maintenance Concerns

### Migration Scope
```
72 test files
23 files with beforeAll hooks
~108 occurrences of beforeAll/afterAll
Hardcoded references:
  - "AutoTest - Financial Only, MX and Plaid"
  - "Autotest-full-id-fin-employ-simulation"
  - Organization name: "Verifast"
```

### Migration Effort Estimate

**Phase 1-2 (Registry Migration)**:
```javascript
// Before (1 line)
const applicationName = 'AutoTest - Financial Only, MX and Plaid'

// After (3-5 lines + setup)
const applicationId = await registry.lookup('application', 'Financial Only MX');
const application = await api.getApplication(applicationId);
const applicationName = application.name;
```

- **72 files** × **~3 hardcoded references/file** = **~216 migration points**
- **Developer time**: ~4-6 weeks for full migration
- **QA validation**: ~2-3 weeks to verify no regressions
- **Risk**: High - any missed reference breaks tests cryptically

**Phase 3-4 (Factory API)**:
- Must rewrite tests to use factory API instead of UI flows
- Examples: Application creation currently tested via UI (application_create_delete_test.spec.js)
- **Additional 4-6 weeks** to migrate to API-first test data creation

### Ongoing Maintenance Burden

**Current State**:
```javascript
// Developer adds new test
test('New feature test', async ({ page }) => {
    await searchApplication(page, 'AutoTest - Financial Only');
    // Test logic
});
```
- Maintenance: Documentation of available seeded applications
- Complexity: Low - developers know what applications exist

**Proposed State**:
```javascript
// Developer adds new test
test('New feature test', async ({ page, request }) => {
    // Must understand registry system
    const appId = await registry.lookup('application', 'Financial Only');

    // Must understand factory API
    const session = await factory.createSession(appId, {
        applicantType: 'Affordable Occupant',
        // ... complex configuration
    });

    // Must cleanup
    await cleanup.session(session.id);
});
```
- Maintenance: Registry + Factory API + Cleanup system documentation
- Complexity: **HIGH** - new developers need to learn 3 new abstractions

### New Team Member Onboarding

**Current**:
1. Read test file
2. See hardcoded application name
3. Look at seeders to understand what exists
4. Write test

**Proposed**:
1. Read test file
2. Learn entity registry concept
3. Learn factory API patterns
4. Learn cleanup patterns
5. Understand snapshot restore process
6. Write test

**Time to First Test**: Current = 2-4 hours, Proposed = **1-2 days**

### Verdict: REJECTED
- **Migration Effort**: MASSIVE (10-12 weeks total)
- **Ongoing Maintenance**: SIGNIFICANTLY HIGHER
- **Team Onboarding**: 4-8x SLOWER
- **Documentation Burden**: NEW systems to document and maintain

---

## 4. Practical Implementation Questions

### Validation & Rollback

**Q: How do we validate the migration is complete?**

Current approach would require:
1. Parallel test runs (old vs new pattern) - **doubles CI time**
2. Manual code review of all 72 files
3. Integration tests for registry/factory API themselves
4. Snapshot integrity tests

**Risk**: No automated way to verify migration completeness

**Q: What's the rollback plan if tests start failing?**

```
Committed changes:
  - 72 test files modified
  - New registry system
  - New factory API
  - New snapshot infrastructure
  - CI pipeline modified

Rollback requires:
  - Git revert of all test files (merge conflicts likely)
  - Database restoration
  - CI pipeline revert
  - Developer environment reset
```

**Rollback time estimate**: 1-2 days + risk of data loss

### Tests Requiring Specific UUIDs

**Q: How do we handle tests that NEED specific seeded data?**

Example: Testing document policy auto-selection based on application configuration
```javascript
// Test validates specific workflow template behavior
const workflowTemplate = 'Autotest-full-id-fin-employ-simulation';
```

**Options under proposed system**:
1. **Keep hardcoded references** → Defeats purpose of migration
2. **Factory API creates workflow templates** → Complex, requires deep domain knowledge
3. **Registry maps logical names to UUIDs** → Still coupled to seeders

**None of these solve the core problem**: Tests need deterministic, known-state data

### Verdict: REJECTED
- **Validation**: NO CLEAR PATH
- **Rollback**: RISKY AND TIME-CONSUMING
- **Special Cases**: NOT ADDRESSED

---

## 5. Alternative Test-Centric Approach

### Recommended Solution: Test-Owned Data Factories

**Core Principle**: Tests should own and create their required data, not depend on external seeders.

#### Architecture

```javascript
// /tests/factories/application-factory.js
export class ApplicationFactory {
    constructor(apiClient, authToken) {
        this.api = apiClient;
        this.token = authToken;
        this.created = []; // Track for cleanup
    }

    async create(config = {}) {
        const defaults = {
            organizationName: 'Verifast',
            applicationName: `AutoTest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            applicantTypes: ['Affordable Occupant'],
            workflowTemplate: 'basic-workflow',
            flagCollection: 'Standard',
            minimumAmount: '500'
        };

        const appConfig = { ...defaults, ...config };

        // Create via API (already exists in codebase pattern)
        const response = await this.api.post('/applications', {
            headers: { Authorization: `Bearer ${this.token}` },
            data: appConfig
        });

        const application = response.data;
        this.created.push(application.id);

        return application;
    }

    async cleanup() {
        for (const appId of this.created) {
            await this.api.delete(`/applications/${appId}`, {
                headers: { Authorization: `Bearer ${this.token}` }
            });
        }
        this.created = [];
    }
}

// /tests/factories/session-factory.js
export class SessionFactory {
    // Similar pattern - already partially exists in generate-session-form.js
}
```

#### Test Pattern (Minimal Change)

```javascript
// Before (current)
test('Financial MX test', async ({ page }) => {
    await searchApplication(page, 'AutoTest - Financial Only, MX and Plaid');
    const sessionData = await generateSessionForm.submit(page);
    // ... test logic
});

// After (test-owned data)
import { ApplicationFactory, SessionFactory } from '~/tests/factories';

test('Financial MX test', async ({ page, request }) => {
    const adminToken = await authenticateAdmin(request);
    const appFactory = new ApplicationFactory(request, adminToken);

    // Create test data on-demand
    const application = await appFactory.create({
        applicationName: 'Test Financial MX',
        enableMX: true,
        enablePlaid: true
    });

    // Use created data
    await searchApplication(page, application.name);
    const sessionData = await generateSessionForm.submit(page);
    // ... test logic

    // Cleanup in afterAll (already exists in cleanup-helper.js pattern)
    await appFactory.cleanup();
});
```

#### Implementation Using Existing Patterns

**Key Observation**: The codebase ALREADY has 80% of this solution!

1. **Session creation via API**: ✅ `generate-session-form.js`
2. **Cleanup infrastructure**: ✅ `cleanup-helper.js`
3. **API client**: ✅ `tests/api/client.js`
4. **Authentication**: ✅ `authenticateAdmin()` in cleanup-helper.js

**Missing pieces**:
1. Application factory (can extract from `completeApplicationFlow` in `application-management.js`)
2. Workflow template factory (optional - can use existing templates)
3. Test fixture pattern to share factories across tests

### Benefits of Test-Owned Data

#### 1. True Test Isolation
```javascript
// Each test creates its own application
test('Test A', async ({ request }) => {
    const app = await appFactory.create({ name: 'Test A App' });
    // Test A cannot interfere with Test B
});

test('Test B', async ({ request }) => {
    const app = await appFactory.create({ name: 'Test B App' });
    // Test B cannot interfere with Test A
});
```
- **No shared state** between tests
- **Parallel execution safe** - shards don't interfere
- **No seeder dependencies** - tests are self-contained

#### 2. Better Debugging
```javascript
test('Test fails here', async ({ request }) => {
    const app = await appFactory.create({
        applicationName: 'Debug Test',
        enableMX: true
    });

    console.log(`Created test application: ${app.id}`);
    // Test fails - can inspect exact application created
    // Can manually navigate to application in UI: /applications/${app.id}
});
```
- **Exact test data visible** in test output
- **No "which seeded app?" confusion**
- **Can inspect failed test data** in database/UI

#### 3. Faster Test Development
```javascript
// Developer writes new test
test('New feature test', async ({ request }) => {
    const app = await appFactory.create({
        // Only specify what matters for this test
        applicantTypes: ['International'],
        minimumAmount: '1000'
        // Rest uses sensible defaults
    });

    // Test logic immediately
});
```
- **No seeder coordination** needed
- **Test expresses its data requirements** clearly
- **Self-documenting** - test shows what data it needs

#### 4. CI/CD Performance
```
Current CI (with proposed Option D):
  Snapshot restore: 30-60s
  Registry lookup: 1-2s per test
  Factory API calls: 2-3s per test
  Total overhead: ~90-150s per shard

Proposed Test-Owned Data:
  Application creation via API: 0.5-1s per test
  Session creation via API: 0.3-0.5s per test (already exists)
  Total overhead: ~1-2s per test

Impact on 72 tests / 4 shards (~18 tests per shard):
  Option D: 90-150s overhead
  Test-Owned: 18-36s overhead

Speed improvement: 2.5-4x FASTER
```

### Migration Path (Phased & Safe)

#### Phase 1: Create Factories (2 weeks)
```javascript
// Extract existing patterns into factories
// No test changes yet - just infrastructure
```
- ApplicationFactory
- SessionFactory
- WorkflowFactory (optional)
- **Risk**: LOW - no tests modified

#### Phase 2: Pilot Migration (1 week)
```javascript
// Convert 5-10 tests to new pattern
// Run in parallel with existing tests
```
- Choose simple tests first
- Validate pattern works
- Gather team feedback
- **Risk**: LOW - old tests still work

#### Phase 3: Gradual Migration (4-6 weeks)
```javascript
// Convert tests file-by-file
// Each PR converts 5-10 tests
// Full regression run after each PR
```
- Small, reviewable changes
- Can pause/adjust based on learnings
- **Risk**: MEDIUM - but incremental and reversible

#### Phase 4: Cleanup (1 week)
```javascript
// Remove seeder dependencies
// Update documentation
```
- Remove hardcoded references
- Document factory patterns
- **Risk**: LOW - tests already migrated

**Total Time**: 8-10 weeks (vs 10-12 for Option D)
**Risk**: MUCH LOWER - incremental, reversible
**Rollback**: Easy - just don't merge next PR

### Comparison: Option D vs Test-Owned Data

| Criteria | Option D (Hybrid) | Test-Owned Data |
|----------|------------------|-----------------|
| **Test Isolation** | Partial (via registry) | Complete (no shared data) |
| **CI Performance** | Slower (snapshot + registry) | Faster (API-only) |
| **Local Development** | Complex (snapshot infra) | Simple (API calls) |
| **Debugging** | Harder (registry layer) | Easier (data in test) |
| **Migration Risk** | High (all-or-nothing) | Low (incremental) |
| **Maintenance** | High (3 new systems) | Low (extend existing) |
| **Onboarding** | Complex (new concepts) | Simple (factory pattern) |
| **Parallel Execution** | Degraded (snapshot bottleneck) | Improved (true isolation) |
| **Rollback** | Risky (many changes) | Easy (per-file) |
| **Existing Code Reuse** | 20% | 80% |

---

## 6. Additional Test-Centric Strategies

### Contract Testing for External Services

**Problem**: Tests wait 160+ seconds for MX/Plaid responses
```javascript
// Current pattern
const maxPollingAttempts = 80; // 160 seconds
while (!connectionComplete && pollingAttempt < maxPollingAttempts) {
    // Poll for MX completion
}
```

**Solution**: Mock external service responses for fast feedback
```javascript
// /tests/mocks/mx-mock.js
export class MXMock {
    static async mockSuccessfulConnection(page) {
        await page.route('**/financial-verifications', route => {
            route.fulfill({
                status: 200,
                body: JSON.stringify({
                    data: {
                        id: 'mock-verification-id',
                        status: 'completed',
                        connection_status: 'success'
                    }
                })
            });
        });
    }

    static async mockFailedConnection(page) {
        // Similar pattern for failure cases
    }
}

// Test usage
test('MX success flow @unit @fast', async ({ page }) => {
    await MXMock.mockSuccessfulConnection(page);
    // Test completes in seconds instead of minutes
});

test('MX actual integration @integration @slow', async ({ page }) => {
    // Real MX integration - runs less frequently
});
```

**Benefits**:
- **90% of tests** run with mocks (fast, reliable)
- **10% of tests** run real integrations (comprehensive)
- **Tag-based execution**: `npm run test:fast` vs `npm run test:integration`

### API Mocking for Approval Status

```javascript
// Current: Polling for approval status (120s timeout)
await pollForApprovalStatus(page, sessionId, adminAuthToken, {
    expectedStatus: 'APPROVED',
    maxPollTime: 120_000
});

// Proposed: Mock approval calculation for deterministic tests
test('Approval status calculation @unit', async ({ page, request }) => {
    await request.route('**/sessions/*/approval-status', route => {
        route.fulfill({
            status: 200,
            body: JSON.stringify({ data: { approval_status: 'APPROVED' }})
        });
    });

    // Test UI rendering of approved status
    // Completes immediately
});

test('Real approval calculation @integration', async ({ page, request }) => {
    // Real API call - validates business logic
    // Runs less frequently
});
```

### Test Data Builders

```javascript
// /tests/builders/session-builder.js
export class SessionBuilder {
    constructor() {
        this.data = {
            first_name: 'Test',
            last_name: 'User',
            email: 'test@verifast.com',
            rent_budget: 500
        };
    }

    withName(first, last) {
        this.data.first_name = first;
        this.data.last_name = last;
        return this;
    }

    withRentBudget(amount) {
        this.data.rent_budget = amount;
        return this;
    }

    build() {
        return this.data;
    }
}

// Test usage - fluent, readable
test('Session with high rent', async ({ page }) => {
    const sessionData = new SessionBuilder()
        .withName('John', 'Doe')
        .withRentBudget(3000)
        .build();

    await generateSessionForm.fill(page, sessionData);
});
```

---

## Final Recommendation

### REJECT Option D - Implement Test-Owned Data Pattern

**Reasons**:
1. **Lower Risk**: Incremental migration vs all-or-nothing
2. **Better Performance**: No snapshot overhead, faster API calls
3. **True Isolation**: No shared seeded data between tests
4. **Simpler Maintenance**: Extends existing patterns (80% already built)
5. **Easier Debugging**: Test data creation visible in test code
6. **Team Velocity**: Faster onboarding, clearer test intent

### Implementation Roadmap

**Weeks 1-2: Foundation**
- Extract ApplicationFactory from existing code
- Enhance SessionFactory (already exists)
- Create test fixtures pattern
- **Deliverable**: Factory infrastructure ready

**Weeks 3-4: Pilot**
- Convert 10 representative tests
- Run parallel with existing tests
- Gather metrics (speed, reliability)
- Team review and feedback
- **Deliverable**: Validated pattern + metrics

**Weeks 5-10: Migration**
- Convert 10-15 tests per week
- Full regression after each batch
- Update documentation incrementally
- **Deliverable**: All tests migrated

**Weeks 11-12: Optimization**
- Add mock strategies for external services
- Implement contract testing patterns
- Optimize CI pipeline
- **Deliverable**: Production-ready test suite

### Success Metrics

**Before**:
- Test failures due to seeder changes: ~5-10 per quarter
- CI execution time: ~25 minutes (4 shards)
- New test development time: 2-4 hours
- Flaky test rate: ~3-5%

**After (Target)**:
- Test failures due to data issues: **0**
- CI execution time: **15-18 minutes** (2.5-4x faster data setup)
- New test development time: **30-60 minutes** (clear factory pattern)
- Flaky test rate: **<1%** (true isolation + mocks)

### Risk Mitigation

1. **Migration Risk**: Phased approach allows rollback at any point
2. **Performance Risk**: Pilot phase validates speed improvements
3. **Team Adoption**: Factories use familiar patterns (already in codebase)
4. **Regression Risk**: Parallel test runs during migration
5. **External Services**: Mock strategy reduces dependency

---

## Appendix: Code Examples

### Example 1: Current Test (financial_mx_2_attempts_success_and_failed_password.spec.js)

**Lines of code**: 720
**External dependencies**: MX widgets, Plaid, seeded applications
**Execution time**: ~420 seconds (7 minutes)
**Hardcoded references**:
- Application name: 'AutoTest - Financial Only, MX and Plaid'
- Organization: 'Verifast'

### Example 2: Refactored with Test-Owned Data

```javascript
import { test, expect } from '@playwright/test';
import { ApplicationFactory, SessionFactory } from '~/tests/factories';
import { MXMock } from '~/tests/mocks';

test.describe('financial_mx_2_attempts_success_and_failed_password', () => {
    let appFactory;
    let sessionFactory;
    let application;

    test.beforeAll(async ({ request }) => {
        const token = await authenticateAdmin(request);
        appFactory = new ApplicationFactory(request, token);
        sessionFactory = new SessionFactory(request, token);

        // Create application with exact requirements
        application = await appFactory.create({
            applicationName: 'Test Financial MX',
            enabledProviders: ['MX', 'Plaid'],
            applicantTypes: ['Financial Only']
        });
    });

    test('MX 2 attempts test @integration', async ({ page, browser }) => {
        // Test uses created application
        await searchApplication(page, application.name);

        // Session creation (existing pattern)
        const session = await sessionFactory.create({
            applicationId: application.id,
            userData: { first_name: 'FinMX', last_name: 'Test' }
        });

        // Test logic (unchanged)
        // ... MX flow testing
    });

    test('MX 2 attempts test @unit @fast', async ({ page, browser }) => {
        // Same test but with mocked MX
        await MXMock.mockSuccessfulConnection(page);
        await MXMock.mockFailedConnection(page);

        // Test completes in <30 seconds instead of 7 minutes
    });

    test.afterAll(async () => {
        await appFactory.cleanup();
        await sessionFactory.cleanup();
    });
});
```

**Benefits**:
- Application created per test suite (isolated)
- Clear dependencies (MX, Plaid) in application config
- Fast variant with mocks for quick feedback
- Integration variant for comprehensive testing
- Self-cleaning (no manual cleanup needed)

---

## Conclusion

The proposed Option D (Hybrid) is a well-intentioned but fundamentally flawed approach that treats symptoms rather than the disease. The root problem is **tests depending on external seeder state**, and the solution is **tests owning their data**.

The Test-Owned Data pattern:
- Leverages 80% of existing codebase infrastructure
- Provides true test isolation
- Improves CI performance by 2.5-4x
- Reduces maintenance complexity
- Enables faster test development
- Has lower migration risk (incremental vs all-or-nothing)

**Recommendation**: Reject Option D, implement Test-Owned Data pattern over 12 weeks with phased rollout.

---

**File locations**:
- This review: `/Users/isecco/Code/verifast/web-app-ui-test-framework/docs/test-data-management-review.md`
- Existing patterns to leverage:
  - `/Users/isecco/Code/verifast/web-app-ui-test-framework/tests/utils/cleanup-helper.js`
  - `/Users/isecco/Code/verifast/web-app-ui-test-framework/tests/utils/generate-session-form.js`
  - `/Users/isecco/Code/verifast/web-app-ui-test-framework/tests/api/client.js`
  - `/Users/isecco/Code/verifast/web-app-ui-test-framework/playwright.config.js`
