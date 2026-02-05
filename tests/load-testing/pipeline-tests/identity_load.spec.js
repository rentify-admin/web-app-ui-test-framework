/**
 * Identity Load Test Worker
 *
 * FULL UI FLOW:
 * 1. Admin login via UI
 * 2. Navigate to applications page
 * 3. Find and invite application via UI
 * 4. Fill session form and get invite link
 * 5. Open applicant page (new browser context)
 * 6. Complete START step via UI
 * 7. Upload identity files via Files provider (API)
 * 8. Wait for verification completion
 *
 * Used by load-test-runner.js for parallel execution.
 */

import { test, expect } from '@playwright/test';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Import existing utilities
import loginForm from '~/tests/utils/login-form';
import { gotoApplicationsPage, findAndInviteApplication } from '~/tests/utils/applications-page';
import generateSessionForm from '~/tests/utils/generate-session-form';
import { handleModalsWithRaceConditionFix } from '~/tests/utils/session-flow';
import { admin, app } from '~/tests/test_config';
import { joinUrl } from '~/tests/utils/helper';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get worker configuration from environment
const WORKER_ID = process.env.LOAD_TEST_WORKER_ID || `identity-${Date.now()}`;
const TEST_TYPE = process.env.LOAD_TEST_TYPE || 'identity';
const APPLICATION_NAME = process.env.LOAD_TEST_APPLICATION || 'AutoTest Suite - ID Only';
const RESULTS_DIR = process.env.LOAD_TEST_RESULTS_DIR || join(__dirname, '..', 'results');

// Test files
const TEST_FILES_DIR = join(__dirname, '..', 'test-files');
const ID_FRONT_PATH = join(TEST_FILES_DIR, 'ID Front.png');
const ID_BACK_PATH = join(TEST_FILES_DIR, 'ID Back.png');

/**
 * Generate unique applicant data
 */
function generateUniqueApplicant() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return {
        first_name: `Load${random}`,
        last_name: 'Test',
        email: `loadtest-${TEST_TYPE}-${timestamp}-${random}@verifast.app`
    };
}

/**
 * Generate UUID v4
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Write result to JSON file
 */
function writeResult(result) {
    if (!existsSync(RESULTS_DIR)) {
        mkdirSync(RESULTS_DIR, { recursive: true });
    }
    const filePath = join(RESULTS_DIR, `load_result_${WORKER_ID}.json`);
    writeFileSync(filePath, JSON.stringify(result, null, 2));
}

/**
 * Poll for condition with timeout
 */
async function pollFor(fn, description, maxAttempts = 30, interval = 2000) {
    for (let i = 0; i < maxAttempts; i++) {
        const result = await fn();
        if (result) {
            console.log(`[${WORKER_ID}] ${description} - Success after ${i + 1} attempts`);
            return result;
        }
        if (i % 5 === 0) {
            console.log(`[${WORKER_ID}] ${description} - Attempt ${i + 1}/${maxAttempts}`);
        }
        await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error(`${description} - Timeout after ${maxAttempts} attempts`);
}

test.describe('Identity Load Test Worker', () => {
    test.describe.configure({ timeout: 600000 }); // 10 min timeout

    let sessionId = null;
    let adminToken = null;
    let guestToken = null;
    let applicantContext = null;
    const applicant = generateUniqueApplicant();
    const startTime = Date.now();
    const stepsCompleted = [];
    const errors = [];

    test('Full UI flow: Admin creates session, applicant uploads identity files', async ({ page, browser, request }) => {
        try {
            // ============================================================
            // PHASE 1: Admin Login via UI
            // ============================================================
            console.log(`[${WORKER_ID}] PHASE 1: Admin login via UI...`);
            adminToken = await loginForm.adminLoginAndNavigate(page, admin);
            expect(adminToken).toBeTruthy();
            stepsCompleted.push('admin_login');
            console.log(`[${WORKER_ID}] Admin logged in successfully`);

            // ============================================================
            // PHASE 2: Navigate to Applications Page
            // ============================================================
            console.log(`[${WORKER_ID}] PHASE 2: Navigating to applications page...`);
            await gotoApplicationsPage(page);
            stepsCompleted.push('applications_page');
            console.log(`[${WORKER_ID}] On applications page`);

            // ============================================================
            // PHASE 3: Find and Invite Application
            // ============================================================
            console.log(`[${WORKER_ID}] PHASE 3: Finding application: ${APPLICATION_NAME}...`);
            await findAndInviteApplication(page, APPLICATION_NAME);
            stepsCompleted.push('invite_modal_opened');
            console.log(`[${WORKER_ID}] Invite modal opened`);

            // ============================================================
            // PHASE 4: Generate Session via Form
            // ============================================================
            console.log(`[${WORKER_ID}] PHASE 4: Generating session for ${applicant.email}...`);
            const { sessionId: createdSessionId, link } = await generateSessionForm.generateSessionAndExtractLink(
                page,
                applicant,
                { prefix: false }
            );
            sessionId = createdSessionId;
            expect(sessionId).toBeTruthy();
            expect(link).toBeTruthy();
            stepsCompleted.push('session_created');
            console.log(`[${WORKER_ID}] Session created: ${sessionId}`);

            // ============================================================
            // PHASE 5: Open Applicant Page (New Browser Context)
            // ============================================================
            console.log(`[${WORKER_ID}] PHASE 5: Opening applicant page...`);
            applicantContext = await browser.newContext();
            const applicantPage = await applicantContext.newPage();

            const linkUrl = new URL(link);
            const fullUrl = joinUrl(app.urls.app, `${linkUrl.pathname}${linkUrl.search}`);
            await applicantPage.goto(fullUrl, { waitUntil: 'domcontentloaded' });
            stepsCompleted.push('applicant_page_opened');
            console.log(`[${WORKER_ID}] Applicant page opened`);

            // Get guest token from URL for API calls
            const guestTokenFromUrl = linkUrl.searchParams.get('token');

            // Authenticate guest
            console.log(`[${WORKER_ID}] Authenticating guest...`);
            const guestAuthResponse = await request.post(`${app.urls.api}/auth/guests`, {
                data: {
                    token: guestTokenFromUrl,
                    uuid: generateUUID(),
                    os: 'web'
                }
            });
            expect(guestAuthResponse.ok()).toBeTruthy();
            const guestAuthData = await guestAuthResponse.json();
            guestToken = guestAuthData.data?.token || guestAuthData.token;
            expect(guestToken).toBeTruthy();
            console.log(`[${WORKER_ID}] Guest authenticated`);

            // ============================================================
            // PHASE 5.5: Handle Modals (State + Terms)
            // ============================================================
            console.log(`[${WORKER_ID}] PHASE 5.5: Handling modals (state + terms)...`);
            await handleModalsWithRaceConditionFix(applicantPage);
            stepsCompleted.push('modals_handled');
            console.log(`[${WORKER_ID}] Modals handled`);

            // ============================================================
            // PHASE 6: Complete START Step (Rent Budget)
            // ============================================================
            console.log(`[${WORKER_ID}] PHASE 6: Completing START step...`);

            const rentBudgetInput = applicantPage.locator('input#rent_budget');
            await rentBudgetInput.waitFor({ state: 'visible', timeout: 30000 });
            await rentBudgetInput.fill('2500');

            await Promise.all([
                applicantPage.waitForResponse(resp =>
                    resp.url().includes(`/sessions/${sessionId}`) &&
                    resp.request().method() === 'PATCH' &&
                    resp.ok()
                ),
                applicantPage.locator('button[type="submit"]').click()
            ]);

            stepsCompleted.push('start_completed');
            console.log(`[${WORKER_ID}] START step completed`);

            // ============================================================
            // PHASE 7: Get Session State and Files Provider
            // ============================================================
            console.log(`[${WORKER_ID}] PHASE 7: Getting session state and Files provider...`);

            const sessionResponse = await request.get(`${app.urls.api}/sessions/${sessionId}`, {
                headers: { Authorization: `Bearer ${guestToken}` }
            });
            expect(sessionResponse.ok()).toBeTruthy();
            const sessionState = await sessionResponse.json();
            const currentStep = sessionState.data.state?.current_step;
            console.log(`[${WORKER_ID}] Current step: ${currentStep?.type || 'unknown'}`);

            // Get Files provider
            const providersResponse = await request.get(`${app.urls.api}/providers`, {
                headers: { Authorization: `Bearer ${guestToken}` }
            });
            expect(providersResponse.ok()).toBeTruthy();
            const providersData = await providersResponse.json();
            const filesProvider = providersData.data.find(p => p.name === 'Files');
            expect(filesProvider).toBeTruthy();
            console.log(`[${WORKER_ID}] Files provider: ${filesProvider.id}`);

            // ============================================================
            // PHASE 8: Create Session Step and Upload Files
            // ============================================================
            console.log(`[${WORKER_ID}] PHASE 8: Creating session step...`);

            const stepResponse = await request.post(`${app.urls.api}/sessions/${sessionId}/steps`, {
                headers: { Authorization: `Bearer ${guestToken}` },
                data: { step: currentStep.id }
            });
            expect(stepResponse.ok()).toBeTruthy();
            const stepData = await stepResponse.json();
            const step = stepData.data;
            console.log(`[${WORKER_ID}] Session step created: ${step.id}`);

            // Upload identity files
            console.log(`[${WORKER_ID}] Uploading identity files...`);

            const idFrontBuffer = readFileSync(ID_FRONT_PATH);
            const idBackBuffer = readFileSync(ID_BACK_PATH);

            // Upload front
            const uploadFrontResponse = await request.post(`${app.urls.api}/identity-verifications`, {
                headers: { Authorization: `Bearer ${guestToken}` },
                multipart: {
                    step: step.id,
                    provider: filesProvider.id,
                    'files[]': {
                        name: 'ID Front.png',
                        mimeType: 'image/png',
                        buffer: idFrontBuffer
                    }
                }
            });
            expect(uploadFrontResponse.ok()).toBeTruthy();
            console.log(`[${WORKER_ID}] Front ID uploaded`);

            // Upload back
            const uploadBackResponse = await request.post(`${app.urls.api}/identity-verifications`, {
                headers: { Authorization: `Bearer ${guestToken}` },
                multipart: {
                    step: step.id,
                    provider: filesProvider.id,
                    'files[]': {
                        name: 'ID Back.png',
                        mimeType: 'image/png',
                        buffer: idBackBuffer
                    }
                }
            });
            expect(uploadBackResponse.ok()).toBeTruthy();
            console.log(`[${WORKER_ID}] Back ID uploaded`);
            stepsCompleted.push('files_uploaded');

            // ============================================================
            // PHASE 9: Poll for Verification Completion
            // ============================================================
            console.log(`[${WORKER_ID}] PHASE 9: Polling for verification completion...`);

            await pollFor(async () => {
                const verificationResponse = await request.get(`${app.urls.api}/identity-verifications`, {
                    headers: { Authorization: `Bearer ${adminToken}` },
                    params: {
                        'filters': JSON.stringify({
                            '$has': { 'step': { 'session_id': { '$in': [sessionId] } } }
                        }),
                        'fields[verification]': 'id,status,type'
                    }
                });

                if (!verificationResponse.ok()) return false;
                const data = await verificationResponse.json();
                const verification = data.data?.[0];
                return verification?.status === 'COMPLETED';
            }, 'Identity verification completion', 45, 2000);

            stepsCompleted.push('identity_verified');
            console.log(`[${WORKER_ID}] Identity verification completed`);

            // Mark step as completed
            await request.patch(`${app.urls.api}/sessions/${sessionId}/steps/${step.id}`, {
                headers: { Authorization: `Bearer ${guestToken}` },
                data: { status: 'COMPLETED' }
            });
            stepsCompleted.push('step_completed');

            // Close applicant page
            await applicantPage.close();

            // Write success result
            writeResult({
                workerId: WORKER_ID,
                type: TEST_TYPE,
                startTime: new Date(startTime).toISOString(),
                endTime: new Date().toISOString(),
                duration: Date.now() - startTime,
                status: 'passed',
                sessionId,
                applicantEmail: applicant.email,
                stepsCompleted,
                errors
            });

            console.log(`[${WORKER_ID}] Test completed successfully`);

        } catch (error) {
            console.error(`[${WORKER_ID}] Test failed:`, error.message);
            errors.push(error.message);

            writeResult({
                workerId: WORKER_ID,
                type: TEST_TYPE,
                startTime: new Date(startTime).toISOString(),
                endTime: new Date().toISOString(),
                duration: Date.now() - startTime,
                status: 'failed',
                sessionId,
                applicantEmail: applicant.email,
                stepsCompleted,
                errors
            });

            throw error;
        }
    });

    test.afterAll(async ({ request }) => {
        if (applicantContext) {
            try {
                await applicantContext.close();
            } catch (e) {
                console.warn(`[${WORKER_ID}] Failed to close applicant context:`, e.message);
            }
        }

        if (sessionId && adminToken) {
            try {
                console.log(`[${WORKER_ID}] Cleaning up session: ${sessionId}`);
                await request.delete(`${app.urls.api}/sessions/${sessionId}`, {
                    headers: { Authorization: `Bearer ${adminToken}` }
                });
                console.log(`[${WORKER_ID}] Session deleted`);
            } catch (e) {
                console.warn(`[${WORKER_ID}] Cleanup failed:`, e.message);
            }
        }
    });
});
