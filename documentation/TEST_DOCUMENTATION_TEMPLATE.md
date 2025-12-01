# Test Documentation Template

**Version:** 1.0  
**Last Updated:** 2025-12-01  
**Purpose:** Standard format for documenting all UI tests in the framework

## Template Structure

This template defines the exact format for documenting each test. When the template is updated, all existing documentation will be regenerated using the new format.

---

## Test Entry Format

```markdown
### 🧪 `{test_file_name}.spec.js` → `{test_name}`

| Field | Value |
|-------|-------|
| **Test ID** | `{test_id}` |
| **Test File** | `{relative_path_to_test_file}` |
| **Last Updated** | `{timestamp_of_last_analysis}` |
| **Status** | `{active|deprecated|pending}` |

---

## 📋 Test Scenario

> **Purpose:** {Brief description of what this test validates and why it exists}

> **Business Context:** {What business requirement or feature this test covers}

### Test Conditions

| Condition | Value |
|-----------|-------|
| **Application** | `{application_name}` (if applicable) |
| **User Role** | `{role_name}` (if applicable) |
| **Environment** | `{staging|production|all}` |
| **Prerequisites** | {List of prerequisites, e.g., "Admin user exists", "Application must be published"} |
| **Test Data Setup** | {Description of any test data that needs to be created} |

### Test Data Used

| Data Type | Details |
|-----------|---------|
| **Users** | {List of users created/used with their roles} |
| **Sessions** | {Session configuration details} |
| **Applications** | {Application names and configurations} |
| **Mock Data** | {Any mock data or fixtures used} |
| **API Payloads** | {Key API payloads or simulation data used} |

### Expected Outcomes

- ✅ {Expected result/assertion 1}
- ✅ {Expected result/assertion 2}
- ✅ {What should happen when test passes}

---

## 📝 Test Case

### Test Steps

| Step | Action | Input | Expected Result | API Calls | UI Elements |
|------|--------|-------|-----------------|-----------|-------------|
| **1. Setup Phase** | {What action is performed} | {What data/input is provided} | {What should happen} | `{HTTP_METHOD} {endpoint}` | `{test_id}` |
| **2. {Step Name}** | {What action is performed} | {What data/input is provided} | {What should happen} | `{HTTP_METHOD} {endpoint}` | `{test_id}` |
| **3. {Step Name}** | {What action is performed} | {What data/input is provided} | {What should happen} | `{HTTP_METHOD} {endpoint}` | `{test_id}` |

### Validation Points

- ✅ {Assertion/validation 1}
- ✅ {Assertion/validation 2}
- ✅ {API response validation}
- ✅ {UI state validation}
- ✅ {Data consistency check}

### Cleanup

- 🧹 {What cleanup is performed}
- 🗑️ {Resources that are deleted/cleaned up}

### API Endpoints Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `{HTTP_METHOD}` | `{endpoint}` | {Purpose} |
| `{HTTP_METHOD}` | `{endpoint}` | {Purpose} |

### UI Test IDs Used

| Test ID | Purpose |
|---------|---------|
| `{test_id}` | {Purpose} |
| `{test_id}` | {Purpose} |

### Tags

`{@tag1}` `{@tag2}` `{@tag3}`

### Dependencies

- 📦 {Dependency 1 - helper function or utility}
- 📦 {Dependency 2 - fixture or mock data}
- 📦 {Other tests or utilities this test depends on}

### Known Issues/Limitations

⚠️ {Any known issues or limitations}  
💡 {Workarounds if any}

### Related Tests

- 🔗 [{related_test_file}](path/to/test) - {Description}
- 🔗 [{related_test_file}](path/to/test) - {Description}

---

**Last Updated:** {YYYY-MM-DD HH:MM:SS UTC} (`{ISO_timestamp}`)
```

---

## Template Field Definitions

### Required Fields

1. **Test ID** - Unique identifier for the test (from test tags, describe block, or generated)
2. **Test File** - Relative path from tests/ directory
3. **Test Name** - Exact test name from the test() function
4. **Purpose** - What the test validates (1-2 sentences)
5. **Test Steps** - Detailed step-by-step breakdown
6. **Expected Outcomes** - What should happen when test passes

### Optional Fields

- **Test ID** - If available from test metadata
- **Business Context** - Business requirement being tested
- **Prerequisites** - Setup requirements
- **Known Issues** - Any limitations or workarounds
- **Related Tests** - Links to related test files

### Data Extraction Rules

1. **Test Name:** Extract from `test('{name}', ...)` or `test.describe('{name}', ...)`
2. **Tags:** Extract from `tag: [...]` array
3. **Application Name:** Extract from constants or helper calls
4. **User Roles:** Extract from test configuration or API calls
5. **API Endpoints:** Extract from API client calls
6. **UI Test IDs:** Extract from `getByTestId()` calls
7. **Test Steps:** Parse test code to extract sequential actions
8. **Mock Data:** Extract from imports and mock data usage

---

## Template Versioning

When updating this template:

1. **Increment Version:** Update version number
2. **Update Date:** Set last updated date
3. **Document Changes:** Add changelog section
4. **Backward Compatibility:** Ensure old data can be migrated to new format
5. **Placeholder Strategy:** Use `{data not found for this field}` for missing data

---

## Example Entry

```markdown
### 🧪 `application_create_delete_test.spec.js` → `Should create and delete an application with multiple applicant types`

| Field | Value |
|-------|-------|
| **Test ID** | `application_create_delete_test` |
| **Test File** | `application_create_delete_test.spec.js` |
| **Last Updated** | `2025-12-01T19:30:00Z` |
| **Status** | `active` |

---

## 📋 Test Scenario

> **Purpose:** Validates end-to-end application lifecycle management including creation with multiple applicant types, configuration, publishing, and deletion.

> **Business Context:** Ensures administrators can create applications with complex configurations and properly clean up test applications.

### Test Conditions

| Condition | Value |
|-----------|-------|
| **Application** | `AutoTest Create_Delete_{randomNumber}` (dynamically generated) |
| **User Role** | Admin |
| **Environment** | `staging|production` |
| **Prerequisites** | Admin user exists, Verifast organization exists |
| **Test Data Setup** | Application created with 6 applicant types, Autotest-suite-fin-only workflow, High Risk flags, $500 minimum |

### Test Data Used

| Data Type | Details |
|-----------|---------|
| **Users** | Admin user (from test_config) |
| **Sessions** | N/A |
| **Applications** | AutoTest Create_Delete_{randomNumber} |
| **Mock Data** | None |
| **API Payloads** | Application creation payload with organization, applicant types, workflow template, flag collection, minimum amount |

### Expected Outcomes

- ✅ Application is created successfully with all specified configurations
- ✅ Application can be published to LIVE status
- ✅ Application can be deleted successfully
- ✅ No orphaned data remains after deletion

---

## 📝 Test Case

### Test Steps

| Step | Action | Input | Expected Result | API Calls | UI Elements |
|------|--------|-------|-----------------|-----------|-------------|
| **1. Setup Phase** | Navigate to home page and login as admin | Admin credentials from test_config | Admin is logged in, applicants-menu is visible | `POST /auth` | `applicants-menu` |
| **2. Application Creation** | Create application with unique name and configuration | Organization: 'Verifast', 6 applicant types, workflow template, flag collection, minimum amount | Application created successfully with all configurations applied | `POST /applications` | Application creation form elements |
| **3. Application Publishing** | Publish application to LIVE status | Application ID from creation step | Application status changes to LIVE | `PATCH /applications/{id}` | Application status indicator |
| **4. Application Deletion** | Delete the created application | Application ID | Application is deleted, no longer appears in applications list | `DELETE /applications/{id}` | Delete confirmation dialog |

### Validation Points

- ✅ Application name is unique (includes random number)
- ✅ All 6 applicant types are configured correctly
- ✅ Workflow template is assigned
- ✅ Flag collection is set to 'High Risk'
- ✅ Minimum amount is set to $500
- ✅ Application can be published successfully
- ✅ Application is deleted without errors

### Cleanup

- 🧹 Application is deleted in the test
- ✅ No additional cleanup required (test handles its own cleanup)

### API Endpoints Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/auth` | Admin authentication |
| `POST` | `/applications` | Create application |
| `PATCH` | `/applications/{id}` | Update application (publish) |
| `DELETE` | `/applications/{id}` | Delete application |

### UI Test IDs Used

| Test ID | Purpose |
|---------|---------|
| `applicants-menu` | Main navigation menu |
| Application form test IDs | From completeApplicationFlow helper |

### Tags

`@core` `@regression` `@staging-ready` `@rc-ready` `@try-test-rail-names`

### Dependencies

- 📦 `completeApplicationFlow` helper from `utils/application-management`
- 📦 `loginForm` utility from `utils/login-form`
- 📦 `admin` config from `test_config`

### Known Issues/Limitations

✅ None documented

### Related Tests

- 🔗 `application_edit_id_template_settings.spec.js` - Related application editing test

---

**Last Updated:** 2025-12-01 19:30:00 UTC (`2025-12-01T19:30:00Z`)
```

---

## Template Update Process

When this template is updated:

1. **Version Check:** Compare current template version with last used version
2. **Field Mapping:** Map old fields to new fields
3. **Migration Rules:** Define how to migrate old data to new format
4. **Placeholder Strategy:** For new required fields, use `{data not found for this field}`
5. **Backward Update:** Regenerate all existing entries with new format

---

## Notes

- This template is the source of truth for documentation format
- All test documentation should follow this exact structure
- When template changes, all documentation must be regenerated
- Missing data should use placeholders rather than omitting fields
- Template version should be tracked in each generated documentation file

