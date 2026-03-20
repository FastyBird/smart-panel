# Task: In-memory fallback when InfluxDB is unavailable
ID: FEATURE-INFLUXDB-FALLBACK
Type: feature
Scope: backend
Size: medium
Parent: (none)
Status: planned

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

- [ ] Backend starts successfully without InfluxDB configured or running
- [ ] Device property values are readable and writable via in-memory store
- [ ] WebSocket real-time updates work without InfluxDB
- [ ] Energy module returns empty datasets instead of throwing errors
- [ ] Admin UI shows a warning banner: "InfluxDB not available — historical data disabled"
- [ ] When InfluxDB becomes available later, the backend switches to it without restart

## 5. Technical constraints

- The InfluxDB module (`apps/backend/src/modules/influxdb/`) should be optional.
- Use a provider/adapter pattern so the storage backend is swappable.
- Do not break existing InfluxDB functionality.

## 6. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Read the existing influxdb module to understand the current integration points.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
