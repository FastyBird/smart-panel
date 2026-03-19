# Task: Companion Display Provisioning & OTA Update Pipeline
ID: FEATURE-COMPANION-PROVISIONING
Type: feature
Scope: backend, admin
Size: medium
Parent: EPIC-COMPANION-DISPLAY
Status: planned

## 1. Business goal

In order to set up new companion displays and keep them updated with the latest screen configuration,
As a system administrator,
I want a provisioning flow that handles initial USB flashing and subsequent OTA firmware updates.

## 2. Context

- First-time setup requires USB flash (esptool) to bootstrap WiFi + OTA on the companion ESP32
- After initial provisioning, firmware updates are pushed via OTA over WiFi (separate server mode) or USB (all-in-one mode)
- Depends on `FEATURE-COMPANION-ESPHOME-GENERATOR` for compiled firmware binaries
- Depends on `FEATURE-COMPANION-BACKEND-PLUGIN` for companion entity management
- The admin UI deploy workflow (from `FEATURE-COMPANION-ADMIN-UI`) calls these services
- Related: `EPIC-COMPANION-DISPLAY` (parent epic)

### Deployment Mode Differences

**Separate server mode:**
1. Initial flash: user connects companion to server via USB, admin triggers provisioning
2. User moves companion to panel device enclosure, connects via USB for runtime
3. OTA updates: server pushes firmware to companion over WiFi (companion on same network)

**All-in-one mode:**
1. Initial flash: companion connected to the same device via USB, admin triggers provisioning
2. Companion stays connected via USB for both runtime and updates
3. OTA updates: can use USB flash (simpler, no WiFi needed on companion) or WiFi OTA

## 3. Scope

**In scope**
- Initial provisioning service (flash base firmware via USB using esptool)
- OTA update service (push firmware over WiFi using ESPHome OTA protocol)
- USB flash update service (alternative to OTA for all-in-one mode)
- Companion device detection (list available USB serial devices)
- Provisioning status tracking and progress reporting
- Admin API endpoints for triggering provisioning and updates
- Deploy orchestrator that chains: compile screens → generate YAML → build firmware → flash/OTA

**Out of scope**
- Auto-detection of when companion needs update (manual trigger only for v1)
- Rollback to previous firmware version
- Multi-device batch updates

## 4. Acceptance criteria

- [ ] `GET /api/v1/companion-displays/serial-ports` lists available USB serial devices
- [ ] `POST /api/v1/companion-displays/:id/provision` flashes base firmware via USB (esptool)
- [ ] `POST /api/v1/companion-displays/:id/deploy` runs the full deploy pipeline (compile → build → flash/OTA)
- [ ] Deploy uses OTA over WiFi when companion and server are separate devices
- [ ] Deploy uses USB flash when running in all-in-one mode
- [ ] Progress events are emitted during provisioning/deploy (via WebSocket or SSE)
- [ ] Error handling covers: USB device not found, build failure, OTA timeout, network unreachable
- [ ] Companion status updates to "provisioned" after successful initial flash
- [ ] Companion firmware version updates after successful deploy

## 5. Example scenarios

### Scenario: Initial provisioning of a new companion

Given a blank ESP32-S3 board is connected to the server via USB at /dev/ttyACM0
When the admin selects the serial port and clicks "Provision"
Then the system flashes the base ESPHome firmware with WiFi + OTA
And the companion reboots and connects to WiFi
And the companion status changes to "provisioned"

### Scenario: OTA update after adding a new page (separate server mode)

Given a provisioned companion is on the same WiFi network as the server
And the admin has added a new "Scenes" page to the parent display
When the admin clicks "Deploy"
Then the system compiles new screens, generates YAML, builds firmware
And pushes the firmware to the companion via OTA over WiFi
And the companion reboots with the updated screens

## 6. Technical constraints

- `esptool.py` must be available on the server for USB flashing
- ESPHome OTA protocol requires the companion to be reachable on the local network
- Build + flash process should be async with progress streaming
- USB device permissions may need configuration on the server (udev rules)
- Do not modify generated code
- Tests are expected for the deploy orchestrator logic

## 7. Implementation hints

### USB Flash Command
```bash
esptool.py --port /dev/ttyACM0 --baud 460800 write_flash 0x0 firmware.bin
```

### OTA Push Command
```bash
esphome upload --device <companion-ip> config.yaml
```

### Deploy Orchestrator
```typescript
async deploy(companionId: string): Promise<DeployResult> {
  // 1. Compile screens
  emit('progress', { step: 'compiling_screens', percent: 10 });
  const screens = await this.screenCompiler.compile(companionId);

  // 2. Generate YAML
  emit('progress', { step: 'generating_yaml', percent: 20 });
  const yaml = await this.esphomeGenerator.generate(companionId, screens);

  // 3. Build firmware
  emit('progress', { step: 'building_firmware', percent: 30 });
  const binary = await this.firmwareBuilder.build(companionId, yaml);

  // 4. Flash or OTA
  emit('progress', { step: 'uploading', percent: 70 });
  if (this.isAllInOneMode(companionId)) {
    await this.usbFlasher.flash(companion.serialPort, binary);
  } else {
    await this.otaUpdater.push(companion.networkAddress, binary);
  }

  emit('progress', { step: 'done', percent: 100 });
}
```

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to backend and admin.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
