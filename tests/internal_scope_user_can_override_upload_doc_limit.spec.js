import { expect, test } from '@playwright/test'
import { adminLoginAndNavigateToApplications } from './utils/session-utils'
import { admin, app } from './test_config'
import { findAndInviteApplication } from './utils/applications-page';
import { setupInviteLinkSession, startSessionFlow, updateRentBudget } from './utils/session-flow';
import { fillMultiselect } from './utils/common';
import generateSessionForm from './utils/generate-session-form';

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { waitForJsonResponse } from './utils/wait-response';
import { navigateToSessionById, searchSessionWithText } from './utils/report-page';
import { cleanupSession } from './utils/cleanup-helper';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appName = 'AutoTest - Internal Scope No Doc Limit';
let createdSessionId = null;

test.describe('QA-212 internal_scope_user_can_override_upload_doc_limit.spec', () => {

    test.afterEach(async ({ request }, testInfo) => {
        if (createdSessionId) {
            if (testInfo.status === 'passed') {
                console.log(`🧹 Test passed. Cleaning up session ${createdSessionId}...`);
                await cleanupSession(request, createdSessionId, true);
                console.log('✅ Cleanup complete');
            } else {
                console.log(`⚠️  Test ${testInfo.status}. Skipping cleanup for session ${createdSessionId} (left for debugging)`);
            }
        }
        // Reset for next test
        createdSessionId = null;
    });

    test('Verify Internal-scope Uploads Can Override Document Upload Limits',{
        tag: ['@core', '@regression']
    }, async ({ page, browser }) => {
        test.setTimeout(640_000); // 10 min 40 sec (doubled from 5 min 20 sec)

        console.log('🚀 STEP 1: Logging in as admin and navigating to Applications');
        await adminLoginAndNavigateToApplications(page, admin);
        await page.waitForTimeout(300);

        console.log('🔎 STEP 2: Finding and inviting the test application');
        await findAndInviteApplication(page, appName);

        const userData = {
            email: 'doclimit.upload@verifast.com',
            first_name: 'DocLimit',
            last_name: 'Upload',
            full_name: 'Autot - Doclimit Upload',
        };
        console.log('📝 STEP 3: Generating session for applicant & extracting invite link');
        const { sessionId, sessionUrl, link } = await generateSessionForm.generateSessionAndExtractLink(page, userData);
        createdSessionId = sessionId;  // Store for cleanup

        console.log('🆕 STEP 4: Opening applicant session in new browser context');
        const applicantPage = await startSessionFlow(link, browser);

        console.log('📋 STEP 5: Applicant: Accepting terms, choosing type & state');
        await setupInviteLinkSession(applicantPage);

        console.log('💲 STEP 6: Setting rent budget to 500');
        await updateRentBudget(applicantPage, sessionId, '500');

        console.log('⏳ Checking for pre-screening step...');
        await expect(applicantPage.getByTestId('pre-screening-step')).toBeVisible({ timeout: 20_000 });

        console.log('⏩ Skipping pre-screening step');
        await applicantPage.getByTestId('pre-screening-skip-btn').click();

        console.log('📄 Making sure employment verification step is visible');
        await expect(applicantPage.getByTestId('employment-verification-step')).toBeVisible({ timeout: 20_000 });

        console.log('📂 STEP 7: Applicant: Uploading paystub documents (to hit upload limit) 📑');
        let employmentVerification = await uploadDocument(applicantPage, [
            'paystub_recent.pdf',
            'paystub_recent.png'
        ], { continueStep: false, timeout: 90_000 });

        console.log('🔄 STEP 8: Polling for employment verification to complete ⏲️');
        let employmentStatusCompleted = false;
        let response;
        const maxAttempts = 35;
        const pollingInterval = 15000;

        for (let i = 0; i < maxAttempts; i++) {
            response = await applicantPage.waitForResponse(resp =>
                resp.url().includes('/employment-verifications') &&
                resp.request().method() === "GET" &&
                resp.ok()
                , { timeout: pollingInterval });

            const body = await waitForJsonResponse(response);
            // Small step: show poll status
            console.log("   🔄 Poll Employment Status:", body?.data);
            const item = body?.data?.find(item => item.id === employmentVerification.id);
            if (item && item.status === 'COMPLETED') {
                employmentStatusCompleted = true;
                employmentVerification = body.data;
                console.log('   ✅ Employment verification status is COMPLETED.');
                break;
            }
            await applicantPage.waitForTimeout(1500);
        }

        if (!employmentStatusCompleted) {
            console.error(`❌ Employment verification for ID ${employmentVerification.id} did not reach COMPLETED status within timeout`);
            throw new Error(`Employment verification for ID ${employmentVerification.id} did not reach COMPLETED status within timeout`);
        }

        console.log('🚫 STEP 9: Attempting extra applicant paystub upload (should see upload limit error)');
        await applicantPage.getByTestId('document-pay_stub').click();
        await expect(applicantPage.getByTestId('pay_stub-limit-error')).toBeVisible();
        console.log('   ⚠️ Upload limit error visible for applicant!');

        console.log('🛠️ STEP 10: Admin overrides upload limit with manual paystub upload');
        await page.bringToFront();
        await page.getByTestId('applicants-menu').click();
        await page.getByTestId('applicants-submenu').click();

        console.log('   🔍 Searching for the session & opening session details');
        await searchSessionWithText(page, sessionId);
        await navigateToSessionById(page, sessionId);
        await page.waitForTimeout(3000);

        console.log('   📬 Opening Upload Document modal as admin');
        await page.getByTestId('session-action-btn').click();
        await page.getByTestId('upload-document-btn').click();
        const uploadModal = page.getByTestId('upload-document');
        await expect(uploadModal).toBeVisible();

        console.log('   🧑‍💼 Filling upload form: applicant, doc type, employer, cadence');
        await fillMultiselect(page, uploadModal.getByTestId('select-applicant'), [userData.full_name]);
        await fillMultiselect(page, uploadModal.getByTestId('select-document'), ['Pay Stub (Employment)']);
        await uploadModal.getByTestId('document-employer-name').fill('Abc Inc');
        const payCadenceSelect = uploadModal.getByTestId('document-pay-cadence');
        await payCadenceSelect.getByTestId('document-pay-cadence-tags').click();
        await payCadenceSelect.locator('ul>li#pay_cadence-0').click();

        const filePaths = ['paystub_recent.pdf'];
        const resolvedFilePaths = Array.isArray(filePaths)
            ? filePaths.map(file => join(__dirname, '/test_files', file))
            : join(__dirname, '/test_files', filePaths);

        console.log('   📤 Uploading paystub file as admin...');
        const paystubFileInput = uploadModal.locator('input[id="upload-document"]');
        await paystubFileInput.setInputFiles(resolvedFilePaths);

        const [employmentResponse] = await Promise.all([
            page.waitForResponse(resp =>
                resp.url().includes('/employment-verifications') &&
                resp.request().method() === 'POST'
            , { timeout: 120_000 }), // 2 minutes for admin upload
            uploadModal.getByTestId('submit-upload-doc-form').click()
        ]);
        expect(employmentResponse.ok()).toBeTruthy();
        console.log('✅ Admin override: document upload limit successfully bypassed! 🎉');
    })

})

async function uploadDocument(page, filePaths, options = {}) {
    const { cadence = 'Bi-Weekly', timeout = 10000, continueStep = true } = options;

    console.log('🟢 STEP 1: Applicant uploading paystub(s) 📥');
    await page.getByTestId('document-pay_stub').click();
    await page.locator('button').filter({ hasText: /^Upload Paystubs$/ }).click();

    console.log('   📅 Selecting pay cadence:', cadence);
    await page.locator('.multiselect__tags').click();
    await page.locator('li').filter({ hasText: new RegExp(`^${cadence}$`) }).click();

    const resolvedFilePaths = Array.isArray(filePaths)
        ? filePaths.map(file => join(__dirname, '/test_files', file))
        : join(__dirname, '/test_files', filePaths);

    console.log('   📑 Setting input paystub file(s):', resolvedFilePaths.join(', '));
    const paystubFileInput = page.locator('input[type="file"]');
    await paystubFileInput.setInputFiles(resolvedFilePaths);
    await page.waitForTimeout(2000);

    console.log('🟢 STEP 2: Submitting paystub(s) and waiting for employment verification API...');
    const [employmentResponse] = await Promise.all([
        page.waitForResponse(resp =>
            resp.url().includes('/employment-verifications') &&
            resp.request().method() === 'POST' &&
            resp.ok()
            , { timeout: 30000 }),
        page.locator('button').filter({ hasText: /^Submit$/ }).click()
    ]);
    const { data: employmentData } = await waitForJsonResponse(employmentResponse);
    console.log('   📬 Received employment verification API response');
    return employmentData;
}
