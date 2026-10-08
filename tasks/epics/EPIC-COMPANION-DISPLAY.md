# Epic: Companion Display (ESP32 Knob with Round LCD)
ID: EPIC-COMPANION-DISPLAY
Type: feature
Scope: backend, admin, panel, sdk, installer, ci, docs
Size: large
Parent: (none)
Status: planned
Tracking: #1236

> **Regrounded on 2026-10-07 (#1237).** The product and approach are unchanged. The specs now follow the current
> codebase: the companion is a device in a new `devices-companion` plugin, long-running work runs in managed
> extension services, the ESPHome toolchain is an optional component, and screens compile from the parent display's
> space domains. See [Decisions (2026-10-07)](#decisions-2026-10-07).

## 1. Business goal

In order to have a physical rotary control with a small round display alongside the main touchscreen panel,
As a smart home user,
I want a companion display (ESP32 + rotary encoder + round LCD) that shows contextual controls (temperature, brightness, volume) and responds to rotation and clicks, so I can adjust values without touching the main screen.

## 2. Context

### Inspiration
Commercial smart panels combine a large touchscreen with a small round knob display on the side. The knob gives
tactile, eyes-free control for the most common adjustments: thermostat setpoint, light brightness, volume and cover
position.

### Hardware target
- ESP32-S3 board with a 1.28" round GC9A01 LCD (240×240) and a rotary encoder with push button (~$5-10)
- Examples: generic ESP32-S3 + GC9A01 boards, LilyGO T-Encoder Pro, Waveshare round LCD
- Optional addressable LED ring (WS2812/SK6812)
- v1 targets **one reference board**. It is picked during hardware acceptance (#1252); see Open questions.

### Architecture overview
- **Companion** = a device of type `devices-companion` (category `input_controller`) linked to its parent display by
  `display_id`. It gets connection state, room assignment, the shared device wizard and hardware-input channels
  from the devices module.
- **Firmware** = ESPHome + LVGL with a custom external component (`panel_protocol`) from
  `packages/companion-firmware`.
- **Provisioning** = the first flash goes over USB from the backend host (esptool). Updates after that go OTA over
  WiFi from the backend (or over USB when the companion is plugged into the backend host).
- **Runtime link** = USB serial (JSON lines) between the **panel app** and the companion. The panel owns the port in
  every deployment mode.
- **Screen compilation** = the backend derives companion screens from the domains of the space that the parent
  display shows (the same domains the panel deck shows).

### Current code this epic builds on
| Concern | Existing code |
|---|---|
| Parent display | `apps/backend/src/modules/displays/entities/displays.entity.ts` (`DisplayEntity`, `spaceId`, `homeMode`), `DeploymentMode` in `displays.constants.ts` |
| Device plugin precedent (host-attached hardware, button channels, managed service) | `apps/backend/src/plugins/devices-reterminal` |
| Device plugin with a plugin-owned admin route | `apps/backend/src/plugins/devices-virtual`, `apps/admin/src/plugins/devices-virtual/router` |
| Plugin registration | `ExtensionsService.registerPluginMetadata()`, `PluginsTypeMapperService`, `DevicesTypeMapperService`, `ExtendedDiscriminatorService`, the `RouterModule` tree in `apps/backend/src/app.module.ts` |
| Managed services | `apps/backend/src/modules/extensions/services/managed-service-manager.service.ts`, `base-managed-extension.service.ts`, `managed-service-registration.inventory.spec.ts`; plan `docs/superpowers/plans/2026-09-01-managed-extension-services.md` |
| Optional OS-level component installed on demand | `apps/backend/src/plugins/remote-access-tailscale` (`not-installed` state, `TailscaleSetupService` on `PrivilegedWorkerService`, installer flag `--with-tailscale`) |
| Hardware inputs | `docs/hardware-inputs.md`, `ChannelInputOccurrencesService` (`apps/backend/src/modules/devices/services/channel-input-occurrences.service.ts`), `input_controller` device spec in `spec/devices/devices.yaml` |
| Space domains | `apps/backend/src/plugins/spaces-home-control` (lighting, climate, covers, media, sensors; intents `brightness_delta`, `setpoint_delta`, `position_delta`, `set_mode`), panel `apps/panel/lib/modules/deck` (`DomainType`: lights, climate, shading, media, sensors, energy) |
| Panel ↔ backend commands | `CommandEventRegistryService` (WebSocket), e.g. `apps/backend/src/plugins/spaces-home-control/listeners/websocket-exchange.listener.ts` |
| Optimistic UI | `docs/optimistic-ui-architecture.md`, `apps/panel/lib/modules/deck/services/domain_control_state_service.dart` |
| Write-only secrets | `docs/config-secrets.md` |

### Deployment modes (`DeploymentMode`)

| Mode | Backend host | Panel device | Companion plugged into | First flash | Updates | Runtime serial |
|---|---|---|---|---|---|---|
| `all-in-one` | same device as panel | same device | the shared device | backend esptool on the local port (the panel releases the port first) | OTA over WiFi, or USB re-flash on the local port if WiFi is not configured | panel app |
| `combined` (default), local panel | server, also runs a local panel | server | server | as `all-in-one` | as `all-in-one` | panel app |
| `combined` / `standalone`, remote panel | server | separate device | remote panel device | plug the companion into the backend host once, **or** download the factory binary and flash it with any ESPHome web flasher | OTA over WiFi from the backend | panel app |
| Docker / Home Assistant add-on | container | any | any | not supported in v1 (no toolchain); exported YAML for an external ESPHome is the fallback | same | panel app |

The backend never opens the runtime port. It chooses USB or OTA by **reachability** (is the companion's USB serial
number among the backend host's `/dev/serial/by-id/*` entries?), not by reading `DeploymentMode`.

### Related tasks
- `EPIC-EXPAND-SMART-PANEL-DOMAINS` (`tasks/epics/`): the domains the companion screens map to
- `FEATURE-SPACE-CLIMATE-MVP` (`tasks/archive/`, done): climate intents (setpoint arc)
- `FEATURE-SPACE-INTENTS-LIGHTING-MVP` (`tasks/archive/`, done): lighting intents (brightness arc)
- `FEATURE-SPACE-MEDIA-DOMAIN-V2` (`tasks/features/`): media activities (volume arc)
- `FEATURE-SPACE-COVERS-DOMAIN` (`tasks/features/`): covers intents (position arc)

## Decisions (2026-10-07)

| # | Decision | Rationale |
|---|---|---|
| D1 | **Model the companion as a device in a new `devices-companion` plugin.** `CompanionDeviceEntity` is a `@ChildEntity` of `DeviceEntity` with category `input_controller` and a nullable `display_id` FK to `displays_module_displays` (`ON DELETE SET NULL`, one companion per display). `DisplayEntity` is not changed. | `DisplayEntity` has no parent/child concept and no plugin extension point. A device gets connection state (`DeviceConnectivityService`), room/zone assignment, the unified device wizard and the button/analog-input channels for free. `devices-reterminal` already models host-attached panel hardware this way. |
| D2 | **Plugin layout.** Backend `apps/backend/src/plugins/devices-companion` (`DEVICES_COMPANION_PLUGIN_NAME = 'devices-companion-plugin'`, prefix and type `devices-companion`), routes under `/api/v1/plugins/devices-companion/*`, schemas prefixed `DevicesCompanionPlugin…`, metadata via `registerPluginMetadata()`. Device CRUD uses the devices module (`/api/v1/modules/devices/devices` with `type: 'devices-companion'`); there are no standalone `/companion-displays` routes. The admin mirror is `apps/admin/src/plugins/devices-companion`. The panel has a thin `apps/panel/lib/plugins/devices-companion` plus a runtime module `apps/panel/lib/modules/companion`. Plugin columns are added by a new incremental migration. | This matches every existing device plugin and the CLAUDE.md migration policy. |
| D3 | **Long-running work runs in managed extension services.** The plugin has two: `firmware` (one job queue for toolchain install, build, USB flash and OTA) and `runtime` (heartbeat watchdog that drives connection state). Both are `owner-enabled`, are registered with `ManagedServiceManagerService` and are added to `managed-service-registration.inventory.spec.ts`. CLI mode (`FB_CLI=on`) never starts them, so CLI commands never spawn builds. | This is the current rule for background runtimes. It also gives start/stop, health and status in the admin extension view. |
| D4 | **The ESPHome toolchain is optional.** It is detected at runtime and installed on demand from the admin: ESPHome pinned in a Python venv under `${FB_DATA_DIR}/companion/toolchain`, with `PLATFORMIO_CORE_DIR` beside it. A privileged-worker job is used only for OS packages (`python3-venv`), following the Tailscale setup pattern. A `toolchain.mode = external` config can point at an existing `esphome` executable. The states are `unsupported` (Docker, Home Assistant add-on), `not-installed`, `installing`, `ready` and `error`. An installer flag is deferred. | Neither the installer, the Raspberry Pi image nor the Alpine Docker image ships Python or PlatformIO, and most users never buy a companion. Estimated cost on a Pi: ~0.5 GB venv, ~1.5-2.5 GB PlatformIO platform and toolchain, ~1-1.5 GB RAM peak per build, and a first build of 10-30 min on a Pi 4 (measured in #1246). |
| D5 | **USB actions.** Runtime serial always lives on the **panel device**, in the Flutter app. Serial-port listing and esptool flashing run on the **backend host** only. The panel never flashes. The fallback is "download factory firmware" for any ESPHome web flasher. Admin-side Web Serial is deferred. | Flashing from the backend reuses the toolchain that builds already need. Flashing from the panel would need esptool on flutter-pi and Android. Web Serial needs a secure context, and the admin is usually served over plain HTTP on the LAN. |
| D6 | **Panel serial per platform** (no dependency is added by this regrounding). flutter-pi/Linux: `dart:io` on `/dev/serial/by-id/*` with `stty raw -echo` through `Process.run`, with `flutter_libserialport` (FFI, needs `libserialport` on the image) as a fallback. Android: `usb_serial`, added in #1249. macOS, Windows and web are not supported. The transport abstraction lives in the panel, not in the backend. | flutter-pi has no GTK plugin host; `dart:io` file access needs no native plugin, and `Process.run` is already used in `apps/panel/lib/core/utils/application.dart`. |
| D7 | **Knob events reach the backend as hardware inputs.** The companion device has a `button` channel (`event` EVENT_ONLY: press, double_press, long_press, down, up; `detected`) and an `analog_input` channel (`value` = cumulative encoder steps, coalesced at most every 250 ms). The panel still handles the knob locally through space intents with optimistic state, and reports occurrences to the backend over a fire-and-forget WebSocket command. The backend publishes them through `ChannelInputOccurrencesService`. | Other consumers (scenes, automations, Buddy) can see the knob without a spec change, and control latency does not depend on the backend round trip. |
| D8 | **Screens compile from the parent display's space**, not from pages and tiles. Input: `display.spaceId` → space type → the domains the deck shows (room overview, then lighting, climate, covers, media, sensors, energy, gated by the same target counts the panel uses). Scenes with `primarySpaceId` = the space become the overview selector. Dashboard pages and the security view map to a built-in `idle` screen. Only a **structure hash** (screen keys, types, order) requires a re-flash. Labels, ranges and options are pushed at runtime. | The panel is space/deck based. Pages and tiles are only user dashboard pages now. Pushing values at runtime keeps re-flashes rare. |
| D9 | **Firmware package `packages/companion-firmware`** (commit scope `sdk`): the ESPHome external component `panel_protocol`, reference board configs and a CI test config. A new `ci-tests.yaml` job compiles the reference config with the pinned ESPHome. The backend publishes a copy of the component in its package (`static/companion-firmware/`), so server builds never fetch it from the network. | `Scope: firmware` is not a valid scope. Shipping the component with the backend keeps backend and firmware protocol versions in lock-step. |
| D10 | **Protocol.** JSON lines over USB CDC, versioned (`hello`/`pong` carry `proto`, firmware version, build hash and MAC). The ESPHome logger is moved off the USB CDC port. | The panel needs the build hash to detect outdated firmware and the MAC as the device `identifier`. Log output must not corrupt the protocol stream. |
| D11 | **Dropped from the original spec:** the backend transport abstraction, serial port and baud rate on the entity, a separate generic "base firmware" (the first flash writes the compiled firmware), the `POST …/screens/compile` endpoint (compilation is deterministic and runs on read), and polling-only progress (jobs emit WebSocket events and also expose a status endpoint). | These are simpler, and each item conflicts with D1, D5 or D8. |

## Open questions

- Rotation for other consumers: is the `analog_input` step counter enough, or should the `button` channel format
  gain `rotate_cw`/`rotate_ccw` (a `spec` change)? v1 ships the counter.
- Docker and Home Assistant add-on users: is a remote build target (the user's own ESPHome) worth doing, or is YAML
  export enough?
- Which reference board (pinout, encoder pins, LED ring pin)? This needs hardware in hand (#1252).
- Minimum Raspberry Pi for on-device builds (2 GB vs 4 GB RAM): decide after measuring in #1246.
- Admin Web Serial flashing over HTTPS (remote access): follow-up or never?

## 3. Scope

**In scope**

### Phase 1: Backend foundation
- `devices-companion` plugin: device/channel/property child entities, the parent display link, migration, config
  with write-only secrets (WiFi password, OTA password), plugin metadata
- Runtime ingress from the panel (status heartbeat, input occurrences) and the `runtime` managed service
- Admin plugin: add/edit forms, wizard adapter, companion detail route

### Phase 2: Firmware generation and provisioning
- Screen compiler from space domains
- ESPHome YAML generator (backend TypeScript, `yaml` library) referencing the bundled `panel_protocol` component
- Toolchain detection and on-demand install; `firmware` managed service with build/flash/OTA job queue
- USB provisioning on the backend host, OTA deploy, firmware/YAML download
- Admin deploy workflow with job progress and a "toolchain missing" state

### Phase 3: Runtime communication
- `packages/companion-firmware` with the `panel_protocol` component and a CI compile job
- Panel serial transport (flutter-pi + Android), connection lifecycle, heartbeat
- Panel bridge: deck page sync, value push, knob → space intents with optimistic state, occurrence reporting

### Phase 4: Screen types and polish
- Arc slider, mode selector, status display, binary toggle, idle screen (LVGL)
- Optional LED ring
- `docs/companion-architecture.md` and hardware acceptance

**Out of scope**
- WiFi-only companions (no physical connection to a panel)
- Touch input on the companion (rotary + button only)
- User-designed screens (auto-generated only in v1)
- More than one companion per display
- Bluetooth, audio, complex haptics
- Flashing from the panel device; admin Web Serial flashing
- Toolchain in the Docker image or Raspberry Pi image; installer toolchain flag
- Multiple board variants (one reference board in v1)

## 4. Acceptance criteria

### Foundation
- [ ] A `devices-companion` device can be created through the devices module and the device wizard, linked to exactly one display
- [ ] Deleting the display unlinks the companion (`display_id` → null); the admin shows "no parent display"
- [ ] The companion has `device_information`, `button` and `analog_input` channels per `docs/hardware-inputs.md`
- [ ] Panel heartbeats drive the device connection state; missing heartbeats mark it `lost`
- [ ] Both managed services appear in the extensions view and do not start in CLI mode

### Firmware and provisioning
- [ ] The screen compiler derives screens from the parent display's space domains
- [ ] The ESPHome YAML generator produces a config that passes `esphome config`, and the reference config compiles in CI
- [ ] Without a toolchain, the admin shows `not-installed`/`unsupported` with a clear next step; install works on Raspberry Pi OS
- [ ] The first flash works over USB from the backend host; later deploys go OTA over WiFi (or USB when local)
- [ ] The factory binary and YAML can be downloaded as a fallback
- [ ] The admin shows job progress (queued → building → flashing/uploading → done/error)

### Runtime
- [ ] The panel detects the companion on USB (flutter-pi and Android) and reconnects on hotplug
- [ ] Values flow panel → companion; input events flow companion → panel
- [ ] The companion follows the active deck page
- [ ] Knob actions control the space through intents with optimistic UI, and appear as hardware-input occurrences on the companion device
- [ ] It works in `all-in-one`, `combined` and `standalone` modes

### Screen types
- [ ] The arc slider works for temperature, brightness, volume and cover position
- [ ] The mode selector cycles through options (scenes, climate modes)
- [ ] The status display shows read-only readings with rotation browsing
- [ ] Long-press cycles between targets (lighting/covers roles)

## 5. Example scenarios

### Scenario: Add and provision a companion (combined mode, remote panel)

Given a display "Living Room Panel" shows the space "Living Room", which has lighting, climate and media targets
And the companion toolchain is `ready` on the server
When the admin adds a companion device for "Living Room Panel" in the device wizard
Then the compiled screens are Overview (scenes), Lighting arc, Climate arc, Media arc
When the admin plugs the board into the server and clicks "Provision" on its serial port
Then the backend builds the firmware, flashes it with esptool and stores the board MAC as the device identifier
And after the board is moved to the panel, the panel connects and the device becomes `connected`

### Scenario: Runtime climate control via knob

Given the companion is connected to the panel and the deck shows the Climate domain view
When the user rotates the knob clockwise by 2 detents
Then the companion arc moves locally from 22 °C to 23 °C (step 0.5)
And the panel sends `setpoint_delta` climate intents with optimistic state
And the analog-input step counter on the companion device increases by 2

### Scenario: Page synchronization

Given the companion firmware has screens Overview, Lighting, Climate, Media
When the user swipes from Lighting to Climate on the panel
Then the panel sends `{"cmd":"nav","screen":"climate"}` and the companion shows the temperature arc

### Scenario: Multiple targets on a screen

Given the space has lighting roles Main, Task and Ambient
And the companion Lighting screen controls "All lights"
When the user long-presses the knob
Then the screen cycles to "Main" and rotation sends `role_brightness` intents for that role

### Scenario: Space change requires re-flash (OTA)

Given the companion firmware was built for Overview, Lighting, Climate
When a covers target is added to the space
Then the compiled structure hash differs from the deployed one and the admin shows "Update available"
When the admin clicks "Deploy", the backend rebuilds and pushes the firmware over WiFi OTA

## 6. Technical constraints

- Backend plugin follows `devices-reterminal`/`devices-virtual`: type mappers, discriminators, Swagger extra models, `registerPluginMetadata`, `RouterModule` entry in `app.module.ts`
- Controllers follow CLAUDE.md API conventions (`@ApiTags`, `@ApiOperation` with `operationId`, `*ResponseModel`, schema names `DevicesCompanionPlugin{Res|Data|…}`)
- Schema changes only through a new incremental migration in `apps/backend/src/migrations/` (next free number)
- Secrets via `secretFields` (`docs/config-secrets.md`); add the plugin to `apps/backend/src/plugins/plugin-secret-removal.spec.ts` and `apps/admin/src/plugins/config-secrets.spec.ts`
- External processes (`esphome`, `esptool`) run only inside the `firmware` managed service, with timeouts, cancellation and captured logs; never in request handlers
- Toolchain, build caches and firmware artifacts live under `${FB_DATA_DIR}/companion/` and are excluded from backups
- Serial access: the display service user (`smart-panel-display`, today `SupplementaryGroups=video render input` in
  `scripts/install-display.sh` and `build/raspbian/modules/configure/files/smart-panel-display.service`) and the
  server user (`smart-panel`) need the `dialout` group. This is an `installer` change; it has no issue yet (see the
  #1237 report)
- Panel: package imports only; runtime code in `lib/modules/companion` per `lib/modules/README.md`; knob control through existing intents and `DomainControlStateService`
- Do not edit generated code (`spec/api/v1/openapi.json`, `apps/admin/src/openapi.ts`, `apps/panel/lib/api/`); run `pnpm run generate:openapi`
- Tests for compiler, generator, job orchestration, ingress handlers, panel protocol parser and bridge

## 7. Implementation hints

### Backend plugin structure
```
apps/backend/src/plugins/devices-companion/
├── devices-companion.plugin.ts          # mappers, discriminators, metadata, managed services
├── devices-companion.constants.ts       # names, prefix, channel identifiers, protocol version
├── devices-companion.openapi.ts
├── controllers/
│   ├── companion-screens.controller.ts      # GET devices/:id/screens
│   ├── companion-firmware.controller.ts     # provision, deploy, jobs, downloads
│   └── companion-toolchain.controller.ts    # toolchain status/install, serial-ports
├── dto/ entities/ models/
├── listeners/
│   └── websocket-exchange.listener.ts       # panel status + input reports
├── platforms/companion.device.platform.ts   # property commands are not supported (read-only device)
└── services/
    ├── companion-devices.service.ts
    ├── companion-channels.service.ts        # ensures button/analog_input/device_information channels
    ├── companion-runtime.managed.service.ts # watchdog → DeviceConnectivityService
    ├── screen-compiler.service.ts
    ├── esphome-generator.service.ts
    ├── companion-toolchain.service.ts
    ├── companion-firmware.managed.service.ts # job queue
    └── serial-ports.service.ts               # /dev/serial/by-id listing on the backend host
```

### Panel structure
```
apps/panel/lib/plugins/devices-companion/   # models + mappers like devices-reterminal
apps/panel/lib/modules/companion/
├── constants.dart  export.dart  module.dart  service.dart
├── models/          # protocol messages, compiled screens
├── repositories/    # compiled screens from the backend
├── services/
│   ├── transport/companion_transport.dart        # interface
│   ├── transport/linux_tty_transport.dart         # dart:io + stty
│   ├── transport/android_usb_serial_transport.dart
│   ├── companion_connection_service.dart          # detect, hello, heartbeat, reconnect
│   └── companion_bridge_service.dart              # deck sync, values, intents, occurrence reports
└── presentation/widgets/companion_indicator.dart
```

### Firmware package
```
packages/companion-firmware/
├── README.md
├── components/panel_protocol/  (__init__.py, panel_protocol.h, panel_protocol.cpp)
├── boards/reference.yaml       # hardware substitutions for the reference board
└── tests/ci-reference.yaml     # compiled by CI
```

### Serial protocol (v1)
```
# Panel → Companion
{"cmd":"hello","proto":1}
{"cmd":"ping"}
{"cmd":"nav","screen":"climate"}
{"cmd":"screen","screen":"climate","value":22.5,"min":16,"max":30,"step":0.5,"unit":"°C","label":"Living Room","target":"all"}
{"cmd":"options","screen":"overview","items":[{"id":"…","label":"Movie"}],"selected":0}
{"cmd":"led","color":"#4FC3F7","brightness":80,"effect":"arc","value":43}

# Companion → Panel
{"evt":"pong","proto":1,"fw":"1.0.0","build":"<structure-hash>","mac":"AA:BB:…","ip":"192.168.1.40"}
{"evt":"rotate","delta":1,"screen":"climate"}
{"evt":"press","screen":"climate"}          # also double_press, long_press, down, up
```

### Screen compilation (summary, details in FEATURE-COMPANION-SCREEN-COMPILER)
```
Deck item (panel)                     → Companion screen
───────────────────────────────────────────────────────────
Room/master/entry system view          → overview: mode_selector (space scenes) or status_display
Lights domain (lighting targets > 0)   → lighting: arc_slider brightness, click on/off, long-press cycles roles
Climate domain (climate targets > 0)   → climate: arc_slider setpoint, click cycles mode
Shading domain (covers targets > 0)    → covers: arc_slider position, click open/close, long-press cycles roles
Media domain (bindings > 0)            → media: arc_slider volume of active activity, click play/pause
Sensors domain (readings > 0)          → sensors: status_display
Energy view                            → energy: status_display
Dashboard page / security view         → idle (built-in)
```

## 8. AI instructions

- Read this file, the Decisions section and the child task file before making changes. Work on one issue per branch and PR, using `Closes #<issue>`.
- Follow the repository `CLAUDE.md` (code style, generated code, migrations, `<type>(<scope>): <subject>` titles with scopes `backend`, `admin`, `panel`, `sdk`, `installer`, `ci`, `docs`).
- Keep changes inside the issue's surface; report anything outside it instead of widening scope.
- For each acceptance criterion, implement it or explain in the PR why it is skipped.

## 9. Subtasks

### Phase 1: Backend foundation
| ID | Task | Size | Scope | Status |
|----|------|------|-------|--------|
| FEATURE-COMPANION-BACKEND-PLUGIN | `devices-companion` plugin: device model, display link, channels, runtime ingress | medium | backend | planned |
| FEATURE-COMPANION-ADMIN-UI | Admin plugin: forms, wizard, detail route, screens preview, deploy workflow | medium | admin | planned |

### Phase 2: Firmware generation and provisioning
| ID | Task | Size | Scope | Status |
|----|------|------|-------|--------|
| FEATURE-COMPANION-SCREEN-COMPILER | Screen compiler: parent display space domains → companion screens | medium | backend | planned |
| FEATURE-COMPANION-ESPHOME-GENERATOR | ESPHome YAML generator, optional toolchain, `firmware` managed service | large | backend | planned |
| FEATURE-COMPANION-PROVISIONING | USB provisioning on the backend host, OTA deploy, downloads | medium | backend, admin | planned |

### Phase 3: Runtime communication
| ID | Task | Size | Scope | Status |
|----|------|------|-------|--------|
| FEATURE-COMPANION-ESPHOME-COMPONENT | `packages/companion-firmware`: `panel_protocol` component + CI compile job | large | sdk | planned |
| FEATURE-COMPANION-PANEL-SERIAL | Panel serial transport, connection lifecycle, deck sync, intents, occurrence reports | medium | panel | planned |

### Phase 4: Screen types and polish
| ID | Task | Size | Scope | Status |
|----|------|------|-------|--------|
| FEATURE-COMPANION-SCREEN-TYPES | LVGL screen types (arc, mode selector, status, toggle, idle) | medium | sdk, backend | planned |
| FEATURE-COMPANION-LED-RING | Optional LED ring | small | sdk | planned |

### Issues

- #1237 reground specs
- #1238 plugin entity + CRUD (device model, display link, channels, runtime ingress)
- #1239 screen compiler (space domains)
- #1240 admin management views (device plugin forms + wizard)
- #1241 compiled screens preview
- #1242 ESPHome generator
- #1243 firmware package + panel_protocol component (+ CI compile job)
- #1244 LVGL screen types
- #1245 LED ring
- #1246 firmware build managed service (+ toolchain detection and install)
- #1247 USB provisioning + OTA deploy
- #1248 admin deploy workflow (+ toolchain state)
- #1249 panel USB serial connection
- #1250 panel value/input/page sync
- #1251 architecture doc
- #1252 hardware acceptance
- #1364 serial access for the service users (`dialout` group, installer)
