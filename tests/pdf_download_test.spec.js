import { test, expect } from '@playwright/test';
import loginForm from '~/tests/utils/login-form';
import { staff } from '~/tests/test_config';
import { searchSessionWithText, navigateToSessionById, checkExportPdf } from '~/tests/utils/report-page';

// Test: PDF Download functionality
// Original Selenium test: "09 - PDF Download"

test.describe('pdf_download_test', () => {
    test('Should successfully export PDF for an application', { 
        tag: ['@core'],
    }, async ({ page, context }) => {
        // Step 1-5: Login as staff user
        await page.goto('https://dev.verifast.app/');
        await loginForm.fill(page, staff);
        await loginForm.submit(page);
        await expect(page.getByTestId('applicants-menu')).toBeVisible();

        // Step 6-7: Search for specific application
        const sessions = await searchSessionWithText(page, 'autotest PDF Download');

        // Get the session ID from the search results
        expect(sessions).toBeTruthy();
        expect(sessions.length).toBeGreaterThan(0);
        const sessionId = sessions[0].id;

        // Step 8: Navigate to the session using the proper utility function
        await navigateToSessionById(page, sessionId);

        // Step 9: Wait for session to be fully loaded
        await page.waitForTimeout(1000);

        // Step 10-12: Export PDF using existing utility function
        await checkExportPdf(page, context, sessionId);
    });
}); 
