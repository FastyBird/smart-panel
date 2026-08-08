# Task: Virtual Devices — Split & Combined device support
ID: EPIC-VIRTUAL-DEVICES
Type: feature
Scope: backend, admin, panel
Size: large
Parent: (none)
Status: done

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

`FEATURE-DEVICE-SPLITTER-PLUGIN` and `FEATURE-DEVICE-COMPOSITE-PLUGIN` are superseded (see their headers) and collapsed into this single row. All of it is delivered: the `hidden` flag foundation and the backend `devices-virtual` plugin (PR #628), then the admin plugin trio, the creation wizard, the detail page with its remap flow, `hidden` filtering across the space, tile, data-source and scene pickers, and the panel's handling of a source that is hidden underneath it (PR #635).

## 4a. Delivered, and what was left out

Delivered against §3: the `hidden` flag with filtering in every selection UI, the `devices-virtual` plugin, the admin creation wizard, panel rendering through the existing category-based pages, and spec validation against the chosen category.

One step of the design's [creation flow](../../docs/superpowers/specs/2026-07-31-virtual-devices-design.md#creation-flow) is built differently than written. Step 6 called for a live preview from `DeviceValidationService.validateDeviceStructure`; the wizard instead derives readiness from the specification directly — required slots filled, plus the constraint alerts a slot count cannot express — and verifies every individual pairing against the plugin's own compatibility endpoint, which judges the things structural validation does not (data type, permissions, format, sentinels). Structure is still validated server-side on create, and the device list surfaces the stored validation state afterwards.

Left out deliberately, and still open:

- **The six closed-loop categories** stay blocked, as [the design's v1 boundary](../../docs/superpowers/specs/2026-07-31-virtual-devices-design.md#v1-category-boundary) sets out. Unblocking them needs a control loop with hysteresis and minimum cycle protection, plus user-settable setpoints as owned properties — the schema already accommodates the latter.
- **Per-channel energy attribution**, so a split device's consumption lands in its own room. Pre-existing limitation, not introduced here.
- Everything in §3's out-of-scope list: auto-detection of splittable devices, panel-side creation, new device specs, and extension-SDK support for third-party virtual devices.

The engineering backlog this work accumulated lives in [`TECH-VIRTUAL-DEVICES-FOLLOWUPS`](../technical/TECH-VIRTUAL-DEVICES-FOLLOWUPS.md), which stays open. Nothing there blocks the feature; the ones worth reading first are §3.3 (the TypeORM shared-`QueryRunner` TOCTOU, high but pre-existing), §3.7 and §3a.12 (the security and Buddy aggregates counting a source and its virtual replacement twice), and §3a.14 (tiles, data sources and scenes never reconciling a reference to a device that vanishes).

## 5. Technical constraints

- Follow the existing plugin structure in `apps/backend/src/plugins/devices-*`
- Register device types via `DevicesTypeMapperService.registerMapping()`
- Use Swagger decorators for OpenAPI generation — do not edit generated files
- Respect existing channel parent/child hierarchy (child channels follow their parent)
- Tests are expected for new business logic
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`
