import { expect } from '@playwright/test';

/**
 * Opens the application edit modal for the first row (or by name if needed)
 * @param {import('@playwright/test').Page} page
 * @param {number} rowIndex - Index of the row to edit (default: 0)
 */
export const openApplicationEditModal = async (page, rowIndex = 0) => {
    const appUrl = new RegExp(`.+/applications/.{36}?.+`);
    const response = Promise.all([
        page.waitForResponse(resp => resp.url().includes('/organizations?fields[organization]=')
            && resp.ok()
            && resp.request().method() === 'GET', { timeout: 15000 }),
        page.waitForResponse(resp => resp.url().includes('/portfolios?fields[portfolio]=')
            && resp.ok()
            && resp.request().method() === 'GET', { timeout: 15000 }),
        page.waitForResponse(resp => resp.url().includes('/settings?fields[setting]=')
            && resp.ok()
            && resp.request().method() === 'GET', { timeout: 15000 }),
        page.waitForResponse(resp => appUrl.test(resp.url())
            && resp.ok()
            && resp.request().method() === 'GET', { timeout: 15000 })
    ]);

    await page.locator('table > tbody > tr > td:nth-child(8) > div > a').nth(rowIndex)
        .click();

    return response;
};

/**
 * Opens the workflow identity setup modal
 * @param {import('@playwright/test').Page} page
 */
export const openWorkflowIdentitySetup = async page => {
    await page.locator('[data-testid="workflow-identity-verification"] svg').click();
    await expect(page.locator('h3', { hasText: 'Workflow Setup' })).toBeVisible();
};

/**
 * Sets the Persona Template ID and saves
 * @param {import('@playwright/test').Page} page
 * @param {string} value - The persona template ID to set
 */
export const setPersonaTemplateId = async (page, value) => {
    const personaInput = page.getByTestId('persona-template-id-input');
    await personaInput.fill(value);
    const appUrl = new RegExp(`.+/applications/.{36}?.+`);
    const promise = Promise.all([
        page.waitForResponse(resp => appUrl.test(resp.url())
           && resp.ok()
           && resp.request().method() === 'PATCH'),
        page.waitForResponse(resp => appUrl.test(resp.url())
           && resp.ok()
           && resp.request().method() === 'GET')
    ]);

    await page.getByTestId('submit-identity-setup-form').click();

    return promise;
};

/**
 * Verifies the Persona Template ID value
 * @param {import('@playwright/test').Page} page
 * @param {string} expectedValue - The expected persona template ID value
 */
export const expectPersonaTemplateId = async (page, expectedValue) => {
    const personaInput = page.getByTestId('persona-template-id-input');
    await page.waitForTimeout(500);
    await expect(personaInput).toHaveValue(expectedValue);
};
