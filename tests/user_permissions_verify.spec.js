import { test, expect } from './fixtures/api-data-fixture';
import userCreateForm from '~/tests/utils/user-create-form';
import { admin, app } from '~/tests/test_config';
import { joinUrl } from './utils/helper';
import { waitForJsonResponse } from './utils/wait-response';
import { searchSessionWithText } from './utils/report-page';
import * as reportUtils from './utils/report-page';
import { loginWith, findSessionLocator, prepareSessionForFreshSelection } from './utils/session-utils';
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
import { createPermissionTestSession } from './utils/session-generator';
import { cleanupPermissionTest } from './utils/cleanup-helper';

// Global state management for test isolation
let globalTestUser = null;
let globalDataManager = null;
let sharedSessionId = null;
let allTestsPassed = true;
let adminContextForCleanup = null;  // ✅ Store admin context for later cleanup
let applicantContextForCleanup = null;  // ✅ Store applicant context for later cleanup

// Role name to search for
const roleName = 'Autotest - Centralized Leasing';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

test.describe('user_permissions_verify', () => {
    test.describe.configure({ 
        mode: 'serial', // Ensure tests run in order
        timeout: 240000 // Increased for session creation
    });
    
    // ✅ Create session ONCE for all tests
    test.beforeAll(async ({ browser }) => {
        test.setTimeout(300000);
        
        console.log('🏗️ Creating complete session for user permissions tests...');
        
        // Create admin page manually (page fixture not available in beforeAll)
        const adminContext = await browser.newContext();
        const adminPage = await adminContext.newPage();
        await adminPage.goto('/');
        
        const { sessionId, applicantContext } = await createPermissionTestSession(adminPage, browser, {
            applicationName: 'Autotest - UI permissions tests',
            firstName: 'UserPerm',
            lastName: 'Test',
            email: `user-perm-test-${Date.now()}@verifast.com`,
            rentBudget: '2500'
        });
        
        sharedSessionId = sessionId;
        console.log('✅ Shared session created:', sessionId);
        
        // ✅ Don't close contexts yet - store for cleanup in afterAll
        await adminPage.close();
        adminContextForCleanup = adminContext;  // ✅ Will close in afterAll
        applicantContextForCleanup = applicantContext;  // ✅ Will close in afterAll
    });

    // Suite-level cleanup
    test.afterAll(async ({ request }) => {
        // ✅ Centralized cleanup: session + contexts + user
        await cleanupPermissionTest(
            request,
            sharedSessionId,
            applicantContextForCleanup,
            adminContextForCleanup,
            globalDataManager,
            globalTestUser,
            allTestsPassed
        );
    }); 

    test('Should allow admin to create user via API', { tag: ['@regression', '@staging-ready', '@rc-ready'] }, async ({ page, dataManager }) => {
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

            // Fetch organization by name dynamically (instead of hardcoded ID)
            const organizationName = 'Permissions Test Org';
            console.log(`🔍 Fetching organization: "${organizationName}"`);
            const organization = await dataManager.getOrganizationByName(organizationName);
            
            if (!organization) {
                throw new Error(`Organization "${organizationName}" not found. Please ensure the organization exists in the system.`);
            }
            
            console.log(`✅ Organization "${organizationName}" found with ID: ${organization.id}`);

            // Create user via API instead of UI
            const prefix = ApiDataManager.uniquePrefix();
            const testUserData = ApiDataManager.createUserData(prefix, {
                first_name: 'User',
                last_name: 'Playwright',
                email: `${prefix}@verifast.com`,
                password: 'Playwright@123',
                password_confirmation: 'Playwright@123',
                role: role.id, // Dynamically fetched role ID
                organization: organization.id // Dynamically fetched organization ID
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

            console.log('✅ Test user created successfully via API:', createdUser.email);
        } catch (error) {
            allTestsPassed = false;
            throw error;
        }
    });

    test('Should allow user to edit the application', { tag: ['@regression', '@staging-ready', '@rc-ready'] }, async ({ page, dataManager }) => {
        try {
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
        } catch (error) {
            allTestsPassed = false;
            throw error;
        }
    });

    test('Should allow user to perform permited actions', { tag: ['@regression', '@staging-ready', '@rc-ready'] }, async ({ page, context, dataManager }) => {
        try {
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

            // ✅ Use pre-created session
            if (!sharedSessionId) {
                throw new Error('Session must be created in beforeAll');
            }
            
            // ✅ SMART FIX: Prepare session for fresh selection (deselect + search)
            const { locator: sessionLocator, searchResult } = await prepareSessionForFreshSelection(page, sharedSessionId);
            const searchSessions = searchResult; // Keep for canMergeSession usage

            // ✅ Click OUR session and wait for all API calls (decodeURI pattern)
            console.log('🖱️ Clicking our session card...');
            const [ employmentResponse, filesResponse, sessionResponse ] = await Promise.all([
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
                        url.includes('/files') &&
                        resp.request().method() === 'GET' &&
                        resp.ok();
                }),
                page.waitForResponse(resp => {
                    const url = decodeURI(resp.url());
                    return url.includes('/sessions/') && 
                        url.includes(sharedSessionId) &&
                        url.includes('?fields[session]=') &&
                        resp.request().method() === 'GET' &&
                        resp.ok();
                }),
                sessionLocator.click()
            ]);
            
            console.log('✅ Our session opened with all API calls captured!');

            const { data: employments } = await waitForJsonResponse(
                employmentResponse
            );
            const { data: files } = await waitForJsonResponse(filesResponse);
            const { data: sessionDetails } = await waitForJsonResponse(sessionResponse);

            const viewDetailBtn = page.getByTestId('view-details-btn');

            await expect(viewDetailBtn).toBeVisible();

            // ! Should able to see session flags loaded
            await checkFlagsAreLoaded(page, viewDetailBtn);

            // ! Should able to edit rent budget
            await checkRentBudgetEdit(page);

            // ✅ RESOLVE FLAGS BEFORE APPROVAL: Mark all flags as non-issue
            console.log('🏴 Checking for flags that require review...');
            await page.getByTestId('view-details-btn').click();
            await page.waitForTimeout(2000);
            
            const itemsRequiringReview = page.getByTestId('items-requiring-review-section');
            const hasFlags = await itemsRequiringReview.count() > 0;
            
            if (hasFlags) {
                console.log('   ⚠️ Flags requiring review found - marking as non-issue...');
                
                let flagCount = 0;
                let maxAttempts = 20; // Safety limit to prevent infinite loops
                let attempts = 0;
                
                while (attempts < maxAttempts) {
                    // ✅ REFRESH: Query flags on each iteration
                    const flagItems = await itemsRequiringReview.locator('li[id^="flag-"]').all();
                    
                    if (flagItems.length === 0) {
                        console.log(`   ✅ All ${flagCount} flag(s) resolved`);
                        break;
                    }
                    
                    // ✅ Always process the FIRST flag (index 0) since list shrinks
                    const flagItem = flagItems[0];
                    const flagId = await flagItem.getAttribute('id');
                    flagCount++;
                    console.log(`   🏴 Resolving flag ${flagCount}: ${flagId} (${flagItems.length} remaining)`);
                    
                    const markAsNonIssueBtn = flagItem.getByTestId('mark_as_non_issue');
                    await markAsNonIssueBtn.click();
                    await page.waitForTimeout(500);
                    
                    const submitBtn = page.getByRole('button', { name: 'Mark as Non Issue' });
                    
                    // ✅ Wait for API response instead of fixed timeout
                    await Promise.all([
                        page.waitForResponse(resp => 
                            resp.url().includes('/flags/') && 
                            resp.request().method() === 'PATCH' &&
                            resp.ok(),
                            { timeout: 10000 }
                        ),
                        submitBtn.click()
                    ]);
                    
                    await page.waitForTimeout(2000);
                    
                    attempts++;
                }
                
                if (attempts >= maxAttempts) {
                    console.warn(`   ⚠️ Reached max attempts (${maxAttempts}) - some flags may remain`);
                }
                
                await page.waitForTimeout(2000); // Final wait for UI to stabilize
            } else {
                console.log('   ✅ No flags requiring review');
            }
            
            await page.getByTestId('close-event-history-modal').click();
            await page.waitForTimeout(1000);
            console.log('✅ Flags resolved and modal closed');
            
            // ✅ RELOAD page to ensure fresh state
            console.log('🔄 Reloading page to refresh state...');
            await page.reload();
            await expect(page.getByTestId('household-status-alert')).toBeVisible({ timeout: 10000 });
            console.log('✅ Page reloaded and household visible');

            // ! Should allow user to approve and reject the application
            await checkSessionApproveReject(page, viewDetailBtn);

            // ! Should allow admin to export session pdf
            await checkExportPdf(page, context, sharedSessionId);

            // ! Should allow user to request additional information
            await canRequestAdditionalDocuments(page);

            // ! Should be able to invite applicant
            await canInviteApplicant(page);

            // ! Should allow user to upload bank statement and paystub document
            await canUploadBankStatementAndPaystub(page);

            // ! Should allow user to merge session
            await canMergeSession(searchSessions, page);

            // ! Should allow user to delete applicant
            await canDeleteApplicant(page, sessionDetails);

            // ! Check identity details available in report
            await reportUtils.checkIdentityDetailsAvailable(page);

            // ! Income source section test
            await checkIncomeSourceSection(page, sharedSessionId);

            // ! Employment section should load data test
            await checkEmploymentSectionData(page, employments);

            // ! Files section should load data test
            await checkFilesSectionData(page, files);

            // ! Financial section should load properly
            // Create session object with id and children for checkFinancialSectionData
            const sessionObject = {
                id: sessionDetails.id,
                children: sessionDetails.children || []
            };
            await checkFinancialSectionData(sessionObject, page, sessionLocator);
            
            console.log('✅ All permission checks passed successfully');
        } catch (error) {
            console.error('❌ Error in test:', error.message);
            allTestsPassed = false;
            throw error;
        }
    });
});
