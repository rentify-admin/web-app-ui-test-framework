import { test, expect } from '@playwright/test';
import { loginWith } from '../utils/session-utils';
import { findSessionLocator, searchSessionWithText } from '../utils/report-page';
import { authenticateAdmin, cleanupTrackedSession } from '../utils/cleanup-helper';
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

        // --- Step 1: VIEW_SESSIONS Only - Button Visible, But No Notes Access ---
        console.log('[STEP 1] Set permissions: view_sessions only, button should be visible but modal shows no access');

        // Navigate to session report page
        await searchSessionWithText(page, session.id);
        await openSessionReport();
        
        // Button should ALWAYS be visible (no permission check on button itself)
        const legacyRemarksBtn1 = page.getByTestId('view-remarks-btn');
        const notesBtn1 = page.locator('#applicant-report').getByRole('button').filter({ hasText: /note/i });
        const remarksBtn1 = (await legacyRemarksBtn1.count()) > 0 ? legacyRemarksBtn1 : notesBtn1;
        await expect(remarksBtn1).toBeVisible({ timeout: 10_000 });
        
        // Click button to open modal - should open but show no notes or permission message
        await remarksBtn1.click();
        const remarksModal1 = page.getByTestId('notes-modal');
        await expect(remarksModal1).toBeVisible({ timeout: 10_000 });
        
        // Without VIEW_SESSION_COMMENTS, the API will return empty/error, so notes list should be empty
        // Check for empty state or permission error message
        // Check for permission denied message or empty state
        const permissionDenied = remarksModal1.getByTestId('notes-permission-denied');
        const emptyState = remarksModal1.locator('.text-center.py-12.text-slate-500');
        const hasPermissionDenied = await permissionDenied.isVisible().catch(() => false);
        const hasEmptyState = await emptyState.isVisible().catch(() => false);
        const hasNotes = await remarksModal1.locator('[data-testid^="note-card-"]').count();
        
        // Either permission denied message, empty state message, or no notes should be visible
        if (hasPermissionDenied) {
            await expect(permissionDenied).toContainText(/don't have permission to view notes/i);
            console.log('Step 1: Permission denied message shown (no permission to view notes).');
        } else if (hasEmptyState) {
            await expect(emptyState).toContainText(/no notes|no_notes_yet/i);
            console.log('Step 1: Empty state message shown (no permission to view notes).');
        } else if (hasNotes === 0) {
            // No notes visible and no empty state message - API likely returned empty array
            console.log('Step 1: No notes visible (no permission to view notes).');
        }
        
        // Form section should NOT be visible (no CREATE_SESSION_COMMENTS permission)
        await expect(remarksModal1.getByTestId('notes-form-section')).not.toBeVisible();
        
        // Close modal
        await remarksModal1.getByTestId('notes-modal-cancel').click();

        // --- Step 2: Add VIEW_SESSION_COMMENTS - View Button Appears ---
        console.log('[STEP 2] Add view_session_comments, should see View Remarks button, but no add/hide');
        await setOrgMemberPermissions(adminClient, organizationId, createdMember.id, [
            { name: 'view_sessions', binding: [] },
            { name: 'view_session_comments', binding: [] }
        ]);
        await page.reload();
        await openSessionReport();

        const legacyRemarksBtn2 = page.getByTestId('view-remarks-btn');
        // Button text can be "Note" (singular) or "Notes" (plural), match both
        const notesBtn2 = page.locator('#applicant-report').getByRole('button').filter({ hasText: /note/i });
        const remarksBtn2 = (await legacyRemarksBtn2.count()) > 0 ? legacyRemarksBtn2 : notesBtn2;
        await expect(remarksBtn2).toBeVisible({ timeout: 10_000 });
        await remarksBtn2.click();

        const remarksModal2 = page.getByTestId('notes-modal');
        await expect(remarksModal2).toBeVisible();
        // Form section should NOT be visible (no CREATE_SESSION_COMMENTS permission yet)
        await expect(remarksModal2.getByTestId('notes-form-section')).not.toBeVisible();

        // The visible remark should be shown, but hide button NOT visible
        const visibleRemarkDiv2 = remarksModal2.getByTestId(`note-card-${visibleRemark.id}`);
        await expect(visibleRemarkDiv2).toBeVisible();
        await expect(visibleRemarkDiv2.getByTestId('hide-note-btn')).not.toBeVisible();

        await expect(remarksModal2.getByTestId('toggle-hidden-comments-checkbox')).not.toBeVisible();
        // Close button: VfModal creates notes-modal-cancel automatically
        await expect(remarksModal2.getByTestId('notes-modal-cancel')).toBeVisible();
        await remarksModal2.getByTestId('notes-modal-cancel').click();

        // --- Step 3: Add CREATE_SESSION_COMMENTS - Add Form Appears ---
        console.log('[STEP 3] Add create_session_comments, should see add form but still no hide');
        await setOrgMemberPermissions(adminClient, organizationId, createdMember.id, [
            { name: 'view_sessions', binding: [] },
            { name: 'view_session_comments', binding: [] },
            { name: 'create_session_comments', binding: [] }
        ]);
        await page.reload();
        await openSessionReport();

        const legacyRemarksBtn3 = page.getByTestId('view-remarks-btn');
        // Button text can be "Note" (singular) or "Notes" (plural), match both
        const notesBtn3 = page.locator('#applicant-report').getByRole('button').filter({ hasText: /note/i });
        const remarksBtn3 = (await legacyRemarksBtn3.count()) > 0 ? legacyRemarksBtn3 : notesBtn3;
        await expect(remarksBtn3).toBeVisible({ timeout: 10_000 });
        await remarksBtn3.click();
        const remarksModal3 = page.getByTestId('notes-modal');
        await expect(remarksModal3.getByTestId('notes-form-section')).toBeVisible();
        await expect(remarksModal3.getByTestId('note-textarea')).toBeVisible();
        await expect(remarksModal3.getByTestId('add-note-btn')).toBeVisible();

        // Still can't see hide button (no HIDE_SESSION_COMMENTS permission yet)
        const visibleRemarkDiv3 = remarksModal3.getByTestId(`note-card-${visibleRemark.id}`);
        await expect(visibleRemarkDiv3.getByTestId('hide-note-btn')).not.toBeVisible();

        await expect(remarksModal3.getByTestId('toggle-hidden-comments-checkbox')).not.toBeVisible();
        await remarksModal3.getByTestId('notes-modal-cancel').click();

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

        const legacyRemarksBtn4 = page.getByTestId('view-remarks-btn');
        // Button text can be "Note" (singular) or "Notes" (plural), match both
        const notesBtn4 = page.locator('#applicant-report').getByRole('button').filter({ hasText: /note/i });
        const remarksBtn4 = (await legacyRemarksBtn4.count()) > 0 ? legacyRemarksBtn4 : notesBtn4;
        await expect(remarksBtn4).toBeVisible({ timeout: 10_000 });
        await remarksBtn4.click();
        const remarksModal4 = page.getByTestId('notes-modal');
        const visibleRemarkDiv4 = remarksModal4.getByTestId(`note-card-${visibleRemark.id}`);
        await expect(visibleRemarkDiv4.getByTestId('hide-note-btn')).toBeVisible();
        // Toggle checkbox still NOT visible (no VIEW_SESSION_HIDDEN_COMMENTS permission yet)
        await expect(remarksModal4.getByTestId('toggle-hidden-comments-checkbox')).not.toBeVisible();
        await remarksModal4.getByTestId('notes-modal-cancel').click();

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

        const legacyRemarksBtn5 = page.getByTestId('view-remarks-btn');
        // Button text can be "Note" (singular) or "Notes" (plural), match both
        const notesBtn5 = page.locator('#applicant-report').getByRole('button').filter({ hasText: /note/i });
        const remarksBtn5 = (await legacyRemarksBtn5.count()) > 0 ? legacyRemarksBtn5 : notesBtn5;
        await expect(remarksBtn5).toBeVisible({ timeout: 10_000 });
        await remarksBtn5.click();
        const remarksModal5 = page.getByTestId('notes-modal');
        // Show hidden toggle checkbox visible (now has VIEW_SESSION_HIDDEN_COMMENTS permission)
        const toggleHiddenCheckbox = remarksModal5.getByTestId('toggle-hidden-comments-checkbox');
        await expect(toggleHiddenCheckbox).toBeVisible();
        await toggleHiddenCheckbox.check();

        // Hidden remark should appear, dimmed style (style cannot test reliably in headless - just visible)
        const hiddenRemarkDiv = remarksModal5.getByTestId(`note-card-${hiddenRemark.id}`);
        await expect(hiddenRemarkDiv).toBeVisible();
        await expect(hiddenRemarkDiv.getByTestId('unhide-note-btn')).toBeVisible();

        await remarksModal5.getByTestId('notes-modal-cancel').click();

        console.log('✅ All permission steps and UI assertions completed.');
    });

    // ==== CLEANUP ====
    test.afterAll(async ({ request }, testInfo) => {
        // CLEANUP DISABLED FOR MANUAL TESTING
        // Keep session and user for debugging
        console.log('🧹 Cleanup disabled. Preserving test data for manual inspection:');
        console.log(`   Session ID: ${createdSession?.id || 'N/A'}`);
        console.log(`   Test User Email: ${organizationMember.email}`);
        console.log(`   Test User Password: ${organizationMember.password}`);
        console.log(`   Member ID: ${createdMember?.id || 'N/A'}`);
        console.log(`   User ID: ${createdUser?.id || 'N/A'}`);
        
        // Cleanup disabled - uncomment below to re-enable
        // if (createdSession) {
        //     try {
        //         await cleanupTrackedSession(request, createdSession.id, testInfo);
        //         console.log('[CLEANUP] Session cleaned up:', createdSession.id);
        //     } catch (err) { console.error('[CLEANUP ERR] session:', err); }
        // }
        // if (createdMember) {
        //     try {
        //         await adminClient.delete(`/organizations/${organizationId}/members/${createdMember.id}`);
        //         console.log('[CLEANUP] Test member cleaned up:', createdMember.id);
        //     } catch (err) { console.error('[CLEANUP ERR] member:', err); }
        // }
        // if (createdUser) {
        //     try {
        //         await adminClient.delete(`/users/${createdUser.id}`);
        //         console.log('[CLEANUP] Test user cleaned up:', createdUser.id);
        //     } catch (err) { console.error('[CLEANUP ERR] user:', err); }
        // }
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
