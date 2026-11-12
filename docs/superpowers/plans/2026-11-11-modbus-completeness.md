# Modbus Completeness (Plan 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish delivery phase 4 of the Modbus plugin: button events, analog/measured/valve/button points in the
admin, editing the points of an existing device, read-only template provenance, the panel stub, and documentation.

**Architecture:** Button events come from a pure state machine (`lib/button-synthesizer.ts`) that the device poller
feeds with the decoded level of a `button.event` read binding; the runtime publishes its events through the core
`ChannelInputOccurrencesService`. Point editing is one transactional `PUT …/devices/:id/structure` request that
reuses the create validation and keeps channel and property IDs it is given. The admin reuses the wizard composable
in an `edit` mode that starts on the Points step.

**Tech Stack:** NestJS + TypeORM (SQLite), Jest; Vue 3 + Pinia + Element Plus, Vitest; Flutter (panel stub);
Next.js MDX (website).

**Spec:** `docs/superpowers/specs/2026-11-09-modbus-devices-design.md` (sections Inputs, Capabilities, Admin,
Panel, Delivery phases 4). Earlier plans: `2026-11-09-modbus-backend-core.md`, `2026-11-10-modbus-templates.md`,
`2026-11-10-modbus-admin.md`.

## Global Constraints

- Commit and PR titles: `<type>(<scope>): <lowercase subject>`, scope required (`backend`, `admin`, `panel`,
  `website`, `docs`, `cross`), header ≤ 100 characters.
- Never push to `main`; one branch and PR per delivery below, each stacked on the previous one.
- Never hand-edit `spec/api/v1/openapi.json`, `apps/admin/src/openapi.ts`, `apps/panel/lib/api/`; regenerate with
  `pnpm run generate:openapi` and commit the result.
- Migrations are incremental: the next file is `apps/backend/src/migrations/1000000000058-AddModbusLongPress.ts`
  (057 was taken by AddAutomationRuns on `main`).
- Admin locales: every new key in all six files (`en-US`, `cs-CZ`, `sk-SK`, `de-DE`, `es-ES`, `pl-PL`), tab
  indented, English text acceptable outside `en-US` as in earlier plans.
- Admin print width 150, backend 120; tabs; single quotes.
- Spec values: long-press threshold per point, **default 800 ms**; synthesised events **`down`, `up`, `press`,
  `long_press` only**; first poll after start or reconnect sets the baseline **without events**; minimum poll
  interval 100 ms; wizard suggests **100–250 ms** for devices with button points.
- Backend checks: `pnpm run lint:js`, `pnpm run test:unit`, `pnpm run test:e2e` (Modbus suite at least).
  Admin checks: `pnpm --filter ./apps/admin run test:unit`, `pnpm run type-check` (needs `NODE_OPTIONS=--max-old-space-size=8192`), eslint, prettier.

## Rulings (decided here; cost if wrong in brackets)

- **R1 Button level source.** A `button` channel's `event` property (permission `ev`) may carry a read binding; it
  is the level the events are synthesised from and must decode to bool (coil, discrete input, or register `bit`).
  Its value is never reported as a sample. No other `ev` property may have a read binding. [A different shape later
  means a migration of bindings, not of channels.]
- **R2 Threshold storage.** New nullable binding column `long_press_ms` (integer 100–10000), allowed only on the read
  binding of `button.event`; `null` means 800 ms (`MODBUS_DEFAULTS.LONG_PRESS_MS`). Templates get the same field.
  [One extra column.]
- **R3 Release after an unseen threshold.** If the release poll comes ≥ threshold after `down` and no `long_press`
  was emitted yet, emit `long_press` then `up` (no `press`). A level already pressed at baseline emits only `up` on
  release. [Users with very slow polls see long presses where they meant short ones; the wizard hint covers this.]
- **R4 Integer properties.** A decoded number reported to a property whose data type is `char`, `uchar`, `short`,
  `ushort`, `int` or `uint` is rounded with `Math.round`; no clamping. [Out-of-range values still fail the core's
  own checks and are logged once, as today.]
- **R5 Points update shape.** `PUT /plugins/devices-modbus/devices/:id/structure` with `category`, optional
  `poll_interval_ms`, `byte_order`, `word_order`, and `channels` (same DTO as create, IDs optional). Channels and
  properties with an `id` are updated in place and keep their IDs; listed IDs must belong to this device (and the
  property to that channel); an existing channel's `category` cannot change; channels of the device not listed are
  removed; all bindings of the device are replaced; the `device_information` channel is kept and may not be sent.
  Name, room, endpoint and unit stay on the core PATCH. [Two requests when a user changes name and points together.]
- **R6 Provenance is set once.** `template_id` and `template_revision` are removed from the PATCH DTO and are not part
  of the points update; they record where the device came from. The admin shows when the loaded template has a
  newer revision. [Users cannot re-link a device to a template; they can recreate it.]
- **R7 Admin categories.** `generic` is a reserved device category and is never used for Modbus devices: the
  backend refuses it on create and on points update (field `category`), and the template schema refuses it. Device
  step offers `switcher`, `input_controller`, `sensor`, `valve`, plus the template's and the current category (never
  `generic`). `suggestCategory`: any `valve.on` point → `valve`; else any write binding →
  `switcher`; else only measured-quantity points (`temperature`, `humidity`, `electrical_power`, `pressure`,
  `illuminance`, `analog_input`) → `sensor`; else `input_controller`. [A wrong suggestion is one click to change.]
- **R8 Delivery split.** PR A backend (Tasks 1–5), PR B admin (Tasks 6–8), PR C panel (Task 9), PR D docs (Task 10).
  Phase 5 hardware acceptance is run by the user with the checklist from Task 10.

## Review Focus

1. A button already held when the plugin starts or the endpoint reconnects must not emit `down`, and its release must
   emit only `up` (Task 2 test `baseline pressed emits only up`).
2. A poll failure while a button is held must not produce `long_press`/`up` from stale state after recovery (Task 3
   test `invalid level resets the button baseline`).
3. Editing points of a device must keep the channel and property IDs it was given, so virtual devices, tiles and
   history keep working (Task 4 test `keeps ids of updated channels and properties`).
4. A scaled register reported to an integer property (humidity `uchar`, raw 456, scale 0.1) reports 46, not 45.6
   (Task 3 test `rounds decoded values for integer properties`).
5. A refused points update leaves the device untouched and the runtime keeps polling the old bindings (Task 4 test
   `refused update changes nothing`).

---

## PR A — backend (`t3/modbus-completeness-backend`, title `feat(backend): add modbus button events and point editing`)

### Task 1: Long-press binding field and button validation

**Files:**
- Create: `apps/backend/src/migrations/1000000000058-AddModbusLongPress.ts`
- Modify: `apps/backend/src/plugins/devices-modbus/entities/modbus-binding.entity.ts` (new column after `pollIntervalMs`)
- Modify: `apps/backend/src/plugins/devices-modbus/dto/binding.dto.ts`, `devices-modbus.constants.ts`
  (`MODBUS_DEFAULTS.LONG_PRESS_MS = 800`, `MODBUS_LIMITS.MIN_LONG_PRESS_MS = 100`, `MAX_LONG_PRESS_MS = 10_000`)
- Modify: `apps/backend/src/plugins/devices-modbus/lib/structure-validation.ts` (`validateProperty`, binding checks)
- Modify: `apps/backend/src/plugins/devices-modbus/services/modbus-device-structure.service.ts` (`toBinding`)
- Modify: `templates/schema/modbus-templates.schema.json`, `lib/template-expander.ts`, `models/template.model.ts`
  (binding field `long_press_ms` passes through to the preview), `templates/README.md` (one line)
- Test: `lib/structure-validation.spec.ts`, `templates/schema/modbus-templates.schema.spec.ts`,
  `lib/template-expander.spec.ts`

**Interfaces:**
- Produces: `ModbusBindingEntity.longPressMs: number | null` (column `longPressMs`, integer, nullable);
  `ModbusBindingDto.long_press_ms?: number`; `MODBUS_DEFAULTS.LONG_PRESS_MS`.

- [ ] **Step 1: Write failing validation tests** in `structure-validation.spec.ts`:
  - `accepts a bool read binding on button.event` — channel `button`, property `event` permissions `['ev']`,
    data_type `enum`, read `{ register_type: 'discrete_input', address: 0, data_type: 'bool' }` → no issues.
  - `refuses a read binding on another ev property` → issue on `…read` with reason containing `button event`.
  - `refuses a non-bool level for button.event` — read `{ holding_register, data_type: 'uint16' }` without `bit` →
    issue on `…read.data_type`.
  - `refuses long_press_ms outside button.event` — on a `binary_input.state` read → issue on `…read.long_press_ms`.
  - `refuses long_press_ms out of range` — 99 and 10001 → issue; 100 and 10000 → none.
  - `refuses scale 0` — any read with `scale: 0` → issue on `…read.scale`.
- [ ] **Step 2: Run** `pnpm --filter ./apps/backend exec jest src/plugins/devices-modbus/lib/structure-validation.spec.ts` — the new tests fail.
- [ ] **Step 3: Implement** the rules in `validateProperty` / the binding validator; `long_press_ms` DTO field with
  `@IsOptional() @IsInt() @Min(100) @Max(10000)` and Swagger `name: 'long_press_ms'`; persist it in `toBinding`;
  migration adds nullable integer `longPressMs` to `devices_modbus_bindings` (follow `1000000000054-AddModbusDevices.ts`
  for the table rebuild style SQLite needs, `down` drops it).
- [ ] **Step 4: Template field.** Schema test `accepts long_press_ms on a binding` (100–10000), schema test
  `refuses the generic device category`, and expander test `carries long_press_ms into the preview binding`; add the
  field to schema, expander and preview model, and exclude `generic` from the schema's device category enum.
- [ ] **Step 5: Run** the three spec files and `pnpm run typeorm:migration:run` against a scratch DB copy — pass.
- [ ] **Step 6: Commit** `feat(backend): add the modbus long-press binding field`.

### Task 2: Button synthesizer

**Files:**
- Create: `apps/backend/src/plugins/devices-modbus/lib/button-synthesizer.ts`
- Test: `apps/backend/src/plugins/devices-modbus/lib/button-synthesizer.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export type ModbusButtonEvent = 'down' | 'up' | 'press' | 'long_press';
  export class ButtonSynthesizer {
  	constructor(longPressMs: number);
  	/** Decoded level at time `at` (ms); `null` = unknown, which clears the baseline. Returns events in order. */
  	observe(level: boolean | null, at: number): ModbusButtonEvent[];
  	reset(): void; // same as observe(null)
  }
  ```

- [ ] **Step 1: Write failing tests** (all `at` in ms):
  - `first level sets the baseline without events` — `observe(false,0)` → `[]`.
  - `short press` — false@0, true@100 → `['down']`; false@300 → `['up','press']`.
  - `long press while held` — false@0, true@100 → `['down']`; true@500 → `[]`; true@900 → `['long_press']`;
    true@1200 → `[]`; false@1300 → `['up']`.
  - `release after an unseen threshold` (R3) — false@0, true@100, false@1000 → `['long_press','up']`.
  - `baseline pressed emits only up` — true@0 → `[]`; true@2000 → `[]`; false@2100 → `['up']`.
  - `unknown level resets` — false@0, true@100, null@200 → `[]`; true@300 → `[]` (new baseline); false@400 → `['up']`.
  - `threshold is configurable` — `new ButtonSynthesizer(200)`: false@0, true@0, true@200 → `['long_press']`.
- [ ] **Step 2: Run** the spec — fails (module missing).
- [ ] **Step 3: Implement** with fields `level: boolean | null`, `downAt: number | null`, `longEmitted: boolean`.
- [ ] **Step 4: Run** — pass. **Step 5: Commit** `feat(backend): synthesise modbus button events from input levels`.

### Task 3: Poller and runtime publish button events and round integer values

**Files:**
- Modify: `apps/backend/src/plugins/devices-modbus/runtime/device-poller.ts`
- Modify: `apps/backend/src/plugins/devices-modbus/services/modbus-runtime.service.ts` (`load`, `snapshot`,
  `pollerCallbacks`; inject `ChannelInputOccurrencesService` and the core channels service to resolve each read
  property's channel and data type)
- Modify: `apps/backend/src/plugins/devices-modbus/devices-modbus.plugin.ts` if the injected services need imports
- Test: `runtime/device-poller.spec.ts`, `services/modbus-runtime.service.spec.ts`, Modbus e2e suite
  (`apps/backend/test/devices-modbus.e2e-spec.ts`)

**Interfaces:**
- Consumes: `ButtonSynthesizer` (Task 2), `ModbusBindingEntity.longPressMs`, `MODBUS_DEFAULTS.LONG_PRESS_MS` (Task 1).
- Produces:
  - `ModbusDeviceSnapshot.reads: Array<{ propertyId: string; binding: ModbusBindingEntity; dataType: DataTypeType; button: { channelId: string } | null }>`
  - `PollerCallbacks.occurrence(propertyId: string, channelId: string, event: ModbusButtonEvent, at: Date): Promise<void>`

- [ ] **Step 1: Write failing poller tests** (fake connection as in the existing spec):
  - `emits button events instead of samples` — a button read on a discrete input; levels 0,1,0 over three ticks →
    `occurrence` called with `down`, then `up`, `press`; `report` never called for that property.
  - `invalid level resets the button baseline` — level 1 (baseline), then three failed polls (lost), then level 0 →
    no `up` emitted after recovery.
  - `rounds decoded values for integer properties` — holding register raw 456, scale 0.1, `dataType: uchar` →
    `report(…, 46, …)`; same with `dataType: float` → `45.6`.
  - `pollNow skips button points` — `pollNow()` never calls `occurrence`.
- [ ] **Step 2: Run** — fail.
- [ ] **Step 3: Implement** in the poller: one `ButtonSynthesizer` per button read (threshold
  `binding.longPressMs ?? MODBUS_DEFAULTS.LONG_PRESS_MS`); in `readBlocks`, a button point's decoded value goes to
  `observe(value === null ? null : value === true, sampledAt.getTime())` and each event to `callbacks.occurrence`;
  every place that publishes `null` for a point (block exception, lost) also resets that point's synthesizer;
  `pollNow` filters button points out; non-button numbers pass through `coerce(value, dataType)` (R4) before
  `publish`. Callback failures are logged once per property like `failingReports`.
- [ ] **Step 4: Write failing runtime test** `publishes occurrences through ChannelInputOccurrencesService` — the
  callback calls `publishOccurrence({ deviceId, channelId, propertyId, event, sourceOccurrenceId: <unique string>, sourceTimestamp: at.toISOString() })`
  (check `CreateChannelInputOccurrenceDto` for the exact optional fields) and `load` builds `dataType`/`button` from
  the device's channels (button entries only for `channel.category === button && property.category === event`).
- [ ] **Step 5: Implement**, run unit specs — pass.
- [ ] **Step 6: E2E** `button point emits events` in the Modbus e2e suite against `ServerTCP`: create a device with a
  `button` channel bound to discrete input 0, toggle the server's input, and assert an occurrence event was emitted
  (spy on the event emitter or the service, whichever the suite already uses). Run — pass.
- [ ] **Step 7: Commit** `feat(backend): publish modbus button events and round integer values`.

### Task 4: Points update endpoint

**Files:**
- Create: `apps/backend/src/plugins/devices-modbus/dto/update-device-structure.dto.ts`
  (`UpdateModbusDeviceStructureDto`, `ReqUpdateModbusDeviceStructureDto`; Swagger names
  `DevicesModbusPluginUpdateDeviceStructure`, `DevicesModbusPluginReqUpdateDeviceStructure`)
- Modify: `services/modbus-device-structure.service.ts` (new `update(id, dto)`), `controllers/modbus-devices.controller.ts`
  (`@Put(':id/structure')`, operationId `update-devices-modbus-plugin-device-structure`, owner/admin only,
  returns `ModbusDeviceResponseModel`), `devices-modbus.openapi.ts` (register the new DTOs)
- Test: `services/modbus-device-structure.service.spec.ts`, Modbus e2e suite

**Interfaces:**
- Consumes: create DTOs `CreateModbusDeviceStructureChannelDto` (with optional `id`s), `validateModbusStructure`,
  `validateAgainstDatabase`.
- Produces: `ModbusDeviceStructureService.update(id: string, dto: UpdateModbusDeviceStructureDto): Promise<ModbusDeviceEntity>`;
  REST `PUT /api/v1/plugins/devices-modbus/devices/{id}/structure` body `{ data: { category, poll_interval_ms?, byte_order?, word_order?, channels } }`.

- [ ] **Step 1: Write failing service tests:**
  - `keeps ids of updated channels and properties` — create a device with one `switcher` channel, update it sending
    the same channel/property IDs with a new address and a new channel → old IDs still exist, binding address
    changed, new channel created.
  - `removes channels that are not listed` — the dropped channel, its properties and bindings are gone; the
    `device_information` channel is still there.
  - `refuses ids of another device` and `refuses a changed channel category` → `ModbusValidationException` with
    fields `channels[0].id` / `channels[0].category`.
  - `refuses a device_information channel in the body`.
  - `refuses the generic category` — on `update` and on `create` → issue on `category` with reason
    `The generic category is reserved and cannot be used for Modbus devices.`
  - `refused update changes nothing` — an invalid binding (e.g. coil with `uint16`) → exception, DB rows unchanged,
    `runtime.loadDevice` not called.
  - `reloads the runtime after commit` — `runtime.loadDevice(id)` called once after a valid update.
  - `keeps template provenance` — `templateId`/`templateRevision` unchanged after update.
- [ ] **Step 2: Run** — fail.
- [ ] **Step 3: Implement `update`** under `this.lock.runExclusive` and one `dataSource.transaction`: validate first
  (same validators as `create`, with the device's existing endpoint/unit excluded from the uniqueness check, plus the
  R5 ID rules), then remove unlisted channels and update/insert the rest through the core `ChannelsService` /
  `ChannelsPropertiesService` methods that accept a manager (so core events and cleanup run as for any edit), delete
  all `ModbusBindingEntity` rows of the device and insert the new ones with `toBinding`, update category and polling
  fields; after commit write static values and call `runtime.loadDevice(id)` exactly as `activate` does.
- [ ] **Step 4: Run** — pass.
- [ ] **Step 5: E2E** `PUT structure updates bindings and keeps ids` (200, IDs kept, `GET :id/bindings` shows the new
  address) and `PUT structure is refused for viewers` (403). Run — pass.
- [ ] **Step 6: Commit** `feat(backend): update the points of a modbus device`.

### Task 5: Read-only provenance and generated clients

**Files:**
- Modify: `apps/backend/src/plugins/devices-modbus/dto/update-device.dto.ts` (remove `template_id`, `template_revision`)
- Modify: whatever maps PATCH fields onto the entity, if it copies them explicitly
- Test: Modbus e2e suite
- Regenerate: `spec/api/v1/openapi.json`, `apps/admin/src/openapi.ts`, `apps/panel/lib/api/` via `pnpm run generate:openapi`
- Add: this plan file to the PR

- [ ] **Step 1: Write failing e2e test** `PATCH cannot change template provenance` — PATCH a template-created device
  with `template_id: 'other'` → either 400 or the field ignored (match what the global `ValidationPipe` does with
  unknown fields; assert the stored `template_id` is unchanged in both cases).
- [ ] **Step 2: Run** — fails (the field is applied today).
- [ ] **Step 3: Remove the fields**, run the test — pass.
- [ ] **Step 4: Regenerate** with `pnpm run generate:openapi`; run `pnpm run lint:js`, backend unit and e2e suites,
  and admin `type-check` (the generated types changed) — all pass. Do not edit the generated files by hand.
- [ ] **Step 5: Commit** `feat(backend): make modbus template provenance read-only`, push, open PR A.

---

## PR B — admin (`t3/modbus-completeness-admin`, base PR A, title `feat(admin): add modbus analog, valve and button points and point editing`)

### Task 6: Point model, capabilities and categories

**Files:**
- Modify: `apps/admin/src/plugins/devices-modbus/lib/points.ts` (`ModbusPointBinding.longPressMs: number | null`;
  `ModbusPoint.channelId: string | null`, `ModbusPoint.propertyId: string | null`; `toRequestBinding` sends
  `long_press_ms` when not null; `toCreateRequest` and a new `toUpdateRequest` send `id`s when not null;
  `suggestCategory` per R7)
- Modify: `lib/capabilities.ts`
- Modify: `components/wizard/modbus-wizard-device-step.vue` (category options per R7)
- Test: `lib/points.spec.ts`, `lib/capabilities.spec.ts`, `components/wizard/modbus-wizard-device-step` spec if present
  (create `modbus-wizard-device-step.spec.ts` otherwise)

**Interfaces:**
- Produces:
  ```ts
  export interface ModbusCapability {
  	key: string; channelCategory: string; propertyCategory: string;
  	kind: 'bool' | 'number' | 'button';
  	readable: boolean; writable: boolean;
  	/** spec data type of the property: bool, float, uchar, enum … */
  	dataType: string;
  	permissions: string[];
  	unit: string | null;
  	/** Static sibling properties the channel needs, e.g. valve.type = generic. */
  	statics: { propertyCategory: string; dataType: string; permissions: string[]; value: string | number | boolean; format: string[] | null }[];
  }
  export function toUpdateRequest(input: ModbusUpdateInput): ApiUpdateModbusDeviceStructure;
  ```
  `CUSTOM_CAPABILITIES` keys: `binary_input.state`, `switcher.on`, `outlet.on`, `valve.on` (statics `type=generic`),
  `button.event` (kind `button`, permissions `['ev']`, dataType `enum`, format `['press','long_press','down','up']`),
  `analog_input.value` (number, `float`), `temperature.temperature` (`float`, `°C`), `humidity.humidity`
  (`uchar`, `%`), `electrical_power.power` (`float`, `W`), `pressure.pressure` (`float`, `kPa`),
  `illuminance.illuminance` (`float`, `lx`). Number capabilities default to `input_register` / `int16`;
  `registerTypesFor` offers input and holding registers for them; button offers the bool tables and register bits.

- [ ] **Step 1: Failing tests:** `pointBaseFor` for `valve.on` adds the static `type` sibling point;
  `button.event` has permissions `['ev']`, a bool read binding and `longPressMs: null`; `humidity.humidity`
  defaults to `input_register`/`int16`; `suggestCategory` returns `valve`, `switcher`, `sensor`, `input_controller`
  for the R7 cases; `toRequestBinding` emits `long_press_ms`; `toUpdateRequest` keeps `id`s; device step lists the
  four R7 categories and never `generic`, even when the current value is `generic`.
- [ ] **Step 2: Run** `pnpm --filter ./apps/admin exec vitest run src/plugins/devices-modbus/lib` — fail.
- [ ] **Step 3: Implement**; locales for the new capability and category labels in all six files.
- [ ] **Step 4: Run** — pass. **Step 5: Commit** `feat(admin): offer modbus analog, sensor, valve and button points`.

### Task 7: Point editor for numeric and button points

**Files:**
- Modify: `components/wizard/modbus-point-editor.vue`, `lib/points.ts` (`bindingIssues`: `longPressRange`,
  `longPressNotButton`; number kinds refuse `bool` unless `bit` is set)
- Modify: `components/wizard/modbus-wizard-device-step.vue` (the existing button hint now shows for `button.event` points)
- Test: `components/wizard/modbus-point-editor.spec.ts`, `lib/points.spec.ts`

- [ ] **Step 1: Failing tests:** editor shows scale/offset/unit for a `temperature` point and data types
  `int16, uint16, int32, uint32, float32`; shows a "Long press (ms)" input only for `button.event` with min 100,
  max 10000, placeholder 800; `bindingIssues` flags 50 and 20000 ms; saving a valve point keeps its static `type`.
- [ ] **Step 2: Run** — fail. **Step 3: Implement** (new error keys in all six locales).
- [ ] **Step 4: Run** — pass. **Step 5: Commit** `feat(admin): edit modbus numeric and button points`.

### Task 8: Edit the points of an existing device

**Files:**
- Modify: `composables/useModbusDeviceWizard.ts` (`mode: 'create' | 'edit'`, `loadDevice(id)`, `submit()`)
- Modify: `views/view-modbus-wizard.vue` (edit mode shows steps Points, Device, Review and starts on Points)
- Modify: `router/index.ts`, `devices-modbus.constants.ts` (`RouteNames.EDIT = 'devices_modbus-edit'`, path
  `devices-modbus/:id/points`)
- Modify: `components/modbus-device-section.vue` ("Edit points" button → `RouteNames.EDIT`; "template updated" tag
  when the catalog's revision of `templateId` differs from `templateRevision`)
- Test: `composables/useModbusDeviceWizard.spec.ts`, `components/modbus-device-section.spec.ts`

**Interfaces:**
- Consumes: `GET …/devices/{id}/bindings`, the devices module stores for channels and properties, `toUpdateRequest`
  (Task 6), `PUT …/devices/{id}/structure` (Task 4).
- Produces: `IUseModbusDeviceWizard.mode: Ref<'create' | 'edit'>`, `loadDevice(id: string): Promise<void>`,
  `submit(): Promise<string>` (create → POST, edit → PUT; `create` stays as an alias for existing callers).

- [ ] **Step 1: Failing tests:** `loadDevice` builds one point per bound or static property with `channelId` and
  `propertyId`, sets endpoint, unit, category, poll interval and orders, skips `device_information`, and sets
  `step` to `POINTS`; in edit mode `canContinue` never needs the endpoint or template steps; `submit` in edit mode
  sends `PUT` with the IDs and does not send provenance; the device section shows the edit button for owners/admins
  and the "template updated" tag when revisions differ.
- [ ] **Step 2: Run** — fail. **Step 3: Implement** (locales in all six files).
- [ ] **Step 4: Run** the admin suite, type-check, eslint, prettier — pass.
- [ ] **Step 5: Commit** `feat(admin): edit the points of a modbus device`, push, open PR B (base PR A's branch).

---

## PR C — panel (`t3/modbus-panel-stub`, title `feat(panel): add the modbus device plugin stub`)

### Task 9: Panel stub

**Files:**
- Create: `apps/panel/lib/plugins/devices-modbus/{constants.dart,plugin.dart,mappers/mappers.dart,models/device.dart,models/channel.dart,models/property.dart}`
  mirroring `apps/panel/lib/plugins/devices-third-party/` with type `devices-modbus` and the Modbus device fields the
  generated API client exposes (endpoint ID, unit ID, poll interval; read-only)
- Modify: `apps/panel/lib/modules/devices/module.dart` (`DevicesModbusPlugin.register();` after Zigbee2MQTT)
- Test: `apps/panel/test/plugins/devices_modbus/mappers_test.dart` — a device JSON of type `devices-modbus` maps to
  the Modbus device model with its unit ID; a channel and property map to the Modbus models.

- [ ] **Step 1:** Write the mapper test; run `flutter test test/plugins/devices_modbus` — fails.
- [ ] **Step 2:** Add the stub and registration; run the test and `melos analyze` — pass.
- [ ] **Step 3: Commit**, push, open PR C.

## PR D — docs (`t3/modbus-docs`, title `docs(cross): document the modbus plugin and its hardware acceptance`)

### Task 10: User documentation and acceptance checklist

**Files:**
- Create: `apps/website/app/docs/extensions/modbus/page.mdx` — endpoints (TCP vs RTU over TCP, one connection per
  gateway), the wizard steps, address notation (0-based PDU, 1-based, 4xxxx), templates (built-in, user files and
  the reload button, YAML fields including `long_press_ms`), buttons (poll interval 100–250 ms, presses shorter than
  one poll can be missed, 800 ms default threshold), editing points, splitting a module with virtual devices
- Modify: `apps/website/app/docs/extensions/_meta.js` (entry after Homey), `apps/website/app/docs/extensions/device-integrations/page.mdx` (table row linking the page)
- Create: `docs/modbus-hardware-acceptance.md` — the spec's Testing › Hardware acceptance items as a checklist with
  a results table (date, firmware, gateway mode, result), plus the Waveshare settings to record (port per mode,
  9600 8N1, single client, relay unit ID) and the N4D8B08 inputs at PDU 81–88 to confirm
- Modify: `docs/superpowers/plans/2026-11-10-modbus-templates.md` — correct the stale "inputs at PDU 129–136" note
  to 81–88 (matches the template and spec)

- [ ] **Step 1:** Write the pages; run `pnpm --filter ./apps/website run build` (or its lint) — passes.
- [ ] **Step 2: Commit**, push, open PR D.

Phase 5 (hardware acceptance on both test setups) is run by the user with `docs/modbus-hardware-acceptance.md`.
