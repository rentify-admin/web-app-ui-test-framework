import { expect } from '@playwright/test';
import { joinUrl } from '~/tests/utils/helper';
import { app } from '~/tests/test_config';
import { waitForJsonResponse } from '~/tests/utils/wait-response';
import generateSessionForm from '~/tests/utils/generate-session-form';
import { handleOptionalStateModal } from '~/tests/utils/session-flow';

const applicationUrl = joinUrl(app.urls.api, 'applications');

/**
 * Helper function to find application row by name
 * @param {import('@playwright/test').Page} page
 * @param {string} applicationName
 * @param {string} tableSelector - CSS selector for the table
 * @returns {Promise<import('@playwright/test').Locator|null>}
 */
const findApplicationRowByName = async (page, applicationName, tableSelector = 'table>tbody>tr') => {
    const rows = await page.locator(tableSelector);
    const rowCount = await rows.count();
    
    for (let index = 0; index < rowCount; index++) {
        const element = rows.nth(index);
        const appName = await element.locator('td').nth(1).textContent();
        
        if (appName === applicationName) {
            return element;
        }
    }
    return null;
};

/**
 * Helper function to wait for applications API response
 * @param {import('@playwright/test').Page} page
 * @param {Function} urlMatcher - Custom URL matching function
 * @param {Function} action - Action to trigger the API call
 * @returns {Promise<Object>} API response data
 */
const waitForApplicationsResponse = async (page, urlMatcher, action) => {
    const [applicationResponse] = await Promise.all([
        page.waitForResponse(resp => 
            resp.url().includes(applicationUrl) &&
            resp.request().method() === 'GET' &&
            resp.ok() &&
            urlMatcher(resp)
        , { timeout: 15000 }), 
        action()
    ]);

    const { data: applications } = await waitForJsonResponse(applicationResponse);
    return applications;
};

const searchAppsWithOrganizations = async (page, organization) => {
    await page.locator('div[aria-owns="listbox-application-filter"]').click();
    await page.locator('#application-filter').fill(organization);
    await expect(page.locator('#application-filter-0')).toHaveText(organization);

    return waitForApplicationsResponse(
        page,
        resp => {
            const url = new URL(resp.url());
            return decodeURI(url.search).includes('"$has":{"organization"');
        },
        () => page.locator('#application-filter-0').click()
    );
};

const gotoApplicationsPage = async page => {
    // Wait for applications load triggered by navigation
    await page.goto('/application/all');
};

const searchApplication = async (page, search) => {
    const searchInput = await page.getByTestId('application-search');
    const appUrlRegex = new RegExp(`${applicationUrl}.+${search}.+`, 'i');

    return waitForApplicationsResponse(
        page,
        resp => appUrlRegex.test(decodeURI(resp.url().replaceAll('+', ' '))),
        () => searchInput.fill(search)
    );
};

/**
 * Search and edit application (optionally remove applicant type and publish)
 * @param {import('@playwright/test').Page} page
 * @param {string} applicationName
 * @param {{removeApplicantType?: string}} options
 */
const searchAndEditApplication = async (page, applicationName, options = {}) => {
    await page.getByTestId('application-search').fill(applicationName);
    await page.waitForTimeout(2000);

    // Click edit button
    await page.locator('a[title="Edit"]').click();
    await page.waitForTimeout(2000);

    if (options.removeApplicantType) {
        // Remove specific applicant type
        // TODO: Request locator update: multiselect__tag is not a good locator.
        await page.locator(`//span[@class="multiselect__tag"][span[text()="${options.removeApplicantType}"]]/i`).click();

        // Submit the edit
        const [ editResponse ] = await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/applications')
                && resp.request().method() === 'PATCH'
                && resp.ok()),
            page.getByTestId('submit-application-setup').click()
        ]);

        await page.waitForTimeout(1000);

        // Handle workflow edit if present (just navigation)
        const workflowEditBtn = page.getByTestId('submit-app-workflow-edit-form');
        if (await workflowEditBtn.isVisible()) {
            await workflowEditBtn.click();
            await page.waitForTimeout(2000); //Wait for UI animation
        }

        // Handle settings modal if present (just navigation)
        const settingsBtn = page.getByTestId('submit-application-setting-modal');
        if (await settingsBtn.isVisible()) {
            await settingsBtn.click();
            await page.waitForTimeout(2000); //Wait for UI animation
        }

        // Inline publish (duplicate minimal logic to avoid dependency)
        await page.locator('h3').filter({ hasText: 'Publish Live' }).waitFor({ state: 'visible', timeout: 10000 });
        await page.waitForSelector('[data-testid="app-publish-live-btn"]', { state: 'visible', timeout: 3000 });
        await page.getByTestId('app-publish-live-btn').click();
        await page.waitForTimeout(2000);
        const publishResponsePromise = page.waitForResponse(resp => resp.url().includes('/applications')
            && resp.request().method() === 'PATCH'
            && resp.ok());
        await page.getByTestId('confirm-btn').click();
        await publishResponsePromise;

        return editResponse;
    }

    // Default: just cancel
    await page.getByTestId('cancel-application-setup').click();
    await page.waitForTimeout(2000);
};

/**
 * Search and verify application (count applicant types)
 * @param {import('@playwright/test').Page} page
 * @param {string} applicationName
 * @returns {Promise<number>}
 */
const searchAndVerifyApplication = async (page, applicationName) => {
    await page.getByTestId('application-search').fill(applicationName);
    await page.waitForTimeout(2000);

    // Click edit button
    await page.locator('a[title="Edit"]').click();
    await page.waitForTimeout(2000);

    // Count applicant types and cancel
    // TODO: Request locator update: multiselect__tag is not a good locator.
    const applicantTypeCount = await page.locator('span.multiselect__tag').count();
    await page.getByTestId('cancel-application-setup').click();
    await page.waitForTimeout(2000);

    return applicantTypeCount;
};

/**
 * Find application by name and click invite link
 * @param {import('@playwright/test').Page} page
 * @param {string} applicationName
 */
const findAndInviteApplication = async (page, applicationName) => {
    await searchApplication(page, applicationName);

    const rows = await page.locator('table>tbody>tr');

    for (let index = 0; index < await rows.count(); index++) {
        const element = rows.nth(index);
        const appName = await element.locator('td').nth(1)
            .textContent();

        if (appName === applicationName) {
            await element.locator('td').getByRole('link', { name: 'Invite' })
                .click();
            
            // Wait for the modal to be visible
            await expect(page.locator('#generate-session-form')).toBeVisible();
            break;
        }
    }
};

/**
 * Find application by name in organization and click invite
 * @param {import('@playwright/test').Page} page
 * @param {string} organizationName
 * @param {string} applicationName
 * @returns {Promise<boolean>} Whether application was found and invited
 */
const findApplicationByNameAndInvite = async (page, organizationName, applicationName) => {
    await searchAppsWithOrganizations(page, organizationName);
    await page.waitForTimeout(1000);
    
    const rows = await page.locator('section table.table>tbody>tr');
    await page.locator('section h3').click();

    const rowCount = await rows.count();
    for (let index = 0; index < rowCount; index++) {
        const element = rows.nth(index);
        const tdElement = await element.locator('td').nth(1);
        const tdText = await tdElement.innerText();

        if (tdText.includes(applicationName)) {
            const tdInviteElement = await element.locator('td').nth(6);
            await expect(tdInviteElement).toHaveText('Invite');
            const inviteBtn = await tdInviteElement.locator('a');
            await inviteBtn.click();
            await page.waitForTimeout(1000);
            return true;
        }
    }

    console.log(`Application '${applicationName}' not found in organization '${organizationName}'`);
    await page.waitForTimeout(1000);
    return false;
};

/**
 * Find application by name, click the Copy button, and return the copied application URL.
 * @param {import('@playwright/test').Page} page
 * @param {string} applicationName
 * @returns {Promise<string>} The copied application URL
 */
const findAndCopyApplication = async (page, applicationName) => {
    await searchApplication(page, applicationName);
    
    const row = await findApplicationRowByName(page, applicationName);
    if (!row) {
        throw new Error(`Application '${applicationName}' not found for copying`);
    }
    
    // Click on Copy button
    const copyBtn = row.locator('button:has-text("Copy")');
    await copyBtn.click();
    
    // Try to get the copied content from clipboard first
    let applicationUrl = '';
    
    try {
        const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
        if (clipboardContent && clipboardContent.includes(`${app.urls.app}/applications/`)) {
            console.log('✅ Successfully retrieved URL from clipboard:', clipboardContent);
            applicationUrl = clipboardContent;
        } else {
            throw new Error('Clipboard content is not a valid application URL');
        }
    } catch (error) {
        console.log('⚠️ Could not access clipboard, falling back to DOM extraction');
        
        // Fallback: Click Invite button to open modal with code
        const inviteBtn = row.locator('a:has-text("Invite")');
        await inviteBtn.click();
        
        // Wait for modal to appear and find the code element
        await page.waitForSelector('code', { timeout: 10000 });
        const codeElement = page.locator('code');
        const applicationId = await codeElement.textContent();
        console.log('📋 Extracted application ID from DOM:', applicationId);
        
        // Construct the full application URL using environment config
        applicationUrl = `${app.urls.app}/applications/${applicationId}`;
    }
    
    console.log('🔗 Constructed application URL:', applicationUrl);
    
    // Close the modal
    const closeBtn = page.locator('[data-testid="generate-session-modal-cancel"]');
    if (await closeBtn.isVisible()) {
        await closeBtn.click();
    }
    
    return applicationUrl;
};

const checkApplicationEditable = async page => {
    await expect(page.locator('[data-testid^="edit-"]').first()).toBeVisible();

    // Click of Edit button of the first application button
    await page.locator('[data-testid^="edit-"]').first().click();

    // Check URL change to edit url
    await expect(page).toHaveURL(/application\/.+\/edit/);

    // Check edit application input is not empty (data loaded properly)
    await expect(page.locator('input#application_name')).not.toBeEmpty({ timeout: 10_000 });

    // Click on cancel button
    await page.getByTestId('cancel-application-setup').click();
};

const checkApplicationDeletable = async page => {
    const onDialog = async dialog => {
        if (dialog.type() === 'confirm') {
            await dialog.dismiss();
            page.off('dialog', onDialog);
        }
    };
    page.on('dialog', onDialog);

    await page.locator('[data-testid^=delete-]').first().click();
};

// Opens the application edit modal for the first row (or by name if needed)
export async function openApplicationEditModal(page, rowIndex = 0) {
    await page.locator('table > tbody > tr > td:nth-child(8) > div > a').nth(rowIndex).click();
    await page.waitForTimeout(2000);
}

// Opens the workflow identity setup modal
export async function openWorkflowIdentitySetup(page) {
    await page.locator('[data-testid="workflow-identity-verification"] svg').click();
    await expect(page.locator('h3', { hasText: 'Workflow Setup' })).toBeVisible();
}

// Sets the Persona Template ID and saves
export async function setPersonaTemplateId(page, value) {
    const personaInput = page.locator('input[placeholder="Enter Persona Template ID"]');
    await personaInput.fill(value);
    await page.getByTestId('submit-identity-setup-form').click();
}

// Verifies the Persona Template ID value
export async function expectPersonaTemplateId(page, expectedValue) {
    const personaInput = page.locator('input[placeholder="Enter Persona Template ID"]');
    await expect(personaInput).toHaveValue(expectedValue);
}

// Navigate to applicants section and wait for sessions to load
async function navigateToApplicants(page) {
    await page.getByTestId('applicants-menu').click();
    await page.getByTestId('applicants-submenu').click();
    await page.waitForTimeout(2000);
    await page.reload();
    await page.waitForTimeout(5000);
}

// Start a session by clicking the Start button
async function startSession(page) {
    await page.locator('button[type="button"].btn.rounded-full.btn-primary').click();
    await page.waitForTimeout(5000);
}

// Extract sessionId from current URL
async function extractSessionId(page) {
    return await page.evaluate(() => {
        const urlParts = window.location.href.split('/');
        return urlParts[urlParts.length - 1];
    });
}

// Navigate back to dashboard
async function navigateToDashboard(page) {
    await page.goto(`${app.urls.app}/application/all`);
    await page.waitForTimeout(4000);
}

// Complete session generation flow: find app, invite, fill form, and get link
async function generateSessionForApplication(page, appName, userData) {
    // Find and invite application
    await findAndInviteApplication(page, appName);
    
    // Fill and submit session form
    await generateSessionForm.fill(page, userData);
    const sessionData = await generateSessionForm.submit(page);
    
    // Get the session link
    const linkSection = page.getByTestId('session-invite-link');
    await expect(linkSection).toBeVisible();
    const link = await linkSection.getAttribute('href');
    
    // Close modal
    await page.getByTestId('generate-session-modal-cancel').click();
    
    return { sessionData, link };
}

// Complete applicant initial setup: navigate, handle state modal, fill rent budget
async function completeApplicantInitialSetup(page, link, rentBudget = '555') {
    // Navigate to applicant view
    await page.goto(link);
    await page.waitForTimeout(8000);
    
    // Handle state modal if it appears
    await handleOptionalStateModal(page);
    
    // Extract session URL from link and use environment config
    const sessionUrl = new URL(link).pathname.replace('/sessions/', '');
    const fullSessionUrl = `${app.urls.api}/sessions/${sessionUrl}`;
    
    // Fill rent budget in applicant form and wait for PATCH response
    await page.locator('input[id="rent_budget"]').fill(rentBudget);
    await Promise.all([
        page.waitForResponse(resp => resp.url().includes(fullSessionUrl)
            && resp.request().method() === 'PATCH'
            && resp.ok()),
        page.locator('button[type="submit"]').click()
    ]);
    
    // Wait for the session to be updated
    await page.waitForTimeout(2000);
}

export {
    searchAppsWithOrganizations,
    gotoApplicationsPage,
    searchApplication,
    searchAndEditApplication,
    searchAndVerifyApplication,
    findAndInviteApplication,
    findApplicationByNameAndInvite,
    findAndCopyApplication,
    checkApplicationEditable,
    checkApplicationDeletable,
    navigateToApplicants,
    startSession,
    extractSessionId,
    navigateToDashboard,
    generateSessionForApplication,
    completeApplicantInitialSetup
};
