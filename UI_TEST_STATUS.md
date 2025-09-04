# UI Test Framework - Current Status

## 📊 **Test Overview**
- **Total Tests**: 35+ test files
- **Core Tests**: 8 files (marked with `@core`)
- **Regression Tests**: 15+ files (marked with `@regression`)
- **File Upload Tests**: 6 files (need provider updates)

---

## ✅ **WORKING TESTS** (No File Upload)

### **Core UI Tests**
| Test File | Status | Tags | Purpose |
|-----------|--------|------|---------|
| `user_permissions_verify.spec.js` | ✅ Working | `@regression` | User permissions testing |
| `staff_user_permissions_test.spec.js` | ✅ Working | `@regression` | Staff role permissions |
| `property_admin_permission_test.spec.js` | ✅ Working | `@regression` | Property admin permissions |
| `check_org_member_application_permission_update.spec.js` | ✅ Working | `@regression` | Organization member permissions |
| `application_create_delete_test.spec.js` | ✅ Working | `@core` | Application CRUD operations |
| `application_edit_id_template_settings.spec.js` | ✅ Working | `@core` | Application settings editing |
| `verify_application_edit_id_step_edit.spec.js` | ✅ Working | `@core` | ID step editing |

### **Workflow & Flow Tests**
| Test File | Status | Tags | Purpose |
|-----------|--------|------|---------|
| `application_step_should_skip_properly.spec.js` | ✅ Working | `@core` | Step skipping functionality |
| `co_applicant_effect_on_session_test.spec.js` | ✅ Working | `@regify` | Co-applicant workflow |
| `check_coapp_income_ratio_exceede_flag.spec.js` | ✅ Working | `@smoke` | Income ratio flags |
| `co_app_household_with_flag_errors.spec.js` | ✅ Working | `@regression` | Household flag testing |
| `applicant_edits_a_workflow_used_by_another_applicant.spec.js` | ✅ Working | `@regression` | Workflow editing |
| `applicant_type_workflow_affordable_occupant.spec.js` | ✅ Working | `@core` | Applicant type workflows |

### **Financial & Plaid Tests**
| Test File | Status | Tags | Purpose |
|-----------|--------|------|---------|
| `financial_plaid_one_transaction_error_decline.spec.js` | ✅ Working | `@regression` | Plaid error handling |
| `financial_mx_1_attempt_report_check_approve_with_conditions.spec.js` | ✅ Working | `@regression` | MX financial verification |
| `financial_mx_2_attempts_success_and_failed_password.spec.js` | ✅ Working | `@regression` | MX retry logic |
| `hosted_app_copy_verify_flow_plaid_id_emp_skip.spec.js` | ✅ Working | `@regression` | Hosted app flow |

### **System & Monitoring Tests**
| Test File | Status | Tags | Purpose |
|-----------|--------|------|---------|
| `frontend_heartbeat.spec.js` | ✅ Working | `@core` | Frontend health check |
| `frontent-session-heartbeat.spec.js` | ✅ Working | `@core` | Session heartbeat |
| `heartbeat_completed_application_click_check.spec.js` | ✅ Working | `@core` | Application status check |
| `user_flags_approve_reject_test.spec.js` | ✅ Working | `@regression` | Flag approval/rejection |

---

## ⚠️ **TESTS REQUIRING UPDATES** (File Upload)

### **Document Upload Tests - NEED PROVIDER UPDATES**
| Test File | Status | Files Used | Action Required |
|-----------|--------|------------|-----------------|
| `document_upload_verifications_core_flow.spec.js` | ⚠️ **NEEDS UPDATE** | `paystub_recent.png` | **Update to correct provider** |
| `bank_statement_transaction_parsing.spec.js` | ⚠️ **NEEDS UPDATE** | `test_bank_statement.pdf` | **Update to correct provider** |
| `report_update_bank_statement_test.spec.js` | ⚠️ **SKIPPED** | `test_bank_statement.pdf` | **Update to correct provider** |
| `employment_skip_household_not_hidden_employment_connect.spec.js` | ⚠️ **NEEDS UPDATE** | Paystub uploads | **Update to correct provider** |
| `application_flow_with_id_only.spec.js` | ⚠️ **NEEDS UPDATE** | `passport.jpg` | **Update to correct provider** |
| `pdf_download_test.spec.js` | ⚠️ **NEEDS UPDATE** | PDF generation | **Update to correct provider** |

### **File Upload Details**
**Files Used:**
- `paystub_recent.png` - Paystub document (PNG format)
- `paystub_recent.pdf` - Paystub document (PDF format)  
- `test_bank_statement.pdf` - Bank statement document
- `passport.jpg` - Identity document

**⚠️ CRITICAL DECISION NEEDED:**
- **Paystub Upload Method**: Should use PNG/PDF files or new Simulation Employer system?
- **Provider Configuration**: All document upload tests need correct provider setup
- **File Types**: Confirm which file types are supported for documents in production

---

## 🔧 **SETUP & CONFIG TESTS**

### **Test Configuration**
| Test File | Status | Purpose |
|-----------|--------|---------|
| `skip_button_visibility_logic.spec.js` | ✅ Working | Skip button logic testing |

---

## 📋 **TEST EXECUTION STATUS**

### **Pipeline Ready Tests** (Can run in CI/CD)
- ✅ All `@core` tests
- ✅ All `@regression` tests  
- ✅ All workflow tests
- ✅ All financial/Plaid tests
- ✅ All permission tests

### **Local Development Only** (Need provider setup)
- ⚠️ Document upload tests
- ⚠️ PDF download tests
- ⚠️ File upload verification tests

---

## 🚨 **IMMEDIATE ACTIONS NEEDED**

### **1. Document Upload Provider Updates**
- [ ] **Update `document_upload_verifications_core_flow.spec.js`** - Fix paystub provider configuration
- [ ] **Update `bank_statement_transaction_parsing.spec.js`** - Fix bank statement provider configuration
- [ ] **Update `report_update_bank_statement_test.spec.js`** - Fix bank statement provider configuration
- [ ] **Update `employment_skip_household_not_hidden_employment_connect.spec.js`** - Fix paystub provider configuration
- [ ] **Update `application_flow_with_id_only.spec.js`** - Fix passport upload provider configuration
- [ ] **Update `pdf_download_test.spec.js`** - Fix PDF generation provider configuration

### **2. Paystub Upload Method Decision**
- [ ] **Decide**: PNG/PDF files vs Simulation Employer system for paystubs
- [ ] **Update**: All paystub-related tests accordingly
- [ ] **Test**: Verify paystub upload functionality works

### **3. Document Provider Configuration**
- [ ] **Verify**: Document upload provider is correctly configured
- [ ] **Test**: Bank statement upload endpoints work with correct provider
- [ ] **Test**: Paystub upload endpoints work with correct provider
- [ ] **Test**: Identity document upload endpoints work with correct provider
- [ ] **Document**: Provider setup requirements for document uploads

---

## 📈 **TEST COVERAGE SUMMARY**

| Category | Total | Working | Needs Update | Coverage |
|----------|-------|---------|--------------|----------|
| **Core UI** | 7 | 7 | 0 | 100% |
| **Workflow & Flow** | 6 | 6 | 0 | 100% |
| **Financial & Plaid** | 4 | 4 | 0 | 100% |
| **System & Monitoring** | 4 | 4 | 0 | 100% |
| **Document Upload** | 6 | 0 | 6 | 0% |
| **Setup & Config** | 1 | 1 | 0 | 100% |
| **TOTAL** | **28** | **22** | **6** | **79%** |

---

## 🎯 **NEXT STEPS**

1. **Fix document upload tests** (Priority 1)
2. **Decide on paystub upload method** (Priority 1)  
3. **Update provider configurations** (Priority 2)
4. **Test all document upload scenarios** (Priority 2)
5. **Document provider setup** (Priority 3)

---

## 📝 **NOTES**

- **File Upload Tests**: Currently using local test files, need provider integration
- **Paystub Format**: Tests use both PNG and PDF formats - need to standardize
- **Provider Setup**: All upload tests require correct provider configuration
- **Test Coverage**: 79% of tests are working, 21% need provider updates

---
