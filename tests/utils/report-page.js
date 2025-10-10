import { expect } from '@playwright/test';
import { waitForJsonResponse } from '~/tests/utils/wait-response';
import { customUrlDecode } from './helper';
import { dragAndDrop, gotoPage } from './common';

/**
 * Check By Approving and Rejecting Session
 * @param {*} page
 */
const checkSessionApproveReject = async (page, sessionId = null) => {

    // Step 1: Approve Session
    // Step 1.1: Locate and click approve button
    const approveBtn = await page.getByTestId('approve-session-btn');
    await page.waitForTimeout(700);
    if (!await approveBtn.isVisible()) {
        await page.getByTestId('session-action-btn').click();
    }
    await page.waitForTimeout(600);
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
    const actionBtn = await page.getByTestId('session-action-btn');

    await actionBtn.scrollIntoViewIfNeeded();

    await page.waitForTimeout(1000);

    await page.getByTestId('reject-session-btn').click();

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
    const flagsCausingDecline = flags.filter(flag => flag.severity === 'CRITICAL' && !flag.ignored);
    const flagsRequiredReview = flags.filter(flag => flag.severity === 'ERROR' && !flag.ignored);
    const flagsWithWarning = flags.filter(flag => flag.severity === 'WARNING' && !flag.ignored);
    const flagsWithInformation = flags.filter(flag => flag.severity === 'INFO' && !flag.ignored);
    const flagsReviewed = flags.filter(flag => flag.ignored);

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
 * Search sessions with text
 *
 * @param {import('@playwright/test').Page} page
 * @param {String} searchText
 * @returns Array
 */
const searchSessionWithText = async (page, searchText) => {
    console.log('🚀 ~ searchSessionWithText called with:', searchText);

    const sessionSearchInput = await page.locator('[id="search_sessions"]');
    
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
        }),
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

    await page.locator('#rent-budget-input').fill('300');

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

    const exportBtn = await page.getByTestId('export-session-btn');
    await page.waitForTimeout(700);
    if (!await exportBtn.isVisible()) {
        await page.getByTestId('session-action-btn').click();
    }
    await page.waitForTimeout(600);
    
    // Click export button and wait for modal
    exportBtn.click();
    await page.waitForTimeout(1000); // Wait for animation
    await page.locator('[role="dialog"]').filter({ hasText: 'Export' }).waitFor({ state: 'visible' });
    
    // Click the income source delist submit button
    await page.getByTestId('income-source-delist-submit').click();

    const [ pdfResponse, popupPage ] = await Promise.all([
        page.waitForResponse(resp => resp.url().includes(`/sessions?session_ids[]=${sessionId}`)
            && resp.request().method() === 'GET'
            && resp.headers()['content-type'] === 'application/pdf'
            && resp.ok()),
        page.waitForEvent('popup')
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
        await page.getByTestId('session-action-btn').click();
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
        const actionBtn = await page.getByTestId('session-action-btn');
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
    await page.waitForTimeout(700);
    if (!await btn.isVisible()) {
        await page.getByTestId('session-action-btn').click();
    }
    await page.waitForTimeout(600);
    await btn.click();

    await page.getByTestId('select-applicant').click();

    await page.locator('#select-applicant-0').click();

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


        await expect(identityEl.getByTestId('identity-more-details')).toBeVisible();

        await identityEl.getByTestId('identity-show-images').first()
            .click();

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

        await identityEl.getByTestId('identity-more-details').click();

        await expect(page.getByTestId('identity-more-details-modal')).toBeVisible();

        const govnSection = await page.getByTestId('govn-id-checks-section');

        const ticks = await govnSection.locator('img').count();

        await expect(ticks).toBeGreaterThan(0);

        await page.getByTestId('identity-more-details-modal-cancel').click();

        if (checkSsn) {
            const ssnBtn = await identityEl.getByTestId('ssn-detail-btn');
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
const findSessionLocator = async (page, selector) => {

    await page.locator('#container').first()
        .evaluate(element => element.scrollTop = 150);

    const targetElement = await page.locator(selector);
    let found = false;
    const maxScrolls = 10; // Set a limit to prevent infinite loops in case element is never found
    let scrollCount = 0;

    while (!found && maxScrolls > scrollCount) {
        const isVisible = await targetElement.isVisible();
        if (isVisible) {
            found = true;
            return targetElement;
        }
        await scrollDown(await page.getByTestId('side-panel'));
        scrollCount++;
        await page.waitForTimeout(2000);
    }
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
 */
const navigateToSessionById = async (page, sessionId) => {

    // Navigate directly to the session without clicking applicants-submenu again
    // since we're already on the applications page
    const sessionLink = page.locator(`[href="/applicants/all/${sessionId}"]`);

    // Wait for the session link to be visible and clickable
    await expect(sessionLink).toBeVisible({ timeout: 10000 });

    // Additional checks to ensure the element is ready
    await sessionLink.waitFor({ state: 'visible' });

    // Verify the element exists and is clickable
    const count = await sessionLink.count();
    if (count === 0) {
        throw new Error(`Session link with href="/applicants/all/${sessionId}" not found`);
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
            
            // Wait for view-details-btn to be ready first
            await expect(page.getByTestId('view-details-btn')).toBeVisible({ timeout: 10000 });
            await page.waitForTimeout(1000); // Allow UI to stabilize

            const [ flagsResponse ] = await Promise.all([
                page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}/flags`)
                    && resp.request().method() === 'GET'
                    && resp.ok(), { timeout: 30000 }), // 30 second timeout
                page.getByTestId('view-details-btn').click()
            ]);

            const { data: flags } = await waitForJsonResponse(flagsResponse);
            const flagSection = await page.getByTestId('report-view-details-flags-section');
            await expect(flagSection).toBeVisible();

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
    const flagElement = await page.getByTestId(flagTestId);
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
};

/**
 * Mark a flag as a non-issue with a comment
 * @param {import('@playwright/test').Page} page
 * @param {String} sessionId
 * @param {String} flagTestId
 * @param {String} comment
 */
const markFlagAsNonIssue = async (page, sessionId, flagTestId, comment) => {
    const flagElement = await page.getByTestId(flagTestId);
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

    const giFlagElement = await icdsElement.getByTestId(declineSectionFlagId);
    await expect(giFlagElement).toBeVisible({ timeout: 360_000 });
    await expect(giFlagElement.getByTestId('mark_as_non_issue')).toBeVisible();

    const irrsElement = await page.getByTestId('items-requiring-review-section');
    await expect(irrsElement).toBeVisible();

    const reviewFlagElement = await irrsElement.getByTestId(reviewSectionFlagId);
    await expect(reviewFlagElement).toBeVisible();

    return { icdsElement, irrsElement };
};

// Verify transaction error and decline flag in application details
async function verifyTransactionErrorAndDeclineFlag(page, randomName) {

    // Search by the name used before and click the application
    const searchSessions = await searchSessionWithText(page, randomName);
    await page.locator('span.font-semibold.text-left.truncate.min-w-0').first()
        .click();

    // Verify that "User Error" exists and click it
    await expect(page.locator('a[href="#"].decoration-error')).toHaveText('User Error');
    await page.locator('a[href="#"].decoration-error').click();

    // Verify that "1 account | 1 transaction" exist in Connection Attempts modal
    await expect(page.locator('.gap-2.justify-between > span:nth-of-type(1)'))
        .toHaveText('1 account | 1 transaction');

    // Close the modal, click 'X'
    await page.getByTestId('report-financial-status-modal-cancel').click();

    // Click on 'View Details' button
    await page.locator('button:has-text("View Details")').click();

    // Verify that "Gross Income Ratio Exceeded" exist in application details
    await expect(page.locator('div[title="Gross income ratio is above the configured threshold and may cause automatic rejection"]'))
        .toHaveText('Gross Income Ratio Exceeded');
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
    navigateToSessionFlags,
    markFlagAsIssue,
    markFlagAsNonIssue,
    validateFlagSections,
    verifyTransactionErrorAndDeclineFlag
};
