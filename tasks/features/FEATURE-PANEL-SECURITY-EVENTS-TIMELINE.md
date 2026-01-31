# Task: Panel app – Recent security events timeline UI
ID: FEATURE-PANEL-SECURITY-EVENTS-TIMELINE
Type: feature
Scope: panel
Size: medium
Parent: EPIC-EXPAND-SMART-PANEL-DOMAINS
Status: done

## 1. Business goal

In order to provide quick "what happened recently" context on the Security screen
As a Smart Panel user
I want to see a Recent Events section that displays the latest security timeline events from the backend

## 2. Context

- Backend already provides `GET /api/v1/modules/security/events?limit=50` via `FEATURE-SECURITY-EVENT-TIMELINE` (done)
- Security screen exists with status card, entry points, and active alerts sections
- No panel-side event timeline exists yet — only current state is shown
- Event types: `alert_raised`, `alert_resolved`, `alert_acknowledged`, `alarm_state_changed`, `armed_state_changed`
- Backend `SecurityEventEntity` fields: id, timestamp, eventType, severity, alertId, alertType, sourceDeviceId, payload

## 3. Scope

**In scope**

- Fetch recent events from backend (`GET /api/v1/modules/security/events?limit=50`)
- Render a "Recent Events" section on the Security screen below Active Alerts
- Map event types to icons and human-readable text
- Handle loading/empty/error states
- Show last 10 events by default (newest first)
- Manual refresh on screen entry + retry on error

**Out of scope**

- Writing events (backend already does)
- Long-term history browsing
- Filters UI
- Export/reporting
- "View all" dedicated screen

## 4. Acceptance criteria

- [x] Recent Events section renders on Security screen below Active Alerts
- [x] Events fetched from backend and displayed newest-first
- [x] Event text + icons match event type
- [x] Handles loading/empty/error states gracefully
- [x] Unit test for mapping SecurityEventModel → display model (title/icon)

## 5. Example scenarios

### Scenario: Events displayed on security screen

Given the backend has 15 security events
When the user opens the Security screen
Then the 10 most recent events are shown newest-first with correct icons and text

### Scenario: Empty events

Given no security events exist
When the user opens the Security screen
Then a "No recent events" message is shown in the Recent Events section

### Scenario: Error fetching events

Given the backend is unreachable
When the user opens the Security screen
Then an error message with a retry button is shown in the Recent Events section

## 6. Technical constraints

- Follow existing security module structure (repository + ChangeNotifier pattern)
- Use existing `SystemPagesTheme`, `AppSpacings`, `AppFontSize` constants
- Use MDI icons consistent with existing security UI
- Do not modify generated code
- Tests expected for event-to-UI mapping logic

## 7. Implementation hints

- Create `SecurityEventModel` in `models/security_event.dart`
- Add `SecurityEventType` enum to `types/security.dart`
- Create `SecurityEventsRepository` in `repositories/security_events.dart`
- Add event UI utils (icon, title) in `utils/security_event_ui.dart`
- Add section to `SecurityScreen` after the Active Alerts section
- Initialize repository in `SecurityModuleService`
- Reuse `DatetimeUtils.formatTimeAgo` for relative timestamps

## 8. AI instructions

- Read this file entirely before making code changes
- Keep changes scoped to this task (panel only)
- For each acceptance criterion, implement or explain why skipped
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`
