import { expect } from '@playwright/test';
import loginForm from './login-form';
import { searchSessionWithText } from './report-page';

/**
 * Login helper function with locale set to English
 * @param {import('@playwright/test').Page} page
 * @param {Object} data - Login credentials
 */
const loginWith = async (page, data) => {

    // Step 1: Admin Login and Navigate
    await loginForm.fill(page, data);
    await loginForm.submitAndSetLocale(page);
    await expect(page).toHaveTitle(/Applicants/, { timeout: 10_000 });
    await expect(page.getByTestId('household-status-alert')).toBeVisible();
};

/**
 * Complete admin login and navigation to applications with locale set to English
 * @param {import('@playwright/test').Page} page
 * @param {Object} data - Login credentials
 */
const adminLoginAndNavigateToApplications = async (page, data) => {
    await page.goto('/');
    await loginWith(page, data);
    await page.getByTestId('applications-menu').click();
    await page.getByTestId('applications-submenu').click();
};

/**
 * Scroll down a locator element
 * @param {import('@playwright/test').Locator} locator
 */
const scrollDown = async locator => {
    await locator.evaluate(element => element.scrollTop = element.scrollHeight);
};

/**
 * Scroll to the required session card locator
 * @param {import('@playwright/test').Page} page
 * @param {String} selector
 * @returns {Promise<import('@playwright/test').Locator>}
 */
const findSessionLocator = async (page, selector) => {
    console.log(`🚀 Finding selector: ${selector}`);
    await page.locator('#container').first()
        .evaluate(element => element.scrollTop = 150);

    const targetElement = await page.locator(selector);
    let found = false;
    const maxScrolls = 10; // Set a limit to prevent infinite loops in case element is never found
    let scrollCount = 0;

    while (!found && maxScrolls > scrollCount) {
        if (await targetElement.isVisible()) {
            found = true;
            return targetElement;
        }
        await scrollDown(await page.getByTestId('side-panel'));
        scrollCount++;
        await page.waitForTimeout(2000);
    }
};

/**
 * Prepare a session for fresh selection by deselecting it first
 * 
 * SMART FIX: Ensures that clicking a session will trigger fresh API calls
 * by first clicking a different session to deselect the target, then searching
 * for and locating the target session (ready for click).
 * 
 * This solves the issue where a pre-loaded/cached session doesn't trigger
 * API calls when clicked again because the browser thinks data is already loaded.
 * 
 * Usage:
 * ```javascript
 * const { locator, searchResult } = await prepareSessionForFreshSelection(page, sessionId);
 * const [response1, response2] = await Promise.all([
 *     page.waitForResponse(...),
 *     page.waitForResponse(...),
 *     locator.click()
 * ]);
 * ```
 * 
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} targetSessionId - The session ID to prepare for selection
 * @returns {Promise<{locator: import('@playwright/test').Locator, searchResult: any}>}
 */
const prepareSessionForFreshSelection = async (page, targetSessionId) => {
    console.log(`🔍 Using pre-created session: ${targetSessionId}`);
    
    // STEP 1: Click a DIFFERENT session first to deselect ours
    console.log('🔄 Step 1: Clicking a different session to deselect ours...');
    const sidePanel = page.getByTestId('side-panel');
    const allSessionCards = sidePanel.locator('.application-card');
    const sessionCount = await allSessionCards.count();
    console.log(`   📊 Found ${sessionCount} sessions in list`);
    
    // Find and click a session that is NOT ours
    let differentSessionClicked = false;
    for (let i = 0; i < Math.min(sessionCount, 5); i++) { // Check first 5 sessions max
        const card = allSessionCards.nth(i);
        const sessionId = await card.getAttribute('data-session');
        
        if (sessionId && sessionId !== targetSessionId) {
            console.log(`   🖱️ Clicking different session: ${sessionId.substring(0, 25)}...`);
            await card.click();
            await page.waitForTimeout(4000); // Wait for page to load completely
            differentSessionClicked = true;
            console.log('   ✅ Different session opened - ours is now deselected');
            break;
        }
    }
    
    if (!differentSessionClicked) {
        console.log('   ⚠️ No other session found - proceeding anyway');
    }
    
    // STEP 2: Search for and locate OUR session (ready for fresh click)
    console.log('🔍 Step 2: Searching for our session...');
    const searchResult = await searchSessionWithText(page, targetSessionId);
    await page.waitForTimeout(1000);
    
    const sessionLocator = page.locator(`.application-card[data-session="${targetSessionId}"]`);
    await expect(sessionLocator).toBeVisible({ timeout: 10000 });
    console.log('✅ Our session card found in search results');
    
    return { locator: sessionLocator, searchResult };
};

export {
    loginWith,
    adminLoginAndNavigateToApplications,
    scrollDown,
    findSessionLocator,
    prepareSessionForFreshSelection
};
