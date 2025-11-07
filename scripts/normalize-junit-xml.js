#!/usr/bin/env node

import fs from 'fs';

const xmlPath = 'playwright-report/results.xml';

if (!fs.existsSync(xmlPath)) {
    console.log('⚠️ No results.xml found, skipping normalization');
    process.exit(0);
}

console.log('🔧 Normalizing JUnit XML for TestRail compatibility...');

// Backup original
fs.copyFileSync(xmlPath, `${xmlPath}.backup`);

// Read XML content
let content = fs.readFileSync(xmlPath, 'utf8');

// Normalize special characters that cause TestRail mismatches
const replacements = [
    { from: /—/g, to: '-' },        // Em-dash
    { from: /–/g, to: '-' },        // En-dash
    { from: /→/g, to: '->' },       // Right arrow
    { from: /←/g, to: '<-' },       // Left arrow
    { from: /"/g, to: '"' },        // Left double quote
    { from: /"/g, to: '"' },        // Right double quote
    { from: /'/g, to: "'" },        // Left single quote
    { from: /'/g, to: "'" },        // Right single quote
];

replacements.forEach(({ from, to }) => {
    content = content.replace(from, to);
});

// Write normalized content
fs.writeFileSync(xmlPath, content, 'utf8');

console.log('✅ XML normalization completed');
console.log('📊 Preview normalized XML:');
console.log(content.split('\n').slice(0, 20).join('\n'));
