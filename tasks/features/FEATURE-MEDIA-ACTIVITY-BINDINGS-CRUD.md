# Task: Media Domain – Per-Space Activity Bindings + CRUD API
ID: FEATURE-MEDIA-ACTIVITY-BINDINGS-CRUD
Type: feature
Scope: backend
Size: medium
Parent: FEATURE-SPACE-MEDIA-DOMAIN-V2
Status: in-progress

## 1. Business goal

In order to let the Admin app configure which media endpoints are used for each activity
As a system integrator
I want a persistent per-space mapping of activities (Watch / Listen / Gaming / Background / Off) to concrete derived endpoint IDs with optional overrides.

## 2. Context

- The media domain already has `SpaceMediaEndpointEntity` (persisted) and `DerivedMediaEndpointService` (read model).
- Derived endpoints have deterministic string IDs: `${spaceId}:${type}:${deviceId}`.
- `SpaceMediaRoutingEntity` already exists for routing configurations referencing persisted endpoint UUIDs.
- This task introduces activity bindings that reference **derived endpoint IDs** (strings, not UUIDs).
- Validation uses `DerivedMediaEndpointService.buildEndpointsForSpace()` to check endpoint existence and type.

## 3. Scope

**In scope**

- `SpaceMediaActivityBindingEntity` – DB entity with `(spaceId, activityKey)` unique constraint
- CRUD API: GET list, GET one, POST create, PATCH update, DELETE
- Server-side validation of endpoint IDs against derived endpoints
- Validation of override fields against endpoint capabilities
- `POST /spaces/:spaceId/media/bindings/apply-defaults` – auto-create missing bindings
- DTOs, response models, Swagger documentation

**Out of scope**

- Routing activation/execution (MVP #3)
- Admin UI for binding management
- Panel app integration

## 4. Acceptance criteria

- [ ] `SpaceMediaActivityBindingEntity` persists bindings with `(spaceId, activityKey)` unique constraint
- [ ] Activity keys: `watch`, `listen`, `gaming`, `background`, `off`
- [ ] Slots store derived endpoint IDs (strings): `displayEndpointId`, `audioEndpointId`, `sourceEndpointId`, `remoteEndpointId`
- [ ] Overrides: `displayInputId` (string), `audioVolumePreset` (0..100)
- [ ] `GET /spaces/:spaceId/media/bindings` returns all bindings for space
- [ ] `GET /spaces/:spaceId/media/bindings/:bindingId` returns single binding
- [ ] `POST /spaces/:spaceId/media/bindings` creates a binding (validates endpoint IDs and types)
- [ ] `PATCH /spaces/:spaceId/media/bindings/:bindingId` updates a binding
- [ ] `DELETE /spaces/:spaceId/media/bindings/:bindingId` deletes a binding
- [ ] `POST /spaces/:spaceId/media/bindings/apply-defaults` creates missing bindings with heuristic defaults
- [ ] Endpoint type validation: display slot → display type, audio slot → audio_output type, etc.
- [ ] Override validation: `displayInputId` only if display has `inputSelect` capability; `audioVolumePreset` only if audio has `volume` capability

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Create a watch binding

Given a space with a TV (display) and a speaker (audio_output)
When I POST a binding with activityKey=watch and displayEndpointId pointing to the TV
Then the binding is created and persisted

### Scenario: Reject invalid endpoint type

Given a space with a speaker (audio_output)
When I POST a binding with displayEndpointId pointing to the speaker
Then the request fails with a validation error explaining the type mismatch

## 6. Technical constraints

- Follow existing module/service structure in `apps/backend/src/modules/spaces/`
- Do not modify generated code
- Endpoint IDs are strings (derived format), not UUIDs
- Tests expected for new logic

## 7. Implementation hints

- Model the entity similarly to `SpaceMediaRoutingEntity` but with string endpoint IDs
- Use `DerivedMediaEndpointService.buildEndpointsForSpace()` for validation
- For defaults, use same heuristics as `SpaceMediaRoutingService.autoCreateRoutings()` but with derived endpoint IDs

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
