# Final software acceptance and next alpha

Status: partial software acceptance, 2026-11-07. Tracking: #1462; parent #1447 and installed acceptance #1463 remain open.
Current summary base: merged main `9b7392ec28d6586ef678bab7e819c48519e3e13e` (#1527).
Initial preparation began at `54e2c92c57d4aa2a906cd7744e3d60294c203377` (#1505); its measurements remain historical below.
No alpha was dispatched or published by this preparation. No installed equipment was operated.

## Current qualification and remaining scope

[The canonical ledger](original1473-case-map.json) records **145 bound original rows: 122 scoped invariants**,
17 replacements and six descriptor controls. Of the fixed 139-row residual inventory, **23 have current
bindings and 116 remain unbound**. The twenty-three comprise thirteen scoped and ten replacement bindings;
the initial 122 dispositions retain their existing limits. No complete original-case or equipment acceptance
follows from a scoped binding.

The current held-fence tests were merged in #1525. Its exact reviewed head
`d1018936dc786a788f11811da0c791e45b37482a` passed all 14 checks and completed CodeRabbit review
without actionable findings. The measurements below use #1529
(`1823db1a8ef5bce16db81545374ecb7c38d4ceac`), whose tree equals reviewed head `711ef0231a134ecc9a4f9cf385c464ab4beac256`. All CI checks passed and CodeRabbit completed review
without actionable findings. Original rows 116–117 now have scoped public-poll debt bindings detailed below. The earlier #1524
source/helper/report aggregate remains historical evidence at its recorded source.

| Measurement | Result and exact source scope |
| --- | --- |
| Current complete runtime | **182/182**, zero failures/skips, one complete local file on the exact merged #1529 source. Report SHA-256 `a45f18eb83a3420f36fe2de16d8dcbbc947fee0a962e70daf09b19b9bf9ecb73`. This is not a fresh local eight-file invocation. |
| Current hosted backend | [Exact-head backend job](https://github.com/FastyBird/smart-panel/actions/runs/42307639627/job/128200949238): 727 ordinary unit suites, **13,349 passes**, one existing unrelated agricultural/device-temperature Zigbee mapper skip. All eight native-consumer files explicitly PASS. Job-log SHA-256 `0e1b61c37c69e9ac767d855a8073401ca03572e1f5cc0174a42782ea0908c714`. |
| Current ordinary E2E | **426/426**, zero failures/skips, 29 suites in that same exact-head hosted job. The job log above is the report artifact; earlier raw JSON E2E reports retain their historical attribution in the prior ledger. |
| Prior native-consumer aggregate (historical) | **385/385**, zero failures/skips, eight complete files at #1524: runtime 177, comfort 45, SDK 24, claims 14, value locks 8, creation capture 12, ownership 4 and authoring 101. Report SHA-256 `2c304761e3d5aa28bbdab39af4728e5d90f11fa437691168c9057c136a3e9488`. |
| Evidence bindings | All **146 witness bindings across 145 rows** match current files, body tokens and passed executions. The held-fence shared body and its entry gate are strengthened; 109 other literal runtime bodies and 62 other helpers remain token-identical; 19 production and nine consumer/shared-fixture source bindings are recorded. |
| Retained controls | The prior 52 reports remain hash-verified historical evidence. Twenty per-row negative reports retain 29 expected failures and five passing selected controls; they were audited, not replayed after the additive test change. Two #1525 scope-omission controls, not replayed after #1529, each fail only the corresponding changed-image variant, pass two controls and leave 177 cases unrun. A new premature-admission control fails both changed-image variants while unchanged passes (179 unrun); prior assertions pass all three under the same mutation. Production is restored byte-for-byte. |

The prior aggregate objects remain verbatim under `currentBeforeAggregateRevalidation` and
`semanticReconciliationBeforeAggregateRevalidation`. The preceding semantic reconciliation is retained under
`semanticReconciliationBeforeHeldFenceAdoption`; `priorQualificationLedger` indexes its immutable full ledger,
including the prior per-row measurements. `heldFenceOrderingFollowup` records the reviewed #1529 strengthening and its immutable prior ledger.
Older test-file identities remain historical after the test changes.
This evidence update requires its own exact-head CI and completed source review. The 116 residuals,
retired private TIME/caller/observer/global-drain and complete provider/SDK protocols, installed equipment,
and alpha publication remain separate open gates.

Rows 118–119 now bind independent member/source changes committed through a peer SQLite connection while
the first post-restart OFF fence is held. They require complete unchanged configuration, actual fresh binding
reload, at least two completed relay fences and a stored current proof with a new scope, without ON.
An unchanged-image variant passes; separate member/source scope-omission controls discriminate the two changes.
The #1529 timeline also requires a matching-scope completed OFF fence before each fresh-scope proof admission;
a premature-admission mutation fails the two changed-image variants while their former assertions pass.
The original second-fence/ceiling schedule is replaced only for this scoped invariant. No private fixture-protocol
or installed-equipment equivalence is inferred. [The residual evidence](original1473-residual-acceptance.md#rows-118119-independent-bindings-during-a-held-off-fence)
records the full boundary and report identities.

Rows 116–117 additionally bind peer-committed native ON insertion or same-ID revision changes during
successive held OFF fences. Explicit public polls replace the original automatic dirty-frontier continuation;
first/second post-restart gates replace its second/third/fifth schedule. Complete baseline/current ON images,
exact ID sets and unchanged configuration/claim revision are retained. Every obligation must use the original
later provider proof covering all current IDs, distinct from the earlier proof; three or four entries finish
without ON. Historical omission and stale-proof controls retain their measured source and assertion versions.
[The scoped peer-debt boundary](original1473-residual-acceptance.md#rows-116117-independent-native-on-debt-during-successive-off-fences)
grants no retired receipt/private-protocol or equipment equivalence. No new local runtime run is claimed:
the existing 182/182 #1529 report covers both unchanged peer-debt bodies and source dependencies.

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

## Historical measured local validation

These are the initial preparation measurements and failures at their recorded source versions.
They are retained without adding their counts together or replacing the current measurements above.

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

The initial native consumer qualification composed **23 suites / 1,190 passing cases**: 22 consumer suites /
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
the remaining original residual bindings or grant installed-equipment qualification.

## Original #1473 reconciliation

[The complete row inventory](original1473-case-map.json) preserves every one of the original 261 expanded cases,
its original title/ancestry/line and historical status. Original head is `2c19907c361ca66540e8f5d05fe24a5ff9cab0c2`;
original runtime SHA-256 is `150ab6a15587b93358c84f6ab1889e43617e3906f05f548d3e1fd46a947b8608`.
The saved R265 raw-result SHA-256 is `d183276fbfc7ea319898eb01034f13d22ef867246402c91606e5c3a5d9c9d77e`.
Its **200 PASS / 61 FAIL** describes that historical source, not a current-main defect count.

The current reconciliation distinguishes scoped business outcomes from complete original-case acceptance:

- **122 rows** bind current observable invariants: the initial 109 scoped bindings plus thirteen from the residual inventory. The historical comparison of 68 distinct same-title body pairs and each row's changed ports and limits remain recorded in the ledger. Controlled claims/value ports do not certify the former complete mutation-provider or SDK custody pipeline.
- **Four formerly partial journal rows (234, 235, 238, 239)** now bind through a real runtime-issued OFF. Independent native INSERT and original send-packet observations fix its ID while held. The complete baseline/P0 transcript, two-ID K, actual rollback, optional callback failure and held/unknown COMMIT ACK all retain their full row and call-order/multiplicity assertions. There is no seeded companion OFF.
- **Six startup/lifetime rows (222–227)** now bind exact pending success/failure, stopped-A/fresh-B bootstrap, actual native-read stop, held completed load and late possibly-sent outcome. These execute against native SQLite/claims with controlled endpoint responses; they do not adopt the retired fixture-owner/observer API. Eighteen old setup/cleanup controls were inspected without granting any harness-only waiver; they remain open.
- **Seventeen replacement rows (105–109, 111, 203, 221, 228–229, 232–233, 240–243, 261)** bind current native OFF, protected-write, qualification, held ON, actual-interval and required-method boundaries. Rows 241–242 and 261 are detailed below. A raw config SQL write now additionally withdraws installed qualification; a fresh explicit qualification is required before drainage. This stricter raw-write contract is recorded rather than presented as the old refresh-only recovery schedule. Row 240 also binds the original held OFF plus known COMMIT ACK through the shared real-OFF helper and held-ACK case; retired receipt/descriptor infrastructure is not adopted.
- **Six descriptor rows (255–260)** are ported to the current shared capture API and pass directly. Original static inheritance, replacement and getter-no-invocation assertions remain; these are pure controls with no native/transport authority.
- **116 rows** still have no current case bound. Each retains its concrete original requirement. API retirement alone does not discharge the underlying business invariant.

### Historical binding sequence

The following checkpoint measurements retain their original source/helper/report attribution. Their
older test totals and draft-review statements describe those checkpoints; the current qualification and
completed predecessor reviews are recorded above and in the ledger.

**Rows 241–242 bind failed original OFF completion.** The current shared public-OFF helper retains its accepted default and observes the original transport result plus saved native journal before allowing an explicit next settlement phase. Refused/unknown outcomes reject test preparation; this does not change the product public method contract. Native INSERT/send identities fix K, and both predeclared effect grammars retain complete baseline rows, P0, retirement arguments/order/multiplicity, exact journal membership/status and no ON attempts. The old private S0/S1 receipt/child-frame protocol is not adopted; controlled claims/value/transport ports remain explicit. Complete runtime **157/157** and all 94 previous literal bodies pass unchanged. Persisting failed OFF as accepted causes both new variants to fail their native journal equality assertions; production is restored. Row 243 is bound separately below; other fixture-custody boundaries remain open.

**Row 243 binds retired A completion against a distinct held B.** A's actual OFF remains held while
B restarts, issues its own OFF and enters its original next proof. B inspection is queued before A
resumes. Original enrolled and public A completions reject with identical native journal-image error;
B's entire native journal image, context, lifecycle, command image and listener descriptor remain
unchanged, with no premature retirement or ON. B subsequently confirms and retires exactly all three
pending IDs once. A transparent owned enrollment observer refuses foreign descriptor restoration.
The public journal failure and current listener descriptor replace removed private receipt and
serviceFeedback mechanisms; dispatch feedback is controlled while bootstrap/inspection forward.
Complete runtime **158/158**, all **95 previous literal bodies**, unchanged accepted-OFF helper, types,
strict lint, formatting and two discriminating mutations pass. No whole fixture/provider/SDK clearance.
Initial type/preparation errors and the native bootstrap-versus-proof ordering witness remain recorded.

**Rows 228–229 bind native qualification observation and absence ABA.** The actual runtime/claims
service runs against SQLite and the managed test guard fixture. Reads neither install qualification
nor capture/refresh/evaluate, emit, query SQL or send. Actual revoke closes the original context's
admission; a fresh context captured during absence also stays closed through transient installation
and subsequent absence. Direct qualification is available in the intermediate stage, and the original
context/admission is retained. Native journal and send transcripts remain equal. The current public
unavailable projection replaces the removed private throwing token; private DiagnosticTree/clock/
machine callback/fingerprint/close protocols are not adopted wholesale. Complete runtime **160/160**,
complete claims **14/14**, 96 previous literal bodies/four helper bodies unchanged, and static checks pass.
Epoch and consumer-guard counterfactuals cause two and one failures respectively; the second leaves
229 green. Initial control-harness expectation errors remain recorded. Production is restored.
No equipment or alpha clearance is granted.

**Rows 232–233 bind actual managed SDK outcomes during comfort selection.** The actual native runtime
registers with the actual automation provider. Its ON guard is true before entry and expires before
the selection's first native read, identified by a passive original-call tag. Broader claims remain
current under the scoped controller-epoch contract. The matched SDK/HTTP before/after-onSend gates
return refused/zero ON sends or exact UNKNOWN/one ON send while runtime remains active. Original
packet/native ID, claim/revisions, complete pre-entry journal/history and fence transcript remain
fixed; no OFF proof is fabricated. Original journal completion is joined after the held read releases,
then actual selection returns eco. Cleanup retains foreign gates/descriptors and joins actual owners.
The four complete fixtures pass **237/237** (runtime 162, claims 14, comfort 37, SDK 24),
with 98 previous literal bodies and four existing helpers unchanged. Two restored mutants cause three
expected failures. The current scoped epoch/tag replaces old global claims/private writer machinery;
whole fixture-owner/writer and installed-equipment acceptance remain open. Cases 230–231 remain
unresolved because current neutral settle starts with a shared read without the old global fence.
No neutral-read runtime experiment or waiver is claimed.

**Rows 207–208 bind original bootstrap COMMIT-phase failures.** A fresh actual native runtime seeds
original prepared ON history and injects its identical Error before COMMIT or after ACK on the exact
recovery runner. Full journal/branch images distinguish rollback from committed UNKNOWN; configuration,
claims, membership and send/fence transcripts remain exact. Failed startup retires lifecycle, bootstrap,
timer, contexts, outputs, in-flight operations and runtime admission, restores listener counts and
rejects a subsequent public request before SQL. No ON occurs. Complete four-file qualification passes
**239/239** (runtime 164, claims 14, comfort 37, SDK 24). All 99 prior literal bodies/five helpers are
unchanged. Identity wrapping, false cancellation and omitted retirement cause five expected failures;
production is restored and static checks pass. These scoped bindings do not adopt the full retired
TIME/mutation-writer/callback-Q or installed-equipment protocols.

**Rows 205–206 bind enabled publication locks and actual claims loss.** The real SQL/socket lock
service is injected into the managed core value pipeline. Native lock INSERT/DELETE correlate to the
virtual temperature output; the lock is released without expiring the original pre-report claims
capture or held command guard. Actual invalidation closes both. Before-send refuses with zero ON
sends; after-send preserves exact UNKNOWN with one send while the owner stays active. Original
operation/telemetry join, complete ON identity/history remains intact except expected settlement
fields, and release evidence stays null. Retirement precedes cleanup queue joining and the lock table
is empty afterward. Optional fixture injection preserves its five old parameters and omitted-argument
body by TypeScript token erasure proof. Five complete fixtures pass **249/249** (runtime 166, claims
14, comfort 37, SDK 24, locks 8); all 100 prior literal bodies/five helpers are unchanged. Three restored
production counterfactuals cause five expected failures. Initial schema/syntax/lint errors and global
drain timeouts are retained; the blocked await phase is identified without a complete cause finding.
This is scoped original-operation evidence, with no global-drain, private fixture-owner/TIME/writer,
whole provider/SDK, installed-equipment or alpha clearance.

**Row 214 binds a foreign native claim revision while original ON is held.** Actual optimistic SQL
changes only the claim revision and expires the same captured claims permission and original command
guard. Full physical property/channel/device image and complete journal remain equal across the
write. Original SDK returns refused with zero ON sends while runtime stays active. The exact enrolled
operation joins; complete journal membership/all row fields remain intact except the sole ON's
cancelled status, settlement time and fault. Revision +1 persists without release evidence. Six complete
fixtures pass **254/254** (runtime 167, claims 14, comfort 37, SDK 24, locks 8, ownership subscriber 4).
All 101 prior literal bodies/six helpers and the shared fixture remain unchanged. Ignored native
revision SQL and false refused-ON acceptance cause two expected failures; production is restored.
Types/lint/format/ledger pass. This is scoped native outcome evidence without whole private
fixture-owner/TIME/writer, global drain, installed-equipment, provider/SDK or alpha clearance.

**Historical row 198 preparation remained unbound after an executed positive candidate.** Initial missing-definition refusal
was corrected. Even with explicit comfort definition and fresh synthetic qualification before the
actual setpoint-23 override, ambient 21 leads to zero ON entries. Passive evidence records current
claims capture and SDK session but absent qualification, suspended release ordering and UNKNOWN OFF.
The retained proof source stays current while qualification identity differs. Complete cause and
fixture/product attribution remain unresolved. Failed source/report evidence is retained off-source;
no acceptance credit, weakened assertion or waiver is inferred.

**Historical row 198 causal analysis demonstrated a watermark-qualification blocker.** A composed
offline witness runs the actual installation service/loader, managed SDK and SQLite. Bounded script
chunks and floor/switch metadata verify; durable observation is `verified_metadata` at revision 2.
The ownership subscriber changes qualification from true to false on an internal configuration UPDATE
whose comfort value differs only at `temporary_override.wall_watermark_ms`. Clock persistence is
being treated as a catalog mutation. Suppressing that write diagnostically preserves qualification,
but independent member-floor recovery still blocks ON. Both selected attempts remain RED (0 passed,
1 failed, 167 unrelated cases unrun); complete zero-ON/UNKNOWN attribution is not established. Candidate
source/trace/reports remain off-tree and all project source bytes are restored. Counts and production
behavior are unchanged. A fix must retain durable clock evidence and exact native invocation custody
against foreign/rollback writes, without reviving lost authority or bypassing floor/OFF/drain barriers.
This is a blocker record, not a repair or whole-feature clearance.

**Row 198 now has a scoped current binding and locally qualified clock repair.** Every observed watermark
persists in a separate monotone controller/override row, leaving authoring and installation images unchanged.
Legacy JSON participates in recovery's maximum; migration 53 preserves it and restores the current high mark
on downgrade. SQL refuses lower/replaced/deleted clock evidence while its controller remains. No authority
exemption or epoch restoration is introduced. The actual loader/SDK/SQLite/locks test retains qualified OFF/drain
and a newer safe floor packet, then observes original ON ID, accepted journal outcome and no-op invariance.
Foreign configuration/rollback/callback controls remain closed; future clock evidence inhibits rather than
renews output. All nine complete files pass **501/501** with 102 old runtime bodies and six helpers unchanged.
Restoring the old writer causes the expected positive failure; candidate source is restored. Full backend/E2E
and completed exact-head source review remain gates. The [detailed row binding](original1473-residual-acceptance.md)
records offline fixture inputs, migration/default fidelity, initial failures and private-protocol limits.

The history oracle was independently challenged with three controlled production mutants: oldest prepared command first, duplicate returned rows and a corrupted proof ID. Each caused both history cases to fail at the intended predicate, uniqueness or complete-row assertion (six expected failures total). The production file was restored byte-for-byte before the complete **147/147** runtime rerun passed.

**Row 261 binds the required-method invariant.** Ordinary object-prototype identity, replacement and removal are tested in `creation-capture.spec.ts`. Actual thermostat authoring refuses a missing required catalog method before caller input/SQL and refuses replacement/removal after entry capture before SQL/publication. The generic helper intentionally retains optional absence; that behavior is tested separately and is not called required-method admission. Both complete affected files pass 113/113 with all 47 existing literal bodies unchanged. Three counterfactual mutations cause four expected assertion failures; production is restored byte-for-byte. [The follow-up](original1473-residual-acceptance.md) and canonical ledger retain body/source hashes and limits. These method controls grant no additional runtime/provider/SDK acceptance.

A direct row-111 adaptation requiring the old `context.admission` to expire on an ordinary poll failed and was withdrawn. That current field is a claims-membership snapshot retained across neutral rotations; ON separately requires the exact current context and epoch. Two executable witnesses now bind those boundaries: the idle original interval publishes a fresh decision without ON, and an actual original interval invalidates a held native ON guard that was true at entry. The latter uses no explicit poll, fake timer advance or replacement interval. The original owner stops before the held gate opens, and the complete runtime rerun passes. Legitimate retained OFF facts were not weakened.

The journal comparison already exposed incomplete single-identity checks and led to the multi-identity
strengthening above. That correction does not clear unrelated original controlled SDK, startup, clock, negative
observer or fixture-ownership schedules. #1473 remains frozen and is not superseded. #1462 and alpha clearance
remain open until required residuals are resolved or explicitly dispositioned with evidence.

Hosted CI on preparation head `dd9b9b8549c72d0796aa618648730e145d287337` passed all 14 checks; [the CI Tests run](https://github.com/FastyBird/smart-panel/actions/runs/41314503661) succeeded. It includes the real issued-OFF enhancement but predates the lifecycle correction. The later 46468ac backend failure and fixture correction are recorded above; fresh exact-head CI remains a gate. CodeRabbit skipped the draft, and that skip grants no review approval.

## Historical follow-up after #1508 merge

PR #1508 was squash-merged as `4a3033e1d6050252a5b45fc9972b6f958e463a22`. Its exact reviewed
head `3af1c1be7f8bb21a757b60feefa935331c3fe0c7` passed all 14 checks in
[CI Tests 41354064958](https://github.com/FastyBird/smart-panel/actions/runs/41354064958):
726 backend suites / 13,306 tests (one existing skip), 29 E2E suites / 424 tests, OAuth 32/32,
Homey 250/250 and the test-only thermostat simulator 30/30. CodeRabbit completed exact-head review
without actionable comments. The separate local 362 PASS / 62 FAIL E2E run and unattributed SQLite
ownership timeouts remain retained in #1508; green hosted CI does not explain those failures.

[The residual acceptance follow-up](original1473-residual-acceptance.md) enumerates exactly the 139
rows that were unbound at branch entry and the evidence required to close each. Rows 116–119, 195–198, 203, 205–208, 214, 221, 228–229, 232–233, 241–243 and 261 now have
tested current bindings (thirteen scoped and ten replacements); 116 remain unbound. The initial 122 dispositions retain
their limits. Neither the checklist nor this narrow binding grants alpha or installed-equipment clearance.

### Hosted migration-compatibility follow-up

The backend job on `caa785a` passed all 727 unit suites / 13,331 tests (one existing skip), then failed
36/424 E2E cases. Thirty-four shared HTTP setups expected the old migration count; upgrade expected the
old final migration; legacy48 bootstrap tried clock triggers over a table introduced only by migration53.
Exact inventory/name assertions now include migration53, upgrade/reopen check its empty clock store, and
bootstrap installs clock triggers only over an existing table. Legacy48 retains complete schema/data
identity and explicitly creates no clock table or trigger. Revocation/mutation methods are unchanged.

A new complete local E2E invocation passes **424/424, all 29 suites, zero skipped**, with owned physical
Influx and pinned tooling; the four ownership consumers pass too. Process-group and container absence
were verified before lease release. The initial hosted RED remains recorded and is not called flaky.
Fresh exact-head hosted CI and completed nonblocking source review remain required. Counts stay
**14/139 bound, 125 unbound**; equipment/alpha and private caller/TIME/writer/global-drain limits remain.

### Counter-only follow-up

Row 195 now binds the actual native graph-counter UPDATE under a real eco override and installed-loader
qualification. The original claims capture, exact active override lease/budget, runtime context/epoch,
qualification and SDK session remain current/identical. The counter advances once with native ACK; every
other physical table and complete schema remain equal. No send/fence transcript changes, no ON occurs,
and ordinary reserved-actuator ON still refuses. Current comfort currentness replaces only the retired
joined intent API for this neutral effect; private TIME/caller/writer/ABA/global-drain adoption is not granted.

All six native-consumer files pass **262/262**, preserving 104 old literal runtime bodies and seven helpers.
A restored production control classifying the counter as catalog mutation fails at original claims
currentness immediately after the actual UPDATE. Production and shared fixture remain unchanged.
Entry `8afced1` hosted CI is green, but CodeRabbit skipped the draft; fresh exact-head checks and completed
source review remain gates. The current residual status is **15/139 bound, 124 unbound**, without equipment
or alpha clearance. Historical RED results and prior limits remain recorded.

### Qualified release follow-up

Rows 196–197 now bind actual runtime/SDK OFF/drain and the original qualified claim UPDATE through graph
prelude and native transaction completion. Clean mode commits release evidence and frees ordinary admission;
qualification loss at the awaited UPDATE rolls back and preserves the full releasing reservation. Both send
new OFF fences and no ON. Qualification is explicitly renewed at the existing offline synthetic fixture boundary
after current requestRelease revocation; physical installation or automatic loader renewal is not certified.

All six complete native-consumer files pass **264/264**. All 105 previous literal bodies and seven helpers,
production and the shared SDK fixture remain unchanged. Omitting the original post-UPDATE proof recheck
fails at COMMIT instead of required ROLLBACK; the clean control passes, and original production is restored.
Initial inhibited installed-loader preparation and the corrected OFF-transcript assertion remain retained.
The entry a276bca workflow is green, while the draft source review remains skipped. Fresh exact-head checks
and completed review remain gates. Current residual status is **17/139 bound, 122 unbound**; retired private
caller/continuation, observer substitution, cross-case/global-drain and installed-equipment limits remain.

### Recovery retry follow-up

Row 203 now has a current replacement binding for genuine native recovery failure, complete rollback,
lifecycle cleanup, same-instance retry and distinct fresh B surviving stale A stop. Original claims captures
occur only after the recovery transaction and its exact original structural owner end. Current diagnostic
recovery is claims-neutral and performs no extra claims refresh; this explicit current-contract replacement
does not certify the retired post-release refresh callback or private caller/global-drain protocol.

All six complete native-consumer files pass **265/265**. All 106 previous literal bodies and seven helpers,
production and the shared SDK fixture remain unchanged. Omitting failed-start retirement makes A remain
active and fails the new test. Original production is restored before the full positive suite. No ON occurs;
qualification/network/storage/metadata remain offline software inputs. Entry `4668927` CI is green, draft review
remains skipped, and fresh exact-head CI/review remain gates. Current residual status is
**18/139 bound, 121 unbound**, without equipment or alpha clearance.

### Recovery override-budget follow-up

Row 221 has a current replacement binding across both actual native recovery UPDATE acknowledgements,
ended original structural ownership and a fresh runtime-admission claims generation. Original override lease
identity/deadline remain unchanged while old claims capture stays closed. The actual offline loader
renewal queue is joined; config/slot rows stay equal, and seeded prepared ON becomes unknown or
confirmed with its original restart fault. At original monotonic +30100ms, before wall-clock expiry, repeated
old/fresh currentness reads remain false and the same lease is expired without any extension. No ON occurs.

All six complete native-consumer files pass **266/266**; 106 previous literal bodies and seven helpers,
production and shared SDK fixture remain unchanged. Discarding the process-local budget at restart fails
its original lease/currentness/deadline assertions after both native effects; production is restored. Current
claims-neutral recovery and public budget currentness replace only the old refresh/joined-intent boundary.
Private caller/TIME/observer/cross-case/global-drain and equipment protocols remain unadopted. Entry `82d8299`
CI is green, draft review remains skipped, and fresh exact-head CI/review remain gates. Current residual
status is **19/139 bound, 120 unbound**, without equipment or alpha clearance.

The original full265/1 RED remains retained with its exact cause UNKNOWN. A controlled 1200ms native
preparation delay proves that the wall-expiry case can consume its still-running monotonic budget before
queued ON. Its single monotonic input freeze preserves every original assertion and order (statement-erasure
proof), and the delayed coherent-clock control passes. No production timeout or expiry rule is changed.

## Historical CI causes still unattributed

| Recorded run | Remaining limit |
| --- | --- |
| #1514 `d94074b` | The original five-second catalog setup timeout did not recur in one diagnostic retry; its precise hook delay remains unknown. |
| #1516 `02ffac8` | The original E2E `SQLITE_BUSY` remains unattributed. The separate #1519 comfort-maintenance fixture does not diagnose it. |
| #1509 `bdf248369`, [run 41505398494](https://github.com/FastyBird/smart-panel/actions/runs/41505398494) | B's genuine login failed with `Access token can not be saved` before its parent PATCH. The native persistence cause was not captured. A separate complete run passed. |
| Unpublished local auth-preparation candidate | Its complete run remained 423 PASS / 1 FAIL on an independent successor `UNIQUE(identifier, channelId)` failure; the competing writer is unknown. The candidate was restored and never published. |
| #1517 `e9da43d`, [run 42090174469](https://github.com/FastyBird/smart-panel/actions/runs/42090174469) | E2E was 423 PASS / 1 FAIL with `SQLITE_BUSY` after the captured selected A and B commits succeeded. The exact failing query/caller remains unknown. Later fixture continuation and self-wait corrections are qualified separately. |

Later green runs preserve these original failures and do not establish their causes.

## Release preparation

The existing `alpha-release.yml` remains the publisher. Historical preparation addressed two demonstrated release issues:

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

- [x] Reconcile 23 scoped/replacement residual bindings, including rows 116–117 through merged #1528 and rows 118–119 through merged #1525; retain the other 116 entries as open.
- [ ] Finish original #1473 semantic case bindings and any required executable residuals.
- [ ] Complete current software/static/generated-contract and source-review gates; reconcile #1293/#1458 against their entire criteria.
- [x] Merge delivery PR #1508 after exact-head green CI and completed nonblocking main review. The residual acceptance follow-up still requires its own checks and review.
- [ ] Dispatch the existing alpha workflow from the accepted source; record the actual selected version and version-sync commit.
- [ ] Verify tag/source/package metadata and completed package, application, Panel, Raspbian, native Docker architecture and manifest jobs.
- [ ] Record published assets/checksums and release notes with explicit remaining installed Shelly/HA/Zigbee/Apple Home qualification.

No next alpha version is certified here. #1447 is not closed by a child software or release checkmark.
