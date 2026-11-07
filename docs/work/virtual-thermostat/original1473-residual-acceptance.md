# Remaining original thermostat acceptance

Historical branch entry is merged PR #1508 (`4a3033e1d6050252a5b45fc9972b6f958e463a22`).
Its exact reviewed head `3af1c1be7f8bb21a757b60feefa935331c3fe0c7` passed all 14 checks,
including 13,306 backend tests and all 424 E2E cases. CodeRabbit reported no actionable comments.
The separate local 362 PASS / 62 FAIL E2E result and unattributed SQLite ownership timeouts remain
recorded in #1508; hosted success does not establish their cause.

**Status: partial inventory reconciled at main `9b7392ec28d6586ef678bab7e819c48519e3e13e`, 2026-11-07;
35 of the original 139 residuals have tested current bindings, and 104 remain unbound.**
This list grants no complete original-fixture, provider/SDK, installed-equipment or alpha clearance.
The branch-entry 109 scoped invariant bindings, seven replacement bindings and six ported descriptor rows
are retained with their existing limits. They are outside this residual work inventory.

## Fixed inventory

[The existing 261-row ledger](original1473-case-map.json) remains the identity and disposition source.
At branch entry, exactly the 139 rows with `disposition: residual_no_current_case_bound` were listed below.
The fixed inventory remains intact as individual current bindings are added to the canonical ledger.
Historical 200 PASS / 61 FAIL results are not current defect counts.

- Source ledger SHA-256 at branch entry: `fa221e19d5bc1cd4ee5168b4e3357c38a4342fa641d22f22dd62702dfe52c9be`.
- Frozen original source commit: `2c19907c361ca66540e8f5d05fe24a5ff9cab0c2`.
- Frozen original source SHA-256: `150ab6a15587b93358c84f6ab1889e43617e3906f05f548d3e1fd46a947b8608`.
- Per-row original body hashes and expanded-case parameters remain in the source ledger.
- #1473 remains frozen; #1462 and parent #1447 remain open.

| Area                                         | Cases at follow-up entry |
| -------------------------------------------- | -----------------------: |
| Retired fixture ownership                    |                        7 |
| OFF settlement and native safety debt        |                       54 |
| Comfort, claims and original SDK send guards |                       63 |
| Named original OFF completion                |                        3 |
| Issued setup and cleanup ownership           |                        8 |
| Cleanup observer ordering                    |                        1 |
| Held body gate with real SQLite consumers    |                        2 |
| Required-method refusal                      |                        1 |
| **Total**                                    |                  **139** |

## Evidence required before closing a row

1. Read the complete original body and its setup, dependency calls, controlled ordering, injected failures
   and assertions. Matching a title or only a return value is insufficient.
2. Bind an executable current test by file, full expanded title, test-body hash and relevant production
   source hashes. Retain the original ownership, chronology, multiplicity and complete native effects.
3. If a retired internal API changes the schedule, document the supported current boundary and exact
   semantic difference. API retirement alone grants no waiver. A pure helper cannot stand in for real
   provider/SDK, transaction, dispatch or original completion evidence.
4. Validate the complete affected fixture and appropriate consumer suites. For new safety assertions,
   retain a discriminating negative control where needed to show the intended regression is caught.
   Keep initial failures, unknown causes and skipped coverage explicit.
5. Update only the evidenced row disposition and recomputed counts in the canonical ledger, then
   check its box here with a link to that binding. Leave unresolved rows open.

Row 261 binds required-callsite missing-method refusal as detailed below. The shared helper's optional
absence behavior remains distinct; a standalone `current()` result does not satisfy that refusal.

Before this inventory summary becomes ready, reconcile every one of its 139 entries against the ledger,
preserve the initial 122 dispositions, and distinguish the 35 bound entries from the 104 still open.
Run required exact-head checks and obtain completed nonblocking source review. Further executable residuals
belong in separate small PRs; this summary does not close them. Actual alpha publication and installed-equipment
qualification remain separate gates in #1462.

## Current binding qualification

Merged #1525 adds the two scoped held-fence bindings below; its original 180-case source and controls
remain attributed under `heldFenceAdoption`. The current source includes merged #1529 at
`1823db1a8ef5bce16db81545374ecb7c38d4ceac`, whose complete tree equals reviewed head
`711ef0231a134ecc9a4f9cf385c464ab4beac256`. All CI checks passed and CodeRabbit completed review
without actionable findings. The two #1528 peer-debt variants now additionally bind original rows 116–117 under the
explicit ordinary public-poll adaptation detailed below.
At that prior #1529 source, the complete local runtime file passed **182/182**, zero failures/skips; report SHA-256
`a45f18eb83a3420f36fe2de16d8dcbbc947fee0a962e70daf09b19b9bf9ecb73`.
[The exact-head backend job](https://github.com/FastyBird/smart-panel/actions/runs/42307639627/job/128200949238)
passed 727 ordinary unit suites with **13,349 passes and one existing unrelated Zigbee mapper skip**;
all eight native-consumer files explicitly passed. Ordinary E2E passed **426/426**, zero skips, in 29 suites.
Job-log SHA-256: `0e1b61c37c69e9ac767d855a8073401ca03572e1f5cc0174a42782ea0908c714`.
That earlier measurement combines local runtime and hosted consumers. The current additive batch passes **394/394** in one complete local eight-file invocation, including **186/186** runtime cases; report SHA-256 `51d89fc4706527a9b4c0ebe9de1d668c7ad0a94db120567ac04445aea941b834`. Fresh hosted CI and completed review remain delivery gates.
All **158 witness bindings across 157 total bound rows** match current files and bodies.
The thirty-five residual bindings are twenty-five scoped invariants and ten replacements.

The preceding #1524 eight-file aggregate passed **385/385** at its recorded source, including runtime 177
and creation capture 12; report SHA-256 `2c304761e3d5aa28bbdab39af4728e5d90f11fa437691168c9057c136a3e9488`.
Its 52 hash-verified report references and twenty per-row negative reports (29 expected failures, five
passing selected controls) remain historical; those controls were audited, not replayed after this addition.
The #1529 strengthening changes only the held-fence shared body and its entry gate; all 109 other literal
runtime bodies and 62 other helper declarations remain token-identical;
all 146 preceding witness bodies remain unchanged, as do 110 prior literal runtime bodies and 63 prior helper declarations in this additive batch.
Production is unchanged. The immutable prior ledger and explicit historical snapshots retain older source/report
identities. The two #1525 scope-omission controls below qualify their original 180-case source; they were not replayed after #1529.
All frozen original identities remain unchanged.

For row 243, A's OFF identity comes from its original send/enrollment and is matched independently to SQLite.
B's OFF identity is read from the new journal row and checked through its proof transcript; B's transport
send commandId is not captured. Each of its two retained controls has one failure, zero passes and 176 unrun.
These limits do not adopt the retired private receipt/observer protocol or qualify installed equipment.

## Historical binding sequence

The following measurements and CI/review statements describe the original binding checkpoints.
Their older test totals remain attributed to those sources; current qualification is recorded above.

### Row 261: ordinary prototype identity and required methods

[The canonical row binding](original1473-case-map.json) retains the frozen original body identity and
records current test-body and production hashes. The ordinary-prototype case in
`creation-capture.spec.ts` preserves the captured function and refuses later replacement or removal.
A separate control keeps the generic helper's deliberate optional-absence behavior explicit.

The real `VirtualThermostatAuthoringService.create` callsite is exercised by
`virtual-thermostat-authoring.integration.spec.ts`: removing its required catalog method before entry
refuses before reading caller input, SQL or publication. Replacing/removing that method from a caller
getter after capture likewise refuses before SQL/publication without invoking the replacement.
Descriptors are restored exactly after each case. This is a replacement binding for the original
required-method invariant, not whole-helper or runtime/provider/SDK equivalence.

Both complete affected files pass: **113 tests, zero failures or skips**. All **47 pre-existing literal
test bodies** are token-identical; four new literal bodies expand to five cases. Types, strict lint
and formatting pass. Three controlled production mutations cause four expected assertion failures:
always-current descriptors, input read before the required method, and ignoring the required-method
pin. Original production bytes are restored. Removing one redundant early assertion alone did not
break these cases because a later assertion still runs before SQL in this fixture; that observation
is retained and grants no stronger coverage.

Exact-head hosted CI and source review for this follow-up remain required. No other original row is
closed by these method controls.

### Rows 241–242: refused or unknown original OFF completion

The two variants in `virtual-thermostat-runtime.service.spec.ts` reuse the same
`prepareIssuedOffJournalSettlement` helper as the existing positive rollback/ACK cases. Accepted
remains its default. The helper preserves the original send receiver, arguments, Promise and result;
it observes the original OFF outcome and its saved SQLite row. The observed outcome must match the
selected variant, so a generic guard refusal cannot stand in for unknown. A refused or unknown outcome rejects
**test preparation**, before any explicit second settlement request. The product public method's
return contract is unchanged.

The tests fix the two-ID K from actual native INSERTs: a seeded accepted ON, matching the original
case, plus an actual runtime-issued OFF. They independently match the original OFF send ID and retain
full baseline rows. They declare both permitted no-settlement/known-ACK grammars before
callbacks and check exact journal membership/claim/action/status, the complete P0 transcript,
retirement call arguments/order/multiplicity and one additional OFF attempt with no ON. The selected
grammar comes from the independently read native ON status, never a callback-chosen expected result.
Ordinary feedback is suppressed in this controlled schedule, and only one explicit installed request
is issued. This does not certify the former private named S0/S1 receipt/child-frame protocol or the
retired-A/foreign-descriptor case 243. Both old and current R68 lanes use controlled claim, value and
transport ports; real SQLite effects do not grant installed-provider/SDK authority.

The complete runtime fixture passes **157/157, zero failed/skipped**. All **94 existing literal test
bodies** are token-identical; the shared helper is extended with an explicit outcome and observation
of the original result. The accepted default and existing positive journal cases remain green. Types
and strict lint pass. A production counterfactual which saves refused/unknown OFF as accepted causes
both new variants to fail the exact native journal assertion. Production is restored byte-for-byte.
Body/source/helper hashes and the semantic difference are recorded in the canonical rows.

### Row 243: retired A completion and distinct B observer custody

The current runtime test holds an actual issued OFF of A, retires A, starts a distinct B and
waits for B's own actual OFF completion before holding its original proof. A public inspection of B
is proven queued before A resumes. The test keeps a seeded accepted ON, as in the original case;
it does not claim an actual ON send. Full baseline rows, all native IDs, P0 and the single B proof
transcript are checked. A's late transport refuses; its enrolled original operation and public
request reject with the same original journal-image error. B's restart image, context, lifecycle,
command image, listener descriptor and pending public inspection remain unchanged. Only after B's
proof is released can the three pending identities confirm and retire once. No ON is attempted.

A transparent, instance-owned Map enrollment observer forwards the original call and Promise.
Its cleanup reports a foreign enumerable-flag rewrite and leaves it intact. The deliberate rewrite
is relinquished only after both owners and their consumers retire. The current public journal
failure replaces the removed private named S0/S1 receipt, and the current listener descriptor is
checked instead of removed serviceFeedback infrastructure. B's extra actual OFF is explicit.
Dispatch feedback is isolated; bootstrap and public inspection still forward their original work.
These are supported-current invariant bindings, not whole fixture/provider/SDK equivalence.

The complete runtime fixture passes **158/158**, with all **95 previous literal bodies** and the
accepted-OFF helper token-identical. Removing the production lifecycle guard makes the new test fail
on forbidden late A feedback. Ignoring foreign descriptor enumerability makes its cleanup refusal
assertion fail. Both mutations are restored byte-for-byte. Initial preparation failures are retained:
a TypeScript narrowing error, new-helper lint errors corrected without suppressions, then a native witness showing that B bootstrap can complete before its
subsequent proof. The final test joins B's original OFF and explicitly requests its next settlement.
Types, strict lint, formatting and ledger checks pass. No production change or broader clearance.

### Rows 228–229: native qualification observation and absence ABA

Both cases now use the actual SQLite runtime and claims service with the existing managed test guard
fixture. Qualification is explicitly installed by test setup, not inferred from a device. The first
case reads available qualification without capture, installation, refresh, evaluation, events, SQL or
sends. Actual revocation closes the original admission; the same context/admission remains present
while public diagnostics withdraw qualification and activity. The second case first loads a genuine
fresh context during qualification absence. It proves original admission current and qualification
unavailable, installs evidence transiently, then revokes it. Native qualification is available in the
middle, but the original admission stays closed through both transitions; diagnostic reads never
recapture it. Complete native journal rows and send transcripts remain unchanged.

The current unavailable public projection replaces the removed private diagnostic-token exception.
This is a supported-current invariant binding, not wholesale DiagnosticTree, clock, machine callback,
fingerprint or close-protocol adoption. No equipment/SDK authority is inferred from test evidence.

The complete runtime passes **160/160** and the complete claims consumer passes **14/14**,
with zero failures/skips. All **96 previous literal runtime bodies** and four relevant setup/settlement
helpers are token-identical. Two restored production counterfactuals cause **three assertion failures**:
weakening epoch equality fails both cases; bypassing the original admission in observation fails 228,
while 229 remains green. No sole-guard coverage is claimed. Initial control preparation stopped on an
ambiguous mutation count before execution; later evidence corrected its expected failure count from
two to one for the consumer mutation, without rerunning that control. Types, strict lint, formatting
and ledger consistency pass. Production source remains byte-identical.

### Rows 232–233: original managed SDK outcome during comfort selection

The existing native setup remains unchanged. A separate factory settles/stops its prior owner and
starts an actual runtime with the actual automation provider injected, exercising real registration.
An original ON is held at the managed HTTP before/after-onSend boundary after matched SDK inspection.
Its original guard is true before comfort selection and false synchronously at selection entry,
before the first real config read. That read is identified by a passive tag on the exact public call.
The current contract revokes the controller epoch; the broader claims snapshot stays current.

Releasing ON while the read stays held produces refused/zero ON sends or exact UNKNOWN/one ON send.
Both results precede runtime shutdown. Complete pre-entry native IDs, claim/revisions and history
remain fixed; no OFF/drain fence is invented. Only after releasing the read does the original journal
operation finish cancelled/unknown. All other complete rows, journal membership and fence history
remain equal. The actual selection commits eco. Original runtime/service retirement, gate opening,
operation joining and foreign gate/descriptor checks complete cleanup.

All four complete fixtures pass: runtime **162**, claims **14**, comfort **37** and SDK session
**24** (**237 total**, zero failures/skips). All **98 previous literal runtime bodies** and four
existing helpers are token-identical. Removing entry revocation fails both variants; promoting SDK
UNKNOWN to accepted fails after-send while before-send stays refused. All production bytes are
restored. Types, strict lint, format and ledger checks pass. The initial preparation type error used
a retired cleanup method; it was corrected to the actual managed-service stop before execution. A later lint finding
on direct finally throws led to buffered cleanup failures with original-error priority; final controls
and all four fixtures were rerun on that version.

Scoped controller revocation and the passive call-root tag replace the old global claims fence and
private mutation-writer phase. This grants no whole fixture-owner/writer protocol or installed-device
clearance. **230–231 remain open:** neutral public settle begins with a shared read and does not take
the original global claims fence. No runtime experiment, defect attribution or waiver is claimed for
that separate seam.

### Rows 207–208: original bootstrap failure before COMMIT and after ACK

A fresh actual runtime starts over the actual native SQLite/claims/graph fixture after its prior owner
retires. A prepared ON is persisted as original startup history; no actual ON is invented. Commit hooks
are pinned to the actual recovery runner by its journal UPDATE and command ID. The test proves exact
hook counts and returns the identical original Error object in both stages. Before COMMIT the entire
journal and branch images stay equal; after ACK only expected UNKNOWN/fault and branch suspension
fields change. Complete journal membership, configuration and claim rows remain equal.

Failed startup leaves no active lifecycle, bootstrap, timer, context, output, in-flight operation or
registered runtime admission. Listener counts return to baseline. A later public request refuses
without SQL. Send/fence transcripts remain unchanged, no ON occurs, and the observer is removed.
This binds the scoped public bootstrap/native outcome invariant; private TIME/mutation-writer and
callback-Q protocols or installed-equipment acceptance are not adopted wholesale.

All four complete fixtures pass **239/239**: runtime 164, claims 14, comfort 37, SDK session 24.
All **99 previous literal runtime bodies** and five existing helpers remain token-identical. Three
restored production counterfactuals cause five expected failures: wrapping the same-message original
error fails both stages; replacing UNKNOWN with cancelled fails after ACK; skipping failed-lifecycle
retirement fails both stages. Types, strict lint, formatting and ledger checks pass. Production stays
byte-identical. No other original row is closed by these two bootstrap cases.

### Rows 205–206: enabled SQL publication locks and genuine claims loss

The actual enabled `PropertyValueLockService` is injected into the managed fixture's actual core
`PropertyValueService` at creation. Native INSERT and DELETE statements are correlated to the virtual
temperature output ID, so physical input writes alone cannot satisfy this witness. The output lock is
released while the original ON remains held; the same claims capture made before reporting and the
original command guard stay current. Actual `claims.invalidate()` then closes both. Managed SDK
before-send returns refused with zero ON sends; after-send returns exact UNKNOWN with one ON send.
These outcomes are observed while the runtime remains active.

The exact original command operation and telemetry join. Its sole native ON retains all original row
fields except expected status, settlement time and fault; no claim release evidence is invented.
The runtime retires before cleanup queues join, and the native lock table is empty afterward. The
omitted sixth fixture argument retains its original disabled-lock construction and five parameters;
a TypeScript token erasure proof verifies that default path byte-for-token.

Five complete fixtures pass **249/249**: runtime 166, claims 14, comfort 37, SDK 24, value locks 8.
All **100 previous literal runtime bodies** and five old helpers are unchanged. Bypassing enabled
SQL locks fails both variants, ignoring actual claims invalidation fails both, and promoting SDK
UNKNOWN to accepted fails after-send. Production is restored. Types, strict lint and formatting pass.

Initial duplicated-schema setup, diagnostic syntax and lint failures remain recorded. Global settle
and queue-drain preparations timed out after genuine claims loss; a passive phase witness located
the blocked await, without establishing its complete cause. This scoped binding joins the original
operation and retires before queue cleanup. It grants no global drain, former private fixture-owner/
TIME/writer, whole provider/SDK, installed-equipment or alpha clearance. Other rows remain open.

### Row 214: actual foreign claim revision while original managed ON is held

The actual runtime/claims/SDK fixture holds its original before-send ON. The actual raw optimistic
claim UPDATE retains the original SQL and all three bindings. The same claims capture and original
command guard become false. The complete physical property/channel/device image and native journal
remain equal across the foreign write; the complete claim row changes only revision +1. The original
SDK result is refused while the runtime stays active, with zero ON sends. Its exact enrolled operation
joins. Complete journal membership and every row field remain equal except the original ON's expected
cancelled status, settlement time and refusal fault. The new revision persists and no release evidence
is invented. Cleanup retires before joining queues and preserves foreign gate/descriptor custody.

Six complete fixtures pass **254/254**: runtime 167, claims 14, comfort 37, SDK 24, value locks 8,
ownership subscriber 4. All **101 previous literal bodies** and six existing helpers remain unchanged;
the shared fixture is unchanged. Ignoring the actual revision SQL leaves the old capture current and
fails the first counterfactual. Promoting refused ON to accepted fails complete journal equality in
the second. Production is restored. Types, strict lint, formatting and ledger checks pass. The initial
Promise-conditional lint failure is retained. This scoped binding adopts no whole retired private
fixture-owner/TIME/writer, global drain, installed-equipment, provider/SDK or alpha protocol.

### Historical row 198 preparation: unresolved positive override/bookkeeping candidate

The first preparation correctly refused an override before explicit comfort definition. After that
setup correction and fresh synthetic qualification before override, the actual setpoint-23 override
still reaches zero ON entries with ambient 21. A passive witness records current claims capture and
SDK session, but missing qualification, suspended `release_ordering_unreconciled`, and latest OFF
UNKNOWN. The retained proof source remains current while its qualification identity differs. Complete
cause and fixture-versus-product attribution remain unresolved. The failing positive candidate and
diagnostic are retained outside tracked source. No assertion was weakened and row 198 stays unbound;
these observations grant no acceptance credit or equipment/alpha waiver.

### Historical row 198 causal follow-up: watermark persistence revokes renewed qualification

A composed offline candidate now uses the actual installation service, loader, managed SDK, native
SQLite and enabled value locks. The SDK verifies the generated script in bounded chunks and checks
floor/switch/peripheral metadata. The loader persists armed, `verified_metadata` evidence at
configuration revision 2. This removes the missing-loader ambiguity from that isolated experiment.

A transparent original ownership-subscriber call records qualification **true before** a native
configuration write and **false immediately afterward**. Consecutive comfort bindings differ only at
`temporary_override.wall_watermark_ms`; the write changes neither intent revision nor actuator
bindings. `VirtualThermostatComfortService.settle` persists this clock evidence, while the ownership
subscriber treats the configuration UPDATE as a catalog mutation and revokes qualification. Provider
availability remains current. This establishes a concrete blocking path in the current composition.

Diagnostic-only suppression of watermark persistence preserves qualification and removes its missing-
qualification refusal. It **does not make the positive case pass**: independent member-floor recovery
remains latched. Both selected runs are **0 PASS / 1 FAIL**, with 167 unrelated cases not run. The
candidate, exact native traces and failed reports remain off-tree. Project sources are restored
byte-for-byte; no runtime/test/support change is adopted. Other historical causes remain unresolved.
Counts stay **13/139 bound, 126 unbound**.

The repair must retain durable watermark/rollback detection and distinguish the original internal
metadata invocation from raw, rolled-back or identical foreign callback writes through native ACK.
A runner/query/parameter match alone is insufficient, and old epochs/captured authority must not be
revived. Fresh safe-floor and OFF/drain recovery remain mandatory. No production fix or complete
case-198, provider/SDK, installed-equipment or alpha clearance is granted here.

### Row 198: installed bookkeeping, monotone clock persistence and original managed ON

The current binding now passes through the actual installation service/loader, native claims and runtime,
registered automation provider, managed SDK adapter, SQLite and enabled property locks. Generated script
chunks and floor/switch/peripheral metadata verify using offline fixture inputs. After the actual setpoint-23
override, the test retains the qualified OFF/drain barrier and supplies a newer safe floor packet; it never
forces a clear latch. Actual ON occurs once, under the original current claims capture. Its independently
observed packet ID matches the native INSERT and complete accepted journal outcome. Runtime/branch writes
and derived-temperature lock INSERT/DELETE occur. A subsequent no-op decision preserves the original capture,
complete journal, sends and fence transcript. The same PropertyValueService serves runtime and SDK fixture.

The production fix stores every observed wall watermark in a separate monotone row bound to controller and
override identity. It changes neither configuration/intent revision nor installed evidence. Recovery takes the
maximum of legacy JSON and the clock row. SQL guards reject decreasing UPDATE/INSERT OR REPLACE, identity
changes and deletion while the controller remains. Incremental migration 53 preserves legacy data; downgrade
copies the current identity's high watermark back into JSON while retaining invalid legacy evidence. Clock rows retain recovery history until controller
deletion. Original native final validation and COMMIT ACK protect settlement. No query/runner callback gets an
authority exemption, and no old epoch is restored. Explicit null legacy evidence still inhibits recovery.

Foreign same-value, rolled-back and callback configuration writes still revoke qualification permanently for
the captured permission. An identical monotone clock callback can only repeat a recovery lower bound, with
no configuration/source/claim exemption. A future foreign clock inhibits demand without extending expiry.
The omitted-artifact SDK fixture reduces to its original parsed AST, including literal legacy evidence IDs.

All nine complete affected files pass **501/501, zero failed/skipped**: runtime 172, comfort 39, selection 182,
installation 57, claims 14, SDK 24, value locks 8, ownership 4 and migration 1. All 102 previous literal runtime
bodies and six helpers remain token-identical. A final migration-only correction preserves invalid legacy null/string/boolean evidence on downgrade; its complete one-case file passes again. Restoring only the original JSON-watermark writer makes the
positive fail at release ordering (0 passed, 1 failed, 171 unrelated cases unrun); the candidate is restored.
Final lint-only type assertions erase to the same JavaScript as the executed runtime and SDK fixture.
The first candidate type error and the initial snapshot observer's refusal at the new clock-only commit remain
recorded; the authoring observer now selects its own commit and checks clock evidence independently.

This closes only the scoped business invariant of row 198. The retired private caller/TIME/writer/cross-case
cleanup protocol, global drain, whole provider/SDK, equipment and alpha remain outside this binding. Actual
storage and network I/O use controlled responses, and software attestations certify no installed equipment.
Complete exact-head backend/E2E CI and nonblocking source review remain required. Other historical causes
are not reclassified. The follow-up is **14/139 bound, 125 unbound**.

### CI follow-up: complete migration inventory and legacy catalog bootstrap

The [backend job on caa785a](https://github.com/FastyBird/smart-panel/actions/runs/41398179618/job/125124008902)
passed all 727 unit suites / 13,331 tests, with one existing skip, then failed E2E: 388 passed and 36 failed
in three files. Thirty-four HTTP cases stopped at their shared fixture's old migration-count assertion
(expected 53, received 54). The upgrade case expected migration 52 as the last applied migration; the new
migration 53 correctly ran. The legacy catalog case deliberately opens only migrations through 48, where
ownership bootstrap wrongly attempted to create clock triggers over the absent later table.

The HTTP fixture now retains an exact count of 54, explicitly requires migration 53 and still compares the
complete applied migration inventory. Upgrade retains all published alpha64 migration hashes and old
identity/data assertions, verifies the new last migration, and checks the empty clock store before and after
reopening. Ownership bootstrap installs clock triggers only if their store already exists. The legacy48 test
retains complete schema/data equality and explicitly verifies that no clock table or trigger was created.
Bootstrap does not silently migrate the old schema. Every other ownership-class member, including its
catalog mutation and qualification-revocation methods, remains token-identical.

The corrected complete E2E invocation passes **424/424 across all 29 suites, zero failed/skipped**, using
owned physical Influx1.8 and pinned Node24/pnpm10.12. Four complete ownership consumer tests also pass.
The original Jest process joined; its process group and owned Influx are independently absent before lease
release. The preceding 501 native-consumer run remains attributed to the clock-repair source; it is not
presented as newly rerun. The hosted failure remains retained, with no flaky or unrelated-cause waiver.

No original-case disposition changes: **14/139 bound, 125 unbound**. Fresh exact-head hosted CI and completed
nonblocking source review remain gates. No equipment, alpha or full private-protocol clearance is granted.

### Row 195: counter-only native effects preserve original claims and override lifetime

The actual installation-loader/runtime/claims/provider/SDK/SQLite fixture receives a real 30-second eco
preset override. Qualified OFF/drain is followed by newer safe floor reports, leaving healthy OFF demand.
After actual claims refresh, the test captures the original claims permission, active override lease/budget,
runtime context/epoch, installed qualification and SDK session. It awaits the original raw graph-counter
UPDATE and observes one successful native acknowledgement. The graph row advances exactly once; the
complete SQLite schema and every other physical table remain equal, including command/state/branch,
locks, clock history, installation and automation rows. Full row multiplicity is preserved.

The original claims capture and active override stay current. The same lease object retains its exact
identity, deadline, watermark and status; context, epoch, qualification and SDK session remain identical.
All send/fence transcripts remain equal with zero ON. An ordinary ON to the real hydrated reserved
actuator refuses before and after, so the counter grants no ordinary command authority.

All six complete native-consumer files pass **262/262, zero failed/skipped**: runtime 173, claims 14,
comfort 39, SDK 24, value locks 8 and ownership 4. All **104 preceding literal runtime bodies** and **seven
helpers** are token-identical; production and the shared SDK fixture are unchanged. Classifying this exact
counter UPDATE as a catalog mutation makes the test fail immediately after its native completion at the
original claims capture assertion (0 passed, 1 failed, 172 unrelated cases unrun). Production is restored
byte-for-byte. Initial TypeORM parent narrowing and synchronous-refusal assertion errors are retained.

Current public comfort currentness plus the same active process-local lease/budget replaces only the
old joined intent currentness/close boundary in this counter-only case. Retired private TIME/caller/writer,
foreign-write/ABA, cross-case cleanup and global-drain protocols remain unadopted. Network/storage and
metadata/attestations are offline software inputs, not installed-equipment evidence.

The entry `8afced1` workflow and all reported 14 checks passed; CodeRabbit still skipped this draft.
Fresh exact-head CI and completed nonblocking source review remain required for the new test-only delta.
The follow-up is now **15/139 bound, 124 unbound**, with no whole original fixture or alpha clearance.

### Rows 196–197: actual OFF/drain release and native qualification-loss rollback

Both modes use the actual runtime, claims, configuration, graph/provider, SQLite, managed SDK and enabled
value-lock composition. The shared helper's qualification, network, storage and metadata inputs are explicitly
offline. After current `requestRelease` revokes qualification, the test reinstalls only that offline qualification
input. Actual SDK OFF/fence, qualified live feedback, journal drain and runtime proof minting execute normally;
the test never fabricates release evidence or overrides currentness methods.

A passive native observer records the graph INSERT/increment prelude before exactly one qualified claim UPDATE,
its actual successful native acknowledgement, and the original transaction completion. Clean mode commits the
released claim with the next revision, release timestamp and confirmed-OFF/drained-ON evidence. Ordinary ON
admission refuses while reserved and becomes allowed after release, without issuing ON. Loss mode invokes the
original qualification revocation at the final UPDATE; the acknowledged native write then rolls back, preserving
the entire releasing claim and continuing to refuse ordinary ON. Both modes produce a new actual OFF fence.

All six complete native-consumer files pass **264/264, zero failed/skipped**: runtime 175, claims 14,
comfort 39, SDK 24, value locks 8 and ownership 4. All **105 preceding literal runtime bodies** and **seven
helpers** remain token-identical. Production and the shared SDK fixture are unchanged. Omitting only the
post-UPDATE proof recheck makes qualification-loss fail at the original native outcome: COMMIT instead of
ROLLBACK. The clean control still passes; 173 unrelated cases are unrun in this control. Production is restored
byte-for-byte. The complete positive suite runs afterward on the restored source. A final observer-only
type annotation corrects TypeORM any[] lint; its emitted JavaScript AST is identical to the executed source.

The initial installed-loader composition remained inhibited after the claim revision changed and produced no
qualified UPDATE. That preparation result remains recorded; it is not loader renewal acceptance or a diagnosed
product defect. The selected setup retains the original cases' synthetic qualification boundary and explicitly
adapts it to current release-entry revocation. OFF responses are observed through the fixture's actual fence
transcript, not its ON-send transcript. No retired private caller/continuation, observer substitution, cross-case
lifecycle, global-drain or installed-equipment equivalence is granted.

Entry `a276bca` passed all reported 14 checks and every CI Tests workflow job; CodeRabbit skipped this draft.
Fresh exact-head CI and completed nonblocking source review remain gates. The follow-up is now
**17/139 bound, 122 unbound**, with no whole original-fixture or alpha clearance.

### Row 203: failed recovery, same-instance retry and independent fresh B

The actual runtime/claims/SQLite/managed SDK fixture starts fresh A. A real query subscriber throws the
original Error at its conditional recovery branch UPDATE. The transaction rolls back without that UPDATE
acknowledgement; complete saved branch/journal rows stay equal. A retires its lifecycle, bootstrap, timer,
contexts, runtime admission and listeners. The same A then retries and settles successfully with one original
recovery UPDATE acknowledgement and COMMIT. Every observed original claims capture follows the native
transaction end and release of the exact original recovery structural lease, bound in its own callback.
The observer forwards the same original capture receiver and result.

After A stops, distinct B completes its own native recovery and obtains a live context/lifecycle and claims
capture. Repeating stale A stop preserves that exact B capture, context and lifecycle. Claims and configuration
rows remain equal, no ON or additional claims refresh occurs, and fixture errors remain empty. Current
diagnostic recovery is claims-neutral, so original203's post-release refresh trace is replaced by observing
actual claims capture after native recovery ownership ends. No removed refresh callback is fabricated or
claimed accepted. The retired private caller, descriptor, cross-case and global-drain protocols remain open.
Qualification/network/storage/metadata inputs remain explicitly offline software boundaries.

All six complete native-consumer files pass **265/265, zero failed/skipped**: runtime 176, claims 14,
comfort 39, SDK 24, value locks 8 and ownership 4. All **106 preceding literal runtime bodies** and **seven
helpers** are token-identical; production and the shared SDK fixture remain unchanged. Omitting only failed
bootstrap lifecycle retirement makes the new test fail because A remains active after the original failure
(1 expected failure, 175 unrelated cases unrun). Original production is restored byte-for-byte before the
complete positive invocation. Initial broad recovery-query matching and method-observer type preparation
errors remain recorded; the final observer recognizes the exact recovery SET prefix and initial bindings.

Entry `4668927` passed all reported 14 checks and every CI Tests job; CodeRabbit still skipped this draft.
Fresh exact-head CI and completed nonblocking source review remain gates. The residual follow-up is now
**18/139 bound, 121 unbound**, with no whole original-fixture, equipment or alpha clearance.

### Row 221: original override budget across both native recovery effects

The actual installation-loader/runtime/claims/provider/SQLite/managed SDK fixture is settled and stopped.
A real 30-second eco override obtains its original process-local comfort lease; current installation-loader
renewal queue issued after override is joined through the existing offline device responses. A prepared ON row is
seeded as in the original. Only monotonic time is controlled: restart begins at original +500ms.

Both successful native recovery UPDATE callbacks are observed: journal status/fault and branch suspension,
with their initial bindings and mapped command/claim IDs. The original override is current with exactly the
same lease identity and deadline, while its old claims capture is closed by the new runtime-admission epoch.
The callbacks bind their exact original structural owner; that owner is inactive after recovery. Following
actual bootstrap and runtime settling, fresh claims capture is current; the seeded command retains its original
restart fault and is unknown or confirmed. Complete config and automation-slot rows stay equal. The same
lease deadline persists, and its watermark never decreases.

At original monotonic +30100ms, wall time is still before absolute expiry. Repeated currentness checks using
both original and fresh config snapshots remain false, and the same lease is expired without extending its
deadline. No ON is sent. Current claims-neutral diagnostic recovery has no additional released-refresh call;
ended native ownership and fresh admission capture replace that old trace. Current registered provider and
actual offline installation-loader setup replace the retired writer-backed provider preparation. Public comfort
currentness plus exact process-local budget replaces only the removed joined intent/close boundary. Private
TIME/caller/observer/descriptor/cross-case/global-drain and complete provider/SDK protocols remain open.
Network/storage/metadata responses and operator attestations are controlled offline software evidence.

All six complete native-consumer files pass **266/266, zero failed/skipped**: runtime 177, claims 14,
comfort 39, SDK 24, value locks 8 and ownership 4. All **106 unchanged previous literal runtime bodies** and **seven
helpers** are token-identical. The prior wall-clock expiry case adds only a monotonic input freeze; erasing
that statement restores every original body token, preserving all its assertions and order. Production and the shared SDK fixture are unchanged. Discarding the original
process-local override budget immediately before restart makes the test fail after both native recovery
acknowledgements: original lease identity/currentness/deadline are absent. This control has one expected
failure and 176 unrelated cases unrun; production is restored before the complete positive invocation.

The first full run retained **265 PASS / 1 FAIL**, with new221 passing and the prior wall-expiry case
failing before queued ON. A 1200ms controlled native preparation delay reproduces that setup failure: wall
time is fixed while monotonic time crosses the original one-second deadline. Freezing monotonic input
during preparation passes the delayed control and all original assertions; wall time alone still advances
to the exact expiry boundary. Production is unchanged. The initial full-run exact cause remains UNKNOWN.
The initial asynchronous observer-delay preparation was unjoined and unqualified; the corrected original
synchronous BeforeQuery control is joined.

Entry `82d8299` passed all reported 14 checks and every CI Tests job; CodeRabbit skipped this draft.
Fresh exact-head CI and completed nonblocking source review remain gates. The residual follow-up is now
**19/139 bound, 120 unbound**, without whole original-fixture, equipment or alpha clearance.

## Rows 118–119: independent bindings during a held OFF fence

The actual installed-loader, enabled locks, claims, runtime, graph, SQLite and managed SDK fixture is
settled offline and stopped. Its first post-restart native OFF fence is held before simulated send.
A peer SQLite connection changes exactly one member revision or source input-age binding while the complete
controller configuration and claim revision stay equal. Independent peer reads check the complete binding
image. After release, both changed variants require at least two completed relay fences, actual reloaded
bindings and a stored current proof whose scope equals the fresh image and differs from the held scope.
No ON occurs. An unchanged-image variant is the positive control.
The #1529 timeline captures each fence scope at entry and records its original simulated OFF completion
before forwarding the result. Each original runtime proof admission for the final fresh scope must have an
earlier completed fence for that same scope. A later fence cannot excuse an earlier admission. Both observers
forward their original calls/results and are restored after runtime/loader work joins.

A premature-admission production control fails both changed-image variants at this ordering assertion;
unchanged passes and 179 other cases are unrun. The prior assertions pass all three under the same mutation.
Report SHA-256: `fdc9d4c30202fae9c4364df9bda5f4fff158c8c02f4f3bdb93092a9bbb1a0f88`;
prior-assertion control: `8aaf5fb762f44ee9dbf87c4a652ae4639113c425c628ca94a28d9c7a02427cc4`.
Production and the strengthened test are restored byte-for-byte.

The original shared body used a second held fence and ceiling instrumentation. The current first-fence
schedule binds only this observable invariant; it does not adopt the retired private dirty-frontier,
continuation, fixture-owner, observer-custody or global-drain protocols. Endpoint responses and attestations
are controlled software inputs, not installed-equipment evidence.

Omitting member bindings from the production scope fingerprint fails only the member variant; omitting
source bindings fails only the source variant. Each control has **one expected failure, two passes and
177 unrun cases**. Their report SHA-256 values are `af1bd3b850130b008fad511fdf70accfb2a1f189c0fdde79728f21dcfde2d881`
and `53f04c5e96b97e4ca84890827f8bb504ef274d230cc8a2aced2199cf4eed954a`.
Production is restored byte-for-byte before the complete positive runtime invocation.

## Rows 116–117: independent native ON debt during successive OFF fences

The merged #1528 regression uses the actual offline installation-loader, enabled locks, claims, runtime,
graph, SQLite and managed SDK fixture. A peer inserts an unknown/dispatched ON while the first post-restart
OFF fence is held, then inserts a second ON identity or increases the first decision revision while the second
fence is held. Complete configuration and claim revision stay equal. A real subsequent public poll request
provides new ordinary entry after each peer mutation. The first unknown image stays exact until the second
held fence; both complete current images and the exact ON identity set are checked before release.

After all issued work joins, every baseline row remains exact. The final ON identity set stays equal and each
current obligation changes only status, settlement time and proof ID. Its ID must equal the original provider
proof from a later fence covering all current obligations and differ from the earlier proof. A passive observer
forwards the original adapter result and Promise; SQLite never supplies the expected ID. Three or four fence
entries complete, no ON is sent, and fixture errors remain empty. Both variants pass in the complete current
182/182 runtime report recorded above; production and all 144 previously bound witnesses are unchanged.

The cached-earlier-proof mutation fails both variants at exact native proof-ID equality; prior assertions pass
both under the same mutation (180 other cases unrun). Reports: `bafbb39f47dfcfb6744953402581acbdab959cfac8d7c13aa9897cfc749e94c8`
and `7aee913f059cfccea336bae354479167f50241ffb1588b9e03aa5a92421e3edc`. Those controls were measured at
the reviewed #1528 source; this shared body is token-identical after #1529, but no fresh replay is claimed.
The earlier unknown-ON omission control fails both variants before the next fence is reached; its report
`9d85c8d8142bd9053e6f4a2e1b895f48a86a06cdf4e8eb2de7561400790d7dd0` predates the proof-ID strengthening
and remains historical discovery evidence. Production was restored byte-for-byte after each control.

The original shared body held its second/third fences and required startup to finish before a fifth gate,
using automatic continuation after a consumed dirty frontier. The current first/second post-restart schedule
explicitly queues ordinary public polls. Only independent native debt visibility, bounded exact settlement and
covering-proof identity are adopted. Automatic receipt/dirty-frontier continuation, the original scheduling,
private fixture/observer/global-drain protocols, complete provider/SDK and equipment acceptance are unadopted.

## Rows 131–142: publication failure and public-successor recovery

These twelve **scoped** bindings use four executed variants (`Error`, string, `undefined`, `null`),
each covering three facets. They do not represent twelve additional test executions:

| Original rows | Qualified current facet | Boundary retained outside this scope |
| --- | --- | --- |
| 131–134 | Original post-OFF evaluation rejects with the identical publication P despite separate Q. | Original owned-child negative-probe/feedback receipt and writer-root ceiling. |
| 135–138 | Native confirmation COMMIT and completed reconciliation precede the actual publication SELECT in the same evaluation context; P stays identical. | Original release-proven event/epoch certificate protocol and its private provenance. |
| 139–142 | After Q, a genuine public successor completes evaluation and republishes release-proven OFF without journal/configuration churn or ON. | Original inherited-primary ticket and automatic graph-refresh continuation; current recovery is an explicit independent request. |

`preserves post-OFF publication $kind across a failing public poll and a successful successor` uses the
actual offline installation loader, enabled locks, native claims, graph, SQLite and managed SDK composition.
An inserted unknown ON row is controlled debt, not proof of a historical authenticated ON send. The runtime
issues its own remedial OFF. Passive observers forward original arguments/results/Promises and correlate the
provider covering proof, native confirmation COMMIT, completed reconciliation and publication context.
Only then does the actual property SELECT throw P. Its original evaluation rejects with `Object.is`-identical P.
That failure queues an independent public `requestInstalled`; its actual controller SELECT throws Q and its
own completion preserves Q. After joined telemetry and queues, the evaluation count remains fixed. A fresh
explicit public request succeeds, removes `runtime_error` diagnostics and publishes release-proven OFF.
Independent protective readiness remains as before; recovery does not promise unconditional `ready`.

Complete baseline journal rows and controller configuration stay equal. The inserted ON and genuine remedial
OFF settle using the observed provider proof; the full resulting journal remains equal through recovery.
There are no ON sends or fixture errors. Runtime, command, loader and public-request work join before cleanup.
No retired owned-child, inherited-ticket, negative-probe or full provider/SDK/private-fixture equivalence is
adopted. Controlled network, metadata and attestations qualify no installed equipment.

The complete eight-file invocation passes **394/394**, zero failures/skips,
including **186/186** runtime cases. Raw report SHA-256: `51d89fc4706527a9b4c0ebe9de1d668c7ad0a94db120567ac04445aea941b834`.
Swallowing publication failure in the production evaluation makes **all four variants fail**, with 182 unrun,
at the original rejection assertion; report SHA-256: `7b0fa0b51b834a47aa08ab9c7c21ac0e27cb22d23754e3bf308a3c490fbc9a45`. Production was restored byte-for-byte.
Earlier development runs retained four failures each: the first observed publication before same-evaluation
COMMIT, then an omitted genuine remedial OFF in the expected row set, then an overbroad `ready` expectation.
The corrected test waits for actual native acknowledgement, includes the real OFF and retains baseline
protection. The initial TypeScript observer typing failure occurred before execution and is not a runtime defect.

## Case checklist

All entries were unbound at branch entry. A checked entry has a tested current binding in the
canonical ledger. Original-source links retain full ancestry and body identity for parameterized cases.

### Retired fixture ownership

- [ ] `1473-001` — retires a genuinely held unadopted setup A before B adopts and never lets late A completion reclaim or close B ([original line 2967](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L2967)).
- [ ] `1473-002` — keeps an issued A read and publication on A while its resumed body cannot change a genuine held B inspection ([original line 3219](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L3219)).
- [ ] `1473-003` — preserves issued A SQL primary undefined before cleanup Q and leaves a foreign A descriptor and fresh B intact ([original line 3466](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L3466)).
- [ ] `1473-004` — preserves issued A SQL primary null before cleanup Q and leaves a foreign A descriptor and fresh B intact ([original line 3466](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L3466)).
- [ ] `1473-005` — preserves issued A SQL primary false before cleanup Q and leaves a foreign A descriptor and fresh B intact ([original line 3466](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L3466)).
- [ ] `1473-006` — preserves issued A SQL primary "native A primary" before cleanup Q and leaves a foreign A descriptor and fresh B intact ([original line 3466](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L3466)).
- [ ] `1473-007` — preserves issued A SQL primary [Error: native A primary] before cleanup Q and leaves a foreign A descriptor and fresh B intact ([original line 3466](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L3466)).

### OFF settlement and native safety debt

- [ ] `1473-110` — shares an actual active-C settlement across its native OFF report and closes event provenance after emit ([original line 8186](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L8186)).
- [ ] `1473-112` — a genuine later poll retains ordinary entry fencing instead of being labeled an owned report ([original line 8404](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L8404)).
- [ ] `1473-113` — finite failed OFF service retains native debt through actual proof-query failure without rearming its own unknown permit ([original line 8413](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L8413)).
- [ ] `1473-114` — finite failed OFF service retains native debt through actual probe-query failure without rearming its own unknown permit ([original line 8413](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L8413)).
- [ ] `1473-115` — finite failed OFF service retains native debt through actual post-ACK failure without rearming its own unknown permit ([original line 8413](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L8413)).
- [x] `1473-116` — detects independently committed new-id native ON debt despite the first consumed dirty frontier ([original line 8472](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L8472); [current binding](original1473-case-map.json#L2975)).
- [x] `1473-117` — detects independently committed same-id-risk native ON debt despite the first consumed dirty frontier ([original line 8472](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L8472); [current binding](original1473-case-map.json#L3052)).
- [x] `1473-118` — a real same-revision member change while the original fence is held remains ordinary safety work ([original line 8564](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L8564); [current binding](original1473-case-map.json#L3129)).
- [x] `1473-119` — a real same-revision source change while the original fence is held remains ordinary safety work ([original line 8564](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L8564); [current binding](original1473-case-map.json#L3204)).
- [ ] `1473-120` — a genuine new local ON job still takes ordinary hold fencing before its native send ([original line 8618](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L8618)).
- [ ] `1473-121` — a persistent negative-read Q cannot rearm its own returned-safety episode, while a real poll can retry ([original line 8656](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L8656)).
- [ ] `1473-122` — a persistent negative-read Q cannot rearm its own rejected-safety episode, while a real poll can retry ([original line 8656](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L8656)).
- [ ] `1473-123` — observes a lower second-member barrier even while the original whole-branch maximum stays unchanged ([original line 8755](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L8755)).
- [ ] `1473-124` — does not consume native N2 when completion Q follows its inverse SELECT on a consumed unknown frontier ([original line 8885](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L8885)).
- [ ] `1473-125` — admits the negative observer only after a genuinely queued native graph writer releases ([original line 9007](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9007)).
- [ ] `1473-126` — an unavailable baseline Q permits guarded OFF and preserves subsequent native Error outcome at its real root boundary ([original line 9091](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9091)).
- [ ] `1473-127` — an unavailable baseline Q permits guarded OFF and preserves subsequent native undefined outcome at its real root boundary ([original line 9091](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9091)).
- [ ] `1473-128` — an unavailable baseline Q permits guarded OFF and preserves subsequent native null outcome at its real root boundary ([original line 9091](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9091)).
- [ ] `1473-129` — an unavailable baseline Q permits guarded OFF and preserves subsequent native returned-safety outcome at its real root boundary ([original line 9091](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9091)).
- [ ] `1473-130` — does not consume a lower member barrier when the completed native probe throws Q before scheduling ([original line 9183](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9183)).
- [x] `1473-131` — retains initial post-OFF publication Error P through actual failed-child probe Q ([original line 9357](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9357); [current binding](original1473-case-map.json#L3433)).
- [x] `1473-132` — retains initial post-OFF publication string P through actual failed-child probe Q ([original line 9357](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9357); [current binding](original1473-case-map.json#L3476)).
- [x] `1473-133` — retains initial post-OFF publication undefined P through actual failed-child probe Q ([original line 9357](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9357); [current binding](original1473-case-map.json#L3519)).
- [x] `1473-134` — retains initial post-OFF publication null P through actual failed-child probe Q ([original line 9357](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9357); [current binding](original1473-case-map.json#L3562)).
- [x] `1473-135` — R31 correlates genuine native certificate SUCCESS then same-evaluation publication Error P and probe Q ([original line 9504](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9504); [current binding](original1473-case-map.json#L3605)).
- [x] `1473-136` — R31 correlates genuine native certificate SUCCESS then same-evaluation publication string P and probe Q ([original line 9504](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9504); [current binding](original1473-case-map.json#L3648)).
- [x] `1473-137` — R31 correlates genuine native certificate SUCCESS then same-evaluation publication undefined P and probe Q ([original line 9504](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9504); [current binding](original1473-case-map.json#L3691)).
- [x] `1473-138` — R31 correlates genuine native certificate SUCCESS then same-evaluation publication null P and probe Q ([original line 9504](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9504); [current binding](original1473-case-map.json#L3734)).
- [x] `1473-139` — R31 admits a later genuine successful inherited evaluation despite its original Error publication P ([original line 9736](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9736); [current binding](original1473-case-map.json#L3777)).
- [x] `1473-140` — R31 admits a later genuine successful inherited evaluation despite its original string publication P ([original line 9736](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9736); [current binding](original1473-case-map.json#L3820)).
- [x] `1473-141` — R31 admits a later genuine successful inherited evaluation despite its original undefined publication P ([original line 9736](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9736); [current binding](original1473-case-map.json#L3863)).
- [x] `1473-142` — R31 admits a later genuine successful inherited evaluation despite its original null publication P ([original line 9736](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9736); [current binding](original1473-case-map.json#L3906)).
- [ ] `1473-143` — R40 joins the actual SQL-null claim and omitted installed generation through original managed OFF provenance ([original line 10034](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L10034)).
- [ ] `1473-144` — R40 keeps original SQL-null dispatch work closed after a live raw generation mutation and restoration ([original line 10234](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L10234)).
- [ ] `1473-145` — R37 owns the unshadowed hydrated Shelly getter through genuine native OFF and retained release proof ([original line 10387](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L10387)).
- [ ] `1473-146` — R37 keeps original native dispatch provenance closed after observed own-shadow restoration during its actual emit ([original line 10503](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L10503)).
- [ ] `1473-147` — R37 keeps original native dispatch provenance closed after observed nearer-getter restoration during its actual emit ([original line 10503](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L10503)).
- [ ] `1473-148` — R37 keeps original native dispatch provenance closed after observed canonical-getter restoration during its actual emit ([original line 10503](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L10503)).
- [ ] `1473-149` — R37 keeps original native dispatch provenance closed after observed canonical-setter restoration during its actual emit ([original line 10503](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L10503)).
- [ ] `1473-150` — R37 keeps original native dispatch provenance closed after observed canonical-flags restoration during its actual emit ([original line 10503](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L10503)).
- [ ] `1473-151` — R37 keeps original native dispatch provenance closed after observed chain-link restoration during its actual emit ([original line 10503](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L10503)).
- [ ] `1473-152` — R32 allows public ordinary B progress while original A is held after real sample admission and retires only A at completion ([original line 10636](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L10636)).
- [ ] `1473-153` — R31 joins only the original detached OFF operation while its actual outcome SAVE is held and schedules one ticket ([original line 10823](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L10823)).
- [ ] `1473-154` — R31 routes the original accepted A payload ordinarily after genuine same-controller B replacement and after-emit closure ([original line 10924](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L10924)).
- [ ] `1473-155` — R31 keeps a retired original held OFF completion from requesting or closing the installed B decision ([original line 10989](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L10989)).
- [ ] `1473-156` — R31 leaves actual native false delivery unowned for packet-clone without minting a replacement work ([original line 11036](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11036)).
- [ ] `1473-157` — R31 leaves actual native false delivery unowned for send-replaced without minting a replacement work ([original line 11036](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11036)).
- [ ] `1473-158` — R31 leaves actual native false delivery unowned for claim-replaced without minting a replacement work ([original line 11036](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11036)).
- [ ] `1473-159` — R31 leaves actual native false delivery unowned for guard-replaced without minting a replacement work ([original line 11036](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11036)).
- [ ] `1473-160` — R31 keeps a real failed outcome SAVE out of OFF_REPORTED without discarding native history ([original line 11095](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11095)).
- [ ] `1473-161` — R31 never tags actual ON telemetry as OFF work and keeps manual producer-state notification ordinary ([original line 11139](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11139)).
- [ ] `1473-162` — R31 closes the genuine original dispatch origin on actual claims loss before its native readback ([original line 11260](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11260)).
- [ ] `1473-163` — R31 closes the genuine original dispatch origin on actual native-registration loss before its native readback ([original line 11260](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11260)).
- [ ] `1473-164` — R31 closes the genuine original dispatch origin on actual destroy loss before its native readback ([original line 11260](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11260)).

### Comfort, claims and original SDK send guards

- [ ] `1473-165` — R132 reaches the original first read before O and admits only its real beforeOn acknowledged postimage ([original line 11787](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11787)).
- [ ] `1473-166` — R132 reaches the original first read before O and admits only its real afterOn acknowledged postimage ([original line 11787](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11787)).
- [ ] `1473-167` — R132 keeps first outcome-save undefined primary even if original catch saves and O fulfills ([original line 11818](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11818)).
- [ ] `1473-168` — R132 keeps first outcome-save null primary even if original catch saves and O fulfills ([original line 11818](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11818)).
- [ ] `1473-169` — R132 keeps first outcome-save false primary even if original catch saves and O fulfills ([original line 11818](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11818)).
- [ ] `1473-170` — R132 keeps first outcome-save "first native save P" primary even if original catch saves and O fulfills ([original line 11818](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11818)).
- [ ] `1473-171` — R132 keeps first outcome-save [Error: first native save P] primary even if original catch saves and O fulfills ([original line 11818](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11818)).
- [ ] `1473-172` — R132 rejects genuine journal-same-value during the released seed gap without filtering full facts ([original line 11859](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11859)).
- [ ] `1473-173` — R132 rejects genuine slot-same-value during the released seed gap without filtering full facts ([original line 11859](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11859)).
- [ ] `1473-174` — R132 rejects genuine config-same-value during the released seed gap without filtering full facts ([original line 11859](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11859)).
- [ ] `1473-175` — R132 rejects genuine claim-same-value during the released seed gap without filtering full facts ([original line 11859](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11859)).
- [ ] `1473-176` — R132 rejects genuine graph during the released seed gap without filtering full facts ([original line 11859](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11859)).
- [ ] `1473-177` — R132 rejects genuine missing-row during the released seed gap without filtering full facts ([original line 11859](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11859)).
- [ ] `1473-178` — R132 rejects genuine foreign-fault during the released seed gap without filtering full facts ([original line 11859](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11859)).
- [ ] `1473-179` — R132 rejects actual same-runner replay of the identical original UPDATE despite identical final bytes ([original line 11915](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11915)).
- [ ] `1473-180` — R132 cannot use A history as fresh-instance B admission or wait on B while native A is held ([original line 11951](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11951)).
- [ ] `1473-181` — R132 cannot use A history as same-instance B admission or wait on B while native A is held ([original line 11951](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11951)).
- [ ] `1473-182` — R132 rejects an observed original transport method loss and cannot resurrect it by restoring the function ([original line 13528](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13528)).
- [ ] `1473-183` — R132 rejects forged oversized or cloned capture identities with zero native/database calls ([original line 13546](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13546)).
- [ ] `1473-184` — R132 releases a failed genuine seed without joining held N and retains primary undefined through cleanup Q ([original line 13559](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13559)).
- [ ] `1473-185` — R132 releases a failed genuine seed without joining held N and retains primary null through cleanup Q ([original line 13559](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13559)).
- [ ] `1473-186` — R132 releases a failed genuine seed without joining held N and retains primary false through cleanup Q ([original line 13559](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13559)).
- [ ] `1473-187` — R132 releases a failed genuine seed without joining held N and retains primary "seed read P" through cleanup Q ([original line 13559](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13559)).
- [ ] `1473-188` — R132 releases a failed genuine seed without joining held N and retains primary [Error: seed read P] through cleanup Q ([original line 13559](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13559)).
- [ ] `1473-189` — R132 rejects a real extra native journal INSERT rather than adopting it into the captured fixed set ([original line 13617](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13617)).
- [ ] `1473-190` — R132 rejects an arbitrary later O descendant instead of lending it the closed native invocation ([original line 13638](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13638)).
- [ ] `1473-191` — R132 vetoes an actually rolled-back slot write although complete row bytes are restored ([original line 13663](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13663)).
- [ ] `1473-192` — R132 vetoes an actually rolled-back native-configuration write although complete row bytes are restored ([original line 13663](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13663)).
- [ ] `1473-193` — R132 does not reuse a completed A command as a live predecessor of a genuine fresh empty-set B no-op ([original line 13692](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13692)).
- [ ] `1473-194` — R132 rejects a clone of a genuine captured capability without borrowing its original packet or O ([original line 13731](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13731)).
- [x] `1473-195` — keeps counter-only effects claims-neutral and the original joined override time current without minting send authority ([original line 13761](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13761); [current binding](original1473-case-map.json#L4647)).
- [x] `1473-196` — uses the real runtime OFF/drain release through graph prelude and awaited claim UPDATE:clean ([original line 13836](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13836); [current binding](original1473-case-map.json#L4760)).
- [x] `1473-197` — uses the real runtime OFF/drain release through graph prelude and awaited claim UPDATE:qualification-loss ([original line 13836](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13836); [current binding](original1473-case-map.json#L4895)).
- [x] `1473-198` — keeps actual state, branch/noop, command journal and enabled derived lock writes command-current through managed ON ([original line 14515](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L14515); [current binding](original1473-case-map.json#L5030)).
- [ ] `1473-199` — rejects identical native journal SQL and ALL bindings from an actual same-runner subscriber without borrowing its enclosing ORM effect ([original line 14611](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L14611)).
- [ ] `1473-200` — keeps an original time owner closed after relevant native same-value and same-lifetime rejoin ([original line 14695](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L14695)).
- [ ] `1473-201` — keeps an original time owner closed after relevant native restore and same-lifetime rejoin ([original line 14695](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L14695)).
- [ ] `1473-202` — keeps an original time owner closed after relevant native slot and same-lifetime rejoin ([original line 14695](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L14695)).
- [x] `1473-203` — refreshes genuine claims after recovery TX AND original structure release, and cleans a failed original bootstrap before same-instance restart ([original line 14821](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L14821); [current binding](original1473-case-map.json#L5227)).
- [ ] `1473-204` — preserves only C original remaining TIME across D complete requestRelease, native slot/config effects, qualified drain and new graph generation ([original line 14916](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L14916)).
- [x] `1473-205` — keeps real enabled publication locks neutral while managed ON is pending before-send, then preserves actual refusal/UNKNOWN on original claims loss ([original line 15261](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L15261); [current binding](original1473-case-map.json#L5374)).
- [x] `1473-206` — keeps real enabled publication locks neutral while managed ON is pending after-send, then preserves actual refusal/UNKNOWN on original claims loss ([original line 15261](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L15261); [current binding](original1473-case-map.json#L5505)).
- [x] `1473-207` — preserves an original native bootstrap before-commit error and exact persisted outcome without first context/admission leakage ([original line 15374](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L15374); [current binding](original1473-case-map.json#L5636)).
- [x] `1473-208` — preserves an original native bootstrap after-ack error and exact persisted outcome without first context/admission leakage ([original line 15374](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L15374); [current binding](original1473-case-map.json#L5752)).
- [ ] `1473-209` — treats a foreign same-row journal write as claims-DIRTY even when its finite native effect preserves original TIME ([original line 15419](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L15419)).
- [ ] `1473-210` — keeps an original clock closed after a rolled-back same-value C write without resetting the restored lifetime ([original line 15869](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L15869)).
- [ ] `1473-211` — pins the original native hydration method and never revives a clock after its observed replacement restores ([original line 15973](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L15973)).
- [ ] `1473-212` — R53 keeps original TIME through read close, same-token watermark clones and genuine ordinary neutral recovery ([original line 16069](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L16069)).
- [ ] `1473-213` — R53 latches only observed original native A loss and never lets delayed A observation or close veto genuine B ([original line 16161](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L16161)).
- [x] `1473-214` — denies original command claims after a foreign actual claim revision mutation even with matching source and unchanged journal ([original line 16268](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L16268); [current binding](original1473-case-map.json#L5933)).
- [ ] `1473-215` — never lends a closed ORM effect to a held AfterQuery descendant issuing the identical native write later ([original line 16344](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L16344)).
- [ ] `1473-216` — keeps mapped UUID native journal work distinct from uuid scalar/protected rejection ([original line 16432](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L16432)).
- [ ] `1473-217` — keeps mapped UUID native journal work distinct from malformed scalar/protected rejection ([original line 16432](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L16432)).
- [ ] `1473-218` — keeps mapped UUID native journal work distinct from protected scalar/protected rejection ([original line 16432](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L16432)).
- [ ] `1473-219` — reports a genuine recovery callback Q-only without changing bootstrap primary identity ([original line 16524](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L16524)).
- [ ] `1473-220` — reports a genuine recovery callback P+Q without changing bootstrap primary identity ([original line 16524](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L16524)).
- [x] `1473-221` — retains only the original C deadline through BOTH actual recovery effects and a fresh post-release claims generation ([original line 16644](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L16644); [current binding](original1473-case-map.json#L6135)).
- [x] `1473-228` — observes original qualification data without installation or events and refuses a subsequent revoke without recapture ([original line 17357](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L17357); [current binding](original1473-case-map.json#L6406)).
- [x] `1473-229` — keeps missing qualification unavailable and remembers actual absence ABA across an admitted finite capture ([original line 17376](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L17376); [current binding](original1473-case-map.json#L6509)).
- [ ] `1473-230` — R87 public settle fences a held first read and preserves actual managed before-send native outcome without a response recapture ([original line 17393](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L17393)).
- [ ] `1473-231` — R87 public settle fences a held first read and preserves actual managed after-send native outcome without a response recapture ([original line 17393](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L17393)).
- [x] `1473-232` — keeps original actual SDK before-send outcome truthful when comfort entry waits on its first real read ([original line 17579](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L17579); [current binding](original1473-case-map.json#L6638)).
- [x] `1473-233` — keeps original actual SDK after-send outcome truthful when comfort entry waits on its first real read ([original line 17579](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L17579); [current binding](original1473-case-map.json#L6759)).

### Named original OFF completion

- [x] `1473-241` — rejects the test receipt without S1 while preserving exact native effects after the actual OFF is refused ([original line 18597](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L18597); [current binding](original1473-case-map.json#L7090)).
- [x] `1473-242` — rejects the test receipt without S1 while preserving exact native effects after the actual OFF is unknown ([original line 18597](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L18597); [current binding](original1473-case-map.json#L7179)).
- [x] `1473-243` — cannot let a retired A completion settle B or restore a foreign descriptor ([original line 18663](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L18663); [current binding](original1473-case-map.json#L7268)).

### Issued setup and cleanup ownership

- [ ] `1473-244` — retains issued A setup and orphan cleanup while genuine B adopts before A resumes ([original line 18832](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L18832)).
- [ ] `1473-245` — closes exact partial resources after original initialize rejection without adopting its result ([original line 18900](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L18900)).
- [ ] `1473-246` — closes exact partial resources after original compile rejection without adopting its result ([original line 18900](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L18900)).
- [ ] `1473-247` — publishes the same cleanup before original module close can reenter ([original line 18940](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L18940)).
- [ ] `1473-248` — retains a foreign E2 descriptor and reports restoration Q after E1 consumers retire ([original line 18958](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L18958)).
- [ ] `1473-249` — keeps present setup undefined P ahead of cleanup Q and still closes partial resources ([original line 18988](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L18988)).
- [ ] `1473-250` — keeps present setup null P ahead of cleanup Q and still closes partial resources ([original line 18988](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L18988)).
- [ ] `1473-251` — keeps present setup false P ahead of cleanup Q and still closes partial resources ([original line 18988](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L18988)).

### Cleanup observer ordering

- [ ] `1473-252` — R241 attempts both original owner cleanup observers before SQLite closes when the first removes itself ([original line 19029](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L19029)).

### Held body gate with real SQLite consumers

- [ ] `1473-253` — retires and opens an incomplete body gate before joining its original SQLite transaction and closing A ([original line 19063](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L19063)).
- [ ] `1473-254` — memoizes successful body cleanup through opener reentry without retiring or closing its original fixture ([original line 19141](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L19141)).

### Required-method refusal

- [x] `1473-261` — preserves ordinary prototype identity checks and refuses changed or missing methods ([original line 19304](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L19304); [current binding](original1473-case-map.json#L7627)).
