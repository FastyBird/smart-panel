# Task: Scenes module (plugin-based) — MVP
ID: EPIC-SCENES-PLUGIN-MVP
Type: feature
Scope: backend, admin, panel
Size: large
Parent: (none)
Status: done

## 1. Business goal

In order to provide fast, room-centric “intent actions” (Movie, Work, Party, Night) without building a full automation engine,
As a building administrator,
I want to create, manage and trigger Scenes that are scoped to Spaces (Rooms) and rendered as quick actions on panels.

## 2. Context

- The platform is modular and plugin-driven (similar patterns exist in `devices` module and `dashboard` module).
- **Important**: Scenes are **NOT automations**. No conditional logic, triggers, schedules, or workflows.
- A Scene should be a reusable “preset” that applies a set of desired device property states.
- Future-proofing requirement: support multiple scene “types” without core schema migrations (e.g., simple actions list, snapshot/capture scene, native provider scenes such as Hue, etc.).

## 3. Scope

**In scope**

- Introduce a new **core** `scenes` module that provides:
  - CRUD for Scene entities
  - a registry/contract for **scene type handlers**
  - an `apply` orchestration endpoint that delegates to the appropriate handler
- Implement one initial scene type as a plugin: **Simple Scene** (list of device property set operations)
- Bind Scenes to Spaces (Rooms) for MVP:
  - `Scene.scopeType = room`
  - `Scene.spaceId` references a Space of type `room`
- Admin UI:
  - list/create/edit scenes for a room
  - a “Test/Apply” action in admin
- Panel UI:
  - show room scenes as quick actions (button/tile) and allow triggering them

**Out of scope**

- Automations / rules / triggers / schedules / conditionals / time windows
- Complex transactionality (“all-or-nothing”) across mixed integrations
- Migration of existing dashboards to scenes
- Scene sharing across multiple rooms (can be added later)

## 4. Acceptance criteria

- [x] A new core `scenes` module exists with a plugin-based scene type registry and a stable core schema.
- [x] At least one scene type plugin exists: `simple-scene` (scenes-local plugin), able to apply a list of property value sets via the Devices module.
- [x] Scenes are **room-scoped** (bound to one `Space` of type `room`) and validated server-side.
- [x] Admin can create/edit/delete scenes and trigger them ("Apply") from admin UI.
- [x] Panel can display scenes for the current room and trigger them.
- [x] Unit tests exist for scene type registry + apply delegation + basic validation.
- [x] OpenAPI models and client code stay in sync; changes are covered by tests.

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Apply a simple scene from panel

Given a Room "Living Room" with a Scene "Movie" (simple-scene)  
And the Scene defines actions to set lights and blinds  
When the user taps "Movie" on the Living Room panel  
Then the backend dispatches device commands for each action via Devices module  
And returns an apply result with per-action status

### Scenario: Reject invalid scene scope

Given a Scene is created with `spaceId` referencing a `zone` space  
When the API receives the create request  
Then it responds with 400 validation error indicating the space must be of type `room`

## 6. Technical constraints

- Follow the existing module / service structure in backend.
- Do not introduce new dependencies unless really needed.
- Do not modify generated code.
- Tests are expected for new logic.

## 7. Implementation hints (optional)

- Mirror the plugin registry approach used in dashboard nested builders or other plugin registries.
- Prefer `type` + `config` JSON on the Scene entity for plugin payloads.
- Keep the core module “dumb”: it should not know about per-type config internals beyond delegation.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
