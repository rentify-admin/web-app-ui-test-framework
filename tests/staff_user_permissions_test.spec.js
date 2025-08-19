import { test, expect } from './fixtures/api-data-fixture';
import { ApiDataManager } from './utils/api-data-manager';
import { admin } from '~/tests/test_config';
import loginForm from '~/tests/utils/login-form';
import { checkAllFlagsSection, checkExportPdf } from '~/tests/utils/report-page';

// import { joinUrl } from './utils/helper';
import { waitForJsonResponse } from './utils/wait-response';

// Staff user template (now used with API)
const staffUserTemplate = {
    first_name: 'Staff',
    last_name: 'Playwright',
    password: 'Playwright@123',
    role: '0196f6c9-da51-7337-bbde-ca7d0efd7f84'
};

// Store the created user data to share between tests
let createdStaffUser = null;
let errorMessage = null;

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

const loginWith = async (page, data) => {

    // Step 1: Admin Login and Navigate
    await loginForm.fill(page, data);
    await loginForm.submit(page);
    await expect(page).toHaveTitle(/Applicants/, { timeout: 10_000 });
    await expect(page.getByTestId('household-status-alert')).toBeVisible();
};

const sessionID = '01971d4f-2f5e-7151-88d5-d038c044d13b';

test.describe('staff_user_permissions_test', () => {
    test.describe.configure({ mode: 'default' });
    
    // We'll use the fixture dataManager but need to track it for afterAll cleanup
    let dataManagerInstance; // Track the fixture instance for cleanup

    test('Should create member record and assign it to the Staff role', { tag: [ '@regression' ] }, async ({ page, dataManager }) => {
        // Store the dataManager instance for afterAll cleanup
        dataManagerInstance = dataManager;
        
        // First authenticate with admin user to get API access
        // API calls require authentication - we need a Bearer token to create users
        const isAuthenticated = await dataManager.authenticate(admin.email, admin.password);
        
        if (!isAuthenticated) {
            throw new Error('Authentication failed - cannot create users without API access');
        }

        // Create staff user via API instead of UI
        const prefix = ApiDataManager.uniquePrefix();
        const staffUserData = ApiDataManager.createUserData(prefix, {
            ...staffUserTemplate,
            email: `${prefix}@verifast.com`,
            password_confirmation: staffUserTemplate.password
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

        // Store the created user data for the second test
        createdStaffUser = { 
            ...staffUserData, 
            id: createdUser.id 
        };

        console.log('✅ Staff user created successfully via API:', createdUser.email);
    });

    test('Verify permission of Staff role', { tag: [ '@regression' ] }, async ({ page, context, dataManager }) => {
        // Use the user created in the first test
        if (!createdStaffUser) {
            throw new Error('Staff user must be created in the first test before running this test');
        }

        // We need to transfer the created entities to THIS test's dataManager
        // so cleanup can use the current request context, not the old one
        if (dataManagerInstance && dataManagerInstance.getCreated().users.length > 0) {
            // Transfer created entities to current test's dataManager
            const createdEntities = dataManagerInstance.getCreated();
            dataManager.created = { ...createdEntities };
            
            // Also authenticate this dataManager for cleanup
            const isAuthenticated = await dataManager.authenticate(admin.email, admin.password);
            if (!isAuthenticated) {
                console.warn('⚠️ Could not authenticate current dataManager for cleanup');
            }
        }

        try {

        // Login as the created staff user to verify permissions
        await loginWith(page, {
            email: createdStaffUser.email,
            password: createdStaffUser.password
        });

        // Verify that these elements are shown in the left hand menu
        expect(page.getByTestId('applicants-menu')).toBeVisible();
        expect(page.getByTestId('applications-menu')).toBeVisible();

        // Click on the Applications menu to expand the menu
        await page.getByTestId('applications-menu').click();

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

        // Verify that the applications are visible
        const tableLocator = page.locator('table.table');
        await expect(tableLocator).toBeVisible();

        const allTableRaws = await tableLocator.locator('tbody tr');
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

        // Search the sessionid
        const searchEle = await page.locator('#search_sessions');
        await Promise.all([
            page.waitForResponse(resp => {
                const regEx = new RegExp(`/sessions?.*${sessionID}`);
                return (
                    regEx.test(resp.url())
                    && resp.request().method() === 'GET'
                    && resp.ok()
                );
            }),
            searchEle.fill(sessionID)
        ]);

        // Search the top session from the side panel
        const topSessionLocator = page.locator('div.application-card').nth(0);
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
                    && resp.request().method() === 'GET'
                    && resp.ok()
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
    } catch (error) {
        console.error('❌ Error in test:', error.message);
        errorMessage = error.message;
    }

    // Cleanup: ALWAYS delete the test user, even if test fails
    // Use the CURRENT test's dataManager (with valid request context) for cleanup
    if (dataManager && dataManager.getCreated().users.length > 0) {
        console.log('🧹 Cleaning up test user after test logic...');
        console.log('🔍 User to cleanup:', createdStaffUser?.email);
        try {
            await dataManager.cleanupAll();
            console.log('🧹 Test user cleanup completed successfully');
        } catch (cleanupError) {
            console.error('❌ Cleanup failed but continuing:', cleanupError.message);
        }
    }

    if (errorMessage) {
        throw new Error(errorMessage);
    }
    });
});
