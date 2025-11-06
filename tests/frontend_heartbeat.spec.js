import { test, expect } from '@playwright/test';
import loginForm from '~/tests/utils/login-form';
import { admin } from '~/tests/test_config';
import { checkHeaderAndProfileMenu, checkSidebarMenusAndTitles } from '~/tests/utils/common';
import { searchSessionWithText, navigateToSessionById } from '~/tests/utils/report-page';

test.describe('frontend_heartbeat', () => {
    // Helper functions to reduce code duplication
    const dropdownButtons = [
        'approve-session-btn',
        'reject-session-btn',
        'invite-applicant',
        'trigger-pms-upload-btn',
        'upload-document-btn',
        'request-additional-btn',
        'income-source-automation-dropdown-item'
    ];

    const testDropdownButtons = async (page, buttons, context = '') => {
        const contextText = context ? ` (${context})` : '';
        
        for (const buttonTestId of buttons) {
            const button = page.getByTestId(buttonTestId);
            await expect(button).toBeVisible();
            await expect(button).toBeEnabled();
            console.log(`✅ Dropdown button visible and enabled${contextText}: ${buttonTestId}`);
        }
    };

    const testViewDetailsModal = async (page) => {
        // Test View Details button
        const viewDetailsBtn = page.getByTestId('view-details-btn');
        await expect(viewDetailsBtn).toBeVisible();
        await viewDetailsBtn.click();
        
        // Check if details modal is open
        await expect(page.getByTestId('report-view-details-flags-section')).toBeVisible();
        
        // Close modal
        await page.getByTestId('close-event-history-modal').click();
    };

    test('Should check frontend heartbeat', {
        tag: ['@core', '@smoke', '@regression', '@multi-env-ready'],
    }, async ({ page }) => {
        await page.goto('/');
        await loginForm.fill(page, admin);
        await loginForm.submitAndSetLocale(page);
        await expect(page.getByTestId('household-status-alert')).toBeVisible({ timeout: 10_000 });

        // Check header, menu, profile, and applicants submenu
        await checkHeaderAndProfileMenu(page);

        // Check all sidebar menus, submenus, and their titles
        await checkSidebarMenusAndTitles(page);
    });

    test('Should test session actions and section dropdowns', {
        tag: ['@core', '@smoke', '@regression', '@critical'],
    }, async ({ page }) => {
        await page.goto('/');
        await loginForm.fill(page, admin);
        await loginForm.submitAndSetLocale(page);
        await expect(page.getByTestId('household-status-alert')).toBeVisible({ timeout: 10_000 });

        // Navigate deterministically to a fully populated session from the target application
        // Applicants (sessions) page
        const applicantsMenu = page.getByTestId('applicants-menu');
        const isMenuOpen = await applicantsMenu.evaluate(el => el.classList.contains('sidebar-item-open'));
        if (!isMenuOpen) {
            await applicantsMenu.click();
        }
        
        // Click "Meets Criteria" submenu (approved + conditionally_approved sessions)
        const meetCriteriaMenu = page.getByTestId('reviewed-submenu');
        await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/sessions?') && resp.ok()),
            meetCriteriaMenu.click()
        ]);
        await expect(page.getByTestId('household-status-alert')).toBeVisible({ timeout: 10_000 });

        await page.waitForTimeout(5000);    

        // Search sessions for a known app that yields full, populated sessions
        const sessions = await searchSessionWithText(page, 'Autotest Suite - Full Test');
        expect(sessions.length).toBeGreaterThan(0);
        const sessionId = sessions[0].id;
        await navigateToSessionById(page, sessionId, 'reviewed');
        await expect(page.getByTestId('household-status-alert')).toBeVisible({ timeout: 10_000 });

        // 1) Assert action dropdown buttons exist and are enabled
        const actionButton = page.getByTestId('session-action-btn');
        await expect(actionButton).toBeVisible();
        await actionButton.click();
        await testDropdownButtons(page, dropdownButtons);

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
    });
});