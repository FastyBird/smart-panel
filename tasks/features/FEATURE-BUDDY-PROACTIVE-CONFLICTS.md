# Task: Conflict detection rules

ID: FEATURE-BUDDY-PROACTIVE-CONFLICTS
Type: feature
Scope: backend
Size: small
Parent: EPIC-BUDDY-MODULE
Status: done

## 1. Business goal

In order to avoid wasting energy and conflicting device settings,
As a home operator,
I want the buddy to detect when devices are working against each other and suggest resolutions.

## 2. Context

- Depends on FEATURE-BUDDY-PROACTIVE-HEARTBEAT.
- Implements `HeartbeatEvaluator` interface.
- Analyses device states within a space to find logical conflicts.

## 3. Scope

**In scope**

- `ConflictDetectorEvaluator` implementing `HeartbeatEvaluator`:
  - Heating + open window: thermostat/heater active + window/door contact sensor open in same space
  - AC + open window: cooler/AC active + window contact sensor open in same space
  - Lights on in unoccupied room: lights on + occupancy sensor shows unoccupied for > 15 min
- Suggestion types: `CONFLICT_HEATING_WINDOW`, `CONFLICT_AC_WINDOW`, `CONFLICT_LIGHTS_UNOCCUPIED`

**Out of scope**

- Cross-space conflict detection
- Automated conflict resolution (buddy only suggests, doesn't act)

## 4. Acceptance criteria

- [x] `ConflictDetectorEvaluator` implements `HeartbeatEvaluator` and registers with heartbeat
- [x] Detects heating + open window conflict
- [x] Detects AC + open window conflict
- [x] Detects lights on in unoccupied room (occupancy sensor inactive for > configurable duration)
- [x] Each conflict generates a suggestion with clear description of the issue and suggested resolution
- [x] Unit tests for each conflict type

## 5. Example scenarios

### Scenario: Heating with open window

Given the living room heater is active (setpoint 24°C)
And the living room window contact sensor shows "open"
When the heartbeat evaluates
Then a suggestion: "Living room window is open but heating is active (24°C). Close the window or lower the setpoint?"

## 6. Technical constraints

- Device state comes from `BuddyContext.devices` — analyse channel categories and property values
- Must correlate devices within the same space
- Window/door detection: `ChannelCategory.CONTACT` with `PropertyCategory.DETECTED` or similar

## 7. Implementation hints

- For each space in context: find heating devices, find contact sensors, check for conflicts
- Use `DeviceCategory` and `ChannelCategory` enums from the devices module constants
- Keep evaluator logic straightforward — one method per conflict type

## 8. AI instructions

- Read this file entirely before making any code changes.
- Keep changes scoped to backend only.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
