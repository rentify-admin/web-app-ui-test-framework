#!/usr/bin/env node

/**
 * Load Test Runner - Orchestrator Script
 *
 * Spawns Playwright worker tests at configurable intervals to simulate
 * sustained load on the Verifast verification system.
 *
 * Usage:
 *   node scripts/load-test-runner.js --type identity --duration 10 --interval 15
 *   node scripts/load-test-runner.js --type financial --duration 10 --interval 15 --env rc
 *   node scripts/load-test-runner.js --help
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const CONFIG = {
    session: {
        testFile: 'session_load.spec.js',
        applicationName: 'AutoTest Suite - ID Only',
        description: 'Session creation + START step (Full UI)',
        expectedDuration: 180000 // ~3 min (UI flow is slower)
    },
    identity: {
        testFile: 'identity_load.spec.js',
        applicationName: 'AutoTest Suite - ID Only',
        description: 'Session + Identity file upload (Full UI)',
        expectedDuration: 360000 // ~6 min
    },
    financial: {
        testFile: 'financial_load.spec.js',
        applicationName: 'Autotest - Fin Real File Only',
        description: 'Session + Financial file upload (Full UI)',
        expectedDuration: 480000 // ~8 min
    }
};

const RESULTS_DIR = join(__dirname, '..', 'tests', 'load-testing', 'results');
const TESTS_DIR = join(__dirname, '..', 'tests', 'load-testing', 'pipeline-tests');

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        type: null,
        duration: 10,
        interval: 15,
        env: 'development',
        maxWorkers: 30,
        maxRuns: null, // Stop after N completions (null = no limit)
        help: false
    };

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--type':
            case '-t':
                options.type = args[++i];
                break;
            case '--duration':
            case '-d':
                options.duration = parseInt(args[++i], 10);
                break;
            case '--interval':
            case '-i':
                options.interval = parseInt(args[++i], 10);
                break;
            case '--env':
            case '-e':
                options.env = args[++i];
                break;
            case '--max-workers':
            case '-m':
                options.maxWorkers = parseInt(args[++i], 10);
                break;
            case '--max-runs':
            case '-r':
                options.maxRuns = parseInt(args[++i], 10);
                break;
            case '--help':
            case '-h':
                options.help = true;
                break;
        }
    }

    return options;
}

/**
 * Display help message
 */
function showHelp() {
    console.log(`
Load Test Runner - Verifast Verification Load Testing

Usage:
  node scripts/load-test-runner.js --type <type> [options]

Required:
  --type, -t <type>     Test type: session, identity, or financial

Options:
  --duration, -d <min>  Duration in minutes (default: 10)
  --interval, -i <sec>  Spawn interval in seconds (default: 15)
  --env, -e <env>       Environment: development, rc, staging (default: development)
  --max-workers, -m <n> Maximum concurrent workers (default: 30)
  --max-runs, -r <n>    Stop after N test completions (optional, no limit by default)
  --help, -h            Show this help message

Test Types:
  session    - Session creation + START step only
  identity   - Session + Identity file upload via Files provider
  financial  - Session + Financial file upload via Files provider

Examples:
  # Identity load test, 10 min, 15s interval
  node scripts/load-test-runner.js --type identity --duration 10 --interval 15

  # Financial load test against RC, 5 min
  node scripts/load-test-runner.js --type financial --duration 5 --interval 15 --env rc

  # Quick smoke test
  node scripts/load-test-runner.js --type session --duration 2 --interval 30

  # Stop after 3 completions (even if duration not reached)
  node scripts/load-test-runner.js --type session --duration 10 --interval 15 --max-runs 3
`);
}

/**
 * Generate unique worker ID
 */
function generateWorkerId(type) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${type}-${timestamp}-${random}`;
}

/**
 * Sleep utility
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Spawn a single worker process
 */
function spawnWorker(workerId, config, options) {
    return new Promise((resolve) => {
        const testFile = join(TESTS_DIR, config.testFile);
        const startTime = Date.now();

        // Set environment for worker
        const env = {
            ...process.env,
            LOAD_TEST_WORKER_ID: workerId,
            LOAD_TEST_TYPE: options.type,
            LOAD_TEST_APPLICATION: config.applicationName,
            APP_ENV: options.env,
            LOAD_TEST_RESULTS_DIR: RESULTS_DIR
        };

        console.log(`[${new Date().toISOString()}] Spawning worker: ${workerId}`);

        // Spawn playwright test
        const proc = spawn('npx', [
            'playwright', 'test',
            testFile,
            '--project=chromium',
            '--reporter=list',
            '--timeout=600000' // 10 min timeout per test
        ], {
            cwd: join(__dirname, '..'),
            env,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        proc.on('close', (code) => {
            const duration = Date.now() - startTime;
            const success = code === 0;

            if (success) {
                console.log(`[${new Date().toISOString()}] Worker ${workerId} completed successfully (${(duration / 1000).toFixed(1)}s)`);
            } else {
                console.log(`[${new Date().toISOString()}] Worker ${workerId} failed with code ${code} (${(duration / 1000).toFixed(1)}s)`);
            }

            resolve({
                workerId,
                success,
                duration,
                exitCode: code,
                stdout: stdout.slice(-1000), // Last 1000 chars
                stderr: stderr.slice(-1000)
            });
        });

        proc.on('error', (error) => {
            console.error(`[${new Date().toISOString()}] Worker ${workerId} error: ${error.message}`);
            resolve({
                workerId,
                success: false,
                duration: Date.now() - startTime,
                exitCode: -1,
                error: error.message
            });
        });
    });
}

/**
 * Collect results from worker JSON files
 */
function collectResults() {
    const results = [];

    if (!existsSync(RESULTS_DIR)) {
        return results;
    }

    const files = readdirSync(RESULTS_DIR).filter(f => f.startsWith('load-result-') && f.endsWith('.json'));

    for (const file of files) {
        try {
            const content = readFileSync(join(RESULTS_DIR, file), 'utf-8');
            results.push(JSON.parse(content));
        } catch (e) {
            console.warn(`Failed to read result file ${file}: ${e.message}`);
        }
    }

    return results;
}

/**
 * Cleanup result files
 */
function cleanupResultFiles() {
    if (!existsSync(RESULTS_DIR)) {
        return;
    }

    const files = readdirSync(RESULTS_DIR).filter(f => f.startsWith('load-result-') && f.endsWith('.json'));

    for (const file of files) {
        try {
            unlinkSync(join(RESULTS_DIR, file));
        } catch (e) {
            console.warn(`Failed to delete result file ${file}: ${e.message}`);
        }
    }
}

/**
 * Generate summary report
 */
function generateSummary(workerResults, collectedResults, options, startTime) {
    const total = workerResults.length;
    const passed = workerResults.filter(r => r.success).length;
    const failed = total - passed;
    const durations = workerResults.map(r => r.duration);

    const summary = {
        testType: options.type,
        environment: options.env,
        config: {
            duration: options.duration,
            interval: options.interval,
            maxWorkers: options.maxWorkers
        },
        executionTime: {
            start: new Date(startTime).toISOString(),
            end: new Date().toISOString(),
            totalMs: Date.now() - startTime
        },
        results: {
            total,
            passed,
            failed,
            successRate: total > 0 ? ((passed / total) * 100).toFixed(1) : 0
        },
        timing: {
            avgDuration: durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
            minDuration: durations.length > 0 ? Math.min(...durations) : 0,
            maxDuration: durations.length > 0 ? Math.max(...durations) : 0
        },
        sessions: collectedResults.map(r => ({
            workerId: r.workerId,
            sessionId: r.sessionId,
            status: r.status,
            duration: r.duration
        }))
    };

    // Write summary file
    const summaryPath = join(RESULTS_DIR, 'load-test-summary.json');
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    return summary;
}

/**
 * Print summary to console
 */
function printSummary(summary) {
    console.log('\n' + '='.repeat(70));
    console.log('LOAD TEST SUMMARY');
    console.log('='.repeat(70));
    console.log(`Test Type:      ${summary.testType}`);
    console.log(`Environment:    ${summary.environment}`);
    console.log(`Duration:       ${summary.config.duration} minutes`);
    console.log(`Interval:       ${summary.config.interval} seconds`);
    console.log('');
    console.log(`Total Workers:  ${summary.results.total}`);
    console.log(`Passed:         ${summary.results.passed} (${summary.results.successRate}%)`);
    console.log(`Failed:         ${summary.results.failed}`);
    console.log('');
    console.log(`Avg Duration:   ${(summary.timing.avgDuration / 1000).toFixed(1)}s`);
    console.log(`Min Duration:   ${(summary.timing.minDuration / 1000).toFixed(1)}s`);
    console.log(`Max Duration:   ${(summary.timing.maxDuration / 1000).toFixed(1)}s`);
    console.log('='.repeat(70));
}

/**
 * Main execution
 */
async function main() {
    const options = parseArgs();

    if (options.help) {
        showHelp();
        process.exit(0);
    }

    // Validate options
    if (!options.type || !CONFIG[options.type]) {
        console.error(`Error: Invalid or missing test type. Use: session, identity, or financial`);
        showHelp();
        process.exit(1);
    }

    const config = CONFIG[options.type];
    const durationMs = options.duration * 60 * 1000;
    const intervalMs = options.interval * 1000;

    // Ensure results directory exists
    if (!existsSync(RESULTS_DIR)) {
        mkdirSync(RESULTS_DIR, { recursive: true });
    }

    // Clean up previous results
    cleanupResultFiles();

    console.log('\n' + '='.repeat(70));
    console.log('LOAD TEST RUNNER - VERIFAST');
    console.log('='.repeat(70));
    console.log(`Test Type:      ${options.type} (${config.description})`);
    console.log(`Application:    ${config.applicationName}`);
    console.log(`Environment:    ${options.env}`);
    console.log(`Duration:       ${options.duration} minutes`);
    console.log(`Interval:       ${options.interval} seconds`);
    console.log(`Max Workers:    ${options.maxWorkers}`);
    console.log(`Max Runs:       ${options.maxRuns ? options.maxRuns : 'unlimited'}`);
    console.log(`Expected:       ~${Math.floor(durationMs / intervalMs)} workers`);
    console.log('='.repeat(70) + '\n');

    const startTime = Date.now();
    const workers = new Map(); // workerId -> Promise
    const workerResults = [];
    let spawnCount = 0;

    // Main loop - spawn workers at interval
    while (Date.now() - startTime < durationMs) {
        // Check if max runs reached
        if (options.maxRuns && workerResults.length >= options.maxRuns) {
            console.log(`[${new Date().toISOString()}] Max runs reached (${workerResults.length}/${options.maxRuns}), stopping spawns`);
            break;
        }

        // Check if we can spawn more workers
        const activeWorkers = [...workers.values()].filter(w => !w.completed).length;

        if (activeWorkers < options.maxWorkers) {
            const workerId = generateWorkerId(options.type);
            spawnCount++;

            console.log(`[Spawn #${spawnCount}] Active workers: ${activeWorkers}/${options.maxWorkers}`);

            // Spawn worker (don't await - let it run in background)
            const workerPromise = spawnWorker(workerId, config, options)
                .then(result => {
                    workerResults.push(result);
                    workers.get(workerId).completed = true;
                    return result;
                });

            workerPromise.completed = false;
            workers.set(workerId, workerPromise);
        } else {
            console.log(`[${new Date().toISOString()}] Max workers reached (${activeWorkers}/${options.maxWorkers}), skipping spawn`);
        }

        // Wait for interval (unless duration exceeded)
        const remaining = durationMs - (Date.now() - startTime);
        if (remaining > 0) {
            await sleep(Math.min(intervalMs, remaining));
        }
    }

    console.log(`\n[${new Date().toISOString()}] Duration limit reached. Waiting for remaining workers...`);

    // Wait for all workers to complete (with grace period)
    const graceTimeout = 5 * 60 * 1000; // 5 minutes
    const graceStart = Date.now();

    while (workerResults.length < workers.size && (Date.now() - graceStart) < graceTimeout) {
        const pending = workers.size - workerResults.length;
        console.log(`[${new Date().toISOString()}] Waiting for ${pending} workers to complete...`);
        await sleep(5000);
    }

    // Collect results from worker files
    const collectedResults = collectResults();

    // Generate and print summary
    const summary = generateSummary(workerResults, collectedResults, options, startTime);
    printSummary(summary);

    // Exit with appropriate code
    const successRate = parseFloat(summary.results.successRate);
    const minSuccessRate = options.type === 'session' ? 90 : options.type === 'identity' ? 85 : 80;

    if (successRate < minSuccessRate) {
        console.log(`\nFailed: Success rate ${successRate}% below threshold ${minSuccessRate}%`);
        process.exit(1);
    }

    console.log(`\nPassed: Success rate ${successRate}% meets threshold ${minSuccessRate}%`);
    process.exit(0);
}

main().catch(error => {
    console.error('Load test runner failed:', error);
    process.exit(1);
});
