import { expect, test } from '@playwright/test';
import { admin, app } from '~/tests/test_config';
import userCreateForm from '~/tests/utils/user-create-form';
import loginForm from '~/tests/utils/login-form';
import { getRandomEmail, getRandomNumber, joinUrl } from '~/tests/utils/helper';
import { checkApplicationDeletable, checkApplicationEditable } from '~/tests/utils/applications-page';
import { dragAndDrop, gotoPage } from '~/tests/utils/common';
import * as orgUtils from './utils/organizations-page';
import { checkRolesVisibleInTable } from '~/tests/utils/roles-page';
import * as reportUtils from './utils/report-page';
import { waitForJsonResponse } from './utils/wait-response';

// Create local property admin user object to avoid sharing with other tests


// Helper for login and initial navigation
const loginWith = async (page, data) => {
    await loginForm.fill(page, data);
    await loginForm.submit(page);
    await expect(page).toHaveTitle(/Applicants/, { timeout: 10_000 });
    await expect(page.getByTestId('household-status-alert')).toBeVisible();
};

test.describe('property_admin_permission_test', () => {
    test.describe.configure({ mode: 'default' });

    const propertyAdminUser = {
        first_name: 'Property Admin',
        last_name: 'Playwright',
        email: 'playwright+58603@verifast.com',
        password: 'Playwright@123',
        organization: 'Permissions Test Org',
        role: 'Property Admin'
    };

    test('Should create property admin role user', { tag: [ '@regression' ] }, async({ page }) => {
        propertyAdminUser.email = getRandomEmail();
        await page.goto('/');
        await loginWith(page, admin);

        // Go to Users menu and add a new user
        await page.getByTestId('users-menu').click();
        await page.getByTestId('users-submenu').click();
        await page.getByTestId('add-user-btn').click();
        await userCreateForm.fill(page, propertyAdminUser);
        const userData = await userCreateForm.submit(page);
        expect(userData?.data?.id).toBeDefined();
    });

    test('Verify property admin user permissions', { tag: [ '@regression' ] }, async ({ page }) => {
        await page.goto('/');
        await loginWith(page, propertyAdminUser);

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
                        .locator('a')
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
        const staffEmail = `admin_test+${getRandomNumber()}@verifast.com`;
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
    });

    test('Check applicant inbox permissions', { tag: [ '@regression' ] }, async ({ page, context }) => {
        await page.goto('/');
        await loginWith(page, propertyAdminUser);

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

                // Regex for financial-verifications with session id
                const regex = new RegExp(`.+/financial-verifications?.+filters=.+{"session_id":{"\\$in":\\["${sess.id}"\\].+`, 'i');
                return page.waitForResponse(resp => regex.test(decodeURI(resp.url()))
                    && resp.request().method() === 'GET'
                    && resp.ok());
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
    });
});


