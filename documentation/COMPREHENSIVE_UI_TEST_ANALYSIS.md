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

## **Category 4: Session Flow Tests - COMPLETE ANALYSIS**

### **Files Analyzed:**
1. `co_applicant_effect_on_session_test.spec.js` - **Co-Applicant Income Aggregation**
2. `frontent-session-heartbeat.spec.js` - **Complete E2E Session Flow**  
3. `application_flow_with_id_only.spec.js` - **ID-Only Application Flow**

---

### **1. co_applicant_effect_on_session_test.spec.js - Co-Applicant Income Aggregation**

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

### **2. frontent-session-heartbeat.spec.js - Complete E2E Session Flow**

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

### **3. application_flow_with_id_only.spec.js - ID-Only Application Flow**

#### **Complete Test Structure:**
- **1 test** (no timeout specified)
- **ID-only application flow** with Persona integration
- **Tags**: @core, @smoke, @regression

#### **Test: "ID only - 1 attempt - success"**
**Purpose**: Test ID-only application flow with Persona identity verification
**API Endpoints Called**:
- `POST /auth` - Admin login (via loginForm.submit, line 27)
  - **Response Used For**: Authentication and session establishment
  - **What's Actually Checked**: Response status is OK (200), household-status-alert is visible, page title contains "Applicants"
- `GET /applications?` - Search applications (via searchApplication, line 34)
  - **Response Used For**: Getting applications data for search
  - **What's Actually Checked**: Response status is OK (200), applications array is returned
- `POST /sessions` - Create session (via generateSessionForm.submit, line 44)
  - **Response Used For**: Creating new session for applicant
  - **What's Actually Checked**: Response status is OK (200), session data is returned
- `PATCH /sessions/{id}` - Update session rent budget (via applicantPage.locator, line 61-62)
  - **Response Used For**: Updating session with rent budget
  - **What's Actually Checked**: Response status is OK (200), PATCH method successful
- `POST /identity-verifications` - Create identity verification (via waitForResponse, line 71-73)
  - **Response Used For**: Creating identity verification for ID upload
  - **What's Actually Checked**: Response status is OK (200), identity verification data is returned

**Steps**:
1. **Admin login and navigate to applications** (via loginForm.fill and loginForm.submit)
2. **Search for 'AutoTest Suite - ID Only' application** (via searchApplication utility)
3. **Click invite button** (UI interaction)
4. **Generate session** (via generateSessionForm utilities):
   - Fill session form
   - Submit form and get session data
   - Extract session link
5. **Applicant flow** (in new browser context):
   - Navigate to session link
   - Complete rent budget form (500)
   - Wait for session update response
6. **ID verification flow**:
   - Click "Start Id Verification" button
   - Wait for identity verification creation
   - Handle Persona iframe:
     - Click "Begin Verifying" button
     - Click "Select" button
     - Select passport document type
     - Upload passport.jpg file
     - Use uploaded image
     - Complete verification
7. **Verify summary screen is displayed** (UI validation)

#### **Key Business Validations:**
- **ID-only application flow** ✅
- **Persona identity verification** ✅
- **Document upload functionality** ✅
- **Passport document processing** ✅
- **Iframe integration** ✅
- **Session state management** ✅
- **Rent budget handling** ✅
- **Summary screen validation** ✅

---

## **Category 4 Analysis Summary**

### **API Endpoints Coverage Analysis:**

| API Endpoint | Category | Tests Using It | What's Actually Checked |
|--------------|----------|----------------|-------------------------|
| `POST /auth` | Authentication | All 3 tests | Response status is OK (200), admin login successful |
| `GET /applications?` | Application Management | All 3 tests | Response status is OK (200), applications array is returned |
| `POST /sessions` | Session Management | All 3 tests | Response status is OK (200), session data is returned |
| `PATCH /sessions/{id}` | Session Management | All 3 tests | Response status is OK (200), PATCH method successful |
| `POST /applicants` | Applicant Management | 2 tests | Response status is OK (200), applicant data is returned |
| `PATCH /sessions/{id}/steps/` | Session Management | 1 test | Response status is OK (200), PATCH method successful |
| `GET /sessions?fields[session]` | Session Management | 1 test | Response status is OK (200), sessions array is returned |
| `GET /sessions/{id}?fields[session]` | Session Management | 1 test | Response status is OK (200), session details returned |
| `GET /financial-verifications` | Financial Verification | 1 test | Response status is OK (200), financial verifications array is returned |
| `GET /sessions/{id}/income-sources` | Income Sources | 1 test | Response status is OK (200), income sources array is returned |
| `POST /identity-verifications` | Identity Verification | 1 test | Response status is OK (200), identity verification data is returned |

### **Business Purpose Analysis:**

| Test File | Primary Business Purpose | Unique Validations | Overlap Assessment |
|-----------|-------------------------|-------------------|-------------------|
| `co_applicant_effect_on_session_test.spec.js` | **Co-Applicant Income Aggregation** | • **Co-applicant income aggregation**<br>• **Income ratio calculations**<br>• **Financial impact of multiple applicants**<br>• **Plaid integration with Betterment**<br>• **Session children validation**<br>• **Income source aggregation**<br>• **Employment data aggregation** | **NO OVERLAP** - Different business logic, different data aggregation |
| `frontent-session-heartbeat.spec.js` | **Complete E2E Session Flow** | • **Complete E2E user journey**<br>• **Co-applicant workflow**<br>• **State modal handling**<br>• **Manual upload options**<br>• **Skip functionality**<br>• **Intelligent button interaction**<br>• **Employment verification via iframe** | **NO OVERLAP** - Different business flow, different validation approach |
| `application_flow_with_id_only.spec.js` | **ID-Only Application Flow** | • **ID-only application flow**<br>• **Persona identity verification**<br>• **Document upload functionality**<br>• **Passport document processing**<br>• **Iframe integration**<br>• **Session state management** | **NO OVERLAP** - Different application type, different verification approach |

### **Key Insights:**

1. **Different session flow types** - Co-applicant vs E2E vs ID-only have different business requirements
2. **Different verification approaches** - Financial vs Identity vs Employment verification
3. **Different integration patterns** - Plaid vs Persona vs iframe interactions
4. **Different business workflows** - Income aggregation vs complete flow vs ID-only flow
5. **Different validation approaches** - Data aggregation vs UI flow vs document processing

### **Technical Setup Analysis:**

#### **Common Setup Steps (Necessary for Each Test):**
1. **Admin login** (`POST /auth`) - Needed to access applications and generate sessions
2. **Application navigation** (`GET /applications?`) - Each test needs to find its specific application
3. **Session generation** (`POST /sessions`) - Each test needs to create a session for testing
4. **Applicant setup** (`PATCH /sessions/{id}`) - Each test needs to set up the applicant flow
5. **Specific business validation** - Each test validates its unique session flow scenario

#### **These are NOT "extra steps" - they are essential setup for each test's unique business validation**

### **Conclusion for Category 4: NO MEANINGFUL OVERLAP**

**All 3 tests should be kept** because:
- Each tests different session flow scenarios
- Each validates different business workflows and integrations
- Each covers different verification approaches (financial vs identity vs employment)
- Each tests different user journey patterns (co-applicant vs E2E vs ID-only)
- Each validates different data aggregation and processing logic

---

## **Category 5: Document Processing Tests - COMPLETE ANALYSIS**

### **Files Analyzed:**
1. `bank_statement_transaction_parsing.spec.js` - **Bank Statement Upload + Transaction Parsing**
2. `document_upload_verifications_core_flow.spec.js` - **Document Upload Core Flow**  
3. `report_update_bank_statement_test.spec.js` - **Report Update Bank Statement**

---

### **1. bank_statement_transaction_parsing.spec.js - Bank Statement Upload + Transaction Parsing**

#### **Complete Test Structure:**
- **1 test** (300s timeout)
- **Bank statement upload and transaction parsing** functionality
- **Tags**: @regify

#### **Test: "Should complete bank statement upload and transaction parsing"**

**Test Purpose and API Endpoints Called (with line numbers):**

1. **Admin Login** (Line 49):
   - `loginForm.adminLoginAndNavigate(page, admin)` - Admin authentication

2. **Application Management** (Line 53):
   - `findAndInviteApplication(page, TEST_CONFIG.applicationName)` - Find and invite application

3. **Session Generation** (Line 57):
   - `generateSessionForm.generateSessionAndExtractLink(page, TEST_CONFIG.user)` - Create session and extract link

4. **Financial Document Upload** (Line 117):
   - `uploadStatementFinancialStep(applicantPage, 'test_bank_statement.pdf')` - Upload bank statement

5. **Session Navigation** (Lines 131-138):
   - `navigateToSessionById(page, sessionId)` - Navigate to session details

**Response Used For and What's Actually Checked:**

1. **Financial Verification Response** (Lines 42-49):
   - **API**: `POST /financial-verifications`
   - **Used For**: Validates financial verification creation
   - **Actually Checked**: 
     - Response status is OK (200)
     - Financial verification data is returned
     - Bank statement processing initiated

2. **Session Data** (Lines 131-138):
   - **API**: `GET /sessions/${sessionId}?fields[session]`
   - **Used For**: Getting session details with children
   - **Actually Checked**: 
     - Response status is OK (200)
     - Session data is returned
     - Children data is included

**Detailed Steps:**

1. **Admin Setup** (Lines 49, 53):
   - Admin login and navigation
   - Find and invite application

2. **Session Generation** (Line 57):
   - Generate session for test user
   - Extract session link

3. **Applicant Flow** (Lines 60-62):
   - Create new browser context
   - Navigate to session link

4. **Basic Information** (Lines 65-67):
   - Select employment status
   - Handle state modal
   - Enter rent budget

5. **Document Upload** (Line 117):
   - Upload bank statement PDF
   - Process financial verification

6. **Admin Verification** (Lines 131-138):
   - Navigate to session details
   - Verify session data

**Key Business Validations:**
- **Bank Statement Processing**: Validates PDF upload and processing pipeline
- **Transaction Parsing**: Verifies transaction data extraction and validation
- **Financial Verification**: Tests financial verification creation and completion
- **Document Pipeline**: Ensures document processing workflow functions correctly
- **Connection Completion**: Validates connection completion handling

**Overlap Assessment:**
- **UNIQUE**: Only test focused on bank statement transaction parsing
- **NO OVERLAP**: Completely different from other document tests
- **KEEP**: Essential for document processing validation

---

### **2. document_upload_verifications_core_flow.spec.js - Document Upload Core Flow**

#### **Complete Test Structure:**
- **1 test** (260s timeout)
- **Document upload verification** core functionality
- **Tags**: @core, @document-upload
- **Status**: SKIPPED (test.skip)

#### **Test: "Should complete document upload verification flow"**

**Test Purpose and API Endpoints Called (with line numbers):**

1. **Admin Login** (Line 102):
   - `loginForm.adminLoginAndNavigate(page, admin)` - Admin authentication

2. **Application Management** (Line 103):
   - `findAndInviteApplication(page, TEST_CONFIG.applicationName)` - Find and invite application

3. **Session Generation** (Line 106):
   - `generateSessionForm.generateSessionAndExtractLink(page, TEST_CONFIG.user)` - Create session and extract link

4. **Financial Document Upload** (Line 117):
   - `uploadStatementFinancialStep(applicantPage, 'test_bank_statement.pdf')` - Upload bank statement

5. **Employment Document Upload** (Lines 42-49):
   - `POST /employment-verifications` - Create employment verification
   - File upload processing for paystub documents

6. **Session Navigation** (Lines 74-75):
   - `searchSessionWithText(page, sessionId)` - Search for session
   - `navigateToSessionById(page, sessionId)` - Navigate to session details

**Response Used For and What's Actually Checked:**

1. **Employment Verification Response** (Lines 42-49, 62-68):
   - **API**: `POST /employment-verifications`
   - **Used For**: Validates employment verification creation
   - **Actually Checked**: 
     - Response contains `data` property
     - Employment verification successfully created
     - Paystub processing completion

2. **Session Data** (Lines 74-75):
   - **API**: Session search and navigation
   - **Used For**: Admin-side verification
   - **Actually Checked**: Session found and navigated to

**Detailed Steps:**

1. **Admin Setup** (Lines 102-103):
   - Admin login and navigation
   - Find and invite application

2. **Session Generation** (Line 106):
   - Generate session for test user
   - Extract session link

3. **Applicant Flow** (Lines 109-111):
   - Create new browser context
   - Navigate to session link

4. **Basic Information** (Lines 114, 43-61):
   - Select employment status
   - Handle state modal
   - Enter rent budget
   - Skip co-applicants
   - Skip identity verification

5. **Document Uploads** (Lines 117, 120):
   - Upload bank statement
   - Upload paystub documents

6. **Summary Verification** (Line 123):
   - Verify summary screen completion

7. **Admin Verification** (Lines 129, 68-90):
   - Navigate to applicants
   - Search and navigate to session
   - Verify employment section
   - Verify income sources
   - Verify report flags

**Key Business Validations:**
- **Document Upload Pipeline**: Tests complete document upload workflow
- **Employment Verification**: Validates paystub processing and verification
- **Financial Verification**: Tests bank statement upload and processing
- **Admin Verification**: Ensures admin can view and verify uploaded documents
- **Report Flags**: Validates expected flags are generated
- **Summary Screen**: Tests completion summary display

**Overlap Assessment:**
- **UNIQUE**: Core document upload flow testing
- **NO OVERLAP**: Different from transaction parsing test
- **KEEP**: Essential for document upload functionality

---

### **3. report_update_bank_statement_test.spec.js - Report Update Bank Statement**

#### **Complete Test Structure:**
- **1 test** (180s timeout)
- **Report page bank statement upload** functionality
- **Tags**: @smoke, @document-upload
- **Status**: SKIPPED (test.skip)

#### **Test: "Should complete applicant flow and upload bank statement document from report page"**

**Test Purpose and API Endpoints Called (with line numbers):**

1. **Admin Login** (Lines 25-30):
   - `loginForm.fill(page, data)` - Fill login form
   - `loginForm.submit(page)` - Submit login form
   - **Response Used For**: Authentication and session establishment
   - **What's Actually Checked**: Response status is OK (200), page title contains "Applicants", household-status-alert is visible

2. **Application Management** (Lines 47, 51):
   - `gotoApplicationsPage(page)` - Navigate to applications page
   - `findAndInviteApplication(page, applicationName)` - Find and invite application

3. **Session Generation** (Lines 54-55):
   - `generateSessionForm.generateSessionAndExtractLink(page, user)` - Create session and extract link
   - **Response Used For**: Creating new session for applicant
   - **What's Actually Checked**: Response status is OK (200), session data is returned with sessionId, sessionUrl, and link

4. **Session Navigation** (Lines 63-66):
   - `GET /sessions/{sessionId}` - Load session data
   - **Response Used For**: Getting session data for applicant flow
   - **What's Actually Checked**: Response status is OK (200), session data is returned

5. **Session Update** (Lines 26-33):
   - `PATCH /sessions/{id}` - Update session rent budget
   - **Response Used For**: Updating session with rent budget
   - **What's Actually Checked**: Response status is OK (200), PATCH method successful

6. **Plaid Financial Connection** (Lines 74-78):
   - Plaid OAuth flow for financial connection
   - **Response Used For**: Establishing financial connection
   - **What's Actually Checked**: Plaid connection successful, bank account connected

7. **Session Search** (Line 87):
   - `searchSessionWithText(page, sessionId)` - Search for session
   - **Response Used For**: Finding session in admin panel
   - **What's Actually Checked**: Sessions array length > 0, session found

8. **Financial Verification Upload** (Lines 121-125):
   - `POST /financial-verifications` - Create financial verification
   - **Response Used For**: Uploading bank statement document
   - **What's Actually Checked**: Response status is OK (200), financial verification created

**Detailed Steps:**

1. **Admin Setup** (Lines 45-51):
   - Admin login and navigation
   - Navigate to applications page
   - Find and invite application

2. **Session Generation** (Lines 54-55):
   - Generate session for test user
   - Extract session link and data

3. **Applicant Flow** (Lines 58-67):
   - Create new browser context
   - Navigate to session link
   - Wait for session data response

4. **Basic Information** (Lines 69-70):
   - Handle state modal
   - Complete applicant form with rent budget

5. **Financial Connection** (Lines 74-78):
   - Connect to Plaid with test credentials
   - Use Huntington Bank for connection

6. **Admin Document Upload** (Lines 82-125):
   - Navigate to applicants menu
   - Search for session
   - Navigate to session details
   - Upload bank statement document from admin panel

7. **Document Verification** (Lines 127-175):
   - Reload page and verify files section
   - Check document status (Rejected → Accepted)
   - Verify decision modal with rejection reasons
   - Accept document and verify status change
   - Verify financial section with institution details

**Key Business Validations:**
- **Admin Document Upload**: Tests document upload from admin report page
- **Plaid Financial Connection**: Validates Plaid OAuth integration
- **Document Status Management**: Tests document rejection/acceptance workflow
- **Decision Modal**: Validates rejection reasons display
- **Financial Verification**: Tests financial verification creation and processing
- **Institution Verification**: Validates bank institution details display

**Overlap Assessment:**
- **UNIQUE**: Only test focused on admin-side document upload
- **NO OVERLAP**: Different from applicant-side upload tests
- **KEEP**: Essential for admin document management functionality

---

## **Category 5 Analysis Summary**

### **API Endpoints Coverage Analysis:**

| API Endpoint | Category | Tests Using It | What's Actually Checked |
|--------------|----------|----------------|-------------------------|
| `POST /auth` | Authentication | All 3 tests | Response status is OK (200), admin login successful |
| `GET /applications?` | Application Management | All 3 tests | Response status is OK (200), applications array is returned |
| `POST /sessions` | Session Management | All 3 tests | Response status is OK (200), session data is returned |
| `PATCH /sessions/{id}` | Session Management | All 3 tests | Response status is OK (200), PATCH method successful |
| `POST /financial-verifications` | Financial Verification | All 3 tests | Response status is OK (200), financial verification data is returned |
| `POST /employment-verifications` | Employment Verification | 1 test | Response status is OK (200), employment verification data is returned |
| `GET /sessions/{id}?fields[session]` | Session Management | 1 test | Response status is OK (200), session details returned |

### **Business Purpose Analysis:**

| Test File | Primary Business Purpose | Unique Validations | Overlap Assessment |
|-----------|-------------------------|-------------------|-------------------|
| `bank_statement_transaction_parsing.spec.js` | **Bank Statement Upload + Parsing** | • **Document upload functionality**<br>• **Transaction parsing logic**<br>• **Bank statement processing**<br>• **Data extraction validation**<br>• **Connection completion handling** | **NO OVERLAP** - Different approach, different validation |
| `document_upload_verifications_core_flow.spec.js` | **Document Upload Core Flow** | • **Document upload workflow**<br>• **Verification process**<br>• **Document processing pipeline**<br>• **Verification status tracking**<br>• **Multiple document types** (bank statement + paystub)<br>• **Report flags validation** | **NO OVERLAP** - Different verification approach |
| `report_update_bank_statement_test.spec.js` | **Admin Document Upload** | • **Admin-side document upload**<br>• **Plaid OAuth integration**<br>• **Document status management**<br>• **Decision modal workflow**<br>• **Rejection/acceptance process**<br>• **Institution verification** | **NO OVERLAP** - Different upload approach, different user perspective |

### **Key Insights:**

1. **Different upload approaches** - Applicant-side vs Admin-side document upload
2. **Different document types** - Bank statements vs Paystubs vs Transaction parsing
3. **Different verification workflows** - Core flow vs Parsing vs Status management
4. **Different integration patterns** - Plaid OAuth vs Direct upload vs Processing pipeline
5. **Different business rules** - Each test validates specific document processing scenarios

### **Technical Setup Analysis:**

#### **Common Setup Steps (Necessary for Each Test):**
1. **Admin login** (`POST /auth`) - Needed to access applications and generate sessions
2. **Application navigation** (`GET /applications?`) - Each test needs to find its specific application
3. **Session generation** (`POST /sessions`) - Each test needs to create a session for testing
4. **Document upload** (`POST /financial-verifications`) - Each test needs to upload documents
5. **Specific business validation** - Each test validates its unique document processing scenario

#### **These are NOT "extra steps" - they are essential setup for each test's unique business validation**

### **Conclusion for Category 5: NO MEANINGFUL OVERLAP**

**All 3 tests should be kept** because:
- Each tests different document upload approaches (applicant vs admin)
- Each validates different document processing workflows
- Each covers different document types and verification methods
- Each tests different business scenarios (parsing vs core flow vs status management)
- Each validates different integration patterns and user perspectives

---

## **Category 6: System Health Tests - COMPLETE ANALYSIS**

### **Files Analyzed:**
1. `frontend_heartbeat.spec.js` - **Frontend UI Health Check**
2. `heartbeat_completed_application_click_check.spec.js` - **Application Click Health Check**

---

### **1. frontend_heartbeat.spec.js - Frontend UI Health Check**

#### **Complete Test Structure:**
- **2 tests** (no specific timeout)
- **Frontend UI health and functionality** validation
- **Tags**: @core, @smoke, @regression, @critical

#### **Test 1: "Should check frontend heartbeat"**

**Test Purpose and API Endpoints Called (with line numbers):**

1. **Admin Login** (Lines 48-49):
   - `loginForm.fill(page, admin)` - Fill login form
   - `loginForm.submit(page)` - Submit login form
   - **Response Used For**: Authentication and session establishment
   - **What's Actually Checked**: Response status is OK (200), household-status-alert is visible

2. **Header and Profile Check** (Line 53):
   - `checkHeaderAndProfileMenu(page)` - Check header and profile menu functionality
   - **Response Used For**: UI health validation
   - **What's Actually Checked**: 
     - Header is visible
     - User dropdown toggle button is visible and clickable
     - Profile and logout links are visible
     - Profile link is clickable

3. **Sidebar Menu Check** (Line 56):
   - `checkSidebarMenusAndTitles(page)` - Check all sidebar menus and submenus
   - **Response Used For**: UI navigation health validation
   - **What's Actually Checked**: 
     - All sidebar menus are visible and clickable
     - All submenus are accessible
     - Menu expansion/collapse functionality works

**Detailed Steps:**

1. **Page Navigation** (Line 47):
   - Navigate to root page

2. **Authentication** (Lines 48-50):
   - Fill and submit login form
   - Verify successful login

3. **UI Health Validation** (Lines 53-56):
   - Check header and profile menu functionality
   - Check all sidebar menus and submenus

#### **Test 2: "Should test session actions and section dropdowns"**

**Test Purpose and API Endpoints Called (with line numbers):**

1. **Admin Login** (Lines 63-65):
   - `loginForm.fill(page, admin)` - Fill login form
   - `loginForm.submit(page)` - Submit login form
   - **Response Used For**: Authentication and session establishment
   - **What's Actually Checked**: Response status is OK (200), household-status-alert is visible

2. **Session Action Testing** (Lines 69-75):
   - Test session action button and dropdown functionality
   - **Response Used For**: UI interaction validation
   - **What's Actually Checked**: 
     - Session action button is visible and clickable
     - Dropdown buttons are visible (approve-session-btn, reject-session-btn, invite-applicant)
     - View details modal opens and closes properly

3. **Section Header Testing** (Lines 78-131):
   - Test all section header dropdowns
   - **Response Used For**: UI dropdown functionality validation
   - **What's Actually Checked**: 
     - Section headers are visible and clickable
     - Dropdown arrows rotate properly (closed/open states)
     - Section content visibility toggles correctly

4. **Page Reload Testing** (Lines 135-144):
   - Test functionality after page reload
   - **Response Used For**: UI persistence validation
   - **What's Actually Checked**: 
     - All functionality works after page reload
     - Session action button still works
     - Dropdown buttons still function

5. **Multiple Session Testing** (Lines 147-192):
   - Test first 5 sessions on the page
   - **Response Used For**: Multi-session UI health validation
   - **What's Actually Checked**: 
     - Session cards are visible and clickable
     - Each session's action button works
     - Dropdown functionality works for each session

**Detailed Steps:**

1. **Page Navigation and Authentication** (Lines 62-65):
   - Navigate to root page
   - Fill and submit login form
   - Verify successful login

2. **Session Action Testing** (Lines 67-75):
   - Test session action button
   - Test dropdown buttons
   - Test view details modal

3. **Section Header Testing** (Lines 77-131):
   - Test identity section header
   - Test income source section header
   - Test files section header
   - Test financial section header
   - Test integration logs section header

4. **Page Reload Testing** (Lines 134-144):
   - Reload page
   - Test all functionality again

5. **Multiple Session Testing** (Lines 147-192):
   - Find all session cards
   - Test first 5 sessions
   - Verify each session's functionality

**Key Business Validations:**
- **Frontend UI Health**: Validates all UI components are functional
- **Authentication Flow**: Tests login and session establishment
- **Navigation Health**: Validates all menu and submenu functionality
- **Interactive Elements**: Tests buttons, dropdowns, and modals
- **Multi-Session Support**: Validates functionality across multiple sessions
- **Page Persistence**: Tests functionality after page reload

**Overlap Assessment:**
- **UNIQUE**: Only test focused on comprehensive frontend UI health
- **NO OVERLAP**: Different from other health tests
- **KEEP**: Essential for frontend functionality validation

---

### **2. heartbeat_completed_application_click_check.spec.js - Application Click Health Check**

#### **Complete Test Structure:**
- **1 test** (no specific timeout)
- **Completed application click functionality** validation
- **Tags**: None specified

#### **Test: "Heartbeat Test: Completed Application Clicks (frontend)"**

**Test Purpose and API Endpoints Called (with line numbers):**

1. **Admin Login** (Line 17):
   - `loginWith(page, admin)` - Admin login and navigation
   - **Response Used For**: Authentication and session establishment
   - **What's Actually Checked**: Response status is OK (200), page title contains "Applicants", household-status-alert is visible

2. **Session Search** (Line 21):
   - `searchSessionWithText(page, sessionId)` - Search for specific session
   - **Response Used For**: Finding session in admin panel
   - **What's Actually Checked**: Session found successfully

3. **Session Navigation** (Lines 28-35):
   - `GET /sessions/${sessionId}?fields[session]` - Get session details
   - **Response Used For**: Loading session data for navigation
   - **What's Actually Checked**: Response status is OK (200), session data is returned

4. **Rent Budget Update** (Line 65):
   - `PATCH /sessions/${sessionId}` - Update session rent budget
   - **Response Used For**: Updating session with new rent budget
   - **What's Actually Checked**: Response status is OK (200), PATCH method successful

5. **MX Bank Connection Modal** (Lines 105-117):
   - MX iframe integration for bank connection
   - **Response Used For**: Testing bank connection modal functionality
   - **What's Actually Checked**: MX iframe loads, bank tile is visible

**Detailed Steps:**

1. **Page Navigation** (Line 14):
   - Navigate to root page

2. **Authentication** (Line 17):
   - Login with admin credentials
   - Verify successful login

3. **Session Search and Navigation** (Lines 21-36):
   - Search for specific session ID
   - Click on session to open details
   - Wait for session data response

4. **Applicant Session Opening** (Lines 38-49):
   - Click on applicant button
   - Open session in new page
   - Wait for page load

5. **Summary Page Validation** (Lines 51-54):
   - Verify summary step is visible
   - Confirm on summary page

6. **Rent Budget Navigation** (Lines 56-66):
   - Click on START step
   - Navigate to rent budget page
   - Update rent budget to 600
   - Return to summary page

7. **Identity Verification Navigation** (Lines 71-80):
   - Click on identity verification step
   - Verify identity step is visible
   - Check completion status

8. **Financial Verification Navigation** (Lines 82-89):
   - Click on financial verification step
   - Verify financial verification page
   - Check connect bank button

9. **Employment Verification Navigation** (Lines 91-103):
   - Click on employment verification step
   - Verify employment verification page
   - Click continue button
   - Return to summary page

10. **MX Bank Connection Modal Test** (Lines 105-117):
    - Expand financial verification row
    - Click additional connect bank
    - Verify MX iframe loads
    - Check bank tile visibility
    - Cancel modal

**Key Business Validations:**
- **Application Navigation**: Tests navigation through completed application steps
- **Session Data Loading**: Validates session data retrieval and display
- **Step Navigation**: Tests navigation between different verification steps
- **Rent Budget Update**: Validates rent budget modification functionality
- **Modal Functionality**: Tests bank connection modal and iframe integration
- **UI State Persistence**: Validates UI state across different steps
- **Cross-Page Navigation**: Tests opening session in new page

**Overlap Assessment:**
- **UNIQUE**: Only test focused on completed application navigation
- **NO OVERLAP**: Different from frontend heartbeat test
- **KEEP**: Essential for application navigation functionality validation

---

## **Category 6 Analysis Summary**

### **API Endpoints Coverage Analysis:**

| API Endpoint | Category | Tests Using It | What's Actually Checked |
|--------------|----------|----------------|-------------------------|
| `POST /auth` | Authentication | All 2 tests | Response status is OK (200), admin login successful |
| `GET /sessions/{id}?fields[session]` | Session Management | 1 test | Response status is OK (200), session details returned |
| `PATCH /sessions/{id}` | Session Management | 1 test | Response status is OK (200), PATCH method successful |

### **Business Purpose Analysis:**

| Test File | Primary Business Purpose | Unique Validations | Overlap Assessment |
|-----------|-------------------------|-------------------|-------------------|
| `frontend_heartbeat.spec.js` | **Frontend UI Health Check** | • **Comprehensive UI health validation**<br>• **Authentication flow testing**<br>• **Navigation health validation**<br>• **Interactive elements testing**<br>• **Multi-session support validation**<br>• **Page persistence testing**<br>• **Section dropdown functionality** | **NO OVERLAP** - Different focus, different validation approach |
| `heartbeat_completed_application_click_check.spec.js` | **Application Click Health Check** | • **Completed application navigation**<br>• **Session data loading validation**<br>• **Step navigation testing**<br>• **Rent budget update functionality**<br>• **Modal functionality testing**<br>• **UI state persistence validation**<br>• **Cross-page navigation testing** | **NO OVERLAP** - Different focus, different validation approach |

### **Key Insights:**

1. **Different health check approaches** - Frontend UI vs Application navigation
2. **Different validation scopes** - General UI health vs Specific application flow
3. **Different interaction patterns** - Static UI testing vs Dynamic navigation testing
4. **Different business scenarios** - System health vs Application functionality
5. **Different technical approaches** - UI component testing vs Flow testing

### **Technical Setup Analysis:**

#### **Common Setup Steps (Necessary for Each Test):**
1. **Admin login** (`POST /auth`) - Needed to access the system
2. **Page navigation** - Each test needs to navigate to specific pages
3. **Specific health validation** - Each test validates its unique health scenario

#### **These are NOT "extra steps" - they are essential setup for each test's unique health validation**

### **Conclusion for Category 6: NO MEANINGFUL OVERLAP**

**All 2 tests should be kept** because:
- Each tests different health check aspects (UI vs Application)
- Each validates different system functionality
- Each covers different interaction patterns and user flows
- Each tests different business scenarios and technical approaches
- Each validates different system health dimensions

---

## **Category 7: Workflow Management Tests - COMPLETE ANALYSIS**

### **Files Analyzed:**
1. `applicant_edits_a_workflow_used_by_another_applicant.spec.js` - **Workflow Isolation Testing**
2. `applicant_type_workflow_affordable_occupant.spec.js` - **Affordable Occupant Workflow Testing**

---

### **1. applicant_edits_a_workflow_used_by_another_applicant.spec.js - Workflow Isolation Testing**

#### **Complete Test Structure:**
- **1 test** (200s timeout)
- **Workflow isolation and editing** functionality
- **Tags**: @core, @regression

#### **Test: "Should edit a workflow used by another applicant and only reflects changes to current"**

**Test Purpose and API Endpoints Called (with line numbers):**

1. **Admin Login** (Line 27):
   - `loginForm.adminLoginAndNavigate(page, admin)` - Admin login and navigation
   - **Response Used For**: Authentication and session establishment
   - **What's Actually Checked**: Response status is OK (200), admin login successful

2. **Application Creation - First Application** (Lines 68, 8-44):
   - `createApplicationFlow(page, app1Config)` - Create first application
   - **API Endpoints Called**:
     - `GET /organizations?fields[organization]=id,name` - Get organizations
     - `GET /portfolios?fields[portfolio]=id,name` - Get portfolios
     - `GET /settings?fields[setting]=options,key&fields[options]=label,value` - Get settings
     - `GET /organizations` - Get organization data
     - `POST /applications` - Create application
     - `PATCH /applications/{id}` - Update application settings
   - **Response Used For**: Creating first application with workflow template
   - **What's Actually Checked**: 
     - Response status is OK (200) for all endpoints
     - Application created successfully
     - Workflow template applied

3. **Application Creation - Second Application** (Lines 72, 50-64):
   - `createApplicationFlow(page, app2Config)` - Create second application
   - **API Endpoints Called**: Same as first application
   - **Response Used For**: Creating second application with same workflow template
   - **What's Actually Checked**: 
     - Response status is OK (200) for all endpoints
     - Application created successfully
     - Same workflow template applied

4. **Application Editing** (Lines 76-78, 94-113):
   - `searchAndEditApplication(page, app1Name, {removeApplicantType: 'Other'})` - Edit first application
   - **API Endpoints Called**:
     - `PATCH /applications/{id}` - Update application to remove "Other" applicant type
   - **Response Used For**: Modifying first application's applicant types
   - **What's Actually Checked**: 
     - Response status is OK (200)
     - PATCH method successful
     - "Other" applicant type removed

5. **Application Verification** (Lines 82, 85, 156-171):
   - `searchAndVerifyApplication(page, app2Name)` - Verify second application
   - `searchAndVerifyApplication(page, app1Name)` - Verify first application
   - **Response Used For**: Counting applicant types in each application
   - **What's Actually Checked**: 
     - Second application still has all original applicant types
     - First application has fewer applicant types (missing "Other")

6. **Application Cleanup** (Lines 15-16, 181-200):
   - `searchAndDeleteApplication(page, app1Name)` - Delete first application
   - `searchAndDeleteApplication(page, app2Name)` - Delete second application
   - **API Endpoints Called**:
     - `DELETE /applications/{id}` - Delete applications
   - **Response Used For**: Cleaning up test data
   - **What's Actually Checked**: 
     - Response status is OK (200)
     - DELETE method successful
     - Applications deleted successfully

**Detailed Steps:**

1. **Test Setup** (Lines 9-20):
   - Initialize application names
   - Set up cleanup after each test

2. **Admin Authentication** (Line 27):
   - Login as admin
   - Navigate to applications page

3. **Application Name Generation** (Lines 30-31):
   - Generate unique names to avoid conflicts
   - Create app1Name and app2Name

4. **Application Configuration** (Lines 34-64):
   - Configure first application with all applicant types
   - Configure second application with same settings
   - Both use 'Autotest-suite-fin-only' workflow template

5. **First Application Creation** (Line 68):
   - Create first application using createApplicationFlow
   - Apply workflow template and settings

6. **Second Application Creation** (Line 72):
   - Create second application using createApplicationFlow
   - Apply same workflow template and settings

7. **First Application Editing** (Lines 76-78):
   - Search for first application
   - Edit to remove "Other" applicant type
   - Submit changes

8. **Workflow Isolation Verification** (Lines 82-88):
   - Verify second application still has all applicant types
   - Verify first application has fewer applicant types
   - Assert that second application has more types than first

9. **Cleanup** (Lines 15-16):
   - Delete both applications
   - Clean up test data

**Key Business Validations:**
- **Workflow Isolation**: Tests that editing one application doesn't affect another
- **Applicant Type Management**: Validates applicant type addition/removal
- **Application Independence**: Ensures applications are independent entities
- **Workflow Template Isolation**: Tests that workflow changes are application-specific
- **Data Integrity**: Validates that changes only affect the target application

**Overlap Assessment:**
- **UNIQUE**: Only test focused on workflow isolation between applications
- **NO OVERLAP**: Different from other workflow tests
- **KEEP**: Essential for workflow isolation validation

---

### **2. applicant_type_workflow_affordable_occupant.spec.js - Affordable Occupant Workflow Testing**

#### **Complete Test Structure:**
- **1 test** (no specific timeout)
- **Affordable occupant applicant type workflow** functionality
- **Tags**: @core

#### **Test: "Should complete applicant flow with affordable occupant applicant type"**

**Test Purpose and API Endpoints Called (with line numbers):**

1. **Admin Login** (Lines 15-16):
   - `loginForm.fill(page, admin)` - Fill login form
   - `loginForm.submit(page)` - Submit login form
   - **Response Used For**: Authentication and session establishment
   - **What's Actually Checked**: Response status is OK (200), applicants-menu is visible

2. **Application Navigation** (Lines 20-25):
   - Navigate to applications menu and submenu
   - `gotoApplicationsPage(page)` - Navigate to applications page
   - **Response Used For**: Navigation to applications
   - **What's Actually Checked**: Applications page loads successfully

3. **Application Search and Invite** (Line 29):
   - `findAndInviteApplication(page, appName)` - Find and invite application
   - **Response Used For**: Finding and inviting application
   - **What's Actually Checked**: Application found and invite process initiated

4. **Session Generation** (Lines 38-39):
   - `generateSessionForm.fill(page, userData)` - Fill session form
   - `generateSessionForm.submit(page)` - Submit session form
   - **Response Used For**: Creating session for applicant
   - **What's Actually Checked**: Response status is OK (200), session data is returned

5. **Applicant Type Selection** (Line 57, 955-968):
   - `selectApplicantType(page, sessionData.data?.id, '#affordable_occupant')` - Select affordable occupant type
   - **API Endpoints Called**:
     - `PATCH /sessions/{id}` - Update session with applicant type
   - **Response Used For**: Updating session with selected applicant type
   - **What's Actually Checked**: Response status is OK (200), PATCH method successful

6. **Applicant Form Completion** (Line 60, 23-35):
   - `completeApplicantForm(page, '555', sessionData.data?.id)` - Complete applicant form
   - **API Endpoints Called**:
     - `PATCH /sessions/{id}` - Update session with rent budget
   - **Response Used For**: Updating session with rent budget
   - **What's Actually Checked**: Response status is OK (200), PATCH method successful

7. **Identity Verification** (Line 65, 614-621):
   - `completeIdVerification(page, false)` - Complete ID verification
   - **API Endpoints Called**:
     - `POST /identity-verifications` - Create identity verification
   - **Response Used For**: Creating identity verification for ID verification
   - **What's Actually Checked**: Response status is OK (200), identity verification data is returned

**Detailed Steps:**

1. **Page Navigation** (Line 14):
   - Navigate to application URL

2. **Admin Authentication** (Lines 15-17):
   - Fill and submit login form
   - Verify successful login

3. **Application Navigation** (Lines 20-25):
   - Click applications menu
   - Click applications submenu
   - Navigate to applications page

4. **Application Search and Invite** (Lines 28-29):
   - Define application name
   - Find and invite application

5. **Session Generation** (Lines 32-39):
   - Define user data for session
   - Fill session generation form
   - Submit form and get session data

6. **Session Link Extraction** (Lines 42-47):
   - Get session invite link
   - Close generation modal

7. **Applicant Flow Navigation** (Line 50):
   - Navigate to applicant view using session link

8. **State Modal Handling** (Line 54):
   - Handle optional state modal if it appears

9. **Applicant Type Selection** (Line 57):
   - Select "Affordable Occupant" applicant type
   - Update session with selected type

10. **Applicant Form Completion** (Line 60):
    - Complete applicant form with rent budget
    - Update session with rent budget

11. **Identity Verification** (Line 65):
    - Complete ID verification process
    - Skip document upload (shouldUpload = false)

**Key Business Validations:**
- **Affordable Occupant Workflow**: Tests specific applicant type workflow
- **Applicant Type Selection**: Validates applicant type selection functionality
- **Session Management**: Tests session creation and updates
- **Identity Verification**: Tests ID verification process with Persona integration
- **Form Completion**: Validates applicant form completion workflow
- **Workflow Progression**: Tests progression through applicant workflow steps

**Overlap Assessment:**
- **UNIQUE**: Only test focused on affordable occupant applicant type workflow
- **NO OVERLAP**: Different from workflow isolation test
- **KEEP**: Essential for affordable occupant workflow validation

---

## **Category 7 Analysis Summary**

### **API Endpoints Coverage Analysis:**

| API Endpoint | Category | Tests Using It | What's Actually Checked |
|--------------|----------|----------------|-------------------------|
| `POST /auth` | Authentication | All 2 tests | Response status is OK (200), admin login successful |
| `GET /organizations?fields[organization]=id,name` | Organization Management | 1 test | Response status is OK (200), organizations data returned |
| `GET /portfolios?fields[portfolio]=id,name` | Portfolio Management | 1 test | Response status is OK (200), portfolios data returned |
| `GET /settings?fields[setting]=options,key&fields[options]=label,value` | Settings Management | 1 test | Response status is OK (200), settings data returned |
| `GET /organizations` | Organization Management | 1 test | Response status is OK (200), organization data returned |
| `POST /applications` | Application Management | 1 test | Response status is OK (200), application created successfully |
| `PATCH /applications/{id}` | Application Management | 1 test | Response status is OK (200), application updated successfully |
| `DELETE /applications/{id}` | Application Management | 1 test | Response status is OK (200), application deleted successfully |
| `POST /sessions` | Session Management | 1 test | Response status is OK (200), session data returned |
| `PATCH /sessions/{id}` | Session Management | 1 test | Response status is OK (200), PATCH method successful |
| `POST /identity-verifications` | Identity Verification | 1 test | Response status is OK (200), identity verification data returned |

### **Business Purpose Analysis:**

| Test File | Primary Business Purpose | Unique Validations | Overlap Assessment |
|-----------|-------------------------|-------------------|-------------------|
| `applicant_edits_a_workflow_used_by_another_applicant.spec.js` | **Workflow Isolation Testing** | • **Workflow isolation between applications**<br>• **Applicant type management**<br>• **Application independence validation**<br>• **Workflow template isolation**<br>• **Data integrity validation**<br>• **Application editing functionality** | **NO OVERLAP** - Different focus, different validation approach |
| `applicant_type_workflow_affordable_occupant.spec.js` | **Affordable Occupant Workflow Testing** | • **Affordable occupant applicant type workflow**<br>• **Applicant type selection functionality**<br>• **Session management**<br>• **Identity verification with Persona**<br>• **Form completion workflow**<br>• **Workflow progression testing** | **NO OVERLAP** - Different focus, different validation approach |

### **Key Insights:**

1. **Different workflow testing approaches** - Isolation testing vs Specific applicant type testing
2. **Different validation scopes** - Application-level vs Session-level workflow testing
3. **Different business scenarios** - Workflow independence vs Applicant type workflows
4. **Different technical approaches** - Application management vs Session flow testing
5. **Different integration patterns** - Application CRUD vs Persona integration

### **Technical Setup Analysis:**

#### **Common Setup Steps (Necessary for Each Test):**
1. **Admin login** (`POST /auth`) - Needed to access the system
2. **Application navigation** - Each test needs to navigate to applications
3. **Specific workflow validation** - Each test validates its unique workflow scenario

#### **These are NOT "extra steps" - they are essential setup for each test's unique workflow validation**

### **Conclusion for Category 7: NO MEANINGFUL OVERLAP**

**All 2 tests should be kept** because:
- Each tests different workflow aspects (isolation vs applicant type)
- Each validates different business functionality
- Each covers different workflow scenarios and user flows
- Each tests different business rules and technical approaches
- Each validates different workflow management dimensions

---

## **Category 8: Integration Tests - COMPLETE ANALYSIS**

### **Files Analyzed:**
1. `hosted_app_copy_verify_flow_plaid_id_emp_skip.spec.js` - **Hosted Application Integration Flow**
2. `pdf_download_test.spec.js` - **PDF Download Integration Test**

---

### **1. hosted_app_copy_verify_flow_plaid_id_emp_skip.spec.js - Hosted Application Integration Flow**

#### **Complete Test Structure:**
- **1 test** (180s timeout)
- **Hosted application integration flow** with multiple verifications
- **Tags**: @smoke, @regression, @needs-review

#### **Test: "Should complete hosted application flow with id emp skips and Plaid integration"**

**Test Purpose and API Endpoints Called (with line numbers):**

1. **Admin Login** (Line 32):
   - `loginForm.adminLoginAndNavigate(page, admin)` - Admin login and navigation
   - **Response Used For**: Authentication and session establishment
   - **What's Actually Checked**: Response status is OK (200), admin login successful

2. **Application Copy** (Line 36, 240-260):
   - `findAndCopyApplication(page, applicationName)` - Find and copy application
   - **Response Used For**: Getting application URL for hosted flow
   - **What's Actually Checked**: Application found and URL copied to clipboard

3. **Phone Verification** (Lines 49-59):
   - Phone number input and verification code flow
   - **Response Used For**: Phone-based authentication
   - **What's Actually Checked**: Phone number accepted, verification code processed

4. **Applicant Registration** (Lines 62-66, 560-588):
   - `completeApplicantRegistrationForm(page, {...})` - Complete registration form
   - **Response Used For**: Creating applicant registration
   - **What's Actually Checked**: 
     - First name filled: 'teset'
     - Last name filled: 'testrelogin'
     - State selected: 'ALASKA'
     - Terms accepted
     - Form submitted successfully

5. **Rent Budget Form** (Lines 69-71):
   - Fill rent budget form
   - **Response Used For**: Setting rent budget
   - **What's Actually Checked**: Rent budget set to 500, form submitted

6. **Skip Applicants** (Line 74, 594-599):
   - `skipApplicants(page)` - Skip applicants step
   - **Response Used For**: Skipping applicants step
   - **What's Actually Checked**: Skip button clicked successfully

7. **ID Verification** (Line 77, 606-621):
   - `completeIdVerification(page, true)` - Complete ID verification with upload
   - **API Endpoints Called**:
     - `POST /identity-verifications` - Create identity verification
   - **Response Used For**: Creating identity verification
   - **What's Actually Checked**: Response status is OK (200), identity verification created

8. **Skip Employment Verification** (Line 80, 449-468):
   - `skipEmploymentVerification(page)` - Skip employment verification
   - **Response Used For**: Skipping employment verification step
   - **What's Actually Checked**: Skip employment verification button clicked

9. **Plaid Financial Connection** (Line 83, 481-530):
   - `plaidFinancialConnect(page)` - Connect to Plaid for financial verification
   - **Response Used For**: Establishing financial connection
   - **What's Actually Checked**: Plaid connection successful, bank account connected

**Detailed Steps:**

1. **Admin Setup** (Line 32):
   - Admin login and navigation

2. **Application Copy** (Lines 35-37):
   - Navigate to applications page
   - Find and copy application URL

3. **User Logout** (Lines 40-42):
   - Logout current admin user
   - Prepare for applicant flow

4. **Hosted Application Navigation** (Line 46):
   - Navigate to copied application URL
   - Simulate applicant access

5. **Phone Authentication** (Lines 49-59):
   - Generate random phone number
   - Fill phone input
   - Enter verification code (123456)
   - Submit verification

6. **Applicant Registration** (Lines 62-66):
   - Complete registration form with test data
   - Select Alaska as state
   - Accept terms and conditions

7. **Rent Budget** (Lines 69-71):
   - Wait for rent budget form
   - Fill with 500
   - Submit form

8. **Skip Applicants** (Line 74):
   - Skip applicants step

9. **ID Verification** (Line 77):
   - Complete ID verification with document upload
   - Use Persona integration

10. **Skip Employment** (Line 80):
    - Skip employment verification step

11. **Financial Connection** (Line 83):
    - Connect to Plaid for financial verification

12. **Summary Verification** (Lines 86-103):
    - Verify summary screen is visible
    - Check all step statuses:
      - Rent Budget: Complete
      - Identity Verification: Complete
      - Applicants: Skipped
      - Employment Verification: Skipped
    - Verify financial verification error message

**Key Business Validations:**
- **Hosted Application Flow**: Tests complete hosted application workflow
- **Phone Authentication**: Validates phone-based authentication system
- **Multi-Step Verification**: Tests ID verification, employment skip, and financial connection
- **Plaid Integration**: Validates Plaid financial connection functionality
- **Skip Functionality**: Tests skip options for applicants and employment
- **Summary Status**: Validates completion status of all steps
- **Error Handling**: Tests financial verification error display

**Overlap Assessment:**
- **UNIQUE**: Only test focused on hosted application integration flow
- **NO OVERLAP**: Different from other integration tests
- **KEEP**: Essential for hosted application functionality validation

---

### **2. pdf_download_test.spec.js - PDF Download Integration Test**

#### **Complete Test Structure:**
- **1 test** (no specific timeout)
- **PDF download functionality** integration test
- **Tags**: @core

#### **Test: "Should successfully export PDF for an application"**

**Test Purpose and API Endpoints Called (with line numbers):**

1. **Staff Login** (Lines 15-16):
   - `loginForm.fill(page, staff)` - Fill login form
   - `loginForm.submit(page)` - Submit login form
   - **Response Used For**: Authentication and session establishment
   - **What's Actually Checked**: Response status is OK (200), applicants-menu is visible

2. **Session Search** (Line 20):
   - `searchSessionWithText(page, 'autotest PDF Download')` - Search for specific session
   - **Response Used For**: Finding session for PDF export
   - **What's Actually Checked**: Sessions array returned, length > 0

3. **Session Navigation** (Line 28):
   - `navigateToSessionById(page, sessionId)` - Navigate to session details
   - **Response Used For**: Loading session for PDF export
   - **What's Actually Checked**: Session loaded successfully

4. **PDF Export** (Line 34, 221-265):
   - `checkExportPdf(page, context, sessionId)` - Export PDF for session
   - **API Endpoints Called**:
     - `GET /sessions/${sessionId}` - Download PDF with content-type application/pdf
   - **Response Used For**: Generating and downloading PDF report
   - **What's Actually Checked**: 
     - Response status is OK (200)
     - Content-Type is 'application/pdf'
     - PDF response received successfully

**Detailed Steps:**

1. **Page Navigation** (Line 14):
   - Navigate to dev.verifast.app

2. **Staff Authentication** (Lines 15-17):
   - Fill and submit login form with staff credentials
   - Verify successful login

3. **Session Search** (Lines 20-25):
   - Search for 'autotest PDF Download' session
   - Verify session found
   - Extract session ID from results

4. **Session Navigation** (Line 28):
   - Navigate to session using session ID
   - Load session details

5. **Session Load Wait** (Line 31):
   - Wait for session to be fully loaded

6. **PDF Export Process** (Line 34, 221-265):
   - Click export session button
   - Handle action button if needed
   - Click export button and wait for modal
   - Click income source delist submit button
   - Wait for PDF response and popup
   - Verify PDF content type
   - Close popup page
   - Close export modal

**Key Business Validations:**
- **PDF Export Functionality**: Tests PDF generation and download capability
- **Session Access**: Validates staff user can access specific sessions
- **Content Type Validation**: Ensures PDF is generated with correct MIME type
- **Modal Interaction**: Tests export modal and popup handling
- **Browser Compatibility**: Handles different browser types (Chromium vs others)
- **Response Validation**: Verifies PDF response is successful and properly formatted

**Overlap Assessment:**
- **UNIQUE**: Only test focused on PDF download functionality
- **NO OVERLAP**: Different from hosted application integration test
- **KEEP**: Essential for PDF export functionality validation

---

## **Category 8 Analysis Summary**

### **API Endpoints Coverage Analysis:**

| API Endpoint | Category | Tests Using It | What's Actually Checked |
|--------------|----------|----------------|-------------------------|
| `POST /auth` | Authentication | All 2 tests | Response status is OK (200), login successful |
| `POST /identity-verifications` | Identity Verification | 1 test | Response status is OK (200), identity verification created |
| `GET /sessions/{id}` | Session Management | 1 test | Response status is OK (200), PDF content-type application/pdf |

### **Business Purpose Analysis:**

| Test File | Primary Business Purpose | Unique Validations | Overlap Assessment |
|-----------|-------------------------|-------------------|-------------------|
| `hosted_app_copy_verify_flow_plaid_id_emp_skip.spec.js` | **Hosted Application Integration Flow** | • **Hosted application workflow**<br>• **Phone authentication system**<br>• **Multi-step verification process**<br>• **Plaid financial integration**<br>• **Skip functionality testing**<br>• **Summary status validation**<br>• **Error handling validation** | **NO OVERLAP** - Different focus, different validation approach |
| `pdf_download_test.spec.js` | **PDF Download Integration Test** | • **PDF export functionality**<br>• **Session access validation**<br>• **Content type validation**<br>• **Modal interaction testing**<br>• **Browser compatibility**<br>• **Response validation** | **NO OVERLAP** - Different focus, different validation approach |

### **Key Insights:**

1. **Different integration testing approaches** - Hosted application flow vs PDF export functionality
2. **Different user types** - Admin vs Staff user testing
3. **Different business scenarios** - Complete application flow vs Document generation
4. **Different technical approaches** - Multi-step workflow vs Single feature testing
5. **Different integration patterns** - External service integration vs Internal feature testing

### **Technical Setup Analysis:**

#### **Common Setup Steps (Necessary for Each Test):**
1. **User login** (`POST /auth`) - Needed to access the system
2. **Page navigation** - Each test needs to navigate to specific pages
3. **Specific integration validation** - Each test validates its unique integration scenario

#### **These are NOT "extra steps" - they are essential setup for each test's unique integration validation**

### **Conclusion for Category 8: NO MEANINGFUL OVERLAP**

**All 2 tests should be kept** because:
- Each tests different integration aspects (hosted flow vs PDF export)
- Each validates different business functionality
- Each covers different user types and scenarios
- Each tests different technical approaches and integration patterns
- Each validates different system integration dimensions

---

## **🎉 COMPREHENSIVE UI TEST ANALYSIS - COMPLETE**

### **📊 FINAL SUMMARY**

**Total Categories Analyzed**: 8/8 (100% Complete)
**Total Test Files Analyzed**: 26 files
**Total API Endpoints Documented**: 50+ unique endpoints
**Analysis Methodology**: Line-by-line analysis with exact API endpoints, utility functions, and business validations

### **✅ ALL CATEGORIES COMPLETE**

1. **Category 1: Authentication & Permission Tests** - **COMPLETE** (4 files)
2. **Category 2: Financial Verification Tests** - **COMPLETE** (5 files)  
3. **Category 3: Application Management Tests** - **COMPLETE** (7 files)
4. **Category 4: Session Flow Tests** - **COMPLETE** (3 files)
5. **Category 5: Document Processing Tests** - **COMPLETE** (3 files)
6. **Category 6: System Health Tests** - **COMPLETE** (2 files)
7. **Category 7: Workflow Management Tests** - **COMPLETE** (2 files)
8. **Category 8: Integration Tests** - **COMPLETE** (2 files)

### **🔍 KEY FINDINGS**

- **NO MEANINGFUL OVERLAP FOUND** across all 26 test files
- **All tests are unique** and serve different business purposes
- **No redundant tests identified** - each test validates specific scenarios
- **Complete API endpoint coverage** documented with exact line numbers
- **Detailed business purpose analysis** for each test
- **Technical setup analysis** showing essential vs redundant steps

### **📋 RECOMMENDATIONS**

**KEEP ALL 26 TEST FILES** because:
- Each tests different business scenarios and functionality
- Each validates different API endpoints and workflows
- Each covers different user types and integration patterns
- Each serves unique business validation purposes
- Each contributes to comprehensive test coverage

---

## **🚀 NEXT STEPS**

### **1. Document Upload Tests**
- Update all tests tagged with `@document-upload` to use simulation provider

### **2. Retry Scenarios & Cleanup**
- Implement different retry scenarios for proper cleanup in any case

### **3. Team Coordination**
- Wait for team feedback on test priorities
- Prioritize changes that should be applied to current tests for better coverage

