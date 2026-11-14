# Cameras Architecture

Reference for the backend `cameras` module (`apps/backend/src/modules/cameras/`).

## Purpose

The cameras module gives clients one way to list camera and doorbell devices, fetch a still image and open a
short-lived live view session, whatever integration the device comes from. The module does not talk to any camera
itself. An integration plugin registers an `ICameraStreamProvider` for its device `type`; the module routes requests to
the provider that matches the device, caches snapshots, issues sessions and relays live video through go2rtc.

Cameras are devices with category `camera` or `doorbell`. A camera whose `type` has no registered provider is still
listed, with `live_view: false` and no profiles; its snapshot and session routes answer 404.

`GET /cameras` lists visible devices only (`DeviceHiddenFilter.FALSE`). A hidden camera is not listed but stays
reachable by its id: detail, snapshot and session do not check the hidden flag.

The module can be switched off (`enabled` in its module configuration, on by default). While it is off every route
answers 404 `Cameras module is disabled` through `CamerasModuleEnabledGuard`, the same status the MCP module uses for a
disabled endpoint; the guard runs after authentication. The provider registry stays injectable and registrations keep
working, so provider plugins are unaffected and the module resumes serving as soon as it is switched back on.

Only users and displays may use the module. Third-party and MCP tokens are refused with 403, so a long-lived
integration token never reaches camera footage.

## Provider contract

`platforms/camera-stream.provider.ts`:

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
	url: string; // SECRET. Never logged, persisted, emitted or returned to a client.
	transport: 'rtsp' | 'rtsps-insecure' | 'http';
}

export interface CameraSnapshot {
	contentType: string;
	data: Buffer;
}

export interface ICameraStreamProvider {
	getType(): string; // device `type` discriminator, e.g. 'devices-unifi-protect'
	listProfiles(device: DeviceEntity, options?: { signal?: AbortSignal }): Promise<CameraStreamProfile[]>;
	resolveSource(device: DeviceEntity, profileId: string, options?: { signal?: AbortSignal }): Promise<CameraStreamSource>;
	getSnapshot(
		device: DeviceEntity,
		options: { channelId?: string; highQuality?: boolean; signal?: AbortSignal },
	): Promise<CameraSnapshot>;
	getSnapshotMinIntervalMs?(device: DeviceEntity): number;
}
```

### Exceptions a provider may throw

From `cameras.exceptions.ts`. Exactly three typed exceptions keep their meaning at the provider boundary
(`sanitizeProviderError`); the module re-creates them with a fixed message, so the provider's text is dropped.

| Exception | Meaning | What the module does |
|---|---|---|
| `CameraOfflineException` | The camera is not reachable. | Snapshot: 503 "Camera is offline" and the cached image of that key is dropped. Session: 503 "Camera did not respond". |
| `CameraRateLimitedException` | The upstream asks the module to back off. | Snapshot: the stale cached image is returned with `X-Snapshot-Age` when one exists, otherwise 503 "Camera is busy" with `Retry-After: 2`. Session: 503 "Camera did not respond". |
| `CameraProfileUnavailableException` | The requested profile does not exist or cannot be streamed. | 404 "Stream profile is not available" (the profile id is not echoed). |

Everything else:

- Logs never carry `error.name` or `error.message` of a provider error, because a provider controls both. The module
  logs a fixed class label instead (`errorName()`): the module's own exception classes and `CameraProviderTimeoutError`
  by their class names, any other `Error` as `ProviderError`, anything else as `UnknownError`.
- Any other error a provider throws is wrapped as `CameraUpstreamException` (503 "Camera did not respond"). That
  includes untyped errors and every other `CamerasException` a provider might throw: `CamerasNotFoundException`,
  `CamerasForbiddenException`, the base `CamerasException` and `CameraUpstreamException` itself. A provider cannot
  produce a 404 for a camera or a 403 for the caller. The original message is never logged or forwarded because a
  provider may embed a source URL in it; the log line carries the device id and the error class name only.
- Controller responses never contain a provider-originated message. Only messages the module creates itself (such as
  "Camera <id> not found" for an unknown or non-camera device) appear in a response body.
- A provider call that takes longer than 10 seconds (`CAMERA_PROVIDER_TIMEOUT_MS`) ends the wait for the caller as
  `CameraProviderTimeoutError` and is answered with 503. The module aborts the `AbortSignal` it passed to the call, but
  it does not guarantee that the call stops (see Provider obligations).
- A snapshot whose media type (the content type before `;`, trimmed and lower-cased, so `image/jpeg; charset=binary` is
  accepted) is not `image/jpeg`, `image/png` or `image/webp`, or whose data is empty, is rejected
  as `CameraUpstreamException('Camera returned an invalid image')` (503).

### `getSnapshotMinIntervalMs`

Optional. Returns the shortest interval, in milliseconds, between two real snapshot calls for a device. A value that
is not a finite number or is below 250 ms, and a hook that throws, fall back to the 2000 ms default. The same
interval is the window during which a failed snapshot is remembered (see Snapshot cache).

### Provider obligations

- `listProfiles` must answer from local state without an upstream request. The module calls it on every list, detail
  and session request, and on a snapshot cache miss that names a `profile`; a provider that asks the camera each time
  would multiply upstream traffic by the number of polling panels.
- A provider whose plugin is disabled should throw `CameraOfflineException` from its calls rather than an untyped
  error, so that clients see "Camera is offline" and failures are throttled as offline.
- A provider plugin must import `CamerasModule` to inject `CameraStreamProviderRegistryService`. The registry is
  injectable whether or not the module is enabled.
- A snapshot with `profile` may take up to two provider timeouts: the profile lookup (`listProfiles`) and the snapshot
  call each get `CAMERA_PROVIDER_TIMEOUT_MS` (10 s), so the request can take up to 20 s before it fails.
- A provider MUST bound its own upstream I/O (connect, read and overall timeouts) and SHOULD stop its work when the
  `signal` passed to `listProfiles`, `resolveSource` or `getSnapshot` aborts. The module's timeout only ends the wait
  for the caller and returns 503; it cannot cancel a call that ignores the signal, which keeps running until it settles
  on its own and whose result is then discarded. To stop such calls from piling up, the snapshot service starts no
  further provider snapshot call for a cache key while an earlier call for that key has timed out and not yet settled:
  requests for it fail with 503 until the provider promise settles.
- Throw only the three typed exceptions above to signal a known condition, and never put a URL, alias or credential in
  any error message.

## Registering a provider

A plugin registers in `onModuleInit` and keeps the `dispose` handle to unregister on shutdown.
`register()` returns `null` when the type is already taken (the first registration is kept) or the registry is closed.

```ts
@Injectable()
export class MyCameraPlatform implements ICameraStreamProvider, OnModuleInit, OnModuleDestroy {
	private registration: Readonly<{ dispose: () => void }> | null = null;

	constructor(private readonly registry: CameraStreamProviderRegistryService) {}

	onModuleInit(): void {
		this.registration = this.registry.register(this);
	}

	onModuleDestroy(): void {
		this.registration?.dispose();
	}

	getType(): string {
		return 'devices-my-plugin';
	}

	// listProfiles, resolveSource, getSnapshot …
}
```

## REST API

All routes live under `/api/v1/modules/cameras/` and require an authenticated user or display. `deviceId` must be a
UUID v4; anything else is 400. Success bodies use the standard response envelope, except the snapshot, which is the
image itself.

| Route | operationId | Result |
|---|---|---|
| `GET /cameras` | `get-cameras-module-cameras` | 200, every visible camera and doorbell with its profiles |
| `GET /cameras/:deviceId` | `get-cameras-module-camera` | 200, one camera; 404 when the device is not a camera |
| `GET /cameras/:deviceId/snapshot?profile=&hq=` | `get-cameras-module-camera-snapshot` | 200 image (`image/jpeg`, `image/png` or `image/webp`) |
| `POST /cameras/:deviceId/sessions` | `create-cameras-module-camera-session` | 201 `CamerasModuleDataSession`; 503 while the relay is not running |
| `GET /status` | `get-cameras-module-status` | 200 `CamerasModuleDataStatus`: relay state and live socket usage |
| `GET /live?session=` (WebSocket upgrade) | not in OpenAPI | 101 and the live socket, see Live WebSocket |

Status codes:

- 400: invalid UUID, invalid query parameters or an invalid session request body (the global validation factory
  answers 400, not 422).
- 403: the caller is not a user or a display.
- 404: unknown camera, a camera without a registered provider, an unknown/unavailable profile, or the module being
  disabled (`Cameras module is disabled`).
- 503: camera offline, busy, did not respond or timed out. The snapshot route adds `Retry-After: 2` when rate limited.
  `POST sessions` also answers 503 `Live view relay is not available` whenever the relay is not `running`: a session
  is only worth issuing when it can be served. Snapshots do not use the relay and keep working.

Snapshot headers: `Content-Type`, `Content-Length`, `Cache-Control: no-store` and, only when the image is stale,
`X-Snapshot-Age` (whole seconds). Query parameters: `profile` (1 to 64 characters) and `hq` (`true` or `false`,
default `false`).

Session request body: `{ "data": { "profile"?: string, "transport": "mse" } }`. Without `profile` the first available
profile is used; with `profile` it must be available. Response data: `session_id`, `url` (a relative
`/api/v1/modules/cameras/live?session=<token>` that must be opened within a minute) and `expires_at`. Clients join
`url` with their configured API base; the backend does not know its public prefix.

## Snapshot cache

`CameraSnapshotService` keeps an in-memory cache and coalesces concurrent requests.

- Cache key: `deviceId:<profileId ?? 'default'>:<hq>`.
- A cached image younger than the provider's minimum interval (default 2000 ms) is served without a provider call
  (`stale: false`, no age header).
- Concurrent requests for the same key while a fetch is running share that single fetch.
- Without `profile` the provider is called with `channelId: undefined`. With `profile` the profile is looked up by id,
  regardless of whether it is available for streaming (snapshots work without an enabled stream), and its `channelId`
  is passed to the provider. An unknown profile id is 404.
- The profile lookup is part of the real fetch: cache hits and joiners make no lookup and no provider call.
- On `CameraRateLimitedException` during the lookup or the snapshot call, a cached image of that key is returned as
  stale (`X-Snapshot-Age`); without one the error is surfaced (503 "Camera is busy").
- On `CameraOfflineException` the cached image of that key is dropped.
- A failure is remembered per cache key for the snapshot minimum interval. During that window the same exception
  class is replayed (offline, busy or did not respond, with the fixed message) without calling the provider, so three
  panels polling an offline camera produce one provider call per interval instead of one per poll. The failures that
  are remembered are offline, rate limited, any other provider failure (including a timeout) and an invalid image. A
  later success clears the memory, and an unknown profile is never remembered. A remembered rate limit does not hide a
  usable cached image: while one exists it is still returned as stale.
- Entries older than 5 minutes (`CAMERA_SNAPSHOT_MAX_AGE_MS`) are never served, not even as stale.
- Cache, failure memory and in-flight keys are `JSON.stringify([deviceId, profileId ?? null, highQuality])`, so an
  omitted profile and a profile literally named `default` never share an entry.
- A provider snapshot call that timed out but has not settled is tracked per key. While it is outstanding, no new call
  is made for that key: the request fails with 503 (the usual timeout path), or gets the stale image when a remembered
  rate limit allows it. The marker is cleared when the provider promise settles, whatever the outcome; its result is
  discarded and never cached.
- A device deletion event evicts every entry and every remembered failure of that device and detaches running
  fetches, so an eviction is not undone by a fetch that finishes afterwards.

## Stream sessions

`CameraSessionService` issues short-lived, single-use sessions that the live gateway exchanges for a stream.

- Token: 32 random bytes, base64url. Only the SHA-256 hex of the token is stored; the raw token is returned once and
  never kept, logged or emitted. The session id (a UUID) is safe to log.
- TTL: 60 seconds (`CAMERA_SESSION_TTL_MS`). Expired sessions are removed on the next `create`.
- Single use: `consume(token)` removes the entry before checking its expiry, so a token works once at most.
- At most 16 pending sessions per owner (`CAMERA_SESSION_MAX_PENDING_PER_OWNER`); the oldest are dropped first.
- Owner kinds: `user` (id of the user) and `display` (id of the display, from a display token).
- Revocation racing creation: the controller takes a ticket (`beginCreate(owner, deviceId)`) before its first await and
  `create` refuses when the device (404) or the owner (403) was revoked after the ticket was issued, so a revocation
  that fires while the profile lookup is pending cannot leave a session behind. Revocations are remembered only while a
  ticket is open and dropped when the last one is released (`endCreate`), so the bookkeeping stays bounded.
- Revocation: four events remove pending sessions, because the auth module emits no logout signal.

  | Event | Effect |
  |---|---|
  | `DevicesModule.Device.Deleted` | revokes every session of that device |
  | `DisplaysModule.Display.Deleted` | revokes the display's sessions |
  | `DisplaysModule.Display.TokenRevoked` | revokes the display's sessions |
  | `UsersModule.User.Deleted` | revokes the user's sessions |

- `CamerasModule.Session.Revoked` is emitted with `{ sessionIds: string[]; reason: 'owner' | 'device' }` whenever a
  revocation removed at least one session. It covers only sessions that have not been consumed yet. A consumed session
  is no longer known to the service, so the live gateway subscribes to the four source events itself to close its open
  sockets (see Live WebSocket).

## Relay (go2rtc)

The module does not decode video. `Go2rtcService` (a managed service of the `cameras-module` owner, service id
`go2rtc`, started only while the module is enabled) provides a go2rtc instance, `Go2rtcStreamsService` registers camera
sources in it, and `LiveStreamGateway` proxies one browser socket to one go2rtc MSE socket. The relay state is read
through `Go2rtcService.getStatus()` and `subscribe()`, never through the event bus: every event-bus event is broadcast to
socket.io clients.

### Modes

`go2rtc.mode` in the module configuration (`PATCH /config/module/cameras-module`, owner only):

| Mode | Behaviour |
|---|---|
| `managed` (default) | The backend runs `binary_path` as a supervised child and talks to it on loopback. |
| `external` | The backend uses a go2rtc instance that already exists at `external_url` and runs nothing. |
| `disabled` | No relay: sessions are refused with 503, snapshots work. |

Other fields: `binary_path` (absolute path whose file name starts with `go2rtc`; default
`GO2RTC_DEFAULT_BINARY_PATH = /usr/local/lib/smart-panel/go2rtc/go2rtc`), `external_url` (http or https URL without
credentials, query or fragment), `max_sessions` (1 to 32, default 8) and `max_sessions_per_camera` (1 to 16, default
4; the effective limit is the smaller of the two). Omitting a field leaves it untouched; an explicit `null` is refused
with 400 for every field except `external_url` (a stored `null` would make the config loader reset the whole cameras
configuration, `enabled` included, to its defaults). `mode: external` with a missing or `null` `external_url` is
refused with 400 by the cross-field check in `CamerasConfigMutationService`, registered with
`ModuleConfigMutationRegistryService` so it also sees a PATCH that changes only one of the two fields.

`GO2RTC_INSTALL_DIR` (`/usr/local/lib/smart-panel/go2rtc`) and `GO2RTC_DEFAULT_BINARY_PATH` are constants in
`cameras.constants.ts`; the installer (UP-4) will place the binary there.

### State and reason

`GET /status` and `Go2rtcService.getStatus()` report `mode`, `state`, `reason`, `version` and an internal `generation`
(+1 on every spawn, every external connect and every mode change). Everything that is not a hard failure to stop the
child resolves `start()` normally, because the extension manager raises an error notification for every rejected
`start()`; the service reports the situation through the status and heals itself on retry or config change.

| State | Reason | When |
|---|---|---|
| `disabled` | `module_disabled` | the module is switched off |
| `disabled` | `mode_disabled` | `mode` is `disabled` |
| `starting` | `null` | the child was spawned and is not ready, or a respawn is waiting out its backoff (then `reason` holds the last failure: `crashed` or `start_timeout`) |
| `running` | `null` | managed: ready, see Identity check; external: the probe succeeded |
| `unavailable` | `binary_path_invalid` | `binary_path` fails validation |
| `unavailable` | `binary_missing` / `binary_not_executable` | the binary does not exist (`ENOENT`, `ENOTDIR`) / cannot be executed (`EACCES`); no retry until the configuration changes |
| `unavailable` | `external_url_missing` | external mode without a valid URL |
| `unavailable` | `external_unreachable` | the external probe failed; re-probed every 30 s |
| `error` | `port_in_use` | something else answers on the managed api port; no retry |
| `error` | `crashed` / `start_timeout` | the fifth consecutive attempt failed, or the child could not be confirmed stopped |

Supervision (managed): readiness within 10 s, polled every 250 ms; the child is restarted after an unexpected exit with
a backoff of 1, 2, 4, 8 and 16 s (five attempts, then `error`; the last five redacted output lines are logged at
`warn`); a run of 60 s resets the attempt counter; a 30 s health probe that fails twice in a row stops the child and
counts as a crash. Stopping sends SIGTERM, then SIGKILL after 5 s, and waits 2 s for the confirmation.

After `error` (including `port_in_use`) the relay does not retry on its own: it recovers only after a change of the go2rtc
configuration or a restart of the service by the extension manager (toggle the module, or restart the backend).
`Go2rtcService.isHealthy()` (shown in the managed service listing) is true while the relay is `running` or its mode is
`disabled`.

### Managed process

- go2rtc listens on `127.0.0.1` only: API `127.0.0.1:11984`, RTSP `127.0.0.1:18554`. `FB_GO2RTC_API_PORT` and
  `FB_GO2RTC_RTSP_PORT` override them. The defaults avoid 1984 and 8554 so a Frigate or Home Assistant go2rtc on the
  same host does not collide. The WebRTC and SRTP listeners are empty (disabled).
- The API and the RTSP server require basic auth with user `smart-panel` and a fresh random password per spawn;
  `api.local_auth: true` makes go2rtc ask for it on loopback too.
- The child gets only `PATH` and `HOME` in its environment and runs with the config directory as its working directory.
- Config file: `<FB_CONFIG_PATH>/go2rtc/go2rtc-<random>.yaml`. The directory is created `0700` (and chmod'ed to `0700`
  if it already existed), the file `0600`. A new file with a new random name and a new password is written on every
  spawn; files of earlier spawns are removed first. At spawn it contains the listeners, the credentials and no stream.
  Its first line is a comment `# smart-panel-instance <secret>`.
- **go2rtc writes registered streams into that file.** `PUT /api/streams` makes go2rtc persist the stream, source URL
  with its camera credentials included, into the config file it was started with. While the relay runs, a 0600 file in a
  0700 directory owned by the service user therefore holds the source URLs (the same exposure as plugin secrets in the
  application config). The file is removed whenever the child stops and regenerated on every spawn, so no source URL
  rests on disk while the relay is down. If the child cannot be confirmed stopped the file stays, because the process
  may still own it.
- Process output is read line by line, redacted (registered secrets first, then any `rtsp`, `rtsps`, `rtspx`, `http`,
  `https`, `ws` or `wss` URL by scheme, then truncated to 1 KiB) and kept in a ring of 64 lines. Nothing from the child
  is logged unredacted. A line that is still unterminated after 16 KiB is never stored in parts (redaction cannot match
  a secret that straddles the cut): one fixed marker line `<output line too long, discarded>` is stored and everything
  up to the next newline is dropped.
- The API password and the instance secret stay registered with the secrets registry until the child has been confirmed
  stopped (exited, output drained), so whatever it prints while shutting down is redacted too. A stop that cannot be
  confirmed keeps them registered.
- "Confirmed stopped" means the child's `close`: it exited and its stdout and stderr are drained, with the unterminated
  tails flushed (redacted) into the ring. `Go2rtcProcessService.stop()` resolves only then; a call between `exit` and
  `close` waits for the `close`, and the process state is kept until it. `isRunning()` turns `false` on `exit`.
- `Go2rtcService.onManagedRunEnded(listener)` reports the generation of a managed run once its child is confirmed
  stopped (after its secrets were released). It is silent for a run whose stop was rejected, whatever the relay status
  says (`error`/`crashed`); such a run is reported by the next confirmed stop. Holders of secrets that the child may
  still print (the streams service) release them on this signal, not on relay availability.

### Identity check

go2rtc v1.9.15 has no `pid` in `GET /api`; it answers `{ version, revision, config_path, host }`. The relay must not
send credentials or camera sources to a different service that happens to hold the api port, so a managed run is only
trusted when both hold:

1. `GET /api` reports `config_path` equal to the exact per-spawn file path (the random name is known only to our child
   and visible only to local users that can list the 0700 directory or read `ps`), and
2. `GET /api/config` (authenticated; go2rtc returns the raw config file) contains the per-spawn instance secret line.
   The secret is only in the 0600 file, never in the process arguments, and is registered as a secret.

The periodic probe re-checks `config_path` (the config text changes once streams are registered). After a failed start
a single unauthenticated `GET /api` decides between `port_in_use` (any HTTP answer: someone else is there) and a counted
failure (silence).

### External mode

The URL carries no credentials (the validation refuses them); the backend sends none. The operator is responsible for
securing that go2rtc (loopback or a trusted network): anyone who can reach it can read the registered streams. The
backend probes `GET /api` every 30 s for the version and reachability. Whenever an external relay becomes `running`,
every stream it holds whose name starts with this installation's prefix (`smart-panel_<installationId>_`) and that this
process does not know is deleted (orphans of an earlier run); every other name, including `smart-panel_*` streams of
another installation sharing the go2rtc, is left alone.

An external go2rtc persists registered streams, source urls included, to its own config file, and it outlives this
backend. The streams must therefore be deleted explicitly: `Go2rtcStreamsService` remembers the client it last saw while
the relay was external and running, and sends a best-effort `DELETE` for every registered stream through it when the
relay stops, is disabled, switches mode or becomes unreachable (`Go2rtcService` has already cleared its own client by
then). A `DELETE` that fails (the relay is unreachable) is not retried; the stream is removed by the orphan sweep the next
time the relay is `running`, and its source stays in the secrets registry until then.

### Installation id

The stream names are scoped by a random 8 character `[a-z0-9]` id kept in `<FB_CONFIG_PATH>/go2rtc/installation-id`
(mode 0600, in the 0700 go2rtc directory). It is created on first use and reused afterwards; content that is not such an
id is replaced. The managed-mode cleanup deletes only the per-spawn `go2rtc-*.yaml` files and never this file. If the
file cannot be written the id lasts for the process only (a warning is logged), so names stay unique but an orphan of an
earlier run is no longer recognised.

### Provider I/O

The relay trusts nothing a provider returns, and it bounds only its own work: the provider call is limited to 10 s
(`CAMERA_PROVIDER_TIMEOUT_MS`), go2rtc HTTP calls to 5 s, and the whole acquisition of a socket (camera lookup, source
resolution, `PUT`) to 20 s (`LIVE_UPSTREAM_ACQUIRE_TIMEOUT_MS`). A provider still MUST bound its own I/O and stop on
`signal`: the module cannot cancel a call that ignores it (see Provider obligations).

The connection's abort signal is forwarded into the acquisition: once the connection closed (client gone, revoked,
relay lost) the camera lookup result is dropped without a registration, no lease is ever acquired for it, and a lease
whose acquisition completes after the close is released at once.

## Stream registration

`Go2rtcStreamsService` registers one go2rtc stream per camera profile while someone watches it. The stream name is
`smart-panel_<installationId>_<deviceId>_<profileId>` (see Installation id); a profile id outside `[A-Za-z0-9_-]{1,64}` is refused as unavailable.

| Situation | Result |
|---|---|
| first `acquire` | `resolveSource`, `toGo2rtcSource`, `PUT /api/streams?name=&src=`; the source URL and its path are added to the secrets registry; reference count 1 |
| `acquire` while that registration is in flight | joins it: one `resolveSource` and one `PUT` |
| `acquire` on a registered entry, also inside the grace period | count + 1, grace timer cleared, no `PUT` |
| last `release` | `DELETE /api/streams?src=<name>` after 30 s (`GO2RTC_STREAM_IDLE_GRACE_MS`), so a reload reuses the stream; then the secrets are released |
| `resolveSource` fails | every joiner rejects; no entry; secrets released; the next `acquire` starts over |
| `PUT` fails, with or without an HTTP status (timeout, reset, or a `400` for a failed config save) | as above, but go2rtc creates the stream before it saves the config (v1.9.15), so it may exist whatever the answer: a compensating `DELETE` is queued behind the `PUT` in the name queue and the secrets stay retained until that `DELETE` is confirmed (`404` counts as deleted) |
| relay `generation` changes or the state leaves `running` | every entry is dropped (no new `PUT`); managed: no `DELETE`, and the secrets of the dropped entries are retained for that generation until its process is confirmed gone (`onManagedRunEnded`), not released with the status change; external (stop, disable, mode change, unreachable): best-effort `DELETE` of every entry through the client the entry was registered on |
| device deleted | its entries are deleted at once, whatever their count |
| external relay becomes `running` | orphan sweep, see External mode |
| module destroy | best-effort `DELETE` of every entry (and the deletions already in flight), bounded by 2 s |
| a `DELETE` fails | the secrets of that stream stay registered (`retained`, keyed by relay and stream name) until a later `DELETE` of the name on that same relay succeeds, the managed process of that generation is confirmed gone (`onManagedRunEnded`; a status change or a new generation is not proof) or, for an external relay only, the module is destroyed (after its bounded `DELETE`s); a managed process's secrets outlive module destroy until its `onManagedRunEnded` signal (destroy keeps that subscription, never waits for it) |

A relay is identified by its generation (managed: every spawn is a new relay) or its normalized base URL (external). A
`DELETE` on one relay never releases what was retained for another: with an external relay A that was left with a
stream it could not delete, a registration and `DELETE` of the same name on relay B leave A's retained secrets in
place until A confirms its own `DELETE` (for example in the orphan sweep after it comes back).

Calls for one stream name run one after another (`PUT` and `DELETE` are queued per name), so the final go2rtc state of a
name is the last call queued even when a drop races a registration. `release()` is idempotent and a no-op after its
entry was dropped.

`toGo2rtcSource` maps what a provider returned. Anything but a plain URL of the declared transport is refused
(`CameraUpstreamException`), so go2rtc source syntax that runs a command (`exec:`, `ffmpeg:`) cannot be reached; control
characters, whitespace and fragments are refused too.

| `transport` | Accepted URL schemes | go2rtc source |
|---|---|---|
| `rtsp` | `rtsp:`, `rtsps:` | unchanged |
| `rtsps-insecure` | `rtsps:`, `rtspx:` | scheme replaced by `rtspx:` (RTSPS without certificate verification) |
| `http` | `http:`, `https:` | unchanged |

## Live WebSocket

`GET /api/v1/modules/cameras/live?session=<token>` upgrades to a WebSocket. It is not a Nest gateway and not a Fastify
route: `LiveStreamGateway` listens for the HTTP server's raw `upgrade` event (the server comes from `HttpAdapterHost`,
so it works in the app and in e2e tests without `AppInstanceHolder`) and leaves every other path alone.

### Handshake

Everything up to and including the 101 runs synchronously inside the `upgrade` event. The reason is engine.io: the
socket.io server of the websocket module ends every upgrade on another path that has not written a byte after one
second. The session is therefore checked from memory (`CameraSessionService.consume`), the 101 is written in the same
tick, and only afterwards does the gateway look up the camera and talk to go2rtc.

| Check | Outcome |
|---|---|
| path is not the live path | untouched, left to other listeners |
| module configuration unreadable / module disabled | raw HTTP 503 / 404, the token is not consumed |
| unknown, expired or already used token | raw HTTP 401; a token works once at most |
| a plain request without `Upgrade`, any method (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`, `HEAD`) | answered with a fixed `426` `{ "error": "upgrade_required" }` with `Upgrade: websocket` by a Fastify `onRequest` hook (`LiveUpgradeRequiredHook`, registered at module init) before body parsing, routing, exception filters and loggers, so even a request that would fail to parse (malformed JSON under `Content-Type: application/json`) never reaches a filter that echoes the url; `CamerasLiveController` (hidden from OpenAPI, public, not throttled, not behind the module guard) is the fallback with the same answer; the session is not consumed |

Refusals at the HTTP level are never upgraded. After the 101, limits are enforced with a close code, because the session
is consumed at that point.

### Client frames

The client may send exactly one text frame, `{ "type": "mse", "value"?: string }` with `value` up to 1024 characters and
no other key. The gateway forwards a message rebuilt from the validated fields, never the raw text,
because go2rtc's decoder matches keys case-insensitively and keeps the last duplicate. A second `mse` request would
add a consumer on the go2rtc socket, so it closes with 1008; reconnect to renegotiate. A binary frame closes with 1003,
any other text frame with 1008. A frame above 4096 bytes is refused by the WebSocket server itself (close 1009). A request sent before the upstream is open is held and sent when it opens.
go2rtc answers a text `{ "type": "mse", "value": "video/mp4; codecs=…" }` and then binary fMP4 fragments. Binary
fragments are relayed unchanged. Of go2rtc's text frames only the `mse` reply is forwarded, rebuilt from its validated
`value` (a string of at most 256 characters from the mime-type alphabet). go2rtc's `{ "type": "error", "value": … }`
frame can carry the camera source (path and query) in its text, so it is never forwarded: it, or an invalid `mse` reply,
closes the socket with 1011 `upstream_failed`; any other text frame is dropped and only a fixed code is logged.

### Close codes

The close reason is always one of these fixed strings; peers' own reasons and error messages are never forwarded.

| Code | Reason | When |
|---|---|---|
| 1001 | `server_shutdown` | the module or the application is shutting down |
| 1003 | `unsupported_data` | the client sent a binary frame |
| 1008 | `protocol_violation` | an invalid or repeated client frame |
| 1011 | `upstream_failed` | the camera lookup, the registration or the go2rtc socket failed before media started |
| 1011 | `upstream_closed` | the go2rtc socket ended while streaming |
| 1013 | `relay_unavailable` | the relay is not running, or its state or generation changed |
| 1013 | `session_limit` | `max_sessions` sockets are open |
| 1013 | `camera_session_limit` | the camera already has `min(max_sessions_per_camera, max_sessions)` sockets |
| 1013 | `slow_consumer` | the client did not drain its buffer for 10 s |
| 4000 | `revoked` | see Revocation |
| 4001 | `module_disabled` | the module was switched off |
| 4002 | `max_lifetime` | the socket was open for 4 hours |

### Limits, lifetime and flow control

- Admission counts open sockets, including ones whose upstream is still connecting.
- A socket lives at most 4 hours (`LIVE_MAX_LIFETIME_MS`).
- The gateway pings every 30 s; a client that has not answered by the next tick is terminated, which frees its slot.
- Backpressure: when more than 4 MiB are buffered for the client the go2rtc socket is paused; resuming happens below
  1 MiB; a client that stays above for 10 s is closed `slow_consumer`. A go2rtc frame above 16 MiB ends the go2rtc socket (`upstream_closed`).
- The go2rtc socket handshake times out after 10 s.

### Revocation

An open socket is no longer known to `CameraSessionService`, so the gateway subscribes itself:

| Event | Effect |
|---|---|
| `DevicesModule.Device.Deleted` | the device's sockets close `revoked` |
| `DisplaysModule.Display.Deleted`, `DisplaysModule.Display.TokenRevoked` | the display's sockets close `revoked` |
| `UsersModule.User.Deleted` | the user's sockets close `revoked` |
| config update of `cameras-module` leaving it disabled or unreadable | every socket closes `module_disabled` |
| config update of any plugin | every watched (device, profile) is re-validated once, in parallel: a provider that is now offline (disabled plugin) or a profile that is no longer available closes its sockets `revoked`, except those admitted under the provider instance that a newer passing check for the same (device, profile) validated (a stale result never closes those; sockets on any other provider, or without one yet, still close) |
| relay status leaves `running`, or the generation changes | every socket closes `relay_unavailable` |

## Status route

`GET /api/v1/modules/cameras/status` (users and displays, module enabled) answers:

```json
{ "data": { "relay": { "mode": "external", "state": "running", "reason": null, "version": "1.9.9" },
            "sessions": { "active": 1, "max": 8, "max_per_camera": 4 } } }
```

`active` is the number of open live sockets. The body never contains a URL, a path or credentials; `version` is
restricted to `[0-9A-Za-z.+-]{1,32}`.

## Secret rule

A `CameraStreamSource.url` carries credentials. It is produced only by `resolveSource`, which the module never calls
for a REST response. The source URL must never be returned to a client. A session token is different: it is returned
once, to the authenticated requester that created the session (the `session` query parameter of the returned relative
URL), as the session contract above describes.

None of the following may reach a log line, a response body, a close reason, an event payload, an error message or the
process output ring: a provider source URL and its path, the go2rtc API password, the per-spawn instance secret, and a
session token. Logs carry ids, stream names, fixed reason codes and error class labels only
(`cameras.secret-hygiene.spec.ts`, and the unit specs of the relay services, guard this).

- go2rtc output is redacted before it is stored or logged (see Managed process); registered secrets are
  literals in `Go2rtcSecretsRegistry`, a counted multiset: each registration has its own handle, and releasing one never
  drops a literal another handle still holds. A registry that is asked to hold a secret shorter than its minimum throws
  rather than leave it unredacted.
- The API password and instance secret never appear in the child's arguments or environment.
- Close reasons are the fixed strings of the close code table.
- **The session token travels in the URL query**, so: the upgrade never passes through Fastify, Fastify's request logger
  is off (`main.ts`), and the gateway logs no URL. A plain request of any method to the live path does reach Fastify, where an
  `onRequest` hook answers a fixed `426` body that contains no part of the request before parsing, routing, filters or
  loggers can see the url (the token is not consumed). A
  remote-access proxy in front of the backend must not log query strings for `/api/v1/modules/cameras/live`.
- Text frames from go2rtc never reach the browser except a rebuilt, validated `mse` reply: go2rtc's `error` frame carries
  the camera source path and query.
- A secret stays registered for as long as the stream it belongs to may exist: external streams are deleted on stop,
  and a failed `DELETE` keeps the secret registered (see Stream registration). Where source URLs live:
  - the backend's process memory (the secrets registry and the sessions);
  - the managed go2rtc's config file (`0600` in a `0700` directory), which holds the registered sources while the relay
    runs and is deleted when it stops;
  - an external go2rtc's own config file and its backups, which are outside this backend's control: it keeps a source
    until the stream is deleted, and operators must protect that file and its backups.

## Not yet implemented

- WebRTC transport (the relay disables its listeners).
- HLS or MP4 output for the panel (UP-15); only MSE is served.
- The installer that ships the go2rtc binary to `GO2RTC_INSTALL_DIR` (UP-4).
