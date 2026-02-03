import { test, expect } from '@playwright/test';
import loginForm from './utils/login-form';
import { admin } from './test_config';
import { waitForJsonResponse } from './utils/wait-response';
import { findSessionLocator } from './utils/report-page';


test.describe('vc1102_dashboard_locale_switcher_persistence.spec', () => {

    test('should persist locale selection across sessions', async ({ page }) => {
        console.log('[STEP 1] - Log in as admin and set locale to English');
        await page.goto('/');

        console.log('    > Filling in login form');
        await loginForm.fill(page, admin);

        const sessionsPromise = page.waitForResponse(resp =>
            resp.url().includes('/sessions?')
            && resp.url().includes('fields[session]')
            && resp.ok()
            && resp.request().method() === 'GET');
        console.log('    > Submitting login form');
        await loginForm.submit(page);
        console.log('    > Waiting for dashboard to load');
        const sessionsResponse = await sessionsPromise;
        const { data: sessions } = await waitForJsonResponse(sessionsResponse);
        // Verify that the dashboard is displayed
        await expect(page).toHaveTitle(/Applicants/, { timeout: 10_000 });
        // Change locale to French using the locale switcher
        console.log('[STEP 2] - Change locale to Spanish using the locale switcher');

        const languageTextDiv = page.getByTestId('applicants-menu')

        const locale = await page.evaluate(() => localStorage.getItem('locale'));
        expect(locale).toBe(null)

        console.log('    > Locating locale switcher');
        const localeSwitcher = page.getByTestId('locale-switcher-toggle');
        await expect(localeSwitcher).toBeVisible();

        await localeSwitcher.getByTestId('locale-switcher-toggle-btn').click();

        const spanishOption = localeSwitcher.getByTestId('locale-switcher-option-ES');
        await expect(spanishOption).toBeVisible();
        const englishOption = localeSwitcher.getByTestId('locale-switcher-option-EN');
        // check spanish option have class pointer events none or disabled
        console.log('    > Checking if Spanish option is disabled');
        const spanishOptionClass = await spanishOption.getAttribute('class');
        if (spanishOptionClass.includes('pointer-events-none') || spanishOptionClass.includes('disabled')) {
            console.log('    > Spanish option is disabled, switching to English first');
            const enLocalePromise = page.waitForResponse(resp =>
                resp.url().includes('/users/')
                && resp.ok()
                && resp.request().method() === 'PATCH');
            await englishOption.click({ timeout: 5000 });
            await enLocalePromise;
            await page.waitForTimeout(1000); // wait for locale to change
            await localeSwitcher.getByTestId('locale-switcher-toggle-btn').click();
        }
        console.log('    > Switching to Spanish locale');
        const textNow = await languageTextDiv.textContent();

        const spanishLocalePromise = page.waitForResponse(resp =>
            resp.url().includes('/users/')
            && resp.ok()
            && resp.request().method() === 'PATCH');
        await spanishOption.click({ timeout: 5000 });
        await spanishLocalePromise;

        // Verify that the locale has changed to Spanish
        await expect(languageTextDiv).not.toHaveText(textNow);
        console.log('    > Locale has been changed to Spanish');
        await page.waitForTimeout(1000); // wait for locale to change 
        const newLocale = await page.evaluate(() => localStorage.getItem('locale'));
        expect(newLocale).toBe('es-es');

        console.log('[STEP 3] - Verify locale persistence across session changes');
        // change session to simulate logout/login
        const sessionId = sessions[sessions.length - 1].id;

        const sessionLocator = await findSessionLocator(page, `.application-card[data-session="${sessionId}"]`);

        const sessionPromise = page.waitForResponse(resp =>
            resp.url().includes(`/sessions/${sessionId}?`)
            && resp.url().includes(`fields[session]`)
            && resp.ok()
            && resp.request().method() === 'GET');
        console.log('    > Changing to another session');
        await sessionLocator.click();

        const sessionResponse = await sessionPromise;
        await waitForJsonResponse(sessionResponse);

        await page.waitForTimeout(1000); // wait for locale to potentially change

        // Verify that the locale is still Spanish after reloading the session
        console.log('    > Verifying locale persistence after session change');
        await expect(languageTextDiv).not.toHaveText(textNow);

        const persistedLocale = await page.evaluate(() => localStorage.getItem('locale'));
        expect(persistedLocale).toBe('es-es');

        // change another session and check locale again
        const anotherSessionId = sessions[sessions.length - 2].id;
        const anotherSessionLocator = await findSessionLocator(page, `.application-card[data-session="${anotherSessionId}"]`);

        const anotherSessionPromise = page.waitForResponse(resp =>
            resp.url().includes(`/sessions/${anotherSessionId}?`)
            && resp.url().includes(`fields[session]`)
            && resp.ok()
            && resp.request().method() === 'GET');
        console.log('    > Changing to another session again');
        await anotherSessionLocator.click();
        const anotherSessionResponse = await anotherSessionPromise;
        await waitForJsonResponse(anotherSessionResponse);

        await page.waitForTimeout(1000); // wait for locale to potentially change
        // Verify that the locale is still Spanish after reloading another session
        console.log('    > Verifying locale persistence after changing another session');
        await expect(languageTextDiv).not.toHaveText(textNow);
        const persistedLocaleAgain = await page.evaluate(() => localStorage.getItem('locale'));
        expect(persistedLocaleAgain).toBe('es-es');

        console.log('    > Switching back to English locale');
        await localeSwitcher.getByTestId('locale-switcher-toggle-btn').click();
        await expect(englishOption).toBeVisible();
        const enLocalePromise = page.waitForResponse(resp =>
            resp.url().includes('/users/')
            && resp.ok()
            && resp.request().method() === 'PATCH');
        await englishOption.click({ timeout: 5000 });
        await enLocalePromise;

        await page.waitForTimeout(1000); // wait for locale to change
        const finalLocale = await page.evaluate(() => localStorage.getItem('locale'));
        expect(finalLocale).toBe('en-us');
        console.log('    > Locale switched back to English successfully');

    })
})