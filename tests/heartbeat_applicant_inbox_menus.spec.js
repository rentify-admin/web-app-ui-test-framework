import { test, expect } from '@playwright/test';
import loginForm from './utils/login-form';
import { admin } from './test_config';
import { waitForJsonResponse } from './utils/wait-response';
import { customUrlDecode } from './utils/helper';


test.describe('heartbeat-applicant-inbox-menus.spec', () => {

    test('Should check Applicant Inbox heartbeat', {
        tag: ['@core', '@smoke', '@regression', '@critical', '@staging-ready', '@rc-ready'],
    }, async ({ page }) => {

        await page.goto('/');
        await loginForm.fill(page, admin);
        await loginForm.submit(page);
        // loginForm.submit() already waits for page to be ready (side-panel and sessions loaded)

        const inboxMenu = await page.getByTestId('applicants-menu');

        const isInboxExpanded = await inboxMenu.evaluate(element => element.classList.contains('sidebar-item-open'));

        if (!isInboxExpanded) {
            await inboxMenu.click()
        }

        const allMenu = await page.getByTestId('applicants-submenu');
        const isAllmenuActive = await allMenu.evaluate(item => item.classList.contains('sidebar-active'))

        let sessions = [];
        // Helper predicate: matches /sessions GET requests that don't filter by approval_status
        const matchesAllSessionsRequest = (resp) => {
            if (!resp.url().includes('/sessions?') || resp.request().method() !== 'GET' || !resp.ok()) {
                return false;
            }
            try {
                const decodedUrl = customUrlDecode(resp.url());
                const link = new URL(decodedUrl);
                const params = new URLSearchParams(link.search);
                const filtersParam = params.get('filters');
                
                // If no filters param, it's the "all" sessions request (no approval_status filter)
                if (!filtersParam) {
                    return true;
                }
                
                // Decode URL-encoded filters JSON and check it doesn't filter by approval_status
                const filtersStr = decodeURIComponent(filtersParam);
                return !filtersStr.includes('approval_status');
            } catch (e) {
                // If parsing fails, be conservative and don't match
                return false;
            }
        };

        // If "All" menu is already active, deselect it first by clicking another submenu
        // Then click "All" again to trigger a fresh API call
        if (isAllmenuActive) {
            const requireReviewMenu = await page.getByTestId('approval-status-submenu');
            // If "Requires Review" menu is visible, click it to deselect "All"
            if (await requireReviewMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
                await requireReviewMenu.click();
                await page.waitForTimeout(500); // Brief wait for UI to update
            } else {
                // If "Requires Review" is not available, try clicking "All" to toggle it off
                // This might work if the menu supports toggle behavior
                await allMenu.click();
                await page.waitForTimeout(500);
            }
        }

        // Now click "All" menu to trigger a fresh API call
        const [response] = await Promise.all([
            page.waitForResponse(matchesAllSessionsRequest, { timeout: 30_000 }),
            allMenu.click()
        ])
        sessions = await waitForJsonResponse(response)

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
                    const filters = params.get('filters') && JSON.parse(params.get('filters')) || {};
                    
                    // Check for the correct structure: $and → $has → flags → $and
                    const hasErrorFlags = filters?.$and?.some(condition => {
                        const flagsCondition = condition?.$has?.flags?.$and;
                        return flagsCondition && 
                               flagsCondition.some(f => f.ignored?.$eq === 0) && 
                               flagsCondition.some(f => f.severity === 'ERROR');
                    });
                    
                    return resp.url().includes('/sessions?')
                        && hasErrorFlags
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