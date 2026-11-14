# Cameras (UniFi Protect epic #1175) — Implementation Roadmap

**Goal:** Deliver camera live view and snapshots in the admin and on the panel through a reusable core `cameras`
module, with UniFi Protect as the first provider plugin.

**Spec:** `docs/superpowers/specs/2026-10-06-unifi-protect-integration-design.md` (decisions D1–D10 confirmed
2026-10-06). **Epic file:** `tasks/epics/EPIC-UNIFI-PROTECT.md`. **Issues:** #1176–#1197, #1221.

This file is the map: what the code looks like today, where the design must be amended, the plan series, the
contracts every plan shares, and a task outline per issue. Each plan in the series gets its own step-level file
(`superpowers:writing-plans` format) before it is executed. Plans 1 and 2 are written:

- `docs/superpowers/plans/2026-11-12-cameras-plan-1-spec-extension.md` (UP-1)
- `docs/superpowers/plans/2026-11-12-cameras-plan-2-cameras-module.md` (UP-2)

Later plans are written when their predecessor merges, because they name interfaces the predecessor fixes.

---

## 1. State on 2026-11-12

Nothing from the epic is implemented. Only the planning PR #1201 has merged. The design was written on 2026-10-06
at migration 25; `main` is now at migration 58, and the following facts differ from what the design assumes.

| # | Design assumption | Reality on `main` | Consequence |
|---|---|---|---|
| A1 | Category CHECK constraints are extended like `1000000000026-AddHardwareInputCategories.ts` (rebuild the table). | Migrations 048, 049 and 054 added a `catalogBirth` column, catalog-birth triggers, a delete trigger, modbus columns and an index to those tables. `thermostat-creation-catalog.ts` verifies the stored table SQL and trigger DDL at runtime, and `catalogBirth` values are allocated from `last_insert_rowid()`. A copy of 026 would drop all of it or renumber rowids. | Plan 1 changes the CHECK list in place and proves with a `sqlite_master` diff that nothing else moved. |
| A2 | Stream sessions are "revoked on logout". | The auth module emits no events and has no logout endpoint. Available signals: `DisplaysModule.Display.Deleted`, `DisplaysModule.Display.TokenRevoked`, `UsersModule.User.Deleted`, `DevicesModule.Device.Deleted`. | Sessions are revoked on those four events. Live sockets also get a hard maximum lifetime and an owner re-check (Plan 3). |
| A3 | The live WebSocket copies the Shelly upgrade pattern. | The pattern works only when `handleUpgrade` runs synchronously: socket.io's engine listens on the same server and destroys unanswered upgrades after about 1 s. `AppInstanceHolder.setApp` is called only in `main.ts`, so the HTTP server is unavailable in e2e tests. | Plan 3 validates the session token from memory and accepts the upgrade synchronously, then connects upstream. Its e2e test sets `AppInstanceHolder` itself and listens on a real port. |
| A4 | UP-21: change `space-sensor-state.service.ts` and the room becomes occupied. | Room modes are driven by the newer `SpaceOccupancyService`, which reads only the `sensorPropertyIds` an admin selected, and `SpaceOccupancyInputsService.candidates()` offers only `detected` on `motion`/`occupancy` channels. `space-sensor-state.service.ts` feeds the displayed sensor summary only, and has no spec file. | UP-21 must also extend `candidates()`, or person detection never reaches room modes. This widens #1221's file ownership (decision Q2). |
| A5 | The panel reacts to `DevicesModule.ChannelInput.Occurrence` for the doorbell overlay. | The panel receives the event through its `DevicesModule.*` wildcard and drops it. Only the admin handles it. | UP-14 adds the occurrence handling to the panel devices module first. |
| A6 | The admin device detail page shows the live view for every camera. | The only extension point is `deviceDetailSection`, chosen by plugin type, not by device category. | UP-11 adds a category-keyed section registry to the devices module. |
| A7 | The panel pauses snapshot refresh "when hidden or the screen is off". | The panel has no visibility helper, no `Image.memory`/`Image.network` use and no bytes download. `ScreenPowerService` is not in the locator. | UP-13 builds its own poller driven by route currency and `OverlayManager.isActive('inactivity')`. No new dependency. |
| A8 | UP-4 follows existing pinned-download and notices conventions. | No third-party download is hash-pinned today, there is no third-party notices file, and CI does not run `shellcheck`. | UP-4 creates all three. |
| A9 | Fixtures and fake servers follow Homey. | Homey has no e2e test and fakes the connector, not HTTP. | The fake Protect server (REST + two WebSockets) is new test infrastructure in Plan 4. |
| A10 | "The Home Assistant camera mapping still validates." | `camera_default` in `entity-mappings.yaml` binds only `status`, so it already lacks the required `source`. No test checks mappings against the spec. | Not a regression of this epic. Plan 1 leaves it alone and records it; fixing it belongs to a Home Assistant provider. |
| A11 | Generated artefacts are committed and regenerated in the PR. | `spec/api/v1/openapi.json`, `apps/admin/src/openapi.ts`, `apps/backend/src/spec`, `apps/admin/src/spec`, `apps/panel/lib/api` and `apps/panel/lib/spec` are git-ignored and regenerated in CI. | Plans regenerate locally to compile and test, and commit only `apps/admin/src/openapi.constants.ts` and panel `app_localizations*.dart`. |

## 2. Decisions (confirmed by the maintainer on 2026-11-12)

| # | Question | Decision |
|---|---|---|
| Q1 | Is hardware available for UP-0? | A UniFi console with cameras is on the local network now. UP-0 starts immediately, in parallel with Plans 1 and 2, and captures what that hardware offers. Fixtures for device types the console does not have (doorbell, UP-Sense, floodlight) stay synthetic and are marked so; the Pi 4 / Pi 5 measurements run when the boards are at hand. |
| Q2 | May UP-21 also change `SpaceOccupancyInputsService` (A4)? | Yes. #1221's file ownership is widened accordingly. |
| Q3 | Add a simulated camera so admin and panel work can be developed and demoed without a console? | Yes: `feat(backend): add a simulated camera to the simulator plugin`, directly after Plan 2. It serves snapshots from a static image or a short loop of frames (see below). It is not in the epic and gets its own issue. |
| Q4 | May third-party and MCP long-lived tokens fetch snapshots and open stream sessions? | No. Plan 2 allows users and displays only and returns 403 otherwise. |

**Simulated camera (Q3), outline.** A `camera` simulator in `plugins/simulator/simulators/` producing a device
with `camera`, `device_information` and `motion` channels, plus a `SimulatorCameraStreamProvider` registered for the
simulator device type. Snapshots cycle through a short loop of bundled JPEG frames (a few hundred kilobytes in
total, listed in `nest-cli.json` assets), advancing one frame per snapshot interval, so auto-refresh is visibly
alive on the panel; a single-frame loop is the static case. `listProfiles` returns one `main` profile.
`resolveSource` reports the profile as unavailable until Plan 3 lands; then it returns a go2rtc `exec:`/file source
only if the spike shows go2rtc can loop a bundled clip without ffmpeg, otherwise live view stays snapshot-only for
simulated cameras. Tests: frame advance with fake timers, loop wrap-around, and the provider against the Plan 2
contract.

## 3. Plan series and order

```
Plan 1 (UP-1 spec) ──┬─▶ Plan 8 (UP-16 security rules, UP-21 occupancy)
                     └─▶ Plan 5 (UP-7 … UP-10) ─▶ Plan 6b (UP-12) ─┐
Plan 2 (UP-2 core) ──┬─▶ Plan 3 (UP-3 relay, UP-4 installer) ─▶ Plan 6a (UP-11) ─┤
                     └─▶ Plan 7a (UP-13 panel snapshots) ─▶ Plan 7b (UP-14) ─────┤
Plan 4 (UP-5 foundation, UP-6 discovery; UP-0 spike suite) ─▶ Plan 5              ▼
                                                              Plan 9 (UP-19 docs, UP-20 acceptance)
After the MVP: UP-15 (panel live video), UP-17, UP-18.
```

| Plan | Issues | PRs | Needs hardware |
|---|---|---|---|
| 1 Spec extension | UP-1 #1177 | 1 | no |
| 2 Cameras module core | UP-2 #1178 | 1 | no |
| 3 Relay and installer | UP-3 #1179, UP-4 #1180 | 2 | go2rtc binary only |
| 4 Protect foundation | UP-0 #1176, UP-5 #1181, UP-6 #1182 | 3 | UP-0 only |
| 5 Protect devices | UP-7 #1183, UP-8 #1184, UP-9 #1185, UP-10 #1186 | 4 | fixtures from UP-0 |
| 6 Admin | UP-11 #1187, UP-12 #1188 | 2 | no |
| 7 Panel | UP-13 #1189, UP-14 #1190 | 2 | no |
| 8 Security and occupancy | UP-16 #1193, UP-21 #1221 | 2 | no |
| 9 Release | UP-19 #1196, UP-20 #1197 | 1 + acceptance | yes |

Plans 1, 2 and 4 (UP-0 and UP-5) start in parallel; the simulated camera (Q3) follows Plan 2. One sub-issue is one branch and one PR; the PR title is the issue title.
`app.module.ts`, `app.main.ts`, `openapi.constants.ts` and locale indexes are edited by appending only.

Migration numbers are taken at execution time. Plan 1 uses `1000000000059`. Each later migration takes the next
free number on `main` when its branch is cut and is rebased if another lands first.

## 4. Contracts shared by all plans

These are fixed here so parallel lanes agree. Plan 2 implements them; a change to any of them is a roadmap change.

**Module identity:** `CAMERAS_MODULE_PREFIX = 'cameras'`, `CAMERAS_MODULE_NAME = 'cameras-module'`. REST base
`/api/v1/modules/cameras/`.

**Provider contract** (`apps/backend/src/modules/cameras/platforms/camera-stream.provider.ts`):

```ts
export interface CameraStreamProfile {
	id: string; // 'high' | 'medium' | 'low' | 'package' | provider-defined
	channelId: string; // id of the device's `camera` channel this profile belongs to
	width?: number;
	height?: number;
	fps?: number;
	videoCodec?: string; // 'h264' | 'hevc' | 'av1' | …
	audioCodec?: string;
	available: boolean;
	unavailableReason?: string; // short machine code, e.g. 'stream_not_enabled'
}
export interface CameraStreamSource {
	url: string; // SECRET. Never logged, persisted or returned to a client.
	transport: 'rtsp' | 'rtsps-insecure' | 'http';
}
export interface CameraSnapshot {
	contentType: string;
	data: Buffer;
}
export interface ICameraStreamProvider {
	getType(): string; // device `type` discriminator, e.g. 'devices-unifi-protect'
	listProfiles(device: DeviceEntity): Promise<CameraStreamProfile[]>;
	resolveSource(device: DeviceEntity, profileId: string): Promise<CameraStreamSource>;
	getSnapshot(device: DeviceEntity, options: { channelId?: string; highQuality?: boolean }): Promise<CameraSnapshot>;
	getSnapshotMinIntervalMs?(device: DeviceEntity): number;
}
```

Providers signal failure with `CameraOfflineException`, `CameraRateLimitedException` and
`CameraProfileUnavailableException` from `cameras.exceptions.ts`; any other error is treated as an upstream failure.

**REST** (Bearer auth, users and displays):

| Route | Result |
|---|---|
| `GET cameras` | `CamerasModuleResCameras`: camera and doorbell devices with `live_view` and `profiles` |
| `GET cameras/{deviceId}` | `CamerasModuleResCamera` |
| `GET cameras/{deviceId}/snapshot?profile=&hq=` | `image/jpeg`, `Cache-Control: no-store`, optional `X-Snapshot-Age` (seconds); 503 offline |
| `POST cameras/{deviceId}/sessions` body `{ data: { profile, transport } }` | `CamerasModuleResSession`: `{ session_id, url, expires_at }` |
| `GET status` (Plan 3) | relay state, version, active sessions |
| WS `/api/v1/modules/cameras/live?session=<token>` (Plan 3) | go2rtc MSE proxy |

**Session:** opaque 32-byte token, valid 60 s, single use for the upgrade, bound to device, profile and owner
(`{ kind: 'user' | 'display', id }`). Revoked on the four events of A2.

**Spec identifiers:** channel categories `object_detection`, `sound_detection`; property categories `object_type`,
`sound_type`. Protect channel identifiers `camera.main`, `camera.package`, `object_detection.<type>`,
`sound_detection.<type>`. `camera.source` value `unifi-protect:<protectDeviceId>:<main|package>`.

**Secret rule:** API keys and RTSPS aliases never reach logs, API responses, database rows, config-change events,
notifications or diagnostics. Every plan that touches them carries a test that greps its outputs for a planted
sentinel alias.

## 5. Task outline per plan

Outlines name the files and the tests that prove each task. Step-level detail lives in the plan files.

### Plan 1 — Spec extension (UP-1) — written

Five tasks: spec YAML and schemas; backend enums and migration 059; admin sorting, icons and six locales; panel
views, mappers and six `.arb` files; regeneration and cross-app verification.

### Plan 2 — Cameras module core (UP-2) — written

Seven tasks: module skeleton and wiring; provider contract and registry; camera listing; snapshot cache; stream
sessions and revocation; fake provider, secret hygiene and e2e; `docs/cameras-architecture.md`.

### Plan 3 — Relay and installer (UP-3, UP-4) — written

Step-level plans: `2026-11-13-cameras-plan-3a-relay.md` (UP-3) and `2026-11-13-cameras-plan-3b-installer.md` (UP-4).
Where they deviate from the outline below (registration at socket admission, `HttpAdapterHost` instead of
`AppInstanceHolder`, the cross-field config rule in a mutation handler, the Pi image call site in `01-install-app`, the
update-worker hook before the service stops), the plans win and say why.

UP-3 `feat(backend): relay camera live streams through a managed go2rtc service`:

1. **Config.** Extend `CamerasConfigModel` / `UpdateCamerasConfigDto` with nested `go2rtc { mode: 'managed' |
   'external' | 'disabled', binary_path, external_url }`, `max_sessions` (default 8), `max_sessions_per_camera`
   (default 4). Nested-object pattern: `plugins/devices-wled/models/config.model.ts`. Test: validation rejects
   `external` without a URL.
2. **`services/go2rtc-config.ts`** — pure `buildGo2rtcConfig(ports): string`: API and RTSP listeners on
   `127.0.0.1`, WebRTC disabled, no streams. Test: generated YAML snapshot; no `0.0.0.0`.
3. **`services/go2rtc-process.service.ts`** — spawn, 64-line stderr/stdout ring with URL redaction
   (`rtsp[sx]?://…` → `rtsp://<redacted>`), SIGTERM then SIGKILL. Copy the structure of
   `plugins/remote-access-cloudflare-tunnel/services/cloudflared-process.service.ts`. Test with a stub script as the
   binary: start, crash, stop, redaction.
4. **`services/go2rtc.service.ts`** — `BaseManagedExtensionService`, `owner { kind: 'module', type:
   CAMERAS_MODULE_NAME }`, `serviceId 'go2rtc'`; states `running | unavailable | disabled | error`; missing binary ⇒
   `unavailable` with no respawn loop (bounded backoff, max 5 attempts, then wait for config change). Add the row to
   `managed-service-registration.inventory.spec.ts` and bump its count from 22.
5. **`services/go2rtc-streams.service.ts`** — reference-counted registration through `PUT /api/streams?name=
   <deviceId>_<profile>&src=<url>`; removal after a 30 s idle grace; one upstream per profile. Uses
   `provider.resolveSource`. Test against a stub HTTP server: two viewers ⇒ one PUT; last leave ⇒ DELETE after grace;
   the source URL appears in no log line.
6. **`gateway/live-stream.gateway.ts`** — `WebSocketServer({ noServer: true })` on
   `/api/v1/modules/cameras/live`; consume the token synchronously, `handleUpgrade` immediately (A3), then open
   `ws://127.0.0.1:<api>/api/ws?src=…`, buffer client frames until upstream opens, propagate close both ways, pause
   on backpressure (`bufferedAmount` high-water mark), enforce session limits, max lifetime 4 h, close on plugin
   disable. Revocation: `CamerasModule.Session.Revoked` from Plan 2 covers only sessions not yet consumed, so the
   gateway itself subscribes to `DevicesModule.Device.Deleted`, `DisplaysModule.Display.Deleted`,
   `DisplaysModule.Display.TokenRevoked` and `UsersModule.User.Deleted` and closes every open socket whose session
   owner or device matches. The token travels in the query string: keep `/live` request URLs out of Fastify and
   proxy logs.
7. **`GET status`** controller and model (`CamerasModuleResStatus`); `POST sessions` now returns 503 when the relay
   is not running.
8. **E2E** `test/cameras-live.e2e-spec.ts` against a stub go2rtc (HTTP + WS echo): real port, `AppInstanceHolder`
   set by the test; token reuse rejected; limit reached ⇒ close code 1013; device deleted ⇒ socket closed.

UP-4 `feat(installer): ship go2rtc with server installations`:

1. `build/go2rtc/pin.env` (version, SHA-256 for arm64, armv7, amd64) and `build/go2rtc/install-go2rtc.sh` (download,
   verify, install to `/usr/local/lib/smart-panel/go2rtc`, exit 0 with a warning on failure, `--skip` opt-out).
   The pinned version comes from UP-0; until then the script is developed against the current upstream release.
2. Call it from `scripts/install-server.sh`, `build/raspbian/stage-smart-panel/00-install-deps/01-run-chroot.sh`
   and `docker/prod/Dockerfile` (multi-arch via `TARGETARCH`).
3. Existing installs: call it from `apps/backend/src/modules/system/scripts/update-worker.sh` after a successful
   update, non-fatal.
4. `THIRD-PARTY-NOTICES.md` (new, go2rtc MIT). Shell tests under `build/tests/` for checksum mismatch and download
   failure. Run `shellcheck` locally and add it to `ci-tests.yaml` for the touched scripts.

The default `go2rtc.binary_path` in UP-3 and the install path in UP-4 must be the same constant; UP-3 lands first
and UP-4 reads it from there.

### Plan 4 — Protect foundation (UP-0, UP-5, UP-6) — written

UP-0 ran against the maintainer's console on 2026-11-14 (PR #1623; results in the design doc §6). Step-level plans:
`2026-11-14-cameras-plan-4b-protect-foundation.md` (UP-5) and `2026-11-14-cameras-plan-4c-protect-discovery.md` (UP-6).
Where they deviate from the outline below (TLS `mode`/`server_name` instead of a boolean, the trigger rebuild in the
migration, live-verified discovery TLVs, subnet broadcast), the plans win and say why.

UP-5 `feat(backend): add UniFi Protect plugin foundation and API client`, modelled on `plugins/devices-homey`:

1. Skeleton: `devices-unifi-protect.constants.ts` (`DEVICES_UNIFI_PROTECT_PLUGIN_PREFIX = 'devices-unifi-protect'`,
   `…_PLUGIN_NAME = 'devices-unifi-protect-plugin'`, `…_TYPE = 'devices-unifi-protect'`, minimum version
   `7.2.105`), plugin module, `openapi.ts`, `app.module.ts` wiring, `registerPluginMetadata({ defaultEnabled:
   false })`.
2. Entities (`@ChildEntity` device, channel, property) with `protectNvrId`, `protectDeviceId`, `protectModelKey`,
   `protectMappingName`; one `ADD COLUMN` migration with a test; DTO subclasses; type mappers and discriminators.
3. Config model and DTO with `secretFields: [{ path: 'api_key', configuredPath: 'api_key_configured', inputPaths:
   ['apiKey'] }]`, nested `tls { verify, fingerprint_sha256 }`; readiness validator; row in
   `plugins/plugin-secret-removal.spec.ts`.
4. Pure units, each with its own spec: `protect-version.ts` (`isSupportedVersion`), `protect-rate-pacer.ts`
   (parses `RateLimit-Policy`, paces at 80 %), `protect-redaction.ts` (keys and `:7441/<alias>`),
   `protect-tls-policy.ts` (verify, pinned SHA-256, insecure with warning).
5. `ProtectApiClient` on Node `https` with a per-instance agent (global `fetch` cannot pin a certificate): timeout
   on every call, retries on 408/429/5xx honouring `Retry-After`, typed errors. A unit test asserts no method can
   build the path `disable-mic-permanently`.
6. `test/support/fake-protect-server.ts` (HTTPS REST now; WebSockets added in Plan 5) serving
   `__fixtures__/` files. Until UP-0 delivers captures, fixtures are derived from the published OpenAPI 7.3.70
   examples and marked `synthetic`.
7. `ProtectConnectorService` (`BaseManagedExtensionService`, `serviceId 'connector'`, generation counter, backoff
   1 s → 60 s with jitter), status model `disconnected | connecting | connected | degraded | auth_failed |
   version_unsupported | error`, `GET status`, `POST test-connection` (saved or candidate credentials, returns the
   peer certificate fingerprint); row in the managed-service inventory spec; e2e against the fake server.

UP-6 `feat(backend): discover UniFi Protect consoles on the local network`:

1. `protect-discovery-tlv.ts` — pure parser for the `>BBH` header and TLVs listed in design §8. Tests from a
   hand-built reply now and the UP-0 capture later; truncated and oversized TLVs are rejected, never thrown past
   the parser.
2. `ProtectDiscoveryService` — `dgram` broadcast and multicast, resend window, de-duplication by MAC, socket
   errors reported as scan status.
3. `protect-probe.ts` — `GET /api/system` and `GET /proxy/protect/api` classification with timeouts and
   `directConnectDomain` certificate check.
4. Controller `GET discovery`, `POST discovery/scan`, `POST discovery/probe`; owner and admin only.

UP-0 `test(backend): add UniFi Protect live spike suite and fixtures` runs whenever hardware is available:
`test/jest-unifi-spike.json` and `*.unifi-spike.ts` copied from the Homey spike setup, a capture-and-sanitize
script, results appended to the design doc §6. It replaces the synthetic fixtures and fixes: the doorbell
recognition rule, leak and alarm reset semantics, rate budget, go2rtc version, minimum Protect version.

### Plan 5 — Protect devices (UP-7 … UP-10)

UP-7 mapping and adoption — copy the Homey services one for one:
`mappings/definitions/{devices,channels,properties}.yaml`, `mappings/schema/mapping-schema.json`,
`mapping-loader.service.ts`, `protect-inventory.service.ts`, `protect-mapping-preview.service.ts`,
`protect-adoption.service.ts` with lock and undo journal, controllers `GET devices`, `GET devices/{id}`,
`POST mapping-preview`, `POST adopt`, `POST adopt/batch`. Golden test per device type: fixture in, expected
device/channel/property tree out, validated by `DeviceValidationService` against the spec. Channels come only from
`featureFlags`. Preview warnings: `stream_not_enabled`, `hevc_codec`, `third_party_camera`, `device_disconnected`.
`POST rtsps-stream` only for selected cameras; streams the plugin did not create are never deleted.

UP-8 real-time sync: `protect-realtime.service.ts` (two `ws` sockets with `X-API-KEY`, ping every 180 s,
subscribe → buffer → prime → apply), `protect-frame-merge.ts` (pure partial-update merge and property diff),
`protect-event-tracker.ts` (pure: open events per device and type, 60 s safety timeout, ring de-duplication by event
id across reconnects), `protect-synchronizer.service.ts` (writes via `ChannelsPropertiesService.update`,
connectivity via `DeviceConnectivityService.trySetConnectionState`, rings via
`ChannelInputOccurrencesService.publishOccurrence` with `sourceOccurrenceId`), degraded REST polling with a
notification raised once and resolved on recovery (pattern: `home-assistant.ws.service.ts:667`). Tests replay
recorded frames; e2e: event frame → property value → security alert.

UP-9 control: `platforms/unifi-protect-device.platform.ts`, `processBatch` grouping per Protect device into one
PATCH; transforms `ledLevel 1–6 ↔ %`; confirmation by the next device frame with a `GET` fallback.

UP-10 provider: `protect-stream.provider.ts` implementing `ICameraStreamProvider`; `rtsps://h:7441/<alias>?
enableSrtp` → `rtspx://h:7441/<alias>` plus `stream_host_override`; aliases cached in memory only; maintains
`camera.status` and `camera.source`; sentinel-alias test over logs, responses, properties and diagnostics.

### Plan 6 — Admin (UP-11, UP-12)

UP-11, template `apps/admin/src/modules/notifications`:

1. `modules/cameras` skeleton, stores `cameras.store.ts` and `relay-status.store.ts` with zod schemas, aliases
   appended to `openapi.constants.ts`.
2. `useCameraSnapshot` — blob GET through the typed client with `parseAs: 'blob'` (pattern:
   `modules/buddy/composables/useBuddyChat.ts:352`), object URL revoked on replace and unmount.
3. `live-view-machine.ts` — pure state machine `idle → requesting → connecting → playing | codec_unsupported |
   offline | relay_unavailable | error`, with reconnect backoff. This is the unit under test.
4. `CameraLiveView.vue` — session POST, WebSocket URL built from `window.location.origin` plus the Home Assistant
   ingress prefix (extract the regex repeated in `app.main.ts:155` into one helper), `MediaSource` or
   `ManagedMediaSource` (Safari). Player choice (vendored go2rtc `video-rtc` or own client) is decided in this PR
   after measuring both against the stub.
5. Category section registry in the devices module (A6) and the Cameras grid view and route.
6. Six locales with the parity spec.

UP-12, template `apps/admin/src/plugins/devices-homey`: status and inventory stores, config form (discovered
consoles, manual host, write-only key, TLS fingerprint confirmation, test connection, status panel), wizard adapter
with per-camera stream enablement, onboarding entry, row in `plugins/config-secrets.spec.ts`, six locales.

### Plan 7 — Panel (UP-13, UP-14)

UP-13: `modules/cameras/services/snapshot_service.dart` (Dio `ResponseType.bytes`), `snapshot_poller.dart` (pure
Dart timer logic with injected clock and visibility inputs; the tested unit), `CameraSnapshotView` widget with
`Image.memory` and `gaplessPlayback`, detail pages replacing the placeholders, package-camera selector, badges,
Cameras tab on the security screen, tappable entry-overview row, six `.arb` files.

UP-14: handle `DevicesModule.ChannelInput.Occurrence` in the panel devices module (A5), `DoorbellOverlayProvider`
next to `SecurityOverlayProvider` with ring debouncing, camera snapshot in the alert overlay by `sourceDeviceId`,
per-display boolean `doorbell_overlay` (backend entity, DTO and migration; admin form; panel model and repository —
the `screen_saver` field is the template).

### Plan 8 — Security and occupancy (UP-16, UP-21)

UP-16: extend the rule types with `when:` (AND guard) and allow a list of rules per channel category while the
existing single-rule form keeps loading; `ResolvedSensorRule.subtype`; alert id
`sensor:<deviceId>:<alertType>:<subtype>` only for rules with a subtype; default rules from #1193; message with
type and device name; add the two categories to `SECURITY_CHANNEL_CATEGORIES` in `security-state.listener.ts` so
value changes trigger re-evaluation. Tests are the four cases in #1193.

UP-21: add a dedicated `space-sensor-state.service.spec.ts` first (none exists), then person detection as
occupancy in `getSensorState()`, and — with Q2 — `object_detection` channels whose `object_type` value is `person`
as candidates in `SpaceOccupancyInputsService`.

### Plan 9 — Release (UP-19, UP-20)

Website pages, completed `docs/cameras-architecture.md`, one line in `CLAUDE.md`, `tasks/ROADMAP.md`; then the
acceptance matrix of #1197 on an alpha release, recorded in `tasks/epics/EPIC-UNIFI-PROTECT.md` §7.

## 6. Risks carried by the roadmap

| Risk | Where it is handled |
|---|---|
| The in-place CHECK change is refused by the SQLite driver | Plan 1 Task 2 proves it first and names the fallback |
| Synthetic fixtures diverge from a real console | UP-0 replaces them before Plan 5; mapping golden tests are re-run |
| engine.io kills the live upgrade | Plan 3 Task 6 and its e2e on a real port |
| Snapshot polling by several panels exhausts the console budget | Plan 2 cache and coalescing; shared pacer in Plan 4 |
| go2rtc cannot be pinned before UP-0 | UP-4 keeps the pin in one file; the release is blocked on it, development is not |
