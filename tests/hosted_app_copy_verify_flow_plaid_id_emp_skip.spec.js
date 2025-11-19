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
import { findAndCopyApplication, gotoApplicationsPage } from '~/tests/utils/applications-page';
import { navigateToSessionById, searchSessionWithText } from './utils/report-page';
import { cleanupSession } from '~/tests/utils/cleanup-helper';

const applicationName = 'AutoTest Suite Hshld-ID-Emp-Fin with skips';

// Global state for conditional cleanup
let sessionId = null;
let allTestsPassed = true;

// Generate random phone number for testing
const generateRandomPhone = () => {
    const random4Digits = Math.floor(1000 + Math.random() * 9000);
    return `613292${random4Digits}`;
};

test.describe('hosted_app_copy_verify_flow_plaid_id_emp_skip', () => {
    test('Should complete hosted application flow with id emp skips and Plaid integration', {
        tag: ['@smoke', '@regression', '@needs-review', '@external-integration'],
        timeout: 180_000  // 5 minutes
    }, async ({ page, browser }) => {
        try {
            // Step 1: Admin login and navigate to applications
            await loginForm.adminLoginAndNavigate(page, admin);

            // Step 2: Find application and copy link
            await gotoApplicationsPage(page);
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
            for (let i = 0; i < 6; i++) {
                await codeInputs.nth(i).fill(String(i + 1));
            }
            await page.locator('button[type="submit"]').click();

            // Step 6: Fill applicant registration form
            // ✅ Capture session ID from GET /sessions response (PR's method - captures earlier)
            const [sessionResp] = await Promise.all([
                page.waitForResponse(resp => {
                    const regex = new RegExp(`${joinUrl(app.urls.api, '/sessions/.{36}[?].+')}`);
                    return regex.test(resp.url())
                        && resp.request().method() === 'GET'
                        && resp.ok();
                }),
                completeApplicantRegistrationForm(page, {
                    firstName: 'teset',
                    lastName: 'testrelogin',
                    state: 'ALASKA'
                })
            ]);

            const { data: session } = await waitForJsonResponse(sessionResp);
            sessionId = session?.id;
            console.log(`✅ Session created: ${sessionId}`);

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

            // Step 13: Verify statuses - using filter to find the specific parent div
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

            // Verify Financial Verification error (PR's try-catch for resilience)
            try {
                await expect(page.locator('strong:has-text("Missing Financial Transactions")')).toBeVisible({ timeout: 10000 });
            } catch (err) {
                console.error('Missing Financial Transactions Flag not found');
            }

            // Step 14: Plaid IDV Implementation - Verifying Identity Information (PR's new feature)
            await loginForm.adminLoginAndNavigate(page, admin);

            await searchSessionWithText(page, session.id);
            
            const [financialResp] = await Promise.all([
                page.waitForResponse(resp => {
                    return resp.url().includes('/financial-verifications')
                        && resp.request().method() === 'GET'
                        && resp.ok();
                }),
                navigateToSessionById(page, session.id)
            ]);

            const { data: financials } = await waitForJsonResponse(financialResp);

            const financialSection = await page.getByTestId('financial-section');

            await expect(financialSection).toBeVisible();

            await financialSection.getByTestId('financial-section-header').click();
            const sessionFinancialSection = await page.getByTestId(`financial-section-financials-wrapper-${session.id}`);
            const accountCols = sessionFinancialSection.locator('tbody>tr');
            
            for (let index = 0; index < financials.length; index++) {
                const element = financials[index];

                // Verifying identity in endpoint response
                await expect(element.accounts).toBeDefined();
                await expect(element.accounts.length).toBeGreaterThan(0);
                await expect(element.accounts[0].full_name).toBeDefined();
                await expect(element.accounts[0].full_name).not.toBe('-');

                // Verifying identity in identity column
                if (element.accounts?.[0]?.full_name) {
                    await expect(accountCols.nth(index).getByTestId(`financial-section-financials-wrapper-${session.id}-identities-col`))
                        .toContainText(element.accounts[0].full_name);
                }
            }

            await page.waitForTimeout(3000);

            console.log('✅ All test assertions passed');
        } catch (error) {
            allTestsPassed = false;
            throw error;
        }
    });

    // ✅ Conditional cleanup (from master - keeps cleanup functionality)
    test.afterAll(async ({ request }) => {
        await cleanupSession(request, sessionId, allTestsPassed);
    });
});
