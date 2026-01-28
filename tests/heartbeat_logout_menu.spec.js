import { test, expect } from '@playwright/test';
import loginForm from './utils/login-form';
import { admin, app } from './test_config';
import { joinUrl } from './utils/helper';


test.describe('heartbeat_logout_menu.spec.spec', () => {

    test('Should check Logout flow heartbeat', {
        tag: ['@core', '@smoke', '@regression', '@critical', '@staging-ready', '@rc-ready'],
    }, async ({ page }) => {

        await page.goto('/');
        await loginForm.fill(page, admin);
        await loginForm.submit(page);
        // loginForm.submit() already waits for page to be ready (side-panel and sessions loaded)

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
