import { app } from '~/tests/test_config';
import { joinUrl } from '~/tests/utils/helper.js';

const USER_API = joinUrl(app.urls.api, 'users');

const fill = async (page, formData) => {

    await page.locator('#first_name').fill(formData.first_name);

    await page.locator('#last_name').fill(formData.last_name);

    await page.locator('#email').fill(formData.email);

    await page.locator('#password').fill(formData.password);

    await page.locator('#password_confirmation').fill(formData.password);

    await page.locator('div[aria-owns="listbox-organization"]').click();

    await page.waitForTimeout(500); // wait for the listbox to open

    await page.locator('li[id^=organization-]', { hasText: formData.organization }).click();

    await page.locator('div[aria-owns="listbox-role"]').click();

    await page.waitForTimeout(500); // wait for the listbox to open

    await page.getByRole('option', { name: formData.role, exact: true })
        .click();

};

const submit = async page => {
    const [ response ] = await Promise.all([
        page.waitForResponse(resp => resp.url() === USER_API
        && resp.request().method() === 'POST'
        && resp.ok()),
        page.getByTestId('submit-user').click()
    ]);

    const contentType = response.headers()['content-type'];
    let userData = null;
    if (contentType && contentType.includes('application/json')) {
        try {
            userData = await response.json();
        } catch (err) {
            console.error('Error parsing JSON response:', err);
            const rawBody = await response.text();
            console.error('Raw response body:', rawBody);
        }
    } else {
        userData = await response.text();
        console.warn('User create response was not JSON. Content-Type:', contentType, 'Body:', userData);
    }
    return userData;
};

export default {
    fill,
    submit
};
