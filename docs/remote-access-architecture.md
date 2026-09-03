# Remote Access Architecture

This document describes the architecture of the remote-access system in the Smart Panel backend and admin:
the core `remote-access` module, the provider-plugin contract, and the first provider, `remote-access-tailscale`.

## Overview

Remote access lets an administrator reach a Smart Panel installation from outside the LAN without a public
IP address, port forwarding, dynamic DNS, or a hand-built reverse proxy. It is split into:

- **`modules/remote-access`** — owns the "how is this installation reachable" model: a provider registry, a
  ranked internal/external URL registry, posture advisories, status aggregation, and websocket events. It
  never shells out and never knows a provider's binary.
- **`plugins/remote-access-tailscale`** — the first provider. Wraps the `tailscale` CLI, runs a privileged
  one-time setup job, drives sign-in/sign-out, and manages the node as a `node` managed service.
- **`modules/api`** — gained a proxy-trust boundary (`ClientAddressService` / `TrustedProxyRegistryService`,
  from RA-1) that the whole HTTP/websocket surface uses, and that `remote-access` contributes to rather than
  owning.
- **`modules/system`** — gained `PrivilegedWorkerService` (from RA-3), extracted from the update executor so
  any privileged, long-running operation can reuse the same spawn/poll/timeout machinery.

Design source of truth: `docs/superpowers/specs/2026-09-02-remote-access-design.md`.

## Module and Provider Architecture

```
modules/remote-access                             (owns the URL/status/proxy-trust model)
├── RemoteAccessProviderRegistryService            register(provider) / getAll() / get(type)
├── RemoteAccessStatusService                      live poll + Provider.Status cache
├── RemoteAccessUrlService                         internal/external ranking, getUrl()
├── RemoteAccessPostureService                     module + pass-through advisories
├── RemoteAccessProxyContributionService  ───────► modules/api TrustedProxyRegistryService
└── REST  /api/v1/modules/remote-access/*          status · providers · providers/:type · urls

plugins/remote-access-tailscale                    (a provider, registered at onModuleInit)
├── TailscaleProviderService  ── implements ──────► IRemoteAccessProvider
├── TailscaleCliService                            execFile/spawn wrapper around `tailscale`
├── TailscaleStatusMapperService                   `status --json` → RemoteAccessProviderState
├── TailscaleNodeManagedService                    managed service "node" (start/stop/config/health)
├── TailscaleSetupService                          privileged worker (install, enable, grant operator)
├── TailscaleLoginService                          sign-in / sign-out / reset-preferences
└── REST  /api/v1/plugins/remote-access-tailscale/*  status · install · login · logout · reset-preferences
```

Every provider plugin implements `IRemoteAccessProvider` (`apps/backend/src/modules/remote-access/platforms/remote-access-provider.platform.ts`)
and registers itself with `RemoteAccessProviderRegistryService.register()` in its own `onModuleInit` —
exactly the same pattern as `ModulesTypeMapperService`/`PluginsTypeMapperService` and
`ExtensionsService.registerPluginMetadata()`. The module polls `getStatus()` on demand and caches the last
value it receives via the `RemoteAccessModule.Provider.Status` bus event; providers never resolve URLs for
other modules and never touch request handling directly.

```typescript
type RemoteAccessProviderState =
  | 'unsupported'      // platform cannot host this provider (docker, home-assistant)
  | 'not-installed'    // binary missing
  | 'setup-required'   // daemon stopped, operator missing, re-authentication needed
  | 'pending-auth'      // waiting for the admin to approve a login link
  | 'pending-approval' // device approval pending in the vendor console
  | 'connecting'
  | 'connected'
  | 'disconnected'     // installed and configured but intentionally down
  | 'error';

interface IRemoteAccessProvider {
  readonly type: string;                 // plugin type, e.g. 'remote-access-tailscale'
  readonly kind: 'mesh' | 'tunnel' | 'vpn' | 'external';
  readonly capabilities: { https: boolean; publicUrl: boolean; identityHeaders: boolean; ssh: boolean };
  getStatus(): Promise<RemoteAccessProviderStatus>;
}
```

`RemoteAccessProviderStatus` never carries an auth URL, QR code, or key material — those stay in a
provider's own owner/admin-gated REST endpoints (see [Tailscale Plugin](#tailscale-plugin) below).

## Key Services

### `RemoteAccessProviderRegistryService`

**Location:** `apps/backend/src/modules/remote-access/services/remote-access-provider-registry.service.ts`

An in-memory `Map<type, IRemoteAccessProvider>`. `register()` throws
`RemoteAccessProviderAlreadyRegisteredException` on a duplicate `type`.

### `RemoteAccessStatusService`

**Location:** `apps/backend/src/modules/remote-access/services/remote-access-status.service.ts`

Two read paths that serve different callers:

- `getAggregatedStatuses()` / `getProviderStatus(type)` — live `getStatus()` calls (used by the REST
  surface). Each call is raced against `REMOTE_ACCESS_PROVIDER_STATUS_TIMEOUT_MS` (5s); a provider that
  never settles, or whose promise rejects, becomes a synthesized `error` entry instead of hanging or failing
  the whole `Promise.all`. This is a race, not a cancellation — the provider contract has no abort signal,
  so a timed-out call keeps running in the background and its eventual settlement is ignored.
- `getCachedStatuses()` — a synchronous, cache-only read fed by the `RemoteAccessModule.Provider.Status`
  event (`@OnEvent`). Used by `RemoteAccessUrlService`, `RemoteAccessPostureService`, and
  `RemoteAccessProxyContributionService`, none of which can await a live call from a per-request code path.

A status is always cached (and returned) under its *registered* type, not whatever `status.type` a
misbehaving provider's payload claims — `normalizeStatusType()` corrects a mismatch and warns once per
provider type.

### `RemoteAccessUrlService`

**Location:** `apps/backend/src/modules/remote-access/services/remote-access-url.service.ts`

See [URL Resolution Order](#url-resolution-order) below.

### `RemoteAccessPostureService`

**Location:** `apps/backend/src/modules/remote-access/services/remote-access-posture.service.ts`

Recomputed fresh on every call (no caching — only ever read on demand by `GET /status`):

| Code | Trigger |
| --- | --- |
| `external-url-insecure` | The manual `external_url` uses `http://` |
| `forwarded-headers-without-proxies` | `trust_forwarded_headers` is on but `trusted_proxies` is empty |
| `public-exposure` | Any ranked external endpoint has `scope: 'public'` |

...plus a pass-through of every cached provider's own `advisories` (each tagged with `provider: status.type`
if the provider didn't already set one).

### `RemoteAccessProxyContributionService`

**Location:** `apps/backend/src/modules/remote-access/services/remote-access-proxy-contribution.service.ts`

See [Proxy Trust](#proxy-trust) below.

## URL Resolution Order

`RemoteAccessUrlService` mirrors Home Assistant's `helpers/network.py::get_url()`.

- **Internal URL** — `internal_url` from module config if set, otherwise `FB_APP_HOST`/`FB_BACKEND_PORT`
  (matching `LocationReplaceInterceptor`). Always private-scope.
- **External URLs** — the manual `external_url` (if set; `scope: 'public'`, `https` from its own scheme,
  `label: 'Manual external URL'`) plus every `connected` provider's cached `endpoints`. Read from
  `RemoteAccessStatusService.getCachedStatuses()` — never a live call, so `getUrls()` stays cheap enough to
  call from a per-request path.
- **Ranking** — HTTPS before HTTP, public before private, then original array order (manual URL first, then
  providers in registration order) as the final tiebreaker. `external[0]` is the `primaryExternalUrl`.
- **Disabled module** — `config.enabled === false` short-circuits to `{ internal, external: [], primaryExternalUrl: null }`
  without inspecting provider caches at all.

```typescript
getUrl(options: {
  requireHttps?: boolean;
  requirePublic?: boolean;
  allowInternal?: boolean;   // default true
  allowExternal?: boolean;   // default true
  preferExternal?: boolean;  // default false
}): string; // throws NoUrlAvailableException
```

The internal URL can never satisfy `requirePublic` (it is always private-scope by construction). Both
internal and external URLs are validated as **origin-only** — scheme, host, optional port; no path,
credentials, query, or fragment — by `IsRemoteAccessUrlConstraint`, deliberately kept separate from MCP's
path-tolerant `IsMcpOAuthPublicBaseUrlConstraint` (a reverse-proxy path prefix is a legitimate MCP need but
not a remote-access one).

`getCandidates()` is a separate, display-only list: non-internal LAN IPv4/IPv6 addresses (via
`systeminformation`, excluding link-local `fe80::/10` by CIDR check, not a string prefix) plus
`http://<hostname>.local:<port>`. It never throws — a detection failure just yields fewer candidates — and
is not part of the ranked `external` list.

`refresh()` recomputes the snapshot and emits `RemoteAccessModule.Urls.Changed` only when it actually
differs from the last one (`@OnEvent(PROVIDER_STATUS)` and `@OnEvent(CONFIG_UPDATED)` both trigger it).

## Proxy Trust

Before this module, `extractClientIp` was duplicated across the displays and websocket modules, accepted
`X-Forwarded-For`/`X-Real-IP`/`CF-Connecting-IP` from *any* peer, and the throttler keyed on the raw socket
address. Any tunnel terminating on the device therefore made every remote caller look local, and any LAN
host could spoof a loopback address to bypass permit-join.

`modules/api` now owns this as a shared boundary the whole HTTP/websocket surface resolves through:

- **`TrustedProxyRegistryService`** (`apps/backend/src/modules/api/services/trusted-proxy-registry.service.ts`) —
  a registry of named `TrustedProxySource` contributors (`{ id, addresses: () => readonly string[] }`).
  `addresses()` is read live on every `isTrusted()` call, not snapshotted at `register()` time, so a
  contributor whose set changes needs no re-registration. Two contributors exist today:
  - `ApiModule` registers the `env` source from `FB_TRUSTED_PROXIES` (comma-separated IPs/CIDRs) at
    bootstrap.
  - `RemoteAccessProxyContributionService` registers the `remote-access-module` source: the module config's
    `trusted_proxies` (only while `trust_forwarded_headers` is on) plus every `proxyAddresses` entry of a
    provider whose *cached* status is `connected`. When the module is disabled it contributes nothing,
    regardless of what the config still says.
- **`ClientAddressService.resolve(request)`** (`apps/backend/src/modules/api/services/client-address.service.ts`) —
  accepts a `FastifyRequest`, a plain `IncomingMessage`, or a socket.io `Handshake`, so the same resolution
  logic serves HTTP and websocket call sites. Returns
  `{ address, forwarded, secure, peer, ignoredForwardedHeaders }`.
  - Forwarded headers are honoured **only** when the socket peer is in the trusted set.
  - `X-Forwarded-For` uses the **right-most-untrusted** rule (same as Home Assistant's `trusted_proxies`):
    walk from the end, skip entries the registry already trusts (proxy hops), return the first untrusted
    one; if every entry is trusted, fall back to the left-most. A malformed entry aborts the whole walk back
    to the peer address — `X-Forwarded-For` is one ordered, trust-sensitive chain, so a corrupted hop
    invalidates it. `X-Real-IP` and `CF-Connecting-IP` are independent single values: an invalid one just
    falls through to the next header in the fallback order.
  - `ignoredForwardedHeaders` is `true` when an *untrusted* peer sent forwarding headers anyway. This is how
    a caller distinguishes "a real direct connection" from "an unrecognised proxy bound to loopback" (e.g. a
    stray local nginx, or `cloudflared`) — see below.
- `DisplayAwareThrottlerGuard.getTracker()`, the displays registration guard, the websocket connection
  address, and `McpOAuthProxyPolicyService.assertForwardedHeadersTrusted()` all resolve through
  `ClientAddressService`.

**The localhost privilege applies only to direct connections.** A loopback peer (`127.0.0.1`/`::1`) that
presents forwarding headers *without being trusted* is, by definition, a proxy: `resolve()` reports
`ignoredForwardedHeaders: true`, and callers that special-case "genuinely direct" (e.g. the display
registration guard's localhost bypass) MUST refuse that bypass in that case — otherwise an unrecognised
local proxy would turn every remote client reaching it into "localhost". A connected Tailscale node is the
one built-in exception: while `connected`, its `proxyAddresses` (`['127.0.0.1', '::1']` while Serve is
active) are contributed automatically, because the remote-access module itself controls that endpoint.

## Privileged Worker

**Location:** `apps/backend/src/modules/system/services/privileged-worker.service.ts`

Extracted, unchanged in observable behaviour, from `UpdateExecutorService`'s spawn/status-file pattern so any
privileged, long-running operation (an OS update, Tailscale setup, ...) can reuse it instead of
re-implementing it:

```typescript
run(spec: {
  unit: string; script: string; args: string[]; env?: Record<string, string>;
  statusFile: string; timeoutMs?: number;                 // default 10 minutes
  mapStatus?: (raw: Record<string, unknown>) => Partial<PrivilegedJobStatus> | null;
}): Promise<{ id: string }>
```

- Spawns `sudo -n systemd-run --scope --unit=<unit> [--setenv K=V ...] bash <script> [...args]`, detached and
  `unref()`'d.
- Tracks progress by polling `statusFile` every 3 seconds. A native script only ever needs to write
  `{ state: 'running' | 'complete' | 'failed', step?, message? }`; `id`/`updatedAt` are always
  service-owned, never trusted from the file. `mapStatus` lets a caller with a differently-shaped status file
  (the update worker's legacy `status`/`phase`/`error` fields) adapt it to that same shape before the
  service's own terminal-state detection runs. `state: 'timeout'` is reserved for the service itself — a
  file/mapper tick claiming it is rejected like an unrecognised state.
- One job per `unit` at a time (`PrivilegedWorkerUnavailableException` on a second concurrent job); the unit
  is released only on a terminal state (`complete`/`failed`/`timeout`), a spawn failure, or the child process
  exiting before ever reporting completion — never merely because the last `onStatus` subscriber
  unsubscribed.
- `PlatformService.supportsPrivilegedWorkers()` is `true` for `raspberry`/`generic` with systemd, `false` for
  `docker`/`home-assistant`/`development`. The Tailscale plugin's own `FB_REMOTE_ACCESS_ALLOW_DEV` override
  is plugin-local — it never changes the platform capability itself.

`TailscaleSetupService.install()` (RA-5) calls `run()` with `scripts/tailscale-setup.sh`
(`apps/backend/src/plugins/remote-access-tailscale/scripts/tailscale-setup.sh`, bundled via `nest-cli.json`
assets) and forwards every `onStatus()` tick as a `RemoteAccessModule.Setup.Progress` event.

## Tailscale Plugin

### CLI Wrapper

**Location:** `apps/backend/src/plugins/remote-access-tailscale/services/tailscale-cli.service.ts`

Every call goes through `execFile('tailscale', args, { timeout })` — never a shell string — and classifies
failures instead of leaking raw stderr:

```typescript
type TailscaleCliErrorKind =
  | 'not-installed' | 'permission-denied' | 'daemon-down'
  | 'needs-login' | 'settings-conflict' | 'timeout' | 'unknown';
```

Notable details:

- `getStatus()` parses `tailscale status --json` first and only inspects the exit code if parsing fails —
  real `tailscale status` exits non-zero whenever `BackendState !== 'Running'` even while still printing a
  fully valid document.
- Argument logging always redacts `--auth-key=`/`--authkey=` values (`***redacted***`), and a `file:<path>`
  value is left visible since the path itself isn't the secret — belt-and-suspenders alongside delivering
  the key only via an ephemeral `0600` file (see [Events](#events) and the Security section of the design
  spec).
- `spawnUp(args)` (used only by the interactive/auth-key sign-in flows, RA-5) returns the raw
  `ChildProcessWithoutNullStreams` so the caller can stream `stdout` incrementally; the plain `up()` awaits
  to completion for the managed service's own start-up path.

### Node State Machine

`TailscaleNodeManagedService` (`services/tailscale-node-managed.service.ts`) is the managed service
`owner: { kind: 'plugin', type: 'remote-access-tailscale-plugin' }`, `serviceId: 'node'`,
`activationPolicy: 'owner-enabled'`. `TailscaleStatusMapperService.map()` turns a parsed
`status --json` into a `RemoteAccessProviderState`:

| `BackendState` | `RemoteAccessProviderState` |
| --- | --- |
| `NoState` | `connecting` (transient: preferences not loaded yet) |
| `NeedsLogin`, `AuthURL` present | `pending-auth` |
| `NeedsLogin`, no `AuthURL` | `setup-required` (never signed in / needs re-login) |
| `NeedsMachineAuth` | `pending-approval` |
| `Starting` | `connecting` |
| `Running`, `Self.Online` | `connected` |
| `Running`, not online | `connecting` |
| `Stopped` | `disconnected` |
| `InUseOtherUser` / anything else | `error` |

CLI-level failures are classified before they ever reach the mapper: `not-installed` → `'not-installed'`,
`permission-denied` → `'setup-required'` ("The smart-panel operator has not been granted on tailscaled."),
`daemon-down` → `'setup-required'` ("The Tailscale daemon is not running."), anything else → `'error'`.

- **`start()`** never authenticates a node that has never signed in — it only re-applies preferences
  (`tailscale set`) and brings an already-keyed node up (`tailscale up`) when `evaluateRequirements()`
  passes and `mapper.hasExistingKey(status)` is true. It schedules the poller
  (`TAILSCALE_POLL_INTERVAL_TRANSITIONING_MS` = 5s while the state is settling,
  `TAILSCALE_POLL_INTERVAL_STABLE_MS` = 30s once stable) and only emits `PROVIDER_STATUS` when the mapped
  status actually changed since the last tick.
- **`stop()`** clears the poller and runs `tailscale down`. It never signs out — a node that was never
  brought up is expected to fail `down`, which is swallowed as a debug log, not an error.
- **`onConfigChanged()`** diffs the cached `login_server`: a change signs the node out (best-effort) and
  reports `{ restartRequired: true }` so it re-authenticates against the new control plane instead of
  silently keeping a key from the old one. Every other preference change is applied in place via
  `tailscale set` and reports `{ restartRequired: false }`.
- **`isHealthy()`** is `BackendState === 'Running' && Self.Online === true`, from a fresh `getStatus()` call
  (no network probe).
- **`factoryReset()`** (registered with `FactoryResetRegistryService`, priority 90) best-effort resets Serve
  configuration, then logs out; a node that was never installed or never signed in still reports success,
  since the desired end state (no tailnet state) already holds.
- **`buildPreferenceFlags(config)`** — `--hostname=`, `--accept-dns=`, `--accept-routes=`,
  `--advertise-tags=`, `--ssh=`, `--operator=<service user>`. **`buildUpFlags(config)`** adds
  `--login-server=`. `tailscale up` is always called with this complete managed set, never `--reset`, so a
  preference changed by hand outside Smart Panel surfaces as `settings-conflict` instead of being silently
  overwritten; the explicit "Reset preferences" action (RA-5, `TailscaleLoginService.resetPreferences()`)
  runs `up --reset` with the same flag set. Both flag builders are `public` so `TailscaleLoginService`'s
  sign-in flows reuse them instead of re-deriving the same set.

### Requirements

`evaluateRequirements()` (used by `start()`/`onConfigChanged()` gating and surfaced verbatim on
`GET /status` as a checklist) runs, in order: `platform-supported` (short-circuits the rest to
"not evaluated" if it fails), then `binary-installed`+`version-supported`, `daemon-active`, and
`operator-granted` in parallel. `daemon-active`/`operator-granted` are checked unprivileged
(`systemctl is-active tailscaled`, a `status --json` call), needing no sudo — a `permission-denied` result
means the setup script's `--operator=` step is still missing, and re-running **Set up** (idempotent) is the
fix.

### Serve, Funnel, and Advisories

Serve (HTTPS on the tailnet), Funnel (opt-in public exposure), and the advisory set below are RA-6's
addition on top of RA-4/RA-5's node lifecycle — `TailscaleStatusMapperService` intentionally only ever
produces the private IPv4/MagicDNS HTTP endpoints and an empty `advisories`/`proxyAddresses`; RA-6 layers the
Serve/Funnel endpoints, the `proxyAddresses: ['127.0.0.1', '::1']` contribution while Serve is active, and
this advisory computation on top, per the design spec:

| Endpoint | Condition |
| --- | --- |
| `http://<tailscale-ipv4>:<port>` | connected |
| `http://<dnsname>:<port>` | connected + MagicDNS |
| `https://<dnsname>` (private) | connected + Serve |
| `https://<dnsname>` (public) | connected + Serve + Funnel |

| Advisory | Trigger |
| --- | --- |
| `tailnet-https-disabled` | Serve requested but `Self.CapMap` lacks `https` |
| `funnel-not-allowed` | Funnel requested but the node lacks the `funnel` ACL attribute |
| `key-expiring` | `Self.KeyExpiry` within 14 days |
| `public-exposure` | Funnel active |
| `version-unsupported` | installed Tailscale older than `TAILSCALE_MIN_VERSION` (`1.66.0`) |

Commands: `tailscale serve --bg --https=443 --set-path=/ http://127.0.0.1:<port>`, `serve reset`,
`serve status --json`, `funnel 443 on|off`, `funnel status --json`.

### Setup Script

**Location:** `apps/backend/src/plugins/remote-access-tailscale/scripts/tailscale-setup.sh`, run as unit
`smart-panel-remote-access`.

1. If `tailscale` is missing: on Debian/Raspberry Pi OS, add the official signed keyring + apt source for
   the detected `ID`/`VERSION_CODENAME` and install the package. On a non-apt system, install nothing and
   report `not-installed` with a pointer to the vendor's manual instructions. **Never** downloads and
   executes a script — only installs a signed package from the vendor's own repository.
2. `systemctl enable --now tailscaled`.
3. `tailscale set --operator=<service user>` — persists in `tailscaled.state`, so the backend can operate
   the daemon without sudo from then on.
4. Writes the status file after each step; a non-zero exit reports `failed`.

### Development Override

`FB_REMOTE_ACCESS_ALLOW_DEV=true` is a **plugin-local** override, not a platform capability change:
`PlatformService.supportsPrivilegedWorkers()` stays `false` for `development` regardless. With the flag set,
`TailscaleSetupService.install()` throws `TailscaleSetupUnavailableException` immediately (never spawns a
privileged worker) and the plugin expects a locally-prepared `tailscale` binary with the operator already
granted; without the flag, the provider reports `unsupported` on `development`.

## Events

| Event | Payload | Routing |
| --- | --- | --- |
| `RemoteAccessModule.Provider.Status` | full `RemoteAccessProviderStatus` (never an auth URL, QR, or key) | admin room only |
| `RemoteAccessModule.Urls.Changed` | `{ internal, external, primaryExternalUrl }` | admin room only |
| `RemoteAccessModule.Setup.Progress` | `{ type, job, step?, state, message? }` | admin room only |

The websocket gateway's `ADMIN_ONLY_EVENT_PREFIXES` routes every `RemoteAccessModule.*` event to the
`ADMIN_ROOM` (joined automatically by owner/admin sockets at connection time), never to the wider
`EXCHANGE_ROOM` and never to a display — see
`apps/backend/src/modules/websocket/gateway/websocket.gateway.ts`.

## Testing

- **Unit:** `ClientAddressService` matrix (untrusted peer with headers, trusted peer, CIDR match,
  right-most-untrusted selection, IPv6, missing headers) in
  `apps/backend/src/modules/api/services/client-address.service.spec.ts`; `RemoteAccessUrlService` ranking
  and `getUrl()` option matrix; provider registry and status aggregation (including the timeout race);
  `TailscaleCliService` with a mocked `execFile` per classified failure kind; `tailscale up --json` two-block
  parsing (`extractJsonObjects()`) with fixtures; `TailscaleStatusMapperService` state mapping per
  `BackendState`; the managed service's start/stop/config-change/factory-reset paths; setup job progress and
  timeout; auth-key redaction in logs and errors.
- **E2E:** module endpoints with a fake provider registered in the test module; role gating (`@Roles`);
  events routed to the admin room only; throttler keyed by the forwarded client address behind a trusted
  peer.
- **Registration inventories:** the `node` managed service is covered by
  `managed-service-registration.inventory.spec.ts`; no row in the secret-removal spec, since no secret is
  ever persisted.
- **Admin (Vitest):** status store event handling and transformers, URL list and QR rendering, config form
  schemas bound to the generated `RemoteAccessModuleData*`/`RemoteAccessTailscalePluginData*` types, provider
  element discovery (`useRemoteAccessProviders.ts`).

Run the backend suite for this area:

```bash
cd apps/backend
npx jest "remote-access" --no-coverage
```
