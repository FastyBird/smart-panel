# Task: Energy optimisation suggestions

ID: FEATURE-BUDDY-PROACTIVE-ENERGY
Type: feature
Scope: backend
Size: small
Parent: EPIC-BUDDY-MODULE
Status: planned

## 1. Business goal

In order to optimise my home energy usage,
As a home operator,
I want the buddy to suggest actions when there's excess solar production, high consumption, or other energy-related opportunities.

## 2. Context

- Depends on FEATURE-BUDDY-PROACTIVE-HEARTBEAT.
- Implements `HeartbeatEvaluator` interface.
- Uses energy data from `BuddyContext.energy` (solar production, grid consumption, battery level).
- Only active when the energy module is enabled and returning data.

## 3. Scope

**In scope**

- `EnergyEvaluator` implementing `HeartbeatEvaluator`:
  - Excess solar: solar production > grid consumption + 1kW → suggest high-load activities
  - High consumption: grid draw > configurable threshold → suggest reducing load
  - Battery low: battery < 20% + no solar → suggest conservation
- Suggestion types: `ENERGY_EXCESS_SOLAR`, `ENERGY_HIGH_CONSUMPTION`, `ENERGY_BATTERY_LOW`

**Out of scope**

- Historical energy analysis
- Tariff-aware suggestions (time-of-use pricing)
- Device-specific energy attribution

## 4. Acceptance criteria

- [ ] `EnergyEvaluator` implements `HeartbeatEvaluator` and registers with heartbeat service
- [ ] Detects excess solar (production - consumption > 1kW threshold)
- [ ] Detects high consumption (grid draw > threshold, default 5kW)
- [ ] Detects low battery (< 20% with no solar production)
- [ ] Gracefully returns empty results when energy module has no data
- [ ] Thresholds configurable via buddy config
- [ ] Unit tests cover all three energy rules

## 5. Example scenarios

### Scenario: Excess solar

Given solar production is 4.5kW and grid consumption is 2kW
When the heartbeat evaluates energy
Then a suggestion: "Excess solar energy (2.5kW available). Good time for high-load appliances."

## 6. Technical constraints

- Energy data comes from `BuddyContext.energy` — do not import energy module directly, use the context
- Must handle null energy data (module disabled or no data) without errors

## 7. Implementation hints

- Simple threshold comparisons — keep it under 50 lines of evaluator logic
- Follow `AnomalyDetectorEvaluator` registration pattern

## 8. AI instructions

- Read this file entirely before making any code changes.
- Keep changes scoped to backend only.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
