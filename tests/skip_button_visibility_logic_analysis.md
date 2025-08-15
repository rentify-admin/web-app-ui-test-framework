# Skip Button Visibility Logic Test - Analysis & Implementation Guide

## Test Overview
This test validates that the Skip button is only shown when no action has been taken for a given verification step, and disappears once an applicant completes an action.

## Test Structure Analysis

### 1. Test Flow Pattern (Following Existing Tests)
The test follows the established pattern from existing tests:
- **Admin Setup**: Login, find application, copy link
- **Applicant Simulation**: New context, phone login, form completion
- **Step-by-Step Verification**: Test each verification step individually
- **Final Validation**: Summary screen verification

### 2. Verification Steps Covered
1. **Applicant Info** - Basic form completion
2. **Identity Verification** - Document upload and verification
3. **Financial Verification** - Connection/verification process
4. **Employment Verification** - Connection/verification process

## Missing Test IDs Analysis

### High Priority Missing Test IDs
```javascript
// TODO: create testid for rent budget submit button
await page.locator('button[type="submit"]').click();

// TODO: create testid for email validation input
await actionLocator.fill('test@example.com');

// TODO: create testid for verification start buttons
await actionLocator.click(); // start-id-verification, start-financial-verification, start-employment-verification
```

### Recommended Test ID Naming Convention
Based on existing patterns in the codebase:
- `rent-budget-submit-btn`
- `applicant-email-input`
- `start-{verification-type}-verification-btn`
- `{verification-type}-verification-continue-btn`

## Request Checks Analysis

### Essential API Calls to Monitor
Based on existing test patterns, these request checks should be implemented:

#### 1. Rent Budget Submission
```javascript
// TODO: create request check for rent budget submission
const [ rentBudgetResponse ] = await Promise.all([
    page.waitForResponse(resp => 
        resp.url().includes(`/sessions/${sessionId}`) &&
        resp.request().method() === 'PATCH' &&
        resp.ok()
    ),
    page.getByTestId('rent-budget-submit-btn').click()
]);
```

#### 2. Email Validation (Applicants Step)
```javascript
// TODO: create request check for email validation API call
const [ emailValidationResponse ] = await Promise.all([
    page.waitForResponse(resp => 
        resp.url().includes('/email-validation') &&
        resp.request().method() === 'POST' &&
        resp.ok()
    ),
    page.getByTestId('applicant-email-input').fill('test@example.com')
]);
```

#### 3. Verification Start Calls
```javascript
// TODO: create request check for verification start API call
const [ verificationStartResponse ] = await Promise.all([
    page.waitForResponse(resp => 
        resp.url().includes(`/sessions/${sessionId}/verifications`) &&
        resp.request().method() === 'POST' &&
        resp.ok()
    ),
    page.getByTestId('start-identity-verification').click()
]);
```

#### 4. Step Completion Calls
```javascript
// TODO: create request check for step completion API call
const [ stepCompletionResponse ] = await Promise.all([
    page.waitForResponse(resp => 
        resp.url().includes(`/sessions/${sessionId}/steps/`) &&
        resp.request().method() === 'PATCH' &&
        resp.ok()
    ),
    page.getByTestId('identity-verification-continue-btn').click()
]);
```

## Implementation Recommendations

### 1. Test ID Creation Priority
1. **Critical**: `rent-budget-submit-btn` - Used in multiple tests
2. **High**: `start-{verification-type}-verification-btn` - Core functionality
3. **Medium**: `{verification-type}-verification-continue-btn` - Navigation
4. **Low**: `applicant-email-input` - Form validation

### 2. Request Check Implementation
- Use `Promise.all` pattern with `waitForResponse` and action
- Set appropriate timeouts (10-30 seconds based on operation)
- Validate response status and method
- Log response data for debugging

### 3. Error Handling
- Implement try-catch blocks for flaky operations
- Add fallback mechanisms for timeouts
- Log detailed error information
- Continue test execution when possible

## Test Data Requirements

### Application Configuration
- Application must have all verification steps set to "skippable"
- Test application name: `AutoTest - Skip Button Visibility Test`
- Must support phone-based authentication

### Test User Data
- Random phone number generation (already implemented)
- Standard test user credentials
- Alaska state selection (for household size)

## Validation Points

### Skip Button States
1. **Visible**: Before any action is taken
2. **Hidden**: After action completion
3. **Continue Button**: Appears after action completion

### Step Statuses
1. **Rent Budget**: Complete
2. **Identity Verification**: Complete
3. **Applicants**: Skipped
4. **Financial Verification**: Complete
5. **Employment Verification**: Skipped

## Performance Considerations

### Timeouts
- **Short operations**: 5-10 seconds (button clicks, form fills)
- **Medium operations**: 15-30 seconds (verification processes)
- **Long operations**: 60+ seconds (file uploads, external integrations)

### Wait Strategies
- Use `waitForResponse` for API calls
- Use `waitForTimeout` sparingly (only for UI animations)
- Implement explicit waits for element visibility
- Use `toBeVisible()` assertions for robust element checking

## Future Enhancements

### 1. Dynamic Test Data
- Generate random application names
- Use different verification types
- Test various skip configurations

### 2. Edge Cases
- Test with slow network conditions
- Validate error state handling
- Test with different user roles

### 3. Integration Tests
- Test with real external services
- Validate end-to-end workflows
- Performance benchmarking

## Conclusion
This test provides comprehensive coverage of skip button visibility logic while following established patterns from the existing test suite. The implementation focuses on maintainability, reliability, and comprehensive validation of the core functionality.

