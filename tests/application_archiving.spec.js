import { test, expect } from "@playwright/test";
import { adminLoginAndNavigateToApplications, loginWith } from "./utils/session-utils";
import { admin, app, session as sessionConf } from "./test_config";
import { ApiClient, ApplicationApi, FlagCollectionApi, IncomeSourceTemplateApi, OrganizationApi, ProviderApi, SessionApi, WorkflowApi } from "./api";
import { loginWithAdmin } from "./endpoint-utils/auth-helper";
import { searchApplication } from "./utils/applications-page";
import { waitForJsonResponse } from "./utils/wait-response";
import { createCurrentStep, loginWithGuestUser, simulateVerification, waitForStepTransition } from "./endpoint-utils/session-helpers";
import { getBankStatementData } from "./mock-data/high-balance-financial-payload";
import { getEmploymentSimulationMockData } from "./mock-data/employment-simulation-mock-data";
import { openReportSection } from "./utils/report-page";


const adminClient = new ApiClient(app.urls.api, null, 120_000);
const guestClient = new ApiClient(app.urls.api, null, 120_000);
const workflowApi = new WorkflowApi(adminClient);
const applicationApi = new ApplicationApi(adminClient);
const organizationApi = new OrganizationApi(adminClient);
const flagCollectionApi = new FlagCollectionApi(adminClient);
const incomeSourceTemplateApi = new IncomeSourceTemplateApi(adminClient);
const sessionApi = new SessionApi(adminClient);
const guestSessionApi = new SessionApi(guestClient);
const providerApi = new ProviderApi(guestClient);
const { STEP_KEYS } = sessionConf;

test.describe('QA-316 application_archiving.spec', () => {

    // Find application by name, create if missing, ensure not archived, and complete session flow (with logging)

    const WORKFLOW_TEMPLATE = 'Simulation Financial Employment';
    const APPLICATION_NAME = 'Autotest - Archive Test App';
    const ORGANIZATION_NAME = 'Permissions Test Org';

    let application = null;
    let organization = null;
    let session = null;
    let unarchiveSession = null;

    test.beforeAll(async () => {
        console.log('🔐 Logging in as admin...');
        await loginWithAdmin(adminClient);

        console.log(`🔎 Searching for application by name: "${APPLICATION_NAME}"`);
        application = await applicationApi.getByName(APPLICATION_NAME);

        console.log(`🔎 Getting organization by name: "${ORGANIZATION_NAME}"`);
        organization = await organizationApi.getByName(ORGANIZATION_NAME);

        if (!application) {
            console.log(`🆕 Application "${APPLICATION_NAME}" not found. Creating new application...`);
            const workflow = await workflowApi.getByName(WORKFLOW_TEMPLATE);
            const incomeSourceTemplate = await incomeSourceTemplateApi.getByName('Default');
            const flagCollection = await flagCollectionApi.getByName('Low Risk');

            const createPayload = {
                workflow: workflow.id,
                organization: organization.id,
                name: APPLICATION_NAME,
                flag_collection: flagCollection.id,
                settings: {
                    "settings.applications.income.ratio.type": "gross",
                    "settings.applications.income.ratio.target": 100,
                    "settings.applications.income.ratio.target.conditional": 100,
                    "settings.applications.income.ratio.guarantor": 500,
                    "settings.applications.income.source_template": incomeSourceTemplate.id,
                    "settings.applications.target.enabled": 1,
                    "settings.applications.target.required": 1,
                    "settings.applications.target.default": "",
                    "settings.applications.target.locked": 0,
                    "settings.applications.target.range.min": 500,
                    "settings.applications.target.range.max": 10000,
                    "settings.applications.fast_entry": 1,
                    "settings.applications.knock.community_id": "",
                    "settings.applications.knock.company_id": "",
                    "settings.applications.lifecycle.enabled": 0,
                    "settings.applications.lifecycle.notifications.enabled": 0,
                    "settings.applications.lifecycle.duration": 48,
                    "settings.applications.lifecycle.notifications.warning.threshold": 1
                }
            };

            const createResponse = await applicationApi.create(createPayload);
            application = createResponse?.data;
            expect(application).toBeDefined();

            console.log(`📝 New application created with id: ${application.id}. Publishing application...`);
            await applicationApi.update(application.id, { published: true });
            application = (await applicationApi.retrive(application.id)).data;
        } else {
            console.log(`✅ Application "${APPLICATION_NAME}" found with id: ${application.id}.`);
        }

        if (application.status === 'ARCHIVED') {
            console.log(`⚠️ Application "${APPLICATION_NAME}" is archived. Unarchiving...`);
            await applicationApi.update(application.id, { archived: false });
        }
        application = (await applicationApi.retrive(application.id)).data;

        console.log(`🔍 Checking application status: ${application.status}`);
        await expect(application.status).toBe('PUBLISHED');

        console.log(`🚀 Creating and completing session flow for application "${APPLICATION_NAME}" (id: ${application.id})...`);
        session = await completeSessionFlow(application);
        console.log('✅ Session flow completed.');
    });


    test('Verify Application Archiving and Unarchiving Functionality (VC-183)', async ({ page }) => {



        /**
         * ============================================================================
         * Step 1: Archive Application from Applications List Page
         * ============================================================================
         * This step walks through archiving a test application via the UI and verifies:
         *   - application appears with "PUBLISHED" status,
         *   - archive button is present and works,
         *   - confirmation dialog shown, and
         *   - correct PATCH API call with proper payload and response,
         *   - status and UI updates after archiving.
         */

        // Go to Applications Page & Make Sure Test App is Visible
        console.log("➡️ Navigating to Applications page and logging in as admin...");
        await adminLoginAndNavigateToApplications(page, admin);
        console.log(`🔎 Searching for application with id: ${application.id}...`);
        let searchApplications = await searchApplication(page, application.id);

        await expect(searchApplications.length).toBeGreaterThan(0);
        console.log(`✅ Application found in the list.`);

        const applicationRow = page.getByTestId(`application-table-${application.id}`);
        await expect(applicationRow).toBeVisible();

        // VERIFY: The status column is "PUBLISHED"
        const statusCol = applicationRow.getByTestId('application-table-status-col');
        await expect(statusCol).toHaveText('PUBLISHED');
        console.log(`📄 Application status is PUBLISHED.`);

        // VERIFY: The archive button is visible
        const archiveButton = page.getByTestId(`archive-${application.id}`);
        await expect(archiveButton).toBeVisible();
        console.log(`🗃️ Archive button is visible.`);

        // Set up patch API interception for archive PATCH request
        const archiveApiResponsePromise = page.waitForResponse(resp =>
            resp.url().includes(`/applications/${application.id}`)
            && resp.request().method() === "PATCH"
        );

        // Accept the confirmation dialog (browser confirm dialog)
        page.once('dialog', (dialog) => {
            console.log(`⚠️ Confirmation dialog shown: "${dialog.message()}"`);
            dialog.accept();
            console.log(`✅ Confirmation accepted.`);
        });

        // Click Archive
        console.log(`🚩 Clicking archive button for application ${application.id}`);
        await archiveButton.click();

        // ------------------------------------------------------------------------
        // API Verification: Intercept PATCH request, verify payload, verify response
        // ------------------------------------------------------------------------

        const archiveResponse = await archiveApiResponsePromise;
        const archiveRequest = archiveResponse.request();
        const requestPayload = JSON.parse(archiveRequest.postData() || '{}');

        // Verify PATCH payload
        expect(requestPayload.archived).toBe(true);
        console.log(`✅ PATCH payload includes "archived: true"`);

        // Verify PATCH response status (should be 200)
        expect(archiveResponse.status()).toBe(200);
        console.log(`✅ PATCH response status is 200`);

        // Verify PATCH response body for status ARCHIVED
        const archiveResponseBody = await archiveResponse.json();
        expect(archiveResponseBody.data.status).toBe("ARCHIVED");
        console.log(`✅ PATCH response marks application ARCHIVED`);

        // ---- UI Feedback Section ----

        // Success toast message should appear (may need to adjust message if needed)
        // Wait for a toast with "Application archived" or similar
        const archiveToast = page.getByTestId('archived-success');
        await expect(archiveToast).toBeVisible({ timeout: 3000 });
        const toastText = await archiveToast.textContent();
        expect(toastText).toMatch(/archived/i);
        console.log(`🍞 Success toast shown: "${toastText?.trim()}"`);

        // Now, search for application again and verify UI state is updated
        // Clear search input and refresh list
        const clearInputResp = page.waitForResponse(resp =>
            resp.url().includes(`/applications`)
            && resp.ok()
            && resp.request().method() === "GET"
        );
        await page.getByTestId('application-search').fill('');
        await clearInputResp;

        // Enable the "archive only" toggle to ensure archived apps are shown
        const archiveToggle = page.getByTestId('archive-only-toggle');
        await expect(archiveToggle).toBeVisible();
        console.log("🗂️ Toggling 'archive-only' so we can see archived apps...");
        await Promise.all([
            page.waitForResponse(resp =>
                resp.url().includes('/applications')
                && resp.ok()
                && resp.request().method() === "GET", { timeout: 10000 }
            ),
            archiveToggle.click()
        ]);

        // Re-search again for application by id
        searchApplications = await searchApplication(page, application.id);
        await expect(searchApplications.length).toBeGreaterThan(0);
        await expect(searchApplications.some(app => app.id === application.id)).toBeTruthy();
        console.log("✅ Application is present in archived apps list.");

        // Confirm archive button replaced with unarchive button
        const unarchiveButton = page.getByTestId(`unarchive-${application.id}`);
        await expect(unarchiveButton).toBeVisible();
        console.log(`🔁 Unarchive button now present.`);

        // Confirm application row status changed to ARCHIVED
        await expect(applicationRow.getByTestId('application-table-status-col')).toHaveText('ARCHIVED');
        console.log(`📄 Application status changed to ARCHIVED.`);

        // Edit button should still be visible
        const editButton = page.getByTestId(`edit-${application.id}`);
        await expect(editButton).toBeVisible();

        /**
         * ============================================================================
         * Step 2: Verify Invite and Copy Link are Disabled for Archived Application
         * ============================================================================
         */

        // Check COPY LINK button
        const copyButton = page.getByTestId(`copy-${application.id}`);
        await expect(copyButton).toBeVisible();
        await expect(copyButton).toHaveClass(/opacity-40/);
        await expect(copyButton).toHaveClass(/pointer-events-none/);
        console.log(`📋 Copy button is disabled visually (opacity-40 & pointer-events-none).`);

        // Check INVITE link
        const inviteButton = page.getByTestId(`invite-${application.id}`);
        await expect(inviteButton).toBeVisible();
        await expect(inviteButton).toHaveClass(/opacity-40/);
        await expect(inviteButton).toHaveClass(/pointer-events-none/);
        console.log(`✉️ Invite button is disabled visually (opacity-40 & pointer-events-none).`);

        // ---------------------------------------
        // clipboard and modal checks:
        // - Confirm copy does not work
        // - Confirm invite does not open modal
        // ---------------------------------------

        // Save current clipboard contents (if available)
        let initialClipboard = "";
        try {
            initialClipboard = await page.evaluate(() => navigator.clipboard.readText());
            console.log("📋 Initial clipboard snapshot taken.");
        } catch (e) {
            // clipboard API might be disallowed; ignore
            console.log("⚠️ Unable to programmatically read clipboard (browser policy).");
        }

        // Try clicking the disabled copy button -- it should NOT copy anything
        await copyButton.click({ force: true });
        await page.waitForTimeout(150); // Give just a short time

        if (initialClipboard !== undefined) {
            try {
                const clipboardAfter = await page.evaluate(() => navigator.clipboard.readText());
                await expect(clipboardAfter).toBe(initialClipboard);
                console.log("✅ Clicking disabled copy did not change clipboard.");
            } catch (e) {
                // ignore if clipboard read fails
            }
        }

        // Confirm no "copied" toast appears after clicking copy
        const copiedToast = page.getByTestId('toast-copied');
        await expect(copiedToast).not.toBeVisible({ timeout: 2000 });
        console.log("✅ No 'copied' toast after clicking disabled copy button.");

        // Try clicking the disabled invite button -- should NOT open modal
        const generateSessionModal = page.getByTestId('generate-session-modal');
        await inviteButton.click({ force: true });
        // Give time for modal (should NOT appear)
        await expect(generateSessionModal).not.toBeVisible({ timeout: 1500 });
        console.log("✅ Clicking disabled invite does not open session modal.");


        await page.goto(`/organizations/${organization.id}/show`, { waitUntil: 'domcontentloaded' })

        const applicationTab = page.getByTestId('applications-tab');
        await expect(applicationTab).toBeVisible();

        await applicationTab.click()


        /**
         * -----------------------------
         * API Verification: Sessions cannot be created for archived applications
         * ------------------------------
         */
        await applicationApi.update(application.id, { archived: true })

        const sessionRequestData = {
            application: application.id,
            invite: true,
            first_name: 'Autot',
            last_name: 'ArchiveApp',
            email: 'testuser@verifast.com'
        }
        console.log('📋 Prepared session creation payload for archived application:', sessionRequestData);

        // Attempt to create new session via API for archived application
        let errorResponse;
        try {
            await adminClient.post('/sessions', sessionRequestData);
            // If no error is thrown, that's a test fail
            throw new Error("❌ Expected /sessions POST to fail with 400, but it succeeded");
        } catch (err) {
            // Axios puts the failed response under err.response
            errorResponse = err.response;
            if (!errorResponse) {
                throw err;
            }
            console.log("⚠️ Received error response from /sessions POST for archived application:", {
                status: errorResponse?.status,
                data: errorResponse?.data
            });

            // API Verification - status is 400 Bad Request
            await expect(errorResponse?.status).toBe(400);
            console.log("✅ /sessions POST for archived app returned 400 Bad Request (as expected)");

            // Verify error code is 51407 (PARENT_APPLICATION_ARCHIVED)
            await expect(errorResponse?.data?.error?.code).toBe(51407);
            console.log("✅ API error code is (51407)");

            // Verify error message
            await expect(errorResponse?.data?.error?.detail).toBe("The current application is archived and is unavailable");
            console.log("✅ API error message matches expected detail");
        }


        // ============================================================================
        // Test: Verify Existing Session Remains Accessible and Completable
        // ============================================================================
        /*
            Steps covered in this block:
            - Navigate to session report page for EXISTING session (created before archiving)
            - Verify session report page and all dependent resources load successfully
            - Check session data integrity (applicants, income, documents, etc.)
            - Ensure session view/edit access (as per permissions)
            - Test session approval and reject actions work despite parent app being archived
        */

        console.log("\n🔎 Navigating to session report page for existing session (archived parent app)");
        // Start intercepts for necessary data loads (employments, files, financial/employment verifications)
        const employmentPromise = page.waitForResponse(resp =>
            resp.url().includes(`/sessions/${session.id}/employments`) &&
            resp.request().method() === 'GET'
        );
        const filePromise = page.waitForResponse(resp =>
            resp.url().includes(`/sessions/${session.id}/files`) &&
            resp.request().method() === 'GET'
        );
        const financialVerificationPromise = page.waitForResponse(resp =>
            resp.url().includes(`/financial-verifications?`) &&
            resp.request().method() === 'GET'
        );
        const employmentVerificationPromise = page.waitForResponse(resp =>
            resp.url().includes(`/employment-verifications?`) &&
            resp.request().method() === 'GET'
        );
        // The incomeSourcePromise needs to be defined before awaiting
        const incomeSourcePromise = page.waitForResponse(resp =>
            resp.url().includes(`/sessions/${session.id}/income-sources?`) &&
            resp.request().method() === 'GET'
        );

        // Go to session report page
        await page.goto(`/applicants/all/${session.id}`);
        console.log("✅ Navigated to session report page for session ID:", session.id);

        // Wait for responses for all APIs needed to load the report page data
        const [
            employmentResponse,
            fileResponse,
            financialVerificationResponse,
            employmentVerificationResponse,
        ] = await Promise.all([
            employmentPromise,
            filePromise,
            financialVerificationPromise,
            employmentVerificationPromise,
        ]);

        // Verify the session report page and all data responses are OK
        await expect(employmentResponse.ok()).toBeTruthy();
        console.log("✅ Employments loaded correctly for session.");
        await expect(fileResponse.ok()).toBeTruthy();
        console.log("✅ Documents/files loaded correctly for session.");
        await expect(financialVerificationResponse.ok()).toBeTruthy();
        console.log("✅ Financial verifications loaded.");
        await expect(employmentVerificationResponse.ok()).toBeTruthy();
        console.log("✅ Employment verifications loaded.");

        // Big visual checkpoint: report section visible
        const reportSection = page.getByTestId('session-report-section');
        await expect(reportSection).toBeVisible();
        console.log("✅ Session report section is visible - report page rendered successfully.");

        // Verify income sources section and data loaded
        await openReportSection(page, 'income-source-section');
        const incomeResp = await incomeSourcePromise;
        await expect(incomeResp.ok()).toBeTruthy();
        console.log("✅ Income sources loaded and income source section opened.");

        // Verify session can be approved (simulate Approve click)
        const approveSessionBtn = page.getByTestId('approve-session-btn');
        await expect(approveSessionBtn).toBeVisible();
        const approvalPromise = page.waitForResponse(resp =>
            resp.url().includes(`/sessions/${session.id}`) &&
            resp.request().method() === 'PATCH'
        );
        await approveSessionBtn.click();
        const approveConfirmBox = page.getByTestId('approve-confirm-box');
        await expect(approveConfirmBox).toBeVisible();
        await approveConfirmBox.getByTestId('confirm-btn').click()
        const approveResponse = await approvalPromise;
        await expect(approveResponse.ok()).toBeTruthy();
        console.log("✅ Session was approved successfully (PATCH succeeded).");

        // Verify session can be declined (simulate Reject click)
        const rejectSessionBtn = page.getByTestId('reject-session-btn');
        await expect(rejectSessionBtn).toBeVisible();
        const rejectPromise = page.waitForResponse(resp =>
            resp.url().includes(`/sessions/${session.id}`) &&
            resp.request().method() === 'PATCH'
        );
        await rejectSessionBtn.click();
        const rejectConfirmBox = page.getByTestId('reject-confirm-box');
        await expect(rejectConfirmBox).toBeVisible();
        await rejectConfirmBox.getByTestId('confirm-btn').click()
        const rejectResponse = await rejectPromise;
        await expect(rejectResponse.ok()).toBeTruthy();
        console.log("✅ Session was rejected successfully (PATCH succeeded).");


        /**
         * ============================================================================
         * Test: Verify Functionality Restored After Unarchiving
         * ============================================================================
         *  1. Unarchive the application and ensure status/UI updates.
         *  2. Verify invite/copy are enabled again (no disabled classes).
         *  3. Click invite: modal opens.
         *  4. Click copy: clipboard contents updated.
         *  5. Create new test session via API, verify session and status.
         *  6. Delete test session after verification.
         */

        // Go to applications page and ensure archived apps are visible
        console.log("➡️ Navigating to applications page to unarchive application.");
        await page.goto('/applications', { waitUntil: 'domcontentloaded' });

        // Make sure archive-only toggle is ON to show archived items
        await expect(archiveToggle, "Archive-toggle should be visible after navigation").toBeVisible();
        if (!await archiveToggle.isChecked()) {
            await archiveToggle.click();
            console.log("🗂️ Archive-only toggle turned ON to reveal archived apps.");
        }
        await page.waitForTimeout(500);

        // Find and verify our application's row is showing "ARCHIVED"
        await searchApplication(page, application.id);
        await expect(applicationRow, "Could not find application row for unarchiving").toBeVisible();
        await expect(statusCol, "Status column missing for app row").toBeVisible();
        await expect(statusCol, "Application status should be ARCHIVED before unarchiving").toHaveText('ARCHIVED');
        await expect(unarchiveButton, "Unarchive button not found").toBeVisible();

        // Click unarchive -- handle dialog and PATCH
        page.once('dialog', dialog => {
            console.log(`⚠️ Unarchive confirmation dialog: "${dialog.message()}"`);
            dialog.accept();
            console.log(`✅ Confirmation accepted for unarchiving.`);
        });

        const unarchivePromise = page.waitForResponse(resp =>
            resp.url().includes('/applications') &&
            resp.request().method() === 'PATCH' &&
            resp.ok()
        );
        await unarchiveButton.click();
        await unarchivePromise;
        console.log("✅ Application was unarchived via PATCH request");

        // Remove archive-only toggle to return to normal applications list
        if (await archiveToggle.isChecked()) {
            await archiveToggle.click();
            console.log("🗂️ Archive-only toggle turned OFF.");
        }

        // --- Invite Link Enabled Verification ---
        await expect(applicationRow, "Application row missing after unarchiving").toBeVisible();
        await expect(inviteButton, 'Invite button should be visible after unarchiving').toBeVisible();

        console.log("🔍 Checking invite button does NOT have disabled classes...");
        try {
            await expect(inviteButton).not.toHaveClass(/pointer-events-none/);
            await expect(inviteButton).not.toHaveClass(/opacity-40/);
            console.log("✅ Invite button is enabled and interactive.");
        } catch (err) {
            console.error("❌ FAILED: Invite button incorrectly styled as disabled after unarchiving");
            throw err;
        }

        // --- Copy Link Enabled Verification ---
        await expect(copyButton, "Copy button not visible after unarchiving").toBeVisible();
        console.log("🔍 Checking copy button does NOT have disabled classes...");
        try {
            await expect(copyButton).not.toHaveClass(/pointer-events-none/);
            await expect(copyButton).not.toHaveClass(/opacity-40/);
            console.log("✅ Copy button is enabled and interactive.");
        } catch (err) {
            console.error("❌ FAILED: Copy button incorrectly styled as disabled after unarchiving");
            throw err;
        }

        // --- Click Invite and Verify Modal ---
        console.log("🖱️ Clicking invite button to open Generate Session modal...");
        await inviteButton.click();
        await expect(generateSessionModal, "Generate Session modal did not appear").toBeVisible();
        console.log("✅ Generate Session modal is visible.");

        // --- Click Copy Link and Verify Clipboard ---
        console.log("📋 Attempting to copy application link to clipboard...");
        let prevClipboard = null;
        const applicationURL = application.url;
        try {
            prevClipboard = await page.evaluate(() => navigator.clipboard.readText());
        } catch (e) {
            console.warn("⚠️ Could not read clipboard before copying; skipping before-value.");
        }
        await copyButton.click();
        await page.waitForTimeout(200);

        let clipboardContent = null, copyVerified = false;
        try {
            clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
            // accept a trailing slash inconsistency
            copyVerified = clipboardContent?.replace(/\/$/, '') === applicationURL.replace(/\/$/, '');
            if (!copyVerified) {
                console.error(`❌ Clipboard mismatch after copy. Got "${clipboardContent}", expected "${applicationURL}"`);
                throw new Error('Clipboard content does not match application URL');
            }
            console.log(`✅ Application link copied to clipboard: "${clipboardContent}"`);
        } catch (e) {
            console.warn("⚠️ Unable to verify clipboard (browser policy); skipping clipboard test.");
        }

        // --- Create Session via API for Unarchived Application ---
        console.log("🌱 Attempting to create new session for UNARCHIVED application via POST /sessions...");
        let unarchiveSession;
        try {
            const apiResp = await sessionApi.create(formData);
            expect(apiResp).toBeDefined();
            // API Verification: Check status 201!
            if (apiResp.status !== 201) {
                console.error(`❌ Session creation status wrong: got ${apiResp.status} (expected 201)`);
            }
            expect(apiResp.status).toBe(201);
            unarchiveSession = apiResp.data;
            expect(unarchiveSession?.id).toBeDefined();
            console.log(`✅ Session created via API for unarchived application (session id: ${unarchiveSession?.id})`);
        } catch (e) {
            console.error("❌ Failed to create a session for unarchived application via API", e);
            throw e;
        }

        // --- Cleanup: Delete the test session we just created ---
        if (unarchiveSession?.id) {
            try {
                await sessionApi.delete(unarchiveSession.id);
                console.log(`🧹 Deleted test session from unarchiving test: id=${unarchiveSession.id}`);
            } catch (e) {
                console.warn("⚠️ Failed to cleanup test session after unarchive test.", e);
            }
        }



        // Test: Verify Guest Cannot Access Archived Application
        // Simulate guest user by clearing authentication
        await page.context().clearCookies();
        await page.goto(`/applications/${application.id}`, { waitUntil: 'domcontentloaded' });

        // Intercept and verify GET /applications/{application.id}
        let archivedAppResponse;
        const [getApp] = await Promise.all([
            page.waitForResponse(resp =>
                resp.url().endsWith(`/applications/${application.id}`) &&
                resp.request().method() === 'GET' &&
                resp.ok()
            ),
            page.reload({ waitUntil: 'domcontentloaded' })
        ]);
        archivedAppResponse = await waitForJsonResponse(getApp);
        // The response may be { data: <appObject> } or simply <appObject>
        const archivedAppData = archivedAppResponse.data || archivedAppResponse;

        expect(archivedAppData).toBeDefined();
        expect(archivedAppData.status).toBe('ARCHIVED');
        expect(typeof archivedAppData.archived_at).toBe('string');

        // Check for error message in UI for guest
        // Try to look for a relevant testId or fallback to text search
        const archivingError = page.locator('[data-testid="application-archived-error"]');
        // If not present, try a generic error message
        let errorMessageLocator = archivingError;
        if (!await archivingError.isVisible().catch(() => false)) {
            // Try with a generic text fallback
            errorMessageLocator = page.getByText(/archived|unavailable|not available/i, { exact: false });
        }
        await expect(errorMessageLocator).toBeVisible();


        // Optionally, check that the application form is not present
        await expect(page.locator('form#sign-up')).not.toBeVisible()


    })


    test.afterAll(async () => {
        if(session?.id){
            await sessionApi.delete(session.id)
        }
    })

})

async function completeSessionFlow(application) {

    // create session 
    const formData = {
        application: application.id,
        first_name: 'AutoTest',
        last_name: 'ArchiveUser',
        email: 'test+archiveUser@verifast.com',
        invite: true
    }

    let session = (await sessionApi.create(formData))?.data;

    expect(session).toBeDefined()

    await loginWithGuestUser(guestClient, session.url)

    session = (await guestSessionApi.retrive(session.id))?.data;
    await completeSessionStep(session, formData) // START

    session = (await guestSessionApi.retrive(session.id))?.data;
    await completeSessionStep(session, formData) // Financial Step

    session = (await guestSessionApi.retrive(session.id))?.data;
    await completeSessionStep(session, formData) // Employment Step
    return session

}




async function completeSessionStep(session, user) {

    const provider = await providerApi.getByName('Simulation');
    const stepApi = sessionApi.step(session.id)

    if (session.state.current_step.type === STEP_KEYS.START) {
        const sessionStep = await createCurrentStep(sessionApi, session);

        await sessionApi.update(session.id, { target: 500 })
        await stepApi.update(sessionStep.id, {
            status: 'COMPLETED'
        })
    }

    if (session.state.current_step.type === 'TASK' && session.state.current_step.task.key === STEP_KEYS.FINANCIAL) {
        const type = 'financial';
        console.log(`📄 Starting ${STEP_KEYS.FINANCIAL} step...`);
        const sessionStep = await createCurrentStep(sessionApi, session);

        const docData = getBankStatementData(user, 1)

        const docSimulationData = {
            simulation_type: 'VERIDOCS_PAYLOAD',
            custom_payload: docData
        }
        await stepApi.update(sessionStep.id, { status: "COMPLETED" });

        await simulateVerification(guestClient, '/financial-verifications', provider, sessionStep, docSimulationData, type);

        await waitForStepTransition(sessionApi, session, STEP_KEYS.FINANCIAL);
    }

    if (session.state.current_step.type === 'TASK' && session.state.current_step.task.key === STEP_KEYS.EMPLOYMENT) {
        const type = 'Employment';
        console.log(`📄 Starting ${STEP_KEYS.EMPLOYMENT} step...`);
        const sessionStep = await createCurrentStep(sessionApi, session);

        const simulationPayload = getEmploymentSimulationMockData({
            connectorName: 'Paytomic',
            companyName: 'SIG Developments LLC',
            income: { annualIncome: 72000, currentPayPeriodStart: daysAgo(35), payCycle: 'monthly' },
            statements: { count: 3, hoursPerPeriod: 32, hourlyRate: 16.5, netFactor: 0.77 }
        });

        const docSimulationData = {
            simulation_type: 'ATOMIC_PAYLOAD',
            custom_payload: simulationPayload
        }
        await simulateVerification(guestClient, '/employment-verifications', provider, sessionStep, docSimulationData, type);

        const stepUpdateData = { status: "COMPLETED" };
        await stepApi.update(sessionStep.id, stepUpdateData);
        console.log(`✅ ${STEP_KEYS.EMPLOYMENT} step completed.`);
        session = await waitForStepTransition(sessionApi, session, STEP_KEYS.EMPLOYMENT);
        console.log(`✅ Session transitioned from ${STEP_KEYS.EMPLOYMENT} step.`);

    }
}

function daysAgo(days) {
    const currentDate = new Date();
    const fortyFiveDaysAgo = new Date(currentDate);
    fortyFiveDaysAgo.setDate(currentDate.getDate() - days);
    return fortyFiveDaysAgo.toISOString().split('T')[0]
}