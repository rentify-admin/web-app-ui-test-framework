#!/usr/bin/env node

import { execSync } from 'child_process';
import { readdirSync } from 'fs';
import { join } from 'path';

// Count total test files
const testsDir = join(process.cwd(), 'tests');
const testFiles = readdirSync(testsDir).filter(file => file.endsWith('.spec.js'));
const totalFiles = testFiles.length;

console.log(`🚀 Starting test execution for ${totalFiles} test files...`);
console.log('📊 Progress: [░░░░░░░░░░] 0%');

// Function to create progress bar
function createProgressBar(completed, total) {
    const percentage = Math.round((completed / total) * 100);
    const filled = Math.round((completed / total) * 10);
    const empty = 10 - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return `[${bar}] ${percentage}%`;
}

// Function to update progress
function updateProgress(current, total) {
    const progressBar = createProgressBar(current, total);
    process.stdout.write(`\r📊 Progress: ${progressBar} (${current}/${total} files)`);
}

// Run tests with progress tracking
try {
    console.log('\n🧪 Running tests...\n');
    
    // Run the actual test command
    const args = process.argv.slice(2);
    const testCommand = `npx playwright test ${args.join(' ')}`;
    console.log(`Executing: ${testCommand}`);
    execSync(testCommand, { 
        stdio: 'inherit',
        env: { ...process.env, FORCE_COLOR: '1' },
        shell: true
    });
    
    console.log('\n✅ All tests completed!');
    
} catch (error) {
    console.log('\n❌ Test execution failed!');
    process.exit(1);
}
