#!/usr/bin/env node

import { TestRailAPI } from '../utils/testrail-api.js';
import fs from 'fs';
import path from 'path';

class TestCaseMapper {
  constructor(config) {
    this.api = new TestRailAPI(config);
    this.mappingFile = 'test-case-mapping.json';
  }

  async generateMapping() {
    try {
      console.log('🗺️ Generating test case mapping...');
      
      // Get all TestRail cases
      const cases = await this.api.getCases();
      console.log(`📊 Found ${cases.length} TestRail cases`);
      
      // Get all Playwright test files
      const testFiles = this.getPlaywrightTestFiles();
      console.log(`🧪 Found ${testFiles.length} Playwright test files`);
      
      const mapping = {
        generated_at: new Date().toISOString(),
        total_cases: cases.length,
        total_tests: testFiles.length,
        mappings: []
      };

      // Create mappings based on test names
      for (const testCase of cases) {
        const matchingTests = this.findMatchingTests(testCase.title, testFiles);
        
        if (matchingTests.length > 0) {
          mapping.mappings.push({
            case_id: testCase.id,
            case_title: testCase.title,
            test_files: matchingTests,
            confidence: this.calculateConfidence(testCase.title, matchingTests)
          });
        }
      }

      // Save mapping to file
      fs.writeFileSync(this.mappingFile, JSON.stringify(mapping, null, 2));
      
      console.log(`✅ Mapping generated: ${mapping.mappings.length} mappings created`);
      console.log(`💾 Saved to: ${this.mappingFile}`);
      
      return mapping;
    } catch (error) {
      console.error('❌ Failed to generate mapping:', error.message);
      throw error;
    }
  }

  getPlaywrightTestFiles() {
    const testDir = 'tests';
    const testFiles = [];
    
    if (!fs.existsSync(testDir)) {
      return testFiles;
    }

    const findTestFiles = (dir) => {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          findTestFiles(filePath);
        } else if (file.endsWith('.spec.js') || file.endsWith('.test.js')) {
          testFiles.push({
            path: filePath,
            name: file,
            content: fs.readFileSync(filePath, 'utf8')
          });
        }
      }
    };

    findTestFiles(testDir);
    return testFiles;
  }

  findMatchingTests(caseTitle, testFiles) {
    const matches = [];
    const normalizedCaseTitle = this.normalizeTitle(caseTitle);
    
    for (const testFile of testFiles) {
      const testNames = this.extractTestNames(testFile.content);
      
      for (const testName of testNames) {
        const normalizedTestName = this.normalizeTitle(testName);
        
        if (this.isMatch(normalizedCaseTitle, normalizedTestName)) {
          matches.push({
            file: testFile.path,
            test_name: testName,
            similarity: this.calculateSimilarity(normalizedCaseTitle, normalizedTestName)
          });
        }
      }
    }

    // Sort by similarity score
    matches.sort((a, b) => b.similarity - a.similarity);
    
    return matches;
  }

  extractTestNames(content) {
    const testNames = [];
    
    // Match test() function calls
    const testRegex = /test\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let match;
    
    while ((match = testRegex.exec(content)) !== null) {
      testNames.push(match[1]);
    }
    
    // Match test.skip() function calls
    const testSkipRegex = /test\.skip\s*\(\s*['"`]([^'"`]+)['"`]/g;
    
    while ((match = testSkipRegex.exec(content)) !== null) {
      testNames.push(match[1]);
    }
    
    return testNames;
  }

  normalizeTitle(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  isMatch(caseTitle, testName) {
    // Check for exact match
    if (caseTitle === testName) {
      return true;
    }
    
    // Check if case title contains test name or vice versa
    if (caseTitle.includes(testName) || testName.includes(caseTitle)) {
      return true;
    }
    
    // Check for word overlap (at least 50% of words match)
    const caseWords = caseTitle.split(' ');
    const testWords = testName.split(' ');
    
    const commonWords = caseWords.filter(word => testWords.includes(word));
    const overlap = commonWords.length / Math.max(caseWords.length, testWords.length);
    
    return overlap >= 0.5;
  }

  calculateSimilarity(caseTitle, testName) {
    const caseWords = caseTitle.split(' ');
    const testWords = testName.split(' ');
    
    const commonWords = caseWords.filter(word => testWords.includes(word));
    const totalWords = new Set([...caseWords, ...testWords]);
    
    return commonWords.length / totalWords.size;
  }

  calculateConfidence(caseTitle, matches) {
    if (matches.length === 0) return 0;
    
    const bestMatch = matches[0];
    return bestMatch.similarity;
  }

  async loadMapping() {
    if (!fs.existsSync(this.mappingFile)) {
      console.log('📝 No mapping file found. Generating new mapping...');
      return await this.generateMapping();
    }

    try {
      const content = fs.readFileSync(this.mappingFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('❌ Failed to load mapping:', error.message);
      throw error;
    }
  }

  async generateTestFilter(caseIds) {
    try {
      console.log(`🎯 Generating test filter for case IDs: ${caseIds.join(', ')}`);
      
      const mapping = await this.loadMapping();
      const selectedTests = [];
      
      for (const caseId of caseIds) {
        const mappingEntry = mapping.mappings.find(m => m.case_id === caseId);
        
        if (mappingEntry) {
          selectedTests.push(...mappingEntry.test_files);
        } else {
          console.warn(`⚠️ No mapping found for case ID: ${caseId}`);
        }
      }

      if (selectedTests.length === 0) {
        console.log('⚠️ No tests found for selected cases. Running all tests.');
        return '--grep-invert "@document-upload"';
      }

      // Generate grep pattern for selected tests
      const testNames = selectedTests.map(t => t.test_name);
      const grepPattern = testNames.map(name => 
        name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      ).join('|');
      
      const filter = `--grep "${grepPattern}"`;
      
      console.log(`✅ Generated filter: ${filter}`);
      console.log(`📊 Selected ${selectedTests.length} tests from ${testNames.length} unique test names`);
      
      return filter;
    } catch (error) {
      console.error('❌ Failed to generate test filter:', error.message);
      // Fallback to running all tests
      return '--grep-invert "@document-upload"';
    }
  }

  async updateMapping() {
    console.log('🔄 Updating test case mapping...');
    return await this.generateMapping();
  }

  async validateMapping() {
    try {
      console.log('✅ Validating test case mapping...');
      
      const mapping = await this.loadMapping();
      const testFiles = this.getPlaywrightTestFiles();
      
      let validMappings = 0;
      let invalidMappings = 0;
      
      for (const mappingEntry of mapping.mappings) {
        const validTests = mappingEntry.test_files.filter(test => 
          fs.existsSync(test.file)
        );
        
        if (validTests.length > 0) {
          validMappings++;
        } else {
          invalidMappings++;
          console.warn(`⚠️ Invalid mapping for case ${mappingEntry.case_id}: ${mappingEntry.case_title}`);
        }
      }
      
      console.log(`📊 Validation results:`);
      console.log(`   • Valid mappings: ${validMappings}`);
      console.log(`   • Invalid mappings: ${invalidMappings}`);
      console.log(`   • Total mappings: ${mapping.mappings.length}`);
      
      return {
        valid: validMappings,
        invalid: invalidMappings,
        total: mapping.mappings.length
      };
    } catch (error) {
      console.error('❌ Failed to validate mapping:', error.message);
      throw error;
    }
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const config = {
    host: process.env.TESTRAIL_HOST,
    username: process.env.TESTRAIL_USER,
    apiKey: process.env.TESTRAIL_API_KEY,
    projectId: process.env.TESTRAIL_PROJECT_ID,
    suiteId: process.env.TESTRAIL_SUITE_ID
  };

  const mapper = new TestCaseMapper(config);
  
  const command = process.argv[2];

  switch (command) {
    case 'generate':
      mapper.generateMapping()
        .then(() => console.log('Mapping generation completed'))
        .catch(console.error);
      break;
      
    case 'update':
      mapper.updateMapping()
        .then(() => console.log('Mapping update completed'))
        .catch(console.error);
      break;
      
    case 'validate':
      mapper.validateMapping()
        .then(() => console.log('Mapping validation completed'))
        .catch(console.error);
      break;
      
    case 'filter':
      const caseIds = process.argv[3] ? process.argv[3].split(',').map(Number) : [1, 2, 3];
      mapper.generateTestFilter(caseIds)
        .then(filter => console.log(`Generated filter: ${filter}`))
        .catch(console.error);
      break;
      
    default:
      console.log('Usage: node test-case-mapper.js [generate|update|validate|filter] [caseIds]');
      console.log('  generate  - Generate new test case mapping');
      console.log('  update    - Update existing mapping');
      console.log('  validate  - Validate existing mapping');
      console.log('  filter    - Generate test filter for case IDs');
      console.log('');
      console.log('Examples:');
      console.log('  node test-case-mapper.js generate');
      console.log('  node test-case-mapper.js validate');
      console.log('  node test-case-mapper.js filter "1,2,3"');
  }
}

export { TestCaseMapper };
