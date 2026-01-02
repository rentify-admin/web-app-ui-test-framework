import { test, expect } from '@playwright/test';
import loginForm from '~/tests/utils/login-form';
import { admin, app } from '~/tests/test_config';
import { findAndInviteApplication, gotoApplicationsPage } from '~/tests/utils/applications-page';
import generateSessionForm from '~/tests/utils/generate-session-form';
import { getCentsToDollarsSafe, joinUrl } from '~/tests/utils/helper';
import { completePaystubConnection, fillhouseholdForm, setupInviteLinkSession, updateRentBudget, identityStep, waitForPlaidConnectionCompletion, completePlaidFinancialStepBetterment } from '~/tests/utils/session-flow';
import { gotoPage } from '~/tests/utils/common';
import { findSessionLocator, searchSessionWithText } from '~/tests/utils/report-page';
import { waitForJsonResponse } from '~/tests/utils/wait-response';
import { cleanupSession } from './utils/cleanup-helper';

const applicationName = 'AutoTest Suite - Full Test';

let createdSessionId = null;
let primaryContext = null;
let coAppContext = null;
let allTestsPassed = true;

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

const checkMonthlyIncomeText = async (monthlyIncome, incomeLocator) => {
    // Always format as currency, even if 0 (UI shows $0.00, not N/A)
    const incomeText = getCentsToDollarsSafe(monthlyIncome ?? 0);
    await expect(incomeLocator).toContainText(String(incomeText));
};

/**
 * Poll for income sources to be generated after employment connection
 * @param {import('@playwright/test').Page} page - Page object
 * @param {string} sessionId - Session ID to poll
 * @param {number} maxAttempts - Maximum polling attempts (default: 20)
 * @param {number} intervalMs - Interval between attempts in ms (default: 3000)
 * @returns {Promise<Array>} Array of income sources found
 */
const pollForIncomeSources = async (page, sessionId, maxAttempts = 20, intervalMs = 3000) => {
    const apiUrl = `${app.urls.api}/sessions/${sessionId}/income-sources`;
    
    console.log(`🔍 Polling for income sources on session ${sessionId}...`);
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const response = await page.request.get(apiUrl, {
                params: {
                    'fields[income_source]': ':all',
                    all: true
                }
            });
            
            if (response.ok()) {
                const data = await response.json();
                const sources = data.data || [];
                
                console.log(`🔍 Poll attempt ${attempt + 1}/${maxAttempts}: Found ${sources.length} income source(s)`);
                
                if (sources.length > 0) {
                    console.log(`✅ Income sources generated after ${attempt + 1} attempt(s) (${(attempt + 1) * intervalMs / 1000}s)`);
                    return sources;
                }
            } else {
                console.log(`⚠️ Poll attempt ${attempt + 1}: Response status ${response.status()}`);
            }
        } catch (error) {
            console.log(`⚠️ Poll attempt ${attempt + 1} error: ${error.message}`);
        }
        
        if (attempt < maxAttempts - 1) {
            await page.waitForTimeout(intervalMs);
        }
    }
    
    console.log(`⚠️ No income sources found after ${maxAttempts * intervalMs / 1000}s`);
    return [];
};

test.describe('check_coapp_income_ratio_exceede_flag', () => {
    test('Should confirm co-applicant income is considered when generating/removing Gross Income Ratio Exceeded flag', { 
        tag: ['@smoke', '@external-integration', '@regression', '@staging-ready', '@rc-ready', '@try-test-rail-names'],
    }, async ({ page, browser }) => {
        test.setTimeout(550000);
        
        try {
            // Step 1: Admin Login and Navigate to Applications
        await loginForm.adminLoginAndNavigate(page, admin);

        // Step 2: Navigate to Applications Page
        await gotoApplicationsPage(page);

        // Step 3: Find and Invite Application
        await findAndInviteApplication(page, applicationName);
        
        // Step 4: Generate Session and Extract Link
        const { sessionId, sessionUrl, link } = await generateSessionForm.generateSessionAndExtractLink(page, user);
        createdSessionId = sessionId;  // Store for cleanup
        
        const linkUrl = new URL(link);
        
        // Step 5: Open Invite link
        primaryContext = await browser.newContext({ 
            permissions: ['camera', 'microphone'],
            // Use the same camera setup as e2e-ui config
            launchOptions: {
                args: [
                    '--use-fake-ui-for-media-stream',
                    '--use-fake-device-for-media-stream'
                ]
            }
        });
        
        const applicantPage = await primaryContext.newPage();
        await applicantPage.goto(joinUrl(`${app.urls.app}`, `${linkUrl.pathname}${linkUrl.search}`));
		
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
    
        // Step 6: Setup session flow (terms → applicant type → state)
        await setupInviteLinkSession(applicantPage, {
            sessionUrl,
            applicantTypeSelector: '#employed'
        });
    
        await updateRentBudget(applicantPage, sessionId, '900');
    
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
    
        // Remove the previous response listener to avoid interference
        page.off('response', responseSession);
    
        const [ sessionResponse ] = await Promise.all([
            page.waitForResponse(resp => {
                const url = decodeURI(resp.url());
                return url.includes(`/sessions/${sessionId}?fields[session]`)
                    && resp.ok()
                    && resp.request().method() === 'GET';
            }),
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
        await checkMonthlyIncomeText(monthlyIncome, monthlyIncomeLocator);
        
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
    
        coAppContext = await browser.newContext({ 
            permissions: ['camera', 'microphone'],
            // Use the same camera setup as e2e-ui config
            launchOptions: {
                args: [
                    '--use-fake-ui-for-media-stream',
                    '--use-fake-device-for-media-stream'
                ]
            }
        });
        
        const coAppPage = await coAppContext.newPage();
    
        const coAppSessionApiUrl = joinUrl(app.urls.api, coAppLinkUrl.pathname);
    
        const [ coSessionResp ] = await Promise.all([
            coAppPage.waitForResponse(resp => {
                const url = decodeURI(resp.url());
                return url.includes(coAppSessionApiUrl)
                    && resp.ok()
                    && resp.request().method() === 'GET';
            }),
            coAppPage.goto(joinUrl(app.urls.app, `${coAppLinkUrl.pathname}${coAppLinkUrl.search}`))
        ]);
    
        const coAppSession = await waitForJsonResponse(coSessionResp);
    
		// CO-APP: Setup session flow (terms → applicant type → state)
		await setupInviteLinkSession(coAppPage, {
            sessionUrl: coAppSessionApiUrl,
            applicantTypeSelector: '#other'
        });
    
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
        
        // Poll for income sources after both sessions (primary + co-app) are fully completed
        console.log('⏳ Polling for income sources after both sessions completion...');
        await pollForIncomeSources(page, sessionId, 20, 3000); // 20 attempts * 3s = 60s max
        
        page.off('response', responseSession);
        const [ sessionResponse1 ] = await Promise.all([
            page.waitForResponse(resp => {
                const url = decodeURI(resp.url());
                return url.includes(`/sessions/${sessionId}?fields[session]`)
                    && resp.ok()
                    && resp.request().method() === 'GET';
            }),
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
        await checkMonthlyIncomeText(monthlyIncomeNew, monthlyIncomeLocatorNew);
        
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
    
        // Poll for flag to clear (backend needs time to recalculate)
        console.log('🔍 Polling for GROSS_INCOME_RATIO_EXCEEDED flag to clear...');
        let flagCleared = false;
        const maxFlagPolls = 10; // 10 attempts * 2s = 20s max
        for (let i = 0; i < maxFlagPolls; i++) {
            const flagCount = await page.getByTestId('GROSS_INCOME_RATIO_EXCEEDED').count();
            console.log(`🔍 Attempt ${i + 1}/${maxFlagPolls}: GROSS_INCOME_RATIO_EXCEEDED count = ${flagCount}`);
            
            if (flagCount === 0) {
                flagCleared = true;
                console.log(`✅ Flag cleared after ${i + 1} attempts`);
                break;
            }
            
            // Close and reopen modal to refresh flag list
            if (i < maxFlagPolls - 1) {
                await page.getByTestId('close-event-history-modal').click({ timeout: 5_000 });
                await page.waitForTimeout(2000);
                await page.getByTestId('view-details-btn').click({ timeout: 5_000 });
                await page.waitForTimeout(1000);
            }
        }

        expect(flagCleared).toBe(true);
        await page.getByTestId('close-event-history-modal').click({ timeout: 5_000 });
        page.off('response', responseSession);
        await page.waitForTimeout(1000);
        
        } catch (error) {
            allTestsPassed = false;
            throw error;
        }
    });
    
    // ✅ Conditional cleanup: Keep session on failure for debugging
    test.afterAll(async ({ request }) => {
        console.log('🧹 Starting cleanup...');
        console.log(`   Session ID: ${createdSessionId || 'none'}`);
        console.log(`   All tests passed: ${allTestsPassed}`);
        
        // Clean up session (conditional - only if tests passed)
        await cleanupSession(request, createdSessionId, allTestsPassed);
        
        // Close contexts (always)
        if (primaryContext) {
            try {
                await primaryContext.close();
                console.log('✅ Primary context closed');
            } catch (error) {
                // Silent
            }
        }
        
        if (coAppContext) {
            try {
                await coAppContext.close();
                console.log('✅ Co-applicant context closed');
            } catch (error) {
                // Silent
            }
        }
    });
});
