import { test, expect } from '@playwright/test';
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
    checkExportPdf,
    canRequestAdditionalDocuments,
    canInviteApplicant,
    canUploadBankStatementAndPaystub,
    canMergeSession,
    canDeleteApplicant
} from './utils/permission-checks';
import {
    checkIncomeSourceSection,
    checkEmploymentSectionData,
    checkFilesSectionData,
    checkFinancialSectionData
} from './utils/section-checks';

// Create local user object to avoid sharing with other tests

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

const sessionId = '01971d54-6284-70c4-8180-4eee1abd955a';

test.describe('User Permissions Verify', tester => {
    test.describe.configure({ mode: 'default' });

    const testUser = {
        first_name: 'User',
        last_name: 'Playwright',
        email: 'playwright+80395@verifast.com',
        password: 'Playwright@123',
        organization: 'Permissions Test Org',
        role: 'Centralized Leasing'
    };

    test('Should allow admin to create user', { tag: [ '@regression' ] }, async ({ page }) => {

        // Step:1 Login the the admin panel
        console.log('🚀 ~ Login with admin user...');
        await loginWith(page, admin);

        // Step:2 Goto users menu
        console.log('🚀 ~ Click on users menu');
        await page.getByTestId('users-menu').click();

        // Step:3 select Users menu
        console.log('🚀 ~ Click on user sub menu');
        await page.getByTestId('users-submenu').click();

        // Step:4 Click on Add User menu
        console.log('🚀 ~ Click on add user button');
        await page.getByTestId('add-user-btn').click();

        // Changing the email to dynamic
        const randomNumber = Math.floor(Math.random() * 100000);
        testUser.email = `playwright+${randomNumber}@verifast.com`;

        // Step:5 Fill user form
        console.log(`🚀 ~ Filling user form with email ${testUser.email}`);
        await userCreateForm.fill(page, testUser);

        // Step:6 Submit User form
        console.log('🚀 ~ Submitting user form');
        const userData = await userCreateForm.submit(page);

        // Step:7 Expect user is listed in the user list
        console.log(`🚀 ~ checking user is created with ID: ${userData?.data?.id}`);
        expect(userData?.data?.id).toBeDefined();
    });

    test('Should allow user to edit the application', { tag: [ '@regression' ] }, async ({ page }) => {

        // Step:1 Login with admin credentials and wait for sessions to load
        console.log(`🚀 ~ Login with newly created user: ${testUser.email}`);
        await Promise.all([
            page.waitForResponse(
                resp => resp.url().includes('/sessions?fields[session]=')
                    && resp.request().method() === 'GET'
                    && resp.ok()
            ),
            loginWith(page, testUser)
        ]);

        // Step:2 Check on application menu visible
        expect(page.getByTestId('applications-menu')).toBeVisible();

        // Step:3 Check Applications Sub menu visible
        expect(page.getByTestId('applications-submenu')).toBeVisible();

        // Step:4 Click on the Applications menu
        await page.getByTestId('applications-menu').click();

        // Step:5 Click on Application menu and wait for applications to load
        console.log('🚀 ~ Click on applications menu');
        const applicationUrl = joinUrl(app.urls.api, 'applications');

        console.log('🚀 ~ Click on applications sub menu');

        console.log(`🚀 ~ wait for application url: ${applicationUrl}`);
        const [ response ] = await Promise.all([
            page.waitForResponse(
                resp => {
                    const matched = resp.url().includes(applicationUrl)
                    && resp.request().method() === 'GET'
                    && resp.ok();
                    if (matched) {
                        console.log('🚀 ~ Response matched:', matched);
                    }
                    return matched;
                }
            ),
            page.getByTestId('applications-submenu').click()
        ]);

        const { data: applications } = await waitForJsonResponse(response);

        // Step:6 Expect Applications available
        console.log('🚀 ~ Checking applications is greater then 0');
        expect(applications?.length || 0).toBeGreaterThan(0);

        // Step:7 Check Edit button is visible
        console.log('🚀 ~ Checking edit button visible');
        expect(page.locator('[data-testid*="edit-"]').first()).toBeVisible();

        // Step:8 Click of Edit button of the first application button
        console.log('🚀 ~ Clicking edit button');
        await page.locator('[data-testid*="edit-"]').first()
            .click();

        // Step:9 Check URL change to edit url
        console.log('🚀 ~ Checking edit page url');
        await expect(page).toHaveURL(/application\/.+\/edit/);

        // Step:10 Check edit application input is not empty (data loaded properly)
        console.log('🚀 ~ Edit Page: Checking application name field is not empty');
        await expect(page.locator('input#application_name')).not.toBeEmpty();

        // Step:11 Click on cancel button
        console.log('🚀 ~ Edit Page: Clicking on cancel button');
        await page.getByTestId('cancel-application-setup').click();
    });

    test('should allow user to perform permited actions', { tag: [ '@regression' ] }, async ({
        page,
        context
    }) => {
        console.log(`🚀 ~ Login with created user: ${testUser.email}`);
        console.log('🚀 ~ Response url is Waiting: /sessions?fields[session]=');
        const [ sessionsResponse ] = await Promise.all([
            page.waitForResponse(
                resp => {
                    const matched = resp.url().includes('/sessions?fields[session]=')
                    && resp.request().method() === 'GET'
                    && resp.ok();
                    if (matched) {
                        console.log(`🚀 ~ Response url matched: ${matched}`);
                    }
                    return matched;
                }
            ),
            loginWith(page, testUser)
        ]);

        console.log('🚀 ~ Checking menus are visible');
        expect(page.getByTestId('applicants-menu')).toBeVisible();
        expect(page.getByTestId('applicants-submenu')).toBeVisible();

        expect(page.getByTestId('unreviewed-submenu')).toBeVisible();
        expect(page.getByTestId('approved-submenu')).toBeVisible();
        expect(page.getByTestId('rejected-submenu')).toBeVisible();

        console.log('🚀 ~ Clicking applicants sub menu');
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

        console.log(`🚀 ~ Clicking on session card: ${sessionId}`);
        console.log(`🚀 ~ Waiting for response: /sessions/${sessionId}/employments`);
        console.log(`🚀 ~ Waiting for response: /sessions/${sessionId}/files`);
        console.log(`🚀 ~ Waiting for response: /sessions/${sessionId}?fields[session]=`);
        const [ employmentResponse, filesResponse, sessionResponse ]
            = await Promise.all([
                page.waitForResponse(
                    resp => {
                        const matched = resp
                            .url()
                            .includes(`/sessions/${sessionId}/employments`)
                        && resp.request().method() === 'GET'
                        && resp.ok();
                        if (matched) {
                            console.log(`🚀 ~ /sessions/${sessionId}/employments: matched - ${matched} `);
                        }
                        return matched;
                    }
                ),
                page.waitForResponse(
                    resp => {
                        const matched = resp.url().includes(`/sessions/${sessionId}/files`)
                            && resp.request().method() === 'GET'
                            && resp.ok();
                        if (matched) {
                            console.log(`🚀 ~ /sessions/${sessionId}/files: matched - ${matched} `);
                        }
                        return matched;
                    }
                ),
                page.waitForResponse(
                    resp => {
                        const matched = resp
                            .url()
                            .includes(
                                `/sessions/${sessionId}?fields[session]=`
                            )
                        && resp.request().method() === 'GET'
                        && resp.ok();
                        if (matched) {
                            console.log(`🚀 ~ /sessions/${sessionId}?fields[session]=: matched - ${matched} `);
                        }
                        return matched;
                    }
                ),
                sessionLocator.click()
            ]);

        const { data: employments } = await waitForJsonResponse(
            employmentResponse
        );
        const { data: files } = await waitForJsonResponse(filesResponse);
        const { data: session } = await waitForJsonResponse(sessionResponse);

        const viewDetailBtn = page.getByTestId('view-details-btn');

        console.log('🚀 ~ Check View Detail button visible');
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
    });
});
