import { expect } from '@playwright/test';
import { joinUrl } from './helper';
import { waitForJsonResponse } from './wait-response';
import { app } from '../test_config';

/**
 * Navigate to a sub-menu, wait for the corresponding API response,
 * and return the response data.
 * 
 * @param {import('@playwright/test').Page} page - The Playwright page object.
 * @param {import('@playwright/test').Locator} subMenuLocator - The Locator for the sub-menu item (e.g., 'users-submenu').
 * @param {string} apiUrl - The partial API endpoint (e.g., '/users').
 * @param {boolean} isActive - A boolean indicating if the sub-menu is already active.
 * @returns {Promise<any>} The JSON data from the API response.
 */
async function navigateToSubMenu(page, subMenuLocator, apiUrl, isActive) {
    const apiEndpoint = joinUrl(app.urls.api, apiUrl);

    const watcher = createApiIdleWatcher(page, app.urls.api);
    await watcher.waitForIdle();

    const action = isActive ? page.reload() : subMenuLocator.click();

    const [request] = await Promise.all([
        page.waitForRequest(req => req.url().startsWith(apiEndpoint) && req.method() === 'GET'),
        action
    ]);

    const response = await request.response();
    watcher.dispose();

    if (!response || !response.ok()) {
        throw new Error(`Failed to load ${apiEndpoint}`);
    }

    return waitForJsonResponse(response);
}

/**
 * Simple API idle watcher to avoid capturing prefetch responses.
 */
function createApiIdleWatcher(page, apiOrigin) {
    let inFlight = 0;
    const onReq = (r) => { if (r.url().startsWith(apiOrigin)) inFlight++; };
    const onDone = (r) => { if (r.url().startsWith(apiOrigin)) inFlight = Math.max(0, inFlight - 1); };

    page.on('request', onReq);
    page.on('requestfinished', onDone);
    page.on('requestfailed', onDone);

    return {
        async waitForIdle(idleMs = 300, timeout = 10000) {
            const start = Date.now();
            while (Date.now() - start < timeout) {
                if (inFlight === 0) {
                    await page.waitForTimeout(idleMs);
                    if (inFlight === 0) return;
                }
                await page.waitForTimeout(50);
            }
            throw new Error('API not idle');
        },
        dispose() {
            page.off('request', onReq);
            page.off('requestfinished', onDone);
            page.off('requestfailed', onDone);
        }
    };
}

/**
 * Retrieves a nested property value from an object using a dot-notation string.
 * 
 * @param {object} obj - The object to retrieve the value from.
 * @param {string} path - The dot-notation path (e.g., 'user.address.zip').
 * @returns {any} The value of the property, or null/undefined if not found.
 */
function getDeepValue(obj, path) {
    const keys = path.split('.');

    // Use Array.prototype.reduce to traverse the object
    return keys.reduce((current, key) => {
        // If the current value is null or undefined, stop traversing
        return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
}

/**
 * Verify the content of a list table against API data.
 * 
 * @param {import('@playwright/test').Page} page - The Playwright page object.
 * @param {Array<any>} apiData - The data array from the API response.
 * @param {string} fieldName - The field path to check (e.g., 'email' or 'provider.name').
 * @param {string} logMessage - The message to log on success.
 */
async function verifyListContent(page, apiData, fieldName, logMessage) {
    if (apiData.length > 0) {
        const rows = page.locator('table[data-testid]').locator('tbody>tr');

        for (let index = 0; index < apiData.length; index++) {
            const row = rows.nth(index);

            const expectedText = getDeepValue(apiData[index], fieldName);
            
            if (expectedText) {
                await expect(row).toContainText(String(expectedText),{
                    timeout: 10_000
                });
            } else {
                console.warn(`⚠️ ~ Data not found for field '${fieldName}' at index ${index}. Skipping assertion for this row.`);
            }
        }
        console.log(`🚀 ~ ${logMessage} checked`);
    } else {
        console.log(`⚠️ ~ No data found to verify for ${logMessage}`);
    }
}


export {
    getDeepValue,
    navigateToSubMenu,
    verifyListContent,
    createApiIdleWatcher,
}