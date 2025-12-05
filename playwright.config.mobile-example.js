// @ts-check
// EXAMPLE MOBILE CONFIGURATION - Proof of Concept
// This file demonstrates how playwright.config.js would look with mobile viewport testing enabled
// Copy sections from this file to playwright.config.js to implement mobile testing

import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment-specific config
const env = process.env.APP_ENV || 'development';
const envFile = env === 'staging' ? '.env.staging' : env === 'rc' ? '.env.rc' : '.env.develop';
console.log(`🔧 Environment: ${env}`);
console.log(`📄 Loading config from: ${envFile}`);
console.log(`🌐 APP_URL will be: ${env === 'staging' ? 'staging.verifast.app' : env === 'rc' ? 'rc.verifast.app' : 'dev.verifast.app'}`);
dotenv.config({ path: resolve(__dirname, envFile) });

const isCI = !!process.env.CI;

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: isCI,
    retries: isCI ? 3 : 3,
    workers: isCI ? 1 : undefined,
    captureGitInfo: isCI ? { commit: false, diff: false } : undefined,
    
    reporter: [
        [ 'html' ],
        [ 'junit', { outputFile: 'playwright-report/results.xml' }],
        [ 'list' ]
    ],

    timeout: 100_000,

    use: {
        ignoreHTTPSErrors: true,
        baseURL: process.env.APP_URL,
        trace: 'on-first-retry',
        video: 'retain-on-failure'
    },

    /* ========================================
     * MOBILE TESTING - THREE IMPLEMENTATION OPTIONS
     * ======================================== */

    /* 
     * OPTION 1: MINIMAL - Single Mobile Device
     * Adds one mobile device for quick validation
     * Uncomment the "Mobile Chrome" project below
     */
    projects: [
        // Desktop (existing)
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                contextOptions: { 
                    permissions: [ 'geolocation', 'notifications', 'clipboard-read', 'clipboard-write' ] 
                },
                launchOptions: {
                    args: [
                        '--disable-web-security',
                        '--use-fake-ui-for-media-stream',
                        '--use-fake-device-for-media-stream'
                    ]
                }
            }
        },

        // OPTION 1: Add this single mobile project
        {
            name: 'mobile-chrome',
            use: {
                ...devices['Pixel 5'],
                contextOptions: { 
                    permissions: [ 'geolocation', 'notifications', 'clipboard-read', 'clipboard-write' ] 
                },
                launchOptions: {
                    args: [
                        '--disable-web-security',
                        '--use-fake-ui-for-media-stream',
                        '--use-fake-device-for-media-stream'
                    ]
                }
            }
        }

        /* 
         * OPTION 2: MULTI-DEVICE - iOS + Android
         * Adds both mobile platforms for comprehensive coverage
         * Uncomment both mobile projects below
         */
        // {
        //     name: 'mobile-safari',
        //     use: {
        //         ...devices['iPhone 12'],
        //         contextOptions: { 
        //             // Note: Safari doesn't support clipboard-read/write permissions
        //             permissions: [ 'geolocation', 'notifications' ] 
        //         }
        //     }
        // }

        /* 
         * OPTION 3: SELECTIVE TESTING - Using Tags
         * Runs only mobile-compatible tests on mobile devices
         * Tag tests with @mobile-compatible to include them
         */
        // {
        //     name: 'mobile-chrome-selective',
        //     use: {
        //         ...devices['Pixel 5'],
        //         contextOptions: { 
        //             permissions: [ 'geolocation', 'notifications', 'clipboard-read', 'clipboard-write' ] 
        //         },
        //         launchOptions: {
        //             args: [
        //                 '--disable-web-security',
        //                 '--use-fake-ui-for-media-stream',
        //                 '--use-fake-device-for-media-stream'
        //             ]
        //         }
        //     },
        //     grep: /@mobile-compatible/  // Only run tests tagged with @mobile-compatible
        // }

        /* 
         * BONUS: TABLET TESTING
         * Add iPad testing for tablet viewport
         */
        // {
        //     name: 'tablet-ipad',
        //     use: {
        //         ...devices['iPad (gen 7)'],
        //         contextOptions: { 
        //             permissions: [ 'geolocation', 'notifications' ] 
        //         }
        //     }
        // }

        /* 
         * CUSTOM VIEWPORT - Define your own size
         * Useful for specific breakpoints or custom devices
         */
        // {
        //     name: 'mobile-small',
        //     use: {
        //         ...devices['Desktop Chrome'],
        //         viewport: { width: 375, height: 667 },  // iPhone SE size
        //         deviceScaleFactor: 2,
        //         isMobile: true,
        //         hasTouch: true,
        //         contextOptions: { 
        //             permissions: [ 'geolocation', 'notifications', 'clipboard-read', 'clipboard-write' ] 
        //         },
        //         launchOptions: {
        //             args: [
        //                 '--disable-web-security',
        //                 '--use-fake-ui-for-media-stream',
        //                 '--use-fake-device-for-media-stream'
        //             ]
        //         }
        //     }
        // }
    ]
});

/* ========================================
 * COMMON MOBILE DEVICE SIZES (for reference)
 * ======================================== */
/*
 * PHONES:
 * - Pixel 5: 393x851 (Android)
 * - iPhone 12: 390x844 (iOS)
 * - iPhone 14 Pro Max: 430x932 (iOS Large)
 * - Galaxy S9+: 412x846 (Android)
 * - iPhone SE: 375x667 (iOS Small)
 * 
 * TABLETS:
 * - iPad (gen 7): 810x1080 (portrait)
 * - iPad Mini: 768x1024
 * - iPad Pro 11: 834x1194
 * 
 * CUSTOM BREAKPOINTS (if app uses specific sizes):
 * - Mobile: < 768px
 * - Tablet: 768px - 1024px
 * - Desktop: > 1024px
 */

/* ========================================
 * EXECUTION EXAMPLES
 * ======================================== */
/*
 * // Run all tests on mobile chrome
 * npx playwright test --project=mobile-chrome
 * 
 * // Run specific test on mobile
 * npx playwright test tests/frontend_heartbeat.spec.js --project=mobile-chrome
 * 
 * // Run heartbeat tests on mobile
 * npx playwright test heartbeat_* --project=mobile-chrome
 * 
 * // Run on both desktop and mobile
 * npx playwright test --project=chromium --project=mobile-chrome
 * 
 * // Run only mobile-compatible tests on mobile (if using tags)
 * npx playwright test --project=mobile-chrome-selective
 * 
 * // Open UI mode for mobile testing
 * npx playwright test --project=mobile-chrome --ui
 * 
 * // Run with environment
 * APP_ENV=staging npx playwright test --project=mobile-chrome
 */

/* ========================================
 * TAGGING TESTS FOR SELECTIVE MOBILE TESTING
 * ======================================== */
/*
 * In your test files, add the @mobile-compatible tag:
 * 
 * test('Create New Session from Dashboard',
 *     {
 *         tag: ['@core', '@regression', '@mobile-compatible'],
 *         timeout: 180_000
 *     },
 *     async ({ page }) => {
 *         // Test code
 *     }
 * );
 * 
 * Tests without the tag will NOT run on projects with grep: /@mobile-compatible/
 */

/* ========================================
 * RECOMMENDED STARTING POINT
 * ======================================== */
/*
 * 1. Start with OPTION 1 (single mobile-chrome project)
 * 2. Run heartbeat tests only:
 *    npx playwright test heartbeat_* --project=mobile-chrome
 * 3. Review results and fix any failures
 * 4. Gradually expand to more tests
 * 5. Add mobile-safari if needed
 * 6. Consider OPTION 3 (selective testing) for production use
 */

