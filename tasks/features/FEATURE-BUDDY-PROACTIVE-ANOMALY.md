# Task: Anomaly detection evaluator

ID: FEATURE-BUDDY-PROACTIVE-ANOMALY
Type: feature
Scope: backend
Size: medium
Parent: EPIC-BUDDY-MODULE
Status: planned

## 1. Business goal

In order to catch unusual or potentially problematic device behavior,
As a home operator,
I want the buddy to detect sensor anomalies (temperature drift, stuck sensors, unusual activity patterns) and alert me.

## 2. Context

- Depends on FEATURE-BUDDY-PROACTIVE-HEARTBEAT.
- Implements the `HeartbeatEvaluator` interface.
- Uses device property values from `BuddyContext` to detect anomalies.
- Rule-based detection (no ML) — simple thresholds and delta calculations.

## 3. Scope

**In scope**

- `AnomalyDetectorEvaluator` implementing `HeartbeatEvaluator`:
  - Temperature drift: sensor reading deviates > 5°C from setpoint for > 30 min
  - Stuck sensor: same value for > 2 hours when device is online
  - Unusual activity: light toggled > 10 times in 15 minutes
- Registers with `HeartbeatService` on module init
- Creates `ANOMALY_SENSOR_DRIFT`, `ANOMALY_STUCK_SENSOR`, `ANOMALY_UNUSUAL_ACTIVITY` suggestion types

**Out of scope**

- ML-based anomaly detection
- Historical baseline building
- Alert escalation

## 4. Acceptance criteria

- [ ] `AnomalyDetectorEvaluator` implements `HeartbeatEvaluator` interface
- [ ] Detects temperature drift: temperature sensor > 5°C from thermostat setpoint in same space
- [ ] Detects stuck sensor: property value unchanged for > 2 hours (configurable)
- [ ] Detects unusual activity: intent count > threshold in time window for same device
- [ ] Each anomaly generates a suggestion with descriptive title and reason
- [ ] Anomaly thresholds are configurable via buddy config
- [ ] Unit tests cover all three anomaly types + edge cases

## 5. Example scenarios

### Scenario: Temperature drift

Given the bedroom thermostat is set to 22°C
And the temperature sensor reads 28°C for 35 minutes
When the heartbeat evaluates the bedroom
Then a suggestion is created: "Bedroom temperature (28°C) is significantly above setpoint (22°C). Check the thermostat or window."

## 6. Technical constraints

- Rule-based only — no external ML services
- Must not store persistent state (use heartbeat cycle context only, plus intent history from action observer)
- Thresholds should be sensible defaults but configurable

## 7. Implementation hints

- Temperature drift: compare sensor `PropertyCategory.TEMPERATURE` value against thermostat `PropertyCategory.TARGET_TEMPERATURE` in same space
- Stuck sensor: requires tracking previous values across heartbeat cycles — use a simple `Map<propertyId, { value, since }>` in the evaluator
- Unusual activity: use `ActionObserverService.getRecentActions()` filtered by device + time window

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to backend only.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
