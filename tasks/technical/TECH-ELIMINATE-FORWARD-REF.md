# Task: Eliminate all forwardRef usage with shared registry modules
ID: TECH-ELIMINATE-FORWARD-REF
Type: technical
Scope: backend
Size: large
Parent: (none)
Status: planned

## 1. Business goal

In order to have a consistent, maintainable dependency injection pattern across the backend
As a developer
I want to replace all `forwardRef` usages with small, focused shared registry modules that break circular dependency chains

## 2. Context

- The codebase currently uses **two conflicting patterns** for resolving circular dependencies: `forwardRef` (94+ usages across 31 files) and shared registry modules (`ToolsModule`, `SeedModule`, `StatsModule`).
- The shared registry pattern is cleaner: a small module holds a registry service, domain modules import it and self-register in `onModuleInit`. No circular imports needed.
- This pattern already works well for `ToolProviderRegistryService`, `SeedRegistryService`, and `StatsRegistryService`.
- The root cause of most `forwardRef` chains is the **Config ↔ Extensions ↔ System triangle** — three modules that mutually depend on each other and whose shared services (`ModulesTypeMapperService`, `ExtensionsService`, `FactoryResetRegistryService`, `ConfigService`) are consumed by 15+ other modules.
- **31 files** currently use `forwardRef`, including 18 module files and 13 service files.

### Existing shared registry modules to use as reference

- `apps/backend/src/modules/tools/tools.module.ts` — `ToolProviderRegistryService`
- `apps/backend/src/modules/seed/seed.module.ts` — `SeedRegistryService`
- `apps/backend/src/modules/stats/stats.module.ts` — `StatsRegistryService`

### Key circular dependency chains

1. **Config ↔ System ↔ Extensions triangle** — mutual cross-references between all three
2. **InfluxDB hub** — bidirectional dependency with Config, Api, WebSocket, Weather, Devices, Displays, Security, Intents
3. **Spaces domain** — SpacesModule ↔ DevicesModule, SpacesModule ↔ IntentsModule, plus internal service-level cycles
4. **Display/Dashboard** — DisplaysModule ↔ SpacesModule ↔ DashboardModule ↔ SystemModule
5. **Auth/Users** — AuthModule/UsersModule → ConfigModule/ExtensionsModule
6. **Plugin services** — device plugins → PluginServiceManagerService (from ExtensionsModule)

## 3. Scope

**In scope**

- Extract shared services from ConfigModule, ExtensionsModule, SystemModule into new focused modules
- Create new shared registry modules where needed to break circular chains
- Remove ALL `forwardRef(() => ...)` from module imports arrays
- Remove ALL `@Inject(forwardRef(() => ...))` from service constructors
- Use `ModuleRef` + dynamic `import()` for unavoidable file-level circular import chains (as done in `SpaceLightingToolService`)
- Update all affected test files
- Ensure all 190+ test suites pass and NestJS bootstrap succeeds

**Out of scope**

- Restructuring the overall module hierarchy or merging modules
- Changing public API contracts or controller behavior
- Modifying generated code (`spec/`, `openapi.json`)
- Frontend (admin/panel) changes

## 4. Acceptance criteria

- [ ] **Zero `forwardRef` in the codebase** — `grep -r "forwardRef" apps/backend/src/` returns no results
- [ ] All existing unit tests pass (`pnpm run test:unit`)
- [ ] All existing E2E tests pass (`pnpm run test:e2e`)
- [ ] NestJS application bootstraps without errors (`pnpm run start:dev` starts cleanly)
- [ ] No new `any` casts introduced except where already present
- [ ] Each new shared module follows the existing registry pattern (see ToolsModule, SeedModule, StatsModule)
- [ ] Linting passes (`pnpm run lint:js`)

## 5. Phased implementation plan

### Phase 1: Extract shared services from the Config–Extensions–System triangle

This is the highest-impact change. These three modules form the root of most dependency chains.

#### Phase 1a: Create `ModuleRegistryModule`

Extract `ModulesTypeMapperService` and `PluginsTypeMapperService` from ConfigModule into a new standalone module.

**New file**: `apps/backend/src/modules/module-registry/module-registry.module.ts`
```
@Module({
  providers: [ModulesTypeMapperService, PluginsTypeMapperService],
  exports: [ModulesTypeMapperService, PluginsTypeMapperService],
})
export class ModuleRegistryModule {}
```

- Move `ModulesTypeMapperService` and `PluginsTypeMapperService` source files into `module-registry/services/`
- Update ConfigModule: remove these providers/exports, import `ModuleRegistryModule`
- Update all 13+ consumer modules: import `ModuleRegistryModule` instead of `ConfigModule` (where ConfigModule was imported only for these services)
- **Consumers**: DevicesModule, SpacesModule, ScenesModule, DashboardModule, DisplaysModule, WeatherModule, SecurityModule, UsersModule, AuthModule, BuddyModule, EnergyModule, IntentsModule, and all plugin modules

#### Phase 1b: Create `ExtensionRegistryModule`

Extract `ExtensionsService` and `ExtensionsBundledService` from ExtensionsModule into a new standalone module.

**New file**: `apps/backend/src/modules/extension-registry/extension-registry.module.ts`
```
@Module({
  providers: [ExtensionsService, ExtensionsBundledService],
  exports: [ExtensionsService, ExtensionsBundledService],
})
export class ExtensionRegistryModule {}
```

- Move the relevant service files
- ExtensionsModule keeps `PluginServiceManagerService` and other extension-specific logic, imports `ExtensionRegistryModule`
- Update all 15+ consumer modules that imported ExtensionsModule only for `ExtensionsService`

**Note**: `ExtensionsService` depends on TypeORM `Repository<ExtensionEntity>`, so `ExtensionRegistryModule` will need `TypeOrmModule.forFeature([ExtensionEntity])`.

#### Phase 1c: Create `FactoryResetModule`

Extract `FactoryResetRegistryService` from SystemModule.

**New file**: `apps/backend/src/modules/factory-reset/factory-reset.module.ts`
```
@Module({
  providers: [FactoryResetRegistryService],
  exports: [FactoryResetRegistryService],
})
export class FactoryResetModule {}
```

- Move `FactoryResetRegistryService` to `factory-reset/services/`
- SystemModule imports `FactoryResetModule` instead of owning the service
- Update 7 consumer modules: DevicesModule, SpacesModule, ScenesModule, DashboardModule, DisplaysModule, WeatherModule, SecurityModule

#### Phase 1d: Break Config ↔ System ↔ Extensions circle

After phases 1a–1c, the triangle should be broken because:
- ConfigModule no longer needs ExtensionsModule or SystemModule (the shared services moved out)
- ExtensionsModule no longer needs ConfigModule (ModulesTypeMapperService moved to ModuleRegistryModule)
- SystemModule no longer needs ConfigModule or ExtensionsModule (shared services moved out)

Verify and remove all remaining `forwardRef` between these three modules.

### Phase 2: Extract InfluxDB shared service

#### Phase 2a: Create `InfluxDbRegistryModule` or simplify InfluxDbModule

The `InfluxDbModule` is imported with `forwardRef` by 7+ modules. The circular dependency is:
- InfluxDbModule → ConfigModule (for config) → SystemModule → InfluxDbModule

After Phase 1 breaks the Config triangle, check if InfluxDbModule can simply import ConfigModule directly (no cycle). If a cycle remains:

**Option A**: Make InfluxDbModule import `ModuleRegistryModule` instead of `ConfigModule` if that's all it needs.
**Option B**: Extract `InfluxDbService` into a small `InfluxDbCoreModule` that only depends on the InfluxDB client.

- Remove `forwardRef(() => InfluxDbModule)` from: ApiModule, WebSocketModule, WeatherModule, DevicesModule, DisplaysModule, SecurityModule, IntentsModule, SystemModule

### Phase 3: Break domain-level circular imports

#### Phase 3a: Spaces ↔ Devices

`SpacesModule` uses `forwardRef(() => DevicesModule)` and vice versa.
- **SpacesService** injects `DeviceZonesService` with `@Inject(forwardRef(...))`
- **DevicesService** injects `DeviceZonesService` with `@Inject(forwardRef(...))`
- `DeviceZonesService` likely belongs in one module — determine which and consolidate

If both need each other's services, consider:
1. Moving `DeviceZonesService` to a small shared `DeviceZonesModule`
2. Or using `ModuleRef` lazy resolution in the service that creates the cycle

#### Phase 3b: Spaces ↔ Intents

`SpacesModule` imports `forwardRef(() => IntentsModule)` and IntentsModule imports `forwardRef(() => ...)`
- 7 space services inject `IntentTimeseriesService` with `@Inject(forwardRef(...))`
- `IntentsService` injects `IntentTimeseriesService` with `@Inject(forwardRef(...))`

**Solution**: Create `IntentTimeseriesModule` that owns `IntentTimeseriesService`:
```
@Module({
  imports: [TypeOrmModule.forFeature([...])],  // if it needs entities
  providers: [IntentTimeseriesService],
  exports: [IntentTimeseriesService],
})
export class IntentTimeseriesModule {}
```

Both SpacesModule and IntentsModule import `IntentTimeseriesModule`.

#### Phase 3c: Internal spaces service cycles

The climate/covers/lighting intent services have heavy `@Inject(forwardRef(...))` usage:
- `ClimateIntentService` → `SpaceClimateStateService`, `SpaceContextSnapshotService`, `SpaceUndoHistoryService`, `IntentTimeseriesService`, `IntentsService`
- `CoversIntentService` → `SpaceCoversStateService`, `SpaceContextSnapshotService`, `SpaceUndoHistoryService`, `IntentTimeseriesService`, `IntentsService`
- `LightingIntentService` → `SpaceContextSnapshotService`, `SpaceUndoHistoryService`, `IntentTimeseriesService`, `SpaceLightingStateService`, `IntentsService`

These are intra-module forwardRefs (all within SpacesModule). Solutions:
1. **Reorder providers** in SpacesModule to ensure correct initialization order
2. **Use `ModuleRef`** lazy resolution (like `SpaceLightingToolService` already does) for the services that create cycles
3. **Extract shared snapshot/undo services** into a small `SpaceStateModule` if they cause file-level import cycles

Investigate the exact file-level import chains to determine the minimal fix. `ModuleRef` is the safest approach for intra-module cycles.

#### Phase 3d: Displays ↔ Spaces ↔ Dashboard

- DisplaysModule: `forwardRef(() => SpacesModule)`, `forwardRef(() => DashboardModule)`
- DashboardModule: `forwardRef(() => ConfigModule)`, `forwardRef(() => ExtensionsModule)`, `forwardRef(() => SystemModule)`

After Phase 1 extracts shared services, DashboardModule should no longer need forwardRef for Config/Extensions/System. For Displays ↔ Spaces, determine which direction the dependency flows and break the cycle.

### Phase 4: Break remaining module-level forwardRefs

#### Phase 4a: WebSocket ↔ Auth ↔ Users

- WebSocketModule: `forwardRef(() => AuthModule)`, `forwardRef(() => UsersModule)`
- AuthModule: `forwardRef(() => ConfigModule)`, `forwardRef(() => ExtensionsModule)`
- UsersModule: `forwardRef(() => ConfigModule)`, `forwardRef(() => ExtensionsModule)`, `forwardRef(() => SystemModule)`

After Phase 1, Auth and Users should no longer need forwardRef for Config/Extensions/System.
For WebSocket ↔ Auth/Users: determine if WebSocketModule truly needs AuthModule (likely for JWT validation). If so, extract a small `AuthCoreModule` with the JWT validation service.

#### Phase 4b: Buddy module

- BuddyModule: `forwardRef(() => SpacesModule)`, `forwardRef(() => DevicesModule)`, `forwardRef(() => ScenesModule)`

After earlier phases clean up Spaces/Devices/Scenes modules, check if these forwardRefs are still needed. If BuddyModule only consumes services from these modules (doesn't export back), the dependency should be one-way and forwardRef unnecessary.

### Phase 5: Plugin service-level forwardRefs

#### Phase 5a: PluginServiceManagerService

4 plugin services inject `PluginServiceManagerService` with `@Inject(forwardRef(...))`:
- `HomeAssistantWsService`
- `ShellyNgService`
- `WledService`
- `Zigbee2MqttService`

After Phase 1b extracts ExtensionsService, check if `PluginServiceManagerService` can be exported from `ExtensionRegistryModule` or a new `PluginManagerModule`. If plugins import this module directly, no forwardRef needed.

#### Phase 5b: Home Assistant internal cycle

- `HomeAssistantWsService` → `@Inject(forwardRef(() => HomeAssistantHttpService))`

This is an intra-plugin cycle. Use `ModuleRef` lazy resolution or reorder the file imports.

### Phase 6: System ↔ Spaces (house-mode-actions)

- `HouseModeActionsService` injects `SpacesService` and `SpaceIntentService` with `@Inject(forwardRef(...))`
- SystemModule imports `forwardRef(() => SpacesModule)`

After earlier phases, if SystemModule no longer has shared services creating cycles, this may resolve naturally. If not, use `ModuleRef` lazy resolution in `HouseModeActionsService`.

## 6. Technical constraints

- Follow the existing shared registry module pattern (ToolsModule, SeedModule, StatsModule)
- Do not introduce new npm dependencies
- Do not modify generated code
- Tests are expected for any new services/modules
- Each phase should be independently committable and testable
- Use `ModuleRef` + dynamic `import()` only as last resort for intra-module file-level cycles
- Preserve all existing public API contracts

## 7. Implementation hints

- **Start with Phase 1** — it has the highest impact, breaking the root triangle that causes most downstream forwardRefs
- After each phase, run `pnpm run test:unit` and verify bootstrap to catch regressions early
- Use `grep -rn "forwardRef" apps/backend/src/ | wc -l` to track progress
- Reference `SpaceLightingToolService` for the `ModuleRef` lazy resolution pattern
- When moving services to new modules, update both the `providers` and `exports` arrays
- Check for re-exports: some modules re-export services from their dependencies — update these too
- **Order matters**: do Phase 1 first because later phases depend on the Config/Extensions/System triangle being broken
- For intra-module `@Inject(forwardRef(...))` between services in the same module, the fix is usually `ModuleRef` or reordering provider declarations

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
- **Implement one phase at a time**, running tests after each phase.
- After Phase 1, re-count remaining forwardRef usages to validate progress.
- If a phase reveals that a forwardRef is no longer needed (because the root cycle was already broken), simply remove it without creating a new module.
- Commit after each phase with a descriptive message.
