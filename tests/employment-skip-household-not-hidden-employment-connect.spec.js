import { test, expect } from '@playwright/test';
import loginForm from '~/tests/utils/login-form';
import { app } from '~/tests/test_config';
import generateSessionForm from '~/tests/utils/generate-session-form';
import { findAndInviteApplication } from '~/tests/utils/applications-page';
import { joinUrl } from '~/tests/utils/helper';
import { waitForJsonResponse } from '~/tests/utils/wait-response';
import { admin } from '~/tests/test_config';
import { handleOptionalStateModal } from '~/tests/utils/session-flow';
import { employmentVerificationWalmartPayStub } from '~/tests/utils/session-flow';

const userData = {
    first_name: 'alexander',
    last_name: 'sample',
    email: 'ignacio.martinez+playwright1@verifast.com'
};
const applicationName = 'AutoTest Suite - EMP Connect';
const API_URL = app.urls.api;

test('C38 - Employment - skip household not hidden employment connect', {
  tag: ['@smoke', '@regression', '@document-upload'],
}, async ({ page, browser }) => {
    // Step 1: Admin login and navigate to applications
    await loginForm.adminLoginAndNavigate(page, admin);
    // Step 2: Find and invite application
    await findAndInviteApplication(page, applicationName);

    // Step 3: Fill applicant info and generate session
    await generateSessionForm.fill(page, userData);
    const sessionData = await generateSessionForm.submit(page);

    // Step 4: Copy invite link
    const linkSection = page.getByTestId('session-invite-link');
    await expect(linkSection).toBeVisible();
    const link = await linkSection.getAttribute('href');
    const sessionId = sessionData.data?.id;
    const sessionUrl = joinUrl(API_URL, `sessions/${sessionId}`);

    // Step 5: Open invite link in new context (simulate applicant)
    const context = await browser.newContext();
    const applicantPage = await context.newPage();
    await applicantPage.goto(link);
    await applicantPage.waitForTimeout(2000);

    // Optionally handle state modal if present
    await handleOptionalStateModal(applicantPage);

    // Step 6: Enter rent budget and submit
    await applicantPage.locator('input#rent_budget').fill('555');
    await Promise.all([
        applicantPage.waitForResponse(resp =>
            resp.url().includes(sessionUrl) &&
            resp.request().method() === 'PATCH' &&
            resp.ok()
        ),
        applicantPage.locator('button[type="submit"]').click()
    ]);
    

    // Step 7: Start Employment Verification (AtomicFI iframe)
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