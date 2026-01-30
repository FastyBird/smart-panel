# Task: Security domain — Sensor alerts provider
ID: FEATURE-SECURITY-SENSORS-PROVIDER
Type: feature
Scope: backend
Size: medium
Parent: (none)
Status: in-progress

## 1. Business goal

In order to surface real-time security alerts on the Smart Panel display
As a home owner
I want the Security module to scan security-relevant sensor devices and produce active alerts with severity information

## 2. Context

- The Security module (`apps/backend/src/modules/security/`) uses a provider-based aggregation architecture.
- `SecurityStateProviderInterface` defines `getKey()` and `getSignals()`.
- `SecurityAggregatorService` merges signals from all registered providers.
- `DefaultSecurityProvider` exists as a baseline (no alerts, INFO severity).
- Devices module provides `DevicesService.findAll()` to retrieve all devices with channels and properties.
- Sensor devices use `DeviceCategory.SENSOR` with channel categories: `CONTACT`, `MOTION`, `SMOKE`, `GAS`, `LEAK`, `OCCUPANCY`, `CARBON_MONOXIDE`.
- The `PropertyCategory.DETECTED` boolean property indicates alert state on sensor channels.

## 3. Scope

**In scope**

- Create `SecuritySensorsProvider` implementing `SecurityStateProviderInterface`
- Map sensor channel categories to alert types with severity levels
- Derive `highestSeverity`, `activeAlertsCount`, `hasCriticalAlert`, `lastEvent`
- Register provider in `SecurityModule` via `SECURITY_STATE_PROVIDERS` token
- Add unit tests covering all mapping rules and edge cases

**Out of scope**

- Full event history / persistence
- UI overlay implementation
- Arming-based escalation logic (e.g., ignore motion when disarmed)
- Zone editor
- Camera/video support
- Changes to SecurityStatusDto

## 4. Acceptance criteria

- [ ] `SecuritySensorsProvider` registered and invoked by aggregator
- [ ] Provider maps smoke/CO/leak channels to critical severity
- [ ] Provider maps motion to warning severity
- [ ] Provider maps contact (door/window) to info severity
- [ ] `highestSeverity` reflects max across all active alerts
- [ ] `activeAlertsCount` sums all active alerts
- [ ] `hasCriticalAlert` is true when any critical alert exists
- [ ] `lastEvent` selects newest/highest severity alert deterministically
- [ ] Provider never throws; returns empty signal on error
- [ ] `/api/security/status` reflects sensor-driven severity/count
- [ ] Unit tests cover all mapping rules, determinism, and empty-device case

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Smoke sensor triggers critical alert

Given a sensor device with a smoke channel where detected = true
When the security status is aggregated
Then activeAlertsCount includes 1 and highestSeverity is "critical"

### Scenario: No active sensors

Given no sensor devices exist
When the security status is aggregated
Then the sensor provider contributes 0 alerts with INFO severity

### Scenario: Multiple active sensors

Given a smoke sensor (critical) and a motion sensor (warning) are active
When the security status is aggregated
Then activeAlertsCount is 2, highestSeverity is "critical", and lastEvent reflects the smoke alert

## 6. Technical constraints

- Follow the existing provider pattern in `apps/backend/src/modules/security/providers/`
- Do not introduce new dependencies unless really needed
- Do not modify generated code
- Tests are expected for new logic
- Provider must be deterministic and never throw exceptions

## 7. Implementation hints (optional)

- Use `DevicesService.findAll()` to get all devices, filter by `DeviceCategory.SENSOR`
- For each device, scan channels for security-relevant categories (SMOKE, CONTACT, MOTION, LEAK, GAS, CARBON_MONOXIDE, OCCUPANCY)
- Check `PropertyCategory.DETECTED` property value on each channel
- Use severity ranking: SMOKE/CO/LEAK/GAS → critical, MOTION/OCCUPANCY → warning, CONTACT → info
- Sort alerts by severity desc then device ID for deterministic lastEvent fallback

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
