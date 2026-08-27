# Homey sanitized fixtures

These fixtures are a minimal, reviewed subset of a credential-safe read-only capture from Homey SHS `13.4.0` on
2026-08-13. The source capture used HTTP port `4859`. The full 118-device household capture remains ignored and local;
it must never be committed.

`current` is an atomically replaceable symlink to an immutable complete corpus under `versions/`. Consumers must read
through `current`; fixture promotion publishes a complete new version before switching this pointer in one rename.

The corpus retains protocol field names, scalar types, capability order, full repeated/suffixed capability IDs, ranges,
enum metadata, readable/writable flags, null values, and availability state. Homey IDs, zone/device names, addresses,
URLs, secrets, timestamps, personal metadata, and driver identifiers are pseudonymized or replaced with opaque markers.
Device/zone icons and source-host runtime telemetry are replaced with shape-preserving synthetic values.

Capability bases remain public protocol identifiers. Any suffix after the first `.` is replaced consistently with an
opaque alias across capability lists, maps, embedded IDs, and references so household-derived suffixes cannot leak.

`climate.json` represents temperature/humidity sensing only. The live corpus contained no target-temperature capability.
`sensor-air-quality.json` covers the available environmental sensor shape but does not claim CO₂ support.
`sensor-safety.json` is selected by alarm capability shape and retains its real sanitized Homey class; its filename does
not assert that Homey classified the source device as `sensor`.

The live inventory contained no device with Homey's `lock` class. A non-lock device exposed a suffixed child-lock
capability, but that is not promoted as live lock evidence. `knownDeviceClassGaps` in the manifest records this
explicitly. `synthetic/v1/devices/lock.json` is a separately versioned published-protocol contract fixture, carries an
explicit synthetic provenance marker, and covers normalization plus mapping without implying that a physical lock was
captured or mutating the immutable live corpus.

Known live-evidence gaps are listed in `manifest.json`. Do not invent fixtures for those capabilities; add them only from
a separately sanitized capture or a documented synthetic protocol fixture clearly marked as synthetic.

The original sanitized capture collapsed live enum option IDs before this corpus was promoted. Those corrupted option
lists are omitted from the live fixtures and recorded under `knownMetadataGaps`. `synthetic/enum-capability.json` is
explicitly synthetic and preserves distinct option IDs for transport-independent enum contract tests. Synthetic device
contracts live outside `versions/` and are pinned independently through `synthetic/manifest.json`, so normalization
generation and tests cannot treat them as captured inventory. A future live capture produced by the corrected probe may
replace these gaps; promotion now rejects redacted or duplicate enum IDs.

## Refreshing fixtures for a new Homey or SHS version

Never promote raw Homey responses. The capture command writes a locally ignored, already sanitized corpus and rejects
known secret, private-address, email, identifier, and private-term shapes before reporting success.

1. Create a dedicated read-only API key with `homey.system.readonly`, `homey.zone.readonly`, and
   `homey.device.readonly`. Do not use a household administrator key.
2. From `apps/backend`, follow the interactive read-only capture commands in the repository's Homey compatibility
   document. Enter the URL, exact expected host, API key, and comma-separated private-term defense list without placing
   the key in shell history, then run `pnpm run homey:probe`. That document is the source of truth for environment
   variable names, validation rules, and optional bounds.

3. Record the Homey/SHS version, deployment image digest, network topology, ports, and test date in the same compatibility
   document. Never record the API key, private host, private addresses, or household names.
4. Inspect the generated capture under `test/.homey-shs-captures/`. Review every key and value even though the probe
   passed. The full capture remains ignored and local; never add it to Git.
5. Promote only the smallest representative subset:

   ```bash
   pnpm run homey:promote-fixtures -- test/.homey-shs-captures/<capture-directory>
   pnpm run homey:generate-normalized-fixtures
   pnpm run test:homey-spike
   ```

6. Review the new immutable raw version, the `current` symlink change, manifest evidence gaps, normalized golden output,
   and the complete Git diff. Promotion must not turn an unobserved capability into live evidence. Use a separately
   versioned, explicitly synthetic published-protocol fixture when a contract needs coverage but no physical device was
   observed.
7. Run `pnpm run homey:security-gate` before committing. Unset every live Homey probe variable listed in the
   compatibility document afterward.

If any command reports a possible secret or private value, stop. Expand the sanitizer/private-term coverage and produce
a new capture; never edit a leaked value out of a capture and treat the remainder as trusted.

`expected/v1` contains the reviewed transport-neutral output for every representative device and the complete zone
hierarchy. Its manifest pins the immutable raw fixture version used as input. These files are golden expectations, not
additional protocol captures: regenerate them only after intentionally changing the normalized contract or promoting a
new raw fixture version, then review the complete diff. The connector transformer tests compare all raw fixtures with
these outputs and add explicit assertions for source ordering, suffixed capability IDs, null/false/zero preservation,
enum options, availability independence, and zone-cycle rejection.

`evidence/` contains separately reviewed, minimal live behavior reports that do not belong to the immutable inventory
corpus. The filename records the observation date and SHS version. Each report must retain only the probe's allowlisted
labels, booleans, ordering numbers, public dependency versions, and non-sensitive status codes, and must have a focused
test that re-applies the report safety assertions. The 2026-08-14 SDK session evidence records connection,
subscription, cleanup, and invalid-key behavior only; it does not claim capability-event, write, or reconnect coverage.
The 2026-08-26 mDNS evidence records the Homey and co-hosted HAP service types, ports, and TXT key names observed on SHS
`13.4.1`; the pre-restart and post-restart reports are exact matches. The restart-recovery and network-recovery reports
record ordered SDK disconnect, reconnect, manager resubscription, fresh inventory read, and cleanup evidence across an
SHS restart and a temporary Smart Panel-to-SHS port block, respectively. These reports contain no service instance
names, hosts, addresses, TXT values, endpoint, credential, firewall rule, inventory content, or event payload.
The error-matrix report records only the five fixed validation, authentication, authorization, timeout, and unavailable
categories plus non-sensitive HTTP status codes. It contains no URL, address, key, identifier, response body, or raw
transport error. The permission-scope report records three independently valid restricted credentials completing an
allowed read with `200` and receiving `403` for the omitted system, zone, or device permission. It contains no endpoint,
Homey identity, credential, inventory data, response body, or raw error.

Before committing regenerated fixtures, inspect every value and key and confirm that no private source value survives.
