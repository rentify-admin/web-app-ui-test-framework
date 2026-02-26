import { expect, test } from '@playwright/test';
import { adminLoginAndNavigateToApplications } from './utils/session-utils';
import { admin, app } from './test_config';
import { findAndInviteApplication } from './utils/applications-page';
import { setupInviteLinkSession, updateRentBudget, handleSkipReasonModal, handleConnectAcknowledgeModal } from './utils/session-flow';
import generateSessionForm from './utils/generate-session-form';
import { joinUrl } from './utils/helper';
import { waitForJsonResponse } from './utils/wait-response';
import { cleanupTrackedSession } from './utils/cleanup-helper';
import { pollForVerificationStatus } from './utils/polling-helper';
import { uploadPaystubDocuments } from './utils/document-upload-utils';

const APP_NAME = 'Autotest - Employment Upload vs Connection Limits';

let createdSessionId = null;
let guestAuthToken = null;

// ─────────────────────────────────────────────────────────────────────────────

test.describe('QA-373 employment_upload_vs_connection_limits', () => {

    test(
        'Paystub Upload Limit Does NOT Block Employment Connections (VC-1559)',
        { tag: ['@core', '@regression', '@qa-373'] },
        async ({ page, browser }) => {
            test.setTimeout(640_000); // ~10 min 40 sec

            // ── STEP 1: Admin login & navigate to Applications ──────────────
            console.log('STEP 1: Logging in as admin and navigating to Applications');
            await adminLoginAndNavigateToApplications(page, admin);
            await page.waitForTimeout(300);

            // ── STEP 2: Find application and generate invite link ───────────
            console.log(`STEP 2: Finding application "${APP_NAME}" and opening invite modal`);
            await findAndInviteApplication(page, APP_NAME);

            const userData = {
                first_name: 'UploadLimit',
                last_name: 'ConnTest',
                email: 'uploadlimit.conntest@verifast.com',
            };

            console.log('STEP 2b: Generating session for applicant & extracting invite link');
            const { sessionId, link } = await generateSessionForm.generateSessionAndExtractLink(page, userData);
            createdSessionId = sessionId;
            console.log(`   Session ID: ${sessionId}`);

            // ── STEP 3: Open applicant session in new browser context ───────
            console.log('STEP 3: Opening applicant session in new browser context');
            const linkUrl = new URL(link);
            const applicantContext = await browser.newContext();
            const applicantPage = await applicantContext.newPage();

            // Set up guest auth token capture BEFORE navigation
            console.log('STEP 3.5: Setting up guest auth token capture (BEFORE navigation)');
            const tokenPromise = applicantPage
                .waitForResponse(
                    resp => resp.url().includes('/auth/guest') && resp.ok(),
                    { timeout: 30_000 }
                )
                .then(async resp => {
                    const body = await resp.json();
                    const token = body.data?.token || body.token;
                    console.log('Captured guest auth token');
                    return token;
                })
                .catch(err => {
                    console.log('Failed to capture guest auth token:', err.message);
                    return null;
                });

            const gotoUrl = joinUrl(app.urls.app, `${linkUrl.pathname}${linkUrl.search}`);
            console.log('Navigating applicant to:', gotoUrl);
            await applicantPage.goto(gotoUrl);

            console.log('STEP 3b: Accept terms, choose type & state');
            await setupInviteLinkSession(applicantPage);

            guestAuthToken = await tokenPromise;
            if (!guestAuthToken) {
                throw new Error('Failed to capture guest authentication token — cannot proceed with API polling');
            }

            // ── STEP 4: Set rent budget ─────────────────────────────────────
            console.log('STEP 4: Setting rent budget to 2500');
            await updateRentBudget(applicantPage, sessionId, '2500');

            // ── STEP 5: Skip pre-screening (if present) ─────────────────────
            console.log('STEP 5: Checking for pre-screening step...');
            const preScreeningVisible = await applicantPage
                .getByTestId('pre-screening-step')
                .isVisible({ timeout: 20_000 })
                .catch(() => false);

            if (preScreeningVisible) {
                console.log('Pre-screening visible — skipping');
                await applicantPage.getByTestId('pre-screening-skip-btn').click();
                await handleSkipReasonModal(applicantPage, 'Skipping pre-screening for upload vs connection limit test');
            } else {
                console.log('Pre-screening not present — continuing');
            }

            // ── STEP 6: Wait for employment verification step ───────────────
            console.log('STEP 6: Waiting for employment-verification-step to be visible');
            await expect(applicantPage.getByTestId('employment-verification-step')).toBeVisible({ timeout: 20_000 });

            // ── STEP 7: Verify initial state — both Upload AND Connect available
            console.log('STEP 7: Verifying initial state — both Upload and Connect options available');
            await applicantPage.getByTestId('document-pay_stub').click();

            // EmploymentConnect renders on MENU stage — both buttons visible
            await expect(applicantPage.getByTestId('employment-upload-paystub-btn')).toBeVisible({ timeout: 10_000 });
            console.log('   employment-upload-paystub-btn is visible (canUpload=true, no uploads yet)');

            await expect(applicantPage.getByTestId('directly-connect-emp-btn')).toBeVisible({ timeout: 10_000 });
            console.log('   directly-connect-emp-btn is visible (canConnect=true, no connections yet)');

            // Return to DocumentButtons (emits 'back', stage resets to INITIAL)
            await applicantPage.getByTestId('employment-back-btn').click();
            await applicantPage.waitForTimeout(500);
            console.log('   Clicked employment-back-btn — returned to DocumentButtons (INITIAL stage)');

            // ── STEP 8: Upload first paystub ────────────────────────────────
            console.log('STEP 8: Uploading first paystub (paystub_recent.pdf)');
            const { data: firstVerification } = await uploadPaystubDocuments(applicantPage, ['paystub_recent.pdf'], { waitForCompletion: false, continueStep: false });

            // ── STEP 9: Poll for first verification to complete/process ─────
            console.log('STEP 9: Polling for first employment verification to complete');
            await pollForVerificationStatus(
                applicantPage.context(),
                firstVerification.id,
                'employment-verifications',
                {
                    maxAttempts: 50,
                    pollInterval: 2000,
                    successStatuses: ['COMPLETED', 'PROCESSING'],
                    authToken: guestAuthToken,
                }
            );
            console.log('First employment verification COMPLETED/PROCESSING');

            // ── STEP 10: Upload second paystub (to reach the upload limit) ──
            console.log('STEP 10: Uploading second paystub (paystub_recent.png) — to reach upload limit of 2');
            const { data: secondVerification } = await uploadPaystubDocuments(applicantPage, ['paystub_recent.png'], { waitForCompletion: false, continueStep: false });

            // ── STEP 11: Poll for second verification to complete/process ───
            console.log('STEP 11: Polling for second employment verification to complete');
            await pollForVerificationStatus(
                applicantPage.context(),
                secondVerification.id,
                'employment-verifications',
                {
                    maxAttempts: 50,
                    pollInterval: 2000,
                    successStatuses: ['COMPLETED', 'PROCESSING'],
                    authToken: guestAuthToken,
                }
            );
            console.log('Second employment verification COMPLETED/PROCESSING');

            // ── STEP 12: KEY ASSERTION — VC-1559 fix ────────────────────────
            // Upload limit reached (2/2 uploads). Connection limit NOT reached (0/2 connections).
            // Clicking the pill should still open EmploymentConnect on MENU stage
            // (not show the inline pay_stub-limit-error) because canConnect=true.
            console.log('STEP 12: KEY ASSERTION — VC-1559 fix verification');
            console.log('   Clicking document-pay_stub pill after upload limit is reached...');
            await applicantPage.getByTestId('document-pay_stub').click();

            // The pill should NOT show the inline limit error — EmploymentConnect MENU should open
            // (pay_stub-limit-error only appears when BOTH upload AND connection limits are exhausted)
            const limitError = applicantPage.getByTestId('pay_stub-limit-error');
            const limitErrorVisible = await limitError.isVisible({ timeout: 3_000 }).catch(() => false);
            if (limitErrorVisible) {
                // Both limits exhausted — unexpected for this test config (connection limit not reached)
                throw new Error(
                    'pay_stub-limit-error IS visible — both upload AND connection limits appear exhausted. ' +
                    'Check application config: connection should still be available (maxConnections=2, connections=0).'
                );
            }
            console.log('   pay_stub-limit-error is NOT visible — EmploymentConnect opened correctly');

            // Wait for MENU stage to appear (at least one MENU button visible)
            await expect(
                applicantPage.getByTestId('directly-connect-emp-btn')
            ).toBeVisible({ timeout: 10_000 });

            // Upload button MUST NOT be visible — upload limit reached (2/2)
            await expect(applicantPage.getByTestId('employment-upload-paystub-btn')).not.toBeVisible({ timeout: 5_000 });
            console.log('   employment-upload-paystub-btn is NOT visible (canUpload=false — upload limit reached)');

            // Connect button MUST still be visible — connection limit NOT reached (0/2)
            await expect(applicantPage.getByTestId('directly-connect-emp-btn')).toBeVisible({ timeout: 5_000 });
            console.log('   directly-connect-emp-btn IS STILL VISIBLE (canConnect=true) — CORE VC-1559 assertion PASSED!');

            // ── STEP 13: Verify connection flow can be started ───────────────
            console.log('STEP 13: Verifying employment connection flow can still be started');
            await applicantPage.getByTestId('directly-connect-emp-btn').click({ timeout: 10_000 });

            // Handle acknowledge modal — only connect button shown (upload section hidden per canUpload=false)
            await handleConnectAcknowledgeModal(applicantPage);

            // Connection flow should proceed: simulation connect button or Atomic provider screen
            const simulationConnectBtn = applicantPage.getByTestId('employment-simulation-connect-btn');
            const simulationVisible = await simulationConnectBtn.isVisible({ timeout: 10_000 }).catch(() => false);

            if (simulationVisible) {
                console.log('   employment-simulation-connect-btn is visible — connection flow started successfully!');
            } else {
                // In non-simulation mode Atomic/external provider may load instead
                console.log('   Simulation button not found — checking for Atomic/external provider screen');
                const empIFrame = applicantPage.frameLocator('#atomic-transact-iframe')
                await expect(empIFrame.locator('#closeButton')).toBeVisible({ timeout: 15_000 });
                await empIFrame.locator('#closeButton').click(); // Close the provider screen to clean up for test end
                await empIFrame.locator('button', { hasText: 'Return to Verifast' }).click();
                console.log('   MENU stage exited — Atomic/external provider flow was likely shown, indicating connection flow started successfully!');
            }

            // ── STEP 14: Verify final state — limits tracked independently ──
            console.log('STEP 14: Verifying final state — both limits tracked independently');

            // Navigate back toward DocumentButtons (may need 1–2 back clicks)
            const backBtn = applicantPage.getByTestId('employment-back-btn');
            const backVisible = await backBtn.isVisible({ timeout: 8_000 }).catch(() => false);
            if (backVisible) {
                await backBtn.click();
                await applicantPage.waitForTimeout(500);
            }
            const backBtn2 = applicantPage.getByTestId('employment-back-btn');
            const backVisible2 = await backBtn2.isVisible({ timeout: 5_000 }).catch(() => false);
            if (backVisible2) {
                await backBtn2.click();
                await applicantPage.waitForTimeout(500);
            }

            // Click pay_stub pill one more time — EmploymentConnect should still open (connection slots remain)
            await applicantPage.getByTestId('document-pay_stub').click();
            await expect(applicantPage.getByTestId('directly-connect-emp-btn')).toBeVisible({ timeout: 10_000 });
            console.log('   EmploymentConnect still opens — connection slots remain available');

            // Upload button still NOT visible (upload limit persists)
            await expect(applicantPage.getByTestId('employment-upload-paystub-btn')).not.toBeVisible({ timeout: 5_000 });
            console.log('   Upload button still NOT visible — upload limit persists correctly');

            // Return to DocumentButtons
            await applicantPage.getByTestId('employment-back-btn').click();
            await applicantPage.waitForTimeout(500);

            // pay_stub pill is still rendered (reflects existing upload verifications)
            const paystubPill = applicantPage.getByTestId('document-pay_stub');
            await expect(paystubPill).toBeVisible({ timeout: 5_000 });
            console.log('   document-pay_stub pill is visible — reflects existing uploaded paystub verifications');

            console.log('TEST COMPLETE — VC-1559 fix confirmed: paystub upload limit does NOT block employment connections!');

            await applicantContext.close();
        }
    );

    test.afterEach(async ({ request }, testInfo) => {
        await cleanupTrackedSession(request, createdSessionId, testInfo);
        createdSessionId = null;
        guestAuthToken = null;
    });

});
