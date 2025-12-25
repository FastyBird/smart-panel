# Task: Add lighting roles per Space (main/task/ambient) and admin assignment UI
ID: FEATURE-SPACE-LIGHTING-ROLES
Type: feature
Scope: backend, admin
Size: medium
Parent: EPIC-SPACES-FIRST-UX
Status: planned

## 1. Business goal

In order to make space-first lighting feel “smart” and consistent,
As an administrator,
I want to assign lighting roles (main/task/ambient/accent/night) to lights within a Space so that Space intents can target them appropriately.

## 2. Context

- Spaces are first-class domain objects and Devices/Displays can be linked to a Space.
- SpacePage exists and provides basic lighting intent controls (On/Off, Work/Relax/Night, Brightness +/-).
- Current lighting intents are MVP and may apply to all lights in a Space.
- Devices use a strict spec (lights require `on`, optional `brightness`, `colorTemp`, `color`).

Constraints / legacy behavior:
- Must preserve existing behavior when roles are not configured (fallback to “apply to all” or a deterministic default).
- Keep the model plugin-friendly (integrations may propose roles in the future).

## 3. Scope

**In scope**

Backend:
- Extend Space assignment model to support lighting roles for controllable targets (device or channel):
  - `domain=light`
  - `role` enum: `main`, `task`, `ambient`, `accent`, `night`, `other`
  - optional `priority` (integer) for selecting defaults
- Provide APIs to:
  - list assignable light targets in a Space
  - set/update role per target
  - bulk update roles (optional but recommended)
- Include role information in SpacePage read model (lights section) for later orchestration logic.

Admin UI:
- Add a “Lighting roles” configuration view per Space:
  - list lights detected in the Space
  - role dropdown per item
  - optional priority ordering (if implemented)
- Allow quick defaults:
  - first light → main
  - remaining → ambient (optional UI shortcut)

**Out of scope**

- Changing lighting intent orchestration behavior (handled in a separate task).
- Role definitions for non-light domains (climate/covers/media).

## 4. Acceptance criteria

- [ ] Backend stores lighting role per controllable target in a Space.
- [ ] Admin UI allows assigning/changing lighting roles for lights in a Space.
- [ ] If no roles are set, the system behaves as before (no regression).
- [ ] SpacePage read model includes role metadata for the lights section.
- [ ] Unit tests cover:
  - role assignment persistence and retrieval
  - role enum validation
  - fallback behavior when roles are missing

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Assign roles to lights in a space

Given Space "Living room" contains 3 lights  
When the admin sets roles: Light A=main, Light B=ambient, Light C=task  
Then the backend stores these roles  
And the Admin UI reflects the assignments  
And the SpacePage read model exposes the role metadata

## 6. Technical constraints

- Follow the existing module / service structure in backend/admin.
- Do not introduce new dependencies unless really needed.
- Do not modify generated code.
- Tests are expected for new logic.

## 7. Implementation hints (optional)

- Prefer storing roles on the existing Space assignment entity/table if it already exists; otherwise introduce a small extension table keyed by (spaceId, targetId).
- Keep enums centrally defined and reusable by future policy/intents.
- Add a backend defaulting function (e.g., `inferDefaultLightingRoles`) that can be invoked by UI “quick defaults”.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
