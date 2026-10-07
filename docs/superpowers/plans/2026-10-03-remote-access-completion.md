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
| R8    | Epic close-out and documentation reconciliation                                                                                                     | R1–R7 gates recorded, docs reflect shipped contracts, #910/#914/#913 and coordination completed, no unchecked mandatory acceptance silently waived                                                             |

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
