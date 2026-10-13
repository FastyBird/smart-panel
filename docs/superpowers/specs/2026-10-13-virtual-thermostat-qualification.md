# VD2-1: Shelly thermostat protocol qualification

Status: executable protocol spike; production activation **NO-GO**
Tracking: [#1410](https://github.com/FastyBird/smart-panel/issues/1410)
Production adapter follow-up: [#1412](https://github.com/FastyBird/smart-panel/issues/1412)
Design: [virtual-device capabilities](https://github.com/FastyBird/smart-panel/blob/c0546f7814aec39943d26006e286996ec30d76e2/docs/superpowers/specs/2026-10-13-virtual-device-capabilities-design.md)

## Evidence boundary

The requested pilot has a Shelly actuator, Zigbee2MQTT ambient temperature, a Shelly floor probe and no physical
window contact. The user identifies the actuator as Shelly 1PM Gen2 and the floor probe as a thermistor on an analog
input. The device helper already returns Celsius; the application must consume that result, not convert the raw
voltage again in the thermostat. Exact model ID, firmware, add-on/peripheral and helper parameters remain unknown.
The candidate Plus1PM fixture uses `SNSW-001P16EU`; it is not an identification of the installed device.
Installed equipment protections remain unqualified. DS18B20 discovery/address fixtures are separate protocol evidence,
not a characterization of this installation's thermistor.
The floor probe protects heating: a configured threshold releases heat, invalid/stale floor evidence fails closed,
and recovery requires a fresh reading strictly below threshold minus recovery hysteresis. Display is supplemental.

The spike runs `shellies-ds9` pinned to `f891f2c7e672a2c946c56612b2783658e06a724c` in `pnpm-lock.yaml`,
its real device/component classes, actual `ShellyDeviceDelegate`, actual
`DelegatesManagerService`/`ShellyNgDevicePlatform`, actual adoption discovery and actual Zigbee2MQTT mapper.
Only transport, device catalog and persistence dependencies are fixtures. It does not mock the Shelly library.
Fixtures never create a socket or inspect credentials. HTTP fetch rejects if accidentally reached.
Nest testing modules, delegate listeners and provider resources are closed with awaited teardown.

The separate test-only application contract simulator under `test/support/virtual-thermostat-contract.ts`
demonstrates the expected eligibility, floor hysteresis and unresolved-command evidence rules. It is not registered
in Nest, has no production imports and does not implement durable database state, cancellation or device ordering.
A test of that simulator does not establish that today's production adapters satisfy those rules.

The production adapter checkpoint in #1432 now supplies qualified raw observations and guarded protective dispatch.
This spike checks the current contracts, including native Celsius adoption without raw-percent fallback, immediate
raw null admission and preserved Zigbee replay provenance. Legacy scalar/library behavior is characterized separately;
it must not be mistaken for accepted control evidence. Source/configuration identity and actual SDK send/retry fences
have dedicated production adapter tests. All timers and deadlines are fixtures, not installation safety parameters.
No live hardware commands or configuration writes occur in this spike.

## Run

From the repository root:

```bash
pnpm --filter @fastybird/smart-panel-backend test:virtual-thermostat-spike
```

The backend CI job runs this suite after the OAuth/Homey spikes. It is separate from normal unit/e2e discovery.
No extra dependency or environment credential is required. Isolated transpilation avoids a second whole-backend
TypeScript program; the backend type check and typed lint remain separate validation.

## Current production matrix

Protocol implementation and installed hardware qualification are separate gates. The adapter checkpoint is stacked
on #1427; its availability in a feature branch does not establish that it has been released or installed.

| Requirement                        | Current implementation/evidence                                                                                                 | Readiness                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Absolute NG ON/OFF                 | Real pinned Switch serializes absolute commands; ordinary wiring remains timer-free.                                            | Ordinary wiring supported.                                                 |
| Protective timed ON                | The separate protective path requires internal admission authority, guarded transport and an explicit finite qualified lease.   | Protocol implemented; installed profile unqualified.                       |
| Protective OFF                     | Absolute OFF carries no flip-back timer and fences locally queued protective ON.                                                | Acceptance is not output or pending-send drain proof.                      |
| Connect/authentication retries     | Per-request guard is checked at actual SDK send, including digest authentication retry.                                         | Fake protocol tests pass; no hardware ordering certification.              |
| Acceptance versus activity         | `was_on` is prior state. Neither accepted RPC nor timeout sets confirmed output or clears unresolved ON.                        | Durable controller runtime/reconciliation still required.                  |
| Equal notifications/polls          | Registered raw samples capture live observations before legacy equality suppression/coalescing.                                 | Qualified source path implemented.                                         |
| Null/errors                        | Raw null/errors reach sample admission immediately; registered properties bypass stale scalar coalescing.                       | Qualified source path implemented; history remains history.                |
| Dynamic floor helper/probe         | Native Celsius helpers and address-bound probes have explicit persisted source identity. Unbound legacy rows remain ineligible. | Protocol supported; installed thermistor/configuration unverified.         |
| Zigbee provenance/identity         | Retained/cached replay and unbound legacy sources cannot become live control evidence; IEEE/expose identity is durable.         | Deliberate compatible adoption and verified gateway cache policy required. |
| Backend disappearance              | Protective ON can carry a finite actuator timer; ordinary wiring does not promise this protection.                              | Exact model/firmware renewal/release evidence required.                    |
| Independent overheating protection | Software floor guard and a renewable timer do not establish independent equipment protection.                                   | Installed equipment evidence required.                                     |
| Opposed heating/cooling            | No installed hardware/equivalent interlock has been demonstrated.                                                               | Activation refused without qualification.                                  |

Production evidence is maintained in `qualified-adapters.spec.ts`, `guarded-shelly-rpc.spec.ts`,
`shelly-sample-sources.service.spec.ts`, `qualified-adoption.spec.ts` and the Zigbee source/bridge evidence suites.
The current spike remains **NO-GO for installed thermostat activation** until the controller runtime and separately
recorded hardware evidence are complete.

## Native helper evidence for the thermistor pilot

The real Input RPC client preserves helper expression and unit. Adoption now probes peripheral links, materializes a
separate readonly `TEMPERATURE` property for a verified Celsius helper, and binds its configuration fingerprint.
The analog display keeps helper units when a result is missing; it does not fall back to raw percent as Celsius.
Adoption values do not initialize accepted live control samples. The fixture expression `x/2` is synthetic protocol
metadata, not a thermistor calibration. Smart Panel does not evaluate or deploy it.

| Path                          | Current evidence                                                                                                                   | Remaining boundary                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Native adoption               | Valid helper/peripheral metadata creates `helper-temperature:input:100:<fingerprint>` and readonly `xpercent`.                     | Exact installed component/configuration still needs identification.                    |
| Runtime                       | Registered dynamic components report changed/equal/null/error observations before scalar conversion.                               | Bound source identity and current proof are required; discovery alone is insufficient. |
| Missing helper result         | Analog helper value stays absent with Celsius units; raw percent is not substituted.                                               | Configured floor input becomes unavailable and inhibits heating.                       |
| Identity/configuration change | Device/component, peripheral IO/address, expression, unit, range/inversion/calibration are fingerprinted and persisted separately. | Replacement needs deliberate compatible adoption/repair.                               |
| Legacy scalar path            | Pinned library retention and unbound analog scalar behavior remain characterization fixtures.                                      | Those scalars cannot grant floor authority.                                            |

The official [Input API](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Input/)
describes transformation of percent through `xpercent`; the separate
[Voltmeter API](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Voltmeter/)
describes transformation of voltage through `xvoltage`. Both need nonempty expression and unit; failed evaluation
can return null. VD2-1b must ingest the functional native helper with verified temperature semantics and sample
quality. Inspect the actual component/config/status before selecting either API. The user description of raw voltage
alone does not establish which component the firmware exports.

[Sensor Add-On documentation](https://shelly-api-docs.shelly.cloud/gen2/Addons/ShellySensorAddon/)
maps `analog_in` to Input and `voltmeter` to Voltmeter, with peripheral component IDs 100–199; Plus1PM is listed
as a supported add-on host. Its API example is not evidence of the installed thermistor's characteristics.
[Virtual-component documentation](https://shelly-api-docs.shelly.cloud/gen2/DynamicComponents/Virtual/)
limits that API to Gen3 and Gen2 Pro devices. Do not assume script-managed Number components are available on Gen2 Plus1PM.

## Legacy scalar paths and qualified boundaries

The initial candidate is a single-output local NG Switch profile, not every Shelly-branded device.
Plus1/Plus1PM device classes are useful fixture targets; the installed model may differ. Do not transfer add-on
compatibility to Mini/Pro/other generations by a grouped descriptor name. A floor probe may live on the same or a
separate host; both cases need explicit freshness and source-loss handling.

Source boundaries (legacy display behavior is distinct from qualified observation):

- [NG setter and readback handlers](../../../apps/backend/src/plugins/devices-shelly-ng/delegates/delegates-manager.service.ts):
  switch setter calls `comp.set(val)`; temperature handlers consume `tC`, coalesce ordinary writes and drop invalid
  numeric conversions, but the shared coercion treats null as 0. Registered raw observation now bypasses that conversion/coalescing for control eligibility.
- Pinned `shellies-ds9` `components/base.js` treats null as an object if prior characteristic is truthy; its
  `Object.assign` leaves a numeric tC unchanged and emits that stale value. The real-component fixture captures this
  additional qualification blocker; no library files are edited. In the fixture, tC=25 followed by null/read error
  persists another 25. Directly forwarding raw null bypasses that library bug but persists 0 through manager coercion.
  VD2-1b supplies a raw null/error invalidation path before both conversions; it never reports numeric 0 as the fault sample.
- [NG delegate](../../../apps/backend/src/plugins/devices-shelly-ng/delegates/shelly-device.delegate.ts):
  fixed descriptor iteration, unchanged notification forwarding, poll origin and notification revision fences.
- [NG descriptors](../../../apps/backend/src/plugins/devices-shelly-ng/devices-shelly-ng.constants.ts):
  Plus1/Plus1PM fixed switch/input sets do not include add-on temperature IDs.
- [NG adoption](../../../apps/backend/src/plugins/devices-shelly-ng/services/device-manager.service.ts):
  `getDeviceInfo` discovers component IDs through `Shelly.GetComponents`; temperature rows can therefore exist before
  equivalent ongoing observation exists.
- [NG RPC schemas/client](../../../apps/backend/src/plugins/devices-shelly-ng/services/shelly-rpc-client.service.ts):
  Switch configuration already describes startup/input/auto-on/auto-off and Temperature status describes null/errors.
  These are not persisted controller qualifications. RPC responses do not themselves prove contact closure/release.
- [v1 platform](../../../apps/backend/src/plugins/devices-shelly-v1/platforms/shelly-v1.device.platform.ts) and
  [library interface](../../../apps/backend/src/plugins/devices-shelly-v1/interfaces/shellies.interface.ts):
  `setRelay(index, value)` has no timer argument; pinned `shellies` sends plain `turn=on/off`.
- [v1 adapter](../../../apps/backend/src/plugins/devices-shelly-v1/services/shellies-adapter.service.ts):
  subscribes to change/online/offline; stale callback is empty. No equivalent unchanged-sample qualification exists.
- [v1 HTTP client](../../../apps/backend/src/plugins/devices-shelly-v1/services/shelly-v1-http-client.service.ts):
  bounded read-only settings/status is a possible future qualification seam; model-specific relay/external sensor
  schemas and floor mappings are not supplied by the current controller contract.
- [Zigbee mapper](../../../apps/backend/src/plugins/devices-zigbee2mqtt/services/device-mapper.service.ts),
  [packet boundary](../../../apps/backend/src/plugins/devices-zigbee2mqtt/services/base-client-adapter.ts) and
  [cached startup replay](../../../apps/backend/src/plugins/devices-zigbee2mqtt/services/zigbee2mqtt.service.ts):
  sample admission carries cached/retained provenance and requires a durable verified source identity for live control freshness.

## Application protocol contract for VD2-1b

1. Persist the canonical leaf command/claim revision before energizing. ON is absolute and carries a tested finite
   lease; OFF is absolute and never carries a flip-back timer. Disable/remap/release keeps unresolved evidence.
2. Preserve RPC acceptance, provider output observation and qualified drain/cancellation evidence separately.
   `Switch.Set.was_on` is previous state, never new-output confirmation. RPC timeout means unknown. A last-off
   observation, reconnect or reboot notification cannot clear an old pending ON.
   Correlation IDs/tags help diagnosis but do not establish cancellation or global command ordering.
3. Scope feedback to canonical device/component identity and connection/configuration generation. Newer notifications
   fence earlier poll responses. Changed and equal valid measurements count as observations without adding fake history.
4. Carry live/cached/retained origin and trustworthy sample time. Replaying a cached value never renews its age.
   Temperature missing from a partial packet never inherits a fresh age from another field. After restart, await
   fresh evidence; identical live values are valid evidence only through a qualified source-reporting contract.
5. Invalidate configured floor control eligibility immediately on null/read error/range error/source loss. Preserve
   last-good history as history. Expiry is checked again when the controller consumes a sample. At threshold demand
   OFF immediately, regardless of ambient demand or cycle protection; recover strictly below the hysteresis bound.
6. Bind a real floor peripheral and functional helper identity (component, IO, expression, quantity/unit and revision).
   Replacing its address, role, unit, calibration or reporting configuration
   suspends qualification until explicitly reviewed; never substitute relay internal temperature. Do not round a raw
   protective input in a way that changes the trip comparison without an explicit tested precision policy.
7. Verify safe startup/no automatic ON and competing input/schedule/script/cloud writers. A renewable release lease
   addresses loss of backend control, not a still-reporting falsely-low sensor. Independent equipment protection remains
   necessary. Opposed heating/cooling needs a separately evidenced interlock; this spike does not qualify it.

## Hardware evidence required before activation

Record each item with model/firmware, date, operator and reproducible observations. Absence remains a readiness reason.

- [ ] Actuator generation/model/firmware, component ID, polarity, ratings, switched equipment and wiring role.
- [ ] Floor host generation/model/firmware/add-on, thermistor type/wiring/peripheral IO, helper component/config/status,
      expression/unit/range/inversion and calibration; DS18B20 is separate evidence, not the pilot. Explicitly
      distinguish floor measurement from device/module temperature.
- [ ] Installed floor/heating maximum and recovery threshold supplied for that system, not invented by the application.
- [ ] Ambient Zigbee model, reporting configuration/cadence, retained/cache behavior and acceptable freshness window.
- [ ] Confirm actual ON response versus output notification/status, including repeated commands and failure paths.
- [ ] Confirm finite ON timer while already ON, renewal, OFF cancellation, backend/network disappearance and relay reboot.
- [ ] Confirm failed/timed-out/late commands and reconnect/restart release ordering or cancellation evidence.
- [ ] Remove/fault the probe under safe bench conditions; confirm local/application release and stale-input response.
- [ ] Record power-on OFF, auto-on disabled and upstream writer policy: input, schedules, scripts, cloud and other clients.
- [ ] Independent thermal/high-limit or non-renewable maximum-on protection; distinguish it from software floor guard,
      internal Shelly overtemperature and a renewable timer.
- [ ] For two opposed outputs, demonstrate installed hardware/equivalent interlocking including external-writer cases.

Hardware testing is a separate authorized task. Passing these fixtures does not certify load safety, probe placement,
relay contacts, physical shutdown, firmware timing or the installed heating system. The first deployable profile must
keep activation unavailable until VD2-1b and the recorded hardware evidence are complete.

## Protocol references

- [NG Switch](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Switch/): absolute control, flip-back timer,
  current output and configuration. Timed OFF flips the opposite way and is inappropriate for protective release.
- [NG RPC](https://shelly-api-docs.shelly.cloud/gen2/General/RPCProtocol/): response correlation; it does not establish
  cancellation of timed-out requests.
- [NG Temperature](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Temperature/): null/errors and reporting.
- [Sensor Add-On](https://shelly-api-docs.shelly.cloud/gen2/Addons/ShellySensorAddon/): dynamic IDs and peripheral addresses.
- [Gen1 API](https://shelly-api-docs.shelly.cloud/gen1/#shelly1-1pm-settings-ext_temperature-index): model-specific
  timers/external temperature actions. Their availability alone is not proof of a continuously enforced high-limit.
