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
import { setupInviteLinkSession } from "../utils/session-flow";
import { cleanupSession } from "../utils/cleanup-helper";


test.describe('VC-262 rent-step-skip-button-visibility', () => {
    let adminClient;
    let application = null;

    const APPLICATION_NAME = 'Autotest - Rent Standard'
    const testResults = {
        test1: { passed: false, sessionId: null },
        test2: { passed: false, sessionId: null }
    };

    test.beforeAll(async ({ request }) => {
        console.log('🛠️  [Setup] Creating API client and logging in as admin...');
        adminClient = new ApiClient(app.urls.api, null, 20000);
        await loginWithAdmin(adminClient);
        console.log('🔑  [Setup] Admin logged in successfully.');

        console.log(`🔎  [Setup] Fetching application by name "${APPLICATION_NAME}"...`);
        application = await getApplicationByName(adminClient, APPLICATION_NAME);
        console.log('✅  [Setup] Application found:', application.name);

    })

    test('Verify Skip button visible when required=false', {
        tag: ['@core', '@regression']
    }, async ({ page }) => {
        test.setTimeout(120_000)
        // ⚙️ Setting Preconditions: enabled=true, locked=false, required=false
        await adminClient.patch(`/applications/${application.id}`, {
            settings: {
                'settings.applications.target.enabled': 1,
                'settings.applications.target.required': 0,
                'settings.applications.target.locked': 0,
            }
        })
        console.log('☑️ [Precondition] Application settings set: enabled=1, required=0, locked=0');

        const user = {
            first_name: 'RentBudget',
            last_name: 'Visibility',
            email: getRandomEmail(),
            password: 'password'
        }

        console.log('➡️ [Admin UI] Navigating to applications page and inviting user...');
        await adminLoginAndNavigateToApplications(page, admin)
        await findAndInviteApplication(page, APPLICATION_NAME);

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

        await Promise.all([
            page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}`)
                && resp.ok()
                && resp.request().method() === 'GET'
            ),
            rentBudgetSkip.click()
        ]);
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
        tag: ['@core', '@regression']
    }, async ({ page }) => {

        test.setTimeout(120_000)
        // ⚙️ Setting Preconditions: enabled=true, locked=false, required=true
        await adminClient.patch(`/applications/${application.id}`, {
            settings: {
                'settings.applications.target.enabled': 1,
                'settings.applications.target.required': 1,
                'settings.applications.target.locked': 0,
            }
        })
        console.log('☑️ [Precondition] Application settings set: enabled=1, required=1, locked=0');

        const user = {
            first_name: 'RentBudget',
            last_name: 'Visibility',
            email: getRandomEmail(),
            password: 'password'
        }

        console.log('➡️ [Admin UI] Navigating to applications page and inviting user...');
        await adminLoginAndNavigateToApplications(page, admin)
        await findAndInviteApplication(page, APPLICATION_NAME);

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
