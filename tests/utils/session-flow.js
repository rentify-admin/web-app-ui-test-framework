import { expect } from '@playwright/test';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { waitForJsonResponse } from '~/tests/utils/wait-response';
import { fillMultiselect } from './common';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import required dependencies
import { joinUrl } from './helper';
import { app } from '../test_config';
import loginForm from './login-form';
import { findApplicationByNameAndInvite } from './applications-page';
import generateSessionForm from './generate-session-form';

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

    // Use custom locator if provided, otherwise wait for element and get locator
    let connectionRows;
    if (customLocator) {
        connectionRows = customLocator;
    } else {
        await page.waitForSelector(selector, { timeout: 20000 });
        connectionRows = page.locator(selector);
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
    } while (!foundProcessing && rotation < maxIterations);

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
    } while (!foundCompleted && rotation < maxIterations);

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

    // Wait for employment verification step to be visible
    await expect(
        page.locator('button:has-text("Skip Employment Verification")')
    ).toBeVisible({ timeout: 20000 });

    // Click skip employment verification button
    await page
        .locator('button:has-text("Skip Employment Verification")')
        .click();

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

    // Fill first name
    await page.locator('#first_name').fill(firstName);

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

    await step.locator('#first_name').fill(user.first_name);
    await step.locator('#last_name').fill(user.last_name);
    await step.locator('#email_address').fill(user.email);

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
        .getByRole('button', { name: 'Pay Stub' })
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

    try {
        await empIFrame.locator('[data-test-id="finish-button"]').click({ timeout: 100_000 });
    } catch (er) {
        console.log('popup autoclosed')
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
        .getByRole('button', { name: 'Pay Stub' })
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
    await empIFrame
        .locator('[data-test-id="finish-button"]')
        .click({ timeout: 20000 });

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
    await plaidFrame.locator('#aut-secondary-button').click({ timeout: 20000 });
};

const updateRentBudget = async (applicantPage, sessionId, amount = '2500') => {
    await applicantPage.locator('input#rent_budget').fill(amount);

    await Promise.all([
        applicantPage.waitForResponse(
            resp => resp.url() === joinUrl(app.urls.api, `sessions/${sessionId}`)
                && resp.request().method() === 'PATCH'
                && resp.ok()
        ),
        applicantPage.locator('button[type="submit"]').click()
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

    await personaIFrame.locator('[data-test="button__primary"]').click({ timeout: 20_000 });

    await personaIFrame.locator('#select__option--dl').click({ timeout: 20_000 });

    await personaIFrame.locator('#government-id-prompt__button--web-camera:not(disabled)').click({ timeout: 20_000 });

    if (app.environment === 'development') {
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
    } else if (app.environment === 'staging') {
        await personaIFrame.locator('#scanner__button--capture-full:not(disabled)')
            .click({ timeout: 30_000 });
        await personaIFrame.locator('#government_id__check__continue:not(disabled)')
            .click({ timeout: 30_000 });
        await personaIFrame.locator('#scanner__button--capture-full:not(disabled)')
            .click({ timeout: 30_000 });
        await personaIFrame.locator('#government_id__check__continue:not(disabled)')
            .click({ timeout: 30_000 });
        await personaIFrame.locator('#selfie-prompt__button--camera:not(disabled)')
            .click({ timeout: 30_000 });
        await personaIFrame.locator('#selfie-scanner__capture--manual:not(disabled)')
            .click({ timeout: 30_000 });
        await personaIFrame.locator('#selfie-scanner__capture--manual:not(disabled)')
            .click({ timeout: 30_000 });
            await applicantPage.waitForTimeout(200);
        await personaIFrame.locator('#selfie-scanner__capture--manual:not(disabled)')
            .click({ timeout: 30_000 });
        await applicantPage.waitForTimeout(200);
        try {
            await personaIFrame.locator('#complete__button:not(disabled)')
                .click({ timeout: 30_000 });
        } catch (err) {
            console.log('Modal auto closed')
        }
    }
};


export {
    uploadStatementFinancialStep,
    completeApplicantForm,
    waitForConnectionCompletion,
    waitForPlaidConnectionCompletion,
    waitForPaystubConnectionCompletion,
    continueFinancialVerification,
    createSessionForUser,
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
    identityStep
};

