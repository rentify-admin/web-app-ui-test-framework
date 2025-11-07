import { test, expect } from '@playwright/test';
import loginForm from '~/tests/utils/login-form';
import { admin } from '~/tests/test_config';
import { completeApplicationFlow } from '~/tests/utils/application-management';
import { getRandomNumber } from '~/tests/utils/helper';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

test.describe('application_create_delete_test', () => {
    test('Should create and delete an application with multiple applicant types', { 
        tag: [ '@core', '@regression', '@staging-ready', '@try-test-rail-names'],
    }, async ({ page }) => {
        // Step 1-5: Login as admin (dhaval)
        await loginForm.fill(page, admin);
        await loginForm.submitAndSetLocale(page);
        await expect(page.getByTestId('applicants-menu')).toBeVisible();

        // Application configuration
        const appConfig = {
            organizationName: 'Verifast',
            applicationName: `AutoTest Create_Delete_${getRandomNumber()}`,
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

        // Complete application flow
        await completeApplicationFlow(page, appConfig);

        console.log('Application create and delete test completed successfully');

    });
});
