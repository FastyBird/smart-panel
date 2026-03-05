# Task: Security Domain – Alarm Provider (map alarm device → SecuritySignal)
ID: FEATURE-SECURITY-ALARM-PROVIDER
Type: feature
Scope: backend
Size: medium
Parent: EPIC-EXPAND-SMART-PANEL-DOMAINS
Status: done

## 1. Business goal

In order to provide meaningful security status based on actual alarm devices
As a Smart Panel system
I want to map alarm device properties into SecuritySignal for the security domain aggregator

## 2. Context

- Security module already supports provider-based aggregation (`SecurityStateProviderInterface`)
- `DefaultSecurityProvider` exists as a fallback with safe defaults
- Devices module provides `DevicesService.findAll()` to discover devices by category
- Channel properties include `value: PropertyValueState` for reading current values
- Alarm devices use `DeviceCategory.ALARM` and `ChannelCategory.ALARM`

## 3. Scope

**In scope**

- Create `AlarmSecurityProvider` implementing `SecurityStateProviderInterface`
- Query device/channel/property values using existing backend services
- Map alarm properties: state → armedState, alarm_state/triggered → alarmState, severity, lastEvent
- Register provider in `SecurityModule` via the `SECURITY_STATE_PROVIDERS` DI token
- Add unit tests for mapping logic

**Out of scope**

- Sensors aggregation (doors/windows/motion/etc.)
- Alert list (`active_alerts[]`) aggregation
- UI overlay logic
- PIN/auth flows
- History storage

## 4. Acceptance criteria

- [x] `AlarmSecurityProvider` implements `SecurityStateProviderInterface` with `getKey() = "alarm"`
- [x] Provider discovers alarm devices and maps properties into `SecuritySignal`
- [x] `armedState` mapped from property `state` if available, else `null`
- [x] `alarmState` prefers `alarm_state` property over `triggered` boolean
- [x] `highestSeverity` is `critical` when triggered/tampered, `warning` when fault>0 or active=false
- [x] Multiple alarm devices: triggered dominates, severity is max across alarms
- [x] Provider never throws; returns empty signal on errors
- [x] Provider registered and invoked by aggregator
- [x] `/api/security/status` reflects alarm device state
- [x] Unit tests cover mapping edge cases

## 5. Example scenarios

### Scenario: Single alarm device armed away, idle

Given an alarm device with state=armed_away, alarm_state=idle
When the security status is requested
Then armedState=armed_away, alarmState=idle, highestSeverity=info

### Scenario: Alarm triggered

Given an alarm device with alarm_state=triggered
When the security status is requested
Then alarmState=triggered, highestSeverity=critical, hasCriticalAlert=true

### Scenario: No alarm devices

Given no alarm devices exist
When the security status is requested
Then AlarmSecurityProvider returns an empty signal (no forced defaults)

## 6. Technical constraints

- Follow existing security module provider pattern (`DefaultSecurityProvider`)
- Use `DevicesService` from devices module to discover alarm devices
- Do not introduce new dependencies unless really needed
- Tests are expected for new logic

## 7. Implementation hints

- Use `DevicesService.findAll()` and filter by `DeviceCategory.ALARM`
- Access alarm channels via `device.channels` filtered by `ChannelCategory.ALARM`
- Read property values from `ChannelPropertyEntity.value.value`
- Property categories: `STATE`, `ALARM_STATE`, `TRIGGERED`, `TAMPERED`, `ACTIVE`, `FAULT`, `LAST_EVENT`
- Sort devices by ID for deterministic ordering

## 8. AI instructions

- Read this file entirely before making any code changes.
- Keep changes scoped to this task and its Scope.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
