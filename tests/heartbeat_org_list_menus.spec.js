import { test, expect } from '@playwright/test';
import loginForm from './utils/login-form';
import { admin, app } from './test_config';
import { waitForJsonResponse } from './utils/wait-response';
import { customUrlDecode, joinUrl } from './utils/helper';


test.describe('heartbeat_org_list_menus.spec', () => {

    test('Should check Organization List menu heartbeat', {
        tag: ['@core', '@smoke', '@regression', '@critical'],
    }, async ({ page }) => {

        await page.goto('/');
        await loginForm.fill(page, admin);
        await loginForm.submit(page);
        await expect(page.getByTestId('household-status-alert')).toBeVisible({ timeout: 10_000 });

        // verifying organization page
        const organizationSubMenu = await page.getByTestId('organizations-menu');
        const isOrganizationSubMenuActive = await organizationSubMenu.evaluate(item => item.classList.contains('sidebar-active'))


        let organization = [];
        if (!isOrganizationSubMenuActive) {
            const [response] = await Promise.all([
                page.waitForResponse(resp => {
                    return resp.url().startsWith(joinUrl(app.urls.api, '/organizations?'))
                        && resp.request().method() === 'GET'
                        && resp.ok()
                }),
                organizationSubMenu.click()
            ])
            organization = await waitForJsonResponse(response)
        } else {
            const [response] = await Promise.all([
                page.waitForResponse(resp => {
                    return resp.url().startsWith(joinUrl(app.urls.api, '/organizations?'))
                        && resp.request().method() === 'GET'
                        && resp.ok()
                }),
                page.reload()
            ])
            organization = await waitForJsonResponse(response)
        }
        if (organization.data.length > 0) {
            const table = await page.locator('table');
            const tableRows = await table.locator('tbody>tr')
            // Loop through API data, not UI rows (to avoid pagination mismatches)
            for (let index = 0; index < organization.data.length; index++) {
                const row = await tableRows.nth(index);
                await expect(row).toContainText(organization.data[index].name);
            }
            console.log('🚀 ~ Organization list checked')
        }

    })

})