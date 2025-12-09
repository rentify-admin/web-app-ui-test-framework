/**
 * Robust Flag Resolver Utility
 * 
 * This utility provides comprehensive flag resolution that:
 * 1. Continuously polls for flags requiring review
 * 2. Marks all flags as non-issue
 * 3. Waits for backend processing
 * 4. Checks if approve button is clickable
 * 5. Falls back and retries until approve button is enabled
 * 
 * @module robust-flag-resolver
 */

import { app } from '~/tests/test_config';

/**
 * Robustly resolves all flags until approve button is clickable
 * 
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} sessionId - Session ID for API calls
 * @param {Object} options - Configuration options
 * @param {number} options.maxFlagResolutionCycles - Maximum flag resolution cycles (default: 10)
 * @param {number} options.maxFlagsPerCycle - Maximum flags to resolve per cycle (default: 20)
 * @param {number} options.flagResolutionTimeout - Timeout for flag resolution API calls (default: 10000)
 * @param {number} options.backendProcessingWait - Wait time for backend processing between cycles (default: 3000)
 * @param {number} options.maxApproveButtonPollAttempts - Maximum attempts to poll approve button (default: 30)
 * @param {number} options.approveButtonPollInterval - Interval between approve button polls in ms (default: 2000)
 * @returns {Promise<void>}
 */
export async function resolveAllFlagsUntilApproveClickable(
    page,
    sessionId,
    options = {}
) {
    const {
        maxFlagResolutionCycles = 10,
        maxFlagsPerCycle = 20,
        flagResolutionTimeout = 10000,
        backendProcessingWait = 3000,
        maxApproveButtonPollAttempts = 30,
        approveButtonPollInterval = 2000
    } = options;

    console.log('🏴 Starting robust flag resolution...');
    console.log(`   Configuration: maxCycles=${maxFlagResolutionCycles}, maxFlagsPerCycle=${maxFlagsPerCycle}`);

    let cycle = 0;
    let totalFlagsResolved = 0;

    // Main flag resolution loop
    while (cycle < maxFlagResolutionCycles) {
        cycle++;
        console.log(`\n🔄 Flag Resolution Cycle ${cycle}/${maxFlagResolutionCycles}`);

        // Step 0: Reload page to get fresh flag data
        console.log('   🔄 Step 0: Reloading page to refresh flag data...');
        await page.reload();
        await page.waitForTimeout(2000); // Wait for page to fully load
        
        // Wait for household status alert to be visible (indicates page loaded)
        try {
            await page.getByTestId('household-status-alert').waitFor({ state: 'visible', timeout: 10000 });
            console.log('   ✅ Page reloaded and household visible');
        } catch (error) {
            console.warn('   ⚠️ Household status alert not visible after reload, continuing anyway...');
        }

        // Step 1: Open View Details modal to see flags
        console.log('   📋 Step 1: Opening View Details modal...');
        try {
            // Check if modal is already open
            const modalOpen = await page.getByTestId('items-requiring-review-section').isVisible({ timeout: 1000 }).catch(() => false);
            
            if (!modalOpen) {
                // Close any existing modals first
                const closeBtn = page.getByTestId('close-event-history-modal');
                if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                    await closeBtn.click();
                    await page.waitForTimeout(500);
                }

                // Open View Details modal
                await page.getByTestId('view-details-btn').click();
                await page.waitForTimeout(2000); // Wait for modal to load
            }
        } catch (error) {
            console.warn(`   ⚠️ Could not open View Details modal: ${error.message}`);
            // Try to continue anyway
        }

        // Step 2: Get all flags requiring review (fresh query each cycle)
        console.log('   🔍 Step 2: Getting all flags requiring review...');
        const itemsRequiringReview = page.getByTestId('items-requiring-review-section');
        const hasFlagsSection = await itemsRequiringReview.count() > 0;

        if (!hasFlagsSection) {
            console.log('   ✅ No flags section found - checking approve button...');
            // Close modal if open
            const closeBtn = page.getByTestId('close-event-history-modal');
            if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                await closeBtn.click();
                await page.waitForTimeout(1000);
            }
            
            // Check if approve button is clickable
            const approveClickable = await checkApproveButtonClickable(page);
            if (approveClickable) {
                console.log(`\n✅ SUCCESS: Approve button is clickable after resolving ${totalFlagsResolved} flag(s) in ${cycle} cycle(s)`);
                return;
            }
            
            // If not clickable but no flags, wait a bit and try again
            console.log('   ⏳ No flags but approve button not ready - waiting for backend processing...');
            await page.waitForTimeout(backendProcessingWait);
            continue;
        }

        // Step 3: Get all flag items (refresh on each cycle)
        const flagItems = await itemsRequiringReview.locator('li[id^="flag-"]').all();
        const flagCount = flagItems.length;

        if (flagCount === 0) {
            console.log('   ✅ No flags requiring review in this cycle');
            
            // Close modal
            const closeBtn = page.getByTestId('close-event-history-modal');
            if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                await closeBtn.click();
                await page.waitForTimeout(1000);
            }

            // Check approve button
            const approveClickable = await checkApproveButtonClickable(page);
            if (approveClickable) {
                console.log(`\n✅ SUCCESS: Approve button is clickable after resolving ${totalFlagsResolved} flag(s) in ${cycle} cycle(s)`);
                return;
            }

            // Wait for backend processing
            console.log('   ⏳ Waiting for backend to process flags...');
            await page.waitForTimeout(backendProcessingWait);
            continue;
        }

        console.log(`   📊 Found ${flagCount} flag(s) requiring review`);

        // Step 4: Resolve flags (limit per cycle to prevent infinite loops)
        const flagsToResolve = Math.min(flagCount, maxFlagsPerCycle);
        let flagsResolvedThisCycle = 0;

        for (let i = 0; i < flagsToResolve; i++) {
            try {
                // Refresh flag items list (flags disappear as we resolve them)
                const currentFlagItems = await itemsRequiringReview.locator('li[id^="flag-"]').all();
                
                if (currentFlagItems.length === 0) {
                    console.log(`   ✅ All flags resolved (resolved ${i} in this cycle)`);
                    break;
                }

                // Always process the FIRST flag (index 0) since list shrinks
                const flagItem = currentFlagItems[0];
                const flagId = await flagItem.getAttribute('id');
                flagsResolvedThisCycle++;
                totalFlagsResolved++;

                console.log(`   🏴 Resolving flag ${flagsResolvedThisCycle}/${flagsToResolve}: ${flagId} (${currentFlagItems.length} remaining)`);

                // Click "Mark as Non Issue" button
                const markAsNonIssueBtn = flagItem.getByTestId('mark_as_non_issue');
                await markAsNonIssueBtn.click();
                await page.waitForTimeout(500);

                // Click submit button and wait for API response
                const submitBtn = page.getByRole('button', { name: 'Mark as Non Issue' });

                try {
                    await Promise.all([
                        page.waitForResponse(
                            resp => {
                                const url = resp.url();
                                return url.includes('/sessions/') &&
                                       url.includes('/flags/') &&
                                       resp.request().method() === 'PATCH' &&
                                       resp.ok();
                            },
                            { timeout: flagResolutionTimeout }
                        ),
                        submitBtn.click()
                    ]);

                    console.log(`      ✅ Flag ${flagsResolvedThisCycle} marked as non-issue and saved to backend`);
                    await page.waitForTimeout(1000); // Brief pause between flags

                } catch (error) {
                    console.warn(`      ⚠️ Flag ${flagsResolvedThisCycle} resolution timeout or error: ${error.message}`);
                    // Try to continue with next flag
                }

            } catch (error) {
                console.warn(`   ⚠️ Error resolving flag ${i + 1}: ${error.message}`);
                // Continue with next flag
            }
        }

        console.log(`   ✅ Resolved ${flagsResolvedThisCycle} flag(s) in this cycle (${totalFlagsResolved} total)`);

        // Step 5: Wait for backend processing
        console.log('   ⏳ Waiting for backend to process flag resolutions...');
        await page.waitForTimeout(backendProcessingWait);

        // Step 6: Poll backend API to verify flags are processed
        console.log('   🔍 Polling backend API for flag processing status...');
        const backendFlagsProcessed = await pollBackendFlagsProcessed(page, sessionId, 5, 2000);
        
        if (backendFlagsProcessed) {
            console.log('   ✅ Backend confirms all flags processed');
        } else {
            console.log('   ⚠️ Backend flag processing not complete, continuing anyway...');
        }

        // Step 7: Close modal, reload page, and check approve button
        console.log('   🔍 Step 7: Closing modal and reloading page...');
        const closeBtn = page.getByTestId('close-event-history-modal');
        if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await closeBtn.click();
            await page.waitForTimeout(1000);
        }

        // Reload page before checking approve button to ensure fresh state
        console.log('   🔄 Reloading page to refresh state before approve button check...');
        await page.reload();
        await page.waitForTimeout(2000);
        
        // Wait for household status alert to be visible
        try {
            await page.getByTestId('household-status-alert').waitFor({ state: 'visible', timeout: 10000 });
            console.log('   ✅ Page reloaded and household visible');
        } catch (error) {
            console.warn('   ⚠️ Household status alert not visible after reload, continuing anyway...');
        }

        // Check if approve button is now clickable
        const approveClickable = await checkApproveButtonClickable(page);
        
        if (approveClickable) {
            console.log(`\n✅ SUCCESS: Approve button is clickable after resolving ${totalFlagsResolved} flag(s) in ${cycle} cycle(s)`);
            return;
        }

        console.log(`   ⏳ Approve button not yet clickable - will retry with reload in next cycle (cycle ${cycle}/${maxFlagResolutionCycles})`);
    }

    // Final check after all cycles
    console.log(`\n🔄 Completed ${maxFlagResolutionCycles} flag resolution cycles (resolved ${totalFlagsResolved} total flags)`);
    console.log('   🔍 Performing final approve button check...');

    const finalApproveClickable = await checkApproveButtonClickable(page, maxApproveButtonPollAttempts, approveButtonPollInterval);

    if (!finalApproveClickable) {
        throw new Error(
            `❌ Approve button is still not clickable after ${maxFlagResolutionCycles} flag resolution cycles ` +
            `and ${maxApproveButtonPollAttempts} approve button poll attempts. ` +
            `Resolved ${totalFlagsResolved} flag(s) total. ` +
            `This may indicate remaining flags that cannot be resolved or session is not in approvable state.`
        );
    }

    console.log(`\n✅ SUCCESS: Approve button is finally clickable after resolving ${totalFlagsResolved} flag(s)`);
}

/**
 * Checks if approve button is clickable (enabled)
 * 
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {number} maxAttempts - Maximum polling attempts (default: 5)
 * @param {number} pollInterval - Polling interval in ms (default: 2000)
 * @returns {Promise<boolean>} True if approve button is clickable
 */
async function checkApproveButtonClickable(page, maxAttempts = 5, pollInterval = 2000) {
    const approveBtn = page.getByTestId('approve-session-btn');

    // First, ensure button is visible
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        let isVisible = await approveBtn.isVisible({ timeout: 1000 }).catch(() => false);

        if (!isVisible) {
            // Try clicking session action button to reveal approve button
            const actionBtn = page.getByTestId('session-action-btn');
            if (await actionBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                await actionBtn.click();
                await page.waitForTimeout(1000);
                // Re-check visibility after clicking action button
                isVisible = await approveBtn.isVisible({ timeout: 1000 }).catch(() => false);
            }

            if (!isVisible && attempt < maxAttempts) {
                console.log(`      ⏳ Approve button not visible, attempt ${attempt}/${maxAttempts}...`);
                await page.waitForTimeout(pollInterval);
                continue;
            }
        }

        if (isVisible) {
            // Check if button is enabled (not disabled)
            const hasDisabledClass = await approveBtn.evaluate(el =>
                el.classList.contains('pointer-events-none')
            ).catch(() => true);

            if (!hasDisabledClass) {
                return true; // Button is clickable
            }

            if (attempt < maxAttempts) {
                console.log(`      ⏳ Approve button visible but disabled, attempt ${attempt}/${maxAttempts}...`);
                await page.waitForTimeout(pollInterval);
            }
        } else {
            // Button not visible even after trying action button
            if (attempt < maxAttempts) {
                await page.waitForTimeout(pollInterval);
            }
        }
    }

    return false; // Button is not clickable
}

/**
 * Polls backend API to check if flags are processed
 * 
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} sessionId - Session ID
 * @param {number} maxAttempts - Maximum polling attempts (default: 5)
 * @param {number} pollInterval - Polling interval in ms (default: 2000)
 * @returns {Promise<boolean>} True if all flags are processed
 */
async function pollBackendFlagsProcessed(page, sessionId, maxAttempts = 5, pollInterval = 2000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const flagsResponse = await page.request.get(`${app.urls.api}/sessions/${sessionId}/flags`, {
                params: {
                    filters: JSON.stringify({
                        session_flag: { flag: { scope: { $neq: 'APPLICANT' } } }
                    })
                }
            });

            if (flagsResponse.ok()) {
                const flagsData = await flagsResponse.json();
                const flagsInReview = flagsData.data.filter(f => f.in_review === true);

                if (flagsInReview.length === 0) {
                    return true; // All flags processed
                }

                if (attempt < maxAttempts) {
                    await page.waitForTimeout(pollInterval);
                }
            }
        } catch (error) {
            console.warn(`      ⚠️ Error polling backend flags: ${error.message}`);
            if (attempt < maxAttempts) {
                await page.waitForTimeout(pollInterval);
            }
        }
    }

    return false; // Could not confirm all flags processed
}

