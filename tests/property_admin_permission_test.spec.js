import { expect, test } from './fixtures/api-data-fixture';
import { admin, app } from '~/tests/test_config';
import { joinUrl } from './utils/helper';
import { waitForJsonResponse } from './utils/wait-response';
import { searchSessionWithText } from './utils/report-page';
import * as reportUtils from './utils/report-page';
import { loginWith, findSessionLocator } from './utils/session-utils';
import { checkApplicationDeletable, checkApplicationEditable } from '~/tests/utils/applications-page';
import { dragAndDrop, gotoPage } from '~/tests/utils/common';
import * as orgUtils from './utils/organizations-page';
import { checkRolesVisibleInTable } from '~/tests/utils/roles-page';
import { ApiDataManager } from './utils/api-data-manager';

// Global state management for test isolation
let globalPropertyAdminUser = null;
let globalDataManager = null;

// Role name to search for
const roleName = 'Autotest - Property Admin';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

const sessionId = '01971d54-6284-70c4-8180-4eee1abd955a';

test.describe('property_admin_permission_test', () => {
    test.describe.configure({ 
        mode: 'serial', // Ensure tests run in order
        timeout: 180000 
    }); 

    test('Should create property admin role user via API', { tag: [ '@regression' ] }, async({ page, dataManager }) => {
        // Store global references for other tests
        globalDataManager = dataManager;
        
        // First authenticate with admin user to get API access
        const isAuthenticated = await dataManager.authenticate(admin.email, admin.password);
        if (!isAuthenticated) {
            throw new Error('Authentication failed - cannot create users without API access');
        }

        // Fetch role by name dynamically
        console.log(`🔍 Fetching role: "${roleName}"`);
        const role = await dataManager.getRoleByName(roleName);
        
        if (!role) {
            throw new Error(`Role "${roleName}" not found. Please ensure the role exists in the system.`);
        }
        
        console.log(`✅ Role "${roleName}" found with ID: ${role.id}`);

        // Create property admin user via API instead of UI
        const prefix = ApiDataManager.uniquePrefix();
        const propertyAdminUserData = ApiDataManager.createUserData(prefix, {
            first_name: 'Property Admin',
            last_name: 'Playwright',
            email: `${prefix}@verifast.com`,
            password: 'Playwright@123',
            password_confirmation: 'Playwright@123',
            role: role.id // Use dynamically fetched role ID
        });

        // Create the user via API
        await dataManager.createEntities({
            users: [propertyAdminUserData]
        });

        // Get the created user data
        const { users } = dataManager.getCreated();
        const createdUser = users[0];

        // Verify user was created successfully
        expect(createdUser.id).toBeDefined();
        expect(createdUser.email).toBe(propertyAdminUserData.email);

        // Store the created user data globally for other tests
        globalPropertyAdminUser = { 
            ...propertyAdminUserData, 
            id: createdUser.id 
        };

        console.log('✅ Property Admin user created successfully via API:', createdUser.email);
    });

    test('Verify property admin user permissions', { tag: [ '@regression' ] }, async ({ page, dataManager }) => {
        let testFailed = false;
        
        try {
            // Use the globally created user
            if (!globalPropertyAdminUser) {
                throw new Error('Property Admin user must be created in the first test before running this test');
            }

            // Transfer global data to current test's dataManager for cleanup
            if (globalDataManager && globalDataManager.getCreated().users.length > 0) {
                const createdEntities = globalDataManager.getCreated();
                dataManager.created = { ...createdEntities };
                
                // Also authenticate this dataManager for cleanup
                const isAuthenticated = await dataManager.authenticate(admin.email, admin.password);
                if (!isAuthenticated) {
                    console.warn('⚠️ Could not authenticate current dataManager for cleanup');
                }
                globalDataManager = dataManager; // Update global reference
            }

            // Login with the created property admin user
            await loginWith(page, globalPropertyAdminUser);

            // Check that all main menus are visible for property admin
            for (const menu of [ 'applicants-menu', 'applications-menu', 'organization-menu', 'users-menu' ]) {
                await expect(page.getByTestId(menu)).toBeVisible();
            }

            // Applications: check list, edit, and delete permissions
            const applications = await gotoPage(page, 'applications-menu', 'applications-submenu', '/applications?fields[application]');
            expect(applications?.length || 0).toBeGreaterThan(0);
            await checkApplicationEditable(page);
            await expect(page.locator('[data-testid^=delete-]').first()).toBeVisible();
            await checkApplicationDeletable(page);

            // Try to generate a session and then cancel
            const applicationDiv = page.getByTestId('application-table');
            await applicationDiv.locator('tbody>tr:nth-child(1)>td').nth(6)
                .locator('a')
                .click();
            await expect(page.locator('#generate-session-form')).toBeVisible();
            await page.getByTestId('cancel-generate-session').click();

            // Workflows: try to edit and delete, expect forbidden
            await gotoPage(page, 'applications-menu', 'workflows-submenu', '/workflows?fields[workflow]');
            const workflowTable = page.getByTestId('workflow-table');
            await workflowTable.locator('[data-testid^="edit-"]').first()
                .click();
            await expect(page.getByTestId('error-page')).toContainText('403');
            await page.goBack();

            // Try to delete a workflow in READY status
            const workflowRows = await workflowTable.locator('tbody>tr');
            page.once('dialog', dialog => dialog.accept());
            for (let i = 0;i < await workflowRows.count();i++) {
                const element = workflowRows.nth(i);
                if ((await element.locator('td').nth(3)
                    .textContent()).includes('READY')) {
                    await element.locator('td').locator('[data-testid^="delete-"]')
                        .click();
                    break;
                }
            }
            await expect(page.locator('[role=alert]').first()).toContainText('Forbidden');

            // Approval conditions: try to view and open a "high risk" condition
            await gotoPage(page, 'applications-menu', 'approval-conditions-submenu', '/flag-collections?');
            const approvalConditionTable = await page.getByTestId('approval-conditions-table');
            const tableRows = await approvalConditionTable.locator('tbody>tr');
            const approvalGetUrlReg = new RegExp(`.+/flag-collections/.{36}?.+`);
            for (let i = 0;i < await tableRows.count();i++) {
                const element = tableRows.nth(i);
                if ((await element.nth(0).textContent()).toLowerCase().includes('high risk')) {
                    await Promise.all([
                        page.waitForResponse(resp => approvalGetUrlReg.test(resp.url()) && resp.request().method() === 'GET' && resp.ok()),
                        element.locator('td').nth(1)
                            .locator('button')
                            .click()
                    ]);
                    break;
                }
            }

            // Ensure no edit links are visible in approval conditions
            const conditionRows = page.locator('table>tbody>tr');
            for (let i = 0;i < await conditionRows.count();i++) {
                await expect((await conditionRows.locator('td').nth(4)).locator('a')).not.toBeVisible();
            }

            // Edit organization info and check for success toast
            await gotoPage(page, 'organization-menu', 'organization-self-submenu', '/organizations/self');
            await page.getByTestId('organization-edit-btn').click();
            const editOrganizationModal = await page.getByTestId('organization-edit-modal');
            await page.waitForTimeout(300);
            for (const city of [ 'Townsville', 'Groverville' ]) {
                await editOrganizationModal.locator('#organization-city').fill(city);
                await Promise.all([
                    page.waitForResponse(resp => /.+\/organizations\/.{36}/.test(resp.url()) && resp.request().method() === 'PATCH' && resp.ok()),
                    editOrganizationModal.getByTestId('organization-submit').click()
                ]);
                await expect(page.locator('.vf-toast__item--success').first()).toBeVisible();
            }
            await page.getByTestId('close-organization-modal').click();

            // Try to create an application and then cancel
            await page.getByTestId('org-app-create-btn').click();
            await expect(page).toHaveURL(/application\/create/);
            await page.getByTestId('cancel-application-setup').click();

            // Organization members: add, check, give permission, and delete
            await gotoPage(page, 'organization-menu', 'organization-self-submenu', '/organizations/self');
            await orgUtils.gotoMembersPage(page);
            await Promise.all([
                page.waitForResponse(resp => resp.url().includes(joinUrl(app.urls.api, 'roles')) && resp.request().method() === 'GET' && resp.ok()),
                page.getByTestId('create-org-member-btn').click()
            ]);
            const orgMemberCreateModal = await page.getByTestId('org-user-create-modal');
            await expect(orgMemberCreateModal).toBeVisible();
            const staffEmail = `admin_test+${ApiDataManager.uniquePrefix()}@verifast.com`;
            const userData = { email: staffEmail, role: 'Staff' };
            await orgUtils.addOrganizationMember(page, userData, orgMemberCreateModal);
            await orgUtils.checkFirstRowHasEmail(page, userData.email);
            await orgUtils.addManageAppPermissionAndCheck(page, await page.getByTestId('members-table').locator('tbody>tr')
                .nth(0)
                .locator('[data-testid^=edit-]'));
            await orgUtils.deleteMember(page, await page.getByTestId('members-table').locator('tbody>tr')
                .nth(0)
                .locator('[data-testid^=delete-]'));
            // Check that "No Record Found" message is displayed after member deletion
            await expect(page.locator('span:has-text("No Record Found")')).toBeVisible();

            // Alternative member modal: add, check, give permission, and delete
            await gotoPage(page, 'organization-menu', 'members-submenu', new RegExp('.+organizations/.{36}/members.+'), true);
            await page.getByTestId('create-member-btn').click();
            const memberCreateModal = await page.getByTestId('create-member-modal');
            await expect(memberCreateModal).toBeVisible();
            await orgUtils.addOrganizationMember(page, userData, memberCreateModal);
            await orgUtils.checkFirstRowHasEmail(page, userData.email);
            await orgUtils.addManageAppPermissionAndCheck(page, await page.getByTestId('members-table').locator('tbody>tr')
                .nth(0)
                .locator('[data-testid^=edit-]'));
            await orgUtils.deleteMember(page, await page.getByTestId('members-table').locator('tbody>tr')
                .nth(0)
                .locator('[data-testid^=delete-]'));
            // Check that "No Record Found" message is displayed after member deletion
            await expect(page.locator('span:has-text("No Record Found")')).toBeVisible();

            // Check roles table is visible
            const roles = await gotoPage(page, 'users-menu', 'roles-submenu', joinUrl(app.urls.api, 'roles?'));
            await checkRolesVisibleInTable(page, roles);
            
            console.log('✅ All property admin permission checks passed successfully');
            
        } catch (error) {
            console.error('❌ Error in test:', error.message);
            testFailed = true;
            throw error; // Re-throw immediately to fail the test
        }
        // Note: No cleanup here - user is needed for the next test
    });

    test('Check applicant inbox permissions', { tag: [ '@regression' ] }, async ({ page, context, dataManager }) => {
        let testFailed = false;
        
        try {
            // Use the globally created user
            if (!globalPropertyAdminUser) {
                throw new Error('Property Admin user must be created in the first test before running this test');
            }

            // Transfer global data to current test's dataManager for cleanup
            if (globalDataManager && globalDataManager.getCreated().users.length > 0) {
                const createdEntities = globalDataManager.getCreated();
                dataManager.created = { ...createdEntities };
                
                // Also authenticate this dataManager for cleanup
                const isAuthenticated = await dataManager.authenticate(admin.email, admin.password);
                if (!isAuthenticated) {
                    console.warn('⚠️ Could not authenticate current dataManager for cleanup');
                }
                globalDataManager = dataManager; // Update global reference
            }

            // Login with the created property admin user first
            console.log(`🚀 ~ Login with property admin user: ${globalPropertyAdminUser.email}`);
            await loginWith(page, globalPropertyAdminUser);
            console.log('✅ Property admin user logged in successfully');

            // Search for sessions by text and select one with children
            const searchText = 'Prop Admin Test App';
            const sessions = await reportUtils.searchSessionWithText(page, searchText);
            expect(sessions.length).toBeGreaterThan(0);
            const [ session ] = sessions;

            // .filter(ses => ses.children?.length > 0);
            const sessionTileEl = await page.locator(`.application-card[data-session="${session.id}"]`);
            await expect(sessionTileEl).toBeVisible();

            const allSessionWithChildren = [ session, ...session.children ].filter(Boolean);

            // Wait for and parse all required responses for files, financials, and employments
            const [ filesResponses, financialResponses, employmentResponse, flagResponse ] = await Promise.all([
                Promise.all(allSessionWithChildren.map(sess => page.waitForResponse(resp => resp.url().includes(`/sessions/${sess.id}/files`)
                        && resp.request().method() === 'GET'
                        && resp.ok()))),
                Promise.all(allSessionWithChildren.map(sess => {

                    // Simplified pattern for financial-verifications with session id
                    return page.waitForResponse(resp => {
                        const url = decodeURI(resp.url());
                        return url.includes('/financial-verifications') 
                            && url.includes(sess.id)
                            && resp.request().method() === 'GET'
                            && resp.ok();
                    });
                })),
                page.waitForResponse(resp => resp.url().includes(`/sessions/${session.id}/employments`)
                    && resp.request().method() === 'GET'
                    && resp.ok()),
                page.waitForResponse(resp => resp.url().includes(`/sessions/${session.id}/flags`)
                    && resp.request().method() === 'GET'
                    && resp.ok()),
                sessionTileEl.click()
            ]);

            // Parse JSON responses
            const { data: employments } = await waitForJsonResponse(employmentResponse);
            const { data: flags } = await waitForJsonResponse(flagResponse);
            const filesData = await Promise.all(filesResponses.map(waitForJsonResponse));
            const financialData = await Promise.all(financialResponses.map(waitForJsonResponse));

            // UI and permission checks using report utils
            await Promise.all([
                page.waitForResponse(resp => resp.url().includes(`/sessions/${session.id}/events`)
                    && resp.ok()
                    && resp.request().method() === 'GET'),
                page.getByTestId('view-details-btn').click()
            ]);

            await reportUtils.checkAllFlagsSection(page, flags, { checkIssueButtonPresent: false });
            await expect(page.getByTestId('report-view-details-flags-section')).toBeVisible();
            await expect(await page.getByTestId('session-activity-time').count()).toBeGreaterThan(0);
            await expect(await page.getByTestId('session-activity-data').count()).toBeGreaterThan(0);
            await page.getByTestId('close-event-history-modal').click();
            await page.waitForTimeout(500);

            await reportUtils.checkRentBudgetEdit(page);
            await reportUtils.checkSessionApproveReject(page, session.id);
            await reportUtils.checkExportPdf(page, context, session.id);

            // Check ability to request additional documents and invite applicant
            const availableChecks = [
                'financial_connection',
                'pay_stub',
                'bank_statement',
                'identity_verification'
            ];
            await reportUtils.canRequestAdditionalDocuments(page, availableChecks);
            await reportUtils.canInviteApplicant(page);

            // Check ability to upload documents
            const documents = [
                'Employment/Offer letter',
                'Paystub',
                'Bank Statement',
                'Veterans Affairs Benefits letter',
                'Tax Statement (1040)'
            ];
            await reportUtils.canUploadListOfDocuments(page, documents);

            // Check merge session functionality
            const { baseSession, mainSection } = await reportUtils.checkMergeWithDragAndDrop(page, sessions);
            await reportUtils.canMergeSession(sessions, page);

            // Remove child from household and cancel
            const [ child ] = baseSession.children;
            const childRaw = await mainSection.getByTestId(`raw-${child.id}`);
            const nameColumn = await childRaw.locator('td').nth(1);
            await nameColumn.getByTestId('overview-applicant-btn').click();
            await nameColumn.locator('[data-testid^=remove-from-household-]').click();
            const houseHoldModal = await page.getByTestId('confirm-box');
            await expect(houseHoldModal).toBeVisible();
            await houseHoldModal.getByTestId('cancel-btn').click();

            // Check identity, income, employment, files, and financial sections
            await reportUtils.checkIdentityDetailsAvailable(page, { checkSsn: true });
            await reportUtils.checkIncomeSourceSection(page, session.id);
            await reportUtils.checkEmploymentSectionData(page, employments);
            await reportUtils.checkFilesSectionData(page, session, sessionTileEl, filesData);
            await reportUtils.checkFinancialSectionData(page, session, sessionTileEl, financialData);
            
            console.log('✅ All applicant inbox permission checks passed successfully');
            
        } catch (error) {
            console.error('❌ Error in test:', error.message);
            testFailed = true;
            throw error; // Re-throw immediately to fail the test
        } finally {
            // Only cleanup if test PASSED (not on failure)
            if (!testFailed && dataManager && dataManager.getCreated().users.length > 0) {
                console.log('🧹 Test passed - cleaning up test user');
                console.log('🔍 User to cleanup:', globalPropertyAdminUser?.email);
                try {
                    await dataManager.cleanupAll();
                    console.log('🧹 Test user cleanup completed successfully');
                } catch (cleanupError) {
                    console.error('❌ Cleanup failed but continuing:', cleanupError.message);
                }
            } else if (testFailed) {
                console.log('⚠️ Test failed - keeping user for debugging');
                console.log('🔍 User email for debugging:', globalPropertyAdminUser?.email);
            }
        }
    });
});


