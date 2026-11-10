# Modbus Devices — Plan 1: Backend Core

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `devices-modbus` backend plugin that connects to Modbus TCP and RTU-over-TCP endpoints, polls configured
registers into Smart Panel properties, executes property commands as Modbus writes, and reports truthful connection
state. Devices are created through a plugin API (no admin UI yet).

**Architecture:** Endpoints are a plugin-owned table, Modbus devices are STI children of the core device entity, and
register bindings are a plugin-owned table keyed to channel properties. A per-endpoint connection serialises all
requests over one socket; a managed runtime service plans block reads per device, decodes them with a pure codec and
reports samples; a device platform encodes writes and triggers read-back.

**Tech Stack:** NestJS, TypeORM (SQLite), class-validator, `modbus-serial` (new dependency), Jest.

**Spec:** `docs/superpowers/specs/2026-11-09-modbus-devices-design.md`

**Follow-up plans (not in this plan):** Plan 2 — templates and the shared YAML loader; Plan 3 — admin endpoints page,
probe API and wizard; Plan 4 — button synthesis, valve, point editing, panel stub, docs, hardware acceptance.

## Global Constraints

- Node.js >= 24, pnpm >= 10. TypeScript style: tabs, single quotes, semicolons, trailing commas, print width 120.
- Imports: external first, then `../`, then `./`, blank line between groups.
- Plugin identity: `DEVICES_MODBUS_PLUGIN_NAME = 'devices-modbus-plugin'`, `DEVICES_MODBUS_PLUGIN_PREFIX = 'devices-modbus'`,
  `DEVICES_MODBUS_TYPE = 'devices-modbus'`.
- Controllers: `@ApiTags`, `@ApiOperation` with `tags`, `summary`, `description`, `operationId`; Swagger decorators
  before NestJS decorators; responses are `*ResponseModel` extending `BaseSuccessResponseModel<T>`.
- Schema names: `DevicesModbusPluginData*`, `DevicesModbusPluginRes*`, `DevicesModbusPluginReq*`,
  `DevicesModbusPlugin{Action}{Entity}`.
- Hardware-touching routes: `@Roles(UserRole.OWNER, UserRole.ADMIN)`.
- One incremental migration, `1000000000054-AddModbusDevices.ts`. Never edit earlier migrations.
- Never edit generated code (`spec/api/v1/openapi.json`, `apps/admin/src/openapi.ts`, `apps/panel/lib/api/`); run
  `pnpm run generate:openapi` instead.
- Addresses are stored 0-based (PDU address), 0–65535. Unit ID 0–255.
- Defaults (verbatim from spec): port `502`; framing `tcp`; `connect_timeout_ms` `2000`; `request_timeout_ms` `1000`;
  `inter_request_delay_ms` `0` for `tcp`, `20` for `rtu_over_tcp`; `max_in_flight` `1` (forced to `1` for
  `rtu_over_tcp`); unit ID `1`; poll interval `1000` ms, minimum `100`; byte/word order `big`; `max_read_registers`
  `125`; `max_read_bits` `2000`; `max_read_gap` `0`.
- Reconnect backoff 1 s → 60 s cap with jitter; TCP socket reset after 3 consecutive timeouts; RTU-over-TCP socket reset
  after every timeout; device `lost` after 3 consecutive failed polls.
- No `formula`, no `new Function()`, no `eval` anywhere in the plugin.
- Commit messages: `<type>(backend): <lowercase imperative subject>`; end with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Unmapped raw value under a read `value_map`** (e.g. a relay board briefly reads `2` while switching): the property
   reports `null` (invalid) and a warning is logged once per change; nothing throws, no stale value stays. → Task 3, Task 9.
2. **Several points on the same register** (bit points of one bitfield register, or a 16-bit point inside a 32-bit
   point's span): one block reads the register once and every point decodes its own value. → Task 4.
3. **Endpoint edited while requests are in flight** (host/port/framing change): the old connection rejects its pending
   requests, exactly one new connection starts, and no device ends up polled twice. → Task 9.
4. **Device deleted while its poll is in flight**: the late result is discarded and no sample is reported for deleted
   properties; no error escapes to the runtime loop. → Task 9.
5. **Command arriving while the endpoint is in backoff**: the write fails immediately (no waiting for reconnect), the
   platform returns `false`, and the property keeps its last confirmed value. → Task 10.

---

## File Structure

All new files under `apps/backend/src/plugins/devices-modbus/` unless stated.

| File | Responsibility |
|---|---|
| `devices-modbus.constants.ts` | Plugin identity, enums, defaults, API tag |
| `devices-modbus.exceptions.ts` | `DevicesModbusException`, `DevicesModbusValidationException`, `DevicesModbusNotFoundException` |
| `devices-modbus.openapi.ts` | `DEVICES_MODBUS_PLUGIN_SWAGGER_EXTRA_MODELS` |
| `devices-modbus.plugin.ts` | Nest module, registrations, metadata, managed service registration |
| `entities/devices-modbus.entity.ts` | `ModbusDeviceEntity`, `ModbusChannelEntity`, `ModbusChannelPropertyEntity` (STI) |
| `entities/modbus-endpoint.entity.ts` | `ModbusEndpointEntity` (`devices_modbus_endpoints`) |
| `entities/modbus-binding.entity.ts` | `ModbusBindingEntity` (`devices_modbus_bindings`) |
| `dto/*.dto.ts` | STI create/update DTOs, endpoint DTOs, device-structure DTO, binding DTO, config DTO |
| `models/*.model.ts` | Config model, response models, endpoint health model |
| `lib/codec.ts` | Pure decode/encode of registers and bits |
| `lib/read-planner.ts` | Pure grouping of points into read blocks |
| `lib/errors.ts` | `ModbusExceptionError`, `ModbusTimeoutError`, `ModbusConnectionError`, `ModbusEndpointUnavailableError` |
| `transport/modbus-transport.ts` | `ModbusTransport` interface and request types |
| `transport/modbus-serial.transport.ts` | `modbus-serial` adapter for `tcp` and `rtu_over_tcp` |
| `runtime/endpoint-connection.ts` | Per-endpoint socket, queue, timeouts, backoff, health |
| `services/modbus-endpoints.service.ts` | Endpoint CRUD, delete restriction |
| `services/modbus-connections.service.ts` | Registry of `EndpointConnection`s, reconcile on endpoint changes |
| `services/modbus-device-structure.service.ts` | Validated atomic creation of device + channels + properties + bindings |
| `services/modbus-bindings.service.ts` | Load bindings by device/property |
| `services/modbus-runtime.service.ts` | Managed service: device pollers, decode, sample reporting, connection state |
| `platforms/modbus.device.platform.ts` | `IDevicePlatform` write path |
| `controllers/modbus-endpoints.controller.ts` | `endpoints` routes |
| `controllers/modbus-devices.controller.ts` | `devices` routes |
| `apps/backend/src/migrations/1000000000054-AddModbusDevices.ts` | Tables and STI columns |
| `apps/backend/src/app.module.ts` | Router child + import |
| `apps/backend/package.json` | `modbus-serial` dependency |

---

### Task 1: Plugin skeleton, config, dependency and wiring

**Files:**
- Create: `devices-modbus.constants.ts`, `devices-modbus.exceptions.ts`, `devices-modbus.openapi.ts`,
  `devices-modbus.plugin.ts`, `models/config.model.ts`, `dto/update-config.dto.ts`
- Modify: `apps/backend/src/app.module.ts` (next to the `DevicesWledPlugin` entries: router child
  `{ path: DEVICES_MODBUS_PLUGIN_PREFIX, module: DevicesModbusPlugin }` and the imports list)
- Modify: `apps/backend/package.json` (add `modbus-serial` `^8.0.25` to `dependencies`)
- Test: `devices-modbus.plugin.spec.ts`

**Interfaces:**
- Produces: constants and enums used by every later task:
  - `enum ModbusFraming { TCP = 'tcp', RTU_OVER_TCP = 'rtu_over_tcp' }`
  - `enum ModbusRegisterType { COIL = 'coil', DISCRETE_INPUT = 'discrete_input', INPUT_REGISTER = 'input_register', HOLDING_REGISTER = 'holding_register' }`
  - `enum ModbusDataType { BOOL = 'bool', INT16 = 'int16', UINT16 = 'uint16', INT32 = 'int32', UINT32 = 'uint32', FLOAT32 = 'float32' }`
  - `enum ModbusByteOrder { BIG = 'big', LITTLE = 'little' }` (used for both byte and word order)
  - `enum ModbusBindingRole { READ = 'read', WRITE = 'write' }`
  - `enum ModbusWriteFunction { SINGLE = 'single', MULTIPLE = 'multiple' }`
  - `MODBUS_DEFAULTS` object holding every default from Global Constraints.
- `ModbusConfigModel extends PluginConfigModel` with `type = DEVICES_MODBUS_PLUGIN_NAME`, `enabled = true`.
- Plugin metadata registered via `ExtensionsService.registerPluginMetadata` with name `Modbus`, a README describing
  Modbus TCP and RTU over TCP support.

- [ ] **Step 1: Write the failing test** — `devices-modbus.plugin.spec.ts`: build the plugin class with jest mocks for
  every constructor dependency (pattern: how `DevicesWledPlugin`'s collaborators are injected), call `onModuleInit()`,
  and assert:
  - `configMapper.registerMapping` called with `{ type: 'devices-modbus-plugin', class: ModbusConfigModel, configDto: ModbusUpdatePluginConfigDto }`
  - `devicesMapper.registerMapping`, `channelsMapper.registerMapping`, `channelsPropertiesMapper.registerMapping` each called with `type: 'devices-modbus'`
  - `platformRegistryService.register` called with the platform instance
  - `discriminatorRegistry.register` called 9 times, every call with `discriminatorValue: 'devices-modbus'`
  - `managedServiceManager.register` called with the runtime service
  (Entities, DTOs, platform and runtime service referenced here are created in Tasks 2, 7, 9, 10; for this task create
  them as minimal stubs with the final class names so the module compiles; later tasks fill them in.)
- [ ] **Step 2: Run it and see it fail**
  Run: `cd apps/backend && pnpm exec jest src/plugins/devices-modbus/devices-modbus.plugin.spec.ts`
  Expected: FAIL — cannot find module `./devices-modbus.plugin`.
- [ ] **Step 3: Implement** the constants, exceptions, config model/DTO, plugin module (structure identical to
  `devices-wled.plugin.ts`), the `app.module.ts` wiring, and add the dependency with
  `pnpm --filter ./apps/backend add modbus-serial@^8.0.25`.
- [ ] **Step 4: Run test and type check**
  Run: `cd apps/backend && pnpm exec jest src/plugins/devices-modbus/devices-modbus.plugin.spec.ts && pnpm exec tsc --noEmit -p tsconfig.json`
  Expected: PASS, no type errors.
- [ ] **Step 5: Commit** — `feat(backend): add devices-modbus plugin skeleton`

---

### Task 2: Entities and migration

**Files:**
- Create: `entities/devices-modbus.entity.ts`, `entities/modbus-endpoint.entity.ts`, `entities/modbus-binding.entity.ts`
- Create: `apps/backend/src/migrations/1000000000054-AddModbusDevices.ts`
- Create: `dto/create-device.dto.ts`, `dto/update-device.dto.ts`, `dto/create-channel.dto.ts`, `dto/update-channel.dto.ts`,
  `dto/create-channel-property.dto.ts`, `dto/update-channel-property.dto.ts` (STI DTOs, pattern: `devices-third-party/dto`)
- Modify: `devices-modbus.plugin.ts` (`TypeOrmModule.forFeature` gains the three new entities)
- Test: `apps/backend/src/migrations/__tests__/1000000000054-AddModbusDevices.spec.ts`

**Interfaces:**
- Produces:
  - `ModbusEndpointEntity` (`@Entity('devices_modbus_endpoints')`): `id: string`, `name: string`, `host: string`,
    `port: number`, `framing: ModbusFraming`, `connectTimeoutMs: number`, `requestTimeoutMs: number`,
    `interRequestDelayMs: number`, `maxInFlight: number`, `enabled: boolean`, `createdAt`, `updatedAt`. JSON exposure
    snake_case (`connect_timeout_ms`, …).
  - `ModbusDeviceEntity extends DeviceEntity` (`@ChildEntity()`, `type` getter returns `'devices-modbus'`), nullable
    columns: `modbusEndpointId`, `modbusUnitId`, `modbusPollIntervalMs`, `modbusByteOrder`, `modbusWordOrder`,
    `modbusMaxReadRegisters`, `modbusMaxReadBits`, `modbusMaxReadGap`, `modbusTemplateId`, `modbusTemplateRevision`.
    JSON exposure: `endpoint_id`, `unit_id`, `poll_interval_ms`, `byte_order`, `word_order`, `max_read_registers`,
    `max_read_bits`, `max_read_gap`, `template_id`, `template_revision`.
  - `ModbusChannelEntity`, `ModbusChannelPropertyEntity`: `type` getter only.
  - `ModbusBindingEntity` (`@Entity('devices_modbus_bindings')`): `id`, `propertyId`, `deviceId`, `role: ModbusBindingRole`,
    `registerType`, `address`, `dataType`, `bit: number | null`, `byteOrder: ModbusByteOrder | null`,
    `wordOrder: ModbusByteOrder | null`, `scale: number` (1), `offset: number` (0), `invert: boolean` (false),
    `valueMap: ModbusValueMapEntry[] | null` (JSON text), `writeFunction: ModbusWriteFunction | null`,
    `pollIntervalMs: number | null`, `staticValue` not stored here (static properties use the core property value).
  - `type ModbusValueMapEntry = { raw: number; value: string | number | boolean }` — an array, because JSON object keys
    cannot be booleans.
- Migration up:
  - `CREATE TABLE "devices_modbus_endpoints"` with the columns above, `UNIQUE ("host", "port")`.
  - `ALTER TABLE "devices_module_devices" ADD COLUMN` for each device column (all nullable, SQLite types `varchar` /
    `integer`); FK on `modbusEndpointId` is enforced in the service (SQLite cannot add an FK by `ALTER TABLE`).
  - `CREATE UNIQUE INDEX "IDX_devices_modbus_endpoint_unit" ON "devices_module_devices" ("modbusEndpointId", "modbusUnitId") WHERE "type" = 'devices-modbus'`.
  - `CREATE TABLE "devices_modbus_bindings"` with FK `propertyId` → `devices_module_channels_properties(id) ON DELETE CASCADE`,
    FK `deviceId` → `devices_module_devices(id) ON DELETE CASCADE`, `UNIQUE ("propertyId", "role")`.
  - Down drops both tables, the index and the added columns.

- [ ] **Step 1: Write the failing migration test** (harness: `1000000000019-EnforceUniqueWledHardwareIdentity.spec.ts`
  — in-memory SQLite, minimal pre-existing `devices_module_devices` and `devices_module_channels_properties` tables).
  Tests:
  - `it('creates endpoint and binding tables')` — after `up`, `SELECT name FROM sqlite_master` contains both tables.
  - `it('rejects a second endpoint with the same host and port')` — second insert of `('10.10.0.230', 8080)` throws `UNIQUE constraint failed`.
  - `it('rejects two modbus devices with the same endpoint and unit')` — two `devices-modbus` rows with endpoint `e1`, unit `2` → second throws; the same pair on a non-modbus `type` row is accepted.
  - `it('deletes bindings with their property')` — with `PRAGMA foreign_keys = ON`, deleting the property row removes its binding rows.
  - `it('down removes everything up added')` — after `down`, tables, index and columns are gone.
- [ ] **Step 2: Run it and see it fail**
  Run: `cd apps/backend && pnpm exec jest src/migrations/__tests__/1000000000054-AddModbusDevices.spec.ts`
  Expected: FAIL — cannot find module.
- [ ] **Step 3: Implement** the migration, entities and STI DTOs. `CreateModbusDeviceDto` requires `endpoint_id`
  (uuid) and `unit_id` (0–255); other device fields optional with the defaults from Global Constraints.
- [ ] **Step 4: Run the migration test and the plugin test**
  Run: `cd apps/backend && pnpm exec jest src/migrations/__tests__/1000000000054-AddModbusDevices.spec.ts src/plugins/devices-modbus`
  Expected: PASS.
- [ ] **Step 5: Commit** — `feat(backend): add modbus endpoint, device and binding storage`

---

### Task 3: Codec

**Files:**
- Create: `lib/codec.ts`
- Test: `lib/codec.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface ModbusValueOptions {
  	dataType: ModbusDataType;
  	byteOrder: ModbusByteOrder;
  	wordOrder: ModbusByteOrder;
  	bit: number | null;
  	invert: boolean;
  	scale: number;
  	offset: number;
  	valueMap: ModbusValueMapEntry[] | null;
  }
  export type ModbusPropertyValue = string | number | boolean;
  export function registerSpan(dataType: ModbusDataType): 1 | 2;
  export function decodeRegisters(words: readonly number[], options: ModbusValueOptions): ModbusPropertyValue | null;
  export function decodeBit(bit: boolean, options: Pick<ModbusValueOptions, 'invert' | 'valueMap'>): ModbusPropertyValue | null;
  export function encodeValue(
  	value: ModbusPropertyValue,
  	options: ModbusValueOptions,
  	target: 'bit' | 'registers', // 'bit' for coils, 'registers' for holding registers
  ): { kind: 'bit'; value: boolean } | { kind: 'registers'; words: number[] };
  export class ModbusValueRangeError extends Error {}
  ```
- Semantics:
  - `byteOrder` swaps the two bytes inside each register; `wordOrder: little` puts the low word first for 32-bit types.
  - `bit` (0–15) extracts one bit of the first register → boolean; `dataType` must be `bool`.
  - `invert` negates booleans only.
  - `valueMap` and `scale`/`offset` are mutually exclusive (validated in Task 8). With a map, decode looks up `raw`
    and returns `null` when absent; encode looks up `value` and throws `ModbusValueRangeError` when absent.
  - Without a map: decoded number `= raw * scale + offset`; encode `raw = Math.round((value - offset) / scale)` for
    integer types (float32 not rounded) and throws `ModbusValueRangeError` if `raw` is outside the type's range.
  - `bit` bindings are read-only: `encodeValue` with `bit !== null` throws `ModbusValueRangeError`.

- [ ] **Step 1: Write the failing tests** in `lib/codec.spec.ts`:
  - `decodes big-endian float` — words `[0x3fec, 0xcccd]`, float32, big/big → `≈ 1.85` (`toBeCloseTo(1.85, 5)`).
  - `decodes low-word-first uint32` — words `[0x0001, 0x0000]`, uint32, byte big, word little → `1`.
  - `decodes byte-swapped uint32` — words `[0x0000, 0x0100]`, uint32, byte little, word big → `1`.
  - `decodes int16 sign` — `[0xffff]`, int16 → `-1`; uint16 → `65535`.
  - `extracts Qingjun bits` — `[0x8000]` bit 15 → `true`; `[0x0001]` bit 0 → `true`; `[0x0001]` bit 1 → `false`.
  - `inverts booleans` — `decodeBit(true, { invert: true, valueMap: null })` → `false`.
  - `maps relay read values` — `[1]` with map `[{raw:1,value:true},{raw:0,value:false}]` → `true`; `[2]` → `null`.
  - `applies scale and offset` — `[215]`, int16, scale `0.1`, offset `0` → `21.5`.
  - `encodes relay write values` — target `'registers'`, `true` with map `[{raw:256,value:true},{raw:512,value:false}]` → `{ kind: 'registers', words: [256] }`; `false` → `[512]`.
  - `encodes coil` — `encodeValue(true, boolOptions, 'bit')` → `{ kind: 'bit', value: true }`; with `invert: true` → `value: false`.
  - `encodes bool into a register` — `encodeValue(true, boolOptions, 'registers')` → `{ kind: 'registers', words: [1] }`.
  - `encodes scaled int16` — `21.5`, scale `0.1` → `[215]`.
  - `refuses out-of-range` — `70000` as uint16 → throws `ModbusValueRangeError`; unmapped `'toggle'` with a map → throws.
  - `refuses bit writes` — any value with `bit: 3` → throws.
  - `round-trips float32 low-word-first` — encode `1.85` then decode with the same options → `≈ 1.85`.
- [ ] **Step 2: Run and see it fail** — `cd apps/backend && pnpm exec jest src/plugins/devices-modbus/lib/codec.spec.ts` → FAIL, module not found.
- [ ] **Step 3: Implement** with `Buffer`/`DataView` big-endian reads after reordering bytes and words.
- [ ] **Step 4: Run and see it pass** — same command → PASS.
- [ ] **Step 5: Commit** — `feat(backend): add modbus register codec`

---

### Task 4: Read planner

**Files:**
- Create: `lib/read-planner.ts`
- Test: `lib/read-planner.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface ReadPoint { key: string; registerType: ModbusRegisterType; address: number; span: number }
  export interface ReadBlock { registerType: ModbusRegisterType; address: number; count: number; points: ReadPoint[] }
  export interface ReadLimits { maxRegisters: number; maxBits: number; maxGap: number }
  export function planReadBlocks(points: readonly ReadPoint[], limits: ReadLimits): ReadBlock[];
  export function splitBlock(block: ReadBlock): ReadBlock[]; // one block per distinct point span, for exception fallback
  export function sliceForPoint(block: ReadBlock, values: readonly (number | boolean)[], point: ReadPoint): (number | boolean)[];
  ```
- `span` is `registerSpan(dataType)` for registers, `1` for coils/discrete inputs and for bit points.
- Blocks never mix register types; a new block starts when the next point begins more than `maxGap` addresses after
  the current block's end, or when extending would exceed `maxRegisters` (register types) / `maxBits` (bit types).
- Overlapping and duplicate points are merged into the same block (the register is read once).

- [ ] **Step 1: Write the failing tests**:
  - `groups contiguous registers` — holding 1..8 span 1 → one block `{address: 1, count: 8}` with 8 points.
  - `separates register types` — holding 4 and input 4 → two blocks.
  - `breaks on gaps when maxGap is 0` — holding 1 and 3 → two blocks; with `maxGap: 1` → one block `{1, 3}`.
  - `respects maxRegisters` — holding 0..129 span 1, `maxRegisters: 125` → blocks `{0,125}` and `{125,5}`.
  - `counts 32-bit spans` — holding 10 span 2 and holding 12 span 1 → one block `{10, 3}`.
  - `shares a register between bit points` — 32 points on holding 4/5 (Qingjun layout: 16 points address 4, 16 address 5) → one block `{4, 2}` with 32 points.
  - `merges overlapping points` — span-2 point at 10 and span-1 point at 11 → one block `{10, 2}`.
  - `sliceForPoint returns the point's own values` — block `{4,2}`, values `[0x0001, 0x8000]`, point at 5 span 1 → `[0x8000]`.
  - `splitBlock yields single-point blocks` — block with points at 1, 2, 2 (two bit points) → blocks at 1 and 2.
- [ ] **Step 2: Run and see it fail** — `cd apps/backend && pnpm exec jest src/plugins/devices-modbus/lib/read-planner.spec.ts`.
- [ ] **Step 3: Implement** — sort by `(registerType, address)` and sweep.
- [ ] **Step 4: Run and see it pass.**
- [ ] **Step 5: Commit** — `feat(backend): add modbus read planner`

---

### Task 5: Transport adapter

**Files:**
- Create: `lib/errors.ts`, `transport/modbus-transport.ts`, `transport/modbus-serial.transport.ts`
- Test: `transport/modbus-serial.transport.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface ModbusReadRequest { unitId: number; registerType: ModbusRegisterType; address: number; count: number }
  export interface ModbusWriteRequest {
  	unitId: number;
  	registerType: ModbusRegisterType.COIL | ModbusRegisterType.HOLDING_REGISTER;
  	address: number;
  	values: boolean[] | number[];
  	writeFunction: ModbusWriteFunction;
  }
  export interface ModbusTransport {
  	connect(): Promise<void>;
  	close(): Promise<void>;
  	isOpen(): boolean;
  	read(request: ModbusReadRequest): Promise<boolean[] | number[]>;
  	write(request: ModbusWriteRequest): Promise<void>;
  	onClose(listener: (error?: Error) => void): void;
  }
  export interface ModbusTransportOptions { host: string; port: number; framing: ModbusFraming; connectTimeoutMs: number; requestTimeoutMs: number }
  export function createModbusSerialTransport(options: ModbusTransportOptions): ModbusTransport;
  ```
  Errors in `lib/errors.ts`: `ModbusExceptionError(code: number)` (with `isGatewayError` true for `0x0A`/`0x0B`),
  `ModbusTimeoutError`, `ModbusConnectionError`, `ModbusEndpointUnavailableError`.
- Mapping: `tcp` → `client.connectTCP`; `rtu_over_tcp` → `client.connectTcpRTUBuffered`. Function codes: coil → FC01,
  discrete input → FC02, holding → FC03, input register → FC04; writes: coil single → FC05, coils multiple → FC15,
  register single → FC06, registers multiple → FC16. `client.setID(unitId)` is called immediately before each request
  (the connection serialises requests, Task 6). `setTimeout(requestTimeoutMs)` is always set. Library errors are mapped:
  `modbusCode` → `ModbusExceptionError`, `ETIMEDOUT`/"Timed out" → `ModbusTimeoutError`, socket errors →
  `ModbusConnectionError`. Reads return exactly `count` values (coil reads are trimmed; the library pads to 8).

- [ ] **Step 1: Write the failing tests** against `ModbusRTU.ServerTCP` from `modbus-serial` on an ephemeral port
  (`tcp` framing), plus a minimal `net.Server` that answers one canned RTU frame for `rtu_over_tcp`:
  - `reads holding registers` — server vector `getHoldingRegister(addr)` returns `addr * 10`; read `{unitId: 2, holding, address: 4, count: 2}` → `[40, 50]`.
  - `reads coils trimmed to count` — 3 coils → array length `3`.
  - `writes a single register with FC06` — `setRegister` spy receives `(1, 256)`.
  - `maps exception responses` — server throws `{ modbusErrorCode: 2 }` → rejects with `ModbusExceptionError` code `2`.
  - `maps timeouts` — server delays beyond `requestTimeoutMs: 100` → rejects with `ModbusTimeoutError`.
  - `speaks RTU over TCP` — canned server replies `02 03 04 00 01 80 00 <crc>` to FC03 unit 2 address 4 count 2 → `[1, 0x8000]` (compute CRC in the test with a small `crc16Modbus` helper in the spec file).
  - `reports close` — server socket destroyed → `onClose` listener called.
- [ ] **Step 2: Run and see it fail** — `cd apps/backend && pnpm exec jest src/plugins/devices-modbus/transport`.
- [ ] **Step 3: Implement** the adapter.
- [ ] **Step 4: Run and see it pass.**
- [ ] **Step 5: Commit** — `feat(backend): add modbus-serial transport adapter`

---

### Task 6: Endpoint connection

**Files:**
- Create: `runtime/endpoint-connection.ts`
- Test: `runtime/endpoint-connection.spec.ts`

**Interfaces:**
- Consumes: `ModbusTransport`, request types and errors (Task 5).
- Produces:
  ```ts
  export interface EndpointConnectionConfig {
  	endpointId: string;
  	framing: ModbusFraming;
  	maxInFlight: number;
  	interRequestDelayMs: number;
  }
  export type EndpointConnectionState = 'connecting' | 'connected' | 'backoff' | 'stopped';
  export interface EndpointHealth {
  	state: EndpointConnectionState;
  	lastError: string | null;
  	lastErrorAt: Date | null;
  	averageLatencyMs: number | null;
  	requests: number;
  	timeouts: number;
  	overloaded: boolean;
  }
  export class EndpointConnection {
  	constructor(config: EndpointConnectionConfig, transportFactory: () => ModbusTransport, random?: () => number);
  	start(): void;
  	stop(): Promise<void>;
  	read(request: ModbusReadRequest): Promise<boolean[] | number[]>;
  	write(request: ModbusWriteRequest): Promise<void>;
  	markOverloaded(overloaded: boolean): void;
  	getHealth(): EndpointHealth;
  	onStateChange(listener: (state: EndpointConnectionState) => void): () => void;
  }
  ```
- Behaviour (each line is a test below): one transport at a time; at most `maxInFlight` requests on the wire
  (`rtu_over_tcp` forces 1); writes are queued ahead of reads but never pre-empt a request on the wire;
  `interRequestDelayMs` between a response and the next send; RTU over TCP closes and reopens the transport after any
  timeout; TCP does so after 3 consecutive timeouts; on transport close all pending and queued requests reject with
  `ModbusConnectionError`; while in `backoff`, new requests reject immediately with `ModbusEndpointUnavailableError`;
  reconnect delays 1000, 2000, 4000, … capped at 60000 ms, each multiplied by `0.8 + 0.4 * random()`; `stop()` rejects
  everything and closes.

- [ ] **Step 1: Write the failing tests** with a `FakeTransport` (in the spec file) whose requests resolve or reject on
  demand, and `jest.useFakeTimers()`:
  - `serialises requests on rtu_over_tcp even when maxInFlight is 4` — two reads queued; the second is sent only after the first settles.
  - `allows maxInFlight requests on tcp` — `maxInFlight: 2`, three reads → two sent at once.
  - `puts writes ahead of queued reads` — read A on wire, then reads B, C queued, then write W → send order A, W, B, C.
  - `waits interRequestDelayMs between requests` — delay 20: second send happens only after advancing 20 ms.
  - `resets the socket after a timeout on rtu_over_tcp` — a `ModbusTimeoutError` → `close()` then a new transport from the factory before the next request.
  - `resets the socket after three consecutive timeouts on tcp` — two timeouts: same transport; third: new transport; a success in between resets the count.
  - `rejects pending requests when the socket closes` — `onClose` fires → queued and in-flight promises reject with `ModbusConnectionError`.
  - `fails fast while in backoff` — after a failed connect, `read()` rejects with `ModbusEndpointUnavailableError` without calling the transport.
  - `backs off exponentially with jitter and a 60 s cap` — with `random = () => 0.5`, connect retries at 1000, 2000, 4000 … and never above 60000 ms.
  - `reports health` — after one success and one timeout: `requests: 2`, `timeouts: 1`, `lastError` set, `state: 'connected'`.
- [ ] **Step 2: Run and see it fail** — `cd apps/backend && pnpm exec jest src/plugins/devices-modbus/runtime/endpoint-connection.spec.ts`.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run and see it pass.**
- [ ] **Step 5: Commit** — `feat(backend): add serialized modbus endpoint connection`

---

### Task 7: Endpoints service and API

**Files:**
- Create: `services/modbus-endpoints.service.ts`, `controllers/modbus-endpoints.controller.ts`,
  `dto/create-endpoint.dto.ts`, `dto/update-endpoint.dto.ts`, `models/endpoint-response.model.ts`,
  `models/endpoint-health.model.ts`
- Create (stub filled in Task 9): `services/modbus-connections.service.ts` with `reconcile(): Promise<void>` and
  `getHealth(endpointId: string): EndpointHealth | null`
- Modify: `devices-modbus.openapi.ts`, `devices-modbus.plugin.ts`
- Test: `services/modbus-endpoints.service.spec.ts`, `controllers/modbus-endpoints.controller.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  class ModbusEndpointsService {
  	findAll(): Promise<ModbusEndpointEntity[]>;
  	findOne(id: string): Promise<ModbusEndpointEntity | null>;
  	getOneOrThrow(id: string): Promise<ModbusEndpointEntity>;
  	create(dto: CreateModbusEndpointDto): Promise<ModbusEndpointEntity>;
  	update(id: string, dto: UpdateModbusEndpointDto): Promise<ModbusEndpointEntity>;
  	remove(id: string): Promise<void>;
  }
  ```
  Routes (`@Controller('endpoints')`, roles owner/admin): `GET endpoints`, `GET endpoints/:id`, `POST endpoints`,
  `PATCH endpoints/:id`, `DELETE endpoints/:id`, `GET endpoints/:id/health`. Operation IDs
  `get-devices-modbus-plugin-endpoints`, `get-devices-modbus-plugin-endpoint`, `create-devices-modbus-plugin-endpoint`,
  `update-devices-modbus-plugin-endpoint`, `delete-devices-modbus-plugin-endpoint`,
  `get-devices-modbus-plugin-endpoint-health`.
- `create`/`update` apply defaults, force `maxInFlight = 1` for `rtu_over_tcp`, default `interRequestDelayMs` by
  framing, and call `connections.reconcile()` after commit. `remove` throws `DevicesModbusValidationException` listing
  device names when any `ModbusDeviceEntity` references the endpoint.

- [ ] **Step 1: Write the failing tests**:
  - service `applies framing defaults` — create `{ name, host: '10.10.0.10', framing: 'rtu_over_tcp', max_in_flight: 4 }` → saved `maxInFlight: 1`, `interRequestDelayMs: 20`, `port: 502`.
  - service `rejects duplicate host and port` — second create with same host/port → `DevicesModbusValidationException`.
  - service `refuses to delete an endpoint in use` — a device references it → throws, message contains the device name; endpoint still present.
  - service `reconciles connections after changes` — `connections.reconcile` called once after create, update and remove.
  - controller `returns the health model` — `GET endpoints/:id/health` returns `data` equal to `connections.getHealth(id)`; unknown endpoint → 404.
- [ ] **Step 2: Run and see it fail** — `cd apps/backend && pnpm exec jest src/plugins/devices-modbus/services/modbus-endpoints.service.spec.ts src/plugins/devices-modbus/controllers`.
- [ ] **Step 3: Implement** following the devices-module controller pattern; validation messages in the project's
  `[{"field": …, "reason": …}]` format.
- [ ] **Step 4: Run and see it pass.**
- [ ] **Step 5: Commit** — `feat(backend): add modbus endpoint management API`

---

### Task 8: Device structure creation and bindings API

**Files:**
- Create: `services/modbus-device-structure.service.ts`, `services/modbus-bindings.service.ts`,
  `controllers/modbus-devices.controller.ts`, `dto/create-device-structure.dto.ts`, `dto/binding.dto.ts`,
  `models/device-response.model.ts`, `models/bindings-response.model.ts`
- Modify: `devices-modbus.openapi.ts`, `devices-modbus.plugin.ts`
- Test: `services/modbus-device-structure.service.spec.ts`

**Interfaces:**
- Produces:
  - `ModbusBindingDto`: `register_type`, `address`, `data_type`, `bit?`, `byte_order?`, `word_order?`, `scale?`,
    `offset?`, `invert?`, `value_map?: { raw: number; value: string | number | boolean }[]`, `write_function?`,
    `poll_interval_ms?`.
  - `CreateModbusDeviceStructureDto` (`DevicesModbusPluginCreateDeviceStructure`): device fields (`id?`, `name`,
    `category`, `room_id?`, `endpoint_id`, `unit_id`, `poll_interval_ms?`, `byte_order?`, `word_order?`,
    `max_read_registers?`, `max_read_bits?`, `max_read_gap?`, `template_id?`, `template_revision?`) and
    `channels: { id?, identifier?, name, category, properties: { id?, identifier?, name?, category, data_type,
    permissions, unit?, format?, static_value?, read?: ModbusBindingDto, write?: ModbusBindingDto }[] }[]`.
  - `ModbusDeviceStructureService.create(dto): Promise<ModbusDeviceEntity>`.
  - `ModbusBindingsService.findByDevice(deviceId: string): Promise<ModbusBindingEntity[]>`;
    `findByProperty(propertyId: string): Promise<{ read: ModbusBindingEntity | null; write: ModbusBindingEntity | null }>`.
  - Routes (`@Controller('devices')`, owner/admin): `POST devices` (operationId `create-devices-modbus-plugin-device`,
    request `DevicesModbusPluginReqCreateDeviceStructure`, response `DevicesModbusPluginResDevice`);
    `GET devices/:id/bindings` (operationId `get-devices-modbus-plugin-device-bindings`).
- Creation runs inside `DeviceStructureLockService.runExclusive` and
  `DeviceCreationContext.run((work) => dataSource.transaction(work), DEVICES_MODBUS_TYPE, op, afterCommit)`
  (reference: `plugins/devices-virtual/services/native-thermostat.service.ts` around line 282): the device goes through
  `DevicesService.create(dto, context)`, channels/properties/bindings are saved with `context.manager`, and the runtime
  is told to load the device in `afterCommit`. If `DeviceCreationContext` refuses a plain `dataSource.transaction`
  writer, stop and report — do not bypass the creation context.
- Validation before any write (each produces `DevicesModbusValidationException` with a field path):
  endpoint exists; `(endpoint, unit)` unused; every property with `ro`/`rw` permission has `read`; `write` only with
  `rw`/`wo`; `wo` properties have no `read`; at least one `read` binding in the device; static properties
  (`static_value`) have no bindings; `write.register_type` is `coil` or `holding_register`; `discrete_input`/`coil`
  bindings use `data_type: bool` and no `bit`; `bit` 0–15 only with `bool` on register types and never on `write`;
  `value_map` and non-default `scale`/`offset` are exclusive; `value_map` raw values unique, values unique; address +
  span ≤ 65536; two `write` bindings in the device must not target the same register or coil; the spec structure passes
  `DeviceValidationService.validateDeviceStructure({ category, channels })` with no errors.

- [ ] **Step 1: Write the failing tests** (Nest testing module with in-memory SQLite and the real devices module
  services, following the closest existing integration spec in `plugins/devices-virtual/services/*.integration.spec.ts`):
  - `creates the N4D8B08 relay structure atomically` — category `switcher`, eight `switcher` channels with `on` (`rw`)
    read `{holding, address: n, uint16, value_map [{1,true},{0,false}]}` and write `{holding, address: n, uint16,
    value_map [{256,true},{512,false}], write_function: single}`; result has 8 channels and 16 binding rows.
  - `rolls back everything when a binding fails` — force the second binding insert to throw → no device, channel,
    property or binding rows remain.
  - `refuses a duplicate unit on the same endpoint` and `allows the same unit on another endpoint`.
  - `refuses rw properties without a read binding`; `refuses a device without any read binding`.
  - `refuses bit write bindings`; `refuses value_map with scale`; `refuses two writes to the same register`.
  - `refuses structures the spec rejects` — category `input_controller` with only a `switcher` channel → error.
- [ ] **Step 2: Run and see it fail** — `cd apps/backend && pnpm exec jest src/plugins/devices-modbus/services/modbus-device-structure.service.spec.ts`.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run and see it pass.**
- [ ] **Step 5: Commit** — `feat(backend): add atomic modbus device creation`

---

### Task 9: Runtime service (polling, decoding, connection state)

**Files:**
- Modify: `services/modbus-connections.service.ts` (full implementation)
- Create: `services/modbus-runtime.service.ts`, `runtime/device-poller.ts`
- Modify: `devices-modbus.plugin.ts`
- Test: `runtime/device-poller.spec.ts`, `services/modbus-runtime.service.spec.ts`, `services/modbus-connections.service.spec.ts`

**Interfaces:**
- Consumes: Tasks 3–8.
- Produces:
  ```ts
  class ModbusConnectionsService {
  	reconcile(): Promise<void>;                 // start/stop/rebuild connections to match enabled endpoints
  	get(endpointId: string): EndpointConnection | null;
  	getHealth(endpointId: string): EndpointHealth | null;
  	stopAll(): Promise<void>;
  }
  interface PollerCallbacks {
  	report(propertyId: string, value: ModbusPropertyValue | null, sampledAt: Date): Promise<void>;
  	setConnectionState(state: ConnectionState, reason?: string): Promise<void>;
  	isCurrent(): boolean;
  }
  class DevicePoller {
  	constructor(device: ModbusDeviceSnapshot, connection: EndpointConnection, callbacks: PollerCallbacks);
  	start(): void;
  	stop(): void;
  	pollNow(propertyIds?: string[]): Promise<void>; // used by the platform for read-back
  }
  interface ModbusDeviceSnapshot {
  	deviceId: string; endpointId: string; unitId: number; pollIntervalMs: number;
  	byteOrder: ModbusByteOrder; wordOrder: ModbusByteOrder; limits: ReadLimits;
  	reads: Array<{ propertyId: string; binding: ModbusBindingEntity }>;
  }
  class ModbusRuntimeService implements IManagedExtensionService {
  	readonly owner: { kind: 'plugin'; type: 'devices-modbus-plugin' };
  	readonly serviceId: 'connector';
  	start(): Promise<void>; stop(): Promise<void>; getState(): ServiceState;
  	loadDevice(deviceId: string): Promise<void>;
  	unloadDevice(deviceId: string): Promise<void>;
  	readBack(deviceId: string, propertyIds: string[]): Promise<void>;
  	getConnection(deviceId: string): EndpointConnection | null;
  }
  ```
- Behaviour:
  - Read plans are computed once per snapshot (Task 4); points with their own `pollIntervalMs` get their own schedule.
  - A device never has more than one poll queued; if a poll is still running at the next tick, the tick is skipped and
    the endpoint is marked overloaded until a poll completes within its interval.
  - Each decoded value is reported only when it differs from the last reported value for that property (first poll
    always reports). Reports use `ChannelsPropertiesService.reportSample(id, toInstance(UpdateModbusChannelPropertyDto,
    { type: 'devices-modbus', value }), { sampledAt, receivedAt: new Date(), observedAt: sampledAt, provenance: 'live',
    isCurrent }, { skipUnchangedMetadata: true })`.
  - `ModbusExceptionError` (non-gateway) on a block → its properties reported `null`, warning logged with endpoint,
    unit, function code, address and exception code; the block is split once with `splitBlock` and retried on the next
    poll as single-point blocks.
  - `ModbusTimeoutError`, `ModbusConnectionError`, `ModbusEndpointUnavailableError` and gateway exceptions
    (`0x0A`/`0x0B`) count as a failed poll. 3 consecutive failed polls → `lost`; a successful poll → `connected`.
  - Connection-state mapping: before first poll `init`; endpoint disabled or service stopping → `disconnected`;
    snapshot that cannot be built (missing endpoint, no read bindings) → `alert`. On `lost`, `alert`, `disconnected`,
    every read-bound property is reported `null` once.
  - Reacts to `EventType.DEVICE_CREATED`, `DEVICE_UPDATED`, `DEVICE_DELETED` for `type === 'devices-modbus'`
    (`@OnEvent`) by reloading or unloading that device; endpoint changes go through `reconcile()`, which stops pollers of
    affected devices, rebuilds the connection and restarts them.
  - Results arriving after `stop()`, `unloadDevice()` or a reload are discarded via `isCurrent()`.

- [ ] **Step 1: Write the failing tests** (fake `EndpointConnection`, fake callbacks, fake timers):
  - `reads the Qingjun board in one request` — 32 bit points on holding 4/5; connection returns `[0x0001, 0x8000]`
    → one read `{address: 4, count: 2}`; DI1 and DI32 reported `true`, the other 30 `false`.
  - `reports only changes` — two polls with the same words → second poll reports nothing.
  - `reports null for an unmapped relay value` — map `{1,0}`, register reads `2` → `report(id, null)`.
  - `invalidates a block on exception and splits it` — exception code `2` → all block properties `null`; next poll issues single-point reads.
  - `treats gateway exception 0x0B as a failed poll` — three polls rejecting with code `0x0B` → `setConnectionState('lost')`; properties not split.
  - `marks lost after three failed polls and recovers` — 3 timeouts → `lost` + all properties `null`; next success → `connected`.
  - `skips ticks while a poll is running and flags overload` — slow read longer than the interval → one read in flight, `markOverloaded(true)`.
  - `discards results after unload` — poll in flight, `unloadDevice`, then resolve → no `report` calls.
  - connections `rebuilds one connection when an endpoint changes` — update host → old connection `stop()` once, exactly one new connection, the device's poller restarted once.
  - runtime `marks a device without read bindings as alert`.
- [ ] **Step 2: Run and see it fail** — `cd apps/backend && pnpm exec jest src/plugins/devices-modbus/runtime src/plugins/devices-modbus/services/modbus-runtime.service.spec.ts src/plugins/devices-modbus/services/modbus-connections.service.spec.ts`.
- [ ] **Step 3: Implement.** Connection state through `DeviceConnectivityService.setConnectionState(deviceId, { state, reason })`.
- [ ] **Step 4: Run and see it pass.**
- [ ] **Step 5: Commit** — `feat(backend): poll modbus devices and report connection state`

---

### Task 10: Device platform (writes and read-back)

**Files:**
- Modify: `platforms/modbus.device.platform.ts` (full implementation)
- Test: `platforms/modbus.device.platform.spec.ts`

**Interfaces:**
- Consumes: `ModbusBindingsService.findByProperty`, `ModbusRuntimeService.getConnection` / `readBack`, `encodeValue`.
- Produces: `ModbusDevicePlatform implements IDevicePlatform` with `getType(): 'devices-modbus'`,
  `process(update: IDevicePropertyData): Promise<boolean>`, `processBatch(updates: IDevicePropertyData[]): Promise<boolean>`,
  `getCommandTimeoutMs(commandCount: number): number` (= `commandCount * (requestTimeoutMs + interRequestDelayMs) + 1000`).
- Behaviour:
  - Looks up the property's `write` binding; none → returns `false` and logs.
  - Encodes with the binding's options (device byte/word order unless overridden) and target `'bit'` for coils,
    `'registers'` for holding registers. Coil binding → FC05 (single) or
    FC15; holding register → FC06 for one word with `write_function: single`, otherwise FC16.
  - `processBatch`: groups updates per device; adjacent registers/coils of one device are merged into one FC15/FC16
    only when every member's binding has `write_function: multiple`; otherwise writes go one by one in the given order.
    Returns `true` only if every write succeeded.
  - After a successful write, calls `runtime.readBack(deviceId, [propertyId…])` for read-bound properties and does not
    wait for it to finish before returning `true`. Read-back failure is logged; the next regular poll settles the value.
  - Never reports the written value as a sample.
  - `ModbusValueRangeError`, `ModbusExceptionError`, timeouts and `ModbusEndpointUnavailableError` → `false` with a
    warning; no retry.

- [ ] **Step 1: Write the failing tests**:
  - `writes N4D8B08 on as 256 with FC06` — write binding map `{256,true},{512,false}` → connection `write({ unitId, registerType: holding, address: 3, values: [256], writeFunction: single })`; returns `true`; `readBack` called with the property id.
  - `writes a coil with FC05` — coil binding, value `false` → `values: [false]`, `single`.
  - `merges adjacent multiple-function writes` — two holding writes at 10 and 11, both `multiple` → one write `{address: 10, values: [a, b], multiple}`.
  - `does not merge single-function writes` — same with `single` → two writes.
  - `fails fast when the endpoint is in backoff` — connection rejects with `ModbusEndpointUnavailableError` → returns `false`, `readBack` not called, no `reportSample`.
  - `refuses out-of-range values` — `70000` to uint16 → `false`, no write sent.
  - `returns false without a write binding`.
- [ ] **Step 2: Run and see it fail** — `cd apps/backend && pnpm exec jest src/plugins/devices-modbus/platforms`.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run and see it pass.**
- [ ] **Step 5: Commit** — `feat(backend): execute modbus property commands`

---

### Task 11: End-to-end against a simulated device, OpenAPI and lint

**Files:**
- Create: `apps/backend/test/devices-modbus.e2e-spec.ts`
- Regenerate: `spec/api/v1/openapi.json`, `apps/admin/src/openapi.ts`, `apps/panel/lib/api/` (via the generator only)

**Interfaces:**
- Consumes: everything above, through the HTTP API.

- [ ] **Step 1: Write the failing e2e test** (setup pattern: `test/devices-virtual.e2e-spec.ts`), with a
  `modbus-serial` `ServerTCP` on an ephemeral port simulating an N4D8B08 (holding 1–8 read `1`/`0`, writes of `256`/`512`
  set them to `1`/`0`):
  - `creates an endpoint and a relay device over the API` — `POST /api/v1/plugins/devices-modbus/endpoints`, then
    `POST /api/v1/plugins/devices-modbus/devices` → 201 with 8 channels.
  - `polls relay state` — server register 3 set to `1` → within two poll intervals the property `on` of relay 3 reads `true`.
  - `switches a relay from a property command` — set relay 5 `on = true` through the devices module command API →
    server receives `256` at address 5; the property reads `true` after read-back.
  - `reports lost and recovers` — stop the server → device connection state `lost`, relay properties `null`; restart → `connected`.
  - `refuses deleting the endpoint while the device exists` → 400; delete the device, then the endpoint → 200.
- [ ] **Step 2: Run and see it fail** — `cd apps/backend && pnpm exec jest --config test/jest-e2e.json test/devices-modbus.e2e-spec.ts`.
- [ ] **Step 3: Fix whatever the e2e exposes** (scope: this plugin only).
- [ ] **Step 4: Run the full verification**
  Run: `pnpm run generate:openapi && pnpm run lint:js && cd apps/backend && pnpm exec jest src/plugins/devices-modbus src/migrations/__tests__/1000000000054-AddModbusDevices.spec.ts && pnpm exec jest --config test/jest-e2e.json test/devices-modbus.e2e-spec.ts`
  Expected: generator succeeds, lint clean, all tests PASS.
- [ ] **Step 5: Commit** — `feat(backend): verify modbus devices end to end and regenerate api clients`

---

## Self-review notes

- Spec coverage for Plan 1: endpoints entity, device columns, bindings table, migration, `modbus-serial` wrapper, both
  framings, queue/priority/delay/timeouts/backoff, read planning, decode/encode, change-only reporting, exceptions and
  gateway exceptions, connection states, writes with read-back, `rw` read-binding rule, one-unit-one-device uniqueness,
  owner/admin roles. Deferred to later plans by design: templates and shared loader (Plan 2); probe API, admin UI,
  device detail, point editing (Plan 3); button synthesis, valve/analog presentation, panel stub, docs, hardware
  acceptance (Plan 4).
