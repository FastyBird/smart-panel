# Task: Core Scenes module skeleton + type registry
ID: FEATURE-SCENES-CORE-REGISTRY
Type: feature
Scope: backend
Size: medium
Parent: EPIC-SCENES-PLUGIN-MVP
Status: planned

## 1. Business goal

In order to support multiple Scene implementations without core migrations,
As a platform developer,
I want a core Scenes module that stores Scenes generically and delegates apply/validation to scene-type handlers via a registry.

## 2. Context

- Core modules typically provide persistence + orchestration; plugins provide behavior.
- We want `Scene.type` and `Scene.config` (JSON) to be plugin-defined.
- Scenes are room-scoped for MVP.

## 3. Scope

**In scope**

- Add `scenes` module to backend:
  - `SceneEntity` with fields:
    - id, name, description?, icon?, order?
    - enabled (default true)
    - `type` (string or enum-like)
    - `config` (JSON)
    - `spaceId` (required) and `scopeType` (fixed = `room` for MVP, or implicit)
    - createdAt/updatedAt
- Add `SceneTypeHandler` contract:
  - `getType(): string`
  - `validateConfig(dto/config): ValidationResult | throws`
  - `apply(scene, context): ApplyResult`
  - (optional) `getAdminSchema()` for future UI schema
- Add `SceneTypeRegistry`:
  - register handlers (from plugins)
  - resolve handler by type
  - throw controlled error if type unknown
- Add service: `ScenesService` (CRUD) and `ScenesApplyService`:
  - `apply(sceneId, requestedBy)` loads Scene and delegates to handler
- Add API:
  - `GET /scenes` with filters: `spaceId`, `type`, pagination
  - `POST /scenes`
  - `GET /scenes/:id`
  - `PATCH /scenes/:id`
  - `DELETE /scenes/:id`
  - `POST /scenes/:id/apply`
  - `GET /scene-types` returns registered types + minimal metadata (name/description)
- Server-side validation:
  - `spaceId` must exist and reference `Space.type = room`
  - unknown scene `type` is rejected on create/update and on apply

**Out of scope**

- Any scene type implementation logic (handled by plugins)
- Automations/conditions

## 4. Acceptance criteria

- [ ] Scene entity exists with `type` and `config` JSON and `spaceId` binding.
- [ ] SceneTypeHandler contract + registry exist and are used by apply.
- [ ] CRUD + apply endpoints exist and are wired into OpenAPI.
- [ ] `GET /scene-types` lists registered scene types.
- [ ] Validation rejects non-room spaces.
- [ ] Unit tests cover registry resolution + unknown type behavior + apply delegation.

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Unknown scene type rejected

Given a request creates a scene with type "foo"  
When POST /scenes is called  
Then API responds with 400 and message "Unknown scene type"

## 6. Technical constraints

- Follow the existing module / service structure in backend.
- Do not introduce new dependencies unless really needed.
- Do not modify generated code.
- Tests are expected for new logic.

## 7. Implementation hints (optional)

- Use NestJS DI to auto-register handlers from plugins (providers + registry `register()` in module init).
- Reuse existing error/exception patterns in the codebase.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
