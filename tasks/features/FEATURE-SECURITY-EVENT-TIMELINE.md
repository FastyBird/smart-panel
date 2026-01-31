# Task: Security Domain – Event timeline (short history buffer) + API
ID: FEATURE-SECURITY-EVENT-TIMELINE
Type: feature
Scope: backend
Size: medium
Parent: EPIC-EXPAND-SMART-PANEL-DOMAINS
Status: done

## 1. Business goal

In order to show "what happened recently" on the panel and admin UI
As a Smart Panel system
I want a minimal security event timeline that records recent alert/activity transitions with a short rolling buffer

## 2. Context

- Security module already has provider-based aggregation with `activeAlerts[]` in `SecurityStatusModel`
- Alert acknowledgement is persisted via `SecurityAlertAckEntity` and PATCH endpoints
- No event history exists yet — only current state is exposed
- This is not long-term history; it's a short rolling buffer (last 200 events) with TTL cleanup

## 3. Scope

**In scope**

- Create persistent event store for recent events (short history)
- Record events when:
  - a new alert becomes active (`alert_raised`)
  - an alert resolves / becomes inactive (`alert_resolved`)
  - an alert is acknowledged (`alert_acknowledged`)
  - alarm `armedState` / `alarmState` changes (`armed_state_changed`, `alarm_state_changed`)
- Add API: `GET /api/v1/modules/security/events?limit=50`
  - optional filters: `severity`, `type`, `since`
- Add event DTOs / response models
- Add cleanup strategy (capped rows)
- Add tests

**Out of scope**

- Full audit logging (who/when/why)
- Per-user attribution
- Export/reporting
- Long-term analytics

## 4. Acceptance criteria

- [x] `SecurityEventEntity` exists with fields: id (uuid PK), timestamp (datetime, indexed), eventType, severity, alertId, alertType, sourceDeviceId, payload
- [x] Backend records `alert_raised` event when a new alert appears
- [x] Backend records `alert_resolved` event when an alert disappears
- [x] Backend records `alert_acknowledged` event on ack endpoint call
- [x] Backend records `armed_state_changed` / `alarm_state_changed` events on state transitions
- [x] `GET /api/v1/modules/security/events` returns recent events ordered by timestamp desc
- [x] API respects `limit` (default 50, max 200), `since`, `severity`, `type` query params
- [x] Retention cleanup caps events at 200 rows
- [x] Covered by unit tests

## 5. Example scenarios

### Scenario: Alert raised event recorded

Given a smoke sensor triggers
When the security status is fetched and the alert is new
Then an `alert_raised` event is persisted with severity and alertId

### Scenario: Alert resolved event recorded

Given a previously active alert is no longer in activeAlerts
When the security status is fetched
Then an `alert_resolved` event is persisted

### Scenario: Events API returns recent events

Given 10 events exist in the timeline
When GET /api/v1/modules/security/events?limit=5 is called
Then the 5 most recent events are returned ordered by timestamp desc

## 6. Technical constraints

- Follow existing security module structure
- Use TypeORM entity with SQLite compatibility
- Do not introduce new dependencies
- Use UUID primary key (auto-generated)
- Keep in-memory snapshot for transition detection (Option A)
- Tests are expected for new logic

## 7. Implementation hints

- Create entity in `modules/security/entities/security-event.entity.ts`
- Create `SecurityEventsService` in `modules/security/services/`
- Create `SecurityEventsController` mounted at `events` path
- Inject events service into `SecurityService` to detect transitions after aggregation
- Store last-known active alert IDs + armed/alarm state in memory for diffing
- Cleanup: after inserting new event, delete oldest rows if count > 200

## 8. AI instructions

- Read this file entirely before making code changes
- Keep changes scoped to this task
- For each acceptance criterion, implement or explain why skipped
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`
