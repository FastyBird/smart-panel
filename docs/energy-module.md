# Energy Module

This document describes the energy module implementation for the Smart Panel, including data ingestion, delta computation, aggregation APIs, caching, retention, and panel UI.

## Overview

The energy module tracks electricity consumption and production across the smart home. It converts cumulative kWh meter readings into per-interval deltas, stores them in a time-series-friendly schema, and exposes aggregation APIs for summary, time-series, and per-device breakdown views.

Key capabilities:

- **Consumption tracking** from smart plugs, energy meters, and similar devices
- **Production tracking** from solar inverters and generation devices
- **Grid flow tracking** for grid-tied systems (import/export)
- **Space and whole-home aggregation** with query-time rollups
- **Configurable data retention** with nightly cleanup
- **In-memory caching** for frequently accessed endpoints
- **Panel UI** with standalone energy screen, space domain page, and header widget

## Architecture

```
Device Property Events
        │
        ▼
┌──────────────────────────┐
│  Energy Ingestion        │  Listens to CHANNEL_PROPERTY_VALUE_SET events
│  Listener                │  Filters for energy-related properties
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  Delta Computation       │  Converts cumulative kWh → per-interval deltas
│  Service                 │  Handles meter resets, first samples, baselines
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  Energy Data Service     │  Persists deltas (upsert), runs SQL aggregations
│  (SQLite)                │  Summary, timeseries, breakdown queries
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  Cache Service           │  In-memory TTL cache for space/home endpoints
└──────────────────────────┘
             │
             ▼
┌──────────────────────────┐
│  REST API Controllers    │  /energy/summary, /energy/spaces/:id/*, /energy/home/*
└──────────────────────────┘
             │
             ▼
┌──────────────────────────┐
│  Panel / Admin UI        │  Energy screen, domain page, header widget
└──────────────────────────┘
```

## Energy Source Types

The module tracks four distinct energy source types:

| Source Type | Description | Channel Category | Property Category |
|---|---|---|---|
| `consumption_import` | Electricity consumed by devices | `ELECTRICAL_ENERGY` | `CONSUMPTION` |
| `generation_production` | Electricity produced (e.g., solar) | `ELECTRICAL_GENERATION` | `PRODUCTION` |
| `grid_import` | Electricity imported from the grid | `ELECTRICAL_ENERGY` | `GRID_IMPORT` |
| `grid_export` | Electricity exported to the grid | `ELECTRICAL_ENERGY` | `GRID_EXPORT` |

Grid metrics (`grid_import` and `grid_export`) are optional. The API indicates their availability via the `has_grid_metrics` flag.

## Data Ingestion

### Event-Driven Pipeline

The `EnergyIngestionListener` subscribes to `DevicesEventType.CHANNEL_PROPERTY_VALUE_SET` events. When a property value is set:

1. **Filter** -- Check if the property category is one of: `CONSUMPTION`, `PRODUCTION`, `GRID_IMPORT`, `GRID_EXPORT`
2. **Extract value** -- Parse the numeric kWh value from the property
3. **Resolve channel** -- Load the channel entity to determine the channel category and parent device
4. **Map source type** -- Match `(channelCategory, propertyCategory)` to an `EnergySourceType`
5. **Compute delta** -- Pass the cumulative reading to `DeltaComputationService`
6. **Persist** -- Save the computed delta via `EnergyDataService.saveDelta()`

### Delta Computation

The `DeltaComputationService` maintains in-memory baselines keyed by `${deviceId}:${sourceType}`. For each incoming cumulative reading:

| Scenario | Behavior |
|---|---|
| **First sample** | Store as baseline, produce no delta |
| **Normal increase** (new >= prev) | `delta = new - prev` |
| **Meter reset** (new < prev) | `delta = new` (energy since reset), log warning |
| **Zero delta** | Skip (no energy consumed) |
| **Out-of-order timestamp** | Log warning, process anyway |

### 5-Minute Bucketing

All deltas are bucketed into fixed 5-minute intervals aligned to clock boundaries. Multiple readings within the same bucket are accumulated via SQLite upsert (`deltaKwh = deltaKwh + :newDelta`).

## Database Schema

### `energy_module_deltas` Table

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Record identifier |
| `device_id` | UUID (FK) | Device that produced the reading |
| `room_id` | UUID (nullable) | Room the device belongs to (denormalized) |
| `source_type` | enum | One of: `consumption_import`, `generation_production`, `grid_import`, `grid_export` |
| `delta_kwh` | float | Energy delta for this interval in kWh |
| `interval_start` | datetime | Start of the 5-minute bucket |
| `interval_end` | datetime | End of the 5-minute bucket |
| `created_at` | datetime | Record creation timestamp |

### Indexes

| Index | Columns | Purpose |
|---|---|---|
| `UQ_energy_deltas_device_source_interval` | `deviceId, sourceType, intervalStart` | Prevent duplicate deltas, enable upsert |
| `IDX_energy_deltas_room_interval` | `roomId, sourceType, intervalStart` | Fast room/space queries |
| `IDX_energy_deltas_device_interval` | `deviceId, intervalStart` | Fast device queries |
| `IDX_energy_deltas_interval_end` | `intervalEnd` | Cleanup job (retention) |

## API Endpoints

All time ranges use **Europe/Prague timezone** for date boundaries (midnight calculations).

### Basic Endpoints

#### GET /energy/summary

Returns total consumption and production for the requested time range.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `room_id` | UUID | No | Filter by room |
| `range` | string | No | `today` (default), `yesterday`, `week`, `month` |

Response (`EnergySummaryResponseModel`):

```json
{
  "data": {
    "total_consumption_kwh": 12.5,
    "total_production_kwh": 3.2,
    "total_grid_import_kwh": 9.5,
    "total_grid_export_kwh": 0.2,
    "has_grid_metrics": true,
    "last_updated_at": "2026-02-11T14:30:00Z"
  }
}
```

#### GET /energy/deltas

Returns per-interval energy deltas for the requested time range.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `room_id` | UUID | No | Filter by room |
| `range` | string | No | `today` (default), `yesterday`, `week`, `month` |

Response (`EnergyDeltasResponseModel`):

```json
{
  "data": [
    {
      "interval_start": "2026-02-11T12:00:00Z",
      "interval_end": "2026-02-11T12:05:00Z",
      "consumption_delta_kwh": 0.125,
      "production_delta_kwh": 0.05,
      "grid_import_delta_kwh": 0.08,
      "grid_export_delta_kwh": 0.0
    }
  ]
}
```

### Space Endpoints

#### GET /energy/spaces/:spaceId/summary

Returns aggregated consumption, production, and net energy for a space. Use `spaceId = "home"` for whole-home totals.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `spaceId` | UUID or `"home"` | Yes | Space identifier |
| `range` | string | No | `today` (default), `yesterday`, `week`, `month` |

Response includes `net_kwh` (consumption - production) and `net_grid_kwh` (grid import - grid export).

#### GET /energy/spaces/:spaceId/timeseries

Returns time-series data points aggregated into the requested interval.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `spaceId` | UUID or `"home"` | Yes | Space identifier |
| `range` | string | No | `today` (default), `yesterday`, `week`, `month` |
| `interval` | string | No | `5m`, `1h` (default), `1d` |

Missing intervals are **zero-filled** for UI friendliness.

#### GET /energy/spaces/:spaceId/breakdown

Returns top energy-consuming devices within a space, sorted by consumption descending.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `spaceId` | UUID or `"home"` | Yes | Space identifier |
| `range` | string | No | `today` (default), `yesterday`, `week`, `month` |
| `limit` | number | No | Max devices to return (default 10, max 100) |

Response includes `device_id`, `device_name`, `room_id`, `room_name`, and `consumption_kwh` for each device.

### Home Endpoints

Convenience endpoints that wrap the space endpoints with `spaceId = "home"`. All responses are cached.

| Endpoint | Description |
|---|---|
| `GET /energy/home/summary` | Whole-home summary |
| `GET /energy/home/timeseries` | Whole-home time-series |
| `GET /energy/home/breakdown` | Top consumers across all spaces |

These accept the same `range`, `interval`, and `limit` query parameters as the space endpoints.

## Caching

The `EnergyCacheService` provides in-memory TTL-based caching for space and home endpoints.

| Setting | Default | Range | Description |
|---|---|---|---|
| `cache_ttl_seconds` | 30 | 0--3600 | TTL for cached results. 0 disables caching. |

Cache keys follow the pattern `space:{spaceId}:{endpoint}:{range}:{interval}`. The cache is a simple `Map<string, CacheEntry>` with expiration timestamps.

## Data Retention

The `EnergyCleanupService` runs a nightly cron job at **02:00** to delete old delta records.

| Setting | Default | Range | Description |
|---|---|---|---|
| `retention_days` | 90 | 1--3650 | Days to retain delta records |

Cleanup operates in batches of 1000 rows to avoid long-running transactions. It uses SQLite's `rowid` for accurate batch deletion.

## Configuration

The energy module is configured via the module config system:

```json
{
  "type": "energy-module",
  "retention_days": 90,
  "cache_ttl_seconds": 30
}
```

Update via the standard module config endpoint (`UpdateEnergyConfigDto`).

## Observability

The `EnergyMetricsService` tracks in-memory counters:

| Metric | Description |
|---|---|
| `samplesProcessed` | Total property value events processed |
| `deltasCreated` | Deltas successfully computed and persisted |
| `negativeDeltaCount` | Meter resets detected (new < prev) |
| `outOfOrderCount` | Out-of-order timestamp events |
| `firstSampleCount` | First-sample baseline events (no delta produced) |

These counters are available via `getSnapshot()` for diagnostics.

## Panel App

### Energy Screen

The `EnergyScreen` (`apps/panel/lib/modules/energy/presentation/energy_screen.dart`) is a standalone screen for whole-installation energy overview. It mirrors the pattern of the security screen and is registered as a deck item.

**Features:**
- Uses `spaceId = "home"` for whole-installation data
- Range selector: Today, Week, Month
- Summary cards: Consumption, Production (conditional), Net (conditional)
- Bar chart (fl_chart) with consumption and production bars
- Top consumers list (up to 10 devices with progress bars)
- Responsive layout: portrait (vertical) and landscape (2-column)
- Loading, error, and empty states
- Supports embedded mode (hides navigation buttons when used inside deck)

### Energy Domain Page

The `EnergyDomainView` (`apps/panel/lib/modules/deck/presentation/domain_pages/energy_domain_view.dart`) provides a space-level energy page embedded in the deck navigation. Same UI components as the standalone screen but scoped to a specific space.

### Energy Header Widget

The `EnergyHeaderWidget` (`apps/panel/lib/modules/energy/widgets/energy_header_widget.dart`) is a compact badge shown in the space header area.

- Displays today's consumption (e.g., "12.5 kWh")
- Shows production alongside consumption when available
- Displays em dash on error or when data is unavailable
- Hidden when energy is not supported for the space

### State Management

The `EnergyRepository` (`apps/panel/lib/modules/energy/repositories/energy_repository.dart`) manages all energy state via `ChangeNotifier`:

- **Support detection** -- Probes the summary endpoint; caches the result. Hides energy UI on 404/501.
- **Data states** -- `initial`, `loading`, `loaded`, `error`
- **Stale response guard** -- Discards results if the selected range changed during the fetch
- **Parallel fetching** -- Summary, timeseries, and breakdown are fetched concurrently via `Future.wait`

### Energy Service

The `EnergyService` (`apps/panel/lib/modules/energy/services/energy_service.dart`) wraps Dio HTTP calls to the backend energy endpoints. Supports three range values:

| Range | Default Interval |
|---|---|
| `today` | `1h` |
| `week` | `1h` |
| `month` | `1d` |

## File Structure

### Backend

```
apps/backend/src/modules/energy/
├── energy.module.ts                          # NestJS module registration
├── energy.constants.ts                       # Constants, intervals, EnergySourceType enum
├── energy.openapi.ts                         # Swagger model registry
├── controllers/
│   ├── energy.controller.ts                  # GET /energy/{summary,deltas}
│   ├── energy-spaces.controller.ts           # GET /energy/spaces/:spaceId/{summary,timeseries,breakdown}
│   └── energy-home.controller.ts             # GET /energy/home/{summary,timeseries,breakdown}
├── services/
│   ├── energy-data.service.ts                # SQL queries, upsert, aggregation
│   ├── energy-cache.service.ts               # In-memory TTL cache
│   ├── delta-computation.service.ts          # Cumulative → delta conversion
│   ├── energy-metrics.service.ts             # Observability counters
│   └── energy-cleanup.service.ts             # Nightly retention cleanup
├── listeners/
│   └── energy-ingestion.listener.ts          # Event subscriber for property values
├── entities/
│   └── energy-delta.entity.ts                # energy_module_deltas table
├── dto/
│   └── update-config.dto.ts                  # Module config update DTO
├── models/
│   ├── config.model.ts                       # EnergyConfigModel
│   ├── energy-summary.model.ts               # EnergySummaryModel
│   ├── energy-space-summary.model.ts         # EnergySpaceSummaryModel (with net)
│   ├── energy-delta.model.ts                 # EnergyDeltaItemModel
│   ├── energy-timeseries-point.model.ts      # EnergyTimeseriesPointModel
│   ├── energy-breakdown-item.model.ts        # EnergyBreakdownItemModel
│   ├── energy-response.model.ts              # Summary/deltas response wrappers
│   ├── energy-space-response.model.ts        # Space response wrappers
│   └── energy-home-response.model.ts         # Home response wrappers
└── helpers/
    └── energy-range.helper.ts                # Range resolution, timezone handling
```

### Panel

```
apps/panel/lib/modules/energy/
├── module.dart                               # EnergyModuleService lifecycle
├── export.dart                               # Public API barrel export
├── services/
│   └── energy_service.dart                   # HTTP client (Dio), EnergyRange enum
├── repositories/
│   └── energy_repository.dart                # State management (ChangeNotifier)
├── models/
│   ├── energy_summary.dart                   # EnergySummary model
│   ├── energy_timeseries.dart                # EnergyTimeseries, EnergyTimeseriesPoint
│   └── energy_breakdown.dart                 # EnergyBreakdown, EnergyBreakdownDevice
├── presentation/
│   └── energy_screen.dart                    # Standalone energy screen
└── widgets/
    └── energy_header_widget.dart             # Compact header badge

apps/panel/lib/modules/deck/presentation/domain_pages/
└── energy_domain_view.dart                   # Space-level energy domain page
```

## Key Design Decisions

1. **Delta computation over raw storage** -- Cumulative kWh readings are converted to per-interval deltas at ingestion time. This trades slightly more complex ingestion for much simpler and faster query-time aggregation.

2. **5-minute fixed buckets** -- All deltas align to 5-minute clock boundaries. Faster sample rates accumulate into the same bucket via upsert. This provides a consistent time-series granularity without storing every raw sample.

3. **Denormalized room ID** -- The `roomId` is stored directly on each delta record (copied from the device at ingestion time). This avoids expensive joins during room-level queries at the cost of staleness if a device moves between rooms.

4. **Query-time aggregation** -- Space and home totals are computed on-the-fly via SQL `GROUP BY` rather than pre-aggregated materialized views. This keeps the write path simple and avoids consistency issues.

5. **Europe/Prague timezone** -- All range boundaries (today/yesterday/week/month) are computed in the Europe/Prague timezone to match the physical installation location. This correctly handles DST transitions.

6. **Support detection** -- The panel probes the summary endpoint at startup. If the backend returns 404/501, the energy UI is hidden entirely. This allows graceful degradation when no energy devices are configured.

7. **In-memory baselines** -- Delta computation baselines are held in memory, not persisted. A server restart loses baselines, meaning the first reading after restart produces no delta (treated as a first sample). This is acceptable because a single missed interval has negligible impact on aggregated data.
