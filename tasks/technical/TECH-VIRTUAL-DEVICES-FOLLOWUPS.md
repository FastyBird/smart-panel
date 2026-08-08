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

**The same defect one process restart later, also resolved (round 6).** The recompute above is scheduled fire-and-forget, so a process that stops between a source property's deletion committing and that pass running leaves the deletion durable and the status stale. The bootstrap rebuild rediscovered the orphan on the next start and then discarded what it reported, and — because an orphan is in no source device's reverse index — nothing afterwards could ever select that device again. `VirtualIndexMaintenanceListener` now owns the bootstrap hydration as well (the index exposes no lifecycle hook of its own) and feeds its result through the same `recomputeStatuses()`, so a restart repairs the window instead of freezing it. The hook stays failure-tolerant: a rebuild against a schema that does not exist yet — a fresh install before migrations, and `generate:openapi` — logs and lets the app start, exactly as before.

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

### 2.13 A virtual property could be attached to a physical device (high) — DONE

A channel property's `type` is chosen from the request payload while its channel is a *route parameter*, so `POST /channels/:physicalChannelId/properties` with `type: 'virtual'` built a `VirtualChannelPropertyEntity` inside an ordinary physical channel, and nothing downstream re-checked the owner.

The damage was not confined to the plugin. `VirtualPropertyIndexService` resolves a virtual property's owning device from its own channel relation and files it under `byVirtualDevice`, so the *physical* device became, to the index, a virtual device; `VirtualStatusListener` then overwrote that device's real connectivity with the projection aggregate — DISCONNECTED for a source-less property, which is what a stray one is — and `PropertyCommandService` refuses every command against an offline device. A real device's own commands started failing because of a plugin it was never enrolled in.

**The same gap existed one level up**, and was confirmed reachable before the fix: `POST /channels` takes `device` from the payload, so a virtual channel could be hung off a physical device — through the standalone route, the device-scoped route, or nested in a physical `POST /devices` — and then filled with virtual properties.

**Resolved** at the two layers the two shapes are decidable at:

- `CreateVirtualChannelDto` redeclares `device` carrying `@ValidateDeviceIsVirtual()` alongside the inherited `@IsUUID` and `@ValidateDeviceExists`. One declaration covers all three channel-creation paths, because every one funnels that field through `ChannelsService.create()` — the standalone route sends it in the payload, the device-scoped route merges the route parameter in first, and `DevicesService.create()` sets it to the new device's id when re-validating each nested channel. A field the payload carries gets a 400 that names it.
- `ChannelPropertyTypeMapping` gains a `beforeCreate` hook, the mirror of the `beforeUpdate` added in §2.9. `ChannelsPropertiesService.create()` calls it with the built-but-unsaved entity and the channel id, before `repository.save` — so a refused attachment leaves no row, emits no `CHANNEL_PROPERTY_CREATED`, and never reaches the `afterCreate` ownership claim. A class-validator constraint could not do this: the channel id never reaches the create DTO. The plugin registers it against `VirtualDevicesService.assertChannelOwnerIsVirtual`, which requires both the channel and its device to be virtual.

The **update paths need no counterpart**, and for a structural reason rather than a guard: `UpdateChannelDto` declares no `device` and `UpdateChannelPropertyDto` declares no `channel`, and both controllers validate with `forbidNonWhitelisted`, so an attempt to re-parent is rejected as an unknown field. A device cannot change type either — `DevicesService.update()` resolves the mapping from the *stored* type and TypeORM sets the STI discriminator from the entity class, not from a payload field. Two e2e assertions pin the re-parent case so that adding either field later cannot pass unnoticed.

Deliberately **not** closed: the mirror image, a *physical* property in a virtual channel. It is inert — the index only holds `VirtualChannelPropertyEntity` rows and `VirtualDevicePlatform` refuses anything that is not one — so it degrades nothing, and closing it means a guard in every other device plugin rather than in this one.

### 2.14 A writable owned property was accepted but could never work (medium) — DONE

`value_origin: 'local'` with writable permissions passed validation, even though `VirtualDevicePlatform.processBatch()` unconditionally rejects every LOCAL property as read-only ("owned properties are read-only in this release").

Worse than inert: `ChannelsPropertiesService.update()` persists the optimistic value into the property's own series *before* the controller dispatches the command, and that dispatch is fire-and-forget — so the control visibly moves, the refusal lands in a log nobody reads, and nothing happens in the house.

**Restricted rather than implemented**, because the scope decision is deliberate: v1 is wiring only, and the only owned properties that exist are the synthesized read-only `device_information` fields. Writable owned properties belong to the controller-support follow-up, when a setpoint someone can actually act on becomes meaningful.

- `ValidateOwnedPropertyNotWritable()` on `permissions` in both the create and update property DTOs, attached to `permissions` rather than `value_origin` for the same reason `ValidateOwnedPropertyHasNoSource` attaches to `source_property`: the origin is a deliberate choice about what the property *is*, writability is the part that cannot come with it.
- `VirtualDevicesService.assertOwnedPropertyNotWritable`, called from the same `beforeUpdate` hook as §2.9's check, for the two partial PATCHes the DTO cannot judge: `{permissions: ['rw']}` against an owned property, and `{value_origin: 'local'}` against a writable orphan.
- Both share one predicate, `isUnsupportedOwnedPermissionsPair` in `entities/devices-virtual.entity.ts`, so they cannot drift. `ev` is not writability — it is a report channel, not a command one.

One consequence handled deliberately, the exact shape of §2.9's `claimProperty` note: a *writable projecting* property is perfectly legal, and both of `claimProperty`'s callers can reach one inside the `device_information` channel. Carrying its permissions across the claim would merge into a writable owned property and throw out of a listener — or out of the `afterCreate` hook — which is a self-inflicted outage rather than a guard. `claimProperty` now sends `permissions: [READ_ONLY]` when, and only when, the property it is claiming is writable; an already read-only one still has nothing but the two origin fields touched. Coherent besides: that channel's contents are read-only by definition, and the property is already being converted from projecting to owned.

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

### 2.11 `hidden` carries no provenance, so the auto-unhide cannot tell who set it (low) — DONE

`VirtualIndexMaintenanceListener.unhideAbandonedSources()` decides to patch on two facts: no virtual device references the source anymore, and the source is currently hidden. Neither says *why* it is hidden. A device the operator hid for their own reasons, which also happens to have been abandoned by a virtual device, is unhidden along with the rest.

This is not new — it is inherent to a boolean column with no owner — but round 7 widened the window it can happen in. The unhide is now queued by the pass that observes the abandonment and acted on by a later pass that has read committed state, so an operator PATCH landing in between (at most the repair delay plus one wait budget, and only after a wait that expired) is now clobberable where before only a millisecond-scale window was.

Fixing it means recording *who* hid the device — an enum or a nullable "hidden by virtual device id" column rather than a boolean — which is a schema and admin-UI decision, not a listener change. Worth doing if hiding ever gains a second automatic source.

**The second half, raised in round 8: an abandonment that commits before shutdown is unrecoverable.** The unhide is queued in memory and drained by a fire-and-forget pass. If the deletion or unlinking of the final reference commits but the process stops before that pass runs, the source stays hidden — and nothing afterwards can notice. `onApplicationBootstrap` rebuilds from an *empty* index, so `abandonedSourceDeviceIds` is structurally `[]` (the hook documents this); every later rebuild then compares an already-hydrated, reference-free index against the same state and reports no transition. The edge is gone permanently, and the automatic unhide never happens unless another reference is created and removed first.

**A durable queue cannot close it, and this is the reason the fix is provenance or nothing.** The abandonment is *derived* by a rebuild that must run strictly after the deleting transaction commits — that is the whole point of `deferPastOpenTransaction()`. So there is no point at which the intent could be recorded atomically with the deletion; any durable queue is written after the commit and has its own identical crash window, merely narrower. Only a reconciliation at startup can recover a lost edge, and a reconciliation needs to know which hidden devices were hidden *by* a virtual device.

**Assessed in round 8 and deliberately left open.** The obvious reconciliation — "unhide every hidden device that no virtual property references" — is wrong, and worse than the bug: `hidden` is also a plain operator choice, so it would destroy a deliberate setting on every boot. Doing it correctly needs provenance, and provenance currently has nowhere to come from:

- **Nothing in the backend ever sets `hidden = true`.** Grep the whole of `apps/backend/src`: the only writer is `unhideAbandonedSources()`, and it writes `false`. Hiding is exclusively a client `PATCH /devices/:id { hidden: true }`. The backend never performs the act whose provenance would be recorded.
- **There is no admin virtual-devices plugin yet** (`apps/admin/src/plugins/devices-virtual` does not exist), so the "hide the source this virtual device replaces" flow — the one thing that would carry provenance — is not implemented anywhere. The e2e stands in for it with a bare PATCH.
- Consequently a provenance column added today would have **no writer**. Every hidden row would migrate to "hidden by the operator", including exactly the rows the auto-unhide exists to serve, so the reconciliation would recover nothing while the schema, DTOs, OpenAPI, admin types and panel specs all churned. Giving it a writer means either designing a `hidden_by` API field for a client that does not exist yet, or having the plugin hide sources itself — which contradicts the spec's "*optionally* hide the source device".

The exposure in the meantime is bounded and recoverable: a source stranded this way is excluded from the four selection DTOs and from `?hidden=false`, but `GET /devices` still defaults to `all` so it is not invisible, and `PATCH /devices/:id { hidden: false }` is a documented field that restores it.

**Do this as part of the admin virtual-devices plugin**, which is where hiding will actually be driven from and which needs an unhide affordance regardless. At that point the column has a writer, the migration has a meaningful default, and a bootstrap reconciliation over rows marked "hidden by a virtual device" becomes both correct and cheap.

**Resolved — both halves — and provenance is precisely what made it safe.** `DeviceEntity.hiddenBy` (`DeviceHiddenBy.SYSTEM | USER | null`, added with the admin plugin's first task, exposed as `hidden_by` on both device DTOs) gave hiding an owner, and `VirtualIndexMaintenanceListener.reconcileSystemHiddenSources()` now runs once after the bootstrap hydration and unhides exactly those devices where `hiddenBy === SYSTEM` **and** the freshly hydrated index shows no virtual property referencing them. A lost edge is recovered from durable state — the column and the index — instead of from an in-memory transition that a restart destroys.

The provenance filter is not a refinement of the sweep; it is the only thing that makes a sweep permissible at all. Without it the reconciliation is the "unhide every hidden device nothing references" version assessed above, which reverses a deliberate operator setting on **every boot** — a worse and less recoverable failure than the stranded source it fixes. So `USER` is never touched, and neither is `null`: unknown provenance is not system provenance, which also means a source stranded *before* the column existed is deliberately not recovered (the migration backfills those rows to `user`, because nothing can tell them apart from a hide the operator meant). The unit suite pins this as its own case, and removing the filter fails it.

Three implementation details worth carrying forward:

- **The reconciliation reads the index, so it must not run when the hydration failed.** It sits inside the same `try` as `rebuild()`, so a rebuild that throws skips it — deliberately, because an empty index answers "nothing references anything" for every source in the system. The whole pass is separately contained and logged at error, and per device on top of that: `generate:openapi` boots the app against a schema-less database, and an `onApplicationBootstrap` that rejects kills the process.
- **`hidden_by` cannot be cleared through `UpdateDeviceDto`.** Its `@Transform` maps an explicit `null` to `undefined` — the null-means-field-absent convention every optional field on that DTO follows — and `DevicesService.update()` drops undefined keys, so no DTO value means "clear this". The unhide therefore issues a targeted `Repository<DeviceEntity>.update(id, { hiddenBy: null })` immediately after the patch. Second rather than first on purpose: the pair is not atomic, and `hidden = false` with a stale `hiddenBy` is cosmetic on a device the user can now see, whereas `hidden = true` with `hiddenBy = null` would be a hidden device this very reconciliation is then required to ignore forever.
- **Both unhide paths share one helper**, so the runtime abandonment path clears provenance too and the two cannot drift. The patch still echoes `enabled` back (§3.1) and still carries no placement field, so the hidden-device placement guard cannot refuse it.

**The first half is closed by the same rule.** `unhideAbandonedSources()` — the runtime path — now gates on `isSystemHidden()` as well, the single predicate both paths share. Observing an abandonment shows that *a* virtual device was drawing from the source; it does not show that the system is what hid it, and an operator who hid a physical device by hand must not lose that setting because an unrelated virtual device referencing it was deleted. The principle applies **more** strongly here than at startup, not less: this path runs on every structural change that drops a last reference, where the sweep runs once per process start, so an ungated version reverses a deliberate setting far more often — silently, unnotified, with nothing that would ever put it back. Pinned by `leaves a user-hidden source device hidden when its last virtual device is deleted`; removing the gate fails it.

**Residual, stated precisely: sources hidden *before* the provenance column existed will not auto-unhide.** The migration backfills every pre-existing hidden row to `user`, because nothing can distinguish those from a deliberate operator hide — so neither path will touch them. That is a bounded, visible and recoverable cost: such a device is still returned by `GET /devices` (which defaults to `hidden=all`) and is unhidden in one action from the admin's hidden-device list, versus the silent and irreversible cost of clobbering an operator's setting. It does not accumulate either: the admin's hide-the-source flow sends `hidden_by: system`, so every hide performed from here on is labelled correctly at the point of creation and auto-unhides normally.

### 2.12 `aggregateState()` treats an UNKNOWN source as offline, making the device uncommandable (medium) — DONE

Found in round 8, while fixing the configuration-time write. `VirtualStatusListener.aggregateState()` returns DISCONNECTED as soon as any source device's status is `!online`. A device that has simply never reported a connection state has `status: 'unknown'`, `online: false` — so a virtual device backed by it aggregates to DISCONNECTED, and `PropertyCommandService.processDeviceCommands()` refuses every command against a device that is offline. The virtual device is uncommandable, permanently, with nothing wrong anywhere.

This is a self-inconsistency, not a judgement call. Both the core command service and `VirtualDevicePlatform` itself (`!device.status.online && device.status.status !== ConnectionState.UNKNOWN`) deliberately treat UNKNOWN as commandable — "allow commands through if status is UNKNOWN (e.g. storage unavailable or no data)". Only the aggregation collapses it into DISCONNECTED, so the plugin's own platform would happily forward to a source it is never given the chance to see.

Confirmed directly: with a simulator source (the simulator plugin is disabled by default and so never reports a connection state), `VirtualDevicePlatform.processBatch()` returns `true` and moves the source's value when called directly, while the same command issued through the API is dropped with "Device is offline".

It stayed invisible because `ChannelsPropertiesService.update()` wrote the commanded value into the source's *own* series before dispatching anything — the round 8 P1 corruption — which made the e2e's "commanding the virtual property changes the source property's value" pass whether or not the command was ever dispatched. That test now reports the source connected through `DeviceConnectivityService` first, exactly as a real integration would, so it genuinely exercises the forward; the underlying gap is left for this follow-up rather than folded into a value-corruption fix.

Fix: give `aggregateState()` the same "definitively offline" predicate the other two use, and decide what a virtual device backed only by UNKNOWN sources should report — propagating UNKNOWN is the truthful answer and keeps it commandable, but it is a visible status change and belongs in its own change with its own tests.

**Resolved (round 9).** `aggregateState()` now reports the worst state over a three-value ordering — `DISCONNECTED (known broken) > UNKNOWN (nothing known) > CONNECTED (known good)`. An orphaned property and a definitively offline source both still force DISCONNECTED; only when nothing is known to be broken and at least one source is UNKNOWN does the device report UNKNOWN, which `PropertyCommandService` and `VirtualDevicePlatform` both accept as commandable. The e2e no longer has to report the source connected before commanding it: it asserts the device reads `unknown`, commands it in that state, and proves the forward by spying on the *source's* platform rather than only observing the source's value — the assertion that was previously passing on the round 8 corruption. Reverting the aggregation alone now fails four e2e cases, the command one among them.

## 3. Pre-existing issues found in passing

### 3.1 `DeviceEntity.enabled` has the class-field-initializer defect (medium) — DONE, by a different route

Same mechanism as the `hidden` and `valueOrigin` bugs fixed on the virtual-devices branch: the initializer survives `class-transformer`, so `DevicesService.update`'s `omitBy(toInstance(...), isUndefined)` yields `enabled: true` for a PATCH that omits it — silently re-enabling a disabled device on any unrelated update.

The fix was applied, proven and then **reverted**, because dropping the initializer makes `event.entity.enabled` read `undefined` in an `afterInsert` subscriber.

**Scope note:** the in-code comment at `devices.entity.ts:104-112` says "three device plugins" block this. That over-counts. Only **`devices-shelly-v1`** actually has the hazardous shape — `subscribers/device-entity.subscriber.ts:74` reads `event.entity.enabled` in `afterInsert` and passes it into `shellies-adapter.service.ts:232-238`, which assigns it straight into the in-memory registry. `devices-wled` and `devices-zigbee2mqtt` have no `afterInsert`; their `enabled` reads are on DB-loaded entities and would be unaffected. Fix shelly-v1's subscriber to re-read the row, then drop the initializer.

**Bit new code once already.** `VirtualIndexMaintenanceListener.unhideAbandonedSources()` patched `{type, hidden: false}` and thereby silently re-enabled a source device the user had explicitly disabled. That call now echoes `enabled` back explicitly, which is a local defence, not a fix — every future `DevicesService.update()` caller that omits `enabled` has the same problem, and only the root fix removes the trap.

**Resolved on the admin branch, without dropping any initializer.** The blocker recorded above applies only to the *drop the initializer* fix. `DevicesService.update()` now restricts `updateFields` to the properties the request actually carried, so a survivor can no longer reach `Object.assign` in the first place — initializers stay exactly where they are, and `devices-shelly-v1`'s `afterInsert` subscriber is untouched. Field initializers are now inert for updates across the board, so `password`/`hostname` (shelly-v1), `password` (shelly-ng), `hostname` (wled), `variant` (reterminal) and `canonicalMac`/`hasEthernet` (shelly-ng) stop leaking too — several of which were never listed here.

The admin change that exposed it is worth recording: the admin used to resend the entire cached device on every PATCH, which masked this defect completely. Once `devicesStore.edit()` began sending genuinely partial bodies, the branch's own hide-the-source call (`{type, hidden, hiddenBy}`) would have wiped a Shelly 4PM's stored `password`. Two implementation notes for whoever touches `update()` next, both documented at the fix site: DTO key casing is **not** uniform (the base DTO spells `hidden_by` directly, while `UpdateShellyNgDeviceDto` uses `wifiAddress` with an `@Expose({ name })` override), so the provided-key set has to be normalised rather than compared raw; and the tempting one-liner — passing `exposeUnsetFields: true` so `omitBy(isUndefined)` does the work — throws on every plugin subclass, because `DeviceEntity.zoneIds` is a getter-only property declared once on the base and class-transformer's read-only guard does an own-property lookup that never walks the prototype chain.

Still worth doing eventually: fix shelly-v1's subscriber to re-read the row and drop the initializers anyway, so creation stops depending on them.

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

## 3a. Deferred from the admin branch

Raised by reviews of the admin implementation, each verified against the code and triaged as non-blocking for that branch.

### 3a.1 `hidden_by` cannot express `null` on either side (medium)

Nothing can currently send an explicit `hidden_by: null`, so **an admin-side unhide action cannot be built until this is fixed**. Three layers disagree:

- `DeviceUpdateReqSchema.hidden_by` (`apps/admin/src/modules/devices/store/devices.store.schemas.ts`) is `.optional()` but not `.nullable()`. Adding `.nullable()` breaks assignability to `ZodType<ApiUpdateDevice>`, because openapi-typescript drops `| null` from enum-referencing properties — the same generator quirk already documented on `DeviceResSchema.hidden_by`.
- `UpdateDeviceDto.hidden_by` (`apps/backend/src/modules/devices/dto/update-device.dto.ts:112`) carries `@Transform(({ value }) => (value === null ? undefined : value))`, so the backend reads an explicit `null` as "not provided" regardless.
- `spec/api/v1/openapi.json` nonetheless advertises `nullable: true` for the field, so the published contract is wrong.

Unhiding works today only as a backend side effect of deleting the last referencing virtual device. A user who hides a device themselves has no way back from the UI.

### 3a.2 The channel and property stores still merge-then-send (medium)

`channels.store.ts` and `channels.properties.store.ts` have the same shape `devices.store.ts` was fixed for: `edit()` merges the whole cached record before validating and sends the result. Deliberately left alone to bound the blast radius of the device fix. Consequence: the remap dialog resends the property's cached `value` on every remap, so a value that changed underneath is written back stale. No `hidden_by`-class throw exists in either store, so nothing is broken today.

### 3a.3 Five duplicated `useDeviceEditForm.submit()` implementations (medium)

The shared composable plus `devices-wled`, `devices-shelly-v1`, `devices-shelly-ng` and `devices-reterminal` each reimplement `submit()`. A single fix had to be applied five times, and the four plugin copies were missed on the first pass. `devices-zigbee2mqtt` correctly has no `roomId` in its model. Consolidating is worthwhile — but note the room-omission fix belongs at the store layer regardless, so deduplicating alone would not have prevented that bug.

### 3a.4 The `devices-virtual` route is registered unconditionally (low)

The wizard launcher in the devices list is gated on `enabled('devices-virtual')`, matching the sibling discovery-wizard button, but the route itself is registered with no such check — `enabled()` is async config state not available at `install()` time. Typing the URL with the plugin disabled still reaches the wizard. A `beforeEnter` guard is the only real option. Sibling wizard routes are ungated too, so this is consistent rather than novel.

### 3a.5 Onboarding treats `devices-virtual` as a discoverable integration (low — destructive half fixed)

`step-integrations.vue` selects device plugins with `ext.type.startsWith('devices-')`, which `devices-virtual` matches, so it is offered the discovery affordance ("scanning…") for a plugin that can never discover anything.

The destructive half is **fixed**: toggling it off ran `removePluginDevices` against type `virtual` and deleted every virtual device the user had built. `removePluginDevices` now returns early for `NON_DISCOVERABLE_PLUGINS`, since that cleanup is a cache-clear for plugins that rediscover their own hardware and unrecoverable data loss for ones whose devices are hand-authored. What remains is only cosmetic: the 30-second "discovering…" countdown a virtual plugin will never satisfy.

### 3a.11 A hidden or deleted device leaves its channels in the panel (low, pre-existing)

`DevicesRepository.delete()` removes the device row and nothing else, so `ChannelsRepository` keeps that device's channels — and, transitively, `ChannelPropertiesRepository` keeps their properties. This predates virtual devices (it is what `DEVICE_DELETED` has always done), but hiding gives it a second, more frequent trigger: every source device a virtual device replaces now leaves its channels behind in a running panel.

Nothing renders them today, because every consumer starts from a device. Fixing it means cascading the removal through two more repositories, which is a change to shared panel state that ought to be made deliberately rather than as a side effect of this feature.

### 3a.12 Aggregations count a source and its virtual replacement twice (medium)

`SecurityAggregatorService` and the two security providers read `devicesService.findAll()`, which deliberately still returns hidden devices — internal logic should see the whole installation. A virtual device projecting a contact sensor therefore appears alongside the physical sensor it mirrors, and both contribute to the same aggregate.

For boolean roll-ups (is anything triggered) the duplicate is harmless. For anything that counts, it is not. The same question applies to `BuddyContextService`, which describes the installation to an assistant that will now see two devices where the operator sees one.

Deciding this needs a policy — does an aggregate prefer the physical device, the virtual one, or neither — and that policy belongs with whoever owns the security and energy semantics, not with the mapping feature that surfaced it.

### 3a.6 Test-coverage gaps (low)

- `view-device.vue`'s virtual-device mount gate has no behavioural test; `view-devices.spec.ts` has a usable template for one.
- `devices-virtual.plugin.spec.ts`'s schema-registration test mocks all three schemas as deep-equal `{}`, so it proves the keys exist but not that the right schema is wired. The real pin is the remap dialog's wire-level test.
- The remap dialog's `canConfirm` "property is gone" term is never isolated from its "no selection" term, so the reactive mid-dialog deletion path (via the `CHANNEL_PROPERTY_DELETED` websocket handler) is untested.
- The mapping step's `pickers` reset on external `modelValue` replacement has no discriminating test.

### 3a.7 Mapping-step UI polish (low)

Optional slot groups expand but never re-collapse, which is awkward for categories with large spec surfaces (`sensor` expands to 102 slots). The property picker sorts by raw category but displays the translated label, so ordering is not alphabetical in non-English locales.

### 3a.8 Two heavy specs carry a per-file `testTimeout` (low)

`virtual-wizard-mapping-step.spec.ts` and `view-virtual-device-wizard.spec.ts` raise `testTimeout` to 15s because they crossed vitest's 5s default under full-suite parallelism — timeouts only, no assertion failures, and only those two files. The next comparably heavy spec will need the same patch; a config-level default would be more durable.

### 3a.9 Core module views import from the plugin directory (low)

`view-device.vue` and `view-devices.vue` both import from `plugins/devices-virtual/**`. This follows the existing `modules/onboarding` → `plugins/weather-open-meteo` precedent and is commented as deliberate, but the devices module still has no `deviceDetail` extension point, which is why the imports exist at all.

### 3a.10 Compatibility is now enforced at persistence, not only previewed — DONE

Superseded §4's "`assertPermissionsCompatible` is intentionally unwired", which is why that entry is gone.

The original reasoning held that the rule could not be a DTO constraint, because the target spec slot's required permissions depend on the channel category and a property DTO cannot resolve it. That part still stands. What it missed is that the *persistence hooks* are not DTOs: `beforeCreate` is handed the channel id and `beforeUpdate` sees the merged row, so both can resolve the slot the DTO could not.

The gap was real. The wizard's preview is not atomic with the write it precedes, a source's permissions or data type can change in between, and a direct API call or a remap skips the preview entirely — so an incompatible projection could be stored and would fail only later, when a command was forwarded to a source that could not accept it.

`VirtualDevicesService.assertProjectionCompatible` now resolves channel → device → source property and asks `reportCompatibility`, and both hooks call it. The rules still live in exactly one place; the assertion resolves the slot and asks, rather than restating permissions or data types. Only projections are judged: an owned (`local`) property has no source, and a projection whose source is null is an orphan the device degrades into — refusing that would make an orphaned property impossible to remap back into shape, which is precisely what the remap flow exists to do.

Known shortfall, worth a follow-up: on the **nested** device-create path the guard's reason does not reach the client — that path reports its own generic "Device could not be created" envelope for every nested failure, not just this one. The single-property create and update paths are unaffected in kind (this suite asserts status rather than message throughout). The wizard previews compatibility, so an operator reaching this in practice is rare, but the message is the thing that would tell them why.

## 4. Not to be done

*(`assertPermissionsCompatible`'s entry moved to §3a.10 — it is now enforced at persistence. Its original point, that the rule cannot be a DTO constraint because the spec slot is not resolvable from a property DTO in isolation, still holds and is why the hooks own it instead.)*
