import { test, expect } from '@playwright/test';
import { findAndInviteApplication, gotoApplicationsPage, searchApplication } from '~/tests/utils/applications-page';
import { joinUrl } from '~/tests/utils/helper';
import { admin, app } from '~/tests/test_config';
import generateSessionForm from '~/tests/utils/generate-session-form';
import loginForm from '~/tests/utils/login-form';
import { waitForJsonResponse } from '~/tests/utils/wait-response';
import { gotoPage } from '~/tests/utils/common';
import {
    completePaystubConnection,
    completePlaidFinancialStepBetterment,
    fillhouseholdForm,
    handleOptionalStateModal,
    selectApplicantType,
    updateStateModal,
    waitForPlaidConnectionCompletion,
    waitForPaystubConnectionCompletion
} from '~/tests/utils/session-flow';
import { findSessionLocator, markFlagAsNonIssue, searchSessionWithText } from '~/tests/utils/report-page';


const applicationName = 'AutoTest Suite - Full Test';

const user = {
    first_name: 'Playwright',
    last_name: 'User',
    email: 'playwright+effect@verifast.com'
};
const coapplicant = {
    first_name: 'Playwright',
    last_name: 'CoApp',
    email: 'playwright+coapp@verifast.com'
};

const updateRentBudget = async (applicantPage, sessionId) => {
    await applicantPage.locator('input#rent_budget').fill('2200');

    await Promise.all([
        applicantPage.waitForResponse(resp => resp.url() === joinUrl(app.urls.api, `sessions/${sessionId}`)
            && resp.request().method() === 'PATCH'
            && resp.ok()),
        applicantPage.locator('button[type="submit"]').click()
    ]);
};

test.describe('co_app_household_with_flag_errors', () => {
    test.skip('Should complete applicant flow with co-applicant household with flag errors', {
        tag: ['@regression'],
    }, async ({ page, browser }) => {
        test.setTimeout(380000); // Full timeout needed for complex test flow

        // Step 1: Admin Login and Navigate to Applications
        await loginForm.adminLoginAndNavigate(page, admin);

        await gotoApplicationsPage(page);
        // Step 2: Find and Invite Application
        await findAndInviteApplication(page, applicationName);

        // Step 3: Generate Session and Extract Link
        const { sessionId, sessionUrl, link } = await generateSessionForm.generateSessionAndExtractLink(page, user);

        const linkUrl = new URL(link);

        // Step 4: Open Invite link
        const context = await browser.newContext();

        const applicantPage = await context.newPage();
        await applicantPage.goto(joinUrl(`${app.urls.app}`, `${linkUrl.pathname}${linkUrl.search}`));

        // Step 5: Select Applicant Type on Page
        await selectApplicantType(applicantPage, sessionUrl);

        // Step 6: Select state in the state modal
        await handleOptionalStateModal(applicantPage);

        // Step 7: Complete rent budget step
        await updateRentBudget(applicantPage, sessionId);

        // Step 8: Check coapplicant assignable
        await expect(applicantPage.getByTestId('applicant-invite-step')).toBeVisible();

        const applicant = await fillhouseholdForm(applicantPage, coapplicant);

        await applicantPage.waitForTimeout(800); // Balanced: not too short, not too long

        await applicantPage.locator('[data-testid="applicant-invite-continue-btn"]:visible').click({ timeout: 18_000 }); // Balanced timeout

        await applicantPage.waitForTimeout(800); // Balanced: not too short, not too long

        await applicantPage.getByTestId('skip-id-verification-btn').click({ timeout: 20_000 });

        await applicantPage.waitForTimeout(1000);

        await completePlaidFinancialStepBetterment(applicantPage, 'custom_gig', 'test');

        await waitForPlaidConnectionCompletion(applicantPage);

        await completePaystubConnection(applicantPage);

        await waitForPaystubConnectionCompletion(applicantPage);

        await Promise.all([
            applicantPage.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}/steps/`)
                && resp.ok()
                && resp.request().method() === 'PATCH'),
            applicantPage.getByTestId('employment-step-continue').click()
        ]);

        await applicantPage.close();

        await gotoPage(page, 'applicants-menu', 'applicants-submenu', '/sessions?fields[session]');

        await page.waitForTimeout(800); // Balanced: not too short, not too long

        await searchSessionWithText(page, sessionId);

        const sessionLocator = await findSessionLocator(page, `.application-card[data-session="${sessionId}"]`);

        const [sessionResponse] = await Promise.all([
            page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}?fields[session]`)
                && resp.ok()
                && resp.request().method() === 'GET'),
            sessionLocator.click()
        ]);

        const session = await waitForJsonResponse(sessionResponse);

        await expect(session.data.children.length).toBeGreaterThan(0);

        await expect(session.data.children.filter(item => item.role === 'APPLICANT').length).toBeGreaterThan(0);

        if (session.data?.approval_status === 'REJECTED') {
            await page.getByTestId('view-details-btn').click({ timeout: 10_000 });
            await expect(page.getByTestId('GROSS_INCOME_RATIO_EXCEEDED')).toBeVisible();
            await markFlagAsNonIssue(
                page,
                sessionId,
                'GROSS_INCOME_RATIO_EXCEEDED',
                'this flag is marked as non issue by playwright test run'
            );
            await page.getByTestId('close-event-history-modal').click({ timeout: 10_000 });
            await page.waitForTimeout(500);
        }

        await page.getByTestId('session-action-btn').click({ timeout: 10_000 });

        await page.getByTestId('invite-applicant').click({ timeout: 10_000 });

        await page.getByTestId(`reinvite-${session.data?.children[0]?.applicant?.id}`).click({ timeout: 10_000 });

        await page.waitForTimeout(600); // Balanced: not too short, not too long

        await page.getByTestId(`copy-invite-link-${session.data?.children[0]?.applicant?.id}`).click({ timeout: 12_000 }); // Balanced timeout

        await page.getByTestId('invite-modal-cancel').click();

        // Get copied link with error handling and fallback
        let copiedLink;
        try {
            copiedLink = await page.evaluate(async () => {
                try {
                    return await navigator.clipboard.readText();
                } catch (error) {
                    console.log('Clipboard read failed:', error.message);
                    return null;
                }
            });
            
            if (!copiedLink) {
                throw new Error('Clipboard read returned null or empty');
            }
            
            console.log('✅ Link copied successfully from clipboard');
        } catch (error) {
            console.log('⚠️ Clipboard operation failed, trying alternative method');
            
            // Fallback: try to get the link from the page directly
            try {
                const linkElement = page.locator('[data-testid="invite-link-input"] input, [data-testid="invite-link-input"] textarea');
                copiedLink = await linkElement.inputValue();
                console.log('✅ Link retrieved from input field as fallback');
            } catch (fallbackError) {
                console.log('❌ Both clipboard and fallback methods failed');
                throw new Error(`Failed to get invite link: ${error.message}`);
            }
        }

        const coAppLinkUrl = new URL(copiedLink);

        const newPageContext = await browser.newContext();

        const coAppPage = await newPageContext.newPage();

        const coAppSessionApiUrl = joinUrl(app.urls.api, coAppLinkUrl.pathname);

        const [coSessionResp] = await Promise.all([
            coAppPage.waitForResponse(resp => resp.url().includes(coAppSessionApiUrl)
                && resp.ok()
                && resp.request().method() === 'GET'),
            coAppPage.goto(joinUrl(app.urls.app, `${coAppLinkUrl.pathname}${coAppLinkUrl.search}`))
        ]);


        const coAppSession = await waitForJsonResponse(coSessionResp);

        // Step 5: Select Applicant Type on Page
        await selectApplicantType(coAppPage, coAppSessionApiUrl);

        // Step 6: Select state in the state modal
        await updateStateModal(coAppPage);

        await coAppPage.waitForTimeout(800); // Balanced: not too short, not too long

        await coAppPage.getByTestId('skip-id-verification-btn').click({ timeout: 18_000 }); // Balanced timeout

        await coAppPage.waitForTimeout(800); // Balanced: not too short, not too long

        await completePlaidFinancialStepBetterment(coAppPage, 'custom_noincome', 'password');

        await waitForPlaidConnectionCompletion(coAppPage);

        await completePaystubConnection(coAppPage);

        await waitForPaystubConnectionCompletion(coAppPage);

        await Promise.all([
            coAppPage.waitForResponse(resp => resp.url().includes(`/sessions/${coAppSession.data.id}/steps/`)
                && resp.ok()
                && resp.request().method() === 'PATCH'),
            coAppPage.getByTestId('employment-step-continue').click()
        ]);

        await coAppPage.close();

        // Reload the page and wait for it to load
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Search for the session after reload
        await searchSessionWithText(page, sessionId);

        // Wait for the session data to load after search
        const [sessionResponse1] = await Promise.all([
            page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}?fields[session]`)
                && resp.ok()
                && resp.request().method() === 'GET'),
            page.locator('.application-card').first().click()
        ]);

        const newSession = await waitForJsonResponse(sessionResponse1);
        await expect(newSession.data?.approval_status).toBe('AWAITING_REVIEW');
    });
});
