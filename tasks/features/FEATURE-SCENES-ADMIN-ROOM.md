# Task: Admin UI — Room scenes list + create/edit/apply
ID: FEATURE-SCENES-ADMIN-ROOM
Type: feature
Scope: admin
Size: medium
Parent: EPIC-SCENES-PLUGIN-MVP
Status: planned

## 1. Business goal

In order to manage room-centric quick actions,
As an administrator,
I want to create and manage Scenes for a specific Room (Space) and test them from the admin interface.

## 2. Context

- Admin app uses Element Plus and composable form patterns.
- Spaces module exists; Scenes should be room-scoped (`Space.type = room`).
- Scene types are plugin-based; MVP supports `simple-scene`.

## 3. Scope

**In scope**

- Add a new tab/section in Space detail (Room) UI: **Scenes**
- Scenes list:
  - name, type, enabled, order
  - actions: edit, delete, apply
- Create/edit form for `simple-scene`:
  - scene name, icon (optional), order, enabled
  - actions editor:
    - add action: select device -> select property -> value input
    - remove actions
- Apply button:
  - calls `POST /scenes/:id/apply`
  - shows result summary (success/partial/failed) and per-action messages

**Out of scope**

- Dynamic form rendering for unknown plugin types (future)
- Scene templates

## 4. Acceptance criteria

- [ ] Room Space detail includes a Scenes section.
- [ ] Admin can create/edit/delete a simple scene for that room.
- [ ] Admin can apply the scene and see apply results.
- [ ] Basic client-side validation prevents empty action list.
- [ ] Unit/component tests exist for core flows (at least form validation + apply action).

## 6. Technical constraints

- Follow existing admin UI patterns and components.
- Do not introduce new dependencies unless really needed.
- Do not modify generated code.
- Tests are expected for new logic.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
