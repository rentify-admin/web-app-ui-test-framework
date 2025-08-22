import { test, expect } from '@playwright/test';
import { adminLoginAndNavigateToApplications } from '~/tests/utils/session-utils';
import { findAndInviteApplication } from '~/tests/utils/applications-page';
import { admin } from './test_config';
import generateSessionForm from '~/tests/utils/generate-session-form';
import { completePaystubConnection, fillhouseholdForm, selectApplicantType, updateRentBudget, updateStateModal } from '~/tests/utils/session-flow';
import { getRandomEmail } from './utils/helper';

test.describe('frontent-session-heartbeat', () => {
    test('Verify Frontend session heartbeat', async ({ page }) => {
        test.setTimeout(250_000)
    
        const user = {
            email: getRandomEmail(),
            first_name: 'Playwright',
            last_name: 'Heartbeat',
            password: 'password'
        };
    
        const coApp = {
            email: getRandomEmail(),
            first_name: 'PWCoapp',
            last_name: 'Heartbeat'
        };
    
        const appName = 'Autotest - Application Heartbeat (Frontend)';
    
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
        await page.goto(link);
        console.log('✅ Done Open invite URL')
    
        console.log('🚀 Selecting Applicant type employed')
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
    
        console.log('🚀 Going to Invite Page')
        await page.locator('div[role=button]').filter({
            hasText: 'Applicants',
            visible: true
        }).filter({
            hasText: 'Skipped'
        }).click();
    
        await expect(page.getByTestId('applicant-invite-step')).toBeVisible({ timeout: 10_000 });
        console.log('✅ On Invite Page')
    
        console.log('🚀 Adding co applicant')
        await fillhouseholdForm(page, coApp);
        console.log('✅ Added co applicant')
    
        console.log('🚀 Completing invite step')
        await page.getByTestId('applicant-invite-continue-btn').filter({ visible: true }).click();
        console.log('✅ Completed invite step')
        await expect(page.getByTestId('start-id-verification')).toBeVisible({ timeout: 10_000 });
        console.log('✅ On Id verification step')
    
        console.log('🚀 Clicking manual upload')
        await page.getByTestId('start-manual-upload-id-verification').click();
        console.log('✅ On Manual Upload Step')
    
        console.log('🚀 Clicking manual upload cancel')
        await page.getByTestId('cancel-manual-upload-btn').click();
        console.log('✅ On Id Step')
    
        console.log('🚀 Skipping ID Step')
        await page.getByTestId('skip-id-verification-btn').click();
        await expect(page.getByTestId('connect-bank')).toBeVisible({ timeout: 30_000 });
        console.log('✅ On Financial step')
    
        console.log('🚀 Clicking manual upload button financial')
        await page.getByTestId('financial-upload-statement-btn').click({ timeout: 20_000 });
        await expect(page.getByTestId('cancel-manual-upload-btn')).toBeVisible({ timeout: 10_000 });
        console.log('✅ On Manual upload step')
    
        console.log('🚀 Cancelling manual upload step')
        await page.getByTestId('cancel-manual-upload-btn').click({ timeout: 20_000 });
        await expect(page.getByTestId('connect-bank')).toBeVisible({ timeout: 10_000 });
        console.log('✅ On Financial step')
    
        console.log('🚀 Skipping financial step')
        await page.getByTestId('skip-financials-btn').click({ timeout: 10_000 });
        await expect(page.getByTestId('document-pay_stub')).toBeVisible({ timeout: 20_000 })
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
