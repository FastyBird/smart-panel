# Remote access: fresh analysis and completion plan

Date: 2026-10-03. Status: proposed, implementation not started.
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

This plan supersedes the execution order in the September plan and #991 **once adopted**. The original
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

## 6. Verification and completion evidence

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
