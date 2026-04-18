# Implementation Plan: Spaces Plugin System & Digital Signage Support

**Task:** EPIC-SPACES-PLUGIN-SIGNAGE
**Status:** In Progress
**Scope:** Backend (NestJS) + Admin (Vue.js) + Panel (Flutter/Dart)

---

## Context

Today the Smart Panel is exclusively an **interactive** surface: users watch device values, intents, and group states, and control devices. We want to extend it to also support **digital signage** (display-only, content-driven surfaces — hallway info screens, lobby displays, etc.).

The cleanest way to add this is to refactor the **Spaces** module into a plugin-host (mirroring the existing Dashboard pattern of pluggable pages/tiles/data-sources). Today's monolithic space behavior becomes the first plugin (`spaces-home-control`). `master` and `entry` — currently stub "coming soon" display roles — become their own synthetic-space plugins. Signage ships as an additional space-type plugin (`spaces-signage-info-panel`). The **Displays** module drops its `DisplayRole` discriminator entirely — a display simply points at a Space, and the space's type (contributed by a plugin) decides what the panel renders.

This unifies three previously-separate concerns (physical rooms, whole-house overview, security/entry, signage) under one extensible mechanism and opens the door to future surfaces (dashboard-kiosk, video-wall, media-loop, etc.) without backend or panel-core changes.

## Progress

Track what has already shipped so a new agent does not redo work.

- ✅ **Phase 1a** — PR #578 (`claude/add-readonly-mode-pMcCa`), commit `c6ef222`. `SpacesTypeMapperService`, `SpaceCreateBuilderRegistryService`, `SpaceRelationsLoaderRegistryService`, `space.relations.ts` interfaces. Registered as providers + exports on `SpacesModule`.
- ✅ **Phase 1b** — PR #578, commits `11a6182` → `8e46078`. `SpaceEntity` abstract with `@TableInheritance`; `RoomSpaceEntity` / `ZoneSpaceEntity` as `@ChildEntity('room'|'zone')`; `type` getter pattern; `SpacesService.create/update` routed through `SpacesTypeMapperService` + `dataSource.getRepository(mapping.class)`. `getChildRooms` / `findAllZones` migrated to subtype repos. No DB migration needed (the `type` column already existed in the initial migration). Backend lint, tests (466 spaces + 59 displays), OpenAPI regen all green.
- ✅ **Phase 1c (wiring)** — PR #579 (`claude/phase-2-continue-3SPZh`, base = PR #578). Consumer-side wiring of the Phase 1a registries: `SpacesService.create` invokes `SpaceCreateBuilderRegistryService` builders after persistence; `findAll` / `findOne` / `findAllZones` / `getChildRooms` invoke `SpaceRelationsLoaderRegistryService` loaders on results. Tests updated to provide mock registries. This lands the infrastructure that Phase 3's plugin will consume.
- ✅ **Phase 2** — Branch `claude/spaces-plugin-signage-gHDgs`. Unified `SpaceRoleEntity` hierarchy landed: abstract base on `spaces_module_space_roles`; six `@ChildEntity` subtypes (`lighting` / `climate` / `covers` / `sensor` / `media_binding` / `active_media`) with all subtype columns nullable. `SpaceRolesTypeMapperService` registered + six built-in mappings wired in `SpacesModule.onModuleInit`. Lighting/covers services migrated from TypeORM `upsert` to explicit find-then-insert/update to avoid discriminator collisions in `conflictPaths`. Migration `1000000000003-UnifySpaceRoleTables.ts` creates the unified table, copies rows from the six legacy tables with the correct discriminator, and installs partial unique indexes per subtype to preserve the original uniqueness semantics. Legacy tables intentionally retained for rollback (dropped in Phase 7). OpenAPI schema names preserved (`SpacesModuleDataSpace*Role*`); regen yields no diff. All 2,747 unit + 36 e2e tests pass.
- 🟡 **Phase 3a** — In progress on branch `claude/spaces-plugin-signage-TRG2E`. Backend plugin extraction. See Phase 3 section below for sub-phase split (3a backend / 3b admin / 3c panel).
- 🟡 **Phase 3b, 3c, 4–7** — Not started.

## Patterns & Gotchas (learned from Phase 1)

Hard-earned lessons from Phase 1 review. Apply these verbatim when writing Phase 2+ code — each one took a round of Bugbot feedback or CI failure to surface.

### Polymorphic entity pattern
- Make the base class `abstract export abstract class XEntity extends BaseEntity`. Decorate with `@Entity('table_name')` + `@TableInheritance({ column: { type: 'varchar', name: 'type' } })`.
- **Do NOT** declare `@Column() type: ...` on the base — TypeORM's `@TableInheritance` manages the discriminator column. Declaring both creates a schema conflict.
- Add a `type` getter on the base that **throws** (not returns `constructor.name.toLowerCase()`): subtypes must override. Silent fallback masks plugin authors forgetting to override. See `space.entity.ts:193-203` after commit `7bee1e2`.
- Keep the base getter's return type narrow (e.g. `get type(): SpaceType`) so the generated OpenAPI keeps the enum shape and downstream admin/panel clients don't regress into `string`.
- Child entity: `@ChildEntity('discriminator-string')` — **pass the discriminator explicitly**. The default (no argument) uses the class name (e.g. `'RoomSpaceEntity'`), which does not match existing database rows that were seeded with `'room'`/`'zone'`.
- Child entity getter: `@ApiProperty({ enum: Enum, default: Enum.X, example: Enum.X }) @Expose() get type(): Enum { return Enum.X; }`. Match the enum typing on both base and child.

### Repository resolution for subtypes
- `this.repository.create(instance)` on the base `Repository<BaseEntity>` does `new BaseEntity() + Object.assign` — **it discards the concrete subtype class** and won't copy prototype-only getters, so TypeORM writes a null/incorrect discriminator. Instead:
  ```typescript
  const mapping = typeMapper.getMapping(type);
  const subRepo = dataSource.getRepository(mapping.class);
  const entity = subRepo.create(toInstance(mapping.class, dto));
  await subRepo.save(entity);
  ```
- `repository.find({ where: { type: ... } })` on the base repo is a **silent no-op** — TypeORM excludes the `@TableInheritance` discriminator from ordinary column metadata (see typeorm#3261). Use the subtype repo:
  ```typescript
  const mapping = typeMapper.getMapping(SpaceType.ROOM);
  await dataSource.getRepository(mapping.class).find({ where: { parentId: zoneId } });
  ```
- Both patterns are already in `SpacesService.create`, `getChildRooms`, `findAllZones` after commit `8e46078` — mirror them.

### Updating an entity's discriminator (type change)
- You cannot flip a `RoomSpaceEntity` into a `ZoneSpaceEntity` by mutating `.type` and `.save()` — the getter is immutable and the concrete class is fixed. Use a raw QueryBuilder update of the discriminator column followed by re-fetch:
  ```typescript
  await this.repository.createQueryBuilder().update(BaseEntity).set({ ...updateFields, type: effectiveType }).where('id = :id', { id }).execute();
  const reloaded = await this.getOneOrThrow(id);
  ```
- Build `updateFields` from `toInstance(newTypeMapping.class, dto)`, **not** the old type's mapping — otherwise new-subtype-specific `@Expose()` fields get dropped.
- The DTO's `@Transform(({obj}) => obj.foo ?? obj.fooCamel)` collapses explicit `null` into `undefined`, which `omitBy(..., isUndefined)` then strips. Set nullable fields explicitly in the raw `.set({...})` object when the DTO carried `null`.
- Always emit the update event on a type change regardless of `entityFieldsChanged`, since downstream listeners branch on subtype.

### DTO / OpenAPI preservation
- Keep the enum declaration on the base `@ApiProperty({ enum: Enum, example: Enum.X })` — dropping it demotes the generated TypeScript client type to `string`, breaking admin type-checks (admin's `vue-tsc --build` runs in CI as `type-check`) and Dart client codegen.
- Child entities' `@ApiSchema({ name: 'ModuleDataXSpace' })` with the same `type` getter declaration generates a separate schema per subtype in `openapi.json`. That's the discriminator pattern admin and panel expect.

### Cross-module callers
- After the getter return type is narrowed to the enum, cross-module `space.type === SpaceType.ROOM` comparisons stop needing casts. ESLint will flag leftover `(space.type as SpaceType)` as `@typescript-eslint/no-unnecessary-type-assertion`. Run `pnpm --filter ./apps/backend run lint:js:fix` after the getter change.
- Known call sites: `devices/services/device-zones.service.ts`, `devices/services/devices.service.ts`, `displays/services/displays.service.ts`, `scenes-local/platforms/local-scene.platform.ts`.

### Test mock migration
- Replace `const mockX: XEntity = { type: Enum.Y, ... }` with `const mockX = { ... } as unknown as XEntity` — the `type` getter is readonly at the type level so object-literal assignment trips TS even though the runtime data flows fine.
- Replace `toInstance(XEntity, mockX)` in specs with `toInstance(ConcreteXEntity, mockX)` — abstract base can't be instantiated by `plainToInstance`.
- Provide `SpacesTypeMapperService` as a test provider and pre-register built-in mappings in the suite's `beforeEach`. See `spaces.service.spec.ts:beforeEach` for the template.
- Mock `DataSource.getRepository` to return the same base repository mock so the new subtype-repo path in `SpacesService.create` still works.
- Type-change tests must chain `.mockResolvedValueOnce(preUpdate).mockResolvedValueOnce(postUpdate)` on `findOne` because the new code re-fetches after the raw discriminator update.

### CI-vs-local environment gotchas
- Local `pnpm --filter ./apps/backend run lint:js` may show false errors from `plugins/devices-{shelly-ng,home-assistant,zigbee2mqtt}/*` complaining about `Cannot find module '../../../spec/channels'`. Those are pre-existing; CI regenerates `apps/backend/src/spec/` via `pnpm generate:spec` in the setup action. To reproduce the CI lint locally, run `pnpm generate:spec && pnpm generate:openapi` first.
- The admin `vue-tsc --build` type-check runs separately from lint in CI (`Admin code analysis` job) — verify both with `pnpm --filter @fastybird/smart-panel-admin type-check` before pushing backend schema-shaping changes.

## Architecture Decisions

- **Polymorphic `SpaceEntity`** — convert `SpaceEntity` to abstract with TypeORM `@TableInheritance({ column: 'type' })`. `RoomSpaceEntity`, `ZoneSpaceEntity`, `MasterSpaceEntity`, `EntrySpaceEntity`, `SignageInfoPanelSpaceEntity` are `@ChildEntity` variants contributed by plugins. This mirrors `PageEntity`/`TileEntity`/`DataSourceEntity` exactly — reviewers already understand it, and `parentId`/`category` stop polluting synthetic spaces.
- **Unified `SpaceRoleEntity`** — collapse the five existing per-domain role tables (lighting/climate/covers/sensors/media-binding/active-media) into one inheritance-rooted table `spaces_module_space_roles`. Lets future plugins add new role types without spaces-core changes.
- **Single `spaces-home-control` plugin** — lighting/climate/covers/sensors/media share context-snapshot, suggestions, and undo services; splitting them would force duplication or a shared base plugin. Internal sub-folders (`services/lighting/`, `services/climate/`, ...) preserve logical separation.
- **Display simplification** — remove `DisplayRole`; rename `displays.roomId` → `displays.spaceId` (FK to any space type). `HomeResolutionService` delegates "home page for space" to a per-plugin resolver registry.
- **Panel view dispatch** — replace `system_views_builder.dart`'s switch-on-`DisplayRole` with a `Map<String, SpaceViewBuilder> spaceViewBuilders` keyed by `space.type`. Each panel plugin registers its builder on init. All existing domain views (Lights/Climate/Media/Sensors/Shading/Energy) become owned by the home-control panel plugin.
- **First signage plugin = Info Panel** — fixed configurable sections (clock, weather, announcements/messages, optional feed). No timer-based slides, no video. Read-only; no intents.

## Reference Patterns to Reuse

- `apps/backend/src/plugins/pages-cards/pages-cards.plugin.ts` — canonical backend plugin `onModuleInit` with type mapping, relations loader, swagger models, discriminator, extension metadata registration.
- `apps/backend/src/modules/dashboard/services/pages-type-mapper.service.ts:22` — registry service template (to replicate as `SpacesTypeMapperService`, `SpaceRolesTypeMapperService`).
- `apps/backend/src/modules/swagger/services/extended-discriminator.service.ts` — OpenAPI polymorphism.
- `apps/admin/src/plugins/pages-cards/pages-cards.plugin.ts` — admin plugin install function template (routes, Pinia store, translations, `pluginsManager.addPlugin` with `elements[]`).
- `apps/admin/src/modules/dashboard/composables/usePagesPlugin.ts` — dynamic component resolution pattern (to replicate as `useSpacesPlugin`).
- `apps/panel/lib/modules/dashboard/mappers/page.dart` — Flutter three-level mapper registry (`pageModelMappers`, `pageViewsMappers`, `pageWidgetMappers`) — to replicate as `spaceViewBuilders`.
- `apps/panel/lib/modules/dashboard/module.dart:145` `_registerPlugins()` — plugin registration site template.

## Phased Rollout

Seven phases; each phase ships independently with its own incremental migration. Migration numbering continues from `1000000000003` upward per CLAUDE.md's incremental-migration policy.

### Phase 1 — Polymorphic `SpaceEntity` (no behavior change)

**Goal:** Convert `SpaceEntity` to abstract `@TableInheritance` root; add registry services. Room/Zone still live in core (moved to plugin in Phase 3).

**Files:**
- `apps/backend/src/modules/spaces/entities/space.entity.ts` — make abstract, add `@TableInheritance({ column: { type: 'varchar', name: 'type' } })`, remove `type`/`category`/`parentId` (move to child entities).
- `apps/backend/src/modules/spaces/entities/room-space.entity.ts` (new) — `@ChildEntity('room')` with `category`, `parentId`, `icon`, `displayOrder`, `suggestionsEnabled`, `statusWidgets`, `lastActivityAt`.
- `apps/backend/src/modules/spaces/entities/zone-space.entity.ts` (new) — `@ChildEntity('zone')`.
- `apps/backend/src/modules/spaces/services/spaces-type-mapper.service.ts` (new).
- `apps/backend/src/modules/spaces/services/space-create-builder-registry.service.ts` (new).
- `apps/backend/src/modules/spaces/services/space-relations-loader-registry.service.ts` (new).
- `apps/backend/src/modules/spaces/services/spaces.service.ts` — route create/update through mapper.
- `apps/backend/src/modules/spaces/dto/create-space.dto.ts`, `update-space.dto.ts` — split into abstract base + `CreateRoomSpaceDto`, `CreateZoneSpaceDto`; register on `ExtendedDiscriminatorService`.
- `apps/backend/src/modules/spaces/spaces.module.ts` — register new services + child entities.

**Migration:** `apps/backend/src/migrations/1000000000003-SpacesPolymorphism.ts` — no DDL (type column already exists from initial migration); metadata-only.

### Phase 2 — Unified `SpaceRoleEntity` hierarchy

**Goal:** Collapse five role tables into one inheritance-rooted table so plugins can register new role types later without schema sprawl. Legacy tables stay populated alongside (shadow) for one release; Phase 7 drops them.

**Ordering note:** This phase is schema-heavy. Sequence the commits as (a) add new table + entity + service, with shadow-writes to both the new table AND the legacy tables; (b) switch reads to the new table; (c) stop writing to legacy tables (Phase 7). During (a) the old code keeps working.

**Legacy role entities to convert** (check each for domain-specific columns):
- `apps/backend/src/modules/spaces/entities/space-lighting-role.entity.ts` — composite PK `(spaceId, deviceId, channelId)`, columns `role: LightingRole`, `priority`.
- `apps/backend/src/modules/spaces/entities/space-climate-role.entity.ts` — composite PK same, columns `role: ClimateRole`, optional `channelId` (sensor roles are channel-level, actuators device-level).
- `apps/backend/src/modules/spaces/entities/space-covers-role.entity.ts` — composite PK same, `role: CoversRole`, `priority`.
- `apps/backend/src/modules/spaces/entities/space-sensor-role.entity.ts` — composite PK same, `role: SensorRole`, `priority`.
- `apps/backend/src/modules/spaces/entities/space-media-activity-binding.entity.ts` — own id, binding rules.
- `apps/backend/src/modules/spaces/entities/space-active-media-activity.entity.ts` — spaceId + current activity snapshot.

**New files:**
- `apps/backend/src/modules/spaces/entities/space-role.entity.ts` — abstract `@Entity('spaces_module_space_roles') @TableInheritance({column:{type:'varchar',name:'type'}}) export abstract class SpaceRoleEntity extends BaseEntity`. Common columns: `spaceId: string` (FK to `spaces_module_spaces.id`, onDelete: CASCADE), `deviceId: string | null`, `channelId: string | null`, `priority: number` (default 0), `role: string` (domain-specific enum value — stored as varchar). The abstract `get type(): string` getter throws per the polymorphism pattern.
- `apps/backend/src/modules/spaces/entities/*-role.entity.ts` — one `@ChildEntity('lighting' | 'climate' | 'covers' | 'sensor' | 'media_binding' | 'active_media')` per legacy table. Keep their `@ApiSchema('SpacesModuleDataXRole')` naming stable so OpenAPI clients don't regress. Override `get type()` to return the enum literal.
- `apps/backend/src/modules/spaces/services/space-roles-type-mapper.service.ts` — mirror `SpacesTypeMapperService`: `registerMapping({ type, class, createDto, updateDto })` / `getMapping(type)`. Register as provider + export in `SpacesModule`.

**Services that need `dataSource.getRepository(SubtypeClass)` migration:**
- `apps/backend/src/modules/spaces/services/space-lighting-role.service.ts`
- `apps/backend/src/modules/spaces/services/space-climate-role.service.ts`
- `apps/backend/src/modules/spaces/services/space-covers-role.service.ts`
- `apps/backend/src/modules/spaces/services/space-sensor-role.service.ts`
- `apps/backend/src/modules/spaces/services/space-media-activity-binding.service.ts`
- `apps/backend/src/modules/spaces/services/space-media-activity.service.ts`

Each is currently `@InjectRepository(SpaceXRoleEntity) private readonly repository: Repository<SpaceXRoleEntity>`. Swap to `@InjectRepository(SpaceRoleEntity) private readonly baseRepository: Repository<SpaceRoleEntity>` **plus** inject `SpaceRolesTypeMapperService` + `DataSource`, then each service resolves its own subtype repo via `dataSource.getRepository(RolesMapping.class)`. The base injection is only needed for cross-subtype queries (there shouldn't be any — use subtype repos everywhere).

**Controllers:** `apps/backend/src/modules/spaces/controllers/spaces.controller.ts` endpoints like `/spaces/{id}/lighting-roles`, `/climate-roles`, `/covers-roles`, `/sensor-roles`, `/media-activity-bindings` — request/response DTOs stay the same shape (don't rename outbound schema names). Internally they now call subtype-scoped services.

**Event types** (`spaces.constants.ts` `EventType` enum): keep the per-role event names (`LIGHT_TARGET_CREATED`, `CLIMATE_TARGET_UPDATED`, etc.). The unified table is an implementation detail — WebSocket consumers should not notice.

**Cascades & FKs:**
- Existing FKs: every role table's `spaceId` is `ON DELETE CASCADE` to `spaces_module_spaces.id`. The unified table must preserve this.
- `deviceId` FK goes to `devices_module_devices.id` with `ON DELETE CASCADE`.
- `channelId` FK goes to `devices_module_channels.id` with `ON DELETE CASCADE`; nullable.
- Migrate the unique constraints per subtype: lighting/climate/covers/sensor have `UNIQUE(spaceId, deviceId, channelId)`. With the unified table, change to `UNIQUE(spaceId, deviceId, channelId, type)` so different-subtype roles can coexist on the same channel.

**Migration:** `apps/backend/src/migrations/1000000000004-UnifyRoleTables.ts` (SQLite recreate-table pattern — follow the style already used for the initial migration's table recreations):
1. `CREATE TABLE spaces_module_space_roles` with union of columns: `id varchar PRIMARY KEY NOT NULL`, `createdAt datetime`, `updatedAt datetime`, `spaceId varchar NOT NULL`, `deviceId varchar`, `channelId varchar`, `role varchar NOT NULL`, `priority integer NOT NULL DEFAULT (0)`, `type varchar NOT NULL`, plus FK + `UNIQUE(spaceId, deviceId, channelId, type)` + index on `type`.
2. For each legacy table, run `INSERT INTO spaces_module_space_roles (...) SELECT ..., 'lighting' AS type FROM spaces_module_space_lighting_role;` (and the other four). Map `id` + timestamps + `spaceId` + `deviceId` + `channelId` + `role` + `priority`. For media-binding / active-media which have different column shapes, project their extra fields into `role` (JSON) or add per-type columns on the unified table — decide at implementation time after reading their current schemas.
3. **Do NOT drop the legacy tables** — keep them for the Phase 2 release cycle so a rollback is possible; Phase 7 drops them.

**Admin:**
- No admin-visible API change expected. The backend controllers' request/response schemas stay identical. Admin transformers (`apps/admin/src/modules/spaces/store/*transformers.ts`, one per role domain) should need zero edits — validate with `pnpm --filter @fastybird/smart-panel-admin type-check` after regenerating OpenAPI.

**Panel:** no Flutter change expected in this phase (role data still flows through the same `/spaces/{id}/lighting-state` etc. shapes).

**Tests:**
- Port each role service `*.spec.ts` to the new unified repository mock shape (a single shared base mock that returns rows filtered by the test-registered subtype). See the Phase 1b testing pattern for how to provide a `SpaceRolesTypeMapperService` test provider.
- New integration test: create one of each role type, verify all land in `spaces_module_space_roles` with correct discriminator; verify legacy tables still receive writes during the shadow phase (this test is deleted in Phase 7).
- Snapshot test for OpenAPI: no schema changes expected apart from any new `SpacesModuleDataSpaceRole*` shapes (keep or drop depending on whether base roles need a generic schema externally).

**Verification:**
- Run `pnpm generate:spec && pnpm generate:openapi && pnpm --filter ./apps/backend run lint:js && pnpm --filter ./apps/backend run lint:api && cd apps/backend && npx jest --testPathPatterns='spaces|displays|devices|scenes' && pnpm --filter @fastybird/smart-panel-admin type-check`.
- Exercise migration on a seeded DB snapshot: `pnpm run typeorm:migration:run`, then assert row counts — `SELECT COUNT(*) FROM spaces_module_space_roles` should equal sum of counts from the five legacy tables.

### Phase 3 — Create `spaces-home-control` plugin; relocate domain code

**Goal:** Move Room/Zone entities, all role entities, ~30 services, all domain controllers, intent catalog, suggestions, undo history from `modules/spaces/` into `plugins/spaces-home-control/`.

**Sub-phase split.** Phase 3 is the single largest refactor in this plan (~80 file moves, 60+ controller endpoints to split, admin + panel plugin trees). Following the Phase 1a/1b/1c/Phase 2 cadence of shipping each concern as its own PR, Phase 3 is broken into three ship-independent sub-phases. Each is prerequisite for Phase 4+ only once all three land, but 3b and 3c can be worked in parallel with each other once 3a is merged.

- **Phase 3a — Backend plugin extraction.** Create `apps/backend/src/plugins/spaces-home-control/` tree. Relocate Room/Zone + 6 role entities, all 30+ domain services, all domain listeners, intent spec loader + YAML catalog, domain validators, domain response models. Split `spaces.controller.ts`: core keeps generic CRUD + `children/parent/devices/displays`; the ~50 domain endpoints move to new plugin controllers (lighting/climate/covers/sensors/media/suggestions/undo). Register plugin in `app.module.ts` imports + `RouterModule.register` children under `PLUGINS_PREFIX`. Migration `1000000000005-SpacesHomeControlPlugin.ts` — no DDL; seeds plugin row in extensions table. Ship backend lint + unit + e2e green, OpenAPI regen with only namespace additions. **Admin and panel are NOT touched in 3a — admin keeps consuming `/spaces/{id}/lighting` etc. URLs via rename of the admin HTTP client base paths only if the URL prefix changes.** URL decision: preserve the existing `/api/v1/spaces/{id}/...` paths for the domain endpoints so admin + panel clients don't break during the 3a/3b window. Do this by keeping controller route on `spaces/:id/...` inside the plugin controllers (no `plugins/spaces-home-control/` prefix on these specific endpoints). The RouterModule entry is still registered so any FUTURE plugin-prefixed endpoints (e.g. internal diagnostics) work, but the domain endpoints intentionally keep their existing public paths. See "URL stability during sub-phases" below.
- **Phase 3b — Admin plugin.** Create `apps/admin/src/plugins/spaces-home-control/` with Room/Zone edit forms, roles panels, state tables, intent-catalog viewer, translations, Pinia store. Add `useSpacesPlugin({type})` composable mirroring `usePagesPlugin`. Convert `apps/admin/src/modules/spaces/views/view-space-edit.vue` into a shell that resolves plugin components via the composable. Register in `apps/admin/src/app.main.ts`. Admin type-check + vitest unit suites must stay green.
- **Phase 3c — Panel plugin.** Create `apps/panel/lib/plugins/spaces-home-control/` owning today's `modules/deck/presentation/system_pages/room_overview.dart`, `domain_pages/*`, `services/room_domain_classifier.dart`, `services/room_overview_model_builder.dart`, `models/lighting/*`. Register in `apps/panel/lib/modules/dashboard/module.dart:_registerPlugins()`. Does NOT yet wire `spaceViewBuilders` (that's Phase 5's `DisplayRole` removal) — for 3c the panel still routes through the existing `system_views_builder.dart` switch, but the widgets now live under the plugin directory.

**URL stability during sub-phases.** Phase 3a ships without admin/panel changes, so the existing HTTP surface (`/api/v1/spaces/{id}/lighting`, `/climate`, `/covers`, `/sensors`, `/intents/lighting`, `/suggestion`, `/undo`, `/media/*`, `/intents/catalog`, `/categories/templates`, `/propose`) must keep working byte-for-byte. Achieve this by keeping plugin controllers at `@Controller('spaces/:spaceId/lighting')` etc. (same paths as today — they just live inside the plugin module). Once admin + panel have migrated (post-3c or Phase 4), a future refactor can move these under `plugins/spaces-home-control/` if desired, but that's out of scope for Phase 3.

**Reference plugin to mirror:**
- `apps/backend/src/plugins/pages-cards/pages-cards.plugin.ts` — canonical template for `onModuleInit`: registers type mapping, relations loader, nested create builder, OpenAPI extras, discriminator, extension metadata, event-subscription handler.
- `apps/backend/src/plugins/pages-cards/pages-cards.constants.ts` — plugin constants (name, type string, route prefix, event-type enum).
- `apps/admin/src/plugins/pages-cards/pages-cards.plugin.ts` — admin template: registers routes, Pinia store, translations, `pluginsManager.addPlugin({elements:[{components, schemas}]})`, socket-event handlers.
- `apps/backend/src/app.module.ts:253-340` — `RouterModule.register` block showing where to mount the new plugin under `PLUGINS_PREFIX`.

**Route prefix constant:** add to plugin constants — `SPACES_HOME_CONTROL_PLUGIN_PREFIX = 'spaces-home-control'`. Per the URL-stability note above, the domain controllers (`spaces/:id/lighting`, etc.) keep their existing paths in Phase 3a; the RouterModule entry exists so plugin-prefixed endpoints work in future phases.

**New plugin tree:**
- `apps/backend/src/plugins/spaces-home-control/spaces-home-control.plugin.ts` — registers Room/Zone + five role mappings, discriminators, OpenAPI extras, extension metadata.
- `apps/backend/src/plugins/spaces-home-control/entities/` — Room/Zone + five role entities.
- `apps/backend/src/plugins/spaces-home-control/services/{lighting,climate,covers,sensors,media}/` — all 30+ domain services.
- `apps/backend/src/plugins/spaces-home-control/controllers/` — all domain endpoints (`/lighting-state`, `/climate-state`, `/covers-state`, `/sensor-state`, `/*-intent`, suggestions, undo, media-activity-bindings).
- `apps/backend/src/plugins/spaces-home-control/spec/` — intent catalog.

**Spaces core retains:** `SpacesService` (generic CRUD), mapper/registry services, seeder, reset, `space-activity.listener.ts` (listens for any space type), `websocket-exchange.listener.ts` (generic broadcast), controller with only `GET/POST/PATCH/DELETE /spaces`, `GET /spaces/:id/{children,parent,devices,displays}`, `POST /spaces/:id/assign`, `GET /zones`. Core also retains generic DTOs (`create-space.dto.ts`, `update-space.dto.ts`, `bulk-assign.dto.ts`, `status-widget.dto.ts`, `update-config.dto.ts`), generic response models (`SpaceResponseModel`, `SpacesResponseModel` — split off from the current monolithic `spaces-response.model.ts`), the `config.model.ts`, and `spaces.exceptions.ts` / `spaces.utils.ts`.

**Cross-module ripple (caller updates required in Phase 3a):**
- `apps/backend/src/modules/devices/entities/devices.entity.ts` — `roomId` FK stays (any space); the "must be room-type" validator moves into the plugin. If the plugin is uninstalled, the validator silently no-ops — a device can be assigned to any space type in that case (documented limitation).
- `apps/backend/src/modules/scenes/entities/scenes.entity.ts` — unchanged.
- `apps/backend/src/modules/intents/` — enum stays; handler registration moves to plugin.
- `apps/backend/src/app.module.ts` — register plugin in imports + `RouterModule`.
- `apps/backend/src/plugins/simulator/*` — currently imports several role services + `SpaceType` directly from `modules/spaces/services/*`. Update these imports to the new plugin location. Simulator now explicitly depends on `spaces-home-control` plugin being installed.
- `apps/backend/src/plugins/buddy-discord/*` and `apps/backend/src/plugins/buddy-telegram/*` — both currently import `SuggestionFeedback` enum from `modules/spaces/spaces.constants.ts`. The enum moves to the plugin's constants; either re-export it from the plugin and update these imports, OR keep `SuggestionFeedback` in core's `spaces.constants.ts` as a shared vocabulary (recommendation: keep in core — it's a tiny enum and decoupling buddy plugins from an optional home-control plugin is worth the minor taxonomic bleed).

**Constants split:** `apps/backend/src/modules/spaces/spaces.constants.ts` — keep `SpaceType` (polymorphism discriminator), `SpaceRoleType` (role discriminator), `MODULE_*` base event types (SPACE_CREATED/UPDATED/DELETED), and `SuggestionFeedback` (see above). Move domain event types (`LIGHT_TARGET_CREATED`, `CLIMATE_TARGET_UPDATED`, `COVERS_TARGET_*`, `SENSOR_TARGET_*`, `MEDIA_*`, `SUGGESTION_*`, `UNDO_*`), category templates, and the `RoomDomain` enum (if present) into the plugin's `spaces-home-control.constants.ts`.

**Response-model split:** `spaces-response.model.ts` today contains `SpaceResponseModel`, `SpacesResponseModel`, `IntentCatalogResponseModel`, `LightingStateDataModel`, `ClimateStateDataModel`, etc. Split into (a) `apps/backend/src/modules/spaces/models/spaces-response.model.ts` with just the generic two; (b) `apps/backend/src/plugins/spaces-home-control/models/*-response.model.ts` with the domain-specific state + intent-catalog models. Schema names stay identical (`SpacesModuleDataSpace`, `SpacesModuleDataLightingState`, etc.) so OpenAPI regen produces no diff in existing client types — verify with `pnpm generate:openapi` and `git diff spec/api/v1/openapi.json`.

**Migration:** `apps/backend/src/migrations/1000000000005-SpacesHomeControlPlugin.ts` — no DDL; seed plugin row in extensions table so admin shows it as installed on existing installs.

### Phase 4 — `spaces-synthetic-master` and `spaces-synthetic-entry` plugins

**Goal:** Two minimal plugins contributing new space types with no physical-space semantics. Each is a singleton per installation (exactly one master space, exactly one entry space).

**Depends on:** Phase 3 (`SpacesTypeMapperService` consumed from the plugin module; plugin registration glue in `app.module.ts`).

**Per-plugin backend layout** (mirrors Phase 3's template):
- `apps/backend/src/plugins/spaces-synthetic-master/spaces-synthetic-master.plugin.ts` — `onModuleInit`: `spacesTypeMapper.registerMapping({type:'master', class:MasterSpaceEntity, createDto:CreateMasterSpaceDto, updateDto:UpdateMasterSpaceDto})`; register OpenAPI extras via `SwaggerModelsRegistryService`; register discriminator mapping via `ExtendedDiscriminatorService`; register extension metadata via `ExtensionsService.registerPluginMetadata`; register factory-reset handler via `FactoryResetRegistryService`; register seeder via `SeedRegistryService` at a priority AFTER `SpacesModule`'s seeder (140 is clear — `SpacesModule` uses 120).
- `apps/backend/src/plugins/spaces-synthetic-master/spaces-synthetic-master.constants.ts` — `SPACES_SYNTHETIC_MASTER_PLUGIN_NAME = 'spaces-synthetic-master-plugin'`, `SPACES_SYNTHETIC_MASTER_TYPE = 'master'`, route prefix.
- `apps/backend/src/plugins/spaces-synthetic-master/entities/master-space.entity.ts` — `@ApiSchema({ name: 'SpacesSyntheticMasterPluginDataMasterSpace' }) @ChildEntity('master') export class MasterSpaceEntity extends SpaceEntity`. Optional subtype-specific columns: `layout: 'tiles' | 'rooms_grid'` (enum), `showWeather: boolean`, `weatherLocationId: string | null`. Override `get type()`.
- `apps/backend/src/plugins/spaces-synthetic-master/dto/{create,update}-master-space.dto.ts` — extend the base `CreateSpaceDto` / `UpdateSpaceDto` with the same type-literal pattern as `pages-cards`'s DTOs.
- `apps/backend/src/plugins/spaces-synthetic-master/services/master-seeder.service.ts` — on first run, insert a single master space with a well-known UUID (or any UUID persisted to `system_module_settings` under key `spaces.synthetic.master.id` for Phase 5 to reference). Idempotent: skip if a master space already exists.
- `apps/backend/src/plugins/spaces-synthetic-master/services/master-reset.service.ts` — delete then reseed on factory-reset.
- `apps/backend/src/plugins/spaces-synthetic-master/controllers/master.controller.ts` (optional) — `GET /plugins/spaces-synthetic-master/overview` returning aggregated whole-house state (list of all rooms + global stats). If the panel can derive everything from existing `/spaces` responses, skip this controller.
- `apps/backend/src/plugins/spaces-synthetic-master/spaces-synthetic-master.openapi.ts` — `SPACES_SYNTHETIC_MASTER_PLUGIN_SWAGGER_EXTRA_MODELS = [MasterSpaceEntity, CreateMasterSpaceDto, UpdateMasterSpaceDto, ...]`.

Mirror the same tree for `spaces-synthetic-entry` with `EntrySpaceEntity @ChildEntity('entry')`, columns like `securityMode: enum('armed_home'|'armed_away'|'disarmed')`, `showSecurityStatus: boolean`.

**Singleton enforcement:** in both services, `findAll()` returns the one row; `create()` is admin-only and validates no existing row; `delete()` is blocked (throw ApiValidationException — deleting a synthetic space leaves orphan displays). The seeder is the only "supported" way to produce the row.

**App module wiring** (`apps/backend/src/app.module.ts`): add `SpacesSyntheticMasterPlugin` and `SpacesSyntheticEntryPlugin` to the `imports` array; add `{path: SPACES_SYNTHETIC_MASTER_PLUGIN_PREFIX, module: SpacesSyntheticMasterPlugin}` (and entry equivalent) to the `RouterModule.register` children under `PLUGINS_PREFIX`.

**Admin plugins:**
- `apps/admin/src/plugins/spaces-synthetic-master/spaces-synthetic-master.plugin.ts` — install function registers routes (if any — synthetic spaces may only need an edit view, not a list view since there's one of each), Pinia store (even a thin one for config), translations, and `pluginsManager.addPlugin({elements:[{type:'master', components:{spaceEditForm:MasterSpaceEditForm}, schemas:{spaceSchema:MasterSpaceSchema}}], modules:[SPACES_MODULE_NAME], isCore:true})`.
- `apps/admin/src/plugins/spaces-synthetic-master/views/master-space-edit.vue` — edit form with layout picker, weather toggle, weather-location dropdown (reuse existing weather composable).
- Register in `apps/admin/src/app.main.ts` next to the other `app.use(*Plugin, pluginOptions)` lines.

**Panel plugins:**
- `apps/panel/lib/plugins/spaces-synthetic-master/` — Dart tree mirroring `apps/panel/lib/plugins/pages-cards/`.
- `apps/panel/lib/plugins/spaces-synthetic-master/mapper.dart` — `void registerSpacesSyntheticMasterPlugin() { spaceViewBuilders['master'] = MasterSpaceViewBuilder(); }`. (Assumes Phase 5 introduces `spaceViewBuilders`. If Phase 4 lands first, register into the existing `DisplayRole`-based switch temporarily — revisit.)
- Move existing `apps/panel/lib/modules/deck/presentation/system_pages/master_overview.dart` into the plugin directory.
- Register in `apps/panel/lib/modules/dashboard/module.dart:_registerPlugins()` next to the tiles/pages plugin registrations.

**Migration:** `apps/backend/src/migrations/1000000000006-SeedSyntheticSpaces.ts`. Two `INSERT ... WHERE NOT EXISTS (SELECT 1 FROM spaces_module_spaces WHERE type = 'master')` — and same for 'entry'. After each insert, persist the new UUID into `system_module_settings` under the two keys listed above so Phase 5's display backfill migration can look them up:
```sql
INSERT INTO system_module_settings(key, value) VALUES ('spaces.synthetic.master.id', '<uuid>');
```
If the plugins are not installed on a given deployment, the migration should be a no-op (guard with a check for plugin presence if one exists).

**Tests:**
- Integration test per plugin: seeder creates exactly one row; running the seeder twice produces no duplicate; delete endpoint is blocked.
- Snapshot test on OpenAPI after regen: verify `SpacesSyntheticMasterPluginDataMasterSpace` schema appears.

### Phase 5 — Remove `DisplayRole`; displays point only at a space

**Goal:** Collapse `DisplayEntity.role` into a single `spaceId` FK. The concrete space subtype (room / zone / master / entry / signage_*) decides what the panel renders. Replaces the panel's switch-on-`DisplayRole` with a plugin-dispatched `Map<String, SpaceViewBuilder> spaceViewBuilders`.

**Depends on:** Phase 4 (seeded master + entry synthetic space IDs must exist in `system_module_settings` before the backfill migration runs).

**Scope of disruption:** this is the widest-reaching phase. It touches backend entity + service + home-resolver + DTOs, admin edit-form + schemas + Pinia types, panel Flutter model + deck builder + view builder, OpenAPI client regen, Dart client regen. Budget for two review rounds.

**Backend files to modify:**
- `apps/backend/src/modules/displays/entities/displays.entity.ts`:
  - Delete `role: DisplayRole` column.
  - Rename `roomId: string | null` → `spaceId: string | null` (keep nullable — unassigned displays exist during provisioning).
  - Rename `room: SpaceEntity | null` relation → `space: SpaceEntity | null`; `@JoinColumn({ name: 'spaceId' })`.
  - Update `@ApiProperty` descriptions — no more "required for room role" language.
- `apps/backend/src/modules/displays/displays.constants.ts` — delete `DisplayRole` enum entirely. Keep `HomeMode` (orthogonal). Add `SPACE_VALIDATOR_REGISTRY` / `SPACE_HOME_PAGE_RESOLVER_REGISTRY` export constants if needed.
- `apps/backend/src/modules/displays/services/displays.service.ts`:
  - Delete `validateRoleRoomCombination`.
  - Add `validateSpaceSelection(spaceId)`: ensure the target space exists; optionally consult the new `SpaceSelectionValidatorRegistryService` so plugins can add per-type constraints (e.g., "this space type is singleton, can only be assigned to one display at a time" — useful for future signage-exclusive modes).
  - Replace `dtoInstance.room_id` / `display.roomId` references with `space_id` / `spaceId`.
- `apps/backend/src/modules/displays/services/home-resolution.service.ts`:
  - Inject new `SpaceHomePageResolverRegistryService`.
  - `AUTO_SPACE` branch: look up the display's `space`, then call `resolverRegistry.getResolverFor(space.type)?.resolve(space)` to get the home page (or `null` for read-only space types like signage).
  - Phase 3's `spaces-home-control` plugin registers the room/zone resolver (returns the space's dedicated page if any); Phase 6's signage plugin doesn't register a resolver at all (no page).
- `apps/backend/src/modules/displays/services/space-selection-validator-registry.service.ts` (new) — mirror the existing registry services pattern (register/getValidators).
- `apps/backend/src/modules/displays/services/space-home-page-resolver-registry.service.ts` (new) — same pattern; one resolver per space type.
- `apps/backend/src/modules/displays/dto/{create,update}-display.dto.ts`:
  - Remove `role` field.
  - Rename `room_id` → `space_id`.
  - Drop the `@ValidateIf` rules that enforced role→roomId compatibility.
- `apps/backend/src/modules/displays/controllers/displays.controller.ts` — no functional change beyond the renamed fields; `@ApiOperation` summaries may reference "room" — clean up.
- `apps/backend/src/modules/displays/displays.module.ts` — register the two new registry services as providers + exports so the home-control and signage plugins can inject them.
- `apps/backend/src/modules/displays/listeners/websocket-exchange.listener.ts` — update event payloads if they expose `role` / `roomId`.
- Any cross-module caller that reads `display.role` or `display.roomId` — grep and rename. Known: dashboard's `HomeResolutionService` reaches into display fields.

**Related backend — plugin hooks from earlier phases:**
- `spaces-home-control` plugin (from Phase 3) gains an `onModuleInit()` registration:
  ```typescript
  spaceHomePageResolverRegistry.register('room', roomHomePageResolver);
  spaceHomePageResolverRegistry.register('zone', zoneHomePageResolver);
  ```
  Where the resolver returns the space's dedicated dashboard page if any, else `null`. Implement alongside Phase 5 (co-location in this PR is fine).

**Admin files to modify:**
- `apps/admin/src/modules/displays/components/display-edit-form.vue`:
  - Remove the role `<el-radio-group>` and all `v-if="model.role === 'room'"` blocks (including the current `SpaceSelect filter="room"`).
  - Replace with a single "Space" picker that lists all spaces grouped by `space.type` (icon + translated type label), sourced from the spaces Pinia store.
  - If a plugin-admin `pluginsManager` is available for space types, use it to decorate each option with the plugin's icon/label.
- `apps/admin/src/modules/displays/store/displays.store.schemas.ts` — drop `role` from the Zod schema; rename `roomId` → `spaceId`. Regenerate OpenAPI types first so `SpacesModule*` refs update.
- `apps/admin/src/modules/displays/store/displays.store.types.ts` — remove `DisplayRole`; rename `roomId` → `spaceId`.
- `apps/admin/src/modules/displays/store/displays.transformers.ts` — drop role mapping; rename roomId→spaceId in both directions.
- `apps/admin/src/modules/displays/composables/useDisplayEditForm.ts` — remove role validation rules.
- `apps/admin/src/modules/displays/views/view-display.vue`, `view-display-edit.vue` — any role badge/label UI.
- Translations (`apps/admin/src/modules/displays/lang/en.ts` + others) — remove `role.*` keys; add/retain `space.*` keys.

**Panel files to modify:**
- `apps/panel/lib/modules/displays/models/display.dart` — remove `DisplayRole` enum + field; rename `roomId` → `spaceId`. Regenerate the mapper that builds `DisplayModel` from API response.
- `apps/panel/lib/modules/deck/services/system_views_builder.dart` — rewrite:
  ```dart
  // registered by each space-type panel plugin in its register() call
  final Map<String, SpaceViewBuilder> spaceViewBuilders = {};

  SystemViewsResult buildSystemViews(SystemViewsBuildInput input) {
    final builder = spaceViewBuilders[input.space.type];
    if (builder == null) return const SystemViewsResult.empty();
    return builder.build(input);
  }
  ```
  `SystemViewsBuildInput` changes signature: drop `DisplayRole role` and `String? roomId`; add `SpaceModel space`.
- `apps/panel/lib/modules/deck/services/deck_builder.dart` — fetch `SpaceModel` by `display.spaceId` (via `SpacesService`) before calling `buildSystemViews`.
- `apps/panel/lib/modules/deck/types/intent_type.dart` — intent origin strings. Existing: `'panel.system.room'`, `'panel.system.master'`, `'panel.system.entry'`. Recommendation: generic `'panel.space'` origin + `spaceType` metadata field. Less churn for existing intent consumers; future signage spaces inherit automatically.
- `apps/panel/lib/plugins/spaces-home-control/` (from Phase 3) gains:
  ```dart
  void registerSpacesHomeControlPlugin() {
    spaceViewBuilders['room'] = RoomSpaceViewBuilder();
    spaceViewBuilders['zone'] = ZoneSpaceViewBuilder();
  }
  ```
  Moving existing `apps/panel/lib/modules/deck/presentation/system_pages/room_overview.dart` + `modules/deck/presentation/domain_pages/*` into the plugin directory is part of Phase 3; wiring them behind the new dispatch happens here.
- `apps/panel/lib/plugins/spaces-synthetic-master/` (from Phase 4) — same pattern, `spaceViewBuilders['master'] = MasterSpaceViewBuilder()`.
- `apps/panel/lib/plugins/spaces-synthetic-entry/` — `spaceViewBuilders['entry'] = EntrySpaceViewBuilder()`.
- Panel initialization: `apps/panel/lib/modules/dashboard/module.dart:_registerPlugins()` already calls the plugin registrations — confirm the new space-type plugins are in the list.

**Migration:** `apps/backend/src/migrations/1000000000007-DisplaysSpaceOnly.ts`. SQLite does not support `ALTER TABLE ... DROP COLUMN` reliably; use the recreate-table pattern (mirror the way the initial migration recreates `displays_module_displays`):
1. `ALTER TABLE displays_module_displays ADD COLUMN spaceId varchar(36) NULL`.
2. Backfill:
   ```sql
   UPDATE displays_module_displays SET spaceId = roomId WHERE role = 'room';
   UPDATE displays_module_displays SET spaceId = (SELECT value FROM system_module_settings WHERE key = 'spaces.synthetic.master.id') WHERE role = 'master';
   UPDATE displays_module_displays SET spaceId = (SELECT value FROM system_module_settings WHERE key = 'spaces.synthetic.entry.id') WHERE role = 'entry';
   ```
3. Verify no rows have `spaceId IS NULL` except those that were unassigned pre-migration: `SELECT COUNT(*) FROM displays_module_displays WHERE spaceId IS NULL AND role != 'room'` should be 0; log + fail the migration if not.
4. Recreate the table without `role` and `roomId` columns (via `CREATE TABLE temporary_displays_module_displays (... spaceId varchar, ... FK to spaces_module_spaces.id ...); INSERT INTO temporary_... SELECT ...; DROP TABLE displays_module_displays; ALTER TABLE temporary_... RENAME TO displays_module_displays;`). Re-create indexes, including the new `IDX_*_spaceId`.
5. Drop the old `IDX_*_roomId` index.

**Regenerate:** `pnpm generate:spec && pnpm generate:openapi && melos rebuild-all`. Expect `openapi.json` diff: `role` removed from display schemas, `room_id` renamed to `space_id`, `home_mode: auto_space` no longer implies room. Expect Dart client: `DisplayModel.role` and `DisplayModel.roomId` removed.

**Tests:**
- `apps/backend/src/modules/displays/services/displays.service.spec.ts` — replace `role`/`room_id` references. Remove tests that assert the old role/roomId validation. Add tests for `validateSpaceSelection` (valid, missing space, plugin validator rejection).
- `apps/backend/src/modules/displays/services/home-resolution.service.spec.ts` — tests for resolver-registry dispatch (room-type resolver found + returns page; signage-type has no resolver + returns null fallback).
- `apps/backend/src/modules/displays/controllers/displays.controller.spec.ts` — update request/response DTO shapes.
- Panel unit tests: `buildSystemViews` returns `RoomSpaceViewBuilder` output for type=room, `MasterSpaceViewBuilder` for type=master, empty for an unregistered type.
- E2E smoke (manual): boot panel against a pre-migration snapshot; displays previously `role=room` render room overview; displays previously `role=master` render master overview via new path.

**Verification pipeline:**
```
pnpm generate:spec && pnpm generate:openapi
pnpm --filter ./apps/backend run lint:js && pnpm --filter ./apps/backend run lint:api
cd apps/backend && npx jest --testPathPatterns='displays|spaces'
pnpm --filter @fastybird/smart-panel-admin type-check
pnpm --filter @fastybird/smart-panel-admin run test:unit
melos rebuild-all && melos analyze
```

### Phase 6 — Ship `spaces-signage-info-panel` plugin

**Goal:** First signage space type — read-only, full-screen, "information panel" layout with configurable sections (clock, weather, announcements, optional feed). No dynamic slideshow, no video, no intents.

**Depends on:** Phase 3 (plugin-registration infrastructure + `SpacesTypeMapperService`), Phase 5 (panel's `spaceViewBuilders` dispatch — a signage space can't be assigned to a display without `DisplayRole` being gone). Phase 6 can land in parallel with Phase 4 since they touch disjoint plugin trees.

**Plugin tree** (mirror of `apps/backend/src/plugins/pages-cards/` structure):

**Backend:**
- `apps/backend/src/plugins/spaces-signage-info-panel/spaces-signage-info-panel.plugin.ts` — `@Module` with `TypeOrmModule.forFeature([SignageInfoPanelSpaceEntity, SignageAnnouncementEntity])`, imports `SpacesModule` + `DashboardModule` (for the home-page-resolver registry — see below). `onModuleInit`:
  - `spacesTypeMapper.registerMapping({ type: 'signage_info_panel', class: SignageInfoPanelSpaceEntity, createDto: CreateSignageInfoPanelSpaceDto, updateDto: UpdateSignageInfoPanelSpaceDto })`.
  - Register announcement create-builder on `SpaceCreateBuilderRegistryService` if signage spaces should be creatable with a seed announcement list in one call; otherwise leave announcements as a separate nested CRUD.
  - Register a "null home page" resolver on `SpaceHomePageResolverRegistryService` for type `'signage_info_panel'` — returns `null` so the home-resolution service knows signage has no Page.
  - Register OpenAPI extras (`SPACES_SIGNAGE_INFO_PANEL_PLUGIN_SWAGGER_EXTRA_MODELS`), discriminator mappings, extension metadata, factory-reset handler.
- `apps/backend/src/plugins/spaces-signage-info-panel/spaces-signage-info-panel.constants.ts` — `SPACES_SIGNAGE_INFO_PANEL_PLUGIN_NAME`, `SPACES_SIGNAGE_INFO_PANEL_TYPE = 'signage_info_panel'`, `SPACES_SIGNAGE_INFO_PANEL_PLUGIN_PREFIX`, plus an `EventType` enum (`ANNOUNCEMENT_CREATED`, `ANNOUNCEMENT_UPDATED`, `ANNOUNCEMENT_DELETED`, `SIGNAGE_SPACE_CREATED`).
- `apps/backend/src/plugins/spaces-signage-info-panel/entities/signage-info-panel-space.entity.ts`:
  ```typescript
  @ApiSchema({ name: 'SpacesSignageInfoPanelPluginDataSignageInfoPanelSpace' })
  @ChildEntity(SPACES_SIGNAGE_INFO_PANEL_TYPE)
  export class SignageInfoPanelSpaceEntity extends SpaceEntity { ... }
  ```
  Columns (all on the existing `spaces_module_spaces` table via TableInheritance — SQLite allows nullable per-subtype columns): `layout: 'clock_weather' | 'clock_weather_announcements' | 'full'` (varchar with check constraint if TypeORM supports it, else app-level), `showClock: boolean`, `showWeather: boolean`, `showAnnouncements: boolean`, `showFeed: boolean`, `weatherLocationId: string | null` (FK to `weather_module_locations.id`, `ON DELETE SET NULL`), `feedUrl: string | null`. Override `get type() { return SPACES_SIGNAGE_INFO_PANEL_TYPE; }`.
- `apps/backend/src/plugins/spaces-signage-info-panel/entities/signage-announcement.entity.ts`:
  ```typescript
  @ApiSchema({ name: 'SpacesSignageInfoPanelPluginDataAnnouncement' })
  @Entity('signage_info_panel_announcements')
  export class SignageAnnouncementEntity extends BaseEntity { ... }
  ```
  Columns: `spaceId: string` (FK to `spaces_module_spaces.id`, `ON DELETE CASCADE`, indexed), `order: number` (int, default 0, indexed), `title: string`, `body: string | null`, `icon: string | null`, `activeFrom: Date | null`, `activeUntil: Date | null`, `priority: number` (default 0).
- `apps/backend/src/plugins/spaces-signage-info-panel/dto/{create,update}-signage-info-panel-space.dto.ts` — extend the base `CreateSpaceDto` / `UpdateSpaceDto`; include `type: typeof SPACES_SIGNAGE_INFO_PANEL_TYPE` literal + all subtype columns above.
- `apps/backend/src/plugins/spaces-signage-info-panel/dto/{create,update}-announcement.dto.ts` — CRUD DTOs for nested announcements.
- `apps/backend/src/plugins/spaces-signage-info-panel/services/announcements.service.ts` — standard CRUD, emit events, publish WebSocket updates so panels refresh without polling.
- `apps/backend/src/plugins/spaces-signage-info-panel/services/signage-info-panel-reset.service.ts` — on factory-reset, delete plugin-owned announcements + signage spaces (leaves physical room/zone spaces alone).
- `apps/backend/src/plugins/spaces-signage-info-panel/controllers/announcements.controller.ts`:
  - `GET /plugins/spaces-signage-info-panel/spaces/{spaceId}/announcements` — list.
  - `POST /plugins/spaces-signage-info-panel/spaces/{spaceId}/announcements` — create.
  - `PATCH /plugins/spaces-signage-info-panel/spaces/{spaceId}/announcements/{id}` — update.
  - `DELETE /plugins/spaces-signage-info-panel/spaces/{spaceId}/announcements/{id}` — delete.
  - `POST /plugins/spaces-signage-info-panel/spaces/{spaceId}/announcements/reorder` — bulk reorder.
- `apps/backend/src/plugins/spaces-signage-info-panel/spaces-signage-info-panel.openapi.ts` — list of extra models for `SwaggerModelsRegistryService`.
- `apps/backend/src/plugins/spaces-signage-info-panel/listeners/websocket-exchange.listener.ts` — emit `AnnouncementCreated/Updated/Deleted` events to all subscribers of the signage space.

**App module wiring** (`apps/backend/src/app.module.ts`): add to imports + `RouterModule.register` children under `PLUGINS_PREFIX`.

**Admin plugin:**
- `apps/admin/src/plugins/spaces-signage-info-panel/spaces-signage-info-panel.plugin.ts` — install function: routes, Pinia store (announcements + signage-space config), translations, socket-event handlers, `pluginsManager.addPlugin({ type, elements: [{type, components: { spaceAddForm: InfoPanelSpaceAddForm, spaceEditForm: InfoPanelSpaceEditForm }, schemas: { ... } }], modules: [SPACES_MODULE_NAME], isCore: true })`.
- `apps/admin/src/plugins/spaces-signage-info-panel/views/info-panel-space-edit.vue` — two-column layout: left = section toggles (clock/weather/announcements/feed) + weather location picker (reuse existing `<weather-location-select>`) + feed URL input; right = announcements list editor with drag-reorder, add/edit/delete, optional schedule (active from/until pickers), priority.
- `apps/admin/src/plugins/spaces-signage-info-panel/components/announcements-table.vue` — the drag-reorder table.
- `apps/admin/src/plugins/spaces-signage-info-panel/store/announcements.store.ts` — Pinia store for announcement CRUD; subscribe to socket events to stay in sync.
- `apps/admin/src/plugins/spaces-signage-info-panel/schemas/` — Zod schemas for forms.
- Register in `apps/admin/src/app.main.ts`.

**Panel plugin (Flutter):**
- `apps/panel/lib/plugins/spaces-signage-info-panel/` — Dart tree mirroring `apps/panel/lib/plugins/pages-cards/` structure.
- `apps/panel/lib/plugins/spaces-signage-info-panel/mapper.dart`:
  ```dart
  const String spacesSignageInfoPanelType = 'signage_info_panel';

  void registerSpacesSignageInfoPanelPlugin() {
    spaceModelMappers[spacesSignageInfoPanelType] = (data) => InfoPanelSpaceModel.fromJson(data);
    spaceViewBuilders[spacesSignageInfoPanelType] = InfoPanelViewBuilder();
  }
  ```
- `apps/panel/lib/plugins/spaces-signage-info-panel/models/info_panel_space.dart` — `InfoPanelSpaceModel extends SpaceModel`. Fields match backend subtype columns.
- `apps/panel/lib/plugins/spaces-signage-info-panel/models/announcement.dart` — `Announcement { id, order, title, body, icon, activeFrom, activeUntil, priority }`.
- `apps/panel/lib/plugins/spaces-signage-info-panel/services/announcements_service.dart` — fetches announcements over REST, subscribes to WebSocket events, exposes a `ValueListenable<List<Announcement>>` filtered by `active*` window.
- `apps/panel/lib/plugins/spaces-signage-info-panel/views/info_panel_view_item.dart` — new `DeckItem` subtype. No top bar, no bottom navigation, no inactivity overlay (or explicit opt-out).
- `apps/panel/lib/plugins/spaces-signage-info-panel/views/info_panel_view.dart` — full-screen layout:
  - Clock section (reuse `apps/panel/lib/core/widgets/clock.dart` if present; otherwise a simple formatted `DateTime.now()` with a `Timer.periodic(1 minute)` refresher).
  - Weather section (reuse `WeatherService` for the weatherLocationId — sun/cloud/temperature).
  - Announcements section (list of active-window announcements, sorted by `priority` then `order`; rotate every N seconds if more than fit on-screen).
  - Feed section (optional iframe/webview of `feedUrl` — use `webview_flutter` if already in dependencies, else defer).
- Widget test: verify active-window filtering; verify the announcement ValueListenable rebuilds on WebSocket event.
- Register in `apps/panel/lib/modules/dashboard/module.dart:_registerPlugins()`.

**Migration:** `apps/backend/src/migrations/1000000000008-SignageInfoPanel.ts`:
```sql
CREATE TABLE signage_info_panel_announcements (
  id varchar PRIMARY KEY NOT NULL,
  createdAt datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updatedAt datetime,
  spaceId varchar NOT NULL,
  "order" integer NOT NULL DEFAULT (0),
  title varchar NOT NULL,
  body varchar,
  icon varchar,
  activeFrom datetime,
  activeUntil datetime,
  priority integer NOT NULL DEFAULT (0),
  CONSTRAINT FK_announcement_space FOREIGN KEY (spaceId) REFERENCES spaces_module_spaces(id) ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX IDX_announcement_spaceId ON signage_info_panel_announcements(spaceId);
CREATE INDEX IDX_announcement_order ON signage_info_panel_announcements("order");
```
Signage subtype columns on `spaces_module_spaces` (layout, showClock, …, feedUrl, weatherLocationId) are added via SQLite's recreate-table pattern — follow the same pattern the initial migration uses for `spaces_module_spaces` redefinitions. All new columns are nullable so existing room/zone rows unchanged.

**Tests:**
- Backend: CRUD an info-panel space with 3 announcements; verify `DELETE` on the space cascades announcements; verify the home-page resolver registers with null result; verify the factory-reset handler cleans up only plugin-owned rows.
- Admin e2e (Vitest + Testing Library): create an info-panel space, toggle sections, add an announcement, verify the transformer roundtrip.
- Panel widget tests: `InfoPanelView` renders each configured section; announcement rotation timer advances; inactive-window announcements are filtered out.
- End-to-end smoke: backend + admin + panel running against a fresh DB. Create an info-panel space in admin, add one announcement, assign a display to it, verify the panel renders the full-screen layout with no chrome and the announcement visible.

**Verification pipeline:** identical to Phase 5, plus `pnpm --filter @fastybird/smart-panel-admin run test:unit` must include the new plugin's specs.

### Phase 7 — Cleanup: drop shadow tables

**Goal:** Remove legacy per-domain role tables after at least one release has shipped with Phase 2's dual-write. At this point the unified `spaces_module_space_roles` table is the source of truth and nothing reads from the legacy copies.

**Prerequisites before starting:**
- At least one full alpha release has shipped with Phase 2's dual-write in place.
- All role services read exclusively from `spaces_module_space_roles` via subtype repositories (verify by grepping for `SpaceLightingRoleEntity.repository`, `SpaceClimateRoleEntity.repository`, etc. — all call sites should now hit the unified class).
- Phase 2's integration test that verifies shadow-writes still land in legacy tables is deleted in this phase.

**Migration:** `apps/backend/src/migrations/1000000000009-DropLegacyRoleTables.ts`:
```sql
DROP TABLE spaces_module_space_lighting_role;
DROP TABLE spaces_module_space_climate_role;
DROP TABLE spaces_module_space_covers_role;
DROP TABLE spaces_module_space_sensor_role;
DROP TABLE spaces_module_space_media_activity_binding;
DROP TABLE spaces_module_space_active_media_activity;
```

**Files to touch:**
- Remove any remaining "write to both new + legacy" fan-out in the role services (if Phase 2's dual-write was left in for safety).
- Remove obsolete legacy-entity exports from `spaces.constants.ts` and any index/barrel file that still re-exports them.
- Delete any `*.legacy.spec.ts` or shadow-table assertions.

**Tests:** snapshot of the DB schema — no `spaces_module_space_*_role` tables remain; only `spaces_module_space_roles`. Run `pnpm run typeorm:migration:run` against a pre-Phase-7 snapshot to verify the drop succeeds with no FK violations.

## Conventions used by this plan

For any agent picking up a future phase — these are the mechanical conventions Phase 1 established. Follow them exactly.

- **Commit messages:** `<type>(<scope>): <subject>` with a single `<type>` from `feat|fix|refactor|docs|test|chore`. The PR's commits use `(backend/spaces)`, `(backend/spaces/services)`, etc. Include "Phase N…" in the body when relevant. No `Co-Authored-By: Claude` line (the PR already has the `claude.ai/code/session_*` footer from the original PR body).
- **Branch naming:** continue on `claude/add-readonly-mode-pMcCa` for follow-ups to PR #578. For a new top-level phase PR, open a sibling `claude/phase-<N>-<slug>` branch targeting main.
- **Migration numbering:** monotonically increasing. Latest committed is `1000000000002-AddTokenLastUsedAt.ts`; Phase 2 claims `1000000000003` (no Phase 1 migration was actually needed — the plan originally reserved it, but the `type` column already existed).
- **OpenAPI / client regen:** any change that alters `@Entity` / `@ApiProperty` / DTO shape requires `pnpm generate:spec && pnpm generate:openapi`; panel changes require `melos rebuild-all`. Run these BEFORE pushing — the CI setup step also regenerates, but local mismatch can hide type-check regressions.
- **Plugin discriminator strings:** match the SpaceType enum values already in the database (`'room'`, `'zone'`) for the home-control plugin subtypes; use fresh strings (`'master'`, `'entry'`, `'signage_info_panel'`) for plugin-owned types. Always pass the string explicitly to `@ChildEntity('string')`.
- **Review-feedback policy:** Low-severity Bugbot suggestions that ask for "defer", "move to shared", or "unused infrastructure" on Phase 1a scaffolding are intentional and have been replied to on the PR — don't undo them. High/Medium Bugbot comments on real data-integrity / code-correctness bugs should always be addressed in a follow-up commit.

## Phase dependencies

```
Phase 1a (registries)
    └─▶ Phase 1b (polymorphic SpaceEntity)
            └─▶ Phase 1c wiring (PR #579)
                    └─▶ Phase 2 (unified SpaceRoleEntity)
                            └─▶ Phase 3a (backend home-control plugin)
                                    ├─▶ Phase 3b (admin home-control plugin)
                                    ├─▶ Phase 3c (panel home-control plugin)
                                    └─▶ (3b and 3c can ship in parallel after 3a merges)
                            └─▶ [all of 3a+3b+3c merged] ─▶ Phase 4 (synthetic master/entry)
                                    └─▶ Phase 5 (DisplayRole removal)
                                            └─▶ Phase 6 (info-panel signage)
                                                    └─▶ Phase 7 (drop legacy tables, after one release)
```

Phase 3a is prerequisite for 3b and 3c. Phase 4 requires all of 3a+3b+3c landed because the synthetic master/entry plugins need the admin/panel plugin-registration infrastructure shipped by 3b/3c (they mirror that tree). Phase 4 blocks Phase 5 because the display-role-backfill migration in Phase 5 needs the synthetic space IDs seeded by Phase 4's migration. Phase 6 can run in parallel with Phase 4 once Phase 3 is fully in — they touch disjoint plugin directories.

## Critical Files

Primary refactor surface:
- `apps/backend/src/modules/spaces/entities/space.entity.ts`
- `apps/backend/src/modules/spaces/services/spaces.service.ts`
- `apps/backend/src/modules/spaces/controllers/spaces.controller.ts`
- `apps/backend/src/modules/spaces/spaces.module.ts`
- `apps/backend/src/modules/displays/entities/displays.entity.ts`
- `apps/backend/src/modules/displays/services/{displays,home-resolution}.service.ts`
- `apps/backend/src/modules/displays/displays.constants.ts`
- `apps/backend/src/modules/devices/entities/devices.entity.ts` (validator relocation only)
- `apps/backend/src/app.module.ts`
- `apps/admin/src/modules/displays/components/display-edit-form.vue`
- `apps/admin/src/modules/spaces/views/view-space-edit.vue`
- `apps/panel/lib/modules/deck/services/system_views_builder.dart`
- `apps/panel/lib/modules/deck/services/deck_builder.dart`
- `apps/panel/lib/modules/displays/models/display.dart`

## Verification

Per phase (must pass before moving to the next):
- **Backend unit + e2e:** `pnpm run test:unit` and `pnpm run test:e2e`. Phases 1–3 must show no regression in space/role/intent spec suites — those tests port in place.
- **Admin unit:** `pnpm --filter ./apps/admin run test:unit`.
- **Type check + lint:** `pnpm run lint:js`.
- **OpenAPI regen:** `pnpm run generate:openapi`. After Phase 3, diff should show only plugin-namespace additions + event-name namespacing; no schema breakage. After Phase 5, diff should show `role` removed and `room_id → space_id` on display schemas.
- **Flutter regen:** `melos rebuild-all` then `melos analyze`.
- **Migration correctness:** run `pnpm run typeorm:migration:run` on a seeded alpha DB snapshot; verify (a) row counts preserved, (b) `spaces_module_space_roles` has sum of legacy row counts after Phase 2, (c) displays previously `role=master|entry` resolve to synthetic space IDs after Phase 5.

End-to-end smoke per milestone:
- **After Phase 5:** boot panel against backend with existing data; displays that were `role=room` still render room overview; displays that were `role=master` render master overview via new path.
- **After Phase 6:** create an info-panel signage space in admin, add an announcement, assign a display, verify panel renders full-screen info layout with announcement visible and no navigation chrome.

## Out of Scope

- Reworking Dashboard (pages/tiles) — reference pattern, not target.
- Additional signage plugins (slideshow, dashboard-kiosk, video-wall, media-loop) — trivial once the contract is proved by info-panel.
- Moving `IntentType` enum into a plugin registry — stays in core as shared vocabulary.
- Changes to Devices categorization, properties, or channel model.
- Per-display granular plugin enablement (`Display.allowedSpaceTypes`) — add later if needed.
- Scene-execution gating by space type.
- WebSocket envelope changes (only event-name namespaces shift).
- Internationalization of new plugin strings beyond existing locales.
