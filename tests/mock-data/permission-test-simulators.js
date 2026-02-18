/**
 * Mock Data Generators for Permission Test Session Creation
 * 
 * Provides simulator payloads for:
 * - PERSONA_PAYLOAD (Identity with real-like data)
 * - VERIDOCS_PAYLOAD (Bank Statement with matching name)
 * - ATOMIC_PAYLOAD (Employment with matching name)
 */

// Helper: Generate UUID
const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// Helper: Date generators
const getDates = () => {
    const currentDate = new Date();

    const dateAfter2Years = new Date(currentDate);
    dateAfter2Years.setDate(currentDate.getDate() + (365 * 2));

    const dateBefore1Year = new Date(currentDate);
    dateBefore1Year.setDate(currentDate.getDate() - 365);

    const dateBefore20Years = new Date(currentDate);
    dateBefore20Years.setDate(currentDate.getDate() - (365 * 20));

    const subMinutes = (mins) => {
        const date = new Date(currentDate);
        date.setMinutes(mins);
        return date;
    };

    return {
        dateAfter2Years,
        dateBefore1Year,
        dateBefore20Years,
        currentDate,
        subMinutes
    };
};

// Helper: ISO date
const isoDate = (d = new Date()) => {
    const date = new Date(d);
    date.setUTCHours(0, 0, 0, 0);
    return date.toISOString();
};

// Helper: Days ago
const daysAgo = (n) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - n);
    return isoDate(d);
};

/**
 * Generates PERSONA_PAYLOAD for Identity Verification
 * Based on document-upload-identity-mock-data.js
 * 
 * @param {Object} userData - User data { first_name, last_name, email }
 * @param {String} userType - 'primary', 'co-applicant', or 'guarantor'
 * @returns {Object} Complete PERSONA_PAYLOAD structure
 */
export function getPersonaPayload(userData = {}, userType = 'primary') {
    const { subMinutes, dateAfter2Years, dateBefore1Year, dateBefore20Years, currentDate } = getDates();

    // Extract user data with defaults
    const firstName = userData.first_name || "Permission";
    const lastName = userData.last_name || "Test";
    const email = userData.email || "test@example.com";

    // Differentiate between Primary and Guarantor
    const isGuarantor = userType === 'guarantor' || userType === 'co-applicant';
    const identificationNumber = isGuarantor ? "G7654321" : "I1234562";

    const inqId = generateUUID();
    const accId = generateUUID();
    const inqTempId = generateUUID();
    const inqTempVerId = generateUUID();
    const werRunId = generateUUID();
    const verGovId = generateUUID();
    const inqSessionId = generateUUID();
    const docId = generateUUID();
    const verTempVerId = generateUUID();
    const verTempId = generateUUID();
    const deviceId = generateUUID();
    const netId = generateUUID();

    return {
        "data": {
            "type": "inquiry",
            "id": inqId,
            "attributes": {
                "status": "approved",
                "reference_id": null,
                "note": null,
                "behaviors": {
                    "api_version_less_than_minimum_count": 0,
                    "autofill_cancels": 0,
                    "autofill_starts": 0,
                    "behavior_threat_level": "low",
                    "bot_score": 99,
                    "completion_time": 43.026,
                    "debugger_attached": false,
                    "devtools_open": false,
                    "distraction_events": 0,
                    "hesitation_baseline": 0,
                    "hesitation_count": 0,
                    "hesitation_percentage": null,
                    "hesitation_time": 0,
                    "mobile_sdk_version_less_than_minimum_count": 0,
                    "request_spoof_attempts": 0,
                    "shortcut_copies": 0,
                    "shortcut_pastes": 0,
                    "user_agent_spoof_attempts": 0
                },
                "tags": [],
                "creator": "API",
                "reviewer_comment": null,
                "updated_at": currentDate.toISOString(),
                "created_at": dateBefore1Year.toISOString(),
                "started_at": subMinutes(1).toISOString(),
                "completed_at": currentDate.toISOString(),
                "failed_at": null,
                "marked_for_review_at": null,
                "decisioned_at": currentDate.toISOString(),
                "expires_at": dateAfter2Years.toISOString(),
                "redacted_at": null,
                "previous_step_name": "verification_government_id",
                "next_step_name": "success",
                "name_first": firstName,
                "name_middle": null,
                "name_last": lastName,
                "birthdate": dateBefore20Years.toISOString().split('T')[0],
                "address_street_1": "123 TEST STREET BIRMINGHAM AL 35201",
                "address_street_2": null,
                "address_city": "BIRMINGHAM",
                "address_subdivision": "Alabama",
                "address_subdivision_abbr": "AL",
                "address_postal_code": "35201",
                "address_postal_code_abbr": "35201",
                "identification_number": identificationNumber,
                "fields": {
                    "name_first": { "type": "string", "value": firstName },
                    "name_middle": { "type": "string", "value": null },
                    "name_last": { "type": "string", "value": lastName },
                    "address_street_1": { "type": "string", "value": "123 TEST STREET BIRMINGHAM AL 35201" },
                    "address_street_2": { "type": "string", "value": null },
                    "address_city": { "type": "string", "value": "BIRMINGHAM" },
                    "address_subdivision": { "type": "string", "value": "AL" },
                    "address_postal_code": { "type": "string", "value": "35201" },
                    "birthdate": { "type": "string", "value": dateBefore20Years.toISOString().split('T')[0] },
                    "identification_number": { "type": "string", "value": identificationNumber }
                }
            }
        }
    };
}

/**
 * Generates VERIDOCS_PAYLOAD for Financial Verification (Bank Statement)
 * Based on bank-statement-veridocs-payload.js
 * Modified to have 6 transactions with 3 "Payroll Deposit Employment" for income source creation
 * 
 * @param {Object} userData - User data { first_name, last_name }
 * @returns {Object} Complete VERIDOCS_PAYLOAD structure
 */
export function getVeridocsBankStatementPayload(userData = {}, {
    currencyDetails
} = {}) {
    // Generate dynamic dates
    const createDate = (daysAgo) => {
        const date = new Date();
        date.setUTCDate(date.getUTCDate() - daysAgo);
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const year = date.getUTCFullYear();
        return `${month}/${day}/${year}`;
    };

    const dynamicDates = {
        day1: createDate(1),     // Most recent
        day5: createDate(5),
        day10: createDate(10),
        day15: createDate(15),
        day20: createDate(20),
        day25: createDate(25),
        day30: createDate(30),   // Oldest
        day35: createDate(35)
    };

    // Use user name or default
    const firstName = userData?.first_name;
    const lastName = userData?.last_name;

    const accountOwnerName = (firstName != null || lastName != null)
        ? `${firstName ?? ''} ${lastName ?? ''}`.trim()
        : 'Permission Test User';

    // 6 transactions: 3 employment income + 3 expenses
    const transactions = [
        // Employment Income #1
        {
            "type": "credit",
            "description": "Payroll Deposit Employment",
            "date": dynamicDates.day5,
            "amount": 2500,
            "balance": 12500.00,
            "page_number": 2,
            ...(currencyDetails ? currencyDetails : {})
        },
        // Employment Income #2
        {
            "type": "credit",
            "description": "Payroll Deposit Employment",
            "date": dynamicDates.day20,
            "amount": 2500,
            "balance": 10000.00,
            "page_number": 2,
            ...(currencyDetails ? currencyDetails : {})
        },
        // Employment Income #3
        {
            "type": "credit",
            "description": "Payroll Deposit Employment",
            "date": dynamicDates.day35,
            "amount": 2500,
            "balance": 7500.00,
            "page_number": 2,
            ...(currencyDetails ? currencyDetails : {})
        },
        // Expense #1
        {
            "type": "debit",
            "description": "Grocery Store Purchase",
            "date": dynamicDates.day10,
            "amount": -150,
            "balance": 12350.00,
            "page_number": 2,
            ...(currencyDetails ? currencyDetails : {})
        },
        // Expense #2
        {
            "type": "debit",
            "description": "Utility Payment",
            "date": dynamicDates.day25,
            "amount": -200,
            "balance": 9800.00,
            "page_number": 2,
            ...(currencyDetails ? currencyDetails : {})

        },
        // Expense #3
        {
            "type": "debit",
            "description": "Rent Payment",
            "date": dynamicDates.day30,
            "amount": -1500,
            "balance": 9000.00,
            "page_number": 2,
            ...(currencyDetails ? currencyDetails : {})
        }
    ];

    // Calculate totals
    const totalCredits = 7500.00; // 3 x $2500
    const totalDebits = 1850.00;  // $150 + $200 + $1500
    const balanceStart = 10000.00;
    const balanceEnd = 10000.00 + totalCredits - totalDebits;

    return {
        "documents": [
            {
                "id": "AUTOGENERATE",
                "file_name": "permission_test_bank_statement.pdf",
                "reference_id": null,
                "qualifier": "development",
                "documents": [
                    {
                        "order": 1,
                        "pages": [
                            { "number": 1, "path": "permission-test/_images/page_1.jpg", "size": 57013 },
                            { "number": 2, "path": "permission-test/_images/page_2.jpg", "size": 89949 },
                            { "number": 3, "path": "permission-test/_images/page_3.jpg", "size": 77723 }
                        ],
                        "page_start": 1,
                        "page_end": 3,
                        "language": "en_US",
                        "extraction_hints": {
                            "period_start_date": dynamicDates.day30,
                            "period_end_date": dynamicDates.day1,
                            "accounts": [
                                {
                                    "name": "checking account",
                                    "number": "9876543210",
                                    "start_page": 1,
                                    "end_page": 3
                                }
                            ]
                        },
                        "type": "bank_statement",
                        "subtype": "wells_fargo",
                        "confidence": {
                            "score": 99,
                            "reasoning": "The document clearly identifies itself as a Wells Fargo bank statement with account summary, transaction history, and account holder information."
                        },
                        "data": {
                            "institution_name": "Wells Fargo",
                            "bank_country": "US",
                            "bank_account_currency": "USD",
                            "original_currency": "USD",
                            ...(currencyDetails ? currencyDetails : {}),
                            "accounts": [
                                {
                                    "account_type": "Checking",
                                    "account_number": "9876543210",
                                    "account_name": "checking account",
                                    "account_owners": [
                                        { "name": accountOwnerName }
                                    ],
                                    "balance_start_date": dynamicDates.day30,
                                    "balance_end_date": dynamicDates.day1,
                                    "balance_total_start": balanceStart,
                                    "balance_total_end": balanceEnd,
                                    "total_credits": totalCredits,
                                    "total_debits": totalDebits,
                                    "transactions": transactions,
                                    ...(currencyDetails ? currencyDetails : {}) 
                                }
                            ]
                        },
                        "metadata": {
                            "cost_usd": 0,
                            "elapsed_time": 14.6,
                            "llm_model": "gemini-2.0-flash"
                        }
                    }
                ],
                "metadata": {
                    "warnings": [],
                    "pages_converted_count": 3,
                    "pages_total_file_size": 224685,
                    "pages_extracted_count": 3,
                    "classification_attempts": 1,
                    "extraction_attempts": 1,
                    "cost_usd": 0,
                    "elapsed_time": 40.33,
                    "elapsed_time_image_conversion": 1.99,
                    "elapsed_time_classification": 22.56,
                    "elapsed_time_extraction": 14.9,
                    "classification_original_amount_of_documents": 1,
                    "classification_merged_amount_of_documents": 1,
                    "pages_classified_count": 3,
                    "classification_model_used": "gemini-2.5-flash",
                    "classification_fallback_used": false
                }
            }
        ]
    };
}

/**
 * Generates ATOMIC_PAYLOAD for Employment Verification
 * Based on employment-simulation-mock-data.js
 * 
 * @param {Object} userData - User data { first_name, last_name, email }
 * @returns {Object} Complete ATOMIC_PAYLOAD structure
 */
export function getAtomicEmploymentPayload(userData = {}) {
    const taskId = 'PERM-TEST-' + Math.random().toString(36).slice(2, 10);
    const createdAt = isoDate();
    const connectorName = 'Paytomic';
    const companyName = 'Permission Test Company Inc.';

    // Extract user data
    const firstName = typeof userData.first_name === 'undefined' ? 'Permission' : userData.first_name;
    const lastName = typeof userData.last_name === 'undefined' ? 'Test' : userData.last_name;
    const email = typeof userData.email === 'undefined' ? 'test@example.com' : userData.email;
    const dob = '1990-01-01T00:00:00.000Z';
    const phone = '2055551234';
    const ssn = 'XXXXX5678';
    const address = '123 TEST STREET';
    const city = 'BIRMINGHAM';
    const state = 'AL';
    const postalCode = '35201';

    const employeeType = 'fulltime';
    const employmentStatus = 'active';
    const jobTitle = 'Software Engineer';
    const startDate = daysAgo(730); // ~2 years ago

    const hourlyIncome = 28.85; // ~$60k annual
    const annualIncome = 60000;
    const netHourlyRate = 22.11; // ~77% after taxes
    const payCycle = 'biweekly';
    const currentPayPeriodStart = daysAgo(7);

    // Generate 3 recent paystubs (biweekly = every 14 days)
    const statements = [];
    for (let i = 0; i < 3; i++) {
        const startOffset = 14 * (i + 1) + 3;
        const endOffset = 14 * (i + 1);
        const payDate = daysAgo(endOffset - 2);

        const hoursPerPeriod = 80; // 2 weeks * 40 hours
        const gross = Math.round(hourlyIncome * hoursPerPeriod * 100) / 100;
        const net = Math.round(gross * 0.77 * 100) / 100;

        statements.push({
            date: payDate,
            payPeriodStartDate: daysAgo(startOffset),
            payPeriodEndDate: daysAgo(endOffset),
            grossAmount: gross,
            netAmount: net,
            ytdGrossAmount: Math.round(gross * (i + 1) * 100) / 100,
            ytdNetAmount: Math.round(net * (i + 1) * 100) / 100,
            hours: hoursPerPeriod,
            deductions: [],
            earnings: [
                {
                    category: 'wage',
                    rawLabel: 'Regular',
                    amount: gross,
                    ytdAmount: Math.round(gross * (i + 1) * 100) / 100,
                    hours: hoursPerPeriod,
                    rate: hourlyIncome
                }
            ],
            netAmountAdjustments: []
        });
    }

    return {
        FETCH_EMPLOYMENT_IDENTITY: {
            request: { id: taskId },
            response: {
                data: [
                    {
                        connector: { _id: 'PERM-CONNECTOR', branding: { color: '' }, name: connectorName },
                        company: { _id: 'PERM-COMPANY', branding: {}, name: companyName },
                        identity: {
                            firstName,
                            lastName,
                            dateOfBirth: dob,
                            email,
                            phone,
                            ssn,
                            address,
                            city,
                            state,
                            postalCode
                        },
                        task: taskId,
                        createdAt
                    }
                ]
            }
        },
        FETCH_EMPLOYMENT: {
            request: { id: taskId },
            response: {
                data: [
                    {
                        connector: { _id: 'PERM-CONNECTOR', branding: { color: '' }, name: connectorName },
                        company: { _id: 'PERM-COMPANY', branding: {}, name: companyName },
                        employment: {
                            employeeType,
                            employmentStatus,
                            jobTitle,
                            startDate,
                            employer: {
                                name: companyName,
                                address: {
                                    line1: '12345 Enterprise Rd',
                                    line2: 'Suite 105',
                                    city,
                                    state,
                                    postalCode,
                                    country: 'USA'
                                }
                            }
                        },
                        derivedOutputMetadata: { minimumMonthsOfEmployment: [] },
                        task: taskId,
                        createdAt
                    }
                ]
            }
        },
        FETCH_EMPLOYMENT_INCOME: {
            request: { id: taskId },
            response: {
                data: [
                    {
                        connector: { _id: 'PERM-CONNECTOR', branding: { color: '' }, name: connectorName },
                        company: { _id: 'PERM-COMPANY', branding: {}, name: companyName },
                        income: {
                            income: hourlyIncome,
                            incomeType: 'hourly',
                            annualIncome,
                            hourlyIncome,
                            netHourlyRate,
                            payCycle,
                            currentPayPeriodStart,
                            unpaidHoursInPayPeriod: 0
                        },
                        task: taskId,
                        createdAt
                    }
                ]
            }
        },
        FETCH_EMPLOYMENT_STATEMENTS: {
            request: { id: taskId },
            response: {
                data: [
                    {
                        connector: { _id: 'PERM-CONNECTOR', branding: { color: '' }, name: connectorName },
                        company: { _id: 'PERM-COMPANY', branding: {}, name: companyName },
                        statements,
                        task: taskId,
                        createdAt
                    }
                ]
            }
        }
    };
}

