# Implementation Plan: Shelly Gen 1 Plugin UI

**Task:** FEATURE-PLUGIN-SHELLY-V1-UI
**Status:** Ready for implementation
**Estimated Steps:** 8 steps

## Summary

This plan implements the admin app plugin for Shelly Gen 1 devices and adds panel app model support. The implementation follows existing patterns from the `devices-shelly-ng` plugin.

---

## Step 1: Create Admin Plugin Foundation

**Goal:** Set up the plugin folder structure and constants

**Files to create:**
```
apps/admin/src/plugins/devices-shelly-v1/
├── index.ts
├── devices-shelly-v1.plugin.ts
├── devices-shelly-v1.constants.ts
├── devices-shelly-v1.exceptions.ts
```

**Details:**
1. Create `devices-shelly-v1.constants.ts`:
   - `DEVICES_SHELLY_V1_TYPE = 'devices-shelly-v1'`
   - `PLUGIN_NAME = 'Shelly Gen 1'`
   - API endpoint prefix: `/plugins/devices-shelly-v1`

2. Create `devices-shelly-v1.exceptions.ts`:
   - `DevicesShellyV1Exception` (base)
   - `DevicesShellyV1ApiException` (API errors)
   - `DevicesShellyV1ValidationException` (validation errors)

3. Create `index.ts` with exports aggregation

4. Create `devices-shelly-v1.plugin.ts`:
   - Vue plugin installation pattern
   - Plugin injection key
   - Register with pluginsManager

---

## Step 2: Create Store Schemas

**Goal:** Define API request/response schemas matching backend

**Files to create:**
```
apps/admin/src/plugins/devices-shelly-v1/store/
├── stores.ts
├── devices.store.schemas.ts
├── devices.store.types.ts
├── channels.store.schemas.ts
├── channels.store.types.ts
├── channels.properties.store.schemas.ts
├── channels.properties.store.types.ts
├── config.store.schemas.ts
├── config.store.types.ts
```

**Key schemas:**

### Config Store Schema (differs from Shelly NG)
```typescript
// Shelly V1 configuration structure
{
  discovery: {
    enabled: boolean,
    interface: string | null
  },
  timeouts: {
    request_timeout: number,  // Default: 10s
    stale_timeout: number     // Default: 30s
  }
}
```

### Device Info Response Schema
```typescript
// Response from POST /plugins/devices-shelly-v1/devices/info
{
  reachable: boolean,
  auth_required: boolean,
  auth_valid: boolean,
  host: string,
  ip: string,
  mac: string,
  model: string,
  firmware: string,
  device_type: string
}
```

### Supported Devices Schema
```typescript
// Response from GET /plugins/devices-shelly-v1/devices/supported
{
  group: string,
  name: string,
  models: string[],
  categories: DeviceCategory[]
}
```

---

## Step 3: Create UI Form Schemas

**Goal:** Define Zod schemas for form validation

**Files to create:**
```
apps/admin/src/plugins/devices-shelly-v1/schemas/
├── schemas.ts
├── types.ts
├── devices.schemas.ts
├── devices.types.ts
├── config.schemas.ts
├── config.types.ts
```

**Key schemas:**

### Device Add Form Schema
```typescript
ShellyV1DeviceAddFormSchema = DeviceAddFormSchema.extend({
  hostname: z.string().trim().min(1),
  password: z.string().nullable().optional()
})
```

### Device Edit Form Schema
```typescript
ShellyV1DeviceEditFormSchema = DeviceEditFormSchema.extend({
  hostname: z.string().trim().min(1),
  password: z.string().nullable().optional()
})
```

### Config Edit Form Schema
```typescript
ShellyV1ConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
  discovery: z.object({
    enabled: z.boolean(),
    interface: z.string().nullable()
  }),
  timeouts: z.object({
    request_timeout: z.number().int().min(1),
    stale_timeout: z.number().int().min(1)
  })
})
```

---

## Step 4: Create Utility Functions

**Goal:** Add data transformers for API communication

**Files to create:**
```
apps/admin/src/plugins/devices-shelly-v1/utils/
├── devices.transformers.ts
```

**Functions:**
- `transformDeviceInfoResponse()` - snake_case → camelCase for device info
- `transformSupportedDevicesResponse()` - transform supported devices list
- `transformConfigResponse()` - transform config data

---

## Step 5: Create Composables

**Goal:** Implement reusable Vue composition functions

**Files to create:**
```
apps/admin/src/plugins/devices-shelly-v1/composables/
├── composables.ts
├── types.ts
├── useDeviceAddForm.ts
├── useDeviceEditForm.ts
├── useSupportedDevices.ts
```

**Details:**

### useDeviceAddForm
Two-step wizard composable:
1. **Step 1**: Hostname + password → validate device via `/devices/info` endpoint
2. **Step 2**: Category + name → create device via devicesStore

### useDeviceEditForm
- Load existing device data
- Edit: name, description, category, hostname, password
- Submit to devicesStore.update()

### useSupportedDevices
- Fetch from `/plugins/devices-shelly-v1/devices/supported`
- Cache results
- Used to validate device models and populate category options

---

## Step 6: Create Vue Components

**Goal:** Build UI forms for configuration and device management

**Files to create:**
```
apps/admin/src/plugins/devices-shelly-v1/components/
├── components.ts
├── types.ts
├── shelly-v1-device-add-form.vue
├── shelly-v1-device-add-form.types.ts
├── shelly-v1-device-edit-form.vue
├── shelly-v1-device-edit-form.types.ts
├── shelly-v1-config-form.vue
├── shelly-v1-config-form.types.ts
```

**Component Details:**

### ShellyV1ConfigForm
Configuration form with fields:
- **Discovery section:**
  - Enable/disable toggle
  - Network interface selector
- **Timeouts section:**
  - Request timeout (seconds)
  - Stale timeout (seconds)

### ShellyV1DeviceAddForm
Two-step wizard:
- **Step 1 (Device Connection):**
  - Hostname/IP input
  - Password input (optional)
  - "Check Device" button
  - Shows: reachable status, auth status, model info
- **Step 2 (Device Information):**
  - Category dropdown (based on device model)
  - Name input
  - Description input

### ShellyV1DeviceEditForm
Single form with fields:
- Read-only ID display
- Name input
- Description input
- Category dropdown
- Hostname input
- Password input (optional)

---

## Step 7: Add Localization

**Goal:** Create English localization strings

**Files to create:**
```
apps/admin/src/plugins/devices-shelly-v1/locales/
└── en-US.json
```

**Structure:**
```json
{
  "headings": {
    "aboutPluginStatus": "Plugin Status",
    "aboutDiscovery": "Discovery Settings",
    "aboutTimeouts": "Timeout Settings",
    "device": {
      "deviceConnection": "Device Connection",
      "information": "Device Information",
      "supported": "Device Supported",
      "notSupported": "Device Not Supported",
      "model": "Model",
      "firmware": "Firmware"
    }
  },
  "fields": {
    "devices": {
      "hostname": { "title": "IP Address / Hostname", ... },
      "password": { "title": "Password", ... },
      ...
    },
    "config": {
      "discoveryEnabled": { "title": "Enable Discovery", ... },
      "discoveryInterface": { "title": "Network Interface", ... },
      "requestTimeout": { "title": "Request Timeout", ... },
      "staleTimeout": { "title": "Stale Timeout", ... }
    }
  },
  "messages": { ... },
  "texts": { ... },
  "buttons": { ... }
}
```

---

## Step 8: Add Panel App Models

**Goal:** Register Shelly V1 device/channel/property models in Flutter app

**Files to create:**
```
apps/panel/lib/modules/devices/models/devices/shelly_v1_device.dart
apps/panel/lib/modules/devices/models/channels/shelly_v1_channel.dart
apps/panel/lib/modules/devices/models/properties/shelly_v1_channel_property.dart
```

**Files to modify:**
```
apps/panel/lib/modules/devices/types/devices.dart (add enum value)
apps/panel/lib/modules/devices/mappers/device.dart (add mapper entry)
apps/panel/lib/modules/devices/mappers/channel.dart (add mapper entry)
apps/panel/lib/modules/devices/mappers/property.dart (add mapper entry)
```

**Model Details:**

### ShellyV1DeviceModel
```dart
class ShellyV1DeviceModel extends DeviceModel {
  final String? hostname;
  final String? password;

  ShellyV1DeviceModel({
    required super.id,
    // ... other fields
    this.hostname,
    this.password,
  }) : super(type: DeviceType.devicesShellyV1);

  factory ShellyV1DeviceModel.fromJson(Map<String, dynamic> json) { ... }
}
```

### ShellyV1ChannelModel
```dart
class ShellyV1ChannelModel extends ChannelModel {
  ShellyV1ChannelModel({
    required super.id,
    // ... other fields
  }) : super(type: ChannelType.devicesShellyV1);

  factory ShellyV1ChannelModel.fromJson(Map<String, dynamic> json) { ... }
}
```

### ShellyV1ChannelPropertyModel
```dart
class ShellyV1ChannelPropertyModel extends ChannelPropertyModel {
  // Similar structure to ShellyNgChannelPropertyModel

  factory ShellyV1ChannelPropertyModel.fromJson(Map<String, dynamic> json) { ... }
}
```

### Mapper Registration
```dart
// In mappers/device.dart
Map<String, DeviceModel Function(Map<String, dynamic>)> deviceModelMappers = {
  // existing entries...
  DeviceType.devicesShellyV1.value: ShellyV1DeviceModel.fromJson,
};
```

---

## Verification Checklist

### Admin App
- [ ] Plugin appears in Configuration → Plugins menu
- [ ] Config form saves discovery and timeout settings
- [ ] Device list shows all discovered Shelly V1 devices
- [ ] Device add form validates device connection
- [ ] Device add form creates device with correct type
- [ ] Device edit form saves changes
- [ ] All UI text is localized

### Panel App
- [ ] Shelly V1 devices appear in device lists
- [ ] Device detail screens show all channels
- [ ] Relay/switch channels display on/off toggle
- [ ] Sensor channels display values correctly
- [ ] WebSocket updates reflect in UI

---

## Dependencies

**Must complete before implementation:**
- Backend Shelly V1 plugin is fully functional (✅ confirmed)
- OpenAPI types are generated for V1 endpoints

**Parallel work possible:**
- Admin plugin (Steps 1-7) and Panel models (Step 8) can be done independently

---

## Notes

### Key Differences from Shelly NG

| Aspect | Shelly V1 | Shelly NG |
|--------|-----------|-----------|
| Config: Discovery | `discovery.enabled`, `discovery.interface` | `mdns.enabled`, `mdns.interface` |
| Config: Timeouts | `timeouts.request_timeout`, `timeouts.stale_timeout` | `websockets.requestTimeout`, `websockets.pingInterval`, `websockets.reconnectInterval` |
| Device Info | Returns `reachable`, `auth_required`, `auth_valid`, `device_type` | Returns different structure |
| Protocol | HTTP REST | WebSocket/RPC |

### Files to Reference
- Shelly NG admin plugin: `apps/admin/src/plugins/devices-shelly-ng/`
- Backend V1 plugin: `apps/backend/src/plugins/devices-shelly-v1/`
- Panel models: `apps/panel/lib/modules/devices/models/`
