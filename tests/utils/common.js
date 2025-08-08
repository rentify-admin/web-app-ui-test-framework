import { waitForJsonResponse } from './wait-response';
import { expect } from '@playwright/test';

/**
 * Goto sidebar menu page
 *
 * @param {import('@playwright/test').Page} page
 * @param {String} parentMenuTestId
 * @param {String} submenuTestId
 * @param {String} url
 * @param {String | RegExp} urlRegex
 * @returns
 */
const gotoPage =  async (page, parentMenuTestId, submenuTestId, url, urlRegex = false) => {
    console.log(`🚀 ~ Navigating to ${parentMenuTestId} > ${submenuTestId}`);

    const menu = await page.getByTestId(parentMenuTestId);
    const navItem = await page.locator('li.nav-item', { has: menu });

    const maxHeight =  await navItem.locator('div').first()
        .evaluate(el => window.getComputedStyle(el).maxHeight);
    if (maxHeight === '0px') {
        console.log(`🚀 ~ Expanding menu ${parentMenuTestId}`);
        await page.getByTestId(parentMenuTestId).click();
    }

    console.log(`🚀 ~ Waiting for response to ${url}`);
    const [ listResponse ] = await Promise.all([
        page.waitForResponse(resp => {
            let isMatch;
            if (urlRegex && url instanceof RegExp) {
                isMatch = url.test(resp.url());
            } else if (!urlRegex && typeof url === 'string') {
                isMatch = resp.url().includes(url);
            } else {
                throw new Error('urlRegex and url type mismatch');
            }
            isMatch = isMatch && resp.request().method() === 'GET' && resp.ok();
            if (typeof url === 'string' && resp.url().includes(url)) {
                console.log(`🚀 ~ Response received: ${resp.url()} - Match: ${isMatch}`);
            }
            return isMatch;
        }, { timeout: 30000 }),
        page.getByTestId(submenuTestId).click()
    ]);

    const { data: responseLIst } = await waitForJsonResponse(listResponse);
    console.log(`🚀 ~ Navigation completed, received ${responseLIst?.length || 0} items`);

    return responseLIst;
};

/**
 * Fill multiselect input with given values
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} selector
 * @param {Array} values
 */
const fillMultiselect = async (page, selector, values) => {
    await selector.locator('.multiselect__tags').first()
        .click();
    for (let index = 0;index < values.length;index++) {
        const item = values[index];
        await selector.locator('input').fill(item);
        await selector.locator('ul>li', { hasText: item }).click();
    }

};

/**
 * Drag and drop Element
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} dragEl
 * @param {import('@playwright/test').Locator} dropEl
 */
const dragAndDrop = async (page, dragEl, dropEl) => {
    const dragElBox = await dragEl.boundingBox();
    const dropElBox = await dropEl.boundingBox();

    const startX = dragElBox.x + dragElBox.width / 2;
    const startY = dragElBox.y + dragElBox.height / 2;

    const targetX = dropElBox.x + dropElBox.width / 4;
    const targetY = dropElBox.y + dropElBox.height / 4;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 5, startY + 5);
    await page.mouse.move(targetX, targetY, { steps: 10 });
    await page.mouse.up();
};

/**
 * Check header and profile menu, then navigate to applicants submenu
 * @param {import('@playwright/test').Page} page
 */
const checkHeaderAndProfileMenu = async page => {

    // 1. Check header is visible
    const header = page.locator('header');
    await expect(header).toBeVisible();

    // 2. Check and click data-testid="-btn" inside header
    const menuBtn = header.locator('[data-testid="user-dropdown-toggle-btn"]');
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();

    // 3. Verify Profile and Logout links are visible (scoped to header)
    const profileLink = header.locator('[data-testid="user-profile-dropdown-item"]');
    const logoutLink = header.locator('[data-testid="user-logout-dropdown-item"]');
    await expect(profileLink).toBeVisible();
    await expect(logoutLink).toBeVisible();

    // 4. Click the Profile link
    await profileLink.click();
    await page.waitForTimeout(1000);
    await profileLink.click();

    // 5. Check 'User Profile' is visible
    await expect(page.getByText('User Profile', { exact: false })).toBeVisible();

    // 6. Click data-testid="applicants-submenu"
    const applicantsSubmenu = page.getByTestId('applicants-submenu');
    await expect(applicantsSubmenu).toBeVisible();
    await applicantsSubmenu.click();
};

/**
 * Comprehensive sidebar navigation test that checks all menus, submenus, and their corresponding page titles.
 * This function performs a complete sidebar navigation verification in a single pass.
 *
 * Flow for each menu:
 * 1. Check menu visibility
 * 2. Click menu (except first one which is already expanded)
 * 3. For menus with submenus: check each submenu visibility, click it, and verify page title
 * 4. For menus without submenus: check page title directly
 *
 * Special cases:
 * - First menu (applicants-menu) is already expanded, so no click needed
 * - Some submenus only check visibility without title verification (documents-submenu, account-setting-submenu, etc.)
 * - Some menus have no submenus and check title directly (organizations-menu, address-menu, logout-menu)
 *
 * @param {import('@playwright/test').Page} page
 */
const checkSidebarMenusAndTitles = async page => {

    // Complete sidebar menu structure with all menus and their submenus
    const sidebarMenus = [
        {
            menu: 'applicants-menu',
            submenus: [
                'applicants-submenu',
                'approval-status-submenu',
                'reviewed-submenu',
                'rejected-submenu'
            ]
        },
        {
            menu: 'applications-menu',
            submenus: [
                'applications-submenu',
                'portfolios-submenu',
                'workflows-submenu',
                'approval-conditions-submenu'
            ]
        },
        {
            menu: 'documents-menu',
            submenus: [
                'documents-submenu',
                'document-policies-submenu'
            ]
        },
        {
            menu: 'transactions-menu',
            submenus: [
                'transaction-tags-submenu',
                'keyword-mapping-submenu',
                'blacklists-submenu',
                'provider-mapping-submenu'
            ]
        },
        {
            menu: 'incomesource-menu',
            submenus: [
                'incomesource-configuration-submenu'
            ]
        },
        {
            menu: 'organization-menu',
            submenus: [
                'organization-self-submenu',
                'members-submenu'
            ]
        },
        {
            menu: 'organizations-menu',
            submenus: [] // No submenus - checks title directly
        },
        {
            menu: 'users-menu',
            submenus: [
                'users-submenu',
                'roles-submenu',
                'permissions-submenu'
            ]
        },
        {
            menu: 'address-menu',
            submenus: [] // No submenus - only checks visibility
        },
        {
            menu: 'tools-menu',
            submenus: [
                'document-tester-submenu',
                'name-tester-submenu',
                'integrations-submenu'
            ]
        },
        {
            menu: 'settings-menu',
            submenus: [
                'account-setting-submenu',
                'devices-setting-submenu',
                'notification-setting-submenu',
                '2fa-setting-submenu'
            ]
        },
        {
            menu: 'logout-menu',
            submenus: [] // No submenus - only checks visibility
        }
    ];

    // Mapping of submenu test IDs to their expected page titles and heading levels
    const submenuTitleMap = {
        'applicants-submenu': { title: 'Applicant Inbox', heading: 3 },
        'approval-status-submenu': { title: 'Applicant Inbox', heading: 3 },
        'reviewed-submenu': { title: 'Applicant Inbox', heading: 3 },
        'rejected-submenu': { title: 'Applicant Inbox', heading: 3 },
        'applications-submenu': { title: 'Application Forms', heading: 3 },
        'portfolios-submenu': { title: 'Portfolios', heading: 3 },
        'workflows-submenu': { title: 'Workflow List', heading: 3 },
        'approval-conditions-submenu': { title: 'Approval Conditions Template List', heading: 3 },
        'documents-submenu': { title: 'Coming Soon...', heading: 3 },
        'document-policies-submenu': { title: 'Document Policies', heading: 3 },
        'transaction-tags-submenu': { title: 'Tags', heading: 3 },
        'keyword-mapping-submenu': { title: 'Keyword Mapping', heading: 3 },
        'blacklists-submenu': { title: 'Blacklists', heading: 3 },
        'provider-mapping-submenu': { title: 'Provider Mapping', heading: 3 },
        'incomesource-configuration-submenu': { title: 'Income Source Configuration', heading: 3 },
        'organization-self-submenu': { title: 'Applications', heading: 5 },
        'members-submenu': { title: 'Members', heading: 3 },
        'users-submenu': { title: 'Users', heading: 3 },
        'roles-submenu': { title: 'Roles', heading: 3 },
        'permissions-submenu': { title: 'Permissions', heading: 3 },
        'document-tester-submenu': { title: 'Document Tester', heading: 3 },
        'name-tester-submenu': { title: 'Name Check Testing', heading: 3 },
        'integrations-submenu': { title: 'Customers', heading: 3 },
        'devices-setting-submenu': { title: 'Devices', heading: 3 },
        '2fa-setting-submenu': { title: 'Two-factor authentication', heading: 3 }
    };

    // Mapping for menus without submenus that have page titles to verify
    const menuTitleMap = { 'organizations-menu': { title: 'Organizations', heading: 3 }};

    // Iterate through all sidebar menus
    for (let i = 0;i < sidebarMenus.length;i++) {
        const { menu, submenus } = sidebarMenus[i];

        // Step 1: Check menu visibility
        const menuBtn = page.getByTestId(menu);
        await expect(menuBtn).toBeVisible();

        // Step 2: Click menu (except first one which is already expanded)
        if (i !== 0) {
            await menuBtn.click();
        }

        // Step 3: Handle menus with/without submenus
        if (submenus.length === 0) {

            // For menus without submenus, check title if specified
            const { title, heading } = menuTitleMap[menu] || {};
            if (title && heading) {
                await expect(page.getByRole('heading', { name: title, level: heading })).toBeVisible();
            }

            // Note: address-menu and logout-menu only check visibility, no title verification
        } else {

            // For menus with submenus, check each submenu
            for (const submenu of submenus) {

                // Step 4: Check submenu visibility and click it
                const submenuBtn = page.getByTestId(submenu);
                await expect(submenuBtn).toBeVisible();
                await submenuBtn.click();

                // Step 5: Check page title (except for special cases that only check visibility)
                const { title, heading } = submenuTitleMap[submenu] || {};
                if (submenu !== 'documents-submenu'
                    && submenu !== 'account-setting-submenu'
                    && submenu !== 'notification-setting-submenu'
                    && title && heading) {
                    await expect(page.getByRole('heading', { name: title, level: heading })).toBeVisible();
                }
            }
        }
    }
};

export { gotoPage, fillMultiselect, dragAndDrop, checkHeaderAndProfileMenu, checkSidebarMenusAndTitles };
