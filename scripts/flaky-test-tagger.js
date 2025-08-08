#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

class FlakyTestTagger {
  constructor() {
    this.testsDir = 'tests';
    this.tagPattern = /@flaky\b/;
  }

  /**
   * Tag flaky tests by adding @flaky tag to their test definitions
   * @param {Array} flakyTestNames - Array of flaky test names
   * @param {string} testsDir - Directory containing test files
   */
  tagFlakyTests(flakyTestNames, testsDir = this.testsDir) {
    if (!fs.existsSync(testsDir)) {
      console.log(`❌ Tests directory not found: ${testsDir}`);
      return { tagged: 0, errors: 0 };
    }

    console.log(`🏷️ Starting to tag ${flakyTestNames.length} flaky tests...`);
    
    const testFiles = this.findTestFiles(testsDir);
    let taggedCount = 0;
    let errorCount = 0;
    
    for (const testName of flakyTestNames) {
      try {
        const tagged = this.tagTestInFiles(testName, testFiles);
        if (tagged) {
          taggedCount++;
          console.log(`✅ Tagged: ${testName}`);
        } else {
          console.log(`⚠️ Test not found: ${testName}`);
        }
      } catch (error) {
        console.error(`❌ Error tagging ${testName}: ${error.message}`);
        errorCount++;
      }
    }
    
    console.log(`\n🏷️ Tagging complete:`);
    console.log(`   • Successfully tagged: ${taggedCount}`);
    console.log(`   • Errors: ${errorCount}`);
    console.log(`   • Total flaky tests: ${flakyTestNames.length}`);
    
    return { tagged: taggedCount, errors: errorCount };
  }
  
  /**
   * Find all test files in the tests directory
   */
  findTestFiles(dir) {
    const testFiles = [];
    
    const findFiles = (currentDir) => {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          findFiles(fullPath);
        } else if (item.endsWith('.spec.js') || item.endsWith('.test.js')) {
          testFiles.push(fullPath);
        }
      }
    };
    
    findFiles(dir);
    return testFiles;
  }
  
  /**
   * Tag a specific test in all test files
   */
  tagTestInFiles(testName, testFiles) {
    for (const filePath of testFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      const updatedContent = this.tagTestInContent(testName, content);
      
      if (updatedContent !== content) {
        fs.writeFileSync(filePath, updatedContent);
        console.log(`   📝 Updated: ${filePath}`);
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Tag a test in file content
   */
  tagTestInContent(testName, content) {
    // Find test definitions that match the test name
    const testRegex = new RegExp(`(test\\s*\\(\\s*['"]${this.escapeRegex(testName)}['"][^)]*\\)\\s*,\\s*\\{[^}]*tag:\\s*\\[([^\\]]*)\\][^}]*\\})`, 'g');
    
    return content.replace(testRegex, (match, testDef, existingTags) => {
      // Check if @flaky tag already exists
      if (this.tagPattern.test(existingTags)) {
        console.log(`   ℹ️ Test already tagged: ${testName}`);
        return match;
      }
      
      // Add @flaky tag to existing tags
      const newTags = existingTags.replace(/\]$/, ', \'@flaky\']');
      const newTestDef = testDef.replace(existingTags, newTags);
      
      return newTestDef;
    });
  }
  
  /**
   * Escape special regex characters
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  /**
   * Remove @flaky tags from all tests (cleanup function)
   */
  removeFlakyTags(testsDir = this.testsDir) {
    if (!fs.existsSync(testsDir)) {
      console.log(`❌ Tests directory not found: ${testsDir}`);
      return { removed: 0, errors: 0 };
    }
    
    console.log(`🧹 Removing @flaky tags from all tests...`);
    
    const testFiles = this.findTestFiles(testsDir);
    let removedCount = 0;
    let errorCount = 0;
    
    for (const filePath of testFiles) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const updatedContent = this.removeFlakyTagsFromContent(content);
        
        if (updatedContent !== content) {
          fs.writeFileSync(filePath, updatedContent);
          removedCount++;
          console.log(`✅ Removed tags from: ${filePath}`);
        }
      } catch (error) {
        console.error(`❌ Error processing ${filePath}: ${error.message}`);
        errorCount++;
      }
    }
    
    console.log(`\n🧹 Cleanup complete:`);
    console.log(`   • Files updated: ${removedCount}`);
    console.log(`   • Errors: ${errorCount}`);
    
    return { removed: removedCount, errors: errorCount };
  }
  
  /**
   * Remove @flaky tags from file content
   */
  removeFlakyTagsFromContent(content) {
    // Remove @flaky from tag arrays
    return content.replace(/(tag:\s*\[[^\]]*)(['"]@flaky['"]\s*,?\s*)([^\]]*\])/g, (match, before, flakyTag, after) => {
      // Clean up extra commas
      const cleanedAfter = after.replace(/^,\s*/, '');
      return before + cleanedAfter;
    });
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const tagger = new FlakyTestTagger();
  const command = process.argv[2];
  const analysisFile = process.argv[3] || 'flaky-analysis.json';
  const testsDir = process.argv[4] || 'tests';
  
  console.log(`🏷️ Flaky Test Tagger`);
  console.log(`📁 Analysis file: ${analysisFile}`);
  console.log(`📁 Tests directory: ${testsDir}`);
  
  if (command === 'tag') {
    if (!fs.existsSync(analysisFile)) {
      console.log(`❌ Analysis file not found: ${analysisFile}`);
      process.exit(1);
    }
    
    const analysis = JSON.parse(fs.readFileSync(analysisFile, 'utf8'));
    const flakyTestNames = analysis.flakyTests.map(test => test.name);
    
    if (flakyTestNames.length === 0) {
      console.log(`✅ No flaky tests to tag`);
      process.exit(0);
    }
    
    const result = tagger.tagFlakyTests(flakyTestNames, testsDir);
    process.exit(result.errors > 0 ? 1 : 0);
    
  } else if (command === 'clean') {
    const result = tagger.removeFlakyTags(testsDir);
    process.exit(result.errors > 0 ? 1 : 0);
    
  } else {
    console.log(`Usage:`);
    console.log(`  node flaky-test-tagger.js tag [analysis-file] [tests-dir]`);
    console.log(`  node flaky-test-tagger.js clean [tests-dir]`);
    process.exit(1);
  }
}

export { FlakyTestTagger };
