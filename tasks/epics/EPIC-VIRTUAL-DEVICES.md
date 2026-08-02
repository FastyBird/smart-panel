# Task: Virtual Devices — Split & Combined device support
ID: EPIC-VIRTUAL-DEVICES
Type: feature
Scope: backend, admin, panel
Size: large
Parent: (none)
Status: in-progress

## 1. Business goal

In order to flexibly assign individual channels of multi-channel devices to different rooms, categories, and automations,
As a smart home user,
I want to split physical devices into virtual child devices and combine channels from multiple physical devices into new logical devices.

## 2. Context

### Problem

Many physical devices expose multiple independent channels. For example, a **Shelly 4PM** has 4 relay channels — each controlling a different load (e.g., living room light, bedroom light, hallway heating, garage outlet). Currently, the entire device is one unit: it lives in one room, has one category, and appears as a single entry everywhere. Users cannot assign individual channels to different rooms or give them distinct device categories.

Similarly, users often want to **combine** channels from separate physical devices into one logical device. For example, a **Shelly 1PM** (relay for floor heating) plus a **Zigbee temperature sensor** could form a virtual "Heating" device that matches the heating device specification.

### Inspiration

Home Assistant's **Helpers** concept allows users to create virtual entities from existing ones. This epic brings similar flexibility to Smart Panel through a `devices-virtual` plugin.

### Existing Code References

- **Device entities**: `apps/backend/src/modules/devices/entities/devices.entity.ts` (STI via `type` discriminator)
- **Channel entities**: Same file, `ChannelEntity` with `parentId` for hierarchical channels
- **Device spec validation**: `apps/backend/src/modules/devices/services/device-validation.service.ts`
- **Device/channel specs**: `spec/devices/devices.yaml`, `spec/devices/channels.yaml`
- **Type mapper pattern**: `DevicesTypeMapperService.registerMapping()` in any `devices-*` plugin
- **Plugin reference**: `apps/backend/src/plugins/devices-third-party/` (simplest device plugin)
- **Tile plugin**: `apps/backend/src/plugins/tiles-device-preview/` (device tile selection)
- **Data source plugin**: `apps/backend/src/plugins/data-sources-device-channel/` (device/channel/property selection)
- **Scene action plugin**: `apps/backend/src/plugins/scenes-local/` (device in scene actions)
- **Space device picker**: `apps/admin/src/modules/spaces/components/space-add-device-dialog.vue`

### Key Architectural Decisions

> Decisions #1 and #2 below were rejected during design review, before implementation began. See [`docs/superpowers/specs/2026-07-31-virtual-devices-design.md`](../../docs/superpowers/specs/2026-07-31-virtual-devices-design.md) for the design that replaced them and was actually built.

1. **Two separate plugins — rejected.** The original plan was `devices-split` for splitting and `devices-combined` for composing, as different data models with different UX flows. Splitting turned out to be composing with a single source device, so the two collapsed into one `devices-virtual` plugin with no parent-device column at all — every source is derived from the linked properties themselves.
2. **Channel mapping, not duplication — rejected.** The original plan had virtual devices reference parent channels via a mapping table, with no channel/property copying and commands targeting the same property IDs. This does not survive the schema: seven entity types (`data-sources-device-channel`, `tiles-device-preview`, `pages-device-detail`, and the four space role tables) hold `ManyToOne` FK constraints with `CASCADE` to `DeviceEntity`/`ChannelEntity`/`ChannelPropertyEntity`. A derived/shared ID has no row of its own, so the database rejects the insert outright — a virtual device built this way could not have been placed on a tile, given a detail page, used as a data source, or assigned a space role. **What replaced it:** the virtual device owns real rows with genuine UUIDs, while `PropertyValueService` reads and writes under the *source* property's key via a `PropertyValueSourceRegistryService`, so a value and its history are stored exactly once.
3. **`hidden` flag on DeviceEntity** — Source devices can be hidden from selection UIs. User-controlled, with auto-unhide when the last virtual device referencing a hidden source is deleted.
4. **Full spec validation** — Virtual devices have their own category and must pass device spec validation against the chosen category.
5. **Source devices are unaware** — Physical device plugins don't know about virtual devices built from their channels. The virtual layer is entirely user-managed via admin/API.
6. **Cascade deletion on source loss — replaced by degradation.** The original plan cascade-deleted a virtual device when its source device, channel, or property was deleted. Rejected: virtual devices are themselves `FK CASCADE` targets from tiles, detail pages, data sources and the four space role tables, so cascading on source loss would have destroyed dashboard configuration instead of just the virtual device. Instead, losing a source `SET NULL`s the link, the property becomes orphaned, and the device degrades (connection status forced to `DISCONNECTED`) rather than disappearing.

## 3. Scope

**In scope**
- `hidden` flag on `DeviceEntity` with filtering across all selection UIs
- `devices-virtual` plugin: build a device from properties of other devices — splitting one physical device into several, or composing one logical device from several
- Admin UI for the creation flow (wizard-based)
- Panel UI support (virtual devices render as normal devices)
- Spec validation support

**Out of scope**
- Auto-detection / auto-suggestion of splittable devices (future enhancement)
- Panel-side creation of virtual devices (admin only)
- New device specs — uses existing specs from `spec/devices/`
- Extension SDK support for third-party virtual device creation

## 4. Child Tasks

| # | Task | Scope | Description |
|---|------|-------|-------------|
| 1 | [FEATURE-DEVICE-VIRTUAL-PLUGIN](../../docs/superpowers/specs/2026-07-31-virtual-devices-design.md) | backend, admin, panel | Build a device from properties of other devices — splitting one physical device into several, or composing one logical device from several |

`FEATURE-DEVICE-SPLITTER-PLUGIN` and `FEATURE-DEVICE-COMPOSITE-PLUGIN` are superseded (see their headers) and collapsed into this single row. The backend `devices-virtual` plugin, the `hidden` flag foundation, and panel registration are implemented; the admin creation wizard and `hidden`-flag filtering in the admin device pickers are not yet built.

## 5. Technical constraints

- Follow the existing plugin structure in `apps/backend/src/plugins/devices-*`
- Register device types via `DevicesTypeMapperService.registerMapping()`
- Use Swagger decorators for OpenAPI generation — do not edit generated files
- Respect existing channel parent/child hierarchy (child channels follow their parent)
- Tests are expected for new business logic
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`
