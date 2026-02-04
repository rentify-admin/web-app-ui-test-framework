import { test, expect } from '@playwright/test';
import { getRandomEmail, joinUrl } from './utils/helper';
import { adminLoginAndNavigateToApplications } from './utils/session-utils';
import { admin, app } from './test_config';
import { generateSessionForApplication } from './utils/applications-page';
import { handleBankConnectInfoModal, handleSkipReasonModal, handleStateAndTermsCheckbox, updateRentBudget, waitForSimulatorConnectionCompletion } from './utils/session-flow';
import { getBankData } from './mock-data/high-balance-financial-payload';
import { gotoPage } from './utils/common';
import { addApplicant, copyInviteLink, navigateToSessionById, reInviteApplicant, searchSessionWithText } from './utils/report-page';
import { waitForJsonResponse } from './utils/wait-response';
import { cleanupSession } from './utils/cleanup-helper';
import { ApiClient, SessionApi } from './api';
import { loginWithAdmin } from './endpoint-utils/auth-helper';


test.describe('QA-353 coapp-income-guarantor-to-primary.spec', () => {

    // Constants
    const APPLICATION_NAME = 'Autotest - Simulator Financial Step - Applicants';
    const PRIMARY_APPLICANT = {
        first_name: 'Guarantor',
        last_name: 'Primary',
        email: getRandomEmail(),
        password: 'password'
    }

    const GUARANTOR_APPLICANT = {
        first_name: 'Guarantor',
        last_name: 'Test',
        email: getRandomEmail(),
        password: 'password',
        role: "Guarantor"
    }

    const CO_APPLICANT = {
        first_name: 'Coapp',
        last_name: 'Test',
        email: getRandomEmail(),
        password: 'password',
        role: "Co-App"
    }
    let createdSessionId = null;
    let createdGuarantorSessionId = null;
    let createdCoApplicantSessionId = null;

    const adminClient = new ApiClient(app.urls.api, null, 120_000);
    const sessionApi = new SessionApi(adminClient);


    test.beforeAll(async () => {
        console.log('[SETUP] Logging in as admin to obtain auth token...');
        await loginWithAdmin(adminClient)
    })

    // Test: Verify co-applicant income is included in household total when former guarantor becomes primary applicant (VC-1496)
    test('Should include co-applicant income in household total when former guarantor becomes primary applicant', {
        tag: ['@core', '@regression'],
    }, async ({ page, browser }) => {
        test.setTimeout(420_000);

        console.log('[STEP 1] Complete Primary Session with Financial Verification');

        console.log('    > Logging in as admin and navigating to applications page...');
        await adminLoginAndNavigateToApplications(page, admin);

        console.log('    > Generating session for application and completing primary applicant session...');
        const {
            sessionData,
            link
        } = await generateSessionForApplication(page, APPLICATION_NAME, PRIMARY_APPLICANT);

        const session = sessionData.data;
        const sessionId = sessionData?.data?.id;
        createdSessionId = sessionId;


        const customData = getBankData(PRIMARY_APPLICANT);
        console.log('    > Completing primary applicant session with financial verification...');
        await completeSession(link, browser, sessionId, customData);

        console.log('[STEP 2] Add Guarantor to Primary Session');

        console.log('    > Navigating to applicants menu...');
        await gotoPage(page, 'applicants-menu', 'applicants-submenu', '/sessions?fields[session]');

        console.log('    > Searching and navigating to primary applicant session...');
        await searchSessionWithText(page, sessionId);
        console.log('    > Navigating to primary applicant session by ID...');
        await navigateToSessionById(page, sessionId);
        await page.waitForTimeout(3000);

        console.log('    > Adding guarantor applicant to primary session...');
        await page.getByTestId('session-action-btn').click();
        await page.waitForTimeout(300);
        console.log('    > Clicking invite applicant button...');
        await page.getByTestId('invite-applicant').click();

        const inviteModal = page.getByTestId('invite-modal');
        await expect(inviteModal).toBeVisible();

        console.log('    > Filling and submitting add applicant form for guarantor...');
        const guarantorSession = await addApplicant(page, inviteModal, GUARANTOR_APPLICANT, session)
        createdGuarantorSessionId = guarantorSession.id;

        console.log('    > Re-inviting guarantor applicant to get fresh invite link...');
        await reInviteApplicant(page, guarantorSession.applicant?.id);

        console.log('    > Copying guarantor invite link...');
        const guarantorSessionLink = await copyInviteLink(page, guarantorSession);

        console.log('    > Closing invite modal...');
        await page.getByTestId('invite-modal-cancel').click();


        console.log('[STEP 3] Complete Guarantor Session with Financial Verification');
        await completeSession(guarantorSessionLink, browser, guarantorSession.id, getBankData(GUARANTOR_APPLICANT), { noRentBudget: true, noApplicantStep: true });

        console.log('[STEP 4] Split Guarantor from Primary Session');
        await page.reload();

        const guarantorRaw = page.getByTestId(`raw-${guarantorSession.id}`)
        await expect(guarantorRaw).toBeVisible();

        console.log('    > Clicking split into new household button...');
        await guarantorRaw.getByTestId('overview-applicant-btn').click()
        await guarantorRaw.getByTestId('split-into-new-household-btn').click()
        const confirmModal = page.getByTestId('confirm-detach-applicant');
        await expect(confirmModal).toBeVisible();

        const splitPromise = page.waitForResponse(response =>
            response.url().includes(`/sessions/${session.id}/children/${guarantorSession.id}`) &&
            response.request().method() === 'DELETE' &&
            response.ok(),
            { timeout: 60000 } // 1 minute timeout
        );
        console.log('    > Confirming split action in modal...');
        await confirmModal.getByTestId('confirm-btn').click();

        await splitPromise;
        await page.waitForTimeout(2000);

        console.log('    > Search for guarantor session ID (now independent) to verify it exists...');
        const searchSessions = await searchSessionWithText(page, guarantorSession.id);

        // Verifying that gurantor session is now a individual primary session
        await expect(searchSessions.length).toBeGreaterThan(0);


        console.log('Skipping [STEP 5] Change Guarantor to Primary With API');
        // await sessionApi.update(guarantorSession.id, { role: 'PRIMARY' });

        console.log('    > Navigating to guarantor (now primary) session page...');
        await page.goto(`/applicants/all/${guarantorSession.id}`);

        console.log('[STEP 6] Add Co-Applicant to New Primary Session');

        console.log('    > Adding co-applicant to new primary session...');
        await page.getByTestId('session-action-btn').click()
        await page.getByTestId('invite-applicant').click()

        const inviteModal2 = page.getByTestId('invite-modal');
        await expect(inviteModal2).toBeVisible();
        console.log('    > Filling and submitting add applicant form for co-applicant...');
        const coAppSession = await addApplicant(page, inviteModal2, CO_APPLICANT, guarantorSession)

        createdCoApplicantSessionId = coAppSession.id;
        console.log('    > Re-inviting co-applicant to get fresh invite link...');
        await reInviteApplicant(page, coAppSession.applicant?.id);

        console.log('    > Copying co-applicant invite link...');
        const coAppSessionLink = await copyInviteLink(page, coAppSession);

        console.log('    > Closing invite modal...');
        await inviteModal2.getByTestId('invite-modal-cancel').click().catch(() => { });

        console.log('[STEP 7] Complete Co-Applicant Session with Financial Verification');
        await completeSession(coAppSessionLink, browser, coAppSession.id, getBankData(CO_APPLICANT), { noRentBudget: true, noApplicantStep: true });

        console.log('[STEP 8] Verify Household Income Totals Include Co-Applicant Income');
        await page.waitForTimeout(2000);
        const updatedGuarantorSessionPromise = page.waitForResponse(response =>
            response.url().includes(`/sessions/${guarantorSession.id}`) &&
            response.url().includes(`fields[session]`) &&
            response.request().method() === 'GET' &&
            response.ok(),
            { timeout: 60000 } // 1 minute timeout
        );

        console.log('    > Navigating to guarantor (now primary) session page to verify income totals...');
        await page.goto(`/applicants/all/${guarantorSession.id}`);

        const updatedGuarantorSessionResponse = await updatedGuarantorSessionPromise;
        const { data: updatedGuarantorSession } = await waitForJsonResponse(updatedGuarantorSessionResponse)

        const coAppRaw = page.getByTestId(`raw-${coAppSession.id}`)
        await expect(coAppRaw).toBeVisible();

        console.log('    > Verifying income totals from API response...');
        const guarantorTotalIncome = updatedGuarantorSession.state?.summary?.total_income || 0;//2068381
        await expect(guarantorTotalIncome).toBeGreaterThan(0);

        console.log('    > Verifying guarantor and co-applicant individual incomes from API response...');
        const guarantorTotalIncomeRatio = [
            updatedGuarantorSession?.state?.summary?.total_target_to_income_ratio,
            updatedGuarantorSession?.state?.summary?.target_to_income_ratio
        ].find(Boolean)
        await expect(guarantorTotalIncomeRatio).toBeGreaterThan(0);

        console.log('    > Verifying guarantor income...');
        const guarantorIncome = updatedGuarantorSession.state?.summary?.income || 0;
        await expect(guarantorIncome).toBeGreaterThan(0);

        const coApplicantSession = updatedGuarantorSession.children.find(childSession => childSession.role === 'APPLICANT')
        expect(coApplicantSession).toBeDefined();

        console.log('    > Verifying co-applicant income...');
        const coAppIncome = coApplicantSession.state?.summary?.income || 0;
        expect(coAppIncome).toBeGreaterThan(0);

        console.log('    > Verifying total income equals sum of guarantor and co-applicant incomes...');
        const expectedTotalIncome = (guarantorIncome || 0) + (coAppIncome || 0);
        expect(guarantorTotalIncome).toBe(expectedTotalIncome);

        // UI verification
        console.log('    > Verifying income totals displayed in UI...');
        const sessionGrossIncomeEle = page.getByTestId('session-monthly-gross-income');
        const primaryIncomeEle = page.getByTestId(`income-${guarantorSession.id}`);
        const coAppIncomeEle = page.getByTestId(`income-${coAppSession.id}`);
        const sessionGrossIncome = currencyToNumber(await sessionGrossIncomeEle.textContent())
        const primaryIncome = currencyToNumber(await primaryIncomeEle.textContent())
        const coAppUiIncome = currencyToNumber(await coAppIncomeEle.textContent())

        console.log('    > Comparing UI displayed incomes with API values...');
        expect(sessionGrossIncome).toBe(expectedTotalIncome);
        expect(primaryIncome).toBe(guarantorIncome);
        expect(coAppUiIncome).toBe(coAppIncome);

        console.log('✅ Income totals verified successfully in UI and API.');
    });

    test.afterAll(async ({ request }, testInfo) => {
        // Cleanup created sessions
        if (testInfo.status === testInfo.expectedStatus) {
            const sessionIdsToDelete = [createdGuarantorSessionId, createdCoApplicantSessionId, createdSessionId].filter(Boolean);
            for (const sessionId of sessionIdsToDelete) {
                console.log(`🗑️ Deleting session with ID: ${sessionId}`);
                await cleanupSession(request, sessionId, true);
            }
        }
    });

})


async function completeSession(inviteLink, browser, sessionId, customData, { noRentBudget = false, noApplicantStep = false } = {}) {
    const linkUrl = new URL(inviteLink);
    const context = await browser.newContext();
    const applicantPage = await context.newPage();
    console.log(`    > [completeSession] Navigating to invite link: ${joinUrl(app.urls.app, `${linkUrl.pathname}${linkUrl.search}`)}`);

    const sessionPromise = applicantPage.waitForResponse(response =>
        response.url().includes(`/sessions/${sessionId}`) &&
        response.url().includes(`fields[session]`) &&
        response.request().method() === 'GET' &&
        response.ok(),
        { timeout: 60000 } // 1 minute timeout
    );
    await applicantPage.goto(joinUrl(app.urls.app, `${linkUrl.pathname}${linkUrl.search}`));
    const sessionResponse = await sessionPromise;
    const { data: session } = await waitForJsonResponse(sessionResponse)

    // Setup session flow: handles state modal + terms checkbox in correct order
    // Pattern 2: NO applicant type (financial-only application)
    console.log('    >[completeSession] Setting up invite link session flow...');
    await handleStateAndTermsCheckbox(applicantPage, session);

    if (!noRentBudget) {
        console.log('    > [completeSession] Updating rent budget...');
        await updateRentBudget(applicantPage, sessionId);
    }

    // Skip Applicants step
    if (!noApplicantStep) {
        const applicantStep = applicantPage.getByTestId('applicant-invite-step');
        await expect(applicantStep).toBeVisible();
        const applicantSkipBtn = applicantStep.getByTestId('applicant-invite-skip-btn');
        await expect(applicantSkipBtn).toBeVisible();
        await applicantSkipBtn.click();
        console.log('    > [completeSession] Skipping applicants step...');
        await handleSkipReasonModal(applicantPage, 'Skipping applicants for financial verification test');
    }

    // Financial Verification
    console.log('    > [completeSession] Starting financial verification step...');
    const financialStep = applicantPage.getByTestId('financial-verification-step');
    await expect(financialStep).toBeVisible();

    console.log('➡️ Preparing mock bank data and waiting for /financial-verifications POST...');
    const responsePromise = applicantPage.waitForResponse(response =>
        response.url().includes('/financial-verifications') &&
        response.request().method() === 'POST' &&
        response.ok(),
        { timeout: 120_000 } // 2 minutes timeout
    );

    // Set up dialog handler for simulator payload
    applicantPage.on('dialog', async (dialog) => {
        console.log('✅ Dialog detected, accepting with custom data');
        await dialog.accept(JSON.stringify(customData));
    });

    console.log('    > [completeSession] Triggering bank simulator connection...');
    // Click connect bank and wait for the verification POST
    await financialStep.getByTestId('connect-bank').click();

    // Handle bank connect info modal (Acknowledge), if it appears
    console.log('    > [completeSession] Checking for bank connect info modal...');
    await handleBankConnectInfoModal(applicantPage);

    console.log('    > [completeSession] Awaiting /financial-verifications POST response...');
    await responsePromise;

    // ✅ Wait for simulator connection to complete (Processing → Complete)
    console.log('    > [completeSession] Waiting for simulator connection to complete...');
    await waitForSimulatorConnectionCompletion(applicantPage, 15); // 15 iterations × 2 sec = 30 sec max
    console.log('    > [completeSession] Simulator connection completed');

    // Now click continue button
    console.log('    > [completeSession] Clicking continue button to finish financial step...');
    await applicantPage.getByTestId('financial-verification-continue-btn').click();

    console.log('    > [completeSession] closing applicant page...');
    await applicantPage.close();
}


function currencyToNumber(str) {
    return Number(str.trim().replace(/[^\d]/g, ''));
}