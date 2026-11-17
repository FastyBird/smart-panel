# Cameras — Plan 5d: UniFi Protect camera streams and snapshots (UP-10) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every adopted UniFi Protect camera and doorbell gets stream profiles, live view through go2rtc and snapshots
from the cameras module, and its `camera.status` follows the console, while the RTSPS stream alias never leaves backend
memory and the stream never crosses an unverified TLS connection.

**Architecture:** `UnifiProtectStreamProvider` (`services/protect-stream.provider.ts`) implements the core
`ICameraStreamProvider` and is registered with `CameraStreamProviderRegistryService` for the `devices-unifi-protect`
device type. go2rtc 1.9.15 cannot verify or pin the console's RTSPS certificate by IP, so the plugin runs a small TLS
bridge (`services/protect-stream-bridge.service.ts`): go2rtc connects with plain `rtsp://<bridge host>:<port>/<alias>`
to a listener only it can reach, and every accepted connection is piped to `<stream host>:7441` over TLS opened with the
connector's own `verify`/`pinned` plan (the same verified-connect code the API agent uses). A failed verification fails
closed (`stream_tls_unverified`); there is no `rtspx` path. A guard on the console → go2rtc direction drops any RTSP
redirect, the only way go2rtc would leave the bridge. The console URL is read on every `resolveSource` and never cached;
only stream *presence* (booleans) is kept, in a leaf store that a refresher fills and the synchronizer reads, so the
synchronizer stays the only writer of Protect property values and now keeps `camera.status` current.

**Tech Stack:** NestJS 11 on Fastify, TypeORM (SQLite), Node `net`/`tls`/`stream`, Jest with fake timers, supertest, the
plugin's own HTTPS client (no new dependency). No spec change, no migration, no new route, no cameras-core change.

**Spec:** `docs/superpowers/specs/2026-10-06-unifi-protect-integration-design.md` §4.1, §4.3, §6 (D1, D5, D9, "Spike
results (2026-11-14)" TLS lines 236-242), §7.1, §7.2, §9.4, §10.1, §13, §16. Issue #1186 (epic #1175). Roadmap
`docs/superpowers/plans/2026-11-12-cameras-roadmap.md` §4 (provider contract, secret rule) and §5 "Plan 5" UP-10.
Predecessor plans: `2026-11-12-cameras-plan-2-cameras-module.md` (UP-2), `2026-11-13-cameras-plan-3a-relay.md` (UP-3),
`2026-11-13-cameras-plan-3b-installer.md` (UP-4), `2026-11-15-cameras-plan-5a-protect-adoption.md` (UP-7),
`2026-11-15-cameras-plan-5b-protect-realtime.md` (UP-8) and `2026-11-16-cameras-plan-5c-protect-control.md` (UP-9, format
and the synchronizer-only-writer rule C8). Reference provider: `apps/backend/test/support/fake-camera-stream.provider.ts`
(the roadmap's `SimulatorCameraStreamProvider` does not exist on `main`, amendment A3). UP-2, UP-3, UP-4, UP-7, UP-8 and
UP-9 are merged on `main` (`ee241a75c`); every interface below is verified on that commit.

---

## Decisions (approved)

The issue, the design, the roadmap and the code disagree or leave these open. The plan is written for each
recommendation; *cost if wrong* says what changes. The maintainer approved every recommendation below on 2026-11-17,
unchanged, including D1's verified TLS bridge (never `rtspx`). D1b stays conditional: it is not in the tasks until the
port 7441 certificate measurement shows a certificate different from port 443's.

**D1. The camera stream is verified through a TLS bridge in the plugin.** Verified: the relay is go2rtc **1.9.15**
(`build/go2rtc/pin.env:7`), the latest release (master has four commits past it, none in `pkg/tcp/dial.go`). Its RTSP
dialer (`pkg/tcp/dial.go` at `v1.9.15`) uses `InsecureSkipVerify` for `rtspx://` and for `rtsps://` whenever the host is an
IP address, and otherwise verifies against the system roots with `ServerName` = URL host; it has no pin, no custom CA and
no separate SNI. Handing go2rtc any `rtsps`/`rtspx` URL for a console would therefore be an unchecked connection, which
breaks the #1623 rule that the plugin never talks to the console over one (`client/protect-tls-policy.ts:25-51`).
Decision:
- The plugin opens TLS to `<stream host>:<console port>` (D2) itself, with **the connector's TLS plan unchanged**
  (`planProtectTls(streamHost, config.tls)`): `verify` → `servername` = the configured `tls.server_name` (the console's
  `*.id.ui.direct` name, which presents a Let's Encrypt certificate under that SNI, design lines 236-237) and full
  chain-and-name verification; `pinned` → the leaf's SHA-256 must equal `tls.fingerprint_sha256` through the existing
  `fingerprintsEqual`. Both run through one verified-connect function extracted from `ProtectHttpsAgent.createConnection`
  (`client/protect-https-agent.ts:74-148`), so the API and the stream share the exact check (Task 4).
- go2rtc gets `{ url: 'rtsp://<bridge host>:<bridge port>/<alias>', transport: 'rtsp' }` (D11 for the listener). Bytes
  are piped unchanged in both directions, except the redirect guard (D12).
- **Fail closed.** Each accepted connection is verified before a byte is forwarded; a failed verification destroys both
  sockets. `resolveSource` runs one verified pre-flight handshake (reporting only; every piped connection is verified on
  its own, so there is no check-then-use gap) and throws `CameraProfileUnavailableException` when it fails; `listProfiles`
  reports `stream_tls_unverified` for every profile while the last result for the current listener is a failure. There
  is no `rtspx`, no `rtsps-insecure` and no "verification off" path anywhere.
- Residual risk (replaces the earlier `rtspx` risk): the go2rtc → bridge hop is plain RTSP. With go2rtc on the same host
  (every shipped topology, D11) it stays on loopback, readable only by a process with root or the capture privilege on
  that host. With an external go2rtc on another host it crosses that network in cleartext: a passive observer on the
  path between the Smart Panel host and the relay host reads the alias and the video. That is the external relay's
  existing exposure (go2rtc's own API and MSE traffic to it are plain HTTP/WS, design §9.4 "external mode … the user
  secures it") and the readme says so. The console hop is always verified or pinned. While a listener is closed (plugin
  disabled or backend shut down) and go2rtc still holds its URL, a local process that binds the freed port can receive
  the alias from go2rtc's re-dial (R1).
**Recommendation: as listed.** *Cost if wrong:* the bridge is one service and one guard; the provider only consumes
`prepare()`.

**D1b. Conditional — a separate stream pin (NOT in the tasks until the measurement confirms it).** The maintainer is
measuring whether port 7441 presents the same certificate as 443 (by IP: self-signed `CN=unifi.local`; with SNI =
`*.id.ui.direct`: Let's Encrypt). D1 assumes it does. **If** 7441 presents a different certificate: add an optional
`tls.stream_fingerprint_sha256` (pinned leaf of 7441), captured by `POST test-connection` with `inspectProtectCertificate`
on the stream port (`client/protect-https-agent.ts:188-258`) and confirmed by the admin like the API pin; the bridge uses
it instead of `tls.fingerprint_sha256` (and, in `verify` mode, instead of name verification only if 7441 does not serve
the Let's Encrypt certificate under SNI). This adds a config field (model, DTO, secret-free), a test-connection model
field, the admin form row (UP-12) and a readiness rule; no migration (plugin config is YAML). Until then a console whose
7441 certificate differs shows `stream_tls_unverified` — fail closed, never a fallback.

**D2. Stream host, port and URL shape.** The console writes its own idea of its address into the URL; multi-homed
consoles may write an unreachable interface (design §4.3). Rule (pure, Task 1): parse the console URL; require scheme
`rtsps:`, no userinfo, no fragment, exactly one path segment matching `PROTECT_STREAM_ALIAS_PATTERN`
(`/^[A-Za-z0-9_-]{8,128}$/`), a port 1–65535 (default 7441 when absent); drop the query (`?enableSrtp`) and the console's
host. The **upstream** is `{ host: stream_host_override ?? connected console host, port }`; the bridge connects there
with D1's plan (in `verify` mode the certificate must still match `tls.server_name`, in `pinned` mode the pin, whatever
the host). The go2rtc URL is built from the bridge endpoint and the alias only. `stream_host_override` already exists
(`models/config.model.ts:124-133`, validated by `IsProtectHost` only in the DTO, `dto/update-config.dto.ts:130-143`), is
read on every call (a change needs no reconnect, `services/protect-connector.service.ts:136-157`; it re-keys the bridge
listener, D11) and is re-checked with `isValidProtectHost`; an invalid stored override fails closed (one rate-limited
warning `UniFi Protect stream host override is invalid`). Its descriptions say "clients use", which is wrong: Task 8
fixes the readme row and both Swagger descriptions. **Recommendation: as listed.** *Cost if wrong:* one function.

**D3. Alias handling: no alias cache.** Verified: the core calls `resolveSource` once per go2rtc registration, shared by
every viewer, and holds the result itself while the stream lives (`modules/cameras/services/go2rtc-streams.service.ts:288-299`;
URL and path registered for redaction at `:350-379`). **Recommendation:** a fresh `GET cameras/{id}/rtsps-stream` on every
`resolveSource`; the alias lives only in that call frame and the returned bridge URL (which the core holds). The bridge
never sees the alias as data: it forwards bytes. Rotation, a session reset or a console restart need no invalidation.
Known limit (core): a registered go2rtc stream keeps its URL until the core's 30 s idle grace removes it, so a rotated
alias fails at the console until the stream is re-registered; the bridge port itself survives session changes (R1). Only presence booleans are cached (D4). *Cost if wrong:*
a cache is one map in the availability service.

**D4. Stream availability: what is cached, when it is read, and the rate budget.** The public API sends no frame when a
stream is enabled or disabled; presence is only learnt from `GET rtsps-stream`. Rules:
- The store keeps `{ high, medium, low, package }` booleans plus `readAt` per Protect camera id, in memory; cleared when
  the connector session ends.
- Reads (all through `ProtectStreamAvailabilityService.readStreams`, deadline `PROTECT_STREAM_READ_DEADLINE_MS` =
  **8 000 ms**, below the core's 10 s provider timeout, `modules/cameras/services/cameras.service.ts:22`): (1) every
  `resolveSource` (D3); (2) `listProfiles` when the entry is missing or older than `PROTECT_STREAM_AVAILABILITY_TTL_MS` =
  **60 000 ms**, coalesced per camera; (3) the synchronizer reports an **adopted** camera that is `CONNECTED` while the
  store has no entry (the session-start sweep: the prime reports every adopted camera,
  `services/protect-synchronizer.service.ts:445-471`) or whose previous observed state was not `CONNECTED` (reconnect);
  (4) adoption writes the store from its own reads (no extra request).
- Background reads (3) run one at a time, de-duplicated per camera, at most `PROTECT_STREAM_REFRESH_MAX_QUEUED` = **256**
  waiting, dropped on session end.
- Budget, all through the one pacer at 8 requests/s: one read per adopted camera per session start (sequential), one per
  reconnect, at most one per camera per 60 s from listings, one per stream start; snapshots at most one per camera,
  profile and quality per `snapshot_min_interval_ms`. The bridge's 7441 handshakes are not API requests and do not use
  the pacer. No periodic sweep (YAGNI).
**Recommendation: as listed.** *Cost if wrong:* constants and triggers in Task 3.

**D5. Profiles.** Verified: the camera object carries no channel list, resolution, frame rate or codec (keys of
`__fixtures__/cameras.json[0]`), and the core picks the first available profile when none is requested
(`cameras.service.ts:78`). Rules:
- `camera.main`: `high`, `medium`, `low`, `default_stream_quality` first, then the others in `high, medium, low` order;
  `camera.package` (present only when adopted with `hasPackageCamera`): `package` last. `channelId` = the Smart Panel
  channel id; no width, height, fps or codec.
- `unavailableReason` (`PROTECT_PROFILE_UNAVAILABLE_REASONS`), checked in this order: `console_unavailable` (connector not
  connected, or `device.protectNvrId` differs), `camera_offline` (cached `state` is not `CONNECTED`),
  `stream_tls_unverified` (the bridge's last verification for the current listener failed, D1),
  `stream_state_unknown` (no availability could be read), `stream_not_enabled` (the console reports the quality `null`).
  The "hint to enable it" is the code; its text belongs to UP-11/UP-12 (A6).
- The provider **never** calls `POST rtsps-stream`; enabling stays with adoption (D9; `POST adopt` again re-runs it,
  `services/protect-adoption.service.ts:316`).
**Recommendation: as listed.** *Cost if wrong:* one function in Task 6.

**D6. Snapshots.** Verified: `ProtectApiClient.getSnapshot(id, { highQuality, channel, signal, deadlineMs })` exists
(`client/protect-api.client.ts:434-467`): paced, retries 408/429 only (`:71`), capped at 8 MiB
(`devices-unifi-protect.constants.ts:35`), rejects a non-`image/*` or empty answer, maps the captured "full HD" 400 to
`unsupported` (`:106-112`). The core passes the Smart Panel `channelId` of the profile
(`modules/cameras/services/camera-snapshot.service.ts:124-131`), caches per camera/profile/quality and accepts only JPEG,
PNG and WebP (`:27`). Rules: `channelId` undefined or the `camera.main` id → no `channel` parameter (as captured); the
`camera.package` id → `channel=package`; any other id → `CameraProfileUnavailableException`. `highQuality` sent explicitly,
`true` only when requested and the cached `featureFlags.supportFullHdSnapshot === true`; one retry with `false` on
`unsupported`. No request when the connector is not connected or the cached state is known and not `CONNECTED`
(`CameraOfflineException`). Deadline `PROTECT_SNAPSHOT_DEADLINE_MS` = **8 000 ms**; the core's signal is passed through.
No extra size or type check. `getSnapshotMinIntervalMs()` = configured `snapshot_min_interval_ms` (500–60 000, default
2 000). Snapshots use the API connection, never the bridge. **Recommendation: as listed.** `channel=package` and every
snapshot failure other than the HQ 400 are synthetic. *Cost if wrong:* one mapping in Task 7.

**D7. Who maintains `camera.status` and `camera.source`.** Verified: UP-7 maps both (`mappings/definitions/properties.yaml:59-85`)
and adoption writes them once (`services/protect-adoption.service.ts:953-999`); the synchronizer evaluates with `streams:
null` (`services/protect-synchronizer.service.ts:1083`) and syncs only `path` sources (`services/protect-frame-merge.ts:172-182`),
so after adoption `camera.status` never changes, not even when a camera goes offline. **Recommendation:** the
synchronizer writes stream status, reading availability from the store (Plan 5c C8: one writer). Stream-status mappings
join the synced set when the cached `state` is not `CONNECTED` (→ `offline` / `initializing` / `unavailable`,
`mappings/mapping-evaluator.ts:248-272`) or when the store has an entry (→ `available` / `unavailable`); a `CONNECTED`
camera with unknown availability keeps its stored status. A store change re-evaluates that camera through a new serial
`refreshDevice`. `camera.source` stays the adoption-written constant (`spec/devices/channels.yaml:2743-2752`, never a
URL). `in_use` is not written (the plugin cannot see core sessions). A TLS verification failure does not change
`camera.status` (it is a profile reason, D5): the camera itself is fine. *Cost if wrong:* a provider-side writer would
duplicate `writeChanges`.

**D8. Error mapping.** `ProtectApiError` category → core exception (the core sanitises and answers 503/404,
`modules/cameras/controllers/cameras.controller.ts:165-185`):

| Source | `resolveSource` | `getSnapshot` | `listProfiles` |
|---|---|---|---|
| API `unavailable` (500/502/503/504), `not_found` | `CameraOfflineException` | `CameraOfflineException` (design: 503 ⇒ offline) | `stream_state_unknown` |
| API `rate_limited` | `CameraRateLimitedException` | `CameraRateLimitedException` | `stream_state_unknown` |
| API `unsupported` | — | after the one HQ fallback: `CameraUpstreamException` | — |
| API, any other category | `CameraUpstreamException` | `CameraUpstreamException` | `stream_state_unknown` |
| Bridge pre-flight `tls_untrusted`, `tls_fingerprint_mismatch` | `CameraProfileUnavailableException` | — | `stream_tls_unverified` |
| Bridge `unavailable` (no listener: relay not running, bind failure, external relay address unknown) or pre-flight `timeout`/`unreachable` | `CameraUpstreamException` | — | unchanged |
| quality `null` / unknown profile id | `CameraProfileUnavailableException` | — | `stream_not_enabled` |

Every thrown exception carries the fixed message of `cameras.exceptions.ts`; failures are logged through
`ProtectFailureLogLimiter` with fixed texts (`UniFi Protect stream request failed (<category>)`). **Recommendation: as
listed.** *Cost if wrong:* one table in `services/protect-stream-errors.ts`.

**D9. Secret hygiene test.** **Recommendation:** a Protect e2e sentinel sweep, like UP-9's last test, over logs, emitted
events, every HTTP response the suite saw (camera list and detail, snapshots, plugin `GET status` and `GET devices`,
cameras `GET status`, extensions `GET services`), the three device tables and every file in the test config directory;
plus unit tests asserting the provider, the availability service and the bridge never log or throw a URL or alias. The
bridge's lines are fixed texts with a category and counts only (`UniFi Protect stream bridge refused a connection
(<reason>)`, `… closed a connection (<reason>)`); it never logs peer addresses with paths, request lines or bytes. The
core spec (`modules/cameras/cameras.secret-hygiene.spec.ts`) already covers the module. Sentinels: `FAKE_PROTECT_API_KEY`,
`FAKE_PROTECT_ALIAS`, `'SENTINELALIAS'` (`test/support/fake-protect-server.ts:21-26`). *Cost if wrong:* none to the product.

**D10. Scope.** UP-10 only, 9 tasks: URL parsing; availability store and status sync; availability service; verified
connect and redirect guard; bridge; provider profiles and source; snapshots; registration and readme; e2e. Outside the
issue's file ownership (`services/*stream*`, `services/*snapshot*`, plugin registration, tests) and listed in the PR
body: the synchronizer change (D7), one line in adoption (D4), `getConsoleHost()` on the connector (D2), the extracted
verified-connect function used by the API agent (D1), the fake console's RTSPS endpoint, `CamerasModule` in the plugin's
imports, two config descriptions. **No cameras-core change** (A1). Out: admin live view and hints (UP-11), wizard stream
enablement (UP-12), panel (UP-13/UP-14), D1b until confirmed, hardware acceptance (UP-20). **Recommendation: as listed.**

**D11. Bridge listener: topology, address, access control, lifecycle.** Verified topology:
- *Installer and Pi image (systemd):* go2rtc is installed at `/usr/local/lib/smart-panel/go2rtc` on the backend's host
  (`scripts/install-server.sh:348`, `build/raspbian/stage-smart-panel/01-install-app/01-run-chroot.sh:150-158`) and spawned
  by the backend as a child (`modules/cameras/services/go2rtc-process.service.ts:102`), API and RTSP bound to `127.0.0.1`
  (`services/go2rtc-config.ts:32-46`).
- *Docker prod:* the binary is copied into the backend image (`docker/prod/Dockerfile:88-94, 120-121`) and spawned the same
  way: same container, same network namespace.
- *Docker dev:* the backend dev image has no go2rtc (no reference under `docker/dev/`); managed mode reports
  `binary_missing`, so developers run a host binary or `external` mode.
- *External mode:* `go2rtc.external_url` may point at any http(s) host (`modules/cameras/cameras.config.utils.ts:19-46`),
  e.g. a Frigate or Home Assistant go2rtc on another machine.
Decisions:
- **Address.** Relay `managed`, or `external` with a loopback host (`127.0.0.0/8`, `::1`, `localhost`): bind `127.0.0.1`
  (or `::1` when the relay host is `::1`). `external` with any other host: bind only the local address the backend uses
  to reach the relay (learnt from `socket.localAddress` of one TCP connect to the relay API's host and port) and admit
  only peers whose address is one of the relay host's addresses (`dns.lookup(host, { all: true })` when the listener
  opens); any other peer is destroyed before an upstream connection exists. If that address cannot be learnt, the bridge
  is `unavailable` (fail closed). Relay state comes from the exported `Go2rtcService` (`getStatus()`, `getClient()?.baseUrl`,
  `subscribe()`; `modules/cameras/services/go2rtc.service.ts:232-287`).
- **Port.** OS-assigned (`listen(0)`), one listener per key `<relay mode, relay generation, bind address>` (R1); no
  configured port. The upstream is not part of the key: each accepted connection reads it at accept time.
- **Access control and secrets.** No per-session path token: the bridge is a transparent pipe to one fixed upstream, it
  adds no capability (the console still requires the alias, which only go2rtc holds), and a token would mean rewriting
  RTSP request lines. The alias in the go2rtc URL stays the only secret, protected by the core's redaction (the URL and
  its path are registered, F4). Access is limited by the bind address (loopback, or the relay's route plus a peer
  allow-list) and by the connection cap.
- **Lifetime (R1).** Opened lazily by the first `prepare()`; stays open while the plugin is enabled and the relay is
  running, because go2rtc re-dials the same URL for as long as a consumer is attached and the core reuses a registration
  while viewers hold leases. A session end or an upstream change (override, port) closes the open **connections**, not
  the listener; while no session exists an accepted connection is destroyed before any upstream connect. The listener
  and every connection close on a relay status with another mode or generation, or any `state !== 'running'` (M1), and
  when the plugin is disabled or destroyed (`onModuleDestroy`). A connection also ends when go2rtc closes its side (the
  core deleted the stream or the last consumer left) or the console closes.
- **Limits.** At most `PROTECT_STREAM_BRIDGE_MAX_CONNECTIONS` = **16** open connections (go2rtc holds one upstream per
  profile; the core's default caps are 8 sessions and 4 per camera); the 17th is destroyed on accept. TLS handshake
  timeout `PROTECT_STREAM_BRIDGE_HANDSHAKE_TIMEOUT_MS` = **5 000 ms** (the API's inspect timeout). Idle timeout
  `PROTECT_STREAM_BRIDGE_IDLE_TIMEOUT_MS` = **60 000 ms** of no bytes in either direction (go2rtc sends an `OPTIONS`
  keep-alive every 25 s while playing, `pkg/rtsp/conn.go:96-105, 154-166`). Bytes arriving from go2rtc before the
  upstream is verified are held (bounded by the handshake timeout and `PROTECT_RTSP_MAX_HEADER_BYTES`) and flushed only
  after verification. Both directions use `pipeline` (backpressure).
**Recommendation: as listed.** *Cost if wrong:* the external-mode branch can be replaced by "external relay on another
host → `unavailable`" (one rule) if the maintainer prefers no non-loopback listener at all.

**D12. RTSP inside the tunnel.** Verified in go2rtc 1.9.15 `pkg/rtsp/client.go`: the default transport (`""`) dials TCP
and SETUP asks for `RTP/AVP/TCP;unicast;interleaved=…` (`:33-55, 254-280`); UDP needs a `#transport=udp` source option,
which the core refuses (fragments are rejected, `go2rtc-source.ts:39`). `Content-Base` (OPTIONS and DESCRIBE,
`:151-156, 187-192`) and absolute track control URLs (`:285-301`) replace only the request-line URL on the **same** TCP
connection; reconnects re-dial the original source (`Dial` parses `c.uri`, `:33-34`), so they stay on the bridge. The one
bypass is a `301`/`302` answer: go2rtc replaces `c.uri` with `Location` and dials it directly (`:100-122`), which for
`rtsps://<console IP>:7441/…` would be an unverified connection. Decision: a guard on the console → go2rtc direction
parses RTSP framing (`$`-interleaved frames, text messages with `Content-Length`) and, on any response with a 3xx status,
destroys both sockets without forwarding it (fail safe; go2rtc retries through the bridge and keeps failing). Headers
over `PROTECT_RTSP_MAX_HEADER_BYTES` = 16 KiB, bodies over `PROTECT_RTSP_MAX_BODY_BYTES` = 64 KiB, or a malformed frame
close the connection too. No rewriting: `Content-Base` pointing at `rtsps://…:7441/<alias>` changes no route and the alias
is already in every request line. UP-20 gains three hardware checks: whether the console sends `Content-Base` or absolute
control URLs, whether it ever redirects, and that playback works through the bridge with interleaved TCP.
**Recommendation: as listed.** *Cost if wrong:* the guard is one Transform.

### Amendments (issue, design and roadmap vs `main`)

| # | Issue / design / roadmap says | Reality on `main` `ee241a75c` | Consequence |
|---|---|---|---|
| A1 | Convert to `rtspx://<host>:7441/<alias>` (issue; design §13.1 step 2). | `rtspx` and `rtsps://<IP>` are unverified in go2rtc 1.9.15. The core rewrites only `rtsps-insecure` sources to `rtspx:` and passes `rtsp` sources unchanged (`go2rtc-source.ts:9-13, 43-47`). | The provider returns `rtsp://<bridge>/<alias>` with transport `rtsp`; no core change. Never `rtsps-insecure` (D1). |
| A2 | go2rtc distinguishes verified `rtsps` from unverified `rtspx`. | `rtsps://<IP>` is unverified too; the core's `rtsp` transport accepts `rtsps:`. | A provider declaring `rtsp` with `rtsps://<ip>` is silently unverified. Not changed here; recorded for a core follow-up. |
| A3 | Simulator provider is the reference implementation. | No `SimulatorCameraStreamProvider` exists. | Reference: `test/support/fake-camera-stream.provider.ts`. |
| A4 | UP-10 adds `camera.status` / `camera.source`. | UP-7 maps and writes both at adoption; nothing updates status afterwards. | Stream status becomes synced (D7); source unchanged. |
| A5 | "Aliases cached in memory only." | `resolveSource` runs once per stream start. | No alias cache (D3). |
| A6 | "Unavailable profile with a hint to enable it." | The contract has `unavailableReason` (a code) only. | Codes (D5); the text is UP-11/UP-12's. |
| A7 | Snapshots "sharing the client rate pacer". | `getSnapshot` exists since UP-5 and uses the pacer. | No client change. |
| A8 | `stream_host_override`: "host clients use". | Unused so far; it is the upstream host of the bridge. | Descriptions and readme fixed (D2). |
| A9 | Provider calls bounded by the client (30 s default deadline). | The core abandons a provider call after 10 s. | 8 s deadlines (D4, D6). |
| A10 | Design §9.4: URLs flow "plugin → cameras module → go2rtc on loopback". | External mode can put go2rtc on another host. | Loopback for every shipped topology; external relays get a route-bound, peer-checked listener (D11). |

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
  ever be needed). No new route; the only Swagger change is two `description` texts (D2), with Swagger decorators kept
  before NestJS decorators.
- **No unverified TLS connection to the console, ever** (#1623): API, WebSockets and the stream all use `planProtectTls`
  through the shared verified-connect function. No `rtspx`, no `rtsps-insecure`, no `rejectUnauthorized: false` without
  the pin check.
- Allowed console calls: `GET cameras/{id}/rtsps-stream`, `GET cameras/{id}/snapshot`, and TLS connections to the stream
  port carrying go2rtc's own RTSP bytes. Never `POST`/`DELETE` `rtsps-stream` from the provider (D5).
- Every console API request goes through `ProtectApiClient` and its rate pacer (80 % of 10 requests/s, design §4.3).
- Secret rule (design §4.3, §9.4): the API key and every RTSPS URL, bridge URL or alias never reach a log line, an error
  message or name, a response, a property value, an event, a notification, a database row, the config file or a
  diagnostic. Sentinels: `FAKE_PROTECT_API_KEY`, aliases starting `SENTINELALIAS` (`test/support/fake-protect-server.ts:21-26`).
- Fixtures: no raw UP-0 capture is committed; this plan adds no fixture file (the fake's RTSPS answers are synthetic
  code, documented in the fake).
- Timers are `unref()`ed and cleared on session end and module destroy; sockets and listeners are closed on the same
  events. Unit tests use `jest.useFakeTimers()` and fakes — never a real console or network; bridge and integration tests
  use loopback sockets and `test/support/fake-protect-server.ts` only.
- Setup once per worktree: `pnpm run bootstrap`. Single test files: `pnpm --filter ./apps/backend exec jest <path>`; e2e
  with `--config ./test/jest-e2e.json`; the full unit suite with `TZ=UTC pnpm run test:unit`.

### Verified facts (on `main` `ee241a75c`)

| # | Fact | Where |
|---|---|---|
| F1 | Provider contract: `getType`, `listProfiles(device, { signal? })`, `resolveSource(device, profileId, { signal? })`, `getSnapshot(device, { channelId?, highQuality?, signal? })`, optional `getSnapshotMinIntervalMs(device)`; `CameraStreamSource.transport: 'rtsp' \| 'rtsps-insecure' \| 'http'`. | `modules/cameras/platforms/camera-stream.provider.ts:3-48` |
| F2 | Registry keyed by `device.type`; `register()` returns `{ dispose }` or `null`; `CamerasModule` exports the registry and `Go2rtcService`. | `modules/cameras/services/camera-stream-provider.registry.service.ts:16-46`; `modules/cameras/cameras.module.ts:57-64` |
| F3 | Core: 10 s provider timeout; `GET cameras` calls `listProfiles` for every camera, coalesced per device; default profile = first available; errors sanitised to fixed texts. | `modules/cameras/services/cameras.service.ts:22, 42-48, 71-87, 163-233`; `cameras.exceptions.ts:100-114` |
| F4 | `toGo2rtcSource`: `rtsp` accepts `rtsp:`/`rtsps:` and returns the URL unchanged; only `rtsps-insecure` becomes `rtspx:`; fragments refused. `resolveSource` once per registration; URL and path registered in `Go2rtcSecretsRegistry`. | `modules/cameras/services/go2rtc-source.ts:9-48`; `go2rtc-streams.service.ts:288-299, 350-379` |
| F5 | Snapshots: core passes the profile's `channelId`; cache per camera/profile/hq; accepts `image/jpeg|png|webp`; reads `getSnapshotMinIntervalMs`. | `modules/cameras/services/camera-snapshot.service.ts:27, 124-131, 295` |
| F6 | go2rtc 1.9.15 pinned (latest release). `pkg/tcp/dial.go`: `rtspx` or IP host → `InsecureSkipVerify`, else `ServerName` = host; no pinning. | `build/go2rtc/pin.env:7`; upstream `AlexxIT/go2rtc@v1.9.15` |
| F7 | go2rtc 1.9.15 `pkg/rtsp`: TCP interleaved by default; `Content-Base` and absolute control URLs stay on the connection; `301`/`302` re-dial `Location` directly; `OPTIONS` keep-alive every ~25 s. | upstream `pkg/rtsp/client.go:33-55, 84-122, 143-192, 254-301`; `pkg/rtsp/conn.go:96-105, 154-166` |
| F8 | Topology: managed go2rtc is a child of the backend bound to `127.0.0.1`; Docker prod ships it in the backend image; installer and Pi image install it on the backend host; dev image has none; external mode accepts any http(s) URL. | `go2rtc-process.service.ts:102`; `go2rtc-config.ts:32-46`; `docker/prod/Dockerfile:88-94, 120-121`; `scripts/install-server.sh:348`; `build/raspbian/stage-smart-panel/01-install-app/01-run-chroot.sh:150-158`; `cameras.config.utils.ts:19-46` |
| F9 | Client: `getRtspsStreams` (SECRET), `createRtspsStreams` (adoption only), `getSnapshot` (pacer, 8 MiB, `image/*`, 408/429 retries, HQ 400 → `unsupported`), `deadlineMs`. | `client/protect-api.client.ts:59-71, 106-112, 359-467, 614` |
| F10 | TLS: `planProtectTls` (only `verify`/`pinned`), `fingerprintsEqual`; the agent's `createConnection` verifies (pin or `authorized`), disables renegotiation, times out at `PROTECT_TLS_INSPECT_TIMEOUT_MS` (5 000); `inspectProtectCertificate` reads a leaf without trusting it; tests inject `PROTECT_TRUSTED_CA`. | `client/protect-tls-policy.ts:20-68`; `client/protect-https-agent.ts:40-148, 188-258`; `client/protect-api-client.factory.ts:16-19`; `devices-unifi-protect.constants.ts:33` |
| F11 | Config: `stream_host_override` (model `IsString`, DTO `IsProtectHost`), `default_stream_quality`, `snapshot_min_interval_ms` (500–60 000, 2 000); override changes need no restart; TLS changes do. | `models/config.model.ts:124-156`; `dto/update-config.dto.ts:130-143`; `validators/protect-config.validators.ts:30-36`; `services/protect-connector.service.ts:136-157` |
| F12 | Connector: `getClient()`, `getConsoleIdentity()`, `onSessionChange()`; the connected host is private (`startedConfig`). | `services/protect-connector.service.ts:64-81, 198-221` |
| F13 | Mappings: `camera.main`, `camera.package`; `camera_*_status` (`stream_status`), `camera_*_source` (template); `streamStatus` rule. | `mappings/definitions/channels.yaml:12-25`; `properties.yaml:59-85`; `mappings/mapping-evaluator.ts:104-109, 248-272` |
| F14 | Synchronizer: evaluates with `streams: null`; syncs `path` sources only (test `never writes constants, templates or camera status from a frame`); `observeDevices`, `getCachedDevice`, serial `run()`; prime notifies adopted devices only. | `services/protect-synchronizer.service.ts:203-224, 445-471, 1069-1083`; `services/protect-frame-merge.ts:172-182`; `protect-synchronizer.service.spec.ts:251` |
| F15 | Adoption reads availability in the preview and writes stream statuses after `ensureStreams`; re-adoption re-runs it. | `services/protect-mapping-preview.service.ts:196-201`; `services/protect-adoption.service.ts:316, 895-999` |
| F16 | Spec: `camera.status` enum `available, in_use, unavailable, offline, initializing, error`; `camera.source` "never a URL or credential". | `spec/devices/channels.yaml:2733-2752` |
| F17 | Fixtures: `rtsps-stream.json` (captured, only `high`), `cameras.json` (`supportFullHdSnapshot: false`), `cameras-doorbell.json` (synthetic; `5f…a02` `hasPackageCamera: true`; both `supportFullHdSnapshot: true`). | `__fixtures__/` |
| F18 | Fake console: stream URLs `rtsps://127.0.0.1:7441/<sentinel alias>?enableSrtp`; `setStreams`, `enqueue`, `updateDevice`, `sendFrame`; snapshot ignores `channel`; `requests` record queries; test TLS: SNI `fakeconsole.id.ui.direct` → CA-signed console certificate, anything else the self-signed one. | `test/support/fake-protect-server.ts:21-26, 125-140, 183-222, 291-298, 517-541, 715-725`; `test/support/protect-tls.ts:12-50` |
| F19 | Plugin: imports `DevicesModule, ConfigModule, ExtensionsModule, SwaggerModule`; registers connector and platform at the end of `onModuleInit`; readme row for `stream_host_override`. | `devices-unifi-protect.plugin.ts:79-126, 136-284, 244` |
| F20 | Epic row `UP-10` without `(done)`. | `tasks/epics/EPIC-UNIFI-PROTECT.md:105` |

## Review Focus

Failure modes the spec implies but no acceptance criterion exercises, most likely first; each is pinned by a named test
in the task at the end of the line.

1. **Port 7441 presents a certificate the plan does not trust** (different self-signed certificate, no Let's Encrypt
   under SNI, a MITM): no byte reaches go2rtc, no fallback, every profile says `stream_tls_unverified`. → Task 5 `fails
   closed on a wrong pin without forwarding a byte`, `fails closed on an untrusted certificate in verify mode`; Task 6
   `reports stream_tls_unverified after a failed pre-flight`; Task 9 `fails closed when the stream port presents another
   certificate`.
2. **The console answers an RTSP redirect** (go2rtc would dial it directly, unverified): the bridge drops it and closes.
   → Task 4 `refuses any 3xx response`, Task 5 `closes both sides on a redirect from the console`.
3. **A camera goes offline and comes back**: `camera.status` shows `offline`, then `available`, without anyone opening the
   camera; no snapshot request while offline. → Task 2 `writes offline when a camera disconnects`, Task 3 `reads
   availability when a camera reconnects`, Task 9 `follows a camera offline and back`.
4. **The session ends, the override changes or the relay moves while go2rtc is streaming**: every bridged connection and
   the listener close; nothing reconnects to an old upstream. → Task 5 `closes every connection when the session ends`,
   `re-keys the listener when the upstream changes`, `closes the listener when the relay generation changes`.
5. **Another local process or host tries the bridge, or connections pile up**: loopback or allow-listed peers only, at
   most 16, idle ones closed. → Task 5 `binds loopback for a managed relay`, `admits only the external relay's
   addresses`, `refuses the seventeenth connection`, `closes an idle connection after 60 s`.

---

## File structure

All paths under `apps/backend/src/plugins/devices-unifi-protect/` unless stated.

| Path | Responsibility | Task |
|---|---|---|
| `devices-unifi-protect.constants.ts` (modify) | stream and bridge constants | 1 |
| `client/protect-stream-url.ts` (new) | pure console URL parsing, bridge URL building | 1 |
| `services/protect-stream-availability.store.ts` (new) | leaf memory store of presence booleans | 2 |
| `services/protect-frame-merge.ts` (modify) | `streamStatusMappingNames` | 2 |
| `services/protect-synchronizer.service.ts` (modify) | gated stream-status sync, `isAdopted`, `refreshDevice` | 2 |
| `services/protect-adoption.service.ts` (modify, one call) | write the store after a stream read | 2 |
| `services/protect-stream-availability.service.ts` (new) | reads, TTL, triggers, background queue | 3 |
| `client/protect-tls-connect.ts` (new), `client/protect-https-agent.ts` (modify) | one verified-connect function for API and stream | 4 |
| `services/protect-rtsp-response-guard.ts` (new) | redirect and framing guard (Transform) | 4 |
| `services/protect-stream-bridge.service.ts` (new) | listeners, peer checks, verified pipes, limits, lifecycle | 5 |
| `apps/backend/test/support/fake-protect-server.ts` (modify) | opt-in RTSPS endpoint | 5 |
| `services/protect-connector.service.ts` (modify) | `getConsoleHost()` | 6 |
| `services/protect-stream-errors.ts` (new) | D8 mapping | 6 |
| `services/protect-stream.provider.ts` (new) | `UnifiProtectStreamProvider` | 6, 7 |
| `devices-unifi-protect.plugin.ts`, `.plugin.spec.ts`, `models/config.model.ts`, `dto/update-config.dto.ts` (modify) | registration, readme, two descriptions | 8 |
| `apps/backend/test/devices-unifi-protect-streams.e2e-spec.ts` (new) | end to end and sentinel sweep | 9 |
| `tasks/epics/EPIC-UNIFI-PROTECT.md:105` (modify) | `UP-10 (done)` | 9 |

Specs sit next to their source (`*.spec.ts`). Each task ends green and committed.

---

### Task 1: Stream URL parsing (pure)

**Files:**
- Create: `client/protect-stream-url.ts`
- Modify: `devices-unifi-protect.constants.ts` (append)
- Test: `client/protect-stream-url.spec.ts`

**Interfaces:**
- Consumes: F4 (`toGo2rtcSource` for the cross-check), F10, F17.
- Produces:
  ```ts
  // devices-unifi-protect.constants.ts
  export const PROTECT_STREAM_READ_DEADLINE_MS = 8_000;
  export const PROTECT_SNAPSHOT_DEADLINE_MS = 8_000;
  export const PROTECT_STREAM_AVAILABILITY_TTL_MS = 60_000;
  export const PROTECT_STREAM_REFRESH_MAX_QUEUED = 256;
  export const PROTECT_RTSPS_DEFAULT_PORT = 7441;
  export const PROTECT_STREAM_ALIAS_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
  export const PROTECT_STREAM_BRIDGE_MAX_CONNECTIONS = 16;
  export const PROTECT_STREAM_BRIDGE_HANDSHAKE_TIMEOUT_MS = PROTECT_TLS_INSPECT_TIMEOUT_MS; // 5 000
  export const PROTECT_STREAM_BRIDGE_IDLE_TIMEOUT_MS = 60_000;
  export const PROTECT_RTSP_MAX_HEADER_BYTES = 16 * 1024;
  export const PROTECT_RTSP_MAX_BODY_BYTES = 64 * 1024;
  export const PROTECT_PROFILE_UNAVAILABLE_REASONS = ['stream_not_enabled', 'camera_offline', 'console_unavailable', 'stream_state_unknown', 'stream_tls_unverified'] as const;
  export type ProtectProfileUnavailableReason = (typeof PROTECT_PROFILE_UNAVAILABLE_REASONS)[number];

  // client/protect-stream-url.ts
  /** SECRET in and out. D2 checks; the console's host and query are dropped. Null when invalid. Never throws. */
  export function parseProtectStreamUrl(consoleUrl: unknown): { port: number; alias: string } | null;
  /** SECRET. `rtsp://<host>:<port>/<alias>` (IPv6 bracketed); null for an invalid host, port or alias. */
  export function buildBridgeStreamUrl(endpoint: { host: string; port: number }, alias: string): string | null;
  ```

- [ ] **Step 1: Write the failing tests** (`protect-stream-url.spec.ts`)

```ts
it('parses the captured URL into port and alias', ...); // rtsps-stream.json .high -> { port: 7441, alias: 'REDACTEDALIAS00000' }
it('keeps a non-default console port and defaults to 7441', ...);
it.each([
	['rtsp://h:7447/AAAAAAAAAA'], ['rtspx://h:7441/AAAAAAAAAA'], ['http://h/AAAAAAAAAA'], ['rtsps://u:p@h:7441/AAAAAAAAAA'],
	['rtsps://h:7441/a/AAAAAAAAAA'], ['rtsps://h:7441/short'], ['rtsps://h:7441/' + 'A'.repeat(129)],
	['rtsps://h:7441/AAAA AAAAAA'], ['rtsps://h:7441/AAAAAAAAAA#x'], ['rtsps://h:0/AAAAAAAAAA'], [''], [null], [42],
])('refuses %p', ...); // -> null
it('builds a plain rtsp bridge URL', ...); // ({ host: '127.0.0.1', port: 40123 }, 'REDACTEDALIAS00000') -> 'rtsp://127.0.0.1:40123/REDACTEDALIAS00000'
it('brackets an IPv6 bridge host', ...); // '::1' -> 'rtsp://[::1]:40123/…'
it('refuses a bad bridge endpoint or alias', ...); // host 'a b', port 0, alias 'x' -> null
it('passes the core unchanged as an rtsp source', ...); // toGo2rtcSource({ url, transport: 'rtsp' }) === url (no rtspx)
it('is fully redacted by the plugin redactor', ...); // redactProtectText(url, []) does not contain the alias
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/client/protect-stream-url.spec.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** the constants and both functions (parse with `new URL`, read own fields only, validate hosts
  with `isValidProtectHost`, build strings by hand).

- [ ] **Step 4: Run to verify pass** — the Step 2 command. Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect
git add apps/backend/src/plugins/devices-unifi-protect
git commit -m "feat(backend): parse UniFi Protect stream addresses for the stream bridge"
```

---

### Task 2: Availability store and synchronized camera status

**Files:**
- Create: `services/protect-stream-availability.store.ts`
- Modify: `services/protect-frame-merge.ts`, `services/protect-synchronizer.service.ts`, `services/protect-adoption.service.ts` (in `enableStreams`), `devices-unifi-protect.plugin.ts` (provider list only)
- Test: `services/protect-stream-availability.store.spec.ts`, `services/protect-frame-merge.spec.ts`, `services/protect-synchronizer.service.spec.ts`, `services/protect-adoption.service.spec.ts`, `services/protect-realtime.service.spec.ts` (constructor only)

**Interfaces:**
- Consumes: F13, F14, F15; `ProtectStreamAvailability` (`mappings/mapping-evaluator.ts:24`).
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
  export function streamStatusMappingNames(mappings: ProtectResolvedMappings): ReadonlySet<string>;

  // services/protect-synchronizer.service.ts (constructor gains `streamAvailability: ProtectStreamAvailabilityStore` last)
  isAdopted(modelKey: string, id: string): boolean;
  /** Serial; re-evaluates one adopted device's cached object with current availability and writes changes (frame semantics, empty partial; no cache write, no sequence bump, no observer call). False when not cached, not adopted or reset. */
  refreshDevice(identity: ProtectConsoleIdentity, modelKey: string, id: string): Promise<boolean>;
  ```
- Rules (decided, D7): for `modelKey === 'camera'` the evaluator gets `streams: store.get(id)?.availability ?? null`;
  the synced names are `syncableNames(mappings)` plus `streamStatusMappingNames(mappings)` when `raw.state !==
  'CONNECTED'` or the store has an entry. Template sources stay unsynced. Adoption: every non-null availability in
  `enableStreams` (`result.availability`, or `prepared.streams` for `NOT_REQUESTED` or a failed POST) is written with
  `store.set(protectDeviceId, …)` before the status write.

- [ ] **Step 1: Write the failing tests**

`protect-stream-availability.store.spec.ts`:
```ts
it('stores copies of the four booleans and reports changes', ...); // set -> true; same -> false; package flipped -> true; mutating the input does not change get()
it('forgets everything on clear', ...);
it('never keeps anything but booleans', ...); // extra keys or strings in the input: get() keys exactly ['high','medium','low','package'], typeof boolean
```
`protect-frame-merge.spec.ts`:
```ts
it('names the stream status mappings', ...); // real loader: ['camera_main_status', 'camera_package_status']; none in syncableMappingNames
```
`protect-synchronizer.service.spec.ts` (existing harness, camera `600cefafd5f365d6f83c4ef3`, doorbell `5f0000000000000000000a02`):
```ts
it('writes offline when a camera disconnects', ...); // prime; frame { state: 'DISCONNECTED' } -> camera.main status 'offline'; store empty
it('writes initializing while a camera connects', ...);
it('keeps the stored stream status while availability is unknown', ...); // CONNECTED frame, store empty -> no status write (the test at :251 stays unchanged)
it('writes available and unavailable from known availability', ...); // store high true; refreshDevice -> 'available'; all false -> 'unavailable'
it('writes the package status from the package stream', ...); // a02 { medium: true, package: false } -> main 'available', package 'unavailable'
it('never writes the source template', ...);
it('refreshes nothing for an unadopted or uncached device', ...); // false; properties.update not called
it('reports adoption', ...); // isAdopted('camera', adopted) true; unknown false; ('light', cameraId) false
```
`protect-adoption.service.spec.ts`:
```ts
it('records stream availability for the synchronizer', ...); // after an ENABLED adoption: store.get(id).availability equals the POST result booleans
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/services`
Expected: FAIL (store module not found; `refreshDevice is not a function`).

- [ ] **Step 3: Implement** the store, `streamStatusMappingNames`, the synchronizer members and the adoption call; add the
  store to the plugin's `providers`; give every `new ProtectSynchronizerService(` in specs a store.

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
- Consumes: Task 1 constants; Task 2 store, `isAdopted`, `refreshDevice`; F9, F12, F14; `toStreamAvailability`;
  `ProtectFailureLogLimiter`.
- Produces:
  ```ts
  @Injectable()
  export class ProtectStreamAvailabilityService implements OnModuleInit, OnModuleDestroy {
  	constructor(connector: ProtectConnectorService, synchronizer: ProtectSynchronizerService, store: ProtectStreamAvailabilityStore);
  	/** SECRET result. One paced GET rtsps-stream (deadline 8 000 ms, caller's signal); stores the booleans; on a change queues synchronizer.refreshDevice. Throws ProtectApiError (`unavailable` without a client). */
  	readStreams(cameraId: string, options?: { signal?: AbortSignal }): Promise<ProtectRtspsStreams>;
  	/** Fresh store entry, else one coalesced readStreams; on failure the last entry of any age, or null. Never throws. */
  	getAvailability(cameraId: string, options?: { signal?: AbortSignal }): Promise<ProtectStreamAvailabilityEntry | null>;
  }
  ```
- Rules (decided, D4): observer → for `modelKey === 'camera'`, `isAdopted`, `raw.state === 'CONNECTED'` and (no entry, or
  last seen state not `CONNECTED`) enqueue a background read; one read at a time, no duplicates, more than 256 waiting
  dropped (one limited line `UniFi Protect stream availability queue is full`). Session end: `store.clear()`, last-seen
  map and queue dropped, generation bumped (a late read stores nothing). Failed background reads log `UniFi Protect
  stream availability read failed (<category>)` through the limiter. Results are reduced to booleans in the statement
  that reads them, except the value `readStreams` returns.

- [ ] **Step 1: Write the failing tests** (fake timers; fake connector and client answering `rtsps-stream.json` with
  sentinel aliases; fake synchronizer; real store)

```ts
it('reads each adopted camera once after a session starts', ...); // three adopted CONNECTED cameras -> three reads, never two at once
it('skips unadopted cameras and other model keys', ...);
it('reads availability when a camera reconnects', ...); // DISCONNECTED then CONNECTED with an entry -> one read; CONNECTED again -> none
it('refreshes the camera status only when presence changed', ...); // same booleans -> refreshDevice not called; changed -> called
it('serves availability from the store for 60 s', ...); // 59 999 ms -> 1 read; 60 000 ms -> 2
it('joins a read already in flight', ...);
it('keeps the last entry when a read fails', ...); // 'timeout' after an entry -> old entry; without -> null
it('passes the deadline and the caller\'s signal', ...); // getRtspsStreams(id, { signal, deadlineMs: 8000 })
it('forgets everything when the session ends', ...); // store empty; queue not read; an in-flight read stores nothing
it('bounds the background queue', ...); // 257 cameras while the first read hangs -> at most 256 waiting; one warn line
it('never logs or throws a stream address', ...); // logger spies: no 'SENTINELALIAS', no 'rtsps://'
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

### Task 4: Shared verified TLS connect and the RTSP redirect guard

**Files:**
- Create: `client/protect-tls-connect.ts`, `services/protect-rtsp-response-guard.ts`
- Modify: `client/protect-https-agent.ts:74-148` (use the extracted function; behaviour unchanged)
- Test: `client/protect-tls-connect.spec.ts`, `client/protect-https-agent.spec.ts` (unchanged, must stay green), `services/protect-rtsp-response-guard.spec.ts`

**Interfaces:**
- Consumes: F7, F10; Task 1 constants.
- Produces:
  ```ts
  // client/protect-tls-connect.ts
  export interface ProtectVerifiedTlsOptions {
  	host: string;
  	port: number;
  	plan: ProtectTlsConnectPlan;          // from planProtectTls(host, settings), never built by hand
  	ca?: (string | Buffer)[];             // tests only (PROTECT_TRUSTED_CA)
  	handshakeTimeoutMs: number;
  	signal?: AbortSignal;
  	keepAlive?: { enabled: boolean; initialDelayMs: number };
  }
  /**
   * Resolves only with a socket whose leaf equals the pin (`pinned`) or that Node authorized (`verify`), renegotiation
   * disabled. Otherwise rejects ProtectApiError (operation 'tls'): tls_fingerprint_mismatch, tls_untrusted, timeout,
   * unreachable or cancelled, with the socket destroyed. Never resolves an unverified socket.
   */
  export function connectVerifiedProtectTls(options: ProtectVerifiedTlsOptions): Promise<{ socket: tls.TLSSocket; fingerprint: string | null }>;

  // services/protect-rtsp-response-guard.ts
  export type ProtectRtspGuardFailure = 'redirect' | 'header_too_large' | 'body_too_large' | 'malformed';
  export class ProtectRtspGuardError extends Error { readonly reason: ProtectRtspGuardFailure } // message `RTSP stream refused (<reason>)`
  /** Console -> go2rtc direction. Forwards every byte unchanged and in order; errors with ProtectRtspGuardError on a 3xx response, a text header over PROTECT_RTSP_MAX_HEADER_BYTES, a body over PROTECT_RTSP_MAX_BODY_BYTES or a malformed frame. */
  export class ProtectRtspResponseGuard extends Transform {}
  ```
- Guard parsing (decided, D12): at a message boundary, `0x24` (`$`) starts an interleaved frame (1 byte channel, 2 bytes
  big-endian length, payload); anything else is a text message up to `\r\n\r\n`, followed by `Content-Length` bytes of
  body. A text message starting `RTSP/` is a response: status `300`–`399` fails. A text message starting with a method
  (server request) passes. Chunks may split anywhere; the guard keeps at most one header in memory.

- [ ] **Step 1: Write the failing tests**

`protect-tls-connect.spec.ts` (loopback `tls.createServer` with `PROTECT_TEST_TLS` material from `test/support/protect-tls.ts`):
```ts
it('resolves a pinned connection whose leaf matches', ...); // server self-signed, plan pinned selfSigned fingerprint -> socket; fingerprint equals
it('rejects a pinned connection with another leaf', ...); // pin of the console cert -> 'tls_fingerprint_mismatch'; socket destroyed
it('resolves a verify connection with the server name and the test CA', ...); // servername 'fakeconsole.id.ui.direct', ca [PROTECT_TEST_TLS.ca]
it('rejects a verify connection to the self-signed leaf', ...); // no servername match -> 'tls_untrusted'
it('times out a handshake that never completes', ...); // raw net server that never answers -> 'timeout' after 5000 (fake timers)
it('rejects when the signal aborts', ...); // 'cancelled'
it('never resolves with authorized false in verify mode', ...); // stubbed tls.connect emitting secureConnect with authorized false -> 'tls_untrusted'
```
`protect-rtsp-response-guard.spec.ts`:
```ts
it('forwards interleaved frames and responses byte for byte at every split point', ...);
// RTSP/1.0 200 (CSeq, Content-Base: rtsps://h:7441/SENTINELALIASx/, Content-Length + SDP body) + two $-frames; for every split index the output equals the input
it.each([301, 302, 303, 307])('refuses any 3xx response (%i)', ...); // error reason 'redirect'; no byte of that response forwarded
it('lets a request from the server pass', ...); // 'SET_PARAMETER rtsp://h/x RTSP/1.0\r\nCSeq: 3\r\n\r\n'
it('refuses an oversized header or body', ...); // 16 KiB + 1 header -> 'header_too_large'; Content-Length 65 537 -> 'body_too_large'
it('refuses a malformed message', ...); // 'RTSP/1.0 abc\r\n\r\n', negative Content-Length -> 'malformed'
it('never puts message bytes into the error', ...); // error.message is exactly 'RTSP stream refused (redirect)'
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/client/protect-tls-connect.spec.ts src/plugins/devices-unifi-protect/services/protect-rtsp-response-guard.spec.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement** both modules; rewrite `ProtectHttpsAgent.createConnection` on top of
  `connectVerifiedProtectTls` (it keeps recording `lastPeerFingerprint` and refusing sockets after `destroy()`).

- [ ] **Step 4: Run to verify pass**

Run: the Step 2 command, then `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/client`
Expected: PASS, including the unchanged agent and client integration suites.

- [ ] **Step 5: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect
git add apps/backend/src/plugins/devices-unifi-protect
git commit -m "feat(backend): share the verified UniFi Protect TLS connect and guard RTSP redirects"
```

---

### Task 5: The stream TLS bridge

**Files:**
- Create: `services/protect-stream-bridge.service.ts`
- Modify: `apps/backend/test/support/fake-protect-server.ts`, `devices-unifi-protect.plugin.ts` (provider list only)
- Test: `services/protect-stream-bridge.service.spec.ts`, `services/protect-stream-bridge.integration.spec.ts`

**Interfaces:**
- Consumes: Task 1 constants; Task 4; F8, F10, F11, F12; `Go2rtcService` (`getStatus`, `getClient`, `subscribe`).
- Produces:
  ```ts
  export interface ProtectBridgeEndpoint { host: string; port: number } // where go2rtc connects
  export type ProtectBridgeVerification = 'verified' | 'unverified' | 'unknown';
  @Injectable()
  export class ProtectStreamBridgeService implements OnModuleInit, OnModuleDestroy {
  	constructor(connector: ProtectConnectorService, go2rtc: Go2rtcService, configService: ConfigService, @Optional() @Inject(PROTECT_TRUSTED_CA) trustedCa?: string);
  	/**
  	 * Opens or reuses the listener for (session generation, upstream, relay generation) and runs one verified pre-flight
  	 * handshake to `upstream`. Rejects ProtectApiError: tls_untrusted / tls_fingerprint_mismatch (verification failed),
  	 * unavailable (no session, relay not running, bind failure, external relay address unknown), timeout, unreachable.
  	 */
  	prepare(upstream: { host: string; port: number }, options?: { signal?: AbortSignal }): Promise<ProtectBridgeEndpoint>;
  	/** Last pre-flight or connection result for that upstream in the current session. */
  	getVerification(upstream: { host: string; port: number }): ProtectBridgeVerification;
  	get connectionCount(): number;
  }

  // test/support/fake-protect-server.ts (opt-in; default off keeps every existing ':7441' expectation)
  rtsps: boolean;                                    // FakeProtectServerOptions; when true, start() also opens a TLS RTSP endpoint
  rtspsPort: number;                                 // 0 until started; stream URLs then use it instead of 7441
  rtspsCertificate: 'mirror' | 'console';            // 'mirror' = protectTlsServerOptions(); 'console' = CA-signed leaf for every SNI
  readonly rtspRequestLines: string[];               // request lines received (memory only, never logged); cleared by reset()
  rtspAnswer(response: string | null): void;         // null = default `RTSP/1.0 200 OK\r\nCSeq: <n>\r\n\r\n`; a string replaces the next answer (e.g. a 302)
  ```
- Rules (decided, D1, D11, D12):
  1. *Listener*: address per D11; `listen(0)`; key change, session end (`connector.onSessionChange(null)`), relay status with
     another generation or mode, and `onModuleDestroy` close it and every connection. Relay not running →
     `unavailable`.
  2. *Accept*: count ≥ `PROTECT_STREAM_BRIDGE_MAX_CONNECTIONS` → destroy (`limit`); external mode and peer not in the
     relay's address set → destroy (`peer`). Then `connectVerifiedProtectTls({ host, port, plan:
     planProtectTls(host, config.tls), ca, handshakeTimeoutMs: 5000 })`; failure → destroy go2rtc's socket, record
     `unverified` for TLS categories (`tls`), never another attempt for that connection. Bytes from go2rtc read before
     verification are buffered (≤ 16 KiB, else destroy) and written after it.
  3. *Pipe*: go2rtc → console unchanged; console → `ProtectRtspResponseGuard` → go2rtc; `pipeline` both ways; either side
     ending or erroring destroys both. Idle: `setTimeout(PROTECT_STREAM_BRIDGE_IDLE_TIMEOUT_MS)` on both sockets, reset by
     traffic; expiry destroys both (`idle`).
  4. *Logs*: only `UniFi Protect stream bridge refused a connection (<limit|peer|tls|timeout|unreachable>)` and `UniFi Protect
     stream bridge closed a connection (<redirect|idle|ended|error>)` through `ProtectFailureLogLimiter`, plus debug
     `UniFi Protect stream bridge listening` (no address, port or URL in any line).

- [ ] **Step 1: Write the failing unit tests** (`protect-stream-bridge.service.spec.ts`: fake connector with session
  listener, fake `Go2rtcService` status/subscribe, a stubbed `connectVerifiedProtectTls` returning a `PassThrough` pair or
  rejecting, fake timers)

```ts
it('binds loopback for a managed relay', ...); // prepare -> endpoint.host '127.0.0.1'; server.address().address '127.0.0.1'
it('binds loopback for an external relay on localhost', ...); // baseUrl 'http://127.0.0.1:1984' -> '127.0.0.1'
it('admits only the external relay\'s addresses', ...); // baseUrl 'http://relay.lan:1984', lookup -> ['192.0.2.50']; peer 192.0.2.51 destroyed before connect; 192.0.2.50 piped
it('fails closed when the external relay address cannot be learnt', ...); // probe connect fails -> 'unavailable'
it('refuses while the relay is not running', ...); // 'unavailable'; no listener
it('reuses one listener per session and upstream', ...); // two prepare -> same port; one server
it('re-keys the listener when the upstream changes', ...); // prepare(host B) -> new port; old listener and its connections closed
it('closes every connection when the session ends', ...);
it('closes the listener when the relay generation changes', ...);
it('refuses the seventeenth connection', ...); // 16 open -> 17th destroyed; one 'limit' line
it('closes an idle connection after 60 s', ...); // no traffic 60 000 ms -> both destroyed; traffic at 59 999 ms resets
it('holds early bytes until the upstream is verified', ...); // client writes before verify resolves -> upstream receives them after, in order
it('reports verification per upstream', ...); // unknown -> verified after a good pre-flight; unverified after 'tls_fingerprint_mismatch'
it('never logs an address, a request line or an alias', ...); // logger spies: no 'SENTINELALIAS', no 'rtsp://', no '127.0.0.1:'
```

- [ ] **Step 2: Write the failing integration tests** (`protect-stream-bridge.integration.spec.ts`: real sockets,
  `FakeProtectServer.start({ rtsps: true })`, a raw `net` client in the test playing go2rtc)

```ts
it('pipes a verified pinned session byte for byte', ...);
// tls pinned (self-signed fingerprint); prepare({ host: '127.0.0.1', port: fake.rtspsPort }); client sends
// `OPTIONS rtsp://<endpoint>/${FAKE_PROTECT_ALIAS} RTSP/1.0\r\nCSeq: 1\r\n\r\n` -> receives 'RTSP/1.0 200 OK\r\nCSeq: 1\r\n\r\n';
// fake.rtspRequestLines[0] contains FAKE_PROTECT_ALIAS (the console got the alias over the verified hop)
it('pipes a verified session in verify mode', ...); // server_name 'fakeconsole.id.ui.direct', trustedCa = PROTECT_TEST_TLS.ca
it('fails closed on a wrong pin without forwarding a byte', ...);
// rtspsCertificate 'console' with the self-signed pin -> prepare rejects 'tls_fingerprint_mismatch'; a raw client connection is closed
// with zero bytes received; fake.rtspRequestLines empty
it('fails closed on an untrusted certificate in verify mode', ...); // no test CA -> 'tls_untrusted'; same assertions
it('closes both sides on a redirect from the console', ...);
// fake.rtspAnswer('RTSP/1.0 302 Found\r\nCSeq: 1\r\nLocation: rtsps://127.0.0.1:7441/x\r\n\r\n') -> client receives 0 bytes of it and sees 'close'
it('releases everything on module destroy', ...); // onModuleDestroy -> connect to the old port refused; no open handles
```
Fake console rules (decided): with `rtsps: true`, `start()` opens `tls.createServer` on `127.0.0.1:0` with the chosen
certificate; per connection it reads text requests (bounded 16 KiB), records each request line, answers the queued
`rtspAnswer` once or the default 200 with the request's `CSeq`; `streamMap` uses `rtspsPort` instead of `7441`;
`stop()` closes it.

- [ ] **Step 3: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/services/protect-stream-bridge`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement** the service, the fake console endpoint, and add the bridge to the plugin's `providers`.

- [ ] **Step 5: Run to verify pass**

Run: the Step 3 command with `--detectOpenHandles`, then
`pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/client/protect-api.client.integration.spec.ts`
Expected: PASS; no open handles; the client integration suite is unchanged (the RTSPS endpoint is opt-in).

- [ ] **Step 6: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect test/support/fake-protect-server.ts
git add apps/backend/src/plugins/devices-unifi-protect apps/backend/test/support/fake-protect-server.ts
git commit -m "feat(backend): bridge UniFi Protect camera streams over verified TLS"
```

---

### Task 6: Stream provider — profiles and source

**Files:**
- Create: `services/protect-stream-errors.ts`, `services/protect-stream.provider.ts`
- Modify: `services/protect-connector.service.ts`
- Test: `services/protect-stream-errors.spec.ts`, `services/protect-stream.provider.spec.ts`, `services/protect-connector.service.spec.ts`

**Interfaces:**
- Consumes: F1, F3, F11, F12, F13; Tasks 1–5.
- Produces:
  ```ts
  // services/protect-connector.service.ts
  /** Host of the connected session's configuration; null unless connected. */
  getConsoleHost(): string | null;

  // services/protect-stream-errors.ts
  export type ProtectStreamOperation = 'source' | 'snapshot' | 'bridge';
  /** D8. Fixed-text core exceptions only; never reads error.message or error.name. */
  export function toCameraProviderError(error: unknown, operation: ProtectStreamOperation): CamerasException;

  // services/protect-stream.provider.ts
  @Injectable()
  export class UnifiProtectStreamProvider implements ICameraStreamProvider {
  	constructor(connector: ProtectConnectorService, synchronizer: ProtectSynchronizerService, availability: ProtectStreamAvailabilityService, bridge: ProtectStreamBridgeService, configService: ConfigService);
  	getType(): string; // DEVICES_UNIFI_PROTECT_TYPE
  	listProfiles(device: DeviceEntity, options?: { signal?: AbortSignal }): Promise<CameraStreamProfile[]>;
  	resolveSource(device: DeviceEntity, profileId: string, options?: { signal?: AbortSignal }): Promise<CameraStreamSource>; // always transport 'rtsp'
  	// getSnapshot / getSnapshotMinIntervalMs: Task 7 (this task throws CameraUpstreamException from getSnapshot)
  }
  ```
- Rules (decided, D2, D3, D5, D8):
  1. *Device*: `device.type === DEVICES_UNIFI_PROTECT_TYPE`, string `protectDeviceId`, `protectModelKey` `'camera'` or null,
     a channel `camera.main`. Otherwise `listProfiles` → `[]`, `resolveSource` → `CameraProfileUnavailableException`.
  2. *Upstream host*: stored `streamHostOverride` when non-null and `isValidProtectHost` (non-null and invalid → no host,
     limited warning) else `getConsoleHost()`.
  3. *Profiles*: order and reasons per D5; `stream_tls_unverified` when `bridge.getVerification({ host, port:
     PROTECT_RTSPS_DEFAULT_PORT })` is `unverified` (the port of the last resolved URL is used when known in this session).
  4. *Source*: unknown profile → `CameraProfileUnavailableException`; console unavailable or camera not `CONNECTED` →
     `CameraOfflineException`; `availability.readStreams` error → `toCameraProviderError(e, 'source')`; URL null →
     `CameraProfileUnavailableException`; `parseProtectStreamUrl` null or no upstream host → `CameraUpstreamException`;
     `bridge.prepare({ host, port }, { signal })` error → `toCameraProviderError(e, 'bridge')`; return `{ url:
     buildBridgeStreamUrl(endpoint, alias), transport: 'rtsp' }`. The URL and alias are never assigned to a field, logged
     or put into an error.

- [ ] **Step 1: Write the failing tests**

`protect-stream-errors.spec.ts`:
```ts
it.each([
	['unavailable', 'source', CameraOfflineException], ['not_found', 'snapshot', CameraOfflineException],
	['rate_limited', 'snapshot', CameraRateLimitedException], ['timeout', 'source', CameraUpstreamException],
	['tls_fingerprint_mismatch', 'bridge', CameraProfileUnavailableException], ['tls_untrusted', 'bridge', CameraProfileUnavailableException],
	['unavailable', 'bridge', CameraUpstreamException], ['unreachable', 'bridge', CameraUpstreamException],
	['unsupported', 'snapshot', CameraUpstreamException], ['cancelled', 'source', CameraUpstreamException],
])('maps %s (%s) to %p', ...);
it('never carries the original message', ...); // new Error('rtsp://h/SENTINELALIASx') -> 'Camera did not respond'
```
`protect-connector.service.spec.ts`: `it('reports the connected host only while connected', ...)`.

`protect-stream.provider.spec.ts` (fakes for connector, synchronizer cache, availability, bridge; `ConfigService` mock;
devices with channels `camera.main` id `ch-main`, optionally `camera.package` id `ch-pkg`):
```ts
it('lists the default quality first and the package profile last', ...);
// default 'medium', { high: true, medium: false, low: false, package: true } -> ids ['medium','high','low','package'], reasons per D5, channelIds
it('lists no package profile without a package channel', ...);
it('reports console_unavailable without a request', ...); // getClient null; nvr mismatch
it('reports camera_offline for a disconnected camera without a request', ...);
it('reports stream_tls_unverified after a failed pre-flight', ...); // bridge.getVerification 'unverified' -> every profile; no availability read needed
it('reports stream_state_unknown when availability cannot be read', ...);
it('lists nothing for a device that is not a Protect camera', ...);
it('resolves a plain rtsp bridge source and never rtspx', ...);
// readStreams high 'rtsps://192.0.2.10:7441/SENTINELALIAShigh0123456789?enableSrtp', getConsoleHost '192.168.1.1', bridge.prepare -> { host: '127.0.0.1', port: 40123 };
// prepare called with { host: '192.168.1.1', port: 7441 }; result toEqual { url: 'rtsp://127.0.0.1:40123/SENTINELALIAShigh0123456789', transport: 'rtsp' }
it('reads the console on every resolve', ...); // two resolves -> readStreams twice
it('bridges to stream_host_override', ...); // override 'streams.example' -> prepare({ host: 'streams.example', port: 7441 })
it('fails closed on an invalid stored override', ...); // 'rtsps://x' -> CameraUpstreamException; bridge.prepare not called
it('fails closed when the bridge cannot verify the console', ...); // prepare rejects 'tls_fingerprint_mismatch' -> CameraProfileUnavailableException; no source returned
it('refuses a profile that is not enabled or unknown', ...);
it('maps console failures', ...); // readStreams 'unavailable' -> Offline; 'rate_limited' -> RateLimited
it('never logs or throws a stream address', ...); // logger spies and caught errors: no 'SENTINELALIAS', no 'rtsp'
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/services/protect-stream.provider.spec.ts src/plugins/devices-unifi-protect/services/protect-stream-errors.spec.ts src/plugins/devices-unifi-protect/services/protect-connector.service.spec.ts`
Expected: FAIL (modules not found; `getConsoleHost is not a function`).

- [ ] **Step 3: Implement** `getConsoleHost`, the error mapping and the provider (snapshot methods stubbed).

- [ ] **Step 4: Run to verify pass** — the Step 2 command. Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect
git add apps/backend/src/plugins/devices-unifi-protect
git commit -m "feat(backend): list UniFi Protect stream profiles and resolve bridged sources"
```

---

### Task 7: Stream provider — snapshots

**Files:**
- Modify: `services/protect-stream.provider.ts`
- Test: `services/protect-stream.provider.spec.ts`, `client/protect-api.client.integration.spec.ts`

**Interfaces:**
- Consumes: F5, F9, F11, F17; Task 6.
- Produces:
  ```ts
  getSnapshot(device: DeviceEntity, options: { channelId?: string; highQuality?: boolean; signal?: AbortSignal }): Promise<CameraSnapshot>;
  getSnapshotMinIntervalMs(device: DeviceEntity): number; // config snapshotMinIntervalMs clamped to 500–60 000, else 2 000
  ```
- Rules (decided, D6, D8): device per Task 6 rule 1, else `CameraProfileUnavailableException`; channel per D6; console
  unavailable or cached state not `CONNECTED` → `CameraOfflineException`; `client.getSnapshot(protectDeviceId, {
  highQuality, channel?: 'package', signal, deadlineMs: PROTECT_SNAPSHOT_DEADLINE_MS })`; `unsupported` with
  `highQuality: true` → one retry with `false`; other errors → `toCameraProviderError(e, 'snapshot')`.

- [ ] **Step 1: Write the failing tests**

`protect-stream.provider.spec.ts`:
```ts
it('takes a main snapshot without a channel parameter', ...); // undefined and 'ch-main' -> getSnapshot(id, { highQuality: false, signal, deadlineMs: 8000 })
it('takes a package snapshot', ...); // 'ch-pkg' -> channel 'package'
it('refuses an unknown channel without a request', ...);
it('requests full HD only when the camera supports it', ...); // flag false + hq -> false; flag true + hq -> true; flag true + no hq -> false
it('falls back once when the console refuses full HD', ...); // 'unsupported' then image -> 2 calls; twice -> CameraUpstreamException
it('answers offline without a request', ...); // getClient null; cached DISCONNECTED
it.each([['unavailable', CameraOfflineException], ['not_found', CameraOfflineException], ['rate_limited', CameraRateLimitedException], ['timeout', CameraUpstreamException]])(
	'maps a snapshot failure %s', ...);
it('reports the configured snapshot interval', ...); // 5000 -> 5000; missing -> 2000; 100 -> 500
it('never uses the bridge for snapshots', ...); // bridge.prepare not called
```
`protect-api.client.integration.spec.ts`:
```ts
it('sends the package channel and the HQ flag as query parameters', ...);
// getSnapshot('5f0000000000000000000a02', { highQuality: true, channel: 'package' }) -> fake.requests last query { highQuality: 'true', channel: 'package' }
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/services/protect-stream.provider.spec.ts src/plugins/devices-unifi-protect/client/protect-api.client.integration.spec.ts`
Expected: FAIL (snapshot tests); the integration test PASSES already (it pins existing client behaviour).

- [ ] **Step 3: Implement** the two methods.

- [ ] **Step 4: Run to verify pass** — the Step 2 command. Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect
git add apps/backend/src/plugins/devices-unifi-protect
git commit -m "feat(backend): serve UniFi Protect camera snapshots through the shared client"
```

---

### Task 8: Registration, readme and config descriptions

**Files:**
- Modify: `devices-unifi-protect.plugin.ts`, `devices-unifi-protect.plugin.spec.ts`, `models/config.model.ts:124-128`, `dto/update-config.dto.ts:130-136`
- Test: `devices-unifi-protect.plugin.spec.ts`

**Interfaces:**
- Consumes: F2, F19; Task 6 `UnifiProtectStreamProvider`.
- Produces (decided): `CamerasModule` appended to the plugin's `imports` (it also provides `Go2rtcService` to the bridge);
  `UnifiProtectStreamProvider` in `providers`; constructor injects `CameraStreamProviderRegistryService` and the provider;
  `onModuleInit` ends with `this.streamProviderRegistration = this.cameraStreamProviders.register(this.unifiProtectStreamProvider)`
  (`null` → one warn `UniFi Protect stream provider was not registered`); the class implements `OnModuleDestroy` and
  calls `dispose()`. Both `stream_host_override` descriptions become `Host name or IP address Smart Panel connects to for
  the console's camera streams instead of the console host` (the DTO keeps `Send null to clear it.`). Readme: the row
  becomes `| \`stream_host_override\` | Host Smart Panel connects to for camera streams instead of the console host | — |`;
  *What you get* gains `- Live view and snapshots of cameras and doorbells through the cameras module, with camera status
  that follows the console`; new section after *Control*:
  ```markdown
  ## Streams and snapshots

  - Each adopted camera offers the `high`, `medium` and `low` stream qualities, plus `package` on doorbells with a package camera; `default_stream_quality` is listed first. A quality that is not enabled on the console is listed as unavailable (`stream_not_enabled`): enable it in Protect, or adopt the camera again with streams enabled. The plugin never enables or deletes a stream on its own.
  - Live streams reach the console through a small bridge in Smart Panel that checks the console certificate exactly like the API connection (`tls.mode`). If the stream port presents a certificate that does not pass, live view stays unavailable (`stream_tls_unverified`); there is no unverified fallback.
  - The relay connects to the bridge on this machine. With an external relay on another host, the bridge accepts only that host, and the stream between Smart Panel and the relay is not encrypted.
  - Stream addresses are read from the console each time a live stream starts and are kept only in memory: they are never stored, logged or returned by the API.
  - `stream_host_override` replaces the host Smart Panel connects to for camera streams, for consoles that report an address Smart Panel cannot reach. The certificate must still pass `tls.mode`.
  - Snapshots use the same request pacing as every other console request, at most one per camera every `snapshot_min_interval_ms`. Full-HD snapshots are requested only from cameras that support them.
  - Camera status follows the console: `offline` while a camera is disconnected, `initializing` while it connects, `available` when a stream quality is enabled and `unavailable` when none is.
  ```

- [ ] **Step 1: Write the failing tests** (`devices-unifi-protect.plugin.spec.ts`)

```ts
it('registers the stream provider for the plugin type', ...);
it('releases the stream provider on destroy', ...);
it('logs once when the provider type is already taken', ...);
```
The provider-list test adds `ProtectStreamAvailabilityStore`, `ProtectStreamAvailabilityService`,
`ProtectStreamBridgeService`, `UnifiProtectStreamProvider`; the imports test (`:332`) adds `CamerasModule`; the readme test
adds `toContain('## Streams and snapshots')`, `toContain('stream_tls_unverified')`, `not.toContain('rtspx')`,
`not.toContain('Host clients use')`.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/devices-unifi-protect.plugin.spec.ts`
Expected: FAIL (registration, imports and readme assertions).

- [ ] **Step 3: Implement** the plugin changes and the two descriptions; regenerate locally with
  `pnpm run generate:openapi && git status --short` — expected: no generated file listed.

- [ ] **Step 4: Run to verify pass**

Run: the Step 2 command, then `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect src/modules/cameras`
and `pnpm --filter ./apps/backend run lint:deps`
Expected: PASS; no cycle naming `devices-unifi-protect` or `modules/cameras`.

- [ ] **Step 5: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect
git add apps/backend/src/plugins/devices-unifi-protect
git commit -m "feat(backend): register the UniFi Protect camera stream provider"
```

---

### Task 9: End to end, gates, epic status and PR body

**Files:**
- Create: `apps/backend/test/devices-unifi-protect-streams.e2e-spec.ts`
- Modify: `tasks/epics/EPIC-UNIFI-PROTECT.md:105`

**Interfaces:**
- Consumes: everything above; the boot, auth, config, `adoptBatch`, `eventually`, `record` and sweep helpers of
  `test/devices-unifi-protect-control.e2e-spec.ts:37-290, 404-428` (copy them; do not import between e2e files);
  `CamerasService`, `Go2rtcService`, `toGo2rtcSource`.
- Setup (decided): `FakeProtectServer.start({ cameraFixtures: ['cameras.json', 'cameras-doorbell.json'], rtsps: true })`;
  plugin TLS `pinned` with the self-signed fingerprint (as UP-9's e2e); adopt `600cefafd5f365d6f83c4ef3` with `stream: {
  enabled: false }` (only `high`) and `5f0000000000000000000a02` with streams on (`medium` and `package`); wait for
  `realtime_state: streaming`; `jest.spyOn(app.get(Go2rtcService), 'isRunning'|'getStatus'|'getClient')` report a running
  managed relay on `http://127.0.0.1:<unused port>` (as `test/cameras.e2e-spec.ts:209`; the relay itself is UP-3's).
  Source checks call `CamerasService.getProviderOrThrow` and `resolveSource`, then a raw `net` client in the test plays
  go2rtc against the returned URL.

- [ ] **Step 1: Write the e2e tests**

```ts
it('lists Protect profiles with availability and hints', ...);
// GET cameras/<600c> -> live_view true; ids ['medium','high','low']; medium { available: false, unavailable_reason: 'stream_not_enabled' }; a02 ends with package available
it('lists profiles without a second console read', ...); // two GET cameras within 60 s -> rtsps-stream GET count unchanged by the second
it('streams through the verified bridge', ...);
// resolveSource(…, 'high') -> transport 'rtsp', URL host 127.0.0.1, port != fake.rtspsPort, path FAKE_PROTECT_ALIAS, no 'enableSrtp';
// toGo2rtcSource(source) === source.url; raw client OPTIONS -> 'RTSP/1.0 200 OK'; fake.rtspRequestLines contains the alias
it('bridges to stream_host_override', ...); // patchConfig({ stream_host_override: 'localhost' }) -> new bridge port; OPTIONS works; restore null
it('fails closed when the stream port presents another certificate', ...);
// fake.set({ rtspsCertificate: 'console' }) (CA-signed leaf; pin is the self-signed one) -> resolveSource rejects (profile unavailable);
// GET cameras/<600c> -> every profile unavailable_reason 'stream_tls_unverified'; POST sessions -> 404; no byte reached a raw client;
// camera.main status unchanged; restore 'mirror'
it('refuses a session for a quality that is not enabled', ...); // POST sessions { profile: 'medium', transport: 'mse' } -> 404
it('serves a snapshot through the shared client', ...); // 200 image/jpeg; query { highQuality: 'false' }; second GET within 2 s -> no new request
it('asks for the package channel and for full HD only where supported', ...);
it('maps a console 503 to the offline answer', ...); // enqueue(/\/snapshot$/, { status: 503 }) -> 503
it('follows a camera offline and back', ...);
// DISCONNECTED frame -> status 'offline'; snapshot 503 without a request; CONNECTED -> one rtsps-stream GET, status 'available'
it('shows a stream disabled on the console as unavailable', ...); // setStreams(600c, []); resolve 'high' -> profile unavailable; status 'unavailable'
it('closes bridged connections when the plugin is disabled', ...); // open raw client; patchConfig({ enabled: false }) -> client 'close'; restore
it('never leaked a secret into responses, logs, events, the database, the config or diagnostics', ...);
// record GET plugin status, plugin devices, cameras status, /modules/extensions/services first; FAKE_PROTECT_API_KEY, 'SENTINELALIAS', FAKE_PROTECT_ALIAS
// absent from inspect([logSpies, emitSpies, observed]), SELECT * of the three device tables and every file under configDirectory;
// the material contains 'cameras/{id}/rtsps-stream' and 'stream bridge'; no 'rtspx' anywhere; fake.forbiddenHits 0; no POST after adoption in fake.writes
```

- [ ] **Step 2: Run**

Run: `pnpm --filter ./apps/backend exec jest --config ./test/jest-e2e.json test/devices-unifi-protect-streams.e2e-spec.ts --detectOpenHandles`
Expected: PASS, 13 tests, no open-handle report. Fix the test, not the product, unless a real defect shows.

- [ ] **Step 3: Prove two guards can fail**

(a) Temporarily make the bridge's accepted-connection debug line include the first request line; rerun Step 2 —
expected: the sweep FAILS on `SENTINELALIAS`. (b) Temporarily skip the pin check in `connectVerifiedProtectTls`; rerun —
expected: `fails closed when the stream port presents another certificate` FAILS. Restore both with `git checkout --
apps/backend/src/plugins/devices-unifi-protect` and rerun to PASS.

- [ ] **Step 4: Full gates**

```bash
pnpm run generate:spec
pnpm run generate:openapi
pnpm --filter ./apps/backend run lint:js
pnpm --filter ./apps/backend exec prettier --check "src/plugins/devices-unifi-protect/**/*.ts" "test/devices-unifi-protect*.ts" "test/support/fake-protect-server.ts"
pnpm --filter ./apps/backend run lint:deps
TZ=UTC pnpm run test:unit
pnpm --filter ./apps/backend exec jest --config ./test/jest-e2e.json test/devices-unifi-protect.e2e-spec.ts test/devices-unifi-protect-discovery.e2e-spec.ts test/devices-unifi-protect-adoption.e2e-spec.ts test/devices-unifi-protect-realtime.e2e-spec.ts test/devices-unifi-protect-control.e2e-spec.ts test/devices-unifi-protect-streams.e2e-spec.ts test/cameras.e2e-spec.ts test/cameras-live.e2e-spec.ts
git status --short
```
Expected: every command exits 0, except that `lint:deps` may report only the pre-existing findings recorded in PR #1642;
`git status` shows no generated file.

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
`feat(backend): provide UniFi Protect camera streams and snapshots`. Sections: Summary (3 bullets); Verified stream TLS
(D1, the go2rtc 1.9.15 facts, the residual-risk paragraph, D1b status); Bridge topology, access and lifecycle (D11); RTSP
inside the tunnel (D12, with the UP-20 checks); Profiles and reasons (D5); Availability reads and rate budget (D4); Camera
status ownership (D7); Error mapping (D8); Decisions D1–D12 as approved; Amendments A1–A10; Deviations ("Decisions
recorded" below); Test plan (commands of Tasks 1–9 with pass counts); Known limits (7441 certificate and redirect
behaviour unmeasured until UP-20; registered go2rtc streams keep an old bridge URL until idle; no periodic availability
sweep; `in_use` not written; package and offline snapshot behaviour synthetic; plain RTSP between Smart Panel and an
external relay on another host); `Closes #1186`; then `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

---

## Amendments after review (they win over the task text)

These refine details inside the approved D1–D11; no decision is reopened. Each entry gives the plan location, the code
reference, the rule and the tests to add.

- **R1 (critical) — listener keyed by relay, not by session.** *Where:* D1 residual risk, D3, D11 Port/Lifetime (updated
  inline), Task 5 rule 1 and tests. *Code:* go2rtc `internal/streams/producer.go:176-201` re-dials the same URL forever
  while a consumer is attached; the core reuses a registration while viewers hold leases
  (`modules/cameras/services/go2rtc-streams.service.ts:199-232, 403-411`). *Rule:* key the listener by `<relay mode, relay
  generation, bind address, upstream port>` (one listener per upstream port, so a stream registered against one port
  always reconnects to that port; CodeRabbit on #1649); it stays open while the plugin is enabled and the relay is running. A session end or an
  upstream change closes connections, not the listener. While no session exists an accepted connection is destroyed
  before any upstream connect. Each accepted connection reads its upstream at accept time: host = valid override, else
  `getConsoleHost()`; port = the listener's own upstream port (from its key); TLS = the current session's (R8). D3 known limit: "a
  rotated alias fails at the console until the stream is re-registered". D1 residual risk: while a listener is closed
  (plugin disabled or shut down) and go2rtc still holds its URL, a local process that binds the freed port can receive
  the alias. *Tests (Task 5):* replace `closes every connection when the session ends` with `keeps the port across a
  session restart and reaches the new upstream`, `destroys connections while no session exists without an upstream
  connect`, `closes connections but keeps the listener when the upstream changes`; `re-keys the listener when the
  upstream changes` is dropped.
- **R2 — one source budget for `resolveSource`.** *Where:* Task 1 constants, Task 6 rule 4, Task 5 `prepare()`. *Code:*
  `modules/cameras/services/cameras.service.ts:22` (10 s). *Rule:* `PROTECT_STREAM_SOURCE_BUDGET_MS = 9000`; the read gets
  `deadlineMs = min(PROTECT_STREAM_READ_DEADLINE_MS, budget − PROTECT_STREAM_BRIDGE_HANDSHAKE_TIMEOUT_MS)`; `prepare()`
  gets the remainder through `signal` and a deadline; the external probe connect is bounded by `GO2RTC_HTTP_TIMEOUT_MS`
  and `dns.lookup` is raced against the deadline. *Test (Task 6):* `fits the source resolution into the core's timeout`
  (fake timers: the read's deadline is `min(8000, 9000 − 4000)` = 5000 ms, so a 4.9 s read followed by a hanging
  pre-flight rejects by the 9 s budget, before the core's 10 s; a read slower than 5 s rejects at 5 s).
- **R3 — the redirect guard copies go2rtc's own parser.** *Where:* D12, Task 4 guard rules and tests, Task 5 rule 3.
  *Code:* go2rtc `pkg/rtsp/client.go:84-122`, `pkg/tcp/textproto.go:43-84`, `pkg/rtsp/conn.go:188-264`. *Rule:*
  1. The guard watches the go2rtc → console direction, without modifying it, for a `PLAY` request line. Before PLAY, a `$`
     from the console at a message boundary is `malformed`. After PLAY, messages are classified by their first 4 bytes
     as in `conn.go:205-216`: a `$` starts an interleaved binary frame (`$`, channel byte, 2-byte big-endian length) that
     is forwarded whole and skipped by the parser — it is never text-parsed (CodeRabbit on #1649); `RTSP` is a response;
     `OPTI TEAR DESC SETU PLAY PAUS RECO ANNO GET_ SET_` are requests; anything else is `malformed`.
  2. Lines end at LF with an optional CR; a header ends at the first empty line and is held whole until complete.
  3. In every text message the first line is split on single spaces into at most 3 parts; a part 2 matching
     `^[+-]?\d+$` with a value 300–399 is `redirect`. A response status must match `^\d{3}$`, else `malformed`.
  4. `malformed`: a header line starting with SP or HT; a duplicate `Content-Length` (case-insensitive); a
     `Content-Length` whose trimmed value does not match `^\d{1,5}$`.
  *Tests (Task 4), refused cases:* `OPTIONS 302 Found` with a `Location` header; a `$` frame before PLAY whose payload
  starts with `302 Found`; `RTSP 302 x`; and one accepted case, `forwards interleaved frames after PLAY`
  (a `$` frame whose payload contains `RTSP/1.0 302` passes untouched); `+302` and `0302`; LF-only line endings with a 302; a continuation line; a
  duplicate `Content-Length`. The guard therefore takes both directions' data (the go2rtc → console side read-only).
- **R4 — an `unverified` result expires.** *Where:* Task 5 `getVerification`, D5. *Code:* `cameras.service.ts:71-87` and
  `cameras.controller.ts:234` (an unavailable profile returns 404 and blocks `resolveSource`). *Rule:* `unverified`
  expires after `PROTECT_STREAM_AVAILABILITY_TTL_MS`; `getVerification` then reports `unknown`, so the profile is offered
  again and the pre-flight re-runs. *Test (Task 5):* `forgets a failed verification after 60 s`.
- **R5 — verification by endpoint.** *Where:* Task 5 Produces, Task 6 rule 3. *Rule:* `getVerification(upstream:
  { host: string; port: number }): ProtectBridgeVerification` returns the last result for that host and port in the
  current session, subject to R4; the provider passes each profile's own upstream host and port (CodeRabbit on #1649: a
  failing port must not block a healthy one on the same host).
- **R6 — fake RTSPS certificate per connection.** *Where:* Task 5 fake console rules. *Code:* `test/support/fake-protect-server.ts:286-288`
  (`set()` only merges options). *Rule:* the RTSPS server chooses its certificate per connection through `SNICallback`,
  reading `this.options.rtspsCertificate` live: `mirror` = the `protectTlsServerOptions()` logic, `console` = the console
  context for every SNI. `rtspsPort` is a property of the server instance, not an option. `reset()` clears the queued
  `rtspAnswer` and sets `rtspsCertificate` back to `mirror`.
- **R7 — fingerprint callback.** *Where:* Task 4 Produces and agent rewrite. *Code:* `client/protect-https-agent.spec.ts:195-198`
  (the fingerprint is recorded on a mismatch). *Rule:* `ProtectVerifiedTlsOptions` gains `onPeerFingerprint?:
  (fingerprint: string | null) => void`, called on `secureConnect` before the pin or `authorized` check; the agent sets
  `peerFingerprintValue` through it. Extra CAs use the agent's `withExtraCa`.
- **R8 — the bridge uses the session's TLS target.** *Where:* Task 5 rule 2, Task 6. *Code:* `client/protect-tls-policy.ts:20-51`;
  `modules/extensions/services/managed-service-manager.service.ts:961-972` (the config is saved before the restart).
  *Rule:* the connector exposes `getStreamTlsTarget(): { consoleHost: string; tls: ProtectTlsSettings } | null`, built from
  `startedConfig`, non-null only while connected. The bridge connects to the stream host and port with
  `planProtectTls(consoleHost, tls)`, so SNI, name verification and the pin are the API session's whatever the override
  is; it never reads the current config for TLS. *Test (Task 6):* `verifies the console name, not the override name`.
- **R9 — no retry storm for a failing camera.** *Where:* Task 3 rules. *Rule:* background reads record `attemptedAt` per
  camera; the observer enqueues only when there is no entry and no attempt in the last TTL, or on a not-`CONNECTED` →
  `CONNECTED` transition (subject to M11). *Test (Task 3):* `does not retry a failing camera on every frame`.
- **R10 — stale-while-refresh.** *Where:* Task 3 `getAvailability`. *Rule:* a stale entry is returned immediately and a
  background refresh is queued; a read is awaited only when there is no entry at all. *Test (Task 3):* `serves availability
  from the store for 60 s` becomes: after 60 000 ms the stale entry returns at once and one background read follows.
- **R11 — `prepare()` races.** *Where:* Task 5 rules. *Rule:* `prepare()` captures the session generation, the relay
  generation and `destroyed`, re-checks them after every await, and on a mismatch closes whatever it opened and rejects
  `unavailable`. Opening a listener is single-flight per key. External mode's allow-list is the probe socket's
  `remoteAddress` plus `dns.lookup(host, { all: true })`, normalised (strip `::ffff:`), frozen before `listen()`; the
  `connection` handler checks it synchronously as its first statement. *Tests (Task 5):* `closes a listener opened after
  the session ended`, `opens one listener for concurrent prepares`.
- **R12 — boot and e2e order.** *Where:* Tasks 2, 3, 5, 8. *Rule:* the `CamerasModule` import moves into the plugin's
  `imports` in Task 5 (the imports-length test becomes 6; Task 8 only registers). Tasks 2, 3 and 5 each end by also
  running `pnpm --filter ./apps/backend exec jest --config ./test/jest-e2e.json test/devices-unifi-protect` (the backend's
  `test:e2e` script is `jest --config ./test/jest-e2e.json`, `apps/backend/package.json:72`; the path pattern selects every
  Protect e2e file). Expected: PASS.
- **R13 — no bytes before verification.** *Where:* D11 Limits, Task 5 rule 2 and integration tests. *Rule:* accepted
  sockets are `pause()`d and not read until verification resolves, then `pipeline` starts; this replaces the 16 KiB hold
  buffer and its test (`holds early bytes until the upstream is verified` becomes `reads nothing from go2rtc before the
  upstream is verified`). Error listeners go on both sockets immediately. In the integration tests the raw client writes
  `OPTIONS …/${FAKE_PROTECT_ALIAS}` right after connecting; the fake records `rtspsBytesReceived` per connection, and the
  wrong-pin and untrusted-certificate cases assert 0.

Minor:
- **M1:** close the listener on any relay status `state !== 'running'` (`go2rtc-streams.service.ts:611`).
- **M2:** the full-HD snapshot fallback shares one 8 s deadline (`8000 − elapsed`); see `camera-snapshot.service.ts:111-113`.
- **M3:** clamp the snapshot interval with the existing `PROTECT_MIN/MAX/DEFAULT_SNAPSHOT_MIN_INTERVAL_MS`
  (`devices-unifi-protect.constants.ts:20-22`).
- **M4:** the bridge handshake timeout is 4 000 ms (below go2rtc's 5 s read deadline, `pkg/rtsp/client.go:21`), not the
  inspect timeout; the listener gets a server `error` handler.
- **M5:** accept rate limit of 32 handshakes per 10 s; list local connection exhaustion in the PR's Known limits.
- **M6:** the external probe port is inferred from the scheme (80/443) when the URL has none; the readme explains that a
  relay in another container whose traffic is NATed fails closed.
- **M7:** `refreshDevice` uses `previousRaw = raw` (no rename propagation) and counts toward `PROTECT_MAX_PENDING_FRAMES`.
- **M8:** the in-flight read map is keyed by session generation and dropped on session end.
- **M9:** line drift: `go2rtc-streams.service.ts:356-381` (secret registration); the prime notifies observers only on
  successful writes (`protect-synchronizer.service.ts:468-471`). `ACCEPTED_CONTENT_TYPES` is at
  `camera-snapshot.service.ts:27` on `ee241a75c` (the review's `:26` does not match this commit).
- **M10:** the PR body calls out A1 (#1186 acceptance criterion 3 still says `rtspx`); updating the issue text is left to
  the maintainer.
- **M11:** a reconnect read is skipped while the camera's entry is younger than 10 s (anti-flap); a skipped read is
  deferred, not dropped: one `unref()`ed timer per camera fires when the 10 s ends and enqueues the read (cleared on
  session end and module destroy). *Test (Task 3):* `reads a skipped reconnect when the anti-flap window ends`
  (CodeRabbit on #1649).

## Decisions recorded (for the PR body)

1. go2rtc never connects to the console: a plugin bridge opens TLS to the stream port with the API's own `verify`/`pinned`
   plan (shared verified-connect code) and fails closed (`stream_tls_unverified`); no `rtspx` or `rtsps-insecure` exists.
   D1b (a separate stream pin) waits for the 7441 certificate measurement.
2. The bridge listens on loopback for every shipped topology, and on the relay's route with a peer allow-list only for an
   external relay on another host; one listener per session, upstream and relay; 16 connections, 5 s handshake, 60 s idle.
3. The bridge drops any RTSP redirect from the console (go2rtc's only way around it) and rewrites nothing else.
4. The host in the console's URL is never used; `?enableSrtp` is dropped; an invalid stored override fails closed.
5. No alias cache: every stream start reads the console once; only presence booleans are cached (60 s TTL, per session).
6. Profiles list `high/medium/low` with the default first and `package` last, with five reason codes; the provider never
   creates a stream.
7. Snapshots request full HD only when supported (one fallback), map the package channel, skip offline cameras and never
   use the bridge.
8. The synchronizer now writes `camera.status`; `camera.source` stays the adoption constant; `in_use` is not written.
9. No cameras-core change. Changes outside the issue's file ownership: synchronizer, adoption (one call), connector
   (`getConsoleHost`), the API agent (uses the extracted verified connect), the fake console's RTSPS endpoint, plugin
   imports `CamerasModule`, two config descriptions.

## Self-review

**Spec coverage (issue #1186, design §4.3, §9.4, §10.1, §13, roadmap UP-10, maintainer direction of 2026-11-17):**

| Requirement | Task |
|---|---|
| `UnifiProtectStreamProvider` registered for the plugin device type | 8 |
| Profiles `high`/`medium`/`low` + `package` when `hasPackageCamera`; missing stream unavailable with a hint | 6 (D5, A6) |
| Stream source from `rtsps://…?enableSrtp` with `stream_host_override` — now through the verified bridge, never `rtspx` | 1, 4, 5, 6, 9 (D1, D2, A1) |
| No unverified TLS connection to the console (#1623) | 4, 5, 9 (D1) |
| Bridge bind address, access control, lifetime, ports, cap, timeouts | 5 (D11) |
| go2rtc RTSP absolute URLs and redirects | 4, 5 (D12) |
| Aliases in memory only | 5, 6, 9 (D3) |
| Snapshots with `highQuality` and `channel=package`, shared pacer, 503 ⇒ offline | 7, 9 (D6, D8) |
| `camera.status` and `camera.source` maintained | 2, 3, 9 (D7) |
| No alias in logs, responses, persisted properties or diagnostics, bridge included | 3, 5, 6, 9 (D9) |
| Never create or delete streams outside adoption | 6, 9 (D5) |
| D1b kept out of the tasks until the measurement confirms it | — (D1b) |
| Plan review findings | R1–R13, M1–M11 applied in "Amendments after review"; they win over the task text |

The review amendments were applied: D1's residual risk, D3's known limit and D11's Port and Lifetime are updated inline
(R1); every other finding is stated once in "Amendments after review" with its task and tests.

**Step scan:** every code step names its file, signatures and decided rules; test steps list names with fixture ids,
values, certificates and expected categories; verification steps carry commands and expected output. The bridge and
provider flows are rule lists, the guard's framing is a stated rule; the readme section and log texts are fixed copy.

**Type consistency:** `parseProtectStreamUrl`, `buildBridgeStreamUrl` and the constants (1) in 5–6;
`ProtectStreamAvailabilityStore`, `ProtectStreamAvailabilityEntry`, `streamStatusMappingNames`, `isAdopted`,
`refreshDevice` (2) in 3; `readStreams`, `getAvailability` (3) in 6; `connectVerifiedProtectTls`,
`ProtectVerifiedTlsOptions`, `ProtectRtspResponseGuard`, `ProtectRtspGuardError` (4) in 5;
`ProtectStreamBridgeService.prepare/getVerification`, `ProtectBridgeEndpoint`, `ProtectBridgeVerification`, the fake's
`rtsps`/`rtspsPort`/`rtspsCertificate`/`rtspRequestLines`/`rtspAnswer` (5) in 6 and 9; `getConsoleHost`,
`toCameraProviderError`, `UnifiProtectStreamProvider` (6) in 7–9. `stream_tls_unverified` is in
`PROTECT_PROFILE_UNAVAILABLE_REASONS` (1) and used in 6, 8 and 9.

**Review Focus:** items 1–5 each name their tests (Task 5 wrong pin and untrusted, Task 6 reason, Task 9 certificate swap;
Task 4 and 5 redirect; Task 2, 3 and 9 offline and back; Task 5 session end, re-key and relay change; Task 5 bind,
allow-list, cap and idle).

**Proportion:** 9 tasks for roughly 2,000 lines of source and tests; the plan carries decisions, signatures, rule lists,
fixture-based test names and fixed copy, and points to the UP-9 e2e harness, the API agent and the fake camera provider
for patterns.
