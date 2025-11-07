import { expect } from '@playwright/test';
import { admin, app, session as sessionConf } from './test_config';
import { test } from './fixtures/enhanced-cleanup-fixture';
import { ApiClient, ApplicantApi, GuestApi, ProviderApi, SessionApi } from './api';
import { getBankStatementData } from './mock-data/high-balance-financial-payload';
import loginForm from './utils/login-form';
import { navigateToSessionById, } from './utils/report-page';
import { waitForJsonResponse } from './utils/wait-response';
import { personaConnectData } from './mock-data/identity-payload';
import { getEmploymentSimulationMockData } from './mock-data/employment-simulation-mock-data';
import { customUrlDecode } from './utils/helper';
import { createCurrentStep, waitForStepTransition } from './endpoint-utils/session-helpers';
import { loginWithAdmin } from './endpoint-utils/auth-helper';
import { getApplicationByName } from './endpoint-utils/application-helper';


const apiClient = new ApiClient(app.urls.api, null, 15000);
const adminSessionApi = new SessionApi(apiClient)

const guestClient = new ApiClient(app.urls.api, null, 15000);
const guestApi = new GuestApi(guestClient)
const sessionApi = new SessionApi(guestClient)
const providerApi = new ProviderApi(guestClient)
const applicantApi = new ApplicantApi(guestClient)
const { STEP_KEYS } = sessionConf;

const appName = 'Autotest - Full flow skip button test';

test.describe('QA-202 flag_review_buttons_flow', () => {


    test('Verify Report Flag Review Buttons Workflow', async ({ page }) => {
        test.setTimeout(200000)

        // Login With Admin
        await loginWithAdmin(apiClient);

        const adminResponse = await apiClient.get('/users/self', {
            params: { 'fields[user]': ':all' }
        })
        const adminUser = adminResponse.data.data

        // Search Application
        const application = await getApplicationByName(apiClient, appName);
        console.log("🚀 ~ application:", application.name)

        // Invite User in application
        const user = {
            first_name: 'ReviewBtn',
            last_name: 'Test',
            email: 'reviewbtn.playwright@verifast.com',
            password: 'password'
        }


        let session = await inviteUser(adminSessionApi, application, user);

        const guarantor = {
            "session": session.id,
            "first_name": "Playwright",
            "last_name": "guarantor",
            "role": "Applicant",
            "email": "guarantor@playwright.com",
            "invite": true
        }

        await loginWithGuestUser(guestClient, session.url)

        // get guest user
        await getGuestUser();

        // update state
        await guestApi.update('self', { administrative_area: "AL", country: "US" })

        await sessionApi.update(session.id, { type: 'affordable_occupant' })

        session = (await sessionApi.retrive(session.id)).data;

        const provider = await providerApi.getByName('Simulation');

        if (session.state.current_step.type === STEP_KEYS.START) {
            console.log('📄 Starting START step...');
            const sessionStep = await createCurrentStep(sessionApi, session);

            // update rent budget
            await sessionApi.update(session.id, { target: 2500 })

            const stepUpdateData = { status: "COMPLETED" };
            await sessionApi.step(session.id).update(sessionStep.id, stepUpdateData);

            console.log('✅ START step completed.');
            session = await waitForStepTransition(sessionApi, session, STEP_KEYS.START);
            console.log('✅ Session transitioned from START step.');
        }


        if (session.state.current_step?.task?.key === STEP_KEYS.APPLICANTS) {
            const sessionStep = await createCurrentStep(sessionApi, session);
            await applicantApi.create(guarantor)
            const stepUpdateData = { status: "COMPLETED" };
            await sessionApi.step(session.id).update(sessionStep.id, stepUpdateData);
            session = await waitForStepTransition(sessionApi, session, STEP_KEYS.APPLICANTS);
        }

        if (session.state.current_step?.task?.key === STEP_KEYS.IDENTITY) {
            const sessionStep = await createCurrentStep(sessionApi, session);

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
            await simulateVerification(guestClient, '/identity-verifications', provider, sessionStep, identitySimulationData, type);

            const stepUpdateData = { status: "COMPLETED" };
            await sessionApi.step(session.id).update(sessionStep.id, stepUpdateData);
            console.log(`✅ ${STEP_KEYS.IDENTITY} step completed.`);
            session = await waitForStepTransition(sessionApi, session, STEP_KEYS.IDENTITY);
            console.log(`✅ Session transitioned from ${STEP_KEYS.IDENTITY} step.`);

        }

        if (session.state.current_step?.task?.key === STEP_KEYS.QUESTIONS) {
            console.log(`📄 Skiping ${STEP_KEYS.QUESTIONS} step...`);
            const sessionStep = await createCurrentStep(sessionApi, session);

            const stepUpdateData = { status: "SKIPPED" };
            await sessionApi.step(session.id).update(sessionStep.id, stepUpdateData);
            console.log(`✅ ${STEP_KEYS.QUESTIONS} step skipped.`);
            session = await waitForStepTransition(sessionApi, session, STEP_KEYS.QUESTIONS);
            console.log(`✅ Session transitioned from ${STEP_KEYS.QUESTIONS} step.`);
        }

        if (session.state.current_step?.task?.key === STEP_KEYS.FINANCIAL) {
            const type = 'financial';
            console.log(`📄 Starting ${STEP_KEYS.FINANCIAL} step...`);
            const sessionStep = await createCurrentStep(sessionApi, session);

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
            session = await waitForStepTransition(sessionApi, session, STEP_KEYS.FINANCIAL);
            console.log(`✅ Session transitioned from ${STEP_KEYS.FINANCIAL} step.`);
        }

        if (session.state.current_step?.task?.key === STEP_KEYS.EMPLOYMENT) {
            const type = 'Employment';
            console.log(`📄 Starting ${STEP_KEYS.EMPLOYMENT} step...`);
            const sessionStep = await createCurrentStep(sessionApi, session);

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
            await simulateVerification(guestClient,'/employment-verifications', provider, sessionStep, docSimulationData, type);

            const stepUpdateData = { status: "COMPLETED" };
            await sessionApi.step(session.id).update(sessionStep.id, stepUpdateData);
            console.log(`✅ ${STEP_KEYS.EMPLOYMENT} step completed.`);
            session = await waitForStepTransition(sessionApi, session, STEP_KEYS.EMPLOYMENT);
            console.log(`✅ Session transitioned from ${STEP_KEYS.EMPLOYMENT} step.`);

        }


        await loginForm.adminLoginAndNavigate(page, admin)

        await navigateToSessionById(page, session.id);

        await expect(page.getByTestId('household-status-alert')).toBeVisible({ timeout: 10_000 });

        const viewDetailsBtn = await page.getByTestId('view-details-btn');

        let flagResponse = await Promise.all([
            page.waitForResponse(buildFlagsFetchPredicate(session.id)),
            viewDetailsBtn.click()
        ]);

        let flags = await waitForJsonResponse(flagResponse[0]);

        await expect(page.getByTestId('report-view-details-flags-section')).toBeVisible();


        const flagSection = await page.getByTestId('report-view-details-flags-section');

        const startReviewBtn = flagSection.getByTestId('flags-start-review-btn');

        await expect(startReviewBtn).toBeVisible({ timeout: 10_000 })

        flagResponse = await Promise.all([
            page.waitForResponse(buildFlagsFetchPredicate(session.id)),
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

        const mmddyy = formatTodayMmDdYyyy();

        const criticalFlag = flags.data.find(flag => flag.severity === 'CRITICAL' && !reviewedFlags.map(({ id }) => id).includes(flag.id) && !flag.ignored);
        await expect(criticalFlag).toBeDefined();
        if (criticalFlag) {
            const flagDiv = await page.locator(`li[id=flag-${criticalFlag.id}]`)
            await flagDiv.getByTestId('mark_as_non_issue').click();
            await expect(flagDiv.locator('#description')).toBeVisible();
            await flagDiv.locator('#description').locator('textarea').fill('Flag 2 not an issue');
            flagResponse = await Promise.all([
                page.waitForResponse(buildFlagsFetchPredicate(session.id)),
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
            page.waitForResponse(buildFlagsFetchPredicate(session.id)),
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

// Helper: standard predicate for waiting flags GET fetch excluding APPLICANT scope
function buildFlagsFetchPredicate(sessionId) {
    return (resp) => {
        try {
            const link = new URL(customUrlDecode(resp.url()));
            if (!link.pathname.includes(`/sessions/${sessionId}/flags`)) return false;
            if (resp.request().method() !== 'GET') return false;
            if (!resp.ok()) return false;
            const params = new URLSearchParams(link.search);
            const rawFilters = params.get('filters');
            const filters = rawFilters ? JSON.parse(rawFilters) : null;
            return filters?.session_flag?.flag?.scope?.$neq === 'APPLICANT';
        } catch (_) {
            return false;
        }
    };
}

// Helper: return today's date formatted as mm/dd/YYYY
function formatTodayMmDdYyyy() {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const yy = String(today.getFullYear());
    return `${mm}/${dd}/${yy}`;
}


async function getGuestUser() {
    const userResponse = await guestApi.retrive('self')
    const guest = userResponse.data;
    return guest;
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