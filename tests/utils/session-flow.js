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
import { app } from '../test_config';
import loginForm from './login-form';
import { findApplicationByNameAndInvite } from './applications-page';
import generateSessionForm from './generate-session-form';
import { getBankStatementCustomPayload } from '../test_files/mock_data/bank-statement-simulator.js';
import { getPaystubVeridocsSimulation } from '../test_files/mock_data/paystub-simulator.js';

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

    // Use custom locator if provided, otherwise poll for element to be visible (max 20 seconds)
    let connectionRows;
    if (customLocator) {
        connectionRows = customLocator;
    } else {
        const locator = page.locator(selector);
        let elementFound = false;
        const maxAttempts = 40; // 40 attempts * 500ms = 20 seconds max
        const pollInterval = 500;
        
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
            throw new Error(`Element with selector "${selector}" not found after 20 seconds`);
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
            const connectionText = await element.innerText();
            if (connectionText.toLowerCase().includes(successText.toLowerCase())) {
                foundCompleted = true;
                console.log('✅ Real "completed" state detected!');
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
        selector: '[data-testid="-row-status"]',
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
const handleOptionalStateModal = async page => {
    // Wait for page to be fully loaded before checking for modal
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000); // Additional wait for dynamic content

    const stateModal = page.getByTestId('state-modal');

    // Check if state modal is visible for up to 6 seconds
    let isModalVisible = false;
    try {
        await stateModal.waitFor({ state: 'visible', timeout: 6000 });
        isModalVisible = true;
    } catch (error) {
        // Modal not visible within 6 seconds, continue without it
        console.log('⏭️ State modal not visible, continuing...');
        return;
    }

    if (isModalVisible) {

        // Check if first state is already "US"
        const firstStateText = await page.locator('.multiselect__single').textContent();

        if (firstStateText && firstStateText.trim() === 'US') {

            // First state is already US, skip to second state
            console.log('First state is already US, skipping to second state');
        } else {

            // First state is not US, click the parent of the parent with class containing "multiselect"
            await page.getByTestId('state-modal-country-select-search')
                .locator('xpath=../../..')
                .filter({ hasClass: /multiselect/ }) // TODO: request to add testid
                .click();
            await page.waitForTimeout(500);
            await page.keyboard.press('Enter');
        }

        // 4. Click second multiselect (parent of parent with class containing "multiselect")
        await page.getByTestId('state-modal-state-select-search')
            .locator('xpath=../../..')
            .filter({ hasClass: /multiselect/ }) // TODO: request to add testid
            .click();

        // 5. Wait 500ms
        await page.waitForTimeout(500);

        // 6. Press Enter
        await page.keyboard.press('Enter');

        // 7. Click submit state modal
        await page.getByTestId('submit-state-modal').click();
        await page.waitForTimeout(4000);
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
        bankName = 'Regions Bank'
    } = {}
) => {

    // Click "Alternate Connect Bank" button
    await expect(
        page.locator('button:has-text("Alternate Connect Bank")')
    ).toBeVisible({ timeout: 10000 });
    await page.locator('button:has-text("Alternate Connect Bank")').click();

    // Wait for Plaid iframe to load
    const plaidFrame = page.frameLocator('[id="plaid-link-iframe-1"]');

    // Click "Continue as guest" (using nth to select the second element)
    await expect(
        plaidFrame.locator('button[id="aut-secondary-button"]')
    ).toBeVisible({ timeout: 20000 });
    await plaidFrame.locator('button[id="aut-secondary-button"]').click();

    // Wait for and click "www.regions.com" button
    await expect(
        plaidFrame.locator(`button[aria-label="${bankName}"]`)
    ).toBeVisible({ timeout: 10000 });
    await plaidFrame.locator(`button[aria-label="${bankName}"]`).click();

    // Fill username
    await plaidFrame.locator('#aut-input-0-input').fill(username);

    // Fill password
    await plaidFrame.locator('#aut-input-1-input').fill(password);

    // Click Submit (using nth to select the second element)
    await plaidFrame
        .locator('button[id="aut-button"]:has-text("Submit")')
        .click();

    // Click Continue
    await expect(
        plaidFrame.locator('button[id="aut-button"]:has-text("Continue")')
    ).toBeVisible({ timeout: 10000 });
    await plaidFrame
        .locator('button[id="aut-button"]:has-text("Continue")')
        .click();

    // Click "Allow" button
    await expect(
        plaidFrame.getByRole('button', { name: 'Allow' })
    ).toBeVisible({ timeout: 10000 });
    await plaidFrame.getByRole('button', { name: 'Allow' }).click();

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
    const oauthBankOption = mxIframe.locator('[data-test="MX-Bank-(OAuth)-row"]')
        .or(mxIframe.locator('button[aria-label="Add account with MX Bank (OAuth)"]'));
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
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
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
    try{
        await page.getByTestId('state-modal').waitFor({ state: 'visible', timeout: 5000 })
        isStateVisible = true;
    }catch(err){
        isStateVisible = false;
    }

    if (isStateVisible) {
        await fillMultiselect(
            page,
            await page.locator(
                '[aria-owns="listbox-state-modal-state-select"]'
            ),
            [ state ]
        );

        await page.getByTestId('submit-state-modal').click();
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
    await expect(applicantPage.getByTestId('applicant-type-page')).toBeVisible({timeout: 20000});

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
    await applicantPage
        .getByTestId('financial-secondary-connect-btn')
        .click({ timeout: 20000 });

    const pFrame = await applicantPage.frameLocator('#plaid-link-iframe-1');

    // await expect(pFrame).toBeVisible({ timeout: 40_000 });
    const plaidFrame = await pFrame.locator('reach-portal');

    await plaidFrame.locator('#aut-secondary-button').click({ timeout: 20000 });

    await plaidFrame
        .locator('[aria-label="Bank of America"]')
        .click({ timeout: 20000 });

    const [popup] = await Promise.all([
        applicantPage.waitForEvent('popup'),
        plaidFrame.locator('#aut-button').click({ timeout: 20000 })
    ]);

    await popup.waitForLoadState();

    await popup.locator('#username').fill('custom_gig');
    await popup.locator('#password').fill('test');
    await popup.locator('#submit-credentials').click({ timeout: 20000 });
    await popup.waitForTimeout(1000);
    await popup.locator('#submit-device').click({ timeout: 20000 });
    await popup.waitForTimeout(1000);
    await popup.locator('#code').fill('11111111');
    await popup.locator('#submit-code').click({ timeout: 20000 });
    await popup.waitForTimeout(1000);
    await popup
        .locator('#accounts-list')
        .getByRole('checkbox')
        .click({ timeout: 20000 });
    await popup
        .locator('#additional-info-select')
        .locator('#name')
        .click({ timeout: 20000 });
    await popup
        .locator('#additional-info-select')
        .locator('#account-number')
        .click({ timeout: 20000 });

    await popup.locator('#submit-accounts').click({ timeout: 20000 });

    await popup.waitForTimeout(1000);

    await popup.locator('#terms').click({ timeout: 20000 });
    await popup.locator('#submit-confirmation').click({ timeout: 20000 });

    await applicantPage.waitForTimeout(5000);
    await plaidFrame
        .locator('#aut-button:not([disabled])')
        .click({ timeout: 20000 });

    // Click "Allow" button
    await expect(
        plaidFrame.getByRole('button', { name: 'Allow' })
    ).toBeVisible({ timeout: 10000 });
    await plaidFrame.getByRole('button', { name: 'Allow' }).click();

    await plaidFrame.locator('#aut-secondary-button').click({ timeout: 20000 });
};

/**
 * Complete Financial step Plaid Connection with Betterment (no popup auth flow)
 * @param {import('@playwright/test').Page} applicantPage
 */
const completePlaidFinancialStepBetterment = async (applicantPage, username = 'custom_gig', password = 'test') => {
    await applicantPage
        .getByTestId('financial-secondary-connect-btn')
        .click({ timeout: 20000 });

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

    // Click "Allow" button
    await expect(
        plaidFrame.getByRole('button', { name: 'Allow' })
    ).toBeVisible({ timeout: 10000 });
    await plaidFrame.getByRole('button', { name: 'Allow' }).click();

    await plaidFrame.locator('#aut-secondary-button').click({ timeout: 20000 });

    await applicantPage.waitForTimeout(2000);
};

const updateRentBudget = async (applicantPage, sessionId, amount = '2500') => {
    await applicantPage.locator('input#rent_budget').fill(amount);

    await Promise.all([
        applicantPage.waitForResponse(
            resp => resp.url() === joinUrl(app.urls.api, `sessions/${sessionId}`)
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
const identityStep = async applicantPage => {
    await applicantPage.getByTestId('start-id-verification').click({ timeout: 20_000 });

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
 * @returns {Promise<void>}
 */
const simulatorFinancialStepWithVeridocs = async (page, veridocsPayload) => {
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

    // Step 3: Click "Connect Bank" button and handle browser prompt
    console.log('🔍 Setting up browser prompt handler...');
    const connectBankBtn = await page.getByTestId('connect-bank');
    await expect(connectBankBtn).toBeVisible();
    
    // Convert the payload to JSON string
    const payloadString = JSON.stringify(veridocsPayload);
    console.log(`📋 Payload ready: ${payloadString.length} characters`);

    page.on('dialog', async dialog => {
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
    console.log('🔍 Waiting for dialog to appear...');

    // Step 4: Wait for simulator to process
    console.log('⏳ Waiting for simulator to process payload...');
    await page.waitForTimeout(5000);
    console.log('✅ Simulator processing completed');
    // Step 6: Check if connection row exists at all
    console.log('🔍 Checking if connection row exists...');
    const connectionRows = page.getByTestId('connection-row');
    const rowCount = await connectionRows.count();
    console.log(`📊 Found ${rowCount} connection row(s)`);
    
    if (rowCount === 0) {
        console.log('❌ No connection rows found - simulator may not have processed the payload');
        throw new Error('No connection rows found after simulator dialog');
    }
    
    // Step 7: Wait for completion
    console.log('⏳ Waiting for verification to complete...');
    await expect(page.getByTestId('connection-row').filter({ hasText: /Complete|Completed/i })).toBeVisible({ timeout: 60000 });
    
    console.log('✅ Verification completed successfully via simulator UI');
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
    continueFinancialVerification,
    createSessionForUser,
    createSessionWithSimulator,
    handleOptionalStateModal,
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
    updateRentBudget,
    connectBankOAuthFlow,
    identityStep,
    completePlaidFinancialStepBetterment,
    waitForButtonOrAutoAdvance
};

