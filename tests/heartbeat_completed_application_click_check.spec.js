import { expect, test } from '@playwright/test';
import { loginWith } from "~/tests/utils/session-utils";
import { searchSessionWithText, findSessionLocator } from "~/tests/utils/report-page";
import { waitForJsonResponse } from "~/tests/utils/wait-response";
import { updateRentBudget } from './utils/session-flow';
import { admin } from './test_config';


test.describe('heartbeat_completed_application_click_check', () => {
    test('Heartbeat Test: Completed Application Clicks (frontend)', async ({ page }) => {

        const sessionId = '0198e279-4ff3-7205-a2d1-78c3a3f7a1e0';

        await page.goto('/');

        console.log('🚀 Login and go to application page')
        await loginWith(page, admin);
        console.log('✅ Done Login and go to application page')

        console.log('🚀 Search session with ID')
        await searchSessionWithText(page, sessionId);
        console.log('✅ session found')

        let session;
        console.log('🚀 Clicking on the session')
        const sessionLocator = await findSessionLocator(page, `.application-card[data-session="${sessionId}"]`);

        const [sessionResponse] = await Promise.all([
            page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}?fields[session]`)
                && resp.ok()
                && resp.request().method() === 'GET'),
            sessionLocator.click()
        ]);

        session = await waitForJsonResponse(sessionResponse);
        console.log('✅ Session Report opened')

        console.log('🚀 Opening session link in the new page')
        const childRaw = await page.getByTestId(`raw-${sessionId}`);
        const nameColumn = await childRaw.locator('td').nth(1);
        await nameColumn.getByTestId('overview-applicant-btn').locator('button').click({ timeout: 5000 });

        const [newPage] = await Promise.all([
            page.waitForEvent("popup"),
            await childRaw.getByTestId('view-applicant-session-btn').click()
        ]);

        await newPage.waitForLoadState();
        console.log('✅ Session openned in the new page')

        console.log('🚀 Checking summary page opened')
        await expect(newPage.getByTestId('summary-step')).toBeVisible({ timeout: 10_000 })

        console.log('✅ On Summary page')

        console.log('🚀 Going to rent budget page')
        await newPage.getByTestId('step-START-lg').filter({
            visible: true
        }).click();

        await expect(newPage.getByTestId('rent-budget-step')).toBeVisible();
        console.log('✅ On Rent budget page')

        console.log('🚀 Filing rent budget')
        await updateRentBudget(newPage, sessionId, '500');
        console.log('✅ Filing rent budget')

        console.log('✅ On Summary page')
        await expect(newPage.getByTestId('summary-step')).toBeVisible({ timeout: 10_000 })

        console.log('🚀 Going to id verification page')
        newPage.getByTestId('step-IDENTITY_VERIFICATION-lg').filter({
            visible: true
        }).click()

        await expect(newPage.getByTestId('identify-step')).toBeVisible({ timeout: 10_000 })

        await expect(newPage.locator('[data-testid^="identity-status-"]').filter({
            visible: true
        })).toBeVisible({timeout:10_000});

        console.log('✅ On Id verification page')

        console.log('🚀 Going to financial verification page')
        await newPage.getByTestId('step-FINANCIAL_VERIFICATION-lg').filter({
            visible: true
        }).click()

        await expect(newPage.getByTestId('financial-verification-step')).toBeVisible({ timeout: 10_000 })
        await expect(newPage.getByTestId('connect-bank')).toBeVisible({ timeout: 10_000 })
        console.log('✅ On financial verification page')
        
        console.log('🚀 Going to employment verification page')
        newPage.getByTestId('step-EMPLOYMENT_VERIFICATION-lg').filter({
            visible: true
        }).click()

        await expect(newPage.getByTestId('employment-verification-step')).toBeVisible({ timeout: 10_000 })
        console.log('✅ On employment verification page')

        console.log('🚀 Clicking continue on the employment verification page')
        await newPage.getByTestId('employment-step-continue').click()
        
        await expect(newPage.getByTestId('summary-step')).toBeVisible({ timeout: 10_000 })
        console.log('✅ On summary page')

        console.log('🚀 checking additional bank connect mx connect modal opens')
        await newPage.getByTestId('financial-verification-row-expand-toggle').click();

        await newPage.waitForTimeout(500);

        await newPage.getByTestId('additional-connect-bank').click();

        const mxFrame = await newPage.frameLocator('[src*="int-widgets.moneydesktop.com"]');
        
        await expect(mxFrame.locator('[data-test="MX-Bank-tile"]')).toBeVisible({ timeout: 20_000 });

        await newPage.getByTestId('bank-connect-modal-cancel').click()
        console.log('✅ Completed mx connect modal check')

    })
})