import { default as test, expect } from "@playwright/test";
import { admin, app } from "./test_config";
import { default as loginForm } from "./utils/login-form";
import { gotoApplicationsPage, findAndInviteApplication } from "./utils/applications-page";
import generateSessionForm from "./utils/generate-session-form";
import { joinUrl } from "./utils/helper";
import { navigateToSessionById, searchSessionWithText } from "./utils/report-page";
import { highBalanceBankStatementData } from "./mock-data/high-balance-financial-payload";



const appName = 'AutoTest - Simulation financial employment';

const userData = {
    first_name: 'alexander',
    last_name: 'sample',
    email: 'ignacio.martinez+playwright1@verifast.com'
};
const API_URL = app.urls.api;

test.describe('check_ui_not_show_na_for-high_balance.spec', () => {


    test('Should check UI not shows N/A for high balance accounts', {
        tag: ['@core', '@regression'],
    }, async ({ page }) => {

        await loginForm.adminLoginAndNavigate(page, admin);

        // Step 2: Navigate to Applications Page
        await gotoApplicationsPage(page);

        // Step 3: Find and invite application
        await findAndInviteApplication(page, appName);

        // Step 4: Fill applicant info and generate session
        await generateSessionForm.fill(page, userData);
        const sessionData = await generateSessionForm.submit(page);

        // Step 5: Copy invite link
        const linkSection = page.getByTestId('session-invite-link');
        await expect(linkSection).toBeVisible();
        const link = await linkSection.getAttribute('href');
        const sessionId = sessionData.data?.id;
        const sessionUrl = joinUrl(API_URL, `sessions/${sessionId}`);

        // Close modal
        await page.getByTestId('generate-session-modal-cancel').click();

        // Step 6: Open invite link in new context (simulate applicant)
        const context = await page.context().browser().newContext();
        const applicantPage = await context.newPage();
        await applicantPage.goto(link);
        await applicantPage.waitForTimeout(2000);

        // Step 7: complet rent budget step.
        await applicantPage.locator('input#rent_budget').fill('555');
        await Promise.all([
            applicantPage.waitForResponse(resp =>
                resp.url().includes(sessionUrl) &&
                resp.request().method() === 'PATCH' &&
                resp.ok()
            ),
            applicantPage.locator('button[type="submit"]').click()
        ]);

        // Step 8: Connect bank and submit financial verification
        const responsePromise = applicantPage.waitForResponse(response =>
            response.url().includes('/financial-verifications')
            && response.request().method() === 'POST'
            && response.ok()
        );

        applicantPage.on('dialog', async dialog => {
            await dialog.accept(JSON.stringify(highBalanceBankStatementData(userData)));
        });

        await applicantPage.getByTestId('financial-upload-statement-btn').click();
        await applicantPage.getByTestId('connect-bank').click();

        const response = await responsePromise;

        await applicantPage.waitForTimeout(2000);

        await applicantPage.getByTestId('financial-verification-continue-btn').click();

        // Step 9: Skip employment verification
        await expect(applicantPage.getByTestId('employment-verification-step')).toBeVisible();

        await applicantPage.getByTestId('employment-step-skip-btn').click();

        await applicantPage.close();

        // Step 10: Back to admin view and navigate to applicant's financial section
        await page.bringToFront();

        // Navigate to applicants
        await page.getByTestId('applicants-menu').click();
        await page.getByTestId('applicants-submenu').click();

        await searchSessionWithText(page, sessionId);
        await navigateToSessionById(page, sessionId);
        await page.waitForTimeout(3000);

        await page.getByTestId('financial-section-header').click();

        // Step 11: Verify that balances do not show N/A
        const balanceCol = await page.locator('[data-testid*="-balance-col"]').filter({visible: true});
        const balance = await balanceCol.textContent()
        expect(balance.toLowerCase()).not.toContain('n/a');

        await page.getByTestId('financial-section-transactions-radio').click();

        const balanceCols = await page.getByTestId('financial-section-transactios-list-balance-col');

        for (let i = 0; i < await balanceCols.count(); i++) {
            const balanceText = await balanceCols.nth(i).textContent();
            expect(balanceText.toLowerCase()).not.toContain('n/a');
        }

    });
});