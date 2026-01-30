# Task: Panel app – Alerts grouping + local acknowledge UX (session-only)
ID: FEATURE-PANEL-SECURITY-ALERTS-GROUPING
Type: feature
Scope: panel
Size: medium
Parent: EPIC-EXPAND-SMART-PANEL-DOMAINS
Status: done

## 1. Business goal

In order to improve visibility and control over security alerts on the panel
As a Smart Panel user
I want alerts grouped by severity with per-alert and bulk acknowledgement so I can triage without losing sight of any active issue

## 2. Context

- Backend security module exposes `GET /api/v1/modules/security/status` with `SecurityStatusModel` containing `activeAlerts[]` with `id`, `severity`, `timestamp`
- Panel already has `SecurityOverlayController` with overlay acknowledgement logic (Task 3.0 — `FEATURE-PANEL-SECURITY-OVERLAY`)
- Panel already has `SecurityScreen` showing a flat sorted alert list (Task 3.1 — `FEATURE-PANEL-SECURITY-SCREEN`)
- This task adds grouping, per-alert acknowledgement, and overlay integration — all session-only, no backend mutations

## 3. Scope

**In scope**

- Alert grouping by severity (Critical / Warnings / Info sections)
- Local acknowledgement state (`acknowledgedAlertIds`) with per-alert and "Acknowledge all" actions
- Timestamp-based reset strategy: if same alert id reappears with newer timestamp, treat as new
- Visual distinction for acknowledged alerts (reduced opacity, check icon, "Acknowledged" label)
- Overlay suppression integration: suppress overlay when all critical alerts acknowledged; re-show on new/updated critical alerts
- "All alerts acknowledged" banner when all active alerts are acknowledged
- Unit tests for grouping, ack add/remove/reset, overlay suppression logic

**Out of scope**

- Backend mutation API for acknowledgement
- Persisting acknowledgements across app restarts
- Advanced snooze timers
- History/timeline view

## 4. Acceptance criteria

- [x] Alerts are grouped by severity into Critical, Warnings, Info sections (in that order)
- [x] Empty severity sections are hidden
- [x] Within each section, alerts are sorted by timestamp desc, then id asc
- [x] Per-alert "Acknowledge" action marks an alert as acknowledged (session-only)
- [x] "Acknowledge all" action marks all current alerts as acknowledged
- [x] Acknowledged alerts are visually distinct (reduced opacity, check icon) but remain listed
- [x] When an alert disappears from activeAlerts, it is removed from acknowledged set
- [x] When an alert reappears with a newer timestamp, its acknowledgement is reset
- [x] Overlay is suppressed when all current critical alerts are acknowledged
- [x] Overlay re-appears when a new critical alert id appears or an existing critical alert timestamp increases
- [x] "All alerts acknowledged" banner shown when all active alerts are acknowledged
- [x] Unit tests cover grouping, ack add/remove/reset, and overlay suppression rules

## 5. Example scenarios

### Scenario: Alerts grouped by severity

Given activeAlerts contains 2 critical, 1 warning, and 1 info alert
When the Security screen renders
Then alerts appear in three sections: Critical (2), Warnings (1), Info (1)

### Scenario: Acknowledge single alert

Given a critical alert "smoke-1" is displayed
When the user taps the acknowledge button on "smoke-1"
Then "smoke-1" is visually dimmed with a check icon
And if all critical alerts are acknowledged, the overlay is suppressed

### Scenario: Alert reappears with new timestamp

Given alert "smoke-1" was acknowledged
When "smoke-1" reappears with a newer timestamp
Then the acknowledgement is reset and it appears as unacknowledged

### Scenario: Alert disappears

Given alert "smoke-1" was acknowledged
When "smoke-1" is no longer in activeAlerts
Then "smoke-1" is removed from the acknowledged set

## 6. Technical constraints

- Follow existing module/service structure (models, repositories, services)
- Use `ChangeNotifier` + `Provider` pattern for reactive state
- Do not introduce new dependencies
- Do not modify generated code
- Tests are expected for new logic

## 7. Implementation hints

- Add `groupAlertsBySeverity` pure function alongside existing `sortAlerts`
- Extend `SecurityOverlayController` with `acknowledgedAlertIds`, `lastSeenTimestamps` tracking, per-alert ack, ack-all, and cleanup on status update
- Refactor `SecurityScreen` alerts section to render severity group headers with per-group alert lists
- Add acknowledge button per alert row and "Acknowledge all" button in header area
- Reuse existing `shouldShowSecurityOverlay` pure function (already checks `acknowledgedAlertIds`)

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
