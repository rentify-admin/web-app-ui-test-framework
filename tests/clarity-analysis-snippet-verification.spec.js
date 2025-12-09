import { test, expect } from '@playwright/test';
import { ApiClient } from './api';
import { app, admin } from './test_config';
import { generateUUID } from './utils/helper';
import { loginWithAdmin } from './endpoint-utils/auth-helper';
import { getApplicationByName } from './endpoint-utils/application-helper';
import { createSession } from './endpoint-utils/session-helpers';
import { cleanupSession } from './utils/cleanup-helper';
import { loginWith } from './utils/session-utils';

test.describe('QA-251 clarity-analysis-snippet-verification.spec', () => {

    let adminClient;
    const helpers = {};
    let createdSession;

    const APPLICATION_NAME = 'Autotest - Simulator Financial Step';

    const user = {
        first_name: 'Autotest',
        last_name: 'User',
        email: "autotest+user@verifast.com"
    }

    test.beforeAll(async () => {
        // 1. Create API client and login with admin credentials
        adminClient = new ApiClient(app.urls.api, null, 20000);

        await loginWithAdmin(adminClient);

        const application = await getApplicationByName(adminClient, APPLICATION_NAME);
        const session = await createSession(adminClient, user, application.id);
        expect(session).toBeDefined()
        createdSession = session
    });

    test('Guest Login: Clarity Analytics Snippet Verification', async ({ page }) => {

        await page.route('**/clarity.ms/tag/**', route => route.continue());
        let clarityRequestUrl = null;
        page.on('request', request => {
            const url = request.url();
            if (url.includes('clarity.ms/tag/')) {
                clarityRequestUrl = url;
            }
        });

        await page.goto(createdSession.url);

        // Wait for any clarity request to be made, up to 10s
        await page.waitForFunction(() => {
            return [...window.performance.getEntriesByType('resource')].some(e => e.name.includes('clarity.ms/tag/'));
        }, null, { timeout: 10000 });


        // Wait a moment to catch the request event
        await page.waitForTimeout(500);

        expect(clarityRequestUrl, 'Clarity snippet was requested').not.toBeNull();
        expect(clarityRequestUrl).toContain('u8om93frlg');

        const isClarityFn = await page.evaluate(() => typeof window.clarity === 'function');
        expect(isClarityFn).toBe(true);
        await page.close()
    });

    test('Admin Login: Clarity Analytics Snippet Verification', async ({ page }) => {
        await page.goto('/')

        await page.route('**/clarity.ms/tag/**', route => route.continue());
        let clarityRequestUrl = null;
        page.on('request', request => {
            const url = request.url();
            if (url.includes('clarity.ms/tag/')) {
                clarityRequestUrl = url;
            }
        });

        await loginWith(page, admin);

        await page.reload();

        await page.waitForFunction(() => {
            return [...window.performance.getEntriesByType('resource')].some(e => e.name.includes('clarity.ms/tag/'));
        }, null, { timeout: 10000 });


        // Wait a moment to catch the request event
        await page.waitForTimeout(500);

        expect(clarityRequestUrl, 'Clarity snippet was requested').not.toBeNull();
        expect(clarityRequestUrl).toContain('twv6m57aac');

        const isClarityFn = await page.evaluate(() => typeof window.clarity === 'function');
        expect(isClarityFn).toBe(true);
        await page.close()

    })

    test.afterAll(async () => {
        try {
            if (createdSession) {
                await adminClient.delete(`/sessions/${createdSession.id}`);
            }
        } catch (error) {
            throw new Error(`Failed to delete session after test: ${error.message}`);
        }
    })
});