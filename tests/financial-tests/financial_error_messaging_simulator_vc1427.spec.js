import { test, expect } from '@playwright/test';
import { adminLoginAndNavigateToApplications } from '../utils/session-utils';
import { admin, app, session } from '../test_config';
import { findAndInviteApplication, generateSessionForApplication } from '../utils/applications-page';
import { getRandomEmail, wait } from '../utils/helper';
import { guestLogout, logout } from '../utils/auth-helper';
import { handleOptionalTermsCheckbox, updateRentBudget } from '../utils/session-flow';
import { getVeridocsBankStatementPayload } from '../mock-data/permission-test-simulators';
import { waitForJsonResponse } from '../utils/wait-response';
import { cleanupSession } from '../utils/cleanup-helper';
import loginForm from '../utils/login-form';
import { ApiClient, SessionApi } from '../api';
import { loginWithAdmin } from '../endpoint-utils/auth-helper';
import { createPaystubData } from '../mock-data/paystub-payload';

test.describe('QA-320 financial_error_messaging_simulator_vc1427.spec.js', () => {

    const adminClient = new ApiClient(app.urls.api, null, 120_000);

    const sessionApi = new SessionApi(adminClient);

    test.setTimeout(180_000);

    const APPLICATION_NAME = 'Autotest - Simulator Financial Step';
    const userData = {
        first_name: 'TestUser',
        last_name: 'Simulator',
        email: getRandomEmail(),
        password: 'password'
    };

    const cleanupData = {
        test1: {
            sessionId: false, passed: false
        },
        test2: {
            sessionId: false, passed: false
        },
        test3: {
            sessionId: false, passed: false
        },
        test4: {
            sessionId: false, passed: false
        },
        test5: {
            sessionId: false, passed: false
        },
    }

    test.beforeEach(async () => {
        await loginWithAdmin(adminClient);
    })


    console.log('UI Test - Financial Step Error Messaging (Simulator) (VC-1427)')

    test('[TEST 1] Rejected due to doc policy — Transactions Older Than 6 Months', {
        tags: ['@regression', '@simulator', '@financial', '@qa-320'],
    }, async ({ page }) => {

        await adminLoginAndNavigateToApplications(page, admin);

        const { sessionData, link } = await generateSessionForApplication(page, APPLICATION_NAME, userData, { prefix: false });
        const session = sessionData.data;
        cleanupData.test1.sessionId = session.id;

        await logout(page);

        await page.waitForTimeout(1000)

        await page.goto(link.replace('https://dev.verifast.app', app.urls.app));

        await handleOptionalTermsCheckbox(page);

        await updateRentBudget(page, session.id, '1500');

        const financialStep = page.getByTestId('financial-verification-step');

        await expect(financialStep).toBeVisible();


        // page.on('dialog', async dialog => {
        //     await dialog.accept(JSON.stringify());
        // });

        // const connectBtn = page.getByTestId('connect-bank');
        // await connectBtn.click();
        // const acknowledgementUploadBtn = page.getByTestId('acknowledge-bank-connect-btn');
        // if (await acknowledgementUploadBtn.isVisible()) {
        //     await acknowledgementUploadBtn.click();
        // }



        const uploadDocBtn = page.getByTestId('financial-upload-statement-btn');
        await uploadDocBtn.click();

        await page.waitForTimeout(2000);

        const acknowledgementBtn = page.getByTestId('acknowledge-upload-statement-btn');
        if (await acknowledgementBtn.isVisible()) {
            await acknowledgementBtn.click();
        }
        page.on('dialog', async dialog => {
            await dialog.accept(JSON.stringify(getVeridocsBankStatementPayload(userData, {
                numTransactions: 6,
                daysAgoEnd: 190, // Set the most recent transaction to be 190 days ago
                daysGap: 7,     // Keep a consistent gap between transactions
            })));
        });

        const uploadFileBtn = page.getByTestId('connect-bank');

        const postFinancialPromise = page.waitForResponse(resp =>
            resp.url().includes('/financial-verifications') &&
            resp.request().method() === 'POST' &&
            resp.ok()
        );

        await uploadFileBtn.click();

        const financialResponse = await postFinancialPromise;
        const { data: financialVerification } = await waitForJsonResponse(financialResponse);

        await page.waitForTimeout(5000);

        const flagError = 'No Bank Transactions Found';
        const stepError = 'older than 6 months';

        const errorsEle = page.getByTestId('financial-row-verification-errors');
        await expect(errorsEle).toContainText(stepError);

        // const financialVerificationPromise = async response => {
        //     returnresponse.url().includes(`/financial-verifications/${financialVerification.id}`) &&
        //         response.request().method() === 'GET' &&
        //         response.ok()
        // }


        const continueBtn = page.getByTestId('financial-verification-continue-btn');
        await expect(continueBtn).toBeVisible();


        const stepPromise = page.waitForResponse(resp =>
            resp.url().includes(`/sessions/${session.id}/steps/`) &&
            resp.request().method() === 'PATCH' &&
            resp.ok()
        );
        await continueBtn.click();
        await stepPromise;

        await page.waitForTimeout(5_000);

        await page.reload();

        const statusTile = page.getByTestId('step-FINANCIAL_VERIFICATION-lg').filter({ visible: true });

        await expect(statusTile.getByTestId('step-status')).toHaveText('Incomplete');

        const summaryFailedSection = page.getByTestId('summary-failed-section');
        await expect(summaryFailedSection).toBeVisible({ timeout: 20_000 });

        const verificationFlagsEle = page.getByTestId('financial-verification-flags')
        await expect(verificationFlagsEle).toBeVisible({ timeout: 20_000 });

        await expect(verificationFlagsEle).toContainText(flagError);

        await guestLogout(page);

        await page.goto('/');

        await loginForm.adminLoginAndNavigate(page, admin);

        await page.goto(`/applicants/all/${session.id}`);

        await expect(page.getByTestId('session-report-section')).toBeVisible()

        const householdRow = page.getByTestId(`raw-${session.id}`);
        await expect(householdRow).toBeVisible();
        const financialVerificationStatus = householdRow.getByTestId('raw-financial-verification-status')

        await financialVerificationStatus.click()

        const connectionStatusModal = page.getByTestId('report-financial-status-modal')
        await expect(connectionStatusModal).toBeVisible();

        const connRow = connectionStatusModal.getByTestId('connection-row')
        await expect(connRow).toContainText(stepError)

        const missingTransactionFlag = connectionStatusModal.getByTestId('MISSING_TRANSACTIONS')
        await expect(missingTransactionFlag).toBeVisible();
        await expect(missingTransactionFlag).toContainText(flagError);

        const sessionEventApi = sessionApi.event(session.id);
        const eventsData = await sessionEventApi.get({
            'fields[session_event]': ':all',
            filters: JSON.stringify({
                "$has": {
                    "entity": {
                        "id": financialVerification.id,
                    }
                },
                "event": {
                    "$in": ["document.rejected", "document.failed", "file.extraction.failed"]
                }
            })
        })
        const sessionEvents = eventsData.data;
        const docEvent = sessionEvents.find(event => 'document.rejected' === event.event)
        expect(docEvent).toBeDefined();
        expect(Array.isArray(docEvent.changes?.failed_conditions)).toBeTruthy();
        const condition = docEvent.changes.failed_conditions.find(cond => cond.flag?.key === 'BANK_STATEMENT_TRANSACTIONS_OLDER_THAN_6_MONTHS');
        expect(condition).toBeDefined();

        cleanupData.test1.passed = true;

    })


    test('[TEST 2]: Incorrect File Type — Paystub uploaded into Financial step', {
        tag: ['@regression', '@simulator', '@financial', '@qa-320'],
    }, async ({ page }) => {

        await adminLoginAndNavigateToApplications(page, admin);
        const { sessionData, link } = await generateSessionForApplication(page, APPLICATION_NAME, userData);
        const session = sessionData.data;
        cleanupData.test2.sessionId = session.id;

        await logout(page);

        await page.waitForTimeout(1000)
        await page.goto(link.replace('https://dev.verifast.app', app.urls.app));
        await handleOptionalTermsCheckbox(page);
        await updateRentBudget(page, session.id, '1500');

        const financialStep = page.getByTestId('financial-verification-step');
        await expect(financialStep).toBeVisible();

        page.once('dialog', async dialog => {
            await dialog.accept(JSON.stringify({ documents: [createPaystubData()] }))
        })

        const uploadBtn = page.getByTestId('financial-upload-statement-btn');
        await uploadBtn.click();
        await page.waitForTimeout(500);
        const acknowledgementBtn = page.getByTestId('acknowledge-upload-statement-btn');
        if (await acknowledgementBtn.isVisible()) {
            await acknowledgementBtn.click();
        }
        const connectBtn = page.getByTestId('connect-bank');
        const postFinancialPromise = page.waitForResponse(resp =>
            resp.url().includes('/financial-verifications') &&
            resp.request().method() === 'POST' &&
            resp.ok(), { timeout: 20_000 }
        );
        await connectBtn.click();
        const financialResponse = await postFinancialPromise;
        const { data: financialVerification } = await waitForJsonResponse(financialResponse);

        await page.waitForTimeout(5000);

        const flagError = 'No transaction history was found in the linked bank account to verify income.';
        const stepError = '';

        const errorsEle = page.getByTestId('financial-row-verification-errors');
        await expect(errorsEle).toContainText(stepError);

        const continueBtn = page.getByTestId('financial-verification-continue-btn');
        await expect(continueBtn).toBeVisible();


        const stepPromise = page.waitForResponse(resp =>
            resp.url().includes(`/sessions/${session.id}/steps/`) &&
            resp.request().method() === 'PATCH' &&
            resp.ok()
        );
        await continueBtn.click();
        await stepPromise;

        await page.waitForTimeout(5_000);

        await page.reload();

        const statusTile = page.getByTestId('step-FINANCIAL_VERIFICATION-lg').filter({ visible: true });

        await expect(statusTile.getByTestId('step-status')).toHaveText('Incomplete');

        const summaryFailedSection = page.getByTestId('summary-failed-section');
        await expect(summaryFailedSection).toBeVisible({ timeout: 20_000 });

        const verificationFlagsEle = page.getByTestId('financial-verification-flags')
        await expect(verificationFlagsEle).toBeVisible({ timeout: 20_000 });

        await expect(verificationFlagsEle).toContainText(flagError);

        await guestLogout(page);

        await page.goto('/');

        await loginForm.adminLoginAndNavigate(page, admin);

        await page.goto(`/applicants/all/${session.id}`);

        await expect(page.getByTestId('session-report-section')).toBeVisible()

        const householdRow = page.getByTestId(`raw-${session.id}`);
        await expect(householdRow).toBeVisible();
        const financialVerificationStatus = householdRow.getByTestId('raw-financial-verification-status')

        await financialVerificationStatus.click()

        const connectionStatusModal = page.getByTestId('report-financial-status-modal')
        await expect(connectionStatusModal).toBeVisible();

        const connRow = connectionStatusModal.getByTestId('connection-row')
        await expect(connRow).toContainText(stepError)

        const missingTransactionFlag = connectionStatusModal.getByTestId('MISSING_TRANSACTIONS')
        await expect(missingTransactionFlag).toBeVisible();
        await expect(missingTransactionFlag).toContainText(flagError);

        const sessionEventApi = sessionApi.event(session.id);
        const eventsData = await sessionEventApi.get({
            'fields[session_event]': ':all',
            filters: JSON.stringify({
                "$has": {
                    "entity": {
                        "id": financialVerification.id,
                    }
                },
                "event": {
                    "$in": ["document.rejected", "document.failed", "file.extraction.failed"]
                }
            })
        })
        const sessionEvents = eventsData.data;
        const docEvent = sessionEvents.find(event => 'document.rejected' === event.event)
        expect(docEvent).toBeDefined();
        expect(Array.isArray(docEvent.changes?.failed_conditions)).toBeTruthy();
        const condition = docEvent.changes.failed_conditions.find(cond => cond.flag?.key === 'BANK_STATEMENT_TRANSACTIONS_OLDER_THAN_6_MONTHS');
        expect(condition).toBeDefined();

        cleanupData.test2.passed = true;

    })


    test('[TEST 3]: Account Name Mismatch (CRITICAL flag, use complete different name)', async ({ page }) => {

        await adminLoginAndNavigateToApplications(page, admin);

        const { sessionData, link } = await generateSessionForApplication(page, APPLICATION_NAME, userData, { prefix: false });
        const session = sessionData.data;
        cleanupData.test3.sessionId = session.id;

        await logout(page);

        await page.waitForTimeout(1000)

        await page.goto(link.replace('https://dev.verifast.app', app.urls.app));

        await handleOptionalTermsCheckbox(page);

        await updateRentBudget(page, session.id, '1500');

        const financialStep = page.getByTestId('financial-verification-step');

        await expect(financialStep).toBeVisible();


        const uploadDocBtn = page.getByTestId('financial-upload-statement-btn');
        await uploadDocBtn.click();

        await page.waitForTimeout(2000);

        const acknowledgementBtn = page.getByTestId('acknowledge-upload-statement-btn');
        if (await acknowledgementBtn.isVisible()) {
            await acknowledgementBtn.click();
        }
        page.on('dialog', async dialog => {
            await dialog.accept(JSON.stringify(getVeridocsBankStatementPayload({
                first_name: 'Completely',
                last_name: 'Different',
                email: getRandomEmail(),
            })));
        });


        const uploadFileBtn = page.getByTestId('connect-bank');

        const postFinancialPromise = page.waitForResponse(resp =>
            resp.url().includes('/financial-verifications') &&
            resp.request().method() === 'POST' &&
            resp.ok()
        );

        await uploadFileBtn.click();

        const financialResponse = await postFinancialPromise;
        const { data: financialVerification } = await waitForJsonResponse(financialResponse);

        await page.waitForTimeout(5000);

        const flagError = 'No Bank Transactions Found';
        const stepError = 'The name on the uploaded bank statement does not match the applicant\'s name.';

        const errorsEle = page.getByTestId('financial-row-verification-errors');
        await expect(errorsEle).toContainText(stepError);

        // const financialVerificationPromise = async response => {
        //     returnresponse.url().includes(`/financial-verifications/${financialVerification.id}`) &&
        //         response.request().method() === 'GET' &&
        //         response.ok()
        // }


        const continueBtn = page.getByTestId('financial-verification-continue-btn');
        await expect(continueBtn).toBeVisible();


        const stepPromise = page.waitForResponse(resp =>
            resp.url().includes(`/sessions/${session.id}/steps/`) &&
            resp.request().method() === 'PATCH' &&
            resp.ok()
        );
        await continueBtn.click();
        await stepPromise;

        await page.waitForTimeout(5_000);

        await page.reload();

        const statusTile = page.getByTestId('step-FINANCIAL_VERIFICATION-lg').filter({ visible: true });

        await expect(statusTile.getByTestId('step-status')).toHaveText('Incomplete');

        const summaryFailedSection = page.getByTestId('summary-failed-section');
        await expect(summaryFailedSection).toBeVisible({ timeout: 20_000 });

        const verificationFlagsEle = page.getByTestId('financial-verification-flags')
        await expect(verificationFlagsEle).toBeVisible({ timeout: 20_000 });

        await expect(verificationFlagsEle).toContainText(flagError);

        await guestLogout(page);

        await page.goto('/');

        await loginForm.adminLoginAndNavigate(page, admin);

        await page.goto(`/applicants/all/${session.id}`);

        await expect(page.getByTestId('session-report-section')).toBeVisible()
        await page.waitForTimeout(2000);
        const householdRow = page.getByTestId(`raw-${session.id}`);
        await expect(householdRow).toBeVisible();
        const financialVerificationStatus = householdRow.getByTestId('raw-financial-verification-status')

        await financialVerificationStatus.click()

        const connectionStatusModal = page.getByTestId('report-financial-status-modal')
        await expect(connectionStatusModal).toBeVisible();

        const connRow = connectionStatusModal.getByTestId('connection-row')
        await expect(connRow).toContainText(stepError)

        const missingTransactionFlag = connectionStatusModal.getByTestId('MISSING_TRANSACTIONS')
        await expect(missingTransactionFlag).toBeVisible();
        await expect(missingTransactionFlag).toContainText(flagError);

        const sessionEventApi = sessionApi.event(session.id);
        const eventsData = await sessionEventApi.get({
            'fields[session_event]': ':all',
            filters: JSON.stringify({
                "$has": {
                    "entity": {
                        "id": financialVerification.id,
                    }
                },
                "event": {
                    "$in": ["document.rejected", "document.failed", "file.extraction.failed"]
                }
            })
        })
        const sessionEvents = eventsData.data;
        const docEvent = sessionEvents.find(event => 'document.rejected' === event.event)
        expect(docEvent).toBeDefined();
        expect(Array.isArray(docEvent.changes?.failed_conditions)).toBeTruthy();
        const condition = docEvent.changes.failed_conditions.find(cond => cond.flag?.key === 'BANK_STATEMENT_ACCOUNT_NAME_MISMATCH');
        expect(condition).toBeDefined();
        cleanupData.test3.passed = true;

    })

    test('[TEST 4]: Missing Financial Transactions', async ({ page }) => {
        test.setTimeout(180_000);
        await adminLoginAndNavigateToApplications(page, admin);

        const { sessionData, link } = await generateSessionForApplication(page, APPLICATION_NAME, userData, { prefix: false });
        const session = sessionData.data;
        cleanupData.test4.sessionId = session.id;

        await logout(page);

        await page.waitForTimeout(1000)

        await page.goto(link.replace('https://dev.verifast.app', app.urls.app));

        await handleOptionalTermsCheckbox(page);

        await updateRentBudget(page, session.id, '1500');

        const financialStep = page.getByTestId('financial-verification-step');

        await expect(financialStep).toBeVisible();


        const uploadDocBtn = page.getByTestId('financial-upload-statement-btn');
        await uploadDocBtn.click();

        await page.waitForTimeout(2000);

        const acknowledgementBtn = page.getByTestId('acknowledge-upload-statement-btn');
        if (await acknowledgementBtn.isVisible()) {
            await acknowledgementBtn.click();
        }
        page.on('dialog', async dialog => {
            const bankStatementData = getVeridocsBankStatementPayload(userData)
            bankStatementData.documents[0].documents[0].data.accounts[0].transactions = [];
            bankStatementData.documents[0].documents[0].data.accounts[0].totalCredits = 0;
            bankStatementData.documents[0].documents[0].data.accounts[0].totalDebits = 0;
            await dialog.accept(JSON.stringify(bankStatementData));
        });


        const uploadFileBtn = page.getByTestId('connect-bank');

        const postFinancialPromise = page.waitForResponse(resp =>
            resp.url().includes('/financial-verifications') &&
            resp.request().method() === 'POST' &&
            resp.ok()
        );

        await uploadFileBtn.click();

        const financialResponse = await postFinancialPromise;
        const { data: financialVerification } = await waitForJsonResponse(financialResponse);

        await page.waitForTimeout(8000);

        const flagError = 'No Bank Transactions Found';
        const stepError = 'The uploaded statement does not contain any recent transaction history or appears to be blank.';

        const errorsEle = page.getByTestId('financial-row-verification-errors');
        await expect(errorsEle).toContainText(stepError);

        // const financialVerificationPromise = async response => {
        //     returnresponse.url().includes(`/financial-verifications/${financialVerification.id}`) &&
        //         response.request().method() === 'GET' &&
        //         response.ok()
        // }


        const continueBtn = page.getByTestId('financial-verification-continue-btn');
        await expect(continueBtn).toBeVisible();


        const stepPromise = page.waitForResponse(resp =>
            resp.url().includes(`/sessions/${session.id}/steps/`) &&
            resp.request().method() === 'PATCH' &&
            resp.ok()
        );
        await continueBtn.click();
        await stepPromise;

        await page.waitForTimeout(5_000);

        await page.reload();

        const statusTile = page.getByTestId('step-FINANCIAL_VERIFICATION-lg').filter({ visible: true });

        await expect(statusTile.getByTestId('step-status')).toHaveText('Incomplete');

        const summaryFailedSection = page.getByTestId('summary-failed-section');
        await expect(summaryFailedSection).toBeVisible({ timeout: 20_000 });

        const verificationFlagsEle = page.getByTestId('financial-verification-flags')
        await expect(verificationFlagsEle).toBeVisible({ timeout: 20_000 });

        await expect(verificationFlagsEle).toContainText(flagError);

        await guestLogout(page);
        await page.waitForTimeout(1000);
        await page.goto('/');

        await loginForm.adminLoginAndNavigate(page, admin);

        await page.goto(`/applicants/all/${session.id}`);

        await expect(page.getByTestId('session-report-section')).toBeVisible()
        await page.waitForTimeout(2000);
        const householdRow = page.getByTestId(`raw-${session.id}`);
        await expect(householdRow).toBeVisible();
        const financialVerificationStatus = householdRow.getByTestId('raw-financial-verification-status')

        await financialVerificationStatus.click()

        const connectionStatusModal = page.getByTestId('report-financial-status-modal')
        await expect(connectionStatusModal).toBeVisible();

        const connRow = connectionStatusModal.getByTestId('connection-row')
        await expect(connRow).toContainText(stepError)

        const missingTransactionFlag = connectionStatusModal.getByTestId('MISSING_TRANSACTIONS')
        await expect(missingTransactionFlag).toBeVisible();
        await expect(missingTransactionFlag).toContainText(flagError);

        const sessionEventApi = sessionApi.event(session.id);
        const eventsData = await sessionEventApi.get({
            'fields[session_event]': ':all',
            filters: JSON.stringify({
                "$has": {
                    "entity": {
                        "id": financialVerification.id,
                    }
                },
                "event": {
                    "$in": ["document.rejected", "document.failed", "file.extraction.failed"]
                }
            })
        })
        const sessionEvents = eventsData.data;
        const docEvent = sessionEvents.find(event => 'document.rejected' === event.event)
        expect(docEvent).toBeDefined();
        expect(Array.isArray(docEvent.changes?.failed_conditions)).toBeTruthy();
        const condition = docEvent.changes.failed_conditions.find(cond => cond.flag?.key === 'BANK_STATEMENT_MISSING_TRANSACTIONS');
        expect(condition).toBeDefined();
        cleanupData.test4.passed = true;
    })

    test('[TEST 5]: Document Count Exceeded (UI-side limit)', async ({ page }) => {
        test.setTimeout(180_000);
        await adminLoginAndNavigateToApplications(page, admin);

        const { sessionData, link } = await generateSessionForApplication(page, APPLICATION_NAME, userData, { prefix: false });
        const session = sessionData.data;
        cleanupData.test5.sessionId = session.id;

        await logout(page);

        await page.waitForTimeout(1000)

        await page.goto(link.replace('https://dev.verifast.app', app.urls.app));

        await handleOptionalTermsCheckbox(page);

        await updateRentBudget(page, session.id, '1500');

        const financialStep = page.getByTestId('financial-verification-step');

        await expect(financialStep).toBeVisible();


        const uploadDocBtn = page.getByTestId('financial-upload-statement-btn');
        await uploadDocBtn.click();

        await page.waitForTimeout(2000);

        const acknowledgementBtn = page.getByTestId('acknowledge-upload-statement-btn');
        if (await acknowledgementBtn.isVisible()) {
            await acknowledgementBtn.click();
        }
        page.once('dialog', async dialog => {
            const bankStatementData = getVeridocsBankStatementPayload(userData)
            await dialog.accept(JSON.stringify(bankStatementData));
        });


        const uploadFileBtn = page.getByTestId('connect-bank');

        const postFinancialPromise = page.waitForResponse(resp =>
            resp.url().includes('/financial-verifications') &&
            resp.request().method() === 'POST' &&
            resp.ok()
        );

        await uploadFileBtn.click();

        const financialResponse = await postFinancialPromise;
        const { data: financialVerification } = await waitForJsonResponse(financialResponse);

        await page.waitForTimeout(2000);

        await uploadDocBtn.click();
        await uploadFileBtn.click();
        const documentData1 = getVeridocsBankStatementPayload(userData, {
            numTransactions: 6,
            daysAgoEnd: 190,
            daysGap: 7,
            initialBalance: 18000,
            incomeAmount: 1200,
            expenseAmount: 180
        })
        await page.waitForTimeout(2000);

        const secondResponse = await uploadDocument(page, uploadDocBtn, uploadFileBtn, documentData1);
        expect(secondResponse.ok()).toBeTruthy();

        await page.waitForTimeout(2000);
        const documentData2 = getVeridocsBankStatementPayload(userData, {
            numTransactions: 4,
            daysAgoEnd: 10,
            daysGap: 3,
            initialBalance: 18900,
            incomeAmount: 1100,
            expenseAmount: 90
        })
        const thirdResponse = await uploadDocument(page, uploadDocBtn, uploadFileBtn, documentData2);
        expect(thirdResponse.status()).toBe(400);
        const errorResponse = await waitForJsonResponse(thirdResponse);
        const cancelUploadBtn = page.getByTestId('cancel-manual-upload-btn');
        await expect(cancelUploadBtn).toBeVisible();
        await cancelUploadBtn.click();

        console.log("🚀 ~ errorResponse.error:", errorResponse.error)
        expect(errorResponse.error?.detail).toBe('The maximum number of connections has been reached');
        cleanupData.test5.passed = true;
    })




    test.afterAll(async ({ request }, testInfo) => {
        // Cleanup: Delete the session created for the test
        if (cleanupData.test1.sessionId && cleanupData.test1.passed) {
            console.log(`Cleaning up session with ID: ${cleanupData.test1.sessionId}`);
            await cleanupSession(request, cleanupData.test1.sessionId, true);
        }
        if (cleanupData.test2.sessionId && cleanupData.test2.passed) {
            console.log(`Cleaning up session with ID: ${cleanupData.test2.sessionId}`);
            await cleanupSession(request, cleanupData.test2.sessionId, true);
        }
        if (cleanupData.test3.sessionId && cleanupData.test3.passed) {
            console.log(`Cleaning up session with ID: ${cleanupData.test3.sessionId}`);
            await cleanupSession(request, cleanupData.test3.sessionId, true);
        }
        if (cleanupData.test4.sessionId && cleanupData.test4.passed) {
            console.log(`Cleaning up session with ID: ${cleanupData.test4.sessionId}`);
            await cleanupSession(request, cleanupData.test4.sessionId, true);
        }
        if (cleanupData.test5.sessionId) {
            console.log(`Cleaning up session with ID: ${cleanupData.test5.sessionId}`);
            await cleanupSession(request, cleanupData.test5.sessionId, true);
        }
    })

})

async function uploadDocument(page, uploadDocBtn, uploadFileBtn, documentData) {
    page.once('dialog', async dialog => {
        await dialog.accept(JSON.stringify(documentData))
    });
    await uploadDocBtn.click();
    await page.waitForTimeout(500);

    const financialPromise = page.waitForResponse(resp =>
        resp.url().includes('/financial-verifications') &&
        resp.request().method() === 'POST',
        { timeout: 20_000 });

    await uploadFileBtn.click();

    const financialResponse = await financialPromise;
    return financialResponse;

}
