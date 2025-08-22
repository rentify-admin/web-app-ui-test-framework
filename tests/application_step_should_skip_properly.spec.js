import { test, expect } from '@playwright/test';
import { adminLoginAndNavigateToApplications } from '~/tests/utils/session-utils';
import { admin } from '~/tests/test_config';
import { findAndInviteApplication } from '~/tests/utils/applications-page';
import { getRandomEmail } from '~/tests/utils/helper';
import { completePaystubConnection, fillhouseholdForm, identityStep, selectApplicantType, updateRentBudget, updateStateModal } from '~/tests/utils/session-flow';
import generateSessionForm from '~/tests/utils/generate-session-form';



const completePlaidConnection = async (applicantPage, username = 'custom_gig') => {
    await applicantPage.getByTestId('financial-secondary-connect-btn').click({ timeout: 20_000 });

    const pFrame = await applicantPage.frameLocator('#plaid-link-iframe-1');

    const plaidFrame = await pFrame.locator('reach-portal');

    await plaidFrame.locator('#aut-secondary-button').click({ timeout: 20_000 });

    await plaidFrame.locator('[aria-label="Betterment"]').click({ timeout: 20_000 });

    await plaidFrame.locator('#aut-input-0-input').fill(username);

    await plaidFrame.locator('#aut-input-1-input').fill('custom_gig');

    await plaidFrame.locator('#aut-button').click({ timeout: 20_000 });

    await plaidFrame.locator('#aut-button:not([disabled])').click({ timeout: 20_000 });

    await plaidFrame.locator('#aut-secondary-button').click({ timeout: 20_000 });

    await applicantPage.getByTestId('financial-verification-continue-btn').click({ timeout: 20_000 });
};

test.describe('application_step_should_skip_properly', () => {
    test('Check Application step skip works propertly', async ({ page, browser }) => {
        test.setTimeout(300_000)
    
        const user = {
            email: getRandomEmail(),
            first_name: 'Playwright',
            last_name: 'Skip',
            password: 'password'
        };
    
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
        console.log('✅ Done Invite Applicant')
    
        await page.getByTestId('user-dropdown-toggle-btn').click();
        await page.getByTestId('user-logout-dropdown-item').click();
    
        await expect(page.getByTestId('admin-login-btn')).toBeVisible({ timeout: 10_000 })
    
        console.log('🚀 Open invite URL')
        // const context = await browser.newContext();
        // const applicantPage = await context.newPage();
        await page.goto(link);
        console.log('✅ Done Open invite URL')
    
        console.log('🚀 Seleting Applicant type employed')
        await selectApplicantType(page, sessionUrl, '#employed');
        console.log('✅ Selected Applicant type employed')
    
        console.log('🚀 Filing state modal')
        await updateStateModal(page, 'ALABAMA');
        console.log('✅ Done Filing state modal')
    
        console.log('🚀 Filing rent budget')
        await updateRentBudget(page, sessionId, '500');
        console.log('✅ Filing rent budget')
    
        console.log('🚀 Skip invite page')
        await page.getByTestId('applicant-invite-skip-btn').click();
        console.log('✅ Skip invite page')
    
        console.log('🚀 Id verification step')
        await expect(page.getByTestId('start-id-verification')).toBeVisible({ timeout: 10_000 });
        await identityStep(page);
        console.log('✅ Done Id verification step')
    
        console.log('🚀 Financial Step')
        await completePlaidConnection(page, 'custom_coffee');
        console.log('✅ Done Financial Step')
    
        console.log('🚀 Skip employment step')
        await page.getByTestId('employment-step-skip-btn').click({ timeout: 10_000 });
        console.log('✅ Done Skip employment step')
    
        console.log('🚀 Summary page')
        await expect(page.getByTestId('summary-completed-section')).toBeVisible({ timeout: 10_000 });
    
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
    
        await expect(page.getByTestId('summary-completed-section')).toBeVisible({ timeout: 10_000 });;
        console.log('✅ On Summary page')
    
        console.log('🚀 Going to rent budget')
        await page.locator('div[role=button]').filter({
            hasText: 'Rent Budget',
            visible: true
        }).filter({
            hasText: 'Completed'
        }).click();
    
        await expect(page.locator('label[for="rent_budget"]')).toBeVisible({ timeout: 10_000 });
        console.log('✅ On rent budget')
    
        console.log('🚀 Updating rent budget')
        await updateRentBudget(page, sessionId, '1000');
    
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
    
        await expect(page.getByTestId('summary-completed-section')).toBeVisible({ timeout: 10_000 });
        console.log('✅ On Summary step')
    
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
    
        await page.close()
    })
})


