import { expect, test } from '@playwright/test';
import loginForm from '~/tests/utils/login-form';
import { admin, app } from '~/tests/test_config';

import { joinUrl } from './utils/helper';

test.describe('Organization Member Application Permissions', () => {

    test('Admin should be able to update an organization member\'s application permissions', async ({ page }) => {

        console.log('🚀 Open Url');
        await page.goto('/');

        console.log('🚀 Login with the admin credentials...');
        await loginForm.fill(page, admin);
        await loginForm.submit(page);

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

        const maxAttempts = 20;
        let attempts = 0;
        let foundRow = false;
        const targetText = 'Reviewer';

        console.log('🚀 Starting infinite scroll search for the target member with role:', targetText);
        while (attempts < maxAttempts && !foundRow) {
            console.log(`🚀 Attempt ${attempts + 1} of ${maxAttempts}...`);

            // Find the row that contains the target text
            const targetTdLocator = memberTable
                .locator(`td[data-testid="members-table-role-col"]`, { hasText: targetText }).first();

            if (await targetTdLocator.isVisible()) {
                console.log('✅ Target member found! Getting the parent row.');
                const targetRow = targetTdLocator.locator('xpath=..');
                const editButton = targetRow.locator('[data-testid^="edit"]');

                console.log('🚀 Clicking the edit button and waiting for the API response.');
                await Promise.all([
                    page.waitForResponse(resp => resp.url().includes(joinUrl(app.urls.api, 'applications?fields[application]='))),
                    editButton.click()
                ]);
                foundRow = true;
                console.log('✅ Edit button clicked and API response received.');
            } else {
                console.log('⏳ Target member not visible. Scrolling down...');
                await page.mouse.wheel(0, 1000);
                await page.waitForTimeout(1000);
                console.log('✅ Scrolled and waiting for new data.');
            }
            attempts++;
        }

        console.log('🚀 Final check on the search loop outcome...');
        await expect(foundRow).toBe(true);
        console.log('✅ Search loop completed successfully, row was found.');

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

        const checkbox = lastRow.getByTestId('all-application-check-item');
        const isInitiallyChecked = await checkbox.isChecked();

        if (!isInitiallyChecked) {
            console.log('🚀 Checkbox is not checked. Checking it now to enable save button.');
            await checkbox.check();
        } else {
            console.log('🚀 Checkbox is already checked. Unchecking it now to enable save button.');
            await checkbox.uncheck();
        }

        await page.waitForTimeout(200);
        console.log('✅ Checkbox state has been changed.');

        const updateApi = new RegExp(`${joinUrl(app.urls.api, 'organizations')}/.{36}/members/.{36}`);

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
            page.getByTestId('save-app-permission-btn').click()
        ]);
        console.log('✅ Permissions updated successfully.');

        await page.waitForTimeout(200);
        console.log('🚀 Reverting the change to clean up the test...');

        // Now, perform the opposite action to revert to the original state
        if (isInitiallyChecked) {
            console.log('🚀 Initial state was checked. Re-checking the box.');
            await checkbox.check();
        } else {
            console.log('🚀 Initial state was unchecked. Re-unchecking the box.');
            await checkbox.uncheck();
        }

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
            page.getByTestId('save-app-permission-btn').click()
        ]);
        console.log('✅ Permissions reverted successfully.');

        console.log('🏁 Test completed successfully!');
    });
});
