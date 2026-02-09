# Task: Energy module — aggregation + Space-level API
ID: FEATURE-ENERGY-AGGREGATION-API
Type: feature
Scope: backend
Size: medium
Parent: FEATURE-ENERGY-MODULE-MVP
Status: in-progress

## 1. Business goal

In order to display energy data at the space (home/zone) level on the panel UI
As a user viewing the smart panel dashboard
I want to see space-level energy totals, time-series charts, and a breakdown of top consumers

## 2. Context

- Task 1 (FEATURE-ENERGY-MODULE-MVP) introduced the `energy` backend module with:
  - Listening to cumulative kWh sources (consumption + production)
  - Computing per-interval deltas into fixed 5-minute buckets
  - Storing `EnergyDeltaEntity` denormalized with `roomId`
  - Minimal API: summary + deltas per room
- Devices have `roomId` FK to `SpaceEntity` (spaces module)
- Spaces can be rooms (type=ROOM) with optional parent zones
- This task extends the energy module with space-level aggregation via query-time SQL aggregation (Option A)

## 3. Scope

**In scope**

- Query-time aggregation from room -> space via SQL JOINs and GROUP BY
- Additional indexes on `EnergyDeltaEntity` for efficient queries
- Space summary endpoint (today/week/month totals)
- Space time-series endpoint with interval upsampling (5m -> 1h -> 1d)
- Space breakdown endpoint (top consumers by device)
- Range helper using Europe/Prague timezone for consistent boundaries
- Support for `home` as a virtual spaceId meaning "all spaces"
- Unit tests for aggregation, timeseries bucketing, breakdown, and range boundaries

**Out of scope**

- Costs/tariffs
- Per-device instantaneous power charts
- Anomaly detection
- Retention cleanup jobs
- Admin/panel UI changes
- Persisted aggregates (Option B) — using query-time aggregation only

## 4. Acceptance criteria

- [ ] Additional index on `(deviceId, intervalStart)` added to `EnergyDeltaEntity`
- [ ] Range helper computes today/week/month boundaries in Europe/Prague timezone
- [ ] `GET /api/v1/modules/energy/spaces/:spaceId/summary?range=today|week|month` returns `totalConsumptionKwh`, `totalProductionKwh`, `netKwh`, `lastUpdatedAt`
- [ ] `GET /api/v1/modules/energy/spaces/:spaceId/timeseries?range=today|week|month&interval=5m|1h|1d` returns time-series points with zero-filled gaps
- [ ] `GET /api/v1/modules/energy/spaces/:spaceId/breakdown?range=today&limit=10` returns top devices by consumption
- [ ] `spaceId=home` aggregates across all spaces
- [ ] Space summary aggregates deltas from all rooms belonging to the space
- [ ] Time-series correctly upsamples 5m buckets into 1h and 1d intervals
- [ ] Breakdown returns devices sorted by consumption descending with limit
- [ ] Unit tests cover space aggregation, timeseries bucketing, breakdown ordering, and range boundaries
- [ ] All endpoints follow API conventions (Swagger decorators, response models)

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Space summary for today

Given devices in rooms belonging to space "Living Zone"
When I request `GET /api/v1/modules/energy/spaces/{spaceId}/summary?range=today`
Then I receive total consumption/production/net for today in Europe/Prague timezone

### Scenario: Time-series with hourly interval

Given 5-minute delta buckets exist for the space's rooms
When I request `GET /api/v1/modules/energy/spaces/{spaceId}/timeseries?range=today&interval=1h`
Then I receive hourly aggregated points from midnight to now with zero-filled gaps

### Scenario: Breakdown top consumers

Given multiple devices with energy deltas in the space
When I request `GET /api/v1/modules/energy/spaces/{spaceId}/breakdown?range=today&limit=5`
Then I receive the top 5 devices sorted by consumption descending

## 6. Technical constraints

- Follow the existing energy module structure and patterns
- Use query-time aggregation (Option A) — no persisted aggregate entities
- Use TypeORM query builder for SQL queries
- Follow API conventions from `.ai-rules/API_CONVENTIONS.md`
- Do not modify generated code
- Tests are expected for new logic

## 7. Implementation hints

- Reuse existing `EnergyDataService` patterns for SQL queries
- Join `energy_module_deltas` with `devices_module_devices` and `spaces_module_spaces` tables for space mapping
- Use `strftime` for SQLite interval bucketing in time-series queries
- Range definitions:
  - today: midnight Europe/Prague to now
  - week: 7 days ago midnight Europe/Prague to now
  - month: 30 days ago midnight Europe/Prague to now
- `netKwh` = `totalConsumptionKwh - totalProductionKwh`

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
