# Task: Add Climate Section to SpacePage
ID: FEATURE-SPACEPAGE-CLIMATE-SECTION
Type: feature
Scope: backend, panel
Size: medium
Parent: FEATURE-DASHBOARD-SPACE-PAGE
Status: planned

## 1. Business goal

In order to control climate devices from the space page
As a smart panel user
I want to see and control temperature/thermostat devices in the space page climate section

## 2. Context

- Space pages were implemented in FEATURE-DASHBOARD-SPACE-PAGE
- Lighting section is fully functional
- Climate section was deferred to future iteration
- Backend SpacePageReadModelService may need extension for climate data

## 3. Scope

**In scope**

- Backend: Add climate section to SpacePageReadModel
- Backend: Group climate devices (thermostats, temperature sensors) from space
- Panel: Render climate section when climate devices exist
- Panel: Display current temperature reading
- Panel: Setpoint controls for thermostats (if supported)

**Out of scope**

- Complex HVAC modes and schedules
- Historical temperature charts
- Climate intents (separate from lighting intents)

## 4. Acceptance criteria

- [ ] Backend returns climate section in SpacePageReadModel when climate devices exist
- [ ] Climate devices are grouped by type (thermostat, sensor)
- [ ] Panel displays current temperature prominently
- [ ] Panel shows setpoint controls for thermostats with setpoint capability
- [ ] Missing capabilities degrade gracefully (read-only display)
- [ ] Empty state when no climate devices in space
- [ ] Unit tests for climate section logic

## 5. Technical constraints

- Follow existing SpacePage section patterns
- Use existing device control services
- Do not modify generated code

## 6. AI instructions

- Read this file entirely before making any code changes.
- Start with backend changes, then panel implementation.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
