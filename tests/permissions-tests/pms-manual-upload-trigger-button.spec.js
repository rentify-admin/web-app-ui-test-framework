import { test, expect } from '@playwright/test';
import { authenticateAdmin, cleanupTrackedSession } from '../utils/cleanup-helper';
import { admin, app } from '../test_config';
import { ApiClient } from '../api';
import loginForm from '../utils/login-form';
import { findSessionLocator, searchSessionWithText } from '../utils/report-page';
import { joinUrl } from '../utils/helper';
import { createPermissionTestSession } from '../utils/session-generator';

/**
 * QA-273: PMS Manual Upload Trigger Button Test (VC-1141)
 *
 * @API Documentation
 * 
 * Test coverage for PMS manual upload trigger button:
 * - MANAGE_PMS permission controls button visibility
 * - Button click shows confirmation dialog
 * - API call with trigger_pms_upload: true
 * - Workflow log verification (pms.file.uploaded event)
 * - Cancel confirmation dialog (negative test)
 *
 * This test verifies the button correctly controls manual PMS PDF uploads
 * with proper permission gating and workflow event tracking.
 */

test.describe('QA-273 pms-manual-upload-trigger-button', () => {
    // Run this suite in serial with an extended timeout (10 minutes) since
    // the flow creates sessions, users, and waits on async workflows.
    test.describe.configure({
        mode: 'serial',
        timeout: 300_000
    });
    const organizationName = 'Permissions Test Org';
    const roleName = 'Autotest - Empty role';
    const timestamp = Date.now();
    
    const testUser = {
        first_name: 'Autot - PMS',
        last_name: 'Upload User',
        email: `autotest-pms-upload+${timestamp}@verifast.com`,
        password: 'password'
    };
    
    const adminClient = new ApiClient(app.urls.api, null, 15000);
    const LOGIN_API = joinUrl(app.urls.api, 'auth');
    
    // Global state
    let organizationId = null;
    let createdUserId = null;
    let createdMemberId = null;
    let createdSessionId = null;
    
    // Store contexts for cleanup
    let applicantContextForCleanup = null;
    let adminContextForCleanup = null;
    
    test.beforeAll(async ({ browser }) => {
        // Set explicit timeout for beforeAll hook (300s = 5 minutes)
        test.setTimeout(300000);
        
        console.log('[SETUP] Authenticating as admin...');
        // Create admin context and page for API calls
        adminContextForCleanup = await browser.newContext();
        const adminPage = await adminContextForCleanup.newPage();
        
        // Authenticate as admin via UI to get token
        const token = await loginForm.adminLoginAndNavigate(adminPage, admin);
        if (!token) {
            throw new Error('Admin token required');
        }
        adminClient.setAuthToken(token);
        
        // Use Permissions Test Org (consistent with other permission tests)
        try {
            organizationId = await getOrganization(adminClient, organizationName);
            if (!organizationId) {
                throw new Error(`Organization "${organizationName}" not found`);
            }
            console.log(`[SETUP] Using organization: ${organizationName} (${organizationId})`);
        } catch (e) {
            console.error('[API ERROR] Fetching organization:', e.message);
            throw e;
        }
        
        // Get or create role
        let role;
        try {
            console.log('[SETUP] Attempting to get or create role:', roleName);
            role = await getOrCreateRole(adminClient, roleName, organizationId);
            console.log('[SETUP] Selected role:', {
                id: role?.id,
                name: role?.name,
                scope: role?.scope
            });
        } catch (e) {
            console.error('[API ERROR] getOrCreateRole failed');
            console.error('  Error message:', e.message);
            console.error('  Status code:', e.response?.status);
            console.error('  Response data:', JSON.stringify(e.response?.data, null, 2));
            throw e;
        }
        
        // Create test user via POST /users
        console.log('[SETUP] Creating test user via POST /users...');
        let createdUserResp;
        try {
            createdUserResp = await adminClient.post('/users', {
                first_name: testUser.first_name,
                last_name: testUser.last_name,
                email: testUser.email,
                password: testUser.password,
                password_confirmation: testUser.password,  // Required field
                organization: organizationId,
                role: role.id
            });
            
            if (!createdUserResp.data?.data) {
                throw new Error('User creation failed: no data in response');
            }
            
            createdUserId = createdUserResp.data.data.id;
            console.log(`[SETUP] Created test user: ${createdUserId}`);
        } catch (e) {
            console.error('[API ERROR] POST /users:', e.message, e.response?.data);
            
            // If 409 (user already exists), try to find and delete existing user
            if (e.response?.status === 409) {
                console.log('[SETUP] User email conflict (409), attempting cleanup of existing user...');
                try {
                    // Try to find user by email
                    const usersResp = await adminClient.get('/users', {
                        params: {
                            'fields[user]': 'id,email',
                            filters: JSON.stringify({ email: testUser.email })
                        }
                    });
                    const existingUser = usersResp.data?.data?.[0];
                    
                    if (existingUser) {
                        console.log(`[SETUP] Found existing user ${existingUser.id}, deleting...`);
                        await adminClient.delete(`/users/${existingUser.id}`);
                        console.log('[SETUP] Existing user deleted, retrying user creation...');
                        
                        // Retry user creation
                        createdUserResp = await adminClient.post('/users', {
                            first_name: testUser.first_name,
                            last_name: testUser.last_name,
                            email: testUser.email,
                            password: testUser.password,
                            password_confirmation: testUser.password,
                            organization: organizationId,
                            role: role.id
                        });
                        
                        createdUserId = createdUserResp.data?.data?.id;
                        console.log(`[SETUP] Created test user (retry): ${createdUserId}`);
                    } else {
                        throw new Error('User conflict but could not find existing user');
                    }
                } catch (cleanupErr) {
                    console.error('[SETUP ERROR] Failed to cleanup/retry:', cleanupErr.message);
                    throw e; // Throw original error
                }
            } else {
                throw e;
            }
        }
        
        // Get member ID from user's memberships
        try {
            const userResp = await adminClient.get(`/users/${createdUserId}?fields[user]=:all`);
            const userData = userResp.data?.data;
            const memberships = Array.isArray(userData?.memberships) ? userData.memberships : [];
            const membershipForOrg = memberships.find(m => m?.organization?.id === organizationId);
            createdMemberId = membershipForOrg?.id ?? null;
            console.log(`[SETUP] Found member ID: ${createdMemberId}`);
            
            if (!createdMemberId) {
                throw new Error('Created user has no membership for the target organization');
            }
        } catch (e) {
            console.error('[API ERROR] Fetching member:', e.message);
            throw e;
        }
        
        // Set initial permissions (view_sessions + base action permission)
        await setMemberPermissions('initial_setup', [
            { name: 'view_sessions', bindings: [] },
            { name: 'view_organizations', bindings: [] },
            // session-action-btn requires at least one of:
            // EDIT_SESSION_ACCEPTANCE_STATUS, UPLOAD_SESSION_DOCUMENT,
            // INVITE_APPLICANT_TO_SESSION, INVITE_GUARANTOR_TO_SESSION, or EXPORT_SESSION
            // Use INVITE_APPLICANT_TO_SESSION as our baseline so the dropdown is present
            { name: 'invite_applicant_to_session', bindings: [] }
        ]);
        
        // Preflight: ensure user can log in
        try {
            await waitForAuthReady(testUser, { maxAttempts: 10, delayMs: 2000 });
            console.log('[SETUP] Preflight login succeeded');
        } catch (e) {
            console.log('[SETUP] Preflight login failed:', e.message);
            throw e;
        }
        
        // Create test session with financial verification (for PMS upload)
        console.log('[SETUP] Creating test session with financial verification...');
        try {
            console.log('[SETUP] Calling createPermissionTestSession with config:', {
                applicationName: 'Autotest - Simulator Financial Step',
                firstName: testUser.first_name,
                lastName: testUser.last_name,
                email: testUser.email,
                completeIdentity: false,  // Financial-only workflow has no identity step
                completeFinancial: true,
                completeEmployment: false,
                addChildApplicant: false,
                skipLogin: true,
                skipApplicantInviteStep: true  // Financial-only workflow skips invite step
            });
            
            const { sessionId, applicantContext } = await createPermissionTestSession(adminPage, browser, {
                applicationName: 'Autotest - Simulator Financial Step',
                firstName: testUser.first_name,
                lastName: testUser.last_name,
                email: testUser.email,
                completeIdentity: false,  // Financial-only workflow has no identity step
                completeFinancial: true,
                completeEmployment: false,
                addChildApplicant: false,
                skipLogin: true,
                skipApplicantInviteStep: true  // Financial-only workflow skips invite step
            });
            createdSessionId = sessionId;
            applicantContextForCleanup = applicantContext;
            console.log(`[SETUP] Created test session: sessionId=${createdSessionId}`);
        } catch (e) {
            console.error('[SETUP ERROR] Creating test session');
            console.error('  Error message:', e.message);
            console.error('  Status code:', e.response?.status);
            console.error('  Response data:', JSON.stringify(e.response?.data, null, 2));
            console.error('  Stack trace:', e.stack);
            throw e;
        } finally {
            // Close admin page but keep context for cleanup
            await adminPage.close();
        }
    });
    
    test.afterAll(async ({ request }, testInfo) => {
        console.log('[CLEANUP] Starting cleanup...');
        
        // Cleanup session
        if (createdSessionId) {
            try {
                await cleanupTrackedSession(request, createdSessionId, testInfo);
                console.log(`[CLEANUP] Session cleanup handled: ${createdSessionId}`);
            } catch (e) {
                console.error('[CLEANUP ERROR] Session:', e.message);
            }
        }
        
        // Cleanup user and member
        if (createdMemberId && organizationId) {
            try {
                await adminClient.delete(`/organizations/${organizationId}/members/${createdMemberId}`);
                console.log(`[CLEANUP] Member ${createdMemberId} deleted`);
            } catch (e) {
                console.error('[CLEANUP ERROR] Member:', e.message);
            }
        }
        
        if (createdUserId) {
            try {
                await adminClient.delete(`/users/${createdUserId}`);
                console.log(`[CLEANUP] User ${createdUserId} deleted`);
            } catch (e) {
                console.error('[CLEANUP ERROR] User:', e.message);
            }
        }
        
        // Close contexts
        if (applicantContextForCleanup) {
            await applicantContextForCleanup.close();
        }
        if (adminContextForCleanup) {
            await adminContextForCleanup.close();
        }
        
        console.log('[CLEANUP] Cleanup complete');
    });
    
    // Helper functions
    const setMemberPermissions = async (label, permissions) => {
        const payload = { permissions };
        console.log(`[PERMS] Setting permissions (${label}):`, permissions.map(p => p.name));
        await adminClient.patch(`/organizations/${organizationId}/members/${createdMemberId}`, payload);
        console.log(`[PERMS] Permissions set (${label})`);
    };
    
    const loginInFreshContext = async (browser) => {
        const ctx = await browser.newContext();
        const p = await ctx.newPage();
        const maxAttempts = 5;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            await p.goto('/');
            await loginForm.fill(p, testUser);
            
            const [authResp] = await Promise.all([
                p.waitForResponse(LOGIN_API),
                p.locator('button[type="submit"]').click()
            ]);
            
            if (authResp.ok()) {
                // Wait for page to load after login
                await expect(p.getByTestId('household-status-alert')).toBeVisible({ timeout: 20_000 });
                return { ctx, p };
            }
            
            let body;
            try {
                body = await authResp.json();
            } catch {
                body = { raw: await authResp.text() };
            }
            
            console.log('[LOGIN] /auth failed:', { attempt, status: authResp.status(), body });
            
            const isNoCaller500 =
                authResp.status() === 500
                && body?.error?.meta?.message === 'No caller found for the given authenticatable';
            
            if (isNoCaller500 && attempt < maxAttempts) {
                await p.waitForTimeout(2000);
                continue;
            }
            
            throw new Error(`Login failed: /auth returned ${authResp.status()}`);
        }
        
        return { ctx, p };
    };
    
    const navigateToSessionDetail = async (p) => {
        // Navigate to applicants menu
        const applicantsMenu = p.getByTestId('applicants-menu');
        await expect(applicantsMenu).toBeVisible();
        await applicantsMenu.click();
        
        const applicantsSubmenu = p.getByTestId('applicants-submenu');
        await expect(applicantsSubmenu).toBeVisible({ timeout: 5000 });
        await applicantsSubmenu.click();
        
        await p.waitForTimeout(3000);
        
        // Navigate to session report page
        await searchSessionWithText(p, createdSessionId);
        const sessionCard = await findSessionLocator(p, `.application-card[data-session="${createdSessionId}"]`);
        await sessionCard.click();
        
        // Wait for session page to load
        await expect(p.getByTestId('household-status-alert')).toBeVisible({ timeout: 10_000 });
        await p.waitForTimeout(1000); // Wait for session to fully load
    };
    
    const openSessionActionDropdown = async (p) => {
        const actionButton = p.getByTestId('session-action-btn');
        await expect(actionButton).toBeVisible({ timeout: 5000 });
        await actionButton.click();
        await p.waitForTimeout(500);
    };
    
    // ============================================================
    // SINGLE TEST WITH MULTIPLE STEPS (following pattern of remarks_permissions.spec.js)
    // ============================================================
    
    test('Verify PMS upload button permission gating and functionality', {
        tag: ['@vc-1141', '@permissions', '@pms', '@staging-ready', '@rc-ready']
    }, async ({ browser }) => {
        
        // --- STEP 1: Button Hidden Without MANAGE_PMS Permission ---
        console.log('[STEP 1] Testing button visibility WITHOUT MANAGE_PMS permission');
        
        // Permissions: base visibility for actions dropdown, but NO MANAGE_PMS
        await setMemberPermissions('no_manage_pms', [
            { name: 'view_sessions', bindings: [] },
            { name: 'view_organizations', bindings: [] },
            // Ensure session-action-btn is visible, but PMS button is still gated by MANAGE_PMS
            { name: 'invite_applicant_to_session', bindings: [] }
        ]);
        
        let ctx1 = await browser.newContext();
        let p1 = await ctx1.newPage();
        
        try {
            await p1.goto('/');
            await loginForm.fill(p1, testUser);
            await p1.locator('button[type="submit"]').click();
            await p1.waitForResponse(LOGIN_API);
            
            await navigateToSessionDetail(p1);
            await openSessionActionDropdown(p1);
            
            // Verify trigger-pms-upload-btn is NOT visible
            const triggerPmsBtn1 = p1.getByTestId('trigger-pms-upload-btn');
            await expect(triggerPmsBtn1).not.toBeVisible();
            console.log('[STEP 1] ✅ Button correctly hidden without MANAGE_PMS permission');
        } finally {
            await ctx1.close();
        }
        
        // --- STEP 2: Button Visible With MANAGE_PMS Permission ---
        console.log('[STEP 2] Testing button visibility WITH MANAGE_PMS permission');
        
        // Grant MANAGE_PMS permission (keep baseline action permission so dropdown is visible)
        // NOTE: External users also need MANAGE_SESSIONS to pass SessionPolicy::update
        await setMemberPermissions('with_manage_pms', [
            { name: 'view_sessions', bindings: [] },
            { name: 'view_organizations', bindings: [] },
            { name: 'invite_applicant_to_session', bindings: [] },
            { name: 'manage_sessions', bindings: [] },
            { name: 'manage_pms', bindings: [] }
        ]);
        
        let ctx2 = await browser.newContext();
        let p2 = await ctx2.newPage();
        
        try {
            await p2.goto('/');
            await loginForm.fill(p2, testUser);
            await p2.locator('button[type="submit"]').click();
            await p2.waitForResponse(LOGIN_API);
            
            await navigateToSessionDetail(p2);
            await openSessionActionDropdown(p2);
            
            // Verify trigger-pms-upload-btn IS visible
            const triggerPmsBtn2 = p2.getByTestId('trigger-pms-upload-btn');
            await expect(triggerPmsBtn2).toBeVisible();
            console.log('[STEP 2] ✅ Button correctly visible with MANAGE_PMS permission');
        } finally {
            await ctx2.close();
        }
        
        // --- STEP 3: Button Click Shows Confirmation Dialog ---
        console.log('[STEP 3] Testing confirmation dialog');
        
        let ctx3 = await browser.newContext();
        let p3 = await ctx3.newPage();
        
        try {
            await p3.goto('/');
            await loginForm.fill(p3, testUser);
            await p3.locator('button[type="submit"]').click();
            await p3.waitForResponse(LOGIN_API);
            
            await navigateToSessionDetail(p3);
            await openSessionActionDropdown(p3);
            
            // Click trigger PMS upload button
            const triggerPmsBtn3 = p3.getByTestId('trigger-pms-upload-btn');
            await triggerPmsBtn3.click();
            await p3.waitForTimeout(500);
            
            // Verify confirmation dialog appears
            const dialog = p3.getByRole('dialog');
            await expect(dialog).toBeVisible({ timeout: 5000 });
            console.log('[STEP 3] ✅ Confirmation dialog appeared');
            
            // Verify dialog has confirm and cancel buttons
            const confirmBtn = dialog.getByRole('button', { name: /confirm|yes|continue/i });
            const cancelBtn = dialog.getByRole('button', { name: /cancel|no/i });
            
            await expect(confirmBtn).toBeVisible();
            await expect(cancelBtn).toBeVisible();
            console.log('[STEP 3] ✅ Dialog has confirm and cancel buttons');
            
            // Close dialog by clicking cancel (cleanup)
            await cancelBtn.click();
            await expect(dialog).not.toBeVisible();
        } finally {
            await ctx3.close();
        }
        
        // --- STEP 4: Cancel Button Prevents API Call ---
        console.log('[STEP 4] Testing cancel confirmation dialog');
        
        let ctx4 = await browser.newContext();
        let p4 = await ctx4.newPage();
        
        try {
            await p4.goto('/');
            await loginForm.fill(p4, testUser);
            await p4.locator('button[type="submit"]').click();
            await p4.waitForResponse(LOGIN_API);
            
            await navigateToSessionDetail(p4);
            await openSessionActionDropdown(p4);
            
            // Set up API listener to detect PATCH calls
            let apiCalled = false;
            p4.on('response', resp => {
                if (resp.url().includes(`/sessions/${createdSessionId}`) && 
                    resp.request().method() === 'PATCH') {
                    apiCalled = true;
                }
            });
            
            // Click trigger PMS upload button
            const triggerPmsBtn4 = p4.getByTestId('trigger-pms-upload-btn');
            await triggerPmsBtn4.click();
            await p4.waitForTimeout(500);
            
            // Click cancel in confirmation dialog
            const dialog = p4.getByRole('dialog');
            await expect(dialog).toBeVisible();
            const cancelBtn = dialog.getByRole('button', { name: /cancel|no/i });
            await cancelBtn.click();
            
            // Wait to ensure no API call is made
            await p4.waitForTimeout(2000);
            
            expect(apiCalled).toBe(false);
            console.log('[STEP 4] ✅ API call correctly prevented after cancel');
        } finally {
            await ctx4.close();
        }
        
        // --- STEP 5: Confirm Triggers API Call with trigger_pms_upload: true ---
        console.log('[STEP 5] Testing API call on confirmation');
        
        let ctx5 = await browser.newContext();
        let p5 = await ctx5.newPage();
        
        try {
            await p5.goto('/');
            await loginForm.fill(p5, testUser);
            await p5.locator('button[type="submit"]').click();
            await p5.waitForResponse(LOGIN_API);
            
            await navigateToSessionDetail(p5);
            await openSessionActionDropdown(p5);
            
            // Click trigger PMS upload button
            const triggerPmsBtn5 = p5.getByTestId('trigger-pms-upload-btn');
            await triggerPmsBtn5.click();
            await p5.waitForTimeout(500);
            
            // Wait for dialog and click confirm
            const dialog = p5.getByRole('dialog');
            await expect(dialog).toBeVisible();
            const confirmBtn = dialog.getByRole('button', { name: /confirm|yes|continue/i });
            
            // Intercept API call (wait up to 20s for PATCH to complete)
            const [patchResponse] = await Promise.all([
                p5.waitForResponse(resp => 
                    resp.url().includes(`/sessions/${createdSessionId}`) &&
                    resp.request().method() === 'PATCH' &&
                    resp.ok(),
                    { timeout: 20000 }
                ),
                confirmBtn.click()
            ]);
            
            // Verify API call was made with correct payload
            const requestBody = patchResponse.request().postDataJSON();
            expect(requestBody).toHaveProperty('trigger_pms_upload', true);
            console.log('[STEP 5] ✅ API call triggered with trigger_pms_upload: true');
            
            // Verify response is OK
            expect(patchResponse.status()).toBe(200);
            console.log('[STEP 5] ✅ API call returned 200 OK');
            
            // Wait for success notification (optional - may timeout if not implemented)
            await p5.waitForTimeout(2000);
        } finally {
            await ctx5.close();
        }
        
        // --- STEP 6: Verify Workflow Event (session.triggered_pms_upload) ---
        console.log('[STEP 6] Testing workflow event verification (session.triggered_pms_upload)');
        
        let ctx6 = await browser.newContext();
        let p6 = await ctx6.newPage();
        
        try {
            await p6.goto('/');
            await loginForm.fill(p6, testUser);
            await p6.locator('button[type="submit"]').click();
            await p6.waitForResponse(LOGIN_API);
            
            await navigateToSessionDetail(p6);
            await openSessionActionDropdown(p6);
            
            // Trigger PMS upload
            const triggerPmsBtn6 = p6.getByTestId('trigger-pms-upload-btn');
            await triggerPmsBtn6.click();
            await p6.waitForTimeout(500);
            
            const dialog = p6.getByRole('dialog');
            await expect(dialog).toBeVisible();
            const confirmBtn = dialog.getByRole('button', { name: /confirm|yes|continue/i });
            
            await Promise.all([
                p6.waitForResponse(resp => 
                    resp.url().includes(`/sessions/${createdSessionId}`) &&
                    resp.request().method() === 'PATCH' &&
                    resp.ok()
                ),
                confirmBtn.click()
            ]);
            
            console.log('[STEP 6] PMS upload triggered, polling for workflow event...');
            
            // Poll for workflow event emitted by PMSUpload handler
            const event = await pollForWorkflowEvent(
                adminClient, 
                createdSessionId, 
                'session.triggered_pms_upload',
                60000 // 60 second timeout
            );
            
            expect(event).toBeDefined();
            // Events use the "event" field for the key (e.g. "session.triggered_pms_upload")
            expect(event.event).toBe('session.triggered_pms_upload');
            console.log('[STEP 6] ✅ Workflow event session.triggered_pms_upload found');
            
            // Verify event metadata (optional - structure may vary)
            if (event.meta) {
                console.log('[STEP 6] Event metadata:', JSON.stringify(event.meta, null, 2));
            }
        } finally {
            await ctx6.close();
        }
        
        console.log('✅ All permission steps and functionality tests completed successfully.');
    });
});

// ============================================================
// Helper Functions
// ============================================================

/**
 * Get or create role (global roles that can be assigned to organization)
 */
async function getOrCreateRole(adminClient, roleName, organizationId) {
    try {
        console.log(`[API] Searching for role "${roleName}" in /roles...`);
        const roleResp = await adminClient.get('/roles', {
            params: {
                'fields[role]': 'id,name,scope,organization',
                filters: JSON.stringify({
                    role: { name: roleName }
                })
            }
        });
        let roles = roleResp.data?.data ?? [];
        console.log(`[API] Found ${roles.length} role(s) with name "${roleName}"`);
        
        // Filter for roles assignable to this org
        roles = roles.filter(r =>
            r?.name === roleName
            && r?.scope === 'external'
            && (!r?.organization || r.organization.id === organizationId)
        );
        console.log(`[API] After filtering for external scope and org match: ${roles.length} role(s)`);
        
        if (roles.length === 0) {
            throw new Error(`Role "${roleName}" not found or not assignable to organization ${organizationId}`);
        }
        
        console.log(`[API] Using existing role "${roleName}", id=${roles[0].id}, scope=${roles[0].scope}`);
        return roles[0];
    } catch (err) {
        console.error('[API ERROR] getOrCreateRole failed');
        console.error('  Role name:', roleName);
        console.error('  Organization ID:', organizationId);
        console.error('  Error message:', err.message);
        console.error('  Status code:', err.response?.status);
        console.error('  Response data:', JSON.stringify(err.response?.data, null, 2));
        throw err;
    }
}

async function getOrganization(adminClient, organizationName) {
    const orgResp = await adminClient.get('/organizations', {
        params: {
            filters: JSON.stringify({
                organization: { name: organizationName }
            })
        }
    });
    return orgResp.data?.data?.[0]?.id;
}

/**
 * Wait for user auth to be ready (retry login)
 */
async function waitForAuthReady(userCredentials, options = {}) {
    const { maxAttempts = 5, delayMs = 2000 } = options;
    const tmpClient = new ApiClient(app.urls.api, null, 15000);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const { randomUUID } = await import('crypto');
            const authResp = await tmpClient.post('/auth', {
                email: userCredentials.email,
                password: userCredentials.password,
                uuid: randomUUID(),
                os: 'web'
            });
            
            if (!authResp.data?.data?.token) {
                throw new Error('No token in auth response');
            }
            
            return true;
        } catch (e) {
            const msg = String(e?.message || e);
            const isNoCaller500 = msg.includes('No caller found for the given authenticatable')
                || msg.includes('Status: 500');
            console.log('[SETUP] Preflight /auth failed:', { attempt, isNoCaller500, message: msg });
            
            if (attempt === maxAttempts) {
                throw e;
            }
            
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    
    throw new Error('User auth not ready after max attempts');
}

/**
 * Poll for workflow event
 */
async function pollForWorkflowEvent(adminClient, sessionId, eventType, maxWaitMs = 30000) {
    const startTime = Date.now();
    const pollInterval = 2000;
    
    while (Date.now() - startTime < maxWaitMs) {
        try {
            const eventsResp = await adminClient.get(`/sessions/${sessionId}/events`);
            const events = eventsResp.data?.data || [];
            // NOTE: Events use "event" as the primary key field (e.g. "session.triggered_pms_upload")
            // Some older helpers/tests used "type" – check both for safety.
            const targetEvent = events.find(e => e.event === eventType || e.type === eventType);
            
            if (targetEvent) {
                return targetEvent;
            }
        } catch (e) {
            console.log(`[POLL] Error fetching events: ${e.message}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    throw new Error(`Event "${eventType}" not found after ${maxWaitMs}ms`);
}
