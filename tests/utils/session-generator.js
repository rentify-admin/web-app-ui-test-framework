/**
 * Session Generator for Permission Tests
 * 
 * Creates a complete session with:
 * - Real ID verification (Persona UI) → gets real images
 * - Financial verification (VERIDOCS_PAYLOAD) → bank statement document with matching name
 * - Employment verification (ATOMIC_PAYLOAD) → employment data with matching name
 * 
 * All simulator payloads match user name for proper validation
 */

import { admin, app } from '~/tests/test_config';
import generateSessionForm from '~/tests/utils/generate-session-form';
import loginForm from '~/tests/utils/login-form';
import { findAndInviteApplication, gotoApplicationsPage } from '~/tests/utils/applications-page';
import { joinUrl } from '~/tests/utils/helper';
import { 
    setupInviteLinkSession,
    identityStep,
    fillhouseholdForm
} from '~/tests/utils/session-flow';
import { 
    getPersonaPayload,
    getVeridocsBankStatementPayload,
    getAtomicEmploymentPayload
} from '../mock-data/permission-test-simulators';

/**
 * Creates a session for permission/heartbeat tests
 * 
 * @param {Page} adminPage - Admin page for session creation
 * @param {Browser} browser - Browser for applicant context
 * @param {object} options - Configuration options
 * @param {string} options.applicationName - Application name (default: "Autotest - UI permissions tests")
 * @param {string} options.firstName - User first name (default: "Permission")
 * @param {string} options.lastName - User last name (default: "Test")
 * @param {string} options.email - User email (default: auto-generated)
 * @param {string} options.rentBudget - Rent budget (default: "2000")
 * @param {boolean} options.completeIdentity - Complete identity step (default: true)
 * @param {boolean} options.completeFinancial - Complete financial step (default: true)
 * @param {boolean} options.completeEmployment - Complete employment step (default: true)
 * @param {boolean} options.addChildApplicant - Add child applicant (default: true)
 * @returns {Promise<{ sessionId: string, userData: object, applicantContext: BrowserContext }>}
 */
export async function createPermissionTestSession(adminPage, browser, options = {}) {
    const {
        applicationName = 'Autotest - UI permissions tests',
        firstName = 'Permission',
        lastName = 'Test',
        email = `perm-test-${Date.now()}@verifast.com`,
        rentBudget = '2000',
        // ✅ NEW: Control which steps to complete
        completeIdentity = true,
        completeFinancial = true,
        completeEmployment = true,
        addChildApplicant = true
    } = options;
    
    const userData = {
        first_name: firstName,
        last_name: lastName,
        email: email
    };
    
    console.log('🏗️ Creating complete permission test session...');
    console.log(`   📝 User: ${userData.first_name} ${userData.last_name}`);
    console.log(`   📧 Email: ${userData.email}`);
    console.log(`   🏢 Application: ${applicationName}`);
    
    // ============================================================
    // PHASE 1: Admin Login and Navigate to Application
    // ============================================================
    console.log('\n🔑 PHASE 1A: Admin login and navigation...');
    await loginForm.adminLoginAndNavigate(adminPage, admin);
    console.log('✅ Admin logged in');
    
    console.log('🗂️  Navigating to applications page...');
    await gotoApplicationsPage(adminPage);
    console.log('✅ On applications page');
    
    console.log(`🔍 Finding and inviting application: ${applicationName}...`);
    await findAndInviteApplication(adminPage, applicationName);
    console.log('✅ Application invite modal opened');
    
    // ============================================================
    // PHASE 1B: Create Session via Generate Form
    // ============================================================
    console.log('\n📋 PHASE 1B: Generating session...');
    const { sessionId, link } = await generateSessionForm
        .generateSessionAndExtractLink(adminPage, userData);
    console.log(`✅ Session created: ${sessionId}`);
    
    // ============================================================
    // PHASE 2: Complete Steps via Applicant Flow
    // ============================================================
    console.log('\n🎭 PHASE 2: Opening applicant flow...');
    const context = await browser.newContext();
    const applicantPage = await context.newPage();
    
    const linkUrl = new URL(link);
    await applicantPage.goto(joinUrl(app.urls.app, `${linkUrl.pathname}${linkUrl.search}`));
    await applicantPage.waitForTimeout(3000); // Wait for page to load
    console.log('✅ Applicant page opened');
    
    // Step 1-3: Setup session flow (dynamic based on applicant type detection)
    console.log('\n🔍 Setting up session flow (detecting applicant type dynamically)...');
    
    // First, check if applicant type page will appear
    const applicantTypePage = applicantPage.getByTestId('applicant-type-page');
    const hasApplicantTypePage = await applicantTypePage.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (hasApplicantTypePage) {
        // Pattern 1: WITH applicant type
        console.log('   📋 Detected applicant type page - using Pattern 1');
        await setupInviteLinkSession(applicantPage, {
            sessionUrl: link,
            applicantTypeSelector: '#affordable_primary'  // Default for this generator
        });
    } else {
        // Pattern 2: NO applicant type
        console.log('   📋 No applicant type page - using Pattern 2');
        await setupInviteLinkSession(applicantPage);
    }
    console.log('✅ Session setup complete');
    
    // Step 3: START Step - Set Rent Budget
    console.log(`\n💰 Setting rent budget: $${rentBudget}...`);
    
    // Wait for rent budget page to be visible
    await applicantPage.locator('input#rent_budget').waitFor({ state: 'visible', timeout: 10000 });
    await applicantPage.locator('input#rent_budget').fill(rentBudget);
    
    await Promise.all([
        applicantPage.waitForResponse(resp => 
            resp.url() === joinUrl(app.urls.api, `sessions/${sessionId}`) &&
            resp.request().method() === 'PATCH' &&
            resp.ok()
        ),
        applicantPage.locator('button[type="submit"]').click()
    ]);
    console.log('✅ Rent budget set');
    
    // ✅ Check if this is a minimal session (no steps to complete)
    const isMinimalSession = !completeIdentity && !completeFinancial && !completeEmployment && !addChildApplicant;
    
    if (isMinimalSession) {
        // ✅ Minimal session - stop here (don't navigate to applicant invite step)
        console.log('\n⏭️  Minimal session requested - stopping after rent budget');
        console.log('   ℹ️  Applicant invite step requires adding at least one person to continue');
        console.log('   ℹ️  Skipping all remaining steps');
        
        await applicantPage.close();
        
        console.log('\n✅ MINIMAL SESSION CREATION COMPLETED!');
        console.log(`   🆔 Session ID: ${sessionId}`);
        console.log(`   👤 Primary: ${userData.first_name} ${userData.last_name}`);
        console.log(`   💰 Rent Budget: $${rentBudget}`);
        console.log(`   ✅ Session ready for PDF export or other basic operations`);
        console.log(`   ⚠️  Remember to close the applicant context in test cleanup!`);
        
        return { sessionId, userData, applicantContext: context };
    }
    
    // Step 4: APPLICANTS Step - Add one child applicant (REQUIRED if continuing)
    let childData = null;
    if (addChildApplicant) {
        console.log('\n👥 Adding child applicant...');
        await applicantPage.getByTestId('applicant-invite-step').waitFor({ state: 'visible' });
        
        childData = {
            first_name: `${firstName} Child`,
            last_name: lastName,
            email: `child-${Date.now()}@verifast.com`
        };
        
        console.log(`   Adding child: ${childData.first_name} ${childData.last_name}`);
        await fillhouseholdForm(applicantPage, childData);
        await applicantPage.waitForTimeout(800);
        
        // Click continue to add child
        await applicantPage.locator('[data-testid="applicant-invite-continue-btn"]:visible').click({ timeout: 18000 });
        await applicantPage.waitForTimeout(2000);
        console.log('✅ Child applicant added to household');
    } else {
        // ⚠️  If we reach here, we MUST complete at least identity step
        // Cannot skip applicant invite without adding someone
        console.log('\n👥 No child applicant requested, but must add primary to continue...');
        await applicantPage.getByTestId('applicant-invite-step').waitFor({ state: 'visible' });
        
        // Add the primary applicant as the household member to enable continue
        const primaryData = {
            first_name: firstName,
            last_name: lastName,
            email: `primary-${Date.now()}@verifast.com`
        };
        
        console.log(`   Adding primary as household member to enable continue`);
        await fillhouseholdForm(applicantPage, primaryData);
        await applicantPage.waitForTimeout(800);
        
        await applicantPage.locator('[data-testid="applicant-invite-continue-btn"]:visible').click({ timeout: 18000 });
        await applicantPage.waitForTimeout(2000);
        console.log('✅ Primary added to household, continuing...');
    }
    
    // Step 5: IDENTITY Step - Real UI via Persona (OPTIONAL)
    if (completeIdentity) {
        console.log('\n📸 IDENTITY STEP: Completing via Persona UI (real images)...');
        await identityStep(applicantPage);
        console.log('✅ Identity verification completed with REAL IMAGES');
    } else {
        console.log('\n⏭️  Skipping identity verification...');
    }
    
    // Only get auth token and complete steps if needed
    if (completeFinancial || completeEmployment) {
        // Get guest auth token for API calls
        console.log('\n🔑 Getting guest authentication token...');
        const guestToken = linkUrl.searchParams.get('token');
        const generateUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
            .replace(/[xy]/g, c => {
                const r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });
        
        const authResponse = await applicantPage.request.post(`${app.urls.api}/auth/guests`, {
            data: { token: guestToken, uuid: generateUUID(), os: 'web' }
        });
        const auth = await authResponse.json();
        const authToken = auth.data.token;
        console.log('✅ Guest authenticated');
        
        // Step 6: FINANCIAL Step (OPTIONAL)
        if (completeFinancial) {
            // Wait for step transition to Financial
            console.log('\n⏳ Waiting for transition to Financial step...');
            await waitForStepTransition(applicantPage, sessionId, authToken, 'FINANCIAL_VERIFICATION');
            console.log('✅ On Financial Verification step');
            
            console.log('\n💳 FINANCIAL STEP: Completing via VERIDOCS_PAYLOAD (API)...');
            await completeFinancialStepViaVeridocs(applicantPage, context, sessionId, authToken, userData);
            console.log('✅ Financial verification completed with bank statement document (6 transactions, 3 employment income)');
        } else {
            console.log('\n⏭️  Skipping financial verification...');
        }
        
        // Step 7: EMPLOYMENT Step (OPTIONAL)
        if (completeEmployment) {
            // Wait for step transition to Employment
            console.log('\n⏳ Waiting for transition to Employment step...');
            await waitForStepTransition(applicantPage, sessionId, authToken, 'EMPLOYMENT_VERIFICATION');
            console.log('✅ On Employment Verification step');
            
            console.log('\n💼 EMPLOYMENT STEP: Completing via ATOMIC_PAYLOAD (API)...');
            await completeEmploymentStepViaAtomic(applicantPage, context, sessionId, authToken, userData);
            console.log('✅ Employment verification completed with employment document');
        } else {
            console.log('\n⏭️  Skipping employment verification...');
        }
    } else {
        console.log('\n⏭️  Skipping all API-based verifications (financial & employment)...');
    }
    
    // ✅ Cleanup applicant page but KEEP context open for caller to close
    // (prevents Playwright tracing errors)
    await applicantPage.close();
    // await context.close();  // ❌ Don't close here - let caller close it!
    
    console.log('\n✅ SESSION CREATION COMPLETED!');
    console.log(`   🆔 Session ID: ${sessionId}`);
    console.log(`   👤 Primary: ${userData.first_name} ${userData.last_name}`);
    if (childData) {
        console.log(`   👶 Child: ${childData.first_name} ${childData.last_name}`);
    }
    console.log(`   ✅ Completed steps: Identity=${completeIdentity}, Financial=${completeFinancial}, Employment=${completeEmployment}`);
    console.log(`   ✅ Has child applicant: ${addChildApplicant}`);
    console.log(`   ⚠️ Remember to close the applicant context in test cleanup!`);
    
    return { sessionId, userData, applicantContext: context };  // ✅ Return context
}

/**
 * Retry helper for API calls with exponential backoff
 * Handles transient 500 errors by retrying with increasing delays
 */
async function retryApiCall(apiCallFn, options = {}) {
    const {
        maxRetries = 3,
        initialDelayMs = 1000,
        backoffMultiplier = 2,
        expectedStatuses = [200, 201],
        operationName = 'API call'
    } = options;
    
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`   🔄 ${operationName} - Attempt ${attempt}/${maxRetries}`);
            
            const response = await apiCallFn();
            const status = response.status();
            
            // Check if response has expected status
            if (expectedStatuses.includes(status)) {
                const data = await response.json();
                
                // Validate response structure
                if (!data.data) {
                    throw new Error(`Invalid response structure: missing 'data' field. Response: ${JSON.stringify(data)}`);
                }
                
                console.log(`   ✅ ${operationName} succeeded (status: ${status})`);
                return { response, data };
            }
            
            // Unexpected status code - get error details
            const errorData = await response.json();
            const errorMsg = `${operationName} failed with status ${status}: ${JSON.stringify(errorData)}`;
            
            // For 500 errors, retry
            if (status === 500 && attempt < maxRetries) {
                console.log(`   ⚠️ ${errorMsg}`);
                const delayMs = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
                console.log(`   ⏳ Retrying in ${delayMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
                continue;
            }
            
            // For other errors or last attempt, throw
            throw new Error(errorMsg);
            
        } catch (error) {
            lastError = error;
            
            // If it's our custom error or last attempt, throw it
            if (error.message.includes(operationName) || attempt === maxRetries) {
                throw error;
            }
            
            // Otherwise it's a network/parse error - retry
            console.log(`   ⚠️ ${operationName} error: ${error.message}`);
            if (attempt < maxRetries) {
                const delayMs = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
                console.log(`   ⏳ Retrying in ${delayMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }
    
    throw lastError || new Error(`${operationName} failed after ${maxRetries} attempts`);
}

/**
 * Waits for session to transition to expected step
 */
async function waitForStepTransition(page, sessionId, authToken, expectedStep, maxAttempts = 30) {
    console.log(`   Waiting for step: ${expectedStep} (max ${maxAttempts}s)...`);
    
    for (let i = 0; i < maxAttempts; i++) {
        const response = await page.request.get(`${app.urls.api}/sessions/${sessionId}`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const session = await response.json();
        const currentStep = session.data.state.current_step;
        
        if (currentStep.type === expectedStep || currentStep.task?.key === expectedStep) {
            console.log(`   ✅ Step transitioned to ${expectedStep}`);
            return session;
        }
        
        if (i % 5 === 0) {
            console.log(`   ⏳ Still on ${currentStep.type}, waiting... (${i + 1}/${maxAttempts})`);
        }
        
        await page.waitForTimeout(1000);
    }
    
    throw new Error(`Step did not transition to ${expectedStep} within ${maxAttempts} seconds`);
}

/**
 * Completes Financial step via VERIDOCS_PAYLOAD
 * Creates bank statement document with matching user name
 */
async function completeFinancialStepViaVeridocs(page, context, sessionId, authToken, userData) {
    console.log('   📄 Generating VERIDOCS_PAYLOAD bank statement data...');
    const bankStatementPayload = getVeridocsBankStatementPayload(userData);
    const accountOwner = bankStatementPayload.documents[0].documents[0].data.accounts[0].account_owners[0].name;
    const transactionCount = bankStatementPayload.documents[0].documents[0].data.accounts[0].transactions.length;
    console.log(`   ✅ Bank statement generated for: ${accountOwner}`);
    console.log(`   💵 Transactions: ${transactionCount}`);
    
    // Get current session to get step ID
    const sessionResponse = await page.request.get(`${app.urls.api}/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
    });
    const session = await sessionResponse.json();
    const currentStepId = session.data.state.current_step.id;
    
    // Create session step with retry logic
    console.log('   📝 Creating financial session step...');
    const { data: stepData } = await retryApiCall(
        () => page.request.post(
            `${app.urls.api}/sessions/${sessionId}/steps`,
            {
                headers: { Authorization: `Bearer ${authToken}` },
                data: { step: currentStepId }
            }
        ),
        {
            maxRetries: 3,
            expectedStatuses: [200, 201],
            operationName: 'Create financial step'
        }
    );
    const step = stepData;
    console.log(`   ✅ Financial step created: ${step.data.id}`);
    
    // Get Simulation provider
    console.log('   🔍 Getting Simulation provider...');
    const providersResponse = await page.request.get(`${app.urls.api}/providers`, {
        headers: { Authorization: `Bearer ${authToken}` }
    });
    const providers = await providersResponse.json();
    const simulationProvider = providers.data.find(p => p.name === 'Simulation');
    
    if (!simulationProvider) {
        throw new Error('Simulation provider not found');
    }
    console.log(`   ✅ Simulation provider: ${simulationProvider.id}`);
    
    // Create financial verification with VERIDOCS_PAYLOAD
    console.log('   🚀 Uploading bank statement via VERIDOCS_PAYLOAD...');
    const verificationResponse = await page.request.post(
        `${app.urls.api}/financial-verifications`,
        {
            headers: { Authorization: `Bearer ${authToken}` },
            data: {
                step: step.data.id,
                provider: simulationProvider.id,
                simulation_type: 'VERIDOCS_PAYLOAD',
                custom_payload: bankStatementPayload
            }
        }
    );
    
    if (!verificationResponse.ok()) {
        const errorData = await verificationResponse.json();
        throw new Error(`Financial verification failed: ${JSON.stringify(errorData)}`);
    }
    
    const verification = await verificationResponse.json();
    console.log(`   ✅ Verification created: ${verification.data.id}`);
    
    // Wait for verification to complete
    console.log('   ⏳ Waiting for verification to complete...');
    await waitForVerificationComplete(context, authToken, verification.data.id, 'financial-verifications');
    console.log('   ✅ Financial verification COMPLETED');
    
    // ✅ Mark step as COMPLETED to trigger transition
    console.log('   📝 Marking financial step as COMPLETED...');
    await context.request.patch(
        `${app.urls.api}/sessions/${sessionId}/steps/${step.data.id}`,
        {
            headers: { Authorization: `Bearer ${authToken}` },
            data: { status: 'COMPLETED' }
        }
    );
    console.log('   ✅ Financial step marked as COMPLETED');
}

/**
 * Completes Employment step via ATOMIC_PAYLOAD
 * Creates employment document with matching user name
 */
async function completeEmploymentStepViaAtomic(page, context, sessionId, authToken, userData) {
    console.log('   📄 Generating ATOMIC_PAYLOAD employment data...');
    const employmentPayload = getAtomicEmploymentPayload(userData);
    const employeeName = `${employmentPayload.FETCH_EMPLOYMENT_IDENTITY.response.data[0].identity.firstName} ${employmentPayload.FETCH_EMPLOYMENT_IDENTITY.response.data[0].identity.lastName}`;
    console.log(`   ✅ Employment data generated for: ${employeeName}`);
    
    // Get current session to get step ID
    const sessionResponse = await page.request.get(`${app.urls.api}/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
    });
    const session = await sessionResponse.json();
    const currentStepId = session.data.state.current_step.id;
    
    // Create session step with retry logic
    console.log('   📝 Creating employment session step...');
    const { data: stepData } = await retryApiCall(
        () => page.request.post(
            `${app.urls.api}/sessions/${sessionId}/steps`,
            {
                headers: { Authorization: `Bearer ${authToken}` },
                data: { step: currentStepId }
            }
        ),
        {
            maxRetries: 3,
            expectedStatuses: [200, 201],
            operationName: 'Create employment step'
        }
    );
    const step = stepData;
    console.log(`   ✅ Employment step created: ${step.data.id}`);
    
    // Get Simulation provider
    console.log('   🔍 Getting Simulation provider...');
    const providersResponse = await page.request.get(`${app.urls.api}/providers`, {
        headers: { Authorization: `Bearer ${authToken}` }
    });
    const providers = await providersResponse.json();
    const simulationProvider = providers.data.find(p => p.name === 'Simulation');
    
    if (!simulationProvider) {
        throw new Error('Simulation provider not found');
    }
    console.log(`   ✅ Simulation provider: ${simulationProvider.id}`);
    
    // Create employment verification with ATOMIC_PAYLOAD
    console.log('   🚀 Uploading employment data via ATOMIC_PAYLOAD...');
    const verificationResponse = await page.request.post(
        `${app.urls.api}/employment-verifications`,
        {
            headers: { Authorization: `Bearer ${authToken}` },
            data: {
                step: step.data.id,
                provider: simulationProvider.id,
                simulation_type: 'ATOMIC_PAYLOAD',
                custom_payload: employmentPayload
            }
        }
    );
    
    if (!verificationResponse.ok()) {
        const errorData = await verificationResponse.json();
        throw new Error(`Employment verification failed: ${JSON.stringify(errorData)}`);
    }
    
    const verification = await verificationResponse.json();
    console.log(`   ✅ Verification created: ${verification.data.id}`);
    
    // Wait for verification to complete
    console.log('   ⏳ Waiting for verification to complete...');
    await waitForVerificationComplete(context, authToken, verification.data.id, 'employment-verifications');
    console.log('   ✅ Employment verification COMPLETED');
    
    // ✅ Mark step as COMPLETED to finish session
    console.log('   📝 Marking employment step as COMPLETED...');
    await context.request.patch(
        `${app.urls.api}/sessions/${sessionId}/steps/${step.data.id}`,
        {
            headers: { Authorization: `Bearer ${authToken}` },
            data: { status: 'COMPLETED' }
        }
    );
    console.log('   ✅ Employment step marked as COMPLETED');
}

/**
 * Waits for verification to reach COMPLETED status
 * ✅ FIX: Use context.request instead of page.request to avoid "disposed" errors
 * Reduced polling: 20 attempts × 3s = 60s max (reasonable for simulators)
 */
async function waitForVerificationComplete(context, authToken, verificationId, endpoint, maxAttempts = 20) {
    for (let i = 0; i < maxAttempts; i++) {
        const response = await context.request.get(
            `${app.urls.api}/${endpoint}/${verificationId}`,
            {
                headers: { Authorization: `Bearer ${authToken}` }
            }
        );
        const verification = await response.json();
        const status = verification.data.status;
        
        if (status === 'COMPLETED') {
            console.log(`   ✅ Verification COMPLETED after ${(i + 1) * 3}s`);
            return verification;
        }
        
        if (status === 'FAILED' || status === 'EXPIRED') {
            throw new Error(`Verification failed with status: ${status}`);
        }
        
        if (i % 3 === 0) {
            console.log(`   ⏳ Verification status: ${status}, waiting... (${i + 1}/${maxAttempts})`);
        }
        
        // ✅ Use context method, not page
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    throw new Error(`Verification did not complete within ${maxAttempts * 3} seconds`);
}

