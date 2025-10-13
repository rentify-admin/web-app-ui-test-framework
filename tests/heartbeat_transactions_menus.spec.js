import { test, expect } from '@playwright/test';
import loginForm from './utils/login-form';
import { admin } from './test_config';
import { navigateToSubMenu, verifyListContent } from './utils/heartbeat-helper';


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


        const tags = await navigateToSubMenu(page, tagsSubMenu, '/tags?', isTagsSubMenuActive);
        await verifyListContent(page, tags?.data || [], 'name', 'Tag list');


        // verifying keyword mapping page
        const keywordMappingSubMenu = await page.getByTestId('keyword-mapping-submenu');
        await expect(keywordMappingSubMenu).toBeVisible();
        const keywords = await navigateToSubMenu(page, keywordMappingSubMenu, '/keywords?', false);
        await verifyListContent(page, keywords?.data || [], 'keyword', 'Keyword list');

        // verifying blacklists page
        const blacklistSubMenu = await page.getByTestId('blacklists-submenu');
        await expect(blacklistSubMenu).toBeVisible();
        const blacklists = await navigateToSubMenu(page, blacklistSubMenu, '/income-source-blacklist-rules?', false);
        await verifyListContent(page, blacklists?.data || [], 'provider.name', 'Blacklist list');

        // verifying provider mapping page
        const providerMappingMenu = await page.getByTestId('provider-mapping-submenu');
        await expect(providerMappingMenu).toBeVisible();
        const providerMappings = await navigateToSubMenu(page, providerMappingMenu, '/categories?', false);
        await verifyListContent(page, providerMappings?.data || [], 'name', 'Provider mapping list');
    })

})
