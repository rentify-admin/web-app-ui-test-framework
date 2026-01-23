# Quick Start Guide: Test Data Management

**Get up and running in 5 minutes**

---

## Prerequisites

Before you begin, ensure you have:

- MySQL 5.7+ or 8.0+ installed
- `mysqldump` and `mysql` CLI tools available in PATH
- Laravel API configured with test database
- Node.js 18+ and npm installed
- Playwright test framework set up

### Verify MySQL Tools

```bash
# Check mysqldump is available
mysqldump --version

# Check mysql client is available
mysql --version

# Expected output:
# mysqldump  Ver 8.0.x for macos13.3 on arm64
# mysql  Ver 8.0.x for macos13.3 on arm64
```

---

## 5-Minute Setup

### Step 1: Configure Environment Variables

Create or update your `.env` file:

```bash
# Database configuration (required)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=verifast_test
DB_USERNAME=root
DB_PASSWORD=

# Test data mode (optional - defaults shown)
TEST_DATA_MODE=AUTO              # AUTO | DYNAMIC | SNAPSHOT
SNAPSHOT_VERSION=latest          # latest | v1 | v2 | custom
CAPTURE_SNAPSHOT_ON_SUCCESS=false
```

### Step 2: Update Playwright Configuration

Edit `playwright.config.js`:

```javascript
import { defineConfig } from '@playwright/test';

export default defineConfig({
    globalSetup: './tests/helpers/test-data-bootstrap.js',
    globalTeardown: './tests/helpers/test-data-bootstrap.js',

    use: {
        baseURL: process.env.BASE_URL || 'http://localhost:3000',
    },

    // ... other config
});
```

### Step 3: Run Your First Test

```bash
# First run - creates snapshot (30-60s)
npm test

# Second run - uses snapshot (1-3s)
npm test
```

That's it! You're now using snapshot-based test data management.

---

## Common Commands Cheat Sheet

### Running Tests

```bash
# AUTO mode (default) - uses snapshot if available
npm test

# Force DYNAMIC mode - always fresh data
TEST_DATA_MODE=DYNAMIC npm test

# Force SNAPSHOT mode - fails if no snapshot
TEST_DATA_MODE=SNAPSHOT npm test

# Create snapshot after dynamic seeding
CAPTURE_SNAPSHOT=true TEST_DATA_MODE=DYNAMIC npm test

# Create snapshot after successful test run
CAPTURE_SNAPSHOT_ON_SUCCESS=true npm test
```

### Managing Snapshots

```bash
# List all snapshots
node -e "
import { SnapshotManager } from './tests/helpers/snapshot-manager.js';
const sm = new SnapshotManager();
console.table(sm.listSnapshots());
"

# Create snapshot manually (requires seeded database)
node -e "
import { SnapshotManager } from './tests/helpers/snapshot-manager.js';
const sm = new SnapshotManager();
await sm.createSnapshot({ createdBy: 'manual' });
"

# Check current mode configuration
node -e "
import { SnapshotManager } from './tests/helpers/snapshot-manager.js';
const sm = new SnapshotManager();
console.log(sm.getModeConfig());
"

# Generate current data model hash
node -e "
import { SnapshotManager } from './tests/helpers/snapshot-manager.js';
const sm = new SnapshotManager();
console.log('Hash:', sm.generateDataModelHash());
"

# Cleanup old snapshots (keeps last 3 by default)
node -e "
import { SnapshotManager } from './tests/helpers/snapshot-manager.js';
const sm = new SnapshotManager();
sm.cleanupOldSnapshots();
"
```

### CI/CD Integration

```bash
# GitHub Actions example
- name: Run Tests
  env:
    TEST_DATA_MODE: AUTO
    CAPTURE_SNAPSHOT_ON_SUCCESS: true
    DB_HOST: 127.0.0.1
    DB_DATABASE: verifast_test
    DB_USERNAME: root
    DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
  run: npm test

# GitLab CI example
test:
  script:
    - npm test
  variables:
    TEST_DATA_MODE: AUTO
    CAPTURE_SNAPSHOT_ON_SUCCESS: "true"
  cache:
    paths:
      - tests/snapshots/
```

---

## Usage Examples

### Example 1: Local Development (Fastest)

```bash
# First time setup - creates snapshot
TEST_DATA_MODE=DYNAMIC CAPTURE_SNAPSHOT=true npm test

# Every subsequent run - uses snapshot (1-3s)
npm test

# When you change seeders/migrations - auto-detects and recreates
npm test  # Automatically falls back to DYNAMIC, creates new snapshot
```

### Example 2: Debugging a Single Test

```bash
# Use snapshot for fast iteration
npm test tests/application_submission.spec.js

# Force fresh data if needed
TEST_DATA_MODE=DYNAMIC npm test tests/application_submission.spec.js
```

### Example 3: CI/CD Pipeline

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: root
          MYSQL_DATABASE: verifast_test
        ports:
          - 3306:3306

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install Dependencies
        run: npm ci

      - name: Run Tests
        env:
          TEST_DATA_MODE: AUTO
          CAPTURE_SNAPSHOT_ON_SUCCESS: true
          DB_HOST: 127.0.0.1
          DB_PORT: 3306
          DB_DATABASE: verifast_test
          DB_USERNAME: root
          DB_PASSWORD: root
        run: npm test

      - name: Upload Snapshot (on success)
        if: success()
        uses: actions/upload-artifact@v3
        with:
          name: test-snapshots
          path: tests/snapshots/*.sql
```

### Example 4: Using Entity Registry

```javascript
// tests/example.spec.js
import { test, expect } from '@playwright/test';
import { EntityRegistry } from '~/tests/helpers/entity-registry';

test.describe('Application Workflow', () => {
    let authToken;

    test.beforeAll(async ({ request }) => {
        // Login and get auth token
        const response = await request.post('/api/auth/login', {
            data: { email: 'test@example.com', password: 'password' }
        });
        const data = await response.json();
        authToken = data.token;

        // Initialize entity registry
        await EntityRegistry.initialize(request, authToken);
    });

    test('should create application', async ({ page, request }) => {
        // Use entity registry to get IDs by name
        const orgId = EntityRegistry.getOrganizationId('ACME Corp');
        const roleId = EntityRegistry.getRoleId('Applicant');
        const appId = EntityRegistry.getApplicationId('Demo Application');

        // Use in API call
        const response = await request.post('/api/applications', {
            headers: { 'Authorization': `Bearer ${authToken}` },
            data: {
                organization_id: orgId,
                role_id: roleId,
                application_id: appId,
                // ... other fields
            }
        });

        expect(response.ok()).toBeTruthy();
    });
});
```

### Example 5: Multiple Snapshot Versions

```bash
# Create minimal dataset snapshot
SNAPSHOT_VERSION=minimal CAPTURE_SNAPSHOT=true TEST_DATA_MODE=DYNAMIC npm test

# Create full dataset snapshot
SNAPSHOT_VERSION=full CAPTURE_SNAPSHOT=true TEST_DATA_MODE=DYNAMIC npm test

# Use minimal for fast tests
SNAPSHOT_VERSION=minimal npm test

# Use full for comprehensive tests
SNAPSHOT_VERSION=full npm test
```

---

## Troubleshooting FAQ

### Q: Tests are slow on first run

**A**: This is expected. First run uses DYNAMIC mode (30-60s) to create the snapshot. Subsequent runs will be fast (1-3s).

```bash
# Verify snapshot was created
ls -lh tests/snapshots/
```

### Q: Snapshot not being used (always running seeders)

**A**: Check if snapshot is valid. Hash might have changed due to seeder/migration modifications.

```bash
# Check current mode and snapshot status
node -e "
import { SnapshotManager } from './tests/helpers/snapshot-manager.js';
const sm = new SnapshotManager();
console.log(sm.getModeConfig());
"

# Expected output:
# {
#   mode: 'AUTO',
#   snapshotExists: true,  ← Should be true
#   shouldUseDynamic: false,  ← Should be false
#   dataModelHash: 'a1b2c3d4e5f6'
# }
```

### Q: "Snapshot not found" error in SNAPSHOT mode

**A**: You must create a snapshot first or use AUTO mode.

```bash
# Create snapshot first
TEST_DATA_MODE=DYNAMIC CAPTURE_SNAPSHOT=true npm test

# Then use SNAPSHOT mode
TEST_DATA_MODE=SNAPSHOT npm test
```

### Q: mysqldump command not found

**A**: Install MySQL client tools.

```bash
# macOS
brew install mysql-client
export PATH="/opt/homebrew/opt/mysql-client/bin:$PATH"

# Ubuntu/Debian
sudo apt-get install mysql-client

# Windows
# Download from https://dev.mysql.com/downloads/mysql/
```

### Q: Database connection refused

**A**: Verify database is running and credentials are correct.

```bash
# Test connection
mysql -h 127.0.0.1 -P 3306 -u root -p

# Check environment variables
echo $DB_HOST
echo $DB_DATABASE
echo $DB_USERNAME
```

### Q: Snapshot seems corrupted

**A**: Delete the snapshot and recreate.

```bash
# Delete all snapshots
rm tests/snapshots/*.sql
rm tests/snapshots/*.meta.json

# Recreate
TEST_DATA_MODE=DYNAMIC CAPTURE_SNAPSHOT=true npm test
```

### Q: How do I force a fresh snapshot?

**A**: Delete existing snapshot or change SNAPSHOT_VERSION.

```bash
# Option 1: Delete existing
rm tests/snapshots/snapshot-latest-*.sql*

# Option 2: Use new version
SNAPSHOT_VERSION=v2 CAPTURE_SNAPSHOT=true TEST_DATA_MODE=DYNAMIC npm test
```

### Q: EntityRegistry not finding entities

**A**: Ensure registry is initialized and entity names match exactly.

```javascript
// Check if initialized
console.log(EntityRegistry.isInitialized()); // Should be true

// Search for entity
const matches = EntityRegistry.search('organization', 'ACME');
console.log(matches); // Shows matching organizations

// Get all available entities
const allOrgs = EntityRegistry.getAll('organization');
console.log(allOrgs.map(o => o.name));
```

### Q: Snapshot invalid after migration change

**A**: This is correct behavior. Hash changed, so snapshot is auto-invalidated. Tests fall back to DYNAMIC mode.

```bash
# You'll see this log:
# 🔄 Data model changed (snapshot: a1b2c3, current: d4e5f6)
# 🔧 Mode: AUTO → Using DYNAMIC (no valid snapshot)

# New snapshot will be created with new hash
```

### Q: Want to disable snapshots temporarily

**A**: Use DYNAMIC mode.

```bash
TEST_DATA_MODE=DYNAMIC npm test
```

### Q: How to share snapshots across team?

**A**: Store snapshots in shared location or use artifact storage.

```bash
# Option 1: Network share
export SNAPSHOT_DIR=/mnt/shared/snapshots

# Option 2: Cloud storage (S3, GCS)
# Upload/download snapshots in CI/CD

# Option 3: Commit specific versions to git (not recommended for large files)
git add tests/snapshots/snapshot-v1-*.sql
git commit -m "Add v1 snapshot"
```

---

## Performance Tips

### Tip 1: Use AUTO Mode (Default)

AUTO mode gives you best of both worlds - speed when possible, reliability always.

```bash
# Let the system decide
npm test
```

### Tip 2: Capture Snapshots After Successful Runs

In CI/CD, capture snapshots only after tests pass.

```bash
CAPTURE_SNAPSHOT_ON_SUCCESS=true npm test
```

### Tip 3: Use Named Versions for Stability

Pin to specific snapshot versions for critical environments.

```bash
# Development - always latest
SNAPSHOT_VERSION=latest npm test

# Staging - pinned version
SNAPSHOT_VERSION=v1.0 npm test

# Production-like - stable version
SNAPSHOT_VERSION=production npm test
```

### Tip 4: Cleanup Old Snapshots Regularly

Prevent disk space issues.

```bash
# Keep only last 3 snapshots (default)
node -e "
import { SnapshotManager } from './tests/helpers/snapshot-manager.js';
new SnapshotManager().cleanupOldSnapshots();
"
```

### Tip 5: Initialize EntityRegistry Once

Initialize in `beforeAll` hook, not in each test.

```javascript
test.describe.serial('Suite', () => {
    test.beforeAll(async ({ request }) => {
        await EntityRegistry.initialize(request, authToken);
    });

    // All tests reuse initialized registry
});
```

---

## Configuration Reference

### All Environment Variables

```bash
# Mode Selection
TEST_DATA_MODE=AUTO              # AUTO | DYNAMIC | SNAPSHOT
SNAPSHOT_VERSION=latest          # latest | v1 | v2 | custom

# Snapshot Control
CAPTURE_SNAPSHOT=false           # Capture after dynamic seeding
CAPTURE_SNAPSHOT_ON_SUCCESS=false # Capture after successful tests
RUN_PENDING_MIGRATIONS=false     # Run migrations after snapshot restore

# Configuration
SNAPSHOT_MAX_AGE=604800000       # 7 days in milliseconds
SNAPSHOT_KEEP_COUNT=3            # Number of snapshots to retain

# Database (required)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=verifast_test
DB_USERNAME=root
DB_PASSWORD=
```

---

## Next Steps

- Read [Technical Design](./technical-design.md) for deep dive
- Check [Architecture Diagrams](./architecture-diagrams.md) for visual overview
- Review [Operations Runbook](./runbook.md) for advanced operations
- Follow [Implementation Checklist](./implementation-checklist.md) for team rollout

---

## Getting Help

- Check [Troubleshooting FAQ](#troubleshooting-faq) above
- Review logs for detailed error messages
- Consult [Operations Runbook](./runbook.md) for advanced scenarios
- Contact QA Automation team for support

---

**Last Updated**: 2026-01-22
**Maintained By**: QA Automation Team
