import { test, expect } from '@playwright/test';
import loginForm from '~/tests/utils/login-form';
import { admin } from '~/tests/test_config';
import generateSessionForm from '~/tests/utils/generate-session-form';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import config from '~/tests/test_config';
import { joinUrl } from '~/tests/utils/helper.js';
import { gotoApplicationsPage, searchApplication } from '~/tests/utils/applications-page';
import { handleOptionalStateModal } from '~/tests/utils/session-flow';

const API_URL = config.app.urls.api;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

test.describe('application_flow_with_id_only', () => {
    test('ID only - 1 attempt - success', {
      tag: ['@core', '@smoke', '@regression', '@external-integration'],
    }, async ({ page, browser }) => {

        // Step 1: Admin Login and Navigate
        await loginForm.fill(page, admin);
        await loginForm.submitAndSetLocale(page);
        await expect(page.getByTestId('household-status-alert')).toBeVisible();
        await expect(page).toHaveTitle(/Applicants/, { timeout: 10_000 });

        await gotoApplicationsPage(page);

        // Step 2: Locate Target Application
        await searchApplication(page, 'AutoTest Suite - ID Only');

        await expect(
            page.locator('table > tbody > tr > td:nth-child(2)')
        ).toHaveText(/AutoTest Suite - ID Only/);

        await page.locator('table > tbody > tr > td:nth-child(7) a').click();

        // Step 3: Generate Session
        await generateSessionForm.fill(page);
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

        // Handle state modal if it appears (needed for new emails)
        await handleOptionalStateModal(applicantPage);

        // Step 4.1: Complete Initial Application Form
        await applicantPage.locator('input#rent_budget').fill('500');
        await applicantPage.locator('button[type="submit"]').click();

        await applicantPage.waitForResponse(sessionUrl);
        await applicantPage.waitForTimeout(1000);

        // Step 5: Start ID Verification
        await applicantPage
            .locator('button', { hasText: 'Start Id Verification' })
            .click();
        await applicantPage.waitForResponse(
            joinUrl(API_URL, 'identity-verifications')
        );

        const personaIFrame = applicantPage.frameLocator(
            'iframe[src*="withpersona.com"]'
        );
        await applicantPage.waitForTimeout(3000);

        await personaIFrame.locator('[data-test="button__basic"]').click();
        await personaIFrame.locator('[data-test="button__primary"]:not(disabled)', { hasText: 'Begin Verifying' }).click();
        await applicantPage.waitForTimeout(1000);

        // Step 6: Select Document Type and Upload
        await personaIFrame.locator('[data-test="button__primary"]:not(disabled)', { hasText: 'Select' }).click();
        await applicantPage.waitForTimeout(1000);

        await personaIFrame.locator('#select__option--pp').click();
        const uploadInput = personaIFrame.locator('input[data-test="file-upload"]');
        const filePath = join(__dirname, 'test_files', 'passport.jpg');
        await uploadInput.setInputFiles(filePath);

        await personaIFrame.locator('#government_id__use-image').click();
        await applicantPage.waitForTimeout(3000);

        await personaIFrame.locator('[data-test="button__primary"]').click();

        await expect(applicantPage.locator('h3', { hasText: 'Summary' })).toBeVisible({ timeout: 110_000 });
    });
});
