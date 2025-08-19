import { test as base } from '@playwright/test';
import { ApiDataManager } from '../utils/api-data-manager';

// Extend the base test with our custom fixtures
export const test = base.extend({
  // API Data Manager fixture that provides the manager without auto-cleanup
  dataManager: async ({ request }, use) => {
    const manager = new ApiDataManager(request);
    
    // Use the manager in the test
    await use(manager);
    
    // NO automatic cleanup - let tests control when cleanup happens
  },

  // Pre-created test data that tests can populate
  createdData: async ({}, use) => {
    // Placeholder: will be set by individual tests
    await use({ users: [], applications: [], sessions: [] });
  },

  // Helper fixture for common test data patterns
  testData: async ({}, use) => {
    const prefix = ApiDataManager.uniquePrefix();
    
    const commonTestData = {
      prefix,
      user: ApiDataManager.getDefaultUserData(prefix),
      application: ApiDataManager.getDefaultApplicationData(prefix)
    };

    await use(commonTestData);
  }
});

// Export the test object and types for use in test files
export { expect } from '@playwright/test';
