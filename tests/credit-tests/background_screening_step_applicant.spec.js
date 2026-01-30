import { test, expect } from "@playwright/test";
import { ApiClient, ApplicationApi, SessionApi } from "../api";
import { app } from "../test_config";
import { loginWithAdmin } from "../endpoint-utils/auth-helper";
import { handleOptionalStateModal, handleOptionalTermsCheckbox, updateRentBudget } from "../utils/session-flow";
import { fillMultiselect } from "../utils/common";

const adminClient = new ApiClient(app.urls.api, null, 120_000);
const applicationApi = new ApplicationApi(adminClient);
const sessionApi = new SessionApi(adminClient);

test.describe("QA-319 background_screening_step_applicant.spec", () => {

    const APPLICATION_NAME = 'AutoTest - ID and Background';
    let test1session = null;
    let test2session = null;
    let test3session = null;
    const user = {
        first_name: 'AutoTest',
        last_name: 'Applicant',
        email: `autotest_applicant_${Date.now()}@example.com`,
        invite: true
    }

    const testResults = {
        test1: { started: false, passed: false, sessionId: null },
        test2: { started: false, passed: false, sessionId: null },
        test3: { started: false, passed: false, sessionId: null }
    };

    test.beforeAll(async () => {
        // Create a new application via API before running tests
        await loginWithAdmin(adminClient);

        const application = await applicationApi.getByName(APPLICATION_NAME);
        expect(application).toBeDefined();

        user.application = application.id;
        // TODO: application has workflow with step BACKGROUND_CHECK with settings.workflows.tasks.background_check.enable_credit setting is false

        // create session of application
        const sessionData = await sessionApi.create(user);
        test1session = sessionData.data;
        expect(test1session).toBeDefined();
        testResults.test1.sessionId = test1session.id;
        console.log(`🆕 Created session with ID: ${test1session.id} for application: ${APPLICATION_NAME}`);

        const test2sessionData = await sessionApi.create(user);
        test2session = test2sessionData.data;
        expect(test2session).toBeDefined();
        testResults.test2.sessionId = test2session.id;
        console.log(`🆕 Created session with ID: ${test2session.id} for application: ${APPLICATION_NAME} for No-SSN flow`);


        const test3sessionData = await sessionApi.create(user);
        test3session = test3sessionData.data;
        expect(test3session).toBeDefined();
        testResults.test3.sessionId = test3session.id;
        console.log(`🆕 Created session with ID: ${test3session.id} for application: ${APPLICATION_NAME} for test3 flow`);

    })

    test('Verify Identity → Background Screening transition + successful submission', {
        tag: ['@regression', '@core', '@credit-tests']
    }, async ({ page }) => {

        testResults.test1.started = true;

        await page.goto(test1session.url.replace('https://dev.verifast.app', app.urls.app));

        // Handle optional terms modal/checkbox (no applicant type in this flow)
        await handleOptionalTermsCheckbox(page);

        await expect(page.getByTestId('rent-budget-step')).toBeVisible();
        console.log('✅ On Rent budget page')

        console.log('🚀 Filing rent budget')
        await updateRentBudget(page, test1session.id, '600');
        console.log('✅ Filing rent budget')

        const identitystep = page.getByTestId('identify-step');
        await expect(identitystep).toBeVisible({ timeout: 10_000 });
        console.log('✅ On Identity verification page')

        const skipButton = page.getByTestId('id-simulation-skip-btn');
        await expect(skipButton).toBeVisible();
        console.log('🚀 Clicking skip button on identity verification page');
        await skipButton.click();

        let steps = await getStepsFromSession(test1session);

        const identityStep = steps.find(step => step.step?.task?.key === 'IDENTITY_VERIFICATION');
        expect(identityStep).toBeDefined();

        const skipModal = page.getByTestId('skip-step-modal');
        await expect(skipModal).toBeVisible();

        const skipReasonInput = skipModal.getByTestId('skip-step-reason-input');
        await skipReasonInput.fill('Automation test - skipping step verification');

        const confirmSkipButton = skipModal.getByTestId('confirm-skip-step-btn');
        await expect(confirmSkipButton).toBeEnabled();
        console.log('🚀 Confirming skip identity verification');
        const skipUrl = `/sessions/${test1session.id}/steps/${identityStep.id}`;
        const skipUrlPromise = page.waitForResponse(resp => resp.url().includes(skipUrl) && resp.request().method() === 'PATCH' && resp.ok());
        await confirmSkipButton.click();
        await skipUrlPromise

        await expect(skipModal).not.toBeVisible();

        const backgroundScreeningStep = page.getByTestId('background-screening-step');
        await expect(backgroundScreeningStep).toBeVisible({ timeout: 10_000 });
        console.log('✅ On Background Screening page')

        await backgroundScreeningStep.getByTestId('first-name-input').fill(user.first_name);
        await backgroundScreeningStep.getByTestId('last-name-input').fill(user.last_name);
        // - Leave data-testid="no-middle-name-checkbox" unchecked and provide data-testid="middle-name-input" (or check the box and ensure middle name input is disabled)
        await backgroundScreeningStep.getByTestId('middle-name-input').fill('M');
        // ensure ssn is masked (password-like behavior)
        const ssnInput = backgroundScreeningStep.getByTestId('ssn-input');
        await ssnInput.fill('123456789');
        // check attribute type is password
        await expect(ssnInput).toHaveAttribute('type', 'password');

        const { dd, mm, yyyy } = getDateYearsAgo(30);
        // use type input to fill date of birth
        await backgroundScreeningStep.getByTestId('date-of-birth-input').pressSequentially(`${mm}/${dd}/${yyyy}`);

        await backgroundScreeningStep.getByTestId('address-line-1-input').fill('123 Main St');
        await backgroundScreeningStep.getByTestId('city-input').fill('Anytown');
        await backgroundScreeningStep.getByTestId('postal-code-input').fill('12345');

        await fillMultiselect(page, backgroundScreeningStep.getByTestId('country-select'), ['US']);
        await expect(backgroundScreeningStep.getByTestId('state-select')).toBeEnabled();
        await fillMultiselect(page, backgroundScreeningStep.getByTestId('state-select'), ['ALASKA']);

        /**
         * - Terms:
         * - Check data-testid="terms-agreement-checkbox"
         * - Check data-testid="fcra-rights-checkbox"
         * - Signature:
         * - Draw a signature on data-testid="background-signature-pad"
         */

        await backgroundScreeningStep.getByTestId('terms-agreement-checkbox').check();
        await backgroundScreeningStep.getByTestId('fcra-rights-checkbox').check();
        // Draw signature
        const signaturePad = backgroundScreeningStep.getByTestId('background-signature-pad');
        const box = await signaturePad.boundingBox();
        if (box) {
            const { x, y, width, height } = box;
            await page.mouse.move(x + width / 4, y + height / 2);
            await page.mouse.down();
            await page.mouse.move(x + (width * 3) / 4, y + (height / 4));
            await page.mouse.move(x + (width * 3) / 4, y + (height * 3) / 4);
            await page.mouse.move(x + width / 4, y + (height * 3) / 4);
            await page.mouse.move(x + width / 4, y + height / 2);
            await page.mouse.up();
        } else {
            throw new Error('Signature pad bounding box not found');
        }
        /** 
         * Submit:
         * - Intercept: POST /sessions/{sessionId}/steps/{sessionStepId}/backgrounds
         * - Intercept: PATCH /sessions/{sessionId}/steps/{sessionStepId} (or equivalent) to set status COMPLETED
         * - Click data-testid="background-screening-continue-btn"
         */

        steps = await getStepsFromSession(test1session);
        const backgroundStep = steps.find(step => step.step?.task?.key === 'BACKGROUND_CHECK');
        expect(backgroundStep).toBeDefined();

        const backgroundSubmitResponsePromise = page.waitForResponse(resp => {
            const url = `/sessions/${test1session.id}/steps/${backgroundStep.id}/backgrounds`;
            return resp.url().includes(url) && resp.request().method() === 'POST' && resp.ok();
        });

        const backgroundCompleteResponsePromise = page.waitForResponse(resp => {
            const url = `/sessions/${test1session.id}/steps/${backgroundStep.id}`;
            return resp.url().includes(url) && resp.request().method() === 'PATCH' && resp.ok();
        });

        // on click dialog opens and cancel dialog appears, so we need to handle that
        page.once('dialog', async dialog => {
            await dialog.dismiss();
        });
        await backgroundScreeningStep.getByTestId('background-screening-continue-btn').click();

        await backgroundSubmitResponsePromise;
        await backgroundCompleteResponsePromise;
        console.log('✅ Background screening submitted successfully')
        /**
         * - Verification (API):
         * - GET /sessions/{sessionId}/steps/{sessionStepId}/backgrounds: returns an item with signature present (signature[0].url)
         * - returns associated term/version (term.created_at, term.name, term.version) when applicable
         * - does not expose raw SSN (SSN should be absent, empty, or masked depending on API contract)
         * - no_ssn_reason is empty when SSN is provided
         */


        const backgroundDetailsResponse = await adminClient.get(`/sessions/${test1session.id}/steps/${backgroundStep.id}/backgrounds`, {
            params: {
                'fields[background]': ':all',
                'fields[term]': ':all'
            }
        });
        const backgroundData = backgroundDetailsResponse.data.data;

        expect(backgroundData.length).toBeGreaterThan(0);
        const backgroundInfo = backgroundData[0];

        // - GET /sessions/{sessionId}/steps/{sessionStepId}/backgrounds: returns an item with signature present (signature[0].url)
        expect(backgroundInfo.signature).toBeDefined();
        expect(backgroundInfo.signature.length).toBeGreaterThan(0);
        expect(backgroundInfo.signature[0].url).toBeDefined();

        // - does not expose raw SSN (SSN should be absent, empty, or masked depending on API contract)
        expect(backgroundInfo.ssn).not.toBe('123456789');
        expect(backgroundInfo.ssn).toMatch(/\*\*\*-\*\*-\d{4}/);

        // - no_ssn_reason is empty when SSN is provided
        expect(backgroundInfo.no_ssn_reason).toBeNull();

        // returns associated term/version (term.created_at, term.name, term.version) when applicable
        expect(backgroundInfo.term).toBeDefined();
        expect(backgroundInfo.term.name).toBeDefined();
        expect(backgroundInfo.term.version).toBeDefined();
        expect(backgroundInfo.term.created_at).toBeDefined();

        console.log('✅ Background screening data verified successfully via API')

        testResults.test1.passed = true;

    })

    test('Verify No-SSN flow persists `no_ssn_reason`', {
        tag: ['@regression', '@core', '@credit-tests']
    }, async ({ page }) => {

        testResults.test2.started = true;

        await page.goto(test2session.url.replace('https://dev.verifast.app', app.urls.app));

        // Handle optional terms modal/checkbox (no applicant type in this flow)
        await handleOptionalTermsCheckbox(page);

        await expect(page.getByTestId('rent-budget-step')).toBeVisible();
        console.log('✅ On Rent budget page')

        console.log('🚀 Filing rent budget')
        await updateRentBudget(page, test2session.id, '600');
        console.log('✅ Filing rent budget')

        const identitystep = page.getByTestId('identify-step');
        await expect(identitystep).toBeVisible({ timeout: 10_000 });
        console.log('✅ On Identity verification page')

        const skipButton = page.getByTestId('id-simulation-skip-btn');
        await expect(skipButton).toBeVisible();
        console.log('🚀 Clicking skip button on identity verification page');
        await skipButton.click();

        let steps = await getStepsFromSession(test2session);

        const identityStep = steps.find(step => step.step?.task?.key === 'IDENTITY_VERIFICATION');
        expect(identityStep).toBeDefined();

        const skipModal = page.getByTestId('skip-step-modal');
        await expect(skipModal).toBeVisible();

        const skipReasonInput = skipModal.getByTestId('skip-step-reason-input');
        await skipReasonInput.fill('Automation test - skipping step verification');

        const confirmSkipButton = skipModal.getByTestId('confirm-skip-step-btn');
        await expect(confirmSkipButton).toBeEnabled();
        console.log('🚀 Confirming skip identity verification');
        const skipUrl = `/sessions/${test2session.id}/steps/${identityStep.id}`;
        const skipUrlPromise = page.waitForResponse(resp => resp.url().includes(skipUrl) && resp.request().method() === 'PATCH' && resp.ok());
        await confirmSkipButton.click();
        await skipUrlPromise
        await expect(skipModal).not.toBeVisible();
        const backgroundScreeningStep = page.getByTestId('background-screening-step');
        await expect(backgroundScreeningStep).toBeVisible({ timeout: 10_000 });
        console.log('✅ On Background Screening page')

        /**
         * SSN section:
         * - Check data-testid="no-ssn-checkbox" and verify:
         * - data-testid="ssn-input" is disabled
         * - data-testid="no-ssn-reason-textarea" is visible and required
         * - Fill data-testid="no-ssn-reason-textarea" with a unique reason string
         */

        await backgroundScreeningStep.getByTestId('no-ssn-checkbox').check();

        const ssnInput = backgroundScreeningStep.getByTestId('ssn-input');
        await expect(ssnInput).toBeDisabled();

        const noSsnReasonTextarea = backgroundScreeningStep.getByTestId('no-ssn-reason-textarea');
        await expect(noSsnReasonTextarea).toBeVisible();
        await noSsnReasonTextarea.locator('textarea').fill(`Automation test - no SSN reason ${Date.now()}`);

        /**
         * Complete remaining required fields, check ToS/FCRA, sign, and submit (data-testid="background-screening-continue-btn")
         */
        await backgroundScreeningStep.getByTestId('first-name-input').fill(user.first_name);
        await backgroundScreeningStep.getByTestId('last-name-input').fill(user.last_name);
        await backgroundScreeningStep.getByTestId('middle-name-input').fill('M');
        const { dd, mm, yyyy } = getDateYearsAgo(30);
        await backgroundScreeningStep.getByTestId('date-of-birth-input').pressSequentially(`${mm}/${dd}/${yyyy}`);
        await backgroundScreeningStep.getByTestId('address-line-1-input').fill('123 Main St');
        await backgroundScreeningStep.getByTestId('city-input').fill('Anytown');
        await backgroundScreeningStep.getByTestId('postal-code-input').fill('12345');
        await fillMultiselect(page, backgroundScreeningStep.getByTestId('country-select'), ['US']);
        await expect(backgroundScreeningStep.getByTestId('state-select')).toBeEnabled();
        await fillMultiselect(page, backgroundScreeningStep.getByTestId('state-select'), ['ALASKA']);
        await backgroundScreeningStep.getByTestId('terms-agreement-checkbox').check();
        await backgroundScreeningStep.getByTestId('fcra-rights-checkbox').check();
        // Draw signature
        const signaturePad = backgroundScreeningStep.getByTestId('background-signature-pad');
        const box = await signaturePad.boundingBox();
        if (box) {
            const { x, y, width, height } = box;
            await page.mouse.move(x + width / 4, y + height / 2);
            await page.mouse.down();
            await page.mouse.move(x + (width * 3) / 4, y + (height / 4));
            await page.mouse.move(x + (width * 3) / 4, y + (height * 3) / 4);
            await page.mouse.move(x + width / 4, y + (height * 3) / 4);
            await page.mouse.move(x + width / 4, y + height / 2);
            await page.mouse.up();
        } else {
            throw new Error('Signature pad bounding box not found');
        }

        steps = await getStepsFromSession(test2session);

        const backgroundStep = steps.find(step => step.step?.task?.key === 'BACKGROUND_CHECK');
        expect(backgroundStep).toBeDefined();

        const backgroundSubmitResponsePromise = page.waitForResponse(resp => {
            const url = `/sessions/${test2session.id}/steps/${backgroundStep.id}/backgrounds`;
            return resp.url().includes(url) && resp.request().method() === 'POST' && resp.ok();
        });

        const backgroundCompleteResponsePromise = page.waitForResponse(resp => {
            const url = `/sessions/${test2session.id}/steps/${backgroundStep.id}`;
            return resp.url().includes(url) && resp.request().method() === 'PATCH' && resp.ok();
        });
        // on click dialog opens and cancel dialog appears, so we need to handle that
        page.once('dialog', async dialog => {
            await dialog.dismiss();
        });
        await backgroundScreeningStep.getByTestId('background-screening-continue-btn').click();

        await backgroundSubmitResponsePromise;
        await backgroundCompleteResponsePromise;
        console.log('✅ Background screening (No-SSN) submitted successfully')

        /**
         * Verification (API):
         * - Intercept POST /sessions/{sessionId}/steps/{sessionStepId}/backgrounds and verify payload:
         * - ssn is ''
         * - no_ssn_reason equals the reason entered
         * - GET /sessions/{sessionId}/steps/{sessionStepId}/backgrounds confirms no_ssn_reason is persisted (addresses the regression noted in VC-1189 comments)
         */

        const backgroundDetailsResponse = await adminClient.get(`/sessions/${test2session.id}/steps/${backgroundStep.id}/backgrounds`, {
            params: {
                'fields[background]': ':all'
            }
        });
        const backgroundData = backgroundDetailsResponse.data.data;
        expect(backgroundData.length).toBeGreaterThan(0);
        const backgroundInfo = backgroundData[0];
        // - ssn is ''
        expect(backgroundInfo.ssn).toBe(null);

        // - no_ssn_reason equals the reason entered
        expect(backgroundInfo.no_ssn_reason).toMatch(/Automation test - no SSN reason \d+/);
        testResults.test2.passed = true;
    })

    test('Verify Background Screening Step Form comes prefilled after submission', {
        tag: ['@regression', '@core', '@credit-tests']
    }, async ({ page }) => {

        testResults.test3.started = true;

        await page.goto(test3session.url.replace('https://dev.verifast.app', app.urls.app));

        // Handle optional terms modal/checkbox (no applicant type in this flow)
        await handleOptionalTermsCheckbox(page);

        await expect(page.getByTestId('rent-budget-step')).toBeVisible();
        console.log('✅ On Rent budget page')
        console.log('🚀 Filing rent budget')
        await updateRentBudget(page, test3session.id, '600');
        console.log('✅ Filing rent budget')
        const identitystep = page.getByTestId('identify-step');
        await expect(identitystep).toBeVisible({ timeout: 10_000 });
        console.log('✅ On Identity verification page')
        const skipButton = page.getByTestId('id-simulation-skip-btn');
        await expect(skipButton).toBeVisible();
        console.log('🚀 Clicking skip button on identity verification page')
        await skipButton.click()
        let steps = await getStepsFromSession(test3session)
        const identityStep = steps.find(step => step.step?.task?.key === 'IDENTITY_VERIFICATION')
        expect(identityStep).toBeDefined()
        const skipModal = page.getByTestId('skip-step-modal');
        await expect(skipModal).toBeVisible();
        const skipReasonInput = skipModal.getByTestId('skip-step-reason-input');
        await skipReasonInput.fill('Automation test - skipping step verification');
        const confirmSkipButton = skipModal.getByTestId('confirm-skip-step-btn');
        await expect(confirmSkipButton).toBeEnabled();
        console.log('🚀 Confirming skip identity verification')
        await confirmSkipButton.click();
        await expect(skipModal).not.toBeVisible();
        const backgroundScreeningStep = page.getByTestId('background-screening-step');
        await expect(backgroundScreeningStep).toBeVisible({ timeout: 10_000 });
        console.log('✅ On Background Screening page')


        /**
         * First Submission:
         * - Fill all required fields with valid data (same as Test 1)
         * - Check ToS/FCRA, sign, and submit (data-testid="background-screening-continue-btn")
         * - Verification:
         *    - Form submission succeeds (no error displayed)
         *    - Background record is created successfully
         * - API Verification: Intercept POST /sessions/{sessionId}/steps/{stepId}/backgrounds
         *    - Verify request is made with valid payload
         *    - Verify response status is 201 (Created)
         *    - Verify background record is created
         */

        await backgroundScreeningStep.getByTestId('first-name-input').fill(user.first_name);
        await backgroundScreeningStep.getByTestId('last-name-input').fill(user.last_name);
        await backgroundScreeningStep.getByTestId('middle-name-input').fill('M');
        const ssnInput = backgroundScreeningStep.getByTestId('ssn-input');
        await ssnInput.fill('123456789');
        // check attribute type is password
        await expect(ssnInput).toHaveAttribute('type', 'password');
        const { dd, mm, yyyy } = getDateYearsAgo(30);
        await backgroundScreeningStep.getByTestId('date-of-birth-input').pressSequentially(`${mm}/${dd}/${yyyy}`);
        await backgroundScreeningStep.getByTestId('address-line-1-input').fill('123 Main St');
        await backgroundScreeningStep.getByTestId('city-input').fill('Anytown');
        await backgroundScreeningStep.getByTestId('postal-code-input').fill('12345');
        await fillMultiselect(page, backgroundScreeningStep.getByTestId('country-select'), ['US']);
        await expect(backgroundScreeningStep.getByTestId('state-select')).toBeEnabled();
        await fillMultiselect(page, backgroundScreeningStep.getByTestId('state-select'), ['ALASKA']);
        await backgroundScreeningStep.getByTestId('terms-agreement-checkbox').check();
        await backgroundScreeningStep.getByTestId('fcra-rights-checkbox').check();
        // Draw signature
        const signaturePad = backgroundScreeningStep.getByTestId('background-signature-pad');
        const box = await signaturePad.boundingBox();
        if (box) {
            const { x, y, width, height } = box;
            await page.mouse.move(x + width / 4, y + height / 2);
            await page.mouse.down();
            await page.mouse.move(x + (width * 3) / 4, y + (height / 4));
            await page.mouse.move(x + (width * 3) / 4, y + (height * 3) / 4);
            await page.mouse.move(x + width / 4, y + (height * 3) / 4);
            await page.mouse.move(x + width / 4, y + height / 2);
            await page.mouse.up();
        } else {
            throw new Error('Signature pad bounding box not found');
        }

        steps = await getStepsFromSession(test3session);

        const backgroundStep = steps.find(step => step.step?.task?.key === 'BACKGROUND_CHECK');
        expect(backgroundStep).toBeDefined();

        const backgroundSubmitResponsePromise = page.waitForResponse(resp => {
            const url = `/sessions/${test3session.id}/steps/${backgroundStep.id}/backgrounds`;
            return resp.url().includes(url) && resp.request().method() === 'POST' && resp.ok();
        });

        const backgroundCompleteResponsePromise = page.waitForResponse(resp => {
            const url = `/sessions/${test3session.id}/steps/${backgroundStep.id}`;
            return resp.url().includes(url) && resp.request().method() === 'PATCH' && resp.ok();
        });

        // on click dialog opens and cancel dialog appears, so we need to handle that
        page.once('dialog', async dialog => {
            await dialog.dismiss();
        });
        await backgroundScreeningStep.getByTestId('background-screening-continue-btn').click();

        const backgroundSubmitResponse = await backgroundSubmitResponsePromise;
        await backgroundCompleteResponsePromise;
        expect(backgroundSubmitResponse.status()).toBe(201);
        console.log('✅ First background screening submission successful')

        const summaryStep = page.getByTestId('summary-step');
        await expect(summaryStep).toBeVisible({ timeout: 10_000 });
        console.log('✅ On Summary page after first submission')

        const backgroundStepTile = page.getByTestId('step-BACKGROUND_CHECK-lg').filter({ visible: true });
        await expect(backgroundStepTile).toBeVisible();
        await page.waitForTimeout(1_000); // wait for animation
        await backgroundStepTile.click()

        //come back in background check step and check for detail are prefilled and visible and input type is readonly
        await expect(backgroundScreeningStep).toBeVisible({ timeout: 10_000 });
        await expect(backgroundScreeningStep.getByTestId('first-name-input')).toHaveValue(user.first_name);
        await expect(backgroundScreeningStep.getByTestId('last-name-input')).toHaveValue(user.last_name);
        await expect(backgroundScreeningStep.getByTestId('middle-name-input')).toHaveValue('M');
        await expect(backgroundScreeningStep.getByTestId('date-of-birth-input')).toHaveValue(`${mm}-${dd}-${yyyy}`);
        await expect(backgroundScreeningStep.getByTestId('address-line-1-input')).toHaveValue('123 Main St');
        await expect(backgroundScreeningStep.getByTestId('city-input')).toHaveValue('Anytown');
        await expect(backgroundScreeningStep.getByTestId('postal-code-input')).toHaveValue('12345');
        await expect(backgroundScreeningStep.getByTestId('country-select').getByTestId('country-select-single-value')).toHaveText('US');
        await expect(backgroundScreeningStep.getByTestId('state-select').getByTestId('state-select-single-value')).toHaveText('ALASKA');
        // check has readonly attribute
        await expect(backgroundScreeningStep.getByTestId('first-name-input')).toHaveAttribute('readonly', '');
        await expect(backgroundScreeningStep.getByTestId('last-name-input')).toHaveAttribute('readonly', '');
        await expect(backgroundScreeningStep.getByTestId('middle-name-input')).toHaveAttribute('readonly', '');
        await expect(backgroundScreeningStep.getByTestId('date-of-birth-input')).toHaveAttribute('readonly', '');
        await expect(backgroundScreeningStep.getByTestId('address-line-1-input')).toHaveAttribute('readonly', '');
        await expect(backgroundScreeningStep.getByTestId('city-input')).toHaveAttribute('readonly', '');
        await expect(backgroundScreeningStep.getByTestId('postal-code-input')).toHaveAttribute('readonly', '');
        // check country and state select has this 2 classes 'multiselect--disabled opacity-40 pointer-events-none'
        await expect(backgroundScreeningStep.getByTestId('country-select')).toHaveClass(/multiselect--disabled/);
        await expect(backgroundScreeningStep.getByTestId('country-select')).toHaveClass(/opacity-40/);
        await expect(backgroundScreeningStep.getByTestId('country-select')).toHaveClass(/pointer-events-none/);
        await expect(backgroundScreeningStep.getByTestId('state-select')).toHaveClass(/multiselect--disabled/);
        await expect(backgroundScreeningStep.getByTestId('state-select')).toHaveClass(/opacity-40/);
        await expect(backgroundScreeningStep.getByTestId('state-select')).toHaveClass(/pointer-events-none/);
        testResults.test3.passed = true;
    })





    test.afterAll(async () => {
        // if started and failed, do not delete session for debugging else delete created session
        for (const [testKey, result] of Object.entries(testResults)) {
            if (result.started && !result.passed) {
                console.log(`⚠️ ${testKey} failed - preserving session ID: ${result.sessionId} for debugging.`);
            } else {
                if (result.sessionId) {
                    await sessionApi.delete(result.sessionId);
                    console.log(`🗑️ Deleted session ID: ${result.sessionId}`);
                }
            }
        }
    })



});

async function getStepsFromSession(session) {
    const sessionStepResponse = await adminClient.get(`/sessions/${session.id}/steps`);
    const steps = sessionStepResponse.data.data;
    return steps;
}


function getDateYearsAgo(years) {
    const date = new Date();
    date.setFullYear(date.getFullYear() - years);
    return {
        mm: String(date.getMonth() + 1).padStart(2, '0'),
        dd: String(date.getDate()).padStart(2, '0'),
        yyyy: date.getFullYear()
    };
}