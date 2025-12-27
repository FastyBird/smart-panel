# Task: Display roles and role-aware home resolution (v2)
ID: FEATURE-DISPLAY-ROLES-MVP-V2
Type: feature
Scope: backend, admin, panel
Size: medium
Parent: EPIC-DISPLAY-ROLES-HOUSE-CONTROL-V2
Status: planned

## 1. Business goal

In order to support different panel purposes in real homes,
As an administrator,
I want to assign a role to each display so the system can choose the correct default home behavior.

## 2. Context

- Displays exist in different physical contexts:
  - room panels (one space)
  - master panels (whole-house overview)
  - entry panels (house modes / security workflow)
- The project already has (or is implementing) a home page resolution mechanism.
- This task must not break existing manual home page configuration.

## 3. Scope

**In scope**

Backend:
- Add `display.role` enum: `room`, `master`, `entry`.
- Backward compatibility:
  - existing displays default to `room` (or behave as “legacy” equivalent).
- Extend home resolution precedence (document and implement):
  1) If display has explicit `homePageId` (or equivalent explicit home) -> use it
  2) Else if display role is `room` and display has `spaceId` and a SpacePage exists for that space -> use it
  3) Else if display role is `master` and a House Overview page is configured/assigned -> use it
  4) Else if display role is `entry` and a House Modes page is configured/assigned -> use it
  5) Else fallback to first assigned page (stable order) or a safe default
- Expose resolved home page to panel using existing API shapes (avoid new endpoints if possible).

Admin:
- Add role selector to display settings with short descriptions:
  - room: controls one Space
  - master: whole-house overview
  - entry: house modes (leaving/arriving)
- Ensure role is visible in display list/details.

Panel:
- Respect resolved home page on startup/reconnect.
- Fallback gracefully if resolved page is missing (show safe fallback view).

**Out of scope**
- New visual layouts for master/entry here (handled in page tasks).
- Permissions/ACL based on role.

## 4. Acceptance criteria

- [ ] Display role can be set and persisted.
- [ ] Existing displays continue to work without manual migration.
- [ ] Home resolution follows documented precedence rules.
- [ ] Fallback behavior is deterministic.
- [ ] Panel does not crash if pages are missing; it uses fallback.

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Explicit home overrides role-based resolution

Given a display has role "room" and spaceId "Office"
And an explicit homePageId is set to a TilesPage
When the panel starts
Then the TilesPage is opened as home

## 6. Technical constraints

- Do not refactor existing displays module contracts unnecessarily.
- Keep resolution logic in one backend service and cover with unit tests.

## 7. Implementation hints (optional)

- If persistence needs a migration, keep it minimal and backward compatible.
- If page assignment model differs per display, choose one deterministic rule and document it.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
