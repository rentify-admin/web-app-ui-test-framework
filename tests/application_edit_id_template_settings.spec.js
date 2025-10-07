import { test, expect } from '@playwright/test';
import loginForm from '~/tests/utils/login-form';
import { admin } from '~/tests/test_config';
import { searchApplication, gotoApplicationsPage } from './utils/applications-page';
import { openApplicationEditModal, openWorkflowIdentitySetup, setPersonaTemplateId, expectPersonaTemplateId } from './utils/workflow-identity-utils';

test.describe('application_edit_id_template_settings', () => {
    test('Should edit an application ID template settings', {
      tag: ['@regression'],
    }, async ({ page }) => {
      // Step 1: Login as admin
      await page.goto('/');
      await loginForm.fill(page, admin);
      await loginForm.submitAndSetLocale(page);
      await expect(page.getByTestId('applicants-menu')).toBeVisible();

      // Step 2: Open Applications from sidebar using robust selectors
      await page.getByTestId('applications-menu').click();
      await page.getByTestId('applications-submenu').click();

      // Step 3: Navigate to Applications Page
      await gotoApplicationsPage(page);

      // Step 4: Search for the application by name
      const appName = 'AutoTest Suite - ID Edit Only';
      await searchApplication(page, appName);

      // Step 4: Click the edit icon for the application
      // (Assume the edit icon is in the 8th column of the first row)
      // await page.locator('table > tbody > tr > td:nth-child(8) > div > a').first().click();
      // await page.waitForTimeout(2000);

      // Open edit modal and workflow identity setup
      await openApplicationEditModal(page);
      await page.getByTestId('submit-application-setup').click();
      await openWorkflowIdentitySetup(page);

      // 1. Get current value
      const templateInput = await page.getByTestId('persona-template-id-input');

      const templateValue = await templateInput.inputValue();
      // await expectPersonaTemplateId(page, 'itmpl_tester_Verified');

      // 2. Edit and save
      await setPersonaTemplateId(page, 'itmpl_tester_Edited');
      await page.waitForTimeout(5000);
      // 3. Reopen and verify
      await openWorkflowIdentitySetup(page);
      await expectPersonaTemplateId(page, 'itmpl_tester_Edited');

      // 4. Restore original value
      await setPersonaTemplateId(page, templateValue);
      await page.waitForTimeout(3000);
    });
}); 