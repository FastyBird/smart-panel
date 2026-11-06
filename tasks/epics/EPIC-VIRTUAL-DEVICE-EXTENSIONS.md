# Epic: Virtual device extensions and automation

ID: EPIC-VIRTUAL-DEVICE-EXTENSIONS
Type: epic
Scope: backend, admin, panel, spec, sdk
Status: in_progress
Tracking: [#1447](https://github.com/FastyBird/smart-panel/issues/1447)

## Objective

Deliver the previously deferred virtual-device extensions before the next alpha, update documentation against the
implemented state, then perform final installed-device testing after that alpha. Preserve completed #1409 and #1446.

Design: [virtual-device extensions](../../docs/superpowers/specs/2026-10-15-virtual-device-extensions-design.md).
The user explicitly selected both Home Assistant climate and Zigbee2MQTT native-unit adapters.

## Delivery tasks

Rows track independently verifiable acceptance, not one PR per issue. Keep each PR small and independently
reviewable, following the user's current preference. Separate implementation, evidence and summaries when their
combined diff becomes large; retain explicit dependencies and exact-head CI/review for every layer. Review limits
do not justify growing an already reviewable batch. The first combined delivery,
[PR #1464](https://github.com/FastyBird/smart-panel/pull/1464), merged the plan plus VD3-1 and VD3-4.

Checkboxes mean merged, tested software, not candidate code or installed qualification. A child closes only after its
entire acceptance is satisfied, even when its PR also closes other issues.

### Reconciled software progress — 2026-11-06

Summary base is merged main `1213149b8960a55536dfd6cd4687aaaea96a701d` (#1509).
The [acceptance reconciliation](../../docs/virtual-device-extensions-acceptance.md) now adopts the named combined
activity and schedule/occupancy/manual-precedence witnesses delivered by #1508, with the later #1517 fixture
correction. The current all-available-domain unit variants complement that actual HTTP operation. Plans (#1501),
occupancy (#1502), native thermostats (#1504) and cover/HomeKit (#1505) retain their reviewed delivery evidence.
Original-reference reconciliation, remaining final acceptance and alpha remain #1462.

- [x] VD3-1 / #1448: weighted/filtering numeric policies, #1464.
- [x] VD3-2 / #1449: additional numeric and binary profiles, #1465.
- [x] VD3-3 / #1450: aggregate authoring and quality, #1465.
- [x] VD3-4 / #1451: switch/outlet group foundation, #1464.
- [x] VD3-5 / #1452: fan/cover COMMAND and qualified native percentage POSITION/TILT, #1467/#1505.
- [x] VD3-6 / #1453: group authoring/repair, Panel, scenes and supported room paths, #1466/#1467.
- [x] VD3-7 / #1455: presets, durable overrides, effective arbitration and clients, #1469/#1470 and later native-intent fixes.
- [x] VD3-8 / #1458: existing bridge/scheduler/occupancy composition, explicit presets and independent manual priorities; criterion evidence adopted below.
- [x] VD3-9 / #1459: typed dew point and cooling cutoff software, #1471.
- [x] VD3-10 / #1454: provider-neutral guarded parallel branches, #1469/#1470/#1471.
- [x] VD3-11 / #1456: Home Assistant native-unit adapter and ordinary virtual authoring, merged #1504.
- [x] VD3-12 / #1457: Zigbee2MQTT capability-qualified native adapter, merged #1504.
- [x] VD3-13 / #1460: SDK numeric operators, #1468.
- [x] VD3-14 / #1461: standard and native/composed HomeKit mappings, #1466/#1505.
- [ ] VD3-15 / #1462: final composed/upgrade/reference-scenario acceptance, docs and actual alpha publication remain.

Reused definitions #1292, activity API #1294, Admin #1295 and Panel #1296 retain their scoped software evidence.
The original all-available-domain requirement of #1293 is now covered by the actual combined HTTP operation,
its failed-media variant and the explicit unit fan-out/failure variants. Time scheduling #1297/#1298/#1362 and
occupancy #1299/#1300 are reused, with the combined schedule/motion/manual-priority case covering #1458.
[The criterion map](../../docs/virtual-device-extensions-acceptance.md#composed-activity-and-automation-criteria)
identifies source, execution and limits. Closure of #1293/#1458 follows this reconciliation's own CI/review/merge;
optional security actuation remains UNSUPPORTED and the unrelated #1287 epic remains outside this milestone.

[PR #1473](https://github.com/FastyBird/smart-panel/pull/1473) remains a frozen draft reference. Its historical
200/61/261 result is not a current-main failure count. #1462 still owns the exact original-scenario reconciliation
before that draft is superseded. Installed qualification and #1447 remain open.

| ID                                                                   | Deliverable                                                                   | Depends on                                                           | Primary ownership                                                          |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| VD3-1 [#1448](https://github.com/FastyBird/smart-panel/issues/1448)  | Numeric profile policy, weighted mean and explicit outlier filtering          | Baseline                                                             | Aggregate configuration/runtime, incremental migration, shared eligibility |
| VD3-2 [#1449](https://github.com/FastyBird/smart-panel/issues/1449)  | Humidity/CO₂/illuminance and binary any/all aggregates                        | VD3-1 [#1448](https://github.com/FastyBird/smart-panel/issues/1448)  | Profile/evaluator/spec sources and qualified producer state                |
| VD3-3 [#1450](https://github.com/FastyBird/smart-panel/issues/1450)  | Aggregate authoring, diagnostics and panel presentation                       | VD3-2 [#1449](https://github.com/FastyBird/smart-panel/issues/1449)  | Admin sensor flows/locales and panel quality/values                        |
| VD3-4 [#1451](https://github.com/FastyBird/smart-panel/issues/1451)  | Group profile contracts and switch/outlet groups                              | Baseline                                                             | Capability/state/planner and compatible group API                          |
| VD3-5 [#1452](https://github.com/FastyBird/smart-panel/issues/1452)  | Fan and covering groups                                                       | VD3-4 [#1451](https://github.com/FastyBird/smart-panel/issues/1451)  | Profile rules and correlated feedback/commands                             |
| VD3-6 [#1453](https://github.com/FastyBird/smart-panel/issues/1453)  | Group authoring, panel, scenes and room controls                              | VD3-5 [#1452](https://github.com/FastyBird/smart-panel/issues/1452)  | Admin/group UI and panel/domain capability handling                        |
| VD3-7 [#1455](https://github.com/FastyBird/smart-panel/issues/1455)  | Thermostat presets, durable timed overrides and effective-setting arbitration | Baseline                                                             | Config/command/policy persistence and admin/panel                          |
| VD3-8 [#1458](https://github.com/FastyBird/smart-panel/issues/1458)  | Space schedule/presence climate-preset integration                            | VD3-7; reused issues below                                           | Climate intent bridge and cross-feature acceptance                         |
| VD3-9 [#1459](https://github.com/FastyBird/smart-panel/issues/1459)  | Derived dew-point sensor and cooling cutoff policies                          | VD3-2, VD3-10 for protection admission                               | Typed producer/graph and separate cooling guards/UI                        |
| VD3-10 [#1454](https://github.com/FastyBird/smart-panel/issues/1454) | Provider-neutral qualification and parallel actuator groups                   | Baseline                                                             | Claims/migration/transport/journal/runtime/recovery                        |
| VD3-11 [#1456](https://github.com/FastyBird/smart-panel/issues/1456) | Home Assistant virtual native-unit strategy                                   | VD3-10 [#1454](https://github.com/FastyBird/smart-panel/issues/1454) | HA integration, typed unit capabilities and outcomes                       |
| VD3-12 [#1457](https://github.com/FastyBird/smart-panel/issues/1457) | Zigbee2MQTT virtual native-unit strategy                                      | VD3-10 [#1454](https://github.com/FastyBird/smart-panel/issues/1454) | Zigbee integration, per-model capabilities and outcomes                    |
| VD3-13 [#1460](https://github.com/FastyBird/smart-panel/issues/1460) | Trusted SDK numeric-operator registration                                     | VD3-1 [#1448](https://github.com/FastyBird/smart-panel/issues/1448)  | SDK contracts, virtual host registrar and example fixture                  |
| VD3-14 [#1461](https://github.com/FastyBird/smart-panel/issues/1461) | Standard HomeKit mappings and virtual-state acceptance                        | VD3-2, VD3-5, VD3-7, VD3-11, VD3-12                                  | CO₂/fan mappings and current-authority/composite tests                     |
| VD3-15 [#1462](https://github.com/FastyBird/smart-panel/issues/1462) | Composed acceptance, documentation reconciliation and alpha publication       | VD3-1–VD3-14 and required reused issues                              | Upgrade/regression evidence, user docs and published alpha artifacts       |

### Reused work, not duplicate issues

- #1292 → #1293 → #1294: space activity definitions, domain-intent orchestration and activation/events.
- #1295/#1296: existing activity-mode admin/panel controls.
- #1297/#1298/#1362: schedules, admin editor and panel current/next/manual-override state.
- #1299/#1300: presence state machine and admin configuration.
- #1221 camera person input remains optional. Unrelated #1287 security work is not a milestone gate.

Retain those issues' full acceptance with the explicit climate-default amendment in the linked activity-mode task:
climate is disabled/unset until configured; inherited numeric examples never seed virtual thermostat settings.
Existing persisted operator configuration is preserved. Unavailable optional domain actions use their existing
skip/partial-failure contract; do not implement a second thermostat scheduler or infer presence from generic activity.

## Acceptance

- [ ] Existing virtual devices migrate without identity/history changes, claim release/reacquisition or changed defaults.
- [x] Weighted/filtering/numeric/binary profiles have shared preview/persistence/runtime policies and truthful quality.
- [x] Every new group profile is authorable and has feedback-based mixed/unknown/member outcomes across ordinary controls.
- [x] Presets and overrides persist, expire/recover correctly, preserve explicit OFF and never bypass protective admission.
- [x] Existing space schedules/presence drive explicitly configured climate actions, with tested DST/restart/dedup, UNKNOWN input and independent room/thermostat manual precedence.
- [x] Dew point preserves both input identities/age and cannot masquerade as ambient/floor temperature.
- [x] Cooling cutoff has exact trip/recovery/fault semantics and refuses unqualified protective activation.
- [x] Parallel actuator groups retain per-member ownership/journals and all-member release/opposed exclusion across restart.
- [x] HA and Zigbee `native_unit` strategies bind one canonical physical unit, preserve requested/observed distinctions,
      fence request revisions and diagnose upstream drift without claiming ownership of external writers.
- [x] SDK operators have version/owner lifecycle, validation, failure containment and a working test extension.
- [x] Standard HomeKit exports, API/spec generation, admin/panel flows, repair and diagnostics cover the delivered profiles.
- [ ] Named composed acceptance/upgrade tests pass; old documentation and closed-issue checklists reflect actual evidence.
- [ ] Every PR met exact-head CI/review gates; the next alpha is published with recorded version/tag/source/artifacts
      and release notes that identify remaining HW checks. A release draft alone does not complete this gate.

## Post-alpha installed acceptance

Tracking: [#1463](https://github.com/FastyBird/smart-panel/issues/1463). This issue follows the published alpha and stays separate from software delivery.

Perform final tests on real equipment only after the next alpha and a separately authorized concrete procedure.
Track calibration/limits, equipment protection, writer isolation, local release/watchdog, disconnect/restart/late commands,
supported native HA/Zigbee devices and real HomeKit pairing. The existing
[Shelly commissioning record](../../docs/work/virtual-thermostat/shelly-commissioning.md) stays unqualified until evidence
is recorded; software checkmarks do not establish installed safety or imply relay/script writes occurred.

## Historical preparation evidence

The [parallel branch backend record](../../docs/work/virtual-thermostat/parallel-branches-validation.md),
[member/client record](../../docs/work/virtual-thermostat/member-client-validation.md) and
[dew-point/cooling record](../../docs/work/virtual-thermostat/dew-point-cooling-validation.md) retain their exact
historical local checkpoints, failures and limits. Their former publication-pending statements describe preparation
at those checkpoints; current merged software status is the reconciliation above. They do not certify installed
Shelly, native HA/Zigbee or Apple Home behavior.
