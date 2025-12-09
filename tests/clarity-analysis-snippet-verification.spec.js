import { test, expect } from '@playwright/test';
import { ApiClient } from './api';
import { app, admin } from './test_config';
import { loginWithAdmin } from './endpoint-utils/auth-helper';
import { getApplicationByName } from './endpoint-utils/application-helper';
import { createSession } from './endpoint-utils/session-helpers';
import { loginWith } from './utils/session-utils';

test.describe('QA-251 clarity-analysis-snippet-verification.spec', () => {
    let adminClient;
    let createdSession;

    const APPLICATION_NAME = 'Autotest - Simulator Financial Step';

    const user = {
        first_name: 'Autotest',
        last_name: 'User',
        email: "autotest+user@verifast.com"
    }

    test.beforeAll(async () => {
        console.log('🛠️  [Setup] Creating API client and logging in as admin...');
        adminClient = new ApiClient(app.urls.api, null, 20000);

        await loginWithAdmin(adminClient);
        console.log('🔑  [Setup] Admin logged in successfully.');

        console.log(`🔎  [Setup] Fetching application by name "${APPLICATION_NAME}"...`);
        const application = await getApplicationByName(adminClient, APPLICATION_NAME);
        console.log('✅  [Setup] Application found:', application.name);

        console.log('🚀  [Setup] Creating new session for test user...');
        const session = await createSession(adminClient, user, application.id);
        expect(session).toBeDefined();
        createdSession = session;
        console.log('✅  [Setup] Test session created:', createdSession.id);
    });

    test('Guest Login: Clarity Analytics Snippet Verification', async ({ page }) => {
        console.log('\n👤 [Guest] Starting Clarity Analytics snippet verification as Guest User...');
        await page.route('**/clarity.ms/tag/**', route => {
            console.log('📡 [Guest] Intercepted Clarity request (will continue)...');
            route.continue();
        });

        let clarityRequestUrl = null;
        page.on('request', request => {
            const url = request.url();
            if (url.includes('clarity.ms/tag/')) {
                clarityRequestUrl = url;
                console.log('📥 [Guest] Clarity script requested:', clarityRequestUrl);
            }
        });

        console.log('🌐 [Guest] Navigating to guest session URL...');
        await page.goto(createdSession.url);

        // Wait for any clarity request to be made, up to 10s
        console.log('⏳ [Guest] Waiting for clarity.ms/tag/ request...');
        await page.waitForFunction(() => {
            return [...window.performance.getEntriesByType('resource')].some(e => e.name.includes('clarity.ms/tag/'));
        }, null, { timeout: 10000 });

        // Wait a moment to catch the request event
        await page.waitForTimeout(500);

        console.log('🔍 [Guest] Asserting Clarity snippet was requested...');
        expect(clarityRequestUrl, 'Clarity snippet was requested').not.toBeNull();
        expect(clarityRequestUrl).toContain('u8om93frlg');
        console.log('✅ [Guest] Clarity snippet fetched (correct key)!');

        console.log('🔬 [Guest] Checking if "window.clarity" is defined as a function...');
        const isClarityFn = await page.evaluate(() => typeof window.clarity === 'function');
        expect(isClarityFn).toBe(true);
        console.log('✅ [Guest] Clarity function is available on window!');

        await page.close();
        console.log('🧹 [Guest] Test completed and page closed.');
    });

    test('Admin Login: Clarity Analytics Snippet Verification', async ({ page }) => {
        console.log('\n👩‍💼 [Admin] Starting Clarity Analytics snippet verification as Admin User...');
        console.log('🌐 [Admin] Navigating to root page...');
        await page.goto('/');

        await page.route('**/clarity.ms/tag/**', route => {
            console.log('📡 [Admin] Intercepted Clarity request (will continue)...');
            route.continue();
        });

        let clarityRequestUrl = null;
        page.on('request', request => {
            const url = request.url();
            if (url.includes('clarity.ms/tag/')) {
                clarityRequestUrl = url;
                console.log('📥 [Admin] Clarity script requested:', clarityRequestUrl);
            }
        });

        console.log('🔑 [Admin] Logging in as admin user...');
        await loginWith(page, admin);

        console.log('🔁 [Admin] Reloading page to trigger clarity...');
        await page.reload();

        console.log('⏳ [Admin] Waiting for clarity.ms/tag/ request...');
        await page.waitForFunction(() => {
            return [...window.performance.getEntriesByType('resource')].some(e => e.name.includes('clarity.ms/tag/'));
        }, null, { timeout: 10000 });

        // Wait a moment to catch the request event
        await page.waitForTimeout(500);

        console.log('🔍 [Admin] Asserting Clarity snippet was requested...');
        expect(clarityRequestUrl, 'Clarity snippet was requested').not.toBeNull();
        expect(clarityRequestUrl).toContain('twv6m57aac');
        console.log('✅ [Admin] Clarity snippet fetched (correct key)!');

        console.log('🔬 [Admin] Checking if "window.clarity" is defined as a function...');
        const isClarityFn = await page.evaluate(() => typeof window.clarity === 'function');
        expect(isClarityFn).toBe(true);
        console.log('✅ [Admin] Clarity function is available on window!');

        await page.close();
        console.log('🧹 [Admin] Test completed and page closed.');
    });

    test.afterAll(async () => {
        try {
            console.log('🧹 [Cleanup] Deleting test session...');
            if (createdSession) {
                await adminClient.delete(`/sessions/${createdSession.id}`);
                console.log(`✅ [Cleanup] Deleted session ID: ${createdSession.id}`);
            }
        } catch (error) {
            console.error('❌ [Cleanup] Unable to clean session');
            throw error;
        }
    });
});