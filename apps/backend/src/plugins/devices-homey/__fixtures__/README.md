# Homey sanitized fixtures

These fixtures are a minimal, reviewed subset of a credential-safe read-only capture from Homey SHS `13.4.0` on
2026-08-13. The source capture used HTTP port `4859`. The full 118-device household capture remains ignored and local;
it must never be committed.

The corpus retains protocol field names, scalar types, capability order, full repeated/suffixed capability IDs, ranges,
enum metadata, readable/writable flags, null values, and availability state. Homey IDs, zone/device names, addresses,
URLs, secrets, timestamps, personal metadata, and driver identifiers are pseudonymized or replaced with opaque markers.
Device/zone icons and source-host runtime telemetry are replaced with shape-preserving synthetic values.

`climate.json` represents temperature/humidity sensing only. The live corpus contained no target-temperature capability.
`sensor-air-quality.json` covers the available environmental sensor shape but does not claim CO₂ support.
`sensor-safety.json` is selected by alarm capability shape and retains its real sanitized Homey class; its filename does
not assert that Homey classified the source device as `sensor`.

The live inventory contained no device with Homey's `lock` class. A non-lock device exposed a suffixed child-lock
capability, but that is not promoted as lock evidence. `knownDeviceClassGaps` in the manifest records this explicitly.

Known live-evidence gaps are listed in `manifest.json`. Do not invent fixtures for those capabilities; add them only from
a separately sanitized capture or a documented synthetic protocol fixture clearly marked as synthetic.

The original sanitized capture collapsed live enum option IDs before this corpus was promoted. Those corrupted option
lists are omitted from the live fixtures and recorded under `knownMetadataGaps`. `synthetic/enum-capability.json` is
explicitly synthetic and preserves distinct option IDs for transport-independent enum contract tests. A future live
capture produced by the corrected probe may replace this gap; promotion now rejects redacted or duplicate enum IDs.

To regenerate the selected subset from an ignored sanitized capture:

```bash
cd apps/backend
pnpm run homey:promote-fixtures -- test/.homey-shs-captures/<capture-directory>
pnpm run test:homey-spike
```

Before committing regenerated fixtures, inspect every value and key and confirm that no private source value survives.
