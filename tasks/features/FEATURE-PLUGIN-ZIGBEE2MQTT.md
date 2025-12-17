# Task: Zigbee2MQTT plugin for Zigbee devices via MQTT
ID: FEATURE-PLUGIN-ZIGBEE2MQTT
Type: feature
Scope: backend
Size: large
Parent: (none)
Status: planned
Created: 2025-11-14

## 1. Business goal

In order to integrate my existing Zigbee network managed by **Zigbee2MQTT (Z2M)**  
As a Smart Panel user  
I want a backend plugin that connects to Zigbee2MQTT via MQTT, discovers devices and their capabilities, and maps them to the Smart Panel **Device → Channel → Property** model so they can be monitored and controlled.

## 2. Context

- Zigbee2MQTT exposes **all device state and control over MQTT**, using a configurable base topic (default: `zigbee2mqtt`).
- The Smart Panel already has:
    - MQTT support at infrastructure level (via the `mqtt` npm package, or similar),
    - a **devices/channels/properties** model that should be reused for mapping.
- Zigbee2MQTT provides:
    - per-device topics like `zigbee2mqtt/FRIENDLY_NAME`, `zigbee2mqtt/FRIENDLY_NAME/set`, `zigbee2mqtt/FRIENDLY_NAME/availability`,
    - bridge topics like `zigbee2mqtt/bridge/devices`, `zigbee2mqtt/bridge/state`, `zigbee2mqtt/bridge/event`, etc.
- Device capabilities are described via the **`exposes`** structure (in `bridge/devices` payload), using generic and specific types (`binary`, `numeric`, `light`, `switch`, `climate`, …).
- This task is **backend-only**: it focuses on the plugin, MQTT integration, device mapping, and commands.

Admin and panel UI usage (tiles, detail views, automation) will be handled in separate tasks.

## 3. Scope

### 3.1 In scope

- New **Zigbee2MQTT backend plugin** within the Smart Panel backend.
- Plugin configuration & wiring:
    - enable/disable flag,
    - MQTT connection settings:
        - host (e.g. `mqtt://localhost:1883` or `mqtts://broker:8883`),
        - username/password (optional),
        - TLS options (ca, cert, key, rejectUnauthorized),
        - clientId / cleanSession,
        - base topic (default `zigbee2mqtt`).
    - Security note: prefer `mqtts` with verified certificates in non-local deployments.
- MQTT integration:
    - connect using the `mqtt` library,
    - subscribe to key topics (see §3.2),
    - publish commands to control devices.
- Device discovery and registry:
    - consume `\<base\>/bridge/devices` retained payload to build an internal registry of devices,
    - keep basic info: `ieee_address`, `friendly_name`, `definition` (vendor/model/description), `exposes`, `type`, `power_source`, etc.,
    - optionally track `bridge/groups` for future group control.
- Mapping to Smart Panel model:
    - for each Zigbee device (non-coordinator, `supported: true`), create:
        - a **Device** entity (one per `friendly_name`),
        - one or more **Channels** based on `exposes` (e.g. light, switch, climate),
        - **Properties** representing individual controls and sensors:
            - on/off, brightness, color/color_temp,
            - occupancy, temperature, humidity, power/energy,
            - other basic numerics/binaries where useful.
- State handling:
    - subscribe to `\<base\>/FRIENDLY_NAME` topics,
    - parse JSON payloads into property values using `exposes`,
    - subscribe to `\<base\>/FRIENDLY_NAME/availability` when Device Availability is enabled in Z2M,
    - subscribe to `\<base\>/bridge/state` and `\<base\>/bridge/event` to handle bridge and join/leave events.
- Commands:
    - publish JSON to `\<base\>/FRIENDLY_NAME/set` to control devices (state, brightness, color, etc.),
    - optionally publish non-JSON commands like `\<base\>/FRIENDLY_NAME/set/state` (`ON`/`OFF`) when helpful,
    - ensure bidirectional sync: when command succeeds, state in Smart Panel updates based on Z2M’s published state.
- Basic support for core device types:
    - lights (on/off, brightness, color_temp, color_hs/xy),
    - switches,
    - climate (thermostats) at least for temperature + mode,
    - binary sensors (occupancy, contact),
    - numeric sensors (temperature, humidity, power, energy).

### 3.2 MQTT contract (based on Zigbee2MQTT docs)

_This section encodes the minimal MQTT contract the plugin should rely on._

Assume `base` is the configured base topic (default `zigbee2mqtt`).

#### Per-device topics

- **State**
    - Topic: `\<base\>/FRIENDLY_NAME`
    - Payload: JSON object; fields depend on device and its `exposes`.
    - Examples:
        - Temperature/humidity sensor:
          ```json
          { "temperature": 27.34, "humidity": 44.72 }
          ```
        - Wireless switch:
          ```json
          { "action": "single" }
          ```
        - Motion sensor:
          ```json
          { "occupancy": true }
          ```
        - Dimmable white bulb:
          ```json
          { "state": "ON", "brightness": 215, "color_temp": 325 }
          ```

- **Availability** (if enabled in Zigbee2MQTT):
    - Topic: `\<base\>/FRIENDLY_NAME/availability`
    - Payload: JSON describing online/offline; plugin should treat any documented offline/online payloads accordingly.

- **Commands**
    - Topic: `\<base\>/FRIENDLY_NAME/set`
    - Payload: JSON, only keys supported in device `exposes`:
      ```json
      {
        "state": "ON",
        "brightness": 255,
        "color": { "x": 0.123, "y": 0.123 }
      }
      ```
    - Optionally, non-JSON:
        - Topic: `\<base\>/FRIENDLY_NAME/set/state`
        - Payload: `ON` / `OFF` / `TOGGLE`.

- **Get requests (optional for later)**
    - Topic: `\<base\>/FRIENDLY_NAME/get`
    - Payload: e.g. `{ "state": "" }` to read a specific value.

#### Bridge topics

- **Devices registry**
    - Topic: `\<base\>/bridge/devices` (retained)
    - Payload: JSON array of devices, each like:
      ```json
      {
        "ieee_address": "0x00158d00018255df",
        "type": "Router",
        "friendly_name": "my_plug",
        "definition": {
          "model": "ZNCZ02LM",
          "vendor": "Xiaomi",
          "description": "Mi power plug Zigbee",
          "exposes": [ /* see Exposes */ ],
          "options": [ /* device options */ ]
        },
        "supported": true,
        "disabled": false,
        "power_source": "Mains (single phase)",
        "interview_state": "SUCCESSFUL"
      }
      ```
    - The plugin should:
        - ignore the coordinator entry (`type: "Coordinator"`),
        - skip unsupported devices (`supported: false`),
        - use `friendly_name` as the primary identifier for MQTT topics,
        - use `definition.exposes` as the canonical description of capabilities.

- **Bridge state**
    - Topic: `\<base\>/bridge/state` (retained)
    - Payload:
        - `{"state":"online"}`
        - `{"state":"offline"}`

- **Bridge events**
    - Topic: `\<base\>/bridge/event`
    - Payload: events like:
        - `device_joined`, `device_announce`, `device_interview`, `device_leave`, etc.
    - The plugin may listen to this topic to:
        - detect join/leave and update mappings accordingly,
        - update metadata when definition changes.

- **Groups**
    - Topic: `\<base\>/bridge/groups` (retained)
    - Payload: JSON array of groups with:
        - `id`, `friendly_name`, `members`, optional `scenes`.
    - Initial implementation may treat groups as **out of scope** or map them later.

### 3.3 Exposes mapping (based on Z2M `exposes` docs)

Z2M describes device capabilities via `definition.exposes` as a combination of:

- **Generic types**: `binary`, `numeric`, `enum`, `text`, `composite`, `list`.
- **Specific types**: `light`, `switch`, `fan`, `cover`, `lock`, `climate`, etc.

Each expose generally has:

- `type`: kind of expose (e.g. `numeric`, `binary`, `light`),
- `name`: logical name (e.g. `temperature`, `brightness`, `state`),
- `label`: human-readable label (e.g. `Temperature`, `Brightness`),
- `property`: JSON property name in MQTT payload (e.g. `temperature`, `brightness`, `state`, `color`, `color_temp`, etc.),
- `access`: bitmask:
    - `1` – appears in published state,
    - `2` – can be set with `/set`,
    - `4` – can be retrieved with `/get`,
    - combined (e.g. `7` = `1+2+4`).

The plugin should:

- Use `exposes` as the **primary source of truth** for mapping.
- For specific types like `light`, `switch`, `climate`, inspect their `features` array to define channels and properties:
    - `light` → channel of type light with properties:
        - `state` (binary, `value_on` / `value_off` / `value_toggle`),
        - `brightness` (numeric, range from `value_min`/`value_max`),
        - `color_temp`/`color_xy`/`color_hs` if present.
    - `switch` → channel with binary `state`.
    - `climate` → channel with properties like:
        - `local_temperature`, `occupied_heating_setpoint`, `system_mode`, etc.
- Respect `access` bits:
    - only create **writable** properties when `access & 2` is set,
    - treat **read-only** properties when `access & 1` is set but `access & 2` is not,
    - ignore purely diagnostic/config exposes if desired (e.g. `category: "diagnostic"`).

## 4. Acceptance criteria

- [ ] New Zigbee2MQTT plugin exists in the backend modules structure (e.g. `plugins/zigbee2mqtt` or similar, consistent with existing plugins).
- [ ] Plugin can be **enabled/disabled** via the existing configuration system.
- [ ] Plugin connects to the configured MQTT broker using the `mqtt` library and respects:
    - base topic,
    - credentials,
    - reconnect logic.
- [ ] On startup (when enabled) the plugin:
    - [ ] subscribes to `\<base\>/bridge/devices`, `\<base\>/bridge/state`, `\<base\>/bridge/event`,
    - [ ] subscribes to `\<base\>/+/availability` and `\<base\>/+` (or equivalent filtered subscriptions),
    - [ ] builds an internal device registry from `bridge/devices`,
    - [ ] creates corresponding **Device**, **Channel**, and **Property** entities in the Smart Panel backend for supported devices.
- [ ] For at least these device types:
    - [ ] **Light** (on/off, brightness, color_temp or color),
    - [ ] **Switch** (on/off),
    - [ ] **Binary sensor** (e.g. occupancy),
    - [ ] **Numeric sensor** (e.g. temperature),
      mapping from `exposes` to channels/properties is correct and state is synchronized.
- [ ] Property values are updated when:
    - [ ] device state changes (messages on `\<base\>/FRIENDLY_NAME`),
    - [ ] device availability changes (messages on `\<base\>/FRIENDLY_NAME/availability`).
- [ ] Commands sent via Smart Panel API (e.g. toggling a light, setting brightness) are published to `\<base\>/FRIENDLY_NAME/set` and:
    - [ ] are reflected back in Z2M state messages,
    - [ ] update Smart Panel property values accordingly.
- [ ] All new services have **unit tests**:
    - [ ] MQTT integration (at least mocked client-level tests),
    - [ ] mapping layer (Z2M `exposes` + state JSON → Smart Panel properties),
    - [ ] command layer (Smart Panel commands → Z2M `/set` payloads).
- [ ] No breaking changes to other plugins or devices.

## 5. Example scenarios

### Scenario: Switching a Zigbee light on/off

Given Zigbee2MQTT is running and exposes a dimmable light  
And the Z2M plugin is enabled and configured to connect to the broker  
When the plugin starts and reads `bridge/devices`  
Then it creates a Device with a light channel and properties `state` and `brightness`

When I toggle the `state` property via the Smart Panel API  
Then the plugin publishes a command to `\<base\>/my_light/set` (e.g. `{ "state": "ON" }`)  
And Zigbee2MQTT publishes the new state to `\<base\>/my_light`  
And the Smart Panel backend updates the property accordingly.

### Scenario: Receiving occupancy events

Given Zigbee2MQTT exposes a motion sensor with `occupancy: true/false`  
When motion is detected and Z2M publishes `{ "occupancy": true }` to `\<base\>/motion_sensor`  
Then the plugin updates the corresponding property in the Smart Panel backend  
And any connected UI can react to the change.

### Scenario: Handling device availability

Given a Zigbee device is configured with Device Availability  
When it goes offline and Z2M publishes to `\<base\>/device/availability`  
Then the plugin marks the device/channel as offline in the backend.

## 6. Technical constraints

- Use the **`mqtt`** npm package for MQTT connectivity.
- Prefer a small dedicated **Zigbee2MQTT adapter/service** layer which:
    - encapsulates all MQTT topic strings and parsing,
    - exposes events/callbacks for:
        - bridge state changes,
        - device registry updates,
        - per-device state changes,
        - availability changes.
- Keep mapping logic in a separate service which:
    - knows how to interpret `exposes`,
    - creates/updates Devices/Channels/Properties.
- Reuse existing Smart Panel patterns:
    - plugin registration,
    - config handling,
    - logging style,
    - error handling.
- Do not hard-code a specific Z2M version; rely on documented fields like `exposes`, `options`, `friendly_name`, etc.
- Keep the implementation **resilient**:
    - handle malformed payloads gracefully,
    - log unexpected messages without crashing the plugin.

## 7. Implementation hints

- Start with a **minimal adapter**:
    1. Connect to MQTT broker.
    2. Subscribe to `\<base\>/bridge/state` and log online/offline.
    3. Subscribe to `\<base\>/bridge/devices` and parse the registry.
- Build a small **device registry** structure:
    - keyed by `friendly_name`,
    - containing `ieee_address`, `definition.exposes`, etc.
- Implement **exposes → model mapping**:
    - Start with a limited set:
        - `light` (state, brightness, color_temp/color),
        - `switch` (state),
        - `binary` (occupancy/contact),
        - `numeric` (temperature, humidity).
    - Use `access` bits to decide read/write capabilities.
- Implement **state updates** by:
    - listening to `\<base\>/+/+` or more targeted subscriptions,
    - routing by `friendly_name`,
    - updating corresponding properties in the backend.
- Implement **commands**:
    - for writable properties, generate appropriate JSON payloads to `/set` topics,
    - keep payloads aligned with `exposes` (e.g. property names, value ranges).
- Add **unit tests** with a mocked `mqtt` client:
    - simulate incoming `bridge/devices` and state messages,
    - verify that Devices/Channels/Properties are created and updated,
    - verify that commands publish the expected MQTT messages.

## 8. AI instructions

- Read this file fully before coding.
- Respect global rules in `/.ai-rules/GUIDELINES.md`.
- Treat Zigbee2MQTT docs reflected in §3.2 and §3.3 as the **canonical contract** for this plugin.
- Before changing code, propose a **5–10 step implementation plan** that covers:
    - MQTT adapter,
    - device registry,
    - exposes-based mapping,
    - state updates,
    - commands,
    - tests.
- Implement in **small, reviewable steps**:
    - adapter + config,
    - registry + mapping,
    - state/availability,
    - commands,
    - tests.
- Do not modify admin or panel apps in this task.
- Keep the plugin isolated so it can be enabled/disabled without affecting other modules.
