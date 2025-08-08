import { expect } from '@playwright/test';
import loginForm from './login-form';

/**
 * Login helper function
 * @param {import('@playwright/test').Page} page
 * @param {Object} data - Login credentials
 */
const loginWith = async (page, data) => {

    // Step 1: Admin Login and Navigate
    await loginForm.fill(page, data);
    await loginForm.submit(page);
    await expect(page).toHaveTitle(/Applicants/, { timeout: 10_000 });
    await expect(page.getByTestId('household-status-alert')).toBeVisible();
};

/**
 * Complete admin login and navigation to applications
 * @param {import('@playwright/test').Page} page
 * @param {Object} data - Login credentials
 */
const adminLoginAndNavigateToApplications = async (page, data) => {
    await page.goto('/');
    await loginWith(page, data);
    await page.getByTestId('applications-menu').click();
    await page.getByTestId('applications-submenu').click();
};

/**
 * Scroll down a locator element
 * @param {import('@playwright/test').Locator} locator
 */
const scrollDown = async locator => {
    await locator.evaluate(element => element.scrollTop = element.scrollHeight);
};

/**
 * Scroll to the required session card locator
 * @param {import('@playwright/test').Page} page
 * @param {String} selector
 * @returns {Promise<import('@playwright/test').Locator>}
 */
const findSessionLocator = async (page, selector) => {
    console.log(`🚀 Finding selector: ${selector}`);
    await page.locator('#container').first()
        .evaluate(element => element.scrollTop = 150);

    const targetElement = await page.locator(selector);
    let found = false;
    const maxScrolls = 10; // Set a limit to prevent infinite loops in case element is never found
    let scrollCount = 0;

    while (!found && maxScrolls > scrollCount) {
        if (await targetElement.isVisible()) {
            found = true;
            return targetElement;
        }
        await scrollDown(await page.getByTestId('side-panel'));
        scrollCount++;
        await page.waitForTimeout(2000);
    }
};

export {
    loginWith,
    adminLoginAndNavigateToApplications,
    scrollDown,
    findSessionLocator
};
