# 🔄 TestRail Case Synchronization Script

This script automatically synchronizes your Playwright test cases with TestRail using TRCLI. It reads all test files in the `tests/` directory and ensures that all test cases exist in the TestRail "Test Cases - Master" suite.

## 🎯 Features

- **📁 Automatic Test Discovery**: Scans all `.spec.js` files in the `tests/` directory
- **🏷️ Tag Extraction**: Extracts test tags (`@core`, `@smoke`, `@regression`) from test configurations
- **🆔 Case ID Detection**: Automatically detects case IDs from test names (e.g., `C42 - Description`)
- **🔄 Smart Matching**: Matches tests by automation ID first, then by title
- **📝 Case Creation**: Creates missing test cases in TestRail with proper metadata
- **🔄 Tag Updates**: Updates existing cases with new tags without overwriting existing ones
- **📊 Summary Reports**: Provides detailed statistics about the synchronization process

## 🚀 Quick Start

### Prerequisites

1. **TRCLI Installation**: Ensure TRCLI is installed and accessible
2. **Environment Variables**: Set up your TestRail credentials in `.env` file

### Environment Variables

Create or update your `.env` file with the following variables:

```bash
# TestRail Configuration
TESTRAIL_HOST=https://your-instance.testrail.io
TESTRAIL_USER=your-email@company.com
TESTRAIL_API_KEY=your-api-key
TESTRAIL_PROJECT_NAME=Verifast Web App
TESTRAIL_SUITE_ID=1
```

### Usage

#### 1. Show Test Summary (No Sync)
```bash
npm run sync-testrail-summary
# or
node sync-testrail-cases.js --summary
```

This will show:
- Total number of tests found
- Tag distribution (`@core`, `@smoke`, `@regression`)
- Case ID distribution
- Tests without Case IDs

#### 2. Sync All Test Cases
```bash
npm run sync-testrail
# or
node sync-testrail-cases.js
```

This will:
- Parse all test files
- Check existing cases in TestRail
- Create missing cases
- Update existing cases with new tags

#### 3. Help
```bash
node sync-testrail-cases.js --help
```

## 📋 How It Works

### 1. Test File Parsing

The script scans all `.spec.js` files and extracts:

```javascript
// Example test structure detected
test('C42 - Financial verification flow', {
  tag: ['@core', '@smoke', '@regression'],
}, async ({ page }) => {
  // Test implementation
});
```

**Extracted Information:**
- **Test Name**: `C42 - Financial verification flow`
- **Case ID**: `C42` (automatically extracted from name)
- **Tags**: `['@core', '@smoke', '@regression']`
- **File**: `financial-1attempt-report-check-approve-with-conditions.spec.js`
- **Line**: Line number in file

### 2. TestRail Integration

#### Case Matching Strategy

1. **Primary Match**: By automation ID (e.g., `C42`)
2. **Fallback Match**: By test title
3. **Create New**: If no match found

#### Case Creation

When creating new cases, the script sets:

- **Title**: Full test name
- **Type**: Functional (type_id: 1)
- **Priority**: Medium (priority_id: 2)
- **Automation ID**: Extracted case ID or auto-generated
- **Tags**: All test tags joined with commas
- **Description**: Auto-generated with file and line information

#### Case Updates

When updating existing cases:

- **Tag Merging**: New tags are added without overwriting existing ones
- **No Duplicates**: Uses Set to ensure unique tags
- **Preservation**: Existing case data is preserved

### 3. TRCLI Commands Used

#### Get Existing Cases
```bash
trcli -y -h "HOST" --project "PROJECT" --username "USER" --key "KEY" get_cases --suite-id 1
```

#### Create New Case
```bash
trcli -y -h "HOST" --project "PROJECT" --username "USER" --key "KEY" add_case \
  --suite-id 1 \
  --title "Test Name" \
  --type-id 1 \
  --priority-id 2 \
  --custom-automation-id "C42" \
  --custom-tags "@core,@smoke,@regression" \
  --custom-description "Description"
```

#### Update Existing Case
```bash
trcli -y -h "HOST" --project "PROJECT" --username "USER" --key "KEY" update_case \
  --case-id 123 \
  --custom-tags "@core,@smoke,@regression,@newtag"
```

## 📊 Expected Output

### Summary Mode
```
📊 Test Summary:
   Total tests: 23

🏷️  Tag distribution:
   @core: 7 tests
   @smoke: 9 tests
   @regression: 23 tests

🆔 Case ID distribution:
   C33: 1 tests
   C36: 1 tests
   C38: 1 tests
   C39: 1 tests
   C40: 1 tests
   C41: 1 tests
   C42: 1 tests
   Tests without Case ID: 16
```

### Sync Mode
```
🚀 Starting TestRail case synchronization...

📁 Found 16 test files
📊 Found 23 tests in files

🔍 Fetching existing cases from TestRail...
✅ Found 15 existing cases in TestRail

🔄 Processing tests...

📝 Creating case: Create Applicant Session for Flag Issue
✅ Created case: Create Applicant Session for Flag Issue

🔄 Updating case: C42 - Financial verification flow
✅ Updated case: C42 - Financial verification flow with tags: @newtag

📈 Synchronization Summary:
   ✅ Created: 8 cases
   🔄 Updated: 12 cases
   ⏭️  Skipped: 3 cases
   📊 Total processed: 23 tests

🎉 Synchronization completed successfully!
```

## 🔧 Configuration

### Custom Fields

The script expects the following custom fields in your TestRail project:

1. **`custom_automation_id`**: Stores the unique case identifier (e.g., `C42`)
2. **`custom_tags`**: Stores test tags (e.g., `@core,@smoke,@regression`)
3. **`custom_description`**: Stores additional test information

### Suite Configuration

- **Default Suite ID**: `1` (Master suite)
- **Project Name**: `Verifast Web App` (configurable via environment variable)

## 🚨 Troubleshooting

### Common Issues

#### 1. Missing Environment Variables
```
❌ Missing required environment variables:
   TESTRAIL_HOST, TESTRAIL_USER, TESTRAIL_API_KEY
   Please check your .env file or environment variables.
```

**Solution**: Ensure all required environment variables are set in your `.env` file.

#### 2. TRCLI Not Found
```
❌ Error: spawn trcli ENOENT
```

**Solution**: Install TRCLI and ensure it's in your PATH.

#### 3. TestRail Connection Issues
```
❌ Error fetching existing cases: Request failed with status code 401
```

**Solution**: Check your TestRail credentials and API key permissions.

#### 4. Custom Fields Missing
```
❌ Error creating case: Custom field not found
```

**Solution**: Ensure the required custom fields exist in your TestRail project.

### Debug Mode

To see more detailed output, you can modify the script to include debug logging:

```javascript
// Add this line to enable debug output
process.env.DEBUG = 'true';
```

## 📝 Best Practices

### 1. Test Naming Convention

Use consistent naming for better automation ID extraction:

```javascript
// ✅ Good - Case ID in name
test('C42 - Financial verification flow', {
  tag: ['@core', '@smoke', '@regression'],
}, async ({ page }) => {
  // Test implementation
});

// ❌ Avoid - No case ID
test('Financial verification flow', {
  tag: ['@core', '@smoke', '@regression'],
}, async ({ page }) => {
  // Test implementation
});
```

### 2. Tag Management

- Use consistent tag names (`@core`, `@smoke`, `@regression`)
- Avoid special characters in tags
- Keep tags lowercase for consistency

### 3. Regular Synchronization

- Run the script after adding new tests
- Run before major releases to ensure TestRail is up to date
- Use the summary mode to check test distribution

### 4. Case ID Management

- Use sequential case IDs (C33, C34, C35, etc.)
- Avoid duplicate case IDs
- Document case ID assignments

## 🔄 Integration with CI/CD

You can integrate this script into your CI/CD pipeline:

```yaml
# Example GitHub Actions step
- name: Sync TestRail Cases
  run: |
    npm run sync-testrail-summary
    npm run sync-testrail
  env:
    TESTRAIL_HOST: ${{ secrets.TESTRAIL_HOST }}
    TESTRAIL_USER: ${{ secrets.TESTRAIL_USER }}
    TESTRAIL_API_KEY: ${{ secrets.TESTRAIL_API_KEY }}
    TESTRAIL_PROJECT_NAME: ${{ secrets.TESTRAIL_PROJECT_NAME }}
    TESTRAIL_SUITE_ID: ${{ secrets.TESTRAIL_SUITE_ID }}
```

## 📚 Related Files

- `sync-testrail-cases.js` - Main synchronization script
- `tests/` - Directory containing all test files
- `.env` - Environment variables configuration
- `package.json` - NPM scripts for easy execution

## 🤝 Contributing

When modifying the script:

1. **Test Locally**: Always test with `--summary` first
2. **Backup TestRail**: Consider backing up TestRail before major changes
3. **Document Changes**: Update this README when adding new features
4. **Error Handling**: Add proper error handling for new functionality

---

**Note**: This script is designed to work with the existing TestRail integration in your Playwright test suite. It complements the existing `publish-reports.js` script by ensuring all test cases are properly synchronized before test execution. 