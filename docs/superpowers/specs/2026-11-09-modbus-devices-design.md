# Modbus Devices — Design

**Status:** Draft
**Date:** 2026-11-09
**Author:** Adam Kadlec
**Related:** `docs/hardware-inputs.md`, `docs/superpowers/specs/2026-07-31-virtual-devices-design.md` (wizard pattern),
`apps/backend/src/plugins/devices-shelly-ng/mappings/README.md` (YAML definition system),
FastyBird IoT PHP connector `fastybird/src/FastyBird/Connector/Modbus` (prior art)

## Problem

Wired I/O modules — digital input boards, relay boards, analog input modules, valve and actuator controllers — are
cheap, robust and common in installations, and almost all of them speak Modbus. Smart Panel cannot use any of them.

Modbus has no discovery and no self-description. A device on the network does not say what it is, which registers it
has, or what they mean. Everything Smart Panel needs to know — where the device is, which unit ID it answers to, which
register holds which value, how to decode it and what it represents — must be supplied by the user or by a template.

An installation can have several Modbus endpoints on the Ethernet network. An endpoint is either a device that speaks
Modbus TCP itself, or a gateway with several RS485 slaves behind it, each answering to its own unit ID. Smart Panel is
always the Modbus master (client).

## Goal

A `devices-modbus` plugin that lets an administrator add Modbus devices reachable over Ethernet through a guided admin
wizard — either from a template or by defining registers by hand — and then use them like any other device: digital
inputs, digital outputs, analog inputs and simple actuators, visible and controllable on the panel, with truthful
connection state.

Success looks like: the Qingjun 32-DI board is added from a built-in template in under a minute, all 32 inputs show
their live state on the panel, and the Eletechsup N4D8B08 relay board behind the Waveshare gateway is switched from the
panel over RTU over TCP, with its relay states confirmed by reading them back.

## Non-goals

- **Discovery or scanning.** The plugin never sweeps addresses or unit IDs. It only talks to what the user configured.
- **Serial RTU on a local port** (USB-RS485 on the Pi). The transport layer is designed so it can be added later as one
  more transport; it is not built now.
- **Modbus server (slave) mode.** Smart Panel does not expose its own registers.
- **Admin YAML editor.** Planned separately. Until then user templates are files on disk.
- **Migrating the existing mapping loaders** (Shelly NG, Zigbee2MQTT, Home Assistant, Homey) to the new shared loader.
  That is a follow-up cleanup.
- **Window coverings driven by relay pairs, multi-register commands, FC43 auto-identification, int64/float64/string
  values.** Follow-ups; the data model must not block them.

## Anti-goals

These would make the feature a failure even if it technically works:

- **Hammering a gateway.** Parallel sockets, unbounded retries or ignoring a lost endpoint. Cheap RS485 gateways lock up
  or reboot under that, taking every slave behind them down.
- **Attributing a late reply to the wrong request.** On RTU over TCP there is no transaction ID; a response that arrives
  after its timeout must never be decoded as the answer to the next request. A silently wrong input state is worse than
  an offline device.
- **Showing stale values as live.** When an endpoint or device is lost, its values must be marked invalid, not frozen.
- **Arbitrary code in templates.** Templates will become editable from admin; they must stay declarative. No `formula`
  transformer, no `new Function()`.
- **Surprise writes.** Nothing in the wizard writes to a device unless the user explicitly asks for that specific write.

## Decisions

Made by the user:

1. **Endpoints are a real entity**, not an implicit connection pool keyed by host and port.
2. **RTU over TCP is in scope** from the start, alongside Modbus TCP. A Waveshare RTU-over-TCP gateway is available for
   testing.
3. **Templates:** built-in templates ship with the plugin, and users can define their own, using the same YAML
   definition system the other device plugins use for their mappings. For now user templates are loaded from disk; an
   admin YAML editor comes later.

Calls made in this design (reviewable — see "Calls to check" at the end):

- `modbus-serial` as the protocol library, behind our own transport wrapper.
- A new shared YAML definition loader in `apps/backend/src/common/`, rather than a fifth copy of the mapping loader.
- Templates are copy-on-create: a device records which template and revision it came from, but later template changes
  do not alter existing devices.
- Bit-in-register bindings are read-only in v1.
- Button events synthesised from polled inputs support `down`, `up`, `press` and `long_press`; no `double_press`.

## Terminology

| Term | Meaning |
|---|---|
| **Endpoint** | One TCP target: host, port, framing. Either a native Modbus TCP device or an RS485 gateway. Owns the single connection and the request queue. |
| **Framing** | `tcp` (Modbus TCP, MBAP header, transaction IDs) or `rtu_over_tcp` (raw RTU frames with CRC inside a TCP stream, no transaction IDs). |
| **Modbus device** | A Smart Panel device = one unit ID on one endpoint. |
| **Point** | One value the device exposes, bound to a Smart Panel channel property. |
| **Binding** | How a point maps to registers: register type, address, data type, transforms. A property has at most one read binding and one write binding. |
| **Template** | A YAML definition of a device model: defaults, channels, points. Built-in or user. |

Addresses are stored **0-based** (the PDU address on the wire). The wizard accepts 1-based and "4xxxx/3xxxx/1xxxx/0xxxx"
notation and converts, showing the stored address next to what the user typed.

## Topology

```
Endpoint  (devices_modbus_endpoints)      host:port, framing, timeouts, queue limits
 └─ Modbus device  (devices_module_devices STI, type = devices-modbus)   unit ID, poll interval, byte/word order
     └─ channel  (spec category: binary_input, switcher, analog_input, button, valve, …)
         └─ property  (spec property: state, on, value, event, …)
             └─ binding(s)  (devices_modbus_bindings)   read and/or write register definition
```

Unit ID is unique per endpoint. Two devices at different endpoints may both be unit 1.

### One unit, one device; splitting is done by virtual devices

A Modbus device is the physical module as a whole: one unit ID is exactly one Smart Panel device, polled once.
Many modules do not fit a single device category — an 8-zone valve board, a relay board whose relays drive both
lights and valves, a 4-probe temperature module. The spec's categories would reject or misrepresent them as one device
(`valve` has a single valve channel, `sensor` a single `temperature`, `switcher` cannot mix `outlet` and `switcher`).

This is the problem `devices-virtual` already solves for multi-channel Shelly devices: the Modbus module is created as
a plain I/O device (`switcher` for relays with optional inputs, `input_controller` for inputs, `sensor` for analog
inputs; never the reserved `generic` category), optionally hidden, and virtual devices built from its properties
become the valves, lights and temperature sensors that rooms and the panel use. Modbus itself never creates more
than one device per unit.

The builder should confirm that the virtual-device compatibility rules accept the pairings this relies on (relay
`switcher.on` as `valve.on` and as a light's `on`; `analog_input.value` through the numeric converter as a
temperature), and extend them if they do not. The admin wizard's last step links to the virtual-device wizard for the
new device.

## Data model

All plugin-specific tables are created by one incremental migration (next free number at the time of writing:
`1000000000054`). The initial migration is never modified.

### `devices_modbus_endpoints` (plugin-owned table)

| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | uuid | | |
| `name` | string | | Shown in admin |
| `host` | string | | IP or hostname |
| `port` | int | 502 | 1–65535 |
| `framing` | enum `tcp` \| `rtu_over_tcp` | `tcp` | |
| `connect_timeout_ms` | int | 2000 | |
| `request_timeout_ms` | int | 1000 | Per request |
| `inter_request_delay_ms` | int | 0 (`tcp`), 20 (`rtu_over_tcp`) | Gap after each response, for slow RS485 lines |
| `max_in_flight` | int | 1 | `tcp` only may raise it; `rtu_over_tcp` is forced to 1 |
| `enabled` | bool | true | Disabled endpoints are not connected; their devices are `disconnected` |
| `created_at`, `updated_at` | | | |

`(host, port)` is unique. An endpoint cannot be deleted while devices reference it (restrict, with a clear API error
listing the devices). Endpoints are not Smart Panel devices and do not appear on the panel.

Endpoint health is runtime state, not stored: connection state (`connecting`, `connected`, `backoff`, `disabled`), last
error and when it happened, rolling average latency, request and timeout counters, and the configured poll load versus
measured capacity. Exposed through the API for admin.

### Modbus device (STI columns on `devices_module_devices`)

Following the `devices-wled` / `devices-third-party` precedent of nullable plugin columns:

| Column | Type | Default | Notes |
|---|---|---|---|
| `modbus_endpoint_id` | uuid FK → endpoints | | Restrict on delete |
| `modbus_unit_id` | int | 1 | 0–255 (0 is broadcast on RTU; the wizard warns) |
| `modbus_poll_interval_ms` | int | 1000 | Minimum 100 |
| `modbus_byte_order` | enum `big` \| `little` | `big` | Order of the two bytes inside a register |
| `modbus_word_order` | enum `big` \| `little` | `big` | Order of registers in 32-bit values (`little` = low word first) |
| `modbus_max_read_registers` | int | 125 | Upper bound per FC03/FC04 request |
| `modbus_max_read_bits` | int | 2000 | Upper bound per FC01/FC02 request |
| `modbus_max_read_gap` | int | 0 | Registers that may be read across a gap to merge two blocks; 0 = never read undefined addresses |
| `modbus_template_id` | string, nullable | | Template the device was created from |
| `modbus_template_revision` | string, nullable | | Template `version` + content hash at creation |

`(modbus_endpoint_id, modbus_unit_id)` must be unique among Modbus devices. Enforced in the service and covered by a
test; a partial unique index is preferred if SQLite STI makes it practical.

Byte and word order as two independent settings cover the four real-world 32-bit layouts (`ABCD`, `CDAB`, `BADC`,
`DCBA`). The PHP connector's six named orders collapse onto these. Its test vectors (`00 01 00 00` read as low-word-first
= 1; `00 00 01 00` read with swapped bytes = 1; `3F EC CC CD` big-endian float = 1.85) become decoder tests.

### `devices_modbus_bindings` (plugin-owned table)

Following the `devices_zigbee2mqtt_sample_sources` precedent of a plugin table keyed to a property.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `property_id` | uuid FK → channel property | Cascade on delete |
| `role` | enum `read` \| `write` | Unique per `(property_id, role)` |
| `register_type` | enum `coil` \| `discrete_input` \| `input_register` \| `holding_register` | `write` only allows `coil` and `holding_register` |
| `address` | int | 0–65535, 0-based |
| `data_type` | enum `bool` \| `int16` \| `uint16` \| `int32` \| `uint32` \| `float32` | `bool` for coils/discrete inputs and for `bit` bindings |
| `bit` | int, nullable | 0–15. Reads one bit of a register. Read-only in v1 |
| `byte_order`, `word_order` | nullable | Override the device setting for this point |
| `scale` | float | 1 |
| `offset` | float | 0 |
| `invert` | bool | false. For booleans (normally-closed contacts) |
| `value_map` | json, nullable | Raw ↔ property value table, e.g. a relay board that reads 1/0 but expects 256/512 written |
| `write_function` | enum `single` \| `multiple`, nullable | FC05/FC06 vs FC15/FC16. Some devices only accept FC16; default `single` for one register or coil |
| `poll_interval_ms` | int, nullable | Override the device interval for this point |

Decoding order on read: raw registers → byte/word order → data type → `bit` → `invert` → `value_map` → `scale` and
`offset`. Writing is the inverse, and refuses values that do not fit the data type rather than truncating them.

Properties come in three kinds:

1. **Read-bound** — has a read binding; optionally a write binding (can be a different register). Every property
   whose spec permission includes read (`ro`, `rw`) must have a read binding, so a command is always confirmed by
   reading the device, as `docs/optimistic-ui-architecture.md` requires. The plugin never reports a written value as a
   sample.
2. **Write-only** — only a write binding, allowed only for spec properties with `wo` permission.
3. **Static** — no binding; the value is fixed at creation (e.g. `valve.type = generic`, `analog_input.unit`).

A device must have at least one read binding; creation is refused otherwise. This keeps connection state truthful for
every device, including a dead slave behind a working gateway.

## Transport

### Library

`modbus-serial` (ISC, actively maintained, ~70k weekly downloads, bundled types). It covers Modbus TCP, RTU over TCP,
and later serial RTU with an optional `serialport` dependency that ships prebuilt ARM binaries. `jsmodbus` was rejected
(one unit ID per client, a single mismatched response rejects all queued requests); the rest are abandoned or GPL.

`modbus-serial` is used only for framing. Its known gaps are covered by our wrapper:

- It has no default timeout — the wrapper always sets one.
- Pending requests are not rejected when the socket closes — the wrapper tracks them and rejects them itself.
- It has no reconnect — the wrapper owns reconnect.
- RTU over TCP has no transaction IDs, so concurrent calls corrupt each other — the wrapper never issues them.

### `ModbusTransport` interface

A small interface in the plugin (`readCoils`, `readDiscreteInputs`, `readHoldingRegisters`, `readInputRegisters`,
`writeCoil`, `writeCoils`, `writeRegister`, `writeRegisters`, all taking the unit ID per call), implemented by a
`modbus-serial` adapter. Tests use an in-memory fake. A future serial transport implements the same interface.

### Per-endpoint connection

One `EndpointConnection` per enabled endpoint:

- **One TCP socket** for the endpoint, shared by all its devices.
- **One request queue.** Requests from all devices on the endpoint go through it. At most `max_in_flight` are on the
  wire (always 1 for `rtu_over_tcp`), with `inter_request_delay_ms` between a response and the next request.
- **Writes jump the queue** ahead of queued polls, but never interrupt a request on the wire.
- **Timeout handling.** On `rtu_over_tcp`, a request timeout closes and reopens the socket, so a late reply cannot be
  read as the answer to the next request. On `tcp`, late replies are dropped by transaction ID; repeated timeouts
  (3 in a row) also reset the socket.
- **Reconnect** with exponential backoff and jitter (1 s → 60 s cap). While in backoff the queue is not fed; queued
  writes fail immediately with a clear "endpoint unavailable" error instead of waiting.
- **Lifecycle.** All connections are owned by the plugin's managed service (`IManagedExtensionService`): opened on
  start, closed on stop and on endpoint disable or delete, rebuilt when an endpoint's connection settings change.

## Polling

- Each device is polled every `modbus_poll_interval_ms`; points with an override are polled on their own interval.
- **Read planning.** For each device and poll tick, the due points are grouped by function code and sorted by address,
  and merged into blocks. A block ends at a gap larger than `modbus_max_read_gap`, or when it would exceed
  `modbus_max_read_registers` / `modbus_max_read_bits`. 32-bit points occupy two registers. A plan is computed when a
  device's bindings change, not on every tick.
- **Overload.** If an endpoint cannot complete its planned reads within their intervals, polls are skipped rather than
  piling up (a device never has more than one poll queued), and admin shows the endpoint as overloaded.
- **Reporting.** Decoded values go through `ChannelsPropertiesService.reportSample()` with live evidence, only when the
  value changed (plus the property's normal freshness rules).
- **Modbus exception** (illegal address, illegal function, …) on a block marks the properties in that block invalid
  and logs the exception code; the device stays connected. The planner then splits the failing block once into
  single-point reads so one bad address does not blank a whole block.
- **Gateway exceptions** `0x0A` (gateway path unavailable) and `0x0B` (gateway target device failed to respond) are
  different: they come from a protocol-converting gateway whose RS485 slave did not answer. They count as a timeout
  for that device (towards `lost`), not as a bad address, and the endpoint stays connected.

## Writes

- `ModbusDevicePlatform implements IDevicePlatform` receives property commands from the panel and admin.
- It encodes the value through the write binding and issues FC05, FC06, FC15 or FC16 according to the register type,
  data type and `write_function`.
- After a successful write to a read-bound property, the property's read block is re-read immediately, so the
  optimistic UI settles on the device's real value (`docs/optimistic-ui-architecture.md`).
- A failed write (exception, timeout, endpoint lost) is returned as a failed command result; the property keeps its last
  confirmed value.
- `processBatch` groups writes to adjacent registers of the same device into one FC15/FC16 only when every target uses
  `write_function: multiple`; otherwise writes go one at a time.

## Inputs

Digital inputs follow `docs/hardware-inputs.md`:

- A **`binary_input`** channel reports the level in `state`.
- A **`button`** channel synthesises events from level changes between polls: `down` on the rising edge, `up` on the
  falling edge, `press` when released before the long-press threshold, `long_press` when the threshold is reached while
  still held (threshold per point, default 800 ms). Events go through `ChannelInputOccurrencesService`.
- Timing is only as fine as the poll interval. The wizard says so, and suggests a 100–250 ms interval for devices with
  button points. A press shorter than one poll interval can be missed.
- The first poll after start or reconnect sets the baseline without emitting events (reconnection anti-replay).

## Connection state

Through `DeviceConnectivityService.setConnectionState()`:

| Situation | Device state |
|---|---|
| Plugin starting, first poll pending | `init` |
| Last poll succeeded (exceptions on some blocks included) | `connected` |
| Endpoint disabled, or plugin stopping | `disconnected` |
| Endpoint in backoff, or the device's requests time out 3 polls in a row while the endpoint answers for other units | `lost` |
| Device configuration invalid at runtime (e.g. bindings fail to load) | `alert` |

On `lost`, `alert` and `disconnected`, the device's property values are marked invalid by reporting `null` as a live
sample, as the Shelly NG plugin does (`shelly-sample-sources.service.ts`).

## Capabilities

| I/O | Channel | Property bindings |
|---|---|---|
| Digital input (level) | `binary_input` | `state` ← coil / discrete input / register bit |
| Digital input (push button) | `button` | `event` synthesised; `detected` ← level (optional) |
| Digital output, relay | `switcher` or `outlet` | `on` ↔ coil, or holding register with `value_map` |
| Analog input | `analog_input` | `value` ← register with scale/offset; `unit` static |
| Measured quantity | `temperature`, `humidity`, `electrical_power`, … | value ← register with scale/offset |
| On/off valve | `valve` | `on` ↔ coil or register; `type` static |

Device category is chosen in the wizard and suggested from the channels: outputs present → `switcher` (which also allows
inputs), inputs only → `input_controller`, measured quantities only → `sensor`, valve → `valve`. The plugin validates
the result with `validateDeviceStructure()` before saving, as `devices-virtual` does.

Window coverings need several coordinated writes per command (open, close, stop across a relay pair) and derived
status. They are a follow-up; the binding model leaves room for a command-to-writes map.

## Templates

### Shared definition loader

The four existing device plugins each carry their own 700–900-line copy of the mapping loader. Modbus gets a generic
loader in `apps/backend/src/common/` instead:

- Discovers built-in files in the plugin's definitions folder, and user files from the user data directory with a
  plugin prefix, or from a directory set by an environment variable.
- Path-traversal and symlink protection, as in the existing loaders.
- Ajv validation against a JSON schema supplied by the plugin, collecting per-file errors instead of failing the whole
  load.
- Priority: user definitions override built-in definitions with the same ID.
- `reload()`, returning loaded files, errors and warnings.

Plugin-specific meaning (what a template *is*) stays in the plugin. The existing four loaders are not migrated in this
work.

### Locations

- Built-in: `apps/backend/src/plugins/devices-modbus/templates/definitions/**/*.yaml`.
- User: `plugin.devices-modbus.*.yaml` in the user data directory the existing mapping loaders use, or every `*.yaml`
  under `FB_MODBUS_TEMPLATES_PATH` when set.
- `POST /plugins/devices-modbus/templates/reload` reloads without a restart.

### Format

Declarative only. No `formula`, no expressions beyond the documented placeholders.

```yaml
version: "1.0"

templates:
  - id: qingjun-32di
    name: Qingjun 32-channel digital input board
    manufacturer: Qingjun
    model: 32DI
    description: 32 dry-contact inputs, Modbus TCP. Unit ID is set by DIP switches.
    defaults:
      framing: tcp
      port: 8080
      unit_id: { default: 1, min: 0, max: 31, hint: "Must match the DIP switches; restart the board after changing them" }
      poll_interval_ms: 250
      byte_order: big
      word_order: big
    category: input_controller
    channels:
      - repeat: { count: 32 }           # {i} = 0…31, {n} = 1…32
        identifier: "di_{n}"
        name: "DI {n}"
        category: binary_input
        properties:
          - category: state
            read:
              register_type: holding_register
              address: { base: 4, per_item: 1/16 }   # 4 for items 0–15, 5 for items 16–31
              data_type: bool
              bit: { per_item: 1, modulo: 16 }      # bit 0–15 within that register
```

The exact syntax for repeated items (`repeat`, `{i}`/`{n}`, address and bit stepping) is for the builder to settle
in the JSON schema. It must cover: one point per coil or discrete input (`address = base + i`), one point per register,
and one point per bit across consecutive registers (as above).

The Qingjun layout above is verified on the real board (2026-11-09, unit 2, port 8080, FC03 polled every 0.5 s):
holding register 4 carries DI1–DI16 and register 5 carries DI17–DI32, least significant bit first. DI1 active read
`0x0001, 0x0000`; DI32 active read `0x0000, 0x8000`; all inputs idle read `0x0000, 0x0000`. The FC02 (discrete input)
mode described in the manual was not tested and the template does not use it.

Template-level transformer definitions use the same vocabulary as other plugins where it is declarative: `scale`,
`map`, `boolean` (with `invert`), `clamp`, `round`. Those map onto binding fields.

### Expansion and provenance

The backend expands templates; the admin never re-implements expansion. `POST …/templates/:id/preview` returns the
concrete channels, properties and bindings for given overrides. Creating a device from a template copies the expanded
result into the database and records `modbus_template_id` and `modbus_template_revision`. Editing or deleting a
template does not change existing devices; admin shows when a device's template has a newer revision.

Built-in templates ship only for hardware someone has verified: v1 is the Qingjun 32-DI board and the Eletechsup
N4D8B08 relay board used behind the Waveshare gateway.

### Eletechsup N4D8B08 (from the miniserver connector's `docs/Relay-Board.md`)

8 relays and 8 digital inputs on RS485, 9600 baud 8N1 (configured on the gateway, not in Smart Panel), behind a
Waveshare **RS485 TO WIFI/ETH** gateway (SKU 21968). That gateway offers both modes this design supports, so one test
setup covers both framings:

- **Transparent transmission, TCP server** → endpoint framing `rtu_over_tcp`.
- **Modbus TCP ↔ Modbus RTU conversion** → endpoint framing `tcp`. The gateway still has one RS485 line behind it, so
  the endpoint keeps `max_in_flight = 1` and an inter-request delay, and a silent slave shows up as exception `0x0B`.

The template defaults to `rtu_over_tcp`; the wizard lets the user pick either.

- **Relays:** holding registers at PDU addresses 1–8 (one register per relay, one FC03 read block). The board reads
  `1` for on and `0` for off, but expects different values written with FC06: `256` (0x0100) switches on and `512`
  (0x0200) switches off (`768` toggles; not used, the spec has no toggle). This is expressed with two bindings per
  relay: a read binding with `value_map {1: true, 0: false}` and a write binding to the same register with
  `value_map {true: 256, false: 512}`. No bit writes are needed.
- **Inputs:** 8 `ushort` holding registers at PDU 81–88 (one per input, `1` = active), read as `binary_input.state`.
- **Not exposed:** register 253 (I/O linking) and 254 (baud rate) are configuration registers; the template does not
  bind them, so the panel can never change the board's baud rate by accident.
- **Category:** `switcher` (eight `switcher` channels plus eight `binary_input` channels).

The miniserver configuration typed the relay range as `1-8` and sent those numbers unchanged as PDU addresses, so the
first relay is PDU address 1 ("register 2" in 1-based notation). This is exactly the off-by-one the wizard's address
notation handling and live read exist for.

## Admin

Built on the `devices-virtual` pattern: a plugin-owned route opened from the Devices view through `routes.wizard`, an
`el-steps` wizard, and one backend request that creates everything.

### Endpoints page

Lists endpoints with live health (state, last error, latency, overload) and the devices on each. Create, edit, enable or
disable, and delete (refused while devices use it).

### Add-device wizard

1. **Endpoint.** Pick an existing endpoint or create one (name, host, port, framing, timeouts). Enter the unit ID.
   **Test connection** sends one read the user chooses (default: one holding register at address 0) and shows the raw
   reply or the Modbus exception, with a plain explanation of common failures (refused → wrong port or TCP server mode
   off; timeout → wrong IP, unit ID or framing; illegal address → device reachable, try another address).
2. **Template or custom.** Choose a template (built-in and user, with load errors listed) or start empty. A template
   fills in endpoint defaults it is compatible with and the points for step 3.
3. **Points.** A table of points: name, capability (channel and property), register type, address (single or range,
   e.g. `0-31` creates 32 points), data type, bit, order overrides, scale/offset, invert, value map, write function.
   A **Read now** button and an optional auto-refresh column show the decoded current value of every point, read
   through the real endpoint. This is where addressing, byte/word order and bit order are verified. Outputs have an
   explicit **Test write** action that asks for confirmation each time; nothing else writes.
4. **Device.** Category (suggested from the points), name, room, poll interval. Structure validation errors are shown
   here, before review.
5. **Review.** Summary of endpoint, device, channels and bindings; **Create** sends one request.

### Device detail and edit

A device detail section shows the endpoint, unit ID, template provenance, and each point's binding and last raw value.
Editing points reuses step 3 and step 4 of the wizard.

### Plugin settings

Default timeouts and poll interval for new endpoints and devices, the template list with load results, and a reload
button.

## Backend API

Under the plugin prefix `/plugins/devices-modbus/`, all following the project's controller conventions (Swagger
decorators, `*ResponseModel`, generated OpenAPI and clients). Owner/administrator only for everything that reads from
or writes to hardware.

- `endpoints` — CRUD, plus `endpoints/:id/health`.
- `probe/read` — one read-only request to an endpoint (saved, or unsaved connection details) and unit; returns raw
  values. Count capped at the protocol limits; rate-limited; never iterates addresses or unit IDs.
- `probe/points` — decode a list of not-yet-saved bindings through a real read (wizard step 3 live values).
- `probe/write` — one explicit write, used only by the wizard's confirmed **Test write**.
- `templates`, `templates/:id`, `templates/:id/preview`, `templates/reload`.
- `devices` — create a Modbus device with its channels, properties and bindings in one transaction; update points of
  an existing device the same way. Validates spec structure, endpoint/unit uniqueness, binding ranges and overlapping
  write targets before writing anything.

## Panel

No Modbus UI. The panel renders from spec categories. A thin model/mapper stub like
`apps/panel/lib/plugins/devices-third-party/` is added for consistency.

## Security

- Templates are declarative and validated against the schema; unknown keys are errors. This keeps them safe to edit
  from admin later.
- Probe endpoints are admin-only, read-only by default, size-capped, rate-limited and cannot scan.
- Endpoint host values are admin-supplied; the plugin does not follow redirects or resolve anything beyond the given
  host.
- Logs carry endpoint name, unit ID, function code and address; never payloads from other plugins.

## Testing

- **Unit:**
  - decoder and encoder (all data types, byte/word orders, bits, invert, maps, scale/offset, range refusal, the PHP
    connector's vectors);
  - read planner (grouping, gaps, limits, 32-bit spans, exception split);
  - endpoint connection with a fake transport (queue order, write priority, `max_in_flight`, timeout reset on RTU over
    TCP, late-reply drop on TCP, backoff, rejection of pending requests on close);
  - button event synthesis and baseline after reconnect;
  - template schema, repeat expansion, priority and revision hashing;
  - device create validation.
- **Integration:** the plugin against `modbus-serial`'s `ServerTCP` as a development dependency: poll, change detection,
  write and read-back, exception handling, endpoint loss and recovery.
- **Admin:** wizard step components and composables (Vitest).
- **Hardware acceptance** (recorded, not CI):
  - the Qingjun 32-DI board over Modbus TCP: every input's state on the panel, button events at the chosen poll rate;
  - the Eletechsup N4D8B08 relay board behind the Waveshare RS485 TO WIFI/ETH gateway, run once in transparent mode
    (`rtu_over_tcp`) and once in Modbus TCP ↔ RTU conversion mode (`tcp`): each relay switched from the panel and
    confirmed by read-back, a burst of commands across all eight relays without lost or misattributed replies, and
    unplugging the gateway and the relay board separately (gateway → endpoint in backoff, relay board → device `lost`
    while the gateway stays connected) and restoring them.

## Delivery phases

1. **Backend core:** plugin skeleton and registration, entities and migration, transport wrapper (both framings),
   decoder, read planner, poller, connection state, write platform, tests.
2. **Templates:** shared YAML loader, Modbus template schema, Qingjun 32-DI and Eletechsup N4D8B08 built-ins, preview and
   from-template creation.
3. **Admin:** endpoints page, probe API, add-device wizard, device detail section, plugin settings.
4. **Completeness:** button synthesis, value maps, analog scaling, valve, point editing, panel stub, documentation.
5. **Hardware acceptance** on both test setups.

## Open items

- ~~**N4D8B08 input register address.**~~ Resolved (2026-11-10): the register table in the relay board document is
  correct as written, so the inputs are at PDU 81–88, in the same notation as the relays at 1–8.
- **Waveshare gateway settings.** The product page lists the modes but not the defaults (IP, TCP port, number of client
  connections, RS485 packing/timeout settings), and the Waveshare wiki was unreachable when this was written. Before
  the hardware tests: note the TCP port used in each mode, set the serial side to 9600 8N1, check that it accepts one
  client connection reliably, and record the relay board's unit ID.

## Left to the builder

- Exact JSON schema syntax for templates, including the repeat/stepping notation.
- Whether the endpoint/unit uniqueness is a partial index or service-level only.
- Admin layout details within the steps described above.
- Defaults not listed here.
- Which user data directory the shared loader resolves: the existing mapping loaders use `var/data` relative to the
  build, while newer plugins use `FB_DATA_DIR`. Confirm what installations actually have and use one source.

## Follow-ups

- Serial RTU transport on a local port.
- Admin YAML editor for user templates.
- Migrating the Shelly NG, Zigbee2MQTT, Home Assistant and Homey loaders to the shared loader.
- Window coverings, multi-register commands, `double_press`, FC43 identification, int64/float64/string, bit writes
  (FC22 mask write or read-modify-write).

## Calls to check

- One unit ID is one device; splitting a module into valves, lights and sensors is done with virtual devices.
- `rw` properties always need a read binding; write-only bindings only for `wo` properties; no core devices-module
  change.
- `modbus-serial` behind a wrapper, rather than our own Modbus TCP client.
- A new shared loader in `apps/backend/src/common/`, without migrating the existing four now.
- Copy-on-create templates with provenance, not a live link to the template.
- Bit-in-register points are read-only in v1.
- Synthesised button events: `down`, `up`, `press`, `long_press` only.
- Default device poll interval 1000 ms; template may set lower; minimum 100 ms.
