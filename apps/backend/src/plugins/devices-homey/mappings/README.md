# Homey mapping definitions

Homey mappings are split into three strict YAML documents:

- `devices.yaml` selects a Smart Panel device category.
- `channels.yaml` creates stable channel descriptors.
- `properties.yaml` maps full Homey capabilities to Smart Panel properties.

Built-in files live in `mappings/definitions`. Upgrade-safe user overrides use these exact repository data paths:

- `var/data/plugin.devices-homey.devices.yaml`
- `var/data/plugin.devices-homey.channels.yaml`
- `var/data/plugin.devices-homey.properties.yaml`

Each user file must have the same `kind` as its filename. A user descriptor replaces a built-in descriptor only when
both have the same `name`; otherwise it is added. Resolution is deterministic: priority descending, user source before
built-in source, then mapping name. Invalid user files are isolated and ignored as a whole, while an invalid built-in
file prevents the plugin from starting.

Matches use exact Homey `class` values and capability base IDs. Optional `all_capabilities` and `none_capabilities`
constraints let a property mapping require or exclude companion capabilities so the resulting Smart Panel channel is
structurally complete. Optional `driver_ids`, `manufacturers`, and `models` may narrow a descriptor but should not be
used for generic mappings. Property matching derives the base ID from the first dot only, while every resolved property
binding retains the original full capability ID for reads and writes. When repeated capability instances would target
the same static channel property, resolution selects the unsuffixed primary instance, or the lexically first full ID
when no primary exists. Additional instances remain discoverable upstream but are not collapsed into duplicate Smart
Panel properties.

Every descriptor supports:

- `priority`: integer ordering, higher first;
- `exclusive`: the highest-priority exclusive match suppresses other matches of that kind;
- `conflict`: `first`, `warn`, or `error` for equal-priority mappings targeting the same output;
- property `direction`: `read_only`, `write_only`, or `bidirectional`;
- property `write_strategy`: an explicit coordinated-write strategy for properties that jointly represent one Homey
  capability;
- property unit/range expectations and inline `scale`, `map`, `boolean`, `clamp`, `round`, `constant`, `threshold`, or
  `thresholds` transforms.

Map transforms must declare a `read` table for read-capable directions and an explicit `write` table for writable
directions. Bidirectional maps require both tables; the loader never guesses an inverse from potentially non-injective
read values.

`constant`, `threshold`, and `thresholds` are read-only derived transforms. Constants can supply a required static
property even when the source capability has no current value; a threshold derives one of two values, while strictly
descending thresholds derive a band from a numeric source.
The JSON schema rejects unknown keys and malformed structures. Semantic validation additionally rejects unknown Smart
Panel enum values, inverted ranges, degenerate transformations, and writable use of derived transforms.

## Built-in MVP catalog

The built-in catalog covers standardized Homey power, lighting, climate, environment, safety/contact, energy, battery,
lock, and window-covering capabilities. The committed SHS 13.4.0 golden fixtures directly exercise power, dimming,
hue, saturation, relative light temperature, measured temperature and humidity, luminance, battery percentage,
instantaneous/cumulative energy, cover state/position, and repeated suffixed capabilities.

The captured household did not expose every standardized capability. Tests for `target_temperature`,
`thermostat_mode`, `measure_pressure`, `measure_co2`, `alarm_motion`, `alarm_contact`, `alarm_smoke`, `alarm_co`,
`locked`, and `windowcoverings_tilt_set` therefore use clearly named published-contract devices, not fixtures that claim
live provenance. Their scalar types, ranges, access, and enum values were checked against Athom's public
[`node-homey-lib`](https://github.com/athombv/node-homey-lib/tree/aa72cd285caff479c68cfdfe1347053eca06c20f/assets/capability/capabilities)
capability definitions on 2026-08-20. Live evidence gaps remain recorded in the fixture manifest and
`docs/homey-shs-compatibility.md`.

Two relative Homey controls need a deterministic projection into Smart Panel's physical-unit properties:

- `light_temperature` maps Homey's cool-to-warm `0..1` travel to `6500..2000 K`.
- `windowcoverings_tilt_set` maps Homey's closed-to-open `0..1` travel to Smart Panel's full `-90..90°` tilt travel.

These projections are reversible and clamped, but they describe normalized travel rather than device-reported physical
calibration. Mapping preview must present that conversion metadata so an operator can override it for hardware with a
narrower or inverted range.

Homey's `windowcoverings_state` is retained as the open/close/stop command source, but it is not treated as live motion:
captured SHS evidence retains `down` after the covering has reached position `0`. The built-in status therefore derives
`closed` and `opened` from position endpoints and reports intermediate positions as `stopped`. A driver-specific mapping
may add `opening` or `closing` only when it has a verified live motion signal.

Smart Panel's heater and cooler `on` properties jointly represent Homey's single configured `thermostat_mode` value.
Their explicit `thermostat_heater_mode` and `thermostat_cooler_mode` write strategies preserve the sibling state and
combine both changes into one upstream command. A standard four-mode thermostat therefore maps `off`, `heat`, `cool`,
and `auto` to the two boolean properties without treating either boolean mapping as independently reversible. The
upstream mode domain must expose exactly one combined-mode value, either `auto` or `heat_cool`; devices with neither or
both remain unsupported because the two boolean states would be incomplete or ambiguous. The
shared `target_temperature` capability is projected to both channels using the authoritative Homey minimum, maximum,
and step, so adoption does not advertise values the device cannot accept. These projections describe configured mode
and target only; they do not fabricate actual heating or cooling activity. When Smart Panel sends distinct AUTO lower
and upper setpoints in one batch, the platform projects their midpoint onto Homey's single target and aligns it to the
capability step. The prepared midpoint is returned to the climate intent layer so history and subsequent state responses
store the value Homey actually accepted for both setpoints. A one-sided HEAT or COOL setpoint remains a direct
shared-target write.

Thermostat device eligibility requires `measure_temperature`, `target_temperature`, and `thermostat_mode` together.
Partial target-only or mode-only devices stay unsupported.

The battery channel is emitted only when `measure_battery` exists and the selected Smart Panel device contract permits
that channel. Thermostats are excluded because their current contract does not accept battery channels. When Homey also
exposes `alarm_battery`, that alarm maps directly to the required status; otherwise status is derived as `low` at or
below 20 percent and `ok` above it. Alarm-only devices do not produce an invalid percentage-less battery channel.
Window-covering classes provide their required `type` through a read-only constant projection; the generic class
defaults to `roller` and remains replaceable by an operator override.

`HomeyMappingTransformerService` is the single read/write execution path for inline transforms. It rejects forbidden
directions, invalid target types, and unmapped enum values with fixed errors that never include the rejected value.
Scale transforms preserve fractional Homey command values on inverse writes while normalizing integer Smart Panel
properties only on reads.
