# Task: WLED Device Plugin
ID: FEATURE-WLED-PLUGIN
Type: feature
Scope: backend, admin, panel
Size: large
Parent: (none)
Status: done

## 1. Business goal

In order to control addressable LED strips and matrices
As a smart home user
I want to integrate WLED controllers into the Smart Panel system

## 2. Context

- WLED is popular open-source firmware for ESP8266/ESP32 controllers
- WLED exposes a JSON API over HTTP and WebSocket for real-time updates
- WLED devices can be discovered via mDNS (service type: `_wled._tcp`)
- Reference: Shelly NG plugin for similar device integration patterns

## 3. Scope

**In scope**

- Backend plugin for WLED device management
- Admin plugin for WLED configuration UI
- Panel app support for WLED devices
- mDNS discovery of WLED devices
- WebSocket real-time state updates
- Device state polling as fallback
- Control of brightness, colors, effects, palettes, presets
- Segment support for multi-zone control
- Nightlight and sync features
- Discovery endpoint for unadded devices

**Out of scope**

- WLED firmware updates
- WLED preset/playlist management UI
- Advanced segment configuration UI

## 4. Acceptance criteria

- [x] Backend plugin created with proper NestJS module structure
- [x] Plugin follows IManagedPluginService interface for lifecycle management
- [x] mDNS discovery finds WLED devices on the network
- [x] WebSocket connection for real-time state updates
- [x] HTTP polling as fallback when WebSocket unavailable
- [x] Device mapper creates spec-compliant channels and properties
- [x] Device information channel with manufacturer, model, serial, firmware, hardware
- [x] Light channel with on, brightness (0-100%), RGB colors
- [x] Electrical power channel for power consumption monitoring
- [x] Nightlight channel for timed dimming
- [x] Sync channel for UDP sync settings
- [x] Segment channels for multi-zone control
- [x] Effects and palettes support with dynamic format lists
- [x] Preset selection support
- [x] Admin plugin with configuration UI
- [x] Panel app device model, channel model, and property model
- [x] Panel app mappers updated for WLED device type
- [x] Devices loaded from database on startup (not from config)
- [x] Only enabled devices are connected
- [x] Discovery controller exposes unadded discovered devices via API
- [x] Unit tests for device mapper service
- [x] Unit tests for WLED service

## 5. Example scenarios

### Scenario: Discover and add WLED device

Given mDNS discovery is enabled
When a WLED device is powered on
Then it appears in the discovered devices list
And can be added via the admin UI or API

### Scenario: Control WLED light

Given a WLED device is connected
When user changes brightness to 50%
Then the brightness property is updated
And the change is sent to the WLED device

### Scenario: Real-time state sync

Given a WLED device has WebSocket enabled
When the device state changes externally
Then the panel receives the update via WebSocket
And the UI reflects the new state immediately

## 6. Technical constraints

- Follow existing plugin patterns (see Shelly NG plugin)
- Use spec-compliant channel categories (LIGHT, DEVICE_INFORMATION, etc.)
- Use spec-compliant property categories (ON, BRIGHTNESS, COLOR_RED, etc.)
- Brightness values must be 0-100% (convert from WLED's 0-255)
- Power values must be in Watts (convert from WLED's milliamps)
- Do not modify generated OpenAPI code
- Tests required for business logic

## 7. Implementation details

### Backend structure

```
apps/backend/src/plugins/devices-wled/
├── controllers/
│   └── wled-discovery.controller.ts    # Discovery endpoint
├── dto/
│   ├── create-device.dto.ts
│   ├── update-device.dto.ts
│   ├── create-channel.dto.ts
│   ├── update-channel.dto.ts
│   ├── create-channel-property.dto.ts
│   ├── update-channel-property.dto.ts
│   └── update-config.dto.ts
├── entities/
│   └── devices-wled.entity.ts          # Device, Channel, Property entities
├── interfaces/
│   └── wled.interface.ts               # WLED API types
├── models/
│   ├── config.model.ts                 # Plugin config model
│   └── wled-discovery.model.ts         # Discovery response model
├── platforms/
│   └── wled.device.platform.ts         # Device platform for property writes
├── services/
│   ├── wled.service.ts                 # Main service (IManagedPluginService)
│   ├── wled-client-adapter.service.ts  # HTTP/WebSocket client
│   ├── wled-mdns-discoverer.service.ts # mDNS discovery
│   └── device-mapper.service.ts        # Maps WLED data to entities
├── devices-wled.constants.ts           # Constants and bindings
├── devices-wled.exceptions.ts          # Custom exceptions
├── devices-wled.openapi.ts             # Swagger models
└── devices-wled.plugin.ts              # NestJS module
```

### Admin structure

```
apps/admin/src/plugins/devices-wled/
├── components/
│   ├── wled-config-form.vue
│   └── wled-config-form.types.ts
├── composables/
│   └── useWledConfig.ts
├── schemas/
│   ├── config.schemas.ts
│   └── devices.schemas.ts
├── store/
│   ├── config.store.schemas.ts
│   ├── devices.store.schemas.ts
│   ├── channels.store.schemas.ts
│   └── channels.properties.store.schemas.ts
├── devices-wled.constants.ts
└── devices-wled.plugin.ts
```

### Panel structure

```
apps/panel/lib/modules/devices/models/
├── devices/wled_device.dart
├── channels/wled_channel.dart
└── properties/wled_properties.dart
```

### API Endpoints

- `GET /api/v1/plugins/devices-wled/discovery` - Get discovered but unadded devices

### Configuration

```json
{
  "type": "devices-wled-plugin",
  "enabled": true,
  "timeouts": {
    "connection_timeout": 10000,
    "command_debounce": 100
  },
  "polling": {
    "interval": 30000
  },
  "mdns": {
    "enabled": true,
    "interface": null,
    "auto_add": false
  },
  "websocket": {
    "enabled": true,
    "reconnect_interval": 5000
  }
}
```

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
