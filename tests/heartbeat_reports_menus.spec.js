import { test, expect } from '@playwright/test';
import loginForm from './utils/login-form';
import { admin } from './test_config';
import { navigateToSubMenu, verifyListContent } from './utils/heartbeat-helper';


test.describe('heartbeat_reports_menus.spec', () => {

    test('Should check Report menu heartbeat', {
        tag: ['@core', '@smoke', '@regression', '@critical'],
    }, async ({ page }) => {

        await page.goto('/');
        await loginForm.fill(page, admin);
        await loginForm.submit(page);
        await expect(page.getByTestId('household-status-alert')).toBeVisible({ timeout: 10_000 });

        const reportMenu = await page.getByTestId('reports-menu');

        const isReportMenuExpanded = await reportMenu.evaluate(element => element.classList.contains('sidebar-item-open'));

        if (!isReportMenuExpanded) {
            await reportMenu.click()
        }

        // verifying tags page
        const sessionSeportSubMenu = await page.getByTestId('report-sessions-menu');
        const isReportSubMenuActive = await sessionSeportSubMenu.evaluate(item => item.classList.contains('sidebar-active'))


        const sessionReports = await navigateToSubMenu(page, sessionSeportSubMenu, '/sessions?', isReportSubMenuActive);
        await verifyListContent(page, sessionReports?.data || [], 'application.name', 'Report list');

        // verifying verification report page
        const verificationPage = await page.getByTestId('report-verifications-menu');
        const verifications = await navigateToSubMenu(page, verificationPage, '/verifications?', false);
        await verifyListContent(page, verifications?.data || [], 'type', 'Verification list');


        const filesPage = await page.getByTestId('report-files-menu');
        const files = await navigateToSubMenu(page, filesPage, '/documents?', false);
        await verifyListContent(page, files?.data || [], 'type.name', 'Files list');

        const incomeSourcePage = await page.getByTestId('report-income-sources-menu');
        const incomeSources = await navigateToSubMenu(page, incomeSourcePage, '/income-sources?', false);
        await verifyListContent(page, incomeSources?.data || [], 'description', 'Income sources list');


    })

})