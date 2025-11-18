import { test, expect } from '@playwright/test';
import loginForm from './utils/login-form';
import { admin } from './test_config';
import { navigateToSubMenu, verifyListContent } from './utils/heartbeat-helper';

test.describe('heartbeat_users_menu.spec', () => {

    test('Should check User menu heartbeat', {
        tag: ['@core', '@smoke', '@regression', '@critical', '@staging-ready', '@rc-ready'],
    }, async ({ page }) => {

        // 1. Setup and Login
        await loginForm.adminLoginAndNavigate(page, admin);

        // 2. Expand 'Users' Menu if necessary
        const usersMenu = page.getByTestId('users-menu');
        const isUsersExpanded = await usersMenu.evaluate(element => element.classList.contains('sidebar-item-open'));

        if (!isUsersExpanded) {
            await usersMenu.click();
        }

        // 3. Verify Users Page
        const userSubMenu = page.getByTestId('users-submenu');
        const isUsersSubMenuActive = await userSubMenu.evaluate(item => item.classList.contains('sidebar-active'));

        const usersData = await navigateToSubMenu(page, userSubMenu, '/users?', isUsersSubMenuActive);
        // We use optional chaining or a fallback array to handle potentially missing data property
        await verifyListContent(page, usersData?.data || [], 'email', 'Users list');

        // 4. Verify Roles Page
        const rolesSubMenu = page.getByTestId('roles-submenu');
        await expect(rolesSubMenu).toBeVisible();

        // Pass 'false' for isActive as clicking the Users link made it active, so Roles is now inactive
        const rolesData = await navigateToSubMenu(page, rolesSubMenu, '/roles?', false);
        await verifyListContent(page, rolesData?.data || [], 'name', 'Roles list');

        // 5. Verify Permissions Page
        const permissionSubMenu = page.getByTestId('permissions-submenu');
        await expect(permissionSubMenu).toBeVisible();

        // Pass 'false' for isActive
        const permissionsData = await navigateToSubMenu(page, permissionSubMenu, '/permissions?', false);
        await verifyListContent(page, permissionsData?.data || [], 'display_name', 'Permissions list');
    });
});