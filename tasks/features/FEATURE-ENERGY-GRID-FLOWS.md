# Task: Energy — Grid Import/Export Flows + Net Calculations
ID: FEATURE-ENERGY-GRID-FLOWS
Type: feature
Scope: backend, admin, panel
Size: medium
Parent: FEATURE-ENERGY-MODULE-MVP
Status: in-progress

## 1. Business goal

In order to track real-world energy setups with main meters and PV inverters
As a homeowner with a grid-tied solar system
I want to see energy imported from and exported to the grid, plus net calculations

## 2. Context

- `electrical_energy.consumption` already tracks cumulative kWh (import/consumed energy)
- `electrical_generation.production` already tracks cumulative kWh (PV production)
- Backend computes delta buckets and exposes summary/timeseries/breakdown at space scope
- Panel shows Energy screen + header widget with consumption + optional production
- The energy module follows a pattern: YAML spec → PropertyCategory enum → SOURCE_TYPE_MAP → delta computation → data service → API models

### Semantic definitions

- **grid_import**: Cumulative energy imported from the public grid into the home (kWh). This is what the main meter measures as "consumed from grid".
- **grid_export**: Cumulative energy exported from the home into the public grid (kWh). This is excess PV production fed back to the grid.
- **net_grid_kwh**: `grid_import - grid_export`. Positive = net import from grid. Zero if no grid metrics exist.

## 3. Scope

**In scope**

- Add `grid_import` and `grid_export` optional properties to `electrical_energy` channel spec (Option 1)
- Add `GRID_IMPORT` and `GRID_EXPORT` to `PropertyCategory` enum
- Add `GRID_IMPORT` and `GRID_EXPORT` to `EnergySourceType` enum
- Extend ingestion listener SOURCE_TYPE_MAP for new properties
- Delta computation works unchanged (generic over source types)
- Extend API DTOs: summary includes grid totals + net_grid_kwh + has_grid_metrics flag
- Extend timeseries DTOs: optional grid_import/export deltas per bucket
- Add backend tests for new flows
- Regenerate spec files
- Panel/Admin: surface grid data in existing UI if changes are minimal

**Out of scope**

- Tariffs/cost calculations
- Real-time power flow arrows UI
- Storage modeling (home batteries)
- Complex energy balance beyond documented net definitions
- New dedicated grid channel type (using Option 1: properties on electrical_energy)

## 4. Acceptance criteria

- [ ] `electrical_energy` channel in channels.yaml has optional `grid_import` and `grid_export` properties
- [ ] `PropertyCategory` enum has `GRID_IMPORT` and `GRID_EXPORT` entries
- [ ] `EnergySourceType` enum has `GRID_IMPORT` and `GRID_EXPORT` entries
- [ ] Ingestion listener maps `electrical_energy.grid_import` → `EnergySourceType.GRID_IMPORT`
- [ ] Ingestion listener maps `electrical_energy.grid_export` → `EnergySourceType.GRID_EXPORT`
- [ ] Space summary API returns `totalGridImportKwh`, `totalGridExportKwh`, `netGridKwh`, `hasGridMetrics`
- [ ] Timeseries API returns `gridImportDeltaKwh`, `gridExportDeltaKwh` per point
- [ ] Whole-home summary API returns grid totals
- [ ] When no grid metrics exist, values are 0 and `hasGridMetrics` is false
- [ ] Existing fields unchanged (backwards compatible)
- [ ] Unit tests cover delta computation for grid sources
- [ ] Unit tests cover API aggregation with/without grid metrics
- [ ] Spec files regenerated

## 5. Example scenarios

### Scenario: Device reports grid import reading

Given a device with an `electrical_energy` channel
And the channel has a `grid_import` property with value 150.5 kWh
When the property value is updated to 151.2 kWh
Then a delta of 0.7 kWh is stored with sourceType `grid_import`
And the space summary includes `totalGridImportKwh` reflecting this delta

### Scenario: No grid metrics available

Given no devices report `grid_import` or `grid_export` properties
When the space summary API is called
Then `totalGridImportKwh` = 0, `totalGridExportKwh` = 0, `netGridKwh` = 0
And `hasGridMetrics` = false

### Scenario: Net grid calculation

Given grid_import total = 10.0 kWh and grid_export total = 3.5 kWh
When the space summary is computed
Then `netGridKwh` = 6.5 (positive = net import from grid)

## 6. Technical constraints

- Follow the existing energy module structure in `apps/backend/src/modules/energy/`
- Reuse existing delta storage entity (just add new sourceType values)
- Do not modify generated code (spec files are regenerated)
- Keep API changes additive (new optional fields only)
- Tests are expected for new logic

## 7. Implementation hints

- Add properties to `electrical_energy` in `spec/devices/channels.yaml` matching existing patterns
- Add enum entries to `devices.constants.ts` and `energy.constants.ts`
- Extend `SOURCE_TYPE_MAP` in `energy-ingestion.listener.ts`
- The `DeltaComputationService` is already generic over `EnergySourceType` — no changes needed
- Extend `EnergyDataService` query methods to aggregate new source types
- Add new fields to response models with Swagger decorators
- Update controllers to map new fields
- Run `pnpm run generate:spec` after YAML changes

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
