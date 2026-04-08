# Task: System Service Restart (Soft Restart)
ID: FEATURE-SYSTEM-SERVICE-RESTART
Type: feature
Scope: backend, admin
Size: medium
Parent: (none)
Status: done

## 1. Business goal

In order to quickly apply configuration changes or recover from service issues without a full system reboot
As a smart panel administrator
I want to restart just the backend service (NestJS) separately from a full platform reboot

## 2. Context

- The system module currently supports three actions: **Reboot** (full platform restart), **Power Off**, and **Factory Reset**.
- A full reboot takes 30-60 seconds on an RPi and disrupts the panel display, WiFi, and all services.
- A service-only restart (NestJS process via systemd/PM2) takes ~5 seconds and keeps the OS, network, and panel display running.
- Use cases for soft restart: applying plugin config changes, recovering from backend errors, post-update service reload.

**Reference implementation:**
- `apps/backend/src/modules/system/services/system-command.service.ts` — existing `reboot()`, `powerOff()`, `factoryReset()` methods
- `apps/backend/src/modules/system/system.constants.ts` — event types
- `apps/backend/src/modules/system/system.module.ts` — event handler registration
- `apps/admin/src/modules/system/composables/useSystemActions.ts` — `onRestart()` with confirmation dialog
- `apps/admin/src/modules/system/components/system-info/manage-system.vue` — action buttons UI
- `apps/admin/src/modules/system/views/view-rebooting.vue` — health polling after reboot

**Platform service:**
- `apps/backend/src/modules/platform/` — platform-specific service that handles OS-level commands
- The soft restart should NOT go through the platform service — it should use `process.exit()` or a systemd/PM2 signal to restart just the Node.js process

## 3. Scope

**In scope**

- New `SYSTEM_SERVICE_RESTART_SET` event type and `SYSTEM_SERVICE_RESTART` status event
- New `restartService()` method in `SystemCommandService` that triggers a graceful process restart
- Admin UI: split the current "Restart" button into two options (dropdown or separate buttons):
  - "Restart Service" — soft restart (service only)
  - "Restart System" — full platform reboot (existing behavior)
- Admin UI: waiting/health-polling view for soft restart (shorter timeout than full reboot)
- Appropriate confirmation dialogs for each restart type

**Out of scope**

- Panel app changes (panel doesn't have system management UI)
- Auto-restart on crash detection (separate concern)
- Display-specific restart commands
- Restart scheduling

## 4. Acceptance criteria

- [x] Backend: new event type `SYSTEM_SERVICE_RESTART_SET` triggers service restart
- [x] Backend: `restartService()` performs graceful shutdown (close DB, stop plugins) then exits process
- [x] Backend: process manager (systemd/PM2) automatically restarts the process after exit
- [x] Admin: "Restart" section offers two distinct options (service vs system)
- [x] Admin: service restart shows health polling with shorter timeout (~30s vs 2min)
- [x] Admin: system reboot behavior unchanged (existing flow preserved)
- [x] Admin: confirmation dialogs clearly explain the difference between the two options
- [x] WebSocket events propagated for both restart types
- [ ] Works correctly on Raspbian image (systemd service) and development (PM2/manual) *(needs verification on device)*

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Soft restart after config change

Given the admin has changed a plugin configuration
When they click "Restart Service"
Then a confirmation dialog explains only the backend service will restart
When confirmed, the backend gracefully shuts down and the process exits
Then systemd restarts the service automatically
And the admin UI polls health and redirects to home within ~10 seconds

### Scenario: Full system reboot

Given the admin needs to reboot the entire device
When they click "Restart System"
Then the existing reboot confirmation and flow executes unchanged
And the admin UI polls health with the existing 2-minute timeout

## 6. Technical constraints

- The soft restart must use `process.exit(0)` (or similar) — the process manager handles the actual restart.
- Graceful shutdown: close TypeORM connections, stop plugin services, flush logs before exiting.
- NestJS `app.close()` should handle most cleanup, followed by `process.exit(0)`.
- The exit code must be 0 (clean exit) so systemd/PM2 restarts it (vs non-zero which may trigger failure limits).
- Do not modify generated code.
- Follow existing event/command patterns from system module.

## 7. Implementation hints (optional)

- Backend `restartService()` flow: emit processing event → `app.close()` → `process.exit(0)`
- The `app` (NestJS INestApplication) can be accessed via `@Inject(HTTP_ADAPTER_HOST)` or stored at bootstrap
- Admin UI: consider an `el-dropdown` on the restart button with two items, or two separate buttons in the manage-system component
- The health polling view (`view-rebooting.vue`) can be reused with a shorter timeout parameter
- Add a new route like `RouteNames.SERVICE_RESTARTING` or reuse `REBOOTING` with a query param

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
