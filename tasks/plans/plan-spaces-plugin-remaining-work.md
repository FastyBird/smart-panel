# Spaces Plugin System — Remaining Work

**Parent plan:** `tasks/plans/plan-spaces-plugin-system-signage.md`
**Status as of 2026-04-24:** the seven-phase rollout has merged PRs for every phase, but several items are still open. This doc is the actionable punch list, scoped per remaining item, so a follow-up agent can pick up without re-reading the full 660-line parent plan.

---

## Executive summary

Already shipped (see parent plan's "Progress" section):

- ✅ Phases 1a / 1b / 1c — polymorphic `SpaceEntity`, registries, wiring.
- ✅ Phase 2 — unified `SpaceRoleEntity`.
- ✅ Phase 3a backend extraction — Phase 3a of the parent plan has now landed most of steps 1-9 on `claude/add-readonly-mode-pMcCa` (intent spec, 6 role entities, Room/Zone entities, DTOs + validators, state listeners, bulk domain-services relocation, controller split, response-model split, media-model relocation).
- ✅ Phase 3c panel plugin — `apps/panel/lib/plugins/spaces-home-control/` owns services, presentation, models.
- ✅ Phase 4 — synthetic master/entry plugins.
- ✅ Phase 5 — `DisplayRole` removal, `spaceViewBuilders` dispatch.
- ✅ Phase 6 — signage info-panel plugin.
- ✅ Phase 7 — legacy per-domain role tables dropped.

Outstanding:

- 🟡 Phase 3a finishing touches (constants split, seed migration, final sweep).
- 🟡 Phase 3b — admin code relocation. The `plugins/spaces-home-control/components/components.ts` barrel still re-exports from `modules/spaces/components/`; all 67 Vue components + 20+ composables still live in core.
- 🟡 Panel CI currently red on `claude/add-readonly-mode-pMcCa` — Dart analyze + tests failing after Phase 3a's schema churn. Owner: whoever drove the backend relocation.
- 🟡 Small follow-ups (listed at the end).

---

## 1. Phase 3a finishing (backend) — SMALL

Pick up the last few steps of the parent plan's "Phase 3a incremental commit roadmap."

### 1.1 Constants split (step 10)

**File:** `apps/backend/src/modules/spaces/spaces.constants.ts`.

Move domain event types (`LIGHT_TARGET_*`, `CLIMATE_TARGET_*`, `COVERS_TARGET_*`, `SENSOR_TARGET_*`, `MEDIA_*`, `SUGGESTION_*`, `UNDO_*`), category templates, and `RoomDomain` (if present) into `apps/backend/src/plugins/spaces-home-control/spaces-home-control.constants.ts`.

Keep in core: `SpaceType`, `SpaceRoleType`, `SPACE_CREATED / UPDATED / DELETED`, `SuggestionFeedback` (it's imported by `buddy-discord` / `buddy-telegram` — keeping it in core decouples those plugins from an optional home-control install).

After the move, update every importer. Run `pnpm generate:spec && pnpm generate:openapi` and verify `git diff spec/api/v1/openapi.json` is empty.

### 1.2 Cross-plugin importer fixups (step 11)

- `apps/backend/src/plugins/simulator/*` still imports several role services and `SpaceType` directly from `modules/spaces/services/*`. Redirect to the new plugin paths. Simulator now explicitly depends on `spaces-home-control` being installed — document the limitation.
- `apps/backend/src/plugins/buddy-discord/*` and `apps/backend/src/plugins/buddy-telegram/*` import `SuggestionFeedback` from `modules/spaces/spaces.constants.ts`. If step 1.1 moved the enum into the plugin, either re-export from core or keep the enum in core (the recommendation in the parent plan is to keep it in core — less taxonomic churn).

### 1.3 Seed migration (step 12)

**New file:** `apps/backend/src/migrations/1000000000007-SpacesHomeControlPlugin.ts`.

No DDL. Seed the plugin row in the extensions table so existing installs show the plugin as installed after upgrade:

```typescript
await queryRunner.query(
    `INSERT OR IGNORE INTO extensions_module_extensions (type, kind, enabled)
     VALUES ('spaces-home-control-plugin', 'plugin', 1)`,
);
```

`down()` deletes the row.

### 1.4 Final sweep (step 13)

- Remove now-empty directories under `modules/spaces/` (none expected after steps 1-12 land; audit and delete any).
- Verify `SpacesModule` providers + exports list is minimal. Per the parent plan, core keeps: `SpacesService`, `SpacesTypeMapperService`, `SpaceRolesTypeMapperService`, `SpaceCreateBuilderRegistryService`, `SpaceRelationsLoaderRegistryService`, `ModuleResetService`.
- Run the full verification pipeline:
  ```bash
  pnpm generate:spec && pnpm generate:openapi
  pnpm --filter ./apps/backend run lint:js
  pnpm --filter ./apps/backend run lint:api
  cd apps/backend && npx jest
  pnpm --filter @fastybird/smart-panel-admin type-check
  pnpm --filter @fastybird/smart-panel-admin run test:unit
  melos analyze   # Dart (if available)
  ```
  `git diff spec/api/v1/openapi.json` MUST be empty after this runs — every change above is internal relocation and public schemas are preserved.

**Acceptance criteria:**

- [ ] All of `modules/spaces/constants.ts`'s domain event types live in `plugins/spaces-home-control/spaces-home-control.constants.ts`.
- [ ] Simulator + buddy plugins import from the new plugin paths (or from core if `SuggestionFeedback` stayed).
- [ ] Migration `1000000000007` applies cleanly on a fresh DB and an upgrade from the previous migration.
- [ ] OpenAPI regen produces no diff.
- [ ] Backend Jest + admin Vitest + admin type-check all green.

---

## 2. Phase 3b — Admin code relocation — MEDIUM/LARGE

Mirror 3a on the admin side. `apps/admin/src/plugins/spaces-home-control/components/components.ts` is currently a single re-export barrel:

```typescript
export { SpaceAddForm, SpaceDetail, SpaceEditForm } from '../../../modules/spaces/components/components';
```

All 67 Vue components and 20+ composables still live in `apps/admin/src/modules/spaces/`. The plugin dispatch via `useSpacesPlugins` works because home-control's registered elements resolve to the re-exported components — but the plugin system hasn't absorbed the code it's supposed to own.

### 2.1 Components to move

**Source:** `apps/admin/src/modules/spaces/components/`.

Move to `apps/admin/src/plugins/spaces-home-control/components/`:

- `space-detail.vue` + `.types.ts` (Room/Zone detail view)
- `space-add-form.vue` + `.types.ts` (generic Room/Zone add form — already dispatched via picker)
- `space-edit-form.vue` + `.types.ts` (generic Room/Zone edit form)
- `space-edit-summary-section.vue`
- `space-parent-zone-section.vue`
- `space-domains-section.vue`, `space-domain-card.vue`
- `space-devices-section.vue`, `space-displays-section.vue`, `space-scenes-section.vue`
- `space-lighting-roles{,-dialog,-summary}.vue` — lighting domain
- `space-climate-roles{,-dialog,-summary}.vue` — climate domain
- `space-covers-roles{,-dialog,-summary}.vue` — covers domain
- `space-sensor-roles{,-dialog,-summary}.vue` — sensor domain
- `space-media-activities-{dialog,summary}.vue` — media domain
- `space-add-device-dialog.vue`, `space-add-display-dialog.vue`, `space-add-scene-dialog.vue` — wizards tied to home-control

Keep in core (`modules/spaces/components/`):

- `space-select.vue` — generic picker consumed by displays / scenes / anywhere that takes a space ID
- `select-space-plugin.vue` — the add-form type picker (Phase 2 addition)
- `spaces-table.vue`, `spaces-list.vue`, `spaces-cards.vue`, `spaces-filter.vue`, `list-spaces{,-adjust}.vue` — generic list views

### 2.2 Composables to move

**Source:** `apps/admin/src/modules/spaces/composables/`.

Move to `apps/admin/src/plugins/spaces-home-control/composables/`:

- `useSpaceLightingState`, `useSpaceClimateState`, `useSpaceCoversState`, `useSpaceSensorState` — per-domain state queries
- `useSpaceIntents` — intent catalog consumer
- `useSpaceMedia` — media activity binding / activation
- `useSpaceScenes` — scene integration (spaces → scenes filter)
- `useSpaceSuggestion`, `useSpaceUndo` — domain-specific
- `useSpaceLightingTool`, etc. if any

Keep in core:

- `useSpace`, `useSpaces`, `useSpacesDataSource`, `useSpacesRefreshSignals`, `useSpacesActions`, `useSpacesOnboarding` — generic space CRUD / list / lifecycle
- `useSpaceAddForm`, `useSpaceEditForm`, `useSpaceCategories` — generic form bindings
- `useSpacesPlugins` — plugin host composable itself
- `useSpaceDevices`, `useSpaceDisplays` — spaces↔devices/displays wiring is module-level

### 2.3 Pinia store / schemas / transformers

Most of `modules/spaces/store/` stays in core (it's the generic CRUD Pinia store). Only move pieces that are domain-specific (lighting-state store, climate-state store, etc. — check per file). The plugin may end up with zero store code if all the domain state is fetched via per-view composables.

### 2.4 Locale relocation

Split `spacesModule.*` keys:

- Domain-specific keys (`dialogs.lightingRoles`, `fields.lightingRole.*`, intent-catalog copy, etc.) → `apps/admin/src/plugins/spaces-home-control/locales/*.json` under a `spacesHomeControlPlugin.*` namespace.
- Generic keys (`headings.add`, `fields.spaces.name.*`, `buttons.*`, `messages.*` for create/edit/delete) stay in `apps/admin/src/modules/spaces/locales/*.json`.

English is source of truth; replicate the split across cs-CZ / de-DE / es-ES / pl-PL / sk-SK.

### 2.5 Re-exports and manifest

Replace `components.ts`'s current re-export barrel with real imports from the new file locations. Consumer references via `import { SpaceAddForm } from '../components/components'` inside the plugin tree keep working; anything in core that still imports from `modules/spaces/components/` for a moved component updates to the plugin path (there shouldn't be any — the `useSpacesPlugins` dispatch is the one consumer).

### 2.6 Acceptance criteria

- [ ] `apps/admin/src/plugins/spaces-home-control/components/components.ts` no longer re-exports from the core module.
- [ ] `modules/spaces/components/` contains only the generic list/picker/navigation components.
- [ ] Lighting / climate / covers / sensor / media domain views all still render on the corresponding plugin routes (click through each in dev to verify).
- [ ] Admin type-check + lint + vitest unit suite stay green.
- [ ] i18n renders localized strings for all six locales; no missing-key warnings in the console.

### 2.7 Risks

- The Pinia store split is the trickiest piece — cross-store references may force some composables to stay in core even if semantically they're domain-specific.
- Circular imports: plugin components importing from core and vice versa. If one crops up, promote the shared piece to core.
- Watch for `@fastybird/smart-panel-admin` barrel exports that may over-export to external consumers — check `apps/admin/src/plugins/spaces-home-control/index.ts`.

---

## 3. Panel CI regressions — IMMEDIATE

Phase 3a's backend relocations produced OpenAPI churn that's now breaking the Dart API client and/or panel Dart code that references regenerated types. Panel `code analysis` and `code tests` jobs on `claude/add-readonly-mode-pMcCa` have been red since commit `c0a4809aa` (intent spec relocation) and worsened through subsequent commits.

### 3.1 Reproduce

Local Dart/Flutter tooling isn't always available in the dev container. To reproduce:

1. Install Flutter (stable channel, version matching CI: 3.27.0).
2. Install melos globally: `dart pub global activate melos`.
3. From the repo root: `pnpm generate:spec && pnpm generate:openapi && melos rebuild-all`.
4. `cd apps/panel && dart analyze` and `flutter test`.

### 3.2 Likely causes

- The backend OpenAPI regen after the Phase 3a model moves may have produced slightly-different schema ordering or naming that the Dart generator emits differently.
- Panel's `apps/panel/lib/plugins/spaces-home-control/` may reference generated types under a path that shifted (though the `@ApiSchema` names were supposed to be preserved — verify).

### 3.3 Fix strategy

- Diff `spec/api/v1/openapi.json` against `origin/main` to identify what changed beyond "schema additions".
- Regenerate Dart client (`melos rebuild-all`) and compare `apps/panel/lib/api/` (if present) or wherever the generated client lives.
- Update any panel Dart file that imports a renamed symbol. Keep schema names stable — if a rename is unavoidable, either rename the Dart callers or restore the original name via an `@ApiSchema({ name: '...' })` override.

---

## 4. Small follow-ups

### 4.1 Signage edit form: stale-server-data race

**Low priority.** When the user types during `fetchSpace()` we skip `applyServerPayload` to protect their edits, but untouched fields stay at the form's initial defaults — NOT the server's actual stored values. Saving then overwrites the server with defaults for those fields.

**Fix:** show a banner when `applyServerPayload` skips ("the server copy loaded after you started typing — click to refresh") with a button that reloads the form. Or gate Save on a flag that flips only after a clean fetch, and prompt the user to cancel + reopen.

File: `apps/admin/src/plugins/spaces-signage-info-panel/components/signage-info-panel-space-edit-form.vue`.

### 4.2 Plugin element `name` not reactive to locale changes

**Low priority — Bugbot already flagged.** `i18n.global.t('spacesXxxPlugin.typeLabels.<type>')` is called at plugin install to set `element.name` as a plain string. When the user changes admin locale at runtime, the space-type picker dropdown labels stay in the original language because `el.name` is not reactive.

**Fix (two options):**
- (A) Store the i18n key in `element.name` and translate at render in `select-space-plugin.vue` (and any other consumer of `useSpacesPlugins.options`). Convention change: `name` becomes a translation key rather than a human-readable string.
- (B) Accept the limitation; admin locale change usually triggers a full reload anyway. Document in the plugin authors guide.

### 4.3 `getByName` vs `getByType` naming

**Low priority — carryover from Phase 1.** `useSpacesPlugins.getByName` (and the same-named methods on `usePagesPlugins` / `useTilesPlugins` / `useDataSourcesPlugins`) actually searches `plugin.type`, not `plugin.name`. Rename to `getByType` / `getByPluginType` for all four plugin-host composables in a single cross-module cleanup PR.

### 4.4 Duplicate `IRelationLoader` interface

**Done** — consolidated into `apps/backend/src/common/plugin-relations/` by commit `fa9707be7`.

---

## Conventions for whoever picks this up

- **Branch:** continue on `claude/add-readonly-mode-pMcCa` for Phase 3a finishing + follow-ups. Open a sibling branch (`claude/phase-3b-admin-relocation`) for Phase 3b since its diff is large enough to warrant its own PR.
- **Commit style:** `<type>(<scope>): <subject>` matching existing conventions. `refactor(backend/spaces-home-control): ...` for relocations, `fix(admin/spaces): ...` for bug fixes.
- **OpenAPI stability:** every step in Phase 3a finishing + 3b must leave `git diff spec/api/v1/openapi.json` empty. This is the hard contract — any schema-name change needs explicit approval.
- **Verification per commit:** run backend lint + tests + type-check + openapi regen before pushing. See section 1.4 for the full pipeline.
- **AI instructions:**
  - Read `tasks/plans/plan-spaces-plugin-system-signage.md` first for architectural context.
  - Read this doc for the actionable punch list.
  - Start by replying with a focused implementation plan (max 10 steps) for whichever section you're tackling.
  - For each acceptance criterion, either implement it or explain why it's skipped.
