import config from '~/tests/test_config';
import { joinUrl } from '~/tests/utils/helper.js';
import { gotoApplicationsPage } from './applications-page';
import { expect } from '@playwright/test';

const LOGIN_API = joinUrl(config.app.urls.api, 'auth');

const fill = async (page, formData) => {

    // Filling email field
    await page.getByLabel('email', { name: /Email Address/ }).fill(formData.email);

    // Filling password field
    await page.getByLabel('password', { name: /Password/ }).fill(formData.password);

};


const submit = async page => {
    // Clicking login button to login
    await page.locator('button[type="submit"]').click();
    // Waiting for the login api response
    await page.waitForResponse(LOGIN_API);
    await page.waitForSelector('[data-testid=household-status-alert]', { timeout: 100_000 });
    await expect(page.getByTestId('household-status-alert')).toBeVisible({ timeout: 100_000 });
};

/**
 * Complete admin login and navigation to applications page
 * @param {import('@playwright/test').Page} page
 * @param {Object} adminCredentials
 */
const adminLoginAndNavigate = async (page, adminCredentials) => {
    await page.goto('/');
    await fill(page, adminCredentials);
    await submit(page);
    await expect(page).toHaveTitle(/Applicants/, { timeout: 10_000 });
    await expect(page.getByTestId('household-status-alert')).toBeVisible({ timeout: 100_000 }); //Wait for all page loaded
};

export default {
    fill,
    submit,
    adminLoginAndNavigate
};
