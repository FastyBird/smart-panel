# Task: Split Device Plugin — split multi-channel devices into independent child devices
ID: FEATURE-DEVICE-SPLITTER-PLUGIN
Type: feature
Scope: backend, admin, panel
Size: large
Parent: EPIC-VIRTUAL-DEVICES
Status: planned

## 1. Business goal

In order to assign individual channels of a multi-channel device to different rooms with different device categories,
As a smart home user,
I want to split a device like Shelly 4PM into separate virtual devices — each representing one or more channels from the parent — so I can treat them as independent devices in spaces, tiles, scenes, and automations.

## 2. Context

### Problem

A Shelly 4PM has 4 relay channels (`relay_0` .. `relay_3`), each with a child power-monitoring channel (`power_0` .. `power_3`), plus a shared `device_information` channel. The physical device is created with category `switcher`. But the user's actual setup is:

- Channel 0 → living room ceiling light (category: **lighting**)
- Channel 1 → bedroom lamp (category: **lighting**)
- Channels 2+3 → electric floor heating in hallway (category: **heating_unit**)

Currently there's no way to split this. The device is one unit in one room with one category.

### How split devices work

A **split device** is a new device (type `split`) that:
- References a **parent device** (the physical device)
- Maps a **subset of the parent's channels** via a mapping table
- Always includes the parent's `device_information` channel (auto-mapped)
- Child channels (e.g., `power_0` is child of `relay_0`) automatically follow their parent channel
- Has its own `name`, `category`, `room`, `zone` assignments
- The user picks a **device category** (e.g., `lighting`) that may differ from the parent — this determines which spec the split device is validated against
- Since the category changes, the **channel categories may also differ** — e.g., a `switcher` channel on the parent becomes a `light` channel on the split device to match the `lighting` spec. The mapping stores this category override.
- Passes spec validation because its mapped channel set (with category overrides) matches the chosen device spec
- Commands target the same property IDs as the parent — no forwarding needed

### Category remapping explained

When a user splits a Shelly 4PM (category: `switcher`) into a lighting device:

1. User selects device category: `lighting`
2. System looks up the `lighting` spec → requires a `light` channel + `device_information`
3. User maps parent's `relay_0` channel (category: `switcher`) → the mapping stores category override `light`
4. The `device_information` channel is auto-included (no category change needed)
5. Optional: `power_0` (child of `relay_0`) maps as `electrical_power` (no change needed, already correct)

The physical channel's category in the DB doesn't change. The split device's mapping table stores the override. When the API returns the split device's channels, it uses the overridden categories.

### Existing code references

- **Device STI pattern**: `apps/backend/src/modules/devices/entities/devices.entity.ts`
- **Channel parent/child**: Same file — `ChannelEntity.parentId` for hierarchical channels
- **Type mapper**: `DevicesTypeMapperService` in `apps/backend/src/modules/devices/services/`
- **Plugin reference**: `apps/backend/src/plugins/devices-third-party/` (simplest device plugin to follow)
- **Device specs**: `spec/devices/devices.yaml` (device category → required/optional channels)
- **Channel specs**: `spec/devices/channels.yaml` (channel category → required/optional properties)
- **Validation service**: `apps/backend/src/modules/devices/services/device-validation.service.ts`
- **Schema utils**: `apps/backend/src/modules/devices/utils/schema.utils.ts`
- **Shelly V1 channel creation**: `apps/backend/src/plugins/devices-shelly-v1/services/device-mapper.service.ts` (channel hierarchy creation with parent/child matching)

## 3. Scope

**In scope**

Backend:
- Add `hidden` boolean column to `DeviceEntity` (default `false`) + migration
- Add `?hidden=true|false|all` query param to `GET /devices` endpoint (default `all` for backward compat)
- Add `ValidateDeviceNotHidden` validator for use in tile, data source, scene, space DTOs
- Create `devices-split` plugin with:
  - `SplitDeviceEntity` (extends `DeviceEntity`, type discriminator `split`)
  - `SplitDeviceChannelMappingEntity` (junction: split device ↔ parent channel, with category override)
  - Create/Update/Delete DTOs
  - Type mapper registration + Swagger schemas
  - Channel resolution logic (mapping → resolved channels with category overrides + auto-included device_information + auto-included child channels)
  - Connection status proxying (parent status → split device status)
  - `GET /devices/:id/split-devices` endpoint (list split children of a parent)
  - Auto-unhide parent when last split child is deleted
  - Validation: a parent channel can only be mapped to one split device
  - Validation: run spec validation on the resolved channel set before creation
- Update tile, data source, scene action, space assignment validators to reject hidden devices

Admin:
- Add `hidden` field to device store/model
- Add "Show hidden devices" filter toggle to device list (default: off)
- Show "Hidden" badge + split children count on hidden devices in device list
- Filter hidden devices from space device picker, tile picker, data source picker
- **Split device creation wizard**:
  1. Select parent device (shows multi-channel devices)
  2. Select target device category from spec (e.g., `lighting`, `heating_unit`)
  3. System shows required/optional channels for that spec
  4. User maps parent channels to spec channels (with category override preview)
  5. User sets name (pre-generated from parent name + channel name, editable), room, zones
  6. System creates split device + validates against spec
  7. Option to hide parent device
- Split device detail page: show parent device link, mapped channels info
- Parent device detail page: show list of split children

Panel:
- Add `SplitDevice` model type (or handle via existing category-based rendering)
- Hidden devices filtered server-side — no panel filtering changes needed
- Split devices render using standard category-based detail pages (lighting, heating, etc.)
- Real-time updates work automatically (same property IDs)

**Out of scope**
- Combined/composite devices (separate task: FEATURE-DEVICE-COMPOSITE-PLUGIN)
- Auto-detection of splittable devices
- Panel-side creation of split devices
- Changing the physical channel's category in the DB (category override is in the mapping only)

## 4. Acceptance criteria

### Backend — Foundation

- [ ] `DeviceEntity` has a `hidden` boolean column (default `false`), with DB migration
- [ ] `GET /devices` supports `?hidden=true|false|all` query parameter
- [ ] `ValidateDeviceNotHidden` decorator exists and is applied to:
  - `CreateDevicePreviewTileDto` (tiles plugin)
  - `CreateDeviceChannelDataSourceDto` (data sources plugin)
  - `CreateLocalSceneActionDto` (scenes plugin)
  - Space bulk-assign service/DTO
- [ ] Hidden devices are rejected by the above validators with a clear error message

### Backend — Split Device Plugin

- [ ] Plugin structure at `apps/backend/src/plugins/devices-split/`
- [ ] `SplitDeviceEntity` extends `DeviceEntity` with `parentDeviceId` (FK, CASCADE delete)
- [ ] `SplitDeviceChannelMappingEntity` stores:
  - `splitDeviceId` (FK to SplitDeviceEntity, CASCADE)
  - `parentChannelId` (FK to ChannelEntity, CASCADE)
  - `categoryOverride` (nullable ChannelCategory — if set, overrides the parent channel's category)
- [ ] `POST /devices` with `type: 'split'` creates a split device with body:
  - `parent_device` (UUID, required)
  - `name` (string, required)
  - `category` (DeviceCategory, required)
  - `mapped_channels` (array of `{ channel: UUID, category_override?: ChannelCategory }`)
- [ ] On creation:
  - Parent device and channels are validated
  - Child channels (via `parentId`) are auto-included when their parent channel is mapped
  - `device_information` channel from parent is auto-included
  - A parent channel cannot be mapped to more than one split device (validated)
  - Spec validation runs against the resolved channel set (with category overrides) for the chosen device category
  - Validation warnings/errors are returned in the response (non-blocking — device is created even with warnings)
- [ ] `PATCH /devices/:id` supports updating name, category, room, mapped_channels
- [ ] `DELETE /devices/:id` deletes the split device and its mappings; if no other split devices reference the same parent, parent's `hidden` is set to `false`
- [ ] `GET /devices/:id` for a split device returns:
  - Standard device fields (id, name, category, room, enabled, etc.)
  - `parent_device` field with parent device UUID
  - `channels` array populated from mapped parent channels (with category overrides applied) + device_information
  - Channel properties are included as-is from the parent channel
- [ ] `GET /devices/:id/split-devices` returns all split devices for a given parent device
- [ ] Connection status of split device mirrors parent device status (via `@OnEvent('device.status.changed')`)
- [ ] Deleting a parent device cascades to all split children (FK cascade)
- [ ] Deleting a parent channel cascades to mapping rows → split device loses that channel → spec validation shows errors
- [ ] Type mapper registered: `DevicesTypeMapperService.registerMapping({ type: 'split', ... })`
- [ ] Swagger decorators on all DTOs and response models

### Admin UI

- [ ] Device list has "Show hidden devices" toggle (default: off)
- [ ] Hidden devices show a "Hidden" badge and count of split children
- [ ] Space device picker (`space-add-device-dialog.vue`) excludes hidden devices
- [ ] Split device creation wizard with steps:
  1. Parent device selection (shows devices with 2+ channels)
  2. Target category selection from available device specs
  3. Channel mapping with category override preview (shows which spec channels are satisfied)
  4. Name (pre-generated: `"{Parent Name} — {Channel Name}"`, editable) + room + zone selection
  5. Creation + validation result display
  6. Option to hide parent device
- [ ] Split device detail page shows parent device link and mapped channels
- [ ] Parent device detail page shows split children list with links

### Panel UI

- [ ] Split devices appear as normal devices in device lists (filtered by room/zone)
- [ ] Split devices render with correct category-based detail pages
- [ ] Real-time property updates work for split device channels
- [ ] Connection status indicator reflects parent device status

### Testing

- [ ] Backend unit tests for:
  - Split device CRUD operations
  - Channel mapping resolution (auto-include children, auto-include device_information)
  - Category override application in response serialization
  - Parent `hidden` flag auto-unhide on last child deletion
  - Validation: duplicate channel mapping prevention
  - Validation: spec validation with category overrides
  - Connection status proxying
- [ ] Backend E2E tests for full split device lifecycle
- [ ] Admin component tests for wizard flow

## 5. Example scenarios

### Scenario: Split Shelly 4PM into 2 lights and 1 heating device

Given a Shelly 4PM device with channels: relay_0, relay_1, relay_2, relay_3 (each with child power channels) and device_information
When the user creates 3 split devices:
  - "Living Room Light" (category: lighting, maps: relay_0 → light)
  - "Bedroom Light" (category: lighting, maps: relay_1 → light)
  - "Hallway Heating" (category: heating_unit, maps: relay_2 → heater, relay_3 → heater)
And hides the parent device
Then each split device appears independently in device lists
And each can be assigned to a different room
And each passes spec validation for its category
And the parent Shelly 4PM is hidden from device selection UIs
And controlling relay_0 via the "Living Room Light" split device targets the same property ID as the physical device

### Scenario: Delete last split child unhides parent

Given a Shelly 4PM with one split child device "Kitchen Light"
When the user deletes "Kitchen Light"
Then the parent Shelly 4PM's `hidden` flag is set to `false`
And the parent device reappears in device lists

### Scenario: Parent channel deletion cascades

Given a split device "Living Room Light" mapping relay_0 from a Shelly 4PM
When the Shelly plugin removes relay_0 from the parent device (e.g., device reconfiguration)
Then the mapping row is cascade-deleted
And the split device's spec validation shows an error (missing required channel)
And the admin UI shows a validation warning on the split device

### Scenario: Prevent double-mapping

Given relay_0 is already mapped to split device "Living Room Light"
When the user tries to create another split device mapping relay_0
Then the API returns a validation error: "Channel relay_0 is already mapped to another split device"

## 6. Technical constraints

- Follow the existing plugin structure in `apps/backend/src/plugins/devices-*`
- Register device type via `DevicesTypeMapperService.registerMapping()`
- Use Swagger decorators for OpenAPI generation — do not edit generated files
- Channel categories in the DB are NOT modified — category overrides live in the mapping table only
- The parent device's plugin (Shelly, Z2M, etc.) must not be aware of split children
- Respect channel parent/child hierarchy: mapping a parent channel auto-includes its children
- Tests are expected for new business logic

## 7. Implementation hints

### Backend plugin structure
```
apps/backend/src/plugins/devices-split/
├── devices-split.module.ts
├── devices-split.plugin.ts           # onModuleInit: register type mapper + swagger
├── entities/
│   ├── devices-split.entity.ts       # SplitDeviceEntity extends DeviceEntity
│   └── split-channel-mapping.entity.ts
├── dto/
│   ├── create-device.dto.ts
│   └── update-device.dto.ts
├── services/
│   ├── split-devices.service.ts      # Channel resolution, mapping CRUD
│   └── split-devices-listener.service.ts  # Status sync event listener
└── controllers/
    └── split-devices.controller.ts   # GET /devices/:id/split-devices
```

### Channel resolution pseudocode
```typescript
resolveChannels(splitDevice: SplitDeviceEntity): ResolvedChannel[] {
  const mappings = splitDevice.channelMappings;
  const parentDevice = splitDevice.parentDevice;
  const resolved: ResolvedChannel[] = [];

  for (const mapping of mappings) {
    const channel = mapping.parentChannel;
    resolved.push({
      ...channel,
      category: mapping.categoryOverride ?? channel.category,
    });

    // Auto-include child channels
    for (const child of channel.children) {
      if (!mappings.some(m => m.parentChannelId === child.id)) {
        resolved.push(child); // Keep original category for children
      }
    }
  }

  // Auto-include device_information channel
  const deviceInfoChannel = parentDevice.channels.find(
    ch => ch.category === ChannelCategory.DEVICE_INFORMATION
  );
  if (deviceInfoChannel && !resolved.some(ch => ch.id === deviceInfoChannel.id)) {
    resolved.push(deviceInfoChannel);
  }

  return resolved;
}
```

### Admin wizard — category-to-channel mapping
When the user picks a target category (e.g., `lighting`), use `schema.utils.ts` to:
1. Call `getAllowedChannels('lighting')` → get required/optional channel specs
2. Show required channels that need mapping (e.g., `light` channel required)
3. Show available parent channels that could satisfy each requirement
4. Let user map parent channels to spec channels (this determines the `categoryOverride`)
5. Validate the mapping against the spec before submission

### Pre-generated names
Default name format: `"{Parent Device Name} — {Channel Name}"` (e.g., "Shelly 4PM — Relay 0"). User can edit before creation. If multiple channels are mapped, use the first channel's name or the target category name.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Implement the `hidden` flag foundation first (migration, filter, validator) as other tasks depend on it.
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
- Run `pnpm run generate:openapi` after adding Swagger decorators.
- Do not modify existing device plugin code — the parent device's plugin should be unaware of split children.
