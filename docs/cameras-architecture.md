# Cameras Architecture

Reference for the backend `cameras` module (`apps/backend/src/modules/cameras/`).

## Purpose

The cameras module gives clients one way to list camera and doorbell devices, fetch a still image and open a
short-lived live view session, whatever integration the device comes from. The module does not talk to any camera
itself. An integration plugin registers an `ICameraStreamProvider` for its device `type`; the module routes requests to
the provider that matches the device, caches snapshots and issues sessions.

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
| `POST /cameras/:deviceId/sessions` | `create-cameras-module-camera-session` | 201 `CamerasModuleDataSession` |

Status codes:

- 400: invalid UUID, invalid query parameters or an invalid session request body (the global validation factory
  answers 400, not 422).
- 403: the caller is not a user or a display.
- 404: unknown camera, a camera without a registered provider, an unknown/unavailable profile, or the module being
  disabled (`Cameras module is disabled`).
- 503: camera offline, busy, did not respond or timed out. The snapshot route adds `Retry-After: 2` when rate limited.

Snapshot headers: `Content-Type`, `Content-Length`, `Cache-Control: no-store` and, only when the image is stale,
`X-Snapshot-Age` (whole seconds). Query parameters: `profile` (1 to 64 characters) and `hq` (`true` or `false`,
default `false`).

Session request body: `{ "data": { "profile"?: string, "transport": "mse" } }`. Without `profile` the first available
profile is used; with `profile` it must be available. Response data: `session_id`, `url` (a relative
`/api/v1/modules/cameras/live?session=<token>` that must be opened within a minute) and `expires_at`.

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

`CameraSessionService` issues short-lived, single-use sessions that the live gateway will exchange for a stream.

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
  is no longer known to the service, so the live gateway (not yet implemented) subscribes to the four source events
  itself to close its open sockets.

## Secret rule

A `CameraStreamSource.url` carries credentials. It is produced only by `resolveSource`, which the module never calls
for a REST response. The source URL must never be returned to a client. A session token is different: it is returned
once, to the authenticated requester that created the session (the `session` query parameter of the returned relative
URL), as the session contract above describes. Neither the source URL, a session token nor a provider error message
may be logged, persisted or emitted in an event. Logs carry ids and fixed error class labels only.
`cameras.secret-hygiene.spec.ts` guards this.

## Not yet implemented

Planned in the live view work (#1179):

- the go2rtc relay that turns a provider source into a stream,
- the live WebSocket (`/api/v1/modules/cameras/live?session=...`) that consumes a session,
- a camera status route.

Until then a session can be created but its URL does not yet serve a stream.
