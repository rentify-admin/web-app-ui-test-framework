import { expect } from '@playwright/test';
import { searchAndEditApplication as searchAndEditApplicationUtil, searchAndVerifyApplication as searchAndVerifyApplicationUtil } from './applications-page';

/**
 * Navigate to application creation page
 * @param {import('@playwright/test').Page} page
 */
export const navigateToApplicationCreate = async page => {
    // Set up all response waiters BEFORE navigation
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

    // Navigate directly to the create application page (avoid clicks)
    await page.goto('/application/create');

    // Wait for all responses to complete
    const [createResponse, organizationsResponse, portfoliosResponse, settingsResponse] = await Promise.all([
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

    // Extract application ID from response
    const setupResponseData = await setupResponse.json();
    const applicationId = setupResponseData.data.id;
    console.log('📝 Application created with ID:', applicationId);

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

        return { setupResponse, workflowResponse, applicationId };
    }

    return { setupResponse, applicationId };
};

/**
 * Configure application settings (flag collection, minimum and maximum amount)
 * @param {import('@playwright/test').Page} page
 * @param {Object} config
 * @param {string} config.flagCollection
 * @param {string} config.minimumAmount
 * @param {string} [config.maximumAmount] - Optional maximum amount
 */
export const configureApplicationSettings = async (page, config) => {

    // wait for income source templates to load
    await defaultIncomeTemplateVisibility(page);

    // Configure flag collection and rent budget range
    await page.getByText('Select option').click();
    await page.locator('#flag_collection').fill(config.flagCollection || 'High Risk');
    await page.locator('#flag_collection-0').click();
    await page.getByTestId('rent-budget-min').fill(config.minimumAmount || '500');
    await page.getByTestId('rent-budget-max').fill(config.maximumAmount || '10000');

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
    // TODO: Request locator update: searching for h3 is no good.
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
 * @param {string} [applicationId] - Optional application ID for robust selection
 */
export const searchAndDeleteApplication = async (page, applicationName, applicationId = null) => {
    await page.getByTestId('application-search').fill(applicationName);
    await page.waitForTimeout(1500);

    // Add dialog handler only if none exists
    const existingListeners = page.listeners('dialog');
    if (existingListeners.length === 0) {
        page.on('dialog', dialog => dialog.accept());
    }

    const [deleteResponse] = await Promise.all([
        page.waitForResponse(resp => resp.url().match(/\/applications\/[a-f0-9-]+$/)
            && resp.request().method() === 'DELETE'
            && resp.ok()),
        expect(page.locator('div[role="alert"] p:has-text("Application deleted successfully")')).toBeVisible({ timeout: 10_000 }),
        // Use applicationId if provided, otherwise fallback to title
        applicationId ?
            page.getByTestId(`delete-${applicationId}`).click() :
            page.locator('a[title="Delete"]').click()
    ]);

    if (applicationId) {
        console.log(`🗑️ Deleted application ${applicationName} using ID: ${applicationId}`);
    }

    return deleteResponse;
};

/**
 * Search and edit application (delegates to applications-page util)
 */
export const searchAndEditApplication = async (page, applicationName, options = {}) => {
    return await searchAndEditApplicationUtil(page, applicationName, options);
};

/**
 * Search and verify application (delegates to applications-page util)
 */
export const searchAndVerifyApplication = async (page, applicationName, applicationId = null) => {
    return await searchAndVerifyApplicationUtil(page, applicationName, applicationId);
};

/**
 * Complete application creation and deletion flow
 * @param {import('@playwright/test').Page} page
 * @param {Object} config
 */
export const completeApplicationFlow = async (page, config) => {

    // Navigate to application & create application
    const responses = await createApplicationFlow(page, config);

    // Extract applicationId for robust deletion
    const applicationId = responses.applicationId;
    console.log('🔄 Using application ID for deletion:', applicationId);

    // Search and delete using robust selector
    responses.delete = await searchAndDeleteApplication(page, config.applicationName, applicationId);

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

    if (!config.noPublish) {
        // Publish to live
        responses.publish = await publishApplicationToLive(page);
    }

    return responses;
};
async function defaultIncomeTemplateVisibility(page) {
    try {
        await page.waitForResponse(resp => {
            return resp.url().includes('/income-source-templates')
                && resp.request().method() === 'GET'
                && resp.ok();
        }, { timeout: 1500 });
        // check default is selected with case insensitive
        await expect(page.getByTestId('application-income-source-tags').locator('span.multiselect__single')).toContainText('Default', {
            timeout: 1500,
            ignoreCase: true
        });
    } catch (err) {
        const defaultValue = await page.getByTestId('application-income-source-tags').locator('span.multiselect__single').textContent();
        console.log(`Actual income source template default value: ${defaultValue}`);
        console.error(`Failed checking default income source template value: ${err.message}`);
        throw err;
    }
}

