import { test, expect } from "./fixtures/api-data-fixture";
import { createPaystubData } from "./mock-data/paystub-payload";
import { admin, app } from "./test_config";
import { findAndInviteApplication } from "./utils/applications-page";
import { cleanupTrackedSessions } from "./utils/cleanup-helper";
import generateSessionForm from "./utils/generate-session-form";
import { getAmount, joinUrl } from "./utils/helper";
import { findSessionLocator, searchSessionWithText } from "./utils/report-page";
import { setupInviteLinkSession, updateRentBudget, handleSkipReasonModal } from "./utils/session-flow";
import { adminLoginAndNavigateToApplications } from "./utils/session-utils";
import { waitForJsonResponse } from "./utils/wait-response";
import { pollForVerificationStatus } from "./utils/polling-helper";

let createdSessionIds = [];
let guestAuthToken = null;  // ✅ Store guest token for API polling
let applicantContext = null;

test.describe('QA-213 show-paystub-deposit-in-document-extracted-section.spec', () => {

    const appName = 'Autotest - Heartbeat Test - Employment';

    test.beforeEach(() => {
        // Reset per-attempt tracking (important with Playwright retries)
        createdSessionIds = [];
        guestAuthToken = null;
        applicantContext = null;
    });

    test('Verify Display Paystub Deposits in Document → Extracted Section', { 
        tag: ['@regression', '@try-test-rail-names', '@staging-ready', '@rc-ready']
    }, async ({ page, browser }) => {
            const user = {
            firstName: "Test",
            lastName: "User",
            email: 'test.user@verifast.com',
            password: 'password',
            invite: true
        };

        console.log('🚀 Login and go to application page')
        await adminLoginAndNavigateToApplications(page, admin);
        console.log('✅ Done Login and go to application page')

        console.log('🚀 Find application and click invite')
        await findAndInviteApplication(page, appName);
        console.log('✅ Done Find application and click invite')

        console.log('🚀 Invite Applicant')
        const { sessionId, sessionUrl, link } = await generateSessionForm.generateSessionAndExtractLink(page, user);
        if (sessionId) {
            createdSessionIds.push(sessionId); // Store for cleanup (retry-safe)
        }
        console.log('✅ Done Invite Applicant')

        applicantContext = await browser.newContext()

        const applicationPage = await applicantContext.newPage()

        console.log('🚀 Navigating to applicant link and capturing auth token');
        
        // ✅ Intercept the auth response to capture guest token
        const tokenPromise = applicationPage.waitForResponse(
            resp => resp.url().includes('/auth/guest') && resp.ok(),
            { timeout: 30000 }  // ✅ Add explicit timeout
        ).then(async resp => {
            const body = await resp.json();
            const token = body.data?.token || body.token;
            console.log('✅ Captured guest auth token');
            return token;
        }).catch(error => {
            console.log('⚠️ Failed to capture auth token:', error.message);
            return null;  // ✅ Return null instead of crashing
        });
        
        await applicationPage.goto(link);
        guestAuthToken = await tokenPromise;
        
        // ✅ Validate token was captured
        if (!guestAuthToken) {
            throw new Error('Failed to capture guest authentication token - cannot proceed with API polling');
        }
        
        console.log('✅ Navigated to applicant link');

        console.log('🚀 Starting invite link session setup');
        await setupInviteLinkSession(applicationPage, { sessionUrl });
        console.log('✅ Invite link session set up');

        console.log('🚀 Filing rent budget')
        await updateRentBudget(applicationPage, sessionId, '500');
        console.log('✅ Filing rent budget')

        // Prescreening questions step skip 

        console.log('🚀 Waiting for pre-screening step visibility');
        const preScreeningStep = applicationPage.getByTestId('pre-screening-step');
        await expect(preScreeningStep).toBeVisible({ timeout: 20_000 });
        console.log('✅ Pre-screening step visible');

        // Skip opens a "Skip reason" modal; the step PATCH runs only after the modal is submitted.
        // Pattern: register listener → click skip → handle modal → await response.
        const stepPatchRegex = new RegExp(joinUrl(app.urls.api, `/sessions/${sessionId}/steps/.{36}`));
        const stepPatchResp = applicationPage.waitForResponse(
            resp => stepPatchRegex.test(resp.url()) && resp.request().method() === 'PATCH' && resp.ok(),
            { timeout: 30_000 }
        );
        await preScreeningStep.getByTestId('pre-screening-skip-btn').click();
        await handleSkipReasonModal(applicationPage, "Skipping pre-screening step for test purposes");
        await stepPatchResp;
        console.log('✅ Pre-screening skipped');

        console.log('🚀 Waiting for employment verification step to be visible');
        const employmentStep = applicationPage.getByTestId('employment-verification-step');
        await expect(employmentStep).toBeVisible({ timeout: 20_000 });
        console.log('✅ Employment verification step visible');

        console.log('🚀 Preparing mock paystub data');
        const paystubData = createPaystubData(1);
        console.log('✅ Created paystub data:', paystubData);

        console.log('🚀 Uploading first veridocs (paystub) doc');
        await uploadVeridocsDoc(applicationPage, paystubData);
        console.log('✅ Uploaded first paystub doc');

        console.log('🚀 Checking applicants tab in admin');
        await page.bringToFront();
        await page.getByTestId('applicants-menu').click();
        await page.getByTestId('applicants-submenu').click();

        console.log('🚀 Searching for session');
        await searchSessionWithText(page, sessionId);

        console.log('🚀 Locating session card');
        const sessionLocator = await findSessionLocator(page, `.application-card[data-session="${sessionId}"]`);

        console.log('🚀 Waiting for session and files responses after click');
        const [sessionResponse, filesResponse] = await Promise.all([
            page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}?fields[session]`)
                && resp.ok()
                && resp.request().method() === 'GET'),
            page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}/files`)
                && resp.ok()
                && resp.request().method() === 'GET'),
            sessionLocator.click()
        ]);
        console.log('✅ Got session and files responses');

        let files = await waitForJsonResponse(filesResponse);

        console.log('🚀 Verifying files exist');
        await expect(files.data.length).toBeGreaterThan(0);
        console.log('✅ Files found in response:', files.data);

        const firstFile = files.data[0];

        console.log('🚀 Checking deposits in extracted section for first file');
        await checkDeposits(page, firstFile, paystubData);
        console.log('✅ Deposits verified for first file');

        console.log('🚀 Adding new deposit to paystub data and uploading new doc');
        paystubData.documents[0].data.deposits.push({
            "account_name": "CHECKING Acct: ************4565",
            "amount": 12943.32
        });
        console.log('✅ Deposit added to mock data:', paystubData.documents[0].data.deposits.at(-1));

        await applicationPage.bringToFront();

        console.log('🚀 Uploading updated veridocs (with new deposit)');
        await uploadVeridocsDoc(applicationPage, paystubData);
        console.log('✅ Uploaded updated paystub doc');

        await page.bringToFront();
        console.log('🚀 Refreshing admin page and waiting for updated files');
        const [_, filesResponse2] = await Promise.all([
            page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}?fields[session]`)
                && resp.ok()
                && resp.request().method() === 'GET'),
            page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}/files`)
                && resp.ok()
                && resp.request().method() === 'GET'),
            page.reload()
        ]);
        console.log('✅ Admin page reloaded, responses received');

        files = await waitForJsonResponse(filesResponse2);

        console.log('🚀 Verifying there are still files after 2nd upload');
        await expect(files?.data?.length).toBeGreaterThan(0);
        console.log('✅ Files count valid after second upload:', files?.data?.length);

        const secondFile = files.data.find(file => file.id !== firstFile.id);
        if (!secondFile) {
            throw new Error(
                `Second file not found after second upload. ` +
                `First file ID: ${firstFile.id}. ` +
                `Available files: ${files.data.map(f => f.id).join(', ')}`
            );
        }

        console.log('🚀 Checking deposits in extracted section for second file');
        await checkDeposits(page, secondFile, paystubData);
        console.log('✅ Deposits verified for second file');

    })

    // Always cleanup by default; keep artifacts only when KEEP_FAILED_ARTIFACTS=true and test failed
    test.afterEach(async ({ request }, testInfo) => {
        await cleanupTrackedSessions({ request, sessionIds: createdSessionIds, testInfo });

        if (applicantContext) {
            try {
                await applicantContext.close();
            } catch {
                // ignore
            }
        }
    });

})

async function checkDeposits(page, file, paystubData) {
    console.log(`🚀 Opening files section for file id: ${file.id}`);
    const filesSection = page.getByTestId('files-section');
    
    // ✅ Check if section is already expanded before clicking
    const isExpanded = await filesSection.getAttribute('aria-expanded').catch(() => null);
    if (isExpanded !== 'true') {
        await filesSection.click();
        await page.waitForTimeout(500);  // ✅ Wait for section to expand
    }

    const fileRow = await page.getByTestId('all-tr-' + file.id);

    console.log('🚀 Opening view document modal');
    await fileRow.getByTestId('all-files-view-btn').click();

    await expect(page.getByTestId('view-document-modal')).toBeVisible();
    console.log('✅ View document modal visible');

    const extractedSection = page.getByTestId('paystub-extracted-section');
    await expect(extractedSection).toBeVisible();
    console.log('✅ Paystub extracted section visible');

    const depositCol = extractedSection.getByTestId('paystub-deposit-col');  // ✅ Removed unnecessary await
    for (let index = 0; index < paystubData.documents[0].data.deposits.length; index++) {
        const element = paystubData.documents[0].data.deposits[index];
        console.log(`🚀 Checking deposit ${index + 1} (Account: ${element.account_name}, Amount: ${element.amount})`);
        await expect(depositCol).toContainText(element.account_name);
        await expect(depositCol).toContainText(getAmount(element.amount));
        console.log(`✅ Deposit ${index + 1} found: ${element.account_name} - ${getAmount(element.amount)}`);
    }

    console.log('🚀 Closing view document modal');
    await page.getByTestId('view-document-modal-cancel').click();
    console.log('✅ View document modal closed');
}

/**
 * Handle "Upload your Paystubs" intro modal that can appear
 * after clicking the employment upload paystub button.
 *
 * We poll briefly for the modal and click "Upload Paystubs" so that
 * the underlying simulation upload controls are available.
 * Safe no-op if the modal never appears (older builds).
 *
 * @param {import('@playwright/test').Page} page
 */
async function handleUploadPaystubsIntroModal(page) {
    const maxAttempts = 10;      // up to ~10 seconds
    const intervalMs = 1000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const dialog = page.getByRole('dialog');
        const dialogVisible = await dialog.isVisible().catch(() => false);

        if (dialogVisible) {
            const uploadBtn = dialog.getByRole('button', { name: /Upload Paystubs/i });
            const btnVisible = await uploadBtn.isVisible().catch(() => false);
            if (btnVisible) {
                await uploadBtn.click({ timeout: 20_000 });
                return;
            }
        }

        await page.waitForTimeout(intervalMs);
    }
}

async function uploadVeridocsDoc(applicationPage, paystubData) {
    console.log('🚀 Waiting for upload paystubs button to be visible');
    await expect(applicationPage.getByTestId('upload-paystubs-btn')).toBeVisible({ timeout: 20000 });
    console.log('✅ upload-paystubs-btn visible, clicking...');
    await applicationPage.getByTestId('upload-paystubs-btn').click();

    console.log('🚀 Clicking upload paystub button');
    await applicationPage.getByTestId('employment-upload-paystub-btn').click();

    // NEW: handle introductory "Upload your Paystubs" modal, if present
    await handleUploadPaystubsIntroModal(applicationPage);

    console.log('🚀 Waiting for browser dialog...');
    const dialogPromise = applicationPage.waitForEvent('dialog').then(async (dialog) => {
        console.log('✅ Browser prompt detected!');
        console.log(`📋 Dialog type: ${dialog.type()}`);
        console.log(`📋 Dialog message: ${dialog.message()}`);
        await applicationPage.waitForTimeout(500);
        console.log('📋 Sending payload to dialog...');
        await dialog.accept(JSON.stringify({ documents: [paystubData] }));
        console.log('✅ Payload sent to browser prompt');
    });

    let uploadResponseId = null;
    console.log('🚀 Waiting for POST /employment-verifications (upload to backend)...');
    await Promise.all([
        applicationPage.waitForResponse(async (resp) => {
            if (resp.url().includes('/employment-verifications') &&
                resp.request().method() === 'POST' &&
                resp.ok()) {
                try {
                    const body = await resp.json();
                    uploadResponseId = body?.id || body?.data?.id;
                    console.log('✅ Received POST response, id:', uploadResponseId);
                    return !!uploadResponseId;
                } catch (e) {
                    console.log('❌ Error parsing POST /employment-verifications response', e);
                    return false;
                }
            }
            return false;
        }),
        applicationPage.getByTestId('employment-simulation-upload-btn').click(),
        dialogPromise
    ]);
    console.log('✅ Uploaded doc and received backend POST /employment-verifications');

    // ✅ API POLLING: Poll verification status with authentication
    console.log('🚀 Polling for employment-verification COMPLETED status via API...');
    await pollForVerificationStatus(applicationPage.context(), uploadResponseId, 'employment-verifications', {
        maxAttempts: 20,
        pollInterval: 2000,
        authToken: guestAuthToken  // ✅ Pass the captured guest token
    });
    console.log('✅ Document verification completed via API polling');
}
