# Task: MVP intent-based lighting for Space pages (modes + brightness deltas)
ID: FEATURE-SPACE-INTENTS-LIGHTING-MVP
Type: feature
Scope: backend, panel
Size: medium
Parent: FEATURE-DASHBOARD-SPACE-PAGE
Status: completed

## 1. Business goal

In order to provide a differentiated "room experience" instead of a list of buttons,
As a wall panel user,
I want to set lighting intent for a Space (e.g., Work/Relax/Night) and adjust brightness without needing to understand individual devices.

## 2. Context

- Space pages exist and can show a Lights section.
- Devices use a strict capability/property spec:
  - `on` is required for lights
  - optional: `brightness`, `colorTemp`, `color`
- We want a safe MVP with deterministic behavior and minimal configuration.

Constraints:
- Must not break existing per-device control logic.
- Must work even if a space has only a single light device.
- Must handle partial capability support (e.g., on/off only).

## 3. Scope

**In scope**

Backend:
- Implement a `SpaceIntentService` (or equivalent) for lighting intents:
  - `LIGHTING_OFF`
  - `LIGHTING_ON`
  - `LIGHTING_SET_MODE(mode=work|relax|night)`
  - `LIGHTING_BRIGHTNESS_DELTA(delta=small|medium|large)`
- Selection rules (MVP):
  - apply to all lights in the space (no roles yet)
  - if brightness is supported, apply delta; otherwise ignore brightness delta safely
  - modes can map to:
    - work: on + brightness high (if supported)
    - relax: on + brightness medium (if supported)
    - night: on + brightness low OR only some lights if “night” tagging exists (skip for MVP unless already available)
- Expose an API endpoint to trigger space lighting intent commands.

Panel:
- Update SpacePage Lights section to include:
  - Off / On
  - Mode buttons: Work / Relax / Night
  - Brightness +/- (delta steps)

**Out of scope**

- Role-based selection (main/task/ambient) and per-device exclusions.
- Color temperature and color orchestration.
- Scenes integration.

## 4. Acceptance criteria

- [x] Backend provides a stable API to trigger lighting intents for a space.
- [x] Backend applies commands only to devices in the target space.
- [x] Brightness delta is applied only when supported; otherwise no-op.
- [x] Panel provides the intent controls in SpacePage Lights section.
- [x] System is deterministic and safe: no unhandled exceptions if a space has no lights.
- [x] Unit tests for backend intent service covering:
  - [x] no lights in space
  - [x] on/off only lights
  - [x] dimmable lights

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Set Relax mode in living room

Given Space "Living room" contains 3 lights, two dimmable and one on/off only  
When the user taps "Relax" on the Living room Space page  
Then all 3 lights are turned on  
And the two dimmable lights are set to medium brightness  
And the on/off light remains simply on  
And no error is shown

## 6. Technical constraints

- Follow existing module / service structure in backend/panel.
- Do not introduce new dependencies unless really needed.
- Do not modify generated code.
- Tests are expected for new logic.
- Keep the MVP simple and capability-driven.

## 7. Implementation hints (optional)

- Reuse existing command dispatch in Devices module; intent service should translate intent → per-device property commands.
- Represent deltas as explicit percentage steps (e.g., 10/20/30) and clamp to [0..100].
- Log intent executions with enough context for debugging (spaceId, selected devices).

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
