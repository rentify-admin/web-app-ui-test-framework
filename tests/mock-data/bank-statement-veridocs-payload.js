const veriDocsBankStatementData = (userData = null) => {
    // Generate dynamic dates - recent dates to avoid old transactions
    const createDate = (daysAgo) => {
        const date = new Date();
        date.setUTCDate(date.getUTCDate() - daysAgo);
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const year = date.getUTCFullYear();
        return `${month}/${day}/${year}`;
    };

    // Generate dynamic dates for the statement period (last 30 days)
    const dynamicDates = {
        day1: createDate(1),    // Most recent
        day5: createDate(5),
        day10: createDate(10),
        day12: createDate(12),
        day15: createDate(15),
        day18: createDate(18),
        day20: createDate(20),
        day22: createDate(22),
        day25: createDate(25),
        day28: createDate(28),
        day30: createDate(30)   // Oldest
    };

    // Use applicant name or default
    const accountOwnerName = userData ? `${userData.first_name} ${userData.last_name}` : 'Heartbeat Test User';

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
                            {
                                "number": 1,
                                "path": "7c2edac9-d1b3-450b-b740-b8d271d850dc/_images/page_1.jpg",
                                "size": 57013
                            },
                            {
                                "number": 2,
                                "path": "7c2edac9-d1b3-450b-b740-b8d271d850dc/_images/page_2.jpg",
                                "size": 89949
                            },
                            {
                                "number": 3,
                                "path": "7c2edac9-d1b3-450b-b740-b8d271d850dc/_images/page_3.jpg",
                                "size": 77723
                            },
                            {
                                "number": 4,
                                "path": "7c2edac9-d1b3-450b-b740-b8d271d850dc/_images/page_4.jpg",
                                "size": 102406
                            },
                            {
                                "number": 5,
                                "path": "7c2edac9-d1b3-450b-b740-b8d271d850dc/_images/page_5.jpg",
                                "size": 60698
                            }
                        ],
                        "page_start": 1,
                        "page_end": 5,
                        "language": "en_US",
                        "extraction_hints": {
                            "period_start_date": dynamicDates.day30,
                            "period_end_date": dynamicDates.day1,
                            "accounts": [
                                {
                                    "name": "primary account",
                                    "number": "1234567890",
                                    "start_page": 1,
                                    "end_page": 5
                                }
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
                                        {
                                            "name": accountOwnerName
                                        }
                                    ],
                                    "balance_start_date": dynamicDates.day30,
                                    "balance_end_date": dynamicDates.day1,
                                    "balance_total_start": 10500.00,
                                    "balance_total_end": 10000.00,
                                    "total_credits": 2000.00,
                                    "total_debits": 2000.00,
                                    "transactions": [
                                        {
                                            "type": "debit",
                                            "description": "Transfer-From-Savings-APItest",
                                            "date": dynamicDates.day30,
                                            "amount": -1000,
                                            "balance": 9500.00,
                                            "page_number": 2
                                        },
                                        {
                                            "type": "debit",
                                            "description": "Mortgage-Payment-APItest",
                                            "date": dynamicDates.day28,
                                            "amount": -1000,
                                            "balance": 8500.00,
                                            "page_number": 2
                                        },
                                        {
                                            "type": "credit",
                                            "description": "Payroll-Deposit-APItest",
                                            "date": dynamicDates.day25,
                                            "amount": 1000,
                                            "balance": 9500.00,
                                            "page_number": 2
                                        },
                                        {
                                            "type": "debit",
                                            "description": "Transfer-To-Account-APItest",
                                            "date": dynamicDates.day22,
                                            "amount": -500,
                                            "balance": 9000.00,
                                            "page_number": 2
                                        },
                                        {
                                            "type": "credit",
                                            "description": "Payroll-Deposit-APItest",
                                            "date": dynamicDates.day10,
                                            "amount": 1000,
                                            "balance": 10000.00,
                                            "page_number": 2
                                        }
                                    ]
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
};

/**
 * Helper for cadence in number of days
 */
const getCadenceDays = (cadence) => {
    switch (cadence) {
        case 'weekly': return 7;
        case 'semiweekly': return 3; // 2 per week ~ every 3 days
        case 'monthly': return 30;
        case 'semimonthly': return 15;
        case 'quarterly': return 90;
        case 'halfyearly': return 182;
        case 'yearly': return 365;
        default: return 30; // default monthly
    }
};

/**
 * Returns a veridocs payload with customizable number/cadence of payrolls, extra credits & miscellaneous txns
 * @param userData
 * @param payrollCount
 * @param payrollCadence: 'weekly'|'semiweekly'|'monthly'|'semimonthly'|'quarterly'|'halfyearly'|'yearly'
 * @param miscCount
 * @param opts: {
 *   debitAmount,
 *   creditAmount,
 *   miscDescriptions,
 *   payrollDescription,
 *   startBalance,
 *   extraCreditCount,
 *   extraCreditDescriptions,
 *   extraCreditAmount
 * }
 */
const customVeriDocsBankStatementData = (
    userData = null,
    payrollCount = 2,
    payrollCadence = 'monthly',
    miscCount = 3,
    opts = {}
) => {
    const createDate = (daysAgo) => {
        const date = new Date();
        date.setUTCDate(date.getUTCDate() - daysAgo);
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const year = date.getUTCFullYear();
        return `${month}/${day}/${year}`;
    };

    const todayAgo = 1;
    const periodDays = 30;
    const startPeriodAgo = todayAgo + periodDays - 1;
    const period_start_date = createDate(startPeriodAgo);
    const period_end_date = createDate(todayAgo);

    const accountOwnerName = userData ? `${userData.first_name} ${userData.last_name}` : 'Heartbeat Test User';

    // Payroll transactions
    const payrollTxs = [];
    const payrollDesc = opts.payrollDescription || 'Payroll-Deposit-APItest';
    const payrollAmount = opts.creditAmount ?? 1000;
    const payrollCadenceDays = getCadenceDays(payrollCadence);

    let firstPayrollAgo = startPeriodAgo + (payrollCadenceDays * Math.max(payrollCount-1,0));
    if (firstPayrollAgo > periodDays + todayAgo - 1) firstPayrollAgo = periodDays + todayAgo - 1;
    for (let i = 0; i < payrollCount; ++i) {
        const daysAgo = startPeriodAgo + (payrollCadenceDays * (payrollCount - i - 1));
        if (daysAgo < todayAgo) break; // Don't make future txs
        payrollTxs.push({
            type: "credit",
            description: payrollDesc,
            date: createDate(daysAgo),
            amount: payrollAmount,
            page_number: 2,
        });
    }

    // Extra credit transactions (apart from payroll, dynamic count and descriptions)
    const extraCreditTxs = [];
    const extraCreditCount = opts.extraCreditCount ?? 0;
    const extraCreditDescriptions = opts.extraCreditDescriptions || [
        "Bonus-Cashback-APItest",
        "Gift-Deposit-APItest",
        "Refund-APItest",
        "Rewards-APItest"
    ];
    const extraCreditAmount = opts.extraCreditAmount ?? 200;

    if (extraCreditCount > 0) {
        for (let i = 0; i < extraCreditCount; ++i) {
            // Spread extra credits over the period or set them spaced out after payrolls and misc
            // For simplicity, start after all payrolls and misc have occupied their main intervals
            // We'll put them every few days from (todayAgo+3) onwards
            const txDaysAgo = todayAgo + 3 + Math.floor(((periodDays - 10) / (extraCreditCount + 1)) * i);
            extraCreditTxs.push({
                type: "credit",
                description: extraCreditDescriptions[i % extraCreditDescriptions.length],
                date: createDate(txDaysAgo),
                amount: extraCreditAmount,
                page_number: 2,
            });
        }
    }

    // Miscellaneous credit/debit transactions (alternating debits and misc descriptions)
    const miscTxs = [];
    const miscAmount = opts.debitAmount ?? -500;
    const miscDescriptions = opts.miscDescriptions || [
        "Transfer-From-Savings-APItest",
        "Mortgage-Payment-APItest",
        "Transfer-To-Account-APItest",
        "ATM-Withdrawal-APItest",
        "Online-Payment-APItest"
    ];
    // Space out misc transactions (don't overlap with payrolls)
    for (let i = 0; i < miscCount; ++i) {
        // Place in middle of interval between payrolls or randomly in range, but avoid today
        const txDaysAgo = todayAgo + 2 + Math.floor(((periodDays - 5) / miscCount) * i);
        miscTxs.push({
            type: "debit",
            description: miscDescriptions[i % miscDescriptions.length],
            date: createDate(txDaysAgo),
            amount: miscAmount,
            page_number: 2,
        });
    }

    // Combine & sort by date (descending, recent first)
    let allTxs = [...payrollTxs, ...extraCreditTxs, ...miscTxs];
    allTxs.sort((a, b) => {
        // Sort by daysAgo descending (most recent first)
        const getDaysAgo = (dateStr) => {
            const [month, day, year] = dateStr.split('/');
            const dt = new Date(`${year}-${month}-${day}`);
            const now = new Date();
            return Math.floor((now - dt) / (24 * 60 * 60 * 1000));
        };
        return getDaysAgo(a.date) - getDaysAgo(b.date);
    });

    // Calculate running balances if user wants
    let startBalance = opts.startBalance ?? 10500.00;
    let runningBalance = startBalance;
    for (let i = allTxs.length - 1; i >= 0; --i) {
        runningBalance += allTxs[i].amount;
        allTxs[i].balance = Number(runningBalance.toFixed(2));
    }
    // The first (oldest) txn's balance is after deduction; balance at end for API is balance after all txns
    let balance_total_start = startBalance;
    let balance_total_end = runningBalance;

    const docsPayload = {
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
                            {
                                "number": 1,
                                "path": "7c2edac9-d1b3-450b-b740-b8d271d850dc/_images/page_1.jpg",
                                "size": 57013
                            },
                            {
                                "number": 2,
                                "path": "7c2edac9-d1b3-450b-b740-b8d271d850dc/_images/page_2.jpg",
                                "size": 89949
                            },
                            {
                                "number": 3,
                                "path": "7c2edac9-d1b3-450b-b740-b8d271d850dc/_images/page_3.jpg",
                                "size": 77723
                            },
                            {
                                "number": 4,
                                "path": "7c2edac9-d1b3-450b-b740-b8d271d850dc/_images/page_4.jpg",
                                "size": 102406
                            },
                            {
                                "number": 5,
                                "path": "7c2edac9-d1b3-450b-b740-b8d271d850dc/_images/page_5.jpg",
                                "size": 60698
                            }
                        ],
                        "page_start": 1,
                        "page_end": 5,
                        "language": "en_US",
                        "extraction_hints": {
                            "period_start_date": period_start_date,
                            "period_end_date": period_end_date,
                            "accounts": [
                                {
                                    "name": "primary account",
                                    "number": "1234567890",
                                    "start_page": 1,
                                    "end_page": 5
                                }
                            ]
                        },
                        "type": "bank_statement",
                        "subtype": "wells_fargo",
                        "confidence": {
                            "score": 99,
                            "reasoning": "The document clearly identifies itself as 'Wells Fargo Everyday Checking' and includes the Wells Fargo logo on all pages. It contains an account summary, detailed transaction history, account holder information, account number, statement period dates, and beginning/ending balances. Typical components of a bank statement present."
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
                                        {
                                            "name": accountOwnerName
                                        }
                                    ],
                                    "balance_start_date": period_start_date,
                                    "balance_end_date": period_end_date,
                                    "balance_total_start": Number(balance_total_start.toFixed(2)),
                                    "balance_total_end": Number(balance_total_end.toFixed(2)),
                                    "total_credits": Number(allTxs.filter(t => t.amount > 0).reduce((a, t) => a + t.amount, 0).toFixed(2)),
                                    "total_debits": Number(allTxs.filter(t => t.amount < 0).reduce((a, t) => a + Math.abs(t.amount), 0).toFixed(2)),
                                    "transactions": allTxs
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

    return docsPayload;
};

export { veriDocsBankStatementData, customVeriDocsBankStatementData }