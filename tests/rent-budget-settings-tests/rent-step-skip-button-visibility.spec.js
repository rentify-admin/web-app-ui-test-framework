import { expect, test } from "@playwright/test";
import { adminLoginAndNavigateToApplications } from "../utils/session-utils";
import { loginWithAdmin } from "../endpoint-utils/auth-helper";
import { ApiClient } from "../api";
import { admin, app } from "../test_config";
import { getApplicationByName } from "../endpoint-utils/application-helper";
import generateSessionForm from "../utils/generate-session-form";
import { getRandomEmail } from "../utils/helper";
import { waitForJsonResponse } from "../utils/wait-response";
import { findAndInviteApplication } from "../utils/applications-page";
import { handleSkipReasonModal, setupInviteLinkSession } from "../utils/session-flow";
import { cleanupSession } from "../utils/cleanup-helper";


test.describe('VC-262 rent-step-skip-button-visibility', () => {
    let adminClient;
    let optionalRentApplication = null;
    let requiredRentApplication = null;

    // IMPORTANT:
    // These applications must already exist and be configured accordingly.
    // - OPTIONAL_RENT_APP: settings.applications.target.required = 0
    // - REQUIRED_RENT_APP: settings.applications.target.required = 1
    // We do NOT patch settings in this test to avoid parallel-run conflicts.
    const OPTIONAL_RENT_APP = 'Autotest - Rent Standard';
    const REQUIRED_RENT_APP = 'Autotest - Rent Required';

    const testResults = {
        test1: { passed: false, sessionId: null },
        test2: { passed: false, sessionId: null }
    };

    test.beforeAll(async ({ request }) => {
        console.log('🛠️  [Setup] Creating API client and logging in as admin...');
        adminClient = new ApiClient(app.urls.api, null, 20000);
        await loginWithAdmin(adminClient);
        console.log('🔑  [Setup] Admin logged in successfully.');

        console.log(`🔎  [Setup] Fetching OPTIONAL rent application by name "${OPTIONAL_RENT_APP}"...`);
        optionalRentApplication = await getApplicationByName(adminClient, OPTIONAL_RENT_APP);
        console.log('✅  [Setup] OPTIONAL rent application found:', optionalRentApplication?.name);

        console.log(`🔎  [Setup] Fetching REQUIRED rent application by name "${REQUIRED_RENT_APP}"...`);
        requiredRentApplication = await getApplicationByName(adminClient, REQUIRED_RENT_APP);
        console.log('✅  [Setup] REQUIRED rent application found:', requiredRentApplication?.name);

    })

    test('Verify Skip button visible when required=false', {
        tag: ['@core', '@regression', '@staging-ready', '@rc-ready']
    }, async ({ page }) => {
        test.setTimeout(120_000)
        if (!optionalRentApplication?.id) {
            throw new Error(`[Setup] OPTIONAL rent application not found: "${OPTIONAL_RENT_APP}"`);
        }

        const user = {
            first_name: 'RentBudget',
            last_name: 'Visibility',
            email: getRandomEmail(),
            password: 'password'
        }

        console.log('➡️ [Admin UI] Navigating to applications page and inviting user...');
        await adminLoginAndNavigateToApplications(page, admin)
        await findAndInviteApplication(page, OPTIONAL_RENT_APP);

        const { sessionId, sessionUrl, link } = await generateSessionForm.generateSessionAndExtractLink(page, user);
        testResults.test1.sessionId = sessionId;
        console.log(`🆕 [Session] Created session for user. Session ID: ${sessionId}`);

        console.log('👋 [Admin UI] Logging out of admin UI...');
        await page.getByTestId("user-dropdown-toggle-btn").click();
        await page.getByTestId("user-logout-dropdown-item").click();
        await expect(page.getByTestId("admin-login-btn")).toBeVisible({ timeout: 10_000 });

        console.log('🔗 [Applicant] Navigating to Invite Link...');
        await page.goto(link);

        console.log('🎬 [Applicant] Completing session setup (invite link session)...');
        await setupInviteLinkSession(page, { sessionUrl });

        const rentBudgetInput = page.getByTestId('rent-budget-input');
        await expect(rentBudgetInput).toBeVisible();
        console.log('✅ [UI] rent-budget-input is visible');

        const rentBudgetSkip = page.getByTestId('rent-budget-step-skip');
        await expect(rentBudgetSkip).toBeVisible();
        console.log('✅ [UI] rent-budget-step-skip (Skip button) is visible as expected');

        // Skipping a step now triggers a "Skip reason" modal; the session update request
        // won't fire until the modal is submitted.
        const sessionUpdateResp = page.waitForResponse(
            resp => resp.url().includes(`/sessions/${sessionId}`)
                && resp.ok()
                && resp.request().method() === 'GET',
            { timeout: 30_000 }
        );
        await rentBudgetSkip.click();
        await handleSkipReasonModal(page, 'Skipping rent budget step for test purposes');
        await sessionUpdateResp;
        console.log('👉 [UI] Clicked Skip on rent-budget-step; waiting for session update');

        // Check session target (rent budget) is null
        const sessionResp = await adminClient.get(`/sessions/${sessionId}`, {
            params: {
                fields: {
                    session: 'id,target'
                }
            }
        })
        const session = sessionResp.data.data;

        console.log(`🔎 [API] GET /sessions/${sessionId} -- expecting target=null. Result target: ${session.target}`);
        expect(session.target).toBe(null)

        await expect(page.getByTestId('financial-verification-step')).toBeVisible({ timeout: 10_000 })
        console.log('🎯 [UI] Arrived at financial-verification-step after skipping rent-budget step.');

        testResults.test1.passed = true
    })

    test('Verify Skip button hidden when required=true', {
        tag: ['@core', '@regression', '@staging-ready', '@rc-ready']
    }, async ({ page }) => {

        test.setTimeout(120_000)
        if (!requiredRentApplication?.id) {
            throw new Error(`[Setup] REQUIRED rent application not found: "${REQUIRED_RENT_APP}"`);
        }

        const user = {
            first_name: 'RentBudget',
            last_name: 'Visibility',
            email: getRandomEmail(),
            password: 'password'
        }

        console.log('➡️ [Admin UI] Navigating to applications page and inviting user...');
        await adminLoginAndNavigateToApplications(page, admin)
        await findAndInviteApplication(page, REQUIRED_RENT_APP);

        const { sessionId, sessionUrl, link } = await generateSessionForm.generateSessionAndExtractLink(page, user);
        testResults.test2.sessionId = sessionId;
        console.log(`🆕 [Session] Created session for user. Session ID: ${sessionId}`);

        console.log('👋 [Admin UI] Logging out of admin UI...');
        await page.getByTestId("user-dropdown-toggle-btn").click();
        await page.getByTestId("user-logout-dropdown-item").click();
        await expect(page.getByTestId("admin-login-btn")).toBeVisible({ timeout: 10_000 });

        console.log('🔗 [Applicant] Navigating to Invite Link...');
        await page.goto(link);

        console.log('🎬 [Applicant] Completing session setup (invite link session)...');
        await setupInviteLinkSession(page, { sessionUrl });

        const rentBudgetInput = page.getByTestId('rent-budget-input');
        await expect(rentBudgetInput).toBeVisible();
        console.log('✅ [UI] rent-budget-input is visible');

        const rentBudgetSkip = page.getByTestId('rent-budget-step-skip');
        await expect(rentBudgetSkip).not.toBeVisible();
        console.log('🚫 [UI] rent-budget-step-skip (Skip button) is NOT visible as expected');

        const rentBudgetContinue = page.getByTestId('rent-budget-step-continue');
        await expect(rentBudgetContinue).toBeVisible();
        await expect(rentBudgetContinue).toBeDisabled();
        console.log('🔒 [UI] rent-budget-step-continue is visible and disabled as expected');

        await rentBudgetInput.fill('1500')
        console.log('⌨️ [UI] rent-budget-input filled with "1500"');

        await expect(rentBudgetContinue).toBeEnabled();
        console.log('✅ [UI] rent-budget-step-continue is enabled after filling input');

        await Promise.all([
            page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}`)
                && resp.ok()
                && resp.request().method() === 'GET'
            ),
            rentBudgetContinue.click()
        ]);
        console.log('👉 [UI] Clicked Continue on rent-budget-step; waiting for session update');

        // Check session target (rent budget) is set correctly
        const sessionResp = await adminClient.get(`/sessions/${sessionId}`, {
            params: {
                fields: {
                    session: 'id,target'
                }
            }
        })
        const session = sessionResp.data.data;

        console.log(`🔎 [API] GET /sessions/${sessionId} -- expecting target=150000. Result target: ${session.target}`);
        expect(session.target).toBe(150000)

        await expect(page.getByTestId('financial-verification-step')).toBeVisible({ timeout: 10_000 })
        console.log('🎯 [UI] Arrived at financial-verification-step after completing rent-budget step.');

        testResults.test2.passed = true
    })


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


})
