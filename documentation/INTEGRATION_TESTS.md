# Integration Tests

## Test 1: `financial_plaid_one_transaction_error_decline.spec.js`

**Description:** Tests Plaid bank connection with insufficient transactions → validates decline flag appears

**Steps:**
1. Admin logs in → searches "AutoTest Suite - Fin only" application
2. Creates session for random user (Test + random number)
3. Applicant completes initial setup (rent budget: $555)
4. Connects bank via Plaid (Regions Bank, username: `custom_onetxn`)
5. Plaid flow: Continue as guest → Select bank → Enter credentials → Submit → Continue → Finish without saving
6. Waits for connection "Complete" status (timeout: 100s)
7. Verifies Summary screen appears
8. Admin navigates back to Applicants → searches for session
9. Clicks session → verifies "User Error" link appears
10. Opens Connection Attempts modal → verifies "1 account | 1 transaction"
11. Opens View Details → verifies "Gross Income Ratio Exceeded" flag

**Checks:**
- Plaid connection completes successfully with only 1 transaction
- Summary screen displays after verification
- "User Error" indicator appears in session list
- Connection modal shows correct count (1 account, 1 transaction)
- "Gross Income Ratio Exceeded" decline flag is raised
- Flag appears in application details modal

---

## Test 2: `hosted_app_copy_verify_flow_plaid_id_emp_skip.spec.js`

**Description:** Tests full hosted app flow: phone registration + Persona ID + Plaid bank + skip options

**Steps:**
1. Admin logs in → searches "AutoTest Suite Hshld-ID-Emp-Fin with skips"
2. Copies application URL (from Copy button)
3. Admin logs out
4. Navigates to copied application URL (simulates applicant)
5. Phone login: Enters random phone (613292XXXX) → OTP (123456)
6. Fills registration form (first: teset, last: testrelogin, state: ALASKA, accepts terms)
7. Fills rent budget ($500)
8. Skips Applicants step
9. Completes ID Verification (Persona): Passport upload flow
   - Begin verifying → Select → Passport → Upload photo → Continue → Done
10. Skips Employment Verification
11. Completes Plaid financial connection (Bank of America, username: `custom_gig`)
    - Plaid OAuth popup flow with device/code verification
12. Verifies Summary screen with all step statuses

**Checks:**
- Phone authentication works (random number generation)
- Registration form accepts valid data
- Skip buttons work for Applicants and Employment
- Persona ID verification completes with passport upload
- Plaid connection succeeds via OAuth popup
- Summary shows: Rent Budget (Complete), Identity (Complete), Applicants (Skipped), Employment (Skipped)
- Financial Verification shows "Missing Financial Transactions" error

---

## Test 3: `skip_button_visibility_logic.spec.js`

**Description:** Tests skip button appears/disappears correctly across all verification steps (ID, Financial, Employment)

**Steps:**
1. Admin logs in → searches "Autotest - Full flow skip button test"
2. Creates session for SkipButton Test user
3. Applicant completes: Applicant type (#affordable_occupant) → State modal → Rent budget
4. **For each step (Applicants, Identity, Financial, Employment):**
   - **Phase 1:** Verifies Skip button IS visible before any action
   - **Phase 2:** Completes an action for that step:
     - Applicants: Fills household form (invites co-applicant)
     - Identity: Completes Persona camera flow (driver's license)
     - Financial: Completes Plaid connection (Bank of America)
     - Employment: Completes Atomic paystub (Paychex, username: `test-failure`)
   - **Phase 3:** Verifies Skip button is NO LONGER visible
   - Verifies Continue button appears and clicks it
5. Verifies Summary screen shows all steps as "Complete"

**Checks:**
- Skip button visibility BEFORE action: Present on all 4 steps
- Skip button visibility AFTER action: Hidden on all 4 steps
- Continue button appears after completing each step
- UI logic correctly hides Skip when verification starts
- All steps transition from "skippable" to "completed"
- Summary confirms: Rent Budget, Identity, Applicants, Financial, Employment all "Complete"

---

## Test 4: `financial_mx_2_attempts_success_and_failed_password.spec.js`

**Description:** Tests MX connection with success + failure scenarios (wrong password error handling)

**Steps:**
1. Admin logs in → searches "AutoTest Suite - Fin only" application
2. Creates session for "FinMX Test" user
3. Applicant fills rent budget ($500) → clicks "Connect Bank"
4. **First MX connection (SUCCESS):**
   - Searches "mx bank oau" in MX iframe
   - Selects "MX Bank (OAuth)"
   - OAuth popup opens → clicks "Authorize"
   - Polls for completion: Checks "done" button OR iframe auto-close (robust polling, max 160s)
   - Handles both scenarios: button click or background completion
5. **Second MX connection (FAIL):**
   - Re-opens MX iframe if it closed automatically
   - Searches "mx bank"
   - Enters wrong credentials: `fail_user` / `fail_password`
   - Validates error message appears
   - Closes modal and continues
6. **Eligibility Status Test:**
   - Waits for MX income source generation
   - **Initial:** MX income + $500 rent → **"Meets Criteria"** ✅
   - **Change:** Rent → $3000 → **"Criteria Not Met"** ❌
   - **Fix:** Add manual income $3000 → **"Meets Criteria"** ✅

**Checks:**
- MX OAuth integration works (popup authorization)
- Successful connection generates income sources
- Robust polling handles both completion methods (button click vs auto-close iframe)
- Iframe re-opens correctly for second attempt
- Wrong credentials trigger proper error message
- Error doesn't crash the flow
- Eligibility status transitions correctly based on income-to-rent ratio
- Manual income sources affect eligibility calculation
- Status badge updates: "Meets Criteria" → "Criteria Not Met" → "Meets Criteria"

---

## Test 5: `employment_skip_household_not_hidden_employment_connect.spec.js`

**Description:** Tests Atomic employment verification (Walmart paystub) without household step

**Steps:**
1. Admin logs in → searches "AutoTest Suite - EMP Connect"
2. Creates session for user (alexander sample)
3. Copies invite link
4. Applicant opens link in new context
5. Handles state modal if present
6. Fills rent budget ($555) → submits
7. Employment Verification step appears (household step skipped/not shown)
8. Clicks "Pay Stub" → "Directly Connect"
9. Atomic iframe loads → completes Walmart paystub flow:
   - Continue → Search "walmart" → Select Walmart
   - Username: `test-good` → Password: dfdsfsff
   - Selects radio option: "Homeoffice" → Continue
10. Waits for Summary screen (timeout: 60s)

**Checks:**
- Household/Applicants step is not shown (skipped automatically)
- Employment step appears immediately after rent budget
- Atomic iframe loads correctly
- Walmart employer search works
- Credentials authentication succeeds
- Paystub connection completes
- Summary screen appears confirming verification
- Full flow completes without household step

---

## Test 6: `application_flow_with_id_only.spec.js`

**Description:** Tests Persona identity verification only (passport upload, no financial/employment)

**Steps:**
1. Admin logs in → navigates to Applications
2. Searches "AutoTest Suite - ID Only"
3. Clicks Invite → generates session (default user data)
4. Copies invite link
5. Applicant opens link in new context
6. Fills rent budget ($500) → submits
7. Clicks "Start Id Verification" button
8. Persona iframe loads → ID verification flow:
   - Clicks "Begin Verifying" (after dismissing intro)
   - Clicks "Select" → Selects Passport (#select__option--pp)
   - Uploads passport.jpg file
   - Clicks "Use Image" → Continues
   - Clicks primary button to submit
9. Waits for Summary screen (timeout: 110s)

**Checks:**
- Application configured for ID-only workflow
- No Financial or Employment steps appear
- Persona iframe loads successfully
- Passport document type selection works
- File upload accepts passport.jpg
- Persona verification processes the document
- Summary screen appears after ID completion only
- Session completes without financial/employment verification

---

