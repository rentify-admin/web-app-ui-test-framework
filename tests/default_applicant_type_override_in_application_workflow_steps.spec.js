// Imports necessary modules, fixtures, and utility functions for the test.
import { test, expect } from "./fixtures/api-data-fixture";
import { admin, app } from "./test_config";
import { createApplicationFlow } from "./utils/application-management";
import { searchApplication } from "./utils/applications-page";
import { authenticateAdmin, cleanupApplication } from "./utils/cleanup-helper";
import { fillMultiselect } from "./utils/common";
import { getRandomNumber, joinUrl } from "./utils/helper";
import loginForm from "./utils/login-form";
import { waitForJsonResponse } from "./utils/wait-response";
import WorkflowBuilder from "./utils/workflow-builder";

// Global variable to store the ID of the created application for cleanup.
let cleanupApplicationId = null

const workflowTemplate = 'Autotest-suite-fin-only';

// Define the test suite for QA-215: Default Applicant Type Override in Application Workflow Steps.
test.describe('QA-215 default_applicant_type_override_in_application_workflow_steps.spec', () => {
    // Configure the test suite execution.
    test.describe.configure({
        mode: 'serial', // Ensure tests run in order, necessary for setup/cleanup flow.
        timeout: 130_000 // Set a generous timeout for the entire suite.
    });

    // Cleanup hook that runs after all tests in the suite have completed.

    test.beforeAll(async ({ request }) => {
        // if Workflow not found then create workflow with required configuration
        const token = await authenticateAdmin(request);
        if (!token) {
            console.log(`⚠️ Manual workflow creation not triggered`);
            return;
        }
        // Constants for workflow creation
        const workflowBuilder = new WorkflowBuilder(request, workflowTemplate, token)
        if (!await workflowBuilder.checkWorkflowExists()) {
            await workflowBuilder.checkOrCreateWorkflow();
            await workflowBuilder.getRequiredData();
            await workflowBuilder.createIdentityStep({});
            await workflowBuilder.createFinancialStep({});
            await workflowBuilder.fetchCreatedSteps();
            await workflowBuilder.createPaths();
        }
        console.log("✅ Workflow setup complete for default applicant type override scenario.");
    });

    test.afterAll(async ({ request }) => {
        console.log(`🧹 Suite Cleanup: Running afterAll cleanup`);
        try {
            // Attempt to clean up the application created during the test.
            await cleanupApplication(request, cleanupApplicationId, true)
            console.log(`✅ Suite Cleanup: Application ID ${cleanupApplicationId} cleaned up successfully.`);
        } catch (error) {
            // Log if the cleanup failed or the ID was null (already cleaned/not created).
            console.log(`ℹ️ Suite Cleanup: Cleanup not required or already completed for ID ${cleanupApplicationId}. Error: ${error.message}`);
        }
    });

    // Main test case: Testing the override options specifically on the Financial Verification step.
    test('Test Default Applicant Type Override Options (Financial Step Only)',
        {
            tag: ['@regression', '@application']
        }, async ({ page }) => {
            console.log(`--- Starting Test: Test Default Applicant Type Override Options (Financial Step Only) ---`);
            test.setTimeout(180_000); // Set a timeout for this individual test.

            // 1. Initial Setup and Login
            await page.goto('/');
            console.log('Navigated to base URL.');

            await loginForm.fill(page, admin);
            console.log('Filled in login form with admin credentials.');

            await loginForm.submitAndSetLocale(page);
            console.log('Submitted login and set locale.');

            // Verify successful login by checking for a known element.
            await expect(page.getByTestId('applicants-menu')).toBeVisible();
            console.log('Login verified. Applicants menu is visible.');

            // 2. Application Configuration and Creation
            const appConfig = {
                organizationName: 'Verifast',
                applicationName: `AutoTest override_applicant_type_${getRandomNumber()}`,
                applicantTypes: [
                    'Affordable Occupant',
                    'Affordable Primary',
                    'Corporate Leasing',
                    'Employed',
                    'International',
                    'Self-Employed',
                    'Other'
                ],
                workflowTemplate: workflowTemplate,
                flagCollection: 'High Risk',
                minimumAmount: '500'
            };

            console.log(`Attempting to create application: ${appConfig.applicationName}`);
            // Create the application using a utility function.
            const { applicationId } = await createApplicationFlow(page, appConfig)
            console.log(`Application created with ID: ${applicationId}`);

            // Store the ID for post-test cleanup.
            cleanupApplicationId = applicationId;

            // Wait for the application table to be visible after creation.
            await expect(page.getByTestId('application-table')).toBeVisible({ timeout: 30_000 })

            // Search for the newly created application.
            await searchApplication(page, appConfig.applicationName)

            // Locate the edit button for the new application.
            const appEditBtn = page.getByTestId(`edit-${applicationId}`);

            // Navigate to the application edit page, waiting for necessary API responses.
            const { applicationResponse } = await gotoApplicationEdit(page, appEditBtn, applicationId);
            console.log('Navigated to application edit page.');

            // Wait for and capture the application data response.
            const application = await waitForJsonResponse(applicationResponse);
            console.log('Received application details for editing.');

            // 3. Configure Default Applicant Type (Initial Setup)

            // Click on the 'Workflow Setup' step.
            await page.getByTestId('step-#workflow-setup').click({ timeout: 10_000 });
            console.log('Clicked Workflow Setup step.');

            // Select the 'Default' applicant type.
            await page.getByTestId('type-default').click({ timeout: 20_000 });
            console.log('Selected Default Applicant Type.');

            // Set up a promise to wait for the Financial Document Configurations API call.
            const finDocConfigPromise = page.waitForResponse(resp => {
                const apiRegex = new RegExp(`${joinUrl(app.urls.api, 'applications')}/.{36}/steps/.{36}/document-configurations`)
                return apiRegex.test(resp.url())
                    && resp.request().method() === 'GET'
                    && resp.ok(), { timeout: 20_000 }
            });

            // Click on the 'Financial Verification' workflow step to open its configuration modal.
            await page.getByTestId('workflow-financial-verification').click();
            console.log('Clicked Financial Verification workflow step.');

            // Wait for the document configurations to load.
            await finDocConfigPromise;
            console.log('Financial Document Configurations loaded.');


            // 4. Check and Enable Override Options on Default Type

            // Checking that the override checkboxes are visible.
            await expect(page.getByTestId('identity-override-settings')).toBeVisible();
            await expect(page.getByTestId('identity-override-documents')).toBeVisible();
            console.log('Override settings and documents checkboxes are visible on Default type.');

            // Check the override checkboxes for settings and documents.
            await page.getByTestId('identity-override-settings').check();
            await page.getByTestId('identity-override-documents').check();
            console.log('Enabled override settings and documents for Financial Step.');

            // Define the initial financial configuration data.
            const financialData = {
                primaryProvider: 'MX',
                secondaryProvider: 'Plaid',
                maxConnection: '3',
                retriveTransactionType: 'Debits',
                minDoc: '0',
                docs: [
                    {
                        testid: 'bank-statement',
                        docType: 'Bank Statement',
                        visibility: ['Always'],
                        policy: 'Sample Bank Statement Policy',
                        maxUpload: '3',
                    }
                ]
            }
            console.log('Filling Financial Step with initial data.');

            // Fill the Financial Step configuration form.
            await fillFinancialStep(page, financialData);
            console.log('Financial Step form filled.');

            // Save the configuration. Wait for the PATCH/POST API call to complete successfully.
            await Promise.all([
                page.waitForResponse(resp => {
                    return (resp.request().method() === 'PATCH'
                        || resp.request().method() === 'POST')
                        && resp.ok()

                }),
                page.getByTestId('submit-financial-step-form').click()
            ])
            console.log('Financial Step configuration saved.');

            // Wait for the configuration modal to close/detach.
            await page.getByTestId('financial-setup-modal').waitFor({ state: 'detached', timeout: 20000 });
            console.log('Financial setup modal closed.');

            await page.waitForTimeout(2000); // Wait for potential UI updates.

            // 5. Verification on Default Type after Save

            // Re-open the Financial Step configuration.
            await page.getByTestId('workflow-financial-verification').click()
            await page.waitForTimeout(2000);

            // Verify that the saved details are correct.
            await verifyDetails(page, financialData);
            console.log('Verified initial Financial Step details on Default type.');

            // Verify the override checkboxes are still visible (and checked).
            await expect(page.getByTestId('identity-override-settings')).toBeVisible();
            await expect(page.getByTestId('identity-override-documents')).toBeVisible();
            console.log('Verified override checkboxes are still visible/checked on Default type.');

            // Close the modal.
            await page.getByTestId('financial-setup-modal-cancel').click();
            console.log('Closed financial setup modal.');

            // 6. Verification on Other Applicant Types

            // List of applicant type IDs to check.
            const types = [
                'affordable-occupant',
                'affordable-primary',
                'corporate-leasing',
                'employed',
                'international',
                'self-employed',
                'other'
            ];

            // Loop through each specific applicant type.
            for (const type of types) {
                console.log(`--- Checking Applicant Type: ${type} ---`);
                // Click to select the specific applicant type.
                await page.getByTestId(`type-${type}`).click();
                console.log(`Selected applicant type: ${type}`);

                // Verify that the details are **not** overridden and match the initial `financialData` (default settings).
                await verifyDetailFilled(page, financialData);
                await page.waitForTimeout(2000);
            }
            console.log('Successfully verified all specific types inherited settings from the default type before override.');

            // Revert back to the Default type for the negative test preparation.
            await page.getByTestId('type-default').click();
            console.log('Re-selected Default Applicant Type for update.');

            // 7. Negative Test: Update Default Type & Verify Specific Types Retain Old Data

            // Define new financial configuration data for the update.
            const newFinancialData = {
                primaryProvider: 'Plaid',
                secondaryProvider: 'MX',
                maxConnection: '2',
                retriveTransactionType: 'Credits',
                minDoc: '0',
                docs: [
                    {
                        action: 'update', // Action indicates updating an existing document configuration.
                        testid: 'bank-statement',
                        docType: 'Bank Statement',
                        visibility: ['Always'],
                        policy: 'Sample Bank Statement Policy',
                        maxUpload: '3',
                    }
                ]
            }
            console.log('Updating Financial Step with new data on Default type.');

            // Open the Financial Verification step again.
            await page.getByTestId('workflow-financial-verification').click();
            // Fill the Financial Step configuration form with the new data.
            await fillFinancialStep(page, newFinancialData)
            console.log('Financial Step form filled with new data.');

            // Save the new configuration. Wait for the API call to complete successfully.
            await Promise.all([
                page.waitForResponse(resp => {
                    return (resp.request().method() === 'PATCH'
                        || resp.request().method() === 'POST')
                        && resp.ok()

                }),
                page.getByTestId('submit-financial-step-form').click()
            ])
            console.log('New Financial Step configuration saved for Default type.');
            // Wait for the configuration modal to close/detach.
            await page.getByTestId('financial-setup-modal').waitFor({ state: 'detached', timeout: 20000 });
            console.log('Financial setup modal closed after update.');


            // Loop through each specific applicant type again.
            for (const type of types) {
                await page.waitForTimeout(2000);
                console.log(`--- Re-checking Applicant Type: ${type} (Expecting Old Data) ---`);
                // Select the specific applicant type.
                await page.getByTestId(`type-${type}`).click();
                console.log(`Selected applicant type: ${type}`);

                // Verify that the details **still match the OLD initial data** (since they are overridden/saved).
                await verifyDetailFilled(page, financialData);
                console.log(`Verified type ${type} retains OLD financial data as expected due to override/save.`);
            }
            console.log('Successfully verified specific types retained their originally inherited/saved settings (old default data) after the Default type was updated.');
            console.log(`--- Test Finished: Test Default Applicant Type Override Options (Financial Step Only) ---`);

        })

})

/**
 * Clicks the Financial Verification step for a specific applicant type and verifies
 * that the settings match the provided financialData, and that override checkboxes are NOT visible.
 * This confirms the type has its own explicit, saved configuration (inherited the default settings upon initial click).
 *
 * @param {import('@playwright/test').Page} page - The Playwright Page object.
 * @param {object} financialData - The expected financial configuration data.
 */
async function verifyDetailFilled(page, financialData) {
    console.log('Verifying details for a specific applicant type.');
    // Set up promises to wait for necessary API responses when opening the step.
    const settingApiPromise = page.waitForResponse(resp => resp.url().includes('/settings?')
        && resp.request().method() === 'GET' && resp.ok(), { timeout: 20000 });

    const documentPoliciesPromise = page.waitForResponse(resp => resp.url().includes('/document-policies?')
        && resp.request().method() === 'GET' && resp.ok(), { timeout: 20000 });

    const docTypesPromise = page.waitForResponse(resp => {
        return resp.url().includes(joinUrl(app.urls.api, '/document-types?'))
            && resp.request().method() === 'GET'
            && resp.ok(), { timeout: 20000 };
    });
    const finDocConfigPromise = page.waitForResponse(resp => {
        const apiRegex = new RegExp(`${joinUrl(app.urls.api, 'applications')}/.{36}/steps/.{36}/document-configurations`)
        return apiRegex.test(resp.url())
            && resp.request().method() === 'GET'
            && resp.ok(), { timeout: 20_000 }
    });

    // Wait for all responses and click the workflow step simultaneously.
    await Promise.all([
        finDocConfigPromise,
        docTypesPromise,
        settingApiPromise,
        documentPoliciesPromise,
        page.getByTestId('workflow-financial-verification').click()
    ]);
    console.log('Financial Verification step modal opened and data loaded.');

    // Crucial check: Override checkboxes should NOT be visible for specific types once they have their own configuration.
    await expect(page.getByTestId('identity-override-settings')).not.toBeVisible();
    await expect(page.getByTestId('identity-override-documents')).not.toBeVisible();
    console.log('Verified override checkboxes are NOT visible (confirming type has its own saved config).');

    // Verify the saved financial details match the expected data.
    await verifyDetails(page, financialData);
    console.log('Details verified successfully.');

    // Close the modal.
    await page.getByTestId('financial-setup-modal-cancel').click();
    console.log('Closed financial setup modal.');

}

/**
 * Asserts the detailed financial step configuration in the modal against the expected data.
 *
 * @param {import('@playwright/test').Page} page - The Playwright Page object.
 * @param {object} financialData - The expected financial configuration data.
 */
async function verifyDetails(page, financialData) {
    console.log(`Starting detailed verification of Financial Step data.`);
    // Verify Primary Provider field content.
    await expect(page.getByTestId('financial-setting-primary-provider-field').locator('.multiselect__single')).toContainText(financialData.primaryProvider);
    // Verify Secondary Provider field content.
    await expect(page.getByTestId('financial-setting-secondary-provider-field').locator('.multiselect__single')).toContainText(financialData.secondaryProvider);
    // Verify Max Connection input value.
    await expect(page.getByTestId('financial-setting-max-connection-field')).toHaveValue(financialData.maxConnection);
    // Verify the selected Retrieve Transaction Type button is highlighted/selected.
    const retrieveTransactionBtn = page.getByTestId('retrive-transaction-type').getByRole('button', { name: financialData.retriveTransactionType });
    await expect(retrieveTransactionBtn).toHaveClass(/bg-primary-400/);
    // Verify Minimum Required Document input value.
    await expect(page.getByTestId('fin-min-required-doc')).toHaveValue(financialData.minDoc);
    console.log('Verified core financial settings.');


    // Loop through each document configuration to verify details.
    for (let index = 0; index < financialData.docs.length; index++) {
        const element = financialData.docs[index];

        const bankDocForm = page.getByTestId(`${element.testid}-doc`);
        console.log(`Verifying document: ${element.docType}`);

        // Verify Visibility setting.
        const visibilityInput = bankDocForm.getByTestId(`doc-${element.testid}-visibility`);
        await expect(visibilityInput.getByTestId(`doc-${element.testid}-visibility-tags`)).toContainText(element.visibility);

        // Verify Policy setting.
        const policyInput = bankDocForm.getByTestId(`doc-${element.testid}-policy`);
        await expect(policyInput.getByTestId(`doc-${element.testid}-policy-tags`)).toContainText(element.policy);

        // Verify Max Upload setting.
        const docMaxInput = bankDocForm.getByTestId(`doc-${element.testid}-max`);
        await expect(docMaxInput).toHaveValue(element.maxUpload);
        console.log(`Document ${element.docType} details verified.`);
    }
    console.log(`Completed detailed verification of Financial Step data.`);
}

/**
 * Fills the Financial Verification step configuration modal with the provided data.
 *
 * @param {import('@playwright/test').Page} page - The Playwright Page object.
 * @param {object} financialData - The configuration data to fill.
 */
async function fillFinancialStep(page, financialData) {
    console.log('Filling Financial Step form fields.');
    // Fill Primary and Secondary Provider multiselects.
    await fillMultiselect(page, page.getByTestId('financial-setting-primary-provider-field'), [financialData.primaryProvider]);
    await fillMultiselect(page, page.getByTestId('financial-setting-secondary-provider-field'), [financialData.secondaryProvider]);
    // Fill Max Connection and Minimum Required Document fields.
    await page.getByTestId('financial-setting-max-connection-field').fill(financialData.maxConnection);
    // Click the correct Retrieve Transaction Type button.
    await page.getByTestId('retrive-transaction-type').getByRole('button', { name: financialData.retriveTransactionType }).click();
    await page.getByTestId('fin-min-required-doc').fill(financialData.minDoc);
    console.log('Filled core financial settings.');


    // Loop through and configure each document type.
    for (let index = 0; index < financialData.docs.length; index++) {
        const element = financialData.docs[index];
        const bankDocForm = page.getByTestId(`${element.testid}-doc`);

        // Add the document type if it's not an update operation.
        if (element.action !== 'update') {
            await fillMultiselect(page, page.getByTestId('document-type'), [element.docType]);
            await page.getByTestId('document-type-add-btn').click();
            console.log(`Added new document type: ${element.docType}`);
        }

        // Fill Visibility, Policy, and Max Upload settings for the document.
        await fillMultiselect(page, bankDocForm.getByTestId(`doc-${element.testid}-visibility`), element.visibility);
        await page.waitForTimeout(200);
        await fillMultiselect(page, bankDocForm.getByTestId(`doc-${element.testid}-policy`), [element.policy]);
        await bankDocForm.getByTestId(`doc-${element.testid}-max`).fill(element.maxUpload);
        console.log(`Configured document details for: ${element.docType}`);
    }
}

/**
 * Navigates from the applications list to the application edit page,
 * waiting for all necessary API responses to confirm the page has loaded completely.
 *
 * @param {import('@playwright/test').Page} page - The Playwright Page object.
 * @param {import('@playwright/test').Locator} appEditBtn - The locator for the edit button.
 * @param {string} applicationId - The ID of the application being edited.
 * @returns {object} An object containing the awaited API responses.
 */
async function gotoApplicationEdit(page, appEditBtn, applicationId) {
    console.log(`Navigating to edit application ID: ${applicationId}`);
    // Set up promises to wait for all critical API calls that happen on load/edit click.
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

    // Click the edit button to trigger navigation and API calls.
    await appEditBtn.click()

    // Wait for all promises to resolve, confirming the page is fully loaded.
    const [createResponse, organizationsResponse, portfoliosResponse, settingsResponse, applicationResponse] = await Promise.all([
        createResponsePromise,
        organizationsResponsePromise,
        portfoliosResponsePromise,
        settingsResponsePromise,
        applicationResponsePromise
    ]);
    console.log('Application edit page fully loaded (all critical APIs responded).');

    return {
        createResponse,
        organizationsResponse,
        portfoliosResponse,
        settingsResponse,
        applicationResponse
    }

}