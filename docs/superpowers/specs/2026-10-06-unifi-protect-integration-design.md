# UniFi Protect Integration and Camera Live View — Analysis and Design

- **Status:** proposed (analysis complete, decisions D1–D10 awaiting confirmation)
- **Date:** 2026-10-06
- **Epic:** [#1175](https://github.com/FastyBird/smart-panel/issues/1175), task file
  [`tasks/epics/EPIC-UNIFI-PROTECT.md`](../../../tasks/epics/EPIC-UNIFI-PROTECT.md)
- **Inspiration:** Home Assistant `unifiprotect` + `unifi_discovery` integrations, `uilibs/uiprotect`,
  `hjdhjd/unifi-protect` / `homebridge-unifi-protect`, Scrypted UniFi Protect plugin

## 1. Goal

Expose UniFi Protect cameras, doorbells, sensors and floodlights as ordinary Smart Panel devices so that:

1. their motion, smart detections, doorbell rings and sensor states feed the **security module** (alerts, events,
   notifications, armed-state severity),
2. users can see **live camera streams and snapshots in the admin** and **on the panel (display app)**,
3. discovery, adoption and control follow the same patterns as the other device plugins (Homey, Home Assistant).

Live video does not exist anywhere in Smart Panel today, so the epic necessarily delivers a reusable, plugin-independent
camera streaming capability in addition to the UniFi Protect plugin itself.

## 2. Summary of findings

| Question | Answer |
|---|---|
| Which API? | The official **UniFi Protect Integration API** (public, API key, `https://<console>/proxy/protect/integration/v1/…`), introduced in Protect 5.3 and much expanded through 7.3.70 (2 Oct 2026). It covers enumeration, settings, snapshots, RTSPS stream management, PTZ, talkback, lights, sensors, chimes, alarm manager and two JSON WebSockets. The private cookie/CSRF API is only needed for gaps (privacy mode, recording mode, IR, reboot, chime play, event thumbnails). |
| How to discover? | UDP broadcast/multicast on port **10001** (Ubiquiti discovery protocol, TLV replies) — what HA's `unifi_discovery` does. Confirm Protect with unauthenticated `GET /proxy/protect/api` → 401 and identify the console with `GET /api/system`. No usable mDNS. Manual host entry is always available. |
| How to add? | Admin creates an API key in Protect → *Integrations*; Smart Panel stores it as a write-only plugin secret, lists devices from `GET /v1/{cameras,sensors,lights}` and adopts them through the shared device wizard. |
| How to control? | `PATCH /v1/cameras|lights|sensors/{id}` with partial JSON. Public API control is mostly settings-level: floodlight on/brightness/mode, status LED, mic volume, HDR, video mode, OSD, smart-detect types, doorbell LCD message, PTZ presets/patrol, chime ring settings, arm profiles. |
| How to get state? | `wss://…/v1/subscribe/devices` (add/update/remove of device objects) and `wss://…/v1/subscribe/events` (motion, smart detect zone/line/loiter, audio detections, ring, sensor open/close/leak/tamper/alarm/battery, …) as JSON text frames. No replay → re-prime over REST after every reconnect. |
| How to get streams? | `POST /v1/cameras/{id}/rtsps-stream {"qualities":["high","medium","low","package"]}` returns `rtsps://<host>:7441/<alias>?enableSrtp`; `GET …/snapshot?highQuality=&channel=main|package` returns JPEG. Browsers and Flutter cannot play RTSP(S) directly → a relay is needed. |
| Recommended relay | **go2rtc** (MIT, single static binary, no ffmpeg needed for H.264/H.265 + AAC restream) bound to loopback, managed by the backend; the backend authenticates clients and proxies go2rtc's MSE/WebRTC WebSocket. HA uses the same approach (go2rtc since 2024.11). |
| Panel playback | flutter-pi is built **without** its GStreamer video player today (`-DBUILD_GSTREAMER_VIDEO_PLAYER_PLUGIN=OFF`) and the panel has no video package → MVP shows auto-refreshing snapshots; live video is a separate milestone that enables GStreamer in the image. |
| Security module fit | UP-Sense contact/motion/leak and camera motion map to existing channels that `SecuritySensorsProvider` already turns into alerts. Smart detections (person/vehicle/…) and audio detections need a small spec extension and a detection rule. |

## 3. Current state in Smart Panel

### 3.1 Device plugins (reference implementations)

- **Homey** (`apps/backend/src/plugins/devices-homey`) is the newest REST + realtime hub plugin and the template for
  this one: three identifiers (`*_PLUGIN_PREFIX`, `*_PLUGIN_NAME`, `*_TYPE`), `@ChildEntity` device/channel/property
  subclasses, config model with `secretFields` (`docs/config-secrets.md`), readiness validator, connector service
  extending `BaseManagedExtensionService`, bounded reconnect with jitter, reconciliation polling, `GET /status`,
  `POST /test-connection`, YAML mapping definitions with JSON-schema validation, mapping preview, idempotent adoption
  with per-device lock and compensating journal (`docs/homey-adoption-persistence.md`), platform `processBatch` with
  readback, golden fixtures and live spike suites.
- **Home Assistant** (`apps/backend/src/plugins/devices-home-assistant`) is the reference for a raw `ws` client, a
  self-managed mDNS discoverer service and a session-based wizard.
- **Admin** plugins register a `pluginConfigEditForm` and a `deviceWizardAdapter` (`IDeviceWizardAdapter`,
  `apps/admin/src/modules/devices/components/wizard/device-wizard.types.ts`), six locales, zod schemas.
- **Panel** is generic over device categories; device plugins usually ship no panel code.
- **Write-back**: `ChannelsPropertiesService.update()` → `CHANNEL_PROPERTY_VALUE_SET` → websocket gateway. Ephemeral
  gestures (doorbell ring) go through `ChannelInputOccurrencesService.publishOccurrence` (`docs/hardware-inputs.md`).
- **Discovery**: plugins browse mDNS themselves with `bonjour-service`. No plugin does UDP broadcast discovery yet.

### 3.2 Cameras today

- Spec: device `camera` requires channels `camera` + `device_information` (optional: battery, contact, humidity,
  light, microphone, motion, speaker, temperature). Device `doorbell` requires `doorbell` (+ optional `camera`,
  `motion`, `microphone`, `speaker`, …). Channel `camera` = `status` (enum, required), `source` (ro string, required,
  **semantics undefined**), optional `zoom`/`pan`/`tilt`/`infrared`/`fault`; `multiple: false`.
- There is **no spec slot for stream or snapshot access** and no smart-detection channel. New channel or property
  categories need a migration because category columns carry CHECK constraints
  (see `apps/backend/src/migrations/1000000000026-AddHardwareInputCategories.ts`).
- **No streaming or snapshot code exists** in backend, admin or panel. HA camera entities map to `status` only
  (`entity-mappings.yaml:822`) and would fail adoption on the missing required `source`.
- Panel camera/doorbell detail screens are placeholders (`apps/panel/lib/modules/devices/presentation/device_details/
  camera.dart`, `doorbell.dart`); the panel uses no network images at all.
- flutter-pi is built without video (`build/raspbian/modules/configure/files/build-flutter-pi.sh:31`), the display
  installer installs no GStreamer packages.

### 3.3 Security module

- `apps/backend/src/modules/security`: aggregator over a **fixed** provider list (`security.module.ts:57-62`:
  alarm, default, sensors). `SecuritySensorsProvider` evaluates any device's channels against
  `modules/security/spec/definitions/detection-rules.yaml` (one rule per channel category: smoke/co/leak/gas →
  critical, motion/occupancy → intrusion warning, contact → entry_open info). `doorbell` and `camera` channels are
  ignored. Alerts carry `sourceDeviceId/ChannelId/PropertyId`; notifications support only link actions, no images.
- No arm/disarm endpoint: arming means writing `alarm.state` of an `alarm` device.
- Panel security screen (`apps/panel/lib/modules/security/presentation/security_screen.dart`) has Entry points /
  Alerts / Events tabs and an alert overlay; there is no camera view. Admin has no security UI.
- Prior tasks explicitly left cameras out of scope (`FEATURE-SECURITY-SENSORS-PROVIDER`, `FEATURE-PANEL-SECURITY-SCREEN`,
  `FEATURE-SPACE-SECURITY-DOMAIN`), while `docs/domains.md` already describes "Guest arriving → show camera" and
  "Alarm triggered → show cameras" scenarios.

### 3.4 Serving binary content

- Backend runs on Fastify. Binary response precedent: `GET …/audio` in
  `modules/buddy/controllers/buddy-conversations.controller.ts:308-351` (`@ApiBinarySuccessResponse`, `@Res()`),
  `@RawRoute()` file streaming in `modules/extensions/controllers/discovered-extensions.controller.ts`.
- Raw `ws` upgrade handling on the shared HTTP server: `plugins/devices-shelly-ng/services/shelly-ws-server.service.ts`
  (`WebSocketServer({ noServer: true })` + `server.on('upgrade')`).
- Auth guard accepts only `Authorization: Bearer` (`modules/auth/guards/auth.guard.ts`). Browsers cannot set headers
  on `WebSocket`, `<img>` or `<video>`, so live view needs **short-lived stream tokens** (see §9.4).

## 4. UniFi Protect API landscape

### 4.1 Public Integration API (primary)

- Base: `https://<console>/proxy/protect/integration/v1/` (port 443). Optional cloud connector
  `https://api.ui.com/v1/connector/consoles/{consoleId}/proxy/protect/integration` (auth unverified — out of scope).
- Auth: `X-API-KEY: <key>` on REST and on the WebSocket upgrade. Keys are created by an administrator in
  *Protect → Integrations* (`https://<console>/protect/integrations/`); no read-only scope, the key acts with the
  creator's rights.
- OpenAPI spec: `https://developer.ui.com/protect/v{version}/openapi.json` (5.3.48 … 7.3.70) and inside the
  console at `/usr/share/unifi-protect/app/fixtures/integration/openapi.json`.
- Endpoints (7.3.70):

| Area | Endpoints |
|---|---|
| Meta / NVR | `GET meta/info` (`applicationVersion`), `GET nvrs` (doorbellSettings, `armMode`) |
| Cameras | `GET cameras`, `GET/PATCH cameras/{id}` |
| Streams | `POST/GET/DELETE cameras/{id}/rtsps-stream` (`qualities`: high, medium, low, package) |
| Snapshot | `GET cameras/{id}/snapshot?highQuality=&channel=main|package` → `image/jpeg` (503 when offline) |
| Audio | `POST cameras/{id}/talkback-session` → `{url: rtp://<cam>:7004, codec: opus|aac, samplingRate}`; `POST cameras/{id}/disable-mic-permanently` (**irreversible — never call**) |
| PTZ | `POST cameras/{id}/ptz/goto/{slot}`, `ptz/patrol/start/{slot}`, `ptz/patrol/stop` |
| Lights, sensors, chimes, viewers | list / get / PATCH; `liveviews` CRUD |
| Newer device families | sirens (play/stop/test), relays (outputs activate), speakers, fobs, bridges, link stations, alarm hubs |
| Alarm | `arm-profiles` (CRUD, `enable`/`disable` — local Alarm Manager only), `POST alarm-manager/webhook/{id}` |
| Files | `GET/POST files/animations` (doorbell LCD images) |
| WebSockets | `GET subscribe/devices`, `GET subscribe/events` |

- Camera object: `id, modelKey, state (CONNECTED|CONNECTING|DISCONNECTED), name, type, guid, mac, isMicEnabled,
  osdSettings, ledSettings, lcdMessage, micVolume, activePatrolSlot, videoMode, hdrType, smartDetectSettings,
  hasPackageCamera, featureFlags{supportFullHdSnapshot, hasHdr, smartDetectTypes[person|vehicle|package|licensePlate|
  face|animal], smartDetectAudioTypes[alrmSmoke|alrmCmonx|alrmSiren|alrmBabyCry|alrmSpeak|alrmBark|alrmBurglar|
  alrmCarHorn|alrmGlassBreak], videoModes, hasMic, hasLedStatus, hasSpeaker}`. No channel list, no recording or
  adoption fields.
- Light object: `lightModeSettings{mode always|motion|off, enableAt fulltime|dark}`, `lightDeviceSettings{
  isIndicatorEnabled, pirDuration, pirSensitivity, ledLevel 1–6}`, `isDark, isLightOn, isLightForceEnabled,
  isPirMotionDetected, lastMotion, camera`.
- Sensor object: `mountType, batteryStatus{percentage,isLow}, stats{light,humidity,temperature}{value,status},
  isOpened, isMotionDetected, leakDetectedAt, alarmTriggeredAt, tamperingDetectedAt`, threshold settings,
  `featureFlags`.
- WebSocket frames are JSON text: `{"type":"add"|"update"|"remove","item":{"id","modelKey",…partial}}`. An event
  arrives as `add` with `start` and `end: null`, then `update` with `end`. Event types (38 in 7.3.70) include
  `ring, motion, smartDetectZone, smartDetectLine, smartDetectLoiterZone, smartAudioDetect, lightMotion,
  sensorMotion, sensorOpened, sensorClosed, sensorWaterLeak, sensorTamper, sensorBatteryLow, sensorAlarm,
  sensorExtremeValues, sensorButtonPressed, sensorSmoke*/sensorCoFault, relayInputChanged, alarmHub*`.
  Thumbnails, licence-plate text and face names are **not** delivered.
- **Not available publicly:** privacy mode, recording mode, IR mode, zoom, WDR, chime type/play, speaker volume,
  reboot, adopt/unadopt, clear tamper, sensor status LED, NVR health/storage, event thumbnails and clips.

### 4.2 Private API (gap filler, optional)

`POST /api/auth/login` (local, non-SSO, non-MFA user) → `TOKEN` cookie + rotating `X-CSRF-Token`;
`GET /proxy/protect/api/bootstrap`; binary-framed `wss://…/proxy/protect/ws/updates`; partial-JSON PATCH of
`/proxy/protect/api/{cameras|lights|sensors|chimes}/{id}`; `…/reboot`, `chimes/{id}/play-speaker`,
`sensors/{id}/clear-tamper-flag`, `events/{id}/thumbnail`, `ws/livestream` (tokenised fMP4). Login is rate limited
(HTTP 429). `uiprotect` no longer accepts new private-API features — the direction is "public master, private fill".

### 4.3 Operational constraints

- **Rate limits:** `RateLimit-Policy` header (IETF draft-8), observed ≈ 10 requests/s per key, shared with the
  WebSockets; uiprotect paces at 80 % of the advertised budget and retries 408/429/5xx honouring `Retry-After`.
- **WebSocket keep-alive:** UniFi OS nginx `proxy_read_timeout` is 10 min and `subscribe/devices` can be quiet →
  ping every ~180 s; reconnect with backoff; **subscribe first, buffer, then prime over REST** (uiprotect
  `subscribe_*_and_prime`).
- **TLS:** consoles use self-signed certificates (also on RTSPS). `GET /api/system` returns `directConnectDomain`,
  a hostname with a valid certificate on many consoles.
- **Wrong host in stream URLs:** multi-homed consoles may return stream URLs on an unreachable interface → host
  override option (HA `override_connection_host`).
- **Stream alias is a bearer secret:** the RTSPS path segment grants access without further auth; it must never be
  persisted, logged, shown in the UI or sent to clients.
- **Codecs:** H.264 on most cameras; HEVC ("enhanced encoding") and reportedly AV1 on newer models. Audio AAC.
  Raspberry Pi 5 has hardware HEVC decode only and decodes H.264 in software; Pi 4 decodes both in hardware.
- **Third-party ONVIF cameras** (Protect 5.0.33+) appear as cameras but may lack smart detections and streams.
- **Alarm Manager "Global"** mode (any adopted Protect sensor/relay/alarm hub) hides arm profiles and makes the
  webhook return 400.
- **UniFi OS Server** (self-hosted) does not run Protect; cloud/SSO-only accounts cannot use the private API.

### 4.4 Version support

HA requires Protect ≥ 7.2.105 for API-key-only mode (HA 2026.9); the public API was introduced in 5.3.48 with 15
event types. Smart Panel gates features on `GET /v1/meta/info` → `applicationVersion` (see D3).

## 5. What Home Assistant does, and what we take

- **Config flow:** host, port, verify-SSL (default off), username/password (optional since 2026.9), API key
  (mandatory since 2025.8). Discovery via the separate `unifi_discovery` integration (UDP 10001, DHCP OUIs, SSDP for
  Dream Machines), preferring `directConnectDomain` when it has a valid certificate.
- **Entities:** per camera one `camera` entity per RTSPS quality (best enabled), binary sensors (motion, per-type
  smart detections, audio detections, doorbell, is-dark), `event` entities (ring, smart detection, motion,
  NFC/fingerprint), sensors (last ring, mic level, …), switches/selects/numbers for settings, `media_player` for
  talkback, buttons (reboot, adopt). Floodlight → `light` + motion. UP-Sense → contact/leak/motion/tamper/battery +
  temperature/humidity/light sensors. NVR → `alarm_control_panel` + arm-profile select (local Alarm Manager only).
- **Streams:** RTSPS URL (with `?enableSrtp` stripped) → go2rtc WebRTC, HLS `stream` fallback. Since HA 2026.7
  streams come from the public `rtsps-stream` endpoint; missing streams trigger a repair that creates one.

We take: API-key-first design, discovery protocol, version gating, subscribe-then-prime, rate pacing, entity
coverage as the mapping checklist, go2rtc as the relay. We do **not** take: HA's mandatory credentials, the private
WebSocket, per-quality camera entities (we model qualities as stream profiles of one device).

## 6. Decisions (proposed — confirm before implementation)

| # | Decision | Recommendation | Alternatives |
|---|---|---|---|
| **D1** | Where does live-view infrastructure live? | New core module **`cameras`** (stream-provider registry, snapshot endpoint, stream sessions/tokens, go2rtc relay). Device plugins only register a provider. HA, a future generic RTSP/ONVIF plugin and the simulator can reuse it. | Everything inside the UniFi plugin (fast, but not reusable and duplicates auth/relay code). |
| **D2** | Which UniFi API? | **Public Integration API only** in the MVP (API key). Private API as an optional later "full access" mode (UP-18). | Private API first via `unifi-protect` npm (ESM-only, no API-key support, different state model). |
| **D3** | Minimum Protect version | **≥ 7.2.105** (matches HA key-only mode); features gated on `meta/info`; older consoles get a clear "update Protect" status. Revisit after the spike. | ≥ 6.0 with reduced coverage. |
| **D4** | Client implementation | **Own thin TypeScript client** (REST + 2 JSON WebSockets with existing `ws` dependency), request/response types hand-written against the pinned OpenAPI version, fixtures from the spike. No new runtime dependency. | `unifi-protect` npm (private API only). |
| **D5** | Relay | **go2rtc** pinned release, run by the backend as a managed service bound to `127.0.0.1`; streams registered at runtime through its REST API; supports an **external go2rtc URL** mode for users who already run one (Frigate/HA). | MediaMTX; ffmpeg → HLS (seconds of latency, ffmpeg dependency); Protect private `ws/livestream` fMP4 (private API, no relay needed but ties live view to UniFi). |
| **D6** | Browser transport | **MSE over WebSocket proxied by the backend** first (works on LAN and through remote-access tunnels, H.264 + AAC without transcoding); WebRTC as an opt-in enhancement (needs UDP/ICE and Opus audio → ffmpeg). | WebRTC first; HLS. |
| **D7** | Panel MVP | **Auto-refreshing snapshots** (no new dependency, works on flutter-pi, Android, desktop). Live video in a later milestone after a flutter-pi GStreamer spike (UP-15). | Live video from day one (requires image + build changes and a decode-performance spike on Pi 4/Pi 5). |
| **D8** | Spec changes | Add channel **`object_detection`** (repeatable; `detected` bool + `object_type` enum person/vehicle/animal/package/license_plate/face), allow `object_detection`, `indicator`, `illuminance`, `smoke`, `carbon_monoxide` on `camera`/`doorbell`, make the `camera` channel `multiple: true` (package camera), and define `camera.source` as a **non-secret stream-source identifier** (never a URL). | Model each smart-detection type as a separate `motion`/`occupancy` channel (lossy, ambiguous in security alerts). |
| **D9** | Stream creation on the console | The adoption wizard offers "Enable RTSPS stream" per camera (default on, quality configurable); the plugin calls `POST rtsps-stream` only for cameras the user selected and never deletes streams it did not create. | Never touch the console (user must enable streams manually). |
| **D10** | Scope of consoles | **One console per plugin instance** in the MVP; device identifiers include the NVR id so that multi-console support can be added later without migration. | Multiple consoles in the config from day one. |

## 7. Architecture

```
                         ┌──────────────── UniFi OS console (Protect) ────────────────┐
                         │ REST /proxy/protect/integration/v1/*   WS subscribe/devices │
                         │ RTSPS :7441/<alias>                     WS subscribe/events │
                         └────────▲───────────────────────▲───────────────▲────────────┘
                                  │ X-API-KEY (TLS)        │ RTSPS          │ X-API-KEY (WSS)
┌──────────────────────── Smart Panel backend ──────────────────────────────────────────┐
│ plugins/devices-unifi-protect                       modules/cameras                   │
│  ├ ProtectApiClient (rate pacing, TLS policy)  ──▶   ├ CameraStreamProviderRegistry   │
│  ├ ProtectRealtimeService (2 WS, re-prime)          ├ SnapshotService (cache, coalesce)│
│  ├ discovery (UDP 10001 + probe)                    ├ StreamSessionService (tokens)    │
│  ├ inventory / mapping / adoption                   ├ Go2rtcService (managed, 127.0.0.1)│
│  ├ synchronizer → ChannelsPropertiesService          └ LiveStreamGateway (WS proxy)    │
│  ├ UnifiProtectDevicePlatform (PATCH)                         ▲            ▲            │
│  └ UnifiProtectStreamProvider ────────────────────────────────┘            │            │
│ modules/security ◀── devices/channels (motion, object_detection, contact, leak, …)      │
└─────────────────────────────────────────────────────────────────────▲──────┼────────────┘
                                                Bearer REST + stream token │      │ snapshot / live WS
                                              ┌────────────┐        ┌──────┴──────┴─────┐
                                              │ Admin (Vue)│        │ Panel (Flutter)    │
                                              └────────────┘        └────────────────────┘
```

### 7.1 `devices-unifi-protect` plugin (backend)

- Identifiers: prefix `devices-unifi-protect`, plugin name `devices-unifi-protect-plugin`, type
  `devices-unifi-protect`. Routes under `/api/v1/plugins/devices-unifi-protect/…`.
- Config (`models/config.model.ts`): `enabled`, `host`, `port` (443), write-only secret `api_key`
  (`api_key_configured` projection), `tls` (`verify` bool, optional pinned `fingerprint_sha256`), `stream_host_override`,
  `default_stream_quality` (`medium`), `snapshot_min_interval_ms` (2000), `poll_interval_ms` for degraded mode.
- Services: `ProtectApiClient` (Node `https`/`tls` agent with the TLS policy — `undici` is not a backend
  dependency — request pacing at 80 % of `RateLimit-Policy`,
  retries with `Retry-After`, typed errors), `ProtectConnectorService` (extends `BaseManagedExtensionService`,
  `serviceId: 'connector'`, generation counter, reconnect backoff with jitter, status), `ProtectRealtimeService`,
  `ProtectDiscoveryService`, `ProtectInventoryService`, `ProtectMappingService` (YAML definitions + preview),
  `ProtectAdoptionService` (Homey pattern), `ProtectSynchronizerService`, `UnifiProtectDevicePlatform`,
  `UnifiProtectStreamProvider`, config validator.
- Entities: `@ChildEntity` device/channel/property subclasses; identity columns (`protectNvrId`, `protectDeviceId`,
  `protectModelKey`, `protectMappingName`) → one incremental migration.
- Registration: same as Homey (`app.module.ts` router + imports, mappers, discriminators, swagger models,
  `registerPluginMetadata({ defaultEnabled: false })`, managed service, platform); rows in
  `plugin-secret-removal.spec.ts` and `managed-service-registration.inventory.spec.ts`.

### 7.2 `cameras` core module (backend)

- `CameraStreamProvider` contract (registered by device type, like `PlatformRegistryService`):
  - `listProfiles(device) → Promise<CameraStreamProfile[]>` — `{ id: 'high'|'medium'|'low'|'package'|…, channelId,
    width?, height?, fps?, videoCodec?, audioCodec?, available }` (no URLs);
  - `resolveSource(device, profileId) → Promise<{ url: string; transport: 'rtsp'|'rtsps-insecure'|'http' }>` — secret,
    used only to register the go2rtc stream;
  - `getSnapshot(device, { channelId?, highQuality? }) → Promise<{ contentType: string; data: Buffer }>`.
- REST (`/api/v1/modules/cameras/…`, Bearer auth, `*ResponseModel` envelopes):
  - `GET cameras` — camera/doorbell devices with live-view capability and profiles;
  - `GET cameras/{deviceId}/snapshot?profile=&hq=` — `image/jpeg`, `Cache-Control: no-store`, served from a per-camera
    cache (`snapshot_min_interval_ms`) with in-flight coalescing so several panels do not multiply console requests;
  - `POST cameras/{deviceId}/sessions` `{profile, transport: mse|webrtc|hls|mp4}` → `{ session_id, url, expires_at }`
    with a short-lived (60 s to start, bound to user/display and device) single-use token.
- Live endpoint: raw WebSocket upgrade `/api/v1/modules/cameras/live?session=<token>` (Shelly WS-server pattern)
  that proxies go2rtc `ws://127.0.0.1:<api>/api/ws?src=<stream>`; HTTP `GET …/live/{session}/stream.m3u8|stream.mp4`
  for the panel milestone. Concurrent session limit per camera and globally; idle teardown.
- go2rtc lifecycle as managed service (`owner: {kind: 'module', type: 'cameras'}`, `serviceId: 'go2rtc'`), modes
  `managed | external | disabled`; generated YAML config in `var/` with API and RTSP listeners on `127.0.0.1`,
  WebRTC disabled unless enabled; streams registered via `PUT /api/streams?name=<deviceId>_<profile>&src=<url>` only
  while sessions are active (lazy registration keeps the console's RTSPS load at zero when nobody watches).
- Module config: `go2rtc.mode`, `go2rtc.binary_path`, `go2rtc.external_url`, `max_sessions`,
  `max_sessions_per_camera`, `webrtc.enabled`, `webrtc.candidates`.
- Developer reference to be written as `docs/cameras-architecture.md`.

### 7.3 Admin

- `modules/cameras`: reusable `CameraLiveView` component (MSE player over the session WebSocket using a vendored,
  MIT-licensed go2rtc `video-rtc` player or a minimal own MSE client; snapshot fallback; codec-unsupported and
  offline states), shown on the device detail page for every `camera`/`doorbell` device regardless of plugin, plus a
  "Cameras" grid page. Snapshots fetched with the Bearer header and rendered from an object URL.
- `plugins/devices-unifi-protect`: config form (discovered consoles, host, write-only API key with "how to create
  a key" help, TLS verify/fingerprint confirmation, test connection, connection status panel), wizard adapter
  (inventory rows with mapping preview, stream enablement and quality per camera), onboarding integration entry,
  six locales.

### 7.4 Panel

- MVP: replace the camera/doorbell detail placeholders with a snapshot view (authenticated Dio request →
  `Image.memory`, refresh every 1–5 s while visible, paused when hidden), status, motion/detection badges; a
  "Cameras" tab on the security screen; a doorbell-ring overlay showing the doorbell snapshot; alert overlay shows
  the source camera snapshot when the alert comes from a camera.
- Live video milestone: build flutter-pi with `BUILD_GSTREAMER_VIDEO_PLAYER_PLUGIN=ON`, install GStreamer runtime
  packages (base, good, bad, libav) in the display image/installer, use the official `video_player` plugin
  (flutter-pi provides its platform implementation; Android uses ExoPlayer) with a tokenised HLS/fMP4 URL from the
  cameras module; prefer the `low`/`medium` profile; fall back to snapshots on unsupported codec or high CPU.

## 8. Discovery

1. **UDP discovery** (`ProtectDiscoveryService`, Node `dgram`, no dependency): send V1 `01 00 00 00` and V2
   `02 08 00 00` to `255.255.255.255:10001` and multicast `233.89.188.1:10001`, resend every timeout/3 within a
   ~5 s window; parse reply header `>BBH` + TLVs `>BH` (0x01 hwaddr, 0x02 mac+ip, 0x03 firmware, 0x0B hostname,
   0x0C platform, 0x14 model, 0x15 product, 0x16 version, 0x2B guid, 0x2F primary address, 0x30 direct-connect
   domain). De-duplicate by MAC.
2. **Probe** each candidate (and any manually entered host): `GET https://<ip>/api/system` (unauthenticated:
   `hardware.shortname`, `mac`, `name`, `directConnectDomain`) and `GET https://<ip>/proxy/protect/api` → `401`
   means Protect is installed. Report model, name, firmware, Protect presence, and whether `directConnectDomain`
   presents a valid certificate (preferred host when it does).
3. **API**: `GET discovery` (cached last scan), `POST discovery/scan`, `POST discovery/probe {host}`.
4. **Limitations:** broadcast does not cross VLANs/subnets and needs host networking in Docker; manual entry always
   works. DHCP/SSDP sniffing (HA) is out of scope.

## 9. Adding devices (adoption)

### 9.1 Flow

1. User enables the plugin, picks a discovered console (or types a host), pastes the API key, confirms the TLS
   fingerprint (TOFU) or enables verification, runs *Test connection* (`meta/info` version gate + `nvrs`).
2. The wizard lists `cameras`, `sensors`, `lights` (MVP) with their state, model and a mapping preview
   (target category, channels, properties, warnings such as "stream not enabled", "HEVC — browser support varies",
   "third-party camera without smart detections").
3. Adoption is idempotent and per item (Homey pattern: revalidate, per-device lock, compensating journal, partial
   success). For selected cameras without RTSPS streams the plugin calls `POST rtsps-stream` (D9).
4. Nothing is persisted before adoption. Re-running the wizard shows adopted devices as such and offers re-sync.

### 9.2 Identity

`identifier = <nvrMac>:<protectDeviceId>`; channel identifiers are stable mapping names (`camera.main`,
`camera.package`, `motion`, `object_detection.person`, …). Name changes in Protect propagate unless the user renamed
the device in Smart Panel.

### 9.3 Device lifecycle

`subscribe/devices` `remove` (device unadopted in Protect) marks the device disconnected and raises an admin
notification; it never deletes the Smart Panel device automatically. `state` maps to `device_information`
connection state (`CONNECTED` → connected, `CONNECTING` → init, `DISCONNECTED` → disconnected).

### 9.4 Stream access security

- RTSPS URLs and aliases live only in memory (plugin → cameras module → go2rtc on loopback); never in DB, config,
  properties, logs, diagnostics or API responses.
- Clients obtain a session with their normal Bearer token; the returned token is short-lived, single-use for the
  upgrade, scoped to one device/profile and to the requesting user or display, and revoked on logout/display
  revocation. Live sessions are closed when the device is deleted, the plugin is disabled or the token owner is revoked.
- go2rtc listens on loopback only; external mode requires an explicit URL and documents that the user secures it.

## 10. Device mapping (MVP)

### 10.1 Camera (non-doorbell) → device `camera`

| Protect source | Channel | Property | Notes |
|---|---|---|---|
| `name`, `type`, `mac`, firmware (devices WS), `state` | `device_information` | manufacturer = Ubiquiti, model, serial (MAC), firmware, connection state | |
| `state`, stream availability | `camera` (id `main`) | `status` (`available`/`offline`/`initializing`/`unavailable` when no stream), `source` (`unifi-protect:<id>:main`) | `in_use` while a live session is active (optional) |
| `hasPackageCamera` | `camera` (id `package`) | as above, `source` `…:package` | requires `multiple: true` (D8) |
| `motion` event add/end | `motion` | `detected` | safety reset after 60 s without `end` |
| `smartDetectZone/Line/Loiter` (`smartDetectTypes`) | `object_detection` per supported type | `detected`, `object_type` | D8; only types in `featureFlags.smartDetectTypes` |
| `smartAudioDetect` `alrmSmoke` / `alrmCmonx` | `smoke` / `carbon_monoxide` | `detected` | D8; other audio types out of MVP |
| `ledSettings.isEnabled` (`hasLedStatus`) | `indicator` | `on` (rw) | D8 |
| `micVolume`, `isMicEnabled` (`hasMic`) | `microphone` | `volume` (rw), `active` | |
| `isDark` (via light/camera where present) | — | — | not mapped in MVP |

### 10.2 Doorbell → device `doorbell`

Same as camera plus `doorbell` channel: `ring` event → `ChannelInputOccurrencesService.publishOccurrence`
(`single_press`, `sourceOccurrenceId` = Protect event id) and `event` value per spec. Doorbells are recognised by
model `type` / LCD capability (to be confirmed with fixtures). LCD message, chime pairing and talkback are later.

### 10.3 UP-Sense → device `sensor`

| Protect | Channel | Property |
|---|---|---|
| `isOpened` / `sensorOpened`/`sensorClosed` | `contact` | `detected` |
| `isMotionDetected` / `sensorMotion` | `motion` | `detected` |
| `leakDetectedAt` / `sensorWaterLeak` | `leak` | `detected` (reset rule from fixtures) |
| `stats.temperature.value` | `temperature` | `temperature` |
| `stats.humidity.value` | `humidity` | `humidity` |
| `stats.light.value` | `illuminance` | `illuminance` |
| `batteryStatus.percentage`, `isLow` | `battery` | `percentage`, `status` |
| `tamperingDetectedAt` / `sensorTamper` | on contact/motion channel | `tampered` |
| `alarmTriggeredAt` / `sensorAlarm`, `sensorSmoke*` | `smoke` / `carbon_monoxide` | `detected` (exact semantics from fixtures) |

Channels are created only for capabilities the sensor reports as enabled (`featureFlags`, mount type).

### 10.4 Floodlight → device `lighting`

| Protect | Channel | Property |
|---|---|---|
| `isLightOn` / `isLightForceEnabled` | `light` | `on` (rw → `isLightForceEnabled`) |
| `lightDeviceSettings.ledLevel` 1–6 | `light` | `brightness` (rw, 1–6 ↔ %) |
| `isPirMotionDetected`, `lightMotion` | `motion` | `detected` |
| `lightDeviceSettings.isIndicatorEnabled` | `indicator` | `on` (rw) |

### 10.5 Later / out of MVP

Chimes, sirens, relays, alarm hubs, speakers, viewers/liveviews, NVR health, PTZ presets, doorbell LCD text,
talkback, HDR/video-mode/OSD/smart-detect toggles, NFC/fingerprint, LPR text, event thumbnails and clips.

## 11. Real-time synchronisation

- Start: connect `subscribe/devices` and `subscribe/events`, buffer frames, prime state with `GET cameras/sensors/
  lights/nvrs`, apply buffered frames newer than the prime, then stream. Repeat on every reconnect (no replay).
- Device frames: partial `update` items merged into the cached device and diffed against mapped properties;
  only changed properties are written (`ChannelsPropertiesService.update`, debounced per property like HA).
- Event frames: `add` → set `detected = true` / publish occurrence; `update` with `end` → `detected = false`.
  Track open events per device+type; a safety timeout clears stale detections after reconnects.
- Keep-alive ping every 180 s; reconnect backoff 1 s → 60 s with jitter; after N failures enter `degraded` state
  with REST polling of device lists (`poll_interval_ms`) and an admin notification (HA plugin pattern).
- Status model: `disconnected | connecting | connected | degraded | auth_failed | version_unsupported | error`,
  exposed by `GET status` and websocket events for the admin panel.

## 12. Control

Platform `UnifiProtectDevicePlatform.processBatch` groups property writes per Protect device into one partial PATCH,
validates against the cached capability flags, and confirms by the following `subscribe/devices` update (readback
via `GET` on timeout). MVP writes: floodlight `on`/`brightness`/indicator, camera/doorbell status LED, microphone
volume. Everything else is read-only in the MVP. Rate pacing is shared with snapshots and polling.

## 13. Streams and snapshots

### 13.1 Admin live view (MVP)

1. Admin opens a camera → `POST /modules/cameras/cameras/{id}/sessions {profile: 'medium', transport: 'mse'}`.
2. Cameras module asks the provider for the source (`GET rtsps-stream`; convert
   `rtsps://h:7441/<alias>?enableSrtp` → `rtspx://h:7441/<alias>`, apply host override), registers it in go2rtc
   (if not yet registered) and returns a session token.
3. Browser opens `wss://<backend>/api/v1/modules/cameras/live?session=…`; the backend validates and proxies the
   go2rtc MSE WebSocket. go2rtc keeps one RTSPS connection per profile regardless of viewer count.
4. When the last session ends, the go2rtc stream is removed after an idle grace period (e.g. 30 s).

Expected latency: MSE ≈ 1–2 s on LAN; WebRTC (optional) < 1 s. HEVC plays in Chrome/Edge/Safari with hardware
support but not in Firefox → UI shows "unsupported codec" with a snapshot fallback; transcoding is out of scope.

### 13.2 Snapshots

Provider calls `GET cameras/{id}/snapshot?highQuality=false` (or `channel=package`). The cameras module caches per
camera/profile for `snapshot_min_interval_ms`, coalesces concurrent requests and returns the last good image with
`X-Snapshot-Age` when the console is rate limiting. Offline cameras return 503 → UI shows the offline state.

### 13.3 Panel live video (later milestone)

go2rtc HLS (`/api/stream.m3u8?src=`) or progressive fMP4 (`/api/stream.mp4?src=`) proxied by the cameras module
with a tokenised URL; flutter-pi GStreamer `playbin`/`video_player`. The spike must measure on Pi 4 and Pi 5:
startup time, latency, CPU at 720p/1080p H.264 and HEVC, memory, and behaviour when the display runs on a different
host than the backend.

## 14. Security module integration

- Works without security-module code changes for: camera/floodlight/UP-Sense `motion` (intrusion), UP-Sense
  `contact` (entry_open), `leak` (water_leak), `smoke`/`carbon_monoxide` (critical) — because
  `SecuritySensorsProvider` evaluates every device's channels.
- New: detection rule for `object_detection` (intrusion; severity warning, raised when armed like motion), alert
  message includes the object type and camera name.
- Panel uses `sourceDeviceId` of an alert to show the camera snapshot in the alert overlay when the source device
  is a camera/doorbell — no contract change needed.
- Optional: Protect Alarm Manager (local mode) as an `alarm` device (`state` ↔ `arm-profiles/enable|disable`, arm
  profile ↔ armed_home/away/night mapping) so Smart Panel arming can drive Protect and vice versa (UP-17).
- Out of scope: snapshot images in notifications, recording/clip browsing, a plugin-extensible provider registry.

## 15. Spec changes (D8)

1. `spec/devices/channels.yaml`: new `object_detection` channel (docGroup security): `detected` (bool, ro, required),
   `object_type` (enum person/vehicle/animal/package/license_plate/face/unknown, ro, required), optional `active`,
   `tampered`. Clarify `camera.source` description: "Stable, non-secret identifier of the stream source; never a URL
   or credential".
2. `spec/devices/devices.yaml`: `camera` and `doorbell` allow `object_detection` (multiple), `indicator`,
   `illuminance`, `smoke`, `carbon_monoxide`; `camera` channel `multiple: true` on both.
3. Backend enums (`ChannelCategory.OBJECT_DETECTION`, `PropertyCategory.OBJECT_TYPE`), CHECK-constraint migration,
   admin `devices.mapping.ts` + locales, panel enums/views; regenerate specs, OpenAPI, admin types and the Dart client.
4. Security detection rule for `object_detection`.

## 16. Testing strategy

- **Unit (Jest):** TLV parser, version gate, rate pacer, TLS policy, URL conversion/redaction, frame merge, event
  start/end handling, mapping definitions against fixtures (golden JSON per device type), platform PATCH batching,
  snapshot cache/coalescing, session tokens (expiry, single use, scope), go2rtc config generation.
- **E2E:** fake Protect server (REST + both WebSockets) from sanitized spike fixtures; wizard → adoption → events →
  property updates → security alerts; snapshot and session endpoints; go2rtc in `disabled` mode with a stub.
- **Admin (Vitest):** stores, wizard adapter, config form secret handling, live-view component state machine,
  locale parity, `config-secrets.spec.ts` row.
- **Panel:** widget tests for snapshot refresh lifecycle and doorbell overlay.
- **Hardware acceptance (UP-20):** real console (UDM/UCG/UNVR/CK G2+) with at least one H.264 camera, one doorbell,
  one UP-Sense and one floodlight; Pi 4 and Pi 5; matrix: discovery, key rotation, console reboot, Protect update,
  network loss, 10-min idle WS, 3 simultaneous viewers, remote-access (Tailscale/Cloudflare) live view, HEVC camera,
  rate-limit behaviour with 3 panels polling snapshots.

## 17. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Public API changes between Protect releases (EA/RC) | Version gate, tolerant parsing (unknown fields/events ignored), fixtures per tested version, spike suite re-run per release. |
| Rate limit (~10 req/s) exhausted by snapshots/polling | Shared pacer, snapshot cache + coalescing, lazy go2rtc registration, events over WS instead of polling. |
| Stream alias leak | Memory-only handling, redaction in logs/diagnostics, loopback go2rtc, tokens for clients. |
| HEVC/AV1 cameras not playable in some browsers / on Pi 5 | Detect codec, prefer H.264 profiles, clear UI message, snapshot fallback; transcoding out of scope. |
| go2rtc binary distribution on all install targets | Pinned version + SHA-256 per arch in installer, image and Docker; external mode as escape hatch; plugin degrades to snapshots without it. |
| Pi resource usage (go2rtc + backend + panel on one Pi) | go2rtc restream is copy-only (no transcoding); measured in the spike; session limits. |
| UDP discovery not working across VLANs / in Docker | Manual host entry, documented host-network requirement. |
| Alarm Manager "Global" mode | UP-17 detects mode and disables arm mapping with an explanatory status. |

## 18. Delivery plan

Sub-issues of the epic (IDs `UP-n`); details and dependencies in the epic task file.

| Milestone | Items |
|---|---|
| M0 Spike & contracts | UP-0 hardware/API spike and fixtures · UP-1 spec extensions |
| M1 Camera streaming core | UP-2 cameras module · UP-3 go2rtc relay and live WebSocket · UP-4 go2rtc in installer/image/Docker |
| M2 Plugin backend | UP-5 plugin foundation + API client · UP-6 discovery · UP-7 mapping & adoption · UP-8 real-time sync · UP-9 control platform · UP-10 stream & snapshot provider |
| M3 Admin | UP-11 camera live view components · UP-12 plugin config & adoption wizard |
| M4 Panel | UP-13 snapshot camera views · UP-14 doorbell ring and alert camera overlay · UP-15 live video on the panel |
| M5 Security & extras | UP-16 security rule for object detections · UP-17 Protect alarm manager as alarm device (optional) · UP-18 full-access private API mode (optional) |
| M6 Release | UP-19 documentation · UP-20 integrated verification and hardware acceptance |

## 19. References

- UniFi Protect API docs and OpenAPI: https://developer.ui.com/protect/ (v5.3.48 … v7.3.70)
- Ubiquiti blog, Protect Open API announcement (10 Apr 2025): https://blog.ui.com/article/physical-security-features
- Home Assistant `unifiprotect`: https://www.home-assistant.io/integrations/unifiprotect,
  https://github.com/home-assistant/core/tree/dev/homeassistant/components/unifiprotect
- Home Assistant `unifi_discovery`: https://github.com/home-assistant/core/tree/dev/homeassistant/components/unifi_discovery
- `uilibs/uiprotect` (api.py, data/public_devices.py, data/websocket.py, _rate_limit.py, stream.py):
  https://github.com/uilibs/uiprotect
- `uilibs/unifi-discovery`: https://github.com/uilibs/unifi-discovery
- `hjdhjd/unifi-protect` and `homebridge-unifi-protect`: https://github.com/hjdhjd/unifi-protect,
  https://github.com/hjdhjd/homebridge-unifi-protect
- go2rtc: https://github.com/AlexxIT/go2rtc, RTSP source docs https://go2rtc.org/internal/rtsp/
- flutter-pi GStreamer video player: https://github.com/ardera/flutter-pi#gstreamer-video-player
- Frigate UniFi Protect notes: https://docs.frigate.video/configuration/camera_specific/
