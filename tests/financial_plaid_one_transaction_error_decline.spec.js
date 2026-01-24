import { test, expect } from '@playwright/test';
import loginForm from '~/tests/utils/login-form';
import { admin } from '~/tests/test_config';
import { generateSessionForApplication, completeApplicantInitialSetup, navigateToApplicants, navigateToDashboard } from './utils/applications-page';
import { verifyTransactionErrorAndDeclineFlag } from './utils/report-page';
import { plaidFinancialConnect } from './utils/session-flow';
import { cleanupTrackedSessions } from './utils/cleanup-helper';

// Test: Financial - plaid - one or less transaction error, no income with complete verification has decline flag

test.describe('financial_plaid_one_transaction_error_decline', () => {
    test.describe.configure({ 
        timeout: 300000 // 5 minutes - increased for external Plaid integration and flag polling
    });

    const createdSessionIds = [];

    test.afterEach(async ({ request }, testInfo) => {
        await cleanupTrackedSessions({ request, sessionIds: createdSessionIds, testInfo });
    });

    test('Should handle Plaid Fin verification with insufficient transactions and decline flag', { 
        tag: ['@smoke', '@external-integration', '@regression', '@staging-ready', '@rc-ready'],
    }, async ({ page }) => {
        // Step 1: Login as admin
        await page.goto('/');
        await loginForm.fill(page, admin);
        await loginForm.submitAndSetLocale(page);
        await expect(page.getByTestId('applicants-menu')).toBeVisible();

        // Step 2: Navigate to Applications
        await page.getByTestId('applications-menu').click();
        await page.getByTestId('applications-submenu').click();

        // Step 3-4: Generate session for application
        // Note: first_name will be auto-prefixed with 'AutoT - ' by the helper
        // Note: email will be auto-suffixed with '+autotest' by the helper
        const appName = 'AutoTest - Financial Only, MX and Plaid';
        const randomName = `Test${Math.floor(Math.random() * 100000)}`;
        const userData = {
            first_name: randomName,
            last_name: randomName,
            email: `cra+${randomName}@verifast.com`
        };

        const { sessionData, link } = await generateSessionForApplication(page, appName, userData);
        const sessionId = sessionData?.data?.id;
        if (sessionId) createdSessionIds.push(sessionId);

        // Step 5: Complete applicant initial setup
        await completeApplicantInitialSetup(page, link, '555');

        // Step 6: Start Bank Verification process
        //await expect(page.locator('button:has-text("Start Bank Verification")')).toBeVisible();
        //await page.locator('button:has-text("Start Bank Verification")').click();

        // Step 7-12: Complete Plaid financial connection
        await plaidFinancialConnect(page);

        // Step 13: Verify the Summary screen is displayed after submission
        await expect(page.locator('h3:has-text("Summary")')).toBeVisible();

        // Step 14: Navigate to Dashboard, and select Applicant Inbox - All
        await navigateToDashboard(page);
        await navigateToApplicants(page);

        // Step 15-20: Verify transaction error and decline flag
        await verifyTransactionErrorAndDeclineFlag(page, randomName);

        // Test completed: Successfully verified the complete financial verification flow
        // with one transaction error, summary screen, and decline flag verification
    });
}); 