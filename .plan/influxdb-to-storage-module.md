# Refactor: InfluxDB Module → Storage Module with Plugin Architecture

## Overview

Transform the monolithic `influxdb` module into a generic `storage` module with a
plugin-based architecture. InfluxDB becomes one storage plugin (`influx-v1`), and
the in-memory fallback becomes another (`memory`). The storage module manages
plugin selection, fallback, and exposes a unified service to consumers.

## Architecture

```
modules/storage/
  storage.module.ts              # NestJS module (replaces influxdb.module.ts)
  storage.constants.ts           # Module name, defaults
  storage.openapi.ts             # Swagger model exports
  interfaces/
    storage-plugin.interface.ts  # Contract all storage plugins implement
  services/
    storage.service.ts           # Main service - selects plugin, delegates, handles fallback
  plugins/
    influx-v1/
      influx-v1.plugin.ts       # InfluxDB v1 implementation (extracted from influxdb.service.ts)
      influx-v1.constants.ts    # InfluxDB-specific constants
    memory/
      memory.plugin.ts          # In-memory implementation (wraps existing store + parser)
      in-memory-timeseries.store.ts  # (moved from influxdb/services/)
      influxql-parser.ts             # (moved from influxdb/services/)
  models/
    config.model.ts              # Config with plugin selection + InfluxDB settings
  dto/
    update-config.dto.ts         # Update DTO
```

## Step-by-step Plan

### Step 1: Create the Storage Plugin Interface

Create `interfaces/storage-plugin.interface.ts` with the contract:
- `name: string` — plugin identifier
- `initialize(): Promise<void>`
- `destroy(): Promise<void>`
- `isAvailable(): boolean`
- `writePoints(points): Promise<void>`
- `query<T>(query, options?): Promise<IResults<T>>`
- `queryRaw<T>(query, options?): Promise<T>`
- `registerSchema(schema): void`
- `dropMeasurement(measurement): Promise<void>`
- `getMeasurements(): Promise<string[]>`
- Optional InfluxDB-specific: `createContinuousQuery`, `createRetentionPolicy`,
  `alterRetentionPolicy`, `showRetentionPolicies`, `showContinuousQueries`,
  `dropContinuousQuery`, `dropRetentionPolicy`, `createDatabase`, `dropDatabase`,
  `getDatabaseNames`, `ping`, `dropSeries`, user management methods

### Step 2: Create the Memory Storage Plugin

Create `plugins/memory/memory.plugin.ts`:
- Implements `StoragePlugin`
- Wraps `InMemoryTimeSeriesStore` + `InfluxQLParser` (moved files)
- `isAvailable()` always returns `true`
- All InfluxDB-specific optional methods are no-ops
- Move `in-memory-timeseries.store.ts` and `influxql-parser.ts` to `plugins/memory/`

### Step 3: Create the InfluxDB v1 Storage Plugin

Create `plugins/influx-v1/influx-v1.plugin.ts`:
- Implements `StoragePlugin`
- Extracted from current `influxdb.service.ts` (connection management, setup,
  retention policies, continuous queries, CQ normalization logic)
- `isAvailable()` returns whether InfluxDB connection is alive
- All InfluxDB-specific methods fully implemented

### Step 4: Create the Storage Service

Create `services/storage.service.ts`:
- Injects `ConfigService` to read plugin selection config
- On bootstrap: initializes primary plugin, then fallback plugin
- `isConnected()` → true if primary OR fallback is available
- `isUsingFallback()` → true when primary failed, using fallback
- `writePoints()` → writes to both primary (if available) AND fallback (always)
- `query()` → tries primary, falls back to fallback
- All InfluxDB-specific methods delegate to primary if supported, else no-op
- Exposes `isInfluxDbConnected()` for status introspection

### Step 5: Update Config Model & DTO

Update `models/config.model.ts`:
- Keep the config type as `influxdb-module` for **backward compatibility** (existing
  configs in the database use this key)
- Add `primaryStorage` field (default: `'influx-v1'`, options: `'influx-v1'` | `'memory'`)
- Add `fallbackStorage` field (default: `'memory'`)
- Keep existing InfluxDB fields (host, database, username, password) — they apply
  when `influx-v1` plugin is selected

Update `dto/update-config.dto.ts` similarly.

### Step 6: Create the Storage Module

Create `storage.module.ts`:
- Replaces `influxdb.module.ts`
- Provides `StorageService` (main service consumers inject)
- Registers config type mapping, swagger models, extension metadata
- Extension metadata updated: name "Storage", description mentions plugins

### Step 7: Update Storage Constants

Create `storage.constants.ts`:
- `STORAGE_MODULE_NAME = 'influxdb-module'` (backward compat — config key unchanged)
- `STORAGE_PLUGIN_INFLUX_V1 = 'influx-v1'`
- `STORAGE_PLUGIN_MEMORY = 'memory'`
- Re-export InfluxDB defaults for the influx-v1 plugin

### Step 8: Update All Consumer Imports

Update all backend modules/services that import from `influxdb`:
- `InfluxDbModule` → `StorageModule`
- `InfluxDbService` → `StorageService`
- Import paths: `../../influxdb/...` → `../../storage/...`

Affected modules (8):
- `devices.module.ts` + services (PropertyValueService, DeviceConnectionStateService,
  PropertyTimeseriesService, StatsService, ModuleResetService)
- `displays.module.ts` + services (DisplayConnectionStateService, ModuleResetService)
- `security.module.ts` + SecurityEventsService
- `weather.module.ts` + WeatherHistoryService
- `intents.module.ts` + IntentTimeseriesService
- `api.module.ts` + ApiMetricsService + ApiStatsProvider
- `websocket.module.ts` + WsMetricsService + WsStatsProvider
- `system.module.ts`

### Step 9: Update Extensions Constants

Update `extensions.constants.ts`:
- Change import from `../influxdb/influxdb.constants` to `../storage/storage.constants`
- `INFLUXDB_MODULE_NAME` → `STORAGE_MODULE_NAME` in the `NON_TOGGLEABLE_MODULES` array

### Step 10: Remove Old influxdb Directory

Delete `modules/influxdb/` — all code has been moved to `modules/storage/`.

### Step 11: Update Admin Module

The admin module (`apps/admin/src/modules/influxdb/`) is a config UI — its
internal naming can stay as-is for now since it manages the same config
key (`influxdb-module`). The admin module doesn't need structural changes
because:
- Config type string stays the same
- InfluxDB config fields stay the same
- New fields (primaryStorage, fallbackStorage) can be added to admin schemas

Minimal changes:
- Add `primaryStorage` and `fallbackStorage` fields to admin config schemas/forms

### Step 12: Run Linting & Tests

- Run `eslint` on all modified files
- Run `pnpm run test:unit` to verify all 198 test suites pass
- Fix any import path issues in test files

## Backward Compatibility

- Config key remains `influxdb-module` — no database migration needed
- `StorageService` exposes the same API surface as `InfluxDbService`
- Existing configs (host, database, etc.) continue to work unchanged
- Default behavior unchanged: primary = influx-v1, fallback = memory
