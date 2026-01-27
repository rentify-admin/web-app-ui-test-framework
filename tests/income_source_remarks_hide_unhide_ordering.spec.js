
import { test, expect } from '@playwright/test';
import loginForm from './utils/login-form';
import { admin, app } from './test_config';
import { navigateToSessionById, searchSessionWithText } from './utils/report-page';
import { waitForJsonResponse } from './utils/wait-response';
import { findAndInviteApplication, gotoApplicationsPage } from './utils/applications-page';
import generateSessionForm from './utils/generate-session-form';
import { setupInviteLinkSession, simulatorFinancialStepWithVeridocs, updateRentBudget, handleSkipReasonModal } from './utils/session-flow';
import { joinUrl } from './utils/helper';
import { veriDocsBankStatementData } from './mock-data/bank-statement-veridocs-payload';
import { cleanupSessionAndContexts } from './utils/cleanup-helper';

const appName = 'Autotest - Heartbeat Test - Financial';

test.describe('QA-191:create_multiple_remarks.spec', () => {
    // Global state for cleanup
    let sessionId = null;
    let applicantCtx = null;
    let allTestsPassed = true;

    test('Verify Income Source Remarks Creation, Ordering, and Hide/Unhide Functionality', {
        tag: ['@core', '@smoke', '@regression', '@staging-ready', '@rc-ready'],
        timeout: 180_000
    }, async ({ page, context }) => {
        try {
            let adminToken, link;

            adminToken = await loginForm.adminLoginAndNavigate(page, admin);
            await expect(adminToken).toBeDefined();
            console.log('✅ Admin token captured for API calls');

            await gotoApplicationsPage(page);

            await findAndInviteApplication(page, appName);


            const userData = {
                email: 'playwright+remarks@verifast.com',
                first_name: 'Remarks',
                last_name: 'Primary',
                password: 'password'
            }
            const payload = veriDocsBankStatementData(userData);

            const sessionData = await generateSessionForm.generateSessionAndExtractLink(page, userData);

            sessionId = sessionData.sessionId;
            link = sessionData.link;

            applicantCtx = await context.browser().newContext();
            const applicantPage = await applicantCtx.newPage();
            const inviteUrl = new URL(link);
            await applicantPage.goto(joinUrl(app.urls.app, `${inviteUrl.pathname}${inviteUrl.search}`));

            // Setup session flow (no applicant type)
            await setupInviteLinkSession(applicantPage);

            await updateRentBudget(applicantPage, sessionId);

            // Skip question step
            await expect(applicantPage.getByTestId('pre-screening-step')).toBeVisible();
            await applicantPage.getByTestId('pre-screening-skip-btn').click();
            await handleSkipReasonModal(applicantPage, "Skipping pre-screening step for test purposes");

            await simulatorFinancialStepWithVeridocs(applicantPage, payload)

            await page.bringToFront();

            await page.getByTestId('applicants-menu').click();
            await page.getByTestId('applicants-submenu').click();

            // household-status-alert is only visible inside the Alert/View Details modal, not on the list page.
            // searchSessionWithText already waits for the search input to be ready, which indicates the page is loaded.
            await searchSessionWithText(page, sessionId);

            // const sessionTile = await page.locator('.application-card').first();

            // const sessionID = await sessionTile.getAttribute('data-session');

            await navigateToSessionById(page, sessionId);


            const remarks = {
                r3: `R3 - third remark – ${new Date().toISOString()}`,
                r2: `R2 - second remark – ${new Date().toISOString()}`,
                r1: `R1 - first remark – ${new Date().toISOString()}`,

            }

            await page.getByTestId('income-source-section-header').click();
            await page.getByTestId('income-source-detail-btn').first().click();

            await page.getByRole('button', { name: 'Add Note' }).click();
            await page.getByTestId('add-comment-modal').getByRole('textbox', { name: 'Enter your note here...' }).fill(remarks.r1);
            await page.getByTestId('add-comment-modal').getByRole('button', { name: 'Add Note' }).click();
            await page.waitForTimeout(1000);

            await page.getByRole('button', { name: 'Add Note' }).click();
            await page.getByTestId('add-comment-modal').getByRole('textbox', { name: 'Enter your note here...' }).fill(remarks.r2);
            await page.getByTestId('add-comment-modal').getByRole('button', { name: 'Add Note' }).click();
            await page.waitForTimeout(1000);

            await page.getByRole('button', { name: 'Add Note' }).click();
            await page.getByTestId('add-comment-modal').getByRole('textbox', { name: 'Enter your note here...' }).fill(remarks.r3);
            await page.getByTestId('add-comment-modal').getByRole('button', { name: 'Add Note' }).click();
            await page.waitForTimeout(1000);

            const [commentResponse] = await Promise.all([
                page.waitForResponse(resp =>
                    resp.url().match(
                        new RegExp(`/income-sources/([\\w-]+)/comments\\?order=created_at:desc&limit=20&page=1&fields\\[income_source\\]=comments&fields\\[member\\]=user$`)
                    )
                    && resp.request().method() === 'GET'
                    && resp.ok()
                ),
                page.getByTestId('income-source-details').getByRole('button', { name: 'View Notes' }).click()
            ])

            let comments = await waitForJsonResponse(commentResponse)
            console.log("🚀 ~ comments:", comments)

            // Assert that each created remark is in the expected position in the response,
            // and each is authored by the current admin user
            for (let index = 0; index < Object.values(remarks).length; index++) {
                const element = Object.values(remarks)[index];
                expect(element).toBe(comments.data[index].comment)
                expect(comments.data[index]?.author?.user?.email).toBe(admin.email);
            }

            // Verify all created remarks are visible on the screen
            await expect(page.getByText(remarks.r1)).toBeVisible();
            await expect(page.getByText(remarks.r2)).toBeVisible();
            await expect(page.getByText(remarks.r3)).toBeVisible();

            // Get the review remarks modal and locate the remarks list inside the modal
            const reviewModal = await page.getByTestId('income-reviews-modal')
            // Select all child divs inside the review modal remarks list
            const reviewModalList = await reviewModal.locator('[data-testid^="remark-row"]').filter({ visible: true });

            // Confirm that the second remark (r2) appears in the correct position before hiding
            await expect(reviewModalList.nth(0)).toContainText(remarks.r3);
            await expect(reviewModalList.nth(1)).toContainText(remarks.r2);
            await expect(reviewModalList.nth(2)).toContainText(remarks.r1);

            // verify timestamp and comment and author data matched
            for (let index = 0; index < comments.data.filter(item => !item.is_hidden).length; index++) {
                const comment = comments.data[index];
                const element = await page.getByTestId(`remark-row-${comment.id}`);
                await expect(element).toBeDefined();
                console.log(formatIsoToPrettyDate(comment.created_at))
                await expect(element).toContainText(formatIsoToPrettyDate(comment.created_at))
                await expect(element).toContainText(comment.comment)
                await expect(element).toContainText(comment.author?.user?.full_name)
            }

            // Hide the second remark (r2) and wait for PATCH request confirming the hide action
            await Promise.all([
                page.waitForResponse(resp =>
                    resp.url().match(new RegExp(`/income-sources/.{36}/comments/.{36}`))
                    && resp.request().method() === 'PATCH'
                    && resp.ok()
                ),
                reviewModalList.nth(1).getByTestId('hide-comment-btn').click()
            ]);

            await page.waitForTimeout(200);

            // After hiding, check that r3 and r1 are shown, r2 should be hidden
            await expect(reviewModalList.nth(0)).toContainText(remarks.r3);
            await expect(reviewModalList.nth(1)).toContainText(remarks.r1);

            // Toggle hidden comments on: r2 (hidden) should now be visible again in the list, as hidden
            await page.getByTestId('toggle-hidden-comments-btn').click();

            // Check that the remarks list now shows the hidden r2 in the correct spot
            await expect(reviewModalList.nth(1)).toContainText(remarks.r2);

            // Toggle hidden comments off: r2 is hidden again, only r3, r1 show
            await page.getByTestId('toggle-hidden-comments-btn').click();
            await expect(reviewModalList.nth(0)).toContainText(remarks.r3);
            await expect(reviewModalList.nth(1)).toContainText(remarks.r1);

            // Toggle hidden comments on again: r3, r2, r1 should all be visible (r2 as hidden)
            await page.getByTestId('toggle-hidden-comments-btn').click();
            await expect(reviewModalList.nth(0)).toContainText(remarks.r3);
            await expect(reviewModalList.nth(1)).toContainText(remarks.r2);
            await expect(reviewModalList.nth(2)).toContainText(remarks.r1);

            // Unhide r2 and verify via PATCH, then do a final toggle to confirm all remarks are visible (none hidden)
            await Promise.all([
                page.waitForResponse(resp =>
                    resp.url().match(new RegExp(`/income-sources/.{36}/comments/.{36}`))
                    && resp.request().method() === 'PATCH'
                    && resp.ok()
                ),
                reviewModalList.nth(1).getByTestId('unhide-comment-btn').click()
            ]);
            await page.getByTestId('toggle-hidden-comments-btn').click();

            // Final: verify all remarks are visible (in the right order)
            await expect(reviewModalList.nth(0)).toContainText(remarks.r3);
            await expect(reviewModalList.nth(1)).toContainText(remarks.r2);
            await expect(reviewModalList.nth(2)).toContainText(remarks.r1);


            await page.getByTestId('close-income-reviews-modal').click();
            await page.getByTestId('income-source-details-cancel').click();
            
            console.log('✅ Multiple remarks test completed successfully');
        } catch (error) {
            console.error('❌ Test failed:', error.message);
            allTestsPassed = false;
            throw error;
        }
        // Note: Context cleanup happens in afterAll
    });
    
    // ✅ Centralized cleanup
    test.afterAll(async ({ request }) => {
        await cleanupSessionAndContexts(
            request,
            sessionId,
            applicantCtx,
            null,  // No admin context
            allTestsPassed
        );
    });
});
function formatIsoToPrettyDate(isoString) {
    const date = new Date(isoString);
    const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const day = date.getDate();
    let daySuffix = 'th';
    if (day % 10 === 1 && day !== 11) daySuffix = 'st';
    else if (day % 10 === 2 && day !== 12) daySuffix = 'nd';
    else if (day % 10 === 3 && day !== 13) daySuffix = 'rd';

    const month = months[date.getMonth()];
    const year = date.getFullYear();

    let hour = date.getHours();
    const minute = date.getMinutes();
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    hour = hour === 0 ? 12 : hour;

    return `${month} ${day}${daySuffix} ${year}, ${hour}:${minute.toString().padStart(2, '0')} ${ampm}`;
}
