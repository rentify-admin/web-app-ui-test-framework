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

    const apiPredicate = (resp) =>
        resp.url().startsWith(apiEndpoint) && resp.request().method() === 'GET' && resp.ok();

    const action = isActive ? page.reload() : subMenuLocator.click();

    const [response] = await Promise.all([
        page.waitForResponse(apiPredicate),
        action
    ]);

    return waitForJsonResponse(response);
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
}