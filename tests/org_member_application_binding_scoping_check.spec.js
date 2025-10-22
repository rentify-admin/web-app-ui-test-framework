import { admin, app } from '~/tests/test_config';
import loginForm from '~/tests/utils/login-form';
import { customUrlDecode, getRandomEmail } from './utils/helper';
import { waitForJsonResponse } from './utils/wait-response';
import { expect, test } from './fixtures/enhanced-cleanup-fixture';

test.describe('QA-102: org_member_application_binding_scoping_check', () => {

    test.afterAll(async ({ cleanupHelper }) => {
        console.log(`🧹 Suite Cleanup: Running afterAll cleanup`);
        try {
            await cleanupHelper.cleanupNow();
            console.log(`✅ Suite Cleanup: Completed`);
        } catch (error) {
            console.log(`ℹ️ Global Cleanup: Cleanup already completed`);
        }
    });

    const organizationName = 'Permissions Test Org';
    const firstAppName = 'Test App P1';
    const secondAppName = 'Test App P2';
    let user;

    test('Check Application Binding Scoping (Inbox Visibility)',
        {
            tag: ['@regression'],
            timeout: 180_000  // 3 minutes
        }, async ({ page, browser, cleanupHelper }) => {

            user = {
                first_name: 'Test',
                last_name: 'User',
                email: getRandomEmail(),
                password: 'password',

            }


            await loginForm.adminLoginAndNavigate(page, admin)

            await expect(page.getByTestId('household-status-alert')).toBeVisible(10_000)

            await page.getByTestId('organizations-menu').click()

            await expect(page.getByTestId('organizations-heading')).toBeVisible({ timeout: 10_000 });

            await page.waitForTimeout(2000)

            const searchInput = await page.locator('input[placeholder="Search"]');

            const reg = new RegExp(`.+/organizations\\?.+${organizationName}.+?`, 'i');
            const [orgSearchResponse] = await Promise.all([
                page.waitForResponse(resp => {
                    const decodedUrl = customUrlDecode(resp.url());
                    const matches = reg.test(decodedUrl) && resp.request().method() === 'GET' && resp.ok();
                    return matches;
                }),
                searchInput.pressSequentially(organizationName)
            ]);
            const { data: orgList } = await waitForJsonResponse(orgSearchResponse);
            if (orgList.length === 0) {
                throw new Error('Organization not found in search')
            }
            
            const expectedOrgId = orgList[0].id;
            console.log(`ℹ️ Found organization "${organizationName}" with ID: ${expectedOrgId}`);

            await page.locator(`a[href="/organizations/${orgList[0].id}/show"]`).click();

            await expect(page.getByTestId('users-tab')).toBeVisible({ timeout: 5000 });

            await page.getByTestId('users-tab').click();

            const memberSearchInput = await page.getByTestId('orgnanization-members-search')

            const createOrgMemberBtn = await page.getByTestId('create-org-member-btn');

            await createOrgMemberBtn.click();

            await page.getByRole('textbox', { name: 'Email' }).click();
            await page.getByRole('textbox', { name: 'Email' }).fill(user.email);
            await page.getByRole('textbox', { name: 'Email' }).press('Tab');
            await page.getByText('empty role v2').click();
            await page.getByTestId('submit-create-member').click();
            await page.getByTestId('copy-invitation-link').click();

            let invitationUrl = (await page.getByText(`${app.urls.app}/invitations/`).textContent()).trim();

            await page.getByTestId('org-user-create-modal-cancel').click();

            const context = await browser.newContext();
            const applicantPage = await context.newPage();
            await applicantPage.goto(invitationUrl);
            await applicantPage.waitForTimeout(2000);
            await applicantPage.getByRole('textbox', { name: 'First Name' }).fill(user.first_name);
            await applicantPage.getByRole('textbox', { name: 'First Name' }).press('Tab');
            await applicantPage.getByRole('textbox', { name: 'Last Name' }).fill(user.last_name);
            await applicantPage.getByRole('textbox', { name: 'Last Name' }).press('Tab');
            await applicantPage.getByRole('textbox', { name: 'Password', exact: true }).fill(user.password);
            await applicantPage.getByRole('textbox', { name: 'Password', exact: true }).press('Tab');
            await applicantPage.getByRole('textbox', { name: 'Confirm Password' }).fill(user.password);
            await applicantPage.locator('#terms').check();
            await applicantPage.getByRole('button', { name: 'Register' }).click();
            await applicantPage.getByRole('textbox', { name: 'Email Address' }).click();
            await applicantPage.getByRole('textbox', { name: 'Email Address' }).fill(user.email);
            await applicantPage.getByRole('textbox', { name: 'Email Address' }).press('Tab');
            await applicantPage.getByRole('textbox', { name: 'Password' }).fill(user.password);
            await applicantPage.getByTestId('admin-login-btn').click();
            //await applicantPage.locator('div').filter({ hasText: /^Coming Soon\.\.\.$/ }).click();
            
            // Wait for authentication to complete
            await expect(applicantPage.getByTestId('user-dropdown-toggle-btn')).toBeVisible({ timeout: 15000 });
            
            await expect(applicantPage.getByTestId('applicants-menu')).not.toBeVisible();

            await memberSearchInput.click();
            const escapedEmail = user.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const memberreg = new RegExp(`.+/members\\?.+${escapedEmail}.+?`, 'i');
            const [searchResp] = await Promise.all([
                page.waitForResponse(resp => {
                    const decodedUrl = customUrlDecode(resp.url());
                    const matches = memberreg.test(decodedUrl) && resp.request().method() === 'GET' && resp.ok();
                    return matches;
                }),
                memberSearchInput.fill(user.email)
            ]);
            const { data: responseLIst } = await waitForJsonResponse(searchResp);
            if (responseLIst.length === 0) {
                throw new Error('Member not found in search')
            }
            await page.getByTestId(`edit-${responseLIst[0].id}`).click();

            cleanupHelper.trackUser(responseLIst[0].user)

            await page.getByRole('textbox', { name: 'Search Permissions' }).click();
            await page.getByRole('textbox', { name: 'Search Permissions' }).fill('view sessions');
            const perm1 = await page.getByRole('checkbox', { name: 'View Sessions' });
            if (!await perm1.isChecked()) {
                await perm1.check({ timeout: 2000 });
            }
            await page.getByRole('button', { name: 'Save Permissions' }).nth(1).click();

            await applicantPage.reload();

            await applicantPage.waitForTimeout(3000);

            await applicantPage.locator('#sidebar').hover();
            await applicantPage.locator('.sidebar-action').click();

            await applicantPage.getByTestId('applicants-menu').click();

            const [sessionsResponse, orgSelfResponse] = await Promise.all([
                applicantPage.waitForResponse(resp => resp.url().includes('/sessions?fields[session]=')
                    && resp.request().method() === 'GET'
                    && resp.ok()
                ),
                applicantPage.waitForResponse(resp => resp.url().includes('/organizations/self?fields[organization]=scope')
                    && resp.request().method() === 'GET'
                    && resp.ok()
                ),
                applicantPage.getByTestId('applicants-submenu').click()
            ])

            await applicantPage.waitForTimeout(1000);

            // Get the organization ID from the user's context
            const orgSelfData = await waitForJsonResponse(orgSelfResponse);
            const userOrgId = orgSelfData.data?.id;
            console.log(`ℹ️ User's organization ID from /organizations/self: ${userOrgId}`);

            // Verify it matches the expected org ID we found earlier
            await expect(userOrgId).toBe(expectedOrgId);
            console.log(`✅ Verified: User belongs to "${organizationName}" (ID: ${expectedOrgId})`);

            // Extract limit from API response URL
            const responseUrl = sessionsResponse.url();
            const urlParams = new URLSearchParams(responseUrl.split('?')[1]);
            const apiLimit = parseInt(urlParams.get('limit') || '12');
            const sessionsData = await waitForJsonResponse(sessionsResponse);
            const apiReturnedCount = sessionsData.data.length;
            
            console.log(`ℹ️ API limit parameter: ${apiLimit}`);
            console.log(`ℹ️ API returned: ${apiReturnedCount} sessions`);

            let sidepanel = await applicantPage.getByTestId('side-panel');
            let sideItems = await sidepanel.locator('.application-card');
            let sideItemsCount = await sideItems.count();

            // With view_sessions permission (no view_applications binding), user sees ALL org sessions
            console.log(`ℹ️ UI displays: ${sideItemsCount} sessions`);
            await expect(sideItemsCount).toBe(Math.min(apiLimit, apiReturnedCount));
            console.log('✅ Verified: User with view_sessions sees all org sessions (no application binding filter yet)');

            await page.getByRole('textbox', { name: 'Search Applications' }).click();
            await page.getByRole('textbox', { name: 'Search Applications' }).fill(firstAppName);
            const app1 = await page.getByRole('checkbox', { name: firstAppName })
            if (!await app1.isChecked()) {
                await app1.check({ timeout: 2000 });
            }
            await page.getByTestId('save-app-permission-btn').click();

            await Promise.all([
                applicantPage.waitForResponse(resp => resp.url().includes('/sessions?fields[session]=')
                    && resp.request().method() === 'GET'
                    && resp.ok()
                ),
                applicantPage.reload()
            ])

            await applicantPage.waitForTimeout(3000);

            sidepanel = await applicantPage.getByTestId('side-panel');
            sideItems = await sidepanel.locator('.application-card');
            sideItemsCount = await sideItems.count();

            // After binding to App1, sessions should be filtered to App1 only
            const initialCountAfterApp1Binding = sideItemsCount;
            console.log(`ℹ️ Sessions visible after App1 binding: ${initialCountAfterApp1Binding}`);
            await expect(sideItemsCount).toBeGreaterThan(0);
            console.log('✅ Verified: App1 binding applied, sessions visible');

            await sideItems.nth(0).click()

            // Verify all visible sessions are from App1
            for (let index = 0; index < sideItemsCount; index++) {
                const element = await sideItems.nth(index);
                await expect(element).toContainText(firstAppName)
            }
            console.log(`✅ Verified: All ${sideItemsCount} visible sessions belong to ${firstAppName}`);

            const allTab = await applicantPage.locator('a[href="/applicants/all"]', { hasText: 'All' });
            const allTabbadge = await allTab.locator('.bg-information-primary')
            const app1BadgeCount = await allTabbadge.textContent();
            console.log(`ℹ️ Badge count after App1 binding: ${app1BadgeCount}`);

            await page.getByRole('textbox', { name: 'Search Applications' }).click();
            await page.getByRole('textbox', { name: 'Search Applications' }).fill(secondAppName);
            const app2 = await page.getByRole('checkbox', { name: secondAppName })
            if (!await app2.isChecked()) {
                await app2.check({ timeout: 2000 });
            }
            await page.getByTestId('save-app-permission-btn').click();

            await Promise.all([
                applicantPage.waitForResponse(resp => resp.url().includes('/sessions?fields[session]=')
                    && resp.request().method() === 'GET'
                    && resp.ok()
                ),
                applicantPage.reload()
            ]);

            try {
                await applicantPage.getByTestId('new-session-btn').click({ timeout: 3000 })
            } catch (err) {

            }

            await expect(allTabbadge).toHaveText('2')

            sidepanel = await applicantPage.getByTestId('side-panel');
            sideItems = await sidepanel.locator('.application-card');
            sideItemsCount = await sideItems.count();

            await expect(sideItemsCount).toBeGreaterThan(0)

            await sideItems.nth(0).click()

            for (let index = 0; index < sideItemsCount; index++) {
                const element = await sideItems.nth(index);
                const firstTextLocator = element.getByText(firstAppName);
                const secondTextLocator = element.getByText(secondAppName);

                const combinedLocator = firstTextLocator.or(secondTextLocator);

                await expect(combinedLocator).toBeVisible();
            }
            console.log(`✅ Verified: All ${sideItemsCount} sessions belong to ${firstAppName} OR ${secondAppName}`);

        })


})  