import { test, expect } from '@playwright/test';
import loginForm from './utils/login-form';
import { admin } from './test_config';
import { waitForJsonResponse } from './utils/wait-response';
import { customUrlDecode } from './utils/helper';


test.describe('heartbeat-applicant-inbox-menus.spec', () => {

    test('Should check Applicant Inbox heartbeat', {
        tag: ['@core', '@smoke', '@regression'],
    }, async ({ page }) => {

        await page.goto('/');
        await loginForm.fill(page, admin);
        await loginForm.submit(page);
        await expect(page.getByTestId('household-status-alert')).toBeVisible({ timeout: 10_000 });

        const inboxMenu = await page.getByTestId('applicants-menu');

        const isInboxExpanded = await inboxMenu.evaluate(element => element.classList.contains('sidebar-item-open'));

        if (!isInboxExpanded) {
            await inboxMenu.click()
        }

        const allMenu = await page.getByTestId('applicants-submenu');
        const isAllmenuActive = await allMenu.evaluate(item => item.classList.contains('sidebar-active'))

        let sessions = [];
        if (!isAllmenuActive) {
            const [response] = await Promise.all([
                page.waitForResponse(resp => {
                    const link = new URL(customUrlDecode(resp.url()))
                    const params = new URLSearchParams(link.search)
                    return resp.url().includes('/sessions?')
                        && !params.get('filters').includes('approval_status')
                        && resp.request().method() === 'GET'
                        && resp.ok()
                }),
                allMenu.click()
            ])
            sessions = await waitForJsonResponse(response)
        } else {
            const [response] = await Promise.all([
                page.waitForResponse(resp => {
                    const link = new URL(customUrlDecode(resp.url()))
                    const params = new URLSearchParams(link.search)
                    return resp.url().includes('/sessions?')
                        && !params.get('filters').includes('approval_status')
                        && resp.request().method() === 'GET'
                        && resp.ok()
                }),
                page.reload()
            ])
            sessions = await waitForJsonResponse(response)
        }

        for (let index = 0; index < sessions.data.length; index++) {
            const session = sessions.data[index];
            await expect(page.locator(`.application-card[data-session="${session.id}"]`)).toBeVisible({ timeout: 10_000 });
        }

        const requireReviewMenu = await page.getByTestId('approval-status-submenu');

        if (await requireReviewMenu.isVisible()) {
            const [response] = await Promise.all([
                page.waitForResponse(resp => {
                    const link = new URL(resp.url())
                    const params = new URLSearchParams(link.search)
                    return resp.url().includes('/sessions?')
                        && params.get('filters').includes('"awaiting_review"')
                        && resp.request().method() === 'GET'
                        && resp.ok()
                }),
                requireReviewMenu.click()
            ])
            sessions = await waitForJsonResponse(response)
        }


        for (let index = 0; index < sessions.data.length; index++) {
            const session = sessions.data[index];
            await expect(page.locator(`.application-card[data-session="${session.id}"]`)).toBeVisible({ timeout: 10_000 });
        }

        const meetCriteriaMenu = await page.getByTestId('reviewed-submenu');

        if (await meetCriteriaMenu.isVisible()) {
            const [response] = await Promise.all([
                page.waitForResponse(resp => {
                    const link = new URL(resp.url())
                    const params = new URLSearchParams(link.search)
                    return resp.url().includes('/sessions?')
                        && params.get('filters').includes('"approved"')
                        && params.get('filters').includes('"conditionally_approved"')
                        && resp.request().method() === 'GET'
                        && resp.ok()
                }),
                meetCriteriaMenu.click()
            ])
            sessions = await waitForJsonResponse(response)
        }


        for (let index = 0; index < sessions.data.length; index++) {
            const session = sessions.data[index];
            await expect(page.locator(`.application-card[data-session="${session.id}"]`)).toBeVisible({ timeout: 10_000 });
        }


        const rejectedMenu = await page.getByTestId('rejected-submenu');

        if (await rejectedMenu.isVisible()) {
            const [response] = await Promise.all([
                page.waitForResponse(resp => {
                    const link = new URL(resp.url())
                    const params = new URLSearchParams(link.search)
                    return resp.url().includes('/sessions?')
                        && params.get('filters').includes('"rejected"')
                        && resp.request().method() === 'GET'
                        && resp.ok()
                }),
                rejectedMenu.click()
            ])
            sessions = await waitForJsonResponse(response)
        }


        for (let index = 0; index < sessions.data.length; index++) {
            const session = sessions.data[index];
            await expect(page.locator(`.application-card[data-session="${session.id}"]`)).toBeVisible({ timeout: 10_000 });
        }

    })

})