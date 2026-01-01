import { expect } from '@playwright/test';
import { joinUrl } from '~/tests/utils/helper';
import { app } from '~/tests/test_config';
import { waitForJsonResponse } from '~/tests/utils/wait-response';
import { addPrefix, addEmailSuffix } from '~/tests/utils/naming-helper';

const API_URL = app.urls.api;

/**
 * Fill the generate session form with user data
 * @param {import('@playwright/test').Page} page
 * @param {Object} [userData] - Optional user data object
 * @param {string} [userData.first_name='Test'] - First name
 * @param {string} [userData.last_name='User'] - Last name
 * @param {string} [userData.email='test@example.com'] - Email address
 */
const fill = async (page, userData = {}, options = {}) => {
    const defaultOptions = {
        prefix: true,
        ...options
    }
    // Use default values if userData is not provided or specific fields are missing
    const defaultUserData = {
        first_name: 'Test',
        last_name: 'User',
        email: 'test@verifast.com',
        ...userData // Override defaults with provided values
    };

    // Auto-prefix first name with 'AutoT - ' (idempotent - won't double-prefix)
    const prefixedFirstName = defaultOptions.noPrefix ? addPrefix(defaultUserData.first_name) : defaultUserData.first_name;
    // Auto-suffix email with '+autotest' (since app uses email to determine guest name)
    const modifiedEmail = addEmailSuffix(defaultUserData.email);

    console.log(`🏷️  Naming Helper:`);
    console.log(`   First Name: '${defaultUserData.first_name}' → '${prefixedFirstName}'`);
    console.log(`   Email: '${defaultUserData.email}' → '${modifiedEmail}'`);

    await page.locator('#first_name').fill(prefixedFirstName);
    await page.locator('#last_name').fill(defaultUserData.last_name);
    await page.locator('#email_address').fill(modifiedEmail);

    // Note: No password field in this form
};

const submit = async page => {
    const [sessionResponse] = await Promise.all([
        page.waitForResponse(
            resp => resp.url().includes('/sessions')
                && resp.request().method() === 'POST'
                && resp.ok()
        ),
        page.getByTestId('submit-generate-session').click()
    ]);

    const sessionData = await waitForJsonResponse(sessionResponse);
    return sessionData;
};

/**
 * Generate session and extract session data and invite link
 * @param {import('@playwright/test').Page} page
 * @param {Object} [userData] - Optional user data, will use defaults if not provided
 * @returns {Object} { sessionData, sessionId, sessionUrl, link }
 */
const generateSessionAndExtractLink = async (page, userData = {}, options = {}) => {
    const generateForm = await page.locator('#generate-session-form');
    await expect(generateForm).toBeVisible();

    await fill(page, userData, options);
    const sessionData = await submit(page);

    const linkSection = page.getByTestId('session-invite-link');
    await expect(linkSection).toBeVisible();

    const link = await linkSection.getAttribute('href');
    const sessionId = sessionData.data?.id;
    const sessionUrl = joinUrl(API_URL, `sessions/${sessionId}`);
    await page.getByTestId('generate-session-modal-cancel').click();
    return {
        sessionData,
        sessionId,
        sessionUrl,
        link
    };
};

export default {
    fill,
    submit,
    generateSessionAndExtractLink
};
