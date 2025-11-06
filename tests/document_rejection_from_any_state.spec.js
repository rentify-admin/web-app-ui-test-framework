import { expect, test } from "@playwright/test";
import { admin, app, user } from "./test_config";
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { adminLoginAndNavigateToApplications } from "./utils/session-utils";
import { findAndInviteApplication } from "./utils/applications-page";
import generateSessionForm from "./utils/generate-session-form";
import { getRandomEmail, joinUrl } from "./utils/helper";
import { waitForJsonResponse } from "./utils/wait-response";
import { selectApplicantType, updateRentBudget, updateStateModal, waitForConnectionCompletion } from "./utils/session-flow";
import { gotoPage } from "./utils/common";
import { findSessionLocator, searchSessionWithText } from "./utils/report-page";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Helper Functions for Clarity ---

/**
 * Uploads a financial statement document via manual upload.
 */
async function uploadFinancialStatement(applicantPage) {
    await applicantPage.bringToFront();
    await applicantPage.getByTestId('financial-upload-statement-btn').click();

    const uploadInput = applicantPage.locator('#manual-statement-upload');
    await expect(uploadInput).toBeAttached();

    const filePath = join(__dirname, '/test_files', 'test_bank_statement.pdf');
    console.log(`🚀 Uploading file from: ${filePath}`);

    // Wait for the upload input to settle before setting files
    await applicantPage.waitForTimeout(500);
    await uploadInput.setInputFiles(filePath);
    await applicantPage.waitForTimeout(2500); // Wait for potential client-side processing

    const manualUploadSubmitBtn = applicantPage.getByTestId('submit-manual-upload-btn');
    await expect(manualUploadSubmitBtn).toBeEnabled();

    console.log('🚀 Submitting manual upload...');
    const [connectionResponse, verificationResponse] = await Promise.all([
        applicantPage.waitForResponse(resp =>
            resp.url().endsWith('/financial-verifications') && resp.request().method() === 'POST' && resp.ok()
        ),
        applicantPage.waitForResponse(resp =>
            resp.url().includes('/financial-verifications') && resp.request().method() === 'GET' && resp.ok()
        ),
        manualUploadSubmitBtn.click()
    ]);

    const { data: financialVerification } = await waitForJsonResponse(connectionResponse);
    const { data: financialVerifications } = await waitForJsonResponse(verificationResponse);

    await expect(financialVerification).toBeDefined();
    await expect(financialVerifications).toBeDefined();
    await expect(financialVerifications.length).toBeGreaterThan(0);

    console.log('✅ Financial statement uploaded and verification process started.');

    return { financialVerification, financialVerifications };
}

/**
 * Navigates to the Files tab on the admin page and awaits file data.
 */
async function navigateToFilesTabAndReload(page, sessionId) {
    await page.bringToFront();

    // Reload page to fetch latest file status
    const [filesResponse] = await Promise.all([
        page.waitForResponse(
            resp => resp.url().includes(`/sessions/${sessionId}/files?fields[file]`) && resp.ok() && resp.request().method() === 'GET',
            { timeout: 5000 }
        ).catch(() => null),
        page.reload()
    ]);

    if (!filesResponse) {
        // Try to wait again after reload if initial wait failed
        const newFilesResponse = await page.waitForResponse(
            resp => resp.url().includes(`/sessions/${sessionId}/files?fields[file]`) && resp.ok() && resp.request().method() === 'GET'
        );
        const { data: files } = await waitForJsonResponse(newFilesResponse);
        await page.getByTestId('files-section-header').click();
        await page.getByTestId('document-tab-all').click();
        await expect(page.getByTestId('file-section-all-wrapper')).toBeVisible();
        return files;
    }

    const { data: files } = await waitForJsonResponse(filesResponse);

    await page.getByTestId('files-section-header').click();
    await page.getByTestId('document-tab-all').click();
    await expect(page.getByTestId('file-section-all-wrapper')).toBeVisible();

    return files;
}

/**
 * Fail a document from a given row and verifies the status is 'Failed'.
 */
async function failDocument(rowLocator, page, sessionId) {
    await rowLocator.getByTestId('files-document-status-pill').locator('a').click();

    await expect(page.getByTestId('decision-modal')).toBeVisible();
    const decisionModal = page.getByTestId('decision-modal');

    console.log('Attempting to reject document...');
    const [filesResponse] = await Promise.all([
        page.waitForResponse(
            resp => resp.url().includes(`/sessions/${sessionId}/files?fields[file]`) && resp.ok() && resp.request().method() === 'GET'
        ),
        decisionModal.getByTestId('decision-modal-processing-btn').click() // This button seems to trigger a 'Reject/Failed' state in the context
    ]);

    await waitForJsonResponse(filesResponse); // Wait for data to ensure the operation completed
    await page.waitForTimeout(1000); // Short wait for UI update
    await expect(rowLocator.getByTestId('files-document-status-pill')).toContainText('Failed', { timeout: 10_000 });
    console.log('✅ Document successfully failed.');
}

/**
 * Reject a document from a given row and verifies the status is 'Rejected'.
 */
async function rejectDocument(rowLocator, page, sessionId) {
    await rowLocator.getByTestId('files-document-status-pill').locator('a').click();

    await expect(page.getByTestId('decision-modal')).toBeVisible();
    const decisionModal = page.getByTestId('decision-modal');

    console.log('Attempting to reject document...');
    const [filesResponse] = await Promise.all([
        page.waitForResponse(
            resp => resp.url().includes(`/sessions/${sessionId}/files?fields[file]`) && resp.ok() && resp.request().method() === 'GET'
        ),
        decisionModal.getByTestId('decision-modal-reject-btn').click()
    ]);

    await waitForJsonResponse(filesResponse);
    await page.waitForTimeout(1000);
    await expect(rowLocator.getByTestId('files-document-status-pill')).toContainText('Rejected', { timeout: 10_000 });
    console.log('✅ Document successfully rejected.');
}

/**
 * Approves a document and verifies the status is 'Accepted'.
 */
async function acceptDocument(rowLocator, page, sessionId) {
    await rowLocator.getByTestId('files-document-status-pill').locator('a').click();

    await expect(page.getByTestId('decision-modal')).toBeVisible();
    const decisionModal = page.getByTestId('decision-modal');

    console.log('Attempting to accept document...');
    const [filesResponse] = await Promise.all([
        page.waitForResponse(
            resp => resp.url().includes(`/sessions/${sessionId}/files?fields[file]`) && resp.ok() && resp.request().method() === 'GET'
        ),
        decisionModal.getByTestId('decision-modal-accept-btn').click()
    ]);

    await waitForJsonResponse(filesResponse);
    await page.waitForTimeout(1000);
    await expect(rowLocator.getByTestId('files-document-status-pill')).toContainText('Accepted', { timeout: 10_000 });
    console.log('✅ Document successfully accepted.');
}

// --- Main Test Suite ---

test.describe('QA-208: Document Rejection from Any State', () => {
    test.describe.configure({
        timeout: 180000
    });

    const appName = 'AutoTest Suite - Full Test';
    let sessionId;
    let applicantPageContext;

    test('Reject a Document Regardless of Processing State', {
        tag: ['@regression']
    }, async ({ page, browser }) => {
        // Note: first_name will be auto-prefixed with 'AutoT - ' by the helper
        // Note: email will be auto-suffixed with '+autotest' by the helper
        const user = {
            first_name: 'Test',
            last_name: 'User',
            email: getRandomEmail(),
            password: 'password'
        };

        // 1. Setup Session
        await adminLoginAndNavigateToApplications(page, admin);
        await findAndInviteApplication(page, appName);

        const sessionInfo = await generateSessionForm.generateSessionAndExtractLink(page, user);
        sessionId = sessionInfo.sessionId;
        const link = sessionInfo.link;

        const linkUrl = new URL(link);
        applicantPageContext = await browser.newContext({
            permissions: ['camera', 'microphone'],
            launchOptions: {
                args: [
                    '--use-fake-ui-for-media-stream',
                    '--use-fake-device-for-media-stream'
                ]
            }
        });
        const applicantPage = await applicantPageContext.newPage();
        await applicantPage.goto(joinUrl(`${app.urls.app}`, `${linkUrl.pathname}${linkUrl.search}`));

        // Listen for session data to be retrieved
        applicantPage.on('response', async response => {
            if (response.url().includes(`/sessions/${sessionId}?fields[session]`) && response.ok() && response.request().method() === 'GET') {
                const sessionData = await waitForJsonResponse(response);
                session = sessionData.data;
                await applicantPage.waitForTimeout(1000);
            }
        });

        // 2. Complete Applicant Flow Steps
        console.log('➡️ Starting applicant flow...');
        await selectApplicantType(applicantPage, sessionInfo.sessionUrl, '#affordable_occupant');
        await updateStateModal(applicantPage, 'ALABAMA');
        await updateRentBudget(applicantPage, sessionId, '1500');

        // Skip other steps
        await expect(applicantPage.getByTestId('applicant-invite-step')).toBeVisible();
        await applicantPage.getByTestId('applicant-invite-skip-btn').click({ timeout: 10_000 });
        await expect(applicantPage.getByTestId('identify-step')).toBeVisible();
        await applicantPage.getByTestId('skip-id-verification-btn').click();
        await expect(applicantPage.getByTestId('financial-verification-step')).toBeVisible();
        console.log('✅ Applicant flow navigated to financial verification step.');

        // 3. Navigate Admin to Session Details
        await page.bringToFront();
        await gotoPage(page, 'applicants-menu', 'applicants-submenu', '/sessions?fields[session]');
        await searchSessionWithText(page, sessionId);

        const sessionLocator = await findSessionLocator(page, `.application-card[data-session="${sessionId}"]`);

        // Wait for responses upon clicking session card
        const [sessionResponse, filesResponse] = await Promise.all([
            page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}?fields[session]`) && resp.ok() && resp.request().method() === 'GET'),
            page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}/files?fields[file]`) && resp.ok() && resp.request().method() === 'GET'),
            sessionLocator.click()
        ]);
        await waitForJsonResponse(sessionResponse);
        let { data: files } = await waitForJsonResponse(filesResponse);

        // 4. Upload Initial Document (Processing State)
        console.log('➡️ Uploading first document...');
        await uploadFinancialStatement(applicantPage);

        // 5. Reject Document in a Pre-Processed State
        files = await navigateToFilesTabAndReload(page, sessionId);
        const allWrapper = page.getByTestId('file-section-all-wrapper');

        if (files.length > 0) {
            console.log(`🔍 Found ${files.length} file(s). Checking for pre-processed status...`);
            const preProcessedStatuses = ['PENDING', 'CLASSIFIED', 'CLASSIFYING', 'UPLOADED'];

            for (const element of files) {
                if (preProcessedStatuses.includes(element.status)) {
                    const row = allWrapper.getByTestId(`all-tr-${element.id}`);
                    await failDocument(row, page, sessionId);
                }
            }
        } else {
            console.warn('⚠️ No files found after first upload to attempt rejection from a pre-processed state.');
        }

        // 6. Upload Second Document (and wait for full processing)
        console.log('➡️ Uploading second document and waiting for completion...');
        const { financialVerification } = await uploadFinancialStatement(applicantPage);
        // Wait for the document processing to complete on the admin side
        await waitForConnectionCompletion(applicantPage);

        // 7. Verify Document State: Reject (Manual Override)
        files = await navigateToFilesTabAndReload(page, sessionId);

        // Locate the row for the second uploaded file (assuming the first file in financialVerification.files is the one)
        const fileToManage = financialVerification.files[0];
        const fileRowLocator = allWrapper.getByTestId(`all-tr-${fileToManage.id}`);

        console.log('➡️ Initiating Accept -> Reject cycle on processed document.');

        // Waiting for document to get rejected
        let count = 0
        let textdata = '';
        do {
            await page.reload();
            await page.getByTestId('files-section-header').click();
            await page.getByTestId('document-tab-all').click();
            await expect(page.getByTestId('file-section-all-wrapper')).toBeVisible();
            textdata = await fileRowLocator.getByTestId('files-document-status-pill').textContent()
            await page.waitForTimeout(5000);
            count++;
        } while (!textdata.includes('Rejected') || count > 5)

        await expect(fileRowLocator.getByTestId('files-document-status-pill')).toContainText('Rejected', { timeout: 20_000 })

        // Initially Accepting document to check reject
        await acceptDocument(fileRowLocator, page, sessionId);

        // Rejecting document
        await rejectDocument(fileRowLocator, page, sessionId);

        // Clean up context is generally a good practice for isolated tests
        await applicantPageContext.close();
    });
});