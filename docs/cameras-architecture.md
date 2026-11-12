# Cameras Architecture

Reference for the backend `cameras` module (`apps/backend/src/modules/cameras/`).

## Purpose

The cameras module gives clients one way to list camera and doorbell devices, fetch a still image and open a
short-lived live view session, whatever integration the device comes from. The module does not talk to any camera
itself. An integration plugin registers an `ICameraStreamProvider` for its device `type`; the module routes requests to
the provider that matches the device, caches snapshots and issues sessions.

Cameras are devices with category `camera` or `doorbell`. A camera whose `type` has no registered provider is still
listed, with `live_view: false` and no profiles; its snapshot and session routes answer 404.

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

### Exceptions a provider may throw

From `cameras.exceptions.ts`. Any other error a provider throws is treated as an untyped provider error.

| Exception | Meaning | What the module does |
|---|---|---|
| `CameraOfflineException` | The camera is not reachable. | Snapshot: 503 "Camera is offline" and the cached image of that key is dropped. Session: 503 "Camera did not respond". |
| `CameraRateLimitedException` | The upstream asks the module to back off. | Snapshot: the stale cached image is returned with `X-Snapshot-Age` when one exists, otherwise 503 "Camera is busy" with `Retry-After: 2`. Session: 503 "Camera did not respond". |
| `CameraProfileUnavailableException` | The requested profile does not exist or cannot be streamed. | 404 with the exception message. |

Everything else:

- An untyped provider error (anything that is not a `CamerasException`) is wrapped as `CameraUpstreamException`
  (503 "Camera did not respond"). The original message is never logged or forwarded because a provider may embed a
  source URL in it; only the error class name is logged.
- A provider call that takes longer than 10 seconds (`CAMERA_PROVIDER_TIMEOUT_MS`) is aborted as
  `CameraProviderTimeoutError` and answered with 503.
- A snapshot whose content type is not `image/jpeg`, `image/png` or `image/webp`, or whose data is empty, is rejected
  as `CameraUpstreamException('Camera returned an invalid image')` (503).

### `getSnapshotMinIntervalMs`

Optional. Returns the shortest interval, in milliseconds, between two real snapshot calls for a device. A value that
is not a finite number or is below 250 ms, and a hook that throws, fall back to the 2000 ms default.

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
| `GET /cameras` | `get-cameras-module-cameras` | 200, every camera and doorbell with its profiles |
| `GET /cameras/:deviceId` | `get-cameras-module-camera` | 200, one camera; 404 when the device is not a camera |
| `GET /cameras/:deviceId/snapshot?profile=&hq=` | `get-cameras-module-camera-snapshot` | 200 image (`image/jpeg`, `image/png` or `image/webp`) |
| `POST /cameras/:deviceId/sessions` | `create-cameras-module-camera-session` | 201 `CamerasModuleDataSession` |

Status codes:

- 400: invalid UUID, invalid query parameters or an invalid session request body (the global validation factory
  answers 400, not 422).
- 403: the caller is not a user or a display.
- 404: unknown camera, a camera without a registered provider, or an unknown/unavailable profile.
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
- Entries older than 5 minutes (`CAMERA_SNAPSHOT_MAX_AGE_MS`) are never served, not even as stale.
- A device deletion event evicts every entry of that device and detaches running fetches, so an eviction is not
  undone by a fetch that finishes afterwards.

## Stream sessions

`CameraSessionService` issues short-lived, single-use sessions that the live gateway will exchange for a stream.

- Token: 32 random bytes, base64url. Only the SHA-256 hex of the token is stored; the raw token is returned once and
  never kept, logged or emitted. The session id (a UUID) is safe to log.
- TTL: 60 seconds (`CAMERA_SESSION_TTL_MS`). Expired sessions are removed on the next `create`.
- Single use: `consume(token)` removes the entry before checking its expiry, so a token works once at most.
- At most 16 pending sessions per owner (`CAMERA_SESSION_MAX_PENDING_PER_OWNER`); the oldest are dropped first.
- Owner kinds: `user` (id of the user) and `display` (id of the display, from a display token).
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
for a REST response. The URL, tokens and provider error messages must never be logged, persisted, returned to a client
or emitted in an event. Logs carry ids and error class names only. `cameras.secret-hygiene.spec.ts` guards this.

## Not yet implemented

Planned in the live view work (#1179):

- the go2rtc relay that turns a provider source into a stream,
- the live WebSocket (`/api/v1/modules/cameras/live?session=...`) that consumes a session,
- a camera status route.

Until then a session can be created but its URL does not yet serve a stream.
