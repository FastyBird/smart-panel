# Remote Access Architecture

This document describes the architecture of the remote-access system in the Smart Panel backend and admin:
the core `remote-access` module, the provider-plugin contract, and the delivered Tailscale and Cloudflare
Tunnel providers. WireGuard is deferred to a separate feature.

## Overview

Remote access lets an administrator reach a Smart Panel installation from outside the LAN without a public
IP address, port forwarding, dynamic DNS, or a hand-built reverse proxy. It is split into:

- **`modules/remote-access`** — owns the "how is this installation reachable" model: a provider registry, a
  ranked internal/external URL registry, posture advisories, status aggregation, and websocket events. It
  never shells out and never knows a provider's binary.
- **`plugins/remote-access-tailscale`** — the first provider. Wraps the `tailscale` CLI, runs a privileged
  one-time setup job, drives sign-in/sign-out, and manages the node as a `node` managed service.
- **`plugins/remote-access-cloudflare-tunnel`** — runs an unprivileged `cloudflared` child with a
  dashboard-managed tunnel token and contributes a configured public HTTPS hostname while connected.
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
└── REST  /api/v1/plugins/remote-access-tailscale/*  status · install · connect · disconnect · login · logout · reset-preferences
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
  getStatus(options?: { signal?: AbortSignal; fresh?: boolean }): Promise<RemoteAccessProviderStatus>;
  getSnapshot?(options?: { signal?: AbortSignal; fresh?: boolean }): Promise<RemoteAccessProviderSnapshot>;
  awaitObservationIdle?(): Promise<void>;
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

Provider observations enter through `RemoteAccessModule.Provider.Observation` or an authoritative
REST read. The module accepts them before publishing `RemoteAccessModule.Provider.Status`. Each accepted
provider, aggregate and URL snapshot carries a process `epoch` and increasing `revision`; timestamps
are informational. Committing the cache before notifying URL and proxy consumers keeps these views coherent.

- `getAggregatedStatuses()` / `getProviderStatus(type)` obtain a bounded provider observation. Concurrent
  requests share the provider's status and requirements work. Provider observations have a six-second
  budget and the module has a seven-second outer deadline. Abort signals reach CLI reads and Cloudflare
  metrics HTTP. Work still being reaped retains its observation slot; a timeout cannot create an
  accumulating queue of replacement reads. Disabled providers retain diagnostics but contribute no
  endpoints or proxy addresses.
- `getCachedStatuses()` serves synchronous URL, posture and proxy consumers without starting a live read.
- Ordinary GETs observe; they do not run node management, operator write probes, Serve/Funnel convergence
  or privileged setup. Explicit Re-check refreshes read-only requirements. Managed lifecycle/configuration
  work and background reconciliation own mutations.
- The admin module and provider stores reject stale revisions, reconcile independent provider/URL
  snapshots, buffer first-load events and resync through REST on an unknown backend epoch. Reconnection
  supersedes pending reads. Provider authentication metadata is never broadcast in shared events.

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
  without inspecting provider caches at all. This disables the URL/proxy registry contribution, not
  independently enabled providers. Disable a provider plugin to stop its connection.

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
local proxy would turn every remote client reaching it into "localhost". Connected providers contribute their declared local proxy addresses automatically: Tailscale while
Serve is active and Cloudflare Tunnel while its connector is connected. These contributions disappear
when the provider disconnects, is disabled, or the module is disabled.

## Privileged Worker

`PrivilegedWorkerService` now selects the installed, fixed root helper for application updates and
provider setup. Its application-controlled script transport remains available only while that helper
is absent, so existing installations can be migrated explicitly by a root operator.

**Locations:** `apps/backend/src/modules/system/services/privileged-worker.service.ts`,
`apps/backend/src/modules/system/scripts/privileged/helper.py` and `install-helper.py`.

```typescript
run(spec: {
  job?: 'update' | 'tailscale-setup' | 'cloudflared-setup';
  unit: string; script: string; args: string[]; env?: Record<string, string>;
  statusFile: string; timeoutMs?: number;                 // default 10 minutes
  unitType?: 'scope' | 'service';                         // legacy transport only
  mapStatus?: (raw: Record<string, unknown>) => Partial<PrivilegedJobStatus> | null;
  trackStatusHistory?: boolean;                          // excludes mapStatus
}): Promise<{ id: string }>
```

- **Protected transport.** The backend calls `sudo -n /usr/local/libexec/smart-panel/helper` with
  `run-job <job> <generated-UUID>`, adding an exact release version only for `update`. The helper runs Python
  in isolated mode and selects its worker from `/usr/local/libexec/smart-panel/jobs/`, using the
  root-owned `/usr/local/libexec/smart-panel/config.json`. Helper code, workers, configuration and
  their ancestors must be root-owned, without group/world write access or symlinks. The caller
  cannot select a script, unit, filesystem path, environment assignment, maintenance mode or
  command. The backend ignores its legacy `unit`, `script`, `env` and `statusFile` values in helper
  mode; setup accepts no arguments and updates accept one validated version.
- **Manager ownership.** The helper uses fixed transient services with `--collect --service-type=exec`,
  `KillMode=control-group`, bounded runtime and stop timeouts, and a cleared environment. It derives
  service identity, data/config/database paths and loopback health settings from protected
  configuration. The root helper exits after launch; the manager owns the worker outside the backend
  sandbox and cgroup. The update worker can therefore stop the backend and verify writer quiescence
  without waiting on its own launching sudo process. The job launch does not use `--wait`.

| Job | Fixed systemd service | Status under `/var/lib/smart-panel-privileged/` |
| --- | --- | --- |
| `update` | `smart-panel-update.service` | `update-status.json` |
| `tailscale-setup` | `smart-panel-remote-access.service` | `tailscale-setup-status.json` |
| `cloudflared-setup` | `smart-panel-remote-access-cloudflare.service` | `cloudflare-tunnel-setup-status.json` |

- **Root state and identity.** The helper owns `/var/lib/smart-panel-privileged/`, serializes its
  commands with a private lock, records the generated operation UUID, and removes the previous
  job's status before launch. Status files include `jobId`; the backend accepts helper status only
  when it matches the current job. It polls every three seconds, bounds helper status reads to
  64 KiB, and owns the public `id` and `updatedAt` fields. `mapStatus` adapts the updater's
  `status`/`phase`/`error` fields. A file cannot claim the service-reserved `timeout` state.
- **Durable setup history.** Tailscale setup uses `trackStatusHistory`: an atomic snapshot carries
  `jobId` plus at most 32 canonical stage reports. The backend validates the immutable prefix and
  terminal ordering, then delivers unseen reports in order. A directory watcher covers atomic
  renames; polling and durable history cover missed or coalesced notifications. Several fast stages
  can arrive together without introducing artificial delays. Cloudflare setup uses a job-bound
  snapshot; both providers forward accepted status through `RemoteAccessModule.Setup.Progress`.
- **Settlement and timeout.** The backend reserves each unit until settlement, independently of
  subscriber lifetimes. A successful service launcher exit is not completion. A stopped service
  without a terminal status fails after a final status read. Timeout calls the fixed helper's
  `stop-job <job> <UUID>`; the helper refuses a stale identity. An uncertain or still-active systemd
  probe keeps the helper job reserved. The root helper also rejects overlapping operations across
  all three fixed units and unresolved updater recovery state, including across backend restarts.
  Failed launch stderr is captured up to 4 KiB and exposed through the job's diagnostic fields.
- **Updater recovery.** Attempt metadata lives in the protected `update-attempt/` directory. The
  helper derives `UPDATE_OBSERVER_GID` from the installed service account; the updater grants group
  traversal (0710) and read-only attempt records (0640), while its lock and migration evidence stay
  private. The backend reads this state without writing it. On restart, signal-0 `EPERM` still
  denotes a live root worker, and one bounded observer awaits durable settlement. Malformed or
  unresolved recovery metadata fails closed. `clear-update-status` acknowledges terminal state
  only after the fixed updater unit is inactive and no recovery hold remains; it never bypasses a
  hold. Completion can precede unit exit, so a refused acknowledgement leaves the successful result
  and durable evidence for later reconciliation.
- **Capability probe.** `PlatformService.getPrivilegedWorkerSupport()` calls
  `sudo -n /usr/local/libexec/smart-panel/helper probe`. The helper validates its protected workers
  and executes a harmless bounded manager-owned job before returning protocol version 1 and the
  three supported operations. The backend requires that version and every required operation.
  A present but broken, unreadable, incompatible or refused helper makes privileged setup unavailable;
  it never activates the legacy transport. Helper presence also invalidates a cached legacy result,
  including a legacy probe that was already in flight. Positive results otherwise remain cached;
  negative results on capable platforms expire after 60 seconds, and concurrent callers share a
  probe. Docker, Home Assistant and development remain unsupported without probing; Tailscale's
  `FB_REMOTE_ACCESS_ALLOW_DEV` override remains plugin-local.
- **Legacy compatibility.** Only when the helper path is absent does support discovery retain the
  real `sudo -n systemd-run --scope ... /bin/true` probe and the previous script/environment launch
  contract. Existing update and setup callers use independent service units; legacy status paths
  remain below their existing application data directories. The legacy result is identified
  internally without changing the provider API models. An application release update alone does
  not grant the backend permission to install the protected helper or rewrite sudo policy.

The backend keeps `ProtectSystem=strict`. A root-owned systemd drop-in permits the helper's state
directory as a writable mount for the inherited sudo namespace; root ownership and mode 02750 still
prevent the application UID from writing there. Migration reloads systemd, and the CLI restarts an
already active backend to activate that mount exception. An inactive backend stays inactive.

New npm service installations and image builds provision the helper from a trusted root-owned
release and replace the Smart Panel policy's broad legacy grants. Existing installations require
an explicit root migration while privileged jobs are idle and no unresolved update attempt remains:
`sudo smart-panel-service migrate-privileges` for an npm installation, or
`sudo smart-panel-service migrate-privileges --install-type image --backend-root /root/trusted-backend-release`
for an image installation. The image source must be a separately verified, root-protected extracted
release containing `dist/`; an existing service-owned `current` tree is not a trusted source. Changing
ownership of previously service-writable application code cannot establish its provenance. Migration
also protects the image installation parent while preserving the historical release and recovery
evidence. The helper and worker behavior still require representative Linux/systemd and device
acceptance before a deployment is treated as verified.

### Helper validation

The backend Jest suites cover transport selection, incompatible probes, job-bound status and recovery.
`modules/system/scripts/privileged/test_helper.py` additionally exercises the parser, clean environment,
trusted paths, cancellation identity, terminal acknowledgement and migration holds. Its filesystem cases
require Linux root; run them in a disposable container, not by elevating the whole test runner on a host.
`test_install_helper.py` deliberately requires a disposable Docker container and
`SMART_PANEL_HELPER_CONTAINER_TEST=1`: it installs a real policy, runs `visudo` and `sudo`, checks
service-account permissions, and proves untrusted source/configuration cannot replace the policy.
`build/tests/update-worker-permissions.py` covers extraction under umask 0027, service-account readability
and ownership restoration after failed native builds. These automated results complement, rather than
replace, final systemd/update/provider acceptance on the released candidate.

## Image update migration runbook

### Stopped-service maintenance mode

The release worker defaults to `UPDATE_START_MODE=running-service`. The protected helper fixes
that value from its root-owned launch contract; the legacy public update executor sets it explicitly.
The compatibility procedure below invokes a reviewed worker directly as an operator; it is not a
helper command. Operators may use `UPDATE_START_MODE=stopped-maintenance` only with a reviewed,
private identity packet. An already inactive or failed installed service uses the
original stopped entry. For an eligible active service, the approved operator procedure first owns
the exact `smart-panel-update.scope` collision domain outside `smart-panel.service`, verifies the
installed release, updater/lock, service and database identities, then records and issues exactly one
ordinary stop. It must retain the same supervisor through the stop, worker and settlement. A failed
stop, pending job, changed identity, survivor or unavailable probe prohibits worker launch even if
the service later appears stopped. There is no automatic retry, force kill or restart of the old
release. This is not an API option or a recovery retry.

Before invoking the released worker, retain the exact target archive and worker SHA-256 values and
the expected current version, image base, status/attempt paths and database path. Newly generated
application and helper worker units use `KillMode=control-group`. Historical image
units may retain `KillMode=process`; the captured unit configuration is part of the recovery evidence.
Independent manager/cgroup checks and the operator's captured process roster remain necessary after
the ordinary stop under either configuration. The worker verifies
the canonical `current` link, systemd `ActiveState`, `MainPID`, `ControlPID`, pending job state,
systemd Manager process enumeration and the cgroup-v2 subtree. Manager replies must have the
expected typed array and complete tuples; blank, malformed, unknown-unit or failed replies are
unavailable, never empty. A removed original cgroup is accepted only when typed no-follow inspection
proves that directory absent with a stable parent/mount and independent process checks remain empty.
Symlinks, failed reads, malformed membership, recreated directories or surviving processes fail
closed. The worker rechecks this qualification after the backup, before switch and immediately before
the durable migration-entry checkpoint/CLI. It then creates a SQLite `.backup` snapshot, stages
the target worker in a private directory outside release trees, verifies the archive/worker hashes,
switches once, runs the target migration CLI and starts the target only after migration.  No old
release is started first, no automatic rollback/retry is performed, and migration/start/health
failures remain a durable recovery hold.

The operator must retain the command, exact environment packet, worker/target hashes, preparation
receipt and stop result, backup path, attempt record, migration log, target health, scope/child
settlement and cleanup readback. A private preparation failure is not a fabricated worker completion
or a worker-owned recovery record. The worker alone owns its attempt, backup, migration, target health
and completion. Do not pass `UPDATE_START_MODE` through the backend API or an ambient service
environment. The complete active-stop and already-stopped paths require real Linux/systemd integration
with the compiled target and representative SQLite data before staging use.

Image updates use a durable, root-written attempt record beside the public status file. In helper
mode both live under `/var/lib/smart-panel-privileged/`, with read-only metadata access for the backend;
legacy/operator invocations retain their existing status/attempt paths and permissions. The worker
takes an atomic installation lock before download/extraction and rejects a concurrent or unresolved
attempt. The record survives a backend restart and target-directory cleanup; an old timestamp or
missing lock is never treated as proof that a migration did not commit.

Before changing the `current` symlink or invoking the target release's TypeORM CLI and `dist/dataSource.js`, the
worker stops the exact service and verifies `ActiveState=inactive|failed`, `MainPID=0`, `ControlPID=0` and an empty
service cgroup. Read-only probe errors and finite deadline expiry fail closed. The target data source must set
`migrationsTransactionMode: 'each'`: ordinary migrations remain transactional, while migrations that deliberately
manage their own SQLite transaction and foreign-key PRAGMA can run without TypeORM's global `all`-transaction guard
rejecting them. The Nest `TypeOrmModule` configuration uses the same mode for optional automatic migrations
(`FB_DB_MIGRATIONS_RUN` remains disabled by default).

The worker persists a migration-entry checkpoint before invoking the CLI. A nonzero/unknown migration result or a
failed target start/health check leaves the target link, target directory, database and private attempt evidence in a
`recovery_required` hold; it does not automatically switch back to an older build, delete the target or claim that
database changes were rolled back. Only a failure proven before migration entry may perform verified cleanup and
restart the unchanged build. Completion is recorded only after the target service has a live main process and passes
the configured bounded health check. The restarted backend retains an active `starting` attempt instead of clearing
status or releasing update ownership prematurely.

The backend does not wait for an active worker to settle from a Nest initialization hook: it returns the listener to
the platform and observes the owner-bound attempt in one bounded, cancellable background task. This prevents the
restarted target from waiting on the worker while the worker waits for the target health route. The observer never
signals the worker, extends its deadline, clears a recovery hold or treats a later HTTP response as ordinary update
completion. The helper derives the local loopback health route from protected configuration; legacy
image launches must provide that route explicitly:
`/api/v1/modules/system/system/health`; readiness requires a parsed `data.status = 'ok'`, the expected target
version, a stable service main-PID/start identity and a resolved `current` release path.

If migration entered and the target later proves healthy after a `start_failed` hold, an explicitly reviewed operator
reconciliation may write the internal `reconciled` / `reconciled_post_migration` state with a bound durable receipt.
This is a resolved failure, not `complete`: the original public failed status and notification remain, the target and
database are retained, and the exact updater lock is released only after receipt/record readback and fresh ownership,
online-backup, migration-classification and three-spaced-health checks. No SQL, history edit, rollback, automatic
retry or old-image cleanup occurs during this reconciliation. A changed owner, busy/inconsistent backup, wrong target
or failed receipt/lock sync keeps the hold.

Before accepting an image update, verify the target data-source mode and migration set in a disposable SQLite
database, then run the exact legacy-worker target-CLI invocation. Retain the target version/hash, migration history,
exit status and bounded stdout/stderr privately. A symlink rollback is not evidence that database changes were rolled
back; per-migration commits and any recovery state must be checked separately.

Migration 26 has one deliberately narrow recovery contract. If its body completed on a verified, populated database
but the migration-history insert failed, and the resulting schema, ownership, links, FTS rows and SQLite integrity are
intact with only migration 26 missing from history, remove the external fault and rerun the ordinary target CLI. The
rerun records exactly one history row and a subsequent run is a no-op. This is not an automatic retry policy: never
invent a history row, edit migration state manually, replay an unknown or damaged database, or perform a destructive
restore. Any state outside those verified prerequisites stops the update and requires diagnosis/escalation.

## Manual Remedy Contract (D12)

Both delivered provider plugins — Tailscale and Cloudflare Tunnel —
surface their prerequisite checklists and privileged-setup availability through the same shape, so
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

- **Lifecycle and authentication are separate.** Provider administrative status includes managed lifecycle,
  authentication, the current operation and allowed actions. Disconnect preserves authentication and offers
  Connect again. Plugin enablement is persistent ownership: a manual Disconnect stops this session;
  disabling the plugin prevents automatic start after an application restart.
- **Connect** starts a stopped supervisor or reconciles an already-started disconnected node. Repeated
  Connect/Disconnect converges safely. The provider's `POST /connect` and `POST /disconnect` implement this
  behavior; generic Extensions start/stop semantics remain available separately.
- **Operation ownership.** Node, login and Serve mutations share `TailscaleOperationCoordinatorService`.
  Stop, disable and shutdown invalidate the lifecycle generation, cancel and reap login/management children,
  and suppress stale results/retries. Logout cancels work before revoking authentication; reset cancels work
  before clearing Serve and login state. A delayed observation cannot publish Connected after a newer stop.
- **`stop()`** runs `tailscale down`, never logout. Missing installation/login/daemon or an already stopped
  daemon can satisfy the stopped end state. Other failures record an error and throw
  `TailscaleNodeStopFailedException`; status and endpoint/proxy withdrawal reflect the managed lifecycle.
- **Observations and reconciliation.** GET reads lifecycle, authentication, requirements and daemon/Serve
  state together. The poller reconciles managed state and emits internal provider observations when it
  changes. Polling is five seconds during transitions and thirty seconds when stable. A failed action is
  observed promptly, and only the module emits accepted, ordered public status events.
- **Preferences.** `buildPreferenceFlags()` includes hostname, accept-DNS, accept-routes, SSH and operator,
  which are supported by `tailscale set`. `buildUpFlags()` additionally includes advertise-tags and
  login-server. Reconnecting uses flagless `up` when those up-only preferences already match, preserving
  compatible unmanaged preferences. Changed or unverifiable up-only preferences require complete managed
  flags and retain Tailscale's settings-conflict refusal. Only explicit Reset preferences uses `up --reset`.
- A login-server change signs out for reauthentication against the new control plane. Ordinary config changes
  apply the appropriate supported flags and reconcile Serve within the same operation ownership.
- **`factoryReset()`** stops/cancels work, clears Serve and logs out. No tailnet login remains afterward;
  this does not imply deletion of a non-ephemeral node from the vendor console.

### Requirements

A full observation refreshes read-only requirements: platform support, binary/version, daemon activity
and operator grant. Unsupported platforms short-circuit remaining requirements to unevaluated. Concurrent
checks share one observation; explicit Re-check and normal polls observe the current prerequisites.
`systemctl is-active tailscaled` is unprivileged.

**Operator grant.** `tailscale debug prefs` checks `OperatorUser` against the actual service user. A readable
`tailscale status --json` alone is insufficient because any local user can read it. On CLI variants where
prefs cannot be read, an idempotent `tailscale set --operator=<service user>` probe belongs only to explicit
setup/action reconciliation, never periodic or GET status reads. Missing grants carry the exact manual
remedy; rerun Set up or apply that command, then Re-check. Authentication logout can discard the profile
and its operator grant, requiring this repair before the next sign-in.

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

**Convergence timing.** Managed actions, configuration changes and background polling reconcile
Serve/Funnel while the node is connected. `computeStatus()` and provider/module GETs read the actual Serve
state without applying it. Opening the page therefore cannot mutate Serve, Funnel or node preferences.
Lifecycle generation checks prevent old reads or reconciliation from restoring endpoints after stop.

### Setup Script

**Location:** `apps/backend/src/plugins/remote-access-tailscale/scripts/tailscale-setup.sh`, run as unit
`smart-panel-remote-access`.

1. If `tailscale` is missing: on Debian/Raspberry Pi OS, add the official signed keyring + apt source for
   the detected `ID`/`VERSION_CODENAME` and install the package. On a non-apt system, install nothing and
   report `not-installed` with a pointer to the vendor's manual instructions. **Never** downloads and
   executes a script — only installs a signed package from the vendor's own repository.
2. `systemctl enable --now tailscaled`.
3. `tailscale set --operator=<service user>` — persists in the current Tailscale profile, so the backend
   can operate the daemon without sudo. Sign out can discard that profile and its operator grant
   (observed with Tailscale 1.102.5). In that case the card returns to Setup required: run **Set up** to
   restore the grant, then **Sign in**. Disconnect retains the profile and does not require this repair.
4. Writes the status file at each stage transition; a non-zero exit reports `failed`. Privileged-worker
   invocations also retain every report in job-scoped history, so a fast install/daemon/operator
   sequence is not lost between observations. Manual invocations without the job ID retain the
   original snapshot shape; `--print-plan` remains read-only.

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

`SetupController`'s mutating actions (`install`, `connect`, `disconnect`, `login`, `logout`,
`reset-preferences`) map expected failures to
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

Operation failures also use 409 with `operation-cancelled`, `operation-in-progress`, `plugin-disabled`,
`child-termination-failed` or `disconnect-failed` as appropriate. Unexpected CLI failures remain 500.
The action error contract preserves machine-readable codes at `error.details.code` and human reasons at
`error.details.reason` in production and development. Dedicated `ConflictException` and
`UnprocessableEntityException` filters preserve these safe structured details. String-thrown conflicts
have a reason but no invented code. Setup is owner-only; status, Connect, Disconnect and sign-in allow
owner/admin; logout and preference reset remain owner-only. Authentication-bearing responses use
`Cache-Control: no-store`.

## Cloudflare Tunnel Plugin

**Location:** `apps/backend/src/plugins/remote-access-cloudflare-tunnel/`.

The plugin supports Raspberry Pi and generic host deployments. Docker, Home Assistant and development
platforms report unsupported. Requirements cover platform, `cloudflared` installation/version (minimum
`2024.1.0`) and a configured tunnel token. Each unmet requirement carries a manual remedy; Re-check can
advance manual installation without a prior privileged job.

- The owner-only install action installs the signed vendor package through an independent systemd service,
  outside the backend's read-only mount namespace. It does not install a persistent root connector service.
- The `tunnel` managed service owns one unprivileged `cloudflared` child. The persisted token is accepted
  on configuration writes and omitted from reads; reads expose only `tunnel_token_configured`. The child
  receives it through `TUNNEL_TOKEN`, never a command-line argument, and captured stderr is redacted.
- Token/protocol changes restart the owned connector; a public-hostname-only change refreshes endpoints.
  Stop invalidates observations and polling, terminates the child with bounded SIGTERM/SIGKILL escalation,
  and retains ownership until it is reaped. Failed stop cannot start a duplicate connector. Background
  reconciliation recovers a crashed child while the managed service remains started.
- Local `/ready` establishes edge connectivity. It does not verify DNS, public TLS or the origin route.
  Connected status publishes `https://<public_hostname>` only when a hostname is configured, and
  contributes loopback proxy addresses. The hostname is configured separately in Cloudflare to route
  to this Smart Panel origin; end-to-end HTTPS/login/WebSocket checks remain distinct acceptance evidence.
- Reset stops the service and clears its token/hostname through configuration. Removing the token also
  withdraws endpoints; resetting local configuration does not delete the dashboard-managed tunnel.
- Provider status and admin stores use the same generation, bounded observation and ordered module
  publication contracts as Tailscale. Setup progress is observed through events with REST fallback.

## Events

`RemoteAccessModule.Provider.Observation` is an internal publication input. It is accepted/versioned
by the module before the admin-only events below are emitted.

| Event | Payload | Routing |
| --- | --- | --- |
| `RemoteAccessModule.Provider.Status` | accepted status with `enabled`, `epoch`, `revision` (never an auth URL, QR, or key) | admin room only |
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
