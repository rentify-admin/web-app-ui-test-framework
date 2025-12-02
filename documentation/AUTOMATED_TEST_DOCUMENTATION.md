# Automated Test Documentation

**Generated:** 2025-12-01T19:48:22.846Z  
**Template Version:** 1.0  
**Total Tests Documented:** 60

> **Note:** This documentation is auto-generated. To update the format, modify `TEST_DOCUMENTATION_TEMPLATE.md` and regenerate.

---

## Test Documentation

### `applicant_type_workflow_affordable_occupant.spec.js` → `Should complete applicant flow with affordable occupant applicant type`

**Test ID:** `applicant_type_workflow_affordable_occupant`  
**Test File:** `applicant_type_workflow_affordable_occupant.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.798Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** {data not found for this field}

**Test Conditions:**
- **Application:** `AutoTest Suite - Full Test`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** Session created via API or UI

**Test Data Used:**
- **Users:** affordable@verifast.com
- **Sessions:** {data not found for this field}
- **Applications:** AutoTest Suite - Full Test
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- {data not found for this field}

#### Test Case

**Test Steps:**

1. **Step 1**
   - Action: Login as admin
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

2. **Step 2**
   - Action: Navigate to Applications and search for the test application
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

3. **Step 3**
   - Action: Navigate to Applications Page
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

4. **Step 4**
   - Action: Find and Invite Application
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

5. **Step 5**
   - Action: Fill session generation form
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

6. **Step 6**
   - Action: Get session link and navigate to applicant view
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

7. **Step 7**
   - Action: Navigate to applicant view
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

8. **Step 8**
   - Action: Complete applicant form with rent budget
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

9. **Step 9**
   - Action: Skip applicants step to proceed to ID verification
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

10. **Step 10**
   - Action: Wait for ID verification step to be visible
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

11. **Step 11**
   - Action: Complete ID verification in Persona iframe (camera-based flow)
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

**Validation Points:**
- expect(page.getByTestId('applicants-menu')
- expect(linkSection)
- expect(page.getByTestId('applicant-invite-skip-btn')
- expect(page.getByTestId('start-id-verification')

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `applicants-menu` - {Purpose}
- `applications-menu` - {Purpose}
- `applications-submenu` - {Purpose}
- `session-invite-link` - {Purpose}
- `generate-session-modal-cancel` - {Purpose}
- `applicant-invite-skip-btn` - {Purpose}
- `start-id-verification` - {Purpose}

**Tags:** `@core`, `@regression`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `~/tests/utils/login-form`
- `~/tests/utils/applications-page`
- `~/tests/utils/generate-session-form`
- `~/tests/utils/session-flow`
- `./utils/cleanup-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `application_create_delete_test.spec.js` → `Should create and delete an application with multiple applicant types`

**Test ID:** `application_create_delete_test`  
**Test File:** `application_create_delete_test.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.806Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** {data not found for this field}

**Test Conditions:**
- **Application:** `AutoTest Create_Delete_${getRandomNumber()}`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** Test setup performed in beforeAll/beforeEach hooks
- **Test Data Setup:** {data not found for this field}

**Test Data Used:**
- **Users:** {data not found for this field}
- **Sessions:** {data not found for this field}
- **Applications:** AutoTest Create_Delete_${getRandomNumber()}
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- {data not found for this field}

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(page.getByTestId('applicants-menu')

**Cleanup:**
{data not found for this field}

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `applicants-menu` - {Purpose}

**Tags:** `@core`, `@regression`, `@staging-ready`, `@rc-ready`, `@try-test-rail-names`

**Dependencies:**
- `~/tests/utils/login-form`
- `~/tests/utils/application-management`
- `~/tests/utils/helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `application_edit_id_template_settings.spec.js` → `Should edit an application ID template settings`

**Test ID:** `application_edit_id_template_settings`  
**Test File:** `application_edit_id_template_settings.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.809Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** {data not found for this field}

**Test Conditions:**
- **Application:** `AutoTest Suite - ID Edit Only`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** {data not found for this field}

**Test Data Used:**
- **Users:** {data not found for this field}
- **Sessions:** {data not found for this field}
- **Applications:** AutoTest Suite - ID Edit Only
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- {data not found for this field}

#### Test Case

**Test Steps:**

1. **Step 1**
   - Action: Login as admin
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

2. **Step 2**
   - Action: Open Applications from sidebar using robust selectors
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

3. **Step 3**
   - Action: Navigate to Applications Page
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

4. **Step 4**
   - Action: Search for the application by name
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

5. **Step 5**
   - Action: Click the edit icon for the application
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

**Validation Points:**
- expect(page.getByTestId('applicants-menu')

**Cleanup:**
{data not found for this field}

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `applicants-menu` - {Purpose}
- `applications-menu` - {Purpose}
- `applications-submenu` - {Purpose}
- `submit-application-setup` - {Purpose}
- `persona-template-id-input` - {Purpose}

**Tags:** `@regression`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `~/tests/utils/login-form`
- `./utils/applications-page`
- `./utils/workflow-identity-utils`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `application_step_should_skip_properly.spec.js` → `Check Application step skip works propertly`

**Test ID:** `application_step_should_skip_properly`  
**Test File:** `application_step_should_skip_properly.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.810Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** = await browser.newContext();

**Test Conditions:**
- **Application:** `AutoTest Suite - Full Test`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** Session created via API or UI

**Test Data Used:**
- **Users:** {data not found for this field}
- **Sessions:** Session with rent budget configuration
- **Applications:** AutoTest Suite - Full Test
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- {data not found for this field}

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(page.getByTestId('admin-login-btn')
- expect(page.getByTestId('start-id-verification')
- expect(page.getByTestId('summary-completed-section')
- expect(page.getByTestId('applicant-invite-step')
- expect(page.getByTestId('summary-completed-section')
- expect(page.getByTestId('employment-step-skip-btn')
- expect(page.getByTestId('summary-completed-section')
- expect(page.locator('label[for="rent_budget"]')
- expect(page.getByTestId('summary-completed-section')
- expect(page.getByTestId('applicant-invite-step')
- expect(page.getByTestId('summary-completed-section')
- expect(page.getByTestId('summary-completed-section')

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `user-dropdown-toggle-btn` - {Purpose}
- `user-logout-dropdown-item` - {Purpose}
- `admin-login-btn` - {Purpose}
- `applicant-invite-skip-btn` - {Purpose}
- `start-id-verification` - {Purpose}
- `employment-step-skip-btn` - {Purpose}
- `summary-completed-section` - {Purpose}
- `applicant-invite-step` - {Purpose}
- `applicant-invite-continue-btn` - {Purpose}
- `employment-step-continue` - {Purpose}

**Tags:** `@regression`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `~/tests/utils/session-utils`
- `~/tests/utils/applications-page`
- `~/tests/utils/helper`
- `~/tests/utils/session-flow`
- `~/tests/utils/generate-session-form`
- `./utils/cleanup-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `approval_condition_search_verify.spec.js` → `Approval Conditions — Search by Name, Description, and BE Name`

**Test ID:** `QA-211: Approval Conditions — Search by Name, Description, and BE Name`  
**Test File:** `approval_condition_search_verify.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.812Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Searches flags with the given value and validates the given column contains the search string.
  @param {import('@playwright/test').Page} page
  @param {string} fillValue - the value to search/fill in search input
  @param {string} colTestId - the test id for the column to check, e.g. 'flag-name-col'
  @param {Object} [options] - options for validation, e.g. {exactMatch: false}

**Business Context:** {data not found for this field}

**Test Conditions:**
- **Application:** `{data not found for this field}`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** {data not found for this field}

**Test Data Used:**
- **Users:** {data not found for this field}
- **Sessions:** {data not found for this field}
- **Applications:** {data not found for this field}
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- {data not found for this field}

#### Test Case

**Test Steps:**

1. **Step 1**
   - Action: Navigating to app URL');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

2. **Step 2**
   - Action: Filling login form');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

3. **Step 3**
   - Action: Submitting login form and setting locale');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

4. **Step 4**
   - Action: Waiting for applicants menu to be visible');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

5. **Step 5**
   - Action: Clicking on applications menu');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

6. **Step 6**
   - Action: Navigating to Approval Conditions (flag-collections)');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

7. **Step 7**
   - Action: Validating flag collections are present');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

8. **Step 8**
   - Action: Clicking to view flag collection (id: ${flagCollection.id})`);
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

9. **Step 9**
   - Action: Search by Name ("Mismatch") in flag-name-col');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

10. **Step 10**
   - Action: completed: "Mismatch" search in flag-name-col validated.');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

11. **Step 11**
   - Action: Search by Description ("computed cadence") in flag-description-col');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

12. **Step 12**
   - Action: completed: "computed cadence" search in flag-description-col validated.');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

13. **Step 13**
   - Action: Search by BE Name ("EMPLOYMENT_LETTER_UPLOADED") in flag-key-col (exact match)');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

14. **Step 14**
   - Action: completed: "EMPLOYMENT_LETTER_UPLOADED" search in flag-key-col (exact match) validated.');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

**Validation Points:**
- expect(page.getByTestId('applicants-menu')
- expect(flagCollections.length > 0)
- expect(col)
- expect(col)

**Cleanup:**
{data not found for this field}

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `applicants-menu` - {Purpose}
- `applications-menu` - {Purpose}
- `view-${flagCollection.id}` - {Purpose}
- `app-cond-flag-search-input` - {Purpose}
- `approval-cond-flags-list` - {Purpose}
- `flag-row-${element.id}` - {Purpose}

**Tags:** `@regression`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `./utils/login-form`
- `./utils/common`
- `./utils/helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `check_coapp_income_ratio_exceede_flag.spec.js` → `Should confirm co-applicant income is considered when generating/removing Gross Income Ratio Exceeded flag`

**Test ID:** `check_coapp_income_ratio_exceede_flag`  
**Test File:** `check_coapp_income_ratio_exceede_flag.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.814Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Poll for income sources to be generated after employment connection
  @param {import('@playwright/test').Page} page - Page object
  @param {string} sessionId - Session ID to poll
  @param {number} maxAttempts - Maximum polling attempts (default: 20)
  @param {number} intervalMs - Interval between attempts in ms (default: 3000)
  @returns {Promise<Array>} Array of income sources found

**Business Context:** = null;

**Test Conditions:**
- **Application:** `AutoTest Suite - Full Test`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** Session created via API or UI

**Test Data Used:**
- **Users:** playwright+ratio@verifast.com, playwright+coapp@verifast.com
- **Sessions:** Session with rent budget configuration
- **Applications:** AutoTest Suite - Full Test
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- expect(flagCleared).toBe(true)

#### Test Case

**Test Steps:**

1. **Step 1**
   - Action: Admin Login and Navigate to Applications
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

2. **Step 2**
   - Action: Navigate to Applications Page
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

3. **Step 3**
   - Action: Find and Invite Application
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

4. **Step 4**
   - Action: Generate Session and Extract Link
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

5. **Step 5**
   - Action: Open Invite link
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

6. **Step 6**
   - Action: Setup session flow (terms → applicant type → state)
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

**Validation Points:**
- expect(applicantPage.getByTestId('applicant-invite-step')
- expect(rentLocator)
- expect(rentLocator)
- expect(incomeLocator)
- expect(session.data.children.length)
- expect(session.data.children.filter(item => item.role === 'APPLICANT')
- expect(rentRatioLocator)
- expect(calculatedRatio)
- expect(page.getByTestId('GROSS_INCOME_RATIO_EXCEEDED')
- expect(monthlyIncomeNew)
- expect(rentRatioLocatorNew)
- expect(calculatedRatioNew)
- expect(flagCleared)

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `applicant-invite-step` - {Purpose}
- `applicant-invite-continue-btn` - {Purpose}
- `employment-step-continue` - {Purpose}
- `rent-budget-edit-btn` - {Purpose}
- `report-monthly-income-card` - {Purpose}
- `report-rent-income-ratio-card` - {Purpose}
- `view-details-btn` - {Purpose}
- `GROSS_INCOME_RATIO_EXCEEDED` - {Purpose}
- `close-event-history-modal` - {Purpose}
- `session-action-btn` - {Purpose}
- `invite-applicant` - {Purpose}
- `reinvite-${session.data?.children[0]?.applicant?.id}` - {Purpose}
- `copy-invite-link-${session.data?.children[0]?.applicant?.id}` - {Purpose}
- `invite-modal-cancel` - {Purpose}

**Tags:** `@smoke`, `@external-integration`, `@regression`, `@staging-ready`, `@rc-ready`, `@try-test-rail-names`

**Dependencies:**
- `~/tests/utils/login-form`
- `~/tests/utils/applications-page`
- `~/tests/utils/generate-session-form`
- `~/tests/utils/helper`
- `~/tests/utils/session-flow`
- `~/tests/utils/common`
- `~/tests/utils/report-page`
- `~/tests/utils/wait-response`
- `./utils/cleanup-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `check_income_source_regenerate_on_split_merge.spec.js` → `Verify Regenerate Income After Merge/Split`

**Test ID:** `QA-210: Check Income Source Regenerate on Split/Merge`  
**Test File:** `check_income_source_regenerate_on_split_merge.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.817Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Completes the applicant session flow with banking data.

**Business Context:** = await browser.newContext();

**Test Conditions:**
- **Application:** `Autotest - Heartbeat Test - Financial`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** Session created via API or UI

**Test Data Used:**
- **Users:** {data not found for this field}
- **Sessions:** {data not found for this field}
- **Applications:** Autotest - Heartbeat Test - Financial
- **Mock Data:** ./mock-data/high-balance-financial-payload
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- expect(item.paid_in).toBe(mockTrans[subIndex].amount * 100)

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(questionStep)
- expect(financialStep)
- expect(page.getByTestId(`income-source-${element.id}`)
- expect(mergeButton)
- expect(mergeModal)
- expect(coApplicantRaw)
- expect(splitButton)
- expect(confirmBox)
- expect(financialSection)
- expect(page.getByTestId('household-status-alert')
- expect(page.getByTestId('household-status-alert')
- expect(transcationRows.nth(index)
- expect(transcationRows.nth(index)
- expect(transcationRows.nth(index)
- expect(transcationRows.nth(index)

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- `GET ${app.urls.api}/sessions/${priSessionId}?fields[session]=id,applicant,children` - {Purpose}
- `GET ${app.urls.api}/sessions/${priSessionId}?fields[session]=id,applicant,children` - {Purpose}

**UI Test IDs Used:**
- `pre-screening-step` - {Purpose}
- `pre-screening-skip-btn` - {Purpose}
- `financial-verification-step` - {Purpose}
- `connect-bank` - {Purpose}
- `financial-verification-continue-btn` - {Purpose}
- `income-source-section-header` - {Purpose}
- `income-source-${element.id}` - {Purpose}
- `merge-session-btn` - {Purpose}
- `merge-session-modal` - {Purpose}
- `raw-${coAppSessionId}` - {Purpose}
- `overview-applicant-btn` - {Purpose}
- `split-into-new-household-btn` - {Purpose}
- `confirm-box` - {Purpose}
- `confirm-btn` - {Purpose}
- `applications-menu` - {Purpose}
- `applications-submenu` - {Purpose}
- `applicants-menu` - {Purpose}
- `applicants-submenu` - {Purpose}
- `financial-section` - {Purpose}
- `financial-section-header` - {Purpose}
- `financial-section-transactions-radio` - {Purpose}
- `financial-section-applicant-filter` - {Purpose}
- `household-status-alert` - {Purpose}
- `financial-section-transactios-list` - {Purpose}
- `financial-section-transactios-list-date-col` - {Purpose}
- `financial-section-transactios-list-description-col` - {Purpose}
- `financial-section-transactios-list-paid_in-col` - {Purpose}
- `financial-section-transactios-list-account-col` - {Purpose}
- `financial-section-transactios-list-institution-col` - {Purpose}
- `financial-section-financials-wrapper-${priSessionId}` - {Purpose}
- `applicant-income-source-${applicantId}` - {Purpose}
- `source-${element.id}-source-col` - {Purpose}
- `source-${element.id}-description-col` - {Purpose}
- `source-${element.id}-last-trans-date-col` - {Purpose}
- `source-${element.id}-income-type-col` - {Purpose}
- `income-source-detail-btn` - {Purpose}
- `income-source-details` - {Purpose}
- `income-detail-transactions-table` - {Purpose}
- `income-transaction-${item.id}-amount` - {Purpose}
- `income-transaction-${item.id}-name` - {Purpose}
- `income-transaction-${item.id}-date` - {Purpose}
- `income-source-details-cancel` - {Purpose}

**Tags:** `@needs-review`

**Dependencies:**
- `./utils/helper`
- `./utils/wait-response`
- `./utils/login-form`
- `./utils/applications-page`
- `./utils/generate-session-form`
- `./utils/report-page`
- `./utils/helper`
- `./utils/session-flow`
- `./utils/common`
- `./utils/cleanup-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `check_org_member_application_permission_update.spec.js` → `Admin should be able to update an organization member\`

**Test ID:** `check_org_member_application_permission_update`  
**Test File:** `check_org_member_application_permission_update.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.818Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** {data not found for this field}

**Test Conditions:**
- **Application:** `{data not found for this field}`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** {data not found for this field}

**Test Data Used:**
- **Users:** {data not found for this field}
- **Sessions:** {data not found for this field}
- **Applications:** {data not found for this field}
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- expect(searchBar).toBeVisible({ timeout: 10000 })
- expect(targetTdLocator).toBeVisible({ timeout: 10000 })
- expect(saveBtn).toBeEnabled({ timeout: 5000 })
- expect(saveBtn).toBeEnabled({ timeout: 5000 })

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(page.getByTestId('household-status-alert')
- expect(page.getByTestId('users-tab')
- expect(page.getByTestId('members-table')
- expect(searchBar)
- expect(targetTdLocator)
- expect(page.getByTestId('member-role-modal')
- expect(saveBtn)
- expect(saveBtn)
- expect(saveBtn)

**Cleanup:**
{data not found for this field}

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `household-status-alert` - {Purpose}
- `organization-menu` - {Purpose}
- `organization-self-submenu` - {Purpose}
- `users-tab` - {Purpose}
- `members-table` - {Purpose}
- `members-table-email-col` - {Purpose}
- `member-role-modal` - {Purpose}
- `all-application-table` - {Purpose}
- `all-application-row` - {Purpose}
- `save-app-permission-btn` - {Purpose}

**Tags:** `{data not found for this field}`

**Dependencies:**
- `~/tests/utils/login-form`
- `./utils/helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `check_ui_shows_na_for-high_balance.spec.js` → `Should check UI not shows N/A for high balance accounts`

**Test ID:** `check_ui_not_show_na_for-high_balance.spec`  
**Test File:** `check_ui_shows_na_for-high_balance.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.819Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** (simulate applicant)

**Test Conditions:**
- **Application:** `AutoTest - Simulation financial employment`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** Session created via API or UI

**Test Data Used:**
- **Users:** ignacio.martinez+playwright1@verifast.com
- **Sessions:** Session with rent budget configuration
- **Applications:** AutoTest - Simulation financial employment
- **Mock Data:** ./mock-data/high-balance-financial-payload
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- expect(monthlyIncomeValue).toBe(apiIncomeFormatted)

#### Test Case

**Test Steps:**

1. **Step 1**
   - Action: Navigate to Applications Page
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

2. **Step 2**
   - Action: Find and invite application
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

3. **Step 3**
   - Action: Fill applicant info and generate session
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

4. **Step 4**
   - Action: Copy invite link
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

5. **Step 5**
   - Action: Open invite link in new context (simulate applicant)
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

6. **Step 6**
   - Action: complet rent budget step.
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

7. **Step 7**
   - Action: Connect bank and submit financial verification
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

8. **Step 8**
   - Action: Skip employment verification
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

9. **Step 9**
   - Action: Back to admin view and navigate to applicant's financial section
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

10. **Step 10**
   - Action: Verify that balances do not show N/A
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

11. **Step 11**
   - Action: Verify Cash Flow report shows value (not N/A) with polling
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

12. **Step 12**
   - Action: Verifying Cash Flow report...');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

13. **Step 13**
   - Action: Verify Monthly Gross Income card matches backend API
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

14. **Step 14**
   - Action: Verifying Monthly Gross Income matches backend...');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

**Validation Points:**
- expect(linkSection)
- expect(applicantPage.getByTestId('employment-verification-step')
- expect(balance.toLowerCase()
- expect(balanceText.toLowerCase()
- expect(cashFlowCard)
- expect(cashFlowValue)
- expect(monthlyIncomeCard)
- expect(monthlyIncomeValue)
- expect(monthlyIncomeValue)

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `session-invite-link` - {Purpose}
- `generate-session-modal-cancel` - {Purpose}
- `financial-upload-statement-btn` - {Purpose}
- `connect-bank` - {Purpose}
- `financial-verification-continue-btn` - {Purpose}
- `employment-verification-step` - {Purpose}
- `employment-step-skip-btn` - {Purpose}
- `applicants-menu` - {Purpose}
- `applicants-submenu` - {Purpose}
- `financial-section-header` - {Purpose}
- `financial-section-transactions-radio` - {Purpose}
- `financial-section-transactios-list-balance-col` - {Purpose}
- `report-cashflow-card` - {Purpose}
- `report-monthly-income-card` - {Purpose}

**Tags:** `@core`, `@regression`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `./utils/login-form`
- `./utils/applications-page`
- `./utils/generate-session-form`
- `./utils/helper`
- `./utils/report-page`
- `./utils/session-flow`
- `./utils/cleanup-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `co_app_household_with_flag_errors.spec.js` → `Should verify co-applicant flag attribution and household status transitions`

**Test ID:** `co_app_household_with_flag_errors`  
**Test File:** `co_app_household_with_flag_errors.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.822Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Test: Co-Applicant Flag Attribution and Household Status Transitions
  
  This test isolates co-applicant flag attribution and its effect on household status.
  Primary is intentionally kept clean; co-app is configured to trigger a flag.
  
  Expected Flow:
  1. Primary completes all steps (ID, Financial, Employment) and flags resolved → Status: APPROVED (UI: "Meets Criteria")
  2. Co-app invited but incomplete → GROUP_MISSING_IDENTITY flag → Status: CRITERIA_NOT_MET
  3. Co-app completes ID with name mismatch → GROUP_MISSING_IDENTITY gone, IDENTITY_NAME_MISMATCH_CRITICAL appears → Status: CRITERIA_NOT_MET
  4. Admin resolves co-app flag → Status: APPROVED (UI: "Meets Criteria")
  
  Key Validations:
  - Flags are attributed to correct applicant (primary vs co-app)
  - GROUP_MISSING_IDENTITY appears when co-app invited, disappears when co-app completes ID
  - IDENTITY_NAME_MISMATCH_CRITICAL appears for co-app name mismatch
  - Household status transitions correctly (APPROVED ↔ CRITERIA_NOT_MET)
  - API status = APPROVED corresponds to UI status = "Meets Criteria"

**Business Context:** = null;

**Test Conditions:**
- **Application:** `Autotest - Household UI test`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** Session created via API or UI

**Test Data Used:**
- **Users:** primary.applicant@verifast.com, coapplicant.household@verifast.com
- **Sessions:** Session with rent budget configuration
- **Applications:** Autotest - Household UI test
- **Mock Data:** {data not found for this field}
- **API Payloads:** Simulation payloads (PERSONA, VERIDOCS)

**Expected Outcomes:**
- expect(flagText).toContain('Identity Name Mismatch (Critical)
- expect(flagText).toContain('Coapplicant Household')

#### Test Case

**Test Steps:**

1. **Step 1**
   - Action: Admin Login and Navigate to Applications
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

2. **Step 2**
   - Action: Find and Invite Application
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

3. **Step 3**
   - Action: Generate Session and Extract Link
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

4. **Step 4**
   - Action: Open Invite link
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

5. **Step 5**
   - Action: Complete rent budget step
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

6. **Step 6**
   - Action: Skip applicants step (we'll add co-app later from admin)
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

**Validation Points:**
- expect(applicantPage.getByTestId('applicant-invite-step')
- expect(cadenceTextarea)
- expect(applicantPage.getByTestId('applicant-invite-step')
- expect(flagText)
- expect(flagText)
- expect(householdStatusAfterInvite)
- expect(nameMismatchTextarea)

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- `POST ${app.urls.api}/auth/guests` - {Purpose}
- `POST ${app.urls.api}/sessions/${sessionId}/income-sources` - {Purpose}
- `POST ${app.urls.api}/auth/guests` - {Purpose}

**UI Test IDs Used:**
- `applicant-invite-step` - {Purpose}
- `applicant-invite-skip-btn` - {Purpose}
- `financial-verification-continue-btn` - {Purpose}
- `view-details-btn` - {Purpose}
- `INCOME_SOURCE_CADENCE_MISMATCH_ERROR` - {Purpose}
- `mark_as_non_issue` - {Purpose}
- `close-event-history-modal` - {Purpose}
- `household-status-alert` - {Purpose}
- `step-APPLICANTS-lg` - {Purpose}
- `IDENTITY_NAME_MISMATCH_CRITICAL` - {Purpose}

**Tags:** `@regression`, `@household`, `@flag-attribution`

**Dependencies:**
- `~/tests/utils/applications-page`
- `~/tests/utils/helper`
- `~/tests/utils/generate-session-form`
- `~/tests/utils/login-form`
- `~/tests/utils/wait-response`
- `~/tests/utils/common`
- `~/tests/utils/session-flow`
- `~/tests/utils/report-page`
- `./utils/cleanup-helper`
- `./utils/polling-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `co_applicant_effect_on_session_test.spec.js` → `Should complete applicant flow with co-applicant effect on session`

**Test ID:** `co_applicant_effect_on_session_test`  
**Test File:** `co_applicant_effect_on_session_test.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.825Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** = await browser.newContext();

**Test Conditions:**
- **Application:** `AutoTest Suite - Full Test`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** Session created via API or UI

**Test Data Used:**
- **Users:** playwright+effect@verifast.com, playwright+coapp@verifast.com
- **Sessions:** Session with rent budget configuration
- **Applications:** AutoTest Suite - Full Test
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- {data not found for this field}

#### Test Case

**Test Steps:**

1. **Step 1**
   - Action: Admin Login and Navigate to Applications
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

2. **Step 2**
   - Action: Find and Invite Application
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

3. **Step 3**
   - Action: Generate Session and Extract Link
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

4. **Step 4**
   - Action: Open Invite link
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

5. **Step 5**
   - Action: Complete rent budget step
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

6. **Step 6**
   - Action: Check coapplicant assignable
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

**Validation Points:**
- expect(
            applicantPage.getByTestId('applicant-invite-step')
- expect(session.data.children.length)
- expect(
            session.data.children.filter(item => item.role === 'APPLICANT')
- expect(monthlyIncome)
- expect(rentBudgetRatio)
- expect(incomeSourceCount)
- expect(employmentCount)

**Cleanup:**
{data not found for this field}

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `applicant-invite-step` - {Purpose}
- `skip-id-verification-btn` - {Purpose}
- `employment-step-continue` - {Purpose}
- `session-action-btn` - {Purpose}
- `invite-applicant` - {Purpose}
- `reinvite-${session.data?.children[0]?.applicant?.id}` - {Purpose}
- `invite-modal-cancel` - {Purpose}
- `income-source-section-header` - {Purpose}
- `employment-section` - {Purpose}

**Tags:** `@regify`, `@external-integration`, `@regression`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `~/tests/utils/applications-page`
- `~/tests/utils/helper`
- `~/tests/utils/generate-session-form`
- `~/tests/utils/login-form`
- `~/tests/utils/wait-response`
- `~/tests/utils/common`
- `~/tests/utils/session-flow`
- `~/tests/utils/report-page`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `create_multiple_remarks.spec.js` → `Should allow creating multiple remarks successfully`

**Test ID:** `QA-191:create_multiple_remarks.spec`  
**Test File:** `create_multiple_remarks.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.827Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** }) => {

**Test Conditions:**
- **Application:** `Autotest - Heartbeat Test - Financial`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** Session created via API or UI

**Test Data Used:**
- **Users:** playwright+remarks@verifast.com
- **Sessions:** {data not found for this field}
- **Applications:** Autotest - Heartbeat Test - Financial
- **Mock Data:** ./mock-data/bank-statement-veridocs-payload
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- expect(element).toBe(comments.data[index].comment)
- expect(comments.data[index]?.author?.user?.email).toBe(admin.email)

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(adminToken)
- expect(applicantPage.getByTestId('pre-screening-step')
- expect(page.getByTestId('household-status-alert')
- expect(element)
- expect(comments.data[index]?.author?.user?.email)
- expect(page.getByText(remarks.r1)
- expect(page.getByText(remarks.r2)
- expect(page.getByText(remarks.r3)
- expect(reviewModalList.nth(0)
- expect(reviewModalList.nth(1)
- expect(reviewModalList.nth(2)
- expect(element)
- expect(element)
- expect(element)
- expect(element)

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `pre-screening-step` - {Purpose}
- `pre-screening-skip-btn` - {Purpose}
- `applicants-menu` - {Purpose}
- `applicants-submenu` - {Purpose}
- `household-status-alert` - {Purpose}
- `income-source-section-header` - {Purpose}
- `income-source-detail-btn` - {Purpose}
- `add-comment-modal` - {Purpose}
- `income-source-details` - {Purpose}
- `income-reviews-modal` - {Purpose}
- `remark-row-${comment.id}` - {Purpose}
- `hide-comment-btn` - {Purpose}
- `toggle-hidden-comments-btn` - {Purpose}
- `unhide-comment-btn` - {Purpose}
- `close-income-reviews-modal` - {Purpose}
- `income-source-details-cancel` - {Purpose}

**Tags:** `@core`, `@smoke`, `@regression`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `./utils/login-form`
- `./utils/report-page`
- `./utils/wait-response`
- `./utils/applications-page`
- `./utils/generate-session-form`
- `./utils/session-flow`
- `./utils/helper`
- `./utils/cleanup-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `create_session_from_dashboard.spec.js` → `Create New Session from Dashboard`

**Test ID:** `QA-223 create_session_from_dashboard.spec`  
**Test File:** `create_session_from_dashboard.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.828Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** {data not found for this field}

**Test Conditions:**
- **Application:** `AutoTest - Flag Issue V2`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** Session created via API or UI

**Test Data Used:**
- **Users:** dashboard-session-${Date.now()}@verifast.com
- **Sessions:** {data not found for this field}
- **Applications:** AutoTest - Flag Issue V2
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- expect(session.applicant.guest.first_name).toBe(userData.first_name)
- expect(session.applicant.guest.last_name).toBe(userData.last_name)
- expect(session.applicant.guest.email).toBe(userData.email)
- expect(session.application.name).toBe(application)

#### Test Case

**Test Steps:**

1. **Step 1**
   - Action: Admin login and navigate to Dashboard
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

2. **Step 2**
   - Action: Logging in as admin and navigating to dashboard...');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

3. **Step 3**
   - Action: Open create session modal, and check close modal functionality
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

4. **Step 4**
   - Action: Opening create session modal...');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

5. **Step 5**
   - Action: Validation for required fields
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

6. **Step 6**
   - Action: Checking validation for required fields...');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

7. **Step 7**
   - Action: Validation for only email filled
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

8. **Step 8**
   - Action: Checking validation for only email field...');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

9. **Step 9**
   - Action: Validation for only application filled
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

10. **Step 10**
   - Action: Checking validation for only application field...');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

11. **Step 11**
   - Action: Fill out the session details (first name, last name, email, invite)
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

12. **Step 12**
   - Action: Filling out session creation form...');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

13. **Step 13**
   - Action: Submit the session creation form
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

14. **Step 14**
   - Action: Submitting session creation form...');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

15. **Step 15**
   - Action: Verify session details
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

16. **Step 16**
   - Action: Navigate to session and validate UI navigation
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

17. **Step 17**
   - Action: Checking navigation to session detail page...');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

**Validation Points:**
- expect(createSessionModal)
- expect(createSessionModal)
- expect(createSessionModal)
- expect(createSessionModal)
- expect(createSessionModal)
- expect(createSessionModal)
- expect(page.getByTestId('crt-session-application-error')
- expect(page.getByTestId('crt-session-email-error')
- expect(createSessionModal)
- expect(page.getByTestId('crt-session-application-error')
- expect(page.getByTestId('crt-session-email-error')
- expect(createSessionModal)
- expect(createSessionModal)
- expect(page.getByTestId('crt-session-application-error')
- expect(page.getByTestId('crt-session-email-error')

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `create-new-session-btn` - {Purpose}
- `create-session-modal` - {Purpose}
- `cancel-create-session` - {Purpose}
- `create-session-modal-cancel` - {Purpose}
- `submit-create-session` - {Purpose}
- `crt-session-application-error` - {Purpose}
- `crt-session-email-error` - {Purpose}
- `crt-session-email-field` - {Purpose}
- `crt-session-application-field` - {Purpose}
- `crt-session-first-name-field` - {Purpose}
- `crt-session-last-name-field` - {Purpose}
- `crt-session-invite-checkbox` - {Purpose}
- `crt-session-organization-field` - {Purpose}

**Tags:** `@core`, `@regression`

**Dependencies:**
- `./utils/login-form`
- `./utils/common`
- `./utils/helper`
- `./utils/wait-response`
- `./utils/report-page`
- `./utils/cleanup-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `default_applicant_type_override_in_application_workflow_steps.spec.js` → `Test Default Applicant Type Override Options (Financial Step Only)`

**Test ID:** `QA-215 default_applicant_type_override_in_application_workflow_steps.spec`  
**Test File:** `default_applicant_type_override_in_application_workflow_steps.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.829Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Clicks the Financial Verification step for a specific applicant type and verifies
  that the settings match the provided financialData, and that override checkboxes are NOT visible.
  This confirms the type has its own explicit, saved configuration (inherited the default settings upon initial click).
 
  @param {import('@playwright/test').Page} page - The Playwright Page object.
  @param {object} financialData - The expected financial configuration data.

**Business Context:** {data not found for this field}

**Test Conditions:**
- **Application:** `Autotest-suite-fin-only`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** Test setup performed in beforeAll/beforeEach hooks
- **Test Data Setup:** {data not found for this field}

**Test Data Used:**
- **Users:** {data not found for this field}
- **Sessions:** {data not found for this field}
- **Applications:** Autotest-suite-fin-only
- **Mock Data:** ./fixtures/api-data-fixture
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- {data not found for this field}

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(page.getByTestId('applicants-menu')
- expect(page.getByTestId('application-table')
- expect(page.getByTestId('identity-override-settings')
- expect(page.getByTestId('identity-override-documents')
- expect(page.getByTestId('identity-override-settings')
- expect(page.getByTestId('identity-override-documents')
- expect(page.getByTestId('identity-override-settings')
- expect(page.getByTestId('identity-override-documents')
- expect(page.getByTestId('financial-setting-primary-provider-field')
- expect(page.getByTestId('financial-setting-secondary-provider-field')
- expect(page.getByTestId('financial-setting-max-connection-field')
- expect(retrieveTransactionBtn)
- expect(page.getByTestId('fin-min-required-doc')
- expect(visibilityInput.getByTestId(`doc-${element.testid}-visibility-tags`)
- expect(policyInput.getByTestId(`doc-${element.testid}-policy-tags`)

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `applicants-menu` - {Purpose}
- `application-table` - {Purpose}
- `edit-${applicationId}` - {Purpose}
- `step-#workflow-setup` - {Purpose}
- `type-default` - {Purpose}
- `workflow-financial-verification` - {Purpose}
- `identity-override-settings` - {Purpose}
- `identity-override-documents` - {Purpose}
- `submit-financial-step-form` - {Purpose}
- `financial-setup-modal` - {Purpose}
- `financial-setup-modal-cancel` - {Purpose}
- `type-${type}` - {Purpose}
- `financial-setting-primary-provider-field` - {Purpose}
- `financial-setting-secondary-provider-field` - {Purpose}
- `financial-setting-max-connection-field` - {Purpose}
- `retrive-transaction-type` - {Purpose}
- `fin-min-required-doc` - {Purpose}
- `${element.testid}-doc` - {Purpose}
- `doc-${element.testid}-visibility` - {Purpose}
- `doc-${element.testid}-visibility-tags` - {Purpose}
- `doc-${element.testid}-policy` - {Purpose}
- `doc-${element.testid}-policy-tags` - {Purpose}
- `doc-${element.testid}-max` - {Purpose}
- `document-type` - {Purpose}
- `document-type-add-btn` - {Purpose}

**Tags:** `@regression`, `@application`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `./utils/application-management`
- `./utils/applications-page`
- `./utils/cleanup-helper`
- `./utils/common`
- `./utils/helper`
- `./utils/login-form`
- `./utils/wait-response`
- `./utils/workflow-builder`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `document_policy_auto_selection_validation.spec.js` → `Test Document policy auto selection validation`

**Test ID:** `QA-226 document_policy_auto_selection_validation.spec`  
**Test File:** `document_policy_auto_selection_validation.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.830Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Verifies that the data in the financial step configuration modal matches expectations (auto-selection for Default type).

**Business Context:** {data not found for this field}

**Test Conditions:**
- **Application:** `AutoTest Policy_Selection_${getRandomNumber()}`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** Test setup performed in beforeAll/beforeEach hooks
- **Test Data Setup:** {data not found for this field}

**Test Data Used:**
- **Users:** {data not found for this field}
- **Sessions:** {data not found for this field}
- **Applications:** AutoTest Policy_Selection_${getRandomNumber()}
- **Mock Data:** ./fixtures/api-data-fixture
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- {data not found for this field}

#### Test Case

**Test Steps:**

1. **Step 1**
   - Action: Login as admin user
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

2. **Step 2**
   - Action: Create a new application with workflow template and required applicant types
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

3. **Step 3**
   - Action: Select Default applicant type in Workflow Setup
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

4. **Step 4**
   - Action: Fill the Financial step with initial policy auto-selection expected for Default type
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

5. **Step 5**
   - Action: Reopen and verify the configuration matches what was filled
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

**Validation Points:**
- expect(page.getByTestId('applicants-menu')
- expect(page.getByTestId('financial-setting-primary-provider-field')
- expect(page.getByTestId('financial-setting-secondary-provider-field')
- expect(page.getByTestId('financial-setting-max-connection-field')
- expect(retrieveTransactionBtn)
- expect(page.getByTestId('fin-min-required-doc')
- expect(visibilityInput.getByTestId(`doc-${element.testid}-visibility-tags`)
- expect(policyInput.getByTestId(`doc-${element.testid}-policy-tags`)
- expect(docMaxInput)
- expect(policyValue.startsWith('Sample System')
- expect(bankPolicyValue.trim()

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `applicants-menu` - {Purpose}
- `step-#workflow-setup` - {Purpose}
- `type-default` - {Purpose}
- `workflow-financial-verification` - {Purpose}
- `submit-financial-step-form` - {Purpose}
- `financial-setup-modal` - {Purpose}
- `financial-setup-modal-cancel` - {Purpose}
- `financial-setting-primary-provider-field` - {Purpose}
- `financial-setting-secondary-provider-field` - {Purpose}
- `financial-setting-max-connection-field` - {Purpose}
- `retrive-transaction-type` - {Purpose}
- `fin-min-required-doc` - {Purpose}
- `${element.testid}-doc` - {Purpose}
- `doc-${element.testid}-visibility` - {Purpose}
- `doc-${element.testid}-visibility-tags` - {Purpose}
- `doc-${element.testid}-policy` - {Purpose}
- `doc-${element.testid}-policy-tags` - {Purpose}
- `doc-${element.testid}-max` - {Purpose}
- `document-type` - {Purpose}
- `document-type-add-btn` - {Purpose}

**Tags:** `@application`, `@regression`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `./utils/application-management`
- `./utils/cleanup-helper`
- `./utils/common`
- `./utils/helper`
- `./utils/login-form`
- `./utils/workflow-builder`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `document_rejection_from_any_state.spec.js` → `Reject a Document Regardless of Processing State`

**Test ID:** `QA-208: Document Rejection from Any State`  
**Test File:** `document_rejection_from_any_state.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.831Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Uploads a financial statement document via manual upload.

**Business Context:** ]);

**Test Conditions:**
- **Application:** `AutoTest - Doc Rejec for any state test`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** Session created via API or UI

**Test Data Used:**
- **Users:** {data not found for this field}
- **Sessions:** {data not found for this field}
- **Applications:** AutoTest - Doc Rejec for any state test
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- {data not found for this field}

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(uploadInput)
- expect(manualUploadSubmitBtn)
- expect(financialVerification)
- expect(financialVerifications)
- expect(financialVerifications.length)
- expect(page.getByTestId('file-section-all-wrapper')
- expect(page.getByTestId('file-section-all-wrapper')
- expect(page.getByTestId('decision-modal')
- expect(rowLocator.getByTestId('files-document-status-pill')
- expect(page.getByTestId('decision-modal')
- expect(rowLocator.getByTestId('files-document-status-pill')
- expect(page.getByTestId('decision-modal')
- expect(rowLocator.getByTestId('files-document-status-pill')
- expect(applicantPage.getByTestId('financial-verification-step')
- expect(page.getByTestId('file-section-all-wrapper')

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `financial-upload-statement-btn` - {Purpose}
- `submit-manual-upload-btn` - {Purpose}
- `files-section-header` - {Purpose}
- `document-tab-all` - {Purpose}
- `file-section-all-wrapper` - {Purpose}
- `files-document-status-pill` - {Purpose}
- `decision-modal` - {Purpose}
- `decision-modal-processing-btn` - {Purpose}
- `decision-modal-reject-btn` - {Purpose}
- `decision-modal-accept-btn` - {Purpose}
- `financial-verification-step` - {Purpose}
- `all-tr-${element.id}` - {Purpose}
- `all-tr-${fileToManage.id}` - {Purpose}

**Tags:** `@regression`, `@rc-ready`, `@staging-ready`

**Dependencies:**
- `./utils/session-utils`
- `./utils/applications-page`
- `./utils/generate-session-form`
- `./utils/helper`
- `./utils/wait-response`
- `./utils/session-flow`
- `./utils/common`
- `./utils/report-page`
- `./utils/cleanup-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `financial_mx_2_attempts_success_and_failed_password.spec.js` → `Financial - mx - 2 attempts + Eligibility status transitions`

**Test ID:** `financial_mx_2_attempts_success_and_failed_password`  
**Test File:** `financial_mx_2_attempts_success_and_failed_password.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.831Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** = null;

**Test Conditions:**
- **Application:** `AutoTest - Financial Only, MX and Plaid`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** Test setup performed in beforeAll/beforeEach hooks
- **Test Data Setup:** Session created via API or UI

**Test Data Used:**
- **Users:** finmx_test@verifast.com
- **Sessions:** Session with rent budget configuration
- **Applications:** AutoTest - Financial Only, MX and Plaid
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- {data not found for this field}

#### Test Case

**Test Steps:**

1. **Step 1**
   - Action: Admin Login and Navigate
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

2. **Step 2**
   - Action: Locate Target Application
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

3. **Step 3**
   - Action: Generate Session
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

4. **Step 4**
   - Action: Applicant View — New Context
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

5. **Step 5**
   - Action: Start Financial Verification
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

6. **Step 6**
   - Action: Interact with MX iframe for bank connection
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

7. **Step 7**
   - Action: Switch to admin report view
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

8. **Step 8**
   - Action: Opening admin report view');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

9. **Step 9**
   - Action: Assert initial status - MX income should be sufficient for $500 rent
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

10. **Step 10**
   - Action: Asserting initial status - Meets Criteria');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

11. **Step 11**
   - Action: Increase rent to $3000 - Income should become insufficient
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

12. **Step 12**
   - Action: Increasing rent to $3000 (should fail criteria)');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

13. **Step 13**
   - Action: Add manual income source of $3000 - Should meet criteria again
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

14. **Step 14**
   - Action: Adding manual income source $3000 (should meet criteria)');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

15. **Step 15**
   - Action: Verify status changed back to Meets Criteria
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

16. **Step 16**
   - Action: Verifying status returns to "Meets Criteria"...');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

**Validation Points:**
- expect(page)
- expect(appNameCol)
- expect(linkSection)
- expect(financialData)
- expect(mxFrame.locator('[data-test="search-header"]')
- expect(mxFrameReopened.locator('[data-test="search-header"]')
- expect(applicantPage.locator('h3', { hasText: 'Summary' })
- expect(additionalMxFrame.locator('[data-test="MX-Bank-tile"]')
- expect(householdStatusAlert)
- expect(editRentIcon)
- expect(incomeSource)
- expect(householdStatusAlert)

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `application-table-name-col` - {Purpose}
- `application-table-invite-col` - {Purpose}
- `session-invite-link` - {Purpose}
- `connect-bank` - {Purpose}
- `financial-row-status` - {Purpose}
- `connnect-modal-cancel` - {Purpose}
- `financial-verification-row-expand-toggle` - {Purpose}
- `additional-connect-bank` - {Purpose}
- `bank-connect-modal-cancel` - {Purpose}
- `household-status-alert` - {Purpose}
- `rent-budget-edit-btn` - {Purpose}
- `submit-rent-budget` - {Purpose}
- `income-source-section-header` - {Purpose}
- `income-source-add` - {Purpose}
- `income-source-${incomeSourceId}` - {Purpose}

**Tags:** `@regression`, `@external-integration`, `@eligibility`, `@core`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `~/tests/utils/login-form`
- `~/tests/utils/generate-session-form`
- `~/tests/utils/helper.js`
- `~/tests/utils/wait-response`
- `~/tests/utils/applications-page`
- `~/tests/utils/session-flow`
- `./utils/cleanup-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `financial_plaid_one_transaction_error_decline.spec.js` → `Should handle Plaid Fin verification with insufficient transactions and decline flag`

**Test ID:** `financial_plaid_one_transaction_error_decline`  
**Test File:** `financial_plaid_one_transaction_error_decline.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.832Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** {data not found for this field}

**Test Conditions:**
- **Application:** `AutoTest - Financial Only, MX and Plaid`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** Session created via API or UI

**Test Data Used:**
- **Users:** cra+${randomName}@verifast.com
- **Sessions:** {data not found for this field}
- **Applications:** AutoTest - Financial Only, MX and Plaid
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- {data not found for this field}

#### Test Case

**Test Steps:**

1. **Step 1**
   - Action: Login as admin
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

2. **Step 2**
   - Action: Navigate to Applications
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

3. **Step 3**
   - Action: Complete applicant initial setup
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

4. **Step 4**
   - Action: Start Bank Verification process
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

5. **Step 5**
   - Action: Verify the Summary screen is displayed after submission
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

6. **Step 6**
   - Action: Navigate to Dashboard, and select Applicant Inbox - All
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

**Validation Points:**
- expect(page.getByTestId('applicants-menu')
- expect(page.locator('button:has-text("Start Bank Verification")
- expect(page.locator('h3:has-text("Summary")

**Cleanup:**
{data not found for this field}

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `applicants-menu` - {Purpose}
- `applications-menu` - {Purpose}
- `applications-submenu` - {Purpose}

**Tags:** `@smoke`, `@needs-review`, `@external-integration`, `@regression`, `@staging-ready`

**Dependencies:**
- `~/tests/utils/login-form`
- `./utils/applications-page`
- `./utils/report-page`
- `./utils/session-flow`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `flag_review_buttons_flow.spec.js` → `Verify Report Flag Review Buttons Workflow`

**Test ID:** `QA-202 flag_review_buttons_flow`  
**Test File:** `flag_review_buttons_flow.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.832Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** allTestsPassed

**Test Conditions:**
- **Application:** `Autotest - Full flow skip button test`
- **User Role:** `: `
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** {data not found for this field}

**Test Data Used:**
- **Users:** reviewbtn.playwright@verifast.com, dummyuser@test.com, dummyemail@test.com
- **Sessions:** {data not found for this field}
- **Applications:** Autotest - Full flow skip button test
- **Mock Data:** ./mock-data/high-balance-financial-payload, ./mock-data/identity-payload, ./mock-data/employment-simulation-mock-data
- **API Payloads:** Simulation payloads (PERSONA, VERIDOCS, ATOMIC)

**Expected Outcomes:**
- expect(startReviewBtn).toBeVisible({ timeout: 10_000 })
- expect(newFlagDiv).toBeVisible({ timeout: 20_000 })

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(page.getByTestId('household-status-alert')
- expect(page.getByTestId('report-view-details-flags-section')
- expect(startReviewBtn)
- expect(completeReview)
- expect(element.in_review)
- expect(page.locator(`li[id=flag-${element.id}]`)
- expect(flagDiv.locator('#description')
- expect(newFlagDiv)
- expect(newFlagDiv)
- expect(flagDiv.locator('#description')
- expect(newFlagDiv)
- expect(newFlagDiv)
- expect(newFlagDiv)
- expect(newFlagDiv)
- expect(newFlagDiv)

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- `GET /users/self` - {Purpose}
- `GET /sessions/${session.id}/flags` - {Purpose}
- `GET /sessions/${session.id}/events` - {Purpose}

**UI Test IDs Used:**
- `household-status-alert` - {Purpose}
- `report-view-details-flags-section` - {Purpose}
- `view-details-btn` - {Purpose}
- `flags-start-review-btn` - {Purpose}
- `flags-complete-review-btn` - {Purpose}
- `mark_as_issue` - {Purpose}
- `items-causing-decline-section` - {Purpose}
- `mark_as_non_issue` - {Purpose}
- `reviewed-items-section` - {Purpose}
- `complete-review-confirm-modal` - {Purpose}
- `review-confirm-ok-btn` - {Purpose}

**Tags:** `@regression`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `./utils/login-form`
- `./utils/report-page`
- `./utils/wait-response`
- `./utils/helper`
- `./endpoint-utils/session-helpers`
- `./endpoint-utils/auth-helper`
- `./endpoint-utils/application-helper`
- `./utils/cleanup-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `frontend-session-heartbeat.spec.js` → `Verify Frontend session heartbeat`

**Test ID:** `frontend-session-heartbeat`  
**Test File:** `frontend-session-heartbeat.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.833Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** {data not found for this field}

**Test Conditions:**
- **Application:** `Autotest - Application Heartbeat (Frontend)`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** Session created via API or UI

**Test Data Used:**
- **Users:** {data not found for this field}
- **Sessions:** {data not found for this field}
- **Applications:** Autotest - Application Heartbeat (Frontend)
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- {data not found for this field}

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(page.getByTestId('admin-login-btn')
- expect(page.getByTestId('start-id-verification')
- expect(page.getByTestId('applicant-invite-step')
- expect(page.getByTestId('start-id-verification')
- expect(page.getByTestId('connect-bank')
- expect(page.getByTestId('cancel-manual-upload-btn')
- expect(page.getByTestId('connect-bank')
- expect(page.getByTestId('document-pay_stub')
- expect(page.getByTestId('summary-completed-section')
- expect(page.getByTestId('get-started-btn')
- expect(incomeSources.data.length)
- expect(page.getByTestId(`income-source-${element.id}`)

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `user-dropdown-toggle-btn` - {Purpose}
- `user-logout-dropdown-item` - {Purpose}
- `admin-login-btn` - {Purpose}
- `applicant-invite-skip-btn` - {Purpose}
- `start-id-verification` - {Purpose}
- `applicant-invite-step` - {Purpose}
- `start-manual-upload-id-verification` - {Purpose}
- `cancel-manual-upload-btn` - {Purpose}
- `skip-id-verification-btn` - {Purpose}
- `connect-bank` - {Purpose}
- `financial-upload-statement-btn` - {Purpose}
- `skip-financials-btn` - {Purpose}
- `document-pay_stub` - {Purpose}
- `summary-completed-section` - {Purpose}
- `profile-dropdown-btn` - {Purpose}
- `logout-dropdown-btn` - {Purpose}
- `get-started-btn` - {Purpose}
- `income-source-section-header` - {Purpose}
- `income-source-${element.id}` - {Purpose}

**Tags:** `@regression`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `~/tests/utils/session-utils`
- `~/tests/utils/applications-page`
- `~/tests/utils/generate-session-form`
- `~/tests/utils/session-flow`
- `~/tests/utils/helper`
- `~/tests/utils/report-page`
- `./utils/wait-response`
- `./utils/cleanup-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `frontend_heartbeat.spec.js` → `Should check frontend heartbeat`

**Test ID:** `frontend_heartbeat`  
**Test File:** `frontend_heartbeat.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.833Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** = '') => {

**Test Conditions:**
- **Application:** `Autotest - UI permissions tests`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** Test setup performed in beforeAll/beforeEach hooks
- **Test Data Setup:** {data not found for this field}

**Test Data Used:**
- **Users:** heartbeat-test-${Date.now()}@verifast.com
- **Sessions:** Session with rent budget configuration
- **Applications:** Autotest - UI permissions tests
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- expect(sectionContent).toBeVisible({ timeout: 5000 })

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(button)
- expect(button)
- expect(viewDetailsBtn)
- expect(page.getByTestId('report-view-details-flags-section')
- expect(page.getByTestId('household-status-alert')
- expect(page.getByTestId('household-status-alert')
- expect(page.getByTestId('household-status-alert')
- expect(actionButton)
- expect(header)
- expect(arrow)
- expect(sectionContent)
- expect(arrow)

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `view-details-btn` - {Purpose}
- `report-view-details-flags-section` - {Purpose}
- `close-event-history-modal` - {Purpose}
- `household-status-alert` - {Purpose}
- `applicants-menu` - {Purpose}
- `applicants-submenu` - {Purpose}
- `session-action-btn` - {Purpose}

**Tags:** `@core`, `@smoke`, `@regression`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `~/tests/utils/login-form`
- `~/tests/utils/common`
- `~/tests/utils/report-page`
- `~/tests/utils/session-generator`
- `~/tests/utils/cleanup-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `frontend_heartbeat.spec.js` → `Should test session actions and section dropdowns`

**Test ID:** `frontend_heartbeat`  
**Test File:** `frontend_heartbeat.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.834Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** = '') => {

**Test Conditions:**
- **Application:** `Autotest - UI permissions tests`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** Test setup performed in beforeAll/beforeEach hooks
- **Test Data Setup:** {data not found for this field}

**Test Data Used:**
- **Users:** heartbeat-test-${Date.now()}@verifast.com
- **Sessions:** Session with rent budget configuration
- **Applications:** Autotest - UI permissions tests
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- expect(sectionContent).toBeVisible({ timeout: 5000 })

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(button)
- expect(button)
- expect(viewDetailsBtn)
- expect(page.getByTestId('report-view-details-flags-section')
- expect(page.getByTestId('household-status-alert')
- expect(page.getByTestId('household-status-alert')
- expect(page.getByTestId('household-status-alert')
- expect(actionButton)
- expect(header)
- expect(arrow)
- expect(sectionContent)
- expect(arrow)

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `view-details-btn` - {Purpose}
- `report-view-details-flags-section` - {Purpose}
- `close-event-history-modal` - {Purpose}
- `household-status-alert` - {Purpose}
- `applicants-menu` - {Purpose}
- `applicants-submenu` - {Purpose}
- `session-action-btn` - {Purpose}

**Tags:** `@core`, `@smoke`, `@regression`, `@critical`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `~/tests/utils/login-form`
- `~/tests/utils/common`
- `~/tests/utils/report-page`
- `~/tests/utils/session-generator`
- `~/tests/utils/cleanup-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `heartbeat_addresses_menus.spec.js` → `Should check Address heartbeat`

**Test ID:** `heartbeat-address-menus.spec`  
**Test File:** `heartbeat_addresses_menus.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.834Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** {data not found for this field}

**Test Conditions:**
- **Application:** `{data not found for this field}`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** {data not found for this field}

**Test Data Used:**
- **Users:** {data not found for this field}
- **Sessions:** {data not found for this field}
- **Applications:** {data not found for this field}
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- {data not found for this field}

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(page.getByTestId('household-status-alert')

**Cleanup:**
{data not found for this field}

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `household-status-alert` - {Purpose}
- `address-menu` - {Purpose}

**Tags:** `@core`, `@smoke`, `@regression`, `@critical`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `./utils/login-form`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `heartbeat_applicant_inbox_menus.spec.js` → `Should check Applicant Inbox heartbeat`

**Test ID:** `heartbeat-applicant-inbox-menus.spec`  
**Test File:** `heartbeat_applicant_inbox_menus.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.834Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** {data not found for this field}

**Test Conditions:**
- **Application:** `{data not found for this field}`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** {data not found for this field}

**Test Data Used:**
- **Users:** {data not found for this field}
- **Sessions:** {data not found for this field}
- **Applications:** {data not found for this field}
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- {data not found for this field}

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(page.getByTestId('household-status-alert')
- expect(page.locator(`.application-card[data-session="${session.id}"]`)
- expect(page.locator(`.application-card[data-session="${session.id}"]`)
- expect(page.locator(`.application-card[data-session="${session.id}"]`)
- expect(page.locator(`.application-card[data-session="${session.id}"]`)

**Cleanup:**
{data not found for this field}

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `household-status-alert` - {Purpose}
- `applicants-menu` - {Purpose}
- `applicants-submenu` - {Purpose}
- `approval-status-submenu` - {Purpose}
- `reviewed-submenu` - {Purpose}
- `rejected-submenu` - {Purpose}

**Tags:** `@core`, `@smoke`, `@regression`, `@critical`, `@staging-ready`

**Dependencies:**
- `./utils/login-form`
- `./utils/wait-response`
- `./utils/helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `heartbeat_applications_menus.spec.js` → `Should check Applications menu heartbeat`

**Test ID:** `heartbeat_applications_menus.spec`  
**Test File:** `heartbeat_applications_menus.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.834Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** {data not found for this field}

**Test Conditions:**
- **Application:** `{data not found for this field}`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** {data not found for this field}

**Test Data Used:**
- **Users:** {data not found for this field}
- **Sessions:** {data not found for this field}
- **Applications:** {data not found for this field}
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- {data not found for this field}

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(page.getByTestId('household-status-alert')
- expect(row)
- expect(portfolioMenu)
- expect(row)
- expect(workflowSubmenu)
- expect(row)
- expect(affordableMenu)
- expect(row)
- expect(approvalMenu)
- expect(row)

**Cleanup:**
{data not found for this field}

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `household-status-alert` - {Purpose}
- `applications-menu` - {Purpose}
- `applications-submenu` - {Purpose}
- `application-table` - {Purpose}
- `portfolios-submenu` - {Purpose}
- `workflows-submenu` - {Purpose}
- `workflow-table` - {Purpose}
- `affordable-templates-submenu` - {Purpose}
- `eligibility-template-table` - {Purpose}
- `approval-conditions-submenu` - {Purpose}
- `approval-conditions-table` - {Purpose}

**Tags:** `@core`, `@smoke`, `@regression`, `@critical`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `./utils/login-form`
- `./utils/wait-response`
- `./utils/helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `heartbeat_completed_application_click_check.spec.js` → `Heartbeat Test: Completed Application Clicks (frontend)`

**Test ID:** `heartbeat_completed_application_click_check`  
**Test File:** `heartbeat_completed_application_click_check.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.835Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** = await browser.newContext();

**Test Conditions:**
- **Application:** `Autotest - UI permissions tests`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** Test setup performed in beforeAll/beforeEach hooks
- **Test Data Setup:** {data not found for this field}

**Test Data Used:**
- **Users:** {data not found for this field}
- **Sessions:** Session with rent budget configuration
- **Applications:** Autotest - UI permissions tests
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- {data not found for this field}

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(newPage.getByTestId('summary-step')
- expect(newPage.getByTestId('rent-budget-step')
- expect(newPage.getByTestId('summary-step')
- expect(newPage.getByTestId('identify-step')
- expect(newPage.getByTestId('identify-step')
- expect(newPage.getByTestId('financial-verification-step')
- expect(newPage.getByTestId('connect-bank')
- expect(newPage.getByTestId('employment-verification-step')
- expect(newPage.getByTestId('summary-step')

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `raw-${sharedSessionId}` - {Purpose}
- `overview-applicant-btn` - {Purpose}
- `view-applicant-session-btn` - {Purpose}
- `summary-step` - {Purpose}
- `step-START-lg` - {Purpose}
- `rent-budget-step` - {Purpose}
- `step-IDENTITY_VERIFICATION-lg` - {Purpose}
- `identify-step` - {Purpose}
- `step-FINANCIAL_VERIFICATION-lg` - {Purpose}
- `financial-verification-step` - {Purpose}
- `connect-bank` - {Purpose}
- `step-EMPLOYMENT_VERIFICATION-lg` - {Purpose}
- `employment-verification-step` - {Purpose}
- `employment-step-continue` - {Purpose}

**Tags:** `@regression`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `~/tests/utils/session-utils`
- `~/tests/utils/report-page`
- `~/tests/utils/wait-response`
- `./utils/session-flow`
- `./utils/session-generator`
- `./utils/cleanup-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `heartbeat_documents_menus.test.js` → `Should check Documents menu heartbeat`

**Test ID:** `heartbeat_documents_menus.spec`  
**Test File:** `heartbeat_documents_menus.test.js`  
**Last Updated:** `2025-12-01T19:48:22.835Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** {data not found for this field}

**Test Conditions:**
- **Application:** `{data not found for this field}`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** {data not found for this field}

**Test Data Used:**
- **Users:** {data not found for this field}
- **Sessions:** {data not found for this field}
- **Applications:** {data not found for this field}
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- {data not found for this field}

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(page.getByTestId('household-status-alert')
- expect(row)
- expect(documentPolicySubmenu)
- expect(row)

**Cleanup:**
{data not found for this field}

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `household-status-alert` - {Purpose}
- `documents-menu` - {Purpose}
- `documents-submenu` - {Purpose}
- `documents-table` - {Purpose}
- `document-policies-submenu` - {Purpose}

**Tags:** `@core`, `@smoke`, `@regression`, `@critical`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `./utils/login-form`
- `./utils/wait-response`
- `./utils/helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `heartbeat_income_source_menus.spec.js` → `Should check Income Sources menu heartbeat`

**Test ID:** `heartbeat_income_source_menus.spec`  
**Test File:** `heartbeat_income_source_menus.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.835Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** {data not found for this field}

**Test Conditions:**
- **Application:** `{data not found for this field}`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** {data not found for this field}

**Test Data Used:**
- **Users:** {data not found for this field}
- **Sessions:** {data not found for this field}
- **Applications:** {data not found for this field}
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- expect(foundInApi).toBe(true)

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(page.getByTestId('household-status-alert')
- expect(tableRows)
- expect(foundInApi)

**Cleanup:**
{data not found for this field}

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `household-status-alert` - {Purpose}
- `incomesource-menu` - {Purpose}
- `incomesource-configuration-submenu` - {Purpose}

**Tags:** `@core`, `@smoke`, `@regression`, `@critical`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `./utils/login-form`
- `./utils/heartbeat-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `heartbeat_logout_menu.spec.js` → `Should check Logout flow heartbeat`

**Test ID:** `heartbeat_logout_menu.spec.spec`  
**Test File:** `heartbeat_logout_menu.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.836Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** {data not found for this field}

**Test Conditions:**
- **Application:** `{data not found for this field}`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** {data not found for this field}

**Test Data Used:**
- **Users:** {data not found for this field}
- **Sessions:** {data not found for this field}
- **Applications:** {data not found for this field}
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- {data not found for this field}

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(page.getByTestId('household-status-alert')
- expect(page.getByRole('heading', { name: 'Welcome' })
- expect(page.getByRole('textbox', { name: 'Email Address' })
- expect(page.getByRole('textbox', { name: 'Password' })
- expect(page.getByTestId('admin-login-btn')
- expect(page.getByRole('heading', { name: 'Welcome' })
- expect(page.getByRole('textbox', { name: 'Email Address' })
- expect(page.getByRole('textbox', { name: 'Password' })
- expect(page.getByTestId('admin-login-btn')

**Cleanup:**
{data not found for this field}

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `household-status-alert` - {Purpose}
- `logout-menu` - {Purpose}
- `admin-login-btn` - {Purpose}

**Tags:** `@core`, `@smoke`, `@regression`, `@critical`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `./utils/login-form`
- `./utils/helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `heartbeat_org_list_menus.spec.js` → `Should check Organization List menu heartbeat`

**Test ID:** `heartbeat_org_list_menus.spec`  
**Test File:** `heartbeat_org_list_menus.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.836Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** {data not found for this field}

**Test Conditions:**
- **Application:** `{data not found for this field}`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** {data not found for this field}

**Test Data Used:**
- **Users:** {data not found for this field}
- **Sessions:** {data not found for this field}
- **Applications:** {data not found for this field}
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- {data not found for this field}

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(page.getByTestId('household-status-alert')

**Cleanup:**
{data not found for this field}

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `household-status-alert` - {Purpose}
- `organizations-menu` - {Purpose}

**Tags:** `@core`, `@smoke`, `@regression`, `@critical`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `./utils/login-form`
- `./utils/heartbeat-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `heartbeat_organizations_menus.spec.js` → `Should check Organizations menu heartbeat`

**Test ID:** `heartbeat_organizations_menus.spec`  
**Test File:** `heartbeat_organizations_menus.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.836Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** {data not found for this field}

**Test Conditions:**
- **Application:** `{data not found for this field}`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** {data not found for this field}

**Test Data Used:**
- **Users:** {data not found for this field}
- **Sessions:** {data not found for this field}
- **Applications:** {data not found for this field}
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- {data not found for this field}

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(page.getByTestId('household-status-alert')
- expect(heading)
- expect(membersSubMenu)
- expect(row)

**Cleanup:**
{data not found for this field}

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `household-status-alert` - {Purpose}
- `organization-menu` - {Purpose}
- `organization-self-submenu` - {Purpose}
- `members-submenu` - {Purpose}
- `members-table` - {Purpose}

**Tags:** `@core`, `@smoke`, `@regression`, `@critical`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `./utils/login-form`
- `./utils/wait-response`
- `./utils/helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `heartbeat_reports_menus.spec.js` → `Should check Report menu heartbeat`

**Test ID:** `heartbeat_reports_menus.spec`  
**Test File:** `heartbeat_reports_menus.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.836Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** {data not found for this field}

**Test Conditions:**
- **Application:** `{data not found for this field}`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** {data not found for this field}

**Test Data Used:**
- **Users:** {data not found for this field}
- **Sessions:** {data not found for this field}
- **Applications:** {data not found for this field}
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- {data not found for this field}

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(page.getByTestId('household-status-alert')

**Cleanup:**
{data not found for this field}

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `household-status-alert` - {Purpose}
- `reports-menu` - {Purpose}
- `report-sessions-menu` - {Purpose}
- `report-verifications-menu` - {Purpose}
- `report-files-menu` - {Purpose}
- `report-income-sources-menu` - {Purpose}

**Tags:** `@core`, `@smoke`, `@regression`, `@critical`, `@staging-ready`

**Dependencies:**
- `./utils/login-form`
- `./utils/heartbeat-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `heartbeat_settings_menus.spec.js` → `Should check Settings menu heartbeat`

**Test ID:** `heartbeat_settings_menus.spec`  
**Test File:** `heartbeat_settings_menus.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.836Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** {data not found for this field}

**Test Conditions:**
- **Application:** `{data not found for this field}`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** {data not found for this field}

**Test Data Used:**
- **Users:** {data not found for this field}
- **Sessions:** {data not found for this field}
- **Applications:** {data not found for this field}
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- {data not found for this field}

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(page.getByTestId('household-status-alert')
- expect(page.getByRole('heading', { name: 'Two-factor authentication' })
- expect(page.getByRole('heading', { name: 'Additional Password Protection' })
- expect(page.getByRole('button', { name: 'Change Password' })

**Cleanup:**
{data not found for this field}

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `household-status-alert` - {Purpose}
- `settings-menu` - {Purpose}
- `account-setting-submenu` - {Purpose}
- `devices-setting-submenu` - {Purpose}
- `notification-setting-submenu` - {Purpose}
- `2fa-setting-submenu` - {Purpose}

**Tags:** `@core`, `@smoke`, `@regression`, `@critical`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `./utils/login-form`
- `./utils/heartbeat-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `heartbeat_tools_menus.spec.js` → `Should check Tools menu heartbeat`

**Test ID:** `heartbeat_tools_menus.spec`  
**Test File:** `heartbeat_tools_menus.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.836Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** {data not found for this field}

**Test Conditions:**
- **Application:** `{data not found for this field}`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** {data not found for this field}

**Test Data Used:**
- **Users:** {data not found for this field}
- **Sessions:** {data not found for this field}
- **Applications:** {data not found for this field}
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- {data not found for this field}

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(page.getByTestId('household-status-alert')
- expect(page.getByTestId('document-tester-heading')
- expect(page.getByText('Document Policy', { exact: true })
- expect(page.getByText('Upload Test File')
- expect(page.locator('.filepond--drop-label')
- expect(page.getByText('Name 1')
- expect(page.getByText('Name 2')
- expect(page.getByRole('button', { name: 'Submit' })
- expect(page.getByRole('button', { name: 'New Customer' })
- expect(page.getByRole('button', { name: 'Sandbox Customers' })
- expect(page.getByRole('heading', { name: 'Test Setup Page' })

**Cleanup:**
{data not found for this field}

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `household-status-alert` - {Purpose}
- `tools-menu` - {Purpose}
- `document-tester-submenu` - {Purpose}
- `document-tester-heading` - {Purpose}
- `name-tester-submenu` - {Purpose}
- `integrations-submenu` - {Purpose}
- `test-setup-submenu` - {Purpose}

**Tags:** `@core`, `@smoke`, `@regression`, `@critical`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `./utils/login-form`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `heartbeat_transactions_menus.spec.js` → `Should check Transactions menu heartbeat`

**Test ID:** `heartbeat_transactions_menus.spec`  
**Test File:** `heartbeat_transactions_menus.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.836Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** {data not found for this field}

**Test Conditions:**
- **Application:** `{data not found for this field}`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** {data not found for this field}

**Test Data Used:**
- **Users:** {data not found for this field}
- **Sessions:** {data not found for this field}
- **Applications:** {data not found for this field}
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- {data not found for this field}

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(page.getByTestId('household-status-alert')
- expect(keywordMappingSubMenu)
- expect(blacklistSubMenu)
- expect(providerMappingMenu)

**Cleanup:**
{data not found for this field}

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `household-status-alert` - {Purpose}
- `transactions-menu` - {Purpose}
- `transaction-tags-submenu` - {Purpose}
- `keyword-mapping-submenu` - {Purpose}
- `blacklists-submenu` - {Purpose}
- `provider-mapping-submenu` - {Purpose}

**Tags:** `@core`, `@smoke`, `@regression`, `@critical`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `./utils/login-form`
- `./utils/heartbeat-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `heartbeat_users_menu.spec.js` → `Should check User menu heartbeat`

**Test ID:** `heartbeat_users_menu.spec`  
**Test File:** `heartbeat_users_menu.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.836Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** {data not found for this field}

**Test Conditions:**
- **Application:** `{data not found for this field}`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** {data not found for this field}

**Test Data Used:**
- **Users:** {data not found for this field}
- **Sessions:** {data not found for this field}
- **Applications:** {data not found for this field}
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- {data not found for this field}

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(rolesSubMenu)
- expect(permissionSubMenu)

**Cleanup:**
{data not found for this field}

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `users-menu` - {Purpose}
- `users-submenu` - {Purpose}
- `roles-submenu` - {Purpose}
- `permissions-submenu` - {Purpose}

**Tags:** `@core`, `@smoke`, `@regression`, `@critical`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `./utils/login-form`
- `./utils/heartbeat-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `hosted_app_copy_verify_flow_plaid_id_emp_skip.spec.js` → `Should complete hosted application flow with id emp skips and Plaid integration`

**Test ID:** `hosted_app_copy_verify_flow_plaid_id_emp_skip`  
**Test File:** `hosted_app_copy_verify_flow_plaid_id_emp_skip.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.837Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** await page.goto(applicationUrl);

**Test Conditions:**
- **Application:** `AutoTest Suite Hshld-ID-Emp-Fin with skips`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** {data not found for this field}

**Test Data Used:**
- **Users:** {data not found for this field}
- **Sessions:** Session with rent budget configuration
- **Applications:** AutoTest Suite Hshld-ID-Emp-Fin with skips
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- {data not found for this field}

#### Test Case

**Test Steps:**

1. **Step 1**
   - Action: Admin login and navigate to applications
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

2. **Step 2**
   - Action: Find application and copy link
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

3. **Step 3**
   - Action: Logout current user
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

4. **Step 4**
   - Action: Navigate directly to the copied application URL (simulate applicant)
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

5. **Step 5**
   - Action: Phone login flow
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

6. **Step 6**
   - Action: Fill applicant registration form
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

7. **Step 7**
   - Action: Wait for rent budget form and fill it
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

8. **Step 8**
   - Action: Skip Applicants
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

9. **Step 9**
   - Action: Complete ID Verification (Passport) with upload
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

10. **Step 10**
   - Action: Skip employment verification
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

11. **Step 11**
   - Action: Complete Plaid financial connection
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

12. **Step 12**
   - Action: Verify Summary screen and statuses
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

13. **Step 13**
   - Action: Verify statuses - using filter to find the specific parent div
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

14. **Step 14**
   - Action: Plaid IDV Implementation - Verifying Identity Information (PR's new feature)
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

**Validation Points:**
- expect(codeInputs)
- expect(page.locator('h3:has-text("Summary")
- expect(page.locator('div')
- expect(page.locator('div')
- expect(page.locator('div')
- expect(page.locator('div')
- expect(page.locator('strong:has-text("Missing Financial Transactions")
- expect(financialSection)
- expect(account.identities?.[0]?.full_name)
- expect(account.identities?.[0]?.full_name)
- expect(accountCols.nth(index)
- expect(element.accounts)
- expect(element.accounts.length)
- expect(element.accounts[0].identities?.[0]?.full_name)
- expect(element.accounts[0].identities?.[0]?.full_name)

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `user-dropdown-toggle-btn` - {Purpose}
- `user-logout-dropdown-item` - {Purpose}
- `phone-input` - {Purpose}
- `get-started-btn` - {Purpose}
- `financial-section` - {Purpose}
- `financial-section-header` - {Purpose}
- `financial-section-financials-wrapper-${session.id}` - {Purpose}
- `financial-section-financials-wrapper-${session.id}-identities-col` - {Purpose}

**Tags:** `@smoke`, `@regression`, `@needs-review`, `@external-integration`

**Dependencies:**
- `~/tests/utils/login-form`
- `~/tests/utils/helper`
- `~/tests/utils/wait-response`
- `~/tests/utils/session-flow`
- `~/tests/utils/applications-page`
- `./utils/report-page`
- `~/tests/utils/cleanup-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `internal_scope_user_can_override_upload_doc_limit.spec.js` → `Verify Internal-scope Uploads Can Override Document Upload Limits`

**Test ID:** `QA-212 internal_scope_user_can_override_upload_doc_limit.spec`  
**Test File:** `internal_scope_user_can_override_upload_doc_limit.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.837Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** {data not found for this field}

**Test Conditions:**
- **Application:** `AutoTest - Internal Scope No Doc Limit`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** Session created via API or UI

**Test Data Used:**
- **Users:** doclimit.upload@verifast.com
- **Sessions:** {data not found for this field}
- **Applications:** AutoTest - Internal Scope No Doc Limit
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- {data not found for this field}

#### Test Case

**Test Steps:**

1. **Step 1**
   - Action: Logging in as admin and navigating to Applications');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

2. **Step 2**
   - Action: Finding and inviting the test application');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

3. **Step 3**
   - Action: Generating session for applicant & extracting invite link');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

4. **Step 4**
   - Action: Opening applicant session in new browser context');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

5. **Step 5**
   - Action: Applicant: Accepting terms, choosing type & state');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

6. **Step 6**
   - Action: Setting rent budget to 500');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

7. **Step 7**
   - Action: Applicant: Uploading paystub documents (to hit upload limit) 📑');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

8. **Step 8**
   - Action: Polling for employment verification to complete ⏲️');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

9. **Step 9**
   - Action: Attempting extra applicant paystub upload (should see upload limit error)');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

10. **Step 10**
   - Action: Admin overrides upload limit with manual paystub upload');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

11. **Step 11**
   - Action: Applicant uploading paystub(s) 📥');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

12. **Step 12**
   - Action: Submitting paystub(s) and waiting for employment verification API...');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

**Validation Points:**
- expect(applicantPage.getByTestId('pre-screening-step')
- expect(applicantPage.getByTestId('employment-verification-step')
- expect(applicantPage.getByTestId('pay_stub-limit-error')
- expect(uploadModal)
- expect(employmentResponse.ok()

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `pre-screening-step` - {Purpose}
- `pre-screening-skip-btn` - {Purpose}
- `employment-verification-step` - {Purpose}
- `document-pay_stub` - {Purpose}
- `pay_stub-limit-error` - {Purpose}
- `applicants-menu` - {Purpose}
- `applicants-submenu` - {Purpose}
- `session-action-btn` - {Purpose}
- `upload-document-btn` - {Purpose}
- `upload-document` - {Purpose}
- `select-applicant` - {Purpose}
- `select-document` - {Purpose}
- `document-employer-name` - {Purpose}
- `document-pay-cadence` - {Purpose}
- `document-pay-cadence-tags` - {Purpose}
- `submit-upload-doc-form` - {Purpose}

**Tags:** `@core`, `@regression`

**Dependencies:**
- `./utils/session-utils`
- `./utils/applications-page`
- `./utils/session-flow`
- `./utils/common`
- `./utils/generate-session-form`
- `./utils/wait-response`
- `./utils/report-page`
- `./utils/cleanup-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `merged_transactions_ui_display.spec.js` → `UI Validation for Combined Transactions Display`

**Test ID:** `QA-219: merged_transactions_ui_display.spec`  
**Test File:** `merged_transactions_ui_display.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.838Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** for applicant...");

**Test Conditions:**
- **Application:** `AutoTest - Simulation financial employment`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** Session created via API or UI

**Test Data Used:**
- **Users:** playwright+mergetransaction@verifast.com
- **Sessions:** {data not found for this field}
- **Applications:** AutoTest - Simulation financial employment
- **Mock Data:** ./fixtures/api-data-fixture, ./mock-data/high-balance-financial-payload
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- expect(financialStep).toBeVisible({ timeout: 20_000 })

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(financialStep)
- expect(page.getByTestId(`income-source-${element.id}`)
- expect(incomeSources.length)
- expect(incomeRow)
- expect(incomeRow.getByTestId(`source-${incomeSource.id}-last-trans-date-col`)
- expect(incomeDetailModal)
- expect(page.getByTestId(`description-type-showRange`)
- expect(page.getByTestId(`description-type-showRange`)
- expect(incomeRow)
- expect(incomeRow.getByTestId(`income-transaction-${transaction.id}-name`)
- expect(incomeRow.getByTestId(`income-transaction-${transaction.id}-amount`)
- expect(incomeRow.getByTestId(`income-transaction-${transaction.id}-date`)
- expect(incomeRow)
- expect(incomeRow.getByTestId('merged-transaction-label')
- expect(incomeRow.getByTestId('merged-transaction-label')

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `financial-verification-step` - {Purpose}
- `connect-bank` - {Purpose}
- `applicants-menu` - {Purpose}
- `applicants-submenu` - {Purpose}
- `income-source-${element.id}` - {Purpose}
- `income-source-${incomeSource.id}` - {Purpose}
- `source-${incomeSource.id}-last-trans-date-col` - {Purpose}
- `income-source-detail-btn` - {Purpose}
- `income-source-details` - {Purpose}
- `description-type-showRange` - {Purpose}
- `income-transaction-${transaction.id}` - {Purpose}
- `income-transaction-${transaction.id}-name` - {Purpose}
- `income-transaction-${transaction.id}-amount` - {Purpose}
- `income-transaction-${transaction.id}-date` - {Purpose}
- `merged-transaction-label` - {Purpose}

**Tags:** `@regression`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `./utils/applications-page`
- `./utils/cleanup-helper`
- `./utils/generate-session-form`
- `./utils/helper`
- `./utils/report-page`
- `./utils/session-flow`
- `./utils/session-utils`
- `./utils/wait-response`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `org_member_application_binding_scoping_check.spec.js` → `Check Application Binding Scoping (Inbox Visibility)`

**Test ID:** `QA-102: org_member_application_binding_scoping_check`  
**Test File:** `org_member_application_binding_scoping_check.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.838Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** = null;

**Test Conditions:**
- **Application:** `{data not found for this field}`
- **User Role:** `).click();
            await page.getByTestId(`
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** {data not found for this field}

**Test Data Used:**
- **Users:** {data not found for this field}
- **Sessions:** {data not found for this field}
- **Applications:** {data not found for this field}
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- expect(userOrgId).toBe(expectedOrgId)
- expect(sideItemsCount).toBe(Math.min(apiLimit, apiReturnedCount)

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(page.getByTestId('household-status-alert')
- expect(page.getByTestId('organizations-heading')
- expect(page.getByTestId('users-tab')
- expect(applicantPage.getByTestId('user-dropdown-toggle-btn')
- expect(applicantPage.getByTestId('applicants-menu')
- expect(userOrgId)
- expect(sideItemsCount)
- expect(sideItemsCount)
- expect(element)
- expect(allTabbadge)
- expect(sideItemsCount)
- expect(combinedLocator)

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `household-status-alert` - {Purpose}
- `organizations-menu` - {Purpose}
- `organizations-heading` - {Purpose}
- `users-tab` - {Purpose}
- `orgnanization-members-search` - {Purpose}
- `create-org-member-btn` - {Purpose}
- `member-role-field-autotest---empty-role` - {Purpose}
- `submit-create-member` - {Purpose}
- `copy-invitation-link` - {Purpose}
- `org-user-create-modal-cancel` - {Purpose}
- `admin-login-btn` - {Purpose}
- `user-dropdown-toggle-btn` - {Purpose}
- `applicants-menu` - {Purpose}
- `edit-${responseLIst[0].id}` - {Purpose}
- `applicants-submenu` - {Purpose}
- `side-panel` - {Purpose}
- `save-app-permission-btn` - {Purpose}
- `new-session-btn` - {Purpose}

**Tags:** `@regression`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `~/tests/utils/login-form`
- `./utils/helper`
- `./utils/wait-response`
- `./utils/cleanup-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `pdf_download_test.spec.js` → `Should successfully export PDF for an application`

**Test ID:** `pdf_download_test`  
**Test File:** `pdf_download_test.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.839Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** = await browser.newContext();

**Test Conditions:**
- **Application:** `Autotest - UI permissions tests`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** Test setup performed in beforeAll/beforeEach hooks
- **Test Data Setup:** {data not found for this field}

**Test Data Used:**
- **Users:** pdf-test-${Date.now()}@verifast.com
- **Sessions:** Session with rent budget configuration
- **Applications:** Autotest - UI permissions tests
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- {data not found for this field}

#### Test Case

**Test Steps:**

1. **Step 1**
   - Action: Navigate directly to session detail page (no login needed - context has cookies)
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

2. **Step 2**
   - Action: Export PDF using existing utility function
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

**Validation Points:**
- expect(page.getByTestId('household-status-alert')

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `household-status-alert` - {Purpose}

**Tags:** `@core`, `@regression`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `~/tests/utils/login-form`
- `~/tests/utils/report-page`
- `~/tests/utils/session-generator`
- `~/tests/utils/cleanup-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `property_admin_permission_test.spec.js` → `Should create property admin role user via API`

**Test ID:** `property_admin_permission_test`  
**Test File:** `property_admin_permission_test.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.839Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** for later cleanup

**Test Conditions:**
- **Application:** `Autotest - Property Admin`
- **User Role:** `${roleName}`
- **Environment:** `staging|production`
- **Prerequisites:** Test setup performed in beforeAll/beforeEach hooks
- **Test Data Setup:** User/member created via API

**Test Data Used:**
- **Users:** prop-admin-test-${Date.now()}@verifast.com, ${prefix}@verifast.com
- **Sessions:** Session with rent budget configuration
- **Applications:** Autotest - Property Admin
- **Mock Data:** ./fixtures/api-data-fixture
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- expect(createdUser.email).toBe(propertyAdminUserData.email)

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(createdUser.id)
- expect(createdUser.email)
- expect(page.getByTestId(menu)
- expect(applications?.length || 0)
- expect(page.locator('[data-testid^=delete-]')
- expect(page.locator('#generate-session-form')
- expect(page.getByTestId('error-page')
- expect(page.locator('[role=alert]')
- expect((await conditionRows.locator('td')
- expect(page.locator('.vf-toast__item--success')
- expect(page)
- expect(orgMemberCreateModal)
- expect(page.locator('span:has-text("No Record Found")
- expect(memberCreateModal)
- expect(page.locator('span:has-text("No Record Found")

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `application-table` - {Purpose}
- `cancel-generate-session` - {Purpose}
- `workflow-table` - {Purpose}
- `error-page` - {Purpose}
- `approval-conditions-table` - {Purpose}
- `organization-edit-btn` - {Purpose}
- `organization-edit-modal` - {Purpose}
- `organization-submit` - {Purpose}
- `close-organization-modal` - {Purpose}
- `org-app-create-btn` - {Purpose}
- `cancel-application-setup` - {Purpose}
- `create-org-member-btn` - {Purpose}
- `org-user-create-modal` - {Purpose}
- `members-table` - {Purpose}
- `create-member-btn` - {Purpose}
- `create-member-modal` - {Purpose}
- `view-details-btn` - {Purpose}
- `report-view-details-flags-section` - {Purpose}
- `session-activity-time` - {Purpose}
- `session-activity-data` - {Purpose}
- `close-event-history-modal` - {Purpose}
- `items-requiring-review-section` - {Purpose}
- `mark_as_non_issue` - {Purpose}
- `household-status-alert` - {Purpose}

**Tags:** `@regression`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `./utils/helper`
- `./utils/wait-response`
- `./utils/report-page`
- `./utils/session-utils`
- `~/tests/utils/applications-page`
- `~/tests/utils/common`
- `~/tests/utils/roles-page`
- `./utils/api-data-manager`
- `./utils/session-generator`
- `./utils/cleanup-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `property_admin_permission_test.spec.js` → `Verify property admin user permissions`

**Test ID:** `property_admin_permission_test`  
**Test File:** `property_admin_permission_test.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.839Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** for later cleanup

**Test Conditions:**
- **Application:** `Autotest - Property Admin`
- **User Role:** `${roleName}`
- **Environment:** `staging|production`
- **Prerequisites:** Test setup performed in beforeAll/beforeEach hooks
- **Test Data Setup:** User/member created via API

**Test Data Used:**
- **Users:** prop-admin-test-${Date.now()}@verifast.com, ${prefix}@verifast.com
- **Sessions:** Session with rent budget configuration
- **Applications:** Autotest - Property Admin
- **Mock Data:** ./fixtures/api-data-fixture
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- expect(createdUser.email).toBe(propertyAdminUserData.email)

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(createdUser.id)
- expect(createdUser.email)
- expect(page.getByTestId(menu)
- expect(applications?.length || 0)
- expect(page.locator('[data-testid^=delete-]')
- expect(page.locator('#generate-session-form')
- expect(page.getByTestId('error-page')
- expect(page.locator('[role=alert]')
- expect((await conditionRows.locator('td')
- expect(page.locator('.vf-toast__item--success')
- expect(page)
- expect(orgMemberCreateModal)
- expect(page.locator('span:has-text("No Record Found")
- expect(memberCreateModal)
- expect(page.locator('span:has-text("No Record Found")

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `application-table` - {Purpose}
- `cancel-generate-session` - {Purpose}
- `workflow-table` - {Purpose}
- `error-page` - {Purpose}
- `approval-conditions-table` - {Purpose}
- `organization-edit-btn` - {Purpose}
- `organization-edit-modal` - {Purpose}
- `organization-submit` - {Purpose}
- `close-organization-modal` - {Purpose}
- `org-app-create-btn` - {Purpose}
- `cancel-application-setup` - {Purpose}
- `create-org-member-btn` - {Purpose}
- `org-user-create-modal` - {Purpose}
- `members-table` - {Purpose}
- `create-member-btn` - {Purpose}
- `create-member-modal` - {Purpose}
- `view-details-btn` - {Purpose}
- `report-view-details-flags-section` - {Purpose}
- `session-activity-time` - {Purpose}
- `session-activity-data` - {Purpose}
- `close-event-history-modal` - {Purpose}
- `items-requiring-review-section` - {Purpose}
- `mark_as_non_issue` - {Purpose}
- `household-status-alert` - {Purpose}

**Tags:** `@regression`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `./utils/helper`
- `./utils/wait-response`
- `./utils/report-page`
- `./utils/session-utils`
- `~/tests/utils/applications-page`
- `~/tests/utils/common`
- `~/tests/utils/roles-page`
- `./utils/api-data-manager`
- `./utils/session-generator`
- `./utils/cleanup-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `property_admin_permission_test.spec.js` → `Check applicant inbox permissions`

**Test ID:** `property_admin_permission_test`  
**Test File:** `property_admin_permission_test.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.840Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** for later cleanup

**Test Conditions:**
- **Application:** `Autotest - Property Admin`
- **User Role:** `${roleName}`
- **Environment:** `staging|production`
- **Prerequisites:** Test setup performed in beforeAll/beforeEach hooks
- **Test Data Setup:** User/member created via API

**Test Data Used:**
- **Users:** prop-admin-test-${Date.now()}@verifast.com, ${prefix}@verifast.com
- **Sessions:** Session with rent budget configuration
- **Applications:** Autotest - Property Admin
- **Mock Data:** ./fixtures/api-data-fixture
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- expect(createdUser.email).toBe(propertyAdminUserData.email)

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(createdUser.id)
- expect(createdUser.email)
- expect(page.getByTestId(menu)
- expect(applications?.length || 0)
- expect(page.locator('[data-testid^=delete-]')
- expect(page.locator('#generate-session-form')
- expect(page.getByTestId('error-page')
- expect(page.locator('[role=alert]')
- expect((await conditionRows.locator('td')
- expect(page.locator('.vf-toast__item--success')
- expect(page)
- expect(orgMemberCreateModal)
- expect(page.locator('span:has-text("No Record Found")
- expect(memberCreateModal)
- expect(page.locator('span:has-text("No Record Found")

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `application-table` - {Purpose}
- `cancel-generate-session` - {Purpose}
- `workflow-table` - {Purpose}
- `error-page` - {Purpose}
- `approval-conditions-table` - {Purpose}
- `organization-edit-btn` - {Purpose}
- `organization-edit-modal` - {Purpose}
- `organization-submit` - {Purpose}
- `close-organization-modal` - {Purpose}
- `org-app-create-btn` - {Purpose}
- `cancel-application-setup` - {Purpose}
- `create-org-member-btn` - {Purpose}
- `org-user-create-modal` - {Purpose}
- `members-table` - {Purpose}
- `create-member-btn` - {Purpose}
- `create-member-modal` - {Purpose}
- `view-details-btn` - {Purpose}
- `report-view-details-flags-section` - {Purpose}
- `session-activity-time` - {Purpose}
- `session-activity-data` - {Purpose}
- `close-event-history-modal` - {Purpose}
- `items-requiring-review-section` - {Purpose}
- `mark_as_non_issue` - {Purpose}
- `household-status-alert` - {Purpose}

**Tags:** `@regression`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `./utils/helper`
- `./utils/wait-response`
- `./utils/report-page`
- `./utils/session-utils`
- `~/tests/utils/applications-page`
- `~/tests/utils/common`
- `~/tests/utils/roles-page`
- `./utils/api-data-manager`
- `./utils/session-generator`
- `./utils/cleanup-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `report_remarks_section.spec.js` → `Check Remarks (Comments) Section on Applicant Report`

**Test ID:** `QA-221 report_remarks_section.spec`  
**Test File:** `report_remarks_section.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.840Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** {data not found for this field}

**Test Conditions:**
- **Application:** `Autotest - Heartbeat Test - Financial`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** Session created via API or UI

**Test Data Used:**
- **Users:** test-remarkbtn@verifast.com
- **Sessions:** {data not found for this field}
- **Applications:** Autotest - Heartbeat Test - Financial
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- {data not found for this field}

#### Test Case

**Test Steps:**

1. **Step 1**
   - Action: adding comment without send to org and applicants
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

2. **Step 2**
   - Action: Adding comment without sending to organization and applicants');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

3. **Step 3**
   - Action: success: Comment visible as expected.');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

4. **Step 4**
   - Action: adding comment with send to org
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

5. **Step 5**
   - Action: Adding comment with sending to organization.');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

6. **Step 6**
   - Action: success: Notify org comment and button found.');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

7. **Step 7**
   - Action: adding comment with applicants
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

8. **Step 8**
   - Action: Adding comment with applicant notified.');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

9. **Step 9**
   - Action: success: Notify applicant comment and button found.');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

10. **Step 10**
   - Action: adding comment send to org and applicants
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

11. **Step 11**
   - Action: Adding comment with notify org and applicant together.');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

12. **Step 12**
   - Action: success: Notify org and applicant comment is visible.');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

13. **Step 13**
   - Action: Clear button check comment after
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

14. **Step 14**
   - Action: Clearing comment form after fill with clear button and checking fields state');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

15. **Step 15**
   - Action: comment hide/unhide check
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

16. **Step 16**
   - Action: Checking hide/unhide functionality for comment');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

**Validation Points:**
- expect(hideCommentDiv)
- expect(hideBtn)
- expect(viewRemarksBtn)
- expect(remarkHistoryModal)
- expect(remarkHistoryFormSection)
- expect(commentDiv)
- expect(commentLocator)
- expect(commentLocator)
- expect(commentLocator)
- expect(commentLocator)
- expect(commentLocator.getByTestId('notify-comment-btn')
- expect(commentLocator)
- expect(commentLocator)
- expect(commentLocator.getByTestId('notify-comment-btn')
- expect(commentLocator)

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `remark-comment-${commentToHide.id}` - {Purpose}
- `remark-history-modal` - {Purpose}
- `submit-remark-btn` - {Purpose}
- `generate-session-modal-cancel` - {Purpose}
- `view-remarks-btn` - {Purpose}
- `remark-history-form-section` - {Purpose}
- `remark-textarea` - {Purpose}
- `remark-history-display-section` - {Purpose}
- `remark-comment-${comment1.id}` - {Purpose}
- `remark-notify-org-checkbox` - {Purpose}
- `remark-comment-${comment2.id}` - {Purpose}
- `notify-comment-btn` - {Purpose}
- `remark-applicant-dropdown` - {Purpose}
- `remark-comment-${comment3.id}` - {Purpose}
- `remark-comment-${comment4.id}` - {Purpose}
- `clear-remark-btn` - {Purpose}
- `remark-comment-${element.id}` - {Purpose}
- `hide-comment-btn` - {Purpose}
- `toggle-hidden-comments-btn` - {Purpose}
- `unhide-comment-btn` - {Purpose}

**Tags:** `@core`, `@smoke`, `@regression`

**Dependencies:**
- `./utils/session-utils`
- `./utils/applications-page`
- `./utils/generate-session-form`
- `./utils/common`
- `./utils/report-page`
- `./utils/wait-response`
- `./utils/cleanup-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `request_additional_information.spec.js` → `Document Request: Complete validation (happy path + negative tests) @request-docs @integration @permissions @state-safetys @negative @validation @network-error @regression @staging-ready @rc-ready`

**Test ID:** `request_additional_information`  
**Test File:** `request_additional_information.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.841Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Utility: Authenticate a guest using an invitation link and return a bearer token

**Business Context:** = null;

**Test Conditions:**
- **Application:** `AutoTest - Request Doc UI test`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** Session created via API or UI

**Test Data Used:**
- **Users:** playwright+reqdocs@verifast.com, no_manage_applicants_1@verifast.com
- **Sessions:** {data not found for this field}
- **Applications:** AutoTest - Request Doc UI test
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- expect(postData.actions[0].documents).toContain('pay_stub')
- expect(invitationsRespJson?.data?._type).toBe('invitation')
- expect(invitationsRespJson?.data?.type).toBe('SESSION_ACTION')
- expect(singleJson?.data?.id).toBe(invitationId)
- expect(singleJson?.data?.type).toBe('SESSION_ACTION')
- expect(docRequestAction.documents).toContain('pay_stub')
- expect(docRequestAction.status).toBe('REQUESTED')
- expect(infoRequestedEvent.title).toBe('Information requested')
- expect(infoRequestedEvent.description).toContain('employment_document')
- expect(infoRequestedEvent.meta?.items).toBe('employment_document')

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(authResp.ok()
- expect(dialog)
- expect(adminToken)
- expect(postData)
- expect(Array.isArray(postData.actions)
- expect(postData.actions[0].action.toLowerCase()
- expect(postData.actions[0].documents)
- expect(invitationsResp.ok()
- expect(invitationsRespJson?.data?._type)
- expect(invitationsRespJson?.data?.type)
- expect(invitationId)
- expect(listResp.ok()
- expect(Array.isArray(listJson.data)
- expect(listJson.data.some(i => i.id === invitationId)
- expect(singleResp.ok()

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `session-action-btn` - {Purpose}
- `request-additional-btn` - {Purpose}
- `submit-request-additional` - {Purpose}
- `applicant-invite-skip-btn` - {Purpose}
- `skip-financials-btn` - {Purpose}
- `document-pay_stub` - {Purpose}
- `view-details-btn` - {Purpose}
- `employment-step-continue` - {Purpose}
- `cancel-request-additional` - {Purpose}
- `user-dropdown-toggle-btn` - {Purpose}
- `user-logout-dropdown-item` - {Purpose}

**Tags:** `{data not found for this field}`

**Dependencies:**
- `~/tests/utils/login-form`
- `~/tests/utils/helper`
- `~/tests/utils/applications-page`
- `~/tests/utils/generate-session-form`
- `~/tests/utils/session-flow`
- `./utils/cleanup-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `show-paystub-deposit-in-document-extracted-section.spec.js` → `Verify Display Paystub Deposits in Document → Extracted Section`

**Test ID:** `QA-213 show-paystub-deposit-in-document-extracted-section.spec`  
**Test File:** `show-paystub-deposit-in-document-extracted-section.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.841Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** = await browser.newContext()

**Test Conditions:**
- **Application:** `Autotest - Heartbeat Test - Employment`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** Session created via API or UI

**Test Data Used:**
- **Users:** test.user@verifast.com
- **Sessions:** {data not found for this field}
- **Applications:** Autotest - Heartbeat Test - Employment
- **Mock Data:** ./fixtures/api-data-fixture, ./mock-data/paystub-payload
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- expect(preScreeningStep).toBeVisible({ timeout: 20_000 })
- expect(employmentStep).toBeVisible({ timeout: 20_000 })

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(preScreeningStep)
- expect(employmentStep)
- expect(files.data.length)
- expect(files?.data?.length)
- expect(page.getByTestId('view-document-modal')
- expect(extractedSection)
- expect(depositCol)
- expect(depositCol)
- expect(applicationPage.getByTestId('document-pay_stub')

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `pre-screening-step` - {Purpose}
- `pre-screening-skip-btn` - {Purpose}
- `employment-verification-step` - {Purpose}
- `applicants-menu` - {Purpose}
- `applicants-submenu` - {Purpose}
- `files-section` - {Purpose}
- `all-files-view-btn` - {Purpose}
- `view-document-modal` - {Purpose}
- `paystub-extracted-section` - {Purpose}
- `paystub-deposit-col` - {Purpose}
- `view-document-modal-cancel` - {Purpose}
- `document-pay_stub` - {Purpose}
- `employment-upload-paystub-btn` - {Purpose}
- `employment-simulation-upload-btn` - {Purpose}

**Tags:** `@regression`, `@try-test-rail-names`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `./utils/applications-page`
- `./utils/cleanup-helper`
- `./utils/generate-session-form`
- `./utils/helper`
- `./utils/report-page`
- `./utils/session-flow`
- `./utils/session-utils`
- `./utils/wait-response`
- `./utils/polling-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `skip_button_visibility_logic.spec.js` → `Should ensure skip button visibility logic across verification steps using existing application`

**Test ID:** `skip_button_visibility_logic`  
**Test File:** `skip_button_visibility_logic.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.842Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Test skip button visibility logic for a specific verification step
  @param {import('@playwright/test').Page} page
  @param {string} stepType - 'applicants', 'identity', 'financial', 'employment'

**Business Context:** = null;

**Test Conditions:**
- **Application:** `Autotest - Full flow skip button test`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** Session created via API or UI

**Test Data Used:**
- **Users:** playwright+skipbutton@verifications.com, skipbutton.coapp@example.com
- **Sessions:** Session with rent budget configuration
- **Applications:** Autotest - Full flow skip button test
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- expect(skipButtonLocator).toBeVisible({ timeout: 20000 })
- expect(continueButtonLocator).toBeVisible({ timeout: 10000 })

#### Test Case

**Test Steps:**

1. **Step 1**
   - Action: Admin login and navigate to applications
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

2. **Step 2**
   - Action: Admin login and navigate to applications');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

3. **Step 3**
   - Action: Search for existing application
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

4. **Step 4**
   - Action: Search for existing application and invite');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

5. **Step 5**
   - Action: Generate Session and Extract Link
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

6. **Step 6**
   - Action: Generate Session and Extract Link');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

7. **Step 7**
   - Action: Applicant View — New Context
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

8. **Step 8**
   - Action: Applicant View — New Context');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

9. **Step 9**
   - Action: Setup session flow (terms → applicant type → state)
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

10. **Step 10**
   - Action: Setup session flow');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

11. **Step 11**
   - Action: Complete rent budget step
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

12. **Step 12**
   - Action: Complete rent budget step');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

13. **Step 13**
   - Action: Test Skip Button Visibility for Applicants Step
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

14. **Step 14**
   - Action: Test Skip Button Visibility for Applicants Step');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

15. **Step 15**
   - Action: Test Skip Button Visibility for Identity Verification Step
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

16. **Step 16**
   - Action: Test Skip Button Visibility for Identity Verification Step');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

17. **Step 17**
   - Action: Test Skip Button Visibility for Financial Verification Step
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

18. **Step 18**
   - Action: Test Skip Button Visibility for Financial Verification Step');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

19. **Step 19**
   - Action: Test Skip Button Visibility for Employment Verification Step
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

20. **Step 20**
   - Action: Test Skip Button Visibility for Employment Verification Step');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

21. **Step 21**
   - Action: Verify Summary screen and final statuses
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

22. **Step 22**
   - Action: Verify Summary screen and final statuses');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

**Validation Points:**
- expect(applicantPage.locator('input#rent_budget')
- expect(applicantPage.locator('h3:has-text("Summary")
- expect(applicantPage.locator('div')
- expect(applicantPage.locator('div')
- expect(applicantPage.locator('div')
- expect(applicantPage.locator('div')
- expect(applicantPage.locator('div')
- expect(page.getByTestId('step-#workflow-setup')
- expect(page.getByTestId('application-table')
- expect(skipButtonLocator)
- expect(skipButtonLocator)
- expect(continueButtonLocator)

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `edit-${application.id}` - {Purpose}
- `step-#workflow-setup` - {Purpose}
- `step-#approval-settings` - {Purpose}
- `submit-application-setting-modal` - {Purpose}
- `application-table` - {Purpose}
- `applicant-invite-skip-btn` - {Purpose}
- `applicant-invite-continue-btn` - {Purpose}
- `skip-id-verification-btn` - {Purpose}
- `id-verification-continue-btn` - {Purpose}
- `skip-financials-btn` - {Purpose}
- `financial-verification-continue-btn` - {Purpose}
- `employment-step-skip-btn` - {Purpose}
- `employment-step-continue` - {Purpose}

**Tags:** `@regression`, `@external-integration`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `~/tests/utils/login-form`
- `~/tests/utils/helper`
- `~/tests/utils/wait-response`
- `~/tests/utils/session-flow`
- `~/tests/utils/applications-page`
- `~/tests/utils/generate-session-form`
- `./utils/cleanup-helper`

**Known Issues/Limitations:**
create request check for household form submission API call

**Related Tests:**
- {data not found for this field}

---


### `staff_user_permissions_test.spec.js` → `Should create member record and assign it to the Staff role`

**Test ID:** `staff_user_permissions_test`  
**Test File:** `staff_user_permissions_test.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.843Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** for later cleanup

**Test Conditions:**
- **Application:** `Autotest - Staff`
- **User Role:** `, { tag: [ `
- **Environment:** `staging|production`
- **Prerequisites:** Test setup performed in beforeAll/beforeEach hooks
- **Test Data Setup:** User/member created via API

**Test Data Used:**
- **Users:** staff-user-test-${Date.now()}@verifast.com, ${prefix}@verifast.com
- **Sessions:** Session with rent budget configuration
- **Applications:** Autotest - Staff
- **Mock Data:** ./fixtures/api-data-fixture
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- expect(createdUser.email).toBe(staffUserData.email)
- expect(urlAfterClick).toContain('/application')
- expect(rowCount).toBe(employments.length)
- expect(rowCount).toBe(files.length)

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(createdUser.id)
- expect(createdUser.email)
- expect(page.getByTestId('applicants-menu')
- expect(page.getByTestId('applications-menu')
- expect(tableLocator)
- expect(
                    allTableRaws.nth(it)
- expect(editIconLocator.first()
- expect(urlAfterClick)
- expect(urlAfterClick)
- expect(
                page.getByTestId('report-view-details-flags-section')
- expect(
                await page.getByTestId('session-activity-time')
- expect(
                await page.getByTestId('session-activity-data')
- expect(
                page.getByTestId('applicant-identification-details')
- expect(
                page.getByTestId('applicant-identity-verifications')
- expect(
                page.getByTestId('identity-show-images')

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `applicants-menu` - {Purpose}
- `applications-menu` - {Purpose}
- `applications-submenu` - {Purpose}
- `applicants-submenu` - {Purpose}
- `view-details-btn` - {Purpose}
- `report-view-details-flags-section` - {Purpose}
- `session-activity-time` - {Purpose}
- `session-activity-data` - {Purpose}
- `close-event-history-modal` - {Purpose}
- `identity-section-header` - {Purpose}
- `applicant-identification-details` - {Purpose}
- `applicant-identity-verifications` - {Purpose}
- `identity-show-images` - {Purpose}
- `identity-more-details` - {Purpose}
- `income-source-section-header` - {Purpose}
- `income-source-detail-btn` - {Purpose}
- `income-source-delist-btn` - {Purpose}
- `show-delisted-pill` - {Purpose}
- `employment-section` - {Purpose}
- `statement-modal` - {Purpose}
- `statement-modal-cancel` - {Purpose}
- `files-section-header` - {Purpose}
- `files-section` - {Purpose}
- `all-files-view-btn` - {Purpose}
- `view-document-modal` - {Purpose}

**Tags:** `@regression`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `./utils/api-data-manager`
- `~/tests/utils/report-page`
- `./utils/session-utils`
- `./utils/wait-response`
- `./utils/session-generator`
- `./utils/cleanup-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `staff_user_permissions_test.spec.js` → `Verify permission of Staff role`

**Test ID:** `staff_user_permissions_test`  
**Test File:** `staff_user_permissions_test.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.843Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** for later cleanup

**Test Conditions:**
- **Application:** `Autotest - Staff`
- **User Role:** `, { tag: [ `
- **Environment:** `staging|production`
- **Prerequisites:** Test setup performed in beforeAll/beforeEach hooks
- **Test Data Setup:** User/member created via API

**Test Data Used:**
- **Users:** staff-user-test-${Date.now()}@verifast.com, ${prefix}@verifast.com
- **Sessions:** Session with rent budget configuration
- **Applications:** Autotest - Staff
- **Mock Data:** ./fixtures/api-data-fixture
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- expect(createdUser.email).toBe(staffUserData.email)
- expect(urlAfterClick).toContain('/application')
- expect(rowCount).toBe(employments.length)
- expect(rowCount).toBe(files.length)

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(createdUser.id)
- expect(createdUser.email)
- expect(page.getByTestId('applicants-menu')
- expect(page.getByTestId('applications-menu')
- expect(tableLocator)
- expect(
                    allTableRaws.nth(it)
- expect(editIconLocator.first()
- expect(urlAfterClick)
- expect(urlAfterClick)
- expect(
                page.getByTestId('report-view-details-flags-section')
- expect(
                await page.getByTestId('session-activity-time')
- expect(
                await page.getByTestId('session-activity-data')
- expect(
                page.getByTestId('applicant-identification-details')
- expect(
                page.getByTestId('applicant-identity-verifications')
- expect(
                page.getByTestId('identity-show-images')

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `applicants-menu` - {Purpose}
- `applications-menu` - {Purpose}
- `applications-submenu` - {Purpose}
- `applicants-submenu` - {Purpose}
- `view-details-btn` - {Purpose}
- `report-view-details-flags-section` - {Purpose}
- `session-activity-time` - {Purpose}
- `session-activity-data` - {Purpose}
- `close-event-history-modal` - {Purpose}
- `identity-section-header` - {Purpose}
- `applicant-identification-details` - {Purpose}
- `applicant-identity-verifications` - {Purpose}
- `identity-show-images` - {Purpose}
- `identity-more-details` - {Purpose}
- `income-source-section-header` - {Purpose}
- `income-source-detail-btn` - {Purpose}
- `income-source-delist-btn` - {Purpose}
- `show-delisted-pill` - {Purpose}
- `employment-section` - {Purpose}
- `statement-modal` - {Purpose}
- `statement-modal-cancel` - {Purpose}
- `files-section-header` - {Purpose}
- `files-section` - {Purpose}
- `all-files-view-btn` - {Purpose}
- `view-document-modal` - {Purpose}

**Tags:** `@regression`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `./utils/api-data-manager`
- `~/tests/utils/report-page`
- `./utils/session-utils`
- `./utils/wait-response`
- `./utils/session-generator`
- `./utils/cleanup-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `user_flags_approve_reject_test.spec.js` → `Should create applicant session for flag issue`

**Test ID:** `user_flags_approve_reject_test`  
**Test File:** `user_flags_approve_reject_test.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.844Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** {data not found for this field}

**Test Conditions:**
- **Application:** `AutoTest - Flag Issue V2`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** Session created via API or UI

**Test Data Used:**
- **Users:** FlagIssueTesting@verifast.com, ApprovalRejecttesting@verifast.com
- **Sessions:** {data not found for this field}
- **Applications:** AutoTest - Flag Issue V2
- **Mock Data:** {data not found for this field}
- **API Payloads:** Simulation payloads (VERIDOCS)

**Expected Outcomes:**
- expect(filesSectionHeader).toBeVisible({ timeout: 10_000 })
- expect(filesDocumentStatusPill).toBeVisible({ timeout: 10_000 })
- expect(decisionModal).toBeVisible({ timeout: 10_000 })
- expect(viewDetailsBtn).toBeVisible({ timeout: 10_000 })
- expect(reasonTextarea).toBeVisible({ timeout: 5_000 })
- expect(closeEventHistoryModal).toBeVisible({ timeout: 5_000 })
- expect(householdStatusAlert).toBeVisible( { timeout: 10_000 })

#### Test Case

**Test Steps:**

1. **Step 1**
   - Action: Login and navigate to session
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

2. **Step 2**
   - Action: Navigate to flags and validate sections
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

3. **Step 3**
   - Action: Mark NO_INCOME_SOURCES_DETECTED as issue
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

4. **Step 4**
   - Action: Verify flag moved to decline section
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

5. **Step 5**
   - Action: Mark MISSING_TRANSACTIONS as non-issue
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

6. **Step 6**
   - Action: Verify flag moved to reviewed section
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

7. **Step 7**
   - Action: Click files section header to open the section
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

8. **Step 8**
   - Action: Find and click the files document status pill
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

9. **Step 9**
   - Action: Wait for decision modal to appear
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

10. **Step 10**
   - Action: Click the accept button
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

11. **Step 11**
   - Action: Click View Details button to access flags
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

12. **Step 12**
   - Action: Wait for details screen to load
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

13. **Step 13**
   - Action: Find and mark all flags in "Items Requiring Review" as issues
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

14. **Step 14**
   - Action: Close details view (event history modal) and return to main session view
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

15. **Step 15**
   - Action: Wait for household status to NOT contain "Requires Review"
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

16. **Step 16**
   - Action: Now proceed with session approve/reject flow
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

**Validation Points:**
- expect(
                    icdsElement.getByTestId('NO_INCOME_SOURCES_DETECTED')
- expect(page.getByTestId('report-financial-status-modal')
- expect(
                    riSection.getByTestId('MISSING_TRANSACTIONS')
- expect(await page.getByTestId('household-status-alert')
- expect(filesSectionHeader)
- expect(filesDocumentStatusPill)
- expect(pillLink)
- expect(decisionModal)
- expect(acceptButton)
- expect(viewDetailsBtn)
- expect(markAsIssueBtn)
- expect(reasonTextarea)
- expect(confirmBtn)
- expect(closeEventHistoryModal)
- expect(householdStatusAlert)

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `applicants-menu` - {Purpose}
- `applicants-submenu` - {Purpose}
- `NO_INCOME_SOURCES_DETECTED` - {Purpose}
- `close-event-history-modal` - {Purpose}
- `raw-${sessionId}` - {Purpose}
- `raw-financial-verification-status` - {Purpose}
- `report-financial-status-modal` - {Purpose}
- `MISSING_TRANSACTIONS` - {Purpose}
- `household-status-alert` - {Purpose}
- `files-section-header` - {Purpose}
- `files-document-status-pill` - {Purpose}
- `decision-modal` - {Purpose}
- `decision-modal-accept-btn` - {Purpose}
- `view-details-btn` - {Purpose}
- `items-requiring-review-section` - {Purpose}
- `mark_as_issue` - {Purpose}

**Tags:** `@core`, `@smoke`, `@regression`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `~/tests/utils/generate-session-form`
- `~/tests/utils/login-form`
- `~/tests/utils/helper`
- `~/tests/utils/wait-response`
- `~/tests/utils/report-page`
- `~/tests/utils/session-flow`
- `./utils/cleanup-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `user_flags_approve_reject_test.spec.js` → `Check Session Flag`

**Test ID:** `user_flags_approve_reject_test`  
**Test File:** `user_flags_approve_reject_test.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.844Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** {data not found for this field}

**Test Conditions:**
- **Application:** `AutoTest - Flag Issue V2`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** Session created via API or UI

**Test Data Used:**
- **Users:** FlagIssueTesting@verifast.com, ApprovalRejecttesting@verifast.com
- **Sessions:** {data not found for this field}
- **Applications:** AutoTest - Flag Issue V2
- **Mock Data:** {data not found for this field}
- **API Payloads:** Simulation payloads (VERIDOCS)

**Expected Outcomes:**
- expect(filesSectionHeader).toBeVisible({ timeout: 10_000 })
- expect(filesDocumentStatusPill).toBeVisible({ timeout: 10_000 })
- expect(decisionModal).toBeVisible({ timeout: 10_000 })
- expect(viewDetailsBtn).toBeVisible({ timeout: 10_000 })
- expect(reasonTextarea).toBeVisible({ timeout: 5_000 })
- expect(closeEventHistoryModal).toBeVisible({ timeout: 5_000 })
- expect(householdStatusAlert).toBeVisible( { timeout: 10_000 })

#### Test Case

**Test Steps:**

1. **Step 1**
   - Action: Login and navigate to session
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

2. **Step 2**
   - Action: Navigate to flags and validate sections
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

3. **Step 3**
   - Action: Mark NO_INCOME_SOURCES_DETECTED as issue
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

4. **Step 4**
   - Action: Verify flag moved to decline section
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

5. **Step 5**
   - Action: Mark MISSING_TRANSACTIONS as non-issue
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

6. **Step 6**
   - Action: Verify flag moved to reviewed section
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

7. **Step 7**
   - Action: Click files section header to open the section
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

8. **Step 8**
   - Action: Find and click the files document status pill
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

9. **Step 9**
   - Action: Wait for decision modal to appear
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

10. **Step 10**
   - Action: Click the accept button
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

11. **Step 11**
   - Action: Click View Details button to access flags
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

12. **Step 12**
   - Action: Wait for details screen to load
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

13. **Step 13**
   - Action: Find and mark all flags in "Items Requiring Review" as issues
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

14. **Step 14**
   - Action: Close details view (event history modal) and return to main session view
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

15. **Step 15**
   - Action: Wait for household status to NOT contain "Requires Review"
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

16. **Step 16**
   - Action: Now proceed with session approve/reject flow
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

**Validation Points:**
- expect(
                    icdsElement.getByTestId('NO_INCOME_SOURCES_DETECTED')
- expect(page.getByTestId('report-financial-status-modal')
- expect(
                    riSection.getByTestId('MISSING_TRANSACTIONS')
- expect(await page.getByTestId('household-status-alert')
- expect(filesSectionHeader)
- expect(filesDocumentStatusPill)
- expect(pillLink)
- expect(decisionModal)
- expect(acceptButton)
- expect(viewDetailsBtn)
- expect(markAsIssueBtn)
- expect(reasonTextarea)
- expect(confirmBtn)
- expect(closeEventHistoryModal)
- expect(householdStatusAlert)

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `applicants-menu` - {Purpose}
- `applicants-submenu` - {Purpose}
- `NO_INCOME_SOURCES_DETECTED` - {Purpose}
- `close-event-history-modal` - {Purpose}
- `raw-${sessionId}` - {Purpose}
- `raw-financial-verification-status` - {Purpose}
- `report-financial-status-modal` - {Purpose}
- `MISSING_TRANSACTIONS` - {Purpose}
- `household-status-alert` - {Purpose}
- `files-section-header` - {Purpose}
- `files-document-status-pill` - {Purpose}
- `decision-modal` - {Purpose}
- `decision-modal-accept-btn` - {Purpose}
- `view-details-btn` - {Purpose}
- `items-requiring-review-section` - {Purpose}
- `mark_as_issue` - {Purpose}

**Tags:** `@core`, `@smoke`, `@regression`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `~/tests/utils/generate-session-form`
- `~/tests/utils/login-form`
- `~/tests/utils/helper`
- `~/tests/utils/wait-response`
- `~/tests/utils/report-page`
- `~/tests/utils/session-flow`
- `./utils/cleanup-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `user_flags_approve_reject_test.spec.js` → `Should create applicant session for approve reject`

**Test ID:** `user_flags_approve_reject_test`  
**Test File:** `user_flags_approve_reject_test.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.844Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** {data not found for this field}

**Test Conditions:**
- **Application:** `AutoTest - Flag Issue V2`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** Session created via API or UI

**Test Data Used:**
- **Users:** FlagIssueTesting@verifast.com, ApprovalRejecttesting@verifast.com
- **Sessions:** {data not found for this field}
- **Applications:** AutoTest - Flag Issue V2
- **Mock Data:** {data not found for this field}
- **API Payloads:** Simulation payloads (VERIDOCS)

**Expected Outcomes:**
- expect(filesSectionHeader).toBeVisible({ timeout: 10_000 })
- expect(filesDocumentStatusPill).toBeVisible({ timeout: 10_000 })
- expect(decisionModal).toBeVisible({ timeout: 10_000 })
- expect(viewDetailsBtn).toBeVisible({ timeout: 10_000 })
- expect(reasonTextarea).toBeVisible({ timeout: 5_000 })
- expect(closeEventHistoryModal).toBeVisible({ timeout: 5_000 })
- expect(householdStatusAlert).toBeVisible( { timeout: 10_000 })

#### Test Case

**Test Steps:**

1. **Step 1**
   - Action: Login and navigate to session
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

2. **Step 2**
   - Action: Navigate to flags and validate sections
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

3. **Step 3**
   - Action: Mark NO_INCOME_SOURCES_DETECTED as issue
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

4. **Step 4**
   - Action: Verify flag moved to decline section
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

5. **Step 5**
   - Action: Mark MISSING_TRANSACTIONS as non-issue
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

6. **Step 6**
   - Action: Verify flag moved to reviewed section
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

7. **Step 7**
   - Action: Click files section header to open the section
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

8. **Step 8**
   - Action: Find and click the files document status pill
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

9. **Step 9**
   - Action: Wait for decision modal to appear
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

10. **Step 10**
   - Action: Click the accept button
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

11. **Step 11**
   - Action: Click View Details button to access flags
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

12. **Step 12**
   - Action: Wait for details screen to load
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

13. **Step 13**
   - Action: Find and mark all flags in "Items Requiring Review" as issues
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

14. **Step 14**
   - Action: Close details view (event history modal) and return to main session view
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

15. **Step 15**
   - Action: Wait for household status to NOT contain "Requires Review"
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

16. **Step 16**
   - Action: Now proceed with session approve/reject flow
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

**Validation Points:**
- expect(
                    icdsElement.getByTestId('NO_INCOME_SOURCES_DETECTED')
- expect(page.getByTestId('report-financial-status-modal')
- expect(
                    riSection.getByTestId('MISSING_TRANSACTIONS')
- expect(await page.getByTestId('household-status-alert')
- expect(filesSectionHeader)
- expect(filesDocumentStatusPill)
- expect(pillLink)
- expect(decisionModal)
- expect(acceptButton)
- expect(viewDetailsBtn)
- expect(markAsIssueBtn)
- expect(reasonTextarea)
- expect(confirmBtn)
- expect(closeEventHistoryModal)
- expect(householdStatusAlert)

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `applicants-menu` - {Purpose}
- `applicants-submenu` - {Purpose}
- `NO_INCOME_SOURCES_DETECTED` - {Purpose}
- `close-event-history-modal` - {Purpose}
- `raw-${sessionId}` - {Purpose}
- `raw-financial-verification-status` - {Purpose}
- `report-financial-status-modal` - {Purpose}
- `MISSING_TRANSACTIONS` - {Purpose}
- `household-status-alert` - {Purpose}
- `files-section-header` - {Purpose}
- `files-document-status-pill` - {Purpose}
- `decision-modal` - {Purpose}
- `decision-modal-accept-btn` - {Purpose}
- `view-details-btn` - {Purpose}
- `items-requiring-review-section` - {Purpose}
- `mark_as_issue` - {Purpose}

**Tags:** `@core`, `@smoke`, `@regression`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `~/tests/utils/generate-session-form`
- `~/tests/utils/login-form`
- `~/tests/utils/helper`
- `~/tests/utils/wait-response`
- `~/tests/utils/report-page`
- `~/tests/utils/session-flow`
- `./utils/cleanup-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `user_flags_approve_reject_test.spec.js` → `Check session by Approving and Rejecting`

**Test ID:** `user_flags_approve_reject_test`  
**Test File:** `user_flags_approve_reject_test.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.844Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** {data not found for this field}

**Test Conditions:**
- **Application:** `AutoTest - Flag Issue V2`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** Session created via API or UI

**Test Data Used:**
- **Users:** FlagIssueTesting@verifast.com, ApprovalRejecttesting@verifast.com
- **Sessions:** {data not found for this field}
- **Applications:** AutoTest - Flag Issue V2
- **Mock Data:** {data not found for this field}
- **API Payloads:** Simulation payloads (VERIDOCS)

**Expected Outcomes:**
- expect(filesSectionHeader).toBeVisible({ timeout: 10_000 })
- expect(filesDocumentStatusPill).toBeVisible({ timeout: 10_000 })
- expect(decisionModal).toBeVisible({ timeout: 10_000 })
- expect(viewDetailsBtn).toBeVisible({ timeout: 10_000 })
- expect(reasonTextarea).toBeVisible({ timeout: 5_000 })
- expect(closeEventHistoryModal).toBeVisible({ timeout: 5_000 })
- expect(householdStatusAlert).toBeVisible( { timeout: 10_000 })

#### Test Case

**Test Steps:**

1. **Step 1**
   - Action: Login and navigate to session
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

2. **Step 2**
   - Action: Navigate to flags and validate sections
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

3. **Step 3**
   - Action: Mark NO_INCOME_SOURCES_DETECTED as issue
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

4. **Step 4**
   - Action: Verify flag moved to decline section
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

5. **Step 5**
   - Action: Mark MISSING_TRANSACTIONS as non-issue
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

6. **Step 6**
   - Action: Verify flag moved to reviewed section
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

7. **Step 7**
   - Action: Click files section header to open the section
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

8. **Step 8**
   - Action: Find and click the files document status pill
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

9. **Step 9**
   - Action: Wait for decision modal to appear
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

10. **Step 10**
   - Action: Click the accept button
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

11. **Step 11**
   - Action: Click View Details button to access flags
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

12. **Step 12**
   - Action: Wait for details screen to load
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

13. **Step 13**
   - Action: Find and mark all flags in "Items Requiring Review" as issues
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

14. **Step 14**
   - Action: Close details view (event history modal) and return to main session view
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

15. **Step 15**
   - Action: Wait for household status to NOT contain "Requires Review"
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

16. **Step 16**
   - Action: Now proceed with session approve/reject flow
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

**Validation Points:**
- expect(
                    icdsElement.getByTestId('NO_INCOME_SOURCES_DETECTED')
- expect(page.getByTestId('report-financial-status-modal')
- expect(
                    riSection.getByTestId('MISSING_TRANSACTIONS')
- expect(await page.getByTestId('household-status-alert')
- expect(filesSectionHeader)
- expect(filesDocumentStatusPill)
- expect(pillLink)
- expect(decisionModal)
- expect(acceptButton)
- expect(viewDetailsBtn)
- expect(markAsIssueBtn)
- expect(reasonTextarea)
- expect(confirmBtn)
- expect(closeEventHistoryModal)
- expect(householdStatusAlert)

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `applicants-menu` - {Purpose}
- `applicants-submenu` - {Purpose}
- `NO_INCOME_SOURCES_DETECTED` - {Purpose}
- `close-event-history-modal` - {Purpose}
- `raw-${sessionId}` - {Purpose}
- `raw-financial-verification-status` - {Purpose}
- `report-financial-status-modal` - {Purpose}
- `MISSING_TRANSACTIONS` - {Purpose}
- `household-status-alert` - {Purpose}
- `files-section-header` - {Purpose}
- `files-document-status-pill` - {Purpose}
- `decision-modal` - {Purpose}
- `decision-modal-accept-btn` - {Purpose}
- `view-details-btn` - {Purpose}
- `items-requiring-review-section` - {Purpose}
- `mark_as_issue` - {Purpose}

**Tags:** `@core`, `@smoke`, `@regression`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `~/tests/utils/generate-session-form`
- `~/tests/utils/login-form`
- `~/tests/utils/helper`
- `~/tests/utils/wait-response`
- `~/tests/utils/report-page`
- `~/tests/utils/session-flow`
- `./utils/cleanup-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `user_permissions_verify.spec.js` → `Should allow admin to create user via API`

**Test ID:** `user_permissions_verify`  
**Test File:** `user_permissions_verify.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.845Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** for later cleanup

**Test Conditions:**
- **Application:** `Autotest - Centralized Leasing`
- **User Role:** `${roleName}`
- **Environment:** `staging|production`
- **Prerequisites:** Test setup performed in beforeAll/beforeEach hooks
- **Test Data Setup:** User/member created via API

**Test Data Used:**
- **Users:** user-perm-test-${Date.now()}@verifast.com, ${prefix}@verifast.com
- **Sessions:** Session with rent budget configuration
- **Applications:** Autotest - Centralized Leasing
- **Mock Data:** ./fixtures/api-data-fixture
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- expect(createdUser.email).toBe(testUserData.email)
- expect(applicationNameInput).toBeVisible({ timeout: 20000 })

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(createdUser.id)
- expect(createdUser.email)
- expect(page.getByTestId('applications-menu')
- expect(page.getByTestId('applications-submenu')
- expect(applications?.length || 0)
- expect(page.locator('[data-testid*="edit-"]')
- expect(page)
- expect(applicationNameInput)
- expect(applicationNameInput)
- expect(inputValue.trim()
- expect(inputValue.trim()
- expect(page.getByTestId('applicants-menu')
- expect(page.getByTestId('applicants-submenu')
- expect(page.getByTestId('unreviewed-submenu')
- expect(page.getByTestId('approved-submenu')

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `applications-menu` - {Purpose}
- `applications-submenu` - {Purpose}
- `cancel-application-setup` - {Purpose}
- `applicants-menu` - {Purpose}
- `applicants-submenu` - {Purpose}
- `unreviewed-submenu` - {Purpose}
- `approved-submenu` - {Purpose}
- `rejected-submenu` - {Purpose}
- `view-details-btn` - {Purpose}
- `items-requiring-review-section` - {Purpose}
- `mark_as_non_issue` - {Purpose}
- `close-event-history-modal` - {Purpose}
- `household-status-alert` - {Purpose}

**Tags:** `@regression`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `~/tests/utils/user-create-form`
- `./utils/helper`
- `./utils/wait-response`
- `./utils/report-page`
- `./utils/session-utils`
- `./utils/permission-checks`
- `./utils/report-page`
- `./utils/section-checks`
- `./utils/api-data-manager`
- `./utils/session-generator`
- `./utils/cleanup-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `user_permissions_verify.spec.js` → `Should allow user to edit the application`

**Test ID:** `user_permissions_verify`  
**Test File:** `user_permissions_verify.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.845Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** for later cleanup

**Test Conditions:**
- **Application:** `Autotest - Centralized Leasing`
- **User Role:** `${roleName}`
- **Environment:** `staging|production`
- **Prerequisites:** Test setup performed in beforeAll/beforeEach hooks
- **Test Data Setup:** User/member created via API

**Test Data Used:**
- **Users:** user-perm-test-${Date.now()}@verifast.com, ${prefix}@verifast.com
- **Sessions:** Session with rent budget configuration
- **Applications:** Autotest - Centralized Leasing
- **Mock Data:** ./fixtures/api-data-fixture
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- expect(createdUser.email).toBe(testUserData.email)
- expect(applicationNameInput).toBeVisible({ timeout: 20000 })

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(createdUser.id)
- expect(createdUser.email)
- expect(page.getByTestId('applications-menu')
- expect(page.getByTestId('applications-submenu')
- expect(applications?.length || 0)
- expect(page.locator('[data-testid*="edit-"]')
- expect(page)
- expect(applicationNameInput)
- expect(applicationNameInput)
- expect(inputValue.trim()
- expect(inputValue.trim()
- expect(page.getByTestId('applicants-menu')
- expect(page.getByTestId('applicants-submenu')
- expect(page.getByTestId('unreviewed-submenu')
- expect(page.getByTestId('approved-submenu')

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `applications-menu` - {Purpose}
- `applications-submenu` - {Purpose}
- `cancel-application-setup` - {Purpose}
- `applicants-menu` - {Purpose}
- `applicants-submenu` - {Purpose}
- `unreviewed-submenu` - {Purpose}
- `approved-submenu` - {Purpose}
- `rejected-submenu` - {Purpose}
- `view-details-btn` - {Purpose}
- `items-requiring-review-section` - {Purpose}
- `mark_as_non_issue` - {Purpose}
- `close-event-history-modal` - {Purpose}
- `household-status-alert` - {Purpose}

**Tags:** `@regression`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `~/tests/utils/user-create-form`
- `./utils/helper`
- `./utils/wait-response`
- `./utils/report-page`
- `./utils/session-utils`
- `./utils/permission-checks`
- `./utils/report-page`
- `./utils/section-checks`
- `./utils/api-data-manager`
- `./utils/session-generator`
- `./utils/cleanup-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `user_permissions_verify.spec.js` → `Should allow user to perform permited actions`

**Test ID:** `user_permissions_verify`  
**Test File:** `user_permissions_verify.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.845Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** for later cleanup

**Test Conditions:**
- **Application:** `Autotest - Centralized Leasing`
- **User Role:** `${roleName}`
- **Environment:** `staging|production`
- **Prerequisites:** Test setup performed in beforeAll/beforeEach hooks
- **Test Data Setup:** User/member created via API

**Test Data Used:**
- **Users:** user-perm-test-${Date.now()}@verifast.com, ${prefix}@verifast.com
- **Sessions:** Session with rent budget configuration
- **Applications:** Autotest - Centralized Leasing
- **Mock Data:** ./fixtures/api-data-fixture
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- expect(createdUser.email).toBe(testUserData.email)
- expect(applicationNameInput).toBeVisible({ timeout: 20000 })

#### Test Case

**Test Steps:**

1. **Setup Phase**
   - Action: {Extracted from test code - review needed}
   - Input: {Extracted from test code - review needed}
   - Expected Result: {Extracted from test code - review needed}
   - API Calls: {Extracted from test code - review needed}
   - UI Elements: {Extracted from test code - review needed}

*Note: Detailed step extraction requires manual review. Steps are inferred from test code structure.*

**Validation Points:**
- expect(createdUser.id)
- expect(createdUser.email)
- expect(page.getByTestId('applications-menu')
- expect(page.getByTestId('applications-submenu')
- expect(applications?.length || 0)
- expect(page.locator('[data-testid*="edit-"]')
- expect(page)
- expect(applicationNameInput)
- expect(applicationNameInput)
- expect(inputValue.trim()
- expect(inputValue.trim()
- expect(page.getByTestId('applicants-menu')
- expect(page.getByTestId('applicants-submenu')
- expect(page.getByTestId('unreviewed-submenu')
- expect(page.getByTestId('approved-submenu')

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `applications-menu` - {Purpose}
- `applications-submenu` - {Purpose}
- `cancel-application-setup` - {Purpose}
- `applicants-menu` - {Purpose}
- `applicants-submenu` - {Purpose}
- `unreviewed-submenu` - {Purpose}
- `approved-submenu` - {Purpose}
- `rejected-submenu` - {Purpose}
- `view-details-btn` - {Purpose}
- `items-requiring-review-section` - {Purpose}
- `mark_as_non_issue` - {Purpose}
- `close-event-history-modal` - {Purpose}
- `household-status-alert` - {Purpose}

**Tags:** `@regression`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `~/tests/utils/user-create-form`
- `./utils/helper`
- `./utils/wait-response`
- `./utils/report-page`
- `./utils/session-utils`
- `./utils/permission-checks`
- `./utils/report-page`
- `./utils/section-checks`
- `./utils/api-data-manager`
- `./utils/session-generator`
- `./utils/cleanup-helper`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `verify_application_edit_id_step_edit.spec.js` → `Should login user and edit ID only application`

**Test ID:** `verify_application_edit_id_step_edit`  
**Test File:** `verify_application_edit_id_step_edit.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.845Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** {data not found for this field}

**Test Conditions:**
- **Application:** `AutoTest Suite - ID Edit Only`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** {data not found for this field}

**Test Data Used:**
- **Users:** {data not found for this field}
- **Sessions:** {data not found for this field}
- **Applications:** AutoTest Suite - ID Edit Only
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- {data not found for this field}

#### Test Case

**Test Steps:**

1. **Step 1**
   - Action: Admin Login and Navigate
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

**Validation Points:**
- expect(page)

**Cleanup:**
{data not found for this field}

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- {data not found for this field}

**Tags:** `@regression`, `@staging-ready`

**Dependencies:**
- `./utils/login-form`
- `./utils/application-edit-flow`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `verify_application_edit_id_step_edit.spec.js` → `Verify updates are there in application`

**Test ID:** `verify_application_edit_id_step_edit`  
**Test File:** `verify_application_edit_id_step_edit.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.845Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** {data not found for this field}

**Test Conditions:**
- **Application:** `AutoTest Suite - ID Edit Only`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** {data not found for this field}

**Test Data Used:**
- **Users:** {data not found for this field}
- **Sessions:** {data not found for this field}
- **Applications:** AutoTest Suite - ID Edit Only
- **Mock Data:** {data not found for this field}
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- {data not found for this field}

#### Test Case

**Test Steps:**

1. **Step 1**
   - Action: Admin Login and Navigate
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

**Validation Points:**
- expect(page)

**Cleanup:**
{data not found for this field}

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- {data not found for this field}

**Tags:** `@regression`, `@staging-ready`

**Dependencies:**
- `./utils/login-form`
- `./utils/application-edit-flow`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---


### `workflow_configuration_isolation_between_applications.spec.js` → `Should isolate workflow configuration changes between applications using same template`

**Test ID:** `Workflow Configuration Isolation Between Applications`  
**Test File:** `workflow_configuration_isolation_between_applications.spec.js`  
**Last Updated:** `2025-12-01T19:48:22.846Z`  
**Status:** `active`

#### Test Scenario

**Purpose:** Validates functionality as described in test name

**Business Context:** {data not found for this field}

**Test Conditions:**
- **Application:** `AutoTest Workflow_Isolation_1`
- **User Role:** {data not found for this field}
- **Environment:** `staging|production`
- **Prerequisites:** {data not found for this field}
- **Test Data Setup:** {data not found for this field}

**Test Data Used:**
- **Users:** {data not found for this field}
- **Sessions:** {data not found for this field}
- **Applications:** AutoTest Workflow_Isolation_1
- **Mock Data:** ./fixtures/api-data-fixture
- **API Payloads:** {data not found for this field}

**Expected Outcomes:**
- {data not found for this field}

#### Test Case

**Test Steps:**

1. **Step 1**
   - Action: Login as Admin
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

2. **Step 2**
   - Action: Login as Admin');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

3. **Step 3**
   - Action: Create Application 1
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

4. **Step 4**
   - Action: Create Application 1');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

5. **Step 5**
   - Action: Create Application 2 (Same Workflow Template)
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

6. **Step 6**
   - Action: Create Application 2 (Same Workflow)');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

7. **Step 7**
   - Action: Edit Application 1 - Change Financial Step Configuration
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

8. **Step 8**
   - Action: Edit Application 1 - Financial Step');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

9. **Step 9**
   - Action: Verify Application 1 Changes Were Saved
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

10. **Step 10**
   - Action: Verify Application 1 Has New Configuration');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

11. **Step 11**
   - Action: Verify Application 2 Remains UNCHANGED (Original Config)
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

12. **Step 12**
   - Action: Verify Application 2 Remains Unchanged');
   - Input: {Extracted from test code}
   - Expected Result: {Extracted from test code}

**Validation Points:**
- expect(page.getByTestId('applicants-menu')
- expect(bankStatementMaxUpload)
- expect(bankStatementMaxUploadAfter)

**Cleanup:**
Cleanup performed in afterAll hook or cleanup helper

**API Endpoints Used:**
- {data not found for this field}

**UI Test IDs Used:**
- `applicants-menu` - {Purpose}
- `step-#workflow-setup` - {Purpose}
- `type-default` - {Purpose}
- `workflow-financial-verification` - {Purpose}
- `doc-bank-statement-max` - {Purpose}
- `submit-financial-step-form` - {Purpose}
- `financial-setup-modal-cancel` - {Purpose}

**Tags:** `@core`, `@regression`, `@staging-ready`, `@rc-ready`

**Dependencies:**
- `~/tests/utils/login-form`
- `./utils/application-management`
- `./utils/cleanup-helper`
- `./utils/application-edit-flow`
- `./utils/common`

**Known Issues/Limitations:**
{data not found for this field}

**Related Tests:**
- {data not found for this field}

---

---

## Documentation Metadata

- **Last Generated:** 2025-12-01T19:48:22.846Z
- **Template Version:** 1.0
- **Tests Processed:** 50
- **New/Updated Entries:** 0
- **Unchanged Entries:** 50

## How to Update Documentation

1. Modify `TEST_DOCUMENTATION_TEMPLATE.md` if you want to change the format
2. Run: `node scripts/generate-test-documentation.js --update-all`
3. Review generated documentation and commit changes
