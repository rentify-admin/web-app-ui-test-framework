
import { test, expect } from '@playwright/test';
import loginForm from './utils/login-form';
import { admin } from './test_config';
import { navigateToSessionById, searchSessionWithText } from './utils/report-page';
import { waitForJsonResponse } from './utils/wait-response';

const appName = 'Heartbeat Test - Financial';

test.describe('create_multiple_remarks.spec', () => {

    test('Should allow creating multiple remarks successfully', {
        tag: ['@core', '@smoke', '@regression'],
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
        await page.getByRole('textbox', { name: 'Enter your remark here...' }).fill(remarks.r1);
        await page.getByTestId('add-comment-modal').getByRole('button', { name: 'Add Remark' }).click();
        await page.waitForTimeout(1000);

        await page.getByRole('button', { name: 'Add Remark' }).click();
        await page.getByRole('textbox', { name: 'Enter your remark here...' }).fill(remarks.r2);
        await page.getByTestId('add-comment-modal').getByRole('button', { name: 'Add Remark' }).click();
        await page.waitForTimeout(1000);

        await page.getByRole('button', { name: 'Add Remark' }).click();
        await page.getByRole('textbox', { name: 'Enter your remark here...' }).fill(remarks.r3);
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

        const comments = await waitForJsonResponse(commentResponse)

        for (let index = 0; index < Object.values(remarks).length; index++) {
            const element = Object.values(remarks)[index];
            expect(element).toBe(comments.data[index].comment)
            expect(comments.data[index]?.comment?.author?.user?.email).toBe(admin.email);
        }

        await expect(page.getByText(remarks.r1)).toBeVisible();
        await expect(page.getByText(remarks.r2)).toBeVisible();
        await expect(page.getByText(remarks.r3)).toBeVisible();
        await page.getByTestId('close-income-reviews-modal').click();
        await page.getByTestId('income-source-details-cancel').click();
    });
});
