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

- A control loop owned by the virtual device: reads the sensed quantity from a projected source,
  writes the actuator's `on` through the existing platform contract
- Hysteresis and minimum cycle protection, so a relay is not chattered
- The target setpoint as a **writable owned property** — the schema already accommodates owned
  properties; v1 simply never creates a writable one (`assertOwnedPropertyNotWritable` refuses it
  today, and that guard is what this task revisits)
- Wizard support: the six categories become selectable, with their target slots presented as
  "you set this" rather than "map this to a source"
- Removing each unblocked category from `VIRTUAL_BLOCKED_CATEGORIES`

**Out of scope**

- Scheduling, presence-driven setpoints, or any automation on top of the loop — that is the intents
  and scenes modules' ground
- Multi-stage or PID control; hysteresis is the v1 of this feature too
- Panel-side creation, which remains admin-only

## 4. Open questions

- Where does the loop run? A listener reacting to the sensed property's value changes is the cheapest
  and matches how the rest of the plugin works, but it stops when the source stops reporting — a
  ticking safety net may be needed to turn an actuator *off*.
- What happens when the sensed source is orphaned or its device goes offline? The device already
  degrades to `DISCONNECTED`; the actuator should presumably be released rather than left latched.
- Does the setpoint survive a remap of the sensed source? It is an owned property, so it does — worth
  stating explicitly.

## 5. Acceptance criteria

- [ ] A virtual `heating_unit` can be built from a relay's `on` and a thermometer's `temperature`,
      with its own writable setpoint, and passes structural validation
- [ ] The loop honours hysteresis and a minimum cycle time, both configurable
- [ ] An offline or orphaned sensed source releases the actuator rather than latching it
- [ ] The six categories are removed from `VIRTUAL_BLOCKED_CATEGORIES` only as each is genuinely
      supported, and the wizard's blocked-category notice reflects what remains
- [ ] Backend tests for the loop's decisions, and a wizard test for the setpoint slot
