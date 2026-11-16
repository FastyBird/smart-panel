# Cameras — Plan 5c: UniFi Protect floodlight and camera control (UP-9) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Smart Panel users switch an adopted UniFi Protect floodlight on and off, set its brightness and status LED, and
set a camera's or doorbell's status LED and microphone volume from the admin and the panel; each command becomes one
partial `PATCH` per Protect device, is confirmed by the console, and never leaves a value in Smart Panel that the console
did not accept.

**Architecture:** `UnifiProtectDevicePlatform` (`platforms/unifi-protect-device.platform.ts`) is registered for the
`devices-unifi-protect` device type. A pure planner (`platforms/protect-command.ts`) turns a batch into one allow-listed
body per Protect device; the client sends it as `PATCH cameras/{id}` or `PATCH lights/{id}` through its shared rate
pacer; a waiter set (`platforms/protect-confirmation.ts`) confirms it from the next `subscribe/devices` frame the
synchronizer applies, with a by-id `GET` readback as fallback. The platform declares authoritative readback, so the core
never persists the commanded value: the synchronizer stays the only writer of Protect property values.

**Tech Stack:** NestJS 11 on Fastify, TypeORM (SQLite), Jest with fake timers, supertest, the plugin's own HTTPS client
(no new dependency). One spec change (`spec/devices/*.yaml`), no migration.

**Spec:** `docs/superpowers/specs/2026-10-06-unifi-protect-integration-design.md` §4.1, §4.3, §6 (D2, D4, D8, "Spike
results (2026-11-14)"), §10.1, §10.4, §12, §14a, §15, §16. Issue #1185 (epic #1175). Roadmap
`docs/superpowers/plans/2026-11-12-cameras-roadmap.md` §5 "Plan 5" UP-9. Predecessor plans
`docs/superpowers/plans/2026-11-15-cameras-plan-5a-protect-adoption.md` (UP-7, decisions P2 and P9) and
`docs/superpowers/plans/2026-11-15-cameras-plan-5b-protect-realtime.md` (UP-8, decisions R10, R11, R13 and the
amendments). Reference implementation: `apps/backend/src/plugins/devices-homey/platforms/homey-device.platform.ts`
(entity checks, authoritative readback, failure log limiter). UP-5 to UP-8 are merged on `main` (`83f9acd10`); every
interface below is verified on that commit.

---

## Decisions (approved)

The issue, the design, the roadmap, the UP-7/UP-8 plans and the code disagree or leave these open. The plan is written for
each recommendation; *cost if wrong* says what changes. The maintainer approved every recommendation below on 2026-11-16,
unchanged.

**C1. Writable properties, their Protect fields and transforms.** The issue lists five writes; the code adds one mapping
that does not exist yet (C2). Allow-list, keyed by the persisted `protectMappingName`:

| Mapping name | Smart Panel property | Protect `PATCH` | Field | Write transform | Capability (cached console object) |
|---|---|---|---|---|---|
| `light_on` | `light.on` (bool) | `lights/{id}` | `isLightForceEnabled` | identity | `typeof isLightForceEnabled === 'boolean'` |
| `light_brightness` | `light.brightness` (uchar %, 0–100) | `lights/{id}` | `lightDeviceSettings.ledLevel` | C4 | `typeof lightDeviceSettings.ledLevel === 'number'` |
| `floodlight_indicator_on` (new, C2) | `indicator.on` (bool) | `lights/{id}` | `lightDeviceSettings.isIndicatorEnabled` | identity | `typeof lightDeviceSettings.isIndicatorEnabled === 'boolean'` |
| `camera_indicator_on` | `indicator.on` (bool) | `cameras/{id}` | `ledSettings.isEnabled` | identity | `featureFlags.hasLedStatus === true` |
| `microphone_volume` | `microphone.volume` (uchar %, 0–100) | `cameras/{id}` | `micVolume` | identity (integer) | `featureFlags.hasMic === true` |

Everything else is refused before any request (`not_controllable`), including `microphone_active` although the spec
makes `microphone.active` `rw` (`spec/devices/channels.yaml:3035-3044`): the issue does not allow it, and the plugin keeps
away from microphone switching entirely (`disable-mic-permanently` stays unbuildable, `client/protect-endpoints.ts:7`).
Sensors have no writable mapping. **Recommendation: as listed.** *Cost if wrong:* one row in `PROTECT_WRITABLE_MAPPINGS`
(Task 4) and one path in `PROTECT_PATCHABLE_FIELDS` (Task 3).

**C2. Spec and mapping changes.** Verified on `main`: `microphone.volume` is `ro` (`spec/devices/channels.yaml:3045-3064`),
and the `lighting` device allows no `indicator` channel (`spec/devices/devices.yaml:1287-1341`, UP-7 decision P2 chose to
map the floodlight without it). The mapping loader refuses a channel category the device spec does not allow
(`mappings/mapping-loader.service.ts:252`). Options: (a) one `feat(spec)` commit that makes `microphone.volume` `rw` and
allows `indicator` (optional, single) on `lighting`, plus the floodlight indicator mappings; (b) skip the floodlight
indicator and microphone volume (two of the issue's five writes). **Recommendation: (a)**, as Task 1 (spec, its own commit)
and Task 2 (mappings). **No migration:** property permissions are a plain `text` column and channel-per-device rules are
code-level spec, not database constraints (`migrations/1000000000000-InitialSetup.ts:21`; the `indicator` channel category
already exists for cameras). Already adopted devices keep `ro` on `microphone.volume` and have no floodlight `indicator`
channel until re-adopted (`POST adopt` again: `propertyMetadataChanged` compares permissions,
`services/protect-adoption.service.ts:737-751`); until then the device validator reports a `warning`, not an error
(`modules/devices/services/device-validation.service.ts:719-740`), and the platform refuses the write because the stored
permission is `ro`. No other plugin maps `microphone` (verified by search), so the blast radius is the Protect plugin and
the regenerated admin and panel specs. Floodlight `motion` (P2's other half) stays out: UP-8 R3 leaves `lightMotion`
unmapped. *Cost if wrong:* if the maintainer prefers (b), drop Tasks 1–2 and two allow-list rows.

**C3. `light.on` reads `isLightOn` but writes `isLightForceEnabled`.** The design (§10.4) and the issue agree on writing
`isLightForceEnabled`; the UP-7 mapping reads the physical state `isLightOn` (`mappings/definitions/properties.yaml:273-279`).
Options: (a) keep the read mapping and confirm a command by the **fields it sent** (`isLightForceEnabled`), never by the
mapped value; (b) read `light.on` from `isLightForceEnabled` too. **Recommendation: (a).** `light.on` keeps showing whether
the light shines. Consequence: "off" while the PIR keeps the light lit is confirmed (the force flag is off) and
`light.on` stays `true` until motion ends — truthful, and the panel shows it. *Cost if wrong:* (b) is a one-line YAML change
plus a golden update, and the floodlight would show "off" while lit.

**C4. `ledLevel` 1–6 ↔ percentage.** Read (UP-7 P9, unchanged): `round(level × 100 / 6)` → 17, 33, 50, 67, 83, 100. Write:
`ledLevel = min(6, max(1, round(percent × 6 / 100)))` — the nearest level, ties up (`Math.round`), 0–8 % → 1. Every level
round-trips (17→1, 33→2, 50→3, 67→4, 83→5, 100→6). A request between levels is accepted and the console's level is what
gets stored (40 → level 2 → `33`). `brightness 0` does **not** switch the light off (that is `light.on`). Options rejected:
refusing values that are not a level (breaks every slider), mapping 0 to off (two fields for one property). Known limit:
the panel's optimistic layer shows the requested 40 until a report that differs from its settled value arrives
(`docs/optimistic-ui-architecture.md`, MIXED state); the admin shows 33 at once. **Recommendation: as listed.** *Cost if
wrong:* one function in Task 4.

**C5. PATCH body and the allow-list.** Body = only the commanded leaf fields, nested as partial objects:
`{ "lightDeviceSettings": { "ledLevel": 3 } }`, `{ "ledSettings": { "isEnabled": true }, "micVolume": 60 }`. Never the
cached sibling fields (`ledSettings.welcomeLed`, `floodLed`, `pirSensitivity`, …), so a stale cache can never overwrite a
setting Smart Panel does not control. The allow-list is enforced twice: by the planner (mapping names, Task 4) and by the
client, which refuses any body leaf outside `PROTECT_PATCHABLE_FIELDS` or any non-boolean/non-integer value before a byte
is sent (Task 3). The PATCH response body is bounded by the transport and discarded: it is neither confirmation nor fed to
the synchronizer, because its content is unverified and a frame can overtake it. **Unverified:** that the console accepts
nested partial objects and echoes setting changes on `subscribe/devices` — no floodlight or setting change was captured
(`__fixtures__/README.md`: `lights.json` and every frame are synthetic; the new `device-patch.json` is synthetic too).
UP-20 (hardware acceptance) verifies both. **Recommendation: as listed.** *Cost if wrong:* if the console needs whole
sub-objects, `buildProtectPatchBody` merges the cached sub-object (one function); if it sends no frame, every command takes
the `GET` path (+~1 request, C7).

**C6. PATCH retry policy.** The PATCH carries absolute values, so it is idempotent, but a 5xx or timeout leaves the outcome
unknown. Options: (a) retry `429` only (honouring `Retry-After` through the pacer, at most 3 attempts inside the PATCH
budget) plus the client's existing one-shot retry of a reset pooled socket (`client/protect-api.client.ts:631`); resolve
`408`, 5xx, timeouts and connection failures by a `GET` readback instead of a blind retry; (b) the read policy (408, 429,
5xx). **Recommendation: (a)**, the same rule as the stream POST (`STREAM_CREATE_RETRY_STATUSES`, `:64`). Definitive
answers (`400` and other 4xx → `rejected`, `401`/`403` → `unauthorized`, `404` → `not_found`, `429` after retries →
`rate_limited`) end the command without a readback. *Cost if wrong:* the retry set is one constant.

**C7. Confirmation window, fallback and budgets.**
- A waiter for the sent fields is armed **before** the PATCH; any cache change the synchronizer applies for that device
  (frame, snapshot, readback) is checked against it.
- After a `2xx`: confirmed at once if the waiter already matched or the current cache shows every sent field (also covers a
  no-op command the console does not echo). Otherwise, while realtime is `streaming`, wait up to **3 000 ms** for a
  matching frame; while it is not (`connecting`, `priming`, `polling`), wait **500 ms**. Then one `GET cameras/{id}` or
  `GET lights/{id}` (deadline **4 000 ms**, read retry policy); its object goes to the synchronizer as an authoritative
  readback (C8) and confirms when every sent field matches.
- PATCH deadline **5 000 ms** (new `deadlineMs` call option; the default 30 s deadline is for reads).
- Results per command: `confirmed`, or a failure (C11). A `2xx` without confirmation is `not_confirmed`; an ambiguous
  failure whose readback matches is `confirmed` (the change landed).
- Run budget 5 000 + 3 000 + 4 000 = **12 000 ms**; queue wait (C9) at most **12 000 ms**; `getCommandTimeoutMs(n)` returns
  **24 000** for `n > 0` (one PATCH per device whatever `n`), 0 otherwise.
**Recommendation: as listed.** The 3 s frame window is generous: UP-8 applies frames within a second (Plan 5b goal). *Cost
if wrong:* constants in Task 4.

**C8. Interplay with the core command windows and the UP-8 synchronizer.** Verified: when a platform's
`usesAuthoritativePropertyReadback(property)` is true, the REST controller does not persist the requested value
(`modules/devices/controllers/channels.properties.controller.ts:400-415`, same in `devices.channels.properties.controller.ts:437`)
and the dispatcher opens no command window (`eligible: (writable && !authoritative)`,
`services/property-command-dispatch.service.ts:1094-1103`). Homey does the same (`homey-device.platform.ts:111-125`).
**Recommendation:** the platform answers `true` for every `ProtectChannelPropertyEntity`. Consequences:
- The synchronizer is the only writer of Protect values. A rejected or unconfirmed command changes nothing stored; the
  panel's optimistic layer rolls back on the failed intent (`IntentTargetStatus.FAILED`,
  `services/property-command.service.ts:593`).
- `lastWritten` keeps meaning "last value the synchronizer persisted" (`services/protect-synchronizer.service.ts:120`); no
  optimistic value ever reaches `recordPersistedValue` (`:272-283`), so a frame that carries the old value while a command is
  in flight is a no-op, and the frame with the new value is written by the ordinary diff (`writeChanges`, `:1054-1092`).
- Event ownership and the event retry queue are untouched: every writable mapping is a `path` source in
  `syncableMappingNames` and none is event-driven (`STALE_DETECTIONS`, `TAMPER_MAPPINGS`, `:92-102`); Task 4 asserts it.
- The `GET` readback enters the synchronizer's serial queue as an authoritative object for that one device (the semantics of
  an `add` frame, `:376-446`), and is discarded when a frame for the same device was applied after the `GET` was issued
  (per-device sequence, Task 5), so an older readback can never overwrite a newer frame.
*Cost if wrong:* optimistic mode would need window-aware rollback in the platform; switching is one method.

**C9. Batching and ordering per device.**
- The whole batch is validated first; one refused property refuses the batch with no request (fail closed, as Homey,
  `homey-device.platform.ts:297-327`).
- One PATCH per Protect device; fields keep the order of `PROTECT_PATCHABLE_FIELDS`. Duplicate updates of one property
  with one value collapse; two values for one property or field refuse the batch (`conflict`; the core already refuses
  this per canonical property, `property-command-dispatch.service.ts:1060-1071`).
- Devices of one batch run one after another in first-seen order; after the first failed device the rest are `skipped`.
- Per Protect device, batches run FIFO: a second command for the same floodlight starts after the first is confirmed or
  failed, so confirmations never interleave. At most 4 batches wait per device; a fifth, or one waiting longer than
  12 000 ms, is `busy`.
**Recommendation: as listed.** *Cost if wrong:* superseding queued commands (slider drags) is an optimisation inside the
queue.

**C10. Degraded realtime and a disconnected console.**
- Connector not connected (`getClient()` or `getConsoleIdentity()` null, `services/protect-connector.service.ts:199-209`) or
  the device's `protectNvrId` differs from the console: `unavailable`, no request, nothing queued for later (a stale
  "turn on" must never fire minutes later).
- Device not in the synchronizer cache (not primed yet) or its cached `state !== 'CONNECTED'`: `unavailable`, no request.
  The core already refuses devices whose connection state is offline (`property-command.service.ts:716-725`).
- Realtime `polling`, `connecting` or `priming` (`services/protect-realtime.service.ts:138`): commands are sent; confirmation
  is the 500 ms settle plus `GET` (C7).
- The session ends mid-command (connector stop, reconfiguration, console lost): every waiter resolves false, no further
  request is made for the batch, the outcome is `unavailable`.
**Recommendation: as listed.** *Cost if wrong:* local to the platform.

**C11. Errors per property.** The core contract is one boolean per device batch (`IDevicePlatform.processBatch`,
`modules/devices/platforms/device.platform.ts:59`), turned into one `FAILED` intent result per property with the reason
`Execution failed`. Options: (a) keep the contract; the platform computes an outcome per property
(`confirmed | not_controllable | invalid_value | conflict | unavailable | busy | rejected | unauthorized | not_found |
rate_limited | failed | not_confirmed | skipped`), returns `true` only when all are `confirmed`, logs each failure with the
property id, mapping name and outcome (fixed text, rate-limited like the synchronizer's write failures,
`protect-synchronizer.service.ts:1297-1311`), and exposes the outcomes through a public `executeBatch()` for tests;
(b) change the core to carry per-property reasons. **Recommendation: (a).** A Protect PATCH is atomic per device, so every
property of one device shares one outcome anyway. *Cost if wrong:* (b) is a core change across every platform.

**C12. Scope.** UP-9 only, 8 tasks: spec, mappings, client and fake console, planner, synchronizer hooks, confirmation
waiters, platform, e2e. Outside the issue's file ownership (`platforms/**`, plugin registration, tests) and listed in the PR
body: the spec change (C2), the floodlight indicator mappings and goldens (C2), the client PATCH (C5, C6), the
synchronizer hooks (C8), the fake console's PATCH, the readme. UP-10 (stream provider, `camera.status`/`camera.source`) and
the admin controls (UP-12) are later plans. **Recommendation: as listed.**

---

## Global Constraints

- Branch `feat/unifi-protect-control`, cut from `main`. One PR titled exactly
  `feat(backend): control UniFi Protect floodlights and camera settings`, body ending with `Closes #1185`. Never push to
  `main`; the final task writes the PR body to a file and does not push.
- Commits `<type>(<scope>): <lowercase imperative subject>`, header ≤ 100 characters, scope `spec` for `spec/**` (its own
  commit, Task 1), `backend` for `apps/backend/**`, `tasks` for `tasks/**`; each ends with
  `Co-Authored-By: <model that wrote it> <noreply@anthropic.com>`. The PR body ends with
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- TypeScript: tabs, single quotes, semicolons, trailing commas, print width 120; imports external, then `../`, then `./`,
  blank line between groups.
- Never use the `generic` device category. Never edit generated files (`spec/api/v1/openapi.json`,
  `apps/admin/src/openapi.ts`, `apps/backend/src/spec`, `apps/admin/src/spec`, `apps/panel/lib/api`, `apps/panel/lib/spec`;
  all git-ignored); regenerate them locally only. No migration (C2). No new route, so no API convention work.
- Allowed console writes: only `PATCH cameras/{id}` and `PATCH lights/{id}` with leaves from `PROTECT_PATCHABLE_FIELDS`
  (C1, C5), plus UP-7's existing `POST rtsps-stream`. Never `DELETE`, never another endpoint, never
  `disable-mic-permanently` (`client/protect-endpoints.ts` refuses it).
- Every console request goes through `ProtectApiClient` and its rate pacer (`client/protect-rate-pacer.ts`, 80 % of the
  advertised 10 requests/s, design §4.3); the platform never builds its own HTTP call.
- Secret rule (design §4.3/§9.4): the API key and every RTSPS URL or alias never reach a log line, an error, a response, a
  property value, an event, a notification or a database row. PATCH failures are `ProtectApiError`s carrying the endpoint
  template (`lights/{id}`) and a category only; request and response bodies are never logged. Sentinels: key
  `FAKE_PROTECT_API_KEY` (`PROTECT_SENTINEL_KEY_7f3a9c0d1e2b4a6f`), aliases starting `SENTINELALIAS`
  (`test/support/fake-protect-server.ts:21-25`).
- Timers are `unref()`ed and cleared on session end and module destroy; unit tests use `jest.useFakeTimers()`, fake clients
  and fake synchronizers — never a real console or network. Integration and e2e tests use
  `test/support/fake-protect-server.ts` only.
- Setup once per worktree: `pnpm run bootstrap`. Single test files run with `pnpm --filter ./apps/backend exec jest <path>`;
  e2e with `--config ./test/jest-e2e.json`.

### Verified facts (on `main` `83f9acd10`)

| # | Fact | Where |
|---|---|---|
| F1 | `IDevicePlatform`: `process`, `processBatch(updates): Promise<boolean>`, `getType()`, optional `getCommandTimeoutMs(commandCount)`, `usesAuthoritativePropertyReadback(property)`, `prepareBatch` (declared, never called by the core). `PlatformRegistryService.register(platform)` keys by `getType()`. | `modules/devices/platforms/device.platform.ts:54-78`; `modules/devices/services/platform.registry.service.ts:20-48, 80-99` |
| F2 | The core groups commands per device, refuses offline devices, non-writable properties and invalid values before the platform, and maps the boolean to one intent result per property (`Execution failed`). `executePropertyCommands([{ propertyId, value }])` returns `{ success, results }`. | `services/property-command.service.ts:307-480, 585-612, 695-816` |
| F3 | Authoritative readback: no optimistic persistence (REST) and no command window (dispatch). | `controllers/channels.properties.controller.ts:400-415`; `devices.channels.properties.controller.ts:437`; `services/property-command-dispatch.service.ts:982-984, 1094-1103` |
| F4 | Homey: `instanceof` entity checks, `device.enabled`, channel/property references, `READ_WRITE`/`WRITE_ONLY` permission, `validatePropertyCommandValue`, fail-closed batch, `HomeyFailureLogLimiter`, registration `platformRegistry.register(...)` in `onModuleInit`. | `devices-homey/platforms/homey-device.platform.ts:91-125, 271-372`; `devices-homey/devices-homey.plugin.ts:275`; `modules/devices/utils/property-command-value.utils.ts:102` |
| F5 | Client: one `execute` for every call, method union `'GET' \| 'POST'`, retry sets `RETRY_STATUSES` (408/429/5xx), `STREAM_CREATE_RETRY_STATUSES` (429), `SNAPSHOT_RETRY_STATUSES`; one-shot `ECONNRESET` retry; every call uses `deadlineMs` 30 s; logs `<METHOD> <endpoint template> <status> <ms>`; `ProtectCallOptions = { signal? }`. `PROTECT_ENDPOINTS` already holds `cameras/{id}` and `lights/{id}`. | `client/protect-api.client.ts:58-66, 557-670, 686-688`; `client/protect-http.transport.ts:9`; `devices-unifi-protect.constants.ts:89-102` |
| F6 | `mapProtectHttpStatus`: 400 → `bad_request`, 401 → `authentication`, 403 → `authorization`, 404 → `not_found`, 408 → `timeout`, 429 → `rate_limited`, 500/502/503/504 → `unavailable`, other → `protocol` (status kept on the error). | `client/protect-api.client.ts:88-127`; `errors/protect-api.error.ts` |
| F7 | Mappings: `light_on` = `path: isLightOn`; `light_brightness` = `lightDeviceSettings.ledLevel`, `scale [0,6]→[0,100]`, round; `camera_indicator_on` = `ledSettings.isEnabled` (channel `camera_indicator`, `when featureFlags.hasLedStatus`); `microphone_volume` = `micVolume`, round, variant `percentage`; `microphone_active` = `isMicEnabled`. No floodlight indicator mapping; floodlight channels `device_information`, `light`. | `mappings/definitions/properties.yaml:141-164, 273-292`; `channels.yaml:86-100, 166-171` |
| F8 | Synchronizer: private `cache` keyed `<modelKey>\u0000<id>` (`:112`), replaced by snapshots (`:355`), set by frames (`:433`); serial `run()` queue (`:296-319`); `lastWritten`, `eventOwned`, `recordPersistedValue`; `syncDevice(..., 'snapshot' \| 'frame', partial)`; no public accessor for the cache and no change listener. | `services/protect-synchronizer.service.ts` |
| F9 | Realtime `getState()` returns `stopped \| connecting \| priming \| streaming \| polling`; the connector's `onSessionChange(listener)` reports `(session, null)` on connect and `(null, 'lost' \| 'stopped')` on end. | `services/protect-realtime.service.ts:138-140`; `services/protect-connector.service.ts:36-45, 199-221` |
| F10 | Entities: device `protectNvrId`, `protectDeviceId`, `protectModelKey` (nullable); property `protectMappingName`. | `entities/devices-unifi-protect.entity.ts:21-106` |
| F11 | Fixtures: `cameras.json` (captured) — both cameras `ledSettings { isEnabled: false, welcomeLed, floodLed }`, `micVolume 100`, `featureFlags.hasLedStatus/hasMic true`; `lights.json` (synthetic) — `isLightForceEnabled false`, `lightDeviceSettings { isIndicatorEnabled: true, ledLevel: 6, … }`. No PATCH was ever captured; `fixtures.spec.ts` requires every file to be classified and listed in the README. | `__fixtures__/` |
| F12 | Fake console: reads a body only for `POST` (`:297`), answers other non-GET methods `405` (`:365-369`), shallow overlay (`updateDevice`, `:185-190`, applied in `visible` and by-id reads, `:528-583`), `writes` records every non-GET request (`:331-333`), `enqueue(match, response, method?)` (`:266`). | `apps/backend/test/support/fake-protect-server.ts` |
| F13 | Device spec: `lighting` channels `light, device_information, electrical_energy, electrical_power, illuminance, button, binary_input, analog_input, temperature`; `camera`/`doorbell` allow `indicator`; `microphone.volume` `ro`; `indicator.on` `rw`; `light.on`/`brightness` `rw`. CI runs `node spec/devices/validate.mjs`. | `spec/devices/devices.yaml:685-690, 1259-1341`; `spec/devices/channels.yaml:1949-1990, 3026-3064, 3559-3576`; `.github/workflows/ci-tests.yaml:469` |
| F14 | Plugin: registers the connector as managed service, no platform; the readme's Boundaries say the plugin "never changes other console settings"; the plugin spec asserts readme sections and the provider list. | `devices-unifi-protect.plugin.ts:86-115, 206-269`; `devices-unifi-protect.plugin.spec.ts:131-226` |
| F15 | Goldens are regenerated with `PROTECT_UPDATE_GOLDEN=1` and record each property's permissions; the floodlight golden's channels are `['device_information', 'light']`. | `mappings/protect-mappings.spec.ts:111-118, 141-172`; `__fixtures__/expected/` |

## Review Focus

Failure modes the spec implies but no acceptance criterion exercises, most likely first; each is pinned by a named test in
the task at the end of the line.

1. **The console accepts the PATCH but never sends a frame** (it may not echo setting changes, or the socket dropped mid
   command): the command is confirmed from the `GET` readback and the stored value follows the console. → Task 7 `falls
   back to a GET readback after 3 s without a frame`, Task 8 `confirms by GET when the console sends no frame`.
2. **A slider sends several brightness commands to one floodlight in a row**: one PATCH each, in order, no interleaved
   confirmations, the last value is what ends up stored; a burst beyond the queue fails fast. → Task 7 `runs commands for
   one device one after another`, `refuses a fifth waiting batch as busy`.
3. **A brightness between two levels, 0 or 100**: nearest level, never 0 or 7, and the stored value is the level's
   percentage. → Task 4 `maps percentages to the nearest LED level`, `round-trips every level`; Task 8 `sends brightness
   and the status LED of one floodlight in one PATCH`.
4. **The console rejects the change, or the plugin stops mid-command**: the stored value never shows the requested value,
   nothing hangs, no request follows the session end. → Task 7 `fails a rejected PATCH without a readback`, `ends pending
   confirmations when the session ends`; Task 8 `keeps the stored value when the console rejects the change`, `answers a
   REST property PATCH without writing the requested value`.
5. **A write to anything outside the allow-list** (`microphone.active`, a read-only property, a sensor, a camera without
   `hasLedStatus`, a property whose mapping name is unknown) or a body leaf outside it: no request at all. → Task 3
   `refuses a body outside the allow-list without a request`, Task 4 `refuses every mapping outside the allow-list`, Task 8
   `never sends a PATCH for a property outside the allow-list`.

---

## File structure

All paths under `apps/backend/src/plugins/devices-unifi-protect/` unless stated.

| Path | Responsibility | Task |
|---|---|---|
| `spec/devices/channels.yaml`, `spec/devices/devices.yaml` (repo root, modify) | `microphone.volume` `rw`; `indicator` on `lighting` | 1 |
| `__fixtures__/expected/*.json` (regenerate) | permissions and the floodlight indicator in the goldens | 1, 2 |
| `mappings/definitions/channels.yaml`, `properties.yaml` (modify) | `floodlight_indicator`, `floodlight_indicator_on` | 2 |
| `mappings/protect-mappings.spec.ts` (modify) | floodlight channels and values | 2 |
| `__fixtures__/ws-devices.jsonl`, `device-patch.json` (new), `README.md`, `fixtures.spec.ts` | synthetic control frames and PATCH shapes | 2, 3 |
| `client/protect-patch.ts` (new) | `PROTECT_PATCHABLE_FIELDS`, body validation | 3 |
| `client/protect-http.transport.ts`, `client/protect-api.client.ts` (modify) | `PATCH`, `patchDevice()`, `deadlineMs` | 3 |
| `apps/backend/test/support/fake-protect-server.ts` (modify) | PATCH handling, deep overlay, `patches`, `echoPatches` | 3 |
| `devices-unifi-protect.constants.ts` (modify) | command budgets and limits | 4 |
| `platforms/protect-command.ts` (new) | pure allow-list, transforms, planning, body, field match | 4 |
| `services/protect-synchronizer.service.ts` (modify) | cache accessor, change observers, per-device sequence, readback | 5 |
| `platforms/protect-confirmation.ts` (new) | confirmation waiters | 6 |
| `platforms/unifi-protect-device.platform.ts` (new) | the platform | 7 |
| `devices-unifi-protect.plugin.ts`, `devices-unifi-protect.plugin.spec.ts` (modify) | provider, registration, readme | 7 |
| `apps/backend/test/devices-unifi-protect-control.e2e-spec.ts` (new) | commands end to end | 8 |
| `tasks/epics/EPIC-UNIFI-PROTECT.md:104` (modify) | `UP-9 (done)` | 8 |

Specs sit next to their source (`*.spec.ts`). Each task ends green and committed.

---

### Task 1: Spec — writable microphone volume and a lighting status indicator

**Files:**
- Modify: `spec/devices/channels.yaml` (`microphone.volume`, `:3045-3064`), `spec/devices/devices.yaml` (`lighting.channels`, after `temperature`, `:1336-1341`)
- Regenerate (commit): `apps/backend/src/plugins/devices-unifi-protect/__fixtures__/expected/camera.json`, `doorbell.json`, `doorbell-package.json`
- Regenerate locally only: backend, admin and panel specs

**Interfaces:**
- Consumes: F13, F15.
- Produces: `microphone.volume` `permissions: [rw]` (both data-type variants unchanged); `lighting.channels.indicator`
  `{ category: indicator, required: false, multiple: false, description.en: <the camera's indicator text, devices.yaml:690> }`.
  Task 2 and Task 4 rely on both.

- [ ] **Step 1: Bootstrap**

Run: `pnpm run bootstrap`
Expected: exit 0; `apps/backend/src/spec/` exists.

- [ ] **Step 2: Edit the two YAML files** as listed under Produces. Description of `microphone.volume` unchanged.

- [ ] **Step 3: Validate and regenerate**

```bash
node spec/devices/validate.mjs
pnpm run generate:spec
pnpm run generate:openapi
melos rebuild-all && melos analyze
pnpm --filter ./apps/admin run type-check
git status --short
```
Expected: `✅ All specifications are valid`; every command exits 0; `git status` lists only the two YAML files (generated
files are ignored). If `melos` is not installed on the machine, record that in the PR body's test plan and continue.

- [ ] **Step 4: Commit the spec alone**

```bash
git add spec/devices/channels.yaml spec/devices/devices.yaml
git commit -m "feat(spec): allow writing microphone volume and a status indicator on lighting devices"
```

- [ ] **Step 5: Refresh the goldens and run the affected suites**

Run:
```bash
cd apps/backend
PROTECT_UPDATE_GOLDEN=1 pnpm exec jest src/plugins/devices-unifi-protect/mappings/protect-mappings.spec.ts
git diff --stat src/plugins/devices-unifi-protect/__fixtures__/expected
pnpm exec jest src/plugins/devices-unifi-protect src/modules/devices/services/device-validation.service.spec.ts
```
Expected: the diff touches only `camera.json`, `doorbell.json`, `doorbell-package.json`, and inside each only the
`microphone` `volume` property's `"permissions"` (`["ro"]` → `["rw"]`); every suite PASSES.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/plugins/devices-unifi-protect/__fixtures__/expected
git commit -m "test(backend): refresh UniFi Protect goldens for the writable microphone volume"
```

---

### Task 2: Floodlight status LED mapping and synthetic control frames

**Files:**
- Modify: `mappings/definitions/channels.yaml` (append after `floodlight_light`), `mappings/definitions/properties.yaml` (append at the end), `mappings/protect-mappings.spec.ts`, `__fixtures__/ws-devices.jsonl`, `__fixtures__/README.md`
- Regenerate (commit): `__fixtures__/expected/floodlight.json`
- Test: `mappings/protect-mappings.spec.ts`, `services/protect-frame-merge.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`indicator` allowed on `lighting`).
- Produces (mapping names are persisted identity, never renamed later):
  ```yaml
  # channels.yaml
  - name: floodlight_indicator
    devices: [floodlight]
    when:
      - { path: lightDeviceSettings.isIndicatorEnabled, exists: true }
    channel:
      identifier: 'indicator'
      category: indicator
      name: 'Status LED'
  # properties.yaml
  - name: floodlight_indicator_on
    channel: floodlight_indicator
    property:
      identifier: 'on'
      category: 'on'
    value:
      path: 'lightDeviceSettings.isIndicatorEnabled'
  ```
  Synthetic frames appended to `ws-devices.jsonl` (each with `"_synthetic":true`), used by Tasks 5, 7 and 8:
  ```json
  {"_synthetic":true,"type":"update","item":{"id":"5f0000000000000000000c01","modelKey":"light","isLightForceEnabled":true,"isLightOn":true}}
  {"_synthetic":true,"type":"update","item":{"id":"5f0000000000000000000c01","modelKey":"light","lightDeviceSettings":{"ledLevel":3,"isIndicatorEnabled":false}}}
  {"_synthetic":true,"type":"update","item":{"id":"600cefafd5f365d6f83c4ef3","modelKey":"camera","micVolume":60}}
  ```
  README `ws-devices.jsonl` row gains: `floodlight force-on, LED level and indicator, camera microphone volume`.

- [ ] **Step 1: Write the failing tests**

`protect-mappings.spec.ts`: the `floodlight` golden's `channels` becomes `['device_information', 'light', 'indicator']`;
`maps the floodlight values` adds `expect(value(device, 'indicator', 'on')).toBe(true);`; new test:
```ts
it('creates no floodlight indicator when the console omits the field', ...);
// lights.json[0] with lightDeviceSettings.isIndicatorEnabled deleted -> channels ['device_information', 'light']
```
`protect-frame-merge.spec.ts`:
```ts
it('diffs the floodlight control fields of a recorded frame', ...);
// evaluate lights.json[0] (baseline) vs merge with the ledLevel/isIndicatorEnabled frame:
// changes toEqual [{ channelIdentifier: 'light', mappingName: 'light_brightness', value: 50 },
//                  { channelIdentifier: 'indicator', mappingName: 'floodlight_indicator_on', value: false }]
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/mappings src/plugins/devices-unifi-protect/services/protect-frame-merge.spec.ts src/plugins/devices-unifi-protect/__fixtures__`
Expected: FAIL (channel list, missing indicator); the fixtures suite PASSES.

- [ ] **Step 3: Add the YAML, the frames and the README row; regenerate the floodlight golden** with
`PROTECT_UPDATE_GOLDEN=1` on `protect-mappings.spec.ts`. Expected golden diff: one new `indicator` channel (`mappingName`
`floodlight_indicator`, property `on`, `permissions ["rw"]`, value `true`) and nothing else.

- [ ] **Step 4: Run to verify pass** — the Step 2 command. Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect
git add apps/backend/src/plugins/devices-unifi-protect
git commit -m "feat(backend): map the UniFi Protect floodlight status LED"
```

---

### Task 3: Client PATCH with a field allow-list, and the fake console's PATCH

**Files:**
- Create: `client/protect-patch.ts`, `__fixtures__/device-patch.json`
- Modify: `client/protect-http.transport.ts:9`, `client/protect-api.client.ts`, `__fixtures__/README.md`, `__fixtures__/fixtures.spec.ts` (`SYNTHETIC_JSON`), `apps/backend/test/support/fake-protect-server.ts`
- Test: `client/protect-patch.spec.ts` (new), `client/protect-api.client.spec.ts`, `client/protect-api.client.integration.spec.ts`

**Interfaces:**
- Consumes: F5, F6, F12.
- Produces:
  ```ts
  // client/protect-patch.ts
  export const PROTECT_PATCH_RESOURCES = ['cameras', 'lights'] as const;
  export type ProtectPatchResource = (typeof PROTECT_PATCH_RESOURCES)[number];
  /** The only leaves a PATCH may carry (C1, C5), in body order. */
  export const PROTECT_PATCHABLE_FIELDS: Readonly<Record<ProtectPatchResource, readonly string[]>> = {
  	cameras: ['ledSettings.isEnabled', 'micVolume'],
  	lights: ['isLightForceEnabled', 'lightDeviceSettings.ledLevel', 'lightDeviceSettings.isIndicatorEnabled'],
  };
  /** True when the body is a non-empty plain object, depth ≤ 2, every leaf path is allow-listed for the resource and every leaf is a boolean or a safe integer 0–100. */
  export function isAllowedProtectPatch(resource: ProtectPatchResource, body: unknown): body is Record<string, unknown>;

  // client/protect-http.transport.ts
  method: 'GET' | 'POST' | 'PATCH';

  // client/protect-api.client.ts
  export interface ProtectCallOptions { signal?: AbortSignal; /** Shortens the call's overall deadline (never extends the 30 s default). */ deadlineMs?: number }
  /** Sends the allow-listed partial body as PATCH <resource>/{id}; resolves on 2xx, discards the body. Retries 429 only. */
  async patchDevice(resource: ProtectPatchResource, deviceId: string, body: Readonly<Record<string, unknown>>, options?: ProtectCallOptions): Promise<void>;

  // test/support/fake-protect-server.ts
  readonly patches: { resource: 'cameras' | 'lights'; id: string; body: Record<string, unknown> }[];
  echoPatches(enabled: boolean): void; // default false; true: after a 200, one devices `update` frame {id, modelKey, ...body} to every open devices socket
  ```
- `device-patch.json` (synthetic, top-level `"_synthetic": true`): `{ "camera": { "request": { "ledSettings": { "isEnabled":
  true }, "micVolume": 60 }, "response": <cameras.json[0] with those values> }, "light": { "request": { "isLightForceEnabled":
  true, "lightDeviceSettings": { "ledLevel": 3, "isIndicatorEnabled": false } }, "response": <lights.json[0] merged, isLightOn
  true> } }`. README row: `synthetic | PATCH cameras/{id} and lights/{id} request and response shapes (UP-9), unverified`.
- Client rules (decided): `patchDevice` throws `VALIDATION` (operation `<resource>/{id}`) with no request when the resource
  is not in `PROTECT_PATCH_RESOURCES` or `isAllowedProtectPatch` is false; otherwise `execute(endpoint, { id }, { method:
  'PATCH', body: JSON, accept: 'application/json', maxBytes: PROTECT_MAX_JSON_BYTES, retryStatuses: [429] })`.
  `execute` computes `deadlineAt = startedAt + Math.min(this.deadlineMs, options.deadlineMs ?? Infinity)`. The class
  docstring becomes "reads, the stream-creation POST and allow-listed PATCHes".
- Fake console rules (decided): `handle()` reads bodies for `POST` and `PATCH`. `PATCH` routes only `cameras/{id}` and
  `lights/{id}` (else 404), checks the key (401), the rate limit (429) and queued responses like a GET, then: body not a JSON
  object → `400 {"error":"Invalid body","name":"BAD_REQUEST"}`; unknown or removed id → 404; otherwise deep-merges the body
  into the device's current object (fixture + overlay), stores every top-level key it touched in the overlay, and — synthetic
  console rule — copies `isLightForceEnabled` into `isLightOn`; answers `200` with the merged object; records `patches`.
  `reset()` clears `patches` and turns echo off.

- [ ] **Step 1: Write the failing unit tests**

`protect-patch.spec.ts`:
```ts
it.each([
	['cameras', { ledSettings: { isEnabled: true } }], ['cameras', { micVolume: 60 }],
	['lights', { isLightForceEnabled: false, lightDeviceSettings: { ledLevel: 6, isIndicatorEnabled: true } }],
])('accepts %s %j', ...);
it.each([
	['cameras', {}], ['cameras', { isMicEnabled: false }], ['cameras', { ledSettings: { isEnabled: true, floodLed: true } }],
	['cameras', { micVolume: '60' }], ['cameras', { micVolume: 1.5 }], ['cameras', { micVolume: 101 }],
	['cameras', { ledSettings: true }], ['lights', { lightDeviceSettings: { ledLevel: 3, pirSensitivity: 50 } }],
	['lights', { name: 'x' }], ['sensors', { mountType: 'door' }], ['lights', JSON.parse('{"__proto__":{"isLightForceEnabled":true}}')],
])('refuses %s %j', ...);
it('matches the documented synthetic request shapes', ...); // device-patch.json camera.request / light.request accepted
```
`protect-api.client.spec.ts` (with the existing `FakeTransport`):
```ts
it('patches a camera with a JSON body to cameras/{id}', ...); // one request: method 'PATCH', path '/proxy/protect/integration/v1/cameras/<id>', body JSON equals the input, header X-API-KEY
it('refuses a body outside the allow-list without a request', ...); // { isMicEnabled: false } -> 'validation'; transport.requests.length 0
it('retries a PATCH 429 but not a 408, 500 or 503', ...); // 429 then 200 -> 2 requests; each of 408/500/503 -> 1 request, categories timeout/unavailable/unavailable
it('maps PATCH 400, 403 and 404', ...); // bad_request (status 400), authorization, not_found
it('ends a PATCH at its shorter deadline', ...); // deadlineMs 5000, transport hangs -> 'timeout' after 5000 (fake timers)
it('paces a PATCH through the same pacer as reads', ...); // spy on pacer.acquire: listLights then patchDevice -> 2 acquisitions
it('never logs the body', ...); // logger spies: a line 'PATCH lights/{id} 200 <n>ms'; no 'ledLevel', no key
```

- [ ] **Step 2: Write the failing integration tests** (`protect-api.client.integration.spec.ts`, real client against
  `FakeProtectServer`, pinned fingerprint as the existing tests do)

```ts
it('patches a light and reads the merged object back', ...);
// patchDevice('lights', '5f0000000000000000000c01', { lightDeviceSettings: { ledLevel: 3 } }) -> fake.patches[0].body equal;
// getLight(...).raw.lightDeviceSettings toEqual { ...lights.json[0].lightDeviceSettings, ledLevel: 3 } (siblings kept)
it('echoes a patch as a device frame when enabled', ...); // echoPatches(true); open devices subscription; patch isLightForceEnabled true -> frame item { id, modelKey: 'light', isLightForceEnabled: true, isLightOn: true }
it('answers a queued PATCH failure', ...); // enqueue(/lights\//, { status: 400, body: '{"error":"x","name":"BAD_REQUEST"}' }, 'PATCH') -> 'bad_request'; fake.patches empty
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/client src/plugins/devices-unifi-protect/__fixtures__`
Expected: FAIL (`protect-patch` not found, `patchDevice is not a function`); the fixture suite FAILS until `device-patch.json`
is classified.

- [ ] **Step 4: Implement** `protect-patch.ts`, the transport union, `deadlineMs`, `patchDevice`, the fixture with its README
  row and `SYNTHETIC_JSON` entry, and the fake console rules. Deep merge in the fake skips `__proto__`, `constructor`,
  `prototype`.

- [ ] **Step 5: Run to verify pass**

Run: the Step 3 command, then
`pnpm --filter ./apps/backend exec jest --config ./test/jest-e2e.json test/devices-unifi-protect.e2e-spec.ts test/devices-unifi-protect-adoption.e2e-spec.ts test/devices-unifi-protect-realtime.e2e-spec.ts`
Expected: PASS; the existing suites are unchanged (no one patches yet; `writes` still holds only stream POSTs there).

- [ ] **Step 6: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect test/support/fake-protect-server.ts
git add apps/backend/src/plugins/devices-unifi-protect apps/backend/test/support/fake-protect-server.ts
git commit -m "feat(backend): send allow-listed UniFi Protect device changes as partial PATCH requests"
```

---

### Task 4: Command planner (pure)

**Files:**
- Create: `platforms/protect-command.ts`
- Modify: `devices-unifi-protect.constants.ts`
- Test: `platforms/protect-command.spec.ts`

**Interfaces:**
- Consumes: `PROTECT_PATCHABLE_FIELDS`, `ProtectPatchResource` (Task 3); `syncableMappingNames` (`services/protect-frame-merge.ts:172`);
  `ProtectMappingLoaderService`, `evaluateProtectMapping` (for tests).
- Produces:
  ```ts
  // devices-unifi-protect.constants.ts
  export const PROTECT_COMMAND_PATCH_DEADLINE_MS = 5_000;
  export const PROTECT_COMMAND_CONFIRM_TIMEOUT_MS = 3_000;
  export const PROTECT_COMMAND_SETTLE_MS = 500;
  export const PROTECT_COMMAND_READBACK_DEADLINE_MS = 4_000;
  export const PROTECT_COMMAND_QUEUE_WAIT_MS = 12_000;
  export const PROTECT_COMMAND_MAX_WAITING_PER_DEVICE = 4;
  export const PROTECT_COMMAND_MAX_WAITERS = 64;
  export const PROTECT_COMMAND_TIMEOUT_MS = 24_000; // queue wait + 5 000 + 3 000 + 4 000

  // platforms/protect-command.ts
  export type ProtectCommandOutcome = 'confirmed' | 'not_controllable' | 'invalid_value' | 'conflict' | 'unavailable' | 'busy'
  	| 'rejected' | 'unauthorized' | 'not_found' | 'rate_limited' | 'failed' | 'not_confirmed' | 'skipped';
  export interface ProtectPropertyOutcome { propertyId: string; mappingName: string | null; outcome: ProtectCommandOutcome }
  export type ProtectWritableMappingName = 'light_on' | 'light_brightness' | 'floodlight_indicator_on' | 'camera_indicator_on' | 'microphone_volume';
  export interface ProtectWritableMapping {
  	modelKey: 'camera' | 'light';
  	resource: ProtectPatchResource;
  	channelIdentifier: 'light' | 'indicator' | 'microphone';
  	path: string;                                                       // one of PROTECT_PATCHABLE_FIELDS[resource]
  	supported(raw: Readonly<Record<string, unknown>>): boolean;         // C1 capability column
  	toProtect(value: string | number | boolean): boolean | number | null; // null = invalid
  }
  export const PROTECT_WRITABLE_MAPPINGS: Readonly<Record<ProtectWritableMappingName, ProtectWritableMapping>>;
  export const brightnessToLedLevel = (percent: number): number;      // min(6, max(1, Math.round(percent * 6 / 100)))
  export const ledLevelToBrightness = (level: number): number;        // Math.round(level * 100 / 6)
  export interface ProtectPatchField { path: string; value: boolean | number }
  export const readProtectPath = (raw: Readonly<Record<string, unknown>> | null, path: string): unknown;
  export const protectFieldsMatch = (raw: Readonly<Record<string, unknown>> | null, fields: readonly ProtectPatchField[]): boolean; // strict equality per path; null raw = false
  export const buildProtectPatchBody = (resource: ProtectPatchResource, fields: readonly ProtectPatchField[]): Record<string, unknown>; // nested, in PROTECT_PATCHABLE_FIELDS order
  export interface ProtectCommandInput {
  	propertyId: string;
  	mappingName: string | null;
  	channelIdentifier: string;
  	protectDeviceId: string;
  	modelKey: string | null;                                            // ProtectDeviceEntity.protectModelKey
  	value: string | number | boolean;                                   // already validated by validatePropertyCommandValue
  	cached: Readonly<Record<string, unknown>> | null;                   // synchronizer cache entry
  }
  export interface ProtectDeviceCommand {
  	key: string;                                                        // `${modelKey}\u0000${protectDeviceId}`
  	protectDeviceId: string;
  	modelKey: 'camera' | 'light';
  	resource: ProtectPatchResource;
  	fields: ProtectPatchField[];
  	propertyIds: string[];
  	mappingNames: Map<string, string>;                                  // propertyId -> mapping name
  }
  export type ProtectCommandPlan = { ok: true; commands: ProtectDeviceCommand[] } | { ok: false; outcomes: ProtectPropertyOutcome[] };
  export function planProtectCommands(inputs: readonly ProtectCommandInput[]): ProtectCommandPlan;
  ```
- Planner rules (decided, C1, C9, C10), per input in order: unknown mapping name, a channel identifier other than the
  mapping's, or a `modelKey` other than the mapping's (a null `modelKey` takes the mapping's) → `not_controllable`;
  `cached === null` or `cached.state !== 'CONNECTED'` → `unavailable`; `supported(cached)` false → `not_controllable`;
  `toProtect` null → `invalid_value`. Then group by `key` in first-seen order; the same property twice with equal values
  collapses, with different values → `conflict`; two properties writing one path → `conflict`. When any input failed, the
  result is `{ ok: false }` with that input's outcome and `skipped` for every other input.

- [ ] **Step 1: Write the failing tests** (`protect-command.spec.ts`; `cameras.json[0]`, `lights.json[0]`, the real loader as
  `mapping-evaluator.spec.ts` builds it)

```ts
it.each([[0, 1], [8, 1], [9, 1], [16, 1], [17, 1], [25, 2], [33, 2], [40, 2], [50, 3], [58, 3], [67, 4], [83, 5], [92, 6], [100, 6]])(
	'maps percentages to the nearest LED level (%i -> %i)', ...);
it('round-trips every level through the mapping percentage', ...);
// for level 1..6: ledLevelToBrightness(level) equals the evaluated light_brightness of lights.json[0] with that ledLevel
// ([17, 33, 50, 67, 83, 100]) and brightnessToLedLevel(that) === level
it('plans one nested PATCH per Protect device', ...);
// light_on true + light_brightness 50 + floodlight_indicator_on false on the floodlight, camera_indicator_on true + microphone_volume 60 on the camera ->
// 2 commands in input order; buildProtectPatchBody: lights { isLightForceEnabled: true, lightDeviceSettings: { ledLevel: 3, isIndicatorEnabled: false } },
// cameras { ledSettings: { isEnabled: true }, micVolume: 60 } — equal to device-patch.json requests where they overlap
it('refuses every mapping outside the allow-list', ...);
// it.each over 'microphone_active', 'connection_state', 'contact_detected', 'camera_main_status', 'doorbell_event', null -> not_controllable, others skipped
it('refuses a camera without the capability flag', ...); // hasLedStatus false -> camera_indicator_on not_controllable; hasMic false -> microphone_volume not_controllable
it('refuses a floodlight whose console object lacks the field', ...); // no lightDeviceSettings.isIndicatorEnabled -> not_controllable
it('refuses a disconnected or uncached device', ...); // state 'DISCONNECTED' -> unavailable; cached null -> unavailable
it('refuses a mapping on the wrong channel or model key', ...); // light_on on channel 'indicator' -> not_controllable; camera_indicator_on with modelKey 'light' -> not_controllable
it('collapses duplicates and refuses conflicts', ...); // same property true,true -> one field; true,false -> conflict
it('matches fields by exact value', ...); // protectFieldsMatch(lights.json[0], [{ path: 'lightDeviceSettings.ledLevel', value: 6 }]) true; value 5 false; '6' false; null raw false
it('only allows path-sourced mappings the synchronizer owns', ...);
// every PROTECT_WRITABLE_MAPPINGS name is in syncableMappingNames(loader.getMappings()) and its loader value source path equals the
// read path, except light_on (reads isLightOn, writes isLightForceEnabled, C3); every path is in PROTECT_PATCHABLE_FIELDS of its resource
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/platforms`
Expected: FAIL (module `protect-command` not found).

- [ ] **Step 3: Implement** the constants and the module. `readProtectPath` walks own plain-object properties only (never
  `__proto__`).

- [ ] **Step 4: Run to verify pass** — the Step 2 command. Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect
git add apps/backend/src/plugins/devices-unifi-protect
git commit -m "feat(backend): plan UniFi Protect device commands from writable mappings"
```

---

### Task 5: Synchronizer hooks for the platform

**Files:**
- Modify: `services/protect-synchronizer.service.ts`
- Test: `services/protect-synchronizer.service.spec.ts`

**Interfaces:**
- Consumes: F8; `ProtectInventoryEntry` (`services/protect-inventory.service.ts:16`).
- Produces:
  ```ts
  export type ProtectDeviceObserver = (modelKey: string, id: string, raw: Readonly<Record<string, unknown>>) => void;
  /** Called synchronously after every cache write (frame add/update, snapshot entry, readback); returns the unsubscribe. Survives reset(). */
  observeDevices(observer: ProtectDeviceObserver): () => void;
  /** The merged console object the synchronizer holds, or null. */
  getCachedDevice(modelKey: string, id: string): Readonly<Record<string, unknown>> | null;
  /** Grows with every cache write for that device; 0 when never written. */
  getDeviceSequence(modelKey: string, id: string): number;
  /**
   * Serial; applies a by-id GET as an authoritative object for one device (the `add` frame path). Resolves false, writing
   * nothing, when the device's sequence moved past `sinceSequence` (a newer frame or snapshot) or a reset intervened.
   */
  applyDeviceReadback(identity: ProtectConsoleIdentity, entry: ProtectInventoryEntry, sinceSequence: number): Promise<boolean>;
  ```
- Rules (decided): the sequence map is keyed like the cache, bumped wherever the cache is written or an entry deleted,
  pruned with the cache, cleared by `reset()`. Observer exceptions are caught and logged once per 60 s with the fixed text
  `UniFi Protect device observer failed`. A readback for a device that is not adopted only refreshes the cache.

- [ ] **Step 1: Write the failing tests** (existing synchronizer spec harness and fakes)

```ts
it('reports every cache write to observers', ...);
// prime lights.json; enqueue the ledLevel/isIndicatorEnabled frame (Task 2) -> observer called with ('light', '5f…c01', raw) where raw.lightDeviceSettings.ledLevel === 3
it('serves the cached object and its sequence', ...); // after prime: getCachedDevice('light', id) deep-equals lights.json[0]; sequence 1; after the frame 2; unknown id null / 0
it('applies a device readback as an authoritative object', ...);
// seq = getDeviceSequence; applyDeviceReadback(identity, { modelKey: 'light', id, raw: { ...lights.json[0], lightDeviceSettings: { ...ld, ledLevel: 2 } } }, seq)
// -> true; ChannelsPropertiesService.update called with light brightness 33; observer called
it('discards a readback older than a frame applied after it was requested', ...);
// seq captured; frame applied (ledLevel 3); readback with ledLevel 2 -> false; brightness stays 50; no update with 33
it('keeps working when an observer throws', ...); // throwing observer + frame -> property still written; one warn line with the fixed text
it('forgets cache and sequences on reset but keeps observers', ...);
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/services/protect-synchronizer.service.spec.ts`
Expected: FAIL (`observeDevices is not a function`).

- [ ] **Step 3: Implement** the four members. `applyDeviceReadback` runs through `run()`, checks the sequence inside the task,
  then reuses the `add` branch of `applyFrameNow` (refactor it into a private `applyDeviceObject(identity, modelKey, id, raw,
  'add' | 'update', partial)` used by both).

- [ ] **Step 4: Run to verify pass**

Run: the Step 2 command, then `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/services`
Expected: PASS, including every existing synchronizer and realtime test.

- [ ] **Step 5: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect
git add apps/backend/src/plugins/devices-unifi-protect
git commit -m "feat(backend): expose UniFi Protect cache changes and readbacks to the control platform"
```

---

### Task 6: Confirmation waiters

**Files:**
- Create: `platforms/protect-confirmation.ts`
- Test: `platforms/protect-confirmation.spec.ts`

**Interfaces:**
- Consumes: `ProtectPatchField`, `protectFieldsMatch` (Task 4); `PROTECT_COMMAND_MAX_WAITERS` (Task 4).
- Produces:
  ```ts
  export interface ProtectConfirmationWaiter {
  	/** True once an observation after arm() showed every field. */
  	readonly matched: boolean;
  	/** Resolves true on a match (also one that happened before the call), false on timeout, cancelAll() or dispose(). */
  	wait(timeoutMs: number): Promise<boolean>;
  	dispose(): void;
  }
  export class ProtectConfirmationWaiters {
  	constructor(options?: { maxWaiters?: number });
  	/** Null when maxWaiters are armed. */
  	arm(key: string, fields: readonly ProtectPatchField[]): ProtectConfirmationWaiter | null;
  	observe(key: string, raw: Readonly<Record<string, unknown>>): void;
  	cancelAll(): void;
  	get size(): number;
  }
  ```
- Rules (decided): a waiter matches only when **all** its fields match one observation of its key; timers are `unref()`ed and
  cleared on resolve; a waiter resolves once; `dispose()` removes it from the set.

- [ ] **Step 1: Write the failing tests** (fake timers)

```ts
it('resolves true on a matching observation and false on timeout', ...); // wait(3000); observe matching -> true; second waiter, advance 3000 -> false
it('counts an observation made before wait()', ...); // arm; observe matching; wait(3000) resolves true without advancing timers
it('ignores other devices and partial matches', ...); // fields ledLevel 3 + isIndicatorEnabled false; observe with only ledLevel 3 -> still pending; other key -> pending
it('ends every pending wait on cancelAll()', ...); // two waits -> both false; size 0
it('refuses to arm beyond the limit', ...); // maxWaiters 2 -> third arm() null
it('leaves no timer behind', ...); // after resolve and dispose: jest.getTimerCount() === 0
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/platforms/protect-confirmation.spec.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** the class.

- [ ] **Step 4: Run to verify pass** — the Step 2 command. Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect
git add apps/backend/src/plugins/devices-unifi-protect
git commit -m "feat(backend): track UniFi Protect command confirmations"
```

---

### Task 7: The device platform and its registration

**Files:**
- Create: `platforms/unifi-protect-device.platform.ts`
- Modify: `devices-unifi-protect.plugin.ts`, `devices-unifi-protect.plugin.spec.ts`
- Test: `platforms/unifi-protect-device.platform.spec.ts`

**Interfaces:**
- Consumes: F1–F4, F9, F10; Tasks 3–6. `ProtectConnectorService.getClient/getConsoleIdentity/onSessionChange`,
  `ProtectRealtimeService.getState`, `ProtectSynchronizerService.observeDevices/getCachedDevice/getDeviceSequence/applyDeviceReadback`,
  `validatePropertyCommandValue` (`modules/devices/utils/property-command-value.utils.ts:102`), `PermissionType`.
- Produces:
  ```ts
  @Injectable()
  export class UnifiProtectDevicePlatform implements IDevicePlatform, OnModuleInit, OnModuleDestroy {
  	constructor(connector: ProtectConnectorService, realtime: ProtectRealtimeService, synchronizer: ProtectSynchronizerService);
  	getType(): string;                                                  // DEVICES_UNIFI_PROTECT_TYPE
  	getCommandTimeoutMs(commandCount: number): number;                  // commandCount > 0 ? PROTECT_COMMAND_TIMEOUT_MS : 0
  	usesAuthoritativePropertyReadback(property: ChannelPropertyEntity): boolean; // property instanceof ProtectChannelPropertyEntity
  	process(update: IDevicePropertyData): Promise<boolean>;             // processBatch([update])
  	processBatch(updates: IDevicePropertyData[]): Promise<boolean>;    // every outcome 'confirmed'; [] -> true
  	/** Per-property outcomes in input order (tests, diagnostics). Never throws. */
  	executeBatch(updates: IDevicePropertyData[]): Promise<ProtectPropertyOutcome[]>;
  }
  ```
- Platform rules (decided):
  1. *Entity checks* (Homey, F4), else `not_controllable`: `device instanceof ProtectDeviceEntity`, `channel instanceof
     ProtectChannelEntity`, `property instanceof ProtectChannelPropertyEntity`, `device.enabled`, string `protectDeviceId`,
     channel and property reference the given parents, permissions include `READ_WRITE` or `WRITE_ONLY`;
     `validatePropertyCommandValue(property, value)` invalid → `invalid_value`. Console: `getClient()` and
     `getConsoleIdentity()` non-null and `device.protectNvrId === identity.nvrId`, else `unavailable`. Then
     `planProtectCommands` with `cached = synchronizer.getCachedDevice(modelKey, protectDeviceId)` (a null model key is tried
     as `camera`, then `light`). A failed plan returns its outcomes with no request.
  2. *Queue* per command `key`: FIFO; more than `PROTECT_COMMAND_MAX_WAITING_PER_DEVICE` waiting, or a turn not reached
     within `PROTECT_COMMAND_QUEUE_WAIT_MS` → `busy` (leaves the queue, sends nothing).
  3. *Turn*: re-check the session generation and the cached `state === 'CONNECTED'` (else `unavailable`); arm a waiter (null
     → `busy`); `patchDevice(resource, id, buildProtectPatchBody(...), { deadlineMs: PROTECT_COMMAND_PATCH_DEADLINE_MS })`.
  4. *PATCH error*: `bad_request` or a `protocol` error with status 400–499 → `rejected`; `authentication`/`authorization` →
     `unauthorized`; `not_found` → `not_found`; `rate_limited` → `rate_limited`; `cancelled`/`validation`/TLS → `unavailable`;
     `timeout`, `unavailable`, `unreachable` or `protocol` without a 4xx status are ambiguous → readback (step 6), outcome
     `confirmed` on a match, else `failed`.
  5. *PATCH 2xx*: `confirmed` when the waiter matched or `protectFieldsMatch(getCachedDevice(...), fields)`; else wait
     `PROTECT_COMMAND_CONFIRM_TIMEOUT_MS` when `realtime.getState() === 'streaming'`, otherwise sleep
     `PROTECT_COMMAND_SETTLE_MS`; matched → `confirmed`; else readback, `confirmed` on a match, else `not_confirmed`.
  6. *Readback*: `seq = getDeviceSequence(...)`; `getCamera`/`getLight(id, { deadlineMs: PROTECT_COMMAND_READBACK_DEADLINE_MS })`;
     `await synchronizer.applyDeviceReadback(identity, { modelKey, id, raw }, seq)`; match = `waiter.matched ||
     protectFieldsMatch(raw, fields)`. A failed readback is a non-match.
  7. *Session*: `onModuleInit` subscribes `synchronizer.observeDevices((m, id, raw) => waiters.observe(key, raw))` and
     `connector.onSessionChange`; a `null` session bumps the session generation and calls `waiters.cancelAll()`; after every
     await, a changed generation ends the command as `unavailable` with no further request. `onModuleDestroy` unsubscribes
     both and cancels.
  8. *Batch*: devices run in first-seen order; after the first non-`confirmed` device the rest are `skipped`. Every property
     of a device shares its device's outcome.
  9. *Logs*: failures through a 60 s limiter (copy of `HomeyFailureLogLimiter` semantics, fixed text
     `UniFi Protect command failed (<outcome>) property=<propertyId> mapping=<mappingName>`); success at debug
     `UniFi Protect command confirmed (frame|cache|readback) device=<protectDeviceId>`. No value, body, URL or key in any line.
- Plugin (decided): add `UnifiProtectDevicePlatform` to `providers`; inject `PlatformRegistryService` and the platform;
  `this.platformRegistry.register(this.unifiProtectDevicePlatform)` right after `managedServiceManager.register(...)`. Readme:
  *What you get* gains `- Control of floodlight light, brightness and status LED, and camera and doorbell status LED and
  microphone volume`; new section after *Real-time updates*:
  ```markdown
  ## Control

  - Each change becomes one partial update per Protect device, sent through the same request pacing as every other console request.
  - A change counts as done only when the console confirms it, by its next device update or a read-back within a few seconds; otherwise the command fails and Smart Panel keeps showing the console's state.
  - Floodlight brightness has six levels on the console; a value between two levels is set to the nearest one.
  - Devices adopted before this version need to be adopted again to make the microphone volume and the floodlight status LED writable.
  ```
  *Boundaries*: replace `the plugin never deletes a stream and never changes other console settings.` with `the plugin never
  deletes a stream, and changes no console setting other than those listed under Control.`

- [ ] **Step 1: Write the failing tests** (`unifi-protect-device.platform.spec.ts`: real `ProtectConfirmationWaiters`, fake
  connector with a session listener, fake realtime state, fake synchronizer with a settable cache and observer, fake client
  with `patchDevice`/`getLight`/`getCamera` jest mocks, entities built from `lights.json[0]` and `cameras.json[0]`, fake timers)

```ts
it('registers for the plugin type and asks the core not to persist commanded values', ...);
// getType() 'devices-unifi-protect'; usesAuthoritativePropertyReadback(protectProperty) true, (plain ChannelPropertyEntity) false; getCommandTimeoutMs(0/1/3) 0/24000/24000
it('sends one PATCH per Protect device and confirms by the next frame', ...);
// light_on true + light_brightness 50 -> patchDevice('lights', id, { isLightForceEnabled: true, lightDeviceSettings: { ledLevel: 3 } }, { deadlineMs: 5000 }) once;
// fake synchronizer observes a matching object -> processBatch true; getLight not called
it('confirms at once when the cache already shows the values', ...); // cached ledLevel 3, command 50 -> true without advancing timers
it('falls back to a GET readback after 3 s without a frame', ...);
// advance 3000 -> getLight(id, { deadlineMs: 4000 }); applyDeviceReadback called with the sequence read before the GET; matching raw -> true
it('reports not_confirmed when the readback shows other values', ...); // executeBatch -> [{ outcome: 'not_confirmed' }, …]; processBatch false
it('confirms by GET after 500 ms while realtime is polling', ...); // state 'polling' -> getLight after 500 ms, not after 3000
it('confirms an ambiguous PATCH failure from the readback', ...); // patchDevice rejects 'timeout' -> getLight; matching -> 'confirmed'; not matching -> 'failed'
it.each([['bad_request', 'rejected'], ['authorization', 'unauthorized'], ['not_found', 'not_found'], ['rate_limited', 'rate_limited']])(
	'fails a rejected PATCH without a readback (%s -> %s)', ...); // getLight never called
it('fails before any request while the console is disconnected', ...); // getClient null -> 'unavailable'; patchDevice not called
it('fails before any request for an uncached or disconnected device', ...);
it('refuses the whole batch when one property is not controllable', ...); // light_on + microphone_active -> no patchDevice; outcomes not_controllable + skipped
it('refuses a property without write permission or with an invalid value', ...); // permissions [ro] -> not_controllable; brightness 101 -> invalid_value
it('stops at the first failed device and skips the rest', ...); // camera 400 then light -> camera 'rejected', light 'skipped'; one patchDevice call
it('runs commands for one device one after another', ...);
// two processBatch calls on the floodlight; the second patchDevice starts only after the first confirmed (call order and timing)
it('refuses a fifth waiting batch as busy', ...); // first in flight (unconfirmed), four waiting, fifth -> 'busy' immediately
it('ends pending confirmations when the session ends', ...); // in-flight wait; session listener (null, 'lost') -> 'unavailable'; no getLight
it('logs failures without values, bodies or the key', ...); // logger spies: 'UniFi Protect command failed (rejected) property=<id> mapping=light_brightness'; no 'ledLevel', no FAKE_PROTECT_API_KEY
```
`devices-unifi-protect.plugin.spec.ts`: `it('registers the device platform for the plugin type')` — the registry mock's
`register` called once with the platform instance after `onModuleInit()`; the provider-list test adds
`UnifiProtectDevicePlatform`; the readme test adds `toContain('## Control')`, `toContain('microphone volume')`,
`not.toContain('never changes other console settings')`.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/platforms src/plugins/devices-unifi-protect/devices-unifi-protect.plugin.spec.ts`
Expected: FAIL (platform module not found; registration and readme assertions).

- [ ] **Step 3: Implement** the platform and the plugin changes.

- [ ] **Step 4: Run to verify pass**

Run: the Step 2 command, then `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect`
Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect
git add apps/backend/src/plugins/devices-unifi-protect
git commit -m "feat(backend): register the UniFi Protect device platform"
```

---

### Task 8: End to end, gates, epic status and PR body

**Files:**
- Create: `apps/backend/test/devices-unifi-protect-control.e2e-spec.ts`
- Modify: `tasks/epics/EPIC-UNIFI-PROTECT.md:104`

**Interfaces:**
- Consumes: everything above; the boot, auth, config, `adoptBatch`, `readValue`, `eventually` helpers of
  `test/devices-unifi-protect-realtime.e2e-spec.ts:88-330` (copy them; do not import between e2e files).
- Setup (decided): fake console with `cameraFixtures: ['cameras.json']`; adopt `600cefafd5f365d6f83c4ef3` (camera,
  `stream.enabled: false`) and `5f0000000000000000000c01` (`model_key: 'light'`); wait for `realtime_state: streaming`.
  Commands go through `app.get(PropertyCommandService).executePropertyCommands([{ propertyId, value }])` unless stated.
  Before each test: `fake.patches.length = 0; fake.echoPatches(true);` — never `fake.reset()`, which would also drop the
  overlays earlier tests built on.

- [ ] **Step 1: Write the e2e tests**

```ts
it('turns the floodlight on with one PATCH and stores the console state from the frame', ...);
// light.on true -> { success: true }; fake.patches toEqual [{ resource: 'lights', id: FLOODLIGHT, body: { isLightForceEnabled: true } }];
// readValue(floodlight, 'light', 'on') === true; no 'GET' of '/v1/lights/<id>' recorded after the PATCH
it('sends brightness and the status LED of one floodlight in one PATCH', ...);
// [brightness 40, indicator.on false] -> one patch, body { lightDeviceSettings: { ledLevel: 2, isIndicatorEnabled: false } }; brightness stored 33; indicator false
it('sets the camera status LED and microphone volume in one PATCH', ...);
// [indicator.on true, microphone.volume 60] -> body { ledSettings: { isEnabled: true }, micVolume: 60 }; values true / 60
it('confirms by GET when the console sends no frame', ...);
// echoPatches(false); brightness 100 -> success true; a GET of lights/<id> recorded after the PATCH; brightness 100
it('keeps the stored value when the console rejects the change', ...);
// enqueue(/\/lights\//, { status: 400, body: '{"error":"x","name":"BAD_REQUEST"}' }, 'PATCH'); light.on false -> success false,
// results[0].reason 'Execution failed'; light.on still true; no GET after the PATCH
it('answers a REST property PATCH without writing the requested value', ...);
// PATCH /api/v1/modules/devices/channels/<lightChannel>/properties/<on> { data: { type: 'devices-unifi-protect', value: false } } as owner
// -> 200 and data.value is the stored value (true), then eventually readValue === false (from the echoed frame)
it('never sends a PATCH for a property outside the allow-list', ...);
// microphone.active false -> success false; fake.patches empty; fake.forbiddenHits 0
it('fails without a request while the console is disconnected', ...);
// patchConfig({ enabled: false }) and wait for connection_state 'disconnected'; light.on true -> success false; fake.writes unchanged;
// restore with patchConfig(savedConfig()) and wait for 'streaming'
it('never leaked a secret into responses, logs, events or the database', ...);
// FAKE_PROTECT_API_KEY, 'SENTINELALIAS', FAKE_PROTECT_ALIAS absent from inspect([logSpies, emitSpies, observed]) and from SELECT * of
// devices_module_devices, devices_module_channels, devices_module_channels_properties; the material contains 'lights/{id}'
```

- [ ] **Step 2: Run**

Run: `pnpm --filter ./apps/backend exec jest --config ./test/jest-e2e.json test/devices-unifi-protect-control.e2e-spec.ts --detectOpenHandles`
Expected: PASS, 9 tests, no open-handle report. Fix the test, not the product, unless a real defect shows.

- [ ] **Step 3: Prove the authoritative-readback guard can fail**

Temporarily make `usesAuthoritativePropertyReadback` return `false`; rerun Step 2. Expected: `answers a REST property PATCH
without writing the requested value` FAILS (the response carries `false`). Restore with
`git checkout -- apps/backend/src/plugins/devices-unifi-protect/platforms/unifi-protect-device.platform.ts` and rerun to PASS.

- [ ] **Step 4: Full gates**

```bash
node spec/devices/validate.mjs
pnpm run generate:spec
pnpm run generate:openapi
pnpm --filter ./apps/backend run lint:js
pnpm --filter ./apps/backend exec prettier --check "src/plugins/devices-unifi-protect/**/*.ts" "test/devices-unifi-protect*.ts" "test/support/fake-protect-server.ts"
pnpm --filter ./apps/backend run lint:deps
pnpm run test:unit
pnpm --filter ./apps/backend exec jest --config ./test/jest-e2e.json test/devices-unifi-protect.e2e-spec.ts test/devices-unifi-protect-discovery.e2e-spec.ts test/devices-unifi-protect-adoption.e2e-spec.ts test/devices-unifi-protect-realtime.e2e-spec.ts test/devices-unifi-protect-control.e2e-spec.ts
git status --short
```
Expected: every command exits 0, except that `lint:deps` may report only the pre-existing findings recorded in PR #1642
(no new cycle names a `devices-unifi-protect` file) and `test:unit` may fail only
`buddy/automation-suggestion-evaluator.service.spec.ts` on a non-UTC machine (passes with `TZ=UTC`); `git status` shows no
generated file.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/test/devices-unifi-protect-control.e2e-spec.ts
git commit -m "test(backend): cover UniFi Protect control end to end"
```
Edit `tasks/epics/EPIC-UNIFI-PROTECT.md:104`: first cell `UP-9 (done)`.
```bash
git add tasks/epics/EPIC-UNIFI-PROTECT.md
git commit -m "docs(tasks): mark UniFi Protect control done"
```

- [ ] **Step 6: Write the PR body to a file (do not push, do not open the PR)**

Path: `<session scratchpad>/pr-body-unifi-protect-control.md`. Title line first:
`feat(backend): control UniFi Protect floodlights and camera settings`. Sections: Summary (3 bullets); Writable properties
table (C1 with the transforms of C3 and C4); Command flow (plan → queue → PATCH → frame or `GET` → outcome, C7–C10);
Decisions C1–C12 as approved, with reasons; Deviations from issue #1185 and the design ("Decisions recorded" below); Spec
change and re-adoption note (C2, no migration); Test plan (commands of Tasks 1–8 with pass counts); Known limits (PATCH
body shapes, setting echoes on `subscribe/devices` and `isLightForceEnabled` semantics are synthetic until UP-20; the panel
shows a between-level brightness until the next report; `microphone.active` stays read-only by policy); `Closes #1185`;
then `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

---

## Amendments after review (they win over the task text)

- **Command paths (Task 1).** Run Step 5's checks in a subshell (`(cd apps/backend && …)`) so Step 6's repository-relative
  paths still resolve.
- **Monotonic sequence tokens (Task 5).** A device's sequence never restarts: the per-device value is offset by a base that
  rises whenever a device leaves the cache and is never lowered by `reset()`, so a `GET` that started before a deletion,
  re-addition or reset can never pass the `sinceSequence` check against the new device. Test: delete and re-add a device
  while a readback is pending; the readback is discarded.
- **No confirmation from earlier observations (Tasks 6, 7).** Confirmation is never sticky from frames observed before
  `patchDevice` resolved: on a 2xx, the platform first evaluates the current cached state; if it does not match, it waits
  for a frame observed after that point. A match recorded earlier (for example while the request waited in the pacer)
  that a later frame contradicted can never confirm. Test: matching frame before the request, contradicting frame, then
  2xx → not confirmed.
- **No confirmation from a discarded readback (Task 7).** When `applyDeviceReadback` returns `false` (a newer frame
  arrived), the command is evaluated against the current cached state, not the readback's raw object. Test.

## Decisions recorded (for the PR body)

1. `microphone.volume` became `rw` and `lighting` allows an optional `indicator` channel (spec change outside the issue's file
   ownership, own `feat(spec)` commit, no migration); adopted devices need re-adoption to gain them.
2. The floodlight status LED is a new mapping (`floodlight_indicator`, `floodlight_indicator_on`), closing UP-7 P2's
   indicator half; floodlight motion stays unmapped (UP-8 R3).
3. `light.on` keeps reading `isLightOn`; commands are confirmed by the field they write (`isLightForceEnabled`).
4. Brightness snaps to the nearest of six levels; 0 % sets level 1, never "off".
5. `microphone.active` is not writable although the spec allows it.
6. The platform declares authoritative readback: the core never stores a commanded value; the synchronizer is the only
   writer and a rejected command changes nothing stored.
7. Per-property errors are logged and exposed through `executeBatch()`; the core still receives one boolean per device batch.
8. The client gained `patchDevice` with its own field allow-list, a `deadlineMs` call option and a 429-only retry for PATCH.
9. The synchronizer gained a cache accessor, change observers, per-device sequences and an authoritative single-device
   readback.
10. The fake console gained PATCH handling with a deep overlay, a `patches` record and optional echo frames; new synthetic
    fixtures `device-patch.json` and three control frames.

## Self-review

**Spec coverage (issue #1185, design §10.1, §10.4, §12, §4.3, §15, §16, roadmap UP-9):**

| Requirement | Task |
|---|---|
| `UnifiProtectDevicePlatform` registered for the plugin type | 7 |
| `processBatch` groups writes per Protect device into one partial `PATCH /v1/{cameras\|lights}/{id}` | 3, 4, 7 |
| Validates permissions and capability flags | 4, 7 |
| Floodlight `light.on` (`isLightForceEnabled`), `light.brightness` (`ledLevel` 1–6 ↔ %), indicator | 1, 2, 4 (C1, C3, C4) |
| Camera/doorbell status LED (`ledSettings.isEnabled`); microphone volume (`micVolume`) | 1, 4 (C1, C2) |
| Confirmation by the following `subscribe/devices` update with a `GET` readback fallback; per-command timeout | 5, 6, 7 (C7) |
| Errors surfaced per property | 4, 7 (C11) |
| Writes share the client rate pacer | 3, 7 |
| Unit tests for batching, transforms and failure paths | 3, 4, 6, 7 |
| Spec change separated with the `spec` scope, regeneration, migration decision | 1 (C2) |
| Secret rule with sentinels | 3, 7, 8 |
| Allow-list; nothing else modified or deleted | 3, 4, 8 (C5) |
| No fight between a command and incoming frames | 5, 7, 8 (C8) |

**Step scan:** every code step names its file, signatures and decided rules; test steps list names with fixture ids, values
and texts; verification steps carry commands and expected output. The platform's flow is a numbered rule list, not a body;
the readme and log texts are fixed copy.

**Type consistency:** `ProtectPatchResource`, `PROTECT_PATCHABLE_FIELDS`, `isAllowedProtectPatch`, `patchDevice`,
`ProtectCallOptions.deadlineMs` (3) in 4 and 7; `ProtectPatchField`, `protectFieldsMatch`, `buildProtectPatchBody`,
`planProtectCommands`, `ProtectDeviceCommand`, `ProtectPropertyOutcome`, `ProtectCommandOutcome`, the `PROTECT_COMMAND_*`
constants (4) in 6 and 7; `observeDevices`, `getCachedDevice`, `getDeviceSequence`, `applyDeviceReadback` (5) in 7;
`ProtectConfirmationWaiters`, `ProtectConfirmationWaiter` (6) in 7; `executeBatch` (7) in 8; mapping names
`floodlight_indicator`, `floodlight_indicator_on` (2) in 4.

**Review Focus:** items 1–5 each name their tests (Task 7 GET fallback, Task 8 no-frame; Task 7 FIFO and busy; Task 4
rounding, Task 8 between-level brightness; Task 7 rejection and session end, Task 8 rejection and REST PATCH; Task 3 body
allow-list, Task 4 mapping allow-list, Task 8 `microphone.active`).

**Proportion:** 8 tasks for roughly 1,800 lines of source and tests; the plan carries the decisions, signatures, rule lists,
fixture-based test names and fixed copy, and points to the Homey platform and the UP-8 e2e harness for patterns.
