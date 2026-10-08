# Task: Panel Companion Serial Link, Deck Sync & Knob Control
ID: FEATURE-COMPANION-PANEL-SERIAL
Type: feature
Scope: panel
Size: medium
Parent: EPIC-COMPANION-DISPLAY
Status: planned
Tracking: #1236
Issues: #1249, #1250

## 1. Business goal

In order to have the companion reflect the panel in real time and control the room from the knob,
As a user,
I want the panel app to talk to the companion over USB serial: follow the deck, push values, and turn knob input
into the same space actions the touchscreen uses.

## 2. Context

- The decisions D5, D6, D7, D8 and D10 in `EPIC-COMPANION-DISPLAY` apply. The panel owns the runtime port in every
  deployment mode.
- Platforms: the panel ships for Linux through flutter-pi (Raspberry Pi and other ARM64 boards) and for Android on
  non-RPi hardware. `apps/panel/pubspec.yaml` has **no** serial dependency today.

  | Platform | Transport | Dependency | Detection |
  |---|---|---|---|
  | flutter-pi / Linux | `dart:io` `RandomAccessFile` on `/dev/serial/by-id/*` after `stty -F <dev> raw -echo` (`Process.run`, already used in `lib/core/utils/application.dart`) | none (evaluate `flutter_libserialport` as fallback: FFI, needs `libserialport` on the image) | poll `/dev/serial/by-id` every 2 s + `hello` handshake |
  | Android | `usb_serial` (USB host API, permission prompt, `device_filter.xml` for Espressif / common USB-UART VIDs) | `usb_serial` added in #1249 after license/maintenance check | plugin attach/detach stream + `hello` |
  | macOS / Windows / web | not supported | — | — |

- The display service user needs `dialout` on Linux (`smart-panel-display` currently has `video render input`):
  this is an installer change tracked separately.
- Panel structure rules: `apps/panel/lib/modules/README.md` (`models/`, `repositories/`, `services/`,
  `presentation/`, `module.dart`, `service.dart`, `export.dart`); package imports only.
- Deck: `apps/panel/lib/modules/deck` (`DeckPageActivatedEvent`, `DomainViewItem`, `DomainType`,
  `services/intents_service.dart`, `services/domain_control_state_service.dart`). Space intents:
  `LightingIntentType.BRIGHTNESS_DELTA` / `ROLE_BRIGHTNESS`, `ClimateIntentType.SETPOINT_DELTA` / `SET_MODE`,
  `CoversIntentType.POSITION_DELTA` / `ROLE_POSITION` / `OPEN` / `CLOSE`, media via
  `apps/panel/lib/plugins/spaces-home-control/services/media_activity_service.dart`.
- Optimistic UI: `docs/optimistic-ui-architecture.md`. Knob changes must use the same optimistic state as the
  touchscreen controls, so both UIs agree while the command settles.
- Backend contracts: compiled screens `GET /api/v1/plugins/devices-companion/devices/:id/screens` (#1239); WebSocket
  commands `DevicesCompanionPlugin.ReportStatus` / `ReportInput` (#1238); `ReleasePort` handshake (#1247).

## 3. Scope

**In scope (#1249 – connection)**
- Thin device plugin `apps/panel/lib/plugins/devices-companion/` (models + mappers, like `devices-reterminal`)
- Runtime module `apps/panel/lib/modules/companion/`: `CompanionTransport` interface, `LinuxTtyTransport`,
  `AndroidUsbSerialTransport`, `CompanionConnectionService` (find this display's companion device, detect the port,
  `hello`/`pong`, 2 s ping, 3 missed pongs → disconnected, reconnect with backoff, hotplug), protocol codec
- Status reporting to the backend (`ReportStatus` on connect, on change and every heartbeat window)
- `ReleasePort`/`PortReleased` handling for local flashing
- Companion indicator widget (connected / disconnected / firmware outdated)

**In scope (#1250 – sync and control)**
- `CompanionBridgeService`: maps `DeckPageActivatedEvent` → `nav` (lights→`lighting`, shading→`covers`, system
  view→`overview`, others→`idle`); pushes `screen`/`options` values from the deck's domain state; sends `led` hints
  when the ring is present
- Knob → intents: rotation deltas coalesced per animation frame/100 ms into `*_DELTA` intents (or `ROLE_*` for the
  selected target); click/double/long press per the screen's `clickAction`; long-press cycles `targets`
- Optimistic state through `DomainControlStateService` / existing controllers; the confirmed value is echoed back
- `ReportInput` for every button event and coalesced rotation (≤ 4/s), fire-and-forget, never blocking control

**Out of scope**
- Provisioning/flashing (backend, #1247)
- Multiple companions per panel
- Bluetooth/WiFi links

## 4. Acceptance criteria

### #1249
- [ ] On flutter-pi the companion is found under `/dev/serial/by-id`, opened in raw mode, and identified by `pong` (protocol version checked); no new pub dependency on Linux
- [ ] On Android the companion is opened through `usb_serial` after the USB permission prompt; attach/detach reconnects automatically
- [ ] Ping every 2 s; 3 missed pongs → disconnected; automatic reconnect with backoff; unplugging never crashes the app
- [ ] The service only connects when the backend has a `devices-companion` device whose `display_id` equals this display; otherwise it stays idle (no port scanning loops)
- [ ] `ReportStatus` keeps the backend connection state correct (connected/disconnected, fw, build, mac, ip)
- [ ] `ReleasePort` closes the port within 2 s and acknowledges; resume reopens it
- [ ] The indicator shows connected/disconnected and "firmware outdated" when `pong.build` differs from the compiled `structure_hash`
- [ ] Codec unit tests: partial lines, garbage, oversize lines, unknown events

### #1250
- [ ] Switching deck items sends `nav` with the right screen key within 100 ms
- [ ] Domain value changes (from any source) update the companion screen
- [ ] Rotating on `climate` sends `setpoint_delta` intents with optimistic UI; the touchscreen climate view shows the same pending value
- [ ] Rotating on `lighting` sends `brightness_delta` (all) or `role_brightness` (selected role); long-press cycles the targets and updates the label
- [ ] Rotating on `covers` sends `position_delta`/`role_position`; click toggles open/close
- [ ] Rotating on `media` changes the active activity's volume; click toggles play/pause when supported
- [ ] On `overview` with scenes, rotation moves the selection and click triggers the scene
- [ ] Every button event and coalesced rotation is reported with `ReportInput`; failures are logged, not retried in a loop
- [ ] Widget/unit tests for the bridge mapping and the intent coalescing

## 5. Example scenarios

### Scenario: Thermostat via knob

Given the deck shows the Climate domain view and the companion shows 22 °C
When the user turns the knob 2 detents clockwise
Then the panel receives two `rotate` events, coalesces them, and sends a `setpoint_delta` intent of +1.0 (step 0.5)
And the climate view and the companion show 23 °C as pending until the backend confirms

### Scenario: Navigation follows the deck

Given the companion has screens overview, lighting, climate
When the user swipes to the Lights domain view
Then the panel sends `{"cmd":"nav","screen":"lighting"}`

### Scenario: USB cable unplugged

Given the companion is connected
When the cable is removed
Then after 3 missed pongs the indicator shows "Disconnected" and `ReportStatus` reports `connected: false`
And plugging it back reconnects without user action

## 6. Technical constraints

- Package imports only (`package:fastybird_smart_panel/...`); `snake_case.dart` files
- Serial I/O must not block the UI isolate: async reads with bounded buffers (an isolate only if profiling shows jank)
- No new dependency on Linux; `usb_serial` is the only planned addition (Android), added in #1249 with a justification in the PR
- Do not edit `lib/api/` or `lib/spec/` (generated); run `melos rebuild-all` after the backend OpenAPI changes land
- Run `melos analyze` and the panel tests

## 7. Implementation hints

```
apps/panel/lib/modules/companion/
├── constants.dart  export.dart  module.dart  service.dart
├── models/ (protocol_message.dart, companion_screen.dart)
├── repositories/companion_screens_repository.dart
├── services/
│   ├── transport/companion_transport.dart
│   ├── transport/linux_tty_transport.dart
│   ├── transport/android_usb_serial_transport.dart
│   ├── companion_codec.dart
│   ├── companion_connection_service.dart
│   └── companion_bridge_service.dart
└── presentation/widgets/companion_indicator.dart
```

```dart
abstract class CompanionTransport {
  Stream<List<int>> get input;
  Future<void> open(String portId);
  Future<void> write(List<int> bytes);
  Future<void> close();
}
```

## 8. AI instructions

- Read this file, the epic's Decisions and `docs/optimistic-ui-architecture.md`; read the deck module README before coding; start with a short plan (max 10 steps).
- Follow `CLAUDE.md`; one PR per issue (#1249 connection, #1250 sync and control), scope `panel`.
- For each acceptance criterion, implement it or explain why it is skipped.
