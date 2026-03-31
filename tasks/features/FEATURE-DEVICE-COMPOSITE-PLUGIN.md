# Task: Combined Device Plugin — compose a device from channels across multiple physical devices
ID: FEATURE-DEVICE-COMPOSITE-PLUGIN
Type: feature
Scope: backend, admin, panel
Size: large
Parent: EPIC-VIRTUAL-DEVICES
Status: planned

## 1. Business goal

In order to create logical devices that combine capabilities from multiple physical devices,
As a smart home user,
I want to compose a new device — such as a heating controller — by picking properties from a Shelly relay (switch) and a Zigbee temperature sensor, so the combined device matches a device specification and behaves as a single controllable unit.

## 2. Context

### Problem

Many real-world setups require combining capabilities from different physical devices into one logical device. For example:

- **Floor heating**: Shelly 1PM relay (on/off switch) + Zigbee temperature/humidity sensor = a `heating_unit` device
- **Smart ventilation**: Shelly relay (fan switch) + Zigbee air quality sensor (CO2, humidity) = a `fan` device with environmental monitoring
- **DIY thermostat**: Shelly relay (heater switch) + Zigbee temp sensor + manual setpoint = a `thermostat` device

Currently, these remain as separate devices. The user cannot create a unified device that matches a device specification and can be controlled as one unit.

### How combined devices work

A **combined device** (type `combined`) is a new device that:
- Has **no single parent** — it references channels and properties from multiple source devices
- Is built through a **spec-driven wizard**: the user first selects a target device category, then the system shows which channels and properties are required/optional, and the user maps them from existing physical devices
- The mapping works at the **property level** — each required/optional property in the spec can be mapped to a specific property from any physical device's channel
- Has its own synthesized `device_information` channel (since there's no single parent)
- Has its own `name`, `category`, `room`, `zone` assignments
- Passes spec validation because properties are mapped to satisfy the chosen spec
- Commands target the original property IDs — no forwarding needed

### Property-level mapping explained

The combined device spec wizard works like this:

1. User selects target category: `heating_unit`
2. System looks up spec → requires channels: `heater` (with property `on`), `device_information`; optional: `temperature`, `electrical_power`
3. For the `heater` channel, property `on` (bool, rw):
   - User selects: Shelly 1PM → relay_0 → property `on`
4. For the optional `temperature` channel, property `temperature` (float, ro):
   - User selects: Zigbee Sensor → temperature → property `temperature`
5. System creates combined device with property-level mappings

This approach gives maximum flexibility — the user isn't constrained by channel structure of source devices, only by the target spec's requirements.

### Source device hiding

Unlike split devices, combined devices typically do NOT hide their source devices. A Zigbee temperature sensor used in a combined heating device may also be useful on its own (showing humidity, battery level, etc.). The `hidden` flag from FEATURE-DEVICE-SPLITTER-PLUGIN is available but hiding is the user's choice.

### Existing code references

- **Hidden flag + validator**: Implemented in FEATURE-DEVICE-SPLITTER-PLUGIN (prerequisite)
- **Device specs**: `spec/devices/devices.yaml` (device category → required/optional channels)
- **Channel specs**: `spec/devices/channels.yaml` (channel category → required/optional properties)
- **Schema utils**: `apps/backend/src/modules/devices/utils/schema.utils.ts` (spec lookup functions)
- **Validation service**: `apps/backend/src/modules/devices/services/device-validation.service.ts`
- **Type mapper**: `DevicesTypeMapperService` in `apps/backend/src/modules/devices/services/`
- **Plugin reference**: `apps/backend/src/plugins/devices-third-party/` (device plugin pattern)
- **Property commands**: `apps/backend/src/modules/devices/controllers/channels-properties.controller.ts`

## 3. Scope

**In scope**

Backend:
- Create `devices-combined` plugin with:
  - `CombinedDeviceEntity` (extends `DeviceEntity`, type discriminator `combined`)
  - `CombinedDevicePropertyMappingEntity` (maps: combined device channel spec slot → source device property)
  - Create/Update/Delete DTOs
  - Type mapper registration + Swagger schemas
  - Property resolution logic (mapping → resolved channels with mapped properties)
  - Synthesized `device_information` channel (owned by the combined device)
  - Aggregated connection status (online only if all source devices online)
  - Validation: spec validation on the resolved property set
  - Cascade behavior: deleting a source channel/property cascade-deletes the combined device
- `GET /devices/:id/source-devices` endpoint (list source devices for a combined device)

Admin:
- **Combined device creation wizard** (spec-driven):
  1. Select target device category from available specs
  2. System displays required and optional channels with their properties
  3. For each property, user selects a source: device → channel → property (with compatible data type/permissions filtering)
  4. User sets name (pre-generated from category + room, editable), room, zones
  5. System creates combined device + validates against spec
  6. Validation result display with warnings/errors
- Combined device detail page: show source device links, property mappings
- Combined device edit: remap properties, change name/category/room

Panel:
- Combined devices render using standard category-based detail pages
- Real-time updates work automatically (same property IDs)
- Aggregated connection status displayed

**Out of scope**
- Split devices (separate task: FEATURE-DEVICE-SPLITTER-PLUGIN)
- Auto-suggestion of combinable devices
- Panel-side creation of combined devices
- Creating new device specs — uses existing specs from `spec/devices/`
- Computed/derived properties (e.g., averaging two temperature sensors) — each property maps 1:1

## 4. Acceptance criteria

### Backend — Combined Device Plugin

- [ ] Plugin structure at `apps/backend/src/plugins/devices-combined/`
- [ ] `CombinedDeviceEntity` extends `DeviceEntity` with type discriminator `combined`
- [ ] `CombinedDevicePropertyMappingEntity` stores:
  - `combinedDeviceId` (FK to CombinedDeviceEntity, CASCADE)
  - `specChannelCategory` (ChannelCategory — which spec channel this mapping belongs to)
  - `specPropertyCategory` (PropertyCategory — which spec property this mapping satisfies)
  - `sourceDeviceId` (FK to DeviceEntity, CASCADE)
  - `sourceChannelId` (FK to ChannelEntity, CASCADE)
  - `sourcePropertyId` (FK to ChannelPropertyEntity, CASCADE)
- [ ] `POST /devices` with `type: 'combined'` creates a combined device with body:
  - `name` (string, required)
  - `category` (DeviceCategory, required)
  - `property_mappings` (array of `{ spec_channel: ChannelCategory, spec_property: PropertyCategory, source_device: UUID, source_channel: UUID, source_property: UUID }`)
- [ ] On creation:
  - All source devices, channels, and properties are validated to exist
  - Source property data types and permissions are checked for compatibility with spec requirements
  - Spec validation runs on the resolved channel/property set
  - Validation warnings/errors returned in response (non-blocking — device created even with warnings)
  - A synthesized `device_information` channel is created (owned by the combined device entity) with properties:
    - `manufacturer`: "Smart Panel"
    - `model`: "Combined Device"
    - `serial_number`: the combined device's UUID
- [ ] `PATCH /devices/:id` supports updating name, category, room, property_mappings
- [ ] `DELETE /devices/:id` deletes the combined device, its mappings, and its synthesized device_information channel
- [ ] `GET /devices/:id` for a combined device returns:
  - Standard device fields (id, name, category, room, enabled, etc.)
  - `channels` array: reconstructed from property mappings, grouped by `specChannelCategory`, with properties resolved from source devices
  - The synthesized `device_information` channel
  - `source_devices` field: list of unique source device UUIDs
- [ ] `GET /devices/:id/source-devices` returns source device summaries for a combined device
- [ ] Connection status: combined device is online only if ALL source devices are online; offline/degraded if any source is offline (via `@OnEvent('device.status.changed')`)
- [ ] Deleting a source device CASCADE deletes the combined device (since it becomes non-functional)
- [ ] Deleting a source channel CASCADE deletes the combined device
- [ ] Deleting a source property CASCADE deletes the mapping row; if the property was for a required spec slot, spec validation will show error
- [ ] Type mapper registered: `DevicesTypeMapperService.registerMapping({ type: 'combined', ... })`
- [ ] Swagger decorators on all DTOs and response models

### Admin UI — Combined Device Wizard

- [ ] Wizard step 1: Device category picker
  - Shows all device categories that have specs in `devices.yaml`
  - Each option shows category name, description, required channel summary
- [ ] Wizard step 2: Property mapping
  - For each channel in the spec (required first, then optional):
    - Show channel name, category, required/optional badge
    - For each property in the channel spec:
      - Show property name, category, data type, permissions, required badge
      - Device → Channel → Property selector (filtered by compatible data type and permissions)
      - Clear indication when a required property is not yet mapped
  - Live validation indicator: shows which spec requirements are satisfied
- [ ] Wizard step 3: Device details
  - Name field (pre-generated: `"{Category Name} — {Room Name}"` or `"{Category Name}"`, editable)
  - Room picker
  - Zone picker (multi-select)
- [ ] Wizard step 4: Review & create
  - Summary of all mappings (source device → source channel → source property → spec slot)
  - Spec validation preview (errors/warnings)
  - Create button
- [ ] Combined device detail page shows:
  - Source devices with links
  - Property mapping table (spec slot → source property)
  - Validation status
- [ ] Combined device edit: remap individual properties, change name/category/room

### Panel UI

- [ ] Combined devices appear as normal devices in device lists
- [ ] Combined devices render with correct category-based detail pages
- [ ] Real-time property updates work for mapped source properties
- [ ] Connection status indicator reflects aggregated source device status

### Testing

- [ ] Backend unit tests for:
  - Combined device CRUD operations
  - Property resolution from mappings to channels
  - Synthesized device_information channel creation
  - Source property compatibility validation (data type, permissions)
  - Connection status aggregation
  - Cascade deletion behavior (source device/channel/property deleted)
  - Spec validation on resolved property set
- [ ] Backend E2E tests for full combined device lifecycle
- [ ] Admin component tests for wizard flow

## 5. Example scenarios

### Scenario: Create a heating device from relay + temperature sensor

Given a Shelly 1PM device with channels: relay_0 (switcher, property: on), power_0 (electrical_power, property: power), device_information
And a Zigbee temperature/humidity sensor with channels: temperature (property: temperature), humidity (property: humidity), device_information
When the user opens the combined device wizard and selects category "heating_unit"
Then the wizard shows required channels: heater (property: on required), device_information (auto)
And optional channels: temperature, electrical_power, humidity
When the user maps:
  - heater.on → Shelly 1PM / relay_0 / on
  - temperature.temperature → Zigbee Sensor / temperature / temperature
  - electrical_power.power → Shelly 1PM / power_0 / power
And sets name "Living Room Floor Heating" and room "Living Room"
Then a combined device is created that passes the `heating_unit` spec validation
And controlling the heater via the combined device targets the Shelly relay's `on` property
And the temperature reading comes from the Zigbee sensor's property

### Scenario: Source device goes offline

Given a combined heating device with sources: Shelly 1PM (online) and Zigbee Sensor (online)
When the Zigbee Sensor goes offline
Then the combined device's connection status changes to offline/degraded
And the admin/panel UI shows the degraded status

### Scenario: Source device deleted

Given a combined heating device using channels from Shelly 1PM and Zigbee Sensor
When the Zigbee Sensor is deleted from the system
Then the combined device is cascade-deleted
And the admin UI no longer shows the combined device

### Scenario: Property compatibility filtering in wizard

Given the user is mapping the `heater.on` property (spec: bool, rw)
When the property picker shows available properties from all devices
Then only properties with data_type `bool` and permissions including `rw` are shown as compatible
And properties with incompatible types (e.g., float temperature) are grayed out or hidden

## 6. Technical constraints

- Depends on FEATURE-DEVICE-SPLITTER-PLUGIN for the `hidden` flag foundation (though combined devices typically don't hide sources)
- Follow the existing plugin structure in `apps/backend/src/plugins/devices-*`
- Register device type via `DevicesTypeMapperService.registerMapping()`
- Use Swagger decorators for OpenAPI generation — do not edit generated files
- Property mappings are 1:1 — no computed/aggregated properties
- The synthesized `device_information` channel is a real `ChannelEntity` owned by the combined device (not a mapping)
- Source device plugins must not be aware of combined devices
- Tests are expected for new business logic

## 7. Implementation hints

### Backend plugin structure
```
apps/backend/src/plugins/devices-combined/
├── devices-combined.module.ts
├── devices-combined.plugin.ts          # onModuleInit: register type mapper + swagger
├── entities/
│   ├── devices-combined.entity.ts      # CombinedDeviceEntity extends DeviceEntity
│   └── combined-property-mapping.entity.ts
├── dto/
│   ├── create-device.dto.ts
│   └── update-device.dto.ts
├── services/
│   ├── combined-devices.service.ts     # Property resolution, mapping CRUD, device_info creation
│   └── combined-devices-listener.service.ts  # Status aggregation event listener
└── controllers/
    └── combined-devices.controller.ts  # GET /devices/:id/source-devices
```

### Property resolution pseudocode
```typescript
resolveChannels(combinedDevice: CombinedDeviceEntity): ResolvedChannel[] {
  const mappings = combinedDevice.propertyMappings;
  const channelMap = new Map<ChannelCategory, ResolvedChannel>();

  // Group mappings by spec channel
  for (const mapping of mappings) {
    let channel = channelMap.get(mapping.specChannelCategory);
    if (!channel) {
      channel = {
        category: mapping.specChannelCategory,
        properties: [],
      };
      channelMap.set(mapping.specChannelCategory, channel);
    }
    channel.properties.push({
      ...mapping.sourceProperty,
      category: mapping.specPropertyCategory, // Override with spec category
    });
  }

  const resolved = Array.from(channelMap.values());

  // Add synthesized device_information channel
  resolved.push(combinedDevice.deviceInformationChannel);

  return resolved;
}
```

### Admin wizard — property compatibility check
When filtering source properties for a spec slot, use these rules:
- **Data type compatibility**: bool ↔ bool, float ↔ float/int/uchar/ushort (numeric types compatible), enum ↔ enum (check format values overlap), string ↔ string
- **Permission compatibility**: spec requires `rw` → source must have `rw`; spec requires `ro` → source can have `ro` or `rw`
- Show compatible properties first, incompatible ones grayed out with explanation

### Pre-generated names
Default name format: `"{Device Category Name}"` or `"{Device Category Name} — {Room Name}"` if room is selected. Examples: "Floor Heating", "Floor Heating — Living Room". User can edit before creation.

### Cascade deletion strategy
When a source device or channel is deleted, the combined device is fully deleted (not just degraded). Rationale: a combined device with missing core components is non-functional and confusing. The user should recreate it with different sources. This is handled via FK CASCADE on `sourceDeviceId` and `sourceChannelId`.

When only a source property is deleted (but channel remains), only the mapping row is deleted. The combined device remains but may fail spec validation (if the property was required). This allows the user to remap to a different property.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Ensure FEATURE-DEVICE-SPLITTER-PLUGIN is implemented first (provides `hidden` flag foundation).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
- Run `pnpm run generate:openapi` after adding Swagger decorators.
- Do not modify existing device plugin code — source device plugins should be unaware of combined devices.
