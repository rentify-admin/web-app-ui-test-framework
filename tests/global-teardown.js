/**
 * Playwright Global Teardown
 *
 * Cleans up after all tests complete.
 * Optionally captures snapshot on successful test run.
 *
 * @module global-teardown
 */

import { globalTeardown as bootstrapTeardown } from './helpers/test-data-bootstrap.js';

/**
 * Global teardown function called by Playwright after all tests
 * @param {Object} config - Playwright configuration
 */
async function globalTeardown(config) {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║           PLAYWRIGHT GLOBAL TEARDOWN                       ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');

    try {
        // Determine if tests succeeded
        // Note: Playwright doesn't provide this directly, so we use an env var
        // that can be set by the test reporter or CI
        const testsSucceeded = process.env.TESTS_FAILED !== 'true';

        console.log(`📊 Test Result: ${testsSucceeded ? '✅ PASSED' : '❌ FAILED'}`);
        console.log('');

        // Run teardown (may capture snapshot if configured)
        await bootstrapTeardown(testsSucceeded);

        console.log('');
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║           GLOBAL TEARDOWN COMPLETE                         ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log('\n');

    } catch (error) {
        console.error('\n');
        console.error('⚠️  Teardown error (non-fatal):', error.message);
        console.error('');
        // Don't re-throw - teardown errors shouldn't fail the test run
    }
}

export default globalTeardown;
