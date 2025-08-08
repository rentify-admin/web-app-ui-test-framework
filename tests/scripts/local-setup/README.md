# Local TestRail Integration Debugging Setup

This folder contains scripts to debug and analyze the TestRail integration issues, specifically the problem where TestRail runs contain "Untested" cases instead of only the selected test cases.

## 🎯 Problem Statement

The TestRail runs are showing 41 test cases with 33 "Untested" cases, which means the `include_all: false` and `case_ids` logic isn't working as expected.

## 📁 Files Overview

### 1. `run-tests-for-debug.sh`
**Purpose**: Run Playwright tests with specific tags and generate JUnit XML for debugging.

**Usage**:
```bash
# Run core tests
./run-tests-for-debug.sh core

# Run smoke tests  
./run-tests-for-debug.sh smoke

# Run regression tests
./run-tests-for-debug.sh regression
```

**What it does**:
- Cleans up previous test reports
- Installs dependencies and browsers
- Lists available tests with the specified tag
- Runs tests and generates JUnit XML
- Shows test results summary

### 2. `debug-testrail-integration.js`
**Purpose**: Comprehensive debugging script that traces the entire TestRail integration process.

**Usage**:
```bash
# Debug with core tag
node debug-testrail-integration.js core

# Debug with smoke tag
node debug-testrail-integration.js smoke
```

**What it does**:
- Parses JUnit XML and groups by browser
- Fetches all TestRail cases from Master suite
- Matches test results to TestRail cases by title
- Creates TestRail plans with explicit case IDs
- Verifies the created plans
- Provides detailed logging at each step

### 3. `analyze-testrail-state.js`
**Purpose**: Analyze the current TestRail state and identify potential issues.

**Usage**:
```bash
node analyze-testrail-state.js
```

**What it does**:
- Analyzes all test cases in the Master suite
- Checks for duplicate titles
- Analyzes custom fields (automation_id, custom_tags)
- Shows tag distribution
- Analyzes recent plans and runs
- Identifies potential matching issues

## 🔍 Debugging Workflow

### Step 1: Analyze Current TestRail State
```bash
node analyze-testrail-state.js
```
This will show you:
- How many test cases exist in TestRail
- Which ones have tags
- If there are duplicate titles
- Recent plan/run configurations

### Step 2: Run Tests and Generate JUnit XML
```bash
# Make the script executable
chmod +x run-tests-for-debug.sh

# Run tests for a specific tag
./run-tests-for-debug.sh core
```
This will:
- Run the tests and generate JUnit XML
- Show you exactly which tests were executed
- Verify the XML structure

### Step 3: Debug TestRail Integration
```bash
node debug-testrail-integration.js core
```
This will:
- Parse the JUnit XML
- Show you which test cases were found
- Match them to TestRail cases
- Create a debug plan in TestRail
- Verify the plan configuration

## 🚨 Expected Issues to Look For

### 1. Title Mismatch
**Problem**: Test names in JUnit XML don't match TestRail case titles exactly.
**Symptoms**: 
- "No match" messages in debug output
- Unmatched tests list
**Solution**: Check for differences in naming conventions.

### 2. Duplicate Titles
**Problem**: Multiple TestRail cases have the same title.
**Symptoms**: 
- Duplicate titles found in analysis
- Inconsistent case ID mapping
**Solution**: Use automation_id field for unique identification.

### 3. Missing Custom Fields
**Problem**: TestRail cases don't have required custom fields.
**Symptoms**:
- No custom_automation_id field
- No custom_tags field
**Solution**: Update TestRail cases with proper custom fields.

### 4. Plan Configuration Issues
**Problem**: TestRail plans are created with wrong configuration.
**Symptoms**:
- include_all: true instead of false
- Missing or wrong case_ids
**Solution**: Check the plan creation API call.

## 📊 Debug Output Examples

### Successful Case Matching
```
🔍 Case Matching: ✅ Matched: "C37 - Financial verification flow" -> Case ID 5412
🔍 Case Matching: ✅ Matched: "C42 - Financial - mx - 1attempt" -> Case ID 5413
🔍 Case Matching: Summary: 7 matched, 0 unmatched
```

### Failed Case Matching
```
🔍 Case Matching: ❌ No match: "Financial verification flow"
🔍 Case Matching: ❌ No match: "C42 - Financial verification"
🔍 Case Matching: Summary: 5 matched, 2 unmatched
```

### Plan Creation
```
🔍 TestRail Plan Creation: ✅ Created plan ID: 158
🔍 TestRail Plan Creation: Plan URL: https://your-testrail.com/index.php?/plans/view/158
🔍 Plan Verification: Run include_all: false
🔍 Plan Verification: Run case_ids: [5412, 5413, 5414, 5415, 5416, 5417, 5418]
```

## 🛠️ Environment Setup

Make sure you have the following environment variables set in your `.env` file:

```bash
TESTRAIL_HOST=https://your-testrail.com
TESTRAIL_PROJECT_ID=1
TESTRAIL_SUITE_ID=1
TESTRAIL_USER=your-email@company.com
TESTRAIL_API_KEY=your-api-key
```

## 🔧 Troubleshooting

### If JUnit XML is not generated:
1. Check if tests are running: `npx playwright test --grep "@core" --list`
2. Check Playwright configuration: `playwright.config.js`
3. Verify reporter configuration

### If TestRail API calls fail:
1. Check environment variables
2. Verify API key permissions
3. Check TestRail host URL format

### If case matching fails:
1. Compare test names in JUnit XML vs TestRail titles
2. Check for special characters or encoding issues
3. Verify TestRail case structure

## 📈 Next Steps

After running the debugging scripts:

1. **Identify the root cause** of the "Untested" cases issue
2. **Fix the matching logic** in `publish-reports.js`
3. **Update TestRail cases** if needed (add automation_id, fix titles)
4. **Test the fix** by running the debug scripts again
5. **Deploy the fix** to the main pipeline

## 🎯 Success Criteria

The debugging is successful when:
- ✅ All executed tests are matched to TestRail cases
- ✅ TestRail plans are created with `include_all: false`
- ✅ TestRail runs contain only the executed test cases
- ✅ No "Untested" cases appear in the TestRail run 