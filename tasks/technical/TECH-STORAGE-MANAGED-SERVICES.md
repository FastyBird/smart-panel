# Task: Storage Plugins → Managed Services

ID: TECH-STORAGE-MANAGED-SERVICES
Type: technical
Scope: backend
Size: medium
Parent: (none)
Status: done

> **Note:** Implemented in `influx-v1-managed.service.ts` and `memory-storage-managed.service.ts` (with specs), with `StorageService.registerPlugin()` / `unregisterPlugin()`. Identifiers were renamed when this work was absorbed into `docs/superpowers/plans/2026-09-01-managed-extension-services.md`: `PluginServiceManagerService` -> `ManagedServiceManagerService`, `IManagedPluginService` -> `IManagedExtensionService`, `BaseManagedPluginService` -> `BaseManagedExtensionService` (`base-managed-extension.service.ts`). Runtime keys are now `<kind>:<type>:<serviceId>` (the keys in the scenarios below predate this).

## 1. Business goal

In order to have consistent lifecycle management across all plugins
As a developer / system admin
I want storage plugins (InfluxV1, MemoryStorage) to participate in the centralized `ManagedServiceManagerService` lifecycle — just like device, buddy, and logger plugins already do.

## 2. Context

- All long-running plugin services (Shelly V1, Shelly NG, Home Assistant, WLED, Zigbee2MQTT, Telegram, Discord, WhatsApp, FileLogger, Simulator) implement `IManagedExtensionService` and register with `ManagedServiceManagerService`.
- Storage plugins use their own factory-based lifecycle (`StorageService.registerPluginFactory()` → `onApplicationBootstrap` creates instances → `initialize()` / `destroy()`).
- This means storage plugins are **invisible** in the managed services status dashboard, lack health checks, runtime tracking (uptime, start count, last error), and don't respond to enable/disable config changes through the centralized system.
- Reference implementations: `FileLoggerService`, `WledService`.

## 3. Scope

**In scope**

- Create `@Injectable()` managed service wrappers for InfluxV1 and MemoryStorage plugins implementing `IManagedExtensionService`.
- Register them with `ManagedServiceManagerService` during `onModuleInit()`.
- Refactor `StorageService` to support dynamic plugin registration (`registerPlugin` / `unregisterPlugin`) instead of the factory pattern.
- Remove the factory pattern from `StorageService` (`registerPluginFactory`, `pluginFactories`, `createPlugin`).
- Remove direct lifecycle management from `StorageService` (`onApplicationBootstrap` plugin creation, `onModuleDestroy` plugin cleanup).
- Add `isHealthy()` and `getPriority()` to storage managed services (priority 10 — start before device plugins).
- Add `onConfigChanged()` to InfluxV1 managed service (host/database/credentials changes require restart).
- Unit tests for both managed services.

**Out of scope**

- Admin UI changes (storage services will automatically appear in existing service status views).
- Panel changes.
- New API endpoints.

## 4. Acceptance criteria

- [x] `InfluxV1ManagedService` implements `IManagedExtensionService` and is registered with `ManagedServiceManagerService`.
- [x] `MemoryStorageManagedService` implements `IManagedExtensionService` and is registered with `ManagedServiceManagerService`.
- [x] `StorageService` no longer uses the factory pattern; plugins register dynamically via `registerPlugin()`.
- [x] `StorageService` no longer implements `OnApplicationBootstrap` / `OnModuleDestroy` for plugin lifecycle.
- [x] Schema buffering continues to work — schemas registered before plugins arrive are flushed when plugins register.
- [x] Storage plugins appear in `ManagedServiceManagerService.getStatus()` with correct state, health, and runtime info.
- [x] InfluxV1 managed service signals `restartRequired: true` when host/database/credentials config changes.
- [x] Storage managed services use priority 10 (start before default-priority device plugins).
- [x] Unit tests cover start, stop, state transitions, health checks, and config change handling.
- [x] Lint and existing tests pass.

## 5. Example scenarios

### Scenario: Storage plugins appear in managed service status

Given the application is running with InfluxV1 as primary and MemoryStorage as fallback
When `ManagedServiceManagerService.getStatus()` is called
Then both `influx-v1-plugin:storage` and `memory-storage-plugin:storage` appear with state `started`

### Scenario: InfluxDB config change triggers restart

Given the InfluxV1 managed service is running
When the admin changes the InfluxDB host in plugin config
Then `onConfigChanged()` returns `{ restartRequired: true }`
And the `ManagedServiceManagerService` performs a stop → start cycle

### Scenario: Storage starts before device plugins

Given storage services have priority 10 and device plugins have default priority 100
When the application bootstraps
Then storage services start in level 0 and device plugins start in a later level

## 6. Technical constraints

- Follow the existing `IManagedExtensionService` pattern (see `FileLoggerService`, `WledService`).
- Do not introduce new dependencies.
- Do not modify generated code.
- Pre-release migration policy: no new migrations needed.

## 7. Implementation hints

- Use `FileLoggerService` as the closest reference (simple managed service with config).
- Storage managed services should create the `StoragePlugin` instance in `start()`, register it with `StorageService`, and unregister + destroy in `stop()`.
- `StorageService.registerPlugin(name, plugin)` assigns to primary or fallback based on `StorageConfigModel.primaryStorage` / `fallbackStorage`.
- Keep `pendingSchemas` buffer — flush to each new plugin on registration.
- Priority 10 ensures storage starts before device plugins (default 100) and stops after them.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
