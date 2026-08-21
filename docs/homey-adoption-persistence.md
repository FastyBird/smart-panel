# Homey adoption persistence

Homey adoption uses the existing single-table-inheritance device hierarchy and the normal Devices services. The
provider does not mutate Homey: it performs one fresh device read, resolves the current mapping, and writes only local
Smart Panel device, channel, property, and property-value state.

## Identity and uniqueness

- A Homey device stores the full authoritative Homey device ID in `DeviceEntity.identifier`. The existing
  `UQ_devices_identifier_type` constraint scopes that value by the `devices-homey` discriminator, so another provider
  may use the same external identifier while concurrent Homey adoption cannot create a duplicate.
- A Homey channel stores the stable mapping key in `ChannelEntity.identifier`. The existing
  `UQ_channels_identifier_type` constraint scopes the key to its parent device. Adoption lookups additionally pass the
  parent device ID and the `devices-homey` discriminator to `ChannelsService.findOneBy`.
- A Homey capability can intentionally fan out into more than one Smart Panel property in the same channel. For
  example, `measure_luminance` produces both the numeric illuminance value and a derived illuminance band. Therefore a
  property cannot use the full capability ID as its only parent-scoped identifier.
- Homey properties use the deterministic local binding key `<full capability ID>::<mapping name>` as
  `ChannelPropertyEntity.identifier`. They also persist the unmodified full ID in `homeyCapabilityId` and the stable
  descriptor in `homeyMappingName`. Adoption lookups are parent- and discriminator-scoped. The
  `UQ_homey_capability_mapping_channel` index provides a second database-level guard on the domain identity while
  allowing intentional capability fan-out.

The Homey-only metadata columns are nullable because core connectivity state uses the same provider discriminator for
its `device_information` channel and properties without representing Homey capabilities. Adoption requires and writes
both fields for every mapping-owned property, excludes metadata-free infrastructure properties from stale cleanup, and
preserves the connectivity channel during re-adoption.

## Migration decision

The device and channel assumptions were proven by the existing constraints. The property assumption failed because
the MVP mapping set contains deliberate one-to-many capability mappings. Migration
`1000000000021-AddHomeyCapabilityIdentity` is therefore required. It adds two nullable columns to the shared property
table so other property subclasses remain unaffected, creates the unique domain index, and has a tested rollback that
removes the index and both columns.

Migration `1000000000022-AddHomeyAdoptionLocks` adds a provider-private claim table keyed by the authoritative Homey
device ID. It serializes the complete adoption boundary across backend processes without adding lock state to public
device models. Claims use renewable, owner-scoped leases: a clean completion removes only its own claim, while a
crashed process cannot strand a device because a later request may atomically replace the expired claim.

## Mutation and rollback boundary

The backend uses one shared SQLite connection. Holding a repository transaction across the awaited Devices service
operations could absorb unrelated statements from other requests, so Homey adoption follows the established
`DeviceStructureLockService` pattern instead:

1. Requests for the same Homey ID acquire the database-backed claim before any local persistence read or mutation.
2. The fresh mapping is validated before any mutation.
3. The complete existing Homey hierarchy and current values are captured.
4. Core Devices services reconcile the local hierarchy and apply initial values.
5. On failure, completed mutations are compensated in reverse order from the captured snapshot.
6. Each batch selection completes independently and returns a fixed, sanitized outcome.

The structure lock prevents unrelated in-process hierarchy races. The renewable adoption claim covers snapshot,
reconciliation, and terminal value writes across processes; database identity constraints remain the final creation
guard. A concurrent unique-insert loss from an older or external writer is re-read only after its expected hierarchy
and initial measurements are visible, then reconciled as an idempotent update rather than returned as a duplicate
conflict.

Terminal adoption values use the Devices module's strict property-value path. The active read backend must acknowledge
the measurement before the process-local cache is updated; a transient storage failure therefore remains retryable on
the next idempotent adoption instead of being hidden by a cache-only value. Existing-hierarchy snapshots likewise use
authoritative strict reads that bypass each process's local cache and abort reconciliation when shared history is
unavailable, preventing stale or unknown previous values from becoming duplicate appends.
