// 🛠️ Imports: Test fixtures, utilities, and test config!
import { test, expect } from "./fixtures/api-data-fixture";
import { personaConnectData } from "./mock-data/identity-payload";
import { admin, app } from "./test_config";
import ApplicationBuilder from "./utils/application-builder";
import { findAndInviteApplication } from "./utils/applications-page";
import { authenticateAdmin, cleanupTrackedSession } from "./utils/cleanup-helper";
import { gotoPage } from "./utils/common";
import generateSessionForm from "./utils/generate-session-form";
import { pollForFlag, pollUntil } from "./utils/polling-helper";
import { searchSessionWithText } from "./utils/report-page";
import { setupInviteLinkSession, startSessionFlow, updateRentBudget } from "./utils/session-flow";
import { adminLoginAndNavigateToApplications } from "./utils/session-utils";
import { waitForJsonResponse } from "./utils/wait-response";
import WorkflowBuilder from "./utils/workflow-builder";
import { NAME_PREFIX, removePrefix } from "./utils/naming-helper";

// 🗑️ For cleanup after test
let application = null;
let createdSessionId = null;
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
        timeout: 280_000,
    });

    // ⚙️ Setup the suite: Ensure workflow & application exist
    test.beforeAll(async ({ request }) => {
        console.log("🛠️ [Setup] Checking prerequisites for workflow & application...");
        let token;
        try {
            token = await authenticateAdmin(request);
        } catch (error) {
            console.log(`⚠️ [Setup] Manual workflow creation not triggered (token missing): ${error.message}`);
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

    test.beforeEach(() => {
        // Reset per-attempt tracking (important with Playwright retries)
        createdSessionId = null;
    });

    // Always cleanup by default; keep artifacts only when KEEP_FAILED_ARTIFACTS=true and test failed
    test.afterEach(async ({ request }, testInfo) => {
        await cleanupTrackedSession(request, createdSessionId, testInfo);
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

        // Wait for next step in applicant summary using polling
        await pollUntil(async () => {
            const summaryStep = applicantPage.getByTestId('summary-step');
            const count = await summaryStep.count();
            if (count > 0) {
                const isVisible = await summaryStep.isVisible().catch(() => false);
                return isVisible;
            }
            return false;
        }, {
            maxPollTime: 60000, // 60 seconds
            pollInterval: 2000,
            description: 'summary-step to appear'
        });
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

        const alertBtn = page.getByRole('button', { name: 'Alert' });
        await expect(alertBtn).toBeVisible();
        await alertBtn.click();

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
        } while (!firstTestFlag || !flagUpdated || count < 15)
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
        const editGuestBtn = await getEditGuestButton(page);
        await editGuestBtn.click();

        const editGuestModal = page.getByTestId('identity-update-guest-modal');
        await expect(editGuestModal).toBeVisible();
        const guestFirstNameField = editGuestModal.getByTestId('guest-first-name-field');
        const guestLastNameField = editGuestModal.getByTestId('guest-last-name-field');

        // Assert fields have initial values (from userData - note: prefix is added by generateSessionForm)
        const initialFirstName = await guestFirstNameField.inputValue();
        // Check if field has prefix (case-insensitive check) - this confirms the prefix was added during session creation
        const hasPrefixValue = initialFirstName.toLowerCase().startsWith(NAME_PREFIX.toLowerCase());
        await expect(hasPrefixValue).toBeTruthy();
        await expect(guestLastNameField).toHaveValue(userData.last_name);
        console.log(`📋 [Initial Values] First name: "${initialFirstName}", Last name: "${userData.last_name}"`);
        console.log(`⚠️  NOTE: The prefix "${NAME_PREFIX}" is only for test identification. It will be removed when updating to enable proper name matching for flag evaluation.`);

        // --- 1st modification: Set guest name to Nicole Murphy (step matches persona first name, but not last) ---
        // IMPORTANT: Fill WITHOUT prefix - the prefix should NOT be included in the update
        // This ensures proper name comparison for flag evaluation
        await guestFirstNameField.fill(MATCHED_UPDATE_FIRST_NAME);
        await guestLastNameField.fill(MATCHED_UPDATE_LAST_NAME);
        console.log(`✏️ 1️⃣8️⃣ [Modify Guest] Guest name changed to ${MATCHED_UPDATE_FIRST_NAME} ${MATCHED_UPDATE_LAST_NAME} (matches some, not all persona - NO PREFIX)`);

        const updateGuestSubmit = editGuestModal.getByTestId('submit-guest-update-form');
        await expect(updateGuestSubmit).toBeVisible();
        
        // Wait for PATCH request to complete and verify the saved name doesn't have prefix
        const [guestPatchResponse1] = await Promise.all([
            page.waitForResponse(resp =>
                /\/guests\/[0-9a-fA-F-]{36}/.test(resp.url()) &&
                resp.request().method() === 'PATCH' &&
                resp.ok()
            ),
            updateGuestSubmit.click()
        ]);
        
        // Verify the saved guest name does NOT have the prefix
        const patchData1 = await guestPatchResponse1.json();
        const savedFirstName1 = patchData1.data?.first_name || '';
        if (savedFirstName1.toLowerCase().startsWith(NAME_PREFIX.toLowerCase())) {
            console.warn(`⚠️  WARNING: Saved first name still contains prefix: "${savedFirstName1}"`);
        } else {
            console.log(`✅ Guest name saved correctly without prefix: "${savedFirstName1}"`);
        }
        
        await expect(editGuestModal).not.toBeVisible({ timeout: 10_000 });
        console.log(`💾 1️⃣9️⃣ [Update Guest] Guest update submitted (${MATCHED_UPDATE_FIRST_NAME} ${MATCHED_UPDATE_LAST_NAME})`);
        
        // Verify via API that the guest name is saved without prefix
        const guestCheckResponse1 = await page.request.get(`${app.urls.api}/sessions/${sessionId}?fields[session]=applicant`);
        if (guestCheckResponse1.ok()) {
            const sessionData1 = await guestCheckResponse1.json();
            const savedGuestFirstName = sessionData1.data.applicant.guest.first_name || '';
            const hasPrefixInSaved = savedGuestFirstName.toLowerCase().startsWith(NAME_PREFIX.toLowerCase());
            if (hasPrefixInSaved) {
                console.error(`❌ ERROR: Guest first name still has prefix after update: "${savedGuestFirstName}"`);
                console.error(`   This will cause flag comparison to fail. Expected: "${MATCHED_UPDATE_FIRST_NAME}"`);
            } else {
                console.log(`✅ Verified: Guest first name saved without prefix: "${savedGuestFirstName}"`);
            }
        }

        // Poll for flag change (CRITICAL → WARNING after partial match) using FE polling
        console.log('🔍 2️⃣0️⃣ [Flag Polling] Waiting for flag to change from CRITICAL to WARNING...');
        
        // Open details modal first
        const viewDetailBtn = page.getByRole('button', { name: /alert/i }).first();
        await expect(viewDetailBtn).toBeVisible({ timeout: 10_000 });
        await viewDetailBtn.click();
        await page.waitForTimeout(1000);
        
        // Poll for WARNING flag to appear with modal refresh
        await pollForFlag(page, {
            flagTestId: 'IDENTITY_NAME_MISMATCH_WARNING',
            shouldExist: true,
            maxPollTime: 120000, // 120 seconds - increased for flag re-evaluation processing
            pollInterval: 1500,
            refreshModal: true
        });
        
        console.log("✅ 2️⃣0️⃣ [Flag Change Detected] Flag changed from CRITICAL to WARNING after partial match");
        
        // Verify WARNING flag is visible in the correct section
        const flagSectionAfterChange = page.getByTestId('report-view-details-flags-section');
        await expect(flagSectionAfterChange).toBeVisible();
        const itemWarningSection = flagSectionAfterChange.getByTestId('items-warning-section');
        await expect(itemWarningSection.getByTestId('IDENTITY_NAME_MISMATCH_WARNING')).toBeVisible({ timeout: 10_000 });
        console.log("🔍 2️⃣0️⃣ [Flag Check] Flag changed to IDENTITY_NAME_MISMATCH_WARNING after partial match (first name matches, last name differs).");

        await expect(closeModalBtn).toBeVisible();
        await closeModalBtn.click();
        await page.waitForTimeout(1500);

        // --- 2nd modification: Change last name to match simulant exactly ---
        // Ensure identity section is open before clicking edit button
        const editGuestBtn2 = await getEditGuestButton(page);
        await editGuestBtn2.click();
        await expect(editGuestModal).toBeVisible();
        
        // Verify fields show the updated values (without prefix)
        const currentFirstNameValue = await guestFirstNameField.inputValue();
        const currentLastNameValue = await guestLastNameField.inputValue();
        await expect(currentFirstNameValue).toBe(MATCHED_UPDATE_FIRST_NAME); // Should be "Nicole" without prefix
        await expect(currentLastNameValue).toBe(MATCHED_UPDATE_LAST_NAME); // Should be "Murphy"
        
        // If first name still has prefix, remove it before continuing
        const cleanedFirstName = removePrefix(currentFirstNameValue);
        if (cleanedFirstName !== currentFirstNameValue) {
            console.log(`⚠️  Found prefix in first name field, clearing it: "${currentFirstNameValue}" → "${cleanedFirstName}"`);
            await guestFirstNameField.fill(cleanedFirstName);
        }

        await guestLastNameField.fill(FULLY_MATCHED_LAST_NAME);
        console.log(`✏️ 2️⃣1️⃣ [Modify Guest] Changed Guest last name to '${FULLY_MATCHED_LAST_NAME}' (full match with simulation persona - NO PREFIX)...`);
        
        // Wait for PATCH request to complete and verify saved name
        const [guestPatchResponse] = await Promise.all([
            page.waitForResponse(resp =>
                /\/guests\/[0-9a-fA-F-]{36}/.test(resp.url()) &&
                resp.request().method() === 'PATCH' &&
                resp.ok()
            ),
            updateGuestSubmit.click()
        ]);
        
        // Verify the saved guest name does NOT have the prefix
        const patchData = await guestPatchResponse.json();
        const savedFirstName = patchData.data?.first_name || '';
        const savedLastName = patchData.data?.last_name || '';
        if (savedFirstName.toLowerCase().startsWith(NAME_PREFIX.toLowerCase())) {
            console.error(`❌ ERROR: Saved first name still contains prefix: "${savedFirstName}"`);
        } else {
            console.log(`✅ Guest name saved correctly without prefix: "${savedFirstName} ${savedLastName}"`);
        }
        
        await expect(editGuestModal).not.toBeVisible({ timeout: 10_000 });
        console.log(`💾 2️⃣2️⃣ [Update Guest] Guest update submitted (${MATCHED_UPDATE_FIRST_NAME} ${FULLY_MATCHED_LAST_NAME})`);
        
        // Verify guest name via API (should NOT have prefix)
        console.log('🔍 Verifying guest name saved correctly (without prefix)...');
        const guestCheckResponse = await page.request.get(`${app.urls.api}/sessions/${sessionId}?fields[session]=applicant`);
        if (guestCheckResponse.ok()) {
            const sessionData = await guestCheckResponse.json();
            const guestFullName = sessionData.data.applicant.guest.full_name;
            const guestFirstName = sessionData.data.applicant.guest.first_name || '';
            const guestLastName = sessionData.data.applicant.guest.last_name || '';
            const hasPrefixInFullName = guestFirstName.toLowerCase().startsWith(NAME_PREFIX.toLowerCase());
            
            console.log(`   Current guest name: "${guestFullName}"`);
            console.log(`   Guest first name: "${guestFirstName}"`);
            console.log(`   Expected ID name: "Nicole Mumphrey"`);
            
            if (hasPrefixInFullName) {
                console.error(`❌ ERROR: Guest name still has prefix after update! This will cause incorrect flag evaluation.`);
                console.error(`   Expected: "${MATCHED_UPDATE_FIRST_NAME} ${FULLY_MATCHED_LAST_NAME}"`);
                console.error(`   Actual: "${guestFullName}"`);
            } else {
                console.log(`✅ Guest name saved correctly without prefix for flag comparison`);
            }
        }
        
        // --- Final check: flag should disappear since guest matches persona data!
        console.log('🔍 2️⃣3️⃣ [Flag Polling] Waiting for WARNING flag to be removed after complete match...');
        
        // Open details modal first
        const viewDetailBtn2 = page.getByRole('button', { name: /alert/i }).first();
        await expect(viewDetailBtn2).toBeVisible({ timeout: 10_000 });
        await viewDetailBtn2.click();
        await page.waitForTimeout(1000);
        
        // Poll for WARNING flag to disappear using FE polling with modal refresh
        await pollForFlag(page, {
            flagTestId: 'IDENTITY_NAME_MISMATCH_WARNING',
            shouldExist: false,
            maxPollTime: 120000, // 120 seconds - increased for flag re-evaluation processing
            pollInterval: 2000,
            refreshModal: true
        });
        
        console.log("✅ 2️⃣3️⃣ [Final Flag] Flag is cleared. Applicant/Guest name matches. Identity mismatch correctly re-evaluated!\n");

        await expect(closeModalBtn).toBeVisible();
        await closeModalBtn.click();

        // 🧪 Test: Edit guest modal - change first name, cancel, and ensure value is reset
        // Open edit guest modal again
        const editGuestBtn3 = await getEditGuestButton(page);
        await editGuestBtn3.click();
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
        const editGuestBtn4 = await getEditGuestButton(page);
        await editGuestBtn4.click();
        await expect(editGuestModal).toBeVisible();

        // Assert first name reset to previously saved value (should remain MATCHED_UPDATE_FIRST_NAME without prefix)
        const resetFirstName = await guestFirstNameField.inputValue();
        const cleanedResetFirstName = removePrefix(resetFirstName);
        await expect(cleanedResetFirstName).toBe(MATCHED_UPDATE_FIRST_NAME);

        // Close again to move to last name test
        await cancelEditGuest.click();
        await expect(editGuestModal).not.toBeVisible({ timeout: 10_000 });

        // 🧪 Test: Edit guest modal - change last name, cancel, and ensure value is reset

        // Open modal again
        const editGuestBtn5 = await getEditGuestButton(page);
        await editGuestBtn5.click();
        await expect(editGuestModal).toBeVisible();

        // Change last name to something different
        const TEMP_LAST_NAME = "DIFFERENT_LAST";
        await guestLastNameField.fill(TEMP_LAST_NAME);

        // Click cancel/close (X) to exit without saving
        await cancelEditGuest.click();
        await expect(editGuestModal).not.toBeVisible({ timeout: 10_000 });

        // Reopen edit guest modal
        const editGuestBtn6 = await getEditGuestButton(page);
        await editGuestBtn6.click();
        await expect(editGuestModal).toBeVisible();

        // Assert last name reset to previously saved value (should remain FULLY_MATCHED_LAST_NAME)
        const resetLastName = await guestLastNameField.inputValue();
        await expect(resetLastName).toBe(FULLY_MATCHED_LAST_NAME);

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
    const maxIter = 20;
    let flagChangeDetected = false;
    do {
        // wait a short while for the listener to update latestSessionFlags
        await page.waitForTimeout(1500);
        const flagsArray = latestSessionFlags || [];
        // Look for the flag with key (WARNING severity after partial match)
        foundFlag = flagsArray.find(f => f.flag?.key === 'IDENTITY_NAME_MISMATCH_WARNING');
        if (foundFlag) {
            console.debug("🚀 ~ checkFlagChanges ~ foundFlag.id:", foundFlag.id, "prev:", previousFlag && previousFlag.id);
        } else {
            console.debug("🚀 ~ checkFlagChanges ~ flag is NOT present (maybe cleared)");
        }
        // If flag is present and status (id) changed, or flag now missing, break
        if (!foundFlag || !previousFlag || (foundFlag && foundFlag.id !== previousFlag.id)) {
            flagChangeDetected = true;
            console.log(`🔄   [Flag Change] Detected change - flag ${foundFlag ? 'updated' : 'removed'} (flag id: ${foundFlag?.id || 'N/A'})`);
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
    
    // Check if content is already visible by checking if identity detail exists and is visible
    // This is more reliable than checking aria-expanded attribute
    const identityDetail = identitySection.locator('[data-testid^="identity-detail-"]').first();
    const isContentVisible = await identityDetail.isVisible({ timeout: 1000 }).catch(() => false);
    
    if (!isContentVisible) {
        // Content is not visible, click header to expand
        await identityHeader.click();
        // Wait for the content container to actually become visible (remove display: none)
        // Wait for the parent container's display style to change from 'none' to visible
        await page.waitForFunction(() => {
            const section = document.querySelector('[data-testid="identity-section"]');
            if (!section) return false;
            const contentContainer = section.querySelector('.overflow-hidden');
            if (!contentContainer) return false;
            const display = window.getComputedStyle(contentContainer).display;
            return display !== 'none';
        }, { timeout: 10000 });
        // Also wait for the identity detail to be visible as final confirmation
        await expect(identityDetail).toBeVisible({ timeout: 5000 });
        console.log("🧑‍💼 [Open] Identity section expanded");
    } else {
        // Content is already visible, no need to click
        console.log("🧑‍💼 [Open] Identity section already expanded");
    }
    return identitySection;
}

// 💡 Utility: Get edit guest button after ensuring identity section is open
async function getEditGuestButton(page) {
    await openIdentitySection(page);
    const identitySection = page.getByTestId('identity-section');
    
    // Get the edit button directly - it will only be visible when parent container is visible
    const editGuestBtn = identitySection.getByTestId('identity-edit-guest-btn');
    
    // Wait for button to become visible (this confirms parent container is no longer display: none)
    await expect(editGuestBtn).toBeVisible({ timeout: 15000 });
    
    // Ensure button is enabled (not disabled)
    await expect(editGuestBtn).toBeEnabled({ timeout: 5000 });
    
    // Scroll button into view to ensure it's not covered
    await editGuestBtn.scrollIntoViewIfNeeded();
    
    // Wait for any animations/transitions to complete
    await page.waitForTimeout(1000);
    
    return editGuestBtn;
}
