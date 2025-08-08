import { test, expect } from '@playwright/test';
import loginForm from '~/tests/utils/login-form';
import { admin } from '~/tests/test_config';
import { checkHeaderAndProfileMenu, checkSidebarMenusAndTitles } from '~/tests/utils/common';

test('C40 - Frontend Heartbeat', {
  tag: ['@core', '@smoke', '@regression'],
}, async ({ page }) => {
  await page.goto('/');
  await loginForm.fill(page, admin);
  await loginForm.submit(page);
  await expect(page.getByTestId('household-status-alert')).toBeVisible({ timeout: 10_000 });

  // Check header, menu, profile, and applicants submenu
  await checkHeaderAndProfileMenu(page);

  // Check all sidebar menus, submenus, and their titles
  await checkSidebarMenusAndTitles(page);
}); 