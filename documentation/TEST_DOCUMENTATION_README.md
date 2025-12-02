# Test Documentation System

## Overview

This system automatically generates and maintains documentation for all UI tests in the framework. It ensures consistency, handles updates, and supports template evolution.

## Key Features

1. **Automatic Detection:** Finds all test files and extracts information
2. **Change Detection:** Only updates documentation for changed tests
3. **Template-Based:** Uses a standardized template for consistent format
4. **Backward Compatible:** Updates existing documentation when template changes
5. **Placeholder Strategy:** Uses placeholders for missing data instead of omitting fields

## Files

- **`TEST_DOCUMENTATION_TEMPLATE.md`** - The template defining the documentation format
- **`AUTOMATED_TEST_DOCUMENTATION.md`** - Generated documentation (do not edit manually)
- **`.test-docs-metadata.json`** - Metadata tracking file (tracks hashes, versions)
- **`scripts/generate-test-documentation.js`** - Documentation generator script

## Usage

### Generate Documentation for All Tests

```bash
node scripts/generate-test-documentation.js
```

This will:
- Scan all test files in `tests/` directory
- Generate documentation for new tests
- Update documentation for changed tests
- Preserve unchanged test documentation

### Force Update All Documentation

```bash
node scripts/generate-test-documentation.js --update-all
```

Use this when:
- Template has been updated
- You want to regenerate all documentation
- After major refactoring

### Update Template Version

```bash
node scripts/generate-test-documentation.js --template-version=2.0
```

Use this when the template structure has changed significantly.

## How It Works

### 1. Template System

The template (`TEST_DOCUMENTATION_TEMPLATE.md`) defines:
- Required fields
- Optional fields
- Field formats
- Placeholder strategy

### 2. Change Detection

The system tracks:
- File hashes (MD5) to detect code changes
- Template version to detect format changes
- Last run timestamp

### 3. Update Strategy

**For Existing Tests:**
- Compare current file hash with stored hash
- If changed → regenerate documentation
- If unchanged → preserve existing entry

**For New Tests:**
- No hash found → generate new entry
- Use template format exactly

**For Template Changes:**
- Compare template version
- If changed → regenerate all entries with new format
- Use placeholders for fields that don't exist in old data

### 4. Data Extraction

The script extracts:
- Test names from `test()` calls
- Tags from `tag: []` arrays
- Application names from constants
- API endpoints from API client calls
- UI test IDs from `getByTestId()` calls
- Imports and dependencies
- Test structure and flow

## Template Structure

Each test entry includes:

### Test Scenario Section
- **Purpose:** What the test validates
- **Business Context:** Business requirement
- **Test Conditions:** Application, role, environment, prerequisites
- **Test Data Used:** Users, sessions, applications, mock data
- **Expected Outcomes:** What should happen

### Test Case Section
- **Test Steps:** Detailed step-by-step breakdown
  - Action
  - Input
  - Expected Result
  - API Calls
  - UI Elements
- **Validation Points:** All assertions
- **Cleanup:** Cleanup procedures
- **API Endpoints Used:** List of endpoints
- **UI Test IDs Used:** List of test IDs
- **Tags:** Test tags
- **Dependencies:** Helper functions, utilities
- **Known Issues:** Limitations or workarounds
- **Related Tests:** Links to related tests

## Updating the Template

1. **Edit Template:** Modify `TEST_DOCUMENTATION_TEMPLATE.md`
2. **Update Version:** Increment version number in template
3. **Update Script:** Update `CURRENT_TEMPLATE_VERSION` in script if needed
4. **Regenerate:** Run with `--update-all` flag
5. **Review:** Check that all entries follow new format
6. **Commit:** Commit template, script, and generated docs together

## Placeholder Strategy

When data cannot be extracted:
- Use: `{data not found for this field}`
- Never omit required fields
- Preserve field structure even with placeholders

## Best Practices

1. **Don't Edit Generated Docs:** Always edit template and regenerate
2. **Version Control:** Track template version changes
3. **Regular Updates:** Run documentation generation after adding/modifying tests
4. **Review Placeholders:** Manually fill in placeholders where possible
5. **Template Evolution:** Update template carefully - affects all documentation

## Integration with CI/CD

Add to your CI pipeline:

```yaml
- name: Generate Test Documentation
  run: |
    node scripts/generate-test-documentation.js
    git diff --exit-code documentation/AUTOMATED_TEST_DOCUMENTATION.md || \
      (echo "Documentation changed - please commit updated docs" && exit 1)
```

This ensures documentation stays in sync with code changes.

## Troubleshooting

### Documentation not updating
- Check file hashes in `.test-docs-metadata.json`
- Use `--update-all` to force regeneration

### Missing data in documentation
- Review test file structure
- Check if extraction patterns match your code style
- Manually add data if needed (but template should be updated)

### Template changes not reflected
- Verify template version in script matches template file
- Use `--update-all` flag
- Check that template structure is valid

## Future Enhancements

Potential improvements:
- AST-based parsing for better step extraction
- Integration with test execution to capture runtime data
- Automatic linking to TestRail test cases
- Visual diff of documentation changes
- Support for test code comments as documentation source

