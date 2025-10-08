import { test, expect } from '@playwright/test';
import loginForm from './utils/login-form';
import { admin, app } from './test_config';
import { waitForJsonResponse } from './utils/wait-response';
import { customUrlDecode, joinUrl } from './utils/helper';


test.describe('heartbeat_organizations_menus.spec', () => {

    test('Should check Organizations menu heartbeat', {
        tag: ['@core', '@smoke', '@regression'],
    }, async ({ page }) => {

        await page.goto('/');
        await loginForm.fill(page, admin);
        await loginForm.submit(page);
        await expect(page.getByTestId('household-status-alert')).toBeVisible({ timeout: 10_000 });

        const organizationMenu = await page.getByTestId('organization-menu');

        const isOrganizationMenuExpanded = await organizationMenu.evaluate(element => element.classList.contains('sidebar-item-open'));

        if (!isOrganizationMenuExpanded) {
            await organizationMenu.click()
        }

        // verifying tags page
        const organizationSubMenu = await page.getByTestId('organization-self-submenu');
        const isOrganizationSubMenuActive = await organizationSubMenu.evaluate(item => item.classList.contains('sidebar-active'))


        let organization = [];
        if (!isOrganizationSubMenuActive) {
            const [response] = await Promise.all([
                page.waitForResponse(resp => {
                    return resp.url().startsWith(joinUrl(app.urls.api, '/organizations/self?'))
                        && resp.request().method() === 'GET'
                        && resp.ok()
                }),
                organizationSubMenu.click()
            ])
            organization = await waitForJsonResponse(response)
        } else {
            const [response] = await Promise.all([
                page.waitForResponse(resp => {
                    return resp.url().startsWith(joinUrl(app.urls.api, '/organizations/self?'))
                        && resp.request().method() === 'GET'
                        && resp.ok()
                }),
                page.reload()
            ])
            organization = await waitForJsonResponse(response)
        }
        if (organization.data) {
            const heading = await page.getByRole('heading', { name: organization.data.name })
            await expect(heading).toBeDefined()
        }

        console.log('🚀 ~ Organization page tested')

    })

})