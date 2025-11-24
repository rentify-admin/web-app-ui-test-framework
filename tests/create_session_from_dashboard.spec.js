import { expect, test } from "@playwright/test";
import loginForm from "./utils/login-form";
import { admin, app } from "./test_config";
import { fillMultiselect } from "./utils/common";
import { joinUrl } from "./utils/helper";
import { waitForJsonResponse } from "./utils/wait-response";
import { findSessionLocator, searchSessionWithText } from "./utils/report-page";
import { cleanupSession } from "./utils/cleanup-helper";

let createdSessionId = null;
let allTestsPassed = true;

test.describe('QA-223 create_session_from_dashboard.spec', () => {

    test('Create New Session from Dashboard',
        {
            tag: ['@core', '@regression'],
            timeout: 180_000
        },
        async ({ page }) => {

            try {
                const orgnization = 'Permissions Test Org'
                const application = 'AutoTest - Flag Issue V2'
                const userData = {
                    first_name: 'Dashboard',
                    last_name: 'Session',
                    email: `dashboard-session-${Date.now()}@verifast.com`,
                }

                // Step 1: Admin login and navigate to Dashboard
                console.log('🟢 Step 1: Logging in as admin and navigating to dashboard...');
                await loginForm.adminLoginAndNavigate(page, admin)
                await page.waitForTimeout(4000);
                console.log('✅ Login successful and dashboard loaded.');

                // Step 2: Open create session modal, and check close modal functionality
                console.log('🟢 Step 2: Opening create session modal...');

                await page.getByTestId('create-new-session-btn').click();
                let createSessionModal = page.getByTestId('create-session-modal')
                await expect(createSessionModal).toBeVisible();
                console.log('👀 Create session modal opened (first time)');

                // check close modal on X button
                await page.getByTestId('cancel-create-session').click()
                await expect(createSessionModal).not.toBeVisible();
                console.log('❌ Modal closed via X button');

                await page.getByTestId('create-new-session-btn').click();
                await expect(createSessionModal).toBeVisible();
                console.log('👀 Create session modal opened (second time)');

                // check close modal on cancel button
                await page.getByTestId('create-session-modal-cancel').click()
                await expect(createSessionModal).not.toBeVisible();
                console.log('❌ Modal closed via Cancel button');

                await page.getByTestId('create-new-session-btn').click();
                await expect(createSessionModal).toBeVisible();
                console.log('👀 Create session modal opened (third time)');

                // Step 3: Validation for required fields
                console.log('🟢 Step 3: Checking validation for required fields...');
                // Check email and application both field blank
                await page.getByTestId('submit-create-session').click()
                await expect(createSessionModal).toBeVisible();
                await expect(page.getByTestId('crt-session-application-error')).toBeVisible();
                await expect(page.getByTestId('crt-session-email-error')).toBeVisible();
                console.log('⚠️ Validation shows error for blank application and email fields as expected.');

                // Step 4: Validation for only email filled
                console.log('🟢 Step 4: Checking validation for only email field...');
                const emailField = page.getByTestId('crt-session-email-field')
                await emailField.fill(userData.email)
                await page.getByTestId('submit-create-session').click()
                await expect(createSessionModal).toBeVisible();
                await expect(page.getByTestId('crt-session-application-error')).toBeVisible();
                await expect(page.getByTestId('crt-session-email-error')).not.toBeVisible();
                console.log('⚠️ Validation error shown for missing application only.');

                // Step 5: Validation for only application filled
                console.log('🟢 Step 5: Checking validation for only application field...');
                await page.reload();
                await page.waitForTimeout(3000)
                await page.getByTestId('create-new-session-btn').click();
                await expect(createSessionModal).toBeVisible();
                await fillOrganizationField(page, orgnization);
                const appField = page.getByTestId('crt-session-application-field')
                await fillMultiselect(page, appField, [application])
                await page.getByTestId('submit-create-session').click()
                await expect(createSessionModal).toBeVisible();
                await expect(page.getByTestId('crt-session-application-error')).not.toBeVisible();
                await expect(page.getByTestId('crt-session-email-error')).toBeVisible();
                console.log('⚠️ Validation error shown for missing email only.');

                // Step 6: Fill out the session details (first name, last name, email, invite)
                console.log('🟢 Step 6: Filling out session creation form...');
                const fnField = page.getByTestId('crt-session-first-name-field')
                await fnField.fill(userData.first_name);
                console.log('📝 Filled first name');

                const lnField = page.getByTestId('crt-session-last-name-field')
                await lnField.fill(userData.last_name);
                console.log('📝 Filled last name');

                await emailField.fill(userData.email);
                console.log('📧 Filled email');

                // fill invite check test
                const inviteCheckField = page.getByTestId('crt-session-invite-checkbox')
                if (!await inviteCheckField.isChecked()) {
                    await inviteCheckField.check()
                    console.log('☑️ Invite checkbox checked');
                } else {
                    console.log('☑️ Invite checkbox already checked');
                }

                // Step 7: Submit the session creation form
                console.log('🚀 Step 7: Submitting session creation form...');
                const [sessionResponse] = await Promise.all([
                    page.waitForResponse(resp => resp.url().includes('/sessions')
                        && resp.ok()
                        && resp.request().method() === 'POST'
                    ),
                    page.getByTestId('submit-create-session').click()
                ]);

                const { data: session } = await waitForJsonResponse(sessionResponse);
                createdSessionId = session.id;
                console.log(`🎉 Session created! Session ID: ${session.id}`);

                // Step 8: Verify session details
                await expect(session.applicant.guest.first_name).toBe(userData.first_name);
                await expect(session.applicant.guest.last_name).toBe(userData.last_name);
                await expect(session.applicant.guest.email).toBe(userData.email);
                await expect(session.application.name).toBe(application);
                console.log('🔍 Verified all expected session fields and values!');

                // Step 9: Navigate to session and validate UI navigation
                console.log('🟢 Step 9: Checking navigation to session detail page...');
                const currentUrl = page.url();
                if (currentUrl.includes(`/applicants/all/${session.id}`)) {
                    console.log('🧭 User landed directly on applicants/all page.');
                    await expect(page.locator(`.application-card[data-session='${session.id}']`)).toBeVisible();
                    console.log('✅ Application card for session is visible.');
                } else {
                    console.log('🔎 Searching for created session in grid...');
                    await searchSessionWithText(session.id);
                    const sessionLocator = await findSessionLocator(page, `.application-card[data-session="${session.id}"]`);

                    const [sessionResponse] = await Promise.all([
                        page.waitForResponse(resp => resp.url().includes(`/sessions/${session.id}?fields[session]`)
                            && resp.request().method() === 'GET'),
                        sessionLocator.click()
                    ]);

                    await expect(sessionResponse.ok()).toBeTruthy();
                    console.log('✅ Able to locate and open the application card for created session.');
                }
                console.log('🎉✅ All steps completed successfully!');

            } catch (error) {
                allTestsPassed = false;
                console.log('❌ Test failed at some step. Error:', error);
                throw error;
            }
        })
    test.afterAll(async ({ request }) => {
        await cleanupSession(request, createdSessionId, allTestsPassed);
    });
})

async function fillOrganizationField(page, orgnization) {
    const orgField = page.getByTestId('crt-session-organization-field');

    console.log('🔁 (Helper) Filling Organization field and waiting for response...');
    await Promise.all([
        page.waitForResponse(resp => {
            const url = decodeURIComponent(resp.url());
            if (!url.startsWith(`${joinUrl(app.urls.api, '/applications')}`)) return false;
            try {
                const parsed = new URL(resp.url());
                const filters = parsed.searchParams.get('filters');
                if (!filters) return false;
                const filtersObj = JSON.parse(filters);
                if (Array.isArray(filtersObj?.$and)) {
                    for (const elem of filtersObj.$and) {
                        if (elem?.$has?.organization?.$or?.id?.$in
                            && Array.isArray(elem.$has.organization.$or.id.$in)
                            && elem.$has.organization.$or.id.$in.length > 0) {
                            return true;
                        }
                    }
                }
            } catch (e) {
                return false;
            }
            return false;
        }),
        fillMultiselect(page, orgField, [orgnization])
    ]);
    console.log('🏢 Organization field filled.');
}
