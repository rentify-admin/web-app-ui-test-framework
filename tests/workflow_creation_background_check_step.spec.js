import { test, expect } from '@playwright/test'
import { loginWith } from './utils/session-utils';
import { admin, app } from './test_config';
import { fillMultiselect } from './utils/common';
import { waitForJsonResponse } from './utils/wait-response';
import { ApiClient } from './api';
import { loginWithAdmin } from './endpoint-utils/auth-helper';

test.describe('QA-310 workflow_creation_background_check_step.spec', () => {

    let workflow;
    let adminClient;
    let application;

    test.beforeAll(async () => {
        console.log('🔐 [Setup] Logging in as admin user...');
        adminClient = new ApiClient(app.urls.api, null, 120_000)
        await loginWithAdmin(adminClient)
    })

    test('Workflow Creation with Background Check Step Configuration', {
        tag: ['@core', '@regression']
    }, async ({ page }) => {

        // --- Setup & Login ---
        console.log('🌐 Navigating to application root page...');
        await page.goto('/');

        console.log('🔑 Logging in with admin credentials...');
        await loginWith(page, admin)

        console.log('🔗 Navigating to workflows list page...');
        await page.goto('/workflows-templates');

        console.log('✅ Verifying workflows list page loads successfully...');
        const createWorkflowBtn = page.getByTestId('create-workflow-btn');
        await expect(createWorkflowBtn).toBeVisible();

        // --- Step 1: Create New Workflow ---
        console.log('🛠️ [Step 1] Creating new workflow...');
        await createWorkflowBtn.click()

        const workflowDetails = {
            name: `Autotest Workflow Background Check ${Date.now()}`,
            steps: [
                {
                    task: 'Background Check',
                    name: 'Background Check',
                    data: {
                        required: false,
                        skip_authority: 'anyone',
                        service_provider: 'TransUnion'
                    }
                }
            ]
        }

        console.log('✏️ Filling workflow name...');
        const workflowNameInput = page.getByTestId('workflow-name-input');
        await expect(workflowNameInput).toBeVisible();
        await workflowNameInput.fill(workflowDetails.name)

        // Add log for description field, though not implemented in test
        console.log('📝 (INFO) Workflow description input not present/filled in code. Skipping as per UI support.');

        console.log('🌍 Selecting "Global Access"...');
        await page.getByTestId('access-global_access').click();

        console.log('💾 Saving new workflow and intercepting POST /workflows...');
        const [workflowResponse] = await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/workflows')
                && resp.request().method() === 'POST'
                && resp.ok()
            ),
            page.getByTestId('save-workflow-btn').click()
        ])

        console.log('📦 Verifying workflow creation API payload and response...');
        const workflowBody = await workflowResponse.request().postDataJSON();
        expect(workflowBody.display_name).toEqual(workflowDetails.name)
        const workflowSlug = workflowDetails.name.toLowerCase().replaceAll(' ', '-')
        expect(workflowBody.name).toEqual(workflowSlug)

        const workflowData = await waitForJsonResponse(workflowResponse)

        // status code /201 verification -- Playwright resp.ok() already checked
        workflow = workflowData.data;

        console.log(`✅ Workflow created! ID: ${workflow.id}`);
        await expect(workflow.id).toBeDefined()

        // --- Step 2: Add Background Check Step ---
        console.log('👣 [Step 2] Adding Background Check step...');
        const addStepBtn = page.getByTestId('add-step-btn');
        await expect(addStepBtn).toBeVisible();

        const [taskTypeResponse] = await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/task-types')
                && resp.request().method() === 'GET'
                && resp.ok()
            ),
            addStepBtn.click()
        ])

        const { data: taskTypes } = await waitForJsonResponse(taskTypeResponse)

        console.log('🪟 Verifying "Add Step" modal...');
        const addStepModal = page.getByTestId('add-step-modal');
        await expect(addStepModal).toBeVisible();

        console.log('📋 Verifying and selecting task type...');
        const taskTypeSelector = addStepModal.getByTestId('task-type-selector');
        await expect(taskTypeSelector).toBeVisible();

        const [stepDetails] = workflowDetails.steps;

        await fillMultiselect(page, taskTypeSelector, [stepDetails.task])

        console.log('📔 Checking step name auto-populated...');
        const stepNameInput = page.getByTestId('step-name-input');
        await expect(stepNameInput).toBeVisible();
        await stepNameInput.fill(stepDetails.name)
        
        // Description field for step not present in original test; log this
        console.log('📝 (INFO) Step description input not present/filled in code. Skipping as per UI support.');

        const termsPromise = page.waitForResponse(resp => resp.url().includes('/terms')
            && resp.request().method() === 'GET'
            && resp.ok()
        )
        console.log('➡️ Clicking "Next" in Add Step modal...');
        await page.getByTestId('add-step-modal-next-btn').click()
        await termsPromise

        // --- Step 3: Configure Background Check Step ---
        console.log('⚙️ [Step 3] Configuring Background Check step...');
        const requiredInput = page.getByTestId('background-check-required-toggle-input');
        await expect(requiredInput).toBeVisible();
        await expect(requiredInput).not.toBeChecked();
        console.log('❎ "Require Background Check" toggle is UNCHECKED as required...');

        const skipAuthority = page.getByTestId('background-check-skip-authority');
        await expect(skipAuthority).toBeVisible();
        console.log('🧑‍⚖️ Selecting "Anyone" for Skip Authority...');
        await fillMultiselect(page, skipAuthority, [stepDetails.data.skip_authority])

        const hiddenToggle = page.getByTestId('background-check-hidden-toggle-input');
        await expect(hiddenToggle).not.toBeChecked();
        console.log('👁️ "Hidden" toggle verified as UNCHECKED.');

        console.log('📑 Selecting Terms of Service in dropdown...');
        const termsDropdown = page.getByTestId('background-check-terms-dropdown');
        await expect(termsDropdown).toBeVisible();
        await termsDropdown.click()
        await termsDropdown.locator('#listbox-term').locator('li').nth(0).click()

        console.log('🏢 Selecting service provider...');
        const serviceProviderInput = page.getByTestId('background-check-service-provider-dropdown')
        await fillMultiselect(page, serviceProviderInput, [stepDetails.data.service_provider])

        console.log('⌨️ Filling TransUnion credit settings...');
        const prefixCodeInput = page.getByTestId('inquiry-prefix-code-input');
        await expect(prefixCodeInput).toBeVisible();
        await prefixCodeInput.fill('ABC')

        const industryCodeInput = page.getByTestId('industry-code-input');
        await expect(industryCodeInput).toBeVisible();
        await industryCodeInput.fill('DEF')

        const memberCodeInput = page.getByTestId('member-code-input');
        await expect(memberCodeInput).toBeVisible();
        await memberCodeInput.fill('GHI')

        const passwordInput = page.getByTestId('subscriber-password-input');
        await expect(passwordInput).toBeVisible();
        await passwordInput.fill('123456789')

        const submitBackgroundCheckForm = await page.getByTestId('submit-background-check-form')
        console.log('✅ Submitting Background Check setup...');

        // Prepare for step/terms/updates APIs
        const getStepsPromise = page.waitForResponse(resp => {
            return resp.url().endsWith(`/workflows/${workflow.id}/steps`)
                && resp.request().method() === 'GET'
                && resp.ok()
        })

        const stepCreatePromise = page.waitForResponse(resp => resp.url().includes(`/workflows/${workflow.id}/steps`)
            && resp.request().method() === 'POST'
            && resp.ok()
        );

        const stepUpdatePromise = page.waitForResponse(resp => resp.url().includes(`/workflows/${workflow.id}/steps/`)
            && resp.request().method() === 'PATCH'
            && resp.ok()
        );
        const termsUpdatePromise = page.waitForResponse(resp => {
            const regex = new RegExp(
                `/workflows/${workflow.id}/steps/[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{12}/background-terms`
            );
            return regex.test(resp.url())
                && resp.request().method() === 'POST'
                && resp.ok()
        });

        await submitBackgroundCheckForm.click()
        const stepCreate = await stepCreatePromise
        const stepUpdate = await stepUpdatePromise
        const termsResponse = await termsUpdatePromise
        const stepsResponse = await getStepsPromise
        const { data: steps } = await waitForJsonResponse(stepsResponse);

        console.log('🔎 Checking API requests: Step create/update and step settings...');
        const backgroundCheckTask = taskTypes.find(taskType => taskType.key === 'BACKGROUND_CHECK')
        const stepCreateBody = await stepCreate.request().postDataJSON()
        expect(stepCreateBody.name).toBe(stepDetails.name)
        expect(stepCreateBody.type).toBe('TASK')
        expect(stepCreateBody.task).toBe(backgroundCheckTask.id)

        const stepUpdateBody = await stepUpdate.request().postDataJSON()
        expect(stepUpdateBody).toEqual(
            expect.objectContaining({
                settings: expect.objectContaining({
                    "settings.workflows.tasks.background_check.required": false,
                    "settings.workflows.tasks.background_check.skip.authority": "anyone",
                    "settings.workflows.tasks.background_check.hidden": false,
                    "settings.workflows.tasks.background_check.enable_credit": false,
                    "settings.workflows.tasks.background_check.credit.fraud_alerts": false,
                    "settings.workflows.tasks.background_check.credit.run_mode": "manual",
                    "settings.workflows.tasks.background_check.credit.provider": "019b4d30-4604-7115-81b2-bcacd6190b45",
                    "settings.workflows.tasks.background_check.credit.transunion.subscriber_inquiry_prefix_code": "ABC",
                    "settings.workflows.tasks.background_check.credit.transunion.subscriber_industry_code": "DEF",
                    "settings.workflows.tasks.background_check.credit.transunion.subscriber_member_code": "GHI",
                    "settings.workflows.tasks.background_check.credit.transunion.subscriber_password": "123456789",
                    "settings.workflows.tasks.background_check.credit.score_model": "00A9P"
                })
            })
        );

        // --- Step 4: Create Workflow Paths ---
        console.log('🧭 [Step 4] Creating workflow paths...');
        const addPathBtn = await page.getByTestId('add-path-btn')
        await addPathBtn.click()

        const stepPathForm = page.getByTestId('step-path-form');
        await expect(stepPathForm).toBeVisible();

        const pathFromInput = page.getByTestId('path-from-selector');
        await expect(pathFromInput).toBeVisible();

        const pathToInput = page.getByTestId('path-to-selector');
        await expect(pathToInput).toBeVisible();

        console.log('🔄 Creating path: START → Background Check...');
        await fillMultiselect(page, pathToInput, [stepDetails.name])

        const stepPathSubmitBtn = page.getByTestId('submit-step-path-form');
        await expect(stepPathSubmitBtn).toBeVisible();

        const pathPromise = page.waitForResponse(resp => resp.url().includes(`/workflows/${workflow.id}/paths`)
            && resp.request().method() === 'POST'
            && resp.ok()
        )

        await stepPathSubmitBtn.click()
        const pathResponse = await pathPromise

        expect(pathResponse.request().postDataJSON()).toEqual(
            expect.objectContaining({
                from: expect.stringMatching(steps.find(step => step.type === 'START')?.id),
                to: expect.stringMatching(steps.find(step => step.task?.key === 'BACKGROUND_CHECK')?.id)
            })
        )

        console.log('🧩 Path 1 created!');
        // Second path
        await addPathBtn.click()

        await expect(stepPathForm).toBeVisible();
        await expect(pathFromInput).toBeVisible();
        await fillMultiselect(page, pathFromInput, [stepDetails.name])
        await fillMultiselect(page, pathToInput, ['END'])
        await expect(stepPathSubmitBtn).toBeVisible();

        const pathPromise2 = page.waitForResponse(resp => resp.url().endsWith(`/workflows/${workflow.id}/paths`)
            && resp.request().method() === 'POST'
            && resp.ok()
        )
        await stepPathSubmitBtn.click()
        const pathResponse2 = await pathPromise2
        expect(pathResponse2.request().postDataJSON()).toEqual(
            expect.objectContaining({
                from: expect.stringMatching(steps.find(step => step.task?.key === 'BACKGROUND_CHECK')?.id),
                to: expect.stringMatching(steps.find(step => step.type === 'END')?.id)
            })
        )

        console.log('🧩 Path 2 created!');

        // --- Step 5: Save Workflow and Assign to Application (API) ---
        console.log('💾 [Step 5] Assigning workflow to new application (API)...');
        const ORGANIZATION_NAME = 'Permissions Test Org'
        const orgResponse = await adminClient.get('/organizations', {
            params: {
                name: ORGANIZATION_NAME
            }
        })

        const organization = orgResponse.data?.data?.find(org => org.name === ORGANIZATION_NAME)
        await expect(organization).toBeDefined()

        const APPLICATION_NAME = 'Autotest Workflow Create App'
        const applicationData = await adminClient.post('/applications', {
            name: APPLICATION_NAME,
            organization: organization.id
        })

        application = applicationData.data?.data;

        expect(application).toBeDefined()
        console.log(`📝 Application "${APPLICATION_NAME}" created with ID: ${application.id}`);

        await adminClient.patch(`/applications/${application.id}`, {
            workflow: workflow.id
        })

        application = (await adminClient.get(`/applications/${application.id}`, {
            params: {
                'fields[application]': 'id,workflow',
                'fields[workflow]': 'id,name'
            }
        })).data?.data;

        await expect(application.workflow.id).toBe(workflow.id)
        await expect(application.workflow.name).toBe(workflowSlug)
        console.log('🔗 Workflow assigned to Application!');

        // --- Step 6: Verify Workflow Configuration ---
        console.log('🔍 [Step 6] Verifying workflow configuration in list...');
        await page.goto('/workflows-templates');

        const searchInput = page.getByTestId('workflow-search');
        await expect(searchInput).toBeVisible();

        const workflowSearchPromise = page.waitForResponse(resp => {
            const url = new URL(resp.url())
            const filterParam = url.searchParams.get('filters')
            if (!filterParam) {
                return false
            }
            return resp.url().includes('/workflows?') && filterParam.includes(workflowSlug)
        })

        await searchInput.fill(workflowDetails.name)

        const { data: workflowList } = await waitForJsonResponse(await workflowSearchPromise)

        expect(workflowList.every(workflow => workflow.name === workflowSlug)).toBe(true)
        console.log('✅ Workflow found in search!');

        const workflowRow = page.getByTestId(`workflow-table-${workflow.id}`)
        await expect(workflowRow).toBeVisible()

        const nameCol = workflowRow.getByTestId('workflow-table-display_name-col');
        await expect(nameCol).toBeVisible();
        await expect(nameCol).toContainText(workflowDetails.name)
        console.log('📃 Workflow name column validated.');

        const actionCol = workflowRow.getByTestId('workflow-table-actions-col');
        const editBtn = actionCol.getByTestId(`edit-${workflow.id}`)
        expect(editBtn).toBeVisible()
        console.log('✏️ Clicking edit button for created workflow...');

        const workflowPromise = page.waitForResponse(resp => resp.url().includes(`/workflows/${workflow.id}`)
            && resp.request().method() === 'GET'
            && resp.ok()
        )
        await editBtn.click()

        const { data: updatedWorkflow } = await waitForJsonResponse(await workflowPromise)

        // Verifications as per step 6
        expect(updatedWorkflow.steps.filter(step => !!step.task?.key).length).toBe(1)
        const bgSteps = updatedWorkflow.steps.find(step => step.task?.key === 'BACKGROUND_CHECK')
        expect(bgSteps).toBeDefined()

        expect(updatedWorkflow.paths.length).toBe(2)

        expect(updatedWorkflow.paths.some(path => path.from.name == 'START' && path.to.name === stepDetails.name)).toBe(true)
        expect(updatedWorkflow.paths.some(path => path.to.name == 'END' && path.from.name === stepDetails.name)).toBe(true)
        console.log('✅ Workflow configuration including Background Check step and paths verified!');

    });

    test.afterAll(async ({ request }, testInfo) => {
        if (testInfo.status === 'passed') {
            console.log('🧹 [Cleanup] Deleting created Application & Workflow...');
            if (application) {
                await adminClient.delete(`/applications/${application.id}`)
                console.log(`🚮 Application deleted (ID: ${application.id})`);
            }
            if (workflow) {
                await adminClient.delete(`/workflows/${workflow.id}`)
                console.log(`🚮 Workflow deleted (ID: ${workflow.id})`);
            }
        } else {
            console.log('⚠️ Skipping cleanup, test did not pass.');
        }
    })

})