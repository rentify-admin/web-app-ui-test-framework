import { test, expect } from '@playwright/test';
import loginForm from '~/tests/utils/login-form';
import { admin, app } from '~/tests/test_config';
import { findAndInviteApplication, gotoApplicationsPage } from '~/tests/utils/applications-page';
import generateSessionForm from '~/tests/utils/generate-session-form';
import { getCentsToDollarsSafe, joinUrl } from '~/tests/utils/helper';
import { completePaystubConnection, fillhouseholdForm, handleOptionalTermsCheckbox, selectApplicantType, updateRentBudget, updateStateModal, identityStep, waitForPlaidConnectionCompletion, completePlaidFinancialStepBetterment } from '~/tests/utils/session-flow';
import { gotoPage } from '~/tests/utils/common';
import { findSessionLocator, searchSessionWithText } from '~/tests/utils/report-page';
import { waitForJsonResponse } from '~/tests/utils/wait-response';

const applicationName = 'AutoTest Suite - Full Test';

// Note: first_name will be auto-prefixed with 'AutoT - ' by the helper
// Note: email will be auto-suffixed with '+autotest' by the helper
const user = {
    first_name: 'Playwright',
    last_name: 'Ratio',
    email: 'playwright+ratio@verifast.com'
};

// Note: Co-app first_name will also be auto-prefixed with 'AutoT - '
// Note: Co-app email will also be auto-suffixed with '+autotest'
const coapplicant = {
    first_name: 'Playwright',
    last_name: 'CoApp',
    email: 'playwright+coapp@verifast.com'
};


const applicantStep = async applicantPage => {
    await expect(applicantPage.getByTestId('applicant-invite-step')).toBeVisible();

    await fillhouseholdForm(applicantPage, coapplicant);

    await applicantPage.getByTestId('applicant-invite-continue-btn').filter({ visible: true }).click({ timeout: 20_000 });
};



const checkDollarText = async (rentBudget, rentLocator) => {
    if (rentBudget !== 0) {
        const rentBudgetText = getCentsToDollarsSafe(rentBudget);
        await expect(rentLocator).toContainText(String(rentBudgetText));
    } else {
        await expect(rentLocator).toContainText('N/A');
    }
};

test.describe('check_coapp_income_ratio_exceede_flag', () => {
    test('Should confirm co-applicant income is considered when generating/removing Gross Income Ratio Exceeded flag', { 
        tag: ['@smoke', '@external-integration', '@regression', '@staging-ready'],
    }, async ({ page, browser }) => {
        test.setTimeout(450000);
        
        // Step 1: Admin Login and Navigate to Applications
        await loginForm.adminLoginAndNavigate(page, admin);

        // Step 2: Navigate to Applications Page
        await gotoApplicationsPage(page);

        // Step 3: Find and Invite Application
        await findAndInviteApplication(page, applicationName);
        
        // Step 4: Generate Session and Extract Link
        const { sessionId, sessionUrl, link } = await generateSessionForm.generateSessionAndExtractLink(page, user);
        
        const linkUrl = new URL(link);
        
        // Step 5: Open Invite link
        const context = await browser.newContext({ 
            permissions: ['camera', 'microphone'],
            // Use the same camera setup as e2e-ui config
            launchOptions: {
                args: [
                    '--use-fake-ui-for-media-stream',
                    '--use-fake-device-for-media-stream'
                ]
            }
        });
        
        const applicantPage = await context.newPage();
        await applicantPage.goto(joinUrl(`${app.urls.app}`, `${linkUrl.pathname}${linkUrl.search}`));
		
		// Handle terms modal if present (before applicant type selection)
		await handleOptionalTermsCheckbox(applicantPage);
        
        let session;
        
        const responseSession = async response => {
            if (response.url().includes(`/sessions/${sessionId}?fields[session]`)
                    && response.ok()
                    && response.request().method() === 'GET') {
                session = await waitForJsonResponse(response);
                await page.waitForTimeout(1000);
            }
        }

        page.on('response', responseSession);
    
        // Step 6: Select Applicant Type on Page
        await selectApplicantType(applicantPage, sessionUrl, '#employed');
    
        await updateStateModal(applicantPage, 'ALABAMA');
    
        await updateRentBudget(applicantPage, sessionId, '1500');
    
        await applicantStep(applicantPage);
    
        await identityStep(applicantPage);
    
    
        // Complete Plaid Connection using robust utility
        await completePlaidFinancialStepBetterment(applicantPage);

        await waitForPlaidConnectionCompletion(applicantPage);
    
        // Complete Paystub Connection
        await completePaystubConnection(applicantPage);
    
        await Promise.all([
            applicantPage.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}/steps/`)
                && resp.ok()
                && resp.request().method() === 'PATCH'),
            applicantPage.getByTestId('employment-step-continue').click()
        ]);
    
        await applicantPage.close();
    
        await gotoPage(page, 'applicants-menu', 'applicants-submenu', '/sessions?fields[session]');
    
        await page.waitForTimeout(1000);
    
        await searchSessionWithText(page, sessionId);
    
        const sessionLocator =  await findSessionLocator(page, `.application-card[data-session="${sessionId}"]`);
    
        const [ sessionResponse ] = await Promise.all([
            page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}?fields[session]`)
                && resp.ok()
                && resp.request().method() === 'GET'),
            sessionLocator.click()
        ]);
    
        session = await waitForJsonResponse(sessionResponse);
    
    
        await expect(session.data.children.length).toBeGreaterThan(0);
    
        await expect(session.data.children.filter(item => item.role === 'APPLICANT').length).toBeGreaterThan(0);
    
        const rentLocator = page.getByTestId('rent-budget-edit-btn');
        let rentBudget = session.data?.target ?? 0;
        await checkDollarText(rentBudget, rentLocator);
    
        const monthlyIncomeLocator = await page.getByTestId('report-monthly-income-card');
        let monthlyIncome = session.data.state?.summary?.total_income;
        await checkDollarText(monthlyIncome, monthlyIncomeLocator);
        
        // Log initial values for debugging
        console.log('🚀 ~ Initial Rent Budget:', rentBudget);
        console.log('🚀 ~ Initial Monthly Income:', monthlyIncome);
    
        const rentRatioLocator = await page.getByTestId('report-rent-income-ratio-card');
        const rentBudgetRatio = session.data.state?.summary?.total_target_to_income_ratio;
        if (rentBudgetRatio) {
            await expect(rentRatioLocator).toContainText(String(rentBudgetRatio));
        }
        console.log('🚀 ~ Initial Rent/Income Ratio:', rentBudgetRatio);
        
        // Validate that initial ratio exceeds threshold (flag should be present)
        if (monthlyIncome > 0 && rentBudget > 0) {
            const calculatedRatio = Math.round((rentBudget / monthlyIncome) * 100);
            console.log('🚀 ~ Calculated Ratio:', calculatedRatio);
            await expect(calculatedRatio).toBeGreaterThan(30); // Assuming 30% threshold
        }
    
        await page.getByTestId('view-details-btn').click({ timeout: 10_000 });
    
        await expect(page.getByTestId('GROSS_INCOME_RATIO_EXCEEDED')).toBeVisible();
    
        await page.getByTestId('close-event-history-modal').click({ timeout: 10_000 });
    
        await page.waitForTimeout(400);
    
        await page.getByTestId('session-action-btn').click({ timeout: 10_000 });
    
        await page.getByTestId('invite-applicant').click({ timeout: 10_000 });
    
        await page.getByTestId(`reinvite-${session.data?.children[0]?.applicant?.id}`).click({ timeout: 10_000 });
    
        await page.waitForTimeout(500);
    
        await page.getByTestId(`copy-invite-link-${session.data?.children[0]?.applicant?.id}`)
            .click({ timeout: 10_000 });
    
        await page.getByTestId('invite-modal-cancel').click();
    
        const copiedLink = await page.evaluate(async () => await navigator.clipboard.readText());
    
        const coAppLinkUrl = new URL(copiedLink);
    
                const newPageContext = await browser.newContext({ 
            permissions: ['camera', 'microphone'],
            // Use the same camera setup as e2e-ui config
            launchOptions: {
                args: [
                    '--use-fake-ui-for-media-stream',
                    '--use-fake-device-for-media-stream'
                ]
            }
        });
        
        const coAppPage = await newPageContext.newPage();
    
        const coAppSessionApiUrl = joinUrl(app.urls.api, coAppLinkUrl.pathname);
    
        const [ coSessionResp ] = await Promise.all([
            coAppPage.waitForResponse(resp => resp.url().includes(coAppSessionApiUrl)
                    && resp.ok()
                    && resp.request().method() === 'GET'),
            coAppPage.goto(joinUrl(app.urls.app, `${coAppLinkUrl.pathname}${coAppLinkUrl.search}`))
        ]);
    
        const coAppSession = await waitForJsonResponse(coSessionResp);
    
		// Handle terms modal if present (before applicant type selection)
		await handleOptionalTermsCheckbox(coAppPage);
		
        await selectApplicantType(coAppPage, coAppSessionApiUrl, '#other');
    
        await identityStep(coAppPage);
    
        // Complete Plaid Connection using robust utility
        await completePlaidFinancialStepBetterment(coAppPage, 'user_bank_income', '{}');
    
        await waitForPlaidConnectionCompletion(coAppPage);

        // Complete Paystub Connection
        await completePaystubConnection(coAppPage);
    
        await Promise.all([
            coAppPage.waitForResponse(resp => resp.url().includes(`/sessions/${coAppSession.data.id}/steps/`)
                && resp.ok()
                && resp.request().method() === 'PATCH'),
            coAppPage.getByTestId('employment-step-continue').click()
        ]);
    
        await coAppPage.close();
        page.off('response', responseSession);
        const [ sessionResponse1 ] = await Promise.all([
            page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}?fields[session]`)
                && resp.ok()
                && resp.request().method() === 'GET'),
            page.reload()
        
        ]);
        page.on('response', responseSession);
    
        await searchSessionWithText(page, sessionId);
    
        const newSession = await waitForJsonResponse(sessionResponse1);
    
    
        const rentBudgetNew = newSession.data?.target ?? 0;
        const rentLocatorNew = page.getByTestId('rent-budget-edit-btn');
        await checkDollarText(rentBudgetNew, rentLocatorNew);
    
        const monthlyIncomeNew = newSession.data.state?.summary?.total_income;
        const monthlyIncomeLocatorNew = await page.getByTestId('report-monthly-income-card');
        await checkDollarText(monthlyIncomeNew, monthlyIncomeLocatorNew);
        
        // Validate that monthly income has increased after co-applicant completion
        await expect(monthlyIncomeNew).toBeGreaterThan(monthlyIncome);
        console.log('🚀 ~ Monthly Income Before:', monthlyIncome);
        console.log('🚀 ~ Monthly Income After:', monthlyIncomeNew);
        console.log('🚀 ~ Income Increase:', monthlyIncomeNew - monthlyIncome);
        
        const rentBudgetRatioNew = newSession.data.state?.summary?.total_target_to_income_ratio;
        const rentRatioLocatorNew = await page.getByTestId('report-rent-income-ratio-card');
        await expect(rentRatioLocatorNew).toContainText(String(rentBudgetRatioNew));
        console.log('🚀 ~ New Rent/Income Ratio:', rentBudgetRatioNew);
        
        // ADD: Retry logic for ratio calculation with 25-second max wait
        let calculatedRatioNew;
        let attempts = 0;
        const maxAttempts = 5; // 5 attempts * 5 seconds = 25 seconds max
        const waitTimePerAttempt = 5000; // 5 seconds between attempts

        do {
            if (attempts > 0) {
                await page.waitForTimeout(waitTimePerAttempt); // Wait 5 seconds between attempts
                // Refresh session data on retry attempts
                const [ retrySessionResponse ] = await Promise.all([
                    page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}?fields[session]`)
                        && resp.ok()
                        && resp.request().method() === 'GET'),
                    page.reload()
                ]);
                const retrySession = await waitForJsonResponse(retrySessionResponse);
                const retryMonthlyIncome = retrySession.data.state?.summary?.total_income;
                const retryRentBudget = retrySession.data?.target ?? 0;
                
                if (retryMonthlyIncome > 0 && retryRentBudget > 0) {
                    calculatedRatioNew = Math.round((retryRentBudget / retryMonthlyIncome) * 100);
                    console.log(`🚀 ~ Retry Attempt ${attempts}: Calculated New Ratio:`, calculatedRatioNew);
                    console.log(`🚀 ~ Retry Monthly Income:`, retryMonthlyIncome);
                    console.log(`🚀 ~ Retry Rent Budget:`, retryRentBudget);
                }
            } else {
                // First attempt with current data
                if (monthlyIncomeNew > 0 && rentBudgetNew > 0) {
                    calculatedRatioNew = Math.round((rentBudgetNew / monthlyIncomeNew) * 100);
                    console.log(`🚀 ~ First Attempt: Calculated New Ratio:`, calculatedRatioNew);
                }
            }
            
            attempts++;
        } while (calculatedRatioNew > 30 && attempts < maxAttempts);

        // Use the retry result for the assertion
        await expect(calculatedRatioNew).toBeLessThanOrEqual(30); // Should be below 30% threshold
        await page.getByTestId('view-details-btn').click({ timeout: 20_000 });
    
        await expect(page.getByTestId('GROSS_INCOME_RATIO_EXCEEDED')).toHaveCount(0, { timeout: 20_000 });
    
        await page.getByTestId('close-event-history-modal').click({ timeout: 20_000 });
        page.off('response', responseSession);
        await page.waitForTimeout(1000);
    });
});
