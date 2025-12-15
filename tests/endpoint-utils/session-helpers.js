import { expect } from "@playwright/test";
import { generateUUID, wait } from "../utils/helper";

// Helper: creates the current step for the given session and returns it
async function createCurrentStep(sessionApi, session) {
    const stepData = { step: session.state.current_step.id };
    const created = (await sessionApi.step(session.id).create(stepData)).data;
    return created;
}


async function simulateVerification(guestClient, verificationUrl, provider, step, simulationData, type) {
    console.log(`✅ Simulation provider found: ${provider.id}`);
    const uploadData = {
        step: step.id,
        provider: provider.id,
        ...simulationData
    };

    console.log(`⏳ Uploading ${simulationData.simulation_type} payload for ${type} verification...`);
    console.log('📊 Payload being sent:', JSON.stringify(simulationData.custom_payload, null, 2));

    const response = (await guestClient.post(verificationUrl, uploadData)).data;

    console.log(`✅ Session transitioned from ${type} step.`);
    console.log(`✅ ${simulationData.simulation_type} payload uploaded for ${type} verification.`);
    await waitForVerificationComplete(guestClient, verificationUrl, step, response.data, simulationData, type);
}

async function waitForVerificationComplete(guestClient, verificationUrl, step, verification, simulationData, type, maxAttempts = 15,) {
    console.log(`📊 Created verification ID: ${verification.id}`);

    const filters = JSON.stringify({ $has: { step: { id: step.id } }, status: { $neq: "EXPIRED" } });

    let verifications, count = 0;
    console.log(`⏳ Waiting for ${type} ${simulationData.simulation_type} verification to complete...`);
    await wait(10000);

    do {
        verifications = (await guestClient.get(verificationUrl, { params: { filters } })).data.data;
        console.log(`📊 Found ${verifications.length} verifications for step ${step.id}`);

        // Log all verification statuses for debugging
        verifications.forEach(v => {
            console.log(`   - Verification ${v.id}: ${v.status} (Target: ${verification.id})`);
        });

        // Check if our verification exists and get its status
        const ourVerification = verifications.find((v) => v.id === verification.id);
        if (ourVerification) {
            console.log(`🎯 Our verification ${verification.id} current status: ${ourVerification.status}`);

            // If it's COMPLETED, break immediately
            if (ourVerification.status === "COMPLETED") {
                console.log(`✅ Our verification completed successfully!`);
                break;
            }

            // If it's in error state, break immediately to fail the test
            if (ourVerification.status === "USER_ERROR" || ourVerification.status === "FAILED") {
                console.log(`❌ Our verification failed with status: ${ourVerification.status}`);
                break;
            }
        } else {
            console.log(`❌ Our verification ${verification.id} not found in current verifications`);
        }

        await wait(4000);
        count++;
        console.log(`⏳ Polling ${type} ${simulationData.simulation_type} verification... attempt ${count}/15`);
    } while (count < maxAttempts);

    console.log('📄 Analyzing verification results...');

    // Find OUR specific verification (the one we created)
    const ourVerification = verifications.find((v) => v.id === verification.id);

    if (!ourVerification) {
        console.log(`❌ ${type} ${simulationData.simulation_type} verification not found.`);
        console.log('📊 All verifications found:');
        verifications.forEach(v => console.log(`   - ${v.id}: ${v.status}`));
        throw new Error(`❌ ${type} verification (${simulationData.simulation_type}) not found - test should fail`);
    }

    console.log(`🎯 Our verification ${verification.id} final status: ${ourVerification.status}`);

    // Only pass if OUR verification is COMPLETED
    if (ourVerification.status === "COMPLETED") {
        console.log(`✅ ${type} ${simulationData.simulation_type} verification completed successfully.`);
        console.log('✅ Completed verification details:', JSON.stringify(ourVerification, null, 2));
    } else if (ourVerification.status === "PROCESSING") {
        console.log(`❌ ${type} ${simulationData.simulation_type} verification stuck in PROCESSING status.`);
        console.log('❌ Processing verification details:', JSON.stringify(ourVerification, null, 2));
        throw new Error(`❌ ${type} verification (${simulationData.simulation_type}) stuck in PROCESSING status - test should fail`);
    } else if (ourVerification.status === "USER_ERROR") {
        console.log(`❌ ${type} ${simulationData.simulation_type} verification failed with USER_ERROR status.`);
        console.log('❌ User error verification details:', JSON.stringify(ourVerification, null, 2));
        throw new Error(`❌ ${type} verification (${simulationData.simulation_type}) failed with USER_ERROR status - test should fail`);
    } else if (ourVerification.status === "FAILED") {
        console.log(`❌ ${type} ${simulationData.simulation_type} verification failed.`);
        console.log('❌ Failed verification details:', JSON.stringify(ourVerification, null, 2));
        throw new Error(`❌ ${type} verification (${simulationData.simulation_type}) failed`);
    } else {
        console.log(`❌ ${type} ${simulationData.simulation_type} verification in unexpected status: ${ourVerification.status}`);
        console.log('❌ Verification details:', JSON.stringify(ourVerification, null, 2));
        throw new Error(`❌ ${type} verification (${simulationData.simulation_type}) in unexpected status: ${ourVerification.status} - test should fail`);
    }

    console.log('✅ Verification analysis completed');
}

async function waitForStepTransition(sessionApi, session, fromKey, maxAttempts = 15) {
    try {
        let count = 0;
        do {
            session = (await sessionApi.retrive(session.id)).data;
            if (session.state.current_step?.task?.key === fromKey) {
                await wait(2000);
            }
            count++;
        } while (session.state.current_step?.task?.key === fromKey && count < maxAttempts);
        return session;
    } catch (error) {
        console.log("Error in waitForStepTransition", JSON.stringify({
            file: "tests/flag_review_buttons_flow.spec.js",
            function: "waitForStepTransition",
            error: error.message,
            stack: error.stack
        }));

        throw error;
    }
}

/**
 * 
* @param  guestClient 
 * @param  sessionUrl 
 * @param   
 */
async function loginWithGuestUser(guestClient, sessionUrl) {
    try {
        const inviteUrl = new URL(sessionUrl);
        const token = inviteUrl.searchParams.get('token');
        console.log("Logging in with invitation token");
        guestClient.resetAuthToken()
        const guestLoginResponse = await guestClient.post('/auth/guests', {
            token,
            uuid: generateUUID(),
            os: 'web'
        })
        const authToken = guestLoginResponse.data.data.token;
        guestClient.setAuthToken(authToken);
        console.log("✅ Login successful");
    } catch (error) {
        console.error("Error in loginWithTokenUrl " + JSON.stringify({
            file: "tests/helpers/session-step-helper.js",
            function: "loginWithTokenUrl",
            error: error.message,
            stack: error.stack
        }));

        throw error;
    }
}

async function inviteUser(adminSessionApi, application, user) {
    const sessionResponse = await adminSessionApi.create({
        ...user,
        invite: true,
        application: application.id
    })

    const session = sessionResponse.data;
    await expect(session).toBeDefined()

    return session;
}

async function createSession(adminClient, user, applicationId) {
    try {
        console.log('[createSession] Initiating session creation...');
        const payload = {
            ...user,
            application: applicationId,
            invite: true
        };
        console.log('[createSession] Payload:', payload);

        const sessionResponse = await adminClient.post('/sessions', payload);
        const session = sessionResponse.data.data;
        console.log('[createSession] Extracted session:', session?.id);

        return session;
    } catch (error) {
        console.error("❌ Error in createSession", error.message, error.stack);
        throw error;
    }
}

async function getSession(apiClient, sessionId, fields = null) {
    try {
        console.log('[getSession] Fetching session data...');
        const sessionFields = {
            session_step: ':all',
            session: 'state,applicant,application,children,target,parent,completion_status,actions,flags,type,role,stakeholder_count',
            applicant: 'guest',
            guest: ':all',
            application: 'name,settings,workflow,eligibility_template',
            workflow_step: ':all'
        }

        const usedFields = fields ? fields : sessionFields;
        console.log(`[getSession] sessionId: ${sessionId}`);

        const response = await apiClient.get(`/sessions/${sessionId}`, { fields: usedFields })

        console.log('[getSession] Session data received:', response?.data?.data?.id || '[No ID]');
        return response.data.data;
    } catch (error) {
        console.error("❌ Error in getSession", error.message, error.stack);
        throw error;
    }
}



export {
    createCurrentStep,
    simulateVerification,
    waitForVerificationComplete,
    waitForStepTransition,
    loginWithGuestUser,
    inviteUser,
    createSession,
    getSession
}
