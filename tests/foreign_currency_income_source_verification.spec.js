import { expect, test } from "./fixtures/api-data-fixture";
import { admin, app } from "./test_config";
import { cleanupTrackedSessions } from "./utils/cleanup-helper";
import generateSessionForm from "./utils/generate-session-form";
import { findAndInviteApplication } from "./utils/applications-page";
import { adminLoginAndNavigateToApplications } from "./utils/session-utils";
import { setupInviteLinkSession, updateRentBudget } from "./utils/session-flow";
import { generateUUID, joinUrl } from "./utils/helper";
import { getVeridocsBankStatementPayload } from "./mock-data/permission-test-simulators";
import { openReportSection } from "./utils/report-page";
import { waitForJsonResponse } from "./utils/wait-response";

let createdSessionIds = [];
let applicantContextForCleanup = null;

const appName = 'AutoTest - Simulation financial employment';

test.describe('QA-365: Foreign Currency Income Source Verification', () => {
    test.describe.configure({
        mode: 'serial',
        timeout: 240000
    });

    test.afterEach(async ({ request }, testInfo) => {
        // if(testInfo.status === testInfo.expectedStatus) {
            console.log(`✅ Test passed: ${testInfo.title}`);
            await cleanupTrackedSessions({ request, sessionIds: createdSessionIds, testInfo });
            if (applicantContextForCleanup) {
                await applicantContextForCleanup.close().catch(() => { });
                applicantContextForCleanup = null;
            }
        // }
    });

    test('CAD Bank Statement with Foreign Currency Badge and Modal', {
        tag: ['@regression', '@staging-ready', '@rc-ready'],
        timeout: 240_000
    }, async ({ page, browser, dataManager }) => {

        /** Test ID elements
         * data-testid="income-source-section-header" - Income Source section header
         * data-testid="applicant-income-source-{applicant.id}" - Applicant income source container
         * data-testid="income-source-{incomeSource.id}" - Income source item
         * data-testid="source-{incomeSource.id}-foreign-currency-badge" - Foreign currency badge
         * data-testid="foreign-currency-modal" - Foreign currency modal
         * data-testid="foreign-currency-modal-title" - Modal title
         * data-testid="foreign-currency-table" - Transaction table
         * data-testid="foreign-currency-table-header" - Table header
         * data-testid="foreign-currency-table-body" - Table body
         * data-testid="foreign-currency-transaction-row-{transaction.id}" - Transaction row
         * data-testid="foreign-currency-modal-close-btn" - Modal close button
         */

        // ============================================================
        // STEP 1: Create Session with CAD Bank Statement
        // ============================================================
        console.log('\n🏗️ STEP 1: Creating session with CAD bank statement...');

        // Authenticate
        console.log('🔑 Authenticating admin user...');
        await dataManager.authenticate(admin.email, admin.password);

        // Login to UI
        console.log('🔐 Logging in as admin and navigating to applications...');
        await adminLoginAndNavigateToApplications(page, admin);

        // Find and invite application
        console.log(`🔍 Finding application: "${appName}"`);
        await findAndInviteApplication(page, appName);

        // Generate session with user data
        const timestamp = Date.now();
        const user = {
            first_name: 'Foreign',
            last_name: 'Currency',
            email: `test-foreign-${timestamp}@verifast.com`
        };

        console.log('📝 Generating session...');
        const { sessionId, link } = await generateSessionForm.generateSessionAndExtractLink(page, user);
        createdSessionIds.push(sessionId);
        console.log(`✅ Session created: ${sessionId}`);

        // Start applicant flow
        console.log('🌐 Starting applicant session flow...');
        const linkUrl = new URL(link);
        const applicantContext = await browser.newContext();
        applicantContextForCleanup = applicantContext;
        const applicantPage = await applicantContext.newPage();
        const gotoUrl = joinUrl(app.urls.app, `${linkUrl.pathname}${linkUrl.search}`);
        await applicantPage.goto(gotoUrl);

        // Complete initial setup
        console.log('⚙️ Setting up applicant session...');
        await setupInviteLinkSession(applicantPage);
        await updateRentBudget(applicantPage, sessionId, '2500');

        // Get guest auth token for API calls
        console.log('🔑 Getting guest authentication token...');
        const guestToken = linkUrl.searchParams.get('token');

        const authResponse = await applicantPage.request.post(`${app.urls.api}/auth/guests`, {
            data: { token: guestToken, uuid: generateUUID(), os: 'web' }
        });
        const auth = await authResponse.json();
        const authToken = auth.data.token;
        console.log('✅ Guest authenticated');

        // Wait for financial step
        console.log('⏳ Waiting for Financial Verification step...');
        await waitForFinancialStep(applicantPage, sessionId, authToken);

        // Generate custom VERIDOCS_PAYLOAD with CAD currency
        console.log('📄 Generating custom VERIDOCS_PAYLOAD with CAD currency...');
        const customVeridocsPayload = getVeridocsBankStatementPayload({
            first_name: 'Foreign',
            last_name: 'Currency',
            email: `test-foreign-${Date.now()}@verifast.com`
        }, {
            currencyDetails: {
                original_currency: 'CAD',
                conversion_rate: 1.25,
                conversion_currency: 'USD'
            }
        });

        // Modify currency fields to CAD
        customVeridocsPayload.documents[0].documents[0].data.bank_account_currency = "CAD";
        customVeridocsPayload.documents[0].documents[0].data.bank_country = "CA";
        customVeridocsPayload.documents[0].documents[0].data.conversion_rate = 1.25; // Example conversion rate
        
        console.log('✅ CAD currency payload generated');

        // Submit financial verification using simulator with CAD payload
        console.log('🚀 Submitting financial verification via simulator...');
        await submitFinancialVerification(applicantPage, applicantContext, sessionId, authToken, customVeridocsPayload);
        console.log('✅ Financial verification submitted successfully');

        // DO NOT complete employment step - income sources will be auto-generated
        console.log('⏭️ Skipping employment step (income sources auto-generated from financial data)');

        await applicantPage.close();

        // ============================================================
        // STEP 2: Navigate to Income Source Section
        // ============================================================
        console.log('\n🗂️ STEP 2: Navigating to session report...');
        await page.bringToFront();

        // Navigate to applicants page
        await page.getByTestId('applicants-menu').click();
        await page.getByTestId('applicants-submenu').click();
        await page.waitForTimeout(1500);

        // Open session report via URL
        const reportUrl = joinUrl(app.urls.app, `applicants/all/${sessionId}`);
        console.log(`📊 Opening report: ${reportUrl}`);
        await page.goto(reportUrl);
        await page.waitForTimeout(2000);
        console.log('✅ Report page loaded');

        // Wait for Income Source section to load
        console.log('⏳ Waiting for Income Source section...');
        console.log("📥 Waiting for income source API and opening section...");
        const [incomeSourceResponse, incomeSourceSection] = await Promise.all([
            page.waitForResponse(
                (resp) =>
                    resp.url().includes("/income-sources?fields[income_source]=") &&
                    resp.request().method() === "GET" &&
                    resp.ok()
            ),
            openReportSection(page, "income-source-section"),
        ]);
        const { data: incomeSources } = await waitForJsonResponse(incomeSourceResponse);
        await expect(incomeSources.length).toBeGreaterThan(0);
        await expect(incomeSourceSection).toBeVisible({ timeout: 20_000 });
        console.log('✅ Income Source section expanded');

        // Wait for income sources to populate
        await page.waitForTimeout(2000);

        // ============================================================
        // STEP 3: Verify Foreign Currency Badge Displays
        // ============================================================
        console.log('\n💱 STEP 3: Verifying foreign currency badge displays...');

        // Locate the applicant container
        const applicantContainers = page.locator('[data-testid^="applicant-income-source-"]');
        await expect(applicantContainers.first()).toBeVisible({ timeout: 10_000 });

        const applicantTestId = await applicantContainers.first().getAttribute('data-testid');
        const applicantId = applicantTestId?.replace('applicant-income-source-', '');
        console.log(`📌 Found applicant income source with ID: ${applicantId}`);

        // Find the income source item
        const incomeSource = incomeSources[0]
        const incomeSourceItem = page.getByTestId(`income-source-${incomeSource.id}`);
        await expect(incomeSourceItem).toBeVisible({ timeout: 10_000 });
        console.log(`📌 Found income source item with ID: ${incomeSource.id}`);

        // Locate the foreign currency badge
        const foreignCurrencyBadge = page.getByTestId(`source-${incomeSource.id}-foreign-currency-badge`);
        await expect(foreignCurrencyBadge).toBeVisible({ timeout: 10_000 });
        console.log('✅ Foreign currency badge is visible');

        // Verify badge text displays currency conversion format (e.g., "CAD → USD")
        const badgeText = await foreignCurrencyBadge.textContent();
        console.log(`📝 Badge text: "${badgeText}"`);
        expect(badgeText).toContain('CAD');
        expect(badgeText).toContain('USD');
        expect(badgeText).toContain('→');
        console.log('✅ Badge displays currency conversion format: CAD → USD');

        // Verify badge has warning styling (bg-warning-light text-warning)
        const badgeClasses = await foreignCurrencyBadge.getAttribute('class');
        expect(badgeClasses).toContain('bg-warning-light');
        expect(badgeClasses).toContain('text-warning');
        console.log('✅ Badge has warning styling (bg-warning-light text-warning)');

        // ============================================================
        // STEP 4: Verify API Response Contains Currency Conversion Data
        // ============================================================
        console.log('\n🔍 STEP 4: Verifying API response contains currency conversion data...');

        // Intercept GET /sessions/{sessionId}/transactions
        const transactionsPromise = page.waitForResponse(
            resp => resp.url().includes(`/sessions/${sessionId}/transactions`) &&
                resp.request().method() === 'GET' &&
                resp.ok()
        );

        // Trigger API call by refreshing
        await page.reload();
        await page.waitForTimeout(2000);

        const transactionsResponse = await transactionsPromise;
        console.log(`📡 Intercepted GET /sessions/${sessionId}/transactions`);

        // Verify response status: 200
        expect(transactionsResponse.status()).toBe(200);
        console.log('✅ Response status: 200');

        // Parse response body
        const transactionsData = await transactionsResponse.json();
        console.log('📦 Response data:', JSON.stringify(transactionsData, null, 2));

        // Verify response body contains transactions with currency conversion data
        expect(transactionsData.data).toBeDefined();
        expect(transactionsData.data.length).toBeGreaterThan(0);

        const transaction = transactionsData.data[0];

        // Payload must exist for a CAD transaction
        expect(transaction.payload).toBeDefined();

        // Top-level payload fields
        expect(transaction.payload.original_currency).toBe('CAD');
        expect(transaction.payload.conversion_currency).toBe('USD');
        expect(typeof transaction.payload.conversion_rate).toBe('number');
        expect(typeof transaction.payload.amount).toBe('number');

        // original_data mirrors the raw source values
        expect(transaction.payload.original_data).toBeDefined();
        expect(transaction.payload.original_data.original_currency).toBe('CAD');
        expect(transaction.payload.original_data.conversion_currency).toBe('USD');
        expect(typeof transaction.payload.original_data.conversion_rate).toBe('number');
        expect(typeof transaction.payload.original_data.amount).toBe('number');

        console.log('✅ Transaction payload contains conversion data:');
        console.log(`   - original_currency: ${transaction.payload.original_currency}`);
        console.log(`   - conversion_currency: ${transaction.payload.conversion_currency}`);
        console.log(`   - conversion_rate: ${transaction.payload.conversion_rate}`);
        console.log(`   - amount (original CAD): ${transaction.payload.amount}`);
        console.log(`   - original_data.amount: ${transaction.payload.original_data.amount}`);

        // ============================================================
        // STEP 5: Click Badge and Verify Modal Opens
        // ============================================================
        console.log('\n🪟 STEP 5: Clicking badge and verifying modal opens...');

        // Re-expand income source section after reload
        await openReportSection(page, "income-source-section");
        await page.waitForTimeout(1000);


        const foreignCurrencyBadgeReload = page.getByTestId(`source-${incomeSource.id}-foreign-currency-badge`);
        await expect(foreignCurrencyBadgeReload).toBeVisible({ timeout: 10_000 });

        // Click the foreign currency badge
        console.log('🖱️ Clicking foreign currency badge...');
        await foreignCurrencyBadgeReload.click();
        await page.waitForTimeout(1000);

        // Wait for modal to appear
        const modal = page.getByTestId('foreign-currency-modal');
        await expect(modal).toBeVisible({ timeout: 10_000 });
        console.log('✅ Modal is visible');

        // Verify modal title is visible
        const modalTitle = page.getByTestId('foreign-currency-modal-title');
        await expect(modalTitle).toBeVisible();
        console.log('✅ Modal title is visible');

        // Verify modal title text
        const modalTitleText = await modalTitle;
        await expect(modalTitleText).toHaveText(/Foreign Currency Transaction Details/);
        console.log('✅ Modal title text: "Foreign Currency Transaction Details"');

        // Verify table is visible
        const table = page.getByTestId('foreign-currency-table');
        await expect(table).toBeVisible();
        console.log('✅ Table is visible');

        // Verify table header exists
        const tableHeader = page.getByTestId('foreign-currency-table-header');
        await expect(tableHeader).toBeVisible();
        console.log('✅ Table header exists');

        // Verify table body exists
        const tableBody = page.getByTestId('foreign-currency-table-body');
        await expect(tableBody).toBeVisible();
        console.log('✅ Table body exists');

        // Verify at least one transaction row exists
        const transactionRows = page.locator('[data-testid^="foreign-currency-transaction-row-"]');
        await expect(transactionRows.first()).toBeVisible({ timeout: 10_000 });
        console.log('✅ At least one transaction row exists');

        // ============================================================
        // STEP 6: Verify Modal Content Displays Conversion Details
        // ============================================================
        console.log('\n📋 STEP 6: Verifying modal content displays conversion details...');

        // Locate first transaction row
        const firstRow = transactionRows.first();
        await expect(firstRow).toBeVisible();
        const currencyCol = await firstRow.getByTestId('foreign-currency-transaction-currency-col').textContent();

        // Verify row shows currency conversion format (e.g., "CAD → USD")
        expect(currencyCol).toContain('CAD');
        expect(currencyCol).toContain('USD');
        expect(currencyCol).toContain('→');
        console.log('✅ Row shows currency conversion format: CAD → USD');

        // Verify "Amount" column shows both original and converted amounts
        const amountCol = await firstRow.getByTestId('foreign-currency-transaction-amount-col').textContent();
        expect(amountCol).toContain('CA$'); // original CAD amount
        expect(amountCol).toContain('$');   // converted USD amount
        console.log('✅ Amount column shows both original (CA$) and converted ($) amounts');

        // Verify "Rate" column shows conversion rate value
        const rateCol = await firstRow.getByTestId('foreign-currency-transaction-conversion-rate-col').textContent();
        expect(rateCol).toMatch(/\d+\.\d+/); // Contains decimal number (rate)
        console.log('✅ Rate column shows conversion rate value');

        // Verify transaction date and conversion date are present
        // (Check for date-like patterns in the row text)
        const dateCol = await firstRow.getByTestId('foreign-currency-transaction-date-col').textContent();
        const hasDatePattern = /\d{1,2}\/\d{1,2}\/\d{4}/.test(dateCol) || /\w{3}\s\d{1,2},\s\d{4}/.test(dateCol);
        expect(hasDatePattern).toBeTruthy();
        console.log('✅ Transaction Date and Date Converted are populated');

        // Click "Close" button
        console.log('🖱️ Clicking close button...');
        const closeBtn = page.getByTestId('foreign-currency-modal-close-btn');
        await expect(closeBtn).toBeVisible();
        await closeBtn.click();
        await page.waitForTimeout(500);

        // Verify modal closes
        await expect(modal).not.toBeVisible();
        console.log('✅ Modal closed successfully');

        console.log('\n✅ ALL STEPS COMPLETED SUCCESSFULLY!');
        console.log('Summary:');
        console.log('  ✓ Session created with CAD bank statement');
        console.log('  ✓ Financial verification submitted via simulator');
        console.log('  ✓ Foreign currency badge displays with CAD → USD format');
        console.log('  ✓ Badge has warning styling');
        console.log('  ✓ API response contains currency conversion data');
        console.log('  ✓ Modal opens with transaction details');
        console.log('  ✓ Modal displays conversion details (amounts, rate, dates)');
        console.log('  ✓ Modal closes successfully');
    });
});

/**
 * Wait for financial verification step to be active
 */
async function waitForFinancialStep(page, sessionId, authToken, maxAttempts = 40) {
    console.log('   ⏳ Polling for FINANCIAL_VERIFICATION step...');

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const sessionResponse = await page.request.get(
            `${app.urls.api}/sessions/${sessionId}`,
            { headers: { Authorization: `Bearer ${authToken}` } }
        );

        const session = await sessionResponse.json();
        const currentStepType = session.data?.state?.current_step?.task?.key;

        if (currentStepType === 'FINANCIAL_VERIFICATION') {
            console.log('   ✅ On FINANCIAL_VERIFICATION step');
            return session.data.state.current_step;
        }

        if (attempt < maxAttempts - 1) {
            await page.waitForTimeout(3000);
        }
    }

    throw new Error('Timeout: Financial step never became active');
}

/**
 * Submit financial verification using VeriDocs provider
 */
async function submitFinancialVerification(page, context, sessionId, authToken, veridocsPayload) {
    // Get current session to get step ID
    const sessionResponse = await page.request.get(`${app.urls.api}/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
    });
    const session = await sessionResponse.json();
    const currentStepId = session.data.state.current_step.id;

    // Create session step
    console.log('   📝 Creating financial session step...');
    const stepResponse = await page.request.post(
        `${app.urls.api}/sessions/${sessionId}/steps`,
        {
            headers: { Authorization: `Bearer ${authToken}` },
            data: { step: currentStepId }
        }
    );
    const stepData = await stepResponse.json();
    const step = stepData.data;
    console.log(`   ✅ Financial step created: ${step.id}`);

    // Get VeriDocs Simulation provider
    console.log('   🔍 Getting VeriDocs Simulation provider...');
    const providersResponse = await page.request.get(`${app.urls.api}/providers`, {
        headers: { Authorization: `Bearer ${authToken}` }
    });
    const providers = await providersResponse.json();
    const veridocsProvider = providers.data.find(p => p.name === 'Simulation');

    if (!veridocsProvider) {
        throw new Error('VeriDocs Simulation provider not found');
    }
    console.log(`   ✅ VeriDocs Simulation provider: ${veridocsProvider.id}`);

    // Create financial verification with VERIDOCS_PAYLOAD
    console.log('   🚀 Uploading financial data via VERIDOCS_PAYLOAD...');
    const verificationResponse = await page.request.post(
        `${app.urls.api}/financial-verifications`,
        {
            headers: { Authorization: `Bearer ${authToken}` },
            data: {
                step: step.id,
                provider: veridocsProvider.id,
                simulation_type: 'VERIDOCS_PAYLOAD',
                custom_payload: veridocsPayload
            }
        }
    );

    if (!verificationResponse.ok()) {
        const errorData = await verificationResponse.json();
        throw new Error(`Financial verification failed: ${JSON.stringify(errorData)}`);
    }

    const verification = await verificationResponse.json();
    console.log(`   ✅ Verification created: ${verification.data.id}`);

    // Wait for verification to complete
    console.log('   ⏳ Waiting for verification to complete...');
    await waitForVerificationComplete(context, authToken, verification.data.id);
    console.log('   ✅ Financial verification COMPLETED');

    // Mark step as COMPLETED
    console.log('   📝 Marking financial step as COMPLETED...');
    await context.request.patch(
        `${app.urls.api}/sessions/${sessionId}/steps/${step.id}`,
        {
            headers: { Authorization: `Bearer ${authToken}` },
            data: { status: 'COMPLETED' }
        }
    );
    console.log('   ✅ Financial step marked as COMPLETED');
}

/**
 * Wait for verification to reach COMPLETED status
 */
async function waitForVerificationComplete(context, authToken, verificationId, maxAttempts = 40) {
    for (let i = 0; i < maxAttempts; i++) {
        const response = await context.request.get(
            `${app.urls.api}/financial-verifications/${verificationId}`,
            { headers: { Authorization: `Bearer ${authToken}` } }
        );

        const data = await response.json();
        const status = data.data.status;

        if (status === 'COMPLETED') {
            return;
        }

        if (status === 'FAILED' || status === 'ERROR') {
            throw new Error(`Verification failed with status: ${status}`);
        }

        if (i < maxAttempts - 1) {
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    throw new Error('Timeout: Verification never completed');
}
