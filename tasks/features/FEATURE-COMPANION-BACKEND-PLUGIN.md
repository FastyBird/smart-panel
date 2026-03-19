# Task: Companion Display Backend Plugin
ID: FEATURE-COMPANION-BACKEND-PLUGIN
Type: feature
Scope: backend
Size: medium
Parent: EPIC-COMPANION-DISPLAY
Status: planned

## 1. Business goal

In order to manage companion displays (ESP32 knob devices) as part of the Smart Panel ecosystem,
As a system administrator,
I want a backend plugin that provides a data model and CRUD API for companion displays, linked as children of parent displays.

## 2. Context

- Companion displays are small ESP32-S3 boards with round LCD + rotary encoder, physically attached to a panel device via USB
- Each companion is a child of exactly one parent display
- The plugin follows the existing plugin pattern in `apps/backend/src/plugins/`
- The displays module (`apps/backend/src/modules/displays/`) provides the parent display entity
- Transport type (USB serial) is configurable with an abstraction layer for future UART/SPI support
- Related: `EPIC-COMPANION-DISPLAY` (parent epic)

## 3. Scope

**In scope**
- Companion display database entity with parent display relation
- CRUD endpoints (create, read, update, delete)
- Transport configuration (type, serial port path, baud rate)
- Companion status tracking (connected, disconnected, provisioned, needs_update)
- Swagger/OpenAPI decorators for API documentation
- Response models following API conventions

**Out of scope**
- Screen compilation logic (separate task: `FEATURE-COMPANION-SCREEN-COMPILER`)
- ESPHome generation (separate task: `FEATURE-COMPANION-ESPHOME-GENERATOR`)
- Firmware flashing/OTA (separate task: `FEATURE-COMPANION-PROVISIONING`)
- Admin UI (separate task: `FEATURE-COMPANION-ADMIN-UI`)

## 4. Acceptance criteria

- [ ] `CompanionDisplayEntity` exists with fields: id, name, parent display relation, transport type, serial port, baud rate, status, firmware version, last seen timestamp
- [ ] `POST /api/v1/companion-displays` creates a companion linked to a parent display
- [ ] `GET /api/v1/companion-displays` lists all companions (filterable by parent display)
- [ ] `GET /api/v1/companion-displays/:id` returns a single companion with parent display info
- [ ] `PATCH /api/v1/companion-displays/:id` updates companion configuration
- [ ] `DELETE /api/v1/companion-displays/:id` removes a companion
- [ ] Transport interface is defined with `connect()`, `disconnect()`, `send()`, `onMessage()` methods
- [ ] USB serial transport implements the transport interface
- [ ] Swagger decorators generate valid OpenAPI spec
- [ ] Unit tests cover CRUD operations and transport abstraction

## 5. Example scenarios

### Scenario: Create a companion display

Given a parent display "Living Room Panel" exists
When the admin sends POST /api/v1/companion-displays with:
  - name: "Living Room Knob"
  - parentDisplayId: "<living-room-panel-id>"
  - transport: { type: "usb_serial", port: "/dev/ttyACM0", baudRate: 115200 }
Then a companion display entity is created
And the response includes the companion with status "disconnected"

### Scenario: List companions for a parent display

Given 2 companion displays exist across different parent displays
When the admin sends GET /api/v1/companion-displays?parentDisplayId=<id>
Then only the companion for that parent display is returned

## 6. Technical constraints

- Follow the existing plugin pattern in `apps/backend/src/plugins/`
- Controllers return `*ResponseModel` classes
- DTOs are input only
- Use Swagger decorators for OpenAPI generation
- Transport interface should be injectable (allow swapping implementations)
- Do not modify generated code
- Tests are expected for service layer

## 7. Implementation hints

- Look at existing plugins in `apps/backend/src/plugins/` for the module structure
- The displays module provides the parent entity to relate to
- Use TypeORM relations for parent-child display mapping
- Transport abstraction can use NestJS custom providers with injection tokens

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Follow the existing plugin patterns in the codebase.
- Keep changes scoped to backend only.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
