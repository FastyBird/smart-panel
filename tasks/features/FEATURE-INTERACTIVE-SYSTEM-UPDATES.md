# Task: System Updates via Interactive Sessions

ID: FEATURE-INTERACTIVE-SYSTEM-UPDATES
Type: feature
Scope: backend, admin
Size: medium
Parent: EPIC-EXTENSION-ACTIONS
Status: planned

## 1. Business goal

In order to safely update my Smart Panel installation with clear feedback,
As a Smart Panel administrator,
I want to trigger application updates from the admin UI and see real-time progress including version check, download, installation, migration, and restart status.

## 2. Context

The system module already supports app updates via CLI (`smart-panel-service update`) and has a basic update check endpoint. The current flow:
1. Check for updates (version comparison)
2. Stop services
3. Run npm/pnpm update
4. Run database migrations
5. Restart services

This task wraps that flow in an interactive session, providing a terminal-like experience in the admin UI.

**Existing code:**
- `apps/backend/src/modules/system/` — System module with update endpoints
- `build/bin/smart-panel-service.js` — CLI update command
- `build/src/installers/linux.ts` — Linux installer with migration support

**Dependencies:**
- FEATURE-INTERACTIVE-SESSION-PROTOCOL — WebSocket session infrastructure
- FEATURE-INTERACTIVE-SESSION-ADMIN-UI — Terminal UI component

## 3. Scope

**In scope**

- System module registers interactive update action
- Session flow: version check → show changelog/diff → confirm update → stream progress → report restart
- Progress phases: checking version, downloading, installing dependencies, running migrations, restarting services
- Graceful handling of update failures (rollback information)
- Integration with existing system update mechanisms

**Out of scope**

- Automatic/scheduled updates (future enhancement)
- Rollback mechanism (complex, separate feature)
- Multi-node cluster updates
- Extension/plugin individual updates (future marketplace feature)

## 4. Acceptance criteria

- [ ] System module registers an interactive "Update Application" action
- [ ] Session shows current version and available version before confirming
- [ ] Update progress streams in real-time: download %, install status, migration steps
- [ ] Failed updates show clear error message with troubleshooting hints
- [ ] Session handles the restart gracefully (warns user about reconnection)
- [ ] Update action only available when an update is available
- [ ] Update action requires owner role
- [ ] Works on Linux installations (primary target)

## 5. Example scenarios

### Scenario: Successful update

Given I am on the system module's extension detail page
When I click "Update Application" interactive action
Then a terminal session opens
And it shows: "Current version: 1.2.3, Available: 1.3.0"
And it shows: "Changelog: - Added feature X, - Fixed bug Y"
And it prompts: "Proceed with update?"
When I confirm
Then it streams: "Downloading update... 45%", "Installing dependencies...", "Running migrations (1/3)..."
Then it shows: "Update complete. Restarting services..."
Then the session shows a success message and auto-reconnects after restart

### Scenario: No update available

Given the application is already on the latest version
When I view the system extension actions
Then the "Update Application" action shows "Up to date" status
And the action is disabled

## 6. Technical constraints

- Must coordinate with process manager (systemd) for restart
- Update process must be resilient to WebSocket disconnection (continues in background)
- Session must buffer output for client reconnection after restart
- Must not break if user navigates away during update
- Follow existing system module patterns

## 7. AI instructions

- Read this file entirely before making any code changes
- Implement after FEATURE-INTERACTIVE-SESSION-PROTOCOL and FEATURE-INTERACTIVE-SESSION-ADMIN-UI
- Study existing update mechanism in `build/` and system module
- The update itself runs as a background process — the session just reports progress
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`
