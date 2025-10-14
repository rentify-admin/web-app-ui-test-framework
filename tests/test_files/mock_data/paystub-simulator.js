/**
 * Paystub Simulation (VERIDOCS_SIMULATION) for Simulation provider
 * Purpose: Match applicant name to avoid name mismatch flags
 * Structure modeled after API test: paystub-policy-name-validation-mock-data.js
 */

function formatMmDdYyyy(date) {
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const y = date.getUTCFullYear();
  return `${m}/${d}/${y}`;
}

function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function getPaystubVeridocsSimulation(userData = {}, options = {}) {
  const firstName = userData.first_name || 'Primary';
  const lastName = userData.last_name || 'Applicant';
  const employeeName = `${firstName} ${lastName}`; // match to avoid flags

  const periodStart = formatMmDdYyyy(daysAgo(14));
  const periodEnd = formatMmDdYyyy(daysAgo(1));
  const grossPay = options.grossPay ?? 1800.00; // set healthy income
  const netPay = options.netPay ?? 1500.00;

  return {
    id: 'sim-paystub-autogen',
    file_name: 'paystub-simulator.pdf',
    reference_id: null,
    qualifier: 'development',
    documents: [
      {
        order: 1,
        pages: [
          { number: 1, path: 'sim/_images/paystub_page_1.jpg', size: 77134 },
        ],
        page_start: 1,
        page_end: 1,
        language: 'en_US',
        extraction_hints: {
          period_start_date: periodStart,
          period_end_date: periodEnd,
        },
        type: 'pay_stub',
        subtype: '',
        confidence: {
          score: 100,
          reasoning:
            "Simulated paystub with clear employer, employee, and pay period fields; values sized to avoid income ratio flags.",
        },
        data: {
          employer_name: options.employerName || 'Simulated Employer LLC',
          employee_name: employeeName,
          period_start: periodStart,
          period_end: periodEnd,
          pay_date: formatMmDdYyyy(daysAgo(0)),
          gross_pay: grossPay,
          net_pay: netPay,
          deposits: [
            { account_name: 'Checking', amount: netPay },
          ],
          deductions: [],
          ytd_gross: `${(grossPay * 12).toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
          ytd_net: `${(netPay * 12).toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
        },
        metadata: { cost_usd: 0, elapsed_time: 3.0, llm_model: 'simulated' },
      },
    ],
    metadata: {
      warnings: [],
      pages_converted_count: 1,
      pages_total_file_size: 77134,
      pages_extracted_count: 1,
      classification_attempts: 1,
      extraction_attempts: 1,
    },
  };
}

export default getPaystubVeridocsSimulation;


