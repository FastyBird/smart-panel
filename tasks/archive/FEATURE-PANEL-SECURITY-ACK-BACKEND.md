# Task: Panel app – Wire alert acknowledge actions to backend + sync
ID: FEATURE-PANEL-SECURITY-ACK-BACKEND
Type: feature
Scope: panel
Size: medium
Parent: EPIC-EXPAND-SMART-PANEL-DOMAINS
Status: done

## 1. Business goal

In order to persist security alert acknowledgements across sessions and devices
As a Smart Panel user
I want acknowledging alerts on the panel to call the backend API and use server state as the source of truth

## 2. Context

- Backend security module now exposes acknowledge endpoints:
  - `PATCH /api/v1/modules/security/alerts/:id/ack` – acknowledge single alert
  - `PATCH /api/v1/modules/security/alerts/ack` – acknowledge all alerts
- Backend returns `acknowledged` flag on each alert in `SecurityStatusDto.activeAlerts[]`
- Panel already has `SecurityAlertModel.acknowledged` field parsed from JSON
- Panel currently uses session-only `_acknowledgedAlertIds` set in `SecurityOverlayController`
- Panel overlay and security screen already have acknowledge UI (Task 3.3 / FEATURE-PANEL-SECURITY-OVERLAY)
- Panel uses `ChangeNotifier` + `Provider` pattern and `Dio` for HTTP

## 3. Scope

**In scope**

- Replace session-only ack logic with server-backed ack
- Implement API client calls for single and bulk acknowledge
- Implement optimistic UI updates with rollback on failure
- Reconcile local state when backend status arrives (WS/HTTP refresh)
- Update overlay suppression to use `alert.acknowledged` from backend
- Disable ack actions when offline

**Out of scope**

- User accounts / per-user ack
- Retry queues / offline ack buffering
- Snooze timers
- History / event log

## 4. Acceptance criteria

- [x] Acknowledge single alert calls `PATCH /api/v1/modules/security/alerts/:id/ack`
- [x] Acknowledge all alerts calls `PATCH /api/v1/modules/security/alerts/ack`
- [x] Acknowledged flags persist across refresh (server truth)
- [x] Overlay suppression uses server `acknowledged` state
- [x] On API failure: revert optimistic state or refresh from backend, no stuck UI
- [x] Ack actions disabled when offline
- [x] Tests cover ack success/failure, overlay suppression from server flags, offline disable

## 5. Example scenarios

### Scenario: User acknowledges a single alert

Given a critical alert is active and unacknowledged
When the user taps "Acknowledge" on that alert
Then the alert is immediately shown as acknowledged (optimistic)
And `PATCH /api/v1/modules/security/alerts/:id/ack` is called
And on success the server state confirms the acknowledgement

### Scenario: API failure reverts optimistic state

Given a critical alert is active and unacknowledged
When the user taps "Acknowledge" but the API call fails
Then the alert reverts to unacknowledged state
And the user sees an error indication

### Scenario: Server status update reconciles state

Given an alert was optimistically acknowledged locally
When a new SecurityStatusDto arrives from WS/polling
Then the local state is replaced with server state
And optimistic-only flags are cleared

### Scenario: Offline disables ack

Given the panel is offline
When critical alerts are displayed
Then acknowledge buttons are disabled

## 6. Technical constraints

- Follow existing module/service structure (repositories, controllers)
- Use `ChangeNotifier` + `Provider` for reactive state
- Use existing `Dio` instance for API calls
- Do not introduce new dependencies
- Do not modify generated code
- Tests are expected for new logic

## 7. Implementation hints

- Add `acknowledgeAlertApi(id)` and `acknowledgeAllApi()` to `SecurityStatusRepository`
- Refactor `SecurityOverlayController` to derive ack state from `alert.acknowledged` field
- Keep `_acknowledgedAlertIds` only as a transient optimistic cache for in-flight requests
- On `updateStatus()`, clear optimistic cache and use server flags
- Pass repository reference to controller, or expose async methods that coordinate repo + controller
- Overlay `onAcknowledge` in `body.dart` should call the new async method

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
