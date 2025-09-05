import { testWithCleanup, test, expect } from './fixtures/enhanced-cleanup-fixture';
import userCreateForm from '~/tests/utils/user-create-form';
import { admin, app } from '~/tests/test_config';
import { joinUrl } from './utils/helper';
import { waitForJsonResponse } from './utils/wait-response';
import { searchSessionWithText } from './utils/report-page';
import * as reportUtils from './utils/report-page';
import { loginWith, findSessionLocator } from './utils/session-utils';
import {
    checkFlagsAreLoaded,
    checkRentBudgetEdit,
    checkSessionApproveReject,
    canRequestAdditionalDocuments,
    canInviteApplicant,
    canUploadBankStatementAndPaystub,
    canMergeSession,
    canDeleteApplicant
} from './utils/permission-checks';
import { checkExportPdf } from './utils/report-page';
import {
    checkIncomeSourceSection,
    checkEmploymentSectionData,
    checkFilesSectionData,
    checkFinancialSectionData
} from './utils/section-checks';
import { ApiDataManager } from './utils/api-data-manager';
import globalCleanupManager from './utils/global-cleanup-manager';
import testSuiteCleanupManager from './utils/test-suite-cleanup';

// Global state management for test isolation
let globalTestUser = null;
let globalDataManager = null;

// Suite configuration
const SUITE_NAME = 'user_permissions_verify';
const TOTAL_TESTS = 3;

// Test registration function
const registerTest = (suiteName, testName, totalTests) => {
    testSuiteCleanupManager.registerTest(suiteName, testName, totalTests);
};

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

const sessionId = '01971d54-6284-70c4-8180-4eee1abd955a';

test.describe('user_permissions_verify', () => {
    test.describe.configure({ 
        mode: 'serial', // Ensure tests run in order
        timeout: 180000 
    });

    // Suite-level cleanup
    test.afterAll(async () => {
        console.log(`🧹 Suite Cleanup: Running afterAll cleanup for suite ${SUITE_NAME}`);
        try {
            await globalCleanupManager.cleanupTest(`suite_${SUITE_NAME}`, globalDataManager);
            console.log(`✅ Suite Cleanup: Completed afterAll cleanup for suite ${SUITE_NAME}`);
        } catch (error) {
            console.log(`ℹ️ Global Cleanup: Cleanup already completed for test suite_${SUITE_NAME}, skipping`);
        }
    }); 

    testWithCleanup('Should allow admin to create user via API @regression', async ({ page, dataManager, cleanupHelper }) => {
        // Register this test in the suite
        registerTest(SUITE_NAME, 'Should allow admin to create user via API', TOTAL_TESTS);
        
        // Store global references for other tests
        globalDataManager = dataManager;
        
        // First authenticate with admin user to get API access
        const isAuthenticated = await dataManager.authenticate(admin.email, admin.password);
        if (!isAuthenticated) {
            throw new Error('Authentication failed - cannot create users without API access');
        }

        // Create user via API instead of UI
        const prefix = ApiDataManager.uniquePrefix();
        const testUserData = ApiDataManager.createUserData(prefix, {
            first_name: 'User',
            last_name: 'Playwright',
            email: `${prefix}@verifast.com`,
            password: 'Playwright@123',
            password_confirmation: 'Playwright@123',
            role: '0196f6c9-da5e-7074-9e6e-c35ac8f1818e' // Centralized Leasing role UUID
        });

        // Create the user via API
        await dataManager.createEntities({
            users: [testUserData]
        });

        // Get the created user data
        const { users } = dataManager.getCreated();
        const createdUser = users[0];

        // Verify user was created successfully
        expect(createdUser.id).toBeDefined();
        expect(createdUser.email).toBe(testUserData.email);

        // Store the created user data globally for other tests
        globalTestUser = { 
            ...testUserData, 
            id: createdUser.id 
        };

        // Track user for enhanced cleanup (will only be cleaned up on last test)
        const suiteId = `suite_${SUITE_NAME}`;
        cleanupHelper.trackUser(createdUser, suiteId);

        console.log('✅ Test user created successfully via API:', createdUser.email);
        console.log('📝 User tracked for enhanced cleanup (will be cleaned up on last test only)');
    });

    testWithCleanup('Should allow user to edit the application @regression', async ({ page, dataManager, cleanupHelper }) => {
        // Register this test in the suite
        registerTest(SUITE_NAME, 'Should allow user to edit the application', TOTAL_TESTS);
        
        // Use the globally created user
        if (!globalTestUser) {
            throw new Error('Test user must be created in the first test before running this test');
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

        // Step:1 Login with newly created user and wait for sessions to load
        console.log(`🚀 ~ Login with newly created user: ${globalTestUser.email}`);
        await Promise.all([
            page.waitForResponse(
                resp => resp.url().includes('/sessions?fields[session]=')
                    && resp.request().method() === 'GET'
                    && resp.ok()
            ),
            loginWith(page, globalTestUser)
        ]);

        // Step:2 Check on application menu visible
        expect(page.getByTestId('applications-menu')).toBeVisible();

        // Step:3 Check Applications Sub menu visible
        expect(page.getByTestId('applications-submenu')).toBeVisible();

        // Step:4 Click on the Applications menu
        await page.getByTestId('applications-menu').click();

        // Step:5 Click on Application menu and wait for applications to load
        const applicationUrl = joinUrl(app.urls.api, 'applications');

        const [ response ] = await Promise.all([
            page.waitForResponse(
                resp => resp.url().includes(applicationUrl)
                    && resp.request().method() === 'GET'
                    && resp.ok()
            ),
            page.getByTestId('applications-submenu').click()
        ]);

        // Wait for the page to load after clicking applications submenu
        await page.waitForTimeout(1000);

        const { data: applications } = await waitForJsonResponse(response);

        // Step:6 Expect Applications available
        expect(applications?.length || 0).toBeGreaterThan(0);

        // Step:7 Check Edit button is visible
        expect(page.locator('[data-testid*="edit-"]').first()).toBeVisible();

        // Step:8 Click of Edit button of the first application button
        console.log('🖱️ Clicking Edit button for first application');
        await page.locator('[data-testid*="edit-"]').first().click();

        // Step:9 Check URL change to edit url with proper waiting
        console.log('⏳ Waiting for URL to change to edit page...');
        await expect(page).toHaveURL(/application\/.+\/edit/, { timeout: 30000 }); // 30 second timeout
        console.log('✅ URL changed to edit page successfully');

        // Step:10 Check edit application input is not empty with robust waiting
        console.log('🔍 Waiting for application name input to load...');
        
        // Wait for the input field to be visible first
        const applicationNameInput = page.locator('input#application_name');
        await expect(applicationNameInput).toBeVisible({ timeout: 20000 });
        console.log('✅ Application name input field is visible');
        
        // Wait for the input to have content (not empty)
        await expect(applicationNameInput).not.toBeEmpty({ timeout: 30000 }); // 30 second timeout
        console.log('✅ Application name input has loaded data');
        
        // Additional verification: check if the input actually has meaningful content
        const inputValue = await applicationNameInput.inputValue();
        console.log(`📋 Application name loaded: "${inputValue}"`);
        
        // Verify the content is not just whitespace or placeholder
        expect(inputValue.trim()).toBeTruthy();
        expect(inputValue.trim().length).toBeGreaterThan(0);
        console.log('✅ Application name input validation passed');

        // Step:11 Click on cancel button
        await page.getByTestId('cancel-application-setup').click();
    });

    testWithCleanup('Should allow user to perform permited actions @regression', async ({ page, context, dataManager, cleanupHelper }) => {
        // Register this test in the suite (LAST TEST)
        registerTest(SUITE_NAME, 'Should allow user to perform permited actions', TOTAL_TESTS);
        
        // Use the globally created user
        if (!globalTestUser) {
            throw new Error('Test user must be created in the first test before running this test');
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

        try {
            const [ sessionsResponse ] = await Promise.all([
                page.waitForResponse(
                    resp => resp.url().includes('/sessions?fields[session]=')
                        && resp.request().method() === 'GET'
                        && resp.ok()
                ),
                loginWith(page, globalTestUser)
            ]);

            expect(page.getByTestId('applicants-menu')).toBeVisible();
            expect(page.getByTestId('applicants-submenu')).toBeVisible();

            expect(page.getByTestId('unreviewed-submenu')).toBeVisible();
            expect(page.getByTestId('approved-submenu')).toBeVisible();
            expect(page.getByTestId('rejected-submenu')).toBeVisible();

            await page.getByTestId('applicants-submenu').click();

            const { data: sessions } = await waitForJsonResponse(sessionsResponse);

            const searchSessions = await searchSessionWithText(
                page,
                'AutoTest - Id Emp Fin'
            );

            const sessionLocator = await findSessionLocator(
                page,
                `.application-card[data-session="${sessionId}"]`
            );

            const [ employmentResponse, filesResponse, sessionResponse ]
                = await Promise.all([
                    page.waitForResponse(
                        resp => resp.url().includes(`/sessions/${sessionId}/employments`)
                            && resp.request().method() === 'GET'
                            && resp.ok()
                    ),
                    page.waitForResponse(
                        resp => resp.url().includes(`/sessions/${sessionId}/files`)
                            && resp.request().method() === 'GET'
                            && resp.ok()
                    ),
                    page.waitForResponse(
                        resp => resp.url().includes(`/sessions/${sessionId}?fields[session]=`)
                            && resp.request().method() === 'GET'
                            && resp.ok()
                    ),
                    sessionLocator.click()
                ]);

            const { data: employments } = await waitForJsonResponse(
                employmentResponse
            );
            const { data: files } = await waitForJsonResponse(filesResponse);
            const { data: session } = await waitForJsonResponse(sessionResponse);

            const viewDetailBtn = page.getByTestId('view-details-btn');

            await expect(viewDetailBtn).toBeVisible();

            // ! Should able to see session flags loaded
            await checkFlagsAreLoaded(page, viewDetailBtn);

            // ! Should able to edit rent budget
            await checkRentBudgetEdit(page);

            // ! Should allow user to approve and reject the application
            await checkSessionApproveReject(page, viewDetailBtn);

            // ! Should allow admin to export session pdf
            await checkExportPdf(page, context, sessionId);

            // ! Should allow user to request additional information
            await canRequestAdditionalDocuments(page);

            // ! Should be able to invite applicant
            await canInviteApplicant(page);

            // ! Should allow user to upload bank statement and paystub document
            await canUploadBankStatementAndPaystub(page);

            // ! Should allow user to merge session
            await canMergeSession(searchSessions, page);

            // ! Should allow user to delete applicant
            await canDeleteApplicant(page, session);

            // ! Check identity details available in report
            await reportUtils.checkIdentityDetailsAvailable(page);

            // ! Income source section test
            await checkIncomeSourceSection(page, sessionId);

            // ! Employment section should load data test
            await checkEmploymentSectionData(page, employments);

            // ! Files section should load data test
            await checkFilesSectionData(page, files);

            // ! Financial section should load properly
            await checkFinancialSectionData(session, page, sessionLocator);
            
            console.log('✅ All permission checks passed successfully');
            
        } catch (error) {
            console.error('❌ Error in test:', error.message);
            throw error; // Re-throw immediately to fail the test
        }
        
        // Note: Cleanup is handled automatically by testWithCleanup wrapper
        // It will only run on the last test of the suite
    });
});
