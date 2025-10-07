import { test, expect, registerTest, testWithCleanup } from './fixtures/enhanced-cleanup-fixture';
import { ApiDataManager } from './utils/api-data-manager';
import { admin } from '~/tests/test_config';
import loginForm from '~/tests/utils/login-form';
import { checkAllFlagsSection, checkExportPdf, searchSessionWithText } from '~/tests/utils/report-page';
import { loginWith } from './utils/session-utils';
import globalCleanupManager from './utils/global-cleanup-manager';

// import { joinUrl } from './utils/helper';
import { waitForJsonResponse } from './utils/wait-response';

// Global state management for test isolation
let globalStaffUser = null;

// Staff user template (now used with API) - dynamically fetched role
const isStaging = process.env.APP_ENV === 'staging';
const staffUserTemplate = {
    first_name: 'Staff',
    last_name: 'Playwright',
    password: 'Playwright@123',
    // Role will be fetched dynamically by name
    organization: isStaging ? '0196cb22-5da4-715a-a89d-3ad36eeacf7d' : '01971d42-96b6-7003-bcc9-e54006284a7e' // Test Org / Permissions Test Org
};

// Role name to search for
const roleName = 'Autotest - Staff';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

// Environment-dependent session ID (same as admin test)
const sessionID = isStaging 
    ? '01992a4a-825f-7242-bc27-65f120f3398b'  // Staging session
    : '01986591-71eb-7079-b91f-398816e65fee'; // Dev session

test.describe('staff_user_permissions_test', () => {
    test.describe.configure({ 
        mode: 'serial', // Ensure tests run in order
        timeout: 180000 
    }); 

    // Register the test suite (2 tests total)
    const SUITE_NAME = 'staff_user_permissions_test';
    const TOTAL_TESTS = 2;

    // Ensure cleanup happens even if tests fail completely
    test.afterAll(async ({ dataManager }) => {
        const suiteId = `suite_${SUITE_NAME}`;
        console.log(`🧹 Suite Cleanup: Running afterAll cleanup for suite ${SUITE_NAME}`);
        try {
            await globalCleanupManager.cleanupTest(suiteId, dataManager);
            console.log(`✅ Suite Cleanup: Completed afterAll cleanup for suite ${SUITE_NAME}`);
        } catch (error) {
            console.error(`❌ Suite Cleanup: Failed afterAll cleanup for suite ${SUITE_NAME}:`, error.message);
        }
    });
    
    testWithCleanup('Should create member record and assign it to the Staff role @regression @staging-correct', async ({ page, dataManager, cleanupHelper }) => {
        // Register this test in the suite
        registerTest(SUITE_NAME, 'Should create member record and assign it to the Staff role', TOTAL_TESTS);
        
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

        // Create staff user via API instead of UI
        const prefix = ApiDataManager.uniquePrefix();
        const staffUserData = ApiDataManager.createUserData(prefix, {
            ...staffUserTemplate,
            email: `${prefix}@verifast.com`,
            password_confirmation: staffUserTemplate.password,
            role: role.id // Use dynamically fetched role ID
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

        // Track user for enhanced cleanup (will only be cleaned up on last test)
        const suiteId = `suite_${SUITE_NAME}`;
        cleanupHelper.trackUser(createdUser, suiteId);

        console.log('✅ Staff user created successfully via API:', createdUser.email);
        console.log('📝 User tracked for enhanced cleanup (will be cleaned up on last test only)');
    });

    testWithCleanup('Verify permission of Staff role @regression @staging-correct', async ({ page, context, dataManager, cleanupHelper }) => {
        // Register this test in the suite (LAST TEST)
        registerTest(SUITE_NAME, 'Verify permission of Staff role', TOTAL_TESTS);
        
        // Use the globally created user
        if (!globalStaffUser) {
            throw new Error('Staff user must be created in the first test before running this test');
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
                allTableRaws.nth(it).locator('td:nth-child(1)')
            ).toHaveText(applications[it].name);
        }

        // Verify that there is NO Edit icon
        const editIconLocator = page.locator('[data-testid^="edit-"]');
        await expect(editIconLocator).toHaveCount(0);

        // Click on Applicant Inbox to expand the menu
        await page.getByTestId('applicants-menu').click();
        await page.getByTestId('applicants-submenu').click();

        // Search for session using session UUID (same as admin test)
        const searchSessions = await searchSessionWithText(page, sessionID);

        // Find the session locator using the dynamic session ID
        const topSessionLocator = page.locator(`.application-card[data-session="${sessionID}"]`);
        const [ empResponse, fileResponse, flagsResponse ] = await Promise.all([
            page.waitForResponse(
                resp => resp.url().includes(`/sessions/${sessionID}/employments`)
                    && resp.request().method() === 'GET'
                    && resp.ok()
            ),
            page.waitForResponse(
                resp => resp.url().includes(`/sessions/${sessionID}/files`)
                    && resp.request().method() === 'GET'
                    && resp.ok()
            ),
            page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionID}/flags`)
                && resp.request().method() === 'GET'
                && resp.ok()),
            topSessionLocator.click()
        ]);

        const { data: employments } = await waitForJsonResponse(empResponse);
        const { data: files } = await waitForJsonResponse(fileResponse);
        const { data: flags } = await waitForJsonResponse(flagsResponse);

        await Promise.all([
            page.waitForResponse(
                resp => resp.url().includes(`/sessions/${sessionID}/events`)
                    && resp.ok()
                    && resp.request().method() === 'GET'
            ),
            page.getByTestId('view-details-btn').click()
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
        await checkExportPdf(page, context, sessionID);

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
                    .includes(`/sessions/${sessionID}/income-sources`)
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

            const filesTable = await fileSection.locator('table').first();

            const rowCount = await filesTable.getByTestId('all-tr').count();

            await expect(rowCount).toBe(files.length);

            const firstRow = filesTable.getByTestId('all-tr').first();

            await firstRow.getByTestId('all-files-view-btn').first()
                .click();

            await expect(page.getByTestId('view-document-modal')).toBeVisible();
        }
        
        console.log('✅ All staff permission checks passed successfully');
        
        // Note: Cleanup is handled automatically by testWithCleanup wrapper
        // It will only run on the last test of the suite
    });
});
