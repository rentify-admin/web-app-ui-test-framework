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

| API Endpoint | Category | Tests Using It | What's Actually Checked |
|--------------|----------|----------------|-------------------------|
| `POST /auth` | Authentication | 4 tests | Response status is OK (200), user authentication successful |
| `POST /users` | User Management | 3 tests | Response status is OK (200), user data is returned |
| `GET /applications` | Application Management | 1 test | Response status is OK (200), applications data is returned |
| `GET /applications?fields[application]=` | Application Management | 2 tests | Response status is OK (200), applications with fields data is returned |
| `GET /sessions?fields[session]=` | Session Management | 2 tests | Response status is OK (200), sessions data is returned |
| `GET /sessions?.*${sessionID}` | Session Management | 1 test | Response status is OK (200), session search by ID successful |
| `GET /sessions/{id}?fields[session]=` | Session Management | 1 test | Response status is OK (200), specific session data is returned |
| `GET /sessions/{id}/employments` | Session Data | 2 tests | Response status is OK (200), employment data is returned |
| `GET /sessions/{id}/files` | Session Data | 2 tests | Response status is OK (200), files data is returned |
| `GET /sessions/{id}/flags` | Session Data | 2 tests | Response status is OK (200), session flags data is returned |
| `GET /sessions/{id}/events` | Session Data | 2 tests | Response status is OK (200), session events data is returned |
| `GET /sessions/{id}/income-sources` | Session Data | 1 test | Response status is OK (200), income sources data is returned |
| `PATCH /sessions/{id}` | Session Actions | 6 tests | Response status is OK (200), PATCH method (rent budget, approve, reject) |
| `GET /sessions/{id}` | Session Actions | 2 tests | Response status is OK (200), PDF export successful |
| `PATCH /sessions/{id}/income-sources/{id}` | Session Actions | 4 tests | Response status is OK (200), PATCH method (delist, relist) |
| `GET /financial-verifications` | Verification | 2 tests | Response status is OK (200), financial verifications data is returned |
| `GET /organizations/self` | Organization Management | 1 test | Response status is OK (200), organization info is returned |
| `PATCH /organizations/{id}` | Organization Management | 1 test | Response status is OK (200), organization update successful |
| `GET /organizations/{id}/members` | Organization Management | 1 test | Response status is OK (200), members data is returned |
| `POST /organizations/{id}/members` | Organization Management | 1 test | Response status is OK (200), member added successfully |
| `PATCH /organizations/{id}/members/{id}` | Organization Management | 2 tests | Response status is OK (200), member permissions updated |
| `DELETE /organizations/{id}/members/{id}` | Organization Management | 1 test | Response status is OK (200), member deleted successfully |
| `GET /workflows?fields[workflow]` | Workflow & Configuration | 1 test | Response status is OK (200), workflows data is returned |
| `GET /flag-collections?` | Workflow & Configuration | 1 test | Response status is OK (200), approval conditions data is returned |
| `GET /flag-collections/{id}` | Workflow & Configuration | 1 test | Response status is OK (200), specific approval condition data is returned |
| `GET /roles` | Workflow & Configuration | 2 tests | Response status is OK (200), roles list data is returned |

### **Business Purpose Analysis:**

| Test File | Role | Primary Business Purpose | Unique Validations | Overlap Assessment |
|-----------|------|-------------------------|-------------------|-------------------|
| `user_permissions_verify` | **Centralized Leasing** | Tests comprehensive permissions for leasing staff | • Can edit applications<br>• Can approve/reject sessions<br>• Can request additional documents<br>• Can invite/remove co-applicants<br>• Can upload documents<br>• Can merge sessions<br>• Can delete applicants | **NO OVERLAP** - Different role, different permissions |
| `staff_user_permissions_test` | **Staff** | Tests limited read-only permissions for staff | • Can view applications (read-only)<br>• **CANNOT edit applications**<br>• Can view session details<br>• **Buttons are disabled**<br>• **Limited access** | **NO OVERLAP** - Different role, different permission levels |
| `property_admin_permission_test` | **Property Admin** | Tests property-specific admin permissions | • Can edit/delete applications<br>• Can create applications<br>• Can manage organization members<br>• **CANNOT edit workflows**<br>• Can edit organization info<br>• Can assign permissions | **NO OVERLAP** - Different role, different scope |
| `check_org_member_application_permission_update` | **Organization Member** | Tests organization-level permission management | • Can view organization members<br>• Can edit member permissions<br>• Can update application permissions<br>• Organization-level access control | **NO OVERLAP** - Different scope, different business rules |

### **Test Coverage Summary:**

#### **Total API Endpoints Tested: 25**
- **Authentication**: 2 endpoints
- **User Management**: 1 endpoint  
- **Application Management**: 2 endpoints
- **Session Management**: 3 endpoints
- **Session Data**: 5 endpoints
- **Session Actions**: 6 endpoints
- **Verification**: 1 endpoint
- **Organization Management**: 5 endpoints
- **Workflow & Configuration**: 4 endpoints

#### **Test Distribution:**
- **user_permissions_verify.spec.js**: 3 tests, 15 API endpoints
- **staff_user_permissions_test.spec.js**: 2 tests, 8 API endpoints
- **property_admin_permission_test.spec.js**: 3 tests, 20 API endpoints
- **check_org_member_application_permission_update.spec.js**: 1 test, 3 API endpoints

### **Key Insights:**

1. **Each test validates different user roles** with completely different permission matrices
2. **Permission levels are distinct**:
   - **Centralized Leasing**: Full permissions (edit, approve/reject, manage sessions)
   - **Staff**: Read-only permissions (view only, buttons disabled)
   - **Property Admin**: Property-specific admin permissions (can manage org, cannot edit workflows)
   - **Organization Member**: Organization-level permission management (member permissions only)
3. **API coverage is comprehensive** - covers all major application areas
4. **Business rules are role-specific** - what one role can do, another cannot
5. **These are NOT redundant** - they test different business scenarios and user types
6. **Utility functions provide extensive coverage** - many API calls are made through utility functions

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
**API Endpoints Called**:
- `POST /auth` - Admin login (via loginForm.submit, line 17)
  - **Response Used For**: Authentication and session establishment
  - **What's Actually Checked**: Response status is OK (200), applicants-menu is visible
- `GET /applications?` - Search applications (via searchApplication, line 79-85)
  - **Response Used For**: Getting applications data for search
  - **What's Actually Checked**: Response status is OK (200), applications array is returned
- `POST /sessions` - Create session (via generateSessionForm.submit, line 34-44)
  - **Response Used For**: Creating new session for applicant
  - **What's Actually Checked**: Response status is OK (200), session data is returned
- `PATCH /sessions/{id}` - Update session rent budget (via completeApplicantForm, line 26-33)
  - **Response Used For**: Updating session with rent budget
  - **What's Actually Checked**: Response status is OK (200), PATCH method
- `GET /sessions?fields[session]=` - Search sessions (via searchSessionWithText, line 1098)
  - **Response Used For**: Finding session by applicant name
  - **What's Actually Checked**: Response status is OK (200), sessions data array is returned
- **Additional API calls from utility functions**:
  - `POST /sessions` - Create session (via generateSessionForm.submit, line 34-44)
    - **What's Actually Checked**: Response status is OK (200), session data is returned
  - `PATCH /sessions/{id}` - Update session rent budget (via completeApplicantForm, line 26-33)
    - **What's Actually Checked**: Response status is OK (200), PATCH method
  - `GET /sessions?fields[session]=` - Search sessions (via searchSessionWithText, line 1098)
    - **What's Actually Checked**: Response status is OK (200), sessions data array is returned

**Steps**:
1. **Login as admin** (via loginForm.fill and loginForm.submit)
2. **Navigate to Applications** (applications-menu → applications-submenu)
3. **Generate session for application** (via generateSessionForApplication utility)
   - Search for 'AutoTest Suite - Fin only' application
   - Click invite button
   - Fill session form with user data
   - Submit form and get session link
4. **Complete applicant initial setup** (via completeApplicantInitialSetup utility)
   - Navigate to session link
   - Handle state modal if present
   - Fill rent budget '555' and submit
5. **Complete Plaid financial connection** (via plaidFinancialConnect utility)
   - Click "Alternate Connect Bank" button
   - Handle Plaid iframe OAuth flow
   - Use test credentials (custom_onetxn/test)
   - Wait for connection completion
6. **Verify Summary screen** (UI validation - h3 with "Summary" text)
7. **Navigate to Dashboard and Applicant Inbox** (via navigateToDashboard and navigateToApplicants utilities)
8. **Verify transaction error and decline flag** (using verifyTransactionErrorAndDeclineFlag utility)
   - Search for session by applicant name
   - Click on session
   - Verify "User Error" link exists
   - Check "1 account | 1 transaction" in modal
   - Verify "Gross Income Ratio Exceeded" flag

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
**API Endpoints Called**:
- `POST /auth` - Admin login (via loginForm.submit, line 32)
  - **Response Used For**: Authentication and session establishment
  - **What's Actually Checked**: Response status is OK (200), page title contains "Applicants"
- `GET /applications?` - Search applications (via searchApplication, line 38)
  - **Response Used For**: Getting applications data for search
  - **What's Actually Checked**: Response status is OK (200), applications array is returned
- `POST /sessions` - Create session (via generateSessionForm.submit, line 51)
  - **Response Used For**: Creating new session for applicant
  - **What's Actually Checked**: Response status is OK (200), session data is returned
- `PATCH /sessions/{id}` - Update session rent budget (waitForResponse, line 80)
  - **Response Used For**: Updating session with rent budget
  - **What's Actually Checked**: Response status is OK (200), PATCH method
- `POST /sessions/{sessionId}/income-sources` - Create income source (waitForResponse, line 161-166)
  - **Response Used For**: Creating new income source
  - **What's Actually Checked**: Response status is OK (200), income source data is returned
- `GET /sessions/{sessionId}/income-sources` - Get income sources (waitForResponse, line 171-175)
  - **Response Used For**: Getting income sources for verification
  - **What's Actually Checked**: Response status is OK (200), income sources data is returned
- `PATCH /sessions/{id}` - Update rent budget (waitForResponse, line 198)
  - **Response Used For**: Updating rent budget for conditional approval
  - **What's Actually Checked**: Response status is OK (200), PATCH method
- `PATCH /sessions/{id}` - Update rent budget (waitForResponse, line 209)
  - **Response Used For**: Updating rent budget for decline scenario
  - **What's Actually Checked**: Response status is OK (200), PATCH method

**Steps**:
1. **Admin login and navigate to applications** (via loginForm.fill and loginForm.submit)
2. **Locate 'AutoTest Suite - Fin only' application** (via searchApplication utility)
3. **Generate session with specific user data** (via generateSessionForm utility)
   - Fill form with user data (alexander, sample, ignacio.martinez+playwright@verifast.com)
   - Submit form and get session link
4. **Applicant flow** (in new browser context):
   - Navigate to session link
   - Handle optional state modal
   - Set rent budget to '555' and submit
   - Start MX OAuth financial verification
   - Use `connectBankOAuthFlow` utility for MX connection
   - Wait for connection completion (30 attempts, 2s intervals)
   - Continue financial verification
5. **Admin workflow**:
   - Navigate to session admin page
   - Add income source (type: OTHER, amount: 1000)
   - Wait for income source sync
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
**API Endpoints Called**:
- `POST /auth` - Admin login (via loginForm.submit, line 34)
  - **Response Used For**: Authentication and session establishment
  - **What's Actually Checked**: Response status is OK (200), page title contains "Applicants"
- `GET /applications?` - Search applications (via searchApplication, line 40)
  - **Response Used For**: Getting applications data for search
  - **What's Actually Checked**: Response status is OK (200), applications array is returned
- `POST /sessions` - Create session (via generateSessionForm.submit, line 49)
  - **Response Used For**: Creating new session for applicant
  - **What's Actually Checked**: Response status is OK (200), session data is returned
- `PATCH /sessions/{id}` - Update session rent budget (waitForResponse, line 68)
  - **Response Used For**: Updating session with rent budget
  - **What's Actually Checked**: Response status is OK (200), PATCH method
- `POST /financial-verifications` - Create financial verification (waitForResponse, line 72-77)
  - **Response Used For**: Creating financial verification for MX connection
  - **What's Actually Checked**: Response status is OK (200), financial verification data is returned

**Steps**:
1. **Admin login and navigate to applications** (via loginForm.fill and loginForm.submit)
2. **Locate 'AutoTest Suite - Fin' application** (via searchApplication utility)
3. **Generate session with specific user data** (via generateSessionForm utility)
   - Fill form with user data (FinMX, Test, finmx_test@verifast.com)
   - Submit form and get session link
4. **Applicant flow** (in new browser context):
   - Navigate to session link
   - Set rent budget to '500' and submit
   - Start financial verification
   - **First attempt**: MX OAuth with 'mx bank oau' (success)
     - Search for 'mx bank oau' in MX iframe
     - Click OAuth option and authorize
     - Wait for completion and click done
   - **Second attempt**: MX with 'mx bank' using 'fail_user'/'fail_password' (failure)
     - Search for 'mx bank' in MX iframe
     - Enter invalid credentials (fail_user/fail_password)
     - Handle error message and close modal
   - Continue financial verification
5. **Verify summary screen is displayed** (h3 with "Summary" text)

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
**API Endpoints Called**:
- `POST /auth` - Admin login (via loginForm.adminLoginAndNavigate, line 31)
  - **Response Used For**: Authentication and session establishment
  - **What's Actually Checked**: Response status is OK (200), admin login successful
- `GET /applications?` - Search applications (via findAndInviteApplication, line 37)
  - **Response Used For**: Getting applications data for search
  - **What's Actually Checked**: Response status is OK (200), applications array is returned
- `POST /sessions` - Create session (via generateSessionForm.generateSessionAndExtractLink, line 40)
  - **Response Used For**: Creating new session for applicant
  - **What's Actually Checked**: Response status is OK (200), session data is returned
- `PATCH /sessions/{id}` - Update session rent budget (via completeApplicantForm, line 48)
  - **Response Used For**: Updating session with rent budget
  - **What's Actually Checked**: Response status is OK (200), PATCH method
- `POST /financial-verifications` - Create financial verification (via uploadStatementFinancialStep, line 294-304)
  - **Response Used For**: Creating financial verification for document upload
  - **What's Actually Checked**: Response status is OK (200), financial verification data is returned
- `GET /financial-verifications` - Get financial verifications (via uploadStatementFinancialStep, line 305-314)
  - **Response Used For**: Getting financial verifications for validation
  - **What's Actually Checked**: Response status is OK (200), financial verifications array is returned
- `GET /sessions?fields[session]=` - Search sessions (via navigateAndValidateFinancialData, line 980)
  - **Response Used For**: Finding session by ID for validation
  - **What's Actually Checked**: Response status is OK (200), sessions data array is returned
- **Additional API calls from utility functions**:
  - `POST /sessions` - Create session (via generateSessionForm.generateSessionAndExtractLink, line 40)
    - **What's Actually Checked**: Response status is OK (200), session data is returned
  - `PATCH /sessions/{id}` - Update session rent budget (via completeApplicantForm, line 48)
    - **What's Actually Checked**: Response status is OK (200), PATCH method
  - `POST /financial-verifications` - Create financial verification (via uploadStatementFinancialStep, line 294-304)
    - **What's Actually Checked**: Response status is OK (200), financial verification data is returned
  - `GET /financial-verifications` - Get financial verifications (via uploadStatementFinancialStep, line 305-314)
    - **What's Actually Checked**: Response status is OK (200), financial verifications array is returned
  - `GET /sessions?fields[session]=` - Search sessions (via navigateAndValidateFinancialData, line 980)
    - **What's Actually Checked**: Response status is OK (200), sessions data array is returned

**Steps**:
1. **Admin login and navigate to applications** (via loginForm.adminLoginAndNavigate)
2. **Find and invite 'AutoTest - Playwright Fin Doc Upload Test' application** (via findAndInviteApplication utility)
3. **Generate session and extract link** (via generateSessionForm.generateSessionAndExtractLink utility)
   - Fill form with user data (Korey, Lockett, playwright+korey@verifications.com)
   - Submit form and get session link
4. **Applicant flow** (in new browser context):
   - Navigate to session link
   - Complete applicant form with rent budget '500'
   - **Upload bank statement** (using `uploadStatementFinancialStep` utility)
     - Click upload statement button
     - Upload test_bank_statement.pdf file
     - Submit manual upload
     - Wait for financial verification creation
   - Wait for connection completion
   - Continue financial verification
5. **Admin validation** (via navigateAndValidateFinancialData utility):
   - Navigate to admin panel
   - Search for session by ID
   - Validate financial data and transaction parsing

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
**API Endpoints Called**:
- `POST /auth` - Admin login (via loginForm.adminLoginAndNavigate, line 102)
  - **Response Used For**: Authentication and session establishment
  - **What's Actually Checked**: Response status is OK (200), admin login successful
- `GET /applications?` - Search applications (via findAndInviteApplication, line 103)
  - **Response Used For**: Getting applications data for search
  - **What's Actually Checked**: Response status is OK (200), applications array is returned
- `POST /sessions` - Create session (via generateSessionForm.generateSessionAndExtractLink, line 106)
  - **Response Used For**: Creating new session for applicant
  - **What's Actually Checked**: Response status is OK (200), session data is returned
- `PATCH /sessions/{id}` - Update session rent budget (via completeBasicApplicantInfo, line 53-54)
  - **Response Used For**: Updating session with rent budget
  - **What's Actually Checked**: Response status is OK (200), PATCH method
- `POST /financial-verifications` - Create financial verification (via uploadStatementFinancialStep, line 117)
  - **Response Used For**: Creating financial verification for document upload
  - **What's Actually Checked**: Response status is OK (200), financial verification data is returned
- `GET /financial-verifications` - Get financial verifications (via uploadStatementFinancialStep, line 117)
  - **Response Used For**: Getting financial verifications for validation
  - **What's Actually Checked**: Response status is OK (200), financial verifications array is returned
- `POST /employment-verifications` - Create employment verification (via uploadPaystubDocuments, line 42-47)
  - **Response Used For**: Creating employment verification for paystub upload
  - **What's Actually Checked**: Response status is OK (200), employment verification data is returned
- `GET /sessions?fields[session]=` - Search sessions (via verifyAdminResults, line 74)
  - **Response Used For**: Finding session by ID for validation
  - **What's Actually Checked**: Response status is OK (200), sessions data array is returned
- **Additional API calls from utility functions**:
  - `POST /sessions` - Create session (via generateSessionForm.generateSessionAndExtractLink, line 106)
    - **What's Actually Checked**: Response status is OK (200), session data is returned
  - `PATCH /sessions/{id}` - Update session rent budget (via completeBasicApplicantInfo, line 53-54)
    - **What's Actually Checked**: Response status is OK (200), PATCH method
  - `POST /financial-verifications` - Create financial verification (via uploadStatementFinancialStep, line 117)
    - **What's Actually Checked**: Response status is OK (200), financial verification data is returned
  - `GET /financial-verifications` - Get financial verifications (via uploadStatementFinancialStep, line 117)
    - **What's Actually Checked**: Response status is OK (200), financial verifications array is returned
  - `POST /employment-verifications` - Create employment verification (via uploadPaystubDocuments, line 42-47)
    - **What's Actually Checked**: Response status is OK (200), employment verification data is returned
  - `GET /sessions?fields[session]=` - Search sessions (via verifyAdminResults, line 74)
    - **What's Actually Checked**: Response status is OK (200), sessions data array is returned

**Steps**:
1. **Admin setup and application invitation** (via loginForm.adminLoginAndNavigate and findAndInviteApplication)
2. **Generate session** (via generateSessionForm.generateSessionAndExtractLink utility)
   - Fill form with user data (Document, Upload, playwright+document-upload@verifications.com)
   - Submit form and get session link
3. **Applicant flow** (in new browser context):
   - Navigate to session link
   - Complete basic applicant information (via completeBasicApplicantInfo function)
     - Select employment status
     - Handle optional state modal
     - Enter rent budget '500'
     - Skip co-applicants and identity verification
   - Upload financial document (bank statement) via uploadStatementFinancialStep utility
   - Upload paystub documents via uploadPaystubDocuments utility
     - Upload paystub_recent.png file
     - Select Bi-Weekly cadence
     - Submit upload and wait for employment verification
   - Verify summary screen via verifySummaryScreen utility
4. **Admin verification** (via verifyAdminResults function):
   - Navigate to applicants menu
   - Search for session by ID
   - Verify employment section (cadence, employer, count)
   - Verify income sources section
   - Verify report flags (EMPLOYEE_NAME_MISMATCH_CRITICAL, GROSS_INCOME_RATIO_EXCEEDED, etc.)

#### **Key Business Validations:**
- **Document upload workflow** ✅
- **Verification process** ✅
- **Document processing pipeline** ✅
- **Verification status tracking** ✅
- **Multiple document types** (bank statement + paystub) ✅

---

## **Category 2 Analysis Summary**

### **API Endpoints Coverage Analysis:**

| API Endpoint | Category | Tests Using It | What's Actually Checked |
|--------------|----------|----------------|-------------------------|
| `POST /auth` | Authentication | All 5 tests | Response status is OK (200), admin login successful |
| `GET /applications?` | Application Management | All 5 tests | Response status is OK (200), applications array is returned |
| `POST /sessions` | Session Management | All 5 tests | Response status is OK (200), session data is returned |
| `PATCH /sessions/{id}` | Session Management | All 5 tests | Response status is OK (200), PATCH method |
| `GET /sessions?fields[session]=` | Session Management | 4 tests | Response status is OK (200), sessions data array is returned |
| `POST /financial-verifications` | Financial Verification | 4 tests | Response status is OK (200), financial verification data is returned |
| `GET /financial-verifications` | Financial Verification | 4 tests | Response status is OK (200), financial verifications array is returned |
| `POST /sessions/{sessionId}/income-sources` | Income Sources | 1 test | Response status is OK (200), income source data is returned |
| `GET /sessions/{sessionId}/income-sources` | Income Sources | 1 test | Response status is OK (200), income sources data is returned |
| `POST /employment-verifications` | Employment Verification | 1 test | Response status is OK (200), employment verification data is returned |

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
1. **Admin login** (`POST /auth`) - Needed to access applications and generate sessions
2. **Application navigation** (`GET /applications?`) - Each test needs to find its specific application
3. **Session generation** (`POST /sessions`) - Each test needs to create a session for testing
4. **Applicant setup** (`PATCH /sessions/{id}`) - Each test needs to set up the applicant flow
5. **Financial verification** - Each test needs to test its specific financial scenario

#### **These are NOT "extra steps" - they are essential setup for each test's unique business validation**

### **Conclusion for Category 2: NO MEANINGFUL OVERLAP**

**All 5 tests should be kept** because:
- Each tests different financial integration scenarios
- Each validates different error handling and business workflows
- Each uses different providers (Plaid vs MX) or approaches (OAuth vs document upload)
- The "overlap" in setup steps is necessary for each test to validate its unique business logic

---

## **Category 3: Application Management Tests**

### **Files to Analyze (7 total):**
1. `frontent-session-heartbeat.spec.js` - **Complete E2E Session Flow**
2. `co_applicant_effect_on_session_test.spec.js` - **Co-Applicant Income Aggregation**
3. `hosted_app_copy_verify_flow_plaid_id_emp_skip.spec.js` - **Hosted App with Skips**
4. `heartbeat_completed_application_click_check.spec.js` - **Completed Application Check**
5. `pdf_download_test.spec.js` - **PDF Download Functionality**
6. `application_create_delete_test.spec.js` - **Application CRUD Operations**
7. `application_edit_id_template_settings.spec.js` - **Application Template Settings**

---

## **Category 3: Detailed Test Analysis**

### **1. frontent-session-heartbeat.spec.js - Complete E2E Session Flow**

#### **Complete Test Structure:**
- **1 test** (250s timeout)
- **Complete E2E session flow** with co-applicant workflow
- **Tags**: None specified

#### **Test: "Verify Frontend session heartbeat"**
**Purpose**: Test complete end-to-end user journey with co-applicant workflow, state modal handling, manual upload options, and skip functionality
**API Endpoints Called**:
- `POST /auth` - Admin login (via adminLoginAndNavigateToApplications, line 31)
  - **Response Used For**: Authentication and session establishment
  - **What's Actually Checked**: Response status is OK (200), page title changes to "Applicants", household-status-alert is visible
- `GET /applications?` - Search applications (via findAndInviteApplication, line 35)
  - **Response Used For**: Getting applications data for search
  - **What's Actually Checked**: Response status is OK (200), applications array is returned
- `POST /sessions` - Create session (via generateSessionForm.generateSessionAndExtractLink, line 39)
  - **Response Used For**: Creating new session for applicant
  - **What's Actually Checked**: Response status is OK (200), session data is returned with sessionId and sessionUrl
- `PATCH /sessions/{id}` - Update session applicant type (via selectApplicantType, line 52)
  - **Response Used For**: Updating session with selected applicant type (employed)
  - **What's Actually Checked**: Response status is OK (200), PATCH method successful
- `PATCH /sessions/{id}` - Update session rent budget (via updateRentBudget, line 75)
  - **Response Used For**: Updating session with rent budget amount
  - **What's Actually Checked**: Response status is OK (200), PATCH method successful
- `POST /applicants` - Create co-applicant (via fillhouseholdForm, line 97)
  - **Response Used For**: Creating co-applicant record
  - **What's Actually Checked**: Response status is OK (200), applicant data is returned
- **UI Interactions Only**:
  - State modal handling (via updateStateModal, line 68) - No API call, UI state management only
  - Employment verification iframe (via completePaystubConnection, line 139) - No API call, iframe interactions with Atomic Transact

**Steps**:
1. **Admin login and navigate to applications** (via adminLoginAndNavigateToApplications utility)
2. **Find and invite 'Autotest - Application Heartbeat (Frontend)' application** (via findAndInviteApplication utility)
3. **Generate session and extract link** (via generateSessionForm.generateSessionAndExtractLink utility)
4. **Admin logout and applicant login** (UI interactions only)
5. **Complete applicant flow**:
   - Select applicant type (employed) via selectApplicantType utility
   - Handle optional state modal (ALABAMA) via updateStateModal utility
   - Set rent budget (500) via updateRentBudget utility
   - Skip invite page (UI interaction)
   - **ID verification step**:
     - Click manual upload button
     - Cancel manual upload
     - Skip ID verification
   - **Financial step**:
     - Click manual upload button
     - Cancel manual upload
     - Skip financial step
   - **Employment step**:
     - Complete paystub connection via completePaystubConnection utility
     - Use intelligent button interaction utility for employment step
6. **Co-applicant workflow**:
   - Navigate to invite page
   - Add co-applicant via fillhouseholdForm utility
   - Use intelligent button interaction utility for co-applicant invite
7. **Verify summary page is displayed** (UI validation)

#### **Key Business Validations:**
- **Complete E2E user journey** ✅
- **Co-applicant workflow** ✅
- **State modal handling** ✅
- **Manual upload options** ✅
- **Skip functionality** ✅
- **Intelligent button interaction** ✅
- **Employment verification via iframe** ✅

---

### **2. co_applicant_effect_on_session_test.spec.js - Co-Applicant Income Aggregation**

#### **Complete Test Structure:**
- **1 test** (380s timeout)
- **Co-applicant income aggregation** business logic
- **Tags**: @regify

#### **Test: "Should complete applicant flow with co-applicant effect on session"**
**Purpose**: Test co-applicant income aggregation and financial impact on session data
**API Endpoints Called**:
- `POST /auth` - Admin login (via loginForm.adminLoginAndNavigate, line 49)
  - **Response Used For**: Authentication and session establishment
  - **What's Actually Checked**: Response status is OK (200), admin login successful
- `GET /applications?` - Search applications (via findAndInviteApplication, line 53)
  - **Response Used For**: Getting applications data for search
  - **What's Actually Checked**: Response status is OK (200), applications array is returned
- `POST /sessions` - Create session (via generateSessionForm.generateSessionAndExtractLink, line 57)
  - **Response Used For**: Creating new session for applicant
  - **What's Actually Checked**: Response status is OK (200), session data is returned with sessionId and sessionUrl
- `PATCH /sessions/{id}` - Update session applicant type (via selectApplicantType, line 70)
  - **Response Used For**: Updating session with selected applicant type
  - **What's Actually Checked**: Response status is OK (200), PATCH method successful
- `PATCH /sessions/{id}` - Update session rent budget (via updateRentBudget, line 77)
  - **Response Used For**: Updating session with rent budget amount
  - **What's Actually Checked**: Response status is OK (200), PATCH method successful
- `POST /applicants` - Create co-applicant (via fillhouseholdForm, line 84)
  - **Response Used For**: Creating co-applicant record
  - **What's Actually Checked**: Response status is OK (200), applicant data is returned
- `PATCH /sessions/{id}/steps/` - Update session steps (via waitForResponse, line 105-108)
  - **Response Used For**: Updating session step completion status
  - **What's Actually Checked**: Response status is OK (200), PATCH method successful
- `GET /sessions?fields[session]` - Load sessions (via gotoPage, line 115-120)
  - **Response Used For**: Getting sessions with children information
  - **What's Actually Checked**: Response status is OK (200), sessions array is returned
- `GET /sessions/{id}?fields[session]` - Get session details (via waitForResponse, line 131-138)
  - **Response Used For**: Getting complete session object with co-applicant data
  - **What's Actually Checked**: Response status is OK (200), session data with children array is returned
- `GET /sessions/{id}?fields[session]` - Get updated session (via waitForResponse, line 259-275)
  - **Response Used For**: Getting session data after co-applicant completion
  - **What's Actually Checked**: Response status is OK (200), updated session data is returned
- `GET /financial-verifications` - Get financial verifications (via waitForResponse, line 276-293)
  - **Response Used For**: Getting financial verifications for all sessions
  - **What's Actually Checked**: Response status is OK (200), financial verifications array is returned
- `GET /sessions/{id}/income-sources` - Get income sources (via waitForResponse, line 321-331)
  - **Response Used For**: Getting income sources for all sessions
  - **What's Actually Checked**: Response status is OK (200), income sources array is returned

**Steps**:
1. **Admin login and navigate to applications** (via loginForm.adminLoginAndNavigate utility)
2. **Find and invite 'AutoTest Suite - Full Test' application** (via findAndInviteApplication utility)
3. **Generate session and extract link** (via generateSessionForm.generateSessionAndExtractLink utility)
4. **Primary applicant flow** (in new browser context):
   - Select applicant type via selectApplicantType utility
   - Handle optional state modal via handleOptionalStateModal utility
   - Set rent budget via updateRentBudget utility
   - Add co-applicant via fillhouseholdForm utility
   - Skip ID verification (UI interaction)
   - Complete Plaid financial connection via completePlaidFinancialStepBetterment utility
   - Complete paystub connection via completePaystubConnection utility
   - Update session steps via waitForResponse
5. **Co-applicant flow** (in new browser context):
   - Copy invite link from admin panel
   - Open co-applicant session
   - Complete co-applicant registration (same steps as primary)
   - Complete Plaid financial connection with different parameters
   - Complete paystub connection
   - Update co-applicant session steps
6. **Admin validation**:
   - Navigate to sessions page via gotoPage utility
   - Search for session by ID via searchSessionWithText utility
   - Get session details and verify children array
   - Verify income aggregation and ratio calculations
   - Check income source sections for all applicants
   - Check employment sections for all applicants
   - Validate financial section data via checkFinancialSectionData utility

#### **Key Business Validations:**
- **Co-applicant income aggregation** ✅
- **Income ratio calculations** ✅
- **Financial impact of multiple applicants** ✅
- **Plaid integration with Betterment** ✅
- **Session children validation** ✅
- **Income source aggregation** ✅
- **Employment data aggregation** ✅
- **Financial verification aggregation** ✅

---

### **3. hosted_app_copy_verify_flow_plaid_id_emp_skip.spec.js - Hosted App with Skips**

#### **Complete Test Structure:**
- **1 test** (180s timeout)
- **Hosted application flow** with specific skip scenarios
- **Tags**: @smoke, @regression, @needs-review

#### **Test: "Should complete hosted application flow with id emp skips and Plaid integration"**
**Purpose**: Test hosted application flow with phone login, skip functionality, and Plaid integration
**API Endpoints Called**:
- `POST /auth` - Admin login (via loginForm.adminLoginAndNavigate, line 32)
  - **Response Used For**: Authentication and session establishment
  - **What's Actually Checked**: Response status is OK (200), household-status-alert is visible
- `GET /applications?` - Search applications (via findAndCopyApplication, line 36)
  - **Response Used For**: Getting applications data for search
  - **What's Actually Checked**: Response status is OK (200), applications array is returned
- `POST /identity-verifications` - Create identity verification (via completeIdVerification, line 77)
  - **Response Used For**: Creating identity verification for ID upload
  - **What's Actually Checked**: Response status is OK (200), identity verification data is returned
- **UI Interactions Only**:
  - Phone login flow (lines 49-59) - No API call, UI form interactions
  - Applicant registration form (via completeApplicantRegistrationForm, line 62) - No API call, UI form filling
  - Rent budget form (lines 69-71) - No API call, UI form filling
  - Skip applicants (via skipApplicants, line 74) - No API call, UI button click
  - Skip employment verification (via skipEmploymentVerification, line 80) - No API call, UI button click
  - Plaid financial connection (via plaidFinancialConnect, line 83) - No API call, iframe interactions with Plaid

**Steps**:
1. **Admin login and navigate to applications** (via loginForm.adminLoginAndNavigate utility)
2. **Find and copy 'AutoTest Suite Hshld-ID-Emp-Fin with skips' application** (via findAndCopyApplication utility)
3. **Admin logout** (UI interactions only)
4. **Navigate to hosted application URL** (UI navigation only)
5. **Phone login flow**:
   - Enter random phone number (generated via generateRandomPhone function)
   - Enter verification code (123456)
6. **Complete applicant registration form** (via completeApplicantRegistrationForm utility):
   - Fill first name: 'teset'
   - Fill last name: 'testrelogin'
   - Select state: 'ALASKA'
   - Accept terms
7. **Complete rent budget step** (UI interaction):
   - Fill rent budget: '500'
   - Submit form
8. **Skip applicants step** (via skipApplicants utility)
9. **Complete ID verification** (via completeIdVerification utility):
   - Upload passport document
   - Complete Persona verification flow
10. **Skip employment verification** (via skipEmploymentVerification utility)
11. **Complete Plaid financial connection** (via plaidFinancialConnect utility):
    - Use 'custom_onetxn' username
    - Use 'test' password
    - Connect to 'Regions Bank'
12. **Verify summary screen and statuses**:
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
- **Form validation** ✅

---

### **4. heartbeat_completed_application_click_check.spec.js - Completed Application Check**

#### **Complete Test Structure:**
- **1 test** (no timeout specified)
- **Completed application navigation** and verification
- **Tags**: None specified

#### **Test: "Heartbeat Test: Completed Application Clicks (frontend)"**
**Purpose**: Test navigation and verification of completed application with step-by-step validation
**API Endpoints Called**:
- `POST /auth` - Admin login (via loginWith → loginForm.submit, line 17)
  - **Response Used For**: Authentication and session establishment
  - **What's Actually Checked**: Response status is OK (200), page title contains "Applicants", household-status-alert is visible
- `GET /sessions?fields[session]` - Search sessions (via searchSessionWithText, line 21)
  - **Response Used For**: Getting sessions data for search by session ID
  - **What's Actually Checked**: Response status is OK (200), sessions array is returned
- `GET /sessions/{id}?fields[session]` - Get session details (via waitForResponse, line 28-33)
  - **Response Used For**: Getting complete session object with all completed steps and status
  - **What's Actually Checked**: Response status is OK (200), session data with all step information is returned
- `PATCH /sessions/{id}` - Update session rent budget (via updateRentBudget, line 65)
  - **Response Used For**: Updating session with new rent budget amount
  - **What's Actually Checked**: Response status is OK (200), PATCH method successful

**Steps**:
1. **Admin login** (via loginWith utility)
2. **Search for specific session ID** (via searchSessionWithText utility)
3. **Click on session** (via findSessionLocator utility)
4. **Open session in new page**:
   - Click overview applicant button
   - Open in new page via popup
5. **Navigate through completed steps**:
   - **Summary page**: Verify summary step is visible
   - **Rent budget page**: Navigate to rent budget step, update to 600, verify summary page returns
   - **ID verification page**: Navigate to identity verification step, verify "Completed" status
   - **Financial verification page**: Navigate to financial verification step, verify connect bank is visible
   - **Employment verification page**: Navigate to employment verification step, click continue, verify summary page returns
6. **Test additional functionality**:
   - Expand financial verification row
   - Click additional bank connect button
   - Verify MX frame visibility
   - Cancel modal

#### **Key Business Validations:**
- **Completed application navigation** ✅
- **Step-by-step verification** ✅
- **Status checking** ✅
- **Rent budget updates** ✅
- **Additional bank connection** ✅
- **MX integration modal** ✅
- **Popup window handling** ✅
- **UI element visibility** ✅

---

### **5. pdf_download_test.spec.js - PDF Download Functionality**

#### **Complete Test Structure:**
- **1 test** (no timeout specified)
- **PDF download** functionality
- **Tags**: @core

#### **Test: "Should successfully export PDF for an application"**
**Purpose**: Test PDF export functionality for applications with staff user permissions
**API Endpoints Called**:
- `POST /auth` - Staff login (via loginForm.submit, line 16)
  - **Response Used For**: Authentication and session establishment
  - **What's Actually Checked**: Response status is OK (200), applicants-menu is visible
- `GET /sessions?fields[session]` - Search sessions (via searchSessionWithText, line 20)
  - **Response Used For**: Getting sessions data for search by application name
  - **What's Actually Checked**: Response status is OK (200), sessions array is returned
- `GET /sessions/{id}` - Get session PDF (via checkExportPdf, line 34)
  - **Response Used For**: Downloading PDF export for the session
  - **What's Actually Checked**: Response status is OK (200), content-type is 'application/pdf'

**Steps**:
1. **Staff login** (via loginForm.fill and loginForm.submit utilities)
2. **Search for 'autotest PDF Download' application** (via searchSessionWithText utility)
3. **Navigate to session** (via navigateToSessionById utility)
4. **Export PDF** (via checkExportPdf utility):
   - Click export session button
   - Wait for export modal to appear
   - Click income source delist submit button
   - Wait for PDF response with correct content-type
   - Verify PDF download in popup window

#### **Key Business Validations:**
- **PDF export functionality** ✅
- **Staff user permissions** ✅
- **Session navigation** ✅
- **File download** ✅
- **Content-type validation** ✅
- **Popup window handling** ✅
- **Modal interactions** ✅
- **Export button functionality** ✅

---

### **6. application_create_delete_test.spec.js - Application Lifecycle Management**

#### **Complete Test Structure:**
- **1 test** (no timeout specified)
- **Application creation and deletion** functionality
- **Tags**: @core

#### **Test: "Should create and delete an application with multiple applicant types"**
**Purpose**: Test complete application lifecycle from creation to deletion with multiple applicant types
**API Endpoints Called**:
- `POST /auth` - Admin login (via loginForm.submit, line 17)
  - **Response Used For**: Authentication and session establishment
  - **What's Actually Checked**: Response status is OK (200), applicants-menu is visible
- `GET /organizations?fields[organization]=id,name` - Get organizations (via navigateToApplicationCreate, line 10)
  - **Response Used For**: Loading organization options for application creation
  - **What's Actually Checked**: Response status is OK (200), organizations data returned
- `GET /portfolios?fields[portfolio]=id,name` - Get portfolios (via navigateToApplicationCreate, line 14)
  - **Response Used For**: Loading portfolio options for application creation
  - **What's Actually Checked**: Response status is OK (200), portfolios data returned
- `GET /settings?fields[setting]=options,key&fields[options]=label,value` - Get settings (via navigateToApplicationCreate, line 18)
  - **Response Used For**: Loading application settings and options
  - **What's Actually Checked**: Response status is OK (200), settings data returned
- `GET /organizations` - Get organizations list (via navigateToApplicationCreate, line 22)
  - **Response Used For**: Loading additional organization data
  - **What's Actually Checked**: Response status is OK (200), organizations list returned
- `POST /applications` - Create application (via submitApplicationSetup, line 81)
  - **Response Used For**: Creating new application with basic setup
  - **What's Actually Checked**: Response status is OK (200), application created successfully
- `PATCH /applications` - Update workflow (via submitApplicationSetup, line 103)
  - **Response Used For**: Updating application workflow template
  - **What's Actually Checked**: Response status is OK (200), workflow updated successfully
- `PATCH /applications` - Update settings (via configureApplicationSettings, line 137)
  - **Response Used For**: Updating application flag collection and minimum amount
  - **What's Actually Checked**: Response status is OK (200), settings updated successfully
- `PATCH /applications` - Publish application (via publishApplicationToLive, line 163)
  - **Response Used For**: Publishing application to live status
  - **What's Actually Checked**: Response status is OK (200), application published successfully
- `DELETE /applications/{id}` - Delete application (via searchAndDeleteApplication, line 192)
  - **Response Used For**: Deleting the created application
  - **What's Actually Checked**: Response status is OK (200), application deleted successfully

**Steps**:
1. **Admin login** (via loginForm.fill and loginForm.submit utilities)
2. **Navigate to application creation** (via navigateToApplicationCreate utility)
3. **Fill application setup** (via fillApplicationSetup utility):
   - Select organization
   - Set application name with random number
   - Add multiple applicant types (Affordable Occupant, Affordable Primary, Employed, International, Self-Employed, Other)
4. **Submit application setup** (via submitApplicationSetup utility):
   - Create application with POST request
   - Update workflow template with PATCH request
5. **Configure application settings** (via configureApplicationSettings utility):
   - Set flag collection to 'High Risk'
   - Set minimum amount to '500'
   - Update settings with PATCH request
6. **Publish application to live** (via publishApplicationToLive utility):
   - Publish application with PATCH request
7. **Search and delete application** (via searchAndDeleteApplication utility):
   - Search for created application
   - Delete application with DELETE request
   - Verify deletion success message

#### **Key Business Validations:**
- **Application creation** ✅
- **Multiple applicant types support** ✅
- **Workflow template configuration** ✅
- **Flag collection settings** ✅
- **Minimum amount configuration** ✅
- **Application publishing** ✅
- **Application deletion** ✅
- **Admin user permissions** ✅
- **Organization selection** ✅
- **Portfolio management** ✅
- **Settings configuration** ✅
- **Success message validation** ✅
- **Dialog handling** ✅
- **Search functionality** ✅

---

### **7. application_edit_id_template_settings.spec.js - Application ID Template Configuration**

#### **Complete Test Structure:**
- **1 test** (no timeout specified)
- **Application ID template settings** functionality
- **Tags**: @regression

#### **Test: "Should edit an application ID template settings"**
**Purpose**: Test editing and updating application ID template settings with Persona integration
**API Endpoints Called**:
- `POST /auth` - Admin login (via loginForm.submit, line 14)
  - **Response Used For**: Authentication and session establishment
  - **What's Actually Checked**: Response status is OK (200), applicants-menu is visible
- `GET /applications` - Search applications (via searchApplication, line 26)
  - **Response Used For**: Searching for specific application by name
  - **What's Actually Checked**: Response status is OK (200), applications data returned
- `GET /organizations?fields[organization]=` - Get organizations (via openApplicationEditModal, line 11)
  - **Response Used For**: Loading organization data for edit modal
  - **What's Actually Checked**: Response status is OK (200), organizations data returned
- `GET /portfolios?fields[portfolio]=` - Get portfolios (via openApplicationEditModal, line 14)
  - **Response Used For**: Loading portfolio data for edit modal
  - **What's Actually Checked**: Response status is OK (200), portfolios data returned
- `GET /settings?fields[setting]=` - Get settings (via openApplicationEditModal, line 17)
  - **Response Used For**: Loading settings data for edit modal
  - **What's Actually Checked**: Response status is OK (200), settings data returned
- `GET /applications/{id}` - Get application details (via openApplicationEditModal, line 20)
  - **Response Used For**: Loading application details for editing
  - **What's Actually Checked**: Response status is OK (200), application data returned
- `PATCH /applications/{id}` - Update application (via setPersonaTemplateId, line 50)
  - **Response Used For**: Updating application with new Persona template ID
  - **What's Actually Checked**: Response status is OK (200), application updated successfully
- `GET /applications/{id}` - Get updated application (via setPersonaTemplateId, line 53)
  - **Response Used For**: Verifying application update was successful
  - **What's Actually Checked**: Response status is OK (200), updated application data returned

**Steps**:
1. **Admin login** (via loginForm.fill and loginForm.submit utilities)
2. **Navigate to applications page** (via gotoApplicationsPage utility)
3. **Search for application** (via searchApplication utility):
   - Search for 'AutoTest Suite - ID Edit Only'
4. **Open application edit modal** (via openApplicationEditModal utility):
   - Click edit icon in 8th column
   - Wait for organizations, portfolios, settings, and application data to load
5. **Submit application setup** (via submit-application-setup button)
6. **Open workflow identity setup** (via openWorkflowIdentitySetup utility):
   - Click workflow identity verification button
   - Wait for Workflow Setup modal
7. **Get current template value** (via persona-template-id-input):
   - Read current Persona template ID value
8. **Edit and save template** (via setPersonaTemplateId utility):
   - Set new template ID to 'itmpl_tester_Edited'
   - Submit identity setup form
   - Wait for PATCH and GET responses
9. **Reopen and verify** (via openWorkflowIdentitySetup and expectPersonaTemplateId utilities):
   - Reopen workflow identity setup
   - Verify template ID is 'itmpl_tester_Edited'
10. **Restore original value** (via setPersonaTemplateId utility):
    - Set template ID back to original value
    - Submit identity setup form

#### **Key Business Validations:**
- **Application editing** ✅
- **ID template configuration** ✅
- **Persona integration** ✅
- **Workflow identity setup** ✅
- **Template ID updates** ✅
- **Value persistence** ✅
- **Admin user permissions** ✅
- **Modal interactions** ✅
- **Form submissions** ✅
- **Data validation** ✅
- **Settings management** ✅
- **Workflow configuration** ✅
- **Template restoration** ✅
- **UI element visibility** ✅

---

## **Category 3 Analysis Summary**

### **API Endpoints Coverage Analysis:**

| API Endpoint | Category | Tests Using It | What's Actually Checked |
|--------------|----------|----------------|-------------------------|
| `POST /auth` | Authentication | All 7 tests | Response status is OK (200), admin/staff login successful |
| `GET /applications?` | Application Management | 6 tests | Response status is OK (200), applications array is returned |
| `POST /sessions` | Session Management | 3 tests | Response status is OK (200), session data is returned |
| `PATCH /sessions/{id}` | Session Management | 4 tests | Response status is OK (200), PATCH method successful |
| `GET /sessions?fields[session]=` | Session Management | 4 tests | Response status is OK (200), sessions data array is returned |
| `GET /sessions/{id}?fields[session]` | Session Management | 3 tests | Response status is OK (200), session details returned |
| `GET /organizations?fields[organization]=` | Organization Management | 2 tests | Response status is OK (200), organizations data returned |
| `GET /portfolios?fields[portfolio]=` | Portfolio Management | 2 tests | Response status is OK (200), portfolios data returned |
| `GET /settings?fields[setting]=` | Settings Management | 2 tests | Response status is OK (200), settings data returned |
| `POST /applications` | Application Management | 1 test | Response status is OK (200), application created successfully |
| `PATCH /applications` | Application Management | 2 tests | Response status is OK (200), application updated successfully |
| `DELETE /applications/{id}` | Application Management | 1 test | Response status is OK (200), application deleted successfully |
| `GET /sessions/{id}` | Session Management | 1 test | Response status is OK (200), content-type is 'application/pdf' |
| `POST /applicants` | Applicant Management | 2 tests | Response status is OK (200), applicant data is returned |
| `PATCH /sessions/{id}/steps/` | Session Management | 1 test | Response status is OK (200), PATCH method successful |
| `GET /financial-verifications` | Financial Verification | 1 test | Response status is OK (200), financial verifications array is returned |
| `GET /sessions/{id}/income-sources` | Income Sources | 1 test | Response status is OK (200), income sources array is returned |
| `POST /identity-verifications` | Identity Verification | 1 test | Response status is OK (200), identity verification data is returned |

### **Business Purpose Analysis:**

| Test File | Primary Business Purpose | Unique Validations | Overlap Assessment |
|-----------|-------------------------|-------------------|-------------------|
| `frontent-session-heartbeat.spec.js` | **Complete E2E Session Flow** | • Complete E2E user journey<br>• Co-applicant workflow<br>• State modal handling<br>• Manual upload options<br>• Skip functionality<br>• **Intelligent button interaction**<br>• **Employment verification via iframe** | **NO OVERLAP** - Different business flow, different validation approach |
| `co_applicant_effect_on_session_test.spec.js` | **Co-Applicant Income Aggregation** | • **Co-applicant income aggregation**<br>• **Income ratio calculations**<br>• **Financial impact of multiple applicants**<br>• **Plaid integration with Betterment**<br>• **Session children validation**<br>• **Income source aggregation**<br>• **Employment data aggregation** | **NO OVERLAP** - Different business logic, different data aggregation |
| `hosted_app_copy_verify_flow_plaid_id_emp_skip.spec.js` | **Hosted App with Skips** | • **Hosted application flow**<br>• **Phone login verification**<br>• **Skip functionality**<br>• **ID verification with upload**<br>• **Plaid integration**<br>• **Status verification**<br>• **Error handling** | **NO OVERLAP** - Different application type, different user flow |
| `heartbeat_completed_application_click_check.spec.js` | **Completed Application Check** | • **Completed application navigation**<br>• **Step-by-step verification**<br>• **Status checking**<br>• **Rent budget updates**<br>• **Additional bank connection**<br>• **MX integration modal**<br>• **Popup window handling** | **NO OVERLAP** - Different validation approach, different UI interactions |
| `pdf_download_test.spec.js` | **PDF Download Functionality** | • **PDF export functionality**<br>• **Staff user permissions**<br>• **File download**<br>• **Content-type validation**<br>• **Popup window handling**<br>• **Modal interactions**<br>• **Export button functionality** | **NO OVERLAP** - Different functionality, different user type |
| `application_create_delete_test.spec.js` | **Application Lifecycle Management** | • **Application creation**<br>• **Multiple applicant types support**<br>• **Workflow template configuration**<br>• **Flag collection settings**<br>• **Minimum amount configuration**<br>• **Application publishing**<br>• **Application deletion** | **NO OVERLAP** - Different business process, different admin functionality |
| `application_edit_id_template_settings.spec.js` | **Application ID Template Configuration** | • **Application editing**<br>• **ID template configuration**<br>• **Persona integration**<br>• **Workflow identity setup**<br>• **Template ID updates**<br>• **Value persistence**<br>• **Template restoration** | **NO OVERLAP** - Different configuration aspect, different integration |

### **Key Insights:**

1. **Different user types** - Admin vs Staff vs Applicant flows have different permissions and capabilities
2. **Different business processes** - Application management vs session flow vs document processing
3. **Different integration scenarios** - Plaid vs MX vs Persona vs document upload
4. **Different validation approaches** - E2E flow vs specific functionality vs configuration management
5. **Different business rules** - Each test validates specific application management scenarios

### **Technical Setup Analysis:**

#### **Common Setup Steps (Necessary for Each Test):**
1. **User login** (`POST /auth`) - Needed to access appropriate functionality based on user type
2. **Application/Session navigation** - Each test needs to find its specific target
3. **Specific business validation** - Each test validates its unique business scenario
4. **Cleanup/Verification** - Each test ensures proper completion of its specific process

#### **These are NOT "extra steps" - they are essential setup for each test's unique business validation**

### **Conclusion for Category 3: NO MEANINGFUL OVERLAP**

**All 7 tests should be kept** because:
- Each tests different application management scenarios
- Each validates different user types and permissions
- Each covers different business processes and workflows
- Each tests different integrations and configurations
- Each validates different UI interactions and user flows

---

## **📝 Note: Remaining Categories in Progress**

The remaining categories are currently being analyzed and will be completed following the same detailed methodology:

- **Category 4**: Session Flow Tests (3 files)
- **Category 5**: Document Processing Tests (3 files)  
- **Category 6**: System Health Tests (2 files)
- **Category 7**: Workflow Management Tests (2 files)
- **Category 8**: Integration Tests (2 files)

Each category will receive the same comprehensive line-by-line analysis, API endpoint documentation, business purpose evaluation, and overlap assessment to ensure complete test coverage understanding.

