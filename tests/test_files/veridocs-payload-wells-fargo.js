/**
 * VERIDOCS_PAYLOAD mock data for Wells Fargo bank statement
 * This payload represents the exact structure returned by Veridocs API
 * Used for simulator-based financial verification testing
 */

export const getVeridocsPayloadWellsFargo = () => {
  return {
    "id": "7c2edac9-d1b3-450b-b740-b8d271d850dc",
    "file_name": "wells-fargo-1-2025.pdf",
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
          "period_start_date": "01/01/2025",
          "period_end_date": "01/31/2025",
          "accounts": [
            {
              "name": "primary account",
              "number": "6012656523",
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
              "account_number": "6012656523",
              "account_name": "primary account",
              "account_owners": [
                {
                  "name": "Terri L Starr"
                }
              ],
              "balance_start_date": "01/01/2025",
              "balance_end_date": "01/31/2025",
              "balance_total_start": 8274.33,
              "balance_total_end": 7670.07,
              "transactions": [
                {
                  "type": "debit",
                  "description": "Recurring Transfer to Starr A Wells Fargo Clear Access Banking Ref #Op0Qsgms7D xxxxxx5600",
                  "date": "01/02/2025",
                  "amount": -300,
                  "balance": null,
                  "page_number": 2
                },
                {
                  "type": "debit",
                  "description": "Newrez-Shellpoin ACH Pmt 241231 9785896532 Starr Terri",
                  "date": "01/02/2025",
                  "amount": -3057.26,
                  "balance": 4917.07,
                  "page_number": 2
                },
                {
                  "type": "debit",
                  "description": "Online Transfer to Starr A Wells Fargo Clear Access Banking xxxxxx3124 Ref #Ib0Qtysctj on 01/05/25",
                  "date": "01/06/2025",
                  "amount": -100,
                  "balance": 4817.07,
                  "page_number": 2
                },
                {
                  "type": "credit",
                  "description": "Prc Tax ID #14-Payroll 250108 01820000-0339-0 Terri Starr",
                  "date": "01/08/2025",
                  "amount": 3611.98,
                  "balance": 8429.05,
                  "page_number": 2
                },
                {
                  "type": "debit",
                  "description": "Online Transfer to Starr A Wells Fargo Clear Access Banking xxxxxx3124 Ref #lb0Qwbhmrs on 01/09/25",
                  "date": "01/09/2025",
                  "amount": -500,
                  "balance": 7929.05,
                  "page_number": 2
                },
                {
                  "type": "debit",
                  "description": "Zelle to Martinez Nanci on 01/11 Ref #Rp0Yfc5M9L 2427 Ownmy",
                  "date": "01/13/2025",
                  "amount": -125,
                  "balance": null,
                  "page_number": 2
                },
                {
                  "type": "debit",
                  "description": "Pl*Paylease Web Pmts 011325 9G1D57 Terri Starr",
                  "date": "01/13/2025",
                  "amount": -2,
                  "balance": null,
                  "page_number": 2
                },
                {
                  "type": "debit",
                  "description": "PI Stylecraftpro Web Pmts 011325 M83D57 Terri Starr",
                  "date": "01/13/2025",
                  "amount": -280,
                  "balance": 7522.05,
                  "page_number": 2
                },
                {
                  "type": "credit",
                  "description": "Mobile Deposit: Ref Number :207140405591",
                  "date": "01/14/2025",
                  "amount": 71.58,
                  "balance": 7593.63,
                  "page_number": 2
                },
                {
                  "type": "debit",
                  "description": "Discover E-Payment 250115 8572 Starr Terri",
                  "date": "01/15/2025",
                  "amount": -500,
                  "balance": 7093.63,
                  "page_number": 2
                },
                {
                  "type": "debit",
                  "description": "Online Transfer Ref #lb0Qyhsq25 to Wells Fargo Reflect VISA Card Xxxxxxxxxxxx3800 on 01/16/25",
                  "date": "01/16/2025",
                  "amount": -600,
                  "balance": 6493.63,
                  "page_number": 2
                },
                {
                  "type": "credit",
                  "description": "Mobile Deposit: Ref Number : 215170304480",
                  "date": "01/17/2025",
                  "amount": 1119.28,
                  "balance": null,
                  "page_number": 2
                },
                {
                  "type": "debit",
                  "description": "Online Transfer to Starr A Wells Fargo Clear Access Banking xxxxxx5600 Ref #Ib0Qyqztw7 on 01/17/25",
                  "date": "01/17/2025",
                  "amount": -500,
                  "balance": null,
                  "page_number": 2
                },
                {
                  "type": "debit",
                  "description": "Online Transfer to Starr A Wells Fargo Clear Access Banking xxxxxx3124 Ref #Ib0Qytfzly on 01/17/25",
                  "date": "01/17/2025",
                  "amount": -370,
                  "balance": null,
                  "page_number": 2
                },
                {
                  "type": "debit",
                  "description": "Zelle to Martinez Nanci on 01/17 Ref #Rp0Yftxsqv 2427 Ownby Jan 21 2025 Cleaning Peschio",
                  "date": "01/17/2025",
                  "amount": -125,
                  "balance": 6617.91,
                  "page_number": 2
                },
                {
                  "type": "debit",
                  "description": "Citi Card Online Payment 250120 431596110669187 Terri L Starr",
                  "date": "01/21/2025",
                  "amount": -300,
                  "balance": null,
                  "page_number": 2
                },
                {
                  "type": "debit",
                  "description": "Citi Card Online Payment 250120 431596110330260 Terri L Starr",
                  "date": "01/21/2025",
                  "amount": -1000,
                  "balance": 5317.91,
                  "page_number": 2
                },
                {
                  "type": "credit",
                  "description": "Prc Tax ID #14-Payroll 250122 01820000-0339-0 Terri Starr",
                  "date": "01/22/2025",
                  "amount": 4029.75,
                  "balance": 9347.66,
                  "page_number": 2
                },
                {
                  "type": "debit",
                  "description": "Aum Payment 250122 1068766664 Terri Peschio",
                  "date": "01/23/2025",
                  "amount": -77.59,
                  "balance": 9270.07,
                  "page_number": 2
                },
                {
                  "type": "debit",
                  "description": "Recurring Transfer to Starr A Ref #Op0R3R4Ynj Wells Fargo Clear Access Banking Rent",
                  "date": "01/27/2025",
                  "amount": -600,
                  "balance": 8670.07,
                  "page_number": 2
                },
                {
                  "type": "debit",
                  "description": "Online Transfer Ref #Ib0R456C2R to Wells Fargo Reflect VISA Card Xxxxxxxxxxxx3800 on 01/30/25",
                  "date": "01/30/2025",
                  "amount": -1000,
                  "balance": 7670.07,
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
  };
};

