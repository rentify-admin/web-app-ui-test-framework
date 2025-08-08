import { test, expect } from '@playwright/test';
import loginForm from '~/tests/utils/login-form';
import { admin } from '~/tests/test_config';
import app from '~/tests/test_config/app';
import { createApplicationFlow, searchAndEditApplication, searchAndVerifyApplication, searchAndDeleteApplication } from '~/tests/utils/application-management';
import { getRandomNumber } from './utils/helper';

test.describe('Workflow Isolation Test', () => {
    let app1Name, app2Name;

    test.afterEach(async ({ page }) => {
        //TODO IMPORTANT. IMPLEMENT CLEAN UP BY API
        try {
            // Clean up applications even if test fails
            if (app1Name) await searchAndDeleteApplication(page, app1Name).catch(() => {});
            if (app2Name) await searchAndDeleteApplication(page, app2Name).catch(() => {});
        } catch (error) {
            console.log('Cleanup failed:', error.message);
        }
    });

    test('C42 - Applicant edits a workflow used by another applicant only reflects changes to current', { tag: ['@core', '@regression'] }, async ({ page, browserName }) => {
        // Step 1-5: Login as admin (using admin instead of craig as requested)
        await page.goto(app.urls.app);
        await loginForm.fill(page, admin);
        await loginForm.submit(page);
        await expect(page.getByTestId('applicants-menu')).toBeVisible();

        // Generate browser-specific application names to avoid conflicts when running in parallel
        const browserPrefix = browserName.charAt(0).toUpperCase() + browserName.slice(1);
        app1Name = `AutoTest Edit_1_${browserPrefix}_${getRandomNumber()}`;
        app2Name = `AutoTest Edit_2_${browserPrefix}_${getRandomNumber()}`;

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
        await createApplicationFlow(page, app1Config);

        // Step 48-87: Create second application
        console.log('Creating second application...');
        await createApplicationFlow(page, app2Config);

        // Step 88-100: Edit first application - remove "Other" applicant type
        console.log('Editing first application...');
        await searchAndEditApplication(page, app1Name, {
            removeApplicantType: 'Other'
        });

        // Step 101-108: Verify second application still has all applicant types
        console.log('Verifying workflow isolation...');
        const edit2Length = await searchAndVerifyApplication(page, app2Name);

        // Step 109: Assert that second application has more applicant types than first
        const edit1Length = await searchAndVerifyApplication(page, app1Name);

        expect(edit2Length).toBeGreaterThan(edit1Length);
        console.log(`Application 2 has ${edit2Length} applicant types, Application 1 has ${edit1Length} applicant types`);

        console.log('Workflow isolation test completed successfully');
    });
}); 