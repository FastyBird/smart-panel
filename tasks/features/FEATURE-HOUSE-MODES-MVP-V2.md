# Task: House Modes page (entry panel) with deterministic actions (v2)
ID: FEATURE-HOUSE-MODES-MVP-V2
Type: feature
Scope: backend, admin, panel
Size: medium
Parent: EPIC-DISPLAY-ROLES-HOUSE-CONTROL-V2
Status: planned

## 1. Business goal

In order to support “leaving/arriving” workflows,
As an entry panel user,
I want to activate house modes (Home/Away/Night) quickly with clear feedback.

## 2. Context

- Entry panels are placed near doors and must be extremely simple.
- House-wide actions should not be modeled as a Space.
- MVP should be useful without any alarm integration.

Constraints:
- Deterministic and safe behavior.
- Avoid global “restore previous state” in MVP.

## 3. Scope

**In scope**

Backend:
- `HouseMode` enum: `home`, `away`, `night`.
- Persist current mode.
- Deterministic actions (best-effort):
  - away:
    - publish `house.mode.changed` event
    - turn off all lights (across all spaces/devices)
  - night:
    - publish `house.mode.changed` event
    - apply night lighting per space when possible; else lights off
  - home:
    - publish `house.mode.changed` event
    - do not restore states (MVP)
- Endpoints:
  - get current house mode
  - set house mode

Admin:
- Create/assign `house_mode` page type.
- Enable/disable modes (config).
- Optional confirmation requirement for Away (default ON).

Panel:
- Render `house_mode` page:
  - big buttons Home/Away/Night
  - active indicator
  - optional Away confirmation dialog
  - optional last-changed timestamp

**Out of scope**
- Schedules/automation
- Alarm/locks UI
- Presence triggers

## 4. Acceptance criteria

- [ ] Modes can be activated from the panel page.
- [ ] Active mode persists across restarts.
- [ ] Away turns off all lights best-effort.
- [ ] Night applies night intent when possible; else off.
- [ ] Home sets mode without global restore.
- [ ] Unit tests cover transitions, persistence, and action dispatch (mocked).

## 6. Technical constraints

- Keep house mode logic separate from Spaces domain.
- Do not introduce new dependencies unless needed.
- Do not modify generated code.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
