# Task: Shelly Gen 1 plugin UI for admin and panel apps
ID: FEATURE-PLUGIN-SHELLY-V1-UI
Type: feature
Scope: admin, panel
Size: medium
Parent: FEATURE-PLUGIN-SHELLY-V1
Status: planned
Created: 2025-12-09

## 1. Business goal

In order to manage and control Shelly Gen 1 devices through the Smart Panel UI  
As a Smart Panel user  
I want the admin app to provide plugin configuration and device management screens, and the panel app to properly display and control Shelly Gen 1 devices.

## 2. Context

- The **Shelly Gen 1 backend plugin** is fully implemented (see `FEATURE-PLUGIN-SHELLY-V1`).
- The **Shelly Next Generation plugin** already has full admin UI support in `apps/admin/src/plugins/devices-shelly-ng/` which can be used as a reference.
- The panel app uses generic device/channel/property views based on categories and types, so Shelly Gen 1 devices should largely work out of the box.
- This task adds admin UI for plugin configuration and device management, plus any panel-specific adjustments needed.

**Reference locations:**
- Backend plugin: `apps/backend/src/plugins/devices-shelly-v1/`
- Admin Shelly NG reference: `apps/admin/src/plugins/devices-shelly-ng/`
- Panel devices module: `apps/panel/lib/modules/devices/`

## 3. Scope

**In scope**

### Admin App
- New `devices-shelly-v1` plugin folder mirroring the Shelly NG structure:
  - Plugin configuration form (enable/disable, discovery settings, timeouts)
  - Device list view with discovery status
  - Device detail/edit forms
  - Channel and property management views
  - Localization strings (en-US)
- Store schemas and types for Shelly V1 devices
- Integration with existing devices module patterns

### Panel App
- Shelly V1 channel model (`shelly_v1_channel.dart`) if needed for plugin-specific behavior
- Shelly V1 device model (`shelly_v1_device.dart`) if needed
- Verify all Shelly Gen 1 device types render correctly with existing generic views
- Fix any channel/property display issues specific to Shelly Gen 1

**Out of scope**

- Backend changes (already complete in parent task)
- Advanced features (schedules, scenes, timers)
- New generic UI components (reuse existing patterns)

## 4. Acceptance criteria

### Admin App

- [ ] New `devices-shelly-v1` plugin exists in `apps/admin/src/plugins/`
- [ ] Plugin is registered in the admin app module system
- [ ] Plugin configuration form allows:
  - [ ] Enable/disable plugin
  - [ ] Configure discovery settings
  - [ ] Set stale timeout and HTTP sync interval
- [ ] Device list shows all discovered Shelly Gen 1 devices with:
  - [ ] Device name, model, IP address
  - [ ] Online/offline status indicator
  - [ ] Enable/disable toggle
- [ ] Device detail view shows:
  - [ ] Device information (model, firmware, MAC, etc.)
  - [ ] All channels with their properties
  - [ ] Ability to edit device settings
- [ ] Localization strings for all UI elements
- [ ] Store schemas match backend API responses

### Panel App

- [ ] Shelly Gen 1 devices appear in device lists
- [ ] All supported channel types render correctly:
  - [ ] Relay/switch channels (on/off control)
  - [ ] Dimmer/light channels (brightness slider)
  - [ ] Temperature sensor channels
  - [ ] Power/energy sensor channels
- [ ] Device detail screens show all channels and properties
- [ ] Commands (toggle, brightness) work correctly from panel UI
- [ ] Device online/offline status is displayed

## 5. Example scenarios

### Scenario: Configuring Shelly Gen 1 plugin in admin

Given I am logged into the admin app  
When I navigate to Configuration → Plugins → Shelly Gen 1  
Then I see the plugin configuration form  
And I can enable/disable the plugin  
And I can adjust discovery and timeout settings  
And changes are saved to the backend.

### Scenario: Managing a Shelly Gen 1 device in admin

Given the Shelly Gen 1 plugin has discovered devices  
When I navigate to Devices → Shelly Gen 1  
Then I see a list of all discovered devices  
When I click on a device  
Then I see its details, channels, and properties  
And I can edit the device name or disable it.

### Scenario: Controlling a Shelly relay from panel

Given a Shelly Gen 1 relay device is discovered and online  
When I view the device in the panel app  
Then I see the switch channel with on/off control  
When I tap to toggle the switch  
Then the relay changes state  
And the UI reflects the new state.

## 6. Technical constraints

- Follow existing plugin patterns from `devices-shelly-ng` for admin app
- Reuse existing device/channel/property views in panel where possible
- Do not duplicate logic that can be shared
- Use OpenAPI-generated types for API communication
- Follow existing localization patterns
- All new components should be covered by unit tests where feasible

## 7. Implementation hints

### Admin App

1. Copy `devices-shelly-ng` folder structure as starting point
2. Update constants, types, and schemas for Shelly V1 specifics
3. Adjust forms for Shelly V1 configuration options
4. Update store to use correct API endpoints (`/plugins/devices-shelly-v1/...`)
5. Register plugin in admin app initialization

### Panel App

1. Check if existing generic views handle all Shelly V1 channel categories
2. Add `shelly_v1_channel.dart` model if plugin-specific logic needed
3. Add `shelly_v1_device.dart` model if plugin-specific logic needed
4. Test all device types: relay, dimmer, sensors
5. Verify WebSocket updates work correctly

### Key files to reference

**Admin (Shelly NG reference):**
```
apps/admin/src/plugins/devices-shelly-ng/
├── components/           # Vue components for forms/views
├── composables/          # Vue composables for data fetching
├── index.ts              # Plugin registration
├── locales/en-US.json    # Localization strings
├── schemas/              # Zod validation schemas
└── store/                # Pinia store definitions
```

**Panel (devices module):**
```
apps/panel/lib/modules/devices/
├── models/channels/      # Channel type models
├── models/devices/       # Device type models
└── views/                # Generic channel/device views
```

## 8. AI instructions (for Junie / AI)

- Read this file and the parent task (`FEATURE-PLUGIN-SHELLY-V1`) before coding.
- Start by examining the `devices-shelly-ng` admin plugin structure.
- Propose a **5–10 step implementation plan** before making changes.
- Implement admin app changes first, then panel app.
- Keep changes minimal and focused on Shelly V1 specifics.
- Reuse existing patterns and components wherever possible.
- Respect global rules in `/.ai-rules/GUIDELINES.md`.
