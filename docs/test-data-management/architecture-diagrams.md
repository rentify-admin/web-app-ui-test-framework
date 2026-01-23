# Architecture Diagrams: Test Data Management System

**Visual Guide to System Design**

---

## Table of Contents

1. [System Overview](#system-overview)
2. [DYNAMIC Mode Sequence](#dynamic-mode-sequence)
3. [SNAPSHOT Mode Sequence](#snapshot-mode-sequence)
4. [AUTO Mode Decision Flow](#auto-mode-decision-flow)
5. [Component Interaction](#component-interaction)
6. [Data Model](#data-model)
7. [Deployment Architecture](#deployment-architecture)

---

## System Overview

### High-Level System Context

```mermaid
graph TB
    subgraph "External Systems"
        DEV[Developer Machine]
        CI[CI/CD Pipeline]
    end

    subgraph "Test Framework"
        PW[Playwright Test Suite<br/>72 test files]
    end

    subgraph "Test Data Management"
        TDB[TestDataBootstrap<br/>Orchestration Layer]
        SM[SnapshotManager<br/>Snapshot Operations]
        ER[EntityRegistry<br/>Name Resolution]
    end

    subgraph "Laravel API"
        API[Laravel Application]
        MIG[Migrations]
        SEED[Seeders]
        FACT[Factories]
    end

    subgraph "Storage"
        DB[(MySQL Test Database)]
        FS[File System<br/>tests/snapshots/]
    end

    DEV -->|Run Tests| PW
    CI -->|Run Tests| PW
    PW -->|Global Setup| TDB
    TDB -->|Mode Selection| SM
    TDB -->|Fresh Seeding| API
    SM -->|Create/Restore| FS
    SM -->|Read/Write| DB
    API --> MIG
    MIG --> SEED
    SEED --> FACT
    FACT --> DB
    PW -->|Entity Lookup| ER
    ER -->|Query| DB

    style TDB fill:#4A90E2,color:#fff
    style SM fill:#E24A4A,color:#fff
    style ER fill:#4AE290,color:#fff
    style DB fill:#FFD700
```

**Explanation**:
- **External Systems**: Developers and CI/CD trigger test execution
- **Test Framework**: Playwright orchestrates test runs across 72 test files
- **Test Data Management**: Three core components handle data provisioning
- **Laravel API**: Standard Laravel seeding infrastructure
- **Storage**: MySQL database and local file system for snapshots

**Key Components**:
- **TestDataBootstrap**: Entry point, orchestrates bootstrap and teardown
- **SnapshotManager**: Handles snapshot lifecycle and validation
- **EntityRegistry**: Provides name-to-UUID resolution for tests

**Design Decisions**:
- **Separation of concerns**: Each component has single responsibility
- **No test changes**: Tests interact only with EntityRegistry, unchanged bootstrap
- **Flexible modes**: Environment variables control behavior
- **Graceful degradation**: Automatic fallback to dynamic mode on errors

---

## DYNAMIC Mode Sequence

### Fresh Data Creation Flow

```mermaid
sequenceDiagram
    actor Dev as Developer
    participant PW as Playwright
    participant TDB as TestDataBootstrap
    participant SM as SnapshotManager
    participant LA as Laravel Artisan
    participant DB as MySQL Database
    participant FS as File System

    Dev->>PW: npm test<br/>(TEST_DATA_MODE=DYNAMIC)

    Note over PW: Global Setup Phase
    PW->>TDB: bootstrap()
    TDB->>SM: shouldUseDynamicMode()
    SM-->>TDB: true (DYNAMIC mode)

    Note over TDB,DB: Dynamic Bootstrap (30-60s)
    TDB->>LA: php artisan migrate:fresh --force
    LA->>DB: DROP ALL TABLES
    LA->>DB: CREATE TABLES (run migrations)
    LA-->>TDB: Migrations complete

    TDB->>LA: php artisan db:seed --class=SystemDataSeeder
    LA->>DB: INSERT seed data
    LA-->>TDB: Seeding complete

    alt CAPTURE_SNAPSHOT=true
        TDB->>SM: createSnapshot()
        Note over SM: Generate hash<br/>from seeders/migrations
        SM->>DB: mysqldump --single-transaction
        DB-->>SM: SQL dump (5-10MB)
        SM->>FS: Write snapshot-latest-abc123.sql
        SM->>FS: Write metadata JSON
        SM-->>TDB: Snapshot created (2-5s)
    end

    TDB-->>PW: Bootstrap complete (30-60s)

    Note over PW: Test Execution Phase
    PW->>DB: Run all tests
    DB-->>PW: Test results

    Note over PW: Global Teardown Phase
    PW->>TDB: teardown(testsSucceeded)

    alt Tests passed & CAPTURE_SNAPSHOT_ON_SUCCESS=true
        TDB->>SM: createSnapshot()
        SM->>DB: mysqldump
        SM->>FS: Save snapshot
    end

    TDB-->>PW: Teardown complete
    PW-->>Dev: Test results
```

**Explanation**:

1. **Initialization**: Developer triggers test run with DYNAMIC mode
2. **Mode Selection**: SnapshotManager confirms dynamic mode
3. **Database Reset**: Laravel runs `migrate:fresh` to drop and recreate all tables
4. **Seeding**: SystemDataSeeder populates database with test data
5. **Optional Snapshot**: If configured, captures snapshot immediately after seeding
6. **Test Execution**: Tests run against freshly seeded database
7. **Teardown Snapshot**: If tests pass, optionally captures proven-good snapshot

**Performance Characteristics**:
- **Total Duration**: 30-60 seconds
- **Migrate Fresh**: 3-5 seconds
- **Seeding**: 25-55 seconds (varies by data volume)
- **Snapshot Capture**: 2-5 seconds (if enabled)

**Use Cases**:
- First-time setup (no snapshot exists)
- Debugging data-related issues
- After seeder/migration changes (auto-triggered by AUTO mode)
- Capturing proven-good snapshots for team

---

## SNAPSHOT Mode Sequence

### Fast Snapshot Restoration Flow

```mermaid
sequenceDiagram
    actor Dev as Developer
    participant PW as Playwright
    participant TDB as TestDataBootstrap
    participant SM as SnapshotManager
    participant HG as Hash Generator
    participant FS as File System
    participant DB as MySQL Database

    Dev->>PW: npm test<br/>(TEST_DATA_MODE=SNAPSHOT or AUTO)

    Note over PW: Global Setup Phase
    PW->>TDB: bootstrap()
    TDB->>SM: shouldUseDynamicMode()

    Note over SM: Validate Snapshot
    SM->>HG: generateDataModelHash()
    HG->>FS: Read seeders/*.php
    HG->>FS: Read factories/*.php
    HG->>FS: Read migrations/*.php
    HG->>HG: Compute MD5 hash
    HG-->>SM: Current hash: def456

    SM->>FS: Read snapshot metadata
    FS-->>SM: Snapshot hash: def456, age: 2 days

    alt Hashes Match & Not Stale
        SM-->>TDB: false (use snapshot)

        Note over TDB,DB: Snapshot Restore (1-3s)
        TDB->>SM: restoreSnapshot()
        SM->>FS: Locate snapshot-latest-def456.sql

        SM->>DB: DROP DATABASE IF EXISTS verifast_test
        SM->>DB: CREATE DATABASE verifast_test

        SM->>FS: Read SQL file
        SM->>DB: Execute SQL commands

        DB-->>SM: Restore complete
        SM-->>TDB: Snapshot restored (1-3s)

    else Hashes Don't Match or Stale
        Note over SM: Auto-invalidation triggered
        SM-->>TDB: true (fallback to dynamic)
        Note over TDB: See DYNAMIC mode flow
    end

    TDB-->>PW: Bootstrap complete (1-3s)

    Note over PW: Test Execution Phase
    PW->>DB: Run all tests
    DB-->>PW: Test results

    Note over PW: Global Teardown Phase
    PW->>TDB: teardown(testsSucceeded)
    TDB-->>PW: Teardown complete
    PW-->>Dev: Test results (total: 1-3s + test time)
```

**Explanation**:

1. **Hash Generation**: Compute current hash from seeders, factories, migrations
2. **Snapshot Validation**: Compare current hash with snapshot metadata hash
3. **Age Check**: Ensure snapshot is not older than configured max age
4. **Database Reset**: Drop and recreate database (fast, no data)
5. **Snapshot Restore**: Execute SQL commands from snapshot file
6. **Test Execution**: Tests run against restored database state

**Performance Characteristics**:
- **Total Duration**: 1-3 seconds
- **Hash Generation**: 0.1-1 second (~100-200 PHP files)
- **Database Drop/Create**: 0.1-0.5 seconds
- **SQL Restore**: 0.5-2 seconds (5-10MB SQL file)

**Hash-Based Invalidation**:
- **What triggers invalidation**: Any change to seeders, factories, or migrations
- **How it's detected**: MD5 hash of all PHP file contents
- **What happens**: Automatic fallback to DYNAMIC mode
- **Collision probability**: 1 in 10^36 (negligible)

**Use Cases**:
- Local development iterations (rapid feedback)
- CI/CD pipelines (fast, consistent)
- Debugging specific test failures (reproducible state)
- Team collaboration (shared known-good state)

---

## AUTO Mode Decision Flow

### Intelligent Mode Selection

```mermaid
flowchart TD
    Start([Test Execution Starts]) --> ReadEnv{Read TEST_DATA_MODE}

    ReadEnv -->|DYNAMIC| ForceDynamic[Force DYNAMIC Mode]
    ReadEnv -->|SNAPSHOT| ForceSnapshot{Snapshot Exists?}
    ReadEnv -->|AUTO or unset| AutoMode[AUTO Mode Logic]

    ForceSnapshot -->|Yes| UseSnapshot[Use SNAPSHOT Mode]
    ForceSnapshot -->|No| FallbackDynamic[Warn: Snapshot Not Found<br/>Fallback to DYNAMIC]

    AutoMode --> CheckSnapshot{Valid Snapshot<br/>Exists?}

    CheckSnapshot -->|No Snapshot File| UseDynamic[Use DYNAMIC Mode]
    CheckSnapshot -->|File Exists| LoadMeta{Load Metadata}

    LoadMeta -->|No Metadata| WarnNoMeta[Warn: No Metadata<br/>Use Snapshot Anyway]
    LoadMeta -->|Metadata Found| ValidateAge{Age < Max Age?}

    ValidateAge -->|Too Old| InvalidAge[Invalid: Stale<br/>Use DYNAMIC Mode]
    ValidateAge -->|Age OK| ValidateHash{Hash Matches?}

    ValidateHash -->|No Match| InvalidHash[Invalid: Data Model Changed<br/>Use DYNAMIC Mode]
    ValidateHash -->|Match| ValidSnapshot[Valid Snapshot<br/>Use SNAPSHOT Mode]

    ForceDynamic --> DynamicFlow[Dynamic Bootstrap Flow<br/>30-60s]
    FallbackDynamic --> DynamicFlow
    UseDynamic --> DynamicFlow
    InvalidAge --> DynamicFlow
    InvalidHash --> DynamicFlow

    UseSnapshot --> SnapshotFlow[Snapshot Restore Flow<br/>1-3s]
    WarnNoMeta --> SnapshotFlow
    ValidSnapshot --> SnapshotFlow

    DynamicFlow --> OptionalCapture{CAPTURE_SNAPSHOT?}
    OptionalCapture -->|Yes| CreateSnapshot[Create Snapshot<br/>for Future Use]
    OptionalCapture -->|No| RunTests
    CreateSnapshot --> RunTests[Execute Tests]

    SnapshotFlow --> RunTests

    RunTests --> Complete([Bootstrap Complete])

    style ForceDynamic fill:#FFD700
    style UseSnapshot fill:#90EE90
    style ValidSnapshot fill:#90EE90
    style UseDynamic fill:#FFD700
    style InvalidAge fill:#FF6B6B
    style InvalidHash fill:#FF6B6B
    style Complete fill:#4A90E2
```

**Explanation**:

**Mode Selection Logic**:

1. **DYNAMIC Mode**:
   - Always runs fresh migrations and seeders
   - Bypasses snapshot entirely
   - Use case: Debugging, ensuring absolute freshness

2. **SNAPSHOT Mode**:
   - Requires valid snapshot to exist
   - Fails if snapshot not available (with fallback)
   - Use case: Fast local iterations, CI/CD

3. **AUTO Mode** (Recommended Default):
   - Intelligent decision based on snapshot validity
   - Checks snapshot existence, age, and hash
   - Automatic fallback to dynamic mode
   - Use case: Best balance of speed and reliability

**Validation Checks**:

1. **File Existence**: Does snapshot file exist on disk?
2. **Metadata Present**: Is accompanying `.meta.json` file present?
3. **Age Check**: Is snapshot younger than `SNAPSHOT_MAX_AGE` (default: 7 days)?
4. **Hash Match**: Does snapshot hash match current data model hash?

**Fallback Strategy**:
- Any validation failure → Automatic fallback to DYNAMIC mode
- Logs clear message explaining why fallback occurred
- No test failures due to snapshot issues
- Ensures tests always run successfully

**Design Rationale**:
- **Safety First**: Tests never fail due to missing snapshot
- **Performance Opportunistic**: Use snapshot when safe, not when risky
- **Transparent**: Clear logging of decision process
- **Zero Configuration**: Works out of the box with sensible defaults

---

## Component Interaction

### Component Relationships and Dependencies

```mermaid
graph TB
    subgraph "Entry Points"
        GS[Global Setup]
        GT[Global Teardown]
        TEST[Test Files]
    end

    subgraph "Orchestration"
        TDB[TestDataBootstrap]
    end

    subgraph "Core Services"
        SM[SnapshotManager]
        ER[EntityRegistry]
    end

    subgraph "Utilities"
        HG[Hash Generator]
        SV[Snapshot Validator]
        MC[Mode Selector]
    end

    subgraph "External"
        LA[Laravel Artisan]
        DB[(Database)]
        FS[File System]
        API[API Endpoints]
    end

    GS -->|Calls| TDB
    GT -->|Calls| TDB
    TEST -->|Uses| ER

    TDB -->|Manages| SM
    TDB -->|Executes| LA

    SM -->|Uses| HG
    SM -->|Uses| SV
    SM -->|Uses| MC
    SM -->|Reads/Writes| FS
    SM -->|Dumps/Restores| DB

    ER -->|Queries| API
    ER -->|Queries| DB

    LA -->|Migrates/Seeds| DB

    style TDB fill:#4A90E2,color:#fff
    style SM fill:#E24A4A,color:#fff
    style ER fill:#4AE290,color:#fff
    style DB fill:#FFD700
```

**Component Descriptions**:

### TestDataBootstrap (Orchestration Layer)
**Responsibility**: Coordinate test data setup and teardown
**Dependencies**: SnapshotManager, Laravel Artisan
**Used By**: Playwright Global Setup/Teardown
**Key Methods**:
- `bootstrap()` - Main entry point
- `bootstrapDynamic()` - Fresh seeding
- `bootstrapFromSnapshot()` - Restore snapshot
- `teardown()` - Cleanup and optional snapshot capture

### SnapshotManager (Core Service)
**Responsibility**: Snapshot lifecycle management
**Dependencies**: File System, MySQL CLI tools
**Used By**: TestDataBootstrap
**Key Methods**:
- `createSnapshot()` - Create database dump
- `restoreSnapshot()` - Restore from dump
- `generateDataModelHash()` - Compute validation hash
- `snapshotExists()` - Validate snapshot
- `shouldUseDynamicMode()` - Mode decision

### EntityRegistry (Lookup Service)
**Responsibility**: Name-to-UUID resolution
**Dependencies**: API endpoints, Database
**Used By**: Test files
**Key Methods**:
- `initialize()` - Load all entities
- `get()` - Find entity by name
- `getId()` - Get UUID by name
- Helper methods per entity type

**Interaction Patterns**:

1. **Bootstrap Phase**:
   - Global Setup → TestDataBootstrap → SnapshotManager → Database/Files

2. **Test Execution Phase**:
   - Tests → EntityRegistry → API/Database

3. **Teardown Phase**:
   - Global Teardown → TestDataBootstrap → SnapshotManager → Files

**Dependencies Summary**:

| Component | Depends On | Depended By |
|-----------|------------|-------------|
| TestDataBootstrap | SnapshotManager, Artisan | Global Setup/Teardown |
| SnapshotManager | File System, MySQL | TestDataBootstrap |
| EntityRegistry | API, Database | Test Files |
| Hash Generator | File System | SnapshotManager |
| Snapshot Validator | Metadata | SnapshotManager |

---

## Data Model

### Database Snapshot Structure

```mermaid
erDiagram
    SNAPSHOT_FILE ||--|| METADATA_FILE : has
    SNAPSHOT_FILE {
        string filename "snapshot-{version}-{hash}.sql"
        int fileSize "5-10 MB typical"
        date modified "Last modified timestamp"
        blob content "SQL dump content"
    }
    METADATA_FILE {
        string filename "snapshot-{version}-{hash}.sql.meta.json"
        timestamp createdAt "Unix timestamp"
        string createdAtISO "ISO 8601 date"
        string dataModelHash "12-char MD5 hash"
        string version "latest, v1, v2, etc"
        string database "verifast_test"
        float durationSeconds "Snapshot duration"
        int fileSizeBytes "File size in bytes"
        float fileSizeMB "File size in MB"
        string capturedVia "dynamic-bootstrap or successful-test-run"
        string bootstrapMode "DYNAMIC or SNAPSHOT"
    }
```

**Snapshot File Format**:

```sql
-- snapshot-latest-a1b2c3d4e5f6.sql

-- MySQL dump 8.0.32
-- Host: localhost    Database: verifast_test
-- ------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
-- ... MySQL dump header ...

DROP TABLE IF EXISTS `organizations`;
CREATE TABLE `organizations` (
  `id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  -- ... columns ...
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `organizations` VALUES
('uuid-1','ACME Corp','acme-corp', ...),
('uuid-2','Beta Inc','beta-inc', ...);

-- ... more tables and data ...
```

**Metadata File Format**:

```json
{
  "createdAt": 1738000000000,
  "createdAtISO": "2026-01-22T12:00:00.000Z",
  "dataModelHash": "a1b2c3d4e5f6",
  "version": "latest",
  "database": "verifast_test",
  "durationSeconds": 2.45,
  "fileSizeBytes": 5242880,
  "fileSizeMB": 5.00,
  "capturedVia": "successful-test-run",
  "bootstrapMode": "DYNAMIC"
}
```

### Entity Registry Cache Structure

```mermaid
classDiagram
    class EntityCache {
        +Array~Organization~ organizations
        +Array~Role~ roles
        +Array~Application~ applications
        +Array~Workflow~ workflows
        +Array~FlagCollection~ flagCollections
        +Boolean initialized
        +String authToken
    }

    class Organization {
        +String id
        +String name
        +String slug
        +Date created_at
    }

    class Role {
        +String id
        +String name
        +String slug
    }

    class Application {
        +String id
        +String name
        +String organization_id
    }

    class Workflow {
        +String id
        +String name
        +String application_id
    }

    class FlagCollection {
        +String id
        +String name
    }

    EntityCache "1" --> "*" Organization
    EntityCache "1" --> "*" Role
    EntityCache "1" --> "*" Application
    EntityCache "1" --> "*" Workflow
    EntityCache "1" --> "*" FlagCollection
```

**Entity Cache Example**:

```javascript
{
  organizations: [
    { id: 'uuid-1', name: 'ACME Corp', slug: 'acme-corp', ... },
    { id: 'uuid-2', name: 'Beta Inc', slug: 'beta-inc', ... },
  ],
  roles: [
    { id: 'uuid-10', name: 'Applicant', slug: 'applicant', ... },
    { id: 'uuid-11', name: 'Reviewer', slug: 'reviewer', ... },
  ],
  applications: [
    { id: 'uuid-20', name: 'Demo App', organization_id: 'uuid-1', ... },
  ],
  workflows: [
    { id: 'uuid-30', name: 'Standard Flow', application_id: 'uuid-20', ... },
  ],
  flagCollections: [
    { id: 'uuid-40', name: 'Default Flags', ... },
  ],
  initialized: true,
  authToken: 'Bearer eyJ0eXAiOiJKV1Q...'
}
```

---

## Deployment Architecture

### Development Environment

```mermaid
graph TB
    subgraph "Developer Machine"
        IDE[IDE / Editor]
        CLI[Terminal]

        subgraph "Test Framework"
            PW[Playwright]
            TDB[TestDataBootstrap]
            SM[SnapshotManager]
        end

        subgraph "Local Storage"
            FS[tests/snapshots/]
        end
    end

    subgraph "Local Services"
        DB[(MySQL<br/>localhost:3306)]
        API[Laravel API<br/>localhost:8000]
    end

    IDE -->|Edit Tests| PW
    CLI -->|npm test| PW
    PW --> TDB
    TDB --> SM
    SM --> FS
    SM --> DB
    TDB --> API
    API --> DB

    style FS fill:#FFF8DC
    style DB fill:#FFD700
```

**Development Setup**:
- All components run locally
- Snapshots stored in project directory
- Fast iteration with snapshot mode
- No external dependencies

### CI/CD Pipeline

```mermaid
graph TB
    subgraph "GitHub Actions / GitLab CI"
        RUNNER[CI Runner]

        subgraph "Docker Containers"
            NODE[Node.js 18<br/>Test Executor]
            MYSQL[MySQL 8.0<br/>Service Container]
        end

        subgraph "Build Artifacts"
            SNAP[Snapshot Artifacts]
            REPORT[Test Reports]
        end
    end

    subgraph "External Services"
        GIT[Git Repository]
        ARTIFACT[Artifact Storage<br/>S3 / GCS / Artifacts]
    end

    RUNNER --> NODE
    RUNNER --> MYSQL

    NODE -->|Create/Restore| SNAP
    NODE -->|Read/Write| MYSQL
    NODE -->|Generate| REPORT

    SNAP -.Optional Upload.-> ARTIFACT
    REPORT --> ARTIFACT

    GIT -->|Checkout Code| NODE
    ARTIFACT -.Optional Download.-> SNAP

    style MYSQL fill:#FFD700
    style SNAP fill:#90EE90
```

**CI/CD Configuration**:

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
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Download Cached Snapshot (if available)
        uses: actions/cache@v3
        with:
          path: tests/snapshots
          key: snapshot-${{ hashFiles('api/database/**/*.php') }}
          restore-keys: snapshot-

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
          name: test-results
          path: playwright-report/

      - name: Upload Snapshot (on success)
        if: success()
        uses: actions/upload-artifact@v3
        with:
          name: test-snapshot
          path: tests/snapshots/
```

**CI/CD Optimizations**:

1. **Snapshot Caching**: Cache snapshots based on hash of database files
2. **Service Containers**: MySQL runs as service container
3. **Parallel Jobs**: Multiple test jobs share cached snapshot
4. **Artifact Storage**: Upload snapshots for future runs
5. **Health Checks**: Ensure MySQL ready before tests

### Production-Like Environment

```mermaid
graph TB
    subgraph "Test Environment"
        LB[Load Balancer]

        subgraph "Test Runners (Scale: 1-10)"
            TR1[Test Runner 1]
            TR2[Test Runner 2]
            TRN[Test Runner N]
        end

        subgraph "Shared Services"
            NFS[NFS / Shared Storage<br/>Snapshots]
            DB[(MySQL Cluster<br/>Test Database)]
        end

        subgraph "API Cluster"
            API1[Laravel API 1]
            API2[Laravel API 2]
        end
    end

    LB --> TR1
    LB --> TR2
    LB --> TRN

    TR1 --> NFS
    TR2 --> NFS
    TRN --> NFS

    TR1 --> DB
    TR2 --> DB
    TRN --> DB

    TR1 --> API1
    TR2 --> API2
    TRN --> API1

    style NFS fill:#FFF8DC
    style DB fill:#FFD700
```

**Production-Like Considerations**:

1. **Shared Snapshots**: NFS or object storage for snapshot sharing
2. **Database Isolation**: Separate test database per runner (parallel execution)
3. **API Load Balancing**: Distribute API calls across instances
4. **Concurrency**: Multiple runners use unique snapshot directories
5. **Monitoring**: Centralized logging and metrics

---

## Performance Comparison

### Bootstrap Time Comparison

```mermaid
graph LR
    subgraph "DYNAMIC Mode"
        D1[Migrate Fresh<br/>3-5s]
        D2[Run Seeders<br/>25-55s]
        D3[Total: 30-60s]
    end

    subgraph "SNAPSHOT Mode"
        S1[Generate Hash<br/>0.1-1s]
        S2[Validate<br/>0.1s]
        S3[Restore SQL<br/>1-2s]
        S4[Total: 1-3s]
    end

    D1 --> D2 --> D3
    S1 --> S2 --> S3 --> S4

    style D3 fill:#FFA500
    style S4 fill:#90EE90
```

**Speedup**: 10-20x faster (30-60s → 1-3s)

---

## Related Documentation

- [Architecture Decision Record](./001-adr-test-data-management.md)
- [Technical Design](./technical-design.md)
- [Quick Start Guide](./quick-start-guide.md)
- [Operations Runbook](./runbook.md)
- [Implementation Checklist](./implementation-checklist.md)

---

**Last Updated**: 2026-01-22
**Maintained By**: QA Automation Team
