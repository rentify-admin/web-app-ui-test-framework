import { expect, test } from '@playwright/test';
import { admin, app, session as sessionConf } from './test_config';
import { ApiClient, ProviderApi, SessionApi } from './api';
import loginForm from './utils/login-form';
import { getEmploymentSimulationMockData } from './mock-data/employment-simulation-mock-data';
import { personaConnectData } from './mock-data/identity-payload';
import {
    createCurrentStep,
    inviteUser,
    loginWithGuestUser,
    simulateVerification,
    waitForStepTransition
} from './endpoint-utils/session-helpers';
import { loginWithAdmin } from './endpoint-utils/auth-helper';
import { getApplicationByName } from './endpoint-utils/application-helper';
import { cleanupTrackedSession } from './utils/cleanup-helper';
import { openReportSection } from './utils/report-page';
import { pollForVerificationStatus } from './utils/polling-helper';
import { joinUrl } from './utils/helper';

// ── Shared API clients — re-authenticated at the start of each test ──────────
const apiClient = new ApiClient(app.urls.api, null, 15000);
const adminSessionApi = new SessionApi(apiClient);

const guestClient = new ApiClient(app.urls.api, null, 15000);
const sessionApi = new SessionApi(guestClient);
const providerApi = new ProviderApi(guestClient);

const { STEP_KEYS } = sessionConf;
const APP_NAME = 'Autotest - Employ Simulation Only';

// ─────────────────────────────────────────────────────────────────────────────
// VC-642: Atomic Employer Name Validation
// Verifies that the employer name is sourced from company.name in the Atomic
// payload (not from jobTitle), both in the UI employment section and in the
// income-sources API response.
// ─────────────────────────────────────────────────────────────────────────────
test.describe('VC-642: Atomic Employer Name Validation', () => {
    test.describe.configure({ mode: 'serial', timeout: 300000 });

    // =========================================================================
    // Test 1: Full Atomic payload — all 4 payload keys present
    // Asserts employer name = company.name ('Atomic Corp'), NOT jobTitle
    // =========================================================================
    const testResults = {
        test1: { sessionId: null, passed: false },
        test2: { sessionId: null, passed: false }
    }

    test.afterAll(async ({ request }, testInfo) => {
        console.log('🧹 [Test 1] Running afterAll cleanup...');
        await cleanupTrackedSession(request, testResults.test1.sessionId, testResults.test1.passed);
        console.log('✅ [Test 1] Cleanup complete');
        console.log('🧹 [Test 2] Running afterAll cleanup...');
        await cleanupTrackedSession(request, testResults.test2.sessionId, testResults.test2.passed);
        console.log('✅ [Test 2] Cleanup complete');
    });

    test(
        'Test 1: Full Atomic payload — employer name from company.name, not jobTitle',
        { tag: ['@regression', '@staging-ready', '@rc-ready'] },
        async ({ page }) => {
            test.setTimeout(300000);

            try {
                // ── Step 1: Admin authentication ──────────────────────────────────
                console.log('\n🔑 [Test 1] Step 1: Authenticating admin via API...');
                await loginWithAdmin(apiClient);
                console.log('✅ [Test 1] Admin authenticated successfully');

                // ── Step 2: Fetch target application ─────────────────────────────
                console.log(`\n🔍 [Test 1] Step 2: Fetching application "${APP_NAME}"...`);
                const application = await getApplicationByName(apiClient, APP_NAME);
                console.log(`✅ [Test 1] Application found: "${application.name}" (id: ${application.id})`);

                // ── Step 3: Invite applicant ──────────────────────────────────────
                const timestamp = Date.now();
                const user = {
                    first_name: 'Atomic',
                    last_name: 'Tester',
                    email: `atomic-full-${timestamp}@verifast.com`
                };
                console.log(`\n👤 [Test 1] Step 3: Inviting user: ${user.email}`);
                let session = await inviteUser(adminSessionApi, application, user);
                testResults.test1.sessionId = session.id;
                const sessionId = session.id;
                console.log(`✅ [Test 1] Session created: ${testResults.test1.sessionId}`);
                console.log(`📎 [Test 1] Invite URL: ${session.url}`);

                // ── Step 4: Guest login ───────────────────────────────────────────
                console.log('\n🔑 [Test 1] Step 4: Logging in as guest applicant...');
                await loginWithGuestUser(guestClient, session.url);
                const guestToken = guestClient.authToken;
                console.log('✅ [Test 1] Guest authenticated, token captured');

                // ── Step 5: Get Simulation provider ───────────────────────────────
                console.log('\n🔌 [Test 1] Step 5: Fetching Simulation provider...');
                const provider = await providerApi.getByName('Simulation');
                console.log(`✅ [Test 1] Simulation provider found (id: ${provider.id})`);

                // ── Step 6: Progress session to employment step ───────────────────
                console.log('\n⚙️  [Test 1] Step 6: Progressing session through pre-employment steps...');
                session = await progressToEmploymentStep(session, sessionApi, guestClient, provider);
                console.log(`✅ [Test 1] Session is now at EMPLOYMENT step (current: ${session.state.current_step?.task?.key})`);

                // ── Step 7: Build full ATOMIC_PAYLOAD (all 4 keys) ───────────────
                console.log('\n🏗️  [Test 1] Step 7: Building full ATOMIC_PAYLOAD...');
                const simulationPayload = getEmploymentSimulationMockData({
                    connectorName: 'Paytomic',
                    companyName: 'Atomic Corp',
                    employment: { jobTitle: 'Senior Engineer' },
                    income: { annualIncome: 72000, payCycle: 'monthly' },
                    statements: { count: 3 }
                });
                const payloadKeys = Object.keys(simulationPayload);
                console.log(`✅ [Test 1] Payload keys: [${payloadKeys.join(', ')}]`);
                console.log(`   FETCH_EMPLOYMENT_IDENTITY company.name: "${simulationPayload.FETCH_EMPLOYMENT_IDENTITY?.response?.data?.[0]?.company?.name}"`);
                console.log(`   FETCH_EMPLOYMENT company.name:          "${simulationPayload.FETCH_EMPLOYMENT?.response?.data?.[0]?.company?.name}"`);
                console.log(`   FETCH_EMPLOYMENT_INCOME company.name:   "${simulationPayload.FETCH_EMPLOYMENT_INCOME?.response?.data?.[0]?.company?.name}"`);
                console.log(`   FETCH_EMPLOYMENT_STATEMENTS company.name: "${simulationPayload.FETCH_EMPLOYMENT_STATEMENTS?.response?.data?.[0]?.company?.name}"`);

                // ── Step 8: Create current employment session step ────────────────
                console.log('\n📋 [Test 1] Step 8: Creating employment session step record...');
                session = (await sessionApi.retrive(session.id)).data;
                const sessionStep = await createCurrentStep(sessionApi, session);
                console.log(`✅ [Test 1] Employment session step created: ${sessionStep.id}`);

                // ── Step 9: POST employment verification ──────────────────────────
                console.log('\n🚀 [Test 1] Step 9: Posting employment verification...');
                const verificationResponse = await guestClient.post('/employment-verifications', {
                    step: sessionStep.id,
                    provider: provider.id,
                    simulation_type: 'ATOMIC_PAYLOAD',
                    custom_payload: simulationPayload
                });
                console.log(`   POST /employment-verifications → HTTP ${verificationResponse.status}`);
                expect(verificationResponse.status).toBe(201);
                const verificationId = verificationResponse.data.data.id;
                console.log(`✅ [Test 1] Verification created (id: ${verificationId}), status: 201`);

                // ── Step 10: Poll until verification COMPLETED ────────────────────
                console.log('\n⏳ [Test 1] Step 10: Polling for verification COMPLETED (max ~100s)...');
                await pollForVerificationStatus(page, verificationId, 'employment-verifications', {
                    maxAttempts: 25,
                    pollInterval: 4000,
                    successStatuses: ['COMPLETED'],
                    failureStatuses: ['FAILED', 'EXPIRED'],
                    apiBaseUrl: app.urls.api,
                    authToken: guestToken
                });
                console.log('✅ [Test 1] Employment verification reached COMPLETED status');

                // ── Step 11: Mark employment step COMPLETED ───────────────────────
                console.log('\n📝 [Test 1] Step 11: Marking employment step as COMPLETED...');
                await sessionApi.step(session.id).update(sessionStep.id, { status: 'COMPLETED' });
                console.log('✅ [Test 1] Employment step marked COMPLETED');

                // ── Step 12: Admin UI login and navigate to session report ─────────
                console.log('\n🔐 [Test 1] Step 12: Admin UI login and report navigation...');
                await loginForm.adminLoginAndNavigate(page, admin);
                const reportUrl = joinUrl(app.urls.app, `applicants/all/${sessionId}`);
                console.log(`   Navigating to: ${reportUrl}`);
                await page.goto(reportUrl);
                await page.waitForLoadState('domcontentloaded');
                console.log('✅ [Test 1] Session report page loaded');

                // ── Step 13: Expand employment section ───────────────────────────
                console.log('\n📋 [Test 1] Step 13: Expanding employment section...');
                const employmentsResponsePromise = page.waitForResponse(
                    resp =>
                        resp.url().includes(`/sessions/${sessionId}/employments`) &&
                        resp.request().method() === 'GET',
                    { timeout: 10_000 }
                ).catch(() => {
                    console.log('   ⚠️  [Test 1] /employments response not captured (may have loaded before listener)');
                    return null;
                });
                await openReportSection(page, 'employment-section');
                await employmentsResponsePromise;
                await expect(page.getByTestId('employment-raw')).toBeVisible({ timeout: 20_000 });
                console.log('✅ [Test 1] Employment section expanded, rows visible');

                // ── Step 14: UI assertion — employer name is company name ─────────
                console.log('\n🔍 [Test 1] Step 14: Verifying employer name in UI...');
                const employerCell = page.locator('[data-testid^="employment-table-employer-cell-"]').first();
                await expect(employerCell).toBeVisible({ timeout: 10_000 });
                const employerText = (await employerCell.textContent())?.trim() ?? '';
                console.log(`   Employer cell text: "${employerText}"`);

                expect(employerText).toContain('Atomic Corp');
                console.log('✅ [Test 1] PASS: Employer cell contains "Atomic Corp" (correct company.name)');

                expect(employerText).not.toContain('Senior Engineer');
                console.log('✅ [Test 1] PASS: Employer cell does NOT contain "Senior Engineer" (jobTitle fallback absent)');

                expect(employerText).not.toBe('Company Name Unavailable');
                console.log('✅ [Test 1] PASS: Employer cell is NOT "Company Name Unavailable" (null fallback absent)');

                // ── Step 15: API assertion — income source description ────────────
                console.log('\n🌐 [Test 1] Step 15: Verifying income source description via API...');
                const incomeSourcesResponse = await apiClient.get(`/sessions/${sessionId}/income-sources`);
                const incomeSources = incomeSourcesResponse.data.data;
                console.log(`   Income sources found: ${incomeSources.length}`);
                incomeSources.forEach(src => {
                    console.log(`   • type: "${src.type}", description: "${src.description}"`);
                });

                const empSource = incomeSources.find(src => src.type === 'EMPLOYMENT_PAYSTUBS');
                expect(empSource, 'Expected an EMPLOYMENT_PAYSTUBS income source').toBeDefined();
                console.log(`   EMPLOYMENT_PAYSTUBS description: "${empSource?.description}"`);

                expect(empSource.description).toBe('Atomic Corp - Senior Engineer');
                console.log('✅ [Test 1] PASS: Income source description = "Atomic Corp - Senior Engineer"');

                expect(empSource.description).not.toBe('Senior Engineer');
                console.log('✅ [Test 1] PASS: Income source description is NOT "Senior Engineer" alone (employer_name populated)');

                console.log('\n🎉 [Test 1] ALL ASSERTIONS PASSED!');
                console.log('   ✓ Employer cell contains "Atomic Corp" (extracted from company.name)');
                console.log('   ✓ Employer cell does NOT fall back to jobTitle "Senior Engineer"');
                console.log('   ✓ Employer cell is NOT "Company Name Unavailable"');
                console.log('   ✓ Income source description = "Atomic Corp - Senior Engineer"');
                console.log('   ✓ Income source description is NOT "Senior Engineer" alone');
                testResults.test1.passed = true;
            } catch (error) {
                console.error('\n❌ [Test 1] Test FAILED:', error.message);
                throw error;
            }
        }
    );

    // =========================================================================
    // Test 2: Missing FETCH_EMPLOYMENT_IDENTITY — regression for VC-642 bug
    // Before the fix: employer_name was null (from missing identity payload),
    // so jobTitle was used as employer. After the fix: company.name is sourced
    // from the remaining FETCH_EMPLOYMENT / FETCH_EMPLOYMENT_INCOME /
    // FETCH_EMPLOYMENT_STATEMENTS payloads.
    // =========================================================================

    test(
        'Test 2: Missing FETCH_EMPLOYMENT_IDENTITY — employer name still from company.name in remaining payloads',
        { tag: ['@regression', '@staging-ready', '@rc-ready'] },
        async ({ page }) => {
            test.setTimeout(300000);

            try {
                // ── Step 1: Admin authentication ──────────────────────────────────
                console.log('\n🔑 [Test 2] Step 1: Authenticating admin via API...');
                await loginWithAdmin(apiClient);
                console.log('✅ [Test 2] Admin authenticated successfully');

                // ── Step 2: Fetch target application ─────────────────────────────
                console.log(`\n🔍 [Test 2] Step 2: Fetching application "${APP_NAME}"...`);
                const application = await getApplicationByName(apiClient, APP_NAME);
                console.log(`✅ [Test 2] Application found: "${application.name}" (id: ${application.id})`);

                // ── Step 3: Invite applicant ──────────────────────────────────────
                const timestamp = Date.now();
                const user = {
                    first_name: 'Noident',
                    last_name: 'Tester',
                    email: `atomic-noident-${timestamp}@verifast.com`
                };
                console.log(`\n👤 [Test 2] Step 3: Inviting user: ${user.email}`);
                let session = await inviteUser(adminSessionApi, application, user);
                testResults.test2.sessionId = session.id;
                const sessionId = session.id;
                console.log(`✅ [Test 2] Session created: ${testResults.test2.sessionId}`);
                console.log(`📎 [Test 2] Invite URL: ${session.url}`);

                // ── Step 4: Guest login ───────────────────────────────────────────
                console.log('\n🔑 [Test 2] Step 4: Logging in as guest applicant...');
                await loginWithGuestUser(guestClient, session.url);
                const guestToken = guestClient.authToken;
                console.log('✅ [Test 2] Guest authenticated, token captured');

                // ── Step 5: Get Simulation provider ───────────────────────────────
                console.log('\n🔌 [Test 2] Step 5: Fetching Simulation provider...');
                const provider = await providerApi.getByName('Simulation');
                console.log(`✅ [Test 2] Simulation provider found (id: ${provider.id})`);

                // ── Step 6: Progress session to employment step ───────────────────
                console.log('\n⚙️  [Test 2] Step 6: Progressing session through pre-employment steps...');
                session = await progressToEmploymentStep(session, sessionApi, guestClient, provider);
                console.log(`✅ [Test 2] Session is now at EMPLOYMENT step (current: ${session.state.current_step?.task?.key})`);

                // ── Step 7: Build ATOMIC_PAYLOAD then DELETE FETCH_EMPLOYMENT_IDENTITY ──
                console.log('\n🏗️  [Test 2] Step 7: Building ATOMIC_PAYLOAD and removing FETCH_EMPLOYMENT_IDENTITY...');
                const simulationPayload = getEmploymentSimulationMockData({
                    connectorName: 'Paytomic',
                    companyName: 'Summit Tech Solutions',
                    employment: { jobTitle: 'Senior Engineer' },
                    income: { annualIncome: 72000, payCycle: 'monthly' },
                    statements: { count: 3 }
                });

                // ⚠️ KEY REGRESSION: Delete FETCH_EMPLOYMENT_IDENTITY before submitting.
                // The VC-642 bug occurred when this payload was missing — employer_name
                // became null and jobTitle was used as the employer. This test verifies
                // the fix: company.name is sourced from the remaining payloads instead.
                // NOTE: Do NOT use completeEmploymentStepViaAtomic from session-generator.js
                // here — it reads FETCH_EMPLOYMENT_IDENTITY.response.data[0].identity at
                // line 513 and would crash when that key is absent.
                console.log('   ⚠️  Deleting FETCH_EMPLOYMENT_IDENTITY key (regression scenario)...');
                delete simulationPayload.FETCH_EMPLOYMENT_IDENTITY;

                const remainingKeys = Object.keys(simulationPayload);
                console.log(`✅ [Test 2] Payload built. Remaining keys: [${remainingKeys.join(', ')}]`);
                console.log(`   FETCH_EMPLOYMENT company.name:          "${simulationPayload.FETCH_EMPLOYMENT?.response?.data?.[0]?.company?.name}"`);
                console.log(`   FETCH_EMPLOYMENT_INCOME company.name:   "${simulationPayload.FETCH_EMPLOYMENT_INCOME?.response?.data?.[0]?.company?.name}"`);
                console.log(`   FETCH_EMPLOYMENT_STATEMENTS company.name: "${simulationPayload.FETCH_EMPLOYMENT_STATEMENTS?.response?.data?.[0]?.company?.name}"`);

                // ── Step 8: Create current employment session step ────────────────
                console.log('\n📋 [Test 2] Step 8: Creating employment session step record...');
                session = (await sessionApi.retrive(session.id)).data;
                const sessionStep = await createCurrentStep(sessionApi, session);
                console.log(`✅ [Test 2] Employment session step created: ${sessionStep.id}`);

                // ── Step 9: POST employment verification (no FETCH_EMPLOYMENT_IDENTITY) ─
                console.log('\n🚀 [Test 2] Step 9: Posting employment verification (without FETCH_EMPLOYMENT_IDENTITY)...');
                const verificationResponse = await guestClient.post('/employment-verifications', {
                    step: sessionStep.id,
                    provider: provider.id,
                    simulation_type: 'ATOMIC_PAYLOAD',
                    custom_payload: simulationPayload
                });
                console.log(`   POST /employment-verifications → HTTP ${verificationResponse.status}`);
                expect(verificationResponse.status).toBe(201);
                const verificationId = verificationResponse.data.data.id;
                console.log(`✅ [Test 2] Verification created (id: ${verificationId}), status: 201`);

                // ── Step 10: Poll until verification COMPLETED ────────────────────
                console.log('\n⏳ [Test 2] Step 10: Polling for verification COMPLETED (max ~100s)...');
                await pollForVerificationStatus(page, verificationId, 'employment-verifications', {
                    maxAttempts: 25,
                    pollInterval: 4000,
                    successStatuses: ['COMPLETED'],
                    failureStatuses: ['FAILED', 'EXPIRED'],
                    apiBaseUrl: app.urls.api,
                    authToken: guestToken
                });
                console.log('✅ [Test 2] Employment verification reached COMPLETED status');

                // ── Step 11: Mark employment step COMPLETED ───────────────────────
                console.log('\n📝 [Test 2] Step 11: Marking employment step as COMPLETED...');
                await sessionApi.step(session.id).update(sessionStep.id, { status: 'COMPLETED' });
                console.log('✅ [Test 2] Employment step marked COMPLETED');

                // ── Step 12: Admin UI login and navigate to session report ─────────
                console.log('\n🔐 [Test 2] Step 12: Admin UI login and report navigation...');
                await loginForm.adminLoginAndNavigate(page, admin);
                const reportUrl = joinUrl(app.urls.app, `applicants/all/${sessionId}`);
                console.log(`   Navigating to: ${reportUrl}`);
                await page.goto(reportUrl);
                await page.waitForLoadState('domcontentloaded');
                console.log('✅ [Test 2] Session report page loaded');

                // ── Step 13: Expand employment section ───────────────────────────
                console.log('\n📋 [Test 2] Step 13: Expanding employment section...');
                const employmentsResponsePromise = page.waitForResponse(
                    resp =>
                        resp.url().includes(`/sessions/${sessionId}/employments`) &&
                        resp.request().method() === 'GET',
                    { timeout: 10_000 }
                ).catch(() => {
                    console.log('   ⚠️  [Test 2] /employments response not captured (may have loaded before listener)');
                    return null;
                });
                await openReportSection(page, 'employment-section');
                await employmentsResponsePromise;
                await expect(page.getByTestId('employment-raw')).toBeVisible({ timeout: 20_000 });
                console.log('✅ [Test 2] Employment section expanded, rows visible');

                // ── Step 14: UI assertion — employer name is company name ─────────
                console.log('\n🔍 [Test 2] Step 14: Verifying employer name in UI (key regression assertion)...');
                const employerCell = page.locator('[data-testid^="employment-table-employer-cell-"]').first();
                await expect(employerCell).toBeVisible({ timeout: 10_000 });
                const employerText = (await employerCell.textContent())?.trim() ?? '';
                console.log(`   Employer cell text: "${employerText}"`);

                expect(employerText).toContain('Summit Tech Solutions');
                console.log('✅ [Test 2] PASS: Employer cell contains "Summit Tech Solutions" (company.name from remaining payloads)');

                // VC-642 regression check: before the fix, 'Senior Engineer' (jobTitle)
                // was used as employer name when FETCH_EMPLOYMENT_IDENTITY was missing.
                expect(employerText).not.toContain('Senior Engineer');
                console.log('✅ [Test 2] PASS: Employer cell does NOT contain "Senior Engineer" (VC-642 regression — jobTitle fallback absent)');

                expect(employerText).not.toBe('Company Name Unavailable');
                console.log('✅ [Test 2] PASS: Employer cell is NOT "Company Name Unavailable" (null fallback absent)');

                // ── Step 15: API assertion — income source description ────────────
                console.log('\n🌐 [Test 2] Step 15: Verifying income source description via API...');
                const incomeSourcesResponse = await apiClient.get(`/sessions/${sessionId}/income-sources`);
                const incomeSources = incomeSourcesResponse.data.data;
                console.log(`   Income sources found: ${incomeSources.length}`);
                incomeSources.forEach(src => {
                    console.log(`   • type: "${src.type}", description: "${src.description}"`);
                });

                const empSource = incomeSources.find(src => src.type === 'EMPLOYMENT_PAYSTUBS');
                expect(empSource, 'Expected an EMPLOYMENT_PAYSTUBS income source').toBeDefined();
                console.log(`   EMPLOYMENT_PAYSTUBS description: "${empSource?.description}"`);

                expect(empSource.description).toBe('Summit Tech Solutions - Senior Engineer');
                console.log('✅ [Test 2] PASS: Income source description = "Summit Tech Solutions - Senior Engineer"');

                // VC-642 regression: before the fix, description was just 'Senior Engineer'
                // because employer_name was null (sourced only from FETCH_EMPLOYMENT_IDENTITY).
                expect(empSource.description).not.toBe('Senior Engineer');
                console.log('✅ [Test 2] PASS: Income source description is NOT "Senior Engineer" alone (employer_name from remaining payloads)');

                console.log('\n🎉 [Test 2] ALL ASSERTIONS PASSED!');
                console.log('   ✓ Employer cell contains "Summit Tech Solutions" (from FETCH_EMPLOYMENT.company.name)');
                console.log('   ✓ Employer cell does NOT fall back to jobTitle "Senior Engineer" (VC-642 regression fixed)');
                console.log('   ✓ Employer cell is NOT "Company Name Unavailable"');
                console.log('   ✓ Income source description = "Summit Tech Solutions - Senior Engineer"');
                console.log('   ✓ Income source description is NOT "Senior Engineer" alone');
                testResults.test2.passed = true;
            } catch (error) {
                console.error('\n❌ [Test 2] Test FAILED:', error.message);
                allTestsPassed = false;
                throw error;
            }
        }
    );
});

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Progress a session through START, IDENTITY, QUESTIONS, and FINANCIAL steps
 * until it reaches the EMPLOYMENT step. Each step is either simulated (IDENTITY)
 * or skipped (QUESTIONS, FINANCIAL). Unknown or absent steps are ignored.
 *
 * @param {Object} session - Session object returned by inviteUser
 * @param {SessionApi} sessionApi - Guest-authenticated SessionApi instance
 * @param {ApiClient} guestClient - Guest-authenticated ApiClient instance
 * @param {Object} provider - Simulation provider object (from providerApi.getByName)
 * @returns {Promise<Object>} Updated session object, positioned at the EMPLOYMENT step
 */
async function progressToEmploymentStep(session, sessionApi, guestClient, provider) {
    // ── START step ───────────────────────────────────────────────────────────
    if (session.state.current_step.type === STEP_KEYS.START) {
        console.log('   📄 [Setup] Handling START step...');
        const sessionStep = await createCurrentStep(sessionApi, session);
        await sessionApi.update(session.id, { target: 2000 });
        await sessionApi.step(session.id).update(sessionStep.id, { status: 'COMPLETED' });
        console.log('   ✅ [Setup] START step completed');
        session = await waitForStepTransition(sessionApi, session, STEP_KEYS.START);
        console.log('   ✅ [Setup] Session transitioned from START step');
    }

    // ── IDENTITY step ────────────────────────────────────────────────────────
    if (session.state.current_step?.task?.key === STEP_KEYS.IDENTITY) {
        console.log('   📄 [Setup] Handling IDENTITY step (PERSONA_PAYLOAD simulation)...');
        const sessionStep = await createCurrentStep(sessionApi, session);
        const identitySimulationData = {
            simulation_type: 'PERSONA_PAYLOAD',
            custom_payload: personaConnectData({
                email: 'dummyuser@test.com',
                first_name: 'Test',
                last_name: 'User'
            })
        };
        await simulateVerification(
            guestClient,
            '/identity-verifications',
            provider,
            sessionStep,
            identitySimulationData,
            'Identity'
        );
        await sessionApi.step(session.id).update(sessionStep.id, { status: 'COMPLETED' });
        console.log('   ✅ [Setup] IDENTITY step completed');
        session = await waitForStepTransition(sessionApi, session, STEP_KEYS.IDENTITY);
        console.log('   ✅ [Setup] Session transitioned from IDENTITY step');
    }

    // ── QUESTIONS step ───────────────────────────────────────────────────────
    if (session.state.current_step?.task?.key === STEP_KEYS.QUESTIONS) {
        console.log('   📄 [Setup] Handling QUESTIONS step (skip)...');
        const sessionStep = await createCurrentStep(sessionApi, session);
        await sessionApi.step(session.id).update(sessionStep.id, { status: 'SKIPPED' });
        console.log('   ✅ [Setup] QUESTIONS step skipped');
        session = await waitForStepTransition(sessionApi, session, STEP_KEYS.QUESTIONS);
        console.log('   ✅ [Setup] Session transitioned from QUESTIONS step');
    }

    // ── FINANCIAL step ───────────────────────────────────────────────────────
    if (session.state.current_step?.task?.key === STEP_KEYS.FINANCIAL) {
        console.log('   📄 [Setup] Handling FINANCIAL step (skip)...');
        const sessionStep = await createCurrentStep(sessionApi, session);
        await sessionApi.step(session.id).update(sessionStep.id, { status: 'SKIPPED' });
        console.log('   ✅ [Setup] FINANCIAL step skipped');
        session = await waitForStepTransition(sessionApi, session, STEP_KEYS.FINANCIAL);
        console.log('   ✅ [Setup] Session transitioned from FINANCIAL step');
    }

    return session;
}
