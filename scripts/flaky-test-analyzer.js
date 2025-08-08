#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

class FlakyTestAnalyzer {
  constructor() {
    this.flakyTests = new Map(); // testName -> { passes: number, fails: number, total: number }
  }

  /**
   * Analyze test results from JUnit XML file
   * @param {string} xmlFilePath - Path to JUnit XML results file
   * @returns {Object} Analysis results
   */
  analyzeTestResults(xmlFilePath) {
    if (!fs.existsSync(xmlFilePath)) {
      console.log(`❌ Results file not found: ${xmlFilePath}`);
      return { flakyTests: [], summary: { total: 0, flaky: 0, stable: 0 } };
    }

    const content = fs.readFileSync(xmlFilePath, 'utf8');
    const testCases = this.extractTestCases(content);
    
    console.log(`📊 Analyzing ${testCases.length} test cases for flakiness...`);
    
    // Group test cases by name (handling retries)
    const testGroups = this.groupTestCases(testCases);
    
    // Analyze each test group for flakiness
    const flakyTests = [];
    const stableTests = [];
    
    for (const [testName, cases] of testGroups) {
      const analysis = this.analyzeTestGroup(testName, cases);
      
      if (analysis.isFlaky) {
        flakyTests.push(analysis);
        this.flakyTests.set(testName, analysis);
      } else {
        stableTests.push(analysis);
      }
    }
    
    const summary = {
      total: testGroups.size,
      flaky: flakyTests.length,
      stable: stableTests.length
    };
    
    console.log(`✅ Analysis complete:`);
    console.log(`   • Total unique tests: ${summary.total}`);
    console.log(`   • Flaky tests: ${summary.flaky}`);
    console.log(`   • Stable tests: ${summary.stable}`);
    
    if (flakyTests.length > 0) {
      console.log(`\n🟡 Flaky tests detected:`);
      flakyTests.forEach(test => {
        console.log(`   • ${test.name}: ${test.passes}P/${test.fails}F (${test.total} runs)`);
      });
    }
    
    return { flakyTests, summary };
  }
  
  /**
   * Extract test cases from JUnit XML content
   */
  extractTestCases(content) {
    const testCaseRegex = /<testcase[^>]*name="([^"]*)"[^>]*>/g;
    const failureRegex = /<failure[^>]*>/g;
    const skippedRegex = /<skipped[^>]*>/g;
    
    const testCases = [];
    let match;
    
    while ((match = testCaseRegex.exec(content)) !== null) {
      const testName = match[1];
      const startPos = match.index;
      
      // Find the end of this test case
      const endPos = content.indexOf('</testcase>', startPos);
      if (endPos === -1) continue;
      
      const testCaseContent = content.substring(startPos, endPos);
      
      // Check for failures and skips
      const hasFailure = failureRegex.test(testCaseContent);
      const hasSkipped = skippedRegex.test(testCaseContent);
      
      // Reset regex for next iteration
      failureRegex.lastIndex = 0;
      skippedRegex.lastIndex = 0;
      
      testCases.push({
        name: testName,
        failed: hasFailure,
        skipped: hasSkipped,
        passed: !hasFailure && !hasSkipped
      });
    }
    
    return testCases;
  }
  
  /**
   * Group test cases by name (handling retries)
   */
  groupTestCases(testCases) {
    const groups = new Map();
    
    testCases.forEach(testCase => {
      // Clean test name (remove retry suffixes)
      const cleanName = this.cleanTestName(testCase.name);
      
      if (!groups.has(cleanName)) {
        groups.set(cleanName, []);
      }
      groups.get(cleanName).push(testCase);
    });
    
    return groups;
  }
  
  /**
   * Clean test name by removing retry suffixes
   */
  cleanTestName(testName) {
    // Remove retry suffixes like "-retry1", "-retry2", etc.
    return testName.replace(/-retry\d+$/, '');
  }
  
  /**
   * Analyze a group of test cases for flakiness
   */
  analyzeTestGroup(testName, cases) {
    // Filter out skipped tests - they don't count for flakiness analysis
    const runCases = cases.filter(c => !c.skipped);
    
    if (runCases.length === 0) {
      return {
        name: testName,
        isFlaky: false,
        passes: 0,
        fails: 0,
        total: 0,
        skipped: cases.length,
        reason: 'All cases skipped'
      };
    }
    
    const passes = runCases.filter(c => c.passed).length;
    const fails = runCases.filter(c => c.failed).length;
    const total = runCases.length;
    const skipped = cases.length - total;
    
    // A test is flaky if it has both passes and failures
    const isFlaky = passes > 0 && fails > 0;
    
    return {
      name: testName,
      isFlaky,
      passes,
      fails,
      total,
      skipped,
      reason: isFlaky ? 'Inconsistent results' : 'Consistent results'
    };
  }
  
  /**
   * Get flaky test names for tagging
   */
  getFlakyTestNames() {
    return Array.from(this.flakyTests.keys());
  }
  
  /**
   * Export analysis results to JSON
   */
  exportResults(outputPath) {
    const results = {
      timestamp: new Date().toISOString(),
      flakyTests: Array.from(this.flakyTests.values()),
      summary: {
        total: this.flakyTests.size,
        flaky: this.flakyTests.size
      }
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`💾 Analysis results exported to: ${outputPath}`);
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const analyzer = new FlakyTestAnalyzer();
  const xmlFile = process.argv[2] || 'playwright-report/results.xml';
  const outputFile = process.argv[3] || 'flaky-analysis.json';
  
  console.log(`🔍 Starting flaky test analysis...`);
  console.log(`📁 Input file: ${xmlFile}`);
  console.log(`📁 Output file: ${outputFile}`);
  
  const results = analyzer.analyzeTestResults(xmlFile);
  analyzer.exportResults(outputFile);
  
  // Exit with code 1 if flaky tests found (for CI)
  if (results.summary.flaky > 0) {
    console.log(`⚠️ ${results.summary.flaky} flaky tests detected`);
    process.exit(1);
  } else {
    console.log(`✅ No flaky tests detected`);
    process.exit(0);
  }
}

export { FlakyTestAnalyzer };
