# Task: Shelly NG Connection Hardening
ID: TECH-SHELLY-NG-CONNECTION-HARDENING
Type: technical
Scope: backend
Size: medium
Parent: (none)
Status: planned

## 1. Business goal

In order to maintain reliable real-time state for Shelly Gen2+ devices
As a smart panel user
I want devices to stay connected, recover quickly from disconnections, and report complete data including non-pushed values

## 2. Context

Comparison with Home Assistant's official Shelly integration (aioshelly) revealed three gaps in the Smart Panel's Shelly NG plugin:

1. **No periodic status polling.** HA polls `Shelly.GetStatus` every 60s to capture values that aren't pushed via WebSocket notifications (energy counters, some sensor readings). Smart Panel relies entirely on WS push — if a notification is missed or a value type isn't pushed, data goes stale silently.

2. **No inbound WebSocket server for sleeping devices.** Battery-powered Shelly devices (Plus H&T, Motion, Door/Window) sleep most of the time and only connect outbound on wake. HA runs an inbound WS server that the device connects *to*. Smart Panel has no inbound endpoint, so sleeping devices can't reliably report data.

3. **No mDNS-triggered reconnection.** When a Shelly device reappears on the network after a reboot or IP change, HA detects it via zeroconf and triggers immediate reconnection. Smart Panel's mDNS discoverer handles initial discovery but doesn't trigger reconnection for already-known devices.

**Recent fixes already applied (not in scope):**
- `crypto.randomUUID()` client ID (prevents connection stealing between instances)
- Library-level `destroyed` flag (always reconnects unless explicitly destroyed)
- Public `reconnect()` method on the library
- Health check force-reconnects stale disconnected devices (>2 min offline)

**Reference implementation:**
- `apps/backend/src/plugins/devices-shelly-ng/services/shelly-ng.service.ts` — main service, library initialization
- `apps/backend/src/plugins/devices-shelly-ng/delegates/delegates-manager.service.ts` — manages delegates, health checks
- `apps/backend/src/plugins/devices-shelly-ng/delegates/shelly-device.delegate.ts` — per-device WS lifecycle
- `apps/backend/src/plugins/devices-shelly-ng/services/database-discoverer.service.ts` — loads known devices from DB
- `apps/backend/src/plugins/devices-shelly-ng/services/shelly-rpc-client.service.ts` — HTTP RPC client for commands
- HA reference: `homeassistant/components/shelly/coordinator.py` (ShellyRpcPollingCoordinator)
- HA reference: `aioshelly/rpc_device/wsrpc.py` (WsServer for sleeping devices)
- HA constants: `RPC_SENSORS_POLLING_INTERVAL = 60`, `WS_HEARTBEAT = 55`

## 3. Scope

**In scope**

- Periodic status polling for connected devices (every 60s)
- mDNS-triggered reconnection for known devices that reappear
- Sleeping device inbound WebSocket server

**Out of scope**

- Bluetooth device discovery
- Gen1 (Shelly V1) changes
- Admin UI changes
- Connection slot management (Shelly's 5-connection limit)
- Changes to the shellies-ds9 fork beyond what's already done

## 4. Acceptance criteria

### Periodic status polling
- [ ] Connected devices are polled via `Shelly.GetStatus` RPC every 60 seconds
- [ ] Poll results update device properties (energy counters, sensor values) via the existing delegate value pipeline
- [ ] Polling is concurrent with batched concurrency (max 10 parallel, like health check)
- [ ] Polling failures are logged but don't disconnect the device
- [ ] Polling interval is configurable via the plugin config model

### mDNS-triggered reconnection
- [ ] When mDNS discovers a device that already has a delegate, trigger immediate reconnection if the delegate is disconnected
- [ ] When mDNS reports a new IP for a known device, update the device address and reconnect
- [ ] Reconnection resets the backoff interval (uses the library's `reconnect()` method)

### Sleeping device support
- [ ] Backend exposes an inbound WebSocket endpoint for Shelly device connections (e.g., `/api/v1/plugins/shelly-ng/ws`)
- [ ] When a sleeping device connects inbound, its status update is routed to the correct delegate
- [ ] Adopted sleeping devices are configured with the Smart Panel's inbound WS URL via `Ws.SetConfig` RPC call
- [ ] Sleeping device wake events update device properties and connectivity state
- [ ] Sleeping devices show as "online" briefly during wake, then "sleeping" (not "offline")

## 5. Example scenarios

### Scenario: Energy counter accuracy

Given a Shelly Plus Plug S is connected and reporting power usage
When 60 seconds pass since the last poll
Then the delegate sends `Shelly.GetStatus` and updates the energy counter property
And the admin UI shows the current kWh reading without waiting for a push notification

### Scenario: Device reappears after reboot

Given a Shelly Plus 1 reboots and gets the same IP address
When mDNS re-announces the `_shelly._tcp.local.` service
Then the plugin detects the existing delegate is disconnected
And triggers immediate reconnection via `reconnect()`
And the device shows online within seconds (not waiting for 60s+ backoff)

### Scenario: Battery device wakes up

Given a Shelly Plus H&T (sleeping device) is adopted
And the device is configured with the Smart Panel's inbound WS URL
When the device wakes up and connects to the inbound WS endpoint
Then the device's temperature and humidity values are updated
And the device shows as "online" during the wake period
And the device shows as "sleeping" after the connection closes

## 6. Technical constraints

- Follow the existing delegate architecture in `delegates-manager.service.ts`
- Reuse the existing `ShellyRpcClientService` for HTTP-based RPC where needed
- The inbound WS server must authenticate devices (at minimum by MAC/device ID)
- Polling must not interfere with the existing ping-based health check
- Do not modify the shellies-ds9 library — only use its public API
- Tests are expected for polling logic and mDNS reconnection triggers

## 7. Implementation hints

### Periodic status polling
- Add a `pollStatus()` method to `ShellyDeviceDelegate` that calls `Shelly.GetStatus` via the existing RPC handler
- Add a `pollAllDevices()` method to `DelegatesManagerService` (similar to `checkHealth()` with batched concurrency)
- Hook into the existing health check interval or add a separate `setInterval` with `.unref()`
- Parse the status response using the existing component update pipeline (`handleChange`)

### mDNS-triggered reconnection
- In `ShellyNgService`, the `handleDeviceDiscovery` callback already fires when mDNS finds devices
- Add a check: if the discovered device already has a delegate AND the delegate is disconnected, call `delegate.forceReconnect()`
- If the discovered IP differs from the stored address, update via `DeviceAddressService` first, then reconnect

### Sleeping device support
- Register a Fastify WebSocket route in the plugin module's `onModuleInit`
- Use the `@fastify/websocket` plugin (already available for the panel app)
- Parse incoming JSON-RPC frames from the sleeping device
- Route `NotifyStatus` and `NotifyEvent` to the delegate by device ID
- On adoption, call `Ws.SetConfig` to set the outbound URL:
  ```json
  { "config": { "server": "ws://<panel-ip>:<port>/api/v1/plugins/shelly-ng/ws", "enable": true } }
  ```

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Implement in order: polling first (simplest, highest impact), then mDNS reconnect, then sleeping device support.
- Keep changes scoped to the Shelly NG plugin (`apps/backend/src/plugins/devices-shelly-ng/`).
- For each acceptance criterion, either implement it or explain why it's skipped.
- The polling interval should default to 60 seconds but be configurable.
- Do not break existing tests — run `pnpm jest --testPathPatterns='shelly-ng'` after each phase.
