# Epic: Companion Display (ESP32 Knob with Round LCD)
ID: EPIC-COMPANION-DISPLAY
Type: feature
Scope: backend, admin, panel
Size: large
Parent: (none)
Status: planned

## 1. Business goal

In order to have a physical rotary control with a small round display alongside the main touchscreen panel,
As a smart home user,
I want a companion display (ESP32 + rotary encoder + round LCD) that shows contextual controls (temperature, brightness, volume) and responds to rotation and clicks, so I can adjust values without touching the main screen.

## 2. Context

### Inspiration
Commercial smart panels (e.g. the image reference) combine a large touchscreen with a small round knob display on the side. The knob provides tactile, eyes-free control for the most common adjustments: thermostat setpoint, light brightness, volume, curtain position.

### Hardware Target
- ESP32-S3 boards with 1.28" round GC9A01 LCD + rotary encoder (widely available, ~$5-10)
- Examples: generic ESP32-S3 + GC9A01 boards, LilyGO T-Encoder Pro, Waveshare round LCD
- SmartKnob-inspired open hardware designs

### Architecture Overview
- **Companion display** = child of a parent display, managed via a backend plugin
- **Firmware** = ESPHome with LVGL for UI rendering on the round display
- **Provisioning** = initial USB flash to bootstrap WiFi + OTA, then OTA updates from server
- **Runtime communication** = USB serial between panel device and companion for real-time value updates and input events
- **Screen compilation** = server inspects parent display's pages/tiles and generates appropriate companion screens

### Deployment Modes

**Separate server mode:**
- Backend/admin runs on a central server
- Panel (Flutter) runs on a separate display device
- Companion is physically attached to the panel device via USB
- Server pushes OTA firmware updates to companion over WiFi
- Panel communicates with companion over USB serial for runtime data

**All-in-one mode:**
- Server + panel run on the same device
- Companion attached via USB to the same device
- Simpler: can flash and communicate entirely over USB, WiFi on companion is optional

### Related Tasks
- `EPIC-EXPAND-SMART-PANEL-DOMAINS` - Companion screens map to domain pages (climate, lights, media, covers)
- `FEATURE-SPACE-CLIMATE-MVP` (done) - Climate domain provides thermostat arc screen
- `FEATURE-SPACE-INTENTS-LIGHTING-MVP` (done) - Lighting domain provides brightness arc screen
- `FEATURE-SPACE-MEDIA-DOMAIN-V2` (done) - Media domain provides volume arc screen
- `FEATURE-SPACE-COVERS-DOMAIN` (done) - Covers domain provides position arc screen

## 3. Scope

**In scope**

### Phase 1: Backend Foundation
- Companion display data model (child of parent display)
- CRUD API for companion displays
- Transport configuration (USB serial, with abstraction for future UART/SPI)
- Admin UI for creating/managing companion displays

### Phase 2: Firmware Generation & Provisioning
- ESPHome YAML generator that produces firmware config from companion screen definitions
- Screen compiler that maps parent display pages/tiles to companion screen types
- Initial provisioning flow (USB flash of base ESPHome firmware with WiFi + OTA)
- OTA update pipeline (server compiles ESPHome, pushes firmware over WiFi or USB)

### Phase 3: Runtime Communication
- Serial protocol (JSON lines over USB) between panel Flutter app and companion
- Panel-side serial service for sending value updates and receiving input events
- Companion-side custom ESPHome component for parsing serial commands and updating LVGL
- Active page synchronization (companion follows what's active on main display)

### Phase 4: Screen Types & Polish
- Arc slider screen (temperature, brightness, volume, position)
- Mode selector screen (cycle through modes via click)
- Status display screen (read-only info browsing)
- Binary toggle screen (on/off with animation)
- LED ring support (addressable LEDs for visual feedback)

**Out of scope**
- WiFi-only companion displays (no physical connection to panel)
- Companion displays with touch input (rotary + button only)
- Custom user-designed screens (auto-generated from parent pages only for v1)
- Multiple companions per parent display (1:1 relationship for v1)
- Bluetooth communication
- Audio output on companion
- Complex haptic feedback patterns (basic detent feedback only)

## 4. Acceptance criteria

### Foundation
- [ ] Companion display entity exists as a child of a parent display
- [ ] CRUD API allows creating, updating, deleting companion displays
- [ ] Admin UI provides companion display management (create, configure, assign parent)
- [ ] Transport type is configurable (USB serial for v1, abstracted for future types)

### Firmware & Provisioning
- [ ] Screen compiler derives companion screens from parent display's pages and tiles
- [ ] ESPHome YAML generator produces valid firmware config with LVGL screens
- [ ] Base firmware can be flashed via USB for initial provisioning
- [ ] OTA updates can be pushed from server over WiFi (separate mode) or USB (all-in-one)
- [ ] Admin UI shows "Generate & Upload" workflow with progress feedback

### Runtime
- [ ] Panel Flutter app detects companion on USB serial and establishes communication
- [ ] Live value updates flow from panel to companion (e.g. temperature changed)
- [ ] Input events flow from companion to panel (rotate, click, long_press, double_click)
- [ ] Active page on companion synchronizes with main display navigation
- [ ] Companion works in both deployment modes (separate server, all-in-one)

### Screen Types
- [ ] Arc slider works for at least: temperature, brightness, volume, cover position
- [ ] Mode selector allows cycling through options (e.g. HVAC modes, scenes)
- [ ] Status display shows read-only information with rotation browsing
- [ ] Multiple entities on same page: long-press cycles between them

## 5. Example scenarios

### Scenario: Create and provision a companion display

Given a panel display "Living Room Panel" exists with Climate, Lights, and Media pages
When the admin creates a new companion display assigned to "Living Room Panel"
Then the system compiles 3 companion screens (Climate arc, Lights arc, Media arc)
And the admin can review/customize the screen mapping
And hitting "Upload" generates ESPHome firmware and flashes it to the companion

### Scenario: Runtime climate control via knob

Given the companion is connected to the panel via USB
And the main display is showing the Climate page
When the user rotates the knob clockwise by 2 detents
Then the companion display updates from 22°C to 24°C
And the panel sends the new setpoint to the backend
And the companion arc animates to the new position

### Scenario: Page synchronization

Given the companion has screens for Climate (page 0), Lights (page 1), Media (page 2)
When the user navigates from Climate to Lights on the main touchscreen
Then the companion display switches from the temperature arc to the brightness arc

### Scenario: Multiple entities on a page

Given the Lights page has 3 dimmable lights (Ceiling, Desk Lamp, LED Strip)
And the companion shows Ceiling Light brightness by default
When the user long-presses the knob button
Then the companion cycles to Desk Lamp
And the label updates to "Desk Lamp"

### Scenario: OTA update after page change (separate server mode)

Given the admin adds a new "Scenes" page to the parent display
When the admin hits "Re-upload" on the companion configuration
Then the server recompiles the ESPHome YAML with the new scene selector screen
And pushes the firmware to the companion via OTA over WiFi
And the companion reboots with the updated screens

## 6. Technical constraints

- Follow the existing plugin pattern in `apps/backend/src/plugins/`
- Companion display entity relates to parent display via the existing displays module
- Transport abstraction should allow future UART/SPI implementations without refactoring
- Serial protocol must be lightweight (JSON lines) and resilient to disconnects/reconnects
- ESPHome YAML generation must produce valid configs that compile with `esphome compile`
- Custom ESPHome component (C++) must handle serial protocol parsing and LVGL updates
- Panel serial service must handle USB device detection, connection lifecycle, and error recovery
- Do not modify generated code (OpenAPI, specs)
- Tests are expected for backend business logic (screen compiler, YAML generator, CRUD)

## 7. Implementation hints

### Backend Plugin Structure
```
apps/backend/src/plugins/companion-display/
├── companion-display.module.ts
├── controllers/
│   ├── companion.controller.ts           # CRUD API
│   └── companion-deploy.controller.ts    # Generate & upload endpoint
├── services/
│   ├── companion.service.ts              # CRUD business logic
│   ├── screen-compiler.service.ts        # Parent pages → companion screens
│   ├── esphome-generator.service.ts      # Generates ESPHome YAML
│   ├── firmware-builder.service.ts       # Calls esphome compile
│   ├── ota-updater.service.ts            # Pushes firmware over WiFi/USB
│   └── provisioning.service.ts           # Initial USB flash
├── transports/
│   ├── transport.interface.ts            # Abstract transport
│   └── usb-serial.transport.ts           # USB serial implementation
├── dto/
│   ├── create-companion.dto.ts
│   └── update-companion.dto.ts
├── entities/
│   └── companion-display.entity.ts
└── models/
    ├── companion-screen.model.ts
    └── companion-display.response-model.ts
```

### Panel Module Structure
```
apps/panel/lib/modules/companion/
├── services/
│   ├── companion_discovery_service.dart   # Detect companion on USB
│   └── companion_serial_service.dart      # USB serial protocol
├── providers/
│   ├── companion_state_provider.dart      # Connection state
│   └── companion_binding_provider.dart    # Active entity binding
└── widgets/
    └── companion_indicator.dart           # Status icon in panel UI
```

### ESPHome Custom Component
```
packages/companion-firmware/
├── base.yaml                     # Base ESPHome config (WiFi, OTA, serial)
├── components/
│   └── panel_protocol/           # Custom component
│       ├── __init__.py
│       ├── panel_protocol.h
│       └── panel_protocol.cpp
└── templates/
    ├── arc_slider.yaml.j2        # Arc slider screen template
    ├── mode_selector.yaml.j2     # Mode selector screen template
    └── status_display.yaml.j2    # Status display screen template
```

### Serial Protocol
```
# Panel → Companion (display commands)
{"cmd":"screen","id":"arc_climate","value":22,"min":16,"max":30,"unit":"°C","label":"AC"}
{"cmd":"nav","page":1}
{"cmd":"led","color":"#4FC3F7","brightness":80}

# Companion → Panel (input events)
{"evt":"rotate","delta":1,"page":0}
{"evt":"click","page":0}
{"evt":"long_press","page":0}
{"evt":"double_click","page":0}
```

### Screen Compilation Rules
```
Parent Page Domain    →  Companion Screen Type
─────────────────────────────────────────────
Climate               →  arc_slider (temperature setpoint, click = cycle mode)
Lights (dimmable)     →  arc_slider (brightness, click = toggle)
Media                 →  arc_slider (volume, click = play/pause)
Covers                →  arc_slider (position, click = open/close)
Scenes                →  mode_selector (rotate to pick, click to activate)
Overview (read-only)  →  status_display (rotate to browse)
```

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start with Phase 1 (backend foundation) as it is prerequisite for all other phases.
- Each subtask should be completable independently.
- Follow the existing plugin patterns established in the codebase.
- Keep changes scoped to the specific subtask and its `Scope`.
- The ESPHome/firmware work (Phase 2) may require research into ESPHome LVGL support and custom components.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.

## 9. Subtasks

### Phase 1: Backend Foundation
| ID | Task | Size | Scope | Status |
|----|------|------|-------|--------|
| FEATURE-COMPANION-BACKEND-PLUGIN | Backend plugin: data model, CRUD API, transport abstraction | medium | backend | planned |
| FEATURE-COMPANION-ADMIN-UI | Admin UI for companion display management | medium | admin | planned |

### Phase 2: Firmware Generation & Provisioning
| ID | Task | Size | Scope | Status |
|----|------|------|-------|--------|
| FEATURE-COMPANION-SCREEN-COMPILER | Screen compiler: parent pages → companion screen definitions | medium | backend | planned |
| FEATURE-COMPANION-ESPHOME-GENERATOR | ESPHome YAML generator and firmware build pipeline | large | backend | planned |
| FEATURE-COMPANION-PROVISIONING | Provisioning flow: initial USB flash + OTA update pipeline | medium | backend, admin | planned |

### Phase 3: Runtime Communication
| ID | Task | Size | Scope | Status |
|----|------|------|-------|--------|
| FEATURE-COMPANION-ESPHOME-COMPONENT | Custom ESPHome component for serial protocol + LVGL | large | firmware | planned |
| FEATURE-COMPANION-PANEL-SERIAL | Panel Flutter serial service + page sync | medium | panel | planned |

### Phase 4: Screen Types & Polish
| ID | Task | Size | Scope | Status |
|----|------|------|-------|--------|
| FEATURE-COMPANION-SCREEN-TYPES | Implement all screen types (arc, mode selector, status, toggle) | medium | firmware, backend | planned |
| FEATURE-COMPANION-LED-RING | LED ring support for visual feedback | small | firmware | planned |
