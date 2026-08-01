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

### 2.7 A manually deleted connection-state property comes back as an orphan (low)

`VirtualDeviceInformationListener` now creates the `device_information` channel and its connection-state property as `local`, before `DeviceConnectivityService` can create them itself — which is what stops the property from ever being classified as an orphan.

That synthesis only runs on `DEVICE_CREATED`. If the connection-state property is deleted afterwards (it is reachable through `DELETE /channels/:id/properties/:id`), the next `setConnectionState` for that device recreates it through the generic path with no `value_origin`, i.e. as an orphan, and nothing re-runs the synthesis. The device then aggregates to `DISCONNECTED` permanently, exactly as before the fix.

Options: refuse deletion of a synthesized `device_information` property on a virtual device; or re-run the synthesis on `CHANNEL_PROPERTY_DELETED` for a virtual device's `device_information` channel.

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
