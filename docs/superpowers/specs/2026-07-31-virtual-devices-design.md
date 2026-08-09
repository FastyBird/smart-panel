# Virtual Devices — Design

**Status:** Approved
**Date:** 2026-07-31
**Author:** Adam Kadlec
**Related:** `tasks/archive/EPIC-VIRTUAL-DEVICES.md` (supersedes its key architectural decisions), `tasks/features/FEATURE-DEVICE-SPLITTER-PLUGIN.md`, `tasks/features/FEATURE-DEVICE-COMPOSITE-PLUGIN.md`

## Problem

Many physical devices expose several independent channels. A Shelly Plus 4PM has four relays that may drive four loads in four different rooms. Today the device is one unit: `DeviceEntity.roomId` is a single nullable FK (`devices.entity.ts:129`), so the whole 4PM lives in one room with one category.

The inverse problem also exists. A Shelly 1PM relay plus a Zigbee temperature sensor together describe a heating device, but there is no way to present them as one.

## Goal

A `devices-virtual` plugin that lets a user build a device from properties of other devices — splitting one physical device into several, or composing one logical device from several — such that the result is indistinguishable from a native device to every existing consumer.

## Non-Goals

- **Closed-loop control.** Virtual devices are wiring, not behaviour. See [v1 category boundary](#v1-category-boundary).
- **Computed or aggregated values.** Every linked property is 1:1 with its source. No averaging, inversion or scaling.
- **Channel-level room assignment.** Rejected — see [Rejected: channel-level rooms](#rejected-channel-level-rooms).
- **Panel-side creation.** Admin only.
- **New device specs.** Uses the existing `spec/devices/` definitions.

## Prior art in this repo, and why it doesn't work

`EPIC-VIRTUAL-DEVICES.md` decision #2 specifies *"Channel mapping, not duplication. No channel/property copying. Commands target the same property IDs."* Call this the **alias** approach: the virtual device holds only mapping rows, and its channels and properties are projections computed at read time with derived IDs.

It does not survive contact with the codebase.

**Client stores collapse.** `apps/admin/src/modules/devices/store/channels.store.ts:97` filters `channel.device === deviceId`, and the store is keyed by channel `id`. If `GET /devices/:virtualId` returns the source's channel objects unchanged, they file under the source device and the virtual device shows no channels. If the response rewrites `device` to the virtual ID, the same channel ID claims two parents in one store and the source device breaks instead. The panel repositories behave the same way. Either way one device loses its channels. Same problem one level down for `property.channel`.

**Foreign keys reject derived IDs outright.** This is decisive. Seven entity types hold real `ManyToOne` constraints to `DeviceEntity`/`ChannelEntity`/`ChannelPropertyEntity` with `onDelete: CASCADE`:

| Entity | Constrains |
|---|---|
| `data-sources-device-channel` | Device + Channel + Property (`…entity.ts:31,49,70`) |
| `tiles-device-preview` | Device (`:31`) |
| `pages-device-detail` | Device (`:31`) |
| `space-lighting-role` | Device + Channel (`:41,:60`) |
| `space-climate-role` | Device + Channel |
| `space-sensor-role` | Device + Channel |
| `space-covers-role` | Device + Channel |

A derived ID has no row, so the database rejects the insert. Under the alias approach a virtual device could not be placed on a tile, given a detail page, used as a data source, or assigned a lighting/climate/sensor/covers role. Making it work would mean dropping those FKs across seven entities and hand-rolling cascade cleanup. `scenes-local` shows that world: `channelId`/`propertyId` are plain columns with no FK (`scenes-local.entity.ts:44,:60`), so it would accept an alias ID and then dangle silently.

**Further translation points**, each a silent per-feature failure:

- `channels.controller.ts:66,96` — `GET /channels` and `GET /channels/:id` are not device-scoped; they hit the repository directly, so an alias ID 404s.
- `property-command.service.ts:215` — `channelsService.findOne(command.channel, device.id)` is device-scoped; an alias channel is not a row, so commands die before reaching the platform.
- `channel-property-entity.subscriber.ts:46` — `afterLoad` resolves `unit` from `channel.category` and the value from `entity.id`. An alias needs the *source* ID for the value but the *overridden* category for the unit, so projection logic must re-run at every load site.
- `websocket.gateway.ts:59,303` — `eventEmitter.onAny(...)` rebroadcasts every bus event verbatim, filtered only by adapter prefixes. Clients holding an alias never see their own property change.
- Cross-plugin validators resolve by repository lookup and reject alias IDs: `data-sources-device-channel/validators/channel-property-exists-constraint.validator.ts:32`, `device-channel-exists-constraint.validator.ts:42`.

**The structural objection.** Aliasing puts identity in a convention rather than in the database, while the entire extension model — FKs, validators, type mappers, the `onAny` fan-out — assumes IDs are rows. Every future plugin that resolves an ID by lookup would break, silently. On a plugin platform that cost never ends.

Aliasing does have one real advantage worth preserving: values and history live once, so `energy-ingestion.listener.ts:62` cannot double-count. The chosen design keeps that property by other means.

## How Home Assistant solves it

HA never aliases, and it splits the problem in two.

**The multi-room case is solved in the registry.** `RegistryEntry` carries `area_id: str | None = attr.ib(default=None)` — an entity-level area defaulting to the device's. A four-channel relay needs no helper at all.

**Category remap and composition create real new entities.**

- `switch_as_x` creates a new entity with its own `unique_id`, references the source by `entity_id` in config options, hides the original (`hidden_by == er.RegistryEntryHider.INTEGRATION`, unhidden on removal), and inherits the source's `device_id` via `async_get_parent_device_id`. It mirrors state through `async_track_state_change_event` → `async_write_ha_state()` and forwards commands as service calls.
- `generic_thermostat` — the composition case — is a real climate entity with its own `unique_id` holding `heater_entity_id` and `sensor_entity_id` as plain strings, tracking the sensor via `async_track_state_change_event` and commanding the heater through `hass.services.async_call`. It also implements the control algorithm, with hysteresis and `min_cycle_duration`.

So HA is *owned entities + forward + mirror*, plus a hidden flag — which the epic had already proposed independently.

Two caveats on transferring this. An HA entity is a runtime object in a state machine, so minting one is cheap; Smart Panel channels and properties are TypeORM rows with FKs, so the same move costs more here. And HA's recorder stores history for both source and wrapper, which is why its energy dashboard makes you hand-pick sensors — a duplication this design avoids.

## Approach

**Map with dereferenced values.** The virtual device owns real `ChannelEntity`/`ChannelPropertyEntity` rows with genuine UUIDs and real FKs, so every existing consumer works untouched. Each linked property records its source, and `PropertyValueService` *reads* under the source key, so a value and its history are stored exactly once — written by the source itself, and by nothing else (see "Delete must not dereference" / "Write must not dereference either" below).

This takes the row-based identity the app assumes, and the single-series storage that aliasing would have given, without either downside.

### Rejected: channel-level rooms

Adding `roomId` to `ChannelEntity` — HA's approach — was considered and rejected. The domain layer aggregates across a device's channels: `space-climate-state.service.ts:581` reaches for `TEMPERATURE`, `HUMIDITY`, `HEATER`, `COOLER`, `THERMOSTAT` and `FAN` channels *within one device*. The four space role tables key on `(spaceId, deviceId, channelId)` with FKs to both. Moving the unit of assignment to the channel would require re-aggregating every domain over arbitrary channel sets per room — the composition problem again, with nothing to hang it on.

The converse is the stronger argument: **a composed virtual device is exactly the reassembly unit those services already expect.** A virtual climate device built from a Zigbee sensor and a Shelly relay hands `extractClimateChannels` one device with a temperature channel and a heater channel, and the existing domain code works unchanged.

## Data model

One plugin across three apps, following `devices-third-party`:

```
apps/backend/src/plugins/devices-virtual/
apps/admin/src/plugins/devices-virtual/
apps/panel/lib/plugins/devices-virtual/
```

All three entities are STI children, so their columns land on the existing `devices_module_*` tables — as `ThirdPartyDeviceEntity.serviceAddress` already does.

```
VirtualDeviceEntity          extends DeviceEntity           type = 'virtual'
VirtualChannelEntity         extends ChannelEntity          type = 'virtual'
VirtualChannelPropertyEntity extends ChannelPropertyEntity  type = 'virtual'
   ├─ valueOrigin: 'source' | 'local'   NOT NULL
   └─ sourcePropertyId: uuid | null     FK → channels_properties, ON DELETE SET NULL
```

There is deliberately **no parent-device column**. Sources are derived from the properties, so splitting is composing where every source resolves to one device — one code path, not two.

The two columns yield three states, which is what makes degradation expressible:

| `valueOrigin` | `sourcePropertyId` | State |
|---|---|---|
| `source` | set | **Linked** — value read from the source |
| `source` | `null` | **Orphaned** — source deleted; degrade and prompt to remap |
| `local` | `null` | **Owned** — synthesized `device_information` (and future setpoints) |

`SET NULL` rather than `CASCADE` is what keeps the device alive when a source vanishes. Without `valueOrigin` an orphan is indistinguishable from an intentionally-owned property, and validation would report a dead required property as satisfied.

## Core changes

Three additions to the devices module, all generic — core never learns the word *virtual*.

### 1. `DeviceEntity.hidden`

Boolean, default `false`, with migration. Adds `?hidden=true|false|all` to `GET /devices` (default `all` for compatibility) and a `ValidateDeviceNotHidden` constraint for selection DTOs. As the epic specified; HA does the same via `RegistryEntryHider.INTEGRATION`.

### 2. `PropertyValueSourceRegistry`

Sits beside `PlatformRegistryService` with the same shape — one registers *where writes go*, the other *where values live*. The codebase already has roughly twenty such registries (`SpaceRelationsLoaderRegistryService`, `TileCreateBuilderRegistryService`, `WeatherProviderRegistryService`, `StatsRegistryService`, …), so this is the house pattern.

```ts
export interface IPropertyValueSource {
	getType(): string; // entity discriminator
	resolve(property: ChannelPropertyEntity): string | null; // storage key, null → property.id
}
```

`PropertyValueService.readLatest` and `PropertyTimeseriesService` — the two read paths — key on `resolve(p) ?? p.id`. The `valuesMap` and `recentValuesMap` caches collapse onto the source key for free, so a linked property and its source share one cache entry and one computed trend. The two *write* paths, `PropertyValueService.write` and `.delete`, resolve the same key only to refuse when it is not the property's own; see the two rules below.

**Delete must not dereference.** Without this rule, deleting a virtual device wipes the source device's entire history:

```ts
const key = resolve(property);
if (key !== null && key !== property.id) return; // never delete another property's series
```

Linked properties own no series, so deleting them is correctly a no-op; owned properties delete their own.

**Write must not dereference either.** The same rule, and the same reason, on the other side. Only `readLatest` dereferences: a linked property *reads* the source's series, and the source's own reports are what write it. A write pushed *through* the projection would be persisted as a real measurement of a device that was never commanded and never reported it — corrupting the source's latest value, its trend and its history with a number no hardware produced.

```ts
const key = resolve(property);
if (key !== property.id) return false; // never write into another property's series
```

Nothing legitimate is lost, because no write ever legitimately arrives through a projection. A source device reports on its own property, where the key already *is* its own id. A command issued against a projection is forwarded to the source device's platform (`VirtualDevicePlatform`), which makes the source report it back the same way; only the optimistic local echo is dropped. And a value supplied while *configuring* a projection has no reporter behind it at all — `ChannelsPropertiesService.create()` refuses that outright rather than letting it reach here, since on create there is no command it could have meant instead.

### 3. `VirtualDevicePlatform implements IDevicePlatform`

`getType() = 'virtual'`. `processBatch`:

1. Rejects orphaned properties — `"source no longer available"`.
2. Writes owned properties directly.
3. For linked properties: resolves source property → channel → device, groups by source device, checks each source's online state, and dispatches to `PlatformRegistryService.get(sourceDevice).processBatch(...)`.
4. Rejects a source device of `type='virtual'` — nesting is forbidden at creation; this is the backstop.

### Aggregation guard

`energy-ingestion.listener.ts:71` ingests any `consumption`/`production`/`grid_import`/`grid_export` property regardless of assignment. It and `security-state.listener` skip properties the registry resolves, since they already saw the source.

Consequence, stated plainly: energy for a split device attributes to the **physical parent's** room, not the virtual device's. This is not a regression — a 4PM's four loads already sit in four rooms today and energy cannot express that either. Per-channel energy attribution is separate work.

The four `spaces-home-control` listeners get **no** guard. They react via explicit user-assigned `(spaceId, deviceId, channelId)` roles, so a hidden unassigned source is already ignored, and the virtual device is the one that should drive space state.

## Data flow

### Read — no changes anywhere

`GET /devices/:id` runs the normal `DevicesService.findOne`; channels are real rows with a real FK. Then `channel-property-entity.subscriber.ts:46` does the rest:

- `entity.unit = resolveUnitFromSpec(entity)` keys off `channel.category`, which for a virtual channel *is* the spec slot's category — correct by construction, which is precisely what the alias approach had to fight.
- `entity.value = readLatest(entity)` resolves to `sourcePropertyId` and returns the source's value.

Tiles, data sources, space roles, device-detail pages and `GET /channels/:id` are untouched.

### Write — one hop through the existing contract

`PropertyCommandService.processDeviceCommands` needs no changes: `findOne(device)`, `findOne(channel, device.id)` and `findOne(property, channel.id)` all hit real rows owned by the virtual device. It resolves `VirtualDevicePlatform` and calls `processBatch`, which forwards as above. The source plugin then writes to hardware and stores the value exactly as today.

### Events — the one new mechanism

A source write emits `CHANNEL_PROPERTY_VALUE_SET(sourceProperty)`, which the gateway broadcasts verbatim. Clients update the *source* property; the virtual property they are displaying goes stale. So the plugin adds a projection listener:

```
@OnEvent(CHANNEL_PROPERTY_VALUE_SET)
handle(sourceProperty):
    for each virtual property linked to sourceProperty.id:
        emit CHANNEL_PROPERTY_VALUE_SET(virtualProperty)
```

Where the re-emitted event lands:

| Consumer | Result |
|---|---|
| WS gateway | clients update the virtual property |
| `energy` / `security` | skipped by the projection guard |
| `spaces-home-control` ×4 | drives space state for the virtual device — wanted |
| `buddy` context cache | invalidates; harmless |

Two requirements:

- **In-memory index, not a query.** This fires on every property value change in the system, so the plugin keeps `sourcePropertyId → virtualProperty[]` hydrated at startup and maintained on virtual-device CRUD. Value lookup is already a cache hit because deref collapses both properties onto one `valuesMap` key.
- **No recursion.** A projected event re-enters the listener, but since nesting is rejected at creation no virtual property is ever a `sourcePropertyId`, so the lookup returns empty and it terminates.

### Connection status

Aggregated over the distinct source devices — online only when all are online, as the epic specified for combined devices. Any orphaned property forces degraded. A virtual device with only owned properties is always online. Driven by `@OnEvent(DEVICE_CONNECTION_CHANGED)` over a second source-device → virtual-device index. This also makes `PropertyCommandService`'s existing check at `property-command.service.ts:198` gate virtual commands sensibly, ahead of the platform's per-source check.

## v1 category boundary

A channel needs closed-loop control when it has a writable `on` **plus a required writable target for a sensed quantity** — something the actuator cannot set directly. Brightness, speed and position are directly actuated and do not qualify. Derived from `spec/`:

```
closed-loop channels:  cooler → temperature    heater → temperature
                       humidifier → humidity   dehumidifier → humidity
```

**Blocked in v1** — spec *requires* one of those channels: `air_conditioner`, `air_dehumidifier`, `air_humidifier`, `heating_unit`, `water_heater`. Also `thermostat`: heater and cooler are optional there, so it would technically validate, but a thermostat with neither is a thermometer wearing a badge.

Blocked categories are filtered from the wizard with *"needs a controller — planned for a later release"*, and rejected server-side.

**The primary use case is unaffected.** `light`, `switcher` and `outlet` each require exactly one property — `on(bool,rw)` — so a 4PM relay's `on` satisfies all three. Splitting a 4PM into four devices across four rooms with independent categories is fully served by v1.

`device_information` requires `manufacturer`, `model` and `serial_number`, all `ro` strings. These are the synthesized owned properties, and in v1 they are the **only** owned properties, which keeps the wizard to pure wiring.

## Creation flow

1. Pick target category — blocked ones filtered out.
2. `getAllowedChannels(category)` gives channel slots; `getAllProperties(channelCategory)` gives property slots, required first.
3. Map each slot to a source property, filtered by data type and permissions — an `rw` slot needs an `rw` source, `ro` accepts either. The `device_information` channel is exempt: it is synthesized automatically as owned properties and is never presented for mapping.
4. Shortcut *"take this whole channel"*: pick a source channel and the wizard expands it into per-property links against a chosen slot. This is the split flow, with no second data model.
5. Name, room, zones.
6. ~~Live validation preview via `DeviceValidationService.validateDeviceStructure`.~~ **Superseded during implementation.** Readiness is derived from the specification directly — every required slot filled, plus the constraint alerts a slot count cannot express — and each individual pairing is verified against `POST /plugins/devices-virtual/devices/compatibility`, which judges what `validateDeviceStructure` never looks at: the source's data type, permissions, format and sentinel against the slot's. A structural preview would have answered a question the wizard's own gate already answers, while staying silent on the one that actually refuses a create. Structure is still validated server-side on create, and the device list surfaces the stored validation state afterwards.
7. Create, then optionally hide the source device(s).

A source property may feed more than one virtual device — one sensor legitimately serves two rooms' climate. ~~The energy guard skips projections wholesale, so this cannot double-count~~ **Out of date:** the guard was narrowed and then replaced. `BUG-ENERGY-VIRTUAL-ROOM-ATTRIBUTION` gives a projected meter one accountable claimant, enforced by a partial unique index, and the ingestion counts the event that holds it; a second projection of one meter is refused at persistence rather than skipped at ingestion. What this sentence was right about is the principle — a *reading* may be presented twice, and energy is the exception because it is additive.

## Degradation and lifecycle

Source property deleted → FK sets `sourcePropertyId` to `null` → property becomes orphaned:

- connection status aggregation forces the device `DISCONNECTED` — an orphaned property fails the aggregate check (see [Connection status](#connection-status)). `DeviceValidationService` does **not** catch this: `validateChannelProperties` builds its set of existing property categories from structural presence only (`device-validation.service.ts:554-595`), with no awareness of `isOrphaned` or `sourceProperty`. The row still exists with the correct category, so `MISSING_PROPERTY` never fires for an orphan
- admin shows a warning with a *remap* action
- panel renders the device unavailable
- writes rejected

Deleting the last virtual device referencing a hidden source auto-unhides it, per the epic's rule.

Channel UUIDs are stable across re-discovery — `devices-shelly-ng/services/device-manager.service.ts:336` upserts via `ensureChannel(device, 'identifier', 'switch:0', …)` against `@Unique(['identifier', 'device'])` — so re-provisioning does not orphan mappings. Genuine removals and mode changes (relay → cover) still do.

## Error handling

| Condition | Behaviour |
|---|---|
| Write to orphaned property | rejected, `"source no longer available"` |
| Source device offline | existing `"Device is offline"` path |
| Source `ro`, slot needs `rw` | blocked at creation by the wizard filter |
| Virtual sourcing a virtual | rejected at creation; platform check as backstop |
| Blocked category | not offered; rejected server-side |

## Admin and Panel

**Admin** — standard plugin trio (schemas, stores, forms, six locales) plus the wizard. `hidden` filter on the device list with a *"Show hidden"* toggle and a badge. Hidden devices excluded from the space, tile and data-source pickers.

**Panel** — models, mappers and `plugin.dart`; registration only. Virtual devices render through the existing category-based detail pages because their category and channel structure genuinely match the spec.

## Testing

**Backend unit** — registry resolution; delete not dereferencing (the data-loss guard); platform forwarding and grouping by source device; orphan and nesting rejection; status aggregation; projection-listener fan-out and index maintenance; energy and security guards.

**Backend E2E** — create a split from a simulator device, command it, assert the *source* property changed; delete a source property and assert the device degrades rather than disappears.

**Admin** — wizard component tests.

## Follow-ups

### Controller support

Unblocks all six categories listed in [v1 category boundary](#v1-category-boundary). It needs a control loop with hysteresis and minimum cycle protection, plus user-settable setpoints as owned properties — the schema already accommodates the latter.

It is deliberately not filed as a task: a control loop touches safety, concurrency and the platform's command path, so it starts with a design. What follows is what a design has to answer, gathered from review of a draft that tried to specify it (PR #645, where the reasoning behind each point is recorded). None of it is a decision — the point is that none of it is discovered late.

**What the specification forces.** `heater` and `cooler` each require `on(bool,rw)`, `temperature(float,rw)` *and* `status(bool,ro)`, all three `required: true`, so `heating_unit`, `water_heater` and `air_conditioner` fail structural validation without a `status` no source device supplies — the controller either synthesizes it from its own decision or takes it as another mapping. The humidity channels are a different shape: `humidifier.status` and `dehumidifier.status` are optional and typed `enum` (`["idle","humidifying"]`, `["idle","dehumidifying","defrosting"]`), so a boolean synthesized there fails validation rather than satisfying it. `thermostat` needs an invariant of its own, since `heater` and `cooler` are both optional on it and a thermostat with neither is a thermometer wearing a badge — nothing structural catches that.

**The exposed `on` is the user's switch, not the controller's output.** `SpaceClimateStateService.detectClimateModeAndActivity()` reads `on` as *enabled* — "even if not actively working" — and `status` as currently working. A loop driving the exposed `on` would make an enabled heater read OFF the moment it reached setpoint, and would overwrite an explicit OFF on the next event. Three things are needed where v1 has two: the enable the user owns, the activity the loop reports, and the actuator write, which goes to a projected relay and is not a slot of the virtual device at all.

**That actuator has nowhere to live yet.** A mapping today is only `VirtualChannelPropertyEntity.sourcePropertyId` — a property *of* the virtual device pointing at a source — so an actuator that is not a slot has no row and would not survive a restart. Whatever holds it must also be visible wherever `sourcePropertyId` is: `unhideAbandonedSources` decides a source is abandoned by finding nothing that references it, so a relay reachable only through a new column would be auto-unhidden on the next restart, and connection changes on it would not reach the virtual device's status. It must be exclusive, too — the FK binds a channel to one actuator, not an actuator to one channel, and two loops on one relay contradict each other by construction.

**The loop's inputs are more than the sensor.** A sensed-value report, a write to the setpoint, a write to `on`, and a connection change on the actuator's or sensor's device — an actuator that dropped offline while energised never received the release, and on reconnect nothing else has changed, so no other trigger fires. Platforms that acknowledge asynchronously (Home Assistant among them) report their eventual state through a value event that has to count as well, which also means the actuator must be *readable*: the permission model treats `wo` and `rw` alike, and a write-only relay gives the confirmation rule below nothing to confirm against. A periodic tick backstops hardware that goes quiet without saying so, and it is not a re-run of the same decision — a reading older than a freshness window is not evidence, so the tick releases rather than holds.

**Evaluations serialise per device, not per loop.** Triggers arrive together, Nest runs handlers concurrently, and two evaluations reading the same pre-write state dispatch contradictory commands whose completion order decides the relay. Per-loop serialisation is worse than none in one respect: a heater and a cooler evaluating at once each see the other inactive and each energise, which is the interlock being bypassed by the mechanism meant to enforce it. That interlock belongs to the device and applies by shape, not by category name — an `air_conditioner` with its optional heater mapped has the same two opposed actuators a thermostat does.

**State follows the actuator, not the decision.** `status` and the cycle timestamps are committed on the actuator's confirmed result. A controller recording its intention reports the unit idle while the relay is still energised after a failed release, and suppresses the retry, because by its own account there is nothing left to do. Cycle state has to survive a restart as well — protection kept only in memory is no protection — either by being durable or by reconstruction from the actuator's confirmed state and timestamp.

**The setpoint needs a command path, not just a relaxed guard.** The panel and the space climate intents do not PATCH a property: they call `VirtualDevicePlatform.processBatch()` (`climate-intent.service.ts:464`, `:704`), and the platform refuses every `LOCAL` property outright (`virtual-device.platform.ts:64`). Relaxing `assertOwnedPropertyNotWritable` alone leaves the ordinary climate controls unable to move either the setpoint or the enable.
**How to pick this up.** The paragraphs above are constraints, not an order of work. What is missing before code is a design document that answers them; these are the decisions it turns on, in the order they unblock each other.

1. **Where the actuator mapping lives — first, because it decides the schema.** Everything else is written against it. It has to survive a restart; it has to be exclusive **in the direction a foreign key does not give you** — at most one controlled channel per *actuator*, since an FK binds a channel to one relay while leaving a relay free to be bound by several, and two loops on one relay contradict each other by construction; and it has to be visible to `unhideAbandonedSources`, which decides a source is abandoned by finding nothing that references it — a relay reachable only through a column that sweep does not read is auto-unhidden on the next start, and connection changes on it never reach the virtual device's status.
2. **What `status` is.** The three thermal categories require a boolean `status(ro)` no source device supplies; the two humidity categories type theirs as an optional `enum`, so a synthesized boolean fails validation rather than satisfying it. Either take it as another mapping, or synthesize it — and if synthesized, from the actuator's **confirmed** state, never from the loop's decision: a controller recording its intention reports the unit idle while the relay is still energised after a failed release, and suppresses the retry, which is the invariant "state follows the actuator" exists to protect. The choice changes what a "ready" device means in the wizard.
3. **How a command reaches the setpoint.** `VirtualDevicePlatform.processBatch()` refuses every `LOCAL` property outright, and the panel and climate intents go through it rather than PATCHing. Relaxing `assertOwnedPropertyNotWritable` alone leaves the ordinary climate controls unable to move either the setpoint or the enable.
4. **What else may write to a claimed actuator.** Exclusivity against a second *controller* is not exclusivity against a second *writer*, and the relay has other ones. This design deliberately lets one source property feed several virtual devices, so nothing above stops a virtual switch or outlet from projecting the same relay's `on` and exposing it as an ordinary toggle; and a stored scene action commands the physical property directly — `@ValidateDeviceNotHidden` refuses a *new* reference to a hidden device and leaves existing ones executing (§3a.14). Both bypass the loop's serialisation entirely: either can energise a relay the controller believes it released, or start a cooler while its opposed heater is running, which is the interlock defeated from outside the mechanism enforcing it. So the claim has to either **withhold the property from every other writable reference and command path**, or those paths have to be **mediated** — routed through whatever owns the actuator — and the choice is not obvious: withholding breaks the "one source, many virtual devices" principle for exactly one kind of property, while mediating means the controller becomes a command path other modules have to know about.
5. **What serialises, and around what.** Per *device*, not per loop — a heater and a cooler evaluating concurrently each see the other inactive and each energise. `DeviceStructureLockService` is the existing shape to borrow from, not necessarily the instance. Note this only serialises what goes through it, which is what makes 4 a prerequisite rather than a detail.

**Machinery that already exists, and what it cost to get right.** Decision 1 — an exclusive, durable mapping that sweeps can see — is very nearly a problem this repo has now solved once, for energy. `BUG-ENERGY-VIRTUAL-ROOM-ATTRIBUTION` needed exactly one projection to be accountable for a meter, and the shape it arrived at is the obvious starting point for an actuator:

- a nullable column on the projection row holding the claimed property's id, with a **partial unique index** over it, so "one claimant" is a database fact rather than something every write path remembers to check;
- a **foreign key with `ON DELETE SET NULL`**, so a deleted source clears the claim in the same statement that orphans the link — no hook runs there;
- the invariant that the column is either null or equal to `sourcePropertyId`, which is cheap to check and is what the promotion write conditions on.

Four things that were not obvious until they broke, and would break the same way for an actuator:

- **release on every exit path of the gate**, not just the failing one. An early return that leaves a stale claim on a row is invisible until the meter it names goes quiet;
- **promote only to a successor that could have earned it** — and note that for an actuator this lesson **inverts**, which is the sharpest edge in reusing this shape. A released *meter* must find a new claimant or it stops being counted at all, so promotion is the safe answer; a released *relay* must stay unclaimed until an operator maps it, because promotion would hand a control loop hardware nobody chose. Attribution is bookkeeping and can be repaired silently; energising a relay cannot. Take the mechanism, not the policy;
- **a sweep for the paths that cannot name what they released.** Deleting a holder takes its row and its mapping with it, and remapping settles the new one in a hook that never sees the old — neither can name the thing it freed, so `reconcileEnergyClaims()` asks the state instead, beside `reconcileSystemHiddenSources()` which exists for the same reason. The actuator equivalent has the same job and a different verb: find the mappings a released relay left behind and *report* them, so a controller that has lost its actuator says so rather than adopting one;
- **a conditional write, not read-then-write.** `UPDATE … WHERE id = ? AND claim IS NULL AND sourcePropertyId = ? AND NOT EXISTS (…)` makes a lost race a no-op instead of a contradiction, and makes running it twice idempotent.

`DeviceStructureLockService` is worth borrowing from and worth reading first: `ChannelsPropertiesService` takes it around `create` (`:403`) and `update` (`:510`) and **not** around `remove` (`:556`), so the delete path races the create path today. That gap is why the energy claim leans on the constraint rather than the lock, and an actuator that leaned on the lock alone would inherit it.

**Two seams already carry a plugin's private knowledge into core**, and a controller will need the same kind: `PropertyValueSourceRegistryService` answers "where does this property's value live", and `EnergyClaimRegistryService` answers "which property is accountable for this meter" — core asks, the plugin registers, and neither module learns the other's schema. Anything outside the plugin that needs to know an actuator is spoken for should ask across a seam like these rather than read the column.

**Keep the wizard and the write path reading one function.** `describeEnergyClaimConflict()` is called by both the persistence gate and `POST /compatibility`, so the preview cannot offer a pairing the create then refuses — a false green is the one answer a user acts on. An actuator mapping needs the same treatment the moment the wizard can choose one.

**A schema trap worth knowing before you hit it:** CI and the e2e suite build the database from the entity decorators (`FB_DB_SYNC=true`), while installations upgrade through migrations. A constraint declared in only one of them is absent exactly where the tests that rely on it run — the energy claim's unique index is declared twice for that reason, with a spec pinning each.

**Testing that worked for this kind of change:** drive the real components against an in-memory sqlite `DataSource` rather than mocking the seams — `energy-attribution.spec.ts` and `energy-space-history.spec.ts` are the pattern. Every claim in a control loop is about what several pieces do together, and a mock at any of those seams tests the mock.

**Suggested scope order**, because the categories are not equally hard: `heating_unit` and `water_heater` first — one actuator, one sensor, boolean `status`; then `air_conditioner`; then the humidity pair, whose enum `status` needs a vocabulary; and `thermostat` last.

The interlock is **not** the last phase's problem. `air_conditioner` requires `cooler` and declares `heater` optional, so the moment that optional slot is mapped it has the same two opposed actuators a thermostat does — which is why the interlock belongs to the device and applies by shape rather than by category name. Whether it ships in that phase or whether the phase refuses a mapped `heater` until it does, it cannot be left for `thermostat`. What is genuinely particular to `thermostat` is that both of its actuator channels are optional, so nothing structural stops one being created with neither, and it needs an invariant of its own.

**Prior art worth reading before designing** — Home Assistant's `generic_thermostat` solves the same problem against the same kind of hardware. Its `min_cycle_duration`, `cold_tolerance`/`hot_tolerance`, `keep_alive` and `ac_mode` options are the shape of the protections described above, and its climate entity separates `hvac_mode` (what the user asked for) from `hvac_action` (what the unit is doing) — which is exactly the enable/activity split this section argues for, arrived at independently. Read it for what it does on restart and on an actuator that goes unreachable, which is where the design here has the most to decide.

**Deliverable.** A design spec beside this one, answering 1–5 with file-level references the way this section does, then one task per phase of the scope order. Not a single task: the first phase changes the schema and the platform command path, and reviewing that inside a feature that also ships a control loop is how both get less attention than they need.

### Per-channel energy attribution

So a split device's consumption lands in its own room. Called a pre-existing limitation when this design was written, which turned out to understate it: a split device reports *zero* in every room it was split into, because a delta is stamped with the room of the device that owned the property the ingestion read. Filed with its reproduction as `BUG-ENERGY-VIRTUAL-ROOM-ATTRIBUTION`.

## Supersedes

This design replaces the architectural decisions in `EPIC-VIRTUAL-DEVICES.md` and its two child tasks:

- **Decision #2** (channel mapping, no duplication, shared property IDs) is rejected — see the FK analysis above.
- **Two plugins** (`devices-split`, `devices-combined`) collapse into one `devices-virtual`, since splitting is composing with a single source.
- **Cascade deletion** on source loss is replaced by degradation, because virtual devices are referenced by `FK CASCADE` from tiles, detail pages, data sources and four space role tables — deleting one would destroy dashboard configuration.
- `FEATURE-DEVICE-COMPOSITE-PLUGIN.md` §5 claims that mapping `heater.on` and `temperature.temperature` yields a device that "passes the `heating_unit` spec validation". It does not. The `heater` channel requires three properties (`channels.ts:1827-1859`): `on(bool,rw)`, `temperature(float,rw)` — the target setpoint, which no source device supplies — and `status(bool,ro)`. Two would be unmapped, which `DeviceValidationService` reports as `MISSING_PROPERTY` errors. That example needs the controller follow-up.
