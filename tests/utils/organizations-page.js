import { expect } from '@playwright/test';
import { waitForJsonResponse } from './wait-response';
import { fillMultiselect, gotoPage } from './common';

const gotoOrganizationsPage = async page => {
    const organizationMenu = await page.getByTestId('organization-menu');
    const appNavItem = await page.locator('li.nav-item', { has: organizationMenu });

    const maxHeight =  await appNavItem.locator('div').first()
        .evaluate(el => window.getComputedStyle(el).maxHeight);
    if (maxHeight === 0) {
        await page.getByTestId('organization-menu').click();
    }

    const [ workflowResponse ] = await Promise.all([
        page.waitForResponse(resp => resp.url().includes('workflows?fields[workflow]')
            && resp.request().method() === 'GET'
            && resp.ok()),
        page.getByTestId('workflows-submenu').click()
    ]);

    const { data: workflows } = await waitForJsonResponse(workflowResponse);

    return workflows;

};

const gotoMembersPage = async page => {

    await page.waitForTimeout(1000);
    const reg = new RegExp('.+/organizations/.{36}/members.+?');
    const [ response ]  = await Promise.all([
        page.waitForResponse(resp => {
            console.log(reg.test(resp.url()), resp.url());
            return reg.test(resp.url())
            && resp.request().method() === 'GET'
            && resp.ok();
        }),
        page.getByTestId('users-tab').click()
    ]);

    const { data: responseList } = waitForJsonResponse(response);

    return responseList;

};

const checkFirstRowHasEmail = async (page, email) => {
    // Wait for the search bar to be visible and ready (handles animation delays)
    const searchBar = page.locator('input[placeholder*="Search"]');
    await page.waitForTimeout(1000); //wait for animation
    
    // Ensure the search bar is ready for input by clicking and focusing it first
    await searchBar.click();
    await searchBar.focus();
    await page.waitForTimeout(500); // Small delay to ensure focus is established
    
    // Clear any existing content and fill with the email
    await searchBar.clear();
    await searchBar.fill(email);
    
    // Verify the input was actually filled
    const inputValue = await searchBar.inputValue();
    if (inputValue !== email) {
        console.log(`Search bar input value mismatch. Expected: "${email}", Got: "${inputValue}"`);
        // Try filling again with a more robust approach
        await searchBar.evaluate((el, value) => {
            el.value = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }, email);
    }
    
    // Wait for search results to show only one row with the expected email
    await expect(page.getByTestId('members-table').locator('tbody>tr')).toHaveCount(1);
    await expect(page.getByTestId('members-table').locator('tbody>tr').first().locator('td').nth(1)).toHaveText(email);
};

const addManageAppPermissionAndCheck = async (page, editBtn) => {

    await expect(editBtn).toBeVisible();
    await editBtn.click();

    const memberRoleModal = await page.getByTestId('member-role-modal');
    await expect(memberRoleModal).toBeVisible();

    await expect(page.locator('#all-access-checkbox')).toBeVisible();
    await page.locator('#all-access-checkbox').check();
    await page.waitForTimeout(500);

    const [ permResp, permsResp ] = await Promise.all([
        page.waitForResponse(resp => {
            const reg = new RegExp('.+organizations/.{36}/members/.{36}');
            return reg.test(resp.url())
                    && resp.request().method() === 'PATCH'
                    && resp.ok();
        }),
        page.waitForResponse(resp => {
            const reg = new RegExp('.+organizations/.{36}/members/.{36}.+?');
            return reg.test(resp.url())
                    && resp.request().method() === 'GET'
                    && resp.ok();
        }),
        page.getByTestId('save-app-permission-btn').click()
    ]);

    const { data: perms } = await waitForJsonResponse(permsResp);

    await expect(perms.permissions.length).toBeGreaterThan(0);
    await expect(perms.permissions.filter(pre => pre.name === 'manage_applications').length).toBeGreaterThan(0);

    await page.getByTestId('member-role-modal-cancel').click();
};

const deleteMember = async (page, deleteBtn) => {
    const onDialog = async dialog => {
        if (dialog.type() === 'confirm') {
            dialog.accept();
            await page.off('dialog', onDialog);
        }
    };
    page.on('dialog', onDialog);

    await Promise.all([
        page.waitForResponse(resp => {
            const reg = new RegExp('.+organizations/.{36}/members/.{36}');
            return reg.test(resp.url())
                        && resp.request().method() === 'DELETE'
                        && resp.ok();
        }),
        page.waitForResponse(resp => {
            const reg = new RegExp('.+organizations/.{36}/members');
            return reg.test(resp.url())
                        && resp.request().method() === 'GET'
                        && resp.ok();
        }),
        deleteBtn.click()
    ]);

};

const addOrganizationMember = async (page, data, memberCreateModal) => {
    await page.locator('#member-email').fill(data.email);
    await fillMultiselect(page, await page.getByTestId('member-role-field'), [ data.role ]);

    const [ memberRes, membersRes ] = await Promise.all([
        page.waitForResponse(resp => {
            const reg = new RegExp('.+organizations/.{36}/members');
            console.log(reg.test(resp.url()), resp.request().method());
            return reg.test(resp.url())
                && resp.request().method() === 'POST'
                && resp.ok();
        }),
        page.waitForResponse(resp => {
            const reg = new RegExp('.+organizations/.{36}/members.+?');
            console.log(reg.test(resp.url()), resp.request().method());
            return reg.test(resp.url())
                && resp.request().method() === 'GET'
                && resp.ok();
        }),
        memberCreateModal.getByTestId('submit-create-member').click()
    ]);

    await memberCreateModal.getByTestId('cancel-create-member').click();

    const { data: member } = await waitForJsonResponse(memberRes);
    const { data: members } = await waitForJsonResponse(membersRes);
    return {
        member,
        members
    };
};


export {
    gotoOrganizationsPage,
    gotoMembersPage,
    addManageAppPermissionAndCheck,
    deleteMember,
    addOrganizationMember, 
    checkFirstRowHasEmail
};

