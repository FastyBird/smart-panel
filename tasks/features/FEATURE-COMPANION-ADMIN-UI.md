# Task: Companion Display Admin UI
ID: FEATURE-COMPANION-ADMIN-UI
Type: feature
Scope: admin
Size: medium
Parent: EPIC-COMPANION-DISPLAY
Status: planned
Tracking: #1236
Issues: #1240, #1241, #1248

## 1. Business goal

In order to add, configure, provision and update companion displays from the admin interface,
As a system administrator,
I want the companion to behave like any other device plugin in the admin (wizard, add/edit forms, device list), with a
companion page that previews the compiled screens, shows the toolchain state and runs provisioning and deploy jobs.

## 2. Context

- The decisions D1, D2, D4 and D5 in `EPIC-COMPANION-DISPLAY` apply. The companion is a `devices-companion` device,
  so it appears in the existing Devices views. There is no separate "Companion displays" navigation section.
- Admin plugin mirror: `apps/admin/src/plugins/devices-companion/`.
- References:
  - `apps/admin/src/plugins/devices-wled/devices-wled.plugin.ts`: `deviceAddForm`, `deviceEditForm`,
    `deviceWizardAdapter`, the schemas block, the config form element
  - `apps/admin/src/plugins/devices-virtual/` (`router/`, `views/`): plugin-owned child routes under the Devices
    route and the `routes.wizard` launcher (`IDevicePluginRoutes`)
  - `apps/admin/src/modules/devices/devices.types.ts`: `IDevicePluginsComponents`, `IDevicePluginsSchemas`
  - `apps/admin/src/plugins/remote-access-tailscale/`: the "not installed / install" state machine UI
  - `apps/admin/src/plugins/config-secrets.spec.ts`: write-only secret fields
- Backend APIs come from #1238 (device CRUD), #1239 (`GET …/devices/:id/screens`), #1246 (toolchain) and #1247 (jobs).

## 3. Scope

**In scope**
- #1240: plugin registration (`devices-companion.plugin.ts`, locales, Zod schemas bound to generated
  `DevicesCompanionPlugin*` types), add/edit forms (parent display select, name, room, hardware profile, LED ring
  count), wizard adapter, plugin config form (WiFi SSID/password, OTA password, toolchain mode)
- #1241: companion page (`/devices/companion/:id`, child route of the Devices route) with a compiled screens table
  (key, type, label, target, click action, long-press targets), the structure hash and "up to date / update
  available"
- #1248: toolchain card (state, disk/RAM note, Install button, errors), serial-port picker, Provision and Deploy
  buttons, job progress (WebSocket job events with a polling fallback on the job endpoint), firmware and YAML
  download links

**Out of scope**
- Screen customization (v1 is auto-generated only)
- A companion screen renderer or simulator
- Browser Web Serial flashing (deferred, D5)

## 4. Acceptance criteria

- [ ] The "Companion display" device type appears in the device wizard and the Add device dialog through `deviceWizardAdapter`/`deviceAddForm`
- [ ] The add form requires a parent display (only displays without a companion are offered) and sends `type: 'devices-companion'`, `category: 'input_controller'`, `display_id`
- [ ] The edit form updates name, room, parent display, hardware profile and LED ring count
- [ ] The device list and detail show connection state from the devices module. The companion page shows parent display, firmware version, MAC, OTA address and the deployed hash
- [ ] A companion without a parent display shows a "No parent display" warning with a link to the edit form
- [ ] The compiled screens preview renders the `GET /api/v1/plugins/devices-companion/devices/:id/screens` response and highlights a structure-hash mismatch
- [ ] The toolchain card shows `unsupported` / `not-installed` / `installing` / `ready` / `error`. Provision and Deploy are disabled with an explanation unless the state is `ready`
- [ ] Install starts `POST …/toolchain/install` and shows progress; failures show the captured log tail
- [ ] Provision lists `GET …/serial-ports` (backend host) and explains that the board must be plugged into the server, not the panel. An empty list shows the download fallback
- [ ] Deploy shows job steps (queued → compiling screens → generating → building → flashing/uploading → done/error) with the log tail on error
- [ ] The config form treats `wifi.password` and `ota_password` as write-only secrets; covered by `config-secrets.spec.ts`
- [ ] Vitest covers the form composables, the wizard adapter and the job progress store

## 5. Example scenarios

### Scenario: Add a companion through the wizard

Given the admin opens Devices → Add device
When they choose "Companion display", pick "Living Room Panel" and name it "Living Room Knob"
Then the device is created and the companion page opens with the compiled screens preview

### Scenario: Toolchain missing

Given the toolchain state is `not-installed` on a Raspberry Pi
When the admin opens the companion page
Then the toolchain card explains the disk (~2-3 GB) and RAM needs and offers "Install toolchain"
And Provision/Deploy are disabled until the state is `ready`

### Scenario: Deploy firmware

Given a provisioned companion with "Update available"
When the admin clicks Deploy
Then the progress shows the job steps, ends with "Done", and the hash shows "up to date"

## 6. Technical constraints

- Follow existing admin plugin patterns (`apps/admin/src/plugins/devices-*`); print width 150 (admin prettier config)
- Use generated OpenAPI types from `apps/admin/src/openapi.ts` through `openapi.constants.ts`; do not edit generated code
- Element Plus quirks: `el-input-number` has no suffix slot, `el-form-item` has no append slot, and a bare `@` in vue-i18n strings breaks compilation
- Keep the companion page lazy-loaded; no new dependencies

## 7. Implementation hints

- Route registration: copy `devices-virtual` (`options.router.addRoute(DevicesRouteNames.DEVICES, route)` guarded on the devices route)
- Job progress: subscribe to `DevicesCompanionPlugin.Job.Updated` events through the existing websocket store, and fall back to polling `GET …/jobs/:jobId` every 2 s while the page is visible
- The screens preview is a table; there is no visual renderer in v1

## 8. AI instructions

- Read this file and the epic's Decisions section; start with a short plan (max 10 steps).
- Follow `CLAUDE.md`; one PR per issue (#1240 forms + wizard, #1241 screens preview, #1248 toolchain + deploy workflow), scope `admin`.
- For each acceptance criterion, implement it or explain why it is skipped.
