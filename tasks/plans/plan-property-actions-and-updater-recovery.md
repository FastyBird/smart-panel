# Property actions and updater recovery: fresh assessment and completion plan

**Date:** 2026-09-27

**Status:** residual HomeKit fixes deployed; live latency failures reproduced; SQLite value-path regression identified; runtime ownership decision pending

**Reviewed revision:** `aa98d2c34000f76c538d877fa573bf98bfa174b4` (`1.1.0-alpha.23`), also GitHub `main` at review time

**Scope:** Property-command latency and convergence, System image updates, related validation and release work

## Recommendation

Keep the command-window convergence semantics. Restore the intended separation between the SQLite metadata catalog and the memory/InfluxDB value path before collecting acceptance timings. Separate three deliverables: responsive and truthful controls, a reproducible staging installation, and a repeatable normal System-module upgrade. Give release/CI work its own completion criteria.

**Owner clarification, 2026-09-27:** The existing Raspberry Pi is staging and may be overwritten as needed. A second SD card/RPi is therefore not required. Preserve the useful failure evidence and representative configuration, then rebuild this staging installation directly from the verified candidate. Repairing the old installation in place is no longer on the critical path. Backend integration and updater compatibility tests can also run on disposable infrastructure. Fresh-install results remain separate from upgrade acceptance and require representative load before qualifying as performance evidence.

This document proposes a replacement execution plan incorporating the owner's authorization to overwrite staging. It does not change existing timing limits or weaken the updater's safety contracts for installations upgraded in place. Record the staging-reset decision in the issue ledger when implementing the plan; the old private recovery packet is no longer a prerequisite for this reset. The new issue organization and diagnostic lifecycle described below remain proposals. The local P1 implementation and validation are recorded below; no GitHub issues or release have been changed. Staging reads and a private evidence snapshot are recorded below.

## What the evidence establishes

| Finding | Evidence and qualification |
| --- | --- |
| Original flicker had a backend cause | [#1006](https://github.com/FastyBird/smart-panel/issues/1006), using [#1007](https://github.com/FastyBird/smart-panel/issues/1007), records Shelly notifications arriving within 30–90 ms of RPC, then waiting behind 54/102 other property updates. A previous tap's confirmation arrived after the next tap. These are historical observations, not new measurements. |
| The old write path amplified polling bursts | The original investigation found process-wide exclusive serialization and repeated entity/value loads. Current `ChannelsPropertiesService.updateValueOnly()` instead uses shared structural admission, per-property coordination, one entity load, and minimal producer DTOs. Structural changes retain exclusive protection. |
| Core fixes are present | Canonical source command windows, previous-command carry-forward, generation-scoped failure handling, stale-report suppression, PATCH compensation, HomeKit pending cache, and Shelly poll coalescing/fencing exist in the reviewed tree. The related issues being closed is not the sole basis for this finding. |
| Hardware acceptance remains incomplete | [#1032](https://github.com/FastyBird/smart-panel/issues/1032) still lacks the comparable 20 idle + 20 actual-overlap matrix and full client/recovery evidence. Its three isolated alpha.11 server spans are not a statistical result; the separate 4347.625 ms restoration remains unresolved against its applicable budget. |
| Some later failures belong to measurement tools | [#1052](https://github.com/FastyBird/smart-panel/issues/1052) distinguishes a ValueState/boolean parser defect, false-valued baseline rejection, missing exports/correlation, and collector defects. These do not retrospectively explain the original uncorrelated timeout. Its original cause is recorded as irrecoverably underdetermined. |
| Updater failure is a separate lifecycle problem | [#1093](https://github.com/FastyBird/smart-panel/issues/1093) records the TypeORM transaction-mode incompatibility, old-worker execution, stop/quiescence failures, startup/health deadlock and recovery holds. Command-window changes are not established as their cause. |
| Current deployment blocker is narrower than the issue history | The latest #1093 description and [re-review](https://github.com/FastyBird/smart-panel/issues/1093#issuecomment-5840370271) identify two private recovery-tool defects: inexact cgroup membership and late verification of original lock identity. Alpha.23 publication and isolated published-byte replay are already recorded as passing. |
| Live staging was rebuilt during this review | The original alpha.18 installation and its failed updater metadata were archived. The unpublished candidate `1.1.0-alpha.23+review.212840af2` runs with preserved database/configuration/pairing and a fresh runtime directory. This is maintenance deployment, not ordinary updater acceptance. |
| CI and release issues have different outcomes | [#1040](https://github.com/FastyBird/smart-panel/issues/1040)/[#1045](https://github.com/FastyBird/smart-panel/issues/1045) own CI stability and recounting. [#1110](https://github.com/FastyBird/smart-panel/issues/1110) owns npm visibility/release reconciliation; its comments record successful alpha.22 artifact reconciliation and separate Docker recovery under closed #1114. Neither proves device installation. |

## Why the work stopped converging

1. **Implementation, instrumentation, installation and product acceptance became one serial chain.** A problem in a diagnostic launcher or the old installer prevented evaluating already-merged control fixes.
2. **The test infrastructure accumulated its own defects.** Private parsers, launchers, selectors, recovery packets and cleanup code required repeated repair. Passing source-function checks did not prove the real caller, SSH, systemd and service-user boundaries.
3. **A release cannot repair the worker that is already running.** The System executor launches its installed `dist/.../update-worker.sh`. Publishing a fixed target does not replace that old launcher for the first upgrade. This explains the need to distinguish one-time legacy recovery from ordinary subsequent updates.
4. **The diagnostic start conditions can make the test impossible.** #1033/#1077 retain a run where the target appeared after 260.951 seconds and a required later slot fell at 364.951 seconds, beyond the 360-second placement session. Repeating that startup sequence or extending product TTLs does not answer the latency question.
5. **Evidence ownership is too repetitive.** Long current/historical instructions across #1006/#1033/#1032/#1052/#1093 obscure which failures are unresolved, which are already classified, and which results can be reused.

The safety checks are not the underlying problem. They found real faults. The remedy is a smaller reproducible workflow and separate exit criteria, rather than removing ownership, database, or health checks.

## Product contracts to preserve

- Platform acceptance, device confirmation, and the displayed optimistic value are different facts. An accepted command alone does not confirm hardware state.
- Source and virtual aliases share one command generation. An earlier command's completion or failure cannot undo a later command, including A→B→A.
- Suppressed stale reports do not enter accepted current state, history, or client broadcasts. Failure/expiry reconciles through the existing guarded path.
- The current 1500 ms confirmation grace and platform TTLs are bounded heuristics. For a boolean, an old `false` report and a genuine external `false` change can be indistinguishable without causal provider metadata. Test and document delayed reconciliation; do not promise perfect causal classification.
- Keep Homey's authoritative-readback behavior and all existing permission, lifecycle and persistence boundaries.
- Preserve the approved server span limits: p95 <800 ms and every sample <3000 ms, with 20 idle and 20 actual-poll-overlap samples, zero timeouts and the existing 5000 ms client convergence bound. Do not mix clocks or label an absent event as a measured duration.
- Also report command acknowledgement, provider receipt, source publication, client receipt and visible/physical response separately. The server write span excludes time before `update()` and cannot alone establish that a tap feels fast. Before final sampling, record an explicit user-facing latency target; the 5000 ms failure bound must not become the UX goal by accident.

## Work packages and exit criteria

### P0 — One current inventory and a frozen candidate

**Owner:** #1033; evidence index in #1032.

- [x] Read the named issues, relevant linked follow-ups, current handoffs and source boundaries; verify local revision against GitHub main.
- [x] Separate established failures, retained historical uncertainty, implemented fixes and missing acceptance evidence.
- [ ] Replace repeated next-step prose with one short status table: work package, candidate version/hash, next action, evidence link, exit criterion.
- [x] Pin alpha.23 as the initial candidate because its publication/replay already passed; change it only for a demonstrated defect. Keep the existing installation's exact state as a separate inventory.
- [x] Confirm the hardware disposition: the existing Raspberry Pi is overwriteable staging; use it sequentially for clean-install and upgrade scenarios.
- [ ] Record the UX latency target and representative device/load configuration before collecting final results.

**Exit:** One reproducible candidate and three explicit outcomes: property behavior, repeatable staging setup, normal upgrade. Missing original historical measurements stay marked missing.

### P1 — Verify the complete property path without waiting for recovery

**Owner:** #1032, with focused fixes only for reproduced product defects.

Use the existing convergence and owning component suites. The current `property-command-convergence.integration.spec.ts` combines real command/window/property/projection/HAP components but substitutes storage/repositories and platform behavior. It is useful coverage, not proof of a complete authenticated route with real SQLite.

- [ ] Map existing tests to the cases below and add only missing integration coverage using real disposable SQLite and controlled provider I/O.
- [x] Exercise the real HomeKit dispatcher, virtual forwarding, SQLite catalog/leases, property-value service, production memory-storage fallback and HAP notifications together; cover rapid ON/OFF/ON, refusal, provider exception, older failure after newer confirmation and unchanged-report reconciliation.
- [ ] Exercise direct source and virtual aliases through actual command entry points; include REST PATCH and rejected/unauthorized input. Verify REST state, WebSocket events, HAP cache/notifications and source history together.
- [ ] Cover delayed previous-command readback, confirmation followed by stale readback, A→B→A, repeated same-value commands, two aliases, rejected dispatch, missing confirmation, external change, expiry and structural deletion/remap.
- [ ] Drive real Shelly poll admission/drain and notification fencing with deterministic interleavings. Confirm writes to another property can proceed while one is held and that deletions cannot recreate orphan history.
- [ ] Run the collector/observer on the same fixture, including false values, invalid/missing acknowledgement, timeout, export failure and restoration correlation. A diagnostic failure must be distinguishable from a product failure.

**Exit:** One repeatable command produces an integrated report with no stale accepted event and correct failure reconciliation. All identified product regressions have focused tests. This work requires neither release publication nor a live updater operation.

#### P1 local result — 2026-09-27

The initial targeted baseline passed **123 tests / 8 suites** after installing the locked backend dependencies, building the extension SDK and generating the backend specs with the existing generator.

The new `apps/backend/src/plugins/devices-homekit/services/homekit-command-convergence.integration.spec.ts` exposed an independently reproduced residual defect: after an accepted ON command, an unchanged OFF provider report was held; on expiry, backend state stayed correctly OFF but HomeKit stayed optimistically ON. Recovery deduplicated the stored value and therefore emitted no event to the virtual aliases. A fresh report superseding the recovery had the same problem, including the metadata-update path.

The focused repair publishes the accepted reconciliation state once even when unchanged, while retaining history deduplication and generation fencing. Tests reproduce the failure before the repair and pass afterward. The new suite contains **11 cases**, uses real production entities/services and observes HAP `change` events, with only the physical provider controlled. It does not advertise a HomeKit bridge or claim HTTP/WS transport, migration, InfluxDB durability or real-device latency coverage.

Final targeted validation: **433 tests / 33 suites passed**, covering the command/value/coordinator/structure services, all HomeKit suites, virtual forwarding/projection and Shelly delegate tests. Backend type-check, focused ESLint and Prettier checks passed. The architecture document now describes unchanged-value reconciliation notifications. No dependency, schema, public API, TTL or grace-period change was introduced.

A subsequent concurrency check reproduced a second defect: HAP published an older successful SET value after a newer command/report had won. The same issue produced a transient stale event in the thermostat coordinator, hidden by its next-tick refresh. Writable mappings now use HAP write responses with the current mapped value, and accepted backend value events supersede pending HomeKit state (metadata-only events retain their stale-cache guard). Coverage includes same-characteristic and cross-alias late success, and expiry before provider acknowledgement. This adds HAP write-response capability to writable characteristics; actual Apple Home interoperability is still a staging acceptance gate.

Reproduce the added integration coverage:

```sh
pnpm --filter @fastybird/smart-panel-backend exec jest --runInBand src/plugins/devices-homekit/services/homekit-command-convergence.integration.spec.ts
```

Existing separate suites cover permissions/command admission, PATCH compensation, canonical mapping, structural exclusion and poll cancellation. Their combined passing result is not full transport-level acceptance. Remaining P1 work includes the authenticated REST/WS integration boundary and the diagnostic-runner failure matrix. This result does not reclassify #1052's lost historical cause or complete the Raspberry Pi/client matrix. The staging candidate must include this repair after review/build; the unchanged published alpha.23 does not contain it.

### P2 — Preserve useful evidence and rebuild staging

**Owner:** #1033 coordinates the reset; #1093 retains updater failure evidence and compatibility scope. The owner has authorized overwriting this staging installation. An in-place reconciliation of its held alpha.19 attempt is not required to prepare a fresh installation.

- [ ] Identify the exact staging host/storage and capture version, installed worker, attempt/lock/status, relevant journals, service configuration and device/source/projection topology. Keep credentials and pairing material private.
- [ ] Retain a consistent database snapshot or stopped/offline image for reproducing the old failure, plus configuration needed to restore representative load. A normal stop/offline capture belongs to the authorized reset; it does not require running the private metadata-reconciliation packet. If a snapshot cannot be obtained, record that limitation without turning missing historical evidence into a passing result.
- [ ] Install the verified alpha.23 candidate directly using the supported image/installation route. Keep the failed installation's updater metadata in the evidence archive; do not import its attempt/lock into the new runtime or label the old attempt successfully reconciled.
- [ ] Restore/recreate representative device configuration and the source→virtual→HomeKit topology. Handle Apple Home pairing through the supported path and record any changed identity. Separate initial onboarding/discovery from warm-state measurements.
- [ ] Verify artifact/runtime version, migrations, health, device-handler readiness and access. Retain a reproducible setup checklist and clean baseline snapshot for subsequent upgrade scenarios.
- [ ] Defer the two private recovery-packet corrections unless an explicit in-place legacy-recovery support case requires that tool. Its known defects remain documented, and the packet must not be executed while unresolved. Ordinary updater failure/ownership regression coverage remains required in P3.

**Exit:** The Raspberry Pi has a verified, reproducible staging installation with representative configuration and archived old failure evidence. This is a clean-install result, not proof of a repaired legacy upgrade or recovery procedure.

#### P2 execution inventory — 2026-09-27

A live SSH inventory confirmed alpha.18 active/healthy, image installation, `KillMode=process`, and the existing alpha.19 `recovery_required/stopping` attempt with `migrationEntered=false`. Public status separately records a failed alpha.20 attempt; these are retained as distinct records. A private archive contains a consistent SQLite online backup (integrity check `ok`), device/configuration and HomeKit pairing files, updater status/attempt, installed worker/hash, service configuration and recent journal. Local and remote archive SHA-256 match. Credentials and the archive remain outside the repository.

Production fixes are committed at `694525432`; the systemd fixture correction is committed at `212840af2`. The local backend build succeeds. The published alpha.23 ARM64 server archive has been downloaded and verified against its published SHA-256. The staging candidate combines that runtime/dependency/admin/display baseline with the locally verified backend build and a distinct build identity. It is an unpublished staging candidate, not a new public release. Identity: `1.1.0-alpha.23+review.212840af2`, artifact SHA-256 `4bcbe0d33936aafde4fa9854a8c3fed6b5524ecd1f1caebd749416f6ed844c50`. Its actual ARM64 dependencies, local compiled backend and a copy of the staging database passed migration CLI (`No migrations are pending`) and health startup on disposable Linux using default configuration.

A first maintenance deployment preserved the complete old working directory and restored its database/config/pairing into a fresh runtime directory, excluding old updater status/attempts. This is a binary/runtime rebuild with preserved application data, not an empty-database install or a normal updater success. The candidate did not become healthy within the initial 45-second deployment check, so the deployment restored the untouched alpha.18 directory and data. Alpha.18 then took 79 seconds to reach Nest application readiness. The second diagnostic deployment succeeded using a separate 300-second cold-start observation budget; product/worker timing limits were unchanged. The application became healthy after approximately 103 seconds; its managed-service bootstrap waited approximately 102 seconds, with WLED finishing last after approximately 95 seconds. This identifies a startup dependency boundary, not yet the internal cause of all WLED time. The startup-hook override was subsequently removed. A further restart without that override took approximately 60 seconds. All 111 catalog devices and the existing Apple Home pairing were preserved, and the selected Shelly source eventually became online. Physical command/restore cycles were then executed as recorded below.

### P2a — Restore the value-path boundary (new evidence, 2026-09-27)

**Owner clarification:** SQLite is the structural catalog. Property values belong in memory or InfluxDB; ordinary value reports must not start ORM work or mutate SQLite.

The live candidate still writes `devices_module_property_value_locks` for each property operation, including unchanged reports. `PropertyValueLockService` creates a Unix socket and performs SQLite INSERT/SELECT/DELETE operations around the value store. Git history locates its introduction in `23d4accba`, Homey adoption **#816**, to serialize terminal reconciliation against writers in independent backend processes. This cost was added to the common value service and affects every provider. `ChannelsPropertiesService.updateValueOnly()` separately loads property/channel/device metadata using an ORM query for every value update.

A small isolated storage benchmark on staging measured a median **38.84 ms** per INSERT/two SELECTs/DELETE with SQLite DELETE/FULL (25 iterations; max 98.82 ms). WAL/FULL still cost 35.40 ms median. These are scratch-database measurements under live load, not property latency samples or proof that WAL solves the issue. A short vmstat observation showed 12–20% I/O wait. Do not change SQLite durability to hide this overhead.

An initial optimization in `dde47d550` skips durable leases only for unchanged values while retaining local ordering. It passed **610 tests / 51 suites**, type checking, lint and build, but is **not deployed and is not the final architecture fix**. The owner clarification exposed its insufficient scope. Its candidate overlay is retained privately and must not be described as running on staging.

- [ ] Confirm whether one installation supports one backend writer process or concurrent backend processes sharing storage. The current cross-process behavior is explicit in the Homey adoption documentation and must receive a deliberate disposition.
- [ ] Remove SQLite lease operations from ordinary value updates, including changed values. Preserve same-property ordering, reconciliation comparison/write atomicity, failure handling and deletion safety through the agreed runtime ownership model.
- [ ] Supply value updates with a maintained in-memory metadata snapshot. Handle startup, creation, metadata changes, channel/device changes, source remaps and deletion with explicit invalidation/ordering. Do not trust an indefinitely cached provider entity or silently recreate removed properties.
- [ ] Retain a regression that counts database/ORM operations across a fully initialized ordinary source→alias value update and requires **zero** catalog queries and mutations. Cover changed and unchanged reports, event fan-out, deletion/remapping and concurrent adoption.
- [ ] Re-measure representative startup and warm commands before changing lifecycle design: repeated metadata and lease I/O may also contribute to slow integration startup. Keep independently demonstrated lifecycle faults separate.

**Exit:** values and metadata have separate operational paths, with explicit writer ownership and no SQLite/ORM work per ordinary value report. Convergence and adoption guarantees remain tested rather than removed implicitly.

### P3 — Prove the ordinary System-module upgrade

**Owner:** #1093, with a separately recorded acceptance result.

The success criterion is an upgrade requested through the normal authenticated System API/admin flow, using the worker shipped in the starting installation. A direct maintenance-script invocation is a different entry point.

- [ ] On disposable Linux/systemd first, test a legacy source→candidate transition and a repaired source→distinct next-version fixture transition. Record source worker and target artifact separately. Synthetic next-version artifacts are test evidence only. For legacy versions that cannot upgrade normally, explicitly document the supported maintenance/reinstall route and its data-preservation requirements; do not claim fresh-install success repairs that boundary.
- [ ] Exercise the actual installed executor/privileged-worker boundary, migrations, startup and health endpoint together, including the image unit's `KillMode=process` and Tailscale shutdown behavior.
- [ ] Reuse existing failure cases and close integration gaps: failed stop prevents SQL; migration failure retains recoverable state; late/wrong-version health cannot report completion; backend boot does not await its own health-dependent updater; duplicate request, restart and observer loss retain ownership.
- [ ] Verify public status/progress and actionable failure reporting after backend restart. A recovered historical failure stays failed; a new update has a new attempt identity.
- [ ] Verify a normal installed-device update from a repaired release to the next legitimate candidate before declaring routine upgrades restored. Do not publish a no-op release solely to produce a green checkbox; until such a target exists, report fixture success and live acceptance as separate states.

**Exit:** Normal upgrade succeeds without private worker replacement, manual lock deletion or database-history editing; interruption/failure leaves an explained and supported recovery state. Fresh-install success cannot close this deliverable. Legacy upgrade support and any remaining limitations have an explicit disposition.

#### P3 local verification — 2026-09-27

The updater executor/service/CLI/worker suites pass **150 tests / 4 suites**. The repository's real Linux/systemd test initially failed because its transient fixture disappeared from the manager after stop, its process start-time regex was overescaped, and the retained-child case required an empty manager result before checking the survivor. The fixture now uses a runtime-enabled unit, validates the actual start tick, accepts a nonempty enumeration only for the deliberately unsafe case, and cleans up on failures. Both `KillMode=control-group` (empty/removed cgroup) and `KillMode=process` (surviving child rejected) passed on Linux ARM64/systemd 252 in an isolated disposable container. This proves the process/quiescence contract, not the full System API upgrade.

### P4 — Finish hardware latency and client acceptance

**Owner:** #1032. #1077 supplies diagnostics, not a substitute acceptance result.

**Environment:** The existing staging Raspberry Pi after P2, using the same source→virtual→HomeKit topology and representative load. Keep one authorized writer to the physical target during trials. A clean install with one lamp is a smoke test, not the original-load comparison. Run property acceptance first, save the verified baseline, then reuse the same hardware for upgrade scenarios. No second device or in-place recovery of the old installation is required.

- [ ] First prove ordinary startup, correct property mapping/handler readiness and one bounded command/restore cycle. Separate cold-start readiness from warm command latency.
- [ ] Validate the actual diagnostic runner end to end on the disposable fixture before physical samples. Retain the command request, acknowledgement, backend capture, client events and separate restore result in one evidence bundle.
- [ ] Make one command-free feasibility assessment of the existing #1077 placement session. If feasible, reuse it. If readiness consumes its useful window, propose one focused amendment: bounded diagnostic arming after the target is ready, with an independent readiness deadline and unchanged capture/product limits. This requires an explicit diagnostic lifecycle decision; it is not permission to extend or silently reset the existing session.
- [ ] Use scheduling forecasts only to place trials. Qualify overlap from actual joined poll/RPC/drain records. Preserve misses and failures; a miss is not an overlap pass, and failed trials are not replaced invisibly to obtain 20 green rows.
- [ ] Collect comparable 20 idle + 20 actual-overlap samples at normal logging/load. Retain current limits and explicitly disposition the historical 4347.625 ms restore. Before/after comparisons require comparable builds/configuration; never downgrade the repaired live database for a baseline.
- [ ] Observe Apple Home, admin and the unchanged panel: isolated and five rapid alternating taps across actual polling, rejected command, no confirmation, external change and recovery. Record visible behavior through settling/grace and correlate it with the backend; REST/WS alone cannot prove absence of UI flicker.
- [ ] Decide #1012 from a reproduced residual admin defect. Keep #1013 deferred unless unchanged-panel evidence demonstrates a remaining defect and activates that scope. The generic panel convergence method still clears on divergence; lighting-specific protections do not prove all device-detail screens correct.

**Exit:** Qualified timing matrix, physical/visible response, no stale flip-back, correct rejection/timeout reconciliation, all three client results, and restored target/configuration. Missing historic causality remains documented rather than reconstructed.

#### P4 live diagnostic results — 2026-09-27

On `1.1.0-alpha.23+review.212840af2`, an initial authenticated WebSocket command reached source/alias events in approximately **1.02 s**, but restoration exceeded the unchanged **5 s** convergence bound. A later REST read confirmed the baseline OFF. That first private wrapper is exploratory evidence only; subsequent trials use the retained repository smoke runner and observer.

A correlated command/restore cycle then converged in **502 ms / 478 ms**. Its complete server captures measured **72.91 ms / 89.77 ms** from update entry to source publication. A later diagnostic attempt reproduced an acknowledgement timeout beyond **5 s**; restoration acknowledged after **4.40 s** and also missed the client convergence deadline. Its server capture shows **4.93 s** from update entry to source publication. Restoration was subsequently confirmed through REST. The failed command's server capture expired, so it does not provide a valid command pipeline sample. Successful later runs do not replace these failures. Scenario labels in the exploratory wrapper are provisional; no idle/overlap acceptance count is claimed.

The real Apple Home app on the Mac contains the paired target. Isolated ON/OFF cycles reached matching backend states and ended at baseline OFF. Desktop video attempts were unsuitable (one ended with its short-lived CLI session; another recorded the foreground display while Home was covered). Those cannot establish visual convergence. A subsequent exact-window capture retained **201 frames over 55.36 s**, with a maximum request gap of **0.691 s**. Sampled tile backgrounds showed only OFF→ON→OFF; short flicker between frames and the rapid alternating-tap matrix remain unverified. A video assembled from these frames preserves their observation timing and remains private with the original frames and backend events.

No 20+20 acceptance matrix, normal System upgrade, admin UI or panel UI acceptance is claimed. Temporary capture and startup overrides were removed after evidence retention, followed by a normal service restart.

### P5 — Close the independent follow-ups and retire temporary machinery

- [ ] **#1110:** Verify its recorded npm/server/image/Docker reconciliation against its own scope and close it if complete. Keep the failed original workflow history; later success does not rewrite it. Do not make it wait for hardware latency.
- [ ] **#1040/#1045:** Complete the specified CI-run recount and reporter disposition independently. Normal per-change CI remains required everywhere.
- [ ] **#1052:** Propose making it the closed historical incident once its existing remaining acceptance checkboxes have an explicit owner in #1032. If that scope amendment is not adopted, leave it open until those criteria pass. Do not call the original cause fixed or known.
- [ ] **#1077:** Close when the chosen bounded diagnostic method and cleanup are demonstrated; retain only useful regression coverage and remove/deactivate temporary runtime configuration after measurement.
- [ ] **#1093:** Amend its execution scope to record the authorized staging rebuild and remove that installation's private recovery packet from the critical path. Close after normal-upgrade acceptance and an explicit legacy compatibility/recovery disposition; never mark the archived failed attempt as a successful recovery.
- [ ] **#1006/#1033:** Close only after property/client acceptance, relevant recovery results and explicit #1012/#1013 dispositions are linked. One merged PR or published release is not completion.

## Execution order

```text
P0 candidate/inventory
  ├── P1 deterministic property-path verification
  ├── P2 archive old evidence → rebuild the existing staging Raspberry Pi
  └── P3 disposable normal-upgrade compatibility verification

P1 + P2 ───────────────────────────────────────────→ P4 physical/client acceptance
P4 + saved staging baseline + next legitimate target → P3 normal live-upgrade acceptance

P5 CI/release bookkeeping has its own evidence and does not block unrelated offline work.
Private legacy recovery-packet repair is conditional support work, not a prerequisite for P2/P4.
All required product and updater results → final closure.
```

These are dependency boundaries, not a request to run multiple agents or concurrent physical writers. A single implementer can advance independent offline work while another work package awaits hardware, review or a release target.

For every new failure, record: exact trigger, expected/actual behavior, which boundary failed, one owning issue, smallest correction and one regression. Reuse that issue for subsequent corrections. Create a new architecture issue only when a real contract decision is needed. Reuse valid evidence unless changed bytes, environment assumptions or a concrete failure invalidate it.

## Source anchors and assessment limits

Reviewed source boundaries:

- `apps/backend/src/modules/devices/services/{channels.properties,property-command-window,property-command-dispatch,property-command,property-value}.service.ts`
- `apps/backend/src/plugins/devices-homekit/mappers/base.mapper.ts` and `listeners/homekit-event.listener.ts`
- `apps/backend/src/plugins/devices-shelly-ng/delegates/delegates-manager.service.ts` and `services/poll-placement-diagnostics.service.ts`
- `apps/backend/src/modules/system/services/update-executor.service.ts`, `scripts/update-worker.sh`, and their tests
- `apps/backend/src/dataSource.ts`, `app.module.ts`, migration-26 test coverage, and `test/support/update-worker-systemd.integration.sh`
- Tailscale managed-service shutdown, admin `useDeviceControl.ts`, panel `device_control_state.service.dart`, and `.github/workflows/ci-tests.yaml`
- `docs/optimistic-ui-architecture.md`, `docs/property-command-latency-runbook.md`, and the image update runbook in `docs/remote-access-architecture.md`

GitHub issue bodies/comments and source were inspected. Private recovery-packet outcomes remain attributed to issue records. Live SSH inventory, a consistent database archive, published artifact hash verification, disposable migration/health checks and the limited physical diagnostics above were subsequently performed. No ordinary System upgrade or release was performed. The initial assessment was documentation-only; dependencies were subsequently prepared and the targeted backend verification recorded under P1 was executed. Full hardware latency and client acceptance remain outstanding; actual Apple Home smoke observations and their sampling limits are recorded above.
