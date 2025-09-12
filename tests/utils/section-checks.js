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

    // Don't click application card again - we're already on the session details page
    // The sessionLocator.click() was already called in the main test

    const allSessionWithChildren = [ session, ...(session.children || []) ].filter(Boolean);

    // Wait for financial section header to be ready and click it FIRST to trigger API calls
    const financialHeader = page.getByTestId('financial-section-header');
    await expect(financialHeader).toBeVisible();
    await financialHeader.click();

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
        })
    ]);
    
    // Wait for the financial section to load
    await expect(page.getByTestId('financial-section-financials-radio')).toBeVisible();
    
    // No need to pop since we're not adding the click to the array anymore
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
        const currentSession = allSessionWithChildren[sIndex];
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

        const financialWrapper = await page.getByTestId(`financial-section-financials-wrapper-${currentSession?.id}`);

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

        const container = await page.getByTestId('financial-section-applicant-filter');
        const input = await page.getByTestId('financial-section-applicant-filter-search');

        // Ensure the container is ready before interaction
        await expect(container).toBeVisible();
        
        // Click the container to make the input visible/active
        console.log(`🖱️ Clicking container to activate input for session ${allSessionWithChildren[sIndex].id}`);
        await container.click();
        await page.waitForTimeout(500);
        
        // Try to select the option first - if no response, click again to ensure selection
        console.log(`🔍 Attempting to select filter option for session ${allSessionWithChildren[sIndex].id}`);
        
        try {
            // First attempt: set up response listener and click
            const [ response ] = await Promise.all([
                page.waitForResponse(resp => {
                    const url = resp.url();
                    const urlMatches = url.includes(`/sessions/${allSessionWithChildren[sIndex].id}/transactions`);
                    const methodMatches = resp.request().method() === 'GET';
                    const isOk = resp.ok();
                    
                    // Only log and capture the specific transactions endpoint, exclude static assets and other API calls
                    if (urlMatches && methodMatches && isOk) {
                        console.log(`📡 Transactions response captured: ${url}`);
                        return true;
                    }
                    
                    return false;
                }, { timeout: 5000 }), // Shorter timeout for first attempt
                page.locator(`#financial-section-applicant-filter-${sIndex}`).click()
            ]);
            
            console.log(`✅ Filter option selected successfully for session ${allSessionWithChildren[sIndex].id}`);
            
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
            
        } catch (timeoutError) {
            console.log(`⚠️ First attempt failed (timeout), trying again for session ${allSessionWithChildren[sIndex].id}`);
            await container.click();
            await page.waitForTimeout(500);
            // Second attempt: click again to ensure selection
            const [ response ] = await Promise.all([
                page.waitForResponse(resp => {
                    const url = resp.url();
                    const urlMatches = url.includes(`/sessions/${allSessionWithChildren[sIndex].id}/transactions`);
                    const methodMatches = resp.request().method() === 'GET';
                    const isOk = resp.ok();
                    
                    if (urlMatches && methodMatches && isOk) {
                        console.log(`📡 Transactions response captured on second attempt: ${url}`);
                        return true;
                    }
                    
                    return false;
                }, { timeout: 60_000 }),
                page.locator(`#financial-section-applicant-filter-${sIndex}`).click()
            ]);
            
            console.log(`✅ Filter option selected on second attempt for session ${allSessionWithChildren[sIndex].id}`);
            
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
    }
};

export {
    checkIncomeSourceSection,
    checkEmploymentSectionData,
    checkFilesSectionData,
    checkFinancialSectionData
};
