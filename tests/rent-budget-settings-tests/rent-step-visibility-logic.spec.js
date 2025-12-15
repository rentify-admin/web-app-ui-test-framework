import { expect, request, test } from '@playwright/test';
import { ApiClient } from '../api';
import { app } from '../test_config';
import { loginWithAdmin } from '../endpoint-utils/auth-helper';
import { getRandomEmail } from '../utils/helper';
import { createSession } from '../endpoint-utils/session-helpers';
import { waitForJsonResponse } from '../utils/wait-response';
import { getApplicationByName } from '../endpoint-utils/application-helper';
import { handleOptionalStateModal, handleOptionalTermsCheckbox } from '../utils/session-flow';
import { cleanupSession } from '../utils/cleanup-helper';

test.describe('QA-261 rent-step-visibility-logic.spec.js', () => {


    const testResults = {
        test1: { passed: false, sessionId: null },
        test2: { passed: false, sessionId: null },
        test3: { passed: false, sessionId: null }
    };

    test('Verify Rent step hidden when enabled=false', async ({ page }) => {

        const APPLICATION_NAME = 'Autotest - Rent Disabled';
        const adminClient = new ApiClient(app.urls.api, null, 120000);
        await loginWithAdmin(adminClient);

        const application = (await getApplicationByName(adminClient, APPLICATION_NAME));

        const targetEnabled = application.settings.find(sett => sett.key === 'settings.applications.target.enabled')
        if (targetEnabled) {
            await adminClient.patch(`/applications/${application.id}`, {
                settings: {
                    'settings.applications.target.enabled': false
                }
            })
        }

        const user = {
            first_name: 'Autotest',
            last_name: 'RentDisabled',
            email: getRandomEmail(),
            invite: true
        }

        console.log('🆕 [Step 3] Creating a user session...');
        let session = await createSession(adminClient, user, application.id);

        testResults.sessionId = session;

        const sessionPromise = page.waitForResponse(resp => resp.url().includes(`/sessions/${session.id}`)
            && resp.request().method() === "GET"
            && resp.ok()
        )
        await page.goto(session.url)

        const sessionResponse = await sessionPromise;

        const { data: newSession } = await waitForJsonResponse(sessionResponse)

        await handleOptionalStateModal(page);
        await handleOptionalTermsCheckbox(page);
        session = newSession
        expect(session.target).toBe(null)

        await page.waitForTimeout(2000);

        await expect(page.getByTestId('rent-budget-step')).not.toBeVisible({ timeout: 10_000 })

        testResults.test1.passed = true;
    })

    test('Verify Rent step auto-skip when locked=true + default set', async ({ page }) => {

        const APPLICATION_NAME = 'Autotest - Rent Locked';
        const adminClient = new ApiClient(app.urls.api, null, 120000);
        await loginWithAdmin(adminClient);

        const application = (await getApplicationByName(adminClient, APPLICATION_NAME));

        const user = {
            first_name: 'Autotest',
            last_name: 'RentDefault',
            email: getRandomEmail(),
            invite: true
        }

        console.log('🆕 [Step 3] Creating a user session...');
        let session = await createSession(adminClient, user, application.id);

        testResults.sessionId = session;

        const sessionPromise = page.waitForResponse(resp => resp.url().includes(`/sessions/${session.id}`)
            && resp.request().method() === "GET"
            && resp.ok()
        )
        await page.goto(session.url)

        const sessionResponse = await sessionPromise;

        const { data: newSession } = await waitForJsonResponse(sessionResponse)

        await handleOptionalStateModal(page);
        await handleOptionalTermsCheckbox(page);
        session = newSession
        expect(session.target).toBe(150000)

        await page.waitForTimeout(2000);

        await expect(page.getByTestId('rent-budget-step')).not.toBeVisible({ timeout: 10_000 })

        testResults.test2.passed = true;
    })

    test('Verify Rent step visible when enabled=true + locked=false', async ({ page }) => {

        const APPLICATION_NAME = 'Autotest - Rent Standard';
        const adminClient = new ApiClient(app.urls.api, null, 120000);
        await loginWithAdmin(adminClient);

        const application = (await getApplicationByName(adminClient, APPLICATION_NAME));

        const user = {
            first_name: 'Autotest',
            last_name: 'RentStandard',
            email: getRandomEmail(),
            invite: true
        }

        console.log('🆕 [Step 3] Creating a user session...');
        let session = await createSession(adminClient, user, application.id);

        testResults.sessionId = session;

        const sessionPromise = page.waitForResponse(resp => resp.url().includes(`/sessions/${session.id}`)
            && resp.request().method() === "GET"
            && resp.ok()
        )
        await page.goto(session.url)

        const sessionResponse = await sessionPromise;

        const { data: newSession } = await waitForJsonResponse(sessionResponse)

        await handleOptionalStateModal(page);
        await handleOptionalTermsCheckbox(page);
        session = newSession
        expect(session.target).toBe(null)

        await page.waitForTimeout(2000);

        await expect(page.getByTestId('rent-budget-step')).toBeVisible({ timeout: 10_000 })
        await expect(page.getByTestId('rent-budget-step-continue')).toBeVisible({ timeout: 10_000 })

        testResults.test3.passed = true;
    })


    test.afterAll(async ({ request }) => {
        // Cleanup: Delete session if test was marked as passed
        console.log(`[CleanUp] Started`)
        const results = Object.entries(testResults)
        for (let index = 0; index < results.length; index++) {
            const [key, element] = results[index];
            if (element.passed && element.sessionId) {
                try {
                    console.log(`[Cleanup] Attempting to clean up session for test '${key}' (sessionId: ${element.sessionId})`);
                    await cleanupSession(request, element.sessionId);
                    console.log(`[Cleanup] Successfully cleaned up session for test '${key}'`);
                } catch (error) {
                    console.error(`[Cleanup] Failed to clean up session for test '${key}' (sessionId: ${element.sessionId}): ${error}`);
                }
            }
        }
    })

})