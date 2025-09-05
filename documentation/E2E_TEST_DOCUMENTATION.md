# E2E UI Test Documentation

## Tests Requiring Manual Review
- `financial_plaid_one_transaction_error_decline.spec.js`
- `financial_mx_1_attempt_report_check_approve_with_conditions.spec.js`
- `financial_mx_2_attempts_success_and_failed_password.spec.js`
- `employment_skip_household_not_hidden_employment_connect.spec.js`
- `hosted_app_copy_verify_flow_plaid_id_emp_skip.spec.js`

---

## Core Application Tests

### `application_create_delete_test.spec.js`
**Steps:**
1. Admin login
2. Navigate to applications
3. Create new application with multiple applicant types
4. Configure organization, workflow template, flags
5. Delete application

### `application_edit_id_template_settings.spec.js`
**Steps:**
1. Admin login
2. Navigate to applications
3. Search and select application
4. Edit ID template settings
5. Verify changes

---

## Session Flow Tests

### `frontent-session-heartbeat.spec.js`
**Steps:**
1. Admin login → Find application → Generate session
2. Applicant: Type selection → State modal → Rent budget
3. Co-applicant invitation → Employment verification
4. Financial verification (Plaid) → Paystub upload
5. Session completion and validation

### `co_applicant_effect_on_session_test.spec.js`
**Steps:**
1. Primary applicant completes session
2. Co-applicant joins and completes verification
3. Verify income aggregation and ratio calculations
4. Validate financial data across all applicants

### `application_flow_with_id_only.spec.js`
**Steps:**
1. Admin login → Generate session
2. Applicant completes ID verification only
3. Verify session completion

### `hosted_app_copy_verify_flow_plaid_id_emp_skip.spec.js`
**Steps:**
1. Complete hosted application flow
2. Plaid financial connection
3. ID verification
4. Employment verification

---

## Financial Verification Tests

### `financial_plaid_one_transaction_error_decline.spec.js`
**Steps:**
1. Complete applicant setup
2. Connect to Plaid
3. Handle transaction errors
4. Verify error handling and decline logic

### `financial_mx_1_attempt_report_check_approve_with_conditions.spec.js`
**Steps:**
1. Complete applicant setup
2. MX OAuth connection
3. Financial data verification
4. Approval workflow with conditions

### `financial_mx_2_attempts_success_and_failed_password.spec.js`
**Steps:**
1. First attempt fails
2. Retry with correct credentials
3. Verify success on second attempt

### `bank_statement_transaction_parsing.spec.js`
**Steps:**
1. Complete applicant setup
2. Upload bank statement document
3. Verify transaction parsing
4. Validate financial data

### `document_upload_verifications_core_flow.spec.js`
**Steps:**
1. Complete applicant setup
2. Upload paystub documents
3. Verify document processing
4. Validate verification flags

---

## Employment Verification Tests

### `employment_skip_household_not_hidden_employment_connect.spec.js`
**Steps:**
1. Complete applicant setup
2. Skip household information
3. Connect employment verification
4. Verify employment data

---

## Permission Tests

### `user_permissions_verify.spec.js`
**Steps:**
1. Create user via API
2. Login as user
3. Test application access
4. Test session permissions (approve/reject, export PDF)
5. Test additional document requests
6. Test co-applicant management
7. Test session merging and deletion

### `staff_user_permissions_test.spec.js`
**Steps:**
1. Create staff user
2. Test staff-specific permissions
3. Verify access limitations

### `property_admin_permission_test.spec.js`
**Steps:**
1. Create property admin user via API
2. Test property admin permissions
3. Test application and session access
4. Test role-specific capabilities

---

## Workflow Tests

### `application_step_should_skip_properly.spec.js`
**Steps:**
1. Configure application with skip conditions
2. Complete session with skip scenarios
3. Verify proper step skipping

### `applicant_type_workflow_affordable_occupant.spec.js`
**Steps:**
1. Configure affordable occupant application
2. Complete applicant flow
3. Verify affordable-specific logic

### `applicant_edits_a_workflow_used_by_another_applicant.spec.js`
**Steps:**
1. Create workflow used by multiple applicants
2. Edit workflow while in use
3. Verify conflict handling

### `verify_application_edit_id_step_edit.spec.js`
**Steps:**
1. Edit application ID step
2. Verify step configuration
3. Test step functionality

---

## Report Tests

### `pdf_download_test.spec.js`
**Steps:**
1. Complete session
2. Generate PDF report
3. Download and verify PDF

### `report_update_bank_statement_test.spec.js`
**Steps:**
1. Upload bank statement
2. Generate report
3. Update bank statement
4. Verify report updates

---

## Flag and Validation Tests

### `user_flags_approve_reject_test.spec.js`
**Steps:**
1. Complete session with flags
2. Review and approve/reject flags
3. Verify flag status updates

### `check_coapp_income_ratio_exceede_flag.spec.js`
**Steps:**
1. Complete co-applicant session
2. Verify income ratio calculations
3. Check flag generation

### `co_app_household_with_flag_errors.spec.js`
**Steps:**
1. Complete co-applicant setup
2. Generate household flag errors
3. Verify error handling

### `skip_button_visibility_logic.spec.js`
**Steps:**
1. Configure skip conditions
2. Complete session flow
3. Verify skip button behavior

### `check_org_member_application_permission_update.spec.js`
**Steps:**
1. Update organization member permissions
2. Test application access changes
3. Verify permission updates

---

## Heartbeat Tests

### `frontend_heartbeat.spec.js`
**Steps:**
1. Complete session flow
2. Monitor session state
3. Verify heartbeat functionality

### `heartbeat_completed_application_click_check.spec.js`
**Steps:**
1. Complete application
2. Navigate to completed state
3. Verify navigation and state
