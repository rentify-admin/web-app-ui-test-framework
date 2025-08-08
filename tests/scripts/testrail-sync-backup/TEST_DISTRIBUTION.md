# 📊 Test Distribution Analysis

This document provides a comprehensive overview of all test cases in the Playwright test suite, organized by tags and case IDs.

## 📈 Summary Statistics

- **Total Test Files**: 15
- **Total Tests**: 24
- **Tests with Case IDs**: 7
- **Tests without Case IDs**: 17

## 🏷️ Tag Distribution

| Tag | Count | Percentage | Description |
|-----|-------|------------|-------------|
| **@regression** | 23 | 95.8% | Full test suite for staging deployments |
| **@smoke** | 9 | 37.5% | Core + additional tests for develop branch |
| **@core** | 7 | 29.2% | Essential tests for PR validation |

## 🆔 Case ID Distribution

| Case ID | Test Name | File | Tags |
|---------|-----------|------|------|
| **C33** | ID only - 1 attempt - success | `application_flow_with_id_only.spec.js` | `@core`, `@smoke`, `@regression` |
| **C36** | Financial - mx - 2 attempts - success and failed password | `financial_mx_2_attempts_success_and_failed_password.spec.js` | `@regression` |
| **C38** | Employment - skip household not hidden employment connect | `employment-skip-household-not-hidden-employment-connect.spec.js` | `@smoke`, `@regression` |
| **C39** | Hosted app copy verify flow - Plaid financial, ID, employment skip | `hosted-app-copy-verify-flow-plaid-id-emp-skip.spec.js` | `@smoke`, `@regression` |
| **C40** | Frontend Heartbeat | `frontend-heartbeat.spec.js` | `@core`, `@smoke`, `@regression` |
| **C41** | Dashboard - Application Edit ID Template Settings | `application_edit_id_template_settings.spec.js` | `@regression` |
| **C42** | Financial - mx - 1attempt - report check - approve - approve with conditions - decline - certain flags turned off | `financial-1attempt-report-check-approve-with-conditions.spec.js` | `@core`, `@smoke`, `@regression` |

## 📋 Complete Test List by Tag

### **@core Tag (7 tests)**

| Test Name | File | Case ID | Line |
|-----------|------|---------|------|
| C33 - ID only - 1 attempt - success | `application_flow_with_id_only.spec.js` | C33 | 18 |
| C40 - Frontend Heartbeat | `frontend-heartbeat.spec.js` | C40 | 5 |
| C42 - Financial - mx - 1attempt - report check - approve - approve with conditions - decline - certain flags turned off | `financial-1attempt-report-check-approve-with-conditions.spec.js` | C42 | 24 |
| Create Applicant Session for Flag Issue | `user_flags_approve_reject_test.spec.js` | - | 46 |
| Check Session Flag Test | `user_flags_approve_reject_test.spec.js` | - | 68 |
| Create Applicant Session for Approve Reject | `user_flags_approve_reject_test.spec.js` | - | 128 |
| Check Session by Approving and Rejecting | `user_flags_approve_reject_test.spec.js` | - | 150 |

### **@smoke Tag (9 tests)**

| Test Name | File | Case ID | Line |
|-----------|------|---------|------|
| C33 - ID only - 1 attempt - success | `application_flow_with_id_only.spec.js` | C33 | 18 |
| C38 - Employment - skip household not hidden employment connect | `employment-skip-household-not-hidden-employment-connect.spec.js` | C38 | 19 |
| C39 - Hosted app copy verify flow - Plaid financial, ID, employment skip | `hosted-app-copy-verify-flow-plaid-id-emp-skip.spec.js` | C39 | 24 |
| C40 - Frontend Heartbeat | `frontend-heartbeat.spec.js` | C40 | 5 |
| C42 - Financial - mx - 1attempt - report check - approve - approve with conditions - decline - certain flags turned off | `financial-1attempt-report-check-approve-with-conditions.spec.js` | C42 | 24 |
| Create Applicant Session for Flag Issue | `user_flags_approve_reject_test.spec.js` | - | 46 |
| Check Session Flag Test | `user_flags_approve_reject_test.spec.js` | - | 68 |
| Create Applicant Session for Approve Reject | `user_flags_approve_reject_test.spec.js` | - | 128 |
| Check Session by Approving and Rejecting | `user_flags_approve_reject_test.spec.js` | - | 150 |

### **@regression Tag (23 tests)**

| Test Name | File | Case ID | Line |
|-----------|------|---------|------|
| C33 - ID only - 1 attempt - success | `application_flow_with_id_only.spec.js` | C33 | 18 |
| C36 - Financial - mx - 2 attempts - success and failed password | `financial_mx_2_attempts_success_and_failed_password.spec.js` | C36 | 25 |
| C38 - Employment - skip household not hidden employment connect | `employment-skip-household-not-hidden-employment-connect.spec.js` | C38 | 19 |
| C39 - Hosted app copy verify flow - Plaid financial, ID, employment skip | `hosted-app-copy-verify-flow-plaid-id-emp-skip.spec.js` | C39 | 24 |
| C40 - Frontend Heartbeat | `frontend-heartbeat.spec.js` | C40 | 5 |
| C41 - Dashboard - Application Edit ID Template Settings | `application_edit_id_template_settings.spec.js` | C41 | 6 |
| C42 - Financial - mx - 1attempt - report check - approve - approve with conditions - decline - certain flags turned off | `financial-1attempt-report-check-approve-with-conditions.spec.js` | C42 | 24 |
| Create Applicant Session for Flag Issue | `user_flags_approve_reject_test.spec.js` | - | 46 |
| Check Session Flag Test | `user_flags_approve_reject_test.spec.js` | - | 68 |
| Create Applicant Session for Approve Reject | `user_flags_approve_reject_test.spec.js` | - | 128 |
| Check Session by Approving and Rejecting | `user_flags_approve_reject_test.spec.js` | - | 150 |
| Login with admin user | `bank_statement_transaction_parsing.spec.js` | - | 23 |
| Co applicant household with flag errors | `co_app_household_with_flag_errors.spec.js` | - | 36 |
| Co applicant effect on session | `co_applicant_effect_on_session_test.spec.js` | - | 40 |
| Login User and edit ID only application | `verify_application_edit_id_step_edit.spec.js` | - | 16 |
| Verify updates are there in application | `verify_application_edit_id_step_edit.spec.js` | - | 38 |
| Should allow admin to create user | `user_permissions_verify.spec.js` | - | 45 |
| Should allow user to edit the application | `user_permissions_verify.spec.js` | - | 76 |
| should allow user to perform permited actions | `user_permissions_verify.spec.js` | - | 133 |
| Create Member record and assign it to the Staff role | `staff_user_permissions_test.spec.js` | - | 37 |
| Verify Permission of Staff role | `staff_user_permissions_test.spec.js` | - | 66 |
| Create property admin role user | `property_admin_permission_test.spec.js` | - | 33 |
| Verify property admin user permissions | `property_admin_permission_test.spec.js` | - | 50 |

## 📁 File Distribution

| File | Test Count | Tags |
|------|------------|------|
| `user_flags_approve_reject_test.spec.js` | 4 | `@core`, `@smoke`, `@regression` |
| `user_permissions_verify.spec.js` | 3 | `@regression` |
| `staff_user_permissions_test.spec.js` | 2 | `@regression` |
| `property_admin_permission_test.spec.js` | 2 | `@regression` |
| `verify_application_edit_id_step_edit.spec.js` | 2 | `@regression` |
| `application_flow_with_id_only.spec.js` | 1 | `@core`, `@smoke`, `@regression` |
| `financial-1attempt-report-check-approve-with-conditions.spec.js` | 1 | `@core`, `@smoke`, `@regression` |
| `frontend-heartbeat.spec.js` | 1 | `@core`, `@smoke`, `@regression` |
| `employment-skip-household-not-hidden-employment-connect.spec.js` | 1 | `@smoke`, `@regression` |
| `hosted-app-copy-verify-flow-plaid-id-emp-skip.spec.js` | 1 | `@smoke`, `@regression` |
| `financial_mx_2_attempts_success_and_failed_password.spec.js` | 1 | `@regression` |
| `application_edit_id_template_settings.spec.js` | 1 | `@regression` |
| `bank_statement_transaction_parsing.spec.js` | 1 | `@regression` |
| `co_app_household_with_flag_errors.spec.js` | 1 | `@regression` |
| `co_applicant_effect_on_session_test.spec.js` | 1 | `@regression` |

## 🎯 Test Strategy Matrix

| Event Type | Branch | Test Tag | Test Count | Description |
|------------|--------|----------|------------|-------------|
| **PR Creation** | Any → develop | `@core` | 7 | Essential functionality tests |
| **Develop Push** | develop | `@smoke` | 9 | Core + additional smoke tests |
| **Staging Deployment** | staging | `@regression` | 23 | Full test suite |

## 🔧 Recommendations

### 1. Case ID Assignment
- **Priority**: Assign case IDs to the 17 tests currently without them
- **Format**: Use sequential numbering (C43, C44, C45, etc.)
- **Naming**: Follow the pattern `C## - Description`

### 2. Tag Consistency
- **Current State**: Good tag distribution following the strategy
- **Recommendation**: Maintain the current tag hierarchy

### 3. Test Organization
- **Files with Multiple Tests**: Consider splitting large files for better maintainability
- **Test Naming**: Ensure all tests have descriptive names

### 4. Automation Integration
- **TestRail Sync**: Use the `sync-testrail-cases.js` script to keep TestRail updated
- **Case IDs**: Ensure all tests have case IDs for proper TestRail integration

## 📊 Generated By

This analysis was generated using the `sync-testrail-cases.js` script:

```bash
npm run sync-testrail-summary
```

## 🔄 Maintenance

To keep this document updated:

1. Run the sync script after adding new tests
2. Update case IDs when new tests are added
3. Review tag assignments regularly
4. Ensure TestRail synchronization is working correctly

---

**Last Updated**: Generated automatically by sync script
**Total Tests**: 24
**Files Analyzed**: 15 