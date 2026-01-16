import { expect, test } from "@playwright/test";
import { loginWith } from "./utils/session-utils";
import { admin, app, } from "./test_config";
import { ApiClient } from "./api";
import { loginWithAdmin } from "./endpoint-utils/auth-helper";
import { findSessionLocator } from "./utils/report-page";
import { fillMultiselect } from "./utils/common";
import { waitForJsonResponse } from "./utils/wait-response";
import { sessionFlow } from "./utils/session-flow";
import { getRandomEmail } from "./utils/helper";


test.describe('QA-280 applicant_inbox_filters_internal_users.spec', () => {

    let adminClient
    let guestClient
    let sessions;
    let applications;
    let createdSession;
    let test5Passed = false;

    const APPs = {
        app1: 'Autotest - Application Heartbeat (Frontend)',
        app2: 'Autotest - Heartbeat Test - Employment',
        app3: 'Autotest - Heartbeat Test - ID',
        app4: 'Autotest - Simulation Upload',
        app5: 'AutoTest - Id Emp Fin',
    }


    test.beforeAll(async () => {
        console.log("[beforeAll] Initializing ApiClients...");
        adminClient = new ApiClient(app.urls.api, null, 120_000);
        guestClient = new ApiClient(app.urls.api, null, 120_000);

        console.log("[beforeAll] Logging in as admin...");
        await loginWithAdmin(adminClient);

        const now = new Date();
        const sessionStartDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 5));
        const sessionEndDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const formattedSessionStartDate = formatDate(sessionStartDate);
        const formattedSessionEndDate = formatDate(sessionEndDate);

        const sessionsResponse = await adminClient.get('/sessions', {
            params: {
                'fields[session]': 'id,created_at,application',
                'fields[application]': 'id,name',
                filters: JSON.stringify({ "$and": [{ "$hasnt": "parent" }, { created_at: { $between: [formattedSessionStartDate, formattedSessionEndDate] } }] }),
                limit: 999,
                order: 'created_at:desc'
            }
        })
        sessions = sessionsResponse?.data?.data;
        await expect(Array.isArray(sessions)).toBeTruthy()
        await expect(sessions.length).toBeGreaterThan(0)

    })


    test(' Test 1: Date Range Filter - Multi-Day, Single-Day, End Date Inclusion (VC-1526)', {
        tag: ['@core', '@regression']
    }, async ({ page }) => {

        /**
         * Open filters modal
         * Select date range: [use date range that includes existing sessions]
         * Apply filters    
         * API Verification: Verify created_at.$between with dates in yyyy-MM-dd format (backend receives format without time)
         * Verify all returned sessions have created_at within selected date range
         * Verify session cards displayed
         * Open filters modal
         * Select date range: [single day with existing sessions]
         * Apply filters
         */

        await page.goto('/');
        await loginWith(page, admin)

        const filterBtn = page.getByTestId('session-filter-modal-btn');
        await filterBtn.click()
        const filterModal = page.getByTestId('session-filter-modal')
        await expect(filterModal).toBeVisible()

        const datePicker = filterModal.getByTestId('session-date-range')
        await expect(datePicker).toBeVisible()
        const startDate = new Date(Date.UTC(
            new Date().getUTCFullYear(),
            new Date().getUTCMonth(),
            new Date().getUTCDate() - 3
        ));
        const endDate = new Date(Date.UTC(
            new Date().getUTCFullYear(),
            new Date().getUTCMonth(),
            new Date().getUTCDate() - 2
        ));
        await checkDateRangeSelection(page, filterModal, sessions, startDate, endDate);

        await filterBtn.click()
        await expect(filterModal).toBeVisible()
        await expect(datePicker).toBeVisible()

        const singleDate = new Date(Date.UTC(
            new Date().getUTCFullYear(),
            new Date().getUTCMonth(),
            new Date().getUTCDate() - 2
        ));
        await checkDateRangeSelection(page, filterModal, sessions, singleDate, singleDate);

        const lastDate = new Date(Date.UTC(
            new Date().getUTCFullYear(),
            new Date().getUTCMonth(),
            new Date().getUTCDate() - 1
        ));
        const today = new Date(Date.UTC(
            new Date().getUTCFullYear(),
            new Date().getUTCMonth(),
            new Date().getUTCDate()
        ));
        await checkDateRangeSelection(page, filterModal, sessions, lastDate, today);

        await filterBtn.click()
        await expect(filterModal).toBeVisible()
        await expect(filterModal.getByTestId('clear-filters')).toBeVisible()
        await filterModal.getByTestId('clear-filters').click()
    })


    test('Test 2: Basic Multi-Select Filters - Application, Document Types, Applicant Types', {
        tag: ['@core', '@regression']
    }, async ({ page }) => {
        test.setTimeout(200_000)
        // Application Filter

        await page.goto('/');
        await loginWith(page, admin)

        await verifySingleApplicationFilter(page, sessions);

        await clearFilters(page);

        await verifyMultipleApplicationFilter(page, sessions);

        await clearFilters(page);

        // Document Types Filter:
        await verifySingleDocumentTypeFilter(page, adminClient);

        await clearFilters(page);
        await verifyMultipleDocumentTypeFilter(page, adminClient);

        await clearFilters(page);
        await verifySingleApplicantTypeFilter(page, adminClient);

        await clearFilters(page);
        await verifyMultipleApplicantTypeFilter(page, adminClient);

    })

    test('Test 3: Internal User Specific Filters - Verification Step, Acceptance Status, Organization, Only Trashed', {
        tag: ['@core', '@regression']
    }, async ({ page }) => {

        await page.goto('/');

        await loginWith(page, admin);

        // Verification Step Filter:
        await verifySingleVerificationFilter(page, adminClient);

        await clearFilters(page)

        await verifySingleVerificationStepCompletedFilter(page, adminClient);

        await clearFilters(page)

        // Acceptance Status Filter

        await verifyAcceptanceStatusFilter(page, adminClient);

        // Organization Filter:
        await verifyOrganizationFilter(page, adminClient);

        await clearFilters(page);

        // Only Trashed Filter:
        await verifyOnlyTrashedFilter(page, adminClient);
    })

    test('Test 4: Search Filter - Text Search', {
        tag: ['@core', '@regression']
    }, async ({ page }) => {
        await page.goto('/')

        await loginWith(page, admin)

        const searchText = 'Jane Sample'

        const searchInput = await page.getByTestId('search-sessions-input');

        const [sessionResponse] = await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/sessions?')
                && resp.request().method() === 'GET'
                && resp.ok()
            ),
            searchInput.fill(searchText)
        ])

        // Check that the session list backend request contains searchText in the relevant $like filters
        const request = sessionResponse.request();
        const url = new URL(request.url());
        const filters = url.searchParams.get('filters') ? JSON.parse(url.searchParams.get('filters')) : {};

        /**
         * Given a filter object and a path array, traverses the object to find the value at the path.
         * Returns undefined if any part of the path does not exist.
         */
        function findValueAtPath(obj, pathArr) {
            return pathArr.reduce((cur, p) => (cur && cur[p] !== undefined) ? cur[p] : undefined, obj);
        }

        // The paths (based on the prompt's filters JSON structure) to check for the search string
        const searchLikePaths = [
            ['$and', 1, '$or', '$or', 'id', '$like'],
            ['$and', 1, '$or', '$or', 'completion_status', '$like'],
            ['$and', 1, '$or', '$or', 'approval_status', '$like'],
            ['$and', 1, '$or', '$or', 'acceptance_status', '$like'],
            ['$and', 1, '$or', '$has', 'application', '$or', 'id', '$like'],
            ['$and', 1, '$or', '$has', 'application', '$or', 'name', '$like'],
            ['$and', 1, '$or', '$has', 'application', '$or', 'description', '$like'],
            ['$and', 1, '$or', '$has', 'application', '$or', '$has', 'organization', '$or', 'id', '$like'],
            ['$and', 1, '$or', '$has', 'application', '$or', '$has', 'organization', '$or', 'name', '$like'],
            ['$and', 1, '$or', '$has', 'applicant', '$has', 'guest', '$or', 'full_name', '$like'],
            ['$and', 1, '$or', '$has', 'applicant', '$has', 'guest', '$or', 'email', '$like'],
            ['$and', 1, '$or', '$has', 'flags', 'severity', '$like'],
            ['$and', 1, '$or', '$has', 'children', 'session', 'applicant', '$has', 'guest', '$or', 'full_name', '$like'],
            ['$and', 1, '$or', '$has', 'children', 'session', 'applicant', '$has', 'guest', '$or', 'email', '$like'],
        ];

        for (const path of searchLikePaths) {
            const val = findValueAtPath(filters, path);
            expect(val).toBe(searchText);
        }

        const { data: sessions } = await waitForJsonResponse(sessionResponse);

        await expect(sessions.every(session => session.applicant.guest.full_name === searchText))
            .toBeTruthy();

    })

    test('Test 5: Combined Filters and Filter Management', {
        tag: ['@core', '@regression']
    }, async ({ page }) => {
        test.setTimeout(150_000)
        console.log("[Test5] Fetching applications...");
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
        console.log("[Test5] Resolved app1:", app1 && app1.id);
        await expect(app1).toBeDefined()

        console.log("[Test5] Running sessionFlow for app1...");
        const user = {
            email: getRandomEmail(),
            first_name: 'App1',
            last_name: 'TestUser'
        };
        const response = await sessionFlow(adminClient, guestClient, app1, user);
        createdSession = response.session

        // approving session
        await adminClient.patch(`/sessions/${createdSession.id}`, {
            acceptance_status: 'APPROVED'
        })

        await page.goto('/')

        await loginWith(page, admin)

        const filterBtn = page.getByTestId('session-filter-modal-btn');
        await filterBtn.click()
        const filterModal = page.getByTestId('session-filter-modal')
        await expect(filterModal).toBeVisible()

        const verificationStep = {
            name: 'Financial Verification',
            key: 'financial_verification'
        };
        const applicationName = APPs.app1;
        const documentType = 'Bank Statement';
        const applicantType = 'Affordable Occupant';
        const acceptanveStatus = 'Approved';
        const organizationName = 'Verifast';
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 1)
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 1);

        // fill filters 

        await fillMultiselect(page, page.getByTestId('filter-verification-input'), [verificationStep.name]);
        await fillMultiselect(page, page.getByTestId('filter-application-input'), [applicationName], {
            waitUrl: '/applications?'
        });

        await fillMultiselect(page, page.getByTestId('filter-document-type-input'), [documentType]);

        await fillMultiselect(page, page.getByTestId('filter-applicant-type-input'), [applicantType]);

        await selectDateRangeInPicker(filterModal, startDate, endDate)

        await fillMultiselect(page, page.getByTestId('filter-acceptance-status-input'), [acceptanveStatus]);

        await fillMultiselect(page, page.getByTestId('filter-organization-input'), [organizationName]);

        const [sessionResponse] = await Promise.all([
            page.waitForResponse(resp => {
                const match = resp.url().includes('sessions?')
                    && resp.request().method() === 'GET'
                    && resp.ok();
                return match;
            }),
            filterModal.getByTestId('submit-filter-modal').click()
        ]);

        const { data: filteredSessions } = await waitForJsonResponse(sessionResponse);

        expect(filteredSessions.map(session => session.id)).toContain(createdSession.id)
        const sessionLocator = await findSessionLocator(page, `.application-card[data-session="${createdSession.id}"]`);
        await expect(sessionLocator).toBeVisible();

        // reverse condition check
        await filterBtn.click()
        await expect(filterModal).toBeVisible()

        await fillMultiselect(page, page.getByTestId('filter-acceptance-status-input'), ['Declined']);

        const [newSessionResponse] = await Promise.all([
            page.waitForResponse(resp => {
                const match = resp.url().includes('sessions?')
                    && resp.request().method() === 'GET'
                    && resp.ok();
                return match;
            }),
            filterModal.getByTestId('submit-filter-modal').click()
        ]);
        const { data: newFilteredSessions } = await waitForJsonResponse(newSessionResponse);
        expect(newFilteredSessions.map(session => session.id)).not.toContain(createdSession.id)
        await expect(sessionLocator).not.toBeVisible();
        test5Passed = true
    })


    test.afterAll(async () => {
        if (test5Passed) {
            await adminClient.delete(`/sessions/${createdSession.id}`)
        }
    })

})

// format to yyyy/MM/dd format
const formatDate = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

async function verifyOnlyTrashedFilter(page, adminClient) {
    const filterBtn = page.getByTestId('session-filter-modal-btn');
    await filterBtn.click();
    const filterModal = page.getByTestId('session-filter-modal');
    await expect(filterModal).toBeVisible();

    await filterModal.getByTestId('filter-show-trashed').click();

    const [response] = await Promise.all([
        page.waitForResponse(resp => {
            const match = resp.url().includes('sessions?')
                && resp.request().method() === 'GET'
                && resp.ok();
            return match;
        }),
        filterModal.getByTestId('submit-filter-modal').click()
    ]);

    const url = new URL(response.url());
    const onlyTrashedParam = JSON.stringify(url.searchParams.get('only_trashed') || "false");
    expect(onlyTrashedParam).toBeTruthy();

    const { data: filteredSessions } = await waitForJsonResponse(response);

    const sessionResponse = await adminClient.get('/sessions', {
        params: {
            'fields[session]': 'id,deleted_at',
            filters: JSON.stringify({ id: { $in: filteredSessions.map(sess => sess.id) } }),
            only_trashed: true
        }
    });
    expect(sessionResponse).toBeDefined();
    const deletedSessions = sessionResponse?.data?.data;
    expect(deletedSessions).toBeDefined();
    for (let index = 0; index < deletedSessions.length; index++) {
        const session = deletedSessions[index];
        expect(session.deleted_at).not.toBe(null);
    }
}

async function verifyOrganizationFilter(page, adminClient) {
    const filterBtn = page.getByTestId('session-filter-modal-btn');
    await filterBtn.click();
    const filterModal = page.getByTestId('session-filter-modal');
    await expect(filterModal).toBeVisible();

    const ORGANIZATION_NAME = 'Permissions Test Org';

    const organizationResponse = await adminClient.get('/organizations', {
        params: {
            filters: JSON.stringify({
                name: ORGANIZATION_NAME
            })
        }
    });
    expect(organizationResponse).toBeDefined();
    const organizations = organizationResponse?.data?.data;
    expect(organizations).toBeDefined();
    expect(Array.isArray(organizations)).toBeTruthy();
    expect(organizations.length > 0).toBeTruthy();
    const organization = organizations.find(org => org.name === ORGANIZATION_NAME);

    await expect(organization).toBeDefined();

    await fillMultiselect(page, filterModal.getByTestId('filter-organization-input'), [organization.name]);

    const [response] = await Promise.all([
        page.waitForResponse(resp => {
            const match = resp.url().includes('sessions?')
                && resp.request().method() === 'GET'
                && resp.ok();
            return match;
        }),
        filterModal.getByTestId('submit-filter-modal').click()
    ]);

    const url = new URL(response.url());
    const filters = url.searchParams.get('filters');
    await expect(filters).toBeDefined();
    const parsedFilters = JSON.parse(filters);
    const condition = parsedFilters.$and.some(item => item.$has?.application?.$has?.organization?.id === organization.id
    );
    expect(condition).toBeDefined();

    const { data: filteredSessions } = await waitForJsonResponse(response);

    for (let index = 0; index < filteredSessions.length; index++) {
        const session = filteredSessions[index];
        expect(session.application?.organization?.id).toBe(organization.id);
    }
}

async function verifyAcceptanceStatusFilter(page, adminClient) {
    const filterBtn = page.getByTestId('session-filter-modal-btn');
    await filterBtn.click();
    const filterModal = page.getByTestId('session-filter-modal');
    await expect(filterModal).toBeVisible();

    const acceptanceStatus = {
        key: 'approved',
        name: 'Approved by Organization'
    };

    await fillMultiselect(page, filterModal.getByTestId('filter-acceptance-status-input'), [acceptanceStatus.name]);

    const [response] = await Promise.all([
        page.waitForResponse(resp => {
            const match = resp.url().includes('sessions?')
                && resp.request().method() === 'GET'
                && resp.ok();
            return match;
        }),
        filterModal.getByTestId('submit-filter-modal').click()
    ]);

    const url = new URL(response.url());
    const filters = url.searchParams.get('filters');
    await expect(filters).toBeDefined();
    const parsedFilters = JSON.parse(filters);
    const condition = parsedFilters.$and.some(item => item.acceptance_status === acceptanceStatus.key);
    expect(condition).toBeDefined();

    const { data: filteredSessions } = await waitForJsonResponse(response);

    const sessionResponse = await adminClient.get('/sessions', {
        params: {
            filters: JSON.stringify({
                id: { $in: filteredSessions.map(session => session.id) }
            })
        }
    })

    const acceptedSessions = sessionResponse?.data?.data

    expect(acceptedSessions).toBeDefined()
    for (let index = 0; index < acceptedSessions.length; index++) {
        const session = acceptedSessions[index];
        expect(session.acceptance_status).toBe(acceptanceStatus.key.toUpperCase());
    }
}

async function verifySingleVerificationStepCompletedFilter(page, adminClient) {
    const filterBtn = page.getByTestId('session-filter-modal-btn');
    await filterBtn.click();
    const filterModal = page.getByTestId('session-filter-modal');
    await expect(filterModal).toBeVisible();

    const verificationStep = {
        name: 'Financial Verification',
        key: 'financial_verification'
    };

    await fillMultiselect(page, page.getByTestId('filter-verification-input'), [verificationStep.name]);
    await page.getByTestId('with-step-completed').click();

    const [response] = await Promise.all([
        page.waitForResponse(resp => {
            const match = resp.url().includes('sessions?')
                && resp.request().method() === 'GET'
                && resp.ok();
            return match;
        }),
        filterModal.getByTestId('submit-filter-modal').click()
    ]);

    const url = new URL(response.url());
    const filters = url.searchParams.get('filters');
    await expect(filters).toBeDefined();
    const parsedFilters = JSON.parse(filters);
    const condition = parsedFilters.$and.some(item => item?.$has?.steps?.$has?.step?.$has?.task.key === verificationStep.key
        && item.$has?.steps?.status === 'COMPLETED'
    );
    expect(condition).toBeDefined();

    const { data: filteredSessions } = await waitForJsonResponse(response);

    const responseData = await adminClient.get('/sessions', {
        params: {
            filters: JSON.stringify({ id: { $in: filteredSessions.map(sess => sess.id) } }),
            'fields[session]': 'id,state',
            'fields[session_state]': 'id,steps',
            'fields[session_step]': 'id,step,status',
            'fields[workflow_step]': 'id,task',
            'fields[task_type]': 'id,key,name'
        }
    });
    const sessionStepSessions = responseData?.data?.data;
    await expect(sessionStepSessions).toBeDefined();
    for (let index = 0; index < sessionStepSessions.length; index++) {
        const session = sessionStepSessions[index];
        expect(session.state.steps.some(step => step?.step?.task?.key === verificationStep.key.toUpperCase()
            && step.status === 'COMPLETED'
        )).toBeTruthy();
    }
}

async function verifySingleVerificationFilter(page, adminClient) {
    const filterBtn = page.getByTestId('session-filter-modal-btn');
    await filterBtn.click();
    const filterModal = page.getByTestId('session-filter-modal');
    await expect(filterModal).toBeVisible();

    // Verification Step Filter:
    const verificationStep = {
        name: 'Financial Verification',
        key: 'financial_verification'
    };

    await fillMultiselect(page, page.getByTestId('filter-verification-input'), [verificationStep.name]);

    const [response] = await Promise.all([
        page.waitForResponse(resp => {
            const match = resp.url().includes('sessions?')
                && resp.request().method() === 'GET'
                && resp.ok();
            return match;
        }),
        filterModal.getByTestId('submit-filter-modal').click()
    ]);

    const url = new URL(response.url());
    const filters = url.searchParams.get('filters');
    await expect(filters).toBeDefined();
    const parsedFilters = JSON.parse(filters);
    const condition = parsedFilters.$and.some(item => item?.$has?.application?.$has?.workflow?.$has?.steps?.$has?.task?.key?.$in?.length === 1
        && item?.$has?.application?.$has?.workflow?.$has?.steps?.$has?.task?.key?.$in?.[0] === verificationStep.key
    );
    expect(condition).toBeDefined();

    const { data: filteredSessions } = await waitForJsonResponse(response);

    const workflowSessions = await adminClient.get('/sessions', {
        params: {
            filters: JSON.stringify({ id: { $in: filteredSessions.map(sess => sess.id) } }),
            'fields[session]': 'id,application',
            'fields[application]': 'id,workflow',
            'fields[workflow]': 'id,steps',
            'fields[workflow_step]': 'id,task',
            'fields[task_type]': 'id,key'
        }
    });

    for (let index = 0; index < workflowSessions.length; index++) {
        const session = workflowSessions[index];
        expect(session.application.workflow.steps.some(step => step?.task?.key === verificationStep.key)).toBeTruthy();
    }
}

async function verifyMultipleApplicantTypeFilter(page, adminClient) {
    const filterBtn = page.getByTestId('session-filter-modal-btn');
    await filterBtn.click();
    const filterModal = page.getByTestId('session-filter-modal');
    await expect(filterModal).toBeVisible();

    const applicantTypes = [
        { key: "affordable_primary", value: "Affordable Primary" },
        { key: "affordable_occupant", value: "Affordable Occupant" },
        { key: "employed", value: "Employed" },
        { key: "self_employed", value: "Self-Employed" },
    ];
    const applicantTypeKeys = applicantTypes.map(item => item.key);
    const applicantTypeNames = applicantTypes.map(item => item.value);
    await fillMultiselect(page, page.getByTestId('filter-applicant-type-input'), applicantTypeNames);

    const [response] = await Promise.all([
        page.waitForResponse(resp => {
            const match = resp.url().includes('sessions?')
                && resp.request().method() === 'GET'
                && resp.ok();
            return match;
        }),
        filterModal.getByTestId('submit-filter-modal').click()
    ]);

    const url = new URL(response.url());
    const filters = url.searchParams.get('filters');
    await expect(filters).toBeDefined();
    const parsedFilters = JSON.parse(filters);
    const condition = parsedFilters.$and.some(item => {
        const arr = item?.type?.$in;
        return Array.isArray(arr)
            && arr.length === applicantTypeKeys.length
            && arr.every(val => applicantTypeKeys.includes(val))
            && applicantTypeKeys.every(val => arr.includes(val));
    });
    await expect(condition).toBeTruthy();

    const { data: filteredSessions } = await waitForJsonResponse(response);

    const sessionResponse = await adminClient.get('/sessions', {
        params: {
            filters: JSON.stringify({ id: { $in: filteredSessions.map(ses => ses.id) } }),
            'fields[session]': 'id,type'
        }
    });
    const sessionsWithApplicantTypes = sessionResponse?.data?.data;
    expect(sessionsWithApplicantTypes).toBeDefined();

    for (let index = 0; index < sessionsWithApplicantTypes.length; index++) {
        const session = sessionsWithApplicantTypes[index];
        expect(applicantTypeKeys.map(type => type.toUpperCase())).toContain(session.type);
    }
}

async function verifySingleApplicantTypeFilter(page, adminClient) {
    const filterBtn = page.getByTestId('session-filter-modal-btn');
    await filterBtn.click();
    const filterModal = page.getByTestId('session-filter-modal');
    await expect(filterModal).toBeVisible();

    const applicantType = { key: "affordable_primary", value: "Affordable Primary" };

    await fillMultiselect(page, page.getByTestId('filter-applicant-type-input'), [applicantType.value]);

    const [response] = await Promise.all([
        page.waitForResponse(resp => {
            const match = resp.url().includes('sessions?')
                && resp.request().method() === 'GET'
                && resp.ok();
            return match;
        }),
        filterModal.getByTestId('submit-filter-modal').click()
    ]);

    const url = new URL(response.url());
    const filters = url.searchParams.get('filters');
    await expect(filters).toBeDefined();
    const parsedFilters = JSON.parse(filters);
    const condition = parsedFilters.$and.some(item => item?.type?.$in.length === 1 && item?.type?.$in[0] === applicantType.key);

    await expect(condition).toBeTruthy();

    const { data: filteredSessions } = await waitForJsonResponse(response);

    const sessionsResponse = await adminClient.get('/sessions', {
        params: {
            filters: JSON.stringify({ id: { $in: filteredSessions.map(ses => ses.id) } }),
            'fields[session]': 'id,type'
        }
    })

    const sessionsWithApplicantType = sessionsResponse?.data?.data;
    expect(sessionsWithApplicantType).toBeDefined()
    for (let index = 0; index < sessionsWithApplicantType.length; index++) {
        const session = sessionsWithApplicantType[index];
        expect(session.type?.toLowerCase()).toBe(applicantType.key);
    }
}

async function verifyMultipleDocumentTypeFilter(page, adminClient) {
    const filterBtn = page.getByTestId('session-filter-modal-btn');
    await filterBtn.click();
    const filterModal = page.getByTestId('session-filter-modal');
    await expect(filterModal).toBeVisible();
    const documentTypes = [
        {
            name: 'Pay Stub',
            key: 'pay_stub'
        },
        {
            name: 'Bank Statement',
            key: 'bank_statement'
        },
        {
            name: 'EMPLOYMENT LETTER',
            key: 'employment_offer_letter'
        },
        {
            name: 'Tax Statement 1040',
            key: 'tax_statement_1040'
        }
    ];

    const documentKeys = documentTypes.map(item => item.key);
    const documentNames = documentTypes.map(item => item.name);
    await fillMultiselect(page, page.getByTestId('filter-document-type-input'), documentNames);


    const [response] = await Promise.all([
        page.waitForResponse(resp => {
            const match = resp.url().includes('sessions?')
                && resp.request().method() === 'GET'
                && resp.ok();
            return match;
        }),
        filterModal.getByTestId('submit-filter-modal').click()
    ]);

    const url = new URL(response.url());
    const filters = url.searchParams.get('filters');
    await expect(filters).toBeDefined();
    const parsedFilters = JSON.parse(filters);
    const condition = parsedFilters.$and.some(item => documentKeys.every(key => item?.$has?.verifications?.$has?.documents
        ?.$has?.type?.key?.$in.includes(key))
    );

    await expect(condition).toBeTruthy();

    const { data: filteredSessions } = await waitForJsonResponse(response);

    for (let index = 0; index < filteredSessions.length; index++) {
        const session = filteredSessions[index];
        const fileResponse = await adminClient.get(`/sessions/${session.id}/files`, {
            params: {
                'fields[file]': 'id,documents',
                'fields[document]': 'id,type',
                filters: JSON.stringify({
                    $has: {
                        documents: {
                            $has: {
                                type: {
                                    key: {
                                        $in: documentKeys
                                    }
                                }
                            }
                        }
                    }
                })
            }
        });

        const files = fileResponse.data.data;
        await expect(files.length).toBeGreaterThan(0);
        await expect(files.every(file => file.documents.some(doc => documentKeys.includes(doc.type?.key)))).toBeTruthy();
        await page.waitForTimeout(500);
    }
}

async function verifySingleDocumentTypeFilter(page, adminClient) {

    const filterBtn = page.getByTestId('session-filter-modal-btn');
    await filterBtn.click();
    const filterModal = page.getByTestId('session-filter-modal');
    await expect(filterModal).toBeVisible();

    const documentKey = 'pay_stub';
    const documentName = documentKey.split('_').join(' ');
    await fillMultiselect(page, filterModal.getByTestId('filter-document-type-input'), [documentName]);


    const [response] = await Promise.all([
        page.waitForResponse(resp => {
            const match = resp.url().includes('sessions?')
                && resp.request().method() === 'GET'
                && resp.ok();
            return match;
        }),
        filterModal.getByTestId('submit-filter-modal').click()
    ]);

    const url = new URL(response.url());
    const filters = url.searchParams.get('filters');
    await expect(filters).toBeDefined();
    const parsedFilters = JSON.parse(filters);
    const condition = parsedFilters.$and.some(item => item?.$has?.verifications?.$has?.documents
        ?.$has?.type?.key?.$in
        ?.every(item => item === documentKey));

    await expect(condition).toBeTruthy();

    const { data: filteredSessions } = await waitForJsonResponse(response);

    for (let index = 0; index < filteredSessions.length; index++) {
        const session = filteredSessions[index];
        const fileResponse = await adminClient.get(`/sessions/${session.id}/files`, {
            params: {
                'fields[file]': 'id,documents',
                'fields[document]': 'id,type',
                filters: JSON.stringify({
                    $has: {
                        documents: {
                            $has: {
                                type: {
                                    key: documentKey
                                }
                            }
                        }
                    }
                })
            }
        });

        const files = fileResponse.data.data;
        await expect(files.length).toBeGreaterThan(0);
        await page.waitForTimeout(500);
    }
}

async function verifyMultipleApplicationFilter(page, sessions) {
    const filterBtn = page.getByTestId('session-filter-modal-btn');
    await filterBtn.click();
    const filterModal = page.getByTestId('session-filter-modal');
    await expect(filterModal).toBeVisible();

    const uniqueAppSessions = Object.values(
        sessions.reduce((acc, session) => {
            if (!acc[session.application?.id]) {
                acc[session.application?.id] = session;
            }
            return acc;
        }, {})
    );

    const applicationSessions = Object.values(uniqueAppSessions);
    const applicationNames = [...new Set(applicationSessions.map(session => session.application.name))];
    await expect(applicationNames).toBeDefined();
    await expect(applicationNames.length).toBeGreaterThan(0);

    const first5sessions = applicationSessions.length > 0
        ? applicationSessions.slice(0, 5)
        : applicationSessions;

    const applicationsToFilter = first5sessions.map(session => session.application.name);
    await fillMultiselect(page, filterModal.getByTestId('filter-application-input'), applicationsToFilter, {
        waitUrl: '/applications?'
    });
    const first5AppIds = first5sessions.map(session => session.application.id);

    const [sesResponse] = await Promise.all([
        page.waitForResponse(resp => {
            const match = resp.url().includes('sessions?')
                && resp.request().method() === 'GET'
                && resp.ok();
            if (match) {
                const url = new URL(resp.url());
                const filtersParam = url.searchParams.get('filters');
                if (filtersParam) {
                    const filters = JSON.parse(filtersParam);
                    const andClause = Array.isArray(filters.$and) ? filters.$and : [];
                    const condition = andClause.some(clause => clause.hasOwnProperty('$has') &&
                        clause?.$has?.application?.id?.$in.every(appId => first5AppIds.includes(appId))
                    );
                    return condition;
                }
                return false;
            }
            return match;

        }),
        filterModal.getByTestId('submit-filter-modal').click()
    ]);

    const { data: appFilteredSessions } = await waitForJsonResponse(sesResponse);

    for (let index = 0; index < appFilteredSessions.length; index++) {
        const session = appFilteredSessions[index];
        expect(applicationsToFilter).toContain(session.application.name);
    }

    await expect(first5AppIds.every(appId => appFilteredSessions.some(ses => ses.application.id === appId))).toBeTruthy();
    return { filterBtn, filterModal };
}

async function clearFilters(page) {
    const filterBtn = page.getByTestId('session-filter-modal-btn');
    await filterBtn.click();
    const filterModal = page.getByTestId('session-filter-modal');
    await expect(filterModal).toBeVisible();
    await filterModal.getByTestId('clear-filters').click();
}

async function verifySingleApplicationFilter(page, sessions) {
    const filterBtn = page.getByTestId('session-filter-modal-btn');
    await filterBtn.click();
    const filterModal = page.getByTestId('session-filter-modal');
    await expect(filterModal).toBeVisible();

    // Get sessions where session.application.id is unique to each session
    const applicationName = sessions[0].application.name;
    const application = sessions[0].application;

    await fillMultiselect(page, filterModal.getByTestId('filter-application-input'), [applicationName], {
        waitUrl: '/applications?'
    });

    const [response] = await Promise.all([
        page.waitForResponse(resp => resp.url().includes('sessions?')
            && resp.url().includes(application.id)
            && resp.request().method() === 'GET'
            && resp.ok()
        ),
        filterModal.getByTestId('submit-filter-modal').click()
    ]);

    const { data: filteredSessions } = await waitForJsonResponse(response);

    for (let index = 0; index < filteredSessions.length; index++) {
        const session = filteredSessions[index];
        expect(session.application.id).toBe(application.id);
    }
}

async function checkDateRangeSelection(page, filterModal, sessions, startDate, endDate) {
    await selectDateRangeInPicker(filterModal, startDate, endDate);

    const [response] = await Promise.all([
        page.waitForResponse(resp => resp.url().includes('sessions?')
            && resp.url().includes('created_at')
            && resp.url().includes('$between')
        ),
        filterModal.getByTestId('submit-filter-modal').click()
    ]);


    const url = new URL(response.url());
    const filtersParam = url.searchParams.get('filters');
    await expect(filtersParam).toBeDefined();
    const filters = JSON.parse(filtersParam);
    // Look for a $and array and within it an object with created_at.$between
    const andClause = Array.isArray(filters.$and) ? filters.$and : [];
    const betweenClause = andClause.find(clause => clause.hasOwnProperty('created_at') &&
        clause.created_at.hasOwnProperty('$between')
    );
    await expect(betweenClause).toBeDefined();
    const formattedStartDate = formatDate(startDate);
    const formattedEndDate = formatDate(endDate);
    await expect(betweenClause.created_at.$between[0]).toBe(formattedStartDate);
    // await expect(betweenClause.created_at.$between[1]).toBe(formattedEndDate)
    // Filter sessions whose created_at is between startDate and endDate (inclusive)
    const sessionsToBePresent = sessions.filter(session => {
        return session.created_at.includes(formattedStartDate) || session.created_at.includes(formattedEndDate)
    });
    // Now you can use filteredSessions as needed in further tests or assertions
    let count = 1;
    for (let index = 0; index < sessionsToBePresent.length; index++) {
        const sessionToBePresent = sessionsToBePresent[index];
        const sessionLocatior = await findSessionLocator(page, `.application-card[data-session="${sessionToBePresent.id}"]`);
        await expect(sessionLocatior).toBeVisible();

        if (count % 12 === 0) {
            count = 0
            await page.waitForTimeout(500)
        }
        if (count === 100) {
            break;
        }
        count++;
    }
}

// Helper function for picking start/end date in the date picker
async function selectDateRangeInPicker(filterModal, startDate, endDate) {
    await filterModal.getByTestId('session-date-range').click();
    const datePicker = filterModal.locator('#dp-menu-submission_date_range')
    const formattedStartDate = formatDate(startDate);
    const formattedEndDate = formatDate(endDate);

    const endDateElement = datePicker.locator(`[id="${formattedEndDate}"]`)
    const startDateElement = datePicker.locator(`[id="${formattedStartDate}"]`)
    if (!await endDateElement.isVisible()) {
        await datePicker.locator('[aria-label="Previous month"]').click();
    }
    await endDateElement.click()
    if (!await startDateElement.isVisible()) {
        await datePicker.locator('[aria-label="Previous month"]').click();
    }
    await startDateElement.click()
}