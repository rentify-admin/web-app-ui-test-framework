/**
 * @API Documentation
 * @ticket QA-305 - UI Test - Credit Report UI smoke: section visibility + Run/Rerun triggers (VC-1684)
 */

import path from 'path';
import { test, expect } from '@playwright/test';
import { admin, app } from '../test_config';
import { ApiClient, SessionApi } from '../api';
import loginForm from '../utils/login-form';
import { loginWithAdmin } from '../endpoint-utils/auth-helper';
import { getApplicationByName } from '../endpoint-utils/application-helper';
import { createCurrentStep } from '../endpoint-utils/session-helpers';
import { cleanupSession } from '../utils/cleanup-helper';
import { getRandomEmail, wait } from '../utils/helper';
import { prepareSessionForFreshSelection } from '../utils/session-utils';
import { openReportSection } from '../utils/report-page';
import {
    ensureBackgroundCheckCurrentStep,
    createBackground,
    waitForCreditReportCount
} from '../endpoint-utils/background-check-helpers';

const APP_MANUAL_NAME =
    process.env.CREDIT_BG_APP_MANUAL_NAME ||
    'Autotest - Heartbeat Test - Background Credit - manual';

const SIGNATURE_FILE =
    process.env.CREDIT_BG_SIGNATURE_FILE ||
    path.resolve(process.cwd(), 'tests', 'test_files', 'id-back.png');

let allTestsPassed = true;
let cleanupSessionId = null;

test.describe('QA-305 - Credit Report UI Smoke (VC-1684)', () => {
    test.afterAll(async ({ request }) => {
        await cleanupSession(request, cleanupSessionId, allTestsPassed);
    });

    test('Credit report visibility + Run/Rerun triggers POST/PATCH', {
        tag: ['@qa-305', '@credit', '@regression']
    }, async ({ page }) => {
        test.setTimeout(240_000);

        try {
            // ============================================================
            // Phase 1: API setup (fast, stable)
            // ============================================================
            const adminClient = new ApiClient(app.urls.api, null, 60_000);
            await loginWithAdmin(adminClient);
            const sessionApi = new SessionApi(adminClient);

            const application = await getApplicationByName(adminClient, APP_MANUAL_NAME);
            expect(application?.id).toBeDefined();

            // Create fresh session (manual mode app)
            const user = {
                first_name: 'Credit',
                last_name: 'UI',
                email: getRandomEmail(),
                invite: false,
                application: application.id
            };
            const createRes = await adminClient.post('/sessions', user);
            const created = createRes.data.data;
            expect(created?.id).toBeDefined();
            cleanupSessionId = created.id;

            // Fetch full session for state
            let session = (await sessionApi.retrive(created.id)).data;

            // ============================================================
            // Phase 2: UI - before BG completion, section should be hidden
            // ============================================================
            await loginForm.adminLoginAndNavigate(page, admin);

            const { locator: sessionCard } = await prepareSessionForFreshSelection(page, created.id);
            await Promise.all([
                page.waitForResponse(resp =>
                    resp.url().includes(`/sessions/${created.id}`) &&
                    resp.request().method() === 'GET' &&
                    resp.ok()
                ),
                sessionCard.click()
            ]);

            // Credit Report section should NOT render before Background Check is completed
            await expect(page.getByTestId('credit-report')).toHaveCount(0);

            // ============================================================
            // Phase 3: API - complete Background Check step
            // ============================================================
            session = await ensureBackgroundCheckCurrentStep(sessionApi, session);
            const bgStep = await createCurrentStep(sessionApi, session);

            const background = await createBackground(adminClient, session.id, bgStep.id, {
                firstName: 'Credit',
                lastName: 'UI',
                signatureFilePath: SIGNATURE_FILE
            });
            expect(background?.id).toBeDefined();

            // Mark the Background Check step as COMPLETED so dashboard UI shows Credit Report section
            await sessionApi.step(session.id).update(bgStep.id, { status: 'COMPLETED' });

            // Reload UI and ensure section is now visible
            await Promise.all([
                page.waitForResponse(resp =>
                    resp.url().includes(`/sessions/${created.id}`) &&
                    resp.request().method() === 'GET' &&
                    resp.ok()
                ),
                page.reload()
            ]);

            await expect(page.getByTestId('credit-report')).toBeVisible();
            await expect(page.getByTestId('credit-report-header')).toBeVisible();

            // ============================================================
            // Step 2: Run Credit Report triggers POST (202)
            // ============================================================
            // Ensure empty before clicking Run (manual app should not auto-run)
            const initialCreditReportsRes = await adminClient.get(`/sessions/${session.id}/credit-reports`);
            const initialItems = initialCreditReportsRes?.data?.data || [];
            expect(Array.isArray(initialItems)).toBeTruthy();
            expect(initialItems.length).toBe(0);

            await openReportSection(page, 'credit-report');
            const runBtn = page.getByRole('button', { name: /run credit report/i });

            const [runResp] = await Promise.all([
                page.waitForResponse(resp =>
                    resp.url().includes(`/sessions/${session.id}/credit-reports`) &&
                    resp.request().method() === 'POST'
                ),
                runBtn.click()
            ]);

            expect(runResp.status()).toBe(202);

            // Wait for at least one credit report to exist (API source of truth)
            const reports = await waitForCreditReportCount(adminClient, session.id, { minCount: 1, timeoutMs: 120_000 });
            expect(reports.length).toBeGreaterThanOrEqual(1);

            // ============================================================
            // Step 3: Rerun Credit Report triggers PATCH (202)
            // ============================================================
            // Reload so UI renders report and allows "Show credit details" → rerun button
            const [creditReportsGetResp] = await Promise.all([
                page.waitForResponse(resp =>
                    resp.url().includes(`/sessions/${session.id}/credit-reports`) &&
                    resp.request().method() === 'GET' &&
                    resp.ok()
                , { timeout: 60_000 }),
                page.waitForResponse(resp =>
                    resp.url().includes(`/sessions/${created.id}`) &&
                    resp.request().method() === 'GET' &&
                    resp.ok()
                ),
                page.reload()
            ]);

            expect(creditReportsGetResp).toBeDefined();
            const creditSection = await openReportSection(page, 'credit-report');

            // Expand details so CreditReportButton (rerun) is visible
            // The "Show/Hide credit details" label is localized; avoid text selectors.
            // In the report header, it's the last action button (after "View TransUnion report").
            const firstReportHeader = creditSection.locator('section header').first();
            await expect(firstReportHeader).toBeVisible({ timeout: 60_000 });
            const toggleDetailsBtn = firstReportHeader.locator('button').last();
            await expect(toggleDetailsBtn).toBeVisible();
            await toggleDetailsBtn.click();

            // UI label is "Re-run Credit Report" (with hyphen)
            const rerunBtn = page.getByRole('button', { name: /re-?run credit report/i });
            await expect(rerunBtn).toBeVisible();

            const confirmBox = page.getByTestId('confirm-box');

            const [rerunResp] = await Promise.all([
                page.waitForResponse(resp =>
                    resp.url().includes(`/sessions/${session.id}/credit-reports/`) &&
                    resp.request().method() === 'PATCH'
                ),
                (async () => {
                    await rerunBtn.click();
                    await expect(confirmBox).toBeVisible();
                    await confirmBox.getByTestId('confirm-btn').click();
                })()
            ]);

            expect(rerunResp.status()).toBe(202);

            // Optional sanity: allow time for rerun job to enqueue
            await wait(1000);
        } catch (error) {
            allTestsPassed = false;
            throw error;
        }
    });
});


