import { expect, test } from '@playwright/test';
import { admin, app } from './test_config';
import { findAndInviteApplication } from './utils/applications-page';
import generateSessionForm from './utils/generate-session-form';
import loginForm from './utils/login-form';
import { joinUrl } from './utils/helper';
import { cleanupTrackedSession } from './utils/cleanup-helper';

test.describe('QA-363 session_extension.spec', () => {
    test.describe.configure({ mode: 'serial' });

    const APPLICATION_NAME = 'Autotest - Fin simulator and Lifecycle';

    let sessionId = null;

    test.afterAll(async ({ request }, testInfo) => {
        await cleanupTrackedSession(request, sessionId, testInfo);
        sessionId = null;
    });

    test('Should Display Time Remaining and Extend Session', {
        tag: ['@smoke', '@regression']
    }, async ({ page }) => {
        // Setup
        console.log('[Setup] Login as admin with CREATE_SESSION_EXTENSIONS and VIEW_SESSION_EXTENSIONS permissions');
        const authToken = await loginForm.adminLoginAndNavigate(page, admin);

        console.log('[Setup] Use existing application:', APPLICATION_NAME);
        await page.getByTestId('applications-menu').click();
        await page.getByTestId('applications-submenu').click();
        await page.waitForTimeout(1500);

        await findAndInviteApplication(page, APPLICATION_NAME);

        const userData = {
            firstName: 'Session',
            lastName: 'Extension',
            email: `test.session.extension+${Date.now()}@example.com`
        };

        console.log('[Setup] Create session under the application (expires_at = creation + 48hrs)');
        const { sessionData, sessionId: createdSessionId } = await generateSessionForm.generateSessionAndExtractLink(page, userData);
        sessionId = createdSessionId;

        const sessionResp = await page.request.get(
            joinUrl(app.urls.api, `sessions/${sessionId}`),
            {
                params: {
                    'fields[session]': 'expires_at,expired_at,id'
                },
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Accept': 'application/json'
                }
            }
        );

        const sessionRespData = await sessionResp.json();
        const session = sessionRespData.data;
        const initialExpiredAt = new Date(session.expires_at);
        console.log('[Setup] Session created. Expires at:', initialExpiredAt.toISOString());

        console.log('[Setup] Navigate to applicant report page');
        await page.goto(`/applicants/all/${sessionId}`);

        // Step 1: Verify time remaining displays
        console.log('[Step 1] Verify time remaining displays');
        const sessionReport = page.getByTestId('session-report-section');
        await expect(sessionReport).toBeVisible();
        console.log(' - session-report-section is visible');

        const sessionExtendTrigger = page.getByTestId('session-extend-trigger');
        await expect(sessionExtendTrigger).toBeVisible();
        console.log(' - session-extend-trigger is visible');

        await expect(sessionExtendTrigger).toHaveText(/Expires in: \d+ hours \d+ minutes/);
        console.log(' - button text matches "Expires in:" format');

        await expect(sessionExtendTrigger).toHaveClass(/text-information-primary/);
        console.log(' - button has text-information-primary styling');

        // Step 2: Open extension modal
        console.log('[Step 2] Open extension modal');
        await sessionExtendTrigger.click();

        const sessionExtendModal = page.getByTestId('session-extend-modal');
        await expect(sessionExtendModal).toBeVisible();
        console.log(' - extension modal is visible');

        await expect(sessionExtendModal.getByText('Session Extend')).toBeVisible();
        console.log(' - modal header displays "Session Extend"');

        const extensionHoursInput = sessionExtendModal.locator('input[type="number"]');
        await expect(extensionHoursInput).toBeVisible();
        await expect(extensionHoursInput).toHaveValue('1');
        console.log(' - extension hours input visible, default 1');

        const reasonTextarea = sessionExtendModal.locator('textarea');
        await expect(reasonTextarea).toBeVisible();
        await expect(reasonTextarea).toHaveValue('');
        console.log(' - reason textarea visible and empty');

        const saveButton = sessionExtendModal.getByTestId('session-extend-save');
        await expect(saveButton).toBeVisible();
        await expect(saveButton).toBeEnabled();
        console.log(' - Save button visible and enabled');

        // Step 3: Fill extension form and submit
        console.log('[Step 3] Fill extension form and submit');
        await extensionHoursInput.fill('24');
        await reasonTextarea.fill('Applicant requested additional time for document verification');
        console.log(' - filled hours: 24, reason: Applicant requested additional time for document verification');

        console.log(' - intercept POST to /sessions/*/extensions');
        const [extensionResponse] = await Promise.all([
            page.waitForResponse(resp =>
                /\/sessions\/[^/]+\/extensions/.test(resp.url()) &&
                resp.request().method() === 'POST'
            ),
            saveButton.click()
        ]);

        const requestBody = JSON.parse(extensionResponse.request().postData());
        console.log(' - verify POST request payload:', requestBody);
        expect(requestBody.extension_hours).toBe('24');
        expect(requestBody.reason).toBe('Applicant requested additional time for document verification');

        console.log(' - verify POST response status:', extensionResponse.status());
        expect(extensionResponse.status()).toBe(201);

        // Step 4: Verify modal closes and time updates
        console.log('[Step 4] Verify modal closes and time updates');
        await expect(sessionExtendModal).not.toBeVisible();
        console.log(' - extension modal is no longer visible');

        await expect(sessionExtendTrigger).toBeVisible();
        console.log(' - extension trigger button remains visible');

        const updatedSessionResp = await page.request.get(
            joinUrl(app.urls.api, `sessions/${sessionId}`),
            {
                params: {
                    'fields[session]': 'expires_at,expired_at,id'
                },
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Accept': 'application/json'
                }
            }
        );
        expect(updatedSessionResp.ok()).toBeTruthy();
        const updatedSessionData = await updatedSessionResp.json();
        const updatedExpiredAt = new Date(updatedSessionData.data.expires_at);
        console.log(' - new expiry:', updatedExpiredAt.toISOString(), 'previous:', initialExpiredAt.toISOString());
        expect(updatedExpiredAt.getTime()).toBeGreaterThan(initialExpiredAt.getTime());

        // Step 5: Verify extension via API
        console.log('[Step 5] Verify extension via API');
        const sessionWithExtensionsResp = await page.request.get(
            joinUrl(app.urls.api, `sessions/${sessionId}`),
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Accept': 'application/json'
                },
                params: {
                    'fields[session]': 'extensions'
                }
            }
        );
        expect(sessionWithExtensionsResp.ok()).toBeTruthy();
        const sessionWithExtensions = await sessionWithExtensionsResp.json();

        const extensions = sessionWithExtensions.data.extensions;
        console.log(' - extensions array:', extensions);
        expect(extensions).toBeDefined();
        expect(extensions.length).toBeGreaterThanOrEqual(1);

        const latestExtension = extensions[extensions.length - 1];
        console.log(' - latest extension entry:', latestExtension);
        expect(latestExtension.extension_hours).toBe(24);
    });

    test('Validate Extension Form Errors', {
        tag: ['@regression']
    }, async ({ page }) => {
        // Setup
        console.log('[Setup] Login as admin and navigate to the session applicant report page');
        await loginForm.adminLoginAndNavigate(page, admin);

        expect(sessionId, 'Expected Test 1 to have created a sessionId').toBeTruthy();
        await page.goto(`/applicants/all/${sessionId}`);

        // Step 1: Submit with empty reason
        console.log('[Step 1] Submit with empty reason');
        const sessionExtendTrigger = page.getByTestId('session-extend-trigger');
        await expect(sessionExtendTrigger).toBeVisible();
        await sessionExtendTrigger.click();

        const sessionExtendModal = page.getByTestId('session-extend-modal');
        await expect(sessionExtendModal).toBeVisible();

        const extensionHoursInput = sessionExtendModal.getByTestId('extension-hours');
        await expect(extensionHoursInput).toBeVisible();
        await expect(extensionHoursInput).toHaveValue('1');

        const reasonTextarea = sessionExtendModal.locator('textarea');
        await expect(reasonTextarea).toBeVisible();
        await expect(reasonTextarea).toHaveValue('');

        const saveButton = sessionExtendModal.getByTestId('session-extend-save');
        await expect(saveButton).toBeVisible();
        await expect(saveButton).toBeEnabled();

        await saveButton.click();
        await expect(sessionExtendModal).toBeVisible();

        const reasonError = sessionExtendModal.getByTestId('reason-error');
        await expect(reasonError).toBeVisible();
        await expect(reasonError).toHaveText(/reason .+ required/i);

        // Step 2: Submit with invalid hours
        console.log('[Step 2] Submit with invalid hours');
        await extensionHoursInput.fill('0');
        await reasonTextarea.fill('Test reason');

        await saveButton.click();
        await expect(sessionExtendModal).toBeVisible();


        // Step 3: Close modal
        console.log('[Step 3] Close modal');
        const cancelButton = sessionExtendModal.getByRole('button', { name: /cancel/i });
        await expect(cancelButton).toBeVisible();
        await cancelButton.click();
        await expect(sessionExtendModal).not.toBeVisible();
    });
});
