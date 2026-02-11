# Task: Finalize and Harden Grid Import/Export Flows for Merge
ID: FEATURE-ENERGY-GRID-FLOWS-HARDENING
Type: technical
Scope: backend, admin, panel
Size: medium
Parent: FEATURE-ENERGY-GRID-FLOWS
Status: in-progress

## 1. Business goal

In order to safely merge the grid import/export feature into main
As a maintainer
I want a final hardening pass that ensures backward compatibility, correct edge-case handling, tests, and documentation

## 2. Context

- Tasks 1–5 (energy MVP, aggregation API, retention/observability, panel screen, domain page) are completed.
- Task 6 (FEATURE-ENERGY-GRID-FLOWS) is implemented and open as PR #305.
- The grid flows feature adds `grid_import` and `grid_export` source types to the energy module.
- This hardening task ensures the PR is merge-safe without adding new features.

Key files:
- `apps/backend/src/modules/energy/energy.constants.ts` — `EnergySourceType` enum
- `apps/backend/src/modules/energy/services/delta-computation.service.ts` — delta logic
- `apps/backend/src/modules/energy/services/energy-data.service.ts` — queries
- `apps/backend/src/modules/energy/listeners/energy-ingestion.listener.ts` — ingestion
- `apps/backend/src/modules/energy/models/` — API response models
- `apps/panel/lib/modules/energy/models/energy_summary.dart` — panel model
- `apps/panel/lib/modules/energy/services/energy_service.dart` — panel service

## 3. Scope

**In scope**

- Backward compatibility audit: new DTO fields are optional and non-breaking
- Spec/validators: YAML additions are additive with correct metadata
- Backend edge cases: delta computation for grid sources, structured logging
- Database: entity indexes for new source types
- API contract: stable response shapes, consistent null/0 strategy
- Panel/Admin: safe handling of missing grid fields
- Additional unit tests for grid flows
- Updated PR description

**Out of scope**

- New features beyond Task 6 scope
- New UI components for grid data visualization
- Tariffs, storage modeling, or energy balance beyond net calculations

## 4. Acceptance criteria

- [x] All new DTO fields are optional with defaults — older clients unaffected
- [x] Panel models treat grid fields as optional with safe defaults (0 / false)
- [x] No existing spec categories renamed or removed
- [x] YAML spec properties for grid flows have correct units (kWh) and semantics metadata
- [x] Delta computation handles edge cases: missing baseline, reset, out-of-order for grid sources
- [x] Structured logs include device/property IDs, sourceType, timestamps on anomalies
- [x] Entity indexes cover new source type query patterns
- [x] API summary returns consistent shape (grid fields present with 0 + hasGridMetrics=false when absent)
- [x] Timeseries returns grid deltas as optional fields
- [x] Unit tests cover grid delta computation
- [x] Unit tests cover space aggregation with/without grid metrics
- [x] Lint and existing tests pass

## 5. Example scenarios

### Scenario: Older panel build receives new grid fields

Given a panel build from before Task 6
When it receives a summary response with `totalGridImportKwh` field
Then it ignores the unknown field without errors
And existing consumption/production data renders normally

### Scenario: New panel build, backend without grid data

Given a panel build with grid support
When the backend returns a summary with no grid metrics
Then `hasGridMetrics` is false (or absent)
And grid-related UI elements are hidden
And consumption/production display normally

### Scenario: Grid meter reset

Given a device reporting `grid_import` with cumulative value 500.0 kWh
When the next reading is 10.0 kWh (meter reset)
Then the system detects the reset
And logs a structured warning with device ID, source type, old and new values
And stores a delta of 10.0 kWh (reset behavior)

## 6. Technical constraints

- Follow the existing energy module structure
- Do not modify generated code (spec files are regenerated)
- Keep changes strictly to hardening — no new features
- Tests are required for new edge-case handling
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`

## 7. Implementation hints

- Check `DeltaComputationService` for grid-specific edge cases
- Review `EnergyIngestionListener` SOURCE_TYPE_MAP completeness
- Verify Swagger decorators on response models have `required: false` for grid fields
- Check panel `EnergySummary.fromJson()` for safe null handling
- Run `pnpm run test:unit` and `pnpm run lint:js` to verify no regressions

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by auditing the existing code against the checklist.
- For each acceptance criterion, either implement a fix or confirm it's already satisfied.
- Keep changes minimal and focused on hardening.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
