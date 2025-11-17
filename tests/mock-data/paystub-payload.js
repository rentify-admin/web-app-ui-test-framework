function createPaystubData(payPeriod = 1) {
    // Create dynamic dates in MM/DD/YYYY format
    const createDateMMDDYYYY = (daysAgo) => {
        const date = new Date();
        date.setUTCDate(date.getUTCDate() - daysAgo);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        return `${month}/${day}/${year}`;
    };

    // Calculate bi-weekly pay periods (14 days apart)
    const baseDaysAgo = (payPeriod - 1) * 14 + 7; // Start from 7 days ago, then go back 14 days each period
    const payDate = createDateMMDDYYYY(baseDaysAgo);
    const periodStart = createDateMMDDYYYY(baseDaysAgo + 14); // 14 days before pay date (BIWEEKLY period)
    const periodEnd = createDateMMDDYYYY(baseDaysAgo); // Same as pay date

    return {
        "id": "AUTOGENERATE",
        "file_name": `heartbeat-employment-paystub-${payPeriod}.pdf`,
        "reference_id": null,
        "qualifier": "development",
        "documents": [
            {
                "order": 1,
                "pages": [
                    {
                        "number": 1,
                        "path": `heartbeat-employment-${payPeriod}/_images/page_1.jpg`,
                        "size": 134687
                    }
                ],
                "page_start": 1,
                "page_end": 1,
                "language": "en_US",
                "extraction_hints": {
                    "period_start_date": periodStart,
                    "period_end_date": periodEnd
                },
                "type": "pay_stub",
                "subtype": "",
                "confidence": {
                    "score": 95,
                    "reasoning": "The document is classified as a pay stub because it clearly displays the employer's name ('STAFFING & PAYROLL ALTERNATIVES, INC.' and 'FOLIAGE FACTORY LANDSCAPE, INC.'), the employee's name ('Roberto Almendarez Cruz'), a pay period, a check date, gross pay (888.00), net pay (792.80), and detailed deductions and taxes. Both net pay and gross pay are explicitly visible, fulfilling a key rule for this document type."
                },
                "data": {
                    "employer_name": "FOLIAGE FACTORY LANDSCAPE, INC.",
                    "employee_name": "Roberto Almendarez Cruz",
                    "period_start": periodStart,
                    "period_end": periodEnd,
                    "pay_date": payDate,
                    "gross_pay": 888,
                    "net_pay": 792.8,
                    "deposits": [
                        {
                            "account_name": "CHECKING Acct: ************9647",
                            "amount": 792.8
                        }
                    ],
                    "deductions": [
                        {
                            "title": "Soc Sec",
                            "amount": 55.06
                        },
                        {
                            "title": "Federal Income Tax",
                            "amount": 27.26
                        },
                        {
                            "title": "Medicare",
                            "amount": 12.88
                        },
                        {
                            "title": "GUARDIAN LIFE 10K",
                            "amount": 0
                        }
                    ],
                    "ytd_gross": "888.00",
                    "ytd_net": "792.80"
                },
                "metadata": {
                    "cost_usd": 0,
                    "elapsed_time": 9.4570255279541,
                    "llm_model": "gemini-2.5-flash"
                }
            }
        ],
        "metadata": {
            "steps": [
                {
                    "type": "template_extraction",
                    "document_type": "pay_stub",
                    "document_order": 1,
                    "template_id": "default_1_120",
                    "template_name": "Default Template",
                    "steps_processed": 1,
                    "total_processing_time": "0:00:09.288278",
                    "step_details": [
                        {
                            "step_id": 1,
                            "step_name": "Complete Extraction",
                            "processing_time": "aggregated_across_pages"
                        }
                    ]
                }
            ],
            "warnings": [],
            "pages_converted_count": 1,
            "pages_total_file_size": 134687,
            "pages_extracted_count": 1,
            "classification_attempts": 1,
            "extraction_attempts": 1,
            "cost_usd": 0,
            "elapsed_time": 26.04,
            "elapsed_time_image_conversion": 0.51,
            "elapsed_time_classification": 14.77,
            "elapsed_time_extraction": 10.01,
            "classification_original_amount_of_documents": 1,
            "classification_merged_amount_of_documents": 1,
            "pages_classified_count": 1,
            "classification_model_used": "balanced",
            "classification_fallback_used": false
        }
    };
}

export {
    createPaystubData
}