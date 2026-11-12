# Modbus Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modbus devices can be created from declarative YAML templates — two built-in, any number user-supplied — loaded by a new shared definition loader, previewed through the API, and recorded with their provenance.

**Architecture:** A generic, plugin-agnostic `DefinitionLoader<T>` in `apps/backend/src/common/definitions/` discovers, guards, parses and schema-validates YAML files and resolves built-in/user priority. The Modbus plugin supplies the template JSON schema, a pure expander that turns a template into the existing `CreateModbusDeviceStructureDto` shape, a `ModbusTemplatesService` that validates every expansion at load time, and a `templates` controller. Device creation itself is unchanged: clients send the expanded channels to the existing `POST /plugins/devices-modbus/devices` with `template_id` and `template_revision`.

**Tech Stack:** NestJS 11, TypeORM/SQLite, `yaml` ^2.8.2, `ajv` ^8.18.0, class-validator/class-transformer, Jest, supertest, `modbus-serial` `ServerTCP` for e2e.

**Spec:** `docs/superpowers/specs/2026-11-09-modbus-devices-design.md` (sections "Templates", "Backend API", "Security", "Testing", "Open items"). Plan 1 (`docs/superpowers/plans/2026-11-09-modbus-backend-core.md`) is merged as PR #1548.

## Global Constraints

- Templates are declarative only: no `formula`, no `new Function()`, no expressions beyond the placeholders `{i}` and `{n}`. Unknown keys are errors (`additionalProperties: false` everywhere in the schema).
- The existing Shelly NG, Zigbee2MQTT, Home Assistant and Homey loaders are **not** migrated.
- Built-in location: `apps/backend/src/plugins/devices-modbus/templates/definitions/**/*.yaml`.
- User location: `plugin.devices-modbus.*.yaml` (flat) in the user definitions directory, or every `*.yaml`/`*.yml` (recursive) under `FB_MODBUS_TEMPLATES_PATH` when set.
- User definitions override built-in definitions with the same ID.
- Copy-on-create: a device records `template_id` and `template_revision`; later template changes never alter existing devices.
- All new routes: `@Roles(UserRole.OWNER, UserRole.ADMIN)`, Swagger decorators before Nest decorators, `*ResponseModel` responses, schema names prefixed `DevicesModbusPlugin`.
- Backend code style: tabs, single quotes, semicolons, trailing commas, print width 120. Commit titles `<type>(backend): <lowercase subject>`, trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never edit generated files (`spec/api/v1/openapi.json`, `apps/admin/src/openapi.ts`, `apps/panel/lib/api/`).
- No new dependencies (`yaml` and `ajv` are already in `apps/backend/package.json`).

## Decisions taken in this plan

These settle the spec's "Left to the builder" items and are reviewable:

1. **User directory = `FB_CONFIG_PATH`.** Resolved with `getEnvValue(config, 'FB_CONFIG_PATH', <repo>/var/data)`, the same source and default as core `ConfigService.configPath` (`modules/config/services/config.service.ts:80-85`). In development this is the `var/data` the existing loaders use; on installed systems it is the directory the installer and Docker image actually configure (`/var/lib/smart-panel/config`, `/data/config`). The existing loaders hard-code `<install>/var/data`, which installations never populate.
2. **Repeat syntax.** A channel may carry `repeat: { count }`. Item index `i` = 0…count−1, `n` = i+1. Address: integer, or `{ base, step = 1, every = 1 }` → `base + step × floor(i / every)`. Bit: integer, or `{ base = 0, step = 1, modulo = 16 }` → `(base + step × i) mod modulo`. This covers one point per coil/input/register (`{ base }`) and one point per bit across consecutive registers (Qingjun: address `{ base: 4, every: 16 }`, bit `{ modulo: 16 }`).
3. **Transformer vocabulary = binding fields.** Templates use the binding's own fields (`scale`, `offset`, `invert`, `value_map`). `clamp` and `round` from the spec's list are not offered: bindings have no such fields, and adding them is a Plan 4 binding-model change.
4. **Property defaults from the spec.** `data_type` and `permissions` may be omitted in a template; the expander fills them from `getPropertyMetadata(channelCategory, propertyCategory)`. If the spec has no metadata and the template gives none, the template is rejected.
5. **Category enums are checked on the expansion, not in the JSON schema.** The schema checks shape; device/channel/property categories, data types and permissions are validated by running the expansion through `CreateModbusDeviceStructureDto` class-validation plus the structural and spec validation that `POST devices` runs. A template that fails is reported and not offered.
6. **Revision** = first 16 hex characters of SHA-256 over the canonical JSON (recursively sorted keys) of the validated template object.
7. **Provenance is checked on create.** `template_id` requires `template_revision`, and `template_id` must name a currently loaded template. The revision is not compared (a reload between preview and create is legitimate).
8. **N4D8B08 inputs at PDU 81–88.** Resolved (2026-11-10): the register table in the relay board document is correct as written, in the same notation as the relays at 1–8. Plan 4's hardware acceptance confirms it on the real board. The relays (PDU 1–8) are taken as verified.

## Review Focus

1. **A user file overrides a built-in and is itself invalid** — the built-in must stay offered, and the user file's errors must be listed. → Task 5 test `falls back to the built-in when the overriding user template is invalid`.
2. **A hostile or broken user file** (YAML syntax error, >1 MiB, alias bomb, symlink pointing outside the directory) — that file is reported, every other file still loads. → Task 1 tests.
3. **A repeated channel whose identifier lacks `{i}`/`{n}`**, or an unknown placeholder such as `{x}` — rejected at load with a message naming the template, not discovered at create time. → Task 4 and Task 5 tests.
4. **`unit_id` outside the template's `min`/`max`** on preview — 400 naming `unit_id`. → Task 4 test and Task 7 e2e.
5. **`FB_MODBUS_TEMPLATES_PATH` set to a missing directory** — reload succeeds with an error entry; built-ins remain. → Task 1 test `reports a configured override directory that does not exist`.

---

## File Structure

```
apps/backend/src/common/definitions/
  definition-loader.ts            # DefinitionLoader<T>: discovery, guards, parse, Ajv, priority
  definition-loader.spec.ts
  user-definitions-directory.ts   # resolveUserDefinitionsDirectory(config)
  user-definitions-directory.spec.ts
apps/backend/src/plugins/devices-modbus/
  lib/structure-validation.ts     # (moved from the structure service) withDeviceInformation, validateModbusStructure
  lib/structure-validation.spec.ts
  lib/template-expander.ts        # expandModbusTemplate (pure)
  lib/template-expander.spec.ts
  lib/template-revision.ts        # modbusTemplateRevision (pure)
  lib/template-revision.spec.ts
  templates/modbus-template.types.ts
  templates/schema/modbus-templates.schema.json
  templates/schema/modbus-templates.schema.spec.ts
  templates/definitions/qingjun-32di.yaml
  templates/definitions/eletechsup-n4d8b08.yaml
  templates/definitions/builtin-templates.spec.ts
  templates/README.md
  services/modbus-templates.service.ts
  services/modbus-templates.service.spec.ts
  controllers/modbus-templates.controller.ts
  controllers/modbus-templates.controller.spec.ts
  dto/preview-template.dto.ts
  models/template.model.ts        # summary, catalog, file result, preview (+ channel/property/binding) models
  models/template-response.model.ts
apps/backend/test/devices-modbus-templates.e2e-spec.ts
Modified: devices-modbus.plugin.ts, devices-modbus.openapi.ts, devices-modbus.exceptions.ts,
          services/modbus-device-structure.service.ts (+ spec), apps/backend/nest-cli.json
```

---

### Task 1: Shared definition loader

**Files:**
- Create: `apps/backend/src/common/definitions/definition-loader.ts`, `definition-loader.spec.ts`, `user-definitions-directory.ts`, `user-definitions-directory.spec.ts`

**Interfaces:**
- Produces:
```ts
export type DefinitionSource = 'builtin' | 'user';
export interface DefinitionLoaderOptions<T> {
	builtinDirectory: string;            // scanned recursively for *.yaml / *.yml
	userDirectory: string;               // scanned flat for files starting with userFilePrefix
	userFilePrefix: string;              // e.g. 'plugin.devices-modbus.'
	overrideDirectory?: string | null;   // when set, replaces the userDirectory scan: every *.yaml/*.yml, recursive
	schema: object;                      // JSON schema (draft-07) for one whole file
	collectionKey: string;               // top-level array holding the items, e.g. 'templates'
	idOf: (item: T) => string;
	validateItem?: (item: T) => string[]; // plugin-level checks; non-empty → item skipped, messages become file errors
	maxFileBytes?: number;               // default 1_048_576
}
export interface DefinitionFileResult {
	source: DefinitionSource;
	path: string;        // relative to the directory it was found in ('.' for a directory-level error)
	loaded: number;      // items accepted from this file
	errors: string[];
	warnings: string[];
}
export interface LoadedDefinition<T> {
	id: string; source: DefinitionSource; path: string; item: T;
	overridesBuiltin: boolean;
}
export interface DefinitionLoadResult<T> {
	definitions: LoadedDefinition<T>[]; // one per id, sorted by id
	files: DefinitionFileResult[];      // sorted: builtin first, then user; by path within a source
}
export class DefinitionLoader<T> {
	constructor(options: DefinitionLoaderOptions<T>);
	load(): DefinitionLoadResult<T>; // stateless, synchronous, never throws for file problems
}
export function resolveUserDefinitionsDirectory(config: NestConfigService): string;
```

Behaviour the tests pin:
- Paths: every candidate is `realpathSync`-resolved and must be inside the realpath of its root, checked with `path.relative` (reject `''`, `..`-prefixed or absolute results). A symlink escaping the root → file result with error `outside the definitions directory`; the file is not read.
- Size over `maxFileBytes` → error `file exceeds 1048576 bytes`, not parsed.
- Parse with `parse(text, { maxAliasCount: 0, uniqueKeys: true })` from `yaml`; a parse error becomes the file error.
- Ajv: `new Ajv({ allErrors: true, strict: true })`, compiled once in the constructor. Errors formatted `${instancePath || '/'}: ${message}` and de-duplicated; any schema error rejects the whole file.
- Within one file a duplicate id rejects the whole file. A duplicate id in a second file of the same source → error on the second file, first wins (files processed in sorted path order).
- User item with a built-in's id → user wins, `overridesBuiltin: true`, warning on the user file `overrides built-in definition <id>`.
- Missing `builtinDirectory` → file result `{source:'builtin', path:'.', errors:['directory not found']}`. Missing `userDirectory` → nothing. Missing `overrideDirectory` → `{source:'user', path:'.', errors:['directory not found']}`.
- `resolveUserDefinitionsDirectory`: `path.resolve(getEnvValue(config, 'FB_CONFIG_PATH', DEFAULT))` with `DEFAULT = path.resolve(__dirname, '../../../../../var/data')` (`<repo>/var/data`, the same default as core `ConfigService.configPath`).

- [ ] **Step 1: Write the failing tests** (`definition-loader.spec.ts`, temp dirs via `mkdtempSync(join(tmpdir(), 'definitions-'))`, removed with `rmSync(..., { recursive: true, force: true })` in `afterEach`; tiny schema `{ type:'object', required:['version','items'], additionalProperties:false, properties:{ version:{const:'1.0'}, items:{ type:'array', items:{ type:'object', required:['id'], additionalProperties:false, properties:{ id:{type:'string'}, label:{type:'string'} } } } } }`):
  - `loads built-in files recursively and user files with the prefix only` — `builtin/a.yaml`, `builtin/nested/b.yml`, `user/plugin.test.c.yaml`, `user/other.d.yaml` → ids `['a','b','c']`.
  - `lets a user definition override a built-in with the same id` → `source:'user'`, `overridesBuiltin:true`, warning text as above.
  - `reports a schema error and keeps loading other files` → file errors contain `/items/0: must have required property 'id'`; other files loaded.
  - `rejects unknown keys` (`formula: x` on an item) → error contains `must NOT have additional properties`.
  - `reports YAML syntax errors per file`.
  - `refuses files larger than the limit` (`maxFileBytes: 64`).
  - `refuses alias expansion` (YAML with an anchor and `*alias`) → file error, nothing loaded.
  - `refuses a symlink that escapes the directory` (`symlinkSync(outsideFile, join(userDir, 'plugin.test.link.yaml'))`) → error `outside the definitions directory`.
  - `rejects a file with a duplicate id` and `keeps the first of two files defining the same id`.
  - `skips items failing validateItem and reports their messages` → `validateItem: (i) => i.id === 'bad' ? ['bad is bad'] : []`.
  - `scans every yaml file under the override directory instead of the user directory`.
  - `reports a configured override directory that does not exist`.
  - `reports a missing built-in directory`.
  - `user-definitions-directory.spec.ts`: with `FB_CONFIG_PATH` unset → result ends with `path.join('var', 'data')` and `existsSync(join(result, '..', '..', 'pnpm-workspace.yaml'))`; with `get` returning `'/tmp/x'` → `'/tmp/x'`; with `'  '` → the default.

- [ ] **Step 2: Run to verify they fail**
Run: `cd apps/backend && pnpm exec jest src/common/definitions`
Expected: FAIL — `Cannot find module './definition-loader'`.

- [ ] **Step 3: Implement** `DefinitionLoader<T>` and `resolveUserDefinitionsDirectory` in the files above (sync `fs` APIs).

- [ ] **Step 4: Run to verify they pass**
Run: `cd apps/backend && pnpm exec jest src/common/definitions`
Expected: PASS.

- [ ] **Step 5: Commit** — `feat(backend): add a shared yaml definition loader`

---

### Task 2: Extract Modbus structure validation into a pure module

Behaviour-preserving refactor so the templates service can validate an expansion without the database or the structure service.

**Files:**
- Create: `apps/backend/src/plugins/devices-modbus/lib/structure-validation.ts`, `lib/structure-validation.spec.ts`
- Modify: `services/modbus-device-structure.service.ts` (move `withDeviceInformation` L228–261, `validateStructure` L476 and its helpers `validateProperty`, `matchesDataType`, `validateBinding`, `validateWriteTargets`, `validateSpecification`, `specificationField`; `readLimitIssue` moves too and is exported, because `validateUpdate` also uses it)

**Interfaces:**
- Produces:
```ts
export type ModbusStructureIssue = { field: string; reason: string };
export type SpecificationValidator = (input: { category: DeviceCategory; channels: unknown[] }) => ValidationIssue[];
export function withDeviceInformation(
	dto: CreateModbusDeviceStructureDto,
	serialNumber: string, // used only when dto.serial_number is absent
): CreateModbusDeviceStructureDto;
export function validateModbusStructure(
	dto: CreateModbusDeviceStructureDto,
	validateSpecification: SpecificationValidator, // the service passes a closure over DeviceValidationService.validateDeviceStructure
): ModbusStructureIssue[];
```
- The service keeps `create`, `validateUpdate`, `validateAgainstDatabase`; it calls the two functions with `${endpoint.host}:${endpoint.port}#${dto.unit_id}` as the serial number. `ValidationIssue` is whatever `DeviceValidationService.validateDeviceStructure` returns today; keep ERROR-severity filtering inside `validateModbusStructure`.

- [ ] **Step 1: Write a failing smoke test** `lib/structure-validation.spec.ts`: `validateModbusStructure` on the N4D8B08 single-relay fixture used in `modbus-device-structure.service.spec.ts` (after `withDeviceInformation(dto, '127.0.0.1:502#1')`) with a validator returning `[]` → `[]`; the same fixture with `read` removed from the `rw` property → one issue whose `field` is `channels[0].properties[0].read`; `withDeviceInformation` adds exactly one `device_information` channel whose `serial_number` static value is `'127.0.0.1:502#1'`.
- [ ] **Step 2: Run** `pnpm exec jest src/plugins/devices-modbus/lib/structure-validation.spec.ts` — Expected: FAIL (module missing).
- [ ] **Step 3: Move the code** into `lib/structure-validation.ts`; the service delegates. No behaviour change.
- [ ] **Step 4: Run** `pnpm exec jest src/plugins/devices-modbus` — Expected: PASS, including the unchanged `modbus-device-structure.service.spec.ts`.
- [ ] **Step 5: Commit** — `refactor(backend): extract modbus structure validation into a pure module`

---

### Task 3: Template schema, types and documentation

**Files:**
- Create: `templates/schema/modbus-templates.schema.json`, `templates/schema/modbus-templates.schema.spec.ts`, `templates/modbus-template.types.ts`, `templates/README.md`
- Modify: `apps/backend/nest-cli.json` — add assets `plugins/devices-modbus/templates/definitions/**/*.yaml` and `plugins/devices-modbus/templates/schema/**/*.json`, both `"outDir": "dist"`, next to the Homey entries.

**Interfaces:**
- Produces (`modbus-template.types.ts`, snake_case keys exactly as in YAML):
```ts
export type ModbusTemplateAddress = number | { base: number; step?: number; every?: number };
export type ModbusTemplateBit = number | { base?: number; step?: number; modulo?: number };
export interface ModbusTemplateBinding {
	register_type: ModbusRegisterType; address: ModbusTemplateAddress; data_type: ModbusDataType;
	bit?: ModbusTemplateBit; byte_order?: ModbusByteOrder; word_order?: ModbusByteOrder;
	scale?: number; offset?: number; invert?: boolean;
	value_map?: { raw: number; value: string | number | boolean }[];
	write_function?: ModbusWriteFunction; poll_interval_ms?: number;
}
export interface ModbusTemplateProperty {
	category: string; identifier?: string; name?: string; data_type?: string; permissions?: string[];
	unit?: string; format?: (string | number)[]; static_value?: string | number | boolean;
	read?: ModbusTemplateBinding; write?: ModbusTemplateBinding;
}
export interface ModbusTemplateChannel {
	category: string; identifier: string; name: string; repeat?: { count: number };
	properties: ModbusTemplateProperty[];
}
export interface ModbusTemplateDefaults {
	framing?: ModbusFraming; port?: number;
	unit_id?: { default: number; min?: number; max?: number; hint?: string };
	poll_interval_ms?: number; byte_order?: ModbusByteOrder; word_order?: ModbusByteOrder;
	max_read_registers?: number; max_read_bits?: number; max_read_gap?: number;
}
export interface ModbusTemplate {
	id: string; name: string; manufacturer: string; model: string; description?: string;
	category: string; defaults?: ModbusTemplateDefaults; channels: ModbusTemplateChannel[];
}
export interface ModbusTemplateFile { version: '1.0'; templates: ModbusTemplate[] }
```
- Schema (draft-07, `additionalProperties: false` on every object): `version` const `"1.0"`; `templates` minItems 1; `id` pattern `^[a-z0-9][a-z0-9_-]{0,63}$`; `name` 1–128 chars; `manufacturer`, `model` 1–64; `description` ≤1024; `category` and every `category`/`data_type` string 1–64; `permissions` array of strings, minItems 1; `channels` and `properties` minItems 1; `repeat.count` integer 1–256; `identifier` 1–64; enums copied from `devices-modbus.constants.ts` for `framing`, `register_type`, `data_type` (binding), `byte_order`, `word_order`, `write_function`; `port` 1–65535; `unit_id.*` integers 0–255; `hint` ≤256; `poll_interval_ms` 100–86400000; `max_read_registers` 1–125; `max_read_bits` 1–2000; `max_read_gap` ≥0; `address` integer 0–65535 or object (`base` 0–65535 required, `step` ≥0, `every` ≥1); `bit` integer 0–15 or object (`base` 0–15, `step` ≥0, `modulo` 1–16); `value_map` minItems 1 of `{raw: number, value: string|number|boolean}` (both required).

- [ ] **Step 1: Write the failing test** `modbus-templates.schema.spec.ts`: read the JSON with `readFileSync` + `JSON.parse`, compile with `new Ajv({ allErrors: true, strict: true })` (must not throw), then:
  - the spec's Qingjun example (with address `{ base: 4, every: 16 }` and bit `{ modulo: 16 }`) is valid;
  - `formula: 'x * 2'` on a binding → invalid with `must NOT have additional properties`;
  - `address: 70000` → invalid; `bit: 16` → invalid; `repeat: { count: 0 }` → invalid; `register_type: 'coils'` → invalid; `id: 'Bad Id'` → invalid; `version: '2.0'` → invalid.
- [ ] **Step 2: Run** `pnpm exec jest src/plugins/devices-modbus/templates/schema` — Expected: FAIL (file missing).
- [ ] **Step 3: Write the schema and types.**
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Write `templates/README.md`** documenting: locations (built-in, `FB_CONFIG_PATH`/`plugin.devices-modbus.*.yaml`, `FB_MODBUS_TEMPLATES_PATH`), priority, the format with both built-ins as examples, `repeat` and the address/bit stepping formulas from Decision 2, placeholders `{i}`/`{n}`, property defaults from the spec, revision and copy-on-create, the reload endpoint. State plainly that there are no formulas.
- [ ] **Step 6: Commit** — `feat(backend): add the modbus template schema`

---

### Task 4: Template expander and revision

**Files:**
- Create: `lib/template-expander.ts`, `lib/template-expander.spec.ts`, `lib/template-revision.ts`, `lib/template-revision.spec.ts`

**Interfaces:**
- Consumes: `ModbusTemplate` (Task 3), `getPropertyMetadata(channelCategory, propertyCategory)` from `modules/devices/utils/schema.utils.ts:171`, `MODBUS_DEFAULTS.UNIT_ID`.
- Produces:
```ts
export function modbusTemplateRevision(template: ModbusTemplate): string; // 16 lowercase hex chars
export interface ModbusTemplateOverrides { unit_id?: number; poll_interval_ms?: number }
export interface ModbusTemplateExpansion {
	template_id: string; template_revision: string;
	category: string; manufacturer: string; model: string;
	unit_id: number; poll_interval_ms?: number;
	byte_order?: ModbusByteOrder; word_order?: ModbusByteOrder;
	max_read_registers?: number; max_read_bits?: number; max_read_gap?: number;
	channels: CreateModbusDeviceStructureChannelDto[]; // plain objects of that shape; bindings carry concrete numbers
}
export class ModbusTemplateExpansionError extends Error {
	constructor(readonly issues: ModbusStructureIssue[]); // message: issues joined as `${field}: ${reason}`
}
export function expandModbusTemplate(
	template: ModbusTemplate, revision: string, overrides?: ModbusTemplateOverrides,
): ModbusTemplateExpansion; // throws ModbusTemplateExpansionError
```
Rules: items `i = 0…count−1` (no `repeat` → one item, `i = 0`); `{i}`/`{n}` substituted in channel and property `identifier`/`name`; any other `{word}` → issue `unknown placeholder {word}`. Address/bit formulas from Decision 2. `unit_id` = override ?? `defaults.unit_id.default` ?? `MODBUS_DEFAULTS.UNIT_ID`, and must lie in `[defaults.unit_id.min ?? 0, defaults.unit_id.max ?? 255]` (issue field `unit_id`, reason `must be between <min> and <max>`). `poll_interval_ms` = override ?? `defaults.poll_interval_ms`. Missing `data_type`/`permissions` filled from spec metadata, issue `data_type is required for <channel>.<property>` when metadata is null. Computed address > 65535 or bit outside 0–15 → issue on that point's field. Issue fields use expansion indexes, e.g. `channels[17].properties[0].read.address`.

- [ ] **Step 1: Write the failing tests**
  - `template-revision.spec.ts`: equal for the same template with keys in a different order; different when `address.base` changes; matches `/^[0-9a-f]{16}$/`.
  - `template-expander.spec.ts`, using the Qingjun example from Task 3:
```ts
const expansion = expandModbusTemplate(qingjun, 'rev', { unit_id: 2 });
expect(expansion.channels).toHaveLength(32);
const point = (n: number) => expansion.channels[n - 1].properties[0].read;
expect([point(1).address, point(1).bit]).toEqual([4, 0]);
expect([point(16).address, point(16).bit]).toEqual([4, 15]);
expect([point(17).address, point(17).bit]).toEqual([5, 0]);
expect([point(32).address, point(32).bit]).toEqual([5, 15]);
expect(expansion.channels[31]).toMatchObject({ identifier: 'di_32', name: 'DI 32', category: 'binary_input' });
expect(expansion.channels[0].properties[0]).toMatchObject({ data_type: 'bool', permissions: ['ro'] });
expect(expansion).toMatchObject({ unit_id: 2, template_id: 'qingjun-32di', template_revision: 'rev' });
```
  - `uses the template default unit id when no override is given` (→ 1).
  - `rejects a unit id outside the template range` (`unit_id: 32` with max 31) → `ModbusTemplateExpansionError` with issue `{ field: 'unit_id', reason: 'must be between 0 and 31' }`.
  - `steps addresses one per item` (`address: { base: 1 }`, count 8 → 1…8).
  - `rejects an unknown placeholder` (`identifier: 'di_{x}'`).
  - `rejects a computed address beyond 65535` (`base: 65530`, count 8).
  - `requires data_type when the spec has no metadata` (property category not defined for the channel).
  - `keeps value maps and write functions` (N4D8B08-style relay, read and write maps copied verbatim).
- [ ] **Step 2: Run** `pnpm exec jest src/plugins/devices-modbus/lib/template-` — Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** both modules. Canonical JSON: recursive key sort, `JSON.stringify`, `createHash('sha256')`, first 16 hex.
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(backend): expand modbus templates into device structures`

---

### Task 5: Templates service

**Files:**
- Create: `services/modbus-templates.service.ts`, `services/modbus-templates.service.spec.ts`
- Modify: `devices-modbus.exceptions.ts` — add `ModbusTemplateNotFoundException` (404, message `Modbus template <id> does not exist`).

**Interfaces:**
- Consumes: `DefinitionLoader`, `resolveUserDefinitionsDirectory` (Task 1); `withDeviceInformation`, `validateModbusStructure` (Task 2); `ModbusTemplate` (Task 3); `expandModbusTemplate`, `modbusTemplateRevision` (Task 4); `DeviceValidationService`, `NestConfigService`.
- Produces:
```ts
export interface LoadedModbusTemplate {
	template: ModbusTemplate; revision: string; source: DefinitionSource; path: string;
	overridesBuiltin: boolean; channelCount: number; pointCount: number; // counted on the default expansion
}
export interface ModbusTemplateCatalog { templates: LoadedModbusTemplate[]; files: DefinitionFileResult[] }
export interface ModbusTemplatesLocations { builtinDirectory: string; schemaPath: string } // injected via MODBUS_TEMPLATES_LOCATIONS token
export const MODBUS_TEMPLATES_LOCATIONS = 'MODBUS_TEMPLATES_LOCATIONS';
@Injectable() export class ModbusTemplatesService implements OnModuleInit {
	constructor(config: NestConfigService, deviceValidation: DeviceValidationService,
		@Inject(MODBUS_TEMPLATES_LOCATIONS) locations: ModbusTemplatesLocations);
	onModuleInit(): void;                       // reload()
	reload(): ModbusTemplateCatalog;            // re-reads FB_CONFIG_PATH and FB_MODBUS_TEMPLATES_PATH every time
	catalog(): ModbusTemplateCatalog;
	get(id: string): LoadedModbusTemplate;      // throws ModbusTemplateNotFoundException
	has(id: string): boolean;
	preview(id: string, overrides: ModbusTemplateOverrides): ModbusTemplateExpansion; // ModbusValidationException on issues
}
```
- The plugin module provides `MODBUS_TEMPLATES_LOCATIONS` with `{ builtinDirectory: join(__dirname, 'templates/definitions'), schemaPath: join(__dirname, 'templates/schema/modbus-templates.schema.json') }` (computed in `devices-modbus.plugin.ts`, so `__dirname` is the plugin root in both `src` and `dist`).
- `validateItem` (passed to the loader): expand with no overrides; build `plainToInstance(CreateModbusDeviceStructureDto, { ...expansion, name: template.name, endpoint_id: '00000000-0000-4000-8000-000000000000', channels })`; `validateSync` it (flatten every nested constraint to `${property path}: ${message}`); then `validateModbusStructure(withDeviceInformation(dto, 'template'), spec)`. Every message is prefixed `template <id>: `. `ModbusTemplateExpansionError` issues are reported the same way.
- `preview` maps `ModbusTemplateExpansionError` to `ModbusValidationException(issues.map((i) => JSON.stringify(i)))`.
- Log one line per reload: counts of templates, files and files with errors (no file contents).

- [ ] **Step 1: Write the failing tests** (temp built-in dir + temp user dir; `config.get` stubbed: `FB_CONFIG_PATH` → user dir, `FB_MODBUS_TEMPLATES_PATH` → configurable; `DeviceValidationService` real or stubbed to return `[]` — use the real one if constructible without the DB, as `modbus-device-structure.service.spec.ts` does):
  - `lists valid built-in templates with revision and counts` (Qingjun example → `channelCount: 32`, `pointCount: 32`).
  - `reports a template whose expansion fails validation and does not list it` (`category: 'not_a_category'` → file error starting `template <id>: category`).
  - `rejects a repeated channel whose identifier has no placeholder` (count 2, identifier `di`) → file error mentioning `identifier` and the template is not listed.
  - `falls back to the built-in when the overriding user template is invalid` → listed template has `source: 'builtin'`; the user file has errors.
  - `uses FB_MODBUS_TEMPLATES_PATH on reload` (set after construction, then `reload()`).
  - `get throws ModbusTemplateNotFoundException for an unknown id`.
  - `preview returns the expansion and maps expansion issues to a validation exception` (unit_id out of range → `ModbusValidationException` whose response `message` contains `{"field":"unit_id",...}`).
- [ ] **Step 2: Run** `pnpm exec jest src/plugins/devices-modbus/services/modbus-templates.service.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the service and the exception.
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(backend): load and validate modbus templates`

---

### Task 6: Built-in templates

**Files:**
- Create: `templates/definitions/qingjun-32di.yaml`, `templates/definitions/eletechsup-n4d8b08.yaml`, `templates/definitions/builtin-templates.spec.ts`

Content pinned by the spec:
- **`qingjun-32di`** — name `Qingjun 32-channel digital input board`, manufacturer `Qingjun`, model `32DI`, description from the spec; defaults `framing: tcp`, `port: 8080`, `unit_id { default: 1, min: 0, max: 31, hint: "Must match the DIP switches; restart the board after changing them" }`, `poll_interval_ms: 250`, `byte_order: big`, `word_order: big`; category `input_controller`; one repeated channel (count 32) `di_{n}` / `DI {n}` / `binary_input` with property `state` read from `holding_register`, address `{ base: 4, every: 16 }`, `data_type: bool`, bit `{ modulo: 16 }`.
- **`eletechsup-n4d8b08`** — name `Eletechsup N4D8B08 8-channel relay board`, manufacturer `Eletechsup`, model `N4D8B08`, description noting RS485 9600 8N1 is configured on the gateway; defaults `framing: rtu_over_tcp`, `port: 502`, `unit_id { default: 1, min: 1, max: 247 }`, `poll_interval_ms: 500`; category `switcher`; channel repeat 8 `relay_{n}` / `Relay {n}` / `switcher`, property `on` with read `{ register_type: holding_register, address: { base: 1 }, data_type: uint16, value_map: [{raw: 1, value: true}, {raw: 0, value: false}] }` and write `{ register_type: holding_register, address: { base: 1 }, data_type: uint16, value_map: [{raw: 256, value: true}, {raw: 512, value: false}], write_function: single }`; channel repeat 8 `input_{n}` / `Input {n}` / `binary_input`, property `state` read `{ register_type: holding_register, address: { base: 81 }, data_type: uint16, value_map: [{raw: 1, value: true}, {raw: 0, value: false}] }`. A YAML comment above the inputs: `# PDU 81–88: confirm in hardware acceptance (spec "Open items").` Registers 253 and 254 are not bound.

- [ ] **Step 1: Write the failing test** `builtin-templates.spec.ts`: construct `ModbusTemplatesService` with the real `templates/definitions` and schema paths and an empty temp user dir, then:
  - `catalog().files.every((f) => f.errors.length === 0)` and template ids `['eletechsup-n4d8b08', 'qingjun-32di']`;
  - Qingjun preview `{ unit_id: 2 }`: 32 channels, points 1/16/17/32 at `[4,0] [4,15] [5,0] [5,15]`;
  - N4D8B08 preview: 16 channels; `relay_1` read address 1 and write address 1 with the two value maps; `relay_8` address 8; `input_1` address 81; `input_8` address 88; no binding at 253 or 254;
  - each expansion passes `validateModbusStructure(withDeviceInformation(...), realSpecValidator)` with no issues.
- [ ] **Step 2: Run** `pnpm exec jest src/plugins/devices-modbus/templates/definitions` — Expected: FAIL (ids missing).
- [ ] **Step 3: Write the two YAML files.**
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(backend): add built-in qingjun and eletechsup modbus templates`

---

### Task 7: Templates API, provenance and wiring

**Files:**
- Create: `controllers/modbus-templates.controller.ts`, `controllers/modbus-templates.controller.spec.ts`, `dto/preview-template.dto.ts`, `models/template.model.ts`, `models/template-response.model.ts`, `apps/backend/test/devices-modbus-templates.e2e-spec.ts`
- Modify: `devices-modbus.plugin.ts` (provider, `MODBUS_TEMPLATES_LOCATIONS`, controller), `devices-modbus.openapi.ts` (append every new DTO and model), `services/modbus-device-structure.service.ts` + its spec (provenance), the plugin `readme` in `devices-modbus.plugin.ts` (one paragraph on templates)

**Interfaces:**
- Consumes: `ModbusTemplatesService` (Task 5).
- Produces routes under `/plugins/devices-modbus/templates` (`@Controller('templates')`, `@ApiTags(DEVICES_MODBUS_API_TAG_NAME)`):

| Method & path | operationId | Body | Response model (`data`) |
|---|---|---|---|
| `GET /` | `get-devices-modbus-plugin-templates` | — | `ModbusTemplatesResponseModel` → `ModbusTemplateCatalogModel` |
| `GET /:id` | `get-devices-modbus-plugin-template` | — | `ModbusTemplateResponseModel` → `ModbusTemplateSummaryModel` (404 unknown) |
| `POST /:id/preview` (`@HttpCode(200)`) | `create-devices-modbus-plugin-template-preview` | `ReqPreviewModbusTemplateDto { data: PreviewModbusTemplateDto { unit_id?, poll_interval_ms? } }` (ints, same ranges as the device DTO) | `ModbusTemplatePreviewResponseModel` → `ModbusTemplatePreviewModel` (200, not 201) |
| `POST /reload` (`@HttpCode(200)`) | `create-devices-modbus-plugin-templates-reload` | — | `ModbusTemplatesResponseModel` (200) |

- Models (`@ApiSchema` names): `DevicesModbusPluginDataTemplateSummary` {id, name, manufacturer, model, description (nullable), category, source (`builtin`|`user`), revision, path, overrides_builtin, channel_count, point_count, defaults: `DevicesModbusPluginDataTemplateDefaults` {framing, port, unit_id: `DevicesModbusPluginDataTemplateUnitId` {default, min, max, hint (nullable)}, poll_interval_ms, byte_order, word_order} absent values fall back to `MODBUS_DEFAULTS`}; `DevicesModbusPluginDataTemplateFile` {source, path, loaded, errors[], warnings[]}; `DevicesModbusPluginDataTemplateCatalog` {templates[], files[]}; `DevicesModbusPluginDataTemplatePreview` {template_id, template_revision, category, manufacturer, model, endpoint_defaults {framing, port}, unit_id, poll_interval_ms (nullable), byte_order (nullable), word_order (nullable), max_read_registers (nullable), max_read_bits (nullable), max_read_gap (nullable), channels: `DevicesModbusPluginDataTemplatePreviewChannel`[] → properties `DevicesModbusPluginDataTemplatePreviewProperty`[] → read/write `DevicesModbusPluginDataTemplatePreviewBinding` (all binding fields, value_map `DevicesModbusPluginDataTemplatePreviewValueMapEntry`[])}. Response wrappers `DevicesModbusPluginResTemplates`, `...ResTemplate`, `...ResTemplatePreview`. Enum examples use real enum values (never `example: null`).
- Provenance in `ModbusDeviceStructureService.create`, added to the issue list before any DB write: `template_id` without `template_revision` → `{ field: 'template_revision', reason: 'is required when template_id is set.' }`; `template_id` not loaded → `{ field: 'template_id', reason: 'Template <id> is not loaded.' }`. The service gains a `ModbusTemplatesService` constructor dependency.

- [ ] **Step 1: Write failing unit tests**
  - `modbus-templates.controller.spec.ts`: every handler carries `ROLES_KEY` metadata `[UserRole.OWNER, UserRole.ADMIN]`; `preview` passes `body.data` to `service.preview(id, ...)` and wraps the result; `reload` returns the catalog in `data`.
  - `modbus-device-structure.service.spec.ts`: `refuses a template id without a revision` and `refuses a template that is not loaded` (400, `ModbusValidationException` with those fields), and the existing create path with `template_id: 'qingjun-32di', template_revision: 'abc'` succeeds when `has()` returns true.
- [ ] **Step 2: Run** `pnpm exec jest src/plugins/devices-modbus` — Expected: FAIL on the new tests.
- [ ] **Step 3: Implement** controller, DTOs, models, provenance check and plugin wiring; register all new classes in `DEVICES_MODBUS_PLUGIN_SWAGGER_EXTRA_MODELS`.
- [ ] **Step 4: Run** `pnpm exec jest src/plugins/devices-modbus` — Expected: PASS.
- [ ] **Step 5: Write the e2e test** `test/devices-modbus-templates.e2e-spec.ts`, bootstrapped and authenticated exactly like `test/devices-modbus.e2e-spec.ts`, with a `ServerTCP` holding-register simulator and `FB_MODBUS_TEMPLATES_PATH` pointing at a temp dir (restore env after):
  - `GET /plugins/devices-modbus/templates` → 200, ids include `qingjun-32di` and `eletechsup-n4d8b08`, every file has no errors.
  - `POST .../templates/qingjun-32di/preview` `{ data: { unit_id: 32 } }` → 400 with a detail for `unit_id`.
  - Create an endpoint on the simulator, preview Qingjun with `{ unit_id: 1, poll_interval_ms: 200 }`, then `POST /plugins/devices-modbus/devices` with `{ ...preview minus endpoint_defaults, name: 'Inputs', endpoint_id }` → 201 with `template_id: 'qingjun-32di'` and the preview's revision; set simulator holding registers 4 = `0x0001`, 5 = `0x8000`; wait (through `DevicesService`, not HTTP) until `di_1.state` and `di_32.state` are `true` and `di_2.state` is `false`.
  - Write `override.yaml` into the `FB_MODBUS_TEMPLATES_PATH` dir with a copy of `qingjun-32di` whose name is `Qingjun (site copy)`; `POST .../templates/reload` → 200, `qingjun-32di` now `source: 'user'`, `overrides_builtin: true`, a new revision; the device created above still reports the old `template_revision` (copy-on-create).
  - `POST /plugins/devices-modbus/devices` with `template_id: 'missing'` and a revision → 400 detail `template_id`.
- [ ] **Step 6: Run** `pnpm exec jest --config test/jest-e2e.json test/devices-modbus-templates.e2e-spec.ts test/devices-modbus.e2e-spec.ts` — Expected: PASS.
- [ ] **Step 7: Generate and lint OpenAPI**
Run: `pnpm run generate:openapi && pnpm --filter @fastybird/smart-panel-backend lint:openapi` (repo root)
Expected: generation succeeds; lint reports no errors. The generated files are gitignored; do not commit them.
- [ ] **Step 8: Full verification**
Run (in `apps/backend`): `pnpm exec tsc --noEmit`, `pnpm exec jest src/plugins/devices-modbus src/common`, `pnpm run lint:js`, `pnpm exec prettier --check` on changed files, and the full `pnpm exec jest --config test/jest-e2e.json` with a local InfluxDB 1.8 on 127.0.0.1:8086 (the `P05b1b` thermostat suite needs it).
Expected: all pass, 0 lint errors.
- [ ] **Step 9: Commit** — `feat(backend): expose modbus templates over the plugin api`
