# Virtual Devices — Design

**Status:** Approved
**Date:** 2026-07-31
**Author:** Adam Kadlec
**Related:** `tasks/epics/EPIC-VIRTUAL-DEVICES.md` (supersedes its key architectural decisions), `tasks/features/FEATURE-DEVICE-SPLITTER-PLUGIN.md`, `tasks/features/FEATURE-DEVICE-COMPOSITE-PLUGIN.md`

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

**Map with dereferenced values.** The virtual device owns real `ChannelEntity`/`ChannelPropertyEntity` rows with genuine UUIDs and real FKs, so every existing consumer works untouched. Each linked property records its source, and `PropertyValueService` reads and writes under the *source* key, so a value and its history are stored exactly once.

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

`PropertyValueService.write` / `readLatest` and `PropertyTimeseriesService` key on `resolve(p) ?? p.id`. The `valuesMap` and `recentValuesMap` caches collapse onto the source key for free, so a linked property and its source share one cache entry and one computed trend.

**Delete must not dereference.** Without this rule, deleting a virtual device wipes the source device's entire history:

```ts
const key = resolve(property);
if (key !== null && key !== property.id) return; // never delete another property's series
```

Linked properties own no series, so deleting them is correctly a no-op; owned properties delete their own.

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
6. Live validation preview via `DeviceValidationService.validateDeviceStructure` (`device-validation.service.ts:239`), which already exists for exactly this.
7. Create, then optionally hide the source device(s).

A source property may feed more than one virtual device — one sensor legitimately serves two rooms' climate. The energy guard skips projections wholesale, so this cannot double-count.

## Degradation and lifecycle

Source property deleted → FK sets `sourcePropertyId` to `null` → property becomes orphaned:

- `DeviceValidationService` reports a missing required property
- admin shows a warning with a *remap* action
- panel renders the device unavailable
- writes rejected
- status forced degraded

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

- **Controller support**, unblocking all six categories listed in [v1 category boundary](#v1-category-boundary). Needs a control loop with hysteresis and minimum cycle protection, plus user-settable setpoints as owned properties — the schema already accommodates the latter.
- **Per-channel energy attribution**, so a split device's consumption lands in its own room. Pre-existing limitation, not introduced here.

## Supersedes

This design replaces the architectural decisions in `EPIC-VIRTUAL-DEVICES.md` and its two child tasks:

- **Decision #2** (channel mapping, no duplication, shared property IDs) is rejected — see the FK analysis above.
- **Two plugins** (`devices-split`, `devices-combined`) collapse into one `devices-virtual`, since splitting is composing with a single source.
- **Cascade deletion** on source loss is replaced by degradation, because virtual devices are referenced by `FK CASCADE` from tiles, detail pages, data sources and four space role tables — deleting one would destroy dashboard configuration.
- `FEATURE-DEVICE-COMPOSITE-PLUGIN.md` §5 claims that mapping `heater.on` and `temperature.temperature` yields a device that "passes the `heating_unit` spec validation". It does not. The `heater` channel requires three properties (`channels.ts:1827-1859`): `on(bool,rw)`, `temperature(float,rw)` — the target setpoint, which no source device supplies — and `status(bool,ro)`. Two would be unmapped, which `DeviceValidationService` reports as `MISSING_PROPERTY` errors. That example needs the controller follow-up.
