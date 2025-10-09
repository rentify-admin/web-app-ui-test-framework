import { test, expect } from '@playwright/test';
import loginForm from './utils/login-form';
import { admin, app } from './test_config';
import { navigateToSubMenu, verifyListContent } from './utils/heartbeat-helper';


test.describe('heartbeat_settings_menus.spec', () => {

    test('Should check Settings menu heartbeat', {
        tag: ['@core', '@smoke', '@regression'],
    }, async ({ page }) => {

        await page.goto('/');
        await loginForm.fill(page, admin);
        await loginForm.submit(page);
        await expect(page.getByTestId('household-status-alert')).toBeVisible({ timeout: 10_000 });

        const settingsMenu = await page.getByTestId('settings-menu');

        const isDocumentTesterExpanded = await settingsMenu.evaluate(element => element.classList.contains('sidebar-item-open'));

        if (!isDocumentTesterExpanded) {
            await settingsMenu.click()
        }

        // verifying accounts page
        const accountSubMenu = await page.getByTestId('account-setting-submenu');

        await accountSubMenu.click();

        console.log('🚀 ~ Account page checked')

        const deviceSubMenu = page.getByTestId('devices-setting-submenu');
        const deviceData = await navigateToSubMenu(page, deviceSubMenu, '/devices?', false);
        await verifyListContent(page, deviceData?.data || [], 'name', 'Devices list');


        await page.getByTestId('notification-setting-submenu').click();
        // INFO: Notification page not integrated now

        await page.getByTestId('2fa-setting-submenu').click();

        await expect(page.getByRole('heading', { name: 'Two-factor authentication' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Additional Password Protection' })).toBeVisible();

        await expect(page.getByRole('button', { name: 'Change Password' })).toBeVisible();

        console.log('🚀 ~ 2FA settings page checked')
    })

})
