/**
 * Playwright Global Setup
 *
 * Bootstraps test data before all tests run.
 * Integrates with the Test Data Management system (Option F).
 *
 * @module global-setup
 */

import { globalSetup as bootstrapSetup } from './helpers/test-data-bootstrap.js';

/**
 * Global setup function called by Playwright before all tests
 * @param {Object} config - Playwright configuration
 */
async function globalSetup(config) {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║           PLAYWRIGHT GLOBAL SETUP                          ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');

    // Log environment info
    console.log('📋 Environment:');
    console.log(`   APP_ENV: ${process.env.APP_ENV || 'development'}`);
    console.log(`   TEST_DATA_MODE: ${process.env.TEST_DATA_MODE || 'AUTO'}`);
    console.log(`   CAPTURE_SNAPSHOT: ${process.env.CAPTURE_SNAPSHOT || 'false'}`);
    console.log(`   CAPTURE_SNAPSHOT_ON_SUCCESS: ${process.env.CAPTURE_SNAPSHOT_ON_SUCCESS || 'false'}`);
    console.log('');

    try {
        // Run test data bootstrap
        await bootstrapSetup();

        console.log('');
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║           GLOBAL SETUP COMPLETE - STARTING TESTS           ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log('\n');

    } catch (error) {
        console.error('\n');
        console.error('╔════════════════════════════════════════════════════════════╗');
        console.error('║           GLOBAL SETUP FAILED                              ║');
        console.error('╚════════════════════════════════════════════════════════════╝');
        console.error('');
        console.error('Error:', error.message);
        console.error('');

        // Re-throw to fail the test run
        throw error;
    }
}

export default globalSetup;
