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
    let sessionId;
    let adminToken;

    test.afterEach(async ({ page }, testInfo) => {
        // Conditional cleanup: Only delete session if test PASSED
        if (testInfo.status === 'passed' && sessionId && adminToken) {
            console.log(`🧹 Test passed - cleaning up session ${sessionId}...`);
            try {
                await page.request.delete(joinUrl(API_URL, `sessions/${sessionId}`), {
                    headers: { 'Authorization': `Bearer ${adminToken}` }
                });
                console.log(`✅ Session ${sessionId} deleted`);
            } catch (error) {
                console.log(`⚠️ Cleanup failed: ${error.message}`);
            }
        } else if (testInfo.status !== 'passed' && sessionId) {
            console.log(`⚠️ Test failed - preserving session ${sessionId} for debugging`);
        }
    });

    test('Should check UI not shows N/A for high balance accounts', {
        tag: ['@core', '@regression'],
    }, async ({ page }, testInfo) => {

        adminToken = await loginForm.adminLoginAndNavigate(page, admin);

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
        sessionId = sessionData.data?.id; // Store in describe scope for cleanup
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

        // Step 12: Verify Cash Flow report shows value (not N/A) with polling
        console.log('Step 12: Verifying Cash Flow report...');
        const cashFlowCard = page.getByTestId('report-cashflow-card');
        await expect(cashFlowCard).toBeVisible();
        
        // Poll for Cash Flow value (max 5 seconds, 500ms between checks)
        let cashFlowValue = null;
        const maxAttempts = 10;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const cashFlowText = await cashFlowCard.textContent();
            const valueMatch = cashFlowText.match(/\$\s*([\d,]+\.\d{2})/);
            
            if (valueMatch && valueMatch[1] && !cashFlowText.toLowerCase().includes('n/a')) {
                cashFlowValue = valueMatch[1];
                console.log(`✅ Cash Flow value: $${cashFlowValue}`);
                break;
            }
            
            console.log(`⏳ Waiting for Cash Flow value (attempt ${attempt + 1}/${maxAttempts})...`);
            await page.waitForTimeout(500);
        }
        
        expect(cashFlowValue).toBeTruthy();

        // Step 13: Verify Monthly Gross Income card matches backend API
        console.log('Step 13: Verifying Monthly Gross Income matches backend...');
        
        // Get backend income from API
        const apiResponse = await page.request.get(joinUrl(API_URL, `sessions/${sessionId}`), {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const sessionApiData = await apiResponse.json();
        const apiIncome = sessionApiData.data?.state?.summary?.income || 0;
        const apiIncomeFormatted = (apiIncome / 100).toFixed(2);
        
        console.log(`📊 Backend income (API): $${apiIncomeFormatted}`);
        
        // Poll for Monthly Gross Income card value (max 5 seconds)
        const monthlyIncomeCard = page.getByTestId('report-monthly-income-card');
        await expect(monthlyIncomeCard).toBeVisible();
        
        let monthlyIncomeValue = null;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const incomeText = await monthlyIncomeCard.textContent();
            const valueMatch = incomeText.match(/\$\s*([\d,]+\.\d{2})/);
            
            if (valueMatch && valueMatch[1] && !incomeText.toLowerCase().includes('n/a')) {
                monthlyIncomeValue = valueMatch[1].replace(/,/g, '');
                console.log(`✅ Monthly Gross Income value: $${valueMatch[1]}`);
                break;
            }
            
            console.log(`⏳ Waiting for Monthly Gross Income value (attempt ${attempt + 1}/${maxAttempts})...`);
            await page.waitForTimeout(500);
        }
        
        expect(monthlyIncomeValue).toBeTruthy();
        expect(monthlyIncomeValue).toBe(apiIncomeFormatted);
        console.log(`✅ Monthly Gross Income matches backend payload: $${apiIncomeFormatted}`);

    });
});