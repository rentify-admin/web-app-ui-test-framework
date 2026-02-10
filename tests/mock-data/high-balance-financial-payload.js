const highBalanceBankStatementData = (userData = null) => {
    // --- Helper function for dynamic date generation
    const createDate = (daysAgo) => {
        const date = new Date();
        date.setUTCDate(date.getUTCDate() - daysAgo);
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const year = date.getUTCFullYear();
        return `${month}/${day}/${year}`;
    };

    // --- Dynamic dates
    const dynamicDates = {
        day1: createDate(1),     // Most recent
        day5: createDate(5),
        day10: createDate(10),
        day12: createDate(12),
        day15: createDate(15),
        day18: createDate(18),
        day20: createDate(20),
        day22: createDate(22),
        day25: createDate(25),
        day28: createDate(28),
        day30: createDate(30)    // Oldest
    };

    // Use applicant name or default (unchanged)
    const accountOwnerName = userData ? `${userData.first_name} ${userData.last_name}` : 'Heartbeat Test User';

    // ---------------------------------------------
    // --- MODIFIED FINANCIAL DATA ---

    // Define the new base starting balance (≥ $500,000 per ticket requirement)
    const BASE_START_BALANCE = 550000.00;

    // Define the large transaction amounts (unchanged from the last modification)
    const newTransactionsData = [
        { "type": "debit", "description": "Transfer-From-Savings-APItest", "date": dynamicDates.day30, "amount": -15000, "page_number": 2 },
        { "type": "debit", "description": "Mortgage-Payment-APItest", "date": dynamicDates.day28, "amount": -20000, "page_number": 2 },
        { "type": "credit", "description": "Payroll-Deposit-APItest", "date": dynamicDates.day25, "amount": 35000, "page_number": 2 },
        { "type": "debit", "description": "Transfer-To-Account-APItest", "date": dynamicDates.day22, "amount": -12000, "page_number": 2 },
        { "type": "credit", "description": "Payroll-Deposit-APItest", "date": dynamicDates.day10, "amount": 18000, "page_number": 2 }
    ];

    // Calculate new balances based on the new amounts and **$200,000.00** starting balance
    let currentBalance = BASE_START_BALANCE;
    let totalCredits = 0;
    let totalDebits = 0;

    const calculatedTransactions = newTransactionsData.map(t => {
        // Ensure amount is signed correctly for calculation
        const amount = t.type === 'debit' ? -Math.abs(t.amount) : Math.abs(t.amount);

        // Update totals
        if (t.type === 'credit') {
            totalCredits += amount;
        } else {
            // totalDebits sums the positive value of the debit amount
            totalDebits += Math.abs(amount);
        }

        // Calculate the new balance
        currentBalance += amount;

        // Create the transaction object with the calculated balance
        return {
            ...t,
            "amount": amount, // Use the signed amount for the transaction
            "balance": parseFloat(currentBalance.toFixed(2)) // Format to 2 decimal places
        };
    });

    // Final balances and totals
    const balanceTotalStart = BASE_START_BALANCE;
    const balanceTotalEnd = parseFloat(currentBalance.toFixed(2));

    // ---------------------------------------------

    return {
        "documents": [
            {
                "id": "AUTOGENERATE",
                "file_name": "wells_fargo_1_2025_pdf",
                "reference_id": null,
                "qualifier": "development",
                "documents": [
                    {
                        "order": 1,
                        "pages": [
                            { "number": 1, "path": "7c2edac9-d1b3-450b-b740-b8d271d850dc/_images/page_1.jpg", "size": 57013 },
                            { "number": 2, "path": "7c2edac9-d1b3-450b-b740-b8d271d850dc/_images/page_2.jpg", "size": 89949 },
                            { "number": 3, "path": "7c2edac9-d1b3-450b-b740-b8d271d850dc/_images/page_3.jpg", "size": 77723 },
                            { "number": 4, "path": "7c2edac9-d1b3-450b-b740-b8d271d850dc/_images/page_4.jpg", "size": 102406 },
                            { "number": 5, "path": "7c2edac9-d1b3-450b-b740-b8d271d850dc/_images/page_5.jpg", "size": 60698 }
                        ],
                        "page_start": 1,
                        "page_end": 5,
                        "language": "en_US",
                        "extraction_hints": {
                            "period_start_date": dynamicDates.day30,
                            "period_end_date": dynamicDates.day1,
                            "accounts": [
                                { "name": "primary account", "number": "1234567890", "start_page": 1, "end_page": 5 }
                            ]
                        },
                        "type": "bank_statement",
                        "subtype": "wells_fargo",
                        "confidence": {
                            "score": 99,
                            "reasoning": "The document clearly identifies itself as 'Wells Fargo Everyday Checking' and includes the Wells Fargo logo on all pages. It contains an account summary, detailed transaction history, account holder information, account number, statement period dates (January 31, 2025), and beginning/ending balances. Pages 3-5 contain disclosures and a worksheet related to the account, which are typical components of a bank statement. All rules for a bank statement are met, including the presence of a bank logo, bank name, and financial transactions/summaries. The specific mention of 'Wells Fargo' identifies the subtype as 'wells_fargo'."
                        },
                        "data": {
                            "institution_name": "Wells Fargo",
                            "bank_country": "US",
                            "bank_account_currency": "USD",
                            "accounts": [
                                {
                                    "account_type": "Checking",
                                    "account_number": "1234567890",
                                    "account_name": "primary account",
                                    "account_owners": [
                                        { "name": accountOwnerName }
                                    ],
                                    "balance_start_date": dynamicDates.day30,
                                    "balance_end_date": dynamicDates.day1,
                                    // MODIFIED BALANCES
                                    "balance_total_start": balanceTotalStart,
                                    "balance_total_end": balanceTotalEnd,
                                    "total_credits": totalCredits,
                                    "total_debits": totalDebits,
                                    // MODIFIED TRANSACTIONS
                                    "transactions": calculatedTransactions
                                }
                            ]
                        },
                        "metadata": {
                            "cost_usd": 0,
                            "elapsed_time": 14.6042375564575,
                            "llm_model": "gemini-2.0-flash"
                        }
                    }
                ],
                "metadata": {
                    "warnings": [],
                    "pages_converted_count": 5,
                    "pages_total_file_size": 387789,
                    "pages_extracted_count": 5,
                    "classification_attempts": 1,
                    "extraction_attempts": 1,
                    "cost_usd": 0,
                    "elapsed_time": 40.33,
                    "elapsed_time_image_conversion": 1.99,
                    "elapsed_time_classification": 22.56,
                    "elapsed_time_extraction": 14.9,
                    "classification_original_amount_of_documents": 1,
                    "classification_merged_amount_of_documents": 1,
                    "pages_classified_count": 5,
                    "classification_model_used": "gemini-2.5-flash",
                    "classification_fallback_used": false
                }
            }
        ]
    };
}

function getBankStatementData(userData = null, multiply = 30) {
    // --- Helper function for dynamic date generation
    const createDate = (daysAgo) => {
        const date = new Date();
        date.setUTCDate(date.getUTCDate() - daysAgo);
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const year = date.getUTCFullYear();
        return `${month}/${day}/${year}`;
    };

    // --- Dynamic dates
    const dynamicDates = {
        day1: createDate(1),     // Most recent
        day5: createDate(5),
        day10: createDate(10),
        day12: createDate(12),
        day15: createDate(15),
        day18: createDate(18),
        day20: createDate(20),
        day22: createDate(22),
        day25: createDate(25),
        day28: createDate(28),
        day30: createDate(30)    // Oldest
    };

    // Use applicant name or default (unchanged)
    const accountOwnerName = userData ? `${userData.first_name} ${userData.last_name}` : 'Heartbeat Test User';

    // ---------------------------------------------
    // --- MODIFIED FINANCIAL DATA ---

    // Define the new base starting balance (≥ $500,000 per ticket requirement)
    const BASE_START_BALANCE = 18400 * multiply;

    // Define the large transaction amounts (unchanged from the last modification)
    const newTransactionsData = [
        { "type": "debit", "description": "Transfer-From-Savings-APItest", "date": dynamicDates.day30, "amount": -500 * multiply, "page_number": 2 },
        { "type": "debit", "description": "Mortgage-Payment-APItest", "date": dynamicDates.day28, "amount": -666 * multiply, "page_number": 2 },
        { "type": "credit", "description": "Payroll-Deposit-APItest", "date": dynamicDates.day25, "amount": 1100 * multiply, "page_number": 2 },
        { "type": "debit", "description": "Transfer-To-Account-APItest", "date": dynamicDates.day22, "amount": -400 *multiply, "page_number": 2 },
        { "type": "credit", "description": "Payroll-Deposit-APItest", "date": dynamicDates.day10, "amount": 600 * multiply, "page_number": 2 }
    ];

    // Calculate new balances based on the new amounts and **$200,000.00** starting balance
    let currentBalance = BASE_START_BALANCE;
    let totalCredits = 0;
    let totalDebits = 0;

    const calculatedTransactions = newTransactionsData.map(t => {
        // Ensure amount is signed correctly for calculation
        const amount = t.type === 'debit' ? -Math.abs(t.amount) : Math.abs(t.amount);

        // Update totals
        if (t.type === 'credit') {
            totalCredits += amount;
        } else {
            // totalDebits sums the positive value of the debit amount
            totalDebits += Math.abs(amount);
        }

        // Calculate the new balance
        currentBalance += amount;

        // Create the transaction object with the calculated balance
        return {
            ...t,
            "amount": amount, // Use the signed amount for the transaction
            "balance": parseFloat(currentBalance.toFixed(2)) // Format to 2 decimal places
        };
    });

    // Final balances and totals
    const balanceTotalStart = BASE_START_BALANCE;
    const balanceTotalEnd = parseFloat(currentBalance.toFixed(2));

    // ---------------------------------------------

    return {
        "documents": [
            {
                "id": "AUTOGENERATE",
                "file_name": "wells_fargo_1_2025_pdf",
                "reference_id": null,
                "qualifier": "development",
                "documents": [
                    {
                        "order": 1,
                        "pages": [
                            { "number": 1, "path": "7c2edac9-d1b3-450b-b740-b8d271d850dc/_images/page_1.jpg", "size": 57013 },
                            { "number": 2, "path": "7c2edac9-d1b3-450b-b740-b8d271d850dc/_images/page_2.jpg", "size": 89949 },
                            { "number": 3, "path": "7c2edac9-d1b3-450b-b740-b8d271d850dc/_images/page_3.jpg", "size": 77723 },
                            { "number": 4, "path": "7c2edac9-d1b3-450b-b740-b8d271d850dc/_images/page_4.jpg", "size": 102406 },
                            { "number": 5, "path": "7c2edac9-d1b3-450b-b740-b8d271d850dc/_images/page_5.jpg", "size": 60698 }
                        ],
                        "page_start": 1,
                        "page_end": 5,
                        "language": "en_US",
                        "extraction_hints": {
                            "period_start_date": dynamicDates.day30,
                            "period_end_date": dynamicDates.day1,
                            "accounts": [
                                { "name": "primary account", "number": "1234567890", "start_page": 1, "end_page": 5 }
                            ]
                        },
                        "type": "bank_statement",
                        "subtype": "wells_fargo",
                        "confidence": {
                            "score": 99,
                            "reasoning": "The document clearly identifies itself as 'Wells Fargo Everyday Checking' and includes the Wells Fargo logo on all pages. It contains an account summary, detailed transaction history, account holder information, account number, statement period dates (January 31, 2025), and beginning/ending balances. Pages 3-5 contain disclosures and a worksheet related to the account, which are typical components of a bank statement. All rules for a bank statement are met, including the presence of a bank logo, bank name, and financial transactions/summaries. The specific mention of 'Wells Fargo' identifies the subtype as 'wells_fargo'."
                        },
                        "data": {
                            "institution_name": "Wells Fargo",
                            "bank_country": "US",
                            "bank_account_currency": "USD",
                            "accounts": [
                                {
                                    "account_type": "Checking",
                                    "account_number": "1234567890",
                                    "account_name": "primary account",
                                    "account_owners": [
                                        { "name": accountOwnerName }
                                    ],
                                    "balance_start_date": dynamicDates.day30,
                                    "balance_end_date": dynamicDates.day1,
                                    // MODIFIED BALANCES
                                    "balance_total_start": balanceTotalStart,
                                    "balance_total_end": balanceTotalEnd,
                                    "total_credits": totalCredits,
                                    "total_debits": totalDebits,
                                    // MODIFIED TRANSACTIONS
                                    "transactions": calculatedTransactions
                                }
                            ]
                        },
                        "metadata": {
                            "cost_usd": 0,
                            "elapsed_time": 14.6042375564575,
                            "llm_model": "gemini-2.0-flash"
                        }
                    }
                ],
                "metadata": {
                    "warnings": [],
                    "pages_converted_count": 5,
                    "pages_total_file_size": 387789,
                    "pages_extracted_count": 5,
                    "classification_attempts": 1,
                    "extraction_attempts": 1,
                    "cost_usd": 0,
                    "elapsed_time": 40.33,
                    "elapsed_time_image_conversion": 1.99,
                    "elapsed_time_classification": 22.56,
                    "elapsed_time_extraction": 14.9,
                    "classification_original_amount_of_documents": 1,
                    "classification_merged_amount_of_documents": 1,
                    "pages_classified_count": 5,
                    "classification_model_used": "gemini-2.5-flash",
                    "classification_fallback_used": false
                }
            }
        ]
    };
}


function getBankData(user, options = {}) {
    const daysAgoFirst = options.daysAgoFirst || 14;
    const daysAgoSecond = options.daysAgoSecond || 28;

    const firstDate = new Date();
    firstDate.setUTCDate(firstDate.getUTCDate() - daysAgoFirst);
    firstDate.setUTCHours(0, 0, 0, 0);

    const secondDate = new Date();
    secondDate.setUTCDate(secondDate.getUTCDate() - daysAgoSecond);
    secondDate.setUTCHours(0, 0, 0, 0);

    const accountNumber = options.accountNumber || "1234567890";
    const institutionName = options.institutionName || "Test Bank";
    const accountName = options.accountName || "Checking Account";
    const balance = options.balance || 12500.00;
    const amount = options.amount || 6000.00;

    return {
        id: null,
        institutions: [{
            name: institutionName,
            accounts: [
                {
                    id: null,
                    account_number: accountNumber,
                    name: accountName,
                    type: "checking",
                    balance: balance,
                    currency: "USD",
                    owner: {
                        first_name: user.first_name,
                        last_name: user.last_name,
                        email: user.email,
                        address: {
                            street: "123 Test St",
                            city: "Test City",
                            state: "CA",
                            postal_code: "90210",
                            country: "US"
                        }
                    },
                    transactions: [
                        {
                            id: null,
                            date: firstDate.toISOString().split('T')[0],
                            amount: amount,
                            description: "Payroll Deposit",
                            category: "income"
                        },
                        {
                            id: null,
                            date: secondDate.toISOString().split('T')[0],
                            amount: amount,
                            description: "Payroll Deposit",
                            category: "income"
                        }
                    ]
                }
            ]
        }]
    }
}

/**
 * Generate test bank data for a user with configurable months/income types.
 * 
 * @param {Object} user - The user object (first_name, last_name, email, etc).
 * @param {Object} [options] - Optional parameters:
 *   - months: number of months to generate transactions for (default 3)
 *   - incomeOtherTypes: array of other income types (default included)
 *   - paycheckAmounts: array of paycheck amounts (e.g. [1000, 1200]), used randomly (default [1000, 1200, 1500])
 *   - payDates: array of paycheck date number(s) in a month (e.g [1, 15])
 */
function getBankConnectionData(
    user,
    options = {}
) {
    // --- Parse options with defaults
    const months = options.months || 3;
    const incomeOtherTypes = options.incomeOtherTypes || [
        { description: "Investment Income", amount: 800 },
        { description: "Side Business Income", amount: 1200 },
        { description: "Freelance", amount: 1100 },
    ];
    const paycheckAmounts = options.paycheckAmounts || [1000, 1200, 1500];
    const payDates = Array.isArray(options.payDates) ? options.payDates : [1, 15];

    // Utility to format date as yyyy-mm-dd
    function formatDateISO(d) {
        return d.toISOString().split('T')[0];
    }

    // Get today's date at midnight for consistency
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Generate date objects for the past n months (EXCLUDING current month)
    // E.g. if today is June 2024, and months=3, it'll generate March, April, May (not June)
    const transactionMonths = [];
    for (let i = months; i > 0; i--) {
        const stamp = new Date(today);
        stamp.setMonth(stamp.getMonth() - i);
        transactionMonths.push({
            year: stamp.getFullYear(),
            month: stamp.getMonth()
        });
    }

    // Generate dynamic transactions
    const transactions = [];
    let transactionId = 1;

    // Utility to randomize a day in the month, but keep it within the current/valid days (avoid very end of month)
    function getRandomDay(year, month, date = null) {
        // Always use the full month's length since current month is excluded
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        return date || 1 + Math.floor(Math.random() * Math.max(daysInMonth - 3, 1));
    }

    // For each month: paycheck incomes must be exactly as passed in payDates, amounts chosen per config
    transactionMonths.forEach(({ year, month }) => {
        // Paycheck incomes at exactly payDates for the month, each date once (unless duplicates in payDates array)
        payDates.forEach((payDate, idx) => {
            // Clamp to month days if payDate passed is too big
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const validDay = Math.max(1, Math.min(payDate, daysInMonth));
            const amount = paycheckAmounts[Math.min(idx, paycheckAmounts.length - 1)] || paycheckAmounts[0];
            const date = new Date(Date.UTC(year, month, validDay, 0, 0, 0, 0));
            transactions.push({
                id: null,
                date: formatDateISO(date),
                amount: amount,
                description: "Paycheck",
                category: "income"
            });
        });

        // Add all "other" income types (one entry each per month, random days)
        incomeOtherTypes.forEach((itype, idx) => {
            const day = Math.min(getRandomDay(year, month), 26) + (idx % 3);
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const validDay = Math.max(1, Math.min(day, daysInMonth));
            const date = new Date(Date.UTC(year, month, validDay, 0, 0, 0, 0));
            transactions.push({
                id: null,
                date: formatDateISO(date),
                amount: itype.amount,
                description: itype.description,
                category: "income"
            });
        });

        // 4-6 expense transactions (random dates)
        const expenseTypes = [
            { description: "Grocery Store", category: "groceries", min: 60, max: 180 },
            { description: "Online Shopping", category: "shopping", min: 30, max: 220 },
            { description: "Pharmacy", category: "health", min: 18, max: 75 },
            { description: "Restaurant", category: "dining", min: 50, max: 120 },
            { description: "Gas Station", category: "transportation", min: 40, max: 90 }
        ];
        const expensesThisMonth = 4 + Math.floor(Math.random() * 3); // 4, 5, or 6
        for (let i = 0; i < expensesThisMonth; i++) {
            const expenseIdx = i % expenseTypes.length;
            const expenseBase = expenseTypes[expenseIdx];
            const randDay = Math.min(getRandomDay(year, month), 27) + (i % 3); // More spacing
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const validDay = Math.max(1, Math.min(randDay, daysInMonth));
            const date = new Date(Date.UTC(year, month, validDay, 0, 0, 0, 0));
            const amount = (Math.round(expenseBase.min + Math.random() * (expenseBase.max - expenseBase.min)));
            transactions.push({
                id: `txn_exp_${transactionId++}`,
                date: formatDateISO(date),
                amount: -amount,
                description: expenseBase.description,
                category: expenseBase.category
            });
        }
    });

    // Sort transactions by date (most recent first)
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
        id: null,
        institutions: [{
            name: "Test Bank",
            accounts: [
                {
                    id: null,
                    account_number: "1234567890",
                    name: "Checking Account",
                    type: "checking",
                    balance: 12500.00,
                    currency: "USD",
                    owner: {
                        first_name: user.first_name,
                        last_name: user.last_name,
                        email: user.email,
                        address: {
                            street: "123 Test St",
                            city: "Test City",
                            state: "CA",
                            postal_code: "90210",
                            country: "US"
                        }
                    },
                    transactions: transactions
                }
            ]
        }]
    }
}

export { highBalanceBankStatementData, getBankData, getBankStatementData, getBankConnectionData };