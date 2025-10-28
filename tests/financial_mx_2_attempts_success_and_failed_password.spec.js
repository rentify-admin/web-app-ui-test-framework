import { test, expect } from '@playwright/test';
import loginForm from '~/tests/utils/login-form';
import { admin } from '~/tests/test_config';
import generateSessionForm from '~/tests/utils/generate-session-form';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import config from '~/tests/test_config';
import { joinUrl } from '~/tests/utils/helper.js';
import { waitForJsonResponse } from '~/tests/utils/wait-response';
import { gotoApplicationsPage, searchApplication } from '~/tests/utils/applications-page';

const API_URL = config.app.urls.api;
const APP_URL = config.app.urls.app;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const userData = {
    first_name: 'FinMX',
    last_name: 'Test',
    email: 'finmx_test@verifast.com'
};

test.beforeEach(async ({ page }) => {
    await page.goto("/");
});

test.describe('financial_mx_2_attempts_success_and_failed_password', () => {
    test('Financial - mx - 2 attempts + Eligibility status transitions', {
      tag: ['@regression', '@external-integration', '@eligibility', '@core'],
    }, async ({ page, browser }) => {
        test.setTimeout(350_000); 
        // Step 1: Admin Login and Navigate
        await loginForm.fill(page, admin);
        await loginForm.submitAndSetLocale(page);
        await expect(page).toHaveTitle(/Applicants/, { timeout: 10_000 });

        await gotoApplicationsPage(page);

        // Step 2: Locate Target Application
        const applicationName = 'AutoTest Suite - Fin only'
        await searchApplication(page, applicationName);

        const appNameCol = page.getByTestId('application-table-name-col').filter({
          hasText: applicationName,
        }).first();

        await expect(appNameCol).toHaveText(applicationName);

        const appRow =  await appNameCol.locator('xpath=..')
          .getByTestId('application-table-invite-col')
          .locator('a')

        await appRow.click();

        // Step 3: Generate Session
        await generateSessionForm.fill(page, userData);
        const sessionData = await generateSessionForm.submit(page);

        const linkSection = page.getByTestId('session-invite-link');
        await expect(linkSection).toBeVisible();

        const link = await linkSection.getAttribute('href');
        const sessionId = sessionData.data?.id;
        const sessionUrl = joinUrl(API_URL, `sessions/${sessionId}`);

        // await page.close();

        // Step 4: Applicant View — New Context
        const context = await browser.newContext();
        const applicantPage = await context.newPage();
        await applicantPage.goto(link);

        await applicantPage.locator('input#rent_budget').fill('500');
        await applicantPage.locator('button[type="submit"]').click();

        await applicantPage.waitForResponse(sessionUrl);
        await applicantPage.waitForTimeout(1000);

        // Step 5: Start Financial Verification
        const [financialResponse] = await Promise.all([
          applicantPage.waitForResponse(resp =>
            resp.url().includes('/financial-verifications') &&
            resp.request().method() === 'POST' &&
            resp.ok()
          ),
          applicantPage.getByTestId('connect-bank').click()
        ]);

        const financialData = await waitForJsonResponse(financialResponse);
        expect(financialData).toBeDefined();

        // Step 6: Interact with MX iframe for bank connection
        const mxFrame = applicantPage.frameLocator('iframe[src*="int-widgets.moneydesktop.com"]');
        await expect(mxFrame.locator('[data-test="search-header"]')).toBeVisible({ timeout: 30000 });

        await mxFrame.locator('[data-test="search-input"]').fill('mx bank oau');
        await mxFrame.locator('[data-test="MX-Bank-(OAuth)-row"]').click();
        const [newPage] = await Promise.all([
          context.waitForEvent('page'),
          mxFrame.locator('[data-test="continue-button"]').click(),
        ]);

        await newPage.waitForLoadState('domcontentloaded');
        await newPage.waitForTimeout(3000); // Wait 3 seconds to ensure full load
        await newPage.locator('input[type="submit"][value="Authorize"]').waitFor({ state: 'visible' });
        await newPage.locator('input[type="submit"][value="Authorize"]').click();

        // Wait for OAuth page to close (optional - max 7 seconds)
        try {
            await newPage.waitForEvent('close', { timeout: 7000 });
            console.log('✅ OAuth page closed automatically');
        } catch (error) {
            console.log('⚠️ OAuth page did not close automatically within 7 seconds - continuing test');
            // Continue with test if page doesn't close
        }

        // Poll for done button or iframe closure (more robust than simple wait)
        console.log('⏳ Polling for MX connection completion...');
        const maxPollingAttempts = 80; // 80 attempts = 160 seconds max
        const pollingInterval = 2000; // 2 seconds
        let pollingAttempt = 0;
        let connectionComplete = false;
        let iframeClosedAutomatically = false;
        
        while (!connectionComplete && pollingAttempt < maxPollingAttempts) {
            try {
                // Check if Bank Connect iframe is still visible
                const bankConnectFrame = applicantPage.locator('iframe[title="Bank Connect"]').contentFrame();
                const navigationHeader = bankConnectFrame.locator('[data-test="navigation-header"]');
                const isIframeVisible = await navigationHeader.isVisible().catch(() => false);
                
                if (!isIframeVisible) {
                    // Iframe closed automatically - connection complete
                    console.log(`✅ Bank Connect iframe closed automatically - connection complete (attempt ${pollingAttempt + 1})`);
                    iframeClosedAutomatically = true;
                    connectionComplete = true;
                    break;
                }
                
                // Check if done button is visible
                const doneButton = mxFrame.locator('[data-test="done-button"]');
                const isDoneVisible = await doneButton.isVisible({ timeout: 1000 }).catch(() => false);
                
                if (isDoneVisible) {
                    console.log(`✅ Done button found - clicking (attempt ${pollingAttempt + 1})`);
                    await doneButton.click();
                    connectionComplete = true;
                    break;
                }
                
                pollingAttempt++;
                if (pollingAttempt < maxPollingAttempts) {
                    console.log(`   Attempt ${pollingAttempt}/${maxPollingAttempts}: Still processing...`);
                    await applicantPage.waitForTimeout(pollingInterval);
                }
            } catch (error) {
                pollingAttempt++;
                if (pollingAttempt < maxPollingAttempts) {
                    await applicantPage.waitForTimeout(pollingInterval);
                }
            }
        }
        
        // If polling failed, reload page and check if connection actually completed
        if (!connectionComplete) {
            console.log('⚠️ Iframe polling timeout - checking if connection completed in background...');
            await applicantPage.reload();
            await applicantPage.waitForTimeout(3000);
            
            // Poll for completion status after reload (max 20 seconds)
            const reloadMaxAttempts = 10; // 10 attempts * 2 seconds = 20 seconds
            const reloadPollingInterval = 2000;
            let reloadAttempt = 0;
            
            while (!connectionComplete && reloadAttempt < reloadMaxAttempts) {
                const financialRow = applicantPage.getByTestId('financial-row-status');
                const rowText = await financialRow.textContent().catch(() => '');
                
                if (rowText.includes('Completed')) {
                    console.log(`✅ Connection was completed in background (found after ${reloadAttempt + 1} attempts) - iframe was stuck, continuing...`);
                    connectionComplete = true;
                    iframeClosedAutomatically = true; // Treat as auto-closed for flow continuation
                    break;
                }
                
                reloadAttempt++;
                if (reloadAttempt < reloadMaxAttempts) {
                    console.log(`   Reload check attempt ${reloadAttempt}/${reloadMaxAttempts}: Waiting for completion status...`);
                    await applicantPage.waitForTimeout(reloadPollingInterval);
                }
            }
            
            if (!connectionComplete) {
                throw new Error(`MX connection did not complete after ${maxPollingAttempts * pollingInterval / 1000} seconds and ${reloadMaxAttempts * reloadPollingInterval / 1000} seconds of reload checks`);
            }
        }

        // If iframe closed automatically, we need to re-open it for the second (failed) attempt
        if (iframeClosedAutomatically) {
            console.log('🔄 Iframe closed automatically - re-opening for second connection attempt');
            await applicantPage.waitForTimeout(2000);
            
            // Click connect bank button again to re-open the MX iframe
            const connectBankBtn = applicantPage.getByTestId('connect-bank');
            const isConnectBtnVisible = await connectBankBtn.isVisible().catch(() => false);
            
            if (isConnectBtnVisible) {
                await connectBankBtn.click();
                console.log('   ✅ MX iframe re-opened for second attempt');
                
                // Wait for iframe to load
                const mxFrameReopened = applicantPage.frameLocator('iframe[src*="int-widgets.moneydesktop.com"]');
                await expect(mxFrameReopened.locator('[data-test="search-header"]')).toBeVisible({ timeout: 30000 });
            } else {
                console.log('   ⚠️ Connect button not found - iframe might still be open');
            }
        } else {
            console.log('   ℹ️ Done button clicked - iframe should still be open');
        }

        await applicantPage.waitForTimeout(2000);
        await mxFrame.locator('[data-test="search-input"]').fill('mx bank');
        await mxFrame.locator('[data-test="MX-Bank-row"]').click();
        await mxFrame.locator('#LOGIN').fill('fail_user');
        await mxFrame.locator('#PASSWORD').fill('fail_password');
        await mxFrame.locator('[data-test="credentials-continue"]').click();

        await mxFrame.locator('[data-test="credentials-error-message-box"]').waitFor({ state: 'visible', timeout: 150_000 });
        console.log('✅ Error message displayed for failed credentials');
        
        // Click the close icon after error message
        await applicantPage.getByTestId('connnect-modal-cancel').click();
        await applicantPage.locator('[data-testid="financial-verification-continue-btn"]').click();

        // Wait for summary page
        await expect(applicantPage.locator('h3', { hasText: 'Summary' })).toBeVisible({ timeout: 110_000 });
        console.log('✅ Part 1 Complete: MX connections (1 success + 1 failure)');

        // ===================================================================
        // PART 2: Eligibility Status Transitions (merged from MX_1)
        // ===================================================================
        console.log('\n🎯 Part 2: Testing eligibility status transitions based on income/rent changes');
        
        // Step 6: Switch to admin report view
        console.log('Step 6: Closing applicant page and opening admin report view');
        await applicantPage.close();
        const sessionUrlAdmin = `${APP_URL}/applicants/all/${sessionId}`;
        await page.goto(sessionUrlAdmin);
        await page.bringToFront();
        
        // Wait for income sources to be generated from MX connection
        console.log('   Waiting for income source generation from MX data...');
        await page.waitForTimeout(5000);
        
        const householdStatusAlert = page.getByTestId('household-status-alert');
        await expect(householdStatusAlert).toBeVisible();
        
        // Step 7: Assert initial status - MX income should be sufficient for $500 rent
        console.log('Step 7: Asserting initial status - Meets Criteria');
        
        // Poll for "Meets Criteria" status (max 30 seconds)
        console.log('   ⏳ Polling for "Meets Criteria" status...');
        let initialStatusFound = false;
        const initialStatusMaxAttempts = 15; // 15 attempts * 2 seconds = 30 seconds max
        const initialStatusPollInterval = 2000;
        
        for (let attempt = 0; attempt < initialStatusMaxAttempts; attempt++) {
            const statusText = await householdStatusAlert.textContent();
            
            if (statusText.includes('Meets Criteria')) {
                console.log(`   ✅ Status: Meets Criteria (found after ${attempt + 1} attempts)`);
                initialStatusFound = true;
                break;
            }
            
            if (attempt < initialStatusMaxAttempts - 1) {
                console.log(`   Attempt ${attempt + 1}/${initialStatusMaxAttempts}: Current status "${statusText}", waiting...`);
                await page.waitForTimeout(initialStatusPollInterval);
                
                // Reload every 3 attempts to refresh state
                if (attempt > 0 && attempt % 3 === 0) {
                    console.log('   🔄 Reloading page to refresh session state...');
                    await page.reload();
                    await page.waitForTimeout(2000);
                }
            }
        }
        
        if (!initialStatusFound) {
            const finalStatus = await householdStatusAlert.textContent();
            throw new Error(`Expected "Meets Criteria" but got: "${finalStatus}" after 30 seconds`);
        }
        
        console.log('   ✅ Status: Meets Criteria (MX income sufficient for $500 rent)');
        
        // Step 8: Increase rent to $3000 - Income should become insufficient
        console.log('Step 8: Increasing rent to $3000 (should fail criteria)');
        const editRentIcon = page.getByTestId('rent-budget-edit-btn');
        await expect(editRentIcon).toBeVisible();
        await editRentIcon.click();
        const adminRentBudgetInput = page.locator('#rent-budget-input');
        await adminRentBudgetInput.fill('3000');
        const submitRentBudgetBtn = page.getByTestId('submit-rent-budget');
        await submitRentBudgetBtn.click();
        
        await page.waitForTimeout(2000);
        await page.reload();
        
        // Poll for "Criteria Not Met" status (max 30 seconds)
        console.log('   ⏳ Polling for "Criteria Not Met" status...');
        let statusFound = false;
        const statusMaxAttempts = 15; // 15 attempts * 2 seconds = 30 seconds max
        const statusPollInterval = 2000;
        
        for (let attempt = 0; attempt < statusMaxAttempts; attempt++) {
            const statusText = await householdStatusAlert.textContent();
            
            if (statusText.includes('Criteria Not Met')) {
                console.log(`   ✅ Status: Criteria Not Met (found after ${attempt + 1} attempts)`);
                statusFound = true;
                break;
            }
            
            if (attempt < statusMaxAttempts - 1) {
                console.log(`   Attempt ${attempt + 1}/${statusMaxAttempts}: Current status "${statusText}", waiting...`);
                await page.waitForTimeout(statusPollInterval);
                
                // Reload every 3 attempts to refresh state
                if (attempt > 0 && attempt % 3 === 0) {
                    console.log('   🔄 Reloading page to refresh session state...');
                    await page.reload();
                    await page.waitForTimeout(2000);
                }
            }
        }
        
        if (!statusFound) {
            const finalStatus = await householdStatusAlert.textContent();
            throw new Error(`Expected "Criteria Not Met" but got: "${finalStatus}" after 30 seconds`);
        }
        
        // Step 9: Add manual income source of $3000 - Should meet criteria again
        console.log('Step 9: Adding manual income source $3000 (should meet criteria)');
        await page.getByTestId('income-source-section-header').click();
        await page.getByTestId('income-source-add').click();
        
        const incomeTypeSelect = page.locator('#income_type');
        await incomeTypeSelect.click();
        await incomeTypeSelect.selectOption('OTHER');
        
        // Uncheck 'Calculate average from transactions' if checked
        const calculateAverageCheckbox = page.locator('label.items-center > input[type="checkbox"].form-checkbox');
        if (await calculateAverageCheckbox.isChecked()) {
            await calculateAverageCheckbox.click();
        }
        
        // Fill in the net amount & save
        const netAmountInput = page.locator('#net_amount');
        await netAmountInput.click();
        await netAmountInput.fill('3000');
        
        const incomeSourceUrl = joinUrl(API_URL, 'sessions', sessionId, 'income-sources');
        const [incomeSourceResponse] = await Promise.all([
            page.waitForResponse(resp => 
                resp.url().includes(incomeSourceUrl) &&
                resp.request().method() === 'POST' &&
                resp.ok()
            ),
            page.locator('button[type="submit"].btn.btn-sm.btn-primary.rounded-full:has-text("Save")').click()
        ]);
        
        const { data: incomeSourceData } = await waitForJsonResponse(incomeSourceResponse);
        const incomeSourceId = incomeSourceData.id;
        console.log(`   Created manual income source: ${incomeSourceId}`);
        
        // Wait for income source sync
        await page.waitForTimeout(5000);
        
        // Assert income source is visible
        const incomeSource = page.getByTestId(`income-source-${incomeSourceId}`);
        await expect(incomeSource).toBeVisible();
        
        // Step 10: Verify status changed back to Meets Criteria
        await page.reload();
        await expect(householdStatusAlert).toContainText('Meets Criteria', { timeout: 30000 });
        console.log('   ✅ Status: Meets Criteria (total income now sufficient for $3000 rent)');
        
        console.log('\n✅ Part 2 Complete: Eligibility status transitions validated');
        console.log('🎉 Full test passed: MX connections + Eligibility logic');

    });
});
