import { test, expect } from '@playwright/test';
import { findAndInviteApplication, gotoApplicationsPage, searchApplication } from '~/tests/utils/applications-page';
import { joinUrl } from '~/tests/utils/helper';
import { admin, app } from '~/tests/test_config';
import generateSessionForm from '~/tests/utils/generate-session-form';
import loginForm from '~/tests/utils/login-form';
import { waitForJsonResponse } from '~/tests/utils/wait-response';
import { gotoPage } from '~/tests/utils/common';
import {
    fillhouseholdForm,
    handleOptionalStateModal,
    selectApplicantType,
    updateStateModal,
    completeIdentityStepViaAPI,
    completeFinancialStepViaAPI,
    completeEmploymentStepViaAPI
} from '~/tests/utils/session-flow';
import { findSessionLocator, markFlagAsNonIssue, searchSessionWithText } from '~/tests/utils/report-page';

/**
 * Test: Co-Applicant Flag Attribution and Household Status Transitions
 * 
 * This test isolates co-applicant flag attribution and its effect on household status.
 * Primary is intentionally kept clean; co-app is configured to trigger a flag.
 * 
 * Expected Flow:
 * 1. Primary completes all steps (ID, Financial, Employment) and flags resolved → Status: APPROVED (UI: "Meets Criteria")
 * 2. Co-app invited but incomplete → GROUP_MISSING_IDENTITY flag → Status: CRITERIA_NOT_MET
 * 3. Co-app completes ID with name mismatch → GROUP_MISSING_IDENTITY gone, IDENTITY_NAME_MISMATCH_CRITICAL appears → Status: CRITERIA_NOT_MET
 * 4. Admin resolves co-app flag → Status: APPROVED (UI: "Meets Criteria")
 * 
 * Key Validations:
 * - Flags are attributed to correct applicant (primary vs co-app)
 * - GROUP_MISSING_IDENTITY appears when co-app invited, disappears when co-app completes ID
 * - IDENTITY_NAME_MISMATCH_CRITICAL appears for co-app name mismatch
 * - Household status transitions correctly (APPROVED ↔ CRITERIA_NOT_MET)
 * - API status = APPROVED corresponds to UI status = "Meets Criteria"
 */

const applicationName = 'Autotest - Household UI test';

// Note: first_name will be auto-prefixed with 'AutoT - ' by the helper
// Note: email will be auto-suffixed with '+autotest' by the helper
const user = {
    first_name: 'Primary',
    last_name: 'Applicant',
    email: 'primary.applicant@verifast.com'
};
// Note: Co-app first_name will also be auto-prefixed with 'AutoT - '
// Note: Co-app email will also be auto-suffixed with '+autotest'
const coapplicant = {
    first_name: 'CoApplicant',
    last_name: 'Household',
    email: 'coapplicant.household@verifast.com'
};

const updateRentBudget = async (applicantPage, sessionId) => {
    await applicantPage.locator('input#rent_budget').fill('500');

    await Promise.all([
        applicantPage.waitForResponse(resp => resp.url() === joinUrl(app.urls.api, `sessions/${sessionId}`)
            && resp.request().method() === 'PATCH'
            && resp.ok()),
        applicantPage.locator('button[type="submit"]').click()
    ]);
};

test.describe('co_app_household_with_flag_errors', () => {
    test('Should verify co-applicant flag attribution and household status transitions', {
        tag: ['@regression', '@household', '@flag-attribution'],
    }, async ({ page, browser }) => {
        test.setTimeout(380000); // Full timeout needed for complex test flow

        // Step 1: Admin Login and Navigate to Applications
        await loginForm.adminLoginAndNavigate(page, admin);

        await gotoApplicationsPage(page);
        // Step 2: Find and Invite Application
        await findAndInviteApplication(page, applicationName);

        // Step 3: Generate Session and Extract Link
        const { sessionId, sessionUrl, link } = await generateSessionForm.generateSessionAndExtractLink(page, user);

        const linkUrl = new URL(link);

        // Step 4: Open Invite link
        const context = await browser.newContext();

        const applicantPage = await context.newPage();
        await applicantPage.goto(joinUrl(`${app.urls.app}`, `${linkUrl.pathname}${linkUrl.search}`));

        // Step 5: Select Applicant Type on Page
        await selectApplicantType(applicantPage, sessionUrl);

        // Step 6: Select state in the state modal
        await handleOptionalStateModal(applicantPage);

        // Step 7: Complete rent budget step
        await updateRentBudget(applicantPage, sessionId);

        // Step 8: Skip applicants step (we'll add co-app later from admin)
        console.log('🔍 Skipping applicants step...');
        await expect(applicantPage.getByTestId('applicant-invite-step')).toBeVisible();

        // Click skip button to skip applicants step
        await applicantPage.getByTestId('applicant-invite-skip-btn').click({ timeout: 10_000 });
        await applicantPage.waitForTimeout(1000);
        console.log('✅ Applicants step skipped');

        // PRIMARY: Complete ID verification via API with PERSONA_PAYLOAD (matching name - PASSES)
        console.log('🔐 PRIMARY: Completing ID verification via API...');
        
        // Get guest token from invitation link (in URL query parameter)
        const primaryInviteUrl = new URL(link);
        const primaryGuestToken = primaryInviteUrl.searchParams.get('token');
        
        if (!primaryGuestToken) {
            throw new Error('Failed to get primary guest token from invitation URL');
        }
        
        console.log('✅ Primary guest token extracted from invitation URL');
        
        // Login as guest to get auth token
        const generateUUID = () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        };
        
        const primaryAuthResponse = await applicantPage.request.post(`${app.urls.api}/auth/guests`, {
            headers: {
                'Content-Type': 'application/json'
            },
            data: {
                token: primaryGuestToken,
                uuid: generateUUID(),
                os: 'web'
            }
        });
        
        const primaryAuth = await primaryAuthResponse.json();
        const primaryAuthToken = primaryAuth.data.token;
        console.log('✅ Primary guest authenticated via API');
        
        // Complete ID verification via API (name matches - should PASS)
        await completeIdentityStepViaAPI(applicantPage, sessionId, primaryAuthToken, user, 'primary', false);
        console.log('✅ PRIMARY: ID verification completed successfully');

        await applicantPage.waitForTimeout(2000); // Wait for step transition

        // PRIMARY: Complete Financial via API Simulation (CUSTOM_PAYLOAD)
        console.log('🏦 PRIMARY: Completing Financial step via API Simulation (CUSTOM_PAYLOAD)...');
        await completeFinancialStepViaAPI(applicantPage, sessionId, primaryAuthToken, user);
        console.log('✅ PRIMARY: Financial verification completed via Simulation');

        // Ensure UI advances to Employment: click continue if visible to mark step as done in UI
        try {
            const continueBtn = applicantPage.getByTestId('financial-verification-continue-btn');
            if (await continueBtn.isVisible({ timeout: 3000 })) {
                await continueBtn.click();
                await applicantPage.waitForTimeout(2000);
            }
        } catch (_) { /* optional advance, ignore */ }

        // PRIMARY: Complete Employment via API Simulation (VERIDOCS_PAYLOAD)
        console.log('💼 PRIMARY: Completing Employment step via API Simulation (VERIDOCS_PAYLOAD)...');
        await completeEmploymentStepViaAPI(applicantPage, sessionId, primaryAuthToken, user);
        console.log('✅ PRIMARY: Employment verification completed via Simulation');

        console.log('✅ PRIMARY: All steps completed (ID, Financial, Employment)');
        
        // Add income source via API to avoid GROSS_INCOME_RATIO_EXCEEDED flag
        console.log('💰 Adding additional income source via API to prevent gross income ratio flag...');
        const incomeSourcePayload = {
            average_monthly_income_gross: null,
            average_monthly_income: 50000, // $500
            description: "Income added",
            state: "LISTED",
            type: "EMPLOYMENT_TRANSACTIONS",
            calculate_average_monthly_income: false,
            transactions: []
        };
        
        const incomeSourceResponse = await page.request.post(`${app.urls.api}/sessions/${sessionId}/income-sources`, {
            headers: {
                'Authorization': `Bearer ${primaryAuthToken}`,
                'Content-Type': 'application/json'
            },
            data: incomeSourcePayload
        });
        
        if (incomeSourceResponse.ok()) {
            const incomeSourceData = await incomeSourceResponse.json();
            console.log(`✅ Income source added successfully: ${incomeSourceData.data.id}`);
        } else {
            console.log(`⚠️ Failed to add income source: ${incomeSourceResponse.status()}`);
        }
        
        await page.waitForTimeout(2000); // Wait for income source to be processed
        
        // DON'T close applicantPage yet - we'll use it later for co-applicant invitation
        // await applicantPage.close();
        
        // Navigate to admin view to resolve primary's flags
        await gotoPage(page, 'applicants-menu', 'applicants-submenu', '/sessions?fields[session]');

        await page.waitForTimeout(800); // Balanced: not too short, not too long

        await searchSessionWithText(page, sessionId);

        // Navigate to primary session to mark financial/employment flags as non-issue
        console.log('🔍 Opening primary session to resolve financial/employment flags...');
        const [primarySessionResponse] = await Promise.all([
            page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}?fields[session]`)
                && resp.ok()
                && resp.request().method() === 'GET'),
            page.locator(`.application-card[data-session="${sessionId}"]`).first().click()
        ]);
        
        const primarySessionData = await waitForJsonResponse(primarySessionResponse);
        
        // Open View Details to access flags
        console.log('🔍 Opening View Details to mark flags as non-issue...');
        await page.getByTestId('view-details-btn').click({ timeout: 10_000 });
        await page.waitForTimeout(1000);
        
        // Poll for INCOME_SOURCE_CADENCE_MISMATCH_ERROR flag (max 1 minute, 2 sec intervals)
        console.log('🔍 Polling for INCOME_SOURCE_CADENCE_MISMATCH_ERROR flag...');
        let cadenceFlagFound = false;
        const maxPollTime = 60000; // 1 minute
        const pollInterval = 2000; // 2 seconds
        const maxPolls = maxPollTime / pollInterval; // 30 polls
        
        for (let i = 0; i < maxPolls; i++) {
            const cadenceMismatchFlag = page.getByTestId('INCOME_SOURCE_CADENCE_MISMATCH_ERROR');
            const hasCadenceFlag = await cadenceMismatchFlag.count();
            
            if (hasCadenceFlag > 0) {
                cadenceFlagFound = true;
                console.log(`✅ INCOME_SOURCE_CADENCE_MISMATCH_ERROR flag found (poll ${i + 1}/${maxPolls})`);
                console.log('🔧 Marking INCOME_SOURCE_CADENCE_MISMATCH_ERROR as non-issue...');
            await markFlagAsNonIssue(
                page,
                sessionId,
                    'INCOME_SOURCE_CADENCE_MISMATCH_ERROR',
                    'Income source cadence mismatch marked as non-issue by automated test'
                );
                console.log('✅ INCOME_SOURCE_CADENCE_MISMATCH_ERROR marked as non-issue');
                break;
            }
            
            if (i < maxPolls - 1) {
                console.log(`⏳ INCOME_SOURCE_CADENCE_MISMATCH_ERROR not visible yet, waiting... (poll ${i + 1}/${maxPolls})`);
                await page.waitForTimeout(pollInterval);
                
                // Reload details view to get updated flags
                await page.getByTestId('close-event-history-modal').click({ timeout: 5_000 });
            await page.waitForTimeout(500);
                await page.getByTestId('view-details-btn').click({ timeout: 10_000 });
                await page.waitForTimeout(1000);
            }
        }
        
        if (!cadenceFlagFound) {
            console.log('⚠️ INCOME_SOURCE_CADENCE_MISMATCH_ERROR flag not found after polling - continuing...');
        }
        
        // Skip marking other mismatches; Simulation ensures matching names and owners now
        
        // Close details modal
        await page.getByTestId('close-event-history-modal').click({ timeout: 10_000 });
        await page.waitForTimeout(1000);
        console.log('✅ Primary session flags resolved');
        
        // ASSERTION 1: Poll for status = APPROVED after flags resolved (max 30 sec, 2 sec intervals)
        console.log('🔍 ASSERTION 1: Polling for household status = APPROVED after flag resolution...');
        let statusIsApproved = false;
        const statusMaxPollTime = 30000; // 30 seconds
        const statusPollInterval = 2000; // 2 seconds
        const statusMaxPolls = statusMaxPollTime / statusPollInterval; // 15 polls
        let primarySessionResolved;
        
        for (let i = 0; i < statusMaxPolls; i++) {
            const sessionAfterPrimary = await page.request.get(`${app.urls.api}/sessions/${sessionId}`, {
                headers: {
                    'Authorization': `Bearer ${primaryAuthToken}`,
                    'Content-Type': 'application/json'
                }
            });
            primarySessionResolved = await sessionAfterPrimary.json();
            
            console.log(`📊 API Status (poll ${i + 1}/${statusMaxPolls}): ${primarySessionResolved.data.approval_status}`);
            
            if (primarySessionResolved.data.approval_status === 'APPROVED') {
                statusIsApproved = true;
                console.log('✅ ASSERTION 1 (API): Primary alone = APPROVED (after flag resolution)');
                break;
            }
            
            if (i < statusMaxPolls - 1) {
                console.log(`⏳ Status not APPROVED yet, waiting...`);
                await page.waitForTimeout(statusPollInterval);
            }
        }
        
        if (!statusIsApproved) {
            console.log(`❌ Status did not become APPROVED after ${statusMaxPollTime}ms. Final status: ${primarySessionResolved.data.approval_status}`);
            throw new Error(`Expected status APPROVED, got ${primarySessionResolved.data.approval_status}`);
        }
        
        // Also verify UI shows "Meets Criteria" (poll UI as it can lag behind API)
        console.log('🔍 ASSERTION 1 (UI): Polling household-status-alert for "Meets Criteria"...');
        const householdStatusAlert = page.getByTestId('household-status-alert');
        let uiApproved = false;
        for (let i = 0; i < 15; i++) { // up to ~30s
            try {
                await expect(householdStatusAlert).toContainText('Meets Criteria', { timeout: 2000 });
                uiApproved = true;
                break;
            } catch (_) {
                await Promise.all([
                    page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}?fields[session]`)
                        && resp.ok()
                        && resp.request().method() === 'GET'),
                    page.reload()
                ]);
                await page.waitForTimeout(1000);
            }
        }
        if (!uiApproved) {
            throw new Error('UI did not reflect "Meets Criteria" after approval');
        }
        console.log('✅ ASSERTION 1 (UI) PASSED: UI shows "Meets Criteria"');
        
        // Go back to applicantPage context to add co-applicant
        console.log('🔍 Returning to primary applicant page to add co-applicant...');
        
        // Navigate to applicants step using 2nd element of step-APPLICANTS-lg
        console.log('🔍 Clicking on 2nd step-APPLICANTS-lg element to go to applicants step...');
        const applicantStepElements = await applicantPage.getByTestId('step-APPLICANTS-lg').all();
        
        if (applicantStepElements.length < 2) {
            throw new Error('Expected at least 2 step-APPLICANTS-lg elements, found: ' + applicantStepElements.length);
        }
        
        // Click the 2nd element (index 1)
        await applicantStepElements[1].click();
        await applicantPage.waitForTimeout(1000);
        console.log('✅ Navigated to applicants step');
        
        // Fill household form to add co-applicant
        console.log('🔍 Adding co-applicant to household...');
        await expect(applicantPage.getByTestId('applicant-invite-step')).toBeVisible();
        const applicant = await fillhouseholdForm(applicantPage, coapplicant);
        await applicantPage.waitForTimeout(800);
        
        // Click continue to invite co-applicant
        await applicantPage.locator('[data-testid="applicant-invite-continue-btn"]:visible').click({ timeout: 18_000 });
        await applicantPage.waitForTimeout(2000);
        console.log('✅ Co-applicant added to household');
        
        // Close the primary applicant page now
        await applicantPage.close();
        
        // ASSERTION 2a: Check GROUP_MISSING_IDENTITY flag is present (co-app invited but not completed)
        console.log('🔍 ASSERTION 2a: Checking for GROUP_MISSING_IDENTITY flag after co-app invitation...');
        const [sessionAfterCoAppInviteResponse] = await Promise.all([
            page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}?fields[session]`)
                && resp.ok()
                && resp.request().method() === 'GET'),
            page.reload()
        ]);
        const sessionAfterCoAppInvite = await waitForJsonResponse(sessionAfterCoAppInviteResponse);
        await page.waitForTimeout(4000); // Wait for page to reload
        // Open details to check for GROUP_MISSING_IDENTITY flag
        await page.getByTestId('view-details-btn').click({ timeout: 10_000 });
        await page.waitForTimeout(1000);
        
        const groupMissingIdFlag = page.getByTestId('GROUP_MISSING_IDENTITY');
        await expect(groupMissingIdFlag).toBeVisible({ timeout: 10_000 });
        console.log('✅ ASSERTION 2a PASSED: GROUP_MISSING_IDENTITY flag is present (co-app invited but incomplete)');
        
        // Close details modal
        await page.getByTestId('close-event-history-modal').click({ timeout: 10_000 });
        await page.waitForTimeout(1000);
        
        // ASSERTION 2b: Status should be REJECTED (API) and "Criteria Not Met" (UI)
        console.log('🔍 ASSERTION 2b: Polling household status after co-app invitation...');
        let status2bIsRejected = false;
        let status2bLast = sessionAfterCoAppInvite.data.approval_status;
        const status2bMaxPollTime = 30000; // 30 seconds
        const status2bPollInterval = 2000; // 2 seconds
        const status2bMaxPolls = status2bMaxPollTime / status2bPollInterval; // 15 polls
        for (let i = 0; i < status2bMaxPolls; i++) {
            const statusResp = await page.request.get(`${app.urls.api}/sessions/${sessionId}`, {
                headers: {
                    'Authorization': `Bearer ${primaryAuthToken}`,
                    'Content-Type': 'application/json'
                }
            });
            const statusJson = await statusResp.json();
            status2bLast = statusJson.data.approval_status;
            console.log(`📊 API Status after co-app invite (poll ${i + 1}/${status2bMaxPolls}): ${status2bLast}`);
            if (status2bLast === 'REJECTED') {
                status2bIsRejected = true;
                break;
            }
            if (i < status2bMaxPolls - 1) {
                await page.waitForTimeout(status2bPollInterval);
            }
        }
        if (!status2bIsRejected) {
            throw new Error(`Expected status REJECTED after co-app invite, got ${status2bLast}`);
        }
        console.log('✅ ASSERTION 2b (API) PASSED: Status = REJECTED (co-app invited but incomplete)');
        
        // Verify UI shows "Criteria Not Met"
        const householdStatusAfterInvite = page.getByTestId('household-status-alert').first();
        await expect(householdStatusAfterInvite).toContainText('Criteria Not Met', { timeout: 10_000 });
        console.log('✅ ASSERTION 2b (UI) PASSED: UI shows "Criteria Not Met"');
        
        // Get co-applicant invite link
        console.log('🔍 Getting co-applicant invite link...');
        const coAppChild = sessionAfterCoAppInvite.data.children.find(child => child.role === 'APPLICANT');
        if (!coAppChild) {
            throw new Error('Co-applicant not found in session children');
        }
        
        const coAppInviteUrl = coAppChild.url;
        console.log(`✅ Co-applicant invite URL: ${coAppInviteUrl}`);
        
        // Open co-app link in new context
        const newPageContext = await browser.newContext();
        const coAppPage = await newPageContext.newPage();

        const coAppLinkUrl = new URL(coAppInviteUrl);
        const coAppSessionApiUrl = joinUrl(app.urls.api, coAppLinkUrl.pathname);

        const [coSessionResp] = await Promise.all([
            coAppPage.waitForResponse(resp => resp.url().includes(coAppSessionApiUrl)
                && resp.ok()
                && resp.request().method() === 'GET'),
            coAppPage.goto(joinUrl(app.urls.app, `${coAppLinkUrl.pathname}${coAppLinkUrl.search}`))
        ]);

        const coAppSession = await waitForJsonResponse(coSessionResp);
        const coAppSessionId = coAppSession.data.id;

        // Step 5: Select Applicant Type on Page
        await selectApplicantType(coAppPage, coAppSessionApiUrl);

        // Step 6: Select state in the state modal
        await updateStateModal(coAppPage);

        await coAppPage.waitForTimeout(1000);

        // CO-APPLICANT: Complete ID verification via API with PERSONA_PAYLOAD (MISMATCHED name - TRIGGERS FLAG)
        console.log('🔐 CO-APPLICANT: Completing ID verification via API with name mismatch...');
        
        // Get guest token from co-applicant invitation link (in URL query parameter)
        const coAppInviteToken = coAppLinkUrl.searchParams.get('token');
        
        if (!coAppInviteToken) {
            throw new Error('Failed to get co-applicant guest token from invitation URL');
        }
        
        console.log('✅ Co-applicant guest token extracted from invitation URL');
        
        // Login as co-applicant guest to get auth token
        const coAppAuthResponse = await coAppPage.request.post(`${app.urls.api}/auth/guests`, {
            headers: {
                'Content-Type': 'application/json'
            },
            data: {
                token: coAppInviteToken,
                uuid: generateUUID(),
                os: 'web'
            }
        });
        
        const coAppAuth = await coAppAuthResponse.json();
        const coAppAuthToken = coAppAuth.data.token;
        console.log('✅ Co-applicant guest authenticated via API');
        
        // Complete ID verification via API with MISMATCHED name (triggers IDENTITY_NAME_MISMATCH_CRITICAL flag)
        await completeIdentityStepViaAPI(coAppPage, coAppSession.data.id, coAppAuthToken, coapplicant, 'co-applicant', true);
        console.log(`✅ CO-APPLICANT: ID verification completed with completely different name: X Y (expected: ${coapplicant.first_name} ${coapplicant.last_name}) - FLAG SHOULD BE TRIGGERED`);

        await coAppPage.waitForTimeout(3000); // Wait for flag to be created

        await coAppPage.close();

        // ASSERTION 3a: Check GROUP_MISSING_IDENTITY flag is GONE after co-app completes ID
        console.log('🔍 ASSERTION 3a: Checking GROUP_MISSING_IDENTITY flag is gone...');
        const [sessionAfterCoAppIdResponse] = await Promise.all([
            page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}?fields[session]`)
                && resp.ok()
                && resp.request().method() === 'GET'),
            page.reload()
        ]);
        const sessionAfterCoAppId = await waitForJsonResponse(sessionAfterCoAppIdResponse);
        await page.waitForTimeout(4000); // Wait for page to reload
        // Open details to check flags
        await page.getByTestId('view-details-btn').click({ timeout: 10_000 });
        await page.waitForTimeout(1000);
        
        // GROUP_MISSING_IDENTITY should be GONE
        const groupMissingIdFlagGone = page.getByTestId('GROUP_MISSING_IDENTITY');
        const hasGroupMissingId = await groupMissingIdFlagGone.count();
        expect(hasGroupMissingId).toBe(0);
        console.log('✅ ASSERTION 3a PASSED: GROUP_MISSING_IDENTITY flag is GONE (co-app completed ID)');
        
        // ASSERTION 3b: Check IDENTITY_NAME_MISMATCH_CRITICAL flag is PRESENT
        console.log('🔍 ASSERTION 3b: Checking IDENTITY_NAME_MISMATCH_CRITICAL flag is present...');
        const idNameMismatchFlag = page.getByTestId('IDENTITY_NAME_MISMATCH_CRITICAL');
        await expect(idNameMismatchFlag).toBeVisible({ timeout: 10_000 });
        console.log('✅ ASSERTION 3b PASSED: IDENTITY_NAME_MISMATCH_CRITICAL flag is present');
        
        // Verify flag text contains required substrings (order-independent)
        const rawFlagText = await idNameMismatchFlag.textContent();
        const flagText = rawFlagText ? rawFlagText.replace(/\s+/g, ' ').trim() : '';
        expect(flagText).toContain('Identity Name Mismatch (Critical)');
        // Note: Name now includes 'AutoT - ' prefix (UI may show as 'Autot - ' due to text transformation)
        expect(flagText).toContain('Coapplicant Household'); // Partial match to work with prefix
        console.log('✅ FLAG TEXT VERIFIED: Contains "Identity Name Mismatch (Critical)" and co-applicant name');
        
        // ASSERTION 3c: Status should still be REJECTED (API) and "Criteria Not Met" (UI)
        console.log('🔍 ASSERTION 3c: Polling household status after co-app ID...');
        let statusIsRejected = false;
        let lastStatus = sessionAfterCoAppId.data.approval_status;
        const status3cMaxPollTime = 30000; // 30 seconds
        const status3cPollInterval = 2000; // 2 seconds
        const status3cMaxPolls = status3cMaxPollTime / status3cPollInterval; // 15 polls
        for (let i = 0; i < status3cMaxPolls; i++) {
            const statusResp = await page.request.get(`${app.urls.api}/sessions/${sessionId}`, {
                headers: {
                    'Authorization': `Bearer ${primaryAuthToken}`,
                    'Content-Type': 'application/json'
                }
            });
            const statusJson = await statusResp.json();
            lastStatus = statusJson.data.approval_status;
            console.log(`📊 API Status after co-app ID (poll ${i + 1}/${status3cMaxPolls}): ${lastStatus}`);
            if (lastStatus === 'REJECTED') {
                statusIsRejected = true;
                break;
            }
            if (i < status3cMaxPolls - 1) {
                await page.waitForTimeout(status3cPollInterval);
            }
        }
        if (!statusIsRejected) {
            throw new Error(`Expected status REJECTED after co-app ID, got ${lastStatus}`);
        }
        console.log('✅ ASSERTION 3c (API) PASSED: Status = REJECTED (due to IDENTITY_NAME_MISMATCH_CRITICAL)');
        
        // Verify UI shows "Criteria Not Met"
        await expect(householdStatusAfterInvite).toContainText('Criteria Not Met', { timeout: 10_000 });
        console.log('✅ ASSERTION 3c (UI) PASSED: UI shows "Criteria Not Met"');
        
        // Mark flag as non-issue to restore MEETS_CRITERIA status
        console.log('🔧 Resolving IDENTITY_NAME_MISMATCH_CRITICAL flag by marking as non-issue...');
        await markFlagAsNonIssue(
            page,
            coAppSessionId,
            'IDENTITY_NAME_MISMATCH_CRITICAL',
            'Co-applicant name mismatch resolved - marked as non-issue by automated test'
        );
        await page.getByTestId('close-event-history-modal').click({ timeout: 10_000 });
        await page.waitForTimeout(2000);
        
        // ASSERTION 4: After resolving flag, status should return to APPROVED (Meets Criteria)
        console.log('🔍 ASSERTION 4: Checking household status after resolving flag...');
        let finalApproved = false;
        let finalStatus = 'UNKNOWN';
        const finalMaxPollTime = 60000; // 60 seconds
        const finalPollInterval = 2000; // 2 seconds
        const finalMaxPolls = Math.ceil(finalMaxPollTime / finalPollInterval);
        for (let i = 0; i < finalMaxPolls; i++) {
            const resp = await page.request.get(`${app.urls.api}/sessions/${sessionId}`, {
                headers: {
                    'Authorization': `Bearer ${primaryAuthToken}`,
                    'Content-Type': 'application/json'
                }
            });
            const json = await resp.json();
            finalStatus = json.data.approval_status;
            console.log(`📊 API Status after resolving flag (poll ${i + 1}/${finalMaxPolls}): ${finalStatus}`);
            if (finalStatus === 'APPROVED') {
                finalApproved = true;
                break;
            }
            if (i < finalMaxPolls - 1) {
                await page.waitForTimeout(finalPollInterval);
            }
        }
        expect(finalApproved).toBeTruthy();
        console.log('✅ ASSERTION 4 (API) PASSED: Household status restored to APPROVED after resolving flag');
        
        // Also verify UI shows "Meets Criteria"
        console.log('🔍 ASSERTION 4 (UI): Verifying household-status-alert shows "Meets Criteria"...');
        const finalHouseholdStatusAlert = page.getByTestId('household-status-alert').first();
        await expect(finalHouseholdStatusAlert).toContainText('Meets Criteria', { timeout: 10_000 });
        console.log('✅ ASSERTION 4 (UI) PASSED: UI shows "Meets Criteria" after resolving all flags');
        
        console.log('\n🎯 TEST SUMMARY:');
        console.log('✅ ASSERTION 1 (API): Primary alone (flags resolved) → APPROVED');
        console.log('✅ ASSERTION 1 (UI): UI shows "Meets Criteria"');
        console.log('✅ ASSERTION 2a: GROUP_MISSING_IDENTITY present after co-app invited');
        console.log('✅ ASSERTION 2b (API): Status → REJECTED (co-app invited but incomplete)');
        console.log('✅ ASSERTION 2b (UI): UI shows "Criteria Not Met"');
        console.log('✅ ASSERTION 3a: GROUP_MISSING_IDENTITY gone after co-app completes ID');
        console.log('✅ ASSERTION 3b: IDENTITY_NAME_MISMATCH_CRITICAL present (name mismatch)');
        console.log('✅ ASSERTION 3c (API): Status → REJECTED (name mismatch flag)');
        console.log('✅ ASSERTION 3c (UI): UI shows "Criteria Not Met"');
        console.log('✅ Flag attributed to co-applicant correctly in UI');
        console.log('✅ ASSERTION 4 (API): After resolving flag → APPROVED');
        console.log('✅ ASSERTION 4 (UI): UI shows "Meets Criteria"');
        console.log('✅ All household status transitions validated successfully (API + UI)');
    });
});
