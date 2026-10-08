# Task: Companion Display Backend Plugin (`devices-companion`)
ID: FEATURE-COMPANION-BACKEND-PLUGIN
Type: feature
Scope: backend
Size: medium
Parent: EPIC-COMPANION-DISPLAY
Status: planned
Tracking: #1236
Issues: #1238

## 1. Business goal

In order to manage companion displays (ESP32 knobs) as part of the Smart Panel ecosystem,
As a system administrator,
I want a `devices-companion` device plugin that models a companion as a device linked to its parent display, exposes
its knob as hardware-input channels, and tracks whether the panel currently sees it.

## 2. Context

- The decisions D1, D2, D3, D7 and D11 in `EPIC-COMPANION-DISPLAY` apply.
- `DisplayEntity` (`apps/backend/src/modules/displays/entities/displays.entity.ts`) has no parent/child relation and
  no extension point, so the link lives on the companion device (`display_id`).
- Reference plugins:
  - `apps/backend/src/plugins/devices-reterminal`: host-attached panel hardware as a device, button channels,
    `ReTerminalService` registered as a managed service, `registerPluginMetadata`
  - `apps/backend/src/plugins/devices-wled`: plugin columns on the devices table (migrations
    `1000000000018-AddWledHardwareIdentity.ts`, `1000000000019-…`)
  - `apps/backend/src/plugins/devices-third-party/controllers/third-party-inputs.controller.ts`: validating and
    publishing input occurrences
  - `apps/backend/src/plugins/spaces-home-control/listeners/websocket-exchange.listener.ts`: WebSocket commands from
    the panel through `CommandEventRegistryService`
- Hardware-input model: `docs/hardware-inputs.md`, `ChannelInputOccurrencesService`, the `input_controller` device
  and `button`/`analog_input` channels in `spec/devices/`.
- The panel owns the runtime serial link (D5) and reports to the backend over the WebSocket. The backend never opens
  the serial port at runtime.

## 3. Scope

**In scope**
- Plugin skeleton: constants, `devices-companion.plugin.ts`, OpenAPI extra models, `RouterModule` entry
  (`DEVICES_COMPANION_PLUGIN_PREFIX`) and import in `apps/backend/src/app.module.ts`, `registerPluginMetadata`
- `CompanionDeviceEntity` / `CompanionChannelEntity` / `CompanionChannelPropertyEntity` (`@ChildEntity`), create/update
  DTOs, type mappers and discriminators
- Plugin columns on `devices_module_devices`: `display_id` (FK `displays_module_displays.id`, `ON DELETE SET NULL`,
  unique among companion rows), `hardware_profile`, `led_ring_count`, `deployed_build_hash`, `ota_address`
- Incremental migration `apps/backend/src/migrations/10000000000NN-AddCompanionDevices.ts` (next free number)
- Plugin config model/DTO: `wifi.ssid`, `wifi.password` (secret), `ota_password` (secret, generated on first use),
  `toolchain.*` placeholders consumed by #1246
- Channel provisioning on create: `device_information`, `button` (`knob_button`), `analog_input` (`knob_rotation`)
- Device platform that rejects property writes (all properties are read-only or event-only)
- WebSocket ingress from the panel:
  - `DevicesCompanionPlugin.ReportStatus` (connected flag, `proto`, `fw`, `build`, `mac`, `ip`)
  - `DevicesCompanionPlugin.ReportInput` (button event or coalesced rotation delta, optional `occurrence_id`)
- `runtime` managed service: heartbeat watchdog → `DeviceConnectivityService`
- Swagger decorators; secret inventory spec entries

**Out of scope**
- Screen compilation (`FEATURE-COMPANION-SCREEN-COMPILER`, #1239)
- Toolchain, builds, flashing, OTA (`FEATURE-COMPANION-ESPHOME-GENERATOR`, `FEATURE-COMPANION-PROVISIONING`)
- Admin UI (`FEATURE-COMPANION-ADMIN-UI`)
- Any backend serial transport (removed, D11)

## 4. Acceptance criteria

- [ ] `apps/backend/src/plugins/devices-companion/` exists with `DEVICES_COMPANION_PLUGIN_NAME = 'devices-companion-plugin'`, `DEVICES_COMPANION_PLUGIN_PREFIX = 'devices-companion'`, `DEVICES_COMPANION_TYPE = 'devices-companion'`, and is registered in `app.module.ts` (imports + `RouterModule` under `PLUGINS_PREFIX`)
- [ ] Plugin metadata is registered through `ExtensionsService.registerPluginMetadata()` and the plugin is listed in the admin extensions view
- [ ] `POST /api/v1/modules/devices/devices` with `type: 'devices-companion'`, `category: 'input_controller'` and `display_id` creates a companion. A second companion for the same display, or an unknown display id, is rejected with 422
- [ ] Creating a companion creates the `device_information`, `knob_button` (`event` EVENT_ONLY enum `press,double_press,long_press,down,up`; `detected` bool) and `knob_rotation` (`value` float, read-only) channels
- [ ] When the parent display is deleted, `display_id` becomes null and the device remains
- [ ] Response schemas are named `DevicesCompanionPluginDataDevice`, `DevicesCompanionPluginDataChannel`, `DevicesCompanionPluginDataChannelProperty`, `DevicesCompanionPluginDataConfig`, …
- [ ] `wifi.password` and `ota_password` are write-only secrets (`secretFields`, `*_configured` flags), covered by `apps/backend/src/plugins/plugin-secret-removal.spec.ts`
- [ ] `ReportStatus` from the display token whose id equals the companion's `display_id` sets the connection state to `connected` and updates `ota_address`, firmware version and the MAC `identifier`. Reports from any other client are rejected
- [ ] `ReportInput` publishes through `ChannelInputOccurrencesService.publishOccurrence` (button) or updates `knob_rotation.value` by the delta (rotation); duplicate `occurrence_id`s are dropped by the existing deduplication
- [ ] The `runtime` managed service (`owner: {kind: 'plugin', type: 'devices-companion-plugin'}`, `serviceId: 'runtime'`, `owner-enabled`) marks companions `lost` after 3 missed heartbeat intervals and `disconnected` when the panel reports the link down. It is added to `managed-service-registration.inventory.spec.ts` and does not start in CLI mode
- [ ] Companion devices are not classified into any space domain (verify the lighting/climate/covers/media/sensor target queries ignore `input_controller` devices)
- [ ] `pnpm run generate:openapi` succeeds; unit tests cover DTO validation, channel provisioning, ingress authorization, occurrence publishing and the watchdog

## 5. Example scenarios

### Scenario: Create a companion

Given a display "Living Room Panel" exists
When the admin sends `POST /api/v1/modules/devices/devices` with
  `{ "type": "devices-companion", "category": "input_controller", "name": "Living Room Knob", "display_id": "<id>" }`
Then a companion device with three channels is created
And its connection state is `unknown` until the panel reports it

### Scenario: Knob press reaches other consumers

Given the panel is connected to the companion
When the user long-presses the knob
Then the panel sends `DevicesCompanionPlugin.ReportInput` `{ device_id, channel: "knob_button", event: "long_press" }`
And `DevicesModule.ChannelInput.Occurrence` is emitted for the companion's `knob_button` channel

### Scenario: Panel goes away

Given the companion is `connected`
When no `ReportStatus` arrives for 3 heartbeat intervals
Then the `runtime` service sets the device connection state to `lost`

## 6. Technical constraints

- Follow `devices-reterminal` for module wiring and CLAUDE.md for controller and schema conventions
- Schema changes only through a new incremental migration; never edit `1000000000000-InitialSetup.ts`
- Ingress handlers must validate the caller (`ClientUserDto`, display token owner) against `display_id`
- Rotation updates are coalesced by the panel. The backend must still tolerate bursts (no per-detent DB writes beyond the coalesced value)
- No new npm dependencies
- Do not modify generated code

## 7. Implementation hints

- Channel and property definitions: copy the binding style of `DEVICES_RETERMINAL` constants (`createButtonBindings`)
- Uniqueness of `display_id`: use a partial unique index (`WHERE type = 'devices-companion'`) plus a class-validator constraint like `displays/validators/display-exists-constraint.validator.ts`
- Event names follow `SpacesWsEventType` (`'DevicesCompanionPlugin.ReportStatus'`) with handler names `'…Handler'`
- Watchdog: extend `BaseManagedExtensionService`; keep last-seen timestamps in memory, persist only state transitions

## 8. AI instructions

- Read this file and the epic's Decisions section before making changes; start with a short plan (max 10 steps).
- Follow `CLAUDE.md`; PR title e.g. `feat(backend): add devices-companion plugin with display-linked companion device`.
- For each acceptance criterion, implement it or explain why it is skipped.
