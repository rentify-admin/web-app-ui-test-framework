// --- Utility Functions (Place outside of the test.describe block or in dedicated utility files) ---

import { test, expect } from '@playwright/test';
import { getAmount, joinUrl } from './utils/helper';
import { waitForJsonResponse } from './utils/wait-response';
import loginForm from './utils/login-form';
import { admin, app } from './test_config';
import { findAndInviteApplication, openInviteModal } from './utils/applications-page';
import generateSessionForm from './utils/generate-session-form';
import { getBankData } from './mock-data/high-balance-financial-payload';
import { searchSessionWithText, navigateToSessionById } from './utils/report-page';
import { getRandomEmail } from './utils/helper';
import { setupInviteLinkSession, updateRentBudget, waitForSimulatorConnectionCompletion } from './utils/session-flow';
import { fillMultiselect } from './utils/common';
import { cleanupSession } from './utils/cleanup-helper';

/**
 * Completes the applicant session flow with banking data.
 */
async function completeSession(inviteLink, browser, sessionId, customData) {
    const linkUrl = new URL(inviteLink);
    const context = await browser.newContext();
    const applicantPage = await context.newPage();

    await applicantPage.goto(joinUrl(app.urls.app, `${linkUrl.pathname}${linkUrl.search}`));

    // Setup session flow: handles state modal + terms checkbox in correct order
    // Pattern 2: NO applicant type (financial-only application)
    await setupInviteLinkSession(applicantPage);

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

    // ✅ Wait for simulator connection to complete (Processing → Complete)
    console.log('⏳ Waiting for simulator connection to complete...');
    await waitForSimulatorConnectionCompletion(applicantPage, 15); // 15 iterations × 2 sec = 30 sec max
    console.log('✅ Simulator connection completed');

    // Now click continue button
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
        await expect(page.getByTestId(`income-source-${element.id}`)).toBeVisible({ timeout: 30_000 });
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

let cleanpSessionId = null;
let cleanpCoAppSessionId = null;
let allTestsPassed = true;


test.describe('QA-210: Check Income Source Regenerate on Split/Merge', () => {

    test('Verify Regenerate Income After Merge/Split', { tag: ['@needs-review'] }, async ({ page, browser }) => {
        // --- Setup ---
        test.setTimeout(300_000);
        const appName = 'Autotest - Heartbeat Test - Financial';
        try {
        const primaryUser = { email: getRandomEmail(), first_name: 'Merge', last_name: 'Primary', password: 'password' };
        const coAppUser = { email: getRandomEmail(), first_name: 'Merge', last_name: 'Coapp' };

        // 1. Primary Applicant Flow
        // Login and capture admin token to reuse later for API calls
        const adminToken = await loginForm.adminLoginAndNavigate(page, admin);
        await page.getByTestId('applications-menu').click();
        await page.getByTestId('applications-submenu').click();
        
        await findAndInviteApplication(page, appName);
        const { sessionId: priSessionId, link: priLink } = await generateSessionForm.generateSessionAndExtractLink(page, primaryUser);

        cleanpSessionId = priSessionId;

        const primaryUserBankData = getBankData(primaryUser);
        await completeSession(priLink, browser, priSessionId, primaryUserBankData);

        // 2. Co-Applicant Flow
        await page.bringToFront();
        await openInviteModal(page, appName);
        const { sessionId: coAppSessionId, link: coAppLink } = await generateSessionForm.generateSessionAndExtractLink(page, coAppUser);

        cleanpCoAppSessionId = coAppSessionId;

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

        // Navigate to the primary session detail page before reloading
        await navigateToSessionDetail(page, priSessionId);

        // Simple reload without waiting for response (more stable)
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
        
        // Get session data via isolated GET request using token from initial login
        const sessionResponse = await page.request.get(`${app.urls.api}/sessions/${priSessionId}?fields[session]=id,applicant,children`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!sessionResponse.ok()) {
            const errorText = await sessionResponse.text();
            throw new Error(`Failed to fetch session: ${sessionResponse.status()} - ${errorText}`);
        }
        
        const sessionData = await sessionResponse.json();
        const session = sessionData.data;
        
        await page.waitForTimeout(3000);
        // --- Verify After Merge ---
        // 6. Check Combined Income Sources
        // After merge, both sessions' income data is expected to be loaded on the parent page
        const [primaryIncomeResponse, coappIncomeResponse] = await Promise.all([
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

        // 6.1 Checking income source of primary applicant
        const { data: primaryIncomeSources } = await waitForJsonResponse(primaryIncomeResponse);
        const { data: coappIncomeSources } = await waitForJsonResponse(coappIncomeResponse);

        await verifyIncomeSourceDetails(page, session.applicant.id, primaryIncomeSources, primaryUserBankData);
        await verifyIncomeSourceDetails(page, session.children[0].applicant.id, coappIncomeSources, coAppCustomData);

        const financialSection = page.getByTestId('financial-section');

        await expect(financialSection).toBeVisible();

        const [preFinancialResponse, coAppFinancialResponse] = await Promise.all([
            page.waitForResponse(resp => {
                const url = decodeURI(resp.url());
                return url.includes('/financial-verifications')
                    && url.includes(session.id)
                    && resp.request().method() === 'GET'
                    && resp.ok();
            }),
            page.waitForResponse(resp => {
                const url = decodeURI(resp.url());
                return url.includes('/financial-verifications')
                    && url.includes(coAppSessionId)
                    && resp.request().method() === 'GET'
                    && resp.ok();
            }),
            financialSection.getByTestId('financial-section-header').click()
        ])

        const { data: preFinacials } = await waitForJsonResponse(preFinancialResponse);
        const { data: coAppFinancials } = await waitForJsonResponse(coAppFinancialResponse);

        await checkFinancialAccountData(page, priSessionId, primaryUserBankData, preFinacials, primaryUser);
        await checkFinancialAccountData(page, coAppSessionId, coAppCustomData, coAppFinancials, coAppUser);

        await page.getByTestId('financial-section-transactions-radio').click();

        await financialTransactionVerify(page, primaryUserBankData);

        await fillMultiselect(page, page.getByTestId('financial-section-applicant-filter'), [ `${coAppUser.first_name} ${coAppUser.last_name}` ]);
        
        await financialTransactionVerify(page, coAppCustomData);

        // --- Split Action ---
        // 7. Split Session
        await splitSession(page, priSessionId, coAppSessionId);
        
        // Navigate to primary session and wait for household-status-alert (better than fixed wait)
        const sessionLink = page.locator(`[href="/applicants/all/${priSessionId}"]`);
        await sessionLink.click();
        await expect(page.getByTestId('household-status-alert')).toBeVisible({ timeout: 10_000 });
        
        // Reload and wait for page to be ready
        await page.reload();
        await page.waitForLoadState('networkidle');
        await expect(page.getByTestId('household-status-alert')).toBeVisible({ timeout: 10_000 });
        
        // Poll for split to complete: verify children array is empty (co-app is now independent)
        console.log('🔍 Polling for split to complete (children should be empty)...');
        const maxPolls = 8; // 8 polls × ~2s = ~16 seconds max
        let splitComplete = false;
        for (let i = 0; i < maxPolls; i++) {
            const sessionResponse = await page.request.get(`${app.urls.api}/sessions/${priSessionId}?fields[session]=id,applicant,children`, {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (sessionResponse.ok()) {
                const sessionData = await sessionResponse.json();
                const children = sessionData.data?.children || [];
                
                if (children.length === 0) {
                    console.log(`✅ Split complete: children array is empty (poll ${i + 1}/${maxPolls})`);
                    splitComplete = true;
                    break;
                } else {
                    console.log(`⏳ Split in progress: ${children.length} children remaining (poll ${i + 1}/${maxPolls})`);
                }
            }
            
            if (i < maxPolls - 1) {
                await page.waitForTimeout(2000);
            }
        }
        
        if (!splitComplete) {
            throw new Error('Split did not complete: children array is not empty after 15 seconds');
        }
        
        // --- Verify After Split ---
        // 8. Check Primary Income (should be independent again)
        await checkIncomeSourcesAndAssertVisibility(page, priSessionId);

        // 9. Check Co-Applicant Income (now in a new, independent session)
        await page.getByTestId('applicants-submenu').click(); // Navigate back to list view
        await navigateToSessionDetail(page, coAppSessionId);
        await checkIncomeSourcesAndAssertVisibility(page, coAppSessionId);
        } catch (error){
            console.error('❌ Test failed:', error.message);
            allTestsPassed = false;
            throw error;
        }
    });

    test.afterAll(async ({request}) => {
        await cleanupSession(request, cleanpSessionId, allTestsPassed);
        await cleanupSession(request, cleanpCoAppSessionId, allTestsPassed);
    })

});

async function financialTransactionVerify(page, primaryUserBankData) {
    const transactionTable = await page.getByTestId('financial-section-transactios-list');
    const mockInstitutions = primaryUserBankData.institutions;
    const mockAccounts = mockInstitutions[0].accounts;
    const mockTransactions = mockAccounts[0].transactions;
    const transcationRows = await transactionTable.locator('tbody>tr');
    
    for (let index = 0; index < mockTransactions.length; index++) {
        const element = mockTransactions[index];
        await expect(transcationRows.nth(index).getByTestId('financial-section-transactios-list-date-col')).toContainText(mockTransactions[index].date);
        await expect(transcationRows.nth(index).getByTestId('financial-section-transactios-list-description-col')).toContainText(mockTransactions[index].description);
        await expect(transcationRows.nth(index).getByTestId('financial-section-transactios-list-paid_in-col')).toContainText(getAmount(mockTransactions[index].amount));
        await expect(transcationRows.nth(index).getByTestId('financial-section-transactios-list-account-col')).toContainText('Checking');
        await expect(transcationRows.nth(index).getByTestId('financial-section-transactios-list-institution-col')).toContainText(mockInstitutions[0].name);
    }
}

async function checkFinancialAccountData(page, priSessionId, primaryUserBankData, preFinacials, primaryUser) {
    const preFinancialDiv = await page.getByTestId(`financial-section-financials-wrapper-${priSessionId}`);

    const accounts = primaryUserBankData.institutions[0].accounts;
    for (let index = 0; index < preFinacials.length; index++) {
        const financial = preFinacials[index];

        await expect(preFinancialDiv.locator('td[data-testid*="-account-col"]')).toContainText(accounts[index].account_number.slice(-4));
        await expect(preFinancialDiv.locator('td[data-testid*="-type-col"]')).toContainText('Checking');
        await expect(preFinancialDiv.locator('td[data-testid*="-institution-col"]')).toContainText(primaryUserBankData.institutions[0].name);
        // await expect(preFinancialDiv.locator('td[data-testid*="-identities-col"]')).toContainText(primaryUser.email);
        await expect(preFinancialDiv.locator('td[data-testid*="-identities-col"]')).toContainText(`${primaryUser.first_name} ${primaryUser.last_name}`);
        await expect(preFinancialDiv.locator('td[data-testid*="-balance-col"]')).toContainText(`${getAmount(accounts[index].balance)}`);
        await expect(preFinancialDiv.locator('td[data-testid*="-transaction_count-col"]')).toContainText(`${accounts[index].transactions.length}`);
        await expect(preFinancialDiv.locator('td[data-testid*="-provider-col"]')).toContainText('Simulation');
    }
}

async function verifyIncomeSourceDetails(page, applicantId, primaryIncomeSources, primaryUserBankData) {
    const primaryIncomeSourceDiv = page.getByTestId(`applicant-income-source-${applicantId}`);
    for (let index = 0; index < primaryIncomeSources.length; index++) {
        if(index === 0){
            const element = primaryIncomeSources[index];
            const incomeSourceDiv = primaryIncomeSourceDiv.getByTestId(`income-source-${element.id}`);
            await expect(incomeSourceDiv).toBeVisible();
            const lastTransaction = primaryUserBankData.institutions[0].accounts[0].transactions[0];
            await expect(incomeSourceDiv.getByTestId(`source-${element.id}-source-col`)).toContainText('Financial Transactions');
            await expect(incomeSourceDiv.getByTestId(`source-${element.id}-description-col`)).toContainText(lastTransaction.description);
            await expect(incomeSourceDiv.getByTestId(`source-${element.id}-last-trans-date-col`)).toContainText(lastTransaction.date);
            await expect(incomeSourceDiv.getByTestId(`source-${element.id}-income-type-col`)).toContainText('Employment Transactions');
    
            await incomeSourceDiv.getByTestId('income-source-detail-btn').click();
            const incomeDetailsModal = page.getByTestId('income-source-details');
            await expect(incomeDetailsModal).toBeVisible();
    
            const transactionTable = incomeDetailsModal.getByTestId('income-detail-transactions-table');
    
            await expect(transactionTable).toBeVisible();
    
            const mockTrans = primaryUserBankData.institutions[0].accounts[0].transactions;
            element.transactions.reverse();
            for (let subIndex = 0; subIndex < element.transactions.length; subIndex++) {
                const item = element.transactions[subIndex];
                await expect(item.paid_in).toBe(mockTrans[subIndex].amount * 100);
                await expect(page.getByTestId(`income-transaction-${item.id}-amount`)).toContainText(getAmount(mockTrans[subIndex].amount));
                await expect(page.getByTestId(`income-transaction-${item.id}-name`)).toContainText(mockTrans[subIndex].description);
                await expect(page.getByTestId(`income-transaction-${item.id}-date`)).toContainText(formatDateToMonDDYYYY(mockTrans[subIndex].date));
            }
    
            await page.getByTestId('income-source-details-cancel').click();
        }
    }
}

// Function to convert 'YYYY-MM-DD' to 'Mon DD-YYYY' format, e.g., 2025-11-03 => Nov 03-2025
function formatDateToMonDDYYYY(dateString) {
    const dateParts = dateString.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const year = dateParts[0];
    const month = months[parseInt(dateParts[1], 10) - 1];
    const day = dateParts[2].padStart(2, '0');
    return `${month} ${day}-${year}`;
}