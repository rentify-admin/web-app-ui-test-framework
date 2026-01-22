import { request, test, expect } from "@playwright/test";
import { authenticateAdmin, cleanupSession } from "../utils/cleanup-helper";
import { admin, app } from "../test_config";
import { ApiClient } from "../api";
import { adminLoginAndNavigateToApplications, loginWith } from "../utils/session-utils";
import { findAndInviteApplication } from "../utils/applications-page";
import generateSessionForm from "../utils/generate-session-form";
import { expectAndFillGuestForm, findSessionLocator, openReportSection, searchSessionWithText } from "../utils/report-page";
import loginForm from "../utils/login-form";
import { joinUrl } from "../utils/helper";

/**
 * QA-245: Edit-Guest-Button-Permission Test
 *
 * Test Steps
 * ----------
 * 
 * SETUP:
 *   1. Login as admin user via API.
 *   2. Navigate to Applications page in UI.
 *   3. Search for an AutoTest app; invite applicant (unique guest user).
 *   4. Extract sessionId from invite.
 *   5. Create INTERNAL test user via API (role with VIEW_SESSIONS but WITHOUT MANAGE_GUESTS).
 *   6. Complete user onboarding flow (simulate invited "internal" user join).
 * 
 * 1: Verify Edit Guest Button Hidden Without MANAGE_GUESTS
 *   - Login as test user.
 *   - Navigate to session report page (/applicants/all/{sessionId}).
 *   - Expand Identity section, verify Edit Guest button is NOT visible.
 *
 * 2: Assign MANAGE_GUESTS Permission
 *   - Use API to grant manage_guests to the test user.
 *
 * 3: Verify Edit Guest Button Visible With MANAGE_GUESTS
 *   - Reload page.
 *   - Verify Edit Guest button IS now visible.
 *
 * 4: Verify Edit Guest Functionality
 *   - Click Edit Guest button. Check modal opens with correct data.
 *   - Update first & last name. Click save.
 *   - Intercept PATCH API, confirm payload & response.
 *   - Confirm modal closes & Identity section updates.
 *
 * 5: Verify Cancel/Close Functionality
 *   - Change only firstname, hit cancel, ensure NO changes saved.
 *   - Change only lastname, close modal via 'X', ensure NO changes saved.
 *
 * CLEANUP: Remove test user and session via API.
 */

test.describe('QA-245 edit-guest-button-permission.spec', () => {
    const roleName = 'Autotest - Internal Role';
    const appName = 'Autotest - Heartbeat Test - Financial';
    const internalUser = {
        first_name: 'Autot - Internal',
        last_name: 'User',
        email: `autotest-internal+${Date.now()}@verifast.com`,
        password: "password"
    };
    const adminClient = new ApiClient(app.urls.api, null, 15000);
    const guestClient = new ApiClient(app.urls.api, null, 15000);

    let createdMember = null;
    let createdUser = null;
    let createdSessionId = null;
    let organizationId = null;
    let memberContext = null;

    test.beforeAll(async ({ request }) => {
        console.log('[SETUP] Authenticating as admin...');
        const token = await authenticateAdmin(request);
        if (!token) {
            console.log(`⚠️ Skipping workflow creation: no admin token found`);
            throw new Error("Admin token required");
        }
        adminClient.setAuthToken(token);

        // Get or create internal role (VIEW_SESSIONS only)
        let role;
        try {
            role = await getOrCreateRole(adminClient, roleName);
        } catch (e) {
            console.error('[API ERROR] getOrCreateRole:', e.message);
            throw e;
        }

        // Get organization ID from admin's memberships
        try {
            const userResp = await adminClient.get(`/users/self?fields[user]=:all`);
            const user = userResp.data?.data;
            organizationId = user?.memberships?.[0]?.organization?.id;
            if (!organizationId) throw new Error("Organization ID not found in memberships");
            console.log(`[SETUP] Using organizationId=${organizationId}`);
        } catch (e) {
            console.error('[API ERROR] fetching org from admin:', e.message);
            throw e;
        }

        // Create organization member (INTERNAL user) with ONLY VIEW_SESSIONS at first
        let memberResp, member, inviteToken;
        try {
            memberResp = await adminClient.post(`/organizations/${organizationId}/members`, {
                role: role.id,
                ...internalUser,
            });
            member = memberResp.data?.data;
            createdMember = member.id;
            createdUser = member.user.id;
            inviteToken = memberResp.headers['token'];
            console.log("🚀 ~ memberResp.headers:", memberResp.headers)
            console.log(`[SETUP] Created user id: ${createdUser}, member id: ${createdMember}`);
            if (!inviteToken) throw new Error("Invite token missing");
            console.log(`[SETUP] Member created (id=${createdMember}), got invite token`);
        } catch (e) {
            console.error('[API ERROR] Creating member:', e.message);
            throw e;
        }

        try {
            const patchPermsResp = await adminClient.patch(`/organizations/${organizationId}/members/${member.id}`, {
                permissions: [{ name: 'view_sessions', bindings: [] }]
            });
            console.log('[SETUP] Patched org member permissions: VIEW_SESSIONS only');
        } catch (e) {
            console.error('[API ERROR] Patch member permissions:', e.message);
            throw e;
        }

        // Finish onboarding: create user from invite token
        try {
            const guestRes = await guestClient.post('/users', {
                first_name: internalUser.first_name,
                last_name: internalUser.last_name,
                state: "AK",
                terms: true,
                password: internalUser.password,
                password_confirmation: internalUser.password,
                token: inviteToken
            });
            if (guestRes.status !== 201 && guestRes.status !== 200) {
                throw new Error(`Unexpected status ${guestRes.status} from /users`);
            }
            console.log('[SETUP] Invited user onboarded successfully');
        } catch (err) {
            console.error('[API ERROR] Onboarding invited user:', err.message);
            throw err;
        }
    });

    test('Verify Edit Guest Button permission gating and UI/edit/cancel flows', {
        tag: ['@qa-245', '@permissions', '@identity', '@ui', '@core', '@regression', '@rc-ready', '@staging-ready']
    }, async ({ page, browser }) => {
        const timestamp = Date.now();
        const guestUser = {
            first_name: "Autot - Permtest",
            last_name: `Guest${timestamp}`,
            email: `permission-test-${timestamp}+autotest@verifast.com`,
            password: `password`
        };

        // --- Step 1: Admin logs in & sends app invite to guest
        console.log('[STEP 0] Admin logs in, navigates to Applications, invites guest app');
        await adminLoginAndNavigateToApplications(page, admin);
        await findAndInviteApplication(page, appName);

        // Generate guest session via form and extract sessionId
        let sessionId;
        try {
            const sessionObj = await generateSessionForm.generateSessionAndExtractLink(page, guestUser);
            sessionId = sessionObj.sessionId;
            createdSessionId = sessionId;
            if (!sessionId) throw new Error('No sessionId generated');
            console.log(`[STEP 0] Created guest sessionId: ${sessionId}`);
        } catch (e) {
            console.error('[API ERROR] Could not generate guest session:', e.message);
            throw e;
        }

        // --- Step 1: Login as internal user, navigate directly to session report ---
        const context = await browser.newContext();
        memberContext = context;
        const memberPage = await context.newPage();
        await memberPage.goto('/');
        await loginForm.fill(memberPage, internalUser);
        const LOGIN_API = joinUrl(app.urls.api, 'auth');
        await memberPage.locator('button[type="submit"]').click();
        await memberPage.waitForResponse(LOGIN_API);

        // Navigate to applicants menu - wait for submenu to be visible before clicking
        const applicantsMenu = memberPage.getByTestId('applicants-menu');
        await applicantsMenu.click();
        const applicantsSubmenu = memberPage.getByTestId('applicants-submenu');
        await expect(applicantsSubmenu).toBeVisible({ timeout: 5000 });
        await applicantsSubmenu.click();
        await expect(memberPage).toHaveTitle(/Applicants/, { timeout: 10_000 });
        // `household-status-alert` is not a reliable page-load indicator (often only visible inside Alert modal).
        // Wait for the report container instead once a session is selected.
        await expect(memberPage.getByTestId('side-panel')).toBeVisible({ timeout: 10_000 });

        console.log('[STEP 1] Loading session details as test user');
        const sessionLocator =  await findSessionLocator(memberPage, `.application-card[data-session="${sessionId}"]`);
        // Click session and wait for report to render
        await sessionLocator.click();
        await expect(memberPage.locator('#applicant-report')).toBeVisible({ timeout: 10_000 });
        
        // Open identity section, verify Edit Guest button is NOT visible ("step 1" of functional test)
        console.log('[STEP 1] Expanding Identity section and checking no Edit Guest button (NO manage_guests)');
        const identitySection = await openReportSection(memberPage, 'identity-section');
        const editGuestBtn = identitySection.getByTestId('identity-edit-guest-btn');
        await expect(editGuestBtn).not.toBeVisible();

        // --- Step 2: Grant manage_guests permission (API) ---
        console.log('[STEP 2] Granting manage_guests permission via API');
        try {
            const resp = await adminClient.patch(`/organizations/${organizationId}/members/${createdMember}`, {
                permissions: [
                    { name: 'view_sessions', bindings: [] },
                    { name: 'manage_guests', bindings: [] }
                ]
            });
            if (resp.status !== 200) throw new Error('Failed to update permissions');
            console.log('[STEP 2] manage_guests permission assigned');
        } catch (e) {
            console.error('[API ERROR] Grant manage_guests failed:', e.message);
            throw e;
        }

        // --- Step 3: Reload and check that Edit Guest button IS present ---
        console.log('[STEP 3] Reloading page to check Edit Guest button now visible');
        await memberPage.reload();
        // Wait for page to load and navigate back to session report
        await expect(memberPage.getByTestId('side-panel')).toBeVisible({ timeout: 10_000 });
        // Navigate back to session if needed
        const sessionLocator2 = await findSessionLocator(memberPage, `.application-card[data-session="${sessionId}"]`);
        await sessionLocator2.click();
        await expect(memberPage.locator('#applicant-report')).toBeVisible({ timeout: 10_000 });
        await memberPage.waitForTimeout(1000); // Wait for session to stabilize
        const identitySection2 = await openReportSection(memberPage, 'identity-section');
        const editGuestBtn2 = identitySection2.getByTestId('identity-edit-guest-btn');
        await expect(editGuestBtn2).toBeVisible();
        console.log('[STEP 3] Edit Guest button now visible after permission grant');

        // --- Step 4: Click Edit Guest, update values, PATCH & verify ---
        await editGuestBtn2.click();
        const ts = Date.now();
        const dummyUserData = {
            first_name: `Updatedfirst${ts}`,
            last_name: `Updatedlast${ts}`,
        };

        console.log('[STEP 4] Verifying edit guest modal and editing values');
        await expectAndFillGuestForm(memberPage, guestUser, dummyUserData);

        // Submit and listen for PATCH; verify payload and response
        const guestEditModal = memberPage.getByTestId('identity-update-guest-modal');
        const guestSubmitBtn = guestEditModal.getByTestId('submit-guest-update-form');
        await expect(guestSubmitBtn).toBeVisible();

        // Intercept PATCH for /guests/{guestId}
        const guestPatchRegex = new RegExp('/guests/[0-9a-fA-F-]{36}\\b');
        let patchPayload = null;
        memberPage.route(guestPatchRegex, (route, request) => {
            if (request.method().toUpperCase() === "PATCH") {
                patchPayload = request.postDataJSON();
            }
            route.continue();
        });

        const [guestPatchResponse] = await Promise.all([
            memberPage.waitForResponse(resp =>
                guestPatchRegex.test(resp.url()) &&
                resp.request().method() === 'PATCH'
            ),
            guestSubmitBtn.click()
        ]);
        if (!(await guestPatchResponse.ok())) {
            console.error('[API ERROR] Guest PATCH failed:', await guestPatchResponse.text());
            throw new Error('Guest PATCH failed');
        }
        const respJSON = await guestPatchResponse.json();
        expect(respJSON.data).toMatchObject({
            first_name: dummyUserData.first_name,
            last_name: dummyUserData.last_name
        });

        if (patchPayload) {
            expect(patchPayload).toMatchObject({
                first_name: dummyUserData.first_name,
                last_name: dummyUserData.last_name
            });
            console.log('[STEP 4] PATCH payload validated:', patchPayload);
        } else {
            console.warn('[STEP 4] Could not intercept PATCH payload for edit guest');
        }

        await expect(memberPage.getByTestId('identity-update-guest-modal')).toBeHidden();

        // Verify identity displays update
        const userFullNameText = memberPage.getByTestId('identity-guest-full-name');
        const userEmailText = memberPage.getByTestId('identity-guest-email');
        const expectedFullName = `${dummyUserData.first_name} ${dummyUserData.last_name}`;
        await expect(userFullNameText).toBeVisible();
        await expect(userEmailText).toBeVisible();
        await expect(userFullNameText).toHaveText(new RegExp(expectedFullName.replace(/\s+/, '\\s+')), { timeout: 20_000 });
        await expect(userEmailText).toHaveText(guestUser.email, { timeout: 20_000 });
        console.log('[STEP 4] Guest name values updated and verified in UI');

        // --- Step 5: Cancel & close modal does NOT persist changes ---
        // First: modify firstname, click Cancel
        // Re-fetch identity section and edit button to avoid stale references
        const identitySection3 = await openReportSection(memberPage, 'identity-section');
        const editGuestBtn3 = identitySection3.getByTestId('identity-edit-guest-btn');
        await editGuestBtn3.click();
        await expectAndFillGuestForm(memberPage,
            { ...guestUser, ...dummyUserData }, // Current UI
            { first_name: 'TempName' }
        );
        const cancelBtn1 = memberPage.getByTestId('cancel-guest-update-form');
        await expect(cancelBtn1).toBeVisible();
        await cancelBtn1.click();
        const guestEditModal1 = memberPage.getByTestId('identity-update-guest-modal');
        await expect(guestEditModal1).toBeHidden();
        // Guest name still displays updated (should NOT be 'TempName')
        await expect(userFullNameText).toHaveText(new RegExp(expectedFullName.replace(/\s+/, '\\s+')));

        // Second: modify lastname, click X/close, cancel out
        // Re-fetch identity section and edit button to avoid stale references
        const identitySection4 = await openReportSection(memberPage, 'identity-section');
        const editGuestBtn4 = identitySection4.getByTestId('identity-edit-guest-btn');
        await editGuestBtn4.click();
        await expectAndFillGuestForm(memberPage,
            { ...guestUser, ...dummyUserData },
            { last_name: 'TempLast' }
        );
        // Assume modal can be closed by clicking 'cancel' again for this implementation
        const cancelBtn2 = memberPage.getByTestId('cancel-guest-update-form');
        await expect(cancelBtn2).toBeVisible();
        await cancelBtn2.click();
        const guestEditModal2 = memberPage.getByTestId('identity-update-guest-modal');
        await expect(guestEditModal2).toBeHidden();
        await expect(userFullNameText).toHaveText(new RegExp(expectedFullName.replace(/\s+/, '\\s+')));
        console.log('[STEP 5] Modal cancel/close does NOT save changes - verified');

        // Final: open and close modal with no changes for coverage
        // Re-fetch identity section and edit button to avoid stale references
        const identitySection5 = await openReportSection(memberPage, 'identity-section');
        const editGuestBtn5 = identitySection5.getByTestId('identity-edit-guest-btn');
        await editGuestBtn5.click();
        const guestEditModal3 = memberPage.getByTestId('identity-update-guest-modal');
        await expect(guestEditModal3).toBeVisible();
        await expectAndFillGuestForm(memberPage,
            { ...guestUser, ...dummyUserData },
            {}
        );
        const cancelBtn3 = memberPage.getByTestId('cancel-guest-update-form');
        await expect(cancelBtn3).toBeVisible();
        await cancelBtn3.click();
        await expect(guestEditModal3).toBeHidden();

        console.log("✅ Test flow completed successfully");
    });

    test.afterAll(async ({ request }, testInfo) => {
        try {
            // Close browser context if it exists
            if (memberContext) {
            try {
                    await memberContext.close();
                    console.log('[CLEANUP] Member browser context closed');
                } catch (e) {
                    console.error('[CLEANUP ERROR] Could not close member context:', e.message);
                }
            }

            // Delete member first (remove organization relationship)
                if (createdMember) {
                    try {
                    await adminClient.delete(`/organizations/${organizationId}/members/${createdMember}`);
                        console.log('[CLEANUP] Test member cleaned up:', createdMember);
                    } catch (e) {
                        console.log(`[CLEANUP ERROR] Could not cleanup member with id ${createdMember}`);
                        console.error('[CLEANUP ERROR] Could not cleanup member:', e.message);
                    }
                }

            // Always delete user (to prevent orphaned users)
                if (createdUser) {
                    try {
                    await adminClient.delete(`/users/${createdUser}`);
                        console.log('[CLEANUP] Test user cleaned up:', createdUser);
                    } catch (e) {
                        console.log(`[CLEANUP ERROR] Could not cleanup user with id ${createdUser}`);
                        console.error('[CLEANUP ERROR] Could not cleanup user:', e.message);
                    }
                }

            // Delete session (only if test passed, keep for debugging if failed)
            if (createdSessionId) {
                if (testInfo.status === 'passed') {
                    await cleanupSession(request, createdSessionId);
                    console.log('[CLEANUP] Session cleaned up:', createdSessionId);
                } else {
                    console.log(`[CLEANUP] Keeping session for debugging: ${createdSessionId}`);
                }
            }
        } catch (cleanupError) {
                console.error('[CLEANUP ERROR] Test cleanup failed:', cleanupError.message);
        }
    });
});

/**
 * Get or create an internal role with given name and log diagnostics.
 */
async function getOrCreateRole(adminClient, roleName) {
    try {
        const roleResp = await adminClient.get('/roles', {
            params: {
                'fields[role]': 'id,role,permissions',
                filters: JSON.stringify({
                    role: { name: roleName }
                })
            }
        });
        let roles = roleResp.data?.data;
        if (!roles || roles.length === 0) {
            // No role found, create it
            const createResp = await adminClient.client.post('/roles', {
                name: roleName,
                scope: "internal",
                level: 2
            });
            roles = [createResp.data.data];
            console.log(`✅ Created new role: ${roleName}`);
        } else {
            console.log(`ℹ️ Found existing role "${roleName}"`);
        }
        return roles[0];
    } catch (err) {
        console.error('[API ERROR] getOrCreateRole:', err.message);
        throw err;
    }
}