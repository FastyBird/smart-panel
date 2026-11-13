# Cameras — Plan 3a: go2rtc Relay and Live WebSocket (UP-3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The cameras module runs go2rtc as a managed service on loopback (or uses an external go2rtc), registers
upstream streams only while someone watches, and serves an authenticated live WebSocket that proxies go2rtc's MSE
stream to browsers.

**Architecture:** `Go2rtcProcessService` spawns and supervises the binary; `Go2rtcService` (a
`BaseManagedExtensionService`) owns the relay state machine for the three modes and never throws for environmental
problems, so a missing binary means "unavailable", not a crash loop or a notification. `Go2rtcStreamsService`
reference-counts go2rtc streams per camera profile. `LiveStreamGateway` takes the raw HTTP `upgrade`, admits a session
synchronously from memory (socket.io kills unanswered upgrades after 1 s), and hands each socket to a
`LiveStreamConnection` that pipes client and go2rtc frames with backpressure, limits and revocation.

**Tech Stack:** NestJS 11 on Fastify, `ws` 8.21 (already a dependency), `yaml` 2 (already a dependency), Node 24
`fetch`, `child_process.spawn`, Jest, supertest. No new dependency. No migration (all settings live in the config
file).

**Spec:** `docs/superpowers/specs/2026-10-06-unifi-protect-integration-design.md` §7.2, §9.4, §13.1, §16. Issue #1179.
Roadmap: `docs/superpowers/plans/2026-11-12-cameras-roadmap.md` on `origin/docs/camera-epic-plans` (§1 A2, A3; §4;
§5 Plan 3 steps 1–8; §6). Builds on PR #1612 (`feat/cameras-module`); read `docs/cameras-architecture.md` first.

## Global Constraints

- Branch `feat/cameras-relay`, cut from `feat/cameras-module` until #1612 merges, then rebased on `main`. One PR
  titled `feat(backend): relay camera live streams through a managed go2rtc service`, body `Closes #1179`. While #1612
  is open the PR targets `feat/cameras-module`.
- Commits `<type>(backend): <lowercase imperative subject>` (`docs(docs): …` for `docs/`), ending with
  `Co-Authored-By: <model that wrote it> <noreply@anthropic.com>`.
- TypeScript: tabs, single quotes, semicolons, trailing commas, print width 120; imports external, then `../`, then
  `./`, blank line between groups. Wire names snake_case.
- Managed service identity: `owner = { kind: 'module', type: CAMERAS_MODULE_NAME }` (= `'cameras-module'`, not
  `'cameras'`: the manager reads `getModuleConfig(owner.type)`), `serviceId = 'go2rtc'`,
  `activationPolicy = 'owner-enabled'`.
- Install location shared with UP-4: directory `GO2RTC_INSTALL_DIR = '/usr/local/lib/smart-panel/go2rtc'`, binary
  `GO2RTC_DEFAULT_BINARY_PATH = '/usr/local/lib/smart-panel/go2rtc/go2rtc'`, both string literals exported from
  `apps/backend/src/modules/cameras/cameras.constants.ts`. UP-4 reads them from there.
- Defaults: `go2rtc.mode = 'managed'`; `max_sessions = 8` (1–32); `max_sessions_per_camera = 4` (1–16; the effective
  per-camera limit is `min(max_sessions_per_camera, max_sessions)`); stream idle grace `30_000` ms; live socket
  maximum lifetime `4 * 60 * 60 * 1000` ms; heartbeat `30_000` ms; restart backoff `[1000, 2000, 4000, 8000, 16000]`
  ms (5 attempts, then `error`); stable run that resets the attempt counter `60_000` ms; readiness timeout `10_000` ms,
  poll `250` ms; HTTP timeout to go2rtc `5_000` ms; external re-probe `30_000` ms; stop grace `5_000` ms, SIGKILL
  confirmation `2_000` ms; output ring `64` lines.
- go2rtc listens on `127.0.0.1` only: API `127.0.0.1:11984`, RTSP `127.0.0.1:18554` (env overrides
  `FB_GO2RTC_API_PORT`, `FB_GO2RTC_RTSP_PORT`); WebRTC and SRTP listeners empty (disabled). Non-default ports so a
  Frigate/Home Assistant go2rtc on 1984/8554 on the same host does not collide. The API and RTSP server require basic
  auth with user `smart-panel` and a fresh random password per spawn (`randomBytes(24).toString('base64url')`),
  `local_auth: true`.
- Config file `<FB_CONFIG_PATH>/go2rtc/go2rtc.yaml` (directory `0o700`, file `0o600`), regenerated on every spawn;
  it never contains a stream. `FB_CONFIG_PATH` default as in `modules/config/services/config.service.ts:80-86`.
- Secret rule: a provider source URL, its alias path, the go2rtc API password and a session token never reach a log
  line, the output ring, a response body, a close reason, an event payload or an error message. Log lines carry ids,
  stream names, fixed reason codes and `errorName(error)` only. Every task that handles one of them carries a
  sentinel test using `FAKE_CAMERA_SECRET_URL` (`test/support/fake-camera-stream.provider.ts`).
- No new event-bus events: every `EventEmitter2` event is broadcast to socket.io clients unless its prefix is listed
  as internal (`modules/websocket/gateway/websocket.gateway.ts:386-396`, `472-494`). Relay state reaches the gateway
  through `Go2rtcService.subscribe`, not the bus.
- go2rtc API facts this plan relies on (encode them in the stub; re-check against the version UP-0 pins):
  `go2rtc -config <path>`; `GET /api` → JSON with `version` and `pid`; `PUT /api/streams?name=<n>&src=<url>`;
  `DELETE /api/streams?src=<n>` (the name goes in `src`); `GET /api/streams` → object keyed by stream name;
  WebSocket `/api/ws?src=<n>`, client sends `{"type":"mse","value":"<codecs>"}`, server answers a text
  `{"type":"mse","value":"video/mp4; codecs=…"}` then binary fMP4; `rtspx://` is RTSPS without certificate check.
- Never edit generated code; run `pnpm run generate:openapi`. Commit only `apps/admin/src/openapi.constants.ts` of
  the generated surface (roadmap A11).

## Review Focus

1. **A viewer who reloads the admin page over and over** (open, close, open within seconds): the stream stays
   registered through the grace period; twenty cycles cause one `PUT` and no `DELETE`; the reference count never goes
   negative. → Task 5.
2. **A browser that vanishes without a close frame** (laptop lid, Wi-Fi drop): the heartbeat terminates the socket
   within two intervals, its lease is released and its per-camera slot admits the next viewer. → Tasks 6 and 7.
3. **go2rtc killed from outside mid-stream** (OOM killer, `kill -9`): open sockets close `1013 relay_unavailable`,
   the relay restarts with a new generation, the stream table is dropped, and the next session `PUT`s again instead
   of trusting a stream the new process does not have. → Tasks 4, 5 and 7.
4. **The API port already taken by another HTTP service that answers `GET /api`**: readiness must not report
   `running` against the foreign process; a `pid` that is not the child's means `error` with reason `port_in_use`. →
   Task 4.
5. **A hand-edited config with `mode: external` and no URL** (bypassing the API's check): the module stays usable,
   snapshots answer 200, status reports `unavailable` / `external_url_missing`, and the enabled guard does not turn
   every route into 503. → Tasks 1 and 4.

## Decisions made in this plan (deviations from the roadmap outline)

- **Registration at socket admission, not at session creation** (design §13.1 step 2 registers at session creation).
  `POST sessions` only checks that the relay runs; the stream is acquired when the socket is admitted, so a session
  that is never opened holds no go2rtc stream and no reference.
- **`HttpAdapterHost` instead of `AppInstanceHolder`** for the HTTP server (A3 assumed the latter).
- **Cross-field rule in a module config mutation handler**, not on the model (roadmap step 1 put it on the config).
- **Plugin disable closes sockets by re-validating** each open socket's camera on every plugin config change; the
  registry has no "unregistered" signal and a disabled provider throws `CameraOfflineException`.
- **Basic auth on the loopback API and RTSP server**, so another local user cannot add an `exec:` stream; plus a source
  scheme allow-list before any `PUT`.
- **Relay state never goes on the event bus** (it would be broadcast to every socket.io client).
- **Close codes** 1001/1003/1008/1011/1013 and 4000–4002 (table in Task 6) so the admin state machine (UP-11) can map
  them; invalid tokens are refused at HTTP level (401) before any upgrade.
- Out of scope: `webrtc.enabled` / `webrtc.candidates` (design §7.2, opt-in later), HLS/MP4 for the panel (UP-15).

---

## File map

| File | Responsibility | Task |
|---|---|---|
| `cameras.constants.ts` (modify) | install path, ports, relay timings, defaults, `CAMERAS_LIVE_PATH` | 1 |
| `cameras.config.utils.ts` (create) | pure `isValidGo2rtcBinaryPath`, `isValidGo2rtcExternalUrl`, `normalizeGo2rtcExternalUrl` | 1 |
| `models/config.model.ts`, `dto/update-config.dto.ts` (modify) | nested `go2rtc`, `max_sessions`, `max_sessions_per_camera` | 1 |
| `services/cameras-config-mutation.service.ts` (create) | cross-field check on the merged update | 1 |
| `services/go2rtc-config.ts`, `services/go2rtc-source.ts` (create) | pure YAML builder; source → go2rtc `src`, stream name | 2 |
| `services/go2rtc-redaction.ts`, `services/go2rtc-secrets.registry.ts`, `services/go2rtc-process.service.ts` (create) | redaction, in-memory secret literals, child process | 3 |
| `services/go2rtc-api.client.ts`, `services/go2rtc.service.ts` (create) | REST client; managed service and relay state | 4 |
| `services/go2rtc-streams.service.ts` (create), `services/cameras.service.ts` (modify) | stream reference counting; `resolveSource` with timeout | 5 |
| `gateway/live-stream.constants.ts`, `gateway/live-stream-connection.ts` (create) | close codes; one proxied connection | 6 |
| `gateway/live-stream.gateway.ts` (create) | upgrade, admission, limits, revocation | 7 |
| `controllers/cameras-status.controller.ts`, `controllers/camera-owner.utils.ts`, `models/status.model.ts` (create) | `GET status`; shared owner check | 8 |
| `test/support/stub-go2rtc.server.ts`, `test/cameras-live.e2e-spec.ts` (create), `docs/cameras-architecture.md` | e2e and docs | 9 |

All `src` paths are under `apps/backend/src/modules/cameras/` unless they start with `apps/` or `test/` (=
`apps/backend/test/`).

---

### Task 1: Relay configuration

**Files:**
- Modify: `cameras.constants.ts`, `models/config.model.ts`, `dto/update-config.dto.ts`, `cameras.openapi.ts`,
  `cameras.module.ts` (register the mutation handler; constructor appends `ModuleConfigMutationRegistryService`,
  `CamerasConfigMutationService`)
- Create: `cameras.config.utils.ts`, `services/cameras-config-mutation.service.ts`
- Test: `cameras.config.utils.spec.ts`, `dto/update-config.dto.spec.ts` (extend), `models/config.model.spec.ts`,
  `services/cameras-config-mutation.service.spec.ts`, `cameras.module.spec.ts` (extend)

Pattern: nested models `plugins/devices-wled/models/config.model.ts:119-164` and
`plugins/devices-wled/dto/update-config.dto.ts:16-47, 140-165` (camelCase property, `@Expose({ name: 'snake' })`,
`@Transform(null → undefined)`, `@ValidateNested`, `@Type`). Cross-field check through
`ModuleConfigMutationRegistryService` (`modules/config/services/module-config-mutation-registry.service.ts:14-42`),
as MCP does (`modules/mcp/mcp.module.ts:226-227`, `modules/mcp/services/mcp-oauth-module-config-mutation.service.ts:53-74`).
Why not on the model: `ConfigService.setModuleConfig` validates only the DTO (`config.service.ts:612-628`), and a
model rule that fails on a hand-edited file makes `getModuleConfig` throw `ConfigCorruptedException`
(`config.service.ts:566-581`), which `CamerasModuleEnabledGuard` turns into 503 on every route.

**Interfaces:**
- Produces (constants, exact values in Global Constraints): `GO2RTC_INSTALL_DIR`, `GO2RTC_DEFAULT_BINARY_PATH`,
  `GO2RTC_DEFAULT_API_PORT = 11984`, `GO2RTC_DEFAULT_RTSP_PORT = 18554`, `GO2RTC_API_USERNAME = 'smart-panel'`,
  `GO2RTC_CONFIG_DIRNAME = 'go2rtc'`, `GO2RTC_CONFIG_FILENAME = 'go2rtc.yaml'`, `GO2RTC_STOP_GRACE_MS`,
  `GO2RTC_STOP_KILL_TIMEOUT_MS`, `GO2RTC_OUTPUT_RING_SIZE`, `GO2RTC_READY_TIMEOUT_MS`, `GO2RTC_READY_POLL_MS`,
  `GO2RTC_RESTART_BACKOFF_MS`, `GO2RTC_STABLE_RUN_MS`, `GO2RTC_PROBE_INTERVAL_MS = 30_000`,
  `GO2RTC_HTTP_TIMEOUT_MS`, `GO2RTC_STREAM_IDLE_GRACE_MS`, `GO2RTC_STREAM_NAME_PREFIX = 'smart-panel_'`,
  `CAMERAS_DEFAULT_MAX_SESSIONS = 8`, `CAMERAS_DEFAULT_MAX_SESSIONS_PER_CAMERA = 4`,
  `CAMERAS_LIVE_PATH = '/api/v1/modules/cameras/live'`; `export type Go2rtcMode = 'managed' | 'external' | 'disabled'`.

```ts
// cameras.config.utils.ts
export function isValidGo2rtcBinaryPath(value: unknown): value is string;
// absolute, ≤ 4096 chars, no NUL, basename matches /^go2rtc[A-Za-z0-9._-]*$/
export function isValidGo2rtcExternalUrl(value: unknown): value is string;
// http: or https:, has a host, no userinfo, no query, no fragment, ≤ 2048 chars
export function normalizeGo2rtcExternalUrl(value: string): string; // strips trailing slashes

// models/config.model.ts
@ApiSchema({ name: 'CamerasModuleDataGo2rtcConfig' })
export class CamerasGo2rtcConfigModel { mode: Go2rtcMode = 'managed'; binaryPath: string = GO2RTC_DEFAULT_BINARY_PATH; externalUrl: string | null = null }
// CamerasConfigModel gains: go2rtc = new CamerasGo2rtcConfigModel(); maxSessions = 8; maxSessionsPerCamera = 4

// dto/update-config.dto.ts
@ApiSchema({ name: 'CamerasModuleUpdateConfigGo2rtc' })
export class UpdateCamerasGo2rtcConfigDto { mode?: Go2rtcMode; binaryPath?: string; externalUrl?: string | null }
// UpdateCamerasConfigDto gains: go2rtc?: UpdateCamerasGo2rtcConfigDto; maxSessions?: number; maxSessionsPerCamera?: number

// services/cameras-config-mutation.service.ts
@Injectable()
export class CamerasConfigMutationService {
	constructor(configService: ConfigService); // reads the stored CamerasConfigModel
	update(update: UpdateCamerasConfigDto, commit: ModuleConfigCommit): Promise<void>; // BadRequestException before commit
}
```

The model keeps type and range validators only (`IsIn`, `IsString`, `IsOptional`, `IsInt`, `Min`, `Max`); the
path and URL rules live in the DTO (custom `@ValidatorConstraint`s calling the utils) and are re-checked by
`Go2rtcService` at start. DTO error messages follow the `[{"field":"…","reason":"…"}]` form of
`dto/update-config.dto.ts:17`.

- [ ] **Step 1: Write the failing tests.**

```ts
// cameras.config.utils.spec.ts
it('keeps the install path and the default binary in step', () =>
	expect(path.join(GO2RTC_INSTALL_DIR, 'go2rtc')).toBe(GO2RTC_DEFAULT_BINARY_PATH));
it.each(['/usr/local/lib/smart-panel/go2rtc/go2rtc', '/opt/go2rtc_linux_arm64'])('accepts the binary %s', (p) =>
	expect(isValidGo2rtcBinaryPath(p)).toBe(true));
it.each(['go2rtc', './go2rtc', '/bin/sh', '/usr/bin/go2rtc\0x', `/${'a'.repeat(4100)}/go2rtc`, 42])('refuses the binary %#', (p) =>
	expect(isValidGo2rtcBinaryPath(p)).toBe(false));
it.each(['http://192.168.1.5:1984', 'https://frigate.local:1984/'])('accepts the external url %s', (u) =>
	expect(isValidGo2rtcExternalUrl(u)).toBe(true));
it.each(['ftp://h', 'http://user:pw@h:1984', 'http://h:1984/?x=1', 'http://h:1984/#a', 'rtsp://h', 'h:1984', ''])('refuses the external url %s', (u) =>
	expect(isValidGo2rtcExternalUrl(u)).toBe(false));
it('normalizes trailing slashes', () => expect(normalizeGo2rtcExternalUrl('http://h:1984//')).toBe('http://h:1984'));

// models/config.model.spec.ts
it('defaults to a managed relay at the install path with 8 / 4 sessions', () => {
	const config = toInstance(CamerasConfigModel, { type: CAMERAS_MODULE_NAME });
	expect(config.go2rtc).toEqual(expect.objectContaining({ mode: 'managed', binaryPath: GO2RTC_DEFAULT_BINARY_PATH, externalUrl: null }));
	expect([config.maxSessions, config.maxSessionsPerCamera]).toEqual([8, 4]);
	expect(instanceToPlain(config)).toMatchObject({ go2rtc: { binary_path: GO2RTC_DEFAULT_BINARY_PATH, external_url: null }, max_sessions: 8, max_sessions_per_camera: 4 });
});
it('loads a hand-edited external config without a url', () => { // Review Focus 5
	const config = toInstance(CamerasConfigModel, { type: CAMERAS_MODULE_NAME, go2rtc: { mode: 'external' } });
	expect(validateSync(config)).toHaveLength(0);
});

// dto/update-config.dto.spec.ts (extend)
it.each([
	[{ go2rtc: { mode: 'bogus' } }, 'mode'],
	[{ go2rtc: { binary_path: '/bin/sh' } }, 'binary_path'],
	[{ go2rtc: { external_url: 'http://u:p@h' } }, 'external_url'],
	[{ max_sessions: 0 }, 'max_sessions'],
	[{ max_sessions: 33 }, 'max_sessions'],
	[{ max_sessions_per_camera: 17 }, 'max_sessions_per_camera'],
])('rejects %j', async (data, field) => {
	const errors = await validate(plainToInstance(UpdateCamerasConfigDto, { type: CAMERAS_MODULE_NAME, ...data }));
	expect(JSON.stringify(errors)).toContain(field);
});
it('keeps stored go2rtc fields that a nested update omits', () => {
	// stored { go2rtc: { mode: 'external', external_url: 'http://h:1984', binary_path: '/opt/go2rtc' } } + update { go2rtc: { mode: 'managed' } }
	// merged through ConfigSecretsService().merge exactly as the existing test at lines 23-38 does
	expect(merged.go2rtc).toEqual(expect.objectContaining({ mode: 'managed', externalUrl: 'http://h:1984', binaryPath: '/opt/go2rtc' }));
});

// services/cameras-config-mutation.service.spec.ts — configService.getModuleConfig returns `current`
it('rejects switching to external mode without a stored or submitted url', async () => {
	await expect(service.update(dto({ go2rtc: { mode: 'external' } }), commit)).rejects.toBeInstanceOf(BadRequestException);
	expect(commit).not.toHaveBeenCalled();
});
it('rejects clearing the url while external mode stays on', async () => { /* current external + url; update external_url: null → 400 */ });
it('accepts external mode when the stored config already has a url', async () => { /* commit called once */ });
it('accepts any update that leaves external mode off', async () => { /* { max_sessions: 2 } → commit */ });

// cameras.module.spec.ts (extend)
expect(mutations.register).toHaveBeenCalledWith(CAMERAS_MODULE_NAME, expect.any(Function));
```

  The `BadRequestException` message is `go2rtc external mode requires external_url`.

- [ ] **Step 2: Run them.** Run (from `apps/backend`): `npx jest src/modules/cameras` Expected: FAIL (missing exports).

- [ ] **Step 3: Implement** constants, utils, nested model and DTO, the mutation service and its registration in
  `onModuleInit` (`this.moduleConfigMutations.register<UpdateCamerasConfigDto>(CAMERAS_MODULE_NAME, (u, c) =>
  this.configMutation.update(u, c))`). Add the two nested classes to `CAMERAS_SWAGGER_EXTRA_MODELS`. Switch the
  session URL in `controllers/cameras.controller.ts:268` to `` `${CAMERAS_LIVE_PATH}?session=${token}` ``.

- [ ] **Step 4: Run them.** `npx jest src/modules/cameras` Expected: PASS (existing tests included).

- [ ] **Step 5: Commit.**

```bash
git add apps/backend/src/modules/cameras
git commit -m "feat(backend): add go2rtc relay settings to the cameras module config"
```

---

### Task 2: go2rtc configuration and source mapping

**Files:**
- Create: `services/go2rtc-config.ts`, `services/go2rtc-source.ts`
- Test: `services/go2rtc-config.spec.ts`, `services/go2rtc-source.spec.ts`

**Interfaces:**
- Consumes: constants of Task 1; `CameraStreamSource` (`platforms/camera-stream.provider.ts:15-18`);
  `CameraUpstreamException`, `CameraProfileUnavailableException` (`cameras.exceptions.ts`).
- Produces:

```ts
export interface Go2rtcRuntimeConfig { apiPort: number; rtspPort: number; username: string; password: string }
export function buildGo2rtcConfig(options: Go2rtcRuntimeConfig): string; // YAML via `stringify` from 'yaml'

export function toGo2rtcSource(source: CameraStreamSource): string; // throws CameraUpstreamException('Unsupported stream source')
export function go2rtcStreamName(deviceId: string, profileId: string): string; // `smart-panel_${deviceId}_${profileId}`
// throws CameraProfileUnavailableException when profileId does not match /^[A-Za-z0-9_-]{1,64}$/
```

Generated document (key order fixed):

```yaml
api:
  listen: 127.0.0.1:<apiPort>
  username: <username>
  password: <password>
  local_auth: true
rtsp:
  listen: 127.0.0.1:<rtspPort>
  username: <username>
  password: <password>
webrtc:
  listen: ""
srtp:
  listen: ""
log:
  level: info
  format: text
```

Source rules (`toGo2rtcSource`); any other input throws, and the error message never contains the URL:

| `transport` | accepted URL schemes | result |
|---|---|---|
| `rtsp` | `rtsp:`, `rtsps:` | unchanged |
| `rtsps-insecure` | `rtsps:`, `rtspx:` | scheme replaced by `rtspx:` |
| `http` | `http:`, `https:` | unchanged |

A URL that `new URL()` cannot parse, that contains whitespace or a control character, or that has a fragment is
refused. This keeps `exec:`, `ffmpeg:` and any go2rtc source syntax that runs a command away from the API.

- [ ] **Step 1: Write the failing tests.**

```ts
const options = { apiPort: 11984, rtspPort: 18554, username: 'smart-panel', password: 'PW_SENTINEL_abc' };

it('generates the loopback-only document', () => expect(buildGo2rtcConfig(options)).toMatchSnapshot());
it('binds every listener to loopback or disables it', () => {
	const doc = parse(buildGo2rtcConfig(options));
	const listens = [doc.api.listen, doc.rtsp.listen, doc.webrtc.listen, doc.srtp.listen];
	expect(listens.every((l: string) => l === '' || l.startsWith('127.0.0.1:'))).toBe(true);
	expect(buildGo2rtcConfig(options)).not.toMatch(/0\.0\.0\.0|:1984\b|:8554\b|:8555\b|streams:/);
	expect(doc.api.local_auth).toBe(true);
});
it.each(['', 'has space', 'quote"', 'line\nbreak'])('refuses an unsafe password %#', (password) =>
	expect(() => buildGo2rtcConfig({ ...options, password })).toThrow());

it.each([
	[{ url: 'rtsp://cam/stream', transport: 'rtsp' }, 'rtsp://cam/stream'],
	[{ url: 'rtsps://c:7441/ALIAS?enableSrtp', transport: 'rtsps-insecure' }, 'rtspx://c:7441/ALIAS?enableSrtp'],
	[{ url: 'rtspx://c:7441/ALIAS', transport: 'rtsps-insecure' }, 'rtspx://c:7441/ALIAS'],
	[{ url: 'https://cam/video.mjpeg', transport: 'http' }, 'https://cam/video.mjpeg'],
] as const)('maps %j', (source, expected) => expect(toGo2rtcSource(source)).toBe(expected));
it.each([
	{ url: 'exec:ffmpeg -i x', transport: 'rtsp' },
	{ url: 'ffmpeg:rtsp://cam/x', transport: 'rtsp' },
	{ url: 'http://cam/x', transport: 'rtsp' },
	{ url: 'rtsp://cam/x\nexec:id', transport: 'rtsp' },
	{ url: 'rtsp://cam/x#frag', transport: 'rtsp' },
	{ url: 'not a url', transport: 'http' },
	{ url: 'rtsp://cam/x', transport: 'webrtc' },
])('refuses %j without echoing it', (source) => {
	expect(() => toGo2rtcSource(source as never)).toThrow(CameraUpstreamException);
	try { toGo2rtcSource(source as never); } catch (e) { expect((e as Error).message).toBe('Unsupported stream source'); }
});
it('names streams by device and profile', () => expect(go2rtcStreamName('c1', 'medium')).toBe('smart-panel_c1_medium'));
it.each(['', 'has space', 'a/b', 'x'.repeat(65)])('refuses the profile id %#', (p) =>
	expect(() => go2rtcStreamName('c1', p)).toThrow(CameraProfileUnavailableException));
```

- [ ] **Step 2: Run them.** `npx jest src/modules/cameras/services/go2rtc-config.spec.ts src/modules/cameras/services/go2rtc-source.spec.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement both files.** The password must match `/^[A-Za-z0-9_-]{16,128}$/`; the username
  `/^[a-z0-9-]{1,32}$/`.

- [ ] **Step 4: Run them.** Expected: PASS; review the written snapshot against the document above.

- [ ] **Step 5: Commit.**

```bash
git add apps/backend/src/modules/cameras/services
git commit -m "feat(backend): generate the go2rtc config and map camera sources"
```

---

### Task 3: go2rtc process supervision with redacted output

**Files:**
- Create: `services/go2rtc-redaction.ts`, `services/go2rtc-secrets.registry.ts`, `services/go2rtc-process.service.ts`
- Create: `apps/backend/test/support/stub-go2rtc.script.ts` —
  `writeStubGo2rtcScript(dir: string, mode: 'run' | 'crash' | 'ignore-sigterm' | 'flood' | 'serve'): string` writes
  an executable `node` script named `go2rtc` and returns its path (reused by Tasks 4 and 8)
- Test: `services/go2rtc-redaction.spec.ts`, `services/go2rtc-process.service.spec.ts`

Copy the structure of `plugins/remote-access-cloudflare-tunnel/services/cloudflared-process.service.ts`: idempotent
`start` (lines 91-165, per-child state object with identity, carry buffer, listener cleanup on `close`), `stop` with
SIGTERM → SIGKILL → bounded rejection (lines 171-230), ring and redaction (lines 246-273). Differences: both stdout
and stderr feed the ring; the exit is reported through a per-start callback instead of being polled; a spawn error
records only `error.code`. Test technique: a real `node` stub script written to a temp directory, as in
`cloudflared-process.service.spec.ts:1-40`, no `child_process` mock.

**Interfaces:**
- Produces:

```ts
// go2rtc-redaction.ts
export function redactGo2rtcOutput(line: string, secrets: readonly string[]): string;
// 1. every non-empty literal in `secrets`, longest first → '<redacted>'
// 2. /\b(rtsps?|rtspx|https?|wss?):\/\/[^\s"'<>]*/gi → '$1://<redacted>'
// 3. truncated to 1024 characters

// go2rtc-secrets.registry.ts — memory only, shared by process, streams and service
@Injectable()
export class Go2rtcSecretsRegistry {
	add(secret: string): () => void; // returns the removal handle; ignores strings shorter than 8 characters
	list(): readonly string[];
}

// go2rtc-process.service.ts
export interface Go2rtcProcessOptions { binaryPath: string; configPath: string; cwd: string }
export interface Go2rtcExitInfo { code: number | null; signal: NodeJS.Signals | null; spawnErrorCode: string | null }
@Injectable()
export class Go2rtcProcessService {
	constructor(secrets: Go2rtcSecretsRegistry);
	start(options: Go2rtcProcessOptions, onExit: (exit: Go2rtcExitInfo) => void): void; // no-op while running; never throws
	stop(graceMs?: number): Promise<void>; // default GO2RTC_STOP_GRACE_MS; onExit of a stopped child is not called
	isRunning(): boolean;
	getPid(): number | null;
	getOutputLines(): readonly string[]; // redacted, oldest first, at most GO2RTC_OUTPUT_RING_SIZE
}
```

Spawn: `spawn(binaryPath, ['-config', configPath], { cwd, env: { PATH, HOME }, stdio: ['ignore', 'pipe', 'pipe'] })`,
never a shell. The log line on spawn is `Spawning go2rtc pid=<pid>`; it does not print the path or arguments.

- [ ] **Step 1: Write the failing redaction test.**

```ts
it('redacts every url scheme go2rtc may print', () => {
	expect(redactGo2rtcOutput('dial rtsps://console:7441/SENTINELALIAS0123456789?enableSrtp failed', [])).toBe('dial rtsps://<redacted> failed');
	expect(redactGo2rtcOutput('src=rtspx://c:7441/A ws=ws://127.0.0.1:11984/api/ws?src=x', [])).toBe('src=rtspx://<redacted> ws=ws://<redacted>');
});
it('redacts registered literals even without a scheme', () =>
	expect(redactGo2rtcOutput('path=/SENTINELALIAS0123456789 pw=PW_SENTINEL_abc', ['/SENTINELALIAS0123456789', 'PW_SENTINEL_abc'])).toBe('path=<redacted> pw=<redacted>'));
it('truncates long lines', () => expect(redactGo2rtcOutput('x'.repeat(5000), [])).toHaveLength(1024));
```

- [ ] **Step 2: Write the stub script helper and the failing process test.** Every mode prints its argv, the names
  of its environment variables, `rtsps://console:7441/SENTINELALIAS0123456789` and `PW_SENTINEL_abc` on start;
  `crash` exits 3; `ignore-sigterm` traps SIGTERM; `flood` prints `line 0`..`line 99` alternating stdout and stderr;
  `serve` is added in Task 4.

```ts
it('passes -config and a minimal environment', async () => {
	process.env.FB_TEST_LEAK = 'x';
	const lines = await startAndCollect('run');
	expect(lines.join('\n')).toContain(`argv=-config ${configPath}`);
	expect(lines.join('\n')).not.toContain('FB_TEST_LEAK');
});
it('keeps only the last 64 lines of stdout and stderr', async () => { /* flood prints 'line 0'..'line 99' alternating streams → length 64, last 'line 99' */ });
it('redacts source urls and registered secrets from the ring', async () => {
	secrets.add('PW_SENTINEL_abc');
	const joined = (await startAndCollect('run')).join('\n');
	expect(joined).not.toContain('SENTINELALIAS');
	expect(joined).not.toContain('PW_SENTINEL_abc');
	expect(joined).toContain('rtsps://<redacted>');
});
it('reports a crash through onExit', async () => expect(await exitOf('crash')).toEqual({ code: 3, signal: null, spawnErrorCode: null }));
it('reports a missing binary as ENOENT without throwing', async () =>
	expect(await exitOf('run', '/nonexistent/go2rtc')).toMatchObject({ code: null, spawnErrorCode: 'ENOENT' }));
it('stops with SIGTERM and does not call onExit for a stopped child', async () => { /* stop() resolves, isRunning false, onExit not called */ });
it('escalates to SIGKILL when SIGTERM is ignored', async () => { /* mode ignore-sigterm, stop(200) resolves, child gone */ });
it('is idempotent while running', () => { /* second start does not spawn; getPid unchanged */ });
```

- [ ] **Step 3: Run them.** `npx jest src/modules/cameras/services/go2rtc-redaction.spec.ts src/modules/cameras/services/go2rtc-process.service.spec.ts`
  Expected: FAIL.

- [ ] **Step 4: Implement the three files.** The ring applies `redactGo2rtcOutput(line, secrets.list())` before a
  line is stored; `onExit` fires once per child, from `close` (or from `error` when `child.pid` is undefined).

- [ ] **Step 5: Run them.** Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add apps/backend/src/modules/cameras/services apps/backend/test/support/stub-go2rtc.script.ts
git commit -m "feat(backend): supervise the go2rtc process with redacted output"
```

---

### Task 4: Managed go2rtc service and relay state

**Files:**
- Create: `services/go2rtc-api.client.ts`, `services/go2rtc.service.ts`
- Modify: `cameras.exceptions.ts` (add `Go2rtcUnavailableException extends CamerasException`, `Go2rtcApiError extends
  Error`, both in `errorName`), `cameras.module.ts` (providers, exports, `this.managedServiceManager.register(this.go2rtcService)`
  in `onModuleInit`; constructor appends `ManagedServiceManagerService`, `Go2rtcService`)
- Modify: `apps/backend/src/modules/extensions/services/managed-service-registration.inventory.spec.ts:5-70`
- Test: `services/go2rtc-api.client.spec.ts`, `services/go2rtc.service.spec.ts`, `cameras.module.spec.ts` (extend)

Patterns: `BaseManagedExtensionService` (`modules/extensions/services/base-managed-extension.service.ts:6-36`,
`withLock`); a start that never throws for unmet requirements and self-heals
(`plugins/remote-access-cloudflare-tunnel/services/cloudflare-tunnel-managed.service.ts:154-198`), because the
manager raises an error notification on every rejected `start()`
(`modules/extensions/services/managed-service-manager.service.ts:789-810`) and calls `onConfigChanged` while started
(`:961-978`); module registration `modules/weather/weather.module.ts:62-77` with `weather.service.ts:46-47`.

**Interfaces:**
- Consumes: Task 1 config and utils; Task 2 `buildGo2rtcConfig`; Task 3 `Go2rtcProcessService`, `Go2rtcSecretsRegistry`.
- Produces:

```ts
// go2rtc-api.client.ts — plain class, one per endpoint
export interface Go2rtcEndpoint { baseUrl: string; authorization: string | null } // e.g. 'http://127.0.0.1:11984', 'Basic …'
export class Go2rtcApiClient {
	constructor(endpoint: Go2rtcEndpoint, timeoutMs?: number); // default GO2RTC_HTTP_TIMEOUT_MS
	getInfo(): Promise<{ version: string | null; pid: number | null }>; // version must match /^[0-9A-Za-z.+-]{1,32}$/, else null
	putStream(name: string, src: string): Promise<void>;
	deleteStream(name: string): Promise<void>; // 404 counts as success
	listStreamNames(): Promise<string[]>;
	wsUrl(name: string): string; // http→ws, https→wss, `/api/ws?src=<encoded name>`
	readonly authorization: string | null;
}
// Every failure rejects with `new Go2rtcApiError(status | null)`, message 'go2rtc request failed'. Never echoes a URL.

// go2rtc.service.ts
export type Go2rtcRelayState = 'disabled' | 'starting' | 'running' | 'unavailable' | 'error';
export type Go2rtcRelayReason =
	| 'mode_disabled' | 'module_disabled' | 'binary_path_invalid' | 'binary_missing' | 'binary_not_executable'
	| 'external_url_missing' | 'external_unreachable' | 'start_timeout' | 'port_in_use' | 'crashed';
export interface Go2rtcRelayStatus {
	mode: Go2rtcMode;
	state: Go2rtcRelayState;
	reason: Go2rtcRelayReason | null;
	version: string | null;
	generation: number; // +1 on every spawn, every external (re)connect and every mode change
}
@Injectable()
export class Go2rtcService extends BaseManagedExtensionService {
	readonly owner = { kind: 'module', type: CAMERAS_MODULE_NAME } as const;
	readonly serviceId = 'go2rtc';
	readonly activationPolicy = 'owner-enabled' as const;
	constructor(configService: ConfigService, nestConfigService: NestConfigService, processService: Go2rtcProcessService,
		secrets: Go2rtcSecretsRegistry);
	createClient(endpoint: Go2rtcEndpoint): Go2rtcApiClient; // test seam: specs spy on it to return a mock client
	start(): Promise<void>; // resolves for every environmental failure
	stop(): Promise<void>; // rejects only when the child cannot be confirmed terminated
	onConfigChanged(): Promise<ConfigChangeResult>; // restartRequired iff go2rtc.mode, binary_path or external_url changed
	getStatus(): Go2rtcRelayStatus;
	isRunning(): boolean;
	getClient(): Go2rtcApiClient | null; // non-null only while running
	subscribe(listener: (status: Go2rtcRelayStatus) => void): () => void;
}
```

State machine:

| Mode / event | State, reason |
|---|---|
| `disabled` | `disabled`, `mode_disabled`; nothing spawned |
| module switched off (`stop()`) | `disabled`, `module_disabled`; child stopped |
| managed, `binary_path` fails `isValidGo2rtcBinaryPath` | `unavailable`, `binary_path_invalid` |
| managed, `fs.access(X_OK)` ENOENT / EACCES | `unavailable`, `binary_missing` / `binary_not_executable`; no retry until config change or service restart |
| managed, spawned | `starting`; config file written; password added to the secrets registry |
| `GET /api` answers with `pid` equal to the child's (or no `pid`) within 10 s | `running`, `version` set |
| `GET /api` answers with another `pid` | stop child, `error`, `port_in_use`; no retry |
| no answer within 10 s | stop child, attempt counted, reason `start_timeout` |
| child exits unexpectedly | attempt counted; `starting` during the backoff `[1, 2, 4, 8, 16] s`; after the fifth failed attempt `error`, `crashed`, last 5 ring lines logged at `warn` |
| running ≥ 60 s | attempt counter reset |
| running, managed, 30 s probe fails twice in a row | child stopped (`stop(0)`), counted as a crash |
| external, URL fails `isValidGo2rtcExternalUrl` | `unavailable`, `external_url_missing` |
| external, probe | `running` on success, `unavailable` / `external_unreachable` on failure, re-probed every 30 s either way |

Ports come from `getEnvValue(nestConfig, 'FB_GO2RTC_API_PORT', GO2RTC_DEFAULT_API_PORT)` and the RTSP equivalent;
the config directory from `FB_CONFIG_PATH`. Managed endpoint: `http://127.0.0.1:<apiPort>` with
`Basic base64('smart-panel:<password>')`; external endpoint: `normalizeGo2rtcExternalUrl(url)` without auth.
Status changes are logged as `go2rtc relay state=<state> reason=<reason>`; the password, the config contents and the
external URL are never logged.

- [ ] **Step 1: Write the failing API client test** against an in-test `http.createServer` on port 0.

```ts
it('reads version and pid from GET /api and sends the authorization header', async () => {
	stub.reply('GET /api', 200, { version: '1.9.9', pid: 4242 });
	expect(await client.getInfo()).toEqual({ version: '1.9.9', pid: 4242 });
	expect(stub.lastHeaders.authorization).toBe('Basic c3A6cHc=');
});
it('drops a version that is not a plain version string', async () => { /* version '<script>' → null */ });
it('puts a stream with name and src query parameters', async () => {
	await client.putStream('smart-panel_c1_medium', 'rtspx://c:7441/A?enableSrtp');
	expect(stub.last).toEqual({ method: 'PUT', path: '/api/streams', query: { name: 'smart-panel_c1_medium', src: 'rtspx://c:7441/A?enableSrtp' } });
});
it('deletes by passing the name as src and accepts 404', async () => { /* DELETE /api/streams?src=smart-panel_c1_medium; 404 resolves */ });
it('lists stream names', async () => { /* { a: {}, b: {} } → ['a', 'b'] */ });
it('rejects with Go2rtcApiError without the url on 500, on timeout and on refused connection', async () => {
	stub.reply('PUT /api/streams', 500, {});
	await expect(client.putStream('n', 'rtspx://c:7441/SENTINELALIAS0123456789')).rejects.toMatchObject({ name: 'Go2rtcApiError', status: 500, message: 'go2rtc request failed' });
	/* a server that never answers with timeoutMs 50 → status null; a closed port → status null */
});
it('builds ws and wss urls', () => {
	expect(new Go2rtcApiClient({ baseUrl: 'https://h:1984', authorization: null }).wsUrl('a b')).toBe('wss://h:1984/api/ws?src=a%20b');
});
```

- [ ] **Step 2: Write the failing service test.** Use a `FakeProcess` (records `start` calls, exposes `exit(info)`,
  `getPid()` = 4242), a `ConfigService` mock returning a mutable `CamerasConfigModel`, a `NestConfigService` mock
  returning `41984` for `FB_GO2RTC_API_PORT` and a temp dir for `FB_CONFIG_PATH`, `jest.spyOn(service,
  'createClient')` returning a mock client whose `getInfo` you resolve, reject or leave pending, and fake timers with
  `doNotFake: ['nextTick', 'setImmediate']`. No real HTTP in these cases (`AbortSignal.timeout` is not faked).

```ts
it('stays disabled and spawns nothing in disabled mode', async () => { /* mode 'disabled' → { state: 'disabled', reason: 'mode_disabled' }, process.start not called */ });
it('reports a missing binary once and never retries it', async () => {
	config.go2rtc.binaryPath = '/nonexistent/go2rtc';
	await expect(service.start()).resolves.toBeUndefined();
	expect(service.getStatus()).toMatchObject({ state: 'unavailable', reason: 'binary_missing' });
	expect(service.getState()).toBe('started');
	await jest.advanceTimersByTimeAsync(10 * 60_000);
	expect(process.start).not.toHaveBeenCalled();
});
it('reports a non-executable binary', async () => { /* chmod 0o644 temp file named go2rtc → binary_not_executable */ });
it('writes a 0600 loopback config under FB_CONFIG_PATH/go2rtc', async () => {
	await service.start();
	const file = join(configDir, 'go2rtc', 'go2rtc.yaml');
	expect(statSync(file).mode & 0o777).toBe(0o600);
	expect(statSync(join(configDir, 'go2rtc')).mode & 0o777).toBe(0o700);
	expect(readFileSync(file, 'utf8')).toContain('listen: 127.0.0.1:41984');
});
it('becomes running with the version from GET /api when the pid matches', async () => { /* getInfo → { version: '1.9.9-stub', pid: 4242 } → running */ });
it('refuses a foreign service on the api port', async () => { /* Review Focus 4: pid 1 ≠ 4242 → error, port_in_use, process.stop called, no retry */ });
it('reports start_timeout and retries when GET /api never answers', async () => { /* getInfo rejects Go2rtcApiError(null) for 10 s → reason start_timeout, second spawn after 1 s */ });
it('restarts a crashed child with 1, 2, 4, 8, 16 s backoff and gives up with error crashed', async () => {
	await startRunning();
	for (const delay of [1000, 2000, 4000, 8000, 16000]) {
		process.exit({ code: 1, signal: null, spawnErrorCode: null });
		await jest.advanceTimersByTimeAsync(delay - 1);
		const spawns = process.start.mock.calls.length;
		await jest.advanceTimersByTimeAsync(1);
		expect(process.start.mock.calls.length).toBe(spawns + 1);
	}
	process.exit({ code: 1, signal: null, spawnErrorCode: null });
	await jest.advanceTimersByTimeAsync(60_000);
	expect(service.getStatus()).toMatchObject({ state: 'error', reason: 'crashed' });
});
it('resets the attempt counter after 60 s of stable running', async () => { /* crash, recover, +60 s, crash → next delay is 1 s again */ });
it('bumps the generation on every spawn and notifies subscribers of every change', async () => { /* Review Focus 3: kill → subscriber sees starting then running with generation + 1 */ });
it('kills and restarts a child that stops answering the probe twice', async () => { /* running; getInfo rejects; +60 s → process.stop(0) called, spawn again */ });
it('uses an external go2rtc without spawning and re-probes it every 30 s', async () => {
	config.go2rtc = Object.assign(new CamerasGo2rtcConfigModel(), { mode: 'external', externalUrl: 'http://frigate.local:1984' });
	await service.start();
	expect(service.createClient).toHaveBeenCalledWith({ baseUrl: 'http://frigate.local:1984', authorization: null });
	expect(service.getStatus()).toMatchObject({ mode: 'external', state: 'running' });
	client.getInfo.mockRejectedValue(new Go2rtcApiError(null));
	await jest.advanceTimersByTimeAsync(30_000);
	expect(service.getStatus()).toMatchObject({ state: 'unavailable', reason: 'external_unreachable' });
	expect(process.start).not.toHaveBeenCalled();
});
it('treats a hand-edited external config without a url as unavailable', async () => { /* Review Focus 5: start resolves; external_url_missing */ });
it('requires a restart only when the go2rtc settings change', async () => {
	config.maxSessions = 2;
	expect(await service.onConfigChanged()).toEqual({ restartRequired: false });
	config.go2rtc.binaryPath = '/opt/go2rtc';
	expect(await service.onConfigChanged()).toEqual({ restartRequired: true });
});
it('reports module_disabled after stop and exposes no client', async () => { /* stop() → disabled, module_disabled; getClient() null */ });
it('never logs the api password or an unredacted source url', async () => {
	/* Logger.prototype spies; crash the child after ring lines with FAKE_CAMERA_SECRET_URL; the password from the written yaml */
	expect(JSON.stringify(logSpies.map((s) => s.mock.calls))).not.toMatch(new RegExp(`SENTINELALIAS|${password}`));
});
```

  Add one real-spawn test with real timers, a real `Go2rtcProcessService` and no `createClient` spy: mode `serve` of
  `writeStubGo2rtcScript` reads `-config`, takes the API port from `listen: 127.0.0.1:(\d+)` under `api:`, and serves
  `GET /api` with `{ version: '1.9.9-stub', pid: process.pid }` only when the `Authorization` header equals
  `Basic base64('smart-panel:<password from the file>')` (401 otherwise); the env mock returns a free port.
  `it('starts the stub binary, authenticates and reaches running')`.

- [ ] **Step 3: Update the inventory spec** with the row
  `['modules/cameras/cameras.module.ts', 'this.managedServiceManager.register(this.go2rtcService)']` and
  `expect(registrations).toHaveLength(23)`.

- [ ] **Step 4: Run them.** `npx jest src/modules/cameras src/modules/extensions/services/managed-service-registration.inventory.spec.ts`
  Expected: FAIL.

- [ ] **Step 5: Implement** the client (global `fetch`, `AbortSignal.timeout`), the service and the module wiring.

- [ ] **Step 6: Run them.** Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add apps/backend/src/modules/cameras apps/backend/src/modules/extensions/services/managed-service-registration.inventory.spec.ts apps/backend/test/support/stub-go2rtc.script.ts
git commit -m "feat(backend): run go2rtc as a managed cameras service"
```

---

### Task 5: Lazy, reference-counted stream registration

**Files:**
- Create: `services/go2rtc-streams.service.ts`
- Modify: `services/cameras.service.ts` (add `resolveSource`), `cameras.module.ts` (provider, export)
- Test: `services/go2rtc-streams.service.spec.ts`, `services/cameras.service.spec.ts` (extend)

**Interfaces:**
- Consumes: `Go2rtcService.getClient/getStatus/subscribe`, `Go2rtcApiClient` (Task 4); `toGo2rtcSource`,
  `go2rtcStreamName` (Task 2); `Go2rtcSecretsRegistry` (Task 3); `CamerasService.withTimeout`
  (`services/cameras.service.ts:145-181`).
- Produces:

```ts
// cameras.service.ts
resolveSource(device: DeviceEntity, provider: ICameraStreamProvider, profileId: string): Promise<CameraStreamSource>;
// same timeout, abort signal and sanitizing as listProfiles; never logs the result

// go2rtc-streams.service.ts
export interface Go2rtcStreamLease {
	readonly streamName: string;
	readonly wsUrl: string; // go2rtc /api/ws url for this stream
	readonly authorization: string | null;
	release(): void; // idempotent
}
@Injectable()
export class Go2rtcStreamsService implements OnModuleInit, OnModuleDestroy {
	constructor(go2rtc: Go2rtcService, cameras: CamerasService, secrets: Go2rtcSecretsRegistry);
	acquire(device: DeviceEntity, provider: ICameraStreamProvider, profileId: string): Promise<Go2rtcStreamLease>;
	// rejects Go2rtcUnavailableException (relay not running), CameraProfileUnavailableException,
	// CameraOfflineException, CameraUpstreamException('Live stream could not be started')
	@OnEvent(DevicesEventType.DEVICE_DELETED) removeDevice(payload: { id: string }): void;
}
```

Rules (one entry per stream name):

| Situation | Result |
|---|---|
| first `acquire` | `resolveSource` → `toGo2rtcSource` → `putStream`; source URL and its pathname added to the secrets registry; reference count 1 |
| `acquire` while that registration is in flight | joins it: one `resolveSource`, one `PUT` |
| `acquire` on a registered entry, also inside the grace period | count + 1, grace timer cleared, no `PUT` |
| last `release` | `deleteStream` after 30 s; then the secrets are removed from the registry |
| `PUT` or `resolveSource` fails | every joiner rejects; no entry; secrets removed; next `acquire` starts over |
| relay `generation` changes or state leaves `running` | all entries dropped without `DELETE` in managed mode (the process lost them), best-effort `DELETE` in external mode; in-flight registrations reject `Go2rtcUnavailableException` |
| device deleted | its entries deleted at once, whatever their count |
| external relay becomes `running` | every `smart-panel_*` stream the table does not know is deleted (orphans of a previous backend run); other names are left alone |
| module destroy | best-effort `DELETE` of every entry, bounded by 2 s |

Log lines: `go2rtc stream registered name=<name>`, `removed name=<name>`, failures with `errorName(error)`.

- [ ] **Step 1: Write the failing tests** with a mocked `Go2rtcApiClient`, a fake `Go2rtcService` (status +
  `subscribe` you can fire), `FakeCameraStreamProvider` and fake timers.

```ts
it('registers one go2rtc stream for two viewers of the same profile', async () => {
	const [a, b] = await Promise.all([streams.acquire(camera, provider, 'medium'), streams.acquire(camera, provider, 'medium')]);
	expect(client.putStream).toHaveBeenCalledTimes(1);
	expect(client.putStream).toHaveBeenCalledWith(`smart-panel_${camera.id}_medium`, 'rtspx://fake-console:7441/SENTINELALIAS0123456789?enableSrtp');
	expect(a.streamName).toBe(b.streamName);
});
it('removes the stream 30 s after the last viewer leaves', async () => {
	const lease = await streams.acquire(camera, provider, 'medium');
	lease.release();
	await jest.advanceTimersByTimeAsync(29_999);
	expect(client.deleteStream).not.toHaveBeenCalled();
	await jest.advanceTimersByTimeAsync(1);
	expect(client.deleteStream).toHaveBeenCalledWith(`smart-panel_${camera.id}_medium`);
});
it('survives twenty reload cycles with one PUT and no DELETE', async () => { /* Review Focus 1: acquire/release ×20 within 1 s each; release twice per lease */ });
it('rejects every joiner and keeps no entry when PUT fails', async () => { /* putStream rejects Go2rtcApiError(500) → both reject CameraUpstreamException; next acquire PUTs again */ });
it('drops the table when the relay generation changes', async () => { /* Review Focus 3: managed, fire subscribe({ generation: 2 }) → next acquire PUTs again; deleteStream not called */ });
it('rejects in-flight registrations when the relay stops', async () => { /* resolveSource pending; fire state 'starting' → Go2rtcUnavailableException */ });
it('deletes the streams of a deleted device at once', async () => { /* removeDevice({ id }) with count 2 → deleteStream now */ });
it('deletes orphaned smart-panel streams when an external relay comes up', async () => {
	client.listStreamNames.mockResolvedValue(['smart-panel_old_medium', 'frigate_front']);
	fire({ mode: 'external', state: 'running', generation: 3 });
	await flush();
	expect(client.deleteStream.mock.calls).toEqual([['smart-panel_old_medium']]);
});
it('refuses an exec source before it reaches go2rtc', async () => { /* provider.resolveSource → { url: 'exec:id', transport: 'rtsp' } → CameraUpstreamException; putStream not called */ });
it('throws Go2rtcUnavailableException while the relay is not running', async () => { /* getClient() null */ });
it('keeps the source url only while the stream exists and never logs or throws it', async () => {
	const lease = await streams.acquire(camera, provider, 'medium');
	expect(secrets.list()).toContain(FAKE_CAMERA_SECRET_URL.replace(/^rtsps/, 'rtspx'));
	lease.release();
	await jest.advanceTimersByTimeAsync(30_000);
	expect(secrets.list()).toEqual([]);
	client.putStream.mockRejectedValue(new Error(FAKE_CAMERA_SECRET_URL));
	const error = await streams.acquire(camera, provider, 'medium').catch((e: Error) => e);
	expect(JSON.stringify([logSpies.map((s) => s.mock.calls), (error as Error).message])).not.toContain('SENTINELALIAS');
});

// cameras.service.spec.ts (extend)
it('resolveSource passes an abort signal and fails after 10 s', async () => { /* never-settling provider → CameraProviderTimeoutError; signal aborted */ });
it('resolveSource sanitizes provider errors', async () => { /* Error(secret url) → CameraUpstreamException 'Camera did not respond' */ });
```

  Register both the URL as sent to go2rtc and the provider's original URL and its pathname in the secrets registry.

- [ ] **Step 2: Run them.** `npx jest src/modules/cameras/services` Expected: FAIL.

- [ ] **Step 3: Implement** `resolveSource` and the streams service. `onModuleInit` subscribes to `Go2rtcService`;
  `onModuleDestroy` unsubscribes and clears timers.

- [ ] **Step 4: Run them.** Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add apps/backend/src/modules/cameras
git commit -m "feat(backend): register go2rtc streams only while cameras are watched"
```

---

### Task 6: Live stream connection

**Files:**
- Create: `gateway/live-stream.constants.ts`, `gateway/live-stream-connection.ts`
- Test: `gateway/live-stream-connection.spec.ts`

**Interfaces:**
- Consumes: `Go2rtcStreamLease` (Task 5), `CameraStreamSession` (`services/camera-session.service.ts:15-22`),
  exceptions.
- Produces:

```ts
// live-stream.constants.ts
export const LIVE_MAX_LIFETIME_MS = 4 * 60 * 60 * 1000;
export const LIVE_HEARTBEAT_INTERVAL_MS = 30_000;
export const LIVE_CLIENT_MAX_PAYLOAD_BYTES = 4096;
export const LIVE_CLIENT_PENDING_FRAMES = 8;
export const LIVE_HIGH_WATER_BYTES = 4 * 1024 * 1024;
export const LIVE_LOW_WATER_BYTES = 1024 * 1024;
export const LIVE_STALL_TIMEOUT_MS = 10_000;
export const LIVE_UPSTREAM_CONNECT_TIMEOUT_MS = 10_000;
export const LIVE_UPSTREAM_MAX_PAYLOAD_BYTES = 16 * 1024 * 1024;
export const LIVE_CLOSE = {
	SERVER_SHUTDOWN: [1001, 'server_shutdown'],
	UNSUPPORTED_DATA: [1003, 'unsupported_data'],
	PROTOCOL_VIOLATION: [1008, 'protocol_violation'],
	UPSTREAM_FAILED: [1011, 'upstream_failed'],
	UPSTREAM_CLOSED: [1011, 'upstream_closed'],
	RELAY_UNAVAILABLE: [1013, 'relay_unavailable'],
	SESSION_LIMIT: [1013, 'session_limit'],
	CAMERA_SESSION_LIMIT: [1013, 'camera_session_limit'],
	SLOW_CONSUMER: [1013, 'slow_consumer'],
	REVOKED: [4000, 'revoked'],
	MODULE_DISABLED: [4001, 'module_disabled'],
	MAX_LIFETIME: [4002, 'max_lifetime'],
} as const;
export type LiveCloseKind = keyof typeof LIVE_CLOSE;

// live-stream-connection.ts
export interface LiveStreamConnectionOptions {
	client: WebSocket;
	session: CameraStreamSession;
	connectUpstream: (signal: AbortSignal) => Promise<Go2rtcStreamLease>;
	onClosed: (connection: LiveStreamConnection) => void;
	createUpstream?: (url: string, headers: Record<string, string>) => WebSocket; // test seam; default `new WebSocket(url, { headers, handshakeTimeout: LIVE_UPSTREAM_CONNECT_TIMEOUT_MS, maxPayload: LIVE_UPSTREAM_MAX_PAYLOAD_BYTES })`
}
export class LiveStreamConnection {
	constructor(options: LiveStreamConnectionOptions);
	readonly session: CameraStreamSession;
	readonly closed: boolean;
	start(): void; // arms lifetime and heartbeat, then connects upstream
	close(kind: LiveCloseKind): void; // idempotent: closes the client with LIVE_CLOSE[kind], closes or terminates upstream, aborts connectUpstream, releases the lease once, calls onClosed once
}
```

Frame rules:

| Direction | Rule |
|---|---|
| client → backend, text, before upstream opens | queued; the ninth queued frame → `PROTOCOL_VIOLATION` |
| client → backend, text | must parse as JSON object with `type === 'mse'` and an optional string `value` ≤ 1024 chars, else `PROTOCOL_VIOLATION`; forwarded unchanged |
| client → backend, binary | `UNSUPPORTED_DATA` |
| upstream → client | forwarded with the same `binary` flag; after each send, `bufferedAmount > LIVE_HIGH_WATER_BYTES` → `upstream.pause()`; the send callback resumes it once `bufferedAmount < LIVE_LOW_WATER_BYTES`; paused for `LIVE_STALL_TIMEOUT_MS` → `SLOW_CONSUMER` |
| upstream closes or errors | `UPSTREAM_CLOSED` |
| `connectUpstream` or the upstream handshake fails | `Go2rtcUnavailableException` → `RELAY_UNAVAILABLE`; `CamerasNotFoundException`, `CameraProfileUnavailableException`, `CameraOfflineException` → `REVOKED`; anything else → `UPSTREAM_FAILED` |
| client closes | upstream closed with 1000 (terminated while still connecting), lease released |
| lifetime reached | `MAX_LIFETIME` |
| no pong between two heartbeats | `client.terminate()`, then the same cleanup as a close |

Log lines: `Live stream closed session=<id> device=<id> code=<code> reason=<reason>`; errors as `errorName(error)`.
The authorization header and the upstream URL are never logged.

- [ ] **Step 1: Write the failing tests.** Real sockets for the protocol cases (an `http` server on port 0 with a
  `WebSocketServer({ noServer: true, maxPayload: LIVE_CLIENT_MAX_PAYLOAD_BYTES })` building the connection, and a
  stub upstream `WebSocketServer` on another port); fake `client`/`upstream` objects (`bufferedAmount`, `send(data,
  opts, cb)`, `pause`, `resume`, `isPaused`, `ping`, `terminate`) with fake timers for backpressure, lifetime and
  heartbeat.

```ts
it('relays the mse request upstream and media back', async () => {
	client.send(JSON.stringify({ type: 'mse', value: 'avc1.640029' }));
	expect(JSON.parse(await upstreamReceived())).toEqual({ type: 'mse', value: 'avc1.640029' });
	upstreamSocket.send(Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]));
	expect(await clientReceivedBinary()).toEqual(Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]));
});
it('queues client requests until the upstream opens', async () => { /* lease resolves after 300 ms; frame sent at once arrives upstream */ });
it.each([JSON.stringify({ type: 'webrtc/offer', value: 'v=0' }), 'not json', JSON.stringify({ type: 'mse', value: 'x'.repeat(2000) })])(
	'closes 1008 for the request %#', async (frame) => expect(await closeAfterSending(frame)).toEqual([1008, 'protocol_violation']));
it('closes 1003 for a binary client frame', async () => { /* [1003, 'unsupported_data'] */ });
it('closes 1008 when a ninth frame is queued', async () => { /* lease never resolves; 9 frames */ });
it('closes 1011 upstream_closed and releases the lease once when go2rtc closes', async () => { /* lease.release called 1× */ });
it('closes upstream and releases the lease when the client leaves', async () => { /* upstream sees close 1000 */ });
it('releases a lease that arrives after the client left', async () => { /* close before connectUpstream resolves → release called, no upstream created */ });
it.each([
	[new Go2rtcUnavailableException('x'), [1013, 'relay_unavailable']],
	[new CamerasNotFoundException('x'), [4000, 'revoked']],
	[new CameraOfflineException('x'), [4000, 'revoked']],
	[new Error(FAKE_CAMERA_SECRET_URL), [1011, 'upstream_failed']],
])('maps a failed connect %#', async (error, expected) => expect(await closeWhenConnectRejects(error)).toEqual(expected));
it('pauses upstream above 4 MiB buffered and resumes below 1 MiB', () => {
	fakeClient.bufferedAmount = LIVE_HIGH_WATER_BYTES + 1;
	fakeUpstream.emit('message', Buffer.alloc(10), true);
	expect(fakeUpstream.pause).toHaveBeenCalled();
	fakeClient.bufferedAmount = LIVE_LOW_WATER_BYTES - 1;
	fakeClient.flushSendCallbacks();
	expect(fakeUpstream.resume).toHaveBeenCalled();
});
it('closes 1013 slow_consumer after 10 s paused', () => { /* advance 10_000 */ });
it('closes 4002 after 4 h', () => { /* advance LIVE_MAX_LIFETIME_MS */ });
it('terminates a client that stops answering pings and releases its lease', () => { /* Review Focus 2: no pong; advance 2 × 30_000 → terminate, release, onClosed */ });
it('uses only fixed close reasons and never logs the authorization header', async () => { /* lease.authorization 'Basic PW_SENTINEL'; logs and reasons exclude it and SENTINELALIAS */ });
```

- [ ] **Step 2: Run it.** `npx jest src/modules/cameras/gateway/live-stream-connection.spec.ts` Expected: FAIL.

- [ ] **Step 3: Implement** the constants and the class. `start()` → `connectUpstream(abort.signal)` → if closed,
  `lease.release()` and stop; else create upstream with `Authorization` when the lease has one.

- [ ] **Step 4: Run it.** Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add apps/backend/src/modules/cameras/gateway
git commit -m "feat(backend): proxy one camera live socket to go2rtc with backpressure"
```

---

### Task 7: Live stream gateway

**Files:**
- Create: `gateway/live-stream.gateway.ts`
- Modify: `cameras.module.ts` (provider)
- Test: `gateway/live-stream.gateway.spec.ts`

Upgrade pattern: `plugins/devices-shelly-ng/services/shelly-ws-server.service.ts:57-152` (`noServer`, own `upgrade`
listener, leave other paths untouched, detach on stop). Two deliberate differences:

1. The HTTP server comes from Nest's `HttpAdapterHost` (`httpAdapterHost.httpAdapter?.getHttpServer()`), not
   `AppInstanceHolder`, which only `main.ts:96-97` fills. `createNestApplication` sets the adapter host in production
   and in tests (`@nestjs/testing/testing-module.js:21-26`), so the e2e needs no `setApp`. In a CLI context the
   adapter is absent and `onApplicationBootstrap` does nothing.
2. Everything before `handleUpgrade` is synchronous. engine.io (attached by `WebsocketGateway`) ends any upgrade on
   another path that has written no byte after 1 s
   (`node_modules/.pnpm/engine.io@6.6.9/node_modules/engine.io/build/server.js:649-697`); the session is checked from
   memory (`CameraSessionService.consume`, `services/camera-session.service.ts:116-132`) and the 101 is written in the
   same tick. Upstream work starts afterwards.

**Interfaces:**
- Consumes: `CameraSessionService.consume`; `ConfigService.getModuleConfig` (as `guards/cameras-module-enabled.guard.ts:32-40`);
  `Go2rtcService.isRunning/subscribe`; `CamerasService.getProviderOrThrow`, `resolveProfile`;
  `Go2rtcStreamsService.acquire`; `LiveStreamConnection` (Task 6).
- Produces:

```ts
@Injectable()
export class LiveStreamGateway implements OnApplicationBootstrap, OnModuleDestroy {
	constructor(httpAdapterHost: HttpAdapterHost, configService: ConfigService, sessions: CameraSessionService,
		cameras: CamerasService, go2rtc: Go2rtcService, streams: Go2rtcStreamsService);
	onApplicationBootstrap(): void; // creates WebSocketServer({ noServer: true, maxPayload: LIVE_CLIENT_MAX_PAYLOAD_BYTES, perMessageDeflate: false }) and attaches
	onModuleDestroy(): void; // closes every connection SERVER_SHUTDOWN, detaches, closes the wss
	getActiveCount(): number;
	@OnEvent(DevicesEventType.DEVICE_DELETED) handleDeviceDeleted(payload: { id: string }): void;
	@OnEvent(DisplaysEventType.DISPLAY_DELETED) handleDisplayDeleted(payload: { id: string }): void;
	@OnEvent(DisplaysEventType.DISPLAY_TOKEN_REVOKED) handleDisplayTokenRevoked(payload: { id: string }): void;
	@OnEvent(UsersEventType.USER_DELETED) handleUserDeleted(payload: { id: string }): void;
	@OnEvent(ConfigEventType.CONFIG_UPDATED) handleConfigUpdated(payload?: { source: string; type: 'plugin' | 'module' | 'section' }): Promise<void>;
}
```

Upgrade handling (synchronous up to and including `handleUpgrade`):

| Step | Outcome |
|---|---|
| `pathname !== CAMERAS_LIVE_PATH` | return without touching the socket |
| module config unreadable / disabled | raw `HTTP/1.1 503` / `HTTP/1.1 404` with `Connection: close`, socket destroyed; token not consumed |
| `sessions.consume(searchParams.get('session') ?? '')` is null | raw `HTTP/1.1 401`, socket destroyed |
| otherwise | `wss.handleUpgrade(…)`, then admit |
| admit: `!go2rtc.isRunning()` | close `RELAY_UNAVAILABLE` |
| admit: open connections ≥ `maxSessions` | close `SESSION_LIMIT` |
| admit: open connections of the device ≥ `min(maxSessionsPerCamera, maxSessions)` | close `CAMERA_SESSION_LIMIT` |
| admit: otherwise | register a `LiveStreamConnection` (counted at once), `start()`; its `connectUpstream` runs `getProviderOrThrow(session.deviceId)` then `streams.acquire(device, provider, session.profileId)` and stores device and provider on the registry entry |

Closing rules: device deleted → its connections `REVOKED`; display deleted or token revoked → connections whose owner
is `{ kind: 'display', id }` `REVOKED`; user deleted → `{ kind: 'user', id }` `REVOKED` (Plan 2's
`CamerasModule.Session.Revoked` covers only unconsumed sessions); `CONFIG_UPDATED` for `cameras-module` with the
module off or unreadable → all `MODULE_DISABLED`; `CONFIG_UPDATED` for any plugin → each connection re-runs
`getProviderOrThrow` and `resolveProfile(device, provider, profileId)` and closes `REVOKED` on failure (a disabled
provider plugin throws `CameraOfflineException`, `docs/cameras-architecture.md:105-106`); a relay status that is not
`running` or has a new `generation` → all `RELAY_UNAVAILABLE`.

Log lines never include `req.url`, the query string or a header: `Live stream refused reason=<invalid_session|module_disabled|config_unavailable>`
and `Live stream opened session=<id> device=<id> profile=<id>`.

- [ ] **Step 1: Write the failing tests.** A real `http` server on port 0 handed to the gateway through
  `{ httpAdapter: { getHttpServer: () => server } }`; real `CameraSessionService`; `Go2rtcService` fake;
  `Go2rtcStreamsService.acquire` returning leases to a stub upstream `WebSocketServer` that answers `mse`.

```ts
it('leaves upgrades for other paths to other listeners', async () => { /* /socket.io/ upgrade: gateway writes nothing; a second listener answers it */ });
it('writes the 101 in the same tick as the upgrade event', async () => {
	let written = -1;
	server.on('upgrade', (_req, socket) => (written = (socket as Socket).bytesWritten)); // registered after the gateway
	await openLive(validToken());
	expect(written).toBeGreaterThan(0);
});
it.each(['unknown', 'reused', 'expired'])('refuses a %s session with 401 before upgrading', async (kind) =>
	expect(await handshakeStatus(tokenFor(kind))).toBe(401));
it('answers 404 while the module is disabled and keeps the token usable', async () => { /* 404; enable; same token → 101 */ });
it('answers 503 when the module config cannot be read', async () => { /* getModuleConfig throws */ });
it('closes 1013 relay_unavailable when the relay is not running', async () => {});
it('enforces max_sessions and the per-camera limit', async () => {
	config.maxSessions = 2; config.maxSessionsPerCamera = 1;
	await openLive(validToken('c1'));
	expect(await closeOf(validToken('c1'))).toEqual([1013, 'camera_session_limit']);
	await openLive(validToken('c2'));
	expect(await closeOf(validToken('c3'))).toEqual([1013, 'session_limit']);
});
it('frees a slot when a silent client is terminated', async () => { /* Review Focus 2: fake timers; client stops ponging; after 60 s a new c1 session is admitted */ });
it.each([
	['handleDeviceDeleted', { id: 'c1' }, { deviceId: 'c1' }],
	['handleDisplayDeleted', { id: 'd1' }, { owner: { kind: 'display', id: 'd1' } }],
	['handleDisplayTokenRevoked', { id: 'd1' }, { owner: { kind: 'display', id: 'd1' } }],
	['handleUserDeleted', { id: 'u1' }, { owner: { kind: 'user', id: 'u1' } }],
] as const)('%s closes the matching sockets with 4000 and leaves others open', async (handler, payload, match) => {});
it('closes every socket with 4001 when the module is switched off', async () => { /* enabled = false; handleConfigUpdated({ source: 'cameras-module', type: 'module' }) */ });
it('closes sockets whose camera became unavailable after a plugin config change', async () => { /* listProfiles now throws CameraOfflineException; handleConfigUpdated({ source: 'x', type: 'plugin' }) → [4000, 'revoked']; a healthy camera stays open */ });
it('closes every socket with 1013 when the relay stops or restarts', async () => { /* Review Focus 3: fire { state: 'starting' }; then fire { state: 'running', generation: 2 } on new sockets */ });
it('closes with 1001 and detaches on shutdown', async () => { /* onModuleDestroy → [1001, 'server_shutdown']; server.listenerCount('upgrade') back to its value before bootstrap */ });
it('does nothing without an http adapter', () => { /* new gateway with { httpAdapter: undefined } → onApplicationBootstrap does not throw */ });
it('never logs the session token or the source url', async () => { /* logs over all cases exclude every token and SENTINELALIAS */ });
```

- [ ] **Step 2: Run it.** `npx jest src/modules/cameras/gateway/live-stream.gateway.spec.ts` Expected: FAIL.

- [ ] **Step 3: Implement the gateway** and add it to the module providers.

- [ ] **Step 4: Run the module tests.** `npx jest src/modules/cameras` Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add apps/backend/src/modules/cameras
git commit -m "feat(backend): serve authenticated camera live sockets"
```

---

### Task 8: Status route, relay-aware sessions and OpenAPI

**Files:**
- Create: `controllers/cameras-status.controller.ts`, `controllers/camera-owner.utils.ts`, `models/status.model.ts`
- Modify: `controllers/cameras.controller.ts` (constructor appends `Go2rtcService`; `requireOwner` at `:278-288` moves
  to `camera-owner.utils.ts`; relay check in `createSession` at `:213-224`), `models/cameras-response.model.ts`,
  `cameras.openapi.ts`, `cameras.module.ts` (controller)
- Modify tests: `controllers/cameras.controller.spec.ts`, `cameras.module-toggle.spec.ts:58-96` (provide a
  `Go2rtcService` mock, add the status controller and a `['status', 'GET', '/status', undefined]` row),
  `cameras.secret-hygiene.spec.ts:48-55` (new controller argument; add the relay cases)
- Modify: `apps/admin/src/openapi.constants.ts` (append after the cameras block at lines 954-964)
- Modify: `apps/backend/test/cameras.e2e-spec.ts` — Plan 2's session cases expect 201, which now needs a running
  relay: in `beforeAll` add `relaySpy = jest.spyOn(app.get(Go2rtcService), 'isRunning').mockReturnValue(true)`, and
  add the case `it('answers 503 for a session while the relay is unavailable')` that sets it to `false` for one call
- Test: `controllers/cameras-status.controller.spec.ts`

**Interfaces:**
- Consumes: `Go2rtcService.getStatus/isRunning` (Task 4), `LiveStreamGateway.getActiveCount` (Task 7).
- Produces:

```ts
// controllers/camera-owner.utils.ts
export function requireCameraOwner(req: AuthenticatedRequest): CameraSessionOwner; // CamerasForbiddenException → ForbiddenException

// models/status.model.ts
@ApiSchema({ name: 'CamerasModuleDataRelayStatus' }) export class CamerasRelayStatusModel {
	mode: Go2rtcMode; state: Go2rtcRelayState; reason: Go2rtcRelayReason | null; version: string | null;
}
@ApiSchema({ name: 'CamerasModuleDataSessionsStatus' }) export class CamerasSessionsStatusModel {
	active: number; max: number; maxPerCamera: number; // max_per_camera
}
@ApiSchema({ name: 'CamerasModuleDataStatus' }) export class CamerasStatusModel {
	relay: CamerasRelayStatusModel; sessions: CamerasSessionsStatusModel;
}
@ApiSchema({ name: 'CamerasModuleResStatus' }) export class CamerasStatusResponseModel extends BaseSuccessResponseModel<CamerasStatusModel> {}
```

- `CamerasStatusController(configService: ConfigService, go2rtc: Go2rtcService, gateway: LiveStreamGateway)`; the
  toggle spec provides mocks for both new services.
- Route: `@Controller('status')`, `@UseGuards(CamerasModuleEnabledGuard)`, `GET /`, operationId
  `get-cameras-module-status`, users and displays only (403 otherwise). `generation` is not exposed. `max` and
  `max_per_camera` are the configured values; `active` is `getActiveCount()`.
- `POST cameras/:deviceId/sessions` answers 503 `Live view relay is not available` when `!go2rtc.isRunning()`,
  checked after the owner and before `beginCreate`.
- Admin aliases: `CamerasModuleStatusSchema`, `CamerasModuleRelayStatusSchema`, `CamerasModuleSessionsStatusSchema`,
  `CamerasModuleGetStatusOperation`.

- [ ] **Step 1: Write the failing tests.**

```ts
// cameras-status.controller.spec.ts
it('reports relay state, version and sessions', async () => {
	go2rtc.getStatus.mockReturnValue({ mode: 'managed', state: 'running', reason: null, version: '1.9.9', generation: 4 });
	gateway.getActiveCount.mockReturnValue(3);
	const { data } = await controller.getStatus(userReq);
	expect(instanceToPlain(data)).toEqual({ relay: { mode: 'managed', state: 'running', reason: null, version: '1.9.9' }, sessions: { active: 3, max: 8, max_per_camera: 4 } });
});
it('reports an unavailable relay with its reason', async () => { /* binary_missing, version null */ });
it('refuses third-party tokens', async () => { /* ForbiddenException */ });

// cameras.controller.spec.ts (extend)
it('answers 503 for a session while the relay is not running and creates nothing', async () => {
	go2rtc.isRunning.mockReturnValue(false);
	await expect(controller.createSession(userReq, id, body)).rejects.toBeInstanceOf(ServiceUnavailableException);
	expect(sessions.beginCreate).not.toHaveBeenCalled();
});

// cameras.secret-hygiene.spec.ts (extend): describe('relay')
it('keeps the source url and api password out of the status, the ring, logs and errors', async () => {
	/* FakeCameraStreamProvider in 'ok' mode; streams.acquire with a client whose putStream rejects Error(FAKE_CAMERA_SECRET_URL);
	   a Go2rtcProcessService started on writeStubGo2rtcScript(dir, 'run') (Task 3), which prints FAKE_CAMERA_SECRET_URL
	   and PW_SENTINEL_abc; the status controller output */
	const emitted = JSON.stringify([logSpies.map((s) => s.mock.calls), statusBody, ringLines, caughtErrors.map((e) => [e.name, e.message])]);
	expect(emitted).not.toMatch(/SENTINELALIAS|fake-console:7441|PW_SENTINEL/);
});
it('keeps snapshots working while the relay is unavailable', async () => { /* go2rtc unavailable; the snapshot controller path still returns the image */ });
```

  The module toggle spec's new row asserts 200 when enabled and 404 `Cameras module is disabled` when disabled.

- [ ] **Step 2: Run them.** `npx jest src/modules/cameras` Expected: FAIL.

- [ ] **Step 3: Implement** utils, models, the controller, the session check, the swagger registration.

- [ ] **Step 4: Run them.** `npx jest src/modules/cameras && npx jest --config ./test/jest-e2e.json test/cameras.e2e-spec.ts`
  Expected: PASS.

- [ ] **Step 5: Regenerate and lint the API.** Run (repo root): `pnpm run generate:openapi && pnpm --filter ./apps/backend run lint:openapi`
  Expected: PASS; `spec/api/v1/openapi.json` contains `CamerasModuleResStatus`, `get-cameras-module-status`,
  `CamerasModuleDataGo2rtcConfig` with `binary_path`, `external_url`, `mode`.

- [ ] **Step 6: Append the admin aliases** and run `pnpm --filter ./apps/admin run lint:js` (or the admin type check
  the repo uses). Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add apps/backend/src/modules/cameras apps/backend/test/cameras.e2e-spec.ts apps/admin/src/openapi.constants.ts
git commit -m "feat(backend): report camera relay status and refuse sessions without a relay"
```

---

### Task 9: End-to-end test, architecture document and PR

**Files:**
- Create: `apps/backend/test/support/stub-go2rtc.server.ts`, `apps/backend/test/cameras-live.e2e-spec.ts`
- Modify: `docs/cameras-architecture.md` (replace *Not yet implemented*, lines 247-255; update *REST API* 149-178,
  *Stream sessions* 232-236, *Secret rule* 238-245), `tasks/epics/EPIC-UNIFI-PROTECT.md:98` (`UP-3 (done)`)

**Interfaces:**
- Produces:

```ts
export class StubGo2rtcServer {
	start(): Promise<string>; // 'http://127.0.0.1:<port>'
	stop(): Promise<void>;
	readonly puts: { name: string; src: string }[];
	readonly deletes: string[];
	acceptDelayMs: number; // delays the /api/ws upgrade
	// GET /api → { version: '1.9.9-stub', pid: null }; PUT/DELETE/GET /api/streams as in Global Constraints;
	// /api/ws?src=<known name>: on {"type":"mse"} sends a text {"type":"mse","value":"video/mp4; codecs=\"avc1.640029\""},
	// then a binary ftyp box every 100 ms; unknown name → close 1011
}
```

E2E setup: `process.env.FB_CONFIG_PATH = mkdtempSync(…)` before compiling (as `test/devices-virtual.e2e-spec.ts:5132-5141`);
boot, filters, pipes, auth, display and devices exactly as `test/cameras.e2e-spec.ts:89-220`, with two camera
devices; `await app.listen(0, '127.0.0.1')` and `new URL(await app.getUrl())` (as
`test/mcp-endpoint.e2e-spec.ts:254, 296`). The real `WebsocketGateway` is in `AppModule`, so socket.io's upgrade
listener is present. Switch to the stub with `PATCH /api/v1/modules/config/config/module/cameras-module` (router
prefix `config` at `src/app.module.ts:264` plus `@Controller('config')`) as owner `{ data: { type:
'cameras-module', go2rtc: { mode: 'external', external_url: stubUrl }, max_sessions: 2, max_sessions_per_camera: 1
} }`, then poll `GET /modules/cameras/status` until `relay.state` is `running` (≤ 5 s). Logger spies as
`test/cameras.e2e-spec.ts` uses.

| Case | Expectation |
|---|---|
| open the session URL (`ws://host:port` + `url`), send `{"type":"mse","value":"avc1.640029"}` | 101; a text `mse` reply and at least one binary frame; `stub.puts` has one entry with `src` `rtspx://fake-console:7441/SENTINELALIAS0123456789?enableSrtp` |
| the same token again | handshake fails, `unexpected-response` status 401 |
| `stub.acceptDelayMs = 1500`, new session | socket still open after 2 s and receives media (engine.io's 1 s destroy did not fire) |
| a second session for the same camera while the first is open | close `[1013, 'camera_session_limit']` |
| `GET /modules/cameras/status` as user | 200, `relay: { mode: 'external', state: 'running', reason: null, version: '1.9.9-stub' }`, `sessions.max: 2`, `max_per_camera: 1`, `active` ≥ 1; body has no `rtsp` |
| `PATCH` with `go2rtc: { external_url: null }` while external | 400 |
| delete the second camera while it streams | close `[4000, 'revoked']`; `stub.deletes` contains its stream name |
| plain `GET` (no upgrade) of a session URL | 404 |
| `PATCH` `external_url` to `http://127.0.0.1:<closed port>` (`onConfigChanged` restarts the relay; the first probe fails) | status `unavailable` / `external_unreachable`; `POST sessions` → 503; `GET …/snapshot` → 200 |
| `PATCH { enabled: false }` with a socket open | close `[4001, 'module_disabled']`; `GET status` → 404 |
| every log call of the suite | contains no `SENTINELALIAS`, no session token, no `PW_SENTINEL` |

- [ ] **Step 1: Write the stub server and the e2e test.**

- [ ] **Step 2: Run it.**

Run (from `apps/backend`): `npx jest --config ./test/jest-e2e.json test/cameras-live.e2e-spec.ts test/cameras.e2e-spec.ts`
Expected: PASS.

- [ ] **Step 3: Update `docs/cameras-architecture.md`** with these sections and nothing speculative: *Relay
  (go2rtc)* (the three modes; the state and reason tables of Task 4; config file path, mode and contents; ports and
  `FB_GO2RTC_*` overrides; basic auth per spawn; backoff; `GO2RTC_INSTALL_DIR` / `GO2RTC_DEFAULT_BINARY_PATH` and that
  UP-4 installs there; external mode: no credentials in the URL, the user secures that go2rtc, orphan cleanup of
  `smart-panel_*`); *Stream registration* (rule table of Task 5; `toGo2rtcSource` table of Task 2); *Live WebSocket*
  (handshake and why admission is synchronous; client frame rules; close code table; limits; lifetime; heartbeat;
  revocation events and plugin re-validation); *Status route*; REST table gains `GET /status` and the 503 of `POST
  sessions`; *Secret rule* adds the API password, the output ring, close reasons, and the URL token: the upgrade never
  passes through Fastify, Fastify's request logger is off (`main.ts:52`), the gateway logs no URL, and a remote-access
  proxy in front of the backend must not log query strings; *Not yet implemented*: WebRTC, HLS/MP4 for the panel
  (UP-15), installer (UP-4).

- [ ] **Step 4: Tick UP-3** in `tasks/epics/EPIC-UNIFI-PROTECT.md:98` as `UP-3 (done)`.

- [ ] **Step 5: Run every gate.**

```bash
pnpm run lint:js
pnpm run test:unit
pnpm run test:e2e
pnpm --filter ./apps/admin run test:unit
```

Expected: all PASS.

- [ ] **Step 6: Optional manual check with a real binary** (not in CI): download the go2rtc release UP-0 pins, set
  `binary_path` to it, and confirm `GET status` shows `running` with its version, that `GET /api` without
  credentials answers 401 on `127.0.0.1:11984`, and that `ss -ltn` shows only `127.0.0.1` listeners. Record the
  result in the PR body; a mismatch with the "go2rtc API facts" constraint is fixed before merge.

- [ ] **Step 7: Commit, push and open the PR** with the title from Global Constraints. The body states: what the relay
  and live socket do; that sessions are refused with 503 without a relay and snapshots keep working; the close code
  table; that admission is synchronous because of engine.io (roadmap A3) and uses `HttpAdapterHost`; that revocation
  of open sockets uses the four events plus plugin re-validation (A2); the cross-field config check through
  `ModuleConfigMutationRegistryService`; the go2rtc API facts still to confirm in UP-0; `Closes #1179`.

```bash
git add apps/backend/test docs/cameras-architecture.md tasks/epics/EPIC-UNIFI-PROTECT.md
git commit -m "test(backend): cover camera live streaming end to end against a stub go2rtc"
git push -u origin feat/cameras-relay
gh pr create --base feat/cameras-module --title "feat(backend): relay camera live streams through a managed go2rtc service" --body-file <body>
```

  Use `--base main` instead once #1612 has merged and the branch is rebased.
