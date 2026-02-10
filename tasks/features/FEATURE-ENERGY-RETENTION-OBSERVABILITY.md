# Task: Energy module hardening — retention, cleanup, and observability
ID: FEATURE-ENERGY-RETENTION-OBSERVABILITY
Type: feature
Scope: backend
Size: medium
Parent: FEATURE-ENERGY-MODULE-MVP
Status: review

## 1. Business goal

In order to prevent unbounded growth of energy delta records and ensure stable long-term operation
As a system administrator
I want configurable retention, automated cleanup, and observability for the energy module

## 2. Context

- Energy Phase 1 is implemented end-to-end: spec normalized, backend computes and stores per-interval deltas (`EnergyDeltaEntity`), backend exposes space-level summary/timeseries/breakdown endpoints, Panel + Admin are wired.
- The energy delta table (`energy_module_deltas`) will grow continuously as devices report readings every few seconds, producing 5-minute bucketed delta records.
- Without retention/cleanup, this table will grow unbounded and degrade query performance over time.
- Existing modules: `apps/backend/src/modules/energy/` (entities, services, controllers, listeners, helpers).
- Existing config pattern: `ModuleConfigModel` / `UpdateModuleConfigDto` / `ModulesTypeMapperService`.
- Existing cron pattern: `@Cron()` from `@nestjs/schedule` (see `StatsAggregatorService`).

## 3. Scope

**In scope**

- Configurable retention window via module config (`retention_days`, default 90)
- Scheduled nightly cleanup job that deletes old `EnergyDeltaEntity` rows in batches
- Structured observability logging and in-memory counters for ingestion throughput and anomalies
- DB index on `intervalEnd` column for efficient cleanup queries
- Unit tests for cleanup logic

**Out of scope**

- Tariffs/cost calculations
- UI changes (panel or admin)
- Complex anomaly detection algorithms
- Daily rollup aggregates (deferred — adds too much complexity for this phase)
- Prometheus/external metrics integration (use in-memory counters + structured logs)

## 4. Acceptance criteria

- [x] Energy module config model (`EnergyConfigModel`) with `retention_days` (default 90) and `enabled` fields, registered via `ModulesTypeMapperService`
- [x] Update DTO (`UpdateEnergyConfigDto`) for energy module config
- [x] Scheduled cleanup service (`EnergyCleanupService`) with `@Cron('0 2 * * *')` (nightly at 02:00)
- [x] Cleanup deletes only rows where `intervalEnd < cutoff` (cutoff = now minus retention_days)
- [x] Cleanup runs in batches (e.g., 1000 rows per DELETE) to avoid DB locks
- [x] Cleanup logs summary: number of rows deleted, time taken
- [x] DB index added on `intervalEnd` column for efficient cleanup queries
- [x] Observability counters in ingestion listener: samples processed, deltas created, anomalies (negative delta, out-of-order)
- [x] Structured log events for: first sample (debug), negative delta/meter reset (warn), out-of-order timestamp (warn)
- [x] Unit tests for cleanup cutoff calculation, batch deletion, and retention filtering
- [x] All existing tests still pass

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Nightly cleanup removes old deltas

Given the energy retention is configured to 90 days
And there are delta records from 100 days ago and 10 days ago
When the nightly cleanup job runs
Then only the records older than 90 days are deleted
And a log entry reports the number of deleted rows and elapsed time

### Scenario: Meter reset is logged

Given a device has a cumulative reading baseline of 500 kWh
When a new reading of 10 kWh arrives (lower than previous)
Then a warning log is emitted with reset_behavior context
And the delta is computed using the new value as energy since reset

### Scenario: Ingestion counter tracks throughput

Given the energy ingestion listener is processing property value events
When 100 samples are processed in a minute
Then the in-memory counter reflects 100 samples processed
And the deltas_created counter reflects the number of non-null deltas

## 6. Technical constraints

- Follow the existing module/service structure in `apps/backend/src/modules/energy/`.
- Use existing `ModuleConfigModel` / `UpdateModuleConfigDto` / `ModulesTypeMapperService` pattern for config.
- Use `@Cron()` from `@nestjs/schedule` for scheduling (already registered in `AppModule`).
- Do not introduce new dependencies unless really needed.
- Do not modify generated code.
- Tests are expected for new logic.
- Use SQLite-compatible queries (project uses SQLite).
- Cleanup must be idempotent and safe for concurrent runs.

## 7. Implementation hints (optional)

- Look at `WeatherConfigModel` and `StatsAggregatorService` as patterns for config and cron.
- Reuse `createExtensionLogger()` for structured logging.
- Add index via TypeORM `@Index()` decorator on the entity.
- For batch deletion, use raw SQL `DELETE FROM ... WHERE rowid IN (SELECT rowid FROM ... WHERE intervalEnd < ? LIMIT ?)`.
- Keep counters as simple class properties — no need for external metrics library.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
