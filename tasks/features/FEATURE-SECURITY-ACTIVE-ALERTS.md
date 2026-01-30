# Task: Security Domain – Expose activeAlerts[] in DTO + endpoint
ID: FEATURE-SECURITY-ACTIVE-ALERTS
Type: feature
Scope: backend
Size: medium
Parent: EPIC-EXPAND-SMART-PANEL-DOMAINS
Status: done

## 1. Business goal

In order to display a structured list of active security alerts on the panel
As a Smart Panel system
I want the security status endpoint to return detailed alert entries alongside summary fields

## 2. Context

- Security module already has provider-based aggregation (`SecurityStateProviderInterface`)
- `SecuritySensorsProvider` and `AlarmSecurityProvider` already compute severity and alert counts
- Currently only `activeAlertsCount` + `lastEvent` are returned — no structured alert list
- Panel overlay and security detail screen need per-alert data (type, severity, source, message)

## 3. Scope

**In scope**

- Introduce `SecurityAlertType` enum and `SecurityAlertModel` (DTO)
- Extend `SecurityStatusModel` to include `activeAlerts: SecurityAlertModel[]`
- Extend `SecuritySignal` to optionally include `activeAlerts`
- Update `SecurityAggregatorService` merge logic: concatenate, de-duplicate by id, compute derived fields from alerts
- Update `SecuritySensorsProvider` to emit `SecurityAlertModel` entries for active sensor conditions
- Update `AlarmSecurityProvider` to emit alerts for exception states (triggered/tampered/fault)
- Add/extend unit tests

**Out of scope**

- Persistence/history of alerts
- Acknowledge flow / mutations
- UI overlay implementation
- Alarm arming-based escalation

## 4. Acceptance criteria

- [x] `SecurityAlertModel` exists with id, type, severity, timestamp, acknowledged, sourceDeviceId, sourceChannelId, sourcePropertyId, message
- [x] `SecurityStatusModel` includes `activeAlerts: SecurityAlertModel[]`
- [x] `activeAlertsCount === activeAlerts.length` always holds
- [x] `highestSeverity` / `hasCriticalAlert` / `lastEvent` derived from alerts when present
- [x] `SecuritySensorsProvider` emits alert entries with deterministic IDs (`sensor:<deviceId>:<type>`)
- [x] `AlarmSecurityProvider` emits alerts for triggered/tampered/fault states (`alarm:<deviceId>:<type>`)
- [x] Aggregator de-duplicates alerts by id (newest timestamp wins)
- [x] Providers never throw; return empty/fallback on errors
- [x] Tests cover aggregation, de-duplication, derived fields, and deterministic IDs

## 5. Example scenarios

### Scenario: Smoke sensor triggered

Given a sensor device with smoke channel detected=true
When the security status is requested
Then activeAlerts includes an entry with type=smoke, severity=critical, id=sensor:<deviceId>:smoke

### Scenario: Alarm triggered + sensor active

Given an alarm device in triggered state and a smoke sensor active
When the security status is requested
Then activeAlerts contains both entries, highestSeverity=critical, activeAlertsCount=2

### Scenario: No alerts

Given no active conditions on any device
When the security status is requested
Then activeAlerts is an empty array, activeAlertsCount=0

## 6. Technical constraints

- Follow existing security module provider pattern
- Use deterministic alert IDs to prevent flicker across refreshes
- Do not introduce new dependencies
- Tests are expected for new logic
- Do not modify generated code

## 7. Implementation hints

- Alert ID format: `sensor:<deviceId>:<type>` or `alarm:<deviceId>:<type>`
- `acknowledged` is always `false` for MVP
- Aggregator should compute derived fields from merged alerts when alerts exist, fall back to provider-level fields otherwise
- De-duplicate by id: newest timestamp wins

## 8. AI instructions

- Read this file entirely before making any code changes.
- Keep changes scoped to this task and its Scope.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
