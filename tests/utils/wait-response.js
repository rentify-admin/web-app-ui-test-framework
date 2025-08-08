import { test } from '@playwright/test';


const waitForJsonResponse = async response => {
    const responseContentType = response.headers()['content-type'];
    let data = null;
    if (responseContentType && responseContentType.includes('application/json')) {
        try {
            data = await response.json();
        } catch (err) {
            console.error('Error parsing JSON response:', err);
            data = JSON.parse(await response.text());
            console.error('Raw response body:', data);
        }
        return data;
    }
    data = await response.text();
    test.fail('API did not return JSON.');
};

export { waitForJsonResponse };
