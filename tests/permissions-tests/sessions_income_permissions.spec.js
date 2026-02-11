import { test, expect } from '@playwright/test';
import { ApiClient, ApplicationApi, GuestApi, OrganizationApi, ProviderApi, RoleApi, SessionApi } from '../api';
import { admin, app, session as sessionConf } from '../test_config';
import { loginWithAdmin } from '../endpoint-utils/auth-helper';
import { getRandomEmail } from '../utils/helper';
import { createCurrentStep, loginWithGuestUser, simulateVerification, waitForStepTransition } from '../endpoint-utils/session-helpers';
import getPaystubVeridocsSimulation from '../test_files/mock_data/paystub-simulator';
import { customVeriDocsBankStatementData } from '../mock-data/bank-statement-veridocs-payload';
import loginForm from '../utils/login-form';
import { openReportSection } from '../utils/report-page';
import { waitForJsonResponse } from '../utils/wait-response';

const { STEP_KEYS } = sessionConf;

const adminClient = new ApiClient(app.urls.api, null, 120_000);
const guestClient = new ApiClient(app.urls.api, null, 120_000);
const externalClient = new ApiClient(app.urls.api, null, 120_000);

const organizationApi = new OrganizationApi(adminClient);
const roleApi = new RoleApi(adminClient);
const applicationApi = new ApplicationApi(adminClient);
const sessionApi = new SessionApi(adminClient);
const providerApi = new ProviderApi(adminClient);
const guestApi = new GuestApi(guestClient);


test.describe('QA-299 sessions_income_permissions.spec', () => {
    test.setTimeout(210_000);
    let createdSessionId;
    let createdMember;
    let createdUser;
    let adminOrganization;
    const ROLE = 'Autotest - Internal Role'
    const APPLICATION_NAME = 'AutoTest - Simulation financial employment';

    const user = {
        first_name: 'AutoTest',
        last_name: 'Applicant',
        email: getRandomEmail(),
        invite: true
    }

    const externalUser = {
        first_name: 'AutoTest',
        last_name: 'Permissions',
        email: getRandomEmail(),
        password: 'password'
    };

    test.beforeAll(async () => {

        await loginWithAdmin(adminClient);

        const organizationData = await organizationApi.retrive('self', { fields: 'id,name' });
        adminOrganization = organizationData.data;

        const role = await roleApi.getOrCreateByName(ROLE);

        const application = await applicationApi.getByName(APPLICATION_NAME);

        user.application = application.id;

        const sessionData = await sessionApi.create(user);
        let session = sessionData.data;
        createdSessionId = session.id;

        expect(session).toBeDefined();

        await loginWithGuestUser(guestClient, session.url);

        // await getGuestUser();

        await guestApi.update('self', { administrative_area: "AL", country: "US" })

        session = (await sessionApi.retrive(session.id)).data;

        const provider = await providerApi.getByName('Simulation');

        if (session.state.current_step.type === STEP_KEYS.START) {
            console.log('📄 Starting START step...');
            const sessionStep = await createCurrentStep(sessionApi, session);

            // update rent budget
            await sessionApi.update(session.id, { target: 2500 })

            const stepUpdateData = { status: "COMPLETED" };
            await sessionApi.step(session.id).update(sessionStep.id, stepUpdateData);

            console.log('✅ START step completed.');
            session = await waitForStepTransition(sessionApi, session, STEP_KEYS.START);
            console.log('✅ Session transitioned from START step.');
        }

        if (session.state.current_step?.task?.key === STEP_KEYS.FINANCIAL) {
            const type = 'financial';
            console.log(`📄 Starting ${STEP_KEYS.FINANCIAL} step...`);
            const sessionStep = await createCurrentStep(sessionApi, session);

            const docSimulationData = {
                simulation_type: 'VERIDOCS_PAYLOAD',
                custom_payload: customVeriDocsBankStatementData(user, 3, 'biweekly', 3)
            }
            await simulateVerification(guestClient, '/financial-verifications', provider, sessionStep, docSimulationData, type);

            // For delisted income source test. adding duplicate statement data
            await simulateVerification(guestClient, '/financial-verifications', provider, sessionStep, docSimulationData, type);


            const stepUpdateData = { status: "COMPLETED" };
            await sessionApi.step(session.id).update(sessionStep.id, stepUpdateData);
            console.log(`✅ ${STEP_KEYS.FINANCIAL} step completed.`);
            session = await waitForStepTransition(sessionApi, session, STEP_KEYS.FINANCIAL);
            console.log(`✅ Session transitioned from ${STEP_KEYS.FINANCIAL} step.`);
        }

        if (session.state.current_step?.task?.key === STEP_KEYS.EMPLOYMENT) {
            const type = 'employment';
            console.log(`📄 Starting ${STEP_KEYS.EMPLOYMENT} step...`);
            const sessionStep = await createCurrentStep(sessionApi, session);

            const docData = getPaystubVeridocsSimulation(user);

            const docSimulationData = {
                simulation_type: 'VERIDOCS_PAYLOAD',
                custom_payload: { documents: [docData] }
            }
            await simulateVerification(guestClient, '/employment-verifications', provider, sessionStep, docSimulationData, type);

            const stepUpdateData = { status: "COMPLETED" };
            await sessionApi.step(session.id).update(sessionStep.id, stepUpdateData);
            console.log(`✅ ${STEP_KEYS.EMPLOYMENT} step completed.`);
            session = await waitForStepTransition(sessionApi, session, STEP_KEYS.EMPLOYMENT);
            console.log(`✅ Session transitioned from ${STEP_KEYS.EMPLOYMENT} step.`);
        }

        // Create 1 test user with base permissions: VIEW_SESSIONS + VIEW_ORGANIZATIONS only
        const memberResp = await adminClient.post(`/organizations/${adminOrganization.id}/members`, {
            first_name: externalUser.first_name,
            last_name: externalUser.last_name,
            email: externalUser.email,
            role: role.id
        });
        createdMember = memberResp.data?.data;
        createdUser = createdMember.user;
        const inviteToken = memberResp.headers['token'];

        console.log(`✅ Created external user with ID: ${createdUser.id} and email: ${createdUser.email}`);
        if (!inviteToken) {
            throw new Error('Invite token missing from member creation response');
        }
        console.log(`📧 [Setup] Got invite token for user registration`);

        // Bind permissions to member (VIEW_SESSIONS + Invite Applicant permission)
        // VIEW_SESSIONS is required to see applicants-menu in the sidebar
        console.log('🔐 [Setup] Binding permissions to member...');
        await adminClient.patch(`/organizations/${adminOrganization.id}/members/${createdMember.id}`, {
            permissions: [
                { name: 'view_sessions', bindings: [] },
                { name: 'view_organizations', bindings: [] }
            ]
        });
        console.log('✅ [Setup] Permissions bound: view_sessions, view_organizations');

        // Complete user registration using invite token
        console.log('👤 [Setup] Completing user registration with invite token...');
        const memberClient = new ApiClient(app.urls.api, null, 20000);
        const userResp = await memberClient.post('/users', {
            first_name: externalUser.first_name,
            last_name: externalUser.last_name,
            state: 'AK',
            terms: true,
            password: externalUser.password,
            password_confirmation: externalUser.password,
            token: inviteToken
        });
        if (userResp.status !== 201 && userResp.status !== 200) {
            throw new Error(`Unexpected status ${userResp.status} from /users registration`);
        }
        createdUser = userResp.data.data;
        console.log(`✅ [Setup] User registration completed: userId=${userResp.data.data.id}`);

    });

    test('Verify Sessions Income Permissions Validation', async ({ page }) => {

        console.log('[STEP 1] VIEW_SESSION_INCOME_SOURCES Permission - Positive Testing')
        await test.step('[STEP 1] VIEW_SESSION_INCOME_SOURCES Permission - Positive Testing', async () => {
            // Grant permission via API:PATCH /organizations/{id}/members/{memberId} with VIEW_SESSION_INCOME_SOURCES + VIEW_SESSIONS + VIEW_ORGANIZATIONS
            await adminClient.patch(`/organizations/${adminOrganization.id}/members/${createdMember.id}`, {
                permissions: [
                    { name: 'view_sessions', bindings: [] },
                    { name: 'view_organizations', bindings: [] },
                    { name: 'view_session_income_sources', bindings: [] }
                ]
            });
            console.log('✅ Granted permissions: view_session_income_sources, view_sessions, view_organizations');

            // Login with the user and navigate to the session report page
            const externalToken = await loginForm.adminLoginAndNavigate(page, externalUser)
            externalClient.setAuthToken(externalToken);

            await page.goto(`/applicants/all/${createdSessionId}`);

            await expect(page.getByTestId('session-report-section')).toBeVisible({ timeout: 30_000 });

            const incomeSourceSection = page.getByTestId('income-source-section')
            await expect(incomeSourceSection).toBeVisible();
            console.log('✅ Income source section is visible with correct permissions');

            const incomeSourcePromise = page.waitForResponse(resp =>
                resp.url().includes(`/sessions/${createdSessionId}/income-sources`)
                && resp.url().includes(`fields[income_source]`)
                && resp.ok()
                && resp.request().method() === 'GET', { timeout: 30_000 });
            await openReportSection(page, 'income-source-section');
            const incomeSourceResponse = await incomeSourcePromise;
            const incomeSourceData = await waitForJsonResponse(incomeSourceResponse);
            const incomeSources = incomeSourceData?.data || [];
            expect(incomeSourceData?.data).toBeDefined();
            console.log('✅ Income source data is fetched successfully with correct permissions');

            const listedIncomeSources = incomeSources.filter(incomeSource => incomeSource.state === 'LISTED');
            const potentialIncomeSources = incomeSources.filter(incomeSource => incomeSource.state === 'POTENTIAL');
            expect(listedIncomeSources.length).toBeGreaterThan(0);
            expect(potentialIncomeSources.length).toBeGreaterThan(0);
            console.log('✅ Income sources are categorized correctly into LISTED and POTENTIAL');

            for (const incomeSource of listedIncomeSources) {
                await expect(page.getByTestId(`income-source-${incomeSource.id}`)).toBeVisible();
            }

            for (const incomeSource of potentialIncomeSources) {
                await expect(page.getByTestId(`income-source-${incomeSource.id}`)).toBeVisible();
            }
            console.log('✅ All listed and potential income sources are visible in the report');

            // check api not failing with correct permissions
            const apiIncomeSources = await externalClient.get(`/sessions/${createdSessionId}/income-sources`);
            expect(apiIncomeSources.data).toBeDefined();
            console.log('✅ API call to fetch income sources succeeds with correct permissions');
        }, { box: true });

        console.log('[STEP 2] VIEW_SESSION_INCOME_SOURCES Permission - Negative Testing')
        await test.step('[STEP 2] VIEW_SESSION_INCOME_SOURCES Permission - Negative Testing', async () => {

            // Revoke permission via API:PATCH /organizations/{id}/members/{memberId} to remove VIEW_SESSION_INCOME_SOURCES but keep VIEW_SESSIONS + VIEW_ORGANIZATIONS
            await adminClient.patch(`/organizations/${adminOrganization.id}/members/${createdMember.id}`, {
                permissions: [
                    { name: 'view_sessions', bindings: [] },
                    { name: 'view_organizations', bindings: [] }
                ]
            });
            console.log('✅ Revoked permission: view_session_income_sources; Kept permissions: view_sessions, view_organizations');
            
            await page.reload();
            
            await expect(page.getByTestId('session-report-section')).toBeVisible({ timeout: 30_000 });

            const incomeSourceSection = page.getByTestId('income-source-section')
            await expect(incomeSourceSection).toBeHidden();
            console.log('✅ Income source section is hidden after revoking view_session_income_sources permission');

        });

        console.log('[STEP 3] CREATE_SESSION_INCOME_SOURCES Permission - Positive Testing')
        await test.step('Step 3: CREATE_SESSION_INCOME_SOURCES Permission - Positive Test', async () => {

            // Grant CREATE_SESSION_INCOME_SOURCES permission via API
            await adminClient.patch(`/organizations/${adminOrganization.id}/members/${createdMember.id}`, {
                permissions: [
                    { name: 'view_sessions', bindings: [] },
                    { name: 'view_organizations', bindings: [] },
                    { name: 'create_session_income_sources', bindings: [] },
                    { name: 'view_session_income_sources', bindings: [] }
                ]
            });
            console.log('✅ Granted permissions: create_session_income_sources, view_session_income_sources, view_sessions, view_organizations');

            await page.reload();

            await expect(page.getByTestId('session-report-section')).toBeVisible({ timeout: 30_000 });

            const incomeSourceSection = page.getByTestId('income-source-section')
            await expect(incomeSourceSection).toBeVisible();
            await openReportSection(page, 'income-source-section');
            console.log('✅ Income source section is visible with CREATE_SESSION_INCOME_SOURCES permission');

            const incomeSource = await addIncomeSource(page, createdSessionId, {
                type: 'GOVERNMENT',
                name: 'Test Government Income Source',
                gross: 2000
            });

            // DELISTING Income source for later tests
            const response = await adminClient.patch(`/sessions/${createdSessionId}/income-sources/${incomeSource.id}`, {
                notes: 'Not Income',
                state: 'DELISTED'
            })
            response.data && console.log('✅ Delisted income source created for later tests')

        });

        console.log('[STEP 4] CREATE_SESSION_INCOME_SOURCES Permission - Negative Testing')
        await test.step('Step 4: CREATE_SESSION_INCOME_SOURCES Permission - Negative Test', async () => {

            // Revoke CREATE_SESSION_INCOME_SOURCES permission via API but keep VIEW_SESSION_INCOME_SOURCES
            await adminClient.patch(`/organizations/${adminOrganization.id}/members/${createdMember.id}`, {
                permissions: [
                    { name: 'view_sessions', bindings: [] },
                    { name: 'view_organizations', bindings: [] },
                    { name: 'view_session_income_sources', bindings: [] }
                ]
            });
            console.log('✅ Revoked permission: create_session_income_sources; Kept permissions: view_session_income_sources, view_sessions, view_organizations');

            await page.reload();

            await expect(page.getByTestId('session-report-section')).toBeVisible({ timeout: 30_000 });

            await openReportSection(page, 'income-source-section');
            const addButton = page.getByTestId('income-source-add-button');
            await expect(addButton).toBeHidden();
            console.log('✅ Add income source button is hidden after revoking create_session_income_sources permission');

            await expect(page.getByTestId('income-source-regenerate')).toBeHidden();
            console.log('✅ Regenerate income source button is hidden after revoking create_session_income_sources permission');

        });

        console.log('[STEP 5] EDIT_SESSION_INCOME_SOURCES Permission - Positive Testing')
        await test.step('Step 5: EDIT_SESSION_INCOME_SOURCES Permission - Positive Test', async () => {

            // Grant EDIT_SESSION_INCOME_SOURCES permission via API
            await adminClient.patch(`/organizations/${adminOrganization.id}/members/${createdMember.id}`, {
                permissions: [
                    { name: 'view_sessions', bindings: [] },
                    { name: 'view_organizations', bindings: [] },
                    { name: 'edit_session_income_sources', bindings: [] },
                    { name: 'view_session_income_sources', bindings: [] }
                ]
            });
            console.log('✅ Granted permissions: edit_session_income_sources, view_session_income_sources, view_sessions, view_organizations');

            await page.reload();

            await expect(page.getByTestId('session-report-section')).toBeVisible({ timeout: 30_000 });

            const incomeSourcePromise = page.waitForResponse(resp =>
                resp.url().includes(`/sessions/${createdSessionId}/income-sources`)
                && resp.url().includes(`fields[income_source]`)
                && resp.ok()
                && resp.request().method() === 'GET', { timeout: 30_000 });
            await openReportSection(page, 'income-source-section');
            const incomeSourceResponse = await incomeSourcePromise;
            const incomeSourceData = await waitForJsonResponse(incomeSourceResponse);
            const incomeSources = incomeSourceData?.data || [];
            expect(incomeSourceData?.data).toBeDefined();
            console.log('✅ Income source data is fetched successfully with correct permissions');

            expect(incomeSources.length).toBeGreaterThan(0);

            // Find a LISTED or POTENTIAL income source and check both are editable
            const listedIncomeSource = incomeSources.find(source => source.state === 'LISTED');
            const potentialIncomeSource = incomeSources.find(source => source.state === 'POTENTIAL');

            if (listedIncomeSource) {
                const incomeSourceElement = page.getByTestId(`income-source-${listedIncomeSource.id}`);
                const editButton = incomeSourceElement.getByTestId('income-source-edit-btn');
                await expect(editButton).toBeVisible();
                console.log('✅ Edit button is visible for LISTED income source with correct permissions');

                await editButton.click();
                const modal = page.getByTestId('income-source-modal');
                await expect(modal).toBeVisible();
                console.log('✅ Income source edit modal is visible after clicking edit button');

                const updateData = {
                    name: 'Payroll-Deposit-APItest-Edited',
                }
                await fillIncomeSourceForm(updateData, modal);

                const submitButton = modal.getByTestId('add-income-source-modal-submit-btn');
                await expect(submitButton).toBeVisible();
                const incomeSourceUpdatePromise = page.waitForResponse(resp =>
                    resp.url().includes(`/sessions/${createdSessionId}/income-sources/${listedIncomeSource.id}`)
                    && resp.request().method() === 'PATCH', { timeout: 30_000 });
                await submitButton.click();
                const updateResponse = await incomeSourceUpdatePromise;
                await expect(updateResponse.ok()).toBeTruthy();
                console.log('✅ Income source update API call succeeded with correct permissions');

                // check income source details button is visible after edit
                const detailsButton = incomeSourceElement.getByTestId('income-source-detail-btn');
                await expect(detailsButton).toBeVisible();
                console.log('✅ Details button is visible for edited income source with correct permissions');

            }
            if (potentialIncomeSource) {
                const incomeSourceElement = page.getByTestId(`income-source-${potentialIncomeSource.id}`);
                await expect(incomeSourceElement.getByTestId('income-source-edit-btn')).toBeVisible();
                console.log('✅ Edit button is visible for POTENTIAL income source with correct permissions');

                // check income source details button is visible after edit
                const detailsButton = incomeSourceElement.getByTestId('income-source-detail-btn');
                await expect(detailsButton).toBeVisible();
                console.log('✅ Details button is visible for edited income source with correct permissions');
            }
        })

        console.log('[STEP 6] EDIT_SESSION_INCOME_SOURCES Permission - Negative Testing')
        await test.step('Step 6: EDIT_SESSION_INCOME_SOURCES Permission - Negative Test', async () => {

            // Revoke EDIT_SESSION_INCOME_SOURCES permission via API but keep VIEW_SESSION_INCOME_SOURCES
            await adminClient.patch(`/organizations/${adminOrganization.id}/members/${createdMember.id}`, {
                permissions: [
                    { name: 'view_sessions', bindings: [] },
                    { name: 'view_organizations', bindings: [] },
                    { name: 'view_session_income_sources', bindings: [] }
                ]
            });
            console.log('✅ Revoked permission: edit_session_income_sources; Kept permissions: view_session_income_sources, view_sessions, view_organizations');

            await page.reload();

            await expect(page.getByTestId('session-report-section')).toBeVisible({ timeout: 30_000 });

            const incomeSourcePromise = page.waitForResponse(resp =>
                resp.url().includes(`/sessions/${createdSessionId}/income-sources`)
                && resp.url().includes(`fields[income_source]`)
                && resp.ok()
                && resp.request().method() === 'GET', { timeout: 30_000 });
            await openReportSection(page, 'income-source-section');
            const incomeSourceResponse = await incomeSourcePromise;
            const incomeSourceData = await waitForJsonResponse(incomeSourceResponse);
            const incomeSources = incomeSourceData?.data || [];
            expect(incomeSourceData?.data).toBeDefined();
            console.log('✅ Income source data is fetched successfully with correct permissions');

            // Find a LISTED or POTENTIAL income source and check both are not editable
            const listedIncomeSource = incomeSources.find(source => source.state === 'LISTED');
            const potentialIncomeSource = incomeSources.find(source => source.state === 'POTENTIAL');

            if (listedIncomeSource) {
                const incomeSourceElement = page.getByTestId(`income-source-${listedIncomeSource.id}`);
                await expect(incomeSourceElement.getByTestId('income-source-edit-btn')).toBeHidden();
                console.log('✅ Edit button is hidden for LISTED income source after revoking edit_session_income_sources permission');

                // check income source details button is still visible after edit permission revoked
                const detailsButton = incomeSourceElement.getByTestId('income-source-detail-btn');
                await expect(detailsButton).toBeVisible();
                console.log('✅ Details button is still visible for LISTED income source after revoking edit_session_income_sources permission');
                await detailsButton.click();
                const detailsModal = page.getByTestId('income-source-details');
                const transactionEdit = detailsModal.getByTestId(`income-transaction-${listedIncomeSource.transactions[0].id}-edit`);
                await expect(transactionEdit).toBeHidden();
                console.log('✅ Transaction edit button is hidden in details modal for LISTED income source after revoking edit_session_income_sources permission');

                const closeModalBtn = detailsModal.getByTestId('income-source-details-cancel');
                await expect(closeModalBtn).toBeVisible();
                await closeModalBtn.click();
                console.log('✅ Closed income source details modal');
            }
            if (potentialIncomeSource) {
                const incomeSourceElement = page.getByTestId(`income-source-${potentialIncomeSource.id}`);
                await expect(incomeSourceElement.getByTestId('income-source-edit-btn')).toBeHidden();
                console.log('✅ Edit button is hidden for POTENTIAL income source after revoking edit_session_income_sources permission');

                // check income source details button is still visible after edit permission revoked
                const detailsButton = incomeSourceElement.getByTestId('income-source-detail-btn');
                await expect(detailsButton).toBeVisible();
                console.log('✅ Details button is still visible for POTENTIAL income source after revoking edit_session_income_sources permission');
                await detailsButton.click();
                const detailsModal = page.getByTestId('income-source-details');
                const transactionEdit = detailsModal.getByTestId(`income-transaction-${potentialIncomeSource.transactions[0].id}-edit`);
                await expect(transactionEdit).toBeHidden();
                console.log('✅ Transaction edit button is hidden in details modal for POTENTIAL income source after revoking edit_session_income_sources permission');

                const closeModalBtn = detailsModal.getByTestId('income-source-details-cancel');
                await expect(closeModalBtn).toBeVisible();
                await closeModalBtn.click();
                console.log('✅ Closed income source details modal');
            }

        })

        console.log('[STEP 7] VIEW_EXTENDED_SESSION_INCOME_SOURCES Permission - Positive and Negative Testing')
        await test.step('Step 7: VIEW_EXTENDED_SESSION_INCOME_SOURCES Permission - Positive Test', async () => {

            // Grant VIEW_EXTENDED_SESSION_INCOME_SOURCES permission via API
            await adminClient.patch(`/organizations/${adminOrganization.id}/members/${createdMember.id}`, {
                permissions: [
                    { name: 'view_sessions', bindings: [] },
                    { name: 'view_organizations', bindings: [] },
                    { name: 'view_session_income_sources', bindings: [] },
                    { name: 'view_extended_session_income_sources', bindings: [] }
                ]
            });
            console.log('✅ Granted permissions: view_extended_session_income_sources, view_session_income_sources, view_sessions, view_organizations');

            await page.reload();
            await expect(page.getByTestId('session-report-section')).toBeVisible({ timeout: 30_000 });

            // verify show delist toggle is visible
            const delistToggle = page.getByTestId('show-delisted-pill');
            await expect(delistToggle).toBeVisible();
            console.log('✅ Show delisted toggle is visible with view_extended_session_income_sources permission');

            const incomeSourcePromise = page.waitForResponse(resp =>
                resp.url().includes(`/sessions/${createdSessionId}/income-sources`)
                && resp.url().includes(`fields[income_source]`)
                && resp.ok()
                && resp.request().method() === 'GET', { timeout: 30_000 });
            await openReportSection(page, 'income-source-section');
            const incomeSourceResponse = await incomeSourcePromise;
            const incomeSourceData = await waitForJsonResponse(incomeSourceResponse);
            const incomeSources = incomeSourceData?.data || [];
            expect(incomeSourceData?.data).toBeDefined();
            console.log('✅ Income source data is fetched successfully with correct permissions');

            const delistedIncomeSources = incomeSources.filter(source => source.state === 'DELISTED');
            expect(delistedIncomeSources.length).toBeGreaterThan(0);
            console.log('✅ Delisted income sources are present in the data with view_extended_session_income_sources permission');

            for (const incomeSource of delistedIncomeSources) {
                await expect(page.getByTestId(`income-source-${incomeSource.id}`)).toBeVisible();
            }

            const potentialIncomeSource = incomeSources.find(source => source.state === 'POTENTIAL');
            if (potentialIncomeSource) {
                const incomeSourceElement = page.getByTestId(`income-source-${potentialIncomeSource.id}`);
                await expect(incomeSourceElement).toBeVisible();
                console.log('✅ POTENTIAL income source is visible along with delisted sources with view_extended_session_income_sources permission');
            }

        })

        console.log('[STEP 8] VIEW_EXTENDED_SESSION_INCOME_SOURCES Permission - Negative Testing')
        await test.step('Step 8: VIEW_EXTENDED_SESSION_INCOME_SOURCES Permission - Negative Test', async () => {

            // Revoke VIEW_EXTENDED_SESSION_INCOME_SOURCES permission via API but keep VIEW_SESSION_INCOME_SOURCES
            await adminClient.patch(`/organizations/${adminOrganization.id}/members/${createdMember.id}`, {
                permissions: [
                    { name: 'view_sessions', bindings: [] },
                    { name: 'view_organizations', bindings: [] },
                    { name: 'view_session_income_sources', bindings: [] }
                ]
            });
            console.log('✅ Revoked permission: view_extended_session_income_sources; Kept permissions: view_session_income_sources, view_sessions, view_organizations');

            await page.reload();

            await expect(page.getByTestId('session-report-section')).toBeVisible({ timeout: 30_000 });

            const delistToggle = page.getByTestId('show-delisted-pill');
            await expect(delistToggle).toBeHidden();
            console.log('✅ Show delisted toggle is hidden after revoking view_extended_session_income_sources permission');

            const incomeSourcePromise = page.waitForResponse(resp =>
                resp.url().includes(`/sessions/${createdSessionId}/income-sources`)
                && resp.url().includes(`fields[income_source]`)
                && resp.ok()
                && resp.request().method() === 'GET', { timeout: 30_000 });
            await openReportSection(page, 'income-source-section');
            const incomeSourceResponse = await incomeSourcePromise;
            const incomeSourceData = await waitForJsonResponse(incomeSourceResponse);
            const incomeSources = incomeSourceData?.data || [];
            expect(incomeSourceData?.data).toBeDefined();
            console.log('✅ Income source data is fetched successfully with correct permissions');

            const delistedIncomeSources = incomeSources.filter(source => source.state === 'DELISTED');
            // expect(delistedIncomeSources.length).toBe(0);

            for (const incomeSource of delistedIncomeSources) {
                await expect(page.getByTestId(`income-source-${incomeSource.id}`)).toBeHidden();
            }
            console.log('✅ Delisted income sources are hidden after revoking view_extended_session_income_sources permission');
            const potentialIncomeSource = incomeSources.find(source => source.state === 'POTENTIAL');
            if (potentialIncomeSource) {
                const incomeSourceElement = page.getByTestId(`income-source-${potentialIncomeSource.id}`);
                await expect(incomeSourceElement).toBeHidden();
                console.log('✅ POTENTIAL income source is hidden after revoking view_extended_session_income_sources permission');
            }
        })

        console.log('[STEP 9] LIST_SESSION_INCOME_SOURCES Permission - Positive and Negative Testing')
        await test.step('Step 9: LIST_SESSION_INCOME_SOURCES Permission - Positive Test', async () => {

            // Grant LIST_SESSION_INCOME_SOURCES permission via API
            await adminClient.patch(`/organizations/${adminOrganization.id}/members/${createdMember.id}`, {
                permissions: [
                    { name: 'view_sessions', bindings: [] },
                    { name: 'view_organizations', bindings: [] },
                    { name: 'view_session_income_sources', bindings: [] },
                    { name: 'list_session_income_sources', bindings: [] }
                ]
            });
            console.log('✅ Granted permissions: list_session_income_sources, view_session_income_sources, view_sessions, view_organizations');


            await page.reload();
            0
            await expect(page.getByTestId('session-report-section')).toBeVisible({ timeout: 30_000 });

            const incomeSourcePromise = page.waitForResponse(resp =>
                resp.url().includes(`/sessions/${createdSessionId}/income-sources`)
                && resp.url().includes(`fields[income_source]`)
                && resp.ok()
                && resp.request().method() === 'GET', { timeout: 30_000 });
            await openReportSection(page, 'income-source-section');
            const incomeSourceResponse = await incomeSourcePromise;
            const incomeSourceData = await waitForJsonResponse(incomeSourceResponse);
            const incomeSources = incomeSourceData?.data || [];
            expect(incomeSourceData?.data).toBeDefined();

            const potentialIncomeSource = incomeSources.find(source => source.state === 'POTENTIAL');
            expect(potentialIncomeSource).toBeDefined();
            const potentialIncomeSourceElement = page.getByTestId(`income-source-${potentialIncomeSource.id}`);
            await expect(potentialIncomeSourceElement).toBeVisible();
            console.log('✅ POTENTIAL income source is visible with list_session_income_sources permission');
            // verify relisted button is visible for potential income source with list permission
            const relistButton = potentialIncomeSourceElement.getByTestId('income-source-relist-btn');
            await expect(relistButton).toBeVisible();
            console.log('✅ Relist button is visible for POTENTIAL income source with list_session_income_sources permission');

            await relistButton.click();

            const relistModal = page.getByTestId('income-source-list-modal');
            await expect(relistModal).toBeVisible();

            const relistCommentInput = relistModal.getByTestId('income-source-relist-reason-input');
            await expect(relistCommentInput).toBeVisible();
            await relistCommentInput.fill('Relisting income source for testing purposes');
            console.log('✅ Filled relist reason in modal');

            const relistSubmitButton = relistModal.getByTestId('income-source-relist-submit');
            await expect(relistSubmitButton).toBeVisible();
            // Intercept PATCH /sessions/{id}/income-sources/{id} with state: LISTED and verify request succeeds (status 200)
            const relistApiPromise = page.waitForResponse(resp =>
                resp.url().includes(`/sessions/${createdSessionId}/income-sources/${potentialIncomeSource.id}`)
                && resp.request().method() === 'PATCH', { timeout: 30_000 });
            await relistSubmitButton.click();
            const relistResponse = await relistApiPromise;
            await expect(relistResponse.ok()).toBeTruthy();
            console.log('✅ Income source relist API call succeeded with correct permissions');

        })

        console.log('[STEP 10] LIST_SESSION_INCOME_SOURCES Permission - Negative Testing')
        await test.step('Step 10: LIST_SESSION_INCOME_SOURCES Permission - Negative Test', async () => {

            // Revoke LIST_SESSION_INCOME_SOURCES permission via API but keep VIEW_SESSION_INCOME_SOURCES
            await adminClient.patch(`/organizations/${adminOrganization.id}/members/${createdMember.id}`, {
                permissions: [
                    { name: 'view_sessions', bindings: [] },
                    { name: 'view_organizations', bindings: [] },
                    { name: 'view_session_income_sources', bindings: [] }
                ]
            });
            console.log('✅ Revoked permission: list_session_income_sources; Kept permissions: view_session_income_sources, view_sessions, view_organizations');


            await page.reload();

            await expect(page.getByTestId('session-report-section')).toBeVisible({ timeout: 30_000 });
            const incomeSourcePromise = page.waitForResponse(resp =>
                resp.url().includes(`/sessions/${createdSessionId}/income-sources`)
                && resp.url().includes(`fields[income_source]`)
                && resp.ok()
                && resp.request().method() === 'GET', { timeout: 30_000 });
            await openReportSection(page, 'income-source-section');
            const incomeSourceResponse = await incomeSourcePromise;
            const incomeSourceData = await waitForJsonResponse(incomeSourceResponse);
            const incomeSources = incomeSourceData?.data || [];
            expect(incomeSourceData?.data).toBeDefined();
            const potentialIncomeSource = incomeSources.find(source => source.state === 'POTENTIAL');
            if (potentialIncomeSource) {
                const potentialIncomeSourceElement = page.getByTestId(`income-source-${potentialIncomeSource.id}`);
                await expect(potentialIncomeSourceElement).toBeVisible();
                const relistButton = potentialIncomeSourceElement.getByTestId('income-source-relist-btn');
                await expect(relistButton).toHaveClass(/pointer-events-none/);
                await expect(relistButton).toHaveClass(/opacity-40/);
                console.log('✅ Relist button is disabled for POTENTIAL income source after revoking list_session_income_sources permission');
            }
        });

        console.log('[STEP 11] DELIST_SESSION_INCOME_SOURCES Permission - Positive and Negative Testing')
        await test.step('Step 11: DELIST_SESSION_INCOME_SOURCES Permission - Positive Test', async () => {

            // Grant DELIST_SESSION_INCOME_SOURCES permission via API
            await adminClient.patch(`/organizations/${adminOrganization.id}/members/${createdMember.id}`, {
                permissions: [
                    { name: 'view_sessions', bindings: [] },
                    { name: 'view_organizations', bindings: [] },
                    { name: 'view_session_income_sources', bindings: [] },
                    { name: 'delist_session_income_sources', bindings: [] },
                ]
            });
            console.log('✅ Granted permissions: delist_session_income_sources, view_session_income_sources, view_sessions, view_organizations');

            await page.reload();

            await expect(page.getByTestId('session-report-section')).toBeVisible({ timeout: 30_000 });

            const incomeSourcePromise = page.waitForResponse(resp =>
                resp.url().includes(`/sessions/${createdSessionId}/income-sources`)
                && resp.url().includes(`fields[income_source]`)
                && resp.ok()
                && resp.request().method() === 'GET', { timeout: 30_000 });
            await openReportSection(page, 'income-source-section');
            const incomeSourceResponse = await incomeSourcePromise;
            const incomeSourceData = await waitForJsonResponse(incomeSourceResponse);
            const incomeSources = incomeSourceData?.data || [];
            expect(incomeSourceData?.data).toBeDefined();
            const listedIncomeSource = incomeSources.find(source => source.state === 'LISTED');

            if (listedIncomeSource) {
                const listedIncomeSourceElement = page.getByTestId(`income-source-${listedIncomeSource.id}`);
                const delistButton = listedIncomeSourceElement.getByTestId('income-source-delist-btn');
                await expect(delistButton).toBeVisible();
                console.log('✅ Delist button is visible for LISTED income source with delist_session_income_sources permission');
                await delistButton.click();
                const delistModal = page.getByTestId('income-source-delist-modal');
                await expect(delistModal).toBeVisible();

                const reasonSelect = delistModal.getByTestId('income-source-delist-reason-select');
                await expect(reasonSelect).toBeVisible();
                await reasonSelect.selectOption('Not Income');
                console.log('✅ Selected delist reason in modal');

                const delistActionSelect = delistModal.getByTestId('income-source-delist-action-select');
                await expect(delistActionSelect).toBeVisible();
                await delistActionSelect.selectOption('DELISTED');
                console.log('✅ Selected delist action in modal');

                const delistSubmitButton = delistModal.getByTestId('income-source-delist-submit');
                await expect(delistSubmitButton).toBeVisible();
                // Intercept PATCH /sessions/{id}/income-sources/{id} with state: DELISTED and verify request succeeds (status 200)
                const delistApiPromise = page.waitForResponse(resp =>
                    resp.url().includes(`/sessions/${createdSessionId}/income-sources/${listedIncomeSource.id}`)
                    && resp.request().method() === 'PATCH', { timeout: 30_000 });
                await delistSubmitButton.click();
                const delistResponse = await delistApiPromise;
                await expect(delistResponse.ok()).toBeTruthy();
                console.log('✅ Income source delist API call succeeded with correct permissions');
            }

        })

        console.log('[STEP 12] DELIST_SESSION_INCOME_SOURCES Permission - Negative Testing')
        await test.step('Step 12: DELIST_SESSION_INCOME_SOURCES Permission - Negative Test', async () => {

            // Revoke DELIST_SESSION_INCOME_SOURCES permission via API but keep VIEW_SESSION_INCOME_SOURCES
            await adminClient.patch(`/organizations/${adminOrganization.id}/members/${createdMember.id}`, {
                permissions: [
                    { name: 'view_sessions', bindings: [] },
                    { name: 'view_organizations', bindings: [] },
                    { name: 'view_session_income_sources', bindings: [] },
                ]
            });
            console.log('✅ Revoked permission: delist_session_income_sources; Kept permissions: view_session_income_sources, view_sessions, view_organizations');

            await page.reload();

            await expect(page.getByTestId('session-report-section')).toBeVisible({ timeout: 30_000 });
            const incomeSourcePromise = page.waitForResponse(resp =>
                resp.url().includes(`/sessions/${createdSessionId}/income-sources`)
                && resp.url().includes(`fields[income_source]`)
                && resp.ok()
                && resp.request().method() === 'GET', { timeout: 30_000 });
            await openReportSection(page, 'income-source-section');
            const incomeSourceResponse = await incomeSourcePromise;
            const incomeSourceData = await waitForJsonResponse(incomeSourceResponse);
            const incomeSources = incomeSourceData?.data || [];
            expect(incomeSourceData?.data).toBeDefined();
            expect(incomeSources.length).toBeGreaterThan(0);

            const listedIncomeSource = incomeSources.find(source => source.state === 'LISTED');

            if (listedIncomeSource) {
                const listedIncomeSourceElement = page.getByTestId(`income-source-${listedIncomeSource.id}`);
                const delistButton = listedIncomeSourceElement.getByTestId('income-source-delist-btn');
                await expect(delistButton).toBeVisible();
                await expect(delistButton).toHaveClass(/pointer-events-none/);
                await expect(delistButton).toHaveClass(/opacity-40/);
                console.log('✅ Delist button is disabled for LISTED income source after revoking delist_session_income_sources permission');
            }

        })

        console.log('[STEP 13] VIEW_SESSION_INCOME_SOURCE_TRANSACTIONS Permission - Positive and Negative Testing')
        await test.step('Step 13: VIEW_SESSION_INCOME_SOURCE_TRANSACTIONS Permission - Positive Test', async () => {
            // Grant VIEW_SESSION_INCOME_SOURCE_TRANSACTIONS permission via API
            await adminClient.patch(`/organizations/${adminOrganization.id}/members/${createdMember.id}`, {
                permissions: [
                    { name: 'view_sessions', bindings: [] },
                    { name: 'view_organizations', bindings: [] },
                    { name: 'view_session_income_sources', bindings: [] },
                    { name: 'view_session_income_source_transactions', bindings: [] }
                ]
            });
            console.log('✅ Granted permissions: view_session_income_source_transactions, view_session_income_sources, view_sessions, view_organizations');

            await page.reload();

            await expect(page.getByTestId('session-report-section')).toBeVisible({ timeout: 30_000 });
            const incomeSourcePromise = page.waitForResponse(resp =>
                resp.url().includes(`/sessions/${createdSessionId}/income-sources`)
                && resp.url().includes(`fields[income_source]`)
                && resp.ok()
                && resp.request().method() === 'GET', { timeout: 30_000 });
            await openReportSection(page, 'income-source-section');
            const incomeSourceResponse = await incomeSourcePromise;
            const incomeSourceData = await waitForJsonResponse(incomeSourceResponse);
            const incomeSources = incomeSourceData?.data || [];
            expect(incomeSourceData?.data).toBeDefined();
            expect(incomeSources.length).toBeGreaterThan(0);
            const listedIncomeSource = incomeSources.find(source => source.state === 'LISTED');

            if (listedIncomeSource) {
                const listedIncomeSourceElement = page.getByTestId(`income-source-${listedIncomeSource.id}`);
                const detailsButton = listedIncomeSourceElement.getByTestId('income-source-detail-btn');
                await expect(detailsButton).toBeVisible();
                await detailsButton.click();
                const detailsModal = page.getByTestId('income-source-details');
                await expect(detailsModal).toBeVisible();
                const transactionsTable = detailsModal.getByTestId('income-detail-transactions-table');
                await expect(transactionsTable).toBeVisible();
                for (const transaction of listedIncomeSource.transactions) {
                    const transactionRow = transactionsTable.getByTestId(`income-transaction-${transaction.id}`);
                    await expect(transactionRow).toBeVisible();
                }
                console.log('✅ Transactions table is visible in income source details modal with view_session_income_source_transactions permission');
            }
        })

        console.log('[STEP 14] VIEW_SESSION_INCOME_SOURCE_TRANSACTIONS Permission - Negative Testing')
        await test.step('Step 14: VIEW_SESSION_INCOME_SOURCE_TRANSACTIONS Permission - Negative Test', async () => {
            // Revoke VIEW_SESSION_INCOME_SOURCE_TRANSACTIONS permission via API but keep VIEW_SESSION_INCOME_SOURCES
            await adminClient.patch(`/organizations/${adminOrganization.id}/members/${createdMember.id}`, {
                permissions: [
                    { name: 'view_sessions', bindings: [] },
                    { name: 'view_organizations', bindings: [] },
                    { name: 'view_session_income_sources', bindings: [] },
                ]
            });
            console.log('✅ Revoked permission: view_session_income_source_transactions; Kept permissions: view_session_income_sources, view_sessions, view_organizations');
            await page.reload();
            await expect(page.getByTestId('session-report-section')).toBeVisible({ timeout: 30_000 });
            const incomeSourcePromise = page.waitForResponse(resp =>
                resp.url().includes(`/sessions/${createdSessionId}/income-sources`)
                && resp.url().includes(`fields[income_source]`)
                && resp.ok()
                && resp.request().method() === 'GET', { timeout: 30_000 });
            await openReportSection(page, 'income-source-section');
            const incomeSourceResponse = await incomeSourcePromise;
            const incomeSourceData = await waitForJsonResponse(incomeSourceResponse);
            const incomeSources = incomeSourceData?.data || [];
            expect(incomeSourceData?.data).toBeDefined();
            expect(incomeSources.length).toBeGreaterThan(0);
            const listedIncomeSource = incomeSources.find(source => source.state === 'LISTED');
            expect(listedIncomeSource).toBeDefined();
            if (listedIncomeSource) {
                const listedIncomeSourceElement = page.getByTestId(`income-source-${listedIncomeSource.id}`);
                const detailsButton = listedIncomeSourceElement.getByTestId('income-source-detail-btn');
                await expect(detailsButton).toBeVisible();
                await detailsButton.click();
                const detailsModal = page.getByTestId('income-source-details');
                await expect(detailsModal).toBeVisible();
                const transactionsTable = detailsModal.getByTestId('income-detail-transactions-table');
                await expect(transactionsTable).toBeHidden();
                console.log('✅ Transactions table is hidden in income source details modal after revoking view_session_income_source_transactions permission');
            }
        });

    });


    test.afterAll(async () => {
        // Cleanup: delete the created session 

        if (createdMember) {
            await adminClient.delete(`/organizations/${adminOrganization.id}/members/${createdMember.id}`);
            console.log(`✅ Deleted member with ID: ${createdMember.id}`);
        }

        if (createdUser) {
            await adminClient.delete(`/users/${createdUser.id}`);
            console.log(`✅ Deleted user with ID: ${createdUser.id}`);
        }

        if (createdSessionId) {
            await sessionApi.delete(createdSessionId);
            console.log(`✅ Deleted session with ID: ${createdSessionId}`);
        }

    })

})

async function addIncomeSource(page, sessionId, incomeSourceData) {
    /**
     * Click on income-source-add button
     * UI Verification: Verify income source modal opens
     * Fill in income source details and submit
     * API Verification: Intercept POST /sessions/{id}/income-sources and verify request succeeds (status 201)
     */
    const addButton = page.getByTestId('income-source-add');
    await expect(addButton).toBeVisible();
    await addButton.click();
    console.log('✅ Clicked on add income source button');
    const modal = page.getByTestId('income-source-modal');
    await expect(modal).toBeVisible();
    console.log('✅ Income source modal is visible');

    await fillIncomeSourceForm(incomeSourceData, modal);

    const submitButton = modal.getByTestId('add-income-source-modal-submit-btn');
    await expect(submitButton).toBeVisible();

    const incomeSourceCreationPromise = page.waitForResponse(resp =>
        resp.url().includes(`/sessions/${sessionId}/income-sources`)
        && resp.request().method() === 'POST', { timeout: 30_000 });
    await submitButton.click();
    console.log('✅ Submitted new income source form');
    const response = await incomeSourceCreationPromise;
    await expect(response.ok()).toBeTruthy();
    const { data: incomeSource } = await waitForJsonResponse(response);
    console.log('✅ Income source creation API call succeeded with correct permissions');
    return incomeSource;

}

async function fillIncomeSourceForm(incomeSourceData, modal) {
    if (incomeSourceData.type) {
        const incomeTypeSelect = modal.getByTestId('income-type-select');
        await expect(incomeTypeSelect).toBeVisible();
        await incomeTypeSelect.selectOption(incomeSourceData.type);
        console.log(`✅ Selected income type: ${incomeSourceData.type}`);
    }

    if (incomeSourceData.gross) {
        const grossAmountInput = modal.getByTestId('gross-amount-input');
        await expect(grossAmountInput).toBeVisible();
        await grossAmountInput.fill(incomeSourceData.gross.toString());
        console.log(`✅ Entered gross amount: ${incomeSourceData.gross}`);
    }

    if (incomeSourceData.name) {
        const incomeSourceNameInput = modal.getByTestId('income-source-name-input');
        await expect(incomeSourceNameInput).toBeVisible();
        await incomeSourceNameInput.fill(incomeSourceData.name);
        console.log(`✅ Entered income source name: ${incomeSourceData.name}`);
    }
}
