import { expect, test } from '@playwright/test';
import loginForm from '~/tests/utils/login-form';
import { admin } from '~/tests/test_config';

test.describe('QA-352 inbox_refresh_repeated_load_test_endpoints.spec', () => {

    const RELOAD_COUNT = 20;

    test('should load inbox refresh endpoints repeatedly without errors',
        {
            tag: ['@regression', '@core', '@staging-ready', '@rc-ready']
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
                const reloadIndex = i + 1;
                console.log(`🔄 Reloading page ${reloadIndex} of ${RELOAD_COUNT}`);
                const responseListener = async (response) => {
                    if (response.status() >= 400) {
                        const url = response.url();
                        const status = response.status();
                        const method = response.request().method();
                        let responseBody = null;
                        try {
                            const text = await response.text();
                            responseBody = text ? JSON.parse(text) : null;
                        } catch {
                            // non-JSON or empty body
                        }
                        const detail = responseBody?.error?.title
                            || responseBody?.error?.detail
                            || responseBody?.message
                            || (typeof responseBody?.error === 'string' ? responseBody.error : null);
                        errors.push({ url, status, method, responseBody, detail, reloadIndex });
                        console.log(`❌ [Reload ${reloadIndex}/${RELOAD_COUNT}] ${method} ${url} → ${status} ${detail || ''}`);
                    }
                };
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

            if (errors.length > 0) {
                const reloadsWithErrors = [...new Set(errors.map(e => e.reloadIndex))].sort((a, b) => a - b);
                const toReadableUrl = (urlStr) => {
                    try {
                        const u = new URL(urlStr);
                        const search = u.search ? decodeURIComponent(u.search) : '';
                        const full = u.pathname + search;
                        return full.length > 120 ? full.slice(0, 117) + '...' : full;
                    } catch {
                        return urlStr;
                    }
                };
                const statusSummary = [...new Set(errors.map(e => e.status))].join(', ');
                const message = [
                    '',
                    `--- ${errors.length} request(s) failed during ${RELOAD_COUNT} reloads ---`,
                    `  Reloads with failures: ${reloadsWithErrors.join(', ')} (of 1..${RELOAD_COUNT})`,
                    `  Status codes: ${statusSummary}`,
                    '',
                    'Failures (reload #, method, endpoint, status):',
                    ...errors.map((e, idx) => {
                        const detail = e.detail ? ` — ${e.detail}` : '';
                        const url = toReadableUrl(e.url);
                        return `  ${idx + 1}. [Reload ${e.reloadIndex}/${RELOAD_COUNT}] ${e.method} ${url} → ${e.status}${detail}`;
                    }),
                    ''
                ].join('\n');
                expect(errors, message).toHaveLength(0);
            }
            console.log('✅ No errors encountered during repeated loads');
        });

})