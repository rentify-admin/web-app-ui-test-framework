import { expect, test } from '@playwright/test';
import loginForm from '~/tests/utils/login-form';
import { app, admin } from '~/tests/test_config';

import { joinUrl } from './utils/helper';

test.describe('check_org_member_application_permission_update', () => {

test('Admin should be able to update an organization member\'s application permissions', { tag: ['@regression', '@staging-ready'] }, async ({ page }) => {

        console.log('🚀 Open Url');
        await page.goto('/');

        console.log('🚀 Login with the admin credentials...');
        await loginForm.fill(page, admin);
        await loginForm.submitAndSetLocale(page);

        console.log('🚀 Wait for session page to load...');
        await expect(page.getByTestId('household-status-alert')).toBeVisible({ timeout: 10_000 });
        console.log('✅ Session page loaded successfully.');

        console.log('🚀 Go to organization page...');
        console.log('🚀 Click on organization main menu');
        await page.getByTestId('organization-menu').click();
        console.log('🚀 Click on organization sub menu');
        await page.getByTestId('organization-self-submenu').click();

        console.log('🚀 Check members tab is visible');
        await expect(page.getByTestId('users-tab')).toBeVisible({ timeout: 10_000 });
        console.log('✅ Members tab is visible.');

        console.log('🚀 Click on the members tab');
        await page.getByTestId('users-tab').click();

        console.log('🚀 Wait for members table to be visible.');
        await expect(page.getByTestId('members-table')).toBeVisible();
        console.log('✅ Members table is visible.');

        const memberTable = await page.getByTestId('members-table');

        const targetEmail = 'test_reviwer@verifast.com';

        console.log('🚀 Searching for the target member with email:', targetEmail);
        
        // Use the search bar to find the member by email
        const searchBar = page.locator('input[placeholder*="Search"]');
        await page.waitForTimeout(1000); // Wait for animation
        await expect(searchBar).toBeVisible({ timeout: 10000 });
        
        // Ensure the search bar is ready for input
        await searchBar.click();
        await searchBar.focus();
        await page.waitForTimeout(500);
        
        // Clear any existing content and search for the email
        await searchBar.clear();
        await searchBar.fill(targetEmail);
        
        // Wait for search results and find the target member
        await page.waitForTimeout(1000); // Wait for search results to load
        
        // Find the row that contains the target email
        const targetTdLocator = memberTable
            .getByTestId('members-table-email-col').filter({ hasText: targetEmail }).first();
        
        await expect(targetTdLocator).toBeVisible({ timeout: 10000 });
        console.log('✅ Target member found! Getting the parent row.');
        
        const targetRow = targetTdLocator.locator('xpath=..');
        const editButton = targetRow.locator('[data-testid^="edit"]');

        console.log('🚀 Clicking the edit button and waiting for the API response.');
        await Promise.all([
            page.waitForResponse(resp => resp.url().includes(joinUrl(app.urls.api, 'applications?fields[application]='))),
            editButton.click()
        ]);
        console.log('✅ Edit button clicked and API response received.');

        console.log('🚀 Expect member role modal to be visible.');
        await expect(page.getByTestId('member-role-modal')).toBeVisible();
        console.log('✅ Member role modal is visible.');

        const permissionTable = await page.getByTestId('all-application-table');
        console.log('🚀 Got permission table locator.');

        const lastRow = permissionTable.getByTestId('all-application-row').last();
        console.log('🚀 Got the last row locator.');

        console.log('🚀 Scrolling to view the last row...');
        await lastRow.scrollIntoViewIfNeeded();
        console.log('✅ Last row is in view.');

        const checkbox = lastRow.getByTestId('bind-view-application-check').locator('input[type="checkbox"]');
        const isInitiallyChecked = await checkbox.isChecked();

        if (!isInitiallyChecked) {
            console.log('🚀 Checkbox is not checked. Checking it now to enable save button.');
            await checkbox.check();
        } else {
            console.log('🚀 Checkbox is already checked. Unchecking it now to enable save button.');
            await checkbox.uncheck();
        }

        await page.waitForTimeout(2000);
        console.log('✅ Checkbox state has been changed.');

        const updateApi = new RegExp(`${joinUrl(app.urls.api, 'organizations')}/.{36}/members/.{36}`);

        console.log('🚀 Waiting for save button to be enabled...');
        const saveBtn = page.getByTestId('save-app-permission-btn');
        await expect(saveBtn).toBeVisible();
        await expect(saveBtn).toBeEnabled({ timeout: 5000 });
        console.log('✅ Save button is enabled.');

        console.log('🚀 Clicking save button after changing permission state...');
        await Promise.all([
            page.waitForResponse(resp => {
                const matched = updateApi.test(resp.url())
                    && resp.ok()
                    && resp.request().method() === 'PATCH';
                console.log(`Checking Url: ${resp.url()}`);
                console.log(`matched: ${matched}`);
                return matched;
            }),
            saveBtn.click()
        ]);
        console.log('✅ Permissions updated successfully.');

        await page.waitForTimeout(2000);
        console.log('🚀 Reverting the change to clean up the test...');

        // Now, perform the opposite action to revert to the original state
        if (isInitiallyChecked) {
            console.log('🚀 Initial state was checked. Re-checking the box.');
            await checkbox.check();
        } else {
            console.log('🚀 Initial state was unchecked. Re-unchecking the box.');
            await checkbox.uncheck();
        }

        await page.waitForTimeout(2000);

        console.log('🚀 Waiting for save button to be enabled again...');
        await expect(saveBtn).toBeEnabled({ timeout: 5000 });
        console.log('✅ Save button is enabled for revert.');

        console.log('🚀 Clicking save button again to revert permissions...');
        await Promise.all([
            page.waitForResponse(resp => {
                const matched = updateApi.test(resp.url())
                    && resp.ok()
                    && resp.request().method() === 'PATCH';
                console.log(`Checking Url: ${resp.url()}`);
                console.log(`matched: ${matched}`);
                return matched;
            }),
            saveBtn.click()
        ]);
        console.log('✅ Permissions reverted successfully.');

        console.log('🏁 Test completed successfully!');
    });
});
