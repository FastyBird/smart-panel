# Task: Panel (Display) App Updates

ID: FEATURE-PANEL-APP-UPDATES
Type: feature
Scope: backend, admin, panel
Size: large
Parent: (none)
Status: planned

## 1. Business goal

In order to keep the panel display app up to date without reflashing or manual file replacement,
As a Smart Panel administrator,
I want to update the Flutter panel app from the admin UI (per-display) or directly from the panel app itself, with support for all distribution types.

## 2. Context

### Current State

- The backend already has `UpdateService.checkPanelUpdate()` which queries GitHub releases for display assets
- The CLI command `system:update:panel` can download panel release assets from GitHub
- The panel app has no self-update capability
- Panel updates require manual binary replacement or reflashing
- The backend tracks connected displays via the displays module

### Distribution Types

The panel app is distributed in three formats, each with different update mechanics:

| Type | Platform | Install Location | Runtime |
|------|----------|-----------------|---------|
| **flutter-pi** | Raspbian (RPi) | `/opt/smart-panel-display/` | flutter-pi process |
| **eLinux** | Generic Linux | `/opt/smart-panel-display/` | Standalone executable |
| **Android APK** | Android tablets | Standard Android app | Android runtime |

### Release Assets (from GitHub)

The release workflow already produces:
- `smart-panel-display-armv7.tar.gz` — flutter-pi / eLinux ARM32
- `smart-panel-display-arm64.tar.gz` — flutter-pi / eLinux ARM64
- `smart-panel-display-android.apk` — Android APK
- `version.json` — version manifest with channel info

### Existing Infrastructure

- **Backend displays module** — tracks connected panels, their IPs, versions
- **WebSocket connection** — panels connect to backend via Socket.IO
- **Display-targeted events** — backend can send events to specific displays
- **Panel settings** — panel has a settings screen accessible via overlay

## 3. Scope

**In scope**

- Backend API to trigger panel update for a specific display
- Backend sends update command to panel via WebSocket
- Panel app receives update command and performs self-update
- flutter-pi/eLinux: download tarball, extract, restart process
- Android: download APK, prompt user to install (Android requires user interaction)
- Admin UI: per-display update trigger on displays management page
- Panel UI: update check and trigger from settings screen
- Version reporting: panel reports its version to backend on connect
- Progress tracking via WebSocket events

**Out of scope**

- Automatic/scheduled panel updates (manual trigger only)
- Delta/incremental updates (full binary replacement)
- App store distribution for Android (direct APK only)
- iOS support
- Rollback mechanism (future enhancement)

## 4. Acceptance criteria

### 4.1 Backend — Panel Update API

- [ ] `POST /api/v1/displays/{id}/update` — trigger update for a specific display
- [ ] Backend resolves correct asset based on display's reported platform/architecture
- [ ] Backend sends `DisplayModule.Display.Update.Start` event to the target display via WebSocket
- [ ] Event payload includes: download URL, target version, asset name, expected checksum
- [ ] Display reports update progress back via WebSocket events
- [ ] Backend tracks per-display update status

### 4.2 Panel — Self-Update Engine

- [ ] Panel reports platform type (flutter-pi, elinux, android) and architecture (armv7, arm64) on WebSocket connect
- [ ] Panel listens for `DisplayModule.Display.Update.Start` WebSocket events
- [ ] flutter-pi/eLinux update flow:
  - Download tarball to temp directory
  - Verify checksum
  - Stop current process gracefully
  - Extract to install directory (atomic swap if possible)
  - Restart process via systemd or direct exec
- [ ] Android update flow:
  - Download APK to app cache
  - Verify checksum
  - Trigger Android package installer intent (requires user tap to confirm)
- [ ] Panel sends progress events: downloading (with %), extracting, restarting, complete, failed
- [ ] Panel can check for updates independently (without backend command)

### 4.3 Admin UI — Per-Display Update

- [ ] Displays list shows current panel version per display
- [ ] "Update available" indicator when display version < latest release
- [ ] "Update" button per display (or bulk "Update All")
- [ ] Progress indicator per display during update
- [ ] Success/failure notification per display

### 4.4 Panel UI — Settings Update Screen

- [ ] Settings screen shows current panel version
- [ ] "Check for Updates" button
- [ ] "Install Update" button when update available
- [ ] Progress indicator during update
- [ ] For Android: shows "Install" prompt explaining user must tap to confirm

### 4.5 Quality

- [ ] All distribution types tested (flutter-pi, eLinux, Android)
- [ ] Update survives process restart (flutter-pi/eLinux)
- [ ] Graceful handling of network failures during download
- [ ] Checksum verification prevents corrupted installs

## 5. Example scenarios

### Scenario: Admin updates a Raspberry Pi display

Given display "Living Room" is connected and running panel v1.0.0
And panel v1.1.0 is available on GitHub releases
When the admin clicks "Update" on the Living Room display
Then the backend sends an update command to that display via WebSocket
And the panel downloads `smart-panel-display-armv7.tar.gz`
And extracts and replaces the current binary
And restarts the flutter-pi process
And reconnects to the backend reporting v1.1.0

### Scenario: User updates from panel settings

Given the panel is running v1.0.0
When the user opens Settings > System > Updates
And taps "Check for Updates"
Then the panel queries the backend for available panel updates
And shows "Update available: v1.1.0"
When the user taps "Install Update"
Then the update proceeds locally on the device

### Scenario: Android APK update

Given an Android tablet is running panel v1.0.0
When the admin triggers an update
Then the panel downloads the APK file
And opens the Android package installer
And shows a message: "Please tap Install when prompted"
And waits for the user to complete the Android install flow

## 6. Technical constraints

- flutter-pi/eLinux: process runs as `smart-panel` user via systemd — needs appropriate permissions for binary replacement
- Android: cannot silently install APKs — requires user interaction via package installer intent
- Panel must handle partial downloads and resume if possible
- Download URLs from GitHub releases may involve redirects
- The panel's WebSocket connection will drop during restart — backend should expect this
- Architecture detection must be reliable (armv7 vs arm64)
- File replacement must be atomic where possible to avoid corrupted state

## 7. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- This is a large feature — implement in phases: 1) version reporting, 2) backend API, 3) flutter-pi/eLinux update engine, 4) Android update, 5) admin UI, 6) panel settings UI.
- Study the existing `update-panel.command.ts` CLI command for GitHub asset download patterns.
- Study the existing `update-worker.sh` for the file replacement and restart patterns.
- The panel update engine in Dart should be a service registered in the locator.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.

## 8. Dependencies

- GitHub releases with panel assets (already produced by CI)
- Backend displays module (already exists)
- WebSocket display-targeted events (already exists)
- Panel settings overlay (already exists)

## 9. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| flutter-pi binary replacement fails mid-write | Use atomic swap: write to temp dir, then rename |
| Android user declines install prompt | Show clear instructions; keep APK cached for retry |
| Wrong architecture asset downloaded | Panel reports architecture on connect; backend resolves correct asset |
| Network failure during download | Support resume; verify partial downloads; clean up on failure |
| Process doesn't restart after binary replacement | Systemd watchdog restarts the service; status file for recovery |
| Multiple displays updated simultaneously overload GitHub API | Queue updates; rate-limit downloads; cache asset URLs |
