import { expect, test } from '@playwright/test';
import loginForm from './utils/login-form';
import { completeApplicationEditWorkflow } from './utils/application-edit-flow';
import { admin } from '~/tests/test_config';

const loginWith = async (page, data) => {

    // Step 1: Admin Login and Navigate
    await loginForm.fill(page, data);
    await loginForm.submitAndSetLocale(page);
    await expect(page).toHaveTitle(/Applicants/, { timeout: 10_000 });
};

test.describe('verify_application_edit_id_step_edit', () => {
    test.describe.configure({ mode: 'default' });

    test('Should login user and edit ID only application', {
      tag: ['@regression', '@multi-env-ready'],
    }, async ({ page }) => {
        await page.goto('/');
        await loginWith(page, admin);

        // Complete application edit workflow with identity enabled and guarantor value change
        await completeApplicationEditWorkflow(
            page,
            'AutoTest Suite - ID Edit Only',
            {
                identityShouldBeChecked: true, // Expect checkbox to be checked initially
                financialSettings: {
                    //guarantorValue: '3', // Verify current value
                    newGuarantorValue: '5', // Change to new value
                    incomeBudget: '1',
                    rentBudgetMin: '500'
                }
            }
        );
    });

    test('Verify updates are there in application', {
      tag: ['@regression', '@multi-env-ready'],
    }, async ({ page }) => {
        await page.goto('/');
        await loginWith(page, admin);

        // Complete application edit workflow with identity disabled and guarantor value reverted
        await completeApplicationEditWorkflow(
            page,
            'AutoTest Suite - ID Edit Only',
            {
                identityShouldBeChecked: false, // Expect checkbox to be unchecked (previous test disabled it)
                financialSettings: {
                    guarantorValue: '5', // Verify the value from previous test
                    newGuarantorValue: '3', // Revert back to original value
                    incomeBudget: '1',
                    rentBudgetMin: '500'
                }
            }
        );
    });
});
