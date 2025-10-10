import { test, expect } from '@playwright/test';
import loginForm from './utils/login-form';
import { admin, app } from './test_config';
import { waitForJsonResponse } from './utils/wait-response';
import { customUrlDecode, joinUrl } from './utils/helper';


test.describe('heartbeat_transactions_menus.spec', () => {

    test('Should check Transactions menu heartbeat', {
        tag: ['@core', '@smoke', '@regression', '@critical'],
    }, async ({ page }) => {

        await page.goto('/');
        await loginForm.fill(page, admin);
        await loginForm.submit(page);
        await expect(page.getByTestId('household-status-alert')).toBeVisible({ timeout: 10_000 });

        const transactionMenu = await page.getByTestId('transactions-menu');

        const isTransactionExpanded = await transactionMenu.evaluate(element => element.classList.contains('sidebar-item-open'));

        if (!isTransactionExpanded) {
            await transactionMenu.click()
        }

        // verifying tags page
        const tagsSubMenu = await page.getByTestId('transaction-tags-submenu');
        const isTagsSubMenuActive = await tagsSubMenu.evaluate(item => item.classList.contains('sidebar-active'))


        let tags = [];
        if (!isTagsSubMenuActive) {
            const [response] = await Promise.all([
                page.waitForResponse(resp => {
                    return resp.url().startsWith(joinUrl(app.urls.api, '/tags?'))
                        && resp.request().method() === 'GET'
                        && resp.ok()
                }),
                tagsSubMenu.click()
            ])
            tags = await waitForJsonResponse(response)
        } else {
            const [response] = await Promise.all([
                page.waitForResponse(resp => {
                    return resp.url().startsWith(joinUrl(app.urls.api, '/tags?'))
                        && resp.request().method() === 'GET'
                        && resp.ok()
                }),
                page.reload()
            ])
            tags = await waitForJsonResponse(response)
        }
        if (tags.data.length > 0) {
            const tagTable = await page.locator('table');
            const tagTableRows = await tagTable.locator('tbody>tr')
            // Loop through API data, not UI rows (to avoid pagination mismatches)
            for (let index = 0; index < tags.data.length; index++) {
                const row = await tagTableRows.nth(index);
                await expect(row).toContainText(tags.data[index].name);
            }
            console.log('🚀 ~ Tag list checked')
        }


        // verifying keyword mapping page
        const keywordMappingSubMenu = await page.getByTestId('keyword-mapping-submenu');
        await expect(keywordMappingSubMenu).toBeVisible();
        let keywords = []
        if (await keywordMappingSubMenu.isVisible()) {
            const [response] = await Promise.all([
                page.waitForResponse(resp => {
                    return resp.url().startsWith(joinUrl(app.urls.api, '/keywords?'))
                        && resp.request().method() === 'GET'
                        && resp.ok()
                }),
                keywordMappingSubMenu.click()
            ])
            keywords = await waitForJsonResponse(response)
        }

        if (keywords.data.length > 0) {
            const keywordTableRows = await page.locator('section table').locator('tbody>tr');
            for (let index = 0; index < keywords.data.length; index++) {
                const row = await keywordTableRows.nth(index);
                await expect(row).toContainText(keywords.data[index].keyword);
            }
            console.log('🚀 ~ keyword list checked')
        }

        // verifying blacklists page
        const blacklistSubMenu = await page.getByTestId('blacklists-submenu');
        await expect(blacklistSubMenu).toBeVisible();
        let blacklists = []
        if (await blacklistSubMenu.isVisible()) {
            const [response] = await Promise.all([
                page.waitForResponse(resp => {
                    return resp.url().startsWith(joinUrl(app.urls.api, '/income-source-blacklist-rules?'))
                        && resp.request().method() === 'GET'
                        && resp.ok()
                }),
                blacklistSubMenu.click()
            ])
            blacklists = await waitForJsonResponse(response)
        }

        if (blacklists.data.length > 0) {
            const blacklistTableRows = await page.locator('section table[data-testid]').locator('tbody>tr');
            for (let index = 0; index < blacklists.data.length; index++) {
                const row = await blacklistTableRows.nth(index);
                await expect(row).toContainText(blacklists.data[index].provider.name);
            }
            console.log('🚀 ~ Blacklist list checked')
        }

        // verifying provider mapping page
        const providerMappingMenu = await page.getByTestId('provider-mapping-submenu');
        await expect(providerMappingMenu).toBeVisible();
        let providerMappings = [];
        if (await providerMappingMenu.isVisible()) {
            const [response] = await Promise.all([
                page.waitForResponse(resp => {
                    return resp.url().startsWith(joinUrl(app.urls.api, '/categories?'))
                        && resp.request().method() === 'GET'
                        && resp.ok()
                }),
                providerMappingMenu.click()
            ])
            providerMappings = await waitForJsonResponse(response)
        }

        if (providerMappings.data.length > 0) {
            const providerMappingRows = await page.locator('section table[data-testid]').locator('tbody>tr');
            for (let index = 0; index < providerMappings.data.length; index++) {
                const row = await providerMappingRows.nth(index);
                await expect(row).toContainText(providerMappings.data[index].name);
            }
            console.log('🚀 ~ provider mapping list added')

        }
    })

})
