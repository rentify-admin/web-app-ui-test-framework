import { expect, test } from './fixtures/api-data-fixture';
import { admin, app } from '~/tests/test_config';
import { joinUrl } from './utils/helper';
import { waitForJsonResponse } from './utils/wait-response';
import { searchSessionWithText } from './utils/report-page';
import * as reportUtils from './utils/report-page';
import { loginWith, findSessionLocator, prepareSessionForFreshSelection } from './utils/session-utils';
import { checkApplicationDeletable, checkApplicationEditable } from '~/tests/utils/applications-page';
import { gotoPage } from '~/tests/utils/common';
import * as orgUtils from './utils/organizations-page';
import { checkRolesVisibleInTable } from '~/tests/utils/roles-page';
import { ApiDataManager } from './utils/api-data-manager';
import { createPermissionTestSession } from './utils/session-generator';
import { cleanupPermissionTest } from './utils/cleanup-helper';

// Global state management for test isolation
let globalPropertyAdminUser = null;
let globalDataManager = null;
let sharedSessionId = null;
let allTestsPassed = true;
let adminContextForCleanup = null;  // ✅ Store admin context for later cleanup
let applicantContextForCleanup = null;  // ✅ Store applicant context for later cleanup

// Role name to search for
const roleName = 'Autotest - Property Admin';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

test.describe('property_admin_permission_test', () => {
    test.describe.configure({ 
        mode: 'serial', // Ensure tests run in order
        timeout: 240000 // Increased from 180s to 240s for session creation
    });
    
    // ✅ Create session ONCE for all tests
    test.beforeAll(async ({ browser }) => {
        // ✅ Set explicit timeout for beforeAll hook (300s = 5 minutes)
        test.setTimeout(300000);
        
        console.log('🏗️ Creating complete session for property admin permission tests...');
        
        // Create admin page manually (page fixture not available in beforeAll)
        const adminContext = await browser.newContext();
        const adminPage = await adminContext.newPage();
        await adminPage.goto('/');
        
        const { sessionId, applicantContext } = await createPermissionTestSession(adminPage, browser, {
            applicationName: 'Autotest - UI permissions tests',
            firstName: 'PropAdmin',
            lastName: 'Test',
            email: `prop-admin-test-${Date.now()}@verifast.com`,
            rentBudget: '2500'
        });
        
        sharedSessionId = sessionId;
        console.log('✅ Shared session created:', sessionId);
        
        // ✅ Don't close contexts yet - store for cleanup in afterAll
        await adminPage.close();
        adminContextForCleanup = adminContext;  // ✅ Will close in afterAll
        applicantContextForCleanup = applicantContext;  // ✅ Will close in afterAll
    });

    test('Should create property admin role user via API', { tag: [ '@regression' , '@staging-ready'] }, async({ page, dataManager }) => {
        try {
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

        // Fetch organization by name dynamically
        const organizationName = 'Permissions Test Org';
        console.log(`🔍 Fetching organization: "${organizationName}"`);
        const organization = await dataManager.getOrganizationByName(organizationName);
        
        if (!organization) {
            throw new Error(`Organization "${organizationName}" not found. Please ensure the organization exists in the system.`);
        }
        
        console.log(`✅ Organization "${organizationName}" found with ID: ${organization.id}`);

        // Create property admin user via API instead of UI
        const prefix = ApiDataManager.uniquePrefix();
        const propertyAdminUserData = ApiDataManager.createUserData(prefix, {
            first_name: 'Property Admin',
            last_name: 'Playwright',
            email: `${prefix}@verifast.com`,
            password: 'Playwright@123',
            password_confirmation: 'Playwright@123',
            role: role.id, // Dynamically fetched role ID
            organization: organization.id // Dynamically fetched organization ID
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
            console.log('✅ Test 1 passed');
        } catch (error) {
            allTestsPassed = false;
            throw error;
        }
    });

    test('Verify property admin user permissions', { tag: [ '@regression', '@staging-ready' ] }, async ({ page, context, dataManager }) => {
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
            console.log(`🚀 ~ Login with property admin user: ${globalPropertyAdminUser.email}`);
            await loginWith(page, globalPropertyAdminUser);
            console.log('✅ Property admin user logged in successfully');

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
            const userData = { email: staffEmail, role: 'Autotest - Staff' }; // Use Autotest role to avoid permission mismatches
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

    test('Check applicant inbox permissions', { tag: [ '@regression', '@staging-ready' ] }, async ({ page, context, dataManager }) => {
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

            // ✅ Use pre-created session (not search)
            if (!sharedSessionId) {
                throw new Error('Session must be created in beforeAll');
            }
            
            // ✅ SMART FIX: Prepare session for fresh selection (deselect + search)
            const { locator: sessionTileEl } = await prepareSessionForFreshSelection(page, sharedSessionId);
            
            // Click OUR session and wait for all API calls (will trigger because it's freshly selected)
            console.log('🖱️ Clicking our session card...');
            const [ filesResponse, financialResponse, employmentResponse, flagResponse ] = await Promise.all([
                page.waitForResponse(resp => {
                    const url = decodeURI(resp.url());
                    return url.includes('/sessions/') && 
                        url.includes(sharedSessionId) &&
                        url.includes('/files') &&
                        resp.request().method() === 'GET' &&
                        resp.ok();
                }),
                page.waitForResponse(resp => {
                    const url = decodeURI(resp.url());
                    return url.includes('/financial-verifications') && 
                        url.includes(sharedSessionId) &&
                        resp.request().method() === 'GET' &&
                        resp.ok();
                }),
                page.waitForResponse(resp => {
                    const url = decodeURI(resp.url());
                    return url.includes('/sessions/') && 
                        url.includes(sharedSessionId) &&
                        url.includes('/employments') &&
                        resp.request().method() === 'GET' &&
                        resp.ok();
                }),
                page.waitForResponse(resp => {
                    const url = decodeURI(resp.url());
                    return url.includes('/sessions/') && 
                        url.includes(sharedSessionId) &&
                        url.includes('/flags') &&
                        resp.request().method() === 'GET' &&
                        resp.ok();
                }),
                sessionTileEl.click()
            ]);
            
            console.log('✅ Our session opened with all API calls captured!');

            // Parse JSON responses (single responses, not arrays)
            const { data: employments } = await waitForJsonResponse(employmentResponse);
            const { data: flags } = await waitForJsonResponse(flagResponse);
            const filesData = await waitForJsonResponse(filesResponse);
            const financialData = await waitForJsonResponse(financialResponse);

            // UI and permission checks using report utils
            await Promise.all([
                page.waitForResponse(resp => resp.url().includes(`/sessions/${sharedSessionId}/events`)
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
            
            // ✅ RESOLVE FLAGS BEFORE APPROVAL: Mark all flags as non-issue
            console.log('🏴 Checking for flags that require review...');
            await page.getByTestId('view-details-btn').click();
            await page.waitForTimeout(2000);
            
            const itemsRequiringReview = page.getByTestId('items-requiring-review-section');
            const hasFlags = await itemsRequiringReview.count() > 0;
            
            if (hasFlags) {
                console.log('   ⚠️ Flags requiring review found - marking as non-issue...');
                const flagItems = await itemsRequiringReview.locator('li[id^="flag-"]').all();
                console.log(`   📊 Found ${flagItems.length} flag(s) to resolve`);
                
                for (let i = 0; i < flagItems.length; i++) {
                    const flagItem = flagItems[i];
                    const flagId = await flagItem.getAttribute('id');
                    console.log(`   🏴 Resolving flag ${i + 1}/${flagItems.length}: ${flagId}`);
                    
                    // Click "mark as non-issue" button
                    const markAsNonIssueBtn = flagItem.getByTestId('mark_as_non_issue');
                    await markAsNonIssueBtn.click();
                    await page.waitForTimeout(500);
                    
                    // Click "Mark as Non Issue" submit button (without commentary)
                    const submitBtn = page.getByRole('button', { name: 'Mark as Non Issue' });
                    await submitBtn.click();
                    await page.waitForTimeout(2000);
                    
                    console.log(`   ✅ Flag ${i + 1} resolved`);
                }
                
                console.log('   ✅ All flags marked as non-issue');
                await page.waitForTimeout(5000); // Wait for backend to process
            } else {
                console.log('   ✅ No flags requiring review');
            }
            
            // Close event history modal
            await page.getByTestId('close-event-history-modal').click();
            await page.waitForTimeout(1000);
            console.log('✅ Flags resolved and modal closed');
            
            // ✅ RELOAD page to ensure fresh state
            console.log('🔄 Reloading page to refresh state...');
            await page.reload();
            await expect(page.getByTestId('household-status-alert')).toBeVisible({ timeout: 10000 });
            console.log('✅ Page reloaded and household visible');
            
            // ✅ NOW test approve/reject (session should be approvable)
            await reportUtils.checkSessionApproveReject(page, sharedSessionId);
            await reportUtils.checkExportPdf(page, context, sharedSessionId);

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

            // ❌ REMOVED: Drag & drop merge and household tests
            // These are now covered in separate ticket: QA_TICKET_DRAG_DROP_MERGE.md
            // This test focuses on permission checks only

            // Check identity, income, employment, files, and financial sections
            await reportUtils.checkIdentityDetailsAvailable(page, { checkSsn: true });
            await reportUtils.checkIncomeSourceSection(page, sharedSessionId);
            await reportUtils.checkEmploymentSectionData(page, employments);
            
            // ✅ SIMPLIFIED: Pass session object for files/financial checks (no children array)
            const sessionForChecks = { 
                id: sharedSessionId, 
                children: [] 
            };
            await reportUtils.checkFilesSectionData(page, sessionForChecks, sessionTileEl, [filesData]);
            await reportUtils.checkFinancialSectionData(page, sessionForChecks, sessionTileEl, [financialData]);
            
            console.log('✅ All applicant inbox permission checks passed successfully');
            console.log('✅ Test 3 passed');
            
        } catch (error) {
            console.error('❌ Error in test:', error.message);
            allTestsPassed = false;
            throw error;
        } finally {
            // Only cleanup user if test PASSED (session cleanup in afterAll)
            const testFailed = !allTestsPassed;
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
    
    // ✅ Centralized cleanup
    test.afterAll(async ({ request }) => {
        // ✅ Centralized cleanup: session + contexts + user
        await cleanupPermissionTest(
            request,
            sharedSessionId,
            applicantContextForCleanup,
            adminContextForCleanup,
            globalDataManager,
            globalPropertyAdminUser,
            allTestsPassed
        );
    });
});


