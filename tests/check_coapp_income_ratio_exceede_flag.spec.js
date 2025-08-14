import { test, expect } from '@playwright/test';
import loginForm from '~/tests/utils/login-form';
import { admin, app } from '~/tests/test_config';
import { findAndInviteApplication, gotoApplicationsPage } from '~/tests/utils/applications-page';
import generateSessionForm from '~/tests/utils/generate-session-form';
import { getCentsToDollarsSafe, joinUrl } from '~/tests/utils/helper';
import { completePaystubConnection, fillhouseholdForm, selectApplicantType, updateRentBudget, updateStateModal } from '~/tests/utils/session-flow';
import { gotoPage } from '~/tests/utils/common';
import { findSessionLocator, searchSessionWithText } from '~/tests/utils/report-page';
import { waitForJsonResponse } from '~/tests/utils/wait-response';

const applicationName = 'AutoTest Suite - Full Test';

const user = {
    first_name: 'Playwright',
    last_name: 'Ratio',
    email: 'playwright+ratio@verifast.com'
};

const coapplicant = {
    first_name: 'Playwright',
    last_name: 'CoApp',
    email: 'playwright+coapp@verifast.com'
};


const applicantStep = async applicantPage => {
    await expect(applicantPage.getByTestId('applicant-invite-step')).toBeVisible();

    await fillhouseholdForm(applicantPage, coapplicant);

    await applicantPage.getByTestId('applicant-invite-continue-btn').click({ timeout: 20_000 });
};

const identityStep = async applicantPage => {
    await applicantPage.getByTestId('start-id-verification').click({ timeout: 20_000 });

    const personaIFrame = applicantPage.frameLocator('iframe[src*="withpersona.com"]');

    await personaIFrame.locator('[data-test="button__basic"]').click({ timeout: 20_000 });

    await personaIFrame.locator('[data-test="button__primary"]').click({ timeout: 20_000 });

    await personaIFrame.locator('[data-test="button__primary"]').click({ timeout: 20_000 });

    await personaIFrame.locator('#select__option--dl').click({ timeout: 20_000 });

    await personaIFrame.locator('#government-id-prompt__button--web-camera:not(disabled)').click({ timeout: 20_000 });

    await personaIFrame.locator('#scanner__button--capture:not(disabled)')
        .click({ timeout: 30_000 });
    await personaIFrame.locator('#government_id__use-image:not(disabled)')
        .click({ timeout: 30_000 });
    await personaIFrame.locator('#government-id-prompt__button--web-camera:not(disabled)')
        .click({ timeout: 30_000 });
    await personaIFrame.locator('#scanner__button--capture:not(disabled)')
        .click({ timeout: 30_000 });
    await personaIFrame.locator('#government_id__use-image:not(disabled)')
        .click({ timeout: 30_000 });
    await personaIFrame.locator('#selfie-prompt__button--camera:not(disabled)')
        .click({ timeout: 30_000 });
    await personaIFrame.locator('#selfie-scanner__capture--manual:not(disabled)')
        .click({ timeout: 30_000 });
    await personaIFrame.locator('#selfie-scanner__capture--manual:not(disabled)')
        .click({ timeout: 30_000 });
    await applicantPage.waitForTimeout(2000);
    await personaIFrame.locator('#selfie-scanner__capture--manual:not(disabled)')
        .click({ timeout: 30_000 });
    await applicantPage.waitForTimeout(200);
    await personaIFrame.locator('#complete__button:not(disabled)')
        .click({ timeout: 30_000 });
};

const completePlaidConnection = async (applicantPage, username = 'custom_gig') => {
    await applicantPage.getByTestId('financial-secondary-connect-btn').click({ timeout: 20_000 });

    const pFrame = await applicantPage.frameLocator('#plaid-link-iframe-1');

    const plaidFrame = await pFrame.locator('reach-portal');

    await plaidFrame.locator('#aut-secondary-button').click({ timeout: 20_000 });

    await plaidFrame.locator('[aria-label="Betterment"]').click({ timeout: 20_000 });

    await plaidFrame.locator('#aut-input-0-input').fill(username);

    await plaidFrame.locator('#aut-input-1-input').fill('custom_gig');

    await plaidFrame.locator('#aut-button').click({ timeout: 20_000 });

    await plaidFrame.locator('#aut-button:not([disabled])').click({ timeout: 20_000 });

    await plaidFrame.locator('#aut-secondary-button').click({ timeout: 20_000 });

    await applicantPage.getByTestId('financial-verification-continue-btn').click({ timeout: 20_000 });
};

const checkDollarText = async (rentBudget, rentLocator) => {
    if (rentBudget !== 0) {
        const rentBudgetText = getCentsToDollarsSafe(rentBudget);
        await expect(rentLocator).toContainText(String(rentBudgetText));
    } else {
        await expect(rentLocator).toContainText('N/A');
    }
};

test.describe('check_coapp_income_ratio_exceede_flag', () => {
    test.skip('Should confirm co-applicant income is considered when generating/removing Gross Income Ratio Exceeded flag', { 
        tag: ['@smoke'],
    }, async ({ page, browser }) => {
        test.setTimeout(360000);
        
        // Step 1: Admin Login and Navigate to Applications
        await loginForm.adminLoginAndNavigate(page, admin);

        // Step 2: Navigate to Applications Page
        await gotoApplicationsPage(page);

        // Step 3: Find and Invite Application
        await findAndInviteApplication(page, applicationName);
        
        // Step 4: Generate Session and Extract Link
        const { sessionId, sessionUrl, link } = await generateSessionForm.generateSessionAndExtractLink(page, user);
        
        const linkUrl = new URL(link);
        
        // Step 5: Open Invite link
        const context = await browser.newContext({ permissions: [ 'camera' ] });
        
        const applicantPage = await context.newPage();
        await applicantPage.goto(joinUrl(`${app.urls.app}`, `${linkUrl.pathname}${linkUrl.search}`));
        
        let session;
        
        page.on('response', async response => {
            if (response.url().includes(`/sessions/${sessionId}?fields[session]`)
                    && response.ok()
                    && response.request().method() === 'GET') {
                session = await waitForJsonResponse(response);
                await page.waitForTimeout(1000);
            }
        });
    
        // Step 6: Select Applicant Type on Page
        await selectApplicantType(applicantPage, sessionUrl, '#employed');
    
        await updateStateModal(applicantPage, 'ALABAMA');
    
        await updateRentBudget(applicantPage, sessionId, '2100');
    
        await applicantStep(applicantPage);
    
        await identityStep(applicantPage);
    
    
        // Complete Plaid Connection
        await completePlaidConnection(applicantPage);
    
        // Complete Paystub Connection
        await completePaystubConnection(applicantPage);
    
        await Promise.all([
            applicantPage.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}/steps/`)
                && resp.ok()
                && resp.request().method() === 'PATCH'),
            applicantPage.getByTestId('employment-step-continue').click()
        ]);
    
        await applicantPage.close();
    
        await gotoPage(page, 'applicants-menu', 'applicants-submenu', '/sessions?fields[session]');
    
        await page.waitForTimeout(1000);
    
        await searchSessionWithText(page, sessionId);
    
        const sessionLocator =  await findSessionLocator(page, `.application-card[data-session="${sessionId}"]`);
    
        const [ sessionResponse ] = await Promise.all([
            page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}?fields[session]`)
                && resp.ok()
                && resp.request().method() === 'GET'),
            sessionLocator.click()
        ]);
    
        session = await waitForJsonResponse(sessionResponse);
    
    
        await expect(session.data.children.length).toBeGreaterThan(0);
    
        await expect(session.data.children.filter(item => item.role === 'APPLICANT').length).toBeGreaterThan(0);
    
        const rentLocator = page.getByTestId('rent-budget-edit-btn');
        let rentBudget = session.data?.target ?? 0;
        await checkDollarText(rentBudget, rentLocator);
    
        const monthlyIncomeLocator = await page.getByTestId('report-monthly-income-card');
        let monthlyIncome = session.data.state?.summary?.total_income;
        await checkDollarText(monthlyIncome, monthlyIncomeLocator);
    
    
        const rentRatioLocator = await page.getByTestId('report-rent-income-ratio-card');
        const rentBudgetRatio = session.data.state?.summary?.total_target_to_income_ratio;
        if (rentBudgetRatio) {
            await expect(rentRatioLocator).toContainText(String(rentBudgetRatio));
        }
        console.log('🚀 ~ rentBudgetRatio:', rentBudgetRatio);
    
        if (monthlyIncome !== 0 && rentBudget === 0) {
            rentBudget = session.data?.target ?? 0;
            monthlyIncome = session.data.state?.summary?.total_income;
            const calulatedRatio = Math.round(rentBudget * 100 / monthlyIncome);
            await expect(String(calulatedRatio)).toBe(String(session.data.state?.summary?.total_target_to_income_ratio ?? 'N/A'));
        }
    
        await page.getByTestId('view-details-btn').click({ timeout: 10_000 });
    
        await expect(page.getByTestId('GROSS_INCOME_RATIO_EXCEEDED')).toBeVisible();
    
        await page.getByTestId('close-event-history-modal').click({ timeout: 10_000 });
    
        await page.waitForTimeout(400);
    
        await page.getByTestId('session-action-btn').click({ timeout: 10_000 });
    
        await page.getByTestId('invite-applicant').click({ timeout: 10_000 });
    
        await page.getByTestId(`reinvite-${session.data?.children[0]?.applicant?.id}`).click({ timeout: 10_000 });
    
        await page.waitForTimeout(500);
    
        await page.getByTestId(`copy-invite-link-${session.data?.children[0]?.applicant?.id}`)
            .click({ timeout: 10_000 });
    
        await page.getByTestId('invite-modal-cancel').click();
    
        const copiedLink = await page.evaluate(async () => await navigator.clipboard.readText());
    
        const coAppLinkUrl = new URL(copiedLink);
    
        const newPageContext = await browser.newContext();
    
        const coAppPage = await newPageContext.newPage();
    
        const coAppSessionApiUrl = joinUrl(app.urls.api, coAppLinkUrl.pathname);
    
        const [ coSessionResp ] = await Promise.all([
            coAppPage.waitForResponse(resp => resp.url().includes(coAppSessionApiUrl)
                    && resp.ok()
                    && resp.request().method() === 'GET'),
            coAppPage.goto(joinUrl(app.urls.app, `${coAppLinkUrl.pathname}${coAppLinkUrl.search}`))
        ]);
    
        const coAppSession = await waitForJsonResponse(coSessionResp);
    
        await selectApplicantType(coAppPage, coAppSessionApiUrl, '#other');
    
        await identityStep(coAppPage);
    
        // Complete Plaid Connection
        await completePlaidConnection(coAppPage, 'custom_coffee');
    
        // Complete Paystub Connection
        await completePaystubConnection(coAppPage);
    
        await Promise.all([
            coAppPage.waitForResponse(resp => resp.url().includes(`/sessions/${coAppSession.data.id}/steps/`)
                && resp.ok()
                && resp.request().method() === 'PATCH'),
            coAppPage.getByTestId('employment-step-continue').click()
        ]);
    
        await coAppPage.close();
    
        const [ sessionResponse1 ] = await Promise.all([
            page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}?fields[session]`)
                && resp.ok()
                && resp.request().method() === 'GET'),
            page.reload()
        
        ]);
    
        await searchSessionWithText(page, sessionId);
    
        const newSession = await waitForJsonResponse(sessionResponse1);
    
    
        const rentBudgetNew = newSession.data?.target ?? 0;
        const rentLocatorNew = page.getByTestId('rent-budget-edit-btn');
        await checkDollarText(rentBudgetNew, rentLocatorNew);
    
        const monthlyIncomeNew = newSession.data.state?.summary?.total_income;
        const monthlyIncomeLocatorNew = await page.getByTestId('report-monthly-income-card');
        await checkDollarText(monthlyIncomeNew, monthlyIncomeLocatorNew);
    
        const rentBudgetRatioNew = newSession.data.state?.summary?.total_target_to_income_ratio;
        const rentRatioLocatorNew = await page.getByTestId('report-rent-income-ratio-card');
        await expect(rentRatioLocatorNew).toContainText(String(rentBudgetRatioNew));
        console.log('🚀 ~ rentBudgetRatio:', rentBudgetRatioNew);
    
        if (monthlyIncomeNew !== 0 && rentBudgetNew === 0) {
            const calulatedRatio = Math.round(rentBudgetNew * 100 / monthlyIncomeNew);
            await expect(String(calulatedRatio)).toBe(String(rentBudgetRatioNew));
        }
        await page.getByTestId('view-details-btn').click({ timeout: 20_000 });
    
        await expect(page.getByTestId('GROSS_INCOME_RATIO_EXCEEDED')).toHaveCount(0, { timeout: 20_000 });
    
        await page.getByTestId('close-event-history-modal').click({ timeout: 20_000 });
            await page.waitForTimeout(2000);
    });
});
