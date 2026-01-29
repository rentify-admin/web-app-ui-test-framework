import { test, expect } from '@playwright/test';
import { ApiClient } from '../api';
import { admin, app } from '../test_config';
import loginForm from '../utils/login-form';
import { authenticateAdmin } from '../utils/cleanup-helper';
import { findAndInviteApplication } from '../utils/applications-page';
import generateSessionForm from '../utils/generate-session-form';
import { setupInviteLinkSession, simulatorFinancialStepWithVeridocs, updateRentBudget } from '../utils/session-flow';
import { customVeriDocsBankStatementData } from '../mock-data/bank-statement-veridocs-payload';
import { findSessionLocator, openReportSection, searchSessionWithText } from '../utils/report-page';
import { joinUrl } from '../utils/helper';
import { waitForJsonResponse } from '../utils/wait-response';

/**
 * @API Documentation
 * @ticket QA-264 - UI Test - Document Deletion from Files Section - Internal User Visibility
 *
 * Comprehensive UI and API test coverage for document deletion functionality:
 * - Delete icon visibility (internal users only - hardcoded in frontend)
 * - Complete deletion workflow with confirmation dialog
 * - API verification of file deletion
 *
 * Key UI gates in web-app:
 * - Delete icon is v-if gated by isInternalUser (AllList.vue, BankStatement.vue, PaystubList.vue, etc.)
 * - External users do NOT see delete icon regardless of DELETE_FILES permission
 * - Confirmation dialog uses confirm.alert() utility
 * - Success toast shown after deletion
 *
 * Key API gates in api:
 * - DELETE /sessions/{id}/files/{fileId} requires DELETE_FILES permission (FilePolicy)
 * - Backend allows external users with permission, but frontend hides button
 */

test.describe('QA-264 document-delete-internal-only', () => {
    test.describe.configure({
        mode: 'serial',
        timeout: 300_000 // 5 minutes total
    });

    const externalOrgName = 'Permissions Test Org';
    const externalRoleName = 'Autotest - Empty role';
    const timestamp = Date.now();
    const applicationName = 'Autotest - Simulator Financial Step';

    const externalUser = {
        first_name: 'AutoTest',
        last_name: 'File Delete',
        email: `autotest-qa264+${timestamp}@verifast.com`,
        password: 'password'
    };

    // ========================================
    // 🔑 TEST USER CREDENTIALS FOR MANUAL TESTING
    // ========================================
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('🔑 TEST USER CREDENTIALS - KEEP FOR MANUAL TESTING');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log(`📧 Email:    ${externalUser.email}`);
    console.log(`🔒 Password: ${externalUser.password}`);
    console.log(`👤 Name:    ${externalUser.first_name} ${externalUser.last_name}`);
    console.log(`🏢 Org:     ${externalOrgName}`);
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('\n');

    const adminClient = new ApiClient(app.urls.api, null, 30_000);
    const LOGIN_API = joinUrl(app.urls.api, 'auth');

    let externalOrgId = null;
    let externalUserId = null;
    let externalMemberId = null;
    let sessionId = null;
    let fileId = null; // Bank statement file ID

    test.beforeAll(async ({ browser, request }) => {
        // Set explicit timeout for beforeAll hook (300s = 5 minutes)
        test.setTimeout(300000);
        
        // 1) Admin auth (Pattern A): API token independent from UI session/logout
        const adminApiToken = await authenticateAdmin(request);
        adminClient.setAuthToken(adminApiToken);

        // 2) Admin UI login (for UI navigation only)
        const adminContext = await browser.newContext();
        const adminPage = await adminContext.newPage();
        await loginForm.adminLoginAndNavigate(adminPage, admin);

        // 3) Org + role
        console.log('[SETUP] Fetching organization and role...');
        externalOrgId = await getOrganization(adminClient, externalOrgName);
        const externalRole = await getOrCreateRole(adminClient, externalRoleName, externalOrgId, 'external');

        // 4) User + member id
        console.log('[SETUP] Creating external user...');
        const userResp = await adminClient.post('/users', {
            first_name: externalUser.first_name,
            last_name: externalUser.last_name,
            email: externalUser.email,
            password: externalUser.password,
            password_confirmation: externalUser.password,
            organization: externalOrgId,
            role: externalRole.id
        });
        externalUserId = userResp.data?.data?.id;
        if (!externalUserId) throw new Error('Failed to create external user');

        const userDetails = await adminClient.get(`/users/${externalUserId}?fields[user]=:all`);
        const memberships = userDetails.data?.data?.memberships || [];
        const membership = memberships.find(m => m?.organization?.id === externalOrgId);
        externalMemberId = membership?.id;
        if (!externalMemberId) throw new Error('Failed to resolve external member id');

        // 5) Grant required permissions to external user
        console.log('[SETUP] Granting permissions to external user...');
        await adminClient.patch(`/organizations/${externalOrgId}/members/${externalMemberId}`, {
            permissions: [
                { name: 'view_sessions', bindings: [] },
                { name: 'view_session_documents', bindings: [] },
                { name: 'view_files', bindings: [] },
                { name: 'delete_files', bindings: [] } // Permission granted but UI will still hide button
            ]
        });

        await waitForAuthReady(externalUser);

        // 6) Create a session and generate bank statement document via simulator financial step
        console.log('[SETUP] Creating session and generating bank statement...');
        await adminPage.getByTestId('applications-menu').click();
        await adminPage.getByTestId('applications-submenu').click();
        await findAndInviteApplication(adminPage, applicationName);

        const applicant = {
            first_name: 'QA',
            last_name: '264',
            email: `qa264-applicant+${timestamp}@verifast.com`,
        };

        const sessionData = await generateSessionForm.generateSessionAndExtractLink(adminPage, applicant);
        sessionId = sessionData.sessionId;
        if (!sessionId) throw new Error('Failed to create session');

        // Logout admin and complete invite-link session as applicant, then run financial simulator
        await adminPage.getByTestId('user-dropdown-toggle-btn').click();
        await adminPage.getByTestId('user-logout-dropdown-item').click();

        try {
            await adminPage.goto(sessionData.link, { waitUntil: 'domcontentloaded' });
        } catch (e) {
            const msg = String(e?.message || e);
            if (!msg.includes('net::ERR_ABORTED')) {
                throw e;
            }
            await adminPage.waitForTimeout(500);
            await adminPage.goto(sessionData.link, { waitUntil: 'domcontentloaded' });
        }
        await setupInviteLinkSession(adminPage, { sessionUrl: sessionData.sessionUrl });
        await updateRentBudget(adminPage, sessionId, '500');

        const payload = customVeriDocsBankStatementData(applicant, 3, 'weekly', 4, {
            creditAmount: 2000,
            payrollDescription: 'PAYROLL DEPOSIT',
            extraCreditCount: 2,
            miscDescriptions: 1,
            extraCreditAmount: 500
        });
        await simulatorFinancialStepWithVeridocs(adminPage, payload);

        // Some flows require clicking continue after simulator completes
        const continueBtn = adminPage.getByTestId('financial-verification-continue-btn');
        if (await continueBtn.isVisible().catch(() => false)) {
            await continueBtn.click();
        }

        // 7) Wait for file to be generated and get file ID
        console.log('[SETUP] Waiting for bank statement file to be generated...');
        let files = [];
        for (let attempt = 0; attempt < 20; attempt++) {
            const filesResp = await adminClient.get(`/sessions/${sessionId}/files`, {
                params: {
                    'fields[file]': ':all',
                    all: true
                }
            });
            files = filesResp.data?.data || [];
            if (files.length > 0) {
                console.log(`[SETUP] Found ${files.length} file(s) after ${attempt + 1} attempt(s)`);
                break;
            }
            await new Promise(r => setTimeout(r, 2000));
        }

        if (files.length === 0) {
            throw new Error('Failed to generate bank statement file for test session');
        }

        // Get the first bank statement file (or any file)
        fileId = files[0]?.id;
        if (!fileId) {
            throw new Error('Failed to get file ID from generated files');
        }

        console.log(`[SETUP] File ID: ${fileId}`);

        await adminPage.close();
        await adminContext.close();
    });

    test('Test 1: Delete icon hidden for external user', {
        tag: ['@qa-264', '@permissions', '@files', '@ui', '@core', '@regression', '@rc-ready', '@staging-ready']
    }, async ({ page }) => {
        // 1. Login as external user
        console.log('[TEST 1] Logging in as external user...');
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await loginForm.fill(page, externalUser);
        const [authResp] = await Promise.all([
            page.waitForResponse(LOGIN_API),
            page.locator('button[type="submit"]').click()
        ]);
        expect(authResp.ok()).toBeTruthy();
        await expect(page.getByTestId('logout-menu')).toBeVisible({ timeout: 20_000 });

        // 2. Navigate to session Files section
        console.log('[TEST 1] Navigating to session Files section...');
        
        // Navigate to applicants menu and submenu first
        const applicantsMenu = page.getByTestId('applicants-menu');
        const isMenuOpen = await applicantsMenu.evaluate(el => el.classList.contains('sidebar-item-open')).catch(() => false);
        if (!isMenuOpen) {
            await page.waitForTimeout(1000);
            await applicantsMenu.click({ force: true });
            await page.waitForTimeout(1000);
        }
        await page.getByTestId('applicants-submenu').first().click();
        await page.waitForTimeout(2000);
        
        await searchSessionWithText(page, sessionId);
        const card = await findSessionLocator(page, `.application-card[data-session="${sessionId}"]`);
        await card.click();
        await expect(page).toHaveURL(new RegExp(`/(sessions|applicants\\/all)/${sessionId}`), { timeout: 20_000 });

        // Navigate to Files section - click files section header to expand
        console.log('[TEST 1] Expanding Files section...');
        const filesSectionHeader = page.getByTestId('files-section-header');
        await expect(filesSectionHeader).toBeVisible({ timeout: 10_000 });
        await filesSectionHeader.click();
        await page.waitForTimeout(2000); // Wait for section expansion animation

        // Click "All" tab within Files section
        console.log('[TEST 1] Clicking document-tab-all...');
        await page.getByTestId('document-tab-all').click();
        await expect(page.getByTestId('file-section-all-wrapper')).toBeVisible({ timeout: 10_000 });

        // 3. Verify delete icon NOT visible
        // Alternative locator: <a> tag containing SVG trash icon with red stroke
        // Located in action column, next to view/edit icons
        console.log('[TEST 1] Verifying delete icon is NOT visible for external user...');
        const deleteButton = page.locator('a').filter({ 
            has: page.locator('svg path[stroke="#ef4444"]') 
        }).first();
        await expect(deleteButton).not.toBeVisible({ timeout: 5000 });

        console.log('[TEST 1] ✅ Delete icon correctly hidden for external user');
    });

    test('Test 2: Delete icon visible for internal user', {
        tag: ['@qa-264', '@permissions', '@files', '@ui', '@core', '@regression']
    }, async ({ page }) => {
        // 1. Login as admin (internal)
        console.log('[TEST 2] Logging in as admin (internal user)...');
        await loginForm.adminLoginAndNavigate(page, admin);

        // 2. Navigate to session Files section
        console.log('[TEST 2] Navigating to session Files section...');
        
        // Navigate to applicants menu and submenu first
        const applicantsMenu = page.getByTestId('applicants-menu');
        const isMenuOpen = await applicantsMenu.evaluate(el => el.classList.contains('sidebar-item-open')).catch(() => false);
        if (!isMenuOpen) {
            await page.waitForTimeout(1000);
            await applicantsMenu.click({ force: true });
            await page.waitForTimeout(1000);
        }
        await page.getByTestId('applicants-submenu').first().click();
        await page.waitForTimeout(2000);
        
        await searchSessionWithText(page, sessionId);
        const card = await findSessionLocator(page, `.application-card[data-session="${sessionId}"]`);
        await card.click();
        await expect(page).toHaveURL(new RegExp(`/(sessions|applicants\\/all)/${sessionId}`), { timeout: 20_000 });

        // Navigate to Files section - click files section header to expand
        console.log('[TEST 2] Expanding Files section...');
        const filesSectionHeader = page.getByTestId('files-section-header');
        await expect(filesSectionHeader).toBeVisible({ timeout: 10_000 });
        await filesSectionHeader.click();
        await page.waitForTimeout(2000); // Wait for section expansion animation

        // Click "All" tab within Files section
        console.log('[TEST 2] Clicking document-tab-all...');
        await page.getByTestId('document-tab-all').click();
        await expect(page.getByTestId('file-section-all-wrapper')).toBeVisible({ timeout: 10_000 });

        // 3. Verify delete icon IS visible
        // Alternative locator: <a> tag containing SVG trash icon with red stroke
        // Located in action column, next to view/edit icons
        console.log('[TEST 2] Verifying delete icon IS visible for internal user...');
        const deleteButton = page.locator('a').filter({ 
            has: page.locator('svg path[stroke="#ef4444"]') 
        }).first();
        await expect(deleteButton).toBeVisible({ timeout: 10_000 });

        console.log('[TEST 2] ✅ Delete icon correctly visible for internal user');
    });

    test('Test 3: Complete delete flow (internal user)', {
        tag: ['@qa-264', '@permissions', '@files', '@ui', '@api', '@core', '@regression', '@rc-ready', '@staging-ready']
    }, async ({ page }) => {
        // 1. Login as admin (internal)
        console.log('[TEST 3] Logging in as admin (internal user)...');
        await loginForm.adminLoginAndNavigate(page, admin);

        // 2. Navigate to session Files section
        console.log('[TEST 3] Navigating to session Files section...');
        
        // Navigate to applicants menu and submenu first
        const applicantsMenu = page.getByTestId('applicants-menu');
        const isMenuOpen = await applicantsMenu.evaluate(el => el.classList.contains('sidebar-item-open')).catch(() => false);
        if (!isMenuOpen) {
            await page.waitForTimeout(1000);
            await applicantsMenu.click({ force: true });
            await page.waitForTimeout(1000);
        }
        await page.getByTestId('applicants-submenu').first().click();
        await page.waitForTimeout(2000);
        
        await searchSessionWithText(page, sessionId);
        const card = await findSessionLocator(page, `.application-card[data-session="${sessionId}"]`);
        await card.click();
        await expect(page).toHaveURL(new RegExp(`/(sessions|applicants\\/all)/${sessionId}`), { timeout: 20_000 });

        // Navigate to Files section - click files section header to expand
        console.log('[TEST 3] Expanding Files section...');
        const filesSectionHeader = page.getByTestId('files-section-header');
        await expect(filesSectionHeader).toBeVisible({ timeout: 10_000 });
        await filesSectionHeader.click();
        await page.waitForTimeout(2000); // Wait for section expansion animation

        // Click "All" tab within Files section
        console.log('[TEST 3] Clicking document-tab-all...');
        await page.getByTestId('document-tab-all').click();
        await expect(page.getByTestId('file-section-all-wrapper')).toBeVisible({ timeout: 10_000 });

        // 3. Verify delete icon is visible
        // Alternative locator: <a> tag containing SVG trash icon with red stroke
        // Located in action column, next to view/edit icons
        console.log('[TEST 3] Verifying delete icon is visible...');
        const deleteButton = page.locator('a').filter({ 
            has: page.locator('svg path[stroke="#ef4444"]') 
        }).first();
        await expect(deleteButton).toBeVisible({ timeout: 10_000 });

        // 4. Click delete button (this should open confirmation modal, NOT delete yet)
        console.log('[TEST 3] Clicking delete button...');
        await deleteButton.click();

        // 5. Verify confirmation dialog appears
        console.log('[TEST 3] Verifying confirmation dialog appears...');
        const confirmModal = page.getByTestId('confirm-box');
        await expect(confirmModal).toBeVisible({ timeout: 5000 });

        // 6. Verify confirmation text
        console.log('[TEST 3] Verifying confirmation text...');
        await expect(confirmModal).toContainText('Are you sure you want to delete this document?');

        // 7. Click confirm button and intercept DELETE API call (this is when deletion happens)
        console.log('[TEST 3] Clicking confirm button and intercepting DELETE API call...');
        const confirmButton = page.getByTestId('confirm-btn');
        const [deleteResponse] = await Promise.all([
            page.waitForResponse(resp => 
                resp.url().includes(`/sessions/${sessionId}/files/`) && 
                resp.request().method() === 'DELETE'
            ),
            confirmButton.click()
        ]);

        // 8. Verify DELETE API response (204)
        console.log('[TEST 3] Verifying DELETE API response...');
        expect(deleteResponse.status()).toBe(204);

        // 9. Verify success toast
        console.log('[TEST 3] Verifying success toast...');
        await expect(page.locator('text=/Document deleted successfully/i')).toBeVisible({ timeout: 5000 });

        // 10. Verify document removed from list (wait for UI update)
        console.log('[TEST 3] Verifying document removed from list...');
        await page.waitForTimeout(1000); // Wait for list refresh
        // Verify delete button is no longer visible (document was removed)
        const deletedFileButton = page.locator('a').filter({ 
            has: page.locator('svg path[stroke="#ef4444"]') 
        }).first();
        await expect(deletedFileButton).not.toBeVisible({ timeout: 5000 });

        // 11. API Verification: GET /sessions/{id}/files - verify document no longer in response
        // Use adminClient (token set in beforeAll)
        console.log('[TEST 3] Verifying file deleted via API...');
        const filesResponse = await adminClient.get(`/sessions/${sessionId}/files`, {
            params: {
                'fields[file]': ':all',
                all: true
            }
        });
        const files = filesResponse.data?.data || [];
        const deletedFile = files.find(f => f.id === fileId);
        expect(deletedFile).toBeUndefined();

        console.log('[TEST 3] ✅ Complete delete flow verified successfully');
    });

    test.afterAll(async ({ request }) => {
        console.log('[CLEANUP] Starting cleanup...');
        let adminApiToken;
        try {
            adminApiToken = await authenticateAdmin(request);
        } catch (error) {
            console.log('[CLEANUP] ⚠️  Admin token not available, skipping cleanup:', error.message);
            return;
        }

        const cleanupClient = new ApiClient(app.urls.api, null, 30_000);
        cleanupClient.setAuthToken(adminApiToken);

        // Delete session
        if (sessionId) {
            try {
                await cleanupClient.delete(`/sessions/${sessionId}`);
                console.log(`[CLEANUP] ✅ Deleted session: ${sessionId}`);
            } catch (e) {
                console.error(`[CLEANUP] ❌ Failed to delete session ${sessionId}:`, e.message);
            }
        }

        // Delete external member
        if (externalMemberId && externalOrgId) {
            try {
                await cleanupClient.delete(`/organizations/${externalOrgId}/members/${externalMemberId}`);
                console.log(`[CLEANUP] ✅ Deleted external member: ${externalMemberId}`);
            } catch (e) {
                console.error(`[CLEANUP] ❌ Failed to delete external member ${externalMemberId}:`, e.message);
            }
        }

        console.log('[CLEANUP] Cleanup complete');
    });
});

// ========================================
// Helper Functions (reused from existing tests)
// ========================================

async function getOrganization(adminClient, organizationName) {
    const orgResp = await adminClient.get('/organizations', {
        params: {
            'fields[organization]': 'id,name',
            filters: JSON.stringify({ name: organizationName })
        }
    });
    const organization = orgResp.data?.data?.[0];
    if (!organization) throw new Error(`Organization not found: ${organizationName}`);
    return organization.id;
}

async function getOrCreateRole(adminClient, roleName, organizationId, scope = 'external') {
    const roleResp = await adminClient.get('/roles', {
        params: {
            'fields[role]': 'id,name,scope,organization',
            filters: JSON.stringify({
                role: { name: roleName }
            })
        }
    });
    let roles = roleResp.data?.data ?? [];
    roles = roles.filter(r =>
        r?.name === roleName
        && r?.scope === scope
        && (!r?.organization || r.organization.id === organizationId)
    );
    if (roles.length === 0) {
        throw new Error(`Role "${roleName}" with scope "${scope}" not found or not assignable to organization ${organizationId}`);
    }
    return roles[0];
}

async function waitForAuthReady(userData, { maxAttempts = 10, delayMs = 2000 } = {}) {
    const tmpClient = new ApiClient(app.urls.api, null, 15_000);
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            await authenticateUser(tmpClient, userData);
            return true;
        } catch (e) {
            if (attempt === maxAttempts) throw e;
            await new Promise(r => setTimeout(r, delayMs));
        }
    }
    return false;
}

async function authenticateUser(apiClient, userData) {
    const { randomUUID } = await import('crypto');
    const authResp = await apiClient.post('/auth', {
        email: userData.email,
        password: userData.password,
        uuid: randomUUID(),
        os: 'web'
    });
    const token = authResp?.data?.data?.token;
    if (!token) throw new Error('No token in auth response');
    return token;
}

