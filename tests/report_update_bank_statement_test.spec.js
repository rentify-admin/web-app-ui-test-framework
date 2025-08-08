import { test, expect } from '@playwright/test';
import { admin, app } from '~/tests/test_config';
import loginForm from '~/tests/utils/login-form';
import generateSessionForm from './utils/generate-session-form';

// import config from '~/tests/test_config';
import { joinUrl } from './utils/helper';
import { completeApplicantForm, handleOptionalStateModal, plaidFinancialConnect } from '~/tests/utils/session-flow';
import { navigateToSessionById, searchSessionWithText } from '~/tests/utils/report-page';
import { findAndInviteApplication, gotoApplicationsPage } from '~/tests/utils/applications-page';

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

const loginWith =  async (page, data) => {

    // Step 1: Admin Login and Navigate
    await loginForm.fill(page, data);
    await loginForm.submit(page);
    await expect(page).toHaveTitle(/Applicants/, { timeout: 10_000 });
    await expect(page.getByTestId('household-status-alert')).toBeVisible();
};

const user = {
    email: 'PalmaVance+PalmaVance@verifast.com',
    first_name: 'PalmaVance',
    last_name: 'PalmaVance'
};

test.skip('Report update bank statement', { 
    tag: ['@smoke', '@document-upload'],
    timeout: 180000  // 3 minutes
}, async ({ page, browser }) => {

    // Step:1 Login the the admin panel
    await loginWith(page, admin);

    await gotoApplicationsPage(page);

    const applicationName = 'TestSuite - bank report upload only';

    await findAndInviteApplication(page, applicationName);

    // Step 3: Generate Session
    await expect(page.locator('#generate-session-form')).toBeVisible();
    const { sessionId, sessionUrl, link } = await generateSessionForm.generateSessionAndExtractLink(page, user);

    // Step 4: Applicant Flow
    const context = await browser.newContext();
    const applicantPage = await context.newPage();

    const sessionLinkUrl = new URL(link);
    await Promise.all([
        applicantPage.waitForResponse(resp => resp.url().includes(sessionUrl)
                && resp.request().method() === 'GET'
                && resp.ok()),
        applicantPage.goto(joinUrl(app.urls.app, `${sessionLinkUrl.pathname}${sessionLinkUrl.search}`))
    ]);

    await handleOptionalStateModal(applicantPage);
    await completeApplicantForm(applicantPage, '555', sessionUrl);

    await applicantPage.waitForTimeout(1000);

    await plaidFinancialConnect(applicantPage, {
        username: 'custom_gig',
        password: 'test',
        bankName: 'Huntington Bank'
    });

    await applicantPage.close();

    // Click on the Applications menu to expand the menu
    await page.getByTestId('applicants-menu').click();
    await page.getByTestId('applicants-submenu').click();

    // Session search
    const sessions = await searchSessionWithText(page, sessionId);
    expect(sessions.length).toBeGreaterThan(0);

    // const sessionId = sessions[0].id;
    await navigateToSessionById(page, sessionId);

    // Upload document
    const btn = await page.getByTestId('upload-document-btn');
    await page.waitForTimeout(700);
    if (!await btn.isVisible()) {
        await page.getByTestId('session-action-btn').click();
    }
    await btn.click();

    const uploadForm = await page.getByTestId('upload-document');
    await expect(uploadForm).toBeVisible();

    await uploadForm.getByTestId('select-applicant').click();
    await page.waitForTimeout(500);

    await uploadForm.locator('#select-applicant-0').click();
    await uploadForm.getByTestId('select-document').click();
    await page.waitForTimeout(500);
    await uploadForm.locator('#select-document-0').click();

    const filePath = join(__dirname, '/test_files', 'test_bank_statement.pdf');
    const uploadInput = uploadForm.locator('#upload-document');

    await page.waitForTimeout(500);

    await uploadInput.setInputFiles(filePath);


    await Promise.all([
        page.waitForResponse(resp => resp.url().includes('/financial-verifications')
            && resp.ok()
            && resp.request().method() === 'POST'),
        uploadForm.getByTestId('submit-upload-doc-form').click()
    ]);

    await page.reload();
    await page.waitForTimeout(1000);
    await page.getByTestId('files-section-header').click();
    // File check
    const filesSection = await page.getByTestId('files-section');

    const primarySessionFilesSection =  await filesSection.getByTestId(`files-content-${sessionId}`);

    const allSection =  filesSection.getByTestId('file-section-all-wrapper').first();
    await expect(allSection.getByTestId('files-all-document-type-name')).toBeVisible({ timeout: 10_000 });
    await expect(allSection.getByTestId('files-all-document-type-name')).toContainText('Bank Statement', { timeout: 40_000 });

    await primarySessionFilesSection.getByTestId('document-tab-bank_statement').click();

    const bankStatementTable = await primarySessionFilesSection.getByTestId('bank_statement_files').first();
    await expect(bankStatementTable.getByTestId('files-bank-statement-file-name')).toBeVisible({ timeout: 60_000 });
    await expect(bankStatementTable.getByTestId('files-bank-statement-file-name'))
        .toContainText('test-bank-statement.pdf', { timeout: 60_000 });

    await filesSection.getByTestId('document-tab-all').click();

    await expect(allSection.getByTestId('files-document-status-pill')).toContainText('Rejected', { timeout: 30_000 });

    await allSection.getByTestId('files-document-status-pill').first()
        .locator('a')
        .click();

    await expect(page.getByTestId('decision-modal')).toBeVisible();

    const decisiontModal = await page.getByTestId('decision-modal');

    expect(decisiontModal.locator('table>tbody')).toContainText('Bank Statement: Account Name Mismatch');
    expect(decisiontModal.locator('table>tbody')).toContainText('Bank Statement: Transactions Older Than 6 Months');

    await decisiontModal.getByTestId('decision-modal-accept-btn').click();

    await expect(allSection.getByTestId('files-document-status-pill')).toContainText('Accepted', { timeout: 20_000 });

    await page.getByTestId('financial-section-header').click();

    await page.getByTestId('financial-section-financials-radio').click();

    const financialWrapper = await page.locator('[data-testid^="financial-section-financials-wrapper-"]').first();

    await expect(financialWrapper.locator('tbody').getByTestId('financial-details-institution-col')
        .first()).toContainText('Scotiabank.', { timeout: 20_000 });

    await expect(financialWrapper.locator('tbody').getByTestId('financial-details-institution-col')
        .nth(1)).toContainText('Huntington Bank');
});
