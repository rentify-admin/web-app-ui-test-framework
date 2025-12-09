/**
 * CORRECTED Mock Data Generators for Permission Test Session Creation
 * 
 * This file provides FLAG-FREE mock data for:
 * - VERIDOCS_PAYLOAD (Bank Statement with EXACT name matching)
 * - ATOMIC_PAYLOAD (Employment with EXACT name matching)
 * 
 * Key Corrections:
 * 1. Exact name matching (normalized, consistent formatting)
 * 2. Sufficient income ($8000-10000/month) to avoid income ratio flags
 * 3. All transactions within 30-day recency window
 * 4. Consistent data alignment between bank statement and employment
 * 
 * NOTE: Identity uses Persona UI (external app), so we can't control mock data there.
 * The session user name should match what's entered in Persona UI.
 */

// Helper: Generate UUID
const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// Helper: ISO date
const isoDate = (d = new Date()) => {
    const date = new Date(d);
    date.setUTCHours(0, 0, 0, 0);
    return date.toISOString();
};

// Helper: Days ago (returns ISO date string)
const daysAgo = (n) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - n);
    return isoDate(d);
};

/**
 * Normalizes user name to ensure exact matching across all mock data
 * This prevents name mismatch flags by ensuring consistent formatting
 * 
 * @param {Object} userData - User data { first_name, last_name }
 * @returns {Object} Normalized name object
 */
function normalizeUserName(userData = {}) {
    const firstName = (userData.first_name || 'Permission').trim();
    const lastName = (userData.last_name || 'Test').trim();
    const fullName = `${firstName} ${lastName}`;
    
    return {
        first: firstName,
        last: lastName,
        full: fullName
    };
}

/**
 * Generates CORRECTED VERIDOCS_PAYLOAD for Financial Verification (Bank Statement)
 * 
 * Corrections:
 * - Account owner name matches session user name EXACTLY
 * - All transactions within 30-day recency window
 * - Sufficient income ($8000/month) to avoid income ratio flags
 * - Consistent transaction amounts with employment paystubs
 * 
 * @param {Object} userData - User data { first_name, last_name }
 * @returns {Object} Complete VERIDOCS_PAYLOAD structure
 */
export function getVeridocsBankStatementPayloadCorrect(userData = {}) {
    // Normalize name for exact matching
    const name = normalizeUserName(userData);
    
    // Generate dynamic dates (all within 30-day window)
    const createDate = (daysAgo) => {
        const date = new Date();
        date.setUTCDate(date.getUTCDate() - daysAgo);
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const year = date.getUTCFullYear();
        return `${month}/${day}/${year}`;
    };

    // All dates within 30-day recency window
    const dynamicDates = {
        day1: createDate(1),     // Most recent (within 30 days)
        day14: createDate(14),   // Middle (within 30 days)
        day28: createDate(28),   // Oldest (still within 30 days)
        day30: createDate(30)    // Boundary (within 30 days)
    };

    // ✅ CORRECTED: Use normalized full name EXACTLY as provided
    const accountOwnerName = name.full;

    // ✅ CORRECTED: Increased income to $4000 biweekly = ~$8000/month
    // This ensures income ratio is well below thresholds (rent $2500 / income $8000 = 31%)
    const payrollAmount = 4000; // Biweekly payroll deposit
    
    // 6 transactions: 3 employment income + 3 expenses
    // All income transactions within 30-day window
    const transactions = [
        // Employment Income #1 (most recent)
        {
            "type": "credit",
            "description": "Payroll Deposit Employment",
            "date": dynamicDates.day1,
            "amount": payrollAmount,
            "balance": 15000.00,
            "page_number": 2
        },
        // Employment Income #2
        {
            "type": "credit",
            "description": "Payroll Deposit Employment",
            "date": dynamicDates.day14,
            "amount": payrollAmount,
            "balance": 11000.00,
            "page_number": 2
        },
        // Employment Income #3
        {
            "type": "credit",
            "description": "Payroll Deposit Employment",
            "date": dynamicDates.day28,
            "amount": payrollAmount,
            "balance": 7000.00,
            "page_number": 2
        },
        // Expense #1
        {
            "type": "debit",
            "description": "Grocery Store Purchase",
            "date": dynamicDates.day1,
            "amount": -150,
            "balance": 14850.00,
            "page_number": 2
        },
        // Expense #2
        {
            "type": "debit",
            "description": "Utility Payment",
            "date": dynamicDates.day14,
            "amount": -200,
            "balance": 10800.00,
            "page_number": 2
        },
        // Expense #3
        {
            "type": "debit",
            "description": "Rent Payment",
            "date": dynamicDates.day28,
            "amount": -1500,
            "balance": 8500.00,
            "page_number": 2
        }
    ];

    // Calculate totals
    const totalCredits = payrollAmount * 3; // 3 × $4000 = $12000
    const totalDebits = 1850.00;  // $150 + $200 + $1500
    const balanceStart = 7000.00;
    const balanceEnd = balanceStart + totalCredits - totalDebits;

    return {
        "documents": [
            {
                "id": "AUTOGENERATE",
                "file_name": "permission_test_bank_statement_correct.pdf",
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
                            "accounts": [
                                {
                                    "account_type": "Checking",
                                    "account_number": "9876543210",
                                    "account_name": "checking account",
                                    "account_owners": [
                                        { 
                                            // ✅ CRITICAL: Use normalized full name EXACTLY
                                            "name": accountOwnerName
                                        }
                                    ],
                                    "balance_start_date": dynamicDates.day30,
                                    "balance_end_date": dynamicDates.day1,
                                    "balance_total_start": balanceStart,
                                    "balance_total_end": balanceEnd,
                                    "total_credits": totalCredits,
                                    "total_debits": totalDebits,
                                    "transactions": transactions
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
 * Generates CORRECTED ATOMIC_PAYLOAD for Employment Verification
 * 
 * Corrections:
 * - Employee name matches session user name EXACTLY
 * - Income matches bank statement deposits ($4000 biweekly = ~$8000/month)
 * - Paystub dates align with bank statement deposit dates
 * - Sufficient income to avoid income ratio flags
 * 
 * @param {Object} userData - User data { first_name, last_name, email }
 * @returns {Object} Complete ATOMIC_PAYLOAD structure
 */
export function getAtomicEmploymentPayloadCorrect(userData = {}) {
    // Normalize name for exact matching
    const name = normalizeUserName(userData);
    
    const taskId = 'PERM-TEST-' + Math.random().toString(36).slice(2, 10);
    const createdAt = isoDate();
    const connectorName = 'Paytomic';
    const companyName = 'Permission Test Company Inc.';

    // ✅ CORRECTED: Use normalized names EXACTLY
    const firstName = name.first;
    const lastName = name.last;
    const email = userData.email || 'test@example.com';
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

    // ✅ CORRECTED: Increased income to match bank statement
    // $4000 biweekly = ~$104,000 annual = ~$8000/month gross
    const hourlyIncome = 50.00; // ~$104k annual (50 * 40 * 52)
    const annualIncome = 104000;
    const netHourlyRate = 38.50; // ~77% after taxes
    const payCycle = 'biweekly';
    const currentPayPeriodStart = daysAgo(7);

    // ✅ CORRECTED: Generate 3 paystubs with dates matching bank statement deposits
    // Dates: day 1, day 14, day 28 (all within 30-day window)
    const statements = [];
    const paystubDates = [
        { start: 15, end: 1, payDate: 1 },   // Matches bank deposit on day 1
        { start: 29, end: 15, payDate: 14 }, // Matches bank deposit on day 14
        { start: 43, end: 29, payDate: 28 }  // Matches bank deposit on day 28
    ];
    
    for (let i = 0; i < 3; i++) {
        const { start, end, payDate } = paystubDates[i];
        const payPeriodStartDate = daysAgo(start);
        const payPeriodEndDate = daysAgo(end);
        const payDateStr = daysAgo(payDate);
        
        const hoursPerPeriod = 80; // 2 weeks * 40 hours
        const gross = Math.round(hourlyIncome * hoursPerPeriod * 100) / 100; // $4000
        const net = Math.round(gross * 0.77 * 100) / 100; // ~$3080
        
        statements.push({
            date: payDateStr,
            payPeriodStartDate: payPeriodStartDate,
            payPeriodEndDate: payPeriodEndDate,
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
                            // ✅ CRITICAL: Use normalized names EXACTLY
                            firstName: firstName,
                            lastName: lastName,
                            dateOfBirth: dob,
                            email: email,
                            phone: phone,
                            ssn: ssn,
                            address: address,
                            city: city,
                            state: state,
                            postalCode: postalCode
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

