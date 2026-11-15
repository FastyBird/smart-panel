# Cameras — Plan 5b: UniFi Protect real-time device state and events (UP-8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopted UniFi Protect cameras, doorbells, UP-Sense sensors and floodlights stay in sync with the console through
the `subscribe/devices` and `subscribe/events` WebSockets: detections, rings and sensor changes reach Smart Panel
properties within a second, survive reconnects without replaying old events, and fall back to REST polling when the
WebSockets are unavailable.

**Architecture:** `ProtectApiClient` gains `openSubscription()`, a `ws` socket over the client's own verified TLS agent and
rate pacer. `ProtectRealtimeService` follows the connector's session: it opens both sockets, buffers frames, primes
state over REST, applies the buffer, then streams; it pings, reconnects with backoff and jitter, and after three failed
cycles polls REST with an admin notification. Two pure units decide everything about frames —
`protect-frame-merge.ts` (parse, pollution-safe merge, mapped-value diff) and `protect-event-tracker.ts` (event-to-channel
table, open events, 60 s safety timeout, seen-id de-duplication) — and `ProtectSynchronizerService` turns their output into
`ChannelsPropertiesService.update`, `DeviceConnectivityService.trySetConnectionState` and
`ChannelInputOccurrencesService.publishOccurrence` calls.

**Tech Stack:** NestJS 11 on Fastify, TypeORM (SQLite), `ws` 8 (existing backend dependency, `apps/backend/package.json:170`),
Jest with fake timers, supertest. No new dependency, no migration.

**Spec:** `docs/superpowers/specs/2026-10-06-unifi-protect-integration-design.md` §4.1, §4.3, §6 (D4, D8 and "Spike results
(2026-11-14)"), §9.2, §9.3, §10, §11, §14, §14a, §16. Issue #1184 (epic #1175). Roadmap
`docs/superpowers/plans/2026-11-12-cameras-roadmap.md` §5 Plan 5 UP-8. Predecessor plan
`docs/superpowers/plans/2026-11-15-cameras-plan-5a-protect-adoption.md` (UP-7, decisions P1–P10 and PR #1642's recorded
deviations A4, A10, A17–A20). Reference implementations: `apps/backend/src/plugins/devices-home-assistant/services/home-assistant.ws.service.ts`
(notification raise/resolve, `:627-735`), `apps/backend/src/plugins/devices-homey/services/homey-synchronizer.service.ts`
(index, `@OnEvent` invalidation, `publishOccurrence`), `docs/hardware-inputs.md`. UP-5, UP-6 and UP-7 are merged on `main`
(`4652bcb13`); every interface below is verified on that commit.

---

## Decisions for approval

The issue, the design, the roadmap and the code disagree or leave these open. The plan is written for each
recommendation; *cost if wrong* says what changes.

**R1. WebSocket endpoints and who opens them.** The public Integration API has exactly the two sockets the roadmap names:
`GET subscribe/devices` and `GET subscribe/events` (design §4.1 endpoint table; the spike opened both with `X-API-KEY` in
about 60 ms). Options: (a) `ProtectApiClient.openSubscription(topic)` over the client's own `ProtectHttpsAgent`, pacer and
key; (b) the realtime service builds its own agent from the config. **Recommendation: (a).** The key and the TLS policy
already live only in the client (`client/protect-api.client.ts:238-273`); `ProtectHttpsAgent` extends `https.Agent` and
verifies or pins before any byte is written (`client/protect-https-agent.ts:34-40`), and Node uses an agent's
`createConnection` whenever an agent is given, so `ws` inherits the verification. The upgrade takes one pacer slot (the
budget is shared with WebSockets, design §4.3). *Cost if wrong:* if `ws` ever bypassed the agent, Task 1's
`refuses a wrong pin before the key is sent` fails; the fix is a `createConnection` option in the same method.

**R2. Lifecycle.** Options: (a) the realtime service follows the connector through a session listener
(`onSessionChange`), so it runs exactly while the connector is `connected`; (b) a second managed service
(`serviceId: 'realtime'`). **Recommendation: (a).** One managed service keeps the plugin's start/stop/restart, factory
reset and the managed-service inventory unchanged; a connector failure or reconfiguration closes the client, which ends
the session. The tracker and its safety timers survive a lost session and are cleared only on a stop. *Cost if wrong:* a
separate service is a new class with the same cycle code plus inventory and plugin-spec rows.

**R3. Event-to-property semantics** (issue table, design §10, §14a, UP-7 P1, P2, P4). The exact table is Task 3's
`resolveProtectEventTargets`. Kinds:
- *duration* (add → value on, `update` with `end` → off, safety timeout): `motion` → `motion.detected`;
  `smartDetectZone`/`smartDetectLine`/`smartDetectLoiterZone` → `object_detection.<key>.detected` per entry of
  `smartDetectTypes` (an `update` that adds a type opens it too); `smartAudioDetect` `alrmSmoke`/`alrmCmonx` →
  `smoke`/`carbon_monoxide.detected`, every other audio type → `sound_detection.<key>.detected`; `sensorMotion` →
  `motion.detected`; `sensorWaterLeak` → `leak.detected` plus `leak.level` `high`/`low` (P4); `sensorAlarm` →
  `smoke.detected` (P4: the UP-Sense does not say which alarm it heard).
- *instant*: `sensorOpened` / `sensorClosed` → `contact.detected` true / false; the device frame `isOpened` stays
  authoritative and agrees.
- *latch*: `sensorTamper` → every `tampered` property of the sensor (`contact`, `motion`) true; cleared only by a device
  frame or snapshot with `tamperingDetectedAt: null` (Protect clears tamper explicitly), never by a timeout.
- *ring*: see R5.
- *covered by device frames*: `sensorBatteryLow` (the `batteryStatus` frame drives `battery.status`).
- *unmapped*: `lightMotion` — the floodlight has no `motion` channel (P2, `lighting` spec). **This contradicts the issue
  table**, which lists `lightMotion → motion`; routing it to the paired camera would misattribute motion.
- *unknown*: every other type (`sensorExtremeValues`, `sensorButtonPressed`, `relayInputChanged`, …) and every unknown
  `smartDetectTypes` entry: ignored and counted (R12).
**Recommendation: as listed.** The event fixtures are synthetic (`__fixtures__/README.md`): the audio type spelling
(`alrmSmoke` in `smartDetectTypes`), leak and alarm durations and tamper clearing are unverified until UP-20. *Cost if
wrong:* each line is one table row in Task 3 plus its test.

**R4. Safety timeout.** Options: (a) 60 s after the **last** frame of an open event (an `update` without `end` re-arms
it); (b) 60 s after `start`; (c) longer (5 min). **Recommendation: (a), 60 s** (design §10.1, roadmap). Protect keeps a
long motion event open and updates it, so (b) would clear live detections. In addition, every REST snapshot (prime and
poll) resets an event-driven detection that is stored `true` while the tracker holds no open event for it — this clears
detections that were open when the backend stopped. *Cost if wrong:* a detection with 60 s of frame silence flickers
off; the constant `PROTECT_EVENT_SAFETY_TIMEOUT_MS` changes it.

**R5. Doorbell rings.** Verified blocker: `ChannelInputOccurrencesService.publishOccurrence` accepts only `button`,
`binary_input` and `analog_input` channels or an `ev` property (`modules/devices/services/channel-input-occurrences.service.ts:96-104`);
the spec's `doorbell.event` is `ro` (`spec/devices/channels.yaml:2804-2822`), so every ring would throw
`DevicesValidationException`. No plugin publishes on a doorbell channel today. Options: (a) accept
`ChannelCategory.DOORBELL` as an input channel in that service (two lines, outside the issue's file ownership);
(b) change the spec permission to `ev` (spec PR, regeneration in backend, admin and panel). **Recommendation: (a).**
The ring publishes `{ event: 'single_press', nativeEventType: 'ring', sourceOccurrenceId: <Protect event id>,
sourceTimestamp: <start as ISO> }` once, on the event's `add`. The core de-duplication window is 5 s
(`channel-input-deduplication.service.ts:6`), so it cannot cover a reconnect: the tracker keeps the last 1024 event ids
(open or ended) and drops a repeated `add`. No `doorbell.event` value is written: a persisted `single_press` never clears
and an equal value emits no event, so it carries no signal (`docs/hardware-inputs.md` §1.1 treats events as
ephemeral). *Cost if wrong:* (b) later is the spec PR; writing the value is one call in Task 5.

**R6. Keep-alive, reconnect and timing values.** Ping each socket every 180 s; a socket without a pong 30 s after a ping
is terminated and the cycle restarts. Upgrade handshake timeout 10 s (`PROTECT_REQUEST_TIMEOUT_MS`). Reconnect delay
`calculateProtectReconnectDelay(consecutiveFailures)` (1 s doubling to 60 s, ±20 % jitter,
`services/protect-reconnect-backoff.ts`), at least the `Retry-After` of a 429. A cycle that reached streaming and then
dropped reconnects at attempt 0. One socket closing closes the other and restarts the whole cycle, with a re-prime.
A generation counter (bumped per cycle, session change and stop) discards every late callback. Timings come from an
injection token so the e2e can shorten them. **Recommendation: as listed.** The spike saw no server pings and an idle
socket survive 6 minutes; whether the console answers client pings is unverified. *Cost if wrong:* if it never
answers, every socket restarts every 210 s with a 3-request re-prime (harmless to the 8/s budget); raising
`pongTimeoutMs` or disabling the check is one constant.

**R7. Degraded mode.** After 3 consecutive cycles that failed before streaming: poll `GET cameras`, `GET sensors`,
`GET lights` every `poll_interval_ms` (existing config, default 30 s, 5–600 s, `models/config.model.ts:161-169`, read at
each schedule so a change applies without restart) through the client's pacer, keep retrying the sockets on the backoff,
and raise one issue: source `devices-unifi-protect-plugin`, key `realtime`, severity `warning`, title
`UniFi Protect real-time updates unavailable`, message `Smart Panel cannot keep the UniFi Protect event connection open
and is polling device state instead. Motion, smart detections and doorbell rings are not received until the connection
recovers.`, actions *Restart service* (service, `connector`, `restart`, primary) and *Open UniFi Protect settings*
(link `/extensions/devices-unifi-protect-plugin`) — the Home Assistant pattern. Resolved when a cycle reaches streaming,
and on a connector stop. `GET status` reports `connection_state: degraded` while polling. Events cannot be polled (the
public API has no events list), so open detections still end by the safety timeout. **Recommendation: as listed.**
*Cost if wrong:* threshold and texts are constants in Task 7.

**R8. Devices removed on the console** (issue, design §9.3). A `remove` frame, or an adopted device missing from a
**complete** snapshot (all three lists read), sets its connection state `disconnected` and raises one issue per device
(key `device_removed:<protectDeviceId>`, severity `warning`, title `UniFi Protect device removed`, message `<name> is no
longer adopted on the UniFi Protect console. Smart Panel keeps the device and shows it as disconnected; delete it in
Smart Panel if it is no longer needed.`, `data { device_id, protect_device_id }`). The issue resolves when the device
reappears (an `add` frame or a later snapshot). Devices are never deleted. A failed list read never marks anything
removed. **Recommendation: as listed.** *Cost if wrong:* the notification is the only side effect besides the state.

**R9. Protect renames (UP-7 deviation A10).** Options: (a) in-memory baseline: propagate a rename when the Smart Panel
name still equals the name the plugin would have derived from the previous console object held in the cache
(`toProtectDeviceName`, exported from the evaluator); (b) a `protectName` column (migration) written by adoption and the
sync; (c) defer. **Recommendation: (a), in Task 4.** No migration, no adoption change, and a user rename always wins
because it no longer matches. A rename that happens while the backend is down is not propagated (no baseline after a
restart). *Cost if wrong:* (b) later is one migration and two writes.

**R10. Buffering, ordering, debounce.** Frames that arrive while priming are buffered (≤ 1000, overflow fails the
cycle) and applied in arrival order after the snapshot; device frames carry no timestamp, and every change after the
subscription arrives as a frame, so applying all of them converges (the design's "apply buffered frames newer than the
prime" has nothing to compare). Priming reads `cameras`, `sensors`, `lights`; not `nvrs` (the connector reads it at
connect and no NVR field is mapped). One serial apply queue for both sockets (≤ 1000 pending, overflow drops the queue
and requests a re-prime). **No per-property debounce** (design §11 mentions HA's): writes are already diffed, and a
debounce works against the one-second target. **Recommendation: as listed.** *Cost if wrong:* a debounce is a timer
map in the synchronizer.

**R11. What the sync writes (A18).** Only property mappings whose value source is a `path` (state, settings, stats,
battery, light, microphone, indicator, model, serial) plus the connection state through `DeviceConnectivityService`,
plus the event-driven detections of R3. Never `constant` (event-driven defaults), `template` (`camera.source`,
`object_type`, `sound_type`) or `stream_status` (`camera.status` is UP-10's, roadmap §5). An evaluated `null` (type or
range mismatch, A17) never overwrites a stored value. These are exactly the values A18 protects: adoption writes a
constant only when nothing is stored, so live detections survive re-adoption; path values are rewritten by both from the
same console object. **Recommendation: as listed.** *Cost if wrong:* `camera.status` stays at its adoption value until
UP-10; `connection_state` covers online/offline meanwhile.

**R12. Counters and status.** `GET status` gains `realtime_state` (`stopped | connecting | priming | streaming |
polling`) and `ignored_event_count` (unknown event types and unknown detection types since start). Per-type counts are
kept in memory (≤ 32 distinct names matching `^[A-Za-z0-9_]{1,64}$`, others count as `invalid`) and each new name is
logged once at debug. Admin websocket status events (design §11) come with UP-12. **Recommendation: as listed.**
*Cost if wrong:* additive fields.

**R13. Console loss.** When the connector loses the console (session `lost`), the sync changes no device state: values
stay as last known and open detections end by their safety timers, which keep running. Marking devices `lost` would
flap with every console reboot. **Recommendation: as listed.** *Cost if wrong:* one loop over the index on `lost`.

**R14. Scope.** UP-8 only, 8 tasks. Control (UP-9), streams and `camera.status`/`camera.source` (UP-10), admin status UI
(UP-12) and the panel ring overlay (UP-14, roadmap A5) are later plans. The core change of R5 and one row in
`docs/hardware-inputs.md` are outside the issue's file ownership and are listed in the PR body.

---

## Global Constraints

- Branch `feat/unifi-protect-realtime`, cut from `main`. One PR titled exactly
  `feat(backend): sync UniFi Protect device state and events in real time`, body ending with `Closes #1184`. Never push to
  `main`; the final task writes the PR body to a file and does not push.
- Commits `<type>(<scope>): <lowercase imperative subject>`, header ≤ 100 characters, scope `backend` for
  `apps/backend/**`, `docs` for `docs/**`, `tasks` for `tasks/**`; each ends with
  `Co-Authored-By: <model that wrote it> <noreply@anthropic.com>`. The PR body ends with
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- TypeScript: tabs, single quotes, semicolons, trailing commas, print width 120; imports external, then `../`, then `./`,
  blank line between groups. Wire names snake_case via `@Expose({ name })`, properties camelCase.
- Never use the `generic` device category. Never edit generated files (`spec/api/v1/openapi.json`,
  `apps/admin/src/openapi.ts`, `apps/backend/src/spec`, `apps/panel/lib/api`, `apps/panel/lib/spec`; git-ignored, roadmap
  A11); regenerate locally only. No migration.
- Backend API conventions (CLAUDE.md) for the two status fields: `@ApiProperty` with `name`, `@Expose({ name })`; no new
  route.
- Secret rule (roadmap §4, design §4.3/§9.4): the API key (`X-API-KEY` on REST and on both upgrades) and every RTSPS URL or
  alias never reach a log line, an error, a response, a property value, an event, a notification or a database row. Upgrade
  failures become `ProtectApiError` with the endpoint template (`subscribe/devices`) and a category only; no `ws` or Node
  message is ever forwarded. Sentinels: key `FAKE_PROTECT_API_KEY` (`PROTECT_SENTINEL_KEY_7f3a9c0d1e2b4a6f`), aliases
  starting `SENTINELALIAS` (`test/support/fake-protect-server.ts:19-24`).
- Frame payloads are untrusted: text frames only, at most `PROTECT_MAX_FRAME_BYTES` (256 KiB, enforced by `ws`
  `maxPayload` and again by the parser), ids must match `PROTECT_ID_PATTERN` (`client/protect-endpoints.ts:4`), the merge
  never assigns `__proto__`, `constructor` or `prototype`, depth ≤ 8, ≤ 512 keys per object. Logs about frames use fixed
  texts with counts and categories, never frame content, names or ids beyond the 24-hex Protect id.
- All REST calls go through the client's rate pacer (`client/protect-rate-pacer.ts`); each upgrade takes one slot. No
  console write is added; never `disable-mic-permanently` (`client/protect-endpoints.ts` refuses it).
- Timers are `unref()`ed, cleared on stop and on module destroy; unit tests use `jest.useFakeTimers()`, fake sockets and
  a fake client — never a real console or network. Integration and e2e tests use `test/support/fake-protect-server.ts`
  only.
- Setup once per worktree: `pnpm run bootstrap`. Single test files run with `pnpm --filter ./apps/backend exec jest <path>`;
  e2e with `--config ./test/jest-e2e.json` (per-test timeout 30 s, `test/jest-e2e.json`).

### Verified facts (on `main` `4652bcb13`)

| # | Fact | Where |
|---|---|---|
| F1 | Connector: `getClient()`/`getConsoleIdentity()` non-null only while `connected`; it becomes connected at the end of `runAttempt`; `handleFailure` → `closeConnected()` closes the client; `start()`/`stop()` → `resetRuntime()` closes clients. No session listener exists. | `services/protect-connector.service.ts:181-190, 283-294, 350-370, 405-448` |
| F2 | The client keeps the key, a private `ProtectHttpsAgent` (null when a test transport is injected), a private pacer (`acquire(signal)`, `observe`, `backOff`) and a `lifetime` `AbortController` aborted by `close()`. List reads: `listCameras`, `listSensors`, `listLights` (each entry keeps `raw`). | `client/protect-api.client.ts:238-273, 299-334, 433-437`; `client/protect-rate-pacer.ts:172-259` |
| F3 | `ProtectHttpsAgent extends https.Agent` and overrides `createConnection` (verify chain + name, or SHA-256 pin, before the callback). `ws` sets `opts.createConnection` but passes `agent` to `https.request`, which then uses the agent. `ws` client options used here: `agent`, `headers`, `handshakeTimeout`, `maxPayload`, `perMessageDeflate`, `followRedirects` (default false), `autoPong`. | `client/protect-https-agent.ts:34-148`; installed `ws@8.21.1` `lib/websocket.js:637-773` |
| F4 | `PROTECT_ENDPOINTS` has no `subscribe/*` entry; `buildProtectPath` builds `/proxy/protect/integration/v1/<endpoint>`; `mapProtectHttpStatus(operation, status, headers, body)` maps 401/403/404/408/429/5xx. | `devices-unifi-protect.constants.ts:68-80`; `client/protect-endpoints.ts:13-39`; `client/protect-api.client.ts:80-119` |
| F5 | The fake console handles only `request` events (no `upgrade`), records requests in `requests`/`writes`, serves fixture lists unchanged and has no per-device state overlay. | `test/support/fake-protect-server.ts:107-474` |
| F6 | **The WebSocket fixtures are synthetic**, not captures: the spike saw no frames (`__fixtures__/README.md`, design "Spike results"). Event `update` frames carry only `id`, `modelKey`, `end` — no `device`, no `type`. No fixture covers `smartDetectLoiterZone`, `alrmCmonx`, `sensorAlarm`, `sensorBatteryLow` or an unknown type. `fixtures.spec.ts` requires the listed types and that every line is `_synthetic`. | `__fixtures__/ws-devices.jsonl`, `ws-events.jsonl`, `fixtures.spec.ts:24, 96-140` |
| F7 | Property value sources: event-driven detections, `tampered`, `leak.level` are `constant`; `connection_state` is `path: state` with the map `CONNECTED→connected, CONNECTING→init, DISCONNECTED→disconnected`, default `unknown`; `illuminance` and `illuminance_level` both read `stats.light.value`; `contact_detected` = `isOpened`; `sensor_motion_detected` = `isMotionDetected`; `camera_main_status` is `stream_status`. Channel identifiers: `motion`, `object_detection.<key>`, `smoke`, `carbon_monoxide`, `sound_detection.<key>`, `contact`, `leak`, `doorbell`. | `mappings/definitions/properties.yaml`, `channels.yaml` |
| F8 | `evaluateProtectMapping(mappings, { nvr, modelKey, device, streams })` never throws, returns per property `{ value, mappingName }`, and a value that does not fit the data type or format is `null`. `toDeviceName` (not exported) falls back to `UniFi Protect <modelKey> <id>`. `ProtectMappingLoaderService.getMappings()` returns the resolved mappings (`value` holds the source). | `mappings/mapping-evaluator.ts:273-310, 381-460`; `mappings/mapping-loader.service.ts:82`; `mappings/mapping.types.ts:36-41` |
| F9 | Adoption writes a constant only while the property has no stored value (A18), values with `strictValuePersistence` + `comparePersistedValue`, and runs under `ProtectAdoptionLockService.run(<protectDeviceId>)`. | `services/protect-adoption.service.ts:136, 488-492, 775-795` |
| F10 | `ProtectDeviceEntity` has `protectNvrId`, `protectDeviceId`, `protectModelKey`; channels have no mapping name (matched by `identifier`); properties have `protectMappingName`. `DevicesService.findAll(type)` loads channels and properties. | `entities/devices-unifi-protect.entity.ts`; `modules/devices/services/devices.service.ts:155-200` |
| F11 | `ChannelsPropertiesService.update(id, { type, value })` emits only `CHANNEL_PROPERTY_VALUE_SET` for a value-only change; structural changes emit `CHANNEL_PROPERTY_UPDATED`. `PropertyValueService.readLatestPersisted(property)`. `DeviceConnectivityService.trySetConnectionState(deviceId, { state })` returns false instead of throwing for a missing device. | `channels.properties.service.ts:1204-1213`; `property-value.service.ts:929`; `device-connectivity.service.ts:47-110` |
| F12 | `publishOccurrence(dto)` validates device, channel, property, permissions and input category (doorbell refused, R5), de-duplicates by `sourceOccurrenceId` for 5 s, emits `DevicesModule.ChannelInput.Occurrence`. DTO fields: `deviceId`, `channelId`, `propertyId`, `event`, `sourceTimestamp?`, `sourceOccurrenceId?`, `nativeEventType?`. | `channel-input-occurrences.service.ts:56-150`; `dto/channel-input-occurrence.dto.ts`; `channel-input-deduplication.service.ts:6` |
| F13 | `NotificationsModule` is `@Global`; `notify(input)` never throws, `resolve(source, key)` can; an `issue` needs a `key`; non-persistent issues are resolved by the boot cleanup. | `modules/notifications/notifications.module.ts:34-51`; `services/notifications.service.ts:27-39, 151, 191` |
| F14 | Security: `smoke.detected == true` → alert `type: smoke`, `severity: critical`, id `sensor:<deviceId>:smoke`; evaluated live on every `GET /api/v1/modules/security/status` (`data.active_alerts[]` with `id`, `type`, `severity`, `source_device_id`; `has_critical_alert`). | `modules/security/spec/definitions/detection-rules.yaml`; `providers/security-sensors.provider.ts:67-110`; `models/security-status.model.ts`; `app.module.ts:306` |
| F15 | Config `pollIntervalMs` default 30000, 5000–600000. `ProtectConnectionState.DEGRADED` exists and is unused. `GET status` serves `connectorService.getStatus()` to owner, admin and user. | `devices-unifi-protect.constants.ts:22-24, 59-67`; `models/config.model.ts:161-169`; `controllers/protect-status.controller.ts` |
| F16 | Plugin spec asserts the provider list (`provides and exports the connector …`, `:195`); the UP-5 e2e asserts `fake.requests` is empty while the connector is stopped (`test/devices-unifi-protect.e2e-spec.ts:405-563`). | `devices-unifi-protect.plugin.spec.ts:195`; e2e |

## Review Focus

Failure modes the spec implies but no acceptance criterion exercises, most likely first; each is pinned by a named test
in the task at the end of the line.

1. **The backend restarts (or the socket drops) in the middle of a detection or a leak**: the `end` never arrives, and
   the stored `true` would raise the alert forever. → Task 4 `resets a stored detection without an open event on every
   snapshot`, Task 5 `clears a detection 60 s after its last frame and re-arms on update`.
2. **Two overlapping events on one channel** (two motion events, or a person and a vehicle in one `smartDetectZone` that
   later gains a type): the channel stays detected until the last one ends; no type is lost. → Task 3 `keeps a target on
   until its last open event ends` and `opens a type added by an update`.
3. **A reconnect that replays the current events, or a duplicated `add`**: no second ring occurrence, no re-raised
   detection for an event that already ended. → Task 3 `drops an add for an event id it has already seen`, Task 6
   `re-primes after a drop and does not replay a ring`, e2e Task 8.
4. **A hostile or broken frame** (oversized, binary, `__proto__` keys, deep nesting, a non-string id, an `update` for an
   unknown device or event): nothing is written, nothing throws, nothing is polluted; the frame is counted. → Task 2
   `never pollutes a prototype`, `rejects oversized, deep and malformed frames`; Task 4 `ignores an update for a device
   it never saw`.
5. **A partial console read during polling or priming** (`GET sensors` fails while cameras succeed): no adopted sensor is
   marked removed and no notification is raised. → Task 4 `never marks devices removed from an incomplete snapshot`,
   Task 7 `keeps devices when a poll read fails`.

---

## File structure

All paths under `apps/backend/src/plugins/devices-unifi-protect/` unless stated.

| Path | Responsibility | Task |
|---|---|---|
| `devices-unifi-protect.constants.ts` (modify) | `subscribe/*` endpoints, realtime constants and states | 1 |
| `client/protect-subscription.ts` (new) | subscription types and the `ws` wrapper | 1 |
| `client/protect-api.client.ts` (modify) | `openSubscription()` | 1 |
| `apps/backend/test/support/fake-protect-server.ts` (modify) | both WebSockets, frame injection, upgrade refusal, REST overlay | 1 |
| `services/protect-frame-merge.ts` (new) | pure parse, merge, syncable values, diff | 2 |
| `mappings/mapping-evaluator.ts` (modify) | export `toProtectDeviceName` | 2 |
| `__fixtures__/ws-devices.jsonl`, `ws-events.jsonl`, `README.md` (modify) | synthetic frames for the uncovered cases | 2, 3 |
| `services/protect-event-tracker.ts` (new) | pure event table, open events, timeout, seen ids | 3 |
| `services/protect-synchronizer.service.ts` (new) | index, snapshots, device frames, removals, renames, events, rings | 4, 5 |
| `apps/backend/src/modules/devices/services/channel-input-occurrences.service.ts` (modify) | doorbell is an input channel (R5) | 5 |
| `services/protect-connector.service.ts` (modify) | `onSessionChange` | 6 |
| `services/protect-realtime.service.ts` (new) | socket cycle, buffer, prime, pings, reconnect, polling, notification | 6, 7 |
| `models/status.model.ts`, `controllers/protect-status.controller.ts` (modify) | `realtime_state`, `ignored_event_count`, `degraded` | 7 |
| `devices-unifi-protect.plugin.ts`, `devices-unifi-protect.plugin.spec.ts` (modify) | providers, timings token, readme | 7, 8 |
| `apps/backend/test/devices-unifi-protect-realtime.e2e-spec.ts` (new) | frames → properties → security alert, ring, reconnect, degraded | 8 |
| `docs/hardware-inputs.md`, `tasks/epics/EPIC-UNIFI-PROTECT.md:103` (modify) | provider row; `UP-8 (done)` | 8 |

Specs sit next to their source (`*.spec.ts`). Each task ends green and committed.

---

### Task 1: Client subscriptions and the fake console's WebSockets

**Files:**
- Create: `client/protect-subscription.ts`
- Modify: `devices-unifi-protect.constants.ts`, `client/protect-api.client.ts`, `apps/backend/test/support/fake-protect-server.ts`
- Test: `client/protect-api.client.spec.ts`, `client/protect-api.client.integration.spec.ts`, `client/protect-endpoints.spec.ts`

**Interfaces:**
- Consumes: F2–F5.
- Produces:
  ```ts
  // devices-unifi-protect.constants.ts — append 'subscribe/devices', 'subscribe/events' to PROTECT_ENDPOINTS
  export const PROTECT_SUBSCRIPTION_TOPICS = ['devices', 'events'] as const;
  export type ProtectSubscriptionTopic = (typeof PROTECT_SUBSCRIPTION_TOPICS)[number];
  export const PROTECT_WS_PING_INTERVAL_MS = 180_000;
  export const PROTECT_WS_PONG_TIMEOUT_MS = 30_000;
  export const PROTECT_MAX_FRAME_BYTES = 256 * 1024;
  export const PROTECT_MAX_BUFFERED_FRAMES = 1000;
  export const PROTECT_MAX_PENDING_FRAMES = 1000;
  export const PROTECT_DEGRADED_AFTER_FAILURES = 3;
  export const PROTECT_EVENT_SAFETY_TIMEOUT_MS = 60_000;
  export const PROTECT_MAX_SEEN_EVENTS = 1024;
  export const PROTECT_MAX_OPEN_EVENTS = 256;
  export const PROTECT_REALTIME_STATES = ['stopped', 'connecting', 'priming', 'streaming', 'polling'] as const;
  export type ProtectRealtimeState = (typeof PROTECT_REALTIME_STATES)[number];

  // client/protect-subscription.ts
  export interface ProtectSubscriptionHandlers {
  	message(text: string): void;          // text frames only
  	pong(): void;
  	/** Called once when the open socket ends for any reason other than close(); never after close(). */
  	closed(failure: ProtectApiError): void;
  }
  export interface ProtectSubscription {
  	readonly topic: ProtectSubscriptionTopic;
  	ping(): void;
  	/** Idempotent; terminates the socket and suppresses `closed`. */
  	close(): void;
  }
  export const protectSubscriptionEndpoint = (topic: ProtectSubscriptionTopic): ProtectEndpoint; // 'subscribe/devices' | 'subscribe/events'

  // client/protect-api.client.ts
  /** Resolves once the upgrade succeeded; rejects with a ProtectApiError (operation = the endpoint template). */
  openSubscription(topic: ProtectSubscriptionTopic, handlers: ProtectSubscriptionHandlers, options?: ProtectCallOptions): Promise<ProtectSubscription>;

  // test/support/fake-protect-server.ts
  readonly upgrades: FakeProtectRequest[];                              // every upgrade attempt; cleared by reset()
  pingsReceived: number;
  subscriptionCount(topic: 'devices' | 'events'): number;               // open sockets
  sendFrame(topic: 'devices' | 'events', frame: unknown): void;         // JSON.stringify to every open socket of the topic
  sendRaw(topic: 'devices' | 'events', data: string | Buffer, binary?: boolean): void;
  dropSubscriptions(): void;                                            // terminate every open socket
  refuseUpgrades(response: { status: number; headers?: Record<string, string> } | null): void;
  answerPings(enabled: boolean): void;                                  // default true
  updateDevice(resource: 'cameras' | 'sensors' | 'lights', id: string, patch: Record<string, unknown>): void; // shallow overlay on list and by-id reads
  removeDevice(resource: 'cameras' | 'sensors' | 'lights', id: string): void; // hidden from list and by-id reads
  ```
- Client rules (decided): `openSubscription` fails with `CANCELLED` if the client is closed or `options.signal` aborted;
  with `VALIDATION` when the client was built with a test transport (no agent); it awaits one `pacer.acquire`, then opens
  `wss://<host or [ipv6]>:<port><buildProtectPath(endpoint)>` with `{ agent, headers: { 'X-API-KEY': key },
  handshakeTimeout: timeoutMs, maxPayload: PROTECT_MAX_FRAME_BYTES, perMessageDeflate: false, followRedirects: false }`.
  `unexpected-response` → `mapProtectHttpStatus(endpoint, status, headers, Buffer.alloc(0))` (a 429 also calls
  `pacer.backOff(retryAfter)`), response drained, request destroyed; `error` before open →
  `toProtectApiError(error, endpoint)` re-built with the endpoint as operation. After open: text → `handlers.message`
  (binary frames are dropped and logged at debug as `subscribe/<topic> dropped a binary frame`), `pong` →
  `handlers.pong`, `close`/`error` → `handlers.closed(new ProtectApiError(UNAVAILABLE, endpoint))` once (a `ws` max-payload
  close maps to `PROTOCOL`). `close()` of the client aborts pending opens and terminates every subscription it opened
  without calling `closed`. Log lines: `WS subscribe/<topic> open <ms>ms` and `WS subscribe/<topic> failed (<category>)`,
  through `redactProtectText(…, [apiKey])`.
- Fake console rules (decided): `server.on('upgrade')` accepts only `GET /proxy/protect/integration/v1/subscribe/devices|events`
  (else `404`), records `upgrades` (with `hadApiKey`), answers a queued `refuseUpgrades` response, then `401` for a wrong or
  missing key, else hands the socket to a `WebSocketServer({ noServer: true })`. Upgrades are not rate limited and never
  enter `requests`. `stop()` terminates sockets. The overlay applies to `GET cameras|sensors|lights` and by-id reads;
  `reset()` clears overlay, removals, upgrades, refusals and `pingsReceived`, and re-enables pongs.

- [ ] **Step 1: Bootstrap the worktree**

Run: `pnpm run bootstrap`
Expected: exit 0 and `apps/backend/src/spec/` exists.

- [ ] **Step 2: Write the failing unit tests** (`protect-api.client.spec.ts`, `protect-endpoints.spec.ts`)

```ts
it('builds the subscribe paths', ...); // buildProtectPath('subscribe/devices') === '/proxy/protect/integration/v1/subscribe/devices'; same for events
it('refuses to open a subscription without a TLS agent', ...); // client with FakeTransport -> rejects category 'validation'; transport.requests.length 0
it('refuses to open a subscription after close', ...); // client.close(); -> 'cancelled'
```

- [ ] **Step 3: Write the failing integration tests** (`protect-api.client.integration.spec.ts`, real client against
  `FakeProtectServer`, pinned self-signed fingerprint as the existing tests do)

```ts
it('opens both subscriptions with the key and receives text frames', ...);
// open devices + events; fake.upgrades.length 2, every hadApiKey true; fake.sendFrame('events', firstLine('ws-events.jsonl')) -> message called with the exact JSON text
it('ignores binary frames and reports pongs', ...); // sendRaw('devices', Buffer.from('x'), true) -> no message; sub.ping() -> pong called; fake.pingsReceived 1
it('reports a dropped socket once and nothing after close()', ...); // dropSubscriptions -> closed called once, category 'unavailable'; a second sub closed via close() -> closed not called
it.each([[401, 'authentication'], [403, 'authorization'], [404, 'not_found'], [503, 'unavailable']])('maps an upgrade answered %i to %s', ...);
it('maps a 429 upgrade with Retry-After and backs the pacer off', ...); // refuseUpgrades({ status: 429, headers: { 'retry-after': '2' } }) -> 'rate_limited', retryAfterMs ≈ 2000
it('refuses a wrong pin before the key is sent', ...); // pinned fingerprint of another cert -> 'tls_fingerprint_mismatch'; fake.upgrades.length 0
it('closes a frame larger than the limit as a protocol failure', ...); // sendRaw('events', 'x'.repeat(PROTECT_MAX_FRAME_BYTES + 1)) -> closed('protocol')
it('terminates subscriptions when the client is closed', ...); // client.close() -> fake.subscriptionCount('devices') reaches 0, closed not called
it('never puts the key into errors or log lines of a failed upgrade', ...); // logger spies + error messages do not contain FAKE_PROTECT_API_KEY; the material contains 'subscribe/devices'
it('serves the REST overlay and removals', ...); // updateDevice('cameras', id0, { state: 'DISCONNECTED' }) -> listCameras()[0].state 'DISCONNECTED'; removeDevice -> getCamera 404 'not_found'
```

- [ ] **Step 4: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/client`
Expected: FAIL (`openSubscription is not a function`, unknown endpoint `subscribe/devices`).

- [ ] **Step 5: Implement** the constants, `protect-subscription.ts` (one class `NodeProtectSubscription` wrapping a `ws`
  `WebSocket`, `closed` guarded by a `settled` flag), `openSubscription` per the client rules, and the fake console rules.

- [ ] **Step 6: Run to verify pass**

Run: the Step 4 command, then
`pnpm --filter ./apps/backend exec jest --config ./test/jest-e2e.json test/devices-unifi-protect.e2e-spec.ts test/devices-unifi-protect-discovery.e2e-spec.ts test/devices-unifi-protect-adoption.e2e-spec.ts`
Expected: PASS; the three existing suites are unchanged (nothing opens a socket yet).

- [ ] **Step 7: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect test/support/fake-protect-server.ts
git add apps/backend/src/plugins/devices-unifi-protect apps/backend/test/support/fake-protect-server.ts
git commit -m "feat(backend): open UniFi Protect device and event subscriptions over the verified TLS agent"
```

---

### Task 2: Frame parsing, merge and mapped-value diff (pure)

**Files:**
- Create: `services/protect-frame-merge.ts`
- Modify: `mappings/mapping-evaluator.ts` (export the name rule), `__fixtures__/ws-devices.jsonl`, `__fixtures__/README.md`
- Test: `services/protect-frame-merge.spec.ts`, `mappings/mapping-evaluator.spec.ts`

**Interfaces:**
- Consumes: F7, F8; `PROTECT_ID_PATTERN`; `ProtectResolvedMappings`, `ProtectMappedDevice`, `ProtectMappingScalar`.
- Produces:
  ```ts
  export type ProtectFrameAction = 'add' | 'update' | 'remove';
  export interface ProtectFrame { action: ProtectFrameAction; id: string; modelKey: string; item: Readonly<Record<string, unknown>> }
  export type ProtectFrameRejection = 'too_large' | 'not_json' | 'invalid_shape' | 'too_deep';
  /** Never throws. modelKey must match ^[A-Za-z]{1,32}$, id PROTECT_ID_PATTERN, type add|update|remove, item a plain object. */
  export function parseProtectFrame(text: string): { frame: ProtectFrame } | { rejected: ProtectFrameRejection };
  /** New object; plain objects merge recursively, everything else (arrays included) replaces; skips __proto__/constructor/prototype; depth ≤ 8, ≤ 512 keys per object (extra keys dropped). */
  export function mergeProtectItem(cached: Readonly<Record<string, unknown>>, partial: Readonly<Record<string, unknown>>): Record<string, unknown>;
  export interface ProtectConsoleEntry { modelKey: 'camera' | 'sensor' | 'light'; id: string; raw: Readonly<Record<string, unknown>> }
  export const PROTECT_SYNC_MODEL_KEYS: readonly ProtectConsoleEntry['modelKey'][]; // ['camera','sensor','light']
  /** Mapping names the sync may write: value source `path`, minus 'connection_state'. */
  export function syncableMappingNames(mappings: ProtectResolvedMappings): ReadonlySet<string>;
  export interface ProtectValueChange { channelIdentifier: string; mappingName: string; value: Exclude<ProtectMappingScalar, null> }
  /** Syncable, non-null values of `next` that differ from `previous` (keyed `${channelIdentifier}\u0000${mappingName}`); previous null = all. */
  export function diffMappedValues(previous: ReadonlyMap<string, ProtectMappingScalar> | null, next: ProtectMappedDevice, syncable: ReadonlySet<string>): ProtectValueChange[];
  export function mappedValueMap(device: ProtectMappedDevice): Map<string, ProtectMappingScalar>;
  /** The mapped connection_state value ('connected' | 'init' | 'disconnected' | 'unknown') or null. */
  export function mappedConnectionState(device: ProtectMappedDevice): string | null;
  // mappings/mapping-evaluator.ts: rename toDeviceName -> exported toProtectDeviceName(device, modelKey, id); behaviour unchanged
  ```

- [ ] **Step 1: Add synthetic device frames** to `ws-devices.jsonl` (each line `"_synthetic":true`): a camera rename
  `{"type":"update","item":{"id":"600cefafd5f365d6f83c4ef3","modelKey":"camera","name":"Front porch"}}`, a camera LED
  change `{"…","ledSettings":{"isEnabled":true}}`, a sensor light-level change `{"id":"5f0000000000000000000b01",
  "modelKey":"sensor","stats":{"light":{"value":8}}}`, a tamper clear `{"…b01","modelKey":"sensor","tamperingDetectedAt":null}`,
  and a `remove` of `5f0000000000000000000b01`. Update the `ws-devices.jsonl` README row to list them.

- [ ] **Step 2: Write the failing tests** (`protect-frame-merge.spec.ts`; replay `ws-devices.jsonl` lines, `cameras.json`,
  `sensors.json[0]`, the real loader output via `new ProtectMappingLoaderService(…)` as `mapping-evaluator.spec.ts` builds it)

```ts
it('parses every recorded device and event frame', ...); // every line of both jsonl files -> { frame } with action === line.type
it.each([
	['too_large', 'x'.repeat(PROTECT_MAX_FRAME_BYTES + 1)], ['not_json', '{'], ['invalid_shape', '{"type":"patch","item":{"id":"a","modelKey":"camera"}}'],
	['invalid_shape', '{"type":"update","item":{"id":"../x","modelKey":"camera"}}'], ['invalid_shape', '{"type":"update","item":[]}'],
	['too_deep', JSON.stringify({ type: 'update', item: { id: 'a', modelKey: 'camera', a: nest(20) } })],
])('rejects %s frames', ...);
it('merges a partial update into the cached object without touching siblings', ...); // cameras.json[0] + {ledSettings:{isEnabled:true}} -> ledSettings.isEnabled true, featureFlags deep-equal original, original object unchanged
it('replaces arrays instead of merging them', ...); // featureFlags.smartDetectTypes ['person'] replaces ['person','vehicle','animal']
it('never pollutes a prototype', ...); // partial parsed from '{"__proto__":{"polluted":1},"constructor":{"prototype":{"polluted":1}}}' -> ({} as any).polluted undefined; result has no own __proto__/constructor key
it('drops keys beyond 512 per object', ...);
it('diffs only syncable path values', ...);
// evaluate sensors.json[0] (baseline) and merge of {stats:{light:{value:8}}}: changes toEqual [
//  { channelIdentifier: 'illuminance', mappingName: 'illuminance', value: 8 }, { channelIdentifier: 'illuminance', mappingName: 'illuminance_level', value: 'dark' } ]
it('never reports constants, templates, stream status or connection_state', ...); // syncableMappingNames excludes camera_motion_detected, object_type, camera_main_source, camera_main_status, connection_state, leak_level; includes contact_detected, battery_status, light_brightness, camera_indicator_on
it('skips a null value instead of clearing', ...); // micVolume 'loud' -> microphone_volume null -> no change entry
it('reports the mapped connection state', ...); // state DISCONNECTED -> 'disconnected'; 'FOO' -> 'unknown'
```
`mapping-evaluator.spec.ts`: `it('derives the device name from the console name or the fallback')` — `toProtectDeviceName({ name: ' Front ' }, 'camera', 'a')` is `'Front'`, `{}` gives `'UniFi Protect camera a'`.

- [ ] **Step 3: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/services/protect-frame-merge.spec.ts src/plugins/devices-unifi-protect/mappings src/plugins/devices-unifi-protect/__fixtures__`
Expected: FAIL (module `protect-frame-merge` not found); the fixtures suite still PASSES.

- [ ] **Step 4: Implement** the module and the export. Depth is checked while merging and, for `parseProtectFrame`, by
  one bounded walk of the parsed item.

- [ ] **Step 5: Run to verify pass** — the Step 3 command. Expected: PASS.

- [ ] **Step 6: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect
git add apps/backend/src/plugins/devices-unifi-protect
git commit -m "feat(backend): parse and merge UniFi Protect device frames into mapped value changes"
```

---

### Task 3: Event tracker (pure)

**Files:**
- Create: `services/protect-event-tracker.ts`
- Modify: `__fixtures__/ws-events.jsonl`, `__fixtures__/README.md`
- Test: `services/protect-event-tracker.spec.ts`

**Interfaces:**
- Consumes: `ProtectFrame` (Task 2); `PROTECT_EVENT_SAFETY_TIMEOUT_MS`, `PROTECT_MAX_SEEN_EVENTS`, `PROTECT_MAX_OPEN_EVENTS` (Task 1).
- Produces:
  ```ts
  export interface ProtectTargetWrite { channelIdentifier: string; mappingName: string; value: string | boolean }
  export type ProtectEventEffect =
  	| { kind: 'write'; protectDeviceId: string; writes: ProtectTargetWrite[] }
  	| { kind: 'ring'; protectDeviceId: string; eventId: string; startedAt: number | null };
  export type ProtectEventIgnore = 'unknown_type' | 'unknown_detection_type' | 'unmapped_type' | 'covered_type' | 'duplicate' | 'unknown_event' | 'invalid';
  export interface ProtectEventOutcome { effects: ProtectEventEffect[]; ignored: { reason: ProtectEventIgnore; name: string | null }[] }
  export type ProtectEventKind = 'duration' | 'instant' | 'latch' | 'ring' | 'covered' | 'unmapped';
  export interface ProtectEventTarget { key: string; start: ProtectTargetWrite[]; end: ProtectTargetWrite[] } // key = channel identifier
  /** The R3 table. `unknownTypes` lists smartDetectTypes entries without a target. */
  export function resolveProtectEventTargets(type: string, smartDetectTypes: readonly string[]): { kind: ProtectEventKind; targets: ProtectEventTarget[]; unknownTypes: string[] } | null; // null = unknown event type
  export class ProtectEventTracker {
  	constructor(options?: { safetyTimeoutMs?: number; maxSeen?: number; maxOpen?: number });
  	apply(frame: ProtectFrame, now: number): ProtectEventOutcome; // frames with modelKey 'event' only
  	expire(now: number): ProtectEventEffect[];
  	nextDeadline(): number | null;
  	/** Channel identifiers with at least one open event for the device. */
  	openTargets(protectDeviceId: string): ReadonlySet<string>;
  	clear(): void;
  }
  ```
- Table (decided, R3): object keys `person, vehicle, animal, package, licensePlate→license_plate, face`; audio keys
  `alrmSmoke→smoke/smoke_alarm_sound_detected`, `alrmCmonx→carbon_monoxide/co_alarm_sound_detected`,
  `alrmGlassBreak→glass_break, alrmBurglar→burglar_alarm, alrmSiren→siren, alrmBabyCry→baby_cry, alrmSpeak→speech,
  alrmBark→dog_bark, alrmCarHorn→car_horn` on `sound_detection.<key>/sound_detected`; mapping names for the rest:
  `motion` → `motion/camera_motion_detected`, object → `object_detection.<key>/object_detected`, `sensorMotion` →
  `motion/sensor_motion_detected`, `sensorWaterLeak` → `leak` start `[leak_detected true, leak_level 'high']` end
  `[false, 'low']`, `sensorAlarm` → `smoke/sensor_smoke_detected`, `sensorOpened`/`sensorClosed` →
  `contact/contact_detected` true/false, `sensorTamper` → latch `[contact/contact_tampered true, motion/sensor_motion_tampered true]`,
  `ring` → ring, `sensorBatteryLow` → covered, `lightMotion` → unmapped.
- Tracker rules (decided): an `add` needs string `type`, string `device` (`PROTECT_ID_PATTERN`) and a finite `start` or
  none; a seen id (open or ended, LRU of `maxSeen`) → `duplicate`; an `add` with a non-null `end` applies start and end
  at once. Open events are keyed by event id and hold `{ protectDeviceId, kind, targets, deadline }`; a target is "on"
  while any open event of that device holds its key, so `end` writes only targets no other open event holds. An
  `update` for an open id re-arms the deadline (`now + safetyTimeoutMs`) and, for smart detections, opens added types;
  an `update` with `end` closes it; an `update` or `remove` for an unknown id → `unknown_event` (no effect). `expire`
  closes every event past its deadline like an `end`. Beyond `maxOpen` open events the oldest is expired first. Instant,
  latch, ring and covered kinds are never "open". `ignored.name` is the type only when it matches
  `^[A-Za-z0-9_]{1,64}$`, else null.

- [ ] **Step 1: Add synthetic event frames** to `ws-events.jsonl` (ids `5f00000000000000000e0014` onward, each an `add` with
  `end: null` followed by an `update` with `end`, `"_synthetic":true`): `smartDetectLoiterZone` `["animal"]` on the
  Front door; `smartDetectZone` `["person","vehicle"]`; `smartAudioDetect` `["alrmCmonx"]`; `sensorAlarm`,
  `sensorBatteryLow` on `5f0000000000000000000b01`; an unknown type `sensorExtremeValues`; a `smartDetectZone` with
  `["pet"]`. Update the README row.

- [ ] **Step 2: Write the failing tests** (`protect-event-tracker.spec.ts`; frames from `ws-events.jsonl` through
  `parseProtectFrame`)

```ts
it('maps every recorded event type to its channels', ...);
// replay all add/update pairs at now = 0, 1, …; collected write effects contain, per pair, the start then the end writes:
// e0001 motion -> motion/camera_motion_detected true,false; e0002 -> object_detection.person; e0003 -> object_detection.vehicle; e0004 smartDetectLine -> person;
// e0005 -> smoke/smoke_alarm_sound_detected; e0006 -> sound_detection.baby_cry/sound_detected; e0010 -> motion/sensor_motion_detected;
// e0011 -> leak [leak_detected true, leak_level 'high'] then [false, 'low']; e0008/e0009 -> contact_detected true / false (instant, ends write nothing)
it('publishes a ring once on add and nothing on its end', ...); // e0007 -> one { kind:'ring', protectDeviceId:'5f0000000000000000000a01', eventId:'5f00000000000000000e0007', startedAt:1794400007000 }; its update -> no effect
it('latches tamper on both tampered properties and never times it out', ...); // e0012 -> writes contact_tampered true, sensor_motion_tampered true; expire(now + 10 min) -> []
it('ignores and names unknown, unmapped and covered types', ...); // sensorExtremeValues -> ignored [{reason:'unknown_type', name:'sensorExtremeValues'}]; lightMotion -> 'unmapped_type'; sensorBatteryLow -> 'covered_type'; ["pet"] -> 'unknown_detection_type', name 'pet'
it('keeps a target on until its last open event ends', ...); // two motion adds A,B; end A -> no write; end B -> motion false
it('opens a type added by an update', ...); // add ["person"], update smartDetectTypes ["person","vehicle"] -> vehicle true; end -> person false and vehicle false
it('clears a detection 60 s after its last frame and re-arms on update', ...); // add at 0; update (no end) at 50_000; expire(100_000) -> []; nextDeadline() 110_000; expire(110_000) -> motion false
it('drops an add for an event id it has already seen', ...); // add, end, add again (same id) -> third outcome effects [], ignored 'duplicate'; ring add twice -> one ring
it('ignores updates for events it never saw', ...); // update with end for unknown id -> effects [], ignored 'unknown_event'
it('applies an add that already carries its end', ...); // motion add with end set -> true then false in one outcome
it('bounds open and seen events', ...); // maxOpen 2: third add expires the oldest (its end writes emitted); maxSeen 3: the first id is forgotten after 4 more ids
it('rejects malformed event adds', ...); // missing device, device '../x', type 42 -> ignored 'invalid', no effect
it('names an unsafe type as null', ...); // type 'a b' -> { reason: 'unknown_type', name: null }
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/services/protect-event-tracker.spec.ts src/plugins/devices-unifi-protect/__fixtures__`
Expected: FAIL (module not found); the fixtures suite PASSES.

- [ ] **Step 4: Implement** `resolveProtectEventTargets` as frozen lookup tables (`Object.hasOwn`, never `in`) and the
  tracker (a `Map` for open events, a `Map` used as LRU for seen ids).

- [ ] **Step 5: Run to verify pass** — the Step 3 command. Expected: PASS.

- [ ] **Step 6: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect
git add apps/backend/src/plugins/devices-unifi-protect
git commit -m "feat(backend): track UniFi Protect events per device with a safety timeout and replay protection"
```

---

### Task 4: Synchronizer — index, snapshots, device frames, removals and renames

**Files:**
- Create: `services/protect-synchronizer.service.ts`
- Test: `services/protect-synchronizer.service.spec.ts`

**Interfaces:**
- Consumes: Task 2; F7–F11, F13; `ProtectMappingLoaderService`, `ProtectConsoleIdentity` (connector), `DevicesService`,
  `ChannelsPropertiesService`, `PropertyValueService`, `DeviceConnectivityService`, `NotificationsService`.
- Produces:
  ```ts
  export interface ProtectSnapshot { complete: boolean; entries: ProtectConsoleEntry[] } // complete = all three lists read
  export interface ProtectSyncCounters { framesIgnored: number; writesFailed: number; ignoredEventCount: number; ignoredEventTypes: ReadonlyMap<string, number> }
  @Injectable() export class ProtectSynchronizerService {
  	/** Serial; resolves when applied. Replaces the cache, diffs against stored values, reconciles removals and stale detections. */
  	applySnapshot(identity: ProtectConsoleIdentity, snapshot: ProtectSnapshot): Promise<void>;
  	/** Enqueued on the serial queue; never throws. Returns false when the queue was full (caller re-primes). */
  	enqueueFrame(identity: ProtectConsoleIdentity, frame: ProtectFrame): boolean;
  	/** Resolves when the queue is empty (tests, realtime). */
  	idle(): Promise<void>;
  	getCounters(): ProtectSyncCounters;
  	/** Plugin stop: drops queue, caches, tracker and timers; writes nothing. */
  	reset(): void;
  	@OnEvent(DEVICE_CREATED | DEVICE_UPDATED | DEVICE_DELETED | CHANNEL_CREATED | CHANNEL_UPDATED | CHANNEL_DELETED | CHANNEL_PROPERTY_CREATED | CHANNEL_PROPERTY_UPDATED | CHANNEL_PROPERTY_DELETED) invalidateIndex(): void;
  }
  ```
- Rules (decided):
  - *Index*: `DevicesService.findAll<ProtectDeviceEntity>(DEVICES_UNIFI_PROTECT_TYPE)`, enabled devices whose
    `protectNvrId === identity.nvrId`, keyed by `protectDeviceId` (first by panel id order on duplicates); properties keyed
    `${channel.identifier}\u0000${protectMappingName}`. Rebuilt lazily when invalidated (Homey `ensureIndex` pattern,
    `homey-synchronizer.service.ts:370-455`). `lastWritten: Map<propertyId, scalar>` is seeded from
    `readLatestPersisted` when a property first enters the index.
  - *Snapshot*: the cache becomes the snapshot's entries (previous raw kept per id for the rename baseline). For each
    adopted device present: evaluate (`streams: null`), write `diffMappedValues` changes whose value differs from
    `lastWritten`, set the connection state through `trySetConnectionState` when it differs from the last one set, clear
    tamper (`contact_tampered`, `sensor_motion_tampered` → false when stored true and `tamperingDetectedAt === null`), reset
    stale detections (every stored-`true` property among `camera_motion_detected, object_detected,
    smoke_alarm_sound_detected, co_alarm_sound_detected, sound_detected, sensor_smoke_detected, leak_detected` whose
    channel is not in `tracker.openTargets(id)` → false; `leak_level` → `'low'` with `leak_detected`), resolve its
    removal issue if raised, propagate a rename (below). For each adopted device absent: only when `complete`, mark
    removed (R8) unless already marked.
  - *Device frame* (`modelKey` in `PROTECT_SYNC_MODEL_KEYS`; others count `framesIgnored`): `add` → cache the item, and if
    adopted run the snapshot path for that one device (resolving its removal); `update` for a cached id → merge, evaluate,
    write changes, connection state, tamper clear when the partial sets `tamperingDetectedAt: null`, rename; `update` for
    an unknown id → `framesIgnored`; `remove` → drop from cache, mark removed if adopted.
  - *Rename (R9)*: when the merged raw has a different `name` and the panel device's `name ===
    toProtectDeviceName(previousRaw, modelKey, id)`, `DevicesService.update(panelId, { type: DEVICES_UNIFI_PROTECT_TYPE,
    name: toProtectDeviceName(mergedRaw, modelKey, id) })`.
  - *Writes*: `ChannelsPropertiesService.update(id, { type: DEVICES_UNIFI_PROTECT_TYPE, value })` without strict options;
    a failure increments `writesFailed`, logs `UniFi Protect property update failed` (at most once per 60 s with a
    suppressed count) and leaves `lastWritten` unchanged.
  - *Removal*: `trySetConnectionState(panelId, { state: ConnectionState.DISCONNECTED })` and `notify` per R8; the
    removed set is in memory, so a restart re-raises through the next complete snapshot. `resolve` failures are logged
    and retried on the next appearance.
  - *Queue*: one promise chain; length > `PROTECT_MAX_PENDING_FRAMES` → `enqueueFrame` returns false and drops the frame.

- [ ] **Step 1: Write the failing tests** (`protect-synchronizer.service.spec.ts`; Jest mocks for the device services and
  notifications as `homey-synchronizer.service.spec.ts` does; adopted entities built from `__fixtures__/expected/camera.json`
  and `sensor.json` with generated UUIDs, `protectNvrId` = `nvrs.json` id; the real mapping loader)

```ts
it('writes only values that differ from the stored ones on a snapshot', ...);
// stored values = golden values; snapshot with cameras.json[0] where ledSettings.isEnabled true -> exactly one update(indicatorOnId, { type, value: true }); no other update
it('sets the connection state through the connectivity service', ...); // state DISCONNECTED -> trySetConnectionState(panelId, { state: 'disconnected' }); never update() on connection_state
it('applies a recorded device frame within the same tick of the queue', ...); // enqueue ws-devices line 'isOpened true' -> await idle() -> update(contactDetectedId, true)
it('updates illuminance and its level from one light-level frame', ...); // {stats:{light:{value:8}}} -> illuminance 8 and level 'dark'
it('never writes constants, templates or camera status from a frame', ...); // a frame changing state CONNECTED->CONNECTED and name -> no update on camera_main_status, camera_main_source, camera_motion_detected
it('resets a stored detection without an open event on every snapshot', ...); // stored motion.detected true -> snapshot -> update(motionId, false); with an open tracked motion event -> no update
it('clears tamper when the console reports it cleared', ...); // stored contact_tampered true + frame tamperingDetectedAt null -> false
it('ignores an update for a device it never saw', ...); // update for id 'ffffffffffffffffffffffff' -> no call, counters.framesIgnored 1
it('ignores devices of another console and disabled devices', ...);
it('marks a removed device disconnected and notifies once', ...);
// remove frame for the sensor -> trySetConnectionState(disconnected) and notify({ source:'devices-unifi-protect-plugin', kind:'issue', key:'device_removed:5f0000000000000000000b01', severity:'warning', title:'UniFi Protect device removed', … }); a second remove -> no second notify
it('resolves the removal when the device reappears', ...); // add frame for the sensor -> resolve('devices-unifi-protect-plugin', 'device_removed:5f0000000000000000000b01'); connection state from its state
it('never marks devices removed from an incomplete snapshot', ...); // complete:false without the sensor -> no notify, no state change
it('propagates a Protect rename only while the Smart Panel name is the derived one', ...);
// device name 'Front door' (= previous console name) + frame name 'Front porch' -> update(panelId, { type, name: 'Front porch' }); device renamed 'My cam' in SP -> no update
it('keeps the last value when a write fails and logs a fixed text', ...); // update rejects -> counters.writesFailed 1; next identical frame retries the write; the log text equals 'UniFi Protect property update failed'
it('rebuilds the index after a device is created', ...); // invalidateIndex() then a frame for a newly adopted id -> written
it('refuses frames beyond the queue limit', ...); // with a blocked update, 1001st enqueueFrame -> false
it('reset drops caches and writes nothing', ...);
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/services/protect-synchronizer.service.spec.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** the service per the rules. It owns one `ProtectEventTracker` instance (used in Task 5; here
  only `openTargets` is read). Logs never include names, values or frame content.

- [ ] **Step 4: Run to verify pass** — the Step 2 command. Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect
git add apps/backend/src/plugins/devices-unifi-protect
git commit -m "feat(backend): sync UniFi Protect device state from snapshots and device frames"
```

---

### Task 5: Synchronizer — events, safety timeout and doorbell rings

**Files:**
- Modify: `services/protect-synchronizer.service.ts`, `apps/backend/src/modules/devices/services/channel-input-occurrences.service.ts`
- Test: `services/protect-synchronizer.service.spec.ts`, `apps/backend/src/modules/devices/services/channel-input-occurrences.service.spec.ts`

**Interfaces:**
- Consumes: Task 3 (`ProtectEventTracker`, effects); Task 4 (index, writes, queue); F12.
- Produces: event frames (`modelKey === 'event'`) handled by `enqueueFrame`; `getCounters().ignoredEventCount` /
  `ignoredEventTypes` filled from `unknown_type` and `unknown_detection_type` outcomes (≤ 32 names, others under
  `invalid`); one `unref`'d timer on `tracker.nextDeadline()` that enqueues `tracker.expire(Date.now())`. In the core
  service, `publishOccurrence` and `getInputCapabilities` treat `ChannelCategory.DOORBELL` like `BUTTON`.
- Rules (decided): a `write` effect writes each `ProtectTargetWrite` the adopted device has (index key), skipping values
  equal to `lastWritten`; targets the device lacks are skipped silently (an event for an unadopted device, or a channel
  the capabilities did not create). A `ring` effect on an adopted device with a `doorbell` channel and its
  `doorbell_event` property calls `publishOccurrence({ deviceId, channelId, propertyId, event: 'single_press',
  nativeEventType: 'ring', sourceOccurrenceId: eventId, sourceTimestamp: startedAt === null ? undefined : new
  Date(startedAt).toISOString() })`; a rejection is logged as `UniFi Protect ring could not be published` and counted in
  `writesFailed`. No `doorbell.event` value is written (R5). `reset()` also clears the tracker and the timer.

- [ ] **Step 1: Write the failing core test** (`channel-input-occurrences.service.spec.ts`, next to the existing
  `throws DevicesValidationException if channel is not an input channel …`, `:208`)

```ts
it('accepts a READ_ONLY event property on a doorbell channel', ...); // channel category DOORBELL, property ro enum [single_press,…] -> emits CHANNEL_INPUT_OCCURRENCE with event 'single_press'
it('reports a doorbell channel as an input in its capabilities', ...); // getInputCapabilities -> is_input true, supported_events contains 'single_press'
```

- [ ] **Step 2: Write the failing synchronizer tests**

```ts
it('turns a recorded smoke alarm sound into smoke.detected and back', ...); // e0005 add -> update(smokeDetectedId, true); its update -> false
it('writes leak detected and level together', ...); // adopted from golden expected/sensor-leak.json (sensors.json leak variant) e0011 -> detected true + level 'high'; end -> false + 'low'
it('clears a detection 60 s after its last frame and re-arms on update', ...); // fake timers: add motion; advance 59_999 -> no false; advance 1 -> update(motionId, false)
it('publishes a recorded ring once with the Protect event id', ...);
// doorbell golden device; e0007 add -> publishOccurrence called once with { event:'single_press', nativeEventType:'ring', sourceOccurrenceId:'5f00000000000000000e0007', sourceTimestamp:'2026-11-11T12:26:47.000Z' }; the same add again -> still once; no update() on doorbell_event
it('skips a ring for a camera without a doorbell channel', ...);
it('counts unknown event and detection types', ...); // sensorExtremeValues + ["pet"] -> ignoredEventCount 2, ignoredEventTypes { sensorExtremeValues: 1, pet: 1 }
it('ignores events of devices that are not adopted', ...); // device 'ffffffffffffffffffffffff' -> no call, not counted as unknown
it('does not count lightMotion or sensorBatteryLow as unknown', ...);
it('keeps timers alive across snapshots and clears them on reset', ...); // jest.getTimerCount() 1 after an add; snapshot -> 1; reset() -> 0
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/services/protect-synchronizer.service.spec.ts src/modules/devices/services/channel-input-occurrences.service.spec.ts`
Expected: FAIL (doorbell refused; event frames ignored).

- [ ] **Step 4: Implement** the core category change (add `ChannelCategory.DOORBELL` to both input-category lists) and
  the event path in the synchronizer.

- [ ] **Step 5: Run to verify pass** — the Step 3 command, then
  `pnpm --filter ./apps/backend exec jest --config ./test/jest-e2e.json test/hardware-inputs-conformance.e2e-spec.ts`.
  Expected: PASS.

- [ ] **Step 6: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect src/modules/devices/services/channel-input-occurrences.service.ts
git add apps/backend/src/modules/devices/services/channel-input-occurrences.service.ts apps/backend/src/modules/devices/services/channel-input-occurrences.service.spec.ts
git commit -m "feat(backend): accept doorbell channels as hardware input occurrence sources"
git add apps/backend/src/plugins/devices-unifi-protect
git commit -m "feat(backend): apply UniFi Protect detections and doorbell rings from event frames"
```

---

### Task 6: Connector session hook and the realtime socket cycle

**Files:**
- Create: `services/protect-realtime.service.ts`
- Modify: `services/protect-connector.service.ts`, `devices-unifi-protect.plugin.ts` (providers and the timings token)
- Test: `services/protect-realtime.service.spec.ts`, `services/protect-connector.service.spec.ts`, `devices-unifi-protect.plugin.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`openSubscription`, constants), Task 2 (`parseProtectFrame`, `ProtectConsoleEntry`), Task 4/5
  (`applySnapshot`, `enqueueFrame`, `idle`, `reset`), F1, `calculateProtectReconnectDelay`.
- Produces:
  ```ts
  // services/protect-connector.service.ts
  export interface ProtectSession { generation: number; client: ProtectApiClient; identity: ProtectConsoleIdentity }
  export type ProtectSessionEnd = 'lost' | 'stopped';
  /** Called with a session when the connector becomes connected; with null when that client closes. Listener errors are caught and logged. */
  onSessionChange(listener: (session: ProtectSession | null, reason: ProtectSessionEnd | null) => void): () => void;

  // services/protect-realtime.service.ts
  export interface ProtectRealtimeTimings {
  	pingIntervalMs: number; pongTimeoutMs: number; degradedAfterFailures: number;
  	reconnectDelay(attempt: number): number;
  }
  export const PROTECT_REALTIME_TIMINGS = Symbol('PROTECT_REALTIME_TIMINGS');
  export const PROTECT_DEFAULT_REALTIME_TIMINGS: ProtectRealtimeTimings; // 180_000, 30_000, 3, calculateProtectReconnectDelay
  @Injectable() export class ProtectRealtimeService implements OnModuleInit, OnModuleDestroy {
  	getState(): ProtectRealtimeState;
  	/** Resolves when the current cycle step (open, prime, buffered apply, poll) has finished (tests, e2e). */
  	settle(): Promise<void>;
  }
  ```
- Connector rules (decided): emit `(session, null)` right after `connectionState = CONNECTED` in `runAttempt`; emit
  `(null, 'lost')` in `closeConnected()` and `(null, 'stopped')` in `resetRuntime()`, each only when a connected client
  existed. The health check keeps the same client, so it emits nothing.
- Realtime rules (decided):
  - On a session: bump `generation`, `consecutiveFailures = 0`, start a cycle. On `null`: bump `generation`, close sockets,
    clear ping/pong/reconnect/poll timers, state `stopped`; on `'stopped'` also `synchronizer.reset()` (and, in Task 7,
    resolve the issue).
  - Cycle: state `connecting`; open `devices` and `events` concurrently with handlers bound to the cycle generation; a
    failure of either closes the other and fails the cycle with that error. State `priming`; buffer every message (parsed
    with `parseProtectFrame`; rejected frames count in `framesIgnored`) up to `PROTECT_MAX_BUFFERED_FRAMES` (overflow fails
    the cycle with `PROTOCOL`); read `listCameras`, `listSensors`, `listLights` in that order; `applySnapshot(identity,
    { complete: true, entries })`; enqueue the buffer in arrival order; state `streaming`, `consecutiveFailures = 0`,
    schedule pings. Every await is followed by a generation check; a stale result closes its sockets and stops.
  - Streaming: each message → `enqueueFrame`; `false` (queue full) → close both sockets and restart the cycle at attempt 0
    (a fresh prime). Ping each socket every `pingIntervalMs`; no pong within `pongTimeoutMs` → close and restart.
    `closed` of either socket → close the other and restart with attempt 0.
  - Failure before streaming: `consecutiveFailures += 1`; delay `reconnectDelay(consecutiveFailures - 1)`, raised to the
    error's `retryAfterMs` (capped at 60 s) for `rate_limited`; log `UniFi Protect realtime cycle failed (<category>);
    retry in <ms> ms`. A connector-level failure (the client closed) arrives as a `null` session instead.

- [ ] **Step 1: Write the failing connector tests**

```ts
it('announces a session when connected and its end when the console is lost', ...); // listener gets ({generation, client, identity: {nvrId, nvrMacKey}}, null); then a failing health check -> (null, 'lost')
it('announces the end of a session as stopped on stop and restart', ...);
it('emits nothing on a successful health check', ...);
it('survives a listener that throws', ...); // connector still CONNECTED; logged once
```

- [ ] **Step 2: Write the failing realtime tests** (`jest.useFakeTimers()`; a fake connector with `onSessionChange`; a
  fake client whose `openSubscription` returns controllable fake subscriptions recording `ping()`/`close()`, and whose
  list reads return `cameras.json`, `sensors.json`, `lights.json` entries; a synchronizer mock; timings
  `{ …PROTECT_DEFAULT_REALTIME_TIMINGS, reconnectDelay: (a) => 1000 * 2 ** a }`)

```ts
it('subscribes to both topics before it primes', ...); // order of fake calls: openSubscription('devices'), openSubscription('events'), listCameras, listSensors, listLights, applySnapshot
it('applies frames received while priming after the snapshot, in arrival order', ...);
// a frame pushed during listSensors -> applySnapshot called before enqueueFrame; two buffered frames enqueued in arrival order; getState() 'streaming'
it('drops a buffer that overflows and retries', ...); // 1001 frames while priming -> both subs closed, state 'connecting' after 1000 ms
it('pings every 180 s and restarts when a pong is missing', ...); // advance 180_000 -> ping() on both; pong on one only; advance 30_000 -> both closed, a new cycle opens
it('re-primes after a socket drops', ...); // closed() on events -> devices closed too; new cycle; applySnapshot called twice
it('backs off with growing delays and honours Retry-After', ...); // open rejects unavailable x3 -> attempts at +1000, +2000, +4000; rate_limited retryAfterMs 9000 at attempt 0 -> waits 9000
it('re-primes after a drop and does not replay a ring', ...); // with the real synchronizer and tracker: ring add before and after a drop -> publishOccurrence once
it('discards a prime that finishes after the session ended', ...); // listLights resolves after (null,'lost') -> applySnapshot not called, subs closed
it('stops everything when the session ends', ...); // (null,'lost') -> subs closed, jest.getTimerCount() 0 (synchronizer mocked), getState() 'stopped'; reset() not called
it('resets the synchronizer when the connector stops', ...); // (null,'stopped') -> reset() called
it('starts a fresh cycle for a new session and ignores callbacks of the old one', ...); // old sub's message after a new session -> not enqueued
it('unrefs every timer', ...);
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/services/protect-realtime.service.spec.ts src/plugins/devices-unifi-protect/services/protect-connector.service.spec.ts`
Expected: FAIL (module not found, `onSessionChange` missing).

- [ ] **Step 4: Implement** the hook, the service, and the plugin wiring: providers `ProtectSynchronizerService`,
  `ProtectRealtimeService`, `{ provide: PROTECT_REALTIME_TIMINGS, useValue: PROTECT_DEFAULT_REALTIME_TIMINGS }`; the
  realtime service registers its listener in `onModuleInit` and unregisters and stops in `onModuleDestroy`. Update the
  plugin spec's provider assertion (`devices-unifi-protect.plugin.spec.ts:195`).

- [ ] **Step 5: Run to verify pass**

Run: the Step 3 command, `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect`, then the three
existing e2e suites of Task 1 Step 6.
Expected: PASS. The existing suites now open sockets against the fake console; `fake.requests` stays empty while the
connector is stopped (F16) because upgrades are recorded separately. If an existing assertion counts REST requests
during a connected phase, fix the assertion to filter the prime paths, not the product.

- [ ] **Step 6: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect
git add apps/backend/src/plugins/devices-unifi-protect
git commit -m "feat(backend): subscribe, buffer, prime and stream UniFi Protect frames with reconnect backoff"
```

---

### Task 7: Degraded polling, the notification and status

**Files:**
- Modify: `services/protect-realtime.service.ts`, `models/status.model.ts`, `controllers/protect-status.controller.ts`,
  `devices-unifi-protect.plugin.ts` (readme)
- Test: `services/protect-realtime.service.spec.ts`, `controllers/protect-status.controller.spec.ts`,
  `devices-unifi-protect.plugin.spec.ts`

**Interfaces:**
- Consumes: Task 6; F13, F15; `ConfigService.getPluginConfig<ProtectConfigModel>(DEVICES_UNIFI_PROTECT_PLUGIN_NAME).pollIntervalMs`.
- Produces:
  ```ts
  // services/protect-realtime.service.ts
  export const PROTECT_REALTIME_NOTIFICATION_KEY = 'realtime';
  /** Applies the realtime view to the connector's status: degraded + realtime fields. */
  decorateStatus(status: ProtectStatusModel): ProtectStatusModel;
  // models/status.model.ts
  @ApiProperty({ name: 'realtime_state', enum: PROTECT_REALTIME_STATES, description: 'Real-time synchronisation state' }) realtimeState: ProtectRealtimeState;
  @ApiProperty({ name: 'ignored_event_count', description: 'Protect events of unknown types ignored since the service started', minimum: 0 }) ignoredEventCount: number;
  ```
- Rules (decided, R7): when `consecutiveFailures` reaches `degradedAfterFailures` and polling is off: state `polling`,
  `notify` the R7 issue once (exact texts and actions), start a poll timer at `pollIntervalMs` (re-read every time it is
  scheduled). A poll reads the three lists; all three succeeded → `applySnapshot(identity, { complete: true, entries })`;
  any failed → `applySnapshot` with only the successful lists and `complete: false`, log
  `UniFi Protect poll failed (<category>)`. Reconnect attempts continue on the backoff; the state stays `polling` while a
  cycle connects or primes. A cycle that reaches streaming stops polling and calls `resolve(source, 'realtime')` (a
  rejection is logged and retried on the next recovery, the HA rule, `home-assistant.ws.service.ts:700-735`). A
  `'stopped'` session end also resolves it. `decorateStatus`: `connectionState` becomes `degraded` when it is
  `connected` and the state is `polling`; `realtimeState` and `ignoredEventCount` are filled from
  `getState()`/`getCounters()`.
- Readme: under "What you get" add `- Live device state, detections and doorbell rings through the console's event
  WebSockets, with REST polling while they are unavailable`; in the configuration table the `poll_interval_ms` row reads
  `Interval between device state refreshes while real-time updates are unavailable (5000–600000)`; add a
  "Real-time updates" section stating: frames are applied within a second; detections without an end clear after 60 s;
  devices removed on the console are kept, shown disconnected and reported once; Protect renames are copied unless the
  device was renamed in Smart Panel.

- [ ] **Step 1: Write the failing tests**

```ts
// protect-realtime.service.spec.ts
it('switches to polling after three failed cycles and notifies once', ...);
// open rejects x3 -> notify called once with { source:'devices-unifi-protect-plugin', kind:'issue', key:'realtime', severity:'warning', title:'UniFi Protect real-time updates unavailable', message: <R7 text>, actions:[{type:'service', service_id:'connector', operation:'restart', primary:true, …}, {type:'link', url:'/extensions/devices-unifi-protect-plugin', …}] }; getState() 'polling'; a 4th failure -> still once
it('polls the device lists at the configured interval', ...); // pollIntervalMs 5000 -> advance 5000 -> listCameras/listSensors/listLights once each, applySnapshot complete:true; config changed to 10000 -> next poll after 10000
it('keeps devices when a poll read fails', ...); // listSensors rejects -> applySnapshot({ complete:false, entries: cameras+lights })
it('resolves the notification and stops polling when the sockets recover', ...); // next cycle streams -> resolve('devices-unifi-protect-plugin','realtime'); no further list reads after advancing 5000
it('retries a failed resolve on the next recovery', ...);
it('resolves the notification when the connector stops', ...);
it('stops polling when the session is lost', ...); // (null,'lost') -> no list read after advancing 60_000
// protect-status.controller.spec.ts
it('reports degraded while polling and the realtime fields', ...); // decorateStatus on a connected status -> connection_state 'degraded', realtime_state 'polling', ignored_event_count 2 (plainToInstance/instanceToPlain wire names)
it('keeps connected while streaming', ...);
// devices-unifi-protect.plugin.spec.ts
it('describes real-time updates in the readme', ...); // readme contains 'Real-time updates' and 'clear after 60 s'
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/services/protect-realtime.service.spec.ts src/plugins/devices-unifi-protect/controllers/protect-status.controller.spec.ts src/plugins/devices-unifi-protect/devices-unifi-protect.plugin.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** the polling and notification paths, the two status fields (defaults `'stopped'`, `0`), the
  controller composition (`response.data = this.realtime.decorateStatus(this.connectorService.getStatus())`), and the
  readme.

- [ ] **Step 4: Run to verify pass**

Run: the Step 2 command, then `pnpm run generate:openapi` and
`grep -o '"realtime_state"\|"ignored_event_count"' spec/api/v1/openapi.json | sort -u`.
Expected: PASS; both names listed; `git status --short` shows no generated file.

- [ ] **Step 5: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect
git add apps/backend/src/plugins/devices-unifi-protect
git commit -m "feat(backend): poll UniFi Protect device state while the event WebSockets are unavailable"
```

---

### Task 8: End to end, gates, docs, epic status and PR body

**Files:**
- Create: `apps/backend/test/devices-unifi-protect-realtime.e2e-spec.ts`
- Modify: `docs/hardware-inputs.md` (provider table, after the `devices-shelly-v1` row at `:52`), `tasks/epics/EPIC-UNIFI-PROTECT.md:103`
- Write (not committed): the PR body in the session scratchpad.

**Interfaces:** Consumes everything above. The e2e copies the bootstrap of `test/devices-unifi-protect-adoption.e2e-spec.ts:84-290`
(`FB_CONFIG_PATH` temp directory, `Logger`/`EventEmitter2` spies, `PROTECT_TRUSTED_CA` override, pipes and filters, owner
and user tokens, `observed`, `savedConfig()`, `adoptBatch()`) with `FakeProtectServer.start({ cameraFixtures:
['cameras.json', 'cameras-doorbell.json'] })` and additionally overrides `PROTECT_REALTIME_TIMINGS` with
`{ pingIntervalMs: 180_000, pongTimeoutMs: 30_000, degradedAfterFailures: 3, reconnectDelay: () => 100 }`. Saved config
adds `poll_interval_ms: 5000`. `beforeAll` adopts Front door `600cefafd5f365d6f83c4ef3`, doorbell `5f0000000000000000000a01`
and sensor `5f0000000000000000000b01` with `stream: { enabled: false }` for the cameras, then awaits `realtime_state`
`streaming`. Helper `readValue(deviceId, channelIdentifier, propertyIdentifier)` uses `PropertyValueService.readLatest`
as the adoption e2e does (`:446-457`); `eventually(fn, ms)` polls every 25 ms.

- [ ] **Step 1: Write the e2e tests**

```ts
it('opens both subscriptions with the API key', ...); // fake.upgrades paths …/subscribe/devices and …/subscribe/events, all hadApiKey; subscriptionCount 1 each
it('turns a smoke alarm event into a property and a critical security alert, and clears it on end', ...);
// sendFrame('events', e0005 add) -> eventually(readValue(frontDoor,'smoke','detected') === true, 1000);
// GET /api/v1/modules/security/status (owner) -> data.active_alerts contains { id:`sensor:${frontDoorPanelId}:smoke`, type:'smoke', severity:'critical', source_device_id: frontDoorPanelId }, has_critical_alert true;
// sendFrame e0005 update(end) -> detected false within 1000 ms and the alert is gone
it('applies a recorded sensor frame within a second', ...); // ws-devices 'isOpened true' -> contact.detected true; 'stats.light.value 8' -> illuminance 8, level 'dark'
it('publishes a doorbell ring once with the Protect event id', ...); // e0007 add -> exactly one emitted 'DevicesModule.ChannelInput.Occurrence' payload with sourceOccurrenceId '5f00000000000000000e0007', event 'single_press', nativeEventType 'ring' (from the EventEmitter2 emit spy)
it('reconnects, re-primes and does not replay the ring', ...); // dropSubscriptions -> realtime_state streaming again, fake.upgrades +2, GET cameras requested again; resend e0007 add -> still one occurrence; resend e0001 add after its end -> motion.detected stays false
it('marks a device removed on the console disconnected and keeps it', ...); // sendFrame('devices', remove sensor) -> connection_state 'disconnected'; GET /api/v1/modules/devices/devices/<id> 200; app.get(NotificationsService).findAll({ status: 'active' }) holds exactly one row with key 'device_removed:5f0000000000000000000b01'
it('polls while the sockets are refused and recovers', ...);
// refuseUpgrades({status:503}); dropSubscriptions -> eventually status connection_state 'degraded', realtime_state 'polling' (≤ 5 s); one active 'realtime' issue;
// fake.updateDevice('cameras', FRONT_DOOR, { state: 'DISCONNECTED' }) -> connection_state 'disconnected' within 7 s (poll 5 s);
// refuseUpgrades(null) -> realtime_state 'streaming', connection_state 'connected', the 'realtime' issue resolved
it('stops the sockets when the plugin is disabled', ...); // patchConfig({ enabled:false }) -> subscriptionCount 0 for both; realtime_state 'stopped'
it('never leaked a secret into responses, logs, events, notifications or the database', ...);
// FAKE_PROTECT_API_KEY, 'SENTINELALIAS', FAKE_PROTECT_ALIAS absent from inspect([logSpies, emitSpies, observed]) and from SELECT * of
// devices_module_devices, devices_module_channels, devices_module_channels_properties and the notifications table; the material contains 'subscribe/devices' or 'UniFi Protect'
```

- [ ] **Step 2: Run**

Run: `pnpm --filter ./apps/backend exec jest --config ./test/jest-e2e.json test/devices-unifi-protect-realtime.e2e-spec.ts --detectOpenHandles`
Expected: PASS, 9 tests, no open-handle report. Fix the test, not the product, unless a real defect shows.

- [ ] **Step 3: Prove the replay guard can fail**

Temporarily make `ProtectEventTracker.apply` skip the seen-id check; rerun Step 2. Expected: `reconnects, re-primes and
does not replay the ring` FAILS on the occurrence count. Restore with
`git checkout -- apps/backend/src/plugins/devices-unifi-protect/services/protect-event-tracker.ts` and rerun to PASS.

- [ ] **Step 4: Full gates**

```bash
pnpm run generate:openapi
pnpm --filter ./apps/backend run lint:js
pnpm --filter ./apps/backend exec prettier --check "src/plugins/devices-unifi-protect/**/*.ts" "src/modules/devices/services/channel-input-occurrences.service*.ts" "test/devices-unifi-protect*.ts" "test/support/fake-protect-server.ts"
pnpm --filter ./apps/backend run lint:deps
pnpm run test:unit
pnpm --filter ./apps/backend exec jest --config ./test/jest-e2e.json test/devices-unifi-protect.e2e-spec.ts test/devices-unifi-protect-discovery.e2e-spec.ts test/devices-unifi-protect-adoption.e2e-spec.ts test/devices-unifi-protect-realtime.e2e-spec.ts test/hardware-inputs-conformance.e2e-spec.ts
git status --short
```
Expected: every command exits 0, except that `lint:deps` and a package-wide `pretty:check` may report only the
pre-existing findings recorded in PR #1642 (19 cycles, 12 migration files) — no new cycle names a
`devices-unifi-protect` file; `test:unit` may fail only `buddy/automation-suggestion-evaluator.service.spec.ts` on a
non-UTC machine (passes with `TZ=UTC`); `git status` shows no generated file.

- [ ] **Step 5: Docs and epic status**

`docs/hardware-inputs.md`: add a provider row `| **`devices-unifi-protect`** | `doorbell` | `event` (READ_ONLY) |
`single_press` (Protect `ring` event) | Protect Integration API `subscribe/events` WebSocket | Protect 7.2.105+ | One
doorbell button per device | Protect event id as `sourceOccurrenceId`; the plugin also drops event ids it has seen
(last 1024), so reconnects never replay a ring | Plugin unit suite + e2e (`devices-unifi-protect-realtime.e2e-spec.ts`) |`,
and change the intro sentence's plugin count from 11 to 12 (`:47`).
`tasks/epics/EPIC-UNIFI-PROTECT.md:103`: first cell `UP-8 (done)`.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/test/devices-unifi-protect-realtime.e2e-spec.ts
git commit -m "test(backend): cover UniFi Protect real-time sync end to end"
git add docs/hardware-inputs.md
git commit -m "docs(docs): list UniFi Protect doorbell rings as hardware input occurrences"
git add tasks/epics/EPIC-UNIFI-PROTECT.md
git commit -m "docs(tasks): mark UniFi Protect real-time sync done"
```

- [ ] **Step 7: Write the PR body to a file (do not push, do not open the PR)**

Path: `<session scratchpad>/pr-body-unifi-protect-realtime.md`. Title line first:
`feat(backend): sync UniFi Protect device state and events in real time`. Sections: Summary (3 bullets); Event mapping
table (Protect event → channel → behaviour, R3); Lifecycle (subscribe → buffer → prime → apply, ping, backoff, degraded,
R6/R7); Decisions R1–R14 as approved, with reasons; Deviations from issue #1184 and the design ("Decisions recorded"
below); Test plan (commands of Tasks 1–8 with pass counts); Known limits (synthetic WebSocket fixtures — UP-20 verifies
event spellings, leak/alarm durations, tamper clearing and pong behaviour; `camera.status` is UP-10's; renames while the
backend is down are not copied; the panel ring overlay is UP-14); `Closes #1184`; then
`🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

---

## Decisions recorded (for the PR body)

1. `lightMotion` is ignored, not mapped to `motion` as the issue table says: the floodlight has no `motion` channel
   (UP-7 P2) and the paired camera would be misattributed.
2. `ChannelInputOccurrencesService` now accepts doorbell channels (core change outside the issue's file ownership): the
   spec's `doorbell.event` is `ro`, which the service refused.
3. The plugin keeps its own seen-event-id list because the core occurrence de-duplication lasts 5 s.
4. No `doorbell.event` value is written; rings are occurrences only.
5. No per-property debounce; buffered frames are applied in arrival order without a timestamp filter (device frames carry
   none).
6. Protect renames propagate from an in-memory baseline (UP-7 deviation A10 closed without a migration); a rename while
   the backend is down is not copied.
7. `camera.status` and `camera.source` are left to UP-10; the sync writes path-sourced values, connection state and
   event-driven detections only.
8. `GET status` reports `connection_state: degraded` while polling and gains `realtime_state` and `ignored_event_count`.
9. The fake console gained both WebSockets, frame injection, upgrade refusal and a REST overlay; upgrades are recorded
   apart from `requests`, so the earlier suites' "no request while stopped" assertions hold.
10. Synthetic frames were added for `smartDetectLoiterZone`, multi-type detections, `alrmCmonx`, `sensorAlarm`,
    `sensorBatteryLow`, an unknown type, an unknown detection type, a rename, a light-level change, a tamper clear and a
    sensor removal.

## Self-review

**Spec coverage (issue #1184, design §4.3, §9.2, §9.3, §11, §14, §14a, roadmap UP-8):**

| Requirement | Task |
|---|---|
| Both WebSockets authenticate with `X-API-KEY` | 1, 8 |
| Subscribe first, buffer, prime over REST, apply the buffer | 6 (R10) |
| Ping ~180 s; reconnect with backoff and jitter; re-prime after every reconnect; generation counter | 6 (R6) |
| Device frames merged into the cached device and diffed against the mapping; only changes written via `ChannelsPropertiesService.update` | 2, 4 (R11) |
| Connection state via `DeviceConnectivityService`; UP-Sense light level updates `illuminance` and `level` | 4 |
| Event `add` / `update(end)` → `motion`, `object_detection` per type, `smoke`/`carbon_monoxide`, `sound_detection`, UP-Sense channels | 3, 5 (R3) |
| Safety timeout for detections without `end` | 3, 5 (R4) |
| Ring → `publishOccurrence` with the event id as `sourceOccurrenceId`; not re-emitted after reconnect | 3, 5, 6, 8 (R5) |
| `remove` → disconnected + admin notification; never deleted | 4, 8 (R8) |
| Repeated failures → degraded REST polling with a notification resolved on recovery | 7, 8 (R7) |
| Unknown event types ignored and counted | 3, 5, 7 (R12) |
| Unit tests replay recorded frames; e2e event frame → property → security alert | 2–5, 8 |
| Name changes in Protect propagate unless renamed in Smart Panel (design §9.2, UP-7 A10) | 4 (R9) |
| Secret rule with sentinels; untrusted frames bounded | 1, 2, 8 |

**Step scan:** every code step names its file, signatures and the decided rules; test steps list names with the exact
fixture ids, values and texts; verification steps carry commands and expected output. The cycle and the tracker are
specified as rule lists rather than bodies; the notification and readme texts are fixed copy.

**Type consistency:** `ProtectSubscriptionTopic`, `ProtectSubscription(Handlers)` (1) in 6; `ProtectFrame`,
`parseProtectFrame`, `ProtectConsoleEntry`, `diffMappedValues`, `syncableMappingNames`, `mappedConnectionState` (2) in 4
and 6; `ProtectEventTracker`, `ProtectEventEffect`, `ProtectTargetWrite` (3) in 4 and 5; `ProtectSnapshot`,
`applySnapshot`, `enqueueFrame`, `idle`, `reset`, `getCounters` (4, 5) in 6 and 7; `ProtectSession`, `onSessionChange`
(6) in 6 and 7; `PROTECT_REALTIME_TIMINGS`, `ProtectRealtimeTimings` (6) in 8; `ProtectRealtimeState`,
`PROTECT_REALTIME_STATES` (1) in 6 and 7; `decorateStatus`, `realtimeState`, `ignoredEventCount` (7) in 8.

**Review Focus:** items 1–5 each name their tests (Task 4 stale reset and Task 5 timeout; Task 3 overlap and added type;
Task 3 duplicate, Task 6 and Task 8 replay; Task 2 pollution and bounds, Task 4 unknown device; Task 4 incomplete
snapshot, Task 7 failed poll).

**Proportion:** 8 tasks for roughly 3,000 lines of source and tests; the plan carries the decisions, signatures, rule
lists, fixture-based test names and fixed copy, and refers to the Homey and Home Assistant services for the index and
notification patterns.
