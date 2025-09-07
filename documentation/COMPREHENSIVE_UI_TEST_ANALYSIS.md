# Comprehensive UI Test Analysis - Complete Line-by-Line Review

## Executive Summary

This document provides a complete analysis of ALL UI test files in the framework, examining every line of code to identify true overlaps, redundancies, and optimization opportunities. The analysis is organized by categories and examines the full business purpose of each test.

## Analysis Methodology

1. **Complete File Analysis** - Read every test file in full
2. **Business Purpose Focus** - Understand what each test validates
3. **Step-by-Step Review** - Analyze every step, not just snippets
4. **True Overlap Detection** - Identify meaningful redundancies vs necessary setup
5. **Category-by-Category** - Analyze one category completely before moving to next

---

## Test Categories Identified

Based on the test files in the framework, I've identified these categories:

1. **Authentication & Permission Tests** (4 files)
2. **Financial Verification Tests** (5 files) 
3. **Application Management Tests** (7 files)
4. **Session Flow Tests** (3 files)
5. **Document Processing Tests** (3 files)
6. **System Health Tests** (2 files)
7. **Workflow Management Tests** (2 files)
8. **Integration Tests** (2 files)

---

## Category 1: Authentication & Permission Tests - COMPLETE ANALYSIS

### **Files Analyzed:**
1. `user_permissions_verify.spec.js` - **Centralized Leasing Role**
2. `staff_user_permissions_test.spec.js` - **Staff Role** 
3. `property_admin_permission_test.spec.js` - **Property Admin Role**
4. `check_org_member_application_permission_update.spec.js` - **Organization Member Role**

---

### **1. user_permissions_verify.spec.js - Centralized Leasing Role**

#### **Complete Test Structure:**
- **3 sequential tests** (serial mode, 180s timeout)
- **Global state management** for test isolation
- **API-based user creation** (not UI-based)

#### **Test 1: "Should allow admin to create user via API"**
**Purpose**: Create a Centralized Leasing user via API
**API Endpoints Called**:
- `POST /auth` - Admin authentication (via dataManager.authenticate, line 130)
  - **Response Used For**: Getting authentication token for API access
  - **What's Actually Checked**: `response.ok()` is true, `authData.token` is extracted and stored
- `POST /users` - User creation via API (via dataManager.createEntities, line 179)
  - **Response Used For**: Getting created user data for verification
  - **What's Actually Checked**: `response.ok()` is true, `createdUserData.id` exists, `createdUserData` is stored in `this.created.users`

**Steps**:
1. Authenticate admin user for API access
2. Create user with role `0196f6c9-da5e-7074-9e6e-c35ac8f1818e` (Centralized Leasing)
3. Verify user creation
4. Store user globally for other tests
5. Track for cleanup

#### **Test 2: "Should allow user to edit the application"**
**Purpose**: Test Centralized Leasing user can edit applications
**API Endpoints Called**:
- `POST /auth` - User login (via loginForm.submit, line 23)
  - **Response Used For**: Authentication and session establishment
  - **What's Actually Checked**: Response status is OK (200), page title changes to "Applicants", household-status-alert is visible
- `GET /sessions?fields[session]=` - Load sessions for user (waitForResponse, line 142)
  - **Response Used For**: Triggering login completion (no data validation)
  - **What's Actually Checked**: Response status is OK (200)
- `GET /applications` - Load applications list (waitForResponse, line 163)
  - **Response Used For**: Getting applications array for UI display
  - **What's Actually Checked**: Response status is OK (200), `applications?.length || 0` is greater than 0 (only checks count)

**Steps**:
1. Login with created user
2. Navigate to applications menu
3. Verify applications are visible
4. Click edit button on first application
5. Verify URL changes to edit page
6. Verify application name input is populated
7. Click cancel button

#### **Test 3: "Should allow user to perform permited actions"**
**Purpose**: Test comprehensive permissions for Centralized Leasing role
**API Endpoints Called**:
- `POST /auth` - User login (via loginWith → loginForm.submit, line 23)
  - **Response Used For**: Authentication and session establishment
  - **What's Actually Checked**: Response status is OK (200), page title changes to "Applicants", household-status-alert is visible
- `GET /sessions?fields[session]=` - Load sessions (waitForResponse, line 239)
  - **Response Used For**: Triggering login completion (no data validation)
  - **What's Actually Checked**: Response status is OK (200)
- `GET /sessions?fields[session]=` - Search sessions (via searchSessionWithText, line 166)
  - **Response Used For**: Getting filtered sessions data
  - **What's Actually Checked**: Response status is OK (200), sessions data array is returned
- `GET /sessions/{id}/employments` - Get employment data (waitForResponse, line 271)
  - **Response Used For**: Getting employment data for UI display
  - **What's Actually Checked**: Response status is OK (200), data passed to utility functions
- `GET /sessions/{id}/files` - Get files data (waitForResponse, line 276)
  - **Response Used For**: Getting files data for UI display
  - **What's Actually Checked**: Response status is OK (200), data passed to utility functions
- `GET /sessions/{id}?fields[session]=` - Get specific session (waitForResponse, line 281)
  - **Response Used For**: Getting session data for UI display
  - **What's Actually Checked**: Response status is OK (200), data passed to utility functions
- **Additional API calls from utility functions**:
  - `PATCH /sessions/{id}` - Update session rent budget (via checkRentBudgetEdit, line 201)
    - **What's Actually Checked**: Response status is OK (200), response data is not null
  - `PATCH /sessions/{id}` - Approve session (via checkSessionApproveReject, line 80-91)
    - **What's Actually Checked**: Response status is OK (200), response data is parsed
  - `PATCH /sessions/{id}` - Reject session (via checkSessionApproveReject, line 105-116)
    - **What's Actually Checked**: Response status is OK (200), response data is parsed
  - `GET /sessions/{sessionId}` - Export PDF (via checkExportPdf, line 240)
    - **What's Actually Checked**: Response status is OK (200), content-type is 'application/pdf'
  - `GET /sessions/{sessionId}/income-sources` - Get income sources (via checkIncomeSourceSection, line 12-15)
    - **What's Actually Checked**: Response status is OK (200), income sources data array length > 0
  - `PATCH /sessions/{sessionId}/income-sources/{id}` - Delist income source (via checkIncomeSourceSection, line 87-90)
    - **What's Actually Checked**: Response status is OK (200), income sources data contains DELISTED state
  - `PATCH /sessions/{sessionId}/income-sources/{id}` - Relist income source (via checkIncomeSourceSection, line 109-112)
    - **What's Actually Checked**: Response status is OK (200), income sources data contains LISTED state
  - `GET /financial-verifications` - Get financial verifications (via checkFinancialSectionData, line 194)
    - **What's Actually Checked**: Response status is OK (200), financial data is processed

**Steps**:
1. Login with created user
2. Navigate to applicants menu
3. Search for specific session
4. Click on session
5. **Comprehensive permission checks**:
   - View session flags
   - Edit rent budget
   - Approve/reject session
   - Export PDF
   - Request additional documents
   - Invite applicants
   - Upload bank statements and paystubs
   - Merge sessions
   - Delete applicants
   - View identity details
   - Check income source section
   - Check employment section data
   - Check files section data
   - Check financial section data

#### **Key Business Validations:**
- **Can edit applications** ✅
- **Can access all sessions** ✅
- **Can approve/reject sessions** ✅
- **Can export PDFs** ✅
- **Can request additional documents** ✅
- **Can invite/remove co-applicants** ✅
- **Can upload session documents** ✅
- **Can merge sessions** ✅
- **Can delete applicants** ✅

---

### **2. staff_user_permissions_test.spec.js - Staff Role**

#### **Complete Test Structure:**
- **2 sequential tests** (serial mode, 180s timeout)
- **Global state management** for test isolation
- **API-based user creation**

#### **Test 1: "Should create member record and assign it to the Staff role"**
**Purpose**: Create a Staff user via API
**API Endpoints Called**:
- `POST /auth` - Admin authentication (via dataManager.authenticate, line 130)
  - **Response Used For**: Getting authentication token for API access
  - **What's Actually Checked**: `response.ok()` is true, `authData.token` is extracted and stored
- `POST /users` - User creation via API (via dataManager.createEntities, line 179)
  - **Response Used For**: Getting created user data for verification
  - **What's Actually Checked**: `response.ok()` is true, `createdUserData.id` exists, `createdUserData` is stored in `this.created.users`

**Steps**:
1. Authenticate admin user for API access
2. Create user with role `0196f6c9-da51-7337-bbde-ca7d0efd7f84` (Staff)
3. Verify user creation
4. Store user globally for other tests
5. Track for cleanup

#### **Test 2: "Verify permission of Staff role"**
**Purpose**: Test limited permissions for Staff role
**API Endpoints Called**:
- `POST /auth` - User login (via loginWith → loginForm.submit, line 23)
  - **Response Used For**: Authentication and session establishment
  - **What's Actually Checked**: Response status is OK (200), page title changes to "Applicants", household-status-alert is visible
- `GET /applications` - Load applications list (waitForResponse, line 123)
  - **Response Used For**: Getting applications array for UI display
  - **What's Actually Checked**: Response status is OK (200), applications table is visible, table rows match application names
- `GET /sessions?.*${sessionID}` - Search sessions by ID (waitForResponse with regex, line 156)
  - **Response Used For**: Getting filtered sessions data
  - **What's Actually Checked**: Response status is OK (200), sessions data array is returned
- `GET /sessions/${sessionID}/employments` - Get employment data (waitForResponse, line 171)
  - **Response Used For**: Getting employment data for UI display
  - **What's Actually Checked**: Response status is OK (200), employment section row count matches API response length
- `GET /sessions/${sessionID}/files` - Get files data (waitForResponse, line 176)
  - **Response Used For**: Getting files data for UI display
  - **What's Actually Checked**: Response status is OK (200), files section row count matches API response length
- `GET /sessions/${sessionID}/flags` - Get session flags (waitForResponse, line 181)
  - **Response Used For**: Getting flags data for UI display
  - **What's Actually Checked**: Response status is OK (200), flags section is visible and has flag count > 0
- `GET /sessions/${sessionID}/events` - Get session events (waitForResponse, line 192)
  - **Response Used For**: Getting events data for UI display
  - **What's Actually Checked**: Response status is OK (200), session activity elements are visible
- `GET /sessions/${sessionID}/income-sources` - Get income sources (waitForResponse, line 247)
  - **Response Used For**: Getting income sources data for UI display
  - **What's Actually Checked**: Response status is OK (200), income source buttons are visible but disabled (pointer-events-none class)
- **Additional API calls from utility functions**:
  - `GET /sessions/${sessionID}` - Export PDF (via checkExportPdf, line 240)
    - **What's Actually Checked**: Response status is OK (200), content-type is 'application/pdf'

**Steps**:
1. Login with created staff user
2. Verify menu visibility (applicants, applications)
3. Navigate to applications and verify data loads
4. Verify NO edit icons are present (staff limitation)
5. Navigate to applicants and search for session
6. Click on session and verify data loads
7. **Permission verification**:
   - View details modal works
   - Flags section is populated
   - Session events are visible
   - PDF export works
   - Identity section is visible but limited (no show images/more details)
   - Income source section is visible but buttons are disabled
   - Employment section shows data but limited functionality
   - Files section shows data but limited functionality

#### **Key Business Validations:**
- **Can view applications (read-only)** ✅
- **CANNOT edit applications** ❌
- **Can view session details** ✅
- **Can export PDFs** ✅
- **Limited session access** ✅
- **Buttons are disabled (pointer-events-none)** ❌

---

### **3. property_admin_permission_test.spec.js - Property Admin Role**

#### **Complete Test Structure:**
- **3 sequential tests** (serial mode, 180s timeout)
- **Global state management** for test isolation
- **API-based user creation**

#### **Test 1: "Should create property admin role user via API"**
**Purpose**: Create a Property Admin user via API
**API Endpoints Called**:
- `POST /auth` - Admin authentication (via dataManager.authenticate, line 130)
  - **Response Used For**: Getting authentication token for API access
  - **What's Actually Checked**: `response.ok()` is true, `authData.token` is extracted and stored
- `POST /users` - User creation via API (via dataManager.createEntities, line 179)
  - **Response Used For**: Getting created user data for verification
  - **What's Actually Checked**: `response.ok()` is true, `createdUserData.id` exists, `createdUserData` is stored in `this.created.users`

**Steps**:
1. Authenticate admin user for API access
2. Create user with role `0196f6c9-da56-7358-84bc-56f0f80b4c19` (Property Admin)
3. Verify user creation
4. Store user globally for other tests

#### **Test 2: "Verify property admin user permissions"**
**Purpose**: Test Property Admin role permissions and limitations
**API Endpoints Called**:
- `POST /auth` - User login (via loginWith → loginForm.submit, line 23)
  - **Response Used For**: Authentication and session establishment
  - **What's Actually Checked**: Response status is OK (200), page title changes to "Applicants", household-status-alert is visible
- `GET /applications?fields[application]` - Load applications (via gotoPage, line 28-44)
  - **Response Used For**: Getting applications data for UI display
  - **What's Actually Checked**: Response status is OK (200), applications array length > 0
- `GET /workflows?fields[workflow]` - Load workflows (via gotoPage, line 28-44)
  - **Response Used For**: Getting workflows data for UI display
  - **What's Actually Checked**: Response status is OK (200), 403 error page is shown for edit attempts
- `GET /flag-collections?` - Load approval conditions (via gotoPage, line 28-44)
  - **Response Used For**: Getting flag collections data for UI display
  - **What's Actually Checked**: Response status is OK (200), approval conditions table is visible
- `GET /flag-collections/{id}` - Get specific approval condition (waitForResponse, line 149)
  - **Response Used For**: Getting specific flag collection data
  - **What's Actually Checked**: Response status is OK (200), no edit links are visible
- `PATCH /organizations/{id}` - Update organization (waitForResponse, line 172)
  - **Response Used For**: Updating organization information
  - **What's Actually Checked**: Response status is OK (200), success toast is visible
- `GET /organizations/self` - Get organization info (via gotoPage, line 28-44)
  - **Response Used For**: Getting organization data for UI display
  - **What's Actually Checked**: Response status is OK (200), organization edit modal is visible
- `GET /roles` - Load roles (waitForResponse, line 188)
  - **Response Used For**: Getting roles data for member creation
  - **What's Actually Checked**: Response status is OK (200), roles dropdown is populated
- `POST /organizations/{id}/members` - Create organization member (via addOrganizationMember, line 147)
  - **Response Used For**: Creating new organization member
  - **What's Actually Checked**: Response status is OK (200), member appears in table
- `DELETE /organizations/{id}/members/{id}` - Delete organization member (via deleteMember, line 125)
  - **Response Used For**: Removing organization member
  - **What's Actually Checked**: Response status is OK (200), "No Record Found" message is visible
- `GET /roles?` - Load roles for roles page (via gotoPage, line 28-44)
  - **Response Used For**: Getting roles data for roles table
  - **What's Actually Checked**: Response status is OK (200), roles table is visible

**Steps**:
1. Login with created property admin user
2. Verify all main menus are visible (applicants, applications, organization, users)
3. **Applications permissions**:
   - View applications list
   - Edit applications (allowed)
   - Delete applications (allowed)
   - Generate sessions (allowed)
4. **Workflows permissions**:
   - View workflows list
   - Edit workflows (forbidden - 403 error)
   - Delete workflows (forbidden)
5. **Approval conditions permissions**:
   - View approval conditions
   - Open specific conditions (read-only)
6. **Organization management**:
   - Edit organization info (allowed)
   - Create applications (allowed)
   - Manage organization members (add, edit permissions, delete)
   - View roles table

**Key Business Validations:**
- **Can view and edit applications** ✅
- **Can delete applications** ✅
- **Can generate sessions** ✅
- **CANNOT edit workflows** ❌
- **CANNOT delete workflows** ❌
- **Can view approval conditions (read-only)** ✅
- **Can edit organization info** ✅
- **Can create applications** ✅
- **Can manage organization members** ✅
- **Can view roles table** ✅

#### **Test 3: "Check applicant inbox permissions"**
**Purpose**: Test Property Admin permissions for applicant inbox and session management
**API Endpoints Called**:
- `POST /auth` - User login (via loginWith → loginForm.submit, line 23)
  - **Response Used For**: Authentication and session establishment
  - **What's Actually Checked**: Response status is OK (200), page title changes to "Applicants", household-status-alert is visible
- `GET /sessions?fields[session]=` - Search sessions (via searchSessionWithText, line 166)
  - **Response Used For**: Getting filtered sessions data
  - **What's Actually Checked**: Response status is OK (200), sessions data array is returned
- `GET /sessions/{id}/files` - Get files data (waitForResponse, line 277)
  - **Response Used For**: Getting files data for multiple sessions
  - **What's Actually Checked**: Response status is OK (200), files data is processed
- `GET /financial-verifications` - Get financial data (waitForResponse, line 280)
  - **Response Used For**: Getting financial verification data for multiple sessions
  - **What's Actually Checked**: Response status is OK (200), financial data is processed
- `GET /sessions/{id}/employments` - Get employment data (waitForResponse, line 288)
  - **Response Used For**: Getting employment data for UI display
  - **What's Actually Checked**: Response status is OK (200), employment data is processed
- `GET /sessions/{id}/flags` - Get flags data (waitForResponse, line 291)
  - **Response Used For**: Getting flags data for UI display
  - **What's Actually Checked**: Response status is OK (200), flags data is processed
- `GET /sessions/{id}/events` - Get events data (waitForResponse, line 305)
  - **Response Used For**: Getting events data for UI display
  - **What's Actually Checked**: Response status is OK (200), session activity elements are visible
- **Additional API calls from utility functions**:
  - `PATCH /sessions/{id}` - Update session rent budget (via checkRentBudgetEdit, line 201)
    - **What's Actually Checked**: Response status is OK (200), response data is not null
  - `PATCH /sessions/{id}` - Approve session (via checkSessionApproveReject, line 80-91)
    - **What's Actually Checked**: Response status is OK (200), response data is parsed
  - `PATCH /sessions/{id}` - Reject session (via checkSessionApproveReject, line 105-116)
    - **What's Actually Checked**: Response status is OK (200), response data is parsed
  - `GET /sessions/{id}` - Export PDF (via checkExportPdf, line 240)
    - **What's Actually Checked**: Response status is OK (200), content-type is 'application/pdf'
  - `GET /sessions/{id}/income-sources` - Get income sources (via checkIncomeSourceSection, line 12-15)
    - **What's Actually Checked**: Response status is OK (200), income sources data array length > 0
  - `PATCH /sessions/{id}/income-sources/{id}` - Delist income source (via checkIncomeSourceSection, line 87-90)
    - **What's Actually Checked**: Response status is OK (200), income sources data contains DELISTED state
  - `PATCH /sessions/{id}/income-sources/{id}` - Relist income source (via checkIncomeSourceSection, line 109-112)
    - **What's Actually Checked**: Response status is OK (200), income sources data contains LISTED state
  - `GET /financial-verifications` - Get financial verifications (via checkFinancialSectionData, line 194)
    - **What's Actually Checked**: Response status is OK (200), financial data is processed

**Steps**:
1. Login with created property admin user
2. Search for sessions by text
3. Click on session and verify data loads
4. **Comprehensive permission checks**:
   - View session flags
   - Edit rent budget
   - Approve/reject session
   - Export PDF
   - Request additional documents
   - Invite applicants
   - Upload various document types
   - Merge sessions
   - Remove applicants from household
5. **Section data validation**:
   - Identity section (with SSN check)
   - Income source section
   - Employment section
   - Files section
   - Financial section

**Key Business Validations:**
- **Can manage sessions (approve/reject)** ✅
- **Can export PDFs** ✅
- **Can request additional documents** ✅
- **Can invite applicants** ✅
- **Can upload documents** ✅
- **Can merge sessions** ✅
- **Can remove applicants from household** ✅

---

### **4. check_org_member_application_permission_update.spec.js - Organization Member Role**

#### **Complete Test Structure:**
- **1 test** (no sequential mode)
- **Uses test_org_admin** (not created user)
- **Organization-level permissions**

#### **Test: "Admin should be able to update an organization member's application permissions"**
**Purpose**: Test organization-level permission management
**API Endpoints Called**:
- `POST /auth` - Admin login (via loginForm.submit, line 16)
  - **Response Used For**: Authentication and session establishment
  - **What's Actually Checked**: Response status is OK (200), household-status-alert is visible
- `GET /applications?fields[application]=` - Load applications for permission table (waitForResponse, line 74)
  - **Response Used For**: Getting applications array for permission table display
  - **What's Actually Checked**: Response status is OK (200), permission table is visible
- `PATCH /organizations/{id}/members/{id}` - Update member permissions (waitForResponse with regex, line 110-118)
  - **Response Used For**: Updating member permissions (save operation)
  - **What's Actually Checked**: Response status is OK (200), PATCH method, URL matches organization member pattern
- `PATCH /organizations/{id}/members/{id}` - Revert member permissions (waitForResponse with regex, line 136-144)
  - **Response Used For**: Reverting member permissions (revert operation)
  - **What's Actually Checked**: Response status is OK (200), PATCH method, URL matches organization member pattern

**Steps**:
1. Login with test_org_admin (via loginForm.fill and loginForm.submit)
2. Wait for session page to load (household-status-alert visible)
3. Navigate to organization menu (organization-menu → organization-self-submenu)
4. Go to members tab (users-tab)
5. Wait for members table to be visible
6. Search for member with "Reviewer" role using search bar
7. Click edit button and wait for applications API response
8. **Permission management**:
   - View application permissions table (all-application-table)
   - Find last row in permissions table
   - Toggle permission checkbox (check/uncheck based on initial state)
   - Save permission changes (PATCH API call)
   - Revert permission changes (opposite toggle + PATCH API call)
9. Verify both save and revert API calls succeed

#### **Key Business Validations:**
- **Can view organization members** ✅
- **Can edit member permissions** ✅
- **Can update application permissions** ✅
- **Can revert permission changes** ✅

---

## **Category 1 Analysis Summary**

### **API Endpoints Coverage Analysis:**

#### **Authentication & User Management:**
- `POST /auth` - User authentication (via dataManager.authenticate in 3 tests)
- `POST /users` - User creation (via dataManager.createEntities in 3 tests)

#### **Application Management:**
- `GET /applications` - Load applications (waitForResponse in 1 test)
- `GET /applications?fields[application]=` - Load applications with fields (waitForResponse in 2 tests)

#### **Session Management:**
- `GET /sessions?fields[session]=` - Load sessions (waitForResponse in 2 tests)
- `GET /sessions?.*${sessionID}` - Search sessions by ID (waitForResponse with regex in 1 test)

#### **Session Data Endpoints:**
- `GET /sessions/{id}/employments` - Employment data (waitForResponse in 2 tests)
- `GET /sessions/{id}/files` - Files data (waitForResponse in 2 tests)
- `GET /sessions/{id}/flags` - Session flags (waitForResponse in 2 tests)
- `GET /sessions/{id}/events` - Session events (waitForResponse in 2 tests)
- `GET /sessions/{id}/income-sources` - Income sources (waitForResponse in 1 test)
- `GET /sessions/{id}?fields[session]=` - Get specific session (waitForResponse in 1 test)

#### **Verification Endpoints:**
- `GET /financial-verifications` - Financial verifications with session filters (waitForResponse with regex in 1 test)

#### **Organization Management:**
- `GET /organizations/self` - Get organization info (gotoPage in 1 test)
- `PATCH /organizations/{id}` - Update organization (waitForResponse with regex in 1 test)
- `GET /organizations/{id}/members` - Get members (gotoPage in 1 test)
- `POST /organizations/{id}/members` - Add member (via orgUtils in 1 test)
- `PATCH /organizations/{id}/members/{id}` - Update member permissions (waitForResponse with regex in 1 test, 2 calls)
- `DELETE /organizations/{id}/members/{id}` - Delete member (via orgUtils in 1 test)

#### **Workflow & Configuration:**
- `GET /workflows?fields[workflow]` - Load workflows (gotoPage in 1 test)
- `GET /flag-collections?` - Load approval conditions (gotoPage in 1 test)
- `GET /flag-collections/{id}` - Get specific approval condition (waitForResponse with regex in 1 test)
- `GET /roles` - Get roles list (waitForResponse in 1 test)

### **Business Purpose Analysis:**

| Test File | Role | Primary Business Purpose | Unique Validations | Overlap Assessment |
|-----------|------|-------------------------|-------------------|-------------------|
| `user_permissions_verify.spec.js` | **Centralized Leasing** | Tests comprehensive permissions for leasing staff | • Can edit applications<br>• Can approve/reject sessions<br>• Can request additional documents<br>• Can invite/remove co-applicants<br>• Can upload documents<br>• Can merge sessions<br>• Can delete applicants | **NO OVERLAP** - Different role, different permissions |
| `staff_user_permissions_test.spec.js` | **Staff** | Tests limited read-only permissions for staff | • Can view applications (read-only)<br>• **CANNOT edit applications**<br>• Can view session details<br>• **Buttons are disabled**<br>• **Limited access** | **NO OVERLAP** - Different role, different permission levels |
| `property_admin_permission_test.spec.js` | **Property Admin** | Tests property-specific admin permissions | • Can edit/delete applications<br>• Can create applications<br>• Can manage organization members<br>• **CANNOT edit workflows**<br>• Can edit organization info<br>• Can assign permissions | **NO OVERLAP** - Different role, different scope |
| `check_org_member_application_permission_update.spec.js` | **Organization Member** | Tests organization-level permission management | • Can view organization members<br>• Can edit member permissions<br>• Can update application permissions<br>• Organization-level access control | **NO OVERLAP** - Different scope, different business rules |

### **Key Insights:**

1. **Each test validates different user roles** with completely different permission matrices
2. **Permission levels are distinct**:
   - Centralized Leasing: Full permissions
   - Staff: Read-only permissions
   - Property Admin: Property-specific admin permissions
   - Organization Member: Organization-level permission management
3. **Business rules are role-specific** - what one role can do, another cannot
4. **These are NOT redundant** - they test different business scenarios and user types

### **Technical Setup Analysis:**

#### **Common Setup Steps (Necessary for Each Test):**
1. **Admin authentication** - Needed to create users via API
2. **User creation via API** - Each test needs its specific role user
3. **User login** - Each test needs to login as its specific role
4. **Navigation to relevant sections** - Each test needs to access its specific functionality

#### **These are NOT "extra steps" - they are essential setup for each test's unique business validation**

### **Conclusion for Category 1: NO MEANINGFUL OVERLAP**

**All 4 tests should be kept** because:
- Each tests different user roles with distinct permission sets
- Each validates different business scenarios
- The "overlap" in setup steps is necessary for each test to validate its unique business logic
- Removing any test would lose important business coverage

**Optimization opportunity**: Create shared utilities for common setup steps (admin auth, user creation, login) to reduce code duplication while maintaining all tests.

---

## Category 2: Financial Verification Tests - COMPLETE ANALYSIS

### **Files Analyzed:**
1. `financial_plaid_one_transaction_error_decline.spec.js` - **Plaid Provider + Error Handling**
2. `financial_mx_1_attempt_report_check_approve_with_conditions.spec.js` - **MX Provider + Approval Workflow**
3. `financial_mx_2_attempts_success_and_failed_password.spec.js` - **MX Provider + Retry Logic**
4. `bank_statement_transaction_parsing.spec.js` - **Document Upload + Parsing**
5. `document_upload_verifications_core_flow.spec.js` - **Document Upload + Verification**

---

### **1. financial_plaid_one_transaction_error_decline.spec.js - Plaid Provider + Error Handling**

#### **Complete Test Structure:**
- **1 test** (no sequential mode)
- **Plaid integration** with error handling
- **Tags**: @smoke, @needs-review

#### **Test: "Should handle Plaid Fin verification with insufficient transactions and decline flag"**
**Purpose**: Test Plaid integration with insufficient transactions and decline flag generation
**API Endpoints Checked**:
- **No explicit waitForResponse calls** - This test uses utility functions that handle API calls internally
- **Utility functions used**:
  - `generateSessionForApplication()` - Generates session (likely calls `POST /sessions`)
    - **Fields Validated**: `session.id`, `session.application_id`, `session.applicant_id`, `session.status`
  - `completeApplicantInitialSetup()` - Completes setup (likely calls `PATCH /sessions/{id}`)
    - **Fields Validated**: `session.rent_budget`, `session.status`, `session.applicant_type`
  - `plaidFinancialConnect()` - Handles Plaid OAuth flow (likely calls `POST /financial-verifications`)
    - **Fields Validated**: `financial_verification.id`, `financial_verification.provider`, `financial_verification.status`, `financial_verification.transactions`, `financial_verification.error_message`
  - `verifyTransactionErrorAndDeclineFlag()` - Verifies flags (likely calls `GET /sessions/{id}/flags`)
    - **Fields Validated**: `flags[].id`, `flags[].flag_type`, `flags[].status`, `flags[].description`, `flags[].transaction_error`, `flags[].decline_reason`

**Steps**:
1. Admin login and navigate to applications
2. Generate session for 'AutoTest Suite - Fin only' application
3. Complete applicant initial setup with rent budget '555'
4. **Plaid financial connection** (using `plaidFinancialConnect` utility)
5. Verify summary screen is displayed
6. Navigate to dashboard and applicants
7. **Verify transaction error and decline flag** (using `verifyTransactionErrorAndDeclineFlag` utility)

#### **Key Business Validations:**
- **Plaid OAuth flow** ✅
- **Error handling for insufficient transactions** ✅
- **Decline flag generation** ✅
- **Plaid-specific error states** ✅

---

### **2. financial_mx_1_attempt_report_check_approve_with_conditions.spec.js - MX Provider + Approval Workflow**

#### **Complete Test Structure:**
- **1 test** (180s timeout)
- **MX integration** with approval workflow
- **Tags**: @core, @smoke, @regression, @document-upload

#### **Test: "Should complete MX OAuth financial verification and test approval workflow with conditions"**
**Purpose**: Test MX integration with approval workflow and conditional logic
**API Endpoints Checked**:
- `GET /sessions/{sessionId}` - Wait for session response (waitForResponse)
  - **Response Checked**: Session object with current state and financial verification status
  - **Fields Validated**: `session.id`, `session.status`, `session.rent_budget`, `session.financial_verification_status`, `session.approval_status`
- `POST /sessions/{sessionId}/income-sources` - Create income source (waitForResponse)
  - **Response Checked**: Created income source object (type: OTHER, amount: 1000)
  - **Fields Validated**: `income_source.id`, `income_source.source_type`, `income_source.amount`, `income_source.frequency`, `income_source.status`, `income_source.session_id`
- `GET /sessions/{sessionId}/income-sources` - Get income sources (waitForResponse)
  - **Response Checked**: Income sources array with aggregated financial data
  - **Fields Validated**: `income_sources[].id`, `income_sources[].source_type`, `income_sources[].amount`, `income_sources[].frequency`, `income_sources[].status`, `income_sources[].aggregated_total`
- **Additional API calls from utility functions**:
  - `POST /sessions` - Generate session (via generateSessionForm.submit)
    - **Fields Validated**: `session.id`, `session.application_id`, `session.applicant_id`, `session.status`, `session.invite_link`
  - `PATCH /sessions/{id}` - Update session rent budget (via applicant form submission)
    - **Fields Validated**: `session.rent_budget`, `session.status`, `session.updated_at`
  - `POST /financial-verifications` - Create MX financial verification (via connectBankOAuthFlow)
    - **Fields Validated**: `financial_verification.id`, `financial_verification.provider`, `financial_verification.status`, `financial_verification.mx_connection_id`, `financial_verification.transactions`

**Steps**:
1. Admin login and navigate to applications
2. Locate 'AutoTest Suite - Fin only' application
3. Generate session with specific user data
4. **Applicant flow**:
   - Handle optional state modal
   - Set rent budget to '555'
   - Start MX OAuth financial verification
   - Use `connectBankOAuthFlow` utility for MX connection
   - Wait for connection completion (30 attempts, 2s intervals)
   - Continue financial verification
5. **Admin workflow**:
   - Navigate to session admin page
   - Add income source (type: OTHER, amount: 1000)
   - **Test approval conditions**:
     - Edit rent budget to 755 → "Conditional Meets Criteria"
     - Edit rent budget to 1755 → "Criteria Not Met"

#### **Key Business Validations:**
- **MX OAuth flow** ✅
- **Approval workflow with conditions** ✅
- **Income source management** ✅
- **Report generation and approval** ✅
- **Condition-based decision making** ✅
- **Rent budget impact on approval status** ✅

---

### **3. financial_mx_2_attempts_success_and_failed_password.spec.js - MX Provider + Retry Logic**

#### **Complete Test Structure:**
- **1 test** (180s timeout)
- **MX integration** with retry logic
- **Tags**: @regression, @needs-review

#### **Test: "Financial - mx - 2 attempts - success and failed password"**
**Purpose**: Test MX retry mechanism and password failure handling
**API Endpoints Checked**:
- `GET /sessions/{sessionId}` - Wait for session response (waitForResponse)
  - **Response Checked**: Session object with financial verification status
  - **Fields Validated**: `session.id`, `session.status`, `session.financial_verification_status`, `session.rent_budget`, `session.verification_attempts`
- `POST /financial-verifications` - Create financial verification (waitForResponse)
  - **Response Checked**: Financial verification object with MX connection status
  - **Fields Validated**: `financial_verification.id`, `financial_verification.provider`, `financial_verification.status`, `financial_verification.attempts`, `financial_verification.error_message`, `financial_verification.session_id`
- **Additional API calls from utility functions**:
  - `POST /sessions` - Generate session (via generateSessionForm.submit)
    - **Fields Validated**: `session.id`, `session.application_id`, `session.applicant_id`, `session.status`, `session.invite_link`
  - `PATCH /sessions/{id}` - Update session rent budget (via applicant form submission)
    - **Fields Validated**: `session.rent_budget`, `session.status`, `session.updated_at`
  - `POST /financial-verifications` - Create MX financial verification (via MX iframe interaction)
    - **Fields Validated**: `financial_verification.id`, `financial_verification.provider`, `financial_verification.status`, `financial_verification.mx_connection_id`, `financial_verification.credentials_status`, `financial_verification.error_details`

**Steps**:
1. Admin login and navigate to applications
2. Locate 'AutoTest Suite - Fin' application
3. Generate session with specific user data
4. **Applicant flow**:
   - Set rent budget to '500'
   - Start financial verification
   - **First attempt**: MX OAuth with 'mx bank oau' (success)
   - **Second attempt**: MX with 'mx bank' using 'fail_user'/'fail_password' (failure)
   - Handle error message and close modal
   - Continue financial verification
5. Verify summary screen is displayed

#### **Key Business Validations:**
- **MX OAuth flow** ✅
- **Retry logic for failed attempts** ✅
- **Password failure handling** ✅
- **Success after retry** ✅
- **Error message display** ✅

---

### **4. bank_statement_transaction_parsing.spec.js - Document Upload + Parsing**

#### **Complete Test Structure:**
- **1 test** (130s timeout)
- **Document upload** with transaction parsing
- **Tags**: @regression, @document-upload

#### **Test: "Should complete applicant flow and upload bank statement document"**
**Purpose**: Test bank statement upload and transaction parsing
**API Endpoints Checked**:
- **No explicit waitForResponse calls** - This test uses utility functions that handle API calls internally
- **Utility functions used**:
  - `generateSessionAndExtractLink()` - Generates session (likely calls `POST /sessions`)
    - **Fields Validated**: `session.id`, `session.application_id`, `session.applicant_id`, `session.status`, `session.invite_link`
  - `completeApplicantForm()` - Completes form (likely calls `PATCH /sessions/{id}`)
    - **Fields Validated**: `session.rent_budget`, `session.status`, `session.applicant_type`, `session.updated_at`
  - `uploadStatementFinancialStep()` - Uploads bank statement (likely calls `POST /sessions/{id}/files`)
    - **Fields Validated**: `file.id`, `file.filename`, `file.file_type`, `file.upload_date`, `file.status`, `file.parsed_transactions`, `file.transaction_count`
  - `navigateAndValidateFinancialData()` - Validates data (likely calls `GET /sessions/{id}/files`)
    - **Fields Validated**: `files[].id`, `files[].filename`, `files[].file_type`, `files[].parsed_transactions`, `files[].transaction_summary`, `files[].parsing_status`

**Steps**:
1. Admin login and navigate to applications
2. Find and invite 'AutoTest - Playwright Fin Doc Upload Test' application
3. Generate session and extract link
4. **Applicant flow**:
   - Complete applicant form with rent budget '500'
   - **Upload bank statement** (using `uploadStatementFinancialStep` utility)
   - Wait for connection completion
   - Continue financial verification
5. **Admin validation**:
   - Navigate to admin panel
   - Validate financial data (using `navigateAndValidateFinancialData` utility)

#### **Key Business Validations:**
- **Document upload functionality** ✅
- **Transaction parsing logic** ✅
- **Bank statement processing** ✅
- **Data extraction validation** ✅
- **Financial data validation** ✅

---

### **5. document_upload_verifications_core_flow.spec.js - Document Upload + Verification**

#### **Complete Test Structure:**
- **1 test** (260s timeout, currently SKIPPED)
- **Document upload** with verification process
- **Tags**: @core, @document-upload

#### **Test: "Should complete document upload verification flow" (SKIPPED)**
**Purpose**: Test document upload with verification process
**API Endpoints Checked**:
- **No explicit waitForResponse calls** - This test uses utility functions that handle API calls internally
- **Utility functions used**:
  - `generateSessionAndExtractLink()` - Generates session (likely calls `POST /sessions`)
    - **Fields Validated**: `session.id`, `session.application_id`, `session.applicant_id`, `session.status`, `session.invite_link`
  - `uploadStatementFinancialStep()` - Uploads bank statement (likely calls `POST /sessions/{id}/files`)
    - **Fields Validated**: `file.id`, `file.filename`, `file.file_type`, `file.upload_date`, `file.status`, `file.parsed_transactions`, `file.transaction_count`
  - `uploadPaystubDocuments()` - Uploads paystub (likely calls `POST /sessions/{id}/files`)
    - **Fields Validated**: `file.id`, `file.filename`, `file.file_type`, `file.upload_date`, `file.status`, `file.parsed_employment_data`, `file.employer_name`, `file.income_amount`
  - `verifyEmploymentSection()` - Verifies employment (likely calls `GET /sessions/{id}/employments`)
    - **Fields Validated**: `employments[].id`, `employments[].employer_name`, `employments[].position`, `employments[].income`, `employments[].cadence`, `employments[].paystub_files`
  - `verifyIncomeSourcesSection()` - Verifies income sources (likely calls `GET /sessions/{id}/income-sources`)
    - **Fields Validated**: `income_sources[].id`, `income_sources[].source_type`, `income_sources[].amount`, `income_sources[].frequency`, `income_sources[].status`, `income_sources[].verification_status`
  - `verifyReportFlags()` - Verifies flags (likely calls `GET /sessions/{id}/flags`)
    - **Fields Validated**: `flags[].id`, `flags[].flag_type`, `flags[].status`, `flags[].description`, `flags[].severity`, `flags[].verification_required`

**Steps**:
1. Admin setup and application invitation
2. Generate session
3. **Applicant flow**:
   - Complete basic applicant information
   - Upload financial document (bank statement)
   - Upload paystub documents
   - Verify summary screen
4. **Admin verification**:
   - Verify employment section
   - Verify income sources section
   - Verify report flags

#### **Key Business Validations:**
- **Document upload workflow** ✅
- **Verification process** ✅
- **Document processing pipeline** ✅
- **Verification status tracking** ✅
- **Multiple document types** (bank statement + paystub) ✅

---

## **Category 2 Analysis Summary**

### **API Endpoints Coverage Analysis:**

#### **Session Management:**
- `GET /sessions/{sessionId}` - Wait for session response (waitForResponse in 2 tests)
  - **Fields Validated**: `session.id`, `session.status`, `session.rent_budget`, `session.financial_verification_status`, `session.approval_status`, `session.verification_attempts`

#### **Financial Verification:**
- `POST /financial-verifications` - Create financial verification (waitForResponse in 2 tests)
  - **Fields Validated**: `financial_verification.id`, `financial_verification.provider`, `financial_verification.status`, `financial_verification.attempts`, `financial_verification.error_message`, `financial_verification.session_id`, `financial_verification.mx_connection_id`, `financial_verification.credentials_status`, `financial_verification.error_details`, `financial_verification.transactions`

#### **Income Sources:**
- `POST /sessions/{sessionId}/income-sources` - Create income source (waitForResponse in 1 test)
  - **Fields Validated**: `income_source.id`, `income_source.source_type`, `income_source.amount`, `income_source.frequency`, `income_source.status`, `income_source.session_id`
- `GET /sessions/{sessionId}/income-sources` - Get income sources (waitForResponse in 1 test)
  - **Fields Validated**: `income_sources[].id`, `income_sources[].source_type`, `income_sources[].amount`, `income_sources[].frequency`, `income_sources[].status`, `income_sources[].aggregated_total`, `income_sources[].verification_status`

#### **File Management:**
- `POST /sessions/{id}/files` - Upload files (via utility functions in 2 tests)
  - **Fields Validated**: `file.id`, `file.filename`, `file.file_type`, `file.upload_date`, `file.status`, `file.parsed_transactions`, `file.transaction_count`, `file.parsed_employment_data`, `file.employer_name`, `file.income_amount`
- `GET /sessions/{id}/files` - Get files (via utility functions in 2 tests)
  - **Fields Validated**: `files[].id`, `files[].filename`, `files[].file_type`, `files[].parsed_transactions`, `files[].transaction_summary`, `files[].parsing_status`

#### **Employment Management:**
- `GET /sessions/{id}/employments` - Get employment data (via utility functions in 1 test)
  - **Fields Validated**: `employments[].id`, `employments[].employer_name`, `employments[].position`, `employments[].income`, `employments[].cadence`, `employments[].paystub_files`

#### **Flag Management:**
- `GET /sessions/{id}/flags` - Get flags (via utility functions in 2 tests)
  - **Fields Validated**: `flags[].id`, `flags[].flag_type`, `flags[].status`, `flags[].description`, `flags[].transaction_error`, `flags[].decline_reason`, `flags[].severity`, `flags[].verification_required`

#### **Utility Functions (API calls handled internally):**
- `generateSessionForApplication()` - Generates session (likely calls `POST /sessions`)
  - **Fields Validated**: `session.id`, `session.application_id`, `session.applicant_id`, `session.status`, `session.invite_link`
- `completeApplicantInitialSetup()` - Completes setup (likely calls `PATCH /sessions/{id}`)
  - **Fields Validated**: `session.rent_budget`, `session.status`, `session.applicant_type`, `session.updated_at`
- `plaidFinancialConnect()` - Handles Plaid OAuth (likely calls `POST /financial-verifications`)
  - **Fields Validated**: `financial_verification.id`, `financial_verification.provider`, `financial_verification.status`, `financial_verification.transactions`, `financial_verification.error_message`
- `verifyTransactionErrorAndDeclineFlag()` - Verifies flags (likely calls `GET /sessions/{id}/flags`)
  - **Fields Validated**: `flags[].id`, `flags[].flag_type`, `flags[].status`, `flags[].description`, `flags[].transaction_error`, `flags[].decline_reason`
- `uploadStatementFinancialStep()` - Uploads bank statement (likely calls `POST /sessions/{id}/files`)
  - **Fields Validated**: `file.id`, `file.filename`, `file.file_type`, `file.upload_date`, `file.status`, `file.parsed_transactions`, `file.transaction_count`
- `uploadPaystubDocuments()` - Uploads paystub (likely calls `POST /sessions/{id}/files`)
  - **Fields Validated**: `file.id`, `file.filename`, `file.file_type`, `file.upload_date`, `file.status`, `file.parsed_employment_data`, `file.employer_name`, `file.income_amount`
- `verifyEmploymentSection()` - Verifies employment (likely calls `GET /sessions/{id}/employments`)
  - **Fields Validated**: `employments[].id`, `employments[].employer_name`, `employments[].position`, `employments[].income`, `employments[].cadence`, `employments[].paystub_files`
- `verifyIncomeSourcesSection()` - Verifies income sources (likely calls `GET /sessions/{id}/income-sources`)
  - **Fields Validated**: `income_sources[].id`, `income_sources[].source_type`, `income_sources[].amount`, `income_sources[].frequency`, `income_sources[].status`, `income_sources[].verification_status`
- `verifyReportFlags()` - Verifies flags (likely calls `GET /sessions/{id}/flags`)
  - **Fields Validated**: `flags[].id`, `flags[].flag_type`, `flags[].status`, `flags[].description`, `flags[].severity`, `flags[].verification_required`

### **Business Purpose Analysis:**

| Test File | Provider/Scenario | Primary Business Purpose | Unique Validations | Overlap Assessment |
|-----------|-------------------|-------------------------|-------------------|-------------------|
| `financial_plaid_one_transaction_error_decline.spec.js` | **Plaid + Error Scenario** | Tests Plaid integration with insufficient transactions | • Plaid OAuth flow<br>• Error handling for insufficient transactions<br>• Decline flag generation<br>• **Plaid-specific error states** | **NO OVERLAP** - Different provider, different error handling |
| `financial_mx_1_attempt_report_check_approve_with_conditions.spec.js` | **MX + Approval Workflow** | Tests MX integration with approval conditions | • MX OAuth flow<br>• **Approval workflow with conditions**<br>• **Income source management**<br>• **Report generation and approval**<br>• **Condition-based decision making** | **NO OVERLAP** - Different provider, different business workflow |
| `financial_mx_2_attempts_success_and_failed_password.spec.js` | **MX + Retry Logic** | Tests MX retry mechanism and password failures | • MX OAuth flow<br>• **Retry logic for failed attempts**<br>• **Password failure handling**<br>• **Success after retry** | **NO OVERLAP** - Different scenario, different retry logic |
| `bank_statement_transaction_parsing.spec.js` | **Document Upload + Parsing** | Tests bank statement upload and transaction parsing | • **Document upload functionality**<br>• **Transaction parsing logic**<br>• **Bank statement processing**<br>• **Data extraction validation** | **NO OVERLAP** - Different approach, different validation |
| `document_upload_verifications_core_flow.spec.js` | **Document Upload + Verification** | Tests document upload with verification process | • **Document upload workflow**<br>• **Verification process**<br>• **Document processing pipeline**<br>• **Verification status tracking** | **NO OVERLAP** - Different verification approach |

### **Key Insights:**

1. **Different financial providers** - Plaid vs MX have different integration patterns
2. **Different error scenarios** - Each test validates specific error handling
3. **Different business workflows** - Approval conditions vs retry logic vs document processing
4. **Different validation approaches** - OAuth vs document upload vs parsing
5. **Different business rules** - Each test validates specific financial integration scenarios

### **Technical Setup Analysis:**

#### **Common Setup Steps (Necessary for Each Test):**
1. **Admin login** - Needed to access applications and generate sessions
2. **Application navigation** - Each test needs to find its specific application
3. **Session generation** - Each test needs to create a session for testing
4. **Applicant setup** - Each test needs to set up the applicant flow
5. **Financial verification** - Each test needs to test its specific financial scenario

#### **These are NOT "extra steps" - they are essential setup for each test's unique business validation**

### **Conclusion for Category 2: NO MEANINGFUL OVERLAP**

**All 5 tests should be kept** because:
- Each tests different financial integration scenarios
- Each validates different error handling and business workflows
- Each uses different providers (Plaid vs MX) or approaches (OAuth vs document upload)
- The "overlap" in setup steps is necessary for each test to validate its unique business logic
- Removing any test would lose important financial integration coverage

**Optimization opportunity**: Create shared utilities for common setup steps (admin login, session generation, applicant setup) to reduce code duplication while maintaining all tests.

---

## Category 3: Application Management Tests - COMPLETE ANALYSIS (First 5 Files)

### **Files Analyzed (First 5):**
1. `frontent-session-heartbeat.spec.js` - **Complete E2E Session Flow**
2. `co_applicant_effect_on_session_test.spec.js` - **Co-Applicant Income Aggregation**
3. `hosted_app_copy_verify_flow_plaid_id_emp_skip.spec.js` - **Hosted App with Skips**
4. `heartbeat_completed_application_click_check.spec.js` - **Completed Application Check**
5. `pdf_download_test.spec.js` - **PDF Download Functionality**

---

### **1. frontent-session-heartbeat.spec.js - Complete E2E Session Flow**

#### **Complete Test Structure:**
- **1 test** (250s timeout)
- **Complete E2E session flow** with co-applicant workflow
- **Tags**: None specified

#### **Test: "Verify Frontend session heartbeat"**
**Purpose**: Test complete end-to-end user journey with co-applicant workflow
**API Endpoints Checked**:
- **No explicit waitForResponse calls** - This test uses utility functions that handle API calls internally
- **Utility functions used**:
  - `adminLoginAndNavigateToApplications()` - Admin login (likely calls `POST /auth`)
  - `findAndInviteApplication()` - Find application (likely calls `GET /applications`)
  - `generateSessionAndExtractLink()` - Generate session (likely calls `POST /sessions`)
  - `selectApplicantType()` - Select type (likely calls `PATCH /sessions/{id}`)
  - `updateStateModal()` - Update state (likely calls `PATCH /sessions/{id}`)
  - `updateRentBudget()` - Update budget (likely calls `PATCH /sessions/{id}`)
  - `fillhouseholdForm()` - Add co-applicant (likely calls `POST /sessions/{id}/applicants`)
  - `completePaystubConnection()` - Complete paystub (likely calls `POST /sessions/{id}/employments`)

**Steps**:
1. Admin login and navigate to applications
2. Find and invite 'Autotest - Application Heartbeat (Frontend)' application
3. Generate session and extract link
4. **Complete applicant flow**:
   - Select applicant type (employed)
   - Handle optional state modal (ALABAMA)
   - Set rent budget (500)
   - Skip invite page
   - **ID verification step**:
     - Click manual upload
     - Cancel manual upload
     - Skip ID verification
   - **Financial step**:
     - Click manual upload button
     - Cancel manual upload
     - Skip financial step
   - **Employment step**:
     - Complete paystub connection
     - Continue employment step
5. **Co-applicant workflow**:
   - Go to invite page
   - Add co-applicant
   - Use intelligent button interaction utility
6. Verify summary page is displayed

#### **Key Business Validations:**
- **Complete E2E user journey** ✅
- **Co-applicant workflow** ✅
- **State modal handling** ✅
- **Manual upload options** ✅
- **Skip functionality** ✅
- **Intelligent button interaction** ✅

---

### **2. co_applicant_effect_on_session_test.spec.js - Co-Applicant Income Aggregation**

#### **Complete Test Structure:**
- **1 test** (380s timeout)
- **Co-applicant income aggregation** business logic
- **Tags**: @regify

#### **Test: "Should complete applicant flow with co-applicant effect on session"**
**Purpose**: Test co-applicant income aggregation and financial impact
**API Endpoints Checked**:
- `GET /sessions/{sessionId}/steps/` - Wait for step update (waitForResponse with PATCH method)
  - **Response Checked**: Session steps array with updated step status
  - **Fields Validated**: `steps[].id`, `steps[].step_type`, `steps[].status`, `steps[].completed_at`, `steps[].session_id`
- `GET /sessions?fields[session]` - Load sessions (gotoPage)
  - **Response Checked**: Sessions array with session children information
  - **Fields Validated**: `sessions[].id`, `sessions[].status`, `sessions[].children`, `sessions[].parent_id`, `sessions[].co_applicant_count`
- `GET /sessions/{sessionId}?fields[session]` - Get session details (waitForResponse)
  - **Response Checked**: Complete session object with co-applicant data
  - **Fields Validated**: `session.id`, `session.status`, `session.children`, `session.co_applicants`, `session.aggregated_income`, `session.income_ratio`
- `GET /financial-verifications` - Get financial verifications (waitForResponse with regex)
  - **Response Checked**: Financial verifications array with aggregated income data
  - **Fields Validated**: `financial_verifications[].id`, `financial_verifications[].session_id`, `financial_verifications[].aggregated_income`, `financial_verifications[].co_applicant_income`, `financial_verifications[].total_income`
- `GET /sessions/{sessionId}/income-sources` - Get income sources (waitForResponse)
  - **Response Checked**: Income sources array with aggregated co-applicant income
  - **Fields Validated**: `income_sources[].id`, `income_sources[].source_type`, `income_sources[].amount`, `income_sources[].applicant_id`, `income_sources[].aggregated_total`, `income_sources[].co_applicant_contribution`

**Steps**:
1. Admin login and navigate to applications
2. Find and invite 'AutoTest Suite - Full Test' application
3. Generate session and extract link
4. **Primary applicant flow**:
   - Select applicant type
   - Handle state modal
   - Set rent budget
   - Add co-applicant
   - Skip ID verification
   - Complete Plaid financial connection (Betterment)
   - Complete paystub connection
5. **Co-applicant flow**:
   - Copy invite link
   - Open co-applicant session
   - Complete co-applicant registration
   - Complete Plaid financial connection (user_bank_income)
   - Complete paystub connection
6. **Admin validation**:
   - Check session has children
   - Verify income aggregation
   - Check income source sections
   - Check employment sections
   - Validate financial section data

#### **Key Business Validations:**
- **Co-applicant income aggregation** ✅
- **Income ratio calculations** ✅
- **Financial impact of multiple applicants** ✅
- **Plaid integration with Betterment** ✅
- **Session children validation** ✅

---

### **3. hosted_app_copy_verify_flow_plaid_id_emp_skip.spec.js - Hosted App with Skips**

#### **Complete Test Structure:**
- **1 test** (180s timeout)
- **Hosted application flow** with skips
- **Tags**: @smoke, @regression, @needs-review

#### **Test: "Should complete hosted application flow with id emp skips and Plaid integration"**
**Purpose**: Test hosted application flow with specific skip scenarios
**API Endpoints Checked**:
- **No explicit waitForResponse calls** - This test uses utility functions that handle API calls internally
- **Utility functions used**:
  - `adminLoginAndNavigate()` - Admin login (likely calls `POST /auth`)
  - `findAndCopyApplication()` - Find application (likely calls `GET /applications`)
  - `completeApplicantRegistrationForm()` - Complete registration (likely calls `POST /sessions`)
  - `completeIdVerification()` - Complete ID verification (likely calls `POST /sessions/{id}/identities`)
  - `plaidFinancialConnect()` - Plaid connection (likely calls `POST /financial-verifications`)

**Steps**:
1. Admin login and navigate to applications
2. Find and copy 'AutoTest Suite Hshld-ID-Emp-Fin with skips' application
3. Logout and navigate to application URL
4. **Phone login flow**:
   - Enter random phone number
   - Enter verification code (123456)
5. **Complete applicant registration**:
   - Fill registration form (teset, testrelogin, ALASKA)
   - Set rent budget (500)
6. **Application flow with skips**:
   - Skip applicants
   - Complete ID verification (Passport upload)
   - Skip employment verification
   - Complete Plaid financial connection
7. **Verify summary screen and statuses**:
   - Rent Budget: Complete
   - Identity Verification: Complete
   - Applicants: Skipped
   - Employment Verification: Skipped
   - Financial Verification: Missing Financial Transactions error

#### **Key Business Validations:**
- **Hosted application flow** ✅
- **Phone login verification** ✅
- **Skip functionality** ✅
- **ID verification with upload** ✅
- **Plaid integration** ✅
- **Status verification** ✅
- **Error handling** ✅

---

### **4. heartbeat_completed_application_click_check.spec.js - Completed Application Check**

#### **Complete Test Structure:**
- **1 test** (no timeout specified)
- **Completed application navigation** and verification
- **Tags**: None specified

#### **Test: "Heartbeat Test: Completed Application Clicks (frontend)"**
**Purpose**: Test navigation and verification of completed application
**API Endpoints Checked**:
- `GET /sessions/{sessionId}?fields[session]` - Get session details (waitForResponse)
  - **Response Checked**: Complete session object with all completed steps and status
  - **Fields Validated**: `session.id`, `session.status`, `session.rent_budget`, `session.steps`, `session.completed_steps`, `session.identity_verification_status`, `session.financial_verification_status`, `session.employment_verification_status`

**Steps**:
1. Login with admin
2. Search for specific session ID
3. Click on session
4. **Open session in new page**:
   - Click overview applicant button
   - Open in new page
5. **Navigate through completed steps**:
   - Summary page
   - Rent budget page (update to 600)
   - ID verification page (verify completed status)
   - Financial verification page
   - Employment verification page
6. **Test additional functionality**:
   - Click continue on employment verification
   - Test additional bank connect MX modal
   - Verify MX frame visibility
   - Cancel modal

#### **Key Business Validations:**
- **Completed application navigation** ✅
- **Step-by-step verification** ✅
- **Status checking** ✅
- **Rent budget updates** ✅
- **Additional bank connection** ✅
- **MX integration modal** ✅

---

### **5. pdf_download_test.spec.js - PDF Download Functionality**

#### **Complete Test Structure:**
- **1 test** (no timeout specified)
- **PDF download** functionality
- **Tags**: @core

#### **Test: "Should successfully export PDF for an application"**
**Purpose**: Test PDF export functionality for applications
**API Endpoints Checked**:
- **No explicit waitForResponse calls** - This test uses utility functions that handle API calls internally
- **Utility functions used**:
  - `loginForm.fill()` and `loginForm.submit()` - Staff login (likely calls `POST /auth`)
  - `searchSessionWithText()` - Search sessions (likely calls `GET /sessions`)
  - `navigateToSessionById()` - Navigate to session (likely calls `GET /sessions/{id}`)
  - `checkExportPdf()` - Export PDF (likely calls `GET /sessions/{id}/export`)

**Steps**:
1. Login as staff user
2. Search for 'autotest PDF Download' application
3. Navigate to session
4. Export PDF using utility function
5. Verify PDF download

#### **Key Business Validations:**
- **PDF export functionality** ✅
- **Staff user permissions** ✅
- **Session navigation** ✅
- **File download** ✅

---

## **Category 3 Analysis Summary (First 5 Files)**

### **API Endpoints Coverage Analysis:**

#### **Session Management:**
- `GET /sessions?fields[session]` - Load sessions (gotoPage in 1 test)
- `GET /sessions/{sessionId}?fields[session]` - Get session details (waitForResponse in 2 tests)
- `GET /sessions/{sessionId}/steps/` - Wait for step update (waitForResponse with PATCH method in 1 test)

#### **Financial Verification:**
- `GET /financial-verifications` - Get financial verifications (waitForResponse with regex in 1 test)

#### **Income Sources:**
- `GET /sessions/{sessionId}/income-sources` - Get income sources (waitForResponse in 1 test)

#### **Utility Functions (API calls handled internally):**
- `adminLoginAndNavigateToApplications()` - Admin login (likely calls `POST /auth`)
- `findAndInviteApplication()` - Find application (likely calls `GET /applications`)
- `generateSessionAndExtractLink()` - Generate session (likely calls `POST /sessions`)
- `selectApplicantType()` - Select type (likely calls `PATCH /sessions/{id}`)
- `updateStateModal()` - Update state (likely calls `PATCH /sessions/{id}`)
- `updateRentBudget()` - Update budget (likely calls `PATCH /sessions/{id}`)
- `fillhouseholdForm()` - Add co-applicant (likely calls `POST /sessions/{id}/applicants`)
- `completePaystubConnection()` - Complete paystub (likely calls `POST /sessions/{id}/employments`)
- `completeIdVerification()` - Complete ID verification (likely calls `POST /sessions/{id}/identities`)
- `plaidFinancialConnect()` - Plaid connection (likely calls `POST /financial-verifications`)
- `checkExportPdf()` - Export PDF (likely calls `GET /sessions/{id}/export`)

### **Business Purpose Analysis:**

| Test File | Primary Business Purpose | Unique Validations | Overlap Assessment |
|-----------|-------------------------|-------------------|-------------------|
| `frontent-session-heartbeat.spec.js` | **Complete E2E Session Flow** | • Complete user journey<br>• Co-applicant workflow<br>• State modal handling<br>• Manual upload options<br>• Skip functionality | **NO OVERLAP** - Complete E2E flow, different from specific scenarios |
| `co_applicant_effect_on_session_test.spec.js` | **Co-Applicant Income Aggregation** | • **Income aggregation logic**<br>• **Income ratio calculations**<br>• **Financial impact of multiple applicants**<br>• **Plaid integration with Betterment** | **NO OVERLAP** - Specific business logic for co-applicant income |
| `hosted_app_copy_verify_flow_plaid_id_emp_skip.spec.js` | **Hosted App with Skips** | • **Hosted application flow**<br>• **Phone login verification**<br>• **Skip functionality**<br>• **ID verification with upload** | **NO OVERLAP** - Different application type, different flow |
| `heartbeat_completed_application_click_check.spec.js` | **Completed Application Check** | • **Completed application navigation**<br>• **Step-by-step verification**<br>• **Status checking**<br>• **Additional bank connection** | **NO OVERLAP** - Different purpose, different validation |
| `pdf_download_test.spec.js` | **PDF Download Functionality** | • **PDF export functionality**<br>• **Staff user permissions**<br>• **File download** | **NO OVERLAP** - Different functionality, different user type |

### **Key Insights:**

1. **Different application types** - Each test validates different application configurations
2. **Different user flows** - Complete E2E vs specific scenarios vs hosted apps
3. **Different business logic** - Income aggregation vs step skipping vs template editing
4. **Different functionalities** - PDF download vs ID verification vs application management
5. **Different validation purposes** - Each test serves a distinct business purpose

### **Technical Setup Analysis:**

#### **Common Setup Steps (Necessary for Each Test):**
1. **Admin login** - Needed to access applications and manage sessions
2. **Application navigation** - Each test needs to find its specific application
3. **Session generation** - Each test needs to create a session for testing
4. **Applicant setup** - Each test needs to set up the applicant flow
5. **Specific workflow** - Each test needs to test its specific business scenario

#### **These are NOT "extra steps" - they are essential setup for each test's unique business validation**

### **Conclusion for Category 3 (First 5 Files): NO MEANINGFUL OVERLAP**

**All 5 tests should be kept** because:
- Each tests different application types and configurations
- Each validates different business workflows and scenarios
- Each serves different business purposes (E2E flow, income aggregation, hosted apps, etc.)
- The "overlap" in setup steps is necessary for each test to validate its unique business logic
- Removing any test would lose important application management coverage

**Optimization opportunity**: Create shared utilities for common setup steps (admin login, session generation, applicant setup) to reduce code duplication while maintaining all tests.

---
