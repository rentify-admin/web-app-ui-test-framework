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
import { setupInviteLinkSession, handleOptionalTermsCheckbox, handleOptionalStateModal } from '~/tests/utils/session-flow';
import { cleanupSessionAndContexts } from './utils/cleanup-helper';
import { pollForApprovalStatus } from './utils/polling-helper';

const API_URL = config.app.urls.api;
const APP_URL = config.app.urls.app;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Note: first_name will be auto-prefixed with 'AutoT - ' by the helper
// Note: email will be auto-suffixed with '+autotest' by the helper
const userData = {
    first_name: 'FinMX',
    last_name: 'Test',
    email: 'finmx_test@verifast.com'
};

test.beforeEach(async ({ page }) => {
    await page.goto("/");
});

test.describe('financial_mx_2_attempts_success_and_failed_password', () => {
    // Global state for cleanup
    let createdSessionId = null;
    let applicantContext = null;
    let allTestsPassed = true;

    /**
     * Handle "Bank Connect Information — Please Read" modal that can appear
     * when starting bank connect (MX / Plaid).
     *
     * We look for the "Acknowledge" button and click it so the flow can
     * proceed to the MX iframe and the POST /financial-verifications call.
     * If the modal is not present (older builds), this is a no-op.
     *
     * @param {import('@playwright/test').Page} page
     */
    const handleBankConnectIntroModal = async (page) => {
        const acknowledgeButton = page.getByRole('button', { name: /Acknowledge/i });

        const isVisible = await acknowledgeButton.isVisible().catch(() => false);
        if (!isVisible) {
            return;
        }

        await acknowledgeButton.click({ timeout: 20_000 });
    };

    /**
     * Handle "Can't find your bank or having an issue?" options modal
     * that can appear right after closing the Bank Connect modal.
     *
     * We handle possible delay by polling for the modal for a few seconds.
     * By default we "cancel" it by clicking the X (data-testid="cancel") if present,
     * otherwise we click the "Back" button to dismiss and stay on the current flow.
     * If the modal never appears (older builds), this is a no-op.
     *
     * @param {import('@playwright/test').Page} page
     * @param {'back' | 'plaid'} [option='back']
     */
    const handleBankConnectOptionsModal = async (page, option = 'back') => {
        const maxAttempts = 10;      // e.g. up to ~10s
        const intervalMs = 1000;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const titleLocator = page.getByText("Can't find your bank or having an issue?");
            const titleVisible = await titleLocator.isVisible().catch(() => false);

            if (titleVisible) {
                // Try explicit cancel (X) first
                const cancelIcon = page.getByTestId('cancel');
                const cancelVisible = await cancelIcon.isVisible().catch(() => false);
                if (cancelVisible) {
                    await cancelIcon.click({ timeout: 20_000 });
                    return;
                }

                // Fallback to footer button by text
                const buttonName = option === 'plaid' ? /Connect using Plaid/i : /Back/i;
                const button = page.getByRole('button', { name: buttonName });
                const buttonVisible = await button.isVisible().catch(() => false);
                if (buttonVisible) {
                    await button.click({ timeout: 20_000 });
                    return;
                }
            }

            // Modal not ready yet; wait and retry
            await page.waitForTimeout(intervalMs);
        }
    };

    // Helper function to handle modals after page reload (for applicant pages)
    const handleModalsAfterReload = async (page) => {
        console.log('🔄 Handling modals after reload...');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);
        
        // Handle modals in order: State → Terms (for financial-only apps, no applicant type)
        await handleOptionalStateModal(page);
        await handleOptionalTermsCheckbox(page);
        
        console.log('✅ Modals handled after reload');
    };

    // Helper function to handle modals after page reload (for admin pages - optional)
    const handleModalsAfterReloadAdmin = async (page) => {
        console.log('🔄 Handling modals after admin page reload...');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);
        
        // Admin pages might show modals too, handle them if they appear
        try {
            await handleOptionalStateModal(page);
            await handleOptionalTermsCheckbox(page);
            console.log('✅ Modals handled after admin reload (if any)');
        } catch (error) {
            console.log('⏭️ No modals found after admin reload, continuing...');
        }
    };

    test('Financial - mx - 2 attempts + Eligibility status transitions', {
      tag: ['@regression', '@external-integration', '@eligibility', '@core', '@staging-ready', '@rc-ready'],
    }, async ({ page, browser }) => {
        test.setTimeout(420_000);
        
        try { 
        // Step 1: Admin Login and Navigate
        const adminAuthToken = await loginForm.adminLoginAndNavigate(page, admin);
        expect(adminAuthToken).toBeTruthy();

        await gotoApplicationsPage(page);

        // Step 2: Locate Target Application
        const applicationName = 'AutoTest - Financial Only, MX and Plaid'
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
        createdSessionId = sessionId;  // Store for cleanup
        const sessionUrl = joinUrl(API_URL, `sessions/${sessionId}`);

        // await page.close();

        // Step 4: Applicant View — New Context
        const context = await browser.newContext();
        applicantContext = context;  // Store for cleanup
        const applicantPage = await context.newPage();
        await applicantPage.goto(link);

        // Setup session flow (no applicant type)
        await setupInviteLinkSession(applicantPage);

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
          (async () => {
            const connectBankBtn = applicantPage.getByTestId('connect-bank');
            await expect(connectBankBtn).toBeVisible({ timeout: 10_000 });
            await connectBankBtn.click();

            // NEW: handle bank connect intro modal (Acknowledge)
            await handleBankConnectIntroModal(applicantPage);
          })()
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
            await handleModalsAfterReload(applicantPage);
            await applicantPage.waitForTimeout(2000);
            
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

        // ===================================================================
        // CRITICAL: Close modal after successful connection
        // ===================================================================
        console.log('🔒 Step: Explicitly closing modal after successful OAuth connection...');
        
        // Check if modal is still open and close it
        const bankConnectModal = applicantPage.locator('iframe[title="Bank Connect"]');
        const isModalOpen = await bankConnectModal.isVisible().catch(() => false);
        
        if (isModalOpen) {
            console.log('   Modal is still open - closing it explicitly...');
            // Try to find and click the cancel/close button
            const cancelBtn = applicantPage.getByTestId('connnect-modal-cancel');
            const isCancelVisible = await cancelBtn.isVisible({ timeout: 5000 }).catch(() => false);
            
            if (isCancelVisible) {
                await cancelBtn.click();
                console.log('   ✅ Modal closed via cancel button');
                // Handle follow-up options modal, if it appears
                await handleBankConnectOptionsModal(applicantPage, 'back');
            } else {
                // If cancel button not found, try alternative close methods
                console.log('   ⚠️ Cancel button not found, trying alternative close method...');
                // Press Escape key as fallback
                await applicantPage.keyboard.press('Escape');
                await applicantPage.waitForTimeout(1000);
                console.log('   ✅ Modal closed via Escape key');
            }
        } else {
            console.log('   ✅ Modal already closed');
        }
        
        // Wait a bit for modal to fully close
        await applicantPage.waitForTimeout(2000);
        
        // Verify modal is closed
        const isModalStillOpen = await bankConnectModal.isVisible({ timeout: 2000 }).catch(() => false);
        if (isModalStillOpen) {
            throw new Error('Modal did not close after explicit close action');
        }
        console.log('✅ Modal confirmed closed');

        // ===================================================================
        // CRITICAL: Wait for connection to be correctly recorded
        // ===================================================================
        console.log('⏳ Step: Waiting for successful connection to be correctly recorded...');
        const connectionRecordMaxAttempts = 30; // 30 attempts = 60 seconds max
        const connectionRecordPollInterval = 2000; // 2 seconds
        let connectionRecordAttempt = 0;
        let connectionRecorded = false;
        
        while (!connectionRecorded && connectionRecordAttempt < connectionRecordMaxAttempts) {
            try {
                // Check if connection row exists and shows completed status
                const connectionRow = applicantPage.getByTestId('connection-row');
                const connectionRowCount = await connectionRow.count().catch(() => 0);
                
                if (connectionRowCount > 0) {
                    // Check if at least one connection shows completed status
                    for (let i = 0; i < connectionRowCount; i++) {
                        const rowText = await connectionRow.nth(i).textContent().catch(() => '');
                        const lowerText = rowText.toLowerCase();
                        
                        if (lowerText.includes('completed') || lowerText.includes('complete')) {
                            connectionRecorded = true;
                            console.log(`✅ Successful connection recorded in row ${i + 1} (attempt ${connectionRecordAttempt + 1})`);
                            break;
                        }
                    }
                }
                
                if (!connectionRecorded) {
                    connectionRecordAttempt++;
                    if (connectionRecordAttempt < connectionRecordMaxAttempts) {
                        console.log(`   Attempt ${connectionRecordAttempt}/${connectionRecordMaxAttempts}: Waiting for connection to be recorded...`);
                        await applicantPage.waitForTimeout(connectionRecordPollInterval);
                    }
                }
            } catch (error) {
                connectionRecordAttempt++;
                if (connectionRecordAttempt < connectionRecordMaxAttempts) {
                    console.log(`   ⚠️ Error checking connection record (attempt ${connectionRecordAttempt}): ${error.message}`);
                    await applicantPage.waitForTimeout(connectionRecordPollInterval);
                }
            }
        }
        
        if (!connectionRecorded) {
            throw new Error(`Successful connection was not recorded after ${connectionRecordMaxAttempts * connectionRecordPollInterval / 1000} seconds`);
        }
        
        // Additional wait for UI to fully stabilize
        await applicantPage.waitForTimeout(2000);
        console.log('✅ Connection correctly recorded and UI stabilized');

        // ===================================================================
        // CRITICAL: Open modal again for failed credentials test
        // ===================================================================
        console.log('🔓 Step: Opening modal again for failed credentials test...');
        
        // Click connect bank button to open the modal again
        const connectBankBtn = applicantPage.getByTestId('connect-bank');
        await expect(connectBankBtn).toBeVisible({ timeout: 10000 });
        await connectBankBtn.click();
        console.log('   ✅ Connect bank button clicked');
        
        // Wait for modal to open and iframe to load
        await applicantPage.waitForTimeout(2000);
        const mxFrameReopened = applicantPage.frameLocator('iframe[src*="int-widgets.moneydesktop.com"]');
        await expect(mxFrameReopened.locator('[data-test="search-header"]')).toBeVisible({ timeout: 30000 });
        console.log('✅ Modal reopened and MX iframe loaded');

        // ===================================================================
        // Step: Test failed credentials
        // ===================================================================
        console.log('🧪 Step: Testing failed credentials...');
        await applicantPage.waitForTimeout(1000);
        await mxFrameReopened.locator('[data-test="search-input"]').fill('mx bank');
        await mxFrameReopened.locator('[data-test="MX-Bank-row"]').click();
        await mxFrameReopened.locator('#LOGIN').fill('fail_user');
        await mxFrameReopened.locator('#PASSWORD').fill('fail_password');
        await mxFrameReopened.locator('[data-test="credentials-continue"]').click();

        await mxFrameReopened.locator('[data-test="credentials-error-message-box"]').waitFor({ state: 'visible', timeout: 150_000 });
        console.log('✅ Error message displayed for failed credentials');
        
        // Click the close icon after error message
        await applicantPage.getByTestId('connnect-modal-cancel').click();
        console.log('✅ Modal cancel button clicked');
        // Handle follow-up options modal, if it appears
        await handleBankConnectOptionsModal(applicantPage, 'back');
        
        // Poll for modal closure and connection state stabilization (similar to first connection)
        console.log('⏳ Polling for failed connection state to stabilize...');
        const failedConnectionMaxAttempts = 40; // 40 attempts = 80 seconds max
        const failedConnectionPollInterval = 2000; // 2 seconds
        let failedConnectionAttempt = 0;
        let modalClosed = false;
        let connectionStateStable = false;
        
        while ((!modalClosed || !connectionStateStable) && failedConnectionAttempt < failedConnectionMaxAttempts) {
            try {
                // Check if modal is closed (Bank Connect iframe should not be visible)
                const bankConnectModal = applicantPage.locator('iframe[title="Bank Connect"]');
                const isModalVisible = await bankConnectModal.isVisible().catch(() => false);
                
                if (!isModalVisible && !modalClosed) {
                    console.log(`✅ Bank Connect modal closed (attempt ${failedConnectionAttempt + 1})`);
                    modalClosed = true;
                }
                
                // Check if connection row exists and shows failed/error state
                const connectionRow = applicantPage.getByTestId('connection-row');
                const connectionRowCount = await connectionRow.count().catch(() => 0);
                
                if (connectionRowCount > 0) {
                    // Check connection states across all rows
                    let hasCompletedConnection = false;
                    let hasFailedConnection = false;
                    let hasProcessingConnection = false;
                    
                    for (let i = 0; i < connectionRowCount; i++) {
                        const rowText = await connectionRow.nth(i).textContent().catch(() => '');
                        const lowerText = rowText.toLowerCase();
                        
                        // Check for completed connection (the first successful OAuth connection)
                        if (lowerText.includes('completed') || lowerText.includes('complete')) {
                            hasCompletedConnection = true;
                        }
                        
                        // Check for failed/error connection (the second failed password attempt)
                        if (lowerText.includes('failed') || 
                            lowerText.includes('error') || 
                            lowerText.includes('incomplete') ||
                            lowerText.includes('expired')) {
                            hasFailedConnection = true;
                        }
                        
                        // Check if still processing (connection state not yet finalized)
                        if (lowerText.includes('processing')) {
                            hasProcessingConnection = true;
                        }
                    }
                    
                    // Connection state is stable when:
                    // 1. We have at least one completed connection (first OAuth success)
                    // 2. We have a failed connection OR at least 2 connections total (indicating both attempts were recorded)
                    // 3. No connections are still processing (state is finalized)
                    const hasMultipleConnections = connectionRowCount >= 2;
                    const hasBothStates = hasCompletedConnection && hasFailedConnection;
                    const stateIsFinalized = !hasProcessingConnection;
                    
                    if (hasCompletedConnection && (hasFailedConnection || hasMultipleConnections) && stateIsFinalized) {
                        connectionStateStable = true;
                        console.log(`✅ Connection state stabilized: ${connectionRowCount} connection(s) - Completed: ${hasCompletedConnection}, Failed: ${hasFailedConnection}`);
                    } else if (hasProcessingConnection) {
                        console.log(`   ⏳ Connection(s) still processing (attempt ${failedConnectionAttempt + 1})...`);
                    }
                }
                
                // Check if continue button is visible and ready
                const continueBtn = applicantPage.locator('[data-testid="financial-verification-continue-btn"]');
                const isContinueBtnVisible = await continueBtn.isVisible().catch(() => false);
                
                if (modalClosed && connectionStateStable && isContinueBtnVisible) {
                    console.log('✅ All conditions met: Modal closed, connection state stable, continue button ready');
                    // Wait a bit more for UI to fully stabilize
                    await applicantPage.waitForTimeout(1000);
                    break;
                }
                
                failedConnectionAttempt++;
                if (failedConnectionAttempt < failedConnectionMaxAttempts) {
                    console.log(`   Attempt ${failedConnectionAttempt}/${failedConnectionMaxAttempts}: Modal closed: ${modalClosed}, State stable: ${connectionStateStable}, Continue visible: ${isContinueBtnVisible}`);
                    await applicantPage.waitForTimeout(failedConnectionPollInterval);
                }
            } catch (error) {
                failedConnectionAttempt++;
                if (failedConnectionAttempt < failedConnectionMaxAttempts) {
                    console.log(`   ⚠️ Error during polling (attempt ${failedConnectionAttempt}): ${error.message}`);
                    await applicantPage.waitForTimeout(failedConnectionPollInterval);
                }
            }
        }
        
        // If polling didn't fully stabilize, reload and check again (fallback)
        if (!modalClosed || !connectionStateStable) {
            console.log('⚠️ Connection state not fully stabilized - checking after reload...');
            await applicantPage.reload();
            await handleModalsAfterReload(applicantPage);
            await applicantPage.waitForTimeout(2000);
            
            // Quick verification after reload
            const connectionRow = applicantPage.getByTestId('connection-row');
            const connectionRowCount = await connectionRow.count().catch(() => 0);
            console.log(`   Found ${connectionRowCount} connection row(s) after reload`);
            
            if (connectionRowCount === 0) {
                throw new Error(`No connection rows found after reload - connection state may not have been saved properly`);
            }
        }
        
        // Verify continue button is visible before clicking
        const continueBtn = applicantPage.locator('[data-testid="financial-verification-continue-btn"]');
        await expect(continueBtn).toBeVisible({ timeout: 10000 });
        console.log('✅ Continue button is visible and ready');
        
        await continueBtn.click();

        // Wait for summary page
        await expect(applicantPage.locator('h3', { hasText: 'Summary' })).toBeVisible({ timeout: 110_000 });
        console.log('✅ Part 1 Complete: MX connections (1 success + 1 failure)');
        
        // ===================================================================
        // PART 1.5: Additional Bank Connect Modal (from applicant summary)
        // ===================================================================
        console.log('\n🎯 Part 1.5: Testing additional bank connect modal from applicant summary');
        
        console.log('🚀 Opening additional bank connect modal...');
        await applicantPage.getByTestId('financial-verification-row-expand-toggle').click();
        await applicantPage.waitForTimeout(500);
        
        await applicantPage.getByTestId('additional-connect-bank').click();
        console.log('   ✅ Additional connect button clicked');
        
        const additionalMxFrame = applicantPage.frameLocator('[src*="int-widgets.moneydesktop.com"]');
        await expect(additionalMxFrame.locator('[data-test="MX-Bank-tile"]')).toBeVisible({ timeout: 20_000 });
        console.log('   ✅ MX iframe loaded successfully');
        
        await applicantPage.getByTestId('bank-connect-modal-cancel').click();
        console.log('   ✅ Modal cancelled successfully');
        // Handle follow-up options modal, if it appears
        await handleBankConnectOptionsModal(applicantPage, 'back');
        
        console.log('✅ Part 1.5 Complete: Additional bank connect modal validated');

        // ===================================================================
        // PART 2: Eligibility Status Transitions (merged from MX_1)
        // ===================================================================
        console.log('\n🎯 Part 2: Testing eligibility status transitions based on income/rent changes');
        
        // Step 6: Switch to admin report view
        console.log('Step 6: Opening admin report view');
        const sessionUrlAdmin = `${APP_URL}/applicants/all/${sessionId}`;
        await page.goto(sessionUrlAdmin);
        await page.bringToFront();
        
        // Wait for page to load - Alert button indicates report page is ready
        // Use flexible text matching since button shows count (e.g., "5 Alerts")
        await expect(page.getByRole('button', { name: /alert/i })).toBeVisible({ timeout: 10_000 });
        
        // Wait for income sources to be generated from MX connection
        console.log('   Waiting for income source generation from MX data...');
        await page.waitForTimeout(5000);
        
        // Step 7: Assert initial status (API) - avoids depending on household UI
        console.log('Step 7: Asserting initial status (API) - APPROVED (MX income sufficient for $500 rent)');
        await pollForApprovalStatus(page, sessionId, adminAuthToken, {
            expectedStatus: 'APPROVED',
            apiUrl: API_URL,
            maxPollTime: 120_000
        });
        
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
        await handleModalsAfterReloadAdmin(page);
        // Wait for page to load - Alert button indicates report page is ready
        await expect(page.getByRole('button', { name: /alert/i })).toBeVisible({ timeout: 10_000 });
        
        // Poll for status (API): rent increased, should be rejected
        console.log('   ⏳ Polling for approval_status = REJECTED (API) after rent increased...');
        await pollForApprovalStatus(page, sessionId, adminAuthToken, {
            expectedStatus: 'REJECTED',
            apiUrl: API_URL,
            maxPollTime: 60_000
        });
        
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
        await netAmountInput.fill('6000');
        
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
        
        // Step 10: Verify status changed back to APPROVED (API)
        console.log('Step 10: Verifying status returns to APPROVED (API) after adding manual income...');
        await page.reload();
        await handleModalsAfterReloadAdmin(page);
        // Wait for page to load - Alert button indicates report page is ready
        await expect(page.getByRole('button', { name: /alert/i })).toBeVisible({ timeout: 10_000 });

        await pollForApprovalStatus(page, sessionId, adminAuthToken, {
            expectedStatus: 'APPROVED',
            apiUrl: API_URL,
            maxPollTime: 120_000
        });
        console.log('   ✅ Status: APPROVED (API) after adding manual income');
        
        console.log('\n✅ Part 2 Complete: Eligibility status transitions validated');
        console.log('🎉 Full test passed: MX connections + Additional connect modal + Eligibility logic');

        } catch (error) {
            console.error('❌ Test failed:', error.message);
            allTestsPassed = false;
            throw error;
        }
        // Note: Context cleanup happens in afterAll
    });
    
    // ✅ Centralized cleanup
    test.afterAll(async ({ request }) => {
        await cleanupSessionAndContexts(
            request,
            createdSessionId,
            applicantContext,
            null,  // No admin context
            allTestsPassed
        );
    });
});
