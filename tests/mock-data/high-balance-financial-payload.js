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

export { highBalanceBankStatementData };