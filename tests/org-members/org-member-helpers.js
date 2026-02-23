import { expect } from '@playwright/test';
import loginForm from '../utils/login-form';

// ─── Constants ───────────────────────────────────────────────────────────────

export const MEMBER_PERMISSIONS = [
    { name: 'manage_sessions', bindings: [] },
    { name: 'manage_applicants', bindings: [] },
    { name: 'manage_applications', bindings: [] },
    { name: 'view_applications', bindings: [] },
];

// ─── Setup Helpers ────────────────────────────────────────────────────────────

/**
 * Creates an org member via the invite flow and sets their permissions.
 * Encapsulates the full invite-based member creation sequence used in beforeAll.
 *
 * @param {import('../api').ApiClient} adminClient
 * @param {import('../api').ApiClient} guestClient  - Unauthenticated client for /users registration
 * @param {string} organizationId
 * @param {string} roleId
 * @param {string} email
 * @param {string} password
 * @param {import('../api/base-api').default} orgMemberApi
 * @returns {Promise<object>} createdMember — the data.data from the member POST response
 */
export async function createMemberWithInvite(adminClient, guestClient, organizationId, roleId, email, password, orgMemberApi) {
    const memberData = await adminClient.post(`/organizations/${organizationId}/members`, {
        email,
        first_name: 'Test',
        last_name: 'User',
        password,
        password_confirmation: password,
        role: roleId,
    });
    expect(memberData.data.data).toBeDefined();

    const createdMember = memberData.data.data;
    const inviteToken = memberData.headers['token'];

    const guestRes = await guestClient.post('/users', {
        first_name: 'Test',
        last_name: 'User',
        state: 'AK',
        terms: true,
        password,
        password_confirmation: password,
        token: inviteToken,
    });
    expect(guestRes.data).toBeDefined();

    await orgMemberApi.update(createdMember.id, { permissions: MEMBER_PERMISSIONS });

    return createdMember;
}

// ─── Page Navigation Helpers ──────────────────────────────────────────────────

/**
 * Navigates directly to an organization's members tab by URL.
 * Pass `'self'` as organizationId to navigate to the current user's own org.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} organizationId  - UUID or `'self'`
 */
export async function navigateToOrgMembersPage(page, organizationId) {
    await page.goto(`/organizations/${organizationId}/show`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('users-tab')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('users-tab').click();
    await expect(page.getByTestId('orgnanization-members-search')).toBeVisible({ timeout: 10_000 });
}

/**
 * Fills the member search input and waits for the filtered GET members response.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} organizationId
 * @param {string} memberEmail
 * @returns {Promise<import('@playwright/test').Response>} The matched API response
 */
export async function searchForMember(page, organizationId, memberEmail) {
    const [searchResponse] = await Promise.all([
        page.waitForResponse(resp => {
            if (
                new RegExp(`/organizations/${organizationId}/members`).test(resp.url()) &&
                resp.request().method() === 'GET' &&
                resp.ok()
            ) {
                const filtersParam = new URL(resp.url()).searchParams.get('filters');
                return filtersParam ? JSON.stringify(JSON.parse(filtersParam)).includes(memberEmail) : false;
            }
            return false;
        }),
        page.getByTestId('orgnanization-members-search').fill(memberEmail),
    ]);
    return searchResponse;
}

// ─── Archive / Unarchive Action Helpers ──────────────────────────────────────

/**
 * Clicks the archive button for a member, verifies the API contract, and returns
 * the response data. Uses `page.once` to avoid leaking the dialog handler.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} organizationId
 * @param {string} memberId
 * @returns {Promise<{ archiveResponseData: object }>}
 */
export async function archiveMemberAndVerifyApi(page, organizationId, memberId) {
    page.once('dialog', dialog => dialog.accept());

    const [archiveResponse] = await Promise.all([
        page.waitForResponse(resp =>
            new RegExp(`/organizations/${organizationId}/members/${memberId}`).test(resp.url()) &&
            resp.request().method() === 'PATCH' &&
            resp.ok()
        ),
        page.getByTestId(`archive-${memberId}`).click(),
    ]);

    const archiveRequestBody = JSON.parse(archiveResponse.request().postData() || '{}');
    expect(archiveRequestBody.archived).toBe(true);
    expect(archiveResponse.status()).toBe(200);

    const archiveResponseData = await archiveResponse.json();
    expect(archiveResponseData.data.archived_at).not.toBeNull();

    return { archiveResponseData };
}

/**
 * Clicks the unarchive button for a member and verifies the API contract.
 * No dialog handler needed — unarchive does not trigger a browser confirm.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} organizationId
 * @param {string} memberId
 * @returns {Promise<{ unarchiveResponseData: object }>}
 */
export async function unarchiveMemberAndVerifyApi(page, organizationId, memberId) {
    page.once('dialog', dialog => dialog.accept());
    const [unarchiveResponse] = await Promise.all([
        page.waitForResponse(resp =>
            new RegExp(`/organizations/${organizationId}/members/${memberId}`).test(resp.url()) &&
            resp.request().method() === 'PATCH' &&
            resp.ok()
        ),
        page.getByTestId(`unarchive-${memberId}`).click(),
    ]);

    const unarchiveRequestBody = JSON.parse(unarchiveResponse.request().postData() || '{}');
    expect(unarchiveRequestBody.archived).toBe(false);

    const unarchiveResponseData = await unarchiveResponse.json();
    expect(unarchiveResponseData.data.archived_at).toBeNull();

    return { unarchiveResponseData };
}

/**
 * Clicks the "Archives ONLY" toggle and waits for the members table to reload.
 * Call once to enable and again to disable — same function for both directions.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} organizationId
 */
export async function toggleArchivedOnlyFilter(page, organizationId) {
    await Promise.all([
        page.waitForResponse(resp =>
            new RegExp(`/organizations/${organizationId}/members`).test(resp.url()) &&
            resp.request().method() === 'GET' &&
            resp.ok()
        ),
        page.getByTestId('members-archived-only').click(),
    ]);
}

// ─── Login / Permission Verification Helpers ─────────────────────────────────

/**
 * Verifies that an archived member cannot log in by attempting login in an
 * isolated browser context and asserting the response or dashboard is blocked.
 *
 * @param {import('@playwright/test').Browser} browser
 * @param {string} email
 * @param {string} password
 */
export async function verifyArchivedMemberCannotLogin(browser, email, password) {
    const context = await browser.newContext();
    try {
        const archivedPage = await context.newPage();
        await archivedPage.goto('/', { waitUntil: 'domcontentloaded' });
        await loginForm.fill(archivedPage, { email, password });

        const [authResp] = await Promise.all([
            archivedPage.waitForResponse(resp =>
                resp.url().includes('/auth') && resp.request().method() === 'POST'
            ),
            archivedPage.locator('button[type="submit"]').click(),
        ]);

        if (authResp.ok()) {
            // Auth returned 200 but the user should be blocked from the dashboard
            await expect(archivedPage.getByTestId('side-panel')).not.toBeVisible({ timeout: 5_000 });
        } else {
            // Auth rejected (401/403/422) — login blocked as expected
            expect([401, 403, 422]).toContain(authResp.status());
        }
    } finally {
        await context.close();
    }
}

/**
 * Creates a VIEW_MEMBERS-only user, logs them in via an isolated browser context,
 * navigates to the org members page, and asserts the "Archives ONLY" toggle is hidden.
 * Cleans up the test user in-test (in the finally block).
 *
 * @param {import('@playwright/test').Browser} browser
 * @param {import('../api').ApiClient} adminClient
 * @param {import('../api/base-api').default} orgMemberApi
 * @param {string} organizationId
 * @param {string} roleId
 * @returns {Promise<{ cleanedUp: boolean, userId: string | null }>}
 *   cleanedUp=true and userId=null when in-test cleanup succeeded;
 *   cleanedUp=false and userId=<id> when it failed (for afterAll fallback).
 */
export async function createViewOnlyMemberAndVerifyToggleHidden(browser, adminClient, orgMemberApi, organizationId, roleId) {
    const viewEmail = `test-view-only+${Date.now()}@example.com`;
    const viewPassword = 'password';

    const viewUserResp = await adminClient.post('/users', {
        email: viewEmail,
        first_name: 'Test',
        last_name: 'ViewOnly',
        password: viewPassword,
        password_confirmation: viewPassword,
        organization: organizationId,
        role: roleId,
    });
    const viewMembersUserId = viewUserResp.data?.data?.id;
    expect(viewMembersUserId).toBeDefined();
    console.log(`[STEP 6] Created VIEW_MEMBERS test user: ${viewMembersUserId}`);

    // Retrieve the membership ID for the newly created user
    const viewUserDetails = await adminClient.get(`/users/${viewMembersUserId}?fields[user]=:all`);
    const viewMemberships = viewUserDetails.data?.data?.memberships || [];
    const viewMembership = viewMemberships.find(m => m?.organization?.id === organizationId);
    const viewMembersMemberId = viewMembership?.id;
    expect(viewMembersMemberId).toBeDefined();

    // Restrict to VIEW_MEMBERS + MANAGE_ORGANIZATIONS only (no EDIT_MEMBERS)
    await orgMemberApi.update(viewMembersMemberId, {
        permissions: [
            { name: 'view_members', bindings: [] },
            { name: 'manage_organizations', bindings: [] }, // needed to see the org in the sidebar
        ],
    });
    console.log('[STEP 6] Permissions set to VIEW_MEMBERS & MANAGE_ORGANIZATIONS only');

    // Brief wait for the auth service to register the new user
    await new Promise(resolve => setTimeout(resolve, 2000));

    const context = await browser.newContext();
    try {
        const viewMembersPage = await context.newPage();
        await viewMembersPage.goto('/', { waitUntil: 'domcontentloaded' });
        await loginForm.fill(viewMembersPage, { email: viewEmail, password: viewPassword });

        const [viewAuthResp] = await Promise.all([
            viewMembersPage.waitForResponse(resp =>
                resp.url().includes('/auth') && resp.request().method() === 'POST'
            ),
            viewMembersPage.locator('button[type="submit"]').click(),
        ]);
        expect(viewAuthResp.ok()).toBe(true);

        // Wait for login to complete — logout-menu is always visible regardless of permissions
        await expect(viewMembersPage.getByTestId('logout-menu')).toBeVisible({ timeout: 20_000 });

        // Navigate to the user's own org members page
        await navigateToOrgMembersPage(viewMembersPage, 'self');
        await expect(viewMembersPage.getByTestId('members-table')).toBeVisible({ timeout: 15_000 });

        // Archived-only toggle must NOT be visible (no EDIT_MEMBERS permission)
        await expect(viewMembersPage.getByTestId('members-archived-only')).not.toBeVisible({ timeout: 5_000 });
        console.log('[STEP 6] ✅ archived-only toggle correctly hidden for VIEW_MEMBERS user');
    } finally {
        await context.close();
    }

    // In-test cleanup of the VIEW_MEMBERS user
    let cleanedUp = false;
    try {
        await adminClient.delete(`/users/${viewMembersUserId}`);
        console.log('✅ VIEW_MEMBERS test user deleted');
        cleanedUp = true;
    } catch (e) {
        console.error('⚠️ In-test cleanup of VIEW_MEMBERS user failed:', e.message);
    }

    return { cleanedUp, userId: cleanedUp ? null : viewMembersUserId };
}
