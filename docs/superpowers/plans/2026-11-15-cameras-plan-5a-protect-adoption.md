# Cameras — Plan 5a: UniFi Protect device mapping and adoption (UP-7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The `devices-unifi-protect` plugin lists the console's cameras, doorbells, UP-Sense sensors and floodlights,
previews how each maps to a spec-conformant Smart Panel device, and adopts them idempotently (per-item results,
re-adoption updates in place), optionally enabling an RTSPS stream on the cameras the user selected.

**Architecture:** Three strict YAML files (`mappings/definitions/{devices,channels,properties}.yaml`) validated by a JSON
schema and by semantic checks against the device spec are evaluated by one pure function over the console object.
Property attributes (data type, permissions, unit, format) come from the spec itself, so a mapping cannot drift from it.
`ProtectInventoryService` reads the console through the connector's live client; `ProtectMappingPreviewService`
revalidates one device with fresh reads and adds the preview warnings; `ProtectAdoptionService` creates a new device in
one `DeviceCreationContext` transaction and reconciles an existing one with the Homey compensating journal, then
`ProtectAdoptionStreamsService` enables RTSPS streams with the client's only write call.

**Tech Stack:** NestJS 11 on Fastify, TypeORM (SQLite), `ajv` and `yaml` (existing backend dependencies), class-validator,
class-transformer, `@nestjs/swagger`, Jest, supertest. No new dependency, no migration.

**Spec:** `docs/superpowers/specs/2026-10-06-unifi-protect-integration-design.md` §4.1, §4.3, §6 (D8, D9, D10 and
"Spike results (2026-11-14)"), §9, §10, §14a, §16. Issue #1183 (epic #1175). Roadmap
`docs/superpowers/plans/2026-11-12-cameras-roadmap.md` §1 (A9, A11), §4 (contracts, secret rule), §5 Plan 5 UP-7.
Reference implementation: `apps/backend/src/plugins/devices-homey/` and `docs/homey-adoption-persistence.md`.
UP-1, UP-2, UP-5 and UP-6 are merged on `main` (`14fbe76f3`); every interface below is verified on that commit.

---

## Decisions for approval

The issue, the design and the roadmap disagree or leave these open. The plan is written for each recommendation; the
"if not" line says what changes. Approve or amend before Task 1 starts.

**P1. Smoke and CO alarm sounds (`smartDetectAudioTypes` `alrmSmoke` / `alrmCmonx`).**
Options: (a) map them to the existing `smoke` / `carbon_monoxide` channels (issue #1183 table, design §10.1 and §14a);
(b) add `smoke_alarm` / `co_alarm` to the `sound_detection` `sound_type` enum (design "Spike results", spec-gap note).
**Recommendation: (a), no spec change in UP-7.** The spec already allows `smoke` and `carbon_monoxide` on `camera` and
`doorbell` (`spec/devices/devices.yaml`, verified), and the existing detection rules raise critical alerts for them
(`modules/security/spec/definitions/detection-rules.yaml`), which is what an alarm sound should do. The spike's follow-up
becomes optional; it is only needed if the product wants "alarm sound heard" separate from "smoke".
*Cost if wrong:* switching to (b) later is a spec PR plus re-adoption (stale `smoke`/`carbon_monoxide` channels are pruned,
`sound_detection.smoke_alarm` added) — no migration, because property formats are data, not CHECK constraints.

**P2. Floodlight PIR motion and status LED (design §10.4).** The `lighting` device spec allows `light`,
`device_information`, `electrical_energy`, `electrical_power`, `illuminance`, `button`, `binary_input`, `analog_input`,
`temperature` — **not `motion` and not `indicator`** (verified). `DeviceValidationService` reports an unknown channel as a
warning (`device-validation.service.ts:398-399`), so a "spec-validated" golden would fail.
Options: (a) add `motion` and `indicator` (optional, single) to `lighting` in `spec/devices/devices.yaml` in this PR (one
extra `feat(spec)` task, backend/admin/panel spec regeneration, `flutter analyze`); (b) map the floodlight as
`device_information` + `light` only and file a follow-up spec issue.
**Recommendation: (b).** UP-7's file ownership excludes `spec/`, the change touches the generated admin and panel specs,
and a floodlight is paired with a camera (`lights.json` `camera` key) whose own `motion` channel covers the same area.
*Cost if wrong:* floodlight-only PIR motion is not a security input until the follow-up; adding it later is the spec edit
plus two channel and two property mappings and a golden update. *If (a):* insert a Task 0 that edits `devices.yaml`,
runs `pnpm run generate:spec` and `melos rebuild-all && melos analyze`, and add `floodlight_motion` (`isPirMotionDetected`)
and `floodlight_indicator` (`lightDeviceSettings.isIndicatorEnabled`) mappings in Task 3.

**P3. Protect detection types without a spec value** (a future `smartDetectTypes` entry such as `pet`, an unknown
`alrm*`). Options: (a) skip the channel and add an `unsupported_detection_type` preview warning; (b) create a channel with
`object_type`/`sound_type` `unknown`. **Recommendation: (a).** Two unknown types would collide on one `…unknown`
identifier, and an `unknown` channel cannot be told apart in security rules (UP-16). *Cost if wrong:* a new console type
is invisible until a one-line YAML addition; the warning names it.

**P4. UP-Sense rules** (the sensor objects carry no `featureFlags`, `sensors.json` verified; the fixtures are synthetic):
- Capabilities from `mountType` and `*Settings.isEnabled`: `contact` when `mountType` is `door`, `window` or `garage`;
  `leak` when `mountType` is `leak` or `leakSettings.isExternalEnabled`; `motion`, `temperature`, `humidity`,
  `illuminance`, `smoke` when `motionSettings` / `temperatureSettings` / `humiditySettings` / `lightSettings` /
  `alarmSettings` `.isEnabled` is true; `battery` when `batteryStatus.percentage` exists.
- The UP-Sense alarm-sound detector (`alarmTriggeredAt`, `sensorAlarm`) maps to `smoke` only; there is no
  `carbon_monoxide` channel for a sensor, because the console does not say which alarm it heard.
- States derived from event timestamps (`leakDetectedAt`, `externalLeakDetectedAt`, `tamperingDetectedAt`,
  `alarmTriggeredAt`) start as `false` at adoption; UP-8's events set them. A timestamp from last month must not raise a
  critical alert on adoption (Review Focus 2). Boolean fields (`isOpened`, `isMotionDetected`) are used as read.
- `leak.level` is **required** by the spec (`low | medium | high`) and Protect has no level: it starts as `low` and UP-8
  keeps it in step with `detected` (`high` while a leak is detected).
**Recommendation: as listed.** *Cost if wrong:* re-adoption with corrected YAML; UP-20 (hardware acceptance) is where
the synthetic assumptions are checked against a real UP-Sense.

**P5. Camera classification and preview warnings.** The public camera object has no codec, firmware or third-party
field (`cameras.json`, `cameras-doorbell.json` verified).
- Doorbell = `featureFlags.hasLcdScreen === true` **or** `type` matching `/doorbell/i` (design §10.2 leaves it open; the
  synthetic doorbells carry both).
- `hevc_codec` only when the console object carries `videoCodec` `h265`/`hevc` (tolerant read; the private API has
  that field); otherwise no warning, and UP-11 shows "unsupported codec" at playback.
- `third_party_camera` only when `isThirdPartyCamera === true` (same tolerant read); no model-name heuristic.
- `device_disconnected` when `state !== 'CONNECTED'`; `stream_not_enabled` when no `high`/`medium`/`low` stream is enabled
  (and, separately, for `camera.package` when `hasPackageCamera` and `package` is not enabled).
- Two additions beyond the issue's four: `unsupported_detection_type` (P3) and `stream_state_unknown` (the stream read
  failed; the preview still renders). A mapping that fails spec validation adds `spec_validation_failed` and is not
  adoptable.
**Recommendation: as listed.** *Cost if wrong:* warnings are advisory except `spec_validation_failed`; changing a rule is
local to `protect-mapping-preview.service.ts`.

**P6. RTSPS stream enablement (D9).**
- Request per camera: `stream: { enabled, quality }`; `enabled` defaults to `true`, `quality` to the plugin's
  `default_stream_quality` (`medium`); `package` is added for a camera with `hasPackageCamera`.
- Before posting, the plugin reads `GET rtsps-stream`; if every wanted quality is enabled it posts nothing
  (`already_enabled`).
- The POST body is the **union** of the qualities already enabled and the wanted ones, in the order
  `high, medium, low, package`. The console's POST semantics (add vs replace) were not verified by the spike; the union is
  correct under both, so a stream another integration created is never disabled.
- POST retries only `429` (and the client's existing one-shot retry of a reset pooled socket); a `400`/`409` is followed
  by one re-read and counts as `already_enabled` when the re-read shows the wanted qualities.
- Order: the stream step runs **after** the device is persisted, and its failure never fails or rolls back the adoption
  (`status: created`, `stream.status: failed`). No adoption failure ever triggers a console write. UP-7 adds no DELETE at
  all, so "never deletes a stream it did not create" holds trivially.
**Recommendation: as listed.** *Cost if wrong:* if the console replaced qualities and the union were wrong, nothing is
lost; if adoption should fail on stream failure, that is a flag in `ProtectAdoptionService`.

**P7. Persistence: transaction for creates, journal for updates, in-process lock.**
- `ProtectDeviceEntity`'s type mapping is registered with `requiresCreationContext: true`
  (`devices-unifi-protect.plugin.ts:136`), so `DevicesService.create()` refuses a creation outside a
  `DeviceCreationContext` (`modules/devices/services/devices.service.ts:623`). Homey's create path
  (preallocated id, `rollbackUnannouncedCreate`, concurrent-creation wait) cannot be copied. A new device is therefore
  created with nested channels and properties inside `DeviceCreationContext.run` (`device-creation-context.ts:274`) under
  `DeviceStructureLockService.runExclusive`, exactly as `plugins/devices-virtual/services/virtual-light-group-authoring.service.ts:44-110`
  does: a failure rolls the transaction back and leaves nothing.
- Re-adoption of an existing device ports Homey's reconciliation with its compensating journal
  (`homey-device-adoption.service.ts:335-1040`) unchanged in behaviour, minus the cross-process lease.
- The per-device lock is in-process (Homey's `withDeviceLock` tails map), keyed by the Protect device id. There is no
  provider claim table: the default installation has one backend writer (`docs/homey-adoption-persistence.md`), and two
  database guards remain (`UQ_devices_identifier_type` and `UQ_unifi_protect_device_identity`). A lost unique insert is
  re-read and reconciled. No migration.
**Recommendation: as listed.** *Cost if wrong:* with independent backend writers two simultaneous adoptions of one camera
produce one device and one `persistence_failed` result that a retry turns into `skipped`; adding a claim table later is
one migration plus Homey's `HomeyAdoptionLockService` port.

**P8. Connector lifecycle.** Inventory, preview and adoption use `ProtectConnectorService.getClient()`
(`services/protect-connector.service.ts:174`), which is non-null only while `connected`. Otherwise the routes answer
`503` and adoption items fail with `unavailable`. The console identity (`nvrId`, MAC) is captured at connect: a new
`getConsoleIdentity()` on the connector (the connector already reads `GET nvrs` at connect, `:261-272`, but keeps only
`id` and `name`). Inventory reads the console on demand (three paced `GET`s, coalesced for concurrent callers, no cache);
UP-8 may later serve it from its realtime cache. A closed client mid-batch (config change) surfaces as `cancelled` and
fails the remaining items as `unavailable`.
**Recommendation: as listed.** *Cost if wrong:* a `422` (Homey's choice) instead of `503` is a one-line change per route.

**P9. Value conversions.**
- `illuminance.level` from lux with the design's thresholds (§14a: dark < 10, dusky < 50, moderate < 500, bright),
  **not** Homey's 10/100/1000 (`devices-homey/mappings/definitions/properties.yaml:247-264`).
- Floodlight `ledLevel` 1–6 → `brightness` % = `round(level × 100 / 6)` (17, 33, 50, 67, 83, 100); UP-9 inverts it.
- `device_information` connection state: `CONNECTED → connected`, `CONNECTING → init`, `DISCONNECTED → disconnected`,
  anything else `unknown` (design §9.3), written through `DeviceConnectivityService` so its state store agrees.
- `microphone.volume` is **read-only** in the spec (`channels.yaml`, `data_types` variant `percentage`) although design
  §10.1 says rw; the spec wins and UP-9 needs a spec change to write it. `microphone.active`, `indicator.on`, `light.on`
  and `light.brightness` are `rw` per the spec; writes fail with "no platform" until UP-9 registers one
  (`platform.registry.service.ts:66-75`).
**Recommendation: as listed.** *Cost if wrong:* YAML edits and a golden update.

**P10. API shape and scope.**
- Request bodies use the plugin's own `{ data: … }` wrapper (`dto/protect-discovery-probe.dto.ts`), not Homey's bare
  bodies. Preview and adopt items carry `device_id` **and** `model_key` (`camera | sensor | light`), so revalidation is one
  by-id `GET` instead of three list calls; `GET devices/{id}` resolves the model itself.
- No `device_category` override (Homey has one): the category is fixed by the YAML and P2/P5.
- No user override files (`var/data/plugin.devices-unifi-protect.*.yaml`); built-in definitions only.
- All five routes are owner/admin only (Homey lets a user list devices; here listing spends the console's rate budget).
  Batch size 1–50 (≈ 25 s worst case at the pacer's 8 requests/s).
- Scope is UP-7 only, in 8 tasks. Realtime state (UP-8), the control platform (UP-9) and the stream provider that keeps
  `camera.status`/`camera.source` current (UP-10) are later plans.
**Recommendation: as listed.** *Cost if wrong:* a category override or user overrides are additive later.

---

## Global Constraints

- Branch `feat/unifi-protect-adoption`, cut from `main`. One PR titled exactly
  `feat(backend): map and adopt UniFi Protect cameras, doorbells, sensors and floodlights`, body ending with
  `Closes #1183`. Never push to `main`; the final task writes the PR body to a file and does not push.
- Commits `<type>(<scope>): <lowercase imperative subject>`, header ≤ 100 characters, scope `backend` for
  `apps/backend/**`, `tasks` for `tasks/**`; each ends with `Co-Authored-By: <model that wrote it> <noreply@anthropic.com>`.
  The PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- TypeScript: tabs, single quotes, semicolons, trailing commas, print width 120; imports external, then `../`, then `./`,
  blank line between groups. Wire names snake_case via `@Expose({ name })`, properties camelCase.
- Never use the `generic` device category; the loader rejects it (Task 2).
- Never edit generated files (`spec/api/v1/openapi.json`, `apps/admin/src/openapi.ts`, `apps/backend/src/spec`,
  `apps/panel/lib/api`, `apps/panel/lib/spec`); they are git-ignored (roadmap A11, verified with `git check-ignore`).
  Regenerate locally only. `apps/admin/src/openapi.constants.ts` is untouched (admin aliases come with UP-12).
- No migration: existing columns (migration `1000000000060-AddUnifiProtectIdentity.ts`) and unique indexes suffice (P7).
- Backend API conventions (CLAUDE.md): `@ApiTags(DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_NAME)`, `@ApiOperation` with `tags`,
  `summary`, `description`, `operationId`; Swagger decorators before NestJS decorators; `*ResponseModel extends
  BaseSuccessResponseModel<T>`; schema names `DevicesUnifiProtectPlugin{Data|Res|Req}…`; new models appended to
  `DEVICES_UNIFI_PROTECT_PLUGIN_SWAGGER_EXTRA_MODELS`.
- Identity: device `identifier = <nvrMacKey>:<protectDeviceId>`, where `nvrMacKey` is the NVR MAC as 12 lowercase hex
  digits without separators (`nvrs.json` `0CEA14003A69` → `0cea14003a69`); `protectNvrId` = NVR `id`,
  `protectDeviceId` = device `id`, `protectModelKey` = `camera | sensor | light`. Channel identifiers are stable mapping
  identifiers (`device_information`, `camera.main`, `camera.package`, `doorbell`, `motion`, `object_detection.<key>`,
  `sound_detection.<key>`, `smoke`, `carbon_monoxide`, `indicator`, `microphone`, `contact`, `leak`, `temperature`,
  `humidity`, `illuminance`, `battery`, `light`). Property identifiers are the spec keys, except the device information
  status, which is `connection_state` (the identifier `DeviceConnectivityService` creates,
  `device-connectivity.service.ts:164-216`). `protectMappingName` = the property mapping's `name`.
- `camera.source` = `unifi-protect:<protectDeviceId>:main` / `:package` (roadmap §4) — an identifier, never a URL.
- Client writes: the only write added is `POST cameras/{id}/rtsps-stream` (P6). No `DELETE`, no `PATCH`, never
  `disable-mic-permanently` (`client/protect-endpoints.ts` already refuses it). All calls go through the client's rate
  pacer (one per client; `client/protect-rate-pacer.ts`).
- Secret rule (roadmap §4, design §4.3/§9.4): the API key and every RTSPS URL or alias never reach a log line, an error,
  a response, a property value, an event, a database row or a preview. Stream URLs are converted to availability booleans
  (`toStreamAvailability`, Task 3) in the same statement that receives them. Sentinels: key
  `PROTECT_SENTINEL_KEY_7f3a9c0d1e2b4a6f`, aliases starting `SENTINELALIAS` (`test/support/fake-protect-server.ts`).
- Tests use the fixtures in `apps/backend/src/plugins/devices-unifi-protect/__fixtures__/` and
  `test/support/fake-protect-server.ts` only; no real console.
- Roles: every route `@Roles(UserRole.OWNER, UserRole.ADMIN)` (P10).
- Setup once per worktree: `pnpm run bootstrap` (installs and generates `apps/backend/src/spec`, which
  `modules/devices/utils/schema.utils.ts` imports). Single test files run with
  `pnpm --filter ./apps/backend exec jest <path>`; e2e with `--config ./test/jest-e2e.json`.

### Verified facts (on `main` `14fbe76f3`)

| # | Fact | Where |
|---|---|---|
| F1 | `ProtectConnectorService.getClient(): ProtectApiClient \| null` (connected only); at connect it calls `client.getNvr()` and keeps `nvr.id`, `nvr.name`, not `nvr.mac`. | `services/protect-connector.service.ts:174, 261-272` |
| F2 | Client methods: `getMetaInfo`, `getNvr`, `listCameras`, `getCamera(id)`, `listSensors`, `listLights`, `getRtspsStreams(id)`, `getSnapshot(id, …)`. No by-id sensor/light read. Each type keeps the console object in `raw`; `ProtectCamera.featureFlags` drops `hasLcdScreen` (read it from `raw`). | `client/protect-api.client.ts`, `client/protect-api.types.ts` |
| F3 | Transport request `method: 'GET'` only, no body; client logs `GET <endpoint> <status> <ms>`; retries `408/429/500/502/503/504` (snapshot `408/429`); `ECONNRESET` on attempt 1 retried once. | `client/protect-http.transport.ts:8-16`, `client/protect-api.client.ts` |
| F4 | `PROTECT_ENDPOINTS` lists `meta/info, nvrs, cameras, cameras/{id}, cameras/{id}/rtsps-stream, cameras/{id}/snapshot, sensors, lights`; ids must match `PROTECT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/`. | `devices-unifi-protect.constants.ts`, `client/protect-endpoints.ts:4` |
| F5 | The fake console serves `cameras.json` only (no doorbells), no `sensors/{id}`/`lights/{id}`, answers every non-GET with 405 unless `enqueue`d, and records non-GET requests in `writes`. `enqueue(match, response)` matches by path only. | `test/support/fake-protect-server.ts` |
| F6 | `ProtectDeviceEntity` (`protectNvrId`, `protectDeviceId`, `protectModelKey`), `ProtectChannelPropertyEntity.protectMappingName`; partial unique index `UQ_unifi_protect_device_identity (protectNvrId, protectDeviceId)`. Create DTOs accept those fields. | `entities/devices-unifi-protect.entity.ts`, `dto/create-*.dto.ts`, migration 060 |
| F7 | Device type mapping `requiresCreationContext: true`; `DevicesService.create(dto, creation?)` refuses without a context; with one, nested channels are created through `channelsService.create(nested, creation)` in the same transaction. `DeviceCreationContext.run(writer, allowedType, operation, afterCommit)`. | `devices-unifi-protect.plugin.ts:136`, `devices.service.ts:590-790`, `device-creation-context.ts:274` |
| F8 | Uniqueness: device `(identifier, type)`; channel `(identifier, device)` and `(name, device)`; property `(identifier, channel)` and `(name, channel)`. | `modules/devices/entities/devices.entity.ts:62, 246, 276, 410, 438` |
| F9 | `DeviceValidationService.validateDeviceStructure({ category, channels })` returns `{ isValid, issues }`; missing required property = ERROR, unknown channel and missing permission = WARNING. Constructible as `new DeviceValidationService({} as never)`. | `device-validation.service.ts:240, 398, 584, 729`; `devices-modbus/templates/definitions/builtin-templates.spec.ts:30` |
| F10 | Spec helpers `getPropertyMetadata(channel, property)` (data type, permissions, unit, format, step, `dataTypeVariants`), `getRequiredProperties`, `getRequiredChannels`, `isChannelAllowed`, `isChannelMultiple`. | `modules/devices/utils/schema.utils.ts:141, 171, 491, 534, 556` |
| F11 | Spec: `camera` requires `camera` (multiple) + `device_information`; `doorbell` requires `doorbell` + `device_information`, allows `camera` (multiple); both allow `object_detection`/`sound_detection` (multiple), `smoke`, `carbon_monoxide`, `indicator`, `microphone`, `motion`. `sensor` requires `device_information` only. `lighting` requires `light` + `device_information` and allows neither `motion` nor `indicator` (P2). `leak.level` required; `microphone.volume` ro; `object_type`/`sound_type` enums include every Protect type of P3 except unknown ones. | `spec/devices/devices.yaml`, `spec/devices/channels.yaml` |
| F12 | `DeviceConnectivityService.trySetConnectionState(deviceId, { state })` finds the `device_information` channel by category and its `status` property by category, creating `device_information`/`connection_state` when missing. | `device-connectivity.service.ts:48-216` |
| F13 | Strict value writes: `ChannelsPropertiesService.update(id, { type, value }, { strictValuePersistence, comparePersistedValue, expectedPersistedState, beforeValuePersistence })`; `PropertyValueService.readLatestPersisted(property)`. | `channels.properties.service.ts:128-132, 986`; `property-value.service.ts:929` |
| F14 | `__fixtures__/fixtures.spec.ts` requires the directory listing to equal a fixed list and every file to be documented in `README.md`; `sensors.json` holds six state variants of **one** sensor id; `lights.json` `camera` references `cameras.json[0]`. | `__fixtures__/fixtures.spec.ts:58-75`, fixtures |
| F15 | Homey mapping assets are copied by `nest-cli.json` entries; Protect has none yet. | `apps/backend/nest-cli.json:49-55` |
| F16 | The panel picks the camera channel whose identifier is `main` or ends with `.main`. | `apps/panel/lib/modules/devices/views/devices/mixins.dart:140` |
| F17 | `DevicesModule` exports every service used here (`DevicesService`, `ChannelsService`, `ChannelsPropertiesService`, `PropertyValueService`, `DeviceConnectivityService`, `DeviceStructureLockService`, `DeviceValidationService`). | `modules/devices/devices.module.ts` `exports` |

## Review Focus

Failure modes the spec implies but no acceptance criterion exercises, most likely first; each is pinned by a named test
in the task at the end of the line.

1. **Another integration already streams from the camera** (Home Assistant enabled `high`; the spike console has only
   `high`): adopting with the default `medium` must keep `high` enabled — the POST body is the union, and a camera whose
   wanted qualities are already on gets no POST. → Task 7 `posts the union of enabled and requested qualities`, e2e
   Task 8.
2. **An UP-Sense with a stale event timestamp** (`leakDetectedAt` from last month): adoption must not raise a critical
   leak or smoke alert. → Task 3 golden `sensor-leak` and `does not derive detections from event timestamps`.
3. **Re-adoption after Protect's capabilities changed, or after the user renamed the device in Smart Panel**: no
   duplicate device, the user's name kept, a removed detection pruned, an added one created, untouched properties keep
   their ids (and history). → Task 6 `adds a new detection channel and prunes one Protect no longer reports`, `keeps the
   Smart Panel name on re-adoption unless a name is given`.
4. **The console disconnects or the plugin is reconfigured mid-batch**: earlier items keep their results, later ones
   report `unavailable`, an item whose persistence did not finish leaves no partial device and causes no POST. → Task 6
   `fails closed before any mutation when the fresh read fails`, Task 7 `skips stream work … when persistence failed`.
5. **Console data the mapping does not know** (an unknown smart-detect or audio type, a list that repeats an id like
   `sensors.json`, a non-numeric `micVolume`, an unknown `state`): no invalid enum value, no duplicate channel, no throw;
   a warning or a `null` value instead. → Task 3 `skips an unknown detection type with a warning`, `nulls a value whose
   type does not match`; Task 4 `keeps the first entry when the console lists an id twice`.

---

## File structure

All paths under `apps/backend/src/plugins/devices-unifi-protect/` unless stated.

| Path | Responsibility | Task |
|---|---|---|
| `devices-unifi-protect.constants.ts` (modify) | `sensors/{id}`, `lights/{id}` endpoints; `PROTECT_RTSPS_QUALITIES` | 1 |
| `client/protect-http.transport.ts`, `client/protect-api.client.ts` (modify) | POST with a JSON body; `getSensor`, `getLight`, `createRtspsStreams` | 1 |
| `apps/backend/test/support/fake-protect-server.ts` (modify) | doorbell fixtures, by-id sensor/light, stateful streams, POST | 1 |
| `mappings/mapping.types.ts`, `mappings/mapping.constants.ts`, `mappings/protect-mapping.error.ts` (new) | YAML grammar types, resolved types, error | 2 |
| `mappings/schema/mapping-schema.json` (new) | strict JSON schema of the three files | 2 |
| `mappings/mapping-loader.service.ts` (new) | load, schema-validate, spec-validate, resolve | 2 |
| `mappings/definitions/{devices,channels,properties}.yaml` (new) | built-in mappings | 3 |
| `mappings/mapping-evaluator.ts` (new) | pure evaluation, `toNvrMacKey`, `toStreamAvailability` | 3 |
| `__fixtures__/expected/*.json` (new), `__fixtures__/fixtures.spec.ts`, `__fixtures__/README.md` (modify) | golden trees | 3 |
| `apps/backend/nest-cli.json` (modify) | copy mapping assets | 3 |
| `services/protect-connector.service.ts` (modify) | `getConsoleIdentity()` | 4 |
| `errors/protect-adoption.error.ts` (new) | unavailable / not found / unsupported errors | 4 |
| `services/protect-inventory.service.ts`, `models/protect-inventory.model.ts`, `controllers/protect-devices.controller.ts` (new) | inventory and `GET devices`, `GET devices/{id}` | 4 |
| `services/protect-mapping-preview.service.ts`, `dto/protect-mapping-preview.dto.ts`, `models/protect-mapping-preview.model.ts` (new) | revalidation, warnings, `POST mapping-preview` | 5 |
| `controllers/protect-adoption.controller.ts` (new) | `POST mapping-preview`, `POST adopt`, `POST adopt/batch` | 5, 6 |
| `services/protect-adoption-lock.service.ts`, `services/protect-adoption.service.ts`, `dto/protect-adoption.dto.ts`, `models/protect-adoption.model.ts` (new) | adoption | 6 |
| `services/protect-adoption-streams.service.ts` (new) | RTSPS enablement | 7 |
| `devices-unifi-protect.plugin.ts`, `devices-unifi-protect.openapi.ts` (modify) | providers, controllers, swagger models, readme | 3–8 |
| `apps/backend/test/devices-unifi-protect-adoption.e2e-spec.ts` (new) | preview → adopt against the fake console | 8 |
| `tasks/epics/EPIC-UNIFI-PROTECT.md:102` (modify) | `UP-7 (done)` | 8 |

Specs sit next to their source (`*.spec.ts`). Each task ends green and committed.

---

### Task 1: Client and fake console — RTSPS stream creation and single sensor and light reads

**Files:**
- Modify: `devices-unifi-protect.constants.ts`, `client/protect-http.transport.ts`, `client/protect-api.client.ts`,
  `apps/backend/test/support/fake-protect-server.ts`
- Test: `client/protect-api.client.spec.ts`, `client/protect-http.transport.spec.ts`,
  `client/protect-api.client.integration.spec.ts`

**Interfaces:**
- Consumes: F2–F5.
- Produces:
  ```ts
  // devices-unifi-protect.constants.ts (append to PROTECT_ENDPOINTS: 'sensors/{id}', 'lights/{id}')
  export const PROTECT_RTSPS_QUALITIES = ['high', 'medium', 'low', 'package'] as const;
  export type ProtectRtspsQuality = (typeof PROTECT_RTSPS_QUALITIES)[number];
  // client/protect-http.transport.ts
  export interface ProtectTransportRequest { method: 'GET' | 'POST'; path; headers; timeoutMs; maxBytes; signal?; body?: Buffer }
  // NodeProtectTransport: when body is set, sends it with Content-Type: application/json and Content-Length
  // client/protect-api.client.ts
  getSensor(sensorId: string, options?: ProtectCallOptions): Promise<ProtectSensor>;
  getLight(lightId: string, options?: ProtectCallOptions): Promise<ProtectLight>;
  /** The client's only write. SECRET result: the URLs carry bearer aliases. */
  createRtspsStreams(cameraId: string, qualities: readonly ProtectRtspsQuality[], options?: ProtectCallOptions): Promise<ProtectRtspsStreams>;
  // test/support/fake-protect-server.ts
  interface FakeProtectServerOptions { …; cameraFixtures: string[] }          // default ['cameras.json']
  readonly streamPosts: { cameraId: string; qualities: string[] }[];           // cleared by reset()
  setStreams(cameraId: string, qualities: ProtectRtspsQuality[]): void;
  enqueue(match: RegExp, response: FakeProtectResponse, method?: string): void; // method undefined = any
  export const fakeProtectStreamAlias: (quality: ProtectRtspsQuality) => string; // 'high' -> FAKE_PROTECT_ALIAS, else `SENTINELALIAS${quality}0123456789`
  ```
- Client rules (decided): `createRtspsStreams` validates before any request — non-empty, unique, every entry in
  `PROTECT_RTSPS_QUALITIES` — else `ProtectApiError(VALIDATION, 'cameras/{id}/rtsps-stream')`; body
  `{"qualities":[…]}` in the given order; `Accept: application/json`; retry statuses `[429]` only; the attempt-1
  `ECONNRESET` retry is kept (the union body of P6 is idempotent); the response is parsed like `getRtspsStreams`. The
  debug log line becomes `${method} ${endpoint} ${status} ${ms}ms`. `getSensor`/`getLight` use `parseSensor`/`parseLight`.
- Fake console rules (decided): the camera list and `cameras/{id}` use the union of `cameraFixtures`; `sensors/{id}` and
  `lights/{id}` return the first entry with that id (404 otherwise). Stream state per camera: cameras from `cameras.json`
  start with `['high']`, all others with none; `reset()` restores that. `GET rtsps-stream` returns every quality with
  `rtsps://127.0.0.1:7441/<fakeProtectStreamAlias(q)>?enableSrtp` or `null`. `POST rtsps-stream` with a JSON body
  `{ qualities }` (non-empty, unique, known values; else `400 {"error":"Invalid qualities","name":"BAD_REQUEST"}`) adds
  the qualities to the camera's set, records `streamPosts`, and answers `200` with the full map (the handler collects
  the request body for a POST instead of the current `req.resume()`, capped at 4 KiB). Other non-GET requests keep
  answering 405. `enqueue` with a `method` only matches requests of that method.

- [ ] **Step 1: Bootstrap the worktree**

Run: `pnpm run bootstrap`
Expected: exit 0 and `apps/backend/src/spec/` exists.

- [ ] **Step 2: Write the failing client unit tests** (`protect-api.client.spec.ts`, existing `FakeTransport`)

```ts
// replaces 'builds the paths of all eight read-only methods and never a write or the forbidden endpoint'
it('builds the paths of all ten read methods as GET and never the forbidden endpoint', ...); // adds ['getSensor', () => client.getSensor('6541'), `${BASE}/sensors/6541`], ['getLight', …, `${BASE}/lights/6541`]; every method 'GET'
it('createRtspsStreams posts the qualities as JSON to the stream endpoint', ...);
// transport.queue(200, JSON.stringify(json('rtsps-stream-post.json').response)); request.method 'POST', path `${BASE}/cameras/6541/rtsps-stream`,
// JSON.parse(request.body.toString()) toEqual { qualities: ['high', 'medium'] }, headers['X-API-KEY'] KEY, result toEqual fixture response
it.each([[[]], [['high', 'high']], [['ultra']]])('createRtspsStreams refuses %j without a request', ...); // category 'validation', transport.requests.length 0
it('createRtspsStreams retries a 429 but not a 500 or a 503', ...); // 429 (retry-after 0) then 200 -> 2 requests; 500 -> 'unavailable' after 1; 503 -> 1
it('createRtspsStreams maps 400 to bad_request and 409 to protocol', ...);
it('getSensor and getLight parse the console object like the lists', ...); // sensors.json[0] -> id '5f0000000000000000000b01', raw._state starts 'idle'; lights.json[0] -> cameraId '600cefafd5f365d6f83c4ef3'
// extend 'never puts the key or a stream alias into errors or log lines' with a POST whose response carries ALIAS and a POST that fails 500
it('logs the method with the endpoint template', ...); // a POST logs 'POST cameras/{id}/rtsps-stream 200'
```

Transport (`protect-http.transport.spec.ts`, in the style of its existing tests): `it('sends a POST body with
content-type and content-length')` — the test server records `method`, `content-type` `application/json`,
`content-length` equal to the body length and the received body.

- [ ] **Step 3: Write the failing integration tests** (`protect-api.client.integration.spec.ts`)

```ts
it('creates a stream on the fake console and reads it back', ...);
// fake.setStreams(id0, []); createRtspsStreams(id0, ['high','medium']) -> high and medium contain 'SENTINELALIAS', low/package null;
// getRtspsStreams(id0) equal; fake.streamPosts toEqual [{ cameraId: id0, qualities: ['high','medium'] }]; fake.writes.length 1
it('keeps already enabled qualities when another quality is added', ...); // default ['high']; POST ['medium'] -> high still non-null
it('serves doorbells and single sensors and lights when configured', ...);
// FakeProtectServer.start({ cameraFixtures: ['cameras.json','cameras-doorbell.json'] }): listCameras length 4;
// getCamera('5f0000000000000000000a02').hasPackageCamera true; getSensor('5f0000000000000000000b01').raw._state 'idle (closed, no motion, no leak, no tamper)';
// getLight('5f0000000000000000000c01').cameraId '600cefafd5f365d6f83c4ef3'; doorbells start with no stream
```

- [ ] **Step 4: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/client`
Expected: FAIL (`client.getSensor is not a function`, `createRtspsStreams` missing).

- [ ] **Step 5: Implement** the constants, the transport `method`/`body`, the three client methods (one `execute`
  that takes `method` and `body`; `getJson` stays GET), and the fake console rules above.

- [ ] **Step 6: Run to verify pass**

Run: the Step 4 command, then `pnpm --filter ./apps/backend exec jest --config ./test/jest-e2e.json test/devices-unifi-protect.e2e-spec.ts test/devices-unifi-protect-discovery.e2e-spec.ts`
Expected: PASS; the existing UP-5 e2e still reports `writesSeen` 0 (its defaults are unchanged).

- [ ] **Step 7: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect test/support/fake-protect-server.ts
git add apps/backend/src/plugins/devices-unifi-protect apps/backend/test/support/fake-protect-server.ts
git commit -m "feat(backend): add RTSPS stream creation and sensor and light reads to the Protect client"
```

---

### Task 2: Mapping grammar, JSON schema and loader

**Files:**
- Create: `mappings/mapping.types.ts`, `mappings/mapping.constants.ts`, `mappings/protect-mapping.error.ts`,
  `mappings/schema/mapping-schema.json`, `mappings/mapping-loader.service.ts`
- Test: `mappings/mapping-loader.service.spec.ts` (definitions written to `mkdtempSync` directories)

**Interfaces:**
- Consumes: F10 spec helpers; `DeviceCategory`, `ChannelCategory`, `PropertyCategory`, `DataTypeType`, `PermissionType`
  from `modules/devices/devices.constants`.
- Produces:
  ```ts
  // mapping.types.ts
  export const PROTECT_MODEL_KEYS = ['camera', 'sensor', 'light'] as const;
  export type ProtectModelKey = (typeof PROTECT_MODEL_KEYS)[number];
  export type ProtectMappingScalar = string | number | boolean | null;
  export type ProtectCondition =
  	| { path: string; equals: ProtectMappingScalar } | { path: string; in: ProtectMappingScalar[] }
  	| { path: string; contains: string }      // array of strings contains the value
  	| { path: string; matches: string }       // case-insensitive regular expression over a string
  	| { path: string; exists: true }          // value is neither undefined nor null
  	| { any: ProtectCondition[] };
  export type ProtectTransform =
  	| { type: 'map'; table: Record<string, ProtectMappingScalar>; default?: ProtectMappingScalar } // key = String(value)
  	| { type: 'thresholds'; thresholds: { minimum: number; value: ProtectMappingScalar }[]; default: ProtectMappingScalar }
  	| { type: 'scale'; input_range: [number, number]; output_range: [number, number]; round?: boolean }
  	| { type: 'round'; precision?: number };
  export type ProtectValueSource =
  	| { constant: ProtectMappingScalar } | { template: string }   // placeholders {id}, {key}
  	| { path: string; default?: ProtectMappingScalar; transform?: ProtectTransform }
  	| { stream_status: 'main' | 'package' };
  export interface ResolvedProtectDeviceMapping { name: string; priority: number; modelKey: ProtectModelKey; when: ProtectCondition[]; category: DeviceCategory }
  export interface ResolvedProtectChannelMapping {
  	name: string; devices: string[]; when: ProtectCondition[];
  	forEach: { path: string; values: Record<string, { key: string; name: string }>; ignore: string[] } | null;
  	identifier: string; category: ChannelCategory; channelName: string;      // identifier may hold {key}, channelName {name}
  }
  export interface ResolvedProtectPropertyMapping {
  	name: string; channel: string; devices: string[] | null; identifier: string; category: PropertyCategory; displayName: string;
  	dataType: DataTypeType; permissions: PermissionType[]; unit: string | null; format: (string | number)[] | null; step: number | null;
  	value: ProtectValueSource | null;                                       // null = the property gets no initial value
  }
  export interface ProtectResolvedMappings {
  	devices: readonly ResolvedProtectDeviceMapping[];   // priority desc, then name asc
  	channels: readonly ResolvedProtectChannelMapping[]; // file order
  	properties: readonly ResolvedProtectPropertyMapping[]; // file order
  }
  // mapping.constants.ts
  export const PROTECT_MAPPING_SCHEMA_VERSION = 1;
  export const PROTECT_MAPPING_FILE_NAMES = { devices: 'devices.yaml', channels: 'channels.yaml', properties: 'properties.yaml' } as const;
  export const PROTECT_MAPPING_LOADER_OPTIONS = Symbol('PROTECT_MAPPING_LOADER_OPTIONS');
  // protect-mapping.error.ts
  export class ProtectMappingConfigurationError extends Error { constructor(readonly file: string, readonly errors: readonly string[]) }
  // mapping-loader.service.ts
  export interface ProtectMappingLoaderOptions { definitionsPath?: string; schemaPath?: string } // defaults join(__dirname, 'definitions' | 'schema/mapping-schema.json')
  @Injectable() export class ProtectMappingLoaderService implements OnModuleInit {
  	constructor(@Optional() @Inject(PROTECT_MAPPING_LOADER_OPTIONS) options?: ProtectMappingLoaderOptions);
  	onModuleInit(): void;                    // getMappings(); an invalid built-in file stops the plugin from starting
  	load(): ProtectResolvedMappings;         // reads and validates all three files; throws ProtectMappingConfigurationError
  	getMappings(): ProtectResolvedMappings;  // load() once, then the cached result
  }
  ```
- File grammar (each file `{ version: 1, kind: devices | channels | properties, mappings: [...] }`, `additionalProperties:
  false` everywhere, names `^[a-z][a-z0-9_]*$`):
  - device: `{ name, priority?: integer (default 0), match: { model_key, when?: Condition[] }, device: { category } }`
  - channel: `{ name, devices: [device mapping name, …], when?, for_each?: { path, values: { <protect value>: { key, name } },
    ignore?: [string] }, channel: { identifier, category, name } }`
  - property: `{ name, channel: <channel mapping name>, devices?: [device mapping name], property: { identifier, category,
    name?, variant? }, value?: ValueSource }`. Attributes come from `getPropertyMetadata(channelCategory, category)`; with
    `variant` the matching `dataTypeVariants` entry supplies data type, unit, format and step. `displayName` defaults to
    the identifier in sentence case (`serial_number` → `Serial number`).
- Semantic rules (in this order; every message names the file and the mapping):
  1. schema (Ajv `allErrors`, `strict: false`); 2. `version` 1 and `kind` equal to the file's kind; 3. unique names per
  file (`duplicate mapping name`); 4. device category in `DeviceCategory` and not `generic` (`generic category is not
  allowed`); 5. channel `devices` exist; channel category allowed on each of their device categories (`not allowed on`);
  identifier `^[a-z][a-z0-9_]*(\.[a-z0-9_]+|\.\{key\})?$`, `{key}` present if and only if `for_each` is set; `for_each`
  keys `^[a-z][a-z0-9_]*$`; 6. a category used by two channel mappings of one device, or by a `for_each` mapping, must be
  `multiple` on that device (`must be multiple`); 7. property `channel` exists; `devices` ⊆ that channel's devices;
  metadata exists (`not defined by the spec`); `variant` exists, and is required when the spec offers variants;
  identifiers unique per channel and device; 8. enum properties: every constant, map/threshold value and default in the
  format (`not in the spec format`); a `{key}` template needs every `for_each` key in the format; 9. every channel mapping
  covers `getRequiredProperties(category)` for each of its devices (`missing required property`); 10. each device mapping
  has unconditional (no `when`, no `for_each`) channel mappings covering `getRequiredChannels(category)` (`missing required
  channel`); 11. `matches` compiles with flag `i`; thresholds strictly descending (`thresholds must be descending`); scale
  ranges non-degenerate; `stream_status` only on category `status` of a `camera` channel; template placeholders only `{id}`
  and `{key}` (`unknown placeholder`); paths are dot-separated `^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$` with no `__proto__`,
  `prototype` or `constructor` segment.

- [ ] **Step 1: Write the failing loader tests** (`writeDefinitions(dir, { devices, channels, properties })` helper; the
  minimal valid set is one device mapping `sensor` (`model_key: sensor`, category `sensor`), channels `device_information`
  and `temperature` (`when: [{ path: temperatureSettings.isEnabled, equals: true }]`), and properties `manufacturer`,
  `model`, `serial_number`, `temperature`)

```ts
it('loads a minimal valid set and takes property attributes from the spec', ...); // temperature: dataType 'float', permissions ['ro'], unit '°C', format [0, 100]; displayName 'Temperature'
it('selects a data type variant', ...);            // battery percentage variant 'percentage' -> dataType 'uchar', unit '%', format [0, 100]
it('orders device mappings by priority, then name', ...);
it('returns the same resolved object from repeated getMappings calls', ...);
it.each([
	['an unknown key', 'must NOT have additional properties'], ['a kind that does not match the file', 'kind'],
	['a duplicate name', 'duplicate mapping name'], ['the generic category', 'generic category is not allowed'],
	['a channel the device spec does not allow', 'not allowed on'], ['a property the channel spec lacks', 'not defined by the spec'],
	['an enum constant outside the format', 'not in the spec format'], ['a for_each key outside the enum', 'not in the spec format'],
	['a channel without a required property', 'missing required property'], ['a device without a required channel', 'missing required channel'],
	['a template with {mac}', 'unknown placeholder'], ['ascending thresholds', 'thresholds must be descending'],
	['two motion channels on one device', 'must be multiple'], ['a __proto__ path segment', 'path'],
	['a missing variant on a multi-type property', 'variant'],
])('rejects %s', (_case, message) => expect(() => loader.load()).toThrow(expect.objectContaining({ errors: expect.arrayContaining([expect.stringContaining(message)]) })));
it('names the failing file in the error', ...);    // error.file ends with 'channels.yaml'
it('fails module initialization for an invalid built-in file', ...); // onModuleInit throws ProtectMappingConfigurationError
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/mappings/mapping-loader.service.spec.ts`
Expected: FAIL, "Cannot find module './mapping-loader.service'".

- [ ] **Step 3: Implement** the types, constants, error, schema (draft-07, `oneOf` of the three file shapes as
  `devices-homey/mappings/schema/mapping-schema.json` does) and the loader (`readFileSync` + `yaml` `parse` +
  `new Ajv({ allErrors: true, strict: false })`, as `devices-homey/mappings/mapping-loader.service.ts:1-100`). No user
  override files (P10).

- [ ] **Step 4: Run to verify pass.** Command of Step 2. Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect/mappings
git add apps/backend/src/plugins/devices-unifi-protect/mappings
git commit -m "feat(backend): load and validate UniFi Protect mapping definitions"
```

---

### Task 3: Built-in definitions, evaluator and golden fixtures

**Files:**
- Create: `mappings/definitions/devices.yaml`, `mappings/definitions/channels.yaml`,
  `mappings/definitions/properties.yaml`, `mappings/mapping-evaluator.ts`,
  `__fixtures__/expected/{camera,doorbell,doorbell-package,sensor,sensor-leak,floodlight}.json`
- Modify: `__fixtures__/fixtures.spec.ts` (accept the `expected` directory; run the sanitization checks over each
  `expected/*.json`), `__fixtures__/README.md` (a row for `expected/`), `apps/backend/nest-cli.json` (two asset entries),
  `devices-unifi-protect.plugin.ts` (provider `ProtectMappingLoaderService`)
- Test: `mappings/mapping-evaluator.spec.ts`, `mappings/protect-mappings.spec.ts`

**Interfaces:**
- Consumes: Task 2 loader and types; `ProtectRtspsStreams` (F2); `PROTECT_ID_PATTERN` (F4); `normalizeMacString`
  (`services/protect-discovery-text.ts:25`).
- Produces (`mappings/mapping-evaluator.ts`):
  ```ts
  export interface ProtectStreamAvailability { high: boolean; medium: boolean; low: boolean; package: boolean }
  export interface ProtectMappingInput {
  	nvr: { id: string; macKey: string };
  	modelKey: string;
  	device: Readonly<Record<string, unknown>>;        // the console object (`raw`)
  	streams: ProtectStreamAvailability | null;         // null: not read, read failed, or not a camera
  }
  export interface ProtectMappedProperty {
  	identifier: string; category: PropertyCategory; name: string; dataType: DataTypeType; permissions: PermissionType[];
  	unit: string | null; format: (string | number)[] | null; step: number | null; value: ProtectMappingScalar; mappingName: string;
  }
  export interface ProtectMappedChannel { identifier: string; category: ChannelCategory; name: string; mappingName: string; properties: ProtectMappedProperty[] }
  export interface ProtectMappedDevice {
  	mappingName: string; category: DeviceCategory; identifier: string; name: string;
  	protectNvrId: string; protectDeviceId: string; protectModelKey: ProtectModelKey; channels: ProtectMappedChannel[];
  }
  export enum ProtectMappingWarningCode { UNSUPPORTED_DETECTION_TYPE = 'unsupported_detection_type' }
  export interface ProtectMappingWarning { code: ProtectMappingWarningCode; identifier: string | null } // the Protect value if it matches ^[A-Za-z0-9_]{1,64}$, else null
  export type ProtectMappingResult =
  	| { ok: true; device: ProtectMappedDevice; warnings: ProtectMappingWarning[] }
  	| { ok: false; reason: 'unsupported_model' | 'invalid_device' };
  export const toNvrMacKey = (mac: string | null): string | null;          // normalizeMacString(mac)?.replace(/:/g, '') ?? null
  export const toStreamAvailability = (streams: ProtectRtspsStreams): ProtectStreamAvailability; // non-null -> true; URLs dropped
  export const evaluateProtectMapping = (mappings: ProtectResolvedMappings, input: ProtectMappingInput): ProtectMappingResult; // never throws
  export const toValidationInput = (device: ProtectMappedDevice): DeviceDataInput; // for DeviceValidationService.validateDeviceStructure
  ```
- Evaluation (not determined by the signatures): `invalid_device` when `device.id` is not a string matching
  `PROTECT_ID_PATTERN`; `unsupported_model` when no device mapping matches. Paths walk plain objects only (arrays are
  leaves). The device mapping is the first in resolved order whose `modelKey` equals `input.modelKey` and whose `when`
  all hold. Channel mappings are taken in file order when they list the device mapping and their `when` holds; a
  `for_each` reads its path (not an array → no channel), and for each distinct string in array order creates a channel
  (`{key}`, `{name}` substituted), skips `ignore` entries silently and adds a warning for any other value. Properties are
  the property mappings of that channel mapping whose `devices` is null or lists the device mapping, in file order. Values:
  `constant`; `template` with `{id}` = device id and `{key}`; `path` (undefined or null → `default ?? null`, otherwise the
  transform); `stream_status` (below). Map keys compare `String(value)`; thresholds take the first `value >= minimum`;
  scale is linear and rounds to an integer when `round`; `round` uses `precision` (default 0). A result whose type does
  not fit the data type (`bool` → boolean; `enum`/`string` → string; numeric → finite number) becomes `null`. Device
  name: `device.name` trimmed, ≤ 255 characters and free of control characters, else `UniFi Protect <modelKey> <id>`.
  `stream_status`: `state` `CONNECTING` → `initializing`, `DISCONNECTED` → `offline`, `CONNECTED` → `available` when
  (`main`: `high || medium || low`; `package`: `package`) is true in `streams`, else `unavailable`; any other state →
  `unavailable`.

- [ ] **Step 1: Write the definitions** — exactly the following content (the file headers are
  `version: 1` and the matching `kind`; quoted keys keep YAML from reading `on`/`true` as booleans).

`devices.yaml` mappings:

| name | priority | match | category |
|---|---|---|---|
| `doorbell` | 10 | `model_key: camera`, `when: [{ any: [{ path: featureFlags.hasLcdScreen, equals: true }, { path: type, matches: doorbell }] }]` | `doorbell` |
| `camera` | 0 | `model_key: camera` | `camera` |
| `sensor` | 0 | `model_key: sensor` | `sensor` |
| `floodlight` | 0 | `model_key: light` | `lighting` |

`channels.yaml` mappings, in this order (`identifier` / `category` / `name`):

| name | devices | when / for_each | channel |
|---|---|---|---|
| `device_information` | camera, doorbell, sensor, floodlight | — | `device_information` / `device_information` / `Device information` |
| `camera_main` | camera, doorbell | — | `camera.main` / `camera` / `Camera` |
| `camera_package` | camera, doorbell | `hasPackageCamera` equals `true` | `camera.package` / `camera` / `Package camera` |
| `doorbell` | doorbell | — | `doorbell` / `doorbell` / `Doorbell` |
| `camera_motion` | camera, doorbell | — | `motion` / `motion` / `Motion` |
| `object_detection` | camera, doorbell | for_each `featureFlags.smartDetectTypes`: `person→person`, `vehicle→vehicle`, `animal→animal`, `package→package`, `licensePlate→license_plate`, `face→face`; names `<Label> detection` (`License plate detection`) | `object_detection.{key}` / `object_detection` / `{name}` |
| `smoke_alarm_sound` | camera, doorbell | `featureFlags.smartDetectAudioTypes` contains `alrmSmoke` | `smoke` / `smoke` / `Smoke alarm` |
| `co_alarm_sound` | camera, doorbell | `featureFlags.smartDetectAudioTypes` contains `alrmCmonx` | `carbon_monoxide` / `carbon_monoxide` / `Carbon monoxide alarm` |
| `sound_detection` | camera, doorbell | for_each `featureFlags.smartDetectAudioTypes`, ignore `alrmSmoke`, `alrmCmonx`: `alrmGlassBreak→glass_break`, `alrmBurglar→burglar_alarm`, `alrmSiren→siren`, `alrmBabyCry→baby_cry`, `alrmSpeak→speech`, `alrmBark→dog_bark`, `alrmCarHorn→car_horn`; names `Glass break detection`, `Burglar alarm detection`, `Siren detection`, `Baby cry detection`, `Speech detection`, `Dog bark detection`, `Car horn detection` | `sound_detection.{key}` / `sound_detection` / `{name}` |
| `camera_indicator` | camera, doorbell | `featureFlags.hasLedStatus` equals `true` | `indicator` / `indicator` / `Status LED` |
| `camera_microphone` | camera, doorbell | `featureFlags.hasMic` equals `true` | `microphone` / `microphone` / `Microphone` |
| `sensor_contact` | sensor | `mountType` in `[door, window, garage]` | `contact` / `contact` / `Contact` |
| `sensor_motion` | sensor | `motionSettings.isEnabled` equals `true` | `motion` / `motion` / `Motion` |
| `sensor_leak` | sensor | any: `mountType` equals `leak`, `leakSettings.isExternalEnabled` equals `true` | `leak` / `leak` / `Leak` |
| `sensor_smoke` | sensor | `alarmSettings.isEnabled` equals `true` | `smoke` / `smoke` / `Smoke alarm` |
| `sensor_temperature` | sensor | `temperatureSettings.isEnabled` equals `true` | `temperature` / `temperature` / `Temperature` |
| `sensor_humidity` | sensor | `humiditySettings.isEnabled` equals `true` | `humidity` / `humidity` / `Humidity` |
| `sensor_illuminance` | sensor | `lightSettings.isEnabled` equals `true` | `illuminance` / `illuminance` / `Illuminance` |
| `sensor_battery` | sensor | `batteryStatus.percentage` exists | `battery` / `battery` / `Battery` |
| `floodlight_light` | floodlight | — | `light` / `light` / `Light` |

`properties.yaml` mappings, in this order (`identifier` / `category`, then value):

| name | channel (devices) | property | value |
|---|---|---|---|
| `manufacturer` | device_information | `manufacturer` / `manufacturer` | `constant: Ubiquiti` |
| `camera_model` | device_information (camera, doorbell) | `model` / `model` | `path: type`, `default: UniFi Protect camera` |
| `sensor_model` | device_information (sensor) | `model` / `model` | `path: type`, `default: UP-Sense` |
| `floodlight_model` | device_information (floodlight) | `model` / `model` | `path: type`, `default: UP Floodlight` |
| `serial_number` | device_information | `serial_number` / `serial_number` | `path: mac` |
| `connection_state` | device_information | `connection_state` / `status`, name `Connection state` | `path: state`, map `CONNECTED: connected, CONNECTING: init, DISCONNECTED: disconnected`, default `unknown` |
| `camera_main_status` | camera_main | `status` / `status` | `stream_status: main` |
| `camera_main_source` | camera_main | `source` / `source` | `template: 'unifi-protect:{id}:main'` |
| `camera_package_status` | camera_package | `status` / `status` | `stream_status: package` |
| `camera_package_source` | camera_package | `source` / `source` | `template: 'unifi-protect:{id}:package'` |
| `doorbell_event` | doorbell | `event` / `event` | none (UP-8 publishes rings) |
| `camera_motion_detected` | camera_motion | `detected` / `detected` | `constant: false` |
| `object_detected` | object_detection | `detected` / `detected` | `constant: false` |
| `object_type` | object_detection | `object_type` / `object_type` | `template: '{key}'` |
| `smoke_alarm_sound_detected` | smoke_alarm_sound | `detected` / `detected` | `constant: false` |
| `co_alarm_sound_detected` | co_alarm_sound | `detected` / `detected` | `constant: false` |
| `sound_detected` | sound_detection | `detected` / `detected` | `constant: false` |
| `sound_type` | sound_detection | `sound_type` / `sound_type` | `template: '{key}'` |
| `camera_indicator_on` | camera_indicator | `'on'` / `'on'` | `path: ledSettings.isEnabled` |
| `microphone_active` | camera_microphone | `active` / `active` | `path: isMicEnabled` |
| `microphone_volume` | camera_microphone | `volume` / `volume`, variant `percentage` | `path: micVolume`, round |
| `contact_detected` | sensor_contact | `detected` / `detected` | `path: isOpened` |
| `contact_tampered` | sensor_contact | `tampered` / `tampered` | `constant: false` |
| `sensor_motion_detected` | sensor_motion | `detected` / `detected` | `path: isMotionDetected` |
| `sensor_motion_tampered` | sensor_motion | `tampered` / `tampered` | `constant: false` |
| `leak_detected` | sensor_leak | `detected` / `detected` | `constant: false` (P4) |
| `leak_level` | sensor_leak | `level` / `level` | `constant: low` (P4) |
| `sensor_smoke_detected` | sensor_smoke | `detected` / `detected` | `constant: false` (P4) |
| `temperature` | sensor_temperature | `temperature` / `temperature` | `path: stats.temperature.value` |
| `humidity` | sensor_humidity | `humidity` / `humidity` | `path: stats.humidity.value`, round |
| `illuminance` | sensor_illuminance | `illuminance` / `illuminance` | `path: stats.light.value` |
| `illuminance_level` | sensor_illuminance | `level` / `level` | `path: stats.light.value`, thresholds `500 bright, 50 moderate, 10 dusky`, default `dark` (P9) |
| `battery_percentage` | sensor_battery | `percentage` / `percentage`, variant `percentage` | `path: batteryStatus.percentage`, round |
| `battery_status` | sensor_battery | `status` / `status` | `path: batteryStatus.isLow`, map `'true': low, 'false': ok` |
| `light_on` | floodlight_light | `'on'` / `'on'` | `path: isLightOn` |
| `light_brightness` | floodlight_light | `brightness` / `brightness`, variant `percentage` | `path: lightDeviceSettings.ledLevel`, scale `[0, 6] → [0, 100]`, round (P9) |

- [ ] **Step 2: Write the failing evaluator tests** (`mapping-evaluator.spec.ts`, mappings from
  `new ProtectMappingLoaderService().load()`, `nvr = { id: '68b3ace392bf98c9fb76f70c', macKey: '0cea14003a69' }`)

```ts
it('loads the built-in definitions', ...);  // device mapping names in resolved order ['doorbell', 'camera', 'floodlight', 'sensor']; no category 'generic'
it('recognises a doorbell by its LCD flag or its model name', ...); // hasLcdScreen false + type 'UVC G4 Doorbell' -> 'doorbell'; neither -> 'camera'
it('maps every Protect detection type to its spec value', ...);    // all six smartDetectTypes and seven non-alarm audio types -> identifiers in input order
it('skips an unknown detection type with a warning', ...);         // + 'pet', 'alrmFuture', 'a/b' -> no channel; warnings [{code:'unsupported_detection_type', identifier:'pet'}, {…'alrmFuture'}, {…, identifier:null}]
it('creates one channel for a repeated detection type', ...);       // ['person','person']
it.each([[0,'dark'],[9.9,'dark'],[10,'dusky'],[49,'dusky'],[50,'moderate'],[499,'moderate'],[500,'bright']])('derives illuminance level %s lx -> %s', ...);
it.each([[1,17],[2,33],[3,50],[4,67],[5,83],[6,100]])('scales floodlight level %i to %i %%', ...);
it.each([['CONNECTED','connected'],['CONNECTING','init'],['DISCONNECTED','disconnected'],['REBOOTING','unknown']])('maps state %s', ...);
it.each([
	['CONNECTED', { high: true }, 'available'], ['CONNECTED', {}, 'unavailable'], ['CONNECTED', null, 'unavailable'],
	['CONNECTING', { high: true }, 'initializing'], ['DISCONNECTED', { high: true }, 'offline'], ['REBOOTING', { high: true }, 'unavailable'],
])('reports camera.main status for %s with %j as %s', ...);           // and camera.package uses only `package`
it('does not derive detections from event timestamps', ...);       // sensors.json leak and tamper variants: leak.detected false, contact.tampered false; alarmTriggeredAt set + alarmSettings enabled: smoke.detected false
it('creates contact only for door, window and garage mounts and leak for a leak mount or an external probe', ...);
it('nulls a value whose type does not match', ...);                // micVolume '100' -> volume null; stats.temperature.value 'warm' -> null
it('returns unsupported_model for a chime and invalid_device for an id outside the pattern', ...); // chimes.json[0] modelKey 'chime'; id '../x'
it('falls back to a generated name when the console name is unusable', ...); // name '\u0007' -> 'UniFi Protect camera <id>'
it('toStreamAvailability drops the URLs', ...);                    // rtsps-stream.json -> { high:true, medium:false, low:false, package:false }; JSON.stringify has no 'rtsps'
it.each([['0CEA14003A69','0cea14003a69'],['0c:ea:14:00:3a:69','0cea14003a69'],[null,null],['zz',null]])('toNvrMacKey(%j)', ...);
```

- [ ] **Step 3: Write the failing golden tests** (`protect-mappings.spec.ts`). For each row: evaluate, compare with
  `__fixtures__/expected/<name>.json` (`toEqual`), and assert
  `new DeviceValidationService({} as never).validateDeviceStructure(toValidationInput(device))` equals
  `{ isValid: true, issues: [] }`. With `PROTECT_UPDATE_GOLDEN=1` the test writes the file instead (developer aid; CI
  never sets it). Explicit assertions in addition to the file comparison:

| Golden | Input (streams) | Category, identifier | Channel identifiers, in order | Values asserted |
|---|---|---|---|---|
| `camera` | `cameras.json[0]` (`{high}`) | `camera`, `0cea14003a69:600cefafd5f365d6f83c4ef3` | `device_information, camera.main, motion, object_detection.person, object_detection.vehicle, object_detection.animal, smoke, carbon_monoxide, sound_detection.baby_cry, sound_detection.speech, indicator, microphone` | name `Front door`, model `UVC G5 Dome`, serial `0CEA14008183`, connection_state `connected`, camera.main status `available`, source `unifi-protect:600cefafd5f365d6f83c4ef3:main`, indicator on `false`, microphone active `true`, volume `100` |
| `doorbell` | `cameras-doorbell.json[0]` (all false) | `doorbell` | `device_information, camera.main, doorbell, motion, object_detection.person, object_detection.vehicle, object_detection.animal, indicator, microphone` | camera.main status `unavailable`, doorbell event `null`, indicator on `true` |
| `doorbell-package` | `cameras-doorbell.json[1]` (all false) | `doorbell` | `device_information, camera.main, camera.package, doorbell, motion, object_detection.person, object_detection.vehicle, object_detection.animal, object_detection.package, indicator, microphone` | camera.package source `unifi-protect:5f0000000000000000000a02:package`, status `unavailable` |
| `sensor` | `sensors.json[0]` (null) | `sensor` | `device_information, contact, motion, temperature, humidity, illuminance, battery` | model `UP-Sense`, contact detected `false`, temperature `21.4`, humidity `41`, illuminance `120`, level `moderate`, battery `87` / `ok` |
| `sensor-leak` | `sensors.json[3]` (null) | `sensor` | `device_information, motion, leak, temperature, humidity, illuminance, battery` | leak detected `false`, level `low` |
| `floodlight` | `lights.json[0]` (null) | `lighting` | `device_information, light` | model `UP Floodlight`, light on `false`, brightness `100` |

Also `it('gives every channel a unique name and every property a unique name per channel')` over all six goldens (F8).

- [ ] **Step 4: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/mappings`
Expected: FAIL, "Cannot find module './mapping-evaluator'".

- [ ] **Step 5: Implement** `mapping-evaluator.ts`. Then generate the goldens with
  `PROTECT_UPDATE_GOLDEN=1 pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/mappings/protect-mappings.spec.ts`
  and read every generated file against the table above before keeping it; a value that differs from the table is a bug
  in the definitions or the evaluator, not in the table.

- [ ] **Step 6: Wire the fixtures check, the assets and the provider**

`fixtures.spec.ts`: add `'expected'` to the known directory entries and a `describe.each` of the sanitization checks over
`readdirSync(join(DIRECTORY, 'expected'))` (paths `expected/<file>`); `README.md` row: ``| `expected/` | derived | golden
mapping output per device type (UP-7), regenerated only with `PROTECT_UPDATE_GOLDEN=1` |``. `nest-cli.json`: append after
the Homey entries `{ "include": "plugins/devices-unifi-protect/mappings/schema/**/*.json", "outDir": "dist" }` and
`{ "include": "plugins/devices-unifi-protect/mappings/definitions/**/*.yaml", "outDir": "dist" }`. Plugin: add
`ProtectMappingLoaderService` to `providers`.

- [ ] **Step 7: Run to verify pass**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/mappings src/plugins/devices-unifi-protect/__fixtures__ src/plugins/devices-unifi-protect/devices-unifi-protect.plugin.spec.ts`
then `pnpm --filter ./apps/backend exec nest build && ls apps/backend/dist/plugins/devices-unifi-protect/mappings/definitions apps/backend/dist/plugins/devices-unifi-protect/mappings/schema`
Expected: PASS; the listing shows `channels.yaml devices.yaml properties.yaml` and `mapping-schema.json`.

- [ ] **Step 8: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect
git add apps/backend/src/plugins/devices-unifi-protect apps/backend/nest-cli.json
git commit -m "feat(backend): map UniFi Protect cameras, doorbells, sensors and floodlights to the device spec"
```

---

### Task 4: Console identity, inventory and `GET devices`

**Files:**
- Modify: `services/protect-connector.service.ts`, `devices-unifi-protect.plugin.ts`, `devices-unifi-protect.openapi.ts`
- Create: `errors/protect-adoption.error.ts`, `services/protect-inventory.service.ts`, `models/protect-inventory.model.ts`,
  `controllers/protect-devices.controller.ts`
- Test: `services/protect-connector.service.spec.ts` (extend), `services/protect-inventory.service.spec.ts`,
  `controllers/protect-devices.controller.spec.ts`

**Interfaces:**
- Consumes: F1, Task 1 client methods, Task 3 `evaluateProtectMapping`, `toNvrMacKey`, `ProtectModelKey`.
- Produces:
  ```ts
  // services/protect-connector.service.ts
  export interface ProtectConsoleIdentity { nvrId: string; nvrMacKey: string }
  getConsoleIdentity(): ProtectConsoleIdentity | null;   // null unless connected and the NVR reported a valid MAC; reset with the runtime
  // errors/protect-adoption.error.ts
  export class ProtectConsoleUnavailableError extends Error { constructor(readonly category: ProtectErrorCategory | null) }
  export class ProtectDeviceNotFoundError extends Error {}
  export class ProtectUnsupportedDeviceError extends Error {}
  // services/protect-inventory.service.ts
  export interface ProtectInventoryEntry { modelKey: ProtectModelKey; id: string; raw: Readonly<Record<string, unknown>> }
  export interface ProtectFreshDevice { client: ProtectApiClient; identity: ProtectConsoleIdentity; entry: ProtectInventoryEntry }
  @Injectable() export class ProtectInventoryService {
  	constructor(connector: ProtectConnectorService, devicesService: DevicesService, mappingLoader: ProtectMappingLoaderService);
  	findAll(): Promise<ProtectInventoryDeviceModel[]>;
  	findOne(deviceId: string): Promise<ProtectInventoryDeviceModel>;
  	fetchDevice(deviceId: string, modelKey: ProtectModelKey): Promise<ProtectFreshDevice>; // one by-id GET (getCamera | getSensor | getLight)
  	getAdoptedByIdentifier(): Promise<Map<string, ProtectDeviceEntity>>;                  // as homey-device-inventory.service.ts getAdoptedByIdentifier
  }
  ```
- `ProtectInventoryDeviceModel` (`DevicesUnifiProtectPluginDataInventoryDevice`), wire names: `id`, `model_key`, `name`,
  `model` (`raw.type` or null), `mac`, `state`, `connected` (`state === 'CONNECTED'`), `supported`, `mapping_name`,
  `suggested_category` (`DeviceCategory | null`), `identifier` (`<nvrMacKey>:<id>`), `adopted`, `adopted_device_id`
  (uuid or null). Responses `DevicesUnifiProtectPluginResInventoryDevices` (array) and
  `DevicesUnifiProtectPluginResInventoryDevice`.
- Rules: no client or no identity → `ProtectConsoleUnavailableError(null)`; a client error with category `not_found` in
  `fetchDevice`/`findOne` → `ProtectDeviceNotFoundError`; any other client error → `ProtectConsoleUnavailableError(category)`.
  `findAll` reads the three lists in parallel; concurrent calls share one in-flight promise; nothing is cached after it
  settles. Within each list the first entry of an id wins; output order cameras, sensors, lights, each by name then id.
  `supported`/`suggested_category`/`mapping_name` come from `evaluateProtectMapping` with `streams: null`.
- Controller `@Controller('devices')`: `GET` → `findAll`; `GET :deviceId` (`PROTECT_ID_PATTERN` else
  `BadRequestException('Invalid UniFi Protect device identifier')`) → `findOne`. Unavailable →
  `ServiceUnavailableException('The UniFi Protect console is not connected')`, not found →
  `NotFoundException('UniFi Protect device not found')`. operationIds `get-devices-unifi-protect-plugin-devices`,
  `get-devices-unifi-protect-plugin-device`; `@ApiServiceUnavailableResponse`, `@ApiNotFoundResponse`,
  `@ApiBadRequestResponse`.

- [ ] **Step 1: Write the failing tests**

```ts
// protect-connector.service.spec.ts
it('exposes the console identity only while connected', ...); // nvrs.json -> { nvrId: '68b3ace392bf98c9fb76f70c', nvrMacKey: '0cea14003a69' }; after stop() -> null
it('reports no console identity when the NVR has no usable MAC', ...); // getClient() non-null, getConsoleIdentity() null
// protect-inventory.service.spec.ts (client as a plain object of jest.fn(), fixtures cameras + cameras-doorbell, sensors, lights)
it('lists cameras, doorbells, sensors and floodlights with mapping support', ...);
// 6 entries; names ['Front door','Garage','Synthetic doorbell','Synthetic doorbell with package camera','Synthetic UP-Sense','Synthetic floodlight'];
// suggested_category ['camera','camera','doorbell','doorbell','sensor','lighting']; adopted false
it('marks an entry adopted when a Protect device has its identifier', ...); // identifier '0cea14003a69:600cefafd5f365d6f83c4ef3' -> adopted true, adopted_device_id
it('keeps the first entry when the console lists an id twice', ...);         // sensors.json (6 variants) -> 1 sensor, the idle one
it('throws unavailable without a client or a console identity', ...);
it('maps a 404 to not found and other console failures to unavailable', ...);
it('reads a sensor and a light by id with their own endpoint', ...);        // getSensor/getLight called, list methods not
it('shares one set of console reads between concurrent listings', ...);     // two findAll -> listCameras called once
it('returns only the documented fields', ...);                              // Object.keys of an entry equal the wire list above (camelCase)
// protect-devices.controller.spec.ts
it('wraps the inventory in the response envelope', ...);
it.each([[new ProtectConsoleUnavailableError(null), 503], [new ProtectDeviceNotFoundError(), 404]])('maps %s to %i', ...);
it('rejects a malformed device id with 400 before reading the console', ...);
it('restricts both routes to owners and administrators', ...);              // as devices-homey/controllers/homey-adoption.controller.spec.ts:64
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/services/protect-connector.service.spec.ts src/plugins/devices-unifi-protect/services/protect-inventory.service.spec.ts src/plugins/devices-unifi-protect/controllers/protect-devices.controller.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**; register `ProtectInventoryService` and `ProtectDevicesController` in the plugin and append
  the three models to `DEVICES_UNIFI_PROTECT_PLUGIN_SWAGGER_EXTRA_MODELS`.

- [ ] **Step 4: Run to verify pass.** Command of Step 2. Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect
git add apps/backend/src/plugins/devices-unifi-protect
git commit -m "feat(backend): list the UniFi Protect device inventory"
```

---

### Task 5: Mapping preview and `POST mapping-preview`

**Files:**
- Create: `services/protect-mapping-preview.service.ts`, `dto/protect-mapping-preview.dto.ts`,
  `models/protect-mapping-preview.model.ts`, `controllers/protect-adoption.controller.ts`
- Modify: `devices-unifi-protect.plugin.ts`, `devices-unifi-protect.openapi.ts`
- Test: `services/protect-mapping-preview.service.spec.ts`, `controllers/protect-adoption.controller.spec.ts`

**Interfaces:**
- Consumes: Task 4 `ProtectInventoryService.fetchDevice`, `getAdoptedByIdentifier`, errors; Task 3 evaluator;
  `DeviceValidationService` (F9); `ConfigService.getPluginConfig<ProtectConfigModel>(DEVICES_UNIFI_PROTECT_PLUGIN_NAME)`
  (`defaultStreamQuality`).
- Produces:
  ```ts
  export enum ProtectPreviewWarningCode {
  	STREAM_NOT_ENABLED = 'stream_not_enabled', HEVC_CODEC = 'hevc_codec', THIRD_PARTY_CAMERA = 'third_party_camera',
  	DEVICE_DISCONNECTED = 'device_disconnected', UNSUPPORTED_DETECTION_TYPE = 'unsupported_detection_type',
  	STREAM_STATE_UNKNOWN = 'stream_state_unknown', SPEC_VALIDATION_FAILED = 'spec_validation_failed',
  }
  export enum ProtectPreviewWarningSeverity { INFO = 'info', WARNING = 'warning', ERROR = 'error' }
  export interface ProtectPreparedMapping {
  	fresh: ProtectFreshDevice; device: ProtectMappedDevice; streams: ProtectStreamAvailability | null;
  	warnings: ProtectMappingPreviewWarningModel[]; readyToAdopt: boolean; existing: ProtectDeviceEntity | null;
  }
  @Injectable() export class ProtectMappingPreviewService {
  	constructor(inventory: ProtectInventoryService, mappingLoader: ProtectMappingLoaderService, deviceValidation: DeviceValidationService, configService: ConfigService);
  	prepare(deviceId: string, modelKey: ProtectModelKey): Promise<ProtectPreparedMapping>; // fresh reads; throws the Task 4 errors or ProtectUnsupportedDeviceError
  	preview(deviceId: string, modelKey: ProtectModelKey): Promise<ProtectMappingPreviewModel>;
  	toStatusValue(device: ProtectMappedDevice, streams: ProtectStreamAvailability | null): ProtectMappedDevice; // re-evaluates camera.*.status (used by Task 7)
  }
  ```
- DTOs: `ProtectMappingPreviewDto` (`DevicesUnifiProtectPluginMappingPreview`: `device_id` matching `PROTECT_ID_PATTERN`,
  `model_key` in `PROTECT_MODEL_KEYS`), `ProtectReqMappingPreviewDto` (`DevicesUnifiProtectPluginReqMappingPreview`,
  `{ data }`, validated like `ProtectProbeRequestDto`).
- Model `ProtectMappingPreviewModel` (`DevicesUnifiProtectPluginDataMappingPreview`): `device` (`…DataMappingPreviewDevice`:
  `id`, `model_key`, `name`, `model`, `state`), `identifier`, `category`, `mapping_name`, `channels`
  (`…DataMappingPreviewChannel`: `identifier`, `category`, `name`, `mapping_name`, `properties`
  (`…DataMappingPreviewProperty`: `identifier`, `category`, `name`, `data_type`, `permissions`, `unit`, `format`, `step`,
  `value`, `mapping_name`)), `warnings` (`…DataMappingPreviewWarning`: `code`, `severity`, `identifier` nullable), `stream`
  (`…DataMappingPreviewStream` or null for sensors and lights: `enabled_qualities` (`ProtectRtspsQuality[]`, null when
  unknown), `default_quality`, `package_camera`), `ready_to_adopt`, `adopted`, `adopted_device_id`. Response
  `DevicesUnifiProtectPluginResMappingPreview`.
- Warning rules (P5): cameras only read `client.getRtspsStreams(id)` and pass it straight to `toStreamAvailability`;
  a failed read → `streams: null` and `stream_state_unknown` (warning). `stream_not_enabled` (warning) with identifier
  `camera.main` when streams are known and `high`, `medium`, `low` are all false; again with `camera.package` when
  `hasPackageCamera` and `package` is false. `hevc_codec` (warning) when `raw.videoCodec` is a string matching
  `/^(h265|hevc)$/i`. `third_party_camera` (info) when `raw.isThirdPartyCamera === true`. `device_disconnected`
  (warning) when `raw.state !== 'CONNECTED'`. Evaluator warnings become `unsupported_detection_type` (info).
  Every validation issue becomes `spec_validation_failed` with the issue severity and the channel category as
  identifier; `readyToAdopt` is false when any has severity error. Order: device, stream, detection, validation.
- Controller `@Controller()` with `@Post('mapping-preview')`, `@HttpCode(200)`, operationId
  `create-devices-unifi-protect-plugin-mapping-preview`; unavailable → 503, not found → 404, unsupported →
  `UnprocessableEntityException('The UniFi Protect device has no supported mapping')` (422).

- [ ] **Step 1: Write the failing tests**

```ts
it('previews the captured camera without warnings, with the golden channels', ...); // channels toEqual expected/camera.json channels; warnings []; stream.enabled_qualities ['high']; default_quality 'medium'; ready_to_adopt true
it('flags stream_not_enabled for a doorbell without streams and for its package camera', ...); // [{code:'stream_not_enabled', identifier:'camera.main'}, {…'camera.package'}]
it.each([
	[{ videoCodec: 'H265' }, 'hevc_codec'], [{ isThirdPartyCamera: true }, 'third_party_camera'], [{ state: 'DISCONNECTED' }, 'device_disconnected'],
])('flags %j as %s', ...);
it('reports stream_state_unknown and still previews when the stream read fails', ...);
it('never reads streams for sensors and floodlights', ...);           // getRtspsStreams not called; stream null
it('keeps stream URLs out of the preview', ...);                       // client returns URLs with 'SENTINELALIASx'; JSON.stringify(preview) contains neither 'rtsps' nor 'SENTINELALIAS'
it('marks a device adopted when its identifier exists', ...);
it('marks the preview not ready when spec validation reports an error', ...); // validation stub returns one error issue -> ready_to_adopt false, warning spec_validation_failed severity 'error'
it('throws ProtectUnsupportedDeviceError when no device mapping matches', ...); // loader stub without the floodlight mapping, model_key 'light'
// controller
it('wraps the preview and maps 503, 404 and 422', ...);
it.each([[{}], [{ data: { device_id: '../x', model_key: 'camera' } }], [{ data: { device_id: 'a', model_key: 'chime' } }]])('rejects %j with 400', ...); // via ValidationPipe as in dto/protect-discovery-probe.dto.spec.ts
it('restricts the preview to owners and administrators', ...);
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/services/protect-mapping-preview.service.spec.ts src/plugins/devices-unifi-protect/controllers/protect-adoption.controller.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**; register the service and the controller; append the DTO and model classes to the swagger
  models.

- [ ] **Step 4: Run to verify pass.** Command of Step 2. Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect
git add apps/backend/src/plugins/devices-unifi-protect
git commit -m "feat(backend): preview the mapping of a UniFi Protect device"
```

---

### Task 6: Idempotent adoption with lock and compensating journal

**Files:**
- Create: `services/protect-adoption-lock.service.ts`, `services/protect-adoption.service.ts`,
  `dto/protect-adoption.dto.ts`, `models/protect-adoption.model.ts`
- Modify: `controllers/protect-adoption.controller.ts`, `devices-unifi-protect.plugin.ts`,
  `devices-unifi-protect.openapi.ts`
- Test: `services/protect-adoption-lock.service.spec.ts`, `services/protect-adoption.service.spec.ts`,
  `controllers/protect-adoption.controller.spec.ts` (extend)

**Interfaces:**
- Consumes: Task 5 `prepare`; F6–F8, F12, F13, F17; `DataSource` (typeorm).
- Produces:
  ```ts
  // services/protect-adoption-lock.service.ts
  @Injectable() export class ProtectAdoptionLockService {
  	run<T>(key: string, operation: () => Promise<T>): Promise<T>; // FIFO per key, as homey-device-adoption.service.ts:1021-1039 withDeviceLock
  }
  // dto/protect-adoption.dto.ts
  ProtectAdoptStreamDto        // DevicesUnifiProtectPluginAdoptStream: enabled?: boolean (default true), quality?: 'high' | 'medium' | 'low'
  ProtectAdoptDeviceDto        // DevicesUnifiProtectPluginAdoptDevice: device_id (PROTECT_ID_PATTERN), model_key (PROTECT_MODEL_KEYS), name? (1-255), stream? (ProtectAdoptStreamDto)
  ProtectReqAdoptDeviceDto     // DevicesUnifiProtectPluginReqAdoptDevice: { data: ProtectAdoptDeviceDto }
  ProtectBatchAdoptDevicesDto  // DevicesUnifiProtectPluginBatchAdoptDevices: devices: ProtectAdoptDeviceDto[] (1..50)
  ProtectReqBatchAdoptDevicesDto // DevicesUnifiProtectPluginReqBatchAdoptDevices: { data: ProtectBatchAdoptDevicesDto }
  // models/protect-adoption.model.ts
  export enum ProtectAdoptionStatus { CREATED = 'created', UPDATED = 'updated', SKIPPED = 'skipped', FAILED = 'failed' }
  export enum ProtectAdoptionFailureCode {
  	UNAVAILABLE = 'unavailable', DEVICE_NOT_FOUND = 'device_not_found', UNSUPPORTED_MAPPING = 'unsupported_mapping',
  	NOT_READY = 'not_ready', PERSISTENCE_FAILED = 'persistence_failed', ROLLBACK_FAILED = 'rollback_failed',
  }
  ProtectAdoptionResultModel   // DevicesUnifiProtectPluginDataAdoptionResult: device_id, model_key, status, panel_device_id, failure_code, message
  ProtectBatchAdoptionModel    // DevicesUnifiProtectPluginDataBatchAdoption: results[]
  ProtectAdoptionResponseModel, ProtectBatchAdoptionResponseModel // …ResAdoption, …ResBatchAdoption
  // services/protect-adoption.service.ts
  @Injectable() export class ProtectAdoptionService {
  	constructor(preview: ProtectMappingPreviewService, devicesService: DevicesService, channelsService: ChannelsService,
  		channelsPropertiesService: ChannelsPropertiesService, propertyValueService: PropertyValueService,
  		connectivity: DeviceConnectivityService, structureLock: DeviceStructureLockService, lock: ProtectAdoptionLockService,
  		dataSource: DataSource);
  	adoptOne(selection: ProtectAdoptDeviceDto): Promise<ProtectAdoptionResultModel>;            // never rejects
  	adoptBatch(selections: readonly ProtectAdoptDeviceDto[]): Promise<ProtectAdoptionResultModel[]>; // sequential, request order
  }
  ```
- Fixed messages: `unavailable` `The UniFi Protect console is not connected`; `device_not_found` `The device was not found
  on the UniFi Protect console`; `unsupported_mapping` `The device has no supported mapping`; `not_ready` `The device
  mapping does not satisfy the device specification`; `persistence_failed` `The device could not be saved; no change was
  kept`; `rollback_failed` `The device could not be saved and some changes could not be undone`. Success → `message: null`.
- Algorithm (inside `lock.run(selection.deviceId)`):
  1. `prepare(deviceId, modelKey)`; `ProtectConsoleUnavailableError` → `unavailable`; `ProtectDeviceNotFoundError` →
     `device_not_found`; `ProtectUnsupportedDeviceError` → `unsupported_mapping`; `!readyToAdopt` → `not_ready`. No
     mutation has happened.
  2. `existing = devicesService.findOneBy('identifier', device.identifier, DEVICES_UNIFI_PROTECT_TYPE)`.
  3. **Create** (none existing): inside `structureLock.runExclusive`, `DeviceCreationContext.run((work) =>
     this.dataSource.transaction(work), DEVICES_UNIFI_PROTECT_TYPE, (context) => this.devicesService.create(dto, context),
     () => undefined)` with `dto` = `{ id: uuid(), type, identifier, name: selection.name ?? device.name, category,
     protectNvrId, protectDeviceId, protectModelKey, channels }`, each channel `{ id: uuid(), type, identifier, name,
     category, properties }`, each property `{ id: uuid(), type, identifier, name, category, permissions, data_type, unit,
     format, step, invalid: null, protectMappingName }`. If it throws: re-read by identifier — found → go to 4 (a
     concurrent winner; result is its reconciliation status), else `persistence_failed` (the transaction left nothing).
     After commit: terminal values, then connectivity (below). Result `created`.
  4. **Reconcile** (existing): port `homey-device-adoption.service.ts` `reconcileExisting` (335), `reconcileChannel`
     (438), `reconcileProperties` (518), `deferStaleChannels` (642), `snapshotHierarchy` (673), `restoreDeviceMetadata`
     (801), `restoreChannelMetadata` (820), `restorePropertyMetadata` (840), `removeCreatedChannel` (872),
     `removeCreatedProperty` (886), `propertyMetadataChanged` (909), `applyPendingValues` (927), `pruneStale` (953),
     `rollback` (1006) with the substitutions below; result `updated` when anything changed, else `skipped`.

  | Homey | Protect |
  |---|---|
  | `HomeyAdoptionLease`, `lease.assertOwned()`, `HomeyAdoptionLockLostError`, `beforeValuePersistence: () => lease.assertOwned()` | removed (P7); strict options keep `strictValuePersistence`, `comparePersistedValue`, `expectedPersistedState` |
  | `preview.device.id` as the device identifier | `device.identifier` |
  | `propertyIdentifier(p)` = `<capabilityId>::<mappingName>` | `p.identifier` |
  | property identity `homeyCapabilityId` + `homeyMappingName` | `protectMappingName` |
  | `HomeyMappingPreviewChannelModel` / `PropertyModel` (`panelEnumValues`, `range`) | `ProtectMappedChannel` / `ProtectMappedProperty` (`format`, `step`, `unit` as given) |
  | desired name `selection.name ?? preview.device.name` | `selection.name ?? lockedDevice.name` (a rename in Smart Panel survives) |
  | device metadata compared: name, category, identifier | name, category, identifier, `protectNvrId`, `protectDeviceId`, `protectModelKey` |
  | stale exclusions: `DEVICE_INFORMATION` channels | same, plus properties whose `protectMappingName` is null |
  | Homey failure codes | `ProtectAdoptionFailureCode` |

  5. **Terminal values** (both paths): every mapped property with `value !== null`, except `connection_state`, through
     `channelsPropertiesService.update(id, { type, value }, { strictValuePersistence: true, comparePersistedValue: true,
     expectedPersistedState })`; a failed write is logged with a fixed text and left to the next adoption (Homey
     behaviour). **Connectivity:** `connectivity.trySetConnectionState(deviceId, { state })` with the mapped
     `connection_state` value as `ConnectionState`.
- Controller additions: `@Post('adopt')` (operationId `create-devices-unifi-protect-plugin-adoption`) and
  `@Post('adopt/batch')` (`create-devices-unifi-protect-plugin-batch-adoption`), both `@HttpCode(200)`, owner/admin,
  `@ApiBadRequestResponse`, results always `200` with per-item outcomes.

- [ ] **Step 1: Write the failing tests** (mocks as in `devices-homey/services/homey-device-adoption.service.spec.ts`; the
  prepared mapping is the `camera` golden unless stated; `DeviceCreationContext.run` is spied to call the operation with a
  stand-in context and the writer as a pass-through)

```ts
// lock
it('runs operations for one key in order and different keys concurrently', ...);
it('releases the key after a rejection', ...);
// adoption
it('creates the full hierarchy in one creation transaction and applies initial values after it', ...);
// devicesService.create called once with (dto, context): dto.identifier '0cea14003a69:600cefafd5f365d6f83c4ef3', protectNvrId '68b3ace392bf98c9fb76f70c',
// protectDeviceId, protectModelKey 'camera', 12 channels with uuid ids; then strict updates for every non-null value except connection_state;
// trySetConnectionState(deviceId, { state: 'connected' }); result { status: 'created', panel_device_id: <dto.id>, failure_code: null }
it('leaves nothing behind when the creation transaction fails', ...);  // create rejects, re-read null -> 'persistence_failed'; no channel or property service mutation
it('hands a lost unique insert over to reconciliation', ...);            // create rejects, re-read returns the hierarchy -> 'skipped'
it('skips an unchanged device and writes nothing', ...);                  // existing equals mapped, values equal -> 'skipped'; no create/update/remove calls
it('adds a new detection channel and prunes one Protect no longer reports', ...); // existing has object_detection.face; mapped adds licensePlate -> create license_plate, remove face after values; 'updated'; untouched property ids unchanged
it('keeps the Smart Panel name on re-adoption unless a name is given', ...);
it('restores the device identity columns when they drifted', ...);       // existing protectModelKey 'light' -> updated to 'camera'
it('rolls back completed reconciliation steps when a later step fails', ...); // second channel create rejects -> first created channel removed, metadata restored; 'failed'/'persistence_failed'
it('reports rollback_failed when compensation itself fails', ...);
it('never prunes the device information channel or a property without a mapping name', ...);
it.each([
	[new ProtectConsoleUnavailableError(null), 'unavailable'], [new ProtectDeviceNotFoundError(), 'device_not_found'],
	[new ProtectUnsupportedDeviceError(), 'unsupported_mapping'],
])('fails closed before any mutation when the fresh read fails (%s)', ...); // and readyToAdopt false -> 'not_ready'
it('isolates batch failures and keeps request order', ...);              // [ok, not found, ok] -> ['created','failed','created']
it('serializes two concurrent adoptions of one device', ...);             // second call sees the first's device and is 'skipped'
it('returns fixed messages only', ...);                                   // results' message values are the six texts above or null
// controller
it('wraps single and batch results in the response envelope', ...);
it('rejects an empty batch and a batch of 51 with 400', ...);
it('restricts both adoption routes to owners and administrators', ...);
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/services/protect-adoption-lock.service.spec.ts src/plugins/devices-unifi-protect/services/protect-adoption.service.spec.ts src/plugins/devices-unifi-protect/controllers/protect-adoption.controller.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**; register the lock and adoption services; append the DTO and model classes to the swagger
  models.

- [ ] **Step 4: Run to verify pass.** Command of Step 2. Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect
git add apps/backend/src/plugins/devices-unifi-protect
git commit -m "feat(backend): adopt UniFi Protect devices idempotently"
```

---

### Task 7: RTSPS stream enablement during adoption (D9)

**Files:**
- Create: `services/protect-adoption-streams.service.ts`
- Modify: `services/protect-adoption.service.ts`, `models/protect-adoption.model.ts`, `devices-unifi-protect.plugin.ts`,
  `devices-unifi-protect.openapi.ts`
- Test: `services/protect-adoption-streams.service.spec.ts`, `services/protect-adoption.service.spec.ts` (extend)

**Interfaces:**
- Consumes: Task 1 `createRtspsStreams`, `getRtspsStreams`, `PROTECT_RTSPS_QUALITIES`; Task 3 `toStreamAvailability`;
  Task 5 `toStatusValue`, `ProtectPreparedMapping.fresh.client`; `ProtectStreamQuality` (constants); config
  `defaultStreamQuality`.
- Produces:
  ```ts
  export enum ProtectStreamOutcome { ENABLED = 'enabled', ALREADY_ENABLED = 'already_enabled', NOT_REQUESTED = 'not_requested', FAILED = 'failed' }
  export interface ProtectStreamEnablementResult {
  	outcome: ProtectStreamOutcome; quality: ProtectStreamQuality | null;
  	enabledQualities: ProtectRtspsQuality[];           // names only, canonical order
  	failureCategory: ProtectErrorCategory | null;
  	availability: ProtectStreamAvailability | null;    // for camera status; never URLs
  }
  @Injectable() export class ProtectAdoptionStreamsService {
  	ensureStreams(client: ProtectApiClient, cameraId: string, request: { quality: ProtectStreamQuality; packageCamera: boolean }): Promise<ProtectStreamEnablementResult>; // never rejects
  }
  // models/protect-adoption.model.ts
  ProtectAdoptionStreamModel  // DevicesUnifiProtectPluginDataAdoptionStream: status (ProtectStreamOutcome), quality, enabled_qualities, failure_category
  // ProtectAdoptionResultModel gains `stream: ProtectAdoptionStreamModel | null` (null for sensors, floodlights and failed adoptions)
  ```
- Algorithm (P6): (1) `current = toStreamAvailability(await client.getRtspsStreams(id))`; a failure → `failed` with its
  category, no POST. (2) `wanted = [quality, ...(packageCamera ? ['package'] : [])]`. (3) all wanted already true →
  `already_enabled`. (4) `body = PROTECT_RTSPS_QUALITIES.filter((q) => current[q] || wanted.includes(q))`. (5) POST;
  every wanted true in the response → `enabled`; otherwise `failed` / `protocol`. (6) POST error with category
  `bad_request` or `protocol` (`400`/`409`) → one re-read; every wanted true → `already_enabled`, else `failed` with the
  POST's category; any other POST error → `failed` with its category. Log lines are fixed texts
  (`RTSPS stream enablement finished (<outcome>)`), never URLs, aliases or ids.
- Adoption integration: after a successful create or reconcile of a `camera` model device: `selection.stream?.enabled
  === false` → `not_requested` (no request); else `quality = selection.stream?.quality ?? config.defaultStreamQuality`
  (`'medium'` when the config cannot be read), `packageCamera = raw.hasPackageCamera === true`, `ensureStreams(...)`.
  When the result carries `availability`, re-evaluate `camera.main`/`camera.package` status with
  `preview.toStatusValue(device, availability)` and write changed values with the strict path. A stream result never
  changes `status` or `failure_code` of the adoption.

- [ ] **Step 1: Write the failing tests**

```ts
// streams service (client as a plain object of jest.fn())
it('posts the union of enabled and requested qualities', ...);            // current {high}; request medium -> POST ['high','medium']; 'enabled', enabledQualities ['high','medium']
it('adds the package quality for a package camera', ...);                 // current {}; request high + package -> POST ['high','package']
it('does not post when the requested qualities are already enabled', ...); // 'already_enabled'; createRtspsStreams not called
it.each([['bad_request'], ['protocol']])('treats a %s answer as already enabled when a re-read shows the streams', ...);
it('reports a failed POST without throwing and calls the console once', ...); // POST rejects 'unavailable' -> 'failed', failureCategory 'unavailable', 1 POST
it('fails without posting when the stream state cannot be read', ...);
it('reports failed when the console answer lacks a requested quality', ...);
it('keeps aliases out of results and log lines', ...);                    // results JSON and Logger spies contain no 'SENTINELALIAS' and no 'rtsps'
// adoption
it('enables the stream after the device is persisted and updates the camera status', ...); // create before createRtspsStreams; camera.main status strict update 'available'; stream { status:'enabled', quality:'medium', enabled_qualities:['high','medium'] }
it('uses the configured default quality when the request names none', ...); // config defaultStreamQuality 'low' -> POST ['high','low']
it('skips stream work when not requested, for sensors and floodlights, and when persistence failed', ...); // stream.status 'not_requested' / stream null / stream null and no client call
it('reports a stream failure without failing the adoption', ...);           // status 'created', stream.status 'failed'
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/services/protect-adoption-streams.service.spec.ts src/plugins/devices-unifi-protect/services/protect-adoption.service.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**; register `ProtectAdoptionStreamsService`; append `ProtectAdoptionStreamModel` to the swagger
  models.

- [ ] **Step 4: Run to verify pass.** Command of Step 2. Expected: PASS (all Task 6 tests still pass).

- [ ] **Step 5: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect
git add apps/backend/src/plugins/devices-unifi-protect
git commit -m "feat(backend): enable RTSPS streams for adopted UniFi Protect cameras"
```

---

### Task 8: Plugin readme, end-to-end preview → adopt, gates, epic status and PR body

**Files:**
- Modify: `devices-unifi-protect.plugin.ts` (readme), `devices-unifi-protect.plugin.spec.ts`,
  `tasks/epics/EPIC-UNIFI-PROTECT.md:102`
- Create: `apps/backend/test/devices-unifi-protect-adoption.e2e-spec.ts`
- Write (not committed): the PR body in the session scratchpad.

**Interfaces:** Consumes everything above. The e2e copies the bootstrap of `test/devices-unifi-protect.e2e-spec.ts:85-290`
(`FB_CONFIG_PATH` temp directory, `Logger`/`EventEmitter2` spies, `PROTECT_TRUSTED_CA` override, global pipes and
filters, owner and USER tokens, `observed` responses) with `FakeProtectServer.start({ cameraFixtures: ['cameras.json',
'cameras-doorbell.json'] })` and the pinned saved configuration (`savedConfig()` of that file). Base
`${api}/plugins/devices-unifi-protect`. Ids: Front door `600cefafd5f365d6f83c4ef3`, Garage `6e9e3966e39b412ab18f3727`,
doorbell `5f0000000000000000000a01`, package doorbell `5f0000000000000000000a02`, sensor `5f0000000000000000000b01`,
floodlight `5f0000000000000000000c01`.

- [ ] **Step 1: Update the plugin readme and its spec**

Readme: replace the first "What you get" bullet with `- Cameras, doorbells, UP-Sense sensors and floodlights adopted as
Smart Panel devices, with a mapping preview and optional RTSPS stream enablement per camera`; replace the "Boundaries"
first sentence with `Adoption can enable an RTSPS stream on the cameras you select; the plugin never deletes a stream and
never changes other console settings.` Spec: `expect(metadata.readme).toContain('never deletes a stream')` and
`expect(metadata.readme).not.toContain('creates no devices yet')`.

- [ ] **Step 2: Write the e2e tests**

```ts
it('rejects unauthenticated requests with 401 and users with 403 on all five routes', ...);
it('answers 503 on inventory and preview, and unavailable on adopt, before the console is connected', ...);
it('lists the six console devices once connected', ...);           // after patchConfig(savedConfig()) + awaitStatus connected; categories camera, camera, doorbell, doorbell, sensor, lighting; adopted false
it('previews the captured camera cleanly and a package doorbell with stream warnings', ...); // Front door warnings []; a02 codes ['stream_not_enabled','stream_not_enabled']
it('adopts a batch with per-item results and only the requested stream writes', ...);
// batch [Front door {stream:{quality:'medium'}}, a02 {stream:{quality:'high'}}, sensor, floodlight, Garage {stream:{enabled:false}}]
// -> all 'created'; Front door stream enabled ['high','medium']; a02 enabled ['high','package']; Garage 'not_requested'; sensor/floodlight stream null;
// fake.streamPosts toEqual [{cameraId: Front door, qualities:['high','medium']}, {cameraId: a02, qualities:['high','package']}]; every fake.writes entry is POST …/rtsps-stream
it('stores spec-valid devices with the documented identifiers and values', ...);
// per adopted device: app.get(DeviceValidationService).validateDeviceById(id) -> isValid true, issues []; channel identifiers equal the goldens;
// Front door camera.main status 'available' and source 'unifi-protect:600cefafd5f365d6f83c4ef3:main' (PropertyValueService.readLatest); connection_state 'connected'
it('re-adopts idempotently without new console writes', ...);     // same batch -> all 'skipped'; streams 'already_enabled' or 'not_requested'; no new streamPosts; device count unchanged
it('keeps the adoption when the stream POST fails', ...);           // fake.enqueue(/rtsps-stream$/, { status: 500 }, 'POST'); adopt a01 -> 'created', stream.status 'failed', failure_category 'unavailable'
it('reports device_not_found inside a batch without failing the others', ...);
it.each([
	[{ data: { device_id: '../x', model_key: 'camera' } }], [{ data: { device_id: 'a', model_key: 'chime' } }],
	[{ data: { device_id: 'a', model_key: 'camera', stream: { quality: 'package' } } }], [{ data: { device_id: 'a', model_key: 'camera', extra: 1 } }],
])('rejects adopt body %j with 400', ...);
it('rejects a batch of 51 with 400', ...);
it('never leaked a secret into responses, logs, events or the database', ...);
// sentinels FAKE_PROTECT_API_KEY, 'SENTINELALIAS', FAKE_PROTECT_ALIAS absent from inspect([logSpies, emitSpies, observed]) and from
// app.get(DataSource).query('SELECT * FROM devices_module_devices' | '…_channels' | '…_channels_properties'); fake.forbiddenHits 0;
// the spied material is non-trivial (contains 'Front door' and an adoption result)
```

- [ ] **Step 3: Run**

Run: `pnpm --filter ./apps/backend exec jest --config ./test/jest-e2e.json test/devices-unifi-protect-adoption.e2e-spec.ts --detectOpenHandles`
Expected: PASS, 15 tests (the `it.each` rows count), no open-handle report. Fix the test, not the product, unless a real
defect shows.

- [ ] **Step 4: Prove the union test can fail**

Temporarily change `ensureStreams` to post only `wanted`; rerun Step 3. Expected: `adopts a batch with per-item results…`
FAILS on `streamPosts`. Restore with `git checkout -- apps/backend/src/plugins/devices-unifi-protect/services/protect-adoption-streams.service.ts`
and rerun to PASS.

- [ ] **Step 5: OpenAPI and full gates**

```bash
pnpm run generate:openapi
grep -o '"operationId": *"[a-z-]*devices-unifi-protect-plugin-[a-z-]*"' spec/api/v1/openapi.json | sort -u
pnpm --filter ./apps/backend run lint:js
pnpm --filter ./apps/backend run pretty:check
pnpm --filter ./apps/backend run lint:deps
pnpm run test:unit
pnpm --filter ./apps/backend exec jest --config ./test/jest-e2e.json test/devices-unifi-protect.e2e-spec.ts test/devices-unifi-protect-discovery.e2e-spec.ts test/devices-unifi-protect-adoption.e2e-spec.ts
git status --short
```
Expected: every command exits 0; the grep lists `get-devices-unifi-protect-plugin-devices`,
`get-devices-unifi-protect-plugin-device`, `create-devices-unifi-protect-plugin-mapping-preview`,
`create-devices-unifi-protect-plugin-adoption`, `create-devices-unifi-protect-plugin-batch-adoption` among the existing
ones; the admin type generation succeeds; `git status` shows no generated file (they are ignored).

- [ ] **Step 6: Mark the issue done in the epic file**

Edit `tasks/epics/EPIC-UNIFI-PROTECT.md` line 102 so the first cell reads `UP-7 (done)`, matching the UP-5/UP-6 rows.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/plugins/devices-unifi-protect/devices-unifi-protect.plugin.ts apps/backend/src/plugins/devices-unifi-protect/devices-unifi-protect.plugin.spec.ts
git commit -m "docs(backend): describe UniFi Protect adoption in the plugin readme"
git add apps/backend/test/devices-unifi-protect-adoption.e2e-spec.ts
git commit -m "test(backend): cover UniFi Protect preview and adoption end to end"
git add tasks/epics/EPIC-UNIFI-PROTECT.md
git commit -m "docs(tasks): mark UniFi Protect adoption done"
```

- [ ] **Step 8: Write the PR body to a file (do not push, do not open the PR)**

Path: `<session scratchpad>/pr-body-unifi-protect-adoption.md`. Title line first:
`feat(backend): map and adopt UniFi Protect cameras, doorbells, sensors and floodlights`. Sections: Summary (3 bullets);
Endpoints (route, role, purpose); Mapping table (device type → category → channels); Decisions P1–P10 as approved, with
the reasons; Deviations from issue #1183 and the design ("Decisions recorded" below); Test plan (commands of Tasks 1–8
with pass counts); Known limits (synthetic doorbell, UP-Sense and floodlight fixtures; floodlight motion per P2; values
after adoption are refreshed by UP-8; writes need UP-9); `Closes #1183`; then
`🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

---

## Decisions recorded (for the PR body)

1. Property attributes are read from the spec, not written in the YAML, so a mapping cannot disagree with
   `spec/devices/channels.yaml`; the YAML only names categories, the optional `variant` and the value source.
2. `device_information` is a mapped channel (Homey leaves it to `DeviceConnectivityService`); its status property uses the
   connectivity service's identifier `connection_state` so UP-8's `trySetConnectionState` writes the same row.
3. Not mapped in UP-7: `firmware_revision` (not in the public objects; UP-8 can add it from device frames), the camera
   `speaker` (talkback is out of the MVP, design §10.5), floodlight `isDark` (design §14a), chimes (§10.5).
4. Golden outputs live in `__fixtures__/expected/` (issue file ownership) and `fixtures.spec.ts` runs the sanitization
   checks over them.
5. The fake console gained doorbells, by-id sensor and light reads and stateful RTSPS streams; its defaults are unchanged
   so the UP-5/UP-6 e2e suites still see zero writes.
6. Two read endpoints were added to the client (`sensors/{id}`, `lights/{id}`) for per-item revalidation; they are `GET`
   and do not widen the write surface.

## Self-review

**Spec coverage (issue #1183, design §9, §10, §14a, roadmap UP-7):**

| Requirement | Task |
|---|---|
| YAML definitions + JSON schema for camera, doorbell, UP-Sense, floodlight | 2, 3 |
| Channels only for capabilities (`featureFlags`, sensor settings); one `object_detection`/`sound_detection` per type; `alrmSmoke`/`alrmCmonx` → `smoke`/`carbon_monoxide`; illuminance lux + level | 3 (P1, P3, P4, P9) |
| `GET devices`, `GET devices/{id}`, `POST mapping-preview`, `POST adopt`, `POST adopt/batch` | 4, 5, 6 |
| Preview warnings: stream not enabled, HEVC, third-party, disconnected | 5 (P5) |
| Revalidation, per-device lock, compensating journal, per-item results, partial success, nothing persisted before adoption | 5, 6 (P7) |
| Identity `<nvrMac>:<protectDeviceId>`, re-adoption updates in place, stable channel identifiers | 3, 6 |
| Optional `POST rtsps-stream` with quality, result per item, never deletes | 1, 7 (P6) |
| Golden fixtures per type validated against the spec; e2e preview → adopt on the fake server | 3, 8 |
| Secret rule (key, aliases) with sentinel tests | 1, 3, 5, 7, 8 |
| Never the `generic` category | 2, 3 |

**Step scan:** every code step names its signatures, file, values or the algorithm paragraph that decides the open
choices; test steps list names with exact values; verification steps carry commands and expected output. The adoption
reconciliation is specified as a port of named Homey methods with a substitution table instead of a re-statement of
their bodies.

**Type consistency:** `ProtectModelKey`/`PROTECT_MODEL_KEYS` (Task 2) are used by the inventory, DTOs and preview;
`ProtectStreamAvailability` and `toStreamAvailability` (Task 3) by preview (5) and streams (7); `ProtectFreshDevice`
(4) is `ProtectPreparedMapping.fresh` (5) and supplies the client in 6 and 7; `ProtectRtspsQuality`/
`PROTECT_RTSPS_QUALITIES` (1) in 5 and 7; `ProtectStreamQuality` (existing constant) for request and config quality;
`ProtectConsoleUnavailableError`/`ProtectDeviceNotFoundError`/`ProtectUnsupportedDeviceError` (4) mapped in 4, 5, 6.

**Review Focus:** items 1–5 each name their test (Task 7 union; Task 3 `sensor-leak` and timestamps; Task 6 prune and
name; Task 6/7 fail-closed and skip; Task 3/4 unknown types, type mismatch, duplicate ids).

**Proportion:** 8 tasks for roughly 3,500 lines of source, YAML and tests; the plan carries the mapping tables, signatures,
test names with values and one algorithm paragraph per non-trivial unit, and refers to Homey for the reconciliation body.
