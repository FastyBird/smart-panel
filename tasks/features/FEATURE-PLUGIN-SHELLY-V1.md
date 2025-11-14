# Task: Shelly Gen 1 plugin for legacy Shelly devices
ID: FEATURE-PLUGIN-SHELLY-V1
Type: feature
Scope: backend
Size: large
Parent: (none)
Status: planned
Created: 2025-11-14

## 1. Business goal

In order to support all Shelly devices produced by Shelly company  
As a Smart Panel user  
I want the backend to provide a dedicated plugin for **Shelly Gen 1** devices, similar to the existing Shelly Next Generation plugin, so that legacy Shelly devices can be discovered, monitored, and controlled from the Smart Panel.

## 2. Context

- There is already a **Shelly Next Generation plugin** in the backend that can be used as a structural and architectural reference.
- Shelly Gen 1 devices are still present in the installation and must be supported for real-world usage.
- There are existing Node.js libraries and Homebridge plugins for Shelly Gen 1 that can serve as **inspiration** for protocol details and behavior (but must not be copy-pasted).
    - In particular, the **`shellies`** npm package can be used as a discovery and event layer for Gen 1 devices.
    - The `homebridge-shelly` project can be used as a conceptual reference for supported features and behavior, not for copying code.
- This task focuses **only on backend plugin implementation**:
    - plugin wiring,
    - device/channel/property mapping,
    - state updates and commands.

Admin and panel UI support will be handled in **separate tasks**.

## 3. Scope

### In scope

- New **Shelly Gen 1 backend plugin** within the Smart Panel backend.
- Plugin registration & configuration:
    - enable/disable,
    - basic connection settings (e.g. discovery enabled/disabled, optional IP/hostname allowlist/denylist),
    - authentication (optional): username/password or per-host tokens via secure config/secret storage; never hardcode credentials.
- Device discovery & lifecycle:
    - discovery of Shelly Gen 1 devices using an appropriate mechanism (preferably the `shellies` library’s discovery/events API),
    - mapping to the core model: **Device → Channels → Properties**,
    - keeping connection / state updates in sync (online/offline, property changes).
- Property mapping for core device types, e.g.:
    - relay / switch,
    - dimmer / light,
    - input / contact,
    - temperature / power / energy sensors (if available on the device).
- Commands:
    - ability to send essential commands (e.g. on/off, brightness for supported devices) to Gen 1 devices.
- Logging & error handling consistent with existing plugins.

### Out of scope

- Admin UI configuration screens for this plugin.
- Panel UI (tiles / detail screens).
- Advanced Shelly Gen 1 features (schedules, scenes, complex timers).
- Auto-migration from other systems or plugins.

These can be addressed in follow-up tasks.

## 4. Acceptance criteria

- [ ] New plugin exists in the backend modules structure (e.g. `plugins/shelly-v1` or similar naming consistent with existing plugins).
- [ ] Plugin can be **enabled/disabled** through the existing config mechanism.
- [ ] When enabled and properly configured, the plugin:
    - [ ] discovers Shelly Gen 1 devices available in the network (depending on chosen discovery strategy, e.g. via `shellies.start()`),
    - [ ] creates corresponding **Device** entities in the Smart Panel backend,
    - [ ] creates appropriate **Channels** and **Properties** based on device capabilities.
- [ ] For at least the following device types:
    - [ ] simple relay / switch (on/off),
    - [ ] dimmer / light with brightness,
    - [ ] temperature sensor,
    - [ ] power/energy sensor (if available),
      mapping to channels/properties is correctly defined.
- [ ] Property values are updated when device state changes (polling, push, or hybrid) and when `shellies` emits `change` events.
- [ ] Online/offline status is reflected when `shellies` (or equivalent mechanism) reports devices going offline/online.
- [ ] Commands from the Smart Panel (e.g. toggling a switch) are propagated to the Shelly device and reflected back in state.
- [ ] All new services are covered with **unit tests** (following existing testing patterns in devices/plugins modules).
- [ ] Plugin configuration is represented in backend config models and validated.
- [ ] No breaking changes for the existing Shelly NG plugin.

## 5. Example scenarios

### Scenario: Discovering and controlling a Shelly Gen 1 relay

Given I have a Shelly Gen 1 device (relay type) in my local network  
And the Shelly Gen 1 plugin is enabled and configured  
When the backend starts and the plugin runs discovery  
Then a new Device is created in the Smart Panel  
And a channel with a power switch property is created  
And when I toggle the property via the backend API  
Then the relay state on the physical device changes  
And the updated state is reflected in the Smart Panel.

### Scenario: Reading temperature from a Shelly Gen 1 sensor

Given I have a Shelly Gen 1 device with a temperature sensor  
When the plugin is running  
Then temperature readings are periodically fetched or received via events  
And the corresponding property value is updated in the backend.

### Scenario: Handling device offline/online

Given a Shelly Gen 1 device is discovered and becomes offline  
When the underlying library (e.g. `shellies`) emits an `offline` event  
Then the plugin updates the device/channel state accordingly in the Smart Panel  
And logs the offline transition.

## 6. Technical constraints

- Follow the **existing plugin architecture** used in the Smart Panel backend:
    - module registration,
    - service structure,
    - config handling.
- Reuse patterns from the existing **Shelly Next Generation plugin** whenever possible:
    - device/channel/property mapping,
    - logging style,
    - configuration style.
- It is allowed to add **`shellies`** as a dependency and use it as the main discovery/event layer for Shelly Gen 1 devices, but:
    - keep plugin logic decoupled enough so that it is not tightly coupled to a single library’s API,
    - all external dependencies must be declared in the appropriate `package.json`.
- Do **not** copy external code (e.g. from Homebridge plugins); it may be used as conceptual inspiration only.
- All new code must follow:
    - TypeScript style rules (tabs, 120 width, single quotes, semicolons, trailing commas),
    - NestJS best practices (services, DI, modules),
    - existing devices module conventions.

### 6.1 Required: Use the `shellies` NPM library for Gen 1 support

The plugin **must** use the official `shellies` NPM package.

### Responsibilities delegated to `shellies`:
- Discovery
- State monitoring via events
- Normalized property access
- Command execution
- Device lifecycle

### Example usage:

```ts
import shellies from 'shellies';

shellies.on('discover', device => {
  this.handleDiscovery(device);

  device.on('change', (prop, newValue) => {
    this.handleChange(device, prop, newValue);
  });

  device.on('offline', () => {
    this.handleOffline(device);
  });
});

shellies.start();
```

### 6.2 Transport rules
- Do not reimplement CoAP/HTTP.
- Use shellies.start().
- Use async non-blocking flows.
- Direct HTTP/RPC calls to Shelly Gen 1 devices are **allowed** when:
    - they are needed for initial probing / basic info (e.g. model, firmware, capabilities),
    - required data are not exposed via `shellies`,
    - or as a fallback when event/discovery mechanisms are unreliable in a given environment.  
      However, HTTP/RPC access should be encapsulated in a small adapter/helper and **must not reimplement** features that `shellies` already provides.

## 7. Implementation hints

- Start by examining the existing Shelly NG plugin:
    - how it is registered in the backend,
    - how it maps devices to devices/channels/properties,
    - how it communicates with devices and updates property values.
- Introduce a thin **Shelly Gen 1 adapter service** that wraps the `shellies` library:
    - listens to `discover`, `change`, and `offline` events,
    - converts the raw device representation into a normalized internal structure.
- Define a **minimal but extensible config model** for Shelly Gen 1:
    - discovery strategy (automatic vs. manual list),
    - optional auth if required.
- Implement the plugin in small steps:
    1. Plugin module & basic config skeleton.
    2. Shellies adapter service (wrapping `shellies` events).
    3. Device discovery & initial mapping (Device → Channel → Properties).
    4. Property updates and online/offline handling.
    5. Commands (on/off, brightness).
    6. Tests & docs.
- When in doubt, prefer a **simple, robust solution** first (limited subset of device types, clear mapping) and extend later.
- Example conceptual usage of `shellies` (for inspiration only):

  ```js
  const shellies = require('shellies');

  shellies.on('discover', (device) => {
    console.log('Discovered device with ID', device.id, 'and type', device.type);

    device.on('change', (prop, newValue, oldValue) => {
      console.log(prop, 'changed from', oldValue, 'to', newValue);
    });

    device.on('offline', () => {
      console.log('Device with ID', device.id, 'went offline');
    });
  });

  shellies.start();
  ```

- Define a minimal but extensible config model for Shelly Gen 1:
  - discovery strategy (automatic vs. manual list),
  - optional auth if required.
- Implement the plugin in small steps:
  - Plugin module & basic config skeleton.
  - Shellies adapter service (wrapping shellies events).
  - Device discovery & initial mapping (Device → Channel → Properties).
  - Property updates and online/offline handling.
  - Commands (on/off, brightness).
  - Tests & docs.
- When in doubt, prefer a simple, robust solution first (limited subset of device types, clear mapping) and extend later.

## 8. AI instructions (for Junie / Claude)

- Read this file fully before coding.
- Respect global rules in `/.ai-rules/GUIDELINES.md`.
- Before changing code, propose a **5–10 step implementation plan** adapted to the existing plugin architecture and explicitly stating whether `shellies` will be used.
- Use the existing **Shelly NG plugin** as the primary reference for architecture and patterns.
- Implement in **small, reviewable steps**:
  - new module + config,
  - discovery + mapping,
  - updates + commands,
  - tests.
- Do not touch admin or panel apps in this task.
- Do not introduce breaking changes to existing Shelly NG behavior.
