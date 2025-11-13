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
            await page.waitForTimeout(pollInterval);

            // Optional: Refresh modal to get updated flags
            if (refreshModal) {
                try {
                    await page.getByTestId('close-event-history-modal').click({ timeout: 5000 });
                    await page.waitForTimeout(500);
                    await page.getByTestId('view-details-btn').click({ timeout: 10000 });
                    await page.waitForTimeout(1000);
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
                await page.waitForTimeout(2000); // Wait for content to load
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

export {
    pollForFlag,
    pollForApprovalStatus,
    pollForUIText,
    pollUntil
};

