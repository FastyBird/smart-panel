# Task: Virtual Devices — follow-ups from implementation review
ID: TECH-VIRTUAL-DEVICES-FOLLOWUPS
Type: technical
Scope: backend
Size: medium
Parent: EPIC-VIRTUAL-DEVICES
Status: planned

## 1. Context

Items deferred during the `devices-virtual` implementation (see `docs/superpowers/specs/2026-07-31-virtual-devices-design.md`). Each was raised by a code review, triaged as non-blocking for that branch, and verified to be real. Recorded here so they survive the branch merge.

Several are **pre-existing issues found in passing** — they are not caused by virtual devices, but they were confirmed with evidence and are worth fixing.

## 2. In virtual-devices code

### 2.1 Orphan degradation has no trigger (medium) — DONE

The orphan branch is now reachable, but nothing re-aggregates status when a property orphans. `rebuild()` runs on `CHANNEL_PROPERTY_DELETED`, then waits for the next source connection change. If the orphaned projection was the virtual device's only one, `bySourceDevice` holds no entry for it at all, so **no event will ever recompute it** and it stays at its last reported state.

Fix: recompute affected virtual devices' status directly after a rebuild that orphaned something, rather than relying on a later connection event.

**Resolved.** `VirtualPropertyIndexService.rebuild()` now reports which virtual devices came out wired differently than they went in, and `VirtualIndexMaintenanceListener` recomputes those through `VirtualStatusListener.recompute()`.

### 2.2 `hidden` enforcement is unwired (medium) — DONE for the four picker plugins

`DeviceEntity.hidden` is settable, persisted, serialized and filterable via `?hidden=`. But `ValidateDeviceNotHidden` / `DeviceNotHiddenConstraintValidator` are applied to **zero** DTOs, so nothing rejects a hidden device from being selected.

Wiring it is a per-DTO product decision across `tiles-device-preview`, `pages-device-detail`, `data-sources-device-channel`, `scenes-local` and the space assignment path. Decide which selection surfaces should refuse hidden devices, then apply the decorator.

**Resolved for the create and update DTOs of `tiles-device-preview`, `pages-device-detail`, `data-sources-device-channel` and `scenes-local`** — the surfaces the design spec names. **Still open: the space assignment path**, which the spec's `spaces-home-control` section deliberately exempts ("The four `spaces-home-control` listeners get **no** guard"); confirm whether the *assignment* DTO should nonetheless refuse a hidden device, which is a separate decision from the listeners.

### 2.7 A manually deleted connection-state property comes back as an orphan (low) — DONE

`VirtualDeviceInformationListener` creates the `device_information` channel and its connection-state property as `local`, before `DeviceConnectivityService` can create them itself — which is what stops the property from ever being classified as an orphan.

That synthesis only ran on `DEVICE_CREATED`. If the connection-state property was deleted afterwards (it is reachable through `DELETE /channels/:id/properties/:id`), the next `setConnectionState` for that device recreated it through the generic path with no `value_origin`, i.e. as an orphan, and nothing re-ran the synthesis. The device then aggregated to `DISCONNECTED` permanently, exactly as before the fix.

**Resolved — by re-synthesizing at the point of recreation rather than at the point of deletion.** `VirtualDeviceInformationListener.claimDeviceInformationProperty()` is registered as the `afterCreate` hook on the plugin's channel-property mapping, so any property created as an orphan inside a virtual device's `device_information` channel is converted to `local` inside `ChannelsPropertiesService.create()` itself — before that call re-reads the row, before it emits `CHANNEL_PROPERTY_CREATED`, and before its caller holds a copy.

Chosen over the two options originally named because both had defects the third does not:

- **Refusing the deletion** puts a virtual-devices special case on a generic devices-module endpoint, and only moves the problem: it stops one route to the state without making the state unreachable, since `setConnectionState` still creates the property generically on any device whose synthesis never ran or failed partway.
- **Re-synthesizing on `CHANNEL_PROPERTY_DELETED`** cannot see what it needs to. `ChannelsPropertiesService.remove()` loads the property with no relations, so the event payload has no channel and no device to test; it is emitted from *inside* the deleting transaction, so a handler must defer past the commit before it can read anything; and `DevicesService.remove()` deletes a device's properties before emitting `DEVICE_DELETED`, so a naive handler re-creates properties on a device that is in the middle of being deleted.

The hook also closes the same defect arriving by the other route — the creation race in §2.8 — which neither of those options would have.

**Not covered, deliberately:** deleting `manufacturer`, `model` or `serial_number` leaves them deleted until the device is recreated. Those are informational and their absence degrades nothing; the connection-state property is the only one whose absence-then-generic-recreation took the device offline.

### 2.8 The creation race could leave the connection-state property orphaned (high) — DONE

On a virtual device created with linked channels and properties in one request, `CHANNEL_PROPERTY_CREATED` is emitted for each of those *before* `DEVICE_CREATED`. `VirtualIndexMaintenanceListener` rebuilds on those events and recomputes the affected virtual device's connection state, which reaches `DeviceConnectivityService.setConnectionState()`'s find-or-create — concurrently with `VirtualDeviceInformationListener`, since `EventEmitter2.emit()` does not await listeners. Whichever loses that insert loses it on `@Unique(['identifier', 'channel'])`, and the listener used to let the violation escape to its outer catch, which logged it and returned: the winner's generically-created row stayed `source`/null, i.e. an orphan, and the device stayed permanently `DISCONNECTED` and uncommandable.

**Resolved** by the `afterCreate` hook described in §2.7 — which makes the orphan state unreachable regardless of who wins — plus a bounded retry in `ensureConnectionStateProperty()` that re-reads and claims the winning row instead of swallowing the constraint violation.

### 2.9 A partial PATCH can still reach `local` + a source (low)

`CreateVirtualChannelPropertyDto` and `UpdateVirtualChannelPropertyDto` now reject `value_origin: 'local'` sent together with a `source_property` — the one `(value_origin, sourcePropertyId)` pair `VirtualChannelPropertyEntity`'s state model has no state for, and which produces a property that neither mirrors nor forwards.

A DTO constraint can only judge the pair when both halves are in the same payload. Two partial PATCHes still reach the same row: `{value_origin: 'local'}` against a linked property, and `{source_property: <id>}` against an owned one. Closing those needs the stored row, which no `class-validator` constraint has access to — it belongs either in `ChannelsPropertiesService.update()` (which holds the loaded entity) or in a plugin-owned guard invoked from there.

### 2.3 Projection listener mutates the index's own entity (low)

`virtual-projection.listener.ts` assigns `projection.value` onto the entity stored in `bySourceProperty` and emits that same reference. Two rapid source writes emit the same object, so a listener that defers past the tick sees the newest value rather than the one at emit time. No consumer reads `value` off those instances today. Emitting a shallow copy costs nothing and decouples three components from shared mutable state.

### 2.4 Cold-miss status reads are uncached (low)

`device-connection-state.service.ts:181-189` returns the default without populating `statusMap`, so a source device with no stored status re-queries storage on every connection change affecting its virtual device. Bounded and infrequent, but `VirtualStatusListener`'s docstring claims "at most one read per device per process", which holds only on the row-found path.

### 2.5 `registry.resolve()` sits outside consumers' error containment (low)

`PropertyValueService.write/readLatest/delete` and `PropertyTimeseriesService.queryTimeseries` all call `resolve()` as their first statement, outside their try/catch. A plugin whose `resolve()` throws would break `write()`'s never-throws contract, which eight plugins rely on. The only registered source today is a pure, throw-free check. A defensive try/catch inside the registry's own `resolve()` closes it in three lines. Raised independently by two reviewers.

### 2.6 `VirtualPropertyIndexService.add()` is dead code (low)

It has no caller — `rebuild()` handles every path. Two latent inconsistencies live in it: it writes into the live maps, so a call landing mid-`rebuild()` would be discarded by the swap; and a link built from an unsaved entity could carry `sourcePropertyId: undefined`, which neither `isOrphaned` nor the status listener's `=== null` check treats as orphaned. Either remove it or give it a caller.

## 3. Pre-existing issues found in passing

### 3.1 `DeviceEntity.enabled` has the class-field-initializer defect (medium)

Same mechanism as the `hidden` and `valueOrigin` bugs fixed on the virtual-devices branch: the initializer survives `class-transformer`, so `DevicesService.update`'s `omitBy(toInstance(...), isUndefined)` yields `enabled: true` for a PATCH that omits it — silently re-enabling a disabled device on any unrelated update.

The fix was applied, proven and then **reverted**, because dropping the initializer makes `event.entity.enabled` read `undefined` in an `afterInsert` subscriber.

**Scope note:** the in-code comment at `devices.entity.ts:104-112` says "three device plugins" block this. That over-counts. Only **`devices-shelly-v1`** actually has the hazardous shape — `subscribers/device-entity.subscriber.ts:74` reads `event.entity.enabled` in `afterInsert` and passes it into `shellies-adapter.service.ts:232-238`, which assigns it straight into the in-memory registry. `devices-wled` and `devices-zigbee2mqtt` have no `afterInsert`; their `enabled` reads are on DB-loaded entities and would be unaffected. Fix shelly-v1's subscriber to re-read the row, then drop the initializer.

**Bit new code once already.** `VirtualIndexMaintenanceListener.unhideAbandonedSources()` patched `{type, hidden: false}` and thereby silently re-enabled a source device the user had explicitly disabled. That call now echoes `enabled` back explicitly, which is a local defence, not a fix — every future `DevicesService.update()` caller that omits `enabled` has the same problem, and only the root fix removes the trap.

### 3.6 Other migrations claim SQLite cannot DROP COLUMN (low)

`1000000000007` originally left its three columns behind on `down()` with the comment "SQLite cannot DROP COLUMN", which made `migration:revert` followed by `migration:run` fail on the first duplicate `ADD COLUMN`. That claim is stale: `ALTER TABLE ... DROP COLUMN` has been supported since SQLite 3.35 (2021) and the bundled driver (`sqlite3` 5.1.7) carries 3.44.2. The migration now drops them, verified by a real revert-then-run round trip.

The same comment appears on earlier migrations in `src/migrations/`, which are presumably in the same state. Not touched here: `1000000000000-InitialSetup` must not be modified (alpha installations have run it), and the others were out of scope. Worth auditing whether any of them also breaks revert-then-run. Note the restrictions that do still apply — a column may not be dropped while it is indexed, part of a primary key, or referenced by a partial index or `CHECK` constraint — so each one needs checking rather than a blanket rewrite.

### 3.2 `device-exists-constraint.validator.ts:14` declares `async: false` on an async `validate()` (medium)

A returned Promise is truthy, so `class-validator` may never await it — meaning that validator can silently pass. The validators added on the virtual-devices branch declare `async: true` correctly and do not inherit this.

### 3.3 TypeORM sqlite shared-`QueryRunner` TOCTOU (high, but pre-existing)

`SqliteDriver.createQueryRunner()` returns a **process-wide singleton**, and `AbstractSqliteQueryRunner.startTransaction()` increments `transactionDepth` only *after* awaiting `BEGIN TRANSACTION` — a TOCTOU window spanning a libuv threadpool round-trip. Verified with controls: two overlapping `dataSource.transaction()` calls failed **100 times out of 100** with `SQLITE_ERROR: cannot start a transaction within a transaction`.

This is a live production risk for any two overlapping transaction-shaped operations, not just a test artefact. It predates virtual devices, but that feature adds transaction-shaped traffic (every device delete schedules an index rebuild), so exposure increases.

### 3.4 Specs never `await module.close()` (low)

Jest's "worker process has failed to exit gracefully" warning appears across the backend suite. A repo-wide house pattern rather than a specific bug, but it masks real leaks.

### 3.5 Test-quality nits (low)

- `property-timeseries.service.spec.ts` never mocks `storageService.query`, so the test silently exercises the catch branch rather than the success path. The key assertion still runs, so it is not a false pass — just fragile.
- No test exercises `DeviceHiddenFilter.TRUE`; a mutation flipping only that branch would go undetected.
- `permissionSatisfied` is restated in `VirtualDevicesService` rather than reused, because the canonical method is private on `DeviceValidationService`. Extracting it would remove the drift risk.

## 4. Not to be done

`assertPermissionsCompatible` is intentionally unwired. It needs the target spec slot's required permissions, which depend on channel category and cannot be resolved from a property DTO in isolation. It belongs to the admin wizard (Plan B), not to a DTO constraint. Consequence to be aware of meanwhile: nothing server-side rejects a read-only source on a writable spec slot — the API accepts it and the write fails at the source platform.
