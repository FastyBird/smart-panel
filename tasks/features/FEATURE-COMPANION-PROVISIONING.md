# Task: Companion Display Provisioning & OTA Update Pipeline
ID: FEATURE-COMPANION-PROVISIONING
Type: feature
Scope: backend, admin
Size: medium
Parent: EPIC-COMPANION-DISPLAY
Status: planned
Tracking: #1236
Issues: #1247, #1248

## 1. Business goal

In order to set up new companion displays and keep them in sync with the parent display's screens,
As a system administrator,
I want a first USB flash from the server and later firmware updates pushed over the air, both running as tracked
jobs.

## 2. Context

- The decisions D3, D4 and D5 in `EPIC-COMPANION-DISPLAY` apply. Read the epic's deployment-mode table.
- The first flash must run on the host the USB cable is attached to. Serial-port listing and esptool run **on the
  backend host only**; the panel device never flashes. The panel owns the runtime port.
- The backend picks USB or OTA by reachability: the companion's USB serial number (the ESP32-S3 USB-Serial/JTAG
  reports its MAC) is found under the backend host's `/dev/serial/by-id/*` → USB; otherwise OTA to `ota_address`.
- In `all-in-one` and in `combined` with a local panel, the panel app on the same host holds the port. The backend
  asks it to release the port before flashing (`DevicesCompanionPlugin.ReleasePort` / `PortReleased` over the
  display WebSocket) and tells it to resume afterwards.
- esptool is part of the ESPHome venv from #1246; there is no separate install.
- Jobs run in the `firmware` managed service (#1246). This task adds the `flash_usb` and `ota` steps, the deploy
  orchestration and the endpoints. Admin work for this task is tracked in `FEATURE-COMPANION-ADMIN-UI` (#1248).

## 3. Scope

**In scope (#1247, backend)**
- `SerialPortsService`: list `/dev/serial/by-id/*` on the backend host (no npm `serialport` dependency), annotate Espressif/USB-UART adapters, expose the USB serial number
- `POST /api/v1/plugins/devices-companion/devices/:id/provision` `{ port }`: `read_mac` → set device `identifier` → `build` → `flash_usb` (factory image, `write_flash 0x0`)
- `POST /api/v1/plugins/devices-companion/devices/:id/deploy`: `build` → `ota` (ESPHome OTA to `ota_address` with `ota_password`), or `flash_usb` when the port is local
- `GET /api/v1/plugins/devices-companion/serial-ports`, `GET …/jobs/:jobId`, `GET …/devices/:id/firmware?variant=factory|ota`
- Port release handshake with the local panel (timeout → job error "panel did not release the port")
- After success: `deployed_build_hash` updated; the companion reports the new build in its next `pong`

**In scope (#1248, admin)**: see `FEATURE-COMPANION-ADMIN-UI` §3.

**Out of scope**
- Flashing from the panel device; admin Web Serial (deferred)
- Automatic deploy on structure change (manual in v1; the admin shows "Update available")
- Rollback, batch updates
- Docker USB passthrough documentation beyond a note (Docker is `unsupported` for builds in v1)

## 4. Acceptance criteria

- [ ] `GET …/serial-ports` lists ports on the backend host with `path`, `by_id`, `vendor`, `serial_number`, `in_use_by_panel`; it returns `[]` (not an error) on hosts without `/dev/serial/by-id`
- [ ] `provision` refuses with 409 when the toolchain is not `ready`, the port is unknown, or another job runs for the device
- [ ] `provision` stores the board MAC as the device `identifier` and rejects a MAC already used by another companion
- [ ] `deploy` uses USB when the device's serial number is present on the backend host, otherwise OTA. When neither is possible (no local port, no `ota_address`, no WiFi config), it fails fast with an actionable error
- [ ] Each job emits `DevicesCompanionPlugin.Job.Updated` with steps `queued → compiling_screens → generating → building → releasing_port? → flashing|uploading → verifying → done|error`
- [ ] Errors map to clear messages: port busy, permission denied (missing `dialout`), chip not in download mode, OTA auth failed, OTA timeout, host unreachable
- [ ] Verification: the job waits (bounded) for a `ReportStatus` with the new `build` hash; a timeout leaves the job `done` with a warning, not `error`
- [ ] `firmware` downloads require an admin role and stream the stored artifact
- [ ] Unit tests cover orchestration branches (USB vs OTA, release handshake, timeouts) with child processes mocked; the e2e test covers endpoint auth and 409 paths

## 5. Example scenarios

### Scenario: First flash in combined mode with a remote panel

Given the toolchain is `ready` on the server
And a blank ESP32-S3 is plugged into the server
When the admin picks `/dev/serial/by-id/usb-Espressif_…-if00` and clicks Provision
Then the backend reads the MAC, builds the firmware and flashes it over USB
And the admin is told to move the board to the panel device
And once the panel reports it, the device becomes `connected`

### Scenario: OTA after a space change

Given a provisioned companion attached to a remote panel and on WiFi
And a covers target was added to the space
When the admin clicks Deploy
Then the backend rebuilds and uploads over WiFi OTA to the reported `ota_address`
And the companion reboots; the panel reconnects and reports the new build hash

### Scenario: All-in-one without WiFi

Given the companion is plugged into the all-in-one device and WiFi is not configured in the plugin
When the admin clicks Deploy
Then the backend asks the local panel to release the port, flashes over USB and lets the panel resume

## 6. Technical constraints

- Child processes only inside the `firmware` managed service, with explicit argv, timeouts and cancellation
- The backend service user needs `dialout` for `/dev/ttyACM*`; detect `EACCES` and report it (the installer change is a separate issue)
- Never send the OTA password or WiFi credentials to the admin or the panel
- Do not modify generated code; tests for the orchestration logic are required

## 7. Implementation hints

```bash
esptool.py --port <by-id path> read_mac
esptool.py --port <by-id path> --baud 460800 write_flash 0x0 firmware.factory.bin
esphome upload --device <ota_address> config.yaml   # or espota-style upload of firmware.ota.bin
```

- Prefer `esphome upload` with the stored config so the OTA protocol version matches the pinned ESPHome
- Port release: register the command in the plugin's WebSocket exchange listener; the panel side is in #1249

## 8. AI instructions

- Read this file, the epic's deployment-mode table and Decisions; start with a short plan (max 10 steps).
- Follow `CLAUDE.md`; PR titles e.g. `feat(backend): add companion USB provisioning and OTA deploy jobs` (#1247) and `feat(admin): add companion toolchain and deploy workflow` (#1248).
- For each acceptance criterion, implement it or explain why it is skipped.
