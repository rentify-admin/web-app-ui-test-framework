

/**
 * 
 * @param {import("@playwright/test").Page} page 
 */
const logout = async (page) => {

    const useDropdownBtn = page.getByTestId('user-dropdown-toggle-btn');
    await useDropdownBtn.click();

    const logoutBtn = page.getByTestId('user-logout-dropdown-item');
    const logoutPromise = page.waitForResponse(resp =>
        resp.url().includes('/auth') &&
        resp.request().method() === 'DELETE' &&
        resp.ok()
    )
    await logoutBtn.click();

    await logoutPromise;

}

const guestLogout = async (page) => {
    const profileDropDown = page.getByTestId('profile-dropdown-btn');
    await profileDropDown.click();
    const logoutBtn = page.getByTestId('logout-dropdown-btn');
    await logoutBtn.click();
    await page.waitForResponse(resp =>
        resp.url().includes('/auth') &&
        resp.request().method() === 'DELETE' &&
        resp.ok())
}

export {
    logout,
    guestLogout
}