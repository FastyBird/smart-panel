# VD2-1: Shelly thermostat protocol qualification

Status: executable protocol spike; production activation **NO-GO**
Tracking: [#1410](https://github.com/FastyBird/smart-panel/issues/1410)
Production adapter follow-up: [#1412](https://github.com/FastyBird/smart-panel/issues/1412)
Design: [virtual-device capabilities](https://github.com/FastyBird/smart-panel/blob/d33d3049e/docs/superpowers/specs/2026-10-13-virtual-device-capabilities-design.md)

## Evidence boundary

The requested pilot has a Shelly actuator, Zigbee2MQTT ambient temperature, a Shelly floor probe and no physical
window contact. Neither exact Shelly model/firmware nor installed equipment protections have been supplied.
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

The tests deliberately assert current unsupported behavior under `NO-GO` names. They are characterization evidence,
not tests that permanently require the bug. VD2-1b must replace the corresponding assertions with the intended
production acceptance as each capability is implemented. All timers and deadlines are fixtures, not thermal safety
parameters for an installation. No live hardware commands or configuration writes occur in this spike.

## Run

From the repository root:

```bash
pnpm --filter @fastybird/smart-panel-backend test:virtual-thermostat-spike
```

The backend CI job runs this suite after the OAuth/Homey spikes. It is separate from normal unit/e2e discovery.
No extra dependency or environment credential is required. Isolated transpilation avoids a second whole-backend
TypeScript program; the backend type check and typed lint remain separate validation.

## Current production matrix

| Requirement                         | Existing evidence                                                                                                                                                                                                                                              | Readiness                                                                           |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Absolute NG on/off                  | Actual pinned Switch sends `Switch.Set` with `on`; actual plugin setter reaches it.                                                                                                                                                                            | Available as ordinary wiring; not controller-qualified.                             |
| Timed NG ON                         | Actual library accepts `set(true, seconds)`; fake RPC captures the timer. Actual plugin setter uses `comp.set(val)` without timer.                                                                                                                             | **NO-GO** until VD2-1b provides a qualified command path.                           |
| Protective NG OFF                   | Actual library `set(false)` emits no flip-back timer.                                                                                                                                                                                                          | Required contract; controller path must never add `toggle_after` to OFF.            |
| Acceptance versus activity          | Switch.Set returns was_on (previous state), not the new output. Accepted RPC does not mutate output; delegate changes it on provider notification.                                                                                                             | Reusable seam; boolean dispatch result is not physical confirmation.                |
| Failed/late requests                | Rejected ON does not prevent later ON feedback after accepted OFF in the fixture.                                                                                                                                                                              | **NO-GO** without durable unresolved-command state and qualified release proof.     |
| Reboot/restart                      | A simulated `source:init`, output=false observation is not proof an earlier ON cannot land. Simulator preserves unresolved evidence through snapshot restoration.                                                                                              | Hardware reboot/ordering remains unqualified; simulator is not persistence.         |
| Changed/equal NG notifications      | Actual delegate forwards equal notifications as well as changed values.                                                                                                                                                                                        | Available for registered components; sample eligibility still needs core/adapters.  |
| Stale NG polls                      | Actual delegate rejects an older poll component after an intervening unchanged notification.                                                                                                                                                                   | Available and regression-tested.                                                    |
| Equal NG polls                      | Actual library equality suppression causes current `pollStatus` to emit no value for an equal response.                                                                                                                                                        | **NO-GO** for polling-only freshness until VD2-1b carries explicit sample evidence. |
| Add-on floor discovery              | Actual adoption discovery includes a fake `temperature:100` component.                                                                                                                                                                                         | Discovery alone is available.                                                       |
| Add-on floor runtime                | Plus1 fixed descriptor/library components have no `temperature:100`; actual runtime ignores changed/equal/null/error add-on reports.                                                                                                                           | **NO-GO** until dynamic observation is implemented and tested.                      |
| Known temperature null/error        | Pinned Component.update keeps a prior nonzero tC when raw tC becomes null and emits that old value; delegate suppresses the raw null. A direct raw null reaches the delegate but manager coerces it to 0. PlusHT is a generic-path fixture, not a floor probe. | **NO-GO** until immediate invalidation/quality propagation.                         |
| Floor probe identity                | Sensor Add-On protocol can identify the DS18B20 address behind a component ID. Contract simulator refuses another identity.                                                                                                                                    | **NO-GO**: current adapter does not qualify/preserve that mapping for control.      |
| Zigbee equal/live values            | Actual mapper updates equal temperatures twice; absent temperature fields do not update the scalar.                                                                                                                                                            | Reusable scalar ingestion; not yet a control sample contract.                       |
| Zigbee retained/cached replay       | Actual mapper treats retained, cached and live scalar updates identically and omits origin/sample time.                                                                                                                                                        | **NO-GO** until provenance reaches VD2-2a's accepted-sample boundary.               |
| Device-side release on backend loss | NG protocol has timers; existing plugin does not arm one.                                                                                                                                                                                                      | **NO-GO** until exact-model renewal/release tests and adapter delivery.             |
| Independent overheating protection  | Not represented by ordinary relay output or internal module temperature.                                                                                                                                                                                       | Installed equipment evidence required.                                              |
| Simultaneous heat/cool prevention   | Ordinary Switch outputs are independently commandable; no qualified interlock is established.                                                                                                                                                                  | **NO-GO** for opposed outputs without hardware/equivalent qualification.            |

## NG and v1 seams

The initial candidate is a single-output local NG Switch profile, not every Shelly-branded device.
Plus1/Plus1PM device classes are useful fixture targets; the installed model may differ. Do not transfer add-on
compatibility to Mini/Pro/other generations by a grouped descriptor name. A floor probe may live on the same or a
separate host; both cases need explicit freshness and source-loss handling.

Existing source paths:

- [NG setter and readback handlers](../../../apps/backend/src/plugins/devices-shelly-ng/delegates/delegates-manager.service.ts):
  switch setter calls `comp.set(val)`; temperature handlers consume `tC`, coalesce ordinary writes and drop invalid
  numeric conversions, but the shared coercion treats null as 0. A protective invalidation/threshold release must not wait behind ordinary telemetry coalescing.
- Pinned `shellies-ds9` `components/base.js` treats null as an object if prior characteristic is truthy; its
  `Object.assign` leaves a numeric tC unchanged and emits that stale value. The real-component fixture captures this
  additional qualification blocker; no library files are edited. In the fixture, tC=25 followed by null/read error
  persists another 25. Directly forwarding raw null bypasses that library bug but persists 0 through manager coercion.
  VD2-1b needs an explicit raw null/error invalidation path before both conversions, not a numeric sample of 0.
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
  cached/retained flags currently govern input occurrence suppression, not scalar control freshness.

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
6. Bind a real floor peripheral identity. Replacing its address, role, unit, calibration or reporting configuration
   suspends qualification until explicitly reviewed; never substitute relay internal temperature. Do not round a raw
   protective input in a way that changes the trip comparison without an explicit tested precision policy.
7. Verify safe startup/no automatic ON and competing input/schedule/script/cloud writers. A renewable release lease
   addresses loss of backend control, not a still-reporting falsely-low sensor. Independent equipment protection remains
   necessary. Opposed heating/cooling needs a separately evidenced interlock; this spike does not qualify it.

## Hardware evidence required before activation

Record each item with model/firmware, date, operator and reproducible observations. Absence remains a readiness reason.

- [ ] Actuator generation/model/firmware, component ID, polarity, ratings, switched equipment and wiring role.
- [ ] Floor host generation/model/add-on, DS18B20 or actual probe type/address, placement and calibration; explicitly
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
