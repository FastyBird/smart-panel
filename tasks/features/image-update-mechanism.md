# Task: Image-based update mechanism for Raspbian installs
ID: FEATURE-IMAGE-UPDATE
Type: feature
Scope: backend
Size: large
Parent: (none)
Status: planned

## 1. Business goal

In order to keep Smart Panel up to date on Raspberry Pi image installs without re-flashing...
As a user running the pre-built Raspbian image...
I want the update mechanism to detect the image install and update from GitHub releases automatically.

## 2. Context

- The current update mechanism (`build/scripts/update-worker.sh`) uses `npm update -g` / `npm install -g` which only works for NPM global installs.
- The Raspbian image installs the app directly to `/usr/lib/smart-panel/` with `pnpm install --prod` from pre-built files — it's NOT a global NPM package.
- The update service (`apps/backend/src/modules/system/services/update.service.ts`) already checks GitHub releases for panel updates. The same approach can be used for backend image updates.
- The alpha/beta/release workflows already produce app tarballs as GitHub release artifacts.
- Native modules (sqlite3, bcrypt) must be rebuilt on the target device after update.

### Existing files to modify

- `build/scripts/update-worker.sh` — add image-install branch
- `apps/backend/src/modules/system/services/update.service.ts` — detect install type, provide GitHub download URL
- `apps/backend/src/modules/system/services/update-executor.service.ts` — pass install type to worker

### Existing files for reference

- `apps/backend/src/modules/system/commands/update-panel.command.ts` — already downloads from GitHub releases
- `apps/backend/src/modules/system/commands/update-server.command.ts` — existing server update CLI
- `build/raspbian/stage-smart-panel/01-install-app/01-run-chroot.sh` — how the image installs the app

## 3. Scope

**In scope**

- Detect image-install vs NPM-install at runtime
- Download packed app tarball from GitHub releases for image installs
- Atomic switch with rollback on failure
- Rebuild native modules (sqlite3, bcrypt) after update
- Run database migrations
- Status tracking via existing update-status.json
- Update via Admin UI and CLI

**Out of scope**

- Panel (Flutter) update on the same device (already handled separately)
- Auto-update / scheduled updates (manual trigger only for v1)
- Major version upgrades (same major version only)
- Rollback UI (automatic rollback on failure is sufficient)

## 4. Acceptance criteria

- [ ] Image installs have a marker file at `/usr/lib/smart-panel/.image-install`
- [ ] `UpdateService` detects install type and returns appropriate download source (NPM registry vs GitHub release)
- [ ] Update worker downloads the app tarball from GitHub releases when running on an image install
- [ ] Update extracts to a staging directory (`/usr/lib/smart-panel.new/`)
- [ ] Production dependencies are installed in the staging directory (`pnpm install --prod`)
- [ ] Native modules (sqlite3, bcrypt) are rebuilt from source in the staging directory
- [ ] Atomic switch: service stopped → old dir renamed to `.old` → new dir renamed to active → migrations run → service started
- [ ] On failure: automatic rollback (`.new` removed, `.old` restored if switch was attempted)
- [ ] On success: `.old` directory cleaned up
- [ ] Update status tracked in `/var/lib/smart-panel/update-status.json` (same as NPM updates)
- [ ] Admin UI shows update available with version and release notes
- [ ] CLI `system:update:server` works for both install types
- [ ] Existing NPM-based update path continues to work unchanged

## 5. Example scenarios

### Scenario: Image install detects update

Given the Smart Panel is running from a Raspbian image install
And `/usr/lib/smart-panel/.image-install` exists
When the user checks for updates via Admin UI
Then the system queries GitHub releases for the latest version
And shows the available update with release notes

### Scenario: Image install updates successfully

Given an update is available (v1.1.0 → v1.2.0)
When the user triggers the update
Then the worker downloads `smart-panel-v1.2.0-backend.tar.gz` from GitHub
And extracts to `/usr/lib/smart-panel.new/`
And installs production dependencies
And rebuilds sqlite3 and bcrypt from source
And stops the Smart Panel service
And renames `/usr/lib/smart-panel` → `/usr/lib/smart-panel.old`
And renames `/usr/lib/smart-panel.new` → `/usr/lib/smart-panel`
And runs database migrations
And starts the Smart Panel service
And removes `/usr/lib/smart-panel.old`
And reports status as "complete"

### Scenario: Image install update fails during migration

Given the update has switched directories
When database migration fails
Then the worker stops the service
And renames `/usr/lib/smart-panel` → `/usr/lib/smart-panel.failed`
And renames `/usr/lib/smart-panel.old` → `/usr/lib/smart-panel`
And starts the service with the old version
And reports status as "failed" with the migration error

### Scenario: NPM install still works

Given the Smart Panel was installed via `npm install -g @fastybird/smart-panel`
And `/usr/lib/smart-panel/.image-install` does NOT exist
When the user triggers an update
Then the existing NPM-based update path is used unchanged

## 6. Technical constraints

- Follow the existing update service / worker architecture.
- The worker script runs as a detached process (survives service restart).
- Status file must be updated at each phase for the recovery logic.
- GitHub API rate limits: use conditional requests (If-None-Match) and cache results.
- The release artifact name must be consistent and predictable (e.g., `smart-panel-v1.2.0-backend.tar.gz`).
- Native module rebuild requires `node-gyp` and build-essential (already in the image).
- Do not modify generated code.
- Tests are expected for the install-type detection logic.

## 7. Implementation hints

- **Marker file**: Add `touch /usr/lib/smart-panel/.image-install` to `build/raspbian/stage-smart-panel/01-install-app/01-run-chroot.sh`
- **Install type detection**: Check for marker file in `UpdateService` or a new `InstallTypeService`
- **GitHub download**: Reuse the pattern from `update-panel.command.ts` which already downloads from GitHub releases
- **Worker script**: Add an `if [ -f /usr/lib/smart-panel/.image-install ]` branch that does download → extract → switch instead of `npm update -g`
- **Release artifacts**: Ensure the release workflow packages a standalone tarball with `dist/`, `extension-sdk/`, `package.json`, `pnpm-lock.yaml`, `static/`, and `var/`
- **Atomic switch**: Use `mv` for rename (atomic on same filesystem). The staging dir must be on the same partition as the install dir.
- **Rollback**: The `.old` dir is the safety net. Only remove it after the new version starts successfully and responds to health check.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
- Read the existing update-worker.sh, update.service.ts, and update-executor.service.ts before proposing changes.
- The update-panel.command.ts is a good reference for GitHub release downloads.
