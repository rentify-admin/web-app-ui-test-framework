import { test, expect } from "@playwright/test";
import { loginWith } from "./utils/session-utils";
import { admin, app } from "./test_config";
import { fillCreateSessionForm, openModalWithButton } from "./utils/report-page";
import { fillMultiselect } from "./utils/common";
import { waitForJsonResponse } from "./utils/wait-response";
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
        // 🚦 Start test: Verify Reference Number Display in Session Report (VC-1675)
        await page.goto('/')
        console.log('🌐 Navigated to root page');

        await loginWith(page, admin);
        console.log('✅ Logged in as admin');

        await page.reload()
        console.log('🔄 Page reloaded for clean state');
        await page.waitForTimeout(3000)
        console.log('⏳ Waited 3 seconds for content stabilization');

        // 🪟 Open create new session modal
        const {
            modal: createSessionModal
        } = await openModalWithButton(page, 'create-new-session-btn', 'create-session-modal')
        console.log('🪟 Create session modal is visible');

        // 📝 Compose session form with reference number
        const sessionForm = {
            organization: 'Loan Test Org',
            application: 'Autotest - Loan Reference Number',
            first_name: 'Test',
            last_name: 'User',
            reference_no: 'REF-TEST-001',
            send_invite: true
        }
        console.log('📝 Filling session form with:', sessionForm);

        await fillCreateSessionForm(page, sessionForm);
        console.log('✅ Session creation form filled');

        const createSessionBtn = await page.getByTestId('submit-create-session')
        console.log('🔘 Located submit-create-session button');

        // Listen for POST /sessions response
        const sessionPromise = page.waitForResponse(resp => resp.url().includes('/sessions') && resp.request().method() === 'POST' && resp.ok());
        console.log('👂 Waiting for session creation network response...');

        await createSessionBtn.click();
        console.log('🖱️ Clicked create session button');

        const sessionResponse = await sessionPromise;
        console.log('📩 Received session creation response: %o', sessionResponse);

        const { data: session } = await waitForJsonResponse(sessionResponse)
        console.log('✅ Parsed created session: %o', session);

        testResults.test1.sessionId = session.id;

        await expect(page).toHaveURL(`/applicants/all/${session.id}`, { timeout: 10_000 });
        console.log(`🚀 Navigated to session report for session id: ${session.id}`);

        // Open details modal (flags section)
        const {
            modal: flagSection
        } = await openModalWithButton(page, 'view-details-btn', 'report-view-details-flags-section')
        console.log('🪟 Opened report details modal/flags section');

        // Locate 'application-code' element and verify reference number display
        const codeEle = await flagSection.getByTestId('application-code')
        await expect(codeEle).toHaveText(sessionForm.reference_no)
        console.log('🔖 Application code element displays correct reference number: %s', sessionForm.reference_no);

        await expect(codeEle).toHaveJSProperty('tagName', 'CODE');
        console.log('✅ Code element is of tag <CODE>');

        // Check that codeEle has both required classes
        const codeClasses = await codeEle.getAttribute('class');
        console.log('🔎 Reference number CSS classes: %s', codeClasses);
        expect(codeClasses).toBeTruthy();
        expect(codeClasses.split(' ')).toEqual(
            expect.arrayContaining(['bg-slate-200', 'rounded-md'])
        );
        console.log('✅ Reference number element class validation passed');

        const approvalCondHeader = page.getByTestId('approval-condition-section-header');
        console.log('🔖 Located approval-condition-section-header');

        // Both elements must exist and be visible
        const codeEleBox = await codeEle.boundingBox();
        const approvalCondHeaderBox = await approvalCondHeader.boundingBox();
        console.log('📐 Bounding box for code element: %o', codeEleBox);
        console.log('📐 Bounding box for approval section header: %o', approvalCondHeaderBox);
        expect(codeEleBox).toBeTruthy();
        expect(approvalCondHeaderBox).toBeTruthy();

        // codeEle's bottom should touch approvalCondHeader's top (allowing for small pixel rounding)
        const codeEleBottom = codeEleBox.y + codeEleBox.height;
        const approvalCondHeaderTop = approvalCondHeaderBox.y;
        console.log(`🧩 Calculated vertical gap between reference number and approval section: ${approvalCondHeaderTop - codeEleBottom}px`);
        expect(Math.abs(codeEleBottom - approvalCondHeaderTop)).toBeLessThanOrEqual(300);

        // Fetch session from backend to verify reference_no is present
        const sessionData = await adminClient.get(`/sessions/${session.id}`, {
            params: {
                'fields[session]': 'applicant',
                'fields[applicant]': 'reference_no'
            }
        });
        console.log('🌐 Fetched session API data: %o', sessionData?.data?.data);

        await expect(sessionData?.data?.data).toBeDefined()

        const apiSession = sessionData.data.data;

        await expect(apiSession.applicant?.reference_no).toBe(sessionForm.reference_no)
        console.log('✅ API session reference_no matches: %s', sessionForm.reference_no);

        testResults.test1.passed = true;

        // 🎉 Test passed! QA-277/VC-1675 reference number display with reference no is valid.
    })

    test('While creating from session report page, WITHOUT reference no, Verify Reference Number Display in Session Report (VC-1675)',
        {
            tag: ['@regression', '@smoke']
        },
        async ({ page }) => {

        console.log('🚩 [Test Start] Creating session WITHOUT reference number from session report page');

        await page.goto('/');
        console.log('🏠 Navigated to home page');

        await loginWith(page, admin);
        console.log('👤 Logged in as admin');
        await page.reload();
        console.log('🔄 Page reloaded after login');
        await page.waitForTimeout(3000);
        console.log('⏳ Waited 3 seconds post-login');

        const {
            modal: createSessionModal
        } = await openModalWithButton(page, 'create-new-session-btn', 'create-session-modal');
        console.log('🪟 Opened create session modal');

        const sessionForm = {
            organization: 'Loan Test Org',
            application: 'Autotest - Loan Reference Number',
            first_name: 'Test',
            last_name: 'User',
            email: 'test@example.com',
            send_invite: true
        }
        console.log('📝 Prepared session form data:', sessionForm);

        await fillCreateSessionForm(page, sessionForm);
        console.log('✅ Filled create session form');

        const createSessionBtn = await page.getByTestId('submit-create-session')
        console.log('🔘 Located "Create Session" button');

        const sessionPromise = page.waitForResponse(resp => resp.url().includes('/sessions') && resp.request().method() === 'POST' && resp.ok());
        console.log('🌐 Waiting for session creation API response');

        await createSessionBtn.click();
        console.log('🖱️ Clicked create session button');

        const sessionResponse = await sessionPromise;
        console.log('✅ Received session creation response');

        const { data: session } = await waitForJsonResponse(sessionResponse);
        console.log('📦 Parsed new session from response:', session);

        testResults.test2.sessionId = session.id;
        console.log(`💾 [Tracking] Saved sessionId for test2: ${session.id}`);

        await expect(page).toHaveURL(`/applicants/all/${session.id}`, { timeout: 10_000 });
        console.log(`🔎 Navigated to applicant details page for session ${session.id}`);

        const {
            modal: flagSection
        } = await openModalWithButton(page, 'view-details-btn', 'report-view-details-flags-section')
        console.log('🪟 Opened "View Details" (flags) section modal');

        const codeEle = await flagSection.getByTestId('application-code');
        console.log('🔍 Searched for application code element inside flag section');
        await expect(codeEle).not.toBeVisible();
        console.log('✖️ Application code element is NOT visible as expected (no reference number)');

        const sessionData = await adminClient.get(`/sessions/${session.id}`, {
            params: {
                'fields[session]': 'applicant',
                'fields[applicant]': 'reference_no'
            }
        });
        console.log('🌐 Fetched session from API:', sessionData?.data?.data);

        await expect(sessionData?.data?.data).toBeDefined()

        const apiSession = sessionData.data.data;

        await expect(apiSession.applicant?.reference_no).toBe(null)
        testResults.test2.passed = true;
        console.log('✅ Test case for missing reference number passed');
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