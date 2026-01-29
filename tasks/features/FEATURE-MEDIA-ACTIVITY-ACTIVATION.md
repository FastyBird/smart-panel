# Task: Media Domain – Backend MVP #3 (Activate Activity → Plan → Execute + Active State + WS)
ID: FEATURE-MEDIA-ACTIVITY-ACTIVATION
Type: feature
Scope: backend
Size: large
Parent: FEATURE-SPACE-MEDIA-DOMAIN-V2
Status: in-progress

## 1. Business goal

In order to activate a media activity (watch, listen, gaming, etc.) from the UI
As a smart-panel user
I want the system to resolve an activity binding into an execution plan, execute device commands, persist the active state, and emit WebSocket events for real-time UI feedback.

## 2. Context

- `GET /spaces/:spaceId/media/endpoints` exists (MVP #1)
- `GET/PUT /spaces/:spaceId/media/bindings/:activityKey` exists (MVP #2)
- `POST /spaces/:spaceId/media/bindings/apply-defaults` exists (MVP #2)
- Activity bindings reference derived endpoint IDs (`spaceId:type:deviceId`)
- Derived endpoints carry capability flags and property/command links
- Existing `SpaceMediaRoutingService` provides the routing-based execution reference
- EventEmitter2 + WebSocket gateway propagate events to connected clients

## 3. Scope

**In scope**

- `SpaceActiveMediaActivityEntity` — persisted active state per space (activityKey, state, resolved devices, lastResult)
- `POST /spaces/:spaceId/media/activities/:activityKey/activate` — activate an activity
- `POST /spaces/:spaceId/media/activities/deactivate` — deactivate current activity
- `GET /spaces/:spaceId/media/activities/active` — read current active state
- Resolver: binding + endpoints → execution plan (power, input, volume steps)
- Executor: sequential step execution with timeouts and partial-success support
- WebSocket events: `media.activity.activating`, `media.activity.activated`, `media.activity.failed`, `media.activity.deactivated`
- Idempotency: activating the same activity returns current state
- Unit tests for resolver, executor, and idempotency

**Out of scope**

- Admin/Panel UI
- Dry-run plan preview endpoint
- Advanced fallback heuristics
- Grouping/multiroom
- Queue-based execution

## 4. Acceptance criteria

- [ ] Activate endpoint builds plan from binding + derived endpoints and executes it
- [ ] Active state is persisted per space and retrievable via GET
- [ ] WS events are emitted for activation lifecycle (activating, activated, failed, deactivated)
- [ ] Critical step failure results in `failed` state with actionable failure payload
- [ ] Non-critical step failure allows partial success with warnings
- [ ] Deactivate resets active state and optionally sends best-effort stop
- [ ] Activating same activity twice returns current state (idempotent)
- [ ] Missing binding returns 409 with guidance to run apply-defaults
- [ ] Unit tests for resolver plan ordering and critical flags
- [ ] Executor tests: success, non-critical failure, critical failure

## 5. Example scenarios

### Scenario: Activate watch on TV-only space

Given a space with a TV (display + audio) and a "watch" binding configured
When POST /spaces/:spaceId/media/activities/watch/activate
Then the system powers on the TV, sets input, applies volume preset
And responds with `active` state and step results
And emits `media.activity.activated` via WebSocket

### Scenario: Activate with missing binding

Given a space with no "gaming" binding
When POST /spaces/:spaceId/media/activities/gaming/activate
Then the system returns 409 with message to run apply-defaults first

### Scenario: Activate same activity twice

Given a space with "watch" already active
When POST /spaces/:spaceId/media/activities/watch/activate
Then the system returns 200 with the current active state without re-executing

## 6. Technical constraints

- Follow existing module/service structure in `apps/backend/src/modules/spaces/`
- Use TypeORM entity with unique index on `spaceId`
- Use EventEmitter2 for event emission (propagated by WebSocket gateway)
- Do not modify generated code
- Tests expected for new business logic

## 7. Implementation hints

- Reuse `DerivedMediaEndpointService` to resolve endpoint capabilities and links
- Reuse `SpaceMediaActivityBindingService` to load bindings
- Reuse `PlatformRegistryService` for device command execution
- Follow `SpaceMediaRoutingService.buildExecutionPlan` and `activateRouting` as reference patterns
- Entity fields: spaceId, activityKey, state, activatedAt, updatedAt, resolved (JSON), lastResult (JSON)

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
