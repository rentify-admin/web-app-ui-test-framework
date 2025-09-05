# E2E UI Test Documentation

## Tests Requiring Manual Review
- `financial_plaid_one_transaction_error_decline.spec.js`
- `financial_mx_2_attempts_success_and_failed_password.spec.js`
- `employment_skip_household_not_hidden_employment_connect.spec.js`
- `hosted_app_copy_verify_flow_plaid_id_emp_skip.spec.js`

---

## Core Application Tests

### `application_create_delete_test.spec.js`
**Purpose:** Test complete application lifecycle from creation to deletion
**Timeout:** 30 seconds
**Test Data:**
- Organization: 'Verifast'
- Application Name: `AutoTest Create_Delete_${randomNumber}`
- Applicant Types: ['Affordable Occupant', 'Affordable Primary', 'Employed', 'International', 'Self-Employed', 'Other']
- Workflow Template: 'Autotest-suite-fin-only'
- Flag Collection: 'High Risk'
- Minimum Amount: '500'

**Detailed Steps:**
1. **Admin Authentication**
   - Navigate to root URL (`/`)
   - Fill login form with admin credentials from `test_config`
   - Submit login form
   - Verify applicants menu is visible (`applicants-menu` test ID)

2. **Application Configuration Setup**
   - Generate unique application name with random number
   - Configure organization as 'Verifast'
   - Set up 6 different applicant types
   - Select 'Autotest-suite-fin-only' workflow template
   - Choose 'High Risk' flag collection
   - Set minimum amount to '500'

3. **Complete Application Flow**
   - Use `completeApplicationFlow()` utility function
   - Create application with all configured settings
   - Verify application creation success

4. **Application Deletion**
   - Navigate to created application
   - Execute deletion process
   - Verify application removal

### `application_edit_id_template_settings.spec.js`
**Purpose:** Test ID template configuration editing
**Timeout:** 30 seconds
**Test Data:**
- Application Name: 'AutoTest Suite - ID Edit Only'

**Detailed Steps:**
1. **Admin Login and Navigation**
   - Navigate to root URL (`/`)
   - Fill and submit admin login form
   - Verify applicants menu visibility
   - Navigate to applications menu and submenu

2. **Application Search and Selection**
   - Use `gotoApplicationsPage()` utility
   - Search for 'AutoTest Suite - ID Edit Only'
   - Locate application in table using exact name match
   - Click edit action link (7th column)

3. **ID Template Configuration**
   - Open application edit modal
   - Navigate to workflow identity setup
   - Access ID template settings
   - Modify persona template ID configuration

4. **Verification**
   - Save configuration changes
   - Verify template ID updates
   - Confirm changes are persisted

---

## Session Flow Tests

### `frontent-session-heartbeat.spec.js`
**Purpose:** Test complete applicant session flow with co-applicant and state modal handling
**Timeout:** 250 seconds
**Test Data:**
- Primary User: `{email: getRandomEmail(), first_name: 'Playwright', last_name: 'Heartbeat', password: 'password'}`
- Co-applicant: `{email: getRandomEmail(), first_name: 'PWCoapp', last_name: 'Heartbeat'}`
- Application: 'Autotest - Application Heartbeat (Frontend)'
- Rent Budget: '500'
- State: 'ALABAMA'

**Detailed Steps:**
1. **Admin Setup and Session Generation**
   - Login as admin using `adminLoginAndNavigateToApplications()`
   - Find and invite 'Autotest - Application Heartbeat (Frontend)' application
   - Generate session with primary user data
   - Extract session ID, session URL, and invite link
   - Logout from admin account

2. **Primary Applicant Flow**
   - Navigate to invite link
   - Select applicant type as 'employed' (`#employed` selector)
   - Handle state modal (wait 3 seconds, then select 'ALABAMA')
   - Fill rent budget with '500'
   - Skip co-applicant invitation initially
   - Navigate to ID verification step

3. **Co-applicant Invitation Process**
   - Navigate back to applicants section
   - Click on 'Skipped' applicants
   - Fill household form with co-applicant data
   - Use `waitForButtonOrAutoAdvance()` for intelligent button handling
   - Handle both manual click and auto-advance scenarios

4. **ID Verification Flow**
   - Start manual upload process
   - Cancel manual upload
   - Skip ID verification step
   - Verify navigation to financial step

5. **Financial Verification**
   - Click manual upload button for financial documents
   - Cancel manual upload
   - Skip financial verification step
   - Navigate to employment step

6. **Employment and Paystub Processing**
   - Complete paystub connection using `completePaystubConnection()`
   - Use `waitForButtonOrAutoAdvance()` for employment step
   - Handle button enablement and auto-advance scenarios
   - Verify navigation to summary page

7. **Session Completion**
   - Verify summary section visibility
   - Close applicant page
   - Complete session validation

### `co_applicant_effect_on_session_test.spec.js`
**Purpose:** Test co-applicant impact on session data and income aggregation
**Timeout:** 380 seconds
**Test Data:**
- Primary User: `{first_name: 'Playwright', last_name: 'User', email: 'playwright+effect@verifast.com'}`
- Co-applicant: `{first_name: 'Playwright', last_name: 'CoApp', email: 'playwright+coapp@verifast.com'}`
- Application: 'AutoTest Suite - Full Test'
- Plaid Username: 'custom_gig' (primary), 'user_bank_income' (co-app)
- Plaid Password: 'test' (primary), '{}' (co-app)

**Detailed Steps:**
1. **Primary Applicant Session Setup**
   - Admin login and navigate to applications
   - Find and invite 'AutoTest Suite - Full Test' application
   - Generate session with primary user data
   - Extract session details and invite link

2. **Primary Applicant Verification Flow**
   - Open invite link in new browser context
   - Select applicant type and handle state modal
   - Complete rent budget step
   - Fill household form with co-applicant data
   - Skip ID verification
   - Complete Plaid financial connection with 'custom_gig'/'test'
   - Wait for Plaid connection completion
   - Complete paystub connection
   - Finish employment step with API response waiting

3. **Co-applicant Session Creation**
   - Navigate to applicants section
   - Search for session by ID
   - Click on session to view details
   - Verify session has children (co-applicants)
   - Access session action menu
   - Invite co-applicant
   - Reinvite existing applicant
   - Copy invite link with clipboard fallback handling

4. **Co-applicant Verification Flow**
   - Open co-applicant invite link in new context
   - Select applicant type and handle state modal
   - Skip ID verification
   - Complete Plaid financial connection with 'user_bank_income'/'{}'
   - Wait for Plaid connection completion
   - Complete paystub connection
   - Finish employment step

5. **Data Aggregation and Validation**
   - Reload admin page to refresh session data
   - Wait for session and financial verification responses
   - Verify income aggregation across all applicants
   - Check income source sections for all sessions
   - Validate employment data for all applicants
   - Verify financial section data integrity

### `application_flow_with_id_only.spec.js`
**Purpose:** Test ID-only verification workflow
**Timeout:** 180 seconds
**Test Data:**
- Application: 'AutoTest Suite - ID Only'
- Rent Budget: '500'
- Document: 'passport.jpg' from test_files directory
- Persona iframe: 'withpersona.com'

**Detailed Steps:**
1. **Admin Setup and Session Generation**
   - Login as admin and verify applicants page title
   - Navigate to applications page
   - Search for 'AutoTest Suite - ID Only' application
   - Verify application name in table (2nd column)
   - Click action link (7th column)
   - Generate session with default form data
   - Extract session ID, URL, and invite link

2. **Applicant ID Verification Flow**
   - Open invite link in new browser context
   - Fill rent budget with '500'
   - Submit form and wait for session URL response
   - Start ID verification process
   - Wait for identity-verifications API response

3. **Persona Integration**
   - Locate Persona iframe (`iframe[src*="withpersona.com"]`)
   - Wait 3 seconds for iframe loading
   - Click basic verification button
   - Click 'Begin Verifying' button (primary, not disabled)
   - Select document type (passport)
   - Upload passport image from test_files directory
   - Use government ID image
   - Complete verification process

4. **Verification Completion**
   - Wait for summary page to appear (110 second timeout)
   - Verify session completion

### `hosted_app_copy_verify_flow_plaid_id_emp_skip.spec.js`
**Purpose:** Test hosted application flow with Plaid integration
**Timeout:** 180 seconds
**Test Data:**
- Application: 'AutoTest Suite - Hosted App'
- Plaid Integration: Betterment bank connection

**Detailed Steps:**
1. **Hosted Application Setup**
   - Complete hosted application flow
   - Handle application-specific UI elements
   - Navigate through hosted app steps

2. **Plaid Financial Connection**
   - Initiate Plaid connection process
   - Select Betterment bank option
   - Complete OAuth flow
   - Verify connection success

3. **ID Verification**
   - Start ID verification process
   - Handle hosted app specific ID flow
   - Complete identity verification

4. **Employment Verification**
   - Navigate to employment step
   - Complete employment verification
   - Skip household information if applicable

---

## Financial Verification Tests

### `financial_plaid_one_transaction_error_decline.spec.js`
**Purpose:** Test Plaid connection error handling and decline logic
**Timeout:** 30 seconds
**Test Data:**
- Plaid Test User: Error scenario simulation
- Transaction Error: Simulated transaction processing error

**Detailed Steps:**
1. **Applicant Setup**
   - Complete basic applicant information
   - Navigate to financial verification step
   - Prepare for Plaid connection

2. **Plaid Connection with Errors**
   - Initiate Plaid connection
   - Simulate transaction processing errors
   - Handle error responses from Plaid API
   - Verify error display to user

3. **Error Handling and Decline Logic**
   - Test error message display
   - Verify decline workflow
   - Test retry mechanisms
   - Validate error recovery options

### `financial_mx_1_attempt_report_check_approve_with_conditions.spec.js`
**Purpose:** Test MX OAuth financial verification with approval workflow conditions
**Timeout:** 180 seconds
**Test Data:**
- User: `{first_name: 'alexander', last_name: 'sample', email: 'ignacio.martinez+playwright@verifast.com'}`
- Application: 'AutoTest Suite - Fin only'
- Rent Budget: '555'
- MX Bank: 'mx bank oau'
- Income Source: 'OTHER' type, net amount '1000'
- Rent Budget Changes: '1755' (conditional), '3000' (decline)

**Detailed Steps:**
1. **Admin Setup and Session Generation**
   - Login as admin and verify page title
   - Navigate to applications page
   - Search for 'AutoTest Suite - Fin only' application
   - Locate exact application name in table
   - Click action link (7th column)
   - Fill session form with user data
   - Submit and extract session details

2. **Applicant Financial Verification**
   - Open invite link in new browser context
   - Handle optional state modal
   - Fill rent budget with '555'
   - Wait for button enablement (10 second timeout)
   - Submit form and wait for session URL response
   - Start MX OAuth financial verification
   - Use `connectBankOAuthFlow()` utility with 'mx bank oau'
   - Poll for connection completion (30 attempts, 2 second intervals)
   - Verify connection success

3. **Admin Income Source Management**
   - Navigate to session admin page
   - Verify household status alert visibility
   - Add income source section
   - Select 'OTHER' income type
   - Uncheck 'Calculate average from transactions' if checked
   - Fill net amount with '1000'
   - Save income source and capture API response
   - Wait for income sources sync
   - Verify income source visibility

4. **Approval Workflow Testing**
   - Reload page and verify updated status
   - Wait for 'Meets Criteria' status (30 second timeout)
   - Test conditional approval: Edit rent budget to '1755'
   - Reload and verify 'Conditional Meets Criteria' status
   - Test decline scenario: Edit rent budget to '3000'
   - Reload and verify 'Criteria Not Met' status

### `financial_mx_2_attempts_success_and_failed_password.spec.js`
**Purpose:** Test MX verification retry logic with password failures
**Timeout:** 180 seconds
**Test Data:**
- First Attempt: Incorrect credentials
- Second Attempt: Correct credentials
- Retry Logic: Multiple attempt handling

**Detailed Steps:**
1. **First Attempt with Wrong Credentials**
   - Complete applicant setup
   - Initiate MX OAuth connection
   - Enter incorrect password
   - Verify failure handling
   - Test error message display

2. **Retry with Correct Credentials**
   - Retry MX OAuth connection
   - Enter correct password
   - Verify successful connection
   - Test retry mechanism functionality

3. **Success Verification**
   - Verify connection completion
   - Test data retrieval
   - Validate verification success

### `bank_statement_transaction_parsing.spec.js`
**Purpose:** Test bank statement upload and transaction parsing
**Timeout:** 130 seconds
**Test Data:**
- User: `{email: 'playwright+korey@verifications.com', first_name: 'Korey', last_name: 'Lockett', password: 'password'}`
- Application: 'AutoTest - Playwright Fin Doc Upload Test'
- Rent Budget: '500'
- Bank Statement: Uploaded via `uploadStatementFinancialStep()`

**Detailed Steps:**
1. **Admin Setup and Session Generation**
   - Login as admin and navigate to applications
   - Find and invite 'AutoTest - Playwright Fin Doc Upload Test'
   - Generate session with user data
   - Extract session details and invite link

2. **Applicant Document Upload**
   - Open invite link in new browser context
   - Complete applicant form with rent budget '500'
   - Upload bank statement document
   - Wait for document processing

3. **Transaction Parsing and Validation**
   - Wait for connection completion
   - Continue financial verification process
   - Verify transaction data extraction
   - Validate parsed transaction information

4. **Admin Data Validation**
   - Navigate to admin panel
   - Validate financial data display
   - Verify transaction parsing results
   - Check data accuracy and completeness

### `document_upload_verifications_core_flow.spec.js`
**Purpose:** Test core document upload verification flow
**Timeout:** 260 seconds (currently skipped)
**Test Data:**
- User: `{email: 'playwright+document-upload@verifications.com', first_name: 'Document', last_name: 'Upload', password: 'password'}`
- Application: 'AutoTest - Document Uploads Only'
- Paystub File: 'paystub_recent.png'
- Expected Flags: ['EMPLOYEE_NAME_MISMATCH_CRITICAL', 'GROSS_INCOME_RATIO_EXCEEDED', 'INCOME_SOURCE_CADENCE_MISMATCH', 'PAY_STUB_UPLOADED']

**Detailed Steps:**
1. **Admin Setup and Session Generation**
   - Login as admin and navigate to applications
   - Find and invite 'AutoTest - Document Uploads Only'
   - Generate session with user data
   - Extract session details and invite link

2. **Applicant Basic Information**
   - Open invite link in new browser context
   - Select 'Employed' status
   - Click applicant type next button
   - Handle optional state modal
   - Fill rent budget with '500'
   - Skip co-applicants
   - Skip identity verification

3. **Document Upload Process**
   - Upload financial statement document
   - Upload paystub documents using 'paystub_recent.png'
   - Verify document processing
   - Complete upload verification

4. **Summary and Verification**
   - Verify summary screen display
   - Close applicant context
   - Navigate to admin panel
   - Verify employment section data
   - Check income sources section
   - Validate report flags match expected flags

---

## Employment Verification Tests

### `employment_skip_household_not_hidden_employment_connect.spec.js`
**Purpose:** Test employment verification with household skip logic
**Timeout:** 30 seconds
**Test Data:**
- User: `{first_name: 'alexander', last_name: 'sample', email: 'ignacio.martinez+playwright1@verifast.com'}`
- Application: 'AutoTest Suite - EMP Connect'
- Rent Budget: '555'
- Employment Provider: AtomicFI iframe
- Company: Walmart (via `employmentVerificationWalmartPayStub`)

**Detailed Steps:**
1. **Admin Setup and Session Generation**
   - Login as admin and navigate to applications
   - Find and invite 'AutoTest Suite - EMP Connect'
   - Fill session form with user data
   - Submit and extract session details

2. **Applicant Basic Setup**
   - Open invite link in new browser context
   - Wait 2 seconds for page loading
   - Handle optional state modal
   - Fill rent budget with '555'
   - Submit form and wait for session URL PATCH response

3. **Employment Verification Flow**
   - Wait for 'Employment Verification' text (20 second timeout)
   - Click paystub document option
   - Click direct employment connection button
   - Wait for AtomicFI iframe to appear
   - Complete Walmart paystub verification using `employmentVerificationWalmartPayStub()`

4. **Verification Completion**
   - Wait for summary page to appear (60 second timeout)
   - Verify employment data processing
   - Close applicant context

---

## Permission Tests

### `user_permissions_verify.spec.js`
**Purpose:** Test user permissions and capabilities via API
**Timeout:** 180 seconds (serial mode)
**Test Data:**
- Test User: Generated with unique prefix, role '0196f6c9-da5e-7074-9e6e-c35ac8f1818e' (Centralized Leasing)
- Session ID: '01971d54-6284-70c4-8180-4eee1abd955a'
- Organization: 'Permissions Test Org'
- Role: 'Centralized Leasing'

**Detailed Steps:**
1. **API User Creation**
   - Authenticate with admin credentials
   - Generate unique user prefix
   - Create user data with Centralized Leasing role
   - Create user via API using `dataManager.createEntities()`
   - Verify user creation success
   - Store user globally for other tests

2. **User Authentication and Access**
   - Login with created user credentials
   - Verify user authentication
   - Test application access permissions
   - Verify user can access applications list

3. **Session Permission Testing**
   - Test session access permissions
   - Verify approve/reject functionality
   - Test PDF export permissions
   - Test additional document request permissions
   - Test co-applicant management permissions
   - Test session merging permissions
   - Test session deletion permissions

4. **API Permission Validation**
   - Test identity verification access
   - Test session identities access
   - Test session income sources access
   - Test financial verifications access
   - Test employment verifications access
   - Test session files access
   - Test session transactions access

### `staff_user_permissions_test.spec.js`
**Purpose:** Test staff user permissions and access limitations
**Timeout:** 180 seconds (serial mode)
**Test Data:**
- Staff User: Generated with unique prefix, role '0196f6c9-da51-7337-bbde-ca7d0efd7f84'
- Session ID: '01971d4f-2e5e-7151-88d5-d038c044d13b'

**Detailed Steps:**
1. **Staff User Creation**
   - Authenticate with admin credentials
   - Generate unique user prefix
   - Create staff user with specific role
   - Create user via API
   - Verify user creation success

2. **Staff Permission Testing**
   - Login with staff user credentials
   - Test staff-specific permissions
   - Verify access limitations
   - Test restricted functionality

3. **Access Control Validation**
   - Verify staff user can access allowed features
   - Test restrictions on admin-only features
   - Validate permission boundaries

### `property_admin_permission_test.spec.js`
**Purpose:** Test property admin role permissions and capabilities
**Timeout:** 180 seconds (serial mode)
**Test Data:**
- Property Admin User: Generated with unique prefix, role '0196f6c9-da56-7358-84bc-56f0f80b4c19'
- Session ID: '01971d54-6284-70c4-8180-4eee1abd955a'

**Detailed Steps:**
1. **Property Admin User Creation**
   - Authenticate with admin credentials
   - Generate unique user prefix
   - Create property admin user with specific role
   - Create user via API
   - Verify user creation success
   - Store user globally for other tests

2. **Property Admin Permission Testing**
   - Login with property admin user
   - Test property admin specific permissions
   - Verify application access capabilities
   - Test session access permissions

3. **Role-Specific Capability Testing**
   - Test property admin specific features
   - Verify role-based access control
   - Test application and session management
   - Validate property admin capabilities

4. **Applicant Inbox Permission Testing**
   - Test applicant inbox access
   - Verify inbox-specific permissions
   - Test inbox functionality
   - Validate permission boundaries

---

## Workflow Tests

### `application_step_should_skip_properly.spec.js`
**Purpose:** Test application step skipping logic and conditions
**Timeout:** 30 seconds
**Test Data:**
- Skip Conditions: Configured based on application settings
- Skip Scenarios: Various conditional skip logic

**Detailed Steps:**
1. **Application Configuration**
   - Configure application with skip conditions
   - Set up conditional logic for step skipping
   - Define skip criteria and triggers

2. **Session Flow with Skip Scenarios**
   - Complete session with various skip scenarios
   - Test different conditional skip logic
   - Verify skip behavior under different conditions

3. **Skip Logic Validation**
   - Verify proper step skipping
   - Test skip condition evaluation
   - Validate skip logic accuracy

### `applicant_type_workflow_affordable_occupant.spec.js`
**Purpose:** Test affordable occupant workflow and logic
**Timeout:** 30 seconds
**Test Data:**
- Applicant Type: 'Affordable Occupant'
- Workflow: Affordable housing specific logic

**Detailed Steps:**
1. **Affordable Occupant Application Setup**
   - Configure affordable occupant application
   - Set up affordable housing specific settings
   - Configure occupant-specific workflow

2. **Applicant Flow Completion**
   - Complete applicant flow with affordable occupant type
   - Navigate through affordable-specific steps
   - Handle occupant-specific requirements

3. **Affordable Logic Verification**
   - Verify affordable-specific logic
   - Test occupant workflow functionality
   - Validate affordable housing calculations

### `applicant_edits_a_workflow_used_by_another_applicant.spec.js`
**Purpose:** Test workflow editing conflicts and concurrent usage
**Timeout:** 30 seconds
**Test Data:**
- Multiple Applicants: Using same workflow
- Workflow Editing: Concurrent modification scenarios

**Detailed Steps:**
1. **Workflow Creation and Usage**
   - Create workflow used by multiple applicants
   - Set up concurrent usage scenarios
   - Configure workflow sharing

2. **Concurrent Editing Testing**
   - Edit workflow while in use by other applicants
   - Test concurrent modification handling
   - Verify conflict resolution

3. **Conflict Handling Validation**
   - Verify conflict handling mechanisms
   - Test concurrent access control
   - Validate workflow integrity

### `verify_application_edit_id_step_edit.spec.js`
**Purpose:** Test application ID step editing functionality
**Timeout:** 30 seconds
**Test Data:**
- Application: 'AutoTest Suite - ID Edit Only'
- ID Step: Identity verification step configuration

**Detailed Steps:**
1. **Application ID Step Access**
   - Login as admin
   - Navigate to applications
   - Search for 'AutoTest Suite - ID Edit Only'
   - Access application edit functionality

2. **ID Step Configuration**
   - Edit application ID step
   - Modify step configuration
   - Update identity verification settings

3. **Step Functionality Testing**
   - Test step configuration changes
   - Verify step functionality
   - Validate configuration persistence

---

## Report Tests

### `pdf_download_test.spec.js`
**Purpose:** Test PDF report generation and download functionality
**Timeout:** 30 seconds
**Test Data:**
- Staff User: From test_config
- Session Search: 'autotest PDF Download'
- PDF Export: Using `checkExportPdf()` utility

**Detailed Steps:**
1. **Staff User Authentication**
   - Navigate to 'https://dev.verifast.app/'
   - Login as staff user
   - Verify applicants menu visibility

2. **Session Search and Navigation**
   - Search for 'autotest PDF Download' sessions
   - Verify search results are found
   - Extract session ID from search results
   - Navigate to session using `navigateToSessionById()`

3. **PDF Export Process**
   - Wait for session to be fully loaded (1 second)
   - Use `checkExportPdf()` utility for export
   - Verify PDF generation and download
   - Test PDF content and format

### `report_update_bank_statement_test.spec.js`
**Purpose:** Test bank statement report updates and data synchronization
**Timeout:** 30 seconds
**Test Data:**
- Bank Statement: Upload and update process
- Report Generation: Data synchronization testing

**Detailed Steps:**
1. **Bank Statement Upload**
   - Upload initial bank statement
   - Process document and extract data
   - Verify initial data processing

2. **Report Generation**
   - Generate initial report
   - Verify report data accuracy
   - Test report formatting

3. **Bank Statement Update**
   - Update bank statement with new data
   - Process updated document
   - Verify data changes

4. **Report Update Verification**
   - Regenerate report after update
   - Verify report updates reflect changes
   - Test data synchronization accuracy

---

## Flag and Validation Tests

### `user_flags_approve_reject_test.spec.js`
**Purpose:** Test flag approval and rejection workflow (currently skipped)
**Timeout:** 200 seconds
**Test Data:**
- Test Admin: `{email: 'jeremiah.jacobs+playwright@verifast.com', password: 'Test1234'}`
- User Data: `{first_name: 'Flag Issue', last_name: 'Testing', email: 'FlagIssueTesting@verifast.com'}`
- Session: '01985a2c-c3f3-71fa-bc3d-f5a11279d36a'
- Application: 'AutoTest - Flag Issue V2'

**Detailed Steps:**
1. **Session Creation for Flag Testing**
   - Create session for flag issue testing
   - Set up flag generation scenarios
   - Configure flag testing environment

2. **Flag Review and Management**
   - Navigate to session flags
   - Review generated flags
   - Test flag approval process
   - Test flag rejection process

3. **Flag Status Updates**
   - Verify flag status changes
   - Test flag workflow completion
   - Validate flag management functionality

### `check_coapp_income_ratio_exceede_flag.spec.js`
**Purpose:** Test co-applicant income ratio flag generation
**Timeout:** 30 seconds
**Test Data:**
- Co-applicant Session: Multiple applicants with income data
- Income Ratio: Calculation and flag generation

**Detailed Steps:**
1. **Co-applicant Session Setup**
   - Complete co-applicant session
   - Set up multiple applicants with income data
   - Configure income ratio calculations

2. **Income Ratio Calculation**
   - Calculate income ratios for all applicants
   - Test ratio calculation logic
   - Verify calculation accuracy

3. **Flag Generation Testing**
   - Test flag generation based on income ratios
   - Verify flag triggers and conditions
   - Validate flag accuracy

### `co_app_household_with_flag_errors.spec.js`
**Purpose:** Test co-applicant household flag error handling
**Timeout:** 30 seconds
**Test Data:**
- Co-applicant Setup: Multiple household members
- Flag Errors: Household validation errors

**Detailed Steps:**
1. **Co-applicant Household Setup**
   - Complete co-applicant setup
   - Configure household information
   - Set up household validation scenarios

2. **Flag Error Generation**
   - Generate household flag errors
   - Test error condition triggers
   - Verify error flag generation

3. **Error Handling Validation**
   - Test error handling mechanisms
   - Verify error display and messaging
   - Validate error recovery options

### `skip_button_visibility_logic.spec.js`
**Purpose:** Test skip button visibility logic and conditional display
**Timeout:** 30 seconds
**Test Data:**
- Skip Conditions: Various conditional logic
- Button Visibility: Conditional display rules

**Detailed Steps:**
1. **Skip Condition Configuration**
   - Configure skip conditions
   - Set up conditional logic
   - Define visibility rules

2. **Session Flow Testing**
   - Complete session flow with skip conditions
   - Test skip button visibility
   - Verify conditional display logic

3. **Skip Button Behavior Validation**
   - Test skip button functionality
   - Verify skip logic execution
   - Validate skip behavior accuracy

### `check_org_member_application_permission_update.spec.js`
**Purpose:** Test organization member permission updates
**Timeout:** 30 seconds
**Test Data:**
- Organization Members: Permission update scenarios
- Application Access: Permission-based access control

**Detailed Steps:**
1. **Organization Member Permission Updates**
   - Update organization member permissions
   - Modify access control settings
   - Configure permission changes

2. **Application Access Testing**
   - Test application access changes
   - Verify permission updates
   - Test access control enforcement

3. **Permission Update Validation**
   - Verify permission updates are applied
   - Test permission change propagation
   - Validate access control accuracy

---

## Heartbeat Tests

### `frontend_heartbeat.spec.js`
**Purpose:** Test frontend session heartbeat and state monitoring
**Timeout:** 30 seconds
**Test Data:**
- Session Monitoring: Real-time state tracking
- Heartbeat Functionality: Session state updates

**Detailed Steps:**
1. **Session Flow Completion**
   - Complete full session flow
   - Navigate through all session steps
   - Finish session processing

2. **Session State Monitoring**
   - Monitor session state changes
   - Track state transitions
   - Verify state consistency

3. **Heartbeat Functionality Verification**
   - Test heartbeat functionality
   - Verify state update mechanisms
   - Validate session monitoring

### `heartbeat_completed_application_click_check.spec.js`
**Purpose:** Test completed application navigation and state handling
**Timeout:** 30 seconds
**Test Data:**
- Session ID: '0198e279-4ff3-7205-a2d1-78c3a3f7a1e0'
- Completed State: Application completion verification

**Detailed Steps:**
1. **Application Completion**
   - Complete application process
   - Finish all required steps
   - Verify completion status

2. **Completed State Navigation**
   - Navigate to completed application
   - Test completed state access
   - Verify navigation functionality

3. **State Verification**
   - Verify completed state display
   - Test state consistency
   - Validate completion indicators
