import { expect, test } from '@playwright/test'
import { adminLoginAndNavigateToApplications } from './utils/session-utils'
import { findAndInviteApplication } from './utils/applications-page';
import generateSessionForm from './utils/generate-session-form';
import { gotoPage } from './utils/common';
import { openReportSection, searchSessionWithText } from './utils/report-page';
import { cleanupSession } from './utils/cleanup-helper';
import { admin } from './test_config';

const applicationName = "Autotest - Household UI test";

let createdSessionId = null;

test.describe('QA-234 guest-email-edit-validation.spec', () => {

    test('Verify Guest Email Edit: Form Save Validation (VC-1094)', {
        tag: ['@regression', '@smoke', '@staging-ready', '@rc-ready'],
        timeout: 90_000
    }, async ({ page }) => {

        // Step 1: Login as admin and navigate to applications page
        console.log('🔐 Step 1: Logging in as admin and navigating to applications page');
        await adminLoginAndNavigateToApplications(page, admin);

        // Step 2: Find the application and initiate invite for a new session
        console.log(`🔎 Step 2: Searching for application "${applicationName}" and clicking invite`);
        await findAndInviteApplication(page, applicationName);

        // Step 3: Prepare guest user data and create a new session, extract sessionId
        const userData = {
            first_name: 'Autot - Guest',
            last_name: 'Emailtest',
            email: `guest-email-${Date.now()}+autotest@verifast.com`,
        };
        console.log('📝 Step 3: Generating session with user data:', userData);

        const { sessionId } = await generateSessionForm.generateSessionAndExtractLink(page, userData);
        createdSessionId = sessionId;
        console.log(`✅ New guest session created with ID: ${sessionId}`);

        // Step 4: Go to applicants sessions page
        await gotoPage(page, 'applicants-menu', 'applicants-submenu', '/sessions?fields[session]');
        console.log('🌐 Step 4: Navigated to Applicants Sessions page.');

        // Step 5: Search for the created guest session and open session details
        console.log('🔎 Step 5: Searching for created guest session with ID:', createdSessionId);
        await searchSessionWithText(page, createdSessionId);
        const sessionLink = page.locator(`[href="/applicants/all/${sessionId}"]`);
        await sessionLink.click();
        console.log('👉 Step 5: Opened session details.');

        // Step 6: Open the "identity" section in the session report
        console.log('🗂️ Step 6: Opening "Identity" section in report.');
        const identitySection = await openReportSection(page, 'identity-section');

        // Step 7: Find and click the guest edit ("pencil") button
        const editGuestBtn = identitySection.getByTestId('identity-edit-guest-btn');
        await expect(editGuestBtn).toBeVisible();
        console.log('✏️ Step 7: Guest Edit button is visible. Clicking to open edit modal.');
        await editGuestBtn.click();

        // Step 8: Edit guest name fields, leave email unchanged, verify original email pre-filled
        console.log('[Step 8] Editing guest names. Verifying initial form values.');
        console.log('[GuestEmailEdit] Modal should show original email:', userData.email);

        const dummyUserData = {
            first_name: 'Edith',
            last_name: 'Dummylast'
        };

        await expectAndFillGuestForm(
            page,
            userData,      // Expect original values
            dummyUserData  // Only change the names
        );
        console.log('📝 Step 8: Guest name fields updated (first/last), email left as:', userData.email);

        // Step 9: Submit guest form and wait for PATCH request/response
        const guestEditModal = page.getByTestId('identity-update-guest-modal');
        const guestSubmitBtn = guestEditModal.getByTestId('submit-guest-update-form');
        await expect(guestSubmitBtn).toBeVisible();
        console.log('💾 Step 9: Submitting guest edit form for PATCH (updating name only).');

        // Listen for guest PATCH request/response
        const guestPatchRegex = new RegExp('/guests/[0-9a-fA-F-]{36}\\b');
        const [guestPatchResponse] = await Promise.all([
            page.waitForResponse(resp =>
                guestPatchRegex.test(resp.url()) &&
                resp.request().method() === 'PATCH'
            ),
            guestSubmitBtn.click()
        ]);
        await expect(guestPatchResponse.ok()).toBeTruthy();
        console.log('✅ Name update PATCH API success.');

        // Step 10: Verify guest edit modal closes after successful update
        await expect(page.getByTestId('identity-update-guest-modal')).toBeHidden();
        console.log('🔒 Step 10: Modal closed after guest update.');

        // Step 11: Verify UI shows updated name and email is unchanged after PATCH
        const userFullNameText = page.getByTestId('identity-guest-full-name');
        const userEmailText = page.getByTestId('identity-guest-email');
        const expectedFullName = `${dummyUserData.first_name} ${dummyUserData.last_name}`;
        await expect(userFullNameText).toBeVisible();
        await expect(userEmailText).toBeVisible();
        await expect(userFullNameText).toHaveText(new RegExp(expectedFullName.replace(/\s+/, '\\s+')), { timeout: 20_000 });
        await expect(userEmailText).toHaveText(userData.email, { timeout: 20_000 });
        console.log('🔍 Step 11: UI verified: name updated, email unchanged.');

        // Step 12: Edit the email field, keep updated names as is
        console.log('📝 Step 12: Re-opening edit modal to update the guest email.');
        await editGuestBtn.click();

        const newEmail = `guest-email-updated-${Date.now()}@verifast.com`;
        await expectAndFillGuestForm(
            page,
            {
                first_name: dummyUserData.first_name,
                last_name: dummyUserData.last_name,
                email: userData.email,
            },
            {
                email: newEmail
            }
        );
        console.log('📝 Step 12: Email field updated to:', newEmail);

        // Step 13: Submit the form and verify PATCH for new email
        await expect(guestSubmitBtn).toBeVisible();
        console.log('💾 Step 13: Submitting updated guest email...');
        const [guestPatchResponse2] = await Promise.all([
            page.waitForResponse(resp =>
                guestPatchRegex.test(resp.url()) &&
                resp.request().method() === 'PATCH'
            ),
            guestSubmitBtn.click()
        ]);
        await expect(guestPatchResponse2.ok()).toBeTruthy();

        // Step 14: After successful update, verify modal closure and UI values
        await expect(page.getByTestId('identity-update-guest-modal')).toBeHidden();
        await expect(userFullNameText).toBeVisible();
        await expect(userEmailText).toBeVisible();
        await expect(userFullNameText).toHaveText(new RegExp(expectedFullName.replace(/\s+/, '\\s+')), { timeout: 20_000 });
        await expect(userEmailText).toHaveText(newEmail, { timeout: 20_000 });
        console.log('✅ Step 14: Verified UI after guest email update.');

        // Step 15: Clear the email field & update phone, then verify PATCH and UI again
        console.log('📝 Step 15: Re-opening guest edit modal to clear email and update phone...');
        await editGuestBtn.click();

        const newPhone = generateRandomPhone();
        const clearedEmail = '';
        await expectAndFillGuestForm(
            page,
            {
                first_name: dummyUserData.first_name,
                last_name: dummyUserData.last_name,
                email: newEmail,
            },
            {
                phone: newPhone,
                email: clearedEmail
            }
        );
        console.log('📝 Step 15: Filled new phone and cleared email.');

        await expect(guestSubmitBtn).toBeVisible();
        console.log('💾 Step 16: Submitting guest update with cleared email & new phone...');
        const [guestPatchResponse3] = await Promise.all([
            page.waitForResponse(resp =>
                guestPatchRegex.test(resp.url()) &&
                resp.request().method() === 'PATCH'
            ),
            guestSubmitBtn.click()
        ]);
        await expect(guestPatchResponse3.ok()).toBeTruthy();

        await expect(page.getByTestId('identity-update-guest-modal')).toBeHidden();

        // Step 17: Verify phone value updated in UI
        const phoneText = await page.getByTestId('identity-guest-phone');
        await expect(phoneText).toContainText(newPhone, { timeout: 20_000 });
        console.log('☎️ Step 17: Verified phone number update in UI:', newPhone);

        // Step 18: Re-open modal to confirm phone and current email (should be empty)
        console.log('📝 Step 18: Re-opening guest edit modal to check new phone and cleared email fields');
        await editGuestBtn.click();
        await expectAndFillGuestForm(
            page,
            {
                first_name: dummyUserData.first_name,
                last_name: dummyUserData.last_name,
                email: newEmail,
                phone: `(${newPhone.slice(0, 3)}) ${newPhone.slice(3, 6)}-${newPhone.slice(6)}`
            },
            { email: clearedEmail } // make sure email is cleared again
        );

        await expect(guestSubmitBtn).toBeVisible();
        console.log('💾 Step 19: Submitting guest update after one more email clear.');
        const [guestPatchResponse4] = await Promise.all([
            page.waitForResponse(resp =>
                guestPatchRegex.test(resp.url()) &&
                resp.request().method() === 'PATCH'
            ),
            guestSubmitBtn.click()
        ]);
        await expect(guestPatchResponse4.ok()).toBeTruthy();

        await expect(page.getByTestId('identity-update-guest-modal')).toBeHidden();

        // Step 20: Final verification in UI for all fields
        await expect(userFullNameText).toBeVisible();
        await expect(userEmailText).toBeVisible();
        await expect(userFullNameText).toHaveText(new RegExp(expectedFullName.replace(/\s+/, '\\s+')), { timeout: 20_000 });
        await expect(userEmailText).toHaveText(newEmail, { timeout: 20_000 });
        await expect(phoneText).toContainText(newPhone, { timeout: 20_000 });
        console.log('✅ Step 20: All guest updates correctly reflected in UI.');

    });

    // Cleanup after all tests
    test.afterAll(async ({ request }, testInfo) => {
        if (createdSessionId) {
            if (testInfo.status === 'passed') {
                console.log(`🧹 Test passed. Cleaning up session ${createdSessionId}...`);
                await cleanupSession(request, createdSessionId, true);
                console.log('✅ Cleanup complete');
            } else {
                console.log(`⚠️  Test ${testInfo.status}. Skipping cleanup for session ${createdSessionId} (left for debugging)`);
            }
        }
    });

});

/**
 * Fills and asserts fields in the guest information edit modal.
 * For each supplied key in expectData, verifies the modal field is prefilled.
 * For each supplied key in guestFormData, fills the modal field.
 * Logs each major action for clarity.
 *
 * @param {import('@playwright/test').Page} page - Playwright Page object.
 * @param {Object} expectData - Keys and values expected to already be present in the modal.
 * @param {Object} guestFormData - Keys and values to fill in the modal.
 */
async function expectAndFillGuestForm(page, expectData = {}, guestFormData = {}) {

    // Assert guest edit modal visible
    const guestEditModal = page.getByTestId('identity-update-guest-modal');
    await expect(guestEditModal).toBeVisible();
    console.log('🪟 Modal opened: identity-update-guest-modal is visible.');

    // Helper for per-field fill & expect operation
    async function fillAndExpectField(fieldTestId, fieldKey) {
        const field = guestEditModal.getByTestId(fieldTestId);
        await expect(field).toBeVisible();
        // If value in expectData, assert it's present and log it
        if (typeof expectData[fieldKey] !== 'undefined') {
            await expect(field).toHaveValue(expectData[fieldKey]);
            console.log(`🔎 Field "${fieldKey}" expected value:`, expectData[fieldKey]);
        }
        // If value in guestFormData, fill it and log the action
        if (typeof guestFormData[fieldKey] !== 'undefined') {
            await field.fill(guestFormData[fieldKey]);
            console.log(`✏️ Field "${fieldKey}" filled with:`, guestFormData[fieldKey]);
        }
    }

    // Step-by-step per field
    await fillAndExpectField('guest-first-name-field', 'first_name');
    await fillAndExpectField('guest-last-name-field', 'last_name');
    await fillAndExpectField('phone-input', 'phone');
    await fillAndExpectField('guest-email-field', 'email');
}

/**
 * Generates a random 10-digit phone number, prefix 613292, for test data.
 * @returns {string}
 */
function generateRandomPhone() {
    const random4Digits = Math.floor(1000 + Math.random() * 9000);
    return `613292${random4Digits}`;
}