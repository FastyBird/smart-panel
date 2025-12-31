# Task: Simple Scene type plugin (apply via Devices)
ID: FEATURE-SCENES-PLUGIN-SIMPLE
Type: feature
Scope: backend
Size: medium
Parent: EPIC-SCENES-PLUGIN-MVP
Status: planned

## 1. Business goal

In order to give users immediate value from Scenes,
As an administrator,
I want a “Simple Scene” type that sets a list of device properties to specific values when applied.

## 2. Context

- Devices module already dispatches commands to integrations.
- We maintain a strict device/channel/property model and permissions.
- Scene config should reference canonical IDs, not embed full entities.

## 3. Scope

**In scope**

- Implement a scene type handler in a plugin package/module, registered in `SceneTypeRegistry`:
  - type: `simple-scene`
- Define plugin config schema (DTO):
  - `actions: Array<{ propertyId: string; value: any }>`
- Validation rules:
  - property exists
  - property is writable / supports set
  - value matches expected data type (best-effort validation)
- Apply behavior:
  - iterate actions and dispatch commands via Devices module/services
  - return ApplyResult:
    - overall status (`success` / `partial` / `failed`)
    - per action: propertyId, status, error message (if any)
- Add unit tests for validation and apply dispatch (mock Devices service).

**Out of scope**

- Atomic transactions across actions
- Conditions, timeouts, waiting
- Snapshot/capture

## 4. Acceptance criteria

- [ ] `simple-scene` handler is discoverable via `GET /scene-types`.
- [ ] Create/update validates action list and rejects invalid properties.
- [ ] Apply triggers Devices command dispatch for each action.
- [ ] Apply returns per-action result details.
- [ ] Unit tests cover at least: valid apply, invalid property, invalid value.

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Partial apply

Given a scene with 3 actions where 1 property is offline/unreachable  
When the scene is applied  
Then the result is `partial`  
And the failing action includes an error message

## 6. Technical constraints

- Follow existing module / service structure in backend.
- Do not introduce new dependencies unless really needed.
- Do not modify generated code.
- Tests are expected for new logic.

## 7. Implementation hints (optional)

- Prefer referencing `propertyId` only; resolve device/channel via repositories/services.
- Use the same command path that panel uses for interactive device control to avoid duplication.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
