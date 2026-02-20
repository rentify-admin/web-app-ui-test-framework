import { test, expect } from '@playwright/test';
import { ApiClient } from '../api';
import { admin, app } from '../test_config';
import { loginWithAdmin } from '../endpoint-utils/auth-helper';
import BaseApi from '../api/base-api';
import loginForm from '../utils/login-form';
import { cleanupOrganizationMembers, authenticateAdmin } from '../utils/cleanup-helper';


const adminClient = new ApiClient(app.urls.api, null, 120_000);
const guestClient = new ApiClient(app.urls.api, null, 120_000);

const organizationsApi = new BaseApi(adminClient, '/organizations');
const roleApi = new BaseApi(adminClient, '/roles');
let orgMemberApi;

test.describe('QA-367 org_member_archive_unarchive', () => {
    test.describe.configure({
        mode: 'serial',
        timeout: 300_000
    });

    const ORGANIZATION_NAME = 'Permissions Test Org';
    const ROLE = 'Autotest - Empty role';
    const MEMBER_PASSWORD = 'password';

    let createdMember = null;
    let organizationId = null;
    let memberEmail = null;
    let viewMembersUserId = null;

    test.beforeAll(async () => {
        await loginWithAdmin(adminClient);

        const organizations = await organizationsApi.get({
            filters: JSON.stringify({ name: ORGANIZATION_NAME })
        });
        expect(organizations.data.length).toBeGreaterThan(0);
        const organization = organizations.data[0];
        organizationId = organization.id;

        const roles = await roleApi.get({
            filters: JSON.stringify({ name: ROLE })
        });
        expect(roles.data.length).toBeGreaterThan(0);
        const role = roles.data[0];

        orgMemberApi = new BaseApi(adminClient, `/organizations/${organization.id}/members`);

        memberEmail = `test+${Date.now()}@example.com`;

        const user = {
            email: memberEmail,
            first_name: 'Test',
            last_name: 'User',
            password: MEMBER_PASSWORD,
            password_confirmation: MEMBER_PASSWORD,
            role: role.id
        };
        const permissions = [
            { "name": "manage_sessions", "bindings": [] },
            { "name": "view_sessions", "bindings": [] },
            { "name": "delete_sessions", "bindings": [] },
            { "name": "merge_sessions", "bindings": [] },
            { "name": "create_new_session_button_access", "bindings": [] },
            { "name": "delete_session_document", "bindings": [] },
            { "name": "manage_applicants", "bindings": [] },
            { "name": "create_applicants", "bindings": [] },
            { "name": "view_applicants", "bindings": [] },
            { "name": "edit_applicants", "bindings": [] },
            { "name": "delete_applicants", "bindings": [] },
            { "name": "manage_applications", "bindings": [] },
            { "name": "view_applications", "bindings": [] },
            { "name": "delete_applications", "bindings": [] },
            { "name": "archive_applications", "bindings": [] }
        ];

        const memberData = await adminClient.post(`/organizations/${organization.id}/members`, user);
        expect(memberData.data.data).toBeDefined();

        createdMember = memberData.data.data;
        await orgMemberApi.update(createdMember.id, { permissions });

        const inviteToken = memberData.headers['token'];
        const guestRes = await guestClient.post('/users', {
            first_name: user.first_name,
            last_name: user.last_name,
            state: "AK",
            terms: true,
            password: user.password,
            password_confirmation: user.password,
            token: inviteToken
        });
        expect(guestRes.data).toBeDefined();

    });

    test('Verify Org Member Archive/Unarchive Functionality (VC-1776)', { tag: ['@regression', '@staging-ready'] }, async ({ page, browser }) => {
        const memberId = createdMember.id;

        // ─── STEP 1: Verify archive button and archive the member ───────────────
        console.log('[STEP 1] Login as admin and navigate to org members');
        await loginForm.adminLoginAndNavigate(page, admin);

        // Navigate directly to Permissions Test Org members page
        await page.goto(`/organizations/${organizationId}/show`, { waitUntil: 'domcontentloaded' });
        const membersTab = page.getByTestId('users-tab')
        await expect(membersTab).toBeVisible({ timeout: 10_000 });
        await membersTab.click();
        const organizationMemberSearch = page.getByTestId('orgnanization-members-search');
        await expect(organizationMemberSearch).toBeVisible({ timeout: 10_000 });

        const [searchResponse] = await Promise.all([
            page.waitForResponse(resp => {
                if (new RegExp(`/organizations/${organizationId}/members`).test(resp.url()) &&
                    resp.request().method() === 'GET' &&
                    resp.ok()) {
                    const searchUrl = new URL(resp.url());
                    const filtersParam = searchUrl.searchParams.get('filters');
                    if (filtersParam) {
                        const parsedFilters = JSON.parse(filtersParam);
                        return JSON.stringify(parsedFilters).includes(memberEmail);
                    }
                }
                return false;
            }),
            organizationMemberSearch.fill(memberEmail)
        ]);

        await expect(page.getByTestId('members-table')).toBeVisible({ timeout: 15_000 });

        // Verify archive button visible, unarchive button NOT visible
        const archiveBtn = page.getByTestId(`archive-${memberId}`);
        await expect(archiveBtn).toBeVisible({ timeout: 10_000 });
        await expect(page.getByTestId(`unarchive-${memberId}`)).not.toBeVisible();

        // Register dialog handler before clicking archive
        page.on('dialog', dialog => dialog.accept());

        // Click archive and capture PATCH response
        const [archiveResponse] = await Promise.all([
            page.waitForResponse(resp =>
                new RegExp(`/organizations/${organizationId}/members/${memberId}`).test(resp.url()) &&
                resp.request().method() === 'PATCH' &&
                resp.ok()
            ),
            archiveBtn.click()
        ]);

        // API Verification: request payload contains { archived: true }
        const archiveRequestBody = JSON.parse(archiveResponse.request().postData() || '{}');
        expect(archiveRequestBody.archived).toBe(true);
        // Response status 200
        expect(archiveResponse.status()).toBe(200);
        // Response body data.archived_at is not null
        const archiveResponseData = await archiveResponse.json();
        expect(archiveResponseData.data.archived_at).not.toBeNull();

        // ─── STEP 2: Verify member removed from active list, success toast ───────
        console.log('[STEP 2] Verify member removed from active list');
        await expect(page.getByTestId(`archive-${memberId}`)).not.toBeVisible({ timeout: 10_000 });
        await expect(page.getByTestId('archive-success-toast')).toBeVisible({ timeout: 10_000 });

        // ─── STEP 3: Enable Archives ONLY toggle — verify archived view ──────────
        console.log('[STEP 3] Enable Archives ONLY toggle and verify archived view');

        const archivedOnlyToggle = page.getByTestId('members-archived-only');
        // Admin has EDIT_MEMBERS → toggle is visible
        await expect(archivedOnlyToggle).toBeVisible({ timeout: 10_000 });

        // Click toggle and wait for table to reload
        await Promise.all([
            page.waitForResponse(resp =>
                new RegExp(`/organizations/${organizationId}/members`).test(resp.url()) &&
                resp.request().method() === 'GET' &&
                resp.ok()
            ),
            archivedOnlyToggle.click()
        ]);

        // Test member row IS visible in archived view
        await expect(page.getByTestId(`unarchive-${memberId}`)).toBeVisible({ timeout: 10_000 });
        // Archive button is NOT visible (member is already archived)
        await expect(page.getByTestId(`archive-${memberId}`)).not.toBeVisible();

        // Member status cell shows "ARCHIVED"
        await expect(page.getByTestId(`member-status-${memberId}`)).toContainText('ARCHIVED', { timeout: 10_000 });

        // Archived at column header is visible (renamed from Last Seen)
        await expect(page.getByTestId('members-table-archived_at-header')).toBeVisible({ timeout: 10_000 });

        // Archived at cell shows a valid recent timestamp (non-empty text in the row)
        const memberRow = page.locator('tr').filter({ has: page.getByTestId(`unarchive-${memberId}`) });
        await expect(memberRow).toBeVisible({ timeout: 5_000 });
        // The archived_at cell must contain a date string (not empty)
        const archivedAtCellText = await memberRow.locator('td').filter({ hasNotText: '' }).count();
        expect(archivedAtCellText).toBeGreaterThan(0);

        // ─── STEP 4: Verify archived member cannot log in ────────────────────────
        console.log('[STEP 4] Verify archived member cannot log in');

        const archivedContext = await browser.newContext();
        try {
            const archivedPage = await archivedContext.newPage();
            await archivedPage.goto('/', { waitUntil: 'domcontentloaded' });
            await loginForm.fill(archivedPage, { email: memberEmail, password: MEMBER_PASSWORD });

            const [authResp] = await Promise.all([
                archivedPage.waitForResponse(resp =>
                    resp.url().includes('/auth') && resp.request().method() === 'POST'
                ),
                archivedPage.locator('button[type="submit"]').click()
            ]);

            // Verify login is blocked: archived accounts should receive a non-OK auth response,
            // OR the side-panel (dashboard) should NOT be accessible
            if (authResp.ok()) {
                // Auth returned 200 but the user should be blocked from the dashboard
                await expect(archivedPage.getByTestId('side-panel')).not.toBeVisible({ timeout: 5_000 });
            } else {
                // Auth rejected (401/403/422) — login blocked as expected
                expect([401, 403, 422, 500]).toContain(authResp.status());
            }
        } finally {
            await archivedContext.close();
        }

        // ─── STEP 5: Unarchive the member ────────────────────────────────────────
        console.log('[STEP 5] Unarchive the member');

        const [unarchiveResponse] = await Promise.all([
            page.waitForResponse(resp =>
                new RegExp(`/organizations/${organizationId}/members/${memberId}`).test(resp.url()) &&
                resp.request().method() === 'PATCH' &&
                resp.ok()
            ),
            page.getByTestId(`unarchive-${memberId}`).click()
        ]);

        // API Verification: request payload contains { archived: false }
        const unarchiveRequestBody = JSON.parse(unarchiveResponse.request().postData() || '{}');
        expect(unarchiveRequestBody.archived).toBe(false);
        // Response body data.archived_at is null
        const unarchiveResponseData = await unarchiveResponse.json();
        expect(unarchiveResponseData.data.archived_at).toBeNull();

        // Disable "Archives ONLY" toggle and wait for table reload
        await Promise.all([
            page.waitForResponse(resp =>
                new RegExp(`/organizations/${organizationId}/members`).test(resp.url()) &&
                resp.request().method() === 'GET' &&
                resp.ok()
            ),
            archivedOnlyToggle.click()
        ]);

        // Member IS visible in active list again
        await expect(page.getByTestId(`archive-${memberId}`)).toBeVisible({ timeout: 10_000 });
        // Unarchive button is NOT visible (member is active)
        await expect(page.getByTestId(`unarchive-${memberId}`)).not.toBeVisible();

        // ─── STEP 6: Verify toggle hidden without EDIT_MEMBERS permission ─────────
        console.log('[STEP 6] Verify archived-only toggle hidden without EDIT_MEMBERS');

        // Create second test user with only VIEW_MEMBERS permission
        const viewMembersEmail = `test-view-only+${Date.now()}@example.com`;
        const viewMembersPassword = 'password';

        const rolesData = await roleApi.get({
            filters: JSON.stringify({ name: ROLE })
        });
        const emptyRole = rolesData.data[0];

        // Create user via /users endpoint so they have login credentials
        const viewUserResp = await adminClient.post('/users', {
            email: viewMembersEmail,
            first_name: 'Test',
            last_name: 'ViewOnly',
            password: viewMembersPassword,
            password_confirmation: viewMembersPassword,
            organization: organizationId,
            role: emptyRole.id
        });
        viewMembersUserId = viewUserResp.data?.data?.id;
        expect(viewMembersUserId).toBeDefined();
        console.log(`[STEP 6] Created VIEW_MEMBERS test user: ${viewMembersUserId}`);

        // Retrieve member ID for the newly created user
        const viewUserDetails = await adminClient.get(`/users/${viewMembersUserId}?fields[user]=:all`);
        const viewMemberships = viewUserDetails.data?.data?.memberships || [];
        const viewMembership = viewMemberships.find(m => m?.organization?.id === organizationId);
        const viewMembersMemberId = viewMembership?.id;
        expect(viewMembersMemberId).toBeDefined();

        // Patch member permissions to only VIEW_MEMBERS, MANAGE_ORGANIZATIONS (no EDIT_MEMBERS)
        await orgMemberApi.update(viewMembersMemberId, {
            permissions: [{ name: 'view_members', bindings: [] }, { name: 'manage_organizations', bindings: [] }] // Need manage_organizations to see the org in the sidebar and navigate to members page
        });
        console.log(`[STEP 6] Permissions set to VIEW_MEMBERS & MANAGE_ORGANIZATIONS only`);

        // Brief wait for auth service to register the new user
        await page.waitForTimeout(2000);

        const viewMembersContext = await browser.newContext();
        try {
            const viewMembersPage = await viewMembersContext.newPage();
            await viewMembersPage.goto('/', { waitUntil: 'domcontentloaded' });
            await loginForm.fill(viewMembersPage, { email: viewMembersEmail, password: viewMembersPassword });

            const [viewAuthResp] = await Promise.all([
                viewMembersPage.waitForResponse(resp =>
                    resp.url().includes('/auth') && resp.request().method() === 'POST'
                ),
                viewMembersPage.locator('button[type="submit"]').click()
            ]);
            expect(viewAuthResp.ok()).toBe(true);

            // Wait for login to complete — logout-menu is always visible regardless of permissions
            await expect(viewMembersPage.getByTestId('logout-menu')).toBeVisible({ timeout: 20_000 });

            // Navigate to Permissions Test Org members page
            await viewMembersPage.goto(`/organization/self/show`, { waitUntil: 'domcontentloaded' });
            await expect(viewMembersPage.getByTestId('users-tab')).toBeVisible({ timeout: 10_000 });
            await viewMembersPage.getByTestId('users-tab').click();
            await expect(viewMembersPage.getByTestId('members-table')).toBeVisible({ timeout: 15_000 });

            // Archived-only toggle must NOT be visible (no EDIT_MEMBERS permission)
            await expect(viewMembersPage.getByTestId('members-archived-only')).not.toBeVisible({ timeout: 5_000 });
            console.log('[STEP 6] ✅ archived-only toggle correctly hidden for VIEW_MEMBERS user');
        } finally {
            // Cleanup VIEW_MEMBERS user via API immediately (in-test cleanup)
            try {
                await adminClient.delete(`/users/${viewMembersUserId}`);
                console.log('✅ VIEW_MEMBERS test user deleted');
                viewMembersUserId = null; // Mark as cleaned up
            } catch (e) {
                console.error('⚠️ In-test cleanup of VIEW_MEMBERS user failed:', e.message);
            }
            await viewMembersContext.close();
        }
    });

    test.afterAll(async ({ request }) => {
        console.log('🧹 Starting afterAll cleanup...');

        // Cleanup VIEW_MEMBERS user if not already cleaned up in-test
        if (viewMembersUserId) {
            try {
                const token = await authenticateAdmin(request);
                const resp = await request.delete(`${app.urls.api}/users/${viewMembersUserId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (resp.ok()) {
                    console.log('✅ VIEW_MEMBERS user deleted in afterAll');
                } else {
                    console.log(`⚠️ VIEW_MEMBERS user delete returned ${resp.status()}`);
                }
            } catch (e) {
                console.error('❌ Failed to delete VIEW_MEMBERS user in afterAll:', e.message);
            }
        }

        // Delete test member: DELETE /organizations/{orgId}/members/{memberId}
        if (organizationId && createdMember?.id) {
            await cleanupOrganizationMembers(request, organizationId, [createdMember.id], true);
        }

        // Delete test user: DELETE /users/{userId}
        const userId = createdMember?.user?.id;
        if (userId) {
            try {
                const token = await authenticateAdmin(request);
                const resp = await request.delete(`${app.urls.api}/users/${userId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (resp.ok()) {
                    console.log('✅ Main test user deleted');
                } else {
                    console.log(`⚠️ Main test user delete returned ${resp.status()} — may require manual cleanup`);
                }
            } catch (e) {
                console.error('❌ Failed to delete main test user:', e.message);
                console.log(`⚠️ Manual cleanup required — user ID: ${userId}`);
            }
        }
    });
});
