import { expect, test } from "@playwright/test"
import { ApiClient } from "../api";
import { admin, app } from "../test_config";
import { loginWithAdmin } from "../endpoint-utils/auth-helper";
import { getApplicationByName } from "../endpoint-utils/application-helper";
import { adminLoginAndNavigateToApplications } from "../utils/session-utils";
import { findAndInviteApplication } from "../utils/applications-page";
import generateSessionForm from "../utils/generate-session-form";
import { getRandomEmail } from "../utils/helper";
import { setupInviteLinkSession } from "../utils/session-flow";
import { cleanupTrackedSession } from "../utils/cleanup-helper";


test.describe('QA-267 rent-step-validation-range.spec', () => {

    const APPLICATION_NAME = 'Autotest - Rent With Range';

    const testResults = {
        test1: { passed: false, sessionId: null }
    };

    test.beforeAll(async () => {

        const adminClient = new ApiClient(app.urls.api, null, 120000);
        await loginWithAdmin(adminClient);

        // Searching application by name
        const application = await getApplicationByName(adminClient, APPLICATION_NAME);
        await expect(application).toBeDefined()

        // ⚙️ Setting Preconditions: enabled=true, locked=false, required=true, min=1000, max=5000
        console.log(`[Admin API] Setting up application "${APPLICATION_NAME}" with rent step: enabled=true, locked=false, required=true, min=1000, max=5000`)
        await adminClient.patch(`/applications/${application.id}`, {
            settings: {
                'settings.applications.target.enabled': 1,
                'settings.applications.target.required': 1,
                'settings.applications.target.locked': 0,
                'settings.applications.target.range.min': "1000",
                'settings.applications.target.range.max': "5000",
            }
        })

    })

    test('Test: Rent input validation enforces min/max range', {
        tag: ['@core', '@regression', '@staging-ready', '@rc-ready']
    }, async ({ page }) => {

        // Test: Rent input validation enforces min/max range
        console.log('========== Test: Rent input validation enforces min/max range ==========');
        console.log('Application:', APPLICATION_NAME);
        console.log('Preconditions: enabled=true, locked=false, required=true, min=1000, max=5000');

        const user = {
            first_name: 'RentBudget',
            last_name: 'Validation',
            email: getRandomEmail(),
            password: 'password'
        }

        console.log('[Admin UI] Logging in and navigating to applications page...');
        await adminLoginAndNavigateToApplications(page, admin);

        console.log('[Admin UI] Inviting applicant to application...');
        await findAndInviteApplication(page, APPLICATION_NAME);

        const { sessionId, sessionUrl, link } = await generateSessionForm.generateSessionAndExtractLink(page, user);

        testResults.test1.sessionId = sessionId;
        console.log(`[Session] Created session for user. Session ID: ${sessionId}`);

        console.log('[Admin UI] Logging out...');
        await page.getByTestId("user-dropdown-toggle-btn").click();
        await page.getByTestId("user-logout-dropdown-item").click();
        await expect(page.getByTestId("admin-login-btn")).toBeVisible({ timeout: 10_000 });

        console.log('[Applicant] Opening session invite link...');
        await page.goto(link);
        console.log('[Applicant] Completing invite link session setup...');
        await setupInviteLinkSession(page, { sessionUrl });

        // Navigate to rent budget step
        const rentBudgetStep = page.getByTestId('rent-budget-step');
        await expect(rentBudgetStep).toBeVisible();
        console.log('[UI] Navigated to rent-budget-step.');

        const rentBudgetInput = page.getByTestId('rent-budget-input');
        await expect(rentBudgetInput).toBeVisible();

        // Step 1: Verify error when below minimum
        console.log('----- Step 1: Verify error when below minimum -----');
        console.log('[UI] Entering value 500 in rent input (below min of 1000)...');
        await rentBudgetInput.fill('500');
        await expect(rentBudgetStep.locator('small.text-error')).toBeVisible();
        console.log('[UI] Error message displayed as expected for value below min.');
        const rentBudgetContinue = rentBudgetStep.getByTestId('rent-budget-step-continue');
        await expect(rentBudgetContinue).toBeVisible();
        await expect(rentBudgetContinue).toBeDisabled();
        console.log('[UI] Continue button is disabled as expected (for invalid input below min).');
        
        // Step 2: Verify error when above maximum
        console.log('----- Step 2: Verify error when above maximum -----');
        console.log('[UI] Clearing input field...');
        await rentBudgetInput.fill('');
        console.log('[UI] Entering value 6000 in rent input (above max of 5000)...');
        await rentBudgetInput.fill('6000');
        await expect(rentBudgetStep.locator('small.text-error')).toBeVisible();
        console.log('[UI] Error message displayed as expected for value above max.');
        await expect(rentBudgetContinue).toBeVisible();
        await expect(rentBudgetContinue).toBeDisabled();
        console.log('[UI] Continue button is disabled as expected (for invalid input above max).');
        
        // Step 3: Verify success when within range
        console.log('----- Step 3: Verify success when within range -----');
        console.log('[UI] Clearing input field...');
        await rentBudgetInput.fill('');
        console.log('[UI] Entering value 3000 in rent input (within range 1000-5000)...');
        await rentBudgetInput.fill('3000');
        await expect(rentBudgetStep.locator('small.text-error')).not.toBeVisible();
        console.log('[UI] No error message displayed for valid input within range.');
        await expect(rentBudgetContinue).toBeVisible();
        await expect(rentBudgetContinue).toBeEnabled();
        console.log('[UI] Continue button is enabled as expected (for valid input).');
        
        console.log('[UI] Clicking continue button to proceed...');
        await rentBudgetContinue.click();

        // Confirm navigation to next step (e.g. based on step test id not visible or next step visible)
        // Attempt to verify the rent-budget-step is NOT visible, or, optionally, next step is visible.
        await expect(rentBudgetStep).not.toBeVisible({ timeout: 10_000 });
        console.log('[UI] Rent budget step completed and navigated to next step.');

        testResults.test1.passed = true;

    })
    test.afterAll(async ({ request }, testInfo) => {
        console.log('[CleanUp] Test suite cleanup (delete any remaining test sessions if needed)');
        const results = Object.entries(testResults);
        for (let index = 0; index < results.length; index++) {
            const [key, element] = results[index];
            if (element.sessionId) {
                try {
                    console.log(`[Cleanup] Attempting to clean up session for test '${key}' (sessionId: ${element.sessionId})`);
                    await cleanupTrackedSession(request, element.sessionId, testInfo);
                    console.log(`[Cleanup] Cleanup handled for test '${key}'`);
                } catch (error) {
                    console.error(`[Cleanup] Failed to clean up session for test '${key}' (sessionId: ${element.sessionId}): ${error}`);
                }
            }
        }
        console.log('[CleanUp] Complete.');
    });
})