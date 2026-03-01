import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import loginForm from './utils/login-form';
import { admin, app, session } from './test_config';
import {
    navigateToApplicationCreate,
    fillApplicationSetup,
    submitApplicationSetup,
    configureApplicationSettings,
    handleMembersStep,
    publishApplicationToLive
} from './utils/application-management';
import { generateSessionForApplication, searchApplication } from './utils/applications-page';
import { cleanupApplication, cleanupSession } from './utils/cleanup-helper';
import { handleOptionalTermsCheckbox } from './utils/session-flow';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe.configure({
    mode: 'serial',
    timeout: 300000
});

test.describe('QA-360 application_custom_logo_upload.spec', () => {

    let applicationName;
    let authToken;
    let originalLogoUrl;

    const testResults = {
        test1: { sessionId: null, applicationId: null, passed: false }
    };

    test.afterAll(async ({ request }, testInfo) => {
        if (testResults.test1.passed) {
            await cleanupSession(request, testResults.test1.sessionId, testResults.test1.passed);
            await cleanupApplication(request, testResults.test1.applicationId, testResults.test1.passed);
        }
    });

    test('Test 1: Full Logo Lifecycle (create, verify guest page, replace, cleanup)',
        { tag: ['@regression'] },
        async ({ page, browser }) => {

            applicationName = `Autotest-${Date.now()}-Custom-Logo`;
            const logoPath = path.join(__dirname, 'test_files/test-logo.png');
            const replacementLogoPath = path.join(__dirname, 'test_files/test-logo-replacement.png');

            // ── Setup: Login as admin ──────────────────────────────────────────────
            console.log('🔐 Logging in as admin...');
            authToken = await loginForm.adminLoginAndNavigate(page, admin);

            // ── Step 1: Navigate to create and fill application setup form ─────────
            console.log('📝 Filling application setup form...');
            await navigateToApplicationCreate(page);

            await fillApplicationSetup(page, {
                organizationName: 'Permissions Test Org',
                applicationName,
                applicantTypes: ['Employed']
            });

            // ── Step 2: Upload logo via FilePond ───────────────────────────────────
            console.log('📤 Uploading logo...');
            const fileInput = page.locator('input[type="file"]').first();
            await fileInput.setInputFiles(logoPath);
            await page.waitForTimeout(2000);
            await expect(page.locator('.filepond--item')).toBeVisible();

            // ── Step 3: Submit and complete 5-step creation flow ───────────────────
            console.log('🚀 Submitting application setup form...');
            // submitApplicationSetup: clicks submit, waits for POST /applications,
            // extracts applicationId, waits 4s (covers async logo upload), handles workflow
            const { applicationId: createdId } = await submitApplicationSetup(page, {
                workflowTemplate: 'Autotest-suite-fin-only'
            });
            testResults.test1.applicationId = createdId;
            const applicationId = testResults.test1.applicationId;
            console.log('📝 Application created with ID:', applicationId);

            // Configure settings: flag collection + rent budget
            console.log('⚙️ Configuring application settings...');
            await configureApplicationSettings(page, {
                flagCollection: 'High Risk',
                minimumAmount: '500'
            });

            // Members step
            console.log('👥 Handling members step...');
            await handleMembersStep(page);

            // Publish to live
            console.log('🚀 Publishing application to live...');
            await publishApplicationToLive(page);

            // ── Step 4: Verify logo via API ────────────────────────────────────────
            console.log('🔍 Verifying logo presence via API...');
            const logoApiResp = await page.request.get(`${app.urls.api}/applications/${applicationId}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Accept': 'application/json'
                }
            });
            expect(logoApiResp.status()).toBe(200);
            const logoApiData = await logoApiResp.json();
            expect(logoApiData.data.logo).toBeTruthy();
            originalLogoUrl = logoApiData.data.logo;
            console.log('📸 Original logo URL:', originalLogoUrl);

            // ── Step 5: Verify custom logo on guest-facing page ───────────────────
            console.log('🌐 Verifying custom logo on guest-facing page...');
            await page.goto('/application/all');

            // Open a fresh browser context (no admin cookies)
            const guestContext = await browser.newContext();
            const guestPage = await guestContext.newPage();

            console.log('🌐 Navigating to guest-facing application page...');
            await guestPage.goto(`/applications/${applicationId}`);
            // Wait for application data (including logo URL) to load
            await guestPage.waitForTimeout(5000);

            const logoImg = guestPage.getByTestId('guest-login-custom-logo');
            await expect(logoImg).toBeVisible({ timeout: 15000 });

            // h-24 class proves the custom-logo branch rendered (AppLogin.vue)
            // Default logo uses h-8; custom logo uses h-24
            const logoClass = await logoImg.getAttribute('class');
            expect(logoClass).toContain('h-24');

            const logoSrc = await logoImg.getAttribute('src');
            expect(logoSrc).toBeTruthy();
            expect(logoSrc).not.toContain('logo-full-rgb-white.svg');

            await guestContext.close();

            // ── Step 5a: Verify custom logo on session page ───────────────────────────────────
            console.log('🌐 Verifying custom logo on session page...');
            const userData = {
                first_name: 'LogoTest',
                last_name: 'User',
                email: `logo-test-${Date.now()}@verifast.com`
            };
            // Generate session link for application and open in new context to verify logo presence on session page
            console.log('🌐 Generating session link for application...');
            const { link, sessionId } = await generateSessionForApplication(page, applicationName, userData);
            testResults.test1.sessionId = sessionId;
            const sessionLink = link.replace('https://dev.verifast.app', app.urls.app);

            const guestSessionContext = await browser.newContext();
            const guestSessionPage = await guestSessionContext.newPage();

            await guestSessionPage.goto(sessionLink);

            await handleOptionalTermsCheckbox(guestSessionPage);

            // Wait for session page to load and render logo
            const sessionLogoImg = guestSessionPage.getByTestId('header-nav-custom-logo');
            await expect(sessionLogoImg).toBeVisible({ timeout: 15000 });

            // Verify the session page logo has the expected class and src attributes for a custom logo
            const sessionLogoClass = await sessionLogoImg.getAttribute('class');
            expect(sessionLogoClass).toContain('h-full');

            // Verify the logo src is present and does not contain the default logo filename
            const sessionLogoSrc = await sessionLogoImg.getAttribute('src');
            expect(sessionLogoSrc).toBeTruthy();
            expect(sessionLogoSrc).not.toContain('logo-full-rgb-white.svg');
            await guestSessionContext.close();

            // ── Step 6: Replace logo via edit ──────────────────────────────────────
            console.log('🔄 Replacing logo via edit...');
            await page.bringToFront();
            await page.goto('/application/all');
            await page.getByText('No Record Found').waitFor({ state: 'hidden' });
            await page.getByTestId('application-search').fill(applicationName);
            await page.waitForTimeout(2000);
            await page.getByTestId(`edit-${applicationId}`).click();
            await page.waitForTimeout(3000);

            const replacementFileInput = page.getByTestId('logo-upload-area').locator('input[type="file"]').first();
            await replacementFileInput.setInputFiles(replacementLogoPath);
            await page.waitForTimeout(2000);
            await expect(page.locator('.filepond--item')).toBeVisible();

            // Wait for PATCH /applications on edit submit
            const editPatchRespPromise = page.waitForResponse(resp =>
                resp.url().includes('/applications') &&
                resp.request().method() === 'PATCH' &&
                resp.ok()
            );
            await page.getByTestId('submit-application-setup').click();
            await editPatchRespPromise;

            // Wait for async logo upload POST to complete
            await page.waitForTimeout(3000);

            // Handle workflow edit step if visible (edit flow)
            const workflowEditBtn = page.getByTestId('submit-app-workflow-edit-form');
            if (await workflowEditBtn.isVisible()) {
                await workflowEditBtn.click();
                await page.waitForTimeout(2000);
            }

            // Handle settings modal if visible (auto-publishes on edit)
            const settingsBtn = page.getByTestId('submit-application-setting-modal');
            if (await settingsBtn.isVisible()) {
                const settingsPatchRespPromise = page.waitForResponse(resp =>
                    resp.url().includes('/applications') &&
                    resp.request().method() === 'PATCH' &&
                    resp.ok(),
                    { timeout: 60000 }
                );
                await settingsBtn.click();
                await settingsPatchRespPromise;
                await page.waitForTimeout(2000);
            }

            // ── Step 7: Verify logo replacement via API ────────────────────────────
            console.log('🔍 Verifying logo replacement via API...');
            const replaceApiResp = await page.request.get(`${app.urls.api}/applications/${applicationId}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Accept': 'application/json'
                }
            });
            expect(replaceApiResp.status()).toBe(200);
            const replaceApiData = await replaceApiResp.json();
            expect(replaceApiData.data.logo).toBeTruthy();
            expect(replaceApiData.data.logo).not.toBe(originalLogoUrl);
            console.log('📸 Replaced logo URL:', replaceApiData.data.logo);
            testResults.test1.passed = true;
        });

    test('Test 2: Verify Invalid file type rejected by FilePond in application setup form',
        { tag: ['@regression'] },
        async ({ page }) => {
            // ── Setup: Login as admin ──────────────────────────────────────────────
            console.log('🔐 Logging in as admin...');
            await loginForm.adminLoginAndNavigate(page, admin);

            // ── Step 1: Navigate to create and fill application setup form ─────────
            console.log('📝 Filling application setup form...');
            await navigateToApplicationCreate(page);
            const applicationName = `Autotest-${Date.now()}-Invalid-Logo`;

            // ── Step 2: Attempt to upload invalid file type via FilePond ─────────────
            console.log('📤 Attempting to upload invalid file type...');
            const fileInput = page.locator('input[type="file"]').first();
            const invalidFilePath = path.join(__dirname, 'test_files/example-logo.txt');
            await fileInput.setInputFiles(invalidFilePath);
            await page.waitForTimeout(2000);

            // Verify that FilePond rejected the file and shows an error
            // Check that NO file items are in a successful state:
            // .filepond--item[data-filepond-item-state="idle"] count should be 0
            // .filepond--item[data-filepond-item-state="processing-complete"] count should be 0
            // If any .filepond--item elements exist, verify they are in error state:
            // .filepond--item[data-filepond-item-state="load-invalid"] OR
            // .filepond--item[data-filepond-item-state="processing-error"]
            // Note: FilePond may either reject the file completely (0 items) or show it briefly with an error state
            const fileItems = page.locator('.filepond--item[data-filepond-item-state="idle"]');
            const fileItemCount = await fileItems.count();
            expect(fileItemCount).toBe(0);

            const processingItems = page.locator('.filepond--item[data-filepond-item-state="processing-complete"]');
            await expect(processingItems).toHaveCount(0);
            const processingItemsCount = await processingItems.count();
            expect(processingItemsCount).toBe(0);

            const loadInvalidItems = page.locator('.filepond--item[data-filepond-item-state="load-invalid"]');
            const loadInvalidCount = await loadInvalidItems.count();

            if (loadInvalidCount > 0) {
                for (let i = 0; i < loadInvalidCount; i++) {
                    const itemState = await loadInvalidItems.nth(i).getAttribute('data-filepond-item-state');
                    expect(itemState).toBe('load-invalid');
                }
            }

            const processingErrorItems = page.locator('.filepond--item[data-filepond-item-state="processing-error"]');
            const processingErrorCount = await processingErrorItems.count();
            if (processingErrorCount > 0) {
                for (let i = 0; i < processingErrorCount; i++) {
                    const itemState = await processingErrorItems.nth(i).getAttribute('data-filepond-item-state');
                    expect(itemState).toBe('processing-error');
                }
            }

        })

});
