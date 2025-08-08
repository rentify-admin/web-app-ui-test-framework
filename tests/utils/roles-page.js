import { expect } from '@playwright/test';

const checkRolesVisibleInTable = async (page, roles) => {
    const roleTableEl = await page.getByTestId('roles-table');

    await expect(roleTableEl).toBeVisible();

    const roletrEl = await roleTableEl.locator('tbody>tr');

    for (let index = 0;index < roles.length;index++) {
        const element = roles[index];
        if (roles[index].name) {
            await expect(roletrEl.nth(index).locator('td')
                .nth(0)).toHaveText(element.name);
        }
    }
};


export { checkRolesVisibleInTable };
