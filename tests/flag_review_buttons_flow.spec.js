import { expect, test } from '@playwright/test';
import { admin, app, session as sessionConf } from './test_config';
import { ApiClient, ApplicantApi, GuestApi, ProviderApi, SessionApi } from './api';
import { getBankStatementData } from './mock-data/high-balance-financial-payload';
import loginForm from './utils/login-form';
import { navigateToSessionByIdAndGetFlags } from './utils/report-page';
import { waitForJsonResponse } from './utils/wait-response';
import { personaConnectData } from './mock-data/identity-payload';
import { getEmploymentSimulationMockData } from './mock-data/employment-simulation-mock-data';
import { customUrlDecode } from './utils/helper';
import { createCurrentStep, inviteUser, loginWithGuestUser, simulateVerification, waitForStepTransition } from './endpoint-utils/session-helpers';
import { loginWithAdmin } from './endpoint-utils/auth-helper';
import { getApplicationByName } from './endpoint-utils/application-helper';
import { cleanupSessionAndContexts } from './utils/cleanup-helper';


const apiClient = new ApiClient(app.urls.api, null, 15000);
const adminSessionApi = new SessionApi(apiClient)

const guestClient = new ApiClient(app.urls.api, null, 15000);
const guestApi = new GuestApi(guestClient)
const sessionApi = new SessionApi(guestClient)
const providerApi = new ProviderApi(guestClient)
const applicantApi = new ApplicantApi(guestClient)
const { STEP_KEYS } = sessionConf;

let allTestsPassed = true;
let cleanpSessionId = null;

const appName = 'Autotest - Full flow skip button test';

test.describe('QA-202 flag_review_buttons_flow', () => {

    test('Verify Report Flag Review Buttons Workflow', { tag: ['@regression', '@staging-ready', '@rc-ready'] }, async ({ page }) => {
        test.setTimeout(200000)

        try {

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
            }


            let session = await inviteUser(adminSessionApi, application, user);

            cleanpSessionId = session.id;
            const guarantor = {
                "session": session.id,
                "first_name": "Playwright",
                "last_name": "guarantor",
                "role": "Applicant",
                "email": "guarantor.playwright@verifast.com",
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
                await simulateVerification(guestClient, '/employment-verifications', provider, sessionStep, docSimulationData, type);

                const stepUpdateData = { status: "COMPLETED" };
                await sessionApi.step(session.id).update(sessionStep.id, stepUpdateData);
                console.log(`✅ ${STEP_KEYS.EMPLOYMENT} step completed.`);
                session = await waitForStepTransition(sessionApi, session, STEP_KEYS.EMPLOYMENT);
                console.log(`✅ Session transitioned from ${STEP_KEYS.EMPLOYMENT} step.`);

            }


            await loginForm.adminLoginAndNavigate(page, admin)

            // ✅ SMART FIX: Deselect session first to ensure fresh API calls
            // Navigate to applicants inbox
            const applicantsMenu = page.getByTestId('applicants-menu');
            const isMenuOpen = await applicantsMenu.evaluate(el => el.classList.contains('sidebar-item-open'));
            if (!isMenuOpen) {
                await page.waitForTimeout(1000);
                await applicantsMenu.click({ force: true });
                await page.waitForTimeout(1000);
            }
            
            // Click applicants submenu (use .first() to handle duplicate elements)
            await page.getByTestId('applicants-submenu').first().click();
            
            // Wait for sessions to be loaded in the UI
            await page.waitForTimeout(2000);

            // Click a different session card first to deselect if target session is already selected
            // This ensures that clicking the target session will trigger the API call
            const allSessionCards = page.locator('.application-card');
            const sessionCount = await allSessionCards.count();
            
            if (sessionCount > 1) {
                // Find and click a session that is NOT our target session
                for (let i = 0; i < Math.min(sessionCount, 5); i++) {
                    const card = allSessionCards.nth(i);
                    const sessionId = await card.getAttribute('data-session');
                    
                    if (sessionId && sessionId !== session.id) {
                        console.log(`🔄 Clicking different session first to deselect: ${sessionId.substring(0, 25)}...`);
                        await card.click();
                        await page.waitForTimeout(2000); // Wait for page to load
                        console.log('✅ Different session opened - target session is now deselected');
                        break;
                    }
                }
            }

            // Navigate to session and capture flags response from page load
            // This function will try to get flags automatically, or click View Details if needed
            let flags = await navigateToSessionByIdAndGetFlags(page, session.id, buildFlagsFetchPredicate);

            // Wait for Alert button to be visible (indicates report page is loaded)
            // Note: household-status-alert is only visible inside the Alert modal, so we wait for the button instead
            await expect(page.getByRole('button', { name: 'Alert' })).toBeVisible({ timeout: 10_000 });

            // Ensure View Details section is open (might already be open from navigateToSessionByIdAndGetFlags)
            const flagSectionVisible = await page.getByTestId('report-view-details-flags-section').isVisible().catch(() => false);
            
            if (!flagSectionVisible) {
                console.log('🔍 Opening View Details section...');
                const alertBtn = await page.getByRole('button', { name: 'Alert' });
                await alertBtn.click();
            } else {
                console.log('✅ View Details section already open');
            }

            await expect(page.getByTestId('report-view-details-flags-section')).toBeVisible();

            const flagSection = await page.getByTestId('report-view-details-flags-section');

            const startReviewBtn = flagSection.getByTestId('flags-start-review-btn');

            await expect(startReviewBtn).toBeVisible({ timeout: 10_000 })

            let flagResponse = await Promise.all([
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

            // Review Flag #1: Find and mark ERROR flag as issue
            const errorFlag = flags.data.find(flag => flag.severity === 'ERROR' && !flag.ignored);
            console.log(`🔍 Available flags - Total: ${flags.data.length}, ERROR: ${flags.data.filter(f => f.severity === 'ERROR' && !f.ignored).length}, CRITICAL: ${flags.data.filter(f => f.severity === 'CRITICAL' && !f.ignored).length}`);
            
            if (errorFlag) {
                console.log('✅ Found ERROR flag to review');
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
            } else {
                console.log('⚠️  No ERROR flag found, skipping ERROR flag review');
            }

            const mmddyy = formatTodayMmDdYyyy();

            // Review Flag #2: Find first CRITICAL flag and mark as non-issue
            const criticalFlag = flags.data.find(flag => flag.severity === 'CRITICAL' && !reviewedFlags.map(({ id }) => id).includes(flag.id) && !flag.ignored);
            
            if (criticalFlag) {
                console.log('✅ Found first CRITICAL flag to review');
                const flagDiv = await page.locator(`li[id=flag-${criticalFlag.id}]`)
                await flagDiv.getByTestId('mark_as_non_issue').click();
                await expect(flagDiv.locator('#description')).toBeVisible();
                await flagDiv.locator('#description').locator('textarea').fill('Flag 2 not an issue');
                let flagResponse = await Promise.all([
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
            } else {
                console.log('⚠️  No CRITICAL flag found, skipping first CRITICAL flag review');
            }

            // Review Flag #3: Find second CRITICAL flag and mark as non-issue (if exists)
            console.log(`🔍 After Flag #2 review - Total flags: ${flags.data.length}, Already reviewed: ${reviewedFlags.length}`);
            const otherCriticalFlag = flags.data.find(flag => flag.severity === 'CRITICAL' && !reviewedFlags.map(({ id }) => id).includes(flag.id) && !flag.ignored);
            
            if (otherCriticalFlag) {
                console.log('✅ Found second CRITICAL flag to review');
                const flagDiv = await page.locator(`li[id=flag-${otherCriticalFlag.id}]`)
                await flagDiv.getByTestId('mark_as_non_issue').click();
                await flagDiv.locator('[type="submit"]').click();
                reviewedFlags.push(otherCriticalFlag)

                const riSection = page.getByTestId('reviewed-items-section');
                const newFlagDiv = riSection.locator(`li[id=flag-${otherCriticalFlag.id}]`)
                await expect(newFlagDiv).toBeVisible()

                await expect(newFlagDiv).toContainText(`Reviewed by: ${adminUser.full_name} ${mmddyy}`, { timeout: 20_000 });
            } else {
                console.log('⚠️  No second CRITICAL flag found, skipping. This is OK - continuing with available flags.');
            }

            // Ensure we reviewed at least 1 flag before completing review
            if (reviewedFlags.length === 0) {
                throw new Error('❌ No flags were reviewed! Test cannot continue.');
            }
            console.log(`✅ Total flags reviewed: ${reviewedFlags.length}`);

            const completeReviewBtn = await page.getByTestId('flags-complete-review-btn');

            await completeReviewBtn.click();

            const confirmModal = page.getByTestId('complete-review-confirm-modal')

            await expect(confirmModal).toBeVisible();

            await page.waitForTimeout(3000);
            
            // Click confirm button
            await confirmModal.getByTestId('review-confirm-ok-btn').click();
            console.log('✅ Clicked "Confirm" button to complete review');

            // Poll flags API until all flags have in_review: false (max 15 seconds)
            console.log('🔄 Polling flags API until all flags are marked as completed (max 15s)...');
            const maxPollingAttempts = 30; // 30 * 500ms = 15 seconds
            let allFlagsCompleted = false;
            let pollingAttempt = 0;

            while (pollingAttempt < maxPollingAttempts && !allFlagsCompleted) {
                pollingAttempt++;
                
                // Fetch flags via API
                const flagsApiResponse = await apiClient.get(`/sessions/${session.id}/flags`, {
                    params: {
                        filters: JSON.stringify({
                            session_flag: { flag: { scope: { $neq: 'APPLICANT' } } }
                        })
                    }
                });
                
                flags = flagsApiResponse.data;
                
                // Check if ALL flags have in_review: false
                const flagsStillInReview = flags.data.filter(f => f.in_review === true);
                
                if (flagsStillInReview.length === 0) {
                    allFlagsCompleted = true;
                    console.log(`✅ All flags completed after ${pollingAttempt * 500}ms (${pollingAttempt} attempts)`);
                } else {
                    console.log(`   ⏳ Attempt ${pollingAttempt}/${maxPollingAttempts}: ${flagsStillInReview.length} flag(s) still in_review=true, waiting 500ms...`);
                    await page.waitForTimeout(500);
                }
            }

            if (!allFlagsCompleted) {
                throw new Error(`❌ Timeout: Not all flags completed after 15 seconds. ${flags.data.filter(f => f.in_review).length} flag(s) still have in_review=true`);
            }

            // Verify ALL flags have in_review: false
            for (let index = 0; index < flags.data.length; index++) {
                const element = flags.data[index];
                await expect(element.in_review).toBeFalsy();
            }

            for (let index = 0; index < reviewedFlags.length; index++) {
                const element = reviewedFlags[index];
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
        } catch (error) {
            console.error('❌ Test failed:', error.message);
            allTestsPassed = false;
            throw error;
        }
    });

    test.afterAll(async ({ request }) => {
        await cleanupSessionAndContexts(
            request,
            cleanpSessionId,
            null,
            null,  // No admin context
            allTestsPassed
        )
    })

})

// Helper: standard predicate for waiting flags GET fetch excluding APPLICANT scope
function buildFlagsFetchPredicate(sessionId) {
    return (resp) => {
        try {
            const url = resp.url();
            const decodedUrl = customUrlDecode(url);
            const link = new URL(decodedUrl);
            
            // Check path matches flags endpoint for this session
            if (!link.pathname.includes(`/sessions/${sessionId}/flags`)) return false;
            if (resp.request().method() !== 'GET') return false;
            if (!resp.ok()) return false;
            
            // Parse filters from URL
            const params = new URLSearchParams(link.search);
            const rawFilters = params.get('filters');
            if (!rawFilters) return false;
            
            // Try parsing the filters - handle both URL-encoded and already-decoded cases
            let filters;
            try {
                filters = JSON.parse(rawFilters);
            } catch (e) {
                // If parsing fails, try decoding first
                try {
                    filters = JSON.parse(decodeURIComponent(rawFilters));
                } catch (e2) {
                    return false;
                }
            }
            
            if (!filters?.session_flag) return false;
            
            // Check for new filter structure: session_flag.$and[0].$has.flag.scope.$neq
            const andClause = filters.session_flag.$and?.[0];
            if (andClause?.$has?.flag?.scope?.$neq === 'APPLICANT') {
                return true;
            }
            
            // Fallback to old structure for backward compatibility: session_flag.flag.scope.$neq
            if (filters.session_flag.flag?.scope?.$neq === 'APPLICANT') {
                return true;
            }
            
            return false;
        } catch (error) {
            // Silently fail - predicate should not throw
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