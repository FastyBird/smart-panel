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

Rows track independently verifiable acceptance, not one PR per issue. The user prefers fewer, larger cohesive PRs
because CodeRabbit provides one review per hour. Assemble related issue work and its tests/documentation into a shared
delivery PR after local implementation and independent review. The first combined delivery, [PR #1464](https://github.com/FastyBird/smart-panel/pull/1464), merged the
plan plus VD3-1 and VD3-4 after composed checks and current-head review passed. Keep subsequent PRs draft until their
complete implementations and composed checks are ready. Split later work only
where dependency, compatibility or the actual reviewer file limit requires a separate batch.

Checkboxes mean merged, tested software, not candidate code or installed qualification. A child closes only after its
entire acceptance is satisfied, even when its PR also closes other issues.

### Merged progress

- [x] VD3-1 / #1448: shared numeric eligibility, weighted mean and explicit outlier filtering.
- [x] VD3-4 / #1451: typed group contracts and backend switch/outlet profiles.
- [x] VD3-2 / #1449: humidity/CO₂/illuminance and binary any/all aggregates.
- [x] VD3-3 / #1450: aggregate authoring, diagnostics and Panel presentation.

VD3-1 and VD3-4 merged in #1464 at `ad5cf678d47eeae4f575c652e03e3c6f5f1998ba`. All CI checks passed on the reviewed
head `0e6fe2d0f22988158867b74bc74711b76647c719`, and CodeRabbit's completed main summary reported no merge blockers.
Admin/panel support for the new group profiles remains VD3-6; these checkmarks do not claim that UI work is delivered.

VD3-2 and VD3-3 merged in [PR #1465](https://github.com/FastyBird/smart-panel/pull/1465) at
`4f4dd1f346fa5e9508c729f5b0d11a23a416f465`. Thermostat comfort and mandatory branches are combined locally
on that base for composed validation and parent review; neither #1454 nor #1455 is marked delivered here.

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
- [ ] Weighted/filtering/numeric/binary profiles have shared preview/persistence/runtime policies and truthful quality.
- [ ] Every new group profile is authorable and has feedback-based mixed/unknown/member outcomes across ordinary controls.
- [ ] Presets and overrides persist, expire/recover correctly, preserve explicit OFF and never bypass protective admission.
- [ ] Existing space schedules/presence drive configured climate actions, with defined DST/restart/manual precedence.
- [ ] Dew point preserves both input identities/age and cannot masquerade as ambient/floor temperature.
- [ ] Cooling cutoff has exact trip/recovery/fault semantics and refuses unqualified protective activation.
- [ ] Parallel actuator groups retain per-member ownership/journals and all-member release/opposed exclusion across restart.
- [ ] HA and Zigbee `native_unit` strategies bind one canonical physical unit, preserve requested/observed distinctions,
      fence request revisions and diagnose upstream drift without claiming ownership of external writers.
- [ ] SDK operators have version/owner lifecycle, validation, failure containment and a working test extension.
- [ ] Standard HomeKit exports, API/spec generation, admin/panel flows, repair and diagnostics cover the delivered profiles.
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

## VD3-10 local backend delivery

The provider-neutral mandatory-branch backend foundation is integrated locally on the merged PR #1465 base; see the
[implementation and validation record](../../docs/work/virtual-thermostat/parallel-branches-validation.md).
Migration 40 retains singleton claim/journal identities and unresolved ownership. The composed foundation/comfort
head `5cabef74eb9f914d6970e3cfd526df5a8c4f4608` passed independent local review, without publication.
Per-member floor protection (migration 41) is being integrated with Admin member arrays, read-only source/setup
context, diagnostics and fenced staging/recovery; see the [client integration record](../../docs/work/virtual-thermostat/member-client-validation.md).
Its backend safety follow-up and fresh composed review remain open. Panel ordinary intents and all-member diagnostics
are a separate coordinated local worker stage. Multi-Shelly groups require explicitly bound local guards, separately
reviewed/staged member installations and actual qualification; no installed eligibility is supplied by these local changes.
The milestone checkboxes above remain open until composed acceptance; no native-unit adapter or installed equipment
qualification is claimed by this backend slice.

VD3-7 local implementation includes backend comfort configuration/API, arbitration, durable override recovery and
dispatch fencing, plus Admin authoring and Panel selection/override diagnostics with all six locales and UI tests.
Independent backend and composed UI review remain open; VD3-7 is not complete. Automation defaults disabled and the
internal trusted baseline port is reserved for the separate VD3-8 bridge. Bounded restart recovery preserves the
absolute expiry; observable clock uncertainty inhibits output until an explicit operator action. No hardware
qualification or physical actuation is part of this local implementation stage.
