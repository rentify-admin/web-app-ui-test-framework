import { test, expect } from '@playwright/test';
import {
    findAndInviteApplication,
    searchApplication
} from '~/tests/utils/applications-page';
import { joinUrl } from '~/tests/utils/helper';
import { admin, app } from '~/tests/test_config';
import generateSessionForm from '~/tests/utils/generate-session-form';
import loginForm from '~/tests/utils/login-form';
import { waitForJsonResponse } from '~/tests/utils/wait-response';
import { fillMultiselect, gotoPage } from '~/tests/utils/common';
import {
    completePaystubConnection,
    completePlaidFinancialStep,
    fillhouseholdForm,
    handleOptionalStateModal,
    selectApplicantType,
    updateRentBudget
} from '~/tests/utils/session-flow';
import {
    checkFinancialSectionData,
    findSessionLocator,
    searchSessionWithText
} from '~/tests/utils/report-page';

const applicationName = 'AutoTest Suite - Full Test';

const API_URL = app.urls.api;

const user = {
    first_name: 'Playwright',
    last_name: 'User',
    email: 'playwright+effect@verifast.com'
};
const coapplicant = {
    first_name: 'Playwright',
    last_name: 'CoApp',
    email: 'playwright+coapp@verifast.com'
};

test.describe('co_applicant_effect_on_session_test', () => {
    test('Should complete applicant flow with co-applicant effect on session', {
        tag: ['@regression'],
    }, async ({ page, browser }) => {
        test.setTimeout(300000);
        
        // Step 1: Admin Login and Navigate to Applications
        await loginForm.adminLoginAndNavigate(page, admin);
        
        // Step 2: Find and Invite Application
        await findAndInviteApplication(page, applicationName);
        
        // Step 3: Generate Session and Extract Link
        const { sessionId, sessionUrl, link }
            = await generateSessionForm.generateSessionAndExtractLink(page, user);
        
        const linkUrl = new URL(link);
        
        // Step 4: Open Invite link
        const context = await browser.newContext();
        
        const applicantPage = await context.newPage();
        await applicantPage.goto(
            joinUrl(`${app.urls.app}`, `${linkUrl.pathname}${linkUrl.search}`)
        );
    
        // Step 5: Select Applicant Type on Page
        await selectApplicantType(applicantPage, sessionUrl);
    
        // Step 6: Select state in the state modal
        await handleOptionalStateModal(applicantPage);
        await applicantPage.waitForTimeout(500);
    
        // Step 7: Complete rent budget step
        await updateRentBudget(applicantPage, sessionId);
    
        // Step 8: Check coapplicant assignable
        await expect(
            applicantPage.getByTestId('applicant-invite-step')
        ).toBeVisible();
    
        const applicant = await fillhouseholdForm(applicantPage, coapplicant);
    
        await applicantPage.waitForTimeout(1000);
    
        await applicantPage
            .locator('[data-testid="applicant-invite-continue-btn"]:visible')
            .click({ timeout: 20_000 });
    
        await applicantPage
            .getByTestId('skip-id-verification-btn')
            .click({ timeout: 20_000 });
    
        await completePlaidFinancialStep(applicantPage);
    
        await completePaystubConnection(applicantPage);
    
        await applicantPage.waitForTimeout(500);
    
        await Promise.all([
            applicantPage.waitForResponse(
                resp => resp.url().includes(`/sessions/${sessionId}/steps/`)
                    && resp.ok()
                    && resp.request().method() === 'PATCH'
            ),
            applicantPage.getByTestId('employment-step-continue').click()
        ]);
    
        await applicantPage.close();
    
        await gotoPage(
            page,
            'applicants-menu',
            'applicants-submenu',
            '/sessions?fields[session]'
        );
    
        await page.waitForTimeout(1000);
    
        await searchSessionWithText(page, sessionId);
    
        const sessionLocator = await findSessionLocator(
            page,
            `.application-card[data-session="${sessionId}"]`
        );
    
        const [ sessionResponse ] = await Promise.all([
            page.waitForResponse(
                resp => resp.url().includes(`/sessions/${sessionId}?fields[session]`)
                    && resp.ok()
                    && resp.request().method() === 'GET'
            ),
            sessionLocator.click()
        ]);
    
        const session = await waitForJsonResponse(sessionResponse);
    
        await expect(session.data.children.length).toBeGreaterThan(0);
    
        await expect(
            session.data.children.filter(item => item.role === 'APPLICANT').length
        ).toBeGreaterThan(0);
    
        const monthlyIncome = session.data.state?.summary?.total_income;
    
        const rentBudgetRatio
            = session.data.state?.summary?.total_target_to_income_ratio;
    
        await page.getByTestId('session-action-btn').click({ timeout: 10_000 });
    
        await page.getByTestId('invite-applicant').click({ timeout: 10_000 });
    
        await page
            .getByTestId(`reinvite-${session.data?.children[0]?.applicant?.id}`)
            .click({ timeout: 10_000 });
    
        await page.waitForTimeout(500);
    
        await page
            .getByTestId(
                `copy-invite-link-${session.data?.children[0]?.applicant?.id}`
            )
            .click({ timeout: 10_000 });
        
        await page.getByTestId('invite-modal-cancel').click();
        
        const copiedLink = await page.evaluate(
            async () => await navigator.clipboard.readText()
        );
    
        const coAppLinkUrl = new URL(copiedLink);
    
        const newPageContext = await browser.newContext();
    
        const coAppPage = await newPageContext.newPage();
    
        const coAppSessionApiUrl = joinUrl(app.urls.api, coAppLinkUrl.pathname);
    
        const [ coSessionResp ] = await Promise.all([
            coAppPage.waitForResponse(
                resp => resp.url().includes(coAppSessionApiUrl)
                    && resp.ok()
                    && resp.request().method() === 'GET'
            ),
            coAppPage.goto(
                joinUrl(
                    app.urls.app,
                    `${coAppLinkUrl.pathname}${coAppLinkUrl.search}`
                )
            )
        ]);
    
        const coAppSession = await waitForJsonResponse(coSessionResp);
    
        await selectApplicantType(coAppPage, coAppSessionApiUrl);
    
        await handleOptionalStateModal(coAppPage);
    
        await coAppPage.waitForTimeout(1000);
    
        await coAppPage
            .getByTestId('skip-id-verification-btn')
            .click({ timeout: 20_000 });
    
        await coAppPage.waitForTimeout(1000);
    
        await completePlaidFinancialStep(coAppPage);
    
        await completePaystubConnection(coAppPage);
    
        await Promise.all([
            coAppPage.waitForResponse(
                resp => resp
                    .url()
                    .includes(`/sessions/${coAppSession.data.id}/steps/`)
                    && resp.ok()
                    && resp.request().method() === 'PATCH'
            ),
            coAppPage.getByTestId('employment-step-continue').click()
        ]);
    
        await coAppPage.close();
    
        const allSessionWithChildren = [ session.data, ...session.data.children ];
    
        const [ sessionResponse1, financialResponse ] = await Promise.all([
            page.waitForResponse(
                resp => resp.url().includes(`/sessions/${sessionId}?fields[session]`)
                    && resp.ok()
                    && resp.request().method() === 'GET'
            ),
            Promise.all([
                ...allSessionWithChildren.map(sess => {
                    const regex = new RegExp(
                        `.+/financial-verifications?.+filters=.+{"session_id":{"\\$in":\\["${sess.id}"\\].+`,
                        'i'
                    );
                    return page.waitForResponse(
                        resp => regex.test(decodeURI(resp.url()))
                            && resp.request().method() === 'GET'
                            && resp.ok()
                    );
                })
            ]),
            page.reload()
        ]);
    
        await searchSessionWithText(page, sessionId);
    
        const sessionLocator1 = await findSessionLocator(
            page,
            `.application-card[data-session="${sessionId}"]`
        );
    
        const newSession = await waitForJsonResponse(sessionResponse1);
        const financialData = await Promise.all(
            financialResponse.map(item => waitForJsonResponse(item))
        );
    
        const allSessions = [ newSession.data, ...newSession.data.children ];
    
        const monthlyIncome1 = newSession.data.state?.summary?.total_income;
    
        const rentBudgetRatio1
            = newSession.data.state?.summary?.total_target_to_income_ratio;
    
        // expect(monthlyIncome).not.toBe(monthlyIncome1);
        // expect(rentBudgetRatio).not.toBe(rentBudgetRatio1);
    
        await page.getByTestId('income-source-section-header').click();
    
        // Check All applicant Income Sources Awailable
        await Promise.all([
            Promise.all([
                ...allSessions.map(sess => page.waitForResponse(
                    resp => resp
                        .url()
                        .includes(`/sessions/${sess.id}/income-sources`)
                            && resp.ok()
                            && resp.request().method() === 'GET'
                ))
            ]),
            page.getByTestId('income-source-section-header').click()
        ]);
    
        await page.waitForTimeout(500);
    
        const applicantIncomeSources = await page.locator(
            '[data-testid^="applicant-income-source-"]'
        );
    
        for (
            let index = 0;
            index < await applicantIncomeSources.count();
            index++
        ) {
            const element = applicantIncomeSources.nth(index);
        
            const incomeSourceCount = await element
                .locator('[data-testid^="income-source-"]')
                .count();
        
            await expect(incomeSourceCount).toBeGreaterThan(0);
        }
    
        // Check All applicant Employment Data Awailable
    
        await page.getByTestId('employment-section').click();
    
        const applicantEmployments = await page.locator(
            '[data-testid^="applicant-employment-"]'
        );
    
        for (let index = 0;index < await applicantEmployments.count();index++) {
            const element = applicantEmployments.nth(index);
            const employmentCount = await element.locator('tbody>tr').count();
            await expect(employmentCount).toBeGreaterThan(0);
        }
        await checkFinancialSectionData(
            page,
            newSession.data,
            sessionLocator1,
                financialData
            );
    });
});
