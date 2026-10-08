# Remote access: fresh analysis and completion plan

Date: 2026-10-03. Adopted: 2026-10-04. Status: R1–R3 merged (#1160/#1161/#1162); R4 hardware acceptance in progress (#910).
Epic: [#897](https://github.com/FastyBird/smart-panel/issues/897).
Coordination: [#991](https://github.com/FastyBird/smart-panel/issues/991).
Reviewed baseline: `3f7b838fb65a346b86e9100c246d6bfc31af06e1` (`main`, application alpha.41).

## 1. Conclusion and scope

Keep the module/provider architecture. Repair the control and observation contracts before adding
another provider. The failures are at boundaries between managed-service lifecycle, Tailscale login,
background reconciliation, REST reads and admin stores. Individual components have extensive tests,
but those tests do not establish that an operator action leaves all layers in the same state.

The user confirmed that the reported problems occurred while operating the plugin. The exact tested
release was not supplied. The findings below reproduce defects in the reviewed source; they are not
a claim that every historical device symptom had the same cause. No live tunnel, device networking,
credentials or deployed application was changed during this analysis.

This adopted plan supersedes the execution order in the September plan and #991. The original
design remains the architecture reference, except for the explicitly proposed contract changes below.
Do not reopen all completed September tasks or reimplement their fixes.

## 2. What is already delivered

| Area                                | Current evidence                                                                                                                    | Remaining work                                                           |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Foundation and Tailscale, RA-1–11   | Implemented and merged                                                                                                              | Cross-layer fixes and device acceptance                                  |
| September close-out, RA-17–27       | Operator verification, stop handling, Serve read/converge split, setup diagnostics, error envelopes and admin actions are in source | Preserve these fixes; they do not close the new findings                 |
| Follow-up PR #1005                  | Login error handling, reconnect backoff and status-read requirement refresh are in source                                           | Retest the actual resulting flows                                        |
| Tailscale acceptance, RA-12 #910    | Still open; task checklist has no completed device matrix                                                                           | Fresh acceptance on one identified candidate release                     |
| Cloudflare, RA-13 #911 / RA-14 #912 | Closed, delivered in PRs #1027 / #1030                                                                                              | Shared status fixes, process lifecycle review and real tunnel acceptance |
| Fixed privileged helper, RA-16 #914 | Open; wildcard systemd-run grants still exist                                                                                       | Design against the current updater, migration and implementation         |
| WireGuard, RA-15 #913               | Open; provider not implemented                                                                                                      | Helper first, then backend/admin and acceptance                          |

The old task file incorrectly labels Cloudflare as future work and helper hardening as out of scope.
Those tracking statements are corrected alongside this plan. Unchecked hardware criteria remain
unchecked. #897 and #991 remain open.

## 3. Findings

“Reproduced” means a deterministic test of the current implementation using mocked CLI/network
boundaries and deliberately controlled completion order. “Source-confirmed” means the relevant code
path was inspected but the full hardware scenario was not executed.

### F1 — Actions infer lifecycle/authentication from an insufficient connection state (high)

**Reproduced/source-confirmed.** `TailscaleNodeManagedService.computeStatusWithRawStatus()` returns
`disconnected` with empty `details` when stopped. `stop()` does not log out, but the admin's
`resolveTailscaleProviderActions()` treats missing `details.tailnet` as “not signed in”. Thus an ordinary
Disconnect leads to Sign in, with no Connect action. A login can then run `tailscale up` while the
managed service stays stopped; its status short-circuit still reports disconnected.

A different disconnected state, with a running supervisor and a retained tailnet, offers Connect as
the primary action. That calls Extensions `startServiceManually()`, which rejects an already-started
service. The secondary Reconnect workaround is present, but the primary action remains invalid.

Sources: `tailscale-node-managed.service.ts` (`stop`, `computeStatusWithRawStatus`),
`tailscale-login.service.ts` (`login`, `currentStatus`), admin `utils/provider-actions.ts` and
`tailscale-provider-card.vue` (`onConnect`), Extensions `managed-service-manager.service.ts`
(`startServiceManually`). These paths are under their respective `remote-access-tailscale` plugins
unless another module is named.

### F2 — Work started before Disconnect can publish Connected afterwards (high)

**Reproduced twice.** Delay the Serve read inside a status request, complete `stop()`, then release
the read: the request returns `connected`. The lifecycle check occurs before asynchronous work only.

Separately, delay `serveService.converge()` inside `pollTick()`, complete `stop()`, then release
convergence: the final emitted provider status is `connected`, after the stop emitted `disconnected`.
There is no lifecycle check after that await. The timer is not restarted because `schedulePoll()`
checks the state, so this incorrect final event can persist until another explicit refresh.

A boolean “still started” check alone also cannot distinguish an old tick from a later stop/start
cycle. Completion must belong to the current lifecycle generation. Serve mutations additionally need
coordination with stop/config changes, not just suppression of their resulting events.

Source: `tailscale-node-managed.service.ts` (`computeStatusWithRawStatus`, `pollTick`, `convergeServe`).

### F3 — Older REST results overwrite newer events in backend and admin (high)

**Reproduced in three places.** Begin a GET, publish a newer disconnected event, then complete the GET
with the older connected snapshot. `RemoteAccessStatusService` caches connected again; both the
Tailscale and Cloudflare admin stores also return to connected. GET deduplication does not prevent
this race. `updatedAt` exists but is not used to arbitrate these writes.

The module admin store has the same unconditional replacement pattern. Backend GET cache changes do
not go through the provider event path that refreshes URLs and invalidates cached proxy contributions.
The repair must cover the aggregate view, URLs and proxy contribution as one publication contract;
an admin-only timestamp check is insufficient. No exploit or live proxy failure was tested here.

Sources: backend `modules/remote-access/services/remote-access-status.service.ts` (`pollProvider`,
`onProviderStatus`), `remote-access-url.service.ts`, `remote-access-proxy-contribution.service.ts`;
admin module and provider `*-status.store.ts` (`get`, `onEvent`).

### F4 — Tailscale setup fallback is not started by accepted installation (medium)

**Reproduced.** `install()` returns a job ID, but neither the Tailscale wizard's `onInstall()` nor
`useTailscaleSetup.install()` refreshes status. The polling watcher only starts when `data.setup.state`
becomes running. A Setup.Progress event writes a separate `setupProgress` field, not `data.setup`.
When progress/completion events are lost, there is no fallback poll to discover the completed job.
The diagnostic waited ten simulated seconds after acceptance without observing any GET.

Cloudflare's wizard already fetches after install. Apply the complete fix to Tailscale and test at the
wizard/store boundary. Also correlate progress by job ID: the current wizard gives a cached terminal
setup state priority over a new running event without first checking whether they are the same job.
That second-install case is source-confirmed and needs a regression test.

### F5 — Login and node management do not share operation ownership (high)

**Reproduced/source-confirmed.** Start interactive login, receive its auth URL, then stop the node:
the tracked login child receives no cancellation. `TailscaleLoginService` guards login calls against
each other, but is outside the node's `withLock()` used by start/stop/reconnect. Logout, preference
reset and config changes also have separate mutation paths. The login service has no destruction
hook; factory reset does not first stop the node poller or cancel login.

The test establishes the missing cancellation, not the eventual behaviour of a real daemon after
late authorization. Acceptance must prove that late authorization, child output and reconnect work
cannot undo a user stop, plugin disable, logout, reset or application shutdown.

Sources: `tailscale-login.service.ts` (`login`, `logout`, `resetPreferences`, `stopPendingLogin`),
`tailscale-node-managed.service.ts` (`start`, `stop`, `onConfigChanged`, `factoryReset`, `attemptReconnect`).

### F6 — Status collection does duplicate work and has inconsistent deadlines (medium)

**Source-confirmed.** The Tailscale status controller calls provider status and requirements in
parallel; provider status evaluates requirements again. Concurrent aggregate requests and polling
add more work. Individual CLI calls can take 15 seconds, but module aggregation returns a synthesized
error after five seconds without cancelling the underlying read. Plugin and aggregate status can
therefore disagree without a real connection change.

Requirements are refreshed every five minutes by the background poller, but on every explicit status
read. On older CLI variants the operator fallback can issue a same-value `set --operator` probe from
a GET. Preserve manual Re-check freshness while moving mutation probes to explicit reconciliation
and keeping ordinary status reads bounded and observational.

Sources: Tailscale `controllers/status.controller.ts`, CLI/node services and constants; module
`RemoteAccessStatusService.raceWithTimeout()`.

### F7 — Cloudflare code completion is not end-to-end acceptance (medium)

The store race is reproduced in F3. The backend's status read also checks lifecycle before async
requirements/readiness work; apply and test the generation contract there too. Inspect process
exit/error/stop ordering and bounded termination before calling this provider complete.

Its `/ready` check establishes an edge connection, not that the configured public hostname actually
routes to this Smart Panel origin. Verify DNS, tunnel routing, TLS, application login, websocket
traffic and client-address handling from outside the LAN. Keep connection status and verified URL
reachability distinct; do not turn a configured hostname into a claim of successful end-to-end use.

### F8 — Helper design must account for the updater changes since September

**Source-confirmed scope gap, tracked by #914.** The privileged worker now supports independent
systemd services as well as scopes. The update path depends on surviving backend shutdown. Porting
the old helper proposal literally risks restoring the updater regression fixed after this epic began.
Root-owned entry points must not execute freely selected application-writable scripts, paths, env
or shell fragments. Merely wrapping unrestricted `systemd-run` is not sufficient hardening.

## 4. Proposed control and status contract

These are design decisions for the repair, not descriptions of already-shipped behaviour.

1. Keep `enabled` as persistent plugin ownership. Expose managed-service lifecycle, authentication
   readiness and observed connection separately. Disconnect stops the current session and preserves
   authentication; disabling the plugin is the persistent choice across application restart. State
   this distinction in the UI. Do not infer authentication from the presence of a display label.
2. Expose explicit action availability and an in-flight operation through the provider's administrative
   status. Connect starts a stopped supervisor or reconciles an already-started disconnected node;
   repeated Connect/Disconnect converges harmlessly. Keep generic Extensions service semantics for
   other plugins; implement domain behaviour at the provider boundary.
3. Give Tailscale node/login/Serve mutations one per-provider coordinator. Stop/disable/shutdown
   invalidate the current generation, cancel and reap interactive/keyed login children, suppress
   retries and settle within a finite deadline. Do not queue Stop behind a ten-minute login. Logout
   cancels login before revoking authentication; reset cancels work before clearing state. Avoid a
   global lock or a new service mixing all providers' implementation details.
4. Build a coherent provider snapshot once. Before publishing, verify its lifecycle/config generation.
   REST and websocket use the same accepted snapshot, with a process epoch and increasing revision
   (or an equivalent ordering token). Time of serialization alone cannot establish observation order.
   Define first load, backend restart, websocket reconnect and full resync explicitly. Older full
   responses may fill independent metadata only if they cannot roll connection state backwards.
5. Commit status before notifying downstream consumers. URL ranking and proxy contribution must use
   that committed revision, including transitions discovered through GET. Retain registered-provider
   validation, disabled-plugin pruning and fail-closed proxy behaviour.
6. Coalesce concurrent observations and requirements checks. Ordinary GETs do not run `up`, `down`,
   `set`, Serve/Funnel convergence or privileged setup. Explicit Re-check requests a fresh observation;
   capability mutation probes belong to setup/action handling. Return bounded stale/error information
   if a fresh observation cannot finish within the status budget; do not leave growing background work.
7. Preserve owner/admin permissions, `error.details.code`, no-store authentication responses, secret
   redaction, opt-in Funnel/SSH and adoption of manually prepared installations. Regenerate OpenAPI
   from backend source for contract changes and retain the current fields during migration.

The remote-access module remains a URL/status/proxy registry. Its enabled setting is not a network
kill switch for independently enabled providers. Document and test that distinction; provider disable
must actually stop that provider. Do not silently change this into a new global lifecycle dependency.

## 5. Delivery sequence

The R identifiers below are proposed work packages, not new GitHub issues. Create their issues after
the plan is adopted, linked to #897; keep #991 as the single execution index. Each package should be
split into reviewable backend/admin PRs where appropriate, with failing regressions added before the
fix. Do not close #897 from a component PR.

| Order | Package and scope                                                                                                                                   | Acceptance gate                                                                                                                                                                                                |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1    | Tailscale operation ownership and control contract; F1/F2/F5. Node, login, Serve, provider administrative API; focused Extensions integration only  | Disconnect retains auth; Connect valid from both lifecycle states; no old operation mutates or publishes after stop/disable/reset/shutdown; every child reaped; errors actionable                              |
| R2    | Ordered snapshots and bounded observations; F2/F3/F6. Provider contract, module cache/publication, both providers and all three admin status stores | Controlled GET/event/stop/start/reconnect permutations converge; committed status, URLs and proxy contributions agree; one observation in flight per provider; deadline paths leave no accumulating work       |
| R3    | Complete plugin operator flows; F1/F4. Cards, wizard, action gating, job identity, REST reconciliation and six locales                              | Connect→Disconnect→Connect works without reload or login; no invalid primary action; accepted setup starts fallback immediately; lost events, second install and reload recover; API failure clears busy state |
| R4    | Tailscale release acceptance using #910                                                                                                             | All required rows below recorded on one identified candidate release; failures produce a reproducible owning regression and return to R1–R3                                                                    |
| R5    | Cloudflare parity and acceptance using delivered #911/#912 as baseline                                                                              | Generation/child-stop tests pass; install/token replacement/removal and crash recovery work; external URL, login and websocket verified on a real tunnel                                                       |
| R6    | Fixed privileged helper #914, design then implementation                                                                                            | Root trust boundary tested; legacy migration explicit; fresh install and normal app upgrade/recovery pass on hardware; independent updater service preserved                                                   |
| R7    | WireGuard #913, backend then admin                                                                                                                  | Uses helper only; safe peer config and secret handling; real peer handshake/recovery, stop/disable/reset, admin and manual setup acceptance                                                                    |
| R8    | Epic close-out and documentation reconciliation (#1354)                                                                                                  | R1–R7 gates recorded, docs reflect shipped contracts, #910/#914/#913 and coordination completed, no unchecked mandatory acceptance silently waived                                                             |

Dependencies: R1 → R2 → R3 → R4. R5 consumes R2/R3 conventions. R6 starts after the Tailscale gate
so helper migration does not obscure provider debugging. R7 depends on R6 and the verified provider
contract. R8 requires all gates. Cloudflare's completed implementation is retained throughout.

### R2 implementation contract

- The module accepts provider observations before publishing them. Every accepted provider status,
  aggregate status and URL snapshot carries a backend process `epoch` and monotonic `revision`;
  wall-clock timestamps are informational. The cached status is committed before URL/proxy consumers
  or websocket subscribers are notified. GET-discovered changes use the same publication path.
- Requirements and provider status are collected together. Provider-specific administrative metadata
  stays outside shared events; authentication URLs and QR codes remain restricted to privileged
  responses. Disabled plugin diagnostics remain readable but contribute no endpoints or proxies.
- Concurrent reads share one full provider observation. Observations have a 6-second budget and the
  module has a 7-second outer deadline. Cancellation reaches CLI reads and Cloudflare metrics HTTP;
  unreaped work retains its slot. Ordinary GETs do not run the Tailscale operator write probe.
- Saving enabled provider configuration retains the last coherent observed state while a fresh read
  is scheduled after old work drains. This refresh has the same bounded deadline and fails closed
  if cleanup or observation stalls. Disabling a provider removes its contributions immediately.
- Full observations refresh read-only prerequisites, including periodic observations, so an explicit
  Re-check cannot join a poll carrying a cached requirements result. This adds read-only prerequisite
  probes to the normal 30-second polling cadence.
- Admin stores merge independent provider/URL revisions, buffer initial events, reject stale reads
  and resync through authoritative REST on an unknown epoch. Reconnect supersedes pending reads;
  further events during an epoch resync join that resync rather than repeatedly aborting it.

### Helper and WireGuard constraints

- #914 needs a small design review of allowlisted jobs, root-owned installation/update, validated
  arguments/environment, status-file ownership, cancellation, recovery and rollback. Include the
  current update quiescence and service-unit lifecycle; do not reintroduce backend-owned worker scope.
- Define and test legacy-host migration separately from the hardened end state. A compatibility host
  retaining wildcard sudo grants cannot be described as hardened. Fresh installs must not require
  them. Update all installer/image sudoers sources together.
- WireGuard is a client of an existing server. Reject arbitrary `wg-quick` hooks, shell fragments,
  unsafe interface/path values and unintended default-route takeover. Private/preshared keys are
  write-only secrets; auth and handshake state must not be inferred from interface existence alone.
- Retain #913's handshake freshness rule as an initial contract and test idle peers with keepalive,
  reboot and network recovery before treating it as a usability guarantee. Real peer/server access
  is an explicit acceptance prerequisite, not replaceable by mocks.

### Execution tracking (2026-10-04)

- R1: [#1156](https://github.com/FastyBird/smart-panel/issues/1156), provider operation ownership,
  authentication/lifecycle control fields and idempotent connect/disconnect API. Completed in
  [PR #1160](https://github.com/FastyBird/smart-panel/pull/1160), merged as `1a6d2089d`; all CI checks passed.
- R2: [#1157](https://github.com/FastyBird/smart-panel/issues/1157), ordered snapshots and bounded reads. Completed in
  [PR #1161](https://github.com/FastyBird/smart-panel/pull/1161), merged as `a0ec77488`; all CI checks passed.
- R3: [#1158](https://github.com/FastyBird/smart-panel/issues/1158), admin plugin controls. Completed in
  [PR #1162](https://github.com/FastyBird/smart-panel/pull/1162), merged as `e6ad90a07`; all CI checks passed.
  Hardware acceptance remains R4/R5.
- R4: [#910](https://github.com/FastyBird/smart-panel/issues/910), device acceptance after R1–R3.
  Alpha.42 passed the normal system upgrade and operator setup with websocket unavailable. Hardware
  testing found excess pending-login polling (HTTP 429) and frozen endpoint response mutation
  (connected aggregate HTTP 500); both fixes shipped in alpha.43. The gate remains open pending the
  full acceptance matrix. Pi and the test Mac are approved in the new tailnet; see the epic task
  verification table for the scoped results. Alpha.43 (PR #1163 merged as `cf9441c1a`) passed
  normal application upgrade and artifact/data checks, but Tailscale recovery failed because the
  plugin passes `--advertise-tags` to `tailscale set`. The installed 1.102.3 CLI supports that flag
  only on `up`; explicit Connect reproduces the failure. PR #1164 fixes the flag contract and retains
  pending tag changes after failed or cancelled writes so an identical configuration save can retry.
  It merged as `6ddc03e46`; all CI checks passed and CodeRabbit reported Minimal merge risk for the
  final commit. Local validation: 14 Tailscale suites / 415 tests, backend type checking and changed-file
  lint/format passed. Alpha.44 passed the normal upgrade, data/artifact checks and automatic Tailscale
  recovery. Serve HTTPS became available after the user enabled tailnet certificates. The lifecycle
  runner then stopped at its first Disconnect: ciao's mDNS packet handler threw an uncaught IP/mask
  family assertion, exiting the backend process; systemd restarted the application and its enabled
  provider. Zero full rounds completed. A local reproduction uses an IPv4 packet on an interface
  whose IPv4 mask has disappeared. The receive-boundary correction merged in #1165 as `512626cc2`;
  alpha.45 (`483a89911`) passed normal upgrade, exact artifact/data/session checks and automatic
  Tailscale recovery. One API/CLI/service/reachability cycle passed without a process restart, but
  browser HTTP 429 stopped the full UI gate. Public revisions trigger unbounded immediate private
  metadata reads in the shared admin reconciliation hook; concurrent observers can amplify requests
  even on separate client addresses. The follow-up adds a shared five-second event-read cadence
  with a trailing update; the production rate limit is unchanged. Repeat the gate after release.
  A separate clean alpha.44
  observation reproduced missing controls after natural access-token expiry: successful refresh
  leaves tokens present but clears the owner profile. A real-store/HTTP-client regression reproduced
  the failure before the auth middleware correction; release acceptance must include a natural-expiry rerun.
  Both admin fixes are merged: #1166 as `e3dea0ca2` and #1167 as `c489fd240`.
  Alpha.46 (`d11bc23d8`) passed normal upgrade and all artifact/data/session checks.
  Acceptance found another Firefox client sharing the test browser's client IP; its additional
  status traffic contributed to HTTP 429 even while the new browser stayed at at most 12 reads/minute.
  The user closed that tab before the clean cycle rerun. The Pi actually ships throttler 6.7.1,
  whereas the workspace lock selected 6.5.0; the old storage expiry defect is not the cause of this
  alpha.46 finding. PR #1168 pins the tested/runtime version and separates the two providers'
  identical controller-name throttle keys, without raising limits or changing client identity.
  The low-risk #1167 review follow-up is implemented in #1169: preserve a queued metadata refresh
  across an external GET completion and schedule it five seconds later. Because the semaphore
  exposes no success outcome, this may add one trailing read after a successful external GET;
  continuous three-second polling still produces no overlapping worker read. Regression validation:
  62 hook/card tests, admin type checking and changed-file lint/format passed.
  The clean alpha.46 rerun passed all 20 lifecycle rounds (60 actions) with CLI/API/UI and actual
  tailnet reachability agreement, no HTTP 429 or service restarts. Three rapid cancellation rounds
  also passed, including concurrent status reads and no revival before an explicit Connect.
  Natural token expiry retained the owner profile and controls after successful refresh; TLS-verified
  HTTPS and authenticated WebSocket event reception passed from the Mac. Connected HTTP convergence
  took up to 8.049 seconds after API settlement and is recorded separately from API latency.
  The 609.6-second idle check passed with unchanged process identities/restart counters, no
  growth between boundary process counts, no flagged journal patterns and no UI HTTP errors.
  The user confirmed alpha.46 admin loading, login and live device updates without reload from
  a phone with Wi-Fi disabled and Tailscale enabled. Full R4 remains open; the broader
  install/auth/reset/upgrade variants are still unperformed.
  Both follow-ups are merged (#1168 `2593d8436`, #1169 `61c26995f`) and deployed in alpha.47
  (`38d59a30f`) through one verified normal upgrade. Config disable, persistence across an
  application restart, and re-enable with actual HTTP/HTTPS reachability passed on the Pi 5.
  Enabled host reboot restored CLI/API/UI and preserved all data/configuration, but its Mac
  reachability probe failed while that client was offline from the coordination server/DERP;
  the user independently confirmed cellular admin loading after the reboot. Automatic recovery
  and cellular URL reachability therefore pass; the Mac client limitation remains separate.
  Post-reboot fresh login/live updates and phone WebSocket transport were not reverified.
  Fresh official alpha.47 image acceptance then passed boot, firstboot and UI onboarding on the
  separate Pi 4 (Debian 12 arm64, Tailscale 1.102.4). Extensions enable, preinstalled-package setup,
  interactive link/QR approval and default Serve HTTPS passed. The Services view showed Running /
  Healthy. Extensions UI disable/re-enable preserved identity and removed/restored actual HTTPS
  reachability from the Pi 5. A fresh HTTPS owner login and closed display-registration status passed
  from that peer. The MCP URL suggestion filled the form without persisting until Save. The user
  confirmed that the new Pi 4 login page loads without a certificate error over cellular Tailscale.
  Phone login/live updates on this fresh host and phone transport remain
  pending; neither login-page loading nor peer results substitute for them. Fresh acceptance also found installer
  [#1171](https://github.com/FastyBird/smart-panel/issues/1171): the captive portal remains active
  after Ethernet becomes available because it only checks connectivity at startup. The follow-up
  adds a bounded startup grace and cancellable Ethernet monitoring while the portal runs; isolated
  process regressions cover cleanup and Wi-Fi provisioning. Fresh-image hardware verification
  remains open. A subsequent factory reset through the spare Pi 4 System UI
  passed from authenticated/Serve-enabled state: new host boot, no owner or auth tokens, automatic
  return to onboarding, CLI NeedsLogin, empty Serve and unreachable peer HTTPS. After onboarding,
  the plugin was disabled by default and enabling it accurately reported the missing operator grant.
  Repeating Set up restored the operator grant. Invalid-key testing then found
  [#1172](https://github.com/FastyBird/smart-panel/issues/1172): the wizard advanced to Options although
  the returned state and CLI still required sign-in. The follow-up gates advancement on Connected
  and handles pending/failed results with regression coverage. Fixed-release invalid-key acceptance
  passed on Pi 4 alpha.48 on 2026-10-06: System UI upgrade completed with retained data/configuration,
  installed runtime/admin hashes matched the verified release, and two invalid-key attempts stayed on
  Sign in with cleared input, error feedback, CLI NeedsLogin and no temporary key files. Pending approval
  and timeout remain covered by automated tests. The #1174 captive-portal fix merged after this release;
  its new server image build is [run 37436682127](https://github.com/FastyBird/smart-panel/actions/runs/37436682127),
  Fresh-image Pi 4 acceptance passed on 2026-10-06: Ethernet was detected within 12 seconds and
  the portal exited without leaving a hotspot or DNS redirect. A controlled 90-second NetworkManager
  disconnect then exercised real hotspot startup and late-Ethernet recovery without a host reboot:
  the portal/hotspot stopped within about seven seconds of the observed reconnect, followed by API
  Online within another seven seconds and automatic removal of the admin Setup Mode notification.
  Both controlled attempts also exposed a separate mDNS `ENETUNREACH` backend exit
  ([#1223](https://github.com/FastyBird/smart-panel/issues/1223)). PR #1224 fixed the response-send
  callbacks and passed released alpha.49 verification on 2026-10-06 (tag `5168e08af`): System UI
  upgrade retained data/configuration and installed hashes matched the verified server/npm artifacts.
  A controlled 90-second Ethernet outage exercised 82 logged `ENETUNREACH` callback warnings while
  all 61 backend identity samples retained the same boot ID/PID, zero restarts and active/running state.
  The real hotspot/portal/DNS redirect cleared automatically after reconnection; the local API stayed
  responsive and returned Online, and both admin connection/setup notices cleared without reload.
  Tailscale remained unauthenticated with an inactive daemon, so this verifies mDNS publisher and
  Ethernet/portal recovery, not authenticated provider traffic. Full evidence is in the epic's
  alpha.49 verification section. A physical unplug attempt restarted the Pi and is not
  counted as continuous-operation acceptance.
  A subsequent authenticated alpha.49 test with Tailscale 1.102.5 passed a separate 90-second
  logical Ethernet outage: CLI offline/Connecting removed aggregate URLs, peer HTTPS failed during
  the outage and recovered with valid TLS, and the open admin returned to Connected without reload.
  All 24 state samples retained host/backend/daemon identity with zero restarts; node preferences
  and Serve configuration were unchanged. HTTPS endpoint copy and QR decoding passed. The user
  confirmed cellular HTTPS loading and owner login on this Pi 4. Peer authentication notifications
  retained the Tailscale client address and display registration was closed. Five invalid logins
  reached authentication, then 429 applied even with a spoofed forwarded address; a concurrent Mac
  LAN owner login succeeded. A TLS-verified, authenticated WebSocket-only peer connection subscribed
  successfully and received eight normal event payloads over 20 seconds without reconnect or polling.
  Phone-specific transport/address/registration checks and a fresh-host
  live device change remain untested. See the epic's authenticated alpha.49 section for timestamps
  and evidence boundaries; this does not close R4.
  Tailscale SSH opt-in also passed from the Pi 5 peer: the UI switch set `RunSSH=true`, and after
  the tailnet's required authentication check, `id -un` returned the OS login user `smartpanel`
  with exit zero. The service user `smart-panel` has a nologin shell. Saving the switch off restored
  `RunSSH=false` while CLI online, unchanged Serve and certificate-verified HTTPS remained healthy.
  The follow-up SSH wrapper rejected the host key without executing a command; this is not a claim
  that port 22 or the system OpenSSH service closed. The phone/laptop SSH variant remains untested.
  Funnel acceptance passed on alpha.49 after the administrator granted the tailnet capability.
  Without that grant, `funnel-not-allowed` accurately preserved private access. With it, the real UI
  switch produced a public primary endpoint and exposure advisories; the Mac with Tailscale Stopped
  reached the login page over verified TLS, authenticated and received eight WebSocket events in
  20 seconds. Initial relay TLS failures were followed by successful probes of all three public relay
  addresses. Turning Funnel off made those public probes fail while private peer HTTPS stayed healthy
  and advisories cleared. An independent private Serve handler survived both transitions; removing
  it restored the pre-test Serve configuration exactly. Funnel is off and the tailnet permission remains
  enabled. The epic records timestamps and evidence; the remaining R4 gates stay open.
  Separately, an alpha.47 one-off auth-key login through Advanced passed without browser
  authorization: CLI Running/online, Connected UI, Serve HTTPS and certificate-verified peer HTTPS.
  Explicit provider Sign out then returned CLI NeedsLogin and Setup required, removed external URLs
  and made peer HTTPS unreachable while retaining the local owner. No temporary auth-key files or
  exact key matches in the inspected configuration/database and journal remained. Full R4 remains open.

- R5: [#1159](https://github.com/FastyBird/smart-panel/issues/1159), Cloudflare lifecycle and acceptance.
- R6/R7: [#914](https://github.com/FastyBird/smart-panel/issues/914) / [#913](https://github.com/FastyBird/smart-panel/issues/913).

R1 adds a `control` object to plugin status: `enabled`, `service_state`, `authentication`, the active
`operation`, and role-filtered `available_actions`. `POST /connect` and `POST /disconnect` are available
to owners/admins; logout and preference reset remain owner-only. Disconnect cancels pending work and
retains authentication. It does not persistently disable the plugin: an enabled plugin starts again
with the application. Lifecycle invalidation also guards setup completion and background reconciliation.
R3 consumes this contract in the admin. Cards use explicit allowed actions and operation state;
Tailscale Connect/Disconnect call the provider endpoints. Cloudflare cards use the existing Extensions
lifecycle to choose Start or Restart, with generic service-request transport deadlines still tracked
in R5. Setup reconciliation starts on job acceptance, follows job IDs and resumes after reload.
Provider reads and action requests are bounded; setup monitoring settles after backend restart or
a twelve-minute observation deadline (ten-minute worker limit plus recovery grace).
R1 alone does not claim the reported UI flow fixed.
No hardware acceptance checkbox is completed by these automated changes.

## 6. Verification and completion evidence

### R5 preparation while R4 expiry acceptance is pending (2026-10-07)

The user authorized independent work while the test Pi's one-day node key is left to expire on
2026-10-08 at 11:25:29 UTC (13:25:29 Europe/Prague). R4 remains open; this preparation does not
advance the Cloudflare hardware acceptance gate or change the running Pi's authentication.

The Cloudflare card uses the generic Extensions service actions. Their unbounded HTTP requests
can retain the acting semaphore indefinitely when a response is lost; unbounded service reads can
also prevent the card's post-action reconciliation from completing. The admin correction bounds
service reads to 20 seconds and lifecycle actions to 60 seconds, including time spent waiting in
authentication middleware, releases request state on timeout, and gives each store its own semaphore.
The read limit allows for sequential health observations from both remote-access providers.
A client-side timeout does not cancel the server-side operation, and actions are not automatically
replayed. The card reconciles actual service state through a fresh read before offering the next action.

Validation: 28 focused store/card tests and full admin type checking passed, including the real
HTTP client/auth middleware and ignored-abort late replies. Admin lint passed with six existing
warnings. The full suite before the final middleware correction passed 3,327 tests with one
15-second timeout in the unchanged virtual-device wizard; that entire 18-test suite passed when
rerun alone. The final correction was verified by the focused tests and type checking.
[PR #1234](https://github.com/FastyBird/smart-panel/pull/1234) merged as `74b88590b` after
all CI checks passed and CodeRabbit reported minimal merge risk for the final commit.

The first backend correction addresses child-process ownership and termination:

- Stop sends SIGTERM, escalates after the existing 10-second grace, then rejects after another
  two seconds if termination is still unconfirmed. Failed signals do not imply exit. The service
  retains ownership, reports an error and permits another stop attempt or a genuine late exit.
- Concurrent stops share the same termination attempt. Exit, close-only and failed-spawn errors
  settle the wait; terminal paths release timers and wait listeners.
- Child identity guards isolate old exit/error/stderr callbacks and stop continuations from a
  replacement. Stderr carry and token redaction belong to their originating child; logged errors
  are redacted too.
- Managed start refuses recovery from a failed stop while the old child remains owned, so a
  config restart cannot present the old tunnel as a successfully started replacement. Recovery
  after a late exit and ordinary failed-spawn self-healing remain available.
- The real SIGKILL regression waits for a signal-handler readiness sentinel and asserts SIGKILL.

Validation: all 20 Cloudflare/Extensions suites passed (229 tests), full backend type checking and
changed-file lint/format passed. Deterministic ownership regressions failed against the pre-fix
source; real child-process tests cover normal stop, crash and forced termination. This is local
code validation, not real-tunnel acceptance.

Two source-reviewed backend gaps remain for the next regression/fix batch:

- A hostname-only config change invalidates an in-flight poll without replacing its consumed timer;
  polling and crash recovery must continue in the new generation.
- A child can exit while `/ready` is pending; the old successful response must not publish Connected.

R5 still needs an identified release, a dedicated Cloudflare tunnel/public hostname, token
configure/replace/remove, external TLS/login/WebSocket/client-address checks, crash/network
recovery, reboot/reset and upgrade. R4's pending node-expiry test remains unchanged.

### R5 polling follow-up (2026-10-07)

[PR #1235](https://github.com/FastyBird/smart-panel/pull/1235) merged as `6398216c9` after
all CI checks passed and CodeRabbit reported minimal merge risk for the final commit, with no
actionable review comments.

The polling correction addresses both gaps recorded above. A hostname-only update clears the old
poll timer and rearms it after its observation only if it still owns the current generation. Stop
and newer config updates cannot be superseded by an old continuation. Connecting/stable cadence
remains five/thirty seconds, including the recovery poll after a hostname change.

Each spawned child has an opaque identity distinct from its start timestamp. Status collection
checks liveness and that identity after awaiting readiness, so an exited or replaced child's
response cannot publish Connected, endpoints, proxy addresses or obsolete connector metadata.

Validation: 21 suites / 244 tests passed across Cloudflare, Extensions and the shared observation
helper; full backend type checking and changed-file lint/format passed. Tests reproduce interrupted
polling, rapid hostname changes, stop supersession and stale readiness on both the polling and
status-request paths. Four regressions failed against the pre-fix managed-service source, including
the REST exit case that previously returned Connected with the obsolete connector and proxy trust.
A real-process test confirms distinct identities for replacements sharing a start timestamp.

Cloudflare hardware acceptance remains pending, and the test Pi's Tailscale login is left unchanged
for natural expiry. These code tests do not substitute for release installation or a real tunnel.

### R5 staging installation finding (2026-10-07)

[PR #1361](https://github.com/FastyBird/smart-panel/pull/1361) merged as `a2496c2d0` after
its final CI checks passed. Its polling/readiness corrections and the preceding R5 fixes are in
published `v1.1.0-alpha.52`, tag commit `06478e633`.

The user selected the separate staging Raspberry Pi 5 for Cloudflare acceptance, preserving the
Pi 4's natural Tailscale key-expiry test. The Pi 5 upgraded from alpha.47 to alpha.52 through one
normal System-module install request. Before installation, the server archive checksum, backend
and admin npm integrity, compiled backend/static assets and unchanged migration files were verified;
a retained database/configuration backup passed integrity and preservation checks. The ten upstream
server-build/publication jobs passed; independent Docker and SD-image jobs were still running.

After installation, the durable worker completed with no lock. Health, 1,719 backend files and
250 admin files matched the verified release. All 111 devices, channel/property topology,
28 migration rows, database schema, configuration, accounts, long-lived tokens and Tailscale
identity were preserved. Both the existing session and a fresh login worked.

The first owner-triggered Cloudflare package installation then failed before configuring a token:
`tee: /usr/share/keyrings/cloudflare-main.gpg: Read-only file system`. The worker was launched as
`smart-panel-remote-access-cloudflare.scope`, inheriting the backend's `ProtectSystem=strict`
mount namespace even after elevation. The Cloudflare setup caller must use the existing
manager-owned transient-service mode, as Tailscale setup already does; backend hardening stays
unchanged. A successful launcher exit remains distinct from worker completion, which is observed
through the existing status-file/service lifecycle contract.

Validation: the Cloudflare setup, installer-script and shared privileged-worker suites passed
(3 suites / 90 tests), along with full backend type checking, changed-file lint/format and shell
syntax checks. Independent review found no lifecycle incompatibility. Hardware success for this
correction is still pending.

The dedicated Cloudflare dashboard tunnel exists, but no public route or plugin token has been
configured. Package setup must be repeated on a release containing this correction before
external TLS/login/WebSocket or lifecycle acceptance can proceed. The successful application
upgrade does not establish Cloudflare provider upgrade preservation while connected. R5 remains
open, and Pi 4 has not been changed.

### R5 staging public-access acceptance (2026-10-08)

[PR #1366](https://github.com/FastyBird/smart-panel/pull/1366) merged as `7a996c625`.
Its transient-service setup correction is verified on the separate staging Raspberry Pi 5
(`192.168.2.22`, image installation), running `v1.1.0-alpha.53`, release tag `3493f2893`.
The tag includes version synchronization and a subsequent documentation-only merge; the published
server runtime was separately checked for the setup correction and matched the backend npm package.

The normal System-module upgrade from alpha.52 completed after a verified database/configuration
backup. All 111 devices, topology, schema, 28 migration rows, configuration, accounts and long-lived
tokens were preserved. Existing-session and fresh-login checks passed; Tailscale retained its identity
and connection. The deployed 1,719 backend files and 250 admin files matched the verified release.
This upgrade preceded Cloudflare configuration and does **not** prove a connected Cloudflare upgrade.

Cloudflare setup could now write the signed repository keyring outside the application sandbox.
The first alpha.53 job then failed during APT index refresh because the Debian/Raspberry Pi HTTP
repositories reported missing Release files. Subsequent endpoint checks and a diagnostic APT refresh
succeeded without changing repository/network settings. One new normal plugin setup job completed,
installing cloudflared `2026.10.0`; the original failed job was retained as evidence.

The operator entered the dedicated tunnel token directly in the admin. Readback exposed only the
configured marker. The dedicated `smart-panel-staging` tunnel routes `panel-test.zbysov.app` to
`http://localhost:3000` on Pi 5. The Cloudflare route wizard claimed DNS creation, but both the zone
record list and authoritative NXDOMAIN showed the record was absent. Creating the matching proxied
CNAME in the DNS zone established authoritative resolution; unrelated routes were not changed.

The following checks passed on this release:

- Public HTTPS served the admin and healthy alpha.53 with normal certificate validation. Public
  owner login/profile matched local authentication; anonymous protected API requests returned 401.
- Socket.IO accepted a valid token and rejected missing/invalid tokens with authentication errors.
  The public admin browser logged in and showed a connected WebSocket.
- Manual stop withdrew endpoints/proxy contributions, terminated the child and remained withdrawn
  for more than 35 seconds. Start and restart restored real public HTTPS, with one replacement start
  on restart. Disable also held the withdrawn state for more than 35 seconds; enable preserved the
  omitted token and reconnected. Protocol changes to HTTP/2 and back to Auto restored public HTTPS.
- The local admin reflected provider transitions and URL withdrawal/reappearance without reload.
  Tailscale remained available. Final state: plugin enabled, protocol Auto, four ready connections,
  one unprivileged cloudflared child owned by the backend, no token argument, readiness HTTP 200.
- The user confirmed the admin loaded without a certificate error on a phone with Wi-Fi and
  Tailscale disabled. Login succeeded, and a light-state change made from another client appeared
  without refreshing the page. This confirms public cellular access and live application updates.

CLI HTTP/WebSocket checks used an authoritative-verified Cloudflare edge address while the Mac's
system resolver retained the earlier negative DNS response; URL, Host, SNI and default certificate
verification were preserved. The public browser and phone checks used the hostname normally.
Cloudflare rejected Python's default user agent, so the HTTP harness identified itself explicitly
as `SmartPanel-Acceptance/1.0`. An initial lifecycle harness request incorrectly combined an empty
POST body with JSON Content-Type; the corrected request used a separate receipt after confirming
the connector had not changed. These harness/environment findings are not application failures.

R5 remains open. Token replacement/removal, invalid-token behavior, reset, process-crash/network
recovery, stop/config races, reboot, connected-provider upgrade, client-address policy and the
remaining installation matrix are **not established by this run**. No token was reset, and no
Cloudflare work contacted or changed Pi 4; its natural Tailscale key-expiry acceptance stays separate.

### R5 staging crash and reboot acceptance (2026-10-08)

Following [PR #1367](https://github.com/FastyBird/smart-panel/pull/1367), the same staging Pi 5
on alpha.53 passed controlled process-crash and normal System-module reboot acceptance:

- One SIGKILL targeted the verified backend-owned cloudflared child using a Linux pidfd, after
  checking its PID, start time, executable, parent and unprivileged UID. The provider reported
  `error` and withdrew its endpoints, proxy contributions and public URL. Its background poller
  started one replacement child and restored `connected` with four ready connections and real
  public HTTPS. The backend identity and configuration were unchanged; no manual restart was used.
- One reboot command was sent through the normal authenticated System-module WebSocket action.
  The acknowledgement was lost during shutdown, so the command was not resent. A changed boot ID
  proved the reboot. Healthy public HTTPS was observed about 65 seconds after submission; this is
  an observation bound, not a measurement of exact outage duration.
- After reboot, the provider automatically reconnected with one unprivileged backend-owned child.
  Cloudflare configuration, including the persisted token, was unchanged. Database integrity,
  schema, migrations, device topology, accounts and long-lived tokens matched the baseline.
  Tailscale retained its identity and connected automatically.
- Public owner login/profile and valid-token Socket.IO passed again; anonymous protected API
  requests and missing/invalid WebSocket tokens were rejected. These checks, and a pre-crash
  baseline, used normal hostname resolution and certificate validation without a DNS override.

The initial crash harness attempt failed before signaling: a read-only audit confirmed the original
child identity was intact and the remote receipt written before any signal did not exist. A separate
attempt retained SSH diagnostics and completed the single verified signal. The original evidence was
kept. After reboot, the Mac's local SSH forwarding session was re-established for observation; no
application service was manually restarted.

R5 and the epic remain open. Token replacement/removal, invalid-token behavior, reset, network
outage/recovery, stop/config races, connected-provider upgrade, client-address policy and the
remaining installation matrix are still pending. Pi 4 was not contacted or changed.

### R5 staging token removal and reset acceptance (2026-10-08)

On the same alpha.53 Pi 5, a root-only checkpoint preserved the existing token, hostname, protocol
and enabled setting before testing. The checkpoint stayed on the Pi; mutations and restoration used
the normal authenticated API. The worker included a standalone recovery path and did not retry an
ambiguous mutation blindly.

- Replacing the token with a deliberately malformed nonempty value produced provider `error`,
  terminated the previous child and withdrew endpoints, proxy contributions and the public URL.
  The configured marker remained true because a value was stored. Restoring the original token
  reconnected the provider.
- Explicit `null` removal cleared the stored token while preserving the hostname. The configured
  marker and token requirement became false, with `setup-required`, no child and no endpoint/proxy
  contributions. The worker sampled this condition continuously for more than 35 seconds before
  restoring the original token and observing reconnection.
- Plugin reset cleared both the token and hostname while preserving the enabled and Auto settings.
  It also held `setup-required`, no child and no endpoint/proxy contributions for more than 35 seconds.
  This checks process and reachability withdrawal; it does not require the generic managed-service
  state itself to be `stopped` when an enabled plugin lacks prerequisites.
- Each restoration was checked against the private persisted fields. Final public HTTPS, owner
  login/profile and WebSocket authentication checks passed using normal DNS and certificate
  validation. API readback checks rejected secret fields/values throughout the matrix; the original
  token was absent from the backend journal covering this test interval.

These tests replace a valid token with a malformed value and then restore it; rotation to a different
valid token or revocation of a well-formed token is not established. R5 remains open for those cases,
network outage/recovery, stop/config races, connected-provider upgrade, client-address policy and the
remaining installation matrix. Pi 4 and its Tailscale expiry test were untouched.

### R5 staging client-address and throttle acceptance (2026-10-08)

The alpha.53 staging Pi 5 public hostname passed an additional bounded client-policy check.
Display registration status reported closed with permit-join inactive, both normally and with
individually supplied loopback `X-Forwarded-For` or `X-Real-IP` headers. A forged
`CF-Connecting-IP` request received HTTP 403 at the edge; that result does not establish how the
backend would handle that header if it reached the origin.

Seven login attempts used a unique nonexistent test username. The first five returned 404 and the
last two returned 429. Forging `X-Forwarded-For` on the second and seventh requests neither changed
the recorded client nor bypassed the limit. The backend notification's client address matched the
address reported by Cloudflare's trace endpoint, rather than loopback. A local owner login still
worked while the public client was throttled, demonstrating separate peer budgets for these paths.
After the retry interval, public owner login and authenticated WebSocket checks passed again.

The initial combined-header probe stopped at the edge's 403 before sending the invalid-user login
sequence. Subsequent checks isolated the headers, preserving the original observation. Registration
status was tested; no display was registered. This is an HTTP client-address/throttle result, not
a separate assertion of WebSocket client-address resolution or every registration-policy branch.

### R5 staging stop/config overlap acceptance (2026-10-08)

Four finite alpha.53 Pi 5 cases overlapped a protocol change from Auto to HTTP/2 with either manual
Stop or `enabled: false`, in both invocation orders. The recorded HTTP intervals overlapped by
approximately 92–162 ms. This establishes overlapping requests on this hardware, not a controlled
backend coroutine schedule or exhaustive race coverage.

Manual Stop does not persist a desired-state override: an enabled plugin still desires `started`,
and asynchronous config reconciliation can restart it. Both stop/protocol cases settled connected.
In the config-first case, Stop returned the existing HTTP 400 rejection while the config transition
owned the lifecycle; the rejection was recorded and not silently retried. After each overlap settled,
a distinct final Stop held the provider withdrawn with no child for more than 38 seconds.

Both disable/protocol cases preserved `enabled: false`, HTTP/2 and desired state `stopped`; the child,
endpoints, proxy contributions and public URL remained absent for more than 39 seconds. No sample
contained more than one cloudflared child. Each case restored Enabled and Auto through the normal
API, preserving the omitted token, and observed one unprivileged backend-owned child connected for
more than 10 seconds. Process inventories and API snapshots were sequential samples, not atomic
proof against every transient state. No backend modification or restart was used for this matrix.

### R5 staging transport-outage acceptance (2026-10-08)

The same alpha.53 Pi 5 passed short and sustained Cloudflare transport outages. Before each run,
fresh process and socket identities plus a header-only packet observation confirmed cloudflared's
UDP egress to port 7844. This matches Cloudflare's documented
[QUIC/HTTP/2 transport ports](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/tunnel-with-firewall/).
The test added a dedicated temporary nftables table blocking UID 994's TCP/UDP destination port
7844 outside loopback. This was a transport-specific rule, not PID isolation or physical link loss.
An independent 180-second systemd cleanup timer was armed before insertion; normal cleanup removed
only the test table and then stopped its timer. Existing firewall tables were preserved.

Both runs recorded dropped packets, `/ready` HTTP 503, provider `error`, absent endpoints/proxy
contributions/public URL, and a failed real public health request. The managed service remained
started with desired state started. The sustained run held this withdrawn condition across seven
successful observations spanning more than 36 seconds, beyond the 30-second stable polling interval.
No sampled address revival or observation gap occurred during that hold.

Removing the test rule restored the connection automatically with the same backend and cloudflared
identities. Public HTTPS recovery was checked independently: in the short run, edge readiness became
connected before the public health request recovered from 502 to 200. Public owner login and valid,
missing and invalid WebSocket-token checks passed again after the sustained run, using normal DNS
and certificate validation. The final test table was absent, its timer inactive and readiness HTTP 200.
Configuration, database schema/migrations, topology, accounts and long-lived tokens matched the
pre-matrix baseline, and no backend restart occurred.

Local API/SSH access remained available. Pi-side Tailscale identity and Running/Online state matched
before, during and after the outages. The Mac could not resolve the Tailscale hostname at baseline,
so this run does not claim a fresh end-to-end tailnet connection check. Pi 4 was not contacted.

An initial preflight filtered out the backend because its process name differed from `node`; it
stopped before packet capture or any firewall mutation. The corrected inventory identifies it by
systemd MainPID and executable. Socket output is complete or rejected, never silently truncated.
These preparation findings and the original receipts were retained separately from the successful
network runs.

R5 remains open for connected-provider application upgrade, rotation to a different valid token and
well-formed-token revocation, and the remaining installation matrix. The recorded overlap and
transport tests are bounded cases; physical network loss and exhaustive race schedules are not
claimed. WebSocket client-address policy remains distinct from its verified authentication behavior.

### R5 WebSocket client address and registration enforcement (2026-10-08)

Staging Pi 5 (`192.168.2.22`) on published alpha.53 passed a separate client-address check through
`https://panel-test.zbysov.app`, using system DNS and default certificate validation. An authenticated
owner observer subscribed to the normal WebSocket exchange and received the subscription acknowledgement.
Four independent probe connections exercised no extra forwarding headers, forged
`X-Forwarded-For: 127.0.0.1`, forged `X-Real-IP: 127.0.0.1`, and both forged headers together.

For every probe, the observer matched the connected and disconnected events to that socket's ID.
Both events reported the actual public client address from Cloudflare's `/cdn-cgi/trace`, which stayed
stable before and after the matrix; neither event reported loopback. Tokens stayed in memory and
receipts retained boolean comparisons rather than token values, user payloads or client addresses.
The Cloudflare configuration and connector ID matched before and after the test. No display entity,
runtime instrumentation or provider lifecycle change was needed. This verifies address resolution
for WebSocket handshakes and disconnects; it does not claim WebSocket throttling or a persisted
authentication-failure audit. The gateway explicitly skips throttling, so the earlier HTTP limits
remain separate evidence.

The public registration policy was then exercised with actual unauthenticated `POST` requests, using
valid display registration bodies, a recognized display user agent and unique synthetic MAC addresses.
With public registration closed, the same four header variants each returned application JSON HTTP 403
with the registration-policy denial message. Thus the denial came from the application rather than
an edge HTML response. The two existing display IDs were preserved, public pairing remained closed,
and no test display was created or needed cleanup. This extends the earlier registration-status GET
evidence to enforcement on the registration operation.

An initial registration harness preflight incorrectly expected direct-loopback registration status
to be closed. It stopped before any registration POST: direct localhost registration is intentionally
allowed. The corrected, separately retained attempt checks public registration status before each
request. This was a harness correction, not an application defect.

Private evidence is retained under `cloudflare-alpha53-ws-policy/` (`result.json`, `complete.json`,
and `registration-r2/registration-result.json`). Pi 4 was untouched. R5 remains open for connected-provider
application upgrade, distinct valid-token rotation/revocation and the remaining installation matrix;
these client-policy checks do not complete those gates.

### R5 valid-token rotation and revocation acceptance (2026-10-08)

Staging Pi 5 on alpha.53 passed rotation of the dedicated `smart-panel-staging` tunnel token.
The operator rotated the token in Cloudflare, then one accepted Extensions restart forced a new
connection attempt with the still-stored original token. A Pi-side comparison confirmed that the
stored token still matched the retained original and identified the expected tunnel. Neither token
values nor token digests left the Pi during these comparisons.

The provider settled in `error`, with endpoints, proxy contributions and the public URL withdrawn.
Seven read-only observations spanning more than 42 seconds retained this state and returned public
HTTP 530. The backend remained running, desired service state remained started, and the original
pre-restart child did not reappear. This verifies loss of connectivity with the revoked, well-formed
token after restart; it does not assert that rotation immediately terminates existing connections.

The operator pasted the replacement token into the normal plugin configuration UI and saved it.
A second Pi-side comparison confirmed a different token for the same tunnel, with Enabled, Auto
and the public hostname preserved. Three observations spanning more than 14 seconds showed connected
state, restored endpoint/proxy contributions, one unprivileged backend-owned cloudflared child and
public health HTTP 200. The backend process was unchanged, and no `--token` argument was present in
the child's command line. Subsequent checks using system DNS and default certificate validation passed admin HTML,
owner login/profile, public/local provider agreement and authenticated WebSocket connection. Missing
and invalid WebSocket tokens were rejected; protected anonymous HTTP routes returned 401.

The original rejection harness stopped on an HTTP error whose status was not retained. Its oracle
also independently had an incompatible timing budget: a 60-second readiness grace followed by a
required hold exceeding 38 seconds cannot fit into its 90-second deadline. That attempt remains
recorded as failed. Separate bounded read-only observations established withdrawal and recovery
without repeating the restart. No original-deadline guarantee is claimed. A journal probe returned
zero entries, so this run establishes neither a specific authentication-error log nor journal secret
redaction. These are harness/evidence limitations, not a demonstrated application defect.

Private evidence is retained under `cloudflare-alpha53-token-rotation/`, including the failed attempt,
separate observation results and boolean token comparisons; public checks are in
`cloudflare-alpha53-acceptance/post-token-rotation-natural-dns.external.json`. The earlier private
token-matrix checkpoint now contains a revoked token and must not be used to restore configuration.
Pi 4 was not contacted. Rotation/revocation is now covered; R5 remains open for connected-provider
application upgrade and the remaining installation matrix. The latest available release is still
alpha.53, so this run does not claim another upgrade.

### R3 implementation verification (2026-10-04)

- Mounted provider cards exercise real stores and backend-shaped envelopes for stopped and
  already-started Connect → Disconnect → Connect, lost operation events, initial GET failure,
  role restrictions, busy cancellation and API error recovery. Final card rerun: 41 tests passed.
- Setup reconciliation and mounted wizards: 118 targeted tests passed. Accepted setup without
  websocket events and the stale terminal job failed before the fix. Coverage includes a second
  job, reload with preloaded completion, transient reads, backend restart, timeout, unmount and
  authenticated manual adoption. Manual Re-check requests an authoritative refresh.
- Cloudflare reset now supplies the existing required `privileged_setup` response field: the
  regression failed before the fix; 10 controller tests and 21 provider HTTP tests passed.
- Shared per-store status reconciliation keeps one watcher and timer for the card and wizard;
  regression coverage includes staggered subscribers, disposal and initial-read recovery.
  Final remote-access admin rerun after review fixes: 35 files / 539 tests passed.
- Admin/backend TypeScript, affected-file ESLint/Prettier and backend API conventions passed.
- Full admin suite: 380 files / 3,235 tests passed before the final review regressions.
  Full backend suite: 583 suites / 9,180 tests passed (one skipped); E2E: 23 suites / 266 tests passed.
- No real-device, external-hostname, process-crash, reboot or upgrade acceptance is claimed here.

### R1 implementation verification (2026-10-04)

- Backend remote-access providers/module and Extensions manager: **36 suites / 675 tests passed**.
- Remote-access HTTP integration: **3 suites / 84 tests passed**; admin remote-access: **29 files / 444 tests passed**.
- Backend TypeScript, admin type checking, changed-source lint/format, API conventions and generated
  OpenAPI/client types passed. Missing generated device specs were generated before admin type checking.
- Controlled tests cover late reads across stop/start and logout, cancelled interactive/keyed login,
  key-file cleanup, process closure/escalation, retained authentication and superseded setup completion.
- Device networking was not exercised; R4 remains open.

### Docker acceptance regression (2026-10-07)

The released alpha.49 ARM64 container failed before migrations because the runtime flattened pnpm
workspace links and omitted the extension SDK. Local candidate validation restored the workspace
layout, set the Docker platform and corrected an IPv6 `localhost` healthcheck failure. Normal startup,
fresh onboarding, admin assets, unsupported Tailscale/setup refusal and persisted manual URL behavior
passed in an isolated Compose deployment. Direct navigation also required a documentation-link
fallback from the platform requirement when extension metadata was absent.

The Docker release job now requires a real runtime smoke before publishing the manifest. Published
alpha.50 (`afbe3649cb531975584939f9aba4009a16b09bd7`, #1229) passed that smoke on native ARM64 and
AMD64 runners. Independent verification of the published ARM64 digest on the Mac passed fresh Compose
startup/onboarding, the unsupported Tailscale card with documentation, setup refusal and manual URL
configuration/reachability/persistence. The Docker checklist row is complete. Home Assistant and the
remaining R4 gates are still open; this loopback-only Docker test does not certify public internet/TLS
or Raspberry Pi images. See the epic's verification section for exact digests and evidence boundaries.

### Clean host installer regression (2026-10-07)

A clean Bookworm Pi 4 installed the published alpha.49 npm packages through `install-server.sh` and
passed onboarding and the sudo probe. Real Tailscale UI setup nevertheless failed: its scope inherited
`ProtectSystem=strict`, preventing writes to the apt keyring. Setup now selects an independent
transient service through the existing privileged worker. The equivalent on-device candidate installed
Tailscale from apt, restored progress after a page reload and satisfied all prerequisites without
loosening backend hardening. Three focused suites passed 102 tests, including the service launch
contract and existing worker lifecycle coverage. The candidate was restored to the original release
before testing the npm updater. The actual System UI upgrade from alpha.49 to published alpha.50
then passed, preserving the owner, authenticated session and plugin configuration. Published-release
fresh-package setup acceptance remains pending; see the epic verification section for timestamps
and evidence boundaries.

### Published host setup verification (2026-10-07)

Published alpha.51 contains #1231 and passed fresh-package setup on the clean-OS installer Pi 4.
The package, apt source and keyring were removed while signed out; System then upgraded the host
from alpha.50 to alpha.51 through the npm worker. The real setup wizard installed Tailscale from apt,
restored progress across a full-page reload and advanced to Sign in. Status-file sampling captured
install, daemon, operator and completion; live UI events exposed installation and completion, while
the subsecond intermediate steps were not individually rendered. All five prerequisites and host
checks passed with backend hardening retained. Functional setup and host-installer/updater rows are
complete. The original every-step live-reporting requirement remains separately unchecked because
status-file sampling does not establish UI visibility. Expiry, fallback and other R4 gaps remain. See the epic for
release provenance, timestamps and the distinction between status samples and rendered progress.

### R4 natural node-key expiry and reauthentication (2026-10-08)

The clean installer Pi 4 on published alpha.51/Tailscale 1.102.5 completed the pending one-day
node-key expiry test. The earlier `key-expiring` warning matched the natural expiry at 11:25:29 UTC.
After expiry, CLI reported NeedsLogin; API/UI required sign-in and withdrew all provider endpoints,
proxy contributions and aggregate external/primary URLs. Tailnet peer HTTPS and both HTTP alternatives
timed out while LAN access remained available. The CLI's cached Self.Online value alone was not used
as proof of connectivity.

The normal wizard supplied a fresh link and QR with pending-auth/no-store. The operator confirmed
approval on a computer, so the phone-approval case remains unverified. Approval advanced
the existing UI through Options and Done without a page reload or backend restart. The card and API
became connected/authenticated, HTTPS became primary again and the new key expires on April 6, 2027,
consistent with the restored 180-day default. Certificate-verified peer HTTPS, owner login/profile and
WebSocket-only exchange subscription passed; missing/invalid socket credentials and anonymous HTTP
access were rejected. Peer registration status remained closed on HTTPS and both HTTP alternatives.

A subsequent 623.8-second idle observation passed with the test admin tab closed. Service identities
and restart counters, one process per service, and the Serve configuration matched at both boundaries.
No retained management subprocess was observed. A readable retained journal cursor covered 33 entries
without matching management-denial, Serve-change/error, lifecycle or fatal-error patterns. Tailscale
remained Running/online at the boundaries. This is bounded evidence, not continuous process sampling
or proof against unlogged transitions; service-user status access is distinct from mutation permission.

The epic records the detailed evidence and preserved harness failures. Its short-expiry/reauthentication
row is now complete. These Pi 5 peer checks do not establish phone-specific traffic, nor do they complete
the remaining R4/epic gates. Private receipts are in
`remote-access-r4/host-install-acceptance/node-expiry-2026-10-08/`.

### R4 alpha.53 continuation and remaining work (2026-10-08)

The installer Pi 4 passed a normal alpha.51 → alpha.53 System UI update while connected to Tailscale.
The independent updater survived application shutdown; the existing admin session observed completion.
Official npm SRI and all installed wrapper/backend/admin artifact files matched. Database/configuration,
accounts and Tailscale identity/authentication were retained, and peer HTTPS/login/WebSocket recovered.

A real setup rerun after temporarily stopping the daemon exercised published #1233 without purging the
package or signing out. All three completed setup rows remained rendered in Options and Done. Waiting
and Complete were observed; individual transient Running stages were not. The timer-backed daemon
recovery path was cleaned up after successful UI setup. The epic records exact counts, times and scope.

The auth acceptance wording now follows the original design's approval on any device. The confirmed
computer approval is sufficient for the interactive authentication row; it does not claim phone QR
scanning. This does not change the separate cellular-access criterion.

The HTTPS-disabled advisory still needs a clickable console URL in the released UI. The accompanying
admin fix adds that link with a failing-then-passing component regression; alpha.53 hardware results
do not include this unshipped change. The earlier disabled/restored HTTPS functional observations are
retained, so repeat only the missing released-link observation when a suitable test window is available.

R4 is still open. Remaining work includes the `--with-tailscale` installer variant, manual adoption and
preference-conflict paths, adverse/pending authentication and pending-login upgrade, the unobserved
live setup stages and relevant transport-loss variants. The one-candidate acceptance requirement has
not been silently waived: these historical results identify their own release and are not relabelled
as a complete alpha.53 matrix. R5 still needs connected-provider upgrade and its remaining installation
variants; a new Cloudflare upgrade cannot be recorded while alpha.53 is the latest published release.

### R4 manual adoption failure and source correction (2026-10-08)

Published alpha.53 on the installer Pi 4 failed to adopt a manually connected node with an unmanaged
non-default `--snat-subnet-routes=false` preference (no advertised routes). The plugin's full `up`
flags triggered Tailscale 1.102.5's omitted-preference refusal; the UI showed Error and withdrew URLs,
while authentication and the preference were preserved. The gate returns to the owning backend
regression; this scenario is not marked passed.

The correction uses flagless `up` only after a fresh preference read establishes that configured
tags and login server already match. Other cases retain the conservative flagged attempt with no
reset/retry. All 432 plugin tests passed; the equivalent CLI sequence preserved the preference and
identity on both stopped and running nodes. The application candidate is not installed on the Pi.
The test preference was restored, normal UI Connect and peer HTTPS/login/WebSocket recovered, and
the recovery timers were removed from active use.

The test also exposed a short-viewport layout defect: long address lists left zero height for provider
controls. The admin correction uses one outer scrolling region instead of collapsing the tabs.
Both fixes require released runtime verification. The epic retains the detailed reproduction and
evidence boundaries; remaining R4/R5 gates are unchanged.

### Automated evidence from this analysis

- Backend: **32 suites / 614 tests passed** in the module and both providers.
- Admin: **29 files / 444 tests passed** in the same scope after installing dependencies and generating
  the OpenAPI specification/types. The first attempts could not load missing generated types; those
  were environment preparation failures, not provider test failures.
- Additional diagnostic reproductions: **five backend and three admin assertions failed in the
  expected way**, demonstrating gaps in the green baseline. They were run against actual services/
  stores with fake CLI/HTTP boundaries. Temporary specs and logs were archived outside the checkout;
  no deliberately failing suite or implementation change is included in this documentation change.

Reproduction recipes for the implementation regressions:

| ID  | Arrange / interleave                                                                | Required invariant (currently fails)                    |
| --- | ----------------------------------------------------------------------------------- | ------------------------------------------------------- |
| D1  | Authenticated running node; start, observe, stop, observe                           | Authentication remains known so the card offers Connect |
| D2  | Suspend `serve.read` inside `computeStatus`; stop; release read                     | Obsolete read cannot report current Connected           |
| D3  | Suspend `serve.converge` in `pollTick`; stop; release convergence                   | Final accepted event stays Disconnected                 |
| D4  | Suspend aggregate provider GET; receive newer Disconnected; resolve older Connected | Backend cache retains the newer state                   |
| D5  | Interactive login returns URL; stop the real node service with a fake child         | Child is cancelled and login no longer pending          |
| D6  | Tailscale store GET in flight; newer Disconnected event; older GET completes        | Admin remains Disconnected                              |
| D7  | Same schedule as D6 in Cloudflare store                                             | Admin remains Disconnected                              |
| D8  | Tailscale install accepted with job ID; no progress events; advance ten seconds     | Status reconciliation has started                       |

Baseline commands:

```sh
pnpm --filter @fastybird/smart-panel-backend exec jest --runInBand --silent --testPathPatterns='(modules/remote-access|plugins/remote-access-tailscale|plugins/remote-access-cloudflare-tunnel)/'
pnpm run generate:openapi
pnpm --filter @fastybird/smart-panel-admin exec vitest run src/modules/remote-access src/plugins/remote-access-tailscale src/plugins/remote-access-cloudflare-tunnel --maxWorkers=2
```

Implementation validation also covers production exception filters/permissions, config transitions,
real mounted cards/wizards, CLI fixtures from the minimum supported and installed versions, lint/type
checks and generated API validation. Changes to shared Extensions, proxy or worker code run their
affected suites. Use the current CI result as evidence; #1040/#1045 are closed after the October audit,
so the old blanket instruction to rerun failures as known flakes is obsolete.

### Tailscale gate R4 / #910

Record release + commit, OS/image or npm-install path, Tailscale version, timestamp, initial plugin/
lifecycle/auth state, action, observed CLI/API/UI result, actual reachability and redacted logs for each
row. Establish LAN/console recovery access before tests that disconnect remote access.

1. Fresh image and npm install without Tailscale; privileged and manual setup; missing operator,
   inactive daemon, unsupported platform and unavailable helper all have accurate remedies.
2. Existing manually authenticated node is adopted without needless logout or loss of unmanaged
   preferences. Verify compatible `up` flags and recovery from preference mismatch on actual CLI versions.
3. Interactive link/QR and auth-key login: success, invalid/expired key, late failure, device approval,
   cancellation, reload and timeout. No key/auth URL in logs or shared events.
4. At least 20 Connect→Disconnect→Connect cycles, including concurrent status requests and rapid actions.
   Compare CLI, card, Extensions service, aggregate URLs and actual reachability after each completion.
5. Disable/re-enable from plugin configuration; explicit Disconnect versus restart semantics; reboot;
   logout; factory reset; pending login plus disable/shutdown. No stale Connected or revived operation.
6. Lost websocket before setup acceptance, during progress and at completion; second install after a
   terminal job; disconnected/reconnected browser; slow CLI and network outage/recovery. No stuck busy
   control or need to reload. Check defined deadlines and lack of overlapping status work.
7. Serve HTTPS from a phone on cellular, admin login and websocket changes; Funnel opt-in and removal;
   SSH opt-in; correct remote client address and registration/throttle policy. Separate transport health
   from origin reachability. Verify endpoint/proxy removal after stop and config changes.
8. Key expiry/reauthentication and ten-minute idle observation: no repeated management denial, Serve
   mutation spam, unexpected reconnect or unbounded process growth.
9. Normal system-module application upgrade while provider is enabled and while login is pending;
   shutdown completes, updater survives, application and provider recover. Repeat after helper migration.

Cloudflare records an equivalent provider-specific matrix: image/npm/manual install, token configure/
replace/remove without disclosure, public-hostname routing, websocket/client address, process crash,
bad token, network outage, stop/config race, reboot, reset and upgrade. WireGuard records peer config,
handshake freshness, idle traffic, network recovery, reboot, stop/reset, route containment and secrets.

Unperformed rows remain **not tested**, with their prerequisites named. A green unit suite or merged
provider PR does not substitute for these gates. Epic closure requires all three milestone gates;
deferring WireGuard/helper would require an explicit scope decision, not an implicit checkbox change.

## 7. External contract checks

- [Tailscale CLI reference](https://tailscale.com/docs/reference/tailscale-cli): `down` disconnects;
  reconnect uses `up`. `set` updates selected preferences, while `up` has different flag semantics.
  This supports separating disconnect from logout and testing adoption of existing nodes.
- [Cloudflare readiness implementation](https://github.com/cloudflare/cloudflared/blob/master/metrics/readiness.go):
  readiness is based on active edge connections. It does not verify this application's public route.
  These upstream references were checked during the analysis; pin CLI fixture provenance to the
  actual tested release during implementation instead of relying on a moving upstream branch.
