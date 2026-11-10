# Modbus Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an administrator manage Modbus endpoints and add Modbus devices from the admin app through a guided wizard, with live reads through the real endpoint and an explicit, confirmed test write.

**Architecture:** The backend gains a probe API (`probe/read`, `probe/points`, `probe/write`) that sends single, capped, rate-limited requests through the endpoint's existing connection (never a second socket to a saved endpoint), and three plugin config defaults. The admin gains a `devices-modbus` plugin: an endpoints page, a five-step add-device wizard opened from the Devices view, a device detail section and a settings form. Wizard logic that decides anything (address notation, ranges, points ↔ create request, category suggestion, error explanations) lives in pure TypeScript modules with unit tests; the Vue components stay thin.

**Tech Stack:** NestJS, TypeORM, class-validator, `modbus-serial` (`ServerTCP` in e2e); Vue 3, Pinia, Element Plus, zod, vue-i18n, openapi-fetch, Vitest + `@vue/test-utils`.

**Spec:** `docs/superpowers/specs/2026-11-09-modbus-devices-design.md` (sections Admin, Backend API, Security). Plans 1 and 2 (`2026-11-09-modbus-backend-core.md`, `2026-11-10-modbus-templates.md`) are merged.

## Global Constraints

- Probe endpoints are owner/admin only (`@Roles(UserRole.OWNER, UserRole.ADMIN)`), read-only except `probe/write`, size-capped, rate-limited, and never iterate addresses or unit IDs.
- Never open a second socket to a saved, enabled endpoint: probes of a saved endpoint go through its running `EndpointConnection`.
- "Nothing in the wizard writes to a device unless the user explicitly asks for that specific write": `probe/write` is only called from a **Test write** action that asks for confirmation every time.
- Addresses are stored 0-based (PDU). The wizard accepts 1-based and `0xxxx/1xxxx/3xxxx/4xxxx` notation and shows the stored address next to what the user typed.
- Modbus devices are created only through `POST /plugins/devices-modbus/devices` (the core devices route refuses them).
- Backend: all new routes follow CLAUDE.md "Backend API Conventions"; schema names prefixed `DevicesModbusPlugin`; Swagger decorators before Nest decorators; `*ResponseModel` responses; validation messages in the `[{"field":"…","reason":"…"}]` convention. Backend style: tabs, single quotes, print width 120.
- Admin: tabs, single quotes, print width 150, `trailingComma: 'es5'`, `singleAttributePerLine`, sorted imports (prettier config in `apps/admin`). Every plugin ships the six locales `en-US, cs-CZ, de-DE, es-ES, pl-PL, sk-SK` with identical key sets (non-English files may carry English text, but no key may be missing or blank).
- Admin imports API types only from `apps/admin/src/openapi.constants.ts` (hand-maintained); `apps/admin/src/openapi.ts` and `spec/api/v1/openapi.json` are generated and gitignored — never edit or commit them. Regenerate with `pnpm run generate:openapi` (repo root) after a backend API change.
- No new dependencies.
- Commit titles `<type>(backend|admin): <lowercase subject>`, trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Decisions taken in this plan

1. **Probe routing.** A probe names either `endpoint_id` or unsaved connection details (`host`, `port`, `framing`, optional timeouts). A saved endpoint with a running connection is probed through it; a saved endpoint without one (disabled, or runtime stopped) and unsaved details use a one-shot transport (connect, one request or one planned batch, close). Unsaved details whose `host`+`port` equal a saved endpoint are refused (400, field `host`, reason `An endpoint with this host and port already exists; probe it by endpoint_id.`) so a second socket to a configured gateway is impossible.
2. **Rate limits.** `@Throttle({ default: { limit: 60, ttl: 60000 } })` on `probe/read` and `probe/points`, `{ limit: 10, ttl: 60000 }` on `probe/write`. In addition one probe per target at a time: a second probe to the same `endpoint_id` or `host:port` while one runs → 429 `Another probe to this endpoint is still running.`
3. **Probe outcomes are 200 results**, not HTTP errors, when the request was valid: `{ ok, …, error: { kind, exception_code, message } | null, duration_ms }` with `kind` ∈ `timeout | connection | unavailable | exception | encode`. 400 for invalid requests, 404 for an unknown `endpoint_id`, 429 as above.
4. **Probe caps.** `probe/read`: bits `count` 1–2000, registers 1–125, `address + count ≤ 65536`. `probe/points`: at most 256 points, planned with `planReadBlocks` using the request's `max_read_registers/bits/gap` (defaults `MODBUS_DEFAULTS`); a block that fails with a request exception (0x01–0x03) is retried once split with `splitBlock`.
5. **Plugin config defaults.** `default_connect_timeout_ms` (2000), `default_request_timeout_ms` (1000), `default_poll_interval_ms` (1000) on the Modbus config. Endpoint create uses the first two when the DTO omits them. Devices keep `poll_interval_ms: null` meaning "runtime default"; the wizard prefills the poll interval from config instead (no backend change to device semantics).
6. **New endpoints are saved at the end of wizard step 1** (when the user continues), because device creation needs an `endpoint_id`. Abandoning the wizard leaves the endpoint, visible and deletable on the endpoints page. Probes before that use unsaved details.
7. **Template provenance only for unchanged points.** The wizard sends `template_id`/`template_revision` only if the points are exactly the template preview's (no row added, removed or edited). Otherwise the device is created as custom.
8. **Custom capabilities in this plan:** `binary_input.state` (read), `switcher.on` and `outlet.on` (read + write). Template points may carry any capability. Plan 4 adds analog input, valve, button and measured quantities.
9. **Category suggestion:** any point with a write binding → `switcher`; otherwise → `input_controller`. The user can change it; structure errors come back from the backend on create.
10. **Device detail "last raw value"** is an on-demand **Read now** of the saved bindings through `probe/points` (with `endpoint_id`), not a stored runtime value.
11. **Endpoints page** is a full-page child route of the Devices route (`meta.devicesWizard: true`, like the virtual wizard), linked from wizard step 1, the device detail section and the settings form.

## Review Focus

1. **A probe while the endpoint is polling** — it must queue behind polls on the same connection and never open a parallel socket (Task 1 test `probes a running endpoint through its connection`).
2. **Unsaved details that point at a configured gateway** — refused, not connected (Task 1 test `refuses unsaved details that match a saved endpoint`).
3. **Auto-refresh left running** — leaving step 3, the wizard or the page stops the timer, and no refresh starts while one is in flight (Task 9 test `stops auto refresh on unmount and never overlaps`).
4. **Typed address the user did not mean** — `40001` must become holding register 0 and be shown as such; `0-31` creates 32 rows; a range over 256 or past 65535 is refused with a message (Task 7 tests).
5. **Test write without confirmation** — cancelling the confirm dialog sends nothing (Task 9 test `does not write when the confirmation is cancelled`).

## Admin conventions (from the codebase; `ADM` = `apps/admin/src`)

- Reference plugins: `ADM/plugins/devices-virtual` (wizard route, `el-steps`, direct `backend.client.POST` in `components/wizard/virtual-wizard-review-step.vue:513-535`), `ADM/plugins/devices-wled` (config element: `devices-wled.plugin.ts:62-73`, `components/wled-config-form.vue`, `store/config.store.schemas.ts`, `schemas/config.schemas.ts`), `ADM/plugins/devices-homey/store/homey-inventory.store.ts` (plugin-owned setup store + `registerXStore(pinia)` + `storesManager.addStore`), `ADM/modules/notifications` (list page with data-source composable).
- Plugin install: locales merged under namespace `devicesModbusPlugin`; routes added under `DevicesRouteNames.DEVICES`; `pluginsManager.addPlugin(key, { type: 'devices-modbus-plugin', source: 'com.fastybird.smart-panel.plugin.devices-modbus', elements, routes: { wizard }, modules: [DEVICES_MODULE_NAME, CONFIG_MODULE_NAME] })`; registered in `ADM/app.main.ts` (`app.use(DevicesModbusPlugin, pluginOptions)` beside the other device plugins). Device element `type: 'devices-modbus'` with schemas and `components.deviceDetailSection`, no `deviceAddForm` (wizard-only, like Simulator). Copy the enabled-check `beforeEnter` guard from `devices-virtual.plugin.ts:63-76`.
- API: `useBackend().client.GET/POST/PATCH/DELETE('/plugins/devices-modbus/…')`, errors via `getErrorReason<Operation>(error, fallback)`; flash messages via `useFlashMessage()`.
- Tests: Vitest + `@vue/test-utils`, spec next to the file, backend mocked with `vi.mock('../../../common', …)` (see `devices-homey/store/homey-inventory.store.spec.ts:1-22`, `devices-wled/composables/useDevicesWizard.spec.ts:7-35`), locale parity like `devices-homey/locales/locales.spec.ts`. One file: `pnpm --filter @fastybird/smart-panel-admin exec vitest run <path>`; type-check: `pnpm --filter @fastybird/smart-panel-admin run type-check`; lint: `pnpm --filter ./apps/admin run lint:js` and `pnpm --filter ./apps/admin run pretty:check`.

---

### Task 1: Probe service — target resolution and single reads

**Files:**
- Create: `apps/backend/src/plugins/devices-modbus/services/modbus-probe.service.ts`, `services/modbus-probe.service.spec.ts`
- Modify: `services/modbus-connections.service.ts` (expose what the probe needs, nothing else), `devices-modbus.exceptions.ts` (add `ModbusProbeBusyException` → 429)

**Interfaces:**
- Consumes: `ModbusConnectionsService.get(endpointId)`, `EndpointConnection.read`, `createModbusSerialTransport`, `ModbusEndpointsService` (lookup by id and by host+port), errors from `lib/errors.ts`.
- Produces:
```ts
export type ModbusProbeTarget =
	| { endpointId: string }
	| { host: string; port: number; framing: ModbusFraming; connectTimeoutMs?: number; requestTimeoutMs?: number };
export type ModbusProbeErrorKind = 'timeout' | 'connection' | 'unavailable' | 'exception' | 'encode';
export interface ModbusProbeError { kind: ModbusProbeErrorKind; exceptionCode: number | null; message: string }
export interface ModbusProbeReadResult { ok: boolean; values: (number | boolean)[] | null; error: ModbusProbeError | null; durationMs: number }
export const MODBUS_PROBE_TRANSPORT_FACTORY = Symbol('MODBUS_PROBE_TRANSPORT_FACTORY'); // (options: ModbusTransportOptions) => ModbusTransport
@Injectable() export class ModbusProbeService {
	read(target: ModbusProbeTarget, request: ModbusReadRequest): Promise<ModbusProbeReadResult>;
	/** Runs `work` with a channel to the target: the running connection, or a one-shot transport closed afterwards. Single-flight per target. */
	withChannel<T>(target: ModbusProbeTarget, work: (channel: ModbusProbeChannel) => Promise<T>): Promise<T>;
}
export interface ModbusProbeChannel { read(r: ModbusReadRequest): Promise<boolean[] | number[]>; write(r: ModbusWriteRequest): Promise<void> }
export function toProbeError(error: unknown): ModbusProbeError; // ModbusTimeoutError→timeout, ModbusConnectionError→connection, ModbusEndpointUnavailableError→unavailable, ModbusExceptionError→exception (+code), ModbusValueRangeError→encode; anything else is rethrown
```
- Decisions 1–4 govern this task. Unknown `endpointId` → `ModbusEndpointNotFoundException` (existing, 404). Count/address caps are validated in Task 3's DTOs and asserted again here (throw `ModbusValidationException` with the field `count` or `address`).

- [ ] **Step 1: Write failing tests** (fake `ModbusConnectionsService.get`, fake endpoints lookup, injected fake transport factory):
  - `probes a running endpoint through its connection` — the fake connection's `read` is called with the request; the transport factory is never called.
  - `uses a one-shot transport for a saved endpoint without a running connection` — factory called once with the endpoint's host/port/framing/timeouts; `connect`, `read`, `close` in that order; `close` also called when `read` throws.
  - `uses a one-shot transport for unsaved details` with `MODBUS_DEFAULTS` timeouts when omitted.
  - `refuses unsaved details that match a saved endpoint` → `ModbusValidationException` field `host`; factory never called.
  - `maps failures to probe errors` — timeout, connection refused, endpoint unavailable, exception 2 (`exceptionCode: 2`), each `ok: false`, `values: null`.
  - `rejects a second probe to the same target while one runs` → `ModbusProbeBusyException`; a probe to a different target proceeds.
  - `rejects counts beyond the protocol limits` (holding 126, coil 2001, address 65500 + count 100).
- [ ] **Step 2: Run** `pnpm exec jest src/plugins/devices-modbus/services/modbus-probe.service.spec.ts` (in `apps/backend`) — Expected: FAIL (module missing).
- [ ] **Step 3: Implement.** Single-flight key: `endpoint:<id>` or `host:<host>:<port>` (lower-cased host); release in `finally`. `durationMs` from `performance.now()`.
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(backend): add a modbus probe service for single reads`

### Task 2: Probe points and test writes

**Files:**
- Modify: `services/modbus-probe.service.ts`, `services/modbus-probe.service.spec.ts`

**Interfaces:**
- Consumes: Task 1 `withChannel`, `toProbeError`; `planReadBlocks`, `splitBlock`, `sliceForPoint` (`lib/read-planner.ts`); `decodeBit`, `decodeRegisters`, `encodeValue`, `registerSpan` (`lib/codec.ts`).
- Produces:
```ts
export interface ModbusProbePoint { key: string; binding: ModbusProbeBinding }
export interface ModbusProbeBinding { registerType: ModbusRegisterType; address: number; dataType: ModbusDataType; bit: number | null;
	byteOrder: ModbusByteOrder | null; wordOrder: ModbusByteOrder | null; scale: number; offset: number; invert: boolean;
	valueMap: ModbusValueMapEntry[] | null; writeFunction: ModbusWriteFunction | null }
export interface ModbusProbePointsOptions { unitId: number; byteOrder: ModbusByteOrder; wordOrder: ModbusByteOrder; limits: ReadLimits }
export interface ModbusProbePointResult { key: string; raw: (number | boolean)[] | null; value: string | number | boolean | null; error: ModbusProbeError | null }
export interface ModbusProbePointsResult { ok: boolean; points: ModbusProbePointResult[]; error: ModbusProbeError | null; durationMs: number }
export interface ModbusProbeWriteResult { ok: boolean; error: ModbusProbeError | null; durationMs: number }
// on ModbusProbeService:
readPoints(target: ModbusProbeTarget, points: ModbusProbePoint[], options: ModbusProbePointsOptions): Promise<ModbusProbePointsResult>;
write(target: ModbusProbeTarget, unitId: number, binding: ModbusProbeBinding, value: string | number | boolean, defaults: { byteOrder: ModbusByteOrder; wordOrder: ModbusByteOrder }): Promise<ModbusProbeWriteResult>;
```
- `readPoints`: all blocks run inside one `withChannel`. A block failing with a request exception (0x01–0x03) is retried once as `splitBlock` reads; other block failures set that block's points' `error`. A decode error (e.g. `value_map` miss) sets that point's `error` (`kind: 'encode'`, message from the codec) with `raw` filled. `ok` is true when at least one point has a value; top-level `error` is set only when the channel itself failed (connect/unavailable) and then every point carries it too.
- `write`: only `coil`/`holding_register` targets (`ModbusValidationException` field `register_type` otherwise); `encodeValue` range or bit errors → `ok: false, kind: 'encode'` without touching the channel; FC chosen exactly as `ModbusDevicePlatform` does for one target (reuse its rule; extract a shared helper into `lib/` if it is private there, without changing platform behaviour).

- [ ] **Step 1: Write failing tests:** `decodes points in planned blocks` (one FC03 read for three adjacent registers; a 32-bit float point decoded with word order little); `splits a block once after an illegal address` (first block read rejects with exception 2, split reads succeed for the valid points and the bad point reports `exception`/2); `reports a value map miss per point`; `writes a relay through its value map` (true → FC06 value 256 with `write_function: single`); `refuses to write a bit binding` (`ok: false`, kind `encode`, channel untouched); `refuses a discrete input write target`.
- [ ] **Step 2: Run** the spec — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm exec jest src/plugins/devices-modbus` — Expected: PASS (platform tests unchanged).
- [ ] **Step 5: Commit** — `feat(backend): decode probe points and send confirmed test writes`

### Task 3: Probe API

**Files:**
- Create: `controllers/modbus-probe.controller.ts` (+ `.spec.ts`), `dto/probe.dto.ts`, `models/probe.model.ts`, `apps/backend/test/devices-modbus-probe.e2e-spec.ts`
- Modify: `devices-modbus.plugin.ts` (controller, service, `MODBUS_PROBE_TRANSPORT_FACTORY` default `createModbusSerialTransport`), `devices-modbus.openapi.ts`

**Interfaces:**
- Routes under `/plugins/devices-modbus/probe` (`@Controller('probe')`), all `@HttpCode(200)`, roles OWNER/ADMIN, throttles per Decision 2:

| Route | operationId | Body `data` | Response `data` |
|---|---|---|---|
| `POST read` | `create-devices-modbus-plugin-probe-read` | `ProbeModbusReadDto` | `ModbusProbeReadModel` (`DevicesModbusPluginDataProbeRead`) |
| `POST points` | `create-devices-modbus-plugin-probe-points` | `ProbeModbusPointsDto` | `ModbusProbePointsModel` (`DevicesModbusPluginDataProbePoints`) |
| `POST write` | `create-devices-modbus-plugin-probe-write` | `ProbeModbusWriteDto` | `ModbusProbeWriteModel` (`DevicesModbusPluginDataProbeWrite`) |

- DTO (`DevicesModbusPluginProbe…`, request wrappers `DevicesModbusPluginReqProbe…`): target fields `endpoint_id?` (uuid) xor (`host`, `port` 1–65535, `framing`, `connect_timeout_ms?`, `request_timeout_ms?` 1–`MODBUS_LIMITS.MAX_TIMING_MS`) — exactly one of the two forms, else 400 field `endpoint_id`; `unit_id` 0–255. Read: `register_type`, `address` 0–65535, `count` ≥1. Points: `byte_order?`, `word_order?`, `max_read_registers?` 1–125, `max_read_bits?` 1–2000, `max_read_gap?` ≥0, `points` 1–256 of `{ key: string 1–64, binding: ModbusBindingDto }` (reuse the existing binding DTO). Write: `binding: ModbusBindingDto`, `value: string | number | boolean`, `byte_order?`, `word_order?`.
- Models: snake_case mirrors of Task 1–2 results (`duration_ms`, `exception_code`, `raw`), nullable fields marked nullable, enum examples real values.

- [ ] **Step 1: Write failing tests.** Controller spec: roles metadata on all three handlers; throttle metadata values; DTO→service mapping (snake → camel, defaults applied); result wrapping. E2E (bootstrap and auth exactly like `test/devices-modbus.e2e-spec.ts`, `ServerTCP` simulator with holding registers 0..9 = 10..19 and register 5 serving an illegal-address exception if the simulator supports it — otherwise read beyond its range):
  - `POST probe/read` with unsaved details `{ host: '127.0.0.1', port, framing: 'tcp' }`, holding 0 count 3 → `ok: true`, `values: [10, 11, 12]`.
  - Same read by `endpoint_id` of a created endpoint → same values.
  - `count: 126` on holding → 400 detail `count`.
  - Unsaved details equal to the created endpoint's host+port → 400 detail `host`.
  - `POST probe/points` with three bindings (uint16 at 0, uint16 at 2 with `scale: 0.1`, bool bit 0 of register 1) → values `10`, `1.2`, `true`.
  - `POST probe/write` holding 7 value 99 → `ok: true`; a following `probe/read` returns 99.
  - A non-admin user → 403.
- [ ] **Step 2: Run** `pnpm exec jest src/plugins/devices-modbus/controllers/modbus-probe.controller.spec.ts` and `pnpm exec jest --config test/jest-e2e.json test/devices-modbus-probe.e2e-spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** controller, DTOs, models, wiring; register every new class in `DEVICES_MODBUS_PLUGIN_SWAGGER_EXTRA_MODELS`.
- [ ] **Step 4: Run** both commands — Expected: PASS. Then `pnpm run generate:openapi && pnpm --filter @fastybird/smart-panel-backend lint:openapi` (repo root) — Expected: success, no lint errors; commit no generated file.
- [ ] **Step 5: Commit** — `feat(backend): expose the modbus probe api`

### Task 4: Plugin config defaults

**Files:**
- Modify: `models/config.model.ts`, `dto/update-config.dto.ts`, `services/modbus-endpoints.service.ts` (+ spec), `devices-modbus.plugin.ts` readme paragraph if it lists settings
- Test: `services/modbus-endpoints.service.spec.ts`, a config DTO validation spec beside the DTO

**Interfaces:**
- Config fields (model camelCase with `@Expose({ name: 'snake_case' })` as other plugin configs do; DTO optional, integers): `default_connect_timeout_ms` 1–`MAX_TIMING_MS` default 2000, `default_request_timeout_ms` 1–`MAX_TIMING_MS` default 1000, `default_poll_interval_ms` `MIN_POLL_INTERVAL_MS`–`MAX_POLL_INTERVAL_MS` default 1000.
- `ModbusEndpointsService.create`: omitted `connect_timeout_ms`/`request_timeout_ms` come from `ConfigService.getPluginConfig<ModbusConfigModel>(DEVICES_MODBUS_PLUGIN_NAME)` (falling back to `MODBUS_DEFAULTS` if the config is unavailable). Update is unchanged.

- [ ] **Step 1: Write failing tests:** `creates an endpoint with the configured default timeouts`; `keeps explicit timeouts`; DTO rejects `default_poll_interval_ms: 50`.
- [ ] **Step 2: Run** the specs — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm exec jest src/plugins/devices-modbus`, then regenerate and lint OpenAPI as in Task 3 — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(backend): add default timeouts and poll interval to the modbus config`

### Task 5: Admin plugin skeleton and stores

**Files:**
- Create under `apps/admin/src/plugins/devices-modbus/`: `index.ts`, `devices-modbus.plugin.ts` (+ `.spec.ts`), `devices-modbus.constants.ts`, `devices-modbus.exceptions.ts`, `router/index.ts`, `locales/{en-US,cs-CZ,de-DE,es-ES,pl-PL,sk-SK}.json`, `locales/index.ts`, `locales/locales.spec.ts`, `schemas/` (device, channel, property, config schemas following devices-third-party/devices-wled), `store/keys.ts`, `store/endpoints.store.ts` (+ spec), `store/templates.store.ts` (+ spec), `store/*.schemas.ts`, `store/*.types.ts`, `store/*.transformers.ts`, placeholder views `views/view-modbus-wizard.vue` and `views/view-modbus-endpoints.vue` (a heading only; filled by Tasks 6 and 8)
- Modify: `apps/admin/src/app.main.ts`, `apps/admin/src/openapi.constants.ts`

**Interfaces:**
- Constants: `DEVICES_MODBUS_PLUGIN_NAME = 'devices-modbus-plugin'`, `DEVICES_MODBUS_PLUGIN_PREFIX = 'devices-modbus'`, `DEVICES_MODBUS_TYPE = 'devices-modbus'`, `RouteNames = { WIZARD: 'devices_modbus-wizard', ENDPOINTS: 'devices_modbus-endpoints' }`.
- Routes (children of `DevicesRouteNames.DEVICES`, `meta.devicesWizard: true`, roles admin+owner): `devices-modbus/wizard`, `devices-modbus/endpoints`. Launcher `routes.wizard = { label: 'devicesModbusPlugin.wizard.title', icon: 'mdi:lan-connect', to: { name: RouteNames.WIZARD }, testId: 'modbus-device-wizard' }`.
- Endpoints store (pinia id `devices_modbus_plugin-endpoints`, setup style, `registerModbusEndpointsStore(pinia)`, key `modbusEndpointsStoreKey`): state `data: Record<string, IModbusEndpoint>`, `health: Record<string, IModbusEndpointHealth>`; actions `fetch()`, `get(id)`, `add(data: IModbusEndpointCreate): Promise<IModbusEndpoint>`, `edit(id, data: IModbusEndpointUpdate)`, `remove(id)`, `fetchHealth(id)`; getters `findAll()`, `findById(id)`. Errors → `DevicesModbusApiException(message, status)` with `getErrorReason`. `IModbusEndpoint` camelCase: `id, name, host, port, framing, connectTimeoutMs, requestTimeoutMs, interRequestDelayMs, maxInFlight, enabled, createdAt, updatedAt`; health: `state, lastError, lastErrorAt, averageLatencyMs, requests, timeouts, overloaded`.
- Templates store (`devices_modbus_plugin-templates`): `fetch()` → catalog `{ templates: IModbusTemplateSummary[], files: IModbusTemplateFile[] }`, `reload()`, `preview(id, { unitId?, pollIntervalMs? }): Promise<IModbusTemplatePreview>` (camelCase transform of the backend models from Plan 2 Task 7).
- `openapi.constants.ts`: aliases for every Modbus schema, operation and enum the plugin uses (endpoints, health, device, bindings, templates, probe, config), in the existing naming style.

- [ ] **Step 1: Write failing tests:** plugin spec (registers `devices-modbus-plugin` with the `devices-modbus` device element, `routes.wizard` and the config element; Task 11 extends it with `deviceDetailSection`); locale parity spec; endpoints store spec (`fetch` maps snake→camel; `add` posts `{ data }` with snake fields; 422/400 error surfaces the backend reason; `remove` drops the entry); templates store spec (`fetch` keeps file errors; `preview` passes overrides).
- [ ] **Step 2: Run** `pnpm --filter @fastybird/smart-panel-admin exec vitest run src/plugins/devices-modbus` — Expected: FAIL.
- [ ] **Step 3: Implement** (all six locales; English text may be reused in the others).
- [ ] **Step 4: Run** the same command, `type-check`, `lint:js`, `pretty:check` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(admin): add the modbus plugin skeleton and stores`

### Task 6: Endpoints page

**Files:**
- Create: `components/endpoints/modbus-endpoints-table.vue`, `components/endpoints/modbus-endpoint-form.vue` (+ `.types.ts` each), `composables/useModbusEndpointsHealth.ts` (+ spec), `composables/useModbusEndpointForm.ts` (+ spec)
- Modify: `views/view-modbus-endpoints.vue`, locales

**Interfaces:**
- `useModbusEndpointsHealth(intervalMs = 5000)`: fetches health for every endpoint immediately and then every `intervalMs` while the component is mounted; one round at a time (skips a tick while the previous round runs); stops on unmount.
- `useModbusEndpointForm(endpoint?: IModbusEndpoint)`: model with defaults from the Modbus config (`defaultConnectTimeoutMs`, `defaultRequestTimeoutMs`) for new endpoints; framing change to `rtu_over_tcp` sets `interRequestDelayMs` 20 and `maxInFlight` 1 (and disables the latter); `submit()` → store `add`/`edit`; backend field errors shown on the field when `field` matches, else as a form alert.
- Table columns: name, `host:port`, framing, enabled switch (PATCH `enabled`), state tag (`connected` success, `connecting`/`backoff` warning, `stopped` info), last error with time, average latency, requests/timeouts, overloaded tag, device count (Modbus devices from the devices store whose `endpoint_id` matches, linking to them). Actions: edit (dialog with the form), delete with confirmation; a 400/409 refusal shows the backend reason (it lists the devices).

- [ ] **Step 1: Write failing tests:** health composable (`polls every interval and stops on unmount`, `never overlaps rounds` with a slow fake); form composable (`applies config defaults for a new endpoint`, `forces max in flight 1 for rtu over tcp`, `maps a backend host error onto the host field`).
- [ ] **Step 2: Run** the specs — Expected: FAIL.
- [ ] **Step 3: Implement** the composables, components and view.
- [ ] **Step 4: Run** plugin tests, type-check, lint, pretty — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(admin): add the modbus endpoints page`

### Task 7: Wizard logic modules

**Files:**
- Create under `apps/admin/src/plugins/devices-modbus/lib/`: `address-notation.ts`, `capabilities.ts`, `points.ts`, `probe-messages.ts`, each with a `.spec.ts`

**Interfaces:**
```ts
// address-notation.ts
export type AddressNotation = 'pdu' | 'one_based' | 'modicon';
export interface ParsedAddress { registerType: ModbusRegisterType | null; start: number; count: number } // start is PDU
export class AddressNotationError extends Error {}
export function parseAddressInput(input: string, notation: AddressNotation, registerType: ModbusRegisterType): ParsedAddress;
export function formatAddress(pduAddress: number, registerType: ModbusRegisterType, notation: AddressNotation): string;
// capabilities.ts
export interface ModbusCapability { key: string; channelCategory: string; propertyCategory: string; readable: boolean; writable: boolean; dataType: 'bool' }
export const CUSTOM_CAPABILITIES: ModbusCapability[]; // binary_input.state (read), switcher.on, outlet.on (read+write)
// points.ts
export interface ModbusPointBinding { registerType: ModbusRegisterType; address: number; dataType: ModbusDataType; bit: number | null;
	byteOrder: ModbusByteOrder | null; wordOrder: ModbusByteOrder | null; scale: number; offset: number; invert: boolean;
	valueMap: { raw: number; value: string | number | boolean }[] | null; writeFunction: ModbusWriteFunction | null }
export interface ModbusPoint { key: string; name: string; channelCategory: string; channelIdentifier: string; propertyCategory: string;
	dataType: string; permissions: string[]; staticValue: string | number | boolean | null; unit: string | null;
	read: ModbusPointBinding | null; write: ModbusPointBinding | null }
export function pointsFromRange(base: Omit<ModbusPoint, 'key' | 'name' | 'channelIdentifier'>, parsed: ParsedAddress, namePrefix: string): ModbusPoint[];
export function pointsFromPreview(preview: IModbusTemplatePreview): ModbusPoint[];
export function samePoints(a: ModbusPoint[], b: ModbusPoint[]): boolean; // ignores `key`
export function suggestCategory(points: ModbusPoint[]): 'switcher' | 'input_controller';
export function toCreateRequest(input: { name: string; category: string; roomId: string | null; endpointId: string; unitId: number;
	pollIntervalMs: number; byteOrder: ModbusByteOrder; wordOrder: ModbusByteOrder; points: ModbusPoint[];
	template: { id: string; revision: string; points: ModbusPoint[] } | null }): ApiCreateModbusDeviceStructure; // snake_case body `data`
// probe-messages.ts
export function explainProbeError(error: { kind: string; exceptionCode: number | null }): string; // an i18n key
```
- Notation rules: `pdu` → address as typed; `one_based` → typed − 1 (0 is an error); `modicon` → 5-digit `0xxxx` coil, `1xxxx` discrete input, `3xxxx` input register, `4xxxx` holding register, address = last four digits − 1, and 6-digit `4xxxxx` likewise with five digits; `modicon` returns `registerType`, the others return `null` (caller keeps its own). A range `a-b` (same notation both ends, `a ≤ b`) gives `count = b − a + 1`; more than 256 points, an end beyond 65535, or garbage → `AddressNotationError` with an i18n key as message.
- `toCreateRequest`: one channel per point (`identifier` = `channelIdentifier`, `name`), property `{ category, data_type, permissions, read, write, static_value?, unit? }` with bindings snake_cased; `template_id`/`template_revision` only when `template` is given and `samePoints(points, template.points)` (Decision 7); `poll_interval_ms`, `byte_order`, `word_order` always sent.
- `pointsFromRange`: keys unique, names `<prefix> <n>` (n from 1), channel identifiers slugged from the prefix + n (`[a-z0-9_]`, unique).
- `explainProbeError` keys: `connection` → refused/wrong port or TCP server off; `timeout` → wrong IP, unit ID or framing; `exception` 2 → device reachable, try another address; 1 → function not supported; 0x0A/0x0B → gateway could not reach the unit; `unavailable` → endpoint in backoff; others → generic.

- [ ] **Step 1: Write failing tests** (table-driven): `40001` modicon → holding 0; `30010` → input 9; 6-digit `400001` → holding 0; `1` one_based → 0; `0` one_based → error; `0-31` pdu → start 0 count 32; `0-300` → error (over 256); `65530-65540` → error; `abc` → error; `formatAddress(0, holding, 'modicon')` → `40001`; `suggestCategory` both ways; `toCreateRequest` drops provenance after a point edit and keeps it when unchanged; relay point with read map 1/0 and write map 256/512 survives the round trip `pointsFromPreview` → `toCreateRequest`; `explainProbeError` for each kind.
- [ ] **Step 2: Run** `pnpm --filter @fastybird/smart-panel-admin exec vitest run src/plugins/devices-modbus/lib` — Expected: FAIL.
- [ ] **Step 3: Implement** (add the i18n keys to all six locales).
- [ ] **Step 4: Run** the same command and type-check — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(admin): add modbus wizard address, point and probe helpers`

### Task 8: Wizard shell, endpoint step and template step

**Files:**
- Create: `composables/useModbusDeviceWizard.ts` (+ spec), `composables/useModbusProbe.ts` (+ spec), `components/wizard/modbus-wizard-endpoint-step.vue`, `components/wizard/modbus-wizard-template-step.vue` (+ `.types.ts`)
- Modify: `views/view-modbus-wizard.vue` (`el-steps` with 5 steps: Endpoint, Template, Points, Device, Review; back/next/cancel using `devicesModule.wizard.actions.*`), locales

**Interfaces:**
- `useModbusDeviceWizard()` state: `step`, `endpointMode: 'existing' | 'new'`, `endpointId`, `newEndpoint` (form model from Task 6), `unitId`, `template: { id, revision, points } | null`, `points: ModbusPoint[]`, `device: { name, category, roomId, pollIntervalMs, byteOrder, wordOrder }`, `notation: AddressNotation`; methods `canContinue(step)`, `saveNewEndpoint()` (Decision 6, store `add`, then `endpointMode = 'existing'`), `applyTemplate(id)` (store `preview` with `unitId`; fills points, defaults for `pollIntervalMs`/orders/`unitId` when the user has not changed them; for a new endpoint also `port`/`framing` from `endpoint_defaults`), `startEmpty()`, `probeTarget()` (`{ endpoint_id }` or unsaved details).
- `useModbusProbe()`: `read(target, unitId, registerType, address, count)`, `readPoints(target, unitId, points, orders)`, `write(target, unitId, binding, value, orders)` → results camelCased; HTTP 429 → result-like `{ ok: false, error: { kind: 'busy' } }` so callers can show "still running".
- Endpoint step: select existing endpoint (link to the endpoints page) or new endpoint form; unit ID (0–255; warning text for 0 = broadcast on RTU); **Test connection** panel (register type default holding, address default 0 in the chosen notation, count 1) showing raw values or `explainProbeError` text.
- Template step: list of templates (name, manufacturer, model, source badge, overrides badge), file load errors listed beneath; "Start empty" card.

- [ ] **Step 1: Write failing tests:** wizard composable (`saves a new endpoint once when leaving step 1` — a second `next` does not create another; `applies template defaults without overwriting user changes`; `keeps provenance after applying a template` → `template` set with preview points); probe composable (`maps a 429 to a busy result`; `sends endpoint_id for a saved endpoint and details for an unsaved one`).
- [ ] **Step 2: Run** the specs — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** plugin tests, type-check, lint, pretty — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(admin): add the modbus wizard endpoint and template steps`

### Task 9: Points step

**Files:**
- Create: `components/wizard/modbus-wizard-points-step.vue`, `components/wizard/modbus-point-editor.vue` (+ `.types.ts`), `composables/useModbusLiveValues.ts` (+ spec), `components/wizard/modbus-wizard-points-step.spec.ts`
- Modify: locales

**Interfaces:**
- Table rows = `wizard.points`: name, capability (`CUSTOM_CAPABILITIES` for new rows; template rows show theirs read-only), register type, address shown in the chosen notation with the stored PDU address beside it, data type, bit, byte/word order overrides, scale, offset, invert, value map (read and write), write function, live value, raw value, error. Add rows via an address input that accepts a range (`pointsFromRange`); edit in `modbus-point-editor.vue` (dialog); delete rows. Notation selector above the table.
- `useModbusLiveValues(points, readFn, intervalMs = 2000)`: `readNow()`, `autoRefresh` ref; while on, refreshes every interval, never two requests at once, stops on unmount; results keyed by point key.
- **Test write** (rows with a write binding only): input for the value (switch for bool), then `ElMessageBox.confirm` naming the device, unit, register and value; only on confirm → `useModbusProbe().write`; afterwards one `readNow()`.

- [ ] **Step 1: Write failing tests:** live values (`stops auto refresh on unmount and never overlaps`; `readNow fills raw and value per key`); points step (`adds 32 rows from 0-31`; `shows the stored address next to modicon input`; `does not write when the confirmation is cancelled` — `ElMessageBox.confirm` rejected → `write` not called; `writes once after confirmation and reads back`).
- [ ] **Step 2: Run** the specs — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** plugin tests, type-check, lint, pretty — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(admin): add the modbus wizard points step with live reads`

### Task 10: Device and review steps

**Files:**
- Create: `components/wizard/modbus-wizard-device-step.vue`, `components/wizard/modbus-wizard-review-step.vue` (+ `.types.ts`, + spec for review)
- Modify: `composables/useModbusDeviceWizard.ts` (+ spec): `create()`, locales

**Interfaces:**
- Device step: name (required), category select (prefilled by `suggestCategory`, `switcher` or `input_controller` offered plus the template's category), room select (reuse the room selection used by the core device add form; if it is not a reusable component, a select over the spaces store's rooms), poll interval (prefill from config `defaultPollIntervalMs` or template; min 100; hint suggesting 100–250 ms when points include button capabilities — none in this plan, keep the hint keyed for Plan 4), byte/word order.
- Review step: endpoint (name, host:port, framing), unit ID, device fields, template provenance or "custom", channels with their bindings (register, PDU address, data type, maps). **Create** → `toCreateRequest` → `backend.client.POST('/plugins/devices-modbus/devices', { body: { data } })`; on success `devicesStore.get({ id })` then navigate to the device detail route; on failure an `el-alert` with `getErrorReason` text and the step stays (`submitState: 'error'`), double-submit prevented while pending.

- [ ] **Step 1: Write failing tests:** wizard `create()` (`posts the structure once and returns the device id`; `keeps the error reason on a 400`); review step (`disables create while pending`, `shows the backend reason`).
- [ ] **Step 2: Run** the specs — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** plugin tests, type-check, lint, pretty — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(admin): add the modbus wizard device and review steps`

### Task 11: Device detail section and settings

**Files:**
- Create: `components/modbus-device-section.vue` (+ `.types.ts`, + spec), `components/modbus-config-form.vue` (+ `.types.ts`, + spec), `components/modbus-templates-catalog.vue`
- Modify: `devices-modbus.plugin.ts` (register `deviceDetailSection` and the config form), `store/config.store.schemas.ts`, `schemas/config.schemas.ts`, locales

**Interfaces:**
- Detail section (`device: IDevice` prop, `device.type === 'devices-modbus'`): endpoint (name, host:port, framing, state tag from the endpoints store's health, link to the endpoints page), unit ID, poll interval (or "default"), template provenance (`template_id` + `template_revision`, or "custom"), bindings table from `GET /plugins/devices-modbus/devices/{id}/bindings` (property, role, register type, PDU address, data type, bit, maps) with **Read now** → `probe/points` with `endpoint_id` and the saved read bindings, showing raw and decoded value per binding. No write action here.
- Config form (`useConfigPluginEditForm`): enabled, `defaultConnectTimeoutMs`, `defaultRequestTimeoutMs`, `defaultPollIntervalMs` (validation ranges as Task 4); below it `modbus-templates-catalog.vue`: templates with source and revision, files with errors and warnings, **Reload** button (templates store `reload()`, flash message with counts).

- [ ] **Step 1: Write failing tests:** section (`renders bindings from the api`; `read now probes the saved endpoint and shows raw values`; `shows custom when the device has no template`); config form (`saves defaults in snake case`; `reload refreshes the catalog`).
- [ ] **Step 2: Run** the specs — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm --filter ./apps/admin run test:unit`, type-check, `lint:js`, `pretty:check`; backend `pnpm exec jest src/plugins/devices-modbus` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(admin): add the modbus device section and settings`
