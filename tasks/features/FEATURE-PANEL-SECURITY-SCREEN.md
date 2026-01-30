# Task: Panel app – Security screen UI (status + active alerts list)
ID: FEATURE-PANEL-SECURITY-SCREEN
Type: feature
Scope: panel
Size: medium
Parent: EPIC-EXPAND-SMART-PANEL-DOMAINS
Status: in-progress

## 1. Business goal

In order to have a dedicated view for monitoring security status and active alerts
As a Smart Panel user
I want a Security screen that shows armed/alarm state, active alerts sorted by severity, and provides navigation from overlay and dashboard

## 2. Context

- Backend security module exposes `GET /api/v1/modules/security/status` with `SecurityStatusModel` containing `activeAlerts[]`, `hasCriticalAlert`, `highestSeverity`, `alarmState`, `armedState`, `lastEvent`
- Panel already has `SecurityOverlayController` and `SecurityStatusRepository` from Task 3.0 (FEATURE-PANEL-SECURITY-OVERLAY)
- Panel already has a basic `SecurityScreen` placeholder in `modules/security/presentation/security_screen.dart`
- Security overlay "Open Security" button already navigates to SecurityScreen via push route
- Panel uses `ChangeNotifier` + `Provider` pattern for reactive state

## 3. Scope

**In scope**

- Security screen route/view with intent mapping
- UI layout: status header with armed/alarm chips + severity indicator
- Active alerts list with sorting, icons, time display, severity badges
- Empty state UI (no alerts)
- Back navigation
- Unit tests for sorting and rendering logic

**Out of scope**

- Backend acknowledge mutations
- PIN/auth and arming restrictions
- Full event history / timeline
- Zone configuration
- Camera views
- Arm/disarm quick actions (deferred for MVP)

## 4. Acceptance criteria

- [x] Security screen is reachable via navigation and via overlay CTA
- [x] Shows armed/alarm status chips with correct labels
- [x] Shows overall severity indicator in status header
- [x] Shows list of active alerts with correct sorting (severity desc, timestamp desc, id asc)
- [x] Each alert row shows icon, type label, source device info, relative time, severity badge
- [x] Empty state is shown when no alerts
- [x] Uses stable IDs as keys (no flicker)
- [x] Works with live updates (WS) via SecurityOverlayController
- [x] Named route registered for security screen
- [x] Unit tests for sorting and screen rendering logic

## 5. Example scenarios

### Scenario: User opens security screen from overlay

Given a critical security alert is active
When the user taps "Open Security" on the overlay
Then the Security screen is shown with status chips and alert list

### Scenario: No active alerts

Given no security alerts are active
When the user views the Security screen
Then the empty state is shown with "No active alerts" message

### Scenario: Multiple alerts with different severities

Given there are alerts with critical, warning, and info severity
When the Security screen is shown
Then alerts are sorted by severity desc, timestamp desc, id asc

## 6. Technical constraints

- Follow existing module/service structure (models, repositories, services)
- Use `ChangeNotifier` + `Provider` for reactive state
- Do not introduce new dependencies
- Tests are expected for new logic
- Do not modify generated code

## 7. Implementation hints

- Enhance existing `SecurityScreen` in `modules/security/presentation/security_screen.dart`
- Reuse `SecurityOverlayController` for reactive state (same as overlay)
- Reuse `alertTypeIcon`, `severityColor`, `severityBgColor` from `utils/security_ui.dart`
- Use `DatetimeUtils.formatTimeAgo` for relative time display
- Add named route in `app/routes.dart` for direct navigation
- Add tests alongside existing `security_overlay_controller_test.dart`

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
