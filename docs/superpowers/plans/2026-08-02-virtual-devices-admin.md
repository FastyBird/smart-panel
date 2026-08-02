# Virtual Devices — Admin Implementation Plan (Plan B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make virtual devices usable — an admin wizard that builds one from other devices' properties, plus the hidden-device handling the backend already models but no UI exposes.

**Architecture:** Four backend tasks supply what the admin needs (`hiddenBy` provenance, a mutation guard, a compatibility endpoint, bootstrap reconciliation), then eight admin tasks build the plugin trio, the list/picker filtering, a bespoke construction wizard, and the detail page. Backend lands first because every admin task consumes it.

**Tech Stack:** NestJS 11, TypeORM 0.3 (SQLite, single-table inheritance), Jest; Vue 3 + Pinia + Zod + vue-i18n, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-31-virtual-devices-design.md` (§Creation flow, §Admin and Panel)
**Predecessor:** `docs/superpowers/plans/2026-07-31-virtual-devices-backend.md` (merged as PR #628)
**Open items this plan closes:** `tasks/technical/TECH-VIRTUAL-DEVICES-FOLLOWUPS.md` §2.2, §2.11, and the unwired `assertPermissionsCompatible` under §4

## Decisions taken before writing this plan

Four were settled explicitly; the fifth is an implementation-shape call I made and flagged.

1. **`hidden` gets provenance.** A `hiddenBy` column distinguishes a hide caused by a virtual device replacing the source from one an operator performed by hand. Without it, the abandoned-source reconciliation cannot run at bootstrap without risking a deliberate operator setting.
2. **A hidden device may not have its room or zones changed.** Chosen knowing the tradeoff: energy attribution follows the physical device's room, and a split parent is exactly the device that gets hidden. The guard therefore applies to **mutation only** — hiding preserves the stored room so unhiding restores it, and the split flow keeps working because the parent is placed before it is hidden.
3. **The wizard hard-blocks incompatible sources.** `assertPermissionsCompatible` (implemented but unwired since PR #628) becomes reachable, so a read-only source cannot fill a writable spec slot.
4. **Admin pickers exclude hidden devices** — tiles, device-detail pages, data sources and scene actions already refuse them server-side; the admin must stop offering them.
5. **The wizard is bespoke, not built on `IDeviceWizardAdapter`.** That contract is discovery-shaped: its steps are `'discover' | 'confirm' | 'results'`, its rows carry statuses like `already_registered` and `unsupported`, and it is organised around a discovery session. Virtual devices are *constructed*, not discovered — pick a category, map spec slots, name and place. Forcing the fit would mean pretending "discover" means "choose a category". Reuse of that abstraction is a non-goal; reuse of generic form and layout components is expected.

## Global Constraints

**Backend**
- Tabs, not spaces. Print width 120. Single quotes. Semicolons. Trailing commas on multiline.
- Imports: external first, then relative (`../` before `./`); enforced by `@trivago/prettier-plugin-sort-imports` via `eslint-plugin-prettier`.
- **Swagger decorators before NestJS decorators.** Response schema `{ModuleName}Res{Name}`, DTO `{ModuleName}{Action}{Entity}`.
- Migrations are incremental and additive; never modify the initial migration. Next free number is **`1000000000008`**. Migration specs live in `src/migrations/__tests__/` — a spec beside a migration is picked up by TypeORM's `migrations/*` glob and breaks `generate:openapi`. SQLite here is 3.44.2, so `DROP COLUMN` is available and `down()` must use it.
- **Never add a class-field initializer to an entity property.** `class-transformer` preserves it, so `DevicesService.update`'s `omitBy(toInstance(...), isUndefined)` materialises it and silently overwrites the stored value on any unrelated PATCH. This bug shipped twice on the predecessor branch.
- **`class-validator` replaces rather than merges a subclass's redeclared decorators** — the override keys on `(propertyName, type)` and nearly every decorator shares type `customValidation`. Repeat the parent's full stack and test that inherited validation still fires. This bit three times on the predecessor branch.

**Admin**
- Same formatting rules. Vue components are `PascalCase` filenames; folders `kebab-case`.
- Six locales are mandatory: `cs-CZ`, `de-DE`, `en-US`, `es-ES`, `pl-PL`, `sk-SK`. A missing key is a runtime fallback, not a build error — check all six.
- The admin keeps **hand-maintained Zod schemas mirroring the generated OpenAPI types**. Adding a required backend field breaks `vue-tsc` until the Zod schema carries it. Run `pnpm --filter @fastybird/smart-panel-admin type-check`.
- Prettier has many pre-existing failures repo-wide — scope any format check to files you touched.
- `vitest`'s filter flag is a no-op here; run the whole admin suite.

**Both**
- Generated artifacts (`spec/api/v1/openapi.json`, `apps/admin/src/openapi.ts`, `apps/panel/lib/api`) are **gitignored and untracked**. Regenerate to verify decorators; never `git add` them.
- **Every CI job runs `generate:openapi` in its setup step, booting the app against a database with no tables.** Anything in a bootstrap hook must survive that. Verify with `FB_DB_PATH=$(mktemp -d) pnpm run generate:openapi` — must exit 0.
- E2E: `cd apps/backend && node_modules/.bin/jest --config ./test/jest-e2e.json --forceExit <name>` (the pnpm form mis-parses `--forceExit` as a filter). Known noise: a Buddy failure without local InfluxDB, and a ~1-in-25 Zigbee2MQTT flake — baseline `HEAD` before blaming yourself. The e2e throttler is 30 req/60s **per handler, keyed by client address**; a polling loop on a shared route fails a dozen unrelated tests at once.
- Never push to main. Feature branch and PR only.

## File Structure

**Backend**

| File | Responsibility |
|---|---|
| `modules/devices/devices.constants.ts` *(modify)* | `DeviceHiddenBy` enum |
| `modules/devices/entities/devices.entity.ts` *(modify)* | `hiddenBy` column (no initializer) |
| `migrations/1000000000008-AddDeviceHiddenBy.ts` *(new)* | Column + index, `down()` drops both |
| `modules/devices/dto/{create,update}-device.dto.ts` *(modify)* | Expose `hidden_by`; guard room/zone mutation |
| `modules/devices/validators/device-placement-allowed.validator.ts` *(new)* | Refuse room/zone change on a hidden device |
| `plugins/devices-virtual/controllers/virtual-devices.controller.ts` *(modify)* | `POST /compatibility` preview endpoint |
| `plugins/devices-virtual/services/virtual-devices.service.ts` *(modify)* | Compatibility report; reuse `assertPermissionsCompatible` |
| `plugins/devices-virtual/listeners/virtual-index-maintenance.listener.ts` *(modify)* | Bootstrap reconciliation keyed on `hiddenBy` |

**Admin**

| File | Responsibility |
|---|---|
| `plugins/devices-virtual/` *(new)* | Plugin trio: constants, schemas, stores, forms, locales, registration |
| `plugins/devices-virtual/components/wizard/` *(new)* | The four construction-wizard steps |
| `plugins/devices-virtual/views/view-virtual-device-wizard.vue` *(new)* | Wizard shell and route |
| `modules/devices/views/view-devices.vue` *(modify)* | Hidden toggle, badge, virtual-device children count |
| `modules/devices/store/devices.store.*` *(modify)* | `hidden`/`hiddenBy` in schema and types; `hidden` query param |
| `plugins/{tiles-device-preview,pages-device-detail,data-sources-device-channel,scenes-local}` *(modify)* | Exclude hidden devices from pickers |

---

## Phase 1 — Backend prerequisites

### Task 1: `hiddenBy` provenance column

**Files:**
- Modify: `apps/backend/src/modules/devices/devices.constants.ts`
- Modify: `apps/backend/src/modules/devices/entities/devices.entity.ts`
- Create: `apps/backend/src/migrations/1000000000008-AddDeviceHiddenBy.ts`
- Modify: `apps/backend/src/modules/devices/dto/create-device.dto.ts`, `update-device.dto.ts`
- Test: `apps/backend/src/modules/devices/services/devices.service.spec.ts`

**Interfaces:**
- Produces: `enum DeviceHiddenBy { SYSTEM = 'system', USER = 'user' }`; `DeviceEntity.hiddenBy: DeviceHiddenBy | null`; `hidden_by` on both device DTOs.

- [ ] **Step 1: Write the failing test**

```typescript
it('persists hiddenBy alongside hidden', async () => {
	const device = await service.update(existingDeviceId, {
		type: 'virtual',
		hidden: true,
		hidden_by: DeviceHiddenBy.SYSTEM,
	} as UpdateDeviceDto);

	expect(device.hidden).toBe(true);
	expect(device.hiddenBy).toBe(DeviceHiddenBy.SYSTEM);
});

it('leaves hiddenBy untouched by an unrelated patch', async () => {
	await service.update(existingDeviceId, { type: 'virtual', hidden: true, hidden_by: DeviceHiddenBy.USER } as UpdateDeviceDto);

	const device = await service.update(existingDeviceId, { type: 'virtual', name: 'Renamed' } as UpdateDeviceDto);

	expect(device.hiddenBy).toBe(DeviceHiddenBy.USER);
});
```

The second test is the one that matters: it pins the class-field-initializer trap that shipped twice on the predecessor branch.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./apps/backend run test:unit -- devices.service.spec.ts`
Expected: FAIL — `hidden_by` is not a known property

- [ ] **Step 3: Add the enum**

In `devices.constants.ts`, beside `DeviceHiddenFilter`:

```typescript
export enum DeviceHiddenBy {
	/** Hidden automatically because a virtual device replaced this one. */
	SYSTEM = 'system',
	/** Hidden deliberately by an operator. */
	USER = 'user',
}
```

- [ ] **Step 4: Add the column**

In `devices.entity.ts`, immediately after `hidden`. **No field initializer** — the `hidden` column deliberately has none for the same reason:

```typescript
@ApiPropertyOptional({
	name: 'hidden_by',
	description: 'Why the device is hidden. `system` when a virtual device replaced it, `user` when an operator hid it.',
	enum: DeviceHiddenBy,
	nullable: true,
	example: DeviceHiddenBy.SYSTEM,
})
@Expose({ name: 'hidden_by' })
@IsOptional()
@IsEnum(DeviceHiddenBy)
@Transform(({ obj }: { obj: { hidden_by?: DeviceHiddenBy; hiddenBy?: DeviceHiddenBy } }) => obj.hidden_by ?? obj.hiddenBy, {
	toClassOnly: true,
})
@Index()
@Column({ type: 'text', enum: DeviceHiddenBy, nullable: true, default: null })
hiddenBy: DeviceHiddenBy | null;
```

- [ ] **Step 5: Write the migration**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeviceHiddenBy1000000000008 implements MigrationInterface {
	name = 'AddDeviceHiddenBy1000000000008';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "devices_module_devices" ADD COLUMN "hiddenBy" varchar`);
		await queryRunner.query(`CREATE INDEX "IDX_devices_hiddenBy" ON "devices_module_devices" ("hiddenBy")`);

		// Existing hidden rows predate provenance. Attribute them to the operator: it is the
		// conservative default, because reconciliation only ever auto-unhides `system` rows and
		// must never clear a deliberate setting.
		await queryRunner.query(`UPDATE "devices_module_devices" SET "hiddenBy" = 'user' WHERE "hidden" = 1`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_devices_hiddenBy"`);
		await queryRunner.query(`ALTER TABLE "devices_module_devices" DROP COLUMN "hiddenBy"`);
	}
}
```

- [ ] **Step 6: Expose on both DTOs**

Add `hidden` and `hidden_by` to `create-device.dto.ts` and `update-device.dto.ts`, following the shape of the existing `enabled` field in each. `hidden` is currently on neither — it was added to the entity in PR #628 but never made settable, which is why the admin has no way to hide anything.

- [ ] **Step 7: Verify**

Run: `pnpm --filter ./apps/backend run test:unit -- devices.service.spec.ts` → PASS
Run: `cd apps/backend && FB_DB_PATH=$(mktemp -d) pnpm run typeorm:migration:run` → applies clean
Run the revert/reapply cycle against that scratch database: `migration:revert` then `migration:run` again → both succeed
Run: `pnpm run generate:openapi` → succeeds; `hidden_by` appears in the device schema

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/modules/devices apps/backend/src/migrations/1000000000008-AddDeviceHiddenBy.ts
git commit -m "feat(devices): record why a device was hidden"
```

---

### Task 2: Refuse room and zone changes on a hidden device

**Files:**
- Create: `apps/backend/src/modules/devices/validators/device-placement-allowed.validator.ts`
- Test: `apps/backend/src/modules/devices/validators/device-placement-allowed.validator.spec.ts`
- Modify: `apps/backend/src/modules/devices/dto/update-device.dto.ts`
- Modify: `apps/backend/src/modules/devices/devices.module.ts`

**Interfaces:**
- Consumes: `DeviceEntity.hidden` from Task 1's DTO exposure
- Produces: `DevicePlacementAllowedConstraintValidator` and `@ValidateDevicePlacementAllowed()`

The guard is on **mutation**, not on state: hiding preserves the stored room so unhiding restores it, and the split flow places the parent before hiding it.

- [ ] **Step 1: Write the failing test**

```typescript
it('allows a room change on a visible device', async () => {
	devicesService.findOne.mockResolvedValue({ id: 'a', hidden: false });

	await expect(validator.validate('room-1', argsFor('a'))).resolves.toBe(true);
});

it('refuses a room change on a hidden device', async () => {
	devicesService.findOne.mockResolvedValue({ id: 'a', hidden: true });

	await expect(validator.validate('room-1', argsFor('a'))).resolves.toBe(false);
});

it('allows a patch that does not touch placement', async () => {
	devicesService.findOne.mockResolvedValue({ id: 'a', hidden: true });

	await expect(validator.validate(undefined, argsFor('a'))).resolves.toBe(true);
});
```

The third case is load-bearing: hiding a device is itself a PATCH, and it must not be refused by its own guard.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./apps/backend run test:unit -- device-placement-allowed.validator.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement, following `device-not-hidden-constraint.validator.ts`**

Declare `@ValidatorConstraint({ name: 'DevicePlacementAllowed', async: true })` — `async: true` is required because `validate()` awaits a lookup. A sibling in this directory declares `async: false` on an async `validate()`, which makes class-validator skip the await and silently pass; do not copy that.

The validator resolves the device by the id on the DTO's route context, returns `true` when the incoming value is `undefined` (nothing being changed), and otherwise returns `!device.hidden`.

- [ ] **Step 4: Apply to both placement fields**

Add `@ValidateDevicePlacementAllowed()` to `room_id` and `zone_ids` on `UpdateDeviceDto`. **Repeat each field's existing decorator stack in full** — `class-validator` replaces rather than merges a redeclared property's decorators, so a partial redeclaration silently drops `@IsUUID`. Add a test asserting an invalid UUID is still rejected on both fields.

- [ ] **Step 5: Register and verify**

Add the validator to `devices.module.ts` `providers` and `exports`.

Run: `pnpm --filter ./apps/backend run test:unit -- src/modules/devices` → PASS
Run: `pnpm --filter ./apps/backend run lint:js` → clean

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/devices
git commit -m "feat(devices): refuse placement changes on a hidden device"
```

---

### Task 3: Compatibility preview endpoint

**Files:**
- Modify: `apps/backend/src/plugins/devices-virtual/services/virtual-devices.service.ts`
- Modify: `apps/backend/src/plugins/devices-virtual/controllers/virtual-devices.controller.ts`
- Create: `apps/backend/src/plugins/devices-virtual/dto/compatibility-request.dto.ts`
- Create: `apps/backend/src/plugins/devices-virtual/models/compatibility-response.model.ts`
- Test: `apps/backend/src/plugins/devices-virtual/services/virtual-devices.service.spec.ts`

**Interfaces:**
- Consumes: `assertPermissionsCompatible(specPermissions: PermissionType[], sourceProperty: ChannelPropertyEntity): void` — implemented in PR #628 and, until now, called from nowhere
- Produces: `POST /plugins/devices-virtual/devices/compatibility` returning, per candidate source property, whether it can fill a given spec slot and why not

This is what makes the wizard able to hard-block incompatible sources rather than letting the user build a control whose writes die at the source platform.

- [ ] **Step 1: Write the failing test**

```typescript
it('reports a read-only source as incompatible with a writable slot', () => {
	const report = service.reportCompatibility(
		{ channel: ChannelCategory.LIGHT, property: PropertyCategory.ON },
		readOnlySourceProperty,
	);

	expect(report.compatible).toBe(false);
	expect(report.reason).toContain('permission');
});

it('reports a read-write source as compatible with a read-only slot', () => {
	const report = service.reportCompatibility(
		{ channel: ChannelCategory.TEMPERATURE, property: PropertyCategory.TEMPERATURE },
		readWriteSourceProperty,
	);

	expect(report.compatible).toBe(true);
});

it('reports a data-type mismatch as incompatible', () => {
	const report = service.reportCompatibility(
		{ channel: ChannelCategory.LIGHT, property: PropertyCategory.ON },
		floatSourceProperty,
	);

	expect(report.compatible).toBe(false);
	expect(report.reason).toContain('data type');
});
```

The second case pins the rule that `READ_WRITE` satisfies a `READ_ONLY` requirement — reuse `DeviceValidationService`'s existing `permissionSatisfied` rule rather than restating it.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./apps/backend run test:unit -- virtual-devices.service.spec.ts`
Expected: FAIL — `reportCompatibility` is not a function

- [ ] **Step 3: Implement `reportCompatibility`**

Wrap the existing `assertPermissionsCompatible` (catching its exception into a reason string) and add the data-type check the spec slot requires, resolving the slot's expectations through `getAllProperties(channelCategory)` from `schema.utils.ts`.

- [ ] **Step 4: Add the endpoint**

`POST` taking a target `category` plus a list of candidate `{ spec_channel, spec_property, source_property }` triples, returning a report per triple. Swagger decorators before the NestJS verb decorator; `operationId` following the module convention; document the 422 for an unknown source property.

- [ ] **Step 5: Verify**

Run: `pnpm --filter ./apps/backend run test:unit -- src/plugins/devices-virtual` → PASS
Run: `pnpm run generate:openapi` → the new operation appears
Run: `pnpm --filter ./apps/backend run lint:js` → clean

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/plugins/devices-virtual
git commit -m "feat(devices-virtual): report source compatibility for a spec slot"
```

---

### Task 4: Reconcile system-hidden sources at bootstrap

**Files:**
- Modify: `apps/backend/src/plugins/devices-virtual/listeners/virtual-index-maintenance.listener.ts`
- Test: `apps/backend/src/plugins/devices-virtual/listeners/virtual-index-maintenance.listener.spec.ts`

**Interfaces:**
- Consumes: `DeviceHiddenBy` (Task 1); the existing bootstrap hydration that already feeds its result through `recomputeStatuses()`

Closes follow-up §2.11. The gap: when the last virtual reference is deleted and the process stops before the maintenance pass runs, the source stays hidden forever — on restart the index starts empty, so the abandonment edge is gone and no later event can recover it.

Provenance is what makes reconciliation safe. Unhide a hidden device at bootstrap **only when `hiddenBy === SYSTEM`** and no virtual property references it. A `USER` hide is never touched.

- [ ] **Step 1: Write the failing test**

```typescript
it('unhides a system-hidden source that nothing references any more', async () => {
	repository.find.mockResolvedValue([]); // no virtual properties survive
	devicesService.findAll.mockResolvedValue([{ id: 'src', hidden: true, hiddenBy: DeviceHiddenBy.SYSTEM }]);

	await listener.onApplicationBootstrap();

	expect(devicesService.update).toHaveBeenCalledWith('src', expect.objectContaining({ hidden: false }));
});

it('never unhides a user-hidden source', async () => {
	repository.find.mockResolvedValue([]);
	devicesService.findAll.mockResolvedValue([{ id: 'src', hidden: true, hiddenBy: DeviceHiddenBy.USER }]);

	await listener.onApplicationBootstrap();

	expect(devicesService.update).not.toHaveBeenCalled();
});

it('leaves a system-hidden source alone while it is still referenced', async () => {
	repository.find.mockResolvedValue([linkedPropertyReferencing('src')]);
	devicesService.findAll.mockResolvedValue([{ id: 'src', hidden: true, hiddenBy: DeviceHiddenBy.SYSTEM }]);

	await listener.onApplicationBootstrap();

	expect(devicesService.update).not.toHaveBeenCalled();
});
```

The second test is the whole reason provenance exists — without it, reconciliation destroys a deliberate operator setting on every boot, which is worse than the bug being fixed.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter ./apps/backend run test:unit -- virtual-index-maintenance.listener.spec.ts`
Expected: FAIL — no reconciliation runs

- [ ] **Step 3: Implement**

After the bootstrap hydration completes, list hidden devices, keep those with `hiddenBy === SYSTEM` that no indexed link references, and unhide each — clearing `hiddenBy` to `null` at the same time so the row returns to a clean state.

Preserve the device's `enabled` in the patch. `DevicesService.update` materialises omitted defaults, so a partial patch silently re-enables a disabled device — this exact defect was found and fixed in the auto-unhide path on the predecessor branch.

- [ ] **Step 4: Keep bootstrap failure-tolerant**

The reconciliation must not be able to prevent startup. Wrap it and log at error; an unmigrated database must still boot. This is the condition that turned every CI job red on the predecessor branch.

- [ ] **Step 5: Verify**

Run: `pnpm --filter ./apps/backend run test:unit` → PASS
Run: `FB_DB_PATH=$(mktemp -d) pnpm run generate:openapi` → **exit 0**. This is the direct regression test for Step 4.
Run the devices-virtual e2e several times.

- [ ] **Step 6: Update the follow-ups doc and commit**

Mark §2.11 resolved in `tasks/technical/TECH-VIRTUAL-DEVICES-FOLLOWUPS.md`, noting that provenance is what made it safe.

```bash
git add apps/backend/src/plugins/devices-virtual tasks/technical/TECH-VIRTUAL-DEVICES-FOLLOWUPS.md
git commit -m "fix(devices-virtual): reconcile system-hidden sources at bootstrap"
```

---

## Phase 2 — Admin

### Task 5: Admin plugin trio

**Files:**
- Create: `apps/admin/src/plugins/devices-virtual/` — `devices-virtual.constants.ts`, `index.ts`, `devices-virtual.plugin.ts`, `schemas/{devices.schemas.ts,devices.types.ts,schemas.ts,types.ts}`, `store/{devices,channels,channels.properties}.store.{schemas,types}.ts`, `store/stores.ts`, `components/{virtual-device-add-form,virtual-device-edit-form}.vue` + `.types.ts` + `.spec.ts`, `components/components.ts`, `locales/{cs-CZ,de-DE,en-US,es-ES,pl-PL,sk-SK}.json` + `index.ts`
- Modify: the admin plugin registry

**Interfaces:**
- Consumes: the generated `openapi.ts` types from Task 1's and Task 3's schema changes
- Produces: `devicesVirtualPluginKey`; Zod schemas `VirtualDeviceSchema`, `VirtualChannelSchema`, `VirtualChannelPropertySchema`

Mirror `apps/admin/src/plugins/devices-third-party/` exactly — it is the reference plugin, and all admin `devices-*` plugins share this shape.

- [ ] **Step 1: Regenerate types**

Run: `pnpm run generate:openapi`. The virtual schemas must be present in `apps/admin/src/openapi.ts` before the Zod schemas can reference them.

- [ ] **Step 2: Copy and adapt the structure**

Rename `ThirdParty` → `Virtual` throughout. Drop third-party's `service_address`. The property schema gains `value_origin` (enum `source | local`) and `source_property` (nullable UUID), matching the backend.

- [ ] **Step 3: Write the six locale files**

Every key present in all six. `en-US` first, then translate — do not leave the other five as English copies.

- [ ] **Step 4: Register**

Add the plugin beside the other `devices-*` entries in the admin registry, following how `devices-third-party` is wired.

- [ ] **Step 5: Verify**

Run: `pnpm --filter @fastybird/smart-panel-admin type-check` → clean
Run: `pnpm --filter ./apps/admin run test:unit` → PASS

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src
git commit -m "feat(admin): register the virtual devices plugin"
```

---

### Task 6: Hidden devices in the device list

**Files:**
- Modify: `apps/admin/src/modules/devices/store/devices.store.schemas.ts` (add `hidden_by`)
- Modify: `apps/admin/src/modules/devices/store/devices.store.ts` (pass `hidden` query param)
- Modify: `apps/admin/src/modules/devices/store/devices.store.types.ts`
- Modify: `apps/admin/src/modules/devices/views/view-devices.vue`
- Test: `apps/admin/src/modules/devices/store/devices.transformers.spec.ts`

**Interfaces:**
- Consumes: `hidden`, `hidden_by` from Task 1; `?hidden=true|false|all` on `GET /devices` from PR #628
- Produces: a `showHidden` list preference

`hidden` already exists in the response schema (added when the backend field landed); `hidden_by` is new and must be added or `vue-tsc` fails.

- [ ] **Step 1: Write the failing test**

```typescript
it('carries hiddenBy through the transformer', () => {
	const device = transformDeviceResponse({ ...validDeviceResponse, hidden: true, hidden_by: 'system' });

	expect(device.hidden).toBe(true);
	expect(device.hiddenBy).toBe('system');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./apps/admin run test:unit` (the filter flag is a no-op here)
Expected: FAIL — `hiddenBy` is undefined

- [ ] **Step 3: Add the field and the toggle**

Zod schema, internal model and transformer gain `hidden_by` → `hiddenBy`. The list view gets a "Show hidden devices" toggle, defaulting **off**, which drives the `hidden` query parameter. Hidden rows show a "Hidden" badge, and a badge distinguishing a `system` hide from a `user` one, since only the former is auto-reversible.

- [ ] **Step 4: Verify**

Run: `pnpm --filter @fastybird/smart-panel-admin type-check` → clean
Run: `pnpm --filter ./apps/admin run test:unit` → PASS

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/modules/devices
git commit -m "feat(admin): show and filter hidden devices"
```

---

### Task 7: Exclude hidden devices from the pickers

**Files:**
- Modify: the device selector in `apps/admin/src/plugins/tiles-device-preview/`, `pages-device-detail/`, `data-sources-device-channel/`, `scenes-local/`
- Modify: the room and zone selectors in the admin device form
- Test: one spec per picker

**Interfaces:**
- Consumes: the `hidden` query parameter from Task 6's store change

The backend already refuses hidden devices in all four of these DTOs — the admin must stop offering them, so the user gets an empty option rather than a validation error.

- [ ] **Step 1: Write a failing test per picker**

```typescript
it('does not offer a hidden device', async () => {
	devicesStore.data = { visible: { id: 'visible', hidden: false }, concealed: { id: 'concealed', hidden: true } };

	const { options } = mountPicker();

	expect(options.value.map((option) => option.value)).toEqual(['visible']);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter ./apps/admin run test:unit`
Expected: FAIL — both devices offered

- [ ] **Step 3: Filter each picker**

Request `hidden=false`, or filter the store selection where the picker reads from an already-loaded collection. Prefer the query parameter where the picker owns its fetch.

- [ ] **Step 4: Verify and commit**

Run: `pnpm --filter ./apps/admin run test:unit` → PASS

```bash
git add apps/admin/src/plugins apps/admin/src/modules/devices
git commit -m "feat(admin): keep hidden devices out of the selection pickers"
```

---

### Task 8: Wizard — category step

**Files:**
- Create: `apps/admin/src/plugins/devices-virtual/components/wizard/virtual-wizard-category-step.vue` + `.types.ts` + `.spec.ts`
- Create: `apps/admin/src/plugins/devices-virtual/views/view-virtual-device-wizard.vue` + route registration

**Interfaces:**
- Produces: `IVirtualWizardState { category: DeviceCategory | null; mappings: IVirtualSlotMapping[]; name: string; roomId: string | null; zoneIds: string[] }` — the state object every later step reads and writes

Step 1 of 4. Blocked categories must not be offered: six require a closed-loop channel the plugin cannot drive, and creating one would produce a device that accepts a setpoint and never acts on it.

- [ ] **Step 1: Write the failing test**

```typescript
it('does not offer a category that needs a controller', () => {
	const { categories } = mountCategoryStep();

	expect(categories.value.map((entry) => entry.value)).not.toContain('heating_unit');
	expect(categories.value.map((entry) => entry.value)).not.toContain('thermostat');
});

it('offers a wiring-only category', () => {
	const { categories } = mountCategoryStep();

	expect(categories.value.map((entry) => entry.value)).toContain('lighting');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter ./apps/admin run test:unit`
Expected: FAIL — component not found

- [ ] **Step 3: Implement**

List device categories from the generated spec, filtering the six blocked ones. Each blocked category may be shown disabled with the reason ("needs a controller — planned for a later release") rather than hidden entirely, so the omission is explicable rather than mysterious.

- [ ] **Step 4: Verify and commit**

Run: `pnpm --filter ./apps/admin run test:unit` → PASS

```bash
git add apps/admin/src/plugins/devices-virtual
git commit -m "feat(admin): add the virtual device wizard category step"
```

---

### Task 9: Wizard — property mapping step

**Files:**
- Create: `apps/admin/src/plugins/devices-virtual/components/wizard/virtual-wizard-mapping-step.vue` + `.types.ts` + `.spec.ts`

**Interfaces:**
- Consumes: `IVirtualWizardState` (Task 8); the compatibility endpoint (Task 3)
- Produces: `IVirtualSlotMapping { specChannel: ChannelCategory; specProperty: PropertyCategory; sourceProperty: string | null }`

The heart of the wizard. For the chosen category, expand the spec into channel and property slots, required first, and let the user fill each from a device → channel → property selector.

- [ ] **Step 1: Write the failing test**

```typescript
it('lists every required slot for the chosen category', () => {
	const { slots } = mountMappingStep({ category: 'lighting' });

	expect(slots.value.filter((slot) => slot.required).map((slot) => slot.specProperty)).toContain('on');
});

it('blocks a source the backend reports incompatible', async () => {
	compatibilityApi.mockResolvedValue([{ compatible: false, reason: 'permission mismatch' }]);

	const { selectSource, errors } = mountMappingStep({ category: 'lighting' });
	await selectSource('on', readOnlyPropertyId);

	expect(errors.value.on).toContain('permission mismatch');
});

it('excludes the device_information slots from mapping', () => {
	const { slots } = mountMappingStep({ category: 'lighting' });

	expect(slots.value.map((slot) => slot.specChannel)).not.toContain('device_information');
});
```

The third case matters: `device_information` is synthesized by the backend as owned properties and must never be presented for mapping.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter ./apps/admin run test:unit`
Expected: FAIL — component not found

- [ ] **Step 3: Implement**

Expand slots from the spec; hard-block incompatible sources using the Task 3 endpoint; exclude hidden devices from the source picker; show live progress on which required slots are still unfilled.

Offer a "take this whole channel" shortcut that expands a chosen source channel into per-property mappings — that is the split flow, and it is what makes a four-relay device tolerable to split.

- [ ] **Step 4: Verify and commit**

Run: `pnpm --filter ./apps/admin run test:unit` → PASS

```bash
git add apps/admin/src/plugins/devices-virtual
git commit -m "feat(admin): add the virtual device wizard mapping step"
```

---

### Task 10: Wizard — details and review steps

**Files:**
- Create: `apps/admin/src/plugins/devices-virtual/components/wizard/virtual-wizard-details-step.vue` + `.types.ts` + `.spec.ts`
- Create: `apps/admin/src/plugins/devices-virtual/components/wizard/virtual-wizard-review-step.vue` + `.types.ts` + `.spec.ts`

**Interfaces:**
- Consumes: `IVirtualWizardState` (Task 8), `IVirtualSlotMapping` (Task 9)

Steps 3 and 4. Details takes name, room and zones; review summarises every mapping and creates the device.

- [ ] **Step 1: Write the failing tests**

```typescript
it('pre-generates a name from the category and room', () => {
	const { name } = mountDetailsStep({ category: 'lighting', roomId: 'living-room' });

	expect(name.value).toBe('Lighting — Living Room');
});

it('summarises each mapping as source device, channel and property', () => {
	const { rows } = mountReviewStep({ mappings: [onSlotMappedToRelay] });

	expect(rows.value[0]).toMatchObject({ specProperty: 'on', sourceDevice: 'Shelly 4PM', sourceProperty: 'Output' });
});

it('offers to hide the source device when every mapping comes from one device', () => {
	const { canHideSource } = mountReviewStep({ mappings: [relay0, relay1] });

	expect(canHideSource.value).toBe(true);
});

it('does not offer to hide when sources span devices', () => {
	const { canHideSource } = mountReviewStep({ mappings: [relayFromShelly, sensorFromZigbee] });

	expect(canHideSource.value).toBe(false);
});
```

The last two encode the split/compose distinction: hiding the parent makes sense when one device was split, and does not when several were composed.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter ./apps/admin run test:unit`
Expected: FAIL — components not found

- [ ] **Step 3: Implement**

Details pre-generates an editable name and takes room and zones. Review lists every mapping, creates the device with its channels and properties in one POST, and — when every source resolves to a single device — offers to hide that device, sending `hidden: true` with `hidden_by: 'system'` so bootstrap reconciliation can later reverse it.

- [ ] **Step 4: Verify and commit**

Run: `pnpm --filter ./apps/admin run test:unit` → PASS

```bash
git add apps/admin/src/plugins/devices-virtual
git commit -m "feat(admin): add the virtual device wizard details and review steps"
```

---

### Task 11: Wizard shell and end-to-end creation

**Files:**
- Modify: `apps/admin/src/plugins/devices-virtual/views/view-virtual-device-wizard.vue`
- Create: `apps/admin/src/plugins/devices-virtual/views/view-virtual-device-wizard.spec.ts`

**Interfaces:**
- Consumes: all four step components (Tasks 8–10)

Wire the steps into one flow with back/next, state carried across steps, and a single creation call at the end.

- [ ] **Step 1: Write the failing test**

```typescript
it('creates a virtual device from a completed flow', async () => {
	const wizard = mountWizard();

	await wizard.chooseCategory('lighting');
	await wizard.mapSlot('on', shellyRelayPropertyId);
	await wizard.setName('Living Room Light');
	await wizard.confirm();

	expect(devicesApi.create).toHaveBeenCalledWith(
		expect.objectContaining({ type: 'virtual', category: 'lighting', name: 'Living Room Light' }),
	);
});

it('refuses to advance while a required slot is unmapped', async () => {
	const wizard = mountWizard();

	await wizard.chooseCategory('lighting');

	expect(wizard.canAdvance.value).toBe(false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter ./apps/admin run test:unit`
Expected: FAIL

- [ ] **Step 3: Implement and route**

Register the route beside the existing device wizard route. Do **not** build on `IDeviceWizardAdapter` — see decision 5 in the header.

- [ ] **Step 4: Verify and commit**

Run: `pnpm --filter ./apps/admin run test:unit` → PASS
Run: `pnpm --filter @fastybird/smart-panel-admin type-check` → clean

```bash
git add apps/admin/src/plugins/devices-virtual
git commit -m "feat(admin): wire the virtual device construction wizard"
```

---

### Task 12: Virtual device detail page with remap

**Files:**
- Create: `apps/admin/src/plugins/devices-virtual/components/virtual-device-sources.vue` + `.types.ts` + `.spec.ts`
- Create: `apps/admin/src/plugins/devices-virtual/components/virtual-device-remap-dialog.vue` + `.types.ts` + `.spec.ts`

**Interfaces:**
- Consumes: `GET /plugins/devices-virtual/devices/:id/source-devices` (PR #628); the compatibility endpoint (Task 3)

Closes the last piece of the degradation story. The backend degrades an orphaned property and forces the device offline; the spec promises the admin shows a warning with a **remap** action, and nothing currently does.

- [ ] **Step 1: Write the failing test**

```typescript
it('flags an orphaned property and offers to remap it', () => {
	const { warnings } = mountSources({ properties: [{ id: 'p', valueOrigin: 'source', sourceProperty: null }] });

	expect(warnings.value).toHaveLength(1);
	expect(warnings.value[0].action).toBe('remap');
});

it('remaps an orphaned property to a new source', async () => {
	const dialog = mountRemapDialog({ propertyId: 'p' });

	await dialog.selectSource(newSourcePropertyId);
	await dialog.confirm();

	expect(propertiesApi.update).toHaveBeenCalledWith('p', expect.objectContaining({ source_property: newSourcePropertyId }));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter ./apps/admin run test:unit`
Expected: FAIL — components not found

- [ ] **Step 3: Implement**

List source devices with links, flag orphaned properties, and offer a remap dialog whose source picker is filtered by the compatibility endpoint — the same hard block as the wizard, so a remap cannot create an incompatible pairing the wizard would have refused.

- [ ] **Step 4: Verify and commit**

Run: `pnpm --filter ./apps/admin run test:unit` → PASS
Run: `pnpm --filter @fastybird/smart-panel-admin type-check` → clean

```bash
git add apps/admin/src/plugins/devices-virtual
git commit -m "feat(admin): show virtual device sources and allow remapping"
```

---

## Self-Review

**Spec coverage.** §Creation flow steps 1–7 map to Tasks 8–11 (category, mapping with compatibility filtering, details, review, optional hide). §Admin's plugin trio → Task 5; hidden filter and badge → Task 6; picker exclusion → Task 7; detail page → Task 12. §Degradation's remap action → Task 12. Follow-up §2.11 → Task 4; §2.2 → Tasks 2 and 7; the unwired `assertPermissionsCompatible` → Task 3.

**Not covered, deliberately.** Panel-side creation remains out of scope per the spec. Controller support for the six blocked categories is the separate follow-up this plan does not touch. §3.3 (the TypeORM shared-`QueryRunner` TOCTOU) is explicitly excluded — it needs its own design conversation, since the fix space runs from retry-on-conflict to connection-per-request to an upstream patch.

**Type consistency.** `IVirtualWizardState` is defined in Task 8 and consumed by name in Tasks 9–11. `IVirtualSlotMapping` is defined in Task 9 and consumed in Task 10. `DeviceHiddenBy` is defined in Task 1 and consumed in Tasks 4, 6 and 10. `reportCompatibility` is defined in Task 3 and consumed in Tasks 9 and 12. The wizard sends `hidden_by: 'system'` (Task 10) which Task 4's reconciliation keys on, and Task 1 exposes.

**Known risk carried into execution.** Task 2's placement guard needs the device id from route context inside a DTO-level validator. If that proves impossible in this codebase's validation setup, the guard belongs in `DevicesService.update` instead — an implementer hitting that should say so rather than weakening the check.
