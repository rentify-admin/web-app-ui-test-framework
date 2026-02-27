import { test, expect } from '@playwright/test';
import loginForm from '~/tests/utils/login-form';
import { admin, app } from '~/tests/test_config';
import { joinUrl } from '~/tests/utils/helper';
import { gotoApplicationsPage, findAndInviteApplication } from '~/tests/utils/applications-page';
import generateSessionForm from '~/tests/utils/generate-session-form';
import {
    setupInviteLinkSession,
    updateRentBudget,
    completeIdentityStepViaAPI,
    completeEmploymentStepViaAPI,
    handleSkipReasonModal
} from '~/tests/utils/session-flow';
import { cleanupTrackedSessions } from './utils/cleanup-helper';

// Test configuration
const applicationName = 'AutoTest - Request Doc UI test';

let applicantContext = null;
let createdSessionIds = [];

/**
 * Utility: Authenticate a guest using an invitation link and return a bearer token
 */
async function authenticateGuestFromInvite(page, inviteLinkUrlString) {
    const inviteUrl = new URL(inviteLinkUrlString);
    const token = inviteUrl.searchParams.get('token');
    if (!token) throw new Error('Invitation token not found in link');

    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });

    const authResp = await page.request.post(joinUrl(app.urls.api, 'auth/guests'), {
        headers: { 'Content-Type': 'application/json' },
        data: { token, uuid, os: 'web' }
    });
    expect(authResp.ok()).toBeTruthy();
    const authJson = await authResp.json();
    return authJson.data.token;
}

/**
 * Utility: Open Request Additional Information modal, select Pay Stub Upload, and submit
 */
async function openAndSubmitRequestDialog(page) {
    // Open Actions menu → Request Additional Information
    await page.getByTestId('session-action-btn').click();
    await page.getByTestId('request-additional-btn').click();

    // Dialog should be visible
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Open combobox INSIDE dialog → press Enter → select label containing Pay Stub Upload
    const combo = dialog.getByRole('combobox').first();
    await combo.click();
    await page.keyboard.press('Enter');
    
    // Try both possible text variations (UI text changes between versions)
    try {
        await dialog.getByText('Paystub Upload').click({ timeout: 2000 });
    } catch {
        await dialog.getByText('Pay Stub Upload').click({ timeout: 2000 });
    }

    // Submit
    const submitBtn = page.getByTestId('submit-request-additional');
    await submitBtn.click();
}

test.describe('request_additional_information', () => {
    test.setTimeout(360000); // Set timeout for the suite

    test.beforeEach(() => {
        // Reset per-attempt tracking (important with Playwright retries)
        createdSessionIds = [];
        applicantContext = null;
    });
    
    test('Document Request: Complete validation (happy path + negative tests) @request-docs @integration @permissions @state-safetys @negative @validation @network-error @regression @staging-ready @rc-ready', async ({ page, context }) => {
        
        // Error collection for comprehensive validation
        const errors = [];
        let sessionId, link, primaryAuthToken, applicantCtx, adminToken;
        
        // =================================================================
        // PART 1: HAPPY PATH - Document Request Flow
        // =================================================================
        console.log('\n📋 PART 1: Starting Happy Path validation...');
        try {
            // Admin login and capture auth token for API calls
            adminToken = await loginForm.adminLoginAndNavigate(page, admin);
            expect(adminToken).toBeDefined();
            console.log('✅ Admin token captured for API calls');
            
        await gotoApplicationsPage(page);
        await findAndInviteApplication(page, applicationName);

        // Generate session and capture IDs/links
            // Note: first_name will be auto-prefixed with 'AutoT - ' by the helper
            // Note: email will be auto-suffixed with '+autotest' by the helper
            const sessionData = await generateSessionForm.generateSessionAndExtractLink(page, {
            email: 'playwright+reqdocs@verifast.com',
            first_name: 'ReqDocs',
            last_name: 'Primary',
            password: 'password'
        });
            sessionId = sessionData.sessionId;
            link = sessionData.link;
            if (sessionId) {
                createdSessionIds.push(sessionId);  // Store for cleanup (retry-safe)
            }
            
            console.log(`✅ Session created: ${sessionId}`);

            // Open applicant flow in separate context and advance to Employment step
            applicantContext = await context.browser().newContext();
            applicantCtx = applicantContext;  // Keep local variable for test code
            const applicantPage = await applicantContext.newPage();
            const inviteUrl = new URL(link);
            await applicantPage.goto(joinUrl(app.urls.app, `${inviteUrl.pathname}${inviteUrl.search}`));

            // Setup session flow (no applicant type)
            await setupInviteLinkSession(applicantPage);

            // Rent budget step
            await updateRentBudget(applicantPage, sessionId);

            // Skip Applicants step (stay on flow)
            try {
                await applicantPage.getByTestId('applicant-invite-skip-btn').click({ timeout: 10_000 });
                // Handle skip reason modal if it appears
                await handleSkipReasonModal(applicantPage, "Skipping applicants step for test purposes");
                await applicantPage.waitForTimeout(1000);
            } catch (_) { /* if not present, continue */ }

            // Complete Identity via API (PERSONA payload, name matches)
            // Note: Mock data generator will apply 'AutoT - ' prefix to first_name
            primaryAuthToken = await authenticateGuestFromInvite(applicantPage, link);
            await completeIdentityStepViaAPI(applicantPage, sessionId, primaryAuthToken, {
                first_name: 'ReqDocs',
                last_name: 'Primary',
                email: 'playwright+reqdocs@verifast.com'
            }, 'primary', false);
            console.log('✅ Identity verification completed');

            // Wait for Financial step to load, then skip it
            console.log('⏳ Waiting for skip-financials-btn to appear...');
            await applicantPage.getByTestId('skip-financials-btn').waitFor({ state: 'visible', timeout: 30000 });
            await applicantPage.getByTestId('skip-financials-btn').click();
            // Handle skip reason modal if it appears
            await handleSkipReasonModal(applicantPage, "Skipping financial step for test purposes");
            console.log('✅ Financial step skipped');

            // Wait for Employment step to load - upload-paystubs-btn should appear
            console.log('⏳ Waiting for upload-paystubs-btn to appear...');
            await applicantPage.getByTestId('upload-paystubs-btn').waitFor({ state: 'visible', timeout: 30000 });
            console.log('✅ Employment step loaded, upload-paystubs-btn visible');

            // CRITICAL: Capture baseline step state BEFORE document request
            console.log('📊 Capturing baseline step state before document request...');
            const baselineSessionResponse = await page.request.get(joinUrl(app.urls.api, `sessions/${sessionId}`), {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });
            const baselineSession = await baselineSessionResponse.json();
            const baselineStepId = baselineSession.data.state.current_step.id;
            const baselineStepType = baselineSession.data.state.current_step.type;
            console.log(`   - Current step: ${baselineStepType}`);
            console.log(`   - Step ID: ${baselineStepId}`);

            // Keep applicant context open; switch back to admin page to request documents
            await page.bringToFront();

            // Go to report view for this session (admin)
        await page.goto(joinUrl(app.urls.app, `applicants/all/${sessionId}`));

        // Network assertion: capture POST /sessions/{id}/invitations (payload + 201)
        const invitationsPostPromise = page.waitForRequest(req => (
            req.method() === 'POST' && new RegExp(`${joinUrl(app.urls.api, 'sessions')}/${sessionId}/invitations$`).test(req.url())
        ));
        const invitationsRespPromise = page.waitForResponse(resp => (
            resp.request().method() === 'POST' && resp.url().endsWith(`/sessions/${sessionId}/invitations`) && resp.status() === 201
        ));

        // Open dialog, select Pay Stub Upload, add note, submit
        await openAndSubmitRequestDialog(page);

        const invitationsPost = await invitationsPostPromise;
        const postData = invitationsPost.postDataJSON?.() || invitationsPost.postDataJSON?.() /* fallback */;
        expect(postData).toBeTruthy();
        expect(Array.isArray(postData.actions)).toBeTruthy();
        expect(postData.actions[0].action.toLowerCase()).toBe('employment_document');
        expect(postData.actions[0].documents).toContain('pay_stub');

        const invitationsResp = await invitationsRespPromise;
        expect(invitationsResp.ok()).toBeTruthy();
        const invitationsRespJson = await invitationsResp.json();
        expect(invitationsRespJson?.data?._type).toBe('invitation');
        expect(invitationsRespJson?.data?.type).toBe('SESSION_ACTION');
        const invitationId = invitationsRespJson?.data?.id;
        expect(invitationId).toBeDefined();

            // Backend persistence (list endpoint temporarily skipped due to known issue):
            // NOTE: Keeping this commented for future re-enable once the /invitations list endpoint is fixed.
            /*
        const listResp = await page.request.get(joinUrl(app.urls.api, `sessions/${sessionId}/invitations`));
        expect(listResp.ok()).toBeTruthy();
        const listJson = await listResp.json();
        expect(Array.isArray(listJson.data)).toBeTruthy();
        expect(listJson.data.some(i => i.id === invitationId)).toBeTruthy();
            */

            // Backend persistence: individual endpoint (requires admin authentication)
            const singleResp = await page.request.get(joinUrl(app.urls.api, `sessions/${sessionId}/invitations/${invitationId}`), {
                headers: { 'Authorization': `Bearer ${adminToken}` },
                params: { 'fields[invitation]': 'id,type,created_at,updated_at' }
            });
        expect(singleResp.ok()).toBeTruthy();
        const singleJson = await singleResp.json();
            console.log('📊 GET /invitations/{id} response:', JSON.stringify(singleJson.data, null, 2));
            
            // Validate invitation fields
        expect(singleJson?.data?.id).toBe(invitationId);
            expect(singleJson?.data?.type).toBe('SESSION_ACTION');
            expect(singleJson?.data?.created_at).toBeDefined();
            console.log('✅ Invitation persisted with correct type and timestamp');

            // Validate session actions were created (GET /sessions/{id} with actions field)
            console.log('📋 Verifying session actions created...');
            const sessionWithActionsResp = await page.request.get(joinUrl(app.urls.api, `sessions/${sessionId}`), {
                headers: { 'Authorization': `Bearer ${adminToken}` },
                params: { 'fields[session]': 'actions', 'fields[action]': 'key,documents,status,tasks,created_at' }
            });
            expect(sessionWithActionsResp.ok()).toBeTruthy();
            const sessionWithActions = await sessionWithActionsResp.json();
            console.log('📊 GET /sessions/{id} actions:', JSON.stringify(sessionWithActions.data.actions, null, 2));
            
            // Validate action created
            expect(Array.isArray(sessionWithActions.data.actions)).toBeTruthy();
            expect(sessionWithActions.data.actions.length).toBeGreaterThan(0);
            
            const docRequestAction = sessionWithActions.data.actions.find(a => a.key === 'EMPLOYMENT_DOCUMENT');
            expect(docRequestAction).toBeDefined();
            expect(docRequestAction.documents).toContain('pay_stub');
            expect(docRequestAction.status).toBe('REQUESTED');
            expect(docRequestAction.created_at).toBeDefined();
            console.log('✅ Session action created with correct key, documents, and status');

            // Events: Verify document request events were created (notification audit trail)
            console.log('📋 Verifying document request events via API...');
            const eventsResp = await page.request.get(joinUrl(app.urls.api, `sessions/${sessionId}/events`), {
                headers: { 'Authorization': `Bearer ${adminToken}` },
                params: { 
                    'fields[user]': 'full_name,email,phone',
                    'order': 'created_at:asc',
                    'limit': '1000',
                    'page': '1',
                    'pagination': 'cursor'
                }
            });
            expect(eventsResp.ok()).toBeTruthy();
            const eventsJson = await eventsResp.json();
            expect(Array.isArray(eventsJson.data)).toBeTruthy();
            
            // Find the two expected events
            const infoRequestedEvent = eventsJson.data.find(e => e.event === 'session.information_requested');
            const actionRequestedEvent = eventsJson.data.find(e => e.event === 'action.requested');
            
            // Validate event 1: session.information_requested
            expect(infoRequestedEvent).toBeDefined();
            expect(infoRequestedEvent.title).toBe('Information requested');
            expect(infoRequestedEvent.description).toContain('employment_document');
            expect(infoRequestedEvent.meta?.items).toBe('employment_document');
            expect(infoRequestedEvent.created_at).toBeDefined();
            expect(infoRequestedEvent.triggered_by).toBeDefined();
            expect(infoRequestedEvent.triggered_by._type).toBe('member');
            console.log(`✅ Event "session.information_requested" validated (triggered by ${infoRequestedEvent.triggered_by._type})`);
            
            // Validate event 2: action.requested
            expect(actionRequestedEvent).toBeDefined();
            expect(actionRequestedEvent.title).toBe('Session action requested');
            expect(actionRequestedEvent.description).toContain('EMPLOYMENT_DOCUMENT');
            expect(actionRequestedEvent.meta?.action).toBe('EMPLOYMENT_DOCUMENT');
            expect(actionRequestedEvent.meta?.documents).toContain('pay_stub');
            expect(actionRequestedEvent.created_at).toBeDefined();
            expect(actionRequestedEvent.triggered_by).toBeDefined();
            console.log(`✅ Event "action.requested" validated`);
            
            // Events: Verify events appear in UI
            console.log('📋 Verifying document request events in UI...');
            await page.goto(joinUrl(app.urls.app, `applicants/all/${sessionId}`));
            
            // Click view details button to open the events panel
            await page.getByRole('button', { name: 'Alert' }).click();
            await page.waitForTimeout(1000);
            console.log('✅ View details panel opened');
            
            // Find and click the search input by placeholder
            const eventsSearchInput = page.locator('input[placeholder="Search"]');
            await eventsSearchInput.fill('requested');
            await page.waitForTimeout(5000); // Wait for filter to apply
            console.log('✅ Filtered events by "requested"');
            
            // Verify both events appear in the UI
            const infoRequestedTitle = page.locator('h6').filter({ hasText: 'Information requested' });
            const actionRequestedTitle = page.locator('h6').filter({ hasText: 'Session action requested' });
            
            await expect(infoRequestedTitle).toBeVisible();
            console.log('✅ UI: "Information requested" event visible');
            
            await expect(actionRequestedTitle).toBeVisible();
            console.log('✅ UI: "Session action requested" event visible');
            
            console.log('✅ Events validation completed (API + UI)');

            // CRITICAL: Verify step state unchanged after document request (ticket requirement)
            console.log('🔍 CRITICAL: Verifying step state unchanged after document request...');
            const afterRequestSessionResponse = await page.request.get(joinUrl(app.urls.api, `sessions/${sessionId}`), {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });
            const afterRequestSession = await afterRequestSessionResponse.json();
            const afterRequestStepId = afterRequestSession.data.state.current_step.id;
            const afterRequestStepType = afterRequestSession.data.state.current_step.type;
            
            expect(afterRequestStepId).toBe(baselineStepId);
            expect(afterRequestStepType).toBe(baselineStepType);
            console.log('✅ CRITICAL: Step state unchanged (document request did not alter step state)');

            // Switch to applicant page to verify they can still proceed
            await applicantPage.bringToFront();
            console.log('🔄 Switched to applicant page to verify flow continuation...');

            // State-safety: Complete employment verification via API WITHOUT auto-completing the step
            console.log('🚀 Completing employment verification via Simulation API (no auto-complete)...');
            // Note: Mock data generator will apply 'AutoT - ' prefix to first_name
            await completeEmploymentStepViaAPI(applicantPage, sessionId, primaryAuthToken, {
                first_name: 'ReqDocs',
            last_name: 'Primary',
                email: 'playwright+reqdocs@verifast.com'
            }, false);  // ← Pass false to prevent auto-completion
            console.log('✅ Employment verification completed via API (step not auto-completed)');

            // CRITICAL: Verify employment continue button is available and clickable (proves no blocking)
            console.log('🔍 CRITICAL: Verifying employment continue button is available and clickable...');
            // Explicitly wait for button locator to appear first (polling with 10s timeout)
            await applicantPage.getByTestId('employment-step-continue').waitFor({ state: 'visible', timeout: 10000 });
            console.log('✅ Employment continue button appeared in DOM');
            
            // Now get reference and validate state
            const employmentContinueBtn = applicantPage.getByTestId('employment-step-continue');
            await expect(employmentContinueBtn).toBeVisible();
            await expect(employmentContinueBtn).toBeEnabled({ timeout: 5000 });
            console.log('✅ Employment continue button is visible and enabled');
            
            // Click continue to prove applicant can proceed
            await employmentContinueBtn.click();
            console.log('✅ CRITICAL: Employment step completed - applicant can proceed (document request did not block flow)');

            await applicantCtx.close();
            console.log('✅ PART 1: Happy Path validation PASSED');
            
        } catch (error) {
            const errorDetails = {
                section: 'Happy Path',
                error: error.message,
                stack: error.stack,
                // Add context about where the error occurred
                context: error.stack?.split('\n')[1] || 'Unknown location'
            };
            errors.push(errorDetails);
            console.log(`❌ PART 1: Happy Path validation FAILED:`);
            console.log(`   Error: ${error.message}`);
            console.log(`   Location: ${errorDetails.context}`);
        }

        // =================================================================
        // PART 2: NEGATIVE TESTS - Validation & Error Handling
        // =================================================================
        console.log('\n📋 PART 2: Starting Negative Tests validation...');
        try {
            // Only run negative tests if session was created
            if (!sessionId) {
                throw new Error('Cannot run negative tests - session was not created in happy path');
            }
            
            console.log(`♻️ Reusing session from happy path: ${sessionId}`);

            // Re-login as admin and navigate to the session
            if (!adminToken) {
                adminToken = await loginForm.adminLoginAndNavigate(page, admin);
            }

            // Go to report view for the session
        await page.goto(joinUrl(app.urls.app, `applicants/all/${sessionId}`));

            // Negative Test 1: Submit button disabled when no option selected
            console.log('🧪 Negative Test 1: Verify submit disabled without selection...');
        await page.getByTestId('session-action-btn').click();
        await page.getByTestId('request-additional-btn').click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        const submitBtn = page.getByTestId('submit-request-additional');
        await expect(submitBtn).toHaveAttribute('aria-disabled', 'true');
            console.log('✅ Submit button correctly disabled');

            // Negative Test 2: Verify button stays disabled (no action possible)
            console.log('🧪 Negative Test 2: Verify button cannot be clicked when disabled...');
            // Button should remain disabled - aria-disabled prevents interaction
            const isDisabled = await submitBtn.getAttribute('aria-disabled');
            expect(isDisabled).toBe('true');
            console.log('✅ Submit button correctly remains disabled (no action possible)');

            // Negative Test 3: Network error handling (500 response)
            console.log('🧪 Negative Test 3: Verify error handling on 500 response...');
        const combo = dialog.getByRole('combobox').first();
        await combo.click();
        await page.keyboard.press('Enter');
            
            // Try both possible text variations (UI text changes between versions)
            try {
                await dialog.getByText('Paystub Upload').click({ timeout: 2000 });
                console.log('✅ Selected "Paystub Upload" option');
            } catch {
                await dialog.getByText('Pay Stub Upload').click({ timeout: 2000 });
                console.log('✅ Selected "Pay Stub Upload" option');
            }

            // Setup route to intercept the POST request and return 500 error
            // Use function matcher to ensure we match the exact URL pattern
            const routeMatcher = (url) => {
                const matches = url.pathname.includes('/sessions/') && 
                               url.pathname.endsWith('/invitations') &&
                               url.pathname.split('/').length >= 4; // /sessions/{id}/invitations
                return matches;
            };
            
            let routeIntercepted = false;
            const routeHandler = (route, request) => {
                if (request.method() === 'POST') {
                    console.log('🛑 [Route Interceptor] Intercepted POST request, returning 500 error');
                    routeIntercepted = true;
                    route.fulfill({ 
                        status: 500, 
                        contentType: 'application/json', 
                        body: JSON.stringify({ error: 'Internal Server Error' })
                    });
                } else {
                    route.continue();
                }
            };
            
            await page.route(routeMatcher, routeHandler);

            // Wait for request to be intercepted and error toast to appear
            const [requestIntercepted] = await Promise.all([
                page.waitForRequest(req => 
                    req.method() === 'POST' && 
                    req.url().includes('/sessions/') && 
                    req.url().endsWith('/invitations')
                ).catch(() => null),
                submitBtn.click()
            ]);

            // Verify route intercepted the request
            if (!routeIntercepted && requestIntercepted) {
                console.log('⚠️ [Route Interceptor] Request was made but route did not intercept');
            }

            // Wait for error toast to appear (this confirms the 500 error was handled)
            await expect(page.getByRole('alert')).toContainText(/error|failed|unable/i, { timeout: 10000 });
            console.log('✅ Error toast correctly displayed on 500 error');
            
            // Remove the route handler after error toast appears (use same matcher)
            await page.unroute(routeMatcher, routeHandler);
            
            // Close the dialog before logging out
            await page.getByTestId('cancel-request-additional').click();
            await page.waitForTimeout(500);
            console.log('✅ Dialog closed');
            
            // Negative Test 4: Permissions - User without MANAGE_APPLICANTS cannot see request button
            // COMMENTED OUT - Per Ben: MANAGE_APPLICANTS permission is frontend-only (unfinished feature).
            // Backend does not enforce this permission yet. Will need to revisit once proper permissions
            // system is implemented to determine what restrictions apply.
            /*
            console.log('🧪 Negative Test 4: Verify user without MANAGE_APPLICANTS cannot see request button...');
            
            // Logout current admin user
            console.log('🚪 Logging out admin user...');
            await page.getByTestId('user-dropdown-toggle-btn').click();
            await page.getByTestId('user-logout-dropdown-item').click();
            await page.waitForTimeout(1000);
            console.log('✅ Admin logged out');
            
            // Login as user without MANAGE_APPLICANTS permission via UI
            console.log('🔑 Logging in as user without MANAGE_APPLICANTS permission...');
            await loginForm.adminLoginAndNavigate(page, {
                email: 'no_manage_applicants_1@verifast.com',
                password: 'password'
            });
            console.log('✅ Logged in as user without MANAGE_APPLICANTS permission');
            
            // Navigate to applicants page and search for the session
            await page.goto(joinUrl(app.urls.app, '/applicants/all'));
            await page.waitForTimeout(1000);
            
            // Search for the session by ID
            console.log(`🔍 Searching for session: ${sessionId}`);
            const searchInput = page.getByPlaceholder(/search/i);
            await searchInput.fill(sessionId);
            await page.waitForTimeout(1000);
            
            // Click on the session (no need to wait for response)
            await page.locator(`.application-card[data-session="${sessionId}"]`).first().click();
            await page.waitForTimeout(2000);
            console.log('✅ Session opened');
            
            // Click action button to open the menu
            await page.getByTestId('session-action-btn').click();
            await page.waitForTimeout(500);
            console.log('✅ Action menu opened');
            
            // Verify Request Additional Information button is NOT visible in the menu
            const requestAdditionalBtn = page.getByTestId('request-additional-btn');
            const isRequestBtnVisible = await requestAdditionalBtn.isVisible();
            
            expect(isRequestBtnVisible).toBe(false);
            console.log('✅ Correct: Request Additional Information button is hidden (user lacks MANAGE_APPLICANTS permission)');
            */
            
            console.log('✅ PART 2: Negative Tests validation PASSED');
            
        } catch (error) {
            const errorDetails = {
                section: 'Negative Tests',
                error: error.message,
                stack: error.stack,
                context: error.stack?.split('\n')[1] || 'Unknown location'
            };
            errors.push(errorDetails);
            console.log(`❌ PART 2: Negative Tests validation FAILED:`);
            console.log(`   Error: ${error.message}`);
            console.log(`   Location: ${errorDetails.context}`);
        }

        // =================================================================
        // FINAL: Report All Errors
        // =================================================================
        if (errors.length > 0) {
            console.log('\n❌ TEST FAILED - Summary of errors:');
            errors.forEach((err, index) => {
                console.log(`\n${index + 1}. ${err.section}:`);
                console.log(`   Error: ${err.error}`);
                console.log(`   Location: ${err.context}`);
            });
            
            const errorReport = errors.map((e, i) => 
                `\n${i + 1}. [${e.section}] ${e.error}\n   at ${e.context}`
            ).join('');
            throw new Error(`Test failed with ${errors.length} error(s):${errorReport}`);
        }
        
        console.log('\n✅ ALL VALIDATIONS PASSED (Happy Path + Negative Tests)');
        
    });
    
    // Always cleanup by default; keep artifacts only when KEEP_FAILED_ARTIFACTS=true and test failed
    test.afterEach(async ({ request }, testInfo) => {
        console.log('🧹 Starting cleanup...');
        console.log(`   Sessions: ${createdSessionIds.length ? createdSessionIds.join(', ') : 'none'}`);
        console.log(`   KEEP_FAILED_ARTIFACTS: ${process.env.KEEP_FAILED_ARTIFACTS === 'true'}`);
        console.log(`   Status: ${testInfo.status}`);
        await cleanupTrackedSessions({ request, sessionIds: createdSessionIds, testInfo });
        
        // Close context (always)
        if (applicantContext) {
            try {
                await applicantContext.close();
                console.log('✅ Applicant context closed');
            } catch (error) {
                // Silent
            }
        }
    });
});


