/**
 * Bank data (CUSTOM_PAYLOAD) minimal format for Simulation provider
 * Matches heartbeat-financial-step-mock-data-result-url.js structure
 */

function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function getBankStatementCustomPayload(user = {}) {
  const thirtyDaysAgo = daysAgo(30);
  const sixtyDaysAgo = daysAgo(60);
  const ninetyDaysAgo = daysAgo(90);

  return {
    id: 'AUTOGENERATE',
    institutions: [
      {
        name: 'Test Bank',
        accounts: [
          {
            id: null,
            account_number: '1234567890',
            name: 'Checking Account',
            type: 'checking',
            balance: 12500.0,
            currency: 'USD',
            owner: {
              first_name: user.first_name || 'Primary',
              last_name: user.last_name || 'Applicant',
              email: user.email || 'primary@applicant@test',
              address: {
                street: '123 Test St',
                city: 'Test City',
                state: 'CA',
                postal_code: '90210',
                country: 'US',
              },
            },
            transactions: [
              {
                id: null,
                date: ninetyDaysAgo.toISOString().split('T')[0],
                amount: 6000.0,
                description: 'Payroll Deposit',
                category: 'income',
              },
              {
                id: null,
                date: sixtyDaysAgo.toISOString().split('T')[0],
                amount: 6000.0,
                description: 'Payroll Deposit',
                category: 'income',
              },
              {
                id: null,
                date: thirtyDaysAgo.toISOString().split('T')[0],
                amount: 6000.0,
                description: 'Payroll Deposit',
                category: 'income',
              },
            ],
          },
        ],
      },
    ],
  };
}

export default getBankStatementCustomPayload;


