import { expect } from '@playwright/test';
import { waitForJsonResponse } from './wait-response';

/**
 * Check Income Source Section Data
 * @param {import('@playwright/test').Page} page
 * @param {string} sessionId
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
    // Wait for transactions to be fully loaded and visible
    await expect(transactionRows.first()).toBeVisible();

    await page.getByTestId('income-source-details-cancel').click();

    let incomeSourceId = incomeSources.data.find(inc => inc.state === 'LISTED')?.id;

    if (!incomeSourceId) {
        const deIncomeSourceId = incomeSources.data.find(inc => inc.state === 'DELISTED')?.id;
        await expect(deIncomeSourceId).toBeTruthy();
        await page.getByTestId(`income-source-${deIncomeSourceId}`)
            .getByTestId('income-source-relist-btn')
            .click();
        await Promise.all([
            page.waitForResponse(resp => resp.url()
                .includes(`/sessions/${sessionId}/income-sources/${deIncomeSourceId}`)
            && resp.request().method() === 'PATCH'
            && resp.ok()),
            page.waitForResponse(resp => resp.url().includes(`/sessions/${sessionId}/income-sources`)
            && resp.request().method() === 'GET'
            && resp.ok()),
            page.getByTestId('income-source-list-modal')
                .getByTestId('income-source-relist-submit')
                .click()
        ]);
        // Wait for the relist operation to complete and data to refresh
        await expect(page.getByTestId(`income-source-${deIncomeSourceId}`).getByTestId('income-source-delist-btn')).toBeVisible();
        incomeSourceId = incomeSources.data.find(inc => inc.state === 'LISTED')?.id;
    }

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

    // Now do the same for relist
    // Step 1: Click the relist button
    await page.getByTestId(`income-source-${incomeSourceId}`)
        .getByTestId('income-source-relist-btn')
        .click();

    // Step 2: Click the submit button in the modal and wait for responses
    const [ relistResponse2, incomeSourceResponse2 ] = await Promise.all([
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
    await waitForJsonResponse(relistResponse2);
    incomeSources = await waitForJsonResponse(incomeSourceResponse2);

    await expect(incomeSources.data.some(incomeSource => incomeSource.state === 'LISTED')).toBeTruthy();
    // Wait for the income source to be fully visible after relist
    await expect(page.getByTestId(`income-source-${incomeSourceId}`)).toBeVisible();
};

/**
 * Employment section data check
 * @param {import('@playwright/test').Page} page
 * @param {Array} employments
 */
const checkEmploymentSectionData = async (page, employments) => {
    console.log('Should Allow User to View Employment Section');

    // Wait for the page to be ready for interaction
    await expect(page.getByTestId('employment-section-header')).toBeVisible();

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
 * @param {import('@playwright/test').Page} page
 * @param {Array} files
 */
const checkFilesSectionData = async (page, files) => {
    console.log('Should Allow User to View Files Section');

    await page.getByTestId('files-section-header').click();

    const allSectionWrapper = page.getByTestId('file-section-all-wrapper');

    const allTableRaws = await allSectionWrapper.locator('tbody tr');

    for (let it = 0;it < files?.length;it++) {
        await expect(await allTableRaws.nth(it).locator('td:nth-child(2)')
            .innerText()).toContain(files[it].filename);
    }
};

/**
 * Financial Section data check
 * @param {Object} session
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} sessionLocator
 */
const checkFinancialSectionData = async (session, page, sessionLocator) => {
    console.log('Should Allow User to View Financial Section');

    // Wait for application card to be ready and click it
    const applicationCard = page.locator('.application-card').first();
    await expect(applicationCard).toBeVisible();
    await applicationCard.click();

    const allSessionWithChildren = [ session, ...session.children ].filter(Boolean);

    const financialResponses = await Promise.all([
        ...allSessionWithChildren.map(sess => {
            const regex = new RegExp(`.+/financial-verifications?.+filters=.+{"session_id":{"\\$in":\\["${sess.id}"\\].+`, 'i');
            return page.waitForResponse(resp => regex.test(decodeURI(resp.url()))
                && resp.request().method() === 'GET'
                && resp.ok());
        }),
        sessionLocator.click()
    ]);

    // Wait for financial section header to be ready and click it
    const financialHeader = page.getByTestId('financial-section-header');
    await expect(financialHeader).toBeVisible();
    await financialHeader.click();
    
    // Wait for the financial section to load
    await expect(page.getByTestId('financial-section-financials-radio')).toBeVisible();
    
    financialResponses.pop();

    const financialDataResponses = financialResponses;

    const financialVerifications = [];

    for (let frIndex = 0;frIndex < financialDataResponses.length;frIndex++) {
        const element = financialDataResponses[frIndex];
        financialVerifications.push(await waitForJsonResponse(element));
    }

    // Wait for financials radio to be ready and click it
    const financialsRadio = page.getByTestId('financial-section-financials-radio');
    await expect(financialsRadio).toBeVisible();
    await financialsRadio.click();

    for (let sIndex = 0;sIndex < allSessionWithChildren.length;sIndex++) {
        const session = allSessionWithChildren[sIndex];
        const verifications = financialVerifications[sIndex];

        const accounts = verifications?.data?.reduce((acc, ver) => {
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

        const financialWrapper = await page.getByTestId(`financial-section-financials-wrapper-${session?.id}`);

        await expect(financialWrapper).toBeVisible();

        const rows = await financialWrapper.locator('tbody tr');
        const rowCount = await rows.count();
        for (let finIndex = 0;finIndex < rowCount;finIndex++) {
            const element = rows.nth(finIndex);
            const firstTd = element.locator('td').first();
            const colspan = await firstTd.getAttribute('colspan');
            if (!colspan) {
                await expect(element.locator('td:nth-child(1)')).toHaveText(accounts[finIndex].account);
            }
        }
    }
    
    // Wait for transactions radio to be ready and click it
    const transactionsRadio = page.getByTestId('financial-section-transactions-radio');
    await expect(transactionsRadio).toBeVisible();
    await transactionsRadio.click();

    const transactionWrapper = await page.getByTestId('financial-section-transactios-list');

    // Wait for the transactions section to be ready
    await expect(transactionWrapper).toBeVisible();

    for (let sIndex = 0;sIndex < allSessionWithChildren.length;sIndex++) {
        const transactionRaws = transactionWrapper.locator('tbody tr');

        const selector = await page.getByTestId('financial-section-applicant-filter');

        // Ensure the filter is ready before interaction
        await expect(selector).toBeVisible();
        
        // Click the filter and wait for it to be fully open
        await selector.click();
        await expect(selector.locator(`#financial-section-applicant-filter-${sIndex}`)).toBeVisible();
        
        // Wait for response and click the option simultaneously
        const [ response ] = await Promise.all([
            page.waitForResponse(resp => {
                const urlMatches = resp.url().includes(`/sessions/${allSessionWithChildren[sIndex].id}/transactions`);
                const methodMatches = resp.request().method() === 'GET';
                const isOk = resp.ok();
                
                console.log(`Response check for session ${allSessionWithChildren[sIndex].id}:`, {
                    url: resp.url(),
                    urlMatches,
                    method: resp.request().method(),
                    methodMatches,
                    status: resp.status(),
                    isOk
                });
                
                return urlMatches && methodMatches && isOk;
            }, { timeout: 60_000 }),
            selector.locator(`#financial-section-applicant-filter-${sIndex}`).click()
        ]);
        
        const { data: transactions } = await waitForJsonResponse(response);

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

export {
    checkIncomeSourceSection,
    checkEmploymentSectionData,
    checkFilesSectionData,
    checkFinancialSectionData
};
