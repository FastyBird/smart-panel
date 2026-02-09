# Task: Energy module MVP — ingest + delta computation foundations
ID: FEATURE-ENERGY-MODULE-MVP
Type: feature
Scope: backend
Size: medium
Parent: (none)
Status: in-progress

## 1. Business goal

In order to provide energy consumption and generation insights to users
As a smart panel backend
I want to ingest cumulative kWh property updates, compute per-interval delta energy, and expose a minimal read-only API for future UI consumption.

## 2. Context

- `electrical_power.power` is instantaneous W
- `electrical_energy.consumption` is cumulative kWh (with reset_behavior metadata)
- `electrical_energy.average_power` is interval_average W
- `electrical_generation.production` is cumulative kWh (PV)
- `electrical_generation.power` is instantaneous W
- Device → room assignment exists via `DeviceEntity.roomId` FK to `SpaceEntity`
- The backend already receives property value updates via WS / integrations and stores latest values (`PropertyValueService` uses an in-memory Map)
- Events are emitted via `EventEmitter2` with `EventType.CHANNEL_PROPERTY_VALUE_SET`

## 3. Scope

**In scope**

- New `energy` NestJS module under `apps/backend/src/modules/energy/`
- `EnergyDeltaEntity` — stores computed per-interval deltas (kWh)
- Ingestion service that subscribes to `CHANNEL_PROPERTY_VALUE_SET` for `electrical_energy` and `electrical_generation` channels
- Delta computation from cumulative kWh with reset handling
- Room mapping denormalization at processing time
- Minimal read-only API: summary and deltas endpoints
- Unit tests for delta computation edge cases

**Out of scope**

- Tariffs, cost calculation
- Space-level aggregation beyond room
- UI changes (admin/panel)
- Long-term retention policies
- Complex anomaly detection
- Power (W) time-series graphs

## 4. Acceptance criteria

- [ ] `EnergyDeltaEntity` created with fields: id, deviceId, roomId, sourceType, deltaKwh, intervalStart, intervalEnd, createdAt
- [ ] Ingestion service listens for `CHANNEL_PROPERTY_VALUE_SET` and filters for consumption/production properties
- [ ] Delta computation handles: monotonic increase, reset (value < prev), missing baseline
- [ ] 5-minute interval bucketing with accumulation for faster-arriving samples
- [ ] Room ID resolved from device at processing time; null if no room
- [ ] `GET /api/v1/modules/energy/summary` returns totalConsumptionKwh, totalProductionKwh, lastUpdatedAt
- [ ] `GET /api/v1/modules/energy/deltas` returns list of interval deltas with filtering by roomId and range
- [ ] Unit tests cover delta computation edge cases (monotonic, reset, unknown reset, missing prev, bucket accumulation)
- [ ] Module registered in AppModule

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Monotonic cumulative increase

Given a device property reports consumption = 100.5 kWh
And the previous reading was 100.0 kWh
When the delta is computed
Then deltaKwh = 0.5

### Scenario: Meter reset

Given a device property reports consumption = 2.0 kWh
And the previous reading was 500.0 kWh
When the delta is computed
Then the value is treated as a reset, deltaKwh = 2.0 (energy since reset)

### Scenario: First reading (no baseline)

Given a device property reports consumption = 100.0 kWh
And there is no previous reading
When the value is processed
Then it is stored as baseline only, no delta is produced

## 6. Technical constraints

- Follow the existing module structure in `apps/backend/src/modules/`
- Use EventEmitter2 `@OnEvent` for subscribing to property value changes
- Use TypeORM entities with SQLite-compatible column types
- Do not introduce new dependencies unless really needed
- Do not modify generated code
- Tests are expected for new logic

## 7. Implementation hints (optional)

- Look at `modules/stats/` for a minimal module pattern
- Reuse `DevicesModule` exports for device/channel property queries
- Subscribe to `EventType.CHANNEL_PROPERTY_VALUE_SET` from devices module
- Use `ChannelCategory.ELECTRICAL_ENERGY` and `ChannelCategory.ELECTRICAL_GENERATION` for filtering
- Use `PropertyCategory.CONSUMPTION` and `PropertyCategory.PRODUCTION` for property filtering

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
