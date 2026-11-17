# Cameras — Plan 5d: UniFi Protect camera streams and snapshots (UP-10) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every adopted UniFi Protect camera and doorbell gets stream profiles, live view through go2rtc and snapshots
from the cameras module, and its `camera.status` follows the console, while the RTSPS stream alias never leaves backend
memory.

**Architecture:** `UnifiProtectStreamProvider` (`services/protect-stream.provider.ts`) implements the core
`ICameraStreamProvider` and is registered with `CameraStreamProviderRegistryService` for the `devices-unifi-protect`
device type. Every console request goes through the connector's `ProtectApiClient` and its shared rate pacer. A pure
converter (`client/protect-stream-source.ts`) turns the console's `rtsps://…:7441/<alias>?enableSrtp` into a
`rtsps-insecure` source on the configured console host (or `stream_host_override`); the URL is read from the console on
every `resolveSource` and never cached. Only stream *presence* (booleans) is kept, in a leaf store
(`services/protect-stream-availability.store.ts`) that a small refresher service fills and the synchronizer reads, so
the synchronizer stays the only writer of Protect property values and now keeps `camera.status` current.

**Tech Stack:** NestJS 11 on Fastify, TypeORM (SQLite), Jest with fake timers, supertest, the plugin's own HTTPS client
(no new dependency). No spec change, no migration, no new route.

**Spec:** `docs/superpowers/specs/2026-10-06-unifi-protect-integration-design.md` §4.1, §4.3, §6 (D1, D5, D9, "Spike
results (2026-11-14)"), §7.1, §7.2, §9.4, §10.1, §13, §16. Issue #1186 (epic #1175). Roadmap
`docs/superpowers/plans/2026-11-12-cameras-roadmap.md` §4 (provider contract, secret rule) and §5 "Plan 5" UP-10.
Predecessor plans: `2026-11-12-cameras-plan-2-cameras-module.md` (UP-2), `2026-11-13-cameras-plan-3a-relay.md` (UP-3),
`2026-11-15-cameras-plan-5a-protect-adoption.md` (UP-7), `2026-11-15-cameras-plan-5b-protect-realtime.md` (UP-8) and
`2026-11-16-cameras-plan-5c-protect-control.md` (UP-9, format and the synchronizer-only-writer rule C8). Reference
provider: `apps/backend/test/support/fake-camera-stream.provider.ts` (the roadmap's `SimulatorCameraStreamProvider` does
not exist on `main`, amendment A3). UP-2, UP-3, UP-7, UP-8 and UP-9 are merged on `main` (`ee241a75c`); every interface
below is verified on that commit.

---

## Decisions (proposed — need maintainer approval)

The issue, the design, the roadmap and the code disagree or leave these open. The plan is written for each
recommendation; *cost if wrong* says what changes.

**D1. TLS on the camera stream (go2rtc → console :7441).** Verified: the relay is go2rtc **1.9.15**
(`build/go2rtc/pin.env:7`). Its RTSP dialer (`pkg/tcp/dial.go` at tag `v1.9.15`, read with `gh api`) does exactly this:
`rtspx://` → TLS with `InsecureSkipVerify`; `rtsps://` → TLS with `InsecureSkipVerify` **when the host is an IP
address**, otherwise verification against the system roots with `ServerName` = the URL host. There is no pinning, no
custom CA and no separate SNI. The core already rewrites any `rtsps-insecure` source to `rtspx:`
(`modules/cameras/services/go2rtc-source.ts:43-45`) and its `rtsp` transport also accepts `rtsps:` (`:9-13`). The Protect
API connection itself has no unverified mode (`client/protect-tls-policy.ts:25-51`). Whether port 7441 presents the same
certificate as port 443, or the Let's Encrypt certificate under SNI, was **not** measured by UP-0 (design §6 "Not
verified"). Options:
- (a) **`rtsps-insecure` to the configured console host** (go2rtc `rtspx`), never to the host the console wrote into the
  URL (D2). Works on every console today.
- (b) `rtsps://<dns name>:7441` with transport `rtsp` and go2rtc's system-root verification. Only works when the host or
  `tls.server_name` is a DNS name whose certificate is valid on 7441 (unknown) and the go2rtc host resolves it
  (`*.id.ui.direct` answers with a private address; DNS-rebinding protection often blocks that). Impossible in `pinned`
  mode. Not workable as a default.
- (c) A loopback TLS bridge in the plugin: go2rtc gets `rtsp://127.0.0.1:<port>/<alias>`, the plugin opens TLS to
  `<host>:7441` with its own `verify`/`pinned` policy. The strongest option, but it only works if 7441 presents a
  certificate the plugin's policy can trust (unknown), it cannot serve an external go2rtc on another host, and it is a
  new streaming component (backpressure, limits, lifecycle).
- (d) Plain `rtsp://<host>:7447`. Cleartext: a passive LAN observer reads the alias. Whether public-API streams exist on
  7447 is unverified. Rejected.
- (e) Probe 7441 with the plugin's TLS policy, then hand go2rtc `rtspx`. Same unknown certificate as (c), plus a
  check-then-use gap. Rejected.

**Recommendation: (a)**, plus two measurements added to UP-20 (fingerprint of the 7441 leaf by IP without SNI, and with
SNI = `tls.server_name`, compared to the 443 leaf) and a follow-up issue for (c) if 7441 serves a trustable certificate.
**Exact residual risk:** an attacker who can actively intercept TCP traffic from the go2rtc host (the Smart Panel host,
or the external go2rtc host in `external` mode) to `<stream host>:7441` — ARP or DHCP spoofing on the same segment, a
rogue or compromised router on the routed path, or DNS spoofing when the stream host is a name — completes the TLS
handshake with any certificate, receives the alias in the RTSP `DESCRIBE`, sees the video, and can replay the alias for
live access to that quality until the stream is recreated on the console. A passive observer learns nothing (the
session is still TLS). The API key is never on this connection. The readme states it (Task 6). *Cost if wrong:* (c)
replaces `toProtectStreamSource`'s output with a bridge address and adds one service; nothing else in this plan moves.

**D2. Stream host, port and URL shape.** The console writes its own idea of its address into the URL; multi-homed
consoles may write an unreachable interface (design §4.3). Rule (pure, Task 1): parse the console URL; require scheme
`rtsps:`, no userinfo, no fragment, exactly one path segment matching `PROTECT_STREAM_ALIAS_PATTERN`
(`/^[A-Za-z0-9_-]{8,128}$/`), a port 1–65535 (default 7441 when absent); drop the query (`?enableSrtp`, as Home
Assistant does) and the console's host; build `rtsps://<host>:<port>/<alias>` with `host = stream_host_override ??
connected console host` (IPv6 bracketed). Anything else → no source (`CameraUpstreamException`, fixed text). Return
`{ url, transport: 'rtsps-insecure' }`; the core makes it `rtspx://…`. `stream_host_override` already exists
(`models/config.model.ts:124-133`, validated by `IsProtectHost` only in the DTO, `dto/update-config.dto.ts:130-143`), is
read on every call through `ConfigService` (a change needs no reconnect: the connector's `onConfigChanged` ignores it,
`services/protect-connector.service.ts:136-157`) and is re-checked with `isValidProtectHost`; an invalid stored override
fails closed (no source, one rate-limited warning `UniFi Protect stream host override is invalid`) instead of falling
back. With D1 (a) the override changes where the alias is sent, not how it is protected; it is an admin decision. Its
descriptions say "clients use", which is wrong (go2rtc uses it): Task 6 fixes the readme row and both Swagger
descriptions. **Recommendation: as listed.** *Cost if wrong:* one function.

**D3. Alias handling: no alias cache.** The roadmap says "aliases cached in memory only". Verified: the core calls
`resolveSource` once per go2rtc registration, shared by every viewer, and holds the result itself while the stream lives
(`modules/cameras/services/go2rtc-streams.service.ts:288-299`, secrets registered at `:350-379`). Options: (a) a fresh
`GET cameras/{id}/rtsps-stream` on every `resolveSource`, the URL living only in that call frame and the returned
object; (b) a TTL cache of URLs. **Recommendation: (a).** It costs one paced request per stream start, never per viewer.
Rotation (the console recreates a stream), a session reset and a console restart need no invalidation: the next start
reads the current alias. Known limit (core, not this plan): a go2rtc stream already registered keeps its old URL until
the core's 30 s idle grace removes it. Only presence booleans are cached (D4). *Cost if wrong:* a cache is one map in
the availability service.

**D4. Stream availability: what is cached, when it is read, and the rate budget.** The public API sends no frame when a
stream is enabled or disabled; presence is only learnt from `GET rtsps-stream`. Rules:
- The store keeps `{ high, medium, low, package }` booleans plus `readAt` per Protect camera id, in memory; cleared when
  the connector session ends (`onSessionChange(null, …)`).
- Reads (all through `ProtectStreamAvailabilityService.readStreams`, deadline `PROTECT_STREAM_READ_DEADLINE_MS` =
  **8 000 ms**, below the core's 10 s provider timeout, `modules/cameras/services/cameras.service.ts:22`):
  1. every `resolveSource` (D3);
  2. `listProfiles` when the entry is missing or older than `PROTECT_STREAM_AVAILABILITY_TTL_MS` = **60 000 ms**,
     coalesced per camera (one in-flight read, joined by later callers);
  3. the synchronizer reports an **adopted** camera whose state is `CONNECTED` while the store has no entry for it (this is
     the session-start sweep: the prime snapshot reports every adopted camera, `services/protect-synchronizer.service.ts:445-471`)
     or whose previous observed state was not `CONNECTED` (reconnect);
  4. adoption: a successful stream enablement or the preview read writes the store (no extra request).
- Background reads (3) run one at a time in arrival order, de-duplicated per camera, at most
  `PROTECT_STREAM_REFRESH_MAX_QUEUED` = **256** waiting, dropped on session end.
- Budget, all through the one pacer at 80 % of 10 requests/s (8/s): one read per adopted camera per session start
  (sequential, so snapshots and commands interleave), one per camera reconnect, at most one per camera per 60 s from
  camera listings, one per stream start; snapshots at most one per camera, profile and quality per
  `snapshot_min_interval_ms` (core cache). No periodic sweep (YAGNI): a stream disabled on the console while nobody
  watches shows `available` until the next listing, start, reconnect or session.
**Recommendation: as listed.** *Cost if wrong:* constants and triggers in Task 3.

**D5. Profiles.** Verified: the camera object carries no channel list, resolution, frame rate or codec (keys of
`__fixtures__/cameras.json[0]`), and the core picks the first available profile when none is requested
(`cameras.service.ts:78`). Rules:
- Main channel (`camera.main`): `high`, `medium`, `low`, ordered with `default_stream_quality` first, then the others in
  `high, medium, low` order; package channel (`camera.package`, present only when adopted with `hasPackageCamera`):
  `package` last. `channelId` = the Smart Panel channel id of that channel; no width, height, fps or codec.
- `available` = the quality's URL is non-null. Otherwise `unavailableReason` (`PROTECT_PROFILE_UNAVAILABLE_REASONS`):
  `console_unavailable` (connector not connected, or `device.protectNvrId` differs from the connected console),
  `camera_offline` (cached `state` is not `CONNECTED`), `stream_state_unknown` (no availability could be read),
  `stream_not_enabled` (the console reports the quality as `null`). The "hint to enable it" is the machine code; its text
  belongs to the admin (UP-11/UP-12) — the contract has no hint field (amendment A6).
- The provider **never** calls `POST rtsps-stream` (report only, as the issue's default). Enabling stays with adoption
  (D9; `POST adopt` again re-runs it, `services/protect-adoption.service.ts:316`). A provider POST would change console
  configuration as a side effect of opening a camera list.
- `listProfiles` never throws for console or camera state; it throws only for a device that is not a Protect camera
  (`[]` instead, see Task 4).
**Recommendation: as listed.** *Cost if wrong:* the ordering and reason table are one function in Task 4.

**D6. Snapshots.** Verified: `ProtectApiClient.getSnapshot(id, { highQuality, channel, signal, deadlineMs })` exists
(UP-5, `client/protect-api.client.ts:434-467`): paced, retries 408/429 only (`:71`), body capped at
`PROTECT_MAX_IMAGE_BYTES` = 8 MiB (`devices-unifi-protect.constants.ts:35`), rejects a non-`image/*` or empty answer as
`protocol`, and maps the captured "full HD" 400 to `unsupported` (`:106-112`). The core passes the Smart Panel
`channelId` of the profile, not Protect's channel (`modules/cameras/services/camera-snapshot.service.ts:124-131`), caches
per camera/profile/quality and accepts only JPEG, PNG and WebP (`:27`). Rules:
- `channelId` undefined or the `camera.main` channel id → Protect channel omitted (main, as captured); the
  `camera.package` channel id → `channel=package`; any other id → `CameraProfileUnavailableException`.
- `highQuality` sent explicitly: `true` only when requested **and** the cached `featureFlags.supportFullHdSnapshot ===
  true`, else `false` (spike: request HQ only when the flag is true). If the console still answers `unsupported`, one
  retry with `false`.
- No request when the connector is not connected (`CameraOfflineException`) or the cached camera `state` is known and not
  `CONNECTED` (`CameraOfflineException`).
- Deadline `PROTECT_SNAPSHOT_DEADLINE_MS` = **8 000 ms**; the core's `AbortSignal` is passed through.
- No extra size or type check: the client cap and the core's media-type list already apply.
- `getSnapshotMinIntervalMs()` returns the configured `snapshot_min_interval_ms` (500–60 000, default 2 000).
**Recommendation: as listed.** `channel=package` and every snapshot failure other than the HQ 400 are synthetic (no
package camera, no offline camera captured). *Cost if wrong:* one mapping in Task 5.

**D7. Who maintains `camera.status` and `camera.source`.** Verified: UP-7 maps both (`mappings/definitions/properties.yaml:59-85`:
`stream_status: main|package` and `template: 'unifi-protect:{id}:main|package'`) and adoption writes them once
(`services/protect-adoption.service.ts:953-999`); the synchronizer evaluates with `streams: null`
(`services/protect-synchronizer.service.ts:1083`) and syncs only `path` sources (`services/protect-frame-merge.ts:172-182`),
so after adoption `camera.status` never changes, not even when a camera goes offline. Options: (a) the synchronizer
writes stream status, reading availability from the store; (b) the provider writes properties itself. **Recommendation:
(a)** — Plan 5c C8 keeps the synchronizer the only writer of Protect values. Rules: stream-status mappings join the synced
set for a device when its cached `state` is not `CONNECTED` (→ `offline` / `initializing` / `unavailable` by the existing
`streamStatus` rule, `mappings/mapping-evaluator.ts:248-272`) or when the store has an entry for it (→ `available` /
`unavailable`); a `CONNECTED` camera with unknown availability keeps its stored status (never `unavailable` by
ignorance). A store change re-evaluates that camera through a new serial `refreshDevice`. `camera.source` stays
adoption-written: it is a constant identity derived from the Protect id, never a URL (`spec/devices/channels.yaml:2743-2752`),
and needs no maintenance. `in_use` (design §10.1, optional) is not written: the plugin cannot see core sessions. Removal
(`subscribe/devices remove`) keeps UP-8's behaviour (connection state `disconnected`); status follows the next frame.
*Cost if wrong:* (b) would duplicate the diff and baseline logic of `writeChanges`.

**D8. Error mapping.** `ProtectApiError` category → core exception (the core then sanitises and answers 503/404,
`modules/cameras/controllers/cameras.controller.ts:165-185`):

| Category | `resolveSource` | `getSnapshot` | `listProfiles` |
|---|---|---|---|
| `unavailable` (500/502/503/504), `not_found` | `CameraOfflineException` | `CameraOfflineException` (design: 503 ⇒ offline) | profile `stream_state_unknown` |
| `rate_limited` | `CameraRateLimitedException` | `CameraRateLimitedException` (core serves the last image, `X-Snapshot-Age`) | `stream_state_unknown` |
| `unsupported` | — | after the one HQ fallback: `CameraUpstreamException` | — |
| every other category (`timeout`, `unreachable`, `tls_*`, `authentication`, `authorization`, `bad_request`, `protocol`, `cancelled`, `validation`, `version_unsupported`) | `CameraUpstreamException` | `CameraUpstreamException` | `stream_state_unknown` |
| quality `null` / unknown profile id | `CameraProfileUnavailableException` | — | `stream_not_enabled` |

Every thrown exception carries a fixed message from `cameras.exceptions.ts` (`'Camera is offline'`, `'Camera is busy'`,
`'Stream profile is not available'`, `'Camera did not respond'`); a failure is logged once per 60 s per fixed text with
`ProtectFailureLogLimiter` (`UniFi Protect stream request failed (<category>)`). **Recommendation: as listed.** *Cost if
wrong:* one table in `services/protect-stream-errors.ts`.

**D9. Secret hygiene test.** The core hygiene spec (`modules/cameras/cameras.secret-hygiene.spec.ts`) already proves the
module never emits a provider's source with the fake provider; extending it would test the core twice. Options: (a)
a Protect e2e sentinel sweep, like UP-9's last test, over logs, emitted events, every HTTP response the suite saw (camera
list and detail, snapshots, plugin `GET status` and `GET devices`, cameras `GET status`, extensions `GET services`), the
three device tables, every file in the test config directory, and the core `Go2rtcSecretsRegistry` released after the
test; plus unit tests asserting the provider and availability service never log or throw a URL. (b) Extend the core spec.
**Recommendation: (a).** Sentinels: `FAKE_PROTECT_API_KEY`, `FAKE_PROTECT_ALIAS`, `'SENTINELALIAS'`
(`test/support/fake-protect-server.ts:21-26`). *Cost if wrong:* none to the product.

**D10. Scope.** UP-10 only, 7 tasks: source converter; availability store and synchronizer status sync; availability
service; provider profiles and source; snapshots; registration and readme; e2e. Outside the issue's file ownership
(`services/*stream*`, `services/*snapshot*`, plugin registration, tests) and listed in the PR body: the synchronizer
change (D7), one line in adoption (D4.4), `getConsoleHost()` on the connector (D2), the two config descriptions (D2),
`CamerasModule` in the plugin's imports. Out: admin live view and hints (UP-11), wizard stream enablement (UP-12), panel
snapshots (UP-13/UP-14), the TLS bridge (D1 follow-up), hardware acceptance including real 7441 and package-camera
behaviour (UP-20). **Recommendation: as listed.**

### Amendments (issue, design and roadmap vs `main`)

| # | Issue / design / roadmap says | Reality on `main` `ee241a75c` | Consequence |
|---|---|---|---|
| A1 | Convert to `rtspx://<host>:7441/<alias>` in the plugin. | The core rewrites any `rtsps-insecure` source to `rtspx:` (`go2rtc-source.ts:43-45`). | The provider returns `rtsps://…` with `transport: 'rtsps-insecure'`; the declaration, not the scheme, carries the decision (D1, D2). |
| A2 | go2rtc distinguishes verified `rtsps` from unverified `rtspx`. | In go2rtc 1.9.15 `rtsps://<IP>` is unverified too; the core's `rtsp` transport accepts `rtsps:`. | A provider declaring `rtsp` with `rtsps://<ip>` is silently unverified. Not changed here; recorded for a core follow-up. |
| A3 | Simulator provider is the reference implementation. | No `SimulatorCameraStreamProvider` exists. | Reference: `test/support/fake-camera-stream.provider.ts`. |
| A4 | UP-10 adds `camera.status` / `camera.source`. | UP-7 maps and writes both at adoption; nothing updates status afterwards. | UP-10 makes stream status synced (D7); source unchanged. |
| A5 | "Aliases cached in memory only." | `resolveSource` is called once per stream start. | No alias cache at all (D3). |
| A6 | "Unavailable profile with a hint to enable it." | The contract has `unavailableReason` (a code) only. | Code `stream_not_enabled`; the text is UP-11/UP-12's. |
| A7 | Snapshots "sharing the client rate pacer". | `getSnapshot` exists in the client since UP-5 and already uses the pacer. | No client change. |
| A8 | `stream_host_override`: "host clients use". | Unused so far; go2rtc, not a client, uses it. | Descriptions and readme fixed (D2). |
| A9 | Provider calls bounded by the client (30 s default deadline). | The core abandons a provider call after 10 s. | 8 s deadlines (D4, D6). |

---

## Global Constraints

- Branch `feat/unifi-protect-streams`, cut from `main`. One PR titled exactly
  `feat(backend): provide UniFi Protect camera streams and snapshots`, body ending with `Closes #1186`. Never push to
  `main`; the final task writes the PR body to a file and does not push.
- Commits `<type>(<scope>): <lowercase imperative subject>`, header ≤ 100 characters, scope required: `backend` for
  `apps/backend/**`, `tasks` for `tasks/**`; each ends with `Co-Authored-By: <model that wrote it> <noreply@anthropic.com>`.
  The PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- TypeScript: tabs, single quotes, semicolons, trailing commas, print width 120; imports external, then `../`, then `./`,
  blank line between groups.
- Never use the `generic` device category. Never edit generated files (`spec/api/v1/openapi.json`,
  `apps/admin/src/openapi.ts`, `apps/backend/src/spec`, `apps/admin/src/spec`, `apps/panel/lib/api`, `apps/panel/lib/spec`;
  all git-ignored); regenerate them locally only. No spec change and no migration (incremental migrations only, should one
  ever be needed). No new route; the only Swagger change is two `description` texts (D2), which keep the existing
  decorators and order (Swagger decorators before NestJS decorators).
- Allowed console calls: `GET cameras/{id}/rtsps-stream` and `GET cameras/{id}/snapshot` only. Never `POST` or `DELETE`
  `rtsps-stream` from the provider (D5).
- Every console request goes through `ProtectApiClient` and its rate pacer (`client/protect-rate-pacer.ts`, 80 % of the
  advertised 10 requests/s, design §4.3).
- Secret rule (design §4.3, §9.4): the API key and every RTSPS URL or alias never reach a log line, an error message or
  name, a response, a property value, an event, a notification, a database row, the config file or a diagnostic. A URL
  lives only in the `resolveSource` call and the object returned to the core. Errors are `ProtectApiError`s (endpoint
  template and category) or the core's fixed-text exceptions. Sentinels: key `FAKE_PROTECT_API_KEY`, aliases starting
  `SENTINELALIAS` (`test/support/fake-protect-server.ts:21-26`).
- Fixtures: no raw UP-0 capture is committed; any new fixture is synthetic, marked `"_synthetic": true` and listed in
  `__fixtures__/README.md` (this plan adds none).
- Timers are `unref()`ed and cleared on session end and module destroy; unit tests use `jest.useFakeTimers()` and fakes —
  never a real console or network. Integration and e2e tests use `test/support/fake-protect-server.ts` only.
- Setup once per worktree: `pnpm run bootstrap`. Single test files: `pnpm --filter ./apps/backend exec jest <path>`; e2e
  with `--config ./test/jest-e2e.json`; the full unit suite with `TZ=UTC pnpm run test:unit`.

### Verified facts (on `main` `ee241a75c`)

| # | Fact | Where |
|---|---|---|
| F1 | Provider contract: `getType`, `listProfiles(device, { signal? })`, `resolveSource(device, profileId, { signal? })`, `getSnapshot(device, { channelId?, highQuality?, signal? })`, optional `getSnapshotMinIntervalMs(device)`; `CameraStreamSource.transport: 'rtsp' \| 'rtsps-insecure' \| 'http'`. | `modules/cameras/platforms/camera-stream.provider.ts:3-48` |
| F2 | Registry keyed by `device.type`; `register()` returns `{ dispose }` or `null` (closed or taken); exported by `CamerasModule`. | `modules/cameras/services/camera-stream-provider.registry.service.ts:16-46`; `modules/cameras/cameras.module.ts:57-64` |
| F3 | Core: 10 s provider timeout; `GET cameras` calls `listProfiles` for every camera, coalesced per device; default profile = first available; every error sanitised to offline / rate limited / profile unavailable / upstream with fixed text. | `modules/cameras/services/cameras.service.ts:22, 42-48, 71-87, 163-233`; `cameras.exceptions.ts:100-114` |
| F4 | `toGo2rtcSource`: `rtsps-insecure` accepts `rtsps:`/`rtspx:` and returns `rtspx:`; `rtsp` accepts `rtsp:`/`rtsps:`; fragments and `exec:` refused. `resolveSource` once per registration; URL and path held in `Go2rtcSecretsRegistry`. | `modules/cameras/services/go2rtc-source.ts:9-48`; `go2rtc-streams.service.ts:288-299, 350-379` |
| F5 | Snapshots: core passes the profile's `channelId`; cache per camera/profile/hq; accepts `image/jpeg|png|webp`; reads `getSnapshotMinIntervalMs`. | `modules/cameras/services/camera-snapshot.service.ts:27, 124-131, 295` |
| F6 | go2rtc 1.9.15 pinned; `pkg/tcp/dial.go`: `rtspx` or IP host → `InsecureSkipVerify`, else `ServerName` = host; no pinning. | `build/go2rtc/pin.env:7`; upstream `AlexxIT/go2rtc@v1.9.15` |
| F7 | Client: `getRtspsStreams` (SECRET result), `createRtspsStreams` (the stream-creation POST, adoption only), `getSnapshot` (pacer, 8 MiB, `image/*`, `SNAPSHOT_RETRY_STATUSES` 408/429, HQ 400 → `unsupported`), `deadlineMs` call option. | `client/protect-api.client.ts:59-71, 106-112, 359-467, 614` |
| F8 | TLS policy: only `verify` and `pinned`; no unverified mode. Redaction covers `rtsps`/`rtspx` URLs. | `client/protect-tls-policy.ts:25-51`; `client/protect-redaction.ts:7` |
| F9 | Config: `stream_host_override` (model `IsString`, DTO `IsProtectHost`), `default_stream_quality` (`medium`), `snapshot_min_interval_ms` (500–60 000, 2 000); `isValidProtectHost`. Override changes need no restart. | `models/config.model.ts:124-156`; `dto/update-config.dto.ts:130-143`; `validators/protect-config.validators.ts:30-36`; `services/protect-connector.service.ts:136-157` |
| F10 | Connector: `getClient()`, `getConsoleIdentity()`, `onSessionChange()`; the connected host is private (`startedConfig`). | `services/protect-connector.service.ts:64-81, 198-221` |
| F11 | Mappings: channels `camera.main`, `camera.package` (`when hasPackageCamera`); properties `camera_*_status` (`stream_status`) and `camera_*_source` (template). `streamStatus`: `CONNECTING` → `initializing`, `DISCONNECTED` → `offline`, `CONNECTED` → `available` iff a quality is present, else `unavailable`. | `mappings/definitions/channels.yaml:12-25`; `properties.yaml:59-85`; `mappings/mapping-evaluator.ts:104-109, 248-272` |
| F12 | Synchronizer: evaluates with `streams: null`; syncs `path` sources only (existing test `never writes constants, templates or camera status from a frame`); `observeDevices`, `getCachedDevice`, serial `run()`; prime notifies adopted devices only. | `services/protect-synchronizer.service.ts:203-224, 445-471, 1069-1083`; `services/protect-frame-merge.ts:172-182`; `protect-synchronizer.service.spec.ts:251` |
| F13 | Adoption reads availability in the preview and writes stream statuses after `ensureStreams`; re-adoption re-runs it. | `services/protect-mapping-preview.service.ts:196-201`; `services/protect-adoption.service.ts:316, 895-999` |
| F14 | Spec: `camera.status` enum `available, in_use, unavailable, offline, initializing, error`; `camera.source` "never a URL or credential". | `spec/devices/channels.yaml:2733-2752` |
| F15 | Fixtures: `rtsps-stream.json` (captured, only `high`), `cameras.json` (two cameras, `supportFullHdSnapshot: false`), `cameras-doorbell.json` (synthetic; `5f…a02` `hasPackageCamera: true`, both `supportFullHdSnapshot: true`), `snapshot.jpg` (synthetic). | `__fixtures__/` |
| F16 | Fake console: stream URLs `rtsps://127.0.0.1:7441/<sentinel alias>?enableSrtp`, `cameras.json` cameras start with `high`; `setStreams`, `enqueue`, `updateDevice`, `sendFrame`; snapshot ignores `channel`, HQ 400 when unsupported; `requests` record queries. | `test/support/fake-protect-server.ts:21-26, 125-140, 183-222, 291-298, 517-541, 715-725` |
| F17 | Plugin: imports `DevicesModule, ConfigModule, ExtensionsModule, SwaggerModule` (no `CamerasModule`); registers connector and platform at the end of `onModuleInit`; readme row for `stream_host_override`. | `devices-unifi-protect.plugin.ts:79-126, 136-284, 244` |
| F18 | Epic row `UP-10` without `(done)`. | `tasks/epics/EPIC-UNIFI-PROTECT.md:105` |

## Review Focus

Failure modes the spec implies but no acceptance criterion exercises, most likely first; each is pinned by a named test
in the task at the end of the line.

1. **A camera goes offline and comes back**: `camera.status` shows `offline`, then `available` again, without anyone
   opening the camera; no snapshot request is sent while it is offline. → Task 2 `writes offline when a camera
   disconnects`, Task 3 `reads availability when a camera reconnects`, Task 7 `follows a camera offline and back`.
2. **Boot or console reconnect with unknown availability**: a connected camera's status is never flipped to
   `unavailable` by ignorance, and the session start reads each adopted camera once, sequentially. → Task 2 `keeps the
   stored stream status while availability is unknown`, Task 3 `reads each adopted camera once after a session starts`.
3. **The console reports an unreachable address, or an override is set**: the alias goes only to the configured host or
   the override, never to the console's host; an invalid stored override yields no source. → Task 1 `uses the given host,
   never the console's`, Task 4 `fails closed on an invalid stored override`, Task 7 `applies stream_host_override`.
4. **HQ and package snapshots on cameras that cannot serve them**: no 400 loop; HQ only when supported, one fallback;
   an unknown channel id never reaches the console. → Task 5 `requests full HD only when the camera supports it`, `falls
   back once when the console refuses full HD`, `refuses an unknown channel without a request`; Task 7 `asks for the
   package channel and for full HD only where supported`.
5. **A camera list with many cameras, or a burst of snapshot polls**: profile reads are cached for 60 s and coalesced,
   so `GET cameras` does not multiply console requests. → Task 3 `serves availability from the store for 60 s` and
   `joins a read already in flight`; Task 7 `lists profiles without a second console read`.

---

## File structure

All paths under `apps/backend/src/plugins/devices-unifi-protect/` unless stated.

| Path | Responsibility | Task |
|---|---|---|
| `devices-unifi-protect.constants.ts` (modify) | stream constants | 1 |
| `client/protect-stream-source.ts` (new) | pure console URL → `CameraStreamSource` | 1 |
| `services/protect-stream-availability.store.ts` (new) | leaf memory store of presence booleans | 2 |
| `services/protect-frame-merge.ts` (modify) | `streamStatusMappingNames` | 2 |
| `services/protect-synchronizer.service.ts` (modify) | gated stream-status sync, `isAdopted`, `refreshDevice` | 2 |
| `services/protect-adoption.service.ts` (modify, one call) | write the store after a stream read | 2 |
| `services/protect-stream-availability.service.ts` (new) | reads, TTL, triggers, background queue | 3 |
| `services/protect-connector.service.ts` (modify) | `getConsoleHost()` | 4 |
| `services/protect-stream-errors.ts` (new) | D8 mapping | 4 |
| `services/protect-stream.provider.ts` (new) | `UnifiProtectStreamProvider` | 4, 5 |
| `devices-unifi-protect.plugin.ts`, `.plugin.spec.ts`, `models/config.model.ts`, `dto/update-config.dto.ts` (modify) | registration, readme, two descriptions | 6 |
| `apps/backend/test/devices-unifi-protect-streams.e2e-spec.ts` (new) | end to end and sentinel sweep | 7 |
| `tasks/epics/EPIC-UNIFI-PROTECT.md:105` (modify) | `UP-10 (done)` | 7 |

Specs sit next to their source (`*.spec.ts`). Each task ends green and committed.

---

### Task 1: Stream source conversion (pure)

**Files:**
- Create: `client/protect-stream-source.ts`
- Modify: `devices-unifi-protect.constants.ts` (append)
- Test: `client/protect-stream-source.spec.ts`

**Interfaces:**
- Consumes: F4 (`toGo2rtcSource` for the cross-check test), F8, F15.
- Produces:
  ```ts
  // devices-unifi-protect.constants.ts
  export const PROTECT_STREAM_READ_DEADLINE_MS = 8_000;
  export const PROTECT_SNAPSHOT_DEADLINE_MS = 8_000;
  export const PROTECT_STREAM_AVAILABILITY_TTL_MS = 60_000;
  export const PROTECT_STREAM_REFRESH_MAX_QUEUED = 256;
  export const PROTECT_RTSPS_DEFAULT_PORT = 7441;
  export const PROTECT_STREAM_ALIAS_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
  export const PROTECT_PROFILE_UNAVAILABLE_REASONS = ['stream_not_enabled', 'camera_offline', 'console_unavailable', 'stream_state_unknown'] as const;
  export type ProtectProfileUnavailableReason = (typeof PROTECT_PROFILE_UNAVAILABLE_REASONS)[number];

  // client/protect-stream-source.ts
  /** SECRET in and out. Null when the console URL is not a single-alias rtsps URL or the host is not a valid host (D2). Never throws. */
  export function toProtectStreamSource(consoleUrl: unknown, host: string): CameraStreamSource | null;
  ```

- [ ] **Step 1: Write the failing tests** (`protect-stream-source.spec.ts`)

```ts
it('converts the captured URL onto the given host', ...);
// toProtectStreamSource(rtsps-stream.json .high, '192.168.1.1') toEqual { url: 'rtsps://192.168.1.1:7441/REDACTEDALIAS00000', transport: 'rtsps-insecure' }
it('uses the given host, never the console\'s', ...); // console URL host 192.0.2.10, host 'nvr.example' -> url starts 'rtsps://nvr.example:7441/'
it('brackets an IPv6 host and keeps the console port', ...); // 'fd00::1', console ':7443' -> 'rtsps://[fd00::1]:7443/<alias>'
it('defaults the port to 7441', ...);
it.each([
	['rtsp://h:7447/AAAAAAAAAA'], ['http://h/AAAAAAAAAA'], ['rtsps://u:p@h:7441/AAAAAAAAAA'], ['rtsps://h:7441/a/AAAAAAAAAA'],
	['rtsps://h:7441/short'], ['rtsps://h:7441/' + 'A'.repeat(129)], ['rtsps://h:7441/AAAA AAAAAA'], ['rtsps://h:7441/AAAAAAAAAA#x'],
	['rtsps://h:0/AAAAAAAAAA'], [''], [null], [42],
])('refuses %p', ...); // -> null
it('refuses an invalid host', ...); // host 'rtsps://x', '', 'a b' -> null
it('becomes an rtspx source without enableSrtp in go2rtc', ...);
// toGo2rtcSource(toProtectStreamSource(fixture, '192.168.1.1')!) === 'rtspx://192.168.1.1:7441/REDACTEDALIAS00000'
it('is fully redacted by the plugin redactor', ...); // redactProtectText(url, []) does not contain 'REDACTEDALIAS00000'
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/client/protect-stream-source.spec.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** the constants and the function. Parse with `new URL`, check own fields only, validate the
  host with `isValidProtectHost`, build the string by hand (never `URL.toString()` of the console URL, which would keep
  the query).

- [ ] **Step 4: Run to verify pass** — the Step 2 command. Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect
git add apps/backend/src/plugins/devices-unifi-protect
git commit -m "feat(backend): convert UniFi Protect stream addresses into relay sources"
```

---

### Task 2: Availability store and synchronized camera status

**Files:**
- Create: `services/protect-stream-availability.store.ts`
- Modify: `services/protect-frame-merge.ts`, `services/protect-synchronizer.service.ts`, `services/protect-adoption.service.ts` (in `enableStreams`), `devices-unifi-protect.plugin.ts` (provider list only)
- Test: `services/protect-stream-availability.store.spec.ts`, `services/protect-frame-merge.spec.ts`, `services/protect-synchronizer.service.spec.ts`, `services/protect-adoption.service.spec.ts`, `services/protect-realtime.service.spec.ts` (constructor only)

**Interfaces:**
- Consumes: F11, F12, F13; `ProtectStreamAvailability` (`mappings/mapping-evaluator.ts:24`).
- Produces:
  ```ts
  // services/protect-stream-availability.store.ts
  export interface ProtectStreamAvailabilityEntry { availability: Readonly<ProtectStreamAvailability>; readAt: number }
  @Injectable()
  export class ProtectStreamAvailabilityStore {
  	get(cameraId: string): ProtectStreamAvailabilityEntry | null;
  	/** Copies the four booleans; true when they differ from the previous entry (or there was none). */
  	set(cameraId: string, availability: ProtectStreamAvailability, readAt?: number): boolean;
  	clear(): void;
  }

  // services/protect-frame-merge.ts
  /** Names of property mappings whose value source is `stream_status`. */
  export function streamStatusMappingNames(mappings: ProtectResolvedMappings): ReadonlySet<string>;

  // services/protect-synchronizer.service.ts (constructor gains `private readonly streamAvailability: ProtectStreamAvailabilityStore` as the last parameter)
  /** True when the device is adopted (in the index) under that model key or with a null model key. */
  isAdopted(modelKey: string, id: string): boolean;
  /**
   * Serial; re-evaluates the cached object of one adopted device with the current stream availability and writes what
   * changed (frame semantics with an empty partial: event ownership and retries untouched, no cache write, no sequence
   * bump, no observer call). False when not cached, not adopted or a reset intervened.
   */
  refreshDevice(identity: ProtectConsoleIdentity, modelKey: string, id: string): Promise<boolean>;
  ```
- Rules (decided, D7): in `syncDevice`, for `modelKey === 'camera'` the evaluator gets `streams:
  store.get(id)?.availability ?? null`; the synced names are `syncableNames(mappings)` plus
  `streamStatusMappingNames(mappings)` when `raw.state !== 'CONNECTED'` or the store has an entry. `diffMappedValues`
  takes that union (pass the union set; no change to its signature). Template sources stay unsynced. Adoption: in
  `enableStreams`, every non-null availability (`result.availability`, or `prepared.streams` for a `NOT_REQUESTED` or
  failed POST) is written with `store.set(protectDeviceId, …)` before the status write.

- [ ] **Step 1: Write the failing tests**

`protect-stream-availability.store.spec.ts`:
```ts
it('stores copies of the four booleans and reports changes', ...); // set -> true; same again -> false; package flipped -> true; mutating the input does not change get()
it('forgets everything on clear', ...);
it('never keeps anything but booleans', ...); // set with extra keys / string values coerced: get() keys exactly ['high','medium','low','package'], all typeof boolean
```
`protect-frame-merge.spec.ts`:
```ts
it('names the stream status mappings', ...); // real loader: ['camera_main_status', 'camera_package_status']; none of them in syncableMappingNames
```
`protect-synchronizer.service.spec.ts` (existing harness, camera `600cefafd5f365d6f83c4ef3`, doorbell `5f0000000000000000000a02`):
```ts
it('writes offline when a camera disconnects', ...); // prime; frame { state: 'DISCONNECTED' } -> camera.main status 'offline'; store empty
it('writes initializing while a camera connects', ...); // frame { state: 'CONNECTING' } -> 'initializing'
it('keeps the stored stream status while availability is unknown', ...); // CONNECTED frame, store empty -> no status write (the existing test at :251 stays green unchanged)
it('writes available and unavailable from known availability', ...);
// store.set(id, { high: true, … false }); refreshDevice -> 'available'; set all false; refreshDevice -> 'unavailable'
it('writes the package status from the package stream', ...); // doorbell a02: { medium: true, package: false } -> camera.main 'available', camera.package 'unavailable'
it('never writes the source template', ...); // lastWritten source 'stale-source' + refreshDevice -> no source write
it('refreshes nothing for an unadopted or uncached device', ...); // false; properties.update not called
it('reports adoption', ...); // isAdopted('camera', adopted) true; ('camera', unknown) false; ('light', cameraId) false
```
`protect-adoption.service.spec.ts`:
```ts
it('records stream availability for the synchronizer', ...); // after a camera adoption with ENABLED: store.get(id).availability equals the POST result booleans
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/services`
Expected: FAIL (store module not found; `refreshDevice is not a function`).

- [ ] **Step 3: Implement** the store, `streamStatusMappingNames`, the synchronizer members and the adoption call; add
  `ProtectStreamAvailabilityStore` to the plugin's `providers`; update every `new ProtectSynchronizerService(` in specs
  (`protect-synchronizer.service.spec.ts`, `protect-realtime.service.spec.ts`) with a store instance.

- [ ] **Step 4: Run to verify pass**

Run: the Step 2 command, then `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect`
Expected: PASS, including the control platform suite (`syncableMappingNames` is unchanged).

- [ ] **Step 5: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect
git add apps/backend/src/plugins/devices-unifi-protect
git commit -m "feat(backend): keep UniFi Protect camera status in step with device state and streams"
```

---

### Task 3: Stream availability service

**Files:**
- Create: `services/protect-stream-availability.service.ts`
- Modify: `devices-unifi-protect.plugin.ts` (provider list only)
- Test: `services/protect-stream-availability.service.spec.ts`

**Interfaces:**
- Consumes: Task 1 constants; Task 2 store, `isAdopted`, `refreshDevice`; F7, F10, F12 (`observeDevices`,
  `getCachedDevice`); `toStreamAvailability`; `ProtectFailureLogLimiter`.
- Produces:
  ```ts
  @Injectable()
  export class ProtectStreamAvailabilityService implements OnModuleInit, OnModuleDestroy {
  	constructor(connector: ProtectConnectorService, synchronizer: ProtectSynchronizerService, store: ProtectStreamAvailabilityStore);
  	/**
  	 * SECRET result. One paced GET rtsps-stream (deadline PROTECT_STREAM_READ_DEADLINE_MS, caller's signal); stores the
  	 * booleans and, when they changed, queues synchronizer.refreshDevice. Throws ProtectApiError; `unavailable`
  	 * (category) when the connector has no client.
  	 */
  	readStreams(cameraId: string, options?: { signal?: AbortSignal }): Promise<ProtectRtspsStreams>;
  	/** Store entry when younger than the TTL, else one coalesced readStreams; on failure the last entry of any age, or null. Never throws. */
  	getAvailability(cameraId: string, options?: { signal?: AbortSignal }): Promise<ProtectStreamAvailabilityEntry | null>;
  }
  ```
- Rules (decided, D4): `onModuleInit` subscribes `synchronizer.observeDevices` and `connector.onSessionChange`.
  Observer: for `modelKey === 'camera'`, `isAdopted`, `raw.state === 'CONNECTED'` and (no store entry or the last seen
  state for that id was not `CONNECTED`) → enqueue a background read. The last seen state per id is kept in a map
  cleared with the store. Background queue: one read at a time, a camera already queued is not added twice, more than
  `PROTECT_STREAM_REFRESH_MAX_QUEUED` waiting → dropped (no log line per drop; one limited line `UniFi Protect stream
  availability queue is full`). Session end (`null`): `store.clear()`, the last-seen map and the queue are dropped, the
  generation is bumped, a read finishing after it stores nothing. A failed background read logs `UniFi Protect stream
  availability read failed (<category>)` through the limiter. The `getRtspsStreams` result is reduced to booleans in the
  statement that reads it (`toStreamAvailability`), except the value `readStreams` returns. `onModuleDestroy` unsubscribes
  and drops the queue.

- [ ] **Step 1: Write the failing tests** (fake timers; fake connector with session listener and a client whose
  `getRtspsStreams` is a jest mock answering `rtsps-stream.json` with sentinel aliases; fake synchronizer exposing the
  observer, `isAdopted`, `refreshDevice` mocks; real store)

```ts
it('reads each adopted camera once after a session starts', ...);
// observer called for three adopted CONNECTED cameras -> getRtspsStreams calls in order, never two at once (second starts after the first resolves)
it('skips unadopted cameras and other model keys', ...);
it('reads availability when a camera reconnects', ...); // observed DISCONNECTED then CONNECTED with an entry -> one read; CONNECTED again -> none
it('refreshes the camera status only when presence changed', ...); // same booleans -> refreshDevice not called; changed -> called with (identity, 'camera', id)
it('serves availability from the store for 60 s', ...); // getAvailability twice within 59 999 ms -> 1 read; after 60 000 ms -> 2
it('joins a read already in flight', ...); // two concurrent getAvailability -> 1 read, same entry
it('keeps the last entry when a read fails', ...); // rejection 'timeout' after a stored entry -> old entry; without one -> null
it('passes the deadline and the caller\'s signal', ...); // getRtspsStreams(id, { signal, deadlineMs: 8000 })
it('forgets everything when the session ends', ...); // session null -> store empty; pending queue not read; a read in flight resolves and stores nothing
it('bounds the background queue', ...); // 257 cameras observed while the first read hangs -> at most 256 waiting; one warn line
it('never logs or throws a stream address', ...); // logger spies across all tests: no 'SENTINELALIAS', no 'rtsps://'
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/services/protect-stream-availability.service.spec.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** the service and add it to the plugin's `providers`.

- [ ] **Step 4: Run to verify pass** — the Step 2 command. Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect
git add apps/backend/src/plugins/devices-unifi-protect
git commit -m "feat(backend): track which UniFi Protect camera streams are enabled"
```

---

### Task 4: Stream provider — profiles and source

**Files:**
- Create: `services/protect-stream-errors.ts`, `services/protect-stream.provider.ts`
- Modify: `services/protect-connector.service.ts`
- Test: `services/protect-stream-errors.spec.ts`, `services/protect-stream.provider.spec.ts`, `services/protect-connector.service.spec.ts`

**Interfaces:**
- Consumes: F1, F3, F9, F10, F11; Tasks 1–3.
- Produces:
  ```ts
  // services/protect-connector.service.ts
  /** Host of the connected session's configuration; null unless connected. */
  getConsoleHost(): string | null;

  // services/protect-stream-errors.ts
  export type ProtectStreamOperation = 'source' | 'snapshot';
  /** D8. Fixed-text core exceptions only; never reads error.message or error.name. */
  export function toCameraProviderError(error: unknown, operation: ProtectStreamOperation): CamerasException;

  // services/protect-stream.provider.ts
  @Injectable()
  export class UnifiProtectStreamProvider implements ICameraStreamProvider {
  	constructor(connector: ProtectConnectorService, synchronizer: ProtectSynchronizerService, availability: ProtectStreamAvailabilityService, configService: ConfigService);
  	getType(): string; // DEVICES_UNIFI_PROTECT_TYPE
  	listProfiles(device: DeviceEntity, options?: { signal?: AbortSignal }): Promise<CameraStreamProfile[]>;
  	resolveSource(device: DeviceEntity, profileId: string, options?: { signal?: AbortSignal }): Promise<CameraStreamSource>;
  	// getSnapshot and getSnapshotMinIntervalMs: Task 5 (this task throws CameraUpstreamException from getSnapshot)
  }
  ```
- Rules (decided, D2, D3, D5, D8):
  1. *Device*: a Protect camera is `device.type === DEVICES_UNIFI_PROTECT_TYPE`, string `protectDeviceId`,
     `protectModelKey` `'camera'` or null, and a channel with identifier `camera.main`. Otherwise `listProfiles` → `[]`,
     `resolveSource` → `CameraProfileUnavailableException`.
  2. *Profiles* (D5): qualities `[default, …rest of high/medium/low]` on `camera.main`, `package` on `camera.package`
     when that channel exists. Reasons checked in order: connector client or identity null, or `protectNvrId !==
     identity.nvrId` → `console_unavailable` (no request); cached `state` present and not `CONNECTED` → `camera_offline`
     (no request); `availability.getAvailability(...)` null → `stream_state_unknown`; quality false →
     `stream_not_enabled`.
  3. *Source* (D2, D3): unknown profile id for this device → `CameraProfileUnavailableException`; console as in 2 →
     `CameraOfflineException`; cached state not `CONNECTED` → `CameraOfflineException`; `readStreams` error →
     `toCameraProviderError(e, 'source')`; quality URL null → `CameraProfileUnavailableException`; host = stored
     `streamHostOverride` (when non-null and `isValidProtectHost`; non-null and invalid → `CameraUpstreamException` and
     the limited warning) else `getConsoleHost()`; `toProtectStreamSource` null → `CameraUpstreamException`. The URL is
     never assigned to a field, logged or put in an error.
  4. *Logs*: failures only, through `ProtectFailureLogLimiter`, texts fixed (D8); success at debug `UniFi Protect stream
     source resolved device=<protectDeviceId> profile=<id>`.

- [ ] **Step 1: Write the failing tests**

`protect-stream-errors.spec.ts`:
```ts
it.each([
	['unavailable', 'source', CameraOfflineException], ['not_found', 'snapshot', CameraOfflineException],
	['rate_limited', 'snapshot', CameraRateLimitedException], ['timeout', 'source', CameraUpstreamException],
	['tls_untrusted', 'snapshot', CameraUpstreamException], ['authentication', 'source', CameraUpstreamException],
	['unsupported', 'snapshot', CameraUpstreamException], ['cancelled', 'source', CameraUpstreamException],
])('maps %s (%s) to %p', ...);
it('never carries the original message', ...); // new Error('rtsps://h:7441/SENTINELALIASx') -> CameraUpstreamException, message 'Camera did not respond'
```
`protect-connector.service.spec.ts`: `it('reports the connected host only while connected', ...)` — null before start,
the configured host once connected, null after `stop()`.

`protect-stream.provider.spec.ts` (fake connector, fake synchronizer cache, fake availability service, `ConfigService`
mock returning the plugin config; devices built as `ProtectDeviceEntity` with channels `camera.main` id `ch-main` and
optionally `camera.package` id `ch-pkg`):
```ts
it('lists the default quality first and the package profile last', ...);
// default 'medium', availability { high: true, medium: false, low: false, package: true } ->
// [{ id: 'medium', channelId: 'ch-main', available: false, unavailableReason: 'stream_not_enabled' }, { id: 'high', channelId: 'ch-main', available: true },
//  { id: 'low', …, 'stream_not_enabled' }, { id: 'package', channelId: 'ch-pkg', available: true }]
it('lists no package profile without a package channel', ...);
it('reports console_unavailable without a request', ...); // getClient null; and nvr mismatch -> every profile console_unavailable; getAvailability not called
it('reports camera_offline for a disconnected camera without a request', ...);
it('reports stream_state_unknown when availability cannot be read', ...);
it('lists nothing for a device that is not a Protect camera', ...); // light, missing camera.main, foreign type -> []
it('resolves a source on the console host and drops the query', ...);
// readStreams -> high 'rtsps://192.0.2.10:7441/SENTINELALIAShigh0123456789?enableSrtp', getConsoleHost '192.168.1.1' ->
// { url: 'rtsps://192.168.1.1:7441/SENTINELALIAShigh0123456789', transport: 'rtsps-insecure' }
it('reads the console on every resolve', ...); // two resolveSource calls -> readStreams twice (no alias cache)
it('applies stream_host_override', ...); // override 'streams.example' -> url host 'streams.example'
it('fails closed on an invalid stored override', ...); // override 'rtsps://x' -> CameraUpstreamException; readStreams called, no url anywhere in logs
it('refuses a profile that is not enabled or unknown', ...); // medium null -> CameraProfileUnavailableException; 'ultra' -> same; 'package' without channel -> same
it('maps console failures', ...); // readStreams rejects 'unavailable' -> CameraOfflineException; 'rate_limited' -> CameraRateLimitedException
it('refuses a malformed console URL', ...); // 'rtsp://…' -> CameraUpstreamException
it('never logs or throws a stream address', ...); // logger spies and every caught error: no 'SENTINELALIAS', no ':7441/'
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/services/protect-stream src/plugins/devices-unifi-protect/services/protect-connector.service.spec.ts`
Expected: FAIL (modules not found; `getConsoleHost is not a function`).

- [ ] **Step 3: Implement** `getConsoleHost`, the error mapping and the provider (snapshot methods stubbed as stated).

- [ ] **Step 4: Run to verify pass** — the Step 2 command. Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect
git add apps/backend/src/plugins/devices-unifi-protect
git commit -m "feat(backend): list UniFi Protect stream profiles and resolve relay sources"
```

---

### Task 5: Stream provider — snapshots

**Files:**
- Modify: `services/protect-stream.provider.ts`
- Test: `services/protect-stream.provider.spec.ts`, `client/protect-api.client.integration.spec.ts`

**Interfaces:**
- Consumes: F5, F7, F9, F15; Task 4.
- Produces:
  ```ts
  getSnapshot(device: DeviceEntity, options: { channelId?: string; highQuality?: boolean; signal?: AbortSignal }): Promise<CameraSnapshot>;
  getSnapshotMinIntervalMs(device: DeviceEntity): number; // config snapshotMinIntervalMs clamped to 500–60 000, else 2 000
  ```
- Rules (decided, D6, D8): device as Task 4 rule 1, else `CameraProfileUnavailableException`; channel per D6; console
  not connected or NVR mismatch → `CameraOfflineException`; cached state present and not `CONNECTED` →
  `CameraOfflineException`; `client.getSnapshot(protectDeviceId, { highQuality, channel?: 'package', signal, deadlineMs:
  PROTECT_SNAPSHOT_DEADLINE_MS })`; `unsupported` with `highQuality: true` → one retry with `false`; other errors →
  `toCameraProviderError(e, 'snapshot')`. Returns `{ contentType, data }` as the client gave them.

- [ ] **Step 1: Write the failing tests**

`protect-stream.provider.spec.ts`:
```ts
it('takes a main snapshot without a channel parameter', ...); // channelId undefined and 'ch-main' -> getSnapshot(id, { highQuality: false, signal, deadlineMs: 8000 }) (no channel key)
it('takes a package snapshot', ...); // 'ch-pkg' -> channel 'package'
it('refuses an unknown channel without a request', ...); // 'other' -> CameraProfileUnavailableException; getSnapshot not called
it('requests full HD only when the camera supports it', ...); // cached supportFullHdSnapshot false + hq -> highQuality false; true + hq -> true; true + no hq -> false
it('falls back once when the console refuses full HD', ...); // first call rejects 'unsupported' -> second call highQuality false -> image; two 'unsupported' -> CameraUpstreamException, 2 calls
it('answers offline without a request', ...); // getClient null -> CameraOfflineException; cached DISCONNECTED -> CameraOfflineException; 0 calls
it.each([['unavailable', CameraOfflineException], ['not_found', CameraOfflineException], ['rate_limited', CameraRateLimitedException], ['timeout', CameraUpstreamException]])(
	'maps a snapshot failure %s', ...);
it('reports the configured snapshot interval', ...); // 5000 -> 5000; missing config -> 2000; 100 -> 500
```
`protect-api.client.integration.spec.ts` (real client, `FakeProtectServer`, as the existing tests do):
```ts
it('sends the package channel and the HQ flag as query parameters', ...);
// getSnapshot('5f0000000000000000000a02', { highQuality: true, channel: 'package' }) with cameraFixtures incl. cameras-doorbell.json ->
// fake.requests last query toEqual { highQuality: 'true', channel: 'package' }; contentType 'image/jpeg'
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/services/protect-stream.provider.spec.ts src/plugins/devices-unifi-protect/client/protect-api.client.integration.spec.ts`
Expected: FAIL (snapshot tests); the integration test PASSES already (it pins existing client behaviour the provider relies on).

- [ ] **Step 3: Implement** the two methods.

- [ ] **Step 4: Run to verify pass** — the Step 2 command. Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect
git add apps/backend/src/plugins/devices-unifi-protect
git commit -m "feat(backend): serve UniFi Protect camera snapshots through the shared client"
```

---

### Task 6: Registration, readme and config descriptions

**Files:**
- Modify: `devices-unifi-protect.plugin.ts`, `devices-unifi-protect.plugin.spec.ts`, `models/config.model.ts:124-128`, `dto/update-config.dto.ts:130-136`
- Test: `devices-unifi-protect.plugin.spec.ts`

**Interfaces:**
- Consumes: F2, F17; Task 4 `UnifiProtectStreamProvider`.
- Produces (decided): `CamerasModule` appended to the plugin's `imports`; `UnifiProtectStreamProvider` in `providers`;
  constructor injects `CameraStreamProviderRegistryService` and the provider; `onModuleInit` ends with
  `this.streamProviderRegistration = this.cameraStreamProviders.register(this.unifiProtectStreamProvider)` (a `null`
  result logs `UniFi Protect stream provider was not registered` once); the class implements `OnModuleDestroy`, which
  calls `dispose()`. Both `stream_host_override` descriptions become `Host name or IP address the live-view relay uses
  for the console's camera streams instead of the console host` (the DTO keeps its `Send null to clear it.` suffix).
  Readme: the configuration row becomes `| \`stream_host_override\` | Host the live-view relay uses for camera streams
  instead of the console host | — |`; *What you get* gains `- Live view and snapshots of cameras and doorbells through
  the cameras module, with camera status that follows the console`; new section after *Control*:
  ```markdown
  ## Streams and snapshots

  - Each adopted camera offers the `high`, `medium` and `low` stream qualities, plus `package` on doorbells with a package camera; `default_stream_quality` is listed first. A quality that is not enabled on the console is listed as unavailable (`stream_not_enabled`): enable it in Protect, or adopt the camera again with streams enabled. The plugin never enables or deletes a stream on its own.
  - Stream addresses are read from the console each time a live stream starts and are kept only in memory: they are never stored, logged or returned by the API.
  - The relay reaches the console's RTSPS port over TLS without verifying the certificate, because the relay cannot pin one. The API key never travels on that connection, but someone who can intercept traffic between Smart Panel and the console could capture a stream address.
  - `stream_host_override` replaces the host of every stream address, for consoles that report an address Smart Panel cannot reach.
  - Snapshots use the same request pacing as every other console request, at most one per camera every `snapshot_min_interval_ms`. Full-HD snapshots are requested only from cameras that support them.
  - Camera status follows the console: `offline` while a camera is disconnected, `initializing` while it connects, `available` when a stream quality is enabled and `unavailable` when none is.
  ```

- [ ] **Step 1: Write the failing tests** (`devices-unifi-protect.plugin.spec.ts`)

```ts
it('registers the stream provider for the plugin type', ...); // registry mock register called once with the provider after onModuleInit(); getType() 'devices-unifi-protect'
it('releases the stream provider on destroy', ...); // the handle's dispose called once by onModuleDestroy()
it('logs once when the provider type is already taken', ...); // register returns null -> one warn line with the fixed text
```
The provider-list test adds `ProtectStreamAvailabilityStore`, `ProtectStreamAvailabilityService`,
`UnifiProtectStreamProvider`; the imports test (`:332`) adds `CamerasModule`; the readme test adds
`toContain('## Streams and snapshots')`, `toContain('stream_not_enabled')`, `not.toContain('Host clients use')`.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/devices-unifi-protect.plugin.spec.ts`
Expected: FAIL (registration, imports and readme assertions).

- [ ] **Step 3: Implement** the plugin changes and the two descriptions; then regenerate locally:
  `pnpm run generate:openapi && git status --short` — expected: no generated file listed (all ignored).

- [ ] **Step 4: Run to verify pass**

Run: the Step 2 command, then `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect src/modules/cameras`
and `pnpm --filter ./apps/backend run lint:deps`
Expected: PASS; `lint:deps` reports no cycle naming `devices-unifi-protect` or `modules/cameras`.

- [ ] **Step 5: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect
git add apps/backend/src/plugins/devices-unifi-protect
git commit -m "feat(backend): register the UniFi Protect camera stream provider"
```

---

### Task 7: End to end, gates, epic status and PR body

**Files:**
- Create: `apps/backend/test/devices-unifi-protect-streams.e2e-spec.ts`
- Modify: `tasks/epics/EPIC-UNIFI-PROTECT.md:105`

**Interfaces:**
- Consumes: everything above; the boot, auth, config, `adoptBatch`, `eventually`, `record`, sentinel-sweep helpers of
  `test/devices-unifi-protect-control.e2e-spec.ts:37-290, 404-428` (copy them; do not import between e2e files);
  `CamerasService`, `CameraStreamProviderRegistryService`, `toGo2rtcSource`, `Go2rtcSecretsRegistry`.
- Setup (decided): `FakeProtectServer.start({ cameraFixtures: ['cameras.json', 'cameras-doorbell.json'] })`; adopt
  `600cefafd5f365d6f83c4ef3` with `stream: { enabled: false }` (the fake serves only `high`) and
  `5f0000000000000000000a02` with streams on (adoption enables `medium` and `package`); wait for `realtime_state:
  streaming`. Camera REST base `/api/v1/modules/cameras/cameras`. Source checks call `app.get(CamerasService)`:
  `getProviderOrThrow(id)` then `resolveSource(device, provider, profile)` and `toGo2rtcSource(...)`; the live WebSocket
  path itself is UP-3's (`test/cameras-live.e2e-spec.ts`) and is not repeated.

- [ ] **Step 1: Write the e2e tests**

```ts
it('lists Protect profiles with availability and hints', ...);
// GET cameras/<600c panel id> -> data.live_view true; profiles ids ['medium', 'high', 'low'];
// medium { available: false, unavailable_reason: 'stream_not_enabled' }, high { available: true }; no 'package' profile;
// doorbell a02 profiles end with { id: 'package', available: true }
it('lists profiles without a second console read', ...); // two GET cameras within 60 s -> count of rtsps-stream GETs in fake.requests unchanged by the second
it('resolves an rtspx source on the console host without enableSrtp', ...);
// toGo2rtcSource(resolveSource(…, 'high')) === `rtspx://127.0.0.1:${7441}/${FAKE_PROTECT_ALIAS}` (the fake's console host 127.0.0.1)
it('applies stream_host_override', ...); // patchConfig({ stream_host_override: 'streams.example' }) -> host 'streams.example'; restore null
it('refuses a session for a quality that is not enabled', ...);
// jest.spyOn(app.get(Go2rtcService), 'isRunning').mockReturnValue(true) (as test/cameras.e2e-spec.ts:209; the session route checks the relay first);
// POST cameras/<600c>/sessions { data: { profile: 'medium', transport: 'mse' } } as owner -> 404; spy restored
it('serves a snapshot through the shared client', ...);
// GET cameras/<600c>/snapshot -> 200 image/jpeg, body equals snapshot.jpg; last snapshot request query { highQuality: 'false' };
// a second GET within 2 s -> no new snapshot request
it('asks for the package channel and for full HD only where supported', ...);
// a02 ?profile=package&hq=true -> query { highQuality: 'true', channel: 'package' }; 600c ?hq=true -> { highQuality: 'false' }
it('maps a console 503 to the offline answer', ...); // fake.enqueue(/\/snapshot$/, { status: 503 }) on a fresh profile key -> 503
it('follows a camera offline and back', ...);
// updateDevice + sendFrame { state: 'DISCONNECTED' } -> eventually camera.main status 'offline'; snapshot -> 503 with no new snapshot request;
// { state: 'CONNECTED' } -> one rtsps-stream GET, eventually status 'available'
it('shows a stream disabled on the console as unavailable', ...);
// fake.setStreams(600c, []); resolveSource 'high' -> CameraProfileUnavailableException; eventually status 'unavailable'; restore ['high']
it('never leaked a secret into responses, logs, events, the database, the config or diagnostics', ...);
// GET plugin status, plugin devices, cameras status, /modules/extensions/services recorded first; FAKE_PROTECT_API_KEY, 'SENTINELALIAS',
// FAKE_PROTECT_ALIAS absent from inspect([logSpies, emitSpies, observed]), from SELECT * of the three device tables, and from every file
// under configDirectory; the material contains 'cameras/{id}/rtsps-stream'; fake.forbiddenHits 0;
// fake.writes contains no POST after the adoption step (the provider never creates a stream)
```

- [ ] **Step 2: Run**

Run: `pnpm --filter ./apps/backend exec jest --config ./test/jest-e2e.json test/devices-unifi-protect-streams.e2e-spec.ts --detectOpenHandles`
Expected: PASS, 11 tests, no open-handle report. Fix the test, not the product, unless a real defect shows.

- [ ] **Step 3: Prove the sweep can fail**

Temporarily make the provider's success debug line append the source URL; rerun Step 2. Expected: the last test FAILS on
`SENTINELALIAS`. Restore with `git checkout -- apps/backend/src/plugins/devices-unifi-protect/services/protect-stream.provider.ts`
and rerun to PASS.

- [ ] **Step 4: Full gates**

```bash
pnpm run generate:spec
pnpm run generate:openapi
pnpm --filter ./apps/backend run lint:js
pnpm --filter ./apps/backend exec prettier --check "src/plugins/devices-unifi-protect/**/*.ts" "test/devices-unifi-protect*.ts"
pnpm --filter ./apps/backend run lint:deps
TZ=UTC pnpm run test:unit
pnpm --filter ./apps/backend exec jest --config ./test/jest-e2e.json test/devices-unifi-protect.e2e-spec.ts test/devices-unifi-protect-discovery.e2e-spec.ts test/devices-unifi-protect-adoption.e2e-spec.ts test/devices-unifi-protect-realtime.e2e-spec.ts test/devices-unifi-protect-control.e2e-spec.ts test/devices-unifi-protect-streams.e2e-spec.ts test/cameras.e2e-spec.ts test/cameras-live.e2e-spec.ts
git status --short
```
Expected: every command exits 0, except that `lint:deps` may report only the pre-existing findings recorded in PR #1642
(no new cycle names a `devices-unifi-protect` or `modules/cameras` file); `git status` shows no generated file.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/test/devices-unifi-protect-streams.e2e-spec.ts
git commit -m "test(backend): cover UniFi Protect streams and snapshots end to end"
```
Edit `tasks/epics/EPIC-UNIFI-PROTECT.md:105`: first cell `UP-10 (done)`.
```bash
git add tasks/epics/EPIC-UNIFI-PROTECT.md
git commit -m "docs(tasks): mark UniFi Protect streams and snapshots done"
```

- [ ] **Step 6: Write the PR body to a file (do not push, do not open the PR)**

Path: `<session scratchpad>/pr-body-unifi-protect-streams.md`. Title line first:
`feat(backend): provide UniFi Protect camera streams and snapshots`. Sections: Summary (3 bullets); Stream TLS and
residual risk (D1 verbatim risk paragraph, the go2rtc 1.9.15 facts, the UP-20 measurements and the bridge follow-up);
Profiles and reasons table (D5); Availability reads and rate budget (D4); Camera status ownership (D7); Error mapping
(D8 table); Decisions D1–D10 as approved, with reasons; Amendments A1–A9; Deviations ("Decisions recorded" below); Test
plan (commands of Tasks 1–7 with pass counts); Known limits (no 7441 certificate check; registered go2rtc streams keep an
old alias until idle; no periodic availability sweep; `in_use` not written; package and offline snapshot behaviour
synthetic until UP-20); `Closes #1186`; then `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

---

## Decisions recorded (for the PR body)

1. Camera streams use go2rtc's `rtspx` (`rtsps-insecure`) to the configured console host or `stream_host_override`;
   go2rtc 1.9.15 cannot verify or pin an IP host. Residual risk: an active on-path attacker can capture the alias.
   UP-20 measures the 7441 certificate; a TLS bridge is the follow-up if it is trustable.
2. The host in the console's URL is never used; `?enableSrtp` is dropped; an invalid stored override fails closed.
3. No alias cache: every stream start reads the console once; only presence booleans are cached (60 s TTL, cleared per
   session).
4. Profiles list `high/medium/low` with the default first and `package` last; unavailable profiles carry
   `stream_not_enabled`, `camera_offline`, `console_unavailable` or `stream_state_unknown`. The provider never creates a
   stream.
5. Snapshots request full HD only when supported (one fallback), map the package channel from the Smart Panel channel id,
   and skip the console for offline cameras.
6. The synchronizer now writes `camera.status` from device state and stream availability; `camera.source` stays the
   adoption-written constant; `in_use` is not written.
7. Changes outside the issue's file ownership: synchronizer (`isAdopted`, `refreshDevice`, gated stream status),
   adoption (one store write), connector (`getConsoleHost`), plugin imports `CamerasModule`, two config descriptions.

## Self-review

**Spec coverage (issue #1186, design §4.3, §9.4, §10.1, §13, roadmap UP-10):**

| Requirement | Task |
|---|---|
| `UnifiProtectStreamProvider` registered for the plugin device type | 6 |
| Profiles `high`/`medium`/`low` + `package` when `hasPackageCamera`; missing stream as unavailable with a hint | 4 (D5, A6) |
| `rtsps://…?enableSrtp` → `rtspx://…` plus `stream_host_override` | 1, 4, 7 (D1, D2, A1) |
| Aliases in memory only | 4, 7 (D3) |
| Snapshots with `highQuality` and `channel=package`, shared pacer, 503 ⇒ offline | 5, 7 (D6, D8, A7) |
| `camera.status` and `camera.source` maintained | 2, 3, 7 (D7) |
| No alias in logs, responses, persisted properties or diagnostics | 3, 4, 7 (D9) |
| Rate limit shared with the pacer | 3, 5 (D4) |
| Never create or delete streams outside adoption | 4, 7 (D5) |

**Step scan:** every code step names its file, signatures and decided rules; test steps list names with fixture ids,
values and expected exceptions; verification steps carry commands and expected output. The provider's flow is a rule
list, not a body; the readme section and log texts are fixed copy.

**Type consistency:** `ProtectStreamAvailabilityStore`, `ProtectStreamAvailabilityEntry`, `streamStatusMappingNames`,
`isAdopted`, `refreshDevice` (2) in 3 and 4; `ProtectStreamAvailabilityService.readStreams/getAvailability` (3) in 4;
`toProtectStreamSource`, `PROTECT_STREAM_*`, `PROTECT_SNAPSHOT_DEADLINE_MS`, `PROTECT_PROFILE_UNAVAILABLE_REASONS` (1) in
3–5; `getConsoleHost`, `toCameraProviderError`, `UnifiProtectStreamProvider` (4) in 5–7.

**Review Focus:** items 1–5 each name their tests (Task 2 offline/unknown, Task 3 reconnect and session sweep, Task 7
offline and back; Task 1 host rule, Task 4 invalid override, Task 7 override; Task 5 HQ and channel, Task 7 query check;
Task 3 TTL and coalescing, Task 7 second listing).

**Proportion:** 7 tasks for roughly 1,300 lines of source and tests; the plan carries decisions, signatures, rule lists,
fixture-based test names and fixed copy, and points to the UP-9 e2e harness and the fake camera provider for patterns.
