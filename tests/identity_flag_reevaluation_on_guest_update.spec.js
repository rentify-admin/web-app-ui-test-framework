// 🛠️ Imports: Test fixtures, utilities, and test config!
import { test, expect } from "./fixtures/api-data-fixture";
import { personaConnectData } from "./mock-data/identity-payload";
import { admin } from "./test_config";
import ApplicationBuilder from "./utils/application-builder";
import { findAndInviteApplication } from "./utils/applications-page";
import { authenticateAdmin, cleanupSession } from "./utils/cleanup-helper";
import { gotoPage } from "./utils/common";
import generateSessionForm from "./utils/generate-session-form";
import { searchSessionWithText } from "./utils/report-page";
import { setupInviteLinkSession, startSessionFlow, updateRentBudget } from "./utils/session-flow";
import { adminLoginAndNavigateToApplications } from "./utils/session-utils";
import { waitForJsonResponse } from "./utils/wait-response";
import WorkflowBuilder from "./utils/workflow-builder";

// 🗑️ For cleanup after test
let application = null;
let createdSessionId = null;
let allTestsPassed = true;
let flagUpdated = false;

// Ref: To always get the latest sessionFlags from network listener inside checkFlagChanges
let latestSessionFlags = [];

const workflowTemplate = 'Autotest-Identity-Simulator';
const appConfig = {
    organizationName: 'Verifast',
    applicationName: `AutoTest - Identity Simulation Step Only`,
    applicantTypes: [],
    workflowTemplate,
    flagCollection: 'High Risk',
    minimumAmount: '500'
};


// Test input names for easy access and updates
const TEST_FIRST_NAME_ORIGIN = 'Alexis';
const TEST_LAST_NAME_ORIGIN = 'Murphy';

const SIM_PERSONA_FIRST_NAME = 'Nicole';
const SIM_PERSONA_LAST_NAME = 'Mumphrey';

const MATCHED_UPDATE_FIRST_NAME = 'Nicole';
const MATCHED_UPDATE_LAST_NAME = 'Murphy';

const FULLY_MATCHED_LAST_NAME = 'Mumphrey';

// 🧪 Test Suite: QA-227 - Tests for Identity Flag Re-evaluation on Guest Update
test.describe('QA-227 identity_flag_reevaluation_on_guest_update.spec', () => {

    test.describe.configure({
        mode: 'serial',
        timeout: 130_000,
    });

    // ⚙️ Setup the suite: Ensure workflow & application exist
    test.beforeAll(async ({ request }) => {
        console.log("🛠️ [Setup] Checking prerequisites for workflow & application...");
        const token = await authenticateAdmin(request);
        if (!token) {
            console.log(`⚠️ [Setup] Manual workflow creation not triggered (token missing)`);
            return;
        }
        const workflowBuilder = new WorkflowBuilder(request, workflowTemplate, token);

        const workflow = await workflowBuilder.checkWorkflowExists();
        if (!workflow) {
            console.log("✳️ [Setup] Creating workflow for test scenario...");
            await workflowBuilder.checkOrCreateWorkflow();
            await workflowBuilder.getRequiredData();
            await workflowBuilder.createIdentityStep({}, { provider: 'Simulation' });
            await workflowBuilder.fetchCreatedSteps();
            await workflowBuilder.createPaths();
        }

        const applicationBuilder = new ApplicationBuilder(request, token);
        const { applicationExists } = await applicationBuilder.checkApplicationExists(appConfig.applicationName);
        if (!applicationExists) {
            console.log("✳️ [Setup] Creating application for test scenario...");
            application = await applicationBuilder.createApplicationFullFlow({
                organizationName: appConfig.organizationName,
                applicationName: appConfig.applicationName,
                workflowTemplate
            });

        } else {
            console.log("✅ [Setup] Application already exists, using existing one.");
        }
        console.log("✅ [Setup] Workflow & Application ready!\n");
    });

    // 🧹 After all: clean up test application and session
    test.afterAll(async ({ request }, testInfo) => {
        if(testInfo.status === 'passed'){
            await cleanupSession(request, createdSessionId, allTestsPassed);
            console.log(`✅ [Cleanup] Session #${createdSessionId} cleaned up.`);
        }
    });

    // ✅ MAIN TEST
    test('Test Re-evaluate Identity Mismatch Flags When Guest Record is Updated', {
        tag: ['@regression', '@application', '@staging-ready', '@rc-ready'],
        timeout: 180_000
    }, async ({ page, browser }) => {

        console.log("🚦 1️⃣ [START] Begin identity mismatch flag re-evaluation test");
        // -----------------------------------------------
        // Step 1: Admin login & navigate to Applications
        // -----------------------------------------------
        console.log("🔑 2️⃣ [Admin Login] Logging in as admin and navigating to Applications menu...");
        await adminLoginAndNavigateToApplications(page, admin);

        // -----------------------------------------------
        // Step 2: Invite Applicant for this test run
        // -----------------------------------------------
        console.log(`✉️ 3️⃣ [Invite] Finding and inviting application (${appConfig.applicationName})...`);
        await findAndInviteApplication(page, appConfig.applicationName);

        // Generate test userData unique to this run
        const userData = {
            first_name: TEST_FIRST_NAME_ORIGIN,
            last_name: TEST_LAST_NAME_ORIGIN,
            email: `identity-flag-test-${Date.now()}@verifast.com`
        };
        console.log(`📋 4️⃣ [Applicant Data] user: ${userData.first_name} ${userData.last_name}, email: ${userData.email}`);

        // Generate invite session and extract link
        const { sessionId, link } = await generateSessionForm.generateSessionAndExtractLink(page, userData);
        createdSessionId = sessionId;
        console.log(`🔗 5️⃣ [Invite Link] Got session ID: ${sessionId}, launching applicant flow...`);

        // -----------------------------------------------
        // Step 3: Applicant enters flow & sets up 
        // -----------------------------------------------
        const applicantPage = await startSessionFlow(link, browser);
        await setupInviteLinkSession(applicantPage);
        console.log("🗝️ 6️⃣ [Invite Link] Applicant flow started and entered setup...");

        await updateRentBudget(applicantPage, sessionId, '500');
        console.log("🏠 7️⃣ [Budget] Rent budget updated to $500");

        // Wait for identity-verification step to appear and continue
        const identityStep = applicantPage.getByTestId('identify-step');
        await expect(identityStep).toBeVisible({ timeout: 10_000 });
        console.log("🆔 8️⃣ [ID Step] Identity step visible, about to simulate ID flow...");

        // Use mismatched identity information to trigger flag
        const data = personaConnectData({
            ...userData,
            first_name: SIM_PERSONA_FIRST_NAME,
            last_name: SIM_PERSONA_LAST_NAME
        });

        const connectBtn = applicantPage.getByTestId('id-simulation-connect-btn');

        applicantPage.on('dialog', async dialog => {
            console.log('💬 9️⃣ [Dialog] Browser prompt detected for ID simulation!');
            await applicantPage.waitForTimeout(500);
            await dialog.accept(JSON.stringify(data));
            console.log('✅ 9️⃣ [Dialog] Payload sent to the persona simulation dialog.');
        });

        // Start the simulation (acts as ID verification by applicant)
        console.log('🔗 1️⃣0️⃣ [Persona Sim] Clicking connect button for identity simulation...');
        await connectBtn.click();
        await applicantPage.waitForTimeout(2000);

        // Wait for next step in applicant summary
        await expect(applicantPage.getByTestId('summary-step')).toBeVisible({ timeout: 30_000 });
        console.log('📑 1️⃣1️⃣ [Applicant Flow] Arrived at summary step (ID flow complete)');

        // -----------------------------------------------
        // Step 4: Bring admin page to focus → go to sessions list & search this session
        // -----------------------------------------------
        await page.bringToFront();
        console.log('🗄️ 1️⃣2️⃣ [Admin Page] Navigating back to admin, opening applicants list...');
        await gotoPage(page, 'applicants-menu', 'applicants-submenu', '/sessions?fields[session]');
        await page.waitForTimeout(800);

        console.log(`🔎 1️⃣3️⃣ [Search Session] Searching for current session in the grid: #${sessionId}`);
        await searchSessionWithText(page, sessionId);

        // -----------------------------------------------
        // Step 5: Listen to flag responses so we can detect when the flag changes!
        // -----------------------------------------------
        // patch: keep a "latestSessionFlags" ref that's always up to date, for checkFlagChanges
        let sessionFlags = [];
        const responseFlags = async response => {
            if (
                response.url().includes(`/sessions/${sessionId}/flags?`) &&
                response.ok() &&
                response.request().method() === 'GET'
            ) {
                const { data: flags } = await waitForJsonResponse(response);
                sessionFlags = flags;
                latestSessionFlags = flags;
                console.log(`[🌓 Flag Listener] (Captured session flags: ${flags.length})`);
                if (flags.length > 0) {
                    flagUpdated = true;
                    console.debug("🚀 ~ responseFlags ~ flags[0].id:", flags[0].id)
                    console.debug("🚀 ~ responseFlags ~ flags[0].flag.id:", flags[0].flag.id)
                    console.debug("🚀 ~ responseFlags ~ flags[0].flag.key:", flags[0].flag.key)
                }
            }
        };
        page.on('response', responseFlags);

        // -----------------------------------------------
        // Step 6: Select session in grid, open details modal
        // -----------------------------------------------
        console.log('📂 1️⃣4️⃣ [View Session] Opening application card and waiting for details...');
        const [primarySessionResponse] = await Promise.all([
            page.waitForResponse(resp =>
                resp.url().includes(`/sessions/${sessionId}?fields[session]`) &&
                resp.ok() &&
                resp.request().method() === 'GET'
            ),
            page.locator(`.application-card[data-session="${sessionId}"]`).first().click()
        ]);
        const primarySessionData = await waitForJsonResponse(primarySessionResponse);

        const viewDetailBtn = page.getByTestId('view-details-btn');
        await expect(viewDetailBtn).toBeVisible();
        await viewDetailBtn.click();

        // Capture the flag object for later checks
        console.log('🔴 1️⃣5️⃣ [Verify] IDENTITY_NAME_MISMATCH_CRITICAL flag is present (due to mismatched applicant data)');
        let count = 0;
        let firstTestFlag = null;
        do {
            firstTestFlag = sessionFlags.find(
                sessionFlag => sessionFlag.flag.key === 'IDENTITY_NAME_MISMATCH_CRITICAL'
            );
            await page.waitForTimeout(1000);
            count++;
        } while (!flagUpdated && count < 15)
        count = 0
        if (flagUpdated) {
            flagUpdated = false;
        }
        await expect(firstTestFlag).toBeDefined()

        console.log('🧐 1️⃣6️⃣ [Flag Modal] Viewing applicant details (flag section)...');
        const flagSection = page.getByTestId('report-view-details-flags-section');
        await expect(flagSection).toBeVisible();
        const itemCauseDecline = flagSection.getByTestId('items-causing-decline-section');
        await expect(itemCauseDecline.getByTestId('IDENTITY_NAME_MISMATCH_CRITICAL')).toBeVisible({ timeout: 20_000 });

        // -----------------------------------------------
        // Step 7: Edit the applicant (guest) details and re-check the flag
        // -----------------------------------------------
        const closeModalBtn = page.getByTestId('close-event-history-modal');
        await expect(closeModalBtn).toBeVisible();
        await closeModalBtn.click();
        console.log("🔔 1️⃣7️⃣ [Edit Guest] Closed flag details modal, ready to edit guest details...");

        // Open identity section and edit guest
        const identitySection = await openIdentitySection(page);
        const editGuestBtn = identitySection.getByTestId('identity-edit-guest-btn');
        await expect(editGuestBtn).toBeVisible();
        await editGuestBtn.click();

        const editGuestModal = page.getByTestId('identity-update-guest-modal');
        await expect(editGuestModal).toBeVisible();
        const guestFirstNameField = editGuestModal.getByTestId('guest-first-name-field');
        const guestLastNameField = editGuestModal.getByTestId('guest-last-name-field');

        // Assert fields have initial values (from userData)
        await expect(guestFirstNameField).toHaveValue(`Autot - ${userData.first_name}`);
        await expect(guestLastNameField).toHaveValue(userData.last_name);

        // --- 1st modification: Set guest name to Nicole Murphy (step matches persona first name, but not last) ---
        await guestFirstNameField.fill(MATCHED_UPDATE_FIRST_NAME);
        await guestLastNameField.fill(MATCHED_UPDATE_LAST_NAME);
        console.log(`✏️ 1️⃣8️⃣ [Modify Guest] Guest name changed to ${MATCHED_UPDATE_FIRST_NAME} ${MATCHED_UPDATE_LAST_NAME} (matches some, not all persona)`);

        const updateGuestSubmit = editGuestModal.getByTestId('submit-guest-update-form');
        await expect(updateGuestSubmit).toBeVisible();
        await updateGuestSubmit.click();
        await expect(editGuestModal).not.toBeVisible({ timeout: 10_000 });
        console.log(`💾 1️⃣9️⃣ [Update Guest] Guest update submitted (${MATCHED_UPDATE_FIRST_NAME} ${MATCHED_UPDATE_LAST_NAME})`);

        // Opening detail view and checking if the flag persists (should still mismatch)
        await viewDetailBtn.click();
        let secondTestFlag = null;
        do {
            secondTestFlag = sessionFlags.find(
                sessionFlag => sessionFlag.flag.key === 'IDENTITY_NAME_MISMATCH_CRITICAL'
            );
            await page.waitForTimeout(800);
            count++;
        } while (!flagUpdated && count < 15)
        count = 0
        if (flagUpdated) {
            flagUpdated = false;
        }
        await expect(secondTestFlag).toBeDefined()

        await expect(itemCauseDecline.getByTestId('IDENTITY_NAME_MISMATCH_CRITICAL')).toBeVisible({ timeout: 10_000 });
        console.log("🔍 2️⃣0️⃣ [Flag Check] IDENTITY_NAME_MISMATCH_CRITICAL flag still present after first guest name update.");

        await expect(closeModalBtn).toBeVisible();
        await closeModalBtn.click();

        // --- 2nd modification: Change last name to match simulant exactly ---
        await editGuestBtn.click();
        await expect(editGuestModal).toBeVisible();
        await expect(guestFirstNameField).toHaveValue(MATCHED_UPDATE_FIRST_NAME);
        await expect(guestLastNameField).toHaveValue(MATCHED_UPDATE_LAST_NAME); // Should be after previous fill

        await guestLastNameField.fill(FULLY_MATCHED_LAST_NAME);
        console.log(`✏️ 2️⃣1️⃣ [Modify Guest] Changed Guest last name to '${FULLY_MATCHED_LAST_NAME}' (full match with simulation persona)...`);
        await updateGuestSubmit.click();
        await expect(editGuestModal).not.toBeVisible({ timeout: 10_000 });
        console.log(`💾 2️⃣2️⃣ [Update Guest] Guest update submitted (${MATCHED_UPDATE_FIRST_NAME} ${FULLY_MATCHED_LAST_NAME})`);

        // --- Final check: flag should disappear since guest matches persona data!
        await viewDetailBtn.click();
        const thirdTestFlag = await checkFlagChanges(page, secondTestFlag);
        await expect(itemCauseDecline.getByTestId('IDENTITY_NAME_MISMATCH_CRITICAL')).not.toBeVisible({ timeout: 10_000 });
        console.log("✅ 2️⃣3️⃣ [Final Flag] Flag is cleared. Applicant/Guest name matches. Identity mismatch correctly re-evaluated!\n");

        await expect(closeModalBtn).toBeVisible();
        await closeModalBtn.click();

        // 🧪 Test: Edit guest modal - change first name, cancel, and ensure value is reset
        // Open edit guest modal again
        await editGuestBtn.click();
        await expect(editGuestModal).toBeVisible();

        // Change first name to something different
        const TEMP_FIRST_NAME = "CHANGED_NAME";
        await guestFirstNameField.fill(TEMP_FIRST_NAME);

        // Click cancel/close (X) to exit without saving
        const cancelEditGuest = editGuestModal.getByTestId('identity-update-guest-modal-cancel');
        await expect(cancelEditGuest).toBeVisible();
        await cancelEditGuest.click();
        await expect(editGuestModal).not.toBeVisible({ timeout: 10_000 });

        // Reopen edit guest modal
        await editGuestBtn.click();
        await expect(editGuestModal).toBeVisible();

        // Assert first name reset to previously saved value (should remain MATCHED_UPDATE_FIRST_NAME)
        await expect(guestFirstNameField).toHaveValue(MATCHED_UPDATE_FIRST_NAME);

        // Close again to move to last name test
        await cancelEditGuest.click();
        await expect(editGuestModal).not.toBeVisible({ timeout: 10_000 });

        // 🧪 Test: Edit guest modal - change last name, cancel, and ensure value is reset

        // Open modal again
        await editGuestBtn.click();
        await expect(editGuestModal).toBeVisible();

        // Change last name to something different
        const TEMP_LAST_NAME = "DIFFERENT_LAST";
        await guestLastNameField.fill(TEMP_LAST_NAME);

        // Click cancel/close (X) to exit without saving
        await cancelEditGuest.click();
        await expect(editGuestModal).not.toBeVisible({ timeout: 10_000 });

        // Reopen edit guest modal
        await editGuestBtn.click();
        await expect(editGuestModal).toBeVisible();

        // Assert last name reset to previously saved value (should remain FULLY_MATCHED_LAST_NAME)
        await expect(guestLastNameField).toHaveValue(FULLY_MATCHED_LAST_NAME);

        // Close out of modal for rest of test
        await cancelEditGuest.click();
        await expect(editGuestModal).not.toBeVisible({ timeout: 10_000 });

        console.log("🏁 2️⃣4️⃣ [COMPLETE] Test finished: Identity flag is triggered and then cleared according to data updates.\n");
    });
});

// --------------------------------------------
// 💡 Utility function: Wait for flag changes after guest update.
//
// Patch: Always reads latestSessionFlags (from global "responseFlags" listener)
//        so the actual current flags are checked, regardless of references passed
async function checkFlagChanges(page, previousFlag) {
    let foundFlag = null;
    let count = 0;
    const maxIter = 10;
    const flagChangeDetected = false;
    do {
        // wait a short while for the listener to update latestSessionFlags
        await page.waitForTimeout(1500);
        const flagsArray = latestSessionFlags || [];
        // Look for the flag with key
        foundFlag = flagsArray.find(f => f.flag?.key === 'IDENTITY_NAME_MISMATCH_CRITICAL');
        if (foundFlag) {
            console.debug("🚀 ~ checkFlagChanges ~ foundFlag.id:", foundFlag.id, "prev:", previousFlag && previousFlag.id);
        } else {
            console.debug("🚀 ~ checkFlagChanges ~ flag is NOT present (maybe cleared)");
        }
        // If flag is present and status (id) changed, or flag now missing, break
        if (!foundFlag || !previousFlag || (foundFlag && foundFlag.id !== previousFlag.id)) {
            console.log(`🔄   [Flag Change] Detected IDENTITY_NAME_MISMATCH_CRITICAL (flag id: ${foundFlag.id})`);
            break;
        }
        count++;
    } while (count < maxIter);
    await expect(flagChangeDetected).toBeTruthy();
    return foundFlag;
}

// 💡 Utility: Open identity section in details modal
async function openIdentitySection(page) {
    const identitySection = page.getByTestId('identity-section');
    await expect(identitySection).toBeVisible();
    const identityHeader = identitySection.getByTestId('identity-section-header');
    await expect(identityHeader).toBeVisible();
    await identityHeader.click();
    console.log("🧑‍💼 [Open] Identity section expanded");
    return identitySection;
}
