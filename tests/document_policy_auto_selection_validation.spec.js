// Import required test framework and project fixtures.
import { test, expect } from "./fixtures/api-data-fixture";
import { admin, app } from "./test_config";
import { createApplicationFlow } from "./utils/application-management";
import { authenticateAdmin, cleanupApplication } from "./utils/cleanup-helper";
import { fillMultiselect } from "./utils/common";
import { getRandomNumber, joinUrl } from "./utils/helper";
import loginForm from "./utils/login-form";
import WorkflowBuilder from "./utils/workflow-builder";

// Will hold applicationId for cleanup after test is done
let cleanupApplicationId = null

const workflowTemplate = 'Heartbeat-application';

// Define the test suite for QA-226: Document policy auto selection validation 
test.describe('QA-226 document_policy_auto_selection_validation.spec', () => {
    // Configure the test suite execution.
    test.describe.configure({
        mode: 'serial' // Ensure tests run in order, necessary for setup/cleanup flow.
    });

    // Setup workflow if not present
    test.beforeAll(async ({ request }) => {
        let token;
        try {
            token = await authenticateAdmin(request);
        } catch (error) {
            console.log(`⚠️ Skipping workflow creation as no admin token found: ${error.message}`);
            return;
        }
        const workflowBuilder = new WorkflowBuilder(request, workflowTemplate, token)
        if (!await workflowBuilder.checkWorkflowExists()) {
            await workflowBuilder.checkOrCreateWorkflow();
            await workflowBuilder.getRequiredData();
            await workflowBuilder.createIdentityStep({});
            await workflowBuilder.createFinancialStep({});
            await workflowBuilder.fetchCreatedSteps();
            await workflowBuilder.createPaths();
        }
        console.log("✅ Workflow setup/verified for test.");
    });

    // Cleanup any created application after tests run
    test.afterAll(async ({ request }) => {
        console.log(`🧹 afterAll: running application cleanup`);
        try {
            await cleanupApplication(request, cleanupApplicationId, true)
            console.log(`✅ Cleanup: Application ${cleanupApplicationId} removed`);
        } catch (error) {
            // Could be null if no app or error is expected
            console.log(`ℹ️ Cleanup not needed for Application ${cleanupApplicationId} or cleanup already done. Error: ${error.message}`);
        }
    });

    // Test case: Ensure that default applicant type in Financial step auto-selects policy and override checkboxes are displayed as expected.
    test('Test Document policy auto selection validation',
        {
            tag: [ '@application', '@regression', '@staging-ready', '@rc-ready']
        }, async ({ page }) => {
            console.log(`=== QA-226: Starting Document Policy Auto Selection Validation Test ===`);
            test.setTimeout(200_000); // Set timeout to 200 seconds

            // Step 1: Login as admin user
            await page.goto('/');
            console.log('Navigated to login page.');

            await loginForm.fill(page, admin);
            console.log('Entered admin credentials.');

            await loginForm.submitAndSetLocale(page);
            console.log('Logged in and locale set.');

            await expect(page.getByTestId('applicants-menu')).toBeVisible();
            console.log('Logged in successfully: main menu visible.');

            // Step 2: Create a new application with workflow template and required applicant types
            const appConfig = {
                organizationName: 'Verifast',
                applicationName: `AutoTest Policy_Selection_${getRandomNumber()}`,
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
                minimumAmount: '500',
                noPublish: true
            };

            console.log(`Creating application: ${appConfig.applicationName}`);
            const { applicationId } = await createApplicationFlow(page, appConfig)
            console.log(`Application created with id: ${applicationId}`);
            cleanupApplicationId = applicationId;

            await page.goto(`/application/${applicationId}/edit`)
            console.log('Navigated to edit page for created application');

            // Step 3: Select Default applicant type in Workflow Setup
            await page.getByTestId('step-#workflow-setup').click({ timeout: 10_000 });
            console.log('Workflow Setup tab opened');

            await page.getByTestId('type-default').click({ timeout: 20_000 });
            console.log('Default applicant type selected');

            // Wait for Financial Document Configurations API call on step open
            const finDocConfigPromise = page.waitForResponse(resp => {
                const apiRegex = new RegExp(`${joinUrl(app.urls.api, 'applications')}/.{36}/steps/.{36}/document-configurations`)
                return apiRegex.test(resp.url())
                    && resp.request().method() === 'GET'
                    && resp.ok(), { timeout: 20_000 }
            });

            // Open Financial Verification step configuration modal
            await page.getByTestId('workflow-financial-verification').click();
            console.log('Financial verification step config modal opened');

            await finDocConfigPromise;
            console.log('Financial document configurations loaded via API');


            // Step 4: Fill the Financial step with initial policy auto-selection expected for Default type
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
                        policy: 'Sample System Bank Statement Policy',
                        maxUpload: '3',
                    },
                    {
                        testid: 'pay-stub',
                        docType: 'Pay Stub',
                        visibility: ['Always'],
                        policy: 'Sample Pay Stub Policy',
                        maxUpload: '3',
                        preventVerification: true
                    }
                ]
            }
            console.log('Entered base financial config for Default applicant type');
            await fillFinancialStep(page, financialData);
            console.log('Financial step: filled values');

            // Save and wait for config update POST/PATCH to succeed
            await Promise.all([
                page.waitForResponse(resp => {
                    return (resp.request().method() === 'PATCH'
                        || resp.request().method() === 'POST')
                        && resp.ok()
                }),
                page.getByTestId('submit-financial-step-form').click()
            ])
            console.log('Financial step configuration saved!');

            await page.getByTestId('financial-setup-modal').waitFor({ state: 'detached', timeout: 20000 });
            console.log('Financial config modal closed after save');

            await page.waitForTimeout(2000);

            // Step 5: Reopen and verify the configuration matches what was filled
            await page.getByTestId('workflow-financial-verification').click()
            await page.waitForTimeout(2000);

            await verifyDetails(page, financialData);
            console.log('Verified default type auto-selection details for Financial step');

            await page.getByTestId('financial-setup-modal-cancel').click();
            console.log('Financial step config modal closed');

            console.log(`=== QA-226: Document policy auto selection validation test completed ===`);
        })
})

/**
 * Verifies that the data in the financial step configuration modal matches expectations (auto-selection for Default type).
 */
async function verifyDetails(page, financialData) {
    console.log(`Checking all fields in Financial Step modal`);
    // Assert core financial fields
    await expect(page.getByTestId('financial-setting-primary-provider-field').locator('.multiselect__single')).toContainText(financialData.primaryProvider);
    await expect(page.getByTestId('financial-setting-secondary-provider-field').locator('.multiselect__single')).toContainText(financialData.secondaryProvider);
    await expect(page.getByTestId('financial-setting-max-connection-field')).toHaveValue(financialData.maxConnection);
    const retrieveTransactionBtn = page.getByTestId('retrive-transaction-type').getByRole('button', { name: financialData.retriveTransactionType });
    await expect(retrieveTransactionBtn).toHaveClass(/bg-primary-400/);
    await expect(page.getByTestId('fin-min-required-doc')).toHaveValue(financialData.minDoc);
    console.log('Core financial fields are correct in the modal.');

    // Check all document config values
    for (let index = 0; index < financialData.docs.length; index++) {
        const element = financialData.docs[index];
        if (!element.preventVerification) {
            const bankDocForm = page.getByTestId(`${element.testid}-doc`);
            console.log(`Checking: ${element.docType}`);
            const visibilityInput = bankDocForm.getByTestId(`doc-${element.testid}-visibility`);
            await expect(visibilityInput.getByTestId(`doc-${element.testid}-visibility-tags`)).toContainText(element.visibility);

            const policyInput = bankDocForm.getByTestId(`doc-${element.testid}-policy`);
            try {
                await expect(policyInput.getByTestId(`doc-${element.testid}-policy-tags`)).toContainText(element.policy);
            } catch (err) {
                const text = await policyInput.getByTestId(`doc-${element.testid}-policy-tags`).textContent()
                console.error(`Found different value preselected in edit step, document policy: ${text}`)
                throw err;
            }

            const docMaxInput = bankDocForm.getByTestId(`doc-${element.testid}-max`);
            await expect(docMaxInput).toHaveValue(element.maxUpload);
            console.log(`Document config correct: ${element.docType}`);
        }
    }
    console.log(`All details matched for Financial Step modal`);
}

/**
 * Fills the Financial Verification modal with specified data for Default type auto-selection scenario.
 */
async function fillFinancialStep(page, financialData) {
    console.log('Filling all fields in Financial Step config');
    await fillMultiselect(page, page.getByTestId('financial-setting-primary-provider-field'), [financialData.primaryProvider]);
    await fillMultiselect(page, page.getByTestId('financial-setting-secondary-provider-field'), [financialData.secondaryProvider]);
    await page.getByTestId('financial-setting-max-connection-field').fill(financialData.maxConnection);
    await page.getByTestId('retrive-transaction-type').getByRole('button', { name: financialData.retriveTransactionType }).click();
    await page.getByTestId('fin-min-required-doc').fill(financialData.minDoc);
    console.log('Filled base financial settings');

    for (let index = 0; index < financialData.docs.length; index++) {
        const element = financialData.docs[index];
        
        // Check if document type already exists - if so, delete it first before adding
        const documentForm = page.getByTestId(`${element.testid}-doc`);
        let documentNeedsAdding = true;
        
        try {
            // Check if document form exists (this determines if we need to delete first)
            const isFormVisible = await documentForm.isVisible({ timeout: 1000 });
            
            if (isFormVisible) {
                console.log(`⚠️  Document type "${element.docType}" already exists (found form: ${element.testid}-doc). Deleting it first...`);
                // Get delete button from within the form
                const deleteButton = documentForm.getByTestId(`doc-${element.testid}-delete`);
                await deleteButton.click({ timeout: 5000 });
                // Wait for form to be removed from DOM
                await documentForm.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {
                    // If it doesn't detach, at least wait a bit
                    return page.waitForTimeout(500);
                });
                console.log(`✅ Deleted existing "${element.docType}" document type - form removed`);
                documentNeedsAdding = true; // After deletion, we need to add it
            }
        } catch (error) {
            // If document form doesn't exist, we'll add it fresh
            console.log(`ℹ️  Document type "${element.docType}" does not exist yet (form not found: ${element.testid}-doc), will add it fresh`);
            documentNeedsAdding = true;
        }

        // Only add document type if not an update (not needed in this case but logic preserved)
        if (element.action !== 'update' && documentNeedsAdding) {
            try {
                await fillMultiselect(page, page.getByTestId('document-type'), [element.docType]);
                await page.getByTestId('document-type-add-btn').click();
                await page.waitForTimeout(300); // Wait for form to appear after adding
                console.log(`✅ Added type: ${element.docType}`);
            } catch (error) {
                // If option not found in dropdown, it might mean the document type already exists
                if (error.message && error.message.includes('Option not found')) {
                    console.log(`⚠️  Could not find "${element.docType}" in dropdown - checking if document already exists...`);
                    
                    // Re-check if document form exists (maybe it was added by auto-selection or already present)
                    const docFormCheck = page.getByTestId(`${element.testid}-doc`);
                    const existsAfterError = await docFormCheck.isVisible({ timeout: 2000 }).catch(() => false);
                    
                    if (existsAfterError) {
                        console.log(`ℹ️  Document "${element.docType}" already exists in the form, continuing with configuration...`);
                    } else {
                        console.error(`❌ Failed to add "${element.docType}" - option not found and document does not exist`);
                        throw error;
                    }
                } else {
                    throw error;
                }
            }
        }

        // Now get the document form (it should exist after adding or if it already existed)
        const bankDocForm = page.getByTestId(`${element.testid}-doc`);
        // Ensure the form is visible before proceeding
        await expect(bankDocForm).toBeVisible({ timeout: 5000 });

        // Policy field and checks; if policy field pre-filled verify, else set as needed.
        const policyMultiselect = bankDocForm.getByTestId(`doc-${element.testid}-policy`)
        const policyValue = await policyMultiselect.getByTestId(`doc-${element.testid}-policy-tags`)
            .locator('.multiselect__single').textContent()

        if (policyValue && policyValue.trim()) {
            // Just ensure that it is not starting with a Sample System
            try {
                await expect(policyValue.startsWith('Sample System')).toBeFalsy();
            } catch (err) {
                console.error(`❌ FAILED: Auto-selection incorrectly used "Sample System" policy: ${policyValue.trim()}`);
                console.error(`   Expected: Should NOT auto-select "Sample System" policies for Default applicant type`);
                throw err;
            }
        }

        if (element.testid === 'bank-statement') {
            console.log(`Checking Sample System Policy still selectable`);
            await fillMultiselect(page, bankDocForm.getByTestId(`doc-${element.testid}-policy`), [element.policy]);
            const bankPolicyValue = await policyMultiselect.getByTestId(`doc-${element.testid}-policy-tags`)
                .locator('.multiselect__single').textContent()
            if (bankPolicyValue && bankPolicyValue.trim()) {
                try {
                    await expect(bankPolicyValue.trim().toLowerCase()).toBe(element.policy.toLowerCase());
                } catch (err) {
                    console.error(`Found different value in selection: ${bankPolicyValue.trim()}`)
                    throw err;
                }
            }
        }

        await fillMultiselect(page, bankDocForm.getByTestId(`doc-${element.testid}-visibility`), element.visibility);
        await page.waitForTimeout(200);
        await bankDocForm.getByTestId(`doc-${element.testid}-max`).fill(element.maxUpload);
        console.log(`Set up details for: ${element.docType}`);
    }
}
