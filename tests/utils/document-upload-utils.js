import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Document Upload Utilities
 * Common functions for handling document uploads in tests
 */

// Get current directory for ES modules
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Upload paystub documents for employment verification
 * @param {import('@playwright/test').Page} page
 * @param {string|string[]} filePaths - Path(s) to the file(s) to upload
 * @param {Object} options - Upload options
 * @param {string} options.cadence - Pay frequency (default: 'Bi-Weekly')
 * @param {number} options.timeout - Timeout for processing (default: 10000)
 */
export const uploadPaystubDocuments = async (page, filePaths, options = {}) => {
    const { cadence = 'Bi-Weekly', timeout = 10000 } = options;
    
    // Click paystub upload button
    await page.getByTestId('document-pay_stub').click();
    await page.locator('button').filter({ hasText: /^Upload Paystubs$/ }).click();
    
    // Select cadence
    await page.locator('.multiselect__tags').click();
    await page.locator('li').filter({ hasText: new RegExp(`^${cadence}$`) }).click();
    
    // Construct proper file path(s)
    const resolvedFilePaths = Array.isArray(filePaths) 
        ? filePaths.map(file => join(__dirname, '../test_files', file))
        : join(__dirname, '../test_files', filePaths);
    
    // Upload file(s)
    const paystubFileInput = page.locator('input[type="file"]');
    await paystubFileInput.setInputFiles(resolvedFilePaths);
    await page.waitForTimeout(2000);
    
    // Submit upload and wait for API response
    const [employmentResponse] = await Promise.all([
        page.waitForResponse(resp => 
            resp.url().includes('/employment-verifications') &&
            resp.request().method() === 'POST' &&
            resp.ok()
        , { timeout: 30000 }),
        page.locator('button').filter({ hasText: /^Submit$/ }).click()
    ]);
    
    // Wait for Pay Stub section to appear and check for processing
    await expect(page.getByText('Pay StubProcessing')).toBeVisible({ timeout });
    const payStubConnectionRow = page.locator('span:has-text("Pay Stub")').first().locator('xpath=../..');
    
    // Wait for completion
    await waitForConnectionCompletion(page, {
        maxIterations: 130,
        customLocator: payStubConnectionRow
    });
    
    // Verify employment verification API response
    const employmentData = await employmentResponse.json();
    console.log('🚀 ~ Employment verification API response:', employmentData);
    
    // Validate the response
    if (!employmentData.data) {
        throw new Error('Employment verification API did not return expected data structure');
    }
    
    // Continue to next step
    await page.getByTestId('employment-step-continue').click();
    
    return employmentData;
};

/**
 * Verify summary screen completion
 * @param {import('@playwright/test').Page} page
 * @param {Object} options - Verification options
 * @param {number} options.timeout - Timeout for summary to appear (default: 110000)
 */
export const verifySummaryScreen = async (page, options = {}) => {
    const { timeout = 110000 } = options;
    
    await expect(page.locator('h3', { hasText: 'Summary' })).toBeVisible({ timeout });
    const summarySection = page.locator('h3', { hasText: 'Summary' }).locator('xpath=..');
    
    await expect(summarySection.getByText('Rent BudgetCompleted')).toBeVisible();
    await expect(summarySection.getByText('Employment VerificationCompleted')).toBeVisible();
};

/**
 * Verify employment section data
 * @param {import('@playwright/test').Page} page
 * @param {Object} expectedData - Expected employment data
 * @param {string} expectedData.cadence - Expected pay frequency
 * @param {string} expectedData.employer - Expected employer name
 * @param {string} expectedData.count - Expected count
 */
export const verifyEmploymentSection = async (page, expectedData) => {
    const { cadence = 'BIWEEKLY', employer = 'PERSIMMON TECHNOLOGIES CORPORATION', count = '1' } = expectedData;
    
    await page.getByTestId('employment-section-header').click();
    const employmentSection = page.getByTestId('employment-raw');
    
    await expect(employmentSection.locator(`td:has-text("${cadence}")`)).toBeVisible();
    await expect(employmentSection.locator(`td:has-text("${employer}")`)).toBeVisible();
    await expect(employmentSection.locator('td').filter({ hasText: new RegExp(`^${count}$`) })).toBeVisible();
};

/**
 * Verify income sources section
 * @param {import('@playwright/test').Page} page
 */
export const verifyIncomeSourcesSection = async (page) => {
    await page.getByTestId('income-source-section-header').click();
    const incomeSourceSection = page.getByTestId('income-source-section');
    
    await expect(incomeSourceSection.locator('dd:has-text("Financial Transactions")')).toBeVisible();
    await expect(incomeSourceSection.locator('dd:has-text("Paystubs")')).toBeVisible();
};

/**
 * Verify report flags
 * @param {import('@playwright/test').Page} page
 * @param {string[]} expectedFlags - Array of expected flag test IDs
 */
export const verifyReportFlags = async (page, expectedFlags) => {
    await page.getByTestId('view-details-btn').click();
    
    const detailsSection = page.getByTestId('report-view-details-flags-section');
    
    for (const flag of expectedFlags) {
        await expect(detailsSection.getByTestId(flag)).toBeVisible();
    }
};

import { expect } from '@playwright/test';
import { waitForConnectionCompletion } from './session-flow.js'; 