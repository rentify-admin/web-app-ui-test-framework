import { test, expect } from '@playwright/test';
import loginForm from '~/tests/utils/login-form';
import { checkExportPdf } from '~/tests/utils/report-page';
import { createPermissionTestSession } from '~/tests/utils/session-generator';
import { cleanupSessionAndContexts } from '~/tests/utils/cleanup-helper';

// Test: PDF Download functionality
// Original Selenium test: "09 - PDF Download"

// Global state for session
let sharedSessionId = null;
let applicantContextForCleanup = null;
let adminContextForCleanup = null;
let allTestsPassed = true;

test.describe('pdf_download_test', () => {
    
    // ✅ Create minimal session ONCE (just creation, no steps)
    test.beforeAll(async ({ browser }) => {
        test.setTimeout(300000);
        
        console.log('🏗️ Creating minimal session for PDF export test...');
        
        const adminContext = await browser.newContext();
        const adminPage = await adminContext.newPage();
        await adminPage.goto('/');
        
        const { sessionId, applicantContext } = await createPermissionTestSession(adminPage, browser, {
            applicationName: 'Autotest - UI permissions tests',
            firstName: 'PDFTest',
            lastName: 'Export',
            email: `pdf-test-${Date.now()}@verifast.com`,
            rentBudget: '2500',
            // ✅ Minimal session - just created, no steps completed
            completeIdentity: false,
            completeFinancial: false,
            completeEmployment: false,
            addChildApplicant: false
        });
        
        sharedSessionId = sessionId;
        console.log('✅ Minimal session created:', sessionId);
        
        await adminPage.close();
        adminContextForCleanup = adminContext;
        applicantContextForCleanup = applicantContext;
    });
    
    test('Should successfully export PDF for an application', { 
        tag: ['@core', '@regression', '@staging-ready', '@rc-ready'],
    }, async ({ context }) => {
        try {
            if (!sharedSessionId) {
                throw new Error('Session must be created in beforeAll');
            }
            
            if (!adminContextForCleanup) {
                throw new Error('Admin context must be available from beforeAll');
            }

            // ✅ Create new page from existing admin context (already authenticated)
            console.log('📄 Creating page from authenticated admin context...');
            const page = await adminContextForCleanup.newPage();
            console.log('✅ Admin context is already authenticated with cookies');

            // Step 1: Navigate directly to session detail page (no login needed - context has cookies)
            console.log(`📄 Navigating directly to session ${sharedSessionId}...`);
            await page.goto(`/applicants/applicants/${sharedSessionId}`);
            // Wait for Alert button to be visible (indicates report page is loaded)
            // Note: household-status-alert is only visible inside the Alert modal, so we wait for the button instead
            // Use flexible text matching since button shows count (e.g., "5 Alerts")
            await expect(page.getByRole('button', { name: /alert/i })).toBeVisible({ timeout: 10_000 });
            console.log('✅ Session page loaded (using admin authentication from context)');

            // Step 2: Export PDF using existing utility function
            console.log(`📄 Exporting PDF for session ${sharedSessionId}...`);
            await checkExportPdf(page, context, sharedSessionId);
            console.log(`✅ PDF exported successfully from session ${sharedSessionId}`);
            
            // Clean up the page we created
            await page.close();
            
        } catch (error) {
            allTestsPassed = false;
            throw error;
        }
    });
    
    // ✅ Centralized cleanup
    test.afterAll(async ({ request }) => {
        await cleanupSessionAndContexts(
            request,
            sharedSessionId,
            applicantContextForCleanup,
            adminContextForCleanup,
            allTestsPassed
        );
    });
}); 
