# Task: In-memory fallback when InfluxDB is unavailable
ID: FEATURE-INFLUXDB-FALLBACK
Type: feature
Scope: backend, admin
Size: medium
Parent: (none)
Status: done

## 1. Business goal

In order to have a functional Smart Panel even without InfluxDB installed...
As a user with a minimal installation...
I want the backend to gracefully degrade to in-memory storage for device values when InfluxDB is not available.

## 2. Context

- InfluxDB is currently used to store actual device property values, metrics history, and WebSocket stats.
- Without InfluxDB, the backend fails or returns empty data for device states.
- Not all install methods guarantee InfluxDB (Docker, NPM script installs).
- The install script now installs InfluxDB, but it may fail or be skipped.
- An in-memory fallback would allow basic functionality (current values) without historical data.

## 3. Scope

**In scope**

- Detect InfluxDB availability at startup
- Fallback to in-memory Map/store for current device property values
- Log a warning when running without InfluxDB
- Show a notification in Admin UI when InfluxDB is unavailable
- Energy module gracefully returns empty data instead of errors

**Out of scope**

- Persisting in-memory data to disk (SQLite alternative)
- Historical data without InfluxDB
- Auto-installing InfluxDB from the backend

## 4. Acceptance criteria

- [x] Backend starts successfully without InfluxDB configured or running
- [x] Device property values are readable and writable via in-memory store
- [x] WebSocket real-time updates work without InfluxDB
- [x] Energy module returns empty datasets instead of throwing errors
- [x] Admin UI shows a warning banner: "InfluxDB not available — historical data disabled"
- [ ] When InfluxDB becomes available later, the backend switches to it without restart

## 5. What was implemented

- **Storage module refactoring**: Renamed influxdb module to a generic storage module with plugin architecture
- **Plugin factory registry**: `StorageService.registerPluginFactory()` replaces hardcoded plugin switch
- **Storage-own type abstractions**: `StorageFieldType`, `StorageMeasurementSchema`, `StoragePoint`, `StorageQueryOptions` — all consumers decoupled from the `influx` npm package
- **Plugin self-registration**: Each plugin (influx-v1, memory) has its own NestJS module that self-registers config mappings, factories, swagger models, and extension metadata
- **Schema buffering**: Schemas registered before plugins exist are buffered and flushed during `onApplicationBootstrap()`
- **Dual-write resilience**: Writes go to both primary and fallback storage; errors are caught on both
- **Query fallback**: If primary query fails transiently, fallback is tried automatically
- **Memory storage plugin**: In-memory InfluxQL-compatible storage with `!=` exclude filter support
- **Admin UI**: Memory storage plugin registered in admin extensions list; storage config form uses select dropdowns for primary/fallback plugin selection
- **All consumer modules updated**: Comments, logs, variable names cleaned up from "InfluxDB" to "storage"

## 6. Technical constraints

- The InfluxDB module (`apps/backend/src/modules/influxdb/`) should be optional.
- Use a provider/adapter pattern so the storage backend is swappable.
- Do not break existing InfluxDB functionality.

## 7. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Read the existing influxdb module to understand the current integration points.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
