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
        guarantorValue = null,
        newGuarantorValue = null,
        incomeBudget = null,
        rentBudgetMin = null
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
        // Also wait for GET that refreshes application after auto-publish
        // Pattern matches: /applications/{id}?fields[application]=:all or /applications/{id}?fields[application]=...
        page.waitForResponse(resp => 
            resp.url().includes('/applications/') &&
            resp.url().includes('fields[application]') &&
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
    // Wait for publish button to be visible and enabled using robust data-testid
    const publishBtn = page.getByTestId('app-publish-live-btn');
    await expect(publishBtn).toBeVisible({ timeout: 10_000 });
    await expect(publishBtn).toBeEnabled({ timeout: 10_000 });
    await publishBtn.click();

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

/**
 * Navigate to application edit page using application ID and name
 * @param {import('@playwright/test').Page} page 
 * @param {string} applicationId 
 * @param {string} applicationName - Application name to search for
 * @returns {Promise<object>} API responses
 */
export const gotoApplicationEditById = async (page, applicationId, applicationName) => {
    console.log(`📝 Navigating to edit application: ${applicationName} (ID: ${applicationId})`);
    
    // Navigate to applications page
    await gotoPage(page, 'applications-menu', 'applications-submenu', '/applications?fields[application]');
    
    // Wait for data to load (no "No Record Found")
    await page.getByText('No Record Found').waitFor({ state: 'hidden', timeout: 30000 });
    console.log('✅ Applications page loaded');
    
    // Search for the application by name
    console.log(`🔍 Searching for application: ${applicationName}`);
    await page.getByTestId('application-search').fill(applicationName);
    await page.waitForTimeout(2000); // Wait for search to filter results
    console.log('✅ Search completed');
    
    // Locate the edit button by application ID
    const appEditBtn = page.getByTestId(`edit-${applicationId}`);
    
    // Verify the button is visible after search
    await expect(appEditBtn).toBeVisible({ timeout: 10000 });
    console.log('✅ Edit button found and visible');
    
    // Set up promises to wait for all critical API calls
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

    const applicationResponsePromise = page.waitForResponse(resp => resp.url().includes(`/applications/${applicationId}`)
        && resp.request().method() === 'GET'
        && resp.ok());

    // Click the edit button
    await appEditBtn.click();

    // Wait for all promises to resolve
    const [createResponse, organizationsResponse, portfoliosResponse, settingsResponse, applicationResponse] = await Promise.all([
        createResponsePromise,
        organizationsResponsePromise,
        portfoliosResponsePromise,
        settingsResponsePromise,
        applicationResponsePromise
    ]);
    
    console.log('✅ Application edit page loaded');

    return {
        createResponse,
        organizationsResponse,
        portfoliosResponse,
        settingsResponse,
        applicationResponse
    };
};

/**
 * Configure Financial Verification step in application workflow
 * @param {import('@playwright/test').Page} page 
 * @param {Object} financialData - Financial configuration data
 * @param {string} financialData.primaryProvider - Primary provider (e.g., "Plaid", "MX", "Simulation")
 * @param {string} financialData.secondaryProvider - Secondary provider
 * @param {string} financialData.maxConnection - Max connections allowed
 * @param {string} financialData.retriveTransactionType - Transaction type ("Debits", "Credits", "Both")
 * @param {string} financialData.minDoc - Minimum required documents
 * @param {Array} financialData.docs - Array of document configurations
 * @returns {Promise<void>}
 */
export const configureFinancialStep = async (page, financialData) => {
    console.log('💰 Configuring Financial Verification step...');
    
    // Import fillMultiselect dynamically
    const { fillMultiselect } = await import('./common.js');
    
    // Click on Workflow Setup step (scroll into view first to avoid overlay issues)
    const workflowSetupStep = page.getByTestId('step-#workflow-setup');
    await workflowSetupStep.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500); // Wait for any overlays/animations to settle
    await workflowSetupStep.click({ timeout: 10_000 });
    console.log('✅ Clicked Workflow Setup step');

    // Select Default applicant type
    await page.getByTestId('type-default').click({ timeout: 20_000 });
    console.log('✅ Selected Default Applicant Type');

    // Set up promise to wait for Financial Document Configurations API
    const finDocConfigPromise = page.waitForResponse(resp => {
        const apiRegex = new RegExp(`${joinUrl(app.urls.api, 'applications')}/.{36}/steps/.{36}/document-configurations`);
        return apiRegex.test(resp.url())
            && resp.request().method() === 'GET'
            && resp.ok();
    }, { timeout: 20_000 });

    // Click Financial Verification step
    await page.getByTestId('workflow-financial-verification').click();
    console.log('✅ Opened Financial Verification modal');

    // Wait for document configurations to load
    await finDocConfigPromise;
    console.log('✅ Financial Document Configurations loaded');

    // Fill Primary and Secondary Provider
    await fillMultiselect(page, page.getByTestId('financial-setting-primary-provider-field'), [financialData.primaryProvider]);
    await fillMultiselect(page, page.getByTestId('financial-setting-secondary-provider-field'), [financialData.secondaryProvider]);
    console.log(`✅ Set providers: ${financialData.primaryProvider} / ${financialData.secondaryProvider}`);

    // Fill Max Connection and Minimum Required Document
    await page.getByTestId('financial-setting-max-connection-field').fill(financialData.maxConnection);
    await page.getByTestId('fin-min-required-doc').fill(financialData.minDoc);
    console.log(`✅ Set max connections: ${financialData.maxConnection}, min docs: ${financialData.minDoc}`);

    // Click Retrieve Transaction Type button
    await page.getByTestId('retrive-transaction-type').getByRole('button', { name: financialData.retriveTransactionType }).click();
    console.log(`✅ Set transaction type: ${financialData.retriveTransactionType}`);

    // Configure documents if provided
    if (financialData.docs && financialData.docs.length > 0) {
        for (let index = 0; index < financialData.docs.length; index++) {
            const doc = financialData.docs[index];
            const bankDocForm = page.getByTestId(`${doc.testid}-doc`);

            // Add document type if not an update
            if (doc.action !== 'update') {
                await fillMultiselect(page, page.getByTestId('document-type'), [doc.docType]);
                await page.getByTestId('document-type-add-btn').click();
                console.log(`✅ Added document type: ${doc.docType}`);
            }

            // Fill document details
            await fillMultiselect(page, bankDocForm.getByTestId(`doc-${doc.testid}-visibility`), doc.visibility);
            await page.waitForTimeout(200);
            await fillMultiselect(page, bankDocForm.getByTestId(`doc-${doc.testid}-policy`), [doc.policy]);
            await bankDocForm.getByTestId(`doc-${doc.testid}-max`).fill(doc.maxUpload);
            console.log(`✅ Configured document: ${doc.docType}`);
        }
    }

    // Save configuration
    await Promise.all([
        page.waitForResponse(resp => {
            return (resp.request().method() === 'PATCH' || resp.request().method() === 'POST')
                && resp.ok();
        }),
        page.getByTestId('submit-financial-step-form').click()
    ]);
    console.log('✅ Financial step configuration saved');

    // Wait for modal to close
    await page.getByTestId('financial-setup-modal').waitFor({ state: 'detached', timeout: 20000 });
    console.log('✅ Financial setup modal closed');
};

/**
 * Verify Financial Verification step configuration
 * @param {import('@playwright/test').Page} page 
 * @param {Object} financialData - Expected financial configuration
 * @returns {Promise<void>}
 */
export const verifyFinancialStepConfiguration = async (page, financialData) => {
    console.log('🔍 Verifying Financial Verification step configuration...');
    
    // Click on Workflow Setup step only if not already active (check pointer-events, not class)
    const workflowSetupStep = page.getByTestId('step-#workflow-setup');
    const hasPointerEventsNone = await workflowSetupStep.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.pointerEvents === 'none';
    });
    
    if (hasPointerEventsNone) {
        // Element has pointer-events: none → truly active, cannot be clicked
        console.log('ℹ️  Workflow Setup step already active (pointer-events: none), skipping click');
    } else {
        // Element is clickable → click it
        await workflowSetupStep.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500); // Wait for any overlays/animations to settle
        await workflowSetupStep.click({ timeout: 10_000 });
        console.log('✅ Clicked Workflow Setup step');
    }
    
    // Select Default applicant type
    await page.getByTestId('type-default').click({ timeout: 20_000 });

    // Set up promise to wait for Financial Document Configurations API
    const finDocConfigPromise = page.waitForResponse(resp => {
        const apiRegex = new RegExp(`${joinUrl(app.urls.api, 'applications')}/.{36}/steps/.{36}/document-configurations`);
        return apiRegex.test(resp.url())
            && resp.request().method() === 'GET'
            && resp.ok();
    }, { timeout: 20_000 });

    // Click Financial Verification step
    await page.getByTestId('workflow-financial-verification').click();

    // Wait for configurations to load
    await finDocConfigPromise;
    await page.waitForTimeout(2000);

    // Verify Primary Provider
    await expect(page.getByTestId('financial-setting-primary-provider-field').locator('.multiselect__single'))
        .toContainText(financialData.primaryProvider);
    console.log(`✅ Primary Provider verified: ${financialData.primaryProvider}`);

    // Verify Secondary Provider
    await expect(page.getByTestId('financial-setting-secondary-provider-field').locator('.multiselect__single'))
        .toContainText(financialData.secondaryProvider);
    console.log(`✅ Secondary Provider verified: ${financialData.secondaryProvider}`);

    // Verify Max Connection
    await expect(page.getByTestId('financial-setting-max-connection-field'))
        .toHaveValue(financialData.maxConnection);
    console.log(`✅ Max Connections verified: ${financialData.maxConnection}`);

    // Verify Transaction Type
    const retrieveTransactionBtn = page.getByTestId('retrive-transaction-type')
        .getByRole('button', { name: financialData.retriveTransactionType });
    await expect(retrieveTransactionBtn).toHaveClass(/bg-primary-400/);
    console.log(`✅ Transaction Type verified: ${financialData.retriveTransactionType}`);

    // Verify Minimum Required Documents
    await expect(page.getByTestId('fin-min-required-doc'))
        .toHaveValue(financialData.minDoc);
    console.log(`✅ Minimum Required Documents verified: ${financialData.minDoc}`);

    // Close modal
    await page.getByTestId('financial-setup-modal-cancel').click();
    console.log('✅ Verification complete, modal closed');
}; 