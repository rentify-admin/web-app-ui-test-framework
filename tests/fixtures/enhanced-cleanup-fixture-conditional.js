import { test as base } from '@playwright/test';
import { ApiDataManager } from '../utils/api-data-manager';
import globalCleanupManager from '../utils/global-cleanup-manager';
import testSuiteCleanupManager from '../utils/test-suite-cleanup';

/**
 * Enhanced cleanup fixture with CONDITIONAL cleanup
 * 
 * KEY DIFFERENCE from enhanced-cleanup-fixture.js:
 * - Only cleans up if test PASSES on final retry
 * - Preserves sessions/data for debugging if test FAILS
 * 
 * Use this when you want to debug failed tests by examining created resources.
 */

// Extend the base test with enhanced cleanup capabilities
export const test = base.extend({
  // Enhanced API Data Manager fixture with global cleanup integration
  dataManager: async ({ request }, use) => {
    const manager = new ApiDataManager(request);
    
    // Use the manager in the test
    await use(manager);
    
    // Enhanced cleanup: Always cleanup regardless of test outcome
    // This runs after each test, including retries
  },

  // Enhanced test data fixture with automatic cleanup tracking
  testData: async ({}, use) => {
    const prefix = ApiDataManager.uniquePrefix();
    
    const commonTestData = {
      prefix,
      user: ApiDataManager.getDefaultUserData(prefix),
      application: ApiDataManager.getDefaultApplicationData(prefix)
    };

    await use(commonTestData);
  },

  // Cleanup helper fixture for manual cleanup control
  cleanupHelper: async ({ dataManager }, use) => {
    const helper = {
      dataManager,
      globalCleanupManager,
      
      // Track entities for cleanup
      trackUser: (user, suiteId = null) => {
        const testId = suiteId || globalCleanupManager.getTestId(test.info());
        globalCleanupManager.trackUser(testId, user);
      },
      
      trackApplication: (application) => {
        const testId = globalCleanupManager.getTestId(test.info());
        globalCleanupManager.trackApplication(testId, application);
      },
      
      trackSession: (session, suiteId = null) => {
        const testId = suiteId || globalCleanupManager.getTestId(test.info());
        globalCleanupManager.trackSession(testId, session);
      },
      
      // Get cleanup status
      getCleanupStatus: () => {
        const testId = globalCleanupManager.getTestId(test.info());
        return globalCleanupManager.getCleanupStatus(testId);
      },
      
      // Manual cleanup (if needed)
      cleanupNow: async () => {
        const testId = globalCleanupManager.getTestId(test.info());
        await globalCleanupManager.cleanupTest(testId, dataManager);
      }
    };

    await use(helper);
  }
});

// Export the test object and types for use in test files
export { expect } from '@playwright/test';

/**
 * Enhanced test wrapper with CONDITIONAL cleanup
 * 
 * Cleanup behavior:
 * - ✅ Test PASSES on final retry → Cleanup runs (delete sessions/users/etc)
 * - ⚠️ Test FAILS on final retry → Cleanup SKIPPED (preserve for debugging)
 * - ℹ️ Not final retry → Cleanup SKIPPED (will retry)
 * 
 * @param {string} testName - Test name
 * @param {Function} testFn - Test function
 * @param {Object} options - Test options (tags, timeout, etc)
 */
export const testWithCleanup = (testName, testFn, options = {}) => {
  return test(testName, async ({ page, context, dataManager, cleanupHelper }, testInfo) => {
    const testId = globalCleanupManager.getTestId(testInfo);
    // Extract suite name from the describe block (testInfo.titlePath[1])
    const suiteName = testInfo.titlePath[1] || testInfo.titlePath[0]; // Get suite name from describe block
    const suiteId = `suite_${suiteName}`; // Use suite-level ID for tracking
    
    try {
      // Run the test
      await testFn({ page, context, dataManager, cleanupHelper }, testInfo);
    } finally {
      // Cleanup ONLY on final retry AND if test PASSED
      const maxRetries = isNaN(testInfo.retries) ? 0 : testInfo.retries;
      const isFinalRetry = testInfo.retry === maxRetries;
      const testPassed = testInfo.status === 'passed';
      
      console.log(`🔍 Conditional Cleanup: Suite: ${suiteName}, Test: ${testName}`);
      console.log(`   - Final Retry: ${isFinalRetry} (${testInfo.retry + 1}/${testInfo.retries + 1})`);
      console.log(`   - Status: ${testInfo.status}`);
      
      // ✨ KEY DIFFERENCE: Only cleanup if test PASSED
      const shouldCleanup = isFinalRetry && testPassed;
      
      if (shouldCleanup) {
        try {
          await globalCleanupManager.cleanupTest(suiteId, dataManager);
          console.log(`✅ Conditional Cleanup: Cleanup completed (test passed)`);
        } catch (cleanupError) {
          console.error(`❌ Conditional Cleanup: Failed to cleanup:`, cleanupError.message);
        }
      } else if (isFinalRetry && !testPassed) {
        console.log(`⚠️ Conditional Cleanup: KEEPING resources for debugging (test failed)`);
        console.log(`   💡 Tip: Check tracked resources in globalCleanupManager for suite: ${suiteName}`);
        console.log(`   🔑 Suite ID used for tracking: ${suiteId}`);
        
        // List tracked resources for debugging - use suiteId directly
        const status = globalCleanupManager.getCleanupStatus(suiteId);
        if (status) {
          const resourceCount = 
            (status.users?.length || 0) + 
            (status.sessions?.length || 0) + 
            (status.applications?.length || 0);
          console.log(`   📊 Preserved ${resourceCount} resource(s) for debugging`);
          if (status.sessions && status.sessions.length > 0) {
            console.log(`   📋 Session IDs preserved:`, status.sessions.map(s => s.id));
          }
        } else {
          console.log(`   ⚠️ No cleanup status found for suiteId: ${suiteId}`);
          console.log(`   🔍 Checking all tracked resources...`);
          // Debug: try to see what's actually tracked
          const allStatus = globalCleanupManager.getCleanupStatus(testId);
          if (allStatus) {
            console.log(`   📊 Found resources under testId ${testId}:`, allStatus);
          }
        }
      } else {
        console.log(`ℹ️ Conditional Cleanup: Skipping cleanup (retry ${testInfo.retry + 1}/${testInfo.retries + 1})`);
      }
    }
  }, options);
};

/**
 * Helper function to register test suite information
 */
export const registerTestSuite = (suiteName, totalTests) => {
  console.log(`📝 Test Suite Cleanup: Registering suite '${suiteName}' with ${totalTests} tests`);
  // This will be called by individual tests to register themselves
};

/**
 * Helper function to register individual test
 */
export const registerTest = (suiteName, testName, totalTests) => {
  testSuiteCleanupManager.registerTest(suiteName, testName, totalTests);
};

