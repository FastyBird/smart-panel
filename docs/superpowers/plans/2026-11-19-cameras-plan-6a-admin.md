# Cameras Plan 6a — Admin Live View and Snapshots (UP-11) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the admin shows live video and snapshots for every `camera` and `doorbell` device, whichever plugin provides
it: a camera section on the device detail page, a Cameras grid page with a live view dialog, and the Cameras module
settings with the relay status (#1187).

**Architecture:** a new core admin module `apps/admin/src/modules/cameras` (template: `modules/notifications`). Two
Pinia stores read the existing REST API. A pure state machine (`live-view-machine.ts`) drives one player component
used in tiles, the dialog and the device section. Video is an own minimal MSE client over the session WebSocket; the
devices module gains a category-keyed detail section so a core module can add the camera section to any plugin's
device.

**Tech Stack:** Vue 3, Pinia, Element Plus, zod, openapi-fetch (typed client), Vitest with `@vue/test-utils`, jsdom.

**Spec:** [`docs/admin-ui-design-spec.md`](../../admin-ui-design-spec.md) §8 (screens, nine live view states, relay
reasons), §5–6 (templates, size classes); [`docs/cameras-architecture.md`](../../cameras-architecture.md) (REST API,
sessions, Live WebSocket, close codes, status route); issue #1187; roadmap
[`2026-11-12-cameras-roadmap.md`](2026-11-12-cameras-roadmap.md) Plan 6 and amendment A6.

## Decisions taken in this plan

| # | Decision | Why |
|---|---|---|
| P1 | **Own minimal MSE client**, no vendored go2rtc `video-rtc`. Decided without the side-by-side measurement the roadmap proposed, because only the MSE path is reachable through the backend. | The backend forwards only the `mse` reply and binary fMP4 (cameras-architecture, Client frames); `video-rtc` brings WebRTC, HLS and MJPEG paths the relay disables, plus a vendored licence file. The client is about 250 lines and fully testable with fakes. |
| P2 | **Category-keyed detail section** via module elements: a module registers an element `{ type: <module>, modules: [DEVICES_MODULE_NAME], components: { deviceCategorySection: { id, categories, component, order } } }`; `view-device.vue` renders matching sections **on the Overview tab above the channels**. The registry is layout-agnostic: redesign phase 3 places the sections wherever the new detail template puts them. | Spec §8 "player above the channels"; roadmap A6. Today's `deviceDetailTabs` is keyed by plugin type, so a core module cannot reach every camera. Module elements are the existing extension mechanism (`config/composables/useModules.ts`). |
| P3 | **Relay status is polled**: `GET /status` every 10 s while the grid, the module settings or a player in a relay or limit state is mounted, and immediately when a player enters `relay_unavailable`, `camera_limit` or `total_limit`, or a session POST answers 503. | The backend emits no relay status event (only `CamerasModule.Session.Revoked`). |
| P4 | **Current components, spec content.** Screens use today's `view-header`, `empty-state`, Element Plus and the current theme, but follow spec §8 for content, states, copy, routes, the sidebar position and icons. No hex values and no `gray-*` utilities in `.vue` files. Restyling onto the redesign wrappers (`state-view`, `list-filter-bar`, new `view-header`) happens in redesign phase 3. | `EPIC-ADMIN-UI-REDESIGN` phase 3 owns the Cameras screens' look; its wrappers do not exist yet. Nothing here may block that phase: no new shared component in `common/`, except the ingress helper. |
| P5 | **Cameras module settings form is in this plan** (spec §8 "Cameras module settings"). | Without it live view cannot be switched on from the admin; the schemas exist in `openapi.ts`. |
| P7 | **Error bodies are read by status first, text second.** Only 400 and 404 carry `error.details[].reason`; 503 and 403 are raw Nest bodies `{ message, error, statusCode }` (`BadRequestExceptionFilter`), so `getErrorReason` cannot read them. A session 503 is classified by `GET /status` (state not `running` → relay unavailable, else camera unavailable), never by its text. Snapshot 503s use the fixed backend messages through `readErrorMessage` (Task 1). | `common/filters/bad-request-exception.filter.ts:8`, `common/utils/api-error.utils.ts:4-20`. |
| P8 | **A disabled module is a screen state.** Every cameras route answers 404 "Cameras module is disabled" (`CamerasModuleEnabledGuard`). The grid, the device section and the player show "The Cameras module is turned off." with a link to its settings (admins and owners only), and the relay chip and panel accept a null status. | Otherwise a disabled module reads as "not a camera". |
| P6 | **Unavailable reasons as sentences** from `camerasModule.reasons.<code>` for the codes providers emit today (`stream_not_enabled`, `camera_offline`, `console_unavailable`, `stream_state_unknown`, `stream_tls_unverified`), and `camerasModule.reasons.unknown` for any other code. The raw code is never shown. | Spec §8 "unavailable reason as a sentence"; reason codes are short machine codes (`camera-stream.provider.ts`). |

## Global Constraints

- Commit and PR titles: `<type>(admin): <lowercase subject>`; the PR title is `feat(admin): add camera live view and snapshot components` with `Closes #1187`.
- Never edit generated files: `src/openapi.ts`, `spec/api/v1/openapi.json`, `apps/admin/src/spec`. `src/openapi.constants.ts` is hand-maintained: the cameras schema and operation aliases already exist (lines 973–988); only append enum re-exports.
- No new dependencies.
- Six locales (`cs-CZ`, `de-DE`, `en-US`, `es-ES`, `pl-PL`, `sk-SK`) with a parity spec copied from `modules/notifications/locales/locales.spec.ts`; allow about 35 % longer labels.
- Secret rule: a session token (`session.url`'s query) never reaches a log line, an error message, store state, a route or the DOM; it goes only to the WebSocket constructor. A snapshot object URL goes only to `<img src>` and the download link, never to a log or store. Log fixed texts only.
- Profiles are embedded in the camera payload (`CamerasModuleDataCamera.profiles`), so the issue's "stores for cameras, profiles and relay status" is two stores. The issue's `CameraLiveView` is `camera-player.vue` plus `useLiveView`.
- Hand-written zod schemas, not the generated types, decide nullability: the generated `CamerasModuleDataRelayStatus.reason` is non-nullable but is `null` while running (`openapi.ts:29955`).
- Snapshots: fetched through the typed client (Bearer header) with `parseAs: 'blob'`, shown through an object URL that is revoked when replaced and on unmount.
- Live view retry: 5 attempts with backoff 2, 4, 8, 16, 30 s, then stop and show Retry (spec §8).
- Sidebar: Cameras after Spaces (`meta.menu: 8500`), icon `mdi:cctv`, roles any authenticated user (the API allows users). Links to the module settings (`RouteNames.CONFIG_MODULE_EDIT` from `config.constants.ts:20` with `params: { module: 'cameras-module' }`) are shown to admins and owners only.
- Grid: tiles `minmax(320px, 1fr)` (300 px from tablet portrait to tablet landscape), snapshots refresh every 10 s, only while the page is visible (`document.visibilityState`) and the tile is on screen (`IntersectionObserver`).
- Work behind Home Assistant ingress, Tailscale and Cloudflare Tunnel: every URL is built from `window.location.origin` plus the ingress prefix; `ws:` / `wss:` follows `http:` / `https:`.
- Admin checks before each commit: `pnpm --filter ./apps/admin exec vitest --run <specs>`, `pnpm --filter ./apps/admin run type-check`, `pnpm --filter ./apps/admin exec eslint <files>`, `pnpm --filter ./apps/admin exec prettier --check <files>`. Regenerate `src/openapi.ts` locally with `pnpm run generate:openapi` if it is missing.

## Review Focus

1. **A session URL used twice.** A token works once; every reconnect (retry, profile switch, `max_lifetime`) must POST a new session. Test in Task 5 (`reconnect creates a new session`).
2. **Safari / iOS without `MediaSource`.** Use `ManagedMediaSource` when `MediaSource` is missing, and show `codec_unsupported` when neither exists, never a blank player. Test in Task 4.
3. **Leaks when a tile scrolls away or the dialog closes mid-connect.** Unmount during `requesting` or `connecting` must abort the POST, close the socket, revoke object URLs and clear timers; no state change after unmount. Test in Task 5.
4. **A camera with no available profile** (`live_view: false` or every profile `available: false`). Show the snapshot with the reason sentence, never start a session. Test in Task 6.
5. **Ingress prefix in the live URL.** `session.url` is relative to `/api/v1` origin without the ingress prefix; the WebSocket URL must include it. Test in Task 1 (`buildLiveSocketUrl`).

---

### Task 1: Module skeleton, ingress helper and routes

**Files:**
- Create: `apps/admin/src/common/utils/ingress.utils.ts`, `ingress.utils.spec.ts`; export from `common/utils/utils.ts`.
- Modify: `apps/admin/src/app.main.ts:155-162` and `apps/admin/src/common/services/router.ts:7-9` to use the helper.
- Create: `apps/admin/src/modules/cameras/{index.ts, cameras.module.ts, cameras.constants.ts, cameras.exceptions.ts, cameras.utils.ts, cameras.utils.spec.ts}`, `locales/{index.ts, locales.spec.ts, <6>.json}`, `router/index.ts`, `views/view-cameras.vue` (placeholder body until Task 7).
- Modify: `apps/admin/src/app.main.ts` (import between `BuddyModule` and `ConfigModule`; `app.use(CamerasModule, moduleOptions)` after `RemoteAccessModule`), `apps/admin/src/openapi.constants.ts` (append re-exports of `CamerasModuleCreateSessionTransport`, `CamerasModuleDataGo2rtcConfigMode`, `CamerasModuleDataRelayStatusState`, `CamerasModuleDataRelayStatusReason`; add schema aliases for `CamerasModuleDataConfig`, `CamerasModuleUpdateConfig`, `CamerasModuleDataGo2rtcConfig` next to the existing cameras block).

**Interfaces:**
- Produces: `resolveIngressBase(pathname: string): string` (`'/api/hassio_ingress/<token>'` or `''`); `buildApiBase(location: Pick<Location, 'origin' | 'pathname'>): string` (`${origin}${ingress}/api/v1`).
- Produces (`cameras.utils.ts`): `buildLiveSocketUrl(sessionUrl: string, location: Pick<Location, 'origin' | 'pathname' | 'protocol'>): string`; `isCameraCategory(category: string): boolean` (`camera` or `doorbell`); `readErrorMessage(error: unknown): string | null` (the first `error.details[].reason` when present, else a top-level string `message`, else null); `isModuleDisabledError(status: number, error: unknown): boolean` (404 and message `Cameras module is disabled`); `isDeviceOffline(device: IDevice | null | undefined): boolean | null` (null when the device is unknown or its connection status is `unknown`; true for `disconnected` and `lost`; false otherwise).
- Produces (`cameras.constants.ts`): `CAMERAS_MODULE_PREFIX = 'cameras'`, `CAMERAS_MODULE_NAME = 'cameras-module'`, `CAMERAS_MODULE_EVENT_PREFIX = 'CamerasModule.'`, `RouteNames.CAMERAS = 'cameras_module-cameras'`, `SNAPSHOT_REFRESH_MS = 10_000`, `RELAY_STATUS_POLL_MS = 10_000`, `LIVE_RETRY_DELAYS_MS = [2000, 4000, 8000, 16000, 30000] as const`.
- Produces (`cameras.exceptions.ts`): `CamerasException`, `CamerasApiException(message, code)`, `CamerasValidationException`.
- i18n namespace `camerasModule`; menu title key `camerasModule.menu.title` ("Cameras").

- [ ] **Step 1: Write the failing tests**

```ts
// ingress.utils.spec.ts
expect(resolveIngressBase('/api/hassio_ingress/abc123/devices')).toBe('/api/hassio_ingress/abc123');
expect(resolveIngressBase('/devices')).toBe('');
expect(buildApiBase({ origin: 'https://ha.local', pathname: '/api/hassio_ingress/abc/' })).toBe('https://ha.local/api/hassio_ingress/abc/api/v1');

// cameras.utils.spec.ts — 'buildLiveSocketUrl'
expect(buildLiveSocketUrl('/api/v1/modules/cameras/live?session=T', { origin: 'https://x.ts.net', pathname: '/cameras', protocol: 'https:' }))
	.toBe('wss://x.ts.net/api/v1/modules/cameras/live?session=T');
expect(buildLiveSocketUrl('/api/v1/modules/cameras/live?session=T', { origin: 'http://ha:8123', pathname: '/api/hassio_ingress/abc/cameras', protocol: 'http:' }))
	.toBe('ws://ha:8123/api/hassio_ingress/abc/api/v1/modules/cameras/live?session=T');
expect(() => buildLiveSocketUrl('https://evil.example/live?session=T', loc)).toThrow(CamerasException); // only a path is accepted
expect(isCameraCategory('doorbell')).toBe(true);
expect(isCameraCategory('sensor')).toBe(false);
// readErrorMessage covers both body shapes the backend sends
expect(readErrorMessage({ message: 'Live view relay is not available', error: 'Service Unavailable', statusCode: 503 })).toBe('Live view relay is not available');
expect(readErrorMessage({ error: { details: [{ reason: 'Cameras module is disabled' }] } })).toBe('Cameras module is disabled');
expect(isDeviceOffline(deviceWith('unknown'))).toBeNull();
expect(isDeviceOffline(deviceWith('lost'))).toBe(true);
```

Verify the 404 body shape against `NotFoundExceptionFilter` before writing the second `readErrorMessage` case, and copy the real shape.

The locale parity spec is the notifications copy pointed at `./index`, with an `ALLOWED_IDENTICAL` list for words that are the same in every language (`MSE`, `H.264`, `AAC`, `go2rtc`, `LIVE`, the transport separator).

- [ ] **Step 2: Run them to verify they fail** — `pnpm --filter ./apps/admin exec vitest --run src/common/utils/ingress.utils.spec.ts src/modules/cameras` → FAIL (modules missing).
- [ ] **Step 3: Implement** the helpers, constants, exceptions, the module `install` (locale merge, `modulesManager.addModule` with `isCore: true`, routes under `AppRouteNames.ROOT`; stores and elements come in later tasks), the route `{ path: 'cameras', name: RouteNames.CAMERAS, meta: { guards: { authenticated: true }, title, icon: 'mdi:cctv', menu: 8500 } }`, `en-US.json` with `menu.title`, `headings.cameras` ("Cameras"), `subHeadings.cameras` ("Live view and snapshots of every camera") and the other five locales translated. Switch `app.main.ts` and `router.ts` to `resolveIngressBase`.
- [ ] **Step 4: Run tests, type-check and lint** → PASS; the app builds (`pnpm --filter ./apps/admin run build:no-check`).
- [ ] **Step 5: Commit** — `feat(admin): add the cameras module skeleton and an ingress url helper`

### Task 2: Cameras and relay status stores

**Files:**
- Create: `modules/cameras/store/{index.ts, keys.ts, cameras.store.ts, cameras.store.schemas.ts, cameras.store.types.ts, cameras.transformers.ts, relay-status.store.ts, relay-status.store.schemas.ts, relay-status.transformers.ts}` and specs `cameras.store.spec.ts`, `relay-status.store.spec.ts`, `cameras.transformers.spec.ts`.
- Modify: `cameras.module.ts` (register both stores with `storesManager`, data refresh registration).

**Interfaces:**
- Produces types (camelCase after `snakeToCamel`): `ICameraProfile { id; channelId: string | null; width: number | null; height: number | null; fps: number | null; videoCodec: string | null; audioCodec: string | null; available: boolean; unavailableReason: string | null }`, `ICamera { deviceId; name; category: string; type: string; liveView: boolean; profiles: ICameraProfile[] }`, `IRelayStatus { relay: { mode: CamerasModuleDataGo2rtcConfigMode; state: CamerasModuleDataRelayStatusState; reason: CamerasModuleDataRelayStatusReason | null; version: string | null }; sessions: { active: number; max: number; maxPerCamera: number } }`.
- Produces `useCameras()` (id `cameras_module-cameras`): state `data: Record<string, ICamera>`, `semaphore { fetching: boolean; getting: string[] }`; actions `fetch(): Promise<ICamera[]>`, `get({ deviceId }): Promise<ICamera>`, `findAll(): ICamera[]` (sorted by name), `findById(deviceId): ICamera | null`, `isLoaded()`, `refresh()`; `registerCamerasStore(pinia)`.
- Produces `useRelayStatus()` (id `cameras_module-relay_status`): state `status: IRelayStatus | null`; actions `get(): Promise<IRelayStatus>` (coalesces concurrent calls), `startPolling(): () => void` (reference-counted: the interval of `RELAY_STATUS_POLL_MS` runs while at least one caller holds it; the returned function releases), `isLoaded()`, `refresh()`.
- Errors: `CamerasApiException(getErrorReason(error, '<fixed text>'), response.status)`; zod failures throw `CamerasValidationException`.

- [ ] **Step 1: Write the failing tests** (template `notifications.store.spec.ts`: hoisted `mockBackendClient`, `useBackend` mocked):
  - `fetch stores every camera and drops cameras missing from the next fetch` (two responses; second omits one).
  - `get updates one camera` and `get throws CamerasApiException with the response status on 404`.
  - `transformers reject a profile without available` (zod failure → `CamerasValidationException`).
  - `relay status get coalesces concurrent calls` (two calls, one `GET`).
  - `startPolling polls every 10 s while held and stops after the last release` (fake timers: two holders, release one → still polling, release second → no more calls).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** with the paths `` `/${MODULES_PREFIX}/${CAMERAS_MODULE_PREFIX}/cameras` ``, `.../cameras/{deviceId}`, `.../status` (template `weather/store/weather-forecast.store.ts`).
- [ ] **Step 4: Run tests, type-check, lint** → PASS.
- [ ] **Step 5: Commit** — `feat(admin): add cameras and relay status stores`

### Task 3: Snapshot composable

**Files:**
- Create: `modules/cameras/composables/{composables.ts, useCameraSnapshot.ts, useCameraSnapshot.spec.ts}`.

**Interfaces:**
- Produces: `useCameraSnapshot(deviceId: MaybeRefOrGetter<string>, options?: { profile?: MaybeRefOrGetter<string | null>; hq?: boolean; refreshMs?: number | null; active?: MaybeRefOrGetter<boolean> }): { url: Ref<string | null>; ageSeconds: Ref<number | null>; takenAt: Ref<Date | null>; error: Ref<CameraSnapshotError | null>; loading: Ref<boolean>; reload(): Promise<void> }`.
- `CameraSnapshotError = 'offline' | 'busy' | 'unavailable' | 'module_disabled' | 'not_found' | 'failed'` (503 with `readErrorMessage` "Camera is offline" → `offline`; 503 with "Camera is busy" or a `Retry-After` header → `busy`; other 503 → `unavailable`; `isModuleDisabledError` → `module_disabled`; other 404 → `not_found`; anything else → `failed`). The server text is only matched, never shown.
- Behaviour: GET `.../cameras/{deviceId}/snapshot` with `query: { profile?, hq: 'true' | 'false' }`, `parseAs: 'blob'` (cast as in `useBuddyChat.ts:352`), `signal`. `ageSeconds` from `X-Snapshot-Age` (absent → 0). A failed reload keeps the previous image and sets `error`. Refresh every `refreshMs` (default `SNAPSHOT_REFRESH_MS`; `null` = no timer) only while `document.visibilityState === 'visible'` and `active` is true (default true; tiles pass their `IntersectionObserver` visibility); a reload on `visibilitychange` to visible. Timer reloads never overlap (a timer tick while a request runs is skipped). Changing `deviceId` or `profile` aborts the running request, clears the in-flight flag and reloads. `reload({ hq?: boolean })` may override `hq` for one request (the dialog's Snapshot button).

- [ ] **Step 1: Write the failing tests** (mount a tiny host component; stub `URL.createObjectURL`/`revokeObjectURL`):
  - `revokes the previous object URL when a new snapshot replaces it`.
  - `revokes the object URL and aborts the request on unmount`.
  - `reads the age from X-Snapshot-Age`.
  - `maps a 503 Camera is offline to offline and keeps the last image`.
  - `does not refresh while the page is hidden and reloads when it becomes visible`.
  - `aborts the running request when the profile changes and loads the new profile` (the reload after the abort is not skipped).
  - `maps a 404 Cameras module is disabled to module_disabled`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run, type-check, lint** → PASS.
- [ ] **Step 5: Commit** — `feat(admin): add the camera snapshot composable`

### Task 4: Live view state machine and MSE client

**Files:**
- Create: `modules/cameras/live/{live-view-machine.ts, live-view-machine.spec.ts, mse-client.ts, mse-client.spec.ts, codecs.ts, codecs.spec.ts}`.

**Interfaces:**
- Produces (`live-view-machine.ts`, pure, no DOM, no timers — the caller schedules):
  - `LiveViewState = 'snapshot' | 'requesting' | 'connecting' | 'playing' | 'codec_unsupported' | 'offline' | 'relay_unavailable' | 'camera_limit' | 'total_limit' | 'module_disabled' | 'error'` (the spec's nine states plus `requesting`, drawn like `connecting`, and `module_disabled` from P8).
  - `LiveViewEvent = { type: 'start' } | { type: 'stop' } | { type: 'retry' } | { type: 'session_created' } | { type: 'session_failed'; failure: SessionFailure } | { type: 'media_started' } | { type: 'playing_stable' } | { type: 'socket_closed'; code: number; reason: string } | { type: 'codec_unsupported' } | { type: 'device_offline' } | { type: 'device_online' } | { type: 'retry_due' }`.
  - `SessionFailure = 'relay_unavailable' | 'camera_unavailable' | 'module_disabled' | 'not_found' | 'forbidden' | 'failed'` (`module_disabled` → state `module_disabled`).
  - `interface LiveViewContext { state: LiveViewState; attempt: number; retryInMs: number | null; reconnect: boolean }`.
  - `transition(context: LiveViewContext, event: LiveViewEvent): LiveViewContext`; `initialContext(): LiveViewContext` (`snapshot`, attempt 0).
- Rules (copy exactly):
  - An event that has no rule for the current state is ignored (the same context is returned). A late `media_started`, `socket_closed` or `retry_due` after `stop` changes nothing.
  - Idle states: `snapshot`, `codec_unsupported`, `relay_unavailable`, `camera_limit`, `total_limit`, `module_disabled`, and `error` with `retryInMs === null`. `start` and `retry` from an idle state → `requesting`, attempt 0. `offline` leaves only through `device_online`. `stop` → `snapshot` from anywhere except `offline` (stays `offline`).
  - `session_created` (from `requesting`) → `connecting`; `media_started` (from `connecting`) → `playing` and `reconnect: false`. `playing_stable` (sent by the composable after 10 s of `playing`) → attempt 0, so a stream that dies every second still backs off.
  - `session_failed`: `relay_unavailable` → `relay_unavailable`; `camera_unavailable` (503 offline / busy / did not respond) and `failed` → retryable error; `not_found`, `forbidden` → `error` without retry.
  - `socket_closed` (from `connecting` or `playing`): 1013 `relay_unavailable` → `relay_unavailable`; 1013 `session_limit` → `total_limit`; 1013 `camera_session_limit` → `camera_limit`; 4002 `max_lifetime` from `playing` → `requesting` immediately with `reconnect: true`, not counted as an attempt (from `connecting` it is a retryable error, so it cannot loop); 4000 `revoked`, 1003, 1008 → `error` without retry; 4001 `module_disabled` → `module_disabled`; any other code (1001, 1006, 1011, 1013 `slow_consumer`) → retryable error. With `reconnect: true` the UI keeps the last video frame and shows no connecting overlay.
  - Retryable error: `attempt + 1`; while `attempt <= 5`, state `error` with `retryInMs = LIVE_RETRY_DELAYS_MS[attempt - 1]`; `retry_due` → `requesting`. After the fifth failed retry `retryInMs = null` (stopped; the UI shows Retry). `retry` (button) → `requesting`, attempt 0.
  - `device_offline` → `offline` from any state; `device_online` from `offline` → `snapshot`.
  - `codec_unsupported` → `codec_unsupported` (no retry).
- Produces (`codecs.ts`): `MSE_CODECS` (the go2rtc list: `avc1.640029`, `avc1.64002A`, `avc1.640033`, `hvc1.1.6.L153.B0`, `mp4a.40.2`, `mp4a.40.5`, `flac`, `opus`); `getMediaSourceCtor(win = window): typeof MediaSource | null` (`MediaSource` ?? `ManagedMediaSource` ?? null); `supportedCodecs(ctor): string` (comma-joined subset passing `ctor.isTypeSupported('video/mp4; codecs="<c>"')`); `canPlayProfileCodec(videoCodec: string | null, ctor): boolean` (`h264`/`avc` → `avc1.640029`, `h265`/`hevc` → `hvc1.1.6.L153.B0`, null or unknown → true); `describeMime(mime: string): { video: string | null; audio: string | null }` (`avc1.*` → `H.264`, `hvc1.*`/`hev1.*` → `H.265`, `mp4a.*` → `AAC`, `opus` → `Opus`, `flac` → `FLAC`).
- Produces (`mse-client.ts`): `class MseClient { constructor(options: { url: string; video: HTMLVideoElement; mediaSource: typeof MediaSource; createSocket?: (url: string) => WebSocket; onEvent: (event: MseClientEvent) => void }); start(): void; close(): void }` with `MseClientEvent = { type: 'mime'; mime: string } | { type: 'media_started' } | { type: 'codec_unsupported' } | { type: 'closed'; code: number; reason: string }`. Behaviour:
  - Before anything else: `supportedCodecs()` empty → emit `codec_unsupported` and do not open the socket.
  - Video element: `muted = true`, `playsInline = true`, `disableRemotePlayback = true` (required by `ManagedMediaSource` on iOS); attach the source with an object URL and wait for `sourceopen` before `addSourceBuffer`.
  - Socket: `binaryType = 'arraybuffer'`; on open send exactly one text frame `{"type":"mse","value":"<supportedCodecs>"}`; on the `mse` reply check `isTypeSupported(mime)` (else `codec_unsupported` and close), emit `mime`, open a `SourceBuffer` with `mode = 'segments'`.
  - One operation queue for `appendBuffer` and `remove` (never concurrent), drained on `updateend`; after each append trim ranges older than `currentTime - 30 s`; on `QuotaExceededError` trim and retry the append once, then close with a fixed error.
  - Jump to the live edge when more than 5 s behind. With `ManagedMediaSource`, pause appends between `endstreaming` and `startstreaming`.
  - `media_started` is emitted once, on the video's `playing` event (not on the init segment). `video.play()` rejections are caught (autoplay is muted, so a rejection only means the user must press play; it is not an error).
  - `close()` is idempotent: removes listeners, closes the socket, ends the source, `video.removeAttribute('src')`, `video.load()`, revokes the object URL; it emits nothing.

- [ ] **Step 1: Write the failing tests**
  - Machine (table-driven): every rule above, including `retries five times with 2, 4, 8, 16, 30 s then stops`, `max_lifetime reconnects without counting an attempt`, `max_lifetime while connecting counts as a failure`, `ignores media_started after stop`, `resets the attempt only after playing_stable`, `retry after stop resets the attempt counter`, `device_offline overrides playing and stop keeps offline`.
  - Codecs: `prefers MediaSource and falls back to ManagedMediaSource`, `returns null without either` (Review Focus 2), `canPlayProfileCodec reports h265 as unsupported when hvc1 is not supported`, `describeMime('video/mp4; codecs="avc1.640029,mp4a.40.2"')` → `{ video: 'H.264', audio: 'AAC' }`.
  - MSE client with a fake socket and fake `MediaSource`/`SourceBuffer`: `opens no socket when no codec is supported`, `waits for sourceopen before adding the source buffer`, `sends one mse request with the supported codecs on open`, `reports codec_unsupported for an unsupported mse reply and closes`, `never runs remove while an append is updating`, `emits media_started once on the playing event`, `trims the buffer to 30 s`, `retries an append once after QuotaExceededError`, `sets disableRemotePlayback and playsInline`, `close is idempotent, releases the video and emits nothing`, `reports the close code and reason`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run, type-check, lint** → PASS.
- [ ] **Step 5: Commit** — `feat(admin): add the live view state machine and mse client`

### Task 5: `useLiveView` composable

**Files:**
- Create: `modules/cameras/composables/useLiveView.ts`, `useLiveView.spec.ts`.

**Interfaces:**
- Consumes: Task 4 machine, `MseClient`, codecs; Task 2 `useRelayStatus`, `useCameras`; Task 1 `buildLiveSocketUrl`, `readErrorMessage`, `isModuleDisabledError`, `isDeviceOffline`; the devices store (`get({ id })` when the device is not loaded; `status.lastChanged` for "last seen").
- Produces: `useLiveView(options: { deviceId: MaybeRefOrGetter<string>; profile: MaybeRefOrGetter<string | null>; video: Ref<HTMLVideoElement | null>; autoStart?: boolean }): { state: Readonly<Ref<LiveViewState>>; retryInMs: Readonly<Ref<number | null>>; mime: Readonly<Ref<string | null>>; lastSeen: ComputedRef<Date | null>; start(): void; stop(): void; retry(): void }`.
- Behaviour:
  - `start` → POST `.../cameras/{deviceId}/sessions` with `{ data: { profile?, transport: CamerasModuleCreateSessionTransport.mse } }` (abortable). Every start posts a new session (a token is single use).
  - Failures (P7): 503 → `relayStatus.get()`; state not `running` → `relay_unavailable`, else `camera_unavailable`. 404: `isModuleDisabledError` → `module_disabled`; message `Stream profile is not available` → refetch the camera (`useCameras().get`) and start once more with its first available profile, then `not_found`; other 404 → `not_found`. 403 → `forbidden`. Anything else → `failed`.
  - On success build the socket URL and start an `MseClient`; map its events to machine events; send `playing_stable` after 10 s of `playing`; a 15 s watchdog in `connecting` without `media_started` closes the client and counts as a retryable failure.
  - Retry timers come from `retryInMs`. A profile change while active stops and starts again.
  - Offline: `isDeviceOffline(device)` true → `device_offline`, which also aborts a running POST or client; false after true → `device_online`; null (unknown, or the device not loaded) never sends either. Load the device through the devices store when it is missing.
  - Relay and limits: entering `relay_unavailable`, `camera_limit` or `total_limit` calls `relayStatus.get()` and holds `startPolling()` until the state is left; when the polled relay state becomes `running` while in `relay_unavailable`, send `retry` once.
  - Before posting, `canPlayProfileCodec(profile.videoCodec)` false → `codec_unsupported`; no `MediaSource` constructor → `codec_unsupported`.
  - Unmount: abort the POST, close the client, clear timers, release polling, ignore any later callback. Logs fixed texts only.

- [ ] **Step 1: Write the failing tests** (mock `useBackend`, a fake `MseClient` factory injected via `vi.mock('../live/mse-client')`, fake timers):
  - `reconnect creates a new session` (Review Focus 1: two POSTs for a `max_lifetime` close).
  - `classifies a 503 by the relay status: relay_unavailable when not running, camera_unavailable when running`.
  - `retries once with the first available profile after Stream profile is not available`.
  - `maps a module disabled 404 to module_disabled`.
  - `leaves relay_unavailable when the polled relay becomes running`.
  - `a socket that never delivers media fails after 15 s`.
  - `does not go offline while the device connection status is unknown`.
  - `retries with backoff and stops after five failures` (assert POST count 6 and `retryInMs` null).
  - `unmount during requesting aborts the post and changes no state afterwards` (Review Focus 3).
  - `unmount while playing closes the client and clears the retry timer`.
  - `shows codec_unsupported for an h265 profile the browser cannot play without posting`.
  - `goes offline when the device goes offline and back to snapshot when it returns`.
  - `the session url never reaches the logger` (spy on `logger`; assert no argument contains `session=`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run, type-check, lint** → PASS.
- [ ] **Step 5: Commit** — `feat(admin): add the live view composable`

### Task 6: Camera player component and the device detail camera section

**Files:**
- Create: `modules/cameras/components/{components.ts, camera-player.vue, camera-player.types.ts, camera-player.spec.ts, camera-profiles-table.vue, camera-profiles-table.spec.ts, camera-device-section.vue, camera-device-section.spec.ts}`.
- Modify: `modules/devices/devices.types.ts` (add `IDeviceCategorySection { id: string; categories: DevicesModuleDeviceCategory[]; component: Component; order?: number }` and `IDevicesModuleElementComponents { deviceCategorySection?: IDeviceCategorySection }`), create `modules/devices/composables/useDeviceCategorySections.ts` + spec, modify `modules/devices/views/view-device.vue` (render matching sections, sorted by `order`, inside the Overview `el-scrollbar` above the channel list, with `:device="device"`), `docs/admin-devices-architecture.md` (a "Category sections" paragraph after "Device detail tabs"), `docs/admin-ui-design-spec.md` §7 (a slot row `deviceCategorySection`: the host renders the device page and the order; the section renders its content for the listed categories; it must not render chrome or a save footer).
- Modify: `cameras.module.ts` (add the element `{ type: CAMERAS_MODULE_NAME, modules: [DEVICES_MODULE_NAME], components: { deviceCategorySection: { id: 'camera', categories: [camera, doorbell], component: CameraDeviceSection, order: 0 } } }`).

**Interfaces:**
- Produces: `useDeviceCategorySections(device: MaybeRefOrGetter<IDevice | null>): ComputedRef<IDeviceCategorySection[]>` (reads `modulesManager.getModules<IModule<IDevicesModuleElementComponents>>()` elements whose `modules` include `DEVICES_MODULE_NAME` and whose section lists the device's category).
- Produces `camera-player.vue` props `{ deviceId: string; profile?: string | null; variant: 'tile' | 'large'; autoStart?: boolean; muted?: boolean }`, emits `state-change(LiveViewState)`, exposes `start()`, `stop()`, `retry()`, `video` ref. It shows the snapshot (`useCameraSnapshot`, `refreshMs` 10 s for tiles, `null` while playing) under the video and renders one overlay per state:
  - `snapshot`: age ("3 s ago" when `ageSeconds > 0`) and a play button.
  - `connecting` / `requesting`: dimmed snapshot and `el-icon` spinner.
  - `playing`: a "LIVE" pill.
  - `codec_unsupported`: "This browser cannot play this stream. Try Chrome, Edge or Safari." (exact copy in `camerasModule.states.codecUnsupported`).
  - `offline`: "Camera is offline" plus "Last seen {time}" from `lastSeen`.
  - `relay_unavailable`: "Live view is not available" plus the relay reason sentence when known, a Retry button, and (admins and owners) a link to the module settings.
  - `camera_limit`: "Too many viewers on this camera ({max})" with `max = min(sessions.maxPerCamera, sessions.max)`; `total_limit`: "Too many live views open ({max})" from `sessions.max`; both with a Retry button. Without a status the number is left out.
  - `module_disabled`: "The Cameras module is turned off." plus the settings link (admins and owners).
  - `error`: "Live view failed" plus "Retrying in {n} s" while `retryInMs` is set, else a Retry button.
- `camera-profiles-table.vue` props `{ camera: ICamera }`: columns name (`id`), resolution (`1280 × 720` or "—"), fps, video codec, audio codec, availability; an unavailable row shows the reason sentence (P6).
- `camera-device-section.vue` props `{ device: IDevice }`: loads `useCameras().get({ deviceId })`, a profile selector (`el-select` of available profiles, default the first available), the large player, then the profiles table. A camera with `liveView: false` or no available profile shows the snapshot and the reason, never the play button (Review Focus 4). A module-disabled 404 shows the P8 state; any other 404 shows `empty-state` "This device does not provide a camera stream."

- [ ] **Step 1: Write the failing tests**
  - `useDeviceCategorySections`: `returns sections registered for the device category`, `ignores elements not targeting the devices module`, `sorts by order`.
  - Player (mock `useLiveView` and `useCameraSnapshot`): one test per state asserting its copy key and controls; `shows Retry only after retries stopped`; `the tile variant refreshes the snapshot every 10 s and stops refreshing while playing`.
  - Profiles table: `renders resolution and codecs`, `shows the reason sentence for stream_not_enabled`, `shows the generic sentence for an unknown reason code`.
  - Device section: `lists only available profiles in the selector`, `never offers live view for a camera without an available profile`, `shows the empty state on 404`, `shows the module turned off state on a disabled module 404`.
  - Player: `limit states show the smaller of the two limits and a Retry button`, `hides the settings link for a regular user`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run, type-check, lint** → PASS; open a camera device in `pnpm --filter ./apps/admin start:dev` and check the section renders above the channels.
- [ ] **Step 5: Commit** — `feat(admin): show the camera player on the device detail page`

### Task 7: Cameras grid page and live view dialog

**Files:**
- Modify: `modules/cameras/views/view-cameras.vue`.
- Create: `modules/cameras/components/{cameras-grid.vue, cameras-grid.spec.ts, camera-tile.vue, camera-tile.spec.ts, camera-live-dialog.vue, camera-live-dialog.spec.ts, relay-status-chip.vue, relay-status-chip.spec.ts}`.

**Interfaces:**
- Consumes: Tasks 2, 3, 6 (`camera-player.vue`), the spaces store for room names (`roomId` on the device), the devices store.
- View: `app-breadcrumbs`, phone `app-bar-heading`, `view-header` (icon `mdi:cctv`, heading and sub-heading keys from Task 1), then a filter row with space chips (`el-check-tag` per room that has a camera, plus "All") and the relay chip on the right, then the grid. Empty list → `empty-state` "No cameras yet. Adopt cameras from a camera integration such as UniFi Protect." A module-disabled 404 → the P8 state. Fetches cameras and the devices of those cameras on mount and through the data refresh registry (no event announces a new camera). Holds `relayStatus.startPolling()` while mounted.
- Grid: CSS grid `grid-template-columns: repeat(auto-fill, minmax(320px, 1fr))`, 300 px between 720 and 1279 px; tiles are `camera-player` `variant="tile"` without auto start, name and room below; a click opens the dialog.
- `relay-status-chip.vue` props `{ status: IRelayStatus | null }`: tag type `success` for `running`, `warning` for `starting`, `info` for `disabled`, `danger` for `unavailable` and `error`; text "Live view on" / "Starting" / "Live view off" / "Live view unavailable"; the tooltip is the reason sentence from spec §8 (`camerasModule.relayReasons.<reason>`, the ten texts verbatim), and the chip links to the module settings route.
- `camera-live-dialog.vue` props `{ cameras: ICamera[]; modelValue: string | null }` (`v-model` = open camera id): `el-dialog`, full screen when the viewport is 1024–1279 px wide; contains `camera-player variant="large" auto-start`; toolbar with the profile `el-segmented` (available profiles), Snapshot (fetches a fresh image with `reload({ hq: true })` and downloads it as `<camera name>-<ISO time>.<jpg|png|webp from the blob type>`), Mute toggle (default muted), Full screen (`requestFullscreen` on the player element), and the other-camera switcher (`el-select` of the other cameras). Under the player the transport line `MSE · H.264 · AAC · 1280×720 · 25 fps` built from `describeMime(mime)` and the selected profile; parts that are null are left out. Closing the dialog stops the player.

- [ ] **Step 1: Write the failing tests**
  - Grid: `filters cameras by space chip`, `opens the dialog for the clicked tile`, `shows the empty state without cameras`, `shows the module turned off state`, `releases relay polling on unmount`, `pauses tile refresh while a tile is off screen` (mock `IntersectionObserver`).
  - Relay chip: one case per state; `uses the reason sentence for crashed`.
  - Dialog: `switching profile restarts the player with the new profile`, `switching camera keeps the dialog open on the other camera`, `transport line omits unknown parts`, `closing stops the player`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run, type-check, lint** → PASS; check the page at 390, 744, 1024, 1440 and 1920 px and in dark mode in the dev server.
- [ ] **Step 5: Commit** — `feat(admin): add the cameras grid page and live view dialog`

### Task 8: Cameras module settings and relay status panel

**Files:**
- Create: `modules/cameras/schemas/{config.schemas.ts, config.schemas.spec.ts}`, `components/{cameras-config-form.vue, cameras-config-form.spec.ts, relay-status-panel.vue, relay-status-panel.spec.ts}`.
- Modify: `cameras.module.ts` (element `{ type: CONFIG_MODULE_MODULE_TYPE, components: { moduleConfigEditForm: CamerasConfigForm }, schemas: { moduleConfigSchema, moduleConfigEditFormSchema, moduleConfigUpdateReqSchema }, modules: [CONFIG_MODULE_NAME] }`, template `notifications.module.ts:52-67`).
- Modify: `docs/cameras-architecture.md` (an "Admin" section: screens, live view states and close-code mapping, polling, the category section), `tasks/epics/EPIC-UNIFI-PROTECT.md` (rename the row to `UP-11 (done)` as the earlier rows are).

**Interfaces:**
- Form fields (spec §8): relay mode radio Managed / External / Disabled (`go2rtc.mode`); binary path (managed only, `go2rtc.binary_path`); external URL (external only, `go2rtc.external_url`, `inputmode="url"`, no autocorrect); `max_sessions` 1–32 (default 8); `max_sessions_per_camera` 1–16 (default 4). Validation mirrors the backend (`dto/update-config.dto.ts`, `cameras.config.utils.ts`): binary path absolute, no NUL, not ending in `/`, file name matching `^go2rtc[A-Za-z0-9._-]*$`; external URL as `isValidGo2rtcExternalUrl` accepts it (an `http:` or `https:` URL without credentials, query or fragment; copy its rule).
- `relay-status-panel.vue` props `{ status: IRelayStatus | null }` shows only `mode`, `state`, the reason sentence, `version`, `active` / `max` and `max_per_camera` (spec §8: nothing else). The form holds `startPolling()` while mounted.

- [ ] **Step 1: Write the failing tests**
  - Schemas: `rejects max_sessions 33 and max_sessions_per_camera 0`, `rejects a relative binary path and one whose file name does not start with go2rtc`, `requires an external url in external mode`.
  - Form: `hides the binary path outside managed mode`, `sends the update request with snake_case keys`.
  - Panel: `shows the banner text for each reason`, `shows nothing but the allowed fields` (snapshot the rendered labels).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run the whole admin suite** (`pnpm --filter ./apps/admin run test:unit`), type-check, lint → PASS.
- [ ] **Step 5: Commit** — `feat(admin): add the cameras module settings and relay status panel`

---

## Self-review notes

- Spec §8 screens covered: grid (Task 7), live view dialog (Task 7), device detail section (Task 6), module settings (Task 8). Protect settings and the adoption wizard are UP-12; "Elsewhere" rows (notifications, automations, overview, onboarding) are outside #1187.
- Issue #1187 acceptance criteria: stores (Task 2), `CameraLiveView` with session, MSE, reconnect, codec / offline / relay states and snapshot fallback with the Bearer header (Tasks 3–6), device detail and grid (Tasks 6–7), remote access (Task 1 helper, Review Focus 5), six locales and Vitest tests for the state machine and stores (Tasks 1, 2, 4).
- An independent plan review (C1, I1–I6, M1–M14) is folded in: P7, P8, the machine's ignore rule and idle states, the MSE client details, the offline tri-state, limit and relay recovery, and the spec §7 slot row.
- The amended criterion "vendored go2rtc player or an own client — decided in the PR" is decided here (P1).
