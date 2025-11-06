import { test, expect } from '@playwright/test';
import loginForm from './utils/login-form';
import { admin } from './test_config';
import { navigateToSubMenu, verifyListContent } from './utils/heartbeat-helper';


test.describe('heartbeat_org_list_menus.spec', () => {

    test('Should check Organization List menu heartbeat', {
        tag: ['@core', '@smoke', '@regression', '@critical', '@multi-env-ready'],
    }, async ({ page }) => {

        await page.goto('/');
        await loginForm.fill(page, admin);
        await loginForm.submit(page);
        await expect(page.getByTestId('household-status-alert')).toBeVisible({ timeout: 10_000 });

        // verifying organization page
        const organizationSubMenu = await page.getByTestId('organizations-menu');
        const isOrganizationSubMenuActive = await organizationSubMenu.evaluate(item => item.classList.contains('sidebar-active'))


        const organization = await navigateToSubMenu(page, organizationSubMenu, '/organizations?', isOrganizationSubMenuActive);
        await verifyListContent(page, organization?.data || [], 'name', 'Organization list');

    })

})