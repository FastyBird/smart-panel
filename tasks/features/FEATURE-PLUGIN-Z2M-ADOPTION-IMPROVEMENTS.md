# Task: Zigbee2MQTT Device Adoption Improvements
ID: FEATURE-PLUGIN-Z2M-ADOPTION-IMPROVEMENTS
Type: feature
Scope: backend, admin
Size: large
Parent: FEATURE-PLUGIN-ZIGBEE2MQTT
Status: planned
Created: 2025-12-22

## 1. Business goal

In order to have accurate device categorization and complete channel mapping for Zigbee devices
As a Smart Panel user adopting Zigbee2MQTT devices
I want an improved adoption flow similar to Home Assistant that allows me to select devices from a list, confirm category, preview proposed mapping, and finalize the adoption with all relevant channels and properties

## 2. Context

- The Zigbee2MQTT plugin (FEATURE-PLUGIN-ZIGBEE2MQTT) is complete with basic auto-mapping
- Current implementation automatically creates devices when discovered with auto-add enabled
- Home Assistant plugin has a sophisticated adoption flow that should be used as reference:
  - `apps/backend/src/plugins/devices-home-assistant/services/mapping-preview.service.ts`
  - `apps/backend/src/plugins/devices-home-assistant/services/device-adoption.service.ts`
  - `apps/admin/src/plugins/devices-home-assistant/components/home-assistant-device-adoption-form.vue`
- Missing functionality:
  - Device selection from discovered devices list
  - Category confirmation before adoption
  - Channel/property mapping preview
  - Internal properties for device-specific attributes (window covering command, battery charging state, etc.)
- Related plugin location: `apps/backend/src/plugins/devices-zigbee2mqtt/`

## 3. Scope

### In scope

- Backend:
  - Discovered devices endpoint returning Z2M devices not yet adopted
  - Mapping preview service for generating channel/property suggestions from `exposes`
  - Device adoption service for creating devices with user-confirmed mapping
  - Internal properties support for Z2M-specific attributes:
    - Window covering: position command, tilt command
    - Battery: charging state, voltage
    - Climate: preset modes, fan modes
    - Light: effect, transition time
    - Other device-specific settings
  - Category inference improvements based on primary expose types

- Admin UI:
  - Discovered devices list component (similar to Home Assistant)
  - Device adoption form with:
    - Device selection from discovered devices
    - Category confirmation/override
    - Channel preview with toggles
    - Property preview with data type info
    - Adopt button to finalize
  - Integration with existing device management pages

### Out of scope

- Panel UI changes
- Group support (Z2M groups)
- OTA firmware updates
- Device renaming in Z2M
- Z2M configuration changes

## 4. Acceptance criteria

### Backend

- [ ] New endpoint `GET /api/plugins/devices-zigbee2mqtt/discovered-devices` returns:
  - List of devices from Z2M bridge not yet adopted in Smart Panel
  - Device info: IEEE address, friendly name, model, vendor, description
  - Available exposes summary
- [ ] New endpoint `GET /api/plugins/devices-zigbee2mqtt/mapping-preview/:friendlyName` returns:
  - Suggested device category based on primary exposes
  - List of suggested channels with their properties
  - Current state values where available
  - Z2M property mappings for each Smart Panel property
- [ ] New endpoint `POST /api/plugins/devices-zigbee2mqtt/adopt` accepts:
  - Friendly name of device to adopt
  - Confirmed device category
  - Selected channels and properties to create
  - Custom device name (optional)
- [ ] Internal properties are created for device-specific attributes:
  - [ ] Window covering: `position_command`, `tilt_command` for setting behavior
  - [ ] Battery: `charging_state`, `battery_voltage` when available
  - [ ] Climate: `preset_mode`, `fan_mode`, `away_mode` options
  - [ ] Light: `effect`, `transition` when supported
- [ ] Category inference prioritizes primary exposes (light, switch, climate) over sensors
- [ ] Unit tests for mapping preview and adoption services

### Admin UI

- [ ] Discovered devices component shows:
  - Device IEEE address and friendly name
  - Model and vendor info
  - Number of available exposes/capabilities
  - "Already added" indicator for adopted devices
  - "Add Device" button for each discovered device
- [ ] Device adoption form includes:
  - [ ] Device info header (name, model, vendor)
  - [ ] Category selector with suggested value
  - [ ] Channel list with checkboxes to include/exclude
  - [ ] Property list per channel with data types
  - [ ] Preview of what will be created
  - [ ] Adopt/Cancel buttons
- [ ] After adoption, user is redirected to device detail page
- [ ] Error handling for adoption failures

## 5. Example scenarios

### Scenario: Adopting a temperature/humidity sensor

Given Zigbee2MQTT has discovered an Aqara temperature sensor
And it has exposes: temperature, humidity, battery, linkquality
When I view the discovered devices list
Then I see "Aqara WSDCGQ11LM" with 4 capabilities listed
When I click "Add Device"
Then I see the adoption form with:
  - Suggested category: SENSOR
  - Suggested channels: Temperature, Humidity, Battery
  - Properties for each channel with current values
When I confirm the adoption
Then the device is created with all selected channels and properties
And I am redirected to the device detail page

### Scenario: Adopting a smart bulb with color support

Given Zigbee2MQTT has discovered a Philips Hue bulb
And it has exposes: light (with features: state, brightness, color_temp, color_xy)
When I view the mapping preview
Then I see suggested category: LIGHTING
And I see Light channel with properties:
  - On/Off (state)
  - Brightness
  - Color Temperature
  - Hue
  - Saturation
  - Effect (internal property)
  - Transition (internal property)
When I adopt the device
Then all properties are created with correct Z2M mappings

### Scenario: Adopting a window covering

Given Zigbee2MQTT has discovered a Tuya blind motor
And it has exposes: cover (with features: state, position, tilt)
When I view the mapping preview
Then I see suggested category: WINDOW_COVERING
And I see Cover channel with properties:
  - Position (0-100%)
  - Tilt (if supported)
  - State (open/close/stop)
And I see internal properties:
  - Position Command (determines how position is set)
When I adopt the device
Then the device can be controlled via the panel UI

## 6. Technical constraints

- Follow the existing module/service structure in `apps/backend/src/plugins/devices-zigbee2mqtt/`
- Use existing mapping patterns from Home Assistant plugin as reference
- Do not modify generated code in `apps/backend/src/spec/`
- Maintain backward compatibility with existing auto-added devices
- Tests are expected for new logic
- Register new services in `devices-zigbee2mqtt.plugin.ts` providers array
- Admin components should follow existing patterns from `apps/admin/src/plugins/devices-home-assistant/`

## 7. Implementation hints

### Backend

1. Create `Z2mMappingPreviewService`:
   - Analyze device exposes structure
   - Generate channel suggestions based on expose types
   - Map Z2M properties to Smart Panel property categories
   - Include internal properties based on device capabilities

2. Create `Z2mDeviceAdoptionService`:
   - Accept mapping preview with user confirmations
   - Create Device, Channels, Properties entities
   - Set up property mappings for state synchronization

3. Create `Z2mDiscoveredDevicesController`:
   - Endpoint for listing discovered devices
   - Endpoint for mapping preview
   - Endpoint for device adoption

4. Internal properties to consider:
   ```typescript
   // Window covering
   z2m_position_command: 'position' | 'lift_percentage' | 'goto_lift_percentage'
   z2m_tilt_command: 'tilt' | 'tilt_percentage'

   // Battery
   z2m_battery_voltage: number
   z2m_charging_state: boolean

   // Light
   z2m_effect: string (from effect_list)
   z2m_transition: number (seconds)

   // Climate
   z2m_preset_mode: string[]
   z2m_fan_mode: string[]
   ```

### Admin UI

1. Create `zigbee2mqtt-discovered-devices.vue`:
   - Table component with device list
   - Refresh button
   - Filter by added/available
   - "Add Device" action

2. Create `zigbee2mqtt-device-adoption-form.vue`:
   - Multi-step or single-page form
   - Category selector
   - Channel/property toggles
   - Preview section
   - Submit handler

3. Create composables:
   - `useDiscoveredDevices.ts` - fetch and manage discovered devices
   - `useMappingPreview.ts` - fetch mapping preview for selected device
   - `useDeviceAdoption.ts` - handle adoption submission

## 8. AI instructions

- Read this file entirely before making any code changes
- Start by replying with a short implementation plan (max 10 steps)
- Keep changes scoped to backend and admin
- Reference Home Assistant adoption implementation for patterns
- For each acceptance criterion, either implement it or explain why it's skipped
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`
- Run tests after implementing: `pnpm run test:unit`
- When creating new services, register them in the plugin's providers array
