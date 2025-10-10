import { test, expect } from '@playwright/test';
import loginForm from './utils/login-form';
import { admin } from './test_config';


test.describe('heartbeat-address-menus.spec', () => {

    test('Should check Address heartbeat', {
        tag: ['@core', '@smoke', '@regression', '@critical'],
    }, async ({ page }) => {

        await page.goto('/');
        await loginForm.fill(page, admin);
        await loginForm.submit(page);
        await expect(page.getByTestId('household-status-alert')).toBeVisible({ timeout: 10_000 });

        const addressMenus = await page.getByTestId('address-menu');

        await addressMenus.click();

        await page.waitForTimeout(1000);

        // Now only coming soon page here

    })
})