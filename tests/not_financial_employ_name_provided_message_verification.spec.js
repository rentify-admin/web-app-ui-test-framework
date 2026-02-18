import { expect, test } from "./fixtures/api-data-fixture";
import { admin, app } from "./test_config";
import { cleanupTrackedSessions } from "./utils/cleanup-helper";
import { getAtomicEmploymentPayload, getVeridocsBankStatementPayload } from "./mock-data/permission-test-simulators";
import generateSessionForm from "./utils/generate-session-form";
import { findAndInviteApplication } from "./utils/applications-page";
import { adminLoginAndNavigateToApplications } from "./utils/session-utils";
import { setupInviteLinkSession, updateRentBudget } from "./utils/session-flow";
import { generateUUID, joinUrl } from "./utils/helper";
import { openReportSection } from "./utils/report-page";
import { waitForJsonResponse } from "./utils/wait-response";

let createdSessionIds = [];
let applicantContextForCleanup = null;

const appName = 'AutoTest - Simulation financial employment';

test.describe('QA-364: Employment Verification - Missing Employee Name', () => {
    test.describe.configure({
        mode: 'serial',
        timeout: 240000
    });

    test.afterEach(async ({ request }, testInfo) => {
        await cleanupTrackedSessions({ request, sessionIds: createdSessionIds, testInfo });
        if (applicantContextForCleanup) {
            await applicantContextForCleanup.close().catch(() => { });
            applicantContextForCleanup = null;
        }
    });

    test('Verify "Not provided by institution" message for blank employee name', {
        tag: ['@regression'],
        timeout: 240_000
    }, async ({ page, browser, dataManager }) => {

        // ============================================================
        // STEP 1: Create Session with Blank Employee Name
        // ============================================================
        console.log('\n🏗️ STEP 1: Creating session with blank first/last name...');

        // Authenticate admin
        console.log('🔑 Authenticating admin user...');
        await dataManager.authenticate(admin.email, admin.password);

        // Login to UI and navigate to applications
        console.log('🔐 Logging in as admin and navigating to applications...');
        await adminLoginAndNavigateToApplications(page, admin);

        // Find and invite application
        console.log(`🔍 Finding application: "${appName}"`);
        await findAndInviteApplication(page, appName);

        // Generate session with dummy user data
        const timestamp = Date.now();
        const user = {
            first_name: 'BlankEmployee',
            last_name: 'Test',
            email: `test-blank-employee-${timestamp}@verifast.com`
        };

        console.log('📝 Generating session form...');
        const { sessionId, link } = await generateSessionForm.generateSessionAndExtractLink(page, user);
        createdSessionIds.push(sessionId);
        console.log(`✅ Session created: ${sessionId}`);

        // Open invite link in new browser context
        console.log('🌐 Opening invite link in applicant browser context...');
        const linkUrl = new URL(link);
        const applicantContext = await browser.newContext();
        applicantContextForCleanup = applicantContext;
        const applicantPage = await applicantContext.newPage();
        const gotoUrl = joinUrl(app.urls.app, `${linkUrl.pathname}${linkUrl.search}`);
        await applicantPage.goto(gotoUrl);

        // Complete initial applicant setup (rent budget form)
        console.log('⚙️ Completing initial applicant setup...');
        await setupInviteLinkSession(applicantPage);
        await updateRentBudget(applicantPage, sessionId, '2500');

        // Authenticate as guest to get API token
        console.log('🔑 Getting guest authentication token...');
        const guestToken = linkUrl.searchParams.get('token');
        const authResponse = await applicantPage.request.post(`${app.urls.api}/auth/guests`, {
            data: { token: guestToken, uuid: generateUUID(), os: 'web' }
        });
        const auth = await authResponse.json();
        const authToken = auth.data.token;
        console.log('✅ Guest authenticated');

        // Blank name payload used for both financial and employment
        const blankNameUser = {
            first_name: '',  // ← INTENTIONALLY BLANK
            last_name: '',   // ← INTENTIONALLY BLANK
            email: user.email
        };

        // ============================================================
        // STEP 1A: Complete Financial Step with Blank Name
        // ============================================================
        console.log('\n💳 STEP 1A: Completing financial step with blank first/last name...');
        await waitForStep(applicantPage, sessionId, authToken, 'FINANCIAL_VERIFICATION');

        const financialPayload = getVeridocsBankStatementPayload(user);
        console.log(`✅ Financial payload generated with blank account owner name`);

        await submitFinancialVerification(applicantPage, applicantContext, sessionId, authToken, financialPayload);
        console.log('✅ Financial verification completed');

        // ============================================================
        // STEP 1B: Complete Employment Step with Blank Name
        // ============================================================
        console.log('\n💼 STEP 1B: Completing employment step with blank first/last name...');
        await waitForStep(applicantPage, sessionId, authToken, 'EMPLOYMENT_VERIFICATION');

        const employmentPayload = getAtomicEmploymentPayload(blankNameUser);
        console.log(`✅ Employment payload generated with blank employee name: firstName="${employmentPayload.FETCH_EMPLOYMENT_IDENTITY.response.data[0].identity.firstName}" lastName="${employmentPayload.FETCH_EMPLOYMENT_IDENTITY.response.data[0].identity.lastName}"`);

        await submitEmploymentVerification(applicantPage, applicantContext, sessionId, authToken, employmentPayload);
        console.log('✅ Employment verification completed');

        await applicantPage.close();

        // ============================================================
        // STEP 2: Navigate to Session Report
        // ============================================================
        console.log('\n🗂️ STEP 2: Navigating to session report...');
        await page.bringToFront();

        const reportUrl = joinUrl(app.urls.app, `applicants/all/${sessionId}`);
        console.log(`📊 Opening report: ${reportUrl}`);
        await page.goto(reportUrl);
        await page.waitForTimeout(2000);
        console.log('✅ Report page loaded');

        // ============================================================
        // STEP 3: Expand Employment Section
        // ============================================================
        console.log('\n📋 STEP 3: Expanding employment section...');
        const employmentsPromise = page.waitForResponse(
            resp => resp.url().includes(`/sessions/${sessionId}/employments`) &&
                resp.request().method() === 'GET' &&
                resp.ok()
        );
        const employmentSection = await openReportSection(page, 'employment-section');
        const employmentsResponse = await employmentsPromise;
        await expect(employmentSection).toBeVisible({ timeout: 20_000 });
        console.log('✅ Employment section expanded');
        const employments = await waitForJsonResponse(employmentsResponse)
        await expect(employments.data).toBeDefined();
        await expect(employments.data.length).toBeGreaterThan(0);
        // ============================================================
        // STEP 4: Verify "Not Provided" Message for Employee Name
        // ============================================================
        console.log('\n✅ STEP 4: Verifying "Not provided by institution" message...');

        const employmentContainer = page.getByTestId(`applicant-employment-${sessionId}`);
        await expect(employmentContainer).toBeVisible({ timeout: 10_000 });
        console.log(`📌 Found employment record with session ID: ${sessionId}`);

        // Verify employee name cell
        const employmentId = employments.data[0].id;
        const employeeCell = page.getByTestId(`employment-table-employee-cell-${employmentId}`);
        await expect(employeeCell).toBeVisible({ timeout: 10_000 });

        const employeeCellText = await employeeCell.textContent();
        console.log(`📝 Employee name cell content: "${employeeCellText}"`);

        // Assert: shows "Not provided by institution"
        expect(employeeCellText?.trim()).toBe('Not provided by institution');
        console.log('✅ Employee name cell displays: "Not provided by institution"');

        // Assert: NOT blank or empty
        expect(employeeCellText?.trim().length).toBeGreaterThan(0);
        console.log('✅ Employee name cell is NOT blank/empty');

        // ============================================================
        // STEP 5: Verify API Response Contains Null Employee Name
        // ============================================================
        console.log('\n🔍 STEP 5: Verifying API response for null employee name...');


        const employmentRecord = employments.data[0];

        // Verify employee_name is null or empty
        const employeeName = employmentRecord.employee_name;
        console.log(`👤 employee_name in API: ${employeeName === null ? 'null' : `"${employeeName}"`}`);
        expect(employeeName === null || employeeName === '').toBeTruthy();
        console.log('✅ employee_name is null or empty in API response');

        // ============================================================
        // STEP 6: Verify Employer Name is Still Displayed
        // ============================================================
        console.log('\n🏢 STEP 6: Verifying employer name is displayed...');

        // Verify employer name cell
        const employerCell = page.getByTestId(`employment-table-employer-cell-${employmentId}`);
        await expect(employerCell).toBeVisible();

        const employerCellText = await employerCell.textContent();
        console.log(`🏢 Employer name cell content: "${employerCellText}"`);

        expect(employerCellText?.trim()).toContain('Permission Test Company Inc');
        console.log('✅ Employer name is displayed: "Permission Test Company Inc"');

        // Verify employer_name is populated in API response
        const employerName = employmentRecord.employer_name;
        console.log(`🏢 employer_name in API: "${employerName}"`);
        expect(employerName).toBeTruthy();
        expect(employerName).not.toBeNull();
        expect(employerName).not.toBe('');
        console.log('✅ employer_name is populated in API response');

        console.log('\n✅ ALL STEPS COMPLETED SUCCESSFULLY!');
        console.log('  ✓ Financial step completed with blank name');
        console.log('  ✓ Employment step completed with blank name');
        console.log('  ✓ Employee name displays: "Not provided by institution"');
        console.log('  ✓ API response has employee_name: null');
        console.log('  ✓ Employer name is displayed correctly');
    });

    test('Verify Financial Verification with Missing Accountholder Name', {
        tag: ['@regression'],
        timeout: 240_000
    }, async ({ page, browser, dataManager }) => {

        // ============================================================
        // STEP 1: Create Session with Blank Accountholder Name
        // ============================================================
        console.log('\n🏗️ STEP 1: Creating session with blank accountholder name...');

        // Authenticate admin
        console.log('🔑 Authenticating admin user...');
        await dataManager.authenticate(admin.email, admin.password);

        // Login to UI and navigate to applications
        console.log('🔐 Logging in as admin and navigating to applications...');
        await adminLoginAndNavigateToApplications(page, admin);

        // Find and invite application
        console.log(`🔍 Finding application: "${appName}"`);
        await findAndInviteApplication(page, appName);

        // Generate session with dummy user data
        const timestamp = Date.now();
        const user = {
            first_name: 'BlankAccountholder',
            last_name: 'Test',
            email: `test-blank-accountholder-${timestamp}@verifast.com`
        };

        console.log('📝 Generating session form...');
        const { sessionId, link } = await generateSessionForm.generateSessionAndExtractLink(page, user);
        createdSessionIds.push(sessionId);
        console.log(`✅ Session created: ${sessionId}`);

        // Open invite link in new browser context
        console.log('🌐 Opening invite link in applicant browser context...');
        const linkUrl = new URL(link);
        const applicantContext = await browser.newContext();
        applicantContextForCleanup = applicantContext;
        const applicantPage = await applicantContext.newPage();
        const gotoUrl = joinUrl(app.urls.app, `${linkUrl.pathname}${linkUrl.search}`);
        await applicantPage.goto(gotoUrl);

        // Complete initial applicant setup (rent budget form)
        console.log('⚙️ Completing initial applicant setup...');
        await setupInviteLinkSession(applicantPage);
        await updateRentBudget(applicantPage, sessionId, '2500');

        // Authenticate as guest to get API token
        console.log('🔑 Getting guest authentication token...');
        const guestToken = linkUrl.searchParams.get('token');
        const authResponse = await applicantPage.request.post(`${app.urls.api}/auth/guests`, {
            data: { token: guestToken, uuid: generateUUID(), os: 'web' }
        });
        const auth = await authResponse.json();
        const authToken = auth.data.token;
        console.log('✅ Guest authenticated');

        // ============================================================
        // STEP 1A: Complete Financial Step with Blank account_owners
        // ============================================================
        console.log('\n💳 STEP 1A: Completing financial step with blank account owner name...');
        await waitForStep(applicantPage, sessionId, authToken, 'FINANCIAL_VERIFICATION');

        // Build payload from normal user, then override account_owners to simulate missing accountholder name
        const blankNameUser = {
            first_name: '',  // ← INTENTIONALLY BLANK
            last_name: '',   // ← INTENTIONALLY BLANK
            email: user.email
        };
        const financialPayload = getVeridocsBankStatementPayload(blankNameUser);
        console.log('✅ Financial payload generated with blank account owner name');

        await submitFinancialVerification(applicantPage, applicantContext, sessionId, authToken, financialPayload);
        console.log('✅ Financial verification completed');

        // ============================================================
        // STEP 1B: Complete Employment Step with Normal Data
        // ============================================================
        console.log('\n💼 STEP 1B: Completing employment step with normal data...');
        await waitForStep(applicantPage, sessionId, authToken, 'EMPLOYMENT_VERIFICATION');

        const employmentPayload = getAtomicEmploymentPayload(user);
        console.log(`✅ Employment payload generated: firstName="${employmentPayload.FETCH_EMPLOYMENT_IDENTITY.response.data[0].identity.firstName}" lastName="${employmentPayload.FETCH_EMPLOYMENT_IDENTITY.response.data[0].identity.lastName}"`);

        await submitEmploymentVerification(applicantPage, applicantContext, sessionId, authToken, employmentPayload);
        console.log('✅ Employment verification completed');

        await applicantPage.close();

        // ============================================================
        // STEP 2: Navigate to Session Report
        // ============================================================
        console.log('\n🗂️ STEP 2: Navigating to session report...');
        await page.bringToFront();

        const reportUrl = joinUrl(app.urls.app, `applicants/all/${sessionId}`);
        console.log(`📊 Opening report: ${reportUrl}`);
        await page.goto(reportUrl);
        await page.waitForTimeout(2000);
        console.log('✅ Report page loaded');

        // ============================================================
        // STEP 3: Navigate to Financial Details Section
        // ============================================================
        console.log('\n📋 STEP 3: Expanding financial section...');
        const financialVerifPromise = page.waitForResponse(
            resp => resp.url().includes(`/financial-verifications`) &&
                resp.request().method() === 'GET' &&
                resp.ok()
        );
        const financialSection = await openReportSection(page, 'financial-section');
        const financialVerifResponse = await financialVerifPromise;
        await expect(financialSection).toBeVisible({ timeout: 20_000 });
        console.log('✅ Financial section expanded');

        const financialVerifications = await waitForJsonResponse(financialVerifResponse);
        await expect(financialVerifications.data).toBeDefined();
        await expect(financialVerifications.data.length).toBeGreaterThan(0);

        // ============================================================
        // STEP 4 (UI): Verify Financial Table Displays "Not Provided" Message
        // ============================================================
        console.log('\n✅ STEP 4: Verifying "Not provided by institution" message in financial table...');

        const financialWrapper = page.getByTestId(`financial-section-financials-wrapper-${sessionId}`);
        await expect(financialWrapper).toBeVisible({ timeout: 10_000 });
        console.log(`📌 Found financial records wrapper for session: ${sessionId}`);

        // Locate identities column via partial data-testid match (no hardcoded financial ID)
        const identitiesCell = financialWrapper.getByTestId(`financial-section-financials-wrapper-${sessionId}-identities-col`).first();
        await expect(identitiesCell).toBeVisible({ timeout: 10_000 });

        const identitiesCellText = await identitiesCell.textContent();
        console.log(`📝 Identities cell content: "${identitiesCellText}"`);

        // Assert: shows "Not provided by institution"
        expect(identitiesCellText?.trim()).toBe('Not provided by institution');
        console.log('✅ Identities cell displays: "Not provided by institution"');

        // Assert: NOT blank or empty
        expect(identitiesCellText?.trim().length).toBeGreaterThan(0);
        console.log('✅ Identities cell is NOT blank/empty');

        // ============================================================
        // STEP 4 (API): Verify API Response Contains Null/Empty Identity
        // ============================================================
        console.log('\n🔍 STEP 4 API: Verifying API response for null/empty identities...');

        const firstVerification = financialVerifications.data[0];
        expect(Array.isArray(firstVerification.accounts)).toBeTruthy();
        expect(firstVerification.accounts.length).toBeGreaterThan(0);

        const firstAccount = firstVerification.accounts[0];
        const identities = firstAccount?.identities ?? [];
        console.log(`👤 identities in API: ${JSON.stringify(identities)}`);

        // identities should be [] or contain only entries with null/empty full_name
        const hasNullOrEmptyIdentity = identities.length === 0 || identities.every(i => !i.full_name);
        expect(hasNullOrEmptyIdentity).toBeTruthy();
        console.log('✅ identities is empty or has null full_name in API response');

        // ============================================================
        // STEP 5: Verify Other Financial Data is Still Displayed
        // ============================================================
        console.log('\n🏦 STEP 5: Verifying other financial data is still displayed...');

        // Verify institution name is populated in UI
        const institutionCell = financialWrapper.getByTestId(`financial-section-financials-wrapper-${sessionId}-institution-col`).first();
        await expect(institutionCell).toBeVisible();
        const institutionText = await institutionCell.textContent();
        console.log(`🏦 Institution cell content: "${institutionText}"`);
        expect(institutionText?.trim()).toBeTruthy();
        console.log('✅ Institution name is displayed');

        // Verify account balance is displayed in UI
        const balanceCell = financialWrapper.getByTestId(`financial-section-financials-wrapper-${sessionId}-balance-col`).first();
        await expect(balanceCell).toBeVisible();
        const balanceText = await balanceCell.textContent();
        console.log(`💰 Balance cell content: "${balanceText}"`);
        expect(balanceText?.trim()).toBeTruthy();
        expect(balanceText?.trim().toLowerCase()).not.toContain('n/a');
        console.log('✅ Account balance is displayed');

        // Verify institution is populated in API response
        const institutionName = firstAccount?.institution.name ?? firstVerification?.institution.name;
        console.log(`🏦 institution_name in API: "${institutionName}"`);
        expect(institutionName).toBeTruthy();
        console.log('✅ Institution name is populated in API response');

        console.log('\n✅ ALL STEPS COMPLETED SUCCESSFULLY!');
        console.log('  ✓ Financial step completed with blank accountholder name');
        console.log('  ✓ Employment step completed with normal data');
        console.log('  ✓ Identities cell displays: "Not provided by institution"');
        console.log('  ✓ API response has identities: [] or [{full_name: null}]');
        console.log('  ✓ Institution name is displayed correctly');
        console.log('  ✓ Account balance is displayed correctly');
    });
});

// ============================================================
// HELPERS
// ============================================================

/**
 * Poll session API until the specified step type is active
 * @param {import('@playwright/test').Page} page
 * @param {string} sessionId
 * @param {string} authToken
 * @param {'FINANCIAL_VERIFICATION'|'EMPLOYMENT_VERIFICATION'} stepType
 * @param {number} maxAttempts
 */
async function waitForStep(page, sessionId, authToken, stepType, maxAttempts = 40) {
    console.log(`   ⏳ Polling for ${stepType} step...`);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const response = await page.request.get(
            `${app.urls.api}/sessions/${sessionId}`,
            { headers: { Authorization: `Bearer ${authToken}` } }
        );
        const session = await response.json();
        const currentStepType = session.data?.state?.current_step?.task?.key;

        if (currentStepType === stepType) {
            console.log(`   ✅ Step active: ${stepType}`);
            return session.data.state.current_step;
        }

        if (attempt < maxAttempts - 1) {
            await page.waitForTimeout(3000);
        }
    }

    throw new Error(`Timeout: ${stepType} step never became active`);
}

/**
 * Get the current session step ID, create a session step entry, and return it
 */
async function createSessionStep(page, sessionId, authToken) {
    const sessionResponse = await page.request.get(`${app.urls.api}/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
    });
    const session = await sessionResponse.json();
    const currentStepId = session.data.state.current_step.id;

    const stepResponse = await page.request.post(
        `${app.urls.api}/sessions/${sessionId}/steps`,
        {
            headers: { Authorization: `Bearer ${authToken}` },
            data: { step: currentStepId }
        }
    );
    const stepData = await stepResponse.json();
    return stepData.data;
}

/**
 * Get the Simulation provider ID
 */
async function getSimulationProvider(page, authToken) {
    const response = await page.request.get(`${app.urls.api}/providers`, {
        headers: { Authorization: `Bearer ${authToken}` }
    });
    const providers = await response.json();
    const provider = providers.data.find(p => p.name === 'Simulation');
    if (!provider) throw new Error('Simulation provider not found');
    return provider;
}

/**
 * Poll until a verification reaches COMPLETED status
 * @param {import('@playwright/test').BrowserContext} context
 * @param {string} authToken
 * @param {string} verificationId
 * @param {'financial-verifications'|'employment-verifications'} endpoint
 * @param {number} maxAttempts
 */
async function waitForVerificationComplete(context, authToken, verificationId, endpoint, maxAttempts = 40) {
    for (let i = 0; i < maxAttempts; i++) {
        const response = await context.request.get(
            `${app.urls.api}/${endpoint}/${verificationId}`,
            { headers: { Authorization: `Bearer ${authToken}` } }
        );
        const data = await response.json();
        const status = data.data?.status;

        if (status === 'COMPLETED') return;
        if (status === 'FAILED' || status === 'ERROR') {
            throw new Error(`Verification ${verificationId} failed with status: ${status}`);
        }

        if (i < maxAttempts - 1) {
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
    throw new Error(`Timeout: Verification ${verificationId} never reached COMPLETED status`);
}

/**
 * Submit financial verification via VERIDOCS_PAYLOAD simulator
 */
async function submitFinancialVerification(page, context, sessionId, authToken, financialPayload) {
    const step = await createSessionStep(page, sessionId, authToken);
    console.log(`   ✅ Financial session step created: ${step.id}`);

    const provider = await getSimulationProvider(page, authToken);
    console.log(`   ✅ Simulation provider: ${provider.id}`);

    console.log('   🚀 Uploading bank statement via VERIDOCS_PAYLOAD...');
    const verificationResponse = await page.request.post(
        `${app.urls.api}/financial-verifications`,
        {
            headers: { Authorization: `Bearer ${authToken}` },
            data: {
                step: step.id,
                provider: provider.id,
                simulation_type: 'VERIDOCS_PAYLOAD',
                custom_payload: financialPayload
            }
        }
    );

    if (!verificationResponse.ok()) {
        const err = await verificationResponse.json();
        throw new Error(`Financial verification failed: ${JSON.stringify(err)}`);
    }

    const verification = await verificationResponse.json();
    console.log(`   ✅ Verification created: ${verification.data.id}`);

    console.log('   ⏳ Waiting for financial verification to complete...');
    await waitForVerificationComplete(context, authToken, verification.data.id, 'financial-verifications');
    console.log('   ✅ Financial verification COMPLETED');

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
 * Submit employment verification via ATOMIC_PAYLOAD simulator
 */
async function submitEmploymentVerification(page, context, sessionId, authToken, employmentPayload) {
    const step = await createSessionStep(page, sessionId, authToken);
    console.log(`   ✅ Employment session step created: ${step.id}`);

    const provider = await getSimulationProvider(page, authToken);
    console.log(`   ✅ Simulation provider: ${provider.id}`);

    console.log('   🚀 Uploading employment data via ATOMIC_PAYLOAD...');
    const verificationResponse = await page.request.post(
        `${app.urls.api}/employment-verifications`,
        {
            headers: { Authorization: `Bearer ${authToken}` },
            data: {
                step: step.id,
                provider: provider.id,
                simulation_type: 'ATOMIC_PAYLOAD',
                custom_payload: employmentPayload
            }
        }
    );

    if (!verificationResponse.ok()) {
        const err = await verificationResponse.json();
        throw new Error(`Employment verification failed: ${JSON.stringify(err)}`);
    }

    const verification = await verificationResponse.json();
    console.log(`   ✅ Verification created: ${verification.data.id}`);

    console.log('   ⏳ Waiting for employment verification to complete...');
    await waitForVerificationComplete(context, authToken, verification.data.id, 'employment-verifications');
    console.log('   ✅ Employment verification COMPLETED');

    console.log('   📝 Marking employment step as COMPLETED...');
    await context.request.patch(
        `${app.urls.api}/sessions/${sessionId}/steps/${step.id}`,
        {
            headers: { Authorization: `Bearer ${authToken}` },
            data: { status: 'COMPLETED' }
        }
    );
    console.log('   ✅ Employment step marked as COMPLETED');
}
