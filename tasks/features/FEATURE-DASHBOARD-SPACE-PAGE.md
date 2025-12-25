# Task: Add Space page type to Dashboard (space-first home screen)
ID: FEATURE-DASHBOARD-SPACE-PAGE
Type: feature
Scope: backend, admin, panel
Size: large
Parent: FEATURE-SPACES-MODULE
Status: completed

## 1. Business goal

In order to provide a low-configuration, room-centric UI that is usable by default,
As an administrator,
I want to add a "Space" page type that renders a Space overview and room controls, while still allowing classic tiles/pages for power users.

## 2. Context

- A new `spaces` module exists (or will exist) and Devices/Displays can be linked to a Space.
- Dashboard module currently supports page types: device detail, tiles, cards/tiles.
- Displays can have multiple pages; users can swipe between them.
- Goal: allow `SpacePage` to be used as Home, with existing tiles page(s) as secondary “buttons mode”.

Constraints / legacy behavior:
- Existing page types must keep working unchanged.
- `SpacePage` must not force redesign of existing dashboards.
- Panel app should keep supporting multiple displays connected to one backend.

## 3. Scope

**In scope**

Backend:
- Introduce a new Dashboard page type: `space`.
- `SpacePage` configuration should be minimal:
  - `spaceId`
  - optional view mode/preset (e.g., `simple`/`advanced`) OR section toggles
- Provide an endpoint that returns the computed model for rendering:
  - space metadata
  - device summaries per domain (lights/climate/covers/media/sensors), based on device capabilities
  - optional favorites (if supported by current domain model)

Admin UI:
- Allow creating a Space page by selecting a Space.
- Allow setting a page as display home.
- Allow adding Space page alongside existing pages for the same display.

Panel app:
- Render `SpacePage`:
  - header: Space name + key sensor values (if available)
  - sections: Lights / Climate / Covers / Media / Sensors (only show if data exists)
  - include safe defaults for interaction components based on capabilities (see acceptance criteria)

**Out of scope**

- Intent orchestration logic beyond basic device control (handled in a separate task).
- Advanced templating/drag-drop layout editing for Space pages.
- Cross-space pages (house overview).

## 4. Acceptance criteria

- [x] Backend supports creating/updating/deleting `space` pages via Dashboard APIs.
- [x] Admin UI supports creating a `SpacePage` and assigning it to a Display (alongside other pages).
- [x] Panel can render `SpacePage` with:
  - [x] Space header (name + optional status badges)
  - [x] Lights section when the space has lights
  - [ ] Climate section when the space has temperature/thermostat devices (deferred to future iteration)
- [x] Interactions on `SpacePage` must be capability-driven:
  - [x] lights: on/off always, brightness controls if supported
  - [ ] climate: display current temp, setpoint controls if thermostat exists (deferred to future iteration)
- [x] `SpacePage` gracefully handles missing data (no crashes, shows empty state).
- [x] Tests:
  - [x] Backend unit tests for `SpacePage` read model generation
  - [ ] Panel component tests (or equivalent) for rendering with/without sections (Flutter tests require melos)

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Use Space page as Home and tiles page as secondary

Given Display "Panel-Office" is assigned to Space "Office"  
And the admin creates a Space page for "Office"  
And the admin also adds a Tiles page with extra controls  
When the user approaches the panel  
Then the panel opens on the Space page for "Office"  
And the user can swipe to the Tiles page

## 6. Technical constraints

- Follow existing module/service structure in backend/admin/panel.
- Do not introduce new dependencies unless really needed.
- Do not modify generated code.
- Tests are expected for new logic.
- Keep page type implementation consistent with existing plugin-based dashboard architecture.

## 7. Implementation hints (optional)

- In backend, implement a `SpacePageReadModelService` (or similar) that assembles a render model by:
  - querying devices assigned to the Space
  - grouping by domain using capabilities/spec (lights/climate/etc.)
  - returning a deterministic view model
- In panel, avoid overly detailed per-device UIs in v1:
  - show a primary control + “all devices” list if needed.
- Ensure the new page type is versioned or feature-flagged if your platform uses such patterns.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
