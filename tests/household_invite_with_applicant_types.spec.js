import { test, expect } from '@playwright/test'
import { ApiClient } from './api'
import { admin, app } from './test_config'
import { loginWithAdmin } from './endpoint-utils/auth-helper';
import { getApplicationByName } from './endpoint-utils/application-helper';
import { createSession } from './endpoint-utils/session-helpers';
import { loginWith } from './utils/session-utils';
import { findSessionLocator, searchSessionWithText } from './utils/report-page';
import { getRandomEmail, wait } from './utils/helper';
import { waitForJsonResponse } from './utils/wait-response';
import { fillMultiselect } from './utils/common';
import { cleanupSession } from './utils/cleanup-helper';


let createdSession = null;
let session = null;
test.describe('QA-252 household-invite-with-applicant-types.spec', () => {


    const adminClient = new ApiClient(app.urls.api, null, 20_000);
    const APPLICATION_NAME = 'Autotest - Application Heartbeat (Frontend)'

    test.beforeAll(async () => {
        console.log('🌀 [Step 1] Logging in with admin credentials...');
        await loginWithAdmin(adminClient);

        console.log('📦 [Step 2] Fetching application by name...');
        const application = await getApplicationByName(adminClient, APPLICATION_NAME);

        const user = {
            first_name: 'Autotest',
            last_name: 'User',
            email: 'autotest+user@verifast.com'
        }

        console.log('🆕 [Step 3] Creating a user session...');
        const userSession = await createSession(adminClient, user, application.id);

        createdSession = userSession
        session = userSession;
        console.log(`✅ [Step 4] User session created: ${session.id}`)
    })

    test('Verify Co-Applicant and Guarantor Invitation with Applicant Types (VC-26)',{
        tag: ['@regression', '@staging-ready', '@rc-ready'],
        timeout: 150_000
    }, async ({ page }) => {
        console.log('🌐 Step 1: Navigating to homepage...');
        await page.goto('/');

        console.log('🔐 Step 2: Logging in with admin...');
        await loginWith(page, admin)

        console.log(`🔍 Step 3: Searching for session: ${session.id}...`);
        await searchSessionWithText(page, session.id);

        console.log('🧩 Step 4: Locating session card...');
        const sessionLocator = await findSessionLocator(page, `.application-card[data-session="${session.id}"]`)

        await sessionLocator.click()
        await expect(page.getByTestId('household-status-alert')).toBeVisible({ timeout: 10_000 });
        await page.waitForTimeout(1000); // Wait for session to fully load
        console.log('👉 Step 5: Session card clicked.');

        const actionBtn = page.getByTestId('session-action-btn');
        await expect(actionBtn).toBeVisible();
        console.log('🖱️ Step 6: Found session action button.');

        await actionBtn.click();
        console.log('🚪 Step 7: Opened session actions.');

        const inviteApplicantOpt = page.getByTestId('invite-applicant');
        await expect(inviteApplicantOpt).toBeVisible();
        console.log('📧 Step 8: Invite applicant option visible.');

        await inviteApplicantOpt.click();
        console.log('✅ Step 9: Invite applicant modal opened.');

        const inviteModal = page.getByTestId('invite-modal');
        await expect(inviteModal).toBeVisible();
        console.log('💬 Step 10: Invite modal is visible.');

        const applicantRoleDd = inviteModal.getByTestId('applicant-role');
        await expect(applicantRoleDd).toBeVisible();
        console.log('🔽 Step 11: Applicant role dropdown is visible.');

        await applicantRoleDd.click()
        await page.waitForTimeout(500); // Wait for dropdown options to appear
        console.log('⏬ Step 12: Applicant role dropdown clicked.');

        const coAppRoleOpt = applicantRoleDd.getByTestId('applicant-role-co-app');
        await expect(coAppRoleOpt).toBeVisible();
        console.log('👩‍🤝‍👨 Step 13: Co-applicant role option visible.');

        const guarantorRoleDd = applicantRoleDd.getByTestId('applicant-role-guarantor');
        await expect(guarantorRoleDd).toBeVisible();
        console.log('🤝 Step 14: Guarantor role option visible.');

        const coApp = {
            first_name: 'Autotest',
            last_name: 'Co-App',
            email: getRandomEmail(),
            role: "Co-App"
        }

        const guarantor = {
            first_name: 'Autotest',
            last_name: 'Guarantor',
            email: getRandomEmail(),
            role: "Guarantor"
        }

        console.log('🟢 Step 15: Inviting Co-Applicant...');
        await addApplicant(page, inviteModal, coApp, session);
        await page.waitForTimeout(2000); // Wait for modal to update after co-applicant invitation
        console.log('🟢 Step 16: Inviting Guarantor...');
        await addApplicant(page, inviteModal, guarantor, session);
        await page.waitForTimeout(2000); // Wait for modal to update after guarantor invitation

        // Re-fetch locators after modal updates to avoid stale element references
        const inviteModalAfter = page.getByTestId('invite-modal');
        const applicantRoleDdAfter = inviteModalAfter.getByTestId('applicant-role');
        await applicantRoleDdAfter.click();
        await page.waitForTimeout(500); // Wait for dropdown to open
        const coAppRoleOptAfter = applicantRoleDdAfter.getByTestId('applicant-role-co-app');
        const guarantorRoleDdAfter = applicantRoleDdAfter.getByTestId('applicant-role-guarantor');
        await expect(coAppRoleOptAfter).toBeVisible();
        await expect(guarantorRoleDdAfter).not.toBeVisible();
        console.log('🔄 Step 17: Verified role visibility after inviting applicants.');
    })

    test.afterAll(async ({ request }) => {
        console.log('🧹 [Cleanup] Starting session cleanup...');
        if (createdSession && createdSession.children && createdSession.children.length > 0) {
            for (let index = 0; index < createdSession.children.length; index++) {
                const element = createdSession.children[index];
                console.log(`❌ [Cleanup] Cleaning up session child: ${element.id} ...`);
                await cleanupSession(request, element.id)
            }
        }
        if (createdSession && createdSession.id) {
            console.log(`❌ [Cleanup] Cleaning up main created session: ${createdSession.id} ...`);
            await cleanupSession(request, createdSession.id)
        }
        console.log('✅ [Cleanup] Finished session cleanup!');
    })

})


async function addApplicant(page, inviteModal, coApp, session) {
    console.log(`✍️ [AddApplicant] Filling first name: ${coApp.first_name}`);
    const first_name = inviteModal.getByTestId('applicant-first-name');
    await expect(first_name).toBeVisible();
    await first_name.fill(coApp.first_name);

    console.log(`✍️ [AddApplicant] Filling last name: ${coApp.last_name}`);
    const last_name = inviteModal.getByTestId('applicant-last-name');
    await expect(last_name).toBeVisible();
    await last_name.fill(coApp.last_name);

    console.log(`📧 [AddApplicant] Filling email: ${coApp.email}`);
    const email = inviteModal.getByTestId('applicant-email');
    await expect(email).toBeVisible();
    await email.fill(coApp.email);

    console.log(`🪪 [AddApplicant] Selecting applicant role: ${coApp.role}`);
    const role = inviteModal.getByTestId('applicant-role');
    await expect(role).toBeVisible();
    await fillMultiselect(page, role, [coApp.role]);

    const submit = inviteModal.getByTestId('applicant-invite-submit');
    await expect(submit).toBeVisible();
    console.log('🚀 [AddApplicant] Waiting for create/applicant and session responses...');

    const createResp = page.waitForResponse(resp => resp.url().endsWith('/applicants')
        && resp.request().method() === 'POST'
        && resp.ok(),
        {
            timeout: 20_000
        }
    )
    const sessionResp = page.waitForResponse(resp => resp.url().includes(`/sessions/${session.id}?fields[session]`)
        && resp.request().method() === 'GET'
        && resp.ok(),
        {
            timeout: 20_000
        }
    )
    console.log('🖱️ [AddApplicant] Clicking submit button...');
    await submit.click()
    const applicantResp = await createResp
    const newSessionResp = await sessionResp
    expect(await applicantResp.status()).toBe(201);
    console.log('📝 [AddApplicant] Received applicant and updated session responses.');
    const { data: applicant } = await waitForJsonResponse(applicantResp)
    const { data: newSession } = await waitForJsonResponse(newSessionResp)
    if (newSession) {
        createdSession = newSession
        console.log(`🏠 [AddApplicant] Session updated with new applicant. Session ID: ${newSession.id}`)
    }

    const invitedApplicant = inviteModal.getByTestId('invited-applicants');
    await expect(invitedApplicant).toBeVisible();

    console.log('🔎 [AddApplicant] Finding session tile for the invited applicant...');
    // Interactive step logs
    console.log(`📄 [AddApplicant] newSession.id: ${newSession.id}`)
    console.log(`👥 [AddApplicant] newSession.children.length: ${newSession.children.length}`)
    console.log(`🔗 [AddApplicant] applicant.id: ${applicant.id}`)

    const applicantSession = newSession.children.find(sess => {
        return sess.applicant.id === applicant.id;
    })

    if (applicantSession) {
        const sessionTile = invitedApplicant.getByTestId(`invited-applicant-${applicantSession.id}`)

        await expect(sessionTile.getByTestId('invited-applicant-fullname')).toHaveText(`${coApp.first_name} ${coApp.last_name}`)
        await expect(sessionTile.getByTestId('invited-applicant-email')).toHaveText(`${coApp.email}`)
        await expect(sessionTile.getByTestId('invited-applicant-role')).toContainText(`${coApp.role}`)
        console.log(`✅ [AddApplicant] Applicant "${coApp.first_name} ${coApp.last_name}" with role "${coApp.role}" successfully added and visible.`)
    } else {
        console.log(`❌ [AddApplicant] Error: Could not find applicant session for applicant id: ${applicant.id}`)
    }
}

