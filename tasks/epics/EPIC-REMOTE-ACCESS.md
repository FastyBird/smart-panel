# Task: Remote access module and provider plugins

ID: EPIC-REMOTE-ACCESS
Type: epic
Scope: backend, admin, installer, website
Size: large
Parent: (none)
Status: in-progress
Created: 2026-09-02

## 1. Business goal

In order to manage my Smart Panel when I am not at home,
As an administrator whose installation sits behind a home router without a public IP address,
I want to connect the installation to a private network or tunnel from the admin UI and reach it securely
from anywhere, without port forwarding, dynamic DNS or a hand-built reverse proxy.

## 2. Context

- Today the backend and admin are reachable only on the LAN (`http://smart-panel.local:3000`). MCP OAuth,
  the WhatsApp webhook and future cloud integrations all tell the operator to expose the installation
  themselves.
- The MCP module already carries an `oauth_public_base_url` and an env-only trusted-proxy list; both are
  module-scoped precedents for a system-wide URL and proxy-trust model.
- The backend runs as an unprivileged `smart-panel` user with a sudoers allowlist. The update executor
  already runs a root worker through `sudo -n systemd-run`; that primitive is reused for provider setup.
- Design: `docs/superpowers/specs/2026-09-02-remote-access-design.md`
- Plan and delegation map: `docs/superpowers/plans/2026-09-02-remote-access.md`
- Prior art: Home Assistant `helpers/network.py` and `components/http/forwarded.py`; the Home Assistant
  Tailscale and Cloudflared add-ons; Tailscale CLI `up --json`, operator mechanism, Serve and Funnel.

## 3. Scope

**In scope (milestone 1)**

- Trusted-proxy client address resolution shared by the throttler, display registration and websocket.
- `remote-access` module: config (internal URL, external URL, proxy trust), provider registry, URL
  registry with `getUrl()` semantics, posture advisories, status aggregation, websocket events, REST.
- Privileged worker runner extracted from the update executor.
- `remote-access-tailscale` plugin: setup, interactive sign-in with auth URL and QR, auth-key sign-in,
  connect and disconnect as a managed service, Serve HTTPS, Funnel, SSH, key-expiry advisory.
- Admin: Remote access page, module settings form, Tailscale provider card and setup wizard.
- Raspberry Pi image pre-installs Tailscale (disabled); installer flag; website documentation.
- MCP form suggests the primary external URL; MCP proxy policy consumes the shared trusted-proxy set.

**In scope (later milestones)**

- Cloudflare Tunnel plugin (backend and admin).
- WireGuard client plugin.

**Out of scope**

- Tailscale inside the Docker image or the Home Assistant add-on (documented alternatives instead).
- Identity-header single sign-on, multi-factor authentication, a FastyBird relay service, panel changes.
- Sudoers hardening (tracked as a separate technical task).

## 4. Acceptance criteria

### Foundation

- [ ] Forwarded headers are honoured only when the socket peer is a configured or provider-declared
      trusted proxy; the display registration guard and the throttler use the resolved client address.
- [ ] `remote-access` module exposes status, providers and urls endpoints, module config, events routed
      to the exchange room only, and OpenAPI models under the `{Module}Data{Name}` convention.
- [ ] `PrivilegedWorkerService` runs the update worker unchanged and reports unsupported platforms.

### Tailscale

- [ ] Set up installs the package if missing, enables the daemon and grants the operator, reporting each
      step; re-running is harmless.
- [ ] Sign in returns an auth URL and QR code; the node reaches `connected` after approval; an auth key
      path works headless; the key is never persisted or logged.
- [ ] Serve exposes the admin at `https://<node>.<tailnet>.ts.net` and declares loopback as a trusted
      proxy; Funnel and SSH are opt-in with advisories.
- [ ] Disable disconnects, logout expires the node key, factory reset clears Serve and logs out.
- [ ] Docker and Home Assistant platforms report `unsupported` with documentation links.

### Admin

- [ ] Remote access page shows internal and external URLs, the primary URL with copy and QR, provider
      cards, advisories, and updates live from events.
- [ ] Tailscale wizard walks Set up → Sign in → Options → Done; actions match the node state.
- [ ] Config schemas bind to generated types; all six locales present.

### Installer and docs

- [ ] Raspberry Pi image ships Tailscale disabled; `install-server.sh --with-tailscale` works.
- [ ] Website guide published; network requirements, extensions, image and MCP pages updated.

### Verification

- [ ] Hardware acceptance matrix from the plan recorded here with dates and outcomes.

#### Hardware acceptance checklist (alpha build on the testing Raspberry Pi)

Record the outcome of each row (date, pass/fail, notes) in `tasks/epics/EPIC-REMOTE-ACCESS.md` under Verification.

##### Preparation

- [ ] Flash the alpha image (or install the alpha npm package) on the testing Raspberry Pi and complete onboarding.
- [ ] Have a Tailscale account with **MagicDNS** and **HTTPS certificates** enabled (tailnet DNS settings) and, if device approval is on, access to the admin console.
- [ ] Have a phone on cellular (not on the home Wi-Fi) with the Tailscale app signed into the same tailnet.

##### Setup and sign-in

- [ ] Admin → Remote access: the page shows the internal URL and the Tailscale card reads "Not set up" (image) or "Not installed" (npm install without the package).
- [ ] Set up: on the image it completes in seconds (package pre-installed); on an npm install it installs from the apt repository and reports each step live.
- [ ] Sign in: a login link and QR code appear; approving on the phone flips the card to Connected with tailnet name, MagicDNS name and Tailscale IPs.
- [ ] Extensions → Services lists `remote-access-tailscale-plugin / node` as started and healthy.

##### HTTPS and remote use

- [ ] Serve HTTPS is on by default: the page lists `https://<node>.<tailnet>.ts.net` as the primary external URL with copy and QR.
- [ ] From the phone on cellular, open that URL: admin loads, login works, and a live change (toggle a device) updates without reload (websocket through the proxy).
- [ ] Backend log shows the tailnet client address (not 127.0.0.1) for a login attempt from the phone; the login throttle is per client.
- [ ] Displays → registration status seen from the phone is "closed" (not treated as local).

##### Lifecycle

- [ ] Reboot the Pi: the node reconnects without interaction and the URL still works.
- [ ] Disable the plugin (Extensions): the node disconnects, external URLs disappear; re-enable reconnects.
- [ ] Sign in with an auth key (advanced tab) on a second fresh install or after Sign out: node connects without the browser step.
- [ ] Sign out: the device disappears from the tailnet admin console; the card returns to setup-required.
- [ ] Factory reset: after restore, no tailnet login remains (`tailscale status` shows NeedsLogin) and Serve is reset.

##### Options and advisories

- [ ] Funnel on: the URL becomes public (open it from a device without Tailscale); the public-exposure advisory shows; Funnel off returns it to tailnet-only without touching other Serve handlers.
- [ ] Tailscale SSH on: `ssh smart-panel@<node>` from the phone/laptop works per the tailnet ACL; off again closes it.
- [ ] With a short-expiry auth key (or a key expiry set in the console): the key-expiring advisory appears and "Sign in again" recovers.
- [ ] Tailnet with HTTPS certificates disabled: the tailnet-https-disabled advisory appears with the console link; IPv4 and MagicDNS HTTP endpoints still work.

##### MCP

- [ ] MCP config form shows "Use remote access URL" when the HTTPS URL exists; clicking fills the OAuth public base URL and nothing saves until Save.

##### Other deployments

- [ ] Docker compose deployment: the Tailscale card reports unsupported with the documentation link; the manual external URL still works.


## 5. Example scenarios

### Scenario: sign in from a phone

Given a fresh Raspberry Pi image with an owner account
When the administrator opens Remote access, runs Set up, and scans the QR code with a phone signed into
their Tailscale account
Then the card shows Connected with the tailnet name and the page lists `https://<node>.<tailnet>.ts.net`
as the primary external URL.

### Scenario: remote client is not local

Given Tailscale Serve is active
When a tailnet client opens the admin through the HTTPS URL
Then the display registration guard and the login throttle see the client's tailnet address, not
`127.0.0.1`.

## 6. Technical constraints

- Follow the weather module and influx-v1 plugin structure; register metadata, config mapping, Swagger
  models and the managed service in `onModuleInit`.
- Never build shell strings from configuration; `execFile` with argument arrays and timeouts only.
- No new dependencies. No generated files edited by hand. Incremental migrations only (none expected).
- Depends on: nothing outside this epic; RA-1 must merge before any provider plugin ships.
- PR titles: taken verbatim from the plan's delegation map; one small PR per task.
- Suggested worker tiers: sonnet for implementation seats, haiku for locale transcription, opus for the
  three security review seats (RA-1, RA-2, RA-5).

## 7. Implementation hints

- Reuse `UpdateExecutorService`'s spawn and status-file pattern; do not invent a second one.
- Mirror `McpOAuthPublicUrlService` and `IsMcpOAuthPublicBaseUrlConstraint` for URL handling.
- Mirror `system.module.ts` for the admin socket subscription and `useChannelsPlugin.ts` for plugin
  element discovery.
- Read the Home Assistant Tailscale add-on run scripts before writing the `up`, `set` and `serve` calls.

## 8. Child tasks

Tracked as GitHub sub-issues of the epic issue under the "Remote access" milestone:

| Task | PR title | Status |
| --- | --- | --- |
| RA-1 | fix(backend): trust forwarded headers only from configured proxies | done |
| RA-2 | feat(backend): add remote access module foundation | done |
| RA-3 | refactor(backend): extract privileged worker runner from update executor | done |
| RA-4 | feat(backend): add Tailscale remote access provider plugin | done |
| RA-5 | feat(backend): add Tailscale setup and sign-in flows | done |
| RA-6 | feat(backend): serve admin over HTTPS through Tailscale | done |
| RA-7 | feat(admin): add remote access overview and settings | done |
| RA-8 | feat(admin): add Tailscale remote access setup wizard | done |
| RA-9 | feat(installer): preinstall Tailscale for remote access | done |
| RA-10 | docs(cross): document remote access and Tailscale setup | done |
| RA-11 | feat(cross): suggest remote access URL for MCP OAuth | done |
| RA-12 | integrated verification and hardware acceptance | in-progress |
| RA-13 | feat(backend): add Cloudflare Tunnel remote access plugin | milestone 2 |
| RA-14 | feat(admin): add Cloudflare Tunnel remote access setup | milestone 2 |
| RA-15 | feat(cross): add WireGuard client remote access plugin | milestone 3 |
| RA-16 | chore(installer): replace systemd-run sudo grant with fixed helper | follow-up |

## 9. AI instructions

- Read this file, the spec and the plan section for your task before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to your task's file ownership; append to shared files, never reorder them.
- For each acceptance criterion you touch, either implement it or explain why it is skipped.
- Do not push to `main`; open a PR with the task's title and wait for the Codex review.
