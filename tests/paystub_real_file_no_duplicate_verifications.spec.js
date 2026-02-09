import { test, expect } from '@playwright/test';
import { adminLoginAndNavigateToApplications } from './utils/session-utils';
import { admin, app, session as sessionConfig } from './test_config';
import { openInviteModal, searchApplication } from './utils/applications-page';
import generateSessionForm from './utils/generate-session-form';
import { getRandomEmail, joinUrl } from './utils/helper';
import { handleOptionalStateModal, updateRentBudget } from './utils/session-flow';
import { waitForJsonResponse } from './utils/wait-response';
import { dirname, join } from 'path';
import { cleanupSession } from './utils/cleanup-helper';
import { fileURLToPath } from 'url';
import { ApiClient } from './api';
import { pollForVerificationStatus } from './utils/polling-helper';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const guestClient = new ApiClient(app.urls.api, null, 120_000);

test.describe('QA-356 paystub_real_file_no_duplicate_verifications.spec', () => {

    test.setTimeout(5 * 60 * 1000); // Set timeout to 5 minutes for the entire test suite

    const APPLICATION_NAME = 'Autotest - Employ Real File Only';
    const FALLBACK_APPLICATION_NAME = 'Autotest - Employ Real File Only Fallback';

    let createdSessionId = null;
    let guestAuthToken = null;
    const user = {
        first_name: 'Paystub',
        last_name: 'RealFileNoDup',
        email: getRandomEmail(),
        password: 'passwword'
    };

    test('Should not create duplicate verifications when uploading the same paystub file multiple times', {
        tag: ['@core', '@regression'],
    }, async ({ page, context }) => {

        // Login as admin and navigate to applications page
        console.log('[Setup] Creating session for user:', user.email);
        console.log('    > login as admin and navigate to applications page');
        await adminLoginAndNavigateToApplications(page, admin)

        console.log('    > searching for application by name:', APPLICATION_NAME);
        let applications = await searchApplication(page, APPLICATION_NAME);
        if (applications.length === 0) {
            let applications = await searchApplication(page, FALLBACK_APPLICATION_NAME);
            if (applications.length === 0) {
                throw new Error(`Neither ${APPLICATION_NAME} nor ${FALLBACK_APPLICATION_NAME} application found. Please ensure at least one of them exists for the test.`);
            }
        }
        const application = applications[0];

        console.log('    > opening invite modal for application:', application.name);
        await openInviteModal(page, application.name);

        console.log('    > generating session and extracting link for user:', user.email);
        const { sessionId, link } = await generateSessionForm.generateSessionAndExtractLink(page, user);

        createdSessionId = sessionId
        console.log('    >Created session ID:', createdSessionId);
        // Navigate to the session link as the invited user

        console.log('    > navigating to session link as invited user');
        await page.getByTestId('user-dropdown-toggle-btn').click();
        const logoutPromise = page.waitForResponse(resp =>
            resp.url().includes('/auth')
            && resp.request().method() === 'DELETE'
            && resp.ok());
        await page.getByTestId('user-logout-dropdown-item').click();
        await logoutPromise;

        const linkUrl = new URL(link);
        
        console.log('    > waiting for guest auth token response');
        const tokenPromise = page.waitForResponse(
            resp => resp.url().includes('/auth/guest') && resp.ok(),
            { timeout: 30000 }  // ✅ Add explicit timeout
        ).then(async resp => {
            const body = await resp.json();
            const token = body.data?.token || body.token;
            console.log('✅ Captured guest auth token');
            return token;
        }).catch(error => {
            console.log('⚠️ Failed to capture auth token:', error.message);
            return null;  // ✅ Return null instead of crashing
        });
        const sessionPromise = page.waitForResponse(resp =>
            resp.url().includes(`/sessions/${createdSessionId}`)
            && resp.url().includes(`fields[session]`)
            && resp.request().method() === 'GET'
            && resp.ok());
        await page.goto(joinUrl(app.urls.app, `${linkUrl.pathname}${linkUrl.search}`));
        guestAuthToken = await tokenPromise;
        console.log('    > setting guest auth token in API client');
        guestClient.setAuthToken(guestAuthToken);  // ✅ Set the captured token in the API client

        const sessionResponse = await sessionPromise;
        const sessionData = await waitForJsonResponse(sessionResponse);
        const { data: session } = sessionData;
        console.log('    > handling state and terms checkbox');
        await handleStateAndTermsCheckbox(page, session);

        console.log('    > updating rent budget');
        await updateRentBudget(page, sessionId, '500');

        const employmentStep = page.getByTestId('employment-verification-step');
        await expect(employmentStep).toBeVisible({ timeout: 15_000 });

        console.log('[STEP 1] Uploading paystub files and verifying no duplicate verifications are created');
        // Click paystub upload button
        await page.getByTestId('document-pay_stub').click();
        await page.getByTestId('employment-upload-paystub-btn').click();
        await page.waitForTimeout(500);
        const acknowledgeBtn = page.getByTestId('acknowledge-upload-paystubs-btn');
        if (await acknowledgeBtn.isVisible()) {
            await acknowledgeBtn.click();
        }


        await uploadPaystub(page, context, guestAuthToken, 'paystub_recent.pdf');
        console.log('    > uploaded paystub_recent.pdf');

        let verifications = await getEmploymentVerifications(sessionId);

        expect(verifications.length).toBe(1);  // Expect only 1 verification record for the uploaded paystub    

        console.log('[STEP 2] Uploading the same paystub file again and verifying no duplicate verification is created');
        await page.getByTestId('document-pay_stub').click();
        await page.getByTestId('employment-upload-paystub-btn').click();
        await page.waitForTimeout(500);

        await uploadPaystub(page, context, guestAuthToken, 'paystub_recent.png');
        console.log('    > uploaded paystub_recent.png');
        verifications = await getEmploymentVerifications(sessionId);

        console.log('    > verification count after uploading a different file:', verifications.length);
        expect(verifications.length).toBe(2);  // Expect only 2 verification records for the uploaded paystubs    

        console.log('[STEP 3] Uploading the same paystub file again and verifying no duplicate verification is created');
        await page.getByTestId('document-pay_stub').click();
        await page.getByTestId('employment-upload-paystub-btn').click();
        await page.waitForTimeout(500);
        await uploadPaystub(page, context, guestAuthToken, 'paystub_recent.pdf');
        console.log('    > uploaded paystub_recent.pdf');
        verifications = await getEmploymentVerifications(sessionId);
        console.log('    > verification count after uploading the same file again:', verifications.length);
        expect(verifications.length).toBe(3);  // Expect only 3 verification records for the uploaded paystubs (same file uploaded again should create a new verification)

        console.log('    > Waiting for a while and verifying no additional duplicate verifications are created');
        await page.waitForTimeout(25_000);  // Wait for any pending UI updates before ending the test

        console.log('    > fetching employment verifications after waiting');
        verifications = await getEmploymentVerifications(sessionId);
        
        console.log('    > final verification count after waiting:', verifications.length);
        expect(verifications.length).toBe(3);  // Final check to ensure no additional verifications were created after waiting

    })


    test.afterAll(async ({ request }) => {

        if (createdSessionId) {
            await cleanupSession(request, createdSessionId, true);
        }

    })

});

async function getEmploymentVerifications(sessionId) {
    const employmentVerificationsResponse = await guestClient.get(`/employment-verifications`, {
        params: {
            filters: JSON.stringify({
                "$has": {
                    "step": {
                        "session_id": {
                            "$in": [sessionId]
                        }
                    }
                }
            })
        }
    });

    await expect(employmentVerificationsResponse.status).toBe(200);

    const verifications = employmentVerificationsResponse.data.data;
    console.log('🚀 Employment verifications for session:', verifications);
    return verifications;
}

async function uploadPaystub(page, context, guestAuthToken, fileName = 'paystub_recent.pdf') {
    // Select cadence
    const cadence = 'Bi-Weekly';
    await page.locator('.multiselect__tags').click();
    await page.locator('li').filter({ hasText: new RegExp(`^${cadence}$`) }).click();


    const filePath = join(__dirname, './test_files', fileName);

    const paystubFileInput = page.locator('input[type="file"]');
    await paystubFileInput.setInputFiles(filePath);
    await page.waitForTimeout(2000);

    // Submit upload and wait for API response
    const [employmentResponse] = await Promise.all([
        page.waitForResponse(resp => resp.url().includes('/employment-verifications') &&
            resp.request().method() === 'POST' &&
            resp.ok(), { timeout: 30000 }),
        page.getByTestId('employment-step-submit-btn').click()
    ]);

    const employmentData = await waitForJsonResponse(employmentResponse);

    console.log('🚀 Polling for employment-verification COMPLETED status via API...');
    await pollForVerificationStatus(context, employmentData.data.id, 'employment-verifications', {
        maxAttempts: 20,
        pollInterval: 4000,
        authToken: guestAuthToken // ✅ Pass the captured guest token
    });
    console.log('✅ Document verification completed via API polling');
}

async function handleStateAndTermsCheckbox(page, session) {

    console.log('🔍 Checking for state modal requirement...');
    if (!session?.applicant?.administrative_area && session?.application.workflow?.steps?.some(step => [
        sessionConfig.STEP_KEYS.FINANCIAL, sessionConfig.STEP_KEYS.EMPLOYMENT
    ].includes(step?.task?.key))) {

        const stateModal = page.getByTestId('state-modal');
        await expect(stateModal).toBeVisible({ timeout: 20_000 });

        await handleOptionalStateModal(page);
    }
    console.log('🔍 Checking for terms and conditions checkbox...');
    const termsCheckbox = page.getByTestId('user-terms');
    if (await termsCheckbox.isVisible()) {
        await termsCheckbox.check({ timeout: 5000 });
        await page.getByTestId('terms-submit-btn').click();
    }
    await page.waitForTimeout(1000);
}