# Remaining original thermostat acceptance

Historical branch entry is merged PR #1508 (`4a3033e1d6050252a5b45fc9972b6f958e463a22`).
Its exact reviewed head `3af1c1be7f8bb21a757b60feefa935331c3fe0c7` passed all 14 checks,
including 13,306 backend tests and all 424 E2E cases. CodeRabbit reported no actionable comments.
The separate local 362 PASS / 62 FAIL E2E result and unattributed SQLite ownership timeouts remain
recorded in #1508; hosted success does not establish their cause.

**Status: partial inventory on main `2fd4d7f523759be1a92392f7455763bc4e7c3b86` plus the native-effects batch,2026-11-09;
121 of the original139 residuals have tested current bindings,and18 remain unbound.**
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
preserve the initial 122 dispositions, and distinguish the121 bound entries from the18 still open.
Run required exact-head checks and obtain completed nonblocking source review. Further executable residuals
belong in separate small PRs; this summary does not close them. Actual alpha publication and installed-equipment
qualification remain separate gates in #1462.

## Current binding qualification

The current base is merged #1541 (`2fd4d7f523759be1a92392f7455763bc4e7c3b86`),plus four native-effects bodies/seven executions.
Complete consumers pass **615/615**,including **273 runtime cases**,ten files,zero skips;report `dff5c16a4e1837543b38c73ae6e9a5130e2108e25646bb1cb0551d65d47c1d5e`.
All250 witness bindings across243 original rows verify. The fixed residual inventory has **121 bindings
(64 scoped,57 replacements)** and **18 open entries**. All134 previous literal bodies remain present;
131 are token-identical and three contain carried #1541 review assertion enhancements. All88 previous
helpers,32 production files and the shared fixture are unchanged. The final source-bound deadline control
fails all five new clock variants before timeout. Historical sections retain their source/count checkpoints.

### Prior qualification checkpoints

Merged #1540 reviewed `fee09f4f99a4ef9699a945628fba099d58fddeb9` and squash `a522210662b127fb48bc8465859fb8bfb591965a` have byte-identical
apps and all four acceptance/test files;apps tree `db68abbe7d84df58b923c7853a7fa5d6fc685942`. Complete trees
differ only by the separately merged#1539 CI action updatev6.1.1→v6.1.2. Exact-head CI and completed
CodeRabbit review passed,no new findings,all three threads resolved. JSON bot coverage was incomplete;
complete independent audits/actual analysis passed. Its598/598,runtime256,report
`d061cbf859b3bbb401213ea44b3c93da01950792693ae8eb7e4c967746dea39a`,104bound/35open checkpoint is historical.

Merged #1538 reviewed `d9a4f6edfb006c228d981978c8a933a32ea69401` and squash `dd242d57e3f386510cf8f4ed5e7ba514c00b378c` have identical complete
tree `b4214ec78b212ce381cd10a92d13a6f4fe6efafc`. Exact-head hosted CI and completed CodeRabbit review passed
without further findings. The valid original relay-event request nit is fixed. Fresh local 587/587, runtime 245,
ten files, report `58890c6fbe9e331fa2f90021fe21cb7329e6eaccf1cc83f165d9d47a186f2dd4`, retains that source. Bot
checklist/JSON coverage and sandbox ESLint were incomplete; independent complete audits and actual analysis
supplemented the available-file review. Its92/47 status and native-origin controls below remain historical.

Merged #1537 reviewed `1612c8a68ea5bd4461b5002a897924cd9d3328ac` and squash `41ec33a93a37ffe4b8217bff633ebadc20a9625a` have the same
complete tree. All hosted CI and completed CodeRabbit review passed without further actionable findings; its
valid read-wait finding is fixed/resolved. Local 581/581 (239 runtime, ten files), report
`fada39c160f46cdf2a85c5cebe291ee21a1fb44f2602e87754e450a4aab142bf`, retain that exact source. JSON bot coverage
was incomplete and sandbox ESLint unavailable; actual local/hosted analysis and independent full audits passed.

Merged #1536 reviewed `2d7b5f879efae6892cc579a2b51e9fa7a0d85aea` and squash `e38a05d1dd59cc907f5ba607e813b161a1d61ed0` have the
same complete tree. All 14 hosted checks and completed CodeRabbit review passed without actionable findings.
Its **576/576** local consumers (234 runtime, ten suites), report SHA-256
`0c3ea25b2ab402a439f0387ccc30dc6a590b4d2b626966f8c613773ee0fd9834`, remain historical at that exact source.
Bot JSON coverage was incomplete; the independent complete ledger/source/body/helper/report/checklist/link audit passed.

Merged #1535 reviewed `7ef3760d4e85a8fbd8c3e9919d64f8a312ab41c4` and squash `a602503e9de0a0fbbe103c157fe740037d6acfb1` have the
same complete tree. All hosted checks and completed CodeRabbit review passed; all inline threads are resolved.
Its **569/569** local consumers (227 runtime, ten suites), report SHA-256
`345aea2d23b083c2debf48558c2063d3f95c3d65f54e4b88cbda5fd142adbc82`, retain that exact source attribution.
JSON bot coverage was incomplete; independent complete ledger/source/body/helper/report/link audits passed.

Merged #1534 corrected observed OFF capture/readiness lifetime loss. Its complete nine-file follow-up passed
**527/527**, including **220 runtime** and **99 transport** cases, report SHA-256
`471d3562dd29bf1e2d204930482ab7ef1ae17e2151e7d58842e1ffafb3cf3651`. Reviewed head
`791215693fe643803566c43025fddc45183ef640` passed all hosted checks and completed CodeRabbit review without
new findings after its readiness correction and both test suggestions. Reviewed and merged complete trees are
identical. JSON review coverage was incomplete; independent complete source/body/helper/report/link audits passed.

Merged #1533 added eight scoped bindings through native-write isolation. Its complete eight-file invocation passed
**418/418**, including **210/210** runtime cases, report SHA-256
`4d7348c22e29840fc25924ddd2e6a6e62e48d6478adb43a98fddb92db634026f`. Reviewed head
`985d3080ba85440a20e9993c739d8f1e1f3b7cc2` passed all 14 hosted checks and completed nonblocking CodeRabbit
review. Reviewed and merged complete trees are identical. Bot JSON coverage was incomplete; an independent full
ledger/source/helper/report/checklist audit passed.

Merged #1532 corrected original native failure completion and bound thirteen original rows. Its complete eight-file
invocation passed **409/409**, including **201/201** runtime cases, report SHA-256
`c7d40ea74868fb55736064d27e2e87c7ec1335cf73f19d1041a251b6063d2176`. Its reviewed head
`ee76129031c456a3a4909fbdfe22f5d245b9f893` passed all hosted checks and completed nonblocking CodeRabbit review.
The complete reviewed and merged trees are identical. The JSON ledger was unavailable to earlier bot review rounds;
independent complete audits passed. Both valid join-test and historical-completion wording findings were fixed.

The following paragraphs retain the preceding #1531 and earlier measurements. Their then-current counts,
source hashes and unchanged-production statements describe those checkpoints, not the new runtime fix above.


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

## Rows 126–129, 153, 160 and 165–171: original native outcome completion

This batch fixes a real completion error. A failed outcome UPDATE followed by a successful diagnostic repair
previously let the original operation and waiting mutation fulfill. If repair also failed, Q replaced P.
Unexpected command failures now retain P after best-effort repair; Q is logged separately. Known-unsent
retired decisions remain ordinary cancellation. No failure itself grants OFF/drain proof.

| Rows | Scoped current evidence | Original mechanisms left unadopted |
| --- | --- | --- |
| 126–129 | A real optional load-image SELECT fails Q, but guarded OFF still executes; actual Error/undefined/null native SAVE P survives, and returned safety completes. | Private optional negative observer, exact writer-root counts and Error.cause wrapper. |
| 153 | The issuing evaluation finishes with zero queued evaluations and one original in-flight command. Predecessors are captured before releasing the pre-outcome gate; that same capture stays pending across the original-ID outcome UPDATE and joins real SAVE/reconciliation. | Private serviceFeedback child/ticket, exact two-fence/sample grammar and terminal receipt. |
| 160 | Failed genuine OFF SAVE preserves all baseline history; later confirmation requires the observed original provider proof covering both controlled debt and actual OFF ID. | OFF_REPORTED owned-event/receipt protocol. |
| 165–166 | Existing full managed before/after-send cases retain original first comfort SELECT ordering, command identity, genuine refused/unknown outcome and exact journal membership. | R132 private captured seed and acknowledged-postimage authority. |
| 167–171 | Five causes (`undefined`, `null`, `false`, string, Error), each with repair success/failure: the original operation and waiting comfort mutation reject with identical P; repair Q is separately logged. | Retired effect/seed receipt and old fulfilled detached O; current O explicitly rejects. |

The new tests execute actual registered runtime, native claims/provider, comfort, SQLite and managed SDK
with controlled endpoint/qualification data. Full row/configuration assertions preserve exact repaired or
unrepaired postimages, no replacement IDs, no ON sends and no minted proof. The optional-baseline table uses
an explicitly inserted unknown ON obligation; that is controlled debt, not a historical authenticated send.
Any later confirmed rows are checked against the actual returned covering proof. All work and observers join
before cleanup. Existing managed first-read cases are reused, not counted as newly implemented executions.

Complete local consumers: **409/409** across eight files, including **201/201** runtime cases, zero failures/skips.
Raw report SHA-256: `c7d40ea74868fb55736064d27e2e87c7ec1335cf73f19d1041a251b6063d2176`.
Restoring the original production implementation makes **13 variants fail**, while returned-safety and held-SAVE
controls pass (186 unrun); report `78c0f3a0bdaf1ee782137436392468732cb896dd34217689ca270a30ee4ddd99`. The corrected production source is restored to
`609ad204abb8243e4de818cc7f9fb9331d98970174f38e1a4bd04f96bc5a7d5f`. An initial two-variant Error run separately demonstrated false success and Q replacing P.
Earlier preparation failures were fixture issues: missing fresh protection before an ON gate, and holding a
fence needed by the optional-baseline operation's own completion. Their interrupted/timed-out runs are retained;
no business equivalence is granted from those attempts. No physical equipment or alpha qualification follows.

The review follow-up strengthens row 153 without adding a case or production change. The OFF is held before
outcome SQL; bootstrap and the issuing evaluation finish with no queued evaluations and exactly one original
in-flight command. Predecessors are captured before that gate is released. The actual original-ID outcome
UPDATE is then held, and that same captured completion must remain pending until SAVE release. A later
feedback evaluation cannot prolong this earlier snapshot. Omitting detached-command waits makes the former
test pass (**1 PASS / 200 unrun**) but the strengthened test fail (**1 FAIL / 200 unrun**) at the pending-join
assertion. The ledger's `detachedOffJoinFollowup` binds both reports and source versions. Production is restored
byte-for-byte before the complete positive run; all 175 other witness bodies and 113 other literal runtime
bodies remain unchanged from reviewed `63d45ca`, as do all 64 prior helper declarations.

## Rows 172–178 and 189: foreign writes in an admitted unchanged operation

Eight scoped bindings share one nine-variant table through the actual registered runtime, native claims/provider,
comfort service, SQLite and managed SDK. Public definition entry retires an original queued ON guard before its
held first native read. The genuine SDK returns refused and its original journal completion is cancelled.
The current API then admits the unchanged definition transaction; an actual same-runner AfterQuery subscriber
executes the selected foreign write. This replaces the retired seed/effect receipt and its before-O injection
schedule only for current native-write non-adoption. The full original released-gap/private T protocol remains
unadopted. A bound row does not imply complete original-case or equipment equivalence.

| Rows | Actual native effect and checked boundary |
| --- | --- |
| 172–175 | Same-value journal, slot, configuration or claim UPDATE executes against an existing original row; its target bytes remain equal, but the unchanged operation refuses. |
| 176 | Graph revision actually increments inside the transaction; the original operation refuses, and the complete original image is restored. |
| 177–178 | Original cancelled ON row is actually deleted or its fault is changed; refusal restores the exact full journal and IDs. |
| 189 | A distinct current prepared journal row is actually inserted and observed, then rolled back instead of being adopted into the fixed journal. The original pending status is retired. |

The no-write variant uses the same native first-read/ON ordering and fulfills without changing the revision or
complete seven-table image. All variants preserve original refused transport outcome, cancelled command identity
and proof absence, configuration, claims, sources, slots, every journal row, branch state and graph revision.
No physical ON occurs. Every injected write finishes and its in-transaction effect is observed before refusal;
checking only unchanged final bytes would miss same-value native attempts. All owned work and observers join
before fixture cleanup.

Complete local consumers pass **418/418**, including **210/210** runtime cases, zero failures/skips; raw report
SHA-256 `4d7348c22e29840fc25924ddd2e6a6e62e48d6478adb43a98fddb92db634026f`. Omitting only the SQLite native mutation counter yields **7 FAIL / 2 PASS / 201 unrun**;
report SHA-256 `d31bc28b13f0b119e29b6a9a5e636cf4244369a0f3110e2de512ec7e5ced6d7f`. Seven cases incorrectly fulfill under that mutant. The no-write control still
fulfills, while the graph case still refuses through its independent revision fence; that mutant does not
discriminate graph validation. Original core bytes are restored before full positive qualification. Source/body/
helper/production/checklist/link audits and backend types, strict lint and formatting pass.

Preparation attempts retain their limits: a root Jest config lookup and retired pending status did not execute
any tests; a preset-preselection fixture timed out in three selected cases and its exact blocked interleaving
remains unqualified. The current exact-definition repeat passes without that preselection. A preliminary full
run was stopped to correct three lint-only Promise truthiness checks, and grants no full qualification.
No alpha publication, physical operation or installed-equipment acceptance occurs.

## Rows 143–151 and 182: original OFF capture lifetime

Ten scoped bindings share nine bound variants through the actual registered runtime, provider/ledger, SQLite and managed
SDK. The native automation provider installs and activates an eco baseline in the genuine transaction/ledger.
Controlled installed evidence supplies the original managed machine-session predicate. Public qualification
revoke/re-record and public installed polls reach a held actual SDK reconciliation fence. The captures retain
the actual hydrated device, claim and qualification; observers forward the original calls and Promise unchanged.

| Rows | Checked current boundary |
| --- | --- |
| 143, 145 | One shared positive execution: actual raw SQL generation is null, qualification omits the generation property, canonical hydrated Shelly getter is unshadowed, and completed native reconciliation stores the original observed provider release proof. |
| 144 | The original captured hydrated claim generation changes to a foreign string and back to null. Its pure metadata guard stays false after observed loss. This is an in-memory mutation, not a raw SQL UPDATE. |
| 146–151 | Own shadow, nearer getter, canonical getter/setter/flag or prototype-chain change invalidates original pure metadata. Restoring the exact original descriptor/chain cannot revive the capture; replacement getters execute zero times. |
| 182 | Replacing transport get invalidates the original actual command-adapter capture. Restoring the exact function cannot revive it. |

Each of the eight original negatives directly observes false before and after restoration **before owner stop**, and a fresh capture is
valid after restoration. The owner then stops and all issued work joins. Complete original journal IDs and rows
and configuration remain unchanged in the negatives. The positive permits only genuine original reconciliation
settlement and retains its observed provider proof; already confirmed rows remain unchanged. No ON is sent.
The correction latches observed loss independently in metadata and command-adapter captures and treats observation
exceptions as permanent loss. Merely restoring metadata permits a fresh capture; it cannot renew an old one.

This scope replaces the retired RuntimeOffDispatchWork/captureRuntimeFeedbackDelivery and PropertyValueService
emit-receipt boundary. The original exact two-fence schedule, receipt identities and full negative dispatch/drain
protocol are **unadopted**; the eight bound negative variants stop after the direct guard assertions. Row 144 covers captured
metadata continuity rather than the old dispatch-work identity. Rows 143 and 145 share one execution, not two
independent positive runs. Controlled machine evidence is not installed-equipment certification.

Complete local consumers pass **527/527**, including **220/220** runtime cases, zero failures/skips; raw report
SHA-256 `471d3562dd29bf1e2d204930482ab7ef1ae17e2151e7d58842e1ffafb3cf3651`. Exact original pre-PR transport production on the final runtime/unit source produces **17 FAIL / 1 PASS /
301 unrun**; raw report SHA-256 `2c3eb043c3ff2d4e44bf8f4b1b79e6614a04c34edeac70efc373f946a4f75a65`. All eight bound restoration negatives fail because the original guard
incorrectly becomes true after restoration; the additional active-owner and eight pure observation cases also fail.
The unchanged runtime control passes. The corrected source passes all eighteen selected executions.
All 184 previous witness bodies, 115 literal runtime bodies and 67 helper declarations are retained. Full source,
helper, production, original-identity, report, checklist and link audits plus backend types, lint and formatting pass.

Preparation failures remain separate: incomplete ledger setup, missing provider activation or missing machine
predicate did not reach the intended native gate. A seeded-ON preparation also never reached its gate and grants
no ON-ordering qualification. A temporary diagnostic identified the missing real session predicate and was removed.
Only the final activated native baseline and original session qualify the reports above. No alpha publication or
installed-equipment acceptance occurs.

### Readiness continuity and active-owner review follow-up

The same readiness capture now permanently closes after its original machine predicate, provider readiness
predicate or canReconcile predicate returns false or throws. Six pure false/throw recovery cases require the old
capture remain false without invoking recovered predicates again; a fresh capture succeeds. Two throw-once cases
exercise metadata and command-adapter exception paths. These synthetic unit controls grant no installed authority
and add no original-row bindings. All 33 prior transport-unit literal bodies and all shared fixture declarations
remain unchanged.

One additional active-own-shadow runtime variant keeps the owner active after restoring the exact descriptor.
The original genuine SDK proof is still current, but expired metadata prevents that proof from appearing in any
observed actual native branch UPDATE. A later fresh reconciliation stores a different proof observed from the
original provider; complete journal IDs/configuration remain equal, and only genuine pending-row settlement is
allowed. No ON occurs. Omitting runtime metadata admission checks makes this variant fail specifically because
the original expired-capture proof is observed in an actual native branch write (**1 FAIL / 219 unrun**); report
SHA-256 `d08abc646399bee2b1af6c6eda87ca95762099fad108eb4d8d205b9a0ac2d26d`. Corrected runtime production is restored byte-for-byte before the complete positive run.
This strengthens current admission coverage; complete retired receipt/dispatch protocols remain unadopted.

The complete follow-up invocation passes **527/527**, including **220 runtime** and **99 transport** cases.
Initial preparation failures were a branch-filter TypeScript error, an unnecessary assertion caught by lint,
and an overstrict active-owner pending-row equality after genuine fresh settlement; they are retained separately.

## Rows 112–115, 120–122 and 125: finite OFF failure and public retry

This section and its review follow-ups record merged #1535. Their 74/65 inventory checkpoint and reports are
historical; the current clock-lifetime batch qualification is above and below.

Eight scoped bindings share six expanded executions, plus one delayed-retry stress with no new original binding, through registered provider/runtime/native claims,
SQLite and the managed SDK, with controlled offline installation evidence. Three literal test bodies retain all
194 previous witness bodies, 116 prior runtime bodies and 69 helper declarations unchanged. Production is unchanged.

| Rows | Actual current boundary |
| --- | --- |
| 113, 122 | One shared proof-query execution: original native journal SELECT throws P after genuine SDK proof return; persistent later native Q remains finite and leaves the full original ON obligation unknown until an independent public retry stores an observed covering proof. |
| 114 | Original native P followed by persistent Q during actual command-entity hydration after the SQL read. This replaces the retired private inverse-probe query, not its exact query or frontier. |
| 115 | A real post-COMMIT callback throws P. Known committed confirmation/proof are retained; finite completion and later public retry do not convert that acknowledged settlement into new unknown debt. This is an explicit ACK difference from the old unknown-permit protocol. |
| 121 | Actual claims invalidation during accepted relay telemetry makes SDK reconciliation return null. Persistent native Q remains finite; actual claims refresh plus an independent public poll permits a new valid covering proof. |
| 112, 120 | One shared ordinary public-poll execution: original managed ON is held before SDK delivery with a true send guard; after completed request(controller,false), its exact guard is false while global claims remain current. The SDK refuses and the exact original row is cancelled, without ON. |
| 125 | Real graph writer queues behind a held runtime read. A later shared-reader request is observed waiting; independent SELECT 1 completes during writer ownership, then root reader SQL runs only after the graph UPDATE completes. |

Four failure variants use an owned excess gate to reject more than four current SDK fences instead of assuming
completion from a timer. Original errors and persistent secondary reads are observed through exact callthrough
Promises. Every preexisting journal row is retained in full; original unknown ON debt stays unproven after query/
hydration failures, while known committed confirmation remains confirmed after the post-ACK callback error.
A separate ordinary public request loads a distinct real context and completes recovery with an actual observed
proof covering the original ID. Repeated telemetry/queue/in-flight joins finish follow-up commands without a
second independent request; recovery requires no rejected successor evaluation and release-proven published
branches without runtime_error. Configuration remains exact and no ON is sent.

For the poll variant, controller-context guard loss is observed **after completed ordinary poll** and before a
later independent temperature change or SDK release. No synchronous-call-entry or global-claims invalidation
equivalence is claimed. The original comfort.settle and current ordinary poll are different public boundaries.
For the graph variant, actual waiting-reader and native-read evidence replace the old frozen negative-observer
identity. Retired mutation-writer roots, inverse negative probes, dirty frontiers, unknown permits and original
exact two/three-fence ceilings remain unadopted. These are scoped current business bindings, not whole original
private-protocol or equipment acceptance.

At merged #1535, complete local consumers passed **569/569**, ten complete files including **227 runtime cases** and the entire
structural-lock suite; raw report SHA-256 `345aea2d23b083c2debf48558c2063d3f95c3d65f54e4b88cbda5fd142adbc82`. The following two controls were measured
only at `cb98b3c` and were not replayed on the later full-file source. Omitting original runtime-context fencing
makes the original held ON guard incorrectly stay true (**1 FAIL / 225 unrun**); report SHA-256
`d80591aafd44599f7b8a57f4eb95b3bdbc5418e32ea3a32dd6d6249caedd75ba`. Allowing shared-reader admission to bypass an active writer causes two actual root
SELECTs while the writer owns the lock (**1 FAIL / 225 unrun**); report SHA-256
`a4d6bb6a8a9f207bad38a31374d6005811db9b120b72b724706a325e2c3b2e20`. Both original production files were restored before the `cb98b3c` positive qualification.
Full original-identity/source/body/helper/production/report/checklist/link audits plus types, lint and formatting pass.

Preparations retain explicit limits. A synchronous SQLite AfterQuery throw escaped the driver callback, left
connection work unjoined and caused ownership/hook timeouts and native finalizer abort (exit 134); that schedule
is unqualified and unresolved here. The current later-query fault occurs inside awaited ORM afterLoad. A later
missing-refresh preparation failed recovery and now uses actual refresh after deliberate invalidation. The first
writer-bypass control passed a weak test; adding an observed waiting reader and completed independent native read
makes the final control fail on actual reader SQL. Its weak raw counter report was overwritten before archival;
only its tool result is retained, and it grants no qualification. No alpha or physical equipment operation occurs.

### First public retry review follow-up

This subsection records historical source `fe30697`; its reports and four-variant counts are not the current measurement.

The first public retry now completes its actual telemetry, queued evaluation and issued commands before recovery
is asserted. This phase calls no helper that issues a second independent public request. Three unresolved-debt
variants require their original complete ON row to be confirmed with an observed provider proof covering its ID;
the known post-ACK variant retains its acknowledged confirmation and verifies the first public successor context.

Omitting the first retry from the former source still passes all four variants because settleReal could supply
another public request (**4 PASS / 222 unrun**); report SHA-256 `681a0591e4652639ad878a7a416689b9bc9c75c87a99eb605e8170bae1efcec7`.
Omitting it from the strengthened source fails all four (**4 FAIL / 222 unrun**); report SHA-256
`cf60bccc147c04ce45cf5fd13b37a482d9b64bc981a4ce1dd6708d3de7471f53`. Correct final test source is restored before complete positive qualification:
**568/568**, ten complete files, **226 runtime cases**, report SHA-256 `0ddfa5660b8a22ccda4aae3063feddafb04e39051796681fb736ff902b9f6593`.
The prior context-fence and writer-bypass controls retain their cb98b3c file attribution and unchanged individual
bodies; they were not replayed on this full-file follow-up source. All production files, 194 pre-PR witness bodies,
116 pre-PR runtime literal bodies and 69 helper declarations remain unchanged. Counts stay **74/139 bound,
65 unbound**, pending merge; no additional original row is adopted. The initial batch record is retained verbatim
in the ledger and the follow-up pins the reviewed source plus current bodies, helpers, reports and line anchors.

### Quiescent retry and successful recovery review follow-up

The first independent public retry now repeatedly joins actual telemetry, queued evaluations and issued commands
until both queues and in-flight work are empty. No second public request is issued. The post-ACK variant retains
its known confirmation and additionally requires no rejected successor evaluation, no runtime_error and
the recovered claim ID in published branches and release_proven on every branch; context replacement or an
empty branch list cannot qualify recovery. All five failure/
retry variants enforce those assertions. The additional delayed proof-query stress expires existing retry delays
while the first actual OFF is held at its SDK fence, then holds a second actual OFF until a later snapshot. The
second command ID is absent from the first snapshot and both actual commands finish confirmed. This is one
extra execution, not an additional original row; the eight scoped bindings still share six original executions.

The following four controls and positive report belong to the historical `2e771e0` qualification; the former
successor comparison explicitly uses `fe30697`. None of these controls was replayed by the published-claim
follow-up below. A test-only observer rejects the returned successor evaluation Promise after its original body completes.
The former `fe30697` post-ACK test accepts this (**1 PASS / 225 unrun**; report `d52e9a74a260dd7b2485fb1f2fa374715a37ba59c02da2b6b67c0af4b2dbaad6`).
Current assertions reject it (**1 FAIL / 226 unrun**; report `6c025559bd24d840685171c53a8016a42b5583ca5f23b4dcb7b7533fb8da2d75`).
This control proves assertion discrimination, not a native SQL fault or installed-provider failure schedule.
Replacing the repeated drain with a single snapshot leaves an actual OFF in flight (**1 FAIL / 226 unrun**;
report `56405b8c106ae9940c4ebddaa88796da24fb56011d27a7c155331bc35cb15094`). Omitting the sole public retry fails all five variants
(**5 FAIL / 222 unrun**; report `d814b3aba82846d7318df42b1f6834f29205b8d737e10c031bca285dfa0bc217`): four retain runtime_error,
and known post-ACK lacks a successor evaluation. At `2e771e0`, corrected test source was restored before positive
qualification: **569/569**, ten complete files, **227 runtime cases**, report SHA-256 `167c28b54ea3836e51596b9b93c6cbc55fd7a507acef20e6b14c878f3ba9979e`.

An initial one-gate delayed preparation let the single-snapshot control pass; its raw reports and sources are
retained unqualified. The final two-gate schedule above discriminates. No production, shared fixture or prior
194 witness bodies / 116 literal bodies / 69 helper declarations changed; 118 other reviewed literal bodies
remain identical. The `cb98b3c` context/writer controls and `fe30697` four-variant omission comparison retain their
historical source attribution and are not claimed as replayed here. Both prior batch records remain verbatim
in the ledger. Counts stay **74/139 bound, 65 unbound**, pending merge. The unresolved synchronous AfterQuery/
native finalizer preparation above remains unresolved; no alpha or installed-equipment clearance is granted.

The published-claim review follow-up adds one assertion that the actual recovered claim ID is present before
checking every release_proven. A test-local observer that replaces only returned diagnostic branches with an
empty array passes all five former `2e771e0` variants (**5 PASS / 222 unrun**; report
`cfd8d8664819f54bbf55d409e41888dd859dcb27aa23922ecfcbdb10b36edeb8`) and fails all five strengthened variants
(**5 FAIL / 222 unrun**; report `827163f3793c3d6d0831201f1792d574f19fc53676075bc69d0bbfc9e88689b0`).
This is assertion discrimination after actual runtime work; installed branch rows are not erased and no native
publication-failure schedule is qualified. Final test source is restored before **569/569** complete consumers,
including **227 runtime cases**, report SHA-256 `345aea2d23b083c2debf48558c2063d3f95c3d65f54e4b88cbda5fd142adbc82`. Production, fixture, counts and all
prior original identities are unchanged; both historical title differences are explicit beside entries 114/115.

## Rows 200–202, 209–210 and 212–213: bounded time and dispatch admission

This section records merged #1536; its 81/58 inventory, 576-case report and counterfactual measurements are
historical. Current replay/rollback qualification is above and below.

Seven executions in three appended literal bodies bind seven explicit **replacement** contracts. Actual
installation-loader/provider/runtime/native claims, SQLite and managed SDK are used with controlled offline
installation evidence. No currentness or SQL result is substituted. The process-local monotonic clock is
controlled, while actual public override/configure/get/settle and native writes supply the original evidence.

| Historical rows | Current replacement and explicit difference |
| --- | --- |
| 200, 201, 202, 210 | Native same-value configuration, changed/restored configuration, existing-slot same-value and rolled-back configuration writes preserve complete config/slot/journal images and close original dispatch admission. Public settle/get retains the exact original time-only lease/deadline, which expires at its original monotonic boundary while wall time is before absolute expiry. The retired combined TIME owner instead became false; this budget/admission separation intentionally replaces that combined capability. |
| 209 | A genuine same-row journal fault=fault UPDATE remains diagnostic bookkeeping: both claims and time budget stay current, complete rows remain equal. The old claims-DIRTY assertion, held native ON schedule and enclosed ORM effect are not adopted. |
| 212 | Repeated public reads persist monotone watermark, a cloned row and ordinary runtime poll retain original lease/deadline, and original monotonic expiry closes old reads. No retired read-view close, same-token clone or nativeCurrent identity is claimed. |
| 213 | A real public override B obtains a distinct lease ID. Late old/cloned A reads after A deadline, under a callthrough hydration spy, remain false and invoke no hydration; B lease/deadline and fresh claims stay current. The old native-loss-latch/read-close mechanism is replaced by public override identity isolation, not reproduced. |

The automation slot is created through actual public configure(automation_enabled=true), not fabricated. A real
transaction throws the exact sentinel after the native write and rolls back. All native update acknowledgements
are observed; equal complete row images do not turn catalog attempts into current old dispatch admission.
The budget itself deliberately remains current until its original deadline, and never acts as send authority.
All seven executions finish without ON sends or fixture errors. Row 211 remains among the 58 open entries.

Three production controls select all seven executions, each with 227 unrun. Re-registering the time budget on
every settlement fails six cases and passes B: five fail original-lease/deadline identity, and neutral reads fail
original watermark progress (**6 FAIL / 1 PASS**; report `ee5d691dd74d1804d7ceab2c143f814da860b5654930c4263e0cac93a53778a6`).
Ignoring original lease ID/revision fails only B at a late original-A read (**1 FAIL / 6 PASS**; report
`02024cde9766369aeb869681ea457ab876adfaf21b8baeebd5cfb75f348f2e9a`). Disabling catalog mutation classification fails the four
catalog variants while journal, neutral and B controls pass (**4 FAIL / 3 PASS**; report
`447e2a4190b2793d1c5694f75e5fcd97ff788086f147fe6d100fc01424e89963`). Original production is restored byte-for-byte before **576/576**,
ten complete files, **234 runtime cases**, report SHA-256 `0c3ea25b2ab402a439f0387ccc30dc6a590b4d2b626966f8c613773ee0fd9834`. All 202 prior witness bodies,
119 literal runtime bodies and 72 helpers remain unchanged; current 209 bindings, counts and all links verify.

Initial preparation passed neutral/B but five native variants failed because the disabled-automation fixture had
no installed slot. The public configure call now establishes that prerequisite; the raw failed source/report is
retained and is not a product failure or waiver. Earlier unqualified synchronous SQLite AfterQuery/native-finalizer
preparation remains unresolved. No whole retired private protocol, installed-equipment or alpha clearance follows.

## Rows 179, 191–192 and 199: native replay and nested rollback

This initial qualification records head `47bc7fb4c2653994588fa0fa561eaf7d332b58c3`. Its reports and
preparations remain historical; current bounded read-wait qualification follows below.

Four explicit replacement rows bind three injected executions through one appended literal table.
Two more variants control no effect and empty nested rollback. Actual runtime/provider/native-claims,
SQLite and managed SDK use controlled offline installation evidence; no native result or currentness guard is
substituted. The original held ON is fenced, refused and fully joined before the admitted unchanged-definition
repeat. All subscriber promises are explicitly joined before teardown. No physical ON or fixture error occurs.

| Historical rows | Current replacement and exact difference |
| --- | --- |
| 179, 199 | One shared execution captures the acknowledged original cancellation UPDATE, copies every bound value and replays the exact SQL in the new admitted comfort transaction. The runners are explicitly distinct, the original command is already complete, and all seven table images stay equal; the repeat rejects. This replaces recursive same-original-runner BeforeQuery replay, the dispatchedAt write, released-seed gap and enclosing ORM/caller effect. Journal bookkeeping outside this protected window remains neutral; the original global claims-DIRTY assertion is not adopted. |
| 191 | A nested managed transaction increments the real existing slot manualCounter; the complete table image changes, the exact sentinel rejects the transaction, and the complete seven-table before-image is restored. The enclosing repeat rejects. This replaces the independently issued foreign transaction before original command completion. |
| 192 | The same schedule increments actual configuration revision and proves its changed/restored complete image, exact original sentinel and enclosing-repeat rejection. The same independent pre-O chronology is not retained. |

Empty nested rollback also rejects. Consequently191/192 bind retained managed-child failure with actual native
write/rollback evidence, not isolated detection of a write that has otherwise left no trace. The no-effect variant
fulfills with unchanged revision. Neither variant is silently counted as an additional original case.

Omitting only the no-mutation mutation counter selects all five executions: **1 FAIL /4 PASS /234 unrun**.
Only replay changes its public result from rejection to fulfillment; none and all nested-rollback variants pass.
The report SHA-256 is `9dc6d387497834319f5ad6b75c389539674ceea86e7d2f6f39dc6f09b439ecb2`. This is a replay discriminator,
not a rollback-write discriminator. Production is restored byte-for-byte before **581/581**, ten complete files,
**239 runtime cases**, report SHA-256 `baa844e933eddd18b06be2f28efaf69dc015624a54a2de89b7ce8f1e7d622fd1`. All 209 previous bindings, 122 prior literal bodies and 72 helper
declarations remain unchanged; all 213 current witness bindings and checklist links verify.

The first preparation assumed the original and admitted runners were identical and failed before replay;
Jest formatting a runner comparison also accessed an unsupported Mongo manager getter. That assumption was
corrected to explicit distinct runners. A second attempt passed four variants but the late-after-query variant
fulfilled the public mutation while the old-runner descendant queued outside it; failed-test teardown then let
an unjoined subscriber reach a destroyed DataSource. This attempt is not qualified, does not diagnose a product
defect and does not bind row 215. Raw failed source/reports are retained. Row 215 remains open. Final subscriber
promises are joined. Earlier unqualified synchronous SQLite AfterQuery/native-finalizer preparation remains
unresolved. No retired private-protocol, installed-equipment or alpha acceptance is inferred.

## Read-wait review correction

This section records merged #1537. Its85/54 checkpoint and 581-case reports are historical; current native-origin
qualification follows below.

[The valid review finding](https://github.com/FastyBird/smart-panel/pull/1537#discussion_r4507540722) identified an
unbounded readiness wait that could hide mutation failure until Jest timeout. The wait now races the original
mutation promise and a five-second local deadline, with timer cancellation in finally. Unexpected early mutation
fulfillment also fails locally. Cleanup opens both original gates and joins the original command, mutation and
all subscriber promises before teardown. If a deadline exposes mutation rejection during cleanup, the exact
original cause is retained as AggregateError.cause/errors[0], alongside the readiness diagnostic in errors[1].
This matters because real pre-settlement failure intentionally waits for its held original predecessor.

Two current-source diagnostic controls each select only the no-effect case and deliberately fail it
(**0 PASS / 1 FAIL / 238 unrun** each). A real BeforeQuery rejection before readiness preserves the exact
original Error P in the aggregate after predecessor cleanup, with both pointer identities asserted; report
`cdd9e09002001e338edea47153fc22f31f6da08afd5dfa86412d239363aa1ec6`. Omitting readiness announcement while the actual first
read is held produces the exact local deadline error after joined command completion, with no ON or fixture
errors; report `3c4c647acceb3dd88a5c9dae9dbdace22651e2b2470eaa7099f078e25635e0a2`. Both complete before the 30-second Jest
timeout. These probes qualify diagnostic failure/cleanup only; they bind no additional original cases.

The native mutation-counter omission is replayed on the corrected source: **1 FAIL / 4 PASS / 234 unrun**,
only replay incorrectly fulfills; report `c4ff297714a57dc6ddbc9c77fa968244c12fc2a2e03bf948e77fa3676eea1c0e`. Production and
all test controls are restored before **581/581**, ten complete files, **239 runtime cases**, zero skips; report
SHA-256 `fada39c160f46cdf2a85c5cebe291ee21a1fb44f2602e87754e450a4aab142bf`. Types, strict lint, formatting, all 213 witness bindings and 139 checklist entries verify.
Erasing only the diagnostic additions restores every token of the previous table body, including all native
admission assertions. Other 122 literal bodies, all prior helper declarations, 28 production files and the shared
fixture are unchanged. Counts remain **85/139 bound and 54 unbound** in this pending batch; actual merged main
remains 81/139 until delivery.

The first P probe expected mutation completion before cleanup but observed only the local deadline because the
original native predecessor was still held. Its failed source/report is retained; the corrected cleanup preserves
P after joining that predecessor. Initial old-runner and earlier synchronous AfterQuery/native-finalizer
preparations remain unqualified. Row 215 remains open; this correction changes no original disposition.

## Rows 152, 154–155 and 161–164: native event and successor isolation

Seven explicit replacement bindings use five bound executions in three literal bodies plus a no-loss control.
Rows 152/155 share the held-after-admission execution; 154/161 share routing. Real provider/runtime/native claims,
SQLite, managed Shelly session/platform/delegate and core sample/event handling run with simulated SDK/HTTP/
storage and directly recorded offline qualification. Test-only AsyncLocalStorage records original command
ancestry and selects gates; it mints no production authority and replaces no guard or native outcome.

An initial accepted managed ON is observed through real telemetry before the OFF transition. This differs from
the old bootstrap/no-ON fixture. The relevant windows allow no further ON and preserve configuration; they do
not qualify installed equipment, the installation loader or complete retired work/receipt/caller protocols.

| Historical rows | Current replacement and exact difference |
| --- | --- |
|152|After actual native OFF sample admission, hold its original dispatch completion. The journal stays dispatching and original Promise incomplete while public inspect returns a new genuine context. Ordinary sample feedback can already retire A; the original live-A-episode-until-B/bootstrap schedule is not reproduced.|
|154|Replay the exact accepted OFF event after a genuine ordinary successor request. Exactly one controller request occurs, current authoritative sample remains equal, and complete configuration/journal/send images remain unchanged. This replaces private after-emit owned-delivery tagging with ordinary routing.|
|155|Late A completion cannot reinsert its original context, checked immediately and after settlement. Configuration revision is retained, sequence can progress and a distinct later native fence proof confirms history. Ordinary completion feedback may request new work; the historical no-additional-request/B-episode contract is deliberately replaced.|
|161|A genuine traced ON event accompanies an accepted ON row with no proof while release_proven is false. A manual producer-state notification causes one ordinary request. Observable command/proof separation replaces the retired OFF-work tag classifier and owned fixture protocol.|
|162–164|Invalidate actual claims, destroy actual PlatformRegistryService, or destroy actual runtime while the original OFF fence waits before response. Its original guard closes, original readback is not delivered and the complete original row becomes unknown without proof. Registry shutdown replaces the retired fixture revoke helper; SDK lease can remain live.|

Qualification attribution correction: unchanged useNativeClaimsGuard directly calls claims.recordQualification
with offline profiles. Neither it nor useRegisteredNativeClaimsGuard invokes the installation loader. Previous
loader wording for rows 179/191/192/199 overstated that setup and is corrected in their current comparisons.
The immutable prior ledger and historical nativeReplayRollbackBatch.scope are retained, with this explicit
correction; their bodies, assertions and dispositions are unchanged. Loader-backed tests elsewhere keep their
individual evidence, but this helper grants no loader execution or equipment acceptance.

The following five controls retain the original pre-review `beae28f` test source and report; they were not rerun after the routing assertion follow-up below.

| Original batch-source control | Measured selection and exact failure | Report SHA-256 |
| --- | --- | --- |
|Omit ordinary value-state listener|0 PASS / 1 FAIL / 244 unrun; manual request count stops advancing.|`a37af74648359a0de0125862ab786a1c48d22b26c2ac3c4534caa357e457168e`|
|Consume event objects only once|0 PASS / 1 FAIL / 244 unrun; original OFF replay no longer requests.|`99ab7b4fff34661414111b8ee970f757704ac33f8f6f506180e222d9cd9026ef`|
|Ignore OFF owner admission in SDK fence|0 PASS / 3 FAIL / 242 unrun; each loss delivers the forbidden original readback.|`e672df316ebc0d5ba0b66853fb82f47d2b32cf4664a5fa729ffde640d8e83b4a`|
|Join original predecessors in public inspect|0 PASS / 1 FAIL / 244 unrun; local bounded successor-progress diagnostic fires, not Jest timeout.|`d8b9a0a9466444b716725b96a3b436621d0f198d5e0e2688f50f4aa3deaf4550`|
|Reinsert old A after outcome write|0 PASS / 1 FAIL / 244 unrun; immediate context identity after original completion fails.|`265dbb625a0d9f5a3fdb2ff11a799f7132d8447d69680a628a1e537252a018da`|

All temporary sources are restored byte-for-byte before **587/587**, including **245 runtime cases**, ten
complete files, zero skips; report SHA-256 `58890c6fbe9e331fa2f90021fe21cb7329e6eaccf1cc83f165d9d47a186f2dd4`. The no-loss variant delivers a genuine original OFF
sample and later qualified proof. Types, strict lint, formatting, all 220 witness bindings/139 checklist entries
and source/body/helper/production/link audits pass. All 213 preceding witness bodies, 123 literal bodies and 74
helper declarations remain unchanged; 32 production files and the shared fixture are unchanged.

Initial preparations ran no tests: explicit typing was needed for a bound method, then a retired fixture revoke
helper had to be replaced by real registry shutdown. The first broad broken-SDK control had two functional
failures and a claims feedback-loop Jest timeout and is unqualified. Checking original delivery immediately
after original completion, before feedback flush, now makes all three focused losses fail functionally with joined
cleanup. Raw failed preparations are retained. Earlier delayed-old-runner and synchronous AfterQuery/native-
finalizer preparations remain unqualified. None of these failures is silently reclassified as a product defect.

## Original relay-event request review follow-up

This section records merged #1538. Its pending-PR and main 85/139 checkpoint below is historical; current lifetime qualification follows.

Review [5819926719](https://github.com/FastyBird/smart-panel/pull/1538#pullrequestreview-5819926719)
identified that original ON/OFF sample emission alone did not prove that either event requested evaluation.
A call-through emission observer now records the exact requests made synchronously inside each original
accepted relay event. Both original ON and original OFF must request exactly the current controllerId; later
settleReal or settlement work cannot satisfy those checks. Original emit/request return values, event objects,
dispatch/sample/manual/replay assertions and joined cleanup are retained. No production behavior changes.

Separate current-production controls suppress only ON or OFF sample requests while an actual command is in
flight, allowing later explicit replay. The former routing test passes each control (1 PASS,244 unrun); the
strengthened body fails each at its own original-event target assertion (1 FAIL,244 unrun), without Jest timeout.
All temporary sources are restored before the complete **587/587**, **245 runtime**, ten-file invocation, report
`58890c6fbe9e331fa2f90021fe21cb7329e6eaccf1cc83f165d9d47a186f2dd4`. Other 125 literal runtime bodies and all preceding helper declarations are unchanged. The prior five
batch controls and their report `e76a4ac675722dbdd0273186b3983ffbae4d0243eacff39c7b880d08b632b918` remain source-attributed historical evidence. Counts stay 92/139
bound, 47 unbound within this pending PR; merged main stays 85/139 until merge. Fresh exact-head CI and completed
nonblocking review remain required.

An initial broader OFF-omission preparation also blocked explicit replay, making the former test fail later;
it is not counted as a previously missed original-event defect. Final in-flight-only controls isolate the
original event. An initial whole-consumer run was interrupted before qualification to correct a strict-lint
argument type; the final fresh positive run uses unknown[] forwarding. The bot could not fully review this
checklist or the JSON ledger and lacked an ESLint sandbox dependency; complete independent ledger/body/helper/
source/production/report/link audits and actual local lint supplement its completed available-file review.

## Rows 180–181, 183–188, 193–194 and 219–220: native lifecycle and original completion

Twelve explicit replacements use eleven executions in four literal bodies; 188/220 share Error-P. The actual
managed Shelly SDK/platform/delegate, transport, claims/provider/runtime, SQLite and core source/event paths
run with simulated network/SDK/storage and directly recorded offline qualification. Call-through observations
retain original returned values and select real operations; no guard, native acknowledgement or adapter
outcome is fabricated. This fixture does not invoke the installation loader or operate installed equipment.

| Historical rows | Current replacement and exact difference |
| --- | --- |
|180|A original managed ON waits before send. Fresh B recovers independently and confirms old A history using actual OFF proof while A remains held. B later pauses only after its original shared read and an exclusive ticket prove SQL-owner release. A refuses native send, rejects its stale journal image and cannot rewrite B history/context/lifecycle. The old R132 seed/comfort-mutation and FIRST child/receipt/episode protocol is not reproduced.|
|181|Same-instance B retains the original in-flight command object, starts with dispatching history and a separate lifecycle. Known-unsent A cancellation completes while B released-owner load stays held; old A never borrows B admission or replaces B context. B then obtains actual qualified OFF. Old private seed, capability/child and feedback bookkeeping are replaced.|
|183,194|Oversized forged and cloned genuinely issued current decision identities cannot call native callbacks, query SQLite or change managed sends/fences while the real original request holds its first read. The oversized accessor is not touched; the original request subsequently completes normally. This binds WeakMap decision identity, replacing removed predecessor projection/size/close APIs rather than claiming a current size ceiling.|
|184–188|Actual managed ON is possibly sent and held after send. Same-instance bootstrap throws exact undefined/null/false/string/Error P from its real recovery BeforeQuery callback, rolls back and releases SQL. Actual admission cleanup runs then throws Q, which is logged without replacing P. Complete seven-table images and old held operation identity remain intact; lifecycle/timer/context/admission retire. This replaces old seed SELECT and foreign hook-descriptor cleanup and its known-unsent/no-ON setup; no foreign descriptor restoration is claimed.|
|193|A genuine ON is drained by actual qualified OFF before A stops. Fresh B has no live command; predecessor capture completes and genuine unchanged eco selection preserves complete seven-table native images and original confirmed command/proof. A call-through observer retains the exact original issued ON completion. Original A pending decisions must exclude it after completion. During public B capture, a test-local Node24 Promise-resource hook requires no continuation directly triggered by that actual Promise, detecting native await independently of then. Both direct-await reuse and omitted A removal pass the old witness and fail the current assertions. Public completion capture replaces private empty-set capability/size/close APIs.|
|219–220|Q-only rejects the exact native BeforeQuery Error with successful cleanup; Error-P plus real unregister-Q retains P and logs Q. Error-P is shared with 188. This replaces retired post-recovery claims.refresh replay, TIME assertions and explicit stderr reporting. It does not claim post-effect or post-release recovery callback equivalence.|

Native image comparison includes configuration, actuator claims, sources, climate automation slots, command
journal, branch runtime and graph revision, ordered by rowid. It does not include per-evaluation runtime
diagnostics. Initial ON is deliberate only in possibly-sent/bootstrap and terminal-history fixtures; lifecycle
before-send variants allow no ON. No completed history, Error result or callback grants actuation authority.

The following six controls are historical at reviewed head `8da977fe22378995495ad2d7432d5c068fc446c4`; none selected row193. They were not rerun in the membership follow-up below.

| Historical-source control | Actual selected result and failure | Report SHA-256 |
| --- | --- | --- |
|Replace bootstrap P with real cleanup Q|5 FAIL /1 PASS /250 unrun; all five P identities are replaced, Q-only stays correct.|`2035a4f6990551b3410271f3369b787a74645263dbcaac9d21be91ccac64be76`|
|Swallow original bootstrap rejection|6 FAIL /250 unrun; original completion incorrectly fulfills.|`5fe32f117215d7b6ea2f80769111ebeb944aa972875b89f887528ca27aff5b51`|
|Ignore journal native-image refusal|1 FAIL /1 PASS /254 unrun; stale fresh-A completion incorrectly fulfills, same-instance control passes.|`3ba7dca71bb34c63eef3f8a4b89a0a3eb525f19f9d45f740cef9847cb0b0d23b`|
|Lend a genuine decision to foreign identities|2 FAIL /254 unrun; native callback enters immediately before cleanup releases/joins actual SQL.|`10ec2a0a6bfda5feae5520a2cb5d799cb56a03b8f6bb66abd5087e5f1c49a5e9`|
|Omit SDK ON owner admission|2 FAIL /254 unrun; original ON outcome becomes unknown instead of refused.|`586a5c5e5bca8ab24a52819f0a651bebdabfffb9ab8de863929a6128ccde303e`|
|Join successor queue from late same-instance A|1 FAIL /255 unrun; local original-completion deadline detects the actual held B queue, before Jest timeout.|`1ee95e1adae099084e20283a90745710ce69a8ce367fc15e3218b57c8eb7a57a`|

All failures are functional and complete before Jest timeout. Five controls precede the complete positive run;
the additional successor-queue probe runs after it and restores identical measured production/test bytes. The
historical **598/598**, runtime **256/256**, ten-file positive invocation at `8da977fe22378995495ad2d7432d5c068fc446c4`, report `b3e3f216923db617c356142693533b3c2d7e782af1380586e3b555402d9c0cc3`. All 232 witness
bindings/139 checklist entries and source/body/helper/32-production-file/report/link audits pass. Previous 220
witness bodies, 126 runtime literals and 78 helper declarations remain unchanged; the fixture is unchanged.
Types, strict lint and formatting pass; fresh exact-head hosted CI and completed nonblocking review remain gates.

Preparations remain separate and unqualified: a nested shared-observer draft was interrupted, then restricted
by a reentrant-observer scope; a fresh-instance unknown expectation was corrected after actual B native proof
had already confirmed A history; a root-filtered successor gate failed its bounded readiness diagnostic. The
final gate is armed only after B bootstrap with A held and observes actual queries/SQL release. An AfterQuery
recovery-failure draft was interrupted and is unresolved alongside earlier native-finalizer preparations. The
qualified failure is BeforeQuery, not post-effect acknowledgement. No interrupted/preparation report is
counted as a positive witness or silently classified as a product defect. The first 598-case run and controls preceded strict-lint method typing and explicit-undefined corrections; those sources/reports remain preparation, and the final suite/controls are freshly rerun.

## Completed-history membership and claims-neutral recovery review follow-up

This section records historical head `b63f90f6e7a8a5fac9cea1312ff10fccb947debb`. Its then-spy observation detects then-based consumption only; native await bypasses it. It is not current proof for193 and is superseded by the native-await follow-up below. The row203 scope and runtime-row assertions remain valid and unchanged.

The two inline findings in [review5822499572](https://github.com/FastyBird/smart-panel/pull/1540#pullrequestreview-5822499572)
are addressed. Row193 now retains the exact genuine issued ON decision completion through a call-through
fixture observer. After that original completion settles, a call-through spy on its `then` method observes
zero subscriptions during fresh B public predecessor capture. Complete native images and confirmed proof
assertions remain. The spy preserves the actual Promise and its result; it grants no admission or outcome.

The temporary production mutation records genuine fulfilled completions and appends them to actual capture.
The previous witness passes **1/1**,255 unrun (report `c9693348ad0b88d36ef8d2671c8d0d0b42466605e8aabc48fd19ec2583b375b4`), demonstrating its blind spot.
The strengthened witness fails **1/1**,255 unrun at the membership assertion: zero subscriptions expected,
one observed (report `c208273b9494bcb9f04ad411996a5a8b5d1f9a5254403fd8a6df0faed3086468`). No timeout supplies that result. Production/test bytes
are restored before the fresh complete **598/598**,runtime **256/256**,ten-file positive invocation, report
`7a7e7e472a9682f523d71afffa1e9e0e90de078731cd1326965e118aa520ca63`. Types, strict ESLint and formatting pass. All128 other runtime literal bodies and82 prior
helper declarations remain token-identical;32 production files and the shared fixture remain byte-identical.

The review summary also suggests preserving the controller runtime row in bootstrap-failure rollback cases.
All six variants now capture that exact existing row before bootstrap and compare it after original rejection
and cleanup, while the original ON remains held. The seven-table helper remains unchanged; this additional
case-local assertion covers the diagnostic runtime row without broadening other image comparisons.

The finalizer nit assumes successor loading holds the shared structure lock while waiting for A. In this
fixture the hold follows the original completed `runShared` result and an awaited real exclusive-ticket round
trip before readiness is published. The selected counterfactual joins A to that released-owner B queue,
fails its targeted local deadline and exits teardown normally (historical join-successor-queue1FAIL/255unrun).
No lock-owning hold is introduced, so the proposed lock-release ordering change is unnecessary here.
No arbitrary production deadlock recovery or broader finalizer equivalence is claimed.

Row203 human checklist now explicitly labels the old claims-refresh title historical. Its current test
observes real claims capture after recovery transaction and structural ownership release; recovery stays
claims-neutral and performs no claims refresh. Its formal replacement/body are unchanged, and this prose
correction does not certify the retired refresh callback.

All261 original identities,232 witness bindings,139 checklist entries with104 checked,source/body/helper/
production/report/link audits pass. Counts stay **104/139 bound,35 open in this pending PR**, with actual
main still **92/139 bound,47 open**. The immutable nativeLifetimeBatch record retains its historical
positive-only193/no-dedicated-probe statement; nativeLifetimeReview supersedes that statement for current193.
Its six controls remain historical at8da977f; none selected193 and none was rerun here. Available-file bot review
could not fully read the JSON ledger and lacked sandbox ESLint; independent complete audits and actual strict
analysis supplement that coverage. Fresh exact-head CI and completed nonblocking review remain merge gates.

## Native-await consumption and original-owner removal review follow-up

[Review5822994313](https://github.com/FastyBird/smart-panel/pull/1540#pullrequestreview-5822994313) correctly
identifies a blind spot: native await of a fulfilled Promise bypasses its user-visible `then` method. The
previous then-spy control remains historical atb63f90f and no longer supplies current193 proof.

The replacement uses a test-local Node24 `async_hooks` init observer, enabled before the genuine ON decision
Promise is created. Its real resource identity is retained through the original call-through fixture callback.
During public fresh-B capture only, no PROMISE continuation may be directly triggered by that original id.
The original Promise, its methods and native outcomes are untouched; the hook disables in finally. This
observes native-await consumption without inventing a predecessor-list API or broader ancestry guarantees.
A separate exact-identity assertion checks removal from original A pending decisions after actual completion,
before A stops. Complete native images and confirmed command/proof assertions remain.

| Temporary production control | Previous b63f90f witness | Current witness |
| --- | --- | --- |
|Retain actual fulfilled history and directly await it in capture|1PASS/255unrun; `670ea028792ad354b3fd22cb5496103fced13b1f984fcde2d72f76fc3d1c224d`|1FAIL/255unrun at nonempty original-trigger continuation; `cbb5d7068d9298b340defe46dcc218b792518b965921b56019ca334045dd8b72`|
|Omit actual completed-decision deletion from original owner|1PASS/255unrun; `74f71100eb97fe4023e0c55df051b095900af696b377c796852759e4b5592b76`|1FAIL/255unrun at original Promise still in A pending; `1bf97463d8165d646b3f4654762d667f6e377171ed9b671e0fc8ddcfe51d539d`|

These are functional assertion failures, not timeouts. Production/test bytes restore before fresh complete
**598/598**,runtime **256/256**,ten files,zero skips; report `d061cbf859b3bbb401213ea44b3c93da01950792693ae8eb7e4c967746dea39a`. Types,strict lint,format and whitespace
pass. All261 identities,232 bindings,139 checklist entries/104 checked and source/body/helper/production/
report/link audits pass. All129 other literal bodies and83 prior helper declarations are unchanged;32
production files/shared fixture stay byte-identical. No new bindings or executions: pending104/139 bound,
35open; actual main92/139 bound,47open. Prior root records remain verbatim and source-attributed. JSON bot
review is incomplete, supplemented by independent complete audits and actual analysis. Fresh exact-head
CI and completed nonblocking review remain gates; no alpha or equipment clearance.

## Member settlement, captured native identity and read-only settle

Ten explicit current replacements use four literal bodies/ten executions. Rows124/130 share COMMIT-ACK-Q;130 additionally binds pre-write-Q,so eleven witness bindings do not imply eleven executions. Managed Shelly SDK/platform/
delegate/transport,core sample events,native claims/runtime and SQLite run with simulated SDK/network/storage
and direct offline qualification. The catalog helper creates actual protection/installation rows without
invoking the installation loader. No fabricated currentness predicate,native acknowledgement or adapter
outcome supplies success.

| Original rows | Exact current replacement and difference |
| --- | --- |
|110|Actual managed ON is followed by original managed OFF. Its genuine core false-sample listener throws exact P after sample emit; original OFF completion rejects P, the same failure is logged once, and its actual journal row is unknown with no proof. A separately held fresh SDK fence prevents premature settlement; only a later successful native readback confirms the same original row. Diagnostic async trace can propagate into queued work and is not treated as authority. This replaces removed active-C settlement/work tags and post-emit ownership capture; no shared old-C transaction or closed diagnostic async-origin guarantee is claimed.|
|123|Actual two-member protection/installation rows and managed native runtime start with qualified OFF. A conservative future read creates unavailable first-member debt; direct second-source invalidation creates a lower barrier while the whole maximum stays unchanged. Logical fixture receiver time then advances past that maximum, with real asynchronous SDK/SQLite scheduling. A held original second-member fence prevents all-leaf acknowledgement; only two current native proof times after the original maximum clear both barriers. This replaces retired negative-frontier/root continuation and its no-extra-request/second-third-fence ceiling protocol; the current public request is explicit.|
|124|The same actual lower-member/unchanged-whole-maximum boundary uses a real second-member native branch write followed by exact Q from that original runner after COMMIT. The row durably carries the new proof, but original request rejects Q; process-local proof identity and both barriers remain old while a distinct retry fence is held. Fresh successful native settlement is required to acknowledge all leaves. This replaces old independent N2 insertion, inverse-exclusion SELECT, consumed unknown frontier and automatic no-extra-request continuation; it does not call the committed transaction a rollback.|
|130|The primary current binding shares the actual commit-ack-error execution with row124: the second-member native row commits, exact Q rejects the original request, and the lower/whole barriers plus old process-local proof remain while a distinct retry fence is held. The additional before-write-error binding requires complete original branch-row preservation after real BeforeQuery Q, before the effect. Both require fresh all-leaf native success before acknowledgement. These current SDK-proof/native-write completion boundaries replace the old completed inverse-probe, consumed-frontier and automatic no-new-request scheduling protocol; no private negative-probe completion/token equivalence is granted.|
|156|A real captured managed native reconciliation is held before simulated native fence send. Replacing its provider profile copy makes the original production capture permanently non-current. Original native reconciliation returns null without a release proof or ON; restoring the exact descriptor does not revive that capture. A fresh real capture/SDK readback supplies the stored qualified OFF proof, with configuration/claims/sources/slots/graph unchanged and replacement functions never called. The old packet clone and owned-work admission API are not reproduced. No already-sent unowned false-delivery or historical R31 feedback tag is certified.|
|157|A real captured managed native reconciliation is held before simulated native fence send. Replacing its send wrapper makes the original production capture permanently non-current. Original native reconciliation returns null without a release proof or ON; restoring the exact descriptor does not revive that capture. A fresh real capture/SDK readback supplies the stored qualified OFF proof, with configuration/claims/sources/slots/graph unchanged and replacement functions never called. The current captured send-method identity replaces the retired OFF-work send identity. No already-sent unowned false-delivery or historical R31 feedback tag is certified.|
|158|A real captured managed native reconciliation is held before simulated native fence send. Replacing its contract version change makes the original production capture permanently non-current. Original native reconciliation returns null without a release proof or ON; restoring the exact descriptor does not revive that capture. A fresh real capture/SDK readback supplies the stored qualified OFF proof, with configuration/claims/sources/slots/graph unchanged and replacement functions never called. An actual captured adapter contract descriptor replaces the removed claim-object/work-token coupling; claim-clone refusal is not claimed. No already-sent unowned false-delivery or historical R31 feedback tag is certified.|
|159|A real captured managed native reconciliation is held before simulated native fence send. Replacing its reconcile wrapper makes the original production capture permanently non-current. Original native reconciliation returns null without a release proof or ON; restoring the exact descriptor does not revive that capture. A fresh real capture/SDK readback supplies the stored qualified OFF proof, with configuration/claims/sources/slots/graph unchanged and replacement functions never called. Captured reconciliation-method identity replaces the removed dispatch guard/work-token coupling; guard-wrapper identity refusal is not claimed. No already-sent unowned false-delivery or historical R31 feedback tag is certified.|
|230|The actual original managed ON is held at before-send, with no active comfort override and no pending notification. Public comfort.settle holds its first genuine configuration read while original claims admission, command guard and lifecycle stay current. The original SDK returns accepted before that read releases; its actual journal completion then records accepted. Configuration/claims/sources/slots/graph remain equal. This is the deliberately read-only current settle contract, replacing old R87 global entry revocation and refused/unknown expectations. It does not adopt active/expired-override mutation or retired response-recapture/first-read ownership protocols.|
|231|The actual original managed ON is held at after-send, with no active comfort override and no pending notification. Public comfort.settle holds its first genuine configuration read while original claims admission, command guard and lifecycle stay current. The original SDK returns accepted before that read releases; its actual journal completion then records accepted. Configuration/claims/sources/slots/graph remain equal. This is the deliberately read-only current settle contract, replacing old R87 global entry revocation and refused/unknown expectations. It does not adopt active/expired-override mutation or retired response-recapture/first-read ownership protocols.|

The member fixture uses a conservative future read to create unavailable first-member debt,then advances
only its existing logical receiver clock past that boundary; timers/SDK/SQLite scheduling stay real. Native
BeforeQuery failure precedes the row effect; afterTransactionCommit Q follows a real committed row with
unacknowledged process-local proof. Both retain barriers while a distinct retry fence is held. An intentional
ON occurs only in OFF-failure/public-settle fixtures; barrier/capture-refusal variants send no ON.

| Current-source control | Actual selected result | Report SHA-256 |
| --- | --- | --- |
|ignore-adapter-pin|4FAIL/0PASS/262unrun|`361ef2b0094cf40392ca8c16f1c0dd7fb8c1aaf3655525c0193d04acfc9a4036`|
|premature-member-ack|3FAIL/0PASS/263unrun|`7b8c45b588172b6eb83eed509515a6b1292773398f484114e45c811284d35d41`|
|swallow-settlement-error|2FAIL/1PASS/263unrun|`eb41f1b27efa980528b8b9bd42e28cd37cd52a86c9da74267aa112ce28d8d7d2`|
|swallow-dispatch-error|1FAIL/0PASS/265unrun|`1d28b7c8e753417035aea1ced19fe3acad6d5c0577e650f5bee67ce58619006e`|

All failures are functional,before Jest timeout. Production/test bytes restore before fresh complete
**608/608**,runtime **266/266**,ten files,zero skips;report `ca1a1c9e8c85cc33138cb776d39a8ea53dd1a5b8866552a89f1ab5d127961361`. Types,strict lint,format/whitespace
and all261 identities/243 bindings/139 checklist114checked/source/body/helper/32production/report/link
audits pass. All232 prior bindings,130 literal runtime bodies,83 helper declarations and shared fixture
remain unchanged. Shared helper/control metadata is stored once in memberSettlementBatch. Read-only
settle has positive exact guard/SDK/image assertions only;no dedicated negative probe is claimed for230–231.

The first event draft incorrectly used inherited diagnostic async origin to exclude fresh readbacks; a
second draft incorrectly required an empty error log after deliberately throwing original P. Their actual
failures/source snapshots are retained as preparation,not product defects. The final test uses real
successful readback/proof identities and requires that same P logged once. Early selected reports preceded
strict bound-method types and explicit read-only preconditions; final controls/full report use final source.
Prior root records and controls remain verbatim/historical. Actual main104/139 bound35open;pending batch
114/139 bound25open. #1447/#1462 open,#1473 frozen;no alpha/HW clearance.

## Native effects, original budget and closed descendants

Seven explicit current replacements use four literal bodies/seven executions. Actual managed SDK/core/native
claims/SQLite and installation-loader clock preparation run with simulated network/storage. No physical
equipment qualification is claimed. Current bounded time is separate from catalog/dispatch admission.

| Original row | Exact current replacement and difference |
| --- | --- |
|190|Original actual SDK ON is held before send. A completion descendant is registered on its original runtime command before that completion ends. Genuine claims invalidation closes its command guard; original native completion records cancelled/refused with no ON. Only after that completion and runtime retirement does the descendant replay the exact original acknowledged dispatching SQL and all bindings through its original runner. The full native image stays unchanged and original guard stays false. This replaces the retired O/T/released-seed protocol: no hereditary ORM capability or global journal-write claims invalidation is certified.|
|204|D is genuinely configured through current configure plus explicit comfort automation configuration, producing its real slot before managed fixture creation. C receives a genuine bounded eco override. D requestRelease advances D configuration/slot and graph, revokes original claims, then a fresh runtime owner with explicitly renewed offline qualification supplies actual D OFF/drain and qualified releaseEvidence. C complete configuration/slot and exact lease identity/deadline remain unchanged; C expires at its original monotonic deadline while wall expiry is still future. Current read-only time is separate from dispatch admission. Replaces the retired shared pipeline/held C ON/joined TIME API and automatic D-only scheduling; explicit fresh owner/public settlement and direct offline qualification are stated, not equipment qualification.|
|211|A genuine current override remains current through an observed call-through replacement and restoration of driver.prepareHydratedValue; synchronous original/clone time reads call no hydration method. Original lease/deadline remains exact. Crossing that original monotonic deadline expires the old snapshot; genuine public settle persists the same override as expired, removes its lease and cannot revive it. This explicitly replaces the retired method-pinned joined TIME contract: method replacement alone is neutral in the current hydration-free clock API, not an unimplemented pin silently waived.|
|215|A genuine successful native dispatching UPDATE captures its exact SQL, all bindings and original runner in AfterQuery. That callback deliberately enrolls a detached descendant without awaiting it. Its own gate remains held until genuine claims loss refuses the original SDK ON, the actual original command completes cancelled, and the original native transaction has ended. Replaying through that original runner preserves the complete native image and cannot revive the old command guard. This is the current closed-completion/guard boundary; it does not recreate the removed runtime-UPDATE held AfterQuery/global claims-DIRTY protocol or claim an awaited callback can finish before its own gate opens.|
|216|Actual ORM metadata maps claimId as UUID. A genuine native manager.insert of a well-formed existing claim creates exactly one prepared journal row without dispatch, proof or other native-table changes. Original claims admission and bounded override remain current; only the original monotonic deadline expires time. Runtime is deliberately stopped before insertion, so prepared history is not claimed as dispatched/drained. Current journal bookkeeping is claims-neutral, replacing retired foreign-journal DIRTY semantics.|
|217|The same genuine native INSERT with not-a-uuid claimId rejects through SQLite FOREIGN KEY constraint failure, has no successful INSERT callback, and leaves no row or complete native-image change. Original claims admission and bounded time remain current until the original deadline. This is actual FK refusal, not fabricated scalar-validation authority, and explicitly replaces the old malformed-attempt clock/claims invalidation contract.|
|218|A genuine same-value native configuration locked UPDATE preserves complete stored native images but closes old claims admission. Bounded override identity/deadline remains current until its original deadline; cloned stale time cannot renew it and no ON occurs. Current catalog/dispatch revocation and time lifetime are separate, replacing old protected-write joined TIME invalidation.|

All three nonblocking nits from #1541 review5825443528 are adopted: final original admission remains current
after read-only settle, a committed ACK error preserves lastVerifiedOffAt, and exact diagnostic claim-ID sets
precede all-leaf proof assertions. These strengthen three existing literal bodies, adding no cases.

Ignoring only the original monotonic deadline yields **5 FAIL/268unrun** on these exact test bytes;
report `9e9f6eeef51d8b0530f9dbc0919acc010f3045907e28758fb33caf6fc38fdd64`. Every failure is expected false/received true before Jest timeout.
Restored production passes **615/615**,runtime273,ten files,zero skips;report `dff5c16a4e1837543b38c73ae6e9a5130e2108e25646bb1cb0551d65d47c1d5e`.
Two late-descendant variants use positive exact guard/refusal/completion/SQL/image assertions without a new
dedicated probe. Previous controls retain their explicit historical source limits. All261 original identities,
250 bindings/243 rows,139 checklist entries/121 checked links,131 unchanged plus3 strengthened prior bodies,
88 previous helpers,32 production files and shared fixture verify. Types,strict lint,format and whitespace pass.

Initial D preparation failed because configure alone did not install automation; actual public comfort.configure
now installs D's slot before fixture creation. An initial negative-control run failed compilation before any
case; a pre-lint five-failure probe preceded final parameter types. Neither is current qualification or a
product defect. The final control/full report use final exact source. Previous root batch records stay verbatim.
Actual merged main114/139 bound25open;pending batch121/139 bound18open. #1447/#1462 open,#1473 frozen;
no alpha/HW actions. Remaining18 are setup/cleanup facets1–7,244–254.

## Case checklist

All entries were unbound at branch entry. A checked entry has a tested current binding in the
canonical ledger. Titles identify historical original scenarios; adjacent current-scope notes and ledger bindings
describe qualified replacement behavior. Original-source links retain full ancestry and body identity for parameterized cases.

### Retired fixture ownership

- [ ] `1473-001` — retires a genuinely held unadopted setup A before B adopts and never lets late A completion reclaim or close B ([original line 2967](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L2967)).
- [ ] `1473-002` — keeps an issued A read and publication on A while its resumed body cannot change a genuine held B inspection ([original line 3219](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L3219)).
- [ ] `1473-003` — preserves issued A SQL primary undefined before cleanup Q and leaves a foreign A descriptor and fresh B intact ([original line 3466](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L3466)).
- [ ] `1473-004` — preserves issued A SQL primary null before cleanup Q and leaves a foreign A descriptor and fresh B intact ([original line 3466](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L3466)).
- [ ] `1473-005` — preserves issued A SQL primary false before cleanup Q and leaves a foreign A descriptor and fresh B intact ([original line 3466](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L3466)).
- [ ] `1473-006` — preserves issued A SQL primary "native A primary" before cleanup Q and leaves a foreign A descriptor and fresh B intact ([original line 3466](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L3466)).
- [ ] `1473-007` — preserves issued A SQL primary [Error: native A primary] before cleanup Q and leaves a foreign A descriptor and fresh B intact ([original line 3466](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L3466)).

### OFF settlement and native safety debt

- [x] `1473-110` — Historical scenario: shares an actual active-C settlement across its native OFF report and closes event provenance after emit ([original line 8186](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L8186); [current replacement](original1473-case-map.json#L2888)). Current replacement: Actual managed ON is followed by original managed OFF. Its genuine core false-sample listener throws exact P after sample emit; original OFF completion rejects P, the same failure is logged once, and its actual journal row is unknown with no proof. A separately held fresh SDK fence prevents premature settlement; only a later successful native readback confirms the same original row. Diagnostic async trace can propagate into queued work and is not treated as authority. This replaces removed active-C settlement/work tags and post-emit ownership capture; no shared old-C transaction or closed diagnostic async-origin guarantee is claimed.
- [x] `1473-112` — a genuine later poll retains ordinary entry fencing instead of being labeled an owned report ([original line 8404](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L8404); [current binding](original1473-case-map.json#L2951)).
- [x] `1473-113` — finite failed OFF service retains native debt through actual proof-query failure without rearming its own unknown permit ([original line 8413](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L8413); [current binding](original1473-case-map.json#L2985)).
- [x] `1473-114` — Historical scenario: finite failed OFF service retains native debt through actual probe-query failure without rearming its own unknown permit ([original line 8413](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L8413); [current binding](original1473-case-map.json#L3013)). Current scope: original native P followed by Q during awaited ORM entity hydration after the SQL read; the retired inverse probe-query/frontier protocol is not adopted.
- [x] `1473-115` — Historical scenario: finite failed OFF service retains native debt through actual post-ACK failure without rearming its own unknown permit ([original line 8413](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L8413); [current binding](original1473-case-map.json#L3041)). Current scope: post-COMMIT callback P leaves known confirmed settlement and its covering proof acknowledged; successful independent retry is verified without converting that outcome to unresolved debt.
- [x] `1473-116` — detects independently committed new-id native ON debt despite the first consumed dirty frontier ([original line 8472](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L8472); [current binding](original1473-case-map.json#L3069)).
- [x] `1473-117` — detects independently committed same-id-risk native ON debt despite the first consumed dirty frontier ([original line 8472](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L8472); [current binding](original1473-case-map.json#L3146)).
- [x] `1473-118` — a real same-revision member change while the original fence is held remains ordinary safety work ([original line 8564](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L8564); [current binding](original1473-case-map.json#L3223)).
- [x] `1473-119` — a real same-revision source change while the original fence is held remains ordinary safety work ([original line 8564](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L8564); [current binding](original1473-case-map.json#L3298)).
- [x] `1473-120` — a genuine new local ON job still takes ordinary hold fencing before its native send ([original line 8618](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L8618); [current binding](original1473-case-map.json#L3373)).
- [x] `1473-121` — a persistent negative-read Q cannot rearm its own returned-safety episode, while a real poll can retry ([original line 8656](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L8656); [current binding](original1473-case-map.json#L3407)).
- [x] `1473-122` — a persistent negative-read Q cannot rearm its own rejected-safety episode, while a real poll can retry ([original line 8656](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L8656); [current binding](original1473-case-map.json#L3435)).
- [x] `1473-123` — Historical scenario: observes a lower second-member barrier even while the original whole-branch maximum stays unchanged ([original line 8755](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L8755); [current replacement](original1473-case-map.json#L3463)). Current replacement: Actual two-member protection/installation rows and managed native runtime start with qualified OFF. A conservative future read creates unavailable first-member debt; direct second-source invalidation creates a lower barrier while the whole maximum stays unchanged. Logical fixture receiver time then advances past that maximum, with real asynchronous SDK/SQLite scheduling. A held original second-member fence prevents all-leaf acknowledgement; only two current native proof times after the original maximum clear both barriers. This replaces retired negative-frontier/root continuation and its no-extra-request/second-third-fence ceiling protocol; the current public request is explicit.
- [x] `1473-124` — Historical scenario: does not consume native N2 when completion Q follows its inverse SELECT on a consumed unknown frontier ([original line 8885](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L8885); [current replacement](original1473-case-map.json#L3497)). Current replacement: The same actual lower-member/unchanged-whole-maximum boundary uses a real second-member native branch write followed by exact Q from that original runner after COMMIT. The row durably carries the new proof, but original request rejects Q; process-local proof identity and both barriers remain old while a distinct retry fence is held. Fresh successful native settlement is required to acknowledge all leaves. This replaces old independent N2 insertion, inverse-exclusion SELECT, consumed unknown frontier and automatic no-extra-request continuation; it does not call the committed transaction a rollback.
- [x] `1473-125` — admits the negative observer only after a genuinely queued native graph writer releases ([original line 9007](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9007); [current binding](original1473-case-map.json#L3531)).
- [x] `1473-126` — an unavailable baseline Q permits guarded OFF and preserves subsequent native Error outcome at its real root boundary ([original line 9091](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9091); [current binding](original1473-case-map.json#L3565)).
- [x] `1473-127` — an unavailable baseline Q permits guarded OFF and preserves subsequent native undefined outcome at its real root boundary ([original line 9091](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9091); [current binding](original1473-case-map.json#L3598)).
- [x] `1473-128` — an unavailable baseline Q permits guarded OFF and preserves subsequent native null outcome at its real root boundary ([original line 9091](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9091); [current binding](original1473-case-map.json#L3631)).
- [x] `1473-129` — an unavailable baseline Q permits guarded OFF and preserves subsequent native returned-safety outcome at its real root boundary ([original line 9091](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9091); [current binding](original1473-case-map.json#L3664)).
- [x] `1473-130` — Historical scenario: does not consume a lower member barrier when the completed native probe throws Q before scheduling ([original line 9183](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9183); [current replacement](original1473-case-map.json#L3697)). Current replacement: The primary current binding shares the actual commit-ack-error execution with row124: the second-member native row commits, exact Q rejects the original request, and the lower/whole barriers plus old process-local proof remain while a distinct retry fence is held. The additional before-write-error binding requires complete original branch-row preservation after real BeforeQuery Q, before the effect. Both require fresh all-leaf native success before acknowledgement. These current SDK-proof/native-write completion boundaries replace the old completed inverse-probe, consumed-frontier and automatic no-new-request scheduling protocol; no private negative-probe completion/token equivalence is granted.
- [x] `1473-131` — retains initial post-OFF publication Error P through actual failed-child probe Q ([original line 9357](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9357); [current binding](original1473-case-map.json#L3742)).
- [x] `1473-132` — retains initial post-OFF publication string P through actual failed-child probe Q ([original line 9357](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9357); [current binding](original1473-case-map.json#L3785)).
- [x] `1473-133` — retains initial post-OFF publication undefined P through actual failed-child probe Q ([original line 9357](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9357); [current binding](original1473-case-map.json#L3828)).
- [x] `1473-134` — retains initial post-OFF publication null P through actual failed-child probe Q ([original line 9357](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9357); [current binding](original1473-case-map.json#L3871)).
- [x] `1473-135` — R31 correlates genuine native certificate SUCCESS then same-evaluation publication Error P and probe Q ([original line 9504](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9504); [current binding](original1473-case-map.json#L3914)).
- [x] `1473-136` — R31 correlates genuine native certificate SUCCESS then same-evaluation publication string P and probe Q ([original line 9504](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9504); [current binding](original1473-case-map.json#L3957)).
- [x] `1473-137` — R31 correlates genuine native certificate SUCCESS then same-evaluation publication undefined P and probe Q ([original line 9504](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9504); [current binding](original1473-case-map.json#L4000)).
- [x] `1473-138` — R31 correlates genuine native certificate SUCCESS then same-evaluation publication null P and probe Q ([original line 9504](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9504); [current binding](original1473-case-map.json#L4043)).
- [x] `1473-139` — R31 admits a later genuine successful inherited evaluation despite its original Error publication P ([original line 9736](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9736); [current binding](original1473-case-map.json#L4086)).
- [x] `1473-140` — R31 admits a later genuine successful inherited evaluation despite its original string publication P ([original line 9736](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9736); [current binding](original1473-case-map.json#L4129)).
- [x] `1473-141` — R31 admits a later genuine successful inherited evaluation despite its original undefined publication P ([original line 9736](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9736); [current binding](original1473-case-map.json#L4172)).
- [x] `1473-142` — R31 admits a later genuine successful inherited evaluation despite its original null publication P ([original line 9736](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9736); [current binding](original1473-case-map.json#L4215)).
- [x] `1473-143` — R40 joins the actual SQL-null claim and omitted installed generation through original managed OFF provenance ([original line 10034](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L10034); [current binding](original1473-case-map.json#L4258)).
- [x] `1473-144` — R40 keeps original SQL-null dispatch work closed after a live raw generation mutation and restoration ([original line 10234](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L10234); [current binding](original1473-case-map.json#L4293)).
- [x] `1473-145` — R37 owns the unshadowed hydrated Shelly getter through genuine native OFF and retained release proof ([original line 10387](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L10387); [current binding](original1473-case-map.json#L4328)).
- [x] `1473-146` — R37 keeps original native dispatch provenance closed after observed own-shadow restoration during its actual emit ([original line 10503](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L10503); [current binding](original1473-case-map.json#L4363)).
- [x] `1473-147` — R37 keeps original native dispatch provenance closed after observed nearer-getter restoration during its actual emit ([original line 10503](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L10503); [current binding](original1473-case-map.json#L4398)).
- [x] `1473-148` — R37 keeps original native dispatch provenance closed after observed canonical-getter restoration during its actual emit ([original line 10503](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L10503); [current binding](original1473-case-map.json#L4433)).
- [x] `1473-149` — R37 keeps original native dispatch provenance closed after observed canonical-setter restoration during its actual emit ([original line 10503](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L10503); [current binding](original1473-case-map.json#L4468)).
- [x] `1473-150` — R37 keeps original native dispatch provenance closed after observed canonical-flags restoration during its actual emit ([original line 10503](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L10503); [current binding](original1473-case-map.json#L4503)).
- [x] `1473-151` — R37 keeps original native dispatch provenance closed after observed chain-link restoration during its actual emit ([original line 10503](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L10503); [current binding](original1473-case-map.json#L4538)).
- [x] `1473-152` — Historical scenario: R32 allows public ordinary B progress while original A is held after real sample admission and retires only A at completion ([original line 10636](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L10636); [current replacement](original1473-case-map.json#L4573)). Current replacement: An actual native OFF sample is admitted before its original detached managed dispatch is held. Public inspect returns a newer genuine context while that exact command remains dispatching and its original Promise is incomplete. After release, a later distinct native fence proof confirms history. The current sample event can already retire A before explicit B, and an initial accepted ON establishes the OFF transition; the old bootstrap/A-feedback-episode schedule is replaced.
- [x] `1473-153` — R31 joins only the original detached OFF operation while its actual outcome SAVE is held and schedules one ticket ([original line 10823](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L10823); [current binding](original1473-case-map.json#L4615)).
- [x] `1473-154` — Historical scenario: R31 routes the original accepted A payload ordinarily after genuine same-controller B replacement and after-emit closure ([original line 10924](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L10924); [current replacement](original1473-case-map.json#L4654)). Current replacement: Replay the exact original accepted OFF event object after a genuine ordinary successor request. It causes exactly one ordinary controller request, preserves the authoritative current sample and configuration/journal/send images, and grants no new sample or native command. Retired after-emit owned-delivery tagging is replaced by current ordinary event routing; no private origin-token equivalence is claimed.
- [x] `1473-155` — Historical scenario: R31 keeps a retired original held OFF completion from requesting or closing the installed B decision ([original line 10989](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L10989); [current replacement](original1473-case-map.json#L4696)). Current replacement: The original held OFF completes after public B without restoring A as the current context, checked immediately and after complete settlement. B configuration revision is retained and sequence can progress; old native readback proof is not reused, and a distinct later native fence proof confirms the original command. Current late completion may issue ordinary settlement feedback, deliberately replacing the old no-additional-request/private B-episode contract.
- [x] `1473-156` — Historical scenario: R31 leaves actual native false delivery unowned for packet-clone without minting a replacement work ([original line 11036](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11036); [current replacement](original1473-case-map.json#L4738)). Current replacement: A real captured managed native reconciliation is held before simulated native fence send. Replacing its provider profile copy makes the original production capture permanently non-current. Original native reconciliation returns null without a release proof or ON; restoring the exact descriptor does not revive that capture. A fresh real capture/SDK readback supplies the stored qualified OFF proof, with configuration/claims/sources/slots/graph unchanged and replacement functions never called. The old packet clone and owned-work admission API are not reproduced. No already-sent unowned false-delivery or historical R31 feedback tag is certified.
- [x] `1473-157` — Historical scenario: R31 leaves actual native false delivery unowned for send-replaced without minting a replacement work ([original line 11036](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11036); [current replacement](original1473-case-map.json#L4771)). Current replacement: A real captured managed native reconciliation is held before simulated native fence send. Replacing its send wrapper makes the original production capture permanently non-current. Original native reconciliation returns null without a release proof or ON; restoring the exact descriptor does not revive that capture. A fresh real capture/SDK readback supplies the stored qualified OFF proof, with configuration/claims/sources/slots/graph unchanged and replacement functions never called. The current captured send-method identity replaces the retired OFF-work send identity. No already-sent unowned false-delivery or historical R31 feedback tag is certified.
- [x] `1473-158` — Historical scenario: R31 leaves actual native false delivery unowned for claim-replaced without minting a replacement work ([original line 11036](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11036); [current replacement](original1473-case-map.json#L4804)). Current replacement: A real captured managed native reconciliation is held before simulated native fence send. Replacing its contract version change makes the original production capture permanently non-current. Original native reconciliation returns null without a release proof or ON; restoring the exact descriptor does not revive that capture. A fresh real capture/SDK readback supplies the stored qualified OFF proof, with configuration/claims/sources/slots/graph unchanged and replacement functions never called. An actual captured adapter contract descriptor replaces the removed claim-object/work-token coupling; claim-clone refusal is not claimed. No already-sent unowned false-delivery or historical R31 feedback tag is certified.
- [x] `1473-159` — Historical scenario: R31 leaves actual native false delivery unowned for guard-replaced without minting a replacement work ([original line 11036](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11036); [current replacement](original1473-case-map.json#L4837)). Current replacement: A real captured managed native reconciliation is held before simulated native fence send. Replacing its reconcile wrapper makes the original production capture permanently non-current. Original native reconciliation returns null without a release proof or ON; restoring the exact descriptor does not revive that capture. A fresh real capture/SDK readback supplies the stored qualified OFF proof, with configuration/claims/sources/slots/graph unchanged and replacement functions never called. Captured reconciliation-method identity replaces the removed dispatch guard/work-token coupling; guard-wrapper identity refusal is not claimed. No already-sent unowned false-delivery or historical R31 feedback tag is certified.
- [x] `1473-160` — R31 keeps a real failed outcome SAVE out of OFF_REPORTED without discarding native history ([original line 11095](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11095); [current binding](original1473-case-map.json#L4870)).
- [x] `1473-161` — Historical scenario: R31 never tags actual ON telemetry as OFF work and keeps manual producer-state notification ordinary ([original line 11139](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11139); [current replacement](original1473-case-map.json#L4903)). Current replacement: Actual managed ON produces a genuine traced accepted ON event and an accepted journal row with no proof while release_proven is false. A manual producer-state event produces one ordinary controller request. This replaces retired OFF-work tagging with observable command/proof separation and ordinary notification; it does not reproduce the old private tag classifier or owned setup/cleanup protocol.
- [x] `1473-162` — Historical scenario: R31 closes the genuine original dispatch origin on actual claims loss before its native readback ([original line 11260](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11260); [current replacement](original1473-case-map.json#L4945)). Current replacement: Invalidate the actual native claims service while the original managed OFF is held before native fence response. Its original admission guard becomes false, original readback delivery is absent, and the complete original journal row settles unknown without proof. No further ON occurs. Old private dispatch-work capture/delivery APIs are replaced by actual guarded readback and native history.
- [x] `1473-163` — Historical scenario: R31 closes the genuine original dispatch origin on actual native-registration loss before its native readback ([original line 11260](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11260); [current replacement](original1473-case-map.json#L4989)). Current replacement: Destroy the actual PlatformRegistryService while the original managed OFF fence is held. Its original admission guard closes, original readback delivery is absent, and the complete original command settles unknown without proof. The old fixture revoke helper is retired; real registry shutdown supplies registration loss. The SDK session itself need not be destroyed.
- [x] `1473-164` — Historical scenario: R31 closes the genuine original dispatch origin on actual destroy loss before its native readback ([original line 11260](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11260); [current replacement](original1473-case-map.json#L5033)). Current replacement: Destroy the actual runtime while its original managed OFF fence is held. The original guard closes, no original readback is delivered and the original command settles unknown without proof or new ON. Current lifecycle/readback/journal boundaries replace the retired private dispatch-origin work objects.

### Comfort, claims and original SDK send guards

- [x] `1473-165` — R132 reaches the original first read before O and admits only its real beforeOn acknowledged postimage ([original line 11787](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11787); [current binding](original1473-case-map.json#L5077)).
- [x] `1473-166` — R132 reaches the original first read before O and admits only its real afterOn acknowledged postimage ([original line 11787](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11787); [current binding](original1473-case-map.json#L5132)).
- [x] `1473-167` — Historical case: R132 keeps first outcome-save undefined primary even if original catch saves and O fulfills. Current binding requires `O` to reject with the identical original failure ([original line 11818](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11818); [current binding](original1473-case-map.json#L5187)).
- [x] `1473-168` — Historical case: R132 keeps first outcome-save null primary even if original catch saves and O fulfills. Current binding requires `O` to reject with the identical original failure ([original line 11818](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11818); [current binding](original1473-case-map.json#L5237)).
- [x] `1473-169` — Historical case: R132 keeps first outcome-save false primary even if original catch saves and O fulfills. Current binding requires `O` to reject with the identical original failure ([original line 11818](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11818); [current binding](original1473-case-map.json#L5287)).
- [x] `1473-170` — Historical case: R132 keeps first outcome-save "first native save P" primary even if original catch saves and O fulfills. Current binding requires `O` to reject with the identical original failure ([original line 11818](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11818); [current binding](original1473-case-map.json#L5337)).
- [x] `1473-171` — Historical case: R132 keeps first outcome-save [Error: first native save P] primary even if original catch saves and O fulfills. Current binding requires `O` to reject with the identical original failure ([original line 11818](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11818); [current binding](original1473-case-map.json#L5387)).
- [x] `1473-172` — R132 rejects genuine journal-same-value during the released seed gap without filtering full facts ([original line 11859](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11859); [current binding](original1473-case-map.json#L5437)).
- [x] `1473-173` — R132 rejects genuine slot-same-value during the released seed gap without filtering full facts ([original line 11859](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11859); [current binding](original1473-case-map.json#L5471)).
- [x] `1473-174` — R132 rejects genuine config-same-value during the released seed gap without filtering full facts ([original line 11859](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11859); [current binding](original1473-case-map.json#L5505)).
- [x] `1473-175` — R132 rejects genuine claim-same-value during the released seed gap without filtering full facts ([original line 11859](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11859); [current binding](original1473-case-map.json#L5539)).
- [x] `1473-176` — R132 rejects genuine graph during the released seed gap without filtering full facts ([original line 11859](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11859); [current binding](original1473-case-map.json#L5573)).
- [x] `1473-177` — R132 rejects genuine missing-row during the released seed gap without filtering full facts ([original line 11859](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11859); [current binding](original1473-case-map.json#L5607)).
- [x] `1473-178` — R132 rejects genuine foreign-fault during the released seed gap without filtering full facts ([original line 11859](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11859); [current binding](original1473-case-map.json#L5641)).
- [x] `1473-179` — Historical scenario: R132 rejects actual same-runner replay of the identical original UPDATE despite identical final bytes ([original line 11915](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11915); [current replacement](original1473-case-map.json#L5675)). Current replacement: The original acknowledged cancellation UPDATE and every bound parameter are captured, then replayed on the new admitted comfort transaction runner after the original managed command has completed. Complete seven-table images remain equal, yet the repeated definition rejects. This replaces recursive BeforeQuery replay on the still-original runner; runner identity and before-O chronology are explicitly not retained.
- [x] `1473-180` — Historical scenario: R132 cannot use A history as fresh-instance B admission or wait on B while native A is held ([original line 11951](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11951); [current replacement](original1473-case-map.json#L5752)). Current replacement: Stop A while its original managed ON is held before simulated native send. Fresh B bootstraps through its own recovery and genuine native OFF proof, confirming the historical A row while A remains held. A separate B load is held after actual shared SQL release and a genuine exclusive-ticket round trip. Releasing A refuses its original SDK send, and original completion rejects the stale journal image without changing B proof/history, lifecycle or published context. B subsequently reaches qualified OFF without ON. The original R132 seed/comfort mutation and FIRST child/receipt/feedback-episode protocol are replaced.
- [x] `1473-181` — Historical scenario: R132 cannot use A history as same-instance B admission or wait on B while native A is held ([original line 11951](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L11951); [current replacement](original1473-case-map.json#L5785)). Current replacement: Same-instance B starts while original A ON remains held; its exact original journal object stays dispatching until the known-unsent A result arrives. B load is then held after actual SQL ownership release. A completes cancelled before that B load is released, cannot reuse B admission or replace B context/lifecycle, and B later obtains actual qualified OFF without ON. This is a genuine current lifecycle/load boundary, replacing the old R132 seed, closed predecessor, FIRST OFF work/receipt and feedback-episode instrumentation.
- [x] `1473-182` — R132 rejects an observed original transport method loss and cannot resurrect it by restoring the function ([original line 13528](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13528); [current binding](original1473-case-map.json#L5818)).
- [x] `1473-183` — Historical scenario: R132 rejects forged oversized or cloned capture identities with zero native/database calls ([original line 13546](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13546); [current replacement](original1473-case-map.json#L5852)). Current replacement: An oversized forged current decision token with a nine-projection accessor is refused while an actual issued runtime decision holds its first native read. Neither its accessor nor native callback runs, actual query count and managed sends/fences remain unchanged, and the genuine original decision then completes normally. This replaces the removed ClimateAutomationPredecessors capture-size API with current WeakMap decision identity; no size ceiling or whole old capability protocol is claimed.
- [x] `1473-184` — Historical scenario: R132 releases a failed genuine seed without joining held N and retains primary undefined through cleanup Q ([original line 13559](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13559); [current replacement](original1473-case-map.json#L5884)). Current replacement: An actual managed ON is possibly sent and held after the simulated native send. Stopped A begins a real same-instance bootstrap whose original branch-recovery BeforeQuery callback throws the exact undefined P. Recovery rolls back, complete seven-table images remain equal and independent SQL finishes while the original ON remains held. Actual admission unregistration executes before throwing cleanup Q; bootstrap retains exact P, logs Q separately and retires its lifecycle/timer/context/admission. The old failed R132 seed SELECT, known-unsent/no-ON fixture and foreign hook-descriptor cleanup are explicitly replaced; no foreign-descriptor restoration is claimed.
- [x] `1473-185` — Historical scenario: R132 releases a failed genuine seed without joining held N and retains primary null through cleanup Q ([original line 13559](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13559); [current replacement](original1473-case-map.json#L5917)). Current replacement: An actual managed ON is possibly sent and held after the simulated native send. Stopped A begins a real same-instance bootstrap whose original branch-recovery BeforeQuery callback throws the exact null P. Recovery rolls back, complete seven-table images remain equal and independent SQL finishes while the original ON remains held. Actual admission unregistration executes before throwing cleanup Q; bootstrap retains exact P, logs Q separately and retires its lifecycle/timer/context/admission. The old failed R132 seed SELECT, known-unsent/no-ON fixture and foreign hook-descriptor cleanup are explicitly replaced; no foreign-descriptor restoration is claimed.
- [x] `1473-186` — Historical scenario: R132 releases a failed genuine seed without joining held N and retains primary false through cleanup Q ([original line 13559](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13559); [current replacement](original1473-case-map.json#L5950)). Current replacement: An actual managed ON is possibly sent and held after the simulated native send. Stopped A begins a real same-instance bootstrap whose original branch-recovery BeforeQuery callback throws the exact false P. Recovery rolls back, complete seven-table images remain equal and independent SQL finishes while the original ON remains held. Actual admission unregistration executes before throwing cleanup Q; bootstrap retains exact P, logs Q separately and retires its lifecycle/timer/context/admission. The old failed R132 seed SELECT, known-unsent/no-ON fixture and foreign hook-descriptor cleanup are explicitly replaced; no foreign-descriptor restoration is claimed.
- [x] `1473-187` — Historical scenario: R132 releases a failed genuine seed without joining held N and retains primary "seed read P" through cleanup Q ([original line 13559](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13559); [current replacement](original1473-case-map.json#L5983)). Current replacement: An actual managed ON is possibly sent and held after the simulated native send. Stopped A begins a real same-instance bootstrap whose original branch-recovery BeforeQuery callback throws the exact string P. Recovery rolls back, complete seven-table images remain equal and independent SQL finishes while the original ON remains held. Actual admission unregistration executes before throwing cleanup Q; bootstrap retains exact P, logs Q separately and retires its lifecycle/timer/context/admission. The old failed R132 seed SELECT, known-unsent/no-ON fixture and foreign hook-descriptor cleanup are explicitly replaced; no foreign-descriptor restoration is claimed.
- [x] `1473-188` — Historical scenario: R132 releases a failed genuine seed without joining held N and retains primary [Error: seed read P] through cleanup Q ([original line 13559](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13559); [current replacement](original1473-case-map.json#L6016)). Current replacement: An actual managed ON is possibly sent and held after the simulated native send. Stopped A begins a real same-instance bootstrap whose original branch-recovery BeforeQuery callback throws the exact Error P. Recovery rolls back, complete seven-table images remain equal and independent SQL finishes while the original ON remains held. Actual admission unregistration executes before throwing cleanup Q; bootstrap retains exact P, logs Q separately and retires its lifecycle/timer/context/admission. The old failed R132 seed SELECT, known-unsent/no-ON fixture and foreign hook-descriptor cleanup are explicitly replaced; no foreign-descriptor restoration is claimed.
- [x] `1473-189` — R132 rejects a real extra native journal INSERT rather than adopting it into the captured fixed set ([original line 13617](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13617); [current binding](original1473-case-map.json#L6049)).
- [x] `1473-190` — Historical scenario: R132 rejects an arbitrary later O descendant instead of lending it the closed native invocation ([original line 13638](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13638); [current replacement](original1473-case-map.json#L6083)). Current replacement: Original actual SDK ON is held before send. A completion descendant is registered on its original runtime command before that completion ends. Genuine claims invalidation closes its command guard; original native completion records cancelled/refused with no ON. Only after that completion and runtime retirement does the descendant replay the exact original acknowledged dispatching SQL and all bindings through its original runner. The full native image stays unchanged and original guard stays false. This replaces the retired O/T/released-seed protocol: no hereditary ORM capability or global journal-write claims invalidation is certified.
- [x] `1473-191` — Historical scenario: R132 vetoes an actually rolled-back slot write although complete row bytes are restored ([original line 13663](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13663); [current replacement](original1473-case-map.json#L6113)). Current replacement: A real nested managed transaction inside the admitted comfort repeat increments the existing slot manualCounter; a complete table image proves the native change, the exact sentinel rejects the nested transaction, and all seven tables return to their before-image. The enclosing repeat rejects without ON. An empty nested rollback also rejects, so this binds retained managed-child failure rather than isolated write-attempt discrimination. The original independently issued transaction before original-command completion is not reproduced.
- [x] `1473-192` — Historical scenario: R132 vetoes an actually rolled-back native-configuration write although complete row bytes are restored ([original line 13663](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13663); [current replacement](original1473-case-map.json#L6190)). Current replacement: A real nested managed transaction inside the admitted comfort repeat increments configuration revision; a complete table image proves the native change, the exact sentinel rejects the nested transaction, and all seven tables return to their before-image. The enclosing repeat rejects without ON. An empty nested rollback also rejects, so this binds retained managed-child failure rather than isolated write-attempt discrimination. The original independently issued transaction before original-command completion is not reproduced.
- [x] `1473-193` — Historical scenario: R132 does not reuse a completed A command as a live predecessor of a genuine fresh empty-set B no-op ([original line 13692](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13692); [current replacement](original1473-case-map.json#L6267)). Current replacement: A real managed ON completes and is drained by actual qualified OFF before A stops. A call-through afterOn observer retains the exact issued ON decision completion. After actual completion, A pending decisions must not contain that Promise. A test-local Node24 async_hooks observer records its genuine Promise resource identity from creation and requires no directly triggered PROMISE continuation during fresh B public predecessor capture. This observes actual native-await consumption as well as then-based consumption without replacing Promise methods, completion, admission or outcomes. Direct native-await reuse and omitted original-owner removal each pass the previous witness but fail their respective current assertions. Unchanged eco selection retains complete seven-table images and the original confirmed command/proof. The current public completion/removal boundary replaces the old private empty-set capability/size/close API and held-seed setup; no unexposed predecessor-list API or universal cross-runtime instrumentation equivalence is claimed.
- [x] `1473-194` — Historical scenario: R132 rejects a clone of a genuine captured capability without borrowing its original packet or O ([original line 13731](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13731); [current replacement](original1473-case-map.json#L6298)). Current replacement: Clone the genuinely issued current runtime decision identity while its original first native read remains held. The clone cannot run a native callback or obtain original completion; no query/sample/transport work occurs. The exact original request subsequently completes and publishes normal diagnostics. Current opaque decision identity replaces the retired predecessor-capability projection/size/close API.
- [x] `1473-195` — keeps counter-only effects claims-neutral and the original joined override time current without minting send authority ([original line 13761](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13761); [current binding](original1473-case-map.json#L6330)).
- [x] `1473-196` — uses the real runtime OFF/drain release through graph prelude and awaited claim UPDATE:clean ([original line 13836](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13836); [current binding](original1473-case-map.json#L6443)).
- [x] `1473-197` — uses the real runtime OFF/drain release through graph prelude and awaited claim UPDATE:qualification-loss ([original line 13836](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13836); [current binding](original1473-case-map.json#L6578)).
- [x] `1473-198` — keeps actual state, branch/noop, command journal and enabled derived lock writes command-current through managed ON ([original line 14515](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L14515); [current binding](original1473-case-map.json#L6713)).
- [x] `1473-199` — Historical scenario: rejects identical native journal SQL and ALL bindings from an actual same-runner subscriber without borrowing its enclosing ORM effect ([original line 14611](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L14611); [current replacement](original1473-case-map.json#L6858)). Current replacement: Every SQL byte and bound value of a real acknowledged original journal cancellation UPDATE is replayed in the admitted comfort transaction and completes with unchanged seven-table images, yet public repeat rejects. This shares the single captured-sql-replay execution with row 179. It replaces same-runner dispatchedAt BeforeQuery replay, retired enclosing-ORM effect ownership and global claims-DIRTY admission. Ordinary journal bookkeeping outside this protected no-mutation window remains neutral; that old global dirty assertion is not adopted.
- [x] `1473-200` — Historical scenario: keeps an original time owner closed after relevant native same-value and same-lifetime rejoin ([original line 14695](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L14695); [current replacement](original1473-case-map.json#L6935)). Current replacement: Actual native same-value configuration UPDATE closes the original claims admission; the original time-only lease remains current with unchanged deadline until its original monotonic expiry. This replaces the retired readIntent time-owner veto, not its false clock-currentness result.
- [x] `1473-201` — Historical scenario: keeps an original time owner closed after relevant native restore and same-lifetime rejoin ([original line 14695](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L14695); [current replacement](original1473-case-map.json#L7002)). Current replacement: Native locked-value change then restoration leaves the complete configuration equal. Original dispatch admission stays closed; public settlement/read retains the exact original time-only lease/deadline without budget renewal. No invisible-write ABA detection is claimed.
- [x] `1473-202` — Historical scenario: keeps an original time owner closed after relevant native slot and same-lifetime rejoin ([original line 14695](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L14695); [current replacement](original1473-case-map.json#L7069)). Current replacement: An existing automation slot is created through public configure(automation_enabled=true); a real manualCounter=manualCounter UPDATE preserves all slot rows but closes original dispatch admission. The time-only lease/deadline is retained. This replaces the removed combined TIME/slot capability.
- [x] `1473-203` — Historical scenario: refreshes genuine claims after recovery TX AND original structure release, and cleans a failed original bootstrap before same-instance restart ([original line 14821](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L14821); [current replacement](original1473-case-map.json#L7136)). Current replacement: Actual claims capture occurs after the recovery transaction and exact structural lease are inactive. Diagnostic recovery is claims-neutral and performs no claims refresh; the original refresh callback is not reproduced. The existing test also verifies failed bootstrap retirement, same-instance retry, fresh B independence and preservation of the original comfort lease without renewed budget.
- [x] `1473-204` — Historical scenario: preserves only C original remaining TIME across D complete requestRelease, native slot/config effects, qualified drain and new graph generation ([original line 14916](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L14916); [current replacement](original1473-case-map.json#L7270)). Current replacement: D is genuinely configured through current configure plus explicit comfort automation configuration, producing its real slot before managed fixture creation. C receives a genuine bounded eco override. D requestRelease advances D configuration/slot and graph, revokes original claims, then a fresh runtime owner with explicitly renewed offline qualification supplies actual D OFF/drain and qualified releaseEvidence. C complete configuration/slot and exact lease identity/deadline remain unchanged; C expires at its original monotonic deadline while wall expiry is still future. Current read-only time is separate from dispatch admission. Replaces the retired shared pipeline/held C ON/joined TIME API and automatic D-only scheduling; explicit fresh owner/public settlement and direct offline qualification are stated, not equipment qualification.
- [x] `1473-205` — keeps real enabled publication locks neutral while managed ON is pending before-send, then preserves actual refusal/UNKNOWN on original claims loss ([original line 15261](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L15261); [current binding](original1473-case-map.json#L7300)).
- [x] `1473-206` — keeps real enabled publication locks neutral while managed ON is pending after-send, then preserves actual refusal/UNKNOWN on original claims loss ([original line 15261](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L15261); [current binding](original1473-case-map.json#L7431)).
- [x] `1473-207` — preserves an original native bootstrap before-commit error and exact persisted outcome without first context/admission leakage ([original line 15374](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L15374); [current binding](original1473-case-map.json#L7562)).
- [x] `1473-208` — preserves an original native bootstrap after-ack error and exact persisted outcome without first context/admission leakage ([original line 15374](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L15374); [current binding](original1473-case-map.json#L7678)).
- [x] `1473-209` — Historical scenario: treats a foreign same-row journal write as claims-DIRTY even when its finite native effect preserves original TIME ([original line 15419](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L15419); [current replacement](original1473-case-map.json#L7794)). Current replacement: A real same-row fault=fault journal UPDATE is observed and preserves complete original journal/config/slot images. Current diagnostic journal bookkeeping is claims-neutral as well as budget-neutral. This intentionally replaces the old claims-DIRTY/held-native-ON schedule; that precise dirty assertion and private enclosing ORM effect remain unadopted.
- [x] `1473-210` — Historical scenario: keeps an original clock closed after a rolled-back same-value C write without resetting the restored lifetime ([original line 15869](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L15869); [current replacement](original1473-case-map.json#L7861)). Current replacement: An actual same-value configuration UPDATE succeeds inside a transaction that rejects with the original sentinel and rolls back. Complete configuration/slot/journal images are restored, old dispatch admission stays closed, and public settle/get retains the exact original time-only lease/deadline. This replaces the old readIntent false clock result.
- [x] `1473-211` — Historical scenario: pins the original native hydration method and never revives a clock after its observed replacement restores ([original line 15973](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L15973); [current replacement](original1473-case-map.json#L7928)). Current replacement: A genuine current override remains current through an observed call-through replacement and restoration of driver.prepareHydratedValue; synchronous original/clone time reads call no hydration method. Original lease/deadline remains exact. Crossing that original monotonic deadline expires the old snapshot; genuine public settle persists the same override as expired, removes its lease and cannot revive it. This explicitly replaces the retired method-pinned joined TIME contract: method replacement alone is neutral in the current hydration-free clock API, not an unimplemented pin silently waived.
- [x] `1473-212` — Historical scenario: R53 keeps original TIME through read close, same-token watermark clones and genuine ordinary neutral recovery ([original line 16069](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L16069); [current replacement](original1473-case-map.json#L7958)). Current replacement: Two real public get calls persist advancing watermark without intent/configuration mutation or original deadline renewal; a cloned active row and ordinary runtime poll retain the same time lease. Final monotonic expiry closes old/cloned reads while wall time remains before absolute expiry. Retired read-view close and same-token nativeCurrent/watermark-clone identities are not claimed.
- [x] `1473-213` — Historical scenario: R53 latches only observed original native A loss and never lets delayed A observation or close veto genuine B ([original line 16161](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L16161); [current replacement](original1473-case-map.json#L8023)). Current replacement: A real public replacement override obtains a distinct lease ID. After original A deadline but before B deadline, late A/cloned-A currentness reads under a callthrough hydration spy stay false without invoking hydration; B lease, deadline and fresh claims admission are unchanged. This replaces retired native-loss-latching and read-view-close APIs; hydration replacement alone is not claimed to invalidate an active current time-only lease.
- [x] `1473-214` — denies original command claims after a foreign actual claim revision mutation even with matching source and unchanged journal ([original line 16268](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L16268); [current binding](original1473-case-map.json#L8088)).
- [x] `1473-215` — Historical scenario: never lends a closed ORM effect to a held AfterQuery descendant issuing the identical native write later ([original line 16344](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L16344); [current replacement](original1473-case-map.json#L8212)). Current replacement: A genuine successful native dispatching UPDATE captures its exact SQL, all bindings and original runner in AfterQuery. That callback deliberately enrolls a detached descendant without awaiting it. Its own gate remains held until genuine claims loss refuses the original SDK ON, the actual original command completes cancelled, and the original native transaction has ended. Replaying through that original runner preserves the complete native image and cannot revive the old command guard. This is the current closed-completion/guard boundary; it does not recreate the removed runtime-UPDATE held AfterQuery/global claims-DIRTY protocol or claim an awaited callback can finish before its own gate opens.
- [x] `1473-216` — Historical scenario: keeps mapped UUID native journal work distinct from uuid scalar/protected rejection ([original line 16432](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L16432); [current replacement](original1473-case-map.json#L8242)). Current replacement: Actual ORM metadata maps claimId as UUID. A genuine native manager.insert of a well-formed existing claim creates exactly one prepared journal row without dispatch, proof or other native-table changes. Original claims admission and bounded override remain current; only the original monotonic deadline expires time. Runtime is deliberately stopped before insertion, so prepared history is not claimed as dispatched/drained. Current journal bookkeeping is claims-neutral, replacing retired foreign-journal DIRTY semantics.
- [x] `1473-217` — Historical scenario: keeps mapped UUID native journal work distinct from malformed scalar/protected rejection ([original line 16432](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L16432); [current replacement](original1473-case-map.json#L8274)). Current replacement: The same genuine native INSERT with not-a-uuid claimId rejects through SQLite FOREIGN KEY constraint failure, has no successful INSERT callback, and leaves no row or complete native-image change. Original claims admission and bounded time remain current until the original deadline. This is actual FK refusal, not fabricated scalar-validation authority, and explicitly replaces the old malformed-attempt clock/claims invalidation contract.
- [x] `1473-218` — Historical scenario: keeps mapped UUID native journal work distinct from protected scalar/protected rejection ([original line 16432](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L16432); [current replacement](original1473-case-map.json#L8306)). Current replacement: A genuine same-value native configuration locked UPDATE preserves complete stored native images but closes old claims admission. Bounded override identity/deadline remains current until its original deadline; cloned stale time cannot renew it and no ON occurs. Current catalog/dispatch revocation and time lifetime are separate, replacing old protected-write joined TIME invalidation.
- [x] `1473-219` — Historical scenario: reports a genuine recovery callback Q-only without changing bootstrap primary identity ([original line 16524](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L16524); [current replacement](original1473-case-map.json#L8338)). Current replacement: Q-only is the exact Error thrown by the original recovery BeforeQuery callback; actual registration cleanup succeeds, the real transaction rolls back and bootstrap rejects that same Q while a possibly-sent original ON remains held. No wrapper creates a successful native outcome. This replaces the old post-recovery claims.refresh replay, retired joined TIME assertions and explicit stderr reporting; those post-release paths are not reproduced.
- [x] `1473-220` — Historical scenario: reports a genuine recovery callback P+Q without changing bootstrap primary identity ([original line 16524](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L16524); [current replacement](original1473-case-map.json#L8370)). Current replacement: The Error P recovery-before-write variant is shared with row188: actual registration unregistration completes then throws Q. Bootstrap rejects exact original P and records only Q through its real cleanup logger; native rollback and complete images are verified before original ON releases. This replaces the old callback assertion/claims.refresh/stderr and joined TIME schedule; no post-native-effect or post-release recovery callback equivalence is claimed.
- [x] `1473-221` — retains only the original C deadline through BOTH actual recovery effects and a fresh post-release claims generation ([original line 16644](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L16644); [current binding](original1473-case-map.json#L8403)).
- [x] `1473-228` — observes original qualification data without installation or events and refuses a subsequent revoke without recapture ([original line 17357](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L17357); [current binding](original1473-case-map.json#L8674)).
- [x] `1473-229` — keeps missing qualification unavailable and remembers actual absence ABA across an admitted finite capture ([original line 17376](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L17376); [current binding](original1473-case-map.json#L8777)).
- [x] `1473-230` — Historical scenario: R87 public settle fences a held first read and preserves actual managed before-send native outcome without a response recapture ([original line 17393](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L17393); [current replacement](original1473-case-map.json#L8880)). Current replacement: The actual original managed ON is held at before-send, with no active comfort override and no pending notification. Public comfort.settle holds its first genuine configuration read while original claims admission, command guard and lifecycle stay current. The original SDK returns accepted before that read releases; its actual journal completion then records accepted. Configuration/claims/sources/slots/graph remain equal. This is the deliberately read-only current settle contract, replacing old R87 global entry revocation and refused/unknown expectations. It does not adopt active/expired-override mutation or retired response-recapture/first-read ownership protocols.
- [x] `1473-231` — Historical scenario: R87 public settle fences a held first read and preserves actual managed after-send native outcome without a response recapture ([original line 17393](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L17393); [current replacement](original1473-case-map.json#L8910)). Current replacement: The actual original managed ON is held at after-send, with no active comfort override and no pending notification. Public comfort.settle holds its first genuine configuration read while original claims admission, command guard and lifecycle stay current. The original SDK returns accepted before that read releases; its actual journal completion then records accepted. Configuration/claims/sources/slots/graph remain equal. This is the deliberately read-only current settle contract, replacing old R87 global entry revocation and refused/unknown expectations. It does not adopt active/expired-override mutation or retired response-recapture/first-read ownership protocols.
- [x] `1473-232` — keeps original actual SDK before-send outcome truthful when comfort entry waits on its first real read ([original line 17579](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L17579); [current binding](original1473-case-map.json#L8940)).
- [x] `1473-233` — keeps original actual SDK after-send outcome truthful when comfort entry waits on its first real read ([original line 17579](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L17579); [current binding](original1473-case-map.json#L9061)).

### Named original OFF completion

- [x] `1473-241` — rejects the test receipt without S1 while preserving exact native effects after the actual OFF is refused ([original line 18597](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L18597); [current binding](original1473-case-map.json#L9392)).
- [x] `1473-242` — rejects the test receipt without S1 while preserving exact native effects after the actual OFF is unknown ([original line 18597](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L18597); [current binding](original1473-case-map.json#L9481)).
- [x] `1473-243` — cannot let a retired A completion settle B or restore a foreign descriptor ([original line 18663](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L18663); [current binding](original1473-case-map.json#L9570)).

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

- [x] `1473-261` — preserves ordinary prototype identity checks and refuses changed or missing methods ([original line 19304](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L19304); [current binding](original1473-case-map.json#L9929)).
