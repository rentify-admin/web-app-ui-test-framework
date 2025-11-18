import { test, expect } from '@playwright/test';
import loginForm from '~/tests/utils/login-form';
import { app, admin } from '~/tests/test_config';
import { joinUrl } from '~/tests/utils/helper';
import { waitForJsonResponse } from '~/tests/utils/wait-response';
import {
    setupInviteLinkSession,
    skipApplicants,
    updateRentBudget,
    fillhouseholdForm,
    completePlaidFinancialStep,
    completePaystubConnection,
    waitForPlaidConnectionCompletion,
    waitForPaystubConnectionCompletion,
    identityStep
} from '~/tests/utils/session-flow';
import { gotoApplicationsPage, findAndInviteApplication, searchApplication, openInviteModal } from '~/tests/utils/applications-page';
import generateSessionForm from '~/tests/utils/generate-session-form';
import { cleanupSessionAndContexts } from './utils/cleanup-helper';



// User data for session generation
// Note: first_name will be auto-prefixed with 'AutoT - ' by the helper
// Note: email will be auto-suffixed with '+autotest' by the helper
const user = {
    email: 'playwright+skipbutton@verifications.com',
    first_name: 'SkipButton',
    last_name: 'Test',
    password: 'password'
};



test.describe('skip_button_visibility_logic', () => {
    test.describe.configure({ mode: 'default', timeout: 300000 }); // 5 minutes timeout

    // Global state for cleanup
    let sessionId = null;
    let applicantContext = null;
    let allTestsPassed = true;

    test('Should ensure skip button visibility logic across verification steps using existing application', {
        tag: ['@regression', '@external-integration', '@staging-ready', '@rc-ready'],
    }, async ({ page, browser }) => {
        try {
            // Step 1: Admin login and navigate to applications
            console.log('🚀 Step 1: Admin login and navigate to applications');
            await loginForm.adminLoginAndNavigate(page, admin);

            // Step 2: Search for existing application 
            console.log('🚀 Step 2: Search for existing application and invite');
            await gotoApplicationsPage(page);
            const existingAppName = 'Autotest - Full flow skip button test';

            const applications = await searchApplication(page, existingAppName);

            // Step 2.1: making sure that application rent budget is enabled and not required.
            const application = applications.find(item => item.name === existingAppName);
            await updateRentBudgetSetting(page, application);

            // Step 2.2 Invite Application
            await openInviteModal(page, existingAppName);

            // Step 3: Generate Session and Extract Link
            console.log('🚀 Step 3: Generate Session and Extract Link');
            const sessionData = await generateSessionForm.generateSessionAndExtractLink(page, user);
            sessionId = sessionData.sessionId;
            const { sessionUrl, link } = sessionData;

            const linkUrl = new URL(link);
            console.log('📋 Generated Session Link:', link);

            // Step 4: Applicant View — New Context
            console.log('🚀 Step 4: Applicant View — New Context');
            const context = await browser.newContext({ permissions: ['camera'] });
            applicantContext = context;  // Store for cleanup
            const applicantPage = await context.newPage();
            await applicantPage.goto(joinUrl(`${app.urls.app}`, `${linkUrl.pathname}${linkUrl.search}`));

            // Step 5: Setup session flow (terms → applicant type → state)
            console.log('🚀 Step 5: Setup session flow');
            await setupInviteLinkSession(applicantPage, {
                sessionUrl,
                applicantTypeSelector: '#affordable_occupant'
            });
            console.log('✅ Session setup complete');

            // Step 6.5: Verify we're on the rent budget step
            console.log('🚀 Step 6.5: Verify we\'re on the rent budget step');
            await expect(applicantPage.locator('input#rent_budget')).toBeVisible({ timeout: 15000 });
            console.log('✅ Rent budget input field is visible');

            // Step 7: Complete rent budget step
            console.log('🚀 Step 7: Complete rent budget step');
            await updateRentBudget(applicantPage, sessionId, 500, true);
            await applicantPage.waitForTimeout(1000);

            // Step 8: Test Skip Button Visibility for Applicants Step
            console.log('🚀 Step 8: Test Skip Button Visibility for Applicants Step');
            await testSkipButtonVisibility(applicantPage, 'applicants');

            // Step 9: Test Skip Button Visibility for Identity Verification Step
            console.log('🚀 Step 9: Test Skip Button Visibility for Identity Verification Step');
            await testSkipButtonVisibility(applicantPage, 'identity');

            // Step 10: Test Skip Button Visibility for Financial Verification Step
            console.log('🚀 Step 10: Test Skip Button Visibility for Financial Verification Step');
            await testSkipButtonVisibility(applicantPage, 'financial');

            // Step 11: Test Skip Button Visibility for Employment Verification Step
            console.log('🚀 Step 11: Test Skip Button Visibility for Employment Verification Step');
            await testSkipButtonVisibility(applicantPage, 'employment');

            // Step 12: Verify Summary screen and final statuses
            console.log('🚀 Step 12: Verify Summary screen and final statuses');
            await expect(applicantPage.locator('h3:has-text("Summary")')).toBeVisible({ timeout: 15000 });

            // Verify all steps have appropriate statuses (should be Completed after actions)
            await expect(applicantPage.locator('div').filter({ hasText: 'Rent Amount' })
                .nth(1)
                .filter({ hasText: 'Complete' })).toBeVisible();
            await expect(applicantPage.locator('div').filter({ hasText: 'Identity Verification' })
                .nth(1)
                .filter({ hasText: 'Complete' })).toBeVisible();
            await expect(applicantPage.locator('div').filter({ hasText: 'Applicants' })
                .nth(1)
                .filter({ hasText: 'Complete' })).toBeVisible();
            await expect(applicantPage.locator('div').filter({ hasText: 'Financial Verification' })
                .nth(1)
                .filter({ hasText: 'Complete' })).toBeVisible();
            await expect(applicantPage.locator('div').filter({ hasText: 'Employment Verification' })
                .nth(1)
                .filter({ hasText: 'Complete' })).toBeVisible();

            console.log('✅ Skip button visibility logic test completed successfully');
        } catch (error) {
            console.error('❌ Test failed:', error.message);
            allTestsPassed = false;
            throw error;
        }
        // Note: Context cleanup happens in afterAll
    });
    
    // ✅ Centralized cleanup
    test.afterAll(async ({ request }) => {
        await cleanupSessionAndContexts(
            request,
            sessionId,
            applicantContext,
            null,  // No admin context
            allTestsPassed
        );
    });
});

async function updateRentBudgetSetting(page, application) {
    await page.getByTestId(`edit-${application.id}`).click();
    await expect(page.getByTestId('step-#workflow-setup')).toBeVisible({ timeout: 20000 });
    await page.getByTestId('step-#approval-settings').click();

    const rentBudgetEnableInput = page.locator('input[name="rent_budget_enabled"]');
    const rentBudgetRequireInput = page.locator('input[name="rent_budget_required"]');

    // Use setChecked for more reliable state changes with custom switches
    await rentBudgetEnableInput.setChecked(true);
    await page.waitForTimeout(500); // Wait for any debounced handlers
    
    await rentBudgetRequireInput.setChecked(false);
    await page.waitForTimeout(500); // Wait for any debounced handlers

    await page.getByTestId('submit-application-setting-modal').click();
    await expect(page.getByTestId('application-table')).toBeVisible({ timeout: 20000 });
}

/**
 * Test skip button visibility logic for a specific verification step
 * @param {import('@playwright/test').Page} page
 * @param {string} stepType - 'applicants', 'identity', 'financial', 'employment'
 */
async function testSkipButtonVisibility(page, stepType) {
    console.log(`🔍 Testing skip button visibility for ${stepType} step`);

    let skipButtonLocator;
    let continueButtonLocator;

    // Configure step-specific locators
    switch (stepType) {
        case 'applicants':
            skipButtonLocator = page.getByTestId('applicant-invite-skip-btn');
            continueButtonLocator = page.getByTestId('applicant-invite-continue-btn').first();
            break;

        case 'identity':
            skipButtonLocator = page.getByTestId('skip-id-verification-btn');
            continueButtonLocator = page.getByTestId('id-verification-continue-btn');
            break;

        case 'financial':
            skipButtonLocator = page.getByTestId('skip-financials-btn');
            continueButtonLocator = page.getByTestId('financial-verification-continue-btn');
            break;

        case 'employment':
            skipButtonLocator = page.getByTestId('employment-step-skip-btn');
            continueButtonLocator = page.getByTestId('employment-step-continue');
            break;

        default:
            throw new Error(`Unknown step type: ${stepType}`);
    }

    // Phase 1: Verify Skip button is visible before any action
    console.log(`📋 Phase 1: Verify Skip button is visible before any action for ${stepType}`);
    await expect(skipButtonLocator).toBeVisible({ timeout: 20000 });
    console.log(`✅ Skip button is visible for ${stepType} step`);

    // Phase 2: Complete an action and verify Skip button disappears
    console.log(`📋 Phase 2: Complete an action and verify Skip button disappears for ${stepType}`);

    switch (stepType) {
        case 'applicants':
            // For applicants step, fill household form (this is the action that should make Skip disappear)
            const coapplicant = {
                first_name: 'SkipButton',
                last_name: 'CoApplicant',
                email: 'skipbutton.coapp@example.com'
            };

            // TODO: create request check for household form submission API call
            await fillhouseholdForm(page, coapplicant);
            break;

        case 'identity':
            // For identity verification, complete the full flow like in check_coapp_income_ratio_exceede_flag
            // TODO: create request check for identity verification start API call
            await identityStep(page);
            break;

        case 'financial':
            // For financial verification, complete Plaid connection
            // TODO: create request check for financial verification start API call
            await completePlaidFinancialStep(page);
            await waitForPlaidConnectionCompletion(page);
            break;

        case 'employment':
            // For employment verification, complete paystub connection
            // TODO: create request check for employment verification start API call
            await completePaystubConnection(page);
            await waitForPaystubConnectionCompletion(page);
            // Additional wait for UI state to update after connection completion
            await page.waitForTimeout(3000);
            break;
    }

    // Phase 3: Verify Skip button is no longer visible and Continue button appears
    console.log(`📋 Phase 3: Verify Skip button is no longer visible and Continue button appears for ${stepType}`);

    try {
        // Skip button should no longer be visible
        await expect(skipButtonLocator).not.toBeVisible({ timeout: 5000 });
        console.log(`✅ Skip button is no longer visible for ${stepType} step`);
    } catch (error) {
        console.log(`⚠️ Skip button is still visible for ${stepType} step - this may indicate an issue`);
        throw new Error(`Skip button is still visible for ${stepType} step - this indicates the skip button visibility logic is not working correctly`);
    }

    // Continue button should be visible (optional check)
    try {
        await expect(continueButtonLocator).toBeVisible({ timeout: 10000 });
        await continueButtonLocator.click();
        console.log(`✅ Continue button is visible for ${stepType} step`);
    } catch (error) {
        console.log(`⚠️ Continue button not visible for ${stepType} step`);
    }
    await page.waitForTimeout(4000); // Wait for step transition

    console.log(`✅ ${stepType} step completed successfully`);
}
