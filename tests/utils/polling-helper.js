/**
 * Universal Polling Helper
 * Provides reusable polling functions for various scenarios (flags, status, UI elements)
 */

/**
 * Poll for a flag to appear/disappear with optional modal refresh
 * 
 * @param {Page} page - Playwright page object
 * @param {Object} options - Polling configuration
 * @param {string} options.flagTestId - Flag test-id to poll for
 * @param {boolean} [options.shouldExist=true] - Whether flag should exist (true) or not exist (false)
 * @param {number} [options.maxPollTime=30000] - Max polling time in ms (default: 30s)
 * @param {number} [options.pollInterval=2000] - Interval between polls in ms (default: 2s)
 * @param {boolean} [options.refreshModal=false] - Whether to close/reopen details modal between polls
 * @param {boolean} [options.applicantScope=false] - Whether flag is applicant-scoped (requires Applicant tab to be active)
 * @param {boolean} [options.throwOnFail=true] - Whether to throw error if condition not met
 * @param {string} [options.errorMessage] - Custom error message
 * @returns {Promise<boolean>} - True if condition met, false otherwise
 * 
 * @example
 * // Poll for flag to appear
 * await pollForFlag(page, {
 *     flagTestId: 'GROUP_MISSING_IDENTITY',
 *     shouldExist: true,
 *     maxPollTime: 30000
 * });
 * 
 * @example
 * // Poll for flag to disappear with modal refresh
 * await pollForFlag(page, {
 *     flagTestId: 'GROUP_MISSING_IDENTITY',
 *     shouldExist: false,
 *     refreshModal: true
 * });
 */
const pollForFlag = async (page, options) => {
    const {
        flagTestId,
        shouldExist = true,
        maxPollTime = 30000,
        pollInterval = 2000,
        refreshModal = false,
        applicantScope = false,
        throwOnFail = true,
        errorMessage
    } = options;

    const maxPolls = Math.ceil(maxPollTime / pollInterval);
    const existVerb = shouldExist ? 'appear' : 'disappear';
    
    console.log(`🔍 Polling for flag "${flagTestId}" to ${existVerb} (max ${maxPollTime}ms, ${maxPolls} polls)...`);

    for (let i = 0; i < maxPolls; i++) {
        const flagElement = page.getByTestId(flagTestId);
        const flagCount = await flagElement.count();
        const conditionMet = shouldExist ? flagCount > 0 : flagCount === 0;

        if (conditionMet) {
            console.log(`✅ Flag "${flagTestId}" ${shouldExist ? 'found' : 'gone'} (poll ${i + 1}/${maxPolls})`);
            return true;
        }

        if (i < maxPolls - 1) {
            console.log(`⏳ Flag "${flagTestId}" not yet ${shouldExist ? 'visible' : 'gone'}, waiting... (poll ${i + 1}/${maxPolls})`);
            
            // Reload page every 6 checks to ensure fresh state
            if (i > 0 && i % 6 === 0) {
                console.log(`🔄 Reloading page after ${i} checks to refresh state...`);
                try {
                    await page.reload({ waitUntil: 'domcontentloaded' });
                    await page.waitForTimeout(2000); // Wait for page to stabilize
                    console.log(`✅ Page reloaded, continuing with check ${i + 1}...`);
                    
                    // If refreshModal was enabled, reopen the modal after reload
                    if (refreshModal) {
                        try {
                            await page.getByRole('button', { name: 'Alert' }).click({ timeout: 10000 });
                            await page.waitForTimeout(1000);
                            
                            // If flag is applicant-scoped, click Applicant tab after modal opens
                            if (applicantScope) {
                                const applicantTab = page.getByRole('button', { name: 'Applicant' });
                                const isApplicantTabVisible = await applicantTab.isVisible({ timeout: 2000 }).catch(() => false);
                                if (isApplicantTabVisible) {
                                    const isActive = await applicantTab.evaluate(el => 
                                        el.classList.contains('bg-primary-400') || el.classList.contains('font-semibold')
                                    ).catch(() => false);
                                    if (!isActive) {
                                        await applicantTab.click({ timeout: 5000 });
                                        await page.waitForTimeout(500);
                                    }
                                }
                            }
                        } catch (e) {
                            console.log(`⚠️ Could not reopen modal after reload: ${e.message}`);
                        }
                    }
                } catch (e) {
                    console.log(`⚠️ Could not reload page: ${e.message}`);
                }
            } else {
                await page.waitForTimeout(pollInterval);
            }

            // Optional: Refresh modal to get updated flags (only if not just reloaded)
            if (refreshModal && !(i > 0 && i % 6 === 0)) {
                try {
                    await page.getByTestId('close-event-history-modal').click({ timeout: 5000 });
                    await page.waitForTimeout(500);
                    await page.getByRole('button', { name: 'Alert' }).click({ timeout: 10000 });
                    await page.waitForTimeout(1000);
                    
                    // If flag is applicant-scoped, click Applicant tab after modal refresh
                    // Modal resets to System tab by default, so we need to switch to Applicant tab
                    if (applicantScope) {
                        const applicantTab = page.getByRole('button', { name: 'Applicant' });
                        const isApplicantTabVisible = await applicantTab.isVisible({ timeout: 2000 }).catch(() => false);
                        if (isApplicantTabVisible) {
                            const isActive = await applicantTab.evaluate(el => 
                                el.classList.contains('bg-primary-400') || el.classList.contains('font-semibold')
                            ).catch(() => false);
                            if (!isActive) {
                                await applicantTab.click({ timeout: 5000 });
                                await page.waitForTimeout(500); // Wait for flags to load after tab switch
                            }
                        }
                    }
                } catch (e) {
                    console.log(`⚠️ Could not refresh modal: ${e.message}`);
                }
            }
        }
    }

    // Condition not met after polling
    const defaultErrorMsg = `Flag "${flagTestId}" did not ${existVerb} after ${maxPollTime}ms`;
    const finalErrorMsg = errorMessage || defaultErrorMsg;
    
    console.log(`❌ ${finalErrorMsg}`);
    
    if (throwOnFail) {
        throw new Error(finalErrorMsg);
    }
    
    return false;
};

/**
 * Poll for approval status (API check)
 * 
 * @param {Page} page - Playwright page object
 * @param {string} sessionId - Session ID to check
 * @param {string} authToken - Bearer token for API authentication
 * @param {Object} options - Polling configuration
 * @param {string} options.expectedStatus - Expected status (e.g., 'APPROVED', 'REJECTED')
 * @param {string} options.apiUrl - Base API URL
 * @param {number} [options.maxPollTime=30000] - Max polling time in ms (default: 30s)
 * @param {number} [options.pollInterval=2000] - Interval between polls in ms (default: 2s)
 * @param {boolean} [options.throwOnFail=true] - Whether to throw error if status not met
 * @returns {Promise<Object>} - { success: boolean, finalStatus: string }
 * 
 * @example
 * const result = await pollForApprovalStatus(page, sessionId, authToken, {
 *     expectedStatus: 'APPROVED',
 *     apiUrl: app.urls.api,
 *     maxPollTime: 60000
 * });
 */
const pollForApprovalStatus = async (page, sessionId, authToken, options) => {
    const {
        expectedStatus,
        apiUrl,
        maxPollTime = 30000,
        pollInterval = 2000,
        throwOnFail = true
    } = options;

    const maxPolls = Math.ceil(maxPollTime / pollInterval);
    let finalStatus = 'UNKNOWN';
    
    console.log(`🔍 Polling for approval_status = ${expectedStatus} (max ${maxPollTime}ms, ${maxPolls} polls)...`);

    for (let i = 0; i < maxPolls; i++) {
        const response = await page.request.get(`${apiUrl}/sessions/${sessionId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        const sessionData = await response.json();
        finalStatus = sessionData.data.approval_status;
        
        console.log(`📊 API Status (poll ${i + 1}/${maxPolls}): ${finalStatus}`);

        if (finalStatus === expectedStatus) {
            console.log(`✅ Status = ${expectedStatus} achieved`);
            return { success: true, finalStatus };
        }

        if (i < maxPolls - 1) {
            console.log(`⏳ Status not ${expectedStatus} yet, waiting...`);
            await page.waitForTimeout(pollInterval);
        }
    }

    // Status not achieved
    const errorMsg = `Expected status ${expectedStatus}, got ${finalStatus} after ${maxPollTime}ms`;
    console.log(`❌ ${errorMsg}`);
    
    if (throwOnFail) {
        throw new Error(errorMsg);
    }
    
    return { success: false, finalStatus };
};

/**
 * Poll for UI text to appear in an element
 * 
 * @param {Page} page - Playwright page object
 * @param {Object} options - Polling configuration
 * @param {string} options.testId - Element test-id to check
 * @param {string} options.expectedText - Text expected to appear
 * @param {number} [options.maxPolls=15] - Max number of polls (default: 15)
 * @param {number} [options.pollInterval=2000] - Interval between polls in ms (default: 2s)
 * @param {boolean} [options.reloadPage=false] - Whether to reload page between polls
 * @param {boolean} [options.throwOnFail=true] - Whether to throw error if text not found
 * @returns {Promise<boolean>} - True if text found, false otherwise
 * 
 * @example
 * await pollForUIText(page, {
 *     testId: 'household-status-alert',
 *     expectedText: 'Meets Criteria',
 *     reloadPage: true
 * });
 */
const pollForUIText = async (page, options) => {
    const {
        testId,
        expectedText,
        maxPolls = 15,
        pollInterval = 2000,
        reloadPage = false,
        throwOnFail = true
    } = options;

    console.log(`🔍 Polling for UI text "${expectedText}" in [data-testid="${testId}"] (max ${maxPolls} polls)...`);

    // For household-status-alert, we need to click Alert button first to open the modal
    // The household-status-alert is only visible inside the Alert/View Details modal
    if (testId === 'household-status-alert') {
        try {
            // Check if Alert button is visible and click it to open the modal
            const alertBtn = page.getByRole('button', { name: 'Alert' });
            const isAlertBtnVisible = await alertBtn.isVisible({ timeout: 2000 }).catch(() => false);
            
            if (isAlertBtnVisible) {
                console.log('🔔 Clicking Alert button to open modal with household-status-alert...');
                await alertBtn.click();
                await page.waitForTimeout(1000); // Wait for modal to open
            }
        } catch (e) {
            console.log('⚠️ Alert button not found or already clicked, continuing...');
        }
    }

    for (let i = 0; i < maxPolls; i++) {
        try {
            const element = page.getByTestId(testId);
            await element.waitFor({ state: 'visible', timeout: pollInterval });
            
            const text = await element.innerText();
            console.log(`📊 UI text (poll ${i + 1}/${maxPolls}): ${text}`);
            
            if (text.includes(expectedText)) {
                console.log(`✅ UI text "${expectedText}" found`);
                return true;
            }
        } catch (e) {
            console.log(`⏳ UI text not found, retrying... (poll ${i + 1}/${maxPolls})`);
        }

        if (i < maxPolls - 1) {
            if (reloadPage) {
                // Just reload and wait for load state - simpler and more reliable
                await page.reload({ waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(5000); // Wait for content to load
                
                // After reload, if checking household-status-alert, click Alert button again
                if (testId === 'household-status-alert') {
                    try {
                        const alertBtn = page.getByRole('button', { name: 'Alert' });
                        const isAlertBtnVisible = await alertBtn.isVisible({ timeout: 2000 }).catch(() => false);
                        if (isAlertBtnVisible) {
                            await alertBtn.click();
                            await page.waitForTimeout(1000);
                        }
                    } catch (e) {
                        // Ignore if button not found
                    }
                }
            } else {
                await page.waitForTimeout(pollInterval);
            }
        }
    }

    // Text not found
    const errorMsg = `UI text "${expectedText}" not found in [data-testid="${testId}"] after ${maxPolls} polls`;
    console.log(`❌ ${errorMsg}`);
    
    if (throwOnFail) {
        throw new Error(errorMsg);
    }
    
    return false;
};

/**
 * Generic polling function for custom conditions
 * 
 * @param {Function} conditionFn - Async function that returns true when condition is met
 * @param {Object} options - Polling configuration
 * @param {number} [options.maxPollTime=30000] - Max polling time in ms (default: 30s)
 * @param {number} [options.pollInterval=2000] - Interval between polls in ms (default: 2s)
 * @param {string} [options.description='condition'] - Description for logging
 * @param {boolean} [options.throwOnFail=true] - Whether to throw error if condition not met
 * @returns {Promise<boolean>} - True if condition met, false otherwise
 * 
 * @example
 * await pollUntil(async () => {
 *     const count = await page.locator('.item').count();
 *     return count > 5;
 * }, {
 *     maxPollTime: 10000,
 *     description: 'waiting for more than 5 items'
 * });
 */
const pollUntil = async (conditionFn, options = {}) => {
    const {
        maxPollTime = 30000,
        pollInterval = 2000,
        description = 'condition',
        throwOnFail = true
    } = options;

    const maxPolls = Math.ceil(maxPollTime / pollInterval);
    console.log(`🔍 Polling for ${description} (max ${maxPollTime}ms, ${maxPolls} polls)...`);

    for (let i = 0; i < maxPolls; i++) {
        const result = await conditionFn();
        
        if (result) {
            console.log(`✅ ${description} met (poll ${i + 1}/${maxPolls})`);
            return true;
        }

        if (i < maxPolls - 1) {
            console.log(`⏳ ${description} not met, waiting... (poll ${i + 1}/${maxPolls})`);
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
    }

    // Condition not met
    const errorMsg = `${description} not met after ${maxPollTime}ms`;
    console.log(`❌ ${errorMsg}`);
    
    if (throwOnFail) {
        throw new Error(errorMsg);
    }
    
    return false;
};

/**
 * Poll for verification status completion via API
 * 
 * @param {BrowserContext} context - Playwright browser context (for API requests)
 * @param {string} verificationId - Verification ID to poll
 * @param {string} endpoint - API endpoint (e.g., 'employment-verifications', 'identity-verifications')
 * @param {Object} options - Polling configuration
 * @param {number} [options.maxAttempts=25] - Max polling attempts (default: 25)
 * @param {number} [options.pollInterval=4000] - Interval between polls in ms (default: 4s)
 * @param {string[]} [options.successStatuses=['COMPLETED']] - Statuses considered successful
 * @param {string[]} [options.failureStatuses=['FAILED', 'EXPIRED']] - Statuses considered terminal failures
 * @param {string} [options.apiBaseUrl] - API base URL (default: from app.urls.api)
 * @param {string} [options.authToken] - Optional Bearer token for authentication
 * @param {string} [options.stepId] - Optional step ID for filtering (more precise than ID filter)
 * @returns {Promise<Object>} - The completed verification object
 * @throws {Error} - If verification fails or times out
 * 
 * @example
 * // With authentication token:
 * const verification = await pollForVerificationStatus(context, verificationId, 'employment-verifications', {
 *     maxAttempts: 25,
 *     pollInterval: 4000,
 *     authToken: guestToken
 * });
 * 
 * @example
 * // With step ID for more precise filtering:
 * const verification = await pollForVerificationStatus(context, verificationId, 'employment-verifications', {
 *     stepId: stepId,
 *     authToken: guestToken
 * });
 */
const pollForVerificationStatus = async (context, verificationId, endpoint, options = {}) => {
    const {
        maxAttempts = 25,
        pollInterval = 4000,
        successStatuses = ['COMPLETED'],
        failureStatuses = ['FAILED', 'EXPIRED'],
        apiBaseUrl,
        authToken,
        stepId
    } = options;

    // Import app config here to avoid circular dependencies
    const { app } = await import('../test_config');
    const baseUrl = apiBaseUrl || app.urls.api;

    console.log(`🔍 Polling for verification ${verificationId} on ${endpoint} (max ${maxAttempts} attempts, ${pollInterval}ms interval)...`);
    if (authToken) {
        console.log('   🔐 Using authentication token');
    } else {
        console.log('   ⚠️  No auth token provided - API may reject request');
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            // ✅ Use proper filter format matching API test framework pattern (session-flow.js:2324-2334)
            const filters = stepId 
                ? {
                    "$has": {
                        "step": {
                            "id": stepId
                        }
                    },
                    "status": {
                        "$neq": "EXPIRED"
                    }
                }
                : {
                    "id": verificationId
                };

            const apiUrl = `${baseUrl}/${endpoint}`;
            
            const requestOptions = {
                params: {
                    filters: JSON.stringify(filters)
                }
            };

            // Add authentication if provided
            if (authToken) {
                requestOptions.headers = {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                };
            }
            
            console.log(`   🔍 Attempt ${attempt}/${maxAttempts}: GET ${apiUrl} with filters:`, JSON.stringify(filters, null, 2));
            const response = await context.request.get(apiUrl, requestOptions);

            if (!response.ok()) {
                const responseText = await response.text();
                const isHtml = responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html');
                
                if (isHtml) {
                    console.log(`   ❌ Attempt ${attempt}/${maxAttempts}: API returned HTML instead of JSON - authentication required!`);
                    if (!authToken) {
                        throw new Error('Authentication required: API endpoint needs Bearer token. Pass authToken in options.');
                    }
                } else {
                    console.log(`   ⚠️ Attempt ${attempt}/${maxAttempts}: API returned status ${response.status()}: ${responseText.substring(0, 100)}`);
                }
            } else {
                const body = await response.json();
                
                // List endpoint returns { data: [...] } array format
                const verifications = body.data || [];
                console.log(`   📊 Attempt ${attempt}/${maxAttempts}: Found ${verifications.length} verification(s)`);
                
                // Find our specific verification by ID
                const verification = verifications.find(v => v.id === verificationId);

                if (verification) {
                    console.log(`   📊 Verification ${verificationId}: Status = ${verification.status}`);

                    // Check for success
                    if (successStatuses.includes(verification.status)) {
                        console.log(`✅ Verification ${verificationId} ${verification.status}`);
                        return verification;
                    }

                    // Check for terminal failure
                    if (failureStatuses.includes(verification.status)) {
                        const errorMsg = `Verification ${verification.status}: ${JSON.stringify(verification)}`;
                        console.log(`❌ ${errorMsg}`);
                        throw new Error(errorMsg);
                    }

                    // Still processing - continue polling
                    console.log(`   ⏳ Status is ${verification.status}, waiting for ${successStatuses.join(' or ')}...`);
                } else {
                    console.log(`   ⏳ Attempt ${attempt}/${maxAttempts}: Verification not found in list yet`);
                }
            }
        } catch (error) {
            // Re-throw terminal errors
            if (failureStatuses.some(status => error.message.includes(status))) {
                throw error;
            }
            // Log transient errors and continue
            console.log(`   ⚠️ Attempt ${attempt}/${maxAttempts}: Error checking status - ${error.message}`);
        }

        // Wait before next attempt (skip on last attempt)
        if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
    }

    // Timeout - verification did not complete
    const errorMsg = `❌ Verification ${verificationId} did not complete after ${maxAttempts} attempts (${(maxAttempts * pollInterval) / 1000} seconds)`;
    console.log(errorMsg);
    throw new Error(errorMsg);
};

export {
    pollForFlag,
    pollForApprovalStatus,
    pollForUIText,
    pollUntil,
    pollForVerificationStatus
};

