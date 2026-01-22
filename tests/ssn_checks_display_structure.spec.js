import { expect, test } from "@playwright/test";
import { loginWith } from "./utils/session-utils";
import { admin, app, session as sessionConf } from "./test_config";
import { ApiClient, ApplicantApi, GuestApi, ProviderApi, SessionApi } from "./api";
import { loginWithAdmin } from "./endpoint-utils/auth-helper";
import { createCurrentStep, loginWithGuestUser, simulateVerification, waitForStepTransition } from "./endpoint-utils/session-helpers";
import { openReportSection } from "./utils/report-page";
import { identityPersonaWithSSNPayload } from "./test_files/mock_data/identity-persona-simulation-payload";

const { STEP_KEYS } = sessionConf;

const adminClient = new ApiClient(app.urls.api, null, 120_000);
const guestClient = new ApiClient(app.urls.api, null, 120_000);
const guestApi = new GuestApi(guestClient)
const sessionApi = new SessionApi(guestClient)
const providerApi = new ProviderApi(guestClient)
const applicantApi = new ApplicantApi(guestClient)

async function refreshSession(guestClient, session) {
    const sessionResponse = await guestClient.get(`/sessions/${session.id}`)
    const refreshedSession = sessionResponse?.data?.data;
    expect(refreshedSession).toBeDefined()
    return refreshedSession
}

async function completeSessionStep(guestClient, session, user) {
    if (session.state.current_step.type === 'START') {
        // create step 
        const step = await createCurrentStep(sessionApi, session)
        expect(step).toBeDefined()
        await guestClient.patch(`/sessions/${session.id}`, { target: 500 })
        await guestClient.patch(`/sessions/${session.id}/steps/${step.id}`, { status: 'COMPLETED' })
        session = await waitForStepTransition(sessionApi, session, STEP_KEYS.START);

    } else if (session.state.current_step.type === 'TASK' && session.state.current_step.task.key === 'IDENTITY_VERIFICATION') {
        const step = await createCurrentStep(sessionApi, session)
        expect(step).toBeDefined()
        const provider = await providerApi.getByName('Simulation')

        const identitySimulationData = {
            simulation_type: 'PERSONA_PAYLOAD',
            custom_payload: identityPersonaWithSSNPayload({
                ...user,
                age: 30
            })
        }
        await simulateVerification(guestClient, '/identity-verifications', provider, step, identitySimulationData, 'Identity')

        const stepUpdateData = { status: "COMPLETED" };
        await sessionApi.step(session.id).update(step.id, stepUpdateData);
        console.log(`✅ ${STEP_KEYS.IDENTITY} step completed.`);
        session = await waitForStepTransition(sessionApi, session, STEP_KEYS.IDENTITY);
        console.log(`✅ Session transitioned from ${STEP_KEYS.IDENTITY} step.`);
    }
}

test.describe('QA-308 ssn_checks_display_structure.spec', () => {

    const APPLICATION_NAME = 'Autotest - SSN Simulation Test'

    let session = null;

    test.beforeAll(async () => {
        await loginWithAdmin(adminClient)

        const applicationResponse = await adminClient.get('/applications', {
            params: {
                filters: JSON.stringify({
                    name: APPLICATION_NAME
                })
            }
        })
        const applications = applicationResponse?.data?.data;
        expect(applications).toBeDefined()
        expect(Array.isArray(applications)).toBeTruthy()
        const application = applications.find(app => app.name === APPLICATION_NAME)
        expect(application).toBeDefined()

        // creating session 
        const user = {
            application: application.id,
            first_name: 'Test',
            last_name: 'SSNModal',
            email: 'testuserssn@verifast.com',
            invite: true
        }

        const sessionData = await adminClient.post('/sessions', user)
        session = sessionData?.data?.data;
        expect(session).toBeDefined()

        await loginWithGuestUser(guestClient, session.url)

        session = await refreshSession(guestClient, session)

        await completeSessionStep(guestClient, session, user)

        session = await refreshSession(guestClient, session)

        await completeSessionStep(guestClient, session, user)

    })





    test('Verify SSN Details Modal Check Structure and Display (VC-186)', async ({ page }) => {

        // Login as admin
        // Navigate to Applications page
        await page.goto('/')
        await loginWith(page, admin)

        await page.goto(`/sessions/${session.id}`, { waitUntil: 'domcontentloaded' })
        await expect(page.getByTestId('session-report-section')).toBeVisible({ timeout: 10_000 })

        const identitySection = await openReportSection(page, 'identity-section')

        const ssnBtn = identitySection.getByTestId('ssn-detail-btn');
        await expect(ssnBtn).toBeVisible();

        await ssnBtn.click()

        const identityMoreDetailsModal = page.getByTestId('identity-more-details-modal');
        await expect(identityMoreDetailsModal).toBeVisible();

        const modalTitle = await identityMoreDetailsModal.getByTestId('identity-details-modal-title')
        await expect(modalTitle).toHaveText('SSN Verification')

        const idChecks = [
            'identity-id-name',
            'identity-dob',
            'identity-ssn-tile',
            'identity-address',
        ]
        for (let index = 0; index < idChecks.length; index++) {
            const element = idChecks[index];
            const idTileValue = identityMoreDetailsModal.getByTestId(element)
            await expect(idTileValue).toBeVisible()
        }
        const ssnChecks = [
            {
                key: "id-inquiry-comparison"
            },
            {
                key: "id-database-address-deliverable-detection"
            },
            {
                key: "id-database-address-residential-detection"
            },
            {
                key: "id-p.o.-box-detection"
            },
            {
                key: "id-alive-detection"
            },
            {
                key: "id-identity-comparison-check",
                children: [
                    'id-child-birthdate',
                    'id-child-first-name',
                    'id-child-social-security-number',
                    'id-child-street-house-number',
                    'id-child-street-name',
                    'id-child-street-type',
                    'id-child-city',
                    'id-child-administrative-area',
                    'id-child-country',
                ]
            },
        ]

        for (let index = 0; index < ssnChecks.length; index++) {
            const element = ssnChecks[index];
            const ssnTile = identityMoreDetailsModal.getByTestId(element)
            await expect(ssnTile).toBeVisible()
            const title = await element.textContent()
            await expect(title.includes('views.')).toBeFalsy() // check translation key not visible
            const eitherLocator = ssnTile.locator('[data-tick="checked"]').or(ssnTile.locator('[data-tick="unchecked"]'))
            await expect(eitherLocator).toBeVisible();

            for (let index = 0; index < element.children.length; index++) {
                const childDiv = identityMoreDetailsModal.getByTestId(`${element}-child`)
                await expect(childDiv).toHaveClass(/grid/);
                const item = element.children[index];
                const ssnChildTile = childDiv.getByTestId(item)
                await expect(ssnChildTile).toBeVisible()
                const childValue = await ssnChildTile.getByTestId(`${item}-value`).textContent()
                await expect(!!childValue.trim()).not.toBeFalsy()
                const childTitle = await item.textContent()
                await expect(childTitle.includes('views.')).toBeFalsy() // check translation key not visible
                const eitherChildLocator = ssnTile.locator('[data-tick="checked"]').or(ssnChildTile.locator('[data-tick="unchecked"]'))
                await expect(eitherChildLocator).toBeVisible();
            }
        }


        const cancelModalBtn = page.getByTestId('identity-more-details-modal-cancel');
        await expect(cancelModalBtn).toBeVisible();




        // Create or use existing application with SSN verification



        // Ensure session has SSN identity verification with all 4 main checks populated:
        // P.O. Box Detection
        // Alive Detection
        // Identity Comparison Check (with subchecks)
        // Inquiry Comparison
        // Navigate to session detail page
        // Open Identity section
        // Verify SSN Details button (ssn-detail-btn) is visible




    })

})