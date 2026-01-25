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
                // Handle both encoded and decoded URLs
                let urlToParse = resp.url();
                
                // Try to decode if needed
                try {
                    urlToParse = customUrlDecode(urlToParse);
                } catch {
                    // If decoding fails, use original URL
                }
                
                const link = new URL(urlToParse);
                const params = new URLSearchParams(link.search);
                const filtersParam = params.get('filters');
                
                // If no filters param, it's the "all" sessions request (no approval_status filter)
                if (!filtersParam) {
                    return true;
                }
                
                // Decode URL-encoded filters JSON and check it doesn't filter by approval_status
                let filtersStr;
                try {
                    filtersStr = decodeURIComponent(filtersParam);
                } catch {
                    // If decoding fails, use the param as-is
                    filtersStr = filtersParam;
                }
                
                // Check that filters don't include approval_status
                // The "All" menu should have filters like: {"$and":[{"$hasnt":"parent"}]}
                // which doesn't include approval_status
                return !filtersStr.includes('approval_status');
            } catch (e) {
                // If parsing fails, be conservative and don't match
                console.log('⚠️ Error parsing URL in matchesAllSessionsRequest:', e.message, resp.url());
                return false;
            }
        };

        // If "All" menu is already active, deselect it first by clicking another submenu
        // Then click "All" again to trigger a fresh API call
        if (isAllmenuActive) {
            const requireReviewMenu = await page.getByTestId('approval-status-submenu');
            // If "Requires Review" menu is visible, click it to deselect "All"
            if (await requireReviewMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
                // Wait for response when clicking "Requires Review" to ensure state change
                await Promise.all([
                    page.waitForResponse(resp => 
                        resp.url().includes('/sessions?') && 
                        resp.request().method() === 'GET' && 
                        resp.ok(),
                        { timeout: 10_000 }
                    ).catch(() => {}), // Ignore if no response (might already be loaded)
                    requireReviewMenu.click()
                ]);
                await page.waitForTimeout(1000); // Wait for UI to update
            } else {
                // If "Requires Review" is not available, try clicking "All" to toggle it off
                // This might work if the menu supports toggle behavior
                await allMenu.click();
                await page.waitForTimeout(1000);
            }
        }

        // Verify "All" menu is not active before clicking (to ensure click triggers a request)
        const isAllActiveBeforeClick = await allMenu.evaluate(item => item.classList.contains('sidebar-active'));
        if (isAllActiveBeforeClick && isAllmenuActive) {
            // If still active after deselecting, wait a bit more for UI to update
            await page.waitForTimeout(500);
        }
        
        // Wait for network to be idle to ensure no pending requests interfere
        await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {
            // Ignore if network doesn't become idle (some requests might be pending)
            console.log('⚠️ Network did not become idle, proceeding anyway...');
        });
        
        // Set up response listener BEFORE clicking to ensure we catch the request
        console.log('🔍 Setting up response listener for "All" sessions request...');
        const responsePromise = page.waitForResponse(matchesAllSessionsRequest, { timeout: 30_000 });
        
        // Small delay to ensure response listener is set up
        await page.waitForTimeout(100);
        
        // Click "All" menu to trigger a fresh API call
        console.log('🖱️ Clicking "All" menu...');
        await allMenu.click();
        
        // Wait for the response
        console.log('⏳ Waiting for sessions API response...');
        let response;
        try {
            response = await responsePromise;
            console.log('✅ Received sessions API response:', response.url());
        } catch (error) {
            console.error('❌ Timeout waiting for sessions API response');
            console.error('   Error:', error.message);
            // Log all recent responses to help debug
            console.log('   Checking if response was already completed...');
            throw error;
        }
        
        sessions = await waitForJsonResponse(response)

        // ✅ FIX: UI uses cursor pagination with default limit of 12 sessions per page
        // Only verify sessions that are actually rendered in the UI (first page)
        // Extract limit from API response URL or use default of 12
        const responseUrl = response.url();
        const urlParams = new URLSearchParams(new URL(responseUrl).search);
        const limit = parseInt(urlParams.get('limit')) || 12;
        const sessionsToVerify = sessions.data.slice(0, limit);

        console.log(`📊 Verifying ${sessionsToVerify.length} sessions (limit: ${limit}, total in response: ${sessions.data.length})`);

        for (let index = 0; index < sessionsToVerify.length; index++) {
            const session = sessionsToVerify[index];
            // Use a more robust locator that can find sessions even in collapsed date groups
            const sessionCard = page.locator(`.application-card[data-session="${session.id}"]`);
            
            // Wait for the card to be visible, with scrolling if needed
            await sessionCard.scrollIntoViewIfNeeded();
            await expect(sessionCard).toBeVisible({ timeout: 10_000 });
        }

        const requireReviewMenu = await page.getByTestId('approval-status-submenu');

        if (await requireReviewMenu.isVisible()) {
            const [requireReviewResponse] = await Promise.all([
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
            sessions = await waitForJsonResponse(requireReviewResponse)
        }

        if (sessions && sessions.data && sessions.data.length > 0) {
            // ✅ FIX: Only verify sessions that are actually rendered (first page, limit 12)
            const limit2 = 12; // Default limit from useSessions.js
            const sessionsToVerify2 = sessions.data.slice(0, limit2);

            console.log(`📊 Verifying ${sessionsToVerify2.length} sessions from "Requires Review" (limit: ${limit2}, total: ${sessions.data.length})`);

            for (let index = 0; index < sessionsToVerify2.length; index++) {
                const session = sessionsToVerify2[index];
                const sessionCard = page.locator(`.application-card[data-session="${session.id}"]`);
                await sessionCard.scrollIntoViewIfNeeded();
                await expect(sessionCard).toBeVisible({ timeout: 10_000 });
            }
        }

        const meetCriteriaMenu = await page.getByTestId('reviewed-submenu');

        if (await meetCriteriaMenu.isVisible()) {
            const [meetCriteriaResponse] = await Promise.all([
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
            sessions = await waitForJsonResponse(meetCriteriaResponse)
        }

        if (sessions && sessions.data && sessions.data.length > 0) {
            // ✅ FIX: Only verify sessions that are actually rendered (first page, limit 12)
            const limit3 = 12; // Default limit from useSessions.js
            const sessionsToVerify3 = sessions.data.slice(0, limit3);

            console.log(`📊 Verifying ${sessionsToVerify3.length} sessions from "Meet Criteria" (limit: ${limit3}, total: ${sessions.data.length})`);

            for (let index = 0; index < sessionsToVerify3.length; index++) {
                const session = sessionsToVerify3[index];
                const sessionCard = page.locator(`.application-card[data-session="${session.id}"]`);
                await sessionCard.scrollIntoViewIfNeeded();
                await expect(sessionCard).toBeVisible({ timeout: 10_000 });
            }
        }

        const rejectedMenu = await page.getByTestId('rejected-submenu');

        if (await rejectedMenu.isVisible()) {
            const [rejectedResponse] = await Promise.all([
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
            sessions = await waitForJsonResponse(rejectedResponse)
        }

        if (sessions && sessions.data && sessions.data.length > 0) {
            // ✅ FIX: Only verify sessions that are actually rendered (first page, limit 12)
            const limit4 = 12; // Default limit from useSessions.js
            const sessionsToVerify4 = sessions.data.slice(0, limit4);

            console.log(`📊 Verifying ${sessionsToVerify4.length} sessions from "Rejected" (limit: ${limit4}, total: ${sessions.data.length})`);

            for (let index = 0; index < sessionsToVerify4.length; index++) {
                const session = sessionsToVerify4[index];
                const sessionCard = page.locator(`.application-card[data-session="${session.id}"]`);
                await sessionCard.scrollIntoViewIfNeeded();
                await expect(sessionCard).toBeVisible({ timeout: 10_000 });
            }
        }

    })

})