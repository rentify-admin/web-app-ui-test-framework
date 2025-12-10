import { expect, test } from '@playwright/test'
import { ApiClient } from './api'
import { app } from './test_config'
import { loginWithAdmin } from './endpoint-utils/auth-helper'
import { getApplicationByName } from './endpoint-utils/application-helper'
import { completeApplicantForm, identityStep, setupInviteLinkSession } from './utils/session-flow'
import { getRandomEmail } from './utils/helper'
import { cleanupSession } from './utils/cleanup-helper'
import { waitForJsonResponse } from './utils/wait-response'

test.describe('QA-254 identity_button_connection_persistence_after_close_persona_modal.spec', () => {

    const adminClient = new ApiClient(app.urls.api, null, 20_000)

    const APPLICATION_NAME = 'AutoTest Suite - ID Only'

    let createdSession = null;
    test.beforeAll(async () => {

        await loginWithAdmin(adminClient)

        const application = await getApplicationByName(adminClient, APPLICATION_NAME);

        const user = {
            first_name: "Autotest",
            last_user: 'user',
            email: getRandomEmail()
        }

        const sessionResp = await adminClient.post('/sessions', {
            ...user,
            application: application.id,
            invite: true
        })
        createdSession = sessionResp.data.data;
        console.log('createdSession.url ~ ', createdSession.url)
    })

    test('Verify Identity Modal State Persistence After Close/Reopen (VC-730)', {
        timeout: 200_000,
        tag: ['@regression', '@core']
    }, async ({ page }) => {
        test.setTimeout(200_000)

        createdSession.url = createdSession.url.replace('https://dev.verifast.app/', 'https://rentify-v2.test/')
        await page.goto(createdSession.url);

        await setupInviteLinkSession(page, {
            sessionUrl: createdSession.url
        });

        const stepWait = page.waitForResponse(resp => resp.url().includes(`/sessions/${createdSession.id}/steps`)
            && resp.ok()
            && resp.request().method() === 'POST'
        )

        await completeApplicantForm(page, '555', createdSession.id);

        await stepWait

        const idStep = page.getByTestId('identify-step')
        await expect(idStep).toBeVisible()

        const connectBtn = idStep.getByTestId('start-id-verification');
        await expect(connectBtn).toBeVisible();

        let identityVerifications = [];

        await connectBtn.click();

        const responseVerification = async response => {
            if (response.url().includes(`/identity-verifications?fields[identity]`)
                && response.ok()
                && response.request().method() === 'GET') {
                const { data: verifications } = await waitForJsonResponse(response);
                identityVerifications = verifications;
            }
        }

        page.on('response', responseVerification)

        const personaIFrame = page.frameLocator('iframe[src*="withpersona.com"]');
        await personaIFrame.locator('[data-test="button__basic"]').click({ timeout: 20_000 });

        await personaIFrame.locator('[data-test="button__primary"]').click({ timeout: 20_000 });
        await page.waitForTimeout(1000);
        await personaIFrame.locator('[data-test="button__primary"]').click({ timeout: 20_000 });

        await personaIFrame.locator('#select__option--pp').click({ timeout: 20_000 });
        await page.waitForTimeout(1000)
        await personaIFrame.locator('[data-test="navbar__close-link"]').click({ timeout: 20_000 });
        await personaIFrame.locator('[data-test="confirm-exit-dialog__button--close"]').click({ timeout: 20_000 });

        // Verify Persona iframe is detached (confirm modal fully closed)
        await expect(page.locator('iframe[src*="withpersona.com"]')).not.toBeAttached({ timeout: 10_000 });
        await idStep.click()
        await page.waitForTimeout(10000);
        await expect(identityVerifications.length).toBeGreaterThan(0)

        const [verification] = identityVerifications;

        const statusTile = page.getByTestId(`identity-status-${verification.id}`)
        await expect(statusTile).toBeVisible();

        await expect(statusTile.getByTestId('verification-status')).toHaveText('Incomplete')

        const connectAgainBtn = idStep.getByTestId('identity-connect-again');
        await expect(connectAgainBtn).toBeVisible();

        await expect(connectAgainBtn).toBeEnabled();
        await page.waitForTimeout(3000);
        await expect(connectAgainBtn).toBeEnabled();

        // Completing identity step
        await identityStep(page, 'identity-connect-again');

        const summaryStep = page.getByTestId('summary-step')
        await expect(summaryStep).toBeVisible({ timeout: 30_000 })

        await page.getByTestId('step-IDENTITY_VERIFICATION-lg').filter({ visible: true }).click()

        await expect(identityVerifications.length).toBe(2);

        const completedVerification = identityVerifications.find(id => ['APPROVED', 'COMPLETED'].includes(id.status))

        const completeStatusDiv = page.getByTestId(`identity-status-${completedVerification.id}`);
        await expect(completeStatusDiv).toBeVisible();

        await expect(completeStatusDiv.getByTestId('verification-status')).toHaveText('Completed')

        await expect(connectAgainBtn).not.toBeVisible();
        await expect(connectBtn).not.toBeVisible();

    })

    test.afterAll(async ({ request }) => {
        await cleanupSession(request, createdSession.id)
    })
})