import { expect, test } from '@playwright/test';
import { adminLoginAndNavigateToApplications } from './utils/session-utils';
import { admin, app } from './test_config';
import { findAndCopyApplication } from './utils/applications-page';
import { completeApplicantForm, completeApplicantRegistrationForm, connectBankOAuthFlow, setupInviteLinkSession, waitForElementVisible, waitForElementText, verifyAndClickSkipButton } from './utils/session-flow';
import { waitForJsonResponse } from './utils/wait-response';
import { joinUrl } from './utils/helper';
import { cleanupSession } from './utils/cleanup-helper';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Test suite for verifying the availability and behavior of the "Skip" button
 * on steps that are in-progress, failed, or incomplete.
 */
const appName = 'AutoTest Suite - Full Test'
let createdSessionId = null;

test.describe('QA-228 skip_button_availability_non_complete_steps.spec', () => {
    /**
     * There is a feature: If financial step is skipped then the employment
     * step becomes mandatory even if it is skippable.
     * Because of this, we FIRST complete the financial step, 
     * then return to skipping employment to ensure correct skip behavior.
     */
    test('Verify Skip Button Remains Available for In Progress, Failed, and Incomplete Steps', {
        tag: ['@smoke', '@needs-review'],
        timeout: 360_000
    }, async ({ page, context }) => {
        test.setTimeout(360_000)
        // ------ Step 1: Admin Login and Navigation ------
        console.log('🚀 Step 1: Logging in as admin and navigating to Applications page...');
        await adminLoginAndNavigateToApplications(page, admin);
        console.log('✅ Step 1: Logged in and navigated to Applications page.');

        // ------ Step 2: Find application and copy applicant link ------
        console.log('🚀 Step 2: Locating the test application and copying invite link...');
        const applicationUrl = await findAndCopyApplication(page, appName);
        console.log(`✅ Step 2: Invite link copied: ${applicationUrl}`);

        // ------ Step 3: Logout current admin user ------
        console.log('🚪 Step 3: Logging out current admin user...');
        await page.getByTestId('user-dropdown-toggle-btn').click();
        await page.getByTestId('user-logout-dropdown-item').click();
        await page.waitForTimeout(2000);
        console.log('✅ Step 3: Logged out.');

        // ------ Step 4: Navigate as applicant using the copied link ------
        console.log('🌐 Step 4: Navigating to application invite link as applicant...');
        await page.goto(applicationUrl);

        // ------ Step 5: Simulate phone login flow ------
        const phoneNumber = generateRandomPhone();
        console.log(`📱 Step 5: Completing phone verification for applicant: ${phoneNumber}...`);
        await page.getByTestId('phone-input').fill(phoneNumber);
        await page.getByTestId('get-started-btn').click();

        // Fill out SMS-code input (simulate 123456 input)
        const codeInputs = page.locator('input[placeholder="-"]');
        await expect(codeInputs).toHaveCount(6);
        for (let i = 0; i < 6; i++) {
            await codeInputs.nth(i).fill(String(i + 1));
        }
        await page.locator('button[type="submit"]').click();
        console.log('✅ Step 5: Phone verification complete.');

        // ------ Step 6: Applicant registration ------
        /**
         * Here, we capture the session upon applicant registration by waiting
         * for the GET /sessions response right after submitting form.
         */
        console.log('📝 Step 6: Registering applicant...');
        const [sessionResp] = await Promise.all([
            page.waitForResponse(resp => {
                const regex = new RegExp(`${joinUrl(app.urls.api, '/sessions/.{36}[?].+')}`);
                return regex.test(resp.url())
                    && resp.request().method() === 'GET'
                    && resp.ok();
            }),
            completeApplicantRegistrationForm(page, {
                firstName: 'Step',
                lastName: 'Skip',
                state: 'ALASKA'
            })
        ]);
        const { data: session } = await waitForJsonResponse(sessionResp);
        const sessionId = session?.id;
        createdSessionId = sessionId;
        console.log(`✅ Step 6: Applicant registered with session ID: ${sessionId}`);

        // Setup the applicant's invite link session
        await setupInviteLinkSession(page, {
            sessionUrl: `/sessions/${sessionId}`,
            applicantTypeSelector: '#affordable_primary'
        });

        // Complete initial applicant form questions
        await completeApplicantForm(page, '555', sessionId);
        await page.waitForTimeout(4000);

        // ------ Step 7: Skip applicant invite step ------
        console.log('🚀 Step 7: Skipping applicant invite step to proceed to ID Verification...');
        await expect(page.getByTestId('applicant-invite-skip-btn')).toBeVisible({ timeout: 10_000 });
        await page.getByTestId('applicant-invite-skip-btn').click();
        console.log('✅ Step 7: Applicant invite step skipped.');

        // ------ Step 8: Interact with ID Verification step ------
        const idStep = page.getByTestId('identify-step')
        await expect(idStep).toBeVisible({ timeout: 10_000 });
        console.log('🆔 Step 8: On ID verification step.');

        const idConnectBtn = idStep.getByTestId('start-id-verification');
        await expect(idConnectBtn).toBeVisible();

        // Start ID verification, monitor creation API
        console.log('🕵️‍♂️ Starting ID verification...');
        const [identityVerificationResponse] = await Promise.all([
            page.waitForResponse(
                resp => resp.url().includes('/identity-verifications')
                    && resp.request().method() === 'POST'
                    && resp.ok()
            ),
            idConnectBtn.click()
        ]);
        const { data: identityVerification } = await waitForJsonResponse(identityVerificationResponse);

        // Wait for Persona iFrame and launch
        await page.waitForSelector('[data-testid="persona-widget__iframe"]', { timeout: 15000 });

        const personaFrame = page.frameLocator('[data-testid="persona-widget__iframe"]');
        // Begin verification through Persona "Begin verifying"
        await expect(
            personaFrame.locator('[data-test="button__primary"]:has-text("Begin verifying")')
        ).toBeVisible({ timeout: 10000 });
        await personaFrame.locator('[data-test="button__primary"]:has-text("Begin verifying")').click();

        // Cancel Persona (simulate close)
        await personaFrame.locator('[title="XIcon"]').click();

        // Select verification document
        await expect(
            personaFrame.locator('[data-test="button__primary"]:has-text("Select")')
        ).toBeVisible({ timeout: 10000 });
        await personaFrame.locator('[data-test="button__primary"]:has-text("Select")').click();

        // Choose passport for verification
        await expect(personaFrame.locator('#select__option--pp')).toBeVisible({ timeout: 10000 });
        await personaFrame.locator('#select__option--pp').click();

        // Close persona modal and confirm exit
        await personaFrame.locator('[data-test="navbar__close-link"]').click();
        await personaFrame.locator('[data-test="confirm-exit-dialog__button--close"]').click();
        console.log('⏹️ Persona widget interaction finished, returning to Identity step...');

        // Ensure status updates to 'incomplete'
        const idStatusTile = idStep.getByTestId(`identity-status-${identityVerification.id}`)
        await page.waitForTimeout(1000);
        await idStep.click();
        await expect(idStatusTile).toBeVisible({ timeout: 30_000 });

        const statusTextDiv = await idStatusTile.getByTestId('verification-status')
        await expect(statusTextDiv).toHaveText('incomplete', { ignoreCase: true, timeout: 20_000 })

        // Confirm skip button is available on incomplete ID verification step and click it
        await verifyAndClickSkipButton(
            page,
            idStep,
            'identity-skip-btn',
            'ID Verification',
            'IDENTITY_VERIFICATION'
        );

        // ------ Step 9: Interact with Financial Verification ------
        const financialStep = page.getByTestId('financial-verification-step');
        await expect(financialStep).toBeVisible();
        // Confirm financial skip and connect buttons are available
        const finSkipBtn = financialStep.getByTestId('skip-financials-btn');
        await expect(finSkipBtn).toBeVisible();
        const finConnectBtn = financialStep.getByTestId('connect-bank');
        await expect(finConnectBtn).toBeVisible();

        // Try connecting bank and intentionally cause a failure
        console.log('💸 Attempting bank connect in financial step...');
        const responsePromise = page.waitForResponse(resp => resp.url().includes('/financial-verifications')
            && resp.request().method() === 'POST'
            && resp.ok()
        );
        
        await finConnectBtn.click();
        
        // Handle bank connect info modal (Acknowledge), if it appears
        // This must be done after clicking but may need to complete before POST response
        console.log('➡️ Checking for bank connect info modal...');
        await handleBankConnectInfoModal(page);
        
        const financialVerificationResponse = await responsePromise;
        const { data: financialVerification } = await waitForJsonResponse(financialVerificationResponse);

        // Proceed through third-party bank selection (simulate bad login)
        const mxFrame = page.frameLocator('iframe[src*="int-widgets.moneydesktop.com"]');
        await expect(mxFrame.locator('[data-test="MX-Bank-tile"]')).toBeVisible({ timeout: 20_000 });
        const mxBtn = mxFrame.locator('[data-test="MX-Bank-tile"]');
        await mxBtn.click();
        const mxCredForm = mxFrame.locator('#credentials_form');
        await expect(mxCredForm).toBeVisible();
        await mxCredForm.locator('#LOGIN').fill('test-bad');
        await mxCredForm.locator('#PASSWORD').fill('test');
        await mxCredForm.locator('[data-test="credentials-continue"]').click();

        // Confirm error is presented
        await expect(mxFrame.locator('[data-test="credentials-error-message-box"]')).toBeVisible({ timeout: 20_000 });

        // Cancel the bank connection modal
        console.log('➡️ Closing bank connect modal...');
        await page.getByTestId('connnect-modal-cancel').click();
        
        // Handle "Can't find your bank or having an issue?" options modal that may appear
        console.log('➡️ Checking for bank connect options modal...');
        await handleBankConnectOptionsModal(page, 'back');
        
        await page.waitForTimeout(4000);

        // Wait for failed connection row to appear (use robust polling pattern from MX tests)
        console.log('⏳ Waiting for financial connection row to be recorded...');
        const finConnectionRow = financialStep.getByTestId('connection-row');
        const connectionRecordMaxAttempts = 40; // 40 attempts = 80 seconds max
        const connectionRecordPollInterval = 2000; // 2 seconds
        let connectionRecordAttempt = 0;
        let connectionRecorded = false;

        while (!connectionRecorded && connectionRecordAttempt < connectionRecordMaxAttempts) {
            try {
                const connectionRowCount = await finConnectionRow.count().catch(() => 0);

                if (connectionRowCount > 0) {
                    console.log(`✅ Financial connection row detected (attempt ${connectionRecordAttempt + 1})`);
                    connectionRecorded = true;
                    break;
                }

                connectionRecordAttempt++;
                if (connectionRecordAttempt < connectionRecordMaxAttempts) {
                    console.log(`   Attempt ${connectionRecordAttempt}/${connectionRecordMaxAttempts}: Waiting for financial connection row...`);
                    await page.waitForTimeout(connectionRecordPollInterval);
                }
            } catch (error) {
                connectionRecordAttempt++;
                if (connectionRecordAttempt < connectionRecordMaxAttempts) {
                    console.log(`   ⚠️ Error checking financial connection row (attempt ${connectionRecordAttempt}): ${error.message}`);
                    await page.waitForTimeout(connectionRecordPollInterval);
                }
            }
        }

        if (!connectionRecorded) {
            throw new Error(`Connection row did not become visible after ${connectionRecordMaxAttempts * connectionRecordPollInterval / 1000} seconds`);
        }
        console.log('✅ Financial connection row found and recorded.');

        // Wait for financial-row-status to actually say 'failed'
        const finStatusLocator = finConnectionRow.getByTestId('financial-row-status');
        await waitForElementText(page, finStatusLocator, 'failed', {
            maxAttempts: 10,
            pollInterval: 5000,
            reloadOnLastAttempt: true,
            errorMessage: 'financial-row-status did not become "failed" after 10 attempts'
        });
        console.log('❌ Simulated failed financial connection.');

        // Check skip button is still present on failed financial verification and click it
        await verifyAndClickSkipButton(
            page,
            financialStep,
            'skip-financials-btn',
            'Financial Verification',
            'FINANCIAL_VERIFICATION'
        );

        // Get financial step status locator for later use
        const financialStepStatus = page.locator('[data-testid^="step-FINANCIAL_VERIFICATION"]').filter({ visible: true });

        // ------ Step 10: Employment Step (after skipping financial) ------
        const employmentStep = page.getByTestId('employment-verification-step');
        await expect(employmentStep).toBeVisible();
        await page.waitForTimeout(3000);

        // Toggle expand/close on summary tile for robust UI state
        await financialStepStatus.click();
        await page.waitForTimeout(1000);
        await financialStepStatus.click();
        await page.waitForTimeout(1000);

        // Now, successfully connect a bank to enable next flow
        console.log('🏦 Step 11: Connecting with valid bank flow...');
        await bankConnect(page, context);

        // Click financial continue to move to employment
        const finCompleteBtn = financialStep.getByTestId('financial-verification-continue-btn');
        await expect(finCompleteBtn).toBeVisible();
        await finCompleteBtn.click();
        console.log('✅ Continued past financial step after connecting bank.');

        await expect(employmentStep).toBeVisible({ timeout: 20_000 });

        // Upload paystub, keep step "in progress" (simulate failed employment doc)
        console.log('📄 Step 12: Uploading employment document to trigger failure...');
        
        // Click paystub upload button and handle intro modal if it appears
        await page.getByTestId('document-pay_stub').click();
        await page.locator('button').filter({ hasText: /^Upload Paystubs$/ }).click();
        
        // Handle "Upload your Paystubs" intro modal, if present
        console.log('➡️ Checking for upload paystubs intro modal...');
        await handleUploadPaystubsIntroModal(page);
        
        // Continue with the rest of the upload flow
        const cadence = 'Bi-Weekly';
        await page.locator('.multiselect__tags').click();
        await page.locator('li').filter({ hasText: new RegExp(`^${cadence}$`) }).click();
        
        const __dirname = dirname(fileURLToPath(import.meta.url));
        const resolvedFilePaths = join(__dirname, 'test_files', 'id-back.png');
        
        const paystubFileInput = page.locator('input[type="file"]');
        await paystubFileInput.setInputFiles(resolvedFilePaths);
        await page.waitForTimeout(2000);
        
        const [employmentResponse] = await Promise.all([
            page.waitForResponse(resp => 
                resp.url().includes('/employment-verifications') &&
                resp.request().method() === 'POST' &&
                resp.ok()
            , { timeout: 30000 }),
            page.locator('button').filter({ hasText: /^Submit$/ }).click()
        ]);
        
        // Wait for Pay Stub section to appear and check for processing (same as utility function)
        await expect(page.getByText('Pay StubProcessing')).toBeVisible({ timeout: 90_000 });
        const employmentData = await employmentResponse.json();
        let employmentVerification = employmentData;

        const empConnectionRow = employmentStep.getByTestId('connection-row');
        await expect(empConnectionRow).toBeVisible({ timeout: 30_000 });

        await expect(empConnectionRow.getByTestId('connection-row-row-status')).toHaveText('failed', { ignoreCase: true, timeout: 120_000 });
        console.log('❌ Detected employment document was marked failed.');

        // Check skip button available after failure and skip
        await verifyAndClickSkipButton(
            page,
            employmentStep,
            'employment-step-skip-btn',
            'Employment Verification',
            'EMPLOYMENT_VERIFICATION'
        );

        // Confirm summary step is reached
        const summaryStep = page.getByTestId('summary-step');
        await expect(summaryStep).toBeVisible();
        console.log('✅ Test successfully reached application summary step, skip buttons available after incomplete/failed steps.');
    });

    /**
     * Test clean-up: remove session created during the test
     */
    test.afterAll(async ({ request }, testInfo) => {
        console.log('🧹 Cleaning up test session data...');
        await cleanupSession(request, createdSessionId, testInfo.status === 'passed');
        console.log('✅ Clean up complete.');
    });
});

/**
 * Handle bank connect info modal that may appear after clicking connect-bank
 * @param {import('@playwright/test').Page} page
 */
async function handleBankConnectInfoModal(page) {
    const maxAttempts = 10;      // up to ~10 seconds
    const intervalMs = 1000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const dialog = page.getByRole('dialog');
        const dialogVisible = await dialog.isVisible().catch(() => false);

        if (dialogVisible) {
            const titleVisible = await dialog
                .getByText('Bank Connect Information — Please Read')
                .isVisible()
                .catch(() => false);

            if (titleVisible) {
                const acknowledgeBtn = dialog.getByRole('button', { name: /Acknowledge/i });
                const btnVisible = await acknowledgeBtn.isVisible().catch(() => false);
                if (btnVisible) {
                    await acknowledgeBtn.click({ timeout: 20_000 });
                    await page.waitForTimeout(500);
                    return;
                }
            }
        }

        await page.waitForTimeout(intervalMs);
    }
}

/**
 * Handle employment "Upload your Paystubs" intro modal that appears
 * after clicking the applicant-side "Upload Paystubs" button.
 *
 * We poll briefly for the dialog and click its "Upload Paystubs" primary
 * button so the underlying cadence selector and file input are usable.
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
                await page.waitForTimeout(1500);
                return;
            }
        }

        await page.waitForTimeout(intervalMs);
    }
}

/**
 * Handle "Can't find your bank or having an issue?" options modal
 * that can appear right after closing the Bank Connect modal.
 *
 * We handle possible delay by polling for the modal for a few seconds.
 * To avoid flaky DOM detaches on the X icon, we prefer clicking the
 * footer "Back" / "Connect using Plaid" button inside the dialog,
 * and only fall back to the X if needed.
 * If the modal never appears (older builds), this is a no-op.
 *
 * @param {import('@playwright/test').Page} page
 * @param {'back' | 'plaid'} [option='back']
 */
async function handleBankConnectOptionsModal(page, option = 'back') {
    const maxAttempts = 10;      // e.g. up to ~10s
    const intervalMs = 1000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const dialog = page.getByRole('dialog');
        const dialogVisible = await dialog.isVisible().catch(() => false);

        if (dialogVisible) {
            const titleLocator = dialog.getByText("Can't find your bank or having an issue?");
            const titleVisible = await titleLocator.isVisible().catch(() => false);

            if (titleVisible) {
                // Prefer stable footer button inside this dialog
                const buttonName = option === 'plaid' ? /Connect using Plaid/i : /Back/i;
                const button = dialog.getByRole('button', { name: buttonName });
                const buttonVisible = await button.isVisible().catch(() => false);

                if (buttonVisible) {
                    try {
                        await button.click({ timeout: 10_000 });
                    } catch {
                        // If the dialog disappears during click, treat as closed
                    }
                    await page.waitForTimeout(500);
                    return;
                }

                // Fallback to header X icon inside the same dialog
                const cancelIcon = dialog.getByTestId('cancel');
                const cancelVisible = await cancelIcon.isVisible().catch(() => false);
                if (cancelVisible) {
                    try {
                        await cancelIcon.click({ timeout: 10_000 });
                    } catch {
                        // If the dialog disappears during click, treat as closed
                    }
                    await page.waitForTimeout(500);
                    return;
                }
            }
        }

        // Modal not ready yet; wait and retry
        await page.waitForTimeout(intervalMs);
    }
}

/**
 * Helper to generate a "fake" US-based phone number for the login process.
 * @returns {string} Phone number beginning with 613292
 */
const generateRandomPhone = () => {
    const random4Digits = Math.floor(1000 + Math.random() * 9000);
    return `613292${random4Digits}`;
};

/**
 * Helper function to perform a valid bank connect flow via oAuth/MX.
 * This is called to ensure the financial step goes to "complete" when needed.
 * @param {import('@playwright/test').Page} page 
 * @param {*} context 
 */
async function bankConnect(page, context) {
    const financialStep2 = page.getByTestId('financial-verification-step');
    await expect(financialStep2).toBeVisible({ timeout: 20000 });

    const finConnectBtn2 = financialStep2.getByTestId('connect-bank');
    await expect(finConnectBtn2).toBeVisible();

    console.log('🏦 Initiating oAuth bank connection (happy path)...');
    await finConnectBtn2.click();
    
    // Handle bank connect info modal (Acknowledge), if it appears
    console.log('➡️ Checking for bank connect info modal...');
    await handleBankConnectInfoModal(page);
    
    await connectBankOAuthFlow(page, context);
    
    // Handle "Can't find your bank or having an issue?" options modal that may appear after closing
    console.log('➡️ Checking for bank connect options modal after OAuth flow...');
    await handleBankConnectOptionsModal(page, 'back');
    
    console.log('✅ Bank connection done.');
}
