import { test, expect } from '@playwright/test';
import loginForm from '~/tests/utils/login-form';
import { admin } from '~/tests/test_config';
import generateSessionForm from '~/tests/utils/generate-session-form';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import config from '~/tests/test_config';
import { joinUrl } from '~/tests/utils/helper.js';
import { waitForJsonResponse } from '~/tests/utils/wait-response';
import { gotoApplicationsPage, searchApplication } from '~/tests/utils/applications-page';

const API_URL = config.app.urls.api;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const userData = {
    first_name: 'FinMX',
    last_name: 'Test',
    email: 'finmx_test@verifast.com'
};

test.beforeEach(async ({ page }) => {
    await page.goto("/");
});

test.describe('financial_mx_2_attempts_success_and_failed_password', () => {
    test('Financial - mx - 2 attempts - success and failed password', {
      tag: ['@regression', '@needs-review'],
      timeout: 180000  // 3 minutes 
    }, async ({ page, browser }) => {
        // Step 1: Admin Login and Navigate
        await loginForm.fill(page, admin);
        await loginForm.submit(page);
        await expect(page).toHaveTitle(/Applicants/, { timeout: 10_000 });

        await gotoApplicationsPage(page);

        // Step 2: Locate Target Application
        const applicationName = 'AutoTest Suite - Fin only'
        await searchApplication(page, applicationName);

        const appNameCol = page.getByTestId('application-table-name-col').filter({
          hasText: applicationName,
        }).first();

        await expect(appNameCol).toHaveText(applicationName);

        const appRow =  await appNameCol.locator('xpath=..')
          .getByTestId('application-table-invite-col')
          .locator('a')

        await appRow.click();

        // Step 3: Generate Session
        await generateSessionForm.fill(page, userData);
        const sessionData = await generateSessionForm.submit(page);

        const linkSection = page.getByTestId('session-invite-link');
        await expect(linkSection).toBeVisible();

        const link = await linkSection.getAttribute('href');
        const sessionId = sessionData.data?.id;
        const sessionUrl = joinUrl(API_URL, `sessions/${sessionId}`);

        // await page.close();

        // Step 4: Applicant View — New Context
        const context = await browser.newContext();
        const applicantPage = await context.newPage();
        await applicantPage.goto(link);

        await applicantPage.locator('input#rent_budget').fill('500');
        await applicantPage.locator('button[type="submit"]').click();

        await applicantPage.waitForResponse(sessionUrl);
        await applicantPage.waitForTimeout(1000);

        // Step 5: Start Financial Verification
        const [financialResponse] = await Promise.all([
          applicantPage.waitForResponse(resp =>
            resp.url().includes('/financial-verifications') &&
            resp.request().method() === 'POST' &&
            resp.ok()
          ),
          applicantPage.getByTestId('connect-bank').click()
        ]);

        const financialData = await waitForJsonResponse(financialResponse);
        expect(financialData).toBeDefined();

        // Step 6: Interact with MX iframe for bank connection
        const mxFrame = applicantPage.frameLocator('iframe[src*="int-widgets.moneydesktop.com"]');
        await expect(mxFrame.locator('[data-test="search-header"]')).toBeVisible({ timeout: 30000 });

        await mxFrame.locator('[data-test="search-input"]').fill('mx bank oau');
        await mxFrame.locator('[data-test="MX-Bank-(OAuth)-row"]').click();
        const [newPage] = await Promise.all([
          context.waitForEvent('page'),
          mxFrame.locator('[data-test="continue-button"]').click(),
        ]);

        await newPage.waitForLoadState('domcontentloaded');
        await newPage.waitForTimeout(3000); // Wait 3 seconds to ensure full load
        await newPage.locator('input[type="submit"][value="Authorize"]').waitFor({ state: 'visible' });
        await newPage.locator('input[type="submit"][value="Authorize"]').click();

        await newPage.waitForEvent('close');

        await mxFrame.locator('[data-test="done-button"]').waitFor({ state: 'visible', timeout: 150_000 });
        await mxFrame.locator('[data-test="done-button"]').click();

        await applicantPage.waitForTimeout(2000);
        await mxFrame.locator('[data-test="search-input"]').fill('mx bank');
        await mxFrame.locator('[data-test="MX-Bank-row"]').click();
        await mxFrame.locator('#LOGIN').fill('fail_user');
        await mxFrame.locator('#PASSWORD').fill('fail_password');
        await mxFrame.locator('[data-test="credentials-continue"]').click();

        await mxFrame.locator('[data-test="credentials-error-message-box"]').waitFor({ state: 'visible', timeout: 150_000 });
        // Click the close icon after error message
        await applicantPage.getByTestId('connnect-modal-cancel').click();
        await applicantPage.locator('[data-testid="financial-verification-continue-btn"]').click();

        // Final assertion (example: check for summary or error message)
        await expect(applicantPage.locator('h3', { hasText: 'Summary' })).toBeVisible({ timeout: 110_000 });

    });
});
