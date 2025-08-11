import { test, expect } from '@playwright/test';
import loginForm from '~/tests/utils/login-form';
import { admin } from '~/tests/test_config';
import app from '~/tests/test_config/app';
import { findAndInviteApplication } from '~/tests/utils/applications-page';
import generateSessionForm from '~/tests/utils/generate-session-form';
import { handleOptionalStateModal, selectApplicantType, completeApplicantForm, completeIdVerification } from '~/tests/utils/session-flow';

test.describe('applicant_type_workflow_affordable_occupant', () => {
    test('Should complete applicant flow with affordable occupant applicant type', { 
        tag: ['@core'],
    }, async ({ page }) => {
        // Step 1: Login as admin
        await page.goto(app.urls.app);
        await loginForm.fill(page, admin);
        await loginForm.submit(page);
        await expect(page.getByTestId('applicants-menu')).toBeVisible();

        // Step 2: Navigate to Applications and search for the test application
        await page.getByTestId('applications-menu').click();
        await page.getByTestId('applications-submenu').click();
        await page.waitForTimeout(700);
        const appName = 'AutoTest - Applicant Flow';
        await findAndInviteApplication(page, appName);

        // Step 3: Fill session generation form
        const userData = {
            first_name: 'Affordable',
            last_name: 'Test',
            email: 'affordable@verifast.com'
        };

        await generateSessionForm.fill(page, userData);
        const sessionData = await generateSessionForm.submit(page);

        // Step 4: Get session link and navigate to applicant view
        const linkSection = page.getByTestId('session-invite-link');
        await expect(linkSection).toBeVisible();
        const link = await linkSection.getAttribute('href');
        
        // Close modal
        await page.getByTestId('generate-session-modal-cancel').click();

        // Step 5: Navigate to applicant view
        await page.goto(link);
        await page.waitForTimeout(8000);

        // Step 6: Handle state modal if it appears
        await handleOptionalStateModal(page);

        // Step 7: Select Affordable Occupant applicant type
        await selectApplicantType(page, sessionData.data?.id, '#affordable_occupant');

        // Step 8: Complete applicant form with rent budget
        await completeApplicantForm(page, '555', sessionData.data?.id);

        await page.waitForTimeout(4000);
        
        // Step 9: Complete ID verification in Persona iframe (skip upload)
        await completeIdVerification(page, false);

        console.log('✅ Applicant Type Workflow Affordable Occupant test completed successfully');
    });
}); 