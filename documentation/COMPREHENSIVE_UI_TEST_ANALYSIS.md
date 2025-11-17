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
3. **Application Management Tests** (4 files)
4. **Session Flow Tests** (7 files)
5. **Document Processing Tests** (4 files)
6. **System Health Tests** (2 files)
7. **Workflow Management Tests** (2 files)
8. **Integration Tests** (3 files)
9. **Menu Heartbeat Tests** (13 files)
10. **Data Management Tests** (1 file)

---

## Category 1: Authentication & Permission Tests

**Purpose**: Validates role-based permissions and access control across different user types

**Tests in this Category**:
1. `user_permissions_verify.spec.js` - Centralized Leasing role (full session management)
2. `staff_user_permissions_test.spec.js` - Staff role (read-only access)
3. `property_admin_permission_test.spec.js` - Property Admin role (property management with workflow restrictions)
4. `check_org_member_application_permission_update.spec.js` - Member permission management
5. `org_member_application_binding_scoping_check.spec.js` - Application binding scoping (inbox visibility)

---

### **1. user_permissions_verify.spec.js**

**Purpose**: Validates comprehensive permissions for users with the "Autotest - Centralized Leasing" role

**Configuration**:
- **Role**: "Autotest - Centralized Leasing" (fetched dynamically)
- **Organization**: "Permissions Test Org" (fetched dynamically)
- **Application**: "Autotest - UI permissions tests"
- **Tags**: @regression, @staging-ready
- **Execution**: 3 sequential tests (serial mode, 240s timeout)
- **Shared Resources**: Session created once in `beforeAll`, reused across all tests

---

#### **Test 1: "Should allow admin to create user via API"**

**Purpose**: Create a test user with Centralized Leasing role via API for subsequent permission testing

**Test Flow**:
1. **Setup Phase**
   - Authenticate as admin via API
   - Fetch role by name: "Autotest - Centralized Leasing"
   - Fetch organization by name: "Permissions Test Org"

2. **User Creation**
   - Generate unique email prefix
   - Create user data with:
     - First name: "User"
     - Last name: "Playwright"  
     - Role: Centralized Leasing (dynamically fetched ID)
     - Organization: Permissions Test Org (dynamically fetched ID)
   - Create user via API

3. **Validation**
   - Verify user ID exists
   - Verify email matches expected value
   - Store user globally for subsequent tests

4. **Cleanup Preparation**
   - User tracked by ApiDataManager for afterAll cleanup

**Key API Endpoints**:
- `POST /auth` - Admin authentication
- `GET /roles` - Fetch role by name
- `GET /organizations` - Fetch organization by name
- `POST /users` - Create user

**Business Validations**:
- ✅ Admin can create users via API
- ✅ Roles can be fetched dynamically by name
- ✅ Organizations can be fetched dynamically by name
- ✅ User creation returns valid ID

---

#### **Test 2: "Should allow user to edit the application"**

**Purpose**: Verify Centralized Leasing role users can view and access application edit functionality

**Test Flow**:
1. **Setup Phase**
   - Login with created test user
   - Wait for sessions to load

2. **Navigation**
   - Verify applications menu and submenu are visible
   - Click applications menu
   - Click applications submenu
   - Wait for applications list to load

3. **Application Edit Access**
   - Verify applications list is populated (count > 0)
   - Verify edit button is visible on first application
   - Click edit button
   - Verify URL changes to application edit page
   - Wait for application name input to populate
   - Verify input has non-empty value

4. **Cleanup**
   - Click cancel to close edit page

**Key API Endpoints**:
- `POST /auth` - User login
- `GET /sessions?fields[session]=` - Load user sessions
- `GET /applications` - Load applications list

**Business Validations**:
- ✅ Centralized Leasing users can access applications menu
- ✅ Users can view applications list
- ✅ Edit button is visible and accessible
- ✅ Application edit page loads correctly
- ✅ Application data populates in edit form

---

#### **Test 3: "Should allow user to perform permited actions"**

**Purpose**: Comprehensive validation of all permissions granted to Centralized Leasing role

**Test Flow**:
1. **Setup Phase**
   - Login with created test user
   - Wait for sessions to load
   - Verify applicants menu and submenus are visible

2. **Session Selection**
   - Click applicants submenu
   - Use shared session (created in beforeAll via `createPermissionTestSession`)
   - Prepare session for fresh selection (deselect + search pattern)
   - Click session and wait for all data to load (employments, files, session details)

3. **Flag Resolution Before Testing**
   - Open view details modal
   - Check for flags requiring review
   - Mark all flags as non-issue (if any exist)
   - Close event history modal
   - Reload page to refresh state

4. **Permission Validation Actions**
   - **Flags Section**: View session flags in detail modal
   - **Rent Budget**: Edit rent budget (change to $500)
   - **Session Actions**: Approve session, then reject session
   - **PDF Export**: Export session as PDF (verify content-type)
   - **Document Requests**: Request additional documents (verify available options: financial_connection, pay_stub, bank_statement, identity_verification, employment_connection)
   - **Invite Applicant**: Open invite modal, verify role options (Co-App, Guarantor)
   - **Upload Documents**: Open upload modal, verify document types (Paystub, Bank Statement)
   - **Merge Sessions**: Select multiple sessions, verify merge button appears
   - **Delete Applicant**: Open remove from household modal for child applicant
   - **Identity Section**: View identity details (name, DOB, address, verification checks)
   - **Income Source Section**: View income sources, delist/relist income source
   - **Employment Section**: View employment data with pay cadence and employer
   - **Files Section**: View uploaded files and document statuses
   - **Financial Section**: View financial verifications and transaction data for all household members

**Key API Endpoints**:
- `POST /auth` - User authentication
- `GET /sessions?fields[session]=` - Search and load sessions
- `GET /sessions/{id}/employments` - Load employment data
- `GET /sessions/{id}/files` - Load files data
- `GET /sessions/{id}?fields[session]=` - Load session details
- `PATCH /sessions/{id}` - Update rent budget, approve/reject
- `GET /sessions/{id}` - Export PDF
- `GET /sessions/{id}/income-sources` - Load income sources
- `PATCH /sessions/{id}/income-sources/{id}` - Delist/relist income sources
- `GET /financial-verifications` - Load financial verifications

**Business Validations**:
- ✅ Can view session flags and details
- ✅ Can edit rent budget
- ✅ Can approve and reject sessions
- ✅ Can export session PDF
- ✅ Can request additional documents (5 types available)
- ✅ Can invite co-applicants (Co-App or Guarantor roles)
- ✅ Can upload bank statements and paystubs
- ✅ Can merge multiple sessions
- ✅ Can remove applicants from household
- ✅ Can view complete identity details
- ✅ Can manage income sources (delist/relist)
- ✅ Can view employment data
- ✅ Can view files and document statuses
- ✅ Can view financial data for all household members

**Unique Aspects**:
- Uses shared session created once in `beforeAll` (not per-test)
- Implements smart session selection pattern (deselect → search → click) to ensure fresh API calls
- Resolves all flags before approval testing to prevent test failures
- Tests complete permission matrix for Centralized Leasing role
- Validates permissions across all major session sections (flags, income, employment, files, financial, identity)

---

### **2. staff_user_permissions_test.spec.js**

**Purpose**: Validates limited read-only permissions for users with the "Autotest - Staff" role

**Configuration**:
- **Role**: "Autotest - Staff" (fetched dynamically)
- **Organization**: "Permissions Test Org" (fetched dynamically)
- **Application**: "Autotest - UI permissions tests"
- **Tags**: @regression, @staging-ready
- **Execution**: 2 sequential tests (serial mode, 240s timeout)
- **Shared Resources**: Session created once in `beforeAll`, reused across tests

---

#### **Test 1: "Should create member record and assign it to the Staff role"**

**Purpose**: Create a test user with Staff role via API for permission testing

**Test Flow**:
1. **Setup Phase**
   - Authenticate as admin via API
   - Fetch role by name: "Autotest - Staff"
   - Fetch organization by name: "Permissions Test Org"

2. **User Creation**
   - Generate unique email prefix
   - Create user data with:
     - First name: "Staff"
     - Last name: "Playwright"
     - Role: Staff (dynamically fetched ID)
     - Organization: Permissions Test Org (dynamically fetched ID)
   - Create user via API

3. **Validation**
   - Verify user ID exists
   - Verify email matches expected value
   - Store user globally for subsequent test

4. **Cleanup Preparation**
   - User tracked by ApiDataManager for afterAll cleanup

**Key API Endpoints**:
- `POST /auth` - Admin authentication
- `GET /roles` - Fetch role by name
- `GET /organizations` - Fetch organization by name
- `POST /users` - Create user

**Business Validations**:
- ✅ Admin can create staff users via API
- ✅ Staff role can be assigned dynamically
- ✅ User creation returns valid ID

---

#### **Test 2: "Verify permission of Staff role"**

**Purpose**: Validate that Staff role has read-only access with limited functionality

**Test Flow**:
1. **Setup Phase**
   - Login with created staff user
   - Verify applicants and applications menus are visible

2. **Applications Section Validation**
   - Click applications menu
   - Click applications submenu
   - Wait for applications list to load
   - Verify applications table displays correctly (table rows match API data)
   - **CRITICAL CHECK**: Verify NO edit icons are present (staff limitation)

3. **Session Access Validation**
   - Navigate to applicants submenu
   - Use shared session (created in beforeAll)
   - Prepare session for fresh selection
   - Click session and wait for all data (employments, files, flags)

4. **Limited Permission Checks**
   - **View Details**: Open view details modal, verify all flag sections load correctly
   - **Flag Sections**: Verify flags are organized by severity (decline, review, warning, info, reviewed)
   - **Session Events**: Verify session activity timeline is visible (time + data elements)
   - **PDF Export**: Can export session as PDF (limited action allowed)
   - **Identity Section**: View identification details and verifications (but NO "show images" or "more details" buttons visible)
   - **Income Source Section**: View income sources list, but detail and delist buttons are disabled (pointer-events-none class)
   - **Employment Section**: View employment data with statements modal, verify row count matches API data
   - **Files Section**: View files list, row count matches API data, can open view document modal

**Key API Endpoints**:
- `POST /auth` - User authentication
- `GET /applications` - Load applications list
- `GET /sessions/{id}/employments` - Load employment data
- `GET /sessions/{id}/files` - Load files data
- `GET /sessions/{id}/flags` - Load session flags
- `GET /sessions/{id}/events` - Load session events
- `GET /sessions/{id}/income-sources` - Load income sources
- `GET /sessions/{id}` - Export PDF

**Business Validations**:
- ✅ Can view applications (read-only access)
- ❌ CANNOT edit applications (no edit icons)
- ✅ Can view session details and all sections
- ✅ Can view flags organized by severity
- ✅ Can view session events timeline
- ✅ Can export session PDF
- ✅ Can view identity details (limited - no images/more details)
- ❌ CANNOT manage income sources (buttons disabled)
- ✅ Can view employment data and statements
- ✅ Can view files and open document viewer

**Unique Aspects**:
- Tests **read-only** permissions specifically (no edit/delete/manage actions)
- Validates buttons are visible but disabled (pointer-events-none CSS class)
- Confirms staff role cannot edit applications (edit icons completely absent)
- Verifies limited identity access (no sensitive image viewing)
- Uses shared session for consistent testing across permission checks

---

### **3. property_admin_permission_test.spec.js**

**Purpose**: Validates property-specific admin permissions with organization management capabilities

**Configuration**:
- **Role**: "Autotest - Property Admin" (fetched dynamically)
- **Organization**: "Permissions Test Org" (fetched dynamically)
- **Application**: "Autotest - UI permissions tests"
- **Tags**: @regression, @staging-ready
- **Execution**: 3 sequential tests (serial mode, 240s timeout)
- **Shared Resources**: Session created once in `beforeAll`, reused across tests

---

#### **Test 1: "Should create property admin role user via API"**

**Purpose**: Create a test user with Property Admin role via API

**Test Flow**:
1. **Setup Phase**
   - Authenticate as admin via API
   - Fetch role by name: "Autotest - Property Admin"
   - Fetch organization by name: "Permissions Test Org"

2. **User Creation**
   - Generate unique email prefix
   - Create user data with:
     - First name: "Property Admin"
     - Last name: "Playwright"
     - Role: Property Admin (dynamically fetched ID)
     - Organization: Permissions Test Org (dynamically fetched ID)
   - Create user via API

3. **Validation**
   - Verify user ID exists
   - Verify email matches expected value
   - Store user globally for subsequent tests

4. **Cleanup Preparation**
   - User tracked by ApiDataManager for afterAll cleanup

**Key API Endpoints**:
- `POST /auth` - Admin authentication
- `GET /roles` - Fetch role by name
- `GET /organizations` - Fetch organization by name
- `POST /users` - Create user

**Business Validations**:
- ✅ Admin can create property admin users via API
- ✅ Property Admin role can be assigned dynamically
- ✅ User creation returns valid ID

---

#### **Test 2: "Verify property admin user permissions"**

**Purpose**: Validate Property Admin has full application/organization management with workflow restrictions

**Test Flow**:
1. **Setup Phase**
   - Login with created property admin user
   - Verify all main menus visible (applicants, applications, organization, users)

2. **Applications Management**
   - Navigate to applications list
   - Verify applications load (count > 0)
   - Verify edit and delete buttons are visible
   - Test generate session flow (open modal, then cancel)

3. **Workflows Management (Restricted)**
   - Navigate to workflows list
   - Attempt to edit workflow → Expect 403 Forbidden error page
   - Attempt to delete workflow in READY status → Expect "Forbidden" alert
   - **Validates**: Property Admin CANNOT manage workflows

4. **Approval Conditions (Read-Only)**
   - Navigate to approval conditions list
   - Find and open "high risk" approval condition
   - Verify condition details load
   - Verify NO edit links are visible (read-only access)

5. **Organization Management**
   - Navigate to organization self page
   - Edit organization city (toggle between "Townsville" and "Groverville")
   - Verify success toast appears after each update
   - Test application creation flow (navigate to create page, then cancel)

6. **Organization Members Management**
   - Navigate to organization members tab
   - **Add Member**: Create new member with "Autotest - Staff" role (fetched dynamically)
   - Verify member appears in table
   - **Edit Permissions**: Add "Manage Applications" permission
   - **Delete Member**: Remove member from organization
   - Verify "No Record Found" message after deletion
   - **Repeat**: Test alternative members submenu with same CRUD operations

7. **Roles Validation**
   - Navigate to roles table
   - Verify roles list displays correctly

**Key API Endpoints**:
- `POST /auth` - User authentication
- `GET /applications?fields[application]` - Load applications
- `GET /workflows?fields[workflow]` - Load workflows
- `GET /flag-collections?` - Load approval conditions
- `GET /flag-collections/{id}` - Load specific condition
- `PATCH /organizations/{id}` - Update organization
- `GET /organizations/self` - Load organization info
- `GET /roles` - Load roles
- `POST /organizations/{id}/members` - Create member
- `PATCH /organizations/{id}/members/{id}` - Update member permissions
- `DELETE /organizations/{id}/members/{id}` - Delete member

**Business Validations**:
- ✅ Can view and edit applications
- ✅ Can delete applications
- ✅ Can generate sessions
- ❌ CANNOT edit workflows (403 Forbidden)
- ❌ CANNOT delete workflows (Forbidden alert)
- ✅ Can view approval conditions (read-only)
- ✅ Can edit organization information
- ✅ Can create applications
- ✅ Can manage organization members (add, edit, delete)
- ✅ Can view roles table

---

#### **Test 3: "Check applicant inbox permissions"**

**Purpose**: Validate Property Admin has full session management capabilities in applicant inbox

**Test Flow**:
1. **Setup Phase**
   - Login with created property admin user
   - Navigate to applicants submenu

2. **Session Access**
   - Use shared session (created in beforeAll)
   - Prepare session for fresh selection (deselect + search pattern)
   - Click session and wait for all data (files, financial, employments, flags)

3. **Flag Resolution Before Testing**
   - Open view details modal
   - Check for flags requiring review
   - Mark all flags as non-issue (if any exist)
   - Close event history modal
   - Reload page to refresh state

4. **Comprehensive Session Management**
   - **View Details**: Open modal, verify all flag sections display correctly
   - **Session Events**: Verify activity timeline is visible (time + data elements)
   - **Rent Budget**: Edit rent budget to test update capability
   - **Session Actions**: Approve, then reject session
   - **PDF Export**: Export session as PDF
   - **Document Requests**: Request additional documents (4 types available)
   - **Invite Applicant**: Open invite modal
   - **Upload Documents**: Verify 5 document types available (Employment/Offer letter, Paystub, Bank Statement, VA Benefits, Tax Statement)
   - **Identity Section**: View identity with SSN visible
   - **Income Source Section**: View and manage income sources (delist/relist)
   - **Employment Section**: View employment data
   - **Files Section**: View uploaded files
   - **Financial Section**: View financial verifications for all household members

**Key API Endpoints**:
- `POST /auth` - User authentication
- `GET /sessions/{id}/files` - Load files data
- `GET /financial-verifications` - Load financial data
- `GET /sessions/{id}/employments` - Load employment data
- `GET /sessions/{id}/flags` - Load session flags
- `GET /sessions/{id}/events` - Load session events
- `PATCH /sessions/{id}` - Update rent budget, approve/reject
- `GET /sessions/{id}` - Export PDF
- `GET /sessions/{id}/income-sources` - Load income sources
- `PATCH /sessions/{id}/income-sources/{id}` - Delist/relist income sources

**Business Validations**:
- ✅ Can manage sessions (full approve/reject access)
- ✅ Can export PDFs
- ✅ Can request additional documents (4 types)
- ✅ Can invite applicants
- ✅ Can upload 5 document types
- ✅ Can view identity with SSN
- ✅ Can manage income sources
- ✅ Can view employment and files data
- ✅ Can view financial data for all household members

**Unique Aspects**:
- Tests **property-specific** admin permissions (not global admin)
- Validates workflow restrictions (cannot edit/delete workflows despite other admin powers)
- Tests organization member management (add, edit permissions, delete) via two UI paths
- Verifies SSN visibility for property admin (unlike staff role)
- Validates 5 document types available for upload (more than basic roles)

---

### **4. check_org_member_application_permission_update.spec.js**

**Purpose**: Validates organization-level application permission management for members

**Configuration**:
- **User**: Admin (from test_config)
- **Target Member Email**: test_reviwer@verifast.com
- **Tags**: @regression, @staging-ready
- **Execution**: Single standalone test

---

#### **Test: "Admin should be able to update an organization member's application permissions"**

**Purpose**: Verify admin can manage application-specific permissions for organization members

**Test Flow**:
1. **Setup Phase**
   - Login with admin credentials
   - Wait for session page to load

2. **Navigation to Members**
   - Click organization menu
   - Click organization self submenu
   - Verify members tab is visible
   - Click members tab
   - Wait for members table to load

3. **Member Search**
   - Use search bar to find member by email: "test_reviwer@verifast.com"
   - Wait for search results to load
   - Locate member row containing target email
   - Click edit button
   - Wait for applications API to load permission table

4. **Permission Modification**
   - Verify member role modal is visible
   - Locate permission table (all-application-table)
   - Scroll to last row in table
   - Get checkbox state in "View Application" column
   - Toggle checkbox to opposite state (check if unchecked, uncheck if checked)
   - Wait for save button to enable
   - Click save button
   - Wait for PATCH API call to update permissions

5. **Permission Reversion (Cleanup)**
   - Toggle checkbox back to original state
   - Wait for save button to enable again
   - Click save button
   - Wait for PATCH API call to revert permissions
   - Verify permissions restored to original state

**Key API Endpoints**:
- `POST /auth` - Admin authentication
- `GET /applications?fields[application]=` - Load applications for permission table
- `PATCH /organizations/{id}/members/{id}` - Update member permissions (called twice: save + revert)

**Business Validations**:
- ✅ Admin can view organization members list
- ✅ Admin can search members by email
- ✅ Admin can edit member application permissions
- ✅ Permission changes trigger API updates
- ✅ Save button enables/disables based on changes
- ✅ Permission changes can be reverted
- ✅ Permission table displays all applications correctly

**Unique Aspects**:
- Tests **organization-level** permission management (application-specific permissions)
- Uses existing member (test_reviwer@verifast.com) for realistic scenario
- Implements toggle-and-revert pattern to avoid permanent data changes
- Verifies save button state management (disabled until change made)
- Searches member by email to ensure correct target (not relying on table position)
- Tests granular permission control (per-application basis)

---

### **5. org_member_application_binding_scoping_check.spec.js**

**Purpose**: Validates application binding scoping for organization members - ensures users only see sessions from applications they have access to

**Configuration**:
- **Organization**: "Permissions Test Org"
- **Application 1**: "Test App P1"
- **Application 2**: "Test App P2"
- **User**: Random email (Test User)
- **Timeout**: 180s
- **Tags**: @regression, @staging-ready

---

#### **Test: "Check Application Binding Scoping (Inbox Visibility)" (QA-102)**

**Purpose**: Verify that application-level permission bindings correctly filter the inbox view - users should only see sessions from applications they're bound to

**Test Flow**:

1. **Admin: Search and Find Organization**
   - Login as admin
   - Navigate to organizations menu
   - Search for "Permissions Test Org"
   - Verify exact match found
   - Store organization ID

2. **Admin: Create New Organization Member**
   - Click organization → Users tab
   - Click "Create Org Member" button
   - Fill email with random email (getRandomEmail)
   - Select empty role (member-role-field-empty-role-v2)
   - Submit and copy invitation link
   - Close modal

3. **User: Accept Invitation** (New Browser Context)
   - Open invitation URL in new context
   - Fill registration form (first name, last name, password)
   - Accept terms
   - Click Register
   - Login with new credentials
   - **Assert**: User dropdown visible (authentication successful)
   - **Assert**: applicants-menu NOT visible (no permissions yet)

4. **Admin: Grant View Sessions Permission**
   - Search for new member by email
   - Click edit member
   - Search for "view sessions" permission
   - Check "View Sessions" checkbox
   - Click "Save Permissions"
   - Store created user for cleanup

5. **User: Verify All Sessions Visible** (No Application Binding)
   - Reload applicant page
   - Expand sidebar, click applicants-menu
   - Wait for `/sessions` and `/organizations/self` API responses
   - Extract user's organization ID from API
   - **Assert**: User's org ID matches "Permissions Test Org" ID
   - **Assert**: UI shows all sessions (count matches API limit or returned count)
   - **Result**: User sees ALL org sessions (no application filter applied yet)

6. **Admin: Bind User to Application 1**
   - Search for "Test App P1" in application search
   - Check "Test App P1" checkbox
   - Click "Save App Permission"

7. **User: Verify Only App1 Sessions Visible**
   - Reload applicant page
   - Wait for page to load
   - Count visible sessions
   - **Assert**: Session count > 0
   - Click first session
   - **Assert**: ALL visible sessions contain "Test App P1" text
   - Get badge count from "All" tab
   - **Result**: User sees ONLY App1 sessions

8. **Admin: Add Application 2 Binding**
   - Search for "Test App P2" in application search
   - Check "Test App P2" checkbox
   - Click "Save App Permission"

9. **User: Verify App1 OR App2 Sessions Visible**
   - Reload applicant page
   - Wait for sessions API response
   - Close new session button if visible
   - **Assert**: "All" tab badge shows "2"
   - Count visible sessions
   - **Assert**: Session count > 0
   - **Assert**: ALL visible sessions contain either "Test App P1" OR "Test App P2" text
   - **Result**: User sees sessions from BOTH bound applications

10. **Cleanup** (afterAll hook)
    - Delete created user via cleanupPermissionTest
    - Close applicant browser context

**Key API Endpoints**:
- `POST /auth` - Admin authentication
- `GET /organizations?` - Search organizations
- `GET /members?` - Search organization members
- `POST /members` - Create organization member (via UI)
- `PATCH /members/{id}` - Update member permissions
- `GET /sessions?fields[session]=` - Get sessions with filtering
- `GET /organizations/self?fields[organization]=scope` - Get user's organization context
- `DELETE /users/{id}` - Cleanup user (afterAll)

**Business Validations**:
- ✅ New member registration flow works
- ✅ Members without permissions cannot see applicants menu
- ✅ View Sessions permission enables inbox access
- ✅ Without application binding, user sees ALL org sessions
- ✅ Application binding filters sessions to bound apps only
- ✅ Badge count reflects number of bound applications
- ✅ Multiple application bindings show combined session list
- ✅ Sessions always belong to user's organization
- ✅ Application scoping is enforced at API and UI level
- ✅ User's organization ID matches expected org

**Unique Aspects**:
- Tests **application-level permission scoping** (not just role permissions)
- Creates user via **UI flow** (not API like other tests)
- Uses **2 browser contexts** (admin + new member)
- Tests **3 permission states**: no binding → App1 binding → App1+App2 binding
- Validates **badge count accuracy** (reflects binding count)
- Uses **organization/self API** to verify user context
- Tests **dynamic permission updates** (reload to apply changes)
- Uses **`.or()` locator** for flexible text matching
- Implements **conditional cleanup** based on test success
- Stores user reference for cleanup instead of session
- Uses **escape regex** for email search safety

---

## **Category 1 Summary**

### **Business Purpose Analysis:**

| Test File | Role | Primary Business Purpose | Key Differences |
|-----------|------|-------------------------|-----------------|
| `user_permissions_verify` | **Centralized Leasing** | Comprehensive session management permissions | Full edit/approve/reject/merge capabilities |
| `staff_user_permissions_test` | **Staff** | Read-only access validation | Cannot edit applications, buttons disabled |
| `property_admin_permission_test` | **Property Admin** | Property-level admin with workflow restrictions | Can manage org members, CANNOT edit workflows |
| `check_org_member_application_permission_update` | **Admin** | Organization member permission management | Tests granular per-application permission control |
| `org_member_application_binding_scoping_check` | **Member** | Application binding scoping (inbox filtering) | Tests 3 states: no binding → single app → multiple apps, validates badge counts |

**Conclusion**: No overlap - each test validates distinct role permissions and application scoping scenarios.

---

## Category 2: Financial Verification Tests

**Purpose**: Validates financial verification flows across different providers (Plaid, MX), error handling, and income calculations

**Tests in this Category**:
1. `financial_plaid_one_transaction_error_decline.spec.js` - Plaid provider with insufficient transactions
2. `financial_mx_2_attempts_success_and_failed_password.spec.js` - MX provider retry logic and eligibility transitions
3. `check_coapp_income_ratio_exceede_flag.spec.js` - Co-applicant income ratio flag validation
4. `check_ui_shows_na_for-high_balance.spec.js` - High balance account N/A display

---

### **1. financial_plaid_one_transaction_error_decline.spec.js**

**Purpose**: Validates Plaid OAuth flow with insufficient transaction data handling and decline flag generation

**Configuration**:
- **Application**: "AutoTest - Financial Only, MX and Plaid"
- **Provider**: Plaid (using "Regions Bank" with OAuth)
- **Test Credentials**: custom_onetxn / test (account with only 1 transaction)
- **Rent Budget**: $555
- **Tags**: @smoke, @needs-review, @external-integration, @regression, @staging-ready

---

#### **Test: "Should handle Plaid Fin verification with insufficient transactions and decline flag"**

**Purpose**: Verify Plaid integration gracefully handles accounts with insufficient transaction history and generates appropriate decline flags

**Test Flow**:
1. **Setup Phase**
   - Login as admin
   - Navigate to applications menu → applications submenu

2. **Session Generation** (via `generateSessionForApplication` utility)
   - Search for "AutoTest - Financial Only, MX and Plaid" application
   - Find and click invite link
   - Fill session form with random applicant data (first_name: TestXXXXX, last_name: TestXXXXX)
   - Submit form and extract session link
   - Close modal

3. **Applicant Initial Setup** (via `completeApplicantInitialSetup` utility)
   - Navigate to session link
   - Handle optional state modal
   - Handle optional terms checkbox
   - Fill rent budget: $555
   - Submit form (waits for PATCH response)

4. **Plaid Financial Connection** (via `plaidFinancialConnect` utility)
   - Click "Alternate Connect Bank" button
   - Wait for Plaid iframe to load
   - Click "Continue as guest"
   - Click "Regions Bank" button
   - Fill username: custom_onetxn
   - Fill password: test
   - Submit OAuth credentials
   - Connection completes (1 account with 1 transaction)

5. **Applicant Verification**
   - Verify "Summary" screen displays (h3 with "Summary" text)

6. **Admin Flow** (back to main context)
   - Navigate to dashboard (via `navigateToDashboard`)
   - Navigate to applicants inbox (via `navigateToApplicants`)

7. **Error and Flag Validation** (via `verifyTransactionErrorAndDeclineFlag` utility)
   - Search sessions by applicant name
   - Click first session
   - Wait for "User Error" link to appear (polls for 45 seconds)
   - Click "User Error" link
   - Verify modal shows "1 account | 1 transaction"
   - Close modal
   - Click "View Details" button
   - Verify "Gross Income Ratio Exceeded" flag exists with proper tooltip

**Key API Endpoints**:
- `POST /auth` - Admin authentication
- `GET /applications?` - Search applications
- `POST /sessions` - Create session
- `PATCH /sessions/{id}` - Update rent budget
- `GET /sessions?fields[session]=` - Search sessions

**Business Validations**:
- ✅ Plaid OAuth flow completes successfully
- ✅ System accepts accounts with insufficient transactions (< 2 months data)
- ✅ Applicant can complete flow despite insufficient data
- ✅ "User Error" link appears in admin view (polling up to 45s)
- ✅ Error modal displays exact count: "1 account | 1 transaction"
- ✅ "Gross Income Ratio Exceeded" decline flag is auto-generated
- ✅ Flag has proper tooltip explaining threshold exceeded

**Unique Aspects**:
- Tests **Plaid-specific** error scenario (not MX)
- Uses special test account (custom_onetxn) designed for insufficient data testing
- Validates graceful degradation (completion without enough data)
- Implements polling for "User Error" link (45-second timeout)
- Verifies specific error messaging to admin users

---

### **2. financial_mx_2_attempts_success_and_failed_password.spec.js**

**Purpose**: Comprehensive MX provider test covering retry logic, error handling, and real-time eligibility status transitions

**Configuration**:
- **Application**: "AutoTest - Financial Only, MX and Plaid"
- **Provider**: MX (int-widgets.moneydesktop.com)
- **Test Banks**: "MX Bank (OAuth)" (success), "MX Bank" (failure)
- **Rent Budgets**: $500 (initial), $3000 (transition test)
- **Manual Income**: $6000 OTHER (to restore criteria)
- **Tags**: @regression, @external-integration, @eligibility, @core
- **Timeout**: 350 seconds

---

#### **Test: "Financial - mx - 2 attempts + Eligibility status transitions"**

**Purpose**: Validates MX provider's retry mechanism, credential failure handling, additional bank connection modal, and dynamic eligibility status changes based on income/rent ratio

**Test Flow**:

**PART 1: MX Connection Testing (Retry Logic)**

1. **Setup Phase**
   - Login as admin
   - Navigate to applications page
   - Search for "AutoTest - Financial Only, MX and Plaid"

2. **Session Generation**
   - Find application row by name
   - Click invite link
   - Fill session form (FinMX, Test, finmx_test@verifast.com)
   - Submit and extract session link + ID

3. **Applicant Initial Setup** (New Context)
   - Navigate to session link
   - Handle optional state/terms modals (via `setupInviteLinkSession`)
   - Fill rent budget: $500
   - Submit and wait for PATCH response

4. **First MX Connection** (SUCCESS - OAuth)
   - Click "connect-bank" button
   - Wait for MX iframe to load
   - Search for "mx bank oau"
   - Click "MX-Bank-(OAuth)-row"
   - Click continue button (opens OAuth page in new tab)
   - Wait for OAuth page to load
   - Click "Authorize" button
   - **Robust Polling Logic** (up to 160 seconds):
     - Poll every 2 seconds
     - Check if iframe closed automatically OR "done" button visible
     - Handle both scenarios (auto-close requires iframe re-open)
     - Fallback: reload page and check "Completed" status

5. **Second MX Connection** (FAILURE - Bad Credentials)
   - Re-open MX iframe if it closed automatically
   - Search for "mx bank"
   - Click "MX-Bank-row"
   - Fill LOGIN: fail_user
   - Fill PASSWORD: fail_password
   - Click credentials-continue
   - **Wait for error message** (up to 150 seconds)
   - Click close icon to dismiss modal
   - Click financial-verification-continue button

6. **Applicant Verification**
   - Verify "Summary" screen appears (110-second timeout)

**PART 1.5: Additional Bank Connect Modal**

7. **Test Additional Connect from Summary**
   - Click financial-verification-row-expand-toggle
   - Click "additional-connect-bank" button
   - Verify MX iframe loads with bank tiles
   - Click "bank-connect-modal-cancel" to close

**PART 2: Eligibility Status Transitions**

8. **Switch to Admin View**
   - Navigate to session admin URL
   - Wait 5 seconds for income sources to generate from MX data

9. **Initial Status Verification** (Polling up to 60 seconds)
   - Poll household-status-alert every 2 seconds
   - Reload every 3 attempts to refresh state
   - Verify displays "Meets Criteria" (MX income sufficient for $500 rent)

10. **Trigger Eligibility Failure**
    - Click rent-budget-edit button
    - Change rent to $3000
    - Submit
    - Reload page

11. **Failed Status Verification** (Polling up to 30 seconds)
    - Poll household-status-alert
    - Reload every 3 attempts
    - Verify displays "Criteria Not Met" (income insufficient for $3000)

12. **Add Manual Income**
    - Click income-source-section-header
    - Click income-source-add
    - Select income type: OTHER
    - Uncheck "Calculate average from transactions" (if checked)
    - Fill net amount: $6000
    - Save and wait for POST response
    - Wait 5 seconds for income source sync
    - Verify income source visible in UI

13. **Restored Status Verification** (Polling up to 40 seconds)
    - Reload page
    - Poll household-status-alert every 2 seconds
    - Reload every 5 attempts
    - Verify displays "Meets Criteria" (total income now sufficient)

**Key API Endpoints**:
- `POST /auth` - Admin authentication
- `GET /applications?` - Search applications
- `POST /sessions` - Create session
- `PATCH /sessions/{id}` - Update rent budget (3 times: $500, $3000, background updates)
- `POST /financial-verifications` - Start MX connection
- `POST /sessions/{id}/income-sources` - Create manual income source

**Business Validations**:
- ✅ MX OAuth flow completes successfully with popup authorization
- ✅ System handles iframe auto-close gracefully (re-opens for retry)
- ✅ Robust polling prevents flakiness (160-second tolerance for MX processing)
- ✅ Retry mechanism allows second connection attempt
- ✅ Invalid credentials show error message (150-second timeout)
- ✅ Applicant can complete flow with mixed success/failure attempts
- ✅ Additional bank connect modal works from summary page
- ✅ Eligibility status updates dynamically when rent changes
- ✅ Status polling with page reloads ensures fresh data
- ✅ Manual income sources properly aggregate with MX income
- ✅ Income-to-rent ratio calculations work correctly
- ✅ Status transitions validated: "Meets" → "Not Met" → "Meets"

**Unique Aspects**:
- Tests **MX-specific** provider (not Plaid)
- Implements **highly robust polling** for iframe completion (handles auto-close)
- Tests **retry mechanism** with intentional failure
- Validates **OAuth popup flow** (separate window authorization)
- Tests **additional bank connect** modal (from applicant summary)
- Implements **comprehensive status polling** with reload strategy
- Tests **dynamic eligibility calculations** (3 different states)
- Validates **manual income aggregation** with automated sources

---

### **3. check_coapp_income_ratio_exceede_flag.spec.js**

**Purpose**: Validates co-applicant income aggregation and dynamic flag generation/removal based on income-to-rent ratio thresholds

**Configuration**:
- **Application**: "AutoTest Suite - Full Test" (full flow application)
- **Primary Applicant Type**: Employed
- **Co-Applicant Type**: Other  
- **Rent Budget**: $1500
- **Identity**: Persona verification (with camera permissions)
- **Financial**: Plaid (Betterment, no popup) - both applicants
- **Employment**: Atomic Paychex (username: test-good, password: test) - both applicants
- **Tags**: @smoke, @external-integration, @regression, @staging-ready, @try-test-rail-names
- **Timeout**: 450 seconds

---

#### **Test: "Should confirm co-applicant income is considered when generating/removing Gross Income Ratio Exceeded flag"**

**Purpose**: Verify that household income from multiple applicants correctly aggregates and that the GROSS_INCOME_RATIO_EXCEEDED flag generates/clears based on 30% ratio threshold
**Test Flow**:

**PART 1: Primary Applicant Flow (Single Income - Flag Should Exist)**

1. **Setup Phase**
   - Login as admin
   - Navigate to applications page
   - Find and invite "AutoTest Suite - Full Test" application

2. **Session Generation**
   - Fill session form (Playwright, Ratio, playwright+ratio@verifast.com)
   - Extract session ID, session URL, and invite link

3. **Primary Applicant Context** (With camera permissions)
   - Navigate to invite URL
   - Handle session setup (terms → applicant type → state): Select #employed
   - Update rent budget: $1500

4. **Add Co-Applicant to Household**
   - Fill household form with co-applicant data (Playwright, CoApp)
   - Click applicant-invite-continue button

5. **Complete Primary Verification Steps**
   - Identity: Complete Persona verification
   - Financial: Complete Plaid with Betterment (username: custom_gig)
   - Wait for Plaid completion (60s polling timeout)
   - Employment: Complete Paychex (username: test-good, password: test)
   - Click employment-step-continue

6. **Admin View - Initial Validation**
   - Navigate to applicants → applicants submenu
   - Search for session by ID, click session card
   - **Validate Initial Financial Data**:
     - Verify session has children (co-applicant placeholder)
     - Check rent: $1500, Check income (primary only)
     - Calculate ratio: (rent / income) * 100
     - **Verify ratio > 30%** (insufficient)
   - Click View Details
   - **Verify GROSS_INCOME_RATIO_EXCEEDED flag visible**
   - Close event history

**PART 2: Co-Applicant Flow (Add Income - Flag Should Clear)**

7. **Invite Co-Applicant**
   - Click session-action → invite-applicant
   - Click reinvite for first child
   - Copy invite link from clipboard
   - Close invite modal

8. **Co-Applicant Context** (New context with camera)
   - Navigate to co-app invite URL
   - Handle session setup: Select #other

9. **Complete Co-Applicant Verification Steps**
   - Identity: Complete Persona
   - Financial: Complete Plaid with Betterment (user_bank_income)
   - Wait for Plaid completion
   - Employment: Complete Paychex (test-good, test)
   - Click employment-step-continue
   - Close co-app page

10. **Admin View - Final Validation**
    - Reload session page, search by ID again
    - **Validate Updated Financial Data**:
      - Verify income INCREASED (log before/after/delta)
      - Calculate new ratio with **polling** (up to 25s):
        - Reload page every 5s if ratio still > 30%
      - **Verify ratio ≤ 30%** (sufficient)
    - Click View Details
    - **Verify GROSS_INCOME_RATIO_EXCEEDED flag REMOVED** (poll up to 20s):
      - Close and reopen modal between attempts
      - Verify final count = 0
    - Close event history

**Key API Endpoints**:
- `POST /auth` - Admin authentication
- `GET /applications?` - Search applications
- `POST /sessions` - Create session
- `PATCH /sessions/{id}` - Update applicant type, rent budget, steps
- `POST /applicants` - Create co-applicant
- `GET /sessions?fields[session]` - Load sessions with children
- `GET /sessions/{id}?fields[session]` - Get full session details

**Business Validations**:
- ✅ Primary applicant adds co-applicant placeholder during household step
- ✅ Co-applicant placeholder has APPLICANT role before invite
- ✅ Initial income triggers GROSS_INCOME_RATIO_EXCEEDED when ratio > 30%
- ✅ Co-applicant completes separate verification flow with different type (#other vs #employed)
- ✅ Household income aggregates from multiple applicants
- ✅ Ratio polling with reload ensures accurate backend calculation
- ✅ Flag automatically clears when ratio drops ≤ 30%
- ✅ Flag polling with modal refresh ensures UI reflects backend state

**Unique Aspects**:
- Tests **multi-applicant household** income aggregation
- Implements **robust ratio polling** (25s with page reloads)
- Implements **flag polling** (20s with modal refresh)
- Uses **two separate browser contexts** (primary + co-applicant)
- Tests **dynamic flag generation/removal** based on real-time calculations
- Validates **30% income ratio threshold** specifically
- Uses **Persona identity** (requires camera permissions)
- Tests **Atomic Paychex** integration
- Tests **different applicant types** in same household

---

### **4. check_ui_shows_na_for-high_balance.spec.js**

**Purpose**: Validates that high balance accounts (≥ $500,000) display actual dollar values (not "N/A") and that UI income matches backend API calculations

**Configuration**:
- **Application**: "AutoTest - Simulation financial employment"
- **Verification Method**: Upload statement (VERIDOCS simulator with dialog)
- **Mock Data**: High balance bank statement ($550,000 starting balance)
- **Rent Budget**: $555
- **Tags**: @core, @regression, @staging-ready

---

#### **Test: "Should check UI not shows N/A for high balance accounts"**

**Purpose**: Verify that accounts with balances ≥ $500,000 properly display dollar amounts throughout UI and that Monthly Gross Income card matches backend API data

**Test Flow**:
1. **Setup Phase**
   - Login as admin (capture admin token for API calls)
   - Navigate to applications page
   - Find and invite "AutoTest - Simulation financial employment"

2. **Session Generation**
   - Fill session form (alexander, sample, ignacio.martinez+playwright1@verifast.com)
   - Submit and extract session ID + invite link
   - Close modal

3. **Applicant Context** (New context)
   - Navigate to invite link
   - Handle optional state/terms modals (via `setupInviteLinkSession`)
   - Fill rent budget: $555
   - Submit and wait for PATCH response

4. **Financial Verification with High Balance Data**
   - Click financial-upload-statement button
   - Set up dialog listener to inject high balance bank statement JSON:
     - Institution: Wells Fargo
     - Account type: Checking
     - Starting balance: $550,000
     - 5 transactions with large amounts ($15k-$35k)
     - Ending balance: calculated dynamically
   - Click connect-bank button (triggers dialog)
   - Dialog accepts with highBalanceBankStatementData JSON
   - Wait for POST /financial-verifications response

5. **Continue Flow**
   - Click financial-verification-continue button
   - Verify employment-verification-step is visible
   - Click employment-step-skip button

6. **Admin Validation**
   - Bring admin page to front
   - Navigate to applicants menu → applicants submenu
   - Search for session by ID
   - Navigate to session by ID
   - Click financial-section-header to expand

7. **Balance Display Validation**
   - Get balance column (visible balance col)
   - Verify balance text does NOT contain "n/a" (case-insensitive)
   - Click financial-section-transactions-radio
   - Get all transaction balance columns
   - Loop through each balance column:
     - Verify text does NOT contain "n/a"

8. **Cash Flow Validation** (Polling up to 5 seconds)
   - Get report-cashflow-card element
   - Poll for cash flow value (10 attempts, 500ms each):
     - Extract dollar amount using regex: /\$\s*([\d,]+\.\d{2})/
     - Verify value exists and doesn't contain "n/a"
     - Log value when found

9. **Monthly Gross Income API Validation**
   - Make API request: GET /sessions/{id} with admin token
   - Extract backend income: sessionData.data.state.summary.income (in cents)
   - Convert to dollars: (income / 100).toFixed(2)
   - Get report-monthly-income-card element
   - Poll for UI income value (10 attempts, 500ms each):
     - Extract dollar amount using regex
     - Verify value exists and doesn't contain "n/a"
   - **Verify UI income matches API income exactly**

**Key API Endpoints**:
- `POST /auth` - Admin authentication (returns token)
- `GET /applications?` - Search applications
- `POST /sessions` - Create session
- `PATCH /sessions/{id}` - Update rent budget
- `POST /financial-verifications` - Create verification with high balance payload
- `GET /sessions?fields[session]=` - Search sessions
- `GET /sessions/{id}` - Get session for API validation

**Business Validations**:
- ✅ High balance accounts (≥ $500k) display actual dollar values
- ✅ Balance columns do NOT show "N/A" for high balance accounts
- ✅ Transaction balance columns do NOT show "N/A"
- ✅ Cash Flow card displays calculated value (not "N/A")
- ✅ Monthly Gross Income card matches backend API calculation exactly
- ✅ UI polling ensures values load before validation
- ✅ Regex extraction correctly parses dollar amounts
- ✅ VERIDOCS simulator accepts high balance mock data via dialog

**Unique Aspects**:
- Tests **high balance edge case** ($550,000 starting balance)
- Uses **dialog injection** to simulate VERIDOCS upload
- Validates **N/A prevention** for large balances (regression prevention)
- Implements **dual validation**: visual check + API comparison
- Uses **polling for UI values** (ensures rendering complete)
- Tests **Wells Fargo** bank statement format
- Validates **transaction-level balance display** (not just summary)
- Verifies **Cash Flow calculation** displays properly


---

## **Category 2 Summary**

### **Business Purpose Analysis:**

| Test File | Provider/Scenario | Primary Business Purpose | Key Differences |
|-----------|-------------------|-------------------------|-----------------|
| `financial_plaid_one_transaction_error_decline` | **Plaid + Error** | Insufficient transaction error handling | Tests Plaid OAuth with 1-transaction account, validates error messaging |
| `financial_mx_2_attempts_success_and_failed_password` | **MX + Retry + Eligibility** | Retry logic and dynamic eligibility transitions | Tests MX OAuth + retry + status transitions (3 states), 350s timeout |
| `check_coapp_income_ratio_exceede_flag` | **Co-Applicant Income Aggregation** | Multi-applicant income ratio flag logic | Tests household income aggregation, 30% threshold, flag auto-clear |
| `check_ui_shows_na_for-high_balance` | **High Balance UI** | High balance N/A prevention and API sync | Tests $550k account, validates UI=API income match exactly |

**Conclusion**: No overlap - each test validates different provider integration, error scenario, or calculation logic.

---

## Category 3: Application Management Tests

**Purpose**: Validates application configuration, lifecycle management, and approval condition settings

**Tests in this Category**:
1. `application_create_delete_test.spec.js` - Application lifecycle (create + delete)
2. `application_edit_id_template_settings.spec.js` - ID template configuration
3. `verify_application_edit_id_step_edit.spec.js` - Application edit ID step
4. `approval_condition_search_verify.spec.js` - Approval conditions search
5. `default_applicant_type_override_in_application_workflow_steps.spec.js` - Default applicant type override control

---






### **1. application_create_delete_test.spec.js**

**Purpose**: Validates complete application lifecycle from creation through deletion with multiple applicant types

**Configuration**:
- **Organization**: "Verifast"
- **Application Name**: AutoTest Create_Delete_{random} (unique per run)
- **Applicant Types**: 6 types (Affordable Occupant, Affordable Primary, Employed, International, Self-Employed, Other)
- **Workflow Template**: "Autotest-suite-fin-only"
- **Flag Collection**: "High Risk"
- **Rent Budget Range**: $500 - $10,000
- **Tags**: @core, @regression, @staging-ready, @try-test-rail-names

---

#### **Test: "Should create and delete an application with multiple applicant types"**

**Purpose**: Verify complete application lifecycle including creation, configuration, publishing, and deletion

**Test Flow**:

1. **Setup Phase**
   - Login as admin
   - Verify applicants-menu is visible

2. **Application Creation Flow** (via `completeApplicationFlow` utility)
   
   **Step A: Navigate to Create Page**
   - Navigate directly to /application/create
   - Wait for 4 parallel API calls (organizations, portfolios, settings, organizations list)

   **Step B: Fill Application Setup**
   - Select organization: "Verifast"
   - Fill application name: AutoTest Create_Delete_{random}
   - Add 6 applicant types (loop through each)

   **Step C: Submit Application Setup**
   - Click submit-application-setup button
   - Wait for POST /applications response
   - Extract application ID from response
   - If workflow edit form visible:
     - Select workflow template: "Autotest-suite-fin-only"
     - Submit and wait for PATCH response

   **Step D: Configure Settings**
   - Set flag collection: "High Risk"
   - Set rent budget min: $500, max: $10,000
   - Submit and wait for PATCH response

   **Step E: Publish to Live**
   - Wait for "Publish Live" section
   - Click publish button
   - Confirm and wait for PATCH response

3. **Application Deletion Flow**
   - Search for application by name
   - Set up dialog handler to accept confirmation
   - Click delete button using application ID (robust selector)
   - Wait for DELETE response
   - Verify "Application deleted successfully" alert

**Key API Endpoints**:
- `POST /auth` - Admin authentication
- `GET /organizations?fields[organization]=id,name` - Load organizations
- `GET /portfolios?fields[portfolio]=id,name` - Load portfolios
- `GET /settings?fields[setting]=options,key&fields[options]=label,value` - Load settings
- `GET /organizations` - Load additional org data
- `POST /applications` - Create application
- `PATCH /applications` - Update workflow (conditional)
- `PATCH /applications` - Update settings
- `PATCH /applications` - Publish to live
- `DELETE /applications/{id}` - Delete application

**Business Validations**:
- ✅ Admin can create applications
- ✅ Can configure 6 different applicant types
- ✅ Organization selection works
- ✅ Workflow template assignment works
- ✅ Flag collection can be set to "High Risk"
- ✅ Rent budget range configurable ($500-$10k)
- ✅ Application publishes to live
- ✅ Application deletion works with confirmation
- ✅ Success message appears after deletion
- ✅ Robust deletion using application ID

**Unique Aspects**:
- Tests **full lifecycle** (create → configure → publish → delete)
- Uses **completeApplicationFlow** helper (end-to-end automation)
- Validates **6 applicant types** in single application
- Uses **random application name** for isolation
- Implements **robust deletion** with application ID selector
- No session creation (application-level test only)

---

### **2. application_edit_id_template_settings.spec.js**

**Purpose**: Validates Persona identity template ID configuration within application workflow settings

**Configuration**:
- **Application**: "AutoTest Suite - ID Edit Only"
- **Template IDs**: itmpl_tester_Edited (test value), then restore original
- **Tags**: @regression, @staging-ready

---

#### **Test: "Should edit an application ID template settings"**

**Purpose**: Verify admin can edit Persona Template ID in application workflow settings and changes persist

**Test Flow**:

1. **Setup Phase**
   - Login as admin
   - Verify applicants-menu is visible
   - Click applications-menu → applications-submenu

2. **Navigate to Application**
   - Navigate to applications page
   - Search for "AutoTest Suite - ID Edit Only"

3. **Open Application Edit Modal**
   - Click edit button (8th column, first row)
   - Wait for 4 parallel API calls (organizations, portfolios, settings, application details)

4. **Access Workflow Identity Setup**
   - Click submit-application-setup button
   - Click workflow-identity-verification SVG icon
   - Wait for "Workflow Setup" h3 modal

5. **Capture Original Template ID**
   - Get persona-template-id-input value
   - Store original value

6. **Edit Template ID**
   - Fill persona-template-id-input: "itmpl_tester_Edited"
   - Click submit-identity-setup-form
   - Wait for PATCH /applications/{id} + GET responses
   - Wait 5 seconds

7. **Verify Persistence**
   - Reopen workflow identity setup
   - Verify persona-template-id-input = "itmpl_tester_Edited"

8. **Restore Original Value**
   - Fill persona-template-id-input with original value
   - Click submit-identity-setup-form
   - Wait for PATCH + GET responses
   - Wait 3 seconds

**Key API Endpoints**:
- `POST /auth` - Admin authentication
- `GET /applications` - Search applications
- `GET /organizations?fields[organization]=` - Load organizations
- `GET /portfolios?fields[portfolio]=` - Load portfolios
- `GET /settings?fields[setting]=` - Load settings
- `GET /applications/{id}` - Load application details
- `PATCH /applications/{id}` - Update Persona template ID (twice)

**Business Validations**:
- ✅ Admin can access workflow identity setup
- ✅ Persona Template ID can be edited
- ✅ Changes persist after modal close/reopen
- ✅ Edit-verify-restore pattern works
- ✅ PATCH triggers GET confirmation

**Unique Aspects**:
- Tests **Persona integration** configuration
- Implements **edit-verify-restore** pattern
- Validates **persistence** by reopening modal
- Tests **workflow identity settings** (not general settings)

### **3. verify_application_edit_id_step_edit.spec.js**

**Purpose**: Validates application workflow settings persistence across sequential edits (identity verification toggle + financial settings)

**Configuration**:
- **Application**: "AutoTest Suite - ID Edit Only"
- **Execution**: 2 sequential tests (verifies persistence)
- **Tags**: @regression, @staging-ready

---

#### **Test 1: "Should login user and edit ID only application"**

**Purpose**: Enable identity verification and update financial settings, verify changes save correctly

**Test Flow** (via `completeApplicationEditWorkflow` utility):
1. **Setup Phase**
   - Login as admin
   - Verify page title contains "Applicants"

2. **Navigate and Edit**
   - Navigate to applications page
   - Search for "AutoTest Suite - ID Edit Only"
   - Click edit button
   - Wait for application details and organizations to load
   - Verify "Application Setup" heading visible

3. **Submit Application Setup**
   - Click submit-application-setup
   - Wait for PATCH /applications/{id} response

4. **Configure Identity Verification**
   - Click workflow-identity-verification
   - Verify workflow-identity-modal is visible
   - Check #identityRequired checkbox state (expected: true)
   - Toggle if needed to match expected state
   - Click submit-identity-setup-form
   - Wait for PATCH /applications/{id}/steps/{id} response
   - Click submit-app-workflow-edit-form

5. **Update Financial Settings**
   - Verify current guarantor value (not specified in test 1)
   - Fill application-income-ratio-guarantor: "5"
   - Fill incomeBudget: "1"
   - Fill rentBudgetMin: "500"
   - Click submit-application-setting-modal
   - Wait for PATCH /applications/{id} response
   - Wait for GET /applications?fields[application] response (auto-publish refresh)
   - Wait 2 seconds for UI update

---

#### **Test 2: "Verify updates are there in application"**

**Purpose**: Verify changes from Test 1 persisted and can be reverted

**Test Flow** (via `completeApplicationEditWorkflow` utility):
1. **Setup Phase**
   - Login as admin
   - Verify page title contains "Applicants"

2. **Navigate and Edit**
   - Navigate to applications page
   - Search for "AutoTest Suite - ID Edit Only"
   - Click edit button
   - Wait for application details and organizations

3. **Submit Application Setup**
   - Click submit-application-setup
   - Wait for PATCH response

4. **Configure Identity Verification**
   - Click workflow-identity-verification
   - Check #identityRequired checkbox state (expected: **false** - changed in Test 1)
   - Toggle if needed
   - Submit and wait for PATCH response
   - Click submit workflow edit form

5. **Update Financial Settings** (Revert to Original)
   - Verify current guarantor value: "5" (from Test 1)
   - Fill application-income-ratio-guarantor: "3" (revert)
   - Fill incomeBudget: "1"
   - Fill rentBudgetMin: "500"
   - Submit and wait for PATCH + GET responses
   - Wait 2 seconds

**Key API Endpoints**:
- `POST /auth` - Admin authentication
- `GET /applications?fields[application]` - Search applications
- `GET /organizations` - Load organizations
- `GET /applications/{id}` - Load application details
- `PATCH /applications/{id}` - Submit application setup
- `PATCH /applications/{id}/steps/{id}` - Update identity verification
- `PATCH /applications/{id}` - Update financial settings (auto-publishes)
- `GET /applications?fields[application]` - Refresh list after auto-publish

**Business Validations**:
- ✅ Identity verification checkbox toggles correctly
- ✅ Identity state persists across separate test runs
- ✅ Guarantor value updates correctly
- ✅ Guarantor value persists for verification in next test
- ✅ Financial settings auto-publish in edit mode
- ✅ Toggle-and-verify pattern works across tests
- ✅ Revert-and-verify pattern works

**Unique Aspects**:
- Tests **cross-test persistence** (Test 2 verifies Test 1's changes)
- Uses **sequential test execution** to validate persistence
- Tests **identity verification toggle** specifically
- Tests **guarantor value** financial setting
- Validates **auto-publish** on settings update (edit mode behavior)
- Implements **verify-change-revert** pattern across 2 tests

---

### **4. approval_condition_search_verify.spec.js**

**Purpose**: Validates flag search functionality within approval conditions (flag collections) across different search fields

**Configuration**:
- **Search Terms**: "Mismatch" (name), "computed cadence" (description), "EMPLOYMENT_LETTER_UPLOADED" (BE name)
- **Search Fields**: flag-name-col, flag-description-col, flag-key-col
- **Tags**: @regression

---

#### **Test: "Approval Conditions — Search by Name, Description, and BE Name"**

**Purpose**: Verify flag search works across multiple fields (name, description, backend key) with partial and exact match support

**Test Flow**:

1. **Setup Phase**
   - Navigate to app URL
   - Login as admin
   - Verify applicants-menu is visible
   - Click applications-menu

2. **Navigate to Approval Conditions**
   - Click approval-conditions-submenu
   - Wait for GET /flag-collections? response
   - Extract flag collections data
   - Verify flag collections exist (length > 0)

3. **Open Flag Collection Details**
   - Get first flag collection from response
   - Click view button for that collection

4. **Search Test 1: Name Column** (via `searchAndValidateFlags` helper)
   - Fill app-cond-flag-search-input: "Mismatch"
   - Wait for GET /flags response with filters containing "Mismatch"
   - Parse flags array from response
   - Loop through each flag:
     - Find flag row by ID
     - Get flag-name-col
     - Verify column contains "Mismatch" (case-insensitive)

5. **Search Test 2: Description Column** (via `searchAndValidateFlags` helper)
   - Fill app-cond-flag-search-input: "computed cadence"
   - Wait for GET /flags response with filters containing "computed cadence"
   - Parse flags array
   - Loop through each flag:
     - Find flag row by ID
     - Get flag-description-col
     - Verify column contains "computed cadence" (case-insensitive)

6. **Search Test 3: BE Name Column** (via `searchAndValidateFlags` helper with exactMatch)
   - Fill app-cond-flag-search-input: "EMPLOYMENT_LETTER_UPLOADED"
   - Wait for GET /flags response with filters containing "EMPLOYMENT_LETTER_UPLOADED"
   - Parse flags array
   - Loop through each flag:
     - Find flag row by ID
     - Get flag-key-col
     - Verify column has EXACT text "EMPLOYMENT_LETTER_UPLOADED" (case-insensitive)

**Key API Endpoints**:
- `POST /auth` - Admin authentication
- `GET /flag-collections?` - Load flag collections
- `GET /flags` - Search flags with filters parameter (3 times with different search terms)

**Business Validations**:
- ✅ Flag search by name works (partial match, case-insensitive)
- ✅ Flag search by description works (partial match, case-insensitive)
- ✅ Flag search by BE name/key works (exact match, case-insensitive)
- ✅ Search triggers real-time API calls with filters parameter
- ✅ API response data matches UI display
- ✅ URL properly encodes search filters
- ✅ Different match modes work (contains vs exact)

**Unique Aspects**:
- Tests **approval conditions search** specifically
- Validates **3 different search fields** (name, description, key)
- Implements **inline helper function** (searchAndValidateFlags)
- Tests **partial vs exact match** modes
- Validates **API-UI consistency** (loops through API response to verify UI)
- Uses **URL parameter validation** (checks filters in query string)
- Tests **case-insensitive search** across all fields

---

### **5. default_applicant_type_override_in_application_workflow_steps.spec.js**

**Purpose**: Validates "Default" applicant type override functionality in workflow configuration - verifies override checkboxes control whether changes propagate to other applicant types

**Configuration**:
- **Organization**: "Verifast"
- **Application**: AutoTest override_applicant_type_{random} (unique per run)
- **Applicant Types**: 7 types (Affordable Occupant, Affordable Primary, Corporate Leasing, Employed, International, Self-Employed, Other)
- **Workflow Template**: "Autotest-suite-fin-only"
- **Flag Collection**: "High Risk"
- **Minimum Amount**: $500
- **Tags**: @regression, @application
- **Execution**: Single test (serial mode, 180s timeout)
- **Cleanup**: afterAll deletes application (always, even on failure)

---

#### **beforeAll Hook: Ensure Workflow Exists**

**Purpose**: Verify workflow template exists, create if missing

**Test Flow**:
1. **Authenticate as Admin via API**
   - Get admin token for API operations

2. **Check Workflow Existence**
   - Use WorkflowBuilder to check if "Autotest-suite-fin-only" exists

3. **Create Workflow if Missing** (via API)
   - Create workflow with Identity + Financial steps
   - Create paths between steps
   - Log completion

**Note**: Ensures workflow template exists in any environment (dev, staging, production)

---

#### **Test: "Test Default Applicant Type Override Options (Financial Step Only)" (QA-215)**

**Purpose**: Verify override checkboxes in "Default" applicant type control whether financial step configuration changes propagate to specific applicant types

**Test Flow**:

**PHASE 1: Login & Application Creation**

1. **Admin Login**
   - Navigate to homepage
   - Fill login form with admin credentials
   - Submit and set locale
   - Verify applicants-menu visible

2. **Create Application**
   - Call createApplicationFlow with config:
     - Organization: "Verifast"
     - Application name: AutoTest override_applicant_type_{random}
     - 7 applicant types
     - Workflow: "Autotest-suite-fin-only"
     - Flag collection: "High Risk"
     - Min amount: $500
   - Store applicationId for cleanup
   - Wait for application table visible
   - Search for newly created application

**PHASE 2: Configure Default Type with Override (Positive Test)**

3. **Navigate to Application Edit**
   - Click edit button
   - Wait for 4 API calls (organizations, portfolios, settings, application details)

4. **Access Financial Verification Workflow**
   - Click submit-application-setup
   - Click "Workflow Setup" step
   - Select "Default" applicant type
   - Click "Financial Verification" workflow step
   - Wait for document configurations API

5. **Verify Override Checkboxes Visible**
   - **Assert**: identity-override-settings visible
   - **Assert**: identity-override-documents visible

6. **Enable Override & Configure Financial Step**
   - Check identity-override-settings checkbox
   - Check identity-override-documents checkbox
   - Fill financial step (via fillFinancialStep helper):
     - Primary Provider: MX
     - Secondary Provider: Plaid
     - Max Connections: 3
     - Retrieve Transaction Type: Debits
     - Min Required Docs: 0
     - Documents: Bank Statement (Always visible, max 3 uploads)
   - Submit and wait for PATCH/POST response

7. **Verify Configuration Saved on Default**
   - Reopen Financial Verification step
   - Verify all settings match initial data (via verifyDetails helper)
   - Verify override checkboxes still visible

**PHASE 3: Verify All Specific Types Inherited Default Settings**

8. **Test Inheritance for All 7 Applicant Types**
   - Loop through each type (affordable-occupant, affordable-primary, corporate-leasing, employed, international, self-employed, other):
     - Click type-{type}
     - Open Financial Verification step (wait for 4 APIs)
     - **Assert**: Override checkboxes NOT visible (confirms type has own saved config)
     - Verify settings match initial default data (via verifyDetailFilled helper)
     - Close modal

**PHASE 4: Update Default WITHOUT Override (Negative Test)**

9. **Return to Default & Update Settings**
   - Click type-default
   - Open Financial Verification step
   - **Checkboxes unchecked by default** (not checked from previous save)
   - **Do NOT check override boxes**
   - Fill with NEW data (via fillFinancialStep helper):
     - Primary Provider: Plaid (changed)
     - Secondary Provider: MX (changed)
     - Max Connections: 2 (changed)
     - Retrieve Transaction Type: Credits (changed)
     - Min Required Docs: 0
     - Documents: Bank Statement (update existing)
   - Submit and wait for PATCH/POST response

**PHASE 5: Verify Changes Only in Default (Proves Override Control)**

10. **Verify Other Types Retained OLD Settings**
    - Loop through each applicant type again (7 iterations):
      - Click type-{type}
      - Open Financial Verification step
      - **Assert**: Settings STILL match OLD initial data (MX, Plaid, 3, Debits)
      - Close modal
    - **Result**: Changes stayed in Default only (override boxes were NOT checked)

**Cleanup**:
11. **Delete Application**
    - afterAll hook calls cleanupApplication
    - Application deleted (always, even on test failure)

**Key API Endpoints**:
- `POST /auth` - Admin authentication
- `GET /organizations?fields[organization]=id,name` - Load organizations
- `GET /portfolios?fields[portfolio]=id,name` - Load portfolios
- `GET /settings?fields[setting]=options,key&fields[options]=label,value` - Load settings
- `GET /organizations` - Load organizations list
- `POST /applications` - Create application
- `PATCH /applications/{id}` - Update workflow template
- `PATCH /applications/{id}` - Update settings (flag collection, rent budget)
- `PATCH /applications/{id}` - Publish to live
- `GET /applications/{id}` - Load application details for edit
- `GET /applications/{id}/steps/{id}/document-configurations` - Load document configs (multiple times)
- `PATCH /applications/{id}/steps/{id}` - Update financial step configuration (2x: with override, without override)
- `DELETE /applications/{id}` - Delete application

**Business Validations**:
- ✅ Override checkboxes appear only when "Default" type is selected
- ✅ Override checkboxes NOT visible on specific applicant types
- ✅ WITH override checked: changes propagate to all 7 applicant types
- ✅ WITHOUT override checked: changes stay in Default only
- ✅ Override controls settings inheritance across applicant types
- ✅ Financial step configuration saves correctly
- ✅ Checkboxes reset to unchecked after save (default behavior)
- ✅ Each applicant type maintains its own configuration after first save
- ✅ Workflow builder ensures workflow exists before test
- ✅ Application creation with 7 types works correctly

**Unique Aspects**:
- Tests **Default applicant type override feature** specifically
- Uses **2 helper functions** (fillFinancialStep, verifyDetails, verifyDetailFilled)
- Tests **positive and negative scenarios** in single test (with override, without override)
- Validates **settings propagation control** via checkboxes
- Tests **7 applicant type iterations** twice (after override ON, after override OFF)
- Uses **WorkflowBuilder** in beforeAll to ensure workflow exists
- Implements **edit-verify-restore pattern** for specific types
- Tests **checkbox state management** (unchecked by default on reopen)
- Validates **configuration inheritance** from Default to specific types
- Cleanup **always executes** (application deleted regardless of test outcome)

---

## **Category 3 Summary**

### **Business Purpose Analysis:**

| Test File | Primary Business Purpose | Key Differences |
|-----------|-------------------------|-----------------|
| `application_create_delete_test` | Full application lifecycle (create → delete) | Tests 6 applicant types, workflow template, flag collection, publishing |
| `application_edit_id_template_settings` | Persona template ID configuration | Tests edit-verify-restore pattern for Persona integration |
| `verify_application_edit_id_step_edit` | Cross-test persistence validation | Tests identity toggle + guarantor value persistence across 2 tests |
| `approval_condition_search_verify` | Flag search functionality | Tests 3 search fields (name/description/key) with partial/exact match |
| `default_applicant_type_override_in_application_workflow_steps` | Default type override control validation | Tests override checkboxes ON/OFF, validates propagation to 7 types (2 iterations), WorkflowBuilder |

**Conclusion**: No overlap - each test validates distinct application management functions

---

## **Category 4: Session Flow Tests - COMPLETE ANALYSIS**

### **Files Analyzed:**
1. `co_applicant_effect_on_session_test.spec.js` - **Co-Applicant Income Aggregation**
2. `frontend-session-heartbeat.spec.js` - **Complete E2E Session Flow**  
3. `application_step_should_skip_properly.spec.js` - **Application Step Skip Functionality**
4. `co_app_household_with_flag_errors.spec.js` - **Co-Applicant Household with Flag Errors**
5. `skip_button_visibility_logic.spec.js` - **Skip Button Visibility Logic Testing**
6. `user_flags_approve_reject_test.spec.js` - **User Flags Approve Reject Test**
7. `check_income_source_regenerate_on_split_merge.spec.js` - **Income Source Regenerate on Split/Merge**

---

### **1. co_applicant_effect_on_session_test.spec.js**

**Purpose**: Validates co-applicant income aggregation and financial impact on parent session

**Configuration**:
- **Application**: "AutoTest Suite - Full Test"
- **User**: Playwright User (playwright+effect@verifast.com)
- **Co-Applicant**: Playwright CoApp (playwright+coapp@verifast.com)
- **Timeout**: 380s
- **Tags**: @regify, @external-integration, @regression, @staging-ready

---

#### **Test: "Should complete applicant flow with co-applicant effect on session"**

**Purpose**: Verify that adding a co-applicant updates parent session's income aggregation, ratios, and financial data correctly

**Test Flow**:

1. **Admin Setup**
   - Login as admin
   - Navigate to applications page
   - Find and invite "AutoTest Suite - Full Test"
   - Generate session for primary applicant

2. **Primary Applicant Flow** (New Browser Context)
   - Open invite link
   - Complete setupInviteLinkSession (terms → applicant type: #affordable_primary → state)
   - Set rent budget: $2500
   - Add co-applicant via household form
   - Click continue on invite step
   - Skip ID verification
   - Complete Plaid (Betterment) with username: 'custom_gig'
   - Complete paystub (Paychex) connection
   - Submit employment step

3. **Admin: Capture Initial Session State**
   - Navigate to applicants/sessions
   - Search for session by ID
   - Click session card to view details
   - Extract initial `monthlyIncome` from session.state.summary.total_income
   - Extract initial `rentBudgetRatio` from session.state.summary.total_target_to_income_ratio
   - Verify session has children array with at least 1 APPLICANT role

4. **Co-Applicant Invite**
   - Click session action button → invite applicant
   - Click reinvite for first child applicant
   - Copy invite link (with clipboard fallback)
   - Close invite modal

5. **Co-Applicant Flow** (New Browser Context)
   - Open co-applicant invite link
   - Get co-applicant session data from response
   - Complete setupInviteLinkSession (terms → applicant type: #affordable_primary → state)
   - Skip ID verification
   - Complete Plaid (Betterment) with username: 'user_bank_income', password: '{}'
   - Complete paystub (Paychex) connection
   - Submit employment step

6. **Admin: Validate Income Aggregation**
   - Reload sessions page
   - Search for parent session
   - Extract updated `monthlyIncome1` and `rentBudgetRatio1`
   - **Assert**: monthlyIncome ≠ monthlyIncome1 (co-app income added)
   - **Assert**: rentBudgetRatio ≠ rentBudgetRatio1 (ratio changed)

7. **Income Sources Validation**
   - Click income source section header
   - Wait for GET /sessions/{id}/income-sources for all sessions (parent + children)
   - For each applicant income source container:
     - Verify at least 1 income source exists

8. **Employment Validation**
   - Click employment section
   - For each applicant employment row:
     - Verify at least 1 employment entry exists

9. **Financial Data Validation**
   - Call checkFinancialSectionData helper
   - Validates financial verifications for all sessions
   - Validates account data across parent and co-applicant

**Key API Endpoints**:
- `POST /auth` - Admin authentication
- `GET /applications?` - Search applications
- `POST /sessions` - Create primary session
- `PATCH /sessions/{id}` - Update session (applicant type, rent budget, steps)
- `POST /applicants` - Create co-applicant
- `GET /sessions?fields[session]` - Load sessions list
- `GET /sessions/{id}?fields[session]` - Get session details (2x: before & after co-app)
- `GET /financial-verifications` - Get financial data for all sessions
- `GET /sessions/{id}/income-sources` - Get income sources for all sessions

**Business Validations**:
- ✅ Co-applicant adds to parent session's children array
- ✅ Parent session income increases after co-app completes
- ✅ Rent budget ratio recalculates with aggregated income
- ✅ Income sources visible for all applicants
- ✅ Employment data visible for all applicants
- ✅ Financial verifications aggregated correctly
- ✅ Clipboard fallback works for invite link copy

**Unique Aspects**:
- Tests **income aggregation** across parent and co-applicant sessions
- Uses **two separate browser contexts** for primary and co-app flows
- Validates **before/after state** of session financial data
- Tests **clipboard with fallback** for invite link
- Uses **different Plaid credentials** for primary vs co-app
- Validates **children array relationship** in session data

---

### **2. frontend-session-heartbeat.spec.js**

**Purpose**: Validates complete E2E applicant session flow including manual upload flows, skip patterns, and session cleanup

**Configuration**:
- **Application**: "Autotest - Application Heartbeat (Frontend)"
- **User**: Random email (Playwright Heartbeat)
- **Co-App**: Random email (PWCoapp Heartbeat)
- **Timeout**: 250s
- **Tags**: @regression, @staging-ready

---

#### **Test: "Verify Frontend session heartbeat"**

**Purpose**: Verify complete applicant journey from invite to summary, testing skip functionality, manual upload cancellation, and income source polling

**Test Flow**:

1. **Admin Session Setup**
   - Login as admin
   - Find and invite "Autotest - Application Heartbeat (Frontend)"
   - Generate session with random email
   - Store sessionId for cleanup
   - Logout admin

2. **Applicant Session Flow**
   - Open invite link (as guest)
   - Complete setupInviteLinkSession (terms → applicant type: #employed → state)
   - Update rent budget: $500

3. **Skip Invite & Navigate Pattern**
   - Skip applicant invite page
   - Verify on ID verification step
   - Click "Applicants" with "Skipped" status to navigate back

4. **Add Co-Applicant**
   - Fill household form with co-app data
   - Use waitForButtonOrAutoAdvance (handles auto-advance or manual click)
   - Verify on ID verification step

5. **ID Verification: Manual Upload Cancel Flow**
   - Click "Start Manual Upload"
   - Verify manual upload modal visible
   - Click cancel
   - Verify back on ID step
   - Skip ID verification

6. **Financial: Manual Upload Cancel Flow**
   - Verify on financial step (connect-bank visible)
   - Click "Upload Statement" button
   - Verify cancel button visible
   - Click cancel
   - Verify back on financial step
   - Skip financials

7. **Employment: Paystub Connection**
   - Verify on employment step (document-pay_stub visible)
   - Complete paystub connection (Paychex iframe)
   - Use waitForButtonOrAutoAdvance for employment step
   - Verify summary page visible

8. **Guest Logout**
   - Click profile dropdown
   - Click logout
   - Verify get-started button visible

9. **Admin Validation**
   - Login as admin
   - Search for session by sessionId
   - Find and click session locator
   - Wait for session response

10. **Income Sources Polling** (Retry Pattern)
    - Loop up to 5 attempts:
      - Scroll container to bottom (trigger lazy load)
      - Wait 3s
      - Check income source SVG counter text
      - If counter = 0 and attempts < 5: reload page
    - Click income source section header
    - Wait for GET /sessions/{id}/income-sources response
    - **Assert**: incomeSources.data.length > 0
    - For each income source: verify element visible

11. **Cleanup**
    - afterAll hook calls cleanupSession with sessionId

**Key API Endpoints**:
- `POST /auth` - Admin authentication (2x: initial + validation)
- `GET /applications?` - Search applications
- `POST /sessions` - Create session
- `PATCH /sessions/{id}` - Update rent budget
- `POST /applicants` - Create co-applicant
- `GET /sessions/{id}?fields[session]` - Get session details (2x: initial + reload)
- `GET /sessions/{id}/income-sources?fields[income_source]` - Get income sources

**Business Validations**:
- ✅ Complete E2E guest flow from invite to summary
- ✅ Manual upload cancellation works for ID and financial steps
- ✅ Skip functionality for invite, ID, and financial steps
- ✅ Co-applicant can be added mid-flow
- ✅ waitForButtonOrAutoAdvance handles auto-advance correctly
- ✅ Paystub iframe connection (Paychex)
- ✅ Guest logout/login flows work
- ✅ Income sources polling with retry mechanism
- ✅ Lazy loading triggered by scroll
- ✅ Session cleanup in afterAll hook

**Unique Aspects**:
- Tests **manual upload cancellation pattern** for ID & financial steps
- Uses **intelligent button helper** (waitForButtonOrAutoAdvance) for auto-advance handling
- Implements **income source polling** with 5-attempt retry logic
- Uses **scroll-to-trigger lazy load** for SVG counter rendering
- Tests **navigation via status badges** (click "Applicants" with "Skipped")
- Includes **centralized cleanup** in afterAll hook
- Uses **random emails** for test isolation

---

### **3. application_step_should_skip_properly.spec.js**

**Purpose**: Validates application step skip/re-navigation patterns and step state persistence

**Configuration**:
- **Application**: "AutoTest Suite - Full Test"
- **User**: Random email (Playwright Skip)
- **Co-App**: Random email (Playwright Skip Coapp)
- **Timeout**: 300s
- **Tags**: @regression, @staging-ready

---

#### **Test: "Check Application step skip works propertly"**

**Purpose**: Verify that users can skip steps, navigate back to skipped/completed steps, change values, and add co-applicants after initial skip

**Test Flow**:

1. **Admin Setup**
   - Login as admin
   - Find and invite "AutoTest Suite - Full Test"
   - Generate session with random email
   - Store sessionId for cleanup
   - Logout admin

2. **Initial Flow with Skips**
   - Open invite link (guest)
   - Complete setupInviteLinkSession (terms → applicant type: #employed → state)
   - Update rent budget: $500
   - Skip invite page
   - Complete ID verification (Persona iframe)
   - Complete Plaid financial (username: 'custom_coffee', password: 'custom_gig')
   - Wait for Plaid connection completion
   - Skip employment step
   - Verify summary page visible

3. **Test Re-Skip Pattern** (Skip → Navigate Back → Skip Again)
   - Click "Applicants" with "Skipped" badge → navigates to invite page
   - Skip invite page again
   - Verify summary page visible

4. **Test Employment Re-Skip**
   - Click "Employment Verification" with "Skipped" badge
   - Skip employment page again
   - Verify summary page visible

5. **Test Re-Edit Completed Step**
   - Click "Rent Budget" with "Completed" badge
   - Update rent budget: $1000
   - Verify summary page visible

6. **Test Complete After Skip**
   - Click "Applicants" with "Skipped" badge
   - Add co-applicant via fillhouseholdForm
   - Click continue button (visible filter)
   - Wait 3s
   - Verify summary page visible
   - Wait 6s (allow async processing)

7. **Test Employment Completion After Skip**
   - Click "Employment Verification" with "Skipped" badge
   - Complete paystub connection (Paychex iframe)
   - Click employment-step-continue
   - Verify summary page visible

8. **Cleanup**
   - Close page
   - afterAll hook calls cleanupSession

**Key API Endpoints**:
- `POST /auth` - Admin authentication
- `GET /applications?` - Search applications
- `POST /sessions` - Create session
- `PATCH /sessions/{id}` - Update session (rent budget 2x: $500, $1000)
- `POST /applicants` - Create co-applicant

**Business Validations**:
- ✅ Users can skip invite and employment steps
- ✅ Skipped steps remain navigable via status badges
- ✅ Re-skipping same step works (no errors)
- ✅ Completed steps can be re-edited (rent budget)
- ✅ Skipped steps can be completed later (invite → add co-app, employment → paystub)
- ✅ Summary page updates after each navigation
- ✅ Step state persists across navigations
- ✅ Badges correctly show "Skipped" vs "Completed"

**Unique Aspects**:
- Tests **re-navigation to skipped steps** via status badges
- Validates **skip → skip again** pattern (no errors)
- Tests **skip → complete** pattern (invite, employment)
- Tests **complete → re-edit** pattern (rent budget)
- Uses **status badge clicks** for navigation (filter by text + visible)
- Includes **wait periods** for async processing (3s, 6s)

---

### **4. co_app_household_with_flag_errors.spec.js**

**Purpose**: Validates household status transitions driven by co-applicant flag lifecycle (GROUP_MISSING_IDENTITY → IDENTITY_NAME_MISMATCH_CRITICAL → resolved)

**Configuration**:
- **Application**: "Autotest - Household UI test"
- **User**: Primary Applicant (primary.applicant@verifast.com)
- **Co-App**: CoApplicant Household (coapplicant.household@verifast.com)
- **Timeout**: 380s
- **Tags**: @regression, @household, @flag-attribution

---

#### **Test: "Should verify co-applicant flag attribution and household status transitions"**

**Purpose**: Verify household approval status transitions (APPROVED ↔ REJECTED) driven by co-app completion state and flag resolution, with API+UI validation at each stage

**Expected State Transitions**:
1. **Primary complete + flags resolved** → APPROVED ("Meets Criteria")
2. **Co-app invited but incomplete** → REJECTED ("Criteria Not Met") + GROUP_MISSING_IDENTITY
3. **Co-app ID complete (name mismatch)** → REJECTED ("Criteria Not Met") + IDENTITY_NAME_MISMATCH_CRITICAL (GROUP_MISSING_IDENTITY gone)
4. **Admin resolves flag** → APPROVED ("Meets Criteria")

**Test Flow**:

1. **Admin Session Setup**
   - Login as admin
   - Find and invite "Autotest - Household UI test"
   - Generate session for primary applicant

2. **Primary Applicant Flow** (API-based - no UI)
   - Open invite link (new browser context)
   - Complete setupInviteLinkSession (terms → applicant type: #affordable_primary → state)
   - Update rent budget: $500
   - Skip applicants step
   - Extract guest token from URL → POST /auth/guests
   - Complete ID via API (completeIdentityStepViaAPI with matching name - passes)
   - Complete Financial via API (completeFinancialStepViaAPI - CUSTOM_PAYLOAD)
   - Complete Employment via API (completeEmploymentStepViaAPI - VERIDOCS_PAYLOAD)
   - Add income source via API ($500) to prevent GROSS_INCOME_RATIO_EXCEEDED

3. **Admin: Resolve Primary Flags & Validate APPROVED**
   - Navigate to sessions page
   - Search and open primary session
   - Open View Details modal
   - Poll for INCOME_SOURCE_CADENCE_MISMATCH_ERROR (max 60s, 2s intervals)
   - Mark flag as non-issue
   - Close modal
   - **ASSERT 1 (API)**: Poll for status = APPROVED (max 30s)
   - **ASSERT 1 (UI)**: Verify "Meets Criteria" banner (poll with reload)

4. **Add Co-Applicant from Primary Context**
   - Return to primary applicant page
   - Click 2nd step-APPLICANTS-lg element → navigate to applicants step
   - Fill household form (add co-app)
   - Click continue to invite co-app
   - Close primary page

5. **Admin: Validate GROUP_MISSING_IDENTITY & REJECTED**
   - Reload admin session page
   - Open View Details modal
   - **ASSERT 2a**: Verify GROUP_MISSING_IDENTITY visible
   - Close modal
   - **ASSERT 2b (API)**: Poll for status = REJECTED (max 30s)
   - **ASSERT 2b (UI)**: Verify "Criteria Not Met" banner (poll)

6. **Co-Applicant ID Completion** (API-based)
   - Extract co-app invite URL from session.data.children
   - Open co-app link (new browser context)
   - Complete setupInviteLinkSession (terms → applicant type: #affordable_primary → state)
   - Extract guest token from URL → POST /auth/guests
   - Complete ID via API with **MISMATCHED name** ("X Y" instead of "CoApplicant Household")
   - Wait 6s for flag creation
   - Close co-app page

7. **Admin: Validate Flag Transition & REJECTED**
   - Reload admin session page
   - Open View Details modal
   - **ASSERT 3a**: Verify GROUP_MISSING_IDENTITY gone (count = 0)
   - **ASSERT 3b**: Verify IDENTITY_NAME_MISMATCH_CRITICAL visible
   - Verify flag text contains "Identity Name Mismatch (Critical)" and co-app name
   - **ASSERT 3c (API)**: Poll for status = REJECTED (max 30s)
   - **ASSERT 3c (UI)**: Verify "Criteria Not Met" banner
   - Mark IDENTITY_NAME_MISMATCH_CRITICAL as non-issue
   - Close modal

8. **Admin: Validate Resolution & APPROVED**
   - **ASSERT 4 (API)**: Poll for status = APPROVED (max 60s, 2s intervals)
   - **ASSERT 4 (UI)**: Verify "Meets Criteria" banner

9. **Test Summary Log**
   - Log all 8 assertions (4 stages × 2 validations each: API + UI)

10. **Cleanup**
    - afterAll hook calls cleanupSessionAndContexts (session + 2 browser contexts)

**Key API Endpoints**:
- `POST /auth` - Admin authentication
- `GET /applications?` - Search applications
- `POST /sessions` - Create session
- `PATCH /sessions/{id}` - Update rent budget
- `POST /auth/guests` - Guest authentication (2x: primary + co-app)
- `POST /sessions/{id}/steps` - Create ID verification step (2x)
- `POST /identity-verifications` - Submit Persona payload (2x)
- `PATCH /sessions/{id}/steps/{stepId}` - Complete steps
- `POST /sessions/{id}/income-sources` - Add income source
- `GET /sessions?fields[session]` - Load sessions
- `GET /sessions/{id}?fields[session]` - Get session details (multiple times)
- `PATCH /sessions/{id}/flags` - Mark flags as non-issue
- `GET /sessions/{id}` - Poll for status changes (multiple times)
- `POST /applicants` - Create co-applicant

**Business Validations**:
- ✅ Household status = APPROVED when primary completes + flags resolved
- ✅ GROUP_MISSING_IDENTITY appears when co-app invited
- ✅ Household status = REJECTED when co-app incomplete
- ✅ GROUP_MISSING_IDENTITY disappears when co-app completes ID
- ✅ IDENTITY_NAME_MISMATCH_CRITICAL appears for name mismatch
- ✅ Household status remains REJECTED with name mismatch flag
- ✅ Household status = APPROVED after resolving co-app flag
- ✅ API status (APPROVED/REJECTED) matches UI status ("Meets Criteria"/"Criteria Not Met")
- ✅ Flags attributed to correct applicant (primary vs co-app)
- ✅ Polling mechanisms work for flags and status (with retry logic)

**Unique Aspects**:
- Tests **4-stage household status lifecycle** with comprehensive API+UI validation
- Uses **API-based identity/financial/employment** completion (completeXStepViaAPI helpers)
- Implements **flag polling** with retry logic (60s for flags, 30s/60s for status)
- Tests **flag lifecycle** (GROUP_MISSING_IDENTITY → IDENTITY_NAME_MISMATCH_CRITICAL → resolved)
- Uses **guest token extraction** from URL + POST /auth/guests authentication
- Tests **name mismatch trigger** (intentional "X Y" vs expected name)
- Validates **API-UI consistency** at each transition (8 total assertions)
- Uses **multi-context management** (admin, primary, co-app contexts)

---

### **5. skip_button_visibility_logic.spec.js**

**Purpose**: Validates skip button visibility logic - skip buttons should disappear after completing actions

**Configuration**:
- **Application**: "Autotest - Full flow skip button test"
- **User**: SkipButton Test (playwright+skipbutton@verifications.com)
- **Co-App**: SkipButton CoApplicant
- **Timeout**: 300s  
- **Tags**: @regression, @external-integration, @staging-ready

---

**Test Flow**:

1. **Admin Setup**
   - Login as admin
   - Find and invite "Autotest - Full flow skip button test"
   - Generate session

2. **Applicant Session Setup**
   - Open invite link (new context with camera permissions)
   - Complete setupInviteLinkSession (terms → applicant type: #affordable_occupant → state)
   - Update rent budget

3. **testSkipButtonVisibility('applicants')** - Helper Function Pattern
   - **Phase 1**: Verify applicant-invite-skip-btn visible
   - **Phase 2**: Fill household form (action that should hide skip)
   - **Phase 3**: Assert skip button NOT visible, continue button visible, click continue

4. **testSkipButtonVisibility('identity')**
   - **Phase 1**: Verify skip-id-verification-btn visible
   - **Phase 2**: Complete identity step (Persona iframe)
   - **Phase 3**: Assert skip button NOT visible, continue button visible, click continue

5. **testSkipButtonVisibility('financial')**
   - **Phase 1**: Verify skip-financials-btn visible
   - **Phase 2**: Complete Plaid financial step + wait for completion
   - **Phase 3**: Assert skip button NOT visible, continue button visible, click continue

6. **testSkipButtonVisibility('employment')**
   - **Phase 1**: Verify employment-step-skip-btn visible
   - **Phase 2**: Complete paystub connection + wait for completion + wait 3s
   - **Phase 3**: Assert skip button NOT visible, continue button visible, click continue

7. **Final Validation**
   - Verify summary page visible ("Summary" heading)
   - Verify all steps show "Complete" status:
     - Rent Budget: Complete
     - Identity Verification: Complete
     - Applicants: Complete
     - Financial Verification: Complete
     - Employment Verification: Complete
   - Close applicant context

**Key API Endpoints**:
- `POST /auth` - Admin authentication
- `GET /applications?` - Search applications
- `POST /sessions` - Create session
- `PATCH /sessions/{id}` - Update rent budget
- `POST /applicants` - Create co-applicant

**Business Validations**:
- ✅ Skip buttons visible before any action (all 4 steps)
- ✅ Skip buttons disappear after completing action (all 4 steps)
- ✅ Continue buttons appear after completing action
- ✅ All steps transition to "Complete" status
- ✅ Summary page displays after all steps complete
- ✅ testSkipButtonVisibility helper pattern works for all step types

**Unique Aspects**:
- Uses **reusable helper function** (testSkipButtonVisibility) for all 4 steps
- Tests **3-phase pattern** (verify visible → action → verify hidden)
- Validates **skip button lifecycle** across entire flow
- Uses **switch statement** for step-specific locators
- Tests **4 different skip buttons** (applicants, ID, financial, employment)
- Includes **error handling** with descriptive error messages

---

### **6. user_flags_approve_reject_test.spec.js**

**Purpose**: Validates flag management workflows (mark as issue/non-issue) and session approve/reject functionality

**Configuration**:
- **Organization**: "Permissions Test Org"
- **Application**: "AutoTest - Flag Issue V2"
- **User 1**: Flag Issue Testing (FlagIssueTesting@verifast.com)
- **User 2**: Approval_reject Testing (ApprovalRejecttesting@verifast.com)
- **Timeout**: 200s per describe
- **Tags**: @core, @smoke, @regression, @staging-ready

---

#### **Test Describe 1: "Session Flag" (2 tests in serial mode)**

**Test 1: "Should create applicant session for flag issue"**

**Purpose**: Create session with VERIDOCS_PAYLOAD simulator for flag testing

**Test Flow**:
- Call createSessionWithSimulator with params:
  - Organization: 'Permissions Test Org'
  - Application: 'AutoTest - Flag Issue V2'
  - User: Flag Issue Testing
  - Rent budget: '2500'
  - State: 'fl'
- Store sessionId in `flagIssueSession`

---

**Test 2: "Check Session Flag"**

**Purpose**: Validate flag management: mark flags as issue/non-issue and verify flag section movements

**Test Flow**:

1. **Admin Login & Navigate**
   - Login as admin
   - Check if applicants-menu already open (smart navigation)
   - Click applicants-submenu
   - Search for session by flagIssueSession ID

2. **Navigate to Session**
   - Navigate to session by ID
   - Verify household-status-alert contains "Unreviewed"

3. **Document Approval Flow** (New requirement for session approval)
   - Click files-section-header
   - Click files-document-status-pill link
   - Wait for decision-modal
   - Click accept button
   - Poll for document status = "Accepted" (max 75s, 1s intervals)

4. **View Details & Validate Flag Sections**
   - Click view-details-btn
   - Call validateFlagSections helper:
     - Verify GROSS_INCOME_RATIO_EXCEEDED in items-causing-decline-section
     - Verify NO_INCOME_SOURCES_DETECTED in items-requiring-review-section

5. **Mark Flag as Issue**
   - Call markFlagAsIssue for NO_INCOME_SOURCES_DETECTED
   - **Assert**: Flag moves to items-causing-decline-section (visible)

6. **Financial Modal Navigation**
   - Close event history modal
   - Click raw-financial-verification-status
   - Verify report-financial-status-modal visible

7. **Mark Flag as Non-Issue**
   - Call markFlagAsNonIssue for MISSING_TRANSACTIONS within financial modal
   - **Assert**: Flag moves to reviewed-items-section (visible, max 30s timeout)

---

#### **Test Describe 2: "Session Approve/Reject" (2 tests in serial mode)**

**Test 3: "Should create applicant session for approve reject"**

**Purpose**: Create second session for approve/reject testing

**Test Flow**:
- Call createSessionWithSimulator with User 2 (Approval_reject Testing)
- Store sessionId in `approveRejectSession`

---

**Test 4: "Check session by Approving and Rejecting"**

**Purpose**: Validate session approve/reject workflow

**Test Flow**:

1. **Admin Login & Navigate**
   - Login as admin
   - Smart navigation (check if menu open)
   - Click applicants-submenu
   - Search for approveRejectSession

2. **Navigate to Session**
   - Navigate to session by ID
   - **Assert**: household-status-alert contains "Unreviewed"

3. **Document Approval** (Prerequisite)
   - Click files-section-header
   - Click files-document-status-pill
   - Accept documents
   - Poll for "Accepted" status (max 75s)
   - Click view-details-btn

4. **Mark All Flags in Items Requiring Review as Issues**
   - Get all flag items (li[id^="flag-"]) in items-requiring-review-section
   - For each flag:
     - Click mark_as_issue button
     - Fill textarea with reason
     - Click "Mark as Issue" button
     - Wait 1s

5. **Close Details & Poll for Status Change**
   - Close event history modal
   - Poll for household-status-alert to NOT contain "Requires Review" (max 60s, 2s intervals)
   - Reload every 5 attempts

6. **Approve/Reject Workflow**
   - Call checkSessionApproveReject helper with sessionId

**Key API Endpoints**:
- `POST /auth` - Admin authentication (2x: test 1 & test 3 session creation via createSessionWithSimulator)
- `GET /applications?` - Search applications (2x for simulator)
- `POST /sessions` - Create sessions (2x: flagIssueSession & approveRejectSession)
- `POST /auth/guests` - Guest authentication (2x for simulator)
- `POST /sessions/{id}/steps` - Create steps (4x: START & FINANCIAL for both sessions)
- `PATCH /sessions/{id}` - Update rent budget (2x for simulator)
- `PATCH /sessions/{id}/steps/{stepId}` - Complete steps (4x)
- `GET /providers` - Get Simulation provider (2x)
- `POST /financial-verifications` - Create financial verifications (2x)
- `GET /sessions?fields[session]` - Search sessions (2x: tests 2 & 4)
- `GET /sessions/{id}?fields[session]` - Navigate to sessions (2x)
- `GET /sessions/{id}/flags` - Get session flags (2x)
- `PATCH /sessions/{id}/flags` - Update flag status (3x: mark issue, mark non-issue, test 4 loop)
- `PATCH /sessions/{id}` - Approve/reject sessions (4x: approve + reject for test 4)

**Business Validations**:
- ✅ Sessions can be created via API simulator (VERIDOCS_PAYLOAD)
- ✅ Flags visible in correct sections (decline vs review)
- ✅ Flags can be marked as issues
- ✅ Marked-as-issue flags move to items-causing-decline-section
- ✅ Flags can be marked as non-issues  
- ✅ Marked-as-non-issue flags move to reviewed-items-section
- ✅ Document approval required before session approval
- ✅ Document status polling works with 75s timeout
- ✅ All flags in review section can be batch-marked as issues
- ✅ Status polling waits for async flag processing (60s max)
- ✅ Sessions can be approved/rejected via checkSessionApproveReject
- ✅ Smart navigation checks menu state before clicking

**Unique Aspects**:
- Uses **serial test mode** (tests depend on previous test's session)
- Uses **createSessionWithSimulator** helper (API-only session creation)
- Tests **flag section movement** (review → decline, review → reviewed)
- Implements **document approval prerequisite** for session approval
- Uses **batch flag marking** (loop through all flags in section)
- Tests **2 separate sessions** in 2 test describes
- Validates **VERIDOCS_PAYLOAD simulator** integration
- Uses **smart menu navigation** (checks if already open)
- Tests **both flag directions** (mark as issue + mark as non-issue)

---

### **7. check_income_source_regenerate_on_split_merge.spec.js**

**Purpose**: Validates income source regeneration when sessions are merged and split - verifies income sources are correctly aggregated after merge and independently regenerated after split

**Configuration**:
- **Application**: "Autotest - Heartbeat Test - Financial"
- **Primary User**: Merge Primary (random email via `getRandomEmail()`)
- **Co-Applicant User**: Merge Coapp (random email via `getRandomEmail()`)
- **Timeout**: 300 seconds
- **Tags**: @needs-review

---

#### **Test: "Verify Regenerate Income After Merge/Split"**

**Purpose**: Verify that income sources correctly aggregate when two sessions are merged and independently regenerate when merged sessions are split back into separate households

**Test Flow**:

1. **Admin Setup**
   - Login as admin via `adminLoginAndNavigate` (capture adminToken for API calls)
   - Navigate to applications menu → applications submenu
   - Find and invite "Autotest - Heartbeat Test - Financial" application

2. **Primary Applicant Setup**
   - Generate session with primary user data (Merge, Primary, random email)
   - Store primary sessionId (`priSessionId`) and invite link (`priLink`)
   - Prepare primary bank data via `getBankData(primaryUser)`:
     - Institution: Wells Fargo
     - Account type: Checking
     - Account number: ending in 4565
     - Balance: default from mock data
     - 5 transactions with various amounts
   - Complete session via `completeSession` helper (new browser context):
     - Navigate to invite link
     - Complete `setupInviteLinkSession` (no applicant type - financial-only app)
     - Update rent budget (default from helper)
     - Skip pre-screening step
     - Complete financial verification with VERIDOCS simulator:
       - Click connect-bank button
       - Accept dialog with primary bank data JSON payload
       - Wait for POST `/financial-verifications` response
       - Poll for simulator connection completion (15 iterations, 2s interval)
     - Click financial-verification-continue button
     - Close applicant page

3. **Co-Applicant Setup**
   - Bring admin page to front
   - Open invite modal for same application
   - Generate session with co-applicant user data (Merge, Coapp, random email)
   - Store co-applicant sessionId (`coAppSessionId`) and invite link (`coAppLink`)
   - Prepare co-applicant bank data via `getBankData(coAppUser)` with modifications:
     - Account number: '9123456780' (different from primary)
     - Balance: 25000 (different from primary)
     - Transaction amounts: [12000, 12000] (different from primary)
   - Complete session via `completeSession` helper (new browser context):
     - Same flow as primary (setupInviteLinkSession → rent budget → skip pre-screening → financial verification)
     - Use modified co-applicant bank data
     - Close applicant page

4. **Pre-Merge Verification**
   - Bring admin page to front
   - Navigate to applicants menu → applicants submenu
   - **Verify Co-Applicant Income**:
     - Navigate to co-applicant session detail page via `navigateToSessionDetail`
     - Call `checkIncomeSourcesAndAssertVisibility` helper:
       - Click income-source-section-header
       - Wait for GET `/sessions/{coAppSessionId}/income-sources` response
       - Verify all income sources visible in UI
   - **Verify Primary Applicant Income**:
     - Navigate to primary session detail page via `navigateToSessionDetail`
     - Call `checkIncomeSourcesAndAssertVisibility` helper:
       - Click income-source-section-header
       - Wait for GET `/sessions/{priSessionId}/income-sources` response
       - Verify all income sources visible in UI

5. **Merge Sessions**
   - Navigate back to applicants list view
   - Call `mergeSessions` helper:
     - Search for 'merge' (clears filters)
     - Navigate to primary session
     - Select both sessions via checkboxes (primary + co-applicant)
     - Click merge-session-btn
     - Confirm merge in modal (click Merge button)
     - Wait for PATCH `/sessions/{priSessionId}` response
     - Wait for GET `/sessions/{priSessionId}?fields[session]=` response

6. **Post-Merge Verification**
   - Navigate to primary session detail page via `navigateToSessionDetail`
   - Reload page and wait for networkidle
   - Fetch session data via isolated API GET request using `adminToken`:
     - GET `/sessions/{priSessionId}?fields[session]=id,applicant,children`
     - Verify session has children array with co-applicant
   - **Verify Combined Income Sources**:
     - Click income-source-section-header
     - Wait for parallel GET responses:
       - Primary income sources: GET `/sessions/{priSessionId}/income-sources`
       - Co-applicant income sources: GET `/sessions/{coAppSessionId}/income-sources`
     - Extract income sources arrays from both responses
     - Call `verifyIncomeSourceDetails` for primary applicant:
       - Verify first income source visible
       - Verify source type: "Financial Transactions"
       - Verify description matches primary transaction description
       - Verify last transaction date matches primary transaction date
       - Verify income type: "Employment Transactions"
       - Open income source details modal
       - Verify transaction table visible
       - Verify all transactions match primary bank data (amounts, descriptions, dates)
       - Close modal
     - Call `verifyIncomeSourceDetails` for co-applicant:
       - Verify first income source visible
       - Verify source type, description, dates match co-applicant data
       - Open income source details modal
       - Verify all transactions match co-applicant bank data
       - Close modal

7. **Verify Combined Financial Data**
   - Expand financial-section-header
   - Wait for parallel GET responses:
     - Primary financial verifications: GET `/financial-verifications` with session.id filter
     - Co-applicant financial verifications: GET `/financial-verifications` with coAppSessionId filter
   - Extract financial verifications arrays from both responses
   - Call `checkFinancialAccountData` for primary:
     - Verify account number (last 4 digits)
     - Verify account type: "Checking"
     - Verify institution name: Wells Fargo
     - Verify applicant name matches primary user
     - Verify balance matches primary bank data (formatted via `getAmount`)
     - Verify transaction count matches primary transactions array length
     - Verify provider: "Simulation"
   - Call `checkFinancialAccountData` for co-applicant:
     - Verify account number, type, institution match co-applicant data
     - Verify applicant name matches co-applicant user
     - Verify balance matches co-applicant bank data (25000)
     - Verify transaction count matches co-applicant transactions
   - Switch to transactions radio button
   - Call `financialTransactionVerify` for primary:
     - Verify transaction table visible
     - Loop through primary transactions:
       - Verify date column contains transaction date
       - Verify description column contains transaction description
       - Verify paid_in column contains formatted amount (via `getAmount`)
       - Verify account column contains "Checking"
       - Verify institution column contains institution name
   - Filter by co-applicant name via `fillMultiselect`:
     - Fill multiselect with co-applicant full name
     - Use substring matching (case-insensitive) for applicant name
   - Call `financialTransactionVerify` for co-applicant:
     - Verify transaction table shows only co-applicant transactions
     - Verify all transaction data matches co-applicant bank data

8. **Split Sessions**
   - Call `splitSession` helper:
     - Locate co-applicant section via `raw-{coAppSessionId}`
     - Click overview-applicant-btn
     - Click split-into-new-household-btn
     - Confirm split in confirm-box modal
     - Wait for DELETE `/sessions/{priSessionId}/children/{coAppSessionId}` response
   - Navigate to primary session via session link
   - Wait for household-status-alert to be visible
   - Reload page and wait for networkidle
   - Wait for household-status-alert again (ensures UI updated)
   - **Poll for split completion**:
     - Poll every 2 seconds (up to 8 attempts, 16 seconds max)
     - For each poll:
       - GET `/sessions/{priSessionId}?fields[session]=id,applicant,children` via API with `adminToken`
       - Extract children array from response
       - **Assert**: children.length === 0 (split complete)
       - If children.length === 0: break polling loop
       - If children.length > 0: continue polling
     - **Assert**: splitComplete === true (throws error if not complete after 15s)

9. **Post-Split Verification**
   - **Verify Primary Income (Independent Again)**:
     - Call `checkIncomeSourcesAndAssertVisibility` for primary session
     - Verify income sources visible and match original primary data only
   - Navigate back to applicants list view
   - **Verify Co-Applicant Income (Independent Session)**:
     - Navigate to co-applicant session detail page
     - Call `checkIncomeSourcesAndAssertVisibility` for co-applicant session
     - Verify income sources visible and match original co-applicant data only

10. **Cleanup**
    - afterAll hook calls `cleanupSession` for both `priSessionId` and `coAppSessionId`

**Key API Endpoints**:
- `POST /auth` - Admin authentication (returns adminToken)
- `GET /applications?` - Search applications
- `POST /sessions` - Create sessions (2x: primary + co-applicant)
- `POST /auth/guests` - Guest authentication (2x: primary + co-applicant)
- `PATCH /sessions/{id}` - Update rent budget (2x)
- `PATCH /sessions/{id}/steps/{id}` - Skip pre-screening step (2x)
- `POST /financial-verifications` - Upload bank statements (2x via VERIDOCS simulator)
- `GET /sessions/{id}/income-sources` - Get income sources (multiple times for both sessions)
- `GET /sessions/{id}?fields[session]=` - Get session details (multiple times, includes children field)
- `GET /financial-verifications` - Get financial verifications (multiple times for both sessions)
- `PATCH /sessions/{priSessionId}` - Merge sessions (link co-app to primary)
- `DELETE /sessions/{priSessionId}/children/{coAppSessionId}` - Split sessions (remove child relationship)

**Business Validations**:
- ✅ Primary applicant can complete session with financial verification
- ✅ Co-applicant can complete separate session with different bank data
- ✅ Income sources generate correctly from bank transactions for both applicants
- ✅ Income sources are independent before merge (separate sessions)
- ✅ Sessions can be merged (primary + co-applicant linked)
- ✅ After merge, both applicants' income sources visible on parent session page
- ✅ Income source details match original bank transaction data for each applicant
- ✅ Financial account data displays correctly for both applicants after merge
- ✅ Financial transactions filter correctly by applicant name (multiselect)
- ✅ Sessions can be split (co-applicant becomes independent again)
- ✅ Split completion verified via API polling (children array empty)
- ✅ After split, primary income sources independent (no co-app data)
- ✅ After split, co-applicant income sources independent in new session
- ✅ Admin token can be reused for multiple API calls
- ✅ Polling mechanism works for split completion verification

**Unique Aspects**:
- Tests **income source regeneration** during merge/split lifecycle
- Uses **2 browser contexts** for primary and co-applicant flows
- Implements **admin token capture** from initial login for API polling
- Uses **isolated API GET requests** with authentication token (decoupled from UI)
- Tests **merge workflow** (select sessions → merge button → confirm modal)
- Tests **split workflow** (co-app section → split button → confirm modal)
- Implements **split completion polling** (checks children array via API, 8 attempts max)
- Uses **substring matching** in `fillMultiselect` for applicant name filtering (handles "Autotest -" prefix)
- Validates **income source details modal** for both applicants (transaction table verification)
- Validates **financial transactions table** with applicant name filtering
- Tests **currency formatting** via `getAmount` helper throughout
- Uses **inline helper functions** (`completeSession`, `navigateToSessionDetail`, `checkIncomeSourcesAndAssertVisibility`, `mergeSessions`, `splitSession`, `verifyIncomeSourceDetails`, `checkFinancialAccountData`, `financialTransactionVerify`)
- Validates **both sessions cleaned up** in afterAll hook

---

## **Category 4 Summary**

### **Business Purpose Analysis:**

| Test File | Primary Business Purpose | Key Differences |
|-----------|-------------------------|-----------------|
| `co_applicant_effect_on_session_test` | Income aggregation across household | Tests before/after co-app income, validates aggregation math, 2 browser contexts |
| `frontend-session-heartbeat` | E2E applicant journey with cleanup | Tests manual upload cancellation, polling for income sources, afterAll cleanup |
| `application_step_should_skip_properly` | Step re-navigation patterns | Tests skip→skip, skip→complete, complete→edit patterns via status badges |
| `co_app_household_with_flag_errors` | Household status lifecycle (4 stages) | API-based completion, 8 assertions (API+UI), flag transition validation |
| `skip_button_visibility_logic` | Skip button UI visibility rules | Tests visible→action→hidden pattern for 4 steps, reusable helper function |
| `user_flags_approve_reject_test` | Flag management workflows | 2 sessions in serial mode, batch flag marking, document approval prerequisite |
| `check_income_source_regenerate_on_split_merge` | Income source regeneration on merge/split | Tests merge→aggregate→split→independent pattern, API polling for split completion, admin token reuse |

**Conclusion**: No overlap - each test validates distinct session flow patterns and workflows

---

## **Category 5: Document Processing Tests**

### **Files Analyzed:**
1. `document_rejection_from_any_state.spec.js` - **Document Rejection from Any Processing State**
2. `show-paystub-deposit-in-document-extracted-section.spec.js` - **Paystub Deposit Display in Document Extracted Section**

---

### **1. document_rejection_from_any_state.spec.js**

**Purpose**: Validates document rejection functionality from any processing state (PENDING, CLASSIFIED, CLASSIFYING, UPLOADED, COMPLETED)

**Configuration**:
- **Application**: "AutoTest - Doc Rejec for any state test"
- **User**: Random email (Test User)
- **Timeout**: 180s
- **Tags**: @needs-review

---

#### **Test: "Reject a Document Regardless of Processing State"**

**Purpose**: Verify documents can be rejected/failed/accepted regardless of current processing state

**Test Flow**:

1. **Admin Setup**
   - Login as admin
   - Find and invite "AutoTest - Doc Rejec for any state test"
   - Generate session with random email
   - Store sessionId for cleanup

2. **Applicant Flow** (New Context)
   - Open invite link (with camera/microphone permissions + fake media stream)
   - Complete setupInviteLinkSession (terms → applicant type: #affordable_occupant → state)
   - Update rent budget: $1500
   - Verify on financial verification step
   - **Keep page open** (don't complete financial)

3. **Admin: Navigate to Session**
   - Switch to admin page
   - Navigate to applicants/sessions
   - Search for session by ID
   - Click session card
   - Wait for session + files responses

4. **Upload Document #1 (Test Pre-Processed Rejection)**
   - Switch to applicant page
   - Call uploadFinancialStatement helper:
     - Click financial-upload-statement-btn
     - Upload test_bank_statement.pdf
     - Wait 2.5s for client-side processing
     - Click submit → wait for POST /financial-verifications + GET responses
     - Return financialVerification data

5. **Reject Document in Pre-Processed State**
   - Switch to admin page
   - Reload files tab (GET /sessions/{id}/files)
   - Loop through files:
     - If status in ['PENDING', 'CLASSIFIED', 'CLASSIFYING', 'UPLOADED']:
       - Call failDocument helper (click pill → decision-modal → processing-btn)
       - Verify status changes to "Failed"

6. **Upload Document #2 (Test Post-Processed Rejection)**
   - Upload another financial statement
   - Call waitForConnectionCompletion (wait for full processing)

7. **Accept → Reject Cycle on Processed Document**
   - Reload files tab
   - Find file row for 2nd uploaded file
   - Poll for status = "Rejected" (max 5 attempts, 5s intervals, reload each time)
   - **Assert**: Status contains "Rejected" (max 20s timeout)
   - Call acceptDocument helper:
     - Click pill → decision-modal → accept-btn → wait for GET response
     - **Assert**: Status = "Accepted"
   - Call rejectDocument helper:
     - Click pill → decision-modal → reject-btn → wait for GET response
     - **Assert**: Status = "Rejected"

8. **Cleanup**
   - afterAll hook calls cleanupSessionAndContexts (session + applicant context)

**Key API Endpoints**:
- `POST /auth` - Admin authentication
- `GET /applications?` - Search applications
- `POST /sessions` - Create session
- `PATCH /sessions/{id}` - Update rent budget
- `POST /financial-verifications` - Upload financial statements (2x)
- `GET /financial-verifications` - Get verification status
- `GET /sessions/{id}?fields[session]` - Get session details
- `GET /sessions/{id}/files?fields[file]` - Get files list (multiple times with reload)

**Business Validations**:
- ✅ Documents can be uploaded via manual financial statement upload
- ✅ Documents in pre-processed states (PENDING, CLASSIFIED, etc.) can be failed
- ✅ Documents can be processed completely
- ✅ Fully processed documents can be accepted
- ✅ Accepted documents can be rejected (status override)
- ✅ File status transitions tracked correctly (Failed, Accepted, Rejected)
- ✅ Decision modal works for fail/accept/reject actions
- ✅ Files tab reloads and displays current status
- ✅ Polling for document processing completion works

**Unique Aspects**:
- Tests **document rejection from multiple states** (pre-processed & post-processed)
- Uses **3 helper functions** (uploadFinancialStatement, failDocument, rejectDocument, acceptDocument)
- Tests **Accept → Reject override** on processed documents
- Implements **status polling** for document processing (5 attempts, 5s intervals)
- Uses **fake media stream** for camera/microphone permissions
- Tests **file status lifecycle** across different processing states
- Validates **decision modal** actions for all 3 outcomes (fail/accept/reject)

---

### **2. show-paystub-deposit-in-document-extracted-section.spec.js**

**Purpose**: Validates that paystub deposit information is correctly displayed in the document extracted section when viewing uploaded paystub documents

**Configuration**:
- **Application**: "Autotest - Heartbeat Test - Employment"
- **User**: Test User (test.user@verifast.com)
- **Rent Budget**: $500
- **Tags**: @regression
- **Timeout**: Default (no explicit timeout set)

---

#### **Test: "Verify Display Paystub Deposits in Document → Extracted Section"**

**Purpose**: Verify that deposit information (account names and amounts) from uploaded paystub documents is correctly displayed in the extracted section of the document viewer modal

**Test Flow**:

1. **Admin Setup**
   - Login as admin via `adminLoginAndNavigateToApplications`
   - Navigate to applications page
   - Find and invite "Autotest - Heartbeat Test - Employment" application
   - Generate session with user data (Test, User, test.user@verifast.com)
   - Extract sessionId, sessionUrl, and invite link
   - Store sessionId for cleanup

2. **Applicant Context Setup**
   - Create new browser context for applicant
   - Navigate to invite link
   - Intercept `/auth/guest` response to capture guest authentication token (stored in `guestAuthToken` variable)
   - Validate token was captured (throws error if missing)

3. **Applicant Initial Setup**
   - Complete `setupInviteLinkSession` (terms → applicant type → state)
   - Update rent budget to $500 via `updateRentBudget`
   - Wait for pre-screening step visibility
   - Skip pre-screening questions (click skip button, wait for PATCH response)

4. **First Paystub Upload**
   - Wait for employment verification step visibility
   - Prepare mock paystub data via `createPaystubData(1)`:
     - Employer: "FOLIAGE FACTORY LANDSCAPE, INC."
     - Employee: "Roberto Almendarez Cruz"
     - Gross pay: $888, Net pay: $792.80
     - **Deposit 1**: "CHECKING Acct: ************9647", Amount: $792.80
   - Upload paystub via `uploadVeridocsDoc` helper:
     - Click `document-pay_stub` tile
     - Click `employment-upload-paystub-btn`
     - Wait for browser dialog prompt
     - Accept dialog with JSON payload: `{ documents: [paystubData] }`
     - Click `employment-simulation-upload-btn`
     - Wait for POST `/employment-verifications` response
     - Extract verification ID from response
     - **Poll for verification COMPLETED status** via `pollForVerificationStatus`:
       - Uses captured `guestAuthToken` for API authentication
       - Max 20 attempts, 2s interval
       - Endpoint: `employment-verifications`

5. **Admin: Verify First Upload Deposits**
   - Switch to admin page
   - Navigate to applicants menu → applicants submenu
   - Search for session by sessionId
   - Click session card (wait for GET /sessions/{id} and GET /sessions/{id}/files responses)
   - Extract files array from response
   - **Assert**: files.data.length > 0
   - Get first file from files array
   - Call `checkDeposits` helper for first file:
     - Expand files section (check aria-expanded, click if needed)
     - Find file row by `all-tr-{file.id}`
     - Click `all-files-view-btn` to open document modal
     - Verify `view-document-modal` visible
     - Verify `paystub-extracted-section` visible
     - Get `paystub-deposit-col` element
     - Loop through `paystubData.documents[0].data.deposits`:
       - **Assert**: deposit column contains account name
       - **Assert**: deposit column contains formatted amount (via `getAmount` helper)
     - Close modal via `view-document-modal-cancel`

6. **Second Paystub Upload (With Additional Deposit)**
   - Switch to applicant page
   - Add new deposit to paystub data:
     - Account: "CHECKING Acct: ************4565"
     - Amount: $12943.32
   - Upload updated paystub via `uploadVeridocsDoc` helper (same flow as first upload)
   - Poll for verification COMPLETED status again

7. **Admin: Verify Second Upload Deposits**
   - Switch to admin page
   - Reload page (wait for GET /sessions/{id} and GET /sessions/{id}/files responses)
   - Extract files array again
   - **Assert**: files.data.length > 0
   - Find second file (file where id !== firstFile.id)
   - **Assert**: second file exists (throws error if not found)
   - Call `checkDeposits` helper for second file:
     - Verify both deposits visible (original + new deposit)
     - Verify account names and amounts match expected values

8. **Cleanup**
   - afterAll hook calls `cleanupSession` with sessionId and test result flag

**Key API Endpoints**:
- `POST /auth` - Admin authentication
- `GET /applications?` - Search applications
- `POST /sessions` - Create session
- `POST /auth/guests` - Guest authentication (token captured for polling)
- `PATCH /sessions/{id}` - Update rent budget
- `PATCH /sessions/{id}/steps/{id}` - Skip pre-screening step
- `POST /employment-verifications` - Upload paystub document
- `GET /employment-verifications?filters=` - Poll for verification status (with auth token)
- `GET /sessions/{id}?fields[session]=` - Get session details (multiple times)
- `GET /sessions/{id}/files` - Get files list (multiple times)

**Business Validations**:
- ✅ Paystub documents can be uploaded via VERIDOCS simulator dialog
- ✅ Deposit information is extracted from paystub documents correctly
- ✅ Deposit account names display correctly in extracted section
- ✅ Deposit amounts display correctly (formatted currency) in extracted section
- ✅ Multiple deposits from same paystub all display correctly
- ✅ Updated paystub with additional deposits shows all deposits (original + new)
- ✅ Document viewer modal opens correctly from files section
- ✅ Paystub extracted section is visible in document modal
- ✅ Files section expansion/collapse state management works
- ✅ Guest authentication token can be captured for API polling
- ✅ Verification status polling works with authentication token
- ✅ Multiple file uploads tracked correctly (first vs second file)

**Unique Aspects**:
- Tests **paystub deposit extraction and display** specifically
- Uses **VERIDOCS simulator dialog** for paystub upload (browser prompt accepts JSON payload)
- Implements **guest token capture** from `/auth/guest` response for authenticated API polling
- Uses **pollForVerificationStatus helper** with authentication token for status polling
- Tests **multiple deposits** in single paystub document
- Validates **deposit updates** (adding new deposit to existing data and re-uploading)
- Uses **inline helper functions** (`checkDeposits`, `uploadVeridocsDoc`)
- Validates **currency formatting** via `getAmount` helper
- Checks **section expansion state** before clicking (aria-expanded attribute)
- Tests **file tracking** across multiple uploads (first vs second file identification)

---

## **Category 5 Summary**

### **Business Purpose Analysis:**

| Test File | Primary Business Purpose | Key Differences |
|-----------|-------------------------|-----------------|
| `document_rejection_from_any_state` | Document lifecycle management | Tests rejection from any state, accept→reject override, status polling |
| `show-paystub-deposit-in-document-extracted-section` | Paystub deposit extraction display | Tests deposit information display in extracted section, multiple deposits, guest token capture for polling |

**Conclusion**: 2 tests in this category - validates document decision workflow and paystub deposit extraction display

---

## **Category 6: System Health Tests**

### **Files Analyzed:**
1. `frontend_heartbeat.spec.js` - **Frontend UI Health Check**
2. `heartbeat_completed_application_click_check.spec.js` - **Application Click Health Check**

---

### **1. frontend_heartbeat.spec.js**

**Purpose**: Validates complete frontend UI health including sidebar navigation, session actions, and section dropdowns

**Configuration**:
- **Application**: "Autotest - UI permissions tests"
- **User**: Heartbeat Test (dynamic email: `heartbeat-test-{timestamp}@verifast.com`)
- **Rent Budget**: $2,500
- **Session Creation**: beforeAll hook (complete session with all steps enabled)
- **Cleanup**: afterAll hook via cleanupSessionAndContexts
- **Tags Test 1**: @core, @smoke, @regression, @staging-ready
- **Tags Test 2**: @core, @smoke, @regression, @critical

---

#### **Test 1: "Should check frontend heartbeat"**

**Purpose**: Verify all sidebar menus, submenus, and page titles are accessible

**Test Flow**:
1. **Admin Login**
   - Navigate to homepage
   - Fill login form
   - Submit and set locale to English
   - Verify household-status-alert visible

2. **Header & Profile Menu Check**
   - Call checkHeaderAndProfileMenu helper:
     - Verify header visible
     - Click user-dropdown-toggle-btn
     - Verify user-profile-dropdown-item visible
     - Verify user-logout-dropdown-item visible
     - Click profile link (2x toggle)
     - Verify "User Profile" text visible
     - Click applicants-submenu

3. **Complete Sidebar Navigation**
   - Call checkSidebarMenusAndTitles helper:
     - Tests 13 main menus with their submenus
     - Validates page titles for each submenu
     - Checks menu expansion/collapse behavior

**Key API Endpoints**:
- `POST /auth` - Admin authentication
- `GET /users/self` - Get user data (for locale setting)
- `PATCH /users/{id}` - Set locale to English

**Business Validations**:
- ✅ All sidebar menus visible and clickable
- ✅ All submenus accessible
- ✅ Page titles load correctly for each section
- ✅ Header and profile menu functional
- ✅ User locale can be set to English
- ✅ Menu expansion logic works correctly

---

#### **beforeAll Hook: Create Complete Session**

**Purpose**: Create a complete session with all steps for testing action buttons and section dropdowns

**Test Flow**:
1. **Create Admin Context & Page**
   - Create new browser context for admin
   - Open new page and navigate to homepage

2. **Create Complete Session via createPermissionTestSession**
   - **Application**: "Autotest - UI permissions tests"
   - **User**: Heartbeat Test (email: `heartbeat-test-{timestamp}@verifast.com`)
   - **Rent Budget**: $2,500
   - **All steps enabled by default**:
     - completeIdentity: true (Persona UI with real images)
     - completeFinancial: true (VERIDOCS bank statement)
     - completeEmployment: true (ATOMIC employment data)
     - addChildApplicant: true
   - Store sessionId globally as `sharedSessionId`
   - Store applicantContext for cleanup
   - Store adminContext for cleanup
   - Close admin page (keep contexts for cleanup)

**Result**: Complete session ready for testing with all verification data populated

---

#### **Test 2: "Should test session actions and section dropdowns"**

**Purpose**: Verify session action buttons and collapsible section headers function correctly

**Test Flow**:

1. **Admin Login**
   - Navigate to homepage
   - Fill login form
   - Submit and set locale to English
   - Verify household-status-alert visible

2. **Navigate to Applicants Inbox**
   - Check if applicants-menu already open (smart navigation)
   - If not open, click to expand
   - Click applicants-submenu
   - Wait 2s for page load

3. **Navigate to Shared Session**
   - Call navigateToSessionById with `sharedSessionId` from beforeAll
   - Navigate to session detail page (submenu: 'all')
   - Verify household-status-alert visible

4. **Test Action Dropdown Buttons**
   - Click session-action-btn
   - Call testDropdownButtons helper:
     - Verify each button visible and enabled:
       - approve-session-btn
       - reject-session-btn
       - invite-applicant
       - trigger-pms-upload-btn
       - upload-document-btn
       - request-additional-btn
       - income-source-automation-dropdown-item

5. **Test View Details Modal**
   - Call testViewDetailsModal helper:
     - Click view-details-btn
     - Verify report-view-details-flags-section visible
     - Click close-event-history-modal

6. **Test Section Headers (Expand/Collapse)**
   - For each section header (6 total):
     - identity-section-header
     - income-source-section-header
     - files-section-header
     - employment-section-header
     - financial-section-header
     - integration-logs-section-header
   - For each:
     - Verify header visible
     - Click to expand
     - **Assert**: arrow has class `-rotate-90`
     - **Assert**: section content visible
     - Click to collapse
     - **Assert**: arrow has class `rotate-90`

**Key API Endpoints**:
- **beforeAll**: Via createPermissionTestSession helper:
  - `POST /auth` - Admin authentication
  - `GET /applications?` - Find application
  - `POST /sessions` - Create session
  - `POST /auth/guests` - Guest authentication
  - `POST /sessions/{id}/steps` - Create steps (identity, financial, employment)
  - `GET /providers` - Get Simulation provider (2x for financial & employment)
  - `POST /financial-verifications` - Upload VERIDOCS bank statement (6 transactions)
  - `POST /employment-verifications` - Upload ATOMIC employment data
  - `PATCH /sessions/{id}/steps/{stepId}` - Mark steps as COMPLETED (2x)
  - `GET /sessions/{id}` - Poll for step transitions
- **Test Flow**:
  - `POST /auth` - Admin authentication
  - `GET /users/self` - Get user data
  - `PATCH /users/{id}` - Set locale to English
  - `GET /sessions?fields[session]` - Search sessions by ID
  - `GET /sessions/{id}?fields[session]` - Navigate to session by ID
- **afterAll**:
  - `POST /auth` - Admin authentication for cleanup
  - `GET /sessions/{id}?fields[session]=id,children` - Get session details
  - `DELETE /sessions/{child_id}` - Delete co-applicants
  - `DELETE /sessions/{id}` - Delete primary session

**Business Validations**:
- ✅ **Complete session creation via API/UI** (identity + financial + employment)
- ✅ Session action dropdown contains all 7 expected buttons
- ✅ All action buttons visible and enabled
- ✅ View Details modal opens and closes correctly
- ✅ All 6 section headers expand/collapse correctly
- ✅ Arrow rotation classes update on toggle (-rotate-90 vs rotate-90)
- ✅ Section content visibility toggles correctly
- ✅ Smart menu navigation (checks if already open)
- ✅ **Conditional cleanup** (session deleted only if all tests pass)

**Unique Aspects**:
- **Creates complete session in beforeAll** (NEW - not searching existing sessions)
- Uses **createPermissionTestSession helper** for full session setup with real verification data
- Tests **session detail UI** with populated data (identity images, bank statement, employment)
- Uses **2 helper functions** (testDropdownButtons, testViewDetailsModal)
- Tests **13 main menus** with complete navigation coverage
- Validates **arrow rotation animations** (CSS class changes)
- Tests **7 action buttons** in dropdown
- Validates **6 collapsible sections**
- **Shared session pattern**: beforeAll creates, tests use, afterAll cleans up
- **Context management**: Tracks applicant & admin contexts for proper cleanup
- Tests **smart navigation** pattern (check menu state before clicking)

---

### **2. heartbeat_completed_application_click_check.spec.js**

**Purpose**: Validates completed application click behavior - opening session in new tab from admin view and navigating through completed steps

**Configuration**:
- **Application**: "Autotest - UI permissions tests"
- **User**: Heartbeat ClickTest
- **Rent Budget**: $600
- **Timeout**: 300s (beforeAll hook)
- **Tags**: @regression, @staging-ready

---

#### **Test: "Heartbeat Test: Completed Application Clicks (frontend)"**

**Purpose**: Verify that clicking a completed session from admin opens it correctly in new tab and all step navigations work

**Test Flow**:

1. **beforeAll: Create Shared Session**
   - Create admin page (manual context - page fixture not available in beforeAll)
   - Call createPermissionTestSession helper with:
     - Application: 'Autotest - UI permissions tests'
     - User: Heartbeat ClickTest
     - Rent budget: '600'
   - Store sessionId in sharedSessionId (shared across all tests in describe)
   - Close admin context

2. **Admin Login**
   - Navigate to homepage
   - Login with admin credentials

3. **Prepare Session for Fresh Selection**
   - Call prepareSessionForFreshSelection helper:
     - Deselects any currently selected session
     - Searches for target session
     - Returns session locator

4. **Open Session in Admin View**
   - Click session locator
   - Wait for GET /sessions/{id}?fields[session] response
   - Extract session data

5. **Open Session in New Tab (Popup)**
   - Get session row (raw-{sessionId})
   - Click overview-applicant-btn button in name column
   - Click view-applicant-session-btn
   - Wait for popup event → newPage created
   - Wait for newPage to load

6. **Handle Terms (If Present)**
   - Call handleOptionalTermsCheckbox on newPage
   - Verify summary-step visible

7. **Navigate to Rent Budget (Completed Step)**
   - Click step-START-lg (visible filter)
   - Verify rent-budget-step visible
   - Update rent budget: $600
   - Verify summary-step visible

8. **Navigate to ID Verification (Completed Step)**
   - Click step-IDENTITY_VERIFICATION-lg (visible filter)
   - Verify identify-step visible
   - Verify "Completed" text visible within step

9. **Navigate to Financial Verification**
   - Click step-FINANCIAL_VERIFICATION-lg (visible filter)
   - Verify financial-verification-step visible
   - Verify connect-bank visible

10. **Navigate to Employment Verification**
    - Click step-EMPLOYMENT_VERIFICATION-lg (visible filter)
    - Verify employment-verification-step visible
    - Click employment-step-continue
    - Verify summary-step visible

11. **Cleanup**
    - afterAll hook calls cleanupSession with sharedSessionId

**Key API Endpoints**:
- `POST /auth` - Admin authentication
- `GET /sessions/{id}?fields[session]` - Get session details
- `PATCH /sessions/{id}` - Update rent budget

**Business Validations**:
- ✅ Completed sessions open in new tab via view-applicant-session-btn
- ✅ prepareSessionForFreshSelection ensures clean selection state
- ✅ Popup window opens correctly with session data
- ✅ Terms checkbox can be handled if present
- ✅ All completed step badges are clickable
- ✅ Step navigation works (START, IDENTITY, FINANCIAL, EMPLOYMENT)
- ✅ Completed steps display "Completed" status
- ✅ Rent budget can be re-edited on completed session
- ✅ Summary page accessible from all steps
- ✅ Shared session pattern works (beforeAll creation)

**Unique Aspects**:
- Uses **beforeAll hook** to create shared session (avoids recreation)
- Tests **popup window behavior** (new tab from admin view)
- Uses **prepareSessionForFreshSelection** helper (deselect + search pattern)
- Validates **step badge navigation** on completed session
- Tests **re-editing completed step** (rent budget)
- Uses **visible filter** for step badge clicks
- Tests **session reusability** across test lifecycle
- Uses **createPermissionTestSession** helper (full API-based session creation)

---

## **Category 6 Summary**

### **Business Purpose Analysis:**

| Test File | Primary Business Purpose | Key Differences |
|-----------|-------------------------|-----------------|
| `frontend_heartbeat` | System-wide UI health check | Tests all 13 menus, 7 action buttons, 6 section toggles, **beforeAll creates complete session** |
| `heartbeat_completed_application_click_check` | Completed session navigation | Tests popup behavior, step re-navigation, beforeAll shared session |

**Conclusion**: No overlap - one tests system UI with complete session, other tests completed session interaction patterns. Both now use beforeAll session creation + afterAll cleanup.

---

## **Category 7: Workflow Management Tests**

### **Files Analyzed:**
1. `applicant_edits_a_workflow_used_by_another_applicant.spec.js` - **Workflow Isolation Testing**
2. `applicant_type_workflow_affordable_occupant.spec.js` - **Affordable Occupant Workflow Testing**

---

### **1. applicant_edits_a_workflow_used_by_another_applicant.spec.js**

**Purpose**: Validates workflow isolation - editing a workflow in one application shouldn't affect other applications using the same workflow template

**Configuration**:
- **Organization**: "Verifast"
- **App 1**: AutoTest Edit_1_{Browser}_{RandomNumber} (generated unique name)
- **App 2**: AutoTest Edit_2_{Browser}_{RandomNumber} (generated unique name)
- **Both Apps Config**:
  - Applicant Types: 6 types (Affordable Occupant, Affordable Primary, Employed, International, Self-Employed, Other)
  - Workflow Template: "Autotest-suite-fin-only"
  - Flag Collection: "High Risk"
  - Minimum Amount: $500
- **Timeout**: 200s
- **Tags**: @core, @regression, @staging-ready

---

#### **Test: "Should edit a workflow used by another applicant and only reflects changes to current"**

**Purpose**: Verify that removing an applicant type from App 1's workflow doesn't affect App 2's workflow (workflow isolation)

**Test Flow**:

1. **Admin Login**
   - Login as admin
   - Navigate to applications page

2. **Generate Unique Names**
   - App 1: generateUniqueName('AutoTest Edit_1')
   - App 2: generateUniqueName('AutoTest Edit_2')

3. **Create Application #1**
   - Call createApplicationFlow with app1Config
   - Store applicationId as app1Id

4. **Create Application #2**
   - Call createApplicationFlow with app2Config  
   - Store applicationId as app2Id

5. **Edit Application #1: Remove Applicant Type**
   - Call searchAndEditApplication with:
     - Application name: app1Name
     - removeApplicantType: 'Other'
     - applicationId: app1Id

6. **Verify Workflow Isolation**
   - Call searchAndVerifyApplication for App 2 → returns 6 applicant types
   - Call searchAndVerifyApplication for App 1 → returns 5 applicant types
   - **Assert**: App 2 applicant type count > App 1 count (6 > 5)

7. **Cleanup**
   - afterEach hook:
     - Delete app1 using searchAndDeleteApplication (with app1Id)
     - Delete app2 using searchAndDeleteApplication (with app2Id)

**Key API Endpoints**:
- `POST /auth` - Admin authentication
- `POST /applications` - Create applications (2x)
- `PATCH /applications/{id}` - Edit application (remove applicant type)
- `DELETE /applications/{id}` - Delete applications (2x in cleanup)

**Business Validations**:
- ✅ Multiple applications can share same workflow template
- ✅ Editing workflow in one application doesn't affect others
- ✅ Applicant types can be removed from application
- ✅ Workflow isolation maintained across applications
- ✅ Unique names prevent parallel test conflicts
- ✅ Cleanup handles both successful and failed test cases

**Unique Aspects**:
- Tests **workflow isolation** between applications
- Uses **generateUniqueName** for parallel test safety
- Creates **2 identical applications** with same workflow
- Tests **applicant type removal** in one app
- Validates **other app unchanged** (isolation proof)
- Uses **applicationId for robust deletion** in cleanup
- Tests **shared workflow template** behavior

---

### **2. applicant_type_workflow_affordable_occupant.spec.js**

**Purpose**: Validates affordable occupant applicant type workflow completion through ID verification step

**Configuration**:
- **Application**: "AutoTest Suite - Full Test"
- **User**: Affordable Test (affordable@verifast.com)
- **Applicant Type**: Affordable Occupant (#affordable_occupant)
- **Rent Budget**: $555
- **Timeout**: 450s
- **Tags**: @core, @regression, @staging-ready

---

#### **Test: "Should complete applicant flow with affordable occupant applicant type"**

**Purpose**: Verify affordable occupant applicant type can complete full flow (setup → rent budget → skip invite → ID verification)

**Test Flow**:

1. **Admin Login**
   - Navigate to app URL
   - Fill login form
   - Submit and set locale to English
   - Verify applicants-menu visible

2. **Navigate to Applications**
   - Click applications-menu
   - Click applications-submenu
   - Wait 700ms
   - Call gotoApplicationsPage

3. **Find and Invite Application**
   - Find "AutoTest Suite - Full Test"
   - Click invite button

4. **Generate Session**
   - Fill session form with user data
   - Submit form → wait for POST /sessions response
   - Store sessionId for cleanup
   - Get session invite link
   - Close modal

5. **Applicant Flow**
   - Navigate to invite link
   - Wait 8s for page load
   - Complete setupInviteLinkSession (terms → applicant type: #affordable_occupant → state)

6. **Complete Rent Budget**
   - Call completeApplicantForm with rent: $555
   - Wait 4s

7. **Skip Applicants Step**
   - Verify applicant-invite-skip-btn visible
   - Click skip button

8. **Complete ID Verification**
   - Verify start-id-verification visible
   - Call identityStep (Persona iframe flow)

9. **Cleanup**
   - afterAll hook calls cleanupSession

**Key API Endpoints**:
- `POST /auth` - Admin authentication
- `GET /users/self` - Get user data
- `PATCH /users/{id}` - Set locale to English
- `GET /applications?` - Search applications
- `POST /sessions` - Create session
- `PATCH /sessions/{id}` - Update session (applicant type, rent budget)

**Business Validations**:
- ✅ Affordable occupant applicant type selectable
- ✅ Affordable occupant workflow progresses through all steps
- ✅ Rent budget can be set for affordable occupant
- ✅ Applicants step can be skipped
- ✅ ID verification works for affordable occupant type
- ✅ Persona iframe integration functional
- ✅ Session creation and cleanup work correctly

**Unique Aspects**:
- Tests **affordable_occupant applicant type** specifically
- Uses **completeApplicantForm** helper (rent budget)
- Tests **skip invite step** pattern
- Validates **specific applicant type workflow** (not generic)
- Uses **8s wait** for initial page load
- Uses **4s wait** after rent budget

---

## **Category 7 Summary**

### **Business Purpose Analysis:**

| Test File | Primary Business Purpose | Key Differences |
|-----------|-------------------------|-----------------|
| `applicant_edits_a_workflow_used_by_another_applicant` | Workflow isolation validation | Creates 2 apps, edits 1, verifies other unchanged |
| `applicant_type_workflow_affordable_occupant` | Affordable occupant workflow | Tests specific applicant type through ID verification |

**Conclusion**: No overlap - one tests isolation, other tests specific applicant type workflow

---

## **Category 8: Integration Tests**

### **Files Analyzed:**
1. `hosted_app_copy_verify_flow_plaid_id_emp_skip.spec.js` - **Hosted Application Integration Flow**
2. `pdf_download_test.spec.js` - **PDF Download Integration Test**
3. `request_additional_information.spec.js` - **Document Request Integration Test**

---

### **1. hosted_app_copy_verify_flow_plaid_id_emp_skip.spec.js**

**Purpose**: Validates hosted application flow with phone login, registration, ID verification, and Plaid integration with skip patterns

**Configuration**:
- **Application**: "AutoTest Suite Hshld-ID-Emp-Fin with skips"
- **User**: Phone number (random 613292XXXX), teset testrelogin
- **State**: ALASKA
- **Rent Budget**: $500
- **Timeout**: 180s
- **Tags**: @smoke, @regression, @needs-review, @external-integration

---

#### **Test: "Should complete hosted application flow with id emp skips and Plaid integration"**

**Purpose**: Verify hosted app flow with phone auth, registration form, ID upload (passport), employment skip, and Plaid financial connection

**Test Flow**:

1. **Admin: Copy Application URL**
   - Login as admin
   - Navigate to applications page
   - Call findAndCopyApplication for "AutoTest Suite Hshld-ID-Emp-Fin with skips"
   - Extract application URL from clipboard (or fallback)
   - Logout admin

2. **Guest: Phone Login Flow**
   - Navigate to application URL (hosted app)
   - Generate random phone: 613292{4 random digits}
   - Fill phone-input
   - Click get-started-btn
   - Fill 6-digit verification code: "123456" (each digit in separate input)
   - Submit code

3. **Guest: Complete Registration Form**
   - Call completeApplicantRegistrationForm with:
     - firstName: 'teset'
     - lastName: 'testrelogin'
     - state: 'ALASKA'

4. **Complete Rent Budget**
   - Wait for rent_budget input visible (timeout: 16s)
   - Fill rent budget: $500
   - Submit form

5. **Skip Applicants**
   - Call skipApplicants helper

6. **Complete ID Verification**
   - Call completeIdVerification(page, true) - with passport upload

7. **Skip Employment**
   - Call skipEmploymentVerification helper

8. **Complete Plaid Financial**
   - Call plaidFinancialConnect helper

9. **Verify Summary & Statuses**
   - **Assert**: "Summary" heading visible
   - Verify statuses (using filter chain):
     - Rent Budget: Complete
     - Identity Verification: Complete  
     - Applicants: Skipped
     - Employment Verification: Skipped
   - **Assert**: "Missing Financial Transactions" error visible

**Key API Endpoints**:
- `POST /auth` - Admin authentication
- `GET /applications?` - Search applications

**Business Validations**:
- ✅ Hosted application URL copyable from applications page
- ✅ Phone-based login works (6-digit verification code)
- ✅ Registration form completion works
- ✅ State selection (ALASKA) functional
- ✅ Rent budget can be set ($500)
- ✅ Applicants step can be skipped
- ✅ ID verification with passport upload works
- ✅ Employment can be skipped
- ✅ Plaid integration functional
- ✅ Summary displays correct statuses (Complete vs Skipped)
- ✅ "Missing Financial Transactions" error shown when expected

**Unique Aspects**:
- Tests **hosted application flow** (public URL, no session invite)
- Uses **phone-based authentication** (not email invite)
- Tests **6-digit verification code** entry (separate inputs)
- Uses **registration form** (different from session invite flow)
- Tests **clipboard copy** for application URL (with fallback)
- Validates **passport upload** in ID verification
- Tests **mixed completion** (complete ID, skip employment)
- Verifies **financial transaction error** display

---

### **2. pdf_download_test.spec.js**

**Purpose**: Validates PDF export functionality using a minimal session created specifically for the test

**Configuration**:
- **Application**: "Autotest - UI permissions tests"
- **User**: PDFTest Export (dynamic email: `pdf-test-{timestamp}@verifast.com`)
- **Rent Budget**: $2,500
- **Session Type**: MINIMAL (only created, no steps completed)
- **Session Creation**: beforeAll hook (minimal session - completeIdentity/Financial/Employment/ChildApplicant all false)
- **Cleanup**: afterAll hook via cleanupSessionAndContexts
- **Timeout**: 300s (beforeAll)
- **Tags**: @core, @regression, @staging-ready

---

#### **beforeAll Hook: Create Minimal Session**

**Purpose**: Create minimal session with just session creation (no verification steps) for PDF export testing

**Test Flow**:
1. **Create Admin Context & Page**
   - Create new browser context for admin
   - Open new page and navigate to homepage

2. **Create Minimal Session via createPermissionTestSession**
   - **Application**: "Autotest - UI permissions tests"
   - **User**: PDFTest Export (email: `pdf-test-{timestamp}@verifast.com`)
   - **Rent Budget**: $2,500
   - **Minimal configuration** (all verification steps disabled):
     - completeIdentity: false
     - completeFinancial: false
     - completeEmployment: false
     - addChildApplicant: false
   - **Result**: Session created and stopped after rent budget (before applicant invite step)
   - Store sessionId globally as `sharedSessionId`
   - Store applicantContext for cleanup
   - Store adminContext for cleanup
   - Close admin page (keep contexts for cleanup)

**Note**: Minimal session enables testing PDF export functionality without requiring full verification flow

---

#### **Test: "Should successfully export PDF for an application"**

**Purpose**: Verify PDF export works for the created minimal session

**Test Flow**:

1. **Staff Login**
   - Navigate to homepage
   - Login as staff user (staff+testing@verifast.com)
   - Submit and set locale to English
   - Verify applicants-menu visible

2. **Navigate to Applicants Inbox**
   - Check if applicants-menu already open (smart navigation)
   - If not open, click to expand
   - Click applicants-submenu
   - Wait 2s for page load

3. **Navigate to Shared Session**
   - Call navigateToSessionById with `sharedSessionId` from beforeAll
   - Navigate to session detail page (submenu: 'applicants')
   - Wait 1s for session to load

4. **Export PDF**
   - Call checkExportPdf helper with sessionId
   - Helper actions:
     - Click export button
     - Wait for modal
     - Click income-source-delist-submit
     - Wait for GET /sessions?session_ids[]={id} with content-type: application/pdf
     - Wait for popup event
     - **Assert**: Content-Type = 'application/pdf'
     - Close popup

**Key API Endpoints**:
- **beforeAll**: Via createPermissionTestSession helper:
  - `POST /auth` - Admin authentication
  - `GET /applications?` - Find application
  - `POST /sessions` - Create minimal session
  - **Note**: Minimal session stops after rent budget, no verification steps executed
- **Test Flow**:
  - `POST /auth` - Staff authentication
  - `GET /users/self` - Get user data
  - `PATCH /users/{id}` - Set locale to English
  - `GET /sessions?fields[session]` - Search sessions by ID
  - `GET /sessions/{id}?fields[session]` - Navigate to session by ID
  - `GET /sessions?session_ids[]={id}` - Download PDF (content-type: application/pdf)
- **afterAll**:
  - `POST /auth` - Admin authentication for cleanup
  - `DELETE /sessions/{id}` - Delete session (no co-applicants in minimal session)

**Business Validations**:
- ✅ **Minimal session creation** (just rent budget, no verifications needed for PDF)
- ✅ Staff users can login and access sessions
- ✅ PDF export works for minimal sessions
- ✅ PDF download works (application/pdf content-type)
- ✅ Popup window opens for PDF view
- ✅ **Conditional cleanup** (session deleted only if test passes)
- ✅ Export button accessible via checkExportPdf helper

**Unique Aspects**:
- **Creates minimal session in beforeAll** (NEW - not searching existing sessions)
- Uses **createPermissionTestSession with all steps disabled** (most efficient for PDF test)
- Tests **PDF export integration** specifically
- Tests **staff user login** (not admin)
- Validates **content-type header** (application/pdf)
- Tests **popup window** for PDF display
- **No verification data needed** (PDF export works for minimal sessions)
- **Shared session pattern**: beforeAll creates minimal, test uses, afterAll cleans up
- **Context management**: Tracks applicant & admin contexts for proper cleanup
- Uses **browser-specific handling** (chromium vs others)

---

### **3. request_additional_information.spec.js**

**Purpose**: Validates document request workflow with comprehensive validation (happy path + negative tests for permissions, error handling, state safety)

**Configuration**:
- **Application**: "AutoTest - Request Doc UI test"
- **User**: ReqDocs Primary (playwright+reqdocs@verifast.com)
- **Rent Budget**: Default
- **Timeout**: 360s
- **Tags**: @request-docs, @integration, @permissions, @state-safety, @negative, @validation, @network-error, @regression, @staging-ready

---

#### **Test: "Document Request: Complete validation (happy path + negative tests)"**

**Purpose**: Comprehensive validation of document request feature including API/UI validation, state safety, and error handling

**Test Flow**:

**PART 1: HAPPY PATH**

1. **Admin: Create Session**
   - Login as admin (capture adminToken for API calls)
   - Find and invite "AutoTest - Request Doc UI test"
   - Generate session
   - Store sessionId

2. **Applicant: Advance to Employment Step** (Separate Context)
   - Open invite link
   - Complete setupInviteLinkSession (no applicant type)
   - Update rent budget
   - Skip applicants step
   - Authenticate guest (extract token from URL → POST /auth/guests → get primaryAuthToken)
   - Complete ID via API (PERSONA payload, matching name)
   - Skip financial step
   - Wait for employment step (document-pay_stub visible)
   - **Keep page at employment step** (don't complete)

3. **Capture Baseline Step State**
   - GET /sessions/{id} via API with adminToken
   - Extract baselineStepId and baselineStepType
   - Log current step

4. **Admin: Request Additional Documents**
   - Switch to admin page
   - Navigate to session report view
   - Setup request/response listeners for POST /sessions/{id}/invitations (status: 201)
   - Call openAndSubmitRequestDialog helper:
     - Click session-action-btn → request-additional-btn
     - Select "Pay Stub Upload" from combobox
     - Submit
   - Capture POST payload and validate:
     - actions[0].action = 'employment_document'
     - actions[0].documents contains 'pay_stub'
   - Capture response and validate:
     - response._type = 'invitation'
     - response.type = 'SESSION_ACTION'
     - Extract invitationId

5. **Validate Invitation Persistence**
   - GET /sessions/{id}/invitations/{invitationId} with adminToken
   - **Assert**: id matches, type = 'SESSION_ACTION', created_at defined

6. **Validate Session Actions Created**
   - GET /sessions/{id} with fields[session]=actions
   - **Assert**: actions array has EMPLOYMENT_DOCUMENT action
   - **Assert**: action.documents contains 'pay_stub'
   - **Assert**: action.status = 'REQUESTED'

7. **Validate Events Created**
   - GET /sessions/{id}/events
   - Find 'session.information_requested' event
   - Find 'action.requested' event
   - Validate both events have correct titles, descriptions, meta, triggered_by

8. **Validate Events in UI**
   - Navigate to session report view
   - Click view-details-btn
   - Search events for "requested"
   - **Assert**: "Information requested" heading visible
   - **Assert**: "Session action requested" heading visible

9. **CRITICAL: Verify Step State Unchanged**
   - GET /sessions/{id} via API
   - **Assert**: current_step.id = baselineStepId (unchanged)
   - **Assert**: current_step.type = baselineStepType (unchanged)

10. **Verify Applicant Can Continue**
    - Switch to applicant page
    - Complete employment via API (no auto-complete)
    - **Assert**: employment-step-continue button visible and enabled
    - Click continue → verify step completion
    - **Assert**: Document request did NOT block flow

11. **Close Applicant Context**

**PART 2: NEGATIVE TESTS**

12. **Negative Test 1: Submit Disabled Without Selection**
    - Re-login as admin
    - Navigate to session
    - Open request dialog
    - **Assert**: submit-request-additional has aria-disabled='true'

13. **Negative Test 2: Button Stays Disabled**
    - **Assert**: aria-disabled remains 'true' (no action possible)

14. **Negative Test 3: Network Error Handling (500 Response)**
    - Select "Pay Stub Upload" option
    - Setup route intercept for POST /sessions/*/invitations → return 500 error
    - Click submit
    - Unroute after request
    - **Assert**: Error alert visible with text matching /error|failed|unable/i
    - Close dialog

15. **Cleanup**
    - afterAll: cleanupSession + close applicantContext

**Key API Endpoints**:
- `POST /auth` - Admin authentication (returns adminToken)
- `GET /applications?` - Search applications
- `POST /sessions` - Create session
- `PATCH /sessions/{id}` - Update rent budget
- `POST /auth/guests` - Guest authentication (returns primaryAuthToken)
- `POST /sessions/{id}/steps` - Create ID step
- `POST /identity-verifications` - Submit Persona payload
- `PATCH /sessions/{id}/steps/{id}` - Complete steps
- `POST /sessions/{id}/invitations` - Request documents (status: 201)
- `GET /sessions/{id}/invitations/{id}` - Get invitation details
- `GET /sessions/{id}` - Get session with actions field
- `GET /sessions/{id}/events` - Get session events

**Business Validations**:
- ✅ Document requests create invitations (POST /invitations)
- ✅ Invitations persist with correct type (SESSION_ACTION)
- ✅ Session actions created with EMPLOYMENT_DOCUMENT key
- ✅ Actions have correct documents array (pay_stub)
- ✅ Actions status = REQUESTED
- ✅ Events created (session.information_requested + action.requested)
- ✅ Events visible in UI with correct titles
- ✅ Step state UNCHANGED after document request (critical)
- ✅ Applicant can continue flow (no blocking)
- ✅ Submit button disabled without selection
- ✅ Network errors show user-friendly alert
- ✅ Two helper functions (authenticateGuestFromInvite, openAndSubmitRequestDialog)

**Unique Aspects**:
- Uses **2-part test structure** (happy path + negative tests)
- Tests **document request end-to-end** (invitation → action → events)
- Validates **state safety** (step unchanged after request)
- Uses **error collection pattern** (collects all errors, reports at end)
- Tests **network error handling** (route interception for 500)
- Validates **API + UI consistency** for events
- Uses **inline helper functions** (authenticateGuestFromInvite, openAndSubmitRequestDialog)
- Tests **text variation handling** (Paystub vs Pay Stub Upload)
- Includes **commented negative test** for unfinished permission feature

---

## **Category 8 Summary**

### **Business Purpose Analysis:**

| Test File | Primary Business Purpose | Key Differences |
|-----------|-------------------------|-----------------|
| `hosted_app_copy_verify_flow_plaid_id_emp_skip` | Hosted app phone auth flow | Phone login, registration form, clipboard copy, passport upload |
| `pdf_download_test` | PDF export functionality | **beforeAll creates minimal session**, staff user, content-type validation, afterAll cleanup |
| `request_additional_information` | Document request workflow | 2-part test, state safety validation, error collection, network error handling |

**Conclusion**: No overlap - each tests distinct integration point (hosted app, PDF export, document request). pdf_download_test now uses beforeAll/afterAll pattern for session management.

---

## **Category 9: Menu Heartbeat Tests**

### **Files Analyzed:**
1. `heartbeat_addresses_menus.spec.js` - 26 lines
2. `heartbeat_applicant_inbox_menus.spec.js` - 147 lines
3. `heartbeat_applications_menus.spec.js` - 176 lines
4. `heartbeat_documents_menus.test.js` - 90 lines
5. `heartbeat_income_source_menus.spec.js` - 61 lines
6. `heartbeat_logout_menu.spec.js` - 37 lines
7. `heartbeat_org_list_menus.spec.js` - 28 lines
8. `heartbeat_organizations_menus.spec.js` - 88 lines
9. `heartbeat_reports_menus.spec.js` - 51 lines
10. `heartbeat_settings_menus.spec.js` - 52 lines
11. `heartbeat_tools_menus.spec.js` - 53 lines
12. `heartbeat_transactions_menus.spec.js` - 55 lines
13. `heartbeat_users_menu.spec.js` - 47 lines

**Total: 911 lines read across all menu heartbeat tests**

---

### **Common Pattern Across All Menu Tests:**

**Tags**: @core, @smoke, @regression, @critical, @staging-ready

**Standard Flow**:
1. Admin login
2. Check if menu expanded (smart navigation)
3. Click menu if not expanded
4. Click submenu(s)
5. Wait for API response(s)
6. Verify data loads and displays correctly

**Key Validations**:
- ✅ Menu expansion/collapse state detection
- ✅ Smart navigation (don't click if already active)
- ✅ API responses match UI display
- ✅ Page titles/headings visible
- ✅ Table data matches API response

**Test-Specific Highlights**:

- **addresses**: Simple menu click (coming soon page)
- **applicant_inbox**: Tests 4 submenus (all, requires review, meets criteria, rejected) with complex filter validation
- **applications**: Tests 5 submenus (applications, portfolios, workflows, affordable templates, approval conditions)
- **documents**: Tests documents + document policies (documents submenu has coming soon page)
- **income_source**: Order-independent validation using navigateToSubMenu helper
- **logout**: Tests logout flow + reload persistence
- **org_list**: Tests organizations list using verifyListContent helper
- **organizations**: Tests organization-self + members submenus
- **reports**: Tests 4 report submenus (sessions, verifications, files, income sources) with nested property validation
- **settings**: Tests 4 submenus (account, devices, notifications, 2FA)
- **tools**: Tests 4 submenus (document tester, name tester, integrations, test setup)
- **transactions**: Tests 4 submenus (tags, keywords, blacklists, provider mapping)
- **users**: Tests 3 submenus (users, roles, permissions)

---

## **Category 9 Summary**

### **Business Purpose Analysis:**

| Test File | Submenus Tested | Key Validations |
|-----------|----------------|-----------------|
| All 13 menu heartbeat tests | 30+ submenus total | Menu accessibility, API-UI consistency, page titles, data display |

**Conclusion**: All tests are health checks ensuring UI navigation and data display remain functional across all menu sections

---

## **Category 10: Data Management Tests**

### **Files Analyzed:**
1. `create_multiple_remarks.spec.js` - **Income Source Remarks Management**

---

### **1. create_multiple_remarks.spec.js**

**Purpose**: Validates income source remarks (comments) creation, visibility toggle (hide/unhide), ordering, and API-UI consistency

**Configuration**:
- **Application**: "Autotest - Heartbeat Test - Financial"
- **User**: Remarks Primary (playwright+remarks@verifast.com)
- **Timeout**: 180s
- **Tags**: @core, @smoke, @regression

---

#### **Test: "Should allow creating multiple remarks successfully" (QA-191)**

**Purpose**: Verify income source remarks can be created, hidden/unhidden, and displayed in correct chronological order with author/timestamp validation

**Test Flow**:

1. **Admin: Create Session**
   - Login as admin (capture adminToken)
   - Navigate to applications
   - Find and invite "Autotest - Heartbeat Test - Financial"
   - Generate session
   - Store sessionId

2. **Applicant: Complete Financial Step** (Separate Context)
   - Open invite link
   - Complete setupInviteLinkSession (no applicant type)
   - Update rent budget
   - Skip pre-screening step (question step)
   - Call simulatorFinancialStepWithVeridocs with veriDocsBankStatementData
   - **Session now has financial data with income sources**

3. **Admin: Navigate to Session**
   - Switch to admin page
   - Click applicants-menu → applicants-submenu
   - Search for session by ID
   - Navigate to session by ID

4. **Create 3 Remarks** (Reverse Chronological Order)
   - Click income-source-section-header
   - Click first income-source-detail-btn
   - Create remark #1 (r1): "R1 - first remark – {timestamp}"
   - Create remark #2 (r2): "R2 - second remark – {timestamp}"
   - Create remark #3 (r3): "R3 - third remark – {timestamp}"

5. **View Remarks & Validate API Response**
   - Click "View Remarks" button
   - Wait for GET /income-sources/{id}/comments?order=created_at:desc response
   - **Assert**: remarks in API response match created remarks (newest first: r3, r2, r1)
   - **Assert**: Each remark authored by admin.email

6. **Validate Remarks Visible in UI**
   - **Assert**: r1 text visible
   - **Assert**: r2 text visible
   - **Assert**: r3 text visible

7. **Validate Remark Order**
   - Get income-reviews-modal
   - Get all remark-row elements (visible filter)
   - **Assert**: nth(0) contains r3 (newest)
   - **Assert**: nth(1) contains r2
   - **Assert**: nth(2) contains r1 (oldest)

8. **Validate Timestamp/Author Display**
   - Loop through visible comments:
     - Find remark-row-{commentId}
     - **Assert**: Contains formatted timestamp (formatIsoToPrettyDate)
     - **Assert**: Contains comment text
     - **Assert**: Contains author full_name

9. **Test Hide Functionality**
   - Click hide-comment-btn on r2 (nth(1))
   - Wait for PATCH /income-sources/{id}/comments/{id} response
   - **Assert**: r3 visible at nth(0)
   - **Assert**: r1 visible at nth(1) (r2 hidden)

10. **Test Toggle Hidden Comments ON**
    - Click toggle-hidden-comments-btn
    - **Assert**: r3 at nth(0), r2 at nth(1) (shown as hidden), r1 at nth(2)

11. **Test Toggle Hidden Comments OFF**
    - Click toggle again
    - **Assert**: r3 at nth(0), r1 at nth(1) (r2 hidden again)

12. **Test Unhide Functionality**
    - Toggle hidden comments ON
    - Click unhide-comment-btn on r2 (nth(1))
    - Wait for PATCH response
    - Toggle hidden comments OFF
    - **Assert**: All 3 remarks visible (r3, r2, r1)

13. **Close Modals**
    - Close income-reviews-modal
    - Close income-source-details modal

**Key API Endpoints**:
- `POST /auth` - Admin authentication (returns adminToken)
- `GET /applications?` - Search applications
- `POST /sessions` - Create session
- `PATCH /sessions/{id}` - Update rent budget
- `GET /income-sources/{id}/comments?order=created_at:desc&limit=20&page=1&fields[income_source]=comments&fields[member]=user` - Get remarks
- `PATCH /income-sources/{id}/comments/{id}` - Hide/unhide remarks (2x)

**Business Validations**:
- ✅ Multiple remarks can be created sequentially
- ✅ Remarks ordered by created_at DESC (newest first)
- ✅ Remarks authored correctly (admin.email)
- ✅ Timestamp formatting matches UI display
- ✅ Author full_name displays correctly
- ✅ Hide functionality works (PATCH updates is_hidden)
- ✅ Hidden remarks don't display by default
- ✅ Toggle shows/hides hidden remarks
- ✅ Unhide functionality works (restores visibility)
- ✅ Multiple hide/unhide/toggle cycles work correctly
- ✅ Simulator financial step creates income sources

**Unique Aspects**:
- Tests **income source remarks** (comments) specifically
- Creates **3 timestamped remarks** with specific naming pattern
- Uses **inline helper function** (formatIsoToPrettyDate) for timestamp formatting
- Tests **hide/unhide toggle** with multiple cycles
- Validates **chronological ordering** (newest first)
- Tests **author attribution** to admin user
- Uses **veriDocsBankStatementData** mock payload
- Tests **simulatorFinancialStepWithVeridocs** helper
- Validates **API-UI timestamp consistency**

---

## **Category 10 Summary**

### **Business Purpose Analysis:**

| Test File | Primary Business Purpose | Key Differences |
|-----------|-------------------------|-----------------|
| `create_multiple_remarks` | Income source remarks management | Tests creation, hide/unhide, ordering, timestamp/author validation |

**Conclusion**: Only 1 test in this category - validates complete remarks lifecycle

---

# 🎉 **COMPREHENSIVE UI TEST ANALYSIS - REFACTORING COMPLETE**

## **Final Summary:**

✅ **All 10 Categories Refactored**
✅ **All line references removed**
✅ **All API Endpoints Coverage tables removed**
✅ **All "Key Insights", "Technical Setup Analysis", "Conclusion for Category X" sections removed**
✅ **Business Purpose Analysis tables updated and concise**
✅ **Non-existent test files deleted** (5 total)
✅ **Application/Organization/Role names shown in documentation**

---

## **Category-by-Category Results:**

| Category | Tests Refactored | Tests Deleted | Total Lines Read |
|----------|------------------|---------------|------------------|
| 1: Authentication & Permission | 5 | 0 | ~800 |
| 2: Financial Verification | 4 | 1 | ~600 |
| 3: Application Management | 5 | 0 | ~1,050 |
| 4: Session Flow | 6 | 1 | ~2,400 |
| 5: Document Processing | 1 | 3 | ~350 |
| 6: System Health | 2 | 0 | ~300 |
| 7: Workflow Management | 2 | 0 | ~200 |
| 8: Integration | 3 | 0 | ~800 |
| 9: Menu Heartbeat | 13 | 0 | ~900 |
| 10: Data Management | 1 | 0 | ~230 |
| **TOTAL** | **42 tests** | **5 deleted** | **~7,630 lines** |

---

**Methodology followed for EVERY test:**
1. ✅ Read test file (line 1 to end)
2. ✅ Identify ALL utilities used
3. ✅ Read ALL utility lines used
4. ✅ Refactor documentation section

**Documentation is now:**
- ✅ Clear and concise
- ✅ Easy to navigate
- ✅ Accurate (only existing files)
- ✅ Standardized format across all tests
