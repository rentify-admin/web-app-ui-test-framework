import { expect, test } from "@playwright/test";
import { admin, app } from "./test_config";
import { adminLoginAndNavigateToApplications } from "./utils/session-utils";
import { waitForJsonResponse } from "./utils/wait-response";
import { ApiClient } from "./api";
import { loginWithAdmin } from "./endpoint-utils/auth-helper";
import { cleanupApplication } from "./utils/cleanup-helper";

const testResults = {
    test1: { applicationId: null, passed: false },
    test2: { applicationId: null, passed: false },
    test3: { applicationId: null, passed: false },
}
let adminClient;
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

test.describe('QA-274 pms-upload-toggle-configuration.spec', async () => {
    test.beforeAll(async () => {
        console.log("🔑 Logging in as admin and setting up ApiClient...");
        adminClient = new ApiClient(app.urls.api, null, 120000)
        await loginWithAdmin(adminClient)
        console.log("🟢 Admin logged in and ApiClient initialized! 🚀");
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

    test.afterAll(async ({ request }) => {
        console.log('🧹 [CleanUp] Test suite cleanup (delete any remaining test application if needed) 🧽');
        const results = Object.entries(testResults);
        for (let index = 0; index < results.length; index++) {
            const [key, element] = results[index];
            if (element.passed && element.applicationId) {
                try {
                    console.log(`🗑️ [Cleanup] Attempting to clean up application for test '${key}' (applicationId: ${element.applicationId})...`);
                    await cleanupApplication(request, element.applicationId);
                    console.log(`✅ [Cleanup] Successfully cleaned up application for test '${key}'! 🧹`);
                } catch (error) {
                    console.error(`❗ [Cleanup] Failed to clean up application for test '${key}' (applicationId: ${element.applicationId}): ${error} 😓`);
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