# Task: Introduce Spaces module (rooms/zones) as first-class domain
ID: FEATURE-SPACES-MODULE
Type: feature
Scope: backend, admin
Size: medium
Parent: (none)
Status: completed

## 1. Business goal

In order to reduce initial configuration effort and provide a HomeKit-like experience,
As an administrator,
I want to manage Spaces (rooms/zones) and link Devices and Displays to a Space.

## 2. Context

- The backend is modular with domain modules (devices, dashboard, displays, configuration, weather) and plugin-based integrations (e.g., HA, Shelly, OpenWeatherMap).
- Devices module manages connected devices with channels and properties, stores incoming state, and dispatches commands.
- Displays module manages multiple wall displays connected to a single backend (“one brain, X displays”).
- Dashboard module currently supports multiple page types (device detail, tiles, cards/tiles).

Constraints / legacy behavior:
- Preserve existing Devices, Dashboard, and Displays behavior.
- Do not force the user to redesign existing dashboards.
- Keep the system open and plugin-friendly.

## 3. Scope

**In scope**

Backend:
- Create a new `spaces` module with CRUD for `Space`.
- Add `spaceId` to `Device` and `Display` (nullable initially).
- Add backend APIs for:
  - listing devices by space
  - listing displays by space
  - setting/unsetting device/display space assignment
- Add database migrations for new tables/columns.

Admin UI:
- Add basic UI to manage Spaces (list/create/edit/delete).
- Add UI to assign a Space to:
  - a Display
  - a Device (bulk assignment supported)

**Out of scope**

- Space-driven dashboard generation (handled in a separate task).
- Intent-based controls and orchestration logic.
- Multi-space assignment for a single device/channel (can be considered later).

## 4. Acceptance criteria

- [x] Backend `spaces` module exists with `Space` entity/table and CRUD endpoints.
- [x] `Device` and `Display` can store an optional `spaceId` and expose it via API.
- [x] Admin UI allows creating/editing/deleting Spaces.
- [x] Admin UI allows assigning devices/displays to a Space (bulk assign for devices).
- [x] Migrations are added and backward compatibility is preserved (existing data still works).
- [x] Unit tests are added for new backend services/controllers (at minimum CRUD + assignment paths).

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Create a Space and assign a Display to it

Given an admin is in the Admin UI  
When the admin creates a Space "Living room"  
And assigns Display "Panel-1" to "Living room"  
Then Display "Panel-1" has `spaceId` pointing to "Living room" in the backend  
And the assignment is visible in the Admin UI

## 6. Technical constraints

- Follow the existing module / service structure in the backend.
- Do not introduce new dependencies unless really needed.
- Do not modify generated code.
- Tests are expected for new logic.
- Keep migrations consistent with existing TypeORM/migration conventions in this repo.

## 7. Implementation hints (optional)

- Reuse existing patterns from other simple domain modules (e.g., configuration sections or dashboard entities).
- Prefer simple enums for `Space.type` (optional) but keep the initial version minimal (name + description is enough).
- Ensure deletion behavior is safe:
  - deleting a Space should set related `Device.spaceId` / `Display.spaceId` to NULL or prevent delete (choose one; document it).

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
