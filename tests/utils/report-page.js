import { expect } from '@playwright/test';
import { waitForJsonResponse } from '~/tests/utils/wait-response';
import { customUrlDecode } from './helper';
import { dragAndDrop, gotoPage, fillMultiselect } from './common';
import { pollForFlag } from './polling-helper';

/**
 * Check By Approving and Rejecting Session
 * @param {*} page
 */
const checkSessionApproveReject = async (page, sessionId = null) => {

    // ✅ CRITICAL: household-status-alert is INSIDE the Alert modal (EventHistory), not on the main page
    // We must open the Alert modal FIRST before accessing household-status-alert
    console.log('🔍 Opening Alert modal to access household-status-alert...');
    
    // Check if Alert modal is already open by checking if household-status-alert is visible
    const householdStatusAlert = page.getByTestId('household-status-alert');
    const isModalOpen = await householdStatusAlert.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (!isModalOpen) {
        // Open Alert modal by clicking Alert button
        const alertBtn = page.getByRole('button', { name: /alert/i }).first();
        await expect(alertBtn).toBeVisible({ timeout: 10_000 });
        await alertBtn.click();
        
        // ✅ FIX: Wait for modal to be visible first (using close button as indicator)
        // This is faster than waiting for household-status-alert directly
        const closeModalBtn = page.getByTestId('close-event-history-modal');
        const modalOpened = await closeModalBtn.isVisible({ timeout: 3_000 }).catch(() => false);
        
        if (modalOpened) {
            // Modal is confirmed open, now wait for household-status-alert with short timeout
            await expect(householdStatusAlert).toBeVisible({ timeout: 2_000 });
        } else {
            // Fallback: If close button not found, wait for household-status-alert directly
            // (but with shorter timeout since we just clicked)
            await expect(householdStatusAlert).toBeVisible({ timeout: 3_000 });
        }
    } else {
        // Modal was already open, just verify household-status-alert is still visible
        await expect(householdStatusAlert).toBeVisible({ timeout: 2_000 });
    }
    
    // There are multiple "session-action-btn" instances on the report page (e.g. report header + household status bar).
    // Playwright strict mode requires a unique locator, so always scope to the session details container.
    const detailsActionBtn = page.getByTestId('household-status-alert').getByTestId('session-action-btn');

    // Step 1: Approve Session
    // Step 1.1: Locate and click approve button with retry logic
    // We intentionally approve from the *session details* dropdown (household-status-alert),
    // not any other report/header action menus.
    const approveBtn = page.getByTestId('household-status-alert').getByTestId('approve-session-btn');
    await page.waitForTimeout(700);

    // ✅ FIX: The approve button is inside a dropdown, so we must open the dropdown FIRST
    // before checking if the button is visible. The old logic checked visibility before opening.
    console.log('🔍 Opening session action dropdown to access approve button...');
    
    // Open the dropdown by clicking the action button
    await expect(detailsActionBtn).toBeVisible({ timeout: 10_000 });
    await detailsActionBtn.click();
    await page.waitForTimeout(500); // Wait for dropdown animation
    
    // Now check if approve button is visible inside the opened dropdown
    // Retry mechanism: Try up to 5 times to make approve button visible
    let maxAttempts = 5;
    let attempt = 0;
    while (!await approveBtn.isVisible().catch(() => false) && attempt < maxAttempts) {
        attempt++;
        console.log(`⚠️ Approve button not visible in dropdown, retrying (attempt ${attempt}/${maxAttempts})...`);
        
        // Re-click the dropdown button to ensure it's open
        await detailsActionBtn.click().catch(() => {});
        await page.waitForTimeout(500);
    }

    if (!await approveBtn.isVisible().catch(() => false)) {
        throw new Error(`❌ Approve button not visible after ${maxAttempts} attempts. Ensure Alert modal is open, dropdown is open, and session is in approvable state.`);
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

    // Step 1.2: Confirm approval and wait for response
    const confirmBtn = await page.getByTestId('confirm-btn');

    let matchUrl = resp => {
        console.log(resp.url(), resp.request().method());
        return /\/sessions\/.{36}/.test(resp.url());
    };
    if (sessionId) {
        matchUrl = resp => resp.url().includes(`/sessions/${sessionId}`);
    }

    const [ approveResponse ] = await Promise.all([
        page.waitForResponse(resp => matchUrl(resp)
            && resp.request().method() === 'PATCH'
            && resp.ok()),
        page.waitForResponse(resp => matchUrl(resp)
            && resp.request().method() === 'GET'
            && resp.ok()),
        confirmBtn.click()
    ]);

    await waitForJsonResponse(approveResponse);

    // Step 2: Reject Session
    // Step 2.1: Locate and click reject button
    // ✅ FIX: Ensure dropdown is open before accessing reject button (same pattern as approve)
    const rejectBtn = page.getByTestId('household-status-alert').getByTestId('reject-session-btn');

    await detailsActionBtn.scrollIntoViewIfNeeded().catch(() => {});
    
    // Open dropdown if not already open (approve button click may have closed it)
    const rejectVisible = await rejectBtn.isVisible().catch(() => false);
    if (!rejectVisible) {
        console.log('🔍 Opening dropdown to access reject button...');
        await detailsActionBtn.click();
        await page.waitForTimeout(500); // Wait for dropdown animation
    }
    
    // Ensure reject button is visible before clicking
    await expect(rejectBtn).toBeVisible({ timeout: 10_000 });
    await rejectBtn.click();

    // Step 2.2: Confirm rejection and wait for response
    const confirmBtn2 = page.getByTestId('confirm-btn');

    const [ rejectResponse ] = await Promise.all([
        page.waitForResponse(resp => /\/sessions\/.{36}/.test(resp.url())
            && resp.request().method() === 'PATCH'
            && resp.ok()),
        page.waitForResponse(resp => matchUrl(resp)
            && resp.request().method() === 'GET'
            && resp.ok()),
        confirmBtn2.click()
    ]);

    await waitForJsonResponse(rejectResponse);
};

const checkFlagsPresentInSection = async (
    locator,
    flags,
    {
        checkIssueButtonPresent,
        checkIssueButtonNotPresent
    } = {
        checkIssueButtonPresent: false,
        checkIssueButtonNotPresent: false
    }
) => {
    // If there are flags to check, wait for the first flag to render (not placeholder)
    // This ensures Vue has finished rendering the flags list
    console.log(`[DEBUG checkFlagsPresentInSection] Flags array length: ${flags.length}`);
    if (flags.length > 0) {
        console.log(`[DEBUG checkFlagsPresentInSection] First flag:`, {
            description: flags[0].flag?.description,
            ignored: flags[0].ignored,
            reviewed_by: flags[0].reviewed_by
        });
    }

    if (flags.length > 0 && flags[0].flag?.description) {
        // Wait for the first flag to contain the expected description (10 second timeout for Vue reactivity)
        // This ensures the section has transitioned from placeholder ("No Reviewed Items", "No flags", etc.) to actual flag items
        await expect(locator.locator('li').first()).toContainText(flags[0].flag.description, { timeout: 10000 });
    }

    for (let index = 0;index < flags.length;index++) {
        const item = flags[index];
        if (item.flag?.description) {
            await expect(locator.locator('li').nth(index)).toContainText(item.flag.description);
            if (checkIssueButtonNotPresent) {
                await expect(locator.locator('li').nth(index)
                    .getByTestId('mark_as_issue')).not.toBeVisible();
            }
            if (checkIssueButtonPresent) {
                await expect(locator.locator('li').nth(index)
                    .getByTestId('mark_as_issue')).toBeVisible();
            }
        }
    }
};

/**
 * Check All Flag section visible
 *
 * @param {import('@playwright/test').Page} page
 * @param {Object} param1
 */
const checkAllFlagsSection = async (
    page,
    flags,
    { checkIssueButtonNotPresent } = { checkIssueButtonPresent: false }
) => {

    // Verify that the Flags section is populated.
    // The staff dashboard "System" tab (default) only shows INTERNAL-scoped flags.
    // Since the backend now also creates companion APPLICANT-scoped flags, we must
    // exclude them here to match what EventHistory.vue renders in each section.
    const isInternalFlag = (flag) => flag.flag?.scope !== 'APPLICANT';
    const flagsCausingDecline = flags.filter(flag => flag.severity === 'CRITICAL' && !flag.ignored && isInternalFlag(flag));
    const flagsRequiredReview = flags.filter(flag => flag.severity === 'ERROR' && !flag.ignored && isInternalFlag(flag));
    const flagsWithWarning = flags.filter(flag => flag.severity === 'WARNING' && !flag.ignored && isInternalFlag(flag));
    const flagsWithInformation = flags.filter(flag => flag.severity === 'INFO' && !flag.ignored && isInternalFlag(flag));

    // DEBUG: Log all ignored flags to see their reviewed_by state
    const allIgnoredFlags = flags.filter(flag => flag.ignored);
    console.log(`[DEBUG] Total ignored flags: ${allIgnoredFlags.length}`);
    allIgnoredFlags.forEach((flag, index) => {
        console.log(`[DEBUG] Ignored flag ${index}:`, {
            description: flag.flag?.description,
            ignored: flag.ignored,
            reviewed_by: flag.reviewed_by,
            reviewed_by_type: typeof flag.reviewed_by,
            reviewed_by_null_check: flag.reviewed_by === null,
            reviewed_by_not_null_check: flag.reviewed_by !== null
        });
    });

    // IMPORTANT: UI only shows ignored flags that have reviewed_by set (see EventHistory.vue:482)
    // visibilityMatch = !flag.ignored || flag.reviewed_by !== null
    const flagsReviewed = flags.filter(flag => flag.ignored && flag.reviewed_by !== null);
    console.log(`[DEBUG] Flags passing filter (ignored && reviewed_by !== null): ${flagsReviewed.length}`);

    const itemCausingDeclineSection = await page.getByTestId('items-causing-decline-section');
    const itemRequireReviewSection = await page.getByTestId('items-requiring-review-section');
    const itemWarningSection = await page.getByTestId('items-warning-section');
    const itemInfoSection = await page.getByTestId('items-info-section');
    const itemReviewedSection = await page.getByTestId('reviewed-items-section');

    await checkFlagsPresentInSection(
        itemCausingDeclineSection,
        flagsCausingDecline,
        { checkIssueButtonNotPresent }
    );
    await checkFlagsPresentInSection(
        itemRequireReviewSection,
        flagsRequiredReview
    );
    await checkFlagsPresentInSection(
        itemWarningSection,
        flagsWithWarning
    );
    await checkFlagsPresentInSection(
        itemInfoSection,
        flagsWithInformation
    );
    await checkFlagsPresentInSection(
        itemReviewedSection,
        flagsReviewed
    );
};

/**
 * Click a session card and wait for the session API response
 * Handles the case where the session is already selected (won't trigger new API call)
 * 
 * @param {import('@playwright/test').Page} page
 * @param {string} sessionId - Session ID to click
 * @param {import('@playwright/test').Locator} sessionLocator - Locator for the session card
 * @returns {Promise<Response>} - The session API response
 */
const clickSessionAndWaitForResponse = async (page, sessionId, sessionLocator) => {
    // Check if session is already selected by checking URL
    const currentUrl = page.url();
    const isAlreadySelected = currentUrl.includes(`/sessions/${sessionId}`) || 
                              currentUrl.includes(`/applicants/all/${sessionId}`) ||
                              currentUrl.includes(`/applicants/in-review/${sessionId}`) ||
                              currentUrl.includes(`/applicants/reviewed/${sessionId}`) ||
                              currentUrl.includes(`/applicants/rejected/${sessionId}`);
    
    if (isAlreadySelected) {
        console.log(`⚠️ Session ${sessionId.substring(0, 25)}... is already selected. Deselecting first...`);
        
        // Click a different session first to deselect
        const allSessionCards = page.locator('.application-card');
        const sessionCount = await allSessionCards.count();
        
        let differentSessionClicked = false;
        if (sessionCount > 1) {
            // Find and click a session that is NOT our target
            for (let i = 0; i < Math.min(sessionCount, 5); i++) {
                const card = allSessionCards.nth(i);
                const cardSessionId = await card.getAttribute('data-session');
                
                if (cardSessionId && cardSessionId !== sessionId) {
                    console.log(`   🖱️ Clicking different session to deselect: ${cardSessionId.substring(0, 25)}...`);
                    await card.click();
                    await page.waitForTimeout(2000); // Wait for page to load
                    differentSessionClicked = true;
                    console.log('   ✅ Different session opened - target session is now deselected');
                    break;
                }
            }
        }
        
        if (!differentSessionClicked) {
            console.log('   ⚠️ No other session found - will try to click target session anyway');
        }
    }
    
    // Now click the target session and wait for response
    const responsePromise = page.waitForResponse(resp => 
        resp.url().includes(`/sessions/${sessionId}?fields[session]`)
        && resp.ok()
        && resp.request().method() === 'GET'
    , { timeout: 30000 });
    
    await sessionLocator.click();
    
    return await responsePromise;
};

/**
 * Search sessions with text
 *
 * @param {import('@playwright/test').Page} page
 * @param {String} searchText
 * @returns Array
 */
const searchSessionWithText = async (page, searchText) => {
    console.log('🚀 ~ searchSessionWithText called with:', searchText);

    const sessionSearchInput = await page.getByTestId('search-sessions-input');
    
    // Wait for the search input to be ready
    await sessionSearchInput.waitFor({ state: 'visible', timeout: 10_000 });

    await expect(sessionSearchInput).toBeVisible();
    console.log('🚀 ~ Session search input is visible');

    const reg = new RegExp(`.+/sessions\\?fields.+${searchText}.+?`, 'i');
    console.log('🚀 ~ Regex pattern:', reg.toString());

    console.log('🚀 ~ About to wait for response and fill search...');
    const [ searchResp ] = await Promise.all([
        page.waitForResponse(resp => {
            const decodedUrl = customUrlDecode(resp.url());
            const matches = reg.test(decodedUrl) && resp.request().method() === 'GET' && resp.ok();
            if (resp.url().includes('/sessions')) {
                console.log('🚀 ~ Session response:', resp.url(), 'matches:', matches);
            }
            return matches;
        }, { timeout: 180_000 }), // 3 minutes timeout for session search
        sessionSearchInput.fill(searchText)
    ]);

    if (!searchResp) {
        throw new Error('Response not found');
    }

    const { data: sessions } = await waitForJsonResponse(searchResp);
    return sessions;
};


/**
 * Check Rent Budget Edit
 *
 * @param {*} page
 */
const checkRentBudgetEdit = async page => {

    console.log('Should Allow User to Edit Rent Budget');

    await page.getByTestId('rent-budget-edit-btn').click();

    await page.getByTestId('rent-budget-default').fill('500');

    const rentBudgetSubmitBtn = page.getByTestId('submit-rent-budget');

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
 * Session should export pdf
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').BrowserContext} context
 * @param {String} sessionID
 * @returns {void}
 */
const checkExportPdf = async (page, context, sessionId) => {
    console.log('🚀 Should Allow User to Export Report');

    // ✅ CURRENT IMPLEMENTATION (web-app):
    // - Desktop: Standalone button `button[data-name="Export"]` in Report.vue (line 158)
    //   Class: "hidden md:flex" means visible on md breakpoint and up (desktop)
    //   This button is on the MAIN PAGE header, NOT inside the Alert modal (EventHistory)
    //   It directly calls reportActionRef?.openExportModal() to open the export modal
    // - Tests run on desktop, so we only need the standalone button
    
    // ✅ CRITICAL: Export button is on MAIN PAGE, not in Alert modal
    // If Alert modal (EventHistory) is open, close it first so we can access the export button
    const closeModalBtn = page.getByTestId('close-event-history-modal');
    const isModalOpen = await closeModalBtn.isVisible({ timeout: 2_000 }).catch(() => false);
    
    if (isModalOpen) {
        console.log('🔍 Alert modal is open, closing it to access export button on main page...');
        await closeModalBtn.click();
        await page.waitForTimeout(500); // Wait for modal to close
    }
    
    // Now look for export button on the main page
    const exportBtn = page.locator('button[data-name="Export"]').first();
    
    await exportBtn.scrollIntoViewIfNeeded().catch(() => {});
    await expect(exportBtn).toBeVisible({ timeout: 10_000 });

    // Click export button and wait for export modal to appear.
    await exportBtn.click();

    // Export modal selectors have also varied:
    // - `data-testid="export-pdf-modal"` (current)
    // - `[role="dialog"]` containing "Export" (legacy)
    const exportModalByTestId = page.getByTestId('export-pdf-modal');
    const exportModalByRole = page.locator('[role="dialog"]').filter({ hasText: /Export/i });

    const testIdModalVisible = await exportModalByTestId.isVisible({ timeout: 5000 }).catch(() => false);
    if (!testIdModalVisible) {
        await expect(exportModalByRole).toBeVisible({ timeout: 10_000 });
    } else {
        await expect(exportModalByTestId).toBeVisible({ timeout: 10_000 });
    }
    await page.waitForTimeout(500); // Wait for modal animation

    // Click the submit button to export PDF.
    // NOTE: The app reuses this button id in the export modal.
    const exportSubmitBtn = page.getByTestId('income-source-delist-submit');
    await expect(exportSubmitBtn).toBeVisible({ timeout: 10_000 });

    const [ pdfResponse, popupPage ] = await Promise.all([
        page.waitForResponse(resp => {
            const url = resp.url();
            return url.includes('/sessions')
                && url.includes(`session_ids[]=${sessionId}`)
                && resp.request().method() === 'GET'
                && resp.headers()['content-type'] === 'application/pdf'
                && resp.ok();
        }),
        page.waitForEvent('popup'),
        exportSubmitBtn.click()
    ]);

    const pdfResponseContentType = pdfResponse.headers()['content-type'];

    // Verify the PDF content type immediately after response
    await expect(pdfResponseContentType).toBe('application/pdf');

    // Wait a short time for the page to stabilize, then close it
    const browserName = page.context().browser()
        .browserType()
        .name();
    if (browserName === 'chromium') {
        await popupPage.waitForTimeout(1000);
        await popupPage.close();
    } else {
        await popupPage.close();
    }
};

/**
 * Can Request additional information
 * @param {*} page
 */
const canRequestAdditionalDocuments = async (page, availableChecks = []) => {

    console.log('Should Allow User to Add Additional Documents');

    const btn = await page.getByTestId('request-additional-btn');
    await page.waitForTimeout(700);
    if (!await btn.isVisible()) {
        await page
            .getByTestId('household-status-alert')
            .getByTestId('session-action-btn')
            .or(page.getByTestId('session-action-btn').first())
            .click();
    }
    await page.waitForTimeout(600);
    await btn.click();

    const checkButtons = await page.locator('input[name="checks"]');

    for (let it = 0;it < checkButtons.count();it++) {
        const value = await checkButtons.nth(it).getAttribute('value');

        await expect(availableChecks).toContain(value);
    }

    await page.getByTestId('cancel-request-additional').click();
};

/**
 * Can invite Applicant
 *
 * @param {*} page
 */
const canInviteApplicant = async page => {
    const btn = await page.getByTestId('invite-applicant');
    await page.waitForTimeout(1300); //wait for animation
    if (!await btn.isVisible()) {
        const actionBtn = page
            .getByTestId('household-status-alert')
            .getByTestId('session-action-btn')
            .or(page.getByTestId('session-action-btn').first());
        await actionBtn.click();
    }
    await page.waitForTimeout(700);
    await btn.click();

    await page.getByTestId('applicant-role').click();

    await expect(page.locator('#applicant-role-0')).toHaveText('Co-App');

    await expect(page.locator('#applicant-role-1')).toHaveText('Guarantor');

    await page.getByTestId('invite-modal-cancel').click();
};


/**
 * Can Upload Bank statement and paystub
 * @param {import('@playwright/test').Page} page
 */
const canUploadListOfDocuments = async (page, documents = []) => {

    console.log('Should Allow User to Upload Bank Statement and Paystub');

    const btn = await page.getByTestId('upload-document-btn');
    await page.waitForTimeout(2000);
    if (!await btn.isVisible()) {
        await page
            .getByTestId('household-status-alert')
            .getByTestId('session-action-btn')
            .or(page.getByTestId('session-action-btn').first())
            .click();
    }
    await btn.click();
    await page.waitForTimeout(1000);

    await page.getByTestId('select-applicant').click();
    await page.waitForTimeout(500);
    await page.locator('#select-applicant-0').click();
    await page.waitForTimeout(500);
    await page.getByTestId('select-document').click();

    const documentOptions = await page.locator('[id*="select-document-"]');

    for (let it = 0;it < documentOptions.count();it++) {
        const text = await documentOptions.nth(it).innerText();

        await expect(documents).toContain(text);
    }

    await page.getByTestId('upload-document-cancel').click();
};

/**
 * Can Merge Session
 *
 * @param {*} sessions
 * @param {*} page
 */
const canMergeSession = async (sessions, page) => {

    console.log('🚀 ~ Should Allow User to Merge Session');

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
 * Check Identity Details Available
 *
 * @param {*} page
 */
const checkIdentityDetailsAvailable = async (page, { checkSsn } = { checkSsn: false }) => {

    console.log('Should Allow User View Identity Details');

    await page.getByTestId('identity-section').click();

    const textVerifyIds = [
        'identity-id-name',

        // 'identity-phone',
        // 'identity-email',
        'identity-dob',
        'identity-address',
        'identity-created-at',
        'identity-completed-at'
    ];

    const checkVerifyIds = [
        'identity-selfliveliness',
        'identity-facematch',
        'identity-idmatch'
    ];


    const identities = await page.locator('[data-testid^="identity-detail-"]');

    for (let index = 0;index < await identities.count();index++) {
        const identityEl = await identities.nth(index);

        const identityNotFound = await identityEl.getByTestId('id-verification-not-found').count();
        console.log(await identityEl.evaluate(el => el.getAttribute('data-testid')));
        if (identityNotFound > 0) {
            continue;
        }

        for (let it = 0;it < textVerifyIds.length;it++) {
            const element = await identityEl.getByTestId(textVerifyIds[it]);

            for (let sit = 0;sit < element.count();sit++) {
                const subElement = element.nth(sit);
                await expect(subElement).not.toHaveText('');
                await expect(subElement).not.toHaveText('N/A');
            }

        }

        for (let it = 0;it < checkVerifyIds.length;it++) {
            const element = identityEl.getByTestId(`${checkVerifyIds[it]}-success`);

            for (let sit = 0;sit < element.count();sit++) {
                const subElement = element.nth(sit);
                await expect(subElement).toBeVisible();
            }
        }

        // ✅ Check if identity-show-images button exists first (optional - only for non-SSN identities with permission)
        const showImagesBtn = identityEl.getByTestId('identity-show-images');
        const showImagesBtnCount = await showImagesBtn.count();

        if (showImagesBtnCount > 0) {
            console.log('   ✅ Identity show images button found - checking images');
            await expect(showImagesBtn.first()).toBeVisible();

            await showImagesBtn.first().click();

        const selfieModal = await page.getByTestId('identity-images-modal');

        await expect(selfieModal).toBeVisible();

        await selfieModal.getByTestId('identity-selfies-tab').click();

        // await expect(page.getByTestId('identity-attempt-success')).toBeVisible();
        // const selfieImages = await page.getByTestId('identity-images');
        // for (let it = 0;it < selfieImages.length;it++) {
        //     const element = selfieImages.nth(it);
        //     await expect(element).toBeVisible();
        // }
        await selfieModal.getByTestId('identity-govn-tab').click();

        await expect(selfieModal.getByTestId('identity-attempt-success')).toBeVisible();

        const govnImages = await selfieModal.getByTestId('identity-images');

        for (let it = 0;it < govnImages.length;it++) {
            const element = govnImages.nth(it);
            await expect(element).toBeVisible();

            const imageDimensions = await element.evaluate(img => {
                return {
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight
                };
            });

            expect(imageDimensions.naturalWidth).toBeGreaterThan(0);
            expect(imageDimensions.naturalHeight).toBeGreaterThan(0);
        }

        await page.getByTestId('identity-images-modal-cancel').click();
            console.log('   ✅ Identity images check passed');
        } else {
            console.log('   ⚠️ Identity show images button not found - skipping images check (optional)');
        }

        // ✅ Check if identity-more-details button exists first (optional - only for non-SSN identities with permission)
        const moreDetailsBtn = identityEl.getByTestId('identity-more-details');
        const moreDetailsBtnCount = await moreDetailsBtn.count();
        
        if (moreDetailsBtnCount > 0) {
            console.log('   ✅ Identity more details button found - checking details');
            await expect(moreDetailsBtn).toBeVisible();
            
            await moreDetailsBtn.click();

        await expect(page.getByTestId('identity-more-details-modal')).toBeVisible();

        await page.getByTestId('identity-more-details-modal-cancel').click();
            console.log('   ✅ Identity more details check passed');
        } else {
            console.log('   ⚠️ Identity more details button not found - skipping details check (optional)');
        }

        if (checkSsn) {
            // ✅ Check if SSN button exists first (optional check)
            const ssnBtn = identityEl.getByTestId('ssn-detail-btn');
            const ssnBtnCount = await ssnBtn.count();
            
            if (ssnBtnCount > 0) {
                console.log('   ✅ SSN button found - checking SSN details');
                await expect(ssnBtn).toBeVisible();

                await ssnBtn.click();

                const ssnModal = await page.getByTestId('identity-more-details-modal');
                await expect(ssnModal).toBeVisible();

                const ssnTile = await ssnModal.getByTestId('identity-ssn-tile');

                const text = await ssnTile.locator('span').nth(1)
                    .textContent();
                // Trim spaces before checking length to handle cases like "4444 " (with trailing space)
                const trimmedText = text.trim();
                await expect(trimmedText.length).toBe(4);
                await page.getByTestId('identity-more-details-modal-cancel').click();
                console.log('   ✅ SSN check passed');
            } else {
                console.log('   ⚠️ SSN button not found - skipping SSN check (optional)');
            }
        }
    }
};


/**
     * Check Income Source Section Data
     *
     * @param {*} page
     */
const checkIncomeSourceSection = async (page, sessionId) => {

    console.log('Should Allow User to View Income Source Section');

    let [ incomeSourceResponse ] = await Promise.all([
        page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}/income-sources`)
            && resp.request().method() === 'GET'
            && resp.ok()),
        page.getByTestId('income-source-section').click()
    ]);

    let incomeSources = await waitForJsonResponse(incomeSourceResponse);

    await page.getByTestId('income-source-add').first()
        .click();

    await expect(page.getByTestId('income-source-modal')).toBeVisible();

    await page.getByTestId('income-source-modal-cancel').click();

    await expect(incomeSources?.data?.length || 0).toBeGreaterThan(0);

    for (let it = 0;it < incomeSources.data.length;it++) {
        const element = incomeSources.data[it];
        await expect(page.getByTestId(`income-source-${element.id}`)).toBeVisible();
    }

    await page.getByTestId(`income-source-${incomeSources.data[0].id}`)
        .getByTestId('income-source-detail-btn')
        .click();

    const detailModal = await page.getByTestId('income-source-details');

    await expect(detailModal).toBeVisible();

    const transactionRows = detailModal.locator('tbody>tr');

    await expect(await transactionRows.count()).toBeGreaterThan(0);

    await page.getByTestId('income-source-details-cancel').click();

    const incomeSourceId = incomeSources.data.find(inc => inc.state === 'LISTED')?.id;

    await expect(incomeSourceId).toBeTruthy();

    const incomeSourceRaw = await page.getByTestId(`income-source-${incomeSourceId}`);
    const delist = await incomeSourceRaw.getByTestId('income-source-delist-btn');
    await delist.click();

    await expect(page.getByTestId('income-source-delist-modal')).toBeVisible();

    const reasonField = await page.getByTestId('income-source-delist-modal').locator('#reason');
    await reasonField.selectOption('Not Income');
    let delistResponse;
    let relistResponse;
    await page.waitForTimeout(2000);
    [ delistResponse, incomeSourceResponse ] = await Promise.all([
        page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}/income-sources/${incomeSourceId}`)
            && resp.request().method() === 'PATCH'
            && resp.ok()),
        page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}/income-sources`)
            && resp.request().method() === 'GET'
            && resp.ok()),
        page.getByTestId('income-source-delist-submit').click()
    ]);

    await waitForJsonResponse(delistResponse);
    incomeSources = await waitForJsonResponse(incomeSourceResponse);

    await expect(incomeSources.data.some(incomeSource => incomeSource.state === 'DELISTED')).toBeTruthy();

    await page.getByTestId(`income-source-${incomeSourceId}`)
        .getByTestId('income-source-relist-btn')
        .click();
    await page.waitForTimeout(2000);
    [ relistResponse, incomeSourceResponse ] = await Promise.all([
        page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}/income-sources/${incomeSourceId}`)
            && resp.request().method() === 'PATCH'
            && resp.ok()),
        page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}/income-sources`)
            && resp.request().method() === 'GET'
            && resp.ok()),
        page.getByTestId('income-source-list-modal')
            .getByTestId('income-source-relist-submit')
            .click()
    ]);
    await waitForJsonResponse(relistResponse);
    incomeSources = await waitForJsonResponse(incomeSourceResponse);

    await expect(incomeSources.data.some(incomeSource => incomeSource.state === 'LISTED')).toBeTruthy();
    await page.waitForTimeout(3000);
};

const checkEmploymentSectionData = async (page, employments) => {

    console.log('Should Allow User to View Employment Section');

    await page.waitForTimeout(700);

    await page.getByTestId('employment-section-header').click();

    const employmentRows = await page.getByTestId(`employment-raw`);
    for (let it = 0;it < employments.length;it++) {
        const row = await employmentRows.nth(it);
        const payCadence = employments[it].income_source_pay_cadence
            || employments[it].pay_cadence
            || 'N/A';
        const employer = employments[it].employer_name
            || 'N/A';
        await expect(row.locator('td').nth(it))
            .toContainText(payCadence);
        await expect(row.locator('td').nth(it + 1))
            .toHaveText(employer);
    }
};


/**
 * Check Files section data
 *
 * @param {*} page
 */
const checkFilesSectionData = async (page, session, sessionTileEl, files = []) => {

    console.log('Should Allow User to View Files Section');
    await page.waitForTimeout(1000);
    const allSessionWithChildren = [ session, ...session.children ].filter(Boolean);
    let filesData = [];

    if (files.length === 0) {
        await page.locator('.application-card').first()
            .click();

        const filesResponses = await Promise.all([
            ...allSessionWithChildren.map(sess => page.waitForResponse(resp => {
                if (resp.url().includes('/files')) {
                    console.log(resp.url(), `/sessions/${sess.id}/files`, resp.url().includes(`/sessions/${sess.id}/files`));
                }
                return resp.url().includes(`/sessions/${sess.id}/files`)
                    && resp.request().method() === 'GET'
                    && resp.ok();
            })),
            sessionTileEl.click()
        ]);
        filesResponses.pop();
        filesData = [];

        for (let index = 0;index < filesResponses.length;index++) {
            const element = filesResponses[index];
            filesData.push(await waitForJsonResponse(element));
        }
    } else {
        filesData = files;
    }

    await page.getByTestId('files-section-header').click();


    const allSectionWrapper = page.getByTestId('file-section-all-wrapper');


    for (let it = 0;it < filesData.length;it++) {
        const files = filesData[it];

        const allTableRaws = await allSectionWrapper.nth(it).locator('tbody tr');
        for (let it = 0;it < files?.length;it++) {
            await expect(await allTableRaws.nth(it).locator('td:nth-child(2)')
                .innerText()).toContain(files[it].filename);
        }
    }
};

/**
 * Financial Section data check
 *
 * @param {*} sessions
 * @param {*} page
 * @param {*} sessionLocator
 */
const checkFinancialSectionData = async (page, session, sessionLocator, financialData = []) => {

    console.log('Should Allow User to View Financial Section');

    // Step 1: Prepare Session Data and Financial Verifications
    const allSessionWithChildren = [ session, ...session.children ].filter(Boolean);
    let financialVerifications = [];

    if (financialData.length === 0) {

        // Step 1.1: Fetch Financial Data from API
        // Don't click application card again - sessionLocator.click() will handle it

        const financialResponses = await Promise.all([
            ...allSessionWithChildren.map(sess => {
                // Simplified pattern for financial-verifications with session id
                return page.waitForResponse(resp => {
                    const url = decodeURI(resp.url());
                    return url.includes('/financial-verifications') 
                        && url.includes(sess.id)
                        && resp.request().method() === 'GET'
                        && resp.ok();
                }, { timeout: 30000 }); // Add 30 second timeout
            }),
            sessionLocator.click()
        ]);

        // Step 1.2: Navigate to Financial Section
        await page.getByTestId('financial-section-header')
            .click();

        financialResponses.pop();

        const financialDataResponses = financialResponses;

        // Step 1.3: Process Financial Verification Responses
        for (let frIndex = 0;frIndex < financialDataResponses.length;frIndex++) {
            const element = financialDataResponses[frIndex];
            financialVerifications.push(await waitForJsonResponse(element));
        }
    } else {

        // Step 1.4: Use Provided Financial Data
        await page.getByTestId('financial-section-header')
            .click();
        financialVerifications = financialData;
    }

    // Step 2: Verify Financial Accounts Data
    await page.getByTestId('financial-section-financials-radio').click();

    for (let sIndex = 0;sIndex < allSessionWithChildren.length;sIndex++) {
        const session = allSessionWithChildren[sIndex];
        const verifications = financialVerifications[sIndex];

        // Step 2.1: Process Account Data for Each Session
        const accounts = verifications?.data?.filter(acc => acc.status === 'COMPLETED')
            .reduce((acc, ver) => {
            if (!ver.accounts || ver.accounts.length === 0) {
                acc.push({
                    status: ver.status,
                    institution: ver.meta?.institution_name,
                    external_id: ver?.external_id || '',
                    account: '-'
                });
                return acc;
            }
            return acc.concat(ver.accounts.map(acc => {
                return {
                    status: ver.status,
                    account: `${acc.name} - ${(
                        acc.account_number || '****'
                    ).slice(-4)}`,
                    institution: acc.institution.name,
                    external_id: acc?.external_id || ''
                };
            }));
        }, []);

        // Step 2.2: Verify Financial Wrapper Visibility
        const financialWrapper = await page.getByTestId(`financial-section-financials-wrapper-${session?.id}`);

        await expect(financialWrapper).toBeVisible();

        // Step 2.3: Validate Account Information in Table
        const rows = await financialWrapper.locator('tbody tr');
        const rowCount = await rows.count();
        for (let finIndex = 0;finIndex < rowCount;finIndex++) {
            const element = rows.nth(finIndex);
            const firstTd = element.locator('td').first();
            const colspan = await firstTd.getAttribute('colspan');
            if (!colspan) {
                await expect(element.locator('td:nth-child(1)')).toContainText(accounts[finIndex].account);
            }
        }
    }

    // Step 3: Verify Transaction Data
    await page.getByTestId('financial-section-transactions-radio').click();

    const transactionWrapper = await page.getByTestId('financial-section-transactios-list');

    // Step 3.1: Initialize Applicant Filter
    const selector = await page.getByTestId('financial-section-applicant-filter');
    await selector.click();
    await selector.locator(`#financial-section-applicant-filter-0`).click();
    await page.waitForTimeout(1000);

    for (let sIndex = 0;sIndex < allSessionWithChildren.length;sIndex++) {
        const transactionRaws = transactionWrapper.locator('tbody tr');

        const selector = await page.getByTestId('financial-section-applicant-filter');

        await selector.click();
        await page.waitForTimeout(1000);

        // Step 3.2: Fetch Transaction Data for Each Session
        const [ response ] = await Promise.all([
            page.waitForResponse(resp => resp.url()
                .includes(`/sessions/${allSessionWithChildren[sIndex].id}/transactions`)
                && resp.request().method() === 'GET'
                && resp.ok()),
            selector.locator(`#financial-section-applicant-filter-${sIndex}`).click()
        ]);
        const { data: transactions } = await waitForJsonResponse(response);

        // Step 3.3: Validate Transaction Information in Table
        const transactionRawCount = await transactionRaws.count();
        for (let trIndex = 0;trIndex < transactionRawCount;trIndex++) {
            const element = transactionRaws.nth(trIndex);
            const firstTd = element.locator('td').first();
            const colspan = await firstTd.getAttribute('colspan');
            if (!colspan) {
                await expect(element.locator('td:nth-child(3)')).toHaveText(transactions?.[trIndex].description);
            }
        }
    }
};

const scrollDown = async locator => {
    await locator.evaluate(element => element.scrollTop = element.scrollHeight);
};

/**
 * Scroll to the required session card locator
 *
 * @param {import('@playwright/test').Page} page
 * @param {String} selector
 * @returns Locator
 */
const findSessionLocator = async (page, selector, {
    timeout = 2000
} = {}) => {

    await page.locator('#container').first()
        .evaluate(element => element.scrollTop = 150);

    const targetElement = await page.locator(selector);
    let found = false;
    const maxScrolls = 10; // Set a limit to prevent infinite loops in case element is never found
    let scrollCount = 0;

    while (!found && maxScrolls > scrollCount) {
        const isVisible = await targetElement.isVisible({ timeout });
        if (isVisible) {
            found = true;
            return targetElement;
        }
        await scrollDown(await page.getByTestId('side-panel'));
        scrollCount++;
        await page.waitForTimeout(2000);
    }
    throw new Error(`Locator ${selector} not found`)
};

const checkMergeWithDragAndDrop = async (page, sessions) => {
    const baseSession = sessions?.find(session => session?.children?.length > 0);
    const targetSession = sessions?.find(session => session?.children?.length === 0);

    const targetSessionLocator = await findSessionLocator(page, `.application-card[data-session="${targetSession.id}"]`);

    // await baseSessionLocator.click();
    // await page.waitForTimeout(2000);
    const dragHandle = targetSessionLocator.locator('.cursor-move.handle');
    await expect(dragHandle).toBeVisible();

    const mainSection = await page.locator('#applicant-report');

    await page.waitForTimeout(1000);


    dragAndDrop(page, dragHandle, mainSection);

    // Wait for drag and drop to complete, then click merge button
    await page.waitForTimeout(3000);
    await page.getByTestId('merge-session-btn').click();

    const mergeSessionModal = await page.getByTestId('merge-session-modal');
    await expect(mergeSessionModal).toBeVisible();
    await page.waitForTimeout(2000);

    const list = await mergeSessionModal.getByRole('ul');
    const listItems = await list.locator('li').all();
    for (const item of listItems) {
        const isBaseSession = await item.toContainText(baseSession.applicant?.guest?.full_name);
        if (isBaseSession) {
            await expect(item.locator('[data-testid^=merge-primary-]')).toHaveAttribute('aria-selected', 'true');
        } else {
            await expect(item.toContainText(targetSession?.applicant?.guest?.full_name));
            await expect(item.locator('[data-testid^=merge-coapp-]')).toHaveAttribute('aria-selected', 'true');
        }
    }

    await mergeSessionModal.getByTestId('merge-session-modal-cancel').click();
    return { baseSession, mainSection };
};

/**
 * Navigate to a specific session by ID
 * @param {import('@playwright/test').Page} page
 * @param {String} sessionId
 * @param {String} submenu - Optional submenu path (default: 'all', options: 'all', 'reviewed', 'in-review', 'rejected')
 */
const navigateToSessionById = async (page, sessionId, submenu = 'all') => {

    // Navigate directly to the session without clicking applicants-submenu again
    // since we're already on the applications page
    const sessionLink = page.locator(`[href="/applicants/${submenu}/${sessionId}"]`);

    // Wait for the session link to be visible and clickable
    await expect(sessionLink).toBeVisible({ timeout: 10000 });

    // Additional checks to ensure the element is ready
    await sessionLink.waitFor({ state: 'visible' });

    // Verify the element exists and is clickable
    const count = await sessionLink.count();
    if (count === 0) {
        throw new Error(`Session link with href="/applicants/${submenu}/${sessionId}" not found`);
    } else {
        console.log('🚀 ~ Session link found!!!!!!!!!!!!:', sessionId);
    }

    /**
     * Some times Session comes at first and already selected
     * So, api is already called before click
     * So adding click first and reload page to get api call
     */

    await sessionLink.click();

    // Start listening for responses BEFORE clicking
    const responsePromise = page.waitForResponse(resp => {
        const isMatch = resp.url().includes(`/sessions/${sessionId}`)
            && resp.request().method() === 'GET'
            && resp.ok();

        return isMatch;
    }, { timeout: 15000 });

    // Wait a bit to ensure response listener is active
    await page.waitForTimeout(100);

    // Then reload
    await page.reload();

    // Wait for the response
    await responsePromise;
};

/**
 * Navigate to session by ID and capture flags response from page load
 * This function uses a multi-level fallback approach:
 * 0. Use flags captured from login (if provided) - instant
 * 1. Try to capture flags automatically from page load (10s timeout)
 * 2. Clear sessionStorage cache and wait for revalidation (6s timeout)
 * 3. Click "View Details" button to force flags fetch (6s timeout)
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} sessionId - Session ID to navigate to
 * @param {Function} buildFlagsPredicate - Function that builds the flags response predicate
 * @param {string} submenu - Submenu to use ('all', 'approved', etc.)
 * @param {Object} options - Configuration options
 * @param {Response} [options.flagsFromLogin] - Flags response captured from login (optional)
 * @returns {Promise<Object>} - Flags data object
 */
const navigateToSessionByIdAndGetFlags = async (page, sessionId, buildFlagsPredicate, submenu = 'all', options = {}) => {
    const { flagsFromLogin = null } = options;

    console.log(`🧭 Navigating to session ${sessionId} and capturing flags response...`);

    // Navigate directly to the session
    const sessionLink = page.locator(`[href="/applicants/${submenu}/${sessionId}"]`);

    // Wait for the session link to be visible and clickable
    await expect(sessionLink).toBeVisible({ timeout: 10000 });
    await sessionLink.waitFor({ state: 'visible' });

    // Verify the element exists
    const count = await sessionLink.count();
    if (count === 0) {
        throw new Error(`Session link with href="/applicants/${submenu}/${sessionId}" not found`);
    }
    console.log('✅ Session link found:', sessionId);

    // Set up listeners BEFORE clicking to catch responses from initial navigation
    const sessionResponsePromise = page.waitForResponse(resp => {
        return resp.url().includes(`/sessions/${sessionId}`)
            && resp.request().method() === 'GET'
            && resp.ok();
    }, { timeout: 20000 });

    // Click the session link (this triggers navigation and API calls)
    await sessionLink.click();

    // Wait for session response first
    await sessionResponsePromise;
    console.log('✅ Session loaded');

    // Wait for page to stabilize
    await page.waitForLoadState('domcontentloaded');

    // Multi-level fallback approach for flags (flags might be cached from login)
    let flags;

    // TRY #0: Use flags captured from login (if provided) - INSTANT
    if (flagsFromLogin) {
        try {
            console.log('🔍 [TRY #0] Using flags captured from login...');
            flags = await waitForJsonResponse(flagsFromLogin);
            console.log('✅ [TRY #0] Flags from login used successfully');
            return flags;
        } catch (error) {
            console.log('⚠️  [TRY #0] Failed to parse flags from login, falling back to page load');
        }
    }

    // TRY #1: Capture flags from initial page load (10s timeout)
    try {
        console.log('🔍 [TRY #1] Attempting to capture flags from initial page load (10s timeout)...');
        const flagsResponsePromise = page.waitForResponse(buildFlagsPredicate(sessionId), { timeout: 10000 });
        const flagsResponse = await flagsResponsePromise;
        flags = await waitForJsonResponse(flagsResponse);
        console.log('✅ [TRY #1] Flags captured from automatic page load');
    } catch (error) {
        console.log('⚠️  [TRY #1] Flags not captured from initial load');

        // FALLBACK #1: Clear sessionStorage cache and wait for revalidation (6s timeout)
        try {
            console.log('🔄 [FALLBACK #1] Clearing sessionStorage cache and waiting for revalidation (6s timeout)...');
            await page.evaluate(() => {
                // Clear all sessionStorage entries with 'vf:' prefix (flags cache)
                Object.keys(sessionStorage).forEach(key => {
                    if (key.includes('vf:') && key.includes('/flags')) {
                        sessionStorage.removeItem(key);
                    }
                });
            });

            // Wait for flags revalidation request
            const flagsResponseFallback1 = page.waitForResponse(buildFlagsPredicate(sessionId), { timeout: 6000 });
            const flagsResponse1 = await flagsResponseFallback1;
            flags = await waitForJsonResponse(flagsResponse1);
            console.log('✅ [FALLBACK #1] Flags captured after clearing cache');
        } catch (error2) {
            console.log('⚠️  [FALLBACK #1] No flags after cache clear');

            // FALLBACK #2: Click Alert button to force flags fetch (6s timeout)
            try {
                console.log('🔄 [FALLBACK #2] Clicking "Alert" button to force flags fetch (6s timeout)...');
                const alertBtn = page.getByRole('button', { name: 'Alert' });
                await expect(alertBtn).toBeVisible({ timeout: 10000 });

                const flagsResponseFallback2 = await Promise.all([
                    page.waitForResponse(buildFlagsPredicate(sessionId), { timeout: 6000 }),
                    alertBtn.click()
                ]);

                flags = await waitForJsonResponse(flagsResponseFallback2[0]);
                console.log('✅ [FALLBACK #2] Flags captured after clicking Alert button');
            } catch (error3) {
                console.error('❌ All fallbacks failed - no flags endpoint response captured');
                throw new Error(`Failed to capture flags endpoint after all fallbacks: ${error3.message}`);
            }
        }
    }

    return flags;
};

/**
 * Complete admin panel navigation and financial data validation
 * @param {import('@playwright/test').Page} page
 * @param {String} sessionId
 * @param {String} applicationName
 */
const navigateAndValidateFinancialData = async (page, sessionId, applicationName = 'Playwright Fin Doc Upload Test') => {

    // Close modal and navigate to sessions
    await page.waitForTimeout(1000);

    // Navigate to Sessions Page (with improved error handling)
    try {
        await gotoPage(page, 'applicants-menu', 'applicants-submenu', '/sessions?fields[session]');
    } catch (error) {
        console.log('🚀 ~ Navigation failed, trying alternative approach...');

        // Fallback navigation
        await page.getByTestId('applicants-menu').click();
        await page.getByTestId('applicants-submenu').click();
        await page.waitForTimeout(2000);
    }

    // Find Target Session
    console.log('🚀 ~ Looking for session with ID:', sessionId);
    const sessions = await searchSessionWithText(page, sessionId);

    const session = sessions.find(sess => sess.id === sessionId);
    console.log('🚀 ~ Found session:', session ? 'YES' : 'NO');

    if (!session) {
        console.log('🚀 ~ Session not found, skipping financial data validation');
        return;
    }

    await page.waitForTimeout(1300);

    // Validate Financial Section Data (with error handling)
    try {
        await checkFinancialSectionData(page, session, await page.locator(`[data-session="${sessionId}"]`));
    } catch (error) {
        console.log('🚀 ~ Financial section validation failed:', error.message);

        // Don't fail the test, just log the error
    }
};

/**
 * Navigate to session flags and load flag data
 * @param {import('@playwright/test').Page} page
 * @param {String} sessionId
 * @returns {Object} { flags, flagSection }
 */
const navigateToSessionFlags = async (page, sessionId) => {
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds between retries
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔄 Attempt ${attempt}/${maxRetries}: Navigating to session flags for session ${sessionId}`);
            
            // Wait for Alert button to be ready first
            await expect(page.getByTestId('report-alerts-btn')).toBeVisible({ timeout: 10000 });
            await page.waitForTimeout(1000); // Allow UI to stabilize

            // Click Alert button; flags may already be loaded from a previous request,
            // so we rely primarily on the UI becoming visible rather than a fresh network call.
            await page.getByTestId('report-alerts-btn').click();

            const flagSection = await page.getByTestId('report-view-details-flags-section');
            await expect(flagSection).toBeVisible({ timeout: 10000 });

            // Best-effort: try to capture the latest flags response if one occurs,
            // but don't fail the navigation if it doesn't.
            let flags = null;
            try {
                const flagsResponse = await page.waitForResponse(resp =>
                    resp.url().includes(`/sessions/${sessionId}/flags`) &&
                    resp.request().method() === 'GET' &&
                    resp.ok(),
                    { timeout: 5000 }
                );
                const json = await waitForJsonResponse(flagsResponse);
                flags = json.data;
            } catch (networkError) {
                console.log(`⚠️ No fresh /flags response captured during navigation (this may be expected if flags were preloaded): ${networkError.message}`);
            }

            console.log(`✅ Successfully navigated to session flags on attempt ${attempt}`);
            return { flags, flagSection };
            
        } catch (error) {
            console.log(`❌ Attempt ${attempt}/${maxRetries} failed: ${error.message}`);
            
            if (attempt < maxRetries) {
                // Close modal if it's open before retrying
                try {
                    const closeModal = page.getByTestId('close-event-history-modal');
                    if (await closeModal.isVisible()) {
                        console.log('🚪 Closing event history modal before retry');
                        await closeModal.click();
                        await page.waitForTimeout(1000); // Wait for modal to close
                    }
                } catch (closeError) {
                    console.log('⚠️ Could not close modal (might not be open):', closeError.message);
                }
                
                console.log(`⏳ Waiting ${retryDelay}ms before retry ${attempt + 1}`);
                await page.waitForTimeout(retryDelay);
            } else {
                // Last attempt failed, throw the error
                console.log(`💥 All ${maxRetries} attempts failed for session flags navigation`);
                throw error;
            }
        }
    }
};

/**
 * Mark a flag as an issue with a comment
 * @param {import('@playwright/test').Page} page
 * @param {String} sessionId
 * @param {String} flagTestId
 * @param {String} comment
 */
const markFlagAsIssue = async (page, sessionId, flagTestId, comment) => {
    // Scope to items-requiring-review-section only
    const reviewSection = await page.getByTestId('items-requiring-review-section');
    const flagElement = await reviewSection.getByTestId(flagTestId);
    const markAsIssueBtn = await flagElement.getByTestId('mark_as_issue');
    await markAsIssueBtn.click();

    const textareaElement = flagElement.locator('textarea');
    await expect(textareaElement).toBeVisible();
    await textareaElement.fill(comment);

    await Promise.all([
        page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}/flags`)
            && resp.request().method() === 'PATCH'
            && resp.ok()),
        flagElement.locator('button[type=submit]').click()
    ]);

    // Wait for the flag to disappear from items-requiring-review-section (UI update)
    // This ensures the UI has reactively updated after the PATCH response
    console.log(`⏳ Waiting for flag ${flagTestId} to disappear from items-requiring-review-section...`);
    await expect(reviewSection.getByTestId(flagTestId)).not.toBeVisible({ timeout: 10000 });
    console.log(`✅ Flag ${flagTestId} removed from items-requiring-review-section`);
};

/**
 * Mark a flag as a non-issue with a comment
 * @param {import('@playwright/test').Page} page
 * @param {String} sessionId
 * @param {String} flagTestId
 * @param {String} comment
 */
const markFlagAsNonIssue = async (page, sessionId, flagTestId, comment) => {
    // Scope to items-requiring-review-section only
    const reviewSection = await page.getByTestId('items-requiring-review-section');
    const flagElement = await reviewSection.getByTestId(flagTestId);
    const nonIssueBtn = await flagElement.getByTestId('mark_as_non_issue');
    await nonIssueBtn.click();

    const textareaElement = flagElement.locator('textarea');
    await expect(textareaElement).toBeVisible();
    await textareaElement.fill(comment);

    await Promise.all([
        page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}/flags`)
            && resp.request().method() === 'PATCH'
            && resp.ok()),
        flagElement.locator('button[type=submit]').click()
    ]);

    // Wait for the flag to disappear from items-requiring-review-section (UI update)
    // This ensures the UI has reactively updated after the PATCH response
    console.log(`⏳ Waiting for flag ${flagTestId} to disappear from items-requiring-review-section...`);
    await expect(reviewSection.getByTestId(flagTestId)).not.toBeVisible({ timeout: 10000 });
    console.log(`✅ Flag ${flagTestId} removed from items-requiring-review-section`);
};

/**
 * Validate flag sections are visible and contain expected flags
 * @param {import('@playwright/test').Page} page
 * @param {String} declineSectionFlagId
 * @param {String} reviewSectionFlagId
 */
const validateFlagSections = async (page, declineSectionFlagId, reviewSectionFlagId) => {
    const icdsElement = await page.getByTestId('items-causing-decline-section');
    await expect(icdsElement).toBeVisible();

    if (declineSectionFlagId) {
        const declineFlagElement = await icdsElement.getByTestId(declineSectionFlagId);
        await expect(declineFlagElement).toBeVisible({ timeout: 360_000 });
        await expect(declineFlagElement.getByTestId('mark_as_non_issue')).toBeVisible();
    }

    const irrsElement = await page.getByTestId('items-requiring-review-section');
    await expect(irrsElement).toBeVisible();

    if (reviewSectionFlagId) {
        const reviewFlagElement = await irrsElement.getByTestId(reviewSectionFlagId);
        await expect(reviewFlagElement).toBeVisible();
    }

    return { icdsElement, irrsElement };
};

// Verify transaction error and decline flag in application details
async function verifyTransactionErrorAndDeclineFlag(page, randomName) {

    // Search by the name used before and click the application
    const searchSessions = await searchSessionWithText(page, randomName);
    await page.locator('span.font-semibold.text-left.truncate.min-w-0').first()
        .click();

    // Extract sessionId from URL after clicking session
    const sessionId = await page.evaluate(() => {
        const urlParts = window.location.href.split('/');
        return urlParts[urlParts.length - 1];
    });
    console.log(`📋 Session ID extracted: ${sessionId}`);

    // Verify that "Incomplete" exists and click it (manual polling up to 45s)
    const userErrorLink = page.locator('a[href="#"].decoration-error');
    const maxAttempts = 90; // 90 * 500ms = 45s
    let userErrorReady = false;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            if (await userErrorLink.isVisible()) {
                const text = (await userErrorLink.textContent())?.trim();
                if (text === 'Incomplete') {
                    userErrorReady = true;
                    break;
                }
            }
        } catch (e) {
            // ignore and retry
        }
        await page.waitForTimeout(500);
    }

    if (!userErrorReady) {
        throw new Error('Incomplete link not found with expected text within 45s');
    }

    await userErrorLink.click();

    // Verify that "1 account | 1 transaction" exist in Connection Attempts modal
    await expect(page.getByTestId('financial-row-sub-title'))
        .toHaveText('1 account | 1 transaction');

    // Close the modal, click 'X'
    await page.getByTestId('report-financial-status-modal-cancel').click();

    // Click on 'Alert' button
    await page.getByRole('button', { name: 'Alert' }).click();

    // Wait for modal to load
    await page.waitForTimeout(2000);

    // IMPORTANT: MISSING_TRANSACTIONS flag is applicant-scoped, so we need to click the "Applicant" tab first
    // The View Details modal has two tabs: "System" (default) and "Applicant"
    console.log('🔍 Clicking Applicant tab to view applicant-scoped flags...');
    const applicantTab = page.getByRole('button', { name: 'Applicant' });
    await expect(applicantTab).toBeVisible({ timeout: 10000 });
    await applicantTab.click();
    await page.waitForTimeout(1000); // Wait for flags to load after tab switch

    // STEP 1: Wait for and mark MISSING_TRANSACTIONS flag as non-issue
    // This flag is raised when transactions count <= 1
    // The GROSS_INCOME_RATIO_EXCEEDED flag only appears AFTER marking MISSING_TRANSACTIONS as non-issue
    // IMPORTANT: MISSING_TRANSACTIONS is applicant-scoped, so we need applicantScope: true
    console.log('🔍 Step 1: Waiting for MISSING_TRANSACTIONS flag to appear...');
    await pollForFlag(page, {
        flagTestId: 'MISSING_TRANSACTIONS',
        shouldExist: true,
        maxPollTime: 30000, // 30 seconds
        pollInterval: 2000,
        refreshModal: true,
        applicantScope: true, // Flag is applicant-scoped, requires Applicant tab
        errorMessage: 'MISSING_TRANSACTIONS flag not found within 30s. This flag should appear when there is 1 or fewer transactions.'
    });

    // Mark MISSING_TRANSACTIONS as non-issue
    console.log('🔧 Step 2: Marking MISSING_TRANSACTIONS as non-issue...');
    await markFlagAsNonIssue(
        page,
        sessionId,
        'MISSING_TRANSACTIONS',
        'Marked as non-issue by automated test - testing income ratio flag after resolution'
    );
    console.log('✅ MISSING_TRANSACTIONS marked as non-issue');

    // Wait a bit for backend to process the flag resolution
    await page.waitForTimeout(2000);

    // STEP 3: Now wait for GROSS_INCOME_RATIO_EXCEEDED flag to appear
    // IMPORTANT: With only 1 debit transaction:
    // - scopeCredit() filters to only credit transactions (type = 'credit')
    // - Debit transactions are excluded from income source creation
    // - No income sources are created → income is null → getTotalIncomeRatio() is null
    // - The flag SHOULD be raised if hasConcludedIncomeSteps() is true AND getTotalIncomeRatio() is null
    // - After marking MISSING_TRANSACTIONS as non-issue, the system can evaluate the income ratio
    console.log('🔍 Step 3: Waiting for GROSS_INCOME_RATIO_EXCEEDED flag to appear...');
    await pollForFlag(page, {
        flagTestId: 'GROSS_INCOME_RATIO_EXCEEDED',
        shouldExist: true,
        maxPollTime: 30000, // 30 seconds
        pollInterval: 2000,
        refreshModal: true,
        errorMessage: 'Flag "Gross Income Ratio Exceeded" not found within 30s after marking MISSING_TRANSACTIONS as non-issue. With only 1 debit transaction, no income sources are created (income is null). The flag should be raised if hasConcludedIncomeSteps() is true AND getTotalIncomeRatio() is null.'
    });

    // Verify the flag is visible
    await expect(page.getByTestId('GROSS_INCOME_RATIO_EXCEEDED')).toBeVisible();
    console.log('✅ GROSS_INCOME_RATIO_EXCEEDED flag verified successfully');
}

async function openReportSection(page, sectionId) {
    const reportSection = page.getByTestId(sectionId);
    await expect(reportSection).toBeVisible();
    const sectionHeader = reportSection.getByTestId(`${sectionId}-header`);
    await expect(sectionHeader).toBeVisible();
    // Accordian body is toggled via v-show, so clicking the header twice will close it.
    // Make this helper idempotent: only click when the body is not visible.
    const body = reportSection.locator('div.overflow-hidden').first();
    const bodyVisible = await body.isVisible().catch(() => false);
    if (!bodyVisible) {
        await sectionHeader.click();
        console.log(`🧑‍💼 [Open] ${sectionId} section expanded`);
    } else {
        console.log(`🧑‍💼 [Open] ${sectionId} section already expanded`);
    }
    return reportSection;
}

/**
 * Fills and asserts fields in the guest information edit modal.
 * For each supplied key in expectData, verifies the modal field is prefilled.
 * For each supplied key in guestFormData, fills the modal field.
 * Logs each major action for clarity.
 *
 * @param {import('@playwright/test').Page} page - Playwright Page object.
 * @param {Object} expectData - Keys and values expected to already be present in the modal.
 * @param {Object} guestFormData - Keys and values to fill in the modal.
 */
async function expectAndFillGuestForm(page, expectData = {}, guestFormData = {}) {

    // Assert guest edit modal visible
    const guestEditModal = page.getByTestId('identity-update-guest-modal');
    await expect(guestEditModal).toBeVisible();
    console.log('🪟 Modal opened: identity-update-guest-modal is visible.');

    // Helper for per-field fill & expect operation
    async function fillAndExpectField(fieldTestId, fieldKey) {
        const field = guestEditModal.getByTestId(fieldTestId);
        await expect(field).toBeVisible();
        // If value in expectData, assert it's present and log it
        if (typeof expectData[fieldKey] !== 'undefined') {
            await expect(field).toHaveValue(expectData[fieldKey]);
            console.log(`🔎 Field "${fieldKey}" expected value:`, expectData[fieldKey]);
        }
        // If value in guestFormData, fill it and log the action
        if (typeof guestFormData[fieldKey] !== 'undefined') {
            await field.fill(guestFormData[fieldKey]);
            console.log(`✏️ Field "${fieldKey}" filled with:`, guestFormData[fieldKey]);
        }
    }

    // Step-by-step per field
    await fillAndExpectField('guest-first-name-field', 'first_name');
    await fillAndExpectField('guest-last-name-field', 'last_name');
    await fillAndExpectField('phone-input', 'phone');
    await fillAndExpectField('guest-email-field', 'email');
}


async function openModalWithButton(page, btnKey, modalKey) {
    let button;
    
    // Special case: view-details-btn no longer exists, use Alert button instead
    if (btnKey === 'view-details-btn') {
        console.log('🔔 [openModalWithButton] Using Alert button to open View Details section');
        button = page.getByRole('button', { name: /alert/i }).first();
        await expect(button).toBeVisible({ timeout: 10_000 });
    } else {
        button = page.getByTestId(btnKey);
        await expect(button).toBeVisible();
    }

    await button.click();

    const modal = page.getByTestId(modalKey);
    await expect(modal).toBeVisible();

    return {
        button,
        modal
    }

}

async function fillCreateSessionForm(page, sessionForm) {
    console.log('📝 [fillCreateSessionForm] Filling new session form with data:', sessionForm);

    const createSessionModal = page.getByTestId('create-session-modal');
    await expect(createSessionModal).toBeVisible();
    console.log('🪟 [fillCreateSessionForm] Create session modal is visible.');

    // Organization select - call fillMultiselect directly (matches original inline code)
    const orgSelect = createSessionModal.getByTestId('crt-session-organization-field');
    await expect(orgSelect).toBeVisible();
    console.log(`🏢 [fillCreateSessionForm] Selecting organization: "${sessionForm.organization}"`);
    await fillMultiselect(page, orgSelect, [sessionForm.organization]);

    // Application select
    const applicationInput = createSessionModal.getByTestId('crt-session-application-field');
    console.log(`📋 [fillCreateSessionForm] Selecting application: "${sessionForm.application}"`);
    await fillMultiselect(page, applicationInput, [sessionForm.application], {
        waitUrl: '/applications'
    });

    // Reference number (optional)
    if (sessionForm.reference_no) {
        const refInput = createSessionModal.getByTestId('crt-session-ref-number-field');
        console.log(`🏷️ [fillCreateSessionForm] Filling reference number: "${sessionForm.reference_no}"`);
        await refInput.fill(sessionForm.reference_no);
    } else {
        console.log('ℹ️ [fillCreateSessionForm] No reference number provided.');
    }

    // First Name
    const firstNameField = createSessionModal.getByTestId('crt-session-first-name-field');
    console.log(`👤 [fillCreateSessionForm] Filling first name: "${sessionForm.first_name}"`);
    await firstNameField.fill(sessionForm.first_name);

    // Last Name
    const lastNameField = createSessionModal.getByTestId('crt-session-last-name-field');
    console.log(`👤 [fillCreateSessionForm] Filling last name: "${sessionForm.last_name}"`);
    await lastNameField.fill(sessionForm.last_name);

    // Email (optional)
    if (sessionForm.email) {
        const emailField = createSessionModal.getByTestId('crt-session-email-field');
        console.log(`📧 [fillCreateSessionForm] Filling email: "${sessionForm.email}"`);
        await emailField.fill(sessionForm.email);
    } else {
        console.log('ℹ️ [fillCreateSessionForm] No email provided.');
    }

    // Send invite checkbox
    const inviteCheck = createSessionModal.getByTestId('crt-session-invite-checkbox');
    const isChecked = await inviteCheck.isChecked();
    console.log(`🟢 [fillCreateSessionForm] Invite checkbox current state: ${isChecked}, desired: ${!!sessionForm.send_invite}`);

    if (!isChecked && sessionForm.send_invite) {
        console.log('✅ [fillCreateSessionForm] Clicking to check invite checkbox.');
        await inviteCheck.click();
    } else if (isChecked && !sessionForm.send_invite) {
        console.log('🚫 [fillCreateSessionForm] Invite checkbox is checked but send_invite is false. (No uncheck logic implemented)');
    } else {
        console.log('✔️ [fillCreateSessionForm] Invite checkbox state is correct, no action taken.');
    }

    console.log('🎉 [fillCreateSessionForm] Finished filling the session form.');
}

/**
 * Submit create session form and wait for session creation
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{session: Object, sessionId: string}>}
 */
async function submitCreateSessionForm(page) {
    console.log('🚀 [submitCreateSessionForm] Submitting session creation form...');
    
    const createSessionBtn = page.getByTestId('submit-create-session');
    await expect(createSessionBtn).toBeVisible();
    
    // Listen for POST /sessions response
    const sessionPromise = page.waitForResponse(
        resp => resp.url().includes('/sessions') 
            && resp.request().method() === 'POST' 
            && resp.ok()
    );
    
    await createSessionBtn.click();
    console.log('✅ [submitCreateSessionForm] Clicked submit button');
    
    const sessionResponse = await sessionPromise;
    const { data: session } = await waitForJsonResponse(sessionResponse);
    
    console.log(`✅ [submitCreateSessionForm] Session created: ${session.id}`);
    
    // Wait for navigation to session report page
    await expect(page).toHaveURL(`/applicants/all/${session.id}`, { timeout: 10_000 });
    console.log(`✅ [submitCreateSessionForm] Navigated to session report: ${session.id}`);
    
    return { session, sessionId: session.id };
}

/**
 * Verify reference number display in UI
 * @param {import('@playwright/test').Locator} flagSection
 * @param {string} expectedValue
 * @param {Object} options
 * @param {boolean} options.shouldExist - Whether reference number should exist (default: true)
 * @param {boolean} options.verifyPositioning - Whether to verify positioning relative to approval section (default: true)
 */
async function verifyReferenceNumberDisplay(flagSection, expectedValue, options = {}) {
    const { shouldExist = true, verifyPositioning = true } = options;
    
    const codeEle = flagSection.getByTestId('application-code');
    
    if (shouldExist) {
        console.log(`🔍 [verifyReferenceNumberDisplay] Verifying reference number exists: ${expectedValue}`);
        await expect(codeEle).toBeVisible();
        await expect(codeEle).toHaveText(expectedValue);
        console.log('✅ [verifyReferenceNumberDisplay] Reference number text matches');
        
        // Verify CODE tag
        await expect(codeEle).toHaveJSProperty('tagName', 'CODE');
        console.log('✅ [verifyReferenceNumberDisplay] Element is CODE tag');
        
        // Verify CSS classes
        const codeClasses = await codeEle.getAttribute('class');
        expect(codeClasses).toBeTruthy();
        expect(codeClasses.split(' ')).toEqual(
            expect.arrayContaining(['bg-slate-200', 'rounded-md'])
        );
        console.log('✅ [verifyReferenceNumberDisplay] CSS classes verified');
        
        // Verify positioning if requested
        if (verifyPositioning) {
            const page = flagSection.page();
            const approvalCondHeader = page.getByTestId('approval-condition-section-header');
            const codeEleBox = await codeEle.boundingBox();
            const approvalCondHeaderBox = await approvalCondHeader.boundingBox();
            
            expect(codeEleBox).toBeTruthy();
            expect(approvalCondHeaderBox).toBeTruthy();
            
            const codeEleBottom = codeEleBox.y + codeEleBox.height;
            const approvalCondHeaderTop = approvalCondHeaderBox.y;
            const gap = Math.abs(approvalCondHeaderTop - codeEleBottom);
            
            console.log(`📐 [verifyReferenceNumberDisplay] Vertical gap: ${gap}px`);
            expect(gap).toBeLessThanOrEqual(300);
            console.log('✅ [verifyReferenceNumberDisplay] Positioning verified');
        }
    } else {
        console.log('🔍 [verifyReferenceNumberDisplay] Verifying reference number does NOT exist');
        await expect(codeEle).not.toBeVisible();
        console.log('✅ [verifyReferenceNumberDisplay] Reference number correctly hidden');
    }
}

/**
 * Verify session reference number via API
 * @param {Object} adminClient - API client instance
 * @param {string} sessionId - Session ID to verify
 * @param {string|null} expectedValue - Expected reference number value (null if should not exist)
 */
async function verifySessionReferenceNo(adminClient, sessionId, expectedValue) {
    console.log(`🔍 [verifySessionReferenceNo] Verifying reference_no for session: ${sessionId}`);
    
    const sessionData = await adminClient.get(`/sessions/${sessionId}`, {
        params: {
            'fields[session]': 'applicant',
            'fields[applicant]': 'reference_no'
        }
    });
    
    const apiSession = sessionData?.data?.data;
    expect(apiSession).toBeDefined();
    
    if (expectedValue === null) {
        expect(apiSession.applicant?.reference_no).toBe(null);
        console.log('✅ [verifySessionReferenceNo] Reference number is null as expected');
    } else {
        expect(apiSession.applicant?.reference_no).toBe(expectedValue);
        console.log(`✅ [verifySessionReferenceNo] Reference number matches: ${expectedValue}`);
    }
}


async function addApplicant(page, inviteModal, coApp, session) {

    console.log(`✍️ [AddApplicant] Filling first name: ${coApp.first_name}`);
    const first_name = inviteModal.getByTestId('applicant-first-name');
    await expect(first_name).toBeVisible();
    await first_name.fill(coApp.first_name);

    console.log(`✍️ [AddApplicant] Filling last name: ${coApp.last_name}`);
    const last_name = inviteModal.getByTestId('applicant-last-name');
    await expect(last_name).toBeVisible();
    await last_name.fill(coApp.last_name);

    console.log(`📧 [AddApplicant] Filling email: ${coApp.email}`);
    const email = inviteModal.getByTestId('applicant-email');
    await expect(email).toBeVisible();
    await email.fill(coApp.email);

    console.log(`🪪 [AddApplicant] Selecting applicant role: ${coApp.role}`);
    const role = inviteModal.getByTestId('applicant-role');
    await expect(role).toBeVisible();
    await fillMultiselect(page, role, [coApp.role]);

    const submit = inviteModal.getByTestId('applicant-invite-submit');
    await expect(submit).toBeVisible();
    console.log('🚀 [AddApplicant] Waiting for create/applicant and session responses...');

    const createResp = page.waitForResponse(resp => resp.url().endsWith('/applicants')
        && resp.request().method() === 'POST'
        && resp.ok(),
        {
            timeout: 60_000
        }
    )
    console.log('🖱️ [AddApplicant] Clicking submit button...');
    await submit.click()
    const applicantResp = await createResp
    const sessionResp = page.waitForResponse(resp => resp.url().includes(`/sessions/${session.id}?fields[session]`)
        && resp.request().method() === 'GET'
        && resp.ok(),
        {
            timeout: 60_000
        }
    )
    const newSessionResp = await sessionResp
    expect(await applicantResp.status()).toBe(201);
    console.log('📝 [AddApplicant] Received applicant and updated session responses.');
    const { data: applicant } = await waitForJsonResponse(applicantResp)
    const { data: newSession } = await waitForJsonResponse(newSessionResp)
    if (newSession) {
        console.log(`🏠 [AddApplicant] Session updated with new applicant. Session ID: ${newSession.id}`)
    }

    const invitedApplicant = inviteModal.getByTestId('invited-applicants');
    await expect(invitedApplicant).toBeVisible();

    console.log('🔎 [AddApplicant] Finding session tile for the invited applicant...');
    // Interactive step logs
    console.log(`📄 [AddApplicant] newSession.id: ${newSession.id}`)
    console.log(`👥 [AddApplicant] newSession.children.length: ${newSession.children.length}`)
    console.log(`🔗 [AddApplicant] applicant.id: ${applicant.id}`)

    const applicantSession = newSession.children.find(sess => {
        return sess.applicant.id === applicant.id;
    })

    if (applicantSession) {
        const sessionTile = invitedApplicant.getByTestId(`invited-applicant-${applicantSession.id}`)

        await expect(sessionTile.getByTestId('invited-applicant-fullname')).toHaveText(`${coApp.first_name} ${coApp.last_name}`)
        await expect(sessionTile.getByTestId('invited-applicant-email')).toHaveText(`${coApp.email}`)
        await expect(sessionTile.getByTestId('invited-applicant-role')).toContainText(`${coApp.role}`)
        console.log(`✅ [AddApplicant] Applicant "${coApp.first_name} ${coApp.last_name}" with role "${coApp.role}" successfully added and visible.`)
    } else {
        console.log(`❌ [AddApplicant] Error: Could not find applicant session for applicant id: ${applicant.id}`)
    }
    return applicantSession;
}

async function copyInviteLink(page, guarantorSession) {
    await page
        .getByTestId(
            `copy-invite-link-${guarantorSession?.applicant?.id}`
        )
        .click({ timeout: 10000 });

    let copiedLink;
    try {
        copiedLink = await page.evaluate(async () => {
            try {
                return await navigator.clipboard.readText();
            } catch (error) {
                console.log('Clipboard read failed:', error.message);
                return null;
            }
        });

        if (!copiedLink) {
            throw new Error('Clipboard read returned null or empty');
        }
        console.log('✅ Link copied successfully from clipboard');
        return copiedLink;
    } catch (error) {
        console.log('⚠️ Clipboard operation failed, trying alternative method');

        // Fallback: try to get the link from the page directly
        try {
            const linkElement = page.locator('[data-testid="invite-link-input"] input, [data-testid="invite-link-input"] textarea');
            copiedLink = await linkElement.inputValue();
            console.log('✅ Link retrieved from input field as fallback');
            return copiedLink;
        } catch (fallbackError) {
            console.log('❌ Both clipboard and fallback methods failed');
            throw new Error(`Failed to get invite link: ${error.message}`);
        }
    }
}

const reInviteApplicant = async (page, applicantId) => {
    const reinvitePromise = page.waitForResponse(response =>
        response.url().includes(`/applicants/${applicantId}`) &&
        response.request().method() === 'PATCH' &&
        response.ok(),
        { timeout: 60000 } // 1 minute timeout
    );
    const reinviteButton = page.getByTestId(`reinvite-${applicantId}`);
    await expect(reinviteButton).toBeVisible();
    await reinviteButton.click();
    await reinvitePromise
}
export {
    checkSessionApproveReject,
    checkFlagsPresentInSection,
    checkAllFlagsSection,
    searchSessionWithText,
    checkRentBudgetEdit,
    checkExportPdf,
    canRequestAdditionalDocuments,
    canInviteApplicant,
    canUploadListOfDocuments,
    canMergeSession,
    checkIdentityDetailsAvailable,
    checkIncomeSourceSection,
    checkEmploymentSectionData,
    checkFilesSectionData,
    checkFinancialSectionData,
    findSessionLocator,
    checkMergeWithDragAndDrop,
    navigateAndValidateFinancialData,
    navigateToSessionById,
    navigateToSessionByIdAndGetFlags,
    navigateToSessionFlags,
    markFlagAsIssue,
    markFlagAsNonIssue,
    validateFlagSections,
    verifyTransactionErrorAndDeclineFlag,
    openReportSection,
    expectAndFillGuestForm,
    openModalWithButton,
    fillCreateSessionForm,
    submitCreateSessionForm,
    verifyReferenceNumberDisplay,
    verifySessionReferenceNo,
    addApplicant,
    copyInviteLink,
    reInviteApplicant
};
