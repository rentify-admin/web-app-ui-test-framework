import { expect, test } from '@playwright/test';
import { ApiClient, SessionApi } from '../api';
import { app } from '../test_config';
import BaseApi from '../api/base-api';
import { loginWithAdmin } from '../endpoint-utils/auth-helper';
import { handleOptionalTermsCheckbox, handleSkipReasonModal, updateRentBudget } from '../utils/session-flow';
import { fillMultiselect } from '../utils/common';


const adminClient = new ApiClient(app.urls.api, null, 120_000);
const applicationApi = new BaseApi(adminClient, '/applications');
const sessionApi = new SessionApi(adminClient);

test.describe('QA-323 background-screening-validation-errors.spec', () => {

    test.setTimeout(150_000)

    const APPLICATION_NAME = 'AutoTest - ID and Background';

    const user = {
        first_name: 'AutoTest',
        last_name: 'Background',
        email: `autotest.background.validation${Date.now()}@verifast.com`,
        invite: true
    }

    let session = null;

    const testResults = {
        test1: { sessionId: null, passed: false }
    }

    test.beforeAll(async () => {

        await loginWithAdmin(adminClient);

        const application = await applicationApi.getByName(APPLICATION_NAME, {
            'fields[application]': ':all'
        });
        await expect(application).toBeDefined();

        user.application = application.id;

        const workflowSteps = application.workflow?.steps
        expect(workflowSteps).toBeDefined();
        const backgroundCheckStep = workflowSteps.find(step => step.task?.key === 'BACKGROUND_CHECK');
        expect(backgroundCheckStep).toBeDefined();
        expect(backgroundCheckStep.task?.settings).toBeDefined();
        expect(Array.isArray(backgroundCheckStep.task.settings)).toBe(true);
        const setting = backgroundCheckStep.task.settings.find(setting => setting.key === 'settings.workflows.tasks.background_check.enable_credit')
        expect(setting).toBeDefined();
        expect(setting.value).toBe(false);

        const sessionData = await sessionApi.create(user);
        expect(sessionData).toBeDefined();

        session = sessionData.data;
        testResults.test1.sessionId = session.id;

    })

    test('QA-323 Verify background screening validation error when credit check is disabled', async ({ page }) => {

        await page.goto(session.url.replace('https://dev.verifast.app', app.urls.app));

        // Handle optional terms modal/checkbox (no applicant type in this flow)
        await handleOptionalTermsCheckbox(page);

        await expect(page.getByTestId('rent-budget-step')).toBeVisible();
        console.log('On Rent Budget page');

        console.log('Filing rent budget');
        await updateRentBudget(page, session.id, '600');

        const identitystep = page.getByTestId('identify-step');
        await expect(identitystep).toBeVisible({ timeout: 10_000 });
        console.log('On Identity verification page');

        const skipButton = page.getByTestId('id-simulation-skip-btn');
        await expect(skipButton).toBeVisible();
        console.log('Clicking skip button on identity verification page');
        await skipButton.click();

        await handleSkipReasonModal(page, 'Automation test - skipping identity verification');

        const backgroundScreeningStep = page.getByTestId('background-screening-step');
        await expect(backgroundScreeningStep).toBeVisible({ timeout: 10_000 });
        console.log('On Background Screening page');

        let steps = await getStepsFromSession(session);

        const backgroundStep = steps.find(step => step.step?.task?.key === 'BACKGROUND_CHECK');
        expect(backgroundStep).toBeDefined();


        // Validating validation errors when only first name is blank
        console.log('Clearing all fields to trigger validation errors');
        await fillBackgroundScreeningForm(page, backgroundScreeningStep, {
            first_name: '',
            last_name: ''
        });

        // starting first name error validation
        /**
         * Click submit when first name is blank
         * Expect validation error for first name
         * Expect toast error to be visible
         * fill first name and leave all other fields blank
         * Click submit
         * Expect validation error for first name to be gone
         * Expect toast error to be visible
         */

        const submitButton = backgroundScreeningStep.getByTestId('background-screening-continue-btn');

        const backgroundSubmitResponsePromise = page.waitForResponse(resp => {
            const url = `/sessions/${session.id}/steps/${backgroundStep.id}/backgrounds`;
            return resp.url().includes(url) && resp.request().method() === 'POST' && resp.ok();
        }, { timeout: 10_000 });

        const backgroundCompleteResponsePromise = page.waitForResponse(resp => {
            const url = `/sessions/${session.id}/steps/${backgroundStep.id}`;
            return resp.url().includes(url) && resp.request().method() === 'PATCH' && resp.ok();
        }, { timeout: 10_000 });
        page.once('dialog', async dialog => {
            await dialog.dismiss();
        });
        await submitButton.click();
        const errorToast = page.getByTestId('background-screening-validation-error-toast');
        await expect(errorToast).toBeVisible();
        await expect(backgroundSubmitResponsePromise).rejects.toThrow();
        await expect(backgroundCompleteResponsePromise).rejects.toThrow();

        console.log('Validating first name field error');
        await validateFieldError(page, backgroundScreeningStep, session, steps, 'first-name-input', 'first_name', user.first_name);

        // starting last name error validation
        console.log('Validating last name field error');
        await validateFieldError(page, backgroundScreeningStep, session, steps, 'last-name-input', 'last_name', user.last_name);

        console.log('Validating date of birth field error');
        await validateFieldError(page, backgroundScreeningStep, session, steps, 'date-of-birth-input', 'dobYearsAgo', 25);

        console.log('Validating signature field error');
        await validateFieldError(page, backgroundScreeningStep, session, steps, 'background-signature-pad', 'signature', true);

        console.log('Validating address line 1 field error');
        await validateFieldError(page, backgroundScreeningStep, session, steps, 'address-line-1-input', 'addressLine1', '123 Main St');

        console.log('Validating state field error');
        await validateFieldError(page, backgroundScreeningStep, session, steps, 'middle-name-input', 'middle_name', 'Test Middle');


        // fill all fields except first name to continue first name validation
        console.log('Filling all fields except first name to continue first name validation');
        await fillBackgroundScreeningForm(page, backgroundScreeningStep, {
            last_name: user.last_name,
            middle_name: 'Test Middle',
            dobYearsAgo: 25,
            addressLine1: '123 Main St',
            city: 'Springfield',
            postalCode: '12345',
            state: ['ALASKA'],
            ssn: '123456789',
            terms: true,
            fcra: true
        });

        console.log('Continuing first name field error validations');
        await validateFieldError(page, backgroundScreeningStep, session, steps, 'first-name-input', 'first_name', 'A', { validateApiError: true, checkInitialErrorPresent: false, hidesError: false }); // string less than 2 characters

        // string more than 64 characters
        console.log('Validating first name field with more than 64 characters');
        await validateFieldError(page, backgroundScreeningStep, session, steps, 'first-name-input', 'first_name', 'AbcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', { validateApiError: true, checkInitialErrorPresent: false, hidesError: false });
        console.log('Filling valid first name to proceed with other field validations');
        await fillBackgroundScreeningForm(page, backgroundScreeningStep, {
            first_name: user.first_name
        })

        // Test invalid SSN
        console.log('Validating SSN field errors');
        await validateFieldError(page, backgroundScreeningStep, session, steps, 'ssn-input', 'ssn', 'US', { checkInitialErrorPresent: false, hidesError: false });

        console.log('Filling SSN field with valid data');
        await fillBackgroundScreeningForm(page, backgroundScreeningStep, {
            ssn: '123456789'
        })
        // Test invalid postal code
        console.log('Validating postal code field errors');
        await validateFieldError(page, backgroundScreeningStep, session, steps, 'postal-code-input', 'postalCode', 'US', { checkInitialErrorPresent: false, hidesError: false });

        console.log('Filling postal code field with valid data');
        await fillBackgroundScreeningForm(page, backgroundScreeningStep, {
            postalCode: '12345'
        })

        console.log('Validating city field errors');
        await validateFieldError(page, backgroundScreeningStep, session, steps, 'city-input', 'city', 'Springfield', { checkInitialErrorPresent: false, resolves: true });

        // Finally, fill all fields correctly and submit
        console.log('Filling all fields correctly to complete background screening step');

        testResults.test1.passed = true;

    })

    test.afterAll(async () => {
        // Cleanup created session
        /** delete session when test case is passed */
        for (const testKey in testResults) {
            const result = testResults[testKey];
            if (result.passed && result.sessionId) {
                console.log(`Deleting session ${result.sessionId} for ${testKey}`);
                await sessionApi.delete(result.sessionId);
                console.log(`Session ${result.sessionId} deleted`);
            }
        }
    })

})

async function validateFieldError(page, backgroundScreeningStep, session, steps, fieldTestId, fieldName, fieldValue, { resolves = false, validateApiError = false, checkInitialErrorPresent = true, hidesError = true } = {}) {
    page.once('dialog', async dialog => {
        await dialog.dismiss();
    });
    const errorToast = page.getByTestId('background-screening-validation-error-toast');
    const fieldError = backgroundScreeningStep.getByTestId(`${fieldTestId}-error`);
    if (checkInitialErrorPresent) {
        await expect(fieldError).toBeVisible();
    }
    await expect(errorToast).toBeHidden({ timeout: 10000 });

    await fillBackgroundScreeningForm(page, backgroundScreeningStep, {
        [fieldName]: fieldValue
    });

    await page.waitForTimeout(500); // Small wait for toast to hide

    if (fieldTestId !== 'background-signature-pad') {
        await page.getByTestId(fieldTestId).scrollIntoViewIfNeeded({ timeout: 5000 });
    }
    const backgroundStep = steps.find(step => step.step?.task?.key === 'BACKGROUND_CHECK');
    expect(backgroundStep).toBeDefined();
    const submitButton = backgroundScreeningStep.getByTestId('background-screening-continue-btn');

    if (!validateApiError) {
        if (!resolves) {
            
            const backgroundSubmitResponsePromise = page.waitForResponse(resp => {
                const url = `/sessions/${session.id}/steps/${backgroundStep.id}/backgrounds`;
                return resp.url().includes(url) && resp.request().method() === 'POST';
            }, { timeout: 3000 });

            const backgroundCompleteResponsePromise = page.waitForResponse(resp => {
                const url = `/sessions/${session.id}/steps/${backgroundStep.id}`;
                return resp.url().includes(url) && resp.request().method() === 'PATCH';
            }, { timeout: 3000 });
            await submitButton.click();
            await expect(backgroundSubmitResponsePromise).rejects.toThrow();
            await expect(backgroundCompleteResponsePromise).rejects.toThrow();
            await expect(errorToast).toBeVisible();
        } else {
            const backgroundSubmitResponsePromise = page.waitForResponse(resp => {
                const url = `/sessions/${session.id}/steps/${backgroundStep.id}/backgrounds`;
                return resp.url().includes(url) && resp.request().method() === 'POST';
            }, { timeout: 10000 });

            const backgroundCompleteResponsePromise = page.waitForResponse(resp => {
                const url = `/sessions/${session.id}/steps/${backgroundStep.id}`;
                return resp.url().includes(url) && resp.request().method() === 'PATCH';
            }, { timeout: 10000 });
            await submitButton.click();
            await backgroundSubmitResponsePromise;
            await backgroundCompleteResponsePromise;
        }
    } else {
        const backgroundSubmitResponsePromise = page.waitForResponse(resp => {
            const url = `/sessions/${session.id}/steps/${backgroundStep.id}/backgrounds`;
            return resp.url().includes(url) && resp.request().method() === 'POST';
        }, { timeout: 10000 });
        await submitButton.click();
        const response = await backgroundSubmitResponsePromise;
        // Verify response status is 422
        //  Verify response contains error.cause.meta.postal_code with validation error
        expect(response.status()).toBe(422);
        const responseBody = await response.json();
        expect(responseBody.error).toBeDefined();
        // error.data.error.meta.first_name should be defined
        expect(responseBody.error).toBeDefined();
        expect(responseBody.error.meta).toBeDefined();
        expect(responseBody.error.meta[fieldName]).toBeDefined();

    }
    if (fieldTestId !== 'background-signature-pad') {
        await page.getByTestId(fieldTestId).scrollIntoViewIfNeeded({ timeout: 5000 });
    }
    if (hidesError) {
        await expect(fieldError).toBeHidden();
    }else{
        await expect(fieldError).toBeVisible();
    }

    await expect(errorToast).toBeHidden({ timeout: 10000 });
}


async function fillBackgroundScreeningForm(page, stepLocator, data = {}) {
    if (typeof data.first_name !== 'undefined') await stepLocator.getByTestId('first-name-input').fill(data.first_name);
    if (typeof data.last_name !== 'undefined') await stepLocator.getByTestId('last-name-input').fill(data.last_name);

    if (typeof data.middle_name !== 'undefined') {
        // either fill middle name or leave unchecked if empty
        await stepLocator.getByTestId('middle-name-input').fill(data.middle_name);
    }

    if (typeof data.ssn !== 'undefined') {
        const ssnInput = stepLocator.getByTestId('ssn-input');
        await ssnInput.fill(data.ssn);
        await expect(ssnInput).toHaveAttribute('type', 'password');
    }

    if (typeof data.dob !== 'undefined') {
        await stepLocator.getByTestId('date-of-birth-input').pressSequentially(data.dob);
    } else if (typeof data.dobYearsAgo !== 'undefined') {
        const { dd, mm, yyyy } = getDateYearsAgo(data.dobYearsAgo);
        await stepLocator.getByTestId('date-of-birth-input').pressSequentially(`${mm}/${dd}/${yyyy}`);
    }

    if (typeof data.addressLine1 !== 'undefined') await stepLocator.getByTestId('address-line-1-input').fill(data.addressLine1);
    if (typeof data.city !== 'undefined') await stepLocator.getByTestId('city-input').fill(data.city);
    if (typeof data.postalCode !== 'undefined') await stepLocator.getByTestId('postal-code-input').fill(data.postalCode);

    if (typeof data.country !== 'undefined') {
        await fillMultiselect(page, stepLocator.getByTestId('country-select'), data.country);
    }
    if (typeof data.state !== 'undefined') {
        await expect(stepLocator.getByTestId('state-select')).toBeEnabled();
        await fillMultiselect(page, stepLocator.getByTestId('state-select'), data.state);
    }

    if (typeof data.terms !== 'undefined') await stepLocator.getByTestId('terms-agreement-checkbox').check();
    if (typeof data.fcra !== 'undefined') await stepLocator.getByTestId('fcra-rights-checkbox').check();

    if (typeof data.signature !== 'undefined') {
        const signaturePad = stepLocator.getByTestId('background-signature-pad');
        await signaturePad.scrollIntoViewIfNeeded();
        let box = await signaturePad.boundingBox();
        if (!box) {
            const handle = await signaturePad.elementHandle();
            if (handle) {
                box = await handle.boundingBox();
            }
        }
        if (box) {
            const { x, y, width, height } = box;
            const startX = x + width / 4;
            const startY = y + height / 2;
            // focus the canvas and draw with small delays and steps so the canvas captures the stroke
            await page.mouse.move(startX, startY);
            await page.mouse.down();
            await page.waitForTimeout(50);
            await page.mouse.move(x + (width * 3) / 4, y + (height / 4), { steps: 10 });
            await page.waitForTimeout(30);
            await page.mouse.move(x + (width * 3) / 4, y + (height * 3) / 4, { steps: 10 });
            await page.waitForTimeout(30);
            await page.mouse.move(x + width / 4, y + (height * 3) / 4, { steps: 10 });
            await page.waitForTimeout(30);
            await page.mouse.move(startX, startY, { steps: 10 });
            await page.waitForTimeout(50);
            await page.mouse.up();
        } else {
            throw new Error('Signature pad bounding box not found');
        }
    }
}


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
