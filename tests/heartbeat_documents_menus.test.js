import { test, expect } from '@playwright/test';
import loginForm from './utils/login-form';
import { admin } from './test_config';
import { waitForJsonResponse } from './utils/wait-response';
import { customUrlDecode } from './utils/helper';


test.describe('heartbeat_documents_menus.spec', () => {

    test('Should check Documents menu heartbeat', {
        tag: ['@core', '@smoke', '@regression'],
    }, async ({ page }) => {

        await page.goto('/');
        await loginForm.fill(page, admin);
        await loginForm.submit(page);
        await expect(page.getByTestId('household-status-alert')).toBeVisible({ timeout: 10_000 });

        const documentsMenus = await page.getByTestId('documents-menu');

        const isDocumentsExpanded = await documentsMenus.evaluate(element => element.classList.contains('sidebar-item-open'));

        if (!isDocumentsExpanded) {
            await documentsMenus.click()
        }

        // verifying documents page
        const documentSubMenu = await page.getByTestId('documents-submenu');
        const isDocumentSubMenuActive = await documentSubMenu.evaluate(item => item.classList.contains('sidebar-active'))
        await documentSubMenu.click()
        // Commented because coming soon page appears here...
        /*
        let documents = [];
        if (!isDocumentSubMenuActive) {
            const [response] = await Promise.all([
                page.waitForResponse(resp => {
                    return resp.url().includes('/documents?')
                        && resp.request().method() === 'GET'
                        && resp.ok()
                }),
                documentSubMenu.click()
            ])
            documents = await waitForJsonResponse(response)
        } else {
            const [response] = await Promise.all([
                page.waitForResponse(resp => {
                    return resp.url().includes('/documents?')
                        && resp.request().method() === 'GET'
                        && resp.ok()
                }),
                page.reload()
            ])
            documents = await waitForJsonResponse(response)
        }
        if (documents.length > 0) {
            const docTable = await page.getByTestId('documents-table');
            const docTableRows = await docTable.locator('tbody>tr')
            for (let index = 0; index < await docTableRows.count(); index++) {
                const row = await docTableRows.nth(index);
                await expect(row).toContainText(documents[index].name);
            }
        }
        */

        // verifying document policies page
        const documentPolicySubmenu = await page.getByTestId('document-policies-submenu');
        let documentPolicies = []
        if (await documentPolicySubmenu.isVisible()) {
            const [response] = await Promise.all([
                page.waitForResponse(resp => {
                    return resp.url().includes('/document-policies?')
                        && resp.request().method() === 'GET'
                        && resp.ok()
                }),
                documentPolicySubmenu.click()
            ])
            documentPolicies = await waitForJsonResponse(response)
        }

        if (documentPolicies.data.length > 0) {
            const documentPolicyTableRows = await page.locator('table').locator('tbody>tr');
            for (let index = 0; index < documentPolicies.data.length; index++) {
                const row = await documentPolicyTableRows.nth(index);
                await expect(row).toContainText(documentPolicies.data[index].name);
            }
        }
    })

})