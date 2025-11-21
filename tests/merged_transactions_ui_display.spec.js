import { expect, test } from "./fixtures/api-data-fixture";
import { getBankConnectionData } from "./mock-data/high-balance-financial-payload";
import { admin, app } from "./test_config";
import { findAndInviteApplication } from "./utils/applications-page";
import { cleanupSession } from "./utils/cleanup-helper";
import generateSessionForm from "./utils/generate-session-form";
import { getAmount, joinUrl } from "./utils/helper";
import { findSessionLocator, searchSessionWithText } from "./utils/report-page";
import { setupInviteLinkSession, updateRentBudget, waitForConnectionCompletion } from "./utils/session-flow";
import { adminLoginAndNavigateToApplications, gotoIncomeSourceAndCheckVisibility } from "./utils/session-utils";
import { waitForJsonResponse } from "./utils/wait-response";


let createdSessionId = null;
let allTestsPassed = true;

const appName = 'AutoTest - Simulation financial employment';
test.describe('QA-219: merged_transactions_ui_display.spec', () => {

    // ✅ Cleanup session after test
    test.afterAll(async ({ request }) => {
        await cleanupSession(request, createdSessionId, allTestsPassed);
    });

    test('UI Validation for Combined Transactions Display', {
        tag: ['@regression', '@staging-ready', '@rc-ready'],
        timeout: 180_000
    }, async ({ page, browser }) => {
        try {
            console.log("➡️ Logging in as admin and navigating to applications page...");
            await adminLoginAndNavigateToApplications(page, admin);

            console.log(`➡️ Finding and inviting application: "${appName}"`);
            await findAndInviteApplication(page, appName);

            const user = {
                first_name: 'Transaction',
                last_name: 'Merge',
                email: 'playwright+mergetransaction@verifast.com'
            };

            console.log("➡️ Generating session form and invite link for user:", user);
            const { sessionId, sessionUrl, link } = await generateSessionForm.generateSessionAndExtractLink(page, user);

            createdSessionId = sessionId;

            console.log("➡️ Starting applicant session flow...");
            const applicantPage = await startSessionFlow(link, browser);

            console.log("➡️ Setting up applicant (invite link session)...");
            await setupInviteLinkSession(applicantPage);

            console.log("➡️ Updating rent budget for applicant...");
            await updateRentBudget(applicantPage, sessionId, '500');

            // Financial Step
            const financialStep = applicantPage.getByTestId('financial-verification-step');
            console.log("➡️ Waiting for Financial Verification step in applicant UI...");
            await expect(financialStep).toBeVisible({ timeout: 20_000 });

            console.log("➡️ Preparing mock bank (custom) data and waiting for /financial-verifications POST...");
            const responsePromise = applicantPage.waitForResponse(response =>
                response.url().includes('/financial-verifications') &&
                response.request().method() === 'POST' &&
                response.ok()
            );
            const customData = getBankConnectionData(user, {
                months: 1,
                paycheckAmounts: [2000, 2000, 2000, 2000],
                payDates: [1, 2, 3, 4],
                incomeOtherTypes: []
            });
            console.log("🚀 Mock bank data to inject:", customData)
            applicantPage.on('dialog', async (dialog) => {
                await dialog.accept(JSON.stringify(customData));
            });

            // Click connect bank and wait for the verification POST
            console.log("➡️ Clicking 'connect bank' button...");
            await financialStep.getByTestId('connect-bank').click();

            console.log("➡️ Awaiting /financial-verifications POST response...");
            await responsePromise;

            console.log("➡️ Waiting for account connection to complete...");
            await waitForConnectionCompletion(applicantPage);

            console.log("➡️ Waiting an extra 3 seconds for additional UI processing...");
            await applicantPage.waitForTimeout(3000);

            console.log("➡️ Closing applicant page.");
            await applicantPage.close()

            console.log("➡️ Bringing admin page to front.");
            await page.bringToFront();

            console.log("➡️ Opening Applicants menu in admin UI...");
            await page.getByTestId('applicants-menu').click();
            await page.getByTestId('applicants-submenu').click();

            console.log("➡️ Searching for applicant session in table...");
            await searchSessionWithText(page, sessionId);

            console.log("➡️ Retrieving session data...");
            const session = await getSessionData(page, sessionId);

            console.log("➡️ Navigating to income sources and ensuring visibility (with polling)...");
            let incomeSources = [];
            let attempts = 0;
            const maxAttempts = 15;

            while (attempts < maxAttempts) {
                incomeSources = await gotoIncomeSourceAndCheckVisibility(page, sessionId);
                if (incomeSources.length > 0) {
                    console.log(`✅ Found ${incomeSources.length} income source(s) after ${attempts + 1} attempt(s)`);
                    break;
                }
                attempts++;
                if (attempts < maxAttempts) {
                    console.log(`⏳ No income sources yet, waiting... (attempt ${attempts}/${maxAttempts})`);
                    await page.waitForTimeout(2000);
                    await page.reload();
                }
            }

            if (incomeSources.length === 0) {
                throw new Error(`No income sources found after ${maxAttempts} attempts (${maxAttempts * 2}s)`);
            }

            for (const element of incomeSources) {
                console.log(`   ⏩ Verifying income source row [ID: ${element.id}] is visible`);
                await expect(page.getByTestId(`income-source-${element.id}`)).toBeVisible({ timeout: 30_000 });
            }

            console.log("➡️ Verifying there is at least one income source...");
            await expect(incomeSources.length).toBeGreaterThan(0);

            const incomeSource = incomeSources[0];

            console.log(`➡️ Working with first income source (ID: ${incomeSource.id})`);
            const incomeRow = page.getByTestId(`income-source-${incomeSource.id}`)
            await expect(incomeRow).toBeVisible();

            const mockTransactions = customData.institutions[0].accounts[0].transactions;
            const incomeTranctions = mockTransactions.filter(trans => trans.category === 'income');

            // await expect(incomeRow.getByTestId(`source-${incomeSource.id}-last-trans-date-col`)).toContainText(incomeTranctions[0].date)

            console.log("➡️ Opening income source detail modal...");
            await incomeRow.getByTestId('income-source-detail-btn').click();
            await page.waitForTimeout(2000); // Wait for modal animation and rendering

            const incomeDetailModal = page.getByTestId('income-source-details')
            await expect(incomeDetailModal).toBeVisible();

            console.log("➡️ Validating display of the transactions date range...");
            await expect(page.getByTestId(`description-type-showRange`)).toBeVisible()
            await expect(page.getByTestId(`description-type-showRange`))
                .toContainText(`${formatIsoToMonthDayYear(incomeTranctions[incomeTranctions.length - 1].date)} - ${formatIsoToMonthDayYear(incomeTranctions[0].date)}`)

            incomeSource.transactions.reverse()
            console.log("➡️ Verifying individual income transaction rows...");

            for (let index = 0; index < incomeSource.transactions.length; index++) {
                const transaction = incomeSource.transactions[index];
                const mockIncomeTransaction = incomeTranctions.find(tr => tr.date === transaction.date)
                const incomeRow = page.getByTestId(`income-transaction-${transaction.id}`)
                console.log(`   ⏩ Checking row for transaction ${transaction.id} / date ${transaction.date}`);
                await expect(incomeRow).toBeVisible();
                await expect(incomeRow.getByTestId(`income-transaction-${transaction.id}-name`)).toContainText(mockIncomeTransaction.description)
                await expect(incomeRow.getByTestId(`income-transaction-${transaction.id}-amount`)).toContainText(getAmount(mockIncomeTransaction.amount))
                await expect(incomeRow.getByTestId(`income-transaction-${transaction.id}-date`)).toContainText(formatIsoToMonthDayYear(mockIncomeTransaction.date))

                if (new Date(transaction.date).getUTCDate() === 4) {
                    console.log(`   🟩 Transaction on day 4: should be a merged-transaction-row-top`);
                    await expect(incomeRow).toContainClass('merged-transaction-row-top')
                    await expect(incomeRow.getByTestId('merged-transaction-label')).toBeVisible();
                    await expect(incomeRow.getByTestId('merged-transaction-label')).toContainText(`Transactions combined for calculation. Date assigned: ${formatIsoToMonthDayYear(transaction.date, ', ')}`)
                } else if (new Date(transaction.date).getUTCDate() > 1 && new Date(transaction.date).getUTCDate() < 4) {
                    console.log(`   🟨 Transaction on day ${new Date(transaction.date).getUTCDate()}: should be merged-transaction-row-middle`);
                    await expect(incomeRow).toContainClass('merged-transaction-row-middle')
                } else if (new Date(transaction.date).getUTCDate() === 1) {
                    console.log(`   🟦 Transaction on day 1: should be merged-transaction-row-bottom`);
                    await expect(incomeRow).toContainClass('merged-transaction-row-bottom')
                } else {
                    console.log(`   ⬜ Transaction on other day (${new Date(transaction.date).getUTCDate()}): should NOT be marked as merged`);
                    await expect(incomeRow).not.toContainClass('merged-transaction-row-top')
                    await expect(incomeRow).not.toContainClass('merged-transaction-row-middle')
                    await expect(incomeRow).not.toContainClass('merged-transaction-row-bottom')
                }
            }

            console.log("✅ All main UI validations for merged transactions display complete!");
        } catch (err) {
            console.error('❌ Test failed:', err.message);
            allTestsPassed = false;
            throw err;
        }
    });

})

function formatIsoToMonthDayYear(input, separator = '-') {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const [year, month, day] = input.split('-');
    const monthStr = months[parseInt(month, 10) - 1];
    return `${monthStr} ${day}${separator}${year}`;
}

async function getSessionData(page, sessionId) {
    console.log(`➡️ Locating session card in list for sessionId: ${sessionId}`);
    const sessionLocator = await findSessionLocator(page, `[data-session="${sessionId}"]`);

    const [sessionResponse] = await Promise.all([
        page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}?fields[session]`)
            && resp.ok()
            && resp.request().method() === 'GET'),
        sessionLocator.click()
    ]);

    console.log("➡️ Received session API response, parsing...");
    const { data: session } = await waitForJsonResponse(sessionResponse);
    return session;
};


async function startSessionFlow(link, browser) {
    const linkUrl = new URL(link);
    console.log("➡️ Launching new browser context for applicant...");
    const context = await browser.newContext();
    const applicantPage = await context.newPage();
    const gotoUrl = joinUrl(app.urls.app, `${linkUrl.pathname}${linkUrl.search}`);
    console.log("➡️ Navigating applicant page to:", gotoUrl);
    await applicantPage.goto(gotoUrl);
    return applicantPage;
}

