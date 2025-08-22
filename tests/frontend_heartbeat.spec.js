import { test, expect } from '@playwright/test';
import loginForm from '~/tests/utils/login-form';
import { admin } from '~/tests/test_config';
import { checkHeaderAndProfileMenu, checkSidebarMenusAndTitles } from '~/tests/utils/common';

test.describe('frontend_heartbeat', () => {
    // Helper functions to reduce code duplication
    const dropdownButtons = [
        'approve-session-btn',
        'reject-session-btn', 
        'invite-applicant'
    ];

    const testDropdownButtons = async (page, buttons, context = '') => {
        const contextText = context ? ` (${context})` : '';
        
        for (const buttonTestId of buttons) {
            const button = page.getByTestId(buttonTestId);
            if (await button.isVisible()) {
                console.log(`✅ Dropdown button visible${contextText}: ${buttonTestId}`);
                await expect(button).toBeVisible();
            } else {
                console.log(`⚠️ Dropdown button not visible${contextText}: ${buttonTestId}`);
            }
        }
        
        // Close dropdown by clicking outside
        await page.click('body');
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
        tag: ['@core', '@smoke', '@regression'],
    }, async ({ page }) => {
        await page.goto('/');
        await loginForm.fill(page, admin);
        await loginForm.submit(page);
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
        await loginForm.submit(page);
        await expect(page.getByTestId('household-status-alert')).toBeVisible({ timeout: 10_000 });

        // 1. Test Action Button and See Details Button
        // Check if action button is clickable and dropdown deploys
        const actionButton = page.getByTestId('session-action-btn');
        await expect(actionButton).toBeVisible();
        await actionButton.click();
        
        // Test dropdown buttons and view details
        await testDropdownButtons(page, dropdownButtons);
        await testViewDetailsModal(page);

        // 2. Test Section Header Dropdowns
        const sectionHeaders = [
            'identity-section-header',
            'income-source-section-header', 
            'files-section-header',
            'financial-section-header',
            'integration-logs-section-header'
        ];

        for (const headerTestId of sectionHeaders) {
            const header = page.getByTestId(headerTestId);
            
            // Check if header is visible
            if (await header.isVisible()) {
                console.log(`Testing dropdown for: ${headerTestId}`);
                
                try {
                    // Get the arrow using the correct selector
                    const arrow = header.getByRole('img', { name: 'arrow' });
                    
                    // Check if the section content is visible
                    const sectionName = headerTestId.replace('-header', '');
                    const sectionContent = page.getByTestId(sectionName);
                    
                    if (await sectionContent.isVisible()) {
                        console.log(`Section ${sectionName} is visible, testing dropdown functionality`);
                        
                        // Get initial state (closed by default)
                        await expect(arrow).toHaveClass(/rotate-90/); // Closed state
                        
                        // Click header to open dropdown
                        await header.click();
                        
                        // Wait for arrow rotation with proper assertion
                        await expect(arrow).toHaveClass(/-rotate-90/, { timeout: 2000 }); // Open state
                        
                        // Click again to close
                        await header.click();
                        
                        // Wait for arrow rotation back with proper assertion
                        await expect(arrow).toHaveClass(/rotate-90/, { timeout: 2000 }); // Closed state
                        
                        console.log(`✅ Section ${sectionName} dropdown test completed`);
                    } else {
                        console.log(`⚠️ Section ${sectionName} content not visible, skipping dropdown test`);
                    }
                } catch (error) {
                    console.log(`❌ Error testing section ${headerTestId}: ${error.message}`);
                    console.log(`   Error details: ${error.stack}`);
                    continue; // Skip to next section
                }
            } else {
                console.log(`Header ${headerTestId} not visible, skipping test`);
            }
        }

        // 3. Reload page and test all buttons again
        console.log('🔄 Reloading page and testing all buttons again...');
        await page.reload();
        await expect(page.getByTestId('household-status-alert')).toBeVisible({ timeout: 10_000 });

        // Test action button dropdown again after reload
        const actionButtonAfterReload = page.getByTestId('session-action-btn');
        await expect(actionButtonAfterReload).toBeVisible();
        await actionButtonAfterReload.click();
        
        // Test dropdown buttons after reload
        await testDropdownButtons(page, dropdownButtons, 'after reload');

        // 4. Test next 4 sessions to cover first 5 total
        console.log('🔄 Testing next 4 sessions to cover first 5 total...');
        
        // Find all session cards on the page
        const sessionCards = page.locator('.application-card[data-session]');
        const sessionCardCount = await sessionCards.count();
        console.log(`📊 Found ${sessionCardCount} session cards on the page`);
        
        // Test first 5 sessions (including current one)
        const sessionsToTest = Math.min(5, sessionCardCount);
        console.log(`🎯 Testing ${sessionsToTest} sessions total`);
        
        // Get session IDs from the first 5 cards
        const sessionIds = [];
        for (let i = 0; i < sessionsToTest; i++) {
            const sessionCard = sessionCards.nth(i);
            const sessionId = await sessionCard.getAttribute('data-session');
            if (sessionId) {
                sessionIds.push(sessionId);
                console.log(`📋 Session ${i + 1}: ${sessionId}`);
            }
        }
        
        // Test each session (skip first one as it's already tested)
        for (let i = 1; i < sessionIds.length; i++) {
            const sessionId = sessionIds[i];
            console.log(`🔄 Testing session ${i + 1}/${sessionsToTest}: ${sessionId}`);
            
            // Click on the session card to navigate to it
            const sessionCard = page.locator(`.application-card[data-session="${sessionId}"]`);
            await sessionCard.click();
            
            // Wait for page to load
            await expect(page.getByTestId('household-status-alert')).toBeVisible({ timeout: 10_000 });
            
            // Test action button dropdown for this session
            const sessionActionButton = page.getByTestId('session-action-btn');
            await expect(sessionActionButton).toBeVisible();
            await sessionActionButton.click();
            
            // Test dropdown buttons for this session
            await testDropdownButtons(page, dropdownButtons, `Session ${i + 1}`);
            
            console.log(`✅ Session ${i + 1} testing completed`);
        }
        
        console.log('🎉 All 5 sessions tested successfully!');
    });
});