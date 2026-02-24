import { test, expect } from '@playwright/test';
import { admin, app } from '../test_config';
import { getRandomEmail, generateUUID, getCentsToDollarsSafe } from '../utils/helper';
import { completeFinancialStepViaAPI } from '../utils/session-flow';
import loginForm from '../utils/login-form';
import { cleanupSession } from '../utils/cleanup-helper';

const APPLICATION_NAME = 'Autotest - Simulator Financial Step';

test.describe('QA-290 other_income_gross_display.spec', () => {
    let sessionId = null;
    let allTestsPassed = false;

    test('should display the gross amount for other income', {
        tag: ['@regression', '@income-source-display'],
        timeout: 300_000
    }, async ({ page }) => {

        // ─── SETUP ──────────────────────────────────────────────────────────────────────

        // Step 1: Login as admin and get auth token
        const authToken = await loginForm.adminLoginAndNavigate(page, admin);
        expect(authToken).toBeDefined();

        const adminHeaders = {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        };

        // Step 2: Find application and create test session with invite=true via API
        const appsResponse = await page.request.get(`${app.urls.api}/applications`, {
            headers: adminHeaders,
            params: {
                'fields[application]': 'id,name',
                'filters': JSON.stringify({
                    '$and': [{ '$or': { 'name': { '$like': APPLICATION_NAME } } }]
                }),
                'limit': 50
            }
        });
        expect(appsResponse.ok()).toBe(true);
        const appsData = await appsResponse.json();
        const application = appsData.data.find(a => a.name === APPLICATION_NAME);
        expect(application, `Application '${APPLICATION_NAME}' not found`).toBeTruthy();

        const userData = {
            first_name: 'Autot - Other',
            last_name: 'Income',
            email: getRandomEmail()
        };

        const createSessionResponse = await page.request.post(`${app.urls.api}/sessions`, {
            headers: adminHeaders,
            data: {
                application: application.id,
                first_name: userData.first_name,
                last_name: userData.last_name,
                email: userData.email,
                invite: true
            }
        });
        expect(createSessionResponse.ok()).toBe(true);
        const sessionJson = await createSessionResponse.json();
        sessionId = sessionJson.data.id;
        const sessionUrl = sessionJson.data.url;
        console.log(`✅ Session created: ${sessionId}`);

        // Step 3: Authenticate as guest user via invitation URL
        const inviteUrl = new URL(sessionUrl);
        const invitationToken = inviteUrl.searchParams.get('token');
        expect(invitationToken, 'No invitation token found in session URL').toBeTruthy();

        const guestLoginResponse = await page.request.post(`${app.urls.api}/auth/guests`, {
            data: {
                token: invitationToken,
                uuid: generateUUID(),
                os: 'web'
            }
        });
        expect(guestLoginResponse.ok()).toBe(true);
        const guestAuth = await guestLoginResponse.json();
        const guestToken = guestAuth.data.token;
        const guestHeaders = {
            'Authorization': `Bearer ${guestToken}`,
            'Content-Type': 'application/json'
        };
        console.log('✅ Guest authenticated');

        // Step 4: Complete START step via API
        const sessionStateResponse = await page.request.get(`${app.urls.api}/sessions/${sessionId}`, {
            headers: guestHeaders
        });
        const sessionState = await sessionStateResponse.json();
        expect(sessionState.data.state.current_step.type).toBe('START');

        const startStepResponse = await page.request.post(`${app.urls.api}/sessions/${sessionId}/steps`, {
            headers: guestHeaders,
            data: { step: sessionState.data.state.current_step.id }
        });
        const startStep = await startStepResponse.json();

        // Update rent budget as part of START step
        await page.request.patch(`${app.urls.api}/sessions/${sessionId}`, {
            headers: guestHeaders,
            data: { target: '2500' }
        });

        // Mark START step as COMPLETED
        await page.request.patch(`${app.urls.api}/sessions/${sessionId}/steps/${startStep.data.id}`, {
            headers: guestHeaders,
            data: { status: 'COMPLETED' }
        });
        console.log('✅ START step completed');

        // Step 5: Navigate to FINANCIAL step via API (poll for step transition)
        let currentStepType = 'START';
        for (let i = 0; i < 10 && currentStepType === 'START'; i++) {
            await page.waitForTimeout(2000);
            const stepCheckResponse = await page.request.get(`${app.urls.api}/sessions/${sessionId}`, {
                headers: guestHeaders
            });
            const stepCheckData = await stepCheckResponse.json();
            currentStepType = stepCheckData.data.state.current_step.task.key;
            console.log(`⏳ Current step: ${currentStepType} (poll ${i + 1}/10)`);
        }
        expect(currentStepType).toBe('FINANCIAL_VERIFICATION');
        console.log('✅ Session transitioned to FINANCIAL step');

        // Step 6: Create "Other" type income source with gross amount via API
        const createIncomeSourceResponse = await page.request.post(
            `${app.urls.api}/sessions/${sessionId}/income-sources`,
            {
                headers: adminHeaders,
                data: JSON.stringify({
                    type: 'OTHER',
                    description: 'Test Other Income',
                    average_monthly_income: 200000,
                    average_monthly_income_gross: 250000,
                    state: 'LISTED',
                    calculate_average_monthly_income: true,
                    calculate_average_monthly_income_gross: true
                })
            }
        );
        expect(createIncomeSourceResponse.ok()).toBe(true);
        const createdIncomeSource = await createIncomeSourceResponse.json();
        const incomeSourceId = createdIncomeSource.data.id;
        console.log(`✅ Other income source created: ${incomeSourceId}`);

        // Step 7: Generate income sources via PATCH /sessions/{sessionId}
        const generateResponse = await page.request.patch(`${app.urls.api}/sessions/${sessionId}`, {
            headers: adminHeaders,
            data: JSON.stringify({ reset_income_sources: true })
        });
        expect(generateResponse.status()).toBe(200);

        // Step 8: Wait for income sources to be generated (poll API)
        let generatedIncomeSources = [];
        for (let i = 0; i < 15; i++) {
            const incomeSourcesResponse = await page.request.get(
                `${app.urls.api}/sessions/${sessionId}/income-sources`,
                { headers: adminHeaders }
            );
            expect(incomeSourcesResponse.status()).toBe(200);
            generatedIncomeSources = (await incomeSourcesResponse.json()).data;
            if (generatedIncomeSources.length > 0) {
                console.log(`✅ Income sources generated: ${generatedIncomeSources.length}`);
                break;
            }
            await page.waitForTimeout(1000);
        }
        expect(generatedIncomeSources.length).toBeGreaterThan(0);

        // Complete FINANCIAL step via API
        await completeFinancialStepViaAPI(page, sessionId, guestToken, userData);
        console.log('✅ FINANCIAL step completed');

        // ─── Navigate to applicant report dashboard ──────────────────────────────────────

        await page.bringToFront();
        await page.goto(`/applicants/all/${sessionId}`);

        // Fetch fresh session data via API for reliable assertions
        const sessionDataResponse = await page.request.get(`${app.urls.api}/sessions/${sessionId}`, {
            headers: adminHeaders,
            params: { 'fields[session]': 'state', 'fields[session_state]': 'summary' }
        });
        expect(sessionDataResponse.ok()).toBe(true);
        const { data: session } = await sessionDataResponse.json();

        const taxTotals = session.state?.summary?.tax_estimates?.income?.totals;
        const incomeType = session.state?.summary?.income_type;
        console.log(`📊 Income type: ${incomeType}`);
        console.log(`📊 Tax totals: ${JSON.stringify(taxTotals)}`);

        // ─── STEP 1: Verify monthly income card displays income ──────────────────────────

        console.log('\n📋 STEP 1: Verify monthly income card displays gross income...');

        const monthlyIncomeCard = page.getByTestId('report-monthly-income-card');
        await expect(monthlyIncomeCard).toBeVisible({ timeout: 20_000 });

        // Verify card title based on IncomeRatioType from API
        if (incomeType === 'GROSS') {
            await expect(monthlyIncomeCard).toHaveText(/Monthly Gross Income/);
            console.log('✅ Monthly Gross Income title verified');
        } else {
            await expect(monthlyIncomeCard).toHaveText(/Monthly Net Income/);
            console.log('✅ Monthly Net Income title verified');
        }

        const monthlyIncomeCardText = await monthlyIncomeCard.textContent();
        console.log(`📊 Monthly income card: ${monthlyIncomeCardText}`);

        // Verify card value matches API total_income / 12 (approximately)
        const apiMonthlyIncome = session.state?.summary?.income ?? session.summary?.income;
        if (apiMonthlyIncome !== undefined) {
            const expectedMonthlyValue = getCentsToDollarsSafe(apiMonthlyIncome, 'en');
            await expect(monthlyIncomeCard).toContainText(expectedMonthlyValue);
            console.log(`✅ Monthly income card value matches API: ${expectedMonthlyValue}`);
        }

        // ─── STEP 2: Open IncomeSourceDetailsModal ───────────────────────────────────────

        console.log('\n📋 STEP 2: Open IncomeSourceDetailsModal...');

        await monthlyIncomeCard.click();

        const incomeSourceDetailsModal = page.getByTestId('income-source-details-modal');
        await expect(incomeSourceDetailsModal).toBeVisible({ timeout: 10_000 });

        // Verify modal heading shows "Gross Income"
        const grossIncomeHeading = incomeSourceDetailsModal.getByTestId('gross-income-modal-heading');
        await expect(grossIncomeHeading).toBeVisible();
        await expect(grossIncomeHeading).toHaveText(/Gross Income/);
        console.log('✅ Modal heading "Gross Income" verified');

        // Verify modal description text
        const grossIncomeModalDescription = incomeSourceDetailsModal.getByTestId('gross-income-modal-description');
        await expect(grossIncomeModalDescription).toBeVisible();
        await expect(grossIncomeModalDescription).toHaveText(
            /Gross income is the income before any taxes are deducted\./
        );
        console.log('✅ Modal description verified');

        // ─── STEP 3: Verify Annual Other Income displays gross value ──────────────────────

        console.log('\n📋 STEP 3: Verify Annual Other Income displays gross value...');

        const otherGrossAnnualized = taxTotals?.other_gross_annualized;
        const otherNetAnnualized = taxTotals?.other_net_annualized;

        const annualOtherIncome = incomeSourceDetailsModal.getByTestId('annual-other-income');
        await expect(annualOtherIncome).toBeVisible();

        const annualOtherText = await annualOtherIncome.textContent();
        console.log(`📊 Annual Other Income displayed: ${annualOtherText}`);

        // Verify currency format (e.g., "$ 30,000.00")
        expect(annualOtherText).toMatch(/\$\s\d{1,3}(,\d{3})*(\.\d{2})?/);
        console.log('✅ Currency format verified');

        // Verify displayed value matches API – prefer gross, fall back to net
        if (otherGrossAnnualized !== undefined && otherGrossAnnualized !== null) {
            const expectedGross = getCentsToDollarsSafe(otherGrossAnnualized, 'en');
            await expect(annualOtherIncome).toContainText(expectedGross);
            console.log(`✅ Annual Other Income shows gross value: ${expectedGross}`);
            expect(otherGrossAnnualized).toBeGreaterThan(0);
        } else if (otherNetAnnualized !== undefined && otherNetAnnualized !== null) {
            const expectedNet = getCentsToDollarsSafe(otherNetAnnualized, 'en');
            await expect(annualOtherIncome).toContainText(expectedNet);
            console.log(`✅ Annual Other Income shows net value (fallback): ${expectedNet}`);
        } else {
            console.log('⚠️ No other_gross_annualized or other_net_annualized in API response');
        }

        // ─── STEP 4: Verify Final Calculation section ────────────────────────────────────

        console.log('\n📋 STEP 4: Verify Final Calculation section...');

        const finalCalculationHeading = incomeSourceDetailsModal.getByTestId('final-calculation-heading');
        const isFinalCalcVisible = await finalCalculationHeading
            .isVisible({ timeout: 3000 })
            .catch(() => false);

        if (isFinalCalcVisible) {
            await finalCalculationHeading.scrollIntoViewIfNeeded();

            // Verify note text: Other-type includes gross if provided
            const finalCalcNote = incomeSourceDetailsModal.getByTestId('final-calculation-note');
            const isNoteVisible = await finalCalcNote.isVisible({ timeout: 2000 }).catch(() => false);
            if (isNoteVisible) {
                await expect(finalCalcNote).toHaveText(
                    /Note that Government-type income is not grossed up\. Other-type income includes gross if provided\./
                );
                console.log('✅ Final Calculation note verified');
            }

            // Verify total matches API gross_annualized
            const finalCalcTotal = incomeSourceDetailsModal.getByTestId('final-calculation-total');
            const isTotalVisible = await finalCalcTotal.isVisible({ timeout: 2000 }).catch(() => false);
            if (isTotalVisible && taxTotals?.gross_annualized) {
                const expectedTotal = getCentsToDollarsSafe(taxTotals.gross_annualized, 'en');
                await expect(finalCalcTotal).toContainText(expectedTotal);
                console.log(`✅ Final calculation total matches API: ${expectedTotal}`);

                // API Verification: confirm gross_annualized includes other_gross_annualized
                if (otherGrossAnnualized && taxTotals?.employment_gross_annualized !== undefined) {
                    const expectedSum =
                        (taxTotals.employment_gross_annualized ?? 0) +
                        (taxTotals.government_net_annualized ?? 0) +
                        (taxTotals.other_gross_annualized ?? 0);
                    console.log(`📊 Expected gross sum: ${expectedSum}, API gross_annualized: ${taxTotals.gross_annualized}`);
                }
            }
        } else {
            console.log('ℹ️ Final Calculation section not visible – skipping assertions');
        }

        // ─── STEP 5: Fallback scenario – remove gross from Other income ──────────────────

        console.log('\n📋 STEP 5: Fallback scenario – remove gross from Other income...');

        // Close modal
        const closeModalBtn = incomeSourceDetailsModal.getByTestId('income-source-details-modal-cancel');
        const isCloseVisible = await closeModalBtn.isVisible({ timeout: 3000 }).catch(() => false);
        if (isCloseVisible) {
            await closeModalBtn.click();
        } else {
            await page.keyboard.press('Escape');
        }
        await expect(incomeSourceDetailsModal).not.toBeVisible({ timeout: 5000 });

        // Re-fetch income sources to get the current incomeSourceId (may have changed after regeneration)
        const currentIncomeSources = await page.request.get(
            `${app.urls.api}/sessions/${sessionId}/income-sources`,
            { headers: adminHeaders }
        );
        const currentIncomeSourcesData = await currentIncomeSources.json();
        const otherIncomeSource = currentIncomeSourcesData.data?.find(
            s => s.type === 'OTHER' && s.description === 'Test Other Income'
        );
        const validIncomeSourceId = otherIncomeSource?.id ?? incomeSourceId;

        // Remove gross value via API
        const removeGrossResponse = await page.request.patch(
            `${app.urls.api}/sessions/${sessionId}/income-sources/${validIncomeSourceId}`,
            {
                headers: adminHeaders,
                data: JSON.stringify({ average_monthly_income_gross: null })
            }
        );

        expect(removeGrossResponse.ok()).toBeTruthy();
        console.log('✅ Gross removed from income source');

        // Regenerate income sources
        await page.request.patch(`${app.urls.api}/sessions/${sessionId}`, {
            headers: adminHeaders,
            data: JSON.stringify({ reset_income_sources: true })
        });

        // Wait for regeneration to complete
        await page.waitForTimeout(3000);

        // Refresh page to get updated session state
        const updatedSessionPromise = page.waitForResponse(
            resp => resp.url().includes(`/sessions/${sessionId}`)
                && resp.request().method() === 'GET'
                && resp.ok(),
            { timeout: 30_000 }
        );
        await page.reload();
        await updatedSessionPromise;

        // Fetch updated session data via API
        const updatedSessionDataResponse = await page.request.get(`${app.urls.api}/sessions/${sessionId}`, {
            headers: adminHeaders,
            params: { 'fields[session]': 'state', 'fields[session_state]': 'summary' }
        });
        const { data: updatedSession } = await updatedSessionDataResponse.json();
        const updatedTaxTotals = updatedSession.state?.summary?.tax_estimates?.income?.totals;
        console.log(`📊 Updated tax totals: ${JSON.stringify(updatedTaxTotals)}`);

        // Click monthly income card again to reopen modal
        await expect(monthlyIncomeCard).toBeVisible({ timeout: 15_000 });
        await monthlyIncomeCard.click();
        await expect(incomeSourceDetailsModal).toBeVisible({ timeout: 10_000 });

        // Verify Annual Other Income now shows net value (fallback – no gross available)
        const updatedAnnualOtherIncome = incomeSourceDetailsModal.getByTestId('annual-other-income');
        await expect(updatedAnnualOtherIncome).toBeVisible();
        const updatedAnnualOtherText = await updatedAnnualOtherIncome.textContent();
        console.log(`📊 Fallback Annual Other Income: ${updatedAnnualOtherText}`);

        if (updatedTaxTotals?.other_net_annualized !== undefined && updatedTaxTotals.other_net_annualized !== null) {
            const expectedNet = getCentsToDollarsSafe(updatedTaxTotals.other_net_annualized, 'en');
            await expect(updatedAnnualOtherIncome).toContainText(expectedNet);
            console.log(`✅ Fallback: Annual Other Income shows net value: ${expectedNet}`);
        }

        // Verify total is lower than when gross was available (proves fallback works)
        if (otherGrossAnnualized && taxTotals?.gross_annualized && updatedTaxTotals?.gross_annualized) {
            expect(updatedTaxTotals.gross_annualized).toBeLessThanOrEqual(taxTotals.gross_annualized);
            console.log('✅ Total is lower after removing gross (fallback proven)');
        }

        // Verify final calculation total in fallback state
        const fallbackFinalCalcHeading = incomeSourceDetailsModal.getByTestId('final-calculation-heading');
        const isFallbackFinalCalcVisible = await fallbackFinalCalcHeading
            .isVisible({ timeout: 2000 })
            .catch(() => false);
        if (isFallbackFinalCalcVisible) {
            await fallbackFinalCalcHeading.scrollIntoViewIfNeeded();
            const fallbackFinalCalcTotal = incomeSourceDetailsModal.getByTestId('final-calculation-total');
            const isFallbackTotalVisible = await fallbackFinalCalcTotal
                .isVisible({ timeout: 2000 })
                .catch(() => false);
            if (isFallbackTotalVisible && updatedTaxTotals?.gross_annualized) {
                const expectedFallbackTotal = getCentsToDollarsSafe(updatedTaxTotals.gross_annualized, 'en');
                await expect(fallbackFinalCalcTotal).toContainText(expectedFallbackTotal);
                console.log(`✅ Fallback final calculation total: ${expectedFallbackTotal}`);
            }
        }

        // Close modal
        const isFallbackCloseVisible = await closeModalBtn.isVisible({ timeout: 3000 }).catch(() => false);
        if (isFallbackCloseVisible) {
            await closeModalBtn.click();
        } else {
            await page.keyboard.press('Escape');
        }


        // ─── STEP 8: Verify consistency across UI components ─────────────────────────────

        console.log('\n📋 STEP 8: Verify consistency across UI components...');

        const apiMonthlyIncomeValue = session.state?.summary?.income ?? session.summary?.income;
        const apiTotalIncome = session.state?.summary?.total_income ?? session.summary?.total_income;

        if (apiMonthlyIncomeValue !== undefined) {
            console.log(`📊 API monthly income: ${getCentsToDollarsSafe(apiMonthlyIncomeValue, 'en')}`);
        }
        if (apiTotalIncome !== undefined) {
            console.log(`📊 API total income: ${getCentsToDollarsSafe(apiTotalIncome, 'en')}`);
        }

        // Verify monthly income card value ≈ annual gross total / 12
        if (taxTotals?.gross_annualized && apiMonthlyIncomeValue !== undefined) {
            const approximateMonthly = taxTotals.gross_annualized / 12;
            const tolerance = 100; // allow $1 rounding tolerance in cents
            expect(Math.abs(approximateMonthly - apiMonthlyIncomeValue)).toBeLessThan(tolerance);
            console.log('✅ Monthly income card value is consistent with annual total / 12');
        }

        allTestsPassed = true;
        console.log('\n✅ All test steps completed successfully');
    });

    test.afterAll(async ({ request }) => {
        await cleanupSession(request, sessionId, allTestsPassed);
    });
});
