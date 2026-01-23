/**
 * Test Data Bootstrap Manager
 *
 * Orchestrates test data setup based on configured mode.
 * Integrates with SnapshotManager for hybrid data management.
 *
 * @module test-data-bootstrap
 */

import { execSync } from 'child_process';
import path from 'path';
import { SnapshotManager } from './snapshot-manager.js';

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
    apiPath: '/Users/isecco/Code/verifast/api',
    seeders: [
        'SystemDataSeeder', // Main seeder that creates all base data
    ],
    timeout: 120000, // 2 minutes max for seeding
};

/**
 * TestDataBootstrap class
 * Manages test data lifecycle and mode selection
 */
export class TestDataBootstrap {
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.snapshotManager = new SnapshotManager();
        this.bootstrapResult = null;
    }

    /**
     * Main bootstrap function - called in global setup
     * @returns {Promise<Object>} Bootstrap result with mode and timing info
     */
    async bootstrap() {
        console.log('\n' + '='.repeat(60));
        console.log('🚀 TEST DATA BOOTSTRAP');
        console.log('='.repeat(60));

        const startTime = Date.now();
        const useDynamic = this.snapshotManager.shouldUseDynamicMode();

        try {
            if (useDynamic) {
                await this.bootstrapDynamic();
            } else {
                await this.bootstrapFromSnapshot();
            }

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);

            this.bootstrapResult = {
                success: true,
                mode: useDynamic ? 'DYNAMIC' : 'SNAPSHOT',
                durationSeconds: parseFloat(duration),
                timestamp: new Date().toISOString(),
            };

            console.log('='.repeat(60));
            console.log(`✅ Bootstrap completed in ${duration}s`);
            console.log('='.repeat(60) + '\n');

            return this.bootstrapResult;

        } catch (error) {
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);

            this.bootstrapResult = {
                success: false,
                mode: useDynamic ? 'DYNAMIC' : 'SNAPSHOT',
                durationSeconds: parseFloat(duration),
                error: error.message,
                timestamp: new Date().toISOString(),
            };

            console.error('='.repeat(60));
            console.error(`❌ Bootstrap FAILED after ${duration}s`);
            console.error(`   Error: ${error.message}`);
            console.error('='.repeat(60) + '\n');

            throw error;
        }
    }

    /**
     * Bootstrap with dynamic data creation via seeders
     * @returns {Promise<void>}
     */
    async bootstrapDynamic() {
        console.log('\n🔧 DYNAMIC MODE: Creating fresh test data\n');

        const startTime = Date.now();

        try {
            // Step 1: Run fresh migrations
            console.log('1️⃣  Running fresh migrations...');
            await this.runArtisanCommand('migrate:fresh --force');
            console.log('   ✅ Migrations completed\n');

            // Step 2: Run seeders
            console.log('2️⃣  Running seeders...');
            for (const seeder of this.config.seeders) {
                console.log(`   📦 Seeding: ${seeder}`);
                await this.runArtisanCommand(`db:seed --class=${seeder} --force`);
            }
            console.log('   ✅ Seeders completed\n');

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`✅ Dynamic bootstrap completed in ${duration}s`);

            // Step 3: Optionally capture snapshot
            if (process.env.CAPTURE_SNAPSHOT === 'true') {
                console.log('\n📸 Capturing snapshot (CAPTURE_SNAPSHOT=true)...');
                await this.snapshotManager.createSnapshot({
                    capturedVia: 'dynamic-bootstrap',
                    seeders: this.config.seeders,
                });
            }

        } catch (error) {
            console.error('❌ Dynamic bootstrap failed:', error.message);
            throw error;
        }
    }

    /**
     * Bootstrap from existing snapshot
     * @returns {Promise<void>}
     */
    async bootstrapFromSnapshot() {
        console.log('\n📸 SNAPSHOT MODE: Restoring from snapshot\n');

        try {
            await this.snapshotManager.restoreSnapshot();

            // Optionally run any pending migrations
            if (process.env.RUN_PENDING_MIGRATIONS === 'true') {
                console.log('\n🔄 Running pending migrations...');
                await this.runArtisanCommand('migrate --force');
            }

        } catch (error) {
            console.error('❌ Snapshot restore failed:', error.message);
            console.log('\n🔄 Falling back to dynamic mode...\n');

            // Fallback to dynamic mode
            await this.bootstrapDynamic();
        }
    }

    /**
     * Run Laravel artisan command
     * @param {string} command - Artisan command to run
     * @returns {Promise<string>} Command output
     */
    async runArtisanCommand(command) {
        return new Promise((resolve, reject) => {
            const fullCommand = `cd "${this.config.apiPath}" && php artisan ${command}`;

            try {
                const output = execSync(fullCommand, {
                    timeout: this.config.timeout,
                    encoding: 'utf8',
                    stdio: ['pipe', 'pipe', 'pipe'],
                    env: {
                        ...process.env,
                        // Ensure we're using the test database
                        APP_ENV: 'testing',
                    },
                });

                resolve(output);
            } catch (error) {
                reject(new Error(`Artisan command failed: ${command}\n${error.message}`));
            }
        });
    }

    /**
     * Teardown function - called in global teardown
     * Optionally captures snapshot after successful test run
     * @param {boolean} testsSucceeded - Whether all tests passed
     * @returns {Promise<void>}
     */
    async teardown(testsSucceeded = true) {
        console.log('\n' + '='.repeat(60));
        console.log('🏁 TEST DATA TEARDOWN');
        console.log('='.repeat(60));

        // Capture snapshot on success if configured
        if (testsSucceeded && process.env.CAPTURE_SNAPSHOT_ON_SUCCESS === 'true') {
            console.log('\n✅ Tests passed! Capturing snapshot...');

            try {
                await this.snapshotManager.createSnapshot({
                    capturedVia: 'successful-test-run',
                    bootstrapMode: this.bootstrapResult?.mode,
                });

                // Cleanup old snapshots
                this.snapshotManager.cleanupOldSnapshots();

            } catch (error) {
                console.error('⚠️  Failed to capture snapshot:', error.message);
                // Don't throw - this is not critical
            }
        }

        console.log('\n' + '='.repeat(60) + '\n');
    }

    /**
     * Get current bootstrap status
     * @returns {Object} Bootstrap status
     */
    getStatus() {
        return {
            bootstrapResult: this.bootstrapResult,
            snapshotConfig: this.snapshotManager.getModeConfig(),
            availableSnapshots: this.snapshotManager.listSnapshots(),
        };
    }
}

/**
 * Singleton instance for global setup/teardown
 */
let bootstrapInstance = null;

/**
 * Get or create bootstrap instance
 * @param {Object} config - Optional configuration
 * @returns {TestDataBootstrap}
 */
export function getBootstrapInstance(config = {}) {
    if (!bootstrapInstance) {
        bootstrapInstance = new TestDataBootstrap(config);
    }
    return bootstrapInstance;
}

/**
 * Global setup function for Playwright
 * @returns {Promise<void>}
 */
export async function globalSetup() {
    const bootstrap = getBootstrapInstance();
    await bootstrap.bootstrap();
}

/**
 * Global teardown function for Playwright
 * @returns {Promise<void>}
 */
export async function globalTeardown() {
    if (bootstrapInstance) {
        // Determine if tests succeeded based on exit code or env var
        const testsSucceeded = process.env.TESTS_FAILED !== 'true';
        await bootstrapInstance.teardown(testsSucceeded);
    }
}

export default TestDataBootstrap;
