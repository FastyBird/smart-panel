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
- **`getPrivilegedWorkerSupport()`** is the end-to-end probe every provider's `privileged_setup` field (see
  [Manual Remedy Contract (D12)](#manual-remedy-contract-d12) below) is sourced from. Rather than only asking
  `sudo -n -l` whether the policy *would* allow it, it actually runs the exact command every privileged job
  itself uses — `sudo -n systemd-run --scope --quiet --unit=smart-panel-privileged-probe-<pid> /bin/true` —
  through the real sudoers grant (`/usr/bin/systemd-run *`, installed by `build/src/installers/linux.ts`'s
  `createSudoersRule()`). A sudoers rule can permit `-l` while the real invocation still fails for an unrelated
  reason (a wrong `NOPASSWD` tag, `systemd-run` missing from the elevated `PATH`, dbus unavailable, ...); only
  actually running the command tells the whole story. The probe's `reason` (`null` when `supported`) is the
  captured stderr verbatim (e.g. `"sudo: a password is required"`), or the architectural message for a
  platform with no privileged-worker support at all.
- **Caching.** A **positive** result is cached for the life of the process — once a privileged job has run
  successfully there is no operational reason it would stop working. A **negative** result on an otherwise
  capable platform is cached for only 60 seconds (`PRIVILEGED_WORKER_SUPPORT_NEGATIVE_CACHE_TTL_MS`): unlike a
  positive result, "no" can become "yes" purely from an administrator adding the sudoers grant, and without
  this short TTL that fix would silently require a full backend restart to take effect — the exact gap
  hardware acceptance testing hit on 2026-09-07. A platform with no privileged-worker support at all
  (`docker`/`home-assistant`/`development`) is cached forever too — no sudoers change can ever make it
  available there. Concurrent callers before the first result share one in-flight probe promise.
- **Stderr capture on failure.** `PrivilegedWorkerService` itself captures the spawned job's stderr (capped at
  4 KiB, `STDERR_CAPTURE_LIMIT_BYTES`) whenever the child fails to spawn or exits non-zero before ever
  reporting completion, and folds it into the job's `stderr`/`message` fields — so a real refusal reason (e.g.
  sudo itself rejecting the invocation) reaches the admin instead of a bare "Worker process exited with code
  1".

`TailscaleSetupService.install()` (RA-5) calls `run()` with `scripts/tailscale-setup.sh`
(`apps/backend/src/plugins/remote-access-tailscale/scripts/tailscale-setup.sh`, bundled via `nest-cli.json`
assets) and forwards every `onStatus()` tick as a `RemoteAccessModule.Setup.Progress` event.

## Manual Remedy Contract (D12)

Every provider plugin — Tailscale today, the milestone-2 Cloudflare Tunnel and milestone-3 WireGuard plugins
later — surfaces its own prerequisite checklist and privileged-setup availability through the same shape, so
the admin UI and the setup wizard need exactly one rendering path regardless of provider. This is a rule every
future provider plugin must follow, not a Tailscale-only convention:

- **Requirement**: `{ code, satisfied, message, remedy }`. `remedy` is always `null` once `satisfied` is
  `true`; otherwise it is `{ commands: string[], note: string | null }` — the exact console commands that
  satisfy this one requirement on the detected system, or (when no exact command applies — a non-apt system,
  or a platform the provider cannot run on at all) an empty `commands` array with a documentation/vendor link
  in `note` instead.
- **The remedy commands are never hand-authored copy.** They are produced by the same script/logic path the
  privileged installer itself runs — Tailscale's requirement builder shells out to its own
  `tailscale-setup.sh --print-plan` (see [Setup Script](#setup-script) below) to get the exact per-distro
  command list, rather than maintaining a second, parallel description that could silently drift from what
  the privileged `install` step actually executes. Every future provider plugin's own setup script must expose
  the equivalent read-only, side-effect-free `--print-plan` mode for the same reason.
- **`privileged_setup`**: `{ available: boolean, reason: string | null }`, sourced verbatim from
  `PlatformService.getPrivilegedWorkerSupport()` (see [Privileged Worker](#privileged-worker) above) and
  exposed on every provider's own status model (`RemoteAccessTailscalePluginPrivilegedSetupModel` today).
  Distinct from the `platform-supported` requirement, which only reports whether the *platform kind* is
  architecturally eligible — `privileged_setup.available` additionally reflects the *current* probe outcome,
  which can flip from unavailable to available without a backend restart once an administrator adds the
  sudoers grant.
- A provider prepared **entirely by hand** — every requirement already satisfied before the admin ever opens
  Smart Panel — is a fully supported end state, not merely a tolerated one: the requirements evaluation reports
  every requirement satisfied with `remedy: null` throughout, and the provider's own `start()` picks up the
  already-configured system exactly as if Smart Panel's own **Set up** action had run it.

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
- **`stop()`** clears the poller first, then runs `tailscale down` — never `tailscale logout`. `down` succeeding,
  or failing with one of the tolerated "nothing to bring down" outcomes (`needs-login`, `daemon-down`,
  `not-installed`, or the backend already reporting `Stopped` regardless of why `down` itself failed),
  transitions the managed service's own lifecycle state (`this.state`, distinct from the daemon's
  `BackendState`) to `stopped`. Any other failure (`permission-denied`, `timeout`, `unknown`, or a
  non-`TailscaleCliError`) transitions to `error`, records `lastError`, and throws
  `TailscaleNodeStopFailedException` after still reporting the status (see Lifecycle events below).
  `computeStatus()` reads `this.state` first (D2) and short-circuits to `disconnected` (empty
  `endpoints`/`proxyAddresses`) while `stopped`/`stopping`, or to `error` with the recorded message while
  `error` — instead of trusting whatever the daemon last reported. Serve is only ever applied while the mapped
  state is `connected` (see [Serve, Funnel, and Advisories](#serve-funnel-and-advisories) below), so a stopped
  node never carries a stale Serve endpoint either.
- **Lifecycle events.** `PROVIDER_STATUS` is emitted from three places: the poller's own tick (gated on
  `hasStatusChanged()`), `start()` (schedules an immediate tick via `schedulePoll(0)`, and additionally emits
  directly from its `catch` block when `set`/`up` fails, so a failed start is visible immediately rather than
  waiting for that first tick), and `stop()` (emits directly at the end of both the tolerated-success and the
  thrown-failure paths). A stopped/errored node's status is therefore visible to the rest of the system the
  moment `stop()` returns or throws — not only on the next live read or poller tick.
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

`refreshRequirements(reason)` re-evaluates, in order: `platform-supported` (short-circuits the rest to "not
evaluated" if it fails), then `binary-installed`+`version-supported`, `daemon-active`, and `operator-granted`
in parallel, caching the result for `getRequirements()`/`GET /status` to read. Every reason except the
poller's own `'periodic'` (`'start'`, `'permission-denied'`, `'setup-complete'`, `'status-read'` — all rare,
admin/lifecycle-triggered events, used by `start()`/`onConfigChanged()` gating among others) always performs a
fresh evaluation; `'periodic'` is throttled to at most once every five minutes, so the steady-state poll stays
at one `status --json` call per tick instead of also paying for the operator check's own extra CLI calls on
every tick. `evaluateRequirements()` is a backward-compatible alias that always forces a fresh
(`'status-read'`) evaluation. `daemon-active` is checked unprivileged (`systemctl is-active tailscaled`),
needing no sudo.

**Operator grant (D1).** `operator-granted` is verified via `tailscale debug prefs`
(`OperatorUser === os.userInfo().username`) rather than trusting a plain `status --json` call succeeding —
that call is read-only and succeeds for *any* local user regardless of the operator grant (`ipnauth.IsReadonlyConn`
upstream), which is exactly the false positive this check exists to close. `debug` is an unstable namespace
across Tailscale releases, so a `debug prefs` call that fails outright or whose output cannot be parsed falls
back to an idempotent **write probe** instead: `tailscale set --operator=<service user>`, harmless for the
current operator (it just re-asserts the same grant) and `permission-denied` for anyone else. Either path is
authoritative; the write-probe fallback exists purely for the case where `debug prefs` itself is unavailable,
not as a weaker substitute check. A `permission-denied` result means the setup script's `--operator=` step is
still missing (or was lost, e.g. by reinstalling `tailscaled`) — re-running **Set up** (idempotent), or
running the one-line remedy `GET /status` returns for this requirement
(`sudo tailscale set --operator=<service user>`), is the fix.

**Manual remedy (D12).** Every unsatisfied requirement carries a `remedy: { commands, note }` (`null` once
satisfied) — see [Manual Remedy Contract (D12)](#manual-remedy-contract-d12) above for the shape every
provider plugin follows. For `binary-installed`/`version-supported` the remedy is built by shelling out to
this plugin's own `tailscale-setup.sh --print-plan` (memoized so both codes share one script invocation when
evaluated together); for `daemon-active`/`operator-granted` it's a fixed one-line command; `platform-supported`
has no command at all, only a documentation link.

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

**Convergence timing.** `TailscaleServeService.apply()` runs from two call sites, both inside
`TailscaleNodeManagedService`: once per `computeStatus()` call, gated on `mapped.state === 'connected'`
(`Self.CapMap`/`Self.DNSName` are only meaningful then); and once, immediately, from `onConfigChanged()` —
the latter builds its own live status directly (`getStatusOrNull()` + its own `mapper.map()` call) rather than
calling `computeStatus()`, so a config change converges Serve/Funnel without waiting for the next poll tick.
`computeStatus()` itself is reached both by the poller's tick **and** by every live status read
(`TailscaleProviderService.getStatus()`, which backs both this plugin's own `GET status` and the remote-access
module's aggregated/live status calls) — so opening the Remote access page, or any live poll of `GET status`,
also re-applies and self-heals a drifted Serve/Funnel handler, exactly like a poll tick. A plain cache read
(`RemoteAccessStatusService.getCachedStatuses()`) never triggers it — only a live call does.

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

### Setup Job Status and Action Errors

`GET .../status` (`StatusController.getStatus()`) also returns two fields beyond the generic provider status:

- **`setup`** (`RemoteAccessTailscalePluginSetupJobModel`, nullable) — the last known privileged setup job
  (`POST /install`) since this process started: `job_id`, `state` (`running` | `complete` | `failed` |
  `timeout`), `step`, `message`, `updated_at`. Lets the admin setup wizard poll as a fallback to the
  `RemoteAccessModule.Setup.Progress` websocket event if it's lost, or if the page reloads mid-job.
- **`privileged_setup`** (`RemoteAccessTailscalePluginPrivilegedSetupModel`) — `{ available, reason }`, see
  [Manual Remedy Contract (D12)](#manual-remedy-contract-d12) above.

`SetupController`'s four mutating actions (`install`, `login`, `logout`, `reset-preferences`) map failures to
either `409 Conflict` (a transient condition — retry once it clears) or `422 Unprocessable Entity` (a
permanent refusal — fix the installation first):

| Status | `code` | Raised when |
| --- | --- | --- |
| 409 | *(none — `reason`/message only)* | A setup job is already running for this unit (`PrivilegedWorkerUnavailableException`), or a login is already in flight (`TailscaleLoginInProgressException`) |
| 409 | `operator-granted` or `daemon-active` | `login`/`logout`/`reset-preferences`'s own pre-check (`assertActionable()`) found the requirement unsatisfied before ever calling the CLI |
| 409 | `operator-not-granted` | ...the CLI call itself then failed live with `permission-denied` |
| 409 | `daemon-not-active` | ...the CLI call itself then failed live with `daemon-down` |
| 409 | `not-signed-in` | ...the CLI call itself then failed live with `needs-login` |
| 422 | `platform-unsupported` | `install` was called on a platform that cannot run privileged workers at all, or is blocked by the `FB_REMOTE_ACCESS_ALLOW_DEV` override |
| 422 | `privileged-worker-unavailable` | `install` was called on a capable platform whose privileged-worker probe currently fails (e.g. a missing sudoers grant) |

Every case carries a `message` with actionable "here's the fix" text (e.g. "Re-run `sudo smart-panel-service
install`, or add the sudoers grant from the installation guide."). The target wire contract (RA-27, #996,
epic decision D13) puts the machine-readable code at `error.details.code`, with the human message duplicated
at `error.details.reason`, in every environment, for both 409 and 422 responses; the two 409s with no `code`
above are string-thrown `ConflictException`s and, under that same contract, always yield `details.reason`
only, never `details.code`. As of this writing that contract is not fully in place yet: `GlobalErrorFilter`
— the only filter in the chain that would otherwise see these 409s — currently masks `error.details` down to
a generic `{ reason }` in production, so only a non-production request observes `error.details.code` today
(see the `mapActionError()` doc comment on `SetupController` for the exact gap). #996 closes it by adding
dedicated `ConflictException`/`UnprocessableEntityException` filters.

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
