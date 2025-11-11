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
        tag: ['@core', '@regression', '@staging-ready'],
    }, async ({ page, context }) => {
        try {
            if (!sharedSessionId) {
                throw new Error('Session must be created in beforeAll');
            }
            
            // Staff user credentials for testing
            const staff = {
                email: 'staff+testing@verifast.com',
                password: 'password'
            };

            // Step 1: Login as staff user
            await page.goto('/');
            await loginForm.fill(page, staff);
            await loginForm.submitAndSetLocale(page);
            await expect(page.getByTestId('applicants-menu')).toBeVisible();

            // Step 2: Navigate directly to session detail page (skip searching in list)
            console.log(`📄 Navigating directly to session ${sharedSessionId}...`);
            await page.goto(`/applicants/applicants/${sharedSessionId}`);
            await expect(page.getByTestId('household-status-alert')).toBeVisible({ timeout: 10_000 });
            console.log('✅ Session page loaded');

            // Step 3: Export PDF using existing utility function
            console.log(`📄 Exporting PDF for session ${sharedSessionId}...`);
            await checkExportPdf(page, context, sharedSessionId);
            console.log(`✅ PDF exported successfully from session ${sharedSessionId}`);
            
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
