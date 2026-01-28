import { test, expect } from '@playwright/test';
import { admin, app } from './test_config';
import loginForm from './utils/login-form';
import { findAndInviteApplication } from './utils/applications-page';
import generateSessionForm from './utils/generate-session-form';
import { joinUrl } from './utils/helper';

/**
 * @API Documentation
 * @ticket QA-307 - UI Test - Terms & Conditions Modal Acceptance and Persistence (VC-1165)
 *
 * Comprehensive UI test for Terms & Conditions modal behavior:
 * - Modal appears on first access (new email/browser)
 * - Modal cannot be closed except by accepting terms (no close button, ESC disabled)
 * - Checkbox and Continue button state management
 * - Terms & Conditions and Privacy Policy links verification
 * - Acceptance flow and modal closure
 * - LocalStorage persistence verification
 * - Edge cases (different browser contexts, LocalStorage clearing)
 *
 * Key UI components:
 * - LegalModal.vue: Modal with no-close prop, shows when !isPreviouslyAccepted
 * - LegalCheckbox.vue: Checkbox with data-testid="user-terms", links to terms/privacy
 * - useLegalStore.js: LocalStorage persistence with key format [termsLink]-[privacyLink]-[sessionId]
 *
 * Note: No API endpoint exists (backend code commented out). Persistence is client-side only.
 */

const APPLICATION_NAME = 'AutoTest Suite - Full Test';
const TERMS_LINK = 'https://www.verifast.com/terms-conditions';
const PRIVACY_LINK = 'https://www.verifast.com/privacy-policy';

let createdSessionId = null;
let adminToken = null;
let sessionInviteLink = null;

test.describe('QA-307: Terms & Conditions Modal', () => {
    test('Terms & Conditions Modal Acceptance and Persistence', {
        tag: ['@core', '@regression', '@staging-ready'],
        timeout: 120_000
    }, async ({ page, browser, request }) => {
        // ============================================================
        // SETUP: Admin Login, Create Session, Get Invite Link
        // ============================================================
        console.log('🔐 SETUP: Logging in as admin...');
        adminToken = await loginForm.adminLoginAndNavigate(page, admin);
        expect(adminToken).toBeDefined();
        console.log('✅ Admin logged in');

        console.log('📋 SETUP: Navigating to Applications page...');
        await page.getByTestId('applications-menu').click();
        await page.waitForTimeout(500);
        await page.getByTestId('applications-submenu').click();
        await page.waitForTimeout(2000);
        console.log('✅ Applications page loaded');

        console.log(`🔍 SETUP: Finding and inviting application: ${APPLICATION_NAME}...`);
        await findAndInviteApplication(page, APPLICATION_NAME);
        
        // Verify the generate session modal appeared (confirms application was found and invite clicked)
        const sessionFormModal = page.locator('#generate-session-form');
        await expect(sessionFormModal).toBeVisible({ timeout: 10000 });
        console.log('✅ Application invite modal opened');

        const uniqueEmail = `terms-test-${Date.now()}@verifast.com`;
        const userData = {
            first_name: 'Terms',
            last_name: 'Test',
            email: uniqueEmail
        };

        console.log(`📝 SETUP: Generating session with email: ${uniqueEmail}...`);
        const { sessionId, link } = await generateSessionForm.generateSessionAndExtractLink(page, userData);
        createdSessionId = sessionId;
        sessionInviteLink = link;
        console.log(`✅ Session created: ${sessionId}`);
        console.log(`🔗 Invite link: ${link}`);

        // ============================================================
        // STEP 1: Verify Modal Appears on First Access
        // ============================================================
        console.log('\n📋 STEP 1: Verifying modal appears on first access...');
        
        // Create new browser context for clean LocalStorage
        const firstContext = await browser.newContext();
        const firstPage = await firstContext.newPage();
        
        const linkUrl = new URL(sessionInviteLink);
        await firstPage.goto(joinUrl(app.urls.app, `${linkUrl.pathname}${linkUrl.search}`));
        await firstPage.waitForLoadState('domcontentloaded');
        await firstPage.waitForTimeout(2000); // Wait for page to fully load
        
        console.log('🔍 Checking for Terms & Conditions modal...');
        const termsCheckbox = firstPage.getByTestId('user-terms');
        
        // Poll for modal to appear (max 10 seconds)
        let modalFound = false;
        const maxAttempts = 20;
        const pollInterval = 500;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const isVisible = await termsCheckbox.isVisible({ timeout: 1000 });
                if (isVisible) {
                    modalFound = true;
                    console.log(`✅ Terms & Conditions modal found (after ${attempt + 1} attempts)`);
                    break;
                }
            } catch (error) {
                // Continue polling
            }
            
            if (attempt < maxAttempts - 1) {
                await firstPage.waitForTimeout(pollInterval);
            }
        }
        
        expect(modalFound).toBe(true);
        console.log('✅ Modal is visible');

        // Verify modal cannot be closed (no close button)
        console.log('🔍 Verifying modal has no close button...');
        const closeButton = firstPage.locator('[data-testid*="cancel"], [data-testid*="close"]');
        const closeButtonCount = await closeButton.count();
        expect(closeButtonCount).toBe(0);
        console.log('✅ No close button found');

        // Verify ESC key does not close modal
        // Note: VfModal's closeModal only checks preserveOpen, not noClose
        // If ESC closes the modal, this indicates a potential bug
        console.log('🔍 Verifying ESC key does not close modal...');
        await firstPage.keyboard.press('Escape');
        await firstPage.waitForTimeout(500);
        const stillVisible = await termsCheckbox.isVisible({ timeout: 2000 }).catch(() => false);
        expect(stillVisible).toBe(true);
        console.log('✅ Modal remains visible after ESC key (as expected)');

        // Verify checkbox is present and unchecked
        console.log('🔍 Verifying checkbox state...');
        await expect(termsCheckbox).toBeVisible();
        const isCheckedInitially = await termsCheckbox.isChecked();
        expect(isCheckedInitially).toBe(false);
        console.log('✅ Checkbox is unchecked by default');

        // Verify Continue button exists and is disabled
        console.log('🔍 Verifying Continue button state...');
        const continueButton = firstPage.getByRole('button', { name: 'Continue to Verifast' });
        await expect(continueButton).toBeVisible();
        const isButtonEnabledInitially = await continueButton.isEnabled();
        expect(isButtonEnabledInitially).toBe(false);
        console.log('✅ Continue button is disabled when checkbox is unchecked');

        // ============================================================
        // STEP 2: Verify Checkbox and Continue Button States
        // ============================================================
        console.log('\n📋 STEP 2: Verifying checkbox and button state management...');

        // Check checkbox
        console.log('📝 Checking the checkbox...');
        await termsCheckbox.click();
        await firstPage.waitForTimeout(500);
        
        const isCheckedAfterClick = await termsCheckbox.isChecked();
        expect(isCheckedAfterClick).toBe(true);
        console.log('✅ Checkbox is checked');

        // Verify Continue button becomes enabled
        const isButtonEnabledAfterCheck = await continueButton.isEnabled();
        expect(isButtonEnabledAfterCheck).toBe(true);
        console.log('✅ Continue button is enabled when checkbox is checked');

        // Uncheck checkbox
        console.log('📝 Unchecking the checkbox...');
        await termsCheckbox.click();
        await firstPage.waitForTimeout(500);
        
        const isCheckedAfterUncheck = await termsCheckbox.isChecked();
        expect(isCheckedAfterUncheck).toBe(false);
        console.log('✅ Checkbox is unchecked');

        // Verify Continue button becomes disabled again
        const isButtonEnabledAfterUncheck = await continueButton.isEnabled();
        expect(isButtonEnabledAfterUncheck).toBe(false);
        console.log('✅ Continue button is disabled again when checkbox is unchecked');

        // Check checkbox again for next step
        await termsCheckbox.click();
        await firstPage.waitForTimeout(500);

        // ============================================================
        // STEP 3: Verify Terms & Conditions and Privacy Policy Links
        // ============================================================
        console.log('\n📋 STEP 3: Verifying Terms & Conditions and Privacy Policy links...');

        // Find Terms & Conditions link
        const termsLink = firstPage.locator('a[href*="terms-conditions"]');
        await expect(termsLink).toBeVisible();
        const termsHref = await termsLink.getAttribute('href');
        expect(termsHref).toBe(TERMS_LINK);
        console.log(`✅ Terms & Conditions link found with correct href: ${termsHref}`);

        const termsTarget = await termsLink.getAttribute('target');
        expect(termsTarget).toBe('_blank');
        console.log('✅ Terms & Conditions link opens in new tab');

        const termsRel = await termsLink.getAttribute('rel');
        expect(termsRel).toContain('noopener');
        expect(termsRel).toContain('noreferrer');
        console.log('✅ Terms & Conditions link has correct rel attributes');

        // Find Privacy Policy link
        const privacyLink = firstPage.locator('a[href*="privacy-policy"]');
        await expect(privacyLink).toBeVisible();
        const privacyHref = await privacyLink.getAttribute('href');
        expect(privacyHref).toBe(PRIVACY_LINK);
        console.log(`✅ Privacy Policy link found with correct href: ${privacyHref}`);

        const privacyTarget = await privacyLink.getAttribute('target');
        expect(privacyTarget).toBe('_blank');
        console.log('✅ Privacy Policy link opens in new tab');

        const privacyRel = await privacyLink.getAttribute('rel');
        expect(privacyRel).toContain('noopener');
        expect(privacyRel).toContain('noreferrer');
        console.log('✅ Privacy Policy link has correct rel attributes');

        // ============================================================
        // STEP 4: Verify Acceptance Flow
        // ============================================================
        console.log('\n📋 STEP 4: Verifying acceptance flow...');

        // Ensure checkbox is checked
        const isCheckedBeforeContinue = await termsCheckbox.isChecked();
        if (!isCheckedBeforeContinue) {
            await termsCheckbox.click();
            await firstPage.waitForTimeout(500);
        }

        // Click Continue button
        console.log('🚀 Clicking Continue button...');
        await continueButton.click();
        console.log('✅ Continue button clicked');

        // Wait for modal to disappear
        console.log('⏳ Waiting for modal to close...');
        await termsCheckbox.waitFor({ state: 'hidden', timeout: 10000 });
        console.log('✅ Modal closed');

        // Verify modal is no longer visible
        const modalStillVisible = await termsCheckbox.isVisible({ timeout: 2000 }).catch(() => false);
        expect(modalStillVisible).toBe(false);
        console.log('✅ Modal is no longer visible');

        // Verify page has proceeded (wait for next step to appear)
        await firstPage.waitForLoadState('domcontentloaded');
        await firstPage.waitForTimeout(2000);
        console.log('✅ Page has proceeded to next step');

        // ============================================================
        // STEP 5: Verify Persistence (LocalStorage Verification)
        // ============================================================
        console.log('\n📋 STEP 5: Verifying LocalStorage persistence...');

        // Extract session UUID from the invite link URL
        // The URL format is: /sessions/{uuid}?token=...
        // The LocalStorage key uses route.params.session (the UUID), not the session ID
        // Reuse linkUrl that was already created in Step 1
        const sessionUuid = linkUrl.pathname.split('/sessions/')[1]?.split('?')[0];
        console.log(`🔍 Session UUID from URL: ${sessionUuid}`);

        // Verify LocalStorage was set BEFORE closing the context
        // The key format is: [termsLink]-[privacyLink]-[sessionUuid]
        const localStorageData = await firstPage.evaluate((sessionUuid) => {
            const keys = Object.keys(localStorage);
            console.log('🔍 All LocalStorage keys:', keys);
            
            // Find key that contains terms-conditions, privacy-policy, and sessionUuid
            const matchingKey = keys.find(key => 
                key.includes('terms-conditions') && 
                key.includes('privacy-policy') &&
                key.includes(sessionUuid)
            );
            
            if (matchingKey) {
                return {
                    key: matchingKey,
                    value: localStorage.getItem(matchingKey)
                };
            }
            
            // If not found with sessionUuid, try to find any key with terms-conditions and privacy-policy
            const fallbackKey = keys.find(key => 
                key.includes('terms-conditions') && 
                key.includes('privacy-policy')
            );
            
            if (fallbackKey) {
                return {
                    key: fallbackKey,
                    value: localStorage.getItem(fallbackKey),
                    note: 'Found key without sessionUuid match'
                };
            }
            
            return null;
        }, sessionUuid);
        
        expect(localStorageData).not.toBeNull();
        expect(localStorageData.value).toBe('true');
        console.log(`✅ LocalStorage key found: ${localStorageData.key}`);
        console.log(`✅ LocalStorage value: ${localStorageData.value}`);
        if (localStorageData.note) {
            console.log(`ℹ️  ${localStorageData.note}`);
        }
        
        // ============================================================
        // STEP 5B: Verify Persistence in Same Browser Context
        // ============================================================
        console.log('\n📋 STEP 5B: Verifying modal does NOT reappear after reload...');
        
        // Verify LocalStorage has the acceptance before reload
        const localStorageBeforeReload = await firstPage.evaluate(() => {
            const keys = Object.keys(localStorage);
            const matchingKey = keys.find(key => 
                key.includes('terms-conditions') && 
                key.includes('privacy-policy')
            );
            return matchingKey ? localStorage.getItem(matchingKey) : null;
        });
        console.log(`🔍 LocalStorage value before reload: ${localStorageBeforeReload}`);
        expect(localStorageBeforeReload).toBe('true');
        
        // Reload the page - modal should NOT appear because LocalStorage has acceptance
        // Use reload() since token is in URL, so it will be preserved
        console.log('🔄 Reloading page...');
        await firstPage.reload();
        await firstPage.waitForLoadState('domcontentloaded');
        await firstPage.waitForTimeout(5000);
        
        // Verify LocalStorage still has the acceptance after reload
        const localStorageAfterReload = await firstPage.evaluate(() => {
            const keys = Object.keys(localStorage);
            const matchingKey = keys.find(key => 
                key.includes('terms-conditions') && 
                key.includes('privacy-policy')
            );
            return matchingKey ? localStorage.getItem(matchingKey) : null;
        });
        console.log(`🔍 LocalStorage value after reload: ${localStorageAfterReload}`);
        expect(localStorageAfterReload).toBe('true');
        
        // Verify modal does NOT appear (this will fail if bug exists)
        console.log('🔍 Checking if modal appears (should NOT appear)...');
        const termsCheckboxAfterReload = firstPage.getByTestId('user-terms');
        
        // Poll to verify modal does NOT appear (wait up to 10 seconds)
        let modalAppeared = false;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const isVisible = await termsCheckboxAfterReload.isVisible({ timeout: 1000 });
                if (isVisible) {
                    modalAppeared = true;
                    console.log(`⚠️ BUG DETECTED: Modal appeared after reload (after ${attempt + 1} attempts)`);
                    console.log(`⚠️ LocalStorage has acceptance (${localStorageAfterReload}), but modal still appears`);
                    break;
                }
            } catch (error) {
                // Element not visible - this is expected
            }
            
            if (attempt < maxAttempts - 1) {
                await firstPage.waitForTimeout(pollInterval);
            }
        }
        
        // This assertion will fail if the bug exists (modal appears when it shouldn't)
        expect(modalAppeared).toBe(false);
        console.log('✅ Modal does NOT appear after reload (persistence working correctly)');
        
        // Close first context AFTER verifying persistence
        await firstContext.close();
        
        // Note: Testing "same browser" persistence is difficult with Playwright
        // because each browser.newContext() has isolated LocalStorage.
        // The persistence is verified by:
        // 1. LocalStorage key/value is set correctly (verified above)
        // 2. Modal appears in new browser context (verified in Step 6)
        // 3. Modal appears after LocalStorage clear (verified in Step 6)

        // ============================================================
        // STEP 6: Verify Edge Cases (Different Browser Context)
        // ============================================================
        console.log('\n📋 STEP 6: Verifying edge cases (different browser context = isolated LocalStorage)...');

        // Create completely new browser context (simulates different browser/incognito)
        const newBrowserContext = await browser.newContext();
        const newBrowserPage = await newBrowserContext.newPage();
        
        // Navigate to the same invite link
        await newBrowserPage.goto(joinUrl(app.urls.app, `${linkUrl.pathname}${linkUrl.search}`));
        await newBrowserPage.waitForLoadState('domcontentloaded');
        await newBrowserPage.waitForTimeout(3000);
        
        // Modal SHOULD appear because LocalStorage is isolated
        console.log('🔍 Checking if modal appears in new browser context (should appear)...');
        const termsCheckboxNewBrowser = newBrowserPage.getByTestId('user-terms');
        
        let modalFoundInNewBrowser = false;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const isVisible = await termsCheckboxNewBrowser.isVisible({ timeout: 1000 });
                if (isVisible) {
                    modalFoundInNewBrowser = true;
                    console.log(`✅ Modal found in new browser context (after ${attempt + 1} attempts)`);
                    break;
                }
            } catch (error) {
                // Continue polling
            }
            
            if (attempt < maxAttempts - 1) {
                await newBrowserPage.waitForTimeout(pollInterval);
            }
        }
        
        expect(modalFoundInNewBrowser).toBe(true);
        console.log('✅ Modal appears in new browser context (isolated LocalStorage)');

        // Test LocalStorage clearing
        console.log('🧹 Testing LocalStorage clearing...');
        await newBrowserPage.evaluate(() => {
            localStorage.clear();
        });
        await newBrowserPage.waitForTimeout(500);
        
        // Navigate to the invite link WITH token (hosted login requires token in URL)
        // Do NOT use reload() as it may lose the token - navigate with full URL instead
        console.log('🔗 Navigating to invite link with token after LocalStorage clear...');
        await newBrowserPage.goto(joinUrl(app.urls.app, `${linkUrl.pathname}${linkUrl.search}`));
        await newBrowserPage.waitForLoadState('domcontentloaded');
        await newBrowserPage.waitForTimeout(3000);
        
        // Modal should appear again after clearing LocalStorage
        const termsCheckboxAfterClear = newBrowserPage.getByTestId('user-terms');
        let modalFoundAfterClear = false;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const isVisible = await termsCheckboxAfterClear.isVisible({ timeout: 1000 });
                if (isVisible) {
                    modalFoundAfterClear = true;
                    console.log(`✅ Modal found after LocalStorage clear (after ${attempt + 1} attempts)`);
                    break;
                }
            } catch (error) {
                // Continue polling
            }
            
            if (attempt < maxAttempts - 1) {
                await newBrowserPage.waitForTimeout(pollInterval);
            }
        }
        
        expect(modalFoundAfterClear).toBe(true);
        console.log('✅ Modal appears after LocalStorage is cleared');

        await newBrowserContext.close();

        console.log('\n✅ All test steps completed successfully!');
    });

    // ============================================================
    // CLEANUP
    // ============================================================
    test.afterAll(async ({ request }) => {
        if (createdSessionId && adminToken) {
            try {
                console.log(`🧹 CLEANUP: Deleting session ${createdSessionId}...`);
                await request.delete(
                    `${app.urls.api}/sessions/${createdSessionId}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${adminToken}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                console.log(`✅ Cleaned up session: ${createdSessionId}`);
            } catch (error) {
                console.warn(`⚠️ Cleanup failed for session ${createdSessionId}:`, error.message);
            }
        }
    });
});

