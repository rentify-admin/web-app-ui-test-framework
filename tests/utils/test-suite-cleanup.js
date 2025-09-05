/**
 * Test Suite Cleanup Manager
 * Handles cleanup logic for test suites with multiple tests
 * Ensures cleanup only happens on the last test of the suite
 */

class TestSuiteCleanupManager {
    constructor() {
        this.suiteTests = new Map(); // Map<suiteName, {totalTests, currentTest, tests: []}>
    }

    /**
     * Register a test in a suite
     * @param {string} suiteName - Name of the test suite
     * @param {string} testName - Name of the test
     * @param {number} totalTests - Total number of tests in the suite
     */
    registerTest(suiteName, testName, totalTests) {
        if (!this.suiteTests.has(suiteName)) {
            this.suiteTests.set(suiteName, {
                totalTests,
                currentTest: 0,
                tests: []
            });
        }

        const suite = this.suiteTests.get(suiteName);
        suite.tests.push(testName);
        suite.currentTest = suite.tests.length;

        console.log(`📝 Test Suite Cleanup: Registered test ${suite.currentTest}/${totalTests} in suite '${suiteName}': ${testName}`);
    }

    /**
     * Check if this is the last test in the suite
     * @param {string} suiteName - Name of the test suite
     * @param {string} testName - Name of the test
     * @returns {boolean} True if this is the last test
     */
    isLastTest(suiteName, testName) {
        const suite = this.suiteTests.get(suiteName);
        if (!suite) return false;

        const isLast = suite.currentTest === suite.totalTests;
        console.log(`🔍 Test Suite Cleanup: Test '${testName}' is ${isLast ? 'LAST' : 'NOT LAST'} in suite '${suiteName}' (${suite.currentTest}/${suite.totalTests})`);
        
        return isLast;
    }

    /**
     * Get suite information
     * @param {string} suiteName - Name of the test suite
     * @returns {Object} Suite information
     */
    getSuiteInfo(suiteName) {
        return this.suiteTests.get(suiteName) || null;
    }

    /**
     * Clear suite information
     * @param {string} suiteName - Name of the test suite
     */
    clearSuite(suiteName) {
        this.suiteTests.delete(suiteName);
        console.log(`🧹 Test Suite Cleanup: Cleared suite '${suiteName}'`);
    }
}

// Global instance
const testSuiteCleanupManager = new TestSuiteCleanupManager();

export default testSuiteCleanupManager;
