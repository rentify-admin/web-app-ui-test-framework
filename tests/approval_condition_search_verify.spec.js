import { expect, test } from '@playwright/test';
import loginForm from './utils/login-form';
import { gotoPage } from './utils/common';
import { admin, app } from './test_config';
import { customUrlDecode } from './utils/helper';

test.describe('QA-211: Approval Conditions — Search by Name, Description, and BE Name', () => {

    test('Approval Conditions — Search by Name, Description, and BE Name', {
        tag: ['@regression', '@staging-ready', '@rc-ready']
    }, async ({ page }) => {

        console.log('🚀 Step 1: Navigating to app URL');
        await page.goto(app.urls.app);

        console.log('🚀 Step 2: Filling login form');
        await loginForm.fill(page, admin);

        console.log('🚀 Step 3: Submitting login form and setting locale');
        await loginForm.submitAndSetLocale(page);

        console.log('🚀 Step 4: Waiting for applicants menu to be visible');
        await expect(page.getByTestId('applicants-menu')).toBeVisible();

        console.log('🚀 Step 5: Clicking on applications menu');
        await page.getByTestId('applications-menu').click();

        console.log('🚀 Step 6: Navigating to Approval Conditions (flag-collections)');
        const flagCollections = await gotoPage(page, 'applications-menu', 'approval-conditions-submenu', '/flag-collections?');

        const [flagCollection] = flagCollections;

        console.log('🚀 Step 7: Validating flag collections are present');
        await expect(flagCollections.length > 0).toBeTruthy();

        console.log(`🚀 Step 8: Clicking to view flag collection (id: ${flagCollection.id})`);
        await page.getByTestId(`view-${flagCollection.id}`).click();

        console.log('🔍 Step 9: Search by Name ("Mismatch") in flag-name-col');
        await searchAndValidateFlags(page, 'Mismatch', 'flag-name-col');
        console.log('✅ Step 9 completed: "Mismatch" search in flag-name-col validated.');

        console.log('🔍 Step 10: Search by Description ("computed cadence") in flag-description-col');
        await searchAndValidateFlags(page, 'computed cadence', 'flag-description-col');
        console.log('✅ Step 10 completed: "computed cadence" search in flag-description-col validated.');

        console.log('🔍 Step 11: Search by BE Name ("EMPLOYMENT_LETTER_UPLOADED") in flag-key-col (exact match)');
        await searchAndValidateFlags(page, 'EMPLOYMENT_LETTER_UPLOADED', 'flag-key-col', {
            exactMatch: true
        });
        console.log('✅ Step 11 completed: "EMPLOYMENT_LETTER_UPLOADED" search in flag-key-col (exact match) validated.');



    })

})
/**
 * Searches flags with the given value and validates the given column contains the search string.
 * @param {import('@playwright/test').Page} page
 * @param {string} fillValue - the value to search/fill in search input
 * @param {string} colTestId - the test id for the column to check, e.g. 'flag-name-col'
 * @param {Object} [options] - options for validation, e.g. {exactMatch: false}
 */
async function searchAndValidateFlags(page, fillValue, colTestId, options = { exactMatch: false }) {
    // Typing in search & waiting for correct response
    const [response] = await Promise.all([
        page.waitForResponse(resp => {
            try {
                const link = new URL(customUrlDecode(resp.url()))
                const params = new URLSearchParams(link.search)
                return link.pathname.includes('/flags')
                    && params.get('filters') && params.get('filters').toLowerCase().includes(fillValue.toLowerCase())
                    && resp.request().method() === 'GET'
                    && resp.ok()
            } catch {
                return false;
            }
        }),
        page.getByTestId('app-cond-flag-search-input').fill(fillValue)
    ]);

    const { data: flags = [] } = await response.json();
    const flagsTable = await page.getByTestId('approval-cond-flags-list');
    for (let index = 0; index < flags.length; index++) {
        const element = flags[index];
        const row = await flagsTable.getByTestId(`flag-row-${element.id}`);
        const col = await row.getByTestId(colTestId);

        if (options.exactMatch) {
            await expect(col).toHaveText(fillValue, { ignoreCase: true });
        } else {
            await expect(col).toContainText(fillValue, { ignoreCase: true });
        }
    }
}