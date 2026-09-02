# Remote Access — Implementation Plan

**Goal:** Make a Smart Panel installation reachable from outside the LAN without a public IP address, through
a core `remote-access` module and a family of provider plugins, starting with Tailscale.

**Architecture:** The `api` module owns client-address resolution behind trusted proxies. The
`remote-access` module owns the provider registry, the URL registry, posture advisories, status
aggregation and events. Provider plugins own their binary, their lifecycle as a managed extension service,
and their own typed REST surface. Privileged steps run through a worker runner extracted from the update
executor. Admin mirrors the module and each plugin. Panel is untouched.

**Spec:** `docs/superpowers/specs/2026-09-02-remote-access-design.md`

**Task:** `tasks/epics/EPIC-REMOTE-ACCESS.md`

**Tracking:** GitHub milestone "Remote access", one epic issue with one sub-issue per task below. Each PR
carries the task's PR title verbatim and closes its issue.

## Global constraints

- Do not edit generated files. Change backend Swagger sources, run `pnpm run generate:openapi`, and run the
  panel client rebuild only if `apps/panel/lib/api/` changes.
- Preserve tab indentation, import ordering, response envelopes, `{Module}Data{Name}` schema naming,
  `Api*Response` decorators before NestJS decorators, and `verb-module-resource` operation ids.
- Never build shell strings from configuration. Use `execFile`/`spawn` with argument arrays and timeouts.
- Never persist or log the Tailscale auth key or a Cloudflare tunnel token. Never put an auth URL in an
  event payload or a log line.
- No new npm dependencies. Node `child_process`, `systeminformation`, `qrcode` (admin) already exist.
- Keep start, stop and restart idempotent; keep CLI mode from starting managed runtimes.
- Every task is one small PR from its own worktree; do not push to `main`; wait for the Codex review and
  resolve every thread before calling a task done.
- Workers own only the files listed for their task. Shared files (`app.module.ts`, `app.main.ts`,
  `openapi.constants.ts`, `nest-cli.json`, locale indexes) are edited by appending, never reordering.

## Delivery and delegation map

Tiers follow the session rule: haiku for mechanical transcription, sonnet for standard implementation,
opus only for review seats where judgement matters. No implementation seat uses the session's top model.

| Task | Outcome | Dependencies | Model / effort | File ownership | PR title |
| --- | --- | --- | --- | --- | --- |
| RA-1 | Trusted-proxy client address resolution shared by throttler, displays and websocket | none | sonnet / high, review opus / medium | `modules/api` (new service), `modules/displays/utils`, `modules/websocket/utils`, `modules/auth/guards/display-aware-throttler.guard.ts` | `fix(backend): trust forwarded headers only from configured proxies` |
| RA-2 | `remote-access` module: config, registry, URL service, status, advisories, events, REST, OpenAPI | RA-1 | sonnet / high, review opus / medium | `modules/remote-access/**`, `app.module.ts` (append), websocket gateway routing table (one entry) | `feat(backend): add remote access module foundation` |
| RA-3 | `PrivilegedWorkerService` extracted from the update executor, platform capability flag | none | sonnet / medium | `modules/system/services/privileged-worker.service.ts`, `update-executor.service.ts`, `modules/platform` (one method) | `refactor(backend): extract privileged worker runner from update executor` |
| RA-4 | Tailscale plugin: CLI wrapper, status mapping, managed service, provider registration, status endpoint | RA-2 | sonnet / high | `plugins/remote-access-tailscale/**` except setup, `app.module.ts` (append), inventory spec (one row) | `feat(backend): add Tailscale remote access provider plugin` |
| RA-5 | Tailscale setup job, install endpoint, login with auth URL/QR or auth key, logout, reset-preferences | RA-3, RA-4 | sonnet / high, review opus / medium | `plugins/remote-access-tailscale/scripts/**`, `services/tailscale-setup.service.ts`, `services/tailscale-login.service.ts`, controller, `nest-cli.json` (append) | `feat(backend): add Tailscale setup and sign-in flows` |
| RA-6 | Serve HTTPS, Funnel, SSH, key-expiry and capability advisories, loopback proxy declaration | RA-4 | sonnet / medium | `plugins/remote-access-tailscale/services/tailscale-serve.service.ts`, advisories, managed service (apply step) | `feat(backend): serve admin over HTTPS through Tailscale` |
| RA-7 | Admin `remote-access` module: page, store, events, URL list with QR, settings form, provider slot | RA-2 | sonnet / high, locales haiku / low | `apps/admin/src/modules/remote-access/**`, `app.main.ts` (append), `openapi.constants.ts` (append) | `feat(admin): add remote access overview and settings` |
| RA-8 | Admin Tailscale plugin: provider card, setup wizard, config form, stores, locales | RA-5, RA-6, RA-7 | sonnet / high, locales haiku / low | `apps/admin/src/plugins/remote-access-tailscale/**`, `app.main.ts` (append), `openapi.constants.ts` (append) | `feat(admin): add Tailscale remote access setup wizard` |
| RA-9 | Image pre-installs Tailscale (disabled); installer `--with-tailscale`; build docs | none | sonnet / medium | `build/raspbian/**`, `scripts/install-server.sh`, `build/docs/INSTALLATION.md` | `feat(installer): preinstall Tailscale for remote access` |
| RA-10 | Website guide, network/extension/installation page updates, `docs/remote-access-architecture.md` | RA-2 (contract) | sonnet / low | `apps/website/app/docs/**`, `docs/remote-access-architecture.md`, `docs/extensions.md` | `docs(cross): document remote access and Tailscale setup` |
| RA-11 | MCP form suggests the primary external URL; MCP proxy policy consumes the shared trusted set | RA-2, RA-7 | sonnet / low | `modules/mcp/services/mcp-oauth-proxy-policy.service.ts`, `apps/admin/src/modules/mcp/components/mcp-config-form.vue` | `feat(cross): suggest remote access URL for MCP OAuth` |
| RA-12 | Integrated verification, hardware acceptance matrix, epic close-out | RA-1 to RA-11 | coordinator (session model) | any file only after worker hand-off | n/a |
| RA-13 | Cloudflare Tunnel backend plugin (milestone 2) | RA-3, RA-2 | sonnet / high, review opus / medium | `plugins/remote-access-cloudflare-tunnel/**` | `feat(backend): add Cloudflare Tunnel remote access plugin` |
| RA-14 | Cloudflare Tunnel admin plugin (milestone 2) | RA-13, RA-7 | sonnet / high | `apps/admin/src/plugins/remote-access-cloudflare-tunnel/**` | `feat(admin): add Cloudflare Tunnel remote access setup` |
| RA-15 | WireGuard client plugin, backend and admin (milestone 3) | RA-3, RA-2, RA-7 | sonnet / high | `plugins/remote-access-wireguard/**`, admin mirror | `feat(cross): add WireGuard client remote access plugin` |
| RA-16 | Replace `systemd-run *` sudo grant with a fixed root-owned helper (follow-up, separate epic) | RA-3 | opus / medium design, sonnet / high implementation | `build/**`, `scripts/**`, `modules/system/services/privileged-worker.service.ts` | `chore(installer): replace systemd-run sudo grant with fixed helper` |

Estimated sizes: RA-1 S, RA-2 M, RA-3 S, RA-4 M, RA-5 M, RA-6 S, RA-7 M, RA-8 M, RA-9 S, RA-10 S,
RA-11 S. Milestone 1 is RA-1 through RA-12.

### Lanes

1. **Foundation lane (serial):** RA-1 → RA-2. RA-3 runs in parallel with RA-1.
2. After RA-2 merges, four lanes run concurrently:
   - Backend Tailscale lane: RA-4 → RA-5 (needs RA-3) → RA-6.
   - Admin module lane: RA-7.
   - Installer lane: RA-9 (can start immediately; independent).
   - Docs lane: RA-10 (drafts from the spec; final pass after RA-6 and RA-8).
3. RA-8 starts when RA-6 and RA-7 have merged. RA-11 starts when RA-7 has merged.
4. RA-12 closes milestone 1. RA-13/RA-14, then RA-15, follow as separate milestones.

Each worker gets: the spec, this plan's section for its task, the task's file-ownership list, the PR title,
and the instruction to stop and report instead of widening scope.

---

## RA-1: Trusted-proxy client address resolution

### Contract

Add to `apps/backend/src/modules/api`:

```typescript
interface ResolvedClientAddress {
	address: string;      // canonical IPv4 or IPv6 text
	forwarded: boolean;   // true when taken from a forwarded header through a trusted peer
	secure: boolean;      // X-Forwarded-Proto === 'https' from a trusted peer, else request protocol
	peer: string;         // raw socket address
}

@Injectable() class TrustedProxyRegistryService {
	register(source: { id: string; addresses: () => readonly string[] }): void; // IPs or CIDRs
	unregister(id: string): void;
	isTrusted(peer: string): boolean;
}

@Injectable() class ClientAddressService {
	resolve(request: FastifyRequest | IncomingMessage | Socket['handshake']): ResolvedClientAddress;
}
```

### Behaviour

- Peer not trusted: return the socket address; if forwarded headers are present, log a warning once per
  peer per hour and ignore them.
- Peer trusted: take the right-most `X-Forwarded-For` entry that is not itself trusted; fall back to
  `X-Real-IP`, then `CF-Connecting-IP`, then the peer. Invalid addresses in the header fall back to the
  peer.
- Sources: env `FB_TRUSTED_PROXIES` (comma-separated, registered at bootstrap so operators behind an
  existing reverse proxy can opt in before RA-2 lands) plus whatever later registers (RA-2).
- Replace both `extractClientIp` implementations (`modules/displays/utils/ip.utils.ts`,
  `modules/websocket/utils/ip.utils.ts`) with calls into the service; keep `isLocalhost()` semantics on
  the resolved address.
- `DisplayAwareThrottlerGuard` overrides `getTracker()` to return the resolved address.
- MCP is untouched in this task (RA-11 unifies it).

### Tests

- Unit matrix: untrusted peer with `X-Forwarded-For`, trusted peer single hop, trusted chain with two
  trusted hops, CIDR IPv4 and IPv6, malformed header, missing header, `X-Forwarded-Proto` secure flag.
- Displays registration guard: spoofed loopback from an untrusted LAN peer is rejected without permit-join;
  a genuine loopback peer is accepted; a trusted loopback proxy forwarding a LAN client is treated as that
  client.
- Throttler e2e: two clients behind one trusted proxy get separate buckets.

**Verification:** targeted specs in `api`, `displays`, `websocket`, `auth`; `pnpm run lint:js`,
`lint:api`; one e2e file for the registration guard.

---

## RA-2: Remote access module foundation

### Contract

Folder `apps/backend/src/modules/remote-access/` with the weather-module layout: `controllers/`, `dto/`,
`models/`, `services/`, `platforms/remote-access-provider.platform.ts` (the `IRemoteAccessProvider`
interface and types from the spec), `remote-access.constants.ts`, `remote-access.exceptions.ts`,
`remote-access.module.ts`, `remote-access.openapi.ts`.

Constants: `REMOTE_ACCESS_MODULE_PREFIX = 'remote-access'`, `REMOTE_ACCESS_MODULE_NAME =
'remote-access-module'`, `REMOTE_ACCESS_MODULE_API_TAG_NAME = 'Remote access module'`, `EventType`
enum with `PROVIDER_STATUS = 'RemoteAccessModule.Provider.Status'`, `URLS_CHANGED =
'RemoteAccessModule.Urls.Changed'`, `SETUP_PROGRESS = 'RemoteAccessModule.Setup.Progress'`.

Services:

- `RemoteAccessProviderRegistryService` — `register`, `getAll`, `get(type)`; duplicate type throws.
- `RemoteAccessUrlService` — `getUrls()`, `getUrl(options)`, `NoUrlAvailableException`; ranking per spec;
  emits `URLS_CHANGED` on change.
- `RemoteAccessStatusService` — aggregates provider statuses, caches the last status per provider, listens
  to `PROVIDER_STATUS` and stores its full payload (state, endpoints, message, details, proxyAddresses,
  advisories, updatedAt) so nothing needs a refetch, recomputes URLs and advisories.
- `RemoteAccessPostureService` — module-level advisories: `external-url-insecure` (HTTP external URL),
  `forwarded-headers-without-proxies` (flag on, empty list), `public-exposure` (any public endpoint),
  plus pass-through of provider advisories.
- `RemoteAccessProxyContributionService` — registers a `TrustedProxyRegistryService` source combining
  module config and connected providers' `proxyAddresses`.

Config model `RemoteAccessConfigModel` (`ConfigModuleDataRemoteAccess`) and DTO
(`ConfigModuleUpdateRemoteAccess`) with the five fields from the spec; a dedicated
`IsRemoteAccessUrlConstraint` (absolute origin: scheme, host, optional port; no path, credentials, query or
fragment), separate from MCP's validator, which keeps accepting a reverse-proxy path prefix.

### API

The four endpoints from the spec, `@Roles(UserRole.ADMIN, UserRole.OWNER)`, `RemoteAccessModuleRes*`
envelopes, all models registered in `REMOTE_ACCESS_SWAGGER_EXTRA_MODELS`, extension metadata registered
with a readme. Route registered in `app.module.ts` under `MODULES_PREFIX`.

### Events

Websocket gateway: add `RemoteAccessModule.` to the exchange-room-only routing next to
`SystemModule.System.Update.`.

### Tests

- Registry, ranking matrix, `getUrl` option matrix, advisories, proxy contribution updates on provider
  status change, config validation (path rejected, credentials rejected, CIDR list).
- Controller specs with a fake provider; e2e for the four endpoints and role gating; gateway routing test.

**Verification:** targeted specs; `pnpm run generate:openapi` exits 0 with `FB_DB_PATH=$(mktemp -d)`;
`lint:js`, `lint:api`, `lint:openapi`.

---

## RA-3: Privileged worker runner

### Contract

```typescript
interface PrivilegedJobSpec { unit: string; script: string; args: string[]; env?: Record<string, string>; statusFile: string; timeoutMs?: number; }
interface PrivilegedJobStatus { id: string; state: 'running' | 'complete' | 'failed' | 'timeout'; step?: string; message?: string; updatedAt: string; }

@Injectable() class PrivilegedWorkerService {
	run(spec: PrivilegedJobSpec): Promise<{ id: string }>;   // throws PrivilegedWorkerUnavailableException
	getStatus(id: string): PrivilegedJobStatus | null;
	onStatus(id: string, handler: (status: PrivilegedJobStatus) => void): () => void;
}
```

### Behaviour

- Move the `spawn('sudo', ['-n', 'systemd-run', '--scope', '--unit=<unit>', ...])`, detached-and-unref,
  status-file polling (3 s), hard timeout (10 min default) and stale-lock logic out of
  `UpdateExecutorService`, which becomes a thin caller with identical observable behaviour.
- One job per unit at a time; a second `run` for a busy unit throws.
- `PlatformService.supportsPrivilegedWorkers()` — true when `sudo -n /usr/bin/true` succeeds and
  `systemd-run` exists; cached; false on `docker`, `home-assistant`, `development`. The development
  override `FB_REMOTE_ACCESS_ALLOW_DEV` belongs to the Tailscale plugin (RA-4, RA-5) and never changes
  this capability.

### Tests

- Existing update-executor specs pass unchanged.
- New specs: spawn arguments, status-file parsing, timeout to `timeout`, busy unit, unavailable platform.

**Verification:** `modules/system` and `modules/platform` specs; manual `smart-panel update` dry run on
a Pi is part of RA-12.

---

## RA-4: Tailscale plugin core

### Contract

Folder `apps/backend/src/plugins/remote-access-tailscale/` with constants
(`REMOTE_ACCESS_TAILSCALE_PLUGIN_PREFIX = 'remote-access-tailscale'`, `..._PLUGIN_NAME =
'remote-access-tailscale-plugin'`, `..._API_TAG_NAME = 'Remote access Tailscale plugin'`,
`TAILSCALE_MIN_VERSION`), config model and DTO from the spec (`RemoteAccessTailscalePluginDataConfig`,
`RemoteAccessTailscalePluginUpdateConfig`), `services/tailscale-cli.service.ts`,
`services/tailscale-status-mapper.service.ts`, `services/tailscale-node-managed.service.ts`,
`services/tailscale-provider.service.ts` (implements `IRemoteAccessProvider`), `controllers/status.controller.ts`,
`models/status.model.ts` (`RemoteAccessTailscalePluginDataStatus`, `...DataRequirement`), `plugin.openapi.ts`.

### Behaviour

- CLI wrapper as specified: `execFile` with argument arrays, 15 s default timeout, error classification,
  argument logging with redaction of any `--auth-key=` value.
- Status mapper: `status --json` fixture → provider state, endpoints (IPv4 and MagicDNS HTTP), details
  (tailnet, DNS name, IPs, version, health warnings), `keyExpiresAt`.
- Managed service `node`: prerequisite checks (binary, daemon active via `systemctl is-active`, operator via
  a probing `status --json`), poller with adaptive interval, `up` without auth key when a node key exists,
  `down` on stop, `set` on config change, factory-reset hook (`serve reset`, `logout`), inventory spec row.
- Provider registration and `PROVIDER_STATUS` emission on change only.
- Requirements list in the status response: `platform-supported`, `binary-installed`, `daemon-active`,
  `operator-granted`, `version-supported`, each `{ code, satisfied, message }`. On the `development`
  platform, `FB_REMOTE_ACCESS_ALLOW_DEV=true` marks `platform-supported` satisfied and evaluates the other
  requirements with unprivileged probes only; without it the provider is `unsupported`.

### API

`GET /status` → `get-remote-access-tailscale-plugin-status`, admin and owner. Plugin registered in
`app.module.ts` under `PLUGINS_PREFIX`.

### Tests

- CLI wrapper: every classified error, timeout, JSON parse failure, redaction.
- Mapper: one fixture per `BackendState`, missing `Self`, no MagicDNS.
- Managed service: start with each prerequisite missing, stop, config change, poller interval switching,
  factory reset order.
- Controller and e2e status with mocked CLI.

**Verification:** plugin specs; `generate:openapi`; `lint:api`.

---

## RA-5: Tailscale setup and sign-in

### Contract

- `scripts/tailscale-setup.sh` (bundled asset; add the glob to `nest-cli.json`): idempotent install from
  the signed Tailscale apt repository on Debian-family systems (never a downloaded script; on systems
  without apt write `failed` with a `not-installed` reason and manual instructions), enable daemon, grant
  operator to `$SMART_PANEL_USER`, status-file JSON after each step, `trap` writes `failed` on unexpected
  exit. `install` returns `unsupported` when `FB_REMOTE_ACCESS_ALLOW_DEV` is set.
- `TailscaleSetupService.install(user)` → `PrivilegedWorkerService.run(...)`, forwards status to
  `SETUP_PROGRESS` events, refreshes requirements on completion.
- `TailscaleLoginService.login(authKey?)`: with a key, write it to an ephemeral `0600` file under
  `<FB_DATA_DIR>/remote-access/`, run `up --auth-key=file:<path> --timeout=120s`, delete the file on every
  exit path (success, error, timeout) and return the resulting status; without a key, spawn `up --json --timeout=10m`, parse the first JSON block, keep the
  process handle, return `{ authUrl, qr }`, resolve `pending-auth` in the poller, and clear the handle on
  the second block, on `stop()`, or on timeout. Only one pending login at a time.
- `logout()` → `tailscale logout`; `resetPreferences()` → `up --reset <managed flags>`.
- `login_server` change: `logout`, then require a new login (state `setup-required`, message "sign in
  again").

### API

`POST /install` (owner, `202`), `POST /login` (admin, owner; `RemoteAccessTailscalePluginReqLogin` with
optional `auth_key`), `POST /logout` (owner), `POST /reset-preferences` (owner). Responses per spec.
`GET /status` while `pending-auth` and `POST /login` set `Cache-Control: no-store`.

### Tests

- Setup: job spawn arguments, progress event forwarding, failure surfaces the failing step, unsupported
  platform returns `unsupported` without spawning.
- Login: two-block parsing fixture, auth-key path redaction in logs and errors, the key file is created
  `0600` and removed on success, error and timeout, second login while pending rejected, timeout clears
  state, stop kills the child, `Cache-Control: no-store` on responses carrying an auth URL (API-boundary
  test).
- Script: bash unit via `bats` is not available; add a shellcheck run to the task's verification and a
  dry-run mode (`--dry-run`) that prints the planned commands and is exercised from a spec.

**Verification:** plugin specs; `shellcheck scripts/tailscale-setup.sh`; manual run on a Pi in RA-12.

---

## RA-6: Serve, Funnel, SSH and advisories

### Behaviour

- `TailscaleServeService.apply(config, port)`: when `serve_https` and `CapMap.https`, run
  `serve --bg --https=443 --set-path=/ http://127.0.0.1:<port>`; otherwise `serve reset` if a config
  exists. Funnel `on|off` when `funnel` and `CapMap.funnel`. Read back with `serve status --json`.
- Endpoints: add `https://<dnsname>` private, or public when Funnel is on. `proxyAddresses` set to loopback
  while Serve is active.
- `ssh`, `accept_dns`, `accept_routes`, `advertise_tags` are applied through `set`.
- Advisories: `tailnet-https-disabled`, `funnel-not-allowed`, `key-expiring` (14 days), `public-exposure`,
  `version-unsupported`.

### Tests

- Apply matrix (capability present or absent, toggles on or off), read-back parsing, endpoint publication,
  proxy address declaration, each advisory trigger.

**Verification:** plugin specs; `generate:openapi`.

---

## RA-7: Admin remote access module

### Behaviour

- `apps/admin/src/modules/remote-access/`: `remote-access.module.ts` (locales, store, route, socket
  subscription for `RemoteAccessModule.*`, data-refresh registration), `router/` (`/remote-access`,
  admin and owner, `menu: 3500`, between extensions (3000) and system (4000)), views `view-remote-access.vue`,
  components `remote-access-status-banner.vue`, `access-urls-list.vue` (copy, QR through `qrcode`),
  `provider-cards.vue` (resolves plugin elements with `modules` containing the module name and renders
  `components.providerCard`), `advisories-list.vue`, `remote-access-config-form.vue` (four fields: internal URL, external URL,
  forwarded-header trust, `trusted_proxies` as a tag input; `enabled` stays on the Extensions page)
  registered as a `CONFIG_MODULE_MODULE_TYPE` element.
- Store `remote-access-status.store.ts` with `fetch`, `onEvent`, transformers; schemas bound to
  `RemoteAccessModuleDataStatus` and `ConfigModuleDataRemoteAccess` from `openapi.constants.ts`.
- Locales: en-US written by the implementer; the other five files are a haiku sub-task that translates
  key by key without changing keys.

### Tests

- Store event handling and transformers; URL ranking display; QR rendering; provider element discovery
  with and without plugins; config form schema binding (deliberately break it once to prove the type
  check fails, then fix).

**Verification:** `pnpm --filter ./apps/admin run test:unit`, `type-check`, eslint and prettier on touched
files only.

---

## RA-8: Admin Tailscale plugin

### Behaviour

- `apps/admin/src/plugins/remote-access-tailscale/`: plugin definition with two elements
  (`CONFIG_MODULE_PLUGIN_TYPE` config form; provider element with `providerCard` and `providerSetup`),
  `tailscale-provider-card.vue` (state badge, tailnet, DNS name, IPs, HTTPS URL, actions), setup wizard
  (Set up with progress from `SETUP_PROGRESS`, Sign in with auth URL link and QR image plus an auth-key
  tab, Options, Done), `tailscale-config-form.vue`, store `tailscale-status.store.ts`, composables
  `useTailscaleSetup`, `useTailscaleLogin` (poll `GET /status` every 3 s while `pending-auth`, stop on
  `connected`, `error`, or after 10 minutes), six locales (haiku sub-task for five).
- Connect, disconnect and reconnect call the Extensions services store actions for the `node` service.

### Tests

- Wizard step transitions, login polling stop conditions, action availability per state, config form
  schema binding, secret-free request schema (no `auth_key` persisted in the store).

**Verification:** admin unit tests, type-check, scoped lint.

---

## RA-9: Installer and image

### Behaviour

- `build/raspbian`: new `00-install-deps` step for `server` and `aio` variants adds the Tailscale keyring
  and apt source for `raspbian/bookworm`, installs `tailscale`, runs `systemctl disable tailscaled`.
- `scripts/install-server.sh`: `--with-tailscale` flag; on Debian-family systems (`/etc/os-release` `ID`
  `raspbian`, `debian` or `ubuntu`) it adds the signed Tailscale keyring and apt source for the detected
  codename and installs the package, on other distributions it runs the vendor install script (same trust
  level as the NodeSource setup the installer already uses); the daemon is left disabled; help text and
  summary updated.
- `build/docs/INSTALLATION.md`: note the flag and the image default.

### Tests

- `shellcheck` on both scripts; image build in CI already exercises the stage.

**Verification:** `shellcheck`; an image build is part of RA-12 acceptance.

---

## RA-10: Documentation

### Behaviour

- Website: `docs/admin-management/remote-access/page.mdx` (concepts, Tailscale walkthrough with tailnet
  prerequisites, external URL and proxy trust, Funnel warning, Docker and Home Assistant notes,
  troubleshooting); update `get-started/network-requirements`, `extensions/overview`,
  `get-started/installation/raspberry-pi-image`, `admin-management/overview`, `admin-management/mcp`.
- Repository: `docs/remote-access-architecture.md` in the style of `docs/climate-architecture.md`;
  `docs/extensions.md` gains a provider registration example.

**Verification:** `pnpm --filter ./apps/website run build` succeeds; links checked by hand.

---

## RA-11: MCP integration

### Behaviour

- Backend: `McpOAuthProxyPolicyService` accepts a peer when it is in `FB_MCP_OAUTH_TRUSTED_PROXIES` or
  trusted by `TrustedProxyRegistryService`; document in the MCP readme.
- Admin: MCP config form shows "Use remote access URL" beside `oauthPublicBaseUrl` when the remote-access
  store has an HTTPS primary external URL; clicking fills the field, nothing is saved automatically.

**Verification:** MCP proxy policy specs; admin form spec.

---

## RA-12: Integrated verification

Run, in increasing scope:

```bash
pnpm --filter ./apps/backend exec jest --runInBand <targeted specs>
pnpm --filter ./apps/admin run test:unit -- <targeted specs>
pnpm run lint:js && pnpm --filter ./apps/backend run lint:api && pnpm --filter ./apps/backend run lint:openapi
pnpm run test:unit
pnpm --filter ./apps/admin run test:unit && pnpm --filter ./apps/admin run type-check
```

Hardware acceptance matrix (Raspberry Pi, recorded in the epic task):

- Fresh image: Remote access page shows internal URL; Tailscale card "Not set up"; Set up completes in
  seconds because the package is pre-installed.
- Existing npm install without the package: Set up installs from the apt repository and reports each step.
- Sign in through the QR code from a phone; card reaches "Connected"; Serve HTTPS URL listed.
- Admin over cellular at `https://<node>.<tailnet>.ts.net`, websocket live updates verified.
- Throttle and registration guard see the tailnet client address (check logs).
- Reboot: node reconnects without interaction.
- Disable plugin: node down, URLs disappear, re-enable reconnects.
- Auth-key sign-in path on a second device.
- Logout removes the device from the tailnet; factory reset leaves no `tailscaled.state` login.
- Short-expiry auth key: `key-expiring` advisory appears; "Sign in again" recovers.
- Docker compose deployment shows `unsupported` with the documentation link.

## Completion criteria

- Milestone 1 PRs merged with Codex review threads resolved.
- All acceptance rows above recorded in `tasks/epics/EPIC-REMOTE-ACCESS.md`.
- Generated OpenAPI, admin types and website build current.
- No new sudoers entries; no persisted secrets; no auth URL in any log or event.
