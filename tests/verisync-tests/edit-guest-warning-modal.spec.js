import { expect, test } from '@playwright/test';
import { ApiClient } from '../api';
import { admin, app } from '../test_config';
import RoleApi from '../api/role-api';
import { loginWithAdmin } from '../endpoint-utils/auth-helper';
import { loginWith } from '../utils/session-utils';
import { findAndInviteApplication } from '../utils/applications-page';
import generateSessionForm from '../utils/generate-session-form';
import { openReportSection } from '../utils/report-page';
import BaseApi from '../api/base-api';
import loginForm from '../utils/login-form';
import { joinUrl } from '../utils/helper';
import { waitForJsonResponse } from '../utils/wait-response';


const adminClient = new ApiClient(app.urls.api, null, 120_000);
const guestClient = new ApiClient(app.urls.api, null, 120_000);
const roleApi = new RoleApi(adminClient);
const organizationApi = new BaseApi(adminClient, '/organizations');
const applicationApi = new BaseApi(adminClient, '/applications');
const workflowApi = new BaseApi(adminClient, '/workflows');
const incomeSourceTemplateApi = new BaseApi(adminClient, '/income-source-templates');
const flagCollectionApi = new BaseApi(adminClient, '/flag-collections');

test.describe('QA-322 edit-guest-warning-modal.spec', () => {

    const ROLE = 'Autotest - Internal Role'
    const FIRST_APPLICATION_NAME = 'Autotest - Simulator Financial Step' // With verisync enabled (pms_integration_id set)
    const SECOND_APPLICATION_NAME = 'Autotest - Heartbeat Test - Financial' // Without verisync enabled (pms_integration_id null)
    const WORKFLOW_NAME = 'Autotest Full Id Fin Employ Simulation'
    const ORGANIZATION_NAME = 'Verifast'

    const internalUser = {
        first_name: 'Autot - Internal',
        last_name: 'User',
        email: `autotest+edit-guest-${Date.now()}@verifast.com`,
        password: "password"
    };


    let role = null;
    let member = null;
    let organization = null;

    let createdMember = null;
    let createdUser = null;

    const testResults = {
        test1: { sessionId: null, passed: false },
        test2: { sessionId: null, passed: false },
    }

    test.beforeAll(async () => {
        // Login with admin account
        await loginWithAdmin(adminClient);

        // check role exists
        role = await roleApi.getByName(ROLE);

        if (!role) {
            // create role
            const roleData = await roleApi.create({
                name: ROLE,
                description: 'Role for edit guest warning modal test',
                scope: "internal",
                level: 2
            });

            role = roleData.data;
        }

        // Create internal user with the role
        // Get organization
        organization = await organizationApi.getByName(ORGANIZATION_NAME);
        if (!organization) {
            throw new Error(`Organization ${ORGANIZATION_NAME} not found`);
        }

        // Create member - handle 409 if it occurs
        let memberResponse;
        try {
            memberResponse = await adminClient.post(`/organizations/${organization.id}/members`, {
                role: role.id,
                ssn_enabled: false,
                ...internalUser
            });
        } catch (createErr) {
            // Fix 1: Handle 409 by fetching existing member and deleting it, then retry
            if (createErr.response?.status === 409) {
                console.log(`[SETUP] Member creation failed with 409, fetching existing member to delete`);
                try {
                    const membersResponse = await adminClient.get(`/organizations/${organization.id}/members`, {
                        params: {
                            filters: JSON.stringify({
                                $has: {
                                    user: {
                                        email: { $eq: internalUser.email }
                                    }
                                }
                            }),
                            limit: 10
                        }
                    });
                    if (membersResponse.data?.data && membersResponse.data.data.length > 0) {
                        const existingMember = membersResponse.data.data[0];
                        await adminClient.delete(`/organizations/${organization.id}/members/${existingMember.id}`);
                        if (existingMember.user?.id) {
                            await adminClient.delete(`/users/${existingMember.user.id}`);
                        }
                        console.log(`[SETUP] Deleted existing member, retrying creation`);
                        // Retry creation
                        memberResponse = await adminClient.post(`/organizations/${organization.id}/members`, {
                            role: role.id,
                            ssn_enabled: false,
                            ...internalUser
                        });
                    } else {
                        throw new Error('409 error but could not find existing member');
                    }
                } catch (retryErr) {
                    console.error('[SETUP] Failed to handle 409 error:', retryErr.message);
                    throw createErr; // Re-throw original error
                }
            } else {
                throw createErr;
            }
        }

        console.log(memberResponse.data.data)

        member = memberResponse.data.data;
        createdMember = member.id;
        createdUser = member.user.id;

        const inviteToken = memberResponse.headers['token'];
        console.log("🚀 ~ memberResponse.headers:", memberResponse.headers)
        console.log(`[SETUP] Created user id: ${createdUser}, member id: ${createdMember}`);
        if (!inviteToken) throw new Error("Invite token missing");
        console.log(`[SETUP] Member created (id=${createdMember}), got invite token`);

        try {
            const patchPermsResp = await adminClient.patch(`/organizations/${organization.id}/members/${member.id}`, {
                permissions: [
                    { name: 'view_sessions', bindings: [] },
                    { name: 'manage_applications', bindings: [] },
                    { name: 'manage_guests', bindings: [] }
                ]
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

        // Find or create applications (don't modify if they exist)
        const firstApp = await applicationApi.getByName(FIRST_APPLICATION_NAME);
        if (!firstApp) {
            console.log(`[SETUP] Application "${FIRST_APPLICATION_NAME}" not found, creating...`);
            const workflow = await workflowApi.getByName(WORKFLOW_NAME.split(' ').join('-').toLowerCase());
            if (!workflow) {
                throw new Error(`Workflow ${WORKFLOW_NAME} not found`);
            }
            await getOrCreateApplication(applicationApi, {
                name: FIRST_APPLICATION_NAME,
                workflowId: workflow.id,
                organizationId: organization.id,
                pms_integration_id: '123456', // VeriSync enabled
            });
        } else {
            console.log(`[SETUP] Application "${FIRST_APPLICATION_NAME}" already exists, using existing`);
        }

        const secondApp = await applicationApi.getByName(SECOND_APPLICATION_NAME);
        if (!secondApp) {
            console.log(`[SETUP] Application "${SECOND_APPLICATION_NAME}" not found, creating...`);
            const workflow = await workflowApi.getByName(WORKFLOW_NAME.split(' ').join('-').toLowerCase());
            if (!workflow) {
                throw new Error(`Workflow ${WORKFLOW_NAME} not found`);
            }
            await getOrCreateApplication(applicationApi, {
                name: SECOND_APPLICATION_NAME,
                workflowId: workflow.id,
                organizationId: organization.id,
                pms_integration_id: null, // VeriSync disabled
            });
        } else {
            console.log(`[SETUP] Application "${SECOND_APPLICATION_NAME}" already exists, using existing`);
        }
    });


    test('VeriSync enabled → warning modal appears; Cancel prevents update; then Confirm updates (Session S1)', {
        tag: ['@regression', '@staging-ready','@rc-ready']
    }, async ({ page }) => {
        // Test implementation goes here

        const timestamp = Date.now();
        const guestUser = {
            first_name: "Autot - Permtest",
            last_name: `Guest${timestamp}`,
            email: `verisync-warning-test-${timestamp}+autotest@verifast.com`,
            password: `password`
        };
        await page.goto('/');
        await loginWith(page, admin);
        await page.goto('/application/all');
        await findAndInviteApplication(page, FIRST_APPLICATION_NAME);

        let sessionId;
        try {
            const sessionObj = await generateSessionForm.generateSessionAndExtractLink(page, guestUser);
            sessionId = sessionObj.sessionId;
            testResults.test1.sessionId = sessionId;
            if (!sessionId) throw new Error('No sessionId generated');
            console.log(`[S1][STEP 0] Created guest sessionId: ${sessionId}`);
        } catch (e) {
            console.error('[S1][API ERROR] Could not generate guest session:', e.message);
            throw e;
        }

        // logout from admin
        try {
            await page.getByTestId('user-dropdown-toggle-btn').click();
            await page.waitForTimeout(500);
            const logoutPromise = page.waitForResponse(resp => resp.url().includes('/auth') && resp.request().method() === 'DELETE' && resp.ok(), { timeout: 10000 });
            await page.getByTestId('user-logout-dropdown-item').click();
            await logoutPromise;
        } catch (e) {
            console.error('[S1][UI ERROR] During admin logout:', e.message);
            throw e;
        }

        await page.waitForTimeout(1000);
        await loginForm.fill(page, internalUser)
        await page.locator('button[type="submit"]').click();
        await page.waitForResponse(joinUrl(app.urls.api, '/auth'))

        await page.waitForTimeout(3000);

        await page.goto(`/applicants/all/${sessionId}`);
        console.log(`[S1][STEP 1] Navigated to session report for session ${sessionId}`);

        const sessionPromise = await page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}`) && resp.request().method() === 'GET' && resp.ok(),{ timeout: 10000 });
        const sessionResponse = await sessionPromise
        const { data: session } = await waitForJsonResponse(sessionResponse);

        const identitySection = await openReportSection(page, 'identity-section')

        const editButton = identitySection.getByTestId('identity-edit-guest-btn');
        await expect(editButton).toBeVisible();

        console.log('[S1][STEP 2] Opening Edit Guest modal');
        await editButton.click();
        const editForm = page.getByTestId('guest-update-form');
        await expect(editForm).toBeVisible();
        const firstNameInput = editForm.getByTestId('guest-first-name-field');
        await expect(firstNameInput).toBeVisible();

        console.log('[S1][STEP 3] Updating first name (will trigger warning modal)');
        await firstNameInput.fill(guestUser.first_name + ' Edited');

        console.log('[S1][STEP 4] Submitting update to trigger warning modal');
        await editForm.getByTestId('submit-guest-update-form').click();

        console.log('[S1][STEP 5] Verifying warning modal appears with expected content and buttons');
        const warningModal = page.getByTestId('edit-guest-warning-modal');
        await expect(warningModal).toBeVisible();
        await expect(warningModal.getByTestId('edit-guest-warning-modal-header')).toContainText('Warning!');
        await expect(warningModal.getByTestId('edit-guest-warning-modal-title')).toContainText('Updating this applicant\'s information may break the link between Verifast and your PMS system for this household. This means the PDF report will not be sent automatically to your organization’s property management system (PMS). You will have to manually upload the PDF report for this household to your PMS.');
        await expect(warningModal.getByTestId('edit-guest-warning-modal-title')).toContainText('Are you sure you want to proceed?');
        const confirmButton = warningModal.getByTestId('confirm-btn');
        const cancelButton = warningModal.getByTestId('cancel-btn');
        await expect(confirmButton).toBeVisible();
        await expect(cancelButton).toBeVisible();
        console.log('[S1][STEP 5] Warning modal verified (Acknowledge & Confirm and Don\'t Edit buttons present)');

        /** 
         * verify on cancel click patch request not called
         */
        console.log('[S1][STEP 6] Clicking "Don\'t Edit" and asserting no PATCH /guests/{guestId} request is sent');
        await cancelButton.click();
        await expect(page.waitForRequest(req => req.url().includes(`/guests/${session.applicant.guest.id}`) && req.method() === 'PATCH', {
            timeout: 500
        })).rejects.toThrow();
        console.log('[S1][STEP 6] Confirmed no PATCH request was sent after cancelling');

        // Verify no update is persisted
        await page.reload();
        await openReportSection(page, 'identity-section')
        await expect(editButton).toBeVisible();
        await editButton.click();
        await expect(editForm).toBeVisible();
        await expect(firstNameInput).toHaveValue(guestUser.first_name);
        console.log('[S1][STEP 7] Verified guest first name unchanged after cancelling update');

        // Second attempt: confirm update
        await firstNameInput.fill(guestUser.first_name + ' Edited');
        await editForm.getByTestId('submit-guest-update-form').click()
        console.log('[S1][STEP 8] Submitted update again to trigger warning modal');
        const warningModal2 = page.getByTestId('edit-guest-warning-modal');
        await expect(warningModal2).toBeVisible();
        const confirmButton2 = warningModal2.getByTestId('confirm-btn');
        await expect(confirmButton2).toBeVisible();

        console.log('[S1][STEP 9] Clicking "Acknowledge & Confirm" to proceed with update');
        // Set up response listener BEFORE clicking to avoid race condition
        const patchResponse2Promise = page.waitForResponse(resp => resp.url().includes(`/guests/${session.applicant.guest.id}`) && resp.request().method() === 'PATCH' && resp.ok(), { timeout: 10000 });
        await confirmButton2.click();
        const patchResponse2 = await patchResponse2Promise;

        console.log(`[S1][STEP 10] Received PATCH response for guest ${session.applicant.guest.id} with status ${patchResponse2.status()}`);
        await expect(patchResponse2.status()).toBe(200);

        const patchRequest2Body = JSON.parse(patchResponse2.request().postData() || '{}');
        await expect(patchRequest2Body.first_name).toBe(`${guestUser.first_name} Edited`);
        console.log(`[S1][STEP 11] Verified PATCH payload includes updated first_name: ${patchRequest2Body.first_name}`);

        // Wait for edit guest modal to close after update completes
        console.log('[S1][STEP 11.5] Waiting for edit guest modal to close...');
        await expect(editForm).not.toBeVisible({ timeout: 10000 });
        console.log('[S1][STEP 11.5] Edit guest modal closed successfully');

        // Verify updated guest details are reflected in Identity section
        await page.reload();
        const identitySection2 = await openReportSection(page, 'identity-section')
        
        // Poll for updated guest name (max 6 seconds, every 500ms) to handle cache/race conditions
        console.log('[S1][STEP 12] Polling for updated guest name in Identity section...');
        const expectedName = `${guestUser.first_name} Edited`;
        const maxPollAttempts = 12; // 6 seconds / 500ms = 12 attempts
        const pollInterval = 500;
        let pollAttempt = 0;
        let nameUpdated = false;
        
        while (pollAttempt < maxPollAttempts && !nameUpdated) {
            pollAttempt++;
            try {
                const nameElement = identitySection2.getByTestId('identity-guest-full-name');
                const currentText = await nameElement.textContent();
                
                if (currentText && currentText.includes(expectedName)) {
                    nameUpdated = true;
                    console.log(`✅ [S1][STEP 12] Guest name updated successfully (attempt ${pollAttempt}/${maxPollAttempts}): "${currentText}"`);
                } else {
                    console.log(`   ⏳ [S1][STEP 12] Attempt ${pollAttempt}/${maxPollAttempts}: Current name="${currentText}", expected="${expectedName}", waiting ${pollInterval}ms...`);
                    await page.waitForTimeout(pollInterval);
                }
            } catch (error) {
                console.log(`   ⚠️ [S1][STEP 12] Attempt ${pollAttempt}/${maxPollAttempts}: Error checking name: ${error.message}, waiting ${pollInterval}ms...`);
                await page.waitForTimeout(pollInterval);
            }
        }
        
        if (!nameUpdated) {
            const finalName = await identitySection2.getByTestId('identity-guest-full-name').textContent();
            throw new Error(`❌ [S1][STEP 12] Guest name did not update after ${maxPollAttempts} attempts (${maxPollAttempts * pollInterval / 1000}s). Expected: "${expectedName}", Got: "${finalName}"`);
        }
        
        // Final assertion for clarity
        await expect(identitySection2.getByTestId('identity-guest-full-name')).toContainText(expectedName);
        console.log('[S1][STEP 12] Verified updated guest name is reflected in Identity section');
        testResults.test1.passed = true;
    });

    test('VeriSync disabled → no warning modal; update proceeds directly (Session S2)', {
        tag: ['@regression', '@staging-ready','@rc-ready']
    }, async ({ page }) => {
        // Test implementation goes here

        /**
         * Update at least one field:
         * Example: fill data-testid="guest-first-name-field" with a new value.
         * Intercept:
         *      PATCH /guests/{guestId} (spy only; do not mock responses)
         * Click Update (submit).
         * Verification:
         *      Verify Warning modal does not appear.
         * API Verification:
         *      Assert PATCH /guests/{guestId} is sent immediately and returns 200.
         * UI Verification:
         *      Updated guest details are reflected in Identity section.
         */

        const timestamp = Date.now();
        const guestUser = {
            first_name: "Autot - Permtest",
            last_name: `Guest${timestamp}`,
            email: `verisync-warning-test-${timestamp}+autotest@verifast.com`,
            password: `password`
        };
        console.log(`[S2] Navigating to create session and then to session report for S2`);
        await page.goto('/');
        await loginWith(page, admin);
        await page.goto('/application/all');
        await findAndInviteApplication(page, SECOND_APPLICATION_NAME);

        let sessionId;
        try {
            const sessionObj = await generateSessionForm.generateSessionAndExtractLink(page, guestUser);
            sessionId = sessionObj.sessionId;
            testResults.test2.sessionId = sessionId;
            if (!sessionId) throw new Error('No sessionId generated');
            console.log(`[S2][STEP 0] Created guest sessionId: ${sessionId}`);
        } catch (e) {
            console.error('[S2][API ERROR] Could not generate guest session:', e.message);
            throw e;
        }

        // logout from admin
        try {
            await page.getByTestId('user-dropdown-toggle-btn').click();
            await page.waitForTimeout(500);
            const logoutPromise = page.waitForResponse(resp => resp.url().includes('/auth') && resp.request().method() === 'DELETE' && resp.ok(), { timeout: 10000 });
            await page.getByTestId('user-logout-dropdown-item').click();
            await logoutPromise;
        } catch (e) {
            console.error('[S2][UI ERROR] During admin logout:', e.message);
            throw e;
        }

        await page.waitForTimeout(1000);
        await loginForm.fill(page, internalUser)
        await page.locator('button[type="submit"]').click();
        await page.waitForResponse(joinUrl(app.urls.api, '/auth'))

        await page.waitForTimeout(3000);

        console.log(`[S2][STEP 1] Navigating to session report page for ${sessionId}`);
        await page.goto(`/applicants/all/${sessionId}`);

        const sessionPromise = await page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}?fields`) && resp.request().method() === 'GET' && resp.ok(), { timeout: 10000 });
        const sessionResponse = await sessionPromise
        const { data: session } = await waitForJsonResponse(sessionResponse);

        const identitySection = await openReportSection(page, 'identity-section')

        const editButton = identitySection.getByTestId('identity-edit-guest-btn');
        await expect(editButton).toBeVisible();

        console.log('[S2][STEP 2] Opening Edit Guest modal');
        await editButton.click();
        const editForm = page.getByTestId('guest-update-form');
        await expect(editForm).toBeVisible();
        const firstNameInput = editForm.getByTestId('guest-first-name-field');
        await expect(firstNameInput).toBeVisible();


        console.log('[S2][STEP 3] Updating guest first name (VeriSync disabled)');
        await firstNameInput.fill(guestUser.first_name + ' Edited');

        // Intercept (spy) PATCH before submitting to avoid races
        const patchResponsePromise = page.waitForResponse(
            resp => resp.url().includes(`/guests/${session.applicant.guest.id}`) && resp.request().method() === 'PATCH',
            { timeout: 10000 }
        );

        await editForm.getByTestId('submit-guest-update-form').click();
        console.log(`[S2][STEP 4] Submitting update for guest ${session.applicant.guest.id} and checking for absence of warning modal`);

        const warningModal = page.getByTestId('edit-guest-warning-modal');
        await expect(warningModal).not.toBeVisible();

        console.log(`[S2][STEP 5] Waiting for PATCH /guests/${session.applicant.guest.id} response`);
        const patchResponse = await patchResponsePromise;
        console.log(`[S2][STEP 6] Received PATCH response for guest ${session.applicant.guest.id} with status ${patchResponse.status()}`);
        await expect(patchResponse.status()).toBe(200);

        // Wait for edit guest modal to close after update completes
        console.log('[S2][STEP 6.5] Waiting for edit guest modal to close...');
        await expect(editForm).not.toBeVisible({ timeout: 10000 });
        console.log('[S2][STEP 6.5] Edit guest modal closed successfully');

        const patchRequestBody = JSON.parse(patchResponse.request().postData() || '{}');
        await expect(patchRequestBody.first_name).toBe(`${guestUser.first_name} Edited`);
        console.log('[S2][STEP 7] Verified PATCH request payload contains updated first_name');

        // Verify updated guest details are reflected in Identity section
        await page.reload();
        const identitySection2 = await openReportSection(page, 'identity-section')
        
        // Poll for updated guest name (max 6 seconds, every 500ms) to handle cache/race conditions
        console.log('[S2][STEP 8] Polling for updated guest name in Identity section...');
        const expectedName = `${guestUser.first_name} Edited`;
        const maxPollAttempts = 12; // 6 seconds / 500ms = 12 attempts
        const pollInterval = 500;
        let pollAttempt = 0;
        let nameUpdated = false;
        
        while (pollAttempt < maxPollAttempts && !nameUpdated) {
            pollAttempt++;
            try {
                const nameElement = identitySection2.getByTestId('identity-guest-full-name');
                const currentText = await nameElement.textContent();
                
                if (currentText && currentText.includes(expectedName)) {
                    nameUpdated = true;
                    console.log(`✅ [S2][STEP 8] Guest name updated successfully (attempt ${pollAttempt}/${maxPollAttempts}): "${currentText}"`);
                } else {
                    console.log(`   ⏳ [S2][STEP 8] Attempt ${pollAttempt}/${maxPollAttempts}: Current name="${currentText}", expected="${expectedName}", waiting ${pollInterval}ms...`);
                    await page.waitForTimeout(pollInterval);
                }
            } catch (error) {
                console.log(`   ⚠️ [S2][STEP 8] Attempt ${pollAttempt}/${maxPollAttempts}: Error checking name: ${error.message}, waiting ${pollInterval}ms...`);
                await page.waitForTimeout(pollInterval);
            }
        }
        
        if (!nameUpdated) {
            const finalName = await identitySection2.getByTestId('identity-guest-full-name').textContent();
            throw new Error(`❌ [S2][STEP 8] Guest name did not update after ${maxPollAttempts} attempts (${maxPollAttempts * pollInterval / 1000}s). Expected: "${expectedName}", Got: "${finalName}"`);
        }
        
        // Final assertion for clarity
        await expect(identitySection2.getByTestId('identity-guest-full-name')).toContainText(expectedName);
        console.log('[S2][STEP 8] Verified updated guest name is reflected in Identity section');

        testResults.test2.passed = true;
    });

    test.afterAll(async () => {
        // Cleanup: delete created member and user
        // Fix 2: Always attempt cleanup even if IDs not set - find by email pattern
        
        // Get organization if not already set
        if (!organization) {
            try {
                organization = await organizationApi.getByName(ORGANIZATION_NAME);
            } catch (e) {
                console.error('[CLEANUP] Could not fetch organization for cleanup');
            }
        }

        // Delete member by ID if we have it
        if (createdMember && organization) {
            try {
                await adminClient.delete(`/organizations/${organization.id}/members/${createdMember}`);
                console.log('[CLEANUP] Test member cleaned up:', createdMember);
            } catch (e) {
                console.log(`[CLEANUP ERROR] Could not cleanup member with id ${createdMember}`);
                console.error('[CLEANUP ERROR] Could not cleanup member:', e.message);
            }
        }

        // Fix 2: Also try to find and delete member by email pattern (even if createdMember not set)
        if (organization && internalUser?.email) {
            try {
                const membersResponse = await adminClient.get(`/organizations/${organization.id}/members`, {
                    params: {
                        filters: JSON.stringify({
                            $has: {
                                user: {
                                    email: { $like: `autotest+edit-guest-%` }
                                }
                            }
                        }),
                        limit: 100
                    }
                });
                if (membersResponse.data?.data && membersResponse.data.data.length > 0) {
                    // Find member matching our email pattern
                    const matchingMember = membersResponse.data.data.find(m => 
                        m.user?.email && m.user.email.startsWith('autotest+edit-guest-')
                    );
                    if (matchingMember && (!createdMember || matchingMember.id !== createdMember)) {
                        console.log(`[CLEANUP] Found orphaned member by email pattern: ${matchingMember.user?.email}`);
                        try {
                            await adminClient.delete(`/organizations/${organization.id}/members/${matchingMember.id}`);
                            console.log(`[CLEANUP] Deleted orphaned member: ${matchingMember.id}`);
                            if (matchingMember.user?.id) {
                                await adminClient.delete(`/users/${matchingMember.user.id}`);
                                console.log(`[CLEANUP] Deleted orphaned user: ${matchingMember.user.id}`);
                            }
                        } catch (deleteErr) {
                            console.error(`[CLEANUP ERROR] Could not delete orphaned member: ${deleteErr.message}`);
                        }
                    }
                }
            } catch (findErr) {
                console.log(`[CLEANUP] Could not search for orphaned members: ${findErr.message}`);
            }
        }

        // Always delete user by ID if we have it
        if (createdUser) {
            try {
                await adminClient.delete(`/users/${createdUser}`);
                console.log('[CLEANUP] Test user cleaned up:', createdUser);
            } catch (e) {
                console.log(`[CLEANUP ERROR] Could not cleanup user with id ${createdUser}`);
                console.error('[CLEANUP ERROR] Could not cleanup user:', e.message);
            }
        }

        /** Always delete sessions regardless of test pass/fail */
        for (const testKey of Object.keys(testResults)) {
            const result = testResults[testKey];
            if (result.sessionId) {
                try {
                    await adminClient.delete(`/sessions/${result.sessionId}`);
                    console.log(`[CLEANUP] Deleted session ${result.sessionId} from ${testKey}`);
                } catch (e) {
                    console.error(`[CLEANUP ERROR] Could not delete session ${result.sessionId} from ${testKey}:`, e.message);
                }
            }
        }
    })


    async function getOrCreateApplication(applicationApi, {
        name: appName,
        workflowId: workflowId,
        organizationId,
        pms_integration_id = null, // Default to null (VeriSync disabled) - must be explicitly set for VeriSync enabled
        pms_property_id = '654321',
        income_source_template = 'Default',
        flag_collection = 'Low Risk',
        settings = {}
    } = {}) {
        let application = await applicationApi.getByName(appName);
        if (application) {
            return application;
        } else {
            const incomeSourceTemplate = await incomeSourceTemplateApi.getByName(income_source_template);
            if (!incomeSourceTemplate) {
                throw new Error(`Income Source Template ${income_source_template} not found`);
            }

            const flagCollection = await flagCollectionApi.getByName(flag_collection);
            if (!flagCollection) {
                throw new Error(`Flag Collection ${flag_collection} not found`);
            }

            const applicationData = await applicationApi.create({
                name: appName,
                workflow: workflowId,
                organization: organizationId,
                pms_integration_id: pms_integration_id,
                pms_property_id: pms_property_id,
                flag_collection: flagCollection.id,
                settings: {
                    'settings.applications.target.enabled': true,
                    "settings.applications.target.required": true,
                    'settings.applications.target.range.min': 500,
                    'settings.applications.target.range.max': 10000,
                    'settings.applications.income.ratio.type': 'gross',
                    'settings.applications.income.ratio.target': 300,
                    'settings.applications.income.ratio.target.conditional': 300,
                    'settings.applications.income.ratio.guarantor': 500,
                    'settings.applications.income.source_template': incomeSourceTemplate.id,
                    'settings.applications.applicant_types': [],
                    'settings.applications.pms.pdf.components': [],
                    'settings.applications.fast_entry': false,
                    'settings.applications.pms.pdf.upload_trigger': 'session_acceptance',
                    'settings.applications.target.default': null,
                    'settings.applications.target.locked': false,
                    'settings.applications.lifecycle.enabled': false,
                    'settings.applications.lifecycle.duration': 48,
                    'settings.applications.lifecycle.notifications.enabled': true,
                    'settings.applications.lifecycle.notifications.warning.threshold': 12,
                    'settings.applications.knock.community_id': null,
                    'settings.applications.knock.company_id': null,
                    ...settings
                }
            })
            const application = applicationData.data;
            expect(application).toBeDefined();
            await applicationApi.update(application.id, {
                published: true
            })
            return application;
        }
    }

})
