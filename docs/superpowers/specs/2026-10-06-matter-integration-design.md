# Matter Bridge and Controller — Analysis and Design

**Status:** Draft for review
**Date:** 2026-10-06
**Scope:** backend, admin, installer, spec, website; panel untouched
**Epic task file:** `tasks/epics/EPIC-MATTER.md`
**GitHub epic:** [#1191](https://github.com/FastyBird/smart-panel/issues/1191) (child tasks MT-1 … MT-20)
**Supersedes:** `tasks/features/FEATURE-PLUGIN-MATTER.md` (controller-only draft from 2025-11-14)

## Goal

Make Smart Panel a citizen of the Matter ecosystem in two directions:

1. **Bridge (export).** Expose devices that Smart Panel already controls (Shelly, Zigbee2MQTT, Home Assistant,
   Homey, WLED, virtual devices, ...) as a Matter bridge, so that Apple Home, Google Home, Amazon Alexa, SmartThings
   or Home Assistant can see and control them, even though the devices themselves have no Matter support. This is
   the primary goal.
2. **Controller (import).** Commission Matter devices (for example IKEA KAJPLATS bulbs, Matter smart plugs, sensors,
   or another vendor's Matter bridge such as IKEA DIRIGERA) into Smart Panel as native devices, the same way the
   Zigbee2MQTT or Homey plugins bring devices in. This is the secondary goal.

Both roles are delivered by one plugin, `devices-matter`, built on [matter.js](https://github.com/project-chip/matter.js).

## Summary of findings

| Question | Answer |
| --- | --- |
| Can Smart Panel be a Matter bridge for Apple / Google / Alexa / SmartThings / HA? | **Yes.** matter.js implements the full device side (Aggregator + Bridged Nodes) and multi-admin; one pairing can be shared by several ecosystems at the same time. |
| Can it bring Matter devices in? | **Yes, for devices reachable over IP.** Wi-Fi/Ethernet devices and Thread devices behind an existing Thread Border Router can be commissioned with a pairing code. Brand-new Thread devices cannot be onboarded from the Pi alone (see [What cannot be done](#what-cannot-be-done)). |
| Can both run in one process? | **Yes.** matter.js supports several `ServerNode`s in one process with a shared mDNS service; the controller node binds an ephemeral port, the bridge keeps 5540. |
| Do we need certification? | **Not to work; yes to look official.** An open-source build ships test attestation certificates (VID `0xFFF1`). Apple shows "Uncertified accessory → Add anyway", Google requires a free Developer Console integration per user, Alexa, SmartThings and HA accept it. Production certification (CSA membership + per-install DAC issuance) is out of reach for this project. |
| New dependency? | `@matter/main` (Apache-2.0, pure JS, dual ESM/CJS build). BLE (`@matter/nodejs-ble`, native) only in a later, optional milestone. |
| Biggest risks | Build toolchain (CJS NestJS vs. matter.js subpath exports, Jest and ESM-only transitive deps), networking (IPv6, mDNS, host networking in Docker), ecosystem fragmentation (per-ecosystem device-type support and device count limits), matter.js API churn. All are addressed by a compatibility spike before any production code. |

## Background

### What Matter is, in the terms of this codebase

- A **node** is one Matter device on the IP network. It has **endpoints**; each endpoint has a **device type**
  (On/Off Light, Thermostat, ...) and **clusters** (OnOff, LevelControl, ...) with attributes, commands and events.
- A **fabric** is one controller's administrative domain (Apple Home, Google Home, ...). A node can belong to up to
  254 fabrics at once (**multi-admin**).
- A **bridge** is a node whose endpoint 1 is an **Aggregator**; each child endpoint is a **Bridged Node** that
  represents a non-Matter device and carries a `BridgedDeviceBasicInformation` cluster (name, unique id,
  `reachable`).
- **Commissioning** = adding a node to a fabric using its setup passcode (QR code `MT:...` or 11-digit manual
  code). On-network commissioning uses mDNS (`_matterc._udp`); BLE commissioning is used for devices that are not yet
  on any network.
- **Thread** is a low-power IPv6 mesh. Thread devices reach the LAN through a **Thread Border Router (TBR)**
  (Apple TV / HomePod mini, Google Nest hubs, IKEA DIRIGERA, Home Assistant + OTBR, ...).

Smart Panel's model maps naturally: **device ↔ bridged node**, **channel ↔ endpoint**, **property ↔ attribute**.

### Existing Smart Panel assets

- **`devices-homekit` plugin** (`apps/backend/src/plugins/devices-homekit/`) is an export-only HAP bridge and the
  template for the Matter bridge. Patterns to reuse:
  - `IManagedExtensionService` with a lifecycle mutex and `onConfigChanged → { restartRequired }` only for identity
    and network fields.
  - Explicit allow-list `mapped_device_ids`, a candidates endpoint with compatibility and suggested type, a setup
    wizard with QR and setup code.
  - Plugin config mutation registered pre-commit (validation) with post-commit reconciliation and compensation on
    failure.
  - Mapper registry keyed by channel category, staged bindings with snapshot/rollback, `propertyId`-indexed
    binding registry.
  - Writes routed through `PropertyCommandService.executePropertyCommandById` / `executePropertyCommands`;
    optimistic pending writes with tokens; `ValueSet` treated as the accepted value
    (`docs/optimistic-ui-architecture.md`).
  - Pairing storage in a 0700 directory under `FB_CONFIG_PATH`, failing closed; credentials as `secretFields`;
    status events routed to admins only and redacted in the websocket gateway.
  - Known gaps that the Matter bridge must not repeat: no listeners for device deletion or structure changes, no
    offline ("No Response") mapping, one primary mapper per device, private-API access for pairing status. The
    HomeKit gaps themselves are tracked in #1220 (renames are out of scope there: Apple Home keeps its own name
    once an accessory is added).
- **Device providers** (`devices-wled`, `devices-zigbee2mqtt`, `devices-homey`) are the template for the controller:
  `@ChildEntity` device/channel/property subclasses, an `IDevicePlatform` registered in `PlatformRegistryService`,
  a wizard session controller on the backend and an `IDeviceWizardAdapter` in the admin.
- **Device events** a bridge consumes (`modules/devices/devices.constants.ts`):
  `DevicesModule.ChannelProperty.ValueSet`, `DevicesModule.ChannelProperty.Updated`,
  `DevicesModule.ChannelInput.Occurrence`, `DevicesModule.Device.ConnectionChanged`, `DevicesModule.Device.Updated`,
  `DevicesModule.Device.Deleted`, `DevicesModule.Channel.*`.
- **mDNS** today: `bonjour-service` (core `mdns` module, WLED and HA discovery), `ciao` (HomeKit, with the
  `ciao-receive-guard` that fixed a backend crash when an interface lost IPv4), and `avahi-daemon` on the
  Raspberry Pi image. matter.js adds its own responder on UDP 5353.
- **Backups** include the whole `FB_CONFIG_PATH` (except `seed`), so Matter fabric storage placed there is backed up
  automatically.

### Library choice

| Option | Verdict |
| --- | --- |
| **matter.js** (`@matter/main` 0.17.x, Matter 1.6) | **Chosen.** TypeScript, Apache-2.0, pure JS, device + controller in one library, dual ESM/CJS builds, default cluster implementations (Thermostat, DoorLock, ...), OTA, DCL attestation. Used in production by Matterbridge, ioBroker.matter and the Open Home Foundation `matterjs-server` that replaced python-matter-server in Home Assistant (June 2026). |
| connectedhomeip C++ SDK (chip-tool, python bindings) | Rejected: native build per architecture, heavy, separate process, no fit for a NestJS plugin. |
| External `matterjs-server` / python-matter-server over WebSocket | Rejected for the MVP: an extra service to install and supervise, controller-only (no bridge). Kept as a possible later "connect to an existing Matter server" mode for Home Assistant users; the controller adapter is designed so that a remote backend could be added. |
| Matterbridge as a sidecar | Rejected: duplicates our device model and plugin system; we would have to write a Matterbridge plugin that talks back to Smart Panel. |

## Product decision

### Bridge (milestones 1–2)

- One Matter bridge node per installation named "Smart Panel Bridge" (configurable), Aggregator on endpoint 1.
- The administrator selects which Smart Panel devices are exposed (allow-list, like HomeKit). Nothing is exposed
  automatically.
- Each exposed device becomes one bridged node. A single-function device puts its device type directly on the
  bridged endpoint; a multi-function device becomes a Bridged Node with one child endpoint per mapped channel. This
  fixes HomeKit's "one primary mapper per device" limitation.
- The bridge can be paired with several ecosystems at once. The admin shows the paired fabrics (Apple, Google,
  Amazon, Samsung, HA, unknown), can remove one, and can open a new commissioning window to add another ecosystem
  without going through the first one.
- Reachability (`reachable` ↔ Smart Panel connection state), deletions and structure changes follow Smart Panel
  live; adding or removing devices does not require re-pairing. Renames are pushed as `NodeLabel`, but whether a
  controller updates the name it shows after the device was added is controller-dependent (each ecosystem keeps
  its own user-editable name); MT-1 and MT-8 record the behaviour per ecosystem and the docs state it.
- Devices that Smart Panel itself controls **through Matter** (milestone 3) are never exposed through the bridge:
  they are already Matter devices and can be shared with other ecosystems directly (multi-admin). Re-exporting
  them would create duplicates and loops and is outside the spec's intent for bridges.
- The HomeKit bridge stays. HAP works without an Apple home hub and is certified-free in the same way; the
  Matter bridge adds Google, Alexa, SmartThings and HA. The admin warns when the same device is exposed through
  both bridges, because Apple Home would show it twice.

### Controller (milestone 3)

- Smart Panel runs a Matter controller with its own fabric ("Smart Panel").
- Supported onboarding paths, in order of priority:
  1. **Multi-admin share** — the user opens "pairing mode" / "turn on pairing mode" for a device that is already in
     Apple Home, Google Home, IKEA Home smart, SmartThings or HA and enters the code in Smart Panel. Works for
     Wi-Fi, Ethernet **and Thread** devices (Thread via the existing border router). This is the main path.
  2. **On-network commissioning** of a device that is already on the LAN and in commissioning mode (Ethernet
     devices, Wi-Fi devices provisioned by the vendor app) — discovered via `_matterc._udp` or by entering its code.
  3. **Another vendor's Matter bridge** (IKEA DIRIGERA, Philips Hue Bridge, Aqara hubs, ...) — commissioned like any
     node; every bridged node becomes a separate Smart Panel device.
  4. **BLE commissioning of new Wi-Fi devices** — optional milestone 4; needs Bluetooth hardware and native
     modules.
- Commissioned endpoints are mapped to Smart Panel devices/channels/properties and adopted through the generic
  device wizard. Attribute subscriptions keep values in sync; Smart Panel commands become cluster commands or
  attribute writes.
- Deleting the Smart Panel device removes Smart Panel's fabric from the node (RemoveFabric); the device stays in
  the user's other ecosystems.
- From Smart Panel the user can open a commissioning window on a controlled device to share it to another
  ecosystem.

#### IKEA specifically

- New IKEA Matter devices (KAJPLATS bulbs, BILRESA remotes, sensors, plugs) are **Matter over Thread**; KAJPLATS
  bulbs additionally have a Zigbee radio.
- Ways to control them from Smart Panel:
  1. **Zigbee via the existing `devices-zigbee2mqtt` plugin** — works today wherever Z2M supports the model, no
     Matter needed.
  2. **Thread device shared via multi-admin** from Apple Home / Google Home / IKEA Home smart (DIRIGERA) to the
     Smart Panel controller — needs a Thread Border Router on the LAN (DIRIGERA, Apple TV/HomePod mini, Nest hub,
     ...) and IPv6 route-information handling on the Smart Panel host (installer task in milestone 3).
  3. **DIRIGERA as a Matter bridge** — commission DIRIGERA into Smart Panel; its Zigbee devices appear as bridged
     nodes.
- Commissioning a factory-new Thread bulb directly from Smart Panel (without a phone ecosystem) is **not
  possible** in this epic; see below.

### Release boundaries

| Milestone | Content |
| --- | --- |
| **0 — Compatibility spike** | matter.js inside the CJS NestJS backend on Node 24, Raspberry Pi and Docker; one bridged light paired with Apple, Google, Alexa, SmartThings and HA simultaneously; one device commissioned as a controller via multi-admin; mDNS coexistence; memory budget; test strategy. Go/no-go gate and ADR. |
| **1 — Bridge MVP** | Plugin runtime and lifecycle, commissioning, fabrics, reset; lights, plugs/switches, sensors, batteries, reachability; admin settings and pairing wizard; installer/network prerequisites; website docs; ecosystem hardware acceptance. |
| **2 — Bridge coverage** | Thermostats/heaters/coolers/AC, window coverings, locks, fans, air purifiers; buttons (Generic Switch), valves, energy metering; robot vacuums on a dedicated node; optional Smart Panel scenes as switches. |
| **3 — Controller** | Connection types in the spec; controller runtime, `devices-matter` device platform, commissioning by code and discovery; mapping of Matter device types to Smart Panel; admin commissioning wizard and node management; Thread readiness on the host; docs; hardware acceptance with IKEA and other devices. |
| **4 — BLE commissioning (optional)** | BLE commissioning of new Wi-Fi Matter devices on the Raspberry Pi image. |

## Non-goals

- Matter certification, a CSA Vendor ID, production device attestation certificates or the Matter logo.
- Running a Thread Border Router on Smart Panel (RCP dongle + OTBR). That is a possible future epic.
- Commissioning factory-new Thread devices without a phone ecosystem or own OTBR.
- Matter cameras and doorbells (Matter 1.5 WebRTC; supported only by SmartThings today), media players and TVs
  (Basic Video Player / Speaker; practically unsupported by ecosystems), alarm/security panels and weather (no
  Matter device type exists).
- Fabric Synchronization (Matter 1.4) and Joint Fabric (Matter 1.6) — no consumer ecosystem ships them yet.
- OTA firmware updates of controlled Matter devices (matter.js supports it; product decision later).
- Matter groups/groupcast, Matter scenes management.
- Panel (Flutter) changes. Controlled Matter devices use standard categories and render with the existing panel
  UI; the bridge is administered from the admin app only.
- Exposing the panel display itself (its sensors or screen) as a Matter device.

## Ecosystem constraints

### Hub, certification and pairing

| Ecosystem | Hub needed | Uncertified (test VID 0xFFF1) | Bridge support | Known limits |
| --- | --- | --- | --- | --- |
| Apple Home | Not for local control since iOS 18; Apple TV/HomePod required for remote access, automations and Thread | "Uncertified accessory" prompt, then "Add anyway" | Yes | ~150 accessories per bridge (community figure); robot vacuums only standalone (a vacuum inside a mixed bridge destabilises the whole bridge); appliances and energy device types not shown; bridge node name ignored (bridged device names work) |
| Google Home | Yes (Nest Hub, Nest Mini, Google TV Streamer, Nest Wifi Pro, ...) | Requires a free Google Home Developer Console integration with VID/PID per user | Yes (bridge shows as inert "Control bridge") | Android sometimes fails commissioning ("Something went wrong", country code); iOS app works; °C/°F conversions on thermostats |
| Amazon Alexa | Yes (Echo with Matter) | Accepted | Yes | **50 bridged devices per connection**; discovers **port 5540 only**; endpoint 1 must be the aggregator; composed devices split; cover position inverted, no tilt |
| SmartThings | Yes (Station, Hub v2/v3, Aeotec, TV/fridge hub) | Works in community tests | Yes, auto-onboards bridged devices | — |
| Home Assistant | No | Accepted | Yes, broadest device-type support | Removed bridged devices may linger as unavailable until HA restarts |

Consequences for the design:

- The bridge listens on **UDP 5540** by default (Alexa), and reports a clear status when the port is taken by
  another Matter stack on the same host (Home Assistant Matter Server, Matterbridge).
- The admin warns at **> 50** exposed devices (Alexa) and caps the allow-list at **150** (Apple). Multiple bridge
  nodes ("child bridges") are a possible extension, not part of this epic.
- The admin and docs explain the uncertified prompt per ecosystem and the Google Developer Console step.
- Robot vacuums need their own `ServerNode` (standalone pairing) rather than a bridged endpoint.

### Device-type coverage per ecosystem (bridge direction)

Legend: ✅ supported, ⚠️ partial or quirky, ❌ not shown, ? unconfirmed (verified in hardware acceptance).

| Smart Panel channel(s) | Matter device type | Apple | Google | Alexa | SmartThings | HA | Milestone |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `light` (on) | On/Off Light | ✅ | ✅ | ✅ | ✅ | ✅ | 1 |
| `light` + brightness | Dimmable Light | ✅ | ✅ | ✅ | ✅ | ✅ | 1 |
| `light` + color_temperature | Color Temperature Light | ✅ | ✅ | ✅ | ✅ | ✅ | 1 |
| `light` + hue/saturation or RGB | Extended Color Light | ✅ | ✅ | ✅ | ✅ | ✅ | 1 |
| `outlet` | On/Off Plug-in Unit | ✅ | ✅ | ✅ | ✅ | ✅ | 1 |
| `switcher` | On/Off Plug-in Unit | ✅ | ✅ | ✅ | ✅ | ✅ | 1 |
| `temperature` | Temperature Sensor | ✅ | ✅ | ✅ | ✅ | ✅ | 1 |
| `humidity` | Humidity Sensor | ✅ | ✅ | ✅ | ✅ | ✅ | 1 |
| `illuminance` | Light Sensor | ✅ | ✅ | ? | ✅ | ✅ | 1 |
| `pressure` | Pressure Sensor | ❌ | ✅ | ❌ | ? | ✅ | 1 |
| `motion`, `occupancy` | Occupancy Sensor | ✅ | ✅ | ✅ | ✅ | ✅ | 1 |
| `contact` | Contact Sensor | ✅ | ✅ | ✅ | ✅ | ✅ | 1 |
| `leak` | Water Leak Detector | ✅ (iOS 18.4) | ? | ⚠️ | ? | ✅ | 1 |
| `smoke`, `carbon_monoxide` | Smoke CO Alarm | ✅ (iOS 18.4) | ✅ | ✅ | ? | ✅ | 1 |
| `air_quality`, `carbon_dioxide`, `volatile_organic_compounds`, `air_particulate` | Air Quality Sensor (+ concentration clusters) | ? | ✅ | ✅ | ? | ✅ | 1 |
| `battery` | Power Source cluster on the bridged node | ✅ | ✅ | ✅ | ✅ | ✅ | 1 |
| `thermostat`/`heater`/`cooler` + `temperature` | Thermostat | ✅ | ⚠️ | ✅ | ✅ | ✅ | 2 |
| `air_conditioner` device | Room Air Conditioner | ✅ | ? | ✅ | ? | ✅ | 2 |
| `window_covering` | Window Covering | ✅ | ⚠️ lift only | ⚠️ inverted, no tilt | ✅ | ✅ | 2 |
| `lock` | Door Lock | ✅ | ✅ | ✅ | ✅ | ✅ | 2 |
| `fan` | Fan | ✅ | ✅ | ✅ | ✅ | ✅ | 2 |
| `air_purifier` device | Air Purifier | ✅ | ✅ | ✅ | ? | ✅ | 2 |
| `button`, `binary_input` (events) | Generic Switch (momentary) | ✅ | ? | ✅ | ? | ✅ | 2 |
| `valve` | Water Valve | ❌ | ? | ❌ | ? | ✅ | 2 |
| `electrical_power`, `electrical_energy` | Electrical Sensor (power/energy measurement) | ❌ | ✅ | ❌ | ✅ | ✅ | 2 |
| `robot_vacuum` | Robotic Vacuum Cleaner (standalone node) | ✅ standalone | ✅ | ✅ | ? | ✅ | 2 |
| Smart Panel scene | On/Off Plug-in Unit that triggers the scene and resets (workaround) | ✅ | ✅ | ✅ | ✅ | ✅ | 2 (optional) |
| `speaker`, `television`, `media_*` | Speaker / Basic Video Player | ❌ | ⚠️ speaker | ❌ | ? | ✅ | not planned |
| `camera`, `doorbell` | Camera / Video Doorbell (Matter 1.5) | ❌ | ❌ | ❌ | ✅ | ? | not planned |
| `alarm` | — (no device type) | — | — | — | — | — | impossible |
| `humidifier`, `dehumidifier`, `filter`, `indicator`, `buzzer`, `accelerometer`, `generic` | — / no ecosystem support | — | — | — | — | — | not planned |

## What cannot be done

| Wish | Why not | Workaround |
| --- | --- | --- |
| Appear as a "certified" Matter product without warnings | Production attestation needs CSA membership (Adopter ≥ $7,500/yr), a Vendor ID, lab certification and a unique DAC per install from a vendor-run PKI. An OSS project cannot ship a production DAC key. | Ship test certificates (VID 0xFFF1, PID 0x8000); document the Apple prompt and the Google Developer Console integration. Same model as Matterbridge, ioBroker and HA Matter Hub. |
| Expose alarm/security panels, weather, info tiles | No Matter device type exists. | Expose the underlying sensors (contact, motion, smoke) individually; scenes as switches. |
| Expose cameras, doorbells, TVs, media players to Apple/Google/Alexa | Matter 1.5 cameras are supported only by SmartThings; video players are unsupported; Speaker only in Google. | Keep using the HomeKit bridge or native integrations for these. |
| More than 50 devices for Alexa, more than ~150 for Apple on one bridge | Ecosystem limits; Alexa discovers only port 5540, so only one Alexa-visible node per host. | Allow-list with warnings; multiple bridge nodes possible later (non-Alexa). |
| Robot vacuum inside the bridge for Apple Home | Apple Home destabilises a mixed bridge that contains a vacuum. | Dedicated standalone node with its own pairing code (milestone 2). |
| Onboard a factory-new **Thread** device directly from Smart Panel | BLE commissioning of a Thread device needs the Thread operational dataset; Apple and Google do not hand it to Linux apps; Smart Panel has no Thread radio. | Pair it in Apple/Google/IKEA first, then share it to Smart Panel (multi-admin); or use its Zigbee radio through Zigbee2MQTT (KAJPLATS). Own OTBR is a possible future epic. |
| Matter in Docker bridge networking or across VLANs/subnets | Matter needs link-local IPv6, mDNS multicast and a single L2 segment. | Docker with `network_mode: host`; controllers and Smart Panel on the same VLAN. |
| Re-export Matter devices that Smart Panel controls back out through the bridge | Outside the spec's bridge intent (bridges are for non-Matter devices), causes duplicates/loops; Fabric Sync is not shipped by ecosystems. | Share the device directly to the other ecosystem (multi-admin) from Smart Panel. |
| Rooms/zones synced into Apple/Google/Alexa | Matter has no room assignment that the major ecosystems reliably import from a bridge. | Users assign rooms in each ecosystem once; device names are synced. The spike checks whether any ecosystem honours bridged location labels. |
| Local Apple Home control without any Apple hub on iOS < 18 | Older iOS requires a home hub for Matter. | HomeKit bridge (HAP) keeps working without a hub. |

## Architecture

### Ownership

```
apps/backend/src/plugins/devices-matter/
├── devices-matter.plugin.ts          # Nest module: registrations, managed services, metadata
├── devices-matter.constants.ts       # names, event types, limits, test VID/PID, forbidden passcodes
├── runtime/                          # shared matter.js environment (one per process)
│   ├── matter-runtime.service.ts     # Environment, storage root (0700), mDNS interface, process-hook opt-out
│   └── matter-network.service.ts     # interface selection, IPv6 diagnostics, port probing
├── bridge/                           # role A — export
│   ├── services/matter-bridge.service.ts          # IManagedExtensionService 'matter-bridge'
│   ├── services/matter-bridge-fabrics.service.ts  # fabrics list/remove, commissioning window
│   ├── services/matter-endpoint-registry.service.ts  # staged bindings, snapshot/rollback (HomeKit pattern)
│   ├── services/matter-command.dispatcher.ts      # → PropertyCommandService
│   ├── listeners/matter-bridge-event.listener.ts  # ValueSet/Updated/Occurrence/ConnectionChanged/Device.*
│   ├── mappers/*.mapper.ts                        # channel category → Matter device type + behaviors
│   └── controllers/matter-bridge.controller.ts    # status, candidates, map, fabrics, reset
├── controller/                       # role B — import (milestone 3)
│   ├── entities/devices-matter.entity.ts          # @ChildEntity device/channel/property
│   ├── platforms/matter.device.platform.ts        # IDevicePlatform → cluster commands
│   ├── services/matter-controller.service.ts      # IManagedExtensionService 'matter-controller'
│   ├── services/matter-commissioning.service.ts   # code/discovery/(BLE) commissioning, sessions
│   ├── services/matter-node-sync.service.ts       # subscriptions → property values, connectivity
│   ├── mappers/*.mapper.ts                        # Matter device type/cluster → channels/properties
│   └── controllers/matter-wizard.controller.ts    # wizard sessions (Z2M/HA pattern), nodes, share, remove
└── utils/                            # value converters (level, mireds, hue, percent100ths, lux log scale, ...)
```

- One plugin owns the dependency and the single matter.js `Environment`, because the environment, its mDNS
  service and its storage service are process-global. Two separate plugins would need a third shared provider
  anyway.
- Two managed services (`matter-bridge`, `matter-controller`) are registered by the same plugin; the
  `ManagedServiceManagerService` keys services by `(kind, type, serviceId)`, so they start/stop/restart
  independently. The bridge and the controller are separate `ServerNode`s in the shared environment.
- No Matter code leaks into core modules. The only core touch points are the websocket gateway's admin-only event
  prefix/redaction list and (milestone 3) the spec's `connection_type` enum.
- Naming: plugin name `devices-matter`, device type discriminator `devices-matter`, route
  `/api/v1/plugins/devices-matter/...`, admin-only event prefix `DevicesMatterPlugin.`.

### Toolchain integration (decided in the spike)

- `@matter/main` ships CJS builds, but its CJS code `require()`s ESM-only `@noble/curves` 2.x and relies on Node's
  unflagged `require(esm)` (Node ≥ 22.13; Smart Panel requires Node 24 — fine at runtime).
- matter.js documents `target: es2022` and `module`/`moduleResolution: node16` for subpath exports such as
  `@matter/main/devices/...`; the backend uses `module: commonjs`, `target: ES2021`. Options the spike evaluates:
  1. Switch the backend to `module: node16` (still CJS output because `package.json` has no `"type": "module"`)
     and `target: ES2022` — global change, must keep all other imports green.
  2. Import only from entry points resolvable under the current settings (`@matter/main` root exports) with a
     plugin-local type shim.
  3. Isolate matter.js behind a small workspace package compiled with its own tsconfig.
- Jest: unit tests mock a thin `MatterRuntime` adapter interface (no matter.js loaded); real-library tests run in a
  separate `jest-matter-spike.json` config (`--runInBand`), using Jest ≥ 30.4 with `--experimental-vm-modules` if
  `require(esm)` is needed, mirroring the existing Homey and OAuth spike configs.
- `@matter/nodejs` traps process signals, reads `MATTER_*` env, argv and `config.json` by default; the runtime
  disables these through `@matter/nodejs/config` so Nest owns the lifecycle.
- All `@matter/*` packages pinned to the **same exact version**; upgrades are explicit PRs (matter.js ships spec
  updates roughly twice a year with breaking changes; 0.18 deprecates the legacy controller API, so the
  controller is written against the new `ClientNode` API from the start).

### Runtime and storage

- Storage root `${FB_CONFIG_PATH}/matter/` created 0700, files tightened to 0600, fail closed (HomeKit pattern);
  storage ids `bridge` and `controller`; driver `file` (default) unless the spike shows `sqlite` is better on SD
  cards.
- Included in backups automatically. Restoring the same backup onto a second, simultaneously running installation
  would clone the bridge's operational identity; the docs warn, and "reset bridge" rotates it.
- mDNS: matter.js's own responder (UDP 5353, `reuseAddress`) next to avahi, bonjour-service and ciao. The runtime
  restricts it to the selected interface (`network_interface` config, default: auto = primary LAN interface,
  never `docker0`, `tailscale0`, `veth*`, `lo`). The spike tests interface loss (Wi-Fi drop, Tailscale up/down)
  for the class of crash that `ciao-receive-guard` fixed.
- Ports: bridge UDP 5540 (configurable; Alexa needs 5540), controller ephemeral. Port conflicts surface as a
  bridge status `error` with code `port_in_use`.

### Configuration

```yaml
devices-matter:
  type: devices-matter
  enabled: true
  network_interface: null            # null = auto
  bridge:
    enabled: true
    name: Smart Panel Bridge
    port: 5540
    passcode: <secret, 8 digits>     # write-only; forbidden values rejected (00000000, 11111111 … 99999999, 12345678, 87654321)
    discriminator: <0..4095>         # random at first start
    mapped_device_ids: []            # ≤ 150; warning > 50
  controller:
    enabled: false
    fabric_label: Smart Panel
```

- `passcode` is a `secretFields` entry (`passcode_configured` in reads). The pairing codes are returned only by the
  owner/admin status endpoint and redacted from logs and websocket debug output.
- Vendor ID / Product ID are constants (`0xFFF1` / `0x8000`) and not user-editable.
- Restart required only for `enabled`, `name`, `port`, `passcode`, `discriminator`, `network_interface`;
  `mapped_device_ids` reconciles live.

### Bridge mapping

- Mapper interface (analogous to `IHomeKitAccessoryMapper`):
  `canMap(device)`, `getSuggestedDeviceTypes(device)`, `buildEndpoints(device, context) → EndpointDefinition[]`.
  Mapping is per **channel**, so one device can produce several endpoints (light + temperature + battery).
- Endpoint ids are stable strings (`sp-<deviceId>`, `sp-<deviceId>-<channelId>`), so matter.js keeps endpoint
  numbers across restarts.
- `BridgedDeviceBasicInformation`: `nodeLabel` = device name (pushed on rename; display is controller-dependent), `uniqueId` = device id,
  `serialNumber`/`vendorName`/`productName`/`softwareVersion` from the `device_information` channel when present,
  `reachable` = device connection state.
- Power Source sits on the bridged node endpoint (not on the root endpoint; that broke energy rendering in Apple).
- Writes: behavior overrides (`OnOffServer.on/off/toggle`, `LevelControlServer.moveToLevel*`, ...) call the command
  dispatcher, which calls `PropertyCommandService`; a failure throws, so matter.js rolls back the attribute and
  returns an error status to the controller. Optimistic pending-write bookkeeping and `ValueSet`-as-accepted follow
  `docs/optimistic-ui-architecture.md`.
- Reads: attributes are kept current by `endpoint.set()` from device events; matter.js serves reads and
  subscription reports from its own state.
- Device lifecycle: `Device.Updated` (rename) → `nodeLabel`; `Device.Deleted` → endpoint deleted and id removed
  from `mapped_device_ids`; channel/property create/delete → device endpoint rebuilt;
  `Device.ConnectionChanged` → `reachable`.
- Value conversions (unit-tested helpers):

| Smart Panel | Matter |
| --- | --- |
| brightness 0–100 % (or level enum) | CurrentLevel 1–254 |
| color_temperature K | ColorTemperatureMireds (1 000 000 / K), clamped to the device range |
| hue 0–360°, saturation 0–100 % | CurrentHue / CurrentSaturation 0–254 |
| RGB 0–255 | hue/saturation (or XY) conversion |
| temperature °C (float) | int16 in 0.01 °C |
| humidity % | uint16 in 0.01 % |
| illuminance lx | `10000 × log10(lx) + 1` |
| pressure kPa | int16 in 0.1 kPa |
| battery % / level enum | BatPercentRemaining 0–200 (half-percent), BatChargeLevel |
| window covering position 0–100 % | LiftPercent100ths 0–10000 (0 = fully open) — direction inverted against the Smart Panel spec's open end |
| window covering tilt −90…90° | TiltPercent100ths |
| fan speed % / level enum | PercentSetting / FanMode |

### Controller mapping (milestone 3)

| Matter device type / cluster | Smart Panel device category → channel |
| --- | --- |
| On/Off, Dimmable, Color Temperature, Extended Color Light | `lighting` → `light` (on, brightness, color_temperature, hue, saturation) |
| On/Off Plug-in Unit, Mounted On/Off Control | `outlet` → `outlet` |
| On/Off Light Switch, Dimmer Switch, Generic Switch (e.g. IKEA BILRESA) | `input_controller` → `button` (Switch cluster events → `ChannelInput.Occurrence`) |
| Contact Sensor | `sensor` → `contact` |
| Occupancy Sensor | `sensor` → `occupancy` |
| Temperature / Humidity / Pressure / Light / Flow Sensor | `sensor` → `temperature` / `humidity` / `pressure` / `illuminance` / `flow` |
| Air Quality Sensor + concentration measurement clusters | `sensor` → `air_quality`, `carbon_dioxide`, `volatile_organic_compounds`, `air_particulate`, ... |
| Water Leak Detector, Smoke CO Alarm | `sensor` → `leak`, `smoke`, `carbon_monoxide` |
| Window Covering | `window_covering` → `window_covering` |
| Door Lock | `lock` → `lock` |
| Thermostat | `thermostat` → `thermostat`, `temperature`, `heater` / `cooler` (SystemMode needs a spec decision, see below) |
| Fan, Air Purifier | `fan` / `air_purifier` → `fan` |
| Power Source cluster | `battery` channel |
| Electrical Power / Energy Measurement clusters | `electrical_power`, `electrical_energy` channels |
| Basic Information / Bridged Device Basic Information | `device_information` channel |
| Aggregator (DIRIGERA, Hue Bridge, Aqara, another Smart Panel...) | each bridged node → its own Smart Panel device; the bridge node is tracked by the plugin, not shown as a device |

- Device entity columns: `matter_node_id` (string, 64-bit), `matter_endpoint_id` (for bridged children). Needs one
  incremental migration (`ALTER TABLE devices_module_devices ADD COLUMN ...`), as WLED and Homey did. No new
  category values are needed for the MVP, so no table rebuild.
- Spec changes (`spec/devices/channels.yaml`): add `matter` and `thread` to `device_information.connection_type`;
  decide whether the thermostat channel gets a `mode` property or the mapper derives heater/cooler `on` from
  `SystemMode` (as HomeKit's thermostat coordinator does in the other direction).
- Commands: platform `processBatch` groups updates per endpoint and invokes `OnOff.on/off`,
  `LevelControl.moveToLevelWithOnOff`, `ColorControl.moveToColorTemperature / moveToHueAndSaturation`,
  `WindowCovering.goToLiftPercentage / stopMotion`, `DoorLock.lockDoor / unlockDoor`, Thermostat setpoint writes,
  `FanControl` writes.
- Sync: matter.js `ClientNode` subscriptions; attribute changes → `ChannelsPropertiesService.update`; node
  online/offline → `DeviceConnectivityService.setConnectionState`.
- Attestation: matter.js validates the DAC chain, CD and CRL against DCL roots and by default accepts and logs
  failures; the wizard shows an "uncertified" badge instead of refusing.
- Wizard (backend session pattern of Z2M/HA): `POST /wizard` → session; `POST /wizard/:id/commission` with a manual
  or QR code; `GET /wizard/:id` lists interviewed nodes/endpoints with suggested category and mapping preview;
  `POST /wizard/:id/adopt`; sessions expire after 10 minutes idle. Node management: list nodes and fabrics, open a
  commissioning window (share to another ecosystem; shows code + QR), remove (RemoveFabric).

### Events and API surface

- Websocket events (admin-only prefix `DevicesMatterPlugin.`): `Bridge.StatusChanged`, `Bridge.FabricsChanged`,
  `Controller.StatusChanged`, `Controller.NodeChanged`, `Wizard.SessionChanged`. Redacted keys: `passcode`,
  `manual_pairing_code`, `qr_pairing_code`, `qr_code_data_uri`.
- REST (owner/admin), all with `@ApiTags`, `@ApiOperation`, `*ResponseModel`, schema names `DevicesMatterPlugin*`:
  - `GET bridge/status`, `GET bridge/candidates`, `POST bridge/candidates/map`, `GET bridge/fabrics`,
    `DELETE bridge/fabrics/:index`, `POST bridge/commissioning-window`, `POST bridge/reset`
  - `POST wizard`, `GET wizard/:id`, `POST wizard/:id/commission`, `POST wizard/:id/adopt`, `DELETE wizard/:id`,
    `GET nodes`, `POST nodes/:nodeId/share`, `DELETE nodes/:nodeId`
- Extension actions: `restart-bridge`, `reset-bridge` (dangerous), `restart-controller`.

### Security

- Passcode generated with `crypto.randomInt`, rejecting the spec's forbidden values; stored as a secret; returned
  only to owner/admin.
- Fabric storage 0700/0600, fail closed; never logged.
- Commissioning window opened only on explicit admin action and closed after 15 minutes or on first success.
- Controller wizard: the backend derives device identity from the commissioned node; the browser never supplies
  node ids.
- No new inbound TCP ports; Matter uses UDP 5540 (bridge), an ephemeral UDP port (controller) and mDNS 5353.

## Installer, image and Docker

- Raspberry Pi image and `install-server.sh`: verify IPv6 is enabled; add a sysctl drop-in so the host accepts IPv6
  Router Advertisements with route information options (`accept_ra=1`, `accept_ra_rt_info_max_plen=64`) on the LAN
  interface — required to reach Thread devices through a border router (milestone 3); document NetworkManager ≥ 1.42
  (Bookworm ships 1.42).
- Docker: Matter requires `network_mode: host`; provide a documented compose variant. The `node:24-alpine` image is
  fine for pure-JS matter.js; BLE is not supported in Docker.
- Firewall docs: UDP 5540 and UDP 5353 (mDNS) on the LAN; IPv6 link-local/multicast must not be filtered.
- Milestone 4 only: `bluez`, `libbluetooth-dev`, `libudev-dev`, `cap_net_raw` for node (or a dedicated helper),
  `smart-panel` user in the `bluetooth` group.

## Admin integration

- `apps/admin/src/plugins/devices-matter/`: config form (bridge and controller sections, status cards), bridge
  setup wizard (device selection with compatibility, suggested Matter device type, per-ecosystem warnings,
  duplicate-with-HomeKit warning, pairing QR + manual code, live paired-fabric status), fabrics list (remove,
  "pair another ecosystem"), reset; controller wizard adapter (`IDeviceWizardAdapter`) with code entry, discovered
  commissionable devices, mapping preview and adoption; node management (share, remove). Six locales.

## Documentation

- Website: `apps/website/app/docs/extensions/matter/page.mdx` (bridge pairing per ecosystem, uncertified prompt,
  Google Developer Console integration, limits, Docker host networking, troubleshooting) and a controller section
  (multi-admin sharing from Apple/Google/IKEA, Thread prerequisites, IKEA paths); `device-integrations` table;
  `network-requirements` page (UDP 5540, IPv6, mDNS).

## Observability

- Bridge status: `running | stopped | error`, error code (`port_in_use`, `storage_unsafe`, `ipv6_unavailable`,
  `interface_missing`), commissioned, fabrics, exposed endpoint count, commissioning window open/closed.
- Controller status: running, nodes online/offline, last subscription error per node.
- Structured logs with the plugin's logger; matter.js log level mapped to Smart Panel's and kept at `notice` by
  default (debug logging is costly on a Pi).

## Testing strategy

- Unit tests (mocked runtime adapter): value converters, every mapper (bridge and controller), endpoint registry
  reconcile/rollback, event listener, command dispatcher, config validation (passcode rules, limits), plugin
  mutation handler, controller wizard sessions, platform command translation.
- Spike/integration tests with the real library (`jest-matter-spike.json`): bridge + in-process controller
  commissioning on loopback (matter.js can be its own controller), attribute subscription round-trip, add/remove
  endpoint while commissioned, restart persistence.
- Admin: Vitest for the store, config form and both wizards.
- Hardware acceptance matrices (manual, recorded in the epic): bridge × {Apple Home with and without hub, Google
  Home iOS/Android, Alexa, SmartThings, HA} × {light, plug, sensor set, thermostat, cover, lock, button};
  controller × {Wi-Fi plug, Thread device via multi-admin (IKEA KAJPLATS), DIRIGERA as bridge}.

## Performance targets

- Bridge with 100 endpoints on a Raspberry Pi 4: ≤ 300 MB additional RSS (to be measured in the spike; Matterbridge
  reports ~205 MB RSS on a Pi 4), state change → controller report ≤ 500 ms on LAN, command → Smart Panel platform
  dispatch ≤ 100 ms.
- No measurable effect on the panel UI when the plugin is disabled (matter.js not loaded).

## Future options (not part of this epic)

- **Commissioning from the Android display app.** The Android build of the display app could use the Google Play
  Services Matter commissioning API, as the Home Assistant companion app does. The tablet would discover a factory-new
  device over Bluetooth, provision Wi-Fi or Thread credentials (Thread through Android's Thread network API, with the
  user's consent) and hand the device to the backend controller through a commissioning window. The Pi would need
  neither Bluetooth nor a Thread radio. Only Android displays can do this: flutter-pi (Raspberry Pi) and Linux
  desktop displays have no such API. Planned as a later feature update once milestone 3 has shipped.
- **Own Thread Border Router.** An RCP dongle with OpenThread Border Router on the Pi would let Smart Panel own a
  Thread network and commission Thread devices directly (together with BLE). Possible future epic.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| matter.js does not build/run cleanly in the CJS NestJS backend or under Jest | Milestone 0 spike decides the tsconfig strategy before any production code; adapter interface keeps unit tests library-free. |
| mDNS stacks interfere (avahi, bonjour-service, ciao, matter.js) or crash on interface changes | Interface pinning; spike runs interface-loss scenarios; receive-guard pattern if needed. |
| Ecosystem differences and regressions (iOS/Google/Alexa updates) | Per-ecosystem acceptance matrix; conservative device-type choices; docs list known quirks. |
| Users hit uncertified/Google Developer Console friction | Step-by-step docs with screenshots; admin hints per ecosystem. |
| matter.js breaking changes | Exact pins, one upgrade PR per minor, spike tests in CI. |
| Memory on small boards (Pi Zero 2 W, 512 MB) | Measure in spike; plugin disabled by default; document minimum hardware. |
| Port 5540 already used by another Matter stack on the host | Detect, report `port_in_use`, allow another port (losing Alexa). |
| Duplicates in Apple Home (HomeKit + Matter bridges, or HA exporting the same devices) | Admin warnings; docs. |
