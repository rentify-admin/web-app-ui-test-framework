import { test, expect } from '@playwright/test';
import { adminLoginAndNavigateToApplications } from './utils/session-utils';
import { admin, app } from './test_config';
import { generateSessionForApplication } from './utils/applications-page';
import { getRandomEmail } from './utils/helper';
import { adminLogout } from './utils/common';
import { handleStateAndTermsCheckbox, updateRentBudget } from './utils/session-flow';
import { uploadPaystubDocuments } from './utils/document-upload-utils';
import { ApiClient } from './api';
import { openReportSection } from './utils/report-page';
import { cleanupSession } from './utils/cleanup-helper';
import { loginWithAdmin } from './endpoint-utils/auth-helper';

// When multiple paystubs are uploaded for one employer, there is a potential for duplication detection to be missed due to timing of the uploads. If payloads from veridocs for those paystubs are received with the same timestamp, it is hard for the system to differentiate that these multiple paystub documents are to be merged under one employment. This has the potential for multiple of the same employment to be generated. A employment may be generated per paystub.
// To prevent this issue, document processing is locked on session level for employment type for paystubs (per employer name) to solve for the concurrency. 1 (doc) job per session at 1 time.
/**
 * Context:
    Expected generation of employment is one employment per employer, per applicant in the household. Multiple employments for an applicant with the the exact same name needs to trigger a fail for this test.
 */
test.describe('QA-368 paystub_employment_count_validation.spec', () => {
    //FOCUS: Verify employment deduplication — a single multi-paystub PDF (3 paystubs, same employer) triggers concurrent Veridocs processing. Only 1 employment must be generated.

    const APPLICATION_NAME = 'Autotest - Employ Real File Only';
    let cleanupSessionId = null;
    const adminClient = new ApiClient(app.urls.api, null, 120_000);

    // Applicant Data
    const user = {
        first_name: 'Lydianna',
        last_name: 'J Biggs',
        email: getRandomEmail()
    }

    test('Should generate single employment per employer per applicant on single multi paystub file', async ({ page, browser }) => {
        test.setTimeout(240_000);
        // login and navigate to applications page as admin
        console.log('Logging in as admin and navigating to applications page...');
        await adminLoginAndNavigateToApplications(page, admin);
        await loginWithAdmin(adminClient);

        console.log('✅ Admin logged in and navigated to applications page');
        // generate session for application
        const { sessionData, link } = await generateSessionForApplication(page, APPLICATION_NAME, user, { prefix: false }); // Keeping the name same as document to prevent name discrepancy issues for this test
        const session = sessionData.data;
        cleanupSessionId = session.id;

        // logout from admin
        console.log('Logging out from admin account...');
        await adminLogout(page);

        // Navigate to the generated link to start the application process
        console.log('Navigating to application link to start the application process...');

        await page.goto(link);
        console.log('✅ Navigated to application link, starting application process...');

        // Complete the application flow up to employment verification
        await handleStateAndTermsCheckbox(page, session);
        console.log('✅ Completed state and terms checkbox, updating rent budget...');

        await updateRentBudget(page, session.id,  '2000');
        console.log('✅ Rent budget updated, uploading multi-paystub PDF...');

        const employmentVerificationData = await uploadPaystubDocuments(page, ['paystub_multi_3x.pdf'], { cadence: 'Bi-Weekly', waitForCompletion: false });
        expect(employmentVerificationData.data).toBeDefined();
        const verificationId = employmentVerificationData.data.id;
        let completed = false;
        for (let i = 0; i < 16; i++) {
            const verificationResponse = await adminClient.get(`/employment-verifications/${verificationId}`);
            const verification = verificationResponse.data.data;
            if (verification.status === "COMPLETED") {
                console.log('✅ Employment verification completed');
                completed = true;
                break;
            }
            await page.waitForTimeout(5000);
        }
        if (!completed) {
            throw new Error('Employment verification did not complete within expected time');
        }
        
        console.log('✅ Multi-paystub PDF uploaded, waiting for employment verification response...');

        const employmentVerificationResponse = await adminClient.get(`/employment-verifications`, {
            params: {
                filters: JSON.stringify({ $has: { step: { session_id: session.id } } })
            }
        });
        const employmentVerifications = employmentVerificationResponse.data.data;
        console.log('🚀 ~ Employment Verifications retrieved:', employmentVerifications.length);

        expect(employmentVerifications.length).toBe(1);
        const employmentVerification = employmentVerifications[0];
        const employerName = employmentVerification.employment.employer_name;
        expect(employerName).toBeDefined();
        console.log(`✅ Employment verification successful with employer name: ${employerName}`);

        const filesResponse = await adminClient.get(`/sessions/${session.id}/files`, {
            params: {
                'fields[file]': 'filename,id,status,url,updated_at,created_at,documents,fileable',
                'fields[document]': 'id,status,reason,modification_status,modification_payload,fraud_payload,failed_conditions,payload,raw_payload,type,created_at,updated_at',
                'fields[type]': 'key,name',
                'fields[fileable]': 'meta',
            }
        });

        const sessionFiles = filesResponse.data.data;
        expect(sessionFiles.length).toBe(1);
        console.log('🚀 ~ Files retrieved for session:', sessionFiles.length);

        const documents = sessionFiles[0].documents;
        expect(documents.length).toBe(3);

        console.log('🚀 ~ Documents associated with uploaded file:', documents.length);
        for (const document of documents) {
            expect(document.payload?.employer_name).toBe(employerName);
        }

        console.log('✅ All documents have the correct employer name in their payload');
        const newContext = await browser.newContext();
        const newPage = await newContext.newPage();

        console.log('Logging in as admin in a new context to verify report data...');
        await newPage.goto('/');
        await adminLoginAndNavigateToApplications(newPage, admin);

        console.log('✅ Admin logged in on new context, navigating to applicant report...');
        await newPage.goto(`/applicants/all/${session.id}`)

        console.log('✅ Navigated to applicant report, verifying files and employment sections...');
        const fileSection = await openReportSection(newPage, 'files-section');

        console.log('✅ Opened files section, verifying paystub files and statuses...');
        await fileSection.getByTestId('document-tab-pay_stub').click();

        console.log('✅ Clicked on Pay Stub tab, checking for uploaded files and their statuses...');
        const paystubFiles = fileSection.getByTestId('pay_stub_files')
        await expect(paystubFiles).toBeVisible();

        console.log('✅ Pay Stub files section is visible, verifying number of uploaded files and their statuses...');
        const statusPills = fileSection.locator(`[data-testid="files-document-status-pill"]`);
        await expect(statusPills).toHaveCount(3);

        console.log('✅ All uploaded paystub files are present, verifying their statuses are Accepted...');
        for (let i = 0; i < await statusPills.count(); i++) {
            const statusPill = statusPills.nth(i);
            await expect(statusPill).toHaveText('Accepted');
        }

        console.log('✅ All uploaded paystub files have Accepted status, verifying employment section for deduplication...');
        const employmentSection = await openReportSection(newPage, 'employment-section');
        const employmentRows = employmentSection.locator(`[data-testid="employment-raw"]`);
        await expect(employmentRows).toHaveCount(1);
        console.log('✅ Only one employment row is present, verifying employer name and API data for the employment...');

        const empoymentRow = employmentRows.first();
        const employerCell = empoymentRow.locator(`[data-testid^="employment-table-employer-cell-"]`);

        console.log('✅ Employer cell located, verifying employer name text...');

        await expect(employerCell).toHaveText(employerName);

        const employmentsResponse = await adminClient.get(`/sessions/${session.id}/employments`);
        const employments = employmentsResponse.data.data;
        expect(employments.length).toBe(1);
        expect(employments[0].employer_name).toBe(employerName);
        console.log('✅ Employment data verified successfully');

    })

    test.afterAll(async ({ request }, testInfo) => {
        if (cleanupSessionId) {
            await cleanupSession(request, cleanupSessionId, testInfo.status === 'passed');
            console.log(`Cleaned up session with ID: ${cleanupSessionId}`);
        }
    })
})

