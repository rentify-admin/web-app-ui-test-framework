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
import { cleanupPermissionTest, cleanupOrganizationMembers } from './utils/cleanup-helper';
import { resolveAllFlagsUntilApproveClickable } from './utils/robust-flag-resolver';

// Global state management for test isolation
let globalPropertyAdminUser = null;
let globalDataManager = null;
let sharedSessionId = null;
let allTestsPassed = true;
let adminContextForCleanup = null;  // ✅ Store admin context for later cleanup
let applicantContextForCleanup = null;  // ✅ Store applicant context for later cleanup
let createdMemberIds = [];  // ✅ Track created member IDs for cleanup
let organizationId = null;  // ✅ Store organization ID for member cleanup

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
            rentBudget: '2500',
            useCorrectMockData: true // ✅ Use flag-free corrected mock data
        });
        
        sharedSessionId = sessionId;
        console.log('✅ Shared session created:', sessionId);
        
        // ✅ Don't close contexts yet - store for cleanup in afterAll
        await adminPage.close();
        adminContextForCleanup = adminContext;  // ✅ Will close in afterAll
        applicantContextForCleanup = applicantContext;  // ✅ Will close in afterAll
    });

    test('Should create property admin role user via API', { tag: [ '@regression' , '@staging-ready', '@rc-ready'] }, async({ page, dataManager }) => {
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
        // Store organization ID for member cleanup
        organizationId = organization.id;

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

    test('Verify property admin user permissions', { tag: [ '@regression', '@staging-ready', '@rc-ready' ] }, async ({ page, context, dataManager }) => {
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
            await applicationDiv.locator('tbody>tr:nth-child(1)')
                .getByTestId('application-table-invite-col')
                .locator('a')
                .click();
            await expect(page.locator('#generate-session-form')).toBeVisible();
            await page.waitForTimeout(1500);
            await page.getByTestId('cancel-generate-session').click();

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

            // Organization members: add, check, give permission, and archive
            await gotoPage(page, 'organization-menu', 'organization-self-submenu', '/organizations/self');
            await orgUtils.gotoMembersPage(page);
            await Promise.all([
                page.waitForResponse(resp => resp.url().includes(joinUrl(app.urls.api, 'roles')) && resp.request().method() === 'GET' && resp.ok()),
                page.getByTestId('create-org-member-btn').click()
            ]);
            const orgMemberCreateModal = await page.getByTestId('org-user-create-modal');
            await expect(orgMemberCreateModal).toBeVisible();
            const staffEmail1 = `admin_test+${ApiDataManager.uniquePrefix()}@verifast.com`;
            const userData1 = { email: staffEmail1, role: 'Autotest - Staff' }; // Use Autotest role to avoid permission mismatches
            const memberResult1 = await orgUtils.addOrganizationMember(page, userData1, orgMemberCreateModal);
            // Store member ID and organization ID for cleanup
            if (memberResult1?.member?.id) {
                createdMemberIds.push(memberResult1.member.id);
            }
            // Extract organization ID from response if not already set
            if (!organizationId && memberResult1?.organizationId) {
                organizationId = memberResult1.organizationId;
            }
            // Search for the member we just created to ensure we're working with the right one
            await orgUtils.checkFirstRowHasEmail(page, userData1.email);
            // Get the archive button for the member we just created (first row after search)
            const archiveBtn1 = page.getByTestId('members-table').locator('tbody>tr')
                .nth(0)
                .locator('[data-testid^=archive-]');
            await expect(archiveBtn1).toBeVisible();
            // ✅ VC-2225: Property Admin is external role, cannot manage permissions
            // Verify that permission management is NOT available (expected behavior)
            await orgUtils.verifyExternalRoleCannotManagePermissions(page, await page.getByTestId('members-table').locator('tbody>tr')
                .nth(0)
                .locator('[data-testid^=edit-]'));
            await orgUtils.archiveMember(page, archiveBtn1);
            // Check that "No Record Found" message is displayed after member archiving
            await expect(page.locator('span:has-text("No Record Found")')).toBeVisible();

            // Alternative member modal: add, check, give permission, and archive
            await gotoPage(page, 'organization-menu', 'members-submenu', new RegExp('.+organizations/.{36}/members.+'), true);
            await page.getByTestId('create-member-btn').click();
            const memberCreateModal = await page.getByTestId('create-member-modal');
            await expect(memberCreateModal).toBeVisible();
            // Create a NEW member with a different email (cannot reuse archived member's email)
            const staffEmail2 = `admin_test+${ApiDataManager.uniquePrefix()}@verifast.com`;
            const userData2 = { email: staffEmail2, role: 'Autotest - Staff' };
            const memberResult2 = await orgUtils.addOrganizationMember(page, userData2, memberCreateModal);
            // Store member ID for cleanup
            if (memberResult2?.member?.id) {
                createdMemberIds.push(memberResult2.member.id);
            }
            // Search for the new member we just created
            await orgUtils.checkFirstRowHasEmail(page, userData2.email);
            // Get the archive button for the member we just created (first row after search)
            const archiveBtn2 = page.getByTestId('members-table').locator('tbody>tr')
                .nth(0)
                .locator('[data-testid^=archive-]');
            await expect(archiveBtn2).toBeVisible();
            // ✅ VC-2225: Property Admin is external role, cannot manage permissions
            // Verify that permission management is NOT available (expected behavior)
            await orgUtils.verifyExternalRoleCannotManagePermissions(page, await page.getByTestId('members-table').locator('tbody>tr')
                .nth(0)
                .locator('[data-testid^=edit-]'));
            await orgUtils.archiveMember(page, archiveBtn2);
            // Check that "No Record Found" message is displayed after member archiving
            await expect(page.locator('span:has-text("No Record Found")')).toBeVisible();

            console.log('✅ All property admin permission checks passed successfully');
            
        } catch (error) {
            console.error('❌ Error in test:', error.message);
            allTestsPassed = false;
            throw error; // Re-throw immediately to fail the test
        }
        // Note: No cleanup here - user is needed for the next test
    });

    test('Check applicant inbox permissions', { tag: [ '@regression', '@staging-ready', '@rc-ready' ] }, async ({ page, context, dataManager }) => {
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
                        resp.request().method() === 'HEAD' &&
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
                page.getByRole('button', { name: 'Alert' }).click()
            ]);

            await reportUtils.checkAllFlagsSection(page, flags, { checkIssueButtonPresent: false });
            await expect(page.getByTestId('report-view-details-flags-section')).toBeVisible();
            await expect(await page.getByTestId('session-activity-time').count()).toBeGreaterThan(0);
            await expect(await page.getByTestId('session-activity-data').count()).toBeGreaterThan(0);
            await page.getByTestId('close-event-history-modal').click();
            await page.waitForTimeout(500);

            await reportUtils.checkRentBudgetEdit(page);
            
            // ✅ ROBUST FLAG RESOLUTION: Resolve all flags until approve button is clickable
            console.log('🏴 Starting robust flag resolution...');
            await resolveAllFlagsUntilApproveClickable(page, sharedSessionId, {
                maxFlagResolutionCycles: 10,
                maxFlagsPerCycle: 20,
                flagResolutionTimeout: 10000,
                backendProcessingWait: 3000,
                maxApproveButtonPollAttempts: 30,
                approveButtonPollInterval: 2000
            });
            console.log('✅ All flags resolved and approve button is clickable');
            
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
        }
        // Note: All cleanup (user + session + contexts) happens in afterAll
    });
    
    // ✅ Centralized cleanup
    test.afterAll(async ({ request }) => {
        console.log('🧹 Starting cleanup in property_admin_permission_test.spec.js...');
        
        // Clean up archived members via API (always cleanup members, even on test failure)
        if (organizationId && createdMemberIds.length > 0) {
            console.log(`🧹 Cleaning up ${createdMemberIds.length} archived member(s)...`);
            await cleanupOrganizationMembers(request, organizationId, createdMemberIds, true);
        }
        
        // Clean up session, contexts, and user
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


