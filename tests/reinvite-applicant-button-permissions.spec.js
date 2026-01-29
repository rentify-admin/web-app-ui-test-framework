import { expect, test } from "@playwright/test";
import { adminLoginAndNavigateToApplications, loginWith, prepareSessionForFreshSelection } from "./utils/session-utils";
import { admin, app } from "./test_config";
import { findAndInviteApplication } from "./utils/applications-page";
import generateSessionForm from "./utils/generate-session-form";
import { getRandomEmail } from "./utils/helper";
import { fillhouseholdForm, setupInviteLinkSession, updateRentBudget, handleSkipReasonModal } from "./utils/session-flow";
import { waitForJsonResponse } from "./utils/wait-response";
import { gotoPage } from "./utils/common";
import { findSessionLocator, searchSessionWithText } from "./utils/report-page";
import { ApiClient } from "./api";
import { loginWithAdmin } from "./endpoint-utils/auth-helper";
import { cleanupSession, cleanupUser } from "./utils/cleanup-helper";
import loginForm from "./utils/login-form";

test.describe('QA-272 reinvite-applicant-button-permissions.spec', () => {
    test.setTimeout(120_000)
    const APPLICATION_NAME = 'AutoTest - Applicants only';

    const testResults = {
        test1: { passed: false, sessionId: null, userId: null, memberId: null }
    }
    let adminClient;
    let organizationId = null;

    const testUserData = {
        first_name: 'Reinvite',
        last_name: 'Applicant',
        email: `qa.reinvite+member${Date.now()}@verifast.com`,
        password: 'password'
    }

    test.beforeAll(async () => {
        console.log('⚙️  [Setup] Setting up API client and admin login...');
        adminClient = new ApiClient(app.urls.api, null, 20000)
        await loginWithAdmin(adminClient)
        console.log('🔑 [Admin] Logged in as admin via API.');

        // Get Permissions Test Org
        const organizationName = 'Permissions Test Org';
        console.log(`🔍 [Setup] Fetching organization: ${organizationName}...`);
        const orgResponse = await adminClient.get('/organizations', {
            params: {
                filters: JSON.stringify({
                    name: organizationName
                })
            }
        });
        const orgs = orgResponse.data.data;
        const org = orgs.find(o => o.name === organizationName);
        if (!org) {
            throw new Error(`Organization "${organizationName}" not found`);
        }
        organizationId = org.id;
        console.log(`✅ [Setup] Using organization: ${organizationName} (id: ${organizationId})`);

        // Fetch existing role (don't create)
        const roleName = 'Autotest - Empty role';
        console.log(`🔍 [Setup] Fetching existing role: ${roleName}...`);
        const roleResponse = await adminClient.get('/roles', {
            params: {
                filters: JSON.stringify({
                    name: { $like: roleName }
                })
            }
        });

        const roles = roleResponse.data.data;
        const role = roles.find(item => item.name === roleName);
        if (!role) {
            throw new Error(`Role "${roleName}" not found`);
        }
        console.log(`🎭 [Setup] Using existing role: ${roleName} (id: ${role.id})`);

        // Create member in Permissions Test Org via POST /organizations/{id}/members
        console.log('🙋 [Setup] Creating member in Permissions Test Org...');
        const memberResp = await adminClient.post(`/organizations/${organizationId}/members`, {
            role: role.id,
            email: testUserData.email,
            first_name: testUserData.first_name,
            last_name: testUserData.last_name
        });
        const member = memberResp.data.data;
        const inviteToken = memberResp.headers['token'];
        testResults.test1.memberId = member.id;
        testResults.test1.userId = member.user?.id; // May be null until user completes registration
        console.log(`✅ [Setup] Member created: ${testUserData.email} (memberId: ${testResults.test1.memberId})`);
        
        if (!inviteToken) {
            throw new Error('Invite token missing from member creation response');
        }
        console.log(`📧 [Setup] Got invite token for user registration`);

        // Bind permissions to member (VIEW_SESSIONS + Invite Applicant permission)
        // VIEW_SESSIONS is required to see applicants-menu in the sidebar
        console.log('🔐 [Setup] Binding permissions to member...');
        await adminClient.patch(`/organizations/${organizationId}/members/${member.id}`, {
            permissions: [
                { name: 'view_sessions', bindings: [] },
                { name: 'invite_applicant_to_session', bindings: [] }
            ]
        });
        console.log('✅ [Setup] Permissions bound: view_sessions, invite_applicant_to_session');

        // Complete user registration using invite token
        console.log('👤 [Setup] Completing user registration with invite token...');
        const guestClient = new ApiClient(app.urls.api, null, 20000);
        const userResp = await guestClient.post('/users', {
            first_name: testUserData.first_name,
            last_name: testUserData.last_name,
            state: 'AK',
            terms: true,
            password: testUserData.password,
            password_confirmation: testUserData.password,
            token: inviteToken
        });
        if (userResp.status !== 201 && userResp.status !== 200) {
            throw new Error(`Unexpected status ${userResp.status} from /users registration`);
        }
        testResults.test1.userId = userResp.data.data.id;
        console.log(`✅ [Setup] User registration completed: userId=${testResults.test1.userId}`);
    })

    console.log(`TEST: Re-invite Button Functionality and Permissions (VC-1907 & VC-1891)`)
    test('Re-invite button UI interactions, state changes, copy link functionality, and permission-based visibility', {
        tag: ['@core', '@regression', '@rc-ready', '@staging-ready']
    }, async ({ page, browser }) => {
        // ----- Setup -----
        console.log('🚀 [Setup] Navigating to admin Applications page...');
        await adminLoginAndNavigateToApplications(page, admin);

        console.log('🔎 [Setup] Finding and selecting test application...');
        await findAndInviteApplication(page, APPLICATION_NAME);

        const user = {
            first_name: 'Invite',
            last_name: 'Primary',
            email: getRandomEmail(),
            password: 'password'
        }
        const coAppData = {
            first_name: 'Invite',
            last_name: 'Coapp',
            email: getRandomEmail(),
        };
        const guarantorData = {
            first_name: 'Invite',
            last_name: 'Guarantor',
            email: getRandomEmail(),
        };

        console.log('📝 [Setup] Creating session with primary applicant...');
        const { sessionId, sessionUrl, link } = await generateSessionForm.generateSessionAndExtractLink(page, user)
        testResults.test1.sessionId = sessionId;

        // Logout admin (UI)
        await page.getByTestId('user-dropdown-toggle-btn').click();
        await page.getByTestId('user-logout-dropdown-item').click();
        await expect(page.getByTestId('admin-login-btn')).toBeVisible({ timeout: 10_000 })
        console.log('👋 [Setup] Admin logged out from UI.');

        // Launch applicant flow
        console.log('🧑‍💻 [Setup] Running applicant-side onboarding...');
        console.log('Open applicant context and new page');
        const applicantContext = await browser.newContext();
        const applicantPage = await applicantContext.newPage();

        console.log('Open session invite link in applicant flow');
        await applicantPage.goto(link);

        console.log('Setup invite link session');
        await setupInviteLinkSession(applicantPage, {
            sessionUrl
        });

        console.log('Update rent budget for applicant');
        await updateRentBudget(applicantPage, sessionId, '500');

        // Skip pre-screening step if present (application may only have applicants step)
        try {
            const preScreening = applicantPage.getByTestId('pre-screening-step');
            await expect(preScreening).toBeVisible({ timeout: 5000 });
            console.log('Pre-screening step found, skipping...');
            const preScreeningSkip = preScreening.getByTestId('pre-screening-skip-btn');
            await expect(preScreeningSkip).toBeVisible();
            await preScreeningSkip.click();
            // Handle skip reason modal if it appears
            await handleSkipReasonModal(applicantPage, "Skipping pre-screening step for test purposes");
            await applicantPage.waitForTimeout(1000);
            console.log('✅ Pre-screening step skipped');
        } catch (e) {
            console.log('ℹ️ No pre-screening step found (application only has applicants step), continuing...');
        }

        console.log('Wait for applicant invite step to be visible');
        const applicantStep = applicantPage.getByTestId('applicant-invite-step');
        await expect(applicantStep).toBeVisible({ timeout: 10_000 });

        // Add co-applicant (invite: false)
        console.log('👥 [Setup] Adding co-applicant via household form...');
        const { data: coApp } = await fillhouseholdForm(applicantPage, coAppData)

        // Add guarantor (invite: false)
        const selectGuarantor = applicantPage.getByTestId('select-type-guarantor');
        await expect(selectGuarantor).toBeVisible();
        await selectGuarantor.click();

        console.log('🛡️ [Setup] Adding guarantor via household form...');
        const { data: guarantor } = await fillhouseholdForm(applicantPage, guarantorData)

        const applicantContinueBtn = applicantPage.getByTestId('applicant-invite-continue-btn').filter({
            visible: true
        });
        await expect(applicantContinueBtn).toBeVisible();
        await applicantContinueBtn.click()
        const summaryStep = applicantPage.getByTestId('summary-step');
        await expect(summaryStep).toBeVisible();

        // Done with applicant creation side steps
        await applicantPage.close();
        await page.bringToFront();

        // ------------------- Permission Test Step -------------------
        console.log('🔏 [VC-1891] [Permission Test] Login as test user with only "Invite Applicant" permission...');
        await loginForm.fill(page, testUserData);
        await loginForm.submitAndSetLocale(page, {
            waitForHousehold: false,
            waitForLocator: 'applicants-menu' // Test user has limited permissions, wait for applicants-menu instead of side-panel
        });

        console.log('🛰️  [VC-1891] Navigating to Applicants page...');
        await gotoPage(page, 'applicants-menu', 'applicants-submenu', '/sessions?fields[session]');
        await page.waitForTimeout(1000);

        // ✅ Use prepareSessionForFreshSelection to handle already-selected sessions
        console.log(`🔎 [VC-1891] Preparing session for fresh selection: ${sessionId}`);
        const { locator: sessionLocator } = await prepareSessionForFreshSelection(page, sessionId);

        const [sessionResponse] = await Promise.all([
            page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}?fields[session]`)
                && resp.ok()
                && resp.request().method() === 'GET'),
            sessionLocator.click()
        ]);

        let { data: session } = await waitForJsonResponse(sessionResponse);

        // Extracting child applicant/guarantor sessions for test
        const coAppSession = session.children.find(session => session.role === 'APPLICANT')
        const guarantorSession = session.children.find(session => session.role === 'GUARANTOR')
        console.log('🔑 [VC-1891] Found co-app and guarantor session IDs:',
            {
                coAppSessionId: coAppSession.id,
                coAppApplicantId: coAppSession.applicant.id,
                guarantorSessionId: guarantorSession.id,
                guarantorApplicantId: guarantorSession.applicant.id
            }
        );

        // Open action menu and modal
        console.log('🎬 [VC-1891] Opening session action dropdown...');
        const actionBtn = page.getByTestId('session-action-btn');
        await expect(actionBtn).toBeVisible();
        await actionBtn.click();

        const inviteApplicantOption = page.getByTestId('invite-applicant')
        await expect(inviteApplicantOption).toBeVisible()
        await inviteApplicantOption.click();

        const inviteModal = page.getByTestId('invite-modal');
        await expect(inviteModal).toBeVisible();
        console.log('📥 [VC-1891] Invite Applicant modal opened for permission test.');

        // Permission-related verification for modal in testUser
        const coAppItem = page.getByTestId(`invited-applicant-${coAppSession.id}`);
        const guarantorItem = page.getByTestId(`invited-applicant-${guarantorSession.id}`);

        console.log('🕵️ [VC-1891] Verifying re-invite button is visible for CO-APPLICANT (permission) ...');
        const coAppReinviteBtn = coAppItem.getByTestId(`reinvite-${coAppSession.applicant.id}`);
        await expect(coAppReinviteBtn).toBeVisible();

        console.log('🕵️ [VC-1891] Verifying re-invite button is visible for GUARANTOR (permission) ...');
        const guarantorReinviteBtn = guarantorItem.getByTestId(`reinvite-${guarantorSession.applicant.id}`);
        await expect(guarantorReinviteBtn).toBeVisible();

        // Verify test user can actually click and use re-invite button (not just see it)
        console.log('🔁 [VC-1891] Testing re-invite button click functionality for CO-APPLICANT...');
        const [testUserPatchResponse] = await Promise.all([
            page.waitForResponse(async resp => {
                if (
                    resp.url().includes(`/applicants/${coAppSession.applicant.id}`) &&
                    resp.request().method() === 'PATCH'
                ) {
                    const requestPostData = JSON.parse(resp.request().postData() || '{}');
                    return requestPostData.invite === 1;
                }
                return false;
            }),
            coAppReinviteBtn.click()
        ]);

        // Validate PATCH sent and OK
        const testUserRequestPostData = JSON.parse(testUserPatchResponse.request().postData() || '{}');
        await expect(testUserRequestPostData).toHaveProperty('invite', 1);
        await expect(testUserPatchResponse.ok()).toBe(true);
        console.log('✅ [VC-1891] Test user successfully clicked re-invite button and PATCH request succeeded.');

        // Wait for UI update
        await page.waitForTimeout(500);

        // Verify state changes after reinvite
        await expect(coAppItem.getByTestId(`reinvite-${coAppSession.applicant.id}`)).not.toBeVisible();
        await expect(coAppItem.getByTestId(`invited-applicant-reinvite`)).toBeVisible();
        await expect(coAppItem.getByTestId(`invited-applicant-reinvite`)).toContainText('Invited');
        console.log('✅ [VC-1891] UI state updated correctly after test user reinvite.');

        // Close modal - try Escape first, then check if still open and use cancel button
        console.log('🚪 [VC-1891] Closing invite modal...');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1200);
        
        // Check if modal is still visible
        const inviteModalAfterEscape = page.getByTestId('invite-modal');
        const isModalStillVisible = await inviteModalAfterEscape.isVisible().catch(() => false);
        
        if (isModalStillVisible) {
            console.log('⚠️ [VC-1891] Modal still open after Escape, clicking cancel button...');
            // Try to find and click cancel button
            const cancelBtn = page.getByTestId('invite-modal-cancel');
            if (await cancelBtn.isVisible().catch(() => false)) {
                await cancelBtn.click();
                await page.waitForTimeout(500);
            } else {
                // Fallback: try to find any close button in the modal
                const closeBtn = inviteModalAfterEscape.locator('[data-testid*="cancel"], [data-testid*="close"], button[aria-label*="close" i]').first();
                if (await closeBtn.isVisible().catch(() => false)) {
                    await closeBtn.click();
                    await page.waitForTimeout(500);
                }
            }
        }
        
        // Wait for modal to be hidden before proceeding
        try {
            await inviteModalAfterEscape.waitFor({ state: 'hidden', timeout: 5000 });
            console.log('✅ [VC-1891] Invite modal closed');
        } catch (error) {
            console.log('⚠️ [VC-1891] Modal might have closed quickly or still closing');
        }
        await page.waitForTimeout(500); // Additional wait for modal to fully close

        // Logout as testUser
        if (await page.getByTestId('user-dropdown-toggle-btn').isVisible()) {
            await page.getByTestId('user-dropdown-toggle-btn').click();
            await page.getByTestId('user-logout-dropdown-item').click();
            await expect(page.getByTestId('admin-login-btn')).toBeVisible({ timeout: 10_000 })
            console.log('🚪 [VC-1891] Test user logged out.');
        }

        // Login as admin
        console.log('🔐 [VC-1891] Logging in as admin...');
        await loginForm.fill(page, admin);
        await loginForm.submitAndSetLocale(page, {
            waitForHousehold: false
        });

        await gotoPage(page, 'applicants-menu', 'applicants-submenu', '/sessions?fields[session]');
        await page.waitForTimeout(1000);

        // ✅ Use prepareSessionForFreshSelection to handle already-selected sessions
        console.log(`🔎 [VC-1891] Preparing session for fresh selection (admin): ${sessionId}`);
        const { locator: adminSessionLocator } = await prepareSessionForFreshSelection(page, sessionId);

        const [adminSessionResponse] = await Promise.all([
            page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}?fields[session]`)
                && resp.ok()
                && resp.request().method() === 'GET'),
            adminSessionLocator.click()
        ]);
        let { data: adminSession } = await waitForJsonResponse(adminSessionResponse);

        const adminCoAppSession = adminSession.children.find(session => session.role === 'APPLICANT')
        const adminGuarantorSession = adminSession.children.find(session => session.role === 'GUARANTOR')

        // Open modal as admin
        console.log('🎬 [VC-1891] Opening Invite Applicant modal as admin...');
        const adminActionBtn = page.getByTestId('session-action-btn');
        await expect(adminActionBtn).toBeVisible();
        await adminActionBtn.click();
        const adminInviteApplicantOption = page.getByTestId('invite-applicant');
        await expect(adminInviteApplicantOption).toBeVisible();
        await adminInviteApplicantOption.click();

        const adminInviteModal = page.getByTestId('invite-modal');
        await expect(adminInviteModal).toBeVisible();

        // Confirm re-invite buttons are visible for both
        await expect(page.getByTestId(`invited-applicant-${adminCoAppSession.id}`).getByTestId(`reinvite-${adminCoAppSession.applicant.id}`)).toBeVisible();
        await expect(page.getByTestId(`invited-applicant-${adminGuarantorSession.id}`).getByTestId(`reinvite-${adminGuarantorSession.applicant.id}`)).toBeVisible();

        // -------------- Step 2: Open Invite Modal Verification -----------------
        console.log('📥 [Modal] Checking modal UI and invited applicant list...');
        // Confirm modal title contains Applicant Invite text
        // The modal has h3 with "Applicant Invite" as the main title
        await expect(adminInviteModal.locator('h3')).toContainText(/invite/i);

        // Confirm applicants list visible
        // Use the container first, then check for at least one applicant item
        // The selector matches both parent divs and child elements, so we check the container
        const invitedApplicantsContainer = adminInviteModal.getByTestId('invited-applicants');
        await expect(invitedApplicantsContainer).toBeVisible();
        // Check that at least one applicant item exists (parent div with full session ID)
        await expect(invitedApplicantsContainer.locator('div[data-testid^="invited-applicant-"]').first()).toBeVisible();

        // ------------ Step 3: CO-APPLICANT Initial State -------------
        console.log('👀 [Co-Applicant] Verifying initial state in invited list...');
        const coAppAdminItem = page.getByTestId(`invited-applicant-${adminCoAppSession.id}`);

        await expect(coAppAdminItem.getByTestId('invited-applicant-fullname')).toContainText(coApp.guest.full_name)
        await expect(coAppAdminItem.getByTestId('invited-applicant-email')).toContainText(coApp.guest.email)
        await expect(coAppAdminItem.getByTestId('invited-applicant-role')).toContainText(`(Co-App)`)
        await expect(coAppAdminItem.getByTestId(`reinvite-${adminCoAppSession.applicant.id}`)).toBeVisible();
        await expect(coAppAdminItem.getByTestId(`reinvite-${adminCoAppSession.applicant.id}`)).toContainText(`Reinvite`);
        // Optionally: check icon (if relevant icon test id or content)
        // Ensure checkmark not visible, copy link not visible
        await expect(coAppAdminItem.getByTestId(`invited-applicant-reinvite`)).not.toBeVisible();
        await expect(coAppAdminItem.getByTestId(`copy-invite-link-${adminCoAppSession.applicant.id}`)).not.toBeVisible();

        // --------- Step 4: REINVITE CO-APP -------------
        console.log('🔁 [Co-Applicant] Clicking Re-invite button and intercepting PATCH request...');
        const coAppReinvite = coAppAdminItem.getByTestId(`reinvite-${adminCoAppSession.applicant.id}`);

        const [patchResponse] = await Promise.all([
            page.waitForResponse(async resp => {
                if (
                    resp.url().includes(`/applicants/${adminCoAppSession.applicant.id}`) &&
                    resp.request().method() === 'PATCH'
                ) {
                    const requestPostData = JSON.parse(resp.request().postData() || '{}');
                    return requestPostData.invite === 1;
                }
                return false;
            }),
            coAppReinvite.click()
        ]);

        // Validate PATCH sent and OK
        const requestPostData = JSON.parse(patchResponse.request().postData() || '{}');
        await expect(requestPostData).toHaveProperty('invite', 1);
        await expect(patchResponse.ok()).toBe(true);
        console.log('✅ [Co-Applicant] PATCH /applicants reinvite sent and successful.');

        // Wait for UI update 
        await page.waitForTimeout(500);

        // State changes
        await expect(coAppAdminItem.getByTestId(`reinvite-${adminCoAppSession.applicant.id}`)).not.toBeVisible();
        await expect(coAppAdminItem.getByTestId(`invited-applicant-reinvite`)).toBeVisible();
        await expect(coAppAdminItem.getByTestId(`invited-applicant-reinvite`)).toContainText('Invited');
        await expect(coAppAdminItem.getByTestId(`invited-applicant-reinvite`)).toContainClass('text-success');
        await expect(coAppAdminItem.getByTestId(`copy-invite-link-${adminCoAppSession.applicant.id}`)).toBeVisible();

        // ------------- Step 5: Copy Link - Co-Applicant --------------
        console.log('🔗 [Co-Applicant] Copying invite link...');
        const copyLinkBtn = coAppAdminItem.getByTestId(`copy-invite-link-${adminCoAppSession.applicant.id}`)
        await expect(copyLinkBtn).toBeVisible()

        await copyLinkBtn.click();
        await page.waitForTimeout(1000);
        const coAppLink = await page.evaluate('navigator.clipboard.readText()');
        console.log('📋 [Co-Applicant] Copied link:', coAppLink);

        await expect(coAppLink).toBeDefined();
        await expect(coAppLink.startsWith(app.urls.app)).toBe(true);
        await expect(coAppLink.includes(`/sessions/${adminCoAppSession.id}`)).toBe(true);
        const coAppURLObj = new URL(coAppLink);
        await expect(coAppURLObj.searchParams.has('token')).toBe(true);

        // ---------- Step 6: GUARANTOR Initial State ---------------
        const guarantorAdminItem = page.getByTestId(`invited-applicant-${adminGuarantorSession.id}`);
        console.log('👀 [Guarantor] Verifying initial state in invited list...');
        await expect(guarantorAdminItem.getByTestId('invited-applicant-fullname')).toContainText(guarantor.guest.full_name)
        await expect(guarantorAdminItem.getByTestId('invited-applicant-email')).toContainText(guarantor.guest.email)
        await expect(guarantorAdminItem.getByTestId('invited-applicant-role')).toContainText(`(Guarantor)`)
        await expect(guarantorAdminItem.getByTestId(`reinvite-${adminGuarantorSession.applicant.id}`)).toBeVisible();
        await expect(guarantorAdminItem.getByTestId(`reinvite-${adminGuarantorSession.applicant.id}`)).toContainText(`Reinvite`);
        await expect(guarantorAdminItem.getByTestId(`invited-applicant-reinvite`)).not.toBeVisible();
        await expect(guarantorAdminItem.getByTestId(`copy-invite-link-${adminGuarantorSession.applicant.id}`)).not.toBeVisible();

        // ---------- Step 7: REINVITE GUARANTOR ----------
        console.log('🔁 [Guarantor] Clicking Re-invite button and intercepting PATCH request...');
        const guarantorReinvite = guarantorAdminItem.getByTestId(`reinvite-${adminGuarantorSession.applicant.id}`);

        const [guarantorPatchResponse] = await Promise.all([
            page.waitForResponse(async resp => {
                if (
                    resp.url().includes(`/applicants/${adminGuarantorSession.applicant.id}`) &&
                    resp.request().method() === 'PATCH'
                ) {
                    const requestPostData = JSON.parse(resp.request().postData() || '{}');
                    return requestPostData.invite === 1;
                }
                return false;
            }),
            guarantorReinvite.click()
        ]);
        const guarantorRequestPostData = JSON.parse(guarantorPatchResponse.request().postData() || '{}');
        await expect(guarantorRequestPostData).toHaveProperty('invite', 1);
        await expect(guarantorPatchResponse.ok()).toBe(true);
        console.log('✅ [Guarantor] PATCH /applicants reinvite sent and successful.');

        // Wait for UI update
        await page.waitForTimeout(500);

        await expect(guarantorAdminItem.getByTestId(`reinvite-${adminGuarantorSession.applicant.id}`)).not.toBeVisible();
        await expect(guarantorAdminItem.getByTestId(`invited-applicant-reinvite`)).toBeVisible();
        await expect(guarantorAdminItem.getByTestId(`invited-applicant-reinvite`)).toContainText('Invited');
        await expect(guarantorAdminItem.getByTestId(`invited-applicant-reinvite`)).toContainClass('text-success');
        await expect(guarantorAdminItem.getByTestId(`copy-invite-link-${adminGuarantorSession.applicant.id}`)).toBeVisible();

        // ----------- Step 8: Copy Link - Guarantor -------------
        console.log('🔗 [Guarantor] Copying invite link...');
        const guarantorCopyLinkBtn = guarantorAdminItem.getByTestId(`copy-invite-link-${adminGuarantorSession.applicant.id}`);
        await expect(guarantorCopyLinkBtn).toBeVisible();

        await guarantorCopyLinkBtn.click();
        await page.waitForTimeout(1000);
        const guarantorLink = await page.evaluate('navigator.clipboard.readText()');
        console.log('📋 [Guarantor] Copied link:', guarantorLink);

        await expect(guarantorLink).toBeDefined();
        await expect(guarantorLink.startsWith(app.urls.app)).toBe(true);
        await expect(guarantorLink.includes(`/sessions/${adminGuarantorSession.id}`)).toBe(true);
        const guarantorURLObj = new URL(guarantorLink);
        await expect(guarantorURLObj.searchParams.has('token')).toBe(true);

        // Ensure links copied are different
        await expect(coAppLink).not.toBe(guarantorLink);

        testResults.test1.passed = true;
        console.log('🥳 [Test] All primary and permission-based assertions passed.');
    })

    test.afterAll(async ({ request }) => {
        console.log('🧹 [Cleanup] Begin test suite resource cleanup...');
        const results = Object.entries(testResults);
        for (let index = 0; index < results.length; index++) {
            const [key, element] = results[index];
            if (element.passed && element.sessionId) {
                try {
                    console.log(`🧻 [Cleanup] Deleting session for test '${key}' (sessionId: ${element.sessionId})...`);
                    await cleanupSession(request, element.sessionId);
                    
                    // Delete member first (removes organization relationship)
                    if (element.memberId && organizationId) {
                        try {
                            await adminClient.delete(`/organizations/${organizationId}/members/${element.memberId}`);
                            console.log(`🗑️  [Cleanup] Deleted test member id: ${element.memberId}`);
                        } catch (error) {
                            console.error(`⚠️  [Cleanup] Failed to delete member ${element.memberId}: ${error.message}`);
                        }
                    }
                    
                    // Delete user
                    if (element.userId) {
                        try {
                            await adminClient.delete(`/users/${element.userId}`);
                            console.log(`🗑️  [Cleanup] Deleted test user id: ${element.userId}`);
                        } catch (error) {
                            console.error(`⚠️  [Cleanup] Failed to delete user ${element.userId}: ${error.message}`);
                        }
                    }
                    console.log(`✅ [Cleanup] Session, member & user cleaned for test '${key}'.`);
                } catch (error) {
                    console.error(`❌ [Cleanup] Failed cleanup for test '${key}' (sessionId: ${element.sessionId}): ${error}`);
                }
            }
        }
        console.log('🏁 [Cleanup] Test suite cleanup complete.');
    });

})

async function validateCopiedUrl(page, session) {
    const clipboardContent = await page.evaluate('navigator.clipboard.readText()');

    //Verify copied link is not empty
    await expect(clipboardContent).toBeDefined()

    // Verify copied link contains session URL format (contains /s/ or /sessions/)
    await expect(clipboardContent.startsWith(app.urls.app)).toBe(true);
    await expect(clipboardContent.includes(`/sessions/${session.id}`)).toBe(true);

    // Verify copied link contains valid token/session ID
    const urlObject = new URL(clipboardContent);
    await expect(urlObject.searchParams.has('token')).toBe(true);

}
