# Remaining original thermostat acceptance

This follow-up starts from merged PR #1508 (`4a3033e1d6050252a5b45fc9972b6f958e463a22`).
Its exact reviewed head `3af1c1be7f8bb21a757b60feefa935331c3fe0c7` passed all 14 checks,
including 13,306 backend tests and all 424 E2E cases. CodeRabbit reported no actionable comments.
The separate local 362 PASS / 62 FAIL E2E result and unattributed SQLite ownership timeouts remain
recorded in #1508; hosted success does not establish their cause.

**Status: draft; 4 of the original 139 residuals have tested current bindings, and 135 remain unbound.**
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

Before this draft becomes ready, reconcile all 139 rows, preserve the already scoped 122 dispositions,
run required exact-head checks, and obtain completed nonblocking source review. Actual alpha publication
and installed-equipment qualification remain separate gates in #1462.

## Current binding evidence

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
- [ ] `1473-116` — detects independently committed new-id native ON debt despite the first consumed dirty frontier ([original line 8472](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L8472)).
- [ ] `1473-117` — detects independently committed same-id-risk native ON debt despite the first consumed dirty frontier ([original line 8472](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L8472)).
- [ ] `1473-118` — a real same-revision member change while the original fence is held remains ordinary safety work ([original line 8564](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L8564)).
- [ ] `1473-119` — a real same-revision source change while the original fence is held remains ordinary safety work ([original line 8564](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L8564)).
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
- [ ] `1473-131` — retains initial post-OFF publication Error P through actual failed-child probe Q ([original line 9357](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9357)).
- [ ] `1473-132` — retains initial post-OFF publication string P through actual failed-child probe Q ([original line 9357](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9357)).
- [ ] `1473-133` — retains initial post-OFF publication undefined P through actual failed-child probe Q ([original line 9357](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9357)).
- [ ] `1473-134` — retains initial post-OFF publication null P through actual failed-child probe Q ([original line 9357](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9357)).
- [ ] `1473-135` — R31 correlates genuine native certificate SUCCESS then same-evaluation publication Error P and probe Q ([original line 9504](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9504)).
- [ ] `1473-136` — R31 correlates genuine native certificate SUCCESS then same-evaluation publication string P and probe Q ([original line 9504](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9504)).
- [ ] `1473-137` — R31 correlates genuine native certificate SUCCESS then same-evaluation publication undefined P and probe Q ([original line 9504](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9504)).
- [ ] `1473-138` — R31 correlates genuine native certificate SUCCESS then same-evaluation publication null P and probe Q ([original line 9504](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9504)).
- [ ] `1473-139` — R31 admits a later genuine successful inherited evaluation despite its original Error publication P ([original line 9736](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9736)).
- [ ] `1473-140` — R31 admits a later genuine successful inherited evaluation despite its original string publication P ([original line 9736](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9736)).
- [ ] `1473-141` — R31 admits a later genuine successful inherited evaluation despite its original undefined publication P ([original line 9736](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9736)).
- [ ] `1473-142` — R31 admits a later genuine successful inherited evaluation despite its original null publication P ([original line 9736](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L9736)).
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
- [ ] `1473-195` — keeps counter-only effects claims-neutral and the original joined override time current without minting send authority ([original line 13761](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13761)).
- [ ] `1473-196` — uses the real runtime OFF/drain release through graph prelude and awaited claim UPDATE:clean ([original line 13836](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13836)).
- [ ] `1473-197` — uses the real runtime OFF/drain release through graph prelude and awaited claim UPDATE:qualification-loss ([original line 13836](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L13836)).
- [ ] `1473-198` — keeps actual state, branch/noop, command journal and enabled derived lock writes command-current through managed ON ([original line 14515](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L14515)).
- [ ] `1473-199` — rejects identical native journal SQL and ALL bindings from an actual same-runner subscriber without borrowing its enclosing ORM effect ([original line 14611](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L14611)).
- [ ] `1473-200` — keeps an original time owner closed after relevant native same-value and same-lifetime rejoin ([original line 14695](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L14695)).
- [ ] `1473-201` — keeps an original time owner closed after relevant native restore and same-lifetime rejoin ([original line 14695](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L14695)).
- [ ] `1473-202` — keeps an original time owner closed after relevant native slot and same-lifetime rejoin ([original line 14695](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L14695)).
- [ ] `1473-203` — refreshes genuine claims after recovery TX AND original structure release, and cleans a failed original bootstrap before same-instance restart ([original line 14821](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L14821)).
- [ ] `1473-204` — preserves only C original remaining TIME across D complete requestRelease, native slot/config effects, qualified drain and new graph generation ([original line 14916](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L14916)).
- [ ] `1473-205` — keeps real enabled publication locks neutral while managed ON is pending before-send, then preserves actual refusal/UNKNOWN on original claims loss ([original line 15261](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L15261)).
- [ ] `1473-206` — keeps real enabled publication locks neutral while managed ON is pending after-send, then preserves actual refusal/UNKNOWN on original claims loss ([original line 15261](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L15261)).
- [ ] `1473-207` — preserves an original native bootstrap before-commit error and exact persisted outcome without first context/admission leakage ([original line 15374](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L15374)).
- [ ] `1473-208` — preserves an original native bootstrap after-ack error and exact persisted outcome without first context/admission leakage ([original line 15374](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L15374)).
- [ ] `1473-209` — treats a foreign same-row journal write as claims-DIRTY even when its finite native effect preserves original TIME ([original line 15419](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L15419)).
- [ ] `1473-210` — keeps an original clock closed after a rolled-back same-value C write without resetting the restored lifetime ([original line 15869](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L15869)).
- [ ] `1473-211` — pins the original native hydration method and never revives a clock after its observed replacement restores ([original line 15973](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L15973)).
- [ ] `1473-212` — R53 keeps original TIME through read close, same-token watermark clones and genuine ordinary neutral recovery ([original line 16069](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L16069)).
- [ ] `1473-213` — R53 latches only observed original native A loss and never lets delayed A observation or close veto genuine B ([original line 16161](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L16161)).
- [ ] `1473-214` — denies original command claims after a foreign actual claim revision mutation even with matching source and unchanged journal ([original line 16268](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L16268)).
- [ ] `1473-215` — never lends a closed ORM effect to a held AfterQuery descendant issuing the identical native write later ([original line 16344](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L16344)).
- [ ] `1473-216` — keeps mapped UUID native journal work distinct from uuid scalar/protected rejection ([original line 16432](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L16432)).
- [ ] `1473-217` — keeps mapped UUID native journal work distinct from malformed scalar/protected rejection ([original line 16432](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L16432)).
- [ ] `1473-218` — keeps mapped UUID native journal work distinct from protected scalar/protected rejection ([original line 16432](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L16432)).
- [ ] `1473-219` — reports a genuine recovery callback Q-only without changing bootstrap primary identity ([original line 16524](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L16524)).
- [ ] `1473-220` — reports a genuine recovery callback P+Q without changing bootstrap primary identity ([original line 16524](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L16524)).
- [ ] `1473-221` — retains only the original C deadline through BOTH actual recovery effects and a fresh post-release claims generation ([original line 16644](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L16644)).
- [ ] `1473-228` — observes original qualification data without installation or events and refuses a subsequent revoke without recapture ([original line 17357](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L17357)).
- [ ] `1473-229` — keeps missing qualification unavailable and remembers actual absence ABA across an admitted finite capture ([original line 17376](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L17376)).
- [ ] `1473-230` — R87 public settle fences a held first read and preserves actual managed before-send native outcome without a response recapture ([original line 17393](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L17393)).
- [ ] `1473-231` — R87 public settle fences a held first read and preserves actual managed after-send native outcome without a response recapture ([original line 17393](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L17393)).
- [ ] `1473-232` — keeps original actual SDK before-send outcome truthful when comfort entry waits on its first real read ([original line 17579](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L17579)).
- [ ] `1473-233` — keeps original actual SDK after-send outcome truthful when comfort entry waits on its first real read ([original line 17579](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L17579)).

### Named original OFF completion

- [x] `1473-241` — rejects the test receipt without S1 while preserving exact native effects after the actual OFF is refused ([original line 18597](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L18597)).
- [x] `1473-242` — rejects the test receipt without S1 while preserving exact native effects after the actual OFF is unknown ([original line 18597](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L18597)).
- [x] `1473-243` — cannot let a retired A completion settle B or restore a foreign descriptor ([original line 18663](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L18663)).

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

- [x] `1473-261` — preserves ordinary prototype identity checks and refuses changed or missing methods ([original line 19304](https://github.com/FastyBird/smart-panel/blob/2c19907c361ca66540e8f5d05fe24a5ff9cab0c2/apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts#L19304)).
