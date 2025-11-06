import { expect } from '@playwright/test';
import { admin, app, user, session as sessionConf } from './test_config';
import { test } from './fixtures/enhanced-cleanup-fixture';
import { ApiClient, ApplicantApi, FinancialVerificationApi, GuestApi, ProviderApi, SessionApi } from './api';
import { getBankStatementData, highBalanceBankStatementData } from './mock-data/high-balance-financial-payload';
import loginForm from './utils/login-form';
import { navigateToSessionById, } from './utils/report-page';
import { waitForJsonResponse } from './utils/wait-response';
import { personaConnectData } from './mock-data/identity-payload';
import { getEmploymentSimulationMockData } from './mock-data/employment-simulation-mock-data';
import { customUrlDecode } from './utils/helper';


let globalDataManager = null;
let apiClient = new ApiClient(app.urls.api, null, 15000);
const adminSessionApi = new SessionApi(apiClient)

let guestClient = new ApiClient(app.urls.api, null, 15000);
const guestApi = new GuestApi(guestClient)
const sessionApi = new SessionApi(guestClient)
const providerApi = new ProviderApi(guestClient)
const financialApi = new FinancialVerificationApi(guestClient)
const applicantApi = new ApplicantApi(guestClient)
const { STEP_KEYS } = sessionConf;
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const appName = 'Autotest - Full flow skip button test';


test.describe('QA-202 flag_review_buttons_flow', () => {


    test('Verify Report Flag Review Buttons Workflow', async ({ page, dataManager }) => {
        test.setTimeout(200000)
        // Create simulation for session create for flag verify
        globalDataManager = dataManager;

        // Login With Admin
        await loginWithAdmin(dataManager);

        const adminResponse = await apiClient.get('/users/self', {
            params: { 'fields[user]': ':all' }
        })
        const adminUser = adminResponse.data.data

        // Search Application
        const application = await getApplicationByName(appName);
        console.log("🚀 ~ application:", application.name)

        // Invite User in application
        const user = {
            first_name: 'ReviewBtn',
            last_name: 'Test',
            email: 'reviewbtn.playwright@verifast.com',
            password: 'password'
        }


        let session = await inviteUser(application, user);

        const guarantor = {
            "session": session.id,
            "first_name": "Playwright",
            "last_name": "guarantor",
            "role": "Applicant",
            "email": "guarantor@playwright.com",
            "invite": true
        }

        await loginWithGuestUser(session.url, dataManager)

        // get guest user
        const guest = await getGuestUser();

        // update state
        await guestApi.update('self', { administrative_area: "AL", country: "US" })

        await sessionApi.update(session.id, { type: 'affordable_occupant' })

        session = (await sessionApi.retrive(session.id)).data;

        const provider = await providerApi.getByName('Simulation');

        if (session.state.current_step.type === STEP_KEYS.START) {
            console.log('📄 Starting START step...');
            const stepData = { step: session.state.current_step.id };
            const sessionStep = (await sessionApi.step(session.id).create(stepData)).data;

            // update rent budget
            await sessionApi.update(session.id, { target: 2500 })

            const stepUpdateData = { status: "COMPLETED" };
            await sessionApi.step(session.id).update(sessionStep.id, stepUpdateData);

            console.log('✅ START step completed.');
            session = await waitForStepTransition(session, STEP_KEYS.START);
            console.log('✅ Session transitioned from START step.');
        }


        if (session.state.current_step?.task?.key === STEP_KEYS.APPLICANTS) {
            const stepData = { step: session.state.current_step.id };
            const sessionStep = (await sessionApi.step(session.id).create(stepData)).data;
            await applicantApi.create(guarantor)
            const stepUpdateData = { status: "COMPLETED" };
            await sessionApi.step(session.id).update(sessionStep.id, stepUpdateData);
            session = await waitForStepTransition(session, STEP_KEYS.APPLICANTS);
        }

        if (session.state.current_step?.task?.key === STEP_KEYS.IDENTITY) {
            const stepData = { step: session.state.current_step.id };
            const sessionStep = (await sessionApi.step(session.id).create(stepData)).data;

            const data = personaConnectData({
                email: 'dummyuser@test.com',
                first_name: 'Test',
                last_name: 'User'
            })

            const identitySimulationData = {
                simulation_type: 'PERSONA_PAYLOAD',
                custom_payload: data
            }
            const type = "Identity"
            await simulateVerification('/identity-verifications', provider, sessionStep, identitySimulationData, type);

            const stepUpdateData = { status: "COMPLETED" };
            await sessionApi.step(session.id).update(sessionStep.id, stepUpdateData);
            console.log(`✅ ${STEP_KEYS.IDENTITY} step completed.`);
            session = await waitForStepTransition(session, STEP_KEYS.IDENTITY);
            console.log(`✅ Session transitioned from ${STEP_KEYS.IDENTITY} step.`);

        }

        if (session.state.current_step?.task?.key === STEP_KEYS.QUESTIONS) {
            console.log(`📄 Skiping ${STEP_KEYS.QUESTIONS} step...`);
            const stepData = { step: session.state.current_step.id };
            const sessionStep = (await sessionApi.step(session.id).create(stepData)).data;

            const stepUpdateData = { status: "SKIPPED" };
            await sessionApi.step(session.id).update(sessionStep.id, stepUpdateData);
            console.log(`✅ ${STEP_KEYS.QUESTIONS} step skipped.`);
            session = await waitForStepTransition(session, STEP_KEYS.QUESTIONS);
            console.log(`✅ Session transitioned from ${STEP_KEYS.QUESTIONS} step.`);
        }

        if (session.state.current_step?.task?.key === STEP_KEYS.FINANCIAL) {
            const type = 'financial';
            console.log(`📄 Starting ${STEP_KEYS.FINANCIAL} step...`);
            const stepData = { step: session.state.current_step.id };
            const sessionStep = (await sessionApi.step(session.id).create(stepData)).data;

            const docData = getBankStatementData(user, 1)
            docData.documents[0].documents[0].data.accounts[0].balance_total_end = 20000;
            docData.documents[0].documents[0].data.accounts[0].transactions[1].balance = 1000000;
            docData.documents[0].documents[0].data.accounts[0].transactions[2].date = getNDaysAgoDate(2);
            docData.documents[0].documents[0].data.accounts[0].transactions[2].type = 'debit';
            docData.documents[0].documents[0].data.accounts[0].transactions[2].amount = -500;
            docData.documents[0].documents[0].data.accounts[0].transactions[2].description = 'Shoping';
            docData.documents[0].documents[0].data.accounts[0].transactions[4].type = 'debit';
            docData.documents[0].documents[0].data.accounts[0].transactions[4].amount = -1000;
            docData.documents[0].documents[0].data.accounts[0].transactions[4].description = 'Travel';

            const docSimulationData = {
                simulation_type: 'VERIDOCS_PAYLOAD',
                custom_payload: docData
            }
            // await simulateVerification('/financial-verifications', provider, sessionStep, docSimulationData, type);


            // const mxSimulationData = {
            //     simulation_type: 'CUSTOM_PAYLOAD',
            //     custom_payload: getCustomPayload({ email: 'dummyemail@test.com', first_name: 'test', last_name: 'user' })
            // }

            // await simulateVerification('/financial-verifications', provider, sessionStep, mxSimulationData, type);

            const stepUpdateData = { status: "SKIPPED" };
            await sessionApi.step(session.id).update(sessionStep.id, stepUpdateData);
            console.log(`✅ ${STEP_KEYS.FINANCIAL} step completed.`);
            session = await waitForStepTransition(session, STEP_KEYS.FINANCIAL);
            console.log(`✅ Session transitioned from ${STEP_KEYS.FINANCIAL} step.`);
        }

        if (session.state.current_step?.task?.key === STEP_KEYS.EMPLOYMENT) {
            const type = 'Employment';
            console.log(`📄 Starting ${STEP_KEYS.FINANCIAL} step...`);
            const stepData = { step: session.state.current_step.id };
            const sessionStep = (await sessionApi.step(session.id).create(stepData)).data;

            const simulationPayload = getEmploymentSimulationMockData({
                connectorName: 'Paytomic',
                companyName: 'SIG Developments LLC',
                income: { annualIncome: 72000, currentPayPeriodStart: daysAgo(35), payCycle: 'monthly' },
                statements: { count: 3, hoursPerPeriod: 32, hourlyRate: 16.5, netFactor: 0.77 }
            });

            const docSimulationData = {
                simulation_type: 'ATOMIC_PAYLOAD',
                custom_payload: simulationPayload
            }
            await simulateVerification('/employment-verifications', provider, sessionStep, docSimulationData, type);

            const stepUpdateData = { status: "COMPLETED" };
            await sessionApi.step(session.id).update(sessionStep.id, stepUpdateData);
            console.log(`✅ ${STEP_KEYS.EMPLOYMENT} step completed.`);
            session = await waitForStepTransition(session, STEP_KEYS.EMPLOYMENT);
            console.log(`✅ Session transitioned from ${STEP_KEYS.EMPLOYMENT} step.`);

        }


        await loginForm.adminLoginAndNavigate(page, admin)

        await navigateToSessionById(page, session.id);

        await expect(page.getByTestId('household-status-alert')).toBeVisible({ timeout: 10_000 });

        const viewdetail = await page.getByTestId('view-details-btn');

        let flagResponse = await Promise.all([
            page.waitForResponse(resp => {
                const link = new URL(customUrlDecode(resp.url()))
                const params = new URLSearchParams(link.search)
                const filters = JSON.parse(params.get('filters'))
                return link.pathname.includes(`/sessions/${session.id}/flags`)
                    && filters?.session_flag?.flag?.scope?.$neq === "APPLICANT"
                    && resp.request().method() === 'GET'
                    && resp.ok()
            }),
            viewdetail.click()
        ]);

        let flags = await waitForJsonResponse(flagResponse[0]);

        await expect(page.getByTestId('report-view-details-flags-section')).toBeVisible();


        const flagSection = await page.getByTestId('report-view-details-flags-section');

        const startReviewBtn = flagSection.getByTestId('flags-start-review-btn');

        await expect(startReviewBtn).toBeVisible({ timeout: 10_000 })

        flagResponse = await Promise.all([
            page.waitForResponse(resp => {
                const link = new URL(customUrlDecode(resp.url()))
                const params = new URLSearchParams(link.search)
                const filters = JSON.parse(params.get('filters'))
                return link.pathname.includes(`/sessions/${session.id}/flags`)
                    && filters?.session_flag?.flag?.scope?.$neq === "APPLICANT"
                    && resp.request().method() === 'GET'
                    && resp.ok()
            }
            ),
            // flags.data.map(item =>
            //     page.waitForResponse(resp =>
            //         resp.url().includes(`/sessions/${session.id}/flags/${item.id}`)
            //         && resp.request().method() === 'PATCH'
            //         && resp.ok(),
            //         {
            //             timeout: 10_000
            //         }
            //     )
            // ),
            startReviewBtn.click()
        ])

        flags = await waitForJsonResponse(flagResponse[0]);

        const completeReview = page.getByTestId('flags-complete-review-btn')
        await expect(completeReview).toBeVisible();

        for (let index = 0; index < flags.data.length; index++) {
            const element = flags.data[index];
            await expect(element.in_review).toBeTruthy();
        }

        for (let index = 0; index < flags.data.length; index++) {
            const element = flags.data[index];
            await expect(page.locator(`li[id=flag-${element.id}]`)).toContainText(`In review by: ${adminUser.full_name}`, { timeout: 20_000 })
        }

        const reviewedFlags = [];

        const errorFlag = flags.data.find(flag => flag.severity === 'ERROR' && !flag.ignored);
        await expect(errorFlag).toBeDefined()

        if (errorFlag) {
            const flagDiv = await page.locator(`li[id=flag-${errorFlag.id}]`)
            await flagDiv.getByTestId('mark_as_issue').click();

            await expect(flagDiv.locator('#description')).toBeVisible();
            await flagDiv.locator('#description').locator('textarea').fill('Flag 1 marked as issue during automated test');
            await flagDiv.locator('[type="submit"]').click();
            reviewedFlags.push(errorFlag)

            const iciSection = page.getByTestId('items-causing-decline-section');

            const newFlagDiv = iciSection.locator(`li[id=flag-${errorFlag.id}]`)
            await expect(newFlagDiv).toBeVisible({ timeout: 20_000 })
            await expect(newFlagDiv).toContainText('Flag 1 marked as issue during automated test', { timeout: 20_000 })
            // NOTE: item is still in review so reviewed by not showing now
        }

        // Get today's date in mm/dd/YYYY format
        const today = new Date();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const yy = String(today.getFullYear());
        const mmddyy = `${mm}/${dd}/${yy}`;

        const criticalFlag = flags.data.find(flag => flag.severity === 'CRITICAL' && !reviewedFlags.map(({ id }) => id).includes(flag.id) && !flag.ignored);
        await expect(criticalFlag).toBeDefined();
        if (criticalFlag) {
            const flagDiv = await page.locator(`li[id=flag-${criticalFlag.id}]`)
            await flagDiv.getByTestId('mark_as_non_issue').click();
            await expect(flagDiv.locator('#description')).toBeVisible();
            await flagDiv.locator('#description').locator('textarea').fill('Flag 2 not an issue');
            flagResponse = await Promise.all([
                page.waitForResponse(resp => {
                    const link = new URL(customUrlDecode(resp.url()))
                    const params = new URLSearchParams(link.search)
                    const filters = params.get('filters') && JSON.parse(params.get('filters'))
                    return link.pathname.includes(`/sessions/${session.id}/flags`)
                        && filters?.session_flag?.flag?.scope?.$neq === "APPLICANT"
                        && resp.request().method() === 'GET'
                        && resp.ok()
                }
                ),
                flagDiv.locator('[type="submit"]').click()
            ])
            flags = await waitForJsonResponse(flagResponse[0]);
            reviewedFlags.push(criticalFlag)

            const riSection = page.getByTestId('reviewed-items-section');
            const newFlagDiv = riSection.locator(`li[id=flag-${criticalFlag.id}]`)
            await expect(newFlagDiv).toBeVisible()
            await expect(newFlagDiv).toContainText('Flag 2 not an issue', { timeout: 20_000 })

            await expect(newFlagDiv).toContainText(`Reviewed by: ${adminUser.full_name} ${mmddyy}`, { timeout: 20_000 });
        }

        const otherCriticalFlag = flags.data.find(flag => flag.severity === 'CRITICAL' && !reviewedFlags.map(({ id }) => id).includes(flag.id) && !flag.ignored);
        await expect(otherCriticalFlag).toBeDefined();
        if (otherCriticalFlag) {
            const flagDiv = await page.locator(`li[id=flag-${otherCriticalFlag.id}]`)
            await flagDiv.getByTestId('mark_as_non_issue').click();
            await flagDiv.locator('[type="submit"]').click();
            reviewedFlags.push(otherCriticalFlag)

            const riSection = page.getByTestId('reviewed-items-section');
            const newFlagDiv = riSection.locator(`li[id=flag-${otherCriticalFlag.id}]`)
            await expect(newFlagDiv).toBeVisible()

            // Get today's date in mm/dd/YYYY format


            await expect(newFlagDiv).toContainText(`Reviewed by: ${adminUser.full_name} ${mmddyy}`, { timeout: 20_000 });
        }

        const completeReviewBtn = await page.getByTestId('flags-complete-review-btn');

        completeReviewBtn.click();

        const confirmModal = page.getByTestId('complete-review-confirm-modal')

        await expect(confirmModal).toBeVisible();

        await page.waitForTimeout(3000);
        flagResponse = await Promise.all([
            page.waitForResponse(resp => {
                const link = new URL(customUrlDecode(resp.url()))
                const params = new URLSearchParams(link.search)
                const filters = params.get('filters') && JSON.parse(params.get('filters'))
                return link.pathname.includes(`/sessions/${session.id}/flags`)
                    && filters?.session_flag?.flag?.scope?.$neq === "APPLICANT"
                    && resp.request().method() === 'GET'
                    && resp.ok()
            }),
            confirmModal.getByTestId('review-confirm-ok-btn').click()
        ])
        flags = await waitForJsonResponse(flagResponse[0]);

        for (let index = 0; index < flags.data.length; index++) {
            const element = flags.data[index];
            await expect(element.in_review).toBeFalsy();
        }

        for (let index = 0; index < flags.data.length; index++) {
            const element = flags.data[index];
            await expect(page.locator(`li[id=flag-${element.id}]`)).toContainText(`Reviewed by: ${adminUser.full_name} ${mmddyy}`, { timeout: 20_000 })
        }


        // Checking event history

        const eventResponse = await apiClient.get(`/sessions/${session.id}/events`, {
            params: {
                order: 'created_at:desc',
                limit: 50,
                page: 1,
                all: true,
                'fields[user]': "full_name,email,phone"
            }
        })

        let events = eventResponse.data.data;
        events = events.filter(evt => !!evt.meta && evt.title === 'Flag reviewed');

        for (let index = 0; index < reviewedFlags.length; index++) {
            const element = reviewedFlags[index];
            await expect(events.some(evt => evt?.meta?.flag === element.flag.key)).toBeTruthy()
        }
    });

})

async function simulateVerification(verificationUrl, provider, step, simulationData, type) {
    console.log(`✅ Simulation provider found: ${provider.id}`);
    const uploadData = {
        step: step.id,
        provider: provider.id,
        ...simulationData
    };

    console.log(`⏳ Uploading ${simulationData.simulation_type} payload for ${type} verification...`);
    console.log('📊 Payload being sent:', JSON.stringify(simulationData.custom_payload, null, 2));

    const response = (await guestClient.post(verificationUrl, uploadData)).data;

    console.log(`✅ Session transitioned from ${STEP_KEYS.FINANCIAL} step.`);
    console.log(`✅ ${simulationData.simulation_type} payload uploaded for ${type} verification.`);
    await waitForVerificationComplete(verificationUrl, step, response, simulationData, type);
}

async function waitForVerificationComplete(verificationUrl, step, response, simulationData, type, maxAttempts = 15,) {
    const verification = response.data;
    console.log(`📊 Created verification ID: ${verification.id}`);

    const filters = JSON.stringify({ $has: { step: { id: step.id } }, status: { $neq: "EXPIRED" } });

    let verifications, count = 0;
    console.log(`⏳ Waiting for ${type} ${simulationData.simulation_type} verification to complete...`);
    await wait(10000);

    do {
        verifications = (await guestClient.get(verificationUrl, { params: { filters } })).data.data;
        console.log(`📊 Found ${verifications.length} verifications for step ${step.id}`);

        // Log all verification statuses for debugging
        verifications.forEach(v => {
            console.log(`   - Verification ${v.id}: ${v.status} (Target: ${verification.id})`);
        });

        // Check if our verification exists and get its status
        const ourVerification = verifications.find((v) => v.id === verification.id);
        if (ourVerification) {
            console.log(`🎯 Our verification ${verification.id} current status: ${ourVerification.status}`);

            // If it's COMPLETED, break immediately
            if (ourVerification.status === "COMPLETED") {
                console.log(`✅ Our verification completed successfully!`);
                break;
            }

            // If it's in error state, break immediately to fail the test
            if (ourVerification.status === "USER_ERROR" || ourVerification.status === "FAILED") {
                console.log(`❌ Our verification failed with status: ${ourVerification.status}`);
                break;
            }
        } else {
            console.log(`❌ Our verification ${verification.id} not found in current verifications`);
        }

        await wait(4000);
        count++;
        console.log(`⏳ Polling ${type} ${simulationData.simulation_type} verification... attempt ${count}/15`);
    } while (count < maxAttempts);

    console.log('📄 Analyzing verification results...');

    // Find OUR specific verification (the one we created)
    const ourVerification = verifications.find((v) => v.id === verification.id);

    if (!ourVerification) {
        console.log(`❌ ${type} ${simulationData.simulation_type} verification not found.`);
        console.log('📊 All verifications found:');
        verifications.forEach(v => console.log(`   - ${v.id}: ${v.status}`));
        throw new Error(`❌ ${type} verification (${simulationData.simulation_type}) not found - test should fail`);
    }

    console.log(`🎯 Our verification ${verification.id} final status: ${ourVerification.status}`);

    // Only pass if OUR verification is COMPLETED
    if (ourVerification.status === "COMPLETED") {
        console.log(`✅ ${type} ${simulationData.simulation_type} verification completed successfully.`);
        console.log('✅ Completed verification details:', JSON.stringify(ourVerification, null, 2));
    } else if (ourVerification.status === "PROCESSING") {
        console.log(`❌ ${type} ${simulationData.simulation_type} verification stuck in PROCESSING status.`);
        console.log('❌ Processing verification details:', JSON.stringify(ourVerification, null, 2));
        throw new Error(`❌ ${type} verification (${simulationData.simulation_type}) stuck in PROCESSING status - test should fail`);
    } else if (ourVerification.status === "USER_ERROR") {
        console.log(`❌ ${type} ${simulationData.simulation_type} verification failed with USER_ERROR status.`);
        console.log('❌ User error verification details:', JSON.stringify(ourVerification, null, 2));
        throw new Error(`❌ ${type} verification (${simulationData.simulation_type}) failed with USER_ERROR status - test should fail`);
    } else if (ourVerification.status === "FAILED") {
        console.log(`❌ ${type} ${simulationData.simulation_type} verification failed.`);
        console.log('❌ Failed verification details:', JSON.stringify(ourVerification, null, 2));
        throw new Error(`❌ ${type} verification (${simulationData.simulation_type}) failed`);
    } else {
        console.log(`❌ ${type} ${simulationData.simulation_type} verification in unexpected status: ${ourVerification.status}`);
        console.log('❌ Verification details:', JSON.stringify(ourVerification, null, 2));
        throw new Error(`❌ ${type} verification (${simulationData.simulation_type}) in unexpected status: ${ourVerification.status} - test should fail`);
    }

    console.log('✅ Verification analysis completed');
}

async function waitForStepTransition(session, fromKey, maxAttempts = 15) {
    try {
        let count = 0;
        do {
            session = (await sessionApi.retrive(session.id)).data;
            if (session.state.current_step?.task?.key === fromKey) {
                await wait(2000);
            }
            count++;
        } while (session.state.current_step?.task?.key === fromKey && count < maxAttempts);
        return session;
    } catch (error) {
        console.log("Error in waitForStepTransition", JSON.stringify({
            file: "tests/flag_review_buttons_flow.spec.js",
            function: "waitForStepTransition",
            error: error.message,
            stack: error.stack
        }));

        throw error;
    }
}

async function getGuestUser() {
    const userResponse = await guestApi.retrive('self')
    const guest = userResponse.data;
    return guest;
}


async function loginWithGuestUser(sessionUrl, manager) {
    try {
        const inviteUrl = new URL(sessionUrl);
        const token = inviteUrl.searchParams.get('token');
        console.log("Logging in with invitation token");
        guestClient.resetAuthToken()
        const guestLoginResponse = await guestClient.post('/auth/guests', {
            token,
            uuid: manager.generateUUID(),
            os: 'web'
        })
        const authToken = guestLoginResponse.data.data.token;
        console.log("🚀 ~ loginWithGuestUser ~ authToken:", authToken)
        guestClient.setAuthToken(authToken);
        console.log("Login successful");
    } catch (error) {
        console.error("Error in loginWithTokenUrl " + JSON.stringify({
            file: "tests/helpers/session-step-helper.js",
            function: "loginWithTokenUrl",
            error: error.message,
            stack: error.stack
        }));

        throw error;
    }

}

async function inviteUser(application, user) {
    const sessionResponse = await adminSessionApi.create({
        ...user,
        invite: true,
        application: application.id
    })

    const session = sessionResponse.data;
    await expect(session).toBeDefined()

    return session;

}


async function loginWithAdmin(manager) {
    const adminLoginResponse = await apiClient.post(`/auth`, {
        email: admin.email,
        password: admin.password,
        uuid: manager.generateUUID(),
        os: 'web'
    });
    const authToken = adminLoginResponse.data.data.token;
    console.log("🚀 ~ loginWithAdmin ~ authToken:", authToken)
    if (!authToken) {
        throw new Error('Failed to get auth token from login response');
    }
    await apiClient.setAuthToken(authToken);
    console.log('✅ Admin login successful, token retrieved');
    return authToken;
}

async function getApplicationByName(appName) {

    const applicationResponse = await apiClient.get('/applications', {
        params: {
            filters: JSON.stringify({
                application: {
                    name: appName
                }
            }),
            limit: 10
        }
    })

    const applications = applicationResponse.data.data;
    await expect(applications.length).toBeGreaterThan(0)

    return applications[0]
}

function getNDaysAgoDate(n) {
    const date = new Date();
    date.setDate(date.getDate() - n);
    return date.toISOString().split('T')[0];
}

function daysAgo(days) {
    const currentDate = new Date();
    const fortyFiveDaysAgo = new Date(currentDate);
    fortyFiveDaysAgo.setDate(currentDate.getDate() - days);
    return fortyFiveDaysAgo.toISOString().split('T')[0]
}

function getCustomPayload(user) {

    return {
        id: "AUTOGENERATE",
        institutions: [{
            name: "Test Bank",
            accounts: [{
                id: "AUTOGENERATE",
                account_number: "1234567890",
                name: "Checking Account",
                type: "checking",
                balance: 5000.00, // $5,000 in cents
                currency: "USD",
                owner: {
                    first_name: user.first_name,
                    last_name: user.last_name,
                    email: user.email,
                    address: {
                        street: "123 Test St",
                        city: "Test City",
                        state: "CA",
                        postal_code: "90210",
                        country: "US"
                    }
                },
                transactions: [
                    {
                        id: "AUTOGENERATE",
                        date: getNDaysAgoDate(400),
                        amount: 4000.00, // $4,000 in cents
                        description: "Payroll Deposit Employment",
                        category: "income"
                    },
                    {
                        id: "AUTOGENERATE",
                        date: getNDaysAgoDate(350),
                        amount: 4000.00, // $4,000 in cents
                        description: "Payroll Deposit Employment",
                        category: "income"
                    },
                    {
                        id: "AUTOGENERATE",
                        date: getNDaysAgoDate(300),
                        amount: 4000.00, // $4,000 in cents
                        description: "Payroll Deposit Employment",
                        category: "income"
                    }
                ]
            }]
        }]
    }
}