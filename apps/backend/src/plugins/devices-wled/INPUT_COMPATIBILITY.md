# WLED Hardware Input Compatibility Matrix & Protocol Audit

This document details the hardware input capabilities, protocol audit findings, and support matrix for the `devices-wled` plugin across supported WLED firmware versions.

## Executive Summary

- **Firmware versions audited**: WLED `v0.13.x`, `v0.14.x`, and `v0.15.x` (audited September 2026).
- **Transports audited**: HTTP JSON API (`/json/state`, `/json/info`, `/json/si`, `/json/cfg`) and real-time WebSocket (`/ws`).
- **Conclusion**: Stock WLED firmware does not expose identifiable physical input gesture events (e.g. button click, double click, long press, or rotary encoder rotation) over its JSON API or WebSocket streams. In accordance with Smart Panel architectural guidelines, the `devices-wled` plugin **does not synthesize or infer button events** from lighting state modifications. All lighting actuators, power telemetry, and synchronization behaviors remain fully supported.

---

## Protocol & Transport Audit

### 1. HTTP JSON API (`/json/state`, `/json/info`, `/json/si`)

- **Documentation**: [WLED JSON API Reference](https://kno.wled.ge/interfaces/json-api/)
- **Inspection Findings**:
  - `/json/state` exposes actuator state (`on`, `bri`, `transition`, `ps` [preset], `pl` [playlist], `nl` [nightlight], `udpn` [sync], `mainseg`, and segment array `seg`). It contains no event history, button identifier, gesture indicator, or input trigger counter.
  - `/json/info` exposes hardware and system metadata (`ver`, `vid`, `mac`, `ip`, `arch`, `freeheap`, `uptime`, `fs`, `leds`).
  - `/json/si` combines state and info in a single payload.

### 2. WebSocket Interface (`/ws`)

- **Documentation**: [WLED WebSocket Reference](https://kno.wled.ge/interfaces/websocket/)
- **Inspection Findings**:
  - The WebSocket transport broadcasts JSON state/info frames on connection and upon lighting state changes. (Note: live LED preview uses a separate binary WebSocket stream, not periodic JSON state frames.)
  - When a physical push button connected to an ESP GPIO pin is pressed, WLED internally executes the action assigned in its Button Settings (such as toggling power, advancing presets, or ramping brightness) and broadcasts the updated lighting state frame (`{"state": {"on": true, "bri": 128, ...}}`).
  - **Identifiability Limitation**: The frame broadcast over WebSocket carries only the resulting lighting state. It does **not** contain metadata identifying:
    1. Which physical button or GPIO pin was triggered.
    2. What physical gesture was performed (press, double press, long press, release).
    3. Whether the state mutation was caused by a hardware button, an app/web client HTTP request, a home automation automation, UDP sync packet, infrared remote, or a scheduled timer.
  - **Architectural Policy**: Mislabeling state mutations as identifiable hardware button gestures without authoritative provenance would violate system correctness and trigger unintended event automations whenever lights are turned on or off via the UI, schedules, or external integrations.

### 3. Hardware Configuration (`/json/cfg`)

- `/json/cfg` exposes pin configuration (`hw.btn.ins[].pin`, `hw.btn.ins[].type`), but this endpoint represents persistent setup settings, not a real-time event or telemetry stream.

---

## Compatibility Matrix

| Input / Feature Type | Stock WLED v0.13.x | Stock WLED v0.14.x | Stock WLED v0.15.x | Status in Smart Panel | Provenance / Rationale |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Physical Button (Single Click)** | ❌ No Event API | ❌ No Event API | ❌ No Event API | **Unsupported** | Stock firmware modifies light state locally; no distinct button event stream is emitted. |
| **Physical Button (Double Click)** | ❌ No Event API | ❌ No Event API | ❌ No Event API | **Unsupported** | No double-click telemetry or event frame in JSON/WebSocket. |
| **Physical Button (Long Press)** | ❌ No Event API | ❌ No Event API | ❌ No Event API | **Unsupported** | Triggers local macro or brightness ramp; no hold/long-press event payload. |
| **Rotary Encoder / Potentiometer** | ❌ No Event API | ❌ No Event API | ❌ No Event API | **Unsupported** | Analog / rotary telemetry is not published over JSON or WebSocket. |
| **Light On/Off Actuation** | ✅ Supported | ✅ Supported | ✅ Supported | **Fully Supported** | Bi-directional control via `/json/state` and WebSocket. |
| **Brightness & Color Actuation** | ✅ Supported | ✅ Supported | ✅ Supported | **Fully Supported** | Mapped to `ChannelCategory.LIGHT`. |
| **Multi-Segment Control** | ✅ Supported | ✅ Supported | ✅ Supported | **Fully Supported** | Mapped to individual segment light channels. |
| **Electrical Power Telemetry** | ✅ Supported | ✅ Supported | ✅ Supported | **Fully Supported** | Exposes ABL-determined current in Amps from `/json/info.leds.pwr` (mA) and calculates power in Watts assuming standard 5V LED operating voltage. |

---

## Future Extensibility Paths

Identifiable physical button ingestion for WLED devices can be addressed in a future enhancement through:
1. **Custom Usermod**: A custom C++ WLED usermod broadcasting discrete JSON event packets (e.g. `{"event": "button", "index": 0, "action": "single"}`) over WebSocket or MQTT.
2. **Dedicated MQTT Ingestion**: Subscribing to an external MQTT broker topic where button actions are specifically routed.

Both paths require transport or firmware changes outside the scope of the stock WLED plugin.
