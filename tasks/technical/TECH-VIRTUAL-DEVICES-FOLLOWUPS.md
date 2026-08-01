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

### 2.9 A partial PATCH can still reach `local` + a source (low) — DONE

`CreateVirtualChannelPropertyDto` and `UpdateVirtualChannelPropertyDto` reject `value_origin: 'local'` sent together with a `source_property` — the one `(value_origin, sourcePropertyId)` pair `VirtualChannelPropertyEntity`'s state model has no state for, and which produces a property that neither mirrors nor forwards.

A DTO constraint can only judge the pair when both halves are in the same payload, so two partial PATCHes reached the same row without tripping it: `{value_origin: 'local'}` against a linked property, and `{source_property: <id>}` against an owned one. Each validates perfectly on its own and only becomes the unsupported pair once `ChannelsPropertiesService.update()` merges it into the stored row.

**Resolved** by moving the half of the rule a payload cannot see down to the layer that holds the merged row:

- `ChannelPropertyTypeMapping` gains a `beforeUpdate` hook, the mirror of the existing `afterCreate` / `afterUpdate`. `ChannelsPropertiesService.update()` calls it on the loaded entity *after* the update's fields are assigned onto it and *before* `repository.save`, so a throw leaves the row untouched.
- The plugin registers it against `VirtualDevicesService.assertValueOriginPairSupported`, a fourth `assert*` alongside the three that already police the creation flow. Its `VirtualValueOriginConflictException` is translated to `DevicesValidationException` at the registration site — the same shape as `SourceNotVirtualConstraintValidator`'s translation — so the HTTP layer reports 422 rather than 500. Any other exception is re-thrown untouched.
- Both callers now share one predicate, `isUnsupportedValueOriginPair` in `entities/devices-virtual.entity.ts`, so the DTO constraint and the merged-row guard cannot drift.

The DTO constraint is **kept**, not replaced: it runs first and gives the better error — a 400 naming the offending field — for the combined payload the admin UI actually sends, whereas the hook can only manage a generic 422 because that is all the service layer's failure vocabulary can express. They are complementary.

Only `update` is hooked. `create` needs no equivalent: `value_origin` has a known default there, so both halves of the pair are always decidable from the one payload the DTO constraint already sees.

Two consequences accepted deliberately:

- The guard judges the merged row, not the delta, so a PATCH touching *neither* field is still rejected against a row that was already in the bad state — one an alpha installation could hold, since the two partial PATCHes used to be accepted. That is repairable rather than a trap: `{source_property: null}` or `{value_origin: 'source'}` fixes the row and passes, and every other edit is refused until it does.
- `VirtualDeviceInformationListener.claimProperty()` now sends `source_property: null` alongside `value_origin`. It previously relied on its callers only ever reaching it with a null source; `ensureConnectionStateProperty` guards on `isProjecting` alone, so a linked status property POSTed into the `device_information` channel by hand would have merged into exactly the pair the hook refuses — a throw out of a listener rather than the inert row it produced before. Clearing the source makes the claim mean what its name says in every path.

### 2.10 A disabled virtual device still reports CONNECTED (low)

`VirtualDevicePlatform.processBatch()` now rejects every command against a device with `enabled: false`, matching `devices-shelly-v1`, `devices-wled` and `devices-zigbee2mqtt` — the platform is where every device plugin enforces `enabled`, since `PropertyCommandService` only ever checks connection state.

The device's *connection state* is untouched by that: `VirtualStatusListener` aggregates purely over source online-ness and orphan-ness, so a disabled virtual device keeps whatever state its sources imply, and the `DEVICE_UPDATED` rebuild does not report it as re-wired (its links did not change), so nothing recomputes it either.

**Deliberately left alone**, for two reasons:

- No sibling plugin ties the two together. None of `devices-shelly-v1`, `devices-wled` or `devices-zigbee2mqtt` writes a connection state on disable — `enabled` and connectivity are separate axes everywhere in this codebase, and a virtual device folding them together would be the odd one out.
- It would make `enabled` a *second* input to the aggregation rule the design spec states in terms of sources only, and the rule is already load-bearing for `PropertyCommandService`'s offline check. Conflating "the user turned this off" with "a source went away" loses the distinction the admin UI needs to explain either one.

If it is ever wanted, the place is `VirtualStatusListener.aggregateState()` plus a `DEVICE_UPDATED` subscription that recomputes on an `enabled` transition — not a special case in the rebuild's re-wiring diff, which is about links.

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

**Two further consequences measured in round 4**, both of which constrain anything that reads `isTransactionActive`:

- **A transaction can be abandoned, leaving the flag set indefinitely.** Instrumenting `VirtualIndexMaintenanceListener`'s wait against the `devices-virtual` e2e suite showed the flag set continuously for over 1.5s across seven consecutive passes, with the driver reporting `transactionDepth === 1` — i.e. a `BEGIN` that succeeded and was then never committed or rolled back, not merely a stale boolean. A healthy device deletion settles in 25–350ms by the same measurement, so the two are easy to tell apart by duration but not by inspection. Anything that *waits* on the flag therefore needs a bound plus a way to stop paying it once the connection has proven it is not settling.
- **The flag can also be set with no transaction behind it at all, permanently.** `AbstractSqliteQueryRunner.startTransaction()` assigns `isTransactionActive = true` before awaiting `BEGIN TRANSACTION` and does not reset it if that query throws; `EntityManager.transaction()`'s catch then calls `rollbackTransaction()`, whose own `ROLLBACK` throws ("cannot rollback - no transaction is active") before the `isTransactionActive = false` line is reached. So "refuse to read while the flag is set" is not a safe policy — after one collision it would block forever.

Fixing the root cause (a real mutex around transaction-shaped operations on the shared connection, or a driver-level serialization) would remove the need for the mitigations in `VirtualIndexMaintenanceListener` entirely.

### 3.4 Specs never `await module.close()` (low)

Jest's "worker process has failed to exit gracefully" warning appears across the backend suite. A repo-wide house pattern rather than a specific bug, but it masks real leaks.

### 3.5 Test-quality nits (low)

- `property-timeseries.service.spec.ts` never mocks `storageService.query`, so the test silently exercises the catch branch rather than the success path. The key assertion still runs, so it is not a false pass — just fragile.
- No test exercises `DeviceHiddenFilter.TRUE`; a mutation flipping only that branch would go undetected.
- `permissionSatisfied` is restated in `VirtualDevicesService` rather than reused, because the canonical method is private on `DeviceValidationService`. Extracting it would remove the drift risk.

### 3.7 The security aggregator double-counts a projected sensor (medium)

`SecuritySensorsProvider.buildSignals()` walks every device's channels and emits one alert per channel matching a detection rule, keyed `sensor:<deviceId>:<alertType>`. A virtual device that projects a physical motion/smoke/contact sensor has its own channel of that category, and `ChannelPropertyEntitySubscriber.afterLoad` populates the projection's `value` through `PropertyValueService.readLatest()` — which resolves the storage key through the value-source registry — so the provider reads the source's live value off the virtual device too.

The result is two alerts with different ids for one physical sensor: `activeAlertsCount` counts it twice, and both survive `SecurityAggregatorService.mergeAlerts()`, which de-duplicates by alert id.

Not caused by this branch's listener work and not fixable there: `SecurityStateListener` only ever *schedules* a recalculation, and the recalculation recomputes from scratch, so no guard in that listener has ever affected what the aggregation counts. (A projection guard in that listener was briefly justified on these grounds; it was removed in round 3 because it dropped genuinely-needed events without preventing this.)

Fixing it means deciding, in the provider, which of the two channels represents the sensor. The obvious rule — skip a channel whose properties are all projections — is wrong for the case virtual devices exist to serve, where the virtual device is the one the user thinks of as the sensor. It is a product decision about which device an alert should name, not a mechanical de-duplication.

The same shape almost certainly applies to any other provider or module that scans `devices → channels → properties` and aggregates per match; only the security sensors provider was checked.

### 3.8 Two virtual properties projecting one non-qualifying source both ingest (low)

`EnergyIngestionListener`'s projection guard was narrowed in round 5 to "skip only when the *source* event was itself eligible" — the same asymmetry as §3.7's, found in energy after the security one: a `consumption` property in a `generic` channel projected into an `electrical_energy` one was ingested by nobody, because the source event failed the `SOURCE_TYPE_MAP` lookup and the guard discarded the only event carrying the qualifying classification. Unlike the security case the guard could not simply be removed — `processPropertyValue()` writes one delta per event, so a source and a projection that both qualify would genuinely bill the same kWh twice.

One residual case is knowingly left: if **two** virtual properties project the *same* non-qualifying source into two qualifying channels, both ingest. Each has its own `(deviceId, channelId)` delta key, so they are two meters as far as `DeltaComputationService` is concerned, and the household total counts the watts twice.

It is out of reach of the rule as stated — the guard is a per-event question about the source, and "am I the only projection of this source that qualifies?" is a question about the *set* of projections, which only `VirtualPropertyIndexService` can answer and which the energy module has no business reaching into. Fixing it means either an election (lowest property id wins) or moving de-duplication into `DeltaComputationService`, keyed by storage key rather than by device+channel. Both are larger than the defect: it needs a user to deliberately wire one physical meter into two virtual devices, and unlike the dropped-meter case it is visible — an inflated total, not a silent omission.

## 4. Not to be done

`assertPermissionsCompatible` is intentionally unwired. It needs the target spec slot's required permissions, which depend on channel category and cannot be resolved from a property DTO in isolation. It belongs to the admin wizard (Plan B), not to a DTO constraint. Consequence to be aware of meanwhile: nothing server-side rejects a read-only source on a writable spec slot — the API accepts it and the write fails at the source platform.
