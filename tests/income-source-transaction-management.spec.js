import { expect, test } from "@playwright/test";
import { ApiClient } from "./api";
import { admin, app } from "./test_config";
import { loginWithAdmin } from "./endpoint-utils/auth-helper";
import { adminLoginAndNavigateToApplications, loginWith } from "./utils/session-utils";
import { findAndInviteApplication } from "./utils/applications-page";
import generateSessionForm from "./utils/generate-session-form";
import { getAmount, getRandomEmail } from "./utils/helper";
import { setupInviteLinkSession, simulatorFinancialStepWithVeridocs, updateRentBudget } from "./utils/session-flow";
import { customVeriDocsBankStatementData } from "./mock-data/bank-statement-veridocs-payload";
import { findSessionLocator, openReportSection, searchSessionWithText } from "./utils/report-page";
import { waitForJsonResponse } from "./utils/wait-response";
import { cleanupSession } from "./utils/cleanup-helper";
/**
 * Find a resource by name or throw if not found.
 */
async function findResourceByName(client, resource, name, displayLabel) {
    const filter = encodeURIComponent(JSON.stringify({ name: name }));
    const resp = await client.get(`/${resource}?filters=${filter}`);
    if (resp?.data?.data && Array.isArray(resp.data.data) && resp.data.data.length > 0) {
        console.log(`✅ Found ${displayLabel || resource.slice(0, -1)} "${name}"`);
        return resp.data.data[0];
    } else {
        const label = displayLabel || resource.slice(0, -1);
        throw new Error(`❌ ${label.charAt(0).toUpperCase() + label.slice(1)} with name "${name}" not found.`);
    }
}

async function findOrganization(client, orgName) {
    return await findResourceByName(client, "organizations", orgName, "Organization");
}

async function findWorkflow(client, workflowName) {
    return await findResourceByName(client, "workflows", workflowName, "Workflow");
}

async function findIncomeSourceTemplate(client, templateName) {
    return await findResourceByName(client, "income-source-templates", templateName, "Income Source Template");
}

async function findFlagCollection(client, templateName) {
    return await findResourceByName(client, "flag-collections", templateName, "Flag Collection");
}

// Converts mm/dd/yy to YYYY-MM-DD
function formatMDYtoYMD(dateStr) {
    if (!dateStr) return "";
    const [month, day, year] = dateStr.split("/").map((part) => part.padStart(2, "0"));
    let fullYear = year;
    if (year.length === 2) {
        fullYear = parseInt(year, 10) < 50 ? "20" + year : "19" + year;
    }
    return `${fullYear}-${month}-${day}`;
}

async function getApplication(client, applicationName) {
    // Find Or Create Application
    const filter = encodeURIComponent(JSON.stringify({ name: applicationName }));
    const getResp = await client.get(`/applications?filters=${filter}`);
    if (getResp?.data?.data && Array.isArray(getResp.data.data) && getResp.data.data.length > 0) {
        console.log(`✅ Found Application "${applicationName}"`);
        return getResp.data.data[0];
    } else {
        console.log(`Creating Application "${applicationName}"`);
        const orgName = "Permissions Test Org";
        const organization = await findOrganization(client, orgName);
        const workflowName = "autotest-simulator-only-financial-step";
        const workflow = await findWorkflow(client, workflowName);
        const templateName = "Default";
        const incomeSourceTemplate = await findIncomeSourceTemplate(client, templateName);
        const collection = "High Risk";
        const flagCollection = await findFlagCollection(client, collection);

        const createResp = await client.post("/applications", {
            organization: organization.id,
            name: applicationName,
            slug: "autotest-simulator-financial-step",
            enable_verisync_integration: false,
            address_line_1: "",
            administrative_area: "CALIFORNIA",
            country: "US",
            workflow: workflow.id,
            flag_collection: flagCollection.id,
            settings: {
                "settings.applications.applicant_types": [],
                "settings.applications.pms.pdf.upload_trigger": "session_acceptance",
                "settings.applications.pms.pdf.components": [],
                "settings.applications.income.ratio.type": "gross",
                "settings.applications.income.ratio.target": 300,
                "settings.applications.income.ratio.target.conditional": 300,
                "settings.applications.income.ratio.guarantor": 500,
                "settings.applications.income.source_template": incomeSourceTemplate.id,
                "settings.applications.target.enabled": 1,
                "settings.applications.target.required": 1,
                "settings.applications.target.default": "",
                "settings.applications.target.locked": 0,
                "settings.applications.target.range.min": 500,
                "settings.applications.target.range.max": 10000,
                "settings.applications.fast_entry": 0
            }
        });
        const application = createResp.data.data;
        await client.patch(`/applications/${application.id}`, { published: true });
        console.log(`✅ Application "${applicationName}" created`);
        return application;
    }
}

async function verifyTransactionRows(page, transactions, { checkSelection = false } = {}) {
    const incomeSourceModal = page.getByTestId("income-source-modal");
    await expect(incomeSourceModal).toBeVisible();

    const incomeSourceTable = incomeSourceModal.getByTestId("financial-section-transactios-list");
    const tableRows = incomeSourceTable.locator("tbody>tr");
    const rowsCount = await tableRows.count();
    await expect(rowsCount).toBe(transactions.length);

    for (let index = 0; index < rowsCount; index++) {
        const element = tableRows.nth(index);
        if (checkSelection) {
            if (transactions[index].description === "PAYROLL DEPOSIT") {
                await expect((await element).getByTestId("financial-section-transactios-list-select")).toBeChecked();
            } else {
                await expect((await element).getByTestId("financial-section-transactios-list-select")).not.toBeChecked();
            }
        }
        await expect((await element).getByTestId("financial-section-transactios-list-description-col")).toContainText(transactions[index].description);
        await expect((await element).getByTestId("financial-section-transactios-list-date-col")).toContainText(formatMDYtoYMD(transactions[index].date));
        await expect((await element).getByTestId("financial-section-transactios-list-paid_in-col")).toContainText(getAmount(transactions[index].amount));
    }
}

test.describe("QA-128 income-source-transaction-management.spec", () => {
    let application = null;
    let createdSessionId = null;
    const applicationName = "Autotest - Simulator Financial Step";

    test.beforeAll(async () => {
        console.log("🔐 Authenticating as admin user...");
        const adminClient = new ApiClient(app.urls.api, null, 20000);
        await loginWithAdmin(adminClient);
        application = await getApplication(adminClient, applicationName);
    });

    test("Income Source Transaction Management - Add/Remove Validation (VC-1758)", {
        tags: ['@regression'],
        timeout: 180000
    }, async ({ page }) => {
        // Setup
        console.log("🚦 Navigating and logging in as admin...");
        await adminLoginAndNavigateToApplications(page, admin);

        console.log(`📄 Creating session for application "${applicationName}"`);
        await findAndInviteApplication(page, applicationName);

        const userData = {
            first_name: "Income",
            last_name: "Transaction",
            email: getRandomEmail(),
        };

        const { sessionId, sessionUrl, link } = await generateSessionForm.generateSessionAndExtractLink(page, userData);
        createdSessionId = sessionId;

        console.log("🔄 Logging out of admin UI...");
        await page.getByTestId("user-dropdown-toggle-btn").click();
        await page.getByTestId("user-logout-dropdown-item").click();
        await expect(page.getByTestId("admin-login-btn")).toBeVisible({ timeout: 10_000 });

        console.log("🔗 Navigating as applicant to Invite Link...");
        await page.goto(link);

        console.log("🪄 Completing session setup as applicant (invite link session)...");
        await setupInviteLinkSession(page, { sessionUrl });

        console.log("🏠 Entering rent budget...");
        await updateRentBudget(page, sessionId, "500");

        // Generate test data
        const payload = customVeriDocsBankStatementData(userData, 4, "weekly", 5, {
            creditAmount: 2000,
            payrollDescription: "PAYROLL DEPOSIT",
            extraCreditCount: 5,
            miscDescriptions: 2,
            extraCreditAmount: 1000,
        });

        console.log("🏦 Completing financial step with Veridocs simulated connection...");
        await simulatorFinancialStepWithVeridocs(page, payload);
        await page.getByTestId("financial-verification-continue-btn").click();
        await expect(page.getByTestId("summary-step")).toBeVisible({ timeout: 20_000 });
        await page.getByTestId("profile-dropdown-btn").click();

        // Log out as applicant
        const closeDialog = async (dialog) => { await dialog.dismiss(); };
        page.once("dialog", closeDialog);
        await page.getByTestId("logout-dropdown-btn").click();
        await expect(page.getByTestId("get-started-btn")).toBeVisible();
        page.once("dialog", async (dialog) => { await dialog.accept(); });

        console.log("🔃 Switching back to admin, opening income sources section...");
        await page.goto("/");
        await loginWith(page, admin);

        await searchSessionWithText(page, sessionId);
        const sessionLocator = await findSessionLocator(page, `.application-card[data-session="${sessionId}"]`);
        await sessionLocator.click();

        console.log("📥 Waiting for income source API and opening section...");
        const [incomeSourceResponse, incomeSection] = await Promise.all([
            page.waitForResponse(
                (resp) =>
                    resp.url().includes("/income-sources?fields[income_source]=") &&
                    resp.request().method() === "GET" &&
                    resp.ok()
            ),
            openReportSection(page, "income-source-section"),
        ]);
        const { data: incomeSources } = await waitForJsonResponse(incomeSourceResponse);
        await expect(incomeSources.length).toBeGreaterThan(0);

        // --- Step 1: Verify Initial Auto-Generated Income Source
        console.log("🧪 STEP 1: Verifying initial auto-generated income source...");
        let incomeSource = incomeSources.find((ic) => ic.description === "PAYROLL DEPOSIT");
        await expect(incomeSource).toBeDefined();

        const mockTransactions = payload.documents[0].documents[0].data.accounts[0].transactions;
        const mockCreditTransactions = mockTransactions.filter((tr) => tr.type === "credit");
        const mockPayrollTransactions = mockTransactions.filter((tr) => tr.description === "PAYROLL DEPOSIT");

        let mockPayrollTransactionsSorted = mockPayrollTransactions
            .slice()
            .sort((a, b) => {
                const parseDate = (d) => {
                    const [month, day, year] = d.split("/");
                    const fullYear = year.length === 2 ? (parseInt(year, 10) < 50 ? "20" + year : "19" + year) : year;
                    return new Date(`${fullYear}-${month}-${day}`);
                };
                return parseDate(b.date) - parseDate(a.date); // descending
            });
        let mockLastTransaction = mockPayrollTransactionsSorted[0];
        const payrollIncomeSourceDiv = incomeSection.getByTestId(`income-source-${incomeSource.id}`);
        await expect(payrollIncomeSourceDiv).toBeVisible();

        await expect(incomeSection.getByTestId(`source-${incomeSource.id}-description-col`)).toContainText("PAYROLL DEPOSIT");
        const avgMonthlyText = await incomeSection.getByTestId(`source-${incomeSource.id}-monthly-income-col`).textContent();

        console.log(`   > Transaction count UI: Expect 4 - verifying...`);
        await expect(incomeSection.getByTestId(`source-${incomeSource.id}-last-trans-date-col`)).toHaveText(formatMDYtoYMD(mockLastTransaction.date));
        await expect(incomeSection.getByTestId(`source-${incomeSource.id}-income-type-col`)).toContainText("Employment Transactions");

        let apiAvgMonthIncome = incomeSource.average_monthly_income;
        await expect(incomeSource.pay_cadence_computed).toBe("WEEKLY");
        console.log(`   > Initial AMI: ${apiAvgMonthIncome}, Last Payment Date: ${formatMDYtoYMD(mockLastTransaction.date)}`);

        // --- Step 2: Modal Controls Validation - Cancel Button
        console.log("🧪 STEP 2: Modal controls validation - Cancel button...");
        const incomeSourceEdit = payrollIncomeSourceDiv.getByTestId("income-source-edit-btn");
        await expect(incomeSourceEdit).toBeVisible();
        await incomeSourceEdit.click();
        const incomeSourceModal = page.getByTestId("income-source-modal");
        await expect(incomeSourceModal).toBeVisible();
        const modalAccHeader = incomeSourceModal.getByTestId("income-source-modal-accordian-header");
        await expect(modalAccHeader).toBeVisible();
        await modalAccHeader.click();
        await page.waitForTimeout(1000);
        await expect(modalAccHeader).toContainText(String(mockPayrollTransactions.length));
        const incomeSourceTable = incomeSourceModal.getByTestId("financial-section-transactios-list");
        let checkedCheckboxes = incomeSourceTable.locator('input[type="checkbox"]:checked');
        let checkCount = await checkedCheckboxes.count();
        console.log(`   > Transaction checkbox count: ${checkCount} (expect 4)`);
        await expect(checkCount).toBe(mockPayrollTransactions.length);

        let toUncheck = await checkedCheckboxes.nth(0);
        await toUncheck.click();
        await expect(modalAccHeader).toContainText(String(mockPayrollTransactions.length - 1));
        console.log(`   > After unchecking, count: ${mockPayrollTransactions.length - 1}.`);
        await incomeSourceModal.getByTestId("add-income-source-modal-close-btn").click();
        await expect(incomeSourceModal).not.toBeVisible();
        console.log("   > Modal closed via Cancel, verifying source unchanged...");
        await expect(incomeSection.getByTestId(`source-${incomeSource.id}-monthly-income-col`)).toHaveText(avgMonthlyText);
        await expect(incomeSection.getByTestId(`source-${incomeSource.id}-last-trans-date-col`)).toHaveText(formatMDYtoYMD(mockLastTransaction.date));

        // --- Step 3: Modal Controls Validation - X Button
        console.log("🧪 STEP 3: Modal controls validation - X button...");
        await page.waitForTimeout(1000);
        await incomeSourceEdit.click();
        await expect(incomeSourceModal).toBeVisible();
        await expect(modalAccHeader).toContainText(String(mockPayrollTransactions.length));
        await modalAccHeader.click();
        await page.waitForTimeout(1000);
        checkedCheckboxes = incomeSourceTable.locator('input[type="checkbox"]:checked');
        checkCount = await checkedCheckboxes.count();
        if (await checkedCheckboxes.nth(0).isChecked()) {
            toUncheck = await checkedCheckboxes.nth(0);
            await toUncheck.click();
            console.log("   > Unchecked one transaction (for X close test)");
        }
        const modalX = incomeSourceModal.getByTestId("income-source-modal-cancel");
        await expect(modalX).toBeVisible();
        await modalX.click();
        await expect(incomeSourceModal).not.toBeVisible();
        console.log("   > Modal closed via X, verifying income source unchanged...");
        await expect(incomeSection.getByTestId(`source-${incomeSource.id}-monthly-income-col`)).toHaveText(avgMonthlyText);

        // --- Step 4: Search Filter Validation
        console.log("🧪 STEP 4: Search filter validation...");
        await page.waitForTimeout(1000);
        await incomeSourceEdit.click();
        await modalAccHeader.click();
        await page.waitForTimeout(1000);
        await verifyTransactionRows(page, mockCreditTransactions);

        const searchInput = incomeSourceModal.getByTestId("financial-section-transaction-search");
        console.log("   > Typing PAYROLL DEPOSIT in search filter...");
        await Promise.all([
            page.waitForResponse(
                (resp) =>
                    resp.url().includes(`/sessions/${sessionId}/transactions`) &&
                    resp.request().method() === "GET" &&
                    resp.ok()
            ),
            searchInput.fill("PAYROLL DEPOSIT"),
        ]);
        await page.waitForTimeout(500);
        await verifyTransactionRows(page, mockPayrollTransactionsSorted);

        console.log("   > Clearing search filter...");
        await Promise.all([
            page.waitForResponse(
                (resp) =>
                    resp.url().includes(`/sessions/${sessionId}/transactions`) &&
                    resp.request().method() === "GET" &&
                    resp.ok()
            ),
            searchInput.fill(""),
        ]);
        await page.waitForTimeout(500);
        await verifyTransactionRows(page, mockCreditTransactions);

        const uniqueDescription = mockCreditTransactions.find(tr => tr.description !== "PAYROLL DEPOSIT")?.description;
        if (uniqueDescription) {
            console.log(`   > Testing filter for other description: ${uniqueDescription}`);
            await Promise.all([
                page.waitForResponse(
                    (resp) =>
                        resp.url().includes(`/sessions/${sessionId}/transactions`) &&
                        resp.request().method() === "GET" &&
                        resp.ok()
                ),
                searchInput.fill(uniqueDescription),
            ]);
            await page.waitForTimeout(500);
            const filtered = mockCreditTransactions.filter(tr => tr.description === uniqueDescription);
            await verifyTransactionRows(page, filtered);
            await Promise.all([
                page.waitForResponse(
                    (resp) =>
                        resp.url().includes(`/sessions/${sessionId}/transactions`) &&
                        resp.request().method() === "GET" &&
                        resp.ok()
                ),
                searchInput.fill(""),
            ]);
            await page.waitForTimeout(500);
        } else {
            console.log("   > No unique other description found for search filter test!");
        }
        await expect(modalX).toBeVisible();
        await modalX.click();
        await expect(incomeSourceModal).not.toBeVisible();

        // --- Step 5: Show Selected Filter Validation
        console.log("🧪 STEP 5: Show Selected filter validation...");
        await page.waitForTimeout(1000);
        await incomeSourceEdit.click();
        await modalAccHeader.click();
        await page.waitForTimeout(1000);

        await verifyTransactionRows(page, mockCreditTransactions, { checkSelection: true });
        const showSelected = incomeSourceModal.getByTestId("show-selection-check");
        await expect(showSelected).toBeVisible();
        await expect(showSelected).not.toBeChecked();

        console.log("   > Checking Show Selected filter...");
        await Promise.all([
            page.waitForResponse(
                (resp) =>
                    resp.url().includes(`/sessions/${sessionId}/transactions`) &&
                    resp.request().method() === "GET" &&
                    resp.ok()
            ),
            showSelected.click(),
        ]);
        await page.waitForTimeout(500);
        await verifyTransactionRows(page, mockPayrollTransactionsSorted, { checkSelection: true });

        await expect(showSelected).toBeChecked();
        console.log("   > Unchecking Show Selected filter...");
        await Promise.all([
            page.waitForResponse(
                (resp) =>
                    resp.url().includes(`/sessions/${sessionId}/transactions`) &&
                    resp.request().method() === "GET" &&
                    resp.ok()
            ),
            showSelected.click(),
        ]);
        await page.waitForTimeout(500);
        await verifyTransactionRows(page, mockCreditTransactions);

        await expect(modalX).toBeVisible();
        await modalX.click();
        await expect(incomeSourceModal).not.toBeVisible();

        // --- Step 6: Remove Single Transaction - Verify AMI Decreases
        console.log("🧪 STEP 6: Remove single transaction - verify AMI decreases...");
        let updateBtn, lastTransaction, remainingTransactions;
        ({
            lastTransaction,
            remainingTransactions,
            incomeSource
        } = await verifyStepSixAndSeven(page, sessionId, incomeSection, incomeSource, mockPayrollTransactionsSorted));
        await page.waitForTimeout(1000);
        const avgMonthlyText2 = (await incomeSection.getByTestId(`source-${incomeSource.id}-monthly-income-col`).textContent()).trim();
        console.log(`   > AMI after removing 1: ${incomeSource.average_monthly_income}, should be less than ${apiAvgMonthIncome} (before)`);
        await expect(avgMonthlyText2).not.toBe(avgMonthlyText)
        expect(incomeSource.average_monthly_income).toBeLessThan(apiAvgMonthIncome)
        apiAvgMonthIncome = incomeSource.average_monthly_income

        mockLastTransaction = mockPayrollTransactionsSorted[0];
        mockPayrollTransactionsSorted = mockPayrollTransactionsSorted.filter((tr) => tr.date !== mockLastTransaction.date);

        // --- Step 7: Remove One More Transaction - Verify AMI Continues to Decrease
        console.log("🧪 STEP 7: Remove one more transaction - verify AMI continues to decrease...");
        ({
            lastTransaction,
            remainingTransactions,
            incomeSource
        } = await verifyStepSixAndSeven(page, sessionId, incomeSection, incomeSource, mockPayrollTransactionsSorted));
        await page.waitForTimeout(1000);
        const avgMonthlyText3 = (await incomeSection.getByTestId(`source-${incomeSource.id}-monthly-income-col`).textContent()).trim();
        await expect(avgMonthlyText3).not.toBe(avgMonthlyText2)
        expect(incomeSource.average_monthly_income).toBeLessThan(apiAvgMonthIncome);
        apiAvgMonthIncome = incomeSource.average_monthly_income
        mockLastTransaction = mockPayrollTransactionsSorted[0];
        mockPayrollTransactionsSorted = mockPayrollTransactionsSorted.filter((tr) => tr.date !== mockLastTransaction.date);

        // --- Step 8: Add Multiple Transactions - Verify AMI Increases
        console.log("🧪 STEP 8: Add multiple transactions - verify AMI increases...");
        await page.waitForTimeout(1000);
        const [transactionsResponse] = await Promise.all([
            page.waitForResponse(
                (resp) =>
                    resp.url().includes(`/sessions/${sessionId}/transactions?`) &&
                    resp.request().method() === "GET" &&
                    resp.ok()
            ),
            incomeSourceEdit.click(),
        ]);
        let transactions;
        ({ data: transactions } = await waitForJsonResponse(transactionsResponse));

        await expect(incomeSourceModal).toBeVisible();
        await expect(modalAccHeader).toContainText(String(mockPayrollTransactionsSorted.length));
        await modalAccHeader.click();
        await page.waitForTimeout(1000);
        const rows = incomeSourceTable.locator("tbody>tr");
        const rowCount = await rows.count();
        const noOfRowToCheck = 6;
        const checkedTransactions = [];

        for (let index = 0; index < noOfRowToCheck; index++) {
            const element = await rows.nth(rowCount - index - 1);
            const check = element.getByTestId("financial-section-transactios-list-select");
            const date = (await (await element.getByTestId("financial-section-transactios-list-date-col")).textContent()).trim();
            const trans = transactions.find((tr) => tr.date === date);
            trans.checked = true;
            if (!await check.isChecked()) {
                await check.click();
                trans.checked = false;
            }
            checkedTransactions.push(trans);
        }
        updateBtn = incomeSourceModal.getByTestId("add-income-source-modal-submit-btn");
        await expect(updateBtn).toBeVisible();

        const patchPromise = page.waitForResponse(
            (resp) =>
                resp.url().includes(`/sessions/${sessionId}/income-sources/${incomeSource.id}`) &&
                resp.request().method() === "PATCH"
        );
        await updateBtn.click();
        const patchResp = await patchPromise;
        await expect(patchResp.ok()).toBeTruthy();
        const reqBody = JSON.parse(patchResp.request().postData());
        const { data: updatedIncomeSource } = await waitForJsonResponse(patchResp);

        await expect(reqBody.calculate_average_monthly_income).toBe(true);
        await expect(reqBody.transactions.length).toBe(noOfRowToCheck);

        console.log("   > PATCH payload contains 6 transactions (added). Verifying IDs...");
        for (let index = 0; index < reqBody.transactions.length; index++) {
            const element = reqBody.transactions[index];
            const transaction = checkedTransactions.find((tras) => tras.id === element.transaction_id);
            if (transaction.checked) {
                await expect(element.transaction_id).toBe(transaction.id);
                await expect(element.id).toBe(transaction.income_source_transaction.id);
            } else {
                await expect(element.transaction_id).toBe(transaction.id);
                await expect(element.id).toBe(null);
            }
        }

        await page.waitForTimeout(1500);
        const avgMonthlyText4 = (await incomeSection.getByTestId(`source-${incomeSource.id}-monthly-income-col`).textContent()).trim();
        await expect(avgMonthlyText4).not.toBe(avgMonthlyText3);
        expect(updatedIncomeSource.average_monthly_income).toBeGreaterThan(apiAvgMonthIncome);
        apiAvgMonthIncome = updatedIncomeSource.average_monthly_income
        mockPayrollTransactionsSorted = mockCreditTransactions.filter((item) =>
            updatedIncomeSource.transactions.map((tr) => tr.date).includes(formatMDYtoYMD(item.date))
        );
        expect(updatedIncomeSource.transactions.length).toBe(noOfRowToCheck);

        // --- Step 9: Verify Show Selected After Modifications
        console.log("🧪 STEP 9: Show Selected after modifications...");
        await page.waitForTimeout(1000);
        const [responseTransactions] = await Promise.all([
            page.waitForResponse(
                (resp) =>
                    resp.url().includes(`/sessions/${sessionId}/transactions?`) &&
                    resp.request().method() === "GET" &&
                    resp.ok()
            ),
            incomeSourceEdit.click(),
        ]);
        ({ data: transactions } = await waitForJsonResponse(responseTransactions));
        await expect(incomeSourceModal).toBeVisible();

        await expect(modalAccHeader).toContainText(String(mockPayrollTransactionsSorted.length));
        await modalAccHeader.click();
        await page.waitForTimeout(1000);
        checkedCheckboxes = incomeSourceTable.locator('input[type="checkbox"]:checked');
        checkCount = await checkedCheckboxes.count();
        await expect(checkCount).toBe(noOfRowToCheck);
        await expect(showSelected).toBeVisible();
        await expect(showSelected).not.toBeChecked();

        await Promise.all([
            page.waitForResponse(
                (resp) =>
                    resp.url().includes(`/sessions/${sessionId}/transactions`) &&
                    resp.request().method() === "GET" &&
                    resp.ok()
            ),
            showSelected.click(),
        ]);
        await page.waitForTimeout(1000)
        await expect(await incomeSourceTable.locator('tbody>tr').count()).toBe(noOfRowToCheck)
        await Promise.all([
            page.waitForResponse(
                (resp) =>
                    resp.url().includes(`/sessions/${sessionId}/transactions`) &&
                    resp.request().method() === "GET" &&
                    resp.ok()
            ),
            showSelected.click(),
        ]);
        await page.waitForTimeout(1000)
        await expect(await incomeSourceTable.locator('tbody>tr').count()).toBe(mockCreditTransactions.length);

        await modalX.click();

        // --- Step 10: Edge Case - Attempt to Remove All Transactions (Awaiting Confirmation)
        console.log("🧪 STEP 10: Edge Case - Remove all transactions (expect revert or N/A, verify with team)...");
        await page.waitForTimeout(1000);
        const [responseTransactions2] = await Promise.all([
            page.waitForResponse(
                (resp) =>
                    resp.url().includes(`/sessions/${sessionId}/transactions?`) &&
                    resp.request().method() === "GET" &&
                    resp.ok()
            ),
            incomeSourceEdit.click()
        ]);
        ({ data: transactions } = await waitForJsonResponse(responseTransactions2));
        await expect(incomeSourceModal).toBeVisible();

        await expect(modalAccHeader).toContainText(String(mockPayrollTransactionsSorted.length));
        await modalAccHeader.click();
        await page.waitForTimeout(1000);
        checkedCheckboxes = incomeSourceTable.locator('input[type="checkbox"]:checked');
        checkCount = await checkedCheckboxes.count();
        await expect(checkCount).toBe(noOfRowToCheck);
        for (let index = 0; index < checkCount; index++) {
            const element = checkedCheckboxes.nth(index);
            if (await element.isChecked()) await element.click()
        }
        const patchPromise2 = page.waitForResponse(
            (resp) =>
                resp.url().includes(`/sessions/${sessionId}/income-sources/${incomeSource.id}`) &&
                resp.request().method() === "PATCH"
        );
        await updateBtn.click();
        const patch2Resp = await patchPromise2;
        await expect(patch2Resp.ok()).toBeTruthy();
        await page.waitForTimeout(1000)
        await incomeSourceEdit.click()
        await expect(incomeSourceModal).toBeVisible();
        await expect(modalAccHeader).toContainText(String(mockPayrollTransactionsSorted.length));
        checkedCheckboxes = incomeSourceTable.locator('input[type="checkbox"]:checked');
        await expect(checkCount).toBe(noOfRowToCheck);

        console.log("   > NOTE: Documenting actual system behavior for this edge case. Consult product team for desired outcome.");
        await modalX.click();
    });

    test.afterAll(async ({ request }, testInfo ) => {
        if (testInfo.status === 'passed') {
            console.log(`🧹 Cleaning up created session: ${createdSessionId}`);
            await cleanupSession(request, createdSessionId);
            console.log(`✅ Session cleanup complete`);
        } else {
            console.log(`⚠️ Test failed - keeping session ${createdSessionId} for debugging.`);
        }
    });
});

/**
 * Step 6/7: Remove Transaction(s) - AMI Verification with Logging
 */
async function verifyStepSixAndSeven(page, sessionId, incomeSection, incomeSource, mockPayrollTransactionsSorted) {
    const payrollIncomeSourceDiv = incomeSection.getByTestId(`income-source-${incomeSource.id}`);
    const incomeSourceEdit = payrollIncomeSourceDiv.getByTestId("income-source-edit-btn");
    await page.waitForTimeout(1000);
    await incomeSourceEdit.click();
    const incomeSourceModal = page.getByTestId("income-source-modal");
    await expect(incomeSourceModal).toBeVisible();
    const modalAccHeader = incomeSourceModal.getByTestId("income-source-modal-accordian-header");
    await expect(modalAccHeader).toBeVisible();
    await expect(modalAccHeader).toContainText(String(mockPayrollTransactionsSorted.length));
    await modalAccHeader.click();
    await page.waitForTimeout(1000);

    const incomeSourceTable = incomeSourceModal.getByTestId("financial-section-transactios-list");
    await expect(incomeSourceTable).toBeVisible();
    const checkedCheckboxes = incomeSourceTable.locator('input[type="checkbox"]:checked');
    const checkCount = await checkedCheckboxes.count();
    await expect(checkCount).toBe(mockPayrollTransactionsSorted.length);

    const mockLastTransaction = mockPayrollTransactionsSorted[0];
    const lastTransaction = incomeSource.transactions.find(
        (tr) => tr.date === formatMDYtoYMD(mockLastTransaction.date)
    );
    const remainingTransactions = incomeSource.transactions.filter((tr) => tr.transaction_id !== lastTransaction.transaction_id);

    const lastRow = incomeSourceTable.getByTestId(`financial-section-transactios-list-${lastTransaction.transaction_id}`);
    await expect(lastRow).not.toBeNull();
    await expect(lastRow.getByTestId("financial-section-transactios-list-select")).toBeChecked();
    await lastRow.getByTestId("financial-section-transactios-list-select").click();
    await expect(modalAccHeader).toContainText(String(mockPayrollTransactionsSorted.length - 1));

    let updateBtn = incomeSourceModal.getByTestId("add-income-source-modal-submit-btn");
    await expect(updateBtn).toBeVisible();

    console.log(`   > Saving after removing 1 transaction (leaving ${remainingTransactions.length})...`);

    const updatedIncomeSource = await verifyUpdateTransactionResponse(
        page,
        sessionId,
        incomeSource,
        updateBtn,
        remainingTransactions
    );
    return { lastTransaction, remainingTransactions, incomeSource: updatedIncomeSource };
}

async function verifyUpdateTransactionResponse(page, sessionId, incomeSource, updateBtn, remainingTransactions) {
    const patchPromise = page.waitForResponse(
        (resp) =>
            resp.url().includes(`/sessions/${sessionId}/income-sources/${incomeSource.id}`) &&
            resp.request().method() === "PATCH"
    );
    await updateBtn.click();

    const patchResp = await patchPromise;
    await expect(patchResp.ok()).toBeTruthy();

    const reqBody = JSON.parse(patchResp.request().postData());
    const { data: updatedIncomeSource } = await waitForJsonResponse(patchResp);

    await expect(reqBody.calculate_average_monthly_income).toBe(true);
    await expect(reqBody.transactions.length).toBe(remainingTransactions.length);

    const sentTransactionIds = reqBody.transactions.map((item) => item.transaction_id);
    const expectedTransactionIds = remainingTransactions.map((t) => t.transaction_id);

    await expect(sentTransactionIds.sort()).toEqual(expectedTransactionIds.sort());
    await expect(updatedIncomeSource.transactions.length).toBe(remainingTransactions.length);

    await expect(updatedIncomeSource.average_monthly_income).not.toBe(incomeSource.average_monthly_income);

    return updatedIncomeSource;
}
