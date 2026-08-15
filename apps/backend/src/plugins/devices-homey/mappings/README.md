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

The JSON schema rejects unknown keys and malformed structures. Semantic validation additionally rejects unknown Smart
Panel enum values, inverted ranges, and degenerate transformations.
