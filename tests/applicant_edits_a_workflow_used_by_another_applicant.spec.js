import { test, expect } from '@playwright/test';
import loginForm from '~/tests/utils/login-form';
import { admin } from '~/tests/test_config';
import app from '~/tests/test_config/app';
import { createApplicationFlow, searchAndEditApplication, searchAndVerifyApplication, searchAndDeleteApplication } from '~/tests/utils/application-management';
import { generateUniqueName } from '~/tests/utils/common';

test.describe('applicant_edits_a_workflow_used_by_another_applicant', () => {
    let app1Name, app2Name, app1Id, app2Id;

    test.afterEach(async ({ page }) => {
        //TODO IMPORTANT. IMPLEMENT CLEAN UP BY API
        try {
            // Clean up applications even if test fails - use robust delete selectors
            if (app1Name && app1Id) await searchAndDeleteApplication(page, app1Name, app1Id).catch(() => {});
            if (app2Name && app2Id) await searchAndDeleteApplication(page, app2Name, app2Id).catch(() => {});
        } catch (error) {
            console.log('Cleanup failed:', error.message);
        }
    });

    test('Should edit a workflow used by another applicant and only reflects changes to current', { 
        tag: ['@core', '@regression', '@multi-env-ready'],
    }, async ({ page }) => {
        test.setTimeout(200000);
        // Step 1-5: Login as admin and navigate to applications
        await loginForm.adminLoginAndNavigate(page, admin);

        // Generate unique application names to avoid conflicts when running in parallel
        app1Name = generateUniqueName('AutoTest Edit_1');
        app2Name = generateUniqueName('AutoTest Edit_2');

        // Application configurations
        const app1Config = {
            organizationName: 'Verifast',
            applicationName: app1Name,
            applicantTypes: [
                'Affordable Occupant',
                'Affordable Primary', 
                'Employed',
                'International',
                'Self-Employed',
                'Other'
            ],
            workflowTemplate: 'Autotest-suite-fin-only',
            flagCollection: 'High Risk',
            minimumAmount: '500'
        };

        const app2Config = {
            organizationName: 'Verifast',
            applicationName: app2Name,
            applicantTypes: [
                'Affordable Occupant',
                'Affordable Primary', 
                'Employed',
                'International',
                'Self-Employed',
                'Other'
            ],
            workflowTemplate: 'Autotest-suite-fin-only',
            flagCollection: 'High Risk',
            minimumAmount: '500'
        };

        // Step 6-47: Create first application
        console.log('Creating first application...');
        const app1Responses = await createApplicationFlow(page, app1Config);
        app1Id = app1Responses.applicationId;
        console.log('✅ First application created with ID:', app1Id);

        // Step 48-87: Create second application
        console.log('Creating second application...');
        const app2Responses = await createApplicationFlow(page, app2Config);
        app2Id = app2Responses.applicationId;
        console.log('✅ Second application created with ID:', app2Id);

        // Step 88-100: Edit first application - remove "Other" applicant type
        console.log('Editing first application...');
        await searchAndEditApplication(page, app1Name, {
            removeApplicantType: 'Other',
            applicationId: app1Id
        });

        // Step 101-108: Verify second application still has all applicant types
        console.log('Verifying workflow isolation...');
        const edit2Length = await searchAndVerifyApplication(page, app2Name, app2Id);

        // Step 109: Assert that second application has more applicant types than first
        const edit1Length = await searchAndVerifyApplication(page, app1Name, app1Id);

        expect(edit2Length).toBeGreaterThan(edit1Length);
        console.log(`Application 2 has ${edit2Length} applicant types, Application 1 has ${edit1Length} applicant types`);

        console.log('Workflow isolation test completed successfully');
    });
}); 