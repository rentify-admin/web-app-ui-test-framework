import { expect, test } from "@playwright/test";
import { adminLoginAndNavigateToApplications } from "../utils/session-utils";
import { fillMultiselect } from "../utils/common";
import { waitForJsonResponse } from "../utils/wait-response";
import { ApiClient } from "../api";
import { admin, app } from "../test_config";
import { loginWithAdmin } from "../endpoint-utils/auth-helper";
import { searchApplication } from "../utils/applications-page";


// Test the auto-fill functionality for the Custom Application URL field based on the Application Name, including character transformation, organization prefix, duplicate detection, and collision handling
test.describe("QA-359 application-url-autofill.spec", () => {


    const cleanupData = {
        test1: { applicationId: null },
        test2: { applicationId: null, applicationId2: null },
        test3: { applicationId: null }
    }

    test("[TEST 1] Verify Autofill application custom URL with app name (VC-1589)", {
        tag: ["@regression", "@application", "@autofill"]
    }, async ({ page }) => {
        
        console.log("[TEST 1][STEP 1]: Verify basic auto-fill functionality with organization prefix");
        // Navigate to the application creation page
        console.log('[TEST 1] > Login and navigate to applications page');
        await adminLoginAndNavigateToApplications(page, admin);

        console.log('[TEST 1] > Clicking "Create Application" button');
        const createAppButton = page.getByTestId("application-create-btn");
        await expect(createAppButton).toBeVisible();
        await createAppButton.click();

        const applicationSetupPage = page.getByTestId("application-setup");
        await expect(applicationSetupPage).toBeVisible();

        console.log('[TEST 1] > Selecting organization and filling application name to trigger auto-fill');
        const organizationName = 'Permissions Test Org';
        const organizationInput = page.getByTestId('organization-input');
        await fillMultiselect(page, organizationInput, [organizationName]);

        console.log('[TEST 1] > Filling application name: "Summer Application 2025"');
        const applicationName = `Summer Application 2025`
        const appNameInput = applicationSetupPage.getByTestId('application-name-input');
        await appNameInput.fill(applicationName);

        await page.waitForTimeout(1000); // Wait for the auto-fill to process

        console.log('[TEST 1] > Verifying that the URL auto-fills with the expected format and organization prefix');
        const expectedURL = `${organizationName.toLowerCase().replace(/\s+/g, '-')}-${applicationName.toLowerCase().replace(/\s+/g, '-')}`;
        const slugInput = applicationSetupPage.getByTestId('slug-input');
        await expect(slugInput).toHaveValue(expectedURL);

        // Step 2: Special characters and multiple spaces transformation
        console.log("[TEST 1][STEP 2]: Special characters and multiple spaces transformation");

        console.log('[TEST 1] > Filling application name with special characters and multiple spaces: " Pre-Approval Form!!! @2025"');
        const specialAppName = `  Pre-Approval   Form!!!   @2025`;
        await appNameInput.fill(specialAppName);
        await page.waitForTimeout(1000); // Wait for the auto-fill to process

        console.log('[TEST 1] > Verifying that the URL auto-fills with special characters removed, multiple spaces replaced, and organization prefix intact');
        const expectedSpecialURL = `${organizationName.toLowerCase().replace(/\s+/g, '-')}-${specialAppName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
        await expect(slugInput).toHaveValue(expectedSpecialURL);

        console.log('[TEST 1] > Test 1 passed, proceeding to cleanup');
        const cancelButton = applicationSetupPage.getByTestId('cancel-application-setup');
        await cancelButton.click();
        await page.waitForTimeout(500)
    })

    test("[TEST 2] Verify duplicate URL detection and collision handling", {
        tag: ["@regression", "@application", "@autofill"]
    }, async ({ page }) => {


        /**
         * Test Steps:
         *  [Step 1]  Create first application
         *  - Generate unique app name: const appName = `Autotest-${Date.now()}-Collision Test`
         *  - Click "Create Application"
         *  - Select organization: "Permissions Test Org"
         *  - Fill application name: {appName}
         *  - Click "Save & Continue"
         *  - API Verification: Intercept POST /applications, verify status 201
         * 
         * [Step 2] Step 2: Create second application with same name
         *  - Click "Create Application"
         *  - Fill same {appName} as Step 1
         *  - API Verification: Verify status 422 (validation error)
         *  - Verify slug automatically updates with suffix: "{original-slug}-001"
         *  - Click "Save & Continue" again
         *  - API Verification: Verify status 201, slug has -001 suffix
         */

        console.log('[TEST 2][STEP 1] Create first application with unique name to generate URL');

        console.log('[TEST 2] > Login and navigate to applications page');
        await adminLoginAndNavigateToApplications(page, admin);

        console.log('[TEST 2] > Clicking "Create Application" button');
        const appName = `Autotest-${Date.now()}-Collision Test`
        // Create the first application to generate a URL
        const createAppButton = page.getByTestId("application-create-btn");
        await expect(createAppButton).toBeVisible();
        await createAppButton.click();

        const applicationSetupPage = page.getByTestId("application-setup");
        await expect(applicationSetupPage).toBeVisible();
        
        console.log('[TEST 2] > Selecting organization');
        const organizationName = 'Permissions Test Org';
        const organizationInput = page.getByTestId('organization-input');
        await fillMultiselect(page, organizationInput, [organizationName]);

        console.log(`[TEST 2] > Filling application name: ${appName}`);
        const appNameInput = applicationSetupPage.getByTestId('application-name-input');
        await appNameInput.fill(appName);
        await page.waitForTimeout(1000); // Wait for the auto-fill to process

        console.log('[TEST 2] > Verifying that the URL auto-fills with the expected format and organization prefix');
        const expectedURL = `${organizationName.toLowerCase().replace(/\s+/g, '-')}-${appName.toLowerCase().replace(/\s+/g, '-')}`;
        const slugInput = applicationSetupPage.getByTestId('slug-input');
        await expect(slugInput).toHaveValue(expectedURL);

        // Save the first application
        console.log('[TEST 2] > Saving the first application and verifying API response');
        const saveButton = applicationSetupPage.getByTestId('submit-application-setup');
        const applicationPromise = page.waitForResponse(response =>
            response.url().includes('/applications') &&
            response.request().method() === 'POST'
        );
        await saveButton.click();
        const applicationResponse = await applicationPromise;
        expect(applicationResponse.status()).toBe(201);
        const requestPayload = JSON.parse(applicationResponse.request().postData() || '{}');
        expect(requestPayload.slug).toBe(expectedURL);
        const applicationData = await waitForJsonResponse(applicationResponse);
        const { data: application } = applicationData;
        cleanupData.test2.applicationId = application.id; // Store application ID for cleanup

        // Create the second application with the same name to trigger duplicate URL detection
        console.log('[TEST 2][STEP 2] Create second application with the same name to trigger duplicate URL detection');

        console.log('[TEST 2] > Clicking "Create Application" button again');
        const applicationsSubmenu = page.getByTestId("applications-submenu");
        await applicationsSubmenu.click();
        await expect(createAppButton).toBeVisible();
        await createAppButton.click();

        console.log(`[TEST 2] > Filling the same application name again: ${appName} to trigger duplicate URL detection`);
        await expect(applicationSetupPage).toBeVisible();
        await fillMultiselect(page, organizationInput, [organizationName]);
        await appNameInput.fill(appName);
        await page.waitForTimeout(1000); // Wait for the auto-fill to process

        let secondExpectedURL = `${organizationName.toLowerCase().replace(/\s+/g, '-')}-${appName.toLowerCase().replace(/\s+/g, '-')}`;
        await expect(slugInput).toHaveValue(secondExpectedURL);

        console.log('[TEST 2] > Verifying that a validation error is shown for duplicate URL');
        const submitButton = applicationSetupPage.getByTestId('submit-application-setup');
        const duplicateResponsePromise = page.waitForResponse(response =>
            response.url().includes('/applications') &&
            response.request().method() === 'POST')
        await submitButton.click();
        const duplicateResponse = await duplicateResponsePromise;
        expect(duplicateResponse.status()).toBe(422); // Expect validation error for duplicate URL

        console.log('[TEST 2] > Verifying that a slug input error message is displayed for the duplicate URL');
        const slugError = applicationSetupPage.getByTestId('slug-input-error');
        await expect(slugError).toBeVisible();

        console.log('[TEST 2] > Verifying that the slug input updates with a suffix to resolve the collision');
        secondExpectedURL = `${expectedURL}-001`;
        await expect(slugInput).toHaveValue(secondExpectedURL);

        console.log('[TEST 2] > Saving the second application with the collision-resolved slug and verifying API response');
        const secondSavePromise = page.waitForResponse(response =>
            response.url().includes('/applications') &&
            response.request().method() === 'POST'
        );
        await submitButton.click();
        const secondSaveResponse = await secondSavePromise;
        expect(secondSaveResponse.status()).toBe(201);
        const secondRequestPayload = JSON.parse(secondSaveResponse.request().postData() || '{}');
        expect(secondRequestPayload.slug).toBe(secondExpectedURL);
        const secondApplicationData = await waitForJsonResponse(secondSaveResponse);
        const { data: secondApplication } = secondApplicationData;
        cleanupData.test2.applicationId2 = secondApplication.id;
    })

    test("[TEST 3] Editing existing application does NOT auto-fill", {
        tag: ["@regression", "@application", "@autofill"]
    }, async ({ page }) => {

        /**
         * Test Steps:
         * [Step 1] Create application to edit
         * - Generate unique app name: const appName = `Autotest-${Date.now()}-Edit Test`
         * - Click "Create Application"
         * - Select organization: "Permissions Test Org"
         * - Fill application name: {appName}
         * - Click "Save & Continue"
         * - API Verification: Intercept POST /applications, verify status 201
         * [Step 2] Edit application name and verify URL does NOT auto-fill
         * - Click "Edit" on the created application
         * - Change application name to: {appName} + " Updated"
         * - Verify slug does NOT change and auto-fill does NOT trigger
         * - Verify slug field is still editable
         */

        console.log('[TEST 3][STEP 1] Create application to edit');

        console.log('[TEST 3] > Login and navigate to applications page');
        await adminLoginAndNavigateToApplications(page, admin);

        console.log('[TEST 3] > Clicking "Create Application" button');
        const createAppButton = page.getByTestId("application-create-btn");
        await expect(createAppButton).toBeVisible();
        await createAppButton.click();

        console.log('[TEST 3] > Waiting for application setup page to be visible');
        const applicationSetupPage = page.getByTestId("application-setup");
        await expect(applicationSetupPage).toBeVisible();
        const organizationName = 'Permissions Test Org';
        const organizationInput = page.getByTestId('organization-input');
        await fillMultiselect(page, organizationInput, [organizationName]);

        const appName = `Autotest-${Date.now()}-Edit Test`
        console.log(`[TEST 3] > Filling application name: ${appName}`);
        const appNameInput = applicationSetupPage.getByTestId('application-name-input');
        await appNameInput.fill(appName);
        await page.waitForTimeout(1000); // Wait for the auto-fill to process

        console.log('[TEST 3] > Verifying that the URL auto-fills with the expected format and organization prefix');
        const expectedURL = `${organizationName.toLowerCase().replace(/\s+/g, '-')}-${appName.toLowerCase().replace(/\s+/g, '-')}`;
        const slugInput = applicationSetupPage.getByTestId('slug-input');
        await expect(slugInput).toHaveValue(expectedURL);

        // Save the application
        console.log('[TEST 3] > Saving the application and verifying API response');
        const saveButton = applicationSetupPage.getByTestId('submit-application-setup');
        const applicationPromise = page.waitForResponse(response =>
            response.url().includes('/applications') &&
            response.request().method() === 'POST'
        );
        await saveButton.click();
        const applicationResponse = await applicationPromise;
        expect(applicationResponse.status()).toBe(201);
        const requestPayload = JSON.parse(applicationResponse.request().postData() || '{}');
        expect(requestPayload.slug).toBe(expectedURL);
        const applicationData = await waitForJsonResponse(applicationResponse);
        const { data: application } = applicationData;
        cleanupData.test3.applicationId = application.id; // Store application ID for cleanup
        
        // Edit the application name
        console.log('[TEST 3][STEP 2] Edit application name and verify URL does NOT auto-fill');
        const applicationsSubmenu = page.getByTestId("applications-submenu");
        await applicationsSubmenu.click();
        await searchApplication(page, appName);

        console.log(`[TEST 3] > Clicking "Edit" on the created application to verify that auto-fill does NOT trigger on edit`);
        const editButton = page.getByTestId(`edit-${application.id}`);
        const applicationEditPromise = page.waitForResponse(response =>
            response.url().includes(`/applications/${application.id}`) &&
            response.url().includes(`fields[application]`) &&
            response.request().method() === 'GET' &&
            response.ok()
        );
        await editButton.click();
        await applicationEditPromise;

        console.log(`[TEST 3] > Changing application name to: ${appName} Updated and verifying that slug does NOT auto-fill or change`);
        const newAppName = `${appName} Updated`;
        await expect(applicationSetupPage).toBeVisible();

        console.log(`[TEST 3] > Filling new application name: ${newAppName} and verifying that slug does NOT auto-fill or change`);
        await appNameInput.fill(newAppName);
        await page.waitForTimeout(1000); // Wait to see if auto-fill triggers

        console.log(`[TEST 3] > Verifying that the slug value remains unchanged at: ${expectedURL} and that the slug field is still editable, confirming that auto-fill does NOT trigger on edit`);
        // Verify that the slug does NOT change and auto-fill does NOT trigger
        await expect(slugInput).toHaveValue(expectedURL); // Slug should remain the same as original URL
        await expect(slugInput).toBeEditable(); // Slug field should still be editable
    })


    test.afterAll(async () => {

        const adminClient = new ApiClient(app.urls.api, null, 120_000)
        await loginWithAdmin(adminClient);

        // Cleanup created applications
        for (const key of Object.keys(cleanupData)) {
            const { applicationId, applicationId2 } = cleanupData[key];
            for (const id of [applicationId, applicationId2].filter(Boolean)) {
                try {
                    await adminClient.delete(`/applications/${id}`);
                    console.log(`Cleaned up application with ID: ${id}`);
                } catch (error) {
                    console.error(`Failed to delete application with ID: ${id}`, error);
                }
            }
        }

    })

})