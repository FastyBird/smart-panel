# VD2-1: Shelly thermostat protocol qualification

Status: executable protocol spike; production activation **NO-GO**
Tracking: [#1410](https://github.com/FastyBird/smart-panel/issues/1410)
Merged production adapter tracking: [#1412](https://github.com/FastyBird/smart-panel/issues/1412)
Design: [virtual-device capabilities](2026-10-13-virtual-device-capabilities-design.md)

## Evidence boundary

The requested pilot has a Shelly actuator, Zigbee2MQTT ambient temperature, a Shelly floor probe and no physical
window contact. The recorded read-only inspection identified Plus1PM `SNSW-001P16EU`, firmware
`20260311-095847/1.7.5-g9979d16`, at `192.168.2.229`. Its floor source was `voltmeter:100`, reporting 6.68 V
with null native `xvoltage` expression/unit. Existing Script 1 `NTC Conversion` computes and logs Celsius but exports
no Celsius property. These are historical observations, not a fresh measurement or installed qualification.
The supported pilot route uses qualified raw voltage and a separate explicitly calibrated Steinhart–Hart converter;
the thermostat consumes the resulting temperature. Native Celsius helpers remain an alternative when configured
and verified. The [commissioning record](../../work/virtual-thermostat/shelly-commissioning.md) and
[reconciliation audit](../../work/virtual-thermostat/shelly-reconciliation.md) retain the observed script behavior and
remaining installation requirements. Preserve Script 1; its existing cutoff does not establish independent protection.
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

The merged production adapters supply qualified raw observations and guarded protective dispatch.
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

Protocol implementation and installed hardware qualification are separate gates. Production adapters, the durable
controller runtime, ordered release reconciliation and persisted installation profiles are merged. Their software
and offline test evidence does not establish deployment or qualification on the supplied pilot. The
[installation workflow](../../work/virtual-thermostat/shelly-commissioning.md) stages a reviewable artifact and requires
explicit privileged verification, fresh machine metadata and runtime OFF/drain reconciliation before ON admission.
Device writes and bench testing require separate approval of the concrete artifact and procedure.

| Requirement                        | Current implementation/evidence                                                                                                 | Readiness                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Absolute NG ON/OFF                 | Real pinned Switch serializes absolute commands; ordinary wiring remains timer-free.                                            | Ordinary wiring supported.                                                                     |
| Protective timed ON                | The separate protective path requires internal admission authority, guarded transport and an explicit finite qualified lease.   | Protocol implemented; installed profile unqualified.                                           |
| Protective OFF                     | Absolute OFF carries no flip-back timer and fences locally queued protective ON.                                                | Acceptance is not output or pending-send drain proof.                                          |
| Connect/authentication retries     | Per-request guard is checked at actual SDK send, including digest authentication retry.                                         | Fake protocol tests pass; no hardware ordering certification.                                  |
| Acceptance versus activity         | `was_on` is prior state. Neither accepted RPC nor timeout sets confirmed output or clears unresolved ON.                        | Durable runtime and scoped release reconciliation implemented; installation evidence required. |
| Equal notifications/polls          | Registered raw samples capture live observations before legacy equality suppression/coalescing.                                 | Qualified source path implemented.                                                             |
| Null/errors                        | Raw null/errors reach sample admission immediately; registered properties bypass stale scalar coalescing.                       | Qualified source path implemented; history remains history.                                    |
| Dynamic floor helper/probe         | Native Celsius helpers, raw voltmeters and address-bound probes have persisted source identity; unbound rows remain ineligible. | Protocol supported; installed thermistor/configuration unverified.                             |
| Zigbee provenance/identity         | Retained/cached replay and unbound legacy sources cannot become live control evidence; IEEE/expose identity is durable.         | Deliberate compatible adoption and verified gateway cache policy required.                     |
| Backend disappearance              | Protective ON can carry a finite actuator timer; ordinary wiring does not promise this protection.                              | Exact model/firmware renewal/release evidence required.                                        |
| Independent overheating protection | Software floor guard and a renewable timer do not establish independent equipment protection.                                   | Installed equipment evidence required.                                                         |
| Opposed heating/cooling            | No installed hardware/equivalent interlock has been demonstrated.                                                               | Activation refused without qualification.                                                      |

Production evidence includes [qualified adapter tests](../../../apps/backend/src/plugins/devices-shelly-ng/delegates/qualified-adapters.spec.ts),
[SDK send guards](../../../apps/backend/src/plugins/devices-shelly-ng/services/guarded-shelly-rpc.spec.ts),
[guarded HTTP](../../../apps/backend/src/plugins/devices-shelly-ng/services/guarded-shelly-http.spec.ts),
[scoped guard sessions](../../../apps/backend/src/plugins/devices-shelly-ng/services/shelly-guard-rpc-session.spec.ts),
[source identity/leases](../../../apps/backend/src/plugins/devices-shelly-ng/services/shelly-sample-sources.service.spec.ts),
[qualified adoption](../../../apps/backend/src/plugins/devices-shelly-ng/services/qualified-adoption.spec.ts),
[controller runtime](../../../apps/backend/src/plugins/devices-virtual/services/virtual-thermostat-runtime.service.spec.ts),
[installation integration](../../../apps/backend/src/plugins/devices-virtual/services/thermostat-installation.integration.spec.ts)
and the Zigbee source/bridge suites. This spike remains **NO-GO for installed thermostat activation**: the supplied
pilot has no installed qualified guard/profile or recorded physical commissioning evidence.

## Synthetic native helper alternative

These Input helper fixtures characterize an alternative supported source, not the observed pilot's raw voltmeter.
The real Input RPC client preserves helper expression and unit. Adoption now probes peripheral links, materializes a
separate readonly `TEMPERATURE` property for a verified Celsius helper, and binds its configuration fingerprint.
The analog display keeps helper units when a result is missing; it does not fall back to raw percent as Celsius.
Adoption values do not initialize accepted live control samples. The fixture expression `x/2` is synthetic protocol
metadata, not a thermistor calibration. Smart Panel does not evaluate or deploy it.

| Path                          | Current evidence                                                                                                                   | Remaining boundary                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Native adoption               | Valid helper/peripheral metadata creates `helper-temperature:input:100:<fingerprint>` and readonly `xpercent`.                     | Synthetic Input fixture; observed pilot instead requires reviewed raw-voltage conversion. |
| Runtime                       | Registered dynamic components report changed/equal/null/error observations before scalar conversion.                               | Bound source identity and current proof are required; discovery alone is insufficient.    |
| Missing helper result         | Analog helper value stays absent with Celsius units; raw percent is not substituted.                                               | Configured floor input becomes unavailable and inhibits heating.                          |
| Identity/configuration change | Device/component, peripheral IO/address, expression, unit, range/inversion/calibration are fingerprinted and persisted separately. | Replacement needs deliberate compatible adoption/repair.                                  |
| Legacy scalar path            | Pinned library retention and unbound analog scalar behavior remain characterization fixtures.                                      | Those scalars cannot grant floor authority.                                               |

The official [Input API](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Input/)
describes transformation of percent through `xpercent`; the separate
[Voltmeter API](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Voltmeter/)
describes transformation of voltage through `xvoltage`. Both need nonempty expression and unit; failed evaluation
can return null. A native helper needs verified temperature semantics, source identity and sample quality.
The observed pilot instead exposes raw voltage: production adoption supports it with preserved voltage unit/quality,
and the separate Steinhart–Hart converter requires explicit coefficients, topology and calibrated domains. The
installation guard profile must match that reviewed conversion; neither helper expressions nor raw voltage are
silently interpreted as Celsius.

[Sensor Add-On documentation](https://shelly-api-docs.shelly.cloud/gen2/Addons/ShellySensorAddon/)
maps `analog_in` to Input and `voltmeter` to Voltmeter, with peripheral component IDs 100–199; Plus1PM is listed
as a supported add-on host. Its API example is not evidence of the installed thermistor's characteristics.
[Virtual-component documentation](https://shelly-api-docs.shelly.cloud/gen2/DynamicComponents/Virtual/)
limits that API to Gen3 and Gen2 Pro devices. Do not assume script-managed Number components are available on Gen2 Plus1PM.

## Legacy scalar paths and qualified boundaries

The initial candidate is a single-output local NG Switch profile, not every Shelly-branded device.
Plus1/Plus1PM device classes are useful fixture targets; the observed pilot is Plus1PM. Do not transfer add-on
compatibility to Mini/Pro/other generations by a grouped descriptor name. A floor probe may live on the same or a
separate host; both cases need explicit freshness and source-loss handling.

Source boundaries (legacy display behavior is distinct from qualified observation):

- [NG setter and readback handlers](../../../apps/backend/src/plugins/devices-shelly-ng/delegates/delegates-manager.service.ts):
  switch setter calls `comp.set(val)`; temperature handlers consume `tC`, coalesce ordinary writes and drop invalid
  numeric conversions, but the shared coercion treats null as 0. Registered raw observation now bypasses that conversion/coalescing for control eligibility.
- Pinned `shellies-ds9` `components/base.js` treats null as an object if prior characteristic is truthy; its
  `Object.assign` leaves a numeric tC unchanged and emits that stale value. The real-component fixture captures this
  legacy behavior; no library files are edited. In the fixture, tC=25 followed by null/read error emits another 25
  on the legacy value path. The qualified path makes no scalar write and immediately reports the actual null sample
  before library retention/coalescing. Separate unbound analog fixtures characterize stale scalar writes and null-to-0
  coercion; neither grants control eligibility. The qualified path never reports numeric 0 as the fault sample.
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

## Application protocol contract

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
6. Bind the real floor peripheral and source identity (component, IO, quantity/unit and revision), plus either a
   functional native helper expression or an explicit reviewed raw-voltage conversion profile.
   Replacing its address, role, unit, calibration or reporting configuration
   suspends qualification until explicitly reviewed; never substitute relay internal temperature. Do not round a raw
   protective input in a way that changes the trip comparison without an explicit tested precision policy.
7. Verify safe startup/no automatic ON and competing input/schedule/script/cloud writers. A renewable release lease
   addresses loss of backend control, not a still-reporting falsely-low sensor. Independent equipment protection remains
   necessary. Opposed heating/cooling needs a separately evidenced interlock; this spike does not qualify it.

## Hardware evidence required before activation

Record each item with model/firmware, date, operator and reproducible observations. Absence remains a readiness reason.

- [ ] Actuator generation/model/firmware, component ID, polarity, ratings, switched equipment and wiring role.
- [ ] Floor host generation/model/firmware/add-on, thermistor type/wiring/peripheral IO, component/config/status,
      unit/range/inversion and calibration; native helper expression or reviewed raw-voltage Steinhart–Hart profile
      as applicable. DS18B20 is separate evidence, not the pilot. Explicitly
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
relay contacts, physical shutdown, firmware timing or the installed heating system. The merged installation workflow
keeps activation unavailable without complete operator evidence, successful explicit verification and fresh runtime
reconciliation. No checklist item above is established by passing this spike or by identifying the device.

## Protocol references

- [NG Switch](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Switch/): absolute control, flip-back timer,
  current output and configuration. Timed OFF flips the opposite way and is inappropriate for protective release.
- [NG RPC](https://shelly-api-docs.shelly.cloud/gen2/General/RPCProtocol/): response correlation; it does not establish
  cancellation of timed-out requests.
- [NG Temperature](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Temperature/): null/errors and reporting.
- [Sensor Add-On](https://shelly-api-docs.shelly.cloud/gen2/Addons/ShellySensorAddon/): dynamic IDs and peripheral addresses.
- [Gen1 API](https://shelly-api-docs.shelly.cloud/gen1/#shelly1-1pm-settings-ext_temperature-index): model-specific
  timers/external temperature actions. Their availability alone is not proof of a continuously enforced high-limit.
