import { test, expect } from "@playwright/test";
import { loginWith } from "./utils/session-utils";
import { admin, app } from "./test_config";
import { fillCreateSessionForm, openModalWithButton, submitCreateSessionForm, verifyReferenceNumberDisplay, verifySessionReferenceNo } from "./utils/report-page";
import { ApiClient } from "./api";
import { loginWithAdmin } from "./endpoint-utils/auth-helper";
import { cleanupSession } from "./utils/cleanup-helper";



test.describe('QA-277 reference-number-display-report.spec.js', () => {

    let adminClient;

    test.beforeAll(async () => {
        adminClient = new ApiClient(app.urls.api, null, 120_000)
        await loginWithAdmin(adminClient)
    })

    const testResults = {
        test1: { passed: false, sessionId: null },
        test2: { passed: false, sessionId: null }
    };

    test('While creating from session report page, WITH reference no, Verify Reference Number Display in Session Report (VC-1675)',
        {
            tag: ['@regression', '@smoke']
        }
        ,async ({ page }) => {

        console.log('🚩 [Test Start] Creating session WITH reference number from session report page');
        
        // Login and navigate
        await page.goto('/');
        await loginWith(page, admin);
        // Wait for applicants menu to be ready (loginWith already handles navigation)
        await expect(page.getByTestId('applicants-menu')).toBeVisible({ timeout: 10_000 });

        // Open create session modal and fill form
        await openModalWithButton(page, 'create-new-session-btn', 'create-session-modal');
        
        const sessionForm = {
            organization: 'Loan Test Org',
            application: 'Autotest - Loan Reference Number',
            first_name: 'Test',
            last_name: 'User',
            reference_no: 'REF-TEST-001',
            send_invite: true
        };
        
        await fillCreateSessionForm(page, sessionForm);
        
        // Submit form and get session
        const { session, sessionId } = await submitCreateSessionForm(page);
        testResults.test1.sessionId = sessionId;

        // Open View Details modal
        const { modal: flagSection } = await openModalWithButton(page, 'view-details-btn', 'report-view-details-flags-section');

        // Verify reference number in UI
        await verifyReferenceNumberDisplay(flagSection, sessionForm.reference_no, {
            shouldExist: true,
            verifyPositioning: true
        });

        // Verify reference number via API
        await verifySessionReferenceNo(adminClient, sessionId, sessionForm.reference_no);

        testResults.test1.passed = true;

        // 🎉 Test passed! QA-277/VC-1675 reference number display with reference no is valid.
    })

    test('While creating from session report page, WITHOUT reference no, Verify Reference Number Display in Session Report (VC-1675)',
        {
            tag: ['@regression', '@smoke']
        },
        async ({ page }) => {

        console.log('🚩 [Test Start] Creating session WITHOUT reference number from session report page');

        // Login and navigate
        await page.goto('/');
        await loginWith(page, admin);
        // Wait for applicants menu to be ready (loginWith already handles navigation)
        await expect(page.getByTestId('applicants-menu')).toBeVisible({ timeout: 10_000 });

        // Open create session modal and fill form
        await openModalWithButton(page, 'create-new-session-btn', 'create-session-modal');
        
        const sessionForm = {
            organization: 'Loan Test Org',
            application: 'Autotest - Loan Reference Number',
            first_name: 'Test',
            last_name: 'User',
            email: 'test@example.com',
            send_invite: true
        };
        
        await fillCreateSessionForm(page, sessionForm);
        
        // Submit form and get session
        const { session, sessionId } = await submitCreateSessionForm(page);
        testResults.test2.sessionId = sessionId;

        // Open View Details modal
        const { modal: flagSection } = await openModalWithButton(page, 'view-details-btn', 'report-view-details-flags-section');

        // Verify reference number does NOT exist in UI
        await verifyReferenceNumberDisplay(flagSection, null, {
            shouldExist: false
        });

        // Verify reference number is null via API
        await verifySessionReferenceNo(adminClient, sessionId, null);

        testResults.test2.passed = true;
    })


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


})