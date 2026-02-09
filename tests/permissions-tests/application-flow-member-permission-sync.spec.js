import { test, expect } from '@playwright/test';
import { ApiClient } from '../api';
import { admin, app } from '../test_config';
import BaseApi from '../api/base-api';
import { loginWithAdmin } from '../endpoint-utils/auth-helper';
import { adminLoginAndNavigateToApplications } from '../utils/session-utils';
import { searchAndEditApplication, searchApplication } from '../utils/applications-page';
import { getRandomEmail } from '../utils/helper';
import { fillMultiselect } from '../utils/common';
import { waitForJsonResponse } from '../utils/wait-response';

const adminClient = new ApiClient(app.urls.api, null, 120_000)
const applicationApi = new BaseApi(adminClient, '/applications');
const workflowApi = new BaseApi(adminClient, '/workflows');
const incomeSourceTemplateApi = new BaseApi(adminClient, '/income-source-templates');
const flagCollectionApi = new BaseApi(adminClient, '/flag-collections');
const organizationApi = new BaseApi(adminClient, '/organizations');


test.describe('QA-351 application-flow-member-permission-sync.spec', () => {
    test.setTimeout(80_000); // 5 minutes timeout

    const APPLICATION_NAME = 'Autotest - Permission Sync Test App';
    const WORKFLOW_TEMPLATE = 'Simulation Financial Employment';
    const ORGANIZATION_NAME = 'Permissions Test Org';

    let application = null;
    let organization = null;
    let member = null;
    let user = null;


    test.beforeAll(async () => {

        console.log('🔐 Starting admin login...');
        await loginWithAdmin(adminClient);
        console.log('🔐 Admin login complete.');

        console.log(`🔎 Searching for application by name: "${APPLICATION_NAME}"`);
        application = await applicationApi.getByName(APPLICATION_NAME);

        console.log(`🔎 Getting organization by name: "${ORGANIZATION_NAME}"`);
        organization = await organizationApi.getByName(ORGANIZATION_NAME);
        console.log(`🏢 Organization: ${organization?.id ?? 'not found'} (${ORGANIZATION_NAME})`);

        if (!application) {
            console.log(`🆕 Application "${APPLICATION_NAME}" not found. Creating new application...`);
            const workflow = await workflowApi.getByName(WORKFLOW_TEMPLATE.split(' ').join('-').toLowerCase());
            console.log(`🔁 Workflow template found: ${workflow?.id}`);
            const incomeSourceTemplate = await incomeSourceTemplateApi.getByName('Default');
            console.log(`💳 Income source template: ${incomeSourceTemplate?.id}`);
            const flagCollection = await flagCollectionApi.getByName('Low Risk');
            console.log(`🚩 Flag collection: ${flagCollection?.id}`);
            const createPayload = {
                workflow: workflow.id,
                organization: organization.id,
                name: APPLICATION_NAME,
                flag_collection: flagCollection.id,
                settings: {
                    "settings.applications.income.ratio.type": "gross",
                    "settings.applications.income.ratio.target": 100,
                    "settings.applications.income.ratio.target.conditional": 100,
                    "settings.applications.income.ratio.guarantor": 500,
                    "settings.applications.income.source_template": incomeSourceTemplate.id,
                    "settings.applications.target.enabled": 1,
                    "settings.applications.target.required": 1,
                    "settings.applications.target.default": "",
                    "settings.applications.target.locked": 0,
                    "settings.applications.target.range.min": 500,
                    "settings.applications.target.range.max": 10000,
                    "settings.applications.fast_entry": 1,
                    "settings.applications.knock.community_id": "",
                    "settings.applications.knock.company_id": "",
                    "settings.applications.lifecycle.enabled": 0,
                    "settings.applications.lifecycle.notifications.enabled": 0,
                    "settings.applications.lifecycle.duration": 48,
                    "settings.applications.lifecycle.notifications.warning.threshold": 1
                }
            };

            console.log('✍️ Creating application with payload:', { name: createPayload.name, organization: createPayload.organization });
            const createResponse = await applicationApi.create(createPayload);
            application = createResponse?.data;
            expect(application).toBeDefined();
            console.log(`📝 New application created with id: ${application.id}. Publishing application...`);
            await applicationApi.update(application.id, { published: true });
            application = (await applicationApi.retrive(application.id)).data;
            console.log(`✅ Application published: ${application.id}`);
        } else {
            console.log(`✅ Application "${APPLICATION_NAME}" found with id: ${application.id}.`);
        }
    })


    test('Verify member permission are updating properly from application flow', { tag: ['@regression'] }, async ({ page }) => {
        console.log('▶️ Test start: Verify member permission sync from application flow');

        await adminLoginAndNavigateToApplications(page, admin)
        console.log('➡️ Navigated to applications as admin.');

        console.log(`🔎 Searching application on UI: ${APPLICATION_NAME}`);
        await searchApplication(page, APPLICATION_NAME)
        console.log('🔎 Search complete.');

        // open application setup
        console.log(`🖱️ Opening application setup for id: ${application.id}`);
        await page.getByTestId(`edit-${application.id}`).click();
        await expect(page.getByTestId('application-setup')).toBeVisible({ timeout: 30000 });
        console.log('⚙️ Application setup opened.');

        // go to Members step and wait for members API response
        console.log('🔁 Navigating to Members step and waiting for members API response...');
        await Promise.all([
            page.waitForResponse(resp => resp.url().includes(`/organizations/${organization.id}/members`)
                && resp.request().method() === 'GET'
                && resp.ok()),
            page.getByTestId('step-#members').click()
        ]);
        console.log('🔁 Members data loaded.');

        await expect(page.getByTestId('application-members-setting')).toBeVisible({ timeout: 30000 });

        const memberTable = page.getByTestId('members-table')
        await expect(memberTable).toBeVisible()

        const createMemberBtn = page.getByTestId('create-app-member-btn')
        await expect(createMemberBtn).toBeVisible()
        const rolePromise = page.waitForResponse(resp => resp.url().includes(`/roles?fields[role]=`)
            && resp.request().method() === 'GET'
            && resp.ok())
        console.log('🖱️ Clicking "Create member" and waiting for roles to load...');
        await createMemberBtn.click()
        await rolePromise;
        console.log('📚 Roles loaded.');

        const memberModal = page.getByTestId('application-user-create-modal')
        await expect(memberModal).toBeVisible({ timeout: 30000 });

        const memberDetails = {
            email: getRandomEmail(),
            role: 'Autotest - Empty Role'
        }

        console.log(`✉️ Creating member with email: ${memberDetails.email} role: ${memberDetails.role}`);
        await memberModal.getByTestId('member-email-field').fill(memberDetails.email)
        await fillMultiselect(page, memberModal.getByTestId('member-role-field'), [memberDetails.role])

        const [memberResponse, applicationResponse] = await Promise.all([
            page.waitForResponse(resp => resp.url().includes(`/organizations/${organization.id}/members`)
                && resp.request().method() === 'POST'
                && resp.ok(), { timeout: 30_000 }),
            page.waitForResponse(resp => resp.url().includes(`/applications?fields[application]=`)
                && resp.request().method() === 'GET'
                && resp.ok(), { timeout: 30_000 }),
            memberModal.getByTestId('submit-create-member').click()
        ])

        console.log('⏳ Waiting for member creation response and applications refresh...');
        const memberData = await waitForJsonResponse(memberResponse)
        const applicationsData = await waitForJsonResponse(applicationResponse)
        expect(memberData).toBeDefined()
        expect(memberData.data).toBeDefined()
        member = memberData.data
        user = member.user
        console.log(`✅ New member created with id: ${member.id} and email: ${member.email}`);

        expect(applicationsData).toBeDefined()
        expect(applicationsData.data).toBeDefined()

        const applications = Array.isArray(applicationsData.data) ? applicationsData.data.slice(0, 5) : [];
        console.log(`🗂️ Found ${applications.length} related applications (capped to 5).`);
        await page.waitForTimeout(2000); // wait for 2 sec to ensure UI is updated
        for (let index = 0; index < applications.length; index++) {
            const app = applications[index];
            const appCheck = page.locator(`#view-${app.id}`);
            await expect(appCheck).toBeDefined();
            console.log(`🖱️ Clicking application checkbox view-${app.id}`);
            if (!await appCheck.isChecked()) {
                await appCheck.click()
            }
        }

        const applicationsSaveBtn = page.getByTestId('save-app-permission-btn')
        const appPermissionPromise = page.waitForResponse(resp => resp.url().includes(`/organizations/${organization.id}/members/${member.id}`)
            && resp.request().method() === 'PATCH'
            && resp.ok())
        console.log('💾 Saving application permissions for member...');
        await Promise.all([
            appPermissionPromise,
            applicationsSaveBtn.click()
        ])
        console.log('✅ Application permissions saved.');

        const permissions = {
            'manage_sessions': [
                'view_sessions',
                'delete_sessions',
                'merge_sessions',
            ],
            'manage_applicants': [
                'create_applicants',
                'view_applicants'
            ],
            export_session: []
        }
        await page.waitForTimeout(2000); // wait for 2 sec to ensure UI is updated
        console.log('🔐 Setting permission checkboxes for the member...');
        for (const [mainPermission, subPermissions] of Object.entries(permissions)) {

            if (subPermissions.length === 0) {
                const permissionCheckbox = page.getByTestId(`member-permission-checkbox-${mainPermission}`)
                await expect(permissionCheckbox).toBeVisible()
                if (!await permissionCheckbox.isChecked()) {
                    console.log(`🖱️ Checking permission: ${mainPermission}`);
                    await permissionCheckbox.click()
                } else {
                    console.log(`✅ Permission already checked: ${mainPermission}`);
                }
            } else {
                const mainPermissionSection = page.getByTestId(`member-permission-${mainPermission}`)
                const attribute = await mainPermissionSection.getAttribute('opened')
                if (attribute === false || attribute === 'false') {
                    console.log(`🔽 Expanding permission section: ${mainPermission}`);
                    await mainPermissionSection.click()
                }
                for (let i = 0; i < subPermissions.length; i++) {
                    const subPermission = subPermissions[i];
                    const subPermissionCheckbox = page.getByTestId(`member-permission-checkbox-${subPermission}`)
                    await expect(subPermissionCheckbox).toBeVisible()
                    if (!await subPermissionCheckbox.isChecked()) {
                        console.log(`🖱️ Checking sub-permission: ${subPermission}`);
                        await subPermissionCheckbox.click()
                    } else {
                        console.log(`✅ Sub-permission already checked: ${subPermission}`);
                    }
                }
            }

        }

        const savePermissionsBtn = page.getByTestId('member-permissions-save-btn')
        await expect(savePermissionsBtn).toBeVisible()
        console.log('💾 Saving permissions for member...');
        await Promise.all([
            page.waitForResponse(resp => resp.url().includes(`/organizations/${organization.id}/members/${member.id}`)
                && resp.request().method() === 'PATCH'
                && resp.ok()),
            savePermissionsBtn.click()
        ])
        console.log('✅ Permissions saved.');

        await page.getByTestId('application-user-create-modal-cancel').click()
        await expect(memberModal).not.toBeVisible({ timeout: 30000 });

        const appMemberSearch = await page.getByTestId('application-members-search')
        await expect(appMemberSearch).toBeVisible()
        const memberPromise = page.waitForResponse(resp => resp.url().includes(`/organizations/${organization.id}/members`)
            && resp.request().method() === 'GET'
            && resp.ok())
        console.log(`🔎 Searching for created member by email in application members: ${memberDetails.email}`);
        await appMemberSearch.fill(memberDetails.email)
        await memberPromise;
        console.log('🔎 Member list refreshed.');

        const appMemberEditBtn = page.getByTestId(`edit-${member.id}`);
        await expect(appMemberEditBtn).toBeVisible()
        await appMemberEditBtn.click()


        const modalAppPromise = page.waitForResponse(resp => resp.url().includes(`/applications?fields[application]=`)
            && resp.request().method() === 'GET'
            && resp.ok())
        const memberRoleModal = page.getByTestId('member-role-modal')
        await modalAppPromise
        await expect(memberRoleModal).toBeVisible()
        console.log('👁️ Opened member role modal for verification.');

        await page.waitForTimeout(2000); // wait for 2 sec to ensure UI is updated
        // Verify application are checked
        console.log('🔎 Verifying application checkboxes in member role modal...');
        for (let index = 0; index < applications.length; index++) {
            const element = applications[index];
            const appCheck = page.locator(`#view-${element.id}`);
            await expect(appCheck).toBeDefined();
            const isChecked = await appCheck.isChecked();
            console.log(`🔎 Application ${element.id} checked: ${isChecked}`);
            expect(isChecked).toBe(true);
        }

        // verify permissions are checked
        console.log('🔎 Verifying permissions in member role modal...');
        for (const [mainPermission, subPermissions] of Object.entries(permissions)) {
            if (subPermissions.length === 0) {
                const permissionCheckbox = page.getByTestId(`member-permission-checkbox-${mainPermission}`)
                await expect(permissionCheckbox).toBeVisible()
                const isChecked = await permissionCheckbox.isChecked()
                console.log(`🔎 Permission ${mainPermission} checked: ${isChecked}`);
                expect(isChecked).toBe(true)
            } else {
                const mainPermissionSection = page.getByTestId(`member-permission-${mainPermission}`)
                const attribute = await mainPermissionSection.getAttribute('opened')
                if (attribute === false || attribute === 'false') {
                    await mainPermissionSection.click()
                }
                for (let i = 0; i < subPermissions.length; i++) {
                    const subPermission = subPermissions[i];
                    const subPermissionCheckbox = page.getByTestId(`member-permission-checkbox-${subPermission}`)
                    await expect(subPermissionCheckbox).toBeVisible()
                    const isChecked = await subPermissionCheckbox.isChecked()
                    console.log(`🔎 Sub-permission ${subPermission} checked: ${isChecked}`);
                    expect(isChecked).toBe(true)
                }
            }
        }

        await page.getByTestId('member-role-modal-cancel').click()
        await expect(memberRoleModal).not.toBeVisible()

        console.log('➡️ Navigating to organization members page for cross-check...');
        await page.goto(`/organizations/${organization.id}/show`, { waitUntil: 'domcontentloaded' })

        const membersTab = await page.getByTestId('users-tab')

        await expect(membersTab).toBeVisible()
        await membersTab.click()

        const orgMemberSearch = await page.getByTestId('orgnanization-members-search')
        await expect(orgMemberSearch).toBeVisible()
        const orgMemberPromise = page.waitForResponse(resp => resp.url().includes(`/organizations/${organization.id}/members`)
            && resp.request().method() === 'GET'
            && resp.ok())
        console.log(`🔎 Searching for created member on organization page by email: ${memberDetails.email}`);
        await orgMemberSearch.fill(memberDetails.email)
        await orgMemberPromise;
        console.log('🔎 Organization member list refreshed.');

        const orgMemberEditBtn = page.getByTestId(`edit-${member.id}`);
        await expect(orgMemberEditBtn).toBeVisible()
        const orgAppsPromise = page.waitForResponse(resp => resp.url().includes(`/applications?fields[application]=`)
            && resp.request().method() === 'GET'
            && resp.ok())
        await orgMemberEditBtn.click()
        await orgAppsPromise;
        const orgMemberRoleModal = page.getByTestId('member-role-modal')
        await expect(orgMemberRoleModal).toBeVisible()
        console.log('👁️ Opened organization member role modal for verification.');
        await page.waitForTimeout(2000); // wait for 2 sec to ensure UI is updated
        // Verify application are checked
        for (let index = 0; index < applications.length; index++) {
            const element = applications[index];
            const appCheck = page.locator(`#view-${element.id}`);
            await expect(appCheck).toBeDefined();
            const isChecked = await appCheck.isChecked();
            console.log(`🔎 [ORG PAGE] Application ${element.id} checked: ${isChecked}`);
            expect(isChecked).toBe(true);
        }
        // verify permissions are checked
        for (const [mainPermission, subPermissions] of Object.entries(permissions)) {
            if (subPermissions.length === 0) {
                const permissionCheckbox = page.getByTestId(`member-permission-checkbox-${mainPermission}`)
                await expect(permissionCheckbox).toBeVisible()
                const isChecked = await permissionCheckbox.isChecked()
                console.log(`🔎 [ORG PAGE] Permission ${mainPermission} checked: ${isChecked}`);
                expect(isChecked).toBe(true)
            }
            else {
                const mainPermissionSection = page.getByTestId(`member-permission-${mainPermission}`)
                const attribute = await mainPermissionSection.getAttribute('opened')
                if (attribute === false || attribute === 'false') {
                    await mainPermissionSection.click()
                }
                for (let i = 0; i < subPermissions.length; i++) {
                    const subPermission = subPermissions[i];
                    const subPermissionCheckbox = page.getByTestId(`member-permission-checkbox-${subPermission}`)
                    await expect(subPermissionCheckbox).toBeVisible()
                    const isChecked = await subPermissionCheckbox.isChecked()
                    console.log(`🔎 [ORG PAGE] Sub-permission ${subPermission} checked: ${isChecked}`);
                    expect(isChecked).toBe(true)
                }
            }
        }
        await page.getByTestId('member-role-modal-cancel').click()
        await expect(orgMemberRoleModal).not.toBeVisible()

        console.log('✅ Test completed: Permission sync verified.');
    })


    test.afterAll(async ({ request }, testInfo) => {
        console.log('🧹 Test teardown: cleaning up created resources (if any)...');

        if (member && organization && testInfo.status === 'passed') {
            console.log(`🗑️ Deleting member with id: ${member.id} from organization: ${organization.id}`);
            await adminClient.delete(`organizations/${organization.id}/members/${member.id}`);
            console.log(`🗑️ Deleting user with id: ${user.id}`);
            await adminClient.delete(`users/${user.id}`);
            console.log(`✅ Member with id: ${member.id} and user ${user.id} deleted successfully.`);
        } else {
            console.log('ℹ️ No member to delete.');
        }
    });

});