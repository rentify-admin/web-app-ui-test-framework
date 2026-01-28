import config from '~/tests/test_config';
import { joinUrl } from '~/tests/utils/helper.js';
import { expect } from '@playwright/test';

const LOGIN_API = joinUrl(config.app.urls.api, 'auth');

const fill = async (page, formData) => {
    // Wait for page to be ready
    await page.waitForLoadState('domcontentloaded');
    
    // Fill email field - Playwright's fill() already waits for element to be visible/actionable
    await page.getByRole('textbox', { name: /email/i }).fill(formData.email, { timeout: 30000 });

    // Fill password field - Playwright's fill() already waits for element to be visible/actionable
    await page.getByRole('textbox', { name: /password/i }).fill(formData.password, { timeout: 30000 });

};


const submit = async page => {
    // Clicking login button to login
    await page.locator('button[type="submit"]').click();
    // Waiting for the login api response
    await page.waitForResponse(LOGIN_API);
    // Wait for page structure to be ready
    await expect(page.getByTestId('side-panel')).toBeVisible({ timeout: 30_000 });
    // Wait for sessions to finish loading (skeleton disappears or content appears)
    await page.waitForFunction(() => {
        const sidePanel = document.querySelector('[data-testid="side-panel"]');
        if (!sidePanel) return false;
        // Check if skeleton loader ul exists (shows when isLoading && !chunkIsLoading)
        const skeletonUl = sidePanel.querySelector('ul.px-4');
        // Sessions are loaded when: skeleton is gone OR date-collapse exists OR empty state exists
        const hasDateCollapse = sidePanel.querySelector('date-collapse, [class*="date-collapse"]');
        const hasEmptyState = sidePanel.parentElement?.querySelector('[class*="no_applicants"]');
        return !skeletonUl || hasDateCollapse || hasEmptyState;
    }, { timeout: 30_000 });
};

/**
 * Submit login and set locale to English
 * Enhanced version of submit() that also captures auth response and sets locale
 * @param {import('@playwright/test').Page} page
 * @param {Object} options - Configuration options
 * @param {boolean} [options.waitForHousehold] - Whether to wait for household (default: true)
 * @param {boolean} [options.skipSidePanel] - If true, wait for banner instead of side-panel (backward compatibility)
 * @param {import('@playwright/test').Locator|string} [options.waitForLocator] - Custom locator to wait for after login. Can be a Playwright Locator or a testId string (e.g., 'applicants-menu')
 */
const submitAndSetLocale = async (page, options = {}) => {
    const defaultOptions = {
        waitForHousehold: true,
        skipSidePanel: false,
        waitForLocator: null,
        ...options
    };

    // Determine which locator to wait for
    let successLocator;
    if (defaultOptions.waitForLocator) {
        // If a locator is provided, use it directly (if it's already a Locator) or create one from testId string
        if (typeof defaultOptions.waitForLocator === 'string') {
            successLocator = page.getByTestId(defaultOptions.waitForLocator);
        } else {
            successLocator = defaultOptions.waitForLocator;
        }
    } else if (defaultOptions.skipSidePanel) {
        // Backward compatibility: skipSidePanel uses banner
        successLocator = page.getByRole('banner');
    } else {
        // Default: wait for side-panel
        successLocator = page.getByTestId('side-panel');
    }

    // Determine if we should wait for side-panel sessions to load (only if waiting for side-panel)
    const shouldWaitForSessions = !defaultOptions.skipSidePanel && !defaultOptions.waitForLocator;

    // Wait for both auth response and users/self response during submit
    const [authResponse, selfResponse] = await Promise.all([
        page.waitForResponse(LOGIN_API),
        page.waitForResponse(resp => resp.url().includes('/users/self') && resp.request().method() === 'GET'),
        (async () => {
            await page.locator('button[type="submit"]').click();
            // Wait for the specified locator to be visible
            await expect(successLocator).toBeVisible({ timeout: 30_000 });
            
            // Only wait for sessions loading if we're waiting for side-panel
            if (shouldWaitForSessions) {
                // Wait for sessions to finish loading (skeleton disappears or content appears)
                await page.waitForFunction(() => {
                    const sidePanel = document.querySelector('[data-testid="side-panel"]');
                    if (!sidePanel) return false;
                    // Check if skeleton loader ul exists (shows when isLoading && !chunkIsLoading)
                    const skeletonUl = sidePanel.querySelector('ul.px-4');
                    // Sessions are loaded when: skeleton is gone OR date-collapse exists OR empty state exists
                    const hasDateCollapse = sidePanel.querySelector('date-collapse, [class*="date-collapse"]');
                    const hasEmptyState = sidePanel.parentElement?.querySelector('[class*="no_applicants"]');
                    return !skeletonUl || hasDateCollapse || hasEmptyState;
                }, { timeout: 30_000 });
            }
        })()
    ]);
    
    // Set locale to English for the logged-in user
    try {
        const authData = await authResponse.json();
        const authToken = authData?.data?.token;
        
        const selfData = await selfResponse.json();
        const userId = selfData?.data?.id;
        
        if (userId && authToken) {
            console.log('🔑 Auth token retrieved from /auth response, updating locale...');
            
            const localeResponse = await page.request.patch(`${config.app.urls.api}/users/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json, text/plain, */*'
                },
                data: JSON.stringify({ locale: 'en' })
            });
            
            if (!localeResponse.ok()) {
                const responseText = await localeResponse.text();
                console.log(`⚠️ Failed to set locale. Status: ${localeResponse.status()}, Response: ${responseText}`);
            } else {
                console.log('✅ Locale set to English successfully');
            }
        } else {
            console.log('⚠️ Missing userId or authToken');
        }
    } catch (error) {
        console.log('⚠️ Failed to set locale to English:', error.message);
    }
};

/**
 * Complete admin login and navigation to applications page
 * Also sets user locale to English
 * @param {import('@playwright/test').Page} page
 * @param {Object} adminCredentials
 * @returns {Promise<string>} Admin authentication token for API calls
 */
const adminLoginAndNavigate = async (page, adminCredentials) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await fill(page, adminCredentials);
    
    // Wait for both auth response and users/self response
    const [authResponse, selfResponse] = await Promise.all([
        page.waitForResponse(LOGIN_API),
        page.waitForResponse(resp => resp.url().includes('/users/self') && resp.request().method() === 'GET'),
        submit(page)
    ]);
    
    await expect(page).toHaveTitle(/Applicants/, { timeout: 10_000 });
    
    // Get token from auth response
    const authData = await authResponse.json();
    const authToken = authData?.data?.token;
    
    // Set locale to English for the logged-in user
    try {
        // Get user ID from self response
        const selfData = await selfResponse.json();
        const userId = selfData?.data?.id;
        
        if (userId && authToken) {
            console.log('🔑 Auth token retrieved from /auth response, updating locale...');
            
            // Update user locale to English
            const localeResponse = await page.request.patch(`${config.app.urls.api}/users/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json, text/plain, */*'
                },
                data: JSON.stringify({ locale: 'en' })
            });
            
            if (!localeResponse.ok()) {
                const responseText = await localeResponse.text();
                console.log(`⚠️ Failed to set locale. Status: ${localeResponse.status()}, Response: ${responseText}`);
            } else {
                console.log('✅ Locale set to English successfully');
            }
        } else {
            console.log('⚠️ Missing userId or authToken');
        }
    } catch (error) {
        console.log('⚠️ Failed to set locale to English:', error.message);
        // Don't fail the test if locale update fails
    }
    
    // Return admin token for API calls
    return authToken;
};

export default {
    fill,
    submit,
    submitAndSetLocale,
    adminLoginAndNavigate
};
