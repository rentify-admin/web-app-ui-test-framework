// --- Utility Functions (Place outside of the test.describe block or in dedicated utility files) ---

import { test, expect } from '@playwright/test';
import { joinUrl } from './utils/helper';
import { waitForJsonResponse } from './utils/wait-response'; 
import { adminLoginAndNavigateToApplications } from './utils/session-utils';
import { admin, app } from './test_config'; 
import { findAndInviteApplication, openInviteModal } from './utils/applications-page';
import generateSessionForm from './utils/generate-session-form';
import { getBankData } from './mock-data/high-balance-financial-payload';
import { searchSessionWithText, navigateToSessionById } from './utils/report-page'; 
import { getRandomEmail } from './utils/helper';
import { handleOptionalStateModal, updateRentBudget } from './utils/session-flow';

/**
 * Completes the applicant session flow with banking data.
 */
async function completeSession(inviteLink, browser, sessionId, customData) {
    const linkUrl = new URL(inviteLink);
    const context = await browser.newContext();
    const applicantPage = await context.newPage();

    await applicantPage.goto(joinUrl(app.urls.app, `${linkUrl.pathname}${linkUrl.search}`));

    await handleOptionalStateModal(applicantPage);
    await updateRentBudget(applicantPage, sessionId);

    // Skip Pre-screening
    const questionStep = applicantPage.getByTestId('pre-screening-step');
    await expect(questionStep).toBeVisible();
    await questionStep.getByTestId('pre-screening-skip-btn').click();

    // Financial Verification
    const financialStep = applicantPage.getByTestId('financial-verification-step');
    await expect(financialStep).toBeVisible();
    
    const responsePromise = applicantPage.waitForResponse(response =>
        response.url().includes('/financial-verifications') &&
        response.request().method() === 'POST' &&
        response.ok()
    );

    applicantPage.on('dialog', async (dialog) => {
        await dialog.accept(JSON.stringify(customData));
    });

    // Click connect bank and wait for the verification POST
    await financialStep.getByTestId('connect-bank').click();
    await responsePromise; 

    await applicantPage.waitForTimeout(2000); 
    await applicantPage.getByTestId('financial-verification-continue-btn').click();

    await applicantPage.close();
}


/**
 * Navigates to a session detail page by ID using the search/navigate utils.
 */
async function navigateToSessionDetail(page, sessionId) {
    await searchSessionWithText(page, sessionId);
    await navigateToSessionById(page, sessionId);
    await page.waitForTimeout(3000); 

}

/**
 * Navigates to the income sources section, waits for the API response,
 * and asserts that all returned income sources are visible on the page.
 */
async function checkIncomeSourcesAndAssertVisibility(page, sessionId, timeout = 20_000) {
    const [incomeResp] = await Promise.all([
        page.waitForResponse(resp =>
            resp.url().includes(`/sessions/${sessionId}/income-sources`) &&
            resp.request().method() === 'GET' &&
            resp.ok(),
            { timeout: timeout }
        ),
        page.getByTestId('income-source-section-header').click()
    ]);

    const { data: incomeSources } = await waitForJsonResponse(incomeResp);

    for (const element of incomeSources) {
        await expect(page.getByTestId(`income-source-${element.id}`)).toBeVisible();
    }

    return incomeSources;
}


/**
 * Handles the merging of the primary and co-applicant sessions.
 */
async function mergeSessions(page, priSessionId, coAppSessionId) {
    await searchSessionWithText(page, 'merge');
    const sessionLink = page.locator(`[href="/applicants/all/${priSessionId}"]`);
    await sessionLink.click()
    // Select both sessions
    const priSessionCheck = page.locator(`.application-card[data-session="${priSessionId}"]`).locator('input[type=checkbox]');
    if (!await priSessionCheck.isChecked()) { await priSessionCheck.check(); }

    const coSessionCheck = page.locator(`.application-card[data-session="${coAppSessionId}"]`).locator('input[type=checkbox]');
    if (!await coSessionCheck.isChecked()) { await coSessionCheck.check(); }

    const mergeButton = page.getByTestId('merge-session-btn');
    await expect(mergeButton).toBeVisible();
    await mergeButton.click();

    const mergeModal = page.getByTestId('merge-session-modal');
    await expect(mergeModal).toBeVisible();

    // Wait for the merge API calls to complete
    console.log("🚀 ~ mergeSessions ~ priSessionId:", priSessionId)
    console.log("🚀 ~ mergeSessions ~ coAppSessionId:", coAppSessionId)
    await Promise.all([
        page.waitForResponse(resp => 
            resp.url().includes(`/sessions/${priSessionId}`) && 
            resp.request().method() === 'PATCH' && 
            resp.ok()
        ),
        page.waitForResponse(resp => 
            resp.url().includes(`/sessions/${priSessionId}?fields[session]`) && 
            resp.request().method() === 'GET' && 
            resp.ok()
        ),
        mergeModal.locator('button', { hasText: 'Merge' }).click()
    ]);
}

/**
 * Handles the splitting of the co-applicant session from the primary household.
 */
async function splitSession(page, priSessionId, coAppSessionId) {
    const coApplicantRaw = page.getByTestId(`raw-${coAppSessionId}`);

    await expect(coApplicantRaw).toBeVisible();
    await coApplicantRaw.getByTestId('overview-applicant-btn').click();

    const splitButton = coApplicantRaw.getByTestId('split-into-new-household-btn');
    await expect(splitButton).toBeVisible();
    splitButton.click();
    
    const confirmBox = page.getByTestId('confirm-box');
    await expect(confirmBox).toBeVisible();

    // Wait for the DELETE (split) request
    await Promise.all([
        page.waitForResponse(resp => 
            resp.url().includes(`/sessions/${priSessionId}/children/${coAppSessionId}`) && 
            resp.request().method() === 'DELETE' && 
            resp.ok()
        ),
        confirmBox.getByTestId('confirm-btn').click()
    ]);
}


test.describe('QA-210: Check Income Source Regenerate on Split/Merge', () => {

    test('Verify Regenerate Income After Merge/Split', { tag: ['@regression'] }, async ({ page, browser }) => {
        test.setTimeout(200000);
        // --- Setup ---
        test.setTimeout(300_000);
        const appName = 'Heartbeat Test - Financial';

        const primaryUser = { email: getRandomEmail(), first_name: 'Merge', last_name: 'Primary', password: 'password' };
        const coAppUser = { email: getRandomEmail(), first_name: 'Merge', last_name: 'Coapp' };

        // 1. Primary Applicant Flow
        await adminLoginAndNavigateToApplications(page, admin);
        await findAndInviteApplication(page, appName);
        const { sessionId: priSessionId, link: priLink } = await generateSessionForm.generateSessionAndExtractLink(page, primaryUser);
        await completeSession(priLink, browser, priSessionId, getBankData(primaryUser));
        
        // 2. Co-Applicant Flow
        await page.bringToFront();
        await openInviteModal(page, appName);
        const { sessionId: coAppSessionId, link: coAppLink } = await generateSessionForm.generateSessionAndExtractLink(page, coAppUser);
        
        const coAppCustomData = getBankData(coAppUser);
        coAppCustomData.institutions[0].accounts[0].account_number = '9123456780';
        coAppCustomData.institutions[0].accounts[0].balance = 25000;
        coAppCustomData.institutions[0].accounts[0].transactions[0].amount = 12000;
        coAppCustomData.institutions[0].accounts[0].transactions[1].amount = 12000;
        
        await completeSession(coAppLink, browser, coAppSessionId, coAppCustomData);

        // --- Verify Before Merge ---
        await page.bringToFront();
        await page.getByTestId('applicants-menu').click();
        await page.getByTestId('applicants-submenu').click();
        
        // 3. Check Co-Applicant Income
        await navigateToSessionDetail(page, coAppSessionId);
        await checkIncomeSourcesAndAssertVisibility(page, coAppSessionId);
        
        // 4. Check Primary Applicant Income
        await navigateToSessionDetail(page, priSessionId);
        await checkIncomeSourcesAndAssertVisibility(page, priSessionId);

        // --- Merge Action ---
        await page.getByTestId('applicants-submenu').click(); // Navigate back to list view
        
        // 5. Merge Sessions
        await mergeSessions(page, priSessionId, coAppSessionId);
        await page.waitForTimeout(2000); 
        await page.reload();

        // --- Verify After Merge ---
        // 6. Check Combined Income Sources
        // After merge, both sessions' income data is expected to be loaded on the parent page
        await Promise.all([
            // Primary income sources regenerated
            page.waitForResponse(resp =>
                resp.url().includes(`/sessions/${priSessionId}/income-sources`) &&
                resp.request().method() === 'GET' &&
                resp.ok(),
                { timeout: 20_000 }
            ), 
            // Co-App income sources regenerated
            page.waitForResponse(resp =>
                resp.url().includes(`/sessions/${coAppSessionId}/income-sources`) &&
                resp.request().method() === 'GET' &&
                resp.ok(),
                { timeout: 20_000 }
            ), 
            page.getByTestId('income-source-section-header').click() 
        ]);

        // --- Split Action ---
        // 7. Split Session
        await splitSession(page, priSessionId, coAppSessionId);
        await page.waitForTimeout(1000); 
        const sessionLink = page.locator(`[href="/applicants/all/${priSessionId}"]`);
        await sessionLink.click()
        await page.waitForTimeout(1000); 
        await page.reload();

        // --- Verify After Split ---
        // 8. Check Primary Income (should be independent again)
        await checkIncomeSourcesAndAssertVisibility(page, priSessionId);
        
        // 9. Check Co-Applicant Income (now in a new, independent session)
        await page.getByTestId('applicants-submenu').click(); // Navigate back to list view
        await navigateToSessionDetail(page, coAppSessionId);
        await checkIncomeSourcesAndAssertVisibility(page, coAppSessionId);

    });
});