import { expect } from '@playwright/test';
import { waitForJsonResponse } from './wait-response';

/**
 * Check Flags loaded in view details
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} viewDetailBtn
 */
const checkFlagsAreLoaded = async (page, viewDetailBtn) => {
    console.log('🚀 Check Flags loaded in view details');

    // const [ flagResponse ] = await Promise.all([
    //     page.waitForResponse(resp => /\/sessions\/.{36}\/flags/.test(resp.url())
    //         && resp.request().method() === 'GET'
    //         && resp.ok()),
    //     page.reload()
    // ]);

    await viewDetailBtn.click();

    const flagsection = await page.getByTestId('report-view-details-flags-section');

    await page.waitForTimeout(1000);

    await expect(flagsection).toBeVisible();

    const flags = await flagsection.locator('li[id^="flag-"]');
    const flagCount = await flags.count();

    await expect(flagCount).toBeGreaterThan(0);

    // Close event history modal
    await page.getByTestId('close-event-history-modal').click();
};

/**
 * Check Rent Budget Edit
 * @param {import('@playwright/test').Page} page
 */
const checkRentBudgetEdit = async page => {
    console.log('🚀 Should Allow User to Edit Rent Budget');

    await page.getByTestId('rent-budget-edit-btn').click();

    await page.locator('#rent-budget-input').fill('500');

    const rentBudgetSubmitBtn = page.getByTestId('submit-rent-budget');

    // Set up response listener and immediately trigger the action
    const [ rentUpdateResponse ] = await Promise.all([
        page.waitForResponse(resp => /\/sessions\/.{36}/.test(resp.url())
            && resp.request().method() === 'PATCH'
            && resp.ok()),
        rentBudgetSubmitBtn.click()
    ]);

    const rentUpdateResponseData = await waitForJsonResponse(rentUpdateResponse);

    await expect(rentUpdateResponseData).not.toBeNull();
};

/**
 * Check By Approving and Rejecting Session
 * @param {import('@playwright/test').Page} page
 */
const checkSessionApproveReject = async page => {
    console.log('🚀 Should Allow user to approve/reject session');

    const approveBtn = page.getByTestId('approve-session-btn');
    await page.waitForTimeout(700);
    
    // Retry mechanism: Try up to 5 times to make approve button visible
    let maxAttempts = 5;
    let attempt = 0;
    while (!await approveBtn.isVisible() && attempt < maxAttempts) {
        attempt++;
        console.log(`⚠️ Approve button not visible, clicking session-action-btn (attempt ${attempt}/${maxAttempts})...`);
        await page.getByTestId('session-action-btn').click();
        await page.waitForTimeout(1000);
    }

    if (!await approveBtn.isVisible()) {
        throw new Error(`❌ Approve button not visible after ${maxAttempts} attempts`);
    }

    // ✅ Poll until approve button is ENABLED (async flag processing may take time)
    console.log('✅ Approve button visible, polling until it becomes enabled...');
    
    const maxPollingAttempts = 30; // 30 attempts * 1 second = 30 seconds max
    let pollingAttempt = 0;
    let isEnabled = false;
    
    while (pollingAttempt < maxPollingAttempts && !isEnabled) {
        pollingAttempt++;
        
        const hasDisabledClass = await approveBtn.evaluate(el => 
            el.classList.contains('pointer-events-none')
        );
        
        if (!hasDisabledClass) {
            isEnabled = true;
            console.log(`✅ Approve button is now enabled (attempt ${pollingAttempt}/${maxPollingAttempts})`);
        } else {
            console.log(`   ⏳ Waiting for approve button to be enabled (attempt ${pollingAttempt}/${maxPollingAttempts})...`);
            await page.waitForTimeout(1000);
        }
    }
    
    if (!isEnabled) {
        console.log('⚠️ Approve button is still disabled after 30 seconds. This usually means flags need to be resolved or session is not in approvable state.');
        throw new Error('❌ Approve button is disabled (has pointer-events-none class) after 30 seconds. Check if all flags are resolved and session is in approvable state.');
    }
    
    console.log('✅ Approve button is ready, proceeding to click...');
    await approveBtn.click();

    const confirmBtn = page.getByTestId('confirm-btn');

    console.log('🔍 Setting up confirm approve response listener...');
    // Set up response listener and immediately trigger the action
    const [ confirmApproveResponse ] = await Promise.all([
        page.waitForResponse(resp => {
            const url = resp.url();
            const method = resp.request().method();
            const status = resp.status();
            console.log(`📡 Confirm approve response: ${method} ${url} - Status: ${status}`);
            return /\/sessions\/.{36}/.test(url)
                && method === 'PATCH'
                && resp.ok();
        }),
        confirmBtn.click()
    ]);

    await waitForJsonResponse(confirmApproveResponse);

    const rejectBtn = await page.getByTestId('reject-session-btn');
    if (!await rejectBtn.isVisible()) {
        await page.getByTestId('session-action-btn').click();
    }
    await rejectBtn.click();

    const confirmBtn2 = page.getByTestId('confirm-btn');

    console.log('🔍 Setting up confirm reject response listener...');
    // Set up response listener and immediately trigger the action
    const [ rejectResponse ] = await Promise.all([
        page.waitForResponse(resp => {
            const url = resp.url();
            const method = resp.request().method();
            const status = resp.status();
            console.log(`📡 Confirm reject response: ${method} ${url} - Status: ${status}`);
            return /\/sessions\/.{36}/.test(url)
                && method === 'PATCH'
                && resp.ok();
        }),
        confirmBtn2.click()
    ]);

    await waitForJsonResponse(rejectResponse);
};

/**
 * Session should export pdf
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').BrowserContext} context
 * @param {string} sessionId
 */

/**
 * Can Request additional information
 * @param {import('@playwright/test').Page} page
 */
const canRequestAdditionalDocuments = async page => {
    console.log('🚀 Should Allow User to Add Additional Documents');

    // Wait a bit for the page to fully render
    await page.waitForTimeout(1000);

    // First, check if session-action-btn exists and is visible
    const actionBtn = page.getByTestId('session-action-btn');
    const actionBtnVisible = await actionBtn.isVisible({ timeout: 10000 }).catch(() => false);
    
    if (!actionBtnVisible) {
        console.log('⚠️ session-action-btn is not visible - checking if dropdown should render...');
        // Check if request-additional-btn exists at all (might be in DOM but hidden)
        const requestBtnCount = await page.getByTestId('request-additional-btn').count();
        if (requestBtnCount === 0) {
            // Check if the session has the required step by looking at the page
            const hasFinancialSection = await page.getByTestId('financial-section').count() > 0;
            console.log(`📊 Debug info: hasFinancialSection=${hasFinancialSection}, requestBtnCount=${requestBtnCount}`);
            throw new Error(`session-action-btn is not visible. User may lack required permissions or session may not have financial/employment/identity steps. Financial section exists: ${hasFinancialSection}`);
        }
    }

    // Try to get request-additional-btn
    let btn = page.getByTestId('request-additional-btn');
    await page.waitForTimeout(700);
    
    // Check if button is visible
    const isVisible = await btn.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (!isVisible) {
        console.log('⚠️ request-additional-btn not visible, clicking session-action-btn to open dropdown...');
        // Click the dropdown button to open it
        await actionBtn.click({ timeout: 10000 });
        // Wait a bit for dropdown to open
        await page.waitForTimeout(500);
        // Check again if button is now visible
        const isVisibleAfterClick = await btn.isVisible({ timeout: 2000 }).catch(() => false);
        if (!isVisibleAfterClick) {
            // Check if button exists in DOM at all
            const btnCount = await btn.count();
            if (btnCount === 0) {
                throw new Error('request-additional-btn does not exist. Session may not have financial/employment/identity steps, or user lacks REQUEST_SESSION_FINANCIAL_CONNECTION permission.');
            } else {
                throw new Error('request-additional-btn exists but is not visible after opening dropdown. It may be hidden by other conditions.');
            }
        }
    }
    
    await btn.click({ timeout: 5000 });

    const availableChecks = [
        'financial_connection',
        'pay_stub',
        'bank_statement',
        'identity_verification',
        'employment_connection'
    ];

    const checkButtons = await page.locator('input[name="checks"]');

    for (let it = 0;it < await checkButtons.count();it++) {
        const value = await checkButtons.nth(it).getAttribute('value');
        await expect(availableChecks).toContain(value);
    }

    await page.getByTestId('cancel-request-additional').click();
};

/**
 * Can invite Applicant
 * @param {import('@playwright/test').Page} page
 */
const canInviteApplicant = async page => {
    console.log('🚀 Should Allow User to Invite Applicant');

    // First, check if there's an open modal and close it
    const modalBackdrop = page.locator('.modal-backdrop');
    if (await modalBackdrop.isVisible()) {
        console.log('🚀 Modal detected, closing it first...');

        // Try to find and click a close button or escape key
        const closeBtn = page.getByTestId('close').or(page.locator('.modal-close, .btn-close, .close-btn'));
        if (await closeBtn.isVisible()) {
            await closeBtn.click();
        } else {

            // If no close button found, try pressing Escape
            await page.keyboard.press('Escape');
        }
        await page.waitForTimeout(1000);
    }

    // First check if the invite button is already visible
    const btn = page.getByTestId('invite-applicant');

    if (!await btn.isVisible()) {

        // If not visible, click the session action button to open the dropdown
        const actionBtn = page.getByTestId('session-action-btn');
        await actionBtn.click();

        // Wait for the dropdown to open and the invite button to become visible
        await page.waitForTimeout(1000);

        // Wait for the invite button to be visible with a timeout
        await expect(btn).toBeVisible({ timeout: 10000 });
    }

    // Now click the invite button
    await btn.click();

    // Wait for the modal to open and click on applicant role
    await page.waitForTimeout(500);
    await page.getByTestId('applicant-role').click();

    // Verify the role options are present
    await expect(page.locator('#applicant-role-0')).toHaveText('Co-App');
    await expect(page.locator('#applicant-role-1')).toHaveText('Guarantor');

    // Close the modal
    await page.getByTestId('invite-modal-cancel').click();
};

/**
 * Can Upload Bank statement and paystub
 * @param {import('@playwright/test').Page} page
 */
const canUploadBankStatementAndPaystub = async page => {
    console.log('🚀 Should Allow User to Upload Bank Statement and Paystub');

    const btn = await page.getByTestId('upload-document-btn');
    await page.waitForTimeout(700);
    if (!await btn.isVisible()) {
        await page.getByTestId('session-action-btn').click();
    }
    await btn.click();

    await page.getByTestId('select-applicant').click();
    await page.waitForTimeout(500);
    await page.locator('#select-applicant-0').click();

    await page.getByTestId('select-document').click();
    await page.waitForTimeout(500);

    const documentOptions = await page.locator('[id*="select-document-"]');
    const values = [ 'Paystub', 'Bank Statement (Financial)' ];

    for (let it = 0;it < await documentOptions.count();it++) {
        const text = await documentOptions.nth(it).innerText();
        await expect(values).toContain(text);
    }

    await page.getByTestId('upload-document-cancel').click();
};

/**
 * Can Merge Session
 * @param {Array} sessions
 * @param {import('@playwright/test').Page} page
 */
const canMergeSession = async (sessions, page) => {
    console.log('🚀 Should Allow User to Merge Session');

    for (let it = 0;it < sessions.length;it++) {
        const sessionID = sessions[it]?.id;
        await page.locator(`.application-card[data-session="${sessionID}"] input[type=checkbox]`).click();
    }

    await expect(page.getByTestId('merge-session-btn')).toBeVisible();

    for (let it = 0;it < sessions.length;it++) {
        const sessionID = sessions[it]?.id;
        await page.locator(`.application-card[data-session="${sessionID}"] input[type=checkbox]`).click();
    }
};

/**
 * Can Delete Applicant
 * @param {import('@playwright/test').Page} page
 * @param {Object} session
 */
const canDeleteApplicant = async (page, session) => {
    console.log('🚀 Should Allow User to Delete Applicant');
    const [ childSession ] = session.children;
    const applicantRaw = await page.getByTestId(`raw-${childSession.id}`);

    await applicantRaw.getByTestId('overview-applicant-btn').click();

    await page.getByTestId(`remove-from-household-${childSession.id}`)
        .click();

    expect(page.getByTestId('confirm-box')).toBeVisible();
    expect(page.getByTestId('confirm-box')).toContainText('Are you sure you want to delete this member from the household');
    await page.getByTestId('cancel-btn').click();
};

export {
    checkFlagsAreLoaded,
    checkRentBudgetEdit,
    checkSessionApproveReject,
    canRequestAdditionalDocuments,
    canInviteApplicant,
    canUploadBankStatementAndPaystub,
    canMergeSession,
    canDeleteApplicant
};
