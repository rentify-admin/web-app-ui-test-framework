import { admin, app } from '~/tests/test_config';
import loginForm from '~/tests/utils/login-form';
import { customUrlDecode, getRandomEmail } from './utils/helper';
import { waitForJsonResponse } from './utils/wait-response';
import { expect, test } from './fixtures/enhanced-cleanup-fixture';

test.describe('org_member_application_binding_scoping_check', () => {

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
            tag: ['@smoke', '@regression'],
            timeout: 180_000  // 5 minutes
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

            await page.locator(`a[href="/organizations/${orgList[0].id}/show"]`).click();

            await expect(page.getByTestId('users-tab')).toBeVisible({ timeout: 5000 });

            await page.getByTestId('users-tab').click();

            const memberSearchInput = await page.getByTestId('orgnanization-members-search')

            const createOrgMemberBtn = await page.getByTestId('create-org-member-btn');

            await createOrgMemberBtn.click();

            await page.getByRole('textbox', { name: 'Email' }).click();
            await page.getByRole('textbox', { name: 'Email' }).fill(user.email);
            await page.getByRole('textbox', { name: 'Email' }).press('Tab');
            await page.getByText('empty role').click();
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
            await applicantPage.locator('div').filter({ hasText: /^Coming Soon\.\.\.$/ }).click();

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

            await page.getByRole('textbox', { name: 'Search Applications' }).click();
            await page.getByRole('textbox', { name: 'Search Applications' }).fill(firstAppName);
            const app1 = await page.getByRole('checkbox', { name: firstAppName })
            if (!await app1.isChecked()) {
                await app1.check({ timeout: 2000 });
            }
            await page.getByTestId('save-app-permission-btn').click();
            await page.getByRole('textbox', { name: 'Search Permissions' }).click();
            await page.getByRole('textbox', { name: 'Search Permissions' }).fill('view sessions');
            const perm1 = await page.getByRole('checkbox', { name: 'View Sessions' });
            if (!await perm1.isChecked()) {
                await perm1.check({ timeout: 2000 });
            }
            await page.getByRole('button', { name: 'Save Permissions' }).nth(1).click();

            await applicantPage.reload();

            await applicantPage.locator('#sidebar').hover();
            await applicantPage.locator('.sidebar-action').click();

            await applicantPage.getByTestId('applicants-menu').click();
            await applicantPage.getByTestId('applicants-submenu').click();
            await applicantPage.waitForTimeout(1000);
            const sidepanel = await applicantPage.getByTestId('side-panel');
            const sideItems = await sidepanel.locator('.application-card');

            const sideItemsCount = await sideItems.count();

            await sideItems.nth(0).click()

            for (let index = 0; index < sideItemsCount.length; index++) {
                const element = await sideItems.nth(0);
                await expect(element).toContainText(firstAppName)
            }


            const allTab = await applicantPage.locator('a[href="/applicants/all"]', { hasText: 'All' });
            const allTabbadge = await allTab.locator('.bg-information-primary')
            await expect(allTabbadge).toHaveText('1')

            await page.getByRole('textbox', { name: 'Search Applications' }).click();
            await page.getByRole('textbox', { name: 'Search Applications' }).fill(secondAppName);
            const app2 = await page.getByRole('checkbox', { name: secondAppName })
            if (!await app2.isChecked()) {
                await app2.check({ timeout: 2000 });
            }
            await page.getByTestId('save-app-permission-btn').click();

            await applicantPage.reload();
            try {
                await applicantPage.getByTestId('new-session-btn').click({ timeout: 3000 })
            } catch (err) {

            }

            await expect(allTabbadge).toHaveText('2')
            const element1 = await sideItems.nth(0);
            await expect(element1).toContainText(secondAppName)
            const element2 = await sideItems.nth(1);
            await expect(element2).toContainText(firstAppName)

        })


})  