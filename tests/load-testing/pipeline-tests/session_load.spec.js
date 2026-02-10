/**
 * Session Load Test Worker
 *
 * FULL UI FLOW:
 * 1. Admin login via UI
 * 2. Navigate to applications page
 * 3. Find and invite application via UI
 * 4. Fill session form and get invite link
 * 5. Open applicant page (new browser context)
 * 6. Complete START step via UI
 *
 * Used by load-test-runner.js for parallel execution.
 */

import { test, expect } from '@playwright/test';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
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
const WORKER_ID = process.env.LOAD_TEST_WORKER_ID || `session-${Date.now()}`;
const TEST_TYPE = process.env.LOAD_TEST_TYPE || 'session';
const APPLICATION_NAME = process.env.LOAD_TEST_APPLICATION || 'AutoTest Suite - ID Only';
const RESULTS_DIR = process.env.LOAD_TEST_RESULTS_DIR || join(__dirname, '..', 'results');

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
 * Write result to JSON file
 */
function writeResult(result) {
    if (!existsSync(RESULTS_DIR)) {
        mkdirSync(RESULTS_DIR, { recursive: true });
    }
    const filePath = join(RESULTS_DIR, `load_result_${WORKER_ID}.json`);
    writeFileSync(filePath, JSON.stringify(result, null, 2));
}

test.describe('Session Load Test Worker', () => {
    test.describe.configure({ timeout: 600000 }); // 10 min timeout

    let sessionId = null;
    let adminToken = null;
    let applicantContext = null;
    const applicant = generateUniqueApplicant();
    const startTime = Date.now();
    const stepsCompleted = [];
    const errors = [];

    test('Full UI flow: Admin creates session, applicant completes START step', async ({ page, browser }) => {
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
                { prefix: false } // Don't add extra prefix for load test
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

            // Wait for rent budget input (this is the reliable indicator that page is ready)
            const rentBudgetInput = applicantPage.locator('input#rent_budget');
            await rentBudgetInput.waitFor({ state: 'visible', timeout: 30000 });

            // Fill rent budget
            await rentBudgetInput.fill('2500');

            // Submit and wait for API response
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

            // Write failure result
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
        // Cleanup applicant context
        if (applicantContext) {
            try {
                await applicantContext.close();
            } catch (e) {
                console.warn(`[${WORKER_ID}] Failed to close applicant context:`, e.message);
            }
        }

        // Cleanup session via API
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
