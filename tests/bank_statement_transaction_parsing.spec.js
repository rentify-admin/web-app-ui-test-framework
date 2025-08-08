import { expect, test } from '@playwright/test';
import loginForm from '~/tests/utils/login-form';
import { admin } from '~/tests/test_config';
import { findAndInviteApplication } from '~/tests/utils/applications-page';
import generateSessionForm from './utils/generate-session-form';
import { 
    uploadStatementFinancialStep, 
    completeApplicantForm, 
    waitForConnectionCompletion, 
    continueFinancialVerification 
} from './utils/session-flow';
import { navigateAndValidateFinancialData } from './utils/report-page';

const user = {
    email: 'playwright+korey@verifications.com',
    first_name: 'Korey',
    last_name: 'Lockett',
    password: 'password'
};

test.describe('Bank statement transaction parsing', () => {
    test.describe.configure({ mode: 'default' });

    test('Login with admin user', {
      tag: ['@regression'],
    }, async ({ browser, page }) => {
        // Set timeout to 130 seconds (30 seconds more than the current 100 second timeout)
        test.setTimeout(130000);
        
        // Step 1: Admin Login and Navigate to Applications
        await loginForm.adminLoginAndNavigate(page, admin);

        // Step 2: Find and Invite Application
        await findAndInviteApplication(page, 'AutoTest - Playwright Fin Doc Upload Test');

        // Step 3: Generate Session and Extract Link
        const { sessionId, sessionUrl, link } = await generateSessionForm.generateSessionAndExtractLink(page, user);

        // Step 4: Applicant View — New Context
        const context = await browser.newContext();
        const applicantPage = await context.newPage();
        await applicantPage.goto(link);

        // Step 5: Complete Applicant Form
        await completeApplicantForm(applicantPage, '500', sessionUrl);

        // Step 6: Upload and Process Bank Statement
        await uploadStatementFinancialStep(applicantPage);
        await applicantPage.waitForTimeout(1000);
        
        // Step 7: Wait for Connection Completion
        await waitForConnectionCompletion(applicantPage);

        // Step 8: Continue Financial Verification
        await continueFinancialVerification(applicantPage);

        // Step 9: Close Applicant Context
        await applicantPage.close();

        // Step 10: Navigate to Admin Panel and Validate Financial Data
        await navigateAndValidateFinancialData(page, sessionId);
    });
});
