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

The user has a spare Raspberry Pi 4 and second SD card for fresh-image and factory-reset tests.
That card still needs preparation from a completed image; its different hardware will be recorded
separately. The existing Pi 5 stays connected/authenticated. Full R4 and epic #897 remain open.

#### Hardware acceptance checklist (alpha build on the testing Raspberry Pi)

Record the outcome of each row (date, pass/fail, notes) in `tasks/epics/EPIC-REMOTE-ACCESS.md` under Verification.

##### Preparation

- [ ] Flash the alpha image (or install the alpha npm package) on the testing Raspberry Pi and complete onboarding.
- [x] Have a Tailscale account with **MagicDNS** and **HTTPS certificates** enabled (tailnet DNS settings) and, if device approval is on, access to the admin console. Verified in the replacement tailnet during alpha.44 acceptance.
- [x] Have a phone on cellular (not on the home Wi-Fi) with the Tailscale app signed into the same tailnet. User confirmed alpha.44 and alpha.46 remote access with Wi-Fi disabled.

##### Setup and sign-in

- [ ] Admin → Remote access: the page shows the internal URL and the Tailscale card reads "Not set up" (image) or "Not installed" (npm install without the package).
- [ ] Set up: on the image it completes in seconds (package pre-installed); on an npm install it installs from the apt repository and reports each step live.
- [ ] Sign in: a login link and QR code appear; approving on the phone flips the card to Connected with tailnet name, MagicDNS name and Tailscale IPs.
- [ ] Extensions → Services lists `remote-access-tailscale-plugin / node` as started and healthy. Its API passed alpha.46/47 checks; the Services view itself remains unobserved.

##### HTTPS and remote use

- [ ] Serve HTTPS is on by default: the page lists `https://<node>.<tailnet>.ts.net` as the primary external URL with copy and QR.
- [x] From the phone on cellular, open that URL: admin loads, login works, and a live change (toggle a device) updates without reload. User confirmed these visible outcomes on alpha.44 and again on alpha.46 (2026-10-05).
- [ ] Verify the phone's WebSocket transport through the proxy. Phone transport frames were not captured; the separate WebSocket-only probe passed from the Mac.
- [ ] Backend log shows the tailnet client address (not 127.0.0.1) for a login attempt from the phone; the login throttle is per client.
- [ ] Displays → registration status seen from the phone is "closed" (not treated as local).

##### Lifecycle

- [x] Reboot the Pi: the node reconnects without interaction and the URL still works. Alpha.47 automatic CLI/API/UI recovery and user-confirmed cellular admin loading passed on 2026-10-05; the Mac client remained offline.
- [ ] Disable the plugin (Extensions): the node disconnects, external URLs disappear; re-enable reconnects. Alpha.47 config PATCH and live Remote access card checks passed; the Extensions UI click path itself remains untested.
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
- [ ] Host installed with `scripts/install-server.sh` (not the image): Remote access → Set up installs Tailscale from the apt repository and reports each step, and System → Update runs the in-app updater through the privileged worker (the sudo probe must pass with the script's sudoers file).

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
