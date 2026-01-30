# Task: Panel app – Security overlay & intent rules (forced alerts UX)
ID: FEATURE-PANEL-SECURITY-OVERLAY
Type: feature
Scope: panel
Size: medium
Parent: EPIC-EXPAND-SMART-PANEL-DOMAINS
Status: done

## 1. Business goal

In order to ensure critical security alerts are never missed on the panel
As a Smart Panel user
I want the panel to show a forced overlay when critical security alerts are active and provide navigation to a Security view

## 2. Context

- Backend security module already exposes `GET /api/v1/modules/security/status` with `SecurityStatusModel` containing `activeAlerts[]`, `hasCriticalAlert`, `highestSeverity`, `alarmState`, `armedState`, `lastEvent`
- Panel has no security module yet
- Panel already has a connection overlay system with severity escalation (`ConnectionStateManager`)
- Panel uses `ChangeNotifier` + `Provider` pattern for reactive state
- Panel uses `GetIt` for dependency injection and `SocketService` for real-time updates

## 3. Scope

**In scope**

- Add a security overlay component (full-screen modal/overlay)
- Implement decision rules for when overlay is displayed
- Provide a minimal Security Alert view (list + primary CTA)
- Integrate with existing WS/HTTP status update mechanism
- Implement non-persistent user acknowledgement for the current session
- Unit tests for decision logic, acknowledgement suppression, and alert sorting

**Out of scope**

- Sending ack back to backend (no mutations yet)
- PIN / authentication
- Alarm arming/disarming UI
- Historical timeline / event log
- Zones configuration

## 4. Acceptance criteria

- [x] When a critical alert appears, panel shows forced security overlay
- [x] Overlay shows correct title + at least one alert summary
- [x] "Acknowledge" hides overlay until new critical alert/change occurs
- [x] "Open Security" navigates to Security view
- [x] Alerts are sorted and displayed deterministically
- [x] Overlay precedence works with existing offline overlay
- [x] Behavior covered by tests (unit tests for decision logic at minimum)

## 5. Example scenarios

### Scenario: Smoke sensor triggers critical alert

Given the security status has `hasCriticalAlert=true` with a smoke alert
When the panel receives the status update
Then the security overlay is shown with title "Smoke detected"

### Scenario: User acknowledges overlay

Given the security overlay is visible
When the user taps "Acknowledge"
Then the overlay is hidden until a new critical alert appears or the alert set changes

### Scenario: Offline overlay takes precedence

Given the connection is offline (fullScreen severity)
When a critical security alert exists
Then the offline overlay is shown (not the security overlay)

### Scenario: User on Security screen

Given the user has navigated to the Security view
When a critical alert is active
Then the overlay is suppressed (content visible on screen already)

## 6. Technical constraints

- Follow existing module/service structure (models, repositories, services)
- Use `ChangeNotifier` + `Provider` for reactive state
- Register services via `GetIt` locator
- Do not introduce new dependencies
- Tests are expected for decision logic
- Do not modify generated code

## 7. Implementation hints

- Model the security module after `weather` module pattern (module service, repository, models)
- Overlay controller should be a `ChangeNotifier` that combines security status + connection state + acknowledgement state
- Use the `Stack` overlay pattern in `AppBody` (same as connection UI)
- Security overlay sits between connection UI and main content in the stack
- Alert sorting: severity desc → timestamp desc → id asc
- Acknowledgement stored as `Set<String>` of alert IDs (session-only, in memory)

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
