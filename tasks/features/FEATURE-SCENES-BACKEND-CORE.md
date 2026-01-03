# Task: Scenes backend module (core CRUD + apply)

ID: FEATURE-SCENES-BACKEND-CORE
Type: feature
Scope: backend
Size: medium
Parent: EPIC-SCENES-MVP
Status: done

## 1. Business goal

In order to define room-level scenes and execute them reliably,
As an administrator,
I want a backend Scenes module with CRUD and an “apply scene” endpoint.

## 2. Context

- Spaces module provides Rooms and Zones. For MVP, scenes are Room-scoped.
- Devices module already manages device/channel/property and command dispatch to integrations.
- Use existing validation + DTO patterns (class-validator / class-transformer).

## 3. Scope

**In scope**

- Create `ScenesModule` in backend with:
  - Entity/model(s) for `Scene` and `SceneAction` (or similar)
  - Repositories/services for CRUD
  - Controllers/routes under `/api/...` following existing conventions
- Room-scoping:
  - `Scene.spaceId` must reference a Space of type `room`
- Apply endpoint:
  - `POST /scenes/{id}/apply`
  - Validates all actions and dispatches commands via Devices module
  - Returns a structured response (success + per-action status)

**Out of scope**

- Zone/house scenes
- Scheduling/automation
- Transitions/fades

## 4. Acceptance criteria

- [x] Scene persistence includes: id, name, description?, icon?, order, spaceId (room), enabled?
- [x] Scene actions support: deviceId, channelId (optional if resolvable), propertyId, value (typed)
- [x] Backend validates:
  - space exists and is type room
  - referenced device/property exist
  - value type matches property spec (best-effort)
- [x] Apply endpoint dispatches commands using existing Devices services
- [x] Errors are returned with consistent API error format

## 5. Example scenarios

### Scenario: Invalid scene references a non-room space
Given a Zone space
When user creates/updates a Scene with that spaceId
Then API returns 400 validation error

## 6. Technical constraints

- Follow existing module/service structure.
- Do not introduce new dependencies.
- Do not modify generated code.
- Tests are expected for new logic.

## 7. Implementation hints

- Mirror patterns used in Spaces/Dashboard modules for CRUD.
- Prefer transactional behavior for create/update (if existing patterns support it).
- Apply endpoint should:
  - validate first
  - then dispatch commands
  - collect per-action results

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to backend.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
