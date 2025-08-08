import { expect } from '@playwright/test';

/**
 * Navigate to application creation page
 * @param {import('@playwright/test').Page} page
 */
export const navigateToApplicationCreate = async page => {
    const applicationMenu = await page.getByTestId('applications-menu');

    // Checking sidebar menu is already open or not.
    const applicationMenuClasses = await applicationMenu.getAttribute('class');
    if (applicationMenuClasses && !applicationMenuClasses.includes('sidebar-item-open')) {
        await page.getByTestId('applications-menu').click();
    }
    await page.getByTestId('applications-submenu').click();
    await page.waitForTimeout(2000);

    // Set up all response waiters BEFORE the action that triggers them
    const createResponsePromise = page.waitForResponse(resp => resp.url().includes('/organizations?fields[organization]=id,name')
        && resp.request().method() === 'GET'
        && resp.ok());

    const organizationsResponsePromise = page.waitForResponse(resp => resp.url().includes('/portfolios?fields[portfolio]=id,name')
        && resp.request().method() === 'GET'
        && resp.ok());

    const portfoliosResponsePromise = page.waitForResponse(resp => resp.url().includes('/settings?fields[setting]=options,key&fields[options]=label,value')
        && resp.request().method() === 'GET'
        && resp.ok());

    const settingsResponsePromise = page.waitForResponse(resp => resp.url().includes('/organizations')
        && resp.request().method() === 'GET'
        && resp.ok());

    // Now perform the action that triggers the responses
    await page.locator('a[href="/application/create"]').click();

    // Wait for all responses to complete
    const [ createResponse, organizationsResponse, portfoliosResponse, settingsResponse ] = await Promise.all([
        createResponsePromise,
        organizationsResponsePromise,
        portfoliosResponsePromise,
        settingsResponsePromise
    ]);

    await page.waitForTimeout(2000);
    return {
        createResponse,
        organizationsResponse,
        portfoliosResponse,
        settingsResponse
    };
};

/**
 * Fill application basic setup
 * @param {import('@playwright/test').Page} page
 * @param {Object} config
 * @param {string} config.organizationName
 * @param {string} config.applicationName
 * @param {Array<string>} config.applicantTypes
 */
export const fillApplicationSetup = async (page, config) => {

    // Select Organization
    await page.locator('label[for="organization"]').click();
    await page.locator('#organization').fill(config.organizationName);
    await page.locator('#organization-0').click();

    // Set Application Name
    await page.locator('#application_name').fill(config.applicationName);

    // Add multiple applicant types
    for (const applicantType of config.applicantTypes) {
        await page.locator('label[for="applicant_types"]').click();
        await page.locator('#applicant_types').fill(applicantType);
        await page.locator('#applicant_types-0').click();
    }
};

/**
 * Submit application setup and handle workflow configuration
 * @param {import('@playwright/test').Page} page
 * @param {Object} config
 * @param {string} config.workflowTemplate
 */
export const submitApplicationSetup = async (page, config = {}) => {

    // Set up response waiter BEFORE the action
    const setupResponsePromise = page.waitForResponse(resp => resp.url().includes('/applications')
        && resp.request().method() === 'POST'
        && resp.ok());

    // Now perform the action
    await page.getByTestId('submit-application-setup').click();

    // Wait for the response
    const setupResponse = await setupResponsePromise;

    await page.waitForTimeout(4000);

    // Check if workflow edit form is present (optional step)
    const workflowEditBtn = page.getByTestId('submit-app-workflow-edit-form');
    if (await workflowEditBtn.isVisible()) {

        // Select workflow template
        await page.locator('label[for="workflowTemplate"]').click();
        await page.locator('#workflowTemplate').fill(config.workflowTemplate || 'Autotest-suite-fin-only');
        await page.locator('#workflowTemplate-0').click();

        // Set up response waiter BEFORE the action
        const workflowResponsePromise = page.waitForResponse(resp => resp.url().includes('/applications')
            && resp.request().method() === 'PATCH'
            && resp.ok());

        // Now perform the action
        await page.getByTestId('submit-app-workflow-edit-form').click();

        // Wait for the response
        const workflowResponse = await workflowResponsePromise;

        return { setupResponse, workflowResponse };
    }

    return { setupResponse };
};

/**
 * Configure application settings (flag collection and minimum amount)
 * @param {import('@playwright/test').Page} page
 * @param {Object} config
 * @param {string} config.flagCollection
 * @param {string} config.minimumAmount
 */
export const configureApplicationSettings = async (page, config) => {

    // Configure flag collection and minimum amount
    await page.getByText('Select option').click();
    await page.locator('#flag_collection').fill(config.flagCollection || 'High Risk');
    await page.locator('#flag_collection-0').click();
    await page.locator('input[placeholder="Minimum"]').fill(config.minimumAmount || '500');

    await page.waitForTimeout(1000);

    // Set up response waiter BEFORE the action
    const settingsResponsePromise = page.waitForResponse(resp => resp.url().includes('/applications')
        && resp.request().method() === 'PATCH'
        && resp.ok());

    // Now perform the action
    await page.getByTestId('submit-application-setting-modal').click();

    // Wait for the response
    const settingsResponse = await settingsResponsePromise;

    await page.waitForTimeout(2000);
    return settingsResponse;
};

/**
 * Publish application to live
 * @param {import('@playwright/test').Page} page
 */
export const publishApplicationToLive = async page => {
    await page.locator('h3').filter({ hasText: 'Publish Live' }).waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForSelector('[data-testid="app-publish-live-btn"]', { state: 'visible', timeout: 3000 });
    await page.getByTestId('app-publish-live-btn').click();
    await page.waitForTimeout(2000); //Wait for UI animation

    // Set up response waiter BEFORE the action
    const publishResponsePromise = page.waitForResponse(resp => resp.url().includes('/applications')
        && resp.request().method() === 'PATCH'
        && resp.ok());

    // Now perform the action
    await page.getByTestId('confirm-btn').click();

    // Wait for the response
    const publishResponse = await publishResponsePromise;

    return publishResponse;
};

/**
 * Search and delete application
 * @param {import('@playwright/test').Page} page
 * @param {string} applicationName
 */
export const searchAndDeleteApplication = async (page, applicationName) => {
    await page.locator('input[data-testid="application-search"]').fill(applicationName);
    await page.waitForTimeout(1500);

    // Add dialog handler only if none exists
    const existingListeners = page.listeners('dialog');
    if (existingListeners.length === 0) {
        page.on('dialog', dialog => dialog.accept());
    }

    const [ deleteResponse ] = await Promise.all([
        page.waitForResponse(resp => resp.url().match(/\/applications\/[a-f0-9-]+$/)
            && resp.request().method() === 'DELETE'
            && resp.ok()),
        expect(page.locator('div[role="alert"] p:has-text("Application deleted successfully")')).toBeVisible({ timeout: 10_000 }),
        page.locator('a[title="Delete"]').click()
    ]);

    return deleteResponse;
};

/**
 * Search and edit application
 * @param {import('@playwright/test').Page} page
 * @param {string} applicationName
 * @param {Object} options
 * @param {string} options.removeApplicantType - Applicant type to remove
 */
export const searchAndEditApplication = async (page, applicationName, options = {}) => {
    await page.locator('input[data-testid="application-search"]').fill(applicationName);
    await page.waitForTimeout(2000);

    // Click edit button
    await page.locator('a[title="Edit"]').click();
    await page.waitForTimeout(2000);

    if (options.removeApplicantType) {

        // Remove specific applicant type
        await page.locator(`//span[@class="multiselect__tag"][span[text()="${options.removeApplicantType}"]]/i`).click();

        // Submit the edit
        const [ editResponse ] = await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/applications')
                && resp.request().method() === 'PATCH'
                && resp.ok()),
            page.getByTestId('submit-application-setup').click()
        ]);

        await page.waitForTimeout(1000);

        // Handle workflow edit if present (just navigation)
        const workflowEditBtn = page.getByTestId('submit-app-workflow-edit-form');
        if (await workflowEditBtn.isVisible()) {
            await workflowEditBtn.click();
            await page.waitForTimeout(2000); //Wait for UI animation
        }

        // Handle settings modal if present (just navigation)
        const settingsBtn = page.getByTestId('submit-application-setting-modal');
        if (await settingsBtn.isVisible()) {
            await settingsBtn.click();
            await page.waitForTimeout(2000); //Wait for UI animation
        }

        // Publish changes using existing utility
        const publishResponse = await publishApplicationToLive(page);

        return editResponse;
    }

    // Default: just cancel
    await page.getByTestId('cancel-application-setup').click();
    await page.waitForTimeout(2000);
};

/**
 * Search and verify application (count applicant types)
 * @param {import('@playwright/test').Page} page
 * @param {string} applicationName
 * @returns {Promise<number>} Number of applicant types
 */
export const searchAndVerifyApplication = async (page, applicationName) => {
    await page.locator('input[data-testid="application-search"]').fill(applicationName);
    await page.waitForTimeout(2000);

    // Click edit button
    await page.locator('a[title="Edit"]').click();
    await page.waitForTimeout(2000);

    // Count applicant types and cancel
    const applicantTypeCount = await page.locator('span.multiselect__tag').count();
    await page.getByTestId('cancel-application-setup').click();
    await page.waitForTimeout(2000);

    return applicantTypeCount;
};

/**
 * Complete application creation and deletion flow
 * @param {import('@playwright/test').Page} page
 * @param {Object} config
 */
export const completeApplicationFlow = async (page, config) => {

    // Navigate to application & create application
    const responses = await createApplicationFlow(page, config);

    // Search and delete
    responses.delete = await searchAndDeleteApplication(page, config.applicationName);

    return responses;
};
export const createApplicationFlow = async (page, config) => {
    const responses = {};

    responses.createPage = await navigateToApplicationCreate(page);

    // Fill application setup
    await fillApplicationSetup(page, config);

    // Submit setup and handle workflow
    const setupResponses = await submitApplicationSetup(page, config);
    Object.assign(responses, setupResponses);

    // Configure settings
    responses.settings = await configureApplicationSettings(page, config);

    // Publish to live
    responses.publish = await publishApplicationToLive(page);

    return responses;
};
