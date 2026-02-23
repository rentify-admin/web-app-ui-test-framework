import { test, expect } from '@playwright/test';
import { ApiClient } from '../api';
import { admin, app } from '../test_config';
import { loginWithAdmin } from '../endpoint-utils/auth-helper';
import BaseApi from '../api/base-api';
import loginForm from '../utils/login-form';
import { cleanupOrganizationMembers, authenticateAdmin } from '../utils/cleanup-helper';
import {
    createMemberWithInvite,
    navigateToOrgMembersPage,
    searchForMember,
    archiveMemberAndVerifyApi,
    unarchiveMemberAndVerifyApi,
    toggleArchivedOnlyFilter,
    verifyArchivedMemberCannotLogin,
    createViewOnlyMemberAndVerifyToggleHidden,
} from './org-member-helpers';


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

        orgMemberApi = new BaseApi(adminClient, `/organizations/${organizationId}/members`);
        memberEmail = `test+${Date.now()}@example.com`;

        createdMember = await createMemberWithInvite(
            adminClient, guestClient, organizationId, role.id, memberEmail, MEMBER_PASSWORD, orgMemberApi
        );
    });

    test('Verify Org Member Archive/Unarchive Functionality (VC-1776)', { tag: ['@regression', '@staging-ready'] }, async ({ page, browser }) => {
        const memberId = createdMember.id;

        // ─── STEP 1: Navigate to org members, verify archive button, archive the member ──
        console.log('[STEP 1] Login as admin and navigate to org members');
        await loginForm.adminLoginAndNavigate(page, admin);
        await navigateToOrgMembersPage(page, organizationId);
        await searchForMember(page, organizationId, memberEmail);

        await expect(page.getByTestId('members-table')).toBeVisible({ timeout: 15_000 });
        await expect(page.getByTestId(`archive-${memberId}`)).toBeVisible({ timeout: 10_000 });
        await expect(page.getByTestId(`unarchive-${memberId}`)).not.toBeVisible();

        await archiveMemberAndVerifyApi(page, organizationId, memberId);

        // ─── STEP 2: Verify member removed from active list, success toast ────────────
        console.log('[STEP 2] Verify member removed from active list');
        await expect(page.getByTestId(`archive-${memberId}`)).not.toBeVisible({ timeout: 10_000 });
        await expect(page.getByTestId('archive-success-toast')).toBeVisible({ timeout: 10_000 });

        // ─── STEP 3: Enable Archives ONLY toggle — verify archived view ───────────────
        console.log('[STEP 3] Enable Archives ONLY toggle and verify archived view');
        await expect(page.getByTestId('members-archived-only')).toBeVisible({ timeout: 10_000 });
        await toggleArchivedOnlyFilter(page, organizationId);

        await expect(page.getByTestId(`unarchive-${memberId}`)).toBeVisible({ timeout: 10_000 });
        await expect(page.getByTestId(`archive-${memberId}`)).not.toBeVisible();
        await expect(page.getByTestId(`member-status-${memberId}`)).toContainText('ARCHIVED', { timeout: 10_000 });
        await expect(page.getByTestId('members-table-archived_at-header')).toBeVisible({ timeout: 10_000 });

        // Archived at cell must contain a non-empty date value
        const memberRow = page.locator('tr').filter({ has: page.getByTestId(`unarchive-${memberId}`) });
        await expect(memberRow).toBeVisible({ timeout: 5_000 });
        const archivedAtCellCount = await memberRow.locator('td').filter({ hasNotText: '' }).count();
        expect(archivedAtCellCount).toBeGreaterThan(0);

        // ─── STEP 4: Verify archived member cannot log in ─────────────────────────────
        console.log('[STEP 4] Verify archived member cannot log in');
        await verifyArchivedMemberCannotLogin(browser, memberEmail, MEMBER_PASSWORD);

        // ─── STEP 5: Unarchive the member ────────────────────────────────────────────
        console.log('[STEP 5] Unarchive the member');
        await unarchiveMemberAndVerifyApi(page, organizationId, memberId);
        await toggleArchivedOnlyFilter(page, organizationId);

        await expect(page.getByTestId(`archive-${memberId}`)).toBeVisible({ timeout: 10_000 });
        await expect(page.getByTestId(`unarchive-${memberId}`)).not.toBeVisible();

        // ─── STEP 6: Verify toggle hidden without EDIT_MEMBERS permission ────────────
        console.log('[STEP 6] Verify archived-only toggle hidden without EDIT_MEMBERS');
        const rolesData = await roleApi.get({ filters: JSON.stringify({ name: ROLE }) });
        const emptyRole = rolesData.data[0];

        const result = await createViewOnlyMemberAndVerifyToggleHidden(
            browser, adminClient, orgMemberApi, organizationId, emptyRole.id
        );
        if (!result.cleanedUp) {
            viewMembersUserId = result.userId;
        }
    });

    test.afterAll(async ({ request }) => {
        console.log('🧹 Starting afterAll cleanup...');

        // Fallback cleanup if in-test cleanup of VIEW_MEMBERS user failed
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
