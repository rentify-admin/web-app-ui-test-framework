import { expect, test } from '@playwright/test'
import { ApiClient } from './api'
import { app } from './test_config'
import { loginWithAdmin } from './endpoint-utils/auth-helper'
import { getApplicationByName } from './endpoint-utils/application-helper'
import { completeApplicantForm, identityStep, setupInviteLinkSession } from './utils/session-flow'
import { getRandomEmail, joinUrl } from './utils/helper'
import { cleanupSession } from './utils/cleanup-helper'
import { waitForJsonResponse } from './utils/wait-response'

test.describe('QA-254 identity_button_connection_persistence_after_close_persona_modal.spec', () => {

    const adminClient = new ApiClient(app.urls.api, null, 20_000)

    const APPLICATION_NAME = 'AutoTest Suite - ID Only'

    let createdSession = null;
    test.beforeAll(async () => {
        console.log('🔑 Logging in as admin...')
        await loginWithAdmin(adminClient)

        console.log('🔎 Fetching application by name:', APPLICATION_NAME)
        const application = await getApplicationByName(adminClient, APPLICATION_NAME);

        const user = {
            first_name: "Autotest",
            last_name: 'user',
            email: getRandomEmail()
        }

        console.log('✉️  Creating session for user:', user.email)
        const sessionResp = await adminClient.post('/sessions', {
            ...user,
            application: application.id,
            invite: true
        })
        createdSession = sessionResp.data.data;
        console.log('🆕 Created session URL:', createdSession.url)
    })

    test('Verify Identity Modal State Persistence After Close/Reopen (VC-730)', {
        timeout: 200_000,
        tag: ['@need-review']
    }, async ({ page }) => {
        test.setTimeout(200_000)

        // Step 1
        console.log('🚪 Navigating to invite session URL...')
        // Reconstruct URL using configured app URL to support multi-environment (dev/staging/rc)
        const linkUrl = new URL(createdSession.url);
        const gotoUrl = joinUrl(app.urls.app, `${linkUrl.pathname}${linkUrl.search}`);
        console.log('🌐 Using app URL:', gotoUrl);
        await page.goto(gotoUrl);

        // Step 2
        console.log('⚙️  Setting up invite link session...')
        await setupInviteLinkSession(page, {
            sessionUrl: gotoUrl
        });

        // Step 3
        console.log('📝 Waiting for applicant step POST...')
        const stepWait = page.waitForResponse(resp => resp.url().includes(`/sessions/${createdSession.id}/steps`)
            && resp.ok()
            && resp.request().method() === 'POST'
        )

        // Step 4
        console.log('💰 Completing applicant form...')
        await completeApplicantForm(page, '555', createdSession.id);

        await stepWait
        console.log('✅ Application step POST completed')

        // Step 5
        const idStep = page.getByTestId('identify-step')
        console.log('🕵️ Checking for identify step...')
        await expect(idStep).toBeVisible()

        const connectBtn = idStep.getByTestId('start-id-verification');
        console.log('🔗 Checking for Connect button visibility...')
        await expect(connectBtn).toBeVisible();

        let identityVerifications = [];

        // Step 6
        console.log('🖱️ Clicking Connect button to launch Persona modal...')
        await connectBtn.click();

        const responseVerification = async response => {
            if (response.url().includes(`/identity-verifications?fields[identity]`)
                && response.ok()
                && response.request().method() === 'GET') {
                const { data: verifications } = await waitForJsonResponse(response);
                identityVerifications = verifications;
                console.log(`📄 [API] identity-verifications updated. Count: ${verifications.length}`)
            }
        }

        page.on('response', responseVerification)

        // Step 7 - Persona Modal Interactions
        const personaIFrame = page.frameLocator('iframe[src*="withpersona.com"]');
        console.log('👤 [Persona] Clicking button__basic...')
        await personaIFrame.locator('[data-test="button__basic"]').click({ timeout: 20_000 });

        console.log('👤 [Persona] Clicking button__primary (document selection)...')
        await personaIFrame.locator('[data-test="button__primary"]').click({ timeout: 20_000 });
        await page.waitForTimeout(1000);
        console.log('👤 [Persona] Clicking button__primary (proceed)...')
        await personaIFrame.locator('[data-test="button__primary"]').click({ timeout: 20_000 });

        // Select passport
        console.log('👤 [Persona] Selecting Passport as the ID...')
        await personaIFrame.locator('#select__option--pp').click({ timeout: 20_000 });
        await page.waitForTimeout(1000)

        // Attempt closing Persona modal
        console.log('❌ [Persona] Closing Persona modal...')
        await personaIFrame.locator('[data-test="navbar__close-link"]').click({ timeout: 20_000 });
        await personaIFrame.locator('[data-test="confirm-exit-dialog__button--close"]').click({ timeout: 20_000 });

        // Step 8 - Ensure modal is closed
        console.log('🔍 Verifying Persona iframe is detached...')
        await expect(page.locator('iframe[src*="withpersona.com"]')).not.toBeAttached({ timeout: 10_000 });

        // Try to bring identity modal back
        console.log('👆 Clicking identity step to reopen modal...')
        await idStep.click()
        await page.waitForTimeout(10000);

        // Step 9
        console.log('📦 Verifying at least one identity verification record exists...')
        await expect(identityVerifications.length).toBeGreaterThan(0)

        const [verification] = identityVerifications;

        const statusTile = page.getByTestId(`identity-status-${verification.id}`)
        console.log(`🟩 Checking status for verification "${verification.id}" (should be Incomplete)...`)
        await expect(statusTile).toBeVisible();

        await expect(statusTile.getByTestId('verification-status')).toHaveText('Incomplete')

        // Step 10
        const connectAgainBtn = idStep.getByTestId('identity-connect-again');
        console.log('🔁 Checking "Connect Again" button visibility and enabled...')
        await expect(connectAgainBtn).toBeVisible();

        await expect(connectAgainBtn).toBeEnabled();
        console.log('⏳ Waiting 3 seconds to check button stays enabled...')
        await page.waitForTimeout(3000);
        await expect(connectAgainBtn).toBeEnabled();

        // Step 11
        console.log('🚀 Completing identity step again via "Connect Again"...')
        await identityStep(page, 'identity-connect-again');

        // Step 12
        const summaryStep = page.getByTestId('summary-step')
        console.log('📑 Waiting for summary step to be visible...')
        await expect(summaryStep).toBeVisible({ timeout: 30_000 })

        // Open the details through sidebar navigation
        console.log('📝 Opening identity step summary again...')
        await page.getByTestId('step-IDENTITY_VERIFICATION-lg').filter({ visible: true }).click()

        console.log('🔎 Verifying that 2 identity verifications exist...')
        await expect(identityVerifications.length).toBe(2);

        const completedVerification = identityVerifications.find(id => ['APPROVED', 'COMPLETED'].includes(id.status))
        console.log('🏆 Checking for completed/approved verification!')

        const completeStatusDiv = page.getByTestId(`identity-status-${completedVerification.id}`);
        await expect(completeStatusDiv).toBeVisible();

        await expect(completeStatusDiv.getByTestId('verification-status')).toHaveText('Completed')

        // Button status checks
        console.log('🙈 Verifying that both Connect Again and Connect buttons are hidden after completion...')
        await expect(connectAgainBtn).not.toBeVisible();
        await expect(connectBtn).not.toBeVisible();

        console.log('🎉 ID modal persistence and connection test PASSED!')

    })

    test.afterAll(async ({ request }, testInfo) => {
        if (testInfo.status === 'passed') {
            console.log('🧹 Cleaning up the created session...')
            await cleanupSession(request, createdSession.id)
        } else {
            console.log('❌ Keeping session as test case is failed')
        }
    })
})