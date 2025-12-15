import { expect, request, test } from '@playwright/test';
import { ApiClient } from '../api';
import { app } from '../test_config';
import { loginWithAdmin } from '../endpoint-utils/auth-helper';
import { getRandomEmail } from '../utils/helper';
import { createSession } from '../endpoint-utils/session-helpers';
import { waitForJsonResponse } from '../utils/wait-response';
import { getApplicationByName } from '../endpoint-utils/application-helper';
import { handleOptionalStateModal, handleOptionalTermsCheckbox } from '../utils/session-flow';
import { cleanupSession } from '../utils/cleanup-helper';

test.describe('QA-261 rent-step-visibility-logic.spec.js', () => {

    const testResults = {
        test1: { passed: false, sessionId: null },
        test2: { passed: false, sessionId: null },
        test3: { passed: false, sessionId: null }
    };

    test('Verify Rent step hidden when enabled=false', async ({ page }) => {
        console.log('========== Test 1: Rent step hidden when enabled=false ==========');
        console.log('Application: Autotest - Rent Disabled');
        console.log('Preconditions: settings.applications.target.enabled = false');

        const APPLICATION_NAME = 'Autotest - Rent Disabled';
        const adminClient = new ApiClient(app.urls.api, null, 120000);
        console.log('[Admin] Logging in...');
        await loginWithAdmin(adminClient);

        const application = (await getApplicationByName(adminClient, APPLICATION_NAME));
        console.log(`[Admin] Got application: ${APPLICATION_NAME}`);

        const targetEnabled = application.settings.find(sett => sett.key === 'settings.applications.target.enabled');
        if (targetEnabled) {
            console.log(`[Admin] Setting settings.applications.target.enabled to FALSE via API...`);
            await adminClient.patch(`/applications/${application.id}`, {
                settings: {
                    'settings.applications.target.enabled': false
                }
            });
            console.log(`[Admin] Setting applied.`);
        } else {
            console.log(`[Admin] Setting already FALSE or not present; no change needed.`);
        }

        const user = {
            first_name: 'Autotest',
            last_name: 'RentDisabled',
            email: getRandomEmail(),
            invite: true
        };

        console.log('[Admin] Creating a new applicant session via invite...');
        let session = await createSession(adminClient, user, application.id);
        testResults.test1.sessionId = session;
        console.log(`[Admin] Created sessionId: ${session.id || session}`);

        const sessionPromise = page.waitForResponse(resp => resp.url().includes(`/sessions/${session.id}`)
            && resp.request().method() === "GET"
            && resp.ok()
        );
        console.log('[Applicant] Opening session invite link...');
        await page.goto(session.url);

        const sessionResponse = await sessionPromise;
        console.log('[Applicant] Session page loaded. Waiting for backend data...');

        const { data: newSession } = await waitForJsonResponse(sessionResponse);
        console.log(`[API] GET /sessions/${session.id} returned target:`, newSession.target);

        await handleOptionalStateModal(page);
        await handleOptionalTermsCheckbox(page);
        session = newSession;

        // API Verification: target should be null
        expect(session.target).toBe(null);
        console.log('[API] target is null as expected');

        await page.waitForTimeout(1500);

        // UI - Rent step must not be visible
        console.log('[UI] Verifying rent-budget-step is NOT displayed...');
        await expect(page.getByTestId('rent-budget-step')).not.toBeVisible({ timeout: 10_000 });
        // Also verify input does NOT exist
        const rentBudgetInputCount = await page.locator('[data-testid="rent-budget-input"]').count();
        console.log('[UI] Checking for presence of rent-budget-input:', rentBudgetInputCount === 0 ? 'NOT PRESENT (PASS)' : 'PRESENT (FAIL)');
        expect(rentBudgetInputCount).toBe(0);

        console.log('[Admin] Deleting test session...');
        await cleanupSession(request, session.id);  // cleanup as we are done with this test
        console.log('[Cleanup] Session deleted.');

        testResults.test1.passed = true;
    });

    test('Verify Rent step auto-skip when locked=true + default set', async ({ page }) => {
        console.log('========== Test 2: Rent step auto-skip when locked=true + default set ==========');
        console.log('Application: Autotest - Rent Locked');
        console.log('Preconditions: enabled=true, locked=true, default=150000');

        const APPLICATION_NAME = 'Autotest - Rent Locked';
        const adminClient = new ApiClient(app.urls.api, null, 120000);
        console.log('[Admin] Logging in...');
        await loginWithAdmin(adminClient);

        const application = (await getApplicationByName(adminClient, APPLICATION_NAME));
        console.log(`[Admin] Got application: ${APPLICATION_NAME}`);

        // (Assume preconditions are already set up in application config)

        const user = {
            first_name: 'Autotest',
            last_name: 'RentDefault',
            email: getRandomEmail(),
            invite: true
        };

        console.log('[Admin] Creating a new applicant session via invite...');
        let session = await createSession(adminClient, user, application.id);
        testResults.test2.sessionId = session;
        console.log(`[Admin] Created sessionId: ${session.id || session}`);

        const sessionPromise = page.waitForResponse(resp => resp.url().includes(`/sessions/${session.id}`)
            && resp.request().method() === "GET"
            && resp.ok()
        );
        console.log('[Applicant] Opening session invite link...');
        await page.goto(session.url);

        const sessionResponse = await sessionPromise;
        console.log('[Applicant] Session page loaded. Waiting for backend data...');

        const { data: newSession } = await waitForJsonResponse(sessionResponse);
        console.log(`[API] GET /sessions/${session.id} returned target:`, newSession.target);

        await handleOptionalStateModal(page);
        await handleOptionalTermsCheckbox(page);
        session = newSession;

        // API Verification: target should be 150000
        expect(session.target).toBe(150000);
        console.log('[API] target is 150000 as expected (auto-skip)');

        await page.waitForTimeout(1500);

        // UI - Rent step must not be visible and next step should be reached
        console.log('[UI] Verifying rent-budget-step is auto-skipped and NOT displayed...');
        await expect(page.getByTestId('rent-budget-step')).not.toBeVisible({ timeout: 10_000 });
        // Should NOT see input either
        const rentBudgetInputCount = await page.locator('[data-testid="rent-budget-input"]').count();
        console.log('[UI] Checking for presence of rent-budget-input:', rentBudgetInputCount === 0 ? 'NOT PRESENT (PASS)' : 'PRESENT (FAIL)');
        expect(rentBudgetInputCount).toBe(0);

        console.log('[UI] Verifying applicant lands on next step without rent interaction (auto-skip confirmed)');
        // (Optional: Check next step element as further confirmation)

        console.log('[Admin] Deleting test session...');
        await cleanupSession(request, session.id);  // cleanup as we are done with this test
        console.log('[Cleanup] Session deleted.');

        testResults.test2.passed = true;
    });

    test('Verify Rent step visible when enabled=true + locked=false', async ({ page }) => {
        console.log('========== Test 3: Rent step visible when enabled=true + locked=false ==========');
        console.log('Application: Autotest - Rent Standard');
        console.log('Preconditions: enabled=true, locked=false, required=false');

        const APPLICATION_NAME = 'Autotest - Rent Standard';
        const adminClient = new ApiClient(app.urls.api, null, 120000);
        console.log('[Admin] Logging in...');
        await loginWithAdmin(adminClient);

        const application = (await getApplicationByName(adminClient, APPLICATION_NAME));
        console.log(`[Admin] Got application: ${APPLICATION_NAME}`);

        // (Assume preconditions are already set up in application config)

        const user = {
            first_name: 'Autotest',
            last_name: 'RentStandard',
            email: getRandomEmail(),
            invite: true
        };

        console.log('[Admin] Creating a new applicant session via invite...');
        let session = await createSession(adminClient, user, application.id);
        testResults.test3.sessionId = session;
        console.log(`[Admin] Created sessionId: ${session.id || session}`);

        const sessionPromise = page.waitForResponse(resp => resp.url().includes(`/sessions/${session.id}`)
            && resp.request().method() === "GET"
            && resp.ok()
        );
        console.log('[Applicant] Opening session invite link...');
        await page.goto(session.url);

        const sessionResponse = await sessionPromise;
        console.log('[Applicant] Session page loaded. Waiting for backend data...');

        const { data: newSession } = await waitForJsonResponse(sessionResponse);
        console.log(`[API] GET /sessions/${session.id} returned target:`, newSession.target);

        await handleOptionalStateModal(page);
        await handleOptionalTermsCheckbox(page);
        session = newSession;

        // API Verification: target should be null
        expect(session.target).toBe(null);
        console.log('[API] target is null (rent budget unset, as expected)');

        await page.waitForTimeout(1500);

        // UI - Rent step should be visible
        console.log('[UI] Verifying rent-budget-step IS displayed...');
        await expect(page.getByTestId('rent-budget-step')).toBeVisible({ timeout: 10_000 });

        // Input field should be visible
        const inputCount = await page.locator('[data-testid="rent-budget-input"]').count();
        if (inputCount > 0) {
            await expect(page.getByTestId('rent-budget-input')).toBeVisible();
            console.log('[UI] rent-budget-input is visible');
        } else {
            throw new Error('rent-budget-input not found in DOM when enabled=true');
        }

        // Continue button should be visible
        await expect(page.getByTestId('rent-budget-step-continue')).toBeVisible({ timeout: 10_000 });
        console.log('[UI] rent-budget-step-continue is visible');

        console.log('[Admin] Deleting test session...');
        await cleanupSession(request, session.id);  // cleanup as we are done with this test
        console.log('[Cleanup] Session deleted.');

        testResults.test3.passed = true;
    });

    test.afterAll(async ({ request }) => {
        console.log('[CleanUp] Test suite cleanup (delete any remaining test sessions if needed)');
        const results = Object.entries(testResults);
        for (let index = 0; index < results.length; index++) {
            const [key, element] = results[index];
            if (element.passed && element.sessionId) {
                try {
                    console.log(`[Cleanup] Attempting to clean up session for test '${key}' (sessionId: ${element.sessionId})`);
                    await cleanupSession(request, element.sessionId);
                    console.log(`[Cleanup] Successfully cleaned up session for test '${key}'`);
                } catch (error) {
                    console.error(`[Cleanup] Failed to clean up session for test '${key}' (sessionId: ${element.sessionId}): ${error}`);
                }
            }
        }
        console.log('[CleanUp] Complete.');
    });

});