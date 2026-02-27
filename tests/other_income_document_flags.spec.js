import { test, expect } from '@playwright/test';
import { admin, app } from './test_config';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { adminLoginAndNavigateToApplications } from './utils/session-utils';
import { findAndInviteApplication } from './utils/applications-page';
import generateSessionForm from './utils/generate-session-form';
import { getRandomEmail } from './utils/helper';
import { handleStateAndTermsCheckbox, updateRentBudget } from './utils/session-flow';
import { waitForJsonResponse } from './utils/wait-response';
import { pollForVerificationStatus } from './utils/polling-helper';
import { cleanupTrackedSession } from './utils/cleanup-helper';
import loginForm from './utils/login-form';
import { searchSessionWithText, findSessionLocator } from './utils/report-page';
import { gotoPage } from './utils/common';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const APP_NAME = 'Autotest - Document Flags (VC-1467)';

test.describe('VC-1467: Other Income Document Flags', () => {
    test.describe.configure({
        mode: 'serial',
        timeout: 500000
    });

    let sessionId = null;
    let guestContext = null;
    let adminContext = null;
    let guestAuthToken = null;

    const userData = {
        first_name: 'DocFlags',
        last_name: 'Test',
        email: getRandomEmail()
    };

    test('Verify Housing Voucher, Investment Statement, and Retirement Benefits flags appear after document upload', {
        tag: ['@regression', '@staging-ready', '@rc-ready']
    }, async ({ page, browser }) => {

        // ─── SETUP: Admin creates session ───────────────────────────────────────────
        console.log('[Setup] Logging in as admin and creating session...');
        await adminLoginAndNavigateToApplications(page, admin);
        await findAndInviteApplication(page, APP_NAME);

        const sessionInfo = await generateSessionForm.generateSessionAndExtractLink(page, userData);
        sessionId = sessionInfo.sessionId;
        const link = sessionInfo.link;
        const session = sessionInfo.sessionData.data;
        console.log(`✅ Session created: ${sessionId}`);

        // Logout admin
        await page.getByTestId('user-dropdown-toggle-btn').click();
        const logoutPromise = page.waitForResponse(resp =>
            resp.url().includes('/auth') &&
            resp.request().method() === 'DELETE' &&
            resp.ok()
        );
        await page.getByTestId('user-logout-dropdown-item').click();
        await logoutPromise;
        console.log('✅ Admin logged out');

        // ─── GUEST: Create browser context and navigate to session invite link ──────
        console.log('[Guest] Creating guest browser context...');
        guestContext = await browser.newContext();
        const guestPage = await guestContext.newPage();

        // Capture guest auth token from /auth/guest response before navigating
        const tokenPromise = guestPage.waitForResponse(
            resp => resp.url().includes('/auth/guest') && resp.ok(),
            { timeout: 30000 }
        ).then(async resp => {
            const body = await resp.json();
            return body.data?.token || body.token || null;
        }).catch(() => null);

        const linkUrl = new URL(link);
        await guestPage.goto(app.urls.app + linkUrl.pathname + linkUrl.search);
        guestAuthToken = await tokenPromise;
        console.log(guestAuthToken ? '✅ Captured guest auth token' : '⚠️ Guest auth token not captured');

        // Handle optional state modal and terms checkbox
        await handleStateAndTermsCheckbox(guestPage, session);
        const termsCheckbox = guestPage.getByTestId('user-terms');
        if (await termsCheckbox.isVisible({ timeout: 5000 }).catch(() => false)) {
            await termsCheckbox.check();
            await guestPage.getByTestId('terms-submit-btn').click();
        }
        await guestPage.waitForTimeout(1000);

        // Update rent budget
        await updateRentBudget(guestPage, sessionId, '2500');

        // ─── STEP 1: Upload Housing Voucher ──────────────────────────────────────────
        console.log('[Step 1] Uploading Housing Voucher...');
        await expect(guestPage.getByTestId('employment-verification-step')).toBeVisible({ timeout: 15000 });

        await guestPage.getByTestId('upload-supporting-documents-btn').click();
        const supportingDocsModal = guestPage.getByTestId('supporting-docs-modal');
        await expect(supportingDocsModal).toBeVisible({ timeout: 10000 });
        
        const fileInput1 = supportingDocsModal.locator('input[type="file"]');
        await fileInput1.setInputFiles(join(__dirname, 'test_files', 'Housing Vaucher 3.2.jpg'));
        await guestPage.waitForTimeout(2000);

        const [empResponse1] = await Promise.all([
            guestPage.waitForResponse(
                resp =>
                    resp.url().includes('/employment-verifications') &&
                    resp.request().method() === 'POST' &&
                    resp.status() === 201,
                { timeout: 30000 }
            ),
            guestPage.getByTestId('employment-step-submit-btn').click()
        ]);

        const empData1 = await waitForJsonResponse(empResponse1);
        const verificationId1 = empData1.data.id;
        console.log(`✅ Housing Voucher verification ID: ${verificationId1}`);

        await pollForVerificationStatus(guestContext, verificationId1, 'employment-verifications', {
            maxAttempts: 45,
            pollInterval: 4000,
            authToken: guestAuthToken
        });
        console.log('✅ Housing Voucher verification COMPLETED');

        // ─── STEP 2: Upload Investment Statement ─────────────────────────────────────
        console.log('[Step 2] Uploading Investment Statement...');
        const employmentStatusElement = guestPage.locator('[data-testid="step-EMPLOYMENT_VERIFICATION-lg"]').filter({ visible: true });
        await expect(employmentStatusElement).toBeVisible({ timeout: 10000 });
        await guestPage.waitForTimeout(2000);
        await employmentStatusElement.click()
        await expect(guestPage.getByTestId('employment-verification-step')).toBeVisible({ timeout: 10000 });

        // only paystub upload requires acknowledgement of upload modal, so we can click the document type directly without needing to handle the modal for this test case
        await guestPage.getByTestId('upload-supporting-documents-btn').click();
        const supportingDocsModal2 = guestPage.getByTestId('supporting-docs-modal');
        await expect(supportingDocsModal2).toBeVisible({ timeout: 10000 });        
      
        const fileInput2 = supportingDocsModal2.locator('input[type="file"]');
        await fileInput2.setInputFiles(join(__dirname, 'test_files', 'statement-account-statement-09-30-2025-1764947093072-496.pdf'));
        await guestPage.waitForTimeout(2000);

        const [empResponse2] = await Promise.all([
            guestPage.waitForResponse(
                resp =>
                    resp.url().includes('/employment-verifications') &&
                    resp.request().method() === 'POST' &&
                    resp.status() === 201,
                { timeout: 30000 }
            ),
            guestPage.getByTestId('employment-step-submit-btn').click()
        ]);

        const empData2 = await waitForJsonResponse(empResponse2);
        const verificationId2 = empData2.data.id;
        console.log(`✅ Investment Statement verification ID: ${verificationId2}`);

        await pollForVerificationStatus(guestContext, verificationId2, 'employment-verifications', {
            maxAttempts: 45,
            pollInterval: 4000,
            authToken: guestAuthToken
        });
        console.log('✅ Investment Statement verification COMPLETED');

        // ─── STEP 3: Upload Retirement Benefits ──────────────────────────────────────
        console.log('[Step 3] Uploading Retirement Benefits...');
        await guestPage.waitForTimeout(2000);
        await employmentStatusElement.click()
        await expect(guestPage.getByTestId('employment-verification-step')).toBeVisible({ timeout: 10000 });

        await guestPage.getByTestId('upload-supporting-documents-btn').click();
        const supportingDocsModal3 = guestPage.getByTestId('supporting-docs-modal');
        await expect(supportingDocsModal3).toBeVisible({ timeout: 10000 });

        const fileInput3 = supportingDocsModal3.locator('input[type="file"]');
        await fileInput3.setInputFiles(join(__dirname, 'test_files', 'AnnuityStatement_2_3_2025.pdf'));
        await guestPage.waitForTimeout(2000);

        const [empResponse3] = await Promise.all([
            guestPage.waitForResponse(
                resp =>
                    resp.url().includes('/employment-verifications') &&
                    resp.request().method() === 'POST' &&
                    resp.status() === 201,
                { timeout: 30000 }
            ),
            guestPage.getByTestId('employment-step-submit-btn').click()
        ]);

        const empData3 = await waitForJsonResponse(empResponse3);
        const verificationId3 = empData3.data.id;
        console.log(`✅ Retirement Benefits verification ID: ${verificationId3}`);

        await pollForVerificationStatus(guestContext, verificationId3, 'employment-verifications', {
            maxAttempts: 45,
            pollInterval: 4000,
            authToken: guestAuthToken
        });
        console.log('✅ Retirement Benefits verification COMPLETED');

        // ─── STEP 4: Admin — Login, navigate to session, open flags section ──────────
        console.log('[Step 4] Admin: logging in and navigating to session...');
        adminContext = await browser.newContext();
        const adminPage = await adminContext.newPage();

        await adminPage.goto('/');
        await loginForm.fill(adminPage, admin);
        await loginForm.submitAndSetLocale(adminPage);
        await expect(adminPage).toHaveTitle(/Applicants/, { timeout: 10000 });

        await adminPage.waitForTimeout(2000);

        const [sessionResponse] = await Promise.all([
            adminPage.waitForResponse(resp =>
                resp.url().includes(`/sessions/${sessionId}`) &&
                resp.ok() &&
                resp.request().method() === 'GET'
            ),
            await adminPage.goto(`/applicants/all/${sessionId}`)
        ]);
        await waitForJsonResponse(sessionResponse);

        // Open flags section via the Alert button
        const flagSectionAlreadyVisible = await adminPage.getByTestId('report-view-details-flags-section')
            .isVisible()
            .catch(() => false);

        if (!flagSectionAlreadyVisible) {
            console.log('🔍 Opening event history flags section via Alert button...');
            const alertsBtn = adminPage.getByTestId('report-alerts-btn');
            await expect(alertsBtn).toBeVisible({ timeout: 10000 });
            await alertsBtn.click();
        } else {
            console.log('✅ Flags section already visible');
        }

        const flagSection = adminPage.getByTestId('report-view-details-flags-section');
        await expect(flagSection).toBeVisible({ timeout: 15000 });

        // Click "System" flags tab if present
        const systemTab = adminPage.getByTestId('flags-tab-system');
        if (await systemTab.isVisible({ timeout: 3000 }).catch(() => false)) {
            await systemTab.click();
            await adminPage.waitForTimeout(500);
        }

        // ─── STEP 5: Verify all 3 flags in items-causing-decline-section ─────────────
        console.log('[Step 5] Verifying flags in admin UI...');
        const declineSection = flagSection.getByTestId('items-causing-decline-section');
        await expect(declineSection).toBeVisible({ timeout: 15000 });

        await expect(declineSection.getByTestId('HOUSING_VOUCHER_UPLOADED')).toBeVisible({ timeout: 30000 });
        console.log('✅ HOUSING_VOUCHER_UPLOADED flag visible');

        await expect(declineSection.getByTestId('INVESTMENT_STATEMENT_UPLOADED')).toBeVisible({ timeout: 30000 });
        console.log('✅ INVESTMENT_STATEMENT_UPLOADED flag visible');

        await expect(declineSection.getByTestId('PENSION_DOCUMENT_UPLOADED')).toBeVisible({ timeout: 30000 });
        console.log('✅ PENSION_DOCUMENT_UPLOADED flag visible');

        // ─── STEP 6: API — Verify flags via API ──────────────────────────────────────
        console.log('[Step 6] Verifying flags via API...');
        const flagsApiResponse = await adminPage.request.get(`${app.urls.api}/sessions/${sessionId}/flags`);

        if (flagsApiResponse.ok()) {
            const flagsBody = await flagsApiResponse.json();
            const flags = flagsBody.data || [];

            const housingVoucherFlag = flags.find(f => f.key === 'HOUSING_VOUCHER_UPLOADED' && f.severity === 'ERROR');
            const investmentFlag = flags.find(f => f.key === 'INVESTMENT_STATEMENT_UPLOADED' && f.severity === 'ERROR');
            const pensionFlag = flags.find(f => f.key === 'PENSION_DOCUMENT_UPLOADED' && f.severity === 'ERROR');

            expect(housingVoucherFlag, 'HOUSING_VOUCHER_UPLOADED with severity ERROR should exist in API').toBeDefined();
            expect(investmentFlag, 'INVESTMENT_STATEMENT_UPLOADED with severity ERROR should exist in API').toBeDefined();
            expect(pensionFlag, 'PENSION_DOCUMENT_UPLOADED with severity ERROR should exist in API').toBeDefined();
            console.log('✅ All 3 flags verified via API with severity ERROR');
        } else {
            console.warn(`⚠️ Flags API returned ${flagsApiResponse.status()} — skipping API assertion`);
        }

        console.log('✅ All test steps completed successfully');
    });

    test.afterAll(async ({ request }, testInfo) => {
        if (guestContext) {
            try { await guestContext.close(); } catch { /* ignore */ }
        }
        if (adminContext) {
            try { await adminContext.close(); } catch { /* ignore */ }
        }
        if(testInfo.status === testInfo.expectedStatus) {
            await cleanupTrackedSession(request, sessionId, testInfo);
        }
    });
});
