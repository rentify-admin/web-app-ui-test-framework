function isoDate(d = new Date()) {
    const date = new Date(d);
    date.setUTCHours(0, 0, 0, 0);
    return date.toISOString();
}

function daysAgo(n) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - n);
    return isoDate(d);
}

function buildStatements(options) {
    const count = options?.count ?? 3;
    const hourly = options?.hourlyRate ?? 12;
    const hours = options?.hoursPerPeriod ?? 32;
    const gross = Math.round(hourly * hours * 100) / 100;
    const net = Math.round(gross * (options?.netFactor ?? 0.85) * 100) / 100;

    const statements = [];
    for (let i = 0; i < count; i++) {
        const startOffset = 7 * (i + 1) + 3;
        const endOffset = 7 * (i + 1);
        statements.push({
            date: daysAgo(endOffset - 2),
            payPeriodStartDate: daysAgo(startOffset),
            payPeriodEndDate: daysAgo(endOffset),
            grossAmount: gross,
            netAmount: net,
            ytdGrossAmount: Math.round(gross * (i + 1) * 100) / 100,
            ytdNetAmount: Math.round(net * (i + 1) * 100) / 100,
            hours: hours,
            deductions: [],
            earnings: [
                { category: 'wage', rawLabel: 'Regular', amount: gross, ytdAmount: Math.round(gross * (i + 1) * 100) / 100, hours: hours, rate: hourly }
            ],
            netAmountAdjustments: []
        });
    }
    return statements;
}

function getEmploymentSimulationMockData(opts = {}) {
    const taskId = opts.taskId || 'SIM-TASK-' + Math.random().toString(36).slice(2, 10);
    const createdAt = isoDate();
    const connectorName = opts.connectorName || 'Paytomic';
    const companyName = opts.companyName || 'Acme Inc.';

    const firstName = opts.identity?.firstName || 'Jane';
    const lastName = opts.identity?.lastName || 'Appleseed';
    const dob = opts.identity?.dateOfBirth || '1984-04-12T00:00:00.000Z';
    const email = opts.identity?.email || 'janeappleseed@example.com';
    const phone = opts.identity?.phone || '8018881111';
    const ssn = opts.identity?.ssn || 'XXXXX3333';
    const address = opts.identity?.address || '123 S. Main St';
    const city = opts.identity?.city || 'Salt Lake City';
    const state = opts.identity?.state || 'UT';
    const postalCode = opts.identity?.postalCode || '84111';

    const employeeType = opts.employment?.employeeType || 'fulltime';
    const employmentStatus = opts.employment?.employmentStatus || 'active';
    const jobTitle = opts.employment?.jobTitle || 'Logistics';
    const startDate = opts.employment?.startDate || daysAgo(420);

    const hourlyIncome = opts.income?.hourlyIncome ?? 12.5;
    const annualIncome = opts.income?.annualIncome ?? 45000;
    const netHourlyRate = opts.income?.netHourlyRate ?? 9.5;
    const payCycle = opts.income?.payCycle || 'weekly';
    const currentPayPeriodStart = opts.income?.currentPayPeriodStart || daysAgo(7);

    const statements = opts.statements?.items || buildStatements(opts.statements);

    return {
        FETCH_EMPLOYMENT_IDENTITY: {
            request: { id: taskId },
            response: {
                data: [
                    {
                        connector: { _id: 'SIM-CONNECTOR', branding: { color: '' }, name: connectorName },
                        company: { _id: 'SIM-COMPANY', branding: {}, name: companyName },
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
                        connector: { _id: 'SIM-CONNECTOR', branding: { color: '' }, name: connectorName },
                        company: { _id: 'SIM-COMPANY', branding: {}, name: companyName },
                        employment: {
                            employeeType,
                            employmentStatus,
                            jobTitle,
                            startDate,
                            employer: {
                                name: companyName,
                                address: { line1: '12345 Enterprise Rd', line2: 'Suite 105', city, state, postalCode, country: 'USA' }
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
                        connector: { _id: 'SIM-CONNECTOR', branding: { color: '' }, name: connectorName },
                        company: { _id: 'SIM-COMPANY', branding: {}, name: companyName },
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
                        connector: { _id: 'SIM-CONNECTOR', branding: { color: '' }, name: connectorName },
                        company: { _id: 'SIM-COMPANY', branding: {}, name: companyName },
                        statements,
                        task: taskId,
                        createdAt
                    }
                ]
            }
        }
    };
}

export { getEmploymentSimulationMockData };
