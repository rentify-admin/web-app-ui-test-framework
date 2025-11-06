import { test, expect } from '@playwright/test';
import loginForm from './utils/login-form';
import { admin } from './test_config';
import { waitForJsonResponse } from './utils/wait-response';
import { customUrlDecode, kebabToTitleCase } from './utils/helper';


test.describe('heartbeat_applications_menus.spec', () => {

    test('Should check Applications menu heartbeat', {
        tag: ['@core', '@smoke', '@regression', '@critical', '@staging-ready'],
    }, async ({ page }) => {

        await page.goto('/');
        await loginForm.fill(page, admin);
        await loginForm.submit(page);
        await expect(page.getByTestId('household-status-alert')).toBeVisible({ timeout: 10_000 });

        const applicationsMenu = await page.getByTestId('applications-menu');

        const isApplicationsExpanded = await applicationsMenu.evaluate(element => element.classList.contains('sidebar-item-open'));

        if (!isApplicationsExpanded) {
            await applicationsMenu.click()
        }

        // verifying applications page
        const applicationSubMenu = await page.getByTestId('applications-submenu');
        const isApplicationSubMenuActive = await applicationSubMenu.evaluate(item => item.classList.contains('sidebar-active'))

        let applications = [];
        if (!isApplicationSubMenuActive) {
            const [response] = await Promise.all([
                page.waitForResponse(resp => {
                    return resp.url().includes('/applications?')
                        && resp.request().method() === 'GET'
                        && resp.ok()
                }),
                applicationSubMenu.click()
            ])
            applications = await waitForJsonResponse(response)
        } else {
            const [response] = await Promise.all([
                page.waitForResponse(resp => {
                    return resp.url().includes('/applications?')
                        && resp.request().method() === 'GET'
                        && resp.ok()
                }),
                page.reload()
            ])
            applications = await waitForJsonResponse(response)
        }


        if (applications.data.length > 0) {
            const appTable = await page.getByTestId('application-table');
            const appTableRows = await appTable.locator('tbody>tr')
            // Loop through API data, not UI rows (to avoid pagination mismatches)
            for (let index = 0; index < applications.data.length; index++) {
                const row = await appTableRows.nth(index);
                await expect(row).toContainText(applications.data[index].name);
            }
        }

        // verifying portfolios page
        const portfolioMenu = await page.getByTestId('portfolios-submenu');
        await expect(portfolioMenu).toBeVisible();
        let portfolios = []
        if (await portfolioMenu.isVisible()) {
            const [response] = await Promise.all([
                page.waitForResponse(resp => {
                    return resp.url().includes('/portfolios?')
                        && resp.request().method() === 'GET'
                        && resp.ok()
                }),
                portfolioMenu.click()
            ])
            portfolios = await waitForJsonResponse(response)
        }

        if (portfolios.data.length > 0) {
            const portfolioTableRows = await page.locator('table').locator('tbody>tr');
            for (let index = 0; index < portfolios.data.length; index++) {
                const row = await portfolioTableRows.nth(index);
                await expect(row).toContainText(portfolios.data[index].name);
            }
        }


        // verifying workflows page
        const workflowSubmenu = await page.getByTestId('workflows-submenu');
        await expect(workflowSubmenu).toBeVisible();

        let workflows = [];

        if (await workflowSubmenu.isVisible()) {
            const [response] = await Promise.all([
                page.waitForResponse(resp => {
                    return resp.url().includes('/workflows?')
                        && resp.request().method() === 'GET'
                        && resp.ok()
                }),
                workflowSubmenu.click()
            ])
            workflows = await waitForJsonResponse(response)
        }
        if (workflows.data.length > 0) {
            const workflowTable = await page.getByTestId('workflow-table');
            const workflowRows = await workflowTable.locator('tbody>tr')
            for (let index = 0; index < workflows.data.length; index++) {
                const row = await workflowRows.nth(index);
                if (workflows.data[index].name) {
                    await expect(row).toContainText(kebabToTitleCase(workflows.data[index].name));
                }
            }
        }

        // verifying affordable templates page
        const affordableMenu = await page.getByTestId('affordable-templates-submenu');
        await expect(affordableMenu).toBeVisible();

        let templates = [];

        if (await affordableMenu.isVisible()) {
            const [response] = await Promise.all([
                page.waitForResponse(resp => {
                    return resp.url().includes('/eligibility-templates?')
                        && resp.request().method() === 'GET'
                        && resp.ok()
                }),
                affordableMenu.click()
            ])
            templates = await waitForJsonResponse(response)
        }
        if (templates.data.length > 0) {
            const eligibilityTable = await page.getByTestId('eligibility-template-table');

            const tableRows = await eligibilityTable.locator('tbody>tr')

            for (let index = 0; index < templates.data.length; index++) {
                const row = await tableRows.nth(index)
                await expect(row).toContainText(templates.data[index].name)
            }
        }

        // verifying approval conditions page
        const approvalMenu = await page.getByTestId('approval-conditions-submenu');
        await expect(approvalMenu).toBeVisible();

        let approvalConditions = [];

        if (await approvalMenu.isVisible()) {
            const [response] = await Promise.all([
                page.waitForResponse(resp => {
                    return resp.url().includes('/flag-collections?')
                        && resp.request().method() === 'GET'
                        && resp.ok()
                }),
                approvalMenu.click()
            ])
            approvalConditions = await waitForJsonResponse(response)
        }
        if (approvalConditions.data.length > 0) {
            const approvalTable = await page.getByTestId('approval-conditions-table');

            const tableRows = await approvalTable.locator('tbody>tr')

            for (let index = 0; index < approvalConditions.data.length; index++) {
                const row = await tableRows.nth(index)
                await expect(row).toContainText(approvalConditions.data[index].name)
            }
        }

    })

})