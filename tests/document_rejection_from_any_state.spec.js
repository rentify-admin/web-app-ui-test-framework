import { expect, test } from "@playwright/test";
import { admin, app, user } from "./test_config";
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { adminLoginAndNavigateToApplications } from "./utils/session-utils";
import { findAndInviteApplication } from "./utils/applications-page";
import generateSessionForm from "./utils/generate-session-form";
import { getRandomEmail, joinUrl } from "./utils/helper";
import { waitForJsonResponse } from "./utils/wait-response";
import { setupInviteLinkSession, updateRentBudget, waitForConnectionCompletion } from "./utils/session-flow";
import { gotoPage } from "./utils/common";
import { findSessionLocator, searchSessionWithText } from "./utils/report-page";
import { cleanupSessionAndContexts } from "./utils/cleanup-helper";

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
    const pillLink = rowLocator.getByTestId('files-document-status-pill').locator('a');
    
    // Scroll into view and wait for it to be visible and clickable
    await pillLink.scrollIntoViewIfNeeded();
    await pillLink.waitFor({ state: 'visible', timeout: 10000 });
    await pillLink.click();

    await expect(page.getByTestId('decision-modal')).toBeVisible();
    const decisionModal = page.getByTestId('decision-modal');

    console.log('Attempting to fail document...');
    const [filesResponse] = await Promise.all([
        page.waitForResponse(
            resp => resp.url().includes(`/sessions/${sessionId}/files?fields[file]`) && resp.ok() && resp.request().method() === 'GET'
        ),
        decisionModal.getByTestId('decision-modal-processing-btn').click()
    ]);

    await waitForJsonResponse(filesResponse);
    await page.waitForTimeout(2000);
    await expect(rowLocator.getByTestId('files-document-status-pill')).toContainText('Failed', { timeout: 30_000 });
    console.log('✅ Document successfully failed.');
}

/**
 * Reject a document from a given row and verifies the status is 'Rejected'.
 */
async function rejectDocument(rowLocator, page, sessionId) {
    const pillLink = rowLocator.getByTestId('files-document-status-pill').locator('a');
    
    // Scroll into view and wait for it to be visible and clickable
    await pillLink.scrollIntoViewIfNeeded();
    await pillLink.waitFor({ state: 'visible', timeout: 10000 });
    await pillLink.click();

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
    await page.waitForTimeout(2000);
    await expect(rowLocator.getByTestId('files-document-status-pill')).toContainText('Rejected', { timeout: 30_000 });
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
    await page.waitForTimeout(2000);
    await expect(rowLocator.getByTestId('files-document-status-pill')).toContainText('Accepted', { timeout: 30_000 });
    console.log('✅ Document successfully accepted.');
}

// --- Main Test Suite ---

test.describe('QA-208: Document Rejection from Any State', () => {
    test.describe.configure({
        timeout: 280000
    });

    const appName = 'AutoTest - Doc Rejec for any state test';
    let sessionId;
    let applicantPageContext;
    let allTestsPassed = true;

    test('Reject a Document Regardless of Processing State', {
        tag: ['@regression', '@rc-ready', '@staging-ready']
    }, async ({ page, browser }) => {
        try {
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
            
            await setupInviteLinkSession(applicantPage, {
                sessionUrl: sessionInfo.sessionUrl,
                applicantTypeSelector: '#affordable_occupant'
            });
            
            await updateRentBudget(applicantPage, sessionId, '1500');


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

            // 7. Wait for document to be auto-rejected
            files = await navigateToFilesTabAndReload(page, sessionId);

            // Locate the row for the second uploaded file
            const fileToManage = financialVerification.files[0];
            const fileRowLocator = allWrapper.getByTestId(`all-tr-${fileToManage.id}`);

            console.log('➡️ Waiting for document to be auto-rejected...');

            // Poll with longer timeout to allow processing in CI
            let count = 0;
            let textdata = '';
            do {
                await page.reload();
                await page.getByTestId('files-section-header').click();
                await page.getByTestId('document-tab-all').click();
                await expect(page.getByTestId('file-section-all-wrapper')).toBeVisible();
                textdata = await fileRowLocator.getByTestId('files-document-status-pill').textContent();
                await page.waitForTimeout(5000);
                count++;
            } while (!textdata.includes('Rejected') && count < 20);  // Increased from 5 to 20 attempts (100 seconds max)

            await expect(fileRowLocator.getByTestId('files-document-status-pill')).toContainText('Rejected', { timeout: 30_000 });

            console.log('➡️ Testing Accept -> Reject cycle on processed document.');

            // Accept the rejected document
            await acceptDocument(fileRowLocator, page, sessionId);

            // Reject it again
            await rejectDocument(fileRowLocator, page, sessionId);

            console.log('✅ Document rejection test completed successfully');
        } catch (error) {
            console.error('❌ Test failed:', error.message);
            allTestsPassed = false;
            throw error;
        }
        // Note: Context cleanup happens in afterAll
    });
    
    // ✅ Centralized cleanup
    test.afterAll(async ({ request }) => {
        await cleanupSessionAndContexts(
            request,
            sessionId,
            applicantPageContext,
            null,  // No admin context
            allTestsPassed
        );
    });
});