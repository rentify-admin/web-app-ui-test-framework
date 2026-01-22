import { test, expect } from '@playwright/test';
import { loginWith } from '../utils/session-utils';
import { findSessionLocator, searchSessionWithText } from '../utils/report-page';
import { authenticateAdmin, cleanupSession } from '../utils/cleanup-helper';
import { ApiClient } from '../api';
import { app } from '../test_config';
import loginForm from '../utils/login-form';

// Main describe block
test.describe('QA-250 remarks_permissions.spec', () => {

    // === Cleanup / context variables ===
    let createdMember = null;
    let createdUser = null;
    let createdSession = null;
    let organizationId = null;
    let session = null;
    let visibleRemark = null;
    let hiddenRemark = null;

    // === Test data ===
    const appName = 'AutoTest - Flag Issue V2';
    const organizationName = 'Permissions Test Org';
    const roleName = 'Autotest - Empty role';
    const timestamp = Date.now();
    const organizationMember = {
        first_name: 'Autot - Remark',
        last_name: 'Permission',
        email: `autotest-remark+${timestamp}@verifast.com`,
        password: "password"
    };
    const applicantData = {
        first_name: "Autot - Permtest",
        last_name: `Guest${timestamp}`,
        email: `permission-test-${timestamp}+autotest@verifast.com`,
        password: `password`
    };

    // Assume ApiClient and app are globally available
    const adminClient = new ApiClient(app.urls.api, null, 15000);
    const guestClient = new ApiClient(app.urls.api, null, 15000);

    test.beforeAll(async ({ request }) => {
        // === SETUP ===
        console.log('SETUP: Authenticating as admin...');
        const token = await authenticateAdmin(request);
        if (!token) throw new Error("Admin token required");
        adminClient.setAuthToken(token);

        // Application context
        console.log('SETUP: Using application:', appName);
        const application = await getApplicationByName(adminClient, appName);

        // Create session (test applicant)
        console.log('SETUP: Creating test session...');
        session = await createSession(adminClient, {
            application: application.id,
            ...applicantData
        });
        createdSession = session;

        // Add a visible and a hidden remark to the session
        console.log('SETUP: Adding visible remark via API...');
        const visibleResp = await adminClient.post(`/sessions/${session.id}/comments`, {
            comment: 'This is test visible comment'
        });
        visibleRemark = visibleResp.data.data;

        console.log('SETUP: Adding hidden remark via API...');
        const hiddenResp = await adminClient.post(`/sessions/${session.id}/comments`, {
            comment: 'This is test hidden comment'
        });
        hiddenRemark = hiddenResp.data.data;
        await adminClient.patch(`/sessions/${session.id}/comments/${hiddenRemark.id}`, {
            is_hidden: 1
        });

        // Get org, role, invite/register org member
        console.log('SETUP: Looking up org and role...');
        organizationId = await getOrganization(adminClient, organizationName);
        const role = await getOrCreateRole(adminClient, roleName);

        console.log('SETUP: Creating organization member via API...');
        let memberResp = await adminClient.post(`/organizations/${organizationId}/members`, {
            role: role.id,
            ...organizationMember,
        });
        createdMember = memberResp.data?.data;
        const inviteToken = memberResp.headers['token'];

        // Complete registration (invite token)
        console.log('SETUP: Completing registration for invited user...');
        const guestRes = await guestClient.post('/users', {
            first_name: organizationMember.first_name,
            last_name: organizationMember.last_name,
            state: "AK",
            terms: true,
            password: organizationMember.password,
            password_confirmation: organizationMember.password,
            token: inviteToken
        });
        createdUser = createdMember.user;
        await setOrgMemberPermissions(adminClient, organizationId, createdMember.id, [
            { name: 'view_sessions', binding: [] }
        ]);
        // Sanity
        if (!createdMember || !createdUser) throw new Error("Failed to create test member and user");
    });

    test('Verify session remarks UI and permission gating', { tag: ['@regression', '@staging-ready', '@rc-ready'] }, async ({ page }) => {
        // --- Login as test user ---
        console.log('[LOGIN] Logging in as test user...');
        await page.goto('/');
        await loginForm.fill(page, organizationMember);
        await page.locator('button[type="submit"]').click();
        const applicantMenu = page.getByTestId('applicants-menu');
        await expect(applicantMenu).toBeVisible();
        await applicantMenu.click();
        const applicantSubmenu = page.getByTestId('applicants-submenu');
        await expect(applicantSubmenu).toBeVisible({ timeout: 5000 });
        await applicantSubmenu.click();

        await page.waitForTimeout(3000);

        // Helper: open the target session and wait for the report panel to load.
        // NOTE: `household-status-alert` is not a reliable load indicator (often modal-only).
        const openSessionReport = async () => {
            const sessionCard = await findSessionLocator(page, `.application-card[data-session="${session.id}"]`);
            // ✅ Do not wait on a specific network response here (can be flaky / cached / already fulfilled).
            // Instead rely on UI readiness of the report container.
            await sessionCard.click();
            await expect(page.locator('#applicant-report')).toBeVisible({ timeout: 10_000 });
            await page.waitForTimeout(1000); // allow report UI to stabilize
        };

        // --- Step 1: VIEW_SESSIONS Only - No Remarks Access ---
        console.log('[STEP 1] Set permissions: view_sessions only, and check no remarks access');

        // Navigate to session report page
        await searchSessionWithText(page, session.id);
        await openSessionReport();
        // Should NOT see remarks button (UI changed from `view-remarks-btn` to "Notes")
        await expect(page.getByTestId('view-remarks-btn')).not.toBeVisible();
        await expect(page.locator('#applicant-report').getByRole('button', { name: /notes/i })).not.toBeVisible();

        // --- Step 2: Add VIEW_SESSION_COMMENTS - View Button Appears ---
        console.log('[STEP 2] Add view_session_comments, should see View Remarks button, but no add/hide');
        await setOrgMemberPermissions(adminClient, organizationId, createdMember.id, [
            { name: 'view_sessions', binding: [] },
            { name: 'view_session_comments', binding: [] }
        ]);
        await page.reload();
        await openSessionReport();

        const legacyRemarksBtn = page.getByTestId('view-remarks-btn');
        const notesBtn = page.locator('#applicant-report').getByRole('button', { name: /notes/i });
        const remarksBtn = (await legacyRemarksBtn.count()) > 0 ? legacyRemarksBtn : notesBtn;
        await expect(remarksBtn).toBeVisible({ timeout: 10_000 });
        await remarksBtn.click();

        const remarksModal = page.getByTestId('remark-history-modal');
        await expect(remarksModal).toBeVisible();
        await expect(remarksModal.getByTestId('remark-history-display-section')).toBeVisible();
        await expect(remarksModal.getByTestId('remark-history-form-section')).not.toBeVisible();

        // The visible remark should be shown, but hide button NOT visible
        const visibleRemarkDiv = remarksModal.getByTestId(`remark-comment-${visibleRemark.id}`);
        await expect(visibleRemarkDiv).toBeVisible();
        await expect(visibleRemarkDiv.getByTestId('hide-comment-btn')).not.toBeVisible();

        await expect(remarksModal.getByTestId('toggle-hidden-comments-btn')).not.toBeVisible();
        await expect(remarksModal.getByTestId('close-remark-history-modal')).toBeVisible();
        await remarksModal.getByTestId('close-remark-history-modal').click();

        // --- Step 3: Add CREATE_SESSION_COMMENTS - Add Form Appears ---
        console.log('[STEP 3] Add create_session_comments, should see add form but still no hide');
        await setOrgMemberPermissions(adminClient, organizationId, createdMember.id, [
            { name: 'view_sessions', binding: [] },
            { name: 'view_session_comments', binding: [] },
            { name: 'create_session_comments', binding: [] }
        ]);
        await page.reload();
        await openSessionReport();

        const legacyRemarksBtn2 = page.getByTestId('view-remarks-btn');
        const notesBtn2 = page.locator('#applicant-report').getByRole('button', { name: /notes/i });
        const remarksBtn2 = (await legacyRemarksBtn2.count()) > 0 ? legacyRemarksBtn2 : notesBtn2;
        await expect(remarksBtn2).toBeVisible({ timeout: 10_000 });
        await remarksBtn2.click();
        const remarksModal2 = page.getByTestId('remark-history-modal');
        await expect(remarksModal2.getByTestId('remark-history-form-section')).toBeVisible();
        await expect(remarksModal2.getByTestId('remark-textarea')).toBeVisible();
        await expect(remarksModal2.getByTestId('submit-remark-btn')).toBeVisible();

        // Still can't see hide button
        const visibleRemarkDiv2 = remarksModal2.getByTestId(`remark-comment-${visibleRemark.id}`);
        await expect(visibleRemarkDiv2.getByTestId('hide-comment-btn')).not.toBeVisible();

        await expect(remarksModal2.getByTestId('toggle-hidden-comments-btn')).not.toBeVisible();
        await remarksModal2.getByTestId('close-remark-history-modal').click();

        // --- Step 4: Add HIDE_SESSION_COMMENTS - Hide/Unhide Buttons Appear ---
        console.log('[STEP 4] Add hide_session_comments, should see hide on visible remark');
        await setOrgMemberPermissions(adminClient, organizationId, createdMember.id, [
            { name: 'view_sessions', binding: [] },
            { name: 'view_session_comments', binding: [] },
            { name: 'create_session_comments', binding: [] },
            { name: 'hide_session_comments', binding: [] }
        ]);
        await page.reload();
        await openSessionReport();

        const legacyRemarksBtn3 = page.getByTestId('view-remarks-btn');
        const notesBtn3 = page.locator('#applicant-report').getByRole('button', { name: /notes/i });
        const remarksBtn3 = (await legacyRemarksBtn3.count()) > 0 ? legacyRemarksBtn3 : notesBtn3;
        await expect(remarksBtn3).toBeVisible({ timeout: 10_000 });
        await remarksBtn3.click();
        const remarksModal3 = page.getByTestId('remark-history-modal');
        const visibleRemarkDiv3 = remarksModal3.getByTestId(`remark-comment-${visibleRemark.id}`);
        await expect(visibleRemarkDiv3.getByTestId('hide-comment-btn')).toBeVisible();
        await expect(remarksModal3.getByTestId('toggle-hidden-comments-btn')).not.toBeVisible();
        await remarksModal3.getByTestId('close-remark-history-modal').click();

        // --- Step 5: Add VIEW_SESSION_HIDDEN_COMMENTS - Toggle Appears ---
        console.log('[STEP 5] Add view_session_hidden_comments, show hidden and verify hidden remark UI');
        await setOrgMemberPermissions(adminClient, organizationId, createdMember.id, [
            { name: 'view_sessions', binding: [] },
            { name: 'view_session_comments', binding: [] },
            { name: 'create_session_comments', binding: [] },
            { name: 'hide_session_comments', binding: [] },
            { name: 'view_session_hidden_comments', binding: [] }
        ]);
        await page.reload();
        await openSessionReport();

        const legacyRemarksBtn4 = page.getByTestId('view-remarks-btn');
        const notesBtn4 = page.locator('#applicant-report').getByRole('button', { name: /notes/i });
        const remarksBtn4 = (await legacyRemarksBtn4.count()) > 0 ? legacyRemarksBtn4 : notesBtn4;
        await expect(remarksBtn4).toBeVisible({ timeout: 10_000 });
        await remarksBtn4.click();
        const remarksModal4 = page.getByTestId('remark-history-modal');
        // Show hidden toggle visible
        const toggleHiddenBtn = remarksModal4.getByTestId('toggle-hidden-comments-btn');
        await expect(toggleHiddenBtn).toBeVisible();
        await toggleHiddenBtn.click();

        // Hidden remark should appear, dimmed style (style cannot test reliably in headless - just visible)
        const hiddenRemarkDiv = remarksModal4.getByTestId(`remark-comment-${hiddenRemark.id}`);
        await expect(hiddenRemarkDiv).toBeVisible();
        await expect(hiddenRemarkDiv.getByTestId('unhide-comment-btn')).toBeVisible();

        await remarksModal4.getByTestId('close-remark-history-modal').click();

        console.log('✅ All permission steps and UI assertions completed.');
    });

    // ==== CLEANUP ====
    test.afterAll(async ({ request }, testInfo) => {
        if (createdSession) {
            try {
                await cleanupSession(request, createdSession.id);
                console.log('[CLEANUP] Session cleaned up:', createdSession.id);
            } catch (err) { console.error('[CLEANUP ERR] session:', err); }
        }
        if (createdMember) {
            try {
                await adminClient.delete(`/organizations/${organizationId}/members/${createdMember.id}`);
                console.log('[CLEANUP] Test member cleaned up:', createdMember.id);
            } catch (err) { console.error('[CLEANUP ERR] member:', err); }
        }
        if (createdUser) {
            try {
                await adminClient.delete(`/users/${createdUser.id}`);
                console.log('[CLEANUP] Test user cleaned up:', createdUser.id);
            } catch (err) { console.error('[CLEANUP ERR] user:', err); }
        }
    });
});

// --- HELPER FUNCTIONS ---

async function setOrgMemberPermissions(adminClient, organizationId, memberId, permissions) {
    await adminClient.patch(`/organizations/${organizationId}/members/${memberId}`, { permissions });
    console.log(`[API] Updated org member permissions to:`, permissions.map(p => p.name).join(', '));
}

async function getOrganization(adminClient, organizationName) {
    const orgResp = await adminClient.get(`/organizations`, {
        params: {
            'fields[organization]': 'id,name',
            filters: JSON.stringify({ name: organizationName })
        }
    });
    const organization = orgResp.data?.data?.[0];
    if (!organization) throw new Error("Organization not found");
    console.log(`[API] Org "${organizationName}" found, id=${organization.id}`);
    return organization.id;
}

async function getOrCreateRole(adminClient, roleName) {
    const roleResp = await adminClient.get('/roles', {
        params: {
            'fields[role]': 'id,role,permissions',
            filters: JSON.stringify({ role: { name: roleName } })
        }
    });
    let roles = roleResp.data?.data;
    if (!roles || roles.length === 0) {
        const createResp = await adminClient.client.post('/roles', {
            name: roleName,
            scope: "internal",
            level: 2
        });
        roles = [createResp.data.data];
        console.log(`[API] Created new role "${roleName}"`);
    } else {
        console.log(`[API] Using existing role "${roleName}"`);
    }
    return roles[0];
}

async function getApplicationByName(adminClient, appName) {
    const applicationResponse = await adminClient.get('/applications', {
        params: {
            "fields[application]": "id,name",
            filters: JSON.stringify({ name: appName })
        }
    });
    const application = applicationResponse.data?.data?.[0];
    if (!application) throw new Error(`Application not found: ${appName}`);
    return application;
}

async function createSession(adminClient, data) {
    const sessionResp = await adminClient.post('/sessions', {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        application: data.application,
        invite: true
    });
    if (!sessionResp.data?.data) throw new Error('Error creating session: no response');
    return sessionResp.data.data;
}
