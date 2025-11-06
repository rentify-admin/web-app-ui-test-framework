import { test, expect } from '@playwright/test';
import loginForm from '~/tests/utils/login-form';
import { checkExportPdf } from '~/tests/utils/report-page';
import { waitForJsonResponse } from '~/tests/utils/wait-response';

// Test: PDF Download functionality
// Original Selenium test: "09 - PDF Download"

test.describe('pdf_download_test', () => {
    test('Should successfully export PDF for an application', { 
        tag: ['@core', '@regression', '@staging-correct', '@staging-ready'],
    }, async ({ page, context }) => {
        // Staff user credentials for testing
        const staff = {
            email: 'staff+testing@verifast.com',
            password: 'password'
        };

        // Step 1: Login as staff user - uses baseURL from config (dev or staging)
        await page.goto('/');
        await loginForm.fill(page, staff);
        await loginForm.submitAndSetLocale(page);
        await expect(page.getByTestId('applicants-menu')).toBeVisible();

        // Step 2: Reload to get fresh sessions list
        const [sessionsResponse] = await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/sessions?fields[session]=')
                && resp.request().method() === 'GET'
                && resp.ok()
            ),
            page.reload()
        ]);

        const { data: sessions } = await waitForJsonResponse(sessionsResponse);
        
        expect(sessions).toBeTruthy();
        expect(sessions.length).toBeGreaterThan(0);
        console.log(`📊 Found ${sessions.length} sessions, will try first 4`);

        // Step 3: Try first 4 sessions to find one with export available
        const maxAttempts = Math.min(4, sessions.length);
        let pdfExported = false;

        for (let i = 0; i < maxAttempts; i++) {
            const session = sessions[i];
            console.log(`\n🔍 Attempt ${i + 1}/${maxAttempts}: Trying session ${session.id}`);

            try {
                // Find session card using data-session attribute
                const sessionCard = page.locator(`.application-card[data-session="${session.id}"]`);
                await expect(sessionCard).toBeVisible({ timeout: 5000 });
                
                // Click the link inside the session card and reload to ensure fresh data
                const sessionLink = sessionCard.locator('a').first();
                await sessionLink.click();
                await page.waitForTimeout(500);
                
                // Reload to get fresh session data (handles case where session is already selected)
                await Promise.all([
                    page.waitForResponse(resp => resp.url().includes(`/sessions/${session.id}`)
                        && resp.request().method() === 'GET'
                        && resp.ok()
                    ),
                    page.reload()
                ]);

                await page.waitForTimeout(1000); // Wait for session to fully load

                // Check if export button is available
                const exportBtn = page.getByTestId('export-session-btn');
                const actionBtn = page.getByTestId('session-action-btn');
                
                // Try to make export button visible
                if (!await exportBtn.isVisible()) {
                    if (await actionBtn.isVisible()) {
                        await actionBtn.click();
                        await page.waitForTimeout(600);
                    }
                }

                // Check if export is now available
                if (await exportBtn.isVisible({ timeout: 2000 })) {
                    console.log(`✅ Session ${session.id} has export available - proceeding with PDF export`);
                    
                    // Export PDF using existing utility function
                    await checkExportPdf(page, context, session.id);
                    pdfExported = true;
                    console.log(`🎉 PDF exported successfully from session ${session.id}`);
                    break;
                } else {
                    console.log(`⏭️  Session ${session.id} doesn't have export available, trying next...`);
                    
                    // Go back to sessions list
                    await page.getByTestId('applicants-submenu').click();
                    await page.waitForTimeout(1000);
                }
            } catch (error) {
                console.log(`⚠️  Error with session ${session.id}: ${error.message}`);
                // Try to go back to sessions list
                try {
                    await page.getByTestId('applicants-submenu').click();
                    await page.waitForTimeout(1000);
                } catch (navError) {
                    console.log(`⚠️  Could not navigate back: ${navError.message}`);
                }
            }
        }

        // Verify that we successfully exported a PDF
        if (!pdfExported) {
            throw new Error(`Could not find a session with export available in first ${maxAttempts} sessions`);
        }
    });
}); 
