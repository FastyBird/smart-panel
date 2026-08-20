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

Matches use exact Homey `class` values and capability base IDs. Optional `driver_ids`, `manufacturers`, and `models`
may narrow a descriptor but should not be used for generic mappings. Property matching derives the base ID from the
first dot only, while every resolved property binding retains the original full capability ID for reads and writes.

Every descriptor supports:

- `priority`: integer ordering, higher first;
- `exclusive`: the highest-priority exclusive match suppresses other matches of that kind;
- `conflict`: `first`, `warn`, or `error` for equal-priority mappings targeting the same output;
- property `direction`: `read_only`, `write_only`, or `bidirectional`;
- property unit/range expectations and inline `scale`, `map`, `boolean`, `clamp`, or `round` transforms.

Map transforms must declare a `read` table for read-capable directions and an explicit `write` table for writable
directions. Bidirectional maps require both tables; the loader never guesses an inverse from potentially non-injective
read values.

The JSON schema rejects unknown keys and malformed structures. Semantic validation additionally rejects unknown Smart
Panel enum values, inverted ranges, and degenerate transformations.

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

`HomeyMappingTransformerService` is the single read/write execution path for inline transforms. It rejects forbidden
directions, invalid target types, and unmapped enum values with fixed errors that never include the rejected value.
Scale transforms preserve fractional Homey command values on inverse writes while normalizing integer Smart Panel
properties only on reads.
