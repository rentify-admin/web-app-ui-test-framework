import { expect, test } from "@playwright/test";
import { loginWith } from "./utils/session-utils";
import { admin, app, session } from "./test_config";
import { ApiClient } from "./api";
import { loginWithAdmin } from "./endpoint-utils/auth-helper";
import { getRandomEmail } from "./utils/helper";
import { loginWithGuestUser, simulateVerification } from "./endpoint-utils/session-helpers";
import { personaConnectData } from "./mock-data/identity-payload";
import { customVeriDocsBankStatementData } from "./mock-data/bank-statement-veridocs-payload";
import { createPaystubData } from "./mock-data/paystub-payload";


const SESSION_FIELDS = {
    'fields[session_step]': ':all',
    'fields[session]': 'state,applicant,application,children,target,parent,completion_status,actions,flags,type,role,stakeholder_count,expires_at,extensions',
    'fields[applicant]': 'guest',
    'fields[guest]': ':all',
    'fields[application]': 'name,settings,workflow,eligibility_template,logo',
    'fields[workflow_step]': ':all'
}

test.describe('QA-280 applicant_inbox_filters_internal_users.spec', () => {

    /**
     * Apps
     * Autotest - Application Heartbeat (Frontend)
     * Autotest - Heartbeat Test - Employment - 
     * Autotest - Simulation Upload
     * Autotest - Heartbeat Test - ID
     * AutoTest - Id Emp Fin
     */
    let adminClient;
    let guestClient;

    const APPs = {
        app1: 'Autotest - Application Heartbeat (Frontend)',
        app2: 'Autotest - Heartbeat Test - Employment',
        app3: 'Autotest - Heartbeat Test - ID',
        app4: 'Autotest - Simulation Upload',
        app5: 'AutoTest - Id Emp Fin',
    }
    let applications;

    const session1Data = {
        session: {}
    }


    test.beforeAll(async () => {
        console.log("[beforeAll] Initializing ApiClients...");
        adminClient = new ApiClient(app.urls.api, null, 120_000)
        guestClient = new ApiClient(app.urls.api, null, 120_000)

        console.log("[beforeAll] Logging in as admin...");
        await loginWithAdmin(adminClient)

        console.log("[beforeAll] Fetching applications...");
        const applicationResponse = await adminClient.get('/applications', {
            params: {
                filters: JSON.stringify({
                    name: {
                        $in: Object.values(APPs)
                    }
                })
            }
        })

        applications = applicationResponse.data.data;

        const app1 = applications.find(app => app.name === APPs.app1);
        console.log("[beforeAll] Resolved app1:", app1 && app1.id);
        await expect(app1).toBeDefined()

        console.log("[beforeAll] Running sessionFlow for app1...");
        await sessionFlow(adminClient, app1, guestClient);
    })




    test('Test 1: Date Range Filter - Multi-Day, Single-Day, End Date Inclusion (VC-1526)', async ({ page }) => {

        // Navigate to home (/)
        console.log("[Test1] Navigating to home...");
        await page.goto('/');

        // Login as admin (internal user) && Navigate to Applicant Inbox
        console.log("[Test1] Logging in as admin...");
        await loginWith(page, admin)

        // Create test sessions with known dates, applications, document types, applicant types
        console.log("[Test1] [Stub] Create test sessions with known dates etc.");
        // Store session IDs for verification
        console.log("[Test1] [Stub] Store session IDs for verification.");

    })

})

async function sessionFlow(adminClient, app1, guestClient, {
    type = 'affordable_occupant'
} = {}) {
    const user = {
        email: getRandomEmail(),
        first_name: 'App1',
        last_name: 'TestUser'
    };
    const returnData = {}

    console.log("[sessionFlow] Creating session...");
    let session1 = await createSession(adminClient, app1, user);
    console.log("[sessionFlow] Created session ID:", session1 && session1.id);

    console.log("[sessionFlow] Logging in with guest user...");
    await loginWithGuestUser(guestClient, session1.url);

    console.log("[sessionFlow] Getting guest user info...");
    await getGuestUser(guestClient);

    if (type) {
        console.log(`[sessionFlow] Setting session type: ${type}`);
        await guestClient.patch(`/sessions/${session1.id}`, { type });
    }

    console.log("[sessionFlow] Fetching session after type set...");
    session1 = await getSession(guestClient, session1.id);

    if (session1.state.current_step.type === 'START') {
        console.log("[sessionFlow] Completing START step...");
        await completeStartStep(guestClient, session1);
    }

    console.log("[sessionFlow] Fetching session after START step completion...");
    session1 = await getSession(guestClient, session1.id);

    if (session1.state.current_step.type === 'TASK' && session1.state.current_step.task?.key === 'APPLICANTS') {
        console.log("[sessionFlow] Skipping APPLICANTS step...");
        await skipStep(guestClient, session1);
    }

    console.log("[sessionFlow] Fetching session after APPLICANTS step...");
    session1 = await getSession(guestClient, session1.id);

    console.log("[sessionFlow] Getting providers...");
    const providers = await getProviders(guestClient);
    const simulationProvider = providers.find(providerItem => providerItem.name === 'Simulation');
    console.log("[sessionFlow] Using simulation provider:", simulationProvider && simulationProvider.id);

    if (session1.state.current_step.type === 'TASK' && session1.state.current_step.task?.key === 'IDENTITY_VERIFICATION') {
        console.log("[sessionFlow] Completing IDENTITY_VERIFICATION step...");
        returnData.idenityVerification = await personaIdentityStep(guestClient, session1, user, simulationProvider);
    }

    console.log("[sessionFlow] Fetching session after IDENTITY_VERIFICATION...");
    session1 = await getSession(guestClient, session1.id);

    if (session1.state.current_step.type === 'TASK' && session1.state.current_step.task?.key === 'FINANCIAL_VERIFICATION') {
        console.log("[sessionFlow] Completing FINANCIAL_VERIFICATION step...");
        await completeFinancialStep(guestClient, session1, user, simulationProvider);
    }

    console.log("[sessionFlow] Fetching session after FINANCIAL_VERIFICATION...");
    session1 = await getSession(guestClient, session1.id);

    if (session1.state.current_step.type === 'TASK' && session1.state.current_step.task?.key === 'EMPLOYMENT_VERIFICATION') {
        console.log("[sessionFlow] Completing EMPLOYMENT_VERIFICATION step...");
        await completeEmploymentStep(guestClient, session1, user, simulationProvider);
    }
    console.log("[sessionFlow] Fetching session after EMPLOYMENT_VERIFICATION...");
    session1 = await getSession(guestClient, session1.id);

    returnData.session = session1

    console.log("[sessionFlow] Flow complete. Returning data.");
    return returnData;
}

async function completeEmploymentStep(guestClient, session1, user, simulationProvider) {
    console.log("[completeEmploymentStep] Starting Employment Verification...");
    const stepResponse = await guestClient.post(`/sessions/${session1.id}/steps`, { step: session1.state.current_step.id });
    const step = stepResponse.data?.data;
    await expect(step).toBeDefined();

    console.log("[completeEmploymentStep] Creating paystub data for employment...");
    const veridocsData = createPaystubData(user);
    const simulationData = {
        simulation_type: 'VERIDOCS_PAYLOAD',
        custom_payload: { documents: [veridocsData] }
    };
    const type = "Employment";
    console.log("[completeEmploymentStep] Simulating verification...");
    await simulateVerification(guestClient, '/employment-verifications', simulationProvider, step, simulationData, type);

    console.log("[completeEmploymentStep] Marking step as COMPLETED...");
    await guestClient.patch(`/sessions/${session1.id}/steps/${step.id}`, { status: 'COMPLETED' });
    console.log("[completeEmploymentStep] Employment Verification complete.");
}

async function completeFinancialStep(guestClient, session1, user, simulationProvider) {
    console.log("[completeFinancialStep] Starting Financial Verification...");
    const stepResponse = await guestClient.post(`/sessions/${session1.id}/steps`, { step: session1.state.current_step.id });
    const step = stepResponse.data?.data;
    await expect(step).toBeDefined();

    console.log("[completeFinancialStep] Creating customVeriDocsBankStatementData...");
    const veridocsData = customVeriDocsBankStatementData(user, 4, "weekly", 5, {
        creditAmount: 2000,
        payrollDescription: "PAYROLL DEPOSIT",
        extraCreditCount: 5,
        miscDescriptions: 2,
        extraCreditAmount: 1000,
    });
    const simulationData = {
        simulation_type: 'VERIDOCS_PAYLOAD',
        custom_payload: veridocsData
    };
    const type = "Financial";
    console.log("[completeFinancialStep] Simulating verification...");
    await simulateVerification(guestClient, '/financial-verifications', simulationProvider, step, simulationData, type);

    console.log("[completeFinancialStep] Marking step as COMPLETED...");
    await guestClient.patch(`/sessions/${session1.id}/steps/${step.id}`, { status: 'COMPLETED' });
    console.log("[completeFinancialStep] Financial Verification complete.");
}

async function personaIdentityStep(guestClient, session1, user, simulationProvider) {
    console.log("[personaIdentityStep] Starting Identity Verification...");
    const stepResponse = await guestClient.post(`/sessions/${session1.id}/steps`, { step: session1.state.current_step.id });
    const step = stepResponse.data?.data;
    await expect(step).toBeDefined();

    console.log("[personaIdentityStep] Creating personaConnectData...");
    const identityPayload = personaConnectData(user);
    const identitySimulationData = {
        simulation_type: 'PERSONA_PAYLOAD',
        custom_payload: identityPayload
    };
    const type = "Identity";
    console.log("[personaIdentityStep] Simulating verification...");
    await simulateVerification(guestClient, '/identity-verifications', simulationProvider, step, identitySimulationData, type);

    console.log("[personaIdentityStep] Marking step as COMPLETED...");
    await guestClient.patch(`/sessions/${session1.id}/steps/${step.id}`, { status: 'COMPLETED' });

    console.log("[personaIdentityStep] Fetching identity-verifications for step...");
    const idenityVerificationResponse = await guestClient.get('/identity-verifications', {
        params: {
            filters: JSON.stringify(
                { "$has": { "step": { "session_id": { "$in": [session1.id] } } } }
            )
        }
    })

    const idenityVerifications = idenityVerificationResponse?.data?.data
    await expect(Array.isArray(idenityVerifications)).toBeTruthy()
    await expect(idenityVerifications.length > 0).toBeTruthy()

    console.log("[personaIdentityStep] Identity Verification complete. Returning object.");
    return idenityVerifications[0]

}

async function skipStep(guestClient, session1) {
    console.log("[skipStep] Skipping current step...");
    const stepResponse = await guestClient.post(`/sessions/${session1.id}/steps`, { step: session1.state.current_step.id });
    const step = stepResponse.data?.data;
    await expect(step).toBeDefined();
    await guestClient.patch(`/sessions/${session1.id}/steps/${step.id}`, { status: 'SKIPPED' });
    console.log("[skipStep] Step skipped.");
}

async function completeStartStep(guestClient, session1) {
    console.log("[completeStartStep] Completing START step...");
    const stepResponse = await guestClient.post(`/sessions/${session1.id}/steps`, { step: session1.state.current_step.id });
    const step = stepResponse.data?.data;
    await guestClient.patch(`/sessions/${session1.id}`, { target: 500 });
    await expect(step).toBeDefined();
    await guestClient.patch(`/sessions/${session1.id}/steps/${step.id}`, { status: 'COMPLETED' });
    console.log("[completeStartStep] START step completed.");
}

async function createSession(adminClient, app1, user) {
    console.log("[createSession] Creating session for user:", user.email, "on app:", app1?.id);
    let session1Response = await adminClient.post('/sessions', {
        application: app1.id,
        invite: true,
        ...user
    });
    let session1 = session1Response.data?.data;
    await expect(session1).toBeDefined();
    console.log("[createSession] Session created:", session1 && session1.id);
    return session1;
}

// Added guestClient to function signature for logging purposes, and accept sessionId
async function getProviders(guestClient) {
    console.log("[getProviders] Fetching providers...");
    const providerResponse = await guestClient.get(`/providers`)
    const providers = providerResponse?.data?.data
    expect(providers).toBeDefined()
    console.log("[getProviders] Providers fetched:", providers.map(p => p.name).join(', '));
    return providers
}

async function getSession(guestClient, sessionId) {
    console.log(`[getSession] Fetching session with ID: ${sessionId}...`);
    const session1Response = await guestClient.get(`/sessions/${sessionId}`, {
        params: SESSION_FIELDS
    })
    const session = session1Response?.data?.data
    expect(session).toBeDefined()
    console.log(`[getSession] Session fetched for ID: ${sessionId}`);
    return session
}

async function getGuestUser(guestClient) {
    console.log("[getGuestUser] Fetching guest user info...");
    const userResponse = await guestClient.get('/guests/self')
    const guest = userResponse.data?.data;
    console.log("[getGuestUser] Guest info retrieved:", guest && guest.email);
    return guest;
}