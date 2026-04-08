# Task: Image-based update mechanism for Raspbian installs
ID: FEATURE-IMAGE-UPDATE
Type: feature
Scope: backend
Size: large
Parent: (none)
Status: done

## 1. Business goal

In order to keep Smart Panel up to date on Raspberry Pi image installs without re-flashing...
As a user running the pre-built Raspbian image...
I want the update mechanism to detect the image install and update from GitHub releases automatically.

## 2. Context

- The current update mechanism (`build/scripts/update-worker.sh`) uses `npm update -g` / `npm install -g` which only works for NPM global installs.
- The Raspbian image installs the app directly to `/opt/smart-panel/` with `pnpm install --prod` from pre-built files — it's NOT a global NPM package.
- The update service (`apps/backend/src/modules/system/services/update.service.ts`) already checks GitHub releases for panel updates. The same approach can be used for backend image updates.
- The alpha/beta/release workflows already produce app tarballs as GitHub release artifacts.
- Native modules (sqlite3, bcrypt) must be rebuilt on the target device after update.

### Existing files to modify

- `build/scripts/update-worker.sh` — add image-install branch
- `build/raspbian/stage-smart-panel/01-install-app/01-run-chroot.sh` — change install layout
- `build/raspbian/stage-smart-panel/02-configure/files/smart-panel.service` — update ExecStart path
- `build/raspbian/stage-smart-panel/02-configure/files/first-boot.sh` — add boot logging
- `apps/backend/src/modules/system/services/update.service.ts` — detect install type, provide GitHub download URL
- `apps/backend/src/modules/system/services/update-executor.service.ts` — pass install type to worker

### Existing files for reference

- `apps/backend/src/modules/system/commands/update-panel.command.ts` — already downloads from GitHub releases
- `apps/backend/src/modules/system/commands/update-server.command.ts` — existing server update CLI

## 3. Scope

**In scope**

- Versioned install directory layout with symlink switching
- Detect image-install vs NPM-install at runtime
- Download packed app tarball from GitHub releases for image installs
- Symlink-based atomic version switch
- Rebuild native modules (sqlite3, bcrypt) after update
- Run database migrations
- Keep 2 previous versions for rollback
- Status tracking via existing update-status.json
- Update via Admin UI and CLI
- First-boot log file on boot partition for diagnostics

**Out of scope**

- Panel (Flutter) update on the same device (already handled separately)
- Auto-update / scheduled updates (manual trigger only for v1)
- Major version upgrades (same major version only)
- Rollback UI in Admin (manual rollback via CLI is sufficient for v1)

## 4. Acceptance criteria

### Install layout

- [x] Image installs use versioned directory layout:
  ```
  /opt/smart-panel/
    current -> v1.0.0/          # symlink to active version
    v1.0.0/                     # app files for this version
      .image-install            # marker file
      dist/
      node_modules/
      static/
      ...
  ```
- [x] Systemd service `ExecStart` points to `/opt/smart-panel/current/dist/main.js`
- [x] Data directory remains at `/var/lib/smart-panel/` (shared across versions)
- [x] Config remains at `/etc/smart-panel/environment` (shared across versions)

### Update process

- [x] `UpdateService` detects install type via `/opt/smart-panel/current/.image-install` marker
- [x] `UpdateService` returns GitHub release download URL for image installs (NPM registry for NPM installs)
- [x] Update worker downloads app tarball from GitHub releases
- [x] Worker extracts to `/opt/smart-panel/vX.Y.Z/` (new version directory)
- [x] Production dependencies installed in new version dir (`pnpm install --prod`)
- [x] Native modules (sqlite3, bcrypt) rebuilt from source in new version dir
- [x] Version switch: stop service → update `current` symlink → run migrations → start service
- [x] On failure: symlink reverted to previous version, failed version dir removed
- [x] On success: old versions cleaned up (keep max 2 previous)
- [x] Update status tracked in `/var/lib/smart-panel/update-status.json`
- [x] Admin UI shows update available with version and release notes
- [x] CLI `system:update:server` works for both install types
- [x] Existing NPM-based update path continues to work unchanged

### First-boot logging

- [x] First-boot script writes structured log to `/boot/firmware/smart-panel-firstboot.log`
- [x] Log format uses `[OK]` / `[ERROR]` / `[WARN]` prefixes for easy scanning
- [x] Log includes: partition expand, WiFi config, JWT generation, InfluxDB setup, migration, service start
- [x] On success, log ends with `[OK] Smart Panel ready at http://<ip>:3000`
- [x] On failure, log includes the error details for diagnostics
- [x] User can read the log by mounting SD card boot partition on any computer (FAT32)

### Manual rollback (CLI)

- [ ] CLI command `system:rollback` lists available versions in `/opt/smart-panel/`
- [ ] Rollback switches `current` symlink to selected previous version
- [ ] Rollback runs reverse migrations if needed, or skips if not possible

## 5. Example scenarios

### Scenario: Fresh image boot

Given a freshly flashed Smart Panel image
When the Pi boots for the first time
Then `/opt/smart-panel/v1.0.0/` contains the app
And `/opt/smart-panel/current` symlinks to `v1.0.0/`
And `/boot/firmware/smart-panel-firstboot.log` contains the boot log

### Scenario: Update from v1.0.0 to v1.1.0

Given the Smart Panel is running v1.0.0 from an image install
When the user triggers an update to v1.1.0
Then the worker downloads `smart-panel-v1.1.0-backend.tar.gz` from GitHub
And extracts to `/opt/smart-panel/v1.1.0/`
And installs production dependencies
And rebuilds sqlite3 and bcrypt from source
And stops the Smart Panel service
And updates `current` symlink: `v1.0.0/` → `v1.1.0/`
And runs database migrations
And starts the Smart Panel service
And reports status as "complete"
And directory listing shows:
```
/opt/smart-panel/
  current -> v1.1.0/
  v1.0.0/
  v1.1.0/
```

### Scenario: Second update (v1.1.0 to v1.2.0) cleans old versions

Given the Smart Panel has v1.0.0 and v1.1.0 installed, running v1.1.0
When the user updates to v1.2.0
Then after successful update, v1.0.0 is removed (exceeds 2 previous versions limit)
And directory listing shows:
```
/opt/smart-panel/
  current -> v1.2.0/
  v1.1.0/
  v1.2.0/
```

### Scenario: Update fails during migration

Given the update has installed v1.1.0 and switched the symlink
When database migration fails
Then the worker stops the service
And reverts `current` symlink back to `v1.0.0/`
And starts the service with the old version
And removes the failed `/opt/smart-panel/v1.1.0/` directory
And reports status as "failed" with the migration error

### Scenario: First-boot fails — user reads log from SD card

Given the user flashed the image and booted, but cannot SSH in
When the user removes the SD card and mounts it on their computer
Then `/boot/firmware/smart-panel-firstboot.log` shows:
```
[OK] Root partition expanded
[OK] WiFi configured for MyNetwork (192.168.1.45)
[OK] JWT secret generated
[ERROR] InfluxDB failed to start — timeout after 30s
[OK] Database migrations completed
[ERROR] Smart Panel service failed to start
```
And the user can share this log with support for investigation

### Scenario: NPM install still works

Given the Smart Panel was installed via `npm install -g @fastybird/smart-panel`
And `/opt/smart-panel/current/.image-install` does NOT exist
When the user triggers an update
Then the existing NPM-based update path is used unchanged

## 6. Technical constraints

- Follow the existing update service / worker architecture.
- The worker script runs as a detached process (survives service restart).
- Status file must be updated at each phase for the recovery logic.
- GitHub API rate limits: use conditional requests (If-None-Match) and cache results.
- The release artifact name must be consistent and predictable (e.g., `smart-panel-v1.2.0-backend.tar.gz`).
- Native module rebuild requires `node-gyp` and build-essential (already in the image).
- Symlink switch is atomic on the same filesystem — `/opt/smart-panel/` must be on the root partition.
- The boot partition is FAT32 — log file must use plain text (no symlinks, no permissions).
- Keep max 2 previous versions to avoid filling disk.
- Do not modify generated code.
- Tests are expected for install-type detection and version management logic.

## 7. Implementation hints

- **Install layout change**: Modify `build/raspbian/stage-smart-panel/01-install-app/` to install to `/opt/smart-panel/v1.0.0/` and create `current` symlink. Update systemd service `ExecStart` and `WorkingDirectory`.
- **Marker file**: `touch /opt/smart-panel/v1.0.0/.image-install`
- **Version detection**: Read `package.json` version from `/opt/smart-panel/current/`
- **Install type detection**: Check for `.image-install` marker in active version dir
- **GitHub download**: Reuse the pattern from `update-panel.command.ts`
- **Worker script**: Add `if [ -f /opt/smart-panel/current/.image-install ]` branch
- **Symlink switch**: `ln -sfn /opt/smart-panel/v1.1.0 /opt/smart-panel/current` (atomic)
- **Version cleanup**: `ls -d /opt/smart-panel/v*/ | sort -V | head -n -2 | xargs rm -rf` (keep 2 newest)
- **Boot log**: Write to `/boot/firmware/smart-panel-firstboot.log` from the first-boot script using a `boot_log()` function that both logs to journald and appends to the file
- **Release artifacts**: Ensure the release workflow packages a standalone tarball with `dist/`, `extension-sdk/`, `package.json`, `pnpm-lock.yaml`, `static/`, and `var/`

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
- Read the existing update-worker.sh, update.service.ts, and update-executor.service.ts before proposing changes.
- The update-panel.command.ts is a good reference for GitHub release downloads.
- The install layout change affects the image build scripts AND the systemd service — update both.
