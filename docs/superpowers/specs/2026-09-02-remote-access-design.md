# Remote Access — Design

**Status:** Draft for review
**Date:** 2026-09-02
**Scope:** backend, admin, installer, website; panel untouched

## Goal

Let an administrator reach a Smart Panel installation from outside the home network without a public IP
address, port forwarding, dynamic DNS or a hand-built reverse proxy. Deliver it as a core `remote-access`
module that owns the "how is this installation reachable" model, plus a family of provider plugins. The
first provider is Tailscale. Cloudflare Tunnel and a WireGuard client follow under the same contract.

## Product Decision

### What administrators gain

- **Admin from anywhere.** Open the same admin UI from a phone on cellular or a laptop at work. The admin
  SPA already talks to whatever origin it was loaded from, so a tunnel URL works without client changes.
- **Third-party clouds can call back.** MCP OAuth for remote LLM clients, the WhatsApp Cloud API webhook,
  Telegram webhooks and future voice-assistant skills all need a reachable HTTPS URL. Today the operator is
  told to "expose it via a reverse proxy or tunnel" by hand.
- **One answer to "what is my URL".** A system-wide URL registry (internal URL, external URLs, primary
  external URL) that other modules consume instead of each inventing its own field. MCP's
  `oauth_public_base_url` becomes a suggestion away instead of a copy-paste exercise.
- **Correct behaviour behind a proxy.** Tunnels terminate on the device and connect to the backend from
  loopback. Without a proxy-trust boundary, every remote user looks like `127.0.0.1` to the throttler and
  to the display registration guard. The module makes the platform proxy-aware once, for every provider.
- **Multi-site management.** A tailnet lists every Smart Panel a household owns; the admin of a second home
  or a parent's flat is one bookmark away.
- **Remote support.** Opt-in Tailscale SSH gives an advanced administrator a shell without opening ports.
- **Remote maintenance actually works.** The in-app updater, backups and reboot already exist; remote
  access is what makes them usable when nobody is home.

### Strategies compared

| Strategy | Public IP | Vendor account | Public exposure | Who authenticates | HTTPS | Webhooks / OAuth callbacks | Admin complexity |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A. Identity mesh VPN (Tailscale, NetBird, ZeroTier) | No | Yes (IdP login) | No, unless Funnel is enabled | Mesh IdP + device ACLs, then Smart Panel login | Automatic via MagicDNS + Serve | Only with Funnel (public) | Low: one browser sign-in, then invisible |
| B. Edge tunnel with public hostname (Cloudflare Tunnel) | No | Yes (account + domain) | Yes, at the hostname | Cloudflare Access if configured, otherwise Smart Panel login alone | Free, terminated at the edge | Yes, native | Medium: owned domain, must remember Access |
| C. Vendor relay (Nabu Casa, openHAB Cloud) | No | Yes (vendor) | Only the instance hostname | Vendor auth, then app login | Vendor-issued cert | Yes | Lowest: a toggle |
| D. WireGuard/OpenVPN to own router or VPS | Usually | No | No | Owner-issued keys | Owner's problem | Inbound only from inside the tunnel | High |
| E. Port forward + DDNS + reverse proxy | Yes | No | Yes, the device itself | Smart Panel login alone | Owner-managed certs | Yes | Highest, largest blast radius |

Prior art converges on two rules regardless of transport: trust forwarded headers only when the socket peer
is an explicitly trusted proxy, and terminate TLS as close to the application as possible. Home Assistant
enforces the first in `components/http/forwarded.py` (`use_x_forwarded_for` and `trusted_proxies` are an
inclusive pair, and an `X-Forwarded-For` from an untrusted peer is a hard `400`). Nabu Casa's SniTun and
Tailscale Serve both do the second.

### Recommendation

1. **Tailscale first.** It matches the audience (non-technical household admins), needs no public exposure,
   has a generous free tier, gives an HTTPS URL through Serve, and can be extended to a public URL through
   Funnel when a webhook needs it. The Home Assistant Tailscale add-on proves the exact UX we want: sign in
   from a browser link, optional HTTPS sharing, optional public sharing.
2. **"External URL" as the zero-plugin baseline.** Administrators who already run a reverse proxy or DDNS
   register their URL in the module, exactly like Home Assistant's `external_url`. The module is useful
   before any provider plugin is installed.
3. **Cloudflare Tunnel second**, for users who want a public hostname on their own domain, with a posture
   warning that a public hostname must be protected by Cloudflare Access.
4. **WireGuard client third**, for self-hosters with an existing VPN server.
5. **Vendor relay (a future "FastyBird Cloud") stays out of scope**, but the provider contract must not
   preclude it: a relay is just a provider whose endpoint kind is `public` and whose setup is a pairing.

## Release Boundaries

### Milestone 1 — Foundation and Tailscale MVP

- Proxy-trust boundary shared by the whole HTTP and websocket surface.
- `remote-access` module: config, provider registry, URL registry, aggregated status, posture advisories,
  websocket events, REST endpoints.
- Privileged worker runner extracted from the update executor, reused for Tailscale setup.
- `remote-access-tailscale` plugin: install and prepare, interactive sign-in with auth URL and QR code,
  auth-key sign-in, connect and disconnect through the managed-service manager, Serve (HTTPS on the
  tailnet), Funnel (opt-in public URL), Tailscale SSH (opt-in), key-expiry advisory.
- Admin: Remote access page, module settings form, Tailscale provider card and setup wizard.
- Installer and Raspberry Pi image: Tailscale package pre-installed but inactive.
- MCP admin form suggests the remote-access primary external URL for `oauth_public_base_url`; MCP proxy
  policy consumes the shared trusted-proxy set.
- Website documentation.

### Milestone 2 — Public exposure

- `remote-access-cloudflare-tunnel` plugin (backend + admin).

### Milestone 3 — Self-hosted VPN

- `remote-access-wireguard` client plugin (backend + admin).

## Non-Goals

- Running `tailscaled` inside the Smart Panel Docker image or the Home Assistant add-on. Those deployments
  use the external URL baseline and the vendor's own Tailscale integration; documented, not implemented.
- Identity-header single sign-on from `Tailscale-User-Login`. The capability is recorded on the provider
  contract; no auth change ships.
- Multi-factor authentication. Recorded as a posture recommendation for public exposure; separate feature.
- Panel (display) changes. The Flutter app already handles `https://` base URLs; mDNS discovery stays
  LAN-only by design.
- A FastyBird-operated relay.
- Rewriting the sudoers policy. See Security for the follow-up.

## User Experience

### First-time setup (Tailscale)

1. Admin opens **Remote access** in the admin menu. The page shows the internal URL, an empty external URL
   list and one provider card per installed provider plugin. The Tailscale card reads "Not set up".
2. **Set up** runs the privileged preparation: install the package if missing, enable the daemon, grant the
   service user operator rights. Progress streams to the card. On the Raspberry Pi image the package is
   already present, so this step takes seconds.
3. **Sign in** shows a Tailscale login link and a QR code. The admin opens it on any device and approves.
   The card polls and flips to "Connected" with the tailnet name, the MagicDNS name and the Tailscale IPs.
   An advanced tab accepts a pre-authorised auth key instead, for headless installs.
4. If the tailnet has HTTPS certificates enabled, **Serve HTTPS on the tailnet** is switched on by default
   and the page lists `https://<node>.<tailnet>.ts.net` as the primary external URL, with copy and QR
   buttons. If certificates are not enabled, the card links to the tailnet DNS settings and explains why.
5. Optional toggles: Tailscale SSH, accept routes, accept DNS, ACL tags, Funnel (public URL, guarded by a
   warning and a posture advisory).

### Day two

- The Extensions → Services view lists `remote-access-tailscale-plugin / node`; start, stop and restart
  behave as connect, disconnect and reconnect.
- Disabling the plugin disconnects the node. Sign out (logout) expires the node key and removes the device
  from the tailnet; it is an explicit action, never a side effect.
- A key-expiry advisory appears fourteen days before the node key expires, with a "Sign in again" action.
- Factory reset signs the node out and clears Serve configuration.

### External URL baseline

The module settings form (Config → Modules → Remote access) holds `internal_url`, `external_url`,
`trust_forwarded_headers` and `trusted_proxies`. The Remote access page shows the manual external URL next
to provider URLs and marks it "configured manually".

## Architecture

### Ownership

```
modules/remote-access                     plugins/remote-access-tailscale
├── provider registry  ◄───────────────── registers IRemoteAccessProvider
├── URL registry                          ├── TailscaleCliService (execFile wrapper)
├── proxy-trust contributions ──► modules/api ClientAddressService
├── posture advisories                    ├── TailscaleNodeManagedService (managed service "node")
├── status aggregation + events           ├── TailscaleSetupService (privileged worker)
└── REST: status / providers / urls       └── REST: status / login / logout / install
```

The module never shells out and never knows a provider's binary. Providers never resolve URLs for other
modules and never touch request handling. The `api` module owns client-address resolution; the
`remote-access` module only contributes trusted proxies to it.

### Provider contract

```typescript
type RemoteAccessProviderState =
	| 'unsupported'      // platform cannot host this provider (docker, home-assistant)
	| 'not-installed'    // binary missing
	| 'setup-required'   // daemon stopped, operator missing, re-authentication needed
	| 'pending-auth'     // waiting for the admin to approve a login link
	| 'pending-approval' // device approval pending in the vendor console
	| 'connecting'
	| 'connected'
	| 'disconnected'     // installed and configured but intentionally down
	| 'error';

interface RemoteAccessEndpoint {
	url: string;                 // absolute origin, no path
	scope: 'private' | 'public'; // reachable from the mesh only, or from the internet
	https: boolean;
	label: string;               // "Tailscale (HTTPS)", "Tailscale IPv4", "Manual external URL"
}

interface RemoteAccessProviderStatus {
	type: string;
	state: RemoteAccessProviderState;
	endpoints: RemoteAccessEndpoint[];
	message?: string;            // human-readable detail for setup-required / error
	details: Record<string, string | number | boolean | null>; // provider-specific, safe to display
	proxyAddresses: string[];    // loopback addresses this provider proxies from while active
	advisories: RemoteAccessAdvisory[];
	updatedAt: string;
}

interface IRemoteAccessProvider {
	readonly type: string;                // plugin name
	readonly kind: 'mesh' | 'tunnel' | 'vpn' | 'external';
	readonly capabilities: { https: boolean; publicUrl: boolean; identityHeaders: boolean; ssh: boolean };
	getStatus(): Promise<RemoteAccessProviderStatus>;
}
```

Providers register in `onModuleInit` through `RemoteAccessProviderRegistryService.register(provider)` and
emit `RemoteAccessModule.Provider.Status` whenever their status changes. The status payload carries no
secrets: the Tailscale auth URL is a capability URL and is only ever returned by the plugin's REST status
endpoint to owners and administrators.

### URL registry

`RemoteAccessUrlService` mirrors Home Assistant's `helpers/network.py::get_url()`:

```typescript
getUrl(options: {
	requireHttps?: boolean;
	requirePublic?: boolean;
	allowInternal?: boolean;   // default true
	allowExternal?: boolean;   // default true
	preferExternal?: boolean;  // default false
}): string; // throws NoUrlAvailableException
```

- **Internal URL:** `internal_url` from module config, otherwise `FB_APP_HOST` and `FB_BACKEND_PORT` as the
  location interceptor already builds it. Candidates for display only: `http://<hostname>.local:<port>` and
  the LAN addresses from `systeminformation`.
- **External URLs:** every connected provider's endpoints plus the manual `external_url` (scope `public`,
  `https` from its scheme).
- **Ranking:** HTTPS before HTTP, public before private, then provider registration order. The top entry
  is the `primaryExternalUrl` shown on the page and offered to other modules.
- Home Assistant forbids a path on either URL because a wrong prefix can change security behaviour.
  Remote-access URLs are origin-only (scheme, host, optional port; no path, credentials, query or
  fragment), validated by a dedicated `IsRemoteAccessUrlConstraint`. It is deliberately separate from
  MCP's `IsMcpOAuthPublicBaseUrlConstraint`, which keeps accepting a reverse-proxy path prefix; the MCP
  suggestion offers the origin and the administrator appends a prefix when their proxy needs one. The
  external URL may be HTTP; the posture layer warns about it.
- `RemoteAccessModule.Urls.Changed` fires when the ranked list changes.

### Proxy trust

Today `extractClientIp` (duplicated in the displays and websocket modules) accepts `X-Forwarded-For`,
`X-Real-IP` and `CF-Connecting-IP` from any peer, the throttler keys on the raw socket address, and MCP
keeps its own `FB_MCP_OAUTH_TRUSTED_PROXIES` list. Any tunnel that terminates on the device therefore makes
every remote caller look local, and any LAN host can spoof a loopback address to bypass permit-join.

The `api` module gains `ClientAddressService`:

- `resolve(request)` returns `{ address, forwarded: boolean, secure: boolean }`.
- Forwarded headers are honoured only when the socket peer is inside the trusted set. The client address
  is the right-most `X-Forwarded-For` entry that is not itself trusted, as Home Assistant does. Untrusted
  peers that send forwarded headers are served using the socket address and logged once per peer.
- The trusted set is the union of: `remote-access` module config `trusted_proxies` when
  `trust_forwarded_headers` is on (an inclusive pair, exactly like Home Assistant), and every
  `proxyAddresses` entry of a provider whose status is `connected`. Contributions arrive through a small
  `TrustedProxyRegistryService` so the `api` module never depends on `remote-access`.
- `DisplayAwareThrottlerGuard.getTracker()`, the displays registration guard, the websocket connection
  address and the MCP proxy policy all resolve through it. Loopback detection keeps its meaning: a request
  proxied by Tailscale Serve carries the tailnet client address, not `127.0.0.1`.
- The localhost privilege applies only to direct connections. A loopback peer that presents forwarding
  headers without being trusted is, by definition, a proxy: `resolve()` reports that the headers were
  ignored, and the registration guard and registration status refuse the localhost bypass for that
  request instead of treating every client behind an unconfigured local proxy as local.

### Privileged operations

The backend runs as the unprivileged `smart-panel` user with a sudoers allowlist, no privileged helper
daemon and no command-allowlist abstraction. The update executor already spawns a root-owned worker with
`sudo -n systemd-run --scope --unit=smart-panel-update bash <script>`, tracks it through a JSON status file
and enforces a ten-minute timeout. That primitive is extracted into `PrivilegedWorkerService` in the
`system` module and reused unchanged by Tailscale setup:

- `run({ unit, script, args, env, statusFile, timeoutMs })` returns a job handle; progress is polled from
  the status file every three seconds; a stale lock times out after fifteen minutes.
- `PlatformService.supportsPrivilegedWorkers()` is true for `raspberry` and `generic` with systemd, false
  for `docker`, `home-assistant` and `development`; providers map false to `unsupported`.
- Scripts are bundled NestJS assets. The plugin adds `plugins/remote-access-tailscale/scripts/**/*.sh` to
  `nest-cli.json`.

No new sudoers line is required on existing installations, so the feature reaches installed systems through
a normal application update. The existing `systemd-run *` grant is root-equivalent; that is a pre-existing
condition, not something this design widens. A follow-up technical task replaces it with a fixed,
root-owned helper and an allowlist of subcommands; the `PrivilegedWorkerService` seam is where the executor
will be swapped, so no plugin changes when it lands.

### Events

- `RemoteAccessModule.Provider.Status` — the full `RemoteAccessProviderStatus` (`type`, `state`,
  `endpoints`, `message`, `details`, `proxyAddresses`, `advisories`, `updatedAt`). It never carries an auth
  URL, QR code or key material; the aggregator and the admin update from the payload without a refetch.
- `RemoteAccessModule.Urls.Changed` — `{ internal, external, primaryExternalUrl }`.
- `RemoteAccessModule.Setup.Progress` — `{ type, job, step, state, message }` from privileged jobs.

The websocket gateway routes `RemoteAccessModule.*` to the exchange room only, the same way it already
scopes `SystemModule.System.Update.*`, so displays never receive remote-access state.

### Module configuration

`ConfigModuleDataRemoteAccess` / `ConfigModuleUpdateRemoteAccess`:

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `enabled` | boolean | `true` | Disabled: providers stop, only the internal URL resolves |
| `internal_url` | string \| null | `null` | Absolute origin, no path; overrides `FB_APP_HOST` |
| `external_url` | string \| null | `null` | Absolute origin, no path; manual external endpoint |
| `trust_forwarded_headers` | boolean | `false` | Inclusive with `trusted_proxies` |
| `trusted_proxies` | string[] | `[]` | IPv4/IPv6 addresses or CIDRs |

No secrets. The module is toggleable and is not added to `NON_TOGGLEABLE_MODULES`. `enabled` is not part
of the settings form: like every module it is switched from the Extensions page, which patches the same
config through the extensions endpoint; the form edits the other four fields.

## Tailscale Plugin

### Configuration

`RemoteAccessTailscalePluginDataConfig` / `RemoteAccessTailscalePluginUpdateConfig`:

| Field | Type | Default | Maps to |
| --- | --- | --- | --- |
| `enabled` | boolean | `false` | managed service desired state |
| `hostname` | string | OS hostname | `--hostname` |
| `login_server` | string | `https://controlplane.tailscale.com` | `--login-server` (Headscale users) |
| `accept_dns` | boolean | `true` | `--accept-dns` |
| `accept_routes` | boolean | `false` | `--accept-routes` |
| `advertise_tags` | string[] | `[]` | `--advertise-tags` |
| `ssh` | boolean | `false` | `--ssh` |
| `serve_https` | boolean | `true` | `tailscale serve --bg --https=443 http://127.0.0.1:<port>` |
| `funnel` | boolean | `false` | `tailscale funnel 443 on` |

The auth key is never stored. It is accepted only in the body of the login request, used once, and
redacted from logs. To keep it out of process arguments it is written to an ephemeral file with mode
`0600` under `<FB_DATA_DIR>/remote-access/`, passed as `--auth-key=file:<path>`, and the file is deleted
on every exit path of the login call, including errors and timeouts. This avoids the config-secret machinery entirely and matches the Home Assistant add-on,
which offers only interactive sign-in.

### CLI wrapper

`TailscaleCliService` wraps `execFile('tailscale', args, { timeout })`. Never a shell string. Every call
classifies failures: `not-installed` (ENOENT), `permission-denied` (operator not granted), `daemon-down`
(socket connect refused), `needs-login`, `settings-conflict` (the "must specify all settings or use
--reset" error), `timeout`, `unknown`. Commands used:

- `tailscale version --json`
- `tailscale status --json` — `BackendState`, `AuthURL`, `TailscaleIPs`, `Self.DNSName`, `Self.Online`,
  `Self.KeyExpiry` (field name verified during implementation), `CurrentTailnet.Name`,
  `CurrentTailnet.MagicDNSSuffix`, `Self.CapMap` for `https` and `funnel`, `CertDomains`, `Health`
- `tailscale up --json --timeout=<10m> <full managed flag set> [--auth-key=file:<ephemeral path>]`, spawned; the first JSON
  block yields `AuthURL` and a base64 PNG `QR`; the second yields the final `BackendState`
- `tailscale set --hostname= --accept-dns= --accept-routes= --advertise-tags= --ssh= --operator=smart-panel`
  for preference changes without re-authentication
- `tailscale down`, `tailscale logout`
- `tailscale serve --bg --https=443 --set-path=/ http://127.0.0.1:<port>`, `tailscale serve reset`,
  `tailscale serve status --json`, `tailscale funnel 443 on|off`, `tailscale funnel status --json`

`tailscale up` is always called with the complete managed flag set including `--operator`, and never with
`--reset`, so a preference the administrator changed by hand is surfaced as `settings-conflict` instead of
silently overwritten. A "Reset preferences" action runs `up --reset` explicitly. A `login_server` change
runs `logout` first and then re-authenticates, the same recovery the Home Assistant add-on implements with
`--force-reauth`.

The `--json` formats are documented as subject to change. The wrapper parses only the fields listed above,
tolerates unknown fields, and pins the minimum supported Tailscale version in the plugin constants.

### Setup (privileged)

`scripts/tailscale-setup.sh`, run through `PrivilegedWorkerService` as unit `smart-panel-remote-access`:

1. If `tailscale` is missing: on Debian and Raspberry Pi OS add the official keyring and apt source for the
   detected `ID` and `VERSION_CODENAME` (`raspbian/bookworm` or `debian/bookworm`), then install the
   signed `tailscale` package. On systems without apt the worker installs nothing and reports
   `not-installed` with the vendor's manual instructions. The privileged worker never downloads and
   executes scripts; it only installs signed packages from the vendor repository.
2. `systemctl enable --now tailscaled`.
3. `tailscale set --operator=<service user>` so the backend can operate the daemon without sudo from then
   on. The operator preference persists in `tailscaled.state`.
4. Write the status file after each step; exit non-zero with a `failed` status on any error.

Unprivileged checks before and after: `systemctl is-active tailscaled` and `systemctl is-enabled
tailscaled` need no sudo; a `tailscale status --json` that returns `permission-denied` means step 3 is
still missing.

### Node state machine

```
not-installed ──setup──► setup-required ──setup──► disconnected
                                                      │ enable / start
                                                      ▼
   pending-auth ◄──── needs login ─────────────── connecting
      │ admin approves link                            │ BackendState=Running, Self.Online
      ▼                                                ▼
   pending-approval (NeedsMachineAuth) ──approved──► connected ──down/stop──► disconnected
                                                      │ key expired / logout
                                                      ▼
                                                  setup-required (message: sign in again)
```

`TailscaleNodeManagedService` (`owner: plugin`, `serviceId: 'node'`, `activationPolicy: 'owner-enabled'`):

- `start()` verifies prerequisites, applies preferences, runs `up` when the node holds a key, starts the
  status poller (five seconds while transitioning, thirty seconds while stable), applies Serve and Funnel.
- `stop()` stops the poller and runs `tailscale down`. It never logs out.
- `onConfigChanged()` applies preferences with `set`, re-applies Serve and Funnel, and reports
  `restartRequired` only for `login_server`.
- `isHealthy()` is `BackendState === 'Running' && Self.Online`.
- Registers with the factory-reset registry: `serve reset`, then `logout`.

### Endpoints published

| Condition | Endpoint | Scope | HTTPS |
| --- | --- | --- | --- |
| connected | `http://<tailscale-ipv4>:<port>` | private | no |
| connected + MagicDNS | `http://<dnsname>:<port>` | private | no |
| connected + Serve | `https://<dnsname>` | private | yes |
| connected + Serve + Funnel | `https://<dnsname>` | public | yes |

While Serve is active the provider reports `proxyAddresses: ['127.0.0.1', '::1']`, which the `api` module
trusts automatically. Serve forwards `X-Forwarded-For`, `X-Forwarded-Proto` and the Tailscale identity
headers; the identity headers are ignored.

### Advisories

- `tailnet-https-disabled`: Serve requested but `Self.CapMap` lacks `https`; links to the tailnet DNS page.
- `funnel-not-allowed`: Funnel requested but the node lacks the `funnel` attribute in the ACL policy.
- `key-expiring`: `Self.KeyExpiry` within fourteen days; action "Sign in again". Recommends disabling key
  expiry for appliance nodes in the admin console.
- `public-exposure`: Funnel active. Reminds that Smart Panel login is the only gate and that multi-factor
  authentication is not available.
- `version-unsupported`: installed Tailscale older than the pinned minimum.

### Platform support

| Platform | Behaviour |
| --- | --- |
| `raspberry`, `generic` (systemd, sudo grant present) | Full support |
| Manual tarball install running as `pi` | Full support; `pi` has passwordless sudo on Raspberry Pi OS |
| `docker` | `unsupported`; docs describe the `tailscale/tailscale` sidecar and the external URL baseline |
| `home-assistant` | `unsupported`; docs point to the official Tailscale add-on plus the external URL baseline |
| `development` | `supportsPrivilegedWorkers()` stays false. The Tailscale plugin honours its own override `FB_REMOTE_ACCESS_ALLOW_DEV=true`, which skips the privileged setup step, marks `install` unavailable and expects a locally prepared `tailscale` with the operator already granted; without it the provider is `unsupported` |

## API Surface

Module, mounted at `/api/v1/modules/remote-access`, tag `Remote access module`:

| Method and path | operationId | Roles | Returns |
| --- | --- | --- | --- |
| `GET /status` | `get-remote-access-module-status` | admin, owner | `RemoteAccessModuleResStatus` — enabled, providers, urls, advisories |
| `GET /providers` | `get-remote-access-module-providers` | admin, owner | `RemoteAccessModuleResProviders` |
| `GET /providers/:type` | `get-remote-access-module-provider` | admin, owner | `RemoteAccessModuleResProvider` |
| `GET /urls` | `get-remote-access-module-urls` | admin, owner | `RemoteAccessModuleResUrls` — internal, candidates, external, primary |

Configuration uses the standard config module endpoints. Data models follow `{Module}Data{Name}`:
`RemoteAccessModuleDataStatus`, `RemoteAccessModuleDataProvider`, `RemoteAccessModuleDataEndpoint`,
`RemoteAccessModuleDataUrls`, `RemoteAccessModuleDataAdvisory`.

Tailscale plugin, mounted at `/api/v1/plugins/remote-access-tailscale`, tag `Remote access Tailscale plugin`:

| Method and path | operationId | Roles | Notes |
| --- | --- | --- | --- |
| `GET /status` | `get-remote-access-tailscale-plugin-status` | admin, owner | Full node status, requirements, current auth URL and QR when pending |
| `POST /install` | `create-remote-access-tailscale-plugin-install` | owner | Starts the privileged setup job; `202` with job id; progress over events |
| `POST /login` | `create-remote-access-tailscale-plugin-login` | admin, owner | Body `{ auth_key?: string }`; returns auth URL and QR, or the connected status when a key was used |
| `POST /logout` | `create-remote-access-tailscale-plugin-logout` | owner | Expires the node key |
| `POST /reset-preferences` | `create-remote-access-tailscale-plugin-reset-preferences` | owner | Runs `up --reset` with the managed flag set |

Responses that carry an auth URL or QR code (`GET /status` while `pending-auth`, `POST /login`) are sent
with `Cache-Control: no-store`, verified by an API-boundary test.

Connect, disconnect and reconnect are the generic Extensions service actions. Response schemas:
`RemoteAccessTailscalePluginResStatus`, `RemoteAccessTailscalePluginResInstall`,
`RemoteAccessTailscalePluginResLogin`; request wrapper `RemoteAccessTailscalePluginReqLogin`.

## Security

- **Forwarded-header trust is the prerequisite for every provider.** It ships first and is valuable alone:
  it closes the existing permit-join bypass by spoofed loopback addresses and makes throttling key on real
  client addresses behind any proxy.
- **Secrets.** The Tailscale auth key is request-scoped and redacted from logs. The Cloudflare tunnel token
  (milestone 2) is handed to `cloudflared service install` once and lives in `/etc/cloudflared/token`
  owned by root; Smart Panel never persists it.
- **Auth URL is a capability.** Anyone who opens it can claim the node into their tailnet. It is returned
  only from the owner/admin status endpoint, never in websocket events or logs, and expires with the
  pending `up` process (ten-minute timeout, then a fresh link on request).
- **Role gating.** Install, logout and reset-preferences are owner-only; status and login are admin and
  owner. All use the existing `@Roles` guard.
- **Public exposure is explicit.** Funnel and the Cloudflare plugin raise a persistent `public-exposure`
  advisory. The login endpoint keeps its `5/min` throttle; the docs recommend Cloudflare Access for
  Cloudflare and note the absence of multi-factor authentication.
- **CORS stays as is.** Bearer tokens carry no ambient credentials, so origin reflection does not create a
  CSRF surface; tightening it is a separate hardening item.
- **Sudoers follow-up.** `NOPASSWD: /usr/bin/systemd-run *` and `npm install *` are root-equivalent. A
  technical task replaces them with a fixed root-owned helper; the worker seam is designed for that swap.
- **mDNS TXT `secure`** keeps advertising the LAN origin; remote endpoints are not advertised on the LAN.

## Admin Integration

- New `remote-access` admin module: route `/remote-access`, menu entry "Remote access" for admin and owner,
  icon `mdi:cloud-lock-outline`. Views: overview (status banner, URL list with copy and QR using the
  existing `qrcode` dependency, provider cards, advisories). Module settings form registered as a
  `CONFIG_MODULE_MODULE_TYPE` element like weather and system.
- Store `remote-access-status.store.ts` with `onEvent()` for `RemoteAccessModule.*`; subscription in the
  module `install()` exactly like `system.module.ts`; data-refresh registration for socket recovery.
- Provider plugins register an element with `type: <PLUGIN_TYPE>`, `modules: [REMOTE_ACCESS_MODULE_NAME]`
  and `components: { providerCard, providerSetup }`. The overview finds them the way
  `useChannelsPlugin.ts` finds device plugin elements.
- `remote-access-tailscale` admin plugin: config form (`useConfigPluginEditForm`), provider card, setup
  wizard (Set up → Sign in → Options → Done), composables `useTailscaleSetup` and `useTailscaleLogin`,
  status store, six locale files. Zod response schemas bind to the generated `RemoteAccessTailscalePlugin*`
  types in `openapi.constants.ts`.
- MCP form (milestone 2): "Use remote access URL" fills `oauthPublicBaseUrl` from the primary external
  URL; it never changes the value automatically because a change revokes OAuth tokens.

## Installer and Image

- Raspberry Pi image, `server` and `aio` variants: add the Tailscale keyring and apt source, install the
  `tailscale` package, `systemctl disable tailscaled`. The plugin enables it during setup.
- `install-server.sh --with-tailscale`: optional and non-fatal: a Tailscale failure or an unsupported
  distribution is reported in the completion banner and the installer still exits zero. Every supported
  distribution installs from a
  signed vendor package source: the apt keyring and list on Debian-family systems (exactly like the image),
  the vendor `.repo` file with `gpgcheck=1` on Fedora and RHEL-family systems, and the official repository
  package on Arch. The installer never pipes a downloaded script into a shell; unsupported distributions
  print manual instructions and the completion banner reports the outcome.
- No sudoers change. `systemd-run` is already granted; the update executor precedent covers it.
- Docker compose: no change; documentation describes the sidecar.

## Documentation

- Website: `docs/admin-management/remote-access/page.mdx` (concepts, Tailscale walkthrough, tailnet
  prerequisites, external URL and proxy trust, Docker and Home Assistant notes, troubleshooting). Updates to
  network requirements, extensions overview, Raspberry Pi image page, admin overview and MCP page.
- Repository: `docs/remote-access-architecture.md` as the developer reference, and the extensions doc gains
  the provider registration example.

## Observability

- Managed service state, health, last error and uptime through the Extensions services API.
- Structured logs with the `RemoteAccessTailscale` context: every CLI invocation logs the argument list with
  the auth key redacted, exit code and duration; auth URLs are never logged.
- Advisories are the user-facing observability surface; they are recomputed on every status change.

## Testing Strategy

- **Unit (backend):** `ClientAddressService` matrix (untrusted peer with headers, trusted peer, CIDR match,
  right-most untrusted selection, IPv6, missing headers); URL ranking and `getUrl` option matrix; provider
  registry and status aggregation; `TailscaleCliService` with mocked `execFile` for every classified
  failure; `up --json` two-block parsing with fixtures; state mapping from `status --json` fixtures for each
  `BackendState`; managed service start, stop, config change and factory reset; setup job progress and
  timeout; secret redaction of the auth key in logs and errors.
- **E2E (backend):** module endpoints with a fake provider registered in the test module; role gating;
  events routed to the exchange room only; throttler keyed by the forwarded client address behind a trusted
  peer. Poll unused routes to avoid the shared throttler.
- **Registration inventories:** add the managed service to
  `managed-service-registration.inventory.spec.ts`; no new row in the secret-removal spec because no secret
  is persisted.
- **Admin (vitest):** status store event handling and transformers, URL list and QR rendering, wizard step
  transitions, login polling stop conditions, config form schemas bound to generated types, plugin element
  discovery.
- **Hardware acceptance (manual, recorded in the epic):** fresh image install, setup, QR sign-in, Serve
  HTTPS, admin over cellular, websocket live updates, reboot persistence, disable and re-enable, logout,
  factory reset, key-expiry advisory with a short-expiry key.

## Performance Targets

- Status poll: one `tailscale status --json` per interval, under 100 ms on a Raspberry Pi 4; no network
  probes in `isHealthy()`.
- Setup job: bounded by the ten-minute worker timeout; apt install on a Pi 4 typically completes in under
  two minutes.
- No measurable impact on request latency: client-address resolution is a set lookup per request.

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| `--json` formats drift between Tailscale releases | Parse a minimal field set, fixture tests per release, pinned minimum version, advisory on unsupported version |
| Operator grant missing after a Tailscale reinstall | Setup is idempotent and re-runnable; `permission-denied` maps to `setup-required` with a one-click fix |
| Tailnet without HTTPS certificates | Serve advisory with a direct link; IPv4 and MagicDNS HTTP endpoints still work inside the tailnet |
| Trusted loopback proxy lets any local process spoof addresses | Single-purpose appliance; documented; the follow-up helper task tightens local privileges |
| Node key expiry silently breaks access | Advisory fourteen days ahead, re-sign-in action, docs recommend disabling expiry |
| `up` blocks forever without the timeout | Always spawned with `--timeout`, tracked, killed on stop |
| Setup fails offline | Status file reports the failing step; the image pre-installs the package so setup rarely needs the network |

## Acceptance Summary

- A fresh Raspberry Pi image install can be signed into a tailnet from the admin UI and reached at
  `https://<node>.<tailnet>.ts.net` from a phone on cellular, with live websocket updates.
- Behind Serve, the display registration guard and the login throttle see tailnet client addresses.
- The Remote access page lists internal and external URLs, the primary URL, provider state and advisories,
  and reflects changes without reload.
- Disabling the plugin disconnects; logout removes the node; factory reset leaves no tailnet state.
- Docker and Home Assistant deployments see `unsupported` with documentation links instead of errors.
- All generated artefacts are current; backend and admin test suites pass; hardware matrix recorded.

## External References

- Home Assistant `helpers/network.py` (`get_url`), `components/http/forwarded.py`
  (`use_x_forwarded_for`, `trusted_proxies`), `core_config.py` URL validation.
- Home Assistant Tailscale add-on (`hassio-addons/addon-tailscale`): options, `share_homeassistant`
  serve/funnel, `--force-reauth` recovery, `CapMap` checks.
- Tailscale CLI source: `cmd/tailscale/cli/up.go` (`--json` output contract, `--timeout`, `--reset` rule),
  `ipn/ipnstate/ipnstate.go` (`Status`), `ipn/ipnauth` (operator), `ipn/ipnlocal/serve.go` (identity
  headers), `tailscale.com/kb/1312/serve`, `tailscale.com/kb/1223/funnel`, `tailscale.com/kb/1085/auth-keys`.
- Cloudflare: `cloudflared service install`, `/etc/cloudflared/token`, metrics `/ready`, Cloudflare Access
  for self-hosted public applications.
- In-repo precedents: MCP `oauth_public_base_url` validator and `McpOAuthProxyPolicyService`;
  `UpdateExecutorService` worker pattern; `IManagedExtensionService`; weather provider registry.
