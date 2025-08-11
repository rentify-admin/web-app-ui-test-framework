import { test, expect } from '@playwright/test';
import loginForm from '~/tests/utils/login-form';
import { admin } from '~/tests/test_config';
import { gotoApplicationsPage, findAndInviteApplication } from '~/tests/utils/applications-page';
import generateSessionForm from '~/tests/utils/generate-session-form';
import { 
    handleOptionalStateModal,
    uploadStatementFinancialStep,
} from '~/tests/utils/session-flow';
import { navigateToSessionById, searchSessionWithText } from '~/tests/utils/report-page';
import {
    uploadPaystubDocuments,
    verifySummaryScreen,
    verifyEmploymentSection,
    verifyIncomeSourcesSection,
    verifyReportFlags
} from '~/tests/utils/document-upload-utils';

// Test configuration
const TEST_CONFIG = {
    applicationName: 'AutoTest - Document Uploads Only',
    user: {
        email: 'playwright+document-upload@verifications.com',
        first_name: 'Document',
        last_name: 'Upload',
        password: 'password'
    },
    files: {
        paystub: 'paystub_recent.png'
    },
    expectedFlags: [
        'EMPLOYEE_NAME_MISMATCH_CRITICAL',
        'GROSS_INCOME_RATIO_EXCEEDED',
        'INCOME_SOURCE_CADENCE_MISMATCH',
        'PAY_STUB_UPLOADED'
    ]
};

/**
 * Complete basic applicant information setup
 * @param {import('@playwright/test').Page} applicantPage
 */
async function completeBasicApplicantInfo(applicantPage) {
    // Select employment status
    await applicantPage.locator('label:has-text("Employed")').click();
    await applicantPage.getByTestId('applicant-type-next-btn').click();
    await applicantPage.waitForTimeout(1000);

    // Handle state modal if it appears
    await handleOptionalStateModal(applicantPage);
    
    // Enter rent budget
    await applicantPage.locator('input[id="rent_budget"]').fill('500');
    await applicantPage.getByTestId('rent-budget-step-continue').click();

    // Skip co-applicants
    await applicantPage.getByRole('button', { name: 'Skip' }).click();

    // Skip identity verification
    await applicantPage.getByTestId('skip-id-verification-btn').click();
}

/**
 * Verify admin-side results
 * @param {import('@playwright/test').Page} page
 * @param {string} sessionId
 */
async function verifyAdminResults(page, sessionId) {
    // Navigate to applicants
    await page.getByTestId('applicants-menu').click();
    await page.getByTestId('applicants-submenu').click();

    // Find and navigate to session
    await searchSessionWithText(page, sessionId);
    await navigateToSessionById(page, sessionId);
    await page.waitForTimeout(3000);

    // Verify employment section
    await verifyEmploymentSection(page, {
        cadence: 'BIWEEKLY',
        employer: 'PERSIMMON TECHNOLOGIES CORPORATION',
        count: '1'
    });

    // Verify income sources
    await verifyIncomeSourcesSection(page);

    // Verify report flags
    await verifyReportFlags(page, TEST_CONFIG.expectedFlags);
} 

test.describe('document_upload_verifications_core_flow', () => {
    test.describe.configure({ mode: 'default' });

    test.skip('Should complete document upload verification flow', {
        tag: ['@core', '@document-upload'],
    }, async ({ browser, page }) => {
        //Big time out due the file upload process
        test.setTimeout(260000);
        
        // Step 1: Admin Setup
        await loginForm.adminLoginAndNavigate(page, admin);
        await findAndInviteApplication(page, TEST_CONFIG.applicationName);

        // Step 2: Generate Session
        const { sessionId, link } = await generateSessionForm.generateSessionAndExtractLink(page, TEST_CONFIG.user);

        // Step 3: Applicant Flow
        const context = await browser.newContext();
        const applicantPage = await context.newPage();
        await applicantPage.goto(link);

        // Step 4: Complete Basic Applicant Information
        await completeBasicApplicantInfo(applicantPage);

        // Step 5: Upload Financial Document
        await uploadStatementFinancialStep(applicantPage, 'test_bank_statement.pdf');

        // Step 6: Upload Paystub Documents
        await uploadPaystubDocuments(applicantPage, TEST_CONFIG.files.paystub);

        // Step 7: Verify Summary Screen
        await verifySummaryScreen(applicantPage);

        // Step 8: Close Applicant Context
        await applicantPage.close();

        // Step 9: Admin Verification
        await verifyAdminResults(page, sessionId);
        
        
    });
});

