# 🧹 UI Test Cleanup Migration Guide

**Purpose**: Migrate from conditional cleanup to robust cleanup that works with Playwright retries.

---

## ❌ **Current Problems**

### **1. Conditional Cleanup Logic**
```javascript
// ❌ BAD: Only cleans up if test passes
if (!testFailed && dataManager && dataManager.getCreated().users.length > 0) {
    await dataManager.cleanupAll();
} else if (testFailed) {
    console.log('⚠️ Test failed - keeping user for debugging');
}
```

### **2. Retry Issues**
- **3 retries configured** in `playwright.config.js`
- **Failed retries** leave orphaned users
- **Example orphaned users**:
  - `autotest-1756985244496-854@verifast.com`
  - `admin_test+autotest-1756983972749-815@verifast.com`

### **3. Context Problems**
- Can't use `afterAll` due to context issues
- Each test manages its own cleanup
- No global cleanup mechanism

---

## ✅ **New Solution: Enhanced Cleanup System**

### **1. Global Cleanup Manager**
- **Always cleans up** regardless of test outcome
- **Tracks users across retries** using unique test identifiers
- **Handles context issues** with global state management

### **2. Enhanced Fixtures**
- **Automatic cleanup tracking** for all created entities
- **Retry-safe cleanup** that works with Playwright's retry mechanism
- **Manual cleanup control** when needed
- **Auto-authentication** before cleanup operations

### **3. Migration Pattern**

#### **Before (Problematic)**
```javascript
import { test, expect } from '../fixtures/api-data-fixture';

test('Should create user', async ({ page, dataManager }) => {
    // Create user
    const user = await dataManager.createEntities({ users: [userData] });
    
    // Test logic...
    
    // ❌ Conditional cleanup - only if test passes
    if (!testFailed) {
        await dataManager.cleanupAll();
    }
});
```

#### **After (Robust)**
```javascript
import { test, expect } from '../fixtures/enhanced-cleanup-fixture';

test('Should create user', async ({ page, dataManager, cleanupHelper }) => {
    // Create user
    const user = await dataManager.createEntities({ users: [userData] });
    
    // ✅ Track for cleanup (always cleaned up)
    cleanupHelper.trackUser(user);
    
    // Test logic...
    
    // ✅ Cleanup happens automatically regardless of test outcome
});
```

---

## 🔧 **Migration Steps**

### **Step 1: Update Imports**
```javascript
// Change from:
import { test, expect } from '../fixtures/api-data-fixture';

// To:
import { test, expect } from '../fixtures/enhanced-cleanup-fixture';
```

### **Step 2: Add Cleanup Helper Parameter**
```javascript
// Change from:
test('Test name', async ({ page, dataManager }) => {

// To:
test('Test name', async ({ page, dataManager, cleanupHelper }) => {
```

### **Step 3: Track Entities for Cleanup**
```javascript
// After creating entities, track them:
const user = await dataManager.createEntities({ users: [userData] });
cleanupHelper.trackUser(user);

const application = await dataManager.createEntities({ applications: [appData] });
cleanupHelper.trackApplication(application);
```

### **Step 4: Remove Conditional Cleanup**
```javascript
// ❌ Remove this:
if (!testFailed && dataManager && dataManager.getCreated().users.length > 0) {
    await dataManager.cleanupAll();
} else if (testFailed) {
    console.log('⚠️ Test failed - keeping user for debugging');
}

// ✅ Cleanup happens automatically
```

### **Step 5: Optional Manual Cleanup**
```javascript
// If you need manual cleanup control:
try {
    // Test logic...
} finally {
    // Manual cleanup if needed
    await cleanupHelper.cleanupNow();
}
```

---

## 📋 **Files to Update**

### **Priority 1: High-Impact Tests**
1. `tests/user_permissions_verify.spec.js`
2. `tests/staff_user_permissions_test.spec.js`
3. `tests/property_admin_permission_test.spec.js`

### **Priority 2: Other Tests**
- Any test that creates users, applications, or sessions
- Tests with conditional cleanup logic

---

## 🎯 **Benefits**

### **✅ Always Clean**
- **No orphaned users** regardless of test outcome
- **Works with retries** - cleanup happens on every retry
- **Handles failures** gracefully

### **✅ Retry-Safe**
- **Unique test identifiers** prevent duplicate tracking
- **Global state management** works across retries
- **Context-independent** cleanup
- **Idempotent cleanup** - safe to run multiple times

### **✅ Easy Migration**
- **Minimal code changes** required
- **Backward compatible** with existing tests
- **Clear migration path**

## 🔄 **Retry Behavior**

### **Scenario: Multi-Test Suite (3 tests)**

#### **Test 1: Creates User**
1. **Retry 1**: Test passes → Cleanup DON'T run → User remains ✅
2. **Result**: User created and available for next tests

#### **Test 2: Uses User (Fails All Retries)**
1. **Retry 1**: Test fails → Cleanup DON'T run → User still exists ✅
2. **Retry 2**: Test fails → Cleanup DON'T run → User still exists ✅
3. **Retry 3**: Test fails → Cleanup DON'T run → User still exists ✅
4. **Retry 4**: Test fails (final) → Cleanup DON'T run → User still exists ✅
5. **Result**: User remains for Test 3 (NOT cleaned up)

#### **Test 3: Uses User (Last Test)**
1. **Retry 1**: Test fails → Cleanup DON'T run → User still exists ✅
2. **Retry 2**: Test fails → Cleanup DON'T run → User still exists ✅
3. **Retry 3**: Test fails → Cleanup DON'T run → User still exists ✅
4. **Retry 4**: Test fails (final) → Cleanup runs → User deleted ✅
5. **Result**: User deleted only on last test final failure

### **Scenario: Test 2 Passes, Test 3 Uses User**

1. **Test 1**: Creates user → Passes → User remains ✅
2. **Test 2**: Uses user → Passes → User remains ✅
3. **Test 3**: Uses user → Fails all retries → Cleanup runs → User deleted ✅

**Result**: ✅ **User deleted only on last test final failure**

### **Scenario: All Tests Pass**

1. **Test 1**: Creates user → Passes → User remains ✅
2. **Test 2**: Uses user → Passes → User remains ✅
3. **Test 3**: Uses user → Passes → Cleanup runs → User deleted ✅

**Result**: ✅ **User deleted on last test success**

### **Cleanup Summary Table**

| Test | Status | Retry | Cleanup? | Reason |
|------|--------|-------|----------|---------|
| **Test 1** | Pass | 1 | ❌ No | Not last test |
| **Test 2** | Pass | 1 | ❌ No | Not last test |
| **Test 2** | Fail | 1-3 | ❌ No | Not last test |
| **Test 2** | Fail | 4 (final) | ❌ No | Not last test |
| **Test 3** | Pass | 1 | ✅ Yes | Last test |
| **Test 3** | Fail | 4 (final) | ✅ Yes | Last test |

### **Why This Approach?**

- **Preserves test data** across tests in the same suite
- **Only cleans up** on the very last test of the suite
- **Works for both pass and fail** scenarios
- **Allows investigation** of why tests are failing
- **Prevents orphaned users** on final suite completion
- **Maintains test isolation** between different test suites

---

## 🧪 **Testing the Migration**

### **1. Test with Retries**
```bash
# Run a test that's known to fail sometimes
npx playwright test tests/user_permissions_verify.spec.js --retries=3
```

### **2. Verify Cleanup**
- Check that users are cleaned up even on failed retries
- Verify no orphaned users remain in the system
- Check cleanup logs for confirmation

### **3. Monitor Orphaned Users**
- Keep track of orphaned users before/after migration
- Verify the two known orphaned users are cleaned up
- Monitor for new orphaned users

---

## 📊 **Expected Results**

### **Before Migration**
- **Orphaned users**: `autotest-1756985244496-854@verifast.com`, `admin_test+autotest-1756983972749-815@verifast.com`
- **Cleanup rate**: ~70% (only on successful tests)
- **Retry issues**: Users left behind on failed retries

### **After Migration**
- **Orphaned users**: 0 (all cleaned up)
- **Cleanup rate**: 100% (always cleaned up)
- **Retry issues**: None (cleanup works with retries)

---

**Last Updated**: 2025-01-27  
**Version**: 1.0  
**Status**: ✅ Ready for Implementation  
**Coverage**: All UI tests with user/application/session creation
