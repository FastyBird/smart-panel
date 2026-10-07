# Task: Companion ESPHome YAML Generator, Optional Toolchain & Firmware Build Service
ID: FEATURE-COMPANION-ESPHOME-GENERATOR
Type: feature
Scope: backend
Size: large
Parent: EPIC-COMPANION-DISPLAY
Status: planned
Tracking: #1236
Issues: #1242, #1246

## 1. Business goal

In order to generate firmware for companion displays without manual ESPHome configuration,
As a system administrator,
I want the backend to turn compiled screens into a complete ESPHome config and build it into flashable firmware when
the optional ESPHome toolchain is available, and to tell me clearly when it is not.

## 2. Context

- The decisions D3, D4, D8, D9 and D10 in `EPIC-COMPANION-DISPLAY` apply.
- No ESPHome/PlatformIO/Python toolchain is shipped today: not in `scripts/install-server.sh`,
  `build/src/installers/linux.ts`, the Raspberry Pi image (`build/raspbian/`) or the Docker runtime image
  (`docker/prod/Dockerfile`, `node:24-alpine`, no Python).
- Pattern for an optional system component: `apps/backend/src/plugins/remote-access-tailscale`
  (`not-installed` state, `TailscaleSetupService` on `PrivilegedWorkerService`,
  `PlatformService.supportsPrivilegedWorkers()`, installer flag `--with-tailscale`). The go2rtc plan for UniFi
  Protect (#1180, `docs/superpowers/specs/2026-10-06-unifi-protect-integration-design.md` §7) uses the same
  `managed | external | disabled` modes.
- Managed services: `BaseManagedExtensionService`, `ManagedServiceManagerService` (CLI mode `FB_CLI=on` skips
  start), `managed-service-registration.inventory.spec.ts`, plan `docs/superpowers/plans/2026-09-01-managed-extension-services.md`.
- Data directory: `FB_DATA_DIR` (default `var/`), as used by `apps/backend/src/modules/system/services/backup.service.ts`.
- ESPHome specifics to respect: custom code uses `external_components` (the legacy `custom_component` was removed
  from ESPHome); LVGL, GC9A01 (via the ESPHome display platform that supports it, pinned in the spike) and
  `rotary_encoder` are built in.
- The `panel_protocol` component comes from `packages/companion-firmware` (#1243). The backend ships a copy in
  `apps/backend/static/companion-firmware/` (`static/` is already in the backend's published `files`).
- Depends on #1239 (compiled screens).

## 3. Scope

**In scope**
- #1242: `EsphomeGeneratorService` builds the YAML with the backend's existing `yaml` dependency (no template engine).
  It covers board/hardware substitutions per `hardware_profile`, WiFi (from plugin config secrets), `ota` with
  password, logger off the USB CDC port, `external_components` (local path to the bundled component), LVGL pages per
  screen type, `rotary_encoder` + `binary_sensor` button wiring, the optional LED ring block (#1245) and
  `substitutions` carrying `build_hash`/`proto`. Export variant: the same YAML with `external_components` pointing
  at the git tag of the running version, for users with their own ESPHome.
- #1246: `CompanionToolchainService` (detect, install, version pin) and `CompanionFirmwareManagedService`
  (`serviceId: 'firmware'`): a serialized job queue for `toolchain_install`, `build`, `flash_usb` and `ota`, used by
  #1247.
- Toolchain endpoints: `GET /api/v1/plugins/devices-companion/toolchain`,
  `POST /api/v1/plugins/devices-companion/toolchain/install`
- Job model + events: `DevicesCompanionPluginDataJob` (`id`, `kind`, `device_id`, `step`, `progress`, `log_tail`,
  `error`), WebSocket event `DevicesCompanionPlugin.Job.Updated`, `GET …/jobs/:jobId`
- Artifact storage: `${FB_DATA_DIR}/companion/devices/<deviceId>/` (`config.yaml`, `firmware.factory.bin`,
  `firmware.ota.bin`, `build.json` with hash/version/time); build dirs cleaned after success

**Out of scope**
- Flashing/OTA execution details and their endpoints (#1247)
- The C++ component itself (#1243) and LVGL visual polish (#1244)
- Toolchain in the installer, Raspberry Pi image or Docker image (deferred; Docker/HA = `unsupported`)
- Multiple board variants (one reference `hardware_profile` in v1)

## 4. Acceptance criteria

### Generator (#1242)
- [ ] `EsphomeGeneratorService.generate(device, screens)` returns YAML that passes `esphome config` for the reference profile with every screen type
- [ ] Generated YAML contains no plaintext secrets in logs or API responses; the export variant uses `!secret wifi_password` / `!secret ota_password` placeholders
- [ ] `build_hash` in the YAML equals the compiler's `structure_hash`
- [ ] The LED ring block is present only when `led_ring_count > 0`
- [ ] `GET /api/v1/plugins/devices-companion/devices/:id/config.yaml?variant=export` downloads the export YAML
- [ ] Snapshot-style unit tests per screen type and for the full reference config

### Toolchain (#1246)
- [ ] `GET …/toolchain` returns `{ state, mode, esphome_version, pinned_version, platform, privileged_setup, disk_free_bytes, notes }` with states `unsupported | not-installed | installing | ready | error`
- [ ] `PlatformType.DOCKER` and `PlatformType.HOME_ASSISTANT` report `unsupported` (unless `toolchain.mode = external` with a working path)
- [ ] Managed mode installs ESPHome `==<pinned>` into `${FB_DATA_DIR}/companion/toolchain/venv` with `PLATFORMIO_CORE_DIR=${FB_DATA_DIR}/companion/toolchain/platformio`. Only missing OS packages (`python3-venv`) go through `PrivilegedWorkerService`, and only when `getPrivilegedWorkerSupport()` allows it; otherwise the response explains the manual command
- [ ] After install, a warm-up build of the reference config downloads the PlatformIO platform so the first real build is not the slow one
- [ ] The toolchain directory is excluded from backups (`backup.service.ts`)
- [ ] The measured disk use, RAM peak and first/incremental build times on a Raspberry Pi 4 are recorded in the PR and in the epic (replacing the estimates)

### Firmware managed service (#1246)
- [ ] `CompanionFirmwareManagedService` extends `BaseManagedExtensionService` (`owner: {kind: 'plugin', type: 'devices-companion-plugin'}`, `serviceId: 'firmware'`, `owner-enabled`), is registered in the plugin's `onModuleInit` and added to `managed-service-registration.inventory.spec.ts`
- [ ] It runs one job at a time; new jobs are queued; a second job for the same device is rejected with 409
- [ ] `stop()` cancels the running child process (process group kill) and fails queued jobs; in CLI mode the service never starts and job submission returns 503
- [ ] `esphome compile` runs with `nice`, a `-j 1` default on hosts with < 4 GB RAM, and a hard timeout (default 60 min for the first build); stdout/stderr are parsed into steps and a capped `log_tail`
- [ ] On success the artifacts and `build.json` are written atomically; on failure the previous artifacts stay intact
- [ ] Unit tests cover queueing, cancellation, timeout, CLI-mode refusal and status mapping (child process mocked)

## 5. Example scenarios

### Scenario: Toolchain not installed

Given the backend runs on Raspberry Pi OS without the companion toolchain
When the admin requests `GET …/toolchain`
Then the state is `not-installed`, `privileged_setup` reports whether one-click install is possible, and `notes` lists the disk/RAM needs

### Scenario: Build a 3-screen companion

Given the toolchain is `ready` and the compiled screens are overview, lighting, climate
When a `build` job runs
Then the YAML has 3 LVGL pages plus `idle`, encoder and button wiring, `panel_protocol` and `build_hash`
And the job finishes with `firmware.factory.bin` and `firmware.ota.bin` stored for the device

## 6. Technical constraints

- No new npm dependencies; ESPHome/esptool are external executables in the venv
- All child processes are spawned only by the `firmware` managed service (never in controllers), with explicit argv (no shell), a sanitized env and timeouts
- Never log WiFi/OTA secrets; pass them through the ESPHome `secrets.yaml` written with mode 0600 inside the build dir
- Disk guard: refuse install/build when free space under `FB_DATA_DIR` is below a configurable threshold (default 4 GB for install, 1 GB for build)
- Do not modify generated code; run `pnpm run generate:openapi`

## 7. Implementation hints

```typescript
// Pipeline shared with #1247 (inside the firmware managed service)
async runBuild(job: CompanionJob): Promise<BuildResult> {
	const screens = await this.screenCompiler.compile(job.deviceId);
	const yaml = this.esphomeGenerator.generate(device, screens);
	await this.artifacts.writeConfig(job.deviceId, yaml);
	return this.toolchain.compile(job, this.artifacts.configPath(job.deviceId)); // esphome compile
}
```

- Look at `TailscaleSetupService` and `PrivilegedWorkerService` for the privileged install step and status mapping
- Keep the reference hardware profile as data (`hardware-profiles.ts`: pins, display model, encoder pins, LED pin), not hard-coded YAML strings

## 8. AI instructions

- Read this file and the epic's Decisions section; check the pinned ESPHome docs for LVGL, the display platform and `external_components` before writing YAML; start with a short plan (max 10 steps).
- Follow `CLAUDE.md`; one PR per issue (#1242 generator, #1246 toolchain + firmware managed service), scope `backend`.
- For each acceptance criterion, implement it or explain why it is skipped.
