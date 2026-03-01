import { test, expect, } from '@playwright/test';
import loginForm from './utils/login-form';
import { waitForJsonResponse } from './utils/wait-response';
import { fillMultiselect } from './utils/common';
import { cleanupApplication } from './utils/cleanup-helper';
import { ApiClient } from './api';
import { admin, app } from './test_config';
import { loginWithAdmin } from './endpoint-utils/auth-helper';


test.describe('QA-358 approval-conditions-workflow-integration.specs', () => {

    const FLAG_COLLECTION_NAME = `Test Flag Collection ${Date.now()}`;
    const APPLICATION_NAME = `Test Approval Conditions App ${Date.now()}`;

    let createdApplication;
    let createdFlagCollection;

    test('Verify Approval Conditions Workflow Integration', {
        tags: ['@approval-conditions', '@workflow-integration', '@regression', '@qa-358']
    }, async ({ page }) => {

        console.log('[Step 1] Login and goto approval conditions page');
        console.log('    > Logging in as admin and navigating to approval conditions page');
        await loginForm.adminLoginAndNavigate(page, admin);

        console.log('    > Navigating to Applications > Approval Conditions');
        await page.getByTestId('applications-menu').click();

        const flagCollectionPromise = page.waitForResponse(resp =>
            resp.url().includes('/flag-collections') && resp.request().method() === 'GET', { timeout: 30_000 });

        await page.getByTestId('approval-conditions-submenu').click();

        const flagCollectionResponse = await flagCollectionPromise;
        await expect(flagCollectionResponse.ok()).toBeTruthy();
        const flagCollectionData = await waitForJsonResponse(flagCollectionResponse);
        expect(flagCollectionData?.data).toBeDefined();
        console.log('   > Flag collection data is fetched successfully, indicating workflow integration is working');

        for (const flagCollection of flagCollectionData.data) {

            const tableRow = page.getByTestId(`approval-conditions-table-${flagCollection.id}`);
            await expect(tableRow).toBeVisible();
            await expect(tableRow).toContainText(flagCollection.name);

        }
        console.log('   > Flag collections are displayed correctly');

        console.log('[Step 2] Create a flag collection and link to application workflow');
        
        const flagCollectionCreateBtn = page.getByTestId('approval-conditions-create-button');
        console.log('   > Clicking on create flag collection button');
        await expect(flagCollectionCreateBtn).toBeVisible();

        const allFlagsPromise = page.waitForResponse(resp =>
            resp.url().includes('/flags')
            && resp.url().includes('fields[flag]')
            && resp.request().method() === 'GET'
            && resp.ok(),
            { timeout: 30_000 });
        await flagCollectionCreateBtn.click();
        const allFlagsResponse = await allFlagsPromise;
        const allFlagsData = await waitForJsonResponse(allFlagsResponse);
        const allFlags = allFlagsData?.data || [];

        
        const createForm = page.getByTestId('approval-condition-form');
        await expect(createForm).toBeVisible();

        const nameInput = createForm.getByTestId('approval-condition-name-input');
        console.log(`   > Filling flag collection name: ${FLAG_COLLECTION_NAME}`);
        await nameInput.fill(FLAG_COLLECTION_NAME);
        
        console.log(' > Selecting flags to add to the flag collection');
        const allFlagList = page.getByTestId('approval-cond-flags-list')
        const selectedFlags = allFlags.splice(0, 5)
        for (const flag of selectedFlags) {
            const flagCheckbox = allFlagList.getByTestId(`flag-checkbox-${flag.id}`);
            await expect(flagCheckbox).toBeVisible();
            await flagCheckbox.click();
        }

        console.log('   > Adding selected flags to the flag collection');
        const addFlagsButton = page.getByTestId('flag-add-selected-button');
        await expect(addFlagsButton).toBeVisible();
        await addFlagsButton.click();

        const selectedFlagList = page.getByTestId('approval-condition-selected-flags-table');
        for (const flag of selectedFlags) {
            const selectedFlagRow = selectedFlagList.getByTestId(`approval-condition-selected-flag-${flag.id}`);
            await expect(selectedFlagRow).toBeVisible();
            await expect(selectedFlagRow).toContainText(flag.name);
        }

        console.log('    > Selected flags are added to the flag collection successfully');
        const saveButton = page.getByTestId('approval-condition-save-button');

        const createFlagCollectionPromise = page.waitForResponse(resp =>
            resp.url().includes('/flag-collections')
            && resp.request().method() === 'POST'
            && resp.ok(),
            { timeout: 30_000 });

        await saveButton.click();
        const createFlagCollectionResponse = await createFlagCollectionPromise;
        const createFlagCollectionData = await waitForJsonResponse(createFlagCollectionResponse);
        await expect(createFlagCollectionData?.data).toBeDefined();
        console.log('   > Flag collection created successfully, indicating workflow integration is working');

        createdFlagCollection = createFlagCollectionData.data;

        const applicationMenu = page.getByTestId('applications-submenu');
        await applicationMenu.click();

        const createApplicationBtn = page.getByTestId('application-create-btn');
        await expect(createApplicationBtn).toBeVisible();

        await createApplicationBtn.click();

        const applicationSetup = page.getByTestId('application-setup');
        await expect(applicationSetup).toBeVisible();

        console.log(` [Step 3] Create an application and link the created flag collection to its workflow`);

        const applicationNameInput = applicationSetup.getByTestId('application-name-input');

        console.log(`    > Filling application name: ${APPLICATION_NAME}`);
        await applicationNameInput.fill(APPLICATION_NAME);

        const orgInput = applicationSetup.getByTestId('organization-input');
        console.log('    > Selecting organization for the application');

        await fillMultiselect(page, orgInput, ['Permissions Test Org']);

        console.log('    > Organization selected successfully');
        const saveAppButton = applicationSetup.getByTestId('submit-application-setup');
        const createApplicationPromise = page.waitForResponse(resp =>
            resp.url().includes('/applications')
            && resp.request().method() === 'POST'
            && resp.ok(),
            { timeout: 30_000 });
        await saveAppButton.click();
        const createApplicationResponse = await createApplicationPromise;
        const createApplicationData = await waitForJsonResponse(createApplicationResponse);
        await expect(createApplicationData?.data).toBeDefined();

        createdApplication = createApplicationData.data;

        console.log('    > Application created successfully');

        const workflowEditForm = page.getByTestId('app-workflow-edit-form');
        await expect(workflowEditForm).toBeVisible();

        console.log('    > Linking the created flag collection to the application workflow');
        const workflowFlagCollectionSelect = workflowEditForm.getByTestId('workflow-select-input');
        const workflowUpdatePromise = page.waitForResponse(resp =>
            resp.url().includes('/applications/')
            && resp.request().method() === 'PATCH'
            && resp.ok(),
            { timeout: 30_000 });
        await workflowFlagCollectionSelect.getByTestId('workflow-select-input-placeholder').click()
        await workflowFlagCollectionSelect.getByTestId('workflow-select-input-0').click()
        await workflowUpdatePromise;
        const submitWorkflow = workflowEditForm.getByTestId('submit-app-workflow-edit-form');

        console.log('    > Submitting the workflow update form to link the flag collection to the application workflow');
        await submitWorkflow.click();
        const appApprovalSettings = page.getByTestId('application-setting-modal');
        await expect(appApprovalSettings).toBeVisible();

        console.log('    > Workflow updated successfully');
        
        console.log('    > Selecting eligibility template');
        const eligibilityInput = page.getByTestId('eligibility-template-selector');
        await expect(eligibilityInput).toBeVisible();
        await eligibilityInput.getByTestId('eligibility-template-selector-placeholder').click();
        await eligibilityInput.getByTestId('eligibility-template-selector-0').click();

        await page.waitForTimeout(2000); // Wait for the workflow update to reflect in the UI

        const flagCollectionSelect = appApprovalSettings.getByTestId('flag-connections-select');
        await expect(flagCollectionSelect).toBeVisible();

        console.log('    > Selecting the created flag collection in application approval settings');
        await fillMultiselect(page, flagCollectionSelect, [FLAG_COLLECTION_NAME]);

        console.log('    > Expanding the flag collection to verify selected flags');
        const flagCollectionCollapseBtn = appApprovalSettings.getByTestId(`flag-collection-collapse`);
        
        await flagCollectionCollapseBtn.click();

        console.log('    > Verifying that the selected flags are displayed under the flag collection');
        for (const flag of selectedFlags) {
            const flagRow = appApprovalSettings.getByTestId(`flag-collection-flag-${flag.id}`);
            await expect(flagRow).toBeVisible();
            await expect(flagRow).toContainText(flag.name);
        }
        const applicationApprovalSettingPromise = page.waitForResponse(resp =>
            resp.url().includes(`/applications`)
            && resp.request().method() === 'PATCH',
            { timeout: 30_000 });
        const saveAppApprovalSettings = appApprovalSettings.getByTestId('submit-application-setting-modal');
        console.log('    > Saving application approval settings');
        await saveAppApprovalSettings.click();
        const applicationApprovalSettingResponse = await applicationApprovalSettingPromise;
        await expect(applicationApprovalSettingResponse.ok()).toBeTruthy();
        const applicationApprovalSettingData = await waitForJsonResponse(applicationApprovalSettingResponse);
        await expect(applicationApprovalSettingData?.data).toBeDefined();
        const application = applicationApprovalSettingData.data;
        await expect(application.flag_collection?.id).toBe(createdFlagCollection.id);
        console.log('✅ Application approval settings updated successfully, indicating workflow integration is working');
    })

    test.afterAll(async ({ request }, testInfo) => {
        console.log('[Cleanup] Starting cleanup of created test data');
        if (testInfo.status === testInfo.expectedStatus) {
            const adminClient = new ApiClient(app.urls.api, null, 120_000)
            await loginWithAdmin(adminClient);
            console.log(' > Logged in as admin for cleanup');
            if (createdApplication) {
                await adminClient.delete(`/applications/${createdApplication.id}`);
                console.log('✅ Application deleted successfully');
            }
            if (createdFlagCollection) {
                await adminClient.delete(`/flag-collections/${createdFlagCollection.id}`);
                console.log('✅ Flag collection deleted successfully');

            }
        } else {
            console.log('❌ Test failed, skipping cleanup to preserve data for debugging');
        }
    })

});