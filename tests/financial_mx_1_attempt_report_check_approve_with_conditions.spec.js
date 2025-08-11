import { test, expect } from '@playwright/test';
import loginForm from '~/tests/utils/login-form';
import { admin } from '~/tests/test_config';
import generateSessionForm from '~/tests/utils/generate-session-form';
import { joinUrl } from '~/tests/utils/helper.js';
import config from '~/tests/test_config';
import { handleOptionalStateModal } from './utils/session-flow';
import { waitForJsonResponse } from '~/tests/utils/wait-response';
import { gotoApplicationsPage, searchApplication } from '~/tests/utils/applications-page';

const API_URL = config.app.urls.api;
const APP_URL = config.app.urls.app;
const userData = {
    first_name: 'alexander',
    last_name: 'sample',
    email: 'ignacio.martinez+playwright@verifast.com'
};
const applicationName = 'AutoTest Suite - Fin only';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

test.setTimeout(180_000); 

describe('financial_mx_1_attempt_report_check_approve_with_conditions', () => {
    test('Should complete MX OAuth financial verification and test approval workflow with conditions', {
      tag: ['@core', '@smoke', '@regression', '@document-upload'],
    }, async ({ page, browser }) => {
        // Step 1: Admin Login and Navigate
        await loginForm.fill(page, admin);
        await loginForm.submit(page);
        await expect(page).toHaveTitle(/Applicants/, { timeout: 10_000 });

        await gotoApplicationsPage(page);

        // Step 2: Locate Target Application
        await searchApplication(page, applicationName);
        await expect(page.locator('table > tbody > tr > td:nth-child(2)'))
            .toHaveText(applicationName);
        await page.locator('table > tbody > tr > td:nth-child(7) a').click();

        // Step 3: Generate Session
        await generateSessionForm.fill(page, userData);
        const sessionData = await generateSessionForm.submit(page);

        const linkSection = page.getByTestId('session-invite-link');
        await expect(linkSection).toBeVisible();

        const link = await linkSection.getAttribute('href');
        const sessionId = sessionData.data?.id;
        const sessionUrl = joinUrl(API_URL, `sessions/${sessionId}`);

        // Step 4: Applicant View — New Context
        const context = await browser.newContext();
        const applicantPage = await context.newPage();
        await applicantPage.goto(link);

        // Step 5: Handle optional modal interactions and state selection
        await handleOptionalStateModal(applicantPage);

        // Step 6: Set rent budget and proceed
        const applicantRentBudgetInput = applicantPage.locator('input#rent_budget');
        await applicantRentBudgetInput.fill('555');

        await applicantPage.waitForFunction(() => {
          const btn = document.querySelector('button[type="submit"]');
          return btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true';
        }, null, { timeout: 10000 });

        const applicantContinueBtn = applicantPage.getByRole('button', { name: 'Continue' });
        await applicantContinueBtn.click();

        await applicantPage.waitForResponse(sessionUrl);

        // Step 7: Start Financial Verification (MX OAuth)
        await applicantPage.waitForFunction(() => {
          const btn = document.querySelector('[data-testid="connect-bank"]');
          return btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true';
        }, null, { timeout: 10000 });

        await applicantPage.getByTestId('connect-bank').click();

        // Use the reusable utility for the MX Connect Bank OAuth flow
        const { connectBankOAuthFlow } = await import('./utils/session-flow');
        await connectBankOAuthFlow(applicantPage, context, { bankName: 'mx bank oau' });

        //wait until connect
        const maxAttempts = 30; // 30 attempts
        const pollingInterval = 2000; // 2 seconds between attempts
        let attempt = 0;
        let found = false;

        while (!found && attempt < maxAttempts) {
            try {
                const connectionRow = applicantPage.locator('[data-testid="connection-row"]:has-text("Completed")');
                await expect(connectionRow).toBeVisible({ timeout: 1000 });
                found = true;
                console.log(`✅ Connection completed on attempt ${attempt + 1}`);
            } catch (error) {
                attempt++;
                console.log(`⏳ Attempt ${attempt}/${maxAttempts}: Connection not completed yet...`);
                if (attempt < maxAttempts) {
                    await applicantPage.waitForTimeout(pollingInterval);
                }
            }
        }

        if (!found) {
            throw new Error(`Connection did not complete after ${maxAttempts} attempts (${maxAttempts * pollingInterval / 1000} seconds)`);
        }

        // Click financial verification continue button
        const financialVerificationContinueBtn = applicantPage.getByTestId('financial-verification-continue-btn');
        if (await financialVerificationContinueBtn.isVisible()) {
            await financialVerificationContinueBtn.click();
            await applicantPage.waitForTimeout(2000); 
        }

        // Step 8: Close the applicant session page and continue on the admin page
        console.log('Closing applicant session page and continuing on the admin page');
        await applicantPage.close();
        const sessionUrlAdmin = `${APP_URL}/Applicants/all/${sessionId}`;
        await page.goto(sessionUrlAdmin);
        await page.bringToFront();

        // Step 8: Assert report status
        const adminPage = page;
        const householdStatusAlert = adminPage.getByTestId('household-status-alert');
        await expect(householdStatusAlert).toBeVisible();

        // Step 9: Add income source
        console.log('Clicking income source');
        await adminPage.getByTestId('income-source-section-header').click();
        await adminPage.getByTestId('income-source-add').click();
        const incomeTypeSelect = adminPage.locator('#income_type');
        await incomeTypeSelect.click();
        await incomeTypeSelect.selectOption('OTHER');

        // Uncheck the 'Calculate average from transactions' if checked
        console.log('Unchecking calculate average from transactions');
        const calculateAverageFromTransactionsCheckbox = adminPage.locator('label.items-center > input[type="checkbox"].form-checkbox');
        if (await calculateAverageFromTransactionsCheckbox.isChecked()) {
            await calculateAverageFromTransactionsCheckbox.click();
        }

        // Fill in the net amount & save
        console.log('Filling in the net amount and Saving');
        const netAmountInput = adminPage.locator('#net_amount');
        await netAmountInput.click();
        await netAmountInput.fill('1000');

        console.log('Getting income source id from Income-source API');
        const incomeSourceUrl = joinUrl(API_URL, 'sessions', sessionId, 'income-sources');
        const [ incomeSourceResponse ] = await Promise.all([
            adminPage.waitForResponse(resp => resp.url().includes(incomeSourceUrl)
                                && resp.request().method() === 'POST'
                                && resp.ok()),
            adminPage.locator('button[type="submit"].btn.btn-sm.btn-primary.rounded-full:has-text("Save")').click()
        ]);
        const { data: incomeSources } = await waitForJsonResponse(incomeSourceResponse);
        const incomeSourceId = incomeSources.id;

        console.log('Waiting for income sources sync');
        await Promise.all([
            adminPage.waitForResponse(resp => resp.url().includes(incomeSourceUrl)
                                && resp.request().method() === 'GET'
                                && resp.ok(), { timeout: 3000 })
        ]);

        // Assert income source present
        const incomeSource = adminPage.getByTestId(`income-source-${incomeSourceId}`);
        await expect(incomeSource).toBeVisible();

        // Step 10: Assert approval status
        await adminPage.reload();
        // Re-acquire the locator after reload
        const householdStatusAlertUpdated = adminPage.getByTestId('household-status-alert');
        await expect(householdStatusAlertUpdated).toBeVisible();

        // Wait up to 30 seconds for the status to update
        await expect(householdStatusAlertUpdated).toContainText('Meets Criteria', { timeout: 30000 });

        // Step 11: Approve with conditions:
        // 1. Edit rent budget
        const editRentIcon = adminPage.getByTestId('rent-budget-edit-btn');
        await expect(editRentIcon).toBeVisible();
        await editRentIcon.click();
        const adminRentBudgetInput = adminPage.locator('#rent-budget-input');
        await adminRentBudgetInput.fill('755');
        const submitRentBudgetBtn = adminPage.getByTestId('submit-rent-budget');
        await submitRentBudgetBtn.click();
        // 2. Reload and assert status
        await adminPage.waitForTimeout(1000);
        await adminPage.reload();
        await expect(householdStatusAlertUpdated).toContainText('Conditional Meets Criteria', { timeout: 30000 });

        // Step 12: Decline
        // 1. Edit rent budget
        await expect(editRentIcon).toBeVisible();
        await editRentIcon.click();
        await adminRentBudgetInput.fill('1755');
        await submitRentBudgetBtn.click();
        // 2. Reload and assert status
        await adminPage.waitForTimeout(1000);
        await adminPage.reload();
        await expect(householdStatusAlertUpdated).toContainText('Criteria Not Met', { timeout: 30000 });
    });
});
