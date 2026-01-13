import { expect, test } from "@playwright/test";
import { adminLoginAndNavigateToApplications } from "./utils/session-utils";
import { admin } from "./test_config";
import { findAndInviteApplication } from "./utils/applications-page";
import generateSessionForm from "./utils/generate-session-form";
import { getRandomEmail } from "./utils/helper";
import { identityStep, setupInviteLinkSession, updateRentBudget } from "./utils/session-flow";
import { gotoPage } from "./utils/common";
import { findSessionLocator, searchSessionWithText } from "./utils/report-page";
import { waitForJsonResponse } from "./utils/wait-response";
import { cleanupSession } from "./utils/cleanup-helper";


test.describe('QA-268 id-name-mismatch-flag-resolution-after-persona.spec', () => {
    const APPLICATION_NAME = 'AutoTest Suite - ID Only';

    const testResults = {
        test1: { passed: false, sessionId: null }
    };

    test('Verify correct flag behavior when applicant name matches Persona ID verification result', {
        tag: ['@regression']
    }, async ({ page, browser }) => {
        await test.setTimeout(180_000);

        // ================== Setup ==================
        console.log('🛠️ Setup:');

        // Login as admin
        console.log('🔑 Logging in as admin...');
        await adminLoginAndNavigateToApplications(page, admin);

        // Navigate to Applications menu
        console.log('📋 Navigating to Applications menu...');

        // Find and select the target application
        console.log(`🔍 Searching for application: "${APPLICATION_NAME}"...`);
        await findAndInviteApplication(page, APPLICATION_NAME);

        // Step 1: Create Session with Matching Name
        console.log('\n🚀 Step 1: Create Session with Matching Name');

        const user = {
            first_name: 'Alexander',
            middle_name: 'J', // explicitly add middle name for clear logging
            last_name: 'Sample',
            email: getRandomEmail()
        };

        console.log(
            `📝 Filling applicant form:\n` +
            `   First Name: ${user.first_name}\n` +
            `   Middle Name: ${user.middle_name}\n` +
            `   Last Name: ${user.last_name}\n` +
            `   Email: ${user.email}`
        );

        // Fill and submit invite, capture sessionId and invite link
        const { sessionId, sessionUrl, link } = await generateSessionForm.generateSessionAndExtractLink(page, user, {
            prefix: false,
            // If generateSessionForm supports it, fill in middle_name
            middle_name: user.middle_name 
        });
        testResults.test1.sessionId = sessionId;

        console.log(`✅ Session created! Session ID: ${sessionId}`);
        console.log(`🔗 Invite link: ${link}`);

        // Step 2: Complete Persona Identity Verification
        console.log('\n🧑‍💻 Step 2: Complete Persona Identity Verification');

        console.log('🆕 Opening invite link in new browser context...');
        const newContext = await browser.newContext({
            permissions: ['camera', 'microphone'],
            launchOptions: {
                args: [
                    '--use-fake-ui-for-media-stream',
                    '--use-fake-device-for-media-stream'
                ]
            }
        });
        const applicantPage = await newContext.newPage();

        await applicantPage.goto(link);
        console.log('📝 Completing session setup (terms, etc)...');
        await setupInviteLinkSession(applicantPage, {
            sessionUrl
        });

        // Assume rent budget needs to be filled
        console.log('🏠 Setting rent budget...');
        await updateRentBudget(applicantPage, sessionId, '500');

        // Go to identity step
        console.log('🛂 Navigating to Identity verification step...');
        await expect(applicantPage.getByTestId('start-id-verification')).toBeVisible({ timeout: 10_000 });

        // Complete Persona verification flow
        console.log('🕵️ Completing Persona verification flow (using sandbox sample)...');
        await identityStep(applicantPage);

        // Wait for Persona iframe to disappear (Persona flow completed)
        console.log('⏳ Waiting for Persona iframe to close...');
        await expect(applicantPage.locator('iframe[src*="withpersona.com"]')).not.toBeAttached({ timeout: 30_000 }).catch(() => {
            console.log('⚠️ Persona iframe may have already closed');
        });

        // Poll for summary step (Persona completed and backend processed)
        console.log('⏳ Polling for summary step to appear...');
        const maxPolls = 15;
        const pollInterval = 4000; // 4 seconds
        
        for (let attempt = 1; attempt <= maxPolls; attempt++) {
            try {
                const summarySection = applicantPage.getByTestId('summary-completed-section');
                await expect(summarySection).toBeVisible({ timeout: 2000 });
                console.log(`✅ Summary step appeared after ${attempt} attempt(s)`);
                console.log('🎉 Verification complete! Applicant reached summary step.');
                break;
            } catch (error) {
                if (attempt < maxPolls) {
                    console.log(`⏳ Summary step not yet visible, polling... (${attempt}/${maxPolls})`);
                    await applicantPage.waitForTimeout(pollInterval);
                } else {
                    console.error(`❌ Summary step did not appear after ${maxPolls} attempts`);
                    throw new Error(`Summary step timeout: summary-completed-section not found after ${maxPolls * pollInterval / 1000} seconds`);
                }
            }
        }

        // Step 3: Verify No Mismatch Flag in Dashboard
        console.log('\n📊 Step 3: Verify No Mismatch Flag in Dashboard');

        // Switch to admin
        console.log('👤 Switching back to admin dashboard...');
        await page.bringToFront();

        // Navigate to Sessions/Applicants list
        console.log('📄 Navigating to Sessions/Applicants list...');
        await gotoPage(page, 'applicants-menu', 'applicants-submenu', '/sessions?fields[session]');
        await page.waitForTimeout(1000);

        // Search for created session
        console.log(`🔍 Searching for session ID: ${sessionId}...`);
        await searchSessionWithText(page, sessionId);

        // Open session details
        const sessionLocator = await findSessionLocator(page, `.application-card[data-session="${sessionId}"]`);
        const [sessionResponse] = await Promise.all([
            page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}?fields[session]`)
                && resp.ok()
                && resp.request().method() === 'GET'),
            sessionLocator.click()
        ]);
        let { data: session } = await waitForJsonResponse(sessionResponse);

        console.log('⏳ Waiting for flags to load (15s)...');
        await page.waitForTimeout(15_000);

        // Click "View Details"
        const viewDetailBtn = page.getByTestId('view-details-btn');
        await expect(viewDetailBtn).toBeVisible();
        await viewDetailBtn.click();
        console.log('👁️ Opened session view details.');

        // Verify flag absence
        const flagSection = page.getByTestId('report-view-details-flags-section');
        await expect(flagSection).toBeVisible();

        const criticalFlag = flagSection.getByTestId('IDENTITY_NAME_MISMATCH_CRITICAL');
        const warningFlag = flagSection.getByTestId('IDENTITY_NAME_MISMATCH_WARNING');
        await expect(criticalFlag).not.toBeVisible();
        console.log('✅ IDENTITY_NAME_MISMATCH_CRITICAL flag NOT present.');
        await expect(warningFlag).not.toBeVisible();
        console.log('✅ IDENTITY_NAME_MISMATCH_WARNING flag NOT present.');

        // Mark test as passed for cleanup
        testResults.test1.passed = true;
        console.log('🎯 Test verification complete!');

    });

    test.afterAll(async ({ request }) => {
        console.log('🧹 [CleanUp] Test suite cleanup (delete any remaining test sessions if needed)');
        const results = Object.entries(testResults);
        for (let index = 0; index < results.length; index++) {
            const [key, element] = results[index];
            if (element.passed && element.sessionId) {
                try {
                    console.log(`🗑️ [Cleanup] Attempting to clean up session for test '${key}' (sessionId: ${element.sessionId})`);
                    await cleanupSession(request, element.sessionId);
                    console.log(`✅ [Cleanup] Successfully cleaned up session for test '${key}'`);
                } catch (error) {
                    console.error(`❌ [Cleanup] Failed to clean up session for test '${key}' (sessionId: ${element.sessionId}): ${error}`);
                }
            }
        }
        console.log('🧹 [CleanUp] Complete.');
    });
});