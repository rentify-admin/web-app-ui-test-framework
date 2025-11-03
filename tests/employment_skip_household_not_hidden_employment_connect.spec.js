import { test, expect } from '@playwright/test';
import loginForm from '~/tests/utils/login-form';
import { app } from '~/tests/test_config';
import generateSessionForm from '~/tests/utils/generate-session-form';
import { findAndInviteApplication, gotoApplicationsPage } from '~/tests/utils/applications-page';
import { joinUrl } from '~/tests/utils/helper';
import { waitForJsonResponse } from '~/tests/utils/wait-response';
import { admin } from '~/tests/test_config';
import { handleOptionalStateModal } from '~/tests/utils/session-flow';
import { employmentVerificationWalmartPayStub } from '~/tests/utils/session-flow';

// Note: first_name will be auto-prefixed with 'AutoT - ' by the helper
// Note: email will be auto-suffixed with '+autotest' by the helper
const userData = {
    first_name: 'alexander',
    last_name: 'sample',
    email: 'ignacio.martinez+playwright1@verifast.com'
};
const applicationName = 'AutoTest Suite - EMP Connect';
const API_URL = app.urls.api;

test.describe('employment_skip_household_not_hidden_employment_connect', () => {
    test('Should skip household setup and connect to employment', {
      tag: ['@smoke', '@regression', '@needs-review', '@external-integration'],
    }, async ({ page, browser }) => {
        // Step 1: Admin login and navigate to applications
        await loginForm.adminLoginAndNavigate(page, admin);
        
        // Step 2: Navigate to Applications Page
        await gotoApplicationsPage(page);
        
        // Step 3: Find and invite application
        await findAndInviteApplication(page, applicationName);

        // Step 4: Fill applicant info and generate session
        await generateSessionForm.fill(page, userData);
        const sessionData = await generateSessionForm.submit(page);

        // Step 5: Copy invite link
        const linkSection = page.getByTestId('session-invite-link');
        await expect(linkSection).toBeVisible();
        const link = await linkSection.getAttribute('href');
        const sessionId = sessionData.data?.id;
        const sessionUrl = joinUrl(API_URL, `sessions/${sessionId}`);

        // Step 6: Open invite link in new context (simulate applicant)
        const context = await browser.newContext();
        const applicantPage = await context.newPage();
        await applicantPage.goto(link);
        await applicantPage.waitForTimeout(2000);

        // Optionally handle state modal if present
        await handleOptionalStateModal(applicantPage);

        // Step 7: Enter rent budget and submit
        await applicantPage.locator('input#rent_budget').fill('555');
        await Promise.all([
            applicantPage.waitForResponse(resp =>
                resp.url().includes(sessionUrl) &&
                resp.request().method() === 'PATCH' &&
                resp.ok()
            ),
            applicantPage.locator('button[type="submit"]').click()
        ]);


        // Step 8: Start Employment Verification (AtomicFI iframe)
        await expect(applicantPage.getByText('Employment Verification').nth(2)).toBeVisible({ timeout: 20000 });

        await applicantPage.getByTestId('document-pay_stub').click();
        await applicantPage.getByTestId('directly-connect-emp-btn').click();

        // Wait for iframe to appear and complete employment verification flow
        const atomicFrame = applicantPage.frameLocator('#atomic-transact-iframe');
        await employmentVerificationWalmartPayStub(atomicFrame);

        await expect(applicantPage.locator('h3', { hasText: 'Summary' })).toBeVisible({ timeout: 60_000 });
        // Clean up
        await applicantPage.close();
    }); 
});