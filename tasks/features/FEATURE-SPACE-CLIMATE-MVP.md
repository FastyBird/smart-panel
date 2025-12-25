# Task: Add MVP climate section and intents for Space pages (current temp + setpoint deltas)
ID: FEATURE-SPACE-CLIMATE-MVP
Type: feature
Scope: backend, panel, admin
Size: medium
Parent: EPIC-SPACES-FIRST-UX
Status: planned

## 1. Business goal

In order to make Space pages useful beyond lighting,
As a wall panel user,
I want to see the current temperature and adjust the target temperature (setpoint) for the Space with simple +/- controls.

## 2. Context

- SpacePage currently shows sections based on available devices/capabilities (lights exist).
- Devices spec includes sensors and thermostats (assumed present in your device type catalog).
- Users prefer minimal configuration similar to HomeKit: a sensible default thermostat and sensor selection.

Constraints:
- Must support spaces with:
  - temperature sensors only (read-only)
  - thermostat only (read + write setpoint)
  - both sensor and thermostat
- Must remain capability-driven and safe.

## 3. Scope

**In scope**

Backend:
- Extend SpacePage read model generation to include a Climate section when relevant:
  - current temperature (from a temperature sensor OR thermostat if it exposes temperature)
  - target temperature setpoint (from thermostat if available)
- Add Space climate intent endpoint(s):
  - `CLIMATE_SETPOINT_DELTA(delta=+0.5|-0.5)` (or configurable step)
  - optionally `CLIMATE_SETPOINT_SET(value)` if already supported by UI patterns
- Add “primary selection” logic:
  - choose primary thermostat if multiple exist:
    - default: first found deterministically
    - admin override supported (see Admin scope)

Admin UI:
- Add per-space config to select primary thermostat and primary temperature sensor (optional but recommended for MVP robustness):
  - dropdown of candidates in the space
  - can be left unset to use default selection

Panel:
- Render Climate section on SpacePage:
  - show current temperature
  - if setpoint exists: show target temp + +/- controls
  - if no setpoint: read-only climate card

**Out of scope**

- HVAC mode switching (heat/cool/auto/off).
- Scheduling, eco mode, occupancy-based climate.
- Advanced graphs/history.

## 4. Acceptance criteria

- [ ] SpacePage shows Climate section when temperature data exists in the space.
- [ ] If a thermostat exists with setpoint capability, SpacePage allows adjusting setpoint via +/-.
- [ ] If only sensors exist, SpacePage shows read-only temperature.
- [ ] Primary thermostat/sensor selection is deterministic with optional admin override.
- [ ] Backend validates setpoint updates and clamps to safe min/max if available (otherwise basic validation).
- [ ] Unit tests cover:
  - space with sensor only
  - space with thermostat only
  - space with both
  - multiple thermostats selection + admin override

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Adjust target temperature

Given Space "Bedroom" has a thermostat with setpoint 21.0°C  
When the user taps "+"  
Then the backend increases setpoint by 0.5°C  
And the panel updates to show 21.5°C

## 6. Technical constraints

- Follow the existing module / service structure in backend/admin/panel.
- Do not introduce new dependencies unless really needed.
- Do not modify generated code.
- Tests are expected for new logic.

## 7. Implementation hints (optional)

- Reuse existing property write/dispatch logic from Devices module.
- Treat sensor data as “best effort” and ensure the read model generator never throws for missing properties.
- Keep step size configurable at least internally (constant) for now.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
