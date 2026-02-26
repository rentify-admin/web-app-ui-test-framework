import { expect } from '@playwright/test';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { waitForJsonResponse } from '~/tests/utils/wait-response';
import { fillMultiselect } from './common';
import { addPrefix, addEmailSuffix } from './naming-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import required dependencies
import { joinUrl } from './helper';
import { app, session as sessionConfig } from '../test_config';
import loginForm from './login-form';
import { findApplicationByNameAndInvite } from './applications-page';
import generateSessionForm from './generate-session-form';
import { getBankStatementCustomPayload } from '../test_files/mock_data/bank-statement-simulator.js';
import { getPaystubVeridocsSimulation } from '../test_files/mock_data/paystub-simulator.js';
import { loginWithGuestUser, simulateVerification } from '../endpoint-utils/session-helpers';
import { personaConnectData } from '../mock-data/identity-payload';
import { customVeriDocsBankStatementData } from '../mock-data/bank-statement-veridocs-payload';
import { createPaystubData } from '../mock-data/paystub-payload';

const SESSION_FIELDS = {
    'fields[session_step]': ':all',
    'fields[session]': 'state,applicant,application,children,target,parent,completion_status,actions,flags,type,role,stakeholder_count,expires_at,extensions',
    'fields[applicant]': 'guest',
    'fields[guest]': ':all',
    'fields[application]': 'name,settings,workflow,eligibility_template,logo',
    'fields[workflow_step]': ':all'
}

/**
 * Complete initial applicant form with rent budget
 * @param {import('@playwright/test').Page} page
 * @param {String} rentBudget
 * @param {String} sessionUrl
 */
const completeApplicantForm = async (page, rentBudget = '500', sessionUrl) => {
    await page.locator('input#rent_budget').fill(rentBudget);

    await Promise.all([
        page.waitForResponse(
            resp => resp.url().includes(sessionUrl)
                && resp.request().method() === 'PATCH'
                && resp.ok()
        ),
        page.locator('button[type="submit"]').click()
    ]);
    await page.waitForTimeout(2000);
};

/**
 * Unified connection completion function with configurable options
 * @param {import('@playwright/test').Page} page
 * @param {Object|Number} options - Configuration options or maxIterations for backward compatibility
 * @param {Number} options.maxIterations - Maximum retry iterations (default: 130 for longer timeout)
 * @param {import('@playwright/test').Locator} options.customLocator - Optional custom locator
 * @param {string} options.selector - CSS selector for connection rows (default: '[data-testid="connection-row"]')
 * @param {string} options.successText - Text to look for indicating completion (default: 'completed')
 * @param {Number} options.timeoutInterval - Time between retries in ms (default: 2000)
 * @param {Function} options.onSuccess - Optional callback when connection completes
 * @param {Function} options.onFailure - Optional callback when connection fails
 * @returns {Boolean} true if completed, false if timeout
 */
const waitForConnectionCompletion = async (page, options = {}) => {
    // Handle backward compatibility: if options is a number, treat it as maxIterations
    if (typeof options === 'number') {
        options = { maxIterations: options };
    }

    const {
        maxIterations = 130,
        customLocator = null,
        selector = '[data-testid="connection-row"]',
        successText = 'completed',
        timeoutInterval = 2000,
        onSuccess = null,
        onFailure = null
    } = options;

    // Use custom locator if provided, otherwise poll for element to be visible (max 40 seconds)
    let connectionRows;
    if (customLocator) {
        connectionRows = customLocator;
    } else {
        const locator = page.locator(selector);
        let elementFound = false;
        const maxAttempts = 40; // 40 attempts * 1000ms = 40 seconds max
        const pollInterval = 1000;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const count = await locator.count();

            if (count > 0) {
                elementFound = true;
                break;
            }

            if (attempt < maxAttempts - 1) {
                await page.waitForTimeout(pollInterval);
            }
        }

        if (!elementFound) {
            throw new Error(`Element with selector "${selector}" not found after 40 seconds`);
        }

        connectionRows = locator;
    }

    const connectionCount = await connectionRows.count();
    await expect(connectionCount).toBeGreaterThan(0);

    console.log('🔄 Waiting for connection status to stabilize...');

    // Step 1: Wait for the "processing" state to appear (to avoid false "completed" state)
    // This handles the app bug where it briefly shows "completed" then changes to "processing"
    let rotation = 0;
    let foundProcessing = false;

    console.log('⏳ Step 1: Waiting for "processing" state to appear...');
    do {
        for (let index = 0; index < await connectionRows.count(); index++) {
            const element = connectionRows.nth(index);
            const connectionText = await element.innerText();
            if (connectionText.toLowerCase().includes('processing')) {
                foundProcessing = true;
                console.log('✅ "Processing" state detected, waiting for it to stabilize...');
                await page.waitForTimeout(2000); // Wait for state to stabilize
                break;
            }
        }
        if (!foundProcessing) {
            await page.waitForTimeout(timeoutInterval);
        }
        rotation++;
    } while (!foundProcessing && rotation < 6);

    if (!foundProcessing) {
        console.log('⚠️ "Processing" state not found, proceeding anyway...');
    }

    // Step 2: Now wait for the real "completed" state
    console.log('⏳ Step 2: Waiting for real "completed" state...');
    rotation = 0;
    let foundCompleted = false;

    do {
        for (let index = 0; index < await connectionRows.count(); index++) {
            const element = connectionRows.nth(index);
            const connectionText = (await element.innerText()).toLowerCase();

            // Treat either the configured successText or "uploaded" as a successful terminal state
            if (
                connectionText.includes(successText.toLowerCase()) ||
                connectionText.includes('uploaded')
            ) {
                foundCompleted = true;
                console.log('✅ Real "completed/uploaded" state detected!');
                await page.waitForTimeout(2000); // Additional wait to ensure stability
                break;
            }
        }
        if (!foundCompleted) {
            await page.waitForTimeout(timeoutInterval);
        }
        rotation++;

        // Add safety check to prevent infinite loops
        if (rotation >= maxIterations) {
            console.log(`⚠️ Maximum iterations (${maxIterations}) reached, forcing completion check`);
            break;
        }
    } while (!foundCompleted);

    if (!foundCompleted) {
        console.log('❌ "Completed" state not found within timeout');
    }

    // Call callbacks if provided
    if (foundCompleted && onSuccess) {
        await onSuccess(page);
    } else if (!foundCompleted && onFailure) {
        await onFailure(page);
    }

    return foundCompleted;
};

/**
 * Wait for Plaid connection completion using unified function
 * @param {import('@playwright/test').Page} page
 * @param {Number} maxIterations - Maximum number of retry iterations (default: 65, total timeout: ~130 seconds)
 * @param {import('@playwright/test').Locator} customLocator - Optional custom locator to use instead of default connection-row
 * @returns {Boolean} true if completed, false if timeout
 */
const waitForPlaidConnectionCompletion = async (page, maxIterations = 100, customLocator = null) => {
    return await waitForConnectionCompletion(page, {
        maxIterations,
        customLocator,
        selector: '[data-testid="connection-row"]',
        successText: 'completed',
        timeoutInterval: 2000,
        onSuccess: async (page) => {
            console.log('✅ Plaid connection completed successfully');
            await page
                .getByTestId('financial-verification-continue-btn')
                .click({ timeout: 20000 });
        },
        onFailure: async (page) => {
            console.log('❌ Plaid connection did not complete within timeout period');
        }
    });
};

/**
 * Wait for paystub connection completion using unified function
 * @param {import('@playwright/test').Page} page
 * @param {Number} timeout - Timeout in milliseconds (default: 20000)
 * @param {import('@playwright/test').Locator} customLocator - Optional custom locator to use instead of default paystub connection row
 * @returns {Boolean} true if completed, false if timeout
 */
const waitForPaystubConnectionCompletion = async (page, timeout = 100_000, customLocator = null) => {
    // Convert timeout to maxIterations (timeout / 2000ms interval)
    const maxIterations = Math.ceil(timeout / 2000);

    return await waitForConnectionCompletion(page, {
        maxIterations,
        customLocator,
        selector: '[data-testid="connection-row-row-status"]',
        successText: 'Completed',
        timeoutInterval: 2000,
        onSuccess: async (page) => {
            console.log('✅ Paystub connection completed successfully');
        },
        onFailure: async (page) => {
            console.log('❌ Paystub connection did not complete within timeout period');
        }
    });
};

/**
 * Wait for simulator (mock) financial connection completion
 * @param {import('@playwright/test').Page} page
 * @param {Number} maxIterations - Maximum number of retry iterations (default: 100)
 * @param {import('@playwright/test').Locator} customLocator - Optional custom locator
 * @returns {Boolean} true if completed, false if timeout
 */
const waitForSimulatorConnectionCompletion = async (page, maxIterations = 100, customLocator = null) => {
    return await waitForConnectionCompletion(page, {
        maxIterations,
        customLocator,
        selector: '[data-testid="connection-row"]',
        successText: 'Complete',
        timeoutInterval: 2000,
        onSuccess: async (page) => {
            console.log('✅ Simulator connection completed successfully');
        },
        onFailure: async (page) => {
            console.log('❌ Simulator connection did not complete within timeout period');
        }
    });
};

/**
 * Continue financial verification process and validate response
 * @param {import('@playwright/test').Page} page
 * @returns {Object} verification data
 */
const continueFinancialVerification = async page => {
    const financialContinueBtn = page.getByTestId(
        'financial-verification-continue-btn'
    );
    await expect(financialContinueBtn).toBeVisible();

    // Scroll to make the button visible in viewport
    await financialContinueBtn.scrollIntoViewIfNeeded();

    const [response] = await Promise.all([
        page.waitForResponse(
            resp => resp.url().includes('/financial-verifications')
                && resp.request().method() === 'GET'
                && resp.ok()
        ),
        financialContinueBtn.click()
    ]);

    const verifications = await waitForJsonResponse(response);
    console.log('🚀 ~ Verifications response:', verifications);

    // Validate verification data
    const verification = verifications.data?.[0];
    if (!verification) {
        throw new Error('No financial verification found in response');
    }

    // Check if verification is completed
    if (verification.status !== 'COMPLETED') {
        throw new Error(
            `Financial verification status is ${verification.status}, expected COMPLETED`
        );
    }

    // For manual uploads (no accounts), we only validate the verification exists and is completed
    if (!verification.accounts || verification.accounts.length === 0) {
        console.log('🚀 ~ Manual upload verification detected (no accounts)');
        return verifications;
    }

    // For bank connections (with accounts), validate account data
    if ((verification.accounts?.[0]?.transaction_count ?? null) === null) {
        throw new Error(
            'Bank Statement Upload Document transactions not found'
        );
    }

    return verifications;
};

const uploadStatementFinancialStep = async (
    page,
    file = 'test_bank_statement.pdf'
) => {
    console.log('🚀 ~ Starting financial statement upload...');

    const financialStep = await page.getByTestId('financial-verification-step');
    await expect(financialStep).toBeVisible();

    const uploadStatementBtn = await page.getByTestId(
        'financial-upload-statement-btn'
    );
    await expect(uploadStatementBtn).toBeVisible();

    console.log('🚀 ~ Clicking upload statement button...');
    await uploadStatementBtn.click();

    const uploadInput = page.locator('#manual-statement-upload');
    await expect(uploadInput).toBeAttached();

    const filePath = join(__dirname, '../test_files', file);
    console.log('🚀 ~ filePath:', filePath);

    await page.waitForTimeout(500);

    console.log('🚀 ~ Setting input files...');
    await uploadInput.setInputFiles(filePath);

    await page.waitForTimeout(2500);

    const manualUploadSubmitBtn = await page.getByTestId(
        'submit-manual-upload-btn'
    );
    await page.waitForTimeout(1000);

    await expect(manualUploadSubmitBtn).toBeEnabled();

    console.log('🚀 ~ Submitting manual upload...');
    const [connectionResponse, verificationResponse] = await Promise.all([
        page.waitForResponse(resp => {
            const isMatch
                = resp.url().endsWith('/financial-verifications')
                && resp.request().method() === 'POST'
                && resp.ok();
            if (isMatch) {
                console.log('🚀 ~ Connection response received:', resp.url());
            }
            return isMatch;
        }),
        page.waitForResponse(resp => {
            const isMatch
                = resp.url().includes('/financial-verifications')
                && resp.request().method() === 'GET'
                && resp.ok();
            if (isMatch) {
                console.log('🚀 ~ Verification response received:', resp.url());
            }
            return isMatch;
        }),
        manualUploadSubmitBtn.click()
    ]);

    console.log('🚀 ~ Processing responses...');
    const { data: financialVerification } = await waitForJsonResponse(
        connectionResponse
    );
    const { data: financialVerifications } = await waitForJsonResponse(
        verificationResponse
    );

    await expect(financialVerification).toBeDefined();
    await expect(financialVerifications).toBeDefined();
    await expect(financialVerifications.length).toBeGreaterThan(0);

    console.log('🚀 ~ Financial verification data:', {
        verificationId: financialVerification?.id,
        verificationsCount: financialVerifications?.length
    });

    // Wait for processing to start
    await expect(page.getByTestId('connection-row').filter({ hasText: "Processing" })).toBeVisible({ timeout: 10000 });

    // Wait for completion
    await waitForConnectionCompletion(page);

    return {
        financialVerification,
        financialVerifications
    };
};




/**
 * Optionally handle state modal if present
 * @param {import('@playwright/test').Page} page
 */
/**
 * Handle optional terms checkbox (appears for some users before session flow)
 * @param {import('@playwright/test').Page} page
 */
const handleOptionalTermsCheckbox = async page => {
    console.log('🔍 Polling for optional terms checkbox...');

    // Wait for page to be ready first
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // ✅ ALWAYS check for state modal FIRST (lightweight check)
    if (await isStateModalVisible(page)) {
        console.log('🔍 State modal visible - handling FIRST before terms polling');
        await handleOptionalStateModal(page);
    }

    const termsCheckbox = page.getByTestId('user-terms');

    // Poll for terms checkbox to appear (max 10 seconds)
    // Check for state modal in each iteration (lightweight)
    let checkboxFound = false;
    const maxAttempts = 20; // 20 attempts * 500ms = 10 seconds max
    const pollInterval = 500;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // ✅ Quick check for state modal FIRST in each polling iteration (lightweight)
        if (await isStateModalVisible(page)) {
            await handleOptionalStateModal(page);
        }

        try {
            const isVisible = await termsCheckbox.isVisible();

            if (isVisible) {
                checkboxFound = true;
                console.log(`✅ Terms checkbox found (after ${attempt + 1} attempts)`);
                break;
            }
        } catch (error) {
            // Continue polling
        }

        if (attempt < maxAttempts - 1) {
            await page.waitForTimeout(pollInterval);
        }
    }

    if (!checkboxFound) {
        console.log('⏭️ Terms checkbox not found after polling, continuing...');
        // ✅ Final lightweight check for state modal before returning
        if (await isStateModalVisible(page)) {
            await handleOptionalStateModal(page);
        }
        return;
    }

    // ✅ Quick check for state modal BEFORE proceeding with terms handling
    if (await isStateModalVisible(page)) {
        await handleOptionalStateModal(page);
    }

    // Checkbox found - proceed with checking and clicking
    try {
        // Click "Continue to Verifast" button and wait for page transition.
        // This click can be intermittently blocked by an overlapping modal/backdrop
        // (e.g. state modal appearing after terms modal is rendered).
        console.log('🚀 Clicking "Continue to Verifast" button...');
        const continueButton = page.getByRole('button', { name: 'Continue to Verifast' });
        await continueButton.waitFor({ state: 'visible', timeout: 10_000 });

        const maxClickAttempts = 4;
        for (let attempt = 1; attempt <= maxClickAttempts; attempt++) {
            // If a state modal appeared on top, handle it before trying to continue.
            await handleOptionalStateModal(page);

            // Re-check terms after any modal interaction (it can reset).
            const isTermsVisible = await termsCheckbox.isVisible().catch(() => false);
            if (isTermsVisible) {
                const isChecked = await termsCheckbox.isChecked().catch(() => false);
                if (!isChecked) {
                    console.log('📝 Checking terms checkbox...');
                    await termsCheckbox.click();
                    await page.waitForTimeout(500);
                    console.log('✅ Terms checkbox checked');
                }
            }

            try {
                // Wait for button to be enabled (not just visible)
                const isEnabled = await continueButton.isEnabled().catch(() => true);
                if (!isEnabled) {
                    console.log('⏳ Button not enabled yet, waiting...');
                    await page.waitForTimeout(1000);
                }

                if (attempt === maxClickAttempts) {
                    // Last attempt: force click to bypass transient overlays.
                    await continueButton.click({ force: true, timeout: 10_000 });
                } else {
                    await continueButton.click({ timeout: 10_000 });
                }

                console.log(`✅ Continue button clicked (attempt ${attempt}/${maxClickAttempts}), waiting for page transition...`);
                break;
            } catch (e) {
                const msg = e?.message || '';
                const isIntercept =
                    msg.includes('intercepts pointer events') ||
                    msg.includes('Element is not attached') ||
                    msg.includes('element is not receiving pointer events');
                if (!isIntercept || attempt === maxClickAttempts) {
                    throw e;
                }
                console.log(`⚠️ Continue click intercepted (attempt ${attempt}/${maxClickAttempts}), handling modals and retrying...`);
                await page.waitForTimeout(500);
            }
        }
        console.log('✅ Continue button clicked, waiting for page transition...');

        // Wait for terms checkbox to disappear (indicates page navigated)
        await termsCheckbox.waitFor({ state: 'hidden', timeout: 10000 });
        console.log('✅ Page transition completed');

        // Additional wait for page to stabilize
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000);
    } catch (error) {
        console.log(`⚠️ Error during terms handling: ${error.message}, continuing...`);
    }
};

/**
 * Setup session flow after navigating to invite link
 * Handles optional modals in correct order based on presence of applicant type selection
 * 
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} options - Configuration options
 * @param {string} [options.sessionUrl] - Required if applicantTypeSelector is provided
 * @param {string} [options.applicantTypeSelector] - CSS selector for applicant type (e.g., '#employed', '#affordable_occupant', '#affordable_primary')
 * @param {boolean} [options.skipTerms=false] - Skip terms modal handling
 * @param {boolean} [options.skipState=false] - Skip state modal handling
 * @returns {Promise<void>}
 * 
 * @example
 * // With applicant type selection:
 * await setupInviteLinkSession(page, {
 *     sessionUrl: 'https://api.../sessions/123',
 *     applicantTypeSelector: '#employed'
 * });
 * 
 * @example
 * // Without applicant type (financial-only apps):
 * await setupInviteLinkSession(page);
 * 
 * @example
 * // Co-applicant with explicit default:
 * await setupInviteLinkSession(coAppPage, {
 *     sessionUrl: coAppSessionApiUrl,
 *     applicantTypeSelector: '#affordable_primary'
 * });
 */
const setupInviteLinkSession = async (page, options = {}) => {
    const {
        sessionUrl = null,
        applicantTypeSelector = null,
        skipTerms = false,
        skipState = false
    } = options;

    // PATTERN 1: WITH applicant type selection
    // Order: Terms → ApplicantType → State
    if (applicantTypeSelector !== null) {
        if (!sessionUrl) {
            throw new Error('setupInviteLinkSession: sessionUrl is required when applicantTypeSelector is provided');
        }

        console.log('🚀 Session setup: WITH applicant type selection');

        // Step 1: Terms modal (appears FIRST, before applicant type)
        // Use individual handler here since terms appears before applicant type selection
        if (!skipTerms) {
            console.log('  → [1/3] Handling optional terms checkbox');
            await handleOptionalTermsCheckbox(page);
        }

        // Step 2: Applicant type selection
        console.log(`  → [2/3] Selecting applicant type: ${applicantTypeSelector}`);
        await selectApplicantType(page, sessionUrl, applicantTypeSelector);

        // Step 3: State modal (appears AFTER applicant type selection)
        // After applicant type, state modal might appear with delay, so use unified handler
        // But we only need to check for state modal (terms already handled)
        if (!skipState) {
            console.log('  → [3/3] Handling optional state modal (with race condition protection)');
            // Use unified handler but only for state modal (terms already handled)
            await handleModalsWithRaceConditionFix(page, {
                maxWaitTime: 10000,
                skipTerms: true // Terms already handled in step 1
            });
        }

        console.log('✅ Session setup complete (with applicant type)');
    }
    // PATTERN 2: NO applicant type selection
    // Order: State → Terms (but handle race condition)
    else {
        console.log('🚀 Session setup: NO applicant type selection');

        // Use unified handler to avoid race condition between state modal and terms
        if (!skipState && !skipTerms) {
            console.log('  → [1/1] Handling modals with race condition fix (State → Terms)');
            await handleModalsWithRaceConditionFix(page);
        } else if (!skipState) {
            console.log('  → [1/1] Handling optional state modal');
            await handleOptionalStateModal(page);
        } else if (!skipTerms) {
            console.log('  → [1/1] Handling optional terms checkbox');
            await handleOptionalTermsCheckbox(page);
        }

        console.log('✅ Session setup complete (no applicant type)');
    }
};

/**
 * Unified handler that polls for both state modal and terms checkbox simultaneously
 * Handles race condition where state modal appears with delay
 * @param {import('@playwright/test').Page} page
 * @param {Object} options
 * @param {number} options.maxWaitTime - Maximum time to wait for modals (default: 15000ms)
 * @param {number} options.pollInterval - Polling interval (default: 500ms)
 * @returns {Promise<void>}
 */
const handleModalsWithRaceConditionFix = async (page, options = {}) => {
    const { maxWaitTime = 15000, pollInterval = 500, skipTerms = false, skipState = false } = options;
    const maxAttempts = Math.ceil(maxWaitTime / pollInterval);

    console.log('🔍 Polling for modals (state modal and terms checkbox)...');

    // Wait for page to be fully loaded
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Use .first() to avoid strict mode violation (modal container and form both have same test-id)
    const stateModal = page.getByTestId('state-modal').first();
    const termsCheckbox = page.getByTestId('user-terms');

    let stateModalHandled = false;
    let termsHandled = false;

    // Poll for both modals simultaneously
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        let stateVisible = false;
        let termsVisible = false;

        // Check for state modal - use waitFor with visible state instead of isVisible
        // This is more reliable as it waits for the element to actually become visible
        // Modal might be in DOM but not yet visible due to CSS transitions
        if (!stateModalHandled && !skipState) {
            try {
                // First check if element exists in DOM
                const stateModalCount = await stateModal.count();
                if (stateModalCount > 0) {
                    // Element exists in DOM - try multiple approaches to detect visibility
                    // Approach 1: Wait for modal to be visible
                    try {
                        await stateModal.waitFor({ state: 'visible', timeout: 2000 });
                        const isActuallyVisible = await stateModal.isVisible();
                        if (isActuallyVisible) {
                            stateVisible = true;
                        }
                    } catch (waitError) {
                        // waitFor failed, try fallback: check if submit button is visible
                        // This is a more reliable indicator that modal is actually interactive
                        const submitButton = page.getByTestId('submit-state-modal-form');
                        try {
                            const submitCount = await submitButton.count();
                            if (submitCount > 0) {
                                await submitButton.waitFor({ state: 'visible', timeout: 1000 });
                                const submitVisible = await submitButton.isVisible();
                                if (submitVisible) {
                                    // Submit button is visible, modal must be visible too
                                    stateVisible = true;
                                }
                            }
                        } catch (submitError) {
                            // Submit button not visible either, continue polling
                        }
                    }
                }
            } catch (error) {
                // State modal not visible yet or doesn't exist - continue polling
                // This is expected during initial render, so we continue
            }
        }

        // Check for terms checkbox (only check if state modal is not currently visible)
        if (!termsHandled && !stateVisible && !skipTerms) {
            try {
                // First check if element exists in DOM
                const termsCount = await termsCheckbox.count();
                if (termsCount > 0) {
                    // Element exists in DOM - wait for it to become visible
                    await termsCheckbox.waitFor({ state: 'visible', timeout: 2000 });
                    // Double-check visibility after waitFor succeeds
                    const isActuallyVisible = await termsCheckbox.isVisible();
                    if (isActuallyVisible) {
                        termsVisible = true;
                    }
                }
            } catch (error) {
                // Terms checkbox not visible yet or doesn't exist - continue polling
            }
        }

        // Handle state modal first if it appears (higher priority)
        if (stateVisible && !stateModalHandled) {
            console.log(`✅ State modal found and visible (attempt ${attempt + 1}/${maxAttempts})`);
            await handleStateModalInternal(page);
            stateModalHandled = true;
            // Wait for state modal to fully close before checking for terms
            try {
                await stateModal.waitFor({ state: 'hidden', timeout: 5000 });
            } catch (error) {
                // Modal might have closed already or timeout, continue
            }
            await page.waitForTimeout(1000);
            // Continue polling to check for terms after state modal is closed
            continue;
        }

        // Handle terms checkbox if it appears (and state modal is not visible)
        if (termsVisible && !termsHandled && !stateVisible) {
            console.log(`✅ Terms checkbox found and visible (attempt ${attempt + 1}/${maxAttempts})`);
            await handleTermsCheckboxInternal(page);
            termsHandled = true;
            break; // Terms handled, we're done
        }

        // If state modal was just handled, continue polling for terms
        if (stateModalHandled && !termsHandled) {
            // Continue polling for terms
            await page.waitForTimeout(pollInterval);
            continue;
        }

        // If neither modal is visible yet, wait and retry
        if (!stateVisible && !termsVisible) {
            await page.waitForTimeout(pollInterval);
        }

        // If we've handled both or terms is handled, we're done
        if ((stateModalHandled && termsHandled) || termsHandled) {
            break;
        }
    }

    if (!stateModalHandled && !termsHandled) {
        console.log('⏭️ No modals found after polling, continuing...');
    } else {
        console.log('✅ Modals handled successfully');
    }
};

/**
 * Internal handler for state modal (extracted for reuse)
 * @param {import('@playwright/test').Page} page
 */
const handleStateModalInternal = async page => {
    // Use .first() to avoid strict mode violation (modal container and form both have same test-id)
    const stateModal = page.getByTestId('state-modal').first();

    // Wait for modal to be fully visible - use longer timeout and ensure it's actually visible
    // The modal might exist in DOM but not be visible yet due to CSS transitions
    try {
        await stateModal.waitFor({ state: 'visible', timeout: 5000 });
    } catch (error) {
        // If waitFor fails, try checking if it exists and is attached
        const count = await stateModal.count();
        if (count === 0) {
            throw new Error('State modal not found in DOM');
        }
        // Element exists, wait a bit more for visibility
        await page.waitForTimeout(1000);
        // Try one more time
        await stateModal.waitFor({ state: 'visible', timeout: 3000 });
    }
    await page.waitForTimeout(1000);

    // Check if first state is already "US"
    // Scope selector to state modal country select to avoid matching other multiselects
    let firstStateText = null;
    const countrySelect = page.getByTestId('state-modal-country-select');
    const multiselectSingle = countrySelect.locator('.multiselect__single');

    // Check if element exists and is visible before reading text
    try {
        const count = await multiselectSingle.count();
        if (count > 0) {
            const isVisible = await multiselectSingle.first().isVisible().catch(() => false);
            if (isVisible) {
                firstStateText = await multiselectSingle.first().textContent().catch(() => null);
            }
        }
    } catch (error) {
        console.log('⚠️ Could not read country select text, assuming not US:', error.message);
        firstStateText = null;
    }

    if (firstStateText && firstStateText.trim() === 'US') {
        // First state is already US, skip country selection entirely
        // DO NOT click on country dropdown - it will deselect US
        console.log('✅ Country is already US, skipping country selection and proceeding to state selection');
    } else {
        // First state is not US or empty, select country first
        console.log('🌍 Selecting country (not US or empty)');
        const countryListbox = page.locator('#listbox-state-modal-country-select');
        const countryListboxParent = countryListbox.locator('..');
        const countryIsHidden = await countryListboxParent.evaluate(el => {
            const style = window.getComputedStyle(el);
            return style.display === 'none';
        });

        if (countryIsHidden) {
            await page.getByTestId('state-modal-country-select').click();
        }
        await page.waitForTimeout(500);
        await page.keyboard.press('Enter');
        // Wait for state dropdown to be ready after country selection
        await page.waitForTimeout(1000);
    }

    // Click state select multiselect if dropdown is closed
    // Wait for state select to be ready (especially if country was already US)
    await page.waitForTimeout(500);
    const stateListbox = page.locator('#listbox-state-modal-state-select');
    const stateListboxParent = stateListbox.locator('..');
    const stateIsHidden = await stateListboxParent.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.display === 'none';
    });

    if (stateIsHidden) {
        await page.getByTestId('state-modal-state-select').click();
    }

    // Wait 500ms
    await page.waitForTimeout(500);

    // Press Enter
    await page.keyboard.press('Enter');

    // Click submit state modal
    await page.getByTestId('submit-state-modal-form').click();
    await page.waitForTimeout(4000);
    console.log('✅ State modal handled');
};

/**
 * Internal handler for terms checkbox (extracted for reuse)
 * @param {import('@playwright/test').Page} page
 */
const handleTermsCheckboxInternal = async page => {
    // ✅ ALWAYS check for state modal FIRST before handling terms (lightweight check)
    if (await isStateModalVisible(page)) {
        console.log('🔍 State modal visible - handling FIRST before terms');
        await handleOptionalStateModal(page);
    }

    const termsCheckbox = page.getByTestId('user-terms');

    // Wait for FullLoader to disappear before interacting with checkbox
    // FullLoader has z-[1072] and can intercept pointer events
    const fullLoader = page.locator('.backdrop-blur-sm.fixed.flex.h-screen.items-center.justify-center.w-screen.z-\\[1072\\]');
    try {
        // Wait for loader to disappear (max 10 seconds)
        await fullLoader.waitFor({ state: 'hidden', timeout: 10000 });
        console.log('✅ FullLoader disappeared');
    } catch (error) {
        // Loader might not be present, continue
        const isLoaderVisible = await fullLoader.isVisible().catch(() => false);
        if (isLoaderVisible) {
            console.log('⚠️ FullLoader still visible, waiting a bit more...');
            await page.waitForTimeout(2000);
        }
    }

    // Quick check for state modal after loader (lightweight)
    if (await isStateModalVisible(page)) {
        await handleOptionalStateModal(page);
    }

    // Wait for checkbox to be visible and stable
    await termsCheckbox.waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(500); // Additional wait for stability

    // Quick check for state modal before proceeding (lightweight)
    if (await isStateModalVisible(page)) {
        await handleOptionalStateModal(page);
    }

    const isChecked = await termsCheckbox.isChecked();

    if (!isChecked) {
        console.log('📝 Checking terms checkbox...');

        // Add retry logic for checkbox click (similar to continue button)
        const maxCheckboxAttempts = 4;
        for (let attempt = 1; attempt <= maxCheckboxAttempts; attempt++) {
            try {
                // Re-check if loader appeared again
                const loaderVisible = await fullLoader.isVisible().catch(() => false);
                if (loaderVisible) {
                    console.log(`⏳ FullLoader visible, waiting... (attempt ${attempt}/${maxCheckboxAttempts})`);
                    await fullLoader.waitFor({ state: 'hidden', timeout: 5000 });
                }

                // Re-locate checkbox in case of navigation
                const currentCheckbox = page.getByTestId('user-terms');
                await currentCheckbox.waitFor({ state: 'visible', timeout: 2000 });

                if (attempt === maxCheckboxAttempts) {
                    await currentCheckbox.click({ force: true, timeout: 10_000 });
                } else {
                    await currentCheckbox.click({ timeout: 10_000 });
                }
                await page.waitForTimeout(500);
                console.log(`✅ Terms checkbox checked (attempt ${attempt}/${maxCheckboxAttempts})`);
                break;
            } catch (e) {
                const msg = e?.message || '';
                const isIntercept =
                    msg.includes('intercepts pointer events') ||
                    msg.includes('Element is not attached') ||
                    msg.includes('element is not receiving pointer events') ||
                    msg.includes('Test ended');
                if (!isIntercept || attempt === maxCheckboxAttempts) {
                    throw e;
                }
                console.log(`⚠️ Checkbox click intercepted (attempt ${attempt}/${maxCheckboxAttempts}), retrying...`);
                await page.waitForTimeout(1000);
            }
        }
    } else {
        console.log('✅ Terms checkbox already checked');
    }

    // Click "Continue to Verifast" button and wait for page transition
    console.log('🚀 Clicking "Continue to Verifast" button...');
    const continueButton = page.getByRole('button', { name: 'Continue to Verifast' });

    // Wait for button to be enabled (not just visible)
    await continueButton.waitFor({ state: 'visible', timeout: 5000 });
    const maxClickAttempts = 4;
    for (let attempt = 1; attempt <= maxClickAttempts; attempt++) {
        // ✅ Quick check for state modal (lightweight) - handle if present
        if (await isStateModalVisible(page)) {
            await handleOptionalStateModal(page);
        }

        // Terms can become unchecked after modal interaction; re-check if needed.
        const isTermsVisible = await termsCheckbox.isVisible().catch(() => false);
        if (isTermsVisible) {
            const isCheckedNow = await termsCheckbox.isChecked().catch(() => false);
            if (!isCheckedNow) {
                console.log('📝 Checking terms checkbox...');
                await termsCheckbox.click();
                await page.waitForTimeout(500);
                console.log('✅ Terms checkbox checked');
            }
        }

        try {
            const isEnabled = await continueButton.isEnabled().catch(() => true);
            if (!isEnabled) {
                console.log('⏳ Button not enabled yet, waiting...');
                await page.waitForTimeout(1000);
            }

            if (attempt === maxClickAttempts) {
                await continueButton.click({ force: true, timeout: 10_000 });
            } else {
                await continueButton.click({ timeout: 10_000 });
            }
            console.log(`✅ Continue button clicked (attempt ${attempt}/${maxClickAttempts}), waiting for page transition...`);
            break;
        } catch (e) {
            const msg = e?.message || '';
            const isIntercept =
                msg.includes('intercepts pointer events') ||
                msg.includes('Element is not attached') ||
                msg.includes('element is not receiving pointer events');
            if (!isIntercept || attempt === maxClickAttempts) {
                throw e;
            }
            console.log(`⚠️ Continue click intercepted (attempt ${attempt}/${maxClickAttempts}), handling modals and retrying...`);
            await page.waitForTimeout(500);
        }
    }

    // Wait for terms checkbox to disappear (indicates page navigated)
    await termsCheckbox.waitFor({ state: 'hidden', timeout: 10000 });
    console.log('✅ Page transition completed');

    // Additional wait for page to stabilize
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    console.log('✅ Terms checkbox handled');
};

/**
 * Quick check if state modal is visible (lightweight, no waits if not visible)
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<boolean>} true if modal is visible, false otherwise
 */
const isStateModalVisible = async page => {
    const stateModal = page.getByTestId('state-modal').first();
    try {
        // Quick check with short timeout - don't wait if not visible
        const count = await stateModal.count();
        if (count === 0) return false;

        // Use isVisible() which is faster than waitFor
        const visible = await stateModal.isVisible({ timeout: 500 });
        return visible;
    } catch (error) {
        return false;
    }
};

/**
 * Handle optional state modal (backward compatibility wrapper)
 * @param {import('@playwright/test').Page} page
 */
const handleOptionalStateModal = async page => {
    // Use lightweight check first - avoid expensive waits if modal not visible
    const isVisible = await isStateModalVisible(page);

    if (!isVisible) {
        // Quick exit - no waits if modal not visible
        return;
    }

    // Modal is visible - now do full wait to ensure it's stable
    const stateModal = page.getByTestId('state-modal').first();
    try {
        await stateModal.waitFor({ state: 'visible', timeout: 2000 });
        await handleStateModalInternal(page);
    } catch (error) {
        // Modal might have disappeared, continue
        console.log('⏭️ State modal disappeared before handling');
    }
};


/**
 * Complete Atomic Employment Connect flow for Walmart Pay Stub
 * @param {import('@playwright/test').FrameLocator} atomicFrame
 * @param {Object} [options]
 * @param {string} [options.username]
 * @param {string} [options.password]
 * @param {string} [options.employer]
 * @param {string} [options.radioOption]
 */
const employmentVerificationWalmartPayStub = async (
    atomicFrame,
    {
        username = 'test-good',
        password = 'dfdsfsff',
        employer = 'walmart',
        radioOption = 'Homeoffice'
    } = {}
) => {
    await expect(atomicFrame.locator('[data-test-id="continue"]')).toBeVisible({ timeout: 20000 });
    await atomicFrame.locator('[data-test-id="continue"]').click();

    await atomicFrame.locator('[data-test-id="search"]').fill(employer);
    await atomicFrame
        .locator('.default-item-content', { hasText: employer.charAt(0).toUpperCase() + employer.slice(1) })
        .click();

    await atomicFrame.locator('[data-test-id="input-username"]').fill(username);
    await atomicFrame.locator('[data-test-id="continue"]').click();
    await atomicFrame.locator('[data-test-id="input-password"]').fill(password);
    await atomicFrame.locator('[data-test-id="continue"]').click();
    await atomicFrame.locator(`span.title:has-text("${radioOption}")`).click();
    await atomicFrame.locator('[data-test-id="continue"]').click();
};

/**
 * Skip employment verification step
 * @param {import('@playwright/test').Page} page
 */
const skipEmploymentVerification = async page => {

    // Poll for employment verification skip button to be visible (max 30 seconds)
    const skipButton = page.locator('button:has-text("Skip Employment Verification")');
    let buttonFound = false;
    const maxAttempts = 60; // 60 attempts * 500ms = 30 seconds max
    const pollInterval = 500;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const isVisible = await skipButton.isVisible();

        if (isVisible) {
            buttonFound = true;
            break;
        }

        if (attempt < maxAttempts - 1) {
            await page.waitForTimeout(pollInterval);
        }
    }

    if (!buttonFound) {
        throw new Error('Skip Employment Verification button not found after 30 seconds');
    }

    // Click skip employment verification button
    await skipButton.click();

    // Handle skip reason modal if it appears
    await handleSkipReasonModal(page, "Skipping employment verification step for test purposes");

    // Wait for confirmation if needed
    await page.waitForTimeout(1000);

    // Click any additional confirmation button if present
    const confirmButton = page
        .locator('button.btn-slate')
        .filter({ hasText: 'Skip Employment Verification' });
    if (await confirmButton.isVisible()) {
        await confirmButton.click();
    }
};

/**
 * Handle bank connect info modal that may appear after clicking connect-bank
 * @param {import('@playwright/test').Page} page
 */
const handleBankConnectInfoModal = async (page) => {
    const maxAttempts = 10;      // up to ~10 seconds
    const intervalMs = 1000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const dialog = page.getByRole('dialog');
        const dialogVisible = await dialog.isVisible().catch(() => false);

        if (dialogVisible) {
            const titleVisible = await dialog
                .getByText('Bank Connect Information — Please Read')
                .isVisible()
                .catch(() => false);

            if (titleVisible) {
                const acknowledgeBtn = dialog.getByRole('button', { name: /Acknowledge/i });
                const btnVisible = await acknowledgeBtn.isVisible().catch(() => false);
                if (btnVisible) {
                    await acknowledgeBtn.click({ timeout: 20_000 });
                    await page.waitForTimeout(500);
                    return;
                }
            }
        }

        await page.waitForTimeout(intervalMs);
    }
};

/**
 * Handle "Can't find your bank or having an issue?" options modal
 * that can appear right after closing the Bank Connect modal.
 *
 * We handle possible delay by polling for the modal for a few seconds.
 * To avoid flaky DOM detaches on the X icon, we prefer clicking the
 * footer "Back" / "Connect using Plaid" button inside the dialog,
 * and only fall back to the X if needed.
 * If the modal never appears (older builds), this is a no-op.
 *
 * @param {import('@playwright/test').Page} page
 * @param {'back' | 'plaid'} [option='back']
 */
const handleBankConnectOptionsModal = async (page, option = 'back') => {
    const maxAttempts = 10;      // e.g. up to ~10s
    const intervalMs = 1000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const dialog = page.getByRole('dialog');
        const dialogVisible = await dialog.isVisible().catch(() => false);

        if (dialogVisible) {
            const titleLocator = dialog.getByText("Can't find your bank or having an issue?");
            const titleVisible = await titleLocator.isVisible().catch(() => false);

            if (titleVisible) {
                // Prefer stable footer button inside this dialog
                const buttonName = option === 'plaid' ? /Connect using Plaid/i : /Back/i;
                const button = dialog.getByRole('button', { name: buttonName });
                const buttonVisible = await button.isVisible().catch(() => false);

                if (buttonVisible) {
                    try {
                        await button.click({ timeout: 10_000 });
                        await page.waitForTimeout(500);
                        return;
                    } catch (error) {
                        // If button click fails, try fallback
                        console.log('⚠️ Button click failed, trying fallback...');
                    }
                }
            }
        }

        await page.waitForTimeout(intervalMs);
    }
};

/**
 * Complete Plaid financial connection flow
 * @param {import('@playwright/test').Page} page
 * @param {Object} options
 * @param {string} [options.username]
 * @param {string} [options.password]
 * @param {string} [options.bankName]
 */
const plaidFinancialConnect = async (
    page,
    {
        username = 'custom_onetxn',
        password = 'test',
        bankName = 'Betterment'
    } = {}
) => {
    // Step 1: Click primary connect-bank button (opens MX modal)
    await page.getByTestId('connect-bank').click();

    // Step 2: Handle bank connect info modal (if appears)
    await handleBankConnectInfoModal(page);

    // Step 3: Wait for MX iframe and close it
    await page.waitForSelector('iframe[src*="int-widgets.moneydesktop.com"]', { timeout: 30000 });
    await page.getByTestId('connnect-modal-cancel').click();

    // Step 4: Handle connection issue modal (click "Connect using Plaid" to directly trigger Plaid)
    await handleBankConnectOptionsModal(page, 'plaid');

    // Wait for Plaid iframe to load
    await page.waitForSelector('#plaid-link-iframe-1', { timeout: 60000 });
    await page.waitForTimeout(3000);
    const plaidFrame = page.frameLocator('[id="plaid-link-iframe-1"]').locator('reach-portal');

    // Click "Continue as guest"
    await expect(
        plaidFrame.locator('button[id="aut-secondary-button"]')
    ).toBeVisible({ timeout: 20000 });
    await plaidFrame.locator('button[id="aut-secondary-button"]').click();

    // Search for Betterment
    try {
        const searchBox = plaidFrame.getByRole('textbox', { name: 'Search' });
        await expect(searchBox).toBeVisible({ timeout: 30000 });
        await searchBox.fill('Betterment');
        await page.waitForTimeout(2000);
    } catch (error) {
        // Search box not found, continue
    }

    // Click Betterment button
    await expect(
        plaidFrame.locator('[aria-label="Betterment"]')
    ).toBeVisible({ timeout: 10000 });
    await plaidFrame.locator('[aria-label="Betterment"]').click();

    // Fill username
    await plaidFrame.locator('#aut-input-0-input').fill(username);

    // Fill password
    await plaidFrame.locator('#aut-input-1-input').fill(password);

    // Click aut-button (Betterment flow)
    await plaidFrame.locator('#aut-button').click({ timeout: 20000 });

    // Wait for the button to be enabled and click it
    await plaidFrame
        .locator('#aut-button:not([disabled])')
        .click({ timeout: 20000 });

    // Click "Allow" button (optional - may not appear)
    try {
        await expect(
            plaidFrame.getByRole('button', { name: 'Allow' })
        ).toBeVisible({ timeout: 5000 });
        await plaidFrame.getByRole('button', { name: 'Allow' }).click();
        console.log('✅ Plaid "Allow" button clicked');
    } catch (error) {
        console.log('ℹ️  Plaid "Allow" button not present - continuing');
    }

    // Click "Finish without saving"
    await expect(
        plaidFrame.locator(
            'button[id="aut-secondary-button"]:has-text("Finish without saving")'
        )
    ).toBeVisible({ timeout: 10000 });
    await plaidFrame
        .locator(
            'button[id="aut-secondary-button"]:has-text("Finish without saving")'
        )
        .click();

    // Wait 3 seconds and ensure Plaid iframe is closed
    await page.waitForTimeout(3000);
    await expect(page.locator('[id="plaid-link-iframe-1"]')).not.toBeVisible({ timeout: 5000 });
    console.log('✅ Plaid iframe closed successfully');

    // Wait for connection status to change from "Processing" to "Complete"
    await expect(
        page.getByTestId('connection-row').filter({ hasText: "Complete" })
    ).toBeVisible({ timeout: 100_000 });

    await page
        .getByTestId('financial-verification-continue-btn')
        .click();
};

/**
 * Complete applicant registration form after OTP verification
 * @param {import('@playwright/test').Page} page
 * @param {Object} userData - User registration data
 * @param {string} userData.firstName - First name
 * @param {string} userData.lastName - Last name
 * @param {string} userData.state - State selection (e.g., 'ALASKA')
 */
const completeApplicantRegistrationForm = async (
    page,
    { firstName = 'teset', lastName = 'testrelogin', state = 'ALASKA' } = {}
) => {

    // Fill first name with 'AutoT - ' prefix
    await page.locator('#first_name').fill(addPrefix(firstName));

    // Fill last name
    await page.locator('#last_name').fill(lastName);

    // Select state/household size
    await page
        .locator(
            'div:nth-of-type(3) > div > div:nth-of-type(2) > .items-center'
        )
        .click();
    await page
        .getByRole('option', { name: state })
        .locator('span')
        .first()
        .click();

    // Accept terms
    await page.locator('#terms').click();

    // Submit form
    await page.locator('button[type="submit"]').click();
};

/**
 * Skip applicants step
 * @param {import('@playwright/test').Page} page
 */
const skipApplicants = async page => {

    // Wait for applicants step to be visible
    await expect(page.getByRole('button', { name: 'Skip' })).toBeVisible({ timeout: 20000 });
    await page.getByRole('button', { name: 'Skip' }).click();

    // Handle skip reason modal if it appears
    await handleSkipReasonModal(page, "Skipping applicants step for test purposes");
};

/**
 * Complete ID verification process using Persona flow
 * @param {import('@playwright/test').Page} page
 * @param {string} documentType - 'passport', 'driver_license', etc.
 */
const completeIdVerification = async (page, shouldUpload = true) => {

    // Wait for ID verification step to be visible
    await expect(
        page.getByTestId('start-id-verification')
    ).toBeVisible({ timeout: 20000 });

    // Start ID verification and wait for API response
    const [identityVerificationResponse] = await Promise.all([
        page.waitForResponse(
            resp => resp.url().includes('/identity-verifications')
                && resp.request().method() === 'POST'
                && resp.ok()
        ),
        page.getByTestId('start-id-verification').click()
    ]);

    // Wait for Persona iframe to load
    await page.waitForSelector('[data-testid="persona-widget__iframe"]', { timeout: 15000 });
    const personaFrame = page.frameLocator(
        '[data-testid="persona-widget__iframe"]'
    );

    // 1. Click "Begin verifying" button
    await expect(
        personaFrame.locator(
            '[data-test="button__primary"]:has-text("Begin verifying")'
        )
    ).toBeVisible({ timeout: 10000 });
    await personaFrame
        .locator('[data-test="button__primary"]:has-text("Begin verifying")')
        .click();

    await personaFrame.locator('[title="XIcon"]').click();

    // 2. Click "Select" button
    await expect(
        personaFrame.locator('[data-test="button__primary"]:has-text("Select")')
    ).toBeVisible({ timeout: 10000 });
    await personaFrame
        .locator('[data-test="button__primary"]:has-text("Select")')
        .click();

    // 3. Click passport option
    await expect(personaFrame.locator('#select__option--pp')).toBeVisible({ timeout: 10000 });
    await personaFrame.locator('#select__option--pp').click();

    // Check if should upload document
    if (!shouldUpload) {
        console.log('⏭️ Skipping document upload as shouldUpload is false');
        return;
    }

    // 4. Click "Upload a photo" button
    await expect(
        personaFrame.locator(
            '[data-test="button__children"]:has-text("Upload a photo")'
        )
    ).toBeVisible({ timeout: 10000 });
    await personaFrame
        .locator('[data-test="button__children"]:has-text("Upload a photo")')
        .click();

    // 5. Upload passport.jpg file
    const fileInput = personaFrame.locator('input[type="file"]');

    // File input might be hidden, so we don't check visibility
    const passportFile = join(__dirname, '../test_files/passport.jpg');
    await fileInput.setInputFiles(passportFile);

    // 6. Click "Continue" button
    await expect(
        personaFrame.locator('[data-test="government-id-check__continue"]')
    ).toBeVisible({ timeout: 10000 });
    await personaFrame
        .locator('[data-test="government-id-check__continue"]')
        .click();

    // 7. Wait for "Done" button to appear and click it
    await expect(personaFrame.locator('button:has-text("Done")')).toBeVisible({ timeout: 30000 });
    await personaFrame.locator('button:has-text("Done")').click();

    // Wait for completion
    // await expect(page.locator('div:has-text("ID Verification Complete")')).toBeVisible({ timeout: 30000 });
};

/**
 * Complete MX Connect Bank OAuth flow and close modal
 * @param {import('@playwright/test').Page} applicantPage - The Playwright page for the applicant
 * @param {import('@playwright/test').BrowserContext} context - The Playwright browser context
 * @param {Object} options - Options for the flow
 * @param {string} [options.bankName='mx bank oau'] - The bank name to search for
 * @returns {Promise<void>}
 */
const connectBankOAuthFlow = async (applicantPage, context, options = {}) => {
    const bankName = options.bankName || 'mx bank oau';
    const maxAttempts = options.maxAttempts || 20;
    const pollingInterval = options.pollingInterval || 5000;

    // Step 1: Open MX Connect iframe and search for bank
    const mxIframe = applicantPage.frameLocator('iframe[src*="int-widgets.moneydesktop.com"]');
    const mxSearchInput = mxIframe.locator('[data-test="search-input"]').or(mxIframe.locator('#mx-connect-search'));
    await mxSearchInput.click();
    await mxSearchInput.fill(bankName);
    const oauthBankOption = mxIframe.locator('[data-test="MX-Bank-(OAuth)-row"]');
    // .or(mxIframe.locator('button[aria-label="Add account with MX Bank (OAuth)"]'));
    await oauthBankOption.click();
    const continueBtn = mxIframe.locator('[data-test="continue-button"]');

    // Step 2: Handle OAuth authorization in new tab
    const [oauthPage] = await Promise.all([
        context.waitForEvent('page'),
        continueBtn.click()
    ]);

    // Step 3: Authorize OAuth
    try {
        await oauthPage.waitForLoadState('domcontentloaded', { timeout: 20000 });
        await oauthPage.waitForTimeout(1000);
        const oauthSubmit = oauthPage.locator('input[type="submit"][value="Authorize"][class*="btn-success"]')
            .or(oauthPage.locator('input[type="submit"][name="commit"][value="Authorize"]'))
            .or(oauthPage.locator('form.authorize-form input[type="submit"]'))
            .or(oauthPage.locator('input.btn-success.btn-lg.btn-block'));
        await oauthSubmit.waitFor({ timeout: 8000 });
        const isVisible = await oauthSubmit.isVisible();
        const isEnabled = await oauthSubmit.isEnabled();
        if (isVisible && isEnabled) {
            await oauthSubmit.click();
        } else {
            throw new Error('Authorize button is not visible or enabled');
        }
        try {
            if (!oauthPage.isClosed()) {
                await oauthPage.waitForTimeout(5000);
                await oauthPage.close();
            }
        } catch (e) {

            // Ignore if already closed
        }
    } catch (error) {
        if (oauthPage && !oauthPage.isClosed()) {
            await oauthPage.close();
        }
        throw error;
    }

    // Step 4: Wait for Done button or session expired, then close modal
    await applicantPage.bringToFront();
    await applicantPage.waitForTimeout(3000);
    let attempt = 0;
    while (attempt < maxAttempts) {
        try {
            console.log(`Attempt ${attempt + 1}: Checking for Done button or Session expired message.`);
            const mxIframe = applicantPage.frameLocator('iframe[src*="int-widgets.moneydesktop.com"]');
            const doneBtn = mxIframe.locator('[data-test="done-button"]');
            const sessionExpiredMsg = mxIframe.locator('text="Session expired"').or(mxIframe.locator('text*="session expired"'));
            const [doneBtnVisible, sessionExpiredVisible] = await Promise.all([
                doneBtn.isVisible({ timeout: pollingInterval }).catch(() => false),
                sessionExpiredMsg.isVisible({ timeout: pollingInterval }).catch(() => false)
            ]);
            if (sessionExpiredVisible) {
                console.log('Session expired message is visible. Reloading the page.');
                await applicantPage.reload();
                await applicantPage.waitForTimeout(5000);
                attempt++;
                continue;
            }
            if (doneBtnVisible) {
                console.log('Done button is visible.');
                const isEnabled = await doneBtn.isEnabled();
                if (isEnabled) {
                    console.log('Done button is enabled. Clicking the button.');
                    await doneBtn.click();
                    await applicantPage.waitForTimeout(500);
                    await applicantPage.getByTestId('connnect-modal-cancel').click();
                    break;
                } else {
                    console.log('Done button is not enabled. Waiting and retrying.');
                    await applicantPage.waitForTimeout(pollingInterval);
                    attempt++;
                }
            } else {
                console.log('Done button is not visible. Waiting and retrying.');
                await applicantPage.waitForTimeout(pollingInterval);
                attempt++;
            }
        } catch (error) {
            console.log(`Error encountered: ${error.message}. Attempting again.`);
            attempt++;
            if (attempt < maxAttempts) {
                await applicantPage.waitForTimeout(pollingInterval);
            }
        }
    }
    if (attempt >= maxAttempts) {
        throw new Error('Failed to click Done button after multiple attempts');
    }
};

/**
 * Complete session creation flow for a specific user
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Browser} browser
 * @param {Object} adminCredentials
 * @param {String} organizationName
 * @param {String} applicationName
 * @param {Object} userData
 * @param {String} rentBudget
 * @param {String} stateCode
 * @returns {Object} { sessionId, sessionUrl, link }
 */
const createSessionForUser = async (
    page,
    browser,
    adminCredentials,
    organizationName,
    applicationName,
    userData,
    rentBudget = '2500',
    stateCode = 'fl'
) => {

    // Step 1: Admin Login and Navigate
    await page.goto('/');
    await loginForm.adminLoginAndNavigate(page, adminCredentials);

    await page.getByTestId('applications-menu').click();
    await page.waitForTimeout(500);
    await page.getByTestId('applications-submenu').click();
    await page.waitForTimeout(2000); // Wait longer for sessions to load

    // Step 2: Find Application and Invite
    const applicationFound = await findApplicationByNameAndInvite(
        page,
        organizationName,
        applicationName
    );

    if (!applicationFound) {
        throw new Error(
            `Application '${applicationName}' not found in organization '${organizationName}'`
        );
    }

    // Step 3: Generate Session
    await expect(page.locator('#generate-session-form')).toBeVisible();
    const { sessionId, sessionUrl, link }
        = await generateSessionForm.generateSessionAndExtractLink(page, userData);

    // Step 4: Applicant Flow
    const context = await browser.newContext();
    const applicantPage = await context.newPage();

    const sessionLinkUrl = new URL(link);
    await Promise.all([
        applicantPage.waitForResponse(
            resp => resp.url().includes(sessionUrl)
                && resp.request().method() === 'GET'
                && resp.ok()
        ),
        applicantPage.goto(
            joinUrl(
                app.urls.app,
                `${sessionLinkUrl.pathname}${sessionLinkUrl.search}`
            )
        )
    ]);

    // Step 5: Handle State Modal and Complete Form
    await handleOptionalStateModal(applicantPage);
    await completeApplicantForm(applicantPage, rentBudget, sessionUrl);

    // Step 6: Upload Financial Document
    /**
     * NOTE: Don't change this file to pass this verification.
     * this file used to fail the verification to show the flags
     */
    await uploadStatementFinancialStep(applicantPage, 'test_bank_statement.pdf');
    await applicantPage.waitForTimeout(1000);

    // Step 7: Wait for Connection Completion
    await waitForConnectionCompletion(applicantPage);

    // Step 8: Continue Financial Verification
    await applicantPage.waitForTimeout(1000);
    await continueFinancialVerification(applicantPage);

    // Step 9: Close Applicant Context
    await applicantPage.close();

    return { sessionId, sessionUrl, link };
};

/**
 * Complete session creation flow with VERIDOCS_PAYLOAD simulator via API
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Browser} browser
 * @param {Object} adminCredentials
 * @param {String} organizationName
 * @param {String} applicationName
 * @param {Object} userData
 * @param {String} rentBudget
 * @param {String} stateCode
 * @returns {Object} { sessionId, sessionUrl, link }
 */
const createSessionWithSimulator = async (
    page,
    browser,
    adminCredentials,
    organizationName,
    applicationName,
    userData,
    rentBudget = '2500',
    stateCode = 'fl'
) => {
    console.log('🚀 Starting API-based session creation with VERIDOCS_PAYLOAD...');

    // Step 1: Admin Login via API and get token
    console.log('🔍 Logging in as admin via API...');

    // Generate UUID for login
    const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    const adminLoginResponse = await page.request.post(`${app.urls.api}/auth`, {
        headers: {
            'Content-Type': 'application/json'
        },
        data: {
            email: adminCredentials.email,
            password: adminCredentials.password,
            uuid: generateUUID(),
            os: 'web'
        }
    });

    if (!adminLoginResponse.ok()) {
        const errorText = await adminLoginResponse.text();
        throw new Error(`Failed to login as admin: ${adminLoginResponse.status()} - ${errorText}`);
    }

    const adminAuth = await adminLoginResponse.json();
    const authToken = adminAuth.data.token;

    if (!authToken) {
        throw new Error('Failed to get auth token from login response');
    }

    console.log('✅ Admin login successful, token retrieved');

    // Step 2: Find application via API with retry logic and proper query parameters
    console.log(`🔍 Finding application: ${applicationName} in organization: ${organizationName}`);

    const retryApiCall = async (apiCall, maxRetries = 3) => {
        for (let i = 0; i < maxRetries; i++) {
            try {
                console.log(`🔄 Attempt ${i + 1}/${maxRetries} to fetch applications...`);
                const startTime = Date.now();
                const result = await apiCall();
                const duration = Date.now() - startTime;
                console.log(`✅ Applications fetched successfully in ${duration}ms`);
                return result;
            } catch (error) {
                console.log(`❌ Attempt ${i + 1} failed: ${error.message}`);
                if (i === maxRetries - 1) throw error;
                await page.waitForTimeout(2000); // Wait 2 seconds before retry
            }
        }
    };

    const application = await retryApiCall(async () => {
        const applicationsResponse = await page.request.get(`${app.urls.api}/applications`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            params: {
                'fields[application]': 'id,name,organization',
                'filters': JSON.stringify({
                    "$and": [{
                        "$or": { "name": { "$like": applicationName } }
                    }]
                }),
                'limit': 50,
                'page': 1,
                'pagination': 'cursor'
            },
            timeout: 120000 // 2 minutes timeout like API tests
        });

        if (!applicationsResponse.ok()) {
            const errorText = await applicationsResponse.text();
            throw new Error(`Failed to fetch applications: ${applicationsResponse.status()} - ${errorText}`);
        }

        const response = await applicationsResponse.json();
        console.log(`📊 Found ${response.data.length} applications`);

        const application = response.data.find(app =>
            app.name === applicationName &&
            app.organization.name === organizationName
        );

        if (!application) {
            console.log(`❌ Application '${applicationName}' not found in organization '${organizationName}'`);
            console.log(`📋 Available applications:`, response.data.map(app => `${app.name} (${app.organization.name})`));
            throw new Error(`Application '${applicationName}' not found in organization '${organizationName}'`);
        }

        return application;
    });

    console.log(`✅ Application found: ${application.id}`);

    // Step 3: Create session via API
    console.log('🔍 Creating session via API...');

    // Apply prefix and email suffix (same as UI helpers)
    const prefixedFirstName = addPrefix(userData.first_name);
    const modifiedEmail = addEmailSuffix(userData.email);

    console.log(`🏷️  Naming Helper (API):`);
    console.log(`   First Name: '${userData.first_name}' → '${prefixedFirstName}'`);
    console.log(`   Email: '${userData.email}' → '${modifiedEmail}'`);

    const sessionData = {
        application: application.id,
        first_name: prefixedFirstName,
        last_name: userData.last_name,
        email: modifiedEmail,
        invite: true
    };

    const sessionResponse = await page.request.post(`${app.urls.api}/sessions`, {
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        },
        data: sessionData
    });

    if (!sessionResponse.ok()) {
        const errorText = await sessionResponse.text();
        throw new Error(`Failed to create session: ${sessionResponse.status()} - ${errorText}`);
    }

    const session = await sessionResponse.json();
    const sessionId = session.data.id;
    const sessionUrl = session.data.url;

    console.log(`✅ Session created via API: ${sessionId}`);

    // Step 4: Login as guest using invitation token from session URL
    console.log('🔍 Logging in as guest with invitation token...');

    // Extract token from session URL
    const inviteUrl = new URL(sessionUrl);
    const invitationToken = inviteUrl.searchParams.get('token');

    if (!invitationToken) {
        throw new Error('No invitation token found in session URL');
    }

    console.log('📋 Invitation token extracted from session URL');

    const guestLoginResponse = await page.request.post(`${app.urls.api}/auth/guests`, {
        headers: {
            'Content-Type': 'application/json'
        },
        data: {
            token: invitationToken,
            uuid: generateUUID(),
            os: 'web'
        }
    });

    if (!guestLoginResponse.ok()) {
        const errorText = await guestLoginResponse.text();
        throw new Error(`Failed to login as guest: ${guestLoginResponse.status()} - ${errorText}`);
    }

    const guestAuth = await guestLoginResponse.json();
    const guestToken = guestAuth.data.token;

    console.log('✅ Guest login successful with invitation token');

    // Step 5: Complete session steps via API
    console.log('🔍 Completing session steps via API...');

    // Get current session state
    const sessionDetailsResponse = await page.request.get(`${app.urls.api}/sessions/${sessionId}`, {
        headers: {
            'Authorization': `Bearer ${guestToken}`,
            'Content-Type': 'application/json'
        }
    });

    if (!sessionDetailsResponse.ok()) {
        throw new Error(`Failed to get session details: ${sessionDetailsResponse.status()}`);
    }

    const sessionDetails = await sessionDetailsResponse.json();
    console.log(`📊 Current step: ${sessionDetails.data.state.current_step.type}`);

    // Complete START step if needed
    if (sessionDetails.data.state.current_step.type === 'START') {
        console.log('📄 Completing START step...');

        // Step 1: Create session step
        const stepData = { step: sessionDetails.data.state.current_step.id };
        const stepResponse = await page.request.post(`${app.urls.api}/sessions/${sessionId}/steps`, {
            headers: {
                'Authorization': `Bearer ${guestToken}`,
                'Content-Type': 'application/json'
            },
            data: stepData
        });

        const sessionStep = await stepResponse.json();
        console.log(`✅ Session step created: ${sessionStep.data.id}`);

        // Step 2: Update session with rent budget (target)
        console.log(`📄 Updating rent budget to ${rentBudget}...`);
        await page.request.patch(`${app.urls.api}/sessions/${sessionId}`, {
            headers: {
                'Authorization': `Bearer ${guestToken}`,
                'Content-Type': 'application/json'
            },
            data: {
                target: rentBudget
            }
        });
        console.log(`✅ Rent budget updated to ${rentBudget}`);

        // Step 3: Mark session step as COMPLETED
        console.log('📄 Marking START step as completed...');
        await page.request.patch(`${app.urls.api}/sessions/${sessionId}/steps/${sessionStep.data.id}`, {
            headers: {
                'Authorization': `Bearer ${guestToken}`,
                'Content-Type': 'application/json'
            },
            data: {
                status: 'COMPLETED'
            }
        });
        console.log('✅ START step marked as completed');
    }

    // Step 6: Wait for step transition (polling like API tests)
    console.log('⏳ Waiting for step transition from START...');
    let updatedSession;
    let transitionCount = 0;
    const maxTransitionAttempts = 10;

    do {
        const updatedSessionResponse = await page.request.get(`${app.urls.api}/sessions/${sessionId}`, {
            headers: {
                'Authorization': `Bearer ${guestToken}`,
                'Content-Type': 'application/json'
            }
        });
        updatedSession = await updatedSessionResponse.json();

        if (updatedSession.data.state.current_step?.type === 'START') {
            console.log(`⏳ Still on START step, waiting... (attempt ${transitionCount + 1}/${maxTransitionAttempts})`);
            await page.waitForTimeout(2000);
        }
        transitionCount++;
    } while (updatedSession.data.state.current_step?.type === 'START' && transitionCount < maxTransitionAttempts);

    console.log(`📊 Current step after START: ${updatedSession.data.state.current_step.type}`);
    console.log(`📊 Current step task key: ${updatedSession.data.state.current_step.task?.key}`);

    // Step 7: Complete FINANCIAL step with VERIDOCS_PAYLOAD
    console.log('🏦 Completing FINANCIAL step with VERIDOCS_PAYLOAD...');

    if (updatedSession.data.state.current_step.type === 'FINANCIAL_VERIFICATION' ||
        updatedSession.data.state.current_step.task?.key === 'FINANCIAL_VERIFICATION') {
        // Create session step
        const stepResponse = await page.request.post(`${app.urls.api}/sessions/${sessionId}/steps`, {
            headers: {
                'Authorization': `Bearer ${guestToken}`,
                'Content-Type': 'application/json'
            },
            data: {
                step: updatedSession.data.state.current_step.id
            }
        });

        const step = await stepResponse.json();
        console.log(`✅ Session step created: ${step.data.id}`);

        // Get Simulation provider
        const providersResponse = await page.request.get(`${app.urls.api}/providers`, {
            headers: {
                'Authorization': `Bearer ${guestToken}`,
                'Content-Type': 'application/json'
            }
        });

        const providers = await providersResponse.json();
        const simulationProvider = providers.data.find(p => p.name === 'Simulation');

        if (!simulationProvider) {
            throw new Error('Simulation provider not found');
        }

        console.log(`✅ Simulation provider found: ${simulationProvider.id}`);

        // Create financial verification with VERIDOCS_PAYLOAD
        const { getVeridocsPayloadWellsFargo } = await import('../test_files/veridocs-payload-wells-fargo.js');
        const veridocsPayloadRaw = getVeridocsPayloadWellsFargo();

        // Wrap payload in documents array like API tests do
        const veridocsPayload = {
            documents: [veridocsPayloadRaw]
        };

        const verificationData = {
            step: step.data.id,
            provider: simulationProvider.id,
            simulation_type: 'VERIDOCS_PAYLOAD',
            custom_payload: veridocsPayload
        };

        console.log('📋 Creating financial verification with VERIDOCS_PAYLOAD...');
        const verificationResponse = await page.request.post(`${app.urls.api}/financial-verifications`, {
            headers: {
                'Authorization': `Bearer ${guestToken}`,
                'Content-Type': 'application/json'
            },
            data: verificationData
        });

        if (!verificationResponse.ok()) {
            const errorText = await verificationResponse.text();
            throw new Error(`Failed to create financial verification: ${verificationResponse.status()} - ${errorText}`);
        }

        const verification = await verificationResponse.json();
        console.log(`✅ Financial verification created: ${verification.data.id}`);

        // Wait for verification to complete
        console.log('⏳ Waiting for verification to complete...');
        await page.waitForTimeout(15000); // Wait 15 seconds for VERIDOCS_PAYLOAD processing

        // Update session step to completed
        await page.request.patch(`${app.urls.api}/sessions/${sessionId}/steps/${step.data.id}`, {
            headers: {
                'Authorization': `Bearer ${guestToken}`,
                'Content-Type': 'application/json'
            },
            data: {
                status: 'COMPLETED'
            }
        });

        console.log('✅ FINANCIAL step completed');
    } else {
        console.log(`⚠️ Current step is not FINANCIAL_VERIFICATION. Step type: ${updatedSession.data.state.current_step.type}`);
        console.log(`⚠️ Skipping FINANCIAL step - session may need different workflow steps`);
    }

    console.log(`✅ Session created successfully via API. Session ID: ${sessionId}`);
    return {
        sessionId,
        sessionUrl,
        link: sessionUrl // For compatibility with existing code
    };
};

const updateStateModal = async (page, state = 'FLORIDA') => {

    let isStateVisible = false;
    try {
        // Use .first() to avoid strict mode violation (modal container and form both have same test-id)
        await page.getByTestId('state-modal').first().waitFor({ state: 'visible', timeout: 5000 })
        isStateVisible = true;
    } catch (err) {
        isStateVisible = false;
    }

    if (isStateVisible) {
        await fillMultiselect(
            page,
            await page.locator(
                '[aria-owns="listbox-state-modal-state-select"]'
            ),
            [state]
        );

        await page.getByTestId('submit-state-modal-form').click();
        await page.waitForSelector('[data-testid=state-modal]', {
            state: 'detached',
            timeout: 10_000
        })

    }
};

const fillhouseholdForm = async (page, user) => {
    const step = await page.getByTestId('applicant-invite-step');

    // Auto-prefix first name with 'AutoT - ' (idempotent - won't double-prefix)
    const prefixedFirstName = addPrefix(user.first_name);
    // Auto-suffix email with '+autotest' (since app uses email to determine guest name)
    const modifiedEmail = addEmailSuffix(user.email);

    await step.locator('#first_name').fill(prefixedFirstName);
    await step.locator('#last_name').fill(user.last_name);
    await step.locator('#email_address').fill(modifiedEmail);

    const [response] = await Promise.all([
        page.waitForResponse(
            resp => resp.url().includes('/applicants')
                && resp.ok()
                && resp.request().method() === 'POST'
        ),
        step.getByTestId('invite-step-sent-btn').click()
    ]);

    const data = await waitForJsonResponse(response);

    await expect(page.getByTestId('invite-success-modal')).toBeVisible(10_000);
    await page.waitForTimeout(500);
    await page.getByTestId('invite-success-modal-cancel').click();
    await page.waitForTimeout(500);

    return data;
};

/**
 * Select Applicant type in session flow
 *
 * @param {import('@playwright/test').Page} applicantPage
 * @param {string} sessionUrl
 */
const selectApplicantType = async (applicantPage, sessionUrl, selectorKey = '#affordable_primary') => {
    await expect(applicantPage.getByTestId('applicant-type-page')).toBeVisible({ timeout: 20000 });

    // Wait for the specific applicant type button to be visible and ready
    await applicantPage.locator(selectorKey).waitFor({ state: 'visible', timeout: 10000 });
    await applicantPage.locator(selectorKey).click();

    const [sessionResp] = await Promise.all([
        applicantPage.waitForResponse(
            resp => resp.url().includes(sessionUrl)
                && resp.ok()
                && resp.request().method() === 'PATCH'
        ),
        applicantPage.getByTestId('applicant-type-next-btn').click()
    ]);
};

/**
 * Handle Atomic payroll choice modal
 *
 * This modal appears after clicking the "directly-connect-emp-btn" button and
 * lets the user choose between connecting employer or uploading paystubs.
 *
 * We select the option by button text so we don't depend on missing data-test-ids
 * or accessibility labels on the dialog itself.
 *
 * @param {import('@playwright/test').Page} page
 * @param {'employer' | 'upload'} mode
 */
const handleAtomicPayrollChoiceModal = async (page, mode = 'employer') => {
    const buttonLocator = mode === 'employer'
        ? page.getByRole('button', { name: /Connect Employer/i })
        : page.getByRole('button', { name: /Upload Paystubs/i });

    // If the button isn't present/visible (older build or different flow), fail soft.
    const isVisible = await buttonLocator.isVisible().catch(() => false);
    if (!isVisible) {
        return;
    }

    await buttonLocator.click({ timeout: 20000 });
};

/**
 * Handle financial intro dialogs that can block financial step actions.
 *
 * This includes:
 * - "Upload Bank Statements" (click "Upload Statements")
 * - "Bank Connect Information — Please Read" (click "Acknowledge")
 *
 * We poll briefly for any such dialog and click the appropriate primary
 * button so the underlying financial controls (connect-bank, etc.) are usable.
 * Safe no-op when no dialog is present.
 *
 * @param {import('@playwright/test').Page} page
 */
const handleFinancialIntroDialogs = async page => {
    const maxAttempts = 10;      // up to ~10 seconds
    const intervalMs = 1000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const dialog = page.getByRole('dialog');
        const dialogVisible = await dialog.isVisible().catch(() => false);

        if (dialogVisible) {
            // Upload Bank Statements intro
            const uploadTitleVisible = await dialog
                .getByText('Upload Bank Statements')
                .isVisible()
                .catch(() => false);
            if (uploadTitleVisible) {
                const uploadStatementsBtn = dialog.getByRole('button', { name: /Upload Statements/i });
                if (await uploadStatementsBtn.isVisible().catch(() => false)) {
                    await uploadStatementsBtn.click({ timeout: 20_000 });
                    return;
                }
            }

            // Bank Connect Information intro
            const bankInfoTitleVisible = await dialog
                .getByText('Bank Connect Information — Please Read')
                .isVisible()
                .catch(() => false);
            if (bankInfoTitleVisible) {
                const acknowledgeBtn = dialog.getByRole('button', { name: /Acknowledge/i });
                if (await acknowledgeBtn.isVisible().catch(() => false)) {
                    await acknowledgeBtn.click({ timeout: 20_000 });
                    return;
                }
            }
        }

        await page.waitForTimeout(intervalMs);
    }
};

/**
 * Complete paystub connection
 *
 * @param {import('@playwright/test').Page} applicantPage
 */
const completePaystubConnection = async applicantPage => {
    await applicantPage
        .getByTestId('document-pay_stub')
        .click({ timeout: 20000 });
    await applicantPage
        .getByTestId('directly-connect-emp-btn')
        .click({ timeout: 20000 });

    // New Atomic modal: choose employer connection before entering iframe
    await handleAtomicPayrollChoiceModal(applicantPage, 'employer');

    await applicantPage.waitForTimeout(4000);
    const empIFrame = await applicantPage.frameLocator(
        '#atomic-transact-iframe'
    );

    await empIFrame
        .locator('[data-test-id="continue"]')
        .click({ timeout: 20000 });
    await empIFrame
        .locator('button', { hasText: 'Paychex' })
        .click({ timeout: 20000 });
    await empIFrame
        .locator('[data-test-id="input-username"]')
        .fill('test-good');
    await empIFrame
        .locator('[data-test-id="continue"]')
        .click({ timeout: 20000 });
    await empIFrame.locator('[data-test-id="input-password"]').fill('test');
    await empIFrame
        .locator('[data-test-id="continue"]')
        .click({ timeout: 20000 });

    // Check for finish button with 60s timeout while monitoring modal visibility every 2s
    const startTime = Date.now();
    const maxWaitTime = 60000; // 60 seconds
    const checkInterval = 2000; // 2 seconds

    while (Date.now() - startTime < maxWaitTime) {
        try {
            // Check if finish button is visible
            const finishButton = empIFrame.locator('[data-test-id="finish-button"]');
            if (await finishButton.isVisible({ timeout: 1000 })) {
                await finishButton.click({ timeout: 5000 });
                console.log('✅ Finish button clicked successfully');
                break;
            }

            // Check if modal is still visible (iframe exists)
            const iframeExists = await applicantPage.locator('#atomic-transact-iframe').isVisible({ timeout: 1000 });
            if (!iframeExists) {
                console.log('✅ Modal auto-closed, continuing...');
                break;
            }

            // Wait 2 seconds before next check
            await applicantPage.waitForTimeout(checkInterval);

        } catch (error) {
            console.log(`⚠️ Check iteration error: ${error.message}`);
            await applicantPage.waitForTimeout(checkInterval);
        }
    }

    const elapsedTime = Date.now() - startTime;
    if (elapsedTime >= maxWaitTime) {
        console.log('⚠️ Timeout reached (60s) - continuing anyway');
    }

    await applicantPage.waitForSelector('#atomic-transact-iframe', {
        state: 'detached',
        timeout: 50000
    });

    // Wait for paystub connection to complete
    await waitForPaystubConnectionCompletion(applicantPage);
};

/**
 * Fail paystub connection
 *
 * @param {import('@playwright/test').Page} applicantPage
 */
const failPaystubConnection = async applicantPage => {
    await applicantPage
        .getByTestId('document-pay_stub')
        .click({ timeout: 20000 });
    await applicantPage
        .getByTestId('directly-connect-emp-btn')
        .click({ timeout: 20000 });

    // New Atomic modal: choose employer connection before entering iframe
    await handleAtomicPayrollChoiceModal(applicantPage, 'employer');

    await applicantPage.waitForTimeout(4000);
    const empIFrame = await applicantPage.frameLocator(
        '#atomic-transact-iframe'
    );

    await empIFrame
        .locator('[data-test-id="continue"]')
        .click({ timeout: 20000 });
    await empIFrame
        .locator('button', { hasText: 'Paychex' })
        .click({ timeout: 20000 });
    await empIFrame
        .locator('[data-test-id="input-username"]')
        .fill('test-failure');
    await empIFrame
        .locator('[data-test-id="continue"]')
        .click({ timeout: 20000 });
    await empIFrame.locator('[data-test-id="input-password"]').fill('test');
    await empIFrame
        .locator('[data-test-id="continue"]')
        .click({ timeout: 20000 });
    await applicantPage.waitForTimeout(1000);

    // Check for finish button with 60s timeout while monitoring modal visibility every 2s
    const startTime = Date.now();
    const maxWaitTime = 60000; // 60 seconds
    const checkInterval = 2000; // 2 seconds

    while (Date.now() - startTime < maxWaitTime) {
        try {
            // Check if finish button is visible
            const finishButton = empIFrame.locator('[data-test-id="finish-button"]');
            if (await finishButton.isVisible({ timeout: 1000 })) {
                await finishButton.click({ timeout: 5000 });
                console.log('✅ Finish button clicked successfully');
                break;
            }

            // Check if modal is still visible (iframe exists)
            const iframeExists = await applicantPage.locator('#atomic-transact-iframe').isVisible({ timeout: 1000 });
            if (!iframeExists) {
                console.log('✅ Modal auto-closed, continuing...');
                break;
            }

            // Wait 2 seconds before next check
            await applicantPage.waitForTimeout(checkInterval);

        } catch (error) {
            console.log(`⚠️ Check iteration error: ${error.message}`);
            await applicantPage.waitForTimeout(checkInterval);
        }
    }

    const elapsedTime = Date.now() - startTime;
    if (elapsedTime >= maxWaitTime) {
        console.log('⚠️ Timeout reached (60s) - continuing anyway');
    }

    // Wait for iframe to close after finish
    await applicantPage.waitForSelector('#atomic-transact-iframe', {
        state: 'detached',
        timeout: 50000
    });
};

/**
 * Complete Financial step Plaid Connection
 * @param {import('@playwright/test').Page} applicantPage
 */
const completePlaidFinancialStep = async applicantPage => {
    // Step 1: Click primary connect-bank button (opens MX modal)
    await applicantPage.getByTestId('connect-bank').click();

    // Step 2: Handle bank connect info modal (if appears)
    await handleBankConnectInfoModal(applicantPage);

    // Step 3: Wait for MX iframe and close it
    await applicantPage.waitForSelector('iframe[src*="int-widgets.moneydesktop.com"]', { timeout: 30000 });
    await applicantPage.getByTestId('connnect-modal-cancel').click();

    // Step 4: Handle connection issue modal (click "Connect using Plaid" to directly trigger Plaid)
    await handleBankConnectOptionsModal(applicantPage, 'plaid');

    const pFrame = await applicantPage.frameLocator('#plaid-link-iframe-1');

    // await expect(pFrame).toBeVisible({ timeout: 40_000 });
    const plaidFrame = await pFrame.locator('reach-portal');

    await plaidFrame.locator('#aut-secondary-button').click({ timeout: 20000 });

    // Search for Betterment
    try {
        const searchBox = plaidFrame.getByRole('textbox', { name: 'Search' });
        await expect(searchBox).toBeVisible({ timeout: 30000 });
        await searchBox.fill('Betterment');
        await applicantPage.waitForTimeout(2000);
    } catch (error) {
        // Search box not found, continue
    }

    await plaidFrame
        .locator('[aria-label="Betterment"]')
        .click({ timeout: 20000 });

    // Fill credentials directly in the frame (no popup for Betterment)
    await plaidFrame.locator('#aut-input-0-input').fill('custom_gig');
    await plaidFrame.locator('#aut-input-1-input').fill('test');

    await plaidFrame.locator('#aut-button').click({ timeout: 20000 });

    await plaidFrame
        .locator('#aut-button:not([disabled])')
        .click({ timeout: 20000 });

    // Click "Allow" button (optional - may not appear)
    try {
        await expect(
            plaidFrame.getByRole('button', { name: 'Allow' })
        ).toBeVisible({ timeout: 5000 });
        await plaidFrame.getByRole('button', { name: 'Allow' }).click();
        console.log('✅ Plaid "Allow" button clicked in completePlaidFinancialStep');
    } catch (error) {
        console.log('ℹ️  Plaid "Allow" button not present in completePlaidFinancialStep - continuing');
    }

    // Click "Finish without saving" button
    await plaidFrame.locator('#aut-secondary-button').click({ timeout: 20000 });

    // Wait 3 seconds and ensure Plaid iframe is closed
    await applicantPage.waitForTimeout(3000);
    await expect(applicantPage.locator('[id="plaid-link-iframe-1"]')).not.toBeVisible({ timeout: 5000 });
    console.log('✅ Plaid iframe closed successfully in completePlaidFinancialStep');
};

/**
 * Complete Financial step Plaid Connection with Betterment (no popup auth flow)
 * @param {import('@playwright/test').Page} applicantPage
 */
const completePlaidFinancialStepBetterment = async (applicantPage, username = 'custom_gig', password = 'test') => {
    // Step 1: Click primary connect-bank button (opens MX modal)
    await applicantPage.getByTestId('connect-bank').click();

    // Step 2: Handle bank connect info modal (if appears)
    await handleBankConnectInfoModal(applicantPage);

    // Step 3: Wait for MX iframe and close it
    await applicantPage.waitForSelector('iframe[src*="int-widgets.moneydesktop.com"]', { timeout: 30000 });
    await applicantPage.getByTestId('connnect-modal-cancel').click();

    // Step 4: Handle connection issue modal (click "Connect using Plaid" to directly trigger Plaid)
    await handleBankConnectOptionsModal(applicantPage, 'plaid');

    // Wait for iframe to be present and loaded (CI-friendly)
    await applicantPage.waitForSelector('#plaid-link-iframe-1', { timeout: 60000 });
    await applicantPage.waitForTimeout(3000); // Allow iframe content to load

    const pFrame = await applicantPage.frameLocator('#plaid-link-iframe-1');
    const plaidFrame = await pFrame.locator('reach-portal');

    await plaidFrame.locator('#aut-secondary-button').click({ timeout: 20000 });

    // Search for Betterment before selecting it
    try {
        console.log('🔍 Searching for Betterment in the search box...');
        const searchBox = plaidFrame.getByRole('textbox', { name: 'Search' });
        await expect(searchBox).toBeVisible({ timeout: 30000 });
        await searchBox.fill('Betterment');
        await applicantPage.waitForTimeout(2000); // Wait for search results
        console.log('✅ Search completed for Betterment');
    } catch (error) {
        console.log('⚠️ Search box not found or search failed, proceeding with direct selection...');
    }

    // Select Betterment - use retry logic for CI reliability
    let bettermentFound = false;
    let attempts = 0;
    const maxAttempts = 3;

    while (!bettermentFound && attempts < maxAttempts) {
        try {
            console.log(`🔄 Attempting to find Betterment button (attempt ${attempts + 1}/${maxAttempts})`);
            await expect(plaidFrame.locator('[aria-label="Betterment"]')).toBeVisible({ timeout: 60000 });
            await plaidFrame.locator('[aria-label="Betterment"]').waitFor({ state: 'attached' });
            bettermentFound = true;
            console.log('✅ Betterment button found and ready');
        } catch (error) {
            attempts++;
            if (attempts >= maxAttempts) {
                console.error('❌ Failed to find Betterment button after all attempts');
                throw error;
            }
            console.log(`⚠️ Attempt ${attempts} failed, waiting and retrying...`);
            await applicantPage.waitForTimeout(5000);
        }
    }

    await applicantPage.waitForTimeout(2000);
    await plaidFrame
        .locator('[aria-label="Betterment"]')
        .click({ timeout: 20000 });

    // Fill credentials directly in the frame (no popup)
    await plaidFrame.locator('#aut-input-0-input').fill(username);
    await plaidFrame.locator('#aut-input-1-input').fill(password);

    await plaidFrame.locator('#aut-button').click({ timeout: 20000 });

    // Wait for the button to be enabled and click it
    await plaidFrame
        .locator('#aut-button:not([disabled])')
        .click({ timeout: 20000 });

    // Click "Allow" button (optional - may not appear)
    try {
        await expect(
            plaidFrame.getByRole('button', { name: 'Allow' })
        ).toBeVisible({ timeout: 5000 });
        await plaidFrame.getByRole('button', { name: 'Allow' }).click();
        console.log('✅ Plaid "Allow" button clicked in Betterment flow');
    } catch (error) {
        console.log('ℹ️  Plaid "Allow" button not present in Betterment flow - continuing');
    }

    // Click "Finish without saving" button
    await plaidFrame.locator('#aut-secondary-button').click({ timeout: 20000 });

    // Wait 3 seconds and ensure Plaid iframe is closed
    await applicantPage.waitForTimeout(3000);
    await expect(applicantPage.locator('[id="plaid-link-iframe-1"]')).not.toBeVisible({ timeout: 5000 });
    console.log('✅ Plaid iframe closed successfully in Betterment flow');
};

/**
 * Complete prerequisite (household count) step if visible.
 * Shown when application has eligibility_template and session has no stakeholder_count.
 * Locators: input#stakeholder_count, data-testid="rent-budget-step-continue".
 * API: PATCH /sessions/:id with body { stakeholder_count } (min 1).
 * @param {import('@playwright/test').Page} page
 * @param {string} sessionId
 * @param {string} count - household count (default '2')
 * @returns {Promise<boolean>} true if step was completed, false if not visible
 */
const completePrerequisiteStepIfVisible = async (page, sessionId, count = '2') => {
    const sessionUrl = joinUrl(app.urls.api, `sessions/${sessionId}`);
    const prerequisiteInput = page.locator('input#stakeholder_count');
    try {
        await prerequisiteInput.waitFor({ state: 'visible', timeout: 5000 });
    } catch {
        return false;
    }
    await prerequisiteInput.fill(count);
    const num = parseInt(count, 10) || 2;
    const [response] = await Promise.all([
        page.waitForResponse(
            resp => {
                if (!resp.url().includes(`sessions/${sessionId}`) || resp.request().method() !== 'PATCH' || !resp.ok()) return false;
                const body = resp.request().postData();
                if (!body) return false;
                try {
                    const data = JSON.parse(body);
                    const sent = data.stakeholder_count;
                    return sent !== undefined && sent !== null && Number(sent) === num;
                } catch {
                    return false;
                }
            },
            { timeout: 15000 }
        ),
        page.getByTestId('rent-budget-step-continue').click()
    ]);
    expect(response.ok()).toBe(true);
    await page.waitForTimeout(500);
    return true;
};

/**
 * Update session rent budget. Optionally complete prerequisite (household count) step first.
 * @param {import('@playwright/test').Page} applicantPage
 * @param {string} sessionId
 * @param {string} amount - rent budget amount (default '2500')
 * @param {Object} [options]
 * @param {boolean} [options.handlePrerequisite=false] - if true, complete prerequisite step when visible (use when app has eligibility_template)
 */
const updateRentBudget = async (applicantPage, sessionId, amount = '2500', options = {}) => {
    const { handlePrerequisite = false } = options;

    if (handlePrerequisite) {
        await completePrerequisiteStepIfVisible(applicantPage, sessionId, '2');
    }

    await applicantPage.locator('input#rent_budget').waitFor({ state: 'visible', timeout: 10000 });
    await applicantPage.locator('input#rent_budget').fill(amount);

    await Promise.all([
        applicantPage.waitForResponse(
            resp => resp.url().includes(`sessions/${sessionId}`)
                && resp.request().method() === 'PATCH'
                && resp.ok()
        ),
        applicantPage.getByTestId('rent-budget-step-continue').click()
    ]);
};

/**
 * Complete identity verification step with camera-based verification
 * @param {import('@playwright/test').Page} applicantPage
 */
const identityStep = async (applicantPage, connectBtnTestId = 'start-id-verification') => {
    await applicantPage.getByTestId(connectBtnTestId).click({ timeout: 20_000 });

    const personaIFrame = applicantPage.frameLocator('iframe[src*="withpersona.com"]');

    await personaIFrame.locator('[data-test="button__basic"]').click({ timeout: 20_000 });

    await personaIFrame.locator('[data-test="button__primary"]').click({ timeout: 20_000 });

    await applicantPage.waitForTimeout(2000);
    await personaIFrame.locator('[data-test="button__primary"]').click({ timeout: 20_000 });

    await personaIFrame.locator('#select__option--dl').click({ timeout: 20_000 });

    await personaIFrame.locator('#government-id-prompt__button--web-camera:not(disabled)').click({ timeout: 20_000 });


    await personaIFrame.locator('#scanner__button--capture:not(disabled)')
        .click({ timeout: 30_000 });
    await personaIFrame.locator('#government_id__use-image:not(disabled)')
        .click({ timeout: 30_000 });
    await personaIFrame.locator('#government-id-prompt__button--web-camera:not(disabled)')
        .click({ timeout: 20_000 });
    await personaIFrame.locator('#scanner__button--capture:not(disabled)')
        .click({ timeout: 30_000 });
    await personaIFrame.locator('#government_id__use-image:not(disabled)')
        .click({ timeout: 30_000 });
    await personaIFrame.locator('#selfie-prompt__button--camera:not(disabled)')
        .click({ timeout: 30_000 });
    await applicantPage.waitForTimeout(2000); //wait for the animation
    await personaIFrame.locator('#selfie-scanner__capture--manual:not(disabled)')
        .click({ timeout: 30_000 });
    await applicantPage.waitForTimeout(2000);
    await personaIFrame.locator('#selfie-scanner__capture--manual:not(disabled)')
        .click({ timeout: 30_000 });
    await applicantPage.waitForTimeout(2000);
    await personaIFrame.locator('#selfie-scanner__capture--manual:not(disabled)')
        .click({ timeout: 30_000 });
    await applicantPage.waitForTimeout(200);
    try {
        await personaIFrame.locator('#complete__button:not(disabled)')
            .click({ timeout: 30_000 });
    } catch (err) {
        console.log('Modal auto closed')
    }

};

/**
 * Intelligent button interaction: waits for button to be enabled OR detects auto-advance
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} buttonTestId - Test ID of the button to wait for
 * @param {string} nextStepTestId - Test ID of the next step element to detect auto-advance
 * @param {string} stepName - Name of the step for logging purposes
 * @param {number} maxIterations - Maximum number of iterations (default: 20)
 * @param {number} intervalMs - Interval between checks in milliseconds (default: 600)
 * @returns {Promise<{buttonClicked: boolean, autoAdvanced: boolean}>}
 */
const waitForButtonOrAutoAdvance = async (
    page,
    buttonTestId,
    nextStepTestId,
    stepName = 'step',
    maxIterations = 20,
    intervalMs = 600
) => {
    console.log(`🚀 Waiting for ${stepName} continue button or auto-advance to next step`);

    let buttonClicked = false;
    let autoAdvanced = false;

    for (let i = 0; i < maxIterations; i++) {
        console.log(`🔄 ${stepName} iteration ${i + 1}/${maxIterations}: Checking button state and next step...`);

        try {
            // Check 1: Is the continue button visible and enabled?
            const continueButton = page.getByTestId(buttonTestId).first(); // Use .first() to avoid strict mode violation
            const isButtonVisible = await continueButton.isVisible({ timeout: 1000 });

            if (isButtonVisible) {
                // Check if button is enabled (not disabled)
                const isButtonEnabled = await continueButton.isEnabled();

                if (isButtonEnabled) {
                    console.log(`✅ ${stepName} continue button is visible and enabled, clicking it...`);
                    await continueButton.click();
                    buttonClicked = true;
                    console.log(`✅ ${stepName} continue button clicked successfully`);
                    break;
                } else {
                    console.log(`⏳ ${stepName} continue button visible but still disabled, waiting...`);
                }
            }

            // Check 2: Alternative button detection - look for role='button' with name='Continue'
            try {
                const continueButtonByRole = page.getByRole('button', { name: 'Continue' }).first(); // Use .first() to avoid strict mode violation
                const isRoleButtonVisible = await continueButtonByRole.isVisible({ timeout: 1000 });

                if (isRoleButtonVisible) {
                    const isRoleButtonEnabled = await continueButtonByRole.isEnabled();

                    if (isRoleButtonEnabled) {
                        console.log(`✅ ${stepName} continue button (by role) is visible and enabled, clicking it...`);
                        await continueButtonByRole.click();
                        buttonClicked = true;
                        console.log(`✅ ${stepName} continue button (by role) clicked successfully`);
                        break;
                    } else {
                        console.log(`⏳ ${stepName} continue button (by role) visible but still disabled, waiting...`);
                    }
                }
            } catch (err) {
                // Role button not visible yet, continue checking
            }

            // Check 3: Has the system automatically advanced to the next step?
            try {
                const nextStepElement = page.getByTestId(nextStepTestId);
                const isNextStepVisible = await nextStepElement.isVisible({ timeout: 1000 });

                if (isNextStepVisible) {
                    console.log(`✅ System automatically advanced to next step (${nextStepTestId})`);
                    autoAdvanced = true;
                    break;
                }
            } catch (err) {
                // Next step not visible yet, continue checking
            }

            // Wait before next iteration
            await page.waitForTimeout(intervalMs);

        } catch (error) {
            console.log(`⚠️ Error in ${stepName} iteration ${i + 1}:`, error.message);
            await page.waitForTimeout(intervalMs);
        }
    }

    if (buttonClicked) {
        console.log(`✅ Completed ${stepName} manually via button click`);
    } else if (autoAdvanced) {
        console.log(`✅ Completed ${stepName} automatically by system`);
    } else {
        console.log(`⚠️ Neither button click nor auto-advance occurred for ${stepName}, continuing anyway...`);
    }

    return { buttonClicked, autoAdvanced };
};

/**
 * Complete financial verification using Simulation provider with VERIDOCS_PAYLOAD via UI
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {object} veridocsPayload - The Veridocs payload object
 * @param {Object} [options] - Optional configuration
 * @param {boolean} [options.skipConnectionRowValidation=false] - Skip waiting for connection rows (useful when app shows continue button instead)
 * @returns {Promise<void>}
 */
const simulatorFinancialStepWithVeridocs = async (page, veridocsPayload, options = {}) => {
    const { skipConnectionRowValidation = false } = options;
    console.log('🚀 ~ Starting financial verification with Simulation provider (VERIDOCS_PAYLOAD) via UI...');

    // Step 1: Wait for financial verification step to be visible
    const financialStep = await page.getByTestId('financial-verification-step');
    await expect(financialStep).toBeVisible();

    // Step 2: Click "Upload Statement" button
    console.log('🔍 Clicking Upload Statement button...');
    const uploadStatementBtn = await page.getByTestId('financial-upload-statement-btn');
    await expect(uploadStatementBtn).toBeVisible();
    await uploadStatementBtn.click();
    await page.waitForTimeout(2000);

    // Handle any blocking financial intro dialogs before continuing
    await handleFinancialIntroDialogs(page);

    // Step 3: Click "Connect Bank" button and handle browser prompt
    console.log('🔍 Setting up browser prompt handler...');
    const connectBankBtn = await page.getByTestId('connect-bank');
    await expect(connectBankBtn).toBeVisible();

    // Convert the payload to JSON string
    const payloadString = JSON.stringify(veridocsPayload);
    console.log(`📋 Payload ready: ${payloadString.length} characters`);

    page.once('dialog', async dialog => {
        // Step 2: Wait for dialog to appear and handle it
        console.log('✅ Browser prompt detected!');
        console.log(`📋 Dialog type: ${dialog.type()}`);
        console.log(`📋 Dialog message: ${dialog.message()}`);
        await page.waitForTimeout(500);
        // Step 3: Accept the prompt with the payload
        console.log('📋 Sending payload to dialog...');
        await dialog.accept(payloadString);
        console.log('✅ Payload sent to browser prompt');
    });

    // Step 1: Click Connect Bank button first (manual flow)
    console.log('🔍 Clicking Connect Bank button...');
    await connectBankBtn.click();
    console.log('✅ Connect Bank clicked');

    // Handle any financial intro dialogs that may appear after clicking connect-bank
    await handleFinancialIntroDialogs(page);

    console.log('🔍 Waiting for dialog to appear...');

    // Step 4: Wait for simulator to process
    console.log('⏳ Waiting for simulator to process payload...');
    await page.waitForTimeout(5000);
    console.log('✅ Simulator processing completed');

    // Step 5: Optionally validate connection rows appear (can be skipped for apps that show continue button instead)
    if (!skipConnectionRowValidation) {
        // Step 6: Poll up to 60s for any connection row to appear (using Playwright's built-in polling)
        console.log('🔍 Checking if connection row exists (with polling up to 60s)...');
        const connectionRows = page.getByTestId('connection-row');

        // Use expect().toBeVisible() which has built-in polling - more reliable than manual count() checks
        await expect(connectionRows.first()).toBeVisible({ timeout: 60_000 });

        const rowCount = await connectionRows.count();
        console.log(`📊 Found ${rowCount} connection row(s)`);

        if (rowCount === 0) {
            console.log('❌ No connection rows found - simulator may not have processed the payload');
            throw new Error('No connection rows found after simulator dialog');
        }

        // Step 7: Wait for upload status on connection row
        console.log('⏳ Waiting for verification row to show "Uploaded"...');
        await expect(
            page.getByTestId('connection-row').filter({ hasText: /Uploaded/i })
        ).toBeVisible({ timeout: 60000 });

        console.log('✅ Verification upload completed successfully via simulator UI');
    } else {
        console.log('⏭️  Skipping connection row validation (skipConnectionRowValidation=true)');
        console.log('✅ Simulator payload submitted - verification will be processed asynchronously');
    }
};

/**
 * Complete Identity Verification step via API using PERSONA_PAYLOAD simulator
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {String} sessionId - Session ID
 * @param {String} guestToken - Guest authentication token
 * @param {Object} userData - User data with first_name, last_name
 * @param {String} userType - 'primary' or 'co-applicant'
 * @param {Boolean} useMismatchedName - If true, uses completely different name (Maria Dominguez) to trigger flag
 * @returns {Promise<void>}
 */
const completeIdentityStepViaAPI = async (page, sessionId, guestToken, userData, userType = 'primary', useMismatchedName = false) => {
    console.log(`🚀 Starting Identity Verification via API for ${userType}...`);

    // Step 1: Get current session state
    const sessionResponse = await page.request.get(`${app.urls.api}/sessions/${sessionId}`, {
        headers: {
            'Authorization': `Bearer ${guestToken}`,
            'Content-Type': 'application/json'
        }
    });

    const session = await sessionResponse.json();

    // Step 2: Check if current step is IDENTITY_VERIFICATION
    if (session.data.state.current_step.type !== 'IDENTITY_VERIFICATION' &&
        session.data.state.current_step.task?.key !== 'IDENTITY_VERIFICATION') {
        console.log(`⚠️ Current step is not IDENTITY_VERIFICATION. Step: ${session.data.state.current_step.type}`);
        throw new Error('Cannot complete identity step - not on IDENTITY_VERIFICATION step');
    }

    console.log('✅ On IDENTITY_VERIFICATION step');

    // Step 3: Create session step
    const stepResponse = await page.request.post(`${app.urls.api}/sessions/${sessionId}/steps`, {
        headers: {
            'Authorization': `Bearer ${guestToken}`,
            'Content-Type': 'application/json'
        },
        data: {
            step: session.data.state.current_step.id
        }
    });

    const step = await stepResponse.json();
    console.log(`✅ Session step created: ${step.data.id}`);

    // Step 4: Get Simulation provider
    const providersResponse = await page.request.get(`${app.urls.api}/providers`, {
        headers: {
            'Authorization': `Bearer ${guestToken}`,
            'Content-Type': 'application/json'
        }
    });

    const providers = await providersResponse.json();
    const simulationProvider = providers.data.find(p => p.name === 'Simulation');

    if (!simulationProvider) {
        throw new Error('Simulation provider not found');
    }

    console.log(`✅ Simulation provider found: ${simulationProvider.id}`);

    // Step 5: Import persona payload function (COMPLETE version with all 32 checks)
    const { getPrimaryPersonaPayload, getCoApplicantPersonaPayloadMismatch } =
        await import('../test_files/persona-id-household-test-COMPLETE.js');

    // Step 6: Generate appropriate payload based on user type and mismatch
    let personaPayload;
    if (userType === 'primary') {
        personaPayload = getPrimaryPersonaPayload(userData);
        console.log(`📋 Using Primary Persona payload (name matches: ${userData.first_name} ${userData.last_name})`);
    } else if (useMismatchedName) {
        personaPayload = getCoApplicantPersonaPayloadMismatch();
        console.log(`📋 Using Co-Applicant Persona payload with MISMATCHED name: X Y (expected: ${userData.first_name} ${userData.last_name}) - TRIGGERS FLAG`);
    } else {
        personaPayload = getPrimaryPersonaPayload(userData);
        console.log(`📋 Using Co-Applicant Persona payload (name matches: ${userData.first_name} ${userData.last_name})`);
    }

    // Step 7: Create identity verification with PERSONA_PAYLOAD
    const verificationData = {
        step: step.data.id,
        provider: simulationProvider.id,
        simulation_type: 'PERSONA_PAYLOAD',
        custom_payload: personaPayload
    };

    console.log('📋 Creating identity verification with PERSONA_PAYLOAD...');
    const verificationResponse = await page.request.post(`${app.urls.api}/identity-verifications`, {
        headers: {
            'Authorization': `Bearer ${guestToken}`,
            'Content-Type': 'application/json'
        },
        data: verificationData
    });

    if (!verificationResponse.ok()) {
        const errorText = await verificationResponse.text();
        throw new Error(`Failed to create identity verification: ${verificationResponse.status()} - ${errorText}`);
    }

    const verification = await verificationResponse.json();
    console.log(`✅ Identity verification created: ${verification.data.id}`);

    // Step 8: Wait for verification to complete (polling)
    console.log('⏳ Waiting for identity verification to complete...');
    let verificationComplete = false;
    let pollCount = 0;
    const maxPolls = 10;

    while (!verificationComplete && pollCount < maxPolls) {
        await page.waitForTimeout(4000); // Wait 4 seconds between polls

        const verificationCheckResponse = await page.request.get(`${app.urls.api}/identity-verifications`, {
            headers: {
                'Authorization': `Bearer ${guestToken}`,
                'Content-Type': 'application/json'
            },
            params: {
                filters: JSON.stringify({
                    "$has": {
                        "step": {
                            "id": step.data.id
                        }
                    },
                    "status": {
                        "$neq": "EXPIRED"
                    }
                })
            }
        });

        const verifications = await verificationCheckResponse.json();
        const currentVerification = verifications.data.find(v => v.id === verification.data.id);

        if (currentVerification && ['COMPLETED', 'PROCESSING'].includes(currentVerification.status)) {
            verificationComplete = true;
            console.log(`✅ Identity verification completed with status: ${currentVerification.status}`);
        } else {
            pollCount++;
            console.log(`⏳ Verification not complete yet, polling... (${pollCount}/${maxPolls})`);
        }
    }

    if (!verificationComplete) {
        throw new Error('Identity verification timed out');
    }

    // Step 9: Mark session step as COMPLETED
    console.log('📄 Marking IDENTITY step as completed...');
    await page.request.patch(`${app.urls.api}/sessions/${sessionId}/steps/${step.data.id}`, {
        headers: {
            'Authorization': `Bearer ${guestToken}`,
            'Content-Type': 'application/json'
        },
        data: {
            status: 'COMPLETED'
        }
    });

    console.log(`✅ IDENTITY verification completed for ${userType}`);
};

/**
 * Complete Financial Verification via API using Simulation provider with CUSTOM_PAYLOAD
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {String} sessionId - Session ID
 * @param {String} guestToken - Guest authentication token
 * @param {Object} userData - User data with first_name, last_name, email
 * @returns {Promise<void>}
 */
const completeFinancialStepViaAPI = async (page, sessionId, guestToken, userData) => {
    console.log('🚀 Starting Financial Verification via API with CUSTOM_PAYLOAD...');

    // 1) Get current session state
    const sessionResponse = await page.request.get(`${app.urls.api}/sessions/${sessionId}`, {
        headers: {
            'Authorization': `Bearer ${guestToken}`,
            'Content-Type': 'application/json'
        }
    });
    const session = await sessionResponse.json();

    // 2) Ensure we are on FINANCIAL step
    if (session.data.state.current_step.type !== 'FINANCIAL_VERIFICATION' &&
        session.data.state.current_step.task?.key !== 'FINANCIAL_VERIFICATION') {
        console.log(`⚠️ Current step is not FINANCIAL_VERIFICATION. Step: ${session.data.state.current_step.type}`);
        throw new Error('Cannot complete financial step - not on FINANCIAL_VERIFICATION step');
    }
    console.log('✅ On FINANCIAL_VERIFICATION step');

    // 3) Create session step
    const stepResponse = await page.request.post(`${app.urls.api}/sessions/${sessionId}/steps`, {
        headers: {
            'Authorization': `Bearer ${guestToken}`,
            'Content-Type': 'application/json'
        },
        data: { step: session.data.state.current_step.id }
    });
    const step = await stepResponse.json();
    console.log(`✅ Session step created: ${step.data.id}`);

    // 4) Get Simulation provider
    const providersResponse = await page.request.get(`${app.urls.api}/providers`, {
        headers: {
            'Authorization': `Bearer ${guestToken}`,
            'Content-Type': 'application/json'
        }
    });
    const providers = await providersResponse.json();
    const simulationProvider = providers.data.find(p => p.name === 'Simulation');
    if (!simulationProvider) {
        throw new Error('Simulation provider not found');
    }
    console.log(`✅ Simulation provider found: ${simulationProvider.id}`);

    // 5) Build CUSTOM_PAYLOAD from minimal bank data
    const customPayload = getBankStatementCustomPayload(userData);

    // 6) Create financial verification with CUSTOM_PAYLOAD
    const verificationData = {
        step: step.data.id,
        provider: simulationProvider.id,
        simulation_type: 'CUSTOM_PAYLOAD',
        custom_payload: customPayload
    };
    console.log('📋 Creating financial verification with CUSTOM_PAYLOAD...');
    const verificationResponse = await page.request.post(`${app.urls.api}/financial-verifications`, {
        headers: {
            'Authorization': `Bearer ${guestToken}`,
            'Content-Type': 'application/json'
        },
        data: verificationData
    });
    if (!verificationResponse.ok()) {
        const errorText = await verificationResponse.text();
        throw new Error(`Failed to create financial verification: ${verificationResponse.status()} - ${errorText}`);
    }
    const verification = await verificationResponse.json();
    console.log(`✅ Financial verification created: ${verification.data.id}`);

    // 7) Poll verifications until our verification is COMPLETED
    console.log('⏳ Waiting for financial verification to complete...');
    let verificationComplete = false;
    let pollCount = 0;
    const maxPolls = 15;
    while (!verificationComplete && pollCount < maxPolls) {
        await page.waitForTimeout(4000);
        const verificationCheckResponse = await page.request.get(`${app.urls.api}/financial-verifications`, {
            headers: {
                'Authorization': `Bearer ${guestToken}`,
                'Content-Type': 'application/json'
            },
            params: {
                filters: JSON.stringify({
                    "$has": { "step": { "id": step.data.id } },
                    "status": { "$neq": "EXPIRED" }
                })
            }
        });
        const verifications = await verificationCheckResponse.json();
        const currentVerification = verifications.data.find(v => v.id === verification.data.id);
        if (currentVerification && currentVerification.status === 'COMPLETED') {
            verificationComplete = true;
            console.log('✅ Financial verification completed');
            break;
        } else if (currentVerification && currentVerification.status === 'FAILED') {
            throw new Error('Financial verification failed');
        }
        pollCount++;
        console.log(`⏳ Verification not complete yet, polling... (${pollCount}/${maxPolls})`);
    }
    if (!verificationComplete) {
        throw new Error('Financial verification timed out');
    }

    // 8) Mark session step as COMPLETED
    await page.request.patch(`${app.urls.api}/sessions/${sessionId}/steps/${step.data.id}`, {
        headers: {
            'Authorization': `Bearer ${guestToken}`,
            'Content-Type': 'application/json'
        },
        data: { status: 'COMPLETED' }
    });
    console.log('✅ FINANCIAL step marked as COMPLETED');
};

/**
 * Complete Employment Verification via API using Simulation provider with VERIDOCS_PAYLOAD
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {String} sessionId - Session ID
 * @param {String} guestToken - Guest authentication token
 * @param {Object} userData - User data with first_name, last_name, email
 * @param {Boolean} autoCompleteStep - If true (default), automatically marks step as COMPLETED. If false, leaves step for manual UI completion
 * @returns {Promise<void>}
 */
const completeEmploymentStepViaAPI = async (page, sessionId, guestToken, userData, autoCompleteStep = true) => {
    console.log('🚀 Starting Employment Verification via API with VERIDOCS_PAYLOAD...');

    // 1) Wait/poll until current step is EMPLOYMENT_VERIFICATION (in case UI hasn't advanced yet)
    let currentStep;
    let attempts = 0;
    const maxAttempts = 10;
    do {
        const sessionResponse = await page.request.get(`${app.urls.api}/sessions/${sessionId}`, {
            headers: {
                'Authorization': `Bearer ${guestToken}`,
                'Content-Type': 'application/json'
            }
        });
        const session = await sessionResponse.json();
        currentStep = session.data.state.current_step;
        if (currentStep?.type === 'EMPLOYMENT_VERIFICATION' || currentStep?.task?.key === 'EMPLOYMENT_VERIFICATION') {
            break;
        }
        console.log(`⏳ Waiting for EMPLOYMENT_VERIFICATION step... (attempt ${attempts + 1}/${maxAttempts})`);
        await page.waitForTimeout(2000);
        attempts++;
    } while (attempts < maxAttempts);

    if (!(currentStep?.type === 'EMPLOYMENT_VERIFICATION' || currentStep?.task?.key === 'EMPLOYMENT_VERIFICATION')) {
        console.log(`⚠️ Current step is not EMPLOYMENT_VERIFICATION. Step: ${currentStep?.type}`);
        throw new Error('Cannot complete employment step - not on EMPLOYMENT_VERIFICATION step');
    }
    console.log('✅ On EMPLOYMENT_VERIFICATION step');

    // 3) Create session step
    const stepResponse = await page.request.post(`${app.urls.api}/sessions/${sessionId}/steps`, {
        headers: {
            'Authorization': `Bearer ${guestToken}`,
            'Content-Type': 'application/json'
        },
        data: { step: currentStep.id }
    });
    const step = await stepResponse.json();
    console.log(`✅ Session step created: ${step.data.id}`);

    // 4) Get Simulation provider
    const providersResponse = await page.request.get(`${app.urls.api}/providers`, {
        headers: {
            'Authorization': `Bearer ${guestToken}`,
            'Content-Type': 'application/json'
        }
    });
    const providers = await providersResponse.json();
    const simulationProvider = providers.data.find(p => p.name === 'Simulation');
    if (!simulationProvider) {
        throw new Error('Simulation provider not found');
    }
    console.log(`✅ Simulation provider found: ${simulationProvider.id}`);

    // 5) Build VERIDOCS payload for paystub
    const veridocsDoc = getPaystubVeridocsSimulation(userData);
    const customPayload = { documents: [veridocsDoc] };

    // 6) Create employment verification with VERIDOCS_PAYLOAD
    const verificationData = {
        step: step.data.id,
        provider: simulationProvider.id,
        simulation_type: 'VERIDOCS_PAYLOAD',
        custom_payload: customPayload
    };
    console.log('📋 Creating employment verification with VERIDOCS_PAYLOAD...');
    const verificationResponse = await page.request.post(`${app.urls.api}/employment-verifications`, {
        headers: {
            'Authorization': `Bearer ${guestToken}`,
            'Content-Type': 'application/json'
        },
        data: verificationData
    });
    if (!verificationResponse.ok()) {
        const errorText = await verificationResponse.text();
        throw new Error(`Failed to create employment verification: ${verificationResponse.status()} - ${errorText}`);
    }
    const verification = await verificationResponse.json();
    console.log(`✅ Employment verification created: ${verification.data.id}`);

    // 7) Poll verifications until our verification is COMPLETED
    console.log('⏳ Waiting for employment verification to complete...');
    let verificationComplete = false;
    let pollCount = 0;
    const maxPolls = 50;
    while (!verificationComplete && pollCount < maxPolls) {
        await page.waitForTimeout(700);
        const verificationCheckResponse = await page.request.get(`${app.urls.api}/employment-verifications`, {
            headers: {
                'Authorization': `Bearer ${guestToken}`,
                'Content-Type': 'application/json'
            },
            params: {
                filters: JSON.stringify({
                    "$has": { "step": { "id": step.data.id } },
                    "status": { "$neq": "EXPIRED" }
                })
            }
        });
        const verifications = await verificationCheckResponse.json();
        const currentVerification = verifications.data.find(v => v.id === verification.data.id);
        if (currentVerification && currentVerification.status === 'COMPLETED') {
            verificationComplete = true;
            console.log('✅ Employment verification completed');
            break;
        } else if (currentVerification && currentVerification.status === 'FAILED') {
            throw new Error('Employment verification failed');
        }
        pollCount++;
        console.log(`⏳ Verification not complete yet, polling... (${pollCount}/${maxPolls})`);
    }
    if (!verificationComplete) {
        throw new Error('Employment verification timed out');
    }

    // 8) Mark session step as COMPLETED (conditional based on autoCompleteStep parameter)
    if (autoCompleteStep) {
        await page.request.patch(`${app.urls.api}/sessions/${sessionId}/steps/${step.data.id}`, {
            headers: {
                'Authorization': `Bearer ${guestToken}`,
                'Content-Type': 'application/json'
            },
            data: { status: 'COMPLETED' }
        });
        console.log('✅ EMPLOYMENT step marked as COMPLETED');
    } else {
        console.log('ℹ️ EMPLOYMENT step NOT auto-completed (autoCompleteStep = false) - manual UI completion required');
    }
};

async function startSessionFlow(link, browser) {
    const linkUrl = new URL(link);
    console.log("➡️ Launching new browser context for applicant...");
    const context = await browser.newContext();
    const applicantPage = await context.newPage();
    const gotoUrl = joinUrl(app.urls.app, `${linkUrl.pathname}${linkUrl.search}`);
    console.log("➡️ Navigating applicant page to:", gotoUrl);
    await applicantPage.goto(gotoUrl);
    return applicantPage;
}

/**
 * Wait for an element to become visible with optional retry and reload logic
 * More robust than simple expect().toBeVisible() for elements that may take time to appear
 * 
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {import('@playwright/test').Locator} locator - Element locator to wait for
 * @param {Object} options - Configuration options
 * @param {number} options.maxAttempts - Maximum retry attempts (default: 10)
 * @param {number} options.pollInterval - Time between retries in ms (default: 5000)
 * @param {boolean} options.reloadOnLastAttempt - Reload page on last attempt if still not visible (default: false)
 * @param {string} options.errorMessage - Custom error message if element not found
 * @returns {Promise<void>}
 * 
 * @example
 * await waitForElementVisible(page, finConnectionRow, {
 *     maxAttempts: 10,
 *     pollInterval: 5000,
 *     reloadOnLastAttempt: true,
 *     errorMessage: 'Connection row did not become visible'
 * });
 */
const waitForElementVisible = async (page, locator, options = {}) => {
    const {
        maxAttempts = 10,
        pollInterval = 5000,
        reloadOnLastAttempt = false,
        errorMessage = 'Element did not become visible after maximum attempts'
    } = options;

    let elementVisible = false;
    for (let i = 0; i < maxAttempts; i++) {
        if (i === maxAttempts - 1 && reloadOnLastAttempt) {
            console.log(`⚠️ Reloading page on last attempt to detect element...`);
            await page.reload();
            await page.waitForTimeout(2000); // Wait for page to stabilize after reload
        }

        if (await locator.isVisible()) {
            elementVisible = true;
            break;
        }

        if (i < maxAttempts - 1) {
            await page.waitForTimeout(pollInterval);
        }
    }

    if (!elementVisible) {
        throw new Error(errorMessage);
    }
};

/**
 * Wait for an element's text content to match expected value with polling
 * More robust than simple expect().toHaveText() for text that may change during render
 * 
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {import('@playwright/test').Locator} locator - Element locator containing text
 * @param {string} expectedText - Expected text value (case-insensitive comparison)
 * @param {Object} options - Configuration options
 * @param {number} options.maxAttempts - Maximum retry attempts (default: 10)
 * @param {number} options.pollInterval - Time between retries in ms (default: 5000)
 * @param {boolean} options.reloadOnLastAttempt - Reload page on last attempt if still not matching (default: false)
 * @param {string} options.errorMessage - Custom error message if text doesn't match
 * @returns {Promise<void>}
 * 
 * @example
 * await waitForElementText(page, statusLocator, 'failed', {
 *     maxAttempts: 10,
 *     pollInterval: 5000,
 *     reloadOnLastAttempt: true,
 *     errorMessage: 'Status did not become "failed"'
 * });
 */
const waitForElementText = async (page, locator, expectedText, options = {}) => {
    const {
        maxAttempts = 10,
        pollInterval = 5000,
        reloadOnLastAttempt = false,
        errorMessage = `Element text did not become "${expectedText}" after maximum attempts`
    } = options;

    const normalizedExpected = expectedText.toLowerCase().trim();
    let textMatched = false;

    for (let i = 0; i < maxAttempts; i++) {
        if (i === maxAttempts - 1 && reloadOnLastAttempt) {
            console.log(`⚠️ Reloading page on last attempt to detect text "${expectedText}"...`);
            await page.reload();
            await page.waitForTimeout(2000); // Wait for page to stabilize after reload
        }

        try {
            const text = (await locator.textContent() || '').toLowerCase().trim();
            if (text === normalizedExpected) {
                textMatched = true;
                break;
            }
        } catch (error) {
            // Element might not be available yet, continue polling
            console.log(`⚠️ Error reading text content (attempt ${i + 1}/${maxAttempts}): ${error.message}`);
        }

        if (i < maxAttempts - 1) {
            await page.waitForTimeout(pollInterval);
        }
    }

    if (!textMatched) {
        throw new Error(errorMessage);
    }

    // Final verification using expect for better error message
    await expect(locator).toHaveText(expectedText, { ignoreCase: true, timeout: 20_000 });
};

/**
 * Verify skip button is visible, click it, and confirm step status becomes "skipped"
 * Extracts the common pattern of skip button verification and clicking
 * 
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {import('@playwright/test').Locator} stepLocator - Locator for the step container
 * @param {string} skipButtonTestId - Test ID for the skip button
 * @param {string} stepName - Name of the step (for logging)
 * @param {string} stepType - Step type for status locator (e.g., 'IDENTITY_VERIFICATION', 'FINANCIAL_VERIFICATION')
 * @param {Object} options - Configuration options
 * @param {number} options.skipButtonTimeout - Timeout for skip button visibility (default: 30_000)
 * @returns {Promise<void>}
 * 
 * @example
 * await verifyAndClickSkipButton(
 *     page,
 *     idStep,
 *     'identity-skip-btn',
 *     'ID Verification',
 *     'IDENTITY_VERIFICATION'
 * );
 */
const verifyAndClickSkipButton = async (page, stepLocator, skipButtonTestId, stepName, stepType, options = {}) => {
    const { skipButtonTimeout = 30_000 } = options;

    // Small stabilization wait to give the UI time to render the skip button
    await page.waitForTimeout(2_000);

    // Verify skip button is available
    const skipBtn = stepLocator.getByTestId(skipButtonTestId);
    await expect(skipBtn).toBeVisible({ timeout: skipButtonTimeout });

    // Click skip button
    console.log(`⏩ Skipping ${stepName} step...`);
    await skipBtn.click();

    // Handle skip reason modal if it appears
    await handleSkipReasonModal(page, `Skipping ${stepName} step for test purposes`);

    // Verify step status becomes "skipped"
    const stepStatus = page.locator(`[data-testid^="step-${stepType}"]`).filter({ visible: true });
    await expect(stepStatus.getByTestId('step-status')).toHaveText('skipped', { ignoreCase: true });
    console.log(`✅ ${stepName} step skipped.`);
};

async function sessionFlow(adminClient, guestClient, application, user, {
    type = 'affordable_occupant'
} = {}) {

    const returnData = {}

    console.log("[sessionFlow] Creating session...");
    let session1 = await createSession(adminClient, application, user);
    console.log("[sessionFlow] Created session ID:", session1 && session1.id);

    console.log("[sessionFlow] Logging in with guest user...");
    await loginWithGuestUser(guestClient, session1.url);

    console.log("[sessionFlow] Getting guest user info...");
    await getGuestUser(guestClient);

    if (type) {
        console.log(`[sessionFlow] Setting session type: ${type}`);
        await guestClient.patch(`/sessions/${session1.id}`, { type });
    }

    console.log("[sessionFlow] Fetching session after type set...");
    session1 = await getSession(guestClient, session1.id);

    if (session1.state.current_step.type === 'START') {
        console.log("[sessionFlow] Completing START step...");
        await completeStartStep(guestClient, session1);
    }

    console.log("[sessionFlow] Fetching session after START step completion...");
    session1 = await getSession(guestClient, session1.id);

    if (session1.state.current_step.type === 'TASK' && session1.state.current_step.task?.key === 'APPLICANTS') {
        console.log("[sessionFlow] Skipping APPLICANTS step...");
        await skipStep(guestClient, session1);
    }

    console.log("[sessionFlow] Fetching session after APPLICANTS step...");
    session1 = await getSession(guestClient, session1.id);

    console.log("[sessionFlow] Getting providers...");
    const providers = await getProviders(guestClient);
    const simulationProvider = providers.find(providerItem => providerItem.name === 'Simulation');
    console.log("[sessionFlow] Using simulation provider:", simulationProvider && simulationProvider.id);

    if (session1.state.current_step.type === 'TASK' && session1.state.current_step.task?.key === 'IDENTITY_VERIFICATION') {
        console.log("[sessionFlow] Completing IDENTITY_VERIFICATION step...");
        returnData.identityVerification = await personaIdentityStep(guestClient, session1, user, simulationProvider);
    }

    console.log("[sessionFlow] Fetching session after IDENTITY_VERIFICATION...");
    session1 = await getSession(guestClient, session1.id);

    if (session1.state.current_step.type === 'TASK' && session1.state.current_step.task?.key === 'FINANCIAL_VERIFICATION') {
        console.log("[sessionFlow] Completing FINANCIAL_VERIFICATION step...");
        await completeFinancialStep(guestClient, session1, user, simulationProvider);
    }

    console.log("[sessionFlow] Fetching session after FINANCIAL_VERIFICATION...");
    session1 = await getSession(guestClient, session1.id);

    if (session1.state.current_step.type === 'TASK' && session1.state.current_step.task?.key === 'EMPLOYMENT_VERIFICATION') {
        console.log("[sessionFlow] Completing EMPLOYMENT_VERIFICATION step...");
        await completeEmploymentStep(guestClient, session1, user, simulationProvider);
    }
    console.log("[sessionFlow] Fetching session after EMPLOYMENT_VERIFICATION...");
    session1 = await getSession(guestClient, session1.id);

    returnData.session = session1

    console.log("[sessionFlow] Flow complete. Returning data.");
    return returnData;
}

async function completeEmploymentStep(guestClient, session1, user, simulationProvider) {
    console.log("[completeEmploymentStep] Starting Employment Verification...");
    const stepResponse = await guestClient.post(`/sessions/${session1.id}/steps`, { step: session1.state.current_step.id });
    const step = stepResponse.data?.data;
    await expect(step).toBeDefined();

    console.log("[completeEmploymentStep] Creating paystub data for employment...");
    const veridocsData = createPaystubData(user);
    const simulationData = {
        simulation_type: 'VERIDOCS_PAYLOAD',
        custom_payload: { documents: [veridocsData] }
    };
    const type = "Employment";
    console.log("[completeEmploymentStep] Simulating verification...");
    await simulateVerification(guestClient, '/employment-verifications', simulationProvider, step, simulationData, type);

    console.log("[completeEmploymentStep] Marking step as COMPLETED...");
    await guestClient.patch(`/sessions/${session1.id}/steps/${step.id}`, { status: 'COMPLETED' });
    console.log("[completeEmploymentStep] Employment Verification complete.");
}

async function completeFinancialStep(guestClient, session1, user, simulationProvider) {
    console.log("[completeFinancialStep] Starting Financial Verification...");
    const stepResponse = await guestClient.post(`/sessions/${session1.id}/steps`, { step: session1.state.current_step.id });
    const step = stepResponse.data?.data;
    await expect(step).toBeDefined();

    console.log("[completeFinancialStep] Creating customVeriDocsBankStatementData...");
    const veridocsData = customVeriDocsBankStatementData(user, 4, "weekly", 5, {
        creditAmount: 2000,
        payrollDescription: "PAYROLL DEPOSIT",
        extraCreditCount: 5,
        miscDescriptions: 2,
        extraCreditAmount: 1000,
    });
    const simulationData = {
        simulation_type: 'VERIDOCS_PAYLOAD',
        custom_payload: veridocsData
    };
    const type = "Financial";
    console.log("[completeFinancialStep] Simulating verification...");
    await simulateVerification(guestClient, '/financial-verifications', simulationProvider, step, simulationData, type);

    console.log("[completeFinancialStep] Marking step as COMPLETED...");
    await guestClient.patch(`/sessions/${session1.id}/steps/${step.id}`, { status: 'COMPLETED' });
    console.log("[completeFinancialStep] Financial Verification complete.");
}

async function personaIdentityStep(guestClient, session1, user, simulationProvider) {
    console.log("[personaIdentityStep] Starting Identity Verification...");
    const stepResponse = await guestClient.post(`/sessions/${session1.id}/steps`, { step: session1.state.current_step.id });
    const step = stepResponse.data?.data;
    await expect(step).toBeDefined();

    console.log("[personaIdentityStep] Creating personaConnectData...");
    const identityPayload = personaConnectData(user);
    const identitySimulationData = {
        simulation_type: 'PERSONA_PAYLOAD',
        custom_payload: identityPayload
    };
    const type = "Identity";
    console.log("[personaIdentityStep] Simulating verification...");
    await simulateVerification(guestClient, '/identity-verifications', simulationProvider, step, identitySimulationData, type);

    console.log("[personaIdentityStep] Marking step as COMPLETED...");
    await guestClient.patch(`/sessions/${session1.id}/steps/${step.id}`, { status: 'COMPLETED' });

    console.log("[personaIdentityStep] Fetching identity-verifications for step...");
    const idenityVerificationResponse = await guestClient.get('/identity-verifications', {
        params: {
            filters: JSON.stringify(
                { "$has": { "step": { "session_id": { "$in": [session1.id] } } } }
            )
        }
    })

    const idenityVerifications = idenityVerificationResponse?.data?.data
    await expect(Array.isArray(idenityVerifications)).toBeTruthy()
    await expect(idenityVerifications.length > 0).toBeTruthy()

    console.log("[personaIdentityStep] Identity Verification complete. Returning object.");
    return idenityVerifications[0]

}

async function skipStep(guestClient, session1) {
    console.log("[skipStep] Skipping current step...");
    const stepResponse = await guestClient.post(`/sessions/${session1.id}/steps`, { step: session1.state.current_step.id });
    const step = stepResponse.data?.data;
    await expect(step).toBeDefined();
    await guestClient.patch(`/sessions/${session1.id}/steps/${step.id}`, { status: 'SKIPPED' });
    console.log("[skipStep] Step skipped.");
}

async function completeStartStep(guestClient, session1) {
    console.log("[completeStartStep] Completing START step...");
    const stepResponse = await guestClient.post(`/sessions/${session1.id}/steps`, { step: session1.state.current_step.id });
    const step = stepResponse.data?.data;
    await guestClient.patch(`/sessions/${session1.id}`, { target: 500 });
    await expect(step).toBeDefined();
    await guestClient.patch(`/sessions/${session1.id}/steps/${step.id}`, { status: 'COMPLETED' });
    console.log("[completeStartStep] START step completed.");
}

async function createSession(adminClient, application, user) {
    console.log("[createSession] Creating session for user:", user.email, "on app:", application?.id);
    let session1Response = await adminClient.post('/sessions', {
        application: application.id,
        invite: true,
        ...user
    });
    let session1 = session1Response.data?.data;
    await expect(session1).toBeDefined();
    console.log("[createSession] Session created:", session1 && session1.id);
    return session1;
}

// Added guestClient to function signature for logging purposes, and accept sessionId
async function getProviders(guestClient) {
    console.log("[getProviders] Fetching providers...");
    const providerResponse = await guestClient.get(`/providers`)
    const providers = providerResponse?.data?.data
    expect(providers).toBeDefined()
    console.log("[getProviders] Providers fetched:", providers.map(p => p.name).join(', '));
    return providers
}

async function getSession(guestClient, sessionId) {
    console.log(`[getSession] Fetching session with ID: ${sessionId}...`);
    const session1Response = await guestClient.get(`/sessions/${sessionId}`, {
        params: SESSION_FIELDS
    })
    const session = session1Response?.data?.data
    expect(session).toBeDefined()
    console.log(`[getSession] Session fetched for ID: ${sessionId}`);
    return session
}

async function getGuestUser(guestClient) {
    console.log("[getGuestUser] Fetching guest user info...");
    const userResponse = await guestClient.get('/guests/self')
    const guest = userResponse.data?.data;
    console.log("[getGuestUser] Guest info retrieved:", guest && guest.email);
    return guest;
}

/**
 * Handle skip reason modal that appears when skipping a step
 * Fills in the reason textarea and clicks the Skip button
 * 
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} reason - Reason text to fill in (default: "Test skip reason")
 * @param {Object} options - Configuration options
 * @param {number} options.timeout - Timeout for modal to appear (default: 10000ms)
 * @param {boolean} options.cancel - If true, clicks Cancel instead of Skip (default: false)
 * @returns {Promise<void>}
 * 
 * @example
 * // After clicking skip button, handle the reason modal
 * await handleSkipReasonModal(page, "Not applicable for this applicant");
 * 
 * @example
 * // Cancel the skip operation
 * await handleSkipReasonModal(page, "", { cancel: true });
 */
const handleSkipReasonModal = async (page, reason = 'Test skip reason', options = {}) => {
    const { timeout = 10000, cancel = false } = options;

    console.log('🔍 Waiting for skip reason modal to appear...');

    // TODO: Change to data-testid="skip-reason-modal" when available
    // Currently using text-based selector as fallback (modal title)
    const modalTitle = page.locator('h3:has-text("Skip:")');

    try {
        // Wait for modal to appear (checking for title)
        await modalTitle.waitFor({ state: 'visible', timeout });
        console.log('✅ Skip reason modal appeared');
    } catch (error) {
        // Modal might not appear if skip doesn't require reason
        console.log('⏭️ Skip reason modal not found, step may not require reason');
        return;
    }

    // Get dialog reference for scoped selectors
    const dialog = page.getByRole('dialog');

    if (cancel) {
        // TODO: Change to data-testid="skip-reason-cancel-btn" when available
        // Currently using button text "Cancel" scoped to dialog as fallback
        const cancelButton = dialog.getByRole('button', { name: 'Cancel' });

        console.log('🚫 Clicking Cancel button in reason modal...');
        await cancelButton.waitFor({ state: 'visible', timeout: 5000 });
        await cancelButton.click();

        // Wait for modal to close
        try {
            await modalTitle.waitFor({ state: 'hidden', timeout: 5000 });
            console.log('✅ Skip reason modal closed (cancelled)');
        } catch (error) {
            console.log('ℹ️ Modal closed (or closed quickly)');
        }

        await page.waitForTimeout(1000);
        return;
    }

    // TODO: Change to data-testid="skip-reason-textarea" when available
    // Currently using id="skip-reason" as fallback
    const reasonTextarea = page.locator('textarea#skip-reason');

    // Fill in the reason
    console.log(`📝 Filling skip reason: "${reason}"`);
    await reasonTextarea.waitFor({ state: 'visible', timeout: 5000 });
    await reasonTextarea.fill(reason);
    await page.waitForTimeout(500); // Small wait for input to register

    // TODO: Change to data-testid="skip-reason-skip-btn" when available
    // Currently using button text "Skip" scoped to dialog as fallback
    const skipButton = dialog.getByRole('button', { name: 'Skip' });

    // Click Skip button
    console.log('🚀 Clicking Skip button in reason modal...');
    await skipButton.waitFor({ state: 'visible', timeout: 5000 });
    await skipButton.click();

    // Wait for modal to close
    try {
        await modalTitle.waitFor({ state: 'hidden', timeout: 5000 });
        console.log('✅ Skip reason modal closed');
    } catch (error) {
        // Modal might close quickly, continue anyway
        console.log('ℹ️ Modal closed (or closed quickly)');
    }

    // Small wait for page to update
    await page.waitForTimeout(3000);
    console.log('✅ Skip reason modal handled successfully');
};


async function handleStateAndTermsCheckbox(page, session) {

    console.log('🔍 Checking for state modal requirement...');
    if (!session?.applicant?.administrative_area && session?.application.workflow?.steps?.some(step => [
        sessionConfig.STEP_KEYS.FINANCIAL, sessionConfig.STEP_KEYS.EMPLOYMENT
    ].includes(step?.task?.key))) {

        const stateModal = page.getByTestId('state-modal');
        await expect(stateModal).toBeVisible({ timeout: 20_000 });

        await handleOptionalStateModal(page);
    }
    console.log('🔍 Checking for terms and conditions checkbox...');
    const termsCheckbox = page.getByTestId('user-terms');
    if (await termsCheckbox.isVisible()) {
        await termsCheckbox.check();
        await page.getByTestId('terms-submit-btn').click();
    }
    await page.waitForTimeout(1000);
}

/**
 * Handle the connection acknowledgement modal that appears when clicking
 * "Directly Connect to Employer". When upload limit is reached, only the
 * acknowledge-connect-employer-btn should be visible (upload section hidden).
 *
 * @param {import('@playwright/test').Page} page
 */
const handleConnectAcknowledgeModal = async page => {
    const maxAttempts = 10;
    const intervalMs = 1000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const dialog = page.getByRole('dialog');
        const dialogVisible = await dialog.isVisible().catch(() => false);

        if (dialogVisible) {
            const connectBtn = dialog.getByTestId('acknowledge-connect-employer-btn');
            const btnVisible = await connectBtn.isVisible().catch(() => false);

            if (btnVisible) {
                console.log('   Found acknowledge-connect-employer-btn — clicking');
                await connectBtn.click({ timeout: 20_000 });
                await page.waitForTimeout(1500);
                return;
            }

            // Fallback: text match for connect button
            const textBtn = dialog.getByRole('button', { name: /Directly Connect/i });
            const textBtnVisible = await textBtn.isVisible().catch(() => false);
            if (textBtnVisible) {
                await textBtn.click({ timeout: 20_000 });
                await page.waitForTimeout(1500);
                return;
            }
        }

        await page.waitForTimeout(intervalMs);
    }
    console.log('   info No connection acknowledge modal appeared — continuing');
};


export {
    uploadStatementFinancialStep,
    simulatorFinancialStepWithVeridocs,
    completeIdentityStepViaAPI,
    completeFinancialStepViaAPI,
    completeEmploymentStepViaAPI,
    completeApplicantForm,
    waitForConnectionCompletion,
    waitForPlaidConnectionCompletion,
    waitForPaystubConnectionCompletion,
    waitForSimulatorConnectionCompletion,
    continueFinancialVerification,
    createSessionForUser,
    createSessionWithSimulator,
    handleOptionalStateModal,
    handleOptionalTermsCheckbox,
    handleModalsWithRaceConditionFix,
    setupInviteLinkSession,
    employmentVerificationWalmartPayStub,
    skipEmploymentVerification,
    plaidFinancialConnect,
    skipApplicants,
    completeIdVerification,
    completeApplicantRegistrationForm,
    updateStateModal,
    fillhouseholdForm,
    selectApplicantType,
    completePaystubConnection,
    completePlaidFinancialStep,
    completePrerequisiteStepIfVisible,
    updateRentBudget,
    connectBankOAuthFlow,
    identityStep,
    completePlaidFinancialStepBetterment,
    waitForButtonOrAutoAdvance,
    startSessionFlow,
    waitForElementVisible,
    waitForElementText,
    verifyAndClickSkipButton,
    sessionFlow,
    handleSkipReasonModal,
    handleBankConnectInfoModal,
    handleStateAndTermsCheckbox,
    handleConnectAcknowledgeModal
};

