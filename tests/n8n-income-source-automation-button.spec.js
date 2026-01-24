import { test, expect } from '@playwright/test'
import { ApiClient } from './api'
import { admin, app } from './test_config'
import { loginWithAdmin } from './endpoint-utils/auth-helper'
import { getApplicationByName } from './endpoint-utils/application-helper'
import { generateUUID, getRandomEmail } from './utils/helper'
import { createSession, getSession } from './endpoint-utils/session-helpers'
import { customVeriDocsBankStatementData } from './mock-data/bank-statement-veridocs-payload'
import { loginWith } from './utils/session-utils'
import { findSessionLocator, openReportSection } from './utils/report-page'
import { cleanupTrackedSession } from './utils/cleanup-helper'

test.describe('QA-258 n8n-income-source-automation-button.spec', () => {

    const adminClient = new ApiClient(app.urls.api, null, 120_000)
    const APPLICATION_NAME = 'Autotest - Simulator Financial Step';
    let session = null;
    let createdSession = null;

    test.beforeAll(async () => {
        console.log('🔐 [Setup] Logging in as admin');
        await loginWithAdmin(adminClient);

        console.log('🔍 [Setup] Fetching application by name:', APPLICATION_NAME);
        const application = await getApplicationByName(adminClient, APPLICATION_NAME);

        const user = {
            first_name: 'Autotest',
            last_name: 'Income Automation',
            email: getRandomEmail()
        }

        console.log('👤 [Setup] Creating new session for user:', user.email);
        const userSession = await createSession(adminClient, user, application.id);

        createdSession = userSession;
        session = userSession;
        console.log(`🆔 [Setup] New session created with ID: ${session.id} and URL: ${session.url}`);

        const sessionUrl = new URL(session.url)
        const params = new URLSearchParams(sessionUrl.search)
        const invitationToken = params.get('token')

        const guestClient = new ApiClient(app.urls.api, null, 120_000);

        console.log('🎫 [Setup] Authenticating guest with invitation token...');
        const guestAuth = (await guestClient.post('/auth/guests', {
            os: 'web',
            token: invitationToken,
            uuid: generateUUID()
        })).data.data;

        await guestClient.setAuthToken(guestAuth.token)

        console.log('💾 [Setup] Fetching session as guest for ID:', session.id);
        session = await getSession(guestClient, session.id)

        console.log('🚦 [Setup] Completing guest info/start step...');
        const startStep = (await guestClient.post(`/sessions/${session.id}/steps`, { step: session.state.current_step.id })).data.data
        await guestClient.patch(`/sessions/${session.id}`, { target: 500 }) // Reported rent
        await guestClient.patch(`/sessions/${session.id}/steps/${startStep.id}`, { status: 'COMPLETED' })

        session = await getSession(guestClient, session.id)
        console.log('💰 [Setup] Completing VERIDOCS simulation financial step...');
        const finacialStep = (await guestClient.post(`/sessions/${session.id}/steps`, { step: session.state.current_step.id })).data.data

        const providers = (await guestClient.get('/providers')).data.data;
        const simulationProvider = providers.find(pro => pro.name === 'Simulation')

        console.log('💸 [Setup] Simulating financial txns: Account $500, 3 payrolls @$2500, 14d apart...');
        const financialVerification = (await guestClient.post('/financial-verifications', {
            step: finacialStep.id,
            provider: simulationProvider.id,
            simulation_type: 'VERIDOCS_PAYLOAD',
            custom_payload: customVeriDocsBankStatementData(user, 3, 'biweekly', 3, {
                debitAmount: 2500,
                creditAmount: 2500,
                startBalance: 500,
            })
        })).data.data

        let verification = null
        let count = 0;
        do {
            verification = (await guestClient.get(`/financial-verifications/${financialVerification.id}`)).data.data
            if (verification.status !== 'COMPLETED') {
                count++;
                if (count > 10) {
                    throw new Error('Timeout: VERIDOCS simulation did not complete.');
                }
                console.log(`⏳ [Setup] Waiting for VERIDOCS verification completion (try ${count})...`);
                await new Promise(resolve => setTimeout(resolve, 3000))
            }
        } while (verification.status !== 'COMPLETED' && count <= 10)

        console.log('✅ [Setup] Completed financial step.');
        await guestClient.patch(`/sessions/${session.id}/steps/${finacialStep.id}`, { status: 'COMPLETED' })

        console.log('🔒 [Setup] Session ready for testing. Session ID:', session.id);
    })

    test('QA-258: Verify Income Source Automation Button and Invocation', async ({ page }) => {
        // -------- Step 1: Navigate to Dashboard Report --------
        console.log('🌐 [Step 1] Navigating to dashboard and logging in as admin...');
        await page.goto('/');
        await loginWith(page, admin);

        const reportUrl = `/applicants/all/${session.id}`;
        console.log('🌎 [Step 1] Navigating to session report page:', reportUrl);
        // Optionally, could: await page.goto(reportUrl);
        const sessionLocator = await findSessionLocator(page, `.application-card[data-session="${session.id}"]`);
        await sessionLocator.click();
        await page.waitForTimeout(2000);

        // Confirm page loaded by checking a landmark in the report
        console.log('🔎 [Step 1] Locating financial section...');
        const incomeSection = await openReportSection(page, 'income-source-section');
        expect(incomeSection).toBeDefined();

        // -------- Step 2: Click Income Source Automation Button and Intercept Request --------
        console.log('⚡ [Step 2] Locating automation button...');
        const automationButton = incomeSection.getByTestId('income-source-automation-button');
        await expect(automationButton, 'Automation button is visible').toBeVisible();
        await expect(automationButton, 'Automation button is enabled').toBeEnabled();
        console.log('▶️ [Step 2] Triggering automation (POST /invocations)...');

        const [automationResp] = await Promise.all([
            page.waitForResponse(resp =>
                resp.url().includes('/invocations') &&
                resp.request().method() === 'POST'
            ),
            automationButton.click()
        ]);

        // -------- Step 3: Verify Request Payload --------
        console.log('🧾 [Step 3] Verifying request payload...');
        await expect(automationResp.ok()).toBeTruthy();

        const requestPayload = JSON.parse(automationResp.request().postData() || '{}');
        // type check
        console.log('🔢 [Step 3] type:', requestPayload.type);
        expect(requestPayload.type, 'Request type must be "income_source_analysis"').toBe('income_source_analysis');

        // sources array check
        expect(Array.isArray(requestPayload.payload?.sources), 'payload.sources must be an array').toBe(true);
        console.log('📋 [Step 3] Number of income sources:', requestPayload.payload?.sources?.length);

        // Source details check
        let payrollCount = 0;
        for (const source of requestPayload.payload.sources) {
            expect(source.type, 'Source type must be EMPLOYMENT_TRANSACTIONS').toBe('EMPLOYMENT_TRANSACTIONS');
            console.log('📝 [Step 3] Source description:', source.description);
            // Accept both 'Payroll-Deposit-APItest' and 'Employment Payroll'
            const isPayrollDesc =
                source.description === 'Payroll-Deposit-APItest' ||
                source.description === 'Employment Payroll';
            expect(isPayrollDesc).toBe(true);
            payrollCount++;
        }
        expect(payrollCount).toBeGreaterThan(0);
        console.log('✅ [Step 3] Request payload structure valid.');

        // -------- Step 4: Verify Response --------
        console.log('📥 [Step 4] Verifying response...');
        expect(automationResp.status(), 'Response must be 201 Created').toBe(201);

        const automationRespBody = (await automationResp.json()).data;
        console.log('🔑 [Step 4] Invocation ID:', automationRespBody.id);
        expect(automationRespBody).toHaveProperty('id');
        expect(typeof automationRespBody.id).toBe('string');
        expect(automationRespBody.id.length).toBeGreaterThan(0);

        console.log('📨 [Step 4] Invocation type:', automationRespBody.type);
        expect(automationRespBody).toHaveProperty('type', 'INCOME_SOURCE_ANALYSIS');

        console.log('📊 [Step 4] Invocation status:', automationRespBody.status);
        expect(automationRespBody).toHaveProperty('status');
        expect(['COMPLETED', 'RUNNING']).toContain(automationRespBody.status);

        console.log('✅ [Step 4] Response contains valid invocation result and metadata.');

    })

    test.afterAll(async ({ request }, testInfo) => {
        console.log('🧹 [Cleanup] Deleting test session ID:', session?.id);
        await cleanupTrackedSession(request, session?.id, testInfo)
    })

})