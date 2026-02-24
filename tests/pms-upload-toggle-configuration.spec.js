import { expect, test } from "@playwright/test";
import { admin, app } from "./test_config";
import { adminLoginAndNavigateToApplications, findSessionLocator } from "./utils/session-utils";
import { waitForJsonResponse } from "./utils/wait-response";
import { ApiClient } from "./api";
import { loginWithAdmin } from "./endpoint-utils/auth-helper";
import { cleanupApplication, cleanupTrackedSession } from "./utils/cleanup-helper";
import { createPermissionTestSession } from "./utils/session-generator";
import { pollForSessionEvent, searchSessionWithText } from "./utils/report-page";

const testResults = {
    test1: { applicationId: null, passed: false },
    test2: { applicationId: null, passed: false },
    test3: { applicationId: null, passed: false },
    test4: { sessionId: null, passed: false, applicantContext: null },
    test5: { sessionId: null, passed: false, applicantContext: null },
}
let adminClient;
let targetApplicationId = null; // ID for 'Autotest - Simulator Financial Step'

/**
 * Utility function to perform POST or PATCH on /applications and assert settings
 * @param {Object} params
 * @param {import('@playwright/test').Page} params.page
 * @param {import('@playwright/test').Locator} params.saveAppBtn
 * @param {string} [params.applicationId] - If provided, will PATCH. If omitted, will POST.
 * @param {string} params.expectedValue - Expected value of upload_trigger ('session_approval'|'session_acceptance')
 * @param {string} [params.httpMethodOverride] - Optionally force a method: 'POST' or 'PATCH' (to disambiguate when appId is unknown or for other flexibility)
 * @param {string} [params.testNumber] - testnumber key to log test in testResults
 * @returns {Promise<void>}
 */
async function saveAndAssertUploadTrigger({ page, saveAppBtn, applicationId, expectedValue, httpMethodOverride, testNumber }) {
    // Decide HTTP method and URL matcher
    let method, urlIncludes;
    if (httpMethodOverride) {
        method = httpMethodOverride;
        urlIncludes = '/applications';
        if (method === 'PATCH' && applicationId) urlIncludes += `/${applicationId}`;
    } else if (applicationId) {
        method = 'PATCH';
        urlIncludes = `/applications/${applicationId}`;
    } else {
        method = 'POST';
        urlIncludes = '/applications';
    }

    console.log(`🧠 [saveAndAssertUploadTrigger] About to click save. Method: ${method}, urlIncludes: ${urlIncludes} ${applicationId ? `, applicationId: ${applicationId}` : ''}`);

    // Wait for the correct request and click save
    // NOTE: resp.ok() intentionally excluded from filter — if the API returns 422, the filter
    // would never match and waitForResponse would silently hang until the 100s test timeout.
    // Instead, capture any response matching URL+method and assert status explicitly below.
    const [setupResponse] = await Promise.all([
        page.waitForResponse(resp =>
            resp.url().includes(urlIncludes) &&
            resp.request().method() === method
        ),
        saveAppBtn.click()
    ]);

    console.log(`🟢 [saveAndAssertUploadTrigger] Save triggered and response received for ${method} ${urlIncludes} (status: ${setupResponse.status()}) ${applicationId ? `(appId: ${applicationId})` : ''}`);

    expect(setupResponse.ok(), `Expected ${method} ${urlIncludes} to succeed, got ${setupResponse.status()}`).toBeTruthy();

    let _applicationId = applicationId;
    if (!_applicationId) {
        // If POST, get applicationId from response
        const { data: appData } = await waitForJsonResponse(setupResponse);
        _applicationId = appData.id;
        console.log(`✨ [saveAndAssertUploadTrigger] Created new applicationId: ${_applicationId}`);
    } else {
        console.log(`📝 [saveAndAssertUploadTrigger] Using existing applicationId for PATCH: ${_applicationId}`);
    }
    if (testNumber) {
        testResults[testNumber].applicationId = _applicationId;
    }
    // Intercept and check request data
    const req = setupResponse.request();
    const postDataText = req.postData();
    let postData;
    try {
        postData = JSON.parse(postDataText);
        console.log(`📦 [saveAndAssertUploadTrigger] POST data parsed successfully!`);
    } catch (e) {
        console.error(`❌ [saveAndAssertUploadTrigger] Failed to parse ${method} data for ${urlIncludes}`);
        throw new Error(`Failed to parse ${method} data for ${urlIncludes}`);
    }
    expect(postData.settings).toBeDefined();
    expect(postData.settings['settings.applications.pms.pdf.upload_trigger']).toBe(expectedValue);

    console.log(`🔍 [saveAndAssertUploadTrigger] upload_trigger sent in request data: ${postData.settings['settings.applications.pms.pdf.upload_trigger']} (expected: ${expectedValue})`);

    // Determine applicationId for API GET check

    // Check updated application from server
    console.log(`🌐 [saveAndAssertUploadTrigger] Verifying application value from API for applicationId: ${_applicationId} ...`);
    const appResponse = await adminClient.get(`/applications/${_applicationId}?fields[application]=settings`)
    const updatedApplication = appResponse.data.data;
    expect(updatedApplication.settings).toBeDefined();
    const setting = updatedApplication.settings.find(setting => setting.key === 'settings.applications.pms.pdf.upload_trigger')
    expect(setting).toBeDefined();
    expect(setting.value).toBe(expectedValue);

    console.log(`✅ [saveAndAssertUploadTrigger] API returned trigger value: "${setting.value}". Assertion passed! 🎉`);

    // For POST, return the created applicationId to the caller for test bookkeeping (needed for cleanup)
    if (!_applicationId && postData && postData.id) {
        return postData.id;
    } else if (!applicationId) {
        // It was a POST, we got id above
        return _applicationId;
    }
    return;
}


/**
 * Approve a session via UI.
 * Opens the Alert modal, clicks the approve button from the session-action dropdown,
 * polls until the button is enabled, then confirms.
 * @param {import('@playwright/test').Page} page
 * @param {string} sessionId
 */
async function approveSessionOnly(page, sessionId) {
    console.log(`🔓 [approveSessionOnly] Approving session: ${sessionId}`);

    // Open Alert modal to access household-status-alert
    const householdStatusAlert = page.getByTestId('household-status-alert');
    const isModalOpen = await householdStatusAlert.isVisible({ timeout: 2000 }).catch(() => false);

    if (!isModalOpen) {
        const alertBtn = page.getByRole('button', { name: /alert/i }).first();
        await expect(alertBtn).toBeVisible({ timeout: 15_000 });
        await alertBtn.click();
        await expect(householdStatusAlert).toBeVisible({ timeout: 8_000 });
    }

    const detailsActionBtn = page.getByTestId('household-status-alert').getByTestId('session-action-btn');
    await expect(detailsActionBtn).toBeVisible({ timeout: 10_000 });
    await detailsActionBtn.click();
    await page.waitForTimeout(500);

    const approveBtn = page.getByTestId('household-status-alert').getByTestId('approve-session-btn');

    // Ensure approve button is visible inside dropdown (retry if dropdown closed)
    let retryAttempt = 0;
    while (!await approveBtn.isVisible().catch(() => false) && retryAttempt < 5) {
        retryAttempt++;
        console.log(`   🔄 [approveSessionOnly] Re-opening dropdown (attempt ${retryAttempt}/5)...`);
        await detailsActionBtn.click().catch(() => { });
        await page.waitForTimeout(500);
    }

    if (!await approveBtn.isVisible().catch(() => false)) {
        throw new Error('❌ Approve button not visible after 5 retries — ensure Alert modal is open and session is in approvable state.');
    }

    // Poll until approve button is enabled (no pointer-events-none class)
    let isEnabled = false;
    for (let i = 0; i < 30 && !isEnabled; i++) {
        const hasDisabledClass = await approveBtn.evaluate(el => el.classList.contains('pointer-events-none'));
        if (!hasDisabledClass) {
            isEnabled = true;
            console.log(`✅ [approveSessionOnly] Approve button enabled (attempt ${i + 1}/30)`);
        } else {
            console.log(`   ⏳ [approveSessionOnly] Waiting for approve button to be enabled (${i + 1}/30)...`);
            await page.waitForTimeout(1000);
            // Re-open dropdown if button disappeared while waiting
            if (!await approveBtn.isVisible().catch(() => false)) {
                await detailsActionBtn.click().catch(() => { });
                await page.waitForTimeout(500);
            }
        }
    }

    if (!isEnabled) {
        throw new Error('❌ Approve button still disabled after 30s — ensure all flags are resolved and session is in approvable state.');
    }

    await approveBtn.click();

    // Confirm approval and wait for PATCH response
    const [approveResponse] = await Promise.all([
        page.waitForResponse(resp =>
            resp.url().includes(`/sessions/${sessionId}`) &&
            resp.request().method() === 'PATCH' &&
            resp.ok()
        ),
        page.getByTestId('confirm-btn').click()
    ]);

    console.log(`✅ [approveSessionOnly] Session ${sessionId} approved (status: ${approveResponse.status()})`);
}

test.describe('QA-274 pms-upload-toggle-configuration.spec', async () => {
    test.describe.configure({ mode: 'serial', timeout: 300000 });

    test.beforeAll(async () => {
        console.log("🔑 Logging in as admin and setting up ApiClient...");
        adminClient = new ApiClient(app.urls.api, null, 120000)
        await loginWithAdmin(adminClient)
        console.log("🟢 Admin logged in and ApiClient initialized! 🚀");

        // Find 'Autotest - Simulator Financial Step' application for tests 4 & 5
        try {
            const appsResp = await adminClient.get('/applications', {
                params: { filters: JSON.stringify({ name: 'Autotest - Simulator Financial Step' }) }
            });
            const apps = appsResp.data?.data || [];
            const targetApp = apps.find(a => a.name === 'Autotest - Simulator Financial Step');
            if (targetApp) {
                targetApplicationId = targetApp.id;
                console.log(`✅ Found 'Autotest - Simulator Financial Step' (id: ${targetApplicationId})`);
            } else {
                console.warn('⚠️ [beforeAll] Autotest - Simulator Financial Step not found — tests 4 & 5 may fail');
            }
        } catch (e) {
            console.error(`❌ [beforeAll] Failed to find target application: ${e.message}`);
        }
    });

    test('Create Application with Checkbox Unchecked - Saves session_acceptance', {
        tag: ['@core', '@regression', '@staging-ready', '@rc-ready']
    }, async ({ page }) => {
        console.log('🧪 [test1] Starting test: Create Application with Checkbox Unchecked');
        await adminLoginAndNavigateToApplications(page, admin)

        const applicationCreateBtn = page.getByTestId('application-create-btn');
        await expect(applicationCreateBtn).toBeVisible();

        await applicationCreateBtn.click();
        console.log("📋 Clicked application create button!");

        await fillSelect(page, 'organization-input', 'Permissions Test Org')
        console.log("🏢 Selected organization: Permissions Test Org");

        await page.getByTestId('application-name-input').fill(`Autotest PMS Unchecked ${Date.now()}`)

        const verisyncIntegrationCheck = page.locator('#enable_verisync_integration')

        await expect(verisyncIntegrationCheck).not.toBeChecked();

        await verisyncIntegrationCheck.check()
        console.log("✅ Checked Verisync Integration!");

        await page.locator('#pms_integration_id').fill(`test-integration-id-${Date.now()}`)
        await page.locator('#pms_property_id').fill(`test-property-id-${Date.now()}`)

        const uploadPdfBtn = page.locator('#upload_pdf_on_household_approval');
        await expect(uploadPdfBtn).toBeVisible()
        await expect.poll(
            () => uploadPdfBtn.isChecked(),
            { timeout: 3000, intervals: [100, 200, 300, 500] }
        ).toBe(false);

        const saveAppBtn = page.getByTestId('submit-application-setup');
        await expect(saveAppBtn).toBeVisible();

        // Use utility for POST case
        console.log("💾 [test1] Saving new application (expect session_acceptance)... 🟢");
        const applicationId = await saveAndAssertUploadTrigger({
            page,
            saveAppBtn,
            expectedValue: 'session_acceptance',
            httpMethodOverride: 'POST',
            testNumber: 'test1'
        });
        console.log(`🎉 [test1] Application created and verified! Application ID: ${applicationId} ✔️`);

        testResults.test1.applicationId = applicationId;
        testResults.test1.passed = true;
        console.log('🏁 [test1] Test complete! ✅\n');
    })

    test('Create Application with Checkbox Checked - Saves session_approval', {
        tag: ['@core', '@regression', '@staging-ready', '@rc-ready']
    }, async ({ page }) => {
        console.log('🧪 [test2] Starting test: Create Application with Checkbox Checked');
        await adminLoginAndNavigateToApplications(page, admin)

        const applicationCreateBtn = page.getByTestId('application-create-btn');
        await expect(applicationCreateBtn).toBeVisible();

        await applicationCreateBtn.click();
        console.log("📋 Clicked application create button!");

        await fillSelect(page, 'organization-input', 'Permissions Test Org')
        console.log("🏢 Selected organization: Permissions Test Org");

        await page.getByTestId('application-name-input').fill(`Autotest PMS Checked ${Date.now()}`)

        const verisyncIntegrationCheck = page.locator('#enable_verisync_integration')

        await expect(verisyncIntegrationCheck).not.toBeChecked();

        await verisyncIntegrationCheck.check()
        console.log("✅ Checked Verisync Integration!");

        await page.locator('#pms_integration_id').fill(`test-integration-id-${Date.now()}`)
        await page.locator('#pms_property_id').fill(`test-property-id-${Date.now()}`)

        const uploadPdfBtn = page.locator('#upload_pdf_on_household_approval');
        await expect(uploadPdfBtn).toBeVisible()
        await expect.poll(
            () => uploadPdfBtn.isChecked(),
            { timeout: 3000, intervals: [100, 200, 300, 500] }
        ).toBe(false);

        await uploadPdfBtn.check()
        console.log("📝 Checked upload PDF on household approval!");

        const saveAppBtn = page.getByTestId('submit-application-setup');
        await expect(saveAppBtn).toBeVisible();

        // Use utility for POST case
        console.log("💾 [test2] Saving new application (expect session_approval)... 🟢");
        const applicationId = await saveAndAssertUploadTrigger({
            page,
            saveAppBtn,
            expectedValue: 'session_approval',
            httpMethodOverride: 'POST',
            testNumber: 'test2'
        });
        console.log(`🎉 [test2] Application created and verified! Application ID: ${applicationId} ✔️`);

        testResults.test2.applicationId = applicationId;
        testResults.test2.passed = true;
        console.log('🏁 [test2] Test complete! ✅\n');
    })

    test('Edit Application - Checkbox State and Toggle Behavior', {
        tag: ['@core', '@regression', '@staging-ready', '@rc-ready']
    }, async ({ page }) => {
        console.log("🧪 [test3] Starting test: Edit Application - Checkbox State and Toggle Behavior");
        const ORGANIZATION_NAME = "Permissions Test Org"
        const organizations = (await adminClient.get('/organizations', {
            params: {
                name: ORGANIZATION_NAME
            }
        })).data.data;

        const organization = organizations.find(org => org.name === ORGANIZATION_NAME)

        const application = (await adminClient.post('/applications', {
            organization: organization.id,
            name: "Test Application 3",
            enable_verisync_integration: false,
            address_line_1: "",
            pms_integration_id: `test-integration-id-${Date.now()}`,
            pms_property_id: `test-property-id-${Date.now()}`,
            slug: `permissions-test-org-test-application-${Date.now()}`,
            settings: {
                "settings.applications.applicant_types": [],
                "settings.applications.pms.pdf.upload_trigger": "session_acceptance",
                "settings.applications.pms.pdf.components": []
            }
        })).data.data;

        console.log(`🆕 [test3] Created fresh application for edit testing, ID: ${application.id}`);

        testResults.test3.applicationId = application.id;

        await adminLoginAndNavigateToApplications(page, admin)

        const applicationSearch = page.getByTestId('application-search');
        await expect(applicationSearch).toBeVisible();
        await applicationSearch.fill(application.id)
        console.log("🔎 Searched for newly created application to edit");

        const applicationRow = page.getByTestId(`application-table-${application.id}`);
        await expect(applicationRow).toBeVisible();

        await applicationRow.getByTestId(`edit-${application.id}`).click()
        console.log("📝 Clicked edit button for test3 application");

        const verisyncIntegrationCheck = page.locator('#enable_verisync_integration')
        await expect(verisyncIntegrationCheck).toBeChecked();

        const uploadPdfBtn = page.locator('#upload_pdf_on_household_approval');
        await expect(uploadPdfBtn).toBeVisible()
        await expect.poll(
            () => uploadPdfBtn.isChecked(),
            { timeout: 3000, intervals: [100, 200, 300, 500] }
        ).toBe(false);
        await uploadPdfBtn.check();
        console.log("✔️ Checked upload PDF on household approval for edit scenario!");

        const saveAppBtn = page.getByTestId('submit-application-setup');
        await expect(saveAppBtn).toBeVisible();

        // First toggle ON and verify (PATCH)
        console.log("💾 [test3] Toggling ON upload_trigger (expect session_approval)... 🟢");
        await saveAndAssertUploadTrigger({
            page,
            saveAppBtn,
            applicationId: application.id,
            expectedValue: 'session_approval'
        });

        testResults.test3.applicationId = application.id;
        console.log("✅ [test3] PATCH toggle-on verified!");

        // Reload the application edit page and toggle OFF
        await page.goto(`/application/${application.id}/edit`);
        await expect(uploadPdfBtn).toBeVisible()
        await expect(uploadPdfBtn).toBeChecked();
        await uploadPdfBtn.uncheck();
        console.log("🚫 Unchecked upload PDF on household approval for toggle-off!");

        // Second toggle OFF and verify (PATCH)
        console.log("💾 [test3] Toggling OFF upload_trigger (expect session_acceptance)... 🟢");
        await saveAndAssertUploadTrigger({
            page,
            saveAppBtn,
            applicationId: application.id,
            expectedValue: 'session_acceptance'
        });

        testResults.test3.passed = true;
        console.log('🏁 [test3] Edit/Test complete! ✅\n');
    })

    test('Behavioral - Checkbox Checked (session_approval) - Upload fires on re-evaluation', {
        tag: ['@regression', '@staging-ready', '@rc-ready']
    }, async ({ page, browser }) => {
        console.log('🧪 [test4] Starting: Behavioral - session_approval upload trigger');

        if (!targetApplicationId) {
            throw new Error('❌ [test4] targetApplicationId not set — beforeAll may have failed to find the application');
        }

        // Step 1: PATCH app upload_trigger = session_approval before test
        console.log(`⚙️ [test4] Patching upload_trigger → session_approval (appId: ${targetApplicationId})`);
        await adminClient.patch(`/applications/${targetApplicationId}`, {
            settings: { 'settings.applications.pms.pdf.upload_trigger': 'session_approval' }
        });
        console.log('✅ [test4] upload_trigger patched to session_approval');

        // Step 2: Create session via createPermissionTestSession
        // Uses financial-only workflow (Autotest - Simulator Financial Step has no identity/employment steps)
        console.log('🏗️ [test4] Creating test session via createPermissionTestSession...');
        const { sessionId, applicantContext } = await createPermissionTestSession(page, browser, {
            applicationName: 'Autotest - Simulator Financial Step',
            firstName: 'Autot - PMS',
            lastName: 'Approval Test',
            email: `pms-approval-${Date.now()}@verifast.com`,
            completeIdentity: false,
            completeFinancial: true,
            completeEmployment: false,
            addChildApplicant: false,
            skipApplicantInviteStep: true,
            useCorrectMockData: true,  // Flag-free data so approve button is immediately enabled
        });
        testResults.test4.sessionId = sessionId;
        testResults.test4.applicantContext = applicantContext;
        console.log(`✅ [test4] Session created: ${sessionId}`);

        // Step 3: Navigate to applicants section and open the session
        // After createPermissionTestSession, admin is logged in and page is on the applications section
        console.log('🔍 [test4] Navigating to applicants section...');
        await page.getByTestId('applicants-menu').click();
        await page.getByTestId('applicants-submenu').click();
        await expect(page.getByTestId('side-panel')).toBeVisible({ timeout: 15_000 });

        await searchSessionWithText(page, sessionId);
        const sessionCard = await findSessionLocator(page, `.application-card[data-session="${sessionId}"]`);
        await sessionCard.click();
        await expect(page.locator('#applicant-report')).toBeVisible({ timeout: 15_000 });
        await page.waitForTimeout(2000);  // Allow report to fully load

        // Step 4: Resolve flags (none expected with useCorrectMockData) and approve via UI
        console.log('✅ [test4] Approving session via UI...');
        await approveSessionOnly(page, sessionId);

        // Step 5: Poll GET /sessions/{sessionId}/events for session.approved OR session.acceptance.approved
        console.log('📡 [test4] Polling for PMS upload event (60s timeout)...');
        const event = await pollForSessionEvent(adminClient, sessionId, ['session.approved', 'session.acceptance.approved'],  60000);
        expect(event).toBeDefined();
        console.log(`✅ [test4] PMS event found: "${event.event || event.type}" — upload triggered on re-evaluation! ✅`);

        testResults.test4.passed = true;
        console.log('🏁 [test4] Test complete! ✅\n');
    });

    test('Behavioral - Checkbox Unchecked (session_acceptance) - Upload fires on org acceptance', {
        tag: ['@regression', '@staging-ready', '@rc-ready']
    }, async ({ page, browser }) => {
        console.log('🧪 [test5] Starting: Behavioral - session_acceptance upload trigger');

        if (!targetApplicationId) {
            throw new Error('❌ [test5] targetApplicationId not set — beforeAll may have failed to find the application');
        }

        // Ensure upload_trigger is session_acceptance (default; also restores it after test4)
        console.log(`⚙️ [test5] Ensuring upload_trigger = session_acceptance (appId: ${targetApplicationId})`);
        await adminClient.patch(`/applications/${targetApplicationId}`, {
            settings: { 'settings.applications.pms.pdf.upload_trigger': 'session_acceptance' }
        });
        console.log('✅ [test5] upload_trigger confirmed as session_acceptance');

        // Step 1: Create session via createPermissionTestSession
        console.log('🏗️ [test5] Creating test session via createPermissionTestSession...');
        const { sessionId, applicantContext } = await createPermissionTestSession(page, browser, {
            applicationName: 'Autotest - Simulator Financial Step',
            firstName: 'Autot - PMS',
            lastName: 'Acceptance Test',
            email: `pms-acceptance-${Date.now()}@verifast.com`,
            completeIdentity: false,
            completeFinancial: true,
            completeEmployment: false,
            addChildApplicant: false,
            skipApplicantInviteStep: true,
            useCorrectMockData: true,
        });
        testResults.test5.sessionId = sessionId;
        testResults.test5.applicantContext = applicantContext;
        console.log(`✅ [test5] Session created: ${sessionId}`);

        // Step 2: PATCH /sessions/{sessionId} with { acceptance_status: "approved" } via API
        // This simulates the org acceptance event that triggers session.approved for session_acceptance trigger
        console.log('📝 [test5] Patching session acceptance_status → approved via API...');
        await adminClient.patch(`/sessions/${sessionId}`, { acceptance_status: 'approved' });
        console.log('✅ [test5] acceptance_status patched to approved');

        // Step 3: Poll GET /sessions/{sessionId}/events for session.approved OR session.acceptance.approved
        console.log('📡 [test5] Polling for PMS upload event (60s timeout)...');
        const event = await pollForSessionEvent(adminClient, sessionId, ['session.approved', 'session.acceptance.approved'],  60000);
        expect(event).toBeDefined();
        console.log(`✅ [test5] PMS event found: "${event.event || event.type}" — upload triggered on org acceptance! ✅`);

        testResults.test5.passed = true;
        console.log('🏁 [test5] Test complete! ✅\n');
    });

    test.afterAll(async ({ request }, testInfo) => {
        console.log('🧹 [CleanUp] Test suite cleanup (delete any remaining test data) 🧽');

        // Always restore upload_trigger to session_acceptance for the target application
        // (regardless of test4/5 pass/fail — ensures no side effects on shared app config)
        if (targetApplicationId) {
            try {
                console.log(`🔄 [Cleanup] Restoring upload_trigger → session_acceptance (appId: ${targetApplicationId})`);
                await adminClient.patch(`/applications/${targetApplicationId}`, {
                    settings: { 'settings.applications.pms.pdf.upload_trigger': 'session_acceptance' }
                });
                console.log('✅ [Cleanup] upload_trigger restored to session_acceptance');
            } catch (e) {
                console.error(`⚠️ [Cleanup] Failed to restore upload_trigger: ${e.message}`);
            }
        }

        // Cleanup test4 session
        if (testResults.test4.sessionId && testResults.test4.passed) {
            try {
                console.log(`🗑️ [Cleanup] Cleaning up test4 session: ${testResults.test4.sessionId}`);
                await cleanupTrackedSession(request, testResults.test4.sessionId, testInfo);
                console.log('✅ [Cleanup] test4 session cleaned up');
            } catch (e) {
                console.error(`⚠️ [Cleanup] Failed to cleanup test4 session: ${e.message}`);
            }
        }
        if (testResults.test4.applicantContext && testResults.test4.passed) {
            try { await testResults.test4.applicantContext.close(); } catch (_) { }
        }

        // Cleanup test5 session
        if (testResults.test5.sessionId && testResults.test5.passed) {
            try {
                console.log(`🗑️ [Cleanup] Cleaning up test5 session: ${testResults.test5.sessionId}`);
                await cleanupTrackedSession(request, testResults.test5.sessionId, testInfo);
                console.log('✅ [Cleanup] test5 session cleaned up');
            } catch (e) {
                console.error(`⚠️ [Cleanup] Failed to cleanup test5 session: ${e.message}`);
            }
        }
        if (testResults.test5.applicantContext) {
            try { await testResults.test5.applicantContext.close(); } catch (_) { }
        }

        // Cleanup test1-3 applications (delete only if test passed)
        console.log('🧹 [CleanUp] Cleaning up test1-3 applications...');
        const results = Object.entries(testResults);
        for (let index = 0; index < results.length; index++) {
            const [key, element] = results[index];
            if (['test1', 'test2', 'test3'].includes(key) && element.passed && element.applicationId) {
                try {
                    console.log(`🗑️ [Cleanup] Attempting to clean up application for test '${key}' (applicationId: ${element.applicationId})...`);
                    await cleanupApplication(request, element.applicationId);
                    console.log(`✅ [Cleanup] Successfully cleaned up application for test '${key}'! 🧹`);
                } catch (error) {
                    console.error(`⚠️ [Cleanup] Failed to clean up application for test '${key}' (applicationId: ${element.applicationId}): ${error} 😓`);
                }
            }
        }
        console.log('🏁 [CleanUp] All done! 👋');
    });
})

const fillSelect = async (page, testid, value) => {
    const select = page.getByTestId(testid)
    await select.click()
    await page.waitForTimeout(300)
    await select.getByTestId(`${testid}-search`).fill(value)
    // Wait for the filtered option matching the value to be visible before clicking.
    // nth(0) without this wait is flaky: Vue's search watcher flushes asynchronously,
    // so the unfiltered list (with preselect-first) may still be visible when nth(0) fires.
    const option = select.locator('ul.multiselect__content>li').filter({ hasText: value }).first()
    await expect(option).toBeVisible()
    await option.click()
    console.log(`👉 [fillSelect] Selected "${value}" for "${testid}" 🪄`);
}
