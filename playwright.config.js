// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import dotenv from 'dotenv';

// import path from 'path';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// eslint-disable-next-line
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment-specific config
const env = process.env.APP_ENV || 'development';
const envFile = env === 'staging' ? '.env.staging' : '.env.develop';
dotenv.config({ path: resolve(__dirname, envFile) });

/**
 * @see https://playwright.dev/docs/test-configuration
 */
const isCI = !!process.env.CI;

export default defineConfig({
    testDir: './tests',

    /* Run tests in files in parallel */
    fullyParallel: true,

    /* Fail the build on CI if you accidentally left test.only in the source code. */
    forbidOnly: isCI,

    /* Retry on CI only */
    retries: isCI ? 3 : 3,

    /* Opt out of parallel tests on CI. */
    workers: isCI ? 1 : undefined,

    /* Turn off commit/diff collection to avoid git fetch timeouts in CI */
    captureGitInfo: isCI ? { commit: false, diff: false } : undefined,

    /* Reporter to use. See https://playwright.dev/docs/test-reporters */
    reporter: [
        [ 'html' ],
        [ 'junit', { outputFile: 'playwright-report/results.xml' }],
        [ 'list' ] // Add list reporter for progress
    ],

    timeout: 100_000,

    /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
    use: {
        ignoreHTTPSErrors: true,

        /* Base URL to use in actions like `await page.goto('/')`. */
        baseURL: process.env.APP_URL,

        /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
        trace: 'on-first-retry',

        // Removed clipboard permissions from global config - Firefox doesn't support them

        // Video recording config: https://playwright.dev/docs/test-recording#video-recording
        // video: 'on', // 'on' = always, 'retain-on-failure' = only on failure, 'off' = never
        video: 'retain-on-failure'
    },

    /* Configure projects for major browsers */
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                contextOptions: { permissions: [ 'geolocation', 'notifications', 'clipboard-read', 'clipboard-write' ] },
                launchOptions: {
                    args: [
                        '--disable-web-security',
                        '--use-fake-ui-for-media-stream',
                        '--use-fake-device-for-media-stream'
                    ]
                }
            }
        }
        // ,{
        //     name: 'firefox',
        //     use: { ...devices['Desktop Firefox'] }
        // },

        // {
        //     name: 'webkit',
        //     use: { ...devices['Desktop Safari'] }
        // }

        /* Test against mobile viewports. */
        // {
        //   name: 'Mobile Chrome',
        //   use: { ...devices['Pixel 5'] },
        // },
        // {
        //   name: 'Mobile Safari',
        //   use: { ...devices['iPhone 12'] },
        // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
    ]

    /* Run your local dev server before starting the tests */
    // webServer: {
    //   command: 'npm run start',
    //   url: 'http://127.0.0.1:3000',
    //   reuseExistingServer: !process.env.CI,
    // },
});
