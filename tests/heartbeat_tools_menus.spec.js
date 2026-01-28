import { test, expect } from '@playwright/test';
import loginForm from './utils/login-form';
import { admin, app } from './test_config';


test.describe('heartbeat_tools_menus.spec', () => {

    test('Should check Tools menu heartbeat', {
        tag: ['@core', '@smoke', '@regression', '@critical', '@staging-ready', '@rc-ready'],
    }, async ({ page }) => {

        await page.goto('/');
        await loginForm.fill(page, admin);
        await loginForm.submit(page);
        // loginForm.submit() already waits for page to be ready (side-panel and sessions loaded)

        const documentTesterMenu = await page.getByTestId('tools-menu');

        const isDocumentTesterExpanded = await documentTesterMenu.evaluate(element => element.classList.contains('sidebar-item-open'));

        if (!isDocumentTesterExpanded) {
            await documentTesterMenu.click()
        }

        // verifying tags page
        const documentTesterSubMenu = await page.getByTestId('document-tester-submenu');
        // const isDocumentTesterSubMenuActive = await documentTesterSubMenu.evaluate(item => item.classList.contains('sidebar-active'))

        await documentTesterSubMenu.click();

        await expect(page.getByTestId('document-tester-heading')).toBeDefined();
        await expect(page.getByText('Document Policy', { exact: true })).toBeDefined();
        await expect(page.getByText('Upload Test File')).toBeDefined();
        await expect(page.locator('.filepond--drop-label')).toBeDefined();

        await page.getByTestId('name-tester-submenu').click();
        await expect(page.getByText('Name 1')).toBeVisible();
        await expect(page.getByText('Name 2')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible();


        await page.getByTestId('integrations-submenu').click();
        await expect(page.getByRole('button', { name: 'New Customer' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Sandbox Customers' })).toBeVisible();


        await page.getByTestId('test-setup-submenu').click();
        await expect(page.getByRole('heading', { name: 'Test Setup Page' })).toBeVisible();

    })

})
