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
- There are existing Node.js libraries for Shelly Gen 1 that can serve as **inspiration** for protocol details and behavior (but must not be copy-pasted).
    - In particular, the **`shellies`** npm package is used as a discovery and event layer for Gen 1 devices.
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
    - authentication (optional):
        - primarily password for HTTP-protected Shelly Gen 1 devices (username auto-detected from Shelly HTTP API when possible),
        - optionally per-host secrets via secure config/secret storage,
        - never hardcode credentials.
- Device discovery & lifecycle:
    - discovery of Shelly Gen 1 devices using an appropriate mechanism (preferably the `shellies` library’s discovery/events API),
    - mapping to the core model: **Device → Channels → Properties**,
    - keeping connection / state updates in sync (online/offline, property changes),
    - handling disabled devices (devices marked as `enabled = false` in the core model are skipped in runtime updates).
- Property mapping for core device types, e.g.:
    - relay / switch,
    - dimmer / light,
    - input / contact,
    - temperature / power / energy sensors (if available on the device).
- HTTP-based metadata & health checks:
    - periodic HTTP fetch (e.g. every 5 minutes) for `/shelly`, `/status` and `/settings`,
    - enriching and updating the `device_information` channel (model, firmware, IP, RSSI, hostname, cloud/MQTT info, mode if present).
- Connection & availability handling:
    - availability based on library events **and** `lastSeen` timestamps,
    - configurable `staleTimeout` after which the device is considered offline,
    - exposing connection state via a property in the `device_information` channel (e.g. `connected`, `disconnected`, `unknown`).
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

- [x] New plugin exists in the backend modules structure (e.g. `plugins/shelly-v1` or similar naming consistent with existing plugins).
- [x] Plugin can be **enabled/disabled** through the existing config mechanism.
- [x] When enabled and properly configured, the plugin:
    - [x] discovers Shelly Gen 1 devices available in the network (depending on chosen discovery strategy, e.g. via `shellies.start()`),
    - [x] creates corresponding **Device** entities in the Smart Panel backend,
    - [x] creates appropriate **Channels** and **Properties** based on device capabilities for discovered and supported models.
- [x] For at least the following device types, mapping to channels/properties is correctly defined:
    - [x] simple relay / switch (on/off),
    - [x] dimmer / light with brightness,
    - [x] temperature sensor,
    - [x] power/energy sensor (if available).
- [x] Property values are updated when device state changes (polling, push, or hybrid) and when `shellies` emits `change` events.
- [x] Online/offline status is reflected based on:
    - `shellies` events **or**
    - `lastSeen` timestamp combined with a configurable `staleTimeout`.
- [x] Commands from the Smart Panel (e.g. toggling a switch, setting brightness) are propagated to the Shelly device and reflected back in state.
- [x] All new services are covered with **unit tests** (following existing testing patterns in devices/plugins modules), including:
    - discovery & mapping,
    - availability handling,
    - HTTP metadata sync,
    - command handling.
- [x] Plugin configuration is represented in backend config models and validated.
- [x] No breaking changes for the existing Shelly NG plugin.

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
When no events are received for longer than the configured `staleTimeout`  
Then the plugin updates the device/channel state accordingly in the Smart Panel  
And logs the offline transition.

### Scenario: HTTP metadata refresh

Given a Shelly Gen 1 device is discovered and enabled  
When the periodic HTTP sync runs  
Then the plugin calls `/shelly`, `/status` and/or `/settings` on the device  
And updates the `device_information` channel with IP, model, firmware version, RSSI and other relevant metadata.

### Scenario: Disabled device is ignored

Given a Shelly Gen 1 Device entity exists in the backend  
And this Device is marked as `enabled = false`  
When the plugin receives events from `shellies` or runs periodic HTTP sync  
Then it does **not** update channels/properties for this device  
And does not perform HTTP sync for this device.

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

#### Responsibilities delegated to `shellies`

- Discovery
- State monitoring via events
- Normalized property access
- Command execution (where possible)
- Device lifecycle

#### Example usage

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

### 6.2 Transport & HTTP rules

- Do not reimplement the low-level CoAP protocol: rely on `shellies` for CoAP/event handling.
- Use `shellies.start()` for discovery and state updates.
- Use async non-blocking flows.
- Direct HTTP/RPC calls to Shelly Gen 1 devices are **allowed and expected** when:
    - they are needed for initial probing / basic info (e.g. model, firmware, capabilities),
    - required data are not exposed via `shellies` (e.g. `/shelly`, `/status`, `/settings` metadata),
    - or as a fallback when event/discovery mechanisms are unreliable in a given environment.
- HTTP/RPC access should:
    - be encapsulated in a small adapter/helper service within the plugin,
    - not reimplement features that `shellies` already provides (discovery, basic state events).

## 7. Implementation hints

- Start by examining the existing Shelly NG plugin:
    - how it is registered in the backend,
    - how it maps devices to devices/channels/properties,
    - how it communicates with devices and updates property values.
- Use a thin **Shelly Gen 1 adapter service** that wraps the `shellies` library:
    - listens to `discover`, `change`, and `offline` events (where available),
    - keeps track of `lastSeen` timestamps,
    - converts the raw device representation into a normalized internal structure.
- Define a **minimal but extensible config model** for Shelly Gen 1:
    - discovery strategy (automatic vs. manual list),
    - optional auth if required (password, optional username auto-detection),
    - `staleTimeout` for availability detection,
    - HTTP sync interval.
- Implement the plugin in small steps:
    1. Plugin module & basic config skeleton.
    2. Shellies adapter service (wrapping `shellies` events).
    3. Device discovery & initial mapping (Device → Channel → Properties).
    4. Property updates and online/offline handling (including `lastSeen` + `staleTimeout`).
    5. HTTP metadata sync for `device_information` channel.
    6. Commands (on/off, brightness, basic color/gain for supported devices).
    7. Tests & docs.
- When in doubt, prefer a **simple, robust solution** first (limited subset of device types, clear mapping) and extend later.

## 8. AI instructions (for Junie / Claude)

- Read this file fully before coding.
- Respect global rules in `/.ai-rules/GUIDELINES.md`.
- Before changing code, propose a **5–10 step implementation plan** adapted to the existing plugin architecture and explicitly stating how `shellies` and HTTP metadata sync will be used.
- Use the existing **Shelly NG plugin** as the primary reference for architecture and patterns.
- Implement in **small, reviewable steps**:
    - new module + config,
    - discovery + mapping,
    - availability + HTTP metadata,
    - commands,
    - tests.
- Do not touch admin or panel apps in this task.
- Do not introduce breaking changes to existing Shelly NG behavior.

## 9. Current implementation status (informational)

> This section is informational for humans/AI and reflects the state as of 2025-11-16.  
> It is **not** a hard requirement for future work, but helps to understand what is already done.

- ✅ Plugin skeleton created (`devices-shelly-v1` module, config, entities, DTOs).
- ✅ Discovery via `shellies` implemented and working in a multicast-capable environment.
- ✅ Device/channel/property mapping implemented using `DESCRIPTORS` and `PropertyBinding` (including mode-based profiles for some devices).
- ✅ Runtime property updates wired to `shellies` `change` events.
- ✅ Basic availability handling using `lastSeen` + configurable `staleTimeout` (devices marked offline when no events within timeout).
- ✅ Disabled devices (`enabled = false`) are skipped in runtime updates and HTTP sync.
- ✅ HTTP client implemented for Shelly Gen 1 (`/shelly`, `/status`, `/settings`) with periodic sync (defaults ~5 minutes).
- ✅ `device_information` channel created with core metadata (model, firmware, IP, MAC/serial, mode where applicable, connection status).
- ⏳ Command handling (on/off, brightness, basic color/gain) is **not yet fully implemented**.
- ⏳ Unit test coverage exists for some services but is **not yet complete** for all aspects (availability, HTTP sync, commands).
