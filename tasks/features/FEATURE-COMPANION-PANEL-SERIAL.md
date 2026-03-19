# Task: Panel Flutter Serial Service & Page Synchronization
ID: FEATURE-COMPANION-PANEL-SERIAL
Type: feature
Scope: panel
Size: medium
Parent: EPIC-COMPANION-DISPLAY
Status: planned

## 1. Business goal

In order to have the companion display reflect real-time state and respond to knob input,
As a user,
I want the panel Flutter app to communicate with the companion over USB serial, pushing value updates and receiving input events.

## 2. Context

- The companion is physically connected to the panel device via USB
- Communication uses JSON lines protocol over USB serial (same protocol as `FEATURE-COMPANION-ESPHOME-COMPONENT`)
- The panel app needs to detect the companion, establish connection, and manage the lifecycle
- When the user navigates between pages on the main display, the companion should follow
- When entity values change (e.g. thermostat setpoint), the companion display should update
- When the user rotates/clicks the knob, the panel should process the input as if it came from the touchscreen
- Related: `EPIC-COMPANION-DISPLAY` (parent epic)

## 3. Scope

**In scope**
- USB serial device detection and connection management
- JSON lines protocol implementation (send commands, receive events)
- Value update service: push entity state changes to companion
- Input event service: receive rotation/click events and dispatch to appropriate handlers
- Page synchronization: companion follows main display navigation
- Connection state management (connected, disconnected, reconnecting)
- Companion status indicator widget in the panel UI
- Heartbeat mechanism (send periodic pings, detect disconnect)

**Out of scope**
- Companion configuration/provisioning (handled by admin/backend)
- Multiple companion support (1:1 with panel device for v1)
- Bluetooth or WiFi communication with companion

## 4. Acceptance criteria

- [ ] Panel detects companion device on USB serial port on startup and reconnects on hotplug
- [ ] Sends heartbeat pings every 2 seconds, detects disconnect after 3 missed pongs
- [ ] Sends page navigation command when user switches pages on main display
- [ ] Sends value updates when entity state changes (temperature, brightness, volume, position)
- [ ] Receives rotation events and translates them to entity value changes (e.g. +1°C per detent)
- [ ] Receives click events and triggers appropriate actions (toggle, cycle mode, activate scene)
- [ ] Receives long_press events and cycles to next entity on multi-entity pages
- [ ] Connection state is exposed via provider for UI consumption
- [ ] Companion indicator widget shows connection status in the panel
- [ ] Gracefully handles USB disconnect/reconnect without crashing

## 5. Example scenarios

### Scenario: User adjusts thermostat via knob

Given the panel is showing the Climate page
And the companion is connected and showing the temperature arc at 22°C
When the user rotates the knob clockwise by 2 detents
Then the panel receives `{"evt":"rotate","delta":1,"page":0}` twice
And the panel updates the thermostat setpoint to 24°C
And the panel sends `{"cmd":"screen","id":"arc_0","value":24,"label":"24°C"}` to confirm

### Scenario: User navigates pages on main display

Given the companion has 3 screens (Climate, Lights, Scenes)
When the user swipes to the Lights page on the main touchscreen
Then the panel sends `{"cmd":"nav","page":1}` to the companion
And the companion switches to the brightness arc screen

### Scenario: USB cable disconnected

Given the companion is connected and communicating
When the USB cable is disconnected
Then the panel detects the missing device after 3 missed heartbeat responses
And the companion indicator shows "Disconnected"
And when reconnected, communication resumes automatically

## 6. Technical constraints

- Use `dart:io` or a USB serial package compatible with Linux (the panel runs on Linux SBCs)
- Serial communication must be non-blocking (use isolates or async streams)
- JSON parsing must handle partial lines and malformed input gracefully
- Keep memory usage low (avoid buffering large amounts of serial data)
- Follow existing provider/service patterns in the panel app
- Do not modify generated code

## 7. Implementation hints

### Module Structure
```
apps/panel/lib/modules/companion/
├── services/
│   ├── companion_discovery_service.dart   # Detect USB serial devices
│   ├── companion_serial_service.dart      # Serial protocol implementation
│   └── companion_bridge_service.dart      # Maps events to entity actions
├── providers/
│   ├── companion_state_provider.dart      # Connection state, current page
│   └── companion_binding_provider.dart    # Entity bindings for current screen
└── widgets/
    └── companion_indicator.dart           # Status icon widget
```

### Serial Protocol (Panel side)
```dart
class CompanionSerialService {
  // Outgoing
  void sendScreenUpdate(String widgetId, dynamic value, String label);
  void sendPageNavigation(int pageIndex);
  void sendPing();

  // Incoming (stream)
  Stream<CompanionEvent> get events;
  // CompanionEvent: RotateEvent(delta, page), ClickEvent(page), LongPressEvent(page)
}
```

### Page Sync
```dart
// Listen to main display page changes
pageNavigationProvider.addListener((newPage) {
  final companionPageIndex = screenMapping[newPage.id];
  if (companionPageIndex != null) {
    serialService.sendPageNavigation(companionPageIndex);
  }
});
```

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Examine the existing panel module structure and provider patterns before implementing.
- Keep changes scoped to the panel Flutter app only.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
