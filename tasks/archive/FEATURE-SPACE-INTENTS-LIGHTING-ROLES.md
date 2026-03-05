# Task: Upgrade Space lighting intents to use roles (main/task/ambient) for mode orchestration
ID: FEATURE-SPACE-INTENTS-LIGHTING-ROLES
Type: feature
Scope: backend, panel
Size: medium
Parent: FEATURE-SPACE-LIGHTING-ROLES
Status: done

## 1. Business goal

In order to make lighting intents feel context-aware and reduce “everything turns on” behavior,
As a wall panel user,
I want Work/Relax/Night intents to affect different subsets of lights based on their assigned roles.

## 2. Context

- Lighting roles can be configured per Space (main/task/ambient/accent/night).
- Current MVP lighting intent service applies intents to all lights in a space.
- The strict device spec provides consistent capabilities (`on`, optional `brightness`).

Constraints:
- Must remain deterministic and safe.
- Must preserve behavior if roles are missing (fallback to MVP behavior).

## 3. Scope

**In scope**

Backend:
- Update lighting intent orchestration rules to use roles:
  - `work`:
    - main=ON (high brightness if supported)
    - task=ON (high brightness if supported)
    - ambient/accent=OFF or low (choose deterministic rule; document it)
  - `relax`:
    - main=ON (medium)
    - ambient=ON (medium/low)
    - task=OFF (or low)
  - `night`:
    - night=ON (very low) OR main=ON low if no night lights exist
    - all others=OFF
- Brightness delta should apply to “active set” for the current mode (or to all ON lights); pick one and document.
- Add logging/telemetry for selected devices per execution (spaceId, intent, chosen targets).

Panel:
- No major UI changes required.
- If feasible, show a brief “applied to X lights” confirmation (optional).

**Out of scope**

- Color temperature / color orchestration by role.
- Per-device exclusions, schedules, or scenes.
- Learning/personalization.

## 4. Acceptance criteria

- [x] Work/Relax/Night intents select lights based on roles, per the documented rules.
- [x] If no roles are configured, behavior matches the previous MVP (no regression).
- [x] If some roles are missing (partial config), system still behaves sensibly and deterministically.
- [x] Brightness delta is safe: no-op for non-dimmable lights.
- [x] Unit tests cover:
  - all three modes with full role configuration
  - partial role configuration
  - no role configuration fallback

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Relax mode uses ambient lights

Given Space "Living room" has lights: A=main, B=ambient, C=task  
When the user taps "Relax"  
Then lights A and B are turned on (medium brightness if supported)  
And light C is turned off (or set low per rule)  
And no error is shown

## 6. Technical constraints

- Follow the existing module / service structure in backend/panel.
- Do not introduce new dependencies unless really needed.
- Do not modify generated code.
- Tests are expected for new logic.

## 7. Implementation hints (optional)

- Implement role-based selection in a pure function to simplify unit tests.
- Keep rule constants (brightness targets, deltas) in one place.
- Consider storing the last applied lighting mode per Space for future features (optional; do not overbuild).

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
