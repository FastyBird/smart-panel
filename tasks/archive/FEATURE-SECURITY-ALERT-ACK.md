# Task: Security Domain – Alert acknowledge API + persistence
ID: FEATURE-SECURITY-ALERT-ACK
Type: feature
Scope: backend
Size: medium
Parent: EPIC-EXPAND-SMART-PANEL-DOMAINS
Status: done

## 1. Business goal

In order to persist alert acknowledgements across sessions and keep multiple clients consistent
As a Smart Panel system
I want server-side API endpoints to acknowledge security alerts with lightweight persistence

## 2. Context

- Security module already has provider-based aggregation with `activeAlerts[]` in `SecurityStatusModel`
- Alerts have deterministic IDs (`sensor:<deviceId>:<type>`, `alarm:<deviceId>:<type>`)
- Currently `acknowledged` is always `false` — no persistence or mutation endpoint exists
- Panel and admin need to call a simple API to acknowledge one or more alerts

## 3. Scope

**In scope**

- Entity/table `security_alert_ack` to persist acknowledgement state per alert ID
- PATCH endpoint to acknowledge a single alert by ID
- PATCH endpoint to acknowledge all currently active alerts
- Integration into aggregation pipeline: load ack records, apply to `activeAlerts[]`
- Reset `acknowledged=false` when alert timestamp increases (new event instance)
- Cleanup of stale ack records for inactive alerts
- Unit tests

**Out of scope**

- Full event history / timeline
- Per-user acknowledgements (MVP = global ack)
- Snooze timers, escalation policies
- Zone configuration
- Audit logging

## 4. Acceptance criteria

- [x] `SecurityAlertAckEntity` exists with fields: id (string PK), acknowledged, acknowledgedAt, lastEventAt, updatedAt
- [x] `PATCH /api/v1/modules/security/alerts/:id/ack` acknowledges a single alert
- [x] `PATCH /api/v1/modules/security/alerts/ack` acknowledges all currently active alerts
- [x] `/api/v1/modules/security/status` reflects `acknowledged=true` for acknowledged alerts
- [x] Ack resets to `false` when alert reappears with a newer timestamp than stored `lastEventAt`
- [x] Stale ack records (alerts no longer active) are cleaned up
- [x] Tests cover: single ack, ack-all, timestamp reset, status reflection, cleanup

## 5. Example scenarios

### Scenario: Acknowledge single alert

Given a smoke sensor alert is active with acknowledged=false
When PATCH /api/v1/modules/security/alerts/sensor:dev1:smoke/ack is called
Then the alert shows acknowledged=true in subsequent /api/security/status

### Scenario: Ack resets on new event

Given alert sensor:dev1:smoke was acknowledged at T1
When the sensor triggers again at T2 > T1
Then acknowledged resets to false

### Scenario: Acknowledge all

Given 3 active alerts
When PATCH /api/v1/modules/security/alerts/ack is called
Then all 3 alerts show acknowledged=true

## 6. Technical constraints

- Follow existing security module structure
- Use TypeORM entity with SQLite compatibility
- Do not introduce new dependencies
- Alert IDs are strings (not UUIDs) — use string PK, not auto-generated UUID
- Fetch ack records in a single query by list of IDs for efficiency
- Tests are expected for new logic

## 7. Implementation hints

- Create entity in `modules/security/entities/`
- Create `SecurityAlertAckService` in `modules/security/services/`
- Create `SecurityAlertsController` mounted at `alerts` path
- Inject ack service into `SecurityService` to apply ack state after aggregation
- For cleanup: delete ack records whose IDs are not in the current active alerts list
- Use `In()` operator from TypeORM for batch queries

## 8. AI instructions

- Read this file entirely before making any code changes.
- Keep changes scoped to this task and its Scope.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
