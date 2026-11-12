# Cameras — Plan 2: Cameras Module Core (UP-2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A plugin-independent backend `cameras` module: device plugins register a stream provider for their device
type, and clients list cameras, fetch snapshots and open short-lived stream sessions with their normal Bearer token.

**Architecture:** A registry maps a device `type` to an `ICameraStreamProvider`. A snapshot service sits between
the controller and the provider and adds a per-camera cache, in-flight coalescing and a stale fallback. A session
service issues opaque single-use tokens held only in memory and revokes them when their owner or device goes away.
No relay and no WebSocket yet (Plan 3); the session URL this plan returns is the one Plan 3 will serve.

**Tech Stack:** NestJS on Fastify, class-validator, `@nestjs/event-emitter`, Jest, supertest. No new dependency.

**Spec:** `docs/superpowers/specs/2026-10-06-unifi-protect-integration-design.md` §7.2, §9.4, §13.2. Issue #1178.
Roadmap: `docs/superpowers/plans/2026-11-12-cameras-roadmap.md` (§4 contracts; amendments A2, A11; decision Q4).

## Global Constraints

- Branch `feat/cameras-module` from `main`. One PR titled
  `feat(backend): add cameras module with stream provider registry and snapshots`, body `Closes #1178`.
  It may be developed before Plan 1 merges; it does not use the new spec categories.
- Commit messages `<type>(backend): <lowercase imperative subject>`; end with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- TypeScript: tabs, single quotes, semicolons, trailing commas, print width 120. Imports: external first, then
  `../`, then `./`, blank line between groups.
- Identity: `CAMERAS_MODULE_PREFIX = 'cameras'`, `CAMERAS_MODULE_NAME = 'cameras-module'`,
  `CAMERAS_MODULE_API_TAG_NAME = 'Cameras module'`.
- Structural template: `apps/backend/src/modules/notifications`. Controllers: `@ApiTags`, `@ApiOperation` with
  `tags`, `summary`, `description`, `operationId`; Swagger decorators before NestJS decorators; JSON responses are
  `*ResponseModel` extending `BaseSuccessResponseModel<T>`.
- Schema names: `CamerasModuleData*`, `CamerasModuleRes*`, `CamerasModuleReq*`, `CamerasModuleCreateSession`,
  `CamerasModuleUpdateConfig`.
- Wire names are snake_case (`device_id`, `live_view`, `expires_at`).
- Defaults: session TTL `60_000` ms; token 32 random bytes, base64url; snapshot minimum interval `2000` ms;
  provider call timeout `10_000` ms; snapshot cache entry lifetime `300_000` ms; at most `16` pending sessions per
  owner.
- Access: authenticated users (any role) and displays. Long-lived tokens whose `ownerType` is not
  `TokenOwnerType.DISPLAY` get 403 on every route of this module.
- A provider's source URL and any provider error text never reach a log line, a response body or a persisted row.
  Log lines carry the device id, the profile id and an error class name only.
- Never edit generated code; run `pnpm run generate:openapi`.

## Review Focus

1. **A provider that never answers**: the snapshot request fails with 503 after 10 s, the in-flight entry is
   cleared, and the next request calls the provider again. → Task 4.
2. **Three panels requesting the same camera at once**: the provider is called once and all three get the image.
   → Task 4.
3. **A device id that exists but is not a camera or doorbell** (or a camera whose plugin registered no provider):
   404 on detail, snapshot and session routes, never a 500. → Tasks 3, 4, 5.
4. **A provider error whose message contains the stream URL**: the response carries a fixed message and the log
   carries only the error class name. → Task 6.
5. **A session token presented twice, or after 60 s**: `consume` returns `null` both times. → Task 5.

---

### Task 1: Module skeleton and wiring

**Files:**
- Create: `apps/backend/src/modules/cameras/cameras.constants.ts`, `cameras.exceptions.ts`, `cameras.module.ts`, `cameras.openapi.ts`
- Create: `apps/backend/src/modules/cameras/models/config.model.ts`, `dto/update-config.dto.ts`
- Modify: `apps/backend/src/app.module.ts` (imports ~46, router children ~313, module imports ~492; append)
- Test: `apps/backend/src/modules/cameras/cameras.module.spec.ts`

**Interfaces:**
- Produces:
  - constants above, plus `enum EventType { SESSION_REVOKED = 'CamerasModule.Session.Revoked' }`
  - `CamerasConfigModel extends ModuleConfigModel` (`CamerasModuleDataConfig`, `override enabled = true`) and
    `UpdateCamerasConfigDto extends UpdateModuleConfigDto` (`CamerasModuleUpdateConfig`); no own fields yet, Plan 3
    adds them
  - exceptions, all extending `CamerasException extends Error`: `CamerasNotFoundException`,
    `CameraOfflineException`, `CameraRateLimitedException`, `CameraProfileUnavailableException`,
    `CameraUpstreamException`, `CamerasForbiddenException`
  - `CAMERAS_SWAGGER_EXTRA_MODELS` array

- [ ] **Step 1: Write the failing module test.**

```ts
it('registers its config mapping and module metadata', async () => {
	const mapper = { registerMapping: jest.fn() };
	const extensions = { registerModuleMetadata: jest.fn() };
	const swagger = { register: jest.fn() };
	const module = new CamerasModule(swagger as never, mapper as never, extensions as never);
	module.onModuleInit();
	expect(mapper.registerMapping).toHaveBeenCalledWith({
		type: 'cameras-module',
		class: CamerasConfigModel,
		configDto: UpdateCamerasConfigDto,
	});
	expect(extensions.registerModuleMetadata).toHaveBeenCalledWith(expect.objectContaining({ type: 'cameras-module', name: 'Cameras' }));
	expect(swagger.register).toHaveBeenCalledTimes(CAMERAS_SWAGGER_EXTRA_MODELS.length);
});
```

- [ ] **Step 2: Run it.**

Run (from `apps/backend`): `npx jest src/modules/cameras/cameras.module.spec.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Create the files.** `cameras.module.ts` mirrors `notifications.module.ts`: `@ApiTag`, `@Module({
  imports: [DevicesModule, SwaggerModule], … })`, not `@Global()`, exports added in later tasks. Constructor order
  `(swaggerRegistry, modulesMapperService, extensionsService)`.

- [ ] **Step 4: Wire into `app.module.ts`** by appending the import, `{ path: CAMERAS_MODULE_PREFIX, module:
  CamerasModule }` to the modules router children, and `CamerasModule` to the imports list.

- [ ] **Step 5: Run the test and the app-module boot test.**

Run: `npx jest src/modules/cameras && npx jest --config ./test/jest-e2e.json test/notifications.e2e-spec.ts`
Expected: PASS (the e2e run proves the app still boots with the new module).

- [ ] **Step 6: Commit.**

```bash
git add apps/backend/src/modules/cameras apps/backend/src/app.module.ts
git commit -m "feat(backend): add the cameras module skeleton"
```

---

### Task 2: Provider contract and registry

**Files:**
- Create: `apps/backend/src/modules/cameras/platforms/camera-stream.provider.ts`
- Create: `apps/backend/src/modules/cameras/services/camera-stream-provider.registry.service.ts`
- Test: `apps/backend/src/modules/cameras/services/camera-stream-provider.registry.service.spec.ts`
- Modify: `cameras.module.ts` (provider + export)

**Interfaces:**
- Produces: the types of roadmap §4 verbatim (`CameraStreamProfile`, `CameraStreamSource`, `CameraSnapshot`,
  `ICameraStreamProvider`) and

```ts
@Injectable()
export class CameraStreamProviderRegistryService implements OnModuleDestroy {
	register(provider: ICameraStreamProvider): Readonly<{ dispose: () => void }> | null; // null on duplicate type
	get(device: Pick<DeviceEntity, 'type'>): ICameraStreamProvider | null;
	has(device: Pick<DeviceEntity, 'type'>): boolean;
	list(): string[];
}
```

- [ ] **Step 1: Write the failing test.**

```ts
const provider = (type: string): ICameraStreamProvider => ({
	getType: () => type,
	listProfiles: jest.fn(),
	resolveSource: jest.fn(),
	getSnapshot: jest.fn(),
});

it('returns the provider registered for a device type', () => {
	const p = provider('devices-a');
	registry.register(p);
	expect(registry.get({ type: 'devices-a' })).toBe(p);
	expect(registry.has({ type: 'devices-b' })).toBe(false);
	expect(registry.get({ type: 'devices-b' })).toBeNull();
});
it('refuses a second provider for the same type and keeps the first', () => {
	const first = provider('devices-a');
	registry.register(first);
	expect(registry.register(provider('devices-a'))).toBeNull();
	expect(registry.get({ type: 'devices-a' })).toBe(first);
});
it('dispose removes only its own registration', () => {
	const handle = registry.register(provider('devices-a'));
	handle!.dispose();
	const second = provider('devices-a');
	registry.register(second);
	handle!.dispose();
	expect(registry.get({ type: 'devices-a' })).toBe(second);
});
it('is empty after module destroy and accepts no registration', () => {
	registry.register(provider('devices-a'));
	registry.onModuleDestroy();
	expect(registry.list()).toEqual([]);
	expect(registry.register(provider('devices-b'))).toBeNull();
});
```

- [ ] **Step 2: Run it.** `npx jest src/modules/cameras/services/camera-stream-provider.registry.service.spec.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement** the contract file and the registry. The registry follows
  `modules/devices/services/platform.registry.service.ts` (`registerOwned` record with identity check); `get` does
  not log a warning on a miss, because "no provider" is a normal state for a camera.

- [ ] **Step 4: Run it.** Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add apps/backend/src/modules/cameras
git commit -m "feat(backend): add the camera stream provider registry"
```

---

### Task 3: Camera listing

**Files:**
- Create: `apps/backend/src/modules/cameras/models/camera.model.ts`, `models/cameras-response.model.ts`
- Create: `apps/backend/src/modules/cameras/services/cameras.service.ts`
- Create: `apps/backend/src/modules/cameras/controllers/cameras.controller.ts`
- Create: `apps/backend/src/modules/cameras/cameras.utils.ts`
- Test: `services/cameras.service.spec.ts`, `controllers/cameras.controller.spec.ts`, `cameras.utils.spec.ts`

**Interfaces:**
- Consumes: `CameraStreamProviderRegistryService` (Task 2); `DevicesService.findAll()`, `DevicesService.findOne(id)`.
- Produces:

```ts
// cameras.utils.ts
export interface CameraSessionOwner { kind: 'user' | 'display'; id: string }
export function resolveCameraOwner(req: AuthenticatedRequest): CameraSessionOwner; // throws CamerasForbiddenException

// cameras.service.ts
export class CamerasService {
	findAll(): Promise<CameraModel[]>;
	getOneOrThrow(deviceId: string): Promise<{ device: DeviceEntity; provider: ICameraStreamProvider | null }>; // CamerasNotFoundException
	getProviderOrThrow(deviceId: string): Promise<{ device: DeviceEntity; provider: ICameraStreamProvider }>; // CamerasNotFoundException
	resolveProfile(device: DeviceEntity, provider: ICameraStreamProvider, profileId?: string): Promise<CameraStreamProfile>; // CameraProfileUnavailableException
	toModel(device: DeviceEntity, provider: ICameraStreamProvider | null): Promise<CameraModel>;
}
```

- Models: `CameraStreamProfileModel` (`CamerasModuleDataStreamProfile`: `id`, `channel_id`, `width`, `height`,
  `fps`, `video_codec`, `audio_codec`, `available`, `unavailable_reason`; the five middle fields nullable),
  `CameraModel` (`CamerasModuleDataCamera`: `device_id`, `name`, `category`, `type`, `live_view`, `profiles`),
  `CameraResponseModel` (`CamerasModuleResCamera`), `CamerasResponseModel` (`CamerasModuleResCameras`).
- Routes on `@Controller('cameras')`: `GET /` (operationId `get-cameras-module-cameras`), `GET /:deviceId`
  (`get-cameras-module-camera`, `ParseUUIDPipe` version 4).

- [ ] **Step 1: Write the failing tests.**

```ts
// cameras.utils.spec.ts
it('maps a user', () => expect(resolveCameraOwner({ auth: { type: 'user', id: 'u1', role: UserRole.USER } } as never)).toEqual({ kind: 'user', id: 'u1' }));
it('maps a display token', () =>
	expect(resolveCameraOwner({ auth: { type: 'token', tokenId: 't1', ownerType: TokenOwnerType.DISPLAY, ownerId: 'd1', role: UserRole.USER } } as never)).toEqual({ kind: 'display', id: 'd1' }));
it.each([TokenOwnerType.THIRD_PARTY, TokenOwnerType.MCP, TokenOwnerType.USER])('rejects a %s long-lived token', (ownerType) =>
	expect(() => resolveCameraOwner({ auth: { type: 'token', tokenId: 't', ownerType, ownerId: 'x', role: UserRole.USER } } as never)).toThrow(CamerasForbiddenException));
it('rejects a display token without an owner and a request without auth', () => {
	expect(() => resolveCameraOwner({ auth: { type: 'token', tokenId: 't', ownerType: TokenOwnerType.DISPLAY, ownerId: null, role: UserRole.USER } } as never)).toThrow(CamerasForbiddenException);
	expect(() => resolveCameraOwner({} as never)).toThrow(CamerasForbiddenException);
});

// cameras.service.spec.ts — devices: camera 'c1' (type 'devices-a'), doorbell 'd1' (type 'devices-b'), light 'l1'
it('lists only camera and doorbell devices', async () => {
	expect((await service.findAll()).map((c) => c.deviceId)).toEqual(['c1', 'd1']);
});
it('reports live_view and profiles from the provider', async () => {
	providerA.listProfiles.mockResolvedValue([{ id: 'medium', channelId: 'ch1', available: true }]);
	const [camera, doorbell] = await service.findAll();
	expect(camera.liveView).toBe(true);
	expect(camera.profiles).toEqual([expect.objectContaining({ id: 'medium', channelId: 'ch1', available: true })]);
	expect(doorbell.liveView).toBe(false);
	expect(doorbell.profiles).toEqual([]);
});
it('lists a camera with empty profiles when its provider throws', async () => {
	providerA.listProfiles.mockRejectedValue(new Error('rtsps://console:7441/SECRETALIAS'));
	const [camera] = await service.findAll();
	expect(camera.liveView).toBe(true);
	expect(camera.profiles).toEqual([]);
});
it('getOneOrThrow rejects unknown ids and non-camera devices', async () => {
	await expect(service.getOneOrThrow('missing')).rejects.toBeInstanceOf(CamerasNotFoundException);
	await expect(service.getOneOrThrow('l1')).rejects.toBeInstanceOf(CamerasNotFoundException);
});
it('getProviderOrThrow rejects a camera without a provider', async () => {
	await expect(service.getProviderOrThrow('d1')).rejects.toBeInstanceOf(CamerasNotFoundException);
});
it('resolveProfile picks the requested profile, defaults to the first available, and rejects unavailable ones', async () => {
	providerA.listProfiles.mockResolvedValue([
		{ id: 'high', channelId: 'ch1', available: false, unavailableReason: 'stream_not_enabled' },
		{ id: 'medium', channelId: 'ch1', available: true },
	]);
	expect((await service.resolveProfile(camera, providerA)).id).toBe('medium');
	expect((await service.resolveProfile(camera, providerA, 'medium')).id).toBe('medium');
	await expect(service.resolveProfile(camera, providerA, 'high')).rejects.toBeInstanceOf(CameraProfileUnavailableException);
	await expect(service.resolveProfile(camera, providerA, 'nope')).rejects.toBeInstanceOf(CameraProfileUnavailableException);
});
```

  The controller spec asserts: `GET /` returns `CamerasResponseModel` with `data` from `findAll`; `GET /:id` maps
  `CamerasNotFoundException` to `NotFoundException`; both call `resolveCameraOwner` and map
  `CamerasForbiddenException` to `ForbiddenException`.

- [ ] **Step 2: Run them.** `npx jest src/modules/cameras` Expected: FAIL.

- [ ] **Step 3: Implement** utils, models, service and controller. `findAll` filters `DevicesService.findAll()` in
  memory on `category`; provider calls for the list run in parallel with `Promise.all`, each wrapped in the 10 s
  timeout and the catch that yields empty profiles. Add models to `CAMERAS_SWAGGER_EXTRA_MODELS`, the controller
  and service to the module.

- [ ] **Step 4: Run them.** Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add apps/backend/src/modules/cameras
git commit -m "feat(backend): list cameras with their stream profiles"
```

---

### Task 4: Snapshots with cache, coalescing and stale fallback

**Files:**
- Create: `apps/backend/src/modules/cameras/services/camera-snapshot.service.ts`
- Modify: `controllers/cameras.controller.ts` (snapshot route), `cameras.module.ts`
- Test: `services/camera-snapshot.service.spec.ts`, `controllers/cameras.controller.spec.ts`

**Interfaces:**
- Consumes: `CamerasService.getProviderOrThrow`, `resolveProfile` (Task 3).
- Produces:

```ts
export interface CameraSnapshotResult { contentType: string; data: Buffer; ageMs: number; stale: boolean }

export class CameraSnapshotService {
	getSnapshot(deviceId: string, options: { profileId?: string; highQuality?: boolean }): Promise<CameraSnapshotResult>;
	evict(deviceId: string): void;
	@OnEvent(DevicesEventType.DEVICE_DELETED) onDeviceDeleted(device: { id: string }): void;
}
```

- Route: `GET cameras/:deviceId/snapshot` with query `profile` (string, optional) and `hq` (`'true'`/`'false'`,
  optional), operationId `get-cameras-module-camera-snapshot`, `@ApiBinarySuccessResponse({ 'image/jpeg': { type:
  'string', format: 'binary' } }, …)`, `@Res() res: FastifyReply`. Headers: `Content-Type`, `Content-Length`,
  `Cache-Control: no-store`, and `X-Snapshot-Age: <whole seconds>` only when `stale` is true. Pattern:
  `modules/buddy/controllers/buddy-conversations.controller.ts:308-350`.
- Error mapping in the controller: `CamerasNotFoundException` → 404; `CameraProfileUnavailableException` → 404;
  `CameraOfflineException` → 503 `Camera is offline`; `CameraRateLimitedException` with no cached image → 503
  `Camera is busy` plus `Retry-After: 2`; `CameraUpstreamException` → 503 `Camera did not respond`.

Cache rules (one entry per `deviceId:channelId:hq`):

| Situation | Result |
|---|---|
| entry younger than the minimum interval | cached image, `stale: false`, provider not called |
| a call for the same key is in flight | join it |
| provider succeeds | store, return `stale: false`, `ageMs: 0` |
| provider throws `CameraRateLimitedException`, entry exists | cached image, `stale: true`, `ageMs` = age |
| provider throws `CameraOfflineException` | drop the entry, rethrow |
| provider throws anything else, or exceeds 10 s | `CameraUpstreamException`; entry kept |
| entry older than 300 s | never served, removed on access |

The minimum interval is `provider.getSnapshotMinIntervalMs?.(device)` when it returns a finite number ≥ 250,
otherwise 2000.

- [ ] **Step 1: Write the failing service test** with Jest fake timers.

```ts
const jpeg = (n: number) => ({ contentType: 'image/jpeg', data: Buffer.from([0xff, 0xd8, n]) });

it('calls the provider once for concurrent requests', async () => {
	let release!: (v: CameraSnapshot) => void;
	provider.getSnapshot.mockReturnValue(new Promise((r) => (release = r)));
	const all = Promise.all([service.getSnapshot('c1', {}), service.getSnapshot('c1', {}), service.getSnapshot('c1', {})]);
	await flush();
	release(jpeg(1));
	const results = await all;
	expect(provider.getSnapshot).toHaveBeenCalledTimes(1);
	expect(results.map((r) => r.data[2])).toEqual([1, 1, 1]);
});
it('serves the cached image inside the minimum interval and refetches after it', async () => {
	provider.getSnapshot.mockResolvedValueOnce(jpeg(1)).mockResolvedValueOnce(jpeg(2));
	await service.getSnapshot('c1', {});
	jest.advanceTimersByTime(1999);
	expect((await service.getSnapshot('c1', {})).data[2]).toBe(1);
	jest.advanceTimersByTime(2);
	expect((await service.getSnapshot('c1', {})).data[2]).toBe(2);
	expect(provider.getSnapshot).toHaveBeenCalledTimes(2);
});
it('uses the provider interval when it is valid and ignores one below 250 ms', async () => { /* 5000 honoured; 10 → 2000 */ });
it('keeps separate entries per profile channel and quality', async () => { /* hq true vs false → 2 provider calls */ });
it('passes channelId of the resolved profile and highQuality to the provider', async () => {
	await service.getSnapshot('c1', { profileId: 'package', highQuality: true });
	expect(provider.getSnapshot).toHaveBeenCalledWith(device, { channelId: 'ch-package', highQuality: true });
});
it('returns the last image as stale while the provider is rate limited', async () => {
	provider.getSnapshot.mockResolvedValueOnce(jpeg(1)).mockRejectedValueOnce(new CameraRateLimitedException('x'));
	await service.getSnapshot('c1', {});
	jest.advanceTimersByTime(7000);
	const result = await service.getSnapshot('c1', {});
	expect(result).toMatchObject({ stale: true, ageMs: 7000 });
	expect(result.data[2]).toBe(1);
});
it('rethrows rate limiting when nothing is cached', async () => {
	provider.getSnapshot.mockRejectedValue(new CameraRateLimitedException('x'));
	await expect(service.getSnapshot('c1', {})).rejects.toBeInstanceOf(CameraRateLimitedException);
});
it('drops the cache when the camera goes offline', async () => {
	provider.getSnapshot.mockResolvedValueOnce(jpeg(1)).mockRejectedValueOnce(new CameraOfflineException('x')).mockRejectedValueOnce(new CameraRateLimitedException('x'));
	await service.getSnapshot('c1', {});
	jest.advanceTimersByTime(3000);
	await expect(service.getSnapshot('c1', {})).rejects.toBeInstanceOf(CameraOfflineException);
	jest.advanceTimersByTime(3000);
	await expect(service.getSnapshot('c1', {})).rejects.toBeInstanceOf(CameraRateLimitedException);
});
it('fails after 10 s, clears the in-flight call and retries on the next request', async () => {
	provider.getSnapshot.mockReturnValueOnce(new Promise(() => undefined)).mockResolvedValueOnce(jpeg(2));
	const pending = service.getSnapshot('c1', {});
	jest.advanceTimersByTime(10_000);
	await expect(pending).rejects.toBeInstanceOf(CameraUpstreamException);
	expect((await service.getSnapshot('c1', {})).data[2]).toBe(2);
});
it('wraps unknown provider errors without their message', async () => {
	provider.getSnapshot.mockRejectedValue(new Error('rtsps://console:7441/SECRETALIAS'));
	await expect(service.getSnapshot('c1', {})).rejects.toMatchObject({ name: 'CameraUpstreamException', message: expect.not.stringContaining('SECRETALIAS') });
});
it('never serves an entry older than 300 s', async () => { /* cached, +300_001 ms, rate limited → rejects */ });
it('evicts every entry of a deleted device', async () => { /* cache, onDeviceDeleted({ id: 'c1' }), rate limited → rejects */ });
it('rejects a non-JPEG or empty provider result', async () => {
	provider.getSnapshot.mockResolvedValue({ contentType: 'text/html', data: Buffer.from('<html>') });
	await expect(service.getSnapshot('c1', {})).rejects.toBeInstanceOf(CameraUpstreamException);
});
```

  Fill the four commented tests with the same style. Accepted content types: `image/jpeg`, `image/png`,
  `image/webp`; the body must be non-empty.

- [ ] **Step 2: Run it.** `npx jest src/modules/cameras/services/camera-snapshot.service.spec.ts` Expected: FAIL.

- [ ] **Step 3: Implement the service.** Use `Date.now()` for ages so fake timers control them; clear the timeout
  timer on settle and `unref` it.

- [ ] **Step 4: Run it.** Expected: PASS.

- [ ] **Step 5: Add controller tests** for the header and status mapping listed under Interfaces (one test per
  row, including `X-Snapshot-Age: 7` for `ageMs: 7000` and its absence when fresh), then implement the route.

- [ ] **Step 6: Run the module tests.** `npx jest src/modules/cameras` Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add apps/backend/src/modules/cameras
git commit -m "feat(backend): serve cached camera snapshots"
```

---

### Task 5: Stream sessions and revocation

**Files:**
- Create: `apps/backend/src/modules/cameras/services/camera-session.service.ts`
- Create: `apps/backend/src/modules/cameras/dto/create-session.dto.ts`, `models/session.model.ts`
- Modify: `controllers/cameras.controller.ts` (sessions route), `models/cameras-response.model.ts`, `cameras.module.ts` (export the service)
- Test: `services/camera-session.service.spec.ts`, `controllers/cameras.controller.spec.ts`

**Interfaces:**
- Consumes: `CameraSessionOwner`, `resolveCameraOwner`, `CamerasService.getProviderOrThrow`, `resolveProfile`.
- Produces (Plan 3 consumes `consume` and the revocation event):

```ts
export type CameraSessionTransport = 'mse';
export interface CameraStreamSession {
	id: string; // uuid v4, safe to log and return
	deviceId: string;
	profileId: string;
	transport: CameraSessionTransport;
	owner: CameraSessionOwner;
	expiresAt: number; // epoch ms
}
export interface CameraSessionRevokedEvent { sessionIds: string[]; reason: 'owner' | 'device' }

export class CameraSessionService {
	create(input: Omit<CameraStreamSession, 'id' | 'expiresAt'>): { session: CameraStreamSession; token: string };
	consume(token: string): CameraStreamSession | null; // single use
	revokeByOwner(owner: CameraSessionOwner): void;
	revokeByDevice(deviceId: string): void;
}
```

- DTO `CreateCameraSessionDto` (`CamerasModuleCreateSession`): `profile?: string` (1–64 chars),
  `transport: 'mse'` (`@IsIn(['mse'])`); wrapper `ReqCreateCameraSessionDto` (`CamerasModuleReqCreateSession`) with
  `data`.
- Model `CameraSessionModel` (`CamerasModuleDataSession`): `session_id`, `url`, `expires_at` (ISO 8601);
  `CameraSessionResponseModel` (`CamerasModuleResSession`).
- Route `POST cameras/:deviceId/sessions`, operationId `create-cameras-module-camera-session`,
  `@ApiCreatedSuccessResponse`. `url` is `/api/v1/modules/cameras/live?session=<token>` (relative; the client
  resolves it against its own origin, which keeps it valid behind remote-access proxies and the Home Assistant
  ingress prefix).
- Events handled: `DevicesModule.Device.Deleted` (payload has `id`) → `revokeByDevice`;
  `DisplaysModule.Display.Deleted` and `DisplaysModule.Display.TokenRevoked` (payload `{ id }`) → `revokeByOwner({
  kind: 'display', id })`; `UsersModule.User.Deleted` (payload is the user entity) → `revokeByOwner({ kind: 'user',
  id })`. Each revocation that removed at least one session emits `EventType.SESSION_REVOKED` with
  `CameraSessionRevokedEvent`.

Storage: a `Map` keyed by the SHA-256 hex of the token; the token itself is never stored.

- [ ] **Step 1: Write the failing service test** with fake timers.

```ts
const input = { deviceId: 'c1', profileId: 'medium', transport: 'mse' as const, owner: { kind: 'user' as const, id: 'u1' } };

it('issues a 43-character base64url token and a uuid session id', () => {
	const { session, token } = service.create(input);
	expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
	expect(session.id).toMatch(/^[0-9a-f-]{36}$/);
	expect(session.expiresAt - Date.now()).toBe(60_000);
});
it('consumes a token exactly once', () => {
	const { session, token } = service.create(input);
	expect(service.consume(token)).toEqual(session);
	expect(service.consume(token)).toBeNull();
});
it('rejects an expired token', () => {
	const { token } = service.create(input);
	jest.advanceTimersByTime(60_001);
	expect(service.consume(token)).toBeNull();
});
it.each(['', 'x', 'a'.repeat(43), 'a'.repeat(5000)])('rejects the unknown token %#', (token) => {
	expect(service.consume(token)).toBeNull();
});
it('does not keep the raw token in memory', () => {
	const { token } = service.create(input);
	expect(JSON.stringify([...(service as never as { sessions: Map<string, unknown> }).sessions.entries()])).not.toContain(token);
});
it('revokes by owner and by device and reports the session ids', () => {
	const a = service.create(input);
	const b = service.create({ ...input, deviceId: 'c2' });
	const c = service.create({ ...input, owner: { kind: 'display', id: 'u1' } });
	service.revokeByOwner({ kind: 'user', id: 'u1' });
	expect(emitter.emit).toHaveBeenCalledWith('CamerasModule.Session.Revoked', { sessionIds: [a.session.id, b.session.id], reason: 'owner' });
	expect(service.consume(a.token)).toBeNull();
	expect(service.consume(c.token)).not.toBeNull();
});
it('does not emit when nothing was revoked', () => {
	service.revokeByDevice('nobody');
	expect(emitter.emit).not.toHaveBeenCalled();
});
it('drops the oldest pending session of an owner beyond 16', () => {
	const first = service.create(input);
	for (let i = 0; i < 16; i++) service.create(input);
	expect(service.consume(first.token)).toBeNull();
});
it('removes expired sessions when creating new ones', () => {
	for (let i = 0; i < 10; i++) service.create(input);
	jest.advanceTimersByTime(60_001);
	service.create(input);
	expect((service as never as { sessions: Map<string, unknown> }).sessions.size).toBe(1);
});
it.each([
	['DevicesModule.Device.Deleted', { id: 'c1' }],
	['DisplaysModule.Display.Deleted', { id: 'd1' }],
	['DisplaysModule.Display.TokenRevoked', { id: 'd1' }],
	['UsersModule.User.Deleted', { id: 'u1' }],
])('revokes on %s', async (event, payload) => { /* boot a TestingModule with EventEmitterModule, create matching sessions, emit, consume → null */ });
```

- [ ] **Step 2: Run it.** `npx jest src/modules/cameras/services/camera-session.service.spec.ts` Expected: FAIL.

- [ ] **Step 3: Implement the service** with `randomBytes(32).toString('base64url')`, `createHash('sha256')`,
  `randomUUID()`. `consume` deletes the entry before checking expiry.

- [ ] **Step 4: Run it.** Expected: PASS.

- [ ] **Step 5: Add controller tests and the route.** Tests: 201 with `session_id`, `url` starting
  `/api/v1/modules/cameras/live?session=` and an `expires_at` 60 s ahead; the profile defaults through
  `resolveProfile`; unknown device or camera without provider → 404; unavailable profile → 404; `transport: 'hls'`
  → 422 from the validation pipe; a third-party token → 403; the owner passed to `create` equals
  `resolveCameraOwner(req)`.

- [ ] **Step 6: Run the module tests.** `npx jest src/modules/cameras` Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add apps/backend/src/modules/cameras
git commit -m "feat(backend): issue short-lived camera stream sessions"
```

---

### Task 6: Fake provider, secret hygiene and e2e

**Files:**
- Create: `apps/backend/test/support/fake-camera-stream.provider.ts`
- Create: `apps/backend/test/cameras.e2e-spec.ts`
- Test: `apps/backend/src/modules/cameras/cameras.secret-hygiene.spec.ts`

**Interfaces:**
- Produces:

```ts
export const FAKE_CAMERA_SECRET_URL = 'rtsps://fake-console:7441/SENTINELALIAS0123456789?enableSrtp';
export class FakeCameraStreamProvider implements ICameraStreamProvider {
	constructor(type: string);
	mode: 'ok' | 'offline' | 'rate_limited' | 'throw_with_secret';
	snapshotCalls: number;
	// listProfiles → medium (available, channelId = the device's first camera channel id) and high (unavailable, 'stream_not_enabled')
	// getSnapshot → a fixed 2×2 JPEG; resolveSource → { url: FAKE_CAMERA_SECRET_URL, transport: 'rtsps-insecure' }
}
```

- [ ] **Step 1: Write the fake provider.** `throw_with_secret` makes every method reject with
  `new Error(FAKE_CAMERA_SECRET_URL)`.

- [ ] **Step 2: Write the secret-hygiene unit test.** Build the three services with the fake provider in
  `throw_with_secret` mode and a spy on the logger created by `createExtensionLogger`. Call `findAll`,
  `getSnapshot`, and the session controller path. Assert:

```ts
const emitted = JSON.stringify([logSpy.mock.calls, responses, caughtErrors.map((e) => [e.name, e.message])]);
expect(emitted).not.toContain('SENTINELALIAS');
expect(emitted).not.toContain('fake-console:7441');
```

  Also assert that `JSON.stringify(instanceToPlain(await service.findAll()))` in `ok` mode does not contain `rtsp`.

- [ ] **Step 3: Run it.** `npx jest src/modules/cameras/cameras.secret-hygiene.spec.ts`
  Expected: PASS if Tasks 3–5 were implemented to the constraint; a FAIL names the leaking path — fix it there.

- [ ] **Step 4: Write the e2e test** `test/cameras.e2e-spec.ts`. Boot and authenticate exactly as
  `test/notifications.e2e-spec.ts:29-104` (owner, USER-role user, display token). Create a `camera`-category
  device of type `devices-third-party` through `POST /modules/devices/devices` with its required `camera` and
  `device_information` channels, and a `lighting` device. Register `new FakeCameraStreamProvider(
  'devices-third-party')` on `app.get(CameraStreamProviderRegistryService)`. Cases:

  | Request | Expectation |
  |---|---|
  | `GET /modules/cameras/cameras` as user | 200, one camera, `live_view: true`, profiles `medium` and `high`; body has no `rtsp` |
  | same without `Authorization` | 401 |
  | `GET …/cameras/{lightId}` | 404 |
  | `GET …/cameras/{cameraId}/snapshot` as display | 200, `content-type: image/jpeg`, `cache-control: no-store`, body starts `FF D8`, no `x-snapshot-age` |
  | the same request five times in parallel | `provider.snapshotCalls` is 1 |
  | provider `offline` after eviction | 503, JSON error envelope |
  | provider `rate_limited` after a good image and 2.1 s wait | 200 with `x-snapshot-age` |
  | `POST …/cameras/{cameraId}/sessions` `{ data: { transport: 'mse' } }` as user | 201; `url` matches `^/api/v1/modules/cameras/live\?session=[A-Za-z0-9_-]{43}$` |
  | same with `profile: 'high'` | 404 |
  | same with `transport: 'webrtc'` | 422 |
  | create a session, delete the device, then `app.get(CameraSessionService).consume(token)` | `null` |

- [ ] **Step 5: Run it.**

Run: `npx jest --config ./test/jest-e2e.json test/cameras.e2e-spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add apps/backend/test apps/backend/src/modules/cameras
git commit -m "test(backend): cover the cameras module end to end"
```

---

### Task 7: Architecture document, OpenAPI and PR

**Files:**
- Create: `docs/cameras-architecture.md`
- Modify: `apps/admin/src/openapi.constants.ts` (append aliases), `tasks/epics/EPIC-UNIFI-PROTECT.md` (tick UP-2)

- [ ] **Step 1: Write `docs/cameras-architecture.md`** with these sections and nothing speculative: *Purpose*;
  *Provider contract* (the interfaces verbatim, the three exceptions and what each makes the module do,
  `getSnapshotMinIntervalMs`); *Registering a provider* (a ten-line example in a plugin's `onModuleInit`, keeping
  the `dispose` handle); *REST API* (the four routes, headers, status codes); *Snapshot cache* (the rule table of
  Task 4); *Stream sessions* (token, TTL, single use, owner kinds, the four revocation events,
  `CamerasModule.Session.Revoked`); *Secret rule*; *Not yet implemented* (relay, live WebSocket, status route —
  Plan 3).

- [ ] **Step 2: Regenerate and lint the API.**

Run (repo root): `pnpm run generate:openapi && pnpm --filter ./apps/backend run lint:openapi`
Expected: PASS; `spec/api/v1/openapi.json` contains `CamerasModuleResCameras`, `CamerasModuleDataSession`,
`get-cameras-module-camera-snapshot` with an `image/jpeg` response.

- [ ] **Step 3: Append aliases to `apps/admin/src/openapi.constants.ts`**, following the Homey block at lines
  182–210 and 568–575: `CamerasModuleCameraSchema`, `CamerasModuleStreamProfileSchema`, `CamerasModuleSessionSchema`,
  and operation types for the four operation ids.

- [ ] **Step 4: Run every gate.**

```bash
pnpm run lint:js
pnpm run test:unit
pnpm run test:e2e
pnpm --filter ./apps/admin run test:unit
```

Expected: all PASS.

- [ ] **Step 5: Commit, push and open the PR** with the title from Global Constraints. The body states: what the
  module does, that live view arrives with #1179, that third-party and MCP tokens are refused (roadmap Q4), and
  that revocation uses four events because the auth module has no logout signal (roadmap A2).

```bash
git add docs/cameras-architecture.md apps/admin/src/openapi.constants.ts tasks
git commit -m "docs(docs): describe the camera provider contract and session model"
git push -u origin feat/cameras-module
gh pr create --title "feat(backend): add cameras module with stream provider registry and snapshots" --body-file <body>
```
