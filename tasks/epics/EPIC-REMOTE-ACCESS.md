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
- Fresh analysis and adopted completion sequence (2026-10-03, adopted 2026-10-04):
  [`2026-10-03-remote-access-completion.md`](../../docs/superpowers/plans/2026-10-03-remote-access-completion.md).
  This separates delivered code from outstanding hardware acceptance and documents reproduced
  lifecycle/status defects. The replacement execution sequence is active: R1 (#1156, PR #1160), R2 (#1157, PR #1161) and R3 (#1158, PR #1162) are complete.
  R4 (#910) and R5 (#1159) remain open, followed by #914 and #913.
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
- Fixed privileged helper and sudoers migration (#914), prerequisite for WireGuard. This was pulled
  into milestone 3 in the epic's September planning update.

**Out of scope**

- Tailscale inside the Docker image or the Home Assistant add-on (documented alternatives instead).
- Identity-header single sign-on, multi-factor authentication, a FastyBird relay service, panel changes.

## 4. Acceptance criteria

### Foundation

- [x] Forwarded headers are honoured only when the socket peer is a configured or provider-declared
      trusted proxy; the display registration guard and the throttler use the resolved client address.
      (Alpha.44/alpha.49: HTTPS registration status returned closed; Pi 5 tailnet/Mac LAN throttle separation.)
- [ ] `remote-access` module exposes status, providers and urls endpoints, module config, events routed
      to the exchange room only, and OpenAPI models under the `{Module}Data{Name}` convention.
- [ ] `PrivilegedWorkerService` runs the update worker unchanged and reports unsupported platforms.

### Tailscale

- [ ] Set up installs the package if missing, enables the daemon and grants the operator, reporting each
      step; re-running is harmless.
- [x] Sign in returns an auth URL and QR code; the node reaches `connected` after approval; an auth key
      path works headless; the key is never persisted or logged.
- [x] Serve exposes the admin at `https://<node>.<tailnet>.ts.net` and declares loopback as a trusted
      proxy; Funnel and SSH are opt-in with advisories.
- [x] Disable disconnects, logout expires the node key, factory reset clears Serve and logs out.
- [x] Docker and Home Assistant platforms report `unsupported` with documentation links.
      (Docker passed on published alpha.50, 2026-10-07; Home Assistant platform contract passed on
      alpha.56 with `PLATFORM_TYPE=home-assistant` in an isolated Docker container, 2026-10-09.
      This does not verify the HA add-on, Supervisor or ingress.)

### Admin

- [x] Remote access page shows internal and external URLs, the primary URL with copy and QR, provider
      cards, advisories, and updates live from events.
- [ ] Tailscale wizard walks Set up → Sign in → Options → Done; actions match the node state.
- [ ] Config schemas bind to generated types; all six locales present.

### Installer and docs

- [ ] Raspberry Pi image ships Tailscale disabled; `install-server.sh --with-tailscale` works.
      (Image ships it disabled: passed on fresh Pi 4 alpha.47; the `--with-tailscale` flag has no recorded evidence.)
- [ ] Website guide published; network requirements, extensions, image and MCP pages updated.

### Verification

- [ ] Hardware acceptance matrix from the plan recorded here with dates and outcomes.

#### October R4 candidate verification

Candidate: [`v1.1.0-alpha.42`](https://github.com/FastyBird/smart-panel/releases/tag/v1.1.0-alpha.42),
commit `5da7e3075c7a6367466f525b159b29167a627e64`, containing R1–R3 through PR #1162
(`e6ad90a07`). Evidence below was collected on 2026-10-04 UTC using the existing Debian 12/aarch64
image installation and Tailscale `1.102.3`. LAN SSH and owner admin access are independent of Tailscale.
The full R4 gate and the original checklist remain open; these results cover only the named scenarios.

| Scenario | Result | Evidence / scope |
| --- | --- | --- |
| Baseline before upgrade | Observed | Alpha.41; application and tailscaled active; CLI NeedsLogin; API/UI agree that the operator grant is missing. |
| Normal system-module upgrade | Passed | One explicit alpha.42 install request; worker survives application stop, reaches complete and releases its lock. Plugin enabled, login not yet started. |
| Upgrade data and artifact verification | Passed | SQLite integrity ok; all 111 device identities/topology, configuration, schema and 28 migration rows retained; all 1,718 installed backend files match checksum-verified server/npm artifacts. |
| Operator setup on installed Tailscale | Passed | UI Start setup completes; the wizard advances to Sign in without reload. This tests an existing package, not fresh npm/image installation. |
| Second setup with websocket unavailable | Passed | Removed only the operator grant while still unauthenticated, then started another setup from the UI. Browser reconnection was suppressed throughout; REST reads began after acceptance and the wizard advanced to Sign in. Browser connection restored afterward. |
| Pending interactive login privacy | Passed | Privileged response carries the login link with Cache-Control no-store; aggregate status omits it; application journal contains no login URL or auth-key marker during the observed window. |
| Interactive approval | Partial | Initial approval reached CLI Running/self-online and the UI completed the wizard. The test tailnet was then replaced; Pi was explicitly logged out and the user approved Pi in the replacement tailnet. The plugin API reports connected/authenticated with all requirements satisfied and no auth URL. Logout removed the operator grant; the API correctly blocked login until Set up restored it. |
| Pending-login request budget | Failed | Hardware observation included HTTP 429. A regression test reproduced 32 status reads/minute from concurrent 3-second login and 5-second fallback polling, above the route limit of 30. The fix lets completed store reads satisfy the fallback; the same test now performs 20 reads/minute and confirms fallback recovery afterward. |
| Connected aggregate status and URLs | Failed | Connected GET /status returned HTTP 500 because the response interceptor attempted to mutate a frozen accepted endpoint. Production-interceptor E2E tests reproduced this for /status and /urls; copying endpoint models at the response boundary fixes both while preserving frozen cached observations. |
| Twenty lifecycle cycles and remote reachability | Not run | The cycle runner stopped during its aggregate-status preflight before any lifecycle action. Resume on a released candidate containing both fixes and repeat the full matrix in the new tailnet. |

A retained SQLite and configuration backup passed integrity/hash validation before upgrade. Private
raw evidence, device addresses, credentials and authentication links are retained outside this repository.
Both regression fixes pass local validation (544 admin tests, 163 backend unit tests, 16 module HTTP
tests, backend/admin type checks and changed-file lint/format). They have not yet been deployed or
accepted on hardware; alpha.42 does not pass the R4 gate.
Fresh installs, keyed/expired login, the full lifecycle/transport matrix, destructive factory reset and
upgrade while login is pending are not claimed by these checks.

#### Alpha.43 upgrade and CLI compatibility finding

Candidate: [`v1.1.0-alpha.43`](https://github.com/FastyBird/smart-panel/releases/tag/v1.1.0-alpha.43),
commit `46c2b35a4bf8097c1a70f67a4e37b2615298ac36`, containing PR #1163 (`cf9441c1a`).
Observed on the same Debian 12/aarch64 Pi with Tailscale `1.102.3`, 2026-10-04 UTC.

| Scenario | Result | Evidence / scope |
| --- | --- | --- |
| New tailnet baseline | Passed | User approved Pi and the test Mac in the replacement tailnet. Before upgrade, Pi was Running/self-online and the Mac received HTTP 200 from its Tailscale IP. |
| Normal alpha.42 → alpha.43 upgrade | Passed for application | One system-module install request; durable worker completed and cleared its lock. All 111 devices/topology, 28 migrations, configuration and authentication data were retained; the previous admin session and a fresh login both worked. |
| Installed artifacts | Passed | All 1,718 backend JS files and 250 admin static files match the checksum-verified server archive and integrity-verified npm packages. |
| Tailscale recovery after upgrade | Failed | Node identity/authentication survived, but CLI remained Stopped. Extensions reported the node service started/desired started, while the private API and card correctly reported Disconnected. Start/reconnect failed at `tailscale set --advertise-tags=`, before reaching `up`. |
| Real CLI contract | Confirmed | On the installed 1.102.3 binary, `set --help` omits `--advertise-tags`; `up --help` supports it. Automatic reconnect retries reproduced the unsupported-flag error. |
| Explicit UI Connect | Failed, control recovered | One click returned HTTP 500 and a failure notification; the card stayed Disconnected and Connect became available again. |
| Corrected CLI sequence, run manually | Passed after settling | With installed plugin code unchanged, the service user ran supported `set` flags then `up` with tag flags: both exited 0. Subsequent CLI reads reported Running/self-online and no auth URL; selected preference fields matched baseline except WantRunning false → true. The immediate snapshot had not yet settled and is retained separately. |
| Connected aggregate regression after manual recovery | Passed | Both connected aggregate /status and /urls returned successfully with the two Tailscale endpoints. The first tailnet HTTP probe timed out; after a successful Tailscale ping, a follow-up health request returned HTTP 200. This is connectivity evidence, not lifecycle acceptance. |
| Twenty lifecycle cycles | Not run | No cycle-runner actions were sent on alpha.43. Resolve the CLI compatibility defect and repeat on a released candidate before claiming this gate. |

The CLI regression fix separates `set`-compatible preferences from `up`-only flags and applies tag
changes through `up`. It retains the existing settings-conflict behavior for unmanaged preferences;
normal lifecycle operations do not use `--reset`. All 404 Tailscale tests, backend type checking and
changed-file lint/format passed at the first revision; the final review fix brings the total to 415 tests.
PR #1164 merged as `6ddc03e46` and is deployed in alpha.44. Hardware acceptance remains open. No raw node
identity, tailnet addresses, credentials or authentication links are published with this evidence.

#### Alpha.44 upgrade, HTTPS and interrupted lifecycle test

Candidate: [`v1.1.0-alpha.44`](https://github.com/FastyBird/smart-panel/releases/tag/v1.1.0-alpha.44),
commit `80d374a7f9af9fb19aea14d5e6d89f47b3467f99`, containing PR #1164 (`6ddc03e46`).
Observed on the same Debian 12/aarch64 Pi with Tailscale `1.102.3`, 2026-10-04 UTC
(2026-10-05 local time). The user enabled HTTPS certificates in the replacement tailnet.

| Scenario | Result | Evidence / scope |
| --- | --- | --- |
| Normal alpha.43 → alpha.44 upgrade | Passed | One system-module install request; worker completed and cleared its lock. The retained SQLite/config backup passed integrity checks. All 111 devices and their topology, 28 migrations, configuration and authentication fingerprints were unchanged; both the previous session and fresh login worked. |
| Installed artifacts | Passed | All 1,718 backend JS files and 250 admin static files match the checksum-verified server archive and integrity-verified npm packages. Tag ancestry includes the approved fix; the release build identity matches the dispatched workflow. |
| Tailscale recovery after upgrade | Passed | Authentication and node identity survived; CLI returned Running/self-online and private API/card reported Connected. No manual `set`/`up` recovery was performed. |
| Serve after enabling tailnet HTTPS | Passed for Mac transport | Plugin published a private HTTPS endpoint and cleared the HTTPS advisory. Mac HTTPS health returned 200 for alpha.44 with certificate verification enabled; an initial TLS connection attempt timed out. |
| Phone cellular HTTPS, login and live updates | Passed, user-confirmed | With Wi-Fi disabled and Tailscale connected to the new tailnet, the user confirmed that admin loaded without a certificate error, login succeeded and a device-state change made in another client appeared without reloading the page. This verifies visible live updates; the phone's transport frames were not captured separately. |
| WebSocket through Serve | Passed from Mac | A client restricted to the WebSocket transport authenticated over HTTPS with certificate verification enabled, subscribed to the exchange and received an event. No polling fallback was allowed. |
| Display registration through Serve | Passed from Mac | The HTTPS registration-status endpoint returned `open: false`, rather than treating the proxied tailnet client as a direct localhost request. This does not establish the phone's resolved client address or per-client throttle behavior. |
| Initial Connect | Passed after settling | Provider, Extensions service, CLI, aggregate endpoints/proxy contributions and direct tailnet HTTP health agreed after completion. Sequential REST revisions advanced and were checked for ordered, semantically equivalent settled state; they do not establish atomic observation. |
| First Disconnect | Failed: backend process crashed | Disconnect returned successfully in 632 ms with stopped/authenticated control and empty endpoints. The subsequent status read received a connection reset. Journal records an uncaught `@homebridge/ciao` assertion in `MDNSServer.handleMessage` → `getNetAddress`, followed by process exit 1 and a systemd restart. |
| Reappearance of Connected | Explained by restart | The enabled provider started with the replacement backend process. This is not evidence of an obsolete Tailscale operation reviving the stopped service. The admin recovered to Connected after restart. |
| Twenty lifecycle cycles | Not completed | The runner stopped at the first Disconnect without retrying the mutation; zero complete rounds. Preserve this failed run and repeat the entire gate after the mDNS correction is released. |

The same assertion is reproducible locally with the installed ciao 1.3.12 packet handler: an IPv4
datagram reaches an interface whose IPv4 mask is absent. Subnet calculation throws before the
library's packet-decoding error boundary. This establishes a concrete failure mode consistent with
interface removal; the exact live packet and interface fields were not captured. The correction must
preserve ordinary IPv4/IPv6 and loopback filtering and ship in both npm and image installations.

The HomeKit correction installs an idempotent receive guard on the ciao instance resolved from HAP's
own dependency context before publishing the bridge. Invalid sender families and IPv4 receives on
interfaces without a valid IPv4 address/mask are discarded before subnet calculation. Valid traffic
and unrelated errors continue through the original handler; no global exception handler is added.
The private upstream method is a compatibility dependency, covered by real-library regression tests.
Validation: 48 HomeKit/mDNS/remote-access suites / 869 tests, backend type checking/build and changed-file
lint/format passed. The compiled guard also passed with an isolated npm-installed HAP/ciao pair, and
the backend package includes its runtime files. This correction is not deployed in alpha.44.

The UI recorder started after the initial Connect request began, so this interrupted run does not
provide full UI action-latency coverage. No HTTP 429 was observed in the captured browser requests;
that short capture is not a completed polling/idle acceptance test. An earlier browser profile-null
observation disappeared on standard page initialization; its original authentication setup is not
established, so it is not recorded as a reproduced session or Tailscale defect.

#### Alpha.45 upgrade and session-expiry finding (2026-10-05)

PR #1165 merged as `512626cc2c2fb92a251e5ec67f0a439717a714cc`. Alpha.45, tag commit
`483a899113a2118f07b4dcb420e60646adb8010c`, was published by
[release run 37278364504](https://github.com/FastyBird/smart-panel/actions/runs/37278364504)
and installed through one normal system-module upgrade from alpha.44. The updater completed and
cleared its lock. Verification preserved all 111 device identities/topology, 28 migrations,
configuration, credentials, the existing admin session and Tailscale identity. Fresh login and
automatic Tailscale connection passed. The installed 1,719 backend files and 250 admin static files
match the verified server archive and npm packages. The HomeKit receive guard is now deployed.

The first cycle attempt stopped at remote reachability because the Mac's Tailscale client was
stopped; the Pi remained healthy. After reconnecting the Mac, Disconnect completed without the
previous mDNS crash and withdrew the endpoint/proxy contributions and actual tailnet reachability.
Concurrent UI/test reads through the shared SSH client address reached the 30/minute route limit.
With UI moved to direct LAN access, one API/CLI/service/reachability round completed (Connect 95 ms,
Disconnect 610 ms, Connect 200 ms), but the browser still received HTTP 429. Testing was stopped;
the twenty-round UI gate and rapid-action test remain incomplete. Backend and daemon process
identities stayed unchanged with zero restarts, and the Pi was left connected/authenticated.

The shared admin reconciliation hook immediately fetches private status on each new public revision
when no read is active. Its normal polling interval does not bound that event-driven path. Concurrent
observers publish new revisions even for unchanged status and can therefore amplify the browser's
reads across distinct client addresses. A matching echo of the browser's own completed GET does not
by itself establish a self-sustaining loop. Bound event-driven metadata refreshes and repeat R4;
do not raise the production request limit to accommodate the acceptance harness.

The follow-up admin correction coalesces those events per provider store and leaves at least five
seconds after a completed status read before event-driven metadata reconciliation. Pending updates
receive one trailing read; stable satisfied sessions retain their 30-second fallback. Explicit action
refreshes and epoch resynchronization keep their existing immediate paths. The regression reproduces
600 reads for 600 revisions over one simulated minute before the fix, and checks the bounded cadence,
latest metadata, failed-read spacing, external polling and subscriber cleanup afterwards. This
correction is not deployed in alpha.45; the full twenty-cycle UI gate remains open.
Validation passed: 26 focused hook/card tests, admin type checking, changed-file lint/format and
whitespace checks. Under 600 revisions per simulated minute, the corrected hook performs 11 reads
within that minute and one trailing read carrying the latest metadata.

Post-test alpha.45 checks confirmed TLS-verified HTTPS and authenticated WebSocket-only event
reception from the Mac. The captured backend journal contains no recurrence of the mDNS assertion
or Serve-handler failure. These checks do not substitute for the remaining hardware matrix.

A separate admin failure was reproduced before this upgrade with a normally initialized owner
session on alpha.44. The page initially offered Disconnect. After natural access-token expiry,
`POST /auth/refresh` returned HTTP 201, but the profile became null and the controls disappeared
while the replacement token remained present. No navigation or lifecycle action triggered this
transition. This establishes a session-expiry cause for this captured symptom; the earlier
uncontrolled observations alone did not establish it.

The request middleware also intercepts the refresh request. Re-entering the session's refresh
operation returns false while it is already updating, causing the middleware to clear the profile.
The original successful refresh then restores only the tokens. The correction excludes the refresh
endpoint from automatic refresh and 401 retry handling. Integration tests use the actual session
store and HTTP client to reproduce profile loss and cover permission preservation, concurrent
request coalescing, rejected refreshes and ordinary 401 responses. The correction is not part of
alpha.45; its release and natural-expiry hardware rerun remain required. Validation passed:
102 targeted auth/socket tests, all 3,261 admin tests across 382 files, admin type checking,
changed-file lint/format and whitespace checks.

#### Alpha.46 acceptance (2026-10-05)

PR #1166 merged as `e3dea0ca2` and #1167 as `c489fd240`. Release
[`v1.1.0-alpha.46`](https://github.com/FastyBird/smart-panel/releases/tag/v1.1.0-alpha.46)
names commit `d11bc23d88b98a67fa6529aa3258f28c7f10a9f1`; workflow run `37292643797`.
One normal system-module upgrade from alpha.45 completed with its lock removed. The retained
backup, 111 device identities/topology, 28 migrations, schema, configuration, authentication,
pre-upgrade and fresh sessions, and Tailscale identity all passed comparison. The installed
1,719 backend files and 250 admin static files exactly match the verified server/npm artifacts.
Tailscale recovered automatically; the admin was reloaded to use the released bundle.

Initial observations must remain separate from the clean rerun:

- The first attempt stopped before lifecycle actions because the single three-second tailnet
  health probe failed. A later read succeeded without changing the Pi lifecycle.
- The second attempt completed Connect/Disconnect and a final Connect's CLI/API settlement,
  but its single tailnet health probe failed. Zero complete rounds passed. There was no backend
  or daemon restart. Later HTTP health succeeded without a recovery action.
- Browser reads were bounded to at most 12 per rolling minute, yet received HTTP 429. An incoming
  request-line capture and local socket ownership identified a separate Firefox admin client
  sharing the same client IP. The user closed that tab before the clean rerun and the existing
  minute-long block was allowed to expire. No production limit was raised.
- Local dependencies initially resolved throttler 6.5.0, but the actual alpha.46 archive installs
  6.7.1. The old library's cross-key expiry defect is therefore not the cause of this observed
  alpha.46 failure. PR #1168 pins 6.7.1 for consistent testing/releases and gives Tailscale and
  Cloudflare distinct controller identities so their status/setup rate budgets cannot collide.
- The clean harness observes connected HTTP convergence for at most 15 seconds, recording every
  attempt and separating that delay from the lifecycle API latency. Only transport failures get
  another read; no lifecycle mutation is retried, and HTTP errors/redirects/wrong versions fail.
  Disconnect still requires the tailnet origin to be unreachable. No proxy or LAN fallback is used.

The clean run passed all 20 Connect→Disconnect→Connect rounds (60 actions), including concurrent
status reads, stable CLI/Extensions/aggregate state, endpoint and proxy withdrawal, and actual
Tailscale HTTP reachability. All 60 completed actions matched the captured DOM state, owner profile
and enabled control within the acceptance window. No browser HTTP errors, backend restarts or
Tailscale daemon restarts occurred. Browser status reads peaked at 12 per rolling minute; the
combined browser/runner estimate was 26 (their source addresses differ).

Connect API latency had median 199.5 ms and maximum 2,396 ms, including already-connected calls;
Disconnect had median 624 ms and maximum 734 ms. Connected HTTP observation took up to 8,049 ms
after CLI/API settlement. These are different measurements: fast API completion does not establish
immediate transport availability. The three-second single-probe limit in earlier attempts was too
short for at least one observed convergence.

Three rapid-action rounds also passed: Connect was followed by Disconnect after 100 ms, with a
measured concurrent status read in every round. Each cancelled Connect returned HTTP 409 with
`operation-cancelled`; Disconnect succeeded, stopped state was confirmed twice, and only a later
explicit Connect restored connectivity. All nine settled preparation/disconnect/restore steps
matched the UI before the next action; no browser HTTP errors or service restarts occurred.

Natural admin access-token expiry at 11:11:47 UTC was observed without token or clock changes.
Refresh at 11:12:19 UTC returned HTTP 201 in 534 ms, advanced the token expiry, and retained the
owner profile and enabled Disconnect button. Profile continuity held throughout the recording.
TLS-verified HTTPS and an authenticated WebSocket-only event subscription also passed from the
Mac after the rapid test. The subsequent 609.6-second idle observation passed: backend/daemon
identities and restart counters stayed unchanged, with one process per service at both boundaries.
The 20 collected journal entries contained no assertion, management-denial, Serve-failure or
restart/stop pattern. The UI retained Connected, owner profile and enabled controls, with ten
status reads and no HTTP errors or recorder overflow. Boundary counts do not establish behavior
between samples. On 2026-10-05 the user also confirmed admin loading, login and live device
updates without page reload on alpha.46 from a phone with Wi-Fi disabled and Tailscale enabled.
This confirms the visible cellular outcomes; phone transport frames were not captured separately.
The broader R4 matrix remains open; no fresh-install, auth-key, reboot/reset, Funnel/SSH or phone
transport row is implied complete by an application upgrade or API lifecycle test.

The Low-risk review follow-up from #1167 is addressed in #1169: queued event metadata work now
survives an external GET completion and gets one bounded trailing read after polling stops. A
successful external GET may cause one extra read because the semaphore exposes no outcome.
Three regressions failed before the correction; 62 hook/card tests, admin type checking and
changed-file lint/format passed afterwards. These two follow-up PRs are not deployed in alpha.46.

#### Alpha.47 deployment and lifecycle persistence (2026-10-05)

PR #1168 merged as `2593d8436f3a8e9261043ede50ab1d26fd37bd48`; #1169 merged as
`61c26995fa82dbd807e2e892de2f2013a0830421`. Both passed CI and CodeRabbit review with
Minimal merge risk and no actionable comments. Release
[`v1.1.0-alpha.47`](https://github.com/FastyBird/smart-panel/releases/tag/v1.1.0-alpha.47)
names commit `38d59a30fe09b810e6baa854f9bb904797e1aeab`; workflow `37314706171` was dispatched
from the latter merge. Server/npm artifacts are published; SD-image jobs remain in progress at
this evidence checkpoint. This is the existing Raspberry Pi 5 Model B Rev 1.1, Debian 12/aarch64
image installation with Tailscale 1.102.3, not a fresh installation.

One normal system-module upgrade from alpha.46 completed and released its lock. All 111 device
identities/topology, 28 migrations, schema, configuration, accounts/credentials and long-lived
tokens were preserved. Both the pre-upgrade session and a fresh login worked. The installed
1,719 backend files and 250 admin files match the verified server/npm artifacts. The archive,
npm dependency declaration and installed throttler package all match the exact 6.7.1 pin.
Tailscale recovered automatically with the same node identity. The admin was reloaded once to
use the new bundle before the following observations.

Configuration lifecycle observations passed:

- One PATCH changed only plugin `enabled` to false. CLI became Stopped, Extensions became disabled/
  stopped, endpoints/proxies disappeared, and the provider was removed from aggregate URLs. Both
  tailnet HTTP and TLS-verified HTTPS origins became unreachable. Backend/daemon identities stayed
  unchanged during this transition. The Tailscale card disappeared without reloading the page.
- One application restart while disabled changed the backend invocation, retained the host boot ID
  and tailscaled invocation, and kept configuration disabled and CLI/Extensions stopped. No endpoint
  returned. CLI Self.ID stayed unchanged; the fresh disabled backend's authentication cache was
  allowed to be unknown and was not treated as proof of logout.
- One PATCH restored only `enabled` to true. CLI/API/Extensions/aggregate state returned to Connected,
  and actual HTTP/HTTPS reachability returned without interactive login. The card reappeared and
  settled with enabled controls. PATCH response times were 107 ms for disable and 125 ms for enable;
  these are request acknowledgements, not end-to-end connection latency.

One enabled host reboot was then submitted. SSH closed during submission; the request was not
repeated. Subsequent observations verified a different boot ID and both new service invocations,
unchanged node identity/configuration, and automatic CLI/API/Extensions/aggregate recovery.
The existing admin page returned to Connected with its owner profile and controls about 66 seconds
after submission, without reload. The recorder saw one expected transport failure while the host
was down, no HTTP 429, no overflow, and at most five private status reads per rolling minute.

The initial Mac host-reboot reachability check failed: its 15-second HTTPS convergence probe
and subsequent WebSocket-only probe timed out. Diagnosis found the Mac in Running state but
Self.Online false, with a coordination-server connection warning; netcheck could reach neither
UDP nor DERP. Ordinary HTTPS to the coordination/login hosts still returned 200. Pi remained
Running/self-online with the expected Serve HTTPS handler. One Mac down/up and socket rebind did
not restore that client's connectivity. No Pi reconnect or second reboot was attempted.

On 2026-10-05 the user independently confirmed that the admin loads at the same Tailscale HTTPS
URL after this reboot from a phone with Wi-Fi disabled and Tailscale enabled. The reboot row now
passes for automatic node recovery and user-confirmed cellular admin reachability. The failed
Mac probes remain recorded as a separate client/network limitation. This confirmation does not
establish a fresh post-reboot login, live device update or captured phone WebSocket transport;
the earlier complete loading/login/live-update phone confirmation applies to alpha.46.

Post-lifecycle database topology/counts, migrations, schema, accounts/credentials, node identity
and semantic comparison of the full saved configuration against the retained backup all passed,
including fields omitted by public config responses. Raw evidence and all addresses/credentials
remain private. This release's observations supplement the alpha.46 twenty-cycle, rapid-action,
natural token renewal and idle results; those tests were not repeated or relabelled as alpha.47.

#### Fresh Pi 4 image acceptance (2026-10-05, alpha.47)

A separate Raspberry Pi 4 Model B Rev 1.5 now runs the official alpha.47 server image
(`38d59a30f`), Debian 12 Bookworm arm64 and preinstalled Tailscale 1.102.4. The direct raw-image
write passed a full readback comparison and the boot files matched the reference before hostname
configuration. Firstboot completed successfully, expanded the root filesystem to 28 GB, and started
the backend. Owner onboarding completed through the admin UI with no devices, spaces or displays.
The earlier non-booting card contained incompatible image data; it is not evidence of a release
boot defect. The exact earlier write/mix-up sequence remains unresolved.

Fresh-image setup and connected-state observations passed:

- The plugin was disabled by default. Enabling it with the Extensions switch exposed the Tailscale
  card and accurate inactive-daemon/operator requirements. Set up → Start setup used the preinstalled
  package; the privileged scope started at 19:17:57 UTC and completed at 19:17:58 UTC. The daemon became
  active and its operator matched the backend service user. This does not cover npm/apt installation.
- The wizard displayed a sign-in link and QR code. User approval in the test tailnet moved it to
  Options and the card to Connected with tailnet, MagicDNS and IP details. Default Serve HTTPS was on;
  Funnel and Tailscale SSH were off. Skipping optional edits completed the wizard.
- The actual Extensions → Services → Plugins view displayed the Tailscale `node` service as
  Running / Healthy. HTTPS was the primary private external URL. Requests from the original Pi 5
  passed certificate verification and returned alpha.47 health. A fresh owner login over that HTTPS
  origin returned 201 and a token; display registration status was closed for that remote peer.
- Disabling through the Extensions UI switch stopped the node, removed the provider/external URLs,
  and made HTTPS unreachable from the Pi 5. Re-enabling through the same UI restored Connected and
  TLS-verified HTTPS without another login, retaining the same node identity. The browser was navigated
  between views for these observations; this is not a new uninterrupted live-card convergence test.
- The MCP form's Use remote access URL button filled the OAuth public base URL. Reopening the form
  without Save restored its empty value, confirming that the suggestion did not persist itself.

The Mac still failed DNS and direct-IP tailnet reachability, so these peer checks ran from the Pi 5.
One initial Pi 4 CLI DNS health warning cleared on the next observation, and DNS resolution worked;
no DNS setting was changed. The user then confirmed that the new Pi 4 login page loads without a
certificate error on a phone with Wi-Fi disabled and Tailscale enabled. This verifies cellular HTTPS
reachability; it does not establish phone login, phone WebSocket transport or live device updates.

Fresh-image acceptance also found [#1171](https://github.com/FastyBird/smart-panel/issues/1171):
the captive portal/hotspot remained active alongside connected Ethernet, leaving admin in Setup Mode.
The portal checks network connectivity only at startup and does not reconcile a later Ethernet
connection. DHCP arriving after that check is the likely trigger, not a captured timestamp ordering.
The installer fix and its hardware verification remain open. At this stage auth-key login, logout,
factory reset and the other unchecked R4 scenarios remained unperformed. The subsequent reset
observation is recorded below. The original Pi 5 remains intact and authenticated. Full R4 and
epic #897 remain open.

#### Pi 4 factory-reset acceptance (2026-10-05, alpha.47)

The spare Pi 4 was reset once through System → Manage system → Factory Reset, while Tailscale was
authenticated/online and Serve HTTPS was configured. LAN SSH recovery was verified first; the
application had one test owner and no devices, spaces or displays. The journal confirms that the
reset cascaded to zero displays. No reset command was sent to the original Pi 5.

After the 21:19:28 UTC submission, the host rebooted and onboarding reported no owner at 21:20:37 UTC.
The existing admin page automatically reached onboarding without a manual reload. Post-reboot receipts
confirmed a new host boot ID and service invocations, alpha.47 health, zero users and auth tokens,
and an incomplete onboarding state. The former owner's login was rejected before account recreation.
Tailscale reported `NeedsLogin`, no Tailscale IPs and an empty Serve configuration (`{}`). Both normal
DNS and direct-IP HTTPS probes from Pi 5 failed to connect. The daemon remained installed and running,
as expected; this acceptance checks removal of authentication and Serve, not package removal.

Onboarding was then completed again with the test owner. Extensions showed the Tailscale plugin
disabled by default. Enabling it accurately exposed the missing operator grant and the Set up remedy.
Repeating Set up restored that grant and completed the privileged job in approximately one second.
The factory-reset checkbox is complete; separate Sign out and successful auth-key login observations
are recorded below. The captive portal was inactive after this reboot;
this did not validate a fix for the first-boot Ethernet race in #1171.

An invalid-key test then found [#1172](https://github.com/FastyBird/smart-panel/issues/1172): the CLI
remained `NeedsLogin` with an invalid-key error and the provider card correctly stayed Setup required,
but the wizard advanced to Options. The login API returns the observed provider state after a CLI
failure; the wizard incorrectly treated every result except `pending-auth` as success. The follow-up
fix advances only for `connected`, retains pending states on Sign in, and reports terminal failures,
including late polling failures and explicit deadline feedback when the final state is still pending.
Regression tests cover immediate failures, key erasure, pending connection/approval, timeout/retry
and closed-session isolation. Fixed-release hardware verification passed on alpha.48 as recorded below.

#### Pi 4 alpha.48 upgrade and invalid-key recovery (2026-10-06)

The spare Pi 4 upgraded from alpha.47 to alpha.48 through System → Install Update at 08:28:33 UTC.
The privileged worker completed at 08:29:13 UTC without recovery being required, released its lock,
and the UI reported success. A consistent database/configuration backup was retained before installation.
Post-upgrade checks confirmed healthy service/API, unchanged owner and long-lived token fingerprints,
configuration, device topology/counts, database schema and all 28 migrations. Tailscale remained signed out.

The release tag includes the merged #1173 fix. The ARM64 server checksum and backend/admin npm
integrity checks passed; all 1,719 installed compiled JavaScript files and 250 admin static files
matched the verified release, with no extra static files. The pinned throttler version remained 6.7.1.

After reloading the admin and running Set up to restore the operator grant, two deliberately invalid
auth keys were submitted through Advanced sign-in. Both attempts stayed on Sign in; Options and Done
remained waiting, and the key input was cleared. The retry was available after entering a new value
and displayed “Failed to sign in to Tailscale”. CLI state remained NeedsLogin with an invalid-key error,
the provider stayed Setup required without external URLs, and no temporary auth-key files remained.
This verifies #1172 failure handling on hardware; pending approval and the ten-minute timeout retain
their automated regression coverage rather than being claimed as hardware observations here.

The captive-portal fix from #1174 merged after alpha.48 was released. Its subsequent fresh-image
and controlled late-Ethernet acceptance are recorded below; the server image build from that merge is
[run 37436682127](https://github.com/FastyBird/smart-panel/actions/runs/37436682127).

#### Pi 4 auth-key login and explicit logout (2026-10-05, alpha.47)

After the reset and repeated setup above, a real one-off auth key was submitted once through the
wizard's Advanced sign-in tab at 21:41:32 UTC. No browser authorization was needed. The wizard
advanced to Options and Done with the provider Connected; CLI inspection at 21:41:44 showed
Running, online and no health errors. Serve HTTPS appeared as the primary external URL. Both normal
DNS and direct-IP HTTPS health probes from Pi 5 returned HTTP 200 with successful certificate
verification at 21:43:48. This validates the successful path on alpha.47; it does not validate the
unreleased fix for invalid-key results.

The provider card's explicit Sign out action was submitted at 21:45:10 UTC. The local admin session
and owner remained usable, while the provider became Setup required, external URLs disappeared,
and CLI reported NeedsLogin, no Tailscale IPs and offline. Both peer HTTPS probes timed out. As with
the factory reset, logout removed the profile's operator grant; the UI accurately offered Set up to
restore it. The spare Pi 4 was left signed out with LAN admin/SSH access available.

No temporary auth-key files remained. An exact-key audit of three application configuration/database
files and the smart-panel/tailscaled journal since 21:40 UTC found no key matches. The private source
file on the Mac was not included in repository artifacts.

The previous checklist incorrectly required a non-ephemeral device to disappear from the admin
console after logout. The [Tailscale CLI contract](https://tailscale.com/docs/reference/tailscale-cli#logout)
expires the current login and requires reauthentication; immediate removal is specific to ephemeral
nodes. The corrected row checks logout behavior. No admin-console deletion is claimed.

#### Captive-portal Ethernet recovery follow-up (#1171)

The installer wrapper now gives every unconfigured boot a bounded 30-second connectivity grace,
including fresh images without a boot-config marker. NetworkManager queries have a deadline and
the SmartPanel hotspot does not count as external Wi-Fi. Once the portal starts, its Node process
checks Ethernet every five seconds with a bounded, cancellable probe. A connected Ethernet interface
starts the configured-marker/watchdog flow only after NetworkManager confirms the hotspot is inactive.
Failed or unconfirmable teardown leaves the marker unset and retries while keeping the portal and
DNS redirect available. Startup also confirms stale-hotspot cleanup before skipping setup, including
when an existing configured marker is present. Successful recovery uses the portal's shutdown path.
Active Wi-Fi provisioning retains ownership of its completion; runtime recovery checks Ethernet only.

Twenty-three isolated process regressions passed on the Mac and unprivileged on the spare Pi 4
(Debian 12 arm64), using mocked system/network commands and private paths:
`python3 build/raspbian/tests/test_portal_network_recovery.py`. They cover initial/delayed Ethernet,
hotspot exclusion, slow probes, captive redirects, Wi-Fi success/failure and concurrent Ethernet,
probe cancellation, repeated signals, held HTTP requests and child exit status. Review follow-ups also
cover failed/unconfirmable teardown, retry after restart, existing-marker handling and whole-process-group
test cleanup. Bash/Node syntax and scoped ShellCheck
also passed. The dedicated Installer portal tests CI job runs the suite on Node 24/Linux. These tests
do not change the host network.

Fresh-image startup passed on the spare Pi 4 on 2026-10-06 using server image build
[37436682127](https://github.com/FastyBird/smart-panel/actions/runs/37436682127), from merge
`22e5ef2bdf904a421621a72f0c372b52d2aaeb98`. The downloaded artifact/archive checksums and complete
SD-card readback passed; installed portal files match that merge. Ethernet became available after
12 seconds during the 30-second startup grace. The wrapper created the configured marker and exited
successfully without starting the hotspot. DNS redirection was absent, the watchdog and backend ran,
and first-boot initialization completed with expanded root storage and database migrations. The admin
onboarding flow completed and its authenticated System info API reported `network_mode: online`.
This first-boot observation covers Ethernet arriving during startup grace.

A physical unplug attempt restarted the Pi and was excluded from continuous-operation acceptance.
A controlled repeat disconnected eth0 through NetworkManager while retaining power, armed an
independent 90-second reconnection timer, and exercised the installed portal with real system/network
commands. The test backed up and removed the configured marker and stopped the watchdog;
it did not modify the portal implementation. The same boot ID was retained throughout.
At 09:56:47 UTC the real hotspot, DNS redirect and `network_mode: setup` were observed. Ethernet
returned at 09:57:45; by 09:57:52 the portal/hotspot had stopped, the new marker existed and DNS
redirection was gone. The API returned `online` at 09:57:58 after the platform cache refreshed.
The open admin displayed Setup Mode on reconnection and cleared the notification without a page reload.

These portal outcomes do not mean the backend remained continuously available: both controlled
network-loss attempts exposed a separate asynchronous mDNS `ENETUNREACH` process exit, followed by
systemd restart. The successful portal observer recorded this outage and continued instead of
triggering its fallback. The mDNS crash is tracked in
[#1223](https://github.com/FastyBird/smart-panel/issues/1223); fixed-release verification is recorded below.

The follow-up provides nonthrowing response-send error callbacks for the advertisement, Home Assistant
discovery and WLED discovery Bonjour instances. It logs failures without forcing teardown/restart or
adding a global exception handler. Three scoped suites (33 tests) pass, including an asynchronous
response-send failure through the real Bonjour dependency with an in-memory socket, a later successful
response, continued discovery and normal stop/start. This covers Bonjour response-send callbacks;
other socket error paths are not covered by this change.

#### Pi 4 alpha.49 mDNS and network recovery verification (2026-10-06)

PR [#1224](https://github.com/FastyBird/smart-panel/pull/1224) merged as `f69be1ad7`.
The released server candidate is `1.1.0-alpha.49`, tag commit
`5168e08af7d24304a6b498f8e04056f7199e21e4`, from
[run 37468174266](https://github.com/FastyBird/smart-panel/actions/runs/37468174266).
Its server publishing/build/release jobs passed before installation; SD-image builds were still
running and were not the artifact used for this System update. The server SHA-256 was
`528977e9d48edd25b8c0e6aa4c8454600cebea13aae5069acca62dc13f2f43ea`.
Release ancestry, npm integrity and server/npm content equality were verified, including all three
compiled Bonjour callbacks. Installed hashes matched all 1,719 runtime JavaScript and 250 admin
static files, with no missing, changed or extra files; throttler remained pinned to `6.7.1`.

On the same spare Pi 4, System UI upgrade from alpha.48 started at 14:02:30 UTC and the worker
completed at 14:03:14. The open admin reported success and alpha.49 without manual reload.
A consistent SQLite/configuration backup preceded the update. All 19 upgrade checks passed:
accounts, long-lived token fingerprints, topology, configuration and existing migrations were retained,
database integrity passed, no schema change/new migration was observed, and the update lock was released.
The Tailscale package remained installed, its daemon inactive and the node unauthenticated.

The controlled Ethernet test armed at 14:04:15 UTC, with an independent 90-second reconnection
timer and a separate rollback safeguard. It used the installed portal and valid DNS-SD queries;
no application code was patched. Across 61 identity samples, the boot ID and backend PID `93841`
were unchanged, `NRestarts` stayed zero and the service remained active/running. The journal recorded
82 `mDNS response send failed` warnings containing `ENETUNREACH`, with zero backend exit/restart
evidence. All 55 local API state samples succeeded, including while LAN access was unavailable.

The real hotspot and DNS redirect were observed at 14:04:47. Ethernet returned at 14:05:46;
the hotspot/DNS redirect were gone and the configured marker existed by 14:05:51, the portal had
stopped by 14:05:53, and the API reported `online` at 14:06:18. Backend identity remained stable
for another 15 seconds. The open admin cleared both its connection warning and Setup Mode notice
at 14:06:34 without manual reload. No rollback was required; test credentials were removed and
the remaining rollback timer was stopped after success.

This passes the released mDNS publisher response-send error and logical Ethernet/portal recovery
case for #1223. It does not exercise Home Assistant/WLED discovery on hardware, unrelated socket
errors, physical cable removal, or authenticated Tailscale traffic. Those distinctions and the
remaining R4 checklist below are unchanged; this result does not close R4 or the epic.

#### Authenticated alpha.49 tailnet recovery and client checks (2026-10-06)

On the same spare Pi 4, Debian 12 arm64, application `1.1.0-alpha.49` (tag `5168e08af`)
and Tailscale `1.102.5`, interactive approval completed and the wizard advanced to Options only
after Connected. Default Serve HTTPS was primary; copying the endpoint matched the expected URL,
and decoding the rendered QR image returned that same HTTPS URL. Funnel and Tailscale SSH stayed off.

A separate controlled 90-second Ethernet outage exercised the authenticated provider, with independent
reconnection and rollback timers. At 16:05:28 UTC, CLI online was false, the plugin reported Connecting
and aggregate external URLs were empty. Certificate-verified HTTPS from the original Pi 5 failed
during the outage and first succeeded again at 16:06:55. The open admin returned to Connected at
16:06:57 without reload; CLI online was observed again at 16:07:03. Four consecutive stable recovery
samples completed at 16:07:18. Across 24 state samples, the boot ID, backend and tailscaled PIDs
were unchanged and both restart counters stayed zero. Node identity, addresses, preferences, Serve
configuration and the configured marker were retained. Two mDNS response-send warnings caused no
backend exit. The peer observer recorded 39 probes, including 11 outage failures and successful TLS
before and after recovery. No rollback was needed; all test units and safeguard timers are inactive.
This was a logical NetworkManager disconnect, not physical cable removal.

The user confirmed certificate-error-free admin loading and successful login from the phone with
Wi-Fi disabled and Tailscale enabled on this alpha.49 host. Fresh-host phone live changes and phone
WebSocket frames were not checked. Separately, a Pi 5 HTTPS request saw display registration closed,
and a deliberately invalid login produced an authentication notification with that peer's Tailscale
address, not loopback. Five invalid attempts were accepted for processing; the sixth returned 429
with `Retry-After: 60`. Another request with a spoofed forwarded address also returned 429. While
that peer remained limited, owner login from the Mac over LAN succeeded (201). This verifies the
observed peer/LAN separation; it does not claim a second tailnet client or phone-specific log capture.

An authenticated WebSocket-only probe from the Pi 5 also passed with certificate verification enabled:
the HTTPS login, RFC6455 upgrade, Socket.IO authentication and exchange subscription succeeded.
The connection stayed open for 20 seconds and received eight normal event payloads (four system
information and four statistics updates), without polling fallback or reconnect. This is peer transport
evidence, separate from the user-confirmed phone login and earlier phone device-update tests.

Private evidence is retained outside Git in the `pi4-alpha49-tailscale` acceptance directory:
`outage-final.private.json`, `peer-outage-observations.jsonl`, `outage-ui.json`,
`acceptance-progress.json`, `client-address-evidence.private.json`, `peer-throttle-evidence.json`
and `throttle-isolation-evidence.json`, plus `wss-evidence.json` for the authenticated transport probe.
R4 and the epic remain open for the unchecked gates below.

#### Alpha.49 Tailscale SSH peer verification (2026-10-06)

On the same Pi 4 alpha.49 / Tailscale 1.102.5, the Tailscale SSH switch was enabled and saved
through Config → Plugins → Tailscale. CLI preferences confirmed `RunSSH=true`. The Pi 5 peer's
`tailscale ssh smartpanel@<node> id -un` required the tailnet's additional authentication check;
earlier attempts timed out while waiting and were not counted as successful logins. After the check
completed, the command exited zero at 20:25:21 UTC and returned `smartpanel`.

The correct shell account on this image is `smartpanel` (`/bin/bash`). The application's service
account `smart-panel` has `/usr/sbin/nologin` and must not be used as the shell-login example.
Saving the SSH switch off restored `RunSSH=false` by 20:26:31; Tailscale stayed Running/online,
Serve configuration was unchanged and the peer HTTPS request returned 200 with certificate
verification enabled. The subsequent `tailscale ssh` probe failed strict host-key verification and
ran no remote command. That failure alone does not establish a closed TCP port or disabled OpenSSH;
the CLI preference verifies that the Tailscale SSH feature is off. LAN SSH remained available.

Evidence is retained privately in `pi4-alpha49-options`: `ssh-success-evidence.json`,
`ssh-success-state.json`, `ssh-final-state.json`, `ssh-off-final.private.json` and `https-final.json`.
This verifies the Pi 5 peer path; the checklist's phone/laptop SSH path remains untested.

#### Alpha.49 Funnel public/private acceptance (2026-10-06)

On the same Pi 4 alpha.49 / Tailscale 1.102.5, requesting Funnel before the tailnet permitted it
produced `funnel-not-allowed` in the API and admin advisories. The provider stayed Connected,
endpoints stayed private and Serve configuration was unchanged. Turning the request off cleared
the advisory. After the administrator enabled the `funnel` node attribute, the CLI reported the
capability and the real Config → Plugins → Tailscale switch successfully enabled Funnel.

The config form warned about public exposure before Save. At 21:49:39 UTC the API reported a public
HTTPS endpoint and `public-exposure`; the overview showed the primary URL as Public and both module
and provider exposure advisories. Only the managed HTTPS port 443 appeared in `AllowFunnel`.
The Mac's Tailscale client was Stopped/offline throughout the external probes. Initial requests to
some public relay addresses failed during TLS establishment; subsequent normal-DNS curl and browser
requests loaded the admin login page. By 21:51:47 all three public DNS relay addresses returned 200
with certificate verification enabled. A public HTTPS owner login and direct authenticated WebSocket
subscription also passed: eight normal system/statistics event payloads over 20 seconds, without
polling fallback or reconnect. Public display-registration status remained closed.

Saving Funnel off restored private endpoints and cleared advisories by 21:52:14. All three previously
working public relay addresses failed TLS establishment in the post-disable probes, while the Pi 5
tailnet HTTPS request still returned 200 with certificate verification enabled. A separate private
Serve handler on port 8443, added for this test, retained identical TCP/Web configuration across both
transitions and stayed reachable from the peer. Removing that temporary handler restored the entire
Serve configuration exactly to its pre-test value. The final overview was Connected/healthy with no
advisories. Funnel and Tailscale SSH are off; the administrator's tailnet permission remains enabled.

Private evidence is in `pi4-alpha49-funnel`: the blocked/allowed API and UI captures, `public-on.json`,
`public-probe-on-final.json`, `public-wss-diagnostic.json`, `public-probe-off.json`, `private-after.json`,
the extra-handler probes, `serve-restored.json` and `progress.json`. This completes the Funnel row,
not the remaining R4 gates.

#### Docker runtime regression and local candidate (2026-10-07)

The published alpha.49 ARM64 image (`sha256:b0d4c7ce376e06cd64d20c87cd40d4510bb1a60ea70d5afd90adf01112fa87bb`)
failed before backend startup: the migration command could not resolve `/app/node_modules/typeorm/cli.js`.
Flattening the pnpm workspace broke dependency links, and the runtime omitted the built extension SDK.
The image also omitted `PLATFORM_TYPE=docker`; after correcting packaging, the Alpine healthcheck
failed because `localhost` selected IPv6 while the backend listened on IPv4.

The local ARM64 candidate, based on `41b60253c`, preserves the workspace dependency layout and SDK,
sets the Docker platform in the image and Compose, and probes `127.0.0.1` for container health.
The release workflow now runs the normal migration/start command against fresh storage and requires
container health, the expected API version, fresh onboarding, admin HTML and a real JavaScript asset
before publishing the multi-platform manifest. The old package-version-only check could not detect
the startup failure.

An isolated Compose deployment on the Mac passed startup, first-owner registration and onboarding.
Tailscale reported `unsupported`, with privileged setup unavailable; an actual install request returned
HTTP 422 / `platform-unsupported` without starting a setup job. The manual URL
`HTTP://LOCALHOST:51124/` normalized to `http://localhost:51124`, appeared as the primary external URL,
survived container recreation with the same data volume and opened the admin sign-in page. The UI
showed the expected HTTP/public-exposure advisories. This was a loopback-only acceptance fixture,
not a public internet or TLS test; both Raspberry Pis were unchanged.

Direct navigation also exposed a missing documentation button: extension metadata had not been loaded.
The card now falls back to the platform requirement's validated HTTP(S) documentation URL without an
extra metadata request. Focused card tests cover that fallback, preferred metadata and invalid URLs.
The final built admin passed browser login, direct navigation to the unsupported card, the Docs
button target, saving the normalized manual URL through the configuration form and opening its
sign-in page. All 32 card tests and the admin TypeScript check passed.

Private build, startup, smoke and API evidence is in `remote-access-r4/docker-alpha49`.
This is local candidate evidence, not a pass for the published alpha.49 image. At this point the Docker
checklist remained open for a new release; dispatching the old release tag would rebuild its old source.
The subsequent alpha.50 release verification is recorded below. Home Assistant remains unverified.

#### Published alpha.50 Docker acceptance (2026-10-07)

Release `v1.1.0-alpha.50`, commit `afbe3649cb531975584939f9aba4009a16b09bd7`, contains #1229.
[Release run 37582397688](https://github.com/FastyBird/smart-panel/actions/runs/37582397688)
successfully built and published both Docker architectures. The normal-runtime smoke passed on the
native ARM64 runner at 07:00:19 UTC and AMD64 runner at 07:00:28 UTC, checking migrations, Docker
health, API version, fresh onboarding and a real admin JavaScript asset before manifest publication.

Published platform digests:

- ARM64: `sha256:f592c4f7710396ec89f95c7a25253cee39ba388651bba4d94acb44f94551918f`.
- AMD64: `sha256:00cd7d460b291af5ea7742410792b523c84a784b84a5d03904d862bf9a48c0c2`.

The Mac independently pulled the exact ARM64 digest and passed the runtime smoke, then ran an isolated
Compose deployment with fresh storage and loopback-only port 51126. First-owner registration, login
and onboarding succeeded. Direct admin navigation displayed Tailscale as Unsupported and the Docs
button targeted the platform documentation URL without previously loading Extensions. API status
agreed, with privileged setup unavailable; an install request returned HTTP 422 / `platform-unsupported`.

The configuration form saved `http://localhost:51126` as the manual external URL. It appeared as Primary
with HTTP/Public indicators and the expected `external-url-insecure` / `public-exposure` advisories;
opening the URL loaded the sign-in page. After forced container recreation with the same data volume,
Docker became healthy, the authenticated API still returned the same primary URL and unsupported
provider, and the UI agreed (07:11:06 UTC). This closes the Docker Compose checklist row.

Private evidence is in `remote-access-r4/docker-alpha50`: manifest/digests, both native CI job logs,
local smoke/Compose logs and `acceptance.json`. The temporary deployment and its volume were removed.
This is Docker runtime/manual-URL acceptance, not public internet/TLS, Home Assistant or Raspberry Pi
image acceptance. The Raspberry Pi image jobs were still running when these Docker results were
recorded; both existing Pi installations were unchanged. The remaining R4 gates and epic stay open.

#### Clean host installer: setup sandbox regression (2026-10-07)

The spare Pi 4 was reimaged with official Raspberry Pi OS Lite Legacy 64-bit Bookworm
(`2026-10-06` image), retaining neither Smart Panel nor Tailscale. The published alpha.49
`install-server.sh --version 1.1.0-alpha.49 --port 3000` completed successfully, installing
Node 24.21.0, npm 11.19.0 and the matching wrapper/backend/admin packages. The unprivileged
backend ran with `ProtectSystem=strict`; sudoers validation and the service-user scope probe passed.
Owner registration, login and onboarding succeeded. Remote access correctly reported Not installed.

Real **Start setup** at 08:33:58 UTC failed within a second: the scope worker inherited the backend's
read-only mount namespace and `tee` could not write `/usr/share/keyrings/tailscale-archive-keyring.gpg`.
The wizard and `RemoteAccessModule.Setup.Progress` event both exposed the failure. A successful
sudo probe alone therefore did not establish that package installation worked inside the service.

The candidate selects `unitType: 'service'`, using the existing privileged-worker service lifecycle
without weakening backend hardening. An equivalent one-line change was applied temporarily to the
installed compiled service. A second UI setup ran from 08:36:02 to 08:36:53 UTC, installed Tailscale
1.102.5 from its signed apt repository and advanced to Sign in. The installation message arrived live;
a full-page reload during apt installation restored the running wizard. The final API reported all
five prerequisites satisfied; independent checks confirmed active/enabled `tailscaled` and NeedsLogin
under the backend service user. The short daemon/operator intermediate steps were not captured
individually. No tailnet login or external-access acceptance is claimed for this clean host.

The original alpha.49 compiled file was restored and the backend restarted before the separate
in-app npm updater test. This setup result is **candidate evidence**, not a pass for a published
release. Repeat fresh-package UI setup after the fix ships; the npm/apt and host-installer checklist
rows remain open. Evidence is retained privately in `remote-access-r4/host-install-acceptance`.

The independent **System → Install Update** test then upgraded the restored alpha.49 runtime to the
published alpha.50 through `smart-panel-update.service` (08:39:47–08:42:57 UTC). The worker stopped
the backend, installed the npm package and restarted the service. The UI displayed successful
completion and alpha.50; health and all three installed package versions agreed. The existing owner
ID/role, authenticated session and full Tailscale plugin configuration were preserved. All five
Tailscale prerequisites remained satisfied, with no tailnet login. Host npm updater acceptance passed;
the combined checklist row remains open solely for released fresh-package setup verification.

#### Published alpha.51 host setup acceptance (2026-10-07)

[Alpha release 37606933658](https://github.com/FastyBird/smart-panel/actions/runs/37606933658)
published the alpha.51 npm packages from version-sync commit `1a291cfe04f4b937e87e3b04eb8db8fc94401cfb` containing #1231.
The backend and main package tarballs matched their registry SHA-512 integrity values; the published
backend contained `unitType: 'service'` and the main package retained both CLI entry points.

On the same clean-OS installer Pi 4, Tailscale was confirmed signed out before disabling the plugin
and purging its package. The test also removed the vendor apt source and keyring, retaining private
backups. This recreated package installation prerequisites; it was not another OS reimage. The actual
System UI then upgraded alpha.50 to the published alpha.51 npm packages (10:36:37–10:39:57 UTC).
Health and wrapper/backend/admin package versions agreed; the UI reported successful completion and
the existing owner/session remained usable. The installed setup implementation matched the fix.

After re-enabling the plugin, Remote access showed **Not installed**. **Start setup** launched
`smart-panel-remote-access.service` at 10:40:47 UTC. A read-only status-file sampler captured:

- `install`: 10:40:47.301 UTC;
- `daemon`: 10:41:18.669 UTC;
- `operator`: 10:41:19.078 UTC;
- `complete`: 10:41:19.119 UTC.

The admin received live installation events, restored the running wizard after a full-page reload
and advanced to Sign in on the completion event at 10:41:20 UTC. The brief daemon/operator stages
were captured in the status file, not as separate rendered UI frames. API status reported all five
prerequisites satisfied. Independent host checks confirmed Tailscale 1.102.5, enabled/active
`tailscaled`, service-user access and NeedsLogin. Backend `ProtectSystem=strict`, `ProtectHome`,
`PrivateTmp` and `ProtectControlGroups` remained enabled. No deployed source patch was used.

This completes functional fresh-package npm/apt setup and the host-installer/npm updater. The
original every-step live-reporting requirement is split out below and remains unchecked: status-file
evidence does not establish individual UI visibility. This does not establish tailnet login, expiry
warnings, HTTPS fallback or remote reachability for this reset
host. The rest of R4 remains open. Private evidence, including registry receipts, host checks,
status samples, WebSocket events and UI recording, is in
`remote-access-r4/host-install-acceptance/alpha51`. The GitHub release was published at 10:42:17 UTC;
Docker and Raspberry Pi image jobs were still pending when this npm acceptance completed.

#### Natural node-key expiry and reauthentication (2026-10-08)

The clean-OS installer Pi 4 remained on published alpha.51 with Tailscale 1.102.5. On October 7,
the operator temporarily selected a one-day node-key lifetime, approved this node and restored the
tailnet default to 180 days. The API/UI displayed `key-expiring` with the expected expiry. The node
was then left to expire naturally at 2026-10-08 11:25:29 UTC; no logout, reset or forced expiry was
used to produce the expired state.

At 12:12 UTC, CLI `BackendState` was `NeedsLogin` with the original expiry in the past. Although
the cached Self object still reported Online, the provider correctly reported `setup-required`,
authentication required and the available login action. The card said it needed to sign in again.
Provider endpoints/proxy addresses and aggregate external/primary URLs were empty. HTTPS and both
IPv4/MagicDNS HTTP probes from another tailnet peer timed out; LAN access remained available.

The real wizard offered a new interactive login link and QR code, with `pending-auth` and
`Cache-Control: no-store`. The operator confirmed approval on a computer; phone approval remains
unverified. After approval, the open wizard advanced to Options
without a page reload. Skipping unchanged options reached Done, while the card became Connected
and the HTTPS primary URL returned. CLI confirmed Running/online and a new expiry of
2027-04-06 12:17:49 UTC. No application restart, manual CLI repair or configuration change was
required for recovery; the provider epoch and completed setup job remained unchanged.

From the Pi 5 tailnet peer, system DNS and default certificate validation passed HTTPS admin HTML,
alpha.51 health, owner login/profile and an authenticated WebSocket-only exchange subscription.
Missing/invalid WebSocket tokens were rejected by application authentication, and anonymous profile
access returned HTTP 401. Separate HTTPS and IPv4/MagicDNS HTTP checks returned admin HTML and
closed display registration. These peer probes do not establish phone-specific traffic or transport.

After closing the test admin tab and finishing the peer probes, a 623.8-second idle observation
(12:25:50–12:36:14 UTC) passed. Backend and tailscaled identities/restart counters stayed unchanged,
with one process per service at both boundaries and no retained management subprocesses. The Serve
configuration fingerprint stayed unchanged, with one HTTPS listener/handler and Funnel disabled.
Both boundaries reported Running/online with no auth URL and successful service-user status access.
The readable, retained journal cursor covered 33 entries with no matches for management permission
failures, Serve changes/errors, service lifecycle changes or fatal errors. This is a bounded idle
observation: boundary snapshots and journal patterns do not prove absence of every intermediate or
unlogged transition, and read permission alone is not a management-mutation permission test.

Private receipts are retained under `remote-access-r4/host-install-acceptance/node-expiry-2026-10-08/`.
The first peer-auth harness assumed exactly HTTP 200 for login and stopped with an assertion;
the corrected run accepts successful 2xx login responses. The first idle preflight incorrectly
required the backend working directory to be inside its npm package. The real working directory is
the application data directory; the corrected guard checks the running entrypoint against the
version-verified npm package instead. Failed receipts remain retained separately. Neither finding
required an application change. The short-expiry/reauthentication checklist row is complete; R4 and
the epic retain their other unperformed gates.

#### Alpha.53 connected host upgrade and retained setup results (2026-10-08)

The installer Pi 4 upgraded from published alpha.51 to alpha.53 through one normal System UI
confirmation while Tailscale was authenticated and connected. A private consistent SQLite/config
backup preceded the update. The independent update service remained running while the application
was stopped, completed at 13:57:49 UTC and released its lock. The existing admin session displayed
successful completion and the new version without manual reload.

Wrapper, backend and admin packages matched the official npm alpha.53 tarballs after SHA-512 SRI
verification: all 42 wrapper files, 5,207 backend dist files and 250 admin dist files matched, with no
extra files in the compared trees. Database integrity, schema/migrations, empty device topology,
accounts/long-lived tokens and saved configuration matched the pre-upgrade snapshot. The host did not
reboot; the application process changed. Tailscale retained its node identity and authentication.
Certificate-verified peer HTTPS, owner login/profile, authenticated WebSocket exchange subscription
and missing/invalid credential rejection passed again.

To exercise published #1233 through the actual wizard, the test briefly stopped only `tailscaled`
over LAN, without logout, package removal or configuration edits. An independent five-minute recovery
timer was armed first. The card correctly showed the inactive-daemon requirement and **Set up**.
**Start setup** used the existing package, restarted the daemon and reapplied the operator grant.
The same wizard advanced automatically to Options and, after Skip, Done. All three rendered rows
(`install`, `daemon`, `operator`) remained visible as Complete in both later steps. DOM observations
captured Waiting followed by Complete; they did not capture each short intermediate Running state.
This establishes retained per-step outcomes, not newly downloaded package installation or separate
rendering of every transient stage. The existing stricter live-stage observation row remains open.

The setup job completed at 13:59:40 UTC. Backend identity, configuration, schema, accounts and
Tailscale node identity/authentication were preserved; peer HTTPS/login/WebSocket passed after setup.
The recovery timer was cancelled and confirmed inactive before its deadline. Private evidence is in
`remote-access-r4/host-install-acceptance/alpha53/`, including npm manifests, before/after inventories,
UI/API stage observations and peer checks.

The acceptance review also confirmed that the HTTPS-disabled advisory's console URL was still plain
text in alpha.53. The accompanying admin change makes the official Tailscale DNS URL clickable for
that advisory, preserving its message and leaving other messages as escaped text. A mounted component
regression failed before the change and passed afterward. This source correction is not installed on
the Pi; the previously recorded disabled-HTTPS functional cycle does not establish its released UI
acceptance. R4 remains open.

#### Alpha.53 manual preference adoption regression (2026-10-08)

The installer Pi 4 (`10.10.0.49`, published alpha.53, Tailscale 1.102.5) reproduced an adoption
failure using an existing authenticated node. After normal UI Disconnect, the test set the unmanaged
`--snat-subnet-routes=false` preference with no advertised subnet routes and ran flagless `tailscale up`.
The CLI returned Running with the same node/user identity. Normal UI Connect then failed at
20:30:07 UTC: the plugin's flagged `up` omitted that non-default preference. The card showed Error
and the aggregate withdrew external URLs. Tailscale retained both authentication and the preference;
there was no logout or automatic reset. This is a failed adoption scenario, not a passed R4 row.

The source fix reads fresh preferences after applying only the managed `set` flags. If the configured
login server and advertised tags already match, it reconnects with flagless `up`, preserving unmanaged
preferences. Changed or unverifiable up-only preferences retain the existing single flagged attempt
and conflict refusal; the code does not reset preferences or retry a refused mutation. Regression
coverage includes stopped/running authenticated nodes, malformed/unavailable preferences, changed
tags/server and Disconnect superseding the preference read. All 432 Tailscale tests in 14 suites passed.

A separate real-CLI check ran the equivalent sequence as the unprivileged `smart-panel` operator
on both Stopped and Running nodes. It preserved the unmanaged preference and authentication in both
cases. This validates CLI compatibility, **not deployment of the application fix**. After restoring
the original preference, normal UI Connect recovered; peer certificate-verified HTTPS, owner login,
authenticated WebSocket subscription and missing/invalid credential rejection passed at 20:36:06 UTC.
The host/backend identity, database/schema, accounts, configuration and Tailscale identity were
unchanged across the initial failure/recovery. Recovery timers were stopped; no reset/logout occurred.

The same run found a separate layout defect at 1280×800: the non-shrinking address card consumed the
available height and collapsed the provider scrollbar to zero, making Disconnect unreachable. The
admin fix places status, addresses and naturally sized tabs in one scrolling region. Local candidate
browser verification against the actual Pi API passed at 1280×800, 1440×1200 and 390×844: expanded
QR content, provider dropdown, Disconnect hit testing and the advisories tab remained reachable.
All 14 focused admin component tests, backend/admin type checks, changed-source lint/format checks
and independent review passed. The source fixes remain unshipped and R4 remains open.
Private receipts are in `remote-access-r4/host-install-acceptance/manual-adoption-alpha53/`.

#### Alpha.53 unavailable helper and manual preparation (2026-10-08)

The installer Pi 4 on published alpha.53/Tailscale 1.102.5 passed the backend/manual-remedy portion
of the unavailable-helper scenario and exposed a wizard progression defect. A root-only checkpoint
and ten-minute recovery timer preceded removal of only the service user's `systemd-run` sudoers
grant and Tailscale operator grant. The backend was restarted once to perform a fresh capability
probe; the node retained its existing authentication. LAN access remained available.

At 21:23:44 UTC, the API reported `setup-required`, authenticated, an unsatisfied operator requirement,
no endpoints and `privileged_setup.available=false` with the actual sudo refusal. An explicit install
request returned **422 / privileged-worker-unavailable**, with no setup job. The normal Set up wizard
showed the failure reason, `sudo tailscale set --operator=smart-panel`, Copy and Re-check; it did not
offer Start setup. Applying that displayed command restored all requirements and Connected with three
endpoints while the privileged-worker grant was still absent. No new login or installation was needed.

The wizard nevertheless stayed at Set up after Re-check even though its requirements and the card
had updated successfully. Its completion watcher depended on a completed automatic setup job, which
does not exist for manual preparation. The accompanying admin fix advances a successful manual
recheck using fresh requirements/authentication, while preserving failed, incomplete, active-job and
closed-session guards. Both core progression tests failed before the change; all 93 wizard
component/integration tests, admin type checking, targeted lint/format checks and independent review
passed afterward. The hardware observation is a reproduction on alpha.53, not released acceptance
of that source fix.

The exact sudoers file and operator grant were restored. The helper probe recovered to available by
21:25:40 UTC without another backend restart. Peer certificate-verified HTTPS, owner login/profile,
authenticated WebSocket subscription and missing/invalid credential rejection passed at 21:25:06 UTC.
The recovery timer and setup worker were inactive. Database/schema, configuration, accounts, node
identity and host boot identity matched the baseline; only the planned initial backend restart occurred.
Private receipts are in `remote-access-r4/host-install-acceptance/manual-setup-alpha53/`.

#### Alpha.54 released host regressions (2026-10-09)

Published `v1.1.0-alpha.54`, tag commit `0d6ef96ae256ee9598bc1984952680f2f11fbb66`, contains
#1373 (HTTPS advisory link), #1374 (manual preference adoption and layout) and #1375 (manual wizard
Re-check). [Release run 37853264112](https://github.com/FastyBird/smart-panel/actions/runs/37853264112)
had published server/npm/platform bundles while image and Docker jobs were still building at this
acceptance checkpoint. The date follows Europe/Prague; execution began late on October 8 UTC.

One normal System UI update upgraded the connected installer Pi 4 from alpha.53 to alpha.54.
The original admin session observed automatic completion without a reload. Registry SHA-512 SRI
checks passed, and installed artifacts matched every file in the verified wrapper/backend/admin
packages (**42 / 5,207 / 249 files**). Before/after comparison passed for database/schema, accounts,
configuration and Tailscale identity/authentication. Peer HTTPS used normal certificate validation;
owner login/profile, anonymous **401**, valid WebSocket subscription and missing/invalid credential
rejection all passed.

The actual released Connect UI passed manual adoption from both already Running and Stopped
authenticated states, retaining the unmanaged `--snat-subnet-routes=false` preference (`NoSNAT=true`),
no advertised routes and node/user identity. The saved preference was restored to `NoSNAT=false`,
final peer authentication checks passed and the bounded recovery timer was inactive. Released layout
verification passed at **actual 1280×800**: expanded QR content, provider dropdown, Disconnect hit
testing and the advisories tab were reachable. Requested 1440×1200 and 390×844 resizes left the browser
at 1280×800; those dimensions remain local candidate evidence from the earlier run.

The unavailable-helper fixture accurately reported the missing operator and returned
**422 / privileged-worker-unavailable** on an explicit JSON `{}` installation request without a setup
job. Applying the wizard's displayed operator command restored requirements while the helper remained
unavailable. Actual Re-check advanced **Set up → Options**, then Skip reached **Done / Connected**,
without a setup job or reauthentication. Exact sudoers/operator restoration, recovered helper availability,
final peer authentication and inactive recovery timer/setup worker checks passed. The backend retained
its PID after the fixture's initial restart. Final database/schema, configuration, accounts, topology,
Tailscale identity and host boot identity comparisons passed.

The HTTPS advisory link is present in the verified released admin and covered by the source component
regression. This run did not repeat the tailnet HTTPS-disabled/restored cycle or prove released link
navigation. Private receipts are in
`remote-access-r4/host-install-acceptance/next-release-2026-10-09/`, including npm/runtime verification,
upgrade comparison/UI, peer authentication and the two bounded regression scenarios. Historical
release results retain their original scope. These named passes do not establish a complete alpha.54
matrix or close R4, R5 or the epic.

#### Alpha.54 Cloudflare connected-provider upgrade (2026-10-09)

Staging Pi 5 upgraded alpha.53 → alpha.54 through one normal System UI action over the public
Cloudflare HTTPS hostname. Candidate tag `0d6ef96ae256ee9598bc1984952680f2f11fbb66` and release run
`37853264112` were verified; all 19 release jobs passed. The ARM64 server checksum, backend/admin npm
SHA-512 integrity, server/npm content agreement and installed **1,719 backend JavaScript / 249 admin
files** passed. Bundled throttler remained 6.7.1.

The updater completed durably, cleared its lock and recovered both providers without a host reboot.
All **111 devices**, property topology, **28 migrations**, schema, configuration, accounts and
long-lived tokens were preserved. The pre-upgrade API session and a fresh login worked afterward.
The original public browser tab displayed success without reloading. Cloudflare returned automatically
with four ready connections, its endpoint/proxy contributions and desired Started state. Boundary
samples found one unprivileged backend-owned cloudflared child before and after, with new backend/child
identities and no `--token` argument. A Pi-side equality check confirmed the stored token and nonsecret
settings matched the fresh backup; the earlier revoked-token checkpoint was not used.

Post-upgrade public checks used normal DNS/certificate validation and passed admin HTML, owner profile,
anonymous protected-route **401**, valid WebSocket authentication and explicit rejection of missing or
invalid WebSocket tokens. These are protocol checks, not a new cellular/manual-device-change test.

After closing the completion dialog, the old admin page failed to navigate to Remote access because
it requested a removed CSS chunk. Explicit full navigation fetched the alpha.54 bundle, retained the
session and showed Connected. This frontend regression is separate from successful tunnel recovery;
the accompanying source fix reloads the admin on dismissal of the completed update dialog. All four
dismissal paths are covered by component regressions, with negative cancellation/failure/in-progress
cases. It is not yet deployed: the hardware retest must start from a release that already contains
the fix, so upgrading from alpha.54 alone cannot verify the corrected dismissal behavior.

The initial default-Python-User-Agent health observer received 403 before the update and is retained
as an unsuitable probe. The corrected observer used the same explicit User-Agent as the passing
preflight, captured 530/502 during restart and three healthy target-version samples afterward. No exact
outage duration or continuous child-count claim is made. Private evidence is retained under
`remote-access-r5/staging-alpha54-upgrade/`. R5 remains open for remaining installation cases and the
released frontend fix; R4 and the epic are also unchanged.

#### Alpha.55 deployment on staging Pi 5 (2026-10-09)

One normal System UI update over public Cloudflare HTTPS upgraded alpha.54 → alpha.55, tag
`e0a72186d6872000ada24b2449091248a680c474`. All ten server release jobs in run `37899751087`
succeeded. Server/npm integrity and the installed 1,719 backend JavaScript / 249 admin file hashes
matched. The bundled admin contains #1377's completed-dialog reload guard.

The fresh pre-install backup passed validation. The updater completed with its lock cleared, no host
reboot, and preserved 111 devices/topology, 28 migrations/schema, accounts, long-lived tokens,
configuration and the current Cloudflare token. Cloudflare recovered automatically with four ready
connections and one unprivileged backend-owned child in the post-update sample. Public HTTPS,
owner login/profile, anonymous 401 and valid/missing/invalid WebSocket authentication passed.

The old alpha.54 tab displayed success; manual full navigation loaded the new bundle and retained
authentication with both providers Connected. Automatic dismissal reload remains untested on hardware:
the next upgrade must start from the fixed alpha.55 admin. No new phone/live-device-change result or
continuous connector-count guarantee is claimed. Pi 4 was untouched.

At this checkpoint Docker publication passed, server/display SD builds were pending, and AIO image
building failed on GitHub API rate limiting in `flutterpi_tool`. Overall release success is not claimed;
the independently verified server package was used. Private evidence:
`remote-access-r5/staging-alpha55-upgrade/`. R5 remains open for npm/manual installation and the
released reload regression; R4 and the epic remain open.

#### Cloudflare npm-host/manual installation on Pi 4 (2026-10-09)

Published alpha.54 on the existing installer/npm Pi 4 started with no cloudflared, apt source/key,
token or setup job. After a database/configuration backup and temporary plugin enablement, the
displayed manual commands installed cloudflared 2026.10.0. The UI duplicated those four commands and
offered no Re-check; after installation its binary/version checks refreshed but the wizard stayed on
Install without exposing the token form. This manual test preceded any privileged setup job.

Removing only the newly installed package (no autoremove; source/key retained) allowed an independent
automatic Start setup test. Job `0f6bef18-1640-4a49-869e-41896997adb0` completed and the package/version
requirements passed, but the wizard again stayed on Install because it also required the token from
the next step. Closing and reopening via Configure exposed the form; nothing was saved there.

Both package-installation paths passed; the complete wizard flow failed and remains pending a
released retest of the accompanying readiness/Re-check/command-deduplication fix. Component and
store integration regressions cover the correction; source tests are not hardware acceptance.

Cloudflare returned to disabled, token absent and no endpoints, retaining the installed package and
signed apt source/key. Tailscale identity/runtime state, backend PID, boot, accounts and 28 migrations
were unchanged. The entire parsed configuration matched its backup (YAML serialization changed).
No helper/sudoers change, backend restart or Pi 5 contact occurred. This run does not cover an actual
unavailable-helper presentation, a configured Pi 4 tunnel or external reachability. Evidence:
`remote-access-r5/pi4-cloudflare-install/`. R4/R5 and the epic remain open.

#### Cloudflare released wizard regression on Pi 4 (2026-10-09)

The npm-host Pi 4 upgraded alpha.54 → alpha.56 through one normal System update action after a
fresh backup. The release tag `0803ced792f2809c4c05d6d84a55c0ae1d26598f` includes #1379.
Published npm integrity and installed hashes matched 42 wrapper, 5,207 backend-dist and 249 admin
files. Upgrade completion, exited update worker, database/configuration/account preservation and
the same authenticated Tailscale identity were verified.

With a fresh browser and no setup job after the upgrade, the manual test removed only the inactive
cloudflared package, retained its apt source/key, and ran the four unique commands displayed by
Run it yourself. Re-check advanced to Token and hostname with the token absent and `setup: null`;
no privileged installation job was submitted. After a second package-only removal, one Start setup
created job `72dcad40-eed6-45d0-aabf-d0e10c4a213f`. Its running state and successful completion
were observed, followed by an automatic transition to the token form without Re-check or reopening.

Both installation-to-configuration regressions pass on the released build. Neither form was saved
and no token was entered, so this does not claim a configured Pi 4 tunnel, the Done step or external
Cloudflare access. The plugin returned to disabled/no token/no endpoints, with cloudflared 2026.10.0
installed. Final configuration bytes, accounts, topology and 28 migrations matched the baseline;
Tailscale remained authenticated and the backend PID stayed stable throughout the installation tests.
Pi 5 and sudoers/helpers were untouched. Evidence: `remote-access-r5/pi4-cloudflare-alpha56/`.
Actual unavailable-helper UI and an upgrade beginning from the released reload fix remain pending.
R4/R5 and the epic stay open. Server/display SD images passed; the AIO image was still building.

#### Cloudflare unavailable-helper/manual recovery on Pi 4 (2026-10-09)

Alpha.56 passed the actual unavailable-helper case on the npm-host Pi 4. After a fresh backup and
arming a ten-minute restore timer, only the `systemd-run` sudoers grant was temporarily removed.
One planned backend restart cleared its positive capability cache. Tailscale settings were unchanged.
Removing only the inactive cloudflared package produced missing binary/version requirements and
`privileged_setup.available: false`. A direct install request returned HTTP 422 with
`privileged-worker-unavailable` and remediation, creating no job.

The real wizard offered four unique manual commands and Re-check, with no Start setup button.
Manual installation restored cloudflared 2026.10.0; Re-check reached Token and hostname while the
helper was still unavailable and `setup: null`. No token was entered or form saved. Restoring the
exact sudoers bytes made helper availability recover without another backend restart.

The recovery timer and setup worker were inactive at cleanup. Cloudflare returned to disabled/no
token/no endpoints with the package installed. Configuration bytes, accounts, topology, 28 migrations,
Tailscale identity and all Tailscale preferences matched the baseline; Pi 5 was untouched. Evidence:
`remote-access-r5/pi4-cloudflare-helper-alpha56/`. The released unavailable-helper/manual-recovery
case is complete; the upgrade-reload regression from an already-fixed admin remains pending.
This does not add a configured Pi 4 tunnel or external-access result. R4/R5 and the epic remain open.
The complete alpha.56 release, including AIO, has now passed.

#### Alpha.55 → alpha.56 upgrade and automatic admin reload on Pi 5 (2026-10-09)

The image-installed staging Pi 5 passed one normal System UI update after a fresh database/configuration
backup. Published alpha.56's complete release workflow passed; 1,719 installed backend JavaScript
files and 249 admin static files matched the verified server archive.

The alpha.55 document remained open until the update dialog reported success. Clicking only Close
then produced a new document with navigation type `reload` and alpha.56's entry script, preserving
the authenticated session. No manual reload or navigation occurred between completion and this
capture. Loaded scripts/styles matched the target artifact. Subsequent navigation showed both
providers Connected and the Devices table with 111 entries, without resource HTTP failures or
unloaded styles. The released completed-dialog reload regression is now **passed**.

All 111 devices, property topology, schema, 28 migrations, accounts, configuration and the current
Cloudflare token were preserved. Tailscale retained its authenticated identity. Cloudflare returned
automatically with four ready connections after the update interruption. Public natural-DNS HTTPS
checks passed certificate validation, admin loading, owner authentication and Socket.IO connection;
anonymous API access returned 401 and missing/invalid socket credentials were rejected. This is
automated Mac evidence, not a new phone/mobile-data or live device-change confirmation.

The update worker completed, its lock cleared and the owned browser/SSH tunnel were closed. Pi 4
was untouched. Evidence: `remote-access-r5/staging-alpha56-upgrade/`. This closes the reload item
left pending above; R4/R5 and the epic remain open pending remaining-matrix reconciliation.

#### Home Assistant platform contract in isolated Docker (2026-10-09)

Published alpha.56's Linux ARM64 image was pinned to digest
`sha256:8fb26a49948b33103c977ca3113f4a67ffa47709e6c6aa316a7e3123d365fa21` and run with
`PLATFORM_TYPE=home-assistant`, a fresh data volume and disposable owner account. The application
had an internal-only Docker network, no privileged mode and no Supervisor token; a separate
temporary gateway exposed it only on Mac loopback. This tests the released Home Assistant platform
branch, not an actual HA add-on installation or Supervisor/ingress integration.

System info reported `home-assistant` and health reported `1.1.0-alpha.56`. After enabling Tailscale,
API and the actual admin card showed Unsupported with the platform-specific reason. Privileged
setup was unavailable, endpoints/proxy addresses were empty and `setup` was null. An explicit
install request returned **422 / platform-unsupported** without creating a job; anonymous status
and install requests returned 401.

The card offered Docs and Disconnect, with no setup, sign-in or connect action. Capturing the Docs
button's `window.open` arguments confirmed the HTTPS documentation URL. Explicit Disconnect
stopped the managed service and changed API/card state to Disconnected; the unsupported-platform
requirement persisted and no lifecycle action remained. Restarting the container retained config,
restored Unsupported and updated the still-open authenticated admin without manual reload.

Both test containers, their networks/volume and the owned browser were removed afterward. Neither
Pi nor the user's HA instance was touched. Evidence: `remote-access-r4/ha-platform-alpha56/`.
The unsupported-platform criterion passes at this scope; R4 and the epic remain open.

#### Tailscale preference mismatch refusal and recovery (2026-10-09)

The npm-host Pi 4 running published alpha.56 (`0803ced792f2809c4c05d6d84a55c0ae1d26598f`),
Debian 12 arm64 and Tailscale 1.102.5 passed the
changed-tag preference-conflict scenario at 13:36–13:42 UTC. The baseline was authenticated and
connected, with empty advertised tags/routes. A fresh SQLite/configuration/preferences checkpoint
and a 15-minute recovery timer were prepared before the real admin Disconnect action.

With the daemon Stopped, the unmanaged `--snat-subnet-routes=false` preference was introduced without
advertising any routes. An unchanged-managed-flags CLI probe first proved that this CLI version
refuses the omitted non-default flag without changing preferences or identity. Only then was the
configured tag changed to a test value, while the daemon's actual tags remained empty.

Saving configuration restarted the plugin's managed service and attempted reconnect automatically;
it did not restart the backend process or tailscaled. The journal recorded the non-default-flags
refusal during startup and reconnect. One subsequent real admin Connect returned HTTP 500 in
325 ms and displayed **Failed to connect Tailscale**. The card stayed Disconnected and offered
Connect; API/aggregate endpoints, proxy addresses and external URLs remained empty. The managed
service was `started`, distinct from the daemon's `Stopped` state. Authentication and node/user
identity were retained, the test tag was not applied, and `NoSNAT=true` remained in effect.

Restoring only the configured tags through the configuration API automatically recovered Connected,
external URLs and the existing admin page without reload or another Connect action. This recovery
occurred while `NoSNAT=true` was still present. Certificate-verified HTTPS and tailnet IPv4 health
requests from Pi 5 then both returned 200/alpha.56. The earlier peer probe overlapped restoration
(HTTPS failed, subsequent IPv4 succeeded), so it does not establish a complete disconnected
reachability check. Mac DNS/direct-tailnet probes remained a separate client limitation.

Cleanup restored the original SNAT setting. Configuration saves reordered YAML entries; a full
parsed-YAML comparison proved semantic equality before restoring the original bytes and metadata.
Final checks matched the baseline configuration, stable preferences, node identity, database schema,
28 migrations, topology, accounts/long-lived credentials, boot ID and service PIDs/restart counters.
No logout/reset or application restart was needed; the unused recovery timer was disarmed and the
owned browser closed. Pi 5 was used only for read-only peer probes.

Private evidence is in `remote-access-r4/pi4-preference-mismatch-alpha56/`. This closes the actual
changed-tag conflict-refusal/recovery variant, supplementing alpha.54's compatible manual-adoption
checks. It does not certify valid tag assignment, login-server migration, minimum-version CLI
behavior or new login/WebSocket/phone checks. R4/#910 and the epic remain open for their other gates.

#### Short setup stages missing from progress events (2026-10-09)

The npm-host Pi 4 on alpha.56 / Tailscale 1.102.5 reproduced the remaining setup-visibility gap.
After a fresh checkpoint and recovery timer, only the operator grant was removed; the package,
daemon, authentication, configuration and sudoers were retained. The real admin wizard accepted
Start setup with HTTP 202 and completed Set up → Options → Skip → Done without another sign-in.

A read-only 5 ms status-file sampler observed `install`, `daemon`, `operator` and `complete` at
14:49:46.679, 14:49:46.695, 14:49:47.171 and 14:49:47.214 UTC respectively. The browser received only
an unstepped `running` event at 14:49:46.582 and `complete/complete` at 14:49:49.581. REST snapshots
likewise skipped the named running stages. The admin's three Complete rows were inferred from the
terminal snapshot; they do not establish delivery of each stage. The worker's three-second poll
reads a single atomically overwritten file, so short intermediate states disappear before observation.

This is a reporting defect, not a failed setup: the operator grant was restored by the normal job,
the original admin document returned to Connected, and peer certificate-verified HTTPS/IPv4 health
returned 200. Final configuration, stable preferences, identity, schema/migrations, topology,
credentials, boot ID and process/restart checks matched the checkpoint. Setup worker and unused
recovery timer were inactive afterward; the isolated browser was closed. No runtime patch was
installed. The T3 preview became unavailable before the operator change, so this test used a fresh
local headless Chromium context. Private receipts: `remote-access-r4/pi4-setup-transport-alpha56/`.

The source correction makes Tailscale setup retain a bounded, job-scoped history in the atomic
status snapshot. The worker emits unseen reports in order, using directory notifications for
prompt delivery and polling as fallback; stale job files and rewritten history are rejected.
Existing snapshot/mapped callers keep their protocol. No artificial delay is introduced, and a
coalesced burst can still render as completed stages in a single UI frame. The live-stage row
remains open for released verification after correction. Lost-WebSocket variants were not
exercised in this run and remain separate gates.

#### Released short-stage delivery and long-upgrade UI timeout (2026-10-09)

The npm-host Pi 4 upgraded alpha.56 → published alpha.57
(`26f7b9140cba39c5ea811d9fcf26a5baf8162a62`, including #1384) through one System UI install
confirmation. The release tag's ancestry and all three npm package identities/integrities were
verified. Installed files matched the published wrapper (42), backend dist (5,207) and admin dist
(249) manifests. Schema/migrations, topology, accounts/long-lived credentials, configuration bytes,
boot ID and Tailscale identity/authentication were preserved.

Installation succeeded, but the original admin document reported `downloading / Update failed`
after its five-minute reconnect window elapsed while npm was still installing. At 16:00:57 UTC,
the authoritative update API reported alpha.57, `complete`, 100% and no error. Manual navigation
showed alpha.57 normally. This is a separate admin observation/recovery defect; this upgrade is
not credited as passing the uninterrupted UI completion/reload path.

The follow-up admin correction keeps status requests serial, bounds each request, and backs off
while the backend is unavailable instead of converting elapsed waiting time into an update
failure. The connection message describes an unconfirmed outcome. Monitoring ends on an
authoritative result or when its last active consumer leaves, and can resume on return. This
source correction was not yet installed during this run; the following alpha.58 record tracks
its deployment. Released long-upgrade acceptance remains open.

With a fresh post-upgrade checkpoint and an operator-only recovery timer, the actual released
wizard repaired a removed operator grant without logging out or stopping the daemon. For job
`7ba33d21-9904-4330-907d-fd908f43d42a`, the browser received `running/install`, `running/daemon`,
`running/operator` and `complete/complete` at 16:00:36.441, 16:00:36.462, 16:00:36.997 and
16:00:37.054 UTC. These matched the script's job-scoped history, in order and without duplicate
stage events. Named-stage delivery spanned 613 ms (718 ms including the initial unstepped event).
DOM observations separately captured each of the three rows as In progress, then Complete. The
wizard automatically advanced to Options and completed Skip → Done; REST confirmed the same
terminal job. No artificial stage delay or local runtime patch was used.

The setup's configuration, stable preferences, identity, schema/migrations, topology, credentials,
boot ID and backend/tailscaled process/restart counters matched the post-upgrade checkpoint.
The setup worker and unused recovery timer were inactive, the cached test session was removed,
and the isolated browser was closed. Read-only Pi 5 peer probes returned certificate-verified
HTTPS and IPv4 HTTP 200/alpha.57. Private receipts: `remote-access-r4/pi4-setup-transport-alpha57/`.
This closes the live-stage delivery row for the released installed-package setup. Intentional
WebSocket loss, fresh-package installation, additional login/phone variants and the other R4
gates were not exercised by this run; R4 and the epic remain open.

#### Alpha.58 deployment and bounded setup transport-loss acceptance (2026-10-09)

The npm-host Pi 4 upgraded alpha.57 → published alpha.58
(`4fa129f7f04276eaa5850a49869f799edd2ca442`, including #1385) with one System UI confirmation.
The tag/version-sync ancestry and npm integrity checks passed. Installed wrapper (42), backend
dist (5,207) and admin dist (249) files matched the published manifests exactly. Schema/migrations,
topology, accounts/long-lived credentials, configuration bytes, boot ID and Tailscale identity
were preserved. Tailscaled retained its PID; the independent updater survived backend shutdown.

The original alpha.57 admin again showed `downloading / Update failed` after five minutes.
The authoritative API subsequently confirmed alpha.58 / complete / 100% / no error; fresh
navigation showed alpha.58 and Connected. This installs the observer fix but does **not** pass
its hardware gate: that needs a subsequent upgrade starting from the fixed alpha.58 admin.

On this released candidate, three isolated browser contexts ran actual operator-repair setup jobs.
Each used a fresh database/configuration checkpoint and a 15-minute recovery timer; only
`OperatorUser` was cleared. Package, daemon, authentication and other preferences were retained.
REST was left available while WebSocket delivery/reconnection was blocked until after completion.
All times below are UTC on 2026-10-09:

| Client-observed loss trigger                    | Fresh job                              | Cut          | First matching terminal REST response | Options      |
| ----------------------------------------------- | -------------------------------------- | ------------ | ------------------------------------- | ------------ |
| Before POST acceptance                          | `8ad077cc-95f7-40d2-8652-18157625efc9` | 17:56:15.623 | 17:56:18.988                          | 17:56:19.004 |
| After initial Running event (no named step yet) | `dbe838c5-857a-4a0c-9e73-f8dbd355c724` | 17:58:04.195 | 17:58:07.530                          | 17:58:07.549 |
| Complete event withheld                         | `834c3d0a-a14b-4ac7-8664-44706f43e042` | 17:59:48.784 | 17:59:51.435                          | 17:59:51.450 |

Each accepted job reached Complete through REST with satisfied prerequisites and enabled Options
without a document reload. Status reads did not overlap. The terminal-event case had neither a
terminal REST result nor Options before its cut, so it establishes fallback recovery rather than
an already-completed UI. Each context later reconnected its authenticated socket and received normal
events. The first case reached Options and Skip; its harness tried the nonexistent Done button,
then closed the context. The other two verified Skip → Close. This harness issue is not a product
failure or evidence of the first case's final Close action.

The first two cuts closed the browser-facing transport; an upstream test proxy socket lingered
until timeout. No message was forwarded to the page during either outage. The third used a valid
browser close code and ignored retired sockets. Later GETs overwrote a convenience terminal field
in the first two receipts; their original timed request records preserve confirmation before the
observation ended. Report client-observed loss, not immediate upstream TCP closure. The second
case is specifically loss after initial Running; it does not establish the named-stage variant
recorded separately below.

After every job, all baseline preservation checks passed: stable preferences, configuration bytes,
schema/migrations, topology, credentials, identity, boot ID and backend/tailscaled PIDs/restart
counters. Unused recovery timers and setup workers were inactive, cached sessions removed and all
owned browsers closed. The final Pi 5 peer probe at 18:01:00 UTC returned certificate-verified
HTTPS and IPv4 HTTP 200/alpha.58. No runtime code patch or artificial worker delay was used.
Private evidence: `remote-access-r4/pi4-admin-upgrade-alpha58/` and
`remote-access-r4/pi4-setup-transport-alpha58/`.

These bounded installed-package cases do not establish fresh-package transport recovery, slow CLI,
the production setup timeout, device network loss, pending-login upgrade or new phone observations.
R4/#910 and the epic stay open, including the remaining matrix and one-candidate reconciliation.

#### Named-stage transport-loss follow-up on alpha.58 (2026-10-09)

On the same published alpha.58 npm-host Pi 4 and Tailscale 1.102.5, job
`b8c6d16f-5716-4b47-8aaa-ab44fa38d269` passed the remaining named-stage interruption case.
The owned browser forwarded the genuine `running/install` frame at **19:51:27.940 UTC**, then
closed its native WebSocket with code 4001; disconnect and closed state were observed at .960.
The next REST response still reported Running/daemon. Terminal REST confirmed the same accepted
job at **19:51:31.175**, with Connected and all prerequisites satisfied; enabled Options appeared
at **19:51:31.195** (3.255 seconds after the cut). There was no reload, overlapping status request,
forwarded Complete frame or reconnection during this observation. Script history matched the
fresh job and ordered install → daemon → operator → complete stages.

The trigger is receipt of a named Running frame; it does not timestamp the worker's exact current
stage. Browser instrumentation observed genuine application requests/responses and forwarded the
original frame before closure. Reading cloned REST bodies adds observation overhead. Reconnection
was disabled during the test and **explicitly restored afterward**, so this is not an automatic
reconnect test. Skip → Close passed, then the restored authenticated socket received normal events.

Only the operator grant was cleared under a fresh checkpoint and unused recovery timer. All
configuration, stable-preference, data/topology, credential, identity, boot and process/restart
preservation checks passed. The timer and worker were inactive, the cached session removed and
browser instrumentation/tab closed. Certificate-verified HTTPS and IPv4 health from the Pi 5 peer
returned 200/alpha.58 at 19:53:09 UTC. No installed runtime files were modified.
Private receipts: `remote-access-r4/pi4-setup-named-stage-alpha58/`.

This completes the named-stage installed-package operator-repair variant left open by the earlier
three cuts. Fresh-package transport loss, slow CLI, setup timeout, device-network and pending-auth
variants remain outside this run. The fixed update observer still needs an upgrade starting from
alpha.58; R4/#910 and the epic remain open.

#### Minimum/installed-version CLI fixture check (2026-10-09)

Official checksum-verified Tailscale 1.66.0 and 1.102.5 Linux ARM64 CLI/daemon pairs
were captured in separate disposable containers with networking disabled and fresh
unauthenticated state. Both produced parseable version/status/preferences output,
NeedsLogin with exit code 0, an omitted unset `OperatorUser`, and empty Serve/Funnel
configuration. Setting the disposable container's operator to `nobody` as root
succeeded and appeared in the next preferences read. The selected flags listed in
fixture provenance were present in both releases' help output; this is not an
exhaustive flag audit.

The committed fixtures exercise the real CLI adapter and requirement evaluator;
platform/systemd facts remain stubbed in those tests. Fixture provenance documents
the official archive hashes, commands, container image and status Self projection.
Raw receipts are private under `remote-access-r4/minimum-cli-compatibility/`.
Both daemons and containers were cleaned up; no Pi or tailnet state was changed.

This passes the unauthenticated minimum/installed-version JSON fixture check, not
authenticated minimum-version adoption, preference-conflict recovery, service-user
permissions or actual Serve/Funnel connectivity. Help flags alone cannot prove those
operations. The remaining hardware matrix, upgrade from the fixed admin and
one-candidate reconciliation still keep R4/#910 and the epic open.

#### Cellular phone transport and client policy on alpha.58 (2026-10-10)

The user completed the phone check with Wi-Fi disabled and Tailscale enabled against
the npm-host Pi 4's private HTTPS endpoint. The registration-status endpoint returned
`open: false`, as reported by the user. One deliberate login with a dedicated nonexistent
test username produced a backend authentication notification with the phone's tailnet
address, rather than localhost.

A passive, metadata-only observation from 16:15:13 to 16:20:13 UTC captured three mobile
WebSocket upgrades through Serve to the unchanged origin, all with HTTP 101 and the
same forwarded address as the authentication notification. The streams contained 4/37/13
server text frames and 2/4/3 client text frames respectively. Backend gateway admission
events followed the upgrades at 16:15:20.514, 16:15:29.716 and 16:16:56.228 UTC. Gateway
admission occurs after authentication; frame payloads were not inspected. The middle
authenticated connection lasted about 79 seconds before disconnecting. This establishes
actual phone WebSocket transport, not the content of a device-update event or per-socket
application address resolution.

The capture had no TCP gaps, invalid/incomplete selected streams or resource-limit drops.
No credentials, cookies, raw traffic or frame payloads were saved. Two earlier five-minute
windows captured no selected requests and are not counted as passes. The observer exited
normally; baseline database/topology, accounts/long-lived credentials, configuration,
node identity, service processes and boot identity matched. Peer HTTPS and IPv4 health
returned 200/alpha.58 after the phone actions. Private receipts:
`remote-access-r4/pi4-remote-policy-alpha58/` (`phone-observation-03.json`,
`phone-user-done-03.json`, `after-phone-03.json`, `peer-health-after-phone-03.json`).

No login POST was captured in the final window, so it does not independently establish a
fresh password-login exchange. Phone HTTP throttle isolation, a new device-state update
on this fresh-host candidate, pending/adverse authentication and the other remaining R4
rows remain open. The IP result and HTTP throttle criterion are tracked separately below.

#### Upgrade observation and sign-in feedback on alpha.59 (2026-10-11)

One System UI update from the fixed alpha.58 admin installed published alpha.59
(`561ceb1a02fe7666f3d388d2dd99dcd58cef4be1`). The original browser document remained open,
showed an unconfirmed result during the backend outage, then automatically displayed alpha.59
and successful completion without reload or a second submission. The run lasted approximately
four minutes (22:04:38–22:08:39 UTC on October 10); it does not prove recovery beyond the former
five-minute deadline or an upgrade during pending login.

The authoritative API confirmed complete / 100% / no error. All 19 baseline comparisons passed,
all 5,498 installed package files matched verified npm manifests, and Pi 5 peer HTTPS/IPv4 health
returned 200/alpha.59. Database, configuration, accounts/long-lived credentials, device topology
and Tailscale identity/authentication were preserved. A fresh installed-admin browser verified
native sign-in submission and persistent credential/429 feedback after transient notifications
expired. Successful phone login recovery and cellular feedback verification remain pending.

This records normal upgrade recovery from the fixed observer, not completion of R4/#910 or the
epic. Private receipts: `remote-access-r4/pi4-admin-upgrade-alpha59/`; detailed chronology and
limitations are in the R4 alpha.59 section of the completion plan.

#### Hardware acceptance checklist (alpha build on the testing Raspberry Pi)

Record the outcome of each row (date, pass/fail, notes) in `tasks/epics/EPIC-REMOTE-ACCESS.md` under Verification.

##### Preparation

- [x] Flash the alpha image (or install the alpha npm package) on the testing Raspberry Pi and complete onboarding. Official alpha.47 image and UI onboarding passed on the separate Pi 4 on 2026-10-05; the captive-portal defect is tracked in #1171.
- [x] Have a Tailscale account with **MagicDNS** and **HTTPS certificates** enabled (tailnet DNS settings) and, if device approval is on, access to the admin console. Verified in the replacement tailnet during alpha.44 acceptance.
- [x] Have a phone on cellular (not on the home Wi-Fi) with the Tailscale app signed into the same tailnet. User confirmed alpha.44 and alpha.46 remote access with Wi-Fi disabled.

##### Setup and sign-in

- [x] Admin → Remote access on the image shows internal URLs and, after enabling the plugin in Extensions, a Setup required card with inactive-daemon/operator requirements. Verified on fresh Pi 4 alpha.47. The clean npm-without-package variant correctly reported Not installed on 2026-10-07.
- [x] Set up completes on the image with the package pre-installed and installs the package from the apt repository on an npm host. Image alpha.47 passed. Published npm alpha.51 passed on 2026-10-07 after removing the package, apt source and keyring: live installation/completion events, full-page reload recovery, all script steps captured in the status file and all prerequisites satisfied.
- [x] Report each setup step live in the admin, including daemon and operator. Published alpha.57 on the npm-host Pi 4 (2026-10-09): the installed-package operator-repair setup delivered all four named stage events in order, matching job-scoped script history; DOM observations captured each row In progress and then Complete. This closes the reporting gap reproduced on alpha.56; no intentional WebSocket loss was introduced.
- [x] Sign in: a login link and QR code appear; approval on another device flips the card to Connected with tailnet name, MagicDNS name and Tailscale IPs. The original design permits approval on any device. Fresh Pi 4 alpha.47 passed link/QR and approval; alpha.51 reauthentication on 2026-10-08 passed with user-confirmed computer approval. Phone camera/QR usability remains a separate untested variant, not an authentication blocker.
- [x] Extensions → Services lists `remote-access-tailscale-plugin / node` as started and healthy. The actual Services → Plugins view showed Running / Healthy on Pi 4 alpha.47.

##### HTTPS and remote use

- [x] Serve HTTPS is on by default: the page lists `https://<node>.<tailnet>.ts.net` as the primary external URL with copy and QR. Default HTTPS, primary URL and actual TLS reachability passed on fresh Pi 4 alpha.47; clipboard equality and decoding the endpoint QR passed on Pi 4 alpha.49 (2026-10-06).
- [x] From the phone on cellular, open that URL: admin loads, login works, and a live change (toggle a device) updates without reload. User confirmed these visible outcomes on alpha.44 and again on alpha.46 (2026-10-05). On the separate Pi 4 alpha.49, the user confirmed loading without a certificate error and successful login; a fresh-host live device change remains untested.
- [x] Verify the phone's WebSocket transport through the proxy. Published alpha.58 on the npm-host Pi 4 (2026-10-10): three phone upgrades returned HTTP 101, exchanged frames in both directions and correlated with authenticated gateway admissions. The metadata-only capture does not establish individual application event contents.
- [x] Backend records the tailnet client address (not 127.0.0.1) for a login attempt from the phone. Published alpha.58 (2026-10-10): the dedicated failed-login notification recorded the same tailnet IP subsequently observed on the mobile WebSocket upgrades.
- [ ] The phone's HTTP login throttle is per client, with successful sign-in after the block expires. Alpha.58 (2026-10-10): phone HTTP 429 with a 60-second retry interval and concurrent distinct-tailnet-peer HTTP 201 prove isolation. A later phone POST reached authentication but returned 404 (`wrong_password` for the owner username); successful phone sign-in recovery and released sign-in feedback verification remain pending. See the R4 phone HTTP throttle evidence in the completion plan.
- [x] Displays → registration status seen from the phone is "closed" (not treated as local). The user reported `open: false` from the Pi 4 alpha.58 HTTPS registration-status endpoint on 2026-10-10; the earlier alpha.49 peer result remains separate.

##### Lifecycle

- [x] Reboot the Pi: the node reconnects without interaction and the URL still works. Alpha.47 automatic CLI/API/UI recovery and user-confirmed cellular admin loading passed on 2026-10-05; the Mac client remained offline.
- [x] Disable the plugin (Extensions): the node disconnects, external URLs disappear; re-enable reconnects. The actual Extensions switch path passed on Pi 4 alpha.47, with CLI/UI agreement, failed/successful HTTPS probes from Pi 5 and retained node identity. Earlier Pi 5 config PATCH/live-card checks remain separately recorded.
- [x] Sign in with an auth key (advanced tab) on a second fresh install or after Sign out: node connects without the browser step. Passed after factory reset on spare Pi 4 alpha.47 with a one-off key; CLI/UI agreement and actual peer HTTPS verified.
- [x] Sign out: the current login expires, the card returns to setup-required, external URLs disappear and tailnet access stops. Passed through the provider card on Pi 4 alpha.47 with CLI NeedsLogin and failed peer HTTPS probes. Non-ephemeral console deletion is not part of logout.
- [x] Factory reset: after restore, no tailnet login remains (`tailscale status` shows NeedsLogin) and Serve is reset. Verified through the actual System UI on the spare Pi 4 alpha.47; reboot, owner/token removal, onboarding recovery and failed peer HTTPS probes also passed.

##### Options and advisories

- [x] Funnel on: the URL becomes public (open it from a device without Tailscale); the public-exposure advisory shows; Funnel off returns it to tailnet-only without touching other Serve handlers. Passed on Pi 4 alpha.49 from the Mac with Tailscale Stopped: public TLS/login/WebSocket, UI advisories, public access removal and retained private HTTPS. An independent private handler on port 8443 survived both transitions and was removed after the test.
- [ ] Tailscale SSH on: `ssh <login-user>@<node>` from the phone/laptop works per the tailnet ACL; off again disables Tailscale SSH. Use an existing OS account with a login shell (`smartpanel` on the test image), not the `smart-panel` service account. Pi 5 peer login after the required authentication check and UI/CLI disable passed on alpha.49; phone/laptop SSH remains untested. Disabling this option does not disable the system OpenSSH service.
- [x] With a short-expiry auth key (or a key expiry set in the console): the key-expiring advisory appears and "Sign in again" recovers. Published alpha.51 Pi 4: one-day node-key warning observed on 2026-10-07; natural expiry, withdrawn URLs, normal wizard reauthentication and verified peer HTTPS/login/WebSocket recovery passed on 2026-10-08. The tailnet default was restored to 180 days before expiry.
- [ ] Tailnet with HTTPS certificates disabled: the tailnet-https-disabled advisory appears with the console link; IPv4 and MagicDNS HTTP endpoints still work.

##### MCP

- [x] MCP config form shows "Use remote access URL" when the HTTPS URL exists; clicking fills the OAuth public base URL and nothing saves until Save. Pi 4 alpha.47 filled the expected URL; reopening without Save restored the empty value.

##### Other deployments

- [x] Docker compose deployment: the Tailscale card reports unsupported with the documentation link; the manual external URL still works. Passed on the published alpha.50 ARM64 digest on 2026-10-07, including UI configuration and persistence across container recreation; native ARM64 and AMD64 release runtime smoke tests also passed. The manual URL fixture was loopback-only.
- [x] Host installed with `scripts/install-server.sh` (not the image): Remote access → Set up installs Tailscale from the apt repository and reports progress, and System → Update runs the in-app updater through the privileged worker. Clean alpha.49 installation, sudoers/probe checks, alpha.49 → alpha.50 and alpha.50 → alpha.51 UI npm updates passed on 2026-10-07. Published alpha.51 fresh-package setup passed after #1231, with backend hardening retained. Every-step live admin reporting remains the separate unchecked criterion above; see verification for sampling boundaries.

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

| Task  | PR title                                                                 | Status                                                    |
| ----- | ------------------------------------------------------------------------ | --------------------------------------------------------- |
| RA-1  | fix(backend): trust forwarded headers only from configured proxies       | done                                                      |
| RA-2  | feat(backend): add remote access module foundation                       | done                                                      |
| RA-3  | refactor(backend): extract privileged worker runner from update executor | done                                                      |
| RA-4  | feat(backend): add Tailscale remote access provider plugin               | done                                                      |
| RA-5  | feat(backend): add Tailscale setup and sign-in flows                     | done                                                      |
| RA-6  | feat(backend): serve admin over HTTPS through Tailscale                  | done                                                      |
| RA-7  | feat(admin): add remote access overview and settings                     | done                                                      |
| RA-8  | feat(admin): add Tailscale remote access setup wizard                    | done                                                      |
| RA-9  | feat(installer): preinstall Tailscale for remote access                  | done                                                      |
| RA-10 | docs(cross): document remote access and Tailscale setup                  | done                                                      |
| RA-11 | feat(cross): suggest remote access URL for MCP OAuth                     | done                                                      |
| RA-12 | integrated verification and hardware acceptance                          | in-progress                                               |
| RA-13 | feat(backend): add Cloudflare Tunnel remote access plugin                | code merged (#911, PR #1027); hardware acceptance pending |
| RA-14 | feat(admin): add Cloudflare Tunnel remote access setup                   | code merged (#912, PR #1030); hardware acceptance pending |
| RA-15 | feat(cross): add WireGuard client remote access plugin                   | milestone 3                                               |
| RA-16 | chore(installer): replace systemd-run sudo grant with fixed helper       | milestone 3 prerequisite (#914), open                     |

October work packages (completion plan R1-R8; see the linked plan):

| Task | Issue / PR title                                                                    | Status                                                       |
| ---- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| R1   | #1156 fix(backend): coordinate Tailscale operations and lifecycle                   | merged (PR #1160)                                            |
| R2   | #1157 fix(cross): order remote access snapshots and bound status reads              | merged (PR #1161)                                            |
| R3   | #1158 fix(admin): complete reliable remote access plugin controls                   | merged (PR #1162)                                            |
| R4   | #910 RA-12: integrated verification and hardware acceptance                         | open (hardware gate, in progress)                            |
| R5   | #1159 fix(cross): verify Cloudflare lifecycle and remote access flows               | open (Cloudflare lifecycle gate)                             |
| R6   | #914 chore(installer): replace systemd-run sudo grant with fixed helper             | open                                                         |
| R7   | #913 feat(cross): add WireGuard client remote access plugin                         | open                                                         |
| R8   | #1354 docs reconciliation and epic close-out                                     | open                                                         |

Earlier merged fixes (all closed): #931 validate provider-declared proxy addresses; #934 report the Tailscale
provider under its plugin name; #948 stop converging Serve/Funnel state from read endpoints; #949 prune finished
privileged worker jobs; #950 stop the systemd scope when a privileged job times out; #951 accept a trailing slash
in remote access URLs; #985 verify the Tailscale operator grant; #986 copy URLs without a secure context; #987
document operator recovery; #988 report the node as disconnected while its service is stopped; #989 report why
privileged setup cannot run; #990 keep the Tailscale card in sync with the node service; #996 carry application
error codes in conflict and unprocessable-entity responses.

### October reassessment

RA-17–27 and the subsequent PR #1005 fixes are already merged. Their delivery does not complete RA-12.
On the alpha.41 source baseline, the fresh analysis passed 614 backend and 444 admin tests, then
reproduced eight missing invariants with controlled diagnostic tests: authentication information after
Disconnect, stale reads/events after Stop, backend and both provider-store ordering, pending-login
cancellation, and starting setup reconciliation without websocket events. See the linked completion
plan for the evidence, repair packages R1–R8 and provider-specific acceptance gates.

No new hardware acceptance is claimed by this reassessment. The checklist above stays open until
results are recorded against an identified candidate release. #897, #991, #910, #914 and #913 remain
open; Cloudflare implementation issues #911/#912 remain closed.

## 9. AI instructions

- Read this file, the spec and the plan section for your task before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to your task's file ownership; append to shared files, never reorder them.
- For each acceptance criterion you touch, either implement it or explain why it is skipped.
- Do not push to `main`; open a PR with the task's title and wait for the Codex review.
