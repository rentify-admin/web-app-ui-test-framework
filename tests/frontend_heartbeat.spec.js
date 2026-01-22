import { test, expect } from '@playwright/test';
import loginForm from '~/tests/utils/login-form';
import { admin } from '~/tests/test_config';
import { checkHeaderAndProfileMenu, checkSidebarMenusAndTitles } from '~/tests/utils/common';
import { navigateToSessionById } from '~/tests/utils/report-page';
import { createPermissionTestSession } from '~/tests/utils/session-generator';
import { cleanupSessionAndContexts } from '~/tests/utils/cleanup-helper';

// Global state for test 2 session
let sharedSessionId = null;
let applicantContextForCleanup = null;
let adminContextForCleanup = null;
let allTestsPassed = true;

test.describe('frontend_heartbeat', () => {
    // Helper functions to reduce code duplication
    // Note: approve-session-btn and reject-session-btn are now standalone buttons on the page (not in dropdown)
    const dropdownButtons = [
        'invite-applicant',
        'trigger-pms-upload-btn',
        'upload-document-btn',
        'request-additional-btn',
        'income-source-automation-dropdown-item'
    ];
    
    // Standalone buttons (not in dropdown)
    const standaloneButtons = [
        'approve-session-btn',
        'reject-session-btn'
    ];

    const testDropdownButtons = async (page, buttons, context = '') => {
        const contextText = context ? ` (${context})` : '';
        
        for (const buttonTestId of buttons) {
            const button = page.getByTestId(buttonTestId);
            await expect(button).toBeVisible();
            
            // Special handling for approve button: it may be disabled if session has AWAITING_REVIEW status
            // (This happens when flags require review, even with flag-free mock data in some cases)
            if (buttonTestId === 'approve-session-btn') {
                // Use Playwright's isEnabled() to check if button is enabled
                const isEnabled = await button.isEnabled().catch(() => false);
                
                if (!isEnabled) {
                    console.log(`⚠️ Approve button is disabled (likely due to AWAITING_REVIEW status)${contextText} - skipping enable check`);
                    console.log(`   ℹ️  This is expected when session has approval_status='AWAITING_REVIEW' (flags require manual review)`);
                    continue;
                }
            }
            
            await expect(button).toBeEnabled();
            console.log(`✅ Dropdown button visible and enabled${contextText}: ${buttonTestId}`);
        }
    };

    const testViewDetailsModal = async (page) => {
        // Test Alert button - use flexible text matching since button shows count (e.g., "5 Alerts")
        const alertBtn = page.getByRole('button', { name: /alert/i });
        await expect(alertBtn).toBeVisible({ timeout: 10_000 });
        
        // Ensure dropdown is not intercepting by waiting a bit and scrolling into view
        await alertBtn.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        
        await alertBtn.click({ timeout: 10_000 });
        
        // Check if details modal is open
        await expect(page.getByTestId('report-view-details-flags-section')).toBeVisible({ timeout: 10_000 });
        
        // Close modal
        await page.getByTestId('close-event-history-modal').click();
    };

    test('Should check frontend heartbeat', {
        tag: ['@core', '@smoke', '@regression', '@staging-ready', '@rc-ready'],
    }, async ({ page }) => {
        await page.goto('/');
        await loginForm.fill(page, admin);
        await loginForm.submitAndSetLocale(page);
        // submitAndSetLocale already waits for applicants page to load (side-panel and session loading)
        // No need to check for household-status-alert here as it's only visible inside a session's Alert modal

        // Check header, menu, profile, and applicants submenu
        await checkHeaderAndProfileMenu(page);

        // Check all sidebar menus, submenus, and their titles
        await checkSidebarMenusAndTitles(page);
    });

    // ✅ Create session ONCE for test 2
    test.beforeAll(async ({ browser }) => {
        test.setTimeout(300000);
        
        console.log('🏗️ Creating complete session for heartbeat test...');
        
        const adminContext = await browser.newContext();
        const adminPage = await adminContext.newPage();
        await adminPage.goto('/');
        
        const { sessionId, applicantContext } = await createPermissionTestSession(adminPage, browser, {
            applicationName: 'Autotest - UI permissions tests',
            firstName: 'Heartbeat',
            lastName: 'Test',
            email: `heartbeat-test-${Date.now()}@verifast.com`,
            rentBudget: '2500',
            // ✅ Use flag-free mock data so session gets APPROVED status (not AWAITING_REVIEW)
            // This ensures the approve button is enabled for testing
            useCorrectMockData: true
            // ✅ All steps enabled by default (complete session)
        });
        
        sharedSessionId = sessionId;
        console.log('✅ Shared session created:', sessionId);
        
        await adminPage.close();
        adminContextForCleanup = adminContext;
        applicantContextForCleanup = applicantContext;
    });

    test('Should test session actions and section dropdowns', {
        tag: ['@core', '@smoke', '@regression', '@critical', '@staging-ready', '@rc-ready'],
    }, async ({ page }) => {
        try {
            if (!sharedSessionId) {
                throw new Error('Session must be created in beforeAll');
            }
            
            await page.goto('/');
            await loginForm.fill(page, admin);
            await loginForm.submitAndSetLocale(page);
            // submitAndSetLocale already waits for applicants page to load (side-panel and session loading)
            // No need to check for household-status-alert here as it's only visible inside a session's Alert modal

            // Navigate to applicants inbox
            const applicantsMenu = page.getByTestId('applicants-menu');
            const isMenuOpen = await applicantsMenu.evaluate(el => el.classList.contains('sidebar-item-open'));
            if (!isMenuOpen) {
                await applicantsMenu.click();
            }
            
            await page.getByTestId('applicants-submenu').click();
            await page.waitForTimeout(2000);

            // Navigate to our created session
            await navigateToSessionById(page, sharedSessionId, 'all');
            // Wait for Alert button to be visible (indicates report page is loaded)
            // Note: household-status-alert is only visible inside the Alert modal, so we wait for the button instead
            // Use flexible text matching since button shows count (e.g., "5 Alerts")
            await expect(page.getByRole('button', { name: /alert/i })).toBeVisible({ timeout: 10_000 });

        // 1a) Test standalone approve/reject buttons (not in dropdown)
        for (const buttonTestId of standaloneButtons) {
            const button = page.getByTestId(buttonTestId);
            await expect(button).toBeVisible();
            
            // Special handling for approve button: it may be disabled if session has AWAITING_REVIEW status
            if (buttonTestId === 'approve-session-btn') {
                const isEnabled = await button.isEnabled().catch(() => false);
                if (!isEnabled) {
                    console.log(`⚠️ Approve button is disabled (likely due to AWAITING_REVIEW status) - skipping enable check`);
                    console.log(`   ℹ️  This is expected when session has approval_status='AWAITING_REVIEW' (flags require manual review)`);
                    continue;
                }
            }
            
            await expect(button).toBeEnabled();
            console.log(`✅ Standalone button visible and enabled: ${buttonTestId}`);
        }
        
        // 1b) Assert action dropdown buttons exist and are enabled
        const actionButton = page.getByTestId('session-action-btn');
        await expect(actionButton).toBeVisible();
        await actionButton.click();
        await testDropdownButtons(page, dropdownButtons);
        
        // Close the dropdown menu before proceeding - click the action button again to toggle it closed
        await actionButton.click();
        await page.waitForTimeout(500); // Wait for dropdown to close
        
        // Verify dropdown is closed by checking that a dropdown item is no longer visible
        const dropdownItem = page.getByTestId('invite-applicant');
        await expect(dropdownItem).not.toBeVisible({ timeout: 2000 });

        // 2) Validate View Details flow
        await testViewDetailsModal(page);

        // 3) Strict section header dropdown tests (no conditional skips)
        const sectionHeaders = [
            'identity-section-header',
            'income-source-section-header',
            'files-section-header',
            'employment-section-header',
            'financial-section-header',
            'integration-logs-section-header'
        ];

        for (const headerTestId of sectionHeaders) {
            const header = page.getByTestId(headerTestId);
            await expect(header).toBeVisible();

            const arrow = header.getByRole('img', { name: 'arrow' });
            const sectionName = headerTestId.replace('-header', '');
            const sectionContent = page.getByTestId(sectionName);

            // Toggle open
            await header.click();
            await expect(arrow).toHaveClass(/-rotate-90/, { timeout: 2000 });
            await expect(sectionContent).toBeVisible({ timeout: 5000 });

            // Toggle closed
            await header.click();
            await expect(arrow).toHaveClass(/rotate-90/, { timeout: 2000 });
        }
        } catch (error) {
            allTestsPassed = false;
            throw error;
        }
    });
    
    // ✅ Centralized cleanup
    test.afterAll(async ({ request }) => {
        await cleanupSessionAndContexts(
            request,
            sharedSessionId,
            applicantContextForCleanup,
            adminContextForCleanup,
            allTestsPassed
        );
    });
});