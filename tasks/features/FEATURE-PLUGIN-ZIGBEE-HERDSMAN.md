# Task: Direct Zigbee device integration via zigbee-herdsman
ID: FEATURE-PLUGIN-ZIGBEE-HERDSMAN
Type: feature
Scope: backend, admin
Size: large
Parent: (none)
Status: planned

## 1. Business goal

In order to control Zigbee devices without requiring a separate Zigbee2MQTT instance,
As a Smart Panel user with a USB Zigbee coordinator,
I want a native plugin that communicates directly with Zigbee devices using zigbee-herdsman so that the system is self-contained and has fewer external dependencies.

## 2. Context

- **zigbee-herdsman** (`zigbee-herdsman@10.x`) is the Node.js library that zigbee2mqtt itself uses internally. It handles direct serial communication with Zigbee coordinators (CC2652, ConBee II/III, SONOFF ZBDongle-P/E, EFR32, etc.) and manages the Zigbee network stack (ZNP, Ember, deConz, ZiGate adapters).
- **zigbee-herdsman-converters** (`zigbee-herdsman-converters@26.x`) provides 3000+ device definitions with `fromZigbee`/`toZigbee` converters and `exposes` definitions. This is the same converter database used by zigbee2mqtt.
- The existing **devices-zigbee2mqtt** plugin communicates via MQTT to a Zigbee2MQTT bridge. This new plugin eliminates that middleware by embedding the Zigbee stack directly.
- The existing Z2M plugin's **converter architecture** (`converters/`, `mappings/`) translates Z2M exposes into Smart Panel's Device → Channel → Property model. The exposes format from zigbee-herdsman-converters is the same as what Z2M exposes, so the converter/mapping layer can be **reused with minimal changes**.
- Existing plugins to reference: `devices-zigbee2mqtt` (converter architecture, adoption flow), `devices-wled` (mDNS + HTTP pattern), `devices-home-assistant` (WebSocket + adoption flow).
- Hardware access: requires serial port access (`serialport` npm package) to the USB coordinator. The coordinator is exclusively locked — cannot run alongside Zigbee2MQTT on the same dongle.

### Key differences from zigbee2mqtt plugin

| Aspect | Z2M Plugin | Zigbee Herdsman Plugin |
|--------|-----------|----------------------|
| Communication | MQTT to Z2M bridge | Direct serial to coordinator |
| Dependency | External Z2M instance | Self-contained (no external process) |
| Device database | Z2M's bridge/devices topic | zigbee-herdsman-converters |
| State transport | MQTT topics | In-process events |
| Network management | Delegated to Z2M | Must handle directly (channel, PAN ID, network key) |
| OTA updates | Z2M handles | Must implement or skip |
| Device interview | Z2M handles | zigbee-herdsman handles natively |

## 3. Scope

**In scope**

- Backend plugin `devices-zigbee-herdsman` with full lifecycle (start/stop/restart)
- Zigbee coordinator configuration (serial port, baud rate, adapter type, channel, PAN ID, network key)
- Zigbee network formation and management
- Device joining (permit join with timeout)
- Device interview and identification via zigbee-herdsman-converters definitions
- Real-time device state updates via zigbee-herdsman events
- Device command execution (set property values → toZigbee converters)
- Mapping zigbee-herdsman-converters `exposes` to Smart Panel Device/Channel/Property model (reuse Z2M converter architecture)
- Device adoption flow (discover → preview mapping → confirm → adopt) — same pattern as Z2M plugin
- Admin UI for plugin configuration (serial port, network settings)
- Admin UI for device discovery/adoption
- Connection state tracking per device (online/offline via lastSeen + timeout)
- Coordinator firmware info display
- Device removal from Zigbee network
- Group management (basic — create/delete Zigbee groups)

**Out of scope**

- OTA firmware updates for Zigbee devices (future task)
- Zigbee network visualization/map
- Coordinator firmware flashing
- Panel (Flutter) UI changes — uses existing device/channel/property display
- Touchlink commissioning
- Green Power devices
- Inter-PAN communication
- Running alongside Zigbee2MQTT on the same coordinator (mutually exclusive)

## 4. Acceptance criteria

### Phase 1 — Core infrastructure & coordinator management

- [ ] New plugin directory `apps/backend/src/plugins/devices-zigbee-herdsman/` with standard plugin structure
- [ ] Plugin module registered with NestJS, discoverable by extension system
- [ ] Plugin entities: `ZigbeeHerdsmanDeviceEntity`, `ZigbeeHerdsmanChannelEntity`, `ZigbeeHerdsmanChannelPropertyEntity` extending base entities
- [ ] Device entity stores: `ieeeAddress` (string), `networkAddress` (number), `manufacturerName` (string|null), `modelId` (string|null), `dateCode` (string|null), `softwareBuildId` (string|null), `interviewCompleted` (boolean)
- [ ] Channel property entity stores: `zigbeeCluster` (string|null), `zigbeeAttribute` (string|null) for mapping back to ZCL
- [ ] Plugin config model with fields: `serialPort` (string), `baudRate` (number, default 115200), `adapterType` (enum: zstack, ember, deconz, zigate, auto), `channel` (number, default 11), `panId` (number), `extendedPanId` (number[]), `networkKey` (number[]), `permitJoinTimeout` (number, default 254 seconds)
- [ ] Config validation service that checks serial port accessibility
- [ ] `ZigbeeHerdsmanAdapterService` — wraps `zigbee-herdsman` Controller with start/stop/restart
- [ ] Adapter service handles coordinator options: serial port, adapter type, network config, database path (`data/zigbee-herdsman.db`)
- [ ] Adapter service emits typed events: `deviceJoined`, `deviceInterview`, `deviceLeave`, `deviceAnnounce`, `message`, `adapterDisconnected`
- [ ] `ZigbeeHerdsmanService` implements `IManagedPluginService` with proper lifecycle (start → initialize controller → form/join network → listen for events)
- [ ] Service gracefully handles coordinator disconnection and attempts reconnection
- [ ] Service registers with `PluginServiceManagerService` and `PlatformRegistryService`
- [ ] Plugin metadata registered with `ExtensionsService` (name, description, author, readme)

### Phase 2 — Device discovery & converter integration

- [ ] On startup, iterate `controller.getDevices()` to load known devices
- [ ] Listen to `deviceJoined` + `deviceInterview` events for new devices
- [ ] Use `zigbee-herdsman-converters` `findByDevice()` to resolve device definitions from zigbee model ID
- [ ] Extract `exposes` from device definition — these are the same format as Z2M exposes
- [ ] Reuse or adapt the Z2M plugin's converter registry (`converters/converter.registry.ts`) to map exposes → Smart Panel channels/properties
- [ ] Reuse or adapt the Z2M plugin's mapping layer (`mappings/`) for value transformation
- [ ] `ZigbeeDiscoveredDevicesService` maintains an in-memory registry of paired-but-not-adopted devices
- [ ] Each discovered device record includes: IEEE address, friendly name (defaults to model + short addr), model, vendor, description, exposes, interview status, last seen timestamp
- [ ] Devices that fail interview are still listed with a "interview incomplete" status
- [ ] `ZigbeeDeviceConnectivityService` tracks online/offline state based on `lastSeen` + configurable timeout (default 3600s for mains, 7200s for battery)

### Phase 3 — Device adoption & state synchronization

- [ ] `ZigbeeMappingPreviewService` generates channel/property mapping preview from exposes (reuse Z2M pattern)
- [ ] `ZigbeeDeviceAdoptionService` creates Device/Channel/Property entities from confirmed mapping
- [ ] Adoption assigns device category based on primary exposes (light → LIGHTING, switch → OUTLET, climate → THERMOSTAT, sensor → SENSOR, etc.)
- [ ] REST controller `ZigbeeHerdsmanDiscoveredDevicesController` with endpoints:
  - `GET /api/plugins/devices-zigbee-herdsman/discovered-devices` — list discovered unadopted devices
  - `GET /api/plugins/devices-zigbee-herdsman/mapping-preview/:ieeeAddress` — preview channel/property mapping
  - `POST /api/plugins/devices-zigbee-herdsman/adopt` — adopt device with confirmed mapping
  - `DELETE /api/plugins/devices-zigbee-herdsman/devices/:ieeeAddress` — remove device from Zigbee network
  - `POST /api/plugins/devices-zigbee-herdsman/permit-join` — enable/disable permit join (with timeout)
  - `GET /api/plugins/devices-zigbee-herdsman/coordinator-info` — coordinator firmware, type, channel info
- [ ] All endpoints decorated with Swagger/OpenAPI annotations
- [ ] Incoming `message` events from zigbee-herdsman processed through `fromZigbee` converters to extract property values
- [ ] Property values written to `PropertyValueService` and broadcast via WebSocket
- [ ] `ZigbeeHerdsmanDevicePlatform` implements `IDevicePlatform` to handle outgoing commands
- [ ] Platform handler resolves the correct `toZigbee` converter for each property
- [ ] Platform handler calls `device.getEndpoint(n).command()` or `.write()` with the correct ZCL cluster/attribute
- [ ] Batch command support: multiple property updates grouped per endpoint to reduce Zigbee traffic
- [ ] Command retry logic with configurable attempts (default 3) for unreliable devices

### Phase 4 — Admin UI

- [ ] Plugin configuration form in admin: serial port input (with auto-detect dropdown), baud rate, adapter type selector, channel number, advanced network settings (PAN ID, network key) with sensible defaults
- [ ] Network status indicator showing coordinator state (online/offline/forming)
- [ ] "Permit Join" toggle button with countdown timer
- [ ] Discovered devices list with columns: model, vendor, IEEE address, interview status, signal quality (LQI)
- [ ] Device adoption form: category selector, channel/property preview with checkboxes, custom name input
- [ ] Device removal confirmation dialog
- [ ] Coordinator info panel: firmware version, adapter type, current channel, number of paired devices

### Phase 5 — Zigbee network management

- [ ] Network key generation on first startup (random 16-byte key) with persistent storage
- [ ] PAN ID auto-generation if not configured
- [ ] Channel selection validation (must be one of: 11, 15, 20, 25 recommended; 11-26 allowed)
- [ ] Permit join broadcasts to all routers (not just coordinator)
- [ ] Device leave handling: mark device offline, optionally remove entities
- [ ] Basic group support: create group, add device to group, remove device from group, send commands to group
- [ ] Zigbee network backup/restore via database file

### Cross-cutting

- [ ] Unit tests for converter integration, adoption service, connectivity tracking
- [ ] E2E tests for discovery → adoption → command flow (with mocked zigbee-herdsman Controller)
- [ ] Plugin is completely isolated — disabling it has no effect on other plugins
- [ ] Existing Z2M plugin continues to work independently (both cannot use the same coordinator simultaneously)
- [ ] Database migration for new entity columns

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: First-time coordinator setup

Given the plugin is enabled with a valid serial port configuration
When the service starts for the first time
Then a new Zigbee network is formed with a random PAN ID, network key, and configured channel
And the coordinator info endpoint returns the network details
And the service state is "started"

### Scenario: Device pairing

Given the Zigbee network is running and permit join is enabled
When a new Zigbee device is powered on and enters pairing mode
Then a `deviceJoined` event is received with the device's IEEE address
And the device interview begins automatically
And once interview completes, the device appears in the discovered-devices list
And the device definition is resolved from zigbee-herdsman-converters

### Scenario: Device adoption

Given a discovered Aqara temperature/humidity sensor (WSDCGQ11LM)
When the admin requests a mapping preview for the device
Then the preview shows: a "temperature" channel with temperature property (°C, read-only), a "humidity" channel with humidity property (%, read-only), a "pressure" channel with pressure property (hPa, read-only), and a "battery" channel with battery percentage
When the admin confirms adoption with category SENSOR
Then Device, Channel, and Property entities are created in the database
And incoming ZCL attribute reports update the property values in real-time

### Scenario: Light control

Given an adopted IKEA TRADFRI bulb (LED1545G12)
When the admin sets brightness to 75% via the Smart Panel UI
Then the platform handler resolves the `toZigbee` converter for brightness
And sends a `genLevelCtrl.moveToLevelWithOnOff` command with level=191 (75% of 254)
And the bulb adjusts brightness
And the next `attributeReport` confirms the new level

### Scenario: Coordinator disconnection

Given the Zigbee network is running with 5 paired devices
When the USB coordinator is physically unplugged
Then an `adapterDisconnected` event is received
And all device states are set to "offline"
And the service attempts reconnection with exponential backoff
When the coordinator is plugged back in
Then the service reconnects and resumes normal operation

## 6. Technical constraints

- Follow existing plugin structure from `devices-zigbee2mqtt` and `devices-wled`
- Plugin directory: `apps/backend/src/plugins/devices-zigbee-herdsman/`
- Entity type prefix: `devicesZigbeeHerdsmanPlugin`
- API route prefix: `devices/zigbee-herdsman`
- Config plugin name: `devices-zigbee-herdsman`
- New npm dependencies: `zigbee-herdsman@^10.0.0`, `zigbee-herdsman-converters@^26.0.0`, `serialport@^12.0.0`
- The `serialport` package has native bindings — ensure it compiles on arm64 (Raspberry Pi) and x64
- zigbee-herdsman uses a local JSON database file — store at `data/zigbee-herdsman.db` (configurable)
- The zigbee-herdsman Controller must be started/stopped cleanly — improper shutdown can corrupt the database
- Do not modify the existing Z2M plugin code; the two plugins are independent
- Do not modify generated code (spec/, openapi.json, API clients)
- Reuse converter patterns from Z2M plugin where possible, but create separate copies in the new plugin directory to avoid coupling
- Tests are expected for: adapter service, converter integration, adoption service, platform handler, connectivity tracking
- TypeScript: tabs, 120 char width, single quotes, semicolons

## 7. Implementation hints

### Reusable from Z2M plugin

- **Converter architecture**: Copy and adapt `converters/converter.interface.ts`, `converters/base.converter.ts`, `converters/converter.registry.ts`. The `canHandle(expose)` / `convert(expose)` pattern works identically since zigbee-herdsman-converters uses the same exposes format.
- **Mapping layer**: Copy and adapt `mappings/` for value transformers (0-254 → 0-100% brightness, etc.)
- **Adoption flow**: Mirror `services/mapping-preview.service.ts`, `services/device-adoption.service.ts`, and the controller pattern from `controllers/zigbee2mqtt-discovered-devices.controller.ts`.
- **Entity structure**: Follow the same ChildEntity pattern as Z2M entities.

### zigbee-herdsman Controller initialization

```typescript
import { Controller } from 'zigbee-herdsman';

const controller = new Controller({
  network: { panID, extendedPanID, channelList: [channel], networkKey },
  serialPort: { path: serialPort, baudRate, rtscts: false, adapter: adapterType },
  databasePath: 'data/zigbee-herdsman.db',
  databaseBackupPath: 'data/zigbee-herdsman-backup.db',
  adapter: { concurrent: 16, delay: 0 },
  acceptJoiningDeviceHandler: async (ieeeAddr) => true,
});

await controller.start();
controller.on('message', (msg) => { /* fromZigbee conversion */ });
controller.on('deviceJoined', (device) => { /* add to discovered */ });
controller.on('deviceInterview', ({ device, status }) => { /* update interview state */ });
controller.on('deviceLeave', (device) => { /* mark offline / remove */ });
```

### Device definition resolution

```typescript
import { findByDevice } from 'zigbee-herdsman-converters';

const definition = await findByDevice(device);
// definition.exposes — same format as Z2M exposes
// definition.fromZigbee — converters for incoming messages
// definition.toZigbee — converters for outgoing commands
```

### Command execution pattern

```typescript
// For toZigbee converters:
const result = await converter.convertSet(endpoint, key, value, meta);
// result.state — updated state to emit
// The converter internally calls endpoint.command() or endpoint.write()
```

### Admin UI reference

- Look at `apps/admin/src/plugins/devices-zigbee2mqtt/` for the Z2M admin UI structure
- Copy the discovered-devices list and adoption form patterns
- Add serial port configuration specific to this plugin
- The configuration page should warn if the serial port is in use by another process

### Things to avoid

- Do NOT try to run zigbee-herdsman and zigbee2mqtt on the same coordinator
- Do NOT store the network key in plain text in the API response — mask it
- Do NOT start the herdsman controller without a valid serial port config
- Do NOT block the Node.js event loop during device interview (it's async internally)
- Do NOT use `controller.stop()` without awaiting it — database corruption risk

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 12 steps).
- Implement in phases: Phase 1 first, then 2, then 3, then 4, then 5.
- After Phase 1, run `/test backend` to verify no regressions.
- For the converter layer, start by copying the Z2M converter interface and registry, then adapt for direct zigbee-herdsman-converters integration.
- When implementing the adapter service, mock the zigbee-herdsman Controller in tests (do not require actual hardware).
- For the admin UI, follow the exact same component structure as the Z2M admin plugin.
- Keep changes scoped to this task and its `Scope` (backend + admin).
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
