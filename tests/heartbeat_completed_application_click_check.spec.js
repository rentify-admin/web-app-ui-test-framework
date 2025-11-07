import { expect, test } from '@playwright/test';
import { loginWith, prepareSessionForFreshSelection } from "~/tests/utils/session-utils";
import { searchSessionWithText, findSessionLocator } from "~/tests/utils/report-page";
import { waitForJsonResponse } from "~/tests/utils/wait-response";
import { updateRentBudget, handleOptionalTermsCheckbox } from './utils/session-flow';
import { admin, app } from './test_config';
import { createPermissionTestSession } from './utils/session-generator';
import { cleanupSession } from './utils/cleanup-helper';

let sharedSessionId = null;
let allTestsPassed = true;

test.describe('heartbeat_completed_application_click_check', () => {
    
    // ✅ Create session ONCE before all tests
    test.beforeAll(async ({ browser }) => {
        // ✅ Set explicit timeout for beforeAll hook (300s = 5 minutes)
        test.setTimeout(300000);
        
        console.log('🏗️ Creating complete session for heartbeat test...');
        
        // Create admin page manually (page fixture not available in beforeAll)
        const adminContext = await browser.newContext();
        const adminPage = await adminContext.newPage();
        await adminPage.goto('/');
        
        const { sessionId } = await createPermissionTestSession(adminPage, browser, {
            applicationName: 'Autotest - UI permissions tests',
            firstName: 'Heartbeat',
            lastName: 'ClickTest',
            rentBudget: '600'
        });
        
        sharedSessionId = sessionId;
        console.log('✅ Shared session created:', sessionId);
        
        // Cleanup admin context
        await adminPage.close();
        await adminContext.close();
    });
    
    test('Heartbeat Test: Completed Application Clicks (frontend)', { 
        tag: ['@regression', '@staging-ready']
    }, async ({ page }) => {
        
        try {
            if (!sharedSessionId) {
                throw new Error('Session must be created in beforeAll');
            }
            
            await page.goto('/');

        console.log('🚀 Login and go to application page')
        await loginWith(page, admin);
        console.log('✅ Done Login and go to application page')

        // ✅ SMART FIX: Prepare session for fresh selection (deselect + search)
        const { locator: sessionLocator } = await prepareSessionForFreshSelection(page, sharedSessionId);

        let session;
        console.log('🚀 Clicking on the session');

        const [sessionResponse] = await Promise.all([
            page.waitForResponse(resp => resp.url().includes(`/sessions/${sharedSessionId}?fields[session]`)
                && resp.ok()
                && resp.request().method() === 'GET'),
            sessionLocator.click()
        ]);

        session = await waitForJsonResponse(sessionResponse);
        console.log('✅ Session Report opened')

        console.log('🚀 Opening session link in the new page')
        const childRaw = await page.getByTestId(`raw-${sharedSessionId}`);
        const nameColumn = await childRaw.locator('td').nth(1);
        await nameColumn.getByTestId('overview-applicant-btn').locator('button').click({ timeout: 5000 });

        const [newPage] = await Promise.all([
            page.waitForEvent("popup"),
            await childRaw.getByTestId('view-applicant-session-btn').click()
        ]);

        await newPage.waitForLoadState();
        console.log('✅ Session openned in the new page')

        await handleOptionalTermsCheckbox(newPage);
        console.log('✅ Optional terms checkbox handled')

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
        await updateRentBudget(newPage, sharedSessionId, '600');
        console.log('✅ Filing rent budget')

        console.log('✅ On Summary page')
        await expect(newPage.getByTestId('summary-step')).toBeVisible({ timeout: 10_000 })

        console.log('🚀 Going to id verification page')
        newPage.getByTestId('step-IDENTITY_VERIFICATION-lg').filter({
            visible: true
        }).click()

        await expect(newPage.getByTestId('identify-step')).toBeVisible({ timeout: 10_000 })

        await expect(newPage.getByTestId('identify-step').getByText('Completed').first()).toBeVisible({timeout:10_000});

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
        
        console.log('✅ All step navigation and popup functionality validated')
        
        } catch (error) {
            allTestsPassed = false;
            throw error;
        }
    });
    
    // ✅ Cleanup session after all tests
    test.afterAll(async ({ request }) => {
        await cleanupSession(request, sharedSessionId, allTestsPassed);
    });
});