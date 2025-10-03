import { expect, test } from '@playwright/test';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { app } from '~/tests/test_config';
import admin from '~/tests/test_config/admin';
import generateSessionForm from '~/tests/utils/generate-session-form';
import loginForm from '~/tests/utils/login-form';

import { joinUrl } from '~/tests/utils/helper';
import { waitForJsonResponse } from '~/tests/utils/wait-response';
import {
    checkSessionApproveReject,
    searchSessionWithText,
    navigateToSessionById,
    navigateToSessionFlags,
    markFlagAsIssue,
    markFlagAsNonIssue,
    validateFlagSections
} from '~/tests/utils/report-page';
import { createSessionForUser } from '~/tests/utils/session-flow';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


test.describe('user_flags_approve_reject_test', () => {

    test.describe('Session Flag', () => {
        test.describe.configure({ mode: 'default' });
        test.setTimeout(200_000);
        const userData = {
            first_name: 'Flag Issue',
            last_name: 'Testing',
            email: 'FlagIssueTesting@verifast.com'
        };

        let flagIssueSession = '01985a2c-c3f3-71fa-bc3d-f5a11279d36a';

        test('Should create applicant session for flag issue', { tag: [ '@core', '@smoke', '@regression' ] }, async ({
        page,
        browser
    }) => {

        // Create session \
        const { sessionId } = await createSessionForUser(
            page,
            browser,
            admin,
            'Permissions Test Org',
            'AutoTest - Flag Issue V2',
            userData,
            '2500',
            'fl'
        );

        flagIssueSession = sessionId;
        });

        test('Check Session Flag', { tag: [ '@core', '@smoke', '@regression' ] }, async ({ page }) => {
        const sessionId = flagIssueSession;

        // Step 1: Login and navigate to session
        await loginForm.adminLoginAndNavigate(page, admin);
        await page.waitForTimeout(2000); // Wait longer for page to fully load

        // Step 1.1: Navigate to sessions page (not applications)
        // Check if applicants menu is already open before clicking
        const applicantsMenu = page.getByTestId('applicants-menu');
        const isMenuOpen = await applicantsMenu.evaluate(el => el.classList.contains('sidebar-item-open'));
        
        if (!isMenuOpen) {
            await applicantsMenu.click();
            await page.waitForTimeout(500);
        }
        
        await page.getByTestId('applicants-submenu').click();
        await page.waitForTimeout(2000); // Wait longer for sessions to load

        await searchSessionWithText(page, sessionId);
        await page.waitForTimeout(1000); // Wait after search
        await navigateToSessionById(page, sessionId);

        // Step 2: Navigate to flags and validate sections
        const { flagSection } = await navigateToSessionFlags(page, sessionId);
        const { icdsElement, irrsElement } = await validateFlagSections(
            page,
            'GROSS_INCOME_RATIO_EXCEEDED',
            'NO_INCOME_SOURCES_DETECTED'
        );

        // Step 3: Mark NO_INCOME_SOURCES_DETECTED as issue
        await markFlagAsIssue(
            page,
            sessionId,
            'NO_INCOME_SOURCES_DETECTED',
            'this flag is marked as issue by playwright test run'
        );

        // Step 4: Verify flag moved to decline section
        await expect(
            icdsElement.getByTestId('NO_INCOME_SOURCES_DETECTED')
        ).toBeVisible();

        await page.getByTestId('close-event-history-modal').click();

        const applicantRaw = await page.getByTestId(`raw-${sessionId}`);

        await applicantRaw.getByTestId('raw-financial-verification-status').click();

        await expect(page.getByTestId('report-financial-status-modal')).toBeVisible();

        const financialModalFlagSection = await page.getByTestId('report-financial-status-modal');

        // Step 5: Mark MISSING_TRANSACTIONS as non-issue
        await markFlagAsNonIssue(
            page,
            sessionId,
            'MISSING_TRANSACTIONS',
            'this flag is marked as non issue by playwright test run'
        );

        // Step 6: Verify flag moved to reviewed section
        const riSection = await financialModalFlagSection.getByTestId(
            'reviewed-items-section'
        );
        await expect(
            riSection.getByTestId('MISSING_TRANSACTIONS')
        ).toBeVisible({ timeout: 30_000 });
        });
    });

    test.describe('Session Approve/Reject', () => {
        test.describe.configure({ mode: 'default' });
        test.setTimeout(200_000);
        const userData2 = {
            first_name: 'Approval_reject',
            last_name: 'Testing',
            email: 'ApprovalRejecttesting@verifast.com'
        };

        let approveRejectSession = '01976921-a4d1-729f-9212-6f88ac9a189c';

        test('Should create applicant session for approve reject', { tag: [ '@core', '@smoke', '@regression' ] }, async ({
        page,
        browser
    }) => {

        // Create session using the existing utility
        const { sessionId } = await createSessionForUser(
            page,
            browser,
            admin,
            'Permissions Test Org',
            'AutoTest - Flag Issue V2',
            userData2,
            '2500',
            'fl'
        );

        approveRejectSession = sessionId;
        });

        test('Check session by Approving and Rejecting', { tag: [ '@core', '@smoke', '@regression' ] }, async ({ page }) => {
        const sessionId = approveRejectSession;

        // Login and navigate to session
        await loginForm.adminLoginAndNavigate(page, admin);
        await page.waitForTimeout(1000); // Wait for page to fully load

        // Navigate to sessions page (not applications)
        // Check if applicants menu is already open before clicking
        const applicantsMenu = page.getByTestId('applicants-menu');
        const isMenuOpen = await applicantsMenu.evaluate(el => el.classList.contains('sidebar-item-open'));
        
        if (!isMenuOpen) {
            await applicantsMenu.click();
            await page.waitForTimeout(500);
        }
        
        await page.getByTestId('applicants-submenu').click();
        await page.waitForTimeout(1000);

        await searchSessionWithText(page, sessionId);
        await navigateToSessionById(page, sessionId);

        // Validate session status
        expect(await page.getByTestId('household-status-alert')).toContainText(
            'Unreviewed'
        );

        // NEW STEP: Approve documents before approving session
        console.log('🚀 Starting document approval process...');
        
        // Step 1: Click files section header to open the section
        console.log('🚀 Clicking files-section-header to open files section...');
        const filesSectionHeader = page.getByTestId('files-section-header');
        await expect(filesSectionHeader).toBeVisible({ timeout: 10_000 });
        await filesSectionHeader.click();
        console.log('✅ Files section opened');
        
        // Step 2: Find and click the files document status pill
        console.log('🚀 Looking for files-document-status-pill...');
        const filesDocumentStatusPill = page.getByTestId('files-document-status-pill');
        await expect(filesDocumentStatusPill).toBeVisible({ timeout: 10_000 });
        
        // Click the 'a' element inside the pill
        const pillLink = filesDocumentStatusPill.locator('a');
        await expect(pillLink).toBeVisible();
        console.log('🚀 Clicking files document status pill link...');
        await pillLink.click();
        
        // Step 3: Wait for decision modal to appear
        console.log('🚀 Waiting for decision modal to appear...');
        const decisionModal = page.getByTestId('decision-modal');
        await expect(decisionModal).toBeVisible({ timeout: 10_000 });
        console.log('✅ Decision modal is visible');
        
        // Step 4: Click the accept button
        console.log('🚀 Clicking decision modal accept button...');
        const acceptButton = page.getByTestId('decision-modal-accept-btn');
        await expect(acceptButton).toBeVisible();
        await acceptButton.click();
        console.log('✅ Document approval completed');
        
        // Step 5: Wait 5 seconds as requested
        console.log('🚀 Waiting 5 seconds after document approval...');
        await page.waitForTimeout(5000);
        console.log('✅ Wait completed, proceeding with session approval');

        // Step 6: Now proceed with session approve/reject flow
        console.log('🚀 Starting session approve/reject flow...');
        await checkSessionApproveReject(page, sessionId);
        });
    });
});
