import { test, expect } from '@playwright/test';
import { adminLoginAndNavigateToApplications } from '~/tests/utils/session-utils';
import { admin } from '~/tests/test_config';
import { findAndInviteApplication } from '~/tests/utils/applications-page';
import { getRandomEmail } from '~/tests/utils/helper';
import { completePaystubConnection, fillhouseholdForm, identityStep, setupInviteLinkSession, updateRentBudget, completePlaidFinancialStepBetterment, waitForPlaidConnectionCompletion, handleSkipReasonModal } from '~/tests/utils/session-flow';
import generateSessionForm from '~/tests/utils/generate-session-form';
import { cleanupTrackedSessions } from './utils/cleanup-helper';

let createdSessionId = null;
let createdSessionIds = [];

test.describe('application_step_should_skip_properly', () => {
    test.beforeEach(() => {
        // Reset per-attempt tracking (important with Playwright retries)
        createdSessionIds = [];
        createdSessionId = null;
    });

    test('Check Application step skip works propertly', {
        tag: ['@regression', '@staging-ready', '@rc-ready']
    }, async ({ page, browser }) => {
        test.setTimeout(300_000);
        
        
        // Note: first_name will be auto-prefixed with 'AutoT - ' by the helper
        // Note: email will be auto-suffixed with '+autotest' by the helper
        const user = {
            email: getRandomEmail(),
            first_name: 'Playwright',
            last_name: 'Skip',
            password: 'password'
        };
    
        // Note: Co-app first_name will also be auto-prefixed with 'AutoT - '
        // Note: Co-app email will also be auto-suffixed with '+autotest'
        const coApp = {
            email: getRandomEmail(),
            first_name: 'Playwright',
            last_name: 'Skip Coapp'
        };
    
        const appName = 'AutoTest Suite - Full Test';
    
        console.log('🚀 Login and go to application page')
        await adminLoginAndNavigateToApplications(page, admin);
        console.log('✅ Done Login and go to application page')
    
        console.log('🚀 Find application and click invite')
        await findAndInviteApplication(page, appName);
        console.log('✅ Done Find application and click invite')
    
        console.log('🚀 Invite Applicant')
        const { sessionId, sessionUrl, link } = await generateSessionForm.generateSessionAndExtractLink(page, user);
        createdSessionId = sessionId;
        if (sessionId) {
            createdSessionIds.push(sessionId); // Store for cleanup (retry-safe)
        }
        console.log('✅ Done Invite Applicant')
    
        await page.getByTestId('user-dropdown-toggle-btn').click();
        await page.getByTestId('user-logout-dropdown-item').click();
    
        await expect(page.getByTestId('admin-login-btn')).toBeVisible({ timeout: 10_000 })
    
        console.log('🚀 Open invite URL')
        // const context = await browser.newContext();
        // const applicantPage = await context.newPage();
        await page.goto(link);
        console.log('✅ Done Open invite URL')
    
        await setupInviteLinkSession(page, {
            sessionUrl,
            applicantTypeSelector: '#employed'
        });
    
        console.log('🚀 Filing rent budget')
        await updateRentBudget(page, sessionId, '500', { handlePrerequisite: true });
        console.log('✅ Filing rent budget')
    
        console.log('🚀 Skip invite page')
        await page.getByTestId('applicant-invite-skip-btn').click();
        await handleSkipReasonModal(page, "Skipping applicants step for test purposes");
        console.log('✅ Skip invite page')
    
        console.log('🚀 Id verification step')
        await expect(page.getByTestId('start-id-verification')).toBeVisible({ timeout: 10_000 });
        await identityStep(page);
        console.log('✅ Done Id verification step')
    
        console.log('🚀 Financial Step')
        await completePlaidFinancialStepBetterment(page, 'custom_coffee', 'custom_gig');
        console.log('✅ Done Financial Step')

        await waitForPlaidConnectionCompletion(page);
    
        console.log('🚀 Skip employment step')
        await page.getByTestId('employment-step-skip-btn').click({ timeout: 10_000 });
        await handleSkipReasonModal(page, "Skipping employment step for test purposes");
        console.log('✅ Done Skip employment step')
    
        console.log('🚀 Summary page')
        await expect(page.getByTestId('summary-completed-section')).toBeVisible({ timeout: 10_000 });
        await page.waitForTimeout(3000);

        console.log('🚀 Going to Invite Page')
        await page.locator('div[role=button]').filter({
            hasText: 'Applicants',
            visible: true
        }).filter({
            hasText: 'Skipped'
        }).click();
    
        await expect(page.getByTestId('applicant-invite-step')).toBeVisible({ timeout: 10_000 });
        console.log('✅ On Invite Page')
    
        console.log('🚀 Skipping Invite Page')
        await page.getByTestId('applicant-invite-skip-btn').click();
        await handleSkipReasonModal(page, "Skipping applicants step for test purposes");
    
        await expect(page.getByTestId('summary-completed-section')).toBeVisible({ timeout: 10_000 });
        console.log('✅ On Summary Page')
    
        console.log('🚀 Going to employment page')
        await page.locator('div[role=button]').filter({
            hasText: 'Employment Verification',
            visible: true
        }).filter({
            hasText: 'Skipped'
        }).click();
    
        await expect(page.getByTestId('employment-step-skip-btn')).toBeVisible({ timeout: 10_000 });
        console.log('✅ On employment page')
    
        console.log('🚀 Skipping employment page')
        await page.getByTestId('employment-step-skip-btn').click();
        await handleSkipReasonModal(page, "Skipping employment step for test purposes");
    
        await expect(page.getByTestId('summary-completed-section')).toBeVisible({ timeout: 10_000 });;
        console.log('✅ On Summary page')
        await page.waitForTimeout(3000);
    
        console.log('🚀 Going to rent budget')
        await page.locator('div[role=button]').filter({
            hasText: 'Rent Amount',
            visible: true
        }).filter({
            hasText: 'Completed'
        }).click();
    
        await expect(page.locator('label[for="rent_budget"]')).toBeVisible({ timeout: 10_000 });
        console.log('✅ On rent budget')
    
        console.log('🚀 Updating rent budget')
        await updateRentBudget(page, sessionId, '1000', { handlePrerequisite: true });
    
        await expect(page.getByTestId('summary-completed-section')).toBeVisible({ timeout: 10_000 });
        console.log('✅ On Summary page')
    
        console.log('🚀 Going to invite page')
        await page.locator('div[role=button]').filter({
            hasText: 'Applicants',
            visible: true
        }).filter({
            hasText: 'Skipped'
        }).click();
    
        await expect(page.getByTestId('applicant-invite-step')).toBeVisible({ timeout: 10_000 });
        console.log('✅ On invite page')
    
        console.log('🚀 Adding co applicant')
        await fillhouseholdForm(page, coApp);
        console.log('✅ Added co applicant')
    
        console.log('🚀 Completing invite step')
        await page.getByTestId('applicant-invite-continue-btn').filter({ visible: true }).click();
        console.log('✅ Completed invite step')

        await page.waitForTimeout(3000);
    
        await expect(page.getByTestId('summary-completed-section')).toBeVisible({ timeout: 10_000 });
        console.log('✅ On Summary step')
    
        await page.waitForTimeout(6000);
        
        console.log('🚀 Going to employment step')
        await page.locator('div[role=button]').filter({
            hasText: 'Employment Verification',
            visible: true
        }).filter({
            hasText: 'Skipped'
        }).click();
        console.log('✅ On employment step')
    
        console.log('🚀 Completing paystub connection')
        await completePaystubConnection(page);
        console.log('✅ Completed paystub connection')
    
        console.log('🚀 Completing employment step')
        await page.getByTestId('employment-step-continue').click();
        console.log('✅ Completed employment step')
    
        await expect(page.getByTestId('summary-completed-section')).toBeVisible({ timeout: 10_000 });
        console.log('✅ On summary page')
    
        await page.close();
    });
    
    // Always cleanup by default; keep artifacts only when KEEP_FAILED_ARTIFACTS=true and test failed
    test.afterEach(async ({ request }, testInfo) => {
        await cleanupTrackedSessions({ request, sessionIds: createdSessionIds, testInfo });
    });
});


