# Task: Controller support for virtual devices — unblock the closed-loop categories

ID: FEATURE-DEVICE-VIRTUAL-CONTROLLER
Type: feature
Scope: backend, admin
Size: large
Parent: EPIC-VIRTUAL-DEVICES
Status: planned

## 1. Business goal

In order to build a heating or climate device from a relay and a sensor that belong to different
physical devices,
As a smart home user,
I want a virtual device that closes the loop between them — holding a setpoint I choose, rather than
just forwarding my switch presses.

## 2. Context

v1 of `devices-virtual` is pure wiring: every property of a virtual device either projects a source
property or is a synthesized `device_information` string. That is enough for `light`, `switcher` and
`outlet`, which is the primary split use case, and not enough for anything that needs a *target*.

Six categories are therefore blocked in v1 — the wizard filters them with *"needs a controller —
planned for a later release"* and the server rejects them
(`VIRTUAL_BLOCKED_CATEGORIES`, `assertCategoryAllowed`):

`air_conditioner`, `air_dehumidifier`, `air_humidifier`, `heating_unit`, `water_heater`, `thermostat`

The rule behind the list, from
[the design's v1 category boundary](../../docs/superpowers/specs/2026-07-31-virtual-devices-design.md#v1-category-boundary):
a channel needs closed-loop control when it has a writable `on` **plus a required writable target for
a sensed quantity** — something the actuator cannot set directly. Brightness, speed and position are
directly actuated and do not qualify.

```
closed-loop channels:  cooler → temperature    heater → temperature
                       humidifier → humidity   dehumidifier → humidity
```

`thermostat` is on the list for a different reason: heater and cooler are optional there, so it would
technically validate, but a thermostat with neither is a thermometer wearing a badge.

## 3. Scope

**In scope**

- A control loop owned by the virtual device: reads the sensed quantity from a projected source, and
  drives the actuator through the existing platform contract — but **not** through the slot the user
  sees (see §3a)
- Hysteresis and minimum cycle protection, so a relay is not chattered
- Re-evaluation on **four** inputs: a sensed-value report, a write to the owned setpoint, a write to
  the exposed `on`, and a connection-state change on the actuator's or the sensor's device
  (`DEVICE_CONNECTION_CHANGED`). A loop driven only by the sensor does nothing when the user moves the
  target or switches the device off, and a sensor that reports on change can be silent for a long
  time — lowering the target would leave the actuator on, raising it would leave it off, and an OFF
  would leave a relay energised, each until something unrelated happened to arrive. The connection
  case is the one that cannot be recovered by waiting: an actuator that drops offline while energised
  never received the release, and on reconnect nothing else has changed, so no other trigger fires.
  A periodic safety tick is the backstop for what even this misses — an actuator that never reports a
  connection change at all
- The target setpoint as a **writable owned property** — the schema already accommodates owned
  properties; v1 simply never creates a writable one (`assertOwnedPropertyNotWritable` refuses it
  today, and that guard is what this task revisits)
- Wizard support: the six categories become selectable, with their target slots presented as
  "you set this" rather than "map this to a source", and the `status` each closed-loop channel
  requires accounted for (see §3a)
- The actuator invariant `thermostat` needs, since the specification does not express it (see §3a)
- Removing each unblocked category from `VIRTUAL_BLOCKED_CATEGORIES`

**Out of scope**

- Scheduling, presence-driven setpoints, or any automation on top of the loop — that is the intents
  and scenes modules' ground
- Multi-stage or PID control; hysteresis is the v1 of this feature too
- Panel-side creation, which remains admin-only

## 3a. Two things the spec forces, which the loop has to answer

**The exposed `on` is the user's switch, not the controller's output.** Every closed-loop channel
carries both, and the rest of the system already reads them that way:
`SpaceClimateStateService.detectClimateModeAndActivity()` treats `on` as *enabled* — "even if not
actively working", as its own comment puts it — and `status` as whether the unit is currently working
(`space-climate-state.service.ts:405-432`). A loop that drove the exposed `on` would therefore make
an enabled heater read OFF the moment it reached its setpoint, and would overwrite a user's explicit
OFF on the next sensor report or setpoint change. So the design needs three distinct things, not two:
the **enable** the user owns (`on`), the **activity** the loop reports (`status`), and the
**actuator write** the loop performs, which goes to the projected relay and is not a slot of the
virtual device at all. Which projection carries the actuator has to be part of the wizard's mapping —
"this relay is what I switch" — rather than inferred from the `on` slot.

**The actuator mapping needs somewhere to live.** Today a mapping is only ever
`VirtualChannelPropertyEntity.sourcePropertyId`: a property *of the virtual device* pointing at a
source. An actuator that is deliberately not a slot therefore has no row, and nothing would survive a
restart. The task has to name the owner and the behaviour, with an incremental migration for it
(never a change to the initial one):

- the natural home is the **virtual channel**: one closed-loop channel commands one actuator, so a
  nullable `actuatorPropertyId` FK on `VirtualChannelEntity` says exactly that, and the wizard's
  mapping step writes it beside the channel's projections;
- **deletion** behaves like a lost source: `ON DELETE SET NULL`, the channel degrades, the device
  reports `DISCONNECTED` through the same aggregation that already handles orphans, and the loop
  stops commanding rather than commanding nothing;
- **remap** is the existing remap dialog with one more row — the actuator is a mapping like any
  other, and `assertProjectionCompatible`'s counterpart has to judge it: an actuator must be a
  writable `bool`, and it must not be a property of a virtual device.

**`status` is required on the temperature channels, and optional and enum-typed on the humidity
ones.** `heater` requires
`on(bool,rw)`, `temperature(float,rw)` *and* `status(bool,ro)`, all three `required: true` in
`spec/devices/channels.yaml`, and `cooler` requires the same three — so `heating_unit`,
`water_heater` and `air_conditioner` all fail validation without a `status` nobody supplies.

The humidity channels are **not** the same shape, and a rule generalised across all four would be
wrong: `humidifier.status` and `dehumidifier.status` are `required: false` and typed `enum`, with
formats `["idle","humidifying"]` and `["idle","dehumidifying","defrosting"]`. Synthesizing a boolean
there would fail validation rather than satisfy it. For those two the task should either omit
`status` — it is optional, so the device validates without it — or synthesize the enum with values
drawn from the channel's own format, and say which.

`temperature` (or `humidity`) is the setpoint the controller owns; `status` is what the device
reports back. For `heater` and `cooler` it must exist, so this task has to decide between two
answers, and say which in the design before anyone builds:

- the controller **synthesizes** it as an owned read-only property it drives from its own decision —
  the loop knows whether it is currently calling for heat or cooling, and that is exactly what
  `status` means; or
- it is **another mapping**, for hardware that reports a genuine flame/compressor state, with the
  synthesized value as the fallback when nothing is mapped.

The first is the smaller change and the one that keeps the wizard to wiring plus a setpoint. Either
way, v1's rule that owned properties are never writable and never anything but `device_information`
strings has to give — which is the same guard (`assertOwnedPropertyNotWritable`) the setpoint needs
revisited, so both land together.

**`thermostat` needs an actuator invariant.** `heater` and `cooler` are `required: false` on the
`thermostat` device (`spec/devices/devices.yaml`), so the specification alone would happily accept a
thermostat with neither — the "thermometer wearing a badge" the design blocks it for. Structural
validation cannot catch it, because nothing is missing. Removing `thermostat` from
`VIRTUAL_BLOCKED_CATEGORIES` therefore has to come with a rule of its own: at least one controlled
actuator channel, enforced in the wizard's advance gate *and* at persistence, in the same place the
category itself is judged.

## 4. Open questions

- How long may the safety tick be? Event-driven re-evaluation covers every transition the system
  reports; the tick exists for the one it does not — hardware that goes quiet without saying so. Its
  period is a trade between a relay left energised and waking the process for nothing.
- What happens when the sensed source is orphaned or its device goes offline? The device already
  degrades to `DISCONNECTED`; the actuator should presumably be released rather than left latched.
- Does the setpoint survive a remap of the sensed source? It is an owned property, so it does — worth
  stating explicitly.

## 5. Acceptance criteria

- [ ] A virtual `heating_unit` can be built from a relay as the actuator, a thermometer's
      `temperature` as the *reading*, its own writable setpoint, and a `heater.status` — all three of
      `on`, `temperature` and `status` are `required: true` on the `heater` channel
      (`spec/devices/channels.yaml`), so a device assembled from the first two alone still fails
      structural validation with `MISSING_PROPERTY`
- [ ] The same for a cooling device — `air_conditioner`'s `cooler` channel requires its own
      `status(bool,ro)`, so a heater-only implementation would pass the criterion above and still
      leave air conditioners failing validation
- [ ] `air_humidifier` and `air_dehumidifier` validate too, with `status` either omitted (it is
      optional there) or synthesized as the **enum** those channels declare — never as a boolean
- [ ] Switching the virtual device OFF keeps it off: the loop does not re-enable it on the next sensor
      report or setpoint change, and an enabled device that has reached its setpoint still reads `on`
      with `status` false, rather than reading OFF
- [ ] `thermostat` is unblocked only once at least one actuator channel — `heater` or `cooler` — is
      required of it, in the wizard and at persistence
- [ ] The loop honours hysteresis and a minimum cycle time, both configurable
- [ ] A write to the setpoint re-evaluates the loop immediately, with a backend test that moves the
      target while the sensed value stays constant and asserts the actuator follows
- [ ] A write to `on` does the same: switching an actively heating device off releases the relay
      without waiting for another sensor report
- [ ] An actuator that reconnects is re-evaluated: a relay left energised while its device was
      offline is released on reconnect, with the sensed value, setpoint and enable all unchanged
- [ ] The actuator mapping survives a restart, degrades to `DISCONNECTED` when its property is
      deleted, and can be remapped — with the incremental migration that adds it
- [ ] An offline or orphaned sensed source releases the actuator rather than latching it
- [ ] The six categories are removed from `VIRTUAL_BLOCKED_CATEGORIES` only as each is genuinely
      supported, and the wizard's blocked-category notice reflects what remains
- [ ] Backend tests for the loop's decisions, and a wizard test for the setpoint slot
