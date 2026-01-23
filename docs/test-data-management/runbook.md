# Operations Runbook: Test Data Management

**Operational Guide for Day-to-Day Management**

---

## Table of Contents

1. [Creating Snapshots](#creating-snapshots)
2. [Debugging Issues](#debugging-issues)
3. [CI/CD Integration](#cicd-integration)
4. [Monitoring](#monitoring)
5. [Disaster Recovery](#disaster-recovery)
6. [Maintenance Tasks](#maintenance-tasks)
7. [Performance Tuning](#performance-tuning)

---

## Creating Snapshots

### Manual Snapshot Creation

#### Prerequisites
- Database must be seeded with test data
- MySQL credentials configured in environment
- Sufficient disk space (estimate: 5-10MB per snapshot)

#### Method 1: Via Environment Variable

```bash
# Create snapshot after dynamic seeding
TEST_DATA_MODE=DYNAMIC CAPTURE_SNAPSHOT=true npm test

# Output:
# 🔧 Mode: DYNAMIC (forced via TEST_DATA_MODE)
# Running fresh migrations...
# Running seeders...
# ✅ Dynamic bootstrap completed in 45.2s
# 📸 Capturing snapshot (CAPTURE_SNAPSHOT=true)...
# ✅ Snapshot created successfully
#    Duration: 2.45s
#    Size: 5.23 MB
#    Hash: a1b2c3d4e5f6
```

#### Method 2: Via Script

```bash
# Create snapshot from current database state
node -e "
import { SnapshotManager } from './tests/helpers/snapshot-manager.js';
const sm = new SnapshotManager();
await sm.createSnapshot({
  createdBy: 'manual',
  purpose: 'Team baseline snapshot'
});
"
```

#### Method 3: After Successful Test Run

```bash
# Capture snapshot only if all tests pass
CAPTURE_SNAPSHOT_ON_SUCCESS=true npm test

# Snapshot created in teardown phase if tests succeed
```

### Creating Named Snapshot Versions

```bash
# Create version-specific snapshots for different scenarios
SNAPSHOT_VERSION=minimal CAPTURE_SNAPSHOT=true TEST_DATA_MODE=DYNAMIC npm test
SNAPSHOT_VERSION=full CAPTURE_SNAPSHOT=true TEST_DATA_MODE=DYNAMIC npm test
SNAPSHOT_VERSION=edge-cases CAPTURE_SNAPSHOT=true TEST_DATA_MODE=DYNAMIC npm test

# Result:
# tests/snapshots/snapshot-minimal-a1b2c3.sql
# tests/snapshots/snapshot-full-a1b2c3.sql
# tests/snapshots/snapshot-edge-cases-a1b2c3.sql
```

### Snapshot Quality Checklist

Before distributing a snapshot to the team, verify:

- [ ] All critical seeders executed successfully
- [ ] Database contains expected entities (orgs, users, roles, etc.)
- [ ] Relationships and foreign keys are intact
- [ ] No orphaned or corrupted data
- [ ] Tests pass against the snapshot
- [ ] Metadata file generated correctly
- [ ] File size is reasonable (<20MB)

```bash
# Verify snapshot quality
node -e "
import { SnapshotManager } from './tests/helpers/snapshot-manager.js';
const sm = new SnapshotManager();

// Check snapshot exists and is valid
console.log('Snapshot valid:', sm.snapshotExists());

// Get snapshot details
const snapshots = sm.listSnapshots();
console.table(snapshots);

// Test restore
await sm.restoreSnapshot();
console.log('✅ Snapshot restored successfully');
"
```

---

## Debugging Issues

### Issue: Tests are Slow (Not Using Snapshot)

#### Symptoms
- Tests take 30-60s to bootstrap instead of 1-3s
- Logs show "Using DYNAMIC mode" every time

#### Diagnosis

```bash
# Check snapshot status
node -e "
import { SnapshotManager } from './tests/helpers/snapshot-manager.js';
const sm = new SnapshotManager();
const config = sm.getModeConfig();
console.log('Mode:', config.mode);
console.log('Snapshot exists:', config.snapshotExists);
console.log('Should use dynamic:', config.shouldUseDynamic);
console.log('Current hash:', config.dataModelHash);
"
```

#### Possible Causes

**1. No Snapshot Created**
```bash
# Solution: Create snapshot
TEST_DATA_MODE=DYNAMIC CAPTURE_SNAPSHOT=true npm test
```

**2. Hash Mismatch (Seeder/Migration Changed)**
```bash
# Expected behavior - snapshot is correctly invalidated
# Solution: Let it recreate automatically or force new snapshot
npm test  # AUTO mode will recreate
```

**3. Snapshot Too Old**
```bash
# Check snapshot age
ls -lh tests/snapshots/

# Solution: Create fresh snapshot
rm tests/snapshots/*.sql*
TEST_DATA_MODE=DYNAMIC CAPTURE_SNAPSHOT=true npm test
```

**4. Wrong Mode Configuration**
```bash
# Check environment
echo $TEST_DATA_MODE  # Should be AUTO or SNAPSHOT

# Solution: Fix environment
unset TEST_DATA_MODE  # Use default AUTO mode
```

### Issue: "Snapshot not found" Error

#### Symptoms
- Error message: "Snapshot not found: /path/to/snapshot-latest-*.sql"
- Tests fail to start

#### Diagnosis

```bash
# Check snapshot directory
ls -la tests/snapshots/

# Check if directory exists
[ -d "tests/snapshots" ] && echo "Directory exists" || echo "Directory missing"
```

#### Solutions

**1. Snapshot Directory Missing**
```bash
mkdir -p tests/snapshots
touch tests/snapshots/.gitkeep
```

**2. No Snapshots Created Yet**
```bash
# Create initial snapshot
TEST_DATA_MODE=DYNAMIC CAPTURE_SNAPSHOT=true npm test
```

**3. Snapshot Files Deleted**
```bash
# Recreate snapshot
TEST_DATA_MODE=DYNAMIC CAPTURE_SNAPSHOT=true npm test
```

**4. Using SNAPSHOT Mode Without Snapshot**
```bash
# Use AUTO mode instead (falls back gracefully)
TEST_DATA_MODE=AUTO npm test
```

### Issue: Database Restore Fails

#### Symptoms
- Error: "Failed to restore snapshot"
- MySQL errors in logs

#### Diagnosis

```bash
# Test MySQL connection
mysql -h $DB_HOST -P $DB_PORT -u $DB_USERNAME -p$DB_PASSWORD -e "SELECT 1"

# Check mysqldump availability
which mysqldump
mysqldump --version

# Verify snapshot file integrity
file tests/snapshots/snapshot-latest-*.sql
head -n 20 tests/snapshots/snapshot-latest-*.sql
```

#### Solutions

**1. MySQL Tools Not Installed**
```bash
# macOS
brew install mysql-client
export PATH="/opt/homebrew/opt/mysql-client/bin:$PATH"

# Ubuntu/Debian
sudo apt-get install mysql-client

# Verify installation
mysqldump --version
```

**2. Database Credentials Wrong**
```bash
# Test credentials
mysql -h $DB_HOST -u $DB_USERNAME -p$DB_PASSWORD -e "SHOW DATABASES"

# Update .env file
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=verifast_test
DB_USERNAME=root
DB_PASSWORD=your_password
```

**3. Insufficient Permissions**
```bash
# Grant necessary permissions
mysql -u root -p <<EOF
GRANT ALL PRIVILEGES ON verifast_test.* TO 'test_user'@'localhost';
GRANT CREATE, DROP ON *.* TO 'test_user'@'localhost';
FLUSH PRIVILEGES;
EOF
```

**4. Corrupted Snapshot File**
```bash
# Delete and recreate
rm tests/snapshots/snapshot-latest-*.sql*
TEST_DATA_MODE=DYNAMIC CAPTURE_SNAPSHOT=true npm test
```

### Issue: EntityRegistry Not Finding Entities

#### Symptoms
- Error: "Entity not found: organization/ACME Corp"
- Tests fail with UUID lookup errors

#### Diagnosis

```bash
# Check if registry initialized
node -e "
import { EntityRegistry } from './tests/helpers/entity-registry.js';
console.log('Initialized:', EntityRegistry.isInitialized());
"

# List available entities
node -e "
import { EntityRegistry } from './tests/helpers/entity-registry.js';
// Initialize first (needs auth token)
const orgs = EntityRegistry.getAll('organization');
console.log('Organizations:', orgs.map(o => o.name));
"
```

#### Solutions

**1. Registry Not Initialized**
```javascript
// In test file, ensure initialization in beforeAll
test.beforeAll(async ({ request }) => {
    await EntityRegistry.initialize(request, authToken);
});
```

**2. Entity Name Mismatch**
```javascript
// Search for entity to find exact name
const matches = EntityRegistry.search('organization', 'ACME');
console.log('Matches:', matches.map(o => o.name));

// Use exact name from search results
const orgId = EntityRegistry.getOrganizationId('ACME Corporation'); // Exact match
```

**3. Entity Doesn't Exist in Database**
```bash
# Check database directly
mysql -u root -p verifast_test -e "SELECT id, name FROM organizations"

# If missing, verify seeders ran
TEST_DATA_MODE=DYNAMIC npm test
```

### Issue: Hash Generation Fails

#### Symptoms
- Warning: "Could not read file: /path/to/seeder.php"
- Hash shows as "no-hash"

#### Diagnosis

```bash
# Check Laravel API path
ls -la /Users/isecco/Code/verifast/api/database/seeders/

# Test hash generation
node -e "
import { SnapshotManager } from './tests/helpers/snapshot-manager.js';
const sm = new SnapshotManager();
const hash = sm.generateDataModelHash();
console.log('Hash:', hash);
"
```

#### Solutions

**1. Incorrect API Path**
```javascript
// Update path in snapshot-manager.js or pass via config
const sm = new SnapshotManager({
    apiPath: '/correct/path/to/laravel/api'
});
```

**2. File Permissions**
```bash
# Fix permissions on Laravel API directory
chmod -R +r /path/to/laravel/api/database/
```

**3. Files Not Readable**
```bash
# Ensure files are readable
ls -la /path/to/laravel/api/database/seeders/
ls -la /path/to/laravel/api/database/migrations/
```

---

## CI/CD Integration

### GitHub Actions

#### Basic Configuration

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: root
          MYSQL_DATABASE: verifast_test
        ports:
          - 3306:3306
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=5

    steps:
      - name: Checkout Code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Cache Snapshots
        uses: actions/cache@v3
        with:
          path: tests/snapshots
          key: snapshot-${{ hashFiles('api/database/**/*.php') }}
          restore-keys: |
            snapshot-

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

      - name: Upload Test Results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30

      - name: Upload Snapshots
        if: success()
        uses: actions/upload-artifact@v3
        with:
          name: test-snapshots
          path: tests/snapshots/
          retention-days: 7
```

#### Advanced: Snapshot Caching Strategy

```yaml
# Cache snapshots based on database file hashes
- name: Cache Snapshots
  id: snapshot-cache
  uses: actions/cache@v3
  with:
    path: tests/snapshots
    key: snapshot-v1-${{ hashFiles('api/database/seeders/**/*.php', 'api/database/migrations/**/*.php', 'api/database/factories/**/*.php') }}
    restore-keys: |
      snapshot-v1-

- name: Log Cache Status
  run: |
    if [ "${{ steps.snapshot-cache.outputs.cache-hit }}" == "true" ]; then
      echo "✅ Snapshot cache hit - fast bootstrap expected"
    else
      echo "📦 Snapshot cache miss - will create new snapshot"
    fi
```

### GitLab CI

```yaml
# .gitlab-ci.yml
test:
  image: node:18
  stage: test
  timeout: 30m

  services:
    - mysql:8.0

  variables:
    MYSQL_ROOT_PASSWORD: root
    MYSQL_DATABASE: verifast_test
    DB_HOST: mysql
    DB_PORT: 3306
    DB_DATABASE: verifast_test
    DB_USERNAME: root
    DB_PASSWORD: root
    TEST_DATA_MODE: AUTO
    CAPTURE_SNAPSHOT_ON_SUCCESS: "true"

  cache:
    key: snapshot-$CI_COMMIT_REF_SLUG
    paths:
      - tests/snapshots/

  before_script:
    - npm ci
    - apt-get update && apt-get install -y mysql-client

  script:
    - npm test

  artifacts:
    when: always
    paths:
      - playwright-report/
      - tests/snapshots/
    expire_in: 7 days
    reports:
      junit: playwright-report/results.xml
```

### Jenkins

```groovy
// Jenkinsfile
pipeline {
    agent any

    environment {
        TEST_DATA_MODE = 'AUTO'
        CAPTURE_SNAPSHOT_ON_SUCCESS = 'true'
        DB_HOST = '127.0.0.1'
        DB_PORT = '3306'
        DB_DATABASE = 'verifast_test'
        DB_USERNAME = 'root'
        DB_PASSWORD = credentials('mysql-password')
    }

    stages {
        stage('Setup') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Start MySQL') {
            steps {
                sh 'docker run -d --name mysql-test -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=verifast_test -p 3306:3306 mysql:8.0'
                sh 'sleep 15'  // Wait for MySQL to be ready
            }
        }

        stage('Test') {
            steps {
                sh 'npm test'
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'playwright-report/**', fingerprint: true
            junit 'playwright-report/results.xml'
        }
        success {
            archiveArtifacts artifacts: 'tests/snapshots/**', fingerprint: true
        }
        cleanup {
            sh 'docker rm -f mysql-test || true'
        }
    }
}
```

### Parallel Test Execution

```yaml
# GitHub Actions - Parallel execution with separate databases
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3, 4]

    steps:
      # ... setup steps ...

      - name: Run Tests (Shard ${{ matrix.shard }})
        env:
          TEST_DATA_MODE: AUTO
          DB_DATABASE: verifast_test_${{ matrix.shard }}
          SNAPSHOT_VERSION: shard-${{ matrix.shard }}
        run: npx playwright test --shard=${{ matrix.shard }}/4
```

---

## Monitoring

### Key Metrics to Track

#### Bootstrap Performance

```bash
# Log bootstrap duration on every run
# Extract from test logs:
# ✅ Bootstrap completed in 2.34s (SNAPSHOT)
# ✅ Bootstrap completed in 45.67s (DYNAMIC)

# Example monitoring script
node scripts/monitor-bootstrap.js
```

```javascript
// scripts/monitor-bootstrap.js
import { SnapshotManager } from './tests/helpers/snapshot-manager.js';

const sm = new SnapshotManager();
const config = sm.getModeConfig();

const metrics = {
    timestamp: new Date().toISOString(),
    mode: config.mode,
    snapshotExists: config.snapshotExists,
    dataModelHash: config.dataModelHash,
    snapshotVersion: config.snapshotVersion,
};

// Send to monitoring system (Datadog, CloudWatch, etc.)
console.log(JSON.stringify(metrics));
```

#### Snapshot Health

```bash
# Monitor snapshot age and validity
node -e "
import { SnapshotManager } from './tests/helpers/snapshot-manager.js';
const sm = new SnapshotManager();
const snapshots = sm.listSnapshots();

snapshots.forEach(snap => {
    const ageHours = (Date.now() - snap.created) / 1000 / 60 / 60;
    console.log(\`Snapshot: \${snap.name}\`);
    console.log(\`  Age: \${ageHours.toFixed(1)} hours\`);
    console.log(\`  Size: \${snap.sizeMB} MB\`);
    console.log(\`  Valid: \${snap.metadata ? 'Yes' : 'No metadata'}\`);
});
"
```

#### Test Execution Metrics

Track these metrics over time:
- Bootstrap duration (DYNAMIC vs SNAPSHOT)
- Snapshot hit rate (% using snapshot vs dynamic)
- Snapshot invalidation frequency
- Test execution total time
- Failure rate by mode

### Logging Best Practices

```bash
# Enable verbose logging
DEBUG=snapshot:* npm test

# Log format
# [TIMESTAMP] [COMPONENT] [LEVEL] Message
# 2026-01-22 12:00:00 [SnapshotManager] [INFO] ✅ Snapshot created successfully
# 2026-01-22 12:00:01 [TestDataBootstrap] [WARN] ⚠️  Snapshot restore failed
```

### Alerting Rules

Configure alerts for:
- **Snapshot creation failures**: > 1 in 24 hours
- **Restore failures**: > 2 in 1 hour
- **Bootstrap time regression**: > 50% increase
- **Disk space**: Snapshot directory > 500MB
- **Snapshot age**: All snapshots > 14 days old

---

## Disaster Recovery

### Scenario 1: All Snapshots Corrupted

#### Symptoms
- All snapshot restores fail
- Tests can't bootstrap

#### Recovery Steps

```bash
# 1. Delete all snapshots
rm -rf tests/snapshots/*.sql*

# 2. Force dynamic mode
TEST_DATA_MODE=DYNAMIC npm test

# 3. Capture new snapshot
TEST_DATA_MODE=DYNAMIC CAPTURE_SNAPSHOT=true npm test

# 4. Verify snapshot works
TEST_DATA_MODE=SNAPSHOT npm test
```

### Scenario 2: Database Completely Lost

#### Recovery Steps

```bash
# 1. Recreate database
mysql -u root -p <<EOF
DROP DATABASE IF EXISTS verifast_test;
CREATE DATABASE verifast_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EOF

# 2. Run fresh migrations and seeders
cd /path/to/laravel/api
php artisan migrate:fresh --env=testing --force
php artisan db:seed --env=testing --force

# 3. Capture snapshot
cd /path/to/test-framework
TEST_DATA_MODE=DYNAMIC CAPTURE_SNAPSHOT=true npm test
```

### Scenario 3: Snapshot Directory Deleted

#### Recovery Steps

```bash
# 1. Recreate directory structure
mkdir -p tests/snapshots
touch tests/snapshots/.gitkeep

# 2. Download from backup (if available)
# From CI artifacts, S3, etc.

# 3. Or recreate from scratch
TEST_DATA_MODE=DYNAMIC CAPTURE_SNAPSHOT=true npm test
```

### Backup Strategies

#### Strategy 1: CI Artifacts

```yaml
# Upload snapshots as artifacts (retention: 30 days)
- name: Upload Snapshots
  uses: actions/upload-artifact@v3
  with:
    name: snapshots-${{ github.sha }}
    path: tests/snapshots/
    retention-days: 30
```

#### Strategy 2: Cloud Storage

```bash
# Backup to S3
aws s3 sync tests/snapshots/ s3://my-bucket/test-snapshots/latest/

# Restore from S3
aws s3 sync s3://my-bucket/test-snapshots/latest/ tests/snapshots/
```

#### Strategy 3: Git LFS (for versioned snapshots)

```bash
# Track specific snapshots in git
git lfs track "tests/snapshots/snapshot-v*.sql"
git add .gitattributes tests/snapshots/snapshot-v*.sql
git commit -m "Add versioned snapshots"
```

---

## Maintenance Tasks

### Weekly Tasks

#### 1. Cleanup Old Snapshots

```bash
# Automated cleanup (keeps last 3)
node -e "
import { SnapshotManager } from './tests/helpers/snapshot-manager.js';
new SnapshotManager().cleanupOldSnapshots(3);
"

# Manual cleanup
find tests/snapshots/ -name "*.sql" -mtime +7 -delete
find tests/snapshots/ -name "*.meta.json" -mtime +7 -delete
```

#### 2. Verify Snapshot Validity

```bash
# Test snapshot restore
node -e "
import { SnapshotManager } from './tests/helpers/snapshot-manager.js';
const sm = new SnapshotManager();

if (sm.snapshotExists()) {
    await sm.restoreSnapshot();
    console.log('✅ Snapshot valid');
} else {
    console.log('❌ No valid snapshot');
}
"
```

#### 3. Update Baseline Snapshots

```bash
# Create fresh baseline for team
TEST_DATA_MODE=DYNAMIC CAPTURE_SNAPSHOT=true npm test

# Upload to shared location
aws s3 cp tests/snapshots/ s3://team-snapshots/baseline/ --recursive
```

### Monthly Tasks

#### 1. Audit Snapshot Storage

```bash
# Check disk usage
du -sh tests/snapshots/
df -h /path/to/tests

# List all snapshots with details
ls -lh tests/snapshots/

# Analyze snapshot sizes
node -e "
import { SnapshotManager } from './tests/helpers/snapshot-manager.js';
const sm = new SnapshotManager();
const snapshots = sm.listSnapshots();
const totalMB = snapshots.reduce((sum, s) => sum + parseFloat(s.sizeMB), 0);
console.log(\`Total snapshots: \${snapshots.length}\`);
console.log(\`Total size: \${totalMB.toFixed(2)} MB\`);
"
```

#### 2. Review Snapshot Versions

```bash
# List all versions
ls tests/snapshots/ | grep -E "snapshot-.*\.sql$"

# Decide which versions to keep/delete
# Keep: latest, production, stable
# Delete: outdated, test, experimental
```

#### 3. Performance Analysis

```bash
# Analyze bootstrap times over past month
grep "Bootstrap completed" ci-logs.txt | awk '{print $4}' | sort -n

# Compare DYNAMIC vs SNAPSHOT durations
grep "SNAPSHOT.*Bootstrap completed" ci-logs.txt | awk '{print $4}' | avg
grep "DYNAMIC.*Bootstrap completed" ci-logs.txt | awk '{print $4}' | avg
```

### Quarterly Tasks

#### 1. Update Documentation

- Review runbook for accuracy
- Update troubleshooting sections
- Add new known issues
- Update metrics and benchmarks

#### 2. Dependency Updates

```bash
# Update MySQL client tools
brew upgrade mysql-client  # macOS
apt-get update && apt-get upgrade mysql-client  # Ubuntu

# Verify compatibility
mysqldump --version
```

#### 3. Disaster Recovery Test

```bash
# Simulate disaster scenario
rm -rf tests/snapshots/
# Follow recovery procedures
# Document time to recover
```

---

## Performance Tuning

### Optimizing Snapshot Size

#### 1. Exclude Unnecessary Tables

```javascript
// Modify snapshot-manager.js
const mysqldumpCmd = [
    'mysqldump',
    // ... other options ...
    '--ignore-table=verifast_test.logs',
    '--ignore-table=verifast_test.cache',
    this.dbConfig.database,
].join(' ');
```

#### 2. Compress Snapshots

```bash
# Gzip compression
mysqldump ... | gzip > snapshot.sql.gz

# Restore
gunzip < snapshot.sql.gz | mysql ...
```

#### 3. Use Minimal Data Sets

```bash
# Create minimal snapshot for fast tests
SNAPSHOT_VERSION=minimal npm test

# Minimal seeder creates only essential data
```

### Optimizing Restore Speed

#### 1. Disable Binary Logging

```javascript
const restoreCmd = [
    'mysql',
    '--init-command="SET SESSION sql_log_bin=0"',
    // ... other options ...
];
```

#### 2. Increase Buffer Sizes

```bash
mysql --max_allowed_packet=256M --net_buffer_length=16384 < snapshot.sql
```

#### 3. Parallel Restore (Multiple Databases)

```bash
# Restore multiple shards in parallel
for i in {1..4}; do
    mysql verifast_test_$i < snapshot.sql &
done
wait
```

### Optimizing Hash Generation

#### 1. Cache Hash Results

```javascript
// Cache hash for CI run duration
let cachedHash = null;

generateDataModelHash() {
    if (cachedHash) return cachedHash;
    cachedHash = this._computeHash();
    return cachedHash;
}
```

#### 2. Selective File Scanning

```javascript
// Only scan files modified in last N days
const cutoffDate = Date.now() - (7 * 24 * 60 * 60 * 1000);
const files = this._getFilesRecursively(dir).filter(f => {
    const stat = fs.statSync(f);
    return stat.mtime > cutoffDate;
});
```

---

## Advanced Operations

### Creating Multiple Snapshot Variants

```bash
# Minimal data (fast, essential only)
SNAPSHOT_VERSION=minimal TEST_DATA_MODE=DYNAMIC CAPTURE_SNAPSHOT=true npm test

# Full data (complete test coverage)
SNAPSHOT_VERSION=full TEST_DATA_MODE=DYNAMIC CAPTURE_SNAPSHOT=true npm test

# Edge cases (boundary conditions)
SNAPSHOT_VERSION=edge TEST_DATA_MODE=DYNAMIC CAPTURE_SNAPSHOT=true npm test

# Use specific variant
SNAPSHOT_VERSION=minimal npm test
```

### Snapshot Migration

```bash
# Migrate snapshot to new database structure

# 1. Restore old snapshot
TEST_DATA_MODE=SNAPSHOT npm test

# 2. Run pending migrations
mysql verifast_test < new-migrations.sql

# 3. Capture updated snapshot
TEST_DATA_MODE=DYNAMIC CAPTURE_SNAPSHOT=true npm test
```

### Cross-Environment Snapshots

```bash
# Export from development
mysqldump --host=dev-db verifast_test > dev-snapshot.sql

# Import to staging
mysql --host=staging-db verifast_test < dev-snapshot.sql

# Capture as staging snapshot
SNAPSHOT_VERSION=from-dev CAPTURE_SNAPSHOT=true npm test
```

---

## Related Documentation

- [Architecture Decision Record](./001-adr-test-data-management.md)
- [Technical Design](./technical-design.md)
- [Quick Start Guide](./quick-start-guide.md)
- [Architecture Diagrams](./architecture-diagrams.md)
- [Implementation Checklist](./implementation-checklist.md)

---

**Last Updated**: 2026-01-22
**Maintained By**: QA Automation Team
**On-Call**: qa-automation@example.com
