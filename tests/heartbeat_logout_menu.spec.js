import { test, expect } from '@playwright/test';
import loginForm from './utils/login-form';
import { admin, app } from './test_config';
import { joinUrl } from './utils/helper';


test.describe('heartbeat_income_source_menus.spec', () => {

    test('Should check Income Sources menu heartbeat', {
        tag: ['@core', '@smoke', '@regression'],
    }, async ({ page }) => {

        await page.goto('/');
        await loginForm.fill(page, admin);
        await loginForm.submit(page);
        await expect(page.getByTestId('household-status-alert')).toBeVisible({ timeout: 10_000 });

        const logoutMenu = await page.getByTestId('logout-menu');

        await logoutMenu.click()
        await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible({ timeout: 10_000 });
        await expect(page.getByRole('textbox', { name: 'Email Address' })).toBeVisible({ timeout: 10_000 });
        await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible({ timeout: 10_000 });
        await expect(page.getByTestId('admin-login-btn')).toBeVisible({ timeout: 10_000 });

        await page.reload();

        await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible({ timeout: 10_000 });
        await expect(page.getByRole('textbox', { name: 'Email Address' })).toBeVisible({ timeout: 10_000 });
        await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible({ timeout: 10_000 });
        await expect(page.getByTestId('admin-login-btn')).toBeVisible({ timeout: 10_000 });

        console.log('🚀 ~ Logout flow tested');
    })

})
