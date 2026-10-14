# Epic: Virtual device aggregates, groups and thermostat

ID: EPIC-VIRTUAL-DEVICE-CAPABILITIES
Type: epic
Scope: backend, admin, panel, spec
Status: in progress
Tracking: [#1409](https://github.com/FastyBird/smart-panel/issues/1409)

## Objective

Extend the completed virtual wiring implementation with the user's minimum for fully capable virtual devices:

- A heating/cooling thermostat using physical or aggregated room temperatures, floor overheat protection, window
  contacts and automatic window detection.
- A persistent read-only aggregate temperature sensor made from several physical temperature sensors.
- A persistent light group controlling several physical lights, with truthful mixed state and partial command results.
- A separate numeric conversion sensor with typed operators, source freshness and explicit quantity/unit validation.

Design: [virtual-device capabilities](../../docs/superpowers/specs/2026-10-13-virtual-device-capabilities-design.md).
The prior wiring and follow-up epic #1336 and shared infrastructure #1402 are completed; this is new product scope.

Floor temperature is primarily a protective input: reaching its configured threshold must release heating even if the
room still requests heat. Display is supplementary. When this guard is configured, invalid/stale floor input cannot
permit heating. Recovery requires hysteresis and fresh valid inputs.

## Delivery tasks

Completed tasks below have been merged and their tracking issues closed. The remaining tasks retain their CI and
CodeRabbit review gates; a prepared feature branch does not count as delivered.

- [ ] VD2-1 [#1410](https://github.com/FastyBird/smart-panel/issues/1410): design decisions and actuator-platform qualification spike
- [x] VD2-1b [#1412](https://github.com/FastyBird/smart-panel/issues/1412): production Shelly timed-ON/add-on temperature and Shelly/Zigbee measurement provenance adapters
- [x] VD2-2a [#1411](https://github.com/FastyBird/smart-panel/issues/1411): core accepted-sample signal, derived invalidation/quality and regenerated client parsing
- [x] VD2-2b [#1413](https://github.com/FastyBird/smart-panel/issues/1413): durable bindings, graph revisions/serialization and restricted derived-source composition
- [x] VD2-3 [#1414](https://github.com/FastyBird/smart-panel/issues/1414): aggregate temperature sensor backend
- [x] VD2-4 [#1415](https://github.com/FastyBird/smart-panel/issues/1415): aggregate sensor authoring, repair and panel presentation
- [x] VD2-5 [#1416](https://github.com/FastyBird/smart-panel/issues/1416): group membership, capability contract, state and correlated command expansion
- [x] VD2-6 [#1417](https://github.com/FastyBird/smart-panel/issues/1417): light-group admin/panel and scene/room control
- [x] VD2-7 [#1418](https://github.com/FastyBird/smart-panel/issues/1418): thermostat configuration, actuator claims and local command path
- [x] VD2-8 [#1419](https://github.com/FastyBird/smart-panel/issues/1419): heat/cool/auto/off runtime, durable interlock and restart recovery
- [x] VD2-9 [#1420](https://github.com/FastyBird/smart-panel/issues/1420): floor overheat and physical/automatic window policies
- [ ] VD2-10 [#1421](https://github.com/FastyBird/smart-panel/issues/1421): thermostat authoring, floor/guard diagnostics, panel and climate intents
- [ ] VD2-11 [#1422](https://github.com/FastyBird/smart-panel/issues/1422): end-to-end acceptance, existing-feature regression and documentation
- [x] VD2-12 [#1425](https://github.com/FastyBird/smart-panel/issues/1425): separate numeric conversion sensor backend
- [x] VD2-13 [#1426](https://github.com/FastyBird/smart-panel/issues/1426): numeric converter authoring, preview, repair and panel presentation

## Acceptance

- [ ] A user can create, edit and repair every minimum device type through admin.
- [ ] An aggregate temperature sensor is an ordinary readable device with history and can feed a virtual thermostat.
- [x] A thermostat supports heating/cooling according to configured outputs, including automatic changeover without
      simultaneous opposed actuation.
- [x] When enabled for a heating branch, floor protection has a configured threshold, immediate heat release, valid-input
      requirement and recovery hysteresis.
- [x] Physical window contact support and automatic detection are minimum capabilities. Automatic detection pauses and
      recovers without a physical contact; configured contacts also pause and recover. Neither restores obsolete user
      commands.
- [x] A light group exposes compatible common controls, mixed/partial state and member-level outcomes.
- [ ] A user can author, preview, edit and repair a numeric converter; qualified temperature outputs can feed an
      aggregate or thermostat without hiding source faults or renewing old data.
- [ ] Shelly 1PM Gen2 analog helper output in Celsius is ingested with its unit and quality, without falling back to raw voltage.
- [ ] Missing/stale inputs, delayed commands, restart, deletion and remap have explicit tested behavior.
- [ ] Unsupported actuator combinations are refused consistently by preview and persistence.
- [ ] Existing wiring, physical device controls, hidden provenance and energy attribution retain their behavior.
- [ ] API/spec clients are generated from source, migrations are incremental, and no arbitrary scripting dependency is added.
- [ ] Every delivery PR has green current-head CI and a non-blocking main CodeRabbit review or operator authorization.

## Merged software evidence and remaining acceptance

Production features through PR #1443 are merged on `10e9c206d68f12966d5bb7d5a0777ed5f0f26a3c`.
The identical composed source tree at `f84be26b257ad225c0cd6816a428da2059e252da` passed all 15 hosted
checks and completed CodeRabbit review with Minimal risk and no blocking finding before merge.
[PR #1443 checks and review](https://github.com/FastyBird/smart-panel/pull/1443) record that baseline.
The protocol evidence PR #1424 and the remaining #1421 improvements retain their own exact-head CI/review gates.

The runtime and protective-policy tasks #1419 and #1420 are closed as tested software implementations.
That closure does not establish installed hardware qualification. #1421 remains open for explicit source freshness
presentation, room climate contribution coverage/conflicts and convergence acceptance. #1422 remains open until
its composed acceptance evidence and completion tracking are reconciled with those changes.

| Acceptance slice                     | Evidence on the merged baseline                                                                                                                                                                                                                  | Remaining work                                                                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin authoring and repair           | Aggregate/converter/group/thermostat authoring services, SQLite catalog and binding integration, wizard/store tests, preview revision conflicts                                                                                                  | Finish the cross-surface acceptance inventory; preserve output identity and repair behavior                                                                     |
| Measurement composition and quality  | Aggregate runtime tests cover unchanged reports, expiry, quorum, remap/history and transform age; SQLite thermostat runtime composes three ambient sources through heat, quorum loss and recovery                                                | Verify contribution coverage when raw and aggregate readings are selected in the same room                                                                      |
| Group commands and room contribution | Composite command integration includes prepared Shelly/Zigbee platforms, partial outcomes, deduplication and socket serialization; group authoring tests cover remap, hidden provenance and energy; panel/admin outcome tests cover presentation | Reconcile the exact cross-surface acceptance mapping                                                                                                            |
| Thermostat regulation and guards     | Durable SQLite runtime covers pre-dispatch persistence, crash/restart, delayed ON, refused OFF, opposed exclusion and reconnect; floor equality/staleness/strict recovery, contact debounce and heuristic hold/latest settings are tested        | Add explicit input freshness presentation and complete convergence evidence under #1421                                                                         |
| Lifecycle and existing features      | Hosted baseline CI covers backend/admin/panel/schema checks; focused source suites cover graph/migrations, ordinary commands, wiring/projection, hidden provenance, energy and teardown                                                          | Run current-head checks again for the completion follow-up                                                                                                      |
| Generated contracts and UI           | Baseline OpenAPI/spec generation, admin types/tests, panel analysis/tests and website build passed hosted CI                                                                                                                                     | Regenerate changed additive response contracts from backend sources and validate their consumers                                                                |
| Installed equipment                  | Read-only device/script observations and a staged installation/verification workflow are documented separately                                                                                                                                   | Calibration, writer isolation, local execution/restart bounds, endpoint authentication, independent protection and actual physical commissioning are unverified |

Software tests and protocol fixtures cannot establish actual electrical isolation, floor calibration or physical OFF. The [climate architecture](../../docs/climate-architecture.md), [user guide](../../apps/website/app/docs/admin-management/virtual-devices/page.mdx) and [pilot commissioning record](../../docs/work/virtual-thermostat/shelly-commissioning.md) describe the boundary.

## Initial qualification target

Shelly actuators, Zigbee room temperatures (existing Zigbee2MQTT adapter) and Shelly floor temperatures. No physical
window contact is currently available, so the first installation uses automatic detection. Physical-contact support is
part of the minimum; configuring contacts is optional per installation, and automatic detection may be disabled when
configured contacts provide the window policy. Qualify actual Shelly generation/model and installed equipment
protections before activation.
Read-only inspection of the supplied Shelly Plus 1PM Gen2 (firmware 1.7.5) found the floor input on `voltmeter:100`
with no native `xvoltage` expression or unit. Its running NTC script computes Celsius but only logs the result; the RPC
input currently exposes voltage. The prepared pilot therefore uses a separate voltage-to-temperature converter with
the script's explicit Steinhart–Hart coefficients. Native helper outputs in Celsius remain supported when configured.
No relay commands, script installation or hardware qualification have been performed on the supplied device.
Independent aggregates/groups can proceed while the controller platform spike is completed.

## Future extensions

Provide typed/versioned extension points for operators, group profiles and controller policies. Weighted means,
additional sensor quantities, binary groups, switch/fan/cover groups, presets, schedule integration, qualified
multi-actuator bindings and dew-point protection can follow. They do not replace any minimum above.
