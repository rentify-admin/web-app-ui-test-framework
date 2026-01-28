import { waitForJsonResponse } from './wait-response';
import { expect, test } from '@playwright/test';

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
const gotoPage = async (page, parentMenuTestId, submenuTestId, url, urlRegex = false) => {
    console.log(`🚀 ~ Navigating to ${parentMenuTestId} > ${submenuTestId}`);

    const menu = await page.getByTestId(parentMenuTestId);
    const navItem = await page.locator('li.nav-item', { has: menu });

    const maxHeight = await navItem.locator('div').first()
        .evaluate(el => window.getComputedStyle(el).maxHeight);
    if (maxHeight === '0px') {
        console.log(`🚀 ~ Expanding menu ${parentMenuTestId}`);
        await page.getByTestId(parentMenuTestId).click();
    }

    // Check if submenu is already selected/active
    const submenuLocator = page.getByTestId(submenuTestId);
    const isActive = await submenuLocator.evaluate(el => {
        return el.classList.contains('sidebar-active');
    }).catch(() => false);

    if (isActive) {
        console.log(`🔄 ~ Submenu ${submenuTestId} is already active, clicking a different submenu first...`);
        
        // Strategy: Click a DIFFERENT submenu first to deselect the target
        // This ensures a fresh click will trigger API calls (similar to prepareSessionForFreshSelection)
        // Find all submenus within the navItem using data-testid (no class selectors)
        const allSubmenuTestIds = await navItem.locator('[data-testid]').evaluateAll(elements => {
            return elements
                .map(el => el.getAttribute('data-testid'))
                .filter(testId => testId && testId.includes('submenu') && testId !== null);
        }).catch(() => []);
        
        // Find a different submenu to click
        const differentSubmenuTestId = allSubmenuTestIds.find(testId => testId !== submenuTestId);
        
        if (differentSubmenuTestId) {
            console.log(`   🖱️ Clicking different submenu: ${differentSubmenuTestId}`);
            const differentSubmenu = page.getByTestId(differentSubmenuTestId);
            await differentSubmenu.click();
            await page.waitForTimeout(2000); // Wait for navigation to complete
            console.log(`   ✅ Different submenu clicked - target is now deselected`);
        } else {
            console.log(`   ⚠️ No other submenu found - proceeding anyway`);
        }
    }

    console.log(`🚀 ~ Waiting for response to ${url}`);
    const [listResponse] = await Promise.all([
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
    for (let index = 0; index < values.length; index++) {
        const item = values[index];
        await selector.locator('input').fill(item);
        
        // Wait a bit for the dropdown options to appear after typing
        await page.waitForTimeout(500);
        
        // Use substring match (case-insensitive) since applicant names may have prefixes like "Autotest - "
        // This allows matching "Merge Coapp" in "Autotest - Merge Coapp"
        const trimmedItem = item.trim();
        const options = selector.locator('ul>li');
        const matchedOption = options.filter({ hasText: new RegExp(escapeRegExp(trimmedItem), 'i') });
        
        // If no match, log available options for debugging
        if (await matchedOption.count() === 0) {
            const optionCount = await options.count();
            console.error(`❌ Could not find option containing "${trimmedItem}"`);
            console.error(`Available options (${optionCount}):`);
            for (let i = 0; i < Math.min(optionCount, 10); i++) {
                const optionText = await options.nth(i).textContent();
                console.error(`  - "${optionText}"`);
            }
            throw new Error(`Option not found: "${trimmedItem}". Available options: ${await options.first().textContent().catch(() => 'none')}`);
        }
        
        await matchedOption.first().click();
    }

};
function escapeRegExp(string) {
    // $& means the whole matched string
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
    const menuBtn = header.getByTestId('user-dropdown-toggle-btn');
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();

    // 3. Verify Profile and Logout links are visible (scoped to header)
    const profileLink = header.getByTestId('user-profile-dropdown-item');
    const logoutLink = header.getByTestId('user-logout-dropdown-item');
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
                'affordable-templates-submenu',
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
            menu: 'reports-menu',
            submenus: [
                'report-sessions-menu',
                'report-verifications-menu',
                'report-files-menu',
                'report-income-sources-menu'
            ]
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

    // Mapping of submenu test IDs to their specific test IDs for heading detection
    const submenuTestIdMap = {
        'applicants-submenu': 'applicant-inbox-heading',
        'approval-status-submenu': 'applicant-inbox-heading',
        'reviewed-submenu': 'applicant-inbox-heading',
        'rejected-submenu': 'applicant-inbox-heading',
        'applications-submenu': 'application-forms-heading',
        'portfolios-submenu': 'portfolios-heading',
        'workflows-submenu': 'workflow-list-heading',
        'affordable-templates-submenu': 'affordable-templates-heading',
        'approval-conditions-submenu': 'approval-conditions-template-list-heading',
        'documents-submenu': null, // Click only, no title check
        'document-policies-submenu': 'document-policies-heading',
        'transaction-tags-submenu': 'tags-heading',
        'keyword-mapping-submenu': 'keyword-mapping-heading',
        'blacklists-submenu': 'blacklists-heading',
        'provider-mapping-submenu': 'provider-mapping-heading',
        'incomesource-configuration-submenu': 'income-configuration-heading',
        'organization-self-submenu': null, // No title check for organization self
        'members-submenu': 'members-heading',
        'report-sessions-menu': 'report-sessions-heading',
        'report-verifications-menu': 'report-verifications-heading',
        'report-files-menu': 'report-files-heading',
        'report-income-sources-menu': 'report-income-sources-heading',
        'users-submenu': 'users-heading',
        'roles-submenu': 'roles-heading',
        'permissions-submenu': 'permissions-heading',
        'document-tester-submenu': 'document-tester-heading',
        'name-tester-submenu': 'name-check-testing-heading',
        'integrations-submenu': 'integrations-heading', // Document Tester
        'devices-setting-submenu': 'devices-heading',
        'devices-setting-submenu': null,
        'notification-setting-submenu': null, // Click only, no title check
        '2fa-setting-submenu': null, // Click only, no title check
    };

    // Mapping for menus without submenus that have page titles to verify
    const menuTestIdMap = { 'organizations-menu': 'organizations-heading' };

    // Iterate through all sidebar menus
    for (let i = 0; i < sidebarMenus.length; i++) {
        const { menu, submenus } = sidebarMenus[i];

        // Step 1: Check menu visibility
        const menuBtn = page.getByTestId(menu);
        await expect(menuBtn).toBeVisible();

        // Step 2: Click menu (except first one which is already expanded)
        if (i !== 0) {
            await menuBtn.click();
            // Wait for submenus to load after clicking main menu
            await page.waitForTimeout(500);
        }

        // Step 3: Handle menus with/without submenus
        if (submenus.length === 0) {

            // For menus without submenus, check test ID if specified
            const testId = menuTestIdMap[menu];
            if (testId) {
                await expect(page.getByTestId(testId)).toBeVisible();
            }

            // Note: address-menu and logout-menu only check visibility, no title verification
        } else {

            // For menus with submenus, check each submenu
            for (const submenu of submenus) {

                // Step 4: Check submenu visibility and click it
                const submenuBtn = page.getByTestId(submenu);
                await expect(submenuBtn).toBeVisible();
                await submenuBtn.click();

                // Step 4.5: Wait for page to load after clicking submenu
                await page.waitForTimeout(1000);

                // Step 5: Check page title using specific test ID (only if testId exists)
                const testId = submenuTestIdMap[submenu];
                if (testId) {
                    await expect(page.getByTestId(testId)).toBeVisible();
                }
                // Note: If testId is null, we only click the submenu but don't check for title
            }
        }
    }
};

/**
 * Generate a unique name with browser prefix and random number
 * Useful for creating unique test data across different browser instances
 *
 * @param {string} baseName - The base name to append to
 * @returns {string} Unique name in format: "baseName_Browser_RandomNumber"
 */
const generateUniqueName = (baseName) => {
    // Infer browser name from Playwright test info
    const info = test.info?.();
    const browserName = info?.project?.use?.browserName || info?.project?.name || 'Browser';
    const browserPrefix = browserName.charAt(0).toUpperCase() + browserName.slice(1);
    const randomNumber = Math.floor(Math.random() * 10000);
    return `${baseName}_${browserPrefix}_${randomNumber}`;
};

export { gotoPage, fillMultiselect, dragAndDrop, checkHeaderAndProfileMenu, checkSidebarMenusAndTitles, generateUniqueName };
