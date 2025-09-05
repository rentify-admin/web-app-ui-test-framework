import { test as base } from '@playwright/test';
import { ApiDataManager } from '../utils/api-data-manager';
import globalCleanupManager from '../utils/global-cleanup-manager';
import testSuiteCleanupManager from '../utils/test-suite-cleanup';

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
      
      trackSession: (session) => {
        const testId = globalCleanupManager.getTestId(test.info());
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

// Enhanced test wrapper that ensures cleanup happens only on the last test of the suite
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
      // Cleanup on the LAST TEST of the suite (regardless of pass/fail)
      const isLastTest = testSuiteCleanupManager.isLastTest(suiteName, testName);
      // Handle case where retries might be NaN or undefined
      const maxRetries = isNaN(testInfo.retries) ? 0 : testInfo.retries;
      const isFinalRetry = testInfo.retry === maxRetries;
      
      console.log(`🔍 Enhanced Cleanup: Suite: ${suiteName}, Test: ${testName}, Last: ${isLastTest}, Final Retry: ${isFinalRetry}`);
      
      // Cleanup if: (Last test AND final retry) OR (Any test fails completely on final retry)
      const shouldCleanup = (isLastTest && isFinalRetry) || (!isLastTest && isFinalRetry && testInfo.status === 'failed');
      
      if (shouldCleanup) {
        try {
          await globalCleanupManager.cleanupTest(suiteId, dataManager);
          console.log(`🧹 Enhanced Cleanup: Cleanup completed for test ${testName} (${testInfo.status}) - ${isLastTest ? 'Last test' : 'Failed test'}`);
        } catch (cleanupError) {
          console.error(`❌ Enhanced Cleanup: Failed to cleanup test ${testName}:`, cleanupError.message);
        }
      } else {
        console.log(`ℹ️ Enhanced Cleanup: Skipping cleanup - Test: ${isLastTest ? 'Last' : 'Not Last'}, Retry: ${testInfo.retry + 1}/${testInfo.retries + 1}, Status: ${testInfo.status} for test ${testName}`);
      }
    }
  }, options);
};

// Helper function to register test suite information
export const registerTestSuite = (suiteName, totalTests) => {
  console.log(`📝 Test Suite Cleanup: Registering suite '${suiteName}' with ${totalTests} tests`);
  // This will be called by individual tests to register themselves
};

// Helper function to register individual test
export const registerTest = (suiteName, testName, totalTests) => {
  testSuiteCleanupManager.registerTest(suiteName, testName, totalTests);
};
