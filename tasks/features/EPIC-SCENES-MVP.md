# Epic: Scenes module (MVP – Room scenes)

ID: EPIC-SCENES-MVP
Type: feature
Scope: backend, admin, panel
Size: large
Parent: (none)
Status: planned

## 1. Business goal

In order to provide quick, meaningful “intent-based” control of a room (e.g., Movie, Work, Party),
As an administrator configuring the Smart Panel for end users,
I want to define and manage **Scenes** and expose them on the wall panels as simple actions.

## 2. Context

- We recently introduced **Spaces** (Rooms and Zones). For MVP, a **Device is assigned to exactly one Room**.
- Scenes should initially be **Room-scoped** (a scene belongs to one Room space).
- The system is modular and plugin-friendly:
  - Core modules provide management and contracts.
  - Plugins provide integrations and specific behaviors.
- Devices module already supports sending commands to integrations.
- Dashboard/Panel already supports tiles/buttons for actions.

## 3. Scope

**In scope (MVP)**

- A new core **Scenes** module (backend) with CRUD and “apply scene” capability.
- Scenes are **bound to a Room** (`spaceId`) and can be displayed on panels for that Room.
- A Scene is a declarative list of **target property values** (device/channel/property + value).
- Admin UI: list/create/edit/delete scenes; manage actions in a scene.
- Panel UI: show scenes as quick actions (tiles/buttons) on the Space/Room view.
- Tests for backend logic and critical admin store/actions.

**Out of scope (not MVP)**

- Global/house scenes, zone-scoped scenes, schedules/automation rules.
- Transition/fade/timing orchestration, multi-step flows, conditional scenes.
- Scene versioning, rollback, “partial apply” semantics.
- AI recommendations (can be layered later).

## 4. Acceptance criteria

- [ ] Scenes module exists and is wired into the backend application (routes, DI, config).
- [ ] Scenes are room-scoped: each scene references exactly one Room space.
- [ ] Admin UI can CRUD scenes and manage scene actions.
- [ ] Applying a scene sends commands to devices via existing Devices services.
- [ ] Panel shows room scenes as tappable actions and triggers apply.
- [ ] Backend validation prevents invalid actions (unknown device/property, incompatible value type).
- [ ] Unit tests cover: apply ordering, validation errors, and persistence rules.

## 5. Example scenarios

### Scenario: Apply a “Movie” scene in Living Room

Given a Room "Living Room" and a Scene "Movie" with actions:
  - set LivingRoom.MainLight.switcher = false
  - set LivingRoom.AmbientLight.brightness = 20
  - set LivingRoom.TV.switcher = true
When the user taps “Movie” on the panel
Then the backend applies the actions and the devices receive the commands
And the panel shows success feedback (toast / status)

## 6. Technical constraints

- Follow existing NestJS module/service/controller patterns in backend.
- Reuse existing Devices module services for sending commands.
- Do not introduce new dependencies unless really needed.
- Do not modify generated code.
- Tests are expected for new logic.

## 7. Implementation notes

- Keep Scenes declarative: “desired target values”, not arbitrary scripts.
- Prefer idempotent apply behavior.
- Consider ordering: apply “power on” actions before dependent actions (optional MVP optimization).
- Keep plugin extensibility: allow plugins to register action resolvers/mappers later.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this epic and its child tasks.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
