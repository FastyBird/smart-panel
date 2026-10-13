# Epic: Virtual device aggregates, groups and thermostat

ID: EPIC-VIRTUAL-DEVICE-CAPABILITIES
Type: epic
Scope: backend, admin, panel, spec
Status: planning
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

Tasks are not implemented merely because the design exists. Create implementation issues from the reviewed contracts,
and record the corresponding issue references here.

- [ ] VD2-1 [#1410](https://github.com/FastyBird/smart-panel/issues/1410): design decisions and actuator-platform qualification spike
- [ ] VD2-1b [#1412](https://github.com/FastyBird/smart-panel/issues/1412): production Shelly timed-ON/add-on temperature and Shelly/Zigbee measurement provenance adapters
- [ ] VD2-2a [#1411](https://github.com/FastyBird/smart-panel/issues/1411): core accepted-sample signal, derived invalidation/quality and regenerated client parsing
- [ ] VD2-2b [#1413](https://github.com/FastyBird/smart-panel/issues/1413): durable bindings, graph revisions/serialization and restricted derived-source composition
- [ ] VD2-3 [#1414](https://github.com/FastyBird/smart-panel/issues/1414): aggregate temperature sensor backend
- [ ] VD2-4 [#1415](https://github.com/FastyBird/smart-panel/issues/1415): aggregate sensor authoring, repair and panel presentation
- [ ] VD2-5 [#1416](https://github.com/FastyBird/smart-panel/issues/1416): group membership, capability contract, state and correlated command expansion
- [ ] VD2-6 [#1417](https://github.com/FastyBird/smart-panel/issues/1417): light-group admin/panel and scene/room control
- [ ] VD2-7 [#1418](https://github.com/FastyBird/smart-panel/issues/1418): thermostat configuration, actuator claims and local command path
- [ ] VD2-8 [#1419](https://github.com/FastyBird/smart-panel/issues/1419): heat/cool/auto/off runtime, durable interlock and restart recovery
- [ ] VD2-9 [#1420](https://github.com/FastyBird/smart-panel/issues/1420): floor overheat and physical/automatic window policies
- [ ] VD2-10 [#1421](https://github.com/FastyBird/smart-panel/issues/1421): thermostat authoring, floor/guard diagnostics, panel and climate intents
- [ ] VD2-11 [#1422](https://github.com/FastyBird/smart-panel/issues/1422): end-to-end acceptance, existing-feature regression and documentation
- [ ] VD2-12 [#1425](https://github.com/FastyBird/smart-panel/issues/1425): separate numeric conversion sensor backend
- [ ] VD2-13 [#1426](https://github.com/FastyBird/smart-panel/issues/1426): numeric converter authoring, preview, repair and panel presentation

## Acceptance

- [ ] A user can create, edit and repair every minimum device type through admin.
- [ ] An aggregate temperature sensor is an ordinary readable device with history and can feed a virtual thermostat.
- [ ] A thermostat supports heating/cooling according to configured outputs, including automatic changeover without
      simultaneous opposed actuation.
- [ ] When enabled for a heating branch, floor protection has a configured threshold, immediate heat release, valid-input
      requirement and recovery hysteresis.
- [ ] Physical window contact support and automatic detection are minimum capabilities. Automatic detection pauses and
      recovers without a physical contact; configured contacts also pause and recover. Neither restores obsolete user
      commands.
- [ ] A light group exposes compatible common controls, mixed/partial state and member-level outcomes.
- [ ] A user can author, preview, edit and repair a numeric converter; qualified temperature outputs can feed an
      aggregate or thermostat without hiding source faults or renewing old data.
- [ ] Shelly 1PM Gen2 analog helper output in Celsius is ingested with its unit and quality, without falling back to raw voltage.
- [ ] Missing/stale inputs, delayed commands, restart, deletion and remap have explicit tested behavior.
- [ ] Unsupported actuator combinations are refused consistently by preview and persistence.
- [ ] Existing wiring, physical device controls, hidden provenance and energy attribution retain their behavior.
- [ ] API/spec clients are generated from source, migrations are incremental, and no arbitrary scripting dependency is added.
- [ ] Every delivery PR has green current-head CI and a non-blocking main CodeRabbit review or operator authorization.

## Initial qualification target

Shelly actuators, Zigbee room temperatures (existing Zigbee2MQTT adapter) and Shelly floor temperatures. No physical
window contact is currently available, so the first installation uses automatic detection. Physical-contact support is
part of the minimum; configuring contacts is optional per installation, and automatic detection may be disabled when
configured contacts provide the window policy. Qualify actual Shelly generation/model and installed equipment
protections before activation.
The user identified Shelly 1PM Gen2 and a thermistor on its analog input. Shelly's helper already returns Celsius;
the integration must adopt that helper value. A generic conversion sensor remains a separate device feature.
Independent aggregates/groups can proceed while the controller platform spike is completed.

## Future extensions

Provide typed/versioned extension points for operators, group profiles and controller policies. Weighted means,
additional sensor quantities, binary groups, switch/fan/cover groups, presets, schedule integration, qualified
multi-actuator bindings and dew-point protection can follow. They do not replace any minimum above.
