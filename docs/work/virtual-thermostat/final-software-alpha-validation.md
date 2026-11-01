# Final software acceptance and next alpha

Status: in progress, 2026-11-01. Tracking: #1462; parent #1447 and installed acceptance #1463 remain open.
Implementation starts from merged main `54e2c92c57d4aa2a906cd7744e3d60294c203377` (#1505).
No alpha was dispatched or published by this preparation. No installed equipment was operated.

## Composed acceptance

| Boundary                                                    | Executable witness and assertion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All available activity domains in one actual HTTP operation | `space-climate-automation.e2e-spec.ts`: `composes all configured activity domains through ordinary HTTP and real adapters; media fails=%s`. Real migrated AppModule, authentication, configuration, lighting/climate/covers/media adapters and physical property-command pipeline; only the physical endpoint is controlled. Preview has zero sends and no automation source writes. Activation sends light OFF, cover 37 and media ON, and installs the actual thermostat eco source.                                                              |
| Partial media failure in that same composition              | The second row rejects the actual media endpoint command. Lighting, covers and climate still complete; the saved per-domain media result remains failed. Optional security actuation remains explicitly UNSUPPORTED in both rows; this does not implement the unrelated security epic.                                                                                                                                                                                                                                                              |
| Schedule + live occupancy + independent manual priorities   | `composes scheduled and observed activity with independent room and thermostat manual precedence`. An actual persisted schedule selects eco, a fresh motion input selects explicit heat 22, and disconnect gives UNKNOWN without vacancy or replacement of the current selection. A manual room selection holds occupancy. A manual thermostat selection then inhibits a later scheduled climate action, and occupancy Resume does not remove that independent thermostat hold.                                                                     |
| Upgrade from published alpha.64                             | `virtual-extensions-upgrade.e2e-spec.ts`: `upgrades an actual alpha64 migration prefix through all virtual extensions and reopens without rewriting legacy identities`. Applies the published 28-migration prefix, inserts existing room/physical/projection identities and source links, applies every current pending migration and reopens twice. Original metadata is equal; new activity climate, schedule, occupancy, native and claim state is dormant. Foreign keys and SQLite integrity pass.                                              |
| Published prefix binding                                    | `test/fixtures/virtual-extensions-alpha64-migrations.json` pins the alpha.64 commit and all 28 source hashes. Current prefix bytes must match; migration 2 alone uses its original published forward SQL in a local fixture class, because the later production idempotence repair is not an already-installed migration. No production migration is rewritten.                                                                                                                                                                                     |
| Complete pending journal set                                | The runtime tests `retires only committed journal identities…`, `does not let optional retirement failure…` and `waits for a known SQLite commit acknowledgement…` use an actual public runtime-issued OFF and accepted seed ON, retain all prior rows and assert exact complete retirement. Baseline P0 and subsequent K calls retain order/multiplicity. Real rollback preserves the whole journal; held/unknown ACK and callback substitution cannot retire early or adopt a successor. The adapter is controlled; no physical OFF is certified. |

The ordinary HTTP suite also retains existing physical-control, API, private-data, CLI/authoring and ownership cases.
HomeKit/native, energy, provenance, expiry/restart/remap and provider lifecycle suites remain separate complementary
witnesses. Separate suites do not substitute for the single all-domain operation above. Generated wire contracts
are unchanged by this runtime/test/release preparation; no generated API/spec files are hand-edited.

## Measured local validation

| Run                                                                                                  | Result                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Complete ordinary E2E after adding the four cases                                                    | **29 suites / 424 passing cases, composed**: 28 suites / 310 PASS in the complete run, then the entire corrected virtual-device file / 114 PASS. Both have zero skips and natural exits. The initial full run remains RED (423 PASS / 1 FAIL). Earlier strengthened upgrade (1/1) and composition (2/2) remain retained. |
| Complete durable thermostat runtime including the multi-command controls and actual-interval held ON | **155/155 PASS**, zero skips, natural exit 0. Includes six startup/lifetime cases and two original-row refusal controls.                                                                                                                                                                                                 |
| Remote dew-point compiled protocol and runtime renewal                                               | **39/39 PASS**, zero skips, after replacing the manual active flag with actual bootstrap/admission and stop. Original journal/packet assertions remain; stopped-context ON additionally refuses without history or output changes.                                                                                       |
| Ported inherited-method descriptor controls                                                          | **6/6 PASS**, zero skips.                                                                                                                                                                                                                                                                                                |
| Backend types                                                                                        | Final noEmit/incremental-false gate PASS, including the production lifecycle/journal changes and eight new cases.                                                                                                                                                                                                        |
| Strict lint                                                                                          | All three changed runtime/journal TypeScript files and the corrected E2E setup PASS with zero warnings; prior HTTP/upgrade/descriptor checks retained.                                                                                                                                                                   |
| Release version selection + immutable source contract                                                | Final **3/3 PASS**; actionlint workflow syntax/dependency/expression checks PASS.                                                                                                                                                                                                                                        |
| Generated API/spec and Admin/Panel clients                                                           | All generators PASS; **5,671 actual files** reproduce byte-for-byte, with zero new or changed outputs on the verified repeat.                                                                                                                                                                                            |
| Prior complete backend before the lifecycle correction, two workers                                  | **725 suites / 13,287 tests PASS**, zero failures; one existing pending agricultural/device-temperature Zigbee mapper test. Natural exit 0.                                                                                                                                                                              |

The current native consumer qualification composes **23 suites / 1,190 passing cases**: 22 consumer suites /
1,035 cases passed on this production, followed by the complete corrected runtime file / 155 cases in a fresh
process. The initial 23-suite invocation remains RED: the new native-read test incorrectly asserted that an
SQLite callback inherited the caller's AsyncLocalStorage lease. Throwing that assertion inside the native
callback also caused body/cleanup timeouts. The assertion was removed, callback failure was observed outside
SQLite, and the actual read/stop/fresh-B/persistence assertions remain. The corrected case and full runtime
passed. The 22 green suites were not rerun. The earlier 725-suite backend result predates these production
changes and is retained as historical evidence; exact-head hosted CI is still required.

The ordinary E2E invocation passed 423 cases and failed during explicit graph recovery in the cleanup of
`returns committed nested wiring as unavailable when post-commit graph validation fails`. Its main HTTP and
persistence assertions completed; recovery refused an expired original graph generation. A bounded passive
full-file diagnostic passed 114/114 and did not reproduce that exact interleaving, so its cause remains UNKNOWN.
Source inspection identified an unjoined operation: the device-information event handler can write further
owned properties after its status recomputation. The setup helper now retains the original complete synthesis
Promise and its index/status descendants before explicit recovery, while preserving Nest event metadata and
all original E2E case bodies. The corrected full file passes 114/114. No graph refusal was suppressed, no retry
loop or production graph change was added. An earlier fixture attempt without copied event metadata was
interrupted and grants no qualification. This composed E2E result does not rewrite the first full run as green.

### Runtime lifecycle correction

Two real-SQL baseline cases exposed that concurrent bootstrap callers did not receive the original pending
completion. Startup now publishes one original Promise before registration/recovery, preserves its exact failure,
and closes its own registrations after failure. Stopping an old pending startup cannot clear a newer startup's
Promise or install an old timer. Each lifetime owns its listeners, contexts, evaluation queue and send/publication
guards. Stopped `flush()` joins retired evaluations while a fresh startup obtains its own queue and native admission.

The actual native-load tests stop A at the read boundary or hold its completed result after an exclusive ticket
proves shared release. B completes under its own admission; A cannot overwrite B or persist stale work. Restoring
the former post-load active-only check causes the held-result control to fail, and production was restored exactly.
A separate real guard/delegate/HTTP case holds the response of an already recorded ON: after stop and fresh B,
the original A outcome persists on the same command ID as unknown without another ON or new admission.

Same-instance journal recovery retains a pending row only for this journal's exact acknowledged in-flight object,
after complete native-image comparison. Other prepared/dispatching rows become unknown as before. Clone and
foreign-write controls refuse retention atomically without rewriting history. Acknowledged insert/write images
are published inside the existing post-ACK exclusive scope. Retained history supplies no actuation authority.

The initial generated-output inventory used Git-tracked paths and found zero files because these outputs are ignored. It grants no comparison credit. The corrected filesystem inventory captured all 5,671 files before and after a complete generator repeat; those hashes match.

A single journal negative control truncated the retirement set to its first identity. Seven rows failed at their complete-set assertions; the unknown-ACK row correctly passed because no retirement occurs in that outcome. The control source was restored byte-for-byte. After replacing the seeded OFF with the real issued OFF, the control again produced seven exact-set failures and the one expected unknown-ACK pass; production was restored before the complete runtime rerun. The initial harness incorrectly expected eight failures; the retained raw result was reclassified without a runtime rerun.

Initial fixture failures remain recorded: a controlled platform lacked `prepareCompositeBatch`; a test used the
wrong climate enum; and a sample timestamp was accidentally in the future relative to the actual input reader.
The fixture was corrected without weakening production input-age, command or authorization rules. Earlier
historical runtime/timeouts and worker warnings remain source-specific; later passing results do not diagnose them.

### Hosted failure follow-up: remote-provider continuity fixture

[The backend job on 46468ac](https://github.com/FastyBird/smart-panel/actions/runs/41321547287/job/124892690032)
passed 725 suites and failed one case in `remote-dew-point-protocol.spec.ts` (13,301 passes, one failure and one
existing skip). E2E and the following qualification spikes were skipped by that failure. The identical complete
39-case file reproduces the single failure locally: its private dispatch fixture assigned `active = true` without
starting a lifecycle, so the new native lifetime guard correctly refused it.

The fixture now awaits real bootstrap, native recovery and runtime admission; real stop owns cleanup. Its existing
controlled cooling frame is installed through the actual transport registration/disposer during startup. Decision
scheduling and demand stay controlled because this case isolates renewal/transport, rather than full evaluation.
The permissive standalone runtime-admission callback is removed. All existing two-command, native packet identity,
threshold/sequence and finite-lease assertions remain, followed by a real stopped-context refusal with unchanged
journal and native ON count. The complete file passes 39/39. Production source is unchanged; the original failed
hosted and local runs are retained. This test correction requires fresh exact-head CI and does not close any of
the 139 original residual bindings or grant installed-equipment qualification.

## Original #1473 reconciliation

[The complete row inventory](original1473-case-map.json) preserves every one of the original 261 expanded cases,
its original title/ancestry/line and historical status. Original head is `2c19907c361ca66540e8f5d05fe24a5ff9cab0c2`;
original runtime SHA-256 is `150ab6a15587b93358c84f6ab1889e43617e3906f05f548d3e1fd46a947b8608`.
The saved R265 raw-result SHA-256 is `d183276fbfc7ea319898eb01034f13d22ef867246402c91606e5c3a5d9c9d77e`.
Its **200 PASS / 61 FAIL** describes that historical source, not a current-main defect count.

The current reconciliation distinguishes scoped business outcomes from complete original-case acceptance:

- **109 rows** now bind to current observable invariants. The preceding 103 bindings retain comparison of all 68 distinct same-title test-body pairs, their setup, controlled order and full assertion differences; six further startup/lifetime bindings are detailed below. Per-row notes state changed ports and limits. Current basic mutation fixtures control claims/value ports; these bindings do not certify the former full mutation-provider or SDK custody pipeline.
- **Four formerly partial journal rows (234, 235, 238, 239)** now bind through a real runtime-issued OFF. Independent native INSERT and original send-packet observations fix its ID while held. The complete baseline/P0 transcript, two-ID K, actual rollback, optional callback failure and held/unknown COMMIT ACK all retain their full row and call-order/multiplicity assertions. There is no seeded companion OFF.
- **Six startup/lifetime rows (222–227)** now bind exact pending success/failure, stopped-A/fresh-B bootstrap, actual native-read stop, held completed load and late possibly-sent outcome. These execute against native SQLite/claims with controlled endpoint responses; they do not adopt the retired fixture-owner/observer API. Eighteen old setup/cleanup controls were inspected without granting any harness-only waiver; they remain open.
- **Seven replacement rows (105–109, 111, 240)** bind the current native OFF, protected-write, qualification, held ON and actual-interval boundaries. A raw config SQL write now additionally withdraws installed qualification; a fresh explicit qualification is required before drainage. This stricter raw-write contract is recorded rather than presented as the old refresh-only recovery schedule. Row 240 also binds the original held OFF plus known COMMIT ACK through the shared real-OFF helper and held-ACK case; retired receipt/descriptor infrastructure is not adopted.
- **Six descriptor rows (255–260)** are ported to the current shared capture API and pass directly. Original static inheritance, replacement and getter-no-invocation assertions remain; these are pure controls with no native/transport authority.
- **139 rows** still have no current case bound. Each retains its concrete original requirement. API retirement alone does not discharge the underlying business invariant.

The history oracle was independently challenged with three controlled production mutants: oldest prepared command first, duplicate returned rows and a corrupted proof ID. Each caused both history cases to fail at the intended predicate, uniqueness or complete-row assertion (six expected failures total). The production file was restored byte-for-byte before the complete **147/147** runtime rerun passed.

Original row 261 remains open: the old helper rejected missing required methods, while the current shared helper also supports optional absence. That difference needs a required-callsite binding; a `current()` result alone must not be presented as the original missing-method refusal.

A direct row-111 adaptation requiring the old `context.admission` to expire on an ordinary poll failed and was withdrawn. That current field is a claims-membership snapshot retained across neutral rotations; ON separately requires the exact current context and epoch. Two executable witnesses now bind those boundaries: the idle original interval publishes a fresh decision without ON, and an actual original interval invalidates a held native ON guard that was true at entry. The latter uses no explicit poll, fake timer advance or replacement interval. The original owner stops before the held gate opens, and the complete runtime rerun passes. Legitimate retained OFF facts were not weakened.

The journal comparison already exposed incomplete single-identity checks and led to the multi-identity
strengthening above. That correction does not clear unrelated original controlled SDK, startup, clock, negative
observer or fixture-ownership schedules. #1473 remains frozen and is not superseded. #1462 and alpha clearance
remain open until required residuals are resolved or explicitly dispositioned with evidence.

Hosted CI on preparation head `dd9b9b8549c72d0796aa618648730e145d287337` passed all 14 checks; [the CI Tests run](https://github.com/FastyBird/smart-panel/actions/runs/41314503661) succeeded. It includes the real issued-OFF enhancement but predates the lifecycle correction. The later 46468ac backend failure and fixture correction are recorded above; fresh exact-head CI remains a gate. CodeRabbit skipped the draft, and that skip grants no review approval.

## Release preparation

The existing `alpha-release.yml` remains the publisher. Preparation fixes two demonstrated release issues:

1. Downstream builders/publishers check out the immutable commit returned after version synchronization. The
   release tag and `version.json` use that same SHA; the Flutter build number is propagated from the version job.
   They no longer pull a changing branch after checkout. A workflow contract test runs in CI.
2. The alpha.64 ARM64 Docker build failed in sqlite3/node-gyp because Python lacked `distutils`. Both existing
   Alpine build stages now install `py3-setuptools`. A native ARM64 container smoke compiled sqlite3 5.1.7 from
   source and opened a real database (`sqlite_version()` 3.44.2), using node:24-alpine digest
   `sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85`.
   Its temporary container was removed. This is dependency qualification, not a complete Docker-image build.

The historical failed alpha workflow was run `38247149857`, ARM64 job `114813262193`; a GitHub release object
already existed despite that failed downstream job. A release object alone therefore cannot close #1462.

## Remaining gates

- [ ] Finish original #1473 semantic case bindings and any required executable residuals.
- [ ] Complete current software/static/generated-contract and source-review gates; reconcile #1293/#1458 against their entire criteria.
- [ ] Merge the delivery PR after exact-head green CI and completed nonblocking main review.
- [ ] Dispatch the existing alpha workflow from the accepted source; record the actual selected version and version-sync commit.
- [ ] Verify tag/source/package metadata and completed package, application, Panel, Raspbian, native Docker architecture and manifest jobs.
- [ ] Record published assets/checksums and release notes with explicit remaining installed Shelly/HA/Zigbee/Apple Home qualification.

No next alpha version is certified here. #1447 is not closed by a child software or release checkmark.
