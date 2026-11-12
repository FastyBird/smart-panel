# Cameras — Plan 1: Spec Extension (UP-1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The device spec, database constraints, admin and panel can represent object detections, sound detections
and a second camera stream on `camera` and `doorbell` devices.

**Architecture:** Two new channel categories (`object_detection`, `sound_detection`) and two new property
categories (`object_type`, `sound_type`) are added to the YAML spec, its JSON schemas and the backend enums. One
incremental migration widens the two category CHECK constraints in place, without rebuilding the tables. Admin and
panel get the hand-written parts that the generators do not produce: ordering, labels, icons and channel views.

**Tech Stack:** YAML spec + Ajv, NestJS + TypeORM (SQLite), Jest, Vue + vue-i18n + Vitest, Flutter.

**Spec:** `docs/superpowers/specs/2026-10-06-unifi-protect-integration-design.md` §3.2, §6 (D8), §10, §14a, §15.
Issue #1177. Roadmap: `docs/superpowers/plans/2026-11-12-cameras-roadmap.md` (amendments A1, A10, A11).

## Global Constraints

- Branch `feat/camera-spec-extension` from `main`. One PR titled
  `feat(cross): extend camera specs with object detection and multi-stream channels`, body `Closes #1177`.
- Commit messages `<type>(<scope>): <lowercase imperative subject>`, scopes from `CLAUDE.md`; end with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- TypeScript: tabs, single quotes, semicolons, trailing commas; print width 120 (backend), 150 (admin).
- Dart: package imports only.
- Never edit generated files. These are git-ignored and are regenerated, not committed: `apps/backend/src/spec/`,
  `apps/admin/src/spec/`, `spec/api/v1/openapi.json`, `apps/admin/src/openapi.ts`, `apps/panel/lib/api/`,
  `apps/panel/lib/spec/`. Committed generated files: `apps/panel/lib/l10n/app_localizations*.dart`.
- Migration file `1000000000059-AddDetectionCategories.ts`. Never modify an earlier migration. If `main` has a
  migration 59 when the branch is cut, take the next free number and rename consistently.
- Exact values (verbatim from the issue):
  - `object_type` format `["person","vehicle","animal","package","license_plate","face","unknown"]`
  - `sound_type` format `["glass_break","burglar_alarm","siren","baby_cry","speech","dog_bark","car_horn","unknown"]`
  - `camera.source` description: `Stable, non-secret identifier of the stream source; never a URL or credential`
- The migration must not rebuild `devices_module_channels` or `devices_module_channels_properties`. Migrations
  048, 049 and 054 attached columns, triggers and indexes to the device tables, and
  `plugins/devices-virtual/services/thermostat-creation-catalog.ts` verifies their stored SQL at runtime.

## Review Focus

1. **A database that already holds devices, channels and catalog births**: after `up()`, every row keeps its
   `rowid` and `catalogBirth`, and every index and trigger is byte-identical. → Task 2.
2. **A stored CHECK list that does not look as expected** (a hand-edited database): `up()` throws before changing
   anything and the migration transaction rolls back. → Task 2.
3. **Rows using the new categories when `down()` runs**: they become `generic`; nothing is deleted. → Task 2.
4. **A doorbell with two `camera` channels on the panel**: `cameraChannel` returns the main one, not whichever
   comes first. → Task 4.
5. **A camera with several `object_detection` channels in the admin channel-add form**: the category stays
   selectable after the first one exists. → Task 3.

---

### Task 1: Spec YAML and schemas

**Files:**
- Modify: `spec/devices/channels.yaml` (new channels after `occupancy`, line ~1195 block; `camera.source` at ~2646)
- Modify: `spec/devices/channels.schema.yaml` (`definitions.propertyCategoryEnum` ~121; channel `category` enum ~310)
- Modify: `spec/devices/devices.yaml` (`camera` 613–702, `doorbell` 704–790)
- Modify: `spec/devices/devices.schema.yaml` (channel-category enum ~163–212)

**Interfaces:**
- Produces: channel categories `object_detection`, `sound_detection`; property categories `object_type`,
  `sound_type`. Every later task uses these four strings.

- [ ] **Step 1: Add the two channels to `channels.yaml`**, directly after the `occupancy` channel, and run the
  validator to see it fail on the unknown categories.

```yaml
object_detection:
  category: object_detection
  name:
    en: Object detection
  description:
    en: >-
      Reports whether a camera or sensor currently detects an object of one type, such as a person or a vehicle.
  docGroup: security
  properties:
    detected:
      category: detected
      required: true
      description:
        en: Binary detection state (true = detected)
      permissions:
        - ro
      data_type: bool
      unit: null
      format: null
    object_type:
      category: object_type
      required: true
      description:
        en: Type of object this channel reports
      permissions:
        - ro
      data_type: enum
      unit: null
      format: ["person","vehicle","animal","package","license_plate","face","unknown"]
    active:
      # copy the `active` property block of the `motion` channel unchanged
    tampered:
      # copy the `tampered` property block of the `motion` channel unchanged
```

`sound_detection` is the same block with `name.en: Sound detection`, description
`Reports whether a camera or sensor currently hears a sound of one type, such as breaking glass or a siren.`, and
`sound_type` (description `Type of sound this channel reports`, format
`["glass_break","burglar_alarm","siren","baby_cry","speech","dog_bark","car_horn","unknown"]`) in place of
`object_type`.

Run: `node spec/devices/validate.mjs`
Expected: FAIL naming `object_detection` / `object_type` as not allowed enum values.

- [ ] **Step 2: Extend the schema enums.** In `channels.schema.yaml` add `object_type` and `sound_type` to
  `propertyCategoryEnum` and `object_detection`, `sound_detection` to the channel `category` enum. In
  `devices.schema.yaml` add `object_detection`, `sound_detection` to the channel-category enum. Keep each list's
  existing ordering style.

- [ ] **Step 3: Change `camera.source` in `channels.yaml`**: `description.en` becomes
  `Stable, non-secret identifier of the stream source; never a URL or credential`. Nothing else in the `camera`
  channel changes.

- [ ] **Step 4: Change the `camera` and `doorbell` devices in `devices.yaml`.**
  - `camera` channel entry: `multiple: true` on both devices.
  - Add these optional entries to both devices (`required: false`), copying each `description.en` from the
    channel's own description in `channels.yaml`:

    | Channel | `multiple` |
    |---|---|
    | `object_detection` | `true` |
    | `sound_detection` | `true` |
    | `indicator` | `false` |
    | `illuminance` | `false` |
    | `smoke` | `false` |
    | `carbon_monoxide` | `false` |

  - Skip an entry a device already has. Keep entries in the file's existing order (required first, then
    alphabetical).
  - Replace the camera developer note `Light channel can control built-in IR or status LEDs.` with
    `The indicator channel controls the status LED; several camera channels represent several lenses.`

- [ ] **Step 5: Validate.**

Run: `node spec/devices/validate.mjs`
Expected: PASS for both files.

- [ ] **Step 6: Commit.**

```bash
git add spec/devices
git commit -m "feat(spec): add object and sound detection channels and multi-stream cameras"
```

---

### Task 2: Backend enums and in-place CHECK migration

**Files:**
- Modify: `apps/backend/src/modules/devices/devices.constants.ts` (`ChannelCategory` 110–166, `PropertyCategory` 168–272)
- Create: `apps/backend/src/migrations/1000000000059-AddDetectionCategories.ts`
- Create: `apps/backend/src/migrations/category-check.utils.ts`
- Test: `apps/backend/src/migrations/__tests__/category-check.utils.spec.ts`
- Test: `apps/backend/src/migrations/__tests__/1000000000059-AddDetectionCategories.spec.ts`

**Interfaces:**
- Produces: `ChannelCategory.OBJECT_DETECTION = 'object_detection'`, `ChannelCategory.SOUND_DETECTION =
  'sound_detection'`, `PropertyCategory.OBJECT_TYPE = 'object_type'`, `PropertyCategory.SOUND_TYPE = 'sound_type'`.
- Produces: `extendCategoryCheck(tableSql: string, values: readonly string[]): string` and
  `reduceCategoryCheck(tableSql: string, values: readonly string[]): string` in `category-check.utils.ts`, reusable
  by later category migrations.

Technique: SQLite's documented procedure for changing a CHECK constraint without touching table content — edit
the stored `CREATE TABLE` text in `sqlite_master` under `PRAGMA writable_schema`, then bump `PRAGMA schema_version`
so the connection reloads the schema. Rows, rowids, indexes and triggers are not touched.

- [ ] **Step 1: Write the failing test for the pure helper** in `category-check.utils.spec.ts`.

```ts
const SQL = `CREATE TABLE "t" ("id" varchar PRIMARY KEY NOT NULL, "category" varchar CHECK( "category" IN ('generic','motion') ) NOT NULL DEFAULT ('generic'), "dataType" varchar CHECK( "dataType" IN ('bool','enum') ) NOT NULL, "catalogBirth" integer)`;

it('appends values to the category list only', () => {
	expect(extendCategoryCheck(SQL, ['object_detection', 'sound_detection'])).toBe(
		SQL.replace(`('generic','motion')`, `('generic','motion','object_detection','sound_detection')`),
	);
});
it('is reversible', () => {
	const extended = extendCategoryCheck(SQL, ['object_detection']);
	expect(reduceCategoryCheck(extended, ['object_detection'])).toBe(SQL);
});
it('throws when the category CHECK is missing or appears twice', () => {
	expect(() => extendCategoryCheck(SQL.replace('"category" varchar CHECK', '"category" varchar'), ['x'])).toThrow();
	expect(() => extendCategoryCheck(`${SQL}; ${SQL}`, ['x'])).toThrow();
});
it('throws when a value is already present, or absent on reduce', () => {
	expect(() => extendCategoryCheck(SQL, ['motion'])).toThrow();
	expect(() => reduceCategoryCheck(SQL, ['object_detection'])).toThrow();
});
it('rejects values that are not lowercase snake case', () => {
	expect(() => extendCategoryCheck(SQL, [`x') OR 1=1 --`])).toThrow();
});
```

- [ ] **Step 2: Run it.**

Run (from `apps/backend`): `npx jest src/migrations/__tests__/category-check.utils.spec.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the two helpers** in `category-check.utils.ts`. Match exactly one
  `"category" varchar CHECK( "category" IN (<list>) )`; values must match `/^[a-z][a-z0-9_]*$/`; the `dataType`
  CHECK must never match.

- [ ] **Step 4: Run it.** Expected: PASS.

- [ ] **Step 5: Add the four enum members** to `devices.constants.ts`, at their alphabetical positions.

- [ ] **Step 6: Write the failing migration test** `1000000000059-AddDetectionCategories.spec.ts`. Copy the
  `beforeEach`/`afterEach` harness of `__tests__/1000000000026-AddHardwareInputCategories.spec.ts` with the file
  filter `f < '1000000000059'`, and its seeding statements for one device, one channel and one property. Tests:

```ts
const snapshot = () =>
	queryRunner.query(`SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name`);
const births = () =>
	queryRunner.query(`SELECT 'c' k, rowid r, id, catalogBirth b FROM devices_module_channels
		UNION ALL SELECT 'p', rowid, id, catalogBirth FROM devices_module_channels_properties ORDER BY 1, 2`);

it('rejects the new categories before up() and accepts them after', async () => {
	await expect(insertChannel('ch-od', 'object_detection')).rejects.toThrow(/CHECK constraint failed/);
	await expect(insertProperty('pr-ot', 'object_type')).rejects.toThrow(/CHECK constraint failed/);
	await migration.up(queryRunner);
	await insertChannel('ch-od', 'object_detection');
	await insertChannel('ch-sd', 'sound_detection');
	await insertProperty('pr-ot', 'object_type');
	await insertProperty('pr-st', 'sound_type');
	await expect(insertChannel('ch-bad', 'not_a_category')).rejects.toThrow(/CHECK constraint failed/);
});

it('changes nothing in the schema except the two category lists', async () => {
	const before = await snapshot();
	await migration.up(queryRunner);
	const after = (await snapshot()).map((row) => ({
		...row,
		sql: row.sql?.replace(`,'object_detection','sound_detection'`, '').replace(`,'object_type','sound_type'`, ''),
	}));
	expect(after).toEqual(before);
});

it('keeps rowids and catalog births', async () => {
	const before = await births();
	expect(before.length).toBeGreaterThan(0);
	await migration.up(queryRunner);
	expect(await births()).toEqual(before);
});

it('leaves a consistent database', async () => {
	await migration.up(queryRunner);
	expect(await queryRunner.query('PRAGMA integrity_check')).toEqual([{ integrity_check: 'ok' }]);
	expect(await queryRunner.query('PRAGMA foreign_key_check')).toEqual([]);
	expect(await queryRunner.query('PRAGMA writable_schema')).toEqual([{ writable_schema: 0 }]);
});

it('down() maps rows to generic and restores the original schema', async () => {
	const before = await snapshot();
	await migration.up(queryRunner);
	await insertChannel('ch-od', 'object_detection');
	await insertProperty('pr-ot', 'object_type');
	await migration.down(queryRunner);
	expect(await snapshot()).toEqual(before);
	expect(await queryRunner.query(`SELECT category FROM devices_module_channels WHERE id = 'ch-od'`)).toEqual([{ category: 'generic' }]);
	expect(await queryRunner.query(`SELECT category FROM devices_module_channels_properties WHERE id = 'pr-ot'`)).toEqual([{ category: 'generic' }]);
});

it('throws and changes nothing when a stored CHECK list is unexpected', async () => {
	// Pre-apply the change by hand so the helper sees the values already present.
	await migration.up(queryRunner);
	const before = await snapshot();
	await expect(migration.up(queryRunner)).rejects.toThrow();
	expect(await snapshot()).toEqual(before);
	expect(await queryRunner.query('PRAGMA writable_schema')).toEqual([{ writable_schema: 0 }]);
});
```

Add the catalog check the 026 spec uses in its `migration transaction compatibility` block: after `up()`,
`await dataSource.transaction((manager) => initializeThermostatCreationCatalog(manager, false))` resolves.

- [ ] **Step 7: Run it.**

Run: `npx jest src/migrations/__tests__/1000000000059-AddDetectionCategories.spec.ts`
Expected: FAIL, migration module not found.

- [ ] **Step 8: Implement the migration** `AddDetectionCategories1000000000059` with `transaction = false` and the
  same self-managed transaction frame as migration 026. The ordering below is the part the tests do not determine:

```ts
// up(), inside the transaction, for (table, values) of
//   ['devices_module_channels', ['object_detection', 'sound_detection']],
//   ['devices_module_channels_properties', ['object_type', 'sound_type']]
// 1. read sql from sqlite_master WHERE type = 'table' AND name = ?
// 2. next = extendCategoryCheck(sql, values)      // throws before any write
// then, after BOTH tables are computed:
// 3. PRAGMA writable_schema = ON
// 4. UPDATE sqlite_master SET sql = ? WHERE type = 'table' AND name = ?   (per table)
// 5. PRAGMA schema_version = <current + 1>
// 6. PRAGMA writable_schema = OFF                  // also in finally
// 7. PRAGMA integrity_check must return 'ok', else throw (rolls back)
```

  `down()` first runs `UPDATE … SET "category" = 'generic' WHERE "category" IN (…)` on both tables, then applies
  `reduceCategoryCheck` with the same seven steps.

- [ ] **Step 9: Run it.**

Run: `npx jest src/migrations/__tests__/1000000000059-AddDetectionCategories.spec.ts`
Expected: PASS.

If steps 3–5 are refused by the driver (`table sqlite_master may not be modified`), stop and replace the technique
with a rowid-preserving rebuild: read every index and trigger `sql` for the table from `sqlite_master`, create
`temporary_<table>` from the extended SQL, `INSERT INTO temporary_<table> (rowid, <cols>) SELECT rowid, <cols>`,
drop, rename, and re-execute the saved index and trigger SQL. The same tests must pass unchanged.

- [ ] **Step 10: Run the migration suite and the devices module tests.**

Run: `pnpm run generate:spec && npx jest src/migrations src/modules/devices`
Expected: PASS. A failure in another migration's "full catalog" test means it enumerates all migrations and needs
this one's effect accounted for; fix that test's expectation, not the migration.

- [ ] **Step 11: Commit.**

```bash
git add apps/backend/src/modules/devices/devices.constants.ts apps/backend/src/migrations
git commit -m "feat(backend): allow object and sound detection categories in the database"
```

---

### Task 3: Admin ordering, icons and locales

**Files:**
- Modify: `apps/admin/src/modules/devices/devices.mapping.ts` (`deviceChannelsSortingSpecification`: camera 92–103, doorbell 112–123)
- Modify: `apps/admin/src/modules/devices/composables/useChannelIcon.ts`, `useChannelPropertyIcon.ts`
- Modify: `apps/admin/src/modules/devices/locales/{cs-CZ,de-DE,en-US,es-ES,pl-PL,sk-SK}.json`
- Test: `apps/admin/src/modules/devices/locales/locales.spec.ts` (existing), `apps/admin/src/modules/devices/devices.mapping.spec.ts` (create if absent)

**Interfaces:**
- Consumes: generated `DevicesModuleChannelCategory` / `DevicesModuleChannelPropertyCategory` enums containing the
  four new values (regenerate first, Step 1).

- [ ] **Step 1: Regenerate types.**

Run (repo root): `pnpm run generate:spec && pnpm run generate:openapi`
Expected: `apps/admin/src/openapi.ts` contains `object_detection` and `sound_type`.

- [ ] **Step 2: Run the locale test to see it fail.**

Run: `pnpm --filter ./apps/admin exec vitest --run src/modules/devices/locales/locales.spec.ts`
Expected: FAIL: missing `categories.channels.object_detection`, `categories.channels.sound_detection`,
`categories.channelsProperties.object_type`, `categories.channelsProperties.sound_type` in every locale.

- [ ] **Step 3: Add the locale keys** to all six files, appended at the end of each block: `categories.channels.*`,
  `texts.channels.description.*` (the channel descriptions from Task 1, translated) and
  `categories.channelsProperties.*`.

  | Key | en-US | cs-CZ | de-DE | es-ES | pl-PL | sk-SK |
  |---|---|---|---|---|---|---|
  | `object_detection` | Object detection | Detekce objektů | Objekterkennung | Detección de objetos | Wykrywanie obiektów | Detekcia objektov |
  | `sound_detection` | Sound detection | Detekce zvuku | Geräuscherkennung | Detección de sonido | Wykrywanie dźwięku | Detekcia zvuku |
  | `object_type` | Object type | Typ objektu | Objekttyp | Tipo de objeto | Typ obiektu | Typ objektu |
  | `sound_type` | Sound type | Typ zvuku | Geräuschtyp | Tipo de sonido | Typ dźwięku | Typ zvuku |

  Then search `en-US.json` for `single_press`. If enum values of other properties have labels there, add labels
  for the fifteen new enum values in the same block in all six locales; if the search finds nothing, add none.

- [ ] **Step 4: Write the ordering test** in `devices.mapping.spec.ts`.

```ts
it.each([DevicesModuleDeviceCategory.camera, DevicesModuleDeviceCategory.doorbell])('orders detection channels for %s', (category) => {
	const order = deviceChannelsSortingSpecification[category];
	for (const channel of ['object_detection', 'sound_detection', 'indicator', 'illuminance', 'smoke', 'carbon_monoxide']) {
		expect(order).toContain(channel);
	}
	expect(order.indexOf('motion')).toBeLessThan(order.indexOf('object_detection'));
	expect(order.indexOf('object_detection')).toBeLessThan(order.indexOf('sound_detection'));
});
it('marks camera and detection channels as multiple on cameras', () => {
	const spec = deviceChannelsSpecificationMappers[DevicesModuleDeviceCategory.camera];
	expect(spec.multiple).toEqual(expect.arrayContaining(['camera', 'object_detection', 'sound_detection']));
});
```

  Adjust the two identifiers to the file's actual exports if they are named differently; the assertions stay.

- [ ] **Step 5: Extend both sorting lists**: insert `object_detection`, `sound_detection`, `smoke`,
  `carbon_monoxide` directly after `motion`, and `indicator`, `illuminance` directly before `battery`.

- [ ] **Step 6: Add icons.** `useChannelIcon.ts`: `object_detection` → `mdi:account-search`, `sound_detection` →
  `mdi:ear-hearing`. `useChannelPropertyIcon.ts`: `object_type` → `mdi:shape`, `sound_type` → `mdi:waveform`.

- [ ] **Step 7: Run admin tests and lint.**

Run: `pnpm --filter ./apps/admin exec vitest --run src/modules/devices && pnpm --filter ./apps/admin run lint:js`
Expected: PASS.

- [ ] **Step 8: Commit.**

```bash
git add apps/admin/src/modules/devices
git commit -m "feat(admin): label and order object and sound detection channels"
```

---

### Task 4: Panel channel views, mappers and labels

**Files:**
- Create: `apps/panel/lib/modules/devices/views/channels/object_detection.dart`, `sound_detection.dart`
- Create: `apps/panel/lib/modules/devices/views/properties/object_type.dart`, `sound_type.dart`
- Modify: `apps/panel/lib/modules/devices/mappers/channel.dart` (`channelViewsMappers` 120–278, `buildChannelIcon` 299–420)
- Modify: `apps/panel/lib/modules/devices/mappers/property.dart` (`buildChannelPropertyView` 165+, `channelPropertyIconMappers` 352)
- Modify: `apps/panel/lib/modules/devices/views/devices/camera.dart`, `doorbell.dart`, `mixins.dart` (136–184)
- Modify: `apps/panel/lib/modules/devices/presentation/utils/sensor_utils.dart` (label switch ~808)
- Modify: `apps/panel/lib/l10n/app_{en,cs,de,es,pl,sk}.arb` (+ regenerated `app_localizations*.dart`)
- Test: `apps/panel/test/modules/devices/views/channel_views_spec_validation_test.dart` (mapping tables ~43, ~340)
- Test: `apps/panel/test/modules/devices/views/detection_views_test.dart` (create)

**Interfaces:**
- Consumes: generated `DevicesModuleChannelCategory.objectDetection`, `.soundDetection`;
  `DevicesModulePropertyCategory.objectType`, `.soundType` (after `melos rebuild-all`).
- Produces (used by panel Plan 7):
  - `ObjectDetectionChannelView` with `bool get detected`, `String? get objectType`
  - `SoundDetectionChannelView` with `bool get detected`, `String? get soundType`
  - on `CameraDeviceView` and `DoorbellDeviceView`: `List<CameraChannelView> get cameraChannels`,
    `List<ObjectDetectionChannelView> get objectDetectionChannels`,
    `List<SoundDetectionChannelView> get soundDetectionChannels`; `cameraChannel` keeps its current type on each.

- [ ] **Step 1: Regenerate the panel client and specs.**

Run (repo root): `melos rebuild-all`
Expected: `apps/panel/lib/api/models/devices_module_channel_category.dart` contains `objectDetection`.

- [ ] **Step 2: Register the new views in the spec-validation test** — add `'object_detection':
  'object_detection.dart'` / `'ObjectDetectionChannelView'` and the `sound_detection` pair to
  `getChannelFileMapping` and `getChannelViewClassMapping`. Then write `detection_views_test.dart`:

```dart
test('object detection view exposes detected and type', () {
  final view = buildObjectDetectionView(detected: true, objectType: 'person');
  expect(view.detected, isTrue);
  expect(view.objectType, 'person');
});
test('a missing detected value reads as not detected', () {
  expect(buildObjectDetectionView(detected: null, objectType: 'animal').detected, isFalse);
});
test('sound detection view exposes detected and type', () {
  final view = buildSoundDetectionView(detected: true, soundType: 'glass_break');
  expect(view.detected, isTrue);
  expect(view.soundType, 'glass_break');
});
test('cameraChannel prefers the main channel over the package channel', () {
  final device = buildDoorbellView(cameraChannelIdentifiers: ['camera.package', 'camera.main']);
  expect(device.cameraChannel!.identifier, 'camera.main');
  expect(device.cameraChannels, hasLength(2));
});
test('cameraChannel falls back to the first channel when none is named main', () {
  final device = buildCameraView(cameraChannelIdentifiers: ['front']);
  expect(device.cameraChannel.identifier, 'front');
});
test('a camera lists every object detection channel', () {
  final device = buildCameraView(objectTypes: ['person', 'vehicle', 'animal']);
  expect(device.objectDetectionChannels.map((c) => c.objectType), ['person', 'vehicle', 'animal']);
});
```

  Write the `build*` helpers in the test file from the model constructors used in
  `test/modules/devices/views/hardware_input_views_test.dart`.

- [ ] **Step 3: Run the tests.**

Run (from `apps/panel`): `flutter test test/modules/devices/views/`
Expected: FAIL, the view classes do not exist.

- [ ] **Step 4: Create the property views** `ObjectTypeChannelPropertyView` and `SoundTypeChannelPropertyView`,
  shaped like `views/properties/type.dart`, and register them in `buildChannelPropertyView` and
  `channelPropertyIconMappers` (`MdiIcons.shape`, `MdiIcons.waveform`).

- [ ] **Step 5: Create the channel views**, shaped like `views/channels/motion.dart` without the distance and fault
  parts: required properties with `.first`, optional `active` and `tampered` with `.firstOrNull` (the
  spec-validation test enforces this). Register both in `channelViewsMappers` and `buildChannelIcon`
  (`MdiIcons.accountSearch`, `MdiIcons.earHearing`).

- [ ] **Step 6: Extend the device views.** Add the three list getters. Main-channel rule for `cameraChannel`: the
  channel whose identifier equals `main` or ends with `.main`; otherwise the first. `mixins.dart` keeps reading the
  single `cameraChannel`.

- [ ] **Step 7: Add labels.** `.arb` keys `sensor_label_object_detection` and `sensor_label_sound_detection` in all
  six files (texts from the Task 3 table), cases in the `sensor_utils.dart` label switch, then regenerate.

Run (from `apps/panel`): `flutter gen-l10n`

- [ ] **Step 8: Run tests and analysis.**

Run: `flutter test test/modules/devices/ && melos analyze`
Expected: PASS, no analyzer issues.

- [ ] **Step 9: Commit.**

```bash
git add apps/panel/lib apps/panel/test
git commit -m "feat(panel): add object and sound detection channel views"
```

---

### Task 5: Cross-app verification and PR

**Files:**
- Modify: `tasks/epics/EPIC-UNIFI-PROTECT.md` (tick UP-1)
- Modify: `docs/superpowers/specs/2026-10-06-unifi-protect-integration-design.md` (§15: note the in-place technique)

- [ ] **Step 1: Check that existing mappings still load.**

Run (from `apps/backend`): `npx jest src/plugins/simulator src/plugins/devices-home-assistant/mappings src/modules/devices/services/device-validation`
Expected: PASS. The Home Assistant `camera_default` mapping binds only `status` and already lacked the required
`source` before this change; do not fix it here, and say so in the PR description.

- [ ] **Step 2: Check for hand-written category lists that need the new values.**

Run: `grep -rn "occupancy" apps/website --include="*.mdx" --include="*.ts" --include="*.tsx" -l`
For each hit that is a hand-written list of channel categories, add the two channels. Generated pages need nothing.

- [ ] **Step 3: Run every gate.**

```bash
node spec/devices/validate.mjs
pnpm run lint:js
pnpm run test:unit
pnpm --filter ./apps/admin run test:unit
cd apps/panel && flutter test && melos analyze
```

Expected: all PASS.

- [ ] **Step 4: Record the outcome.** Tick UP-1 in the epic task table. In design §15 item 3 replace
  `CHECK-constraint migration` with `CHECK-constraint migration (in place, see migration 059; the device tables are
  not rebuilt because later migrations attached catalog columns and triggers to them)`.

- [ ] **Step 5: Commit, push and open the PR** with the title from Global Constraints. The body lists the four new
  categories, the migration technique and its proof (schema diff test), and the Home Assistant note from Step 1.

```bash
git add tasks docs
git commit -m "docs(tasks): record the camera spec extension"
git push -u origin feat/camera-spec-extension
gh pr create --title "feat(cross): extend camera specs with object detection and multi-stream channels" --body-file <body>
```
