import { test, expect } from '@playwright/test';
import loginForm from './utils/login-form';
import { admin, app } from './test_config';
import { waitForJsonResponse } from './utils/wait-response';
import { customUrlDecode, joinUrl } from './utils/helper';


test.describe('heartbeat_income_source_menus.spec', () => {

    test('Should check Income Sources menu heartbeat', {
        tag: ['@core', '@smoke', '@regression', '@critical'],
    }, async ({ page }) => {

        await page.goto('/');
        await loginForm.fill(page, admin);
        await loginForm.submit(page);
        await expect(page.getByTestId('household-status-alert')).toBeVisible({ timeout: 10_000 });

        const incomeSourceMenu = await page.getByTestId('incomesource-menu');

        const isIncomeSourceMenuExpanded = await incomeSourceMenu.evaluate(element => element.classList.contains('sidebar-item-open'));

        if (!isIncomeSourceMenuExpanded) {
            await incomeSourceMenu.click()
        }

        // verifying tags page
        const incomeSourceSubMenu = await page.getByTestId('incomesource-configuration-submenu');
        const isIncomeSourceSubMenuActive = await incomeSourceSubMenu.evaluate(item => item.classList.contains('sidebar-active'))


        let incomeSources = [];
        if (!isIncomeSourceSubMenuActive) {
            const [response] = await Promise.all([
                page.waitForResponse(resp => {
                    return resp.url().startsWith(joinUrl(app.urls.api, '/income-source-templates?'))
                        && resp.request().method() === 'GET'
                        && resp.ok()
                }),
                incomeSourceSubMenu.click()
            ])
            incomeSources = await waitForJsonResponse(response)
        } else {
            const [response] = await Promise.all([
                page.waitForResponse(resp => {
                    return resp.url().startsWith(joinUrl(app.urls.api, '/income-source-templates?'))
                        && resp.request().method() === 'GET'
                        && resp.ok()
                }),
                page.reload()
            ])
            incomeSources = await waitForJsonResponse(response)
        }
        if (incomeSources.data.length > 0) {
            const table = await page.locator('table');
            const tableRows = await table.locator('tbody>tr')
            
            // Wait for all rows to be rendered (expect at least API data count)
            await expect(tableRows).toHaveCount(incomeSources.data.length, { timeout: 10000 });
            
            // Loop through API data, not UI rows (to avoid pagination mismatches)
            for (let index = 0; index < incomeSources.data.length; index++) {
                const row = await tableRows.nth(index);
                await expect(row).toContainText(incomeSources.data[index].name);
            }
            console.log('🚀 ~ Income Source list checked')
        }
    })

})
