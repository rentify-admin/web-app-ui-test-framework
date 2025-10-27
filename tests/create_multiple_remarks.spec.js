
import { test, expect } from '@playwright/test';
import loginForm from './utils/login-form';
import { admin } from './test_config';
import { navigateToSessionById, searchSessionWithText } from './utils/report-page';
import { waitForJsonResponse } from './utils/wait-response';

const appName = 'Heartbeat Test - Financial';

test.describe('QA-191:create_multiple_remarks.spec', () => {

    test('Should allow creating multiple remarks successfully', {
        tag: ['@core', '@smoke', '@regression'],
        timeout: 180_000
    }, async ({ page }) => {
        await page.goto('/');
        await loginForm.fill(page, admin);
        await loginForm.submit(page);

        await expect(page.getByTestId('household-status-alert')).toBeVisible({ timeout: 10_000 });

        await searchSessionWithText(page, appName);

        const sessionTile = await page.locator('.application-card').first();

        const sessionID = await sessionTile.getAttribute('data-session');

        await navigateToSessionById(page, sessionID);

        const remarks = {
            r3: `R3 - third remark – ${new Date().toISOString()}`,
            r2: `R2 - second remark – ${new Date().toISOString()}`,
            r1: `R1 - first remark – ${new Date().toISOString()}`,

        }

        await page.getByTestId('income-source-section-header').click();
        await page.getByTestId('income-source-detail-btn').first().click();

        await page.getByRole('button', { name: 'Add Remark' }).click();
        await page.getByTestId('add-comment-modal').getByRole('textbox', { name: 'Enter your remark here...' }).fill(remarks.r1);
        await page.getByTestId('add-comment-modal').getByRole('button', { name: 'Add Remark' }).click();
        await page.waitForTimeout(1000);

        await page.getByRole('button', { name: 'Add Remark' }).click();
        await page.getByTestId('add-comment-modal').getByRole('textbox', { name: 'Enter your remark here...' }).fill(remarks.r2);
        await page.getByTestId('add-comment-modal').getByRole('button', { name: 'Add Remark' }).click();
        await page.waitForTimeout(1000);

        await page.getByRole('button', { name: 'Add Remark' }).click();
        await page.getByTestId('add-comment-modal').getByRole('textbox', { name: 'Enter your remark here...' }).fill(remarks.r3);
        await page.getByTestId('add-comment-modal').getByRole('button', { name: 'Add Remark' }).click();
        await page.waitForTimeout(1000);

        const [commentResponse] = await Promise.all([
            page.waitForResponse(resp =>
                resp.url().match(
                    new RegExp(`/income-sources/([\\w-]+)/comments\\?order=created_at:desc&limit=20&page=1&fields\\[income_source\\]=comments&fields\\[member\\]=user$`)
                )
                && resp.request().method() === 'GET'
                && resp.ok()
            ),
            page.getByTestId('income-source-details').getByRole('button', { name: 'View Remarks' }).click()
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
