# Architecture Decision Record: Test Data Management Strategy

**Status**: Accepted
**Date**: 2026-01-22
**Decision Makers**: Engineering Team, QA Automation
**Scope**: Playwright UI Test Framework (72 test files, 16,836 lines)

---

## Context and Problem Statement

The Verifast Playwright UI test framework currently executes against a Laravel API with shared test data created via database seeders. Each test run requires 30-60 seconds to create fresh data through migrations and seeders, resulting in:

- **Slow feedback loops**: Developers wait 30-60s before any test execution
- **CI/CD bottleneck**: Pipeline execution time significantly extended
- **Developer experience**: Poor local development experience
- **Resource waste**: Repeated execution of identical seeding operations

The test suite consists of:
- 72 test specification files
- 16,836 lines of test code
- Tests against Laravel API backend
- Complex data dependencies (organizations, users, roles, applications, workflows)

### Current State

```
Test Execution Time = Seeding Time (30-60s) + Test Execution (varies) + Teardown
```

**Seeding operations run on EVERY test execution**, even when:
- No data model changes occurred
- Running a single test file
- Debugging a specific test case
- CI/CD runs multiple times for same commit

### Core Requirements

1. **Reduce bootstrap time from 30-60s to <5s** for unchanged data models
2. **Maintain test isolation** - tests must not interfere with each other
3. **Ensure data consistency** - tests get predictable, known-good data
4. **Auto-invalidation** - detect when seeders/migrations change
5. **Developer-friendly** - simple to use, easy to debug
6. **CI/CD optimized** - fast, reliable, cacheable
7. **Zero test changes** - existing tests continue to work
8. **Capture proven-good data** - snapshot after successful test runs

---

## Decision Drivers

### Critical Success Factors

1. **Performance Impact**: Must achieve 6-20x speedup (30-60s → 1-5s)
2. **Reliability**: No test flakiness introduced
3. **Implementation Risk**: Low risk, incremental rollout
4. **Maintenance Burden**: Minimal ongoing maintenance
5. **Developer Experience**: Improved local and CI/CD workflows
6. **Backward Compatibility**: No breaking changes to existing tests
7. **Data Freshness**: Automatic detection of stale snapshots
8. **Failure Recovery**: Graceful fallback to dynamic seeding

### Nice-to-Have Features

- Snapshot versioning and management
- Snapshot metadata and audit trail
- Multiple snapshot variants (minimal, full, custom)
- Cross-environment snapshot portability
- Snapshot cleanup and retention policies

---

## Considered Options

### Summary Table

| Option | Description | Bootstrap Time | Complexity | Verdict |
|--------|-------------|----------------|------------|---------|
| **A** | Status Quo (Dynamic Only) | 30-60s | Low | ❌ Too Slow |
| **B** | Manual Snapshots | 1-3s | Low | ❌ Manual burden |
| **C** | Timestamp-Based Auto | 1-3s | Medium | ❌ False cache hits |
| **D** | Version-Pinned Snapshots | 1-3s | Medium | ❌ Manual versioning |
| **E** | Full Automation (Pre-Seeded) | 1-3s | High | ❌ Rigid, no flexibility |
| **F** | **On-Demand Snapshot with Feature Flags** | **1-5s** | **Medium** | ✅ **CHOSEN** |

### Option A: Status Quo (Dynamic Only)

**Description**: Continue running seeders on every test execution.

**Pros**:
- No implementation effort
- Always fresh data
- Simple to understand

**Cons**:
- 30-60s bootstrap time (unacceptable)
- No performance improvement
- Wasted CI/CD resources

**Verdict**: ❌ Does not solve the problem

---

### Option B: Manual Snapshot Management

**Description**: Developers manually create/restore snapshots via CLI commands.

**Pros**:
- Simple implementation
- Full developer control
- Low complexity

**Cons**:
- Manual burden on developers
- Human error (forgetting to update snapshots)
- No automatic invalidation
- Inconsistent usage across team

**Verdict**: ❌ High maintenance burden, error-prone

---

### Option C: Timestamp-Based Auto-Invalidation

**Description**: Auto-invalidate snapshots older than N hours/days.

**Pros**:
- Automatic management
- Simple logic

**Cons**:
- **False positives**: Valid snapshots invalidated unnecessarily
- **False negatives**: Stale snapshots used despite changes
- No correlation to actual data model changes
- Arbitrary time thresholds

**Verdict**: ❌ Unreliable invalidation logic

---

### Option D: Version-Pinned Snapshots

**Description**: Snapshots tied to manually managed version strings.

**Pros**:
- Explicit versioning
- Controlled updates

**Cons**:
- **Manual versioning required** in every seeder/migration change
- Easy to forget version updates
- No automatic detection
- Version conflicts in team environment

**Verdict**: ❌ High manual overhead, error-prone

---

### Option E: Full Automation (Pre-Seeded CI)

**Description**: CI creates and commits snapshots automatically on seeder changes.

**Pros**:
- Zero manual intervention
- Always up-to-date

**Cons**:
- **High complexity**: Git automation, merge conflicts
- **Rigid**: Forces all developers to use snapshots
- **Large binary files in git**: Snapshot files in version control
- **Merge conflicts**: Multiple branches updating snapshots
- No local flexibility

**Verdict**: ❌ Over-engineered, inflexible

---

### Option F: On-Demand Snapshot with Feature Flags ✅ CHOSEN

**Description**: Hybrid approach with three modes controlled by environment variables:

1. **DYNAMIC Mode**: Always run fresh seeders (30-60s)
2. **SNAPSHOT Mode**: Always restore from snapshot (1-3s)
3. **AUTO Mode** (default): Use snapshot if valid, else dynamic

**Snapshot Validity**:
- Hash-based invalidation (MD5 of seeders + migrations + factories)
- Age-based expiration (configurable, default 7 days)
- Metadata tracking (creation time, hash, version)

**Snapshot Creation**:
- **On-demand**: Capture after proven-passing test runs
- **Automatic**: Optional auto-capture on successful test suite completion
- **Manual**: CLI command for explicit snapshot creation

**Feature Flags**:
```bash
# Mode Selection
TEST_DATA_MODE=AUTO|DYNAMIC|SNAPSHOT  # Default: AUTO

# Snapshot Control
SNAPSHOT_VERSION=latest|v1|v2         # Default: latest
CAPTURE_SNAPSHOT=true|false           # Capture after dynamic seeding
CAPTURE_SNAPSHOT_ON_SUCCESS=true      # Capture after all tests pass

# Configuration
SNAPSHOT_MAX_AGE=7d                   # Max snapshot age before invalidation
SNAPSHOT_KEEP_COUNT=3                 # Number of snapshots to retain
```

**Pros**:
- **Flexible**: Developers choose mode per execution
- **Automatic**: Hash-based invalidation is reliable
- **Safe**: Fallback to dynamic on any snapshot issues
- **Fast**: 1-3s snapshot restore vs 30-60s seeding
- **Proven data**: Snapshots captured from passing test runs
- **No test changes**: Existing tests work unchanged
- **Debuggable**: Explicit modes for troubleshooting
- **CI-friendly**: Caching and performance optimized

**Cons**:
- Medium implementation complexity (3 new modules)
- Requires MySQL dump/restore utilities
- Snapshot files outside git (managed separately)
- Initial snapshot creation needed

**Verdict**: ✅ **CHOSEN** - Best balance of flexibility, automation, and reliability

---

## Decision Outcome

**Chosen Option**: **Option F - On-Demand Snapshot with Feature Flags**

### Rationale

1. **Performance**: Achieves 10-20x speedup (30-60s → 1-3s) for snapshot mode
2. **Reliability**: Hash-based invalidation prevents stale data issues
3. **Flexibility**: Three modes accommodate different workflows
4. **Safety**: Automatic fallback to dynamic mode on errors
5. **Developer Experience**: Simple environment variables, no code changes
6. **Proven Data**: Snapshots captured from successful test runs
7. **Implementation Risk**: Medium complexity, well-scoped, incremental
8. **Maintenance**: Low ongoing burden, self-managing

### Key Design Decisions

#### Hash-Based Invalidation
- Compute MD5 hash of all PHP files in:
  - `/database/seeders/**/*.php`
  - `/database/factories/**/*.php`
  - `/database/migrations/**/*.php`
- Snapshot filename includes hash: `snapshot-latest-a1b2c3d4e5f6.sql`
- Auto-invalidate when hash changes (file modifications detected)

#### Mode Selection Logic
```
AUTO mode:
  if valid_snapshot_exists():
    restore_snapshot()  # 1-3s
  else:
    run_dynamic_seeding()  # 30-60s
    optionally_capture_snapshot()

DYNAMIC mode:
  run_dynamic_seeding()  # Always fresh
  optionally_capture_snapshot()

SNAPSHOT mode:
  restore_snapshot()  # Fail if not available
```

#### Snapshot Metadata
Each snapshot has accompanying `.meta.json` file:
```json
{
  "createdAt": 1738000000000,
  "createdAtISO": "2026-01-22T12:00:00Z",
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

#### Snapshot Storage
- Location: `/tests/snapshots/` (gitignored)
- Naming: `snapshot-{version}-{hash}.sql`
- Retention: Keep last N snapshots (configurable, default: 3)
- Cleanup: Automatic removal of old snapshots

---

## Consequences

### Positive Consequences

#### Performance
- **10-20x faster bootstrap**: 30-60s → 1-3s in snapshot mode
- **CI/CD acceleration**: Faster pipeline execution
- **Developer productivity**: Rapid local test iterations
- **Cost savings**: Reduced CI/CD compute time

#### Reliability
- **Deterministic invalidation**: Hash-based detection of changes
- **Proven data**: Snapshots from passing tests
- **Automatic fallback**: No breaking changes if snapshot unavailable
- **Test stability**: Consistent, known-good data state

#### Developer Experience
- **Zero test changes**: Existing tests continue working
- **Simple configuration**: Environment variables only
- **Debug-friendly**: Explicit mode selection
- **Flexible workflows**: Choose mode per execution

#### Maintainability
- **Self-managing**: Automatic invalidation and cleanup
- **Low overhead**: No manual versioning required
- **Clear separation**: Test code unchanged, infrastructure isolated
- **Extensible**: Easy to add new modes or features

### Negative Consequences

#### Implementation Effort
- **Medium complexity**: 3 new modules (~800 lines of code)
- **Week 1-2 implementation**: SnapshotManager, TestDataBootstrap, EntityRegistry
- **Testing overhead**: Comprehensive test coverage needed
- **Documentation**: Multiple guides required

#### Operational Considerations
- **MySQL dependency**: Requires `mysqldump` and `mysql` CLI tools
- **Snapshot storage**: ~5-10MB per snapshot (manageable)
- **Initial setup**: First run creates snapshot (still 30-60s once)
- **Cross-platform**: Snapshot portability considerations (character sets, versions)

#### Edge Cases
- **Snapshot corruption**: Rare but requires fallback logic
- **Disk space**: Old snapshots need cleanup (automated)
- **Network shares**: Snapshot directory must be local for performance
- **Concurrency**: Parallel test runs need separate snapshot dirs

### Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Snapshot corruption | Medium | Automatic fallback to dynamic mode |
| Hash collision | Low | Use first 12 chars of MD5 (1 in trillion chance) |
| Disk space exhaustion | Low | Automatic cleanup, configurable retention |
| Cross-environment issues | Medium | Include MySQL version and charset in metadata |
| Developer confusion | Medium | Clear documentation, default AUTO mode |
| Initial adoption | Low | Zero breaking changes, gradual rollout |

### Rollback Plan

If issues arise:
1. **Immediate**: Set `TEST_DATA_MODE=DYNAMIC` (back to original behavior)
2. **Short-term**: No test code changes needed
3. **Long-term**: Remove snapshot infrastructure if abandoned

---

## Implementation Plan

### Week 1: Core Infrastructure
- Implement `SnapshotManager` class
- Hash generation and validation
- Snapshot create/restore operations
- Metadata management

### Week 2: Bootstrap Integration
- Implement `TestDataBootstrap` class
- Mode selection logic
- Global setup/teardown hooks
- Fallback handling

### Week 3: Entity Registry (Optional)
- Implement `EntityRegistry` class
- Name-to-UUID resolution
- Caching and initialization

### Week 4: Testing & Documentation
- Comprehensive test coverage
- Documentation (ADR, technical design, runbook, guides)
- Team training and rollout

### Week 5: Rollout
- Enable in development environment
- Monitor and gather metrics
- Enable in CI/CD
- Production-ready announcement

---

## Validation Metrics

### Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Bootstrap time (snapshot mode) | <5s | Measured in CI/CD logs |
| Bootstrap time (dynamic mode) | 30-60s | No regression from current |
| Hash false positives | 0% | Monitor invalidations vs. actual changes |
| Snapshot failures | <1% | Fallback to dynamic mode occurrences |
| Developer adoption | >80% | Survey, usage metrics |
| CI/CD time reduction | >40% | Compare before/after pipeline times |
| Test stability | No regression | Flaky test rate unchanged |

### Monitoring

- Log bootstrap mode and duration on every run
- Track snapshot creation/invalidation events
- Monitor fallback occurrences
- Collect developer feedback

---

## Related Documentation

- [Technical Design](./technical-design.md) - Detailed architecture and implementation
- [Quick Start Guide](./quick-start-guide.md) - Getting started in 5 minutes
- [Architecture Diagrams](./architecture-diagrams.md) - Visual system design
- [Runbook](./runbook.md) - Operations and troubleshooting
- [Implementation Checklist](./implementation-checklist.md) - Task breakdown

---

## References

- Original problem analysis: `test-data-management-review.md`
- Option comparison: `option-comparison-risk-assessment.md`
- Proof of concept: `proof-of-concept-example.md`
- Playwright documentation: https://playwright.dev/docs/test-global-setup-teardown
- Laravel seeding: https://laravel.com/docs/seeding

---

## Approval

- **Proposed by**: QA Automation Team
- **Reviewed by**: Engineering Team, DevOps
- **Approved by**: Technical Lead
- **Date**: 2026-01-22
- **Status**: ✅ Approved for Implementation
