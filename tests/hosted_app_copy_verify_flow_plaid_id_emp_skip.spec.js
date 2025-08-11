import { test, expect } from '@playwright/test';
import loginForm from '~/tests/utils/login-form';
import { app } from '~/tests/test_config';
import { joinUrl } from '~/tests/utils/helper';
import { waitForJsonResponse } from '~/tests/utils/wait-response';
import { admin } from '~/tests/test_config';
import {
    handleOptionalStateModal,
    skipEmploymentVerification,
    plaidFinancialConnect,
    completeIdVerification,
    skipApplicants,
    completeApplicantRegistrationForm
} from '~/tests/utils/session-flow';
import { findAndCopyApplication } from '~/tests/utils/applications-page';

const applicationName = 'AutoTest Suite Hshld-ID-Emp-Fin with skips';

// Generate random phone number for testing
const generateRandomPhone = () => {
    const random4Digits = Math.floor(1000 + Math.random() * 9000);
    return `613292${random4Digits}`;
};

test.describe('hosted_app_copy_verify_flow_plaid_id_emp_skip', () => {
    test('Should complete hosted application flow with id emp skips and Plaid integration', { 
        tag: [ '@smoke', '@regression', '@document-upload' ],
        timeout: 180_000  // 5 minutes
    }, async ({ page, browser }) => {

        // Step 1: Admin login and navigate to applications
        await loginForm.adminLoginAndNavigate(page, admin);

        // Step 2: Find application and copy link
        const applicationUrl = await findAndCopyApplication(page, applicationName);
        console.log('📋 Application URL:', applicationUrl);

        // Step 3: Logout current user
        await page.getByTestId('user-dropdown-toggle-btn').click();
        await page.getByTestId('user-logout-dropdown-item').click();
        await page.waitForTimeout(2000);

        // Step 4: Navigate directly to the copied application URL (simulate applicant)
        // Note: This test doesn't create a new context, so permissions are handled by the main page context
        await page.goto(applicationUrl);

        // Step 5: Phone login flow
        const phoneNumber = generateRandomPhone();
        await page.getByTestId('phone-input').fill(phoneNumber);
        await page.getByTestId('get-started-btn').click();

        // Enter verification code (123456)
        const codeInputs = page.locator('input[placeholder="-"]');
        await expect(codeInputs).toHaveCount(6);
        for (let i = 0;i < 6;i++) {
            await codeInputs.nth(i).fill(String(i + 1));
        }
        await page.locator('button[type="submit"]').click();

        // Step 6: Fill applicant registration form
        await completeApplicantRegistrationForm(page, {
            firstName: 'teset',
            lastName: 'testrelogin',
            state: 'ALASKA'
        });

        // Step 7: Wait for rent budget form and fill it
        await page.waitForSelector('input[id="rent_budget"]', { timeout: 16000 });
        await page.locator('input[id="rent_budget"]').fill('500');
        await page.locator('button[type="submit"]').click();

        // Step 8: Skip Applicants
        await skipApplicants(page);

        // Step 9: Complete ID Verification (Passport) with upload
        await completeIdVerification(page, true);

        // Step 10: Skip employment verification
        await skipEmploymentVerification(page);

        // Step 11: Complete Plaid financial connection
        await plaidFinancialConnect(page);

        // Step 12: Verify Summary screen and statuses
        await expect(page.locator('h3:has-text("Summary")')).toBeVisible({ timeout: 15000 });

        // Verify statuses - using filter to find the specific parent div
        await expect(page.locator('div').filter({ hasText: 'Rent Budget' })
            .nth(1)
            .filter({ hasText: 'Complete' })).toBeVisible();
        await expect(page.locator('div').filter({ hasText: 'Identity Verification' })
            .nth(1)
            .filter({ hasText: 'Complete' })).toBeVisible();
        await expect(page.locator('div').filter({ hasText: 'Applicants' })
            .nth(1)
            .filter({ hasText: 'Skipped' })).toBeVisible();
        await expect(page.locator('div').filter({ hasText: 'Employment Verification' })
            .nth(1)
            .filter({ hasText: 'Skipped' })).toBeVisible();

        // Verify Financial Verification error
        await expect(page.locator('strong:has-text("Missing Financial Transactions")')).toBeVisible({ timeout: 10000 });
    });
});
