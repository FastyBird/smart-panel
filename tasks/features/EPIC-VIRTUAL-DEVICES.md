# Task: Virtual Devices — Split & Combined device support
ID: EPIC-VIRTUAL-DEVICES
Type: feature
Scope: backend, admin, panel
Size: large
Parent: (none)
Status: planned

## 1. Business goal

In order to flexibly assign individual channels of multi-channel devices to different rooms, categories, and automations,
As a smart home user,
I want to split physical devices into virtual child devices and combine channels from multiple physical devices into new logical devices.

## 2. Context

### Problem

Many physical devices expose multiple independent channels. For example, a **Shelly 4PM** has 4 relay channels — each controlling a different load (e.g., living room light, bedroom light, hallway heating, garage outlet). Currently, the entire device is one unit: it lives in one room, has one category, and appears as a single entry everywhere. Users cannot assign individual channels to different rooms or give them distinct device categories.

Similarly, users often want to **combine** channels from separate physical devices into one logical device. For example, a **Shelly 1PM** (relay for floor heating) plus a **Zigbee temperature sensor** could form a virtual "Heating" device that matches the heating device specification.

### Inspiration

Home Assistant's **Helpers** concept allows users to create virtual entities from existing ones. This epic brings similar flexibility to Smart Panel through two dedicated plugins.

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

1. **Two separate plugins** — `devices-split` for splitting, `devices-combined` for composing. Different data models, different UX flows.
2. **Channel mapping, not duplication** — Virtual devices reference parent channels via a mapping table. No channel/property copying. Commands target the same property IDs.
3. **`hidden` flag on DeviceEntity** — Parent devices can be hidden from selection UIs. User-controlled, with auto-unhide when last child is deleted.
4. **Full spec validation** — Virtual devices have their own category and must pass device spec validation against the chosen category.
5. **Parent devices are unaware** — Physical device plugins don't know about virtual children. The virtual layer is entirely user-managed via admin/API.

## 3. Scope

**In scope**
- `hidden` flag on `DeviceEntity` with filtering across all selection UIs
- `devices-split` plugin: split a multi-channel device into child devices
- `devices-combined` plugin: compose a device from channels across multiple physical devices
- Admin UI for both creation flows (wizard-based)
- Panel UI support (virtual devices render as normal devices)
- Spec validation support for both types

**Out of scope**
- Auto-detection / auto-suggestion of splittable devices (future enhancement)
- Panel-side creation of virtual devices (admin only)
- New device specs — uses existing specs from `spec/devices/`
- Extension SDK support for third-party virtual device creation

## 4. Child Tasks

| # | Task | Scope | Description |
|---|------|-------|-------------|
| 1 | [FEATURE-DEVICE-SPLITTER-PLUGIN](FEATURE-DEVICE-SPLITTER-PLUGIN.md) | backend, admin, panel | Split multi-channel devices into independent child devices |
| 2 | [FEATURE-DEVICE-COMPOSITE-PLUGIN](FEATURE-DEVICE-COMPOSITE-PLUGIN.md) | backend, admin, panel | Combine channels from multiple devices into one logical device |

Both tasks share the `hidden` flag foundation (implemented in the splitter task, reused by the composite task).

## 5. Technical constraints

- Follow the existing plugin structure in `apps/backend/src/plugins/devices-*`
- Register device types via `DevicesTypeMapperService.registerMapping()`
- Use Swagger decorators for OpenAPI generation — do not edit generated files
- Respect existing channel parent/child hierarchy (child channels follow their parent)
- Tests are expected for new business logic
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`
