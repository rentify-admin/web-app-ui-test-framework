import { test, expect } from '@playwright/test';
import loginForm from './utils/login-form';
import { admin, app } from './test_config';
import { waitForJsonResponse } from './utils/wait-response';
import { customUrlDecode, joinUrl } from './utils/helper';


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


        let sessionReports = [];
        if (!isReportSubMenuActive) {
            const [response] = await Promise.all([
                page.waitForResponse(resp => {
                    return resp.url().startsWith(joinUrl(app.urls.api, '/sessions?'))
                        && resp.request().method() === 'GET'
                        && resp.ok()
                }),
                sessionSeportSubMenu.click()
            ])
            sessionReports = await waitForJsonResponse(response)
        } else {
            const [response] = await Promise.all([
                page.waitForResponse(resp => {
                    return resp.url().startsWith(joinUrl(app.urls.api, '/sessions?'))
                        && resp.request().method() === 'GET'
                        && resp.ok()
                }),
                page.reload()
            ])
            sessionReports = await waitForJsonResponse(response)
        }

        if (sessionReports.data.length > 0) {
            const table = await page.locator('table');
            const tableRows = await table.locator('tbody>tr')
            // Loop through API data, not UI rows (to avoid pagination mismatches)
            for (let index = 0; index < sessionReports.data.length; index++) {
                const row = await tableRows.nth(index);
                await expect(row).toContainText(sessionReports.data[index].application.name);
            }
            console.log('🚀 ~ Report list checked')
        }

        // verifying verification report page
        const verificationPage = await page.getByTestId('report-verifications-menu');
        let verifications = []
        if (await verificationPage.isVisible()) {
            const [response] = await Promise.all([
                page.waitForResponse(resp => {
                    return resp.url().startsWith(joinUrl(app.urls.api, '/verifications?'))
                        && resp.request().method() === 'GET'
                        && resp.ok()
                }),
                verificationPage.click()
            ])
            verifications = await waitForJsonResponse(response)
        }

        if (verifications.data.length > 0) {
            const rows = await page.locator('table[data-testid]').locator('tbody>tr');
            for (let index = 0; index < verifications.data.length; index++) {
                const row = await rows.nth(index);
                await expect(row).toContainText(verifications.data[index].type);
            }
            console.log('🚀 ~ keyword list checked')
        }


        const filesPage = await page.getByTestId('report-files-menu');
        let files = []
        if (await filesPage.isVisible()) {
            const [response] = await Promise.all([
                page.waitForResponse(resp => {
                    return resp.url().startsWith(joinUrl(app.urls.api, '/documents?'))
                        && resp.request().method() === 'GET'
                        && resp.ok()
                }),
                filesPage.click()
            ])
            files = await waitForJsonResponse(response)
        }

        if (files.data.length > 0) {
            const rows = await page.locator('table[data-testid]').locator('tbody>tr');
            for (let index = 0; index < files.data.length; index++) {
                const row = await rows.nth(index);
                await expect(row).toContainText(files.data[index].type.name);
            }
            console.log('🚀 ~ files list checked')
        }

        const incomeSourcePage = await page.getByTestId('report-income-sources-menu');
        let incomeSources = []
        if (await incomeSourcePage.isVisible()) {
            const [response] = await Promise.all([
                page.waitForResponse(resp => {
                    return resp.url().startsWith(joinUrl(app.urls.api, '/income-sources?'))
                        && resp.request().method() === 'GET'
                        && resp.ok()
                }),
                incomeSourcePage.click()
            ])
            incomeSources = await waitForJsonResponse(response)
        }

        if (incomeSources.data.length > 0) {
            const rows = await page.getByTestId('report-income-sources-table').locator('tbody>tr');
            for (let index = 0; index < incomeSources.data.length; index++) {
                const row = await rows.nth(index);
                await expect(row).toContainText(incomeSources.data[index].description);
            }
            console.log('🚀 ~ income sources list checked')
        }


    })

})