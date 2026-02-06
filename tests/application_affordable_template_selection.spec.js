import { test, expect } from '@playwright/test';
import { adminLoginAndNavigateToApplications } from './utils/session-utils';
import { admin } from './test_config';
import { searchApplication } from './utils/applications-page';
import { waitForJsonResponse } from './utils/wait-response';

test.describe('QA-344 application_affordable_template_selection.spec', () => {

    const APPLICATION_NAME = 'AutoTest Suite - Full Test';

    test('should verify affordable template selection in application approval settings', async ({ page }) => {
        console.log('🔑 Step 0: Logging in and navigating to Applications page');
        const applicationsPromise = page.waitForResponse(response =>
            response.url().includes('/applications')
            && response.request().method() === 'GET'
            && response.ok()
        );
        await adminLoginAndNavigateToApplications(page, admin);
        await applicationsPromise;
        console.log('✅ Arrived at Applications page');

        console.log(`🔍 Searching for application: "${APPLICATION_NAME}"`);
        const applications = await searchApplication(page, APPLICATION_NAME);

        expect(applications.length).toBeGreaterThan(0);
        console.log(`✅ Found ${applications.length} application(s) for "${APPLICATION_NAME}"`);

        const applicationId = applications[0].id;
        console.log(`📝 Working on applicationId: ${applicationId}`);

        const applicationPromise = page.waitForResponse(response =>
            response.url().includes(`/applications/${applicationId}`)
            && response.url().includes('fields[application]')
            && response.request().method() === 'GET'
            && response.ok()
        );
        await page.getByTestId(`edit-${applicationId}`).click();
        await applicationPromise;
        console.log(`✅ Navigated to application edit page for ID ${applicationId}`);

        // Step 1: Navigate to Approval Settings Step
        const approvalSettingTab = page.getByTestId('step-#approval-settings');
        const approvalSettingsPromise = page.waitForResponse(response =>
            response.url().includes('/eligibility-templates')
            && response.url().includes('fields[eligibility_template]')
            && response.request().method() === 'GET'
            && response.ok()
        );
        console.log('➡️ Clicking Approval Settings tab');
        await approvalSettingTab.click();
        const approvalSettingsResponse = await approvalSettingsPromise;
        const { data: approvalTemplates } = await waitForJsonResponse(approvalSettingsResponse);
        const url = approvalSettingsResponse.url();
        console.log(`🌐 Approval templates API URL: ${url}`);
        expect(url.includes('PUBLISHED')).toBeTruthy();

        expect(approvalTemplates.length).toBeGreaterThan(0);
        console.log(`✅ ${approvalTemplates.length} approval templates fetched`);

        approvalTemplates.forEach(template => {
            expect(template.status).toBe('PUBLISHED');
            expect(template._type).toBe('eligibility_template');
        });
        console.log('✅ All templates have status "PUBLISHED" and correct _type');

        // Step 2: Verify Affordable Template Selector
        const templateSelector = page.getByTestId('eligibility-template-selector');
        const selectedTag = templateSelector.getByTestId('eligibility-template-selector-single-value');
        let alreadySelectedText = '';
        if (await selectedTag.isVisible()) {
            alreadySelectedText = await selectedTag.textContent();
            console.log(`🔹 A template is already selected: "${alreadySelectedText?.trim()}" - deselecting`);
            await page.getByTestId('eligibility-template-selector-clear').click();
        } else {
            console.log('🔹 No template selected by default');
        }

        await expect(templateSelector).toBeVisible();
        await expect(templateSelector.getByTestId('eligibility-template-selector-placeholder')).toBeVisible();
        console.log('✅ Template selector and placeholder are visible');

        const publishedTemplates = approvalTemplates.filter(t => t.status === 'PUBLISHED');
        expect(publishedTemplates.length).toBeGreaterThan(0);

        await templateSelector.click();
        console.log('🔽 Opened template dropdown');

        const options = page.locator(`[role=option][data-testid^="eligibility-template-selector-"]`);

        const optionCount = await options.count();
        console.log(`🟡 Visible dropdown options: ${optionCount}`);
        expect(optionCount).toBe(publishedTemplates.length);

        for (let i = 0; i < optionCount; i++) {
            const option = options.nth(i);
            await expect(option).toBeVisible();
            const templateName = (await option.textContent())?.trim();
            console.log(`   - 🏷️ Option: "${templateName}"`);
            await expect(publishedTemplates.some(t => t.name === templateName)).toBeTruthy();
        }
        console.log('✅ All dropdown options correspond to published templates');

        // verify selector is searchable (if applicable)
        const searchInput = page.getByTestId('eligibility-template-selector-search');
        await expect(searchInput).toBeVisible();
        console.log('🔎 Template selector search input is visible');

        const filteredTemplate = publishedTemplates.filter(template => template.name !== alreadySelectedText)
        expect(filteredTemplate.length).toBeGreaterThan(0);
        const searchTemplate = filteredTemplate[0];
        console.log(`🔎 Searching for template: "${searchTemplate.name}"`);
        await searchInput.fill(searchTemplate.name);

        const filteredOptions = page.locator(`[role=option][data-testid^="eligibility-template-selector-"]`);
        const filteredCount = await filteredOptions.count();
        expect(filteredCount).toBeGreaterThan(0);
        console.log(`🟣 Dropdown filtered, ${filteredCount} option(s) visible`);

        for (let i = 0; i < filteredCount; i++) {
            const option = filteredOptions.nth(i);
            const templateName = (await option.textContent())?.trim() ?? '';
            expect(templateName.toLowerCase().includes(searchTemplate.name.toLowerCase())).toBeTruthy();
            console.log(`   - Result: "${templateName}"`);
        }
        // Close dropdown
        await templateSelector.press('Escape');
        console.log('🔺 Closed template dropdown');

        // Step 3: Select Affordable Template
        await templateSelector.click();

        if (publishedTemplates.length === 0) {
            console.warn('⚠️ No PUBLISHED templates available for selection. Skipping selection test.');
        } else {
            const firstTemplate = publishedTemplates[0];
            console.log(`🟢 Selecting first published template: "${firstTemplate.name}"`);
            const firstOption = options.filter({ hasText: firstTemplate.name }).first();
            await firstOption.click();
            const selectedTag = page.getByTestId('eligibility-template-selector-single-value').getByText(firstTemplate.name);
            await expect(selectedTag).toBeVisible();
            console.log(`✅ Selected template visibly tagged: "${firstTemplate.name}"`);

            const selectorError = page.getByTestId('eligibility-template-selector-error');
            await expect(selectorError).not.toBeVisible();
            console.log('✅ No selector errors present');
        }

        // Step 4: Save Application and Verify API Call
        console.log('💾 Clicking submit (save) button');
        const submitButton = page.getByTestId('submit-application-setting-modal');
        const patchApplicationPromise = page.waitForResponse(response =>
            response.url().includes(`/applications/${applicationId}`)
            && response.request().method() === 'PATCH'
        );
        await submitButton.click();
        const patchApplicationResponse = await patchApplicationPromise;
        const patchRequest = patchApplicationResponse.request();
        const patchPostData = JSON.parse(patchRequest.postData() || '{}');

        expect(patchPostData).toHaveProperty('eligibility_template');
        const selectedTemplateId = patchPostData.eligibility_template;
        const selectedTemplate = publishedTemplates.find(t => t.id === selectedTemplateId);
        console.log(`🧾 PATCH sent with eligibility_template: ${selectedTemplateId} (${selectedTemplate?.name})`);
        expect(selectedTemplate).toBeDefined();
        expect(patchPostData).toHaveProperty('settings');
        expect(patchPostData).toHaveProperty('flag_collection');
        expect(patchApplicationResponse.ok()).toBeTruthy();

        const { data: patchedApplicationData } = await waitForJsonResponse(patchApplicationResponse);
        expect(patchedApplicationData).toHaveProperty('id', applicationId);
        console.log('✅ Application PATCH request successful and contains updated data');

        // Step 5: Verify Persistence After Page Refresh
        const reloadApplicationPromise = page.waitForResponse(response =>
            response.url().includes(`/applications/${applicationId}`)
            && response.url().includes('fields[application]')
            && response.request().method() === 'GET'
            && response.ok()
        );

        console.log('🔄 Reloading application edit page for persistence check');
        await page.reload({ waitUntil: 'networkidle' });
        await reloadApplicationPromise;
        await approvalSettingTab.click();

        const reloadApprovalSettingsPromise = page.waitForResponse(response =>
            response.url().includes('/eligibility-templates')
            && response.url().includes('fields[eligibility_template]')
            && response.request().method() === 'GET'
            && response.ok()
        );
        const reloadApprovalSettingsResponse = await reloadApprovalSettingsPromise;
        const { data: reloadedTemplates } = await waitForJsonResponse(reloadApprovalSettingsResponse);
        expect(reloadedTemplates.length).toBeGreaterThan(0);

        const reloadedTemplateSelector = page.getByTestId('eligibility-template-selector');
        const selectedTagAfterReload = reloadedTemplateSelector.getByTestId('eligibility-template-selector-single-value').getByText(selectedTemplate?.name);
        await expect(selectedTagAfterReload).toBeVisible();
        console.log(`✅ After refresh, template "${selectedTemplate?.name}" remains selected in selector`);

        // Step 6: Clear selection and verify empty state persists (Bug regression test)
        console.log('\n🧪 Step 6: Clear template selection and verify empty state persists');
        console.log('🔄 Clearing template selection...');

        const clearButton = page.getByTestId('eligibility-template-selector-clear');
        await expect(clearButton).toBeVisible();
        await clearButton.click();

        // Verify selector shows placeholder again
        const placeholder = reloadedTemplateSelector.getByTestId('eligibility-template-selector-placeholder');
        await expect(placeholder).toBeVisible();
        console.log('✅ Placeholder visible after clearing selection');

        // Verify no template is selected
        const selectedTagAfterClear = reloadedTemplateSelector.getByTestId('eligibility-template-selector-single-value');
        await expect(selectedTagAfterClear).not.toBeVisible();
        console.log('✅ No template selected after clear');

        // Wait for form to update (ensure model is updated, not just UI)
        await page.waitForTimeout(500);
        console.log('⏳ Waited for form model to update');

        // Save application with empty template
        console.log('💾 Saving application with cleared template...');
        const submitButtonAfterClear = page.getByTestId('submit-application-setting-modal');

        const patchClearPromise = page.waitForResponse(response =>
            response.url().includes(`/applications/${applicationId}`)
            && response.request().method() === 'PATCH'
        );

        await submitButtonAfterClear.click();
        const patchClearResponse = await patchClearPromise;
        const patchClearRequest = patchClearResponse.request();
        const patchClearData = JSON.parse(patchClearRequest.postData() || '{}');

        // Verify eligibility_template is null or not present
        if (patchClearData.hasOwnProperty('eligibility_template')) {
            expect(patchClearData.eligibility_template).toBeNull();
            console.log('📦 PATCH sent with eligibility_template: null');
        } else {
            console.log('📦 PATCH sent without eligibility_template field');
        }

        expect(patchClearResponse.ok()).toBeTruthy();
        console.log('✅ Save successful with cleared template');

        // Reload page to verify empty state persists
        console.log('🔄 Reloading page to verify cleared selection persists...');
        const reloadAfterClearPromise = page.waitForResponse(response =>
            response.url().includes(`/applications/${applicationId}`)
            && response.url().includes('fields[application]')
            && response.request().method() === 'GET'
            && response.ok()
        );

        await page.reload({ waitUntil: 'networkidle' });
        const reloadAfterClearResponse = await reloadAfterClearPromise;

        // Verify GET response has no template or null template
        const { data: reloadedAppData } = await waitForJsonResponse(reloadAfterClearResponse);
        if (reloadedAppData.hasOwnProperty('eligibility_template')) {
            expect(reloadedAppData.eligibility_template).toBeNull();
            console.log('📥 GET response shows eligibility_template: null');
        } else {
            console.log('📥 GET response does not include eligibility_template field');
        }

        // Navigate to Approval Settings to verify UI
        await approvalSettingTab.click();

        const reloadTemplatesAfterClear = page.waitForResponse(response =>
            response.url().includes('/eligibility-templates')
            && response.url().includes('fields[eligibility_template]')
            && response.request().method() === 'GET'
            && response.ok()
        );
        await reloadTemplatesAfterClear;

        // Verify selector is empty
        const finalTemplateSelector = page.getByTestId('eligibility-template-selector');
        const finalPlaceholder = finalTemplateSelector.getByTestId('eligibility-template-selector-placeholder');
        const finalSelectedTag = finalTemplateSelector.getByTestId('eligibility-template-selector-single-value');

        await expect(finalPlaceholder).toBeVisible();
        await expect(finalSelectedTag).not.toBeVisible();
        console.log('✅ After reload, template selector is empty (placeholder visible, no selection)');

        // Verify clear button is not visible (nothing to clear)
        const finalClearButton = page.getByTestId('eligibility-template-selector-clear');
        await expect(finalClearButton).not.toBeVisible();
        console.log('✅ Clear button not visible (expected, nothing to clear)');

        console.log('🎉 Test complete: affordable template selection, persistence, and clear-empty-state verified');
    });
});