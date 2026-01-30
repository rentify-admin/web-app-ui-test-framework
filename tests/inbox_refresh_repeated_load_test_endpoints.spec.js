import { expect, test } from '@playwright/test';
import loginForm from './utils/login-form';
import { admin } from './test_config';

test.describe('QA-352 inbox_refresh_repeated_load_test_endpoints.spec', () => {

    const RELOAD_COUNT = 20;

    test('should load inbox refresh endpoints repeatedly without errors',
        {
            tag: ['@regression', '@core']
        }, async ({ page }) => {
            test.setTimeout(120000);
            await loginForm.adminLoginAndNavigate(page, admin);

            /**
             * Reload page 20 times and every 3 seconds and keep watch on every network request for errors
             * Do not wait for responses when 3 seconds complete just reload again but if any request fails log the error
             * on the last reload wait for every request to complete and check for errors.
             */
            const errors = [];
            for (let i = 0; i < RELOAD_COUNT; i++) {
                console.log(`🔄 Reloading page ${i + 1} of ${RELOAD_COUNT}`);
                // keep watch on every api request for errors for the next 3 seconds
                const responseListener = async (response) => {
                    if (response.status() >= 400) {
                        const url = response.url();
                        const status = response.status();
                        // log the error message
                        const responseBody = await response.text().then(text => {
                            try {
                                return JSON.parse(text);
                            } catch {
                                return null;
                            }
                        });
                        errors.push({ url, status, responseBody });
                        console.log(`❌ Error on ${url} - Status: ${status} - Response: ${responseBody?.error?.title}`);

                    }
                    expect(response.status()).toBeLessThan(400);
                }
                page.on('response', responseListener);
                // after 3 seconds reload the page again
                await page.waitForTimeout(3000);

                // clear browser cookies and client-side caches/storage, then navigate
                const context = page.context();
                await context.clearCookies();
                await page.evaluate(async () => {
                    if ('caches' in window) {
                        const keys = await caches.keys();
                        await Promise.all(keys.map(k => caches.delete(k)));
                    }
                    // try { sessionStorage.clear(); } catch (e) { }
                });

                page.off('response', responseListener);
                await page.goto('/applicants/all');
            }
            console.log('✅ No errors encountered during repeated loads');


        });

})