# Task: Energy — Home-level summary + caching layer
ID: FEATURE-ENERGY-HOME-SUMMARY-CACHING
Type: feature
Scope: backend
Size: medium
Parent: (none)
Status: in-progress

## 1. Business goal

In order to provide a fast, stable overview experience on the panel
As a smart home user
I want a home-level energy aggregate API with short-lived caching to reduce backend load and improve responsiveness.

## 2. Context

- Energy Phase 1 is complete and merged: spec normalized, PV + grid import/export supported, backend computes delta buckets, space aggregation endpoints exist, panel UI has Energy screen + header widget, retention/cleanup/observability are implemented.
- Current limitation: most energy APIs are space-scoped. For a panel "overview" experience we need a fast, stable home-level aggregate without N calls per space and heavy query-time aggregation each time.
- Existing space endpoints already support `spaceId="home"` for whole-home aggregation. This task adds dedicated `/energy/home/*` endpoints with caching.
- Reference: `apps/backend/src/modules/energy/` — controllers, services, models, entities.
- Cache pattern reference: `apps/backend/src/modules/extensions/services/extensions-discovery-cache.ts` (simple in-memory TTL).

## 3. Scope

**In scope**

- New `GET /api/energy/home/summary?range=today|week|month` endpoint
- New `GET /api/energy/home/timeseries?range=today|week|month&interval=5m|1h|1d` endpoint
- New `GET /api/energy/home/breakdown?range=today&limit=10` endpoint (if trivial)
- In-memory TTL-based caching layer for home and space summary/timeseries
- Configurable TTL (default 30s) via energy module config
- `lastUpdatedAt` defined as latest `intervalEnd` among included deltas
- Tests for home aggregation, caching behavior, lastUpdatedAt correctness

**Out of scope**

- Tariffs/cost calculations
- Panel/Admin UI updates
- Complex invalidation / reprocessing
- Export/CSV

## 4. Acceptance criteria

- [ ] `GET /energy/home/summary?range=today|week|month` returns aggregated consumption, production, grid import/export, net values, `lastUpdatedAt`, and capability flags
- [ ] `GET /energy/home/timeseries?range=today|week|month&interval=5m|1h|1d` returns zero-filled time-series points
- [ ] `GET /energy/home/breakdown?range=today&limit=10` returns top consuming devices
- [ ] Home endpoints include unassigned devices (devices with null roomId) in totals
- [ ] In-memory cache with configurable TTL (default 30s) is applied to home summary/timeseries
- [ ] Cache is applied to space summary/timeseries endpoints as well
- [ ] Second call within TTL returns cached result without hitting the database
- [ ] Cache expires after TTL and subsequent call fetches fresh data
- [ ] `lastUpdatedAt` is the latest `intervalEnd` among included deltas (null if no data)
- [ ] Tests cover home aggregation across multiple spaces/rooms
- [ ] Tests cover caching behavior (cache hit, cache expiry)

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Home summary aggregates all spaces
Given devices in Kitchen (3.0 kWh) and Bedroom (4.0 kWh) for today
When I call `GET /energy/home/summary?range=today`
Then totalConsumptionKwh = 7.0

### Scenario: Cached response on second call
Given I call `GET /energy/home/summary?range=today` and get a result
When I call the same endpoint within 30 seconds
Then the response is identical and no DB query is executed

### Scenario: Cache expires after TTL
Given I call `GET /energy/home/summary?range=today` and get a result
When 31 seconds pass and I call the same endpoint again
Then a fresh DB query is executed and a new result is returned

## 6. Technical constraints

- Follow the existing module / service structure in `apps/backend/src/modules/energy/`.
- Do not introduce new dependencies unless really needed.
- Do not modify generated code.
- Tests are expected for new logic.
- Use the same in-memory cache pattern as `extensions-discovery-cache.ts` (Map with expiry).
- Reuse existing `EnergyDataService` methods (`getSpaceSummary`, `getSpaceTimeseries`, `getSpaceBreakdown`).
- Reuse existing response models (`EnergySpaceSummaryResponseModel`, `EnergySpaceTimeseriesResponseModel`, `EnergySpaceBreakdownResponseModel`).

## 7. Implementation hints (optional)

- Look at `energy-spaces.controller.ts` for endpoint patterns.
- Reuse `resolveEnergyRange()` for range resolution.
- Implement `EnergyCacheService` as an injectable NestJS service with a `Map<string, { value: unknown; expiresAt: number }>`.
- Add `DEFAULT_CACHE_TTL_SECONDS = 30` to `energy.constants.ts`.
- Add `cacheTtlSeconds` to `EnergyConfigModel` and `UpdateEnergyConfigDto`.
- Wire cache into both new home controller and existing spaces controller.
- `lastUpdatedAt` should use `MAX(intervalEnd)` instead of `MAX(createdAt)` for consistency with the task definition.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
