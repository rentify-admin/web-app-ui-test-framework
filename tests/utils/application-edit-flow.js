import { expect } from '@playwright/test';
import { gotoPage } from './common';
import { searchApplication } from './applications-page';
import { app } from '../test_config';
import { joinUrl } from './helper';

/**
 * Navigate to and edit a specific application
 * @param {import('@playwright/test').Page} page 
 * @param {string} applicationName 
 * @returns {Promise<void>}
 */
export const navigateToApplicationEdit = async (page, applicationName) => {
    await gotoPage(page, 'applications-menu', 'applications-submenu', '/applications?fields[application]');
    await searchApplication(page, applicationName);

    const tableView = await page.getByTestId('application-table');
    const rows = await tableView.locator('tbody tr');
    const rowCount = await rows.count();

    const appUrlReg = new RegExp(`${joinUrl(app.urls.api, 'applications')}.{36}`);
    
    for (let index = 0; index < rowCount; index++) {
        const element = rows.nth(index);
        const tdLocator = await element.getByTestId('application-table-name-col');
        const text = await tdLocator.textContent();
        
        if (text.includes(applicationName)) {
            await Promise.all([
                page.waitForResponse(resp => appUrlReg.test(resp.url()) && resp.request().method() === 'GET' && resp.ok()),
                page.waitForResponse(resp => resp.url().includes('/organizations') && resp.request().method() === 'GET' && resp.ok()),
                element.locator('[data-testid^="edit-"]').click()
            ]);
            break;
        }
    }

    await expect(page.getByRole('heading', { name: 'Application Setup' })).toBeVisible();
    await page.waitForTimeout(500);
};

/**
 * Submit application setup form
 * @param {import('@playwright/test').Page} page 
 * @returns {Promise<void>}
 */
export const submitApplicationSetup = async (page) => {
    const appUrlReg = new RegExp(`${joinUrl(app.urls.api, 'applications')}.{36}`);
    await Promise.all([
        page.waitForResponse(resp => appUrlReg.test(resp.url()) && resp.request().method() === 'PATCH' && resp.ok()),
        page.getByTestId('submit-application-setup').click()
    ]);
};

/**
 * Configure identity verification step
 * @param {import('@playwright/test').Page} page 
 * @param {boolean} shouldBeChecked - Expected initial state of the checkbox
 * @returns {Promise<void>}
 */
export const configureIdentityVerification = async (page, shouldBeChecked = true) => {
    await page.getByTestId('workflow-identity-verification').click();

    const identityModal = await page.getByTestId('workflow-identity-modal');
    await expect(identityModal).toBeVisible();

    const checkbox = identityModal.locator('#identityRequired');
    
    // Check current state and toggle if needed
    const isCurrentlyChecked = await checkbox.isChecked();
    
    if (isCurrentlyChecked !== shouldBeChecked) {
        await checkbox.click();
    }

    // Verify the final state
    if (shouldBeChecked) {
        await expect(checkbox).toBeChecked();
    } else {
        await expect(checkbox).not.toBeChecked();
    }

    // Submit the identity setup form
    const idUrlReg = new RegExp(`${joinUrl(app.urls.api, 'applications')}/.{36}/steps/.{36}`);
    await Promise.all([
        page.waitForResponse(resp => idUrlReg.test(resp.url()) && resp.request().method() === 'PATCH' && resp.ok()),
        page.getByTestId('submit-identity-setup-form').click()
    ]);

    await page.getByTestId('submit-app-workflow-edit-form').click();
};

/**
 * Update application financial settings
 * @param {import('@playwright/test').Page} page 
 * @param {Object} settings - Financial settings to update
 * @returns {Promise<void>}
 */
export const updateApplicationFinancialSettings = async (page, settings = {}) => {
    const {
        guarantorValue = '1000',
        newGuarantorValue = '1000',
        incomeBudget = '1',
        rentBudgetMin = '500'
    } = settings;

    const appWithGuaField = await page.locator('#application-income-ratio-guarantor');

    // Verify current value if provided
    if (guarantorValue) {
        await expect(appWithGuaField).toHaveValue(guarantorValue);
    }

    // Update values
    await appWithGuaField.fill(newGuarantorValue);
    await page.locator('#incomeBudget').fill(incomeBudget);
    await page.locator('#rentBudgetMin').fill(rentBudgetMin);

    // Submit changes - now auto-publishes in edit mode
    const appUrlReg = new RegExp(`${joinUrl(app.urls.api, 'applications')}.{36}`);
    await Promise.all([
        // Wait for PATCH that auto-publishes
        page.waitForResponse(resp => appUrlReg.test(resp.url()) && resp.request().method() === 'PATCH' && resp.ok()),
        // Also wait for GET that refreshes applications list after auto-publish
        page.waitForResponse(resp => 
            resp.url().includes('/applications?fields[application]') &&
            resp.request().method() === 'GET' &&
            resp.ok()
        , { timeout: 30000 }),
        page.getByTestId('submit-application-setting-modal').click()
    ]);
    
    await page.waitForTimeout(2000); // Wait for UI to reflect changes
};

/**
 * Publish application to live
 * @param {import('@playwright/test').Page} page 
 * @returns {Promise<void>}
 */
export const publishApplicationToLive = async (page) => {
    await page.getByTestId('app-publish-live-btn').click();

    const appUrlReg = new RegExp(`${joinUrl(app.urls.api, 'applications')}.{36}`);
    
    // Wait for both PATCH and GET requests
    const [patchResponse, getResponse] = await Promise.all([
        // PATCH request to update application
        page.waitForResponse(resp => 
            appUrlReg.test(resp.url()) && 
            resp.request().method() === 'PATCH' && 
            resp.ok()
        , { timeout: 30000 }),
        
        // GET request to refresh applications list
        page.waitForResponse(resp => 
            resp.url().includes('/applications?fields[application]') &&
            resp.request().method() === 'GET' &&
            resp.ok()
        , { timeout: 30000 }),
        
        // Click confirm button
        page.getByTestId('confirm-btn').click()
    ]);
};

/**
 * Complete application edit workflow
 * @param {import('@playwright/test').Page} page 
 * @param {string} applicationName 
 * @param {Object} options 
 * @returns {Promise<void>}
 */
export const completeApplicationEditWorkflow = async (page, applicationName, options = {}) => {
    const {
        identityShouldBeChecked = true,
        financialSettings = {}
    } = options;

    // Navigate and edit application
    await navigateToApplicationEdit(page, applicationName);
    
    // Submit application setup
    await submitApplicationSetup(page);
    
    // Configure identity verification
    await configureIdentityVerification(page, identityShouldBeChecked);
    
    // Update financial settings - now auto-publishes in edit mode
    await updateApplicationFinancialSettings(page, financialSettings);
    
    // No longer need manual publish - auto-published above
}; 