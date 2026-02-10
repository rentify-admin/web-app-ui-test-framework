import { test, expect } from './fixtures/api-data-fixture';
import { ApiDataManager } from './utils/api-data-manager';
import { admin, app } from '~/tests/test_config';
import { checkAllFlagsSection, checkExportPdf, searchSessionWithText } from '~/tests/utils/report-page';
import { loginWith, prepareSessionForFreshSelection } from './utils/session-utils';
import { waitForJsonResponse } from './utils/wait-response';
import { createPermissionTestSession } from './utils/session-generator';
import { cleanupPermissionTest } from './utils/cleanup-helper';

// Global state management for test isolation
let globalStaffUser = null;
let globalDataManager = null;
let sharedSessionId = null;
let allTestsPassed = true;
let adminContextForCleanup = null;  // ✅ Store admin context for later cleanup
let applicantContextForCleanup = null;  // ✅ Store applicant context for later cleanup

// Staff user template (now used with API) - dynamically fetched role and organization
const staffUserTemplate = {
    first_name: 'Staff',
    last_name: 'Playwright',
    password: 'Playwright@123'
    // Role and organization will be fetched dynamically by name
};

// Names to search for (environment-aware)
const roleName = 'Autotest - Staff';
const organizationName = 'Permissions Test Org';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

test.describe('staff_user_permissions_test', () => {
    test.describe.configure({ 
        mode: 'serial', // Ensure tests run in order
        timeout: 240000 // Increased for session creation
    }); 
    
    // ✅ Create session ONCE for all tests
    test.beforeAll(async ({ browser }) => {
        test.setTimeout(300000);
        
        console.log('🏗️ Creating complete session for staff user permission tests...');
        
        // Create admin page manually (page fixture not available in beforeAll)
        const adminContext = await browser.newContext();
        const adminPage = await adminContext.newPage();
        await adminPage.goto('/');
        
        const { sessionId, applicantContext } = await createPermissionTestSession(adminPage, browser, {
            applicationName: 'Autotest - UI permissions tests',
            firstName: 'StaffUser',
            lastName: 'Test',
            email: `staff-user-test-${Date.now()}@verifast.com`,
            rentBudget: '2500'
        });
        
        sharedSessionId = sessionId;
        console.log('✅ Shared session created:', sessionId);
        
        // ✅ Don't close contexts yet - store for cleanup in afterAll
        await adminPage.close();
        adminContextForCleanup = adminContext;  // ✅ Will close in afterAll
        applicantContextForCleanup = applicantContext;  // ✅ Will close in afterAll
    });

    test('Should create member record and assign it to the Staff role', { tag: [ '@regression', '@staging-ready', '@rc-ready' ] }, async ({ page, dataManager }) => {
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
            console.log(`🔍 Fetching organization: "${organizationName}"`);
            const organization = await dataManager.getOrganizationByName(organizationName);
            
            if (!organization) {
                throw new Error(`Organization "${organizationName}" not found. Please ensure the organization exists in the system.`);
            }
            
            console.log(`✅ Organization "${organizationName}" found with ID: ${organization.id}`);

            // Create staff user via API instead of UI
            const prefix = ApiDataManager.uniquePrefix();
            const staffUserData = ApiDataManager.createUserData(prefix, {
                ...staffUserTemplate,
                email: `${prefix}@verifast.com`,
                password_confirmation: staffUserTemplate.password,
                role: role.id, // Dynamically fetched role ID
                organization: organization.id // Dynamically fetched organization ID
            });

            // Create the user via API (now authenticated)
            await dataManager.createEntities({
                users: [staffUserData]
            });

            // Get the created user data
            const { users } = dataManager.getCreated();
            const createdUser = users[0];

            // Verify user was created successfully
            expect(createdUser.id).toBeDefined();
            expect(createdUser.email).toBe(staffUserData.email);

            // Store the created user data globally for other tests
            globalStaffUser = { 
                ...staffUserData, 
                id: createdUser.id 
            };

            console.log('✅ Staff user created successfully via API:', createdUser.email);
        } catch (error) {
            allTestsPassed = false;
            throw error;
        }
    });

    test('Verify permission of Staff role', { tag: [ '@regression', '@staging-ready', '@rc-ready' ] }, async ({ page, context, dataManager }) => {
        try {
            // Use the globally created user
            if (!globalStaffUser) {
                throw new Error('Staff user must be created in the first test before running this test');
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

            console.log('🔍 Debug: globalStaffUser:', globalStaffUser);
            console.log('🔍 Debug: page object:', typeof page);

            // Login as the created staff user to verify permissions
            await loginWith(page, {
                email: globalStaffUser.email,
                password: globalStaffUser.password
            });

            // Verify that these elements are shown in the left hand menu
            expect(page.getByTestId('applicants-menu')).toBeVisible();
            expect(page.getByTestId('applications-menu')).toBeVisible();

            // Click on the Applications menu to expand the menu
            await page.getByTestId('applications-menu').click();
            await page.waitForTimeout(1000);

            // Click on Applications.
            const [ applicationsResponse ] = await Promise.all([
                page.waitForResponse(
                    resp => resp.url().includes('/applications')
                        && resp.request().method() === 'GET'
                        && resp.ok()
                ),
                page.getByTestId('applications-submenu').click()
            ]);
            const { data: applications } = await waitForJsonResponse(
                applicationsResponse
            );

            await page.waitForTimeout(4000);

            // Wait for the applications table to be visible
            const tableLocator = page.locator('table.table');
            await expect(tableLocator).toBeVisible();

            const allTableRaws = tableLocator.locator('tbody tr');
            for (let it = 0;it < applications?.length;it++) {
                await expect(
                    allTableRaws.nth(it).locator('[data-testid="application-table-name-col"]')
                ).toHaveText(applications[it].name);
            }

            // Verify that Edit icon IS visible (new behavior)
            const editIconLocator = page.locator('[data-testid^="edit-"]');
            await expect(editIconLocator.first()).toBeVisible();
            console.log('✅ Edit button is visible for staff user');

            // Verify clicking Edit button does NOT redirect to edit page (staff permission restriction)
            const currentUrl = page.url();
            console.log(`📍 Current URL before click: ${currentUrl}`);
            
            await editIconLocator.first().click();
            await page.waitForTimeout(2000); // Wait for potential navigation
            
            const urlAfterClick = page.url();
            console.log(`📍 URL after edit click: ${urlAfterClick}`);
            
            // Verify user was NOT redirected to edit page
            expect(urlAfterClick).not.toContain('/edit');
            expect(urlAfterClick).toContain('/application'); // Still on applications list
            console.log('✅ Staff user cannot access edit page (no redirect occurred)');

            // Click on Applicant Inbox to expand the menu
            await page.getByTestId('applicants-menu').click();
            await page.getByTestId('applicants-submenu').click();

            // ✅ Use pre-created session
            if (!sharedSessionId) {
                throw new Error('Session must be created in beforeAll');
            }
            
            // ✅ SMART FIX: Prepare session for fresh selection (deselect + search)
            const { locator: topSessionLocator } = await prepareSessionForFreshSelection(page, sharedSessionId);

            // Click OUR session and wait for all API calls (will trigger because it's freshly selected)
            console.log('🖱️ Clicking our session card...');
            const [ empResponse, fileResponse, flagsResponse ] = await Promise.all([
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
                        url.includes('/files') &&
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
                topSessionLocator.click()
            ]);
            
            console.log('✅ Our session opened with all API calls captured!');

            const { data: employments } = await waitForJsonResponse(empResponse);
            const { data: files } = await waitForJsonResponse(fileResponse);
            const { data: flags } = await waitForJsonResponse(flagsResponse);

            await Promise.all([
                page.waitForResponse(
                    resp => resp.url().includes(`/sessions/${sharedSessionId}/events`)
                        && resp.ok()
                        && resp.request().method() === 'GET'
                ),
                page.getByRole('button', { name: 'Alert' }).click()
            ]);

            // Click on the View Details button
            await checkAllFlagsSection(page, flags, { checkIssueButtonPresent: true });

            // Verify that the Flags section is populated
            await expect(
                page.getByTestId('report-view-details-flags-section')
            ).toBeVisible();

            // Verify that the Session Events
            // section is populated on the right side.
            await expect(
                await page.getByTestId('session-activity-time').count()
            ).toBeGreaterThan(0);
            await expect(
                await page.getByTestId('session-activity-data').count()
            ).toBeGreaterThan(0);

            // Close View Details Modal
            await page.getByTestId('close-event-history-modal').click();

            await page.waitForTimeout(500);

            // Export PDF using the updated function that handles the new modal workflow
            await checkExportPdf(page, context, sharedSessionId);

            // Open Identity Section
            await page.getByTestId('identity-section-header').click();

            // Check Idenitity details section visible
            expect(
                page.getByTestId('applicant-identification-details').first()
            ).toBeVisible();

            // Check Idenitity verification section visible
            expect(
                page.getByTestId('applicant-identity-verifications').first()
            ).toBeVisible();

            // Check show images and More details buttons are not visible
            expect(
                page.getByTestId('identity-show-images').first()
            ).not.toBeVisible();
            expect(
                page.getByTestId('identity-more-details').first()
            ).not.toBeVisible();

            // Click on income source section
            const [ incomeResponse ] = await Promise.all([
                page.waitForResponse(
                    resp => resp
                        .url()
                        .includes(`/sessions/${sharedSessionId}/income-sources`)
                        && resp.request().method() === 'GET'
                        && resp.ok()
                ),
                page.getByTestId('income-source-section-header').click()
            ]);

            const { data: incomes } = await waitForJsonResponse(incomeResponse);

            if (incomes.length > 0) {
                // PENDING check list of income source visible
                // Check income source detail and delist buttons are disable
                const incomeSourceDetailBtn = page
                    .getByTestId('income-source-detail-btn')
                    .first();
                const incomeSourceDelistBtn = page
                    .getByTestId('income-source-delist-btn')
                    .first();
                expect(incomeSourceDetailBtn).toBeVisible();
                expect(incomeSourceDetailBtn).toContainClass('pointer-events-none');
                expect(incomeSourceDelistBtn).toBeVisible();
                expect(incomeSourceDelistBtn).toContainClass('pointer-events-none');

                // Check show delisted switch is not visible
                expect(page.getByTestId('show-delisted-pill')).not.toBeVisible();
            }

            // Employment Section
            if (employments.length > 0) {
                // Open employment section
                const empSection = await page.getByTestId('employment-section');
                await empSection.click();

                // Check first table and check
                const tableSection = empSection.locator('table').first();

                const rowCount = await tableSection.locator('tbody>tr').count();

                // Check row count match with response data
                expect(rowCount).toBe(employments.length);

                // Click on view detail button
                await page
                    .locator('[data-testid^="employment-details-view-btn-"]')
                    .first()
                    .click();
                await page.waitForTimeout(1000);

                // Check statement modal is visible or not
                await expect(page.getByTestId('statement-modal')).toBeVisible();

                // Check statement modal row count matching API response statements
                const statementRows = await page
                    .getByTestId('statement-modal')
                    .locator('table>tbody>tr');

                if (employments?.[0].statements.length) {
                    await expect(await statementRows.count()).toBe(
                        employments?.[0].statements.length
                    );
                }

                // Close statement modal
                await page.getByTestId('statement-modal-cancel').click();
            }

            // File Section
            if (files.length > 0) {
                await page.getByTestId('files-section-header').click();

                const fileSection = await page.getByTestId('files-section');

                // Count across ALL tables (multiple applicants in household)
                const rowCount = await fileSection.locator('[data-testid^="all-tr"]').count();

                await expect(rowCount).toBe(files.length);

                const firstRow = fileSection.locator('[data-testid^="all-tr"]').first();

                await firstRow.getByTestId('all-files-view-btn').first()
                    .click();

                await expect(page.getByTestId('view-document-modal')).toBeVisible();
            }
            
            console.log('✅ All staff permission checks passed successfully');
        } catch (error) {
            console.error('❌ Error in test:', error.message);
            allTestsPassed = false;
            throw error;
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
            globalStaffUser,
            allTestsPassed
        );
    });
});
