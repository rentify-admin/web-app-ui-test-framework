import { test, expect } from '@playwright/test';
import loginForm from './utils/login-form';
import { admin } from './test_config';
import { navigateToSubMenu } from './utils/heartbeat-helper';


test.describe('heartbeat_income_source_menus.spec', () => {

    test('Should check Income Sources menu heartbeat', {
        tag: ['@core', '@smoke', '@regression', '@critical', '@staging-ready', '@rc-ready'],
    }, async ({ page }) => {

        await page.goto('/');
        await loginForm.fill(page, admin);
        await loginForm.submit(page);
        // loginForm.submit() already waits for page to be ready (side-panel and sessions loaded)

        const incomeSourceMenu = await page.getByTestId('incomesource-menu');

        const isIncomeSourceMenuExpanded = await incomeSourceMenu.evaluate(element => element.classList.contains('sidebar-item-open'));

        if (!isIncomeSourceMenuExpanded) {
            await incomeSourceMenu.click()
        }

        // verifying tags page
        const incomeSourceSubMenu = await page.getByTestId('incomesource-configuration-submenu');
        const isIncomeSourceSubMenuActive = await incomeSourceSubMenu.evaluate(item => item.classList.contains('sidebar-active'))


        const incomeSources = await navigateToSubMenu(page, incomeSourceSubMenu, '/income-source-templates?', isIncomeSourceSubMenuActive);
        if (incomeSources.data.length > 0) {
            const table = await page.locator('table');
            const tableRows = await table.locator('tbody>tr')
            
            // Wait for all rows to be rendered (expect at least API data count)
            await expect(tableRows).toHaveCount(incomeSources.data.length, { timeout: 10000 });
            
            // Create a set of expected names from API for order-independent validation
            const apiNames = incomeSources.data.map(item => item.name);
            console.log(`ℹ️ API returned ${apiNames.length} income sources`);
            
            // Loop through UI rows and verify each exists in API response (order-independent)
            for (let index = 0; index < incomeSources.data.length; index++) {
                const row = await tableRows.nth(index);
                const rowText = await row.textContent();
                
                // Check if any API name is present in this row
                const foundInApi = apiNames.some(name => rowText.includes(name));
                await expect(foundInApi).toBe(true);
                
                if (!foundInApi) {
                    console.log(`❌ Row ${index + 1} text "${rowText}" not found in API response`);
                }
            }
            console.log('✅ Income Source list checked - all UI rows match API data (order-independent)')
        }
    })

})
