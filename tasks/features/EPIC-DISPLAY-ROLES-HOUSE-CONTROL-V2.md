# Task: Display roles & House control (v2 specification)
ID: EPIC-DISPLAY-ROLES-HOUSE-CONTROL-V2
Type: feature
Scope: backend, admin, panel
Size: large
Parent: (none)
Status: planned

## 1. Business goal

In order to support realistic smart-home panel installations (room panels, master panels, entry/security panels),
As a product owner and administrator,
I want display roles and purpose-built pages that provide room control, whole-house overview, and fast house-mode actions.

## 2. Context

- Spaces are a core domain: devices/displays can be assigned to a Space.
- SpacePage exists and provides room-first controls via intents (lighting MVP, optional climate/suggestions as follow-ups).
- Displays module manages multiple physical panels connected to one backend.
- Dashboard module supports multiple page types via plugins.
- Goal: keep SpacePage simple and space-centric; house-wide UX must be separate pages.

Constraints / legacy behavior:
- Existing pages and existing display home behavior must keep working (backward compatible).
- New behavior must be opt-in via display role and/or explicit home settings.
- Do not refactor Spaces or existing Intents APIs unless explicitly required by the child task.

## 3. Scope

**In scope**
- Display roles: `room`, `master`, `entry`
- Role-aware home resolution (with safe fallbacks)
- House Overview page type for master panels (read-mostly + drill-down)
- House Modes page type for entry panels (Home/Away/Night) with deterministic actions

**Out of scope**
- Advanced security system configuration UI
- Scheduling/automation of house modes
- Energy analytics, historical charts
- AI assistant/LLM integration
- Complex “restore previous state” across the whole house

## 4. Acceptance criteria

- [ ] Child tasks in this epic are completed and meet their acceptance criteria:
  - [ ] FEATURE-DISPLAY-ROLES-MVP-V2
  - [ ] FEATURE-HOUSE-OVERVIEW-PAGE-V2
  - [ ] FEATURE-HOUSE-MODES-MVP-V2
  - [ ] TECH-EPIC-HOUSE-CONTROL-ALIGNMENT
  - [ ] TECH-HOUSE-CONTROL-SMOKE-TESTS
- [ ] Backward compatibility: existing displays/pages behave the same unless role/home mode is changed.
- [ ] The system remains operable even if House Overview / House Modes pages are not configured.

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Room panel resolves to SpacePage automatically

Given a display has role "room" and spaceId "Bedroom"
And a SpacePage exists for "Bedroom"
When the panel starts
Then the resolved home page is that SpacePage

### Scenario: Master panel resolves to House Overview

Given a display has role "master"
And a House Overview page is configured for this display (or globally)
When the panel starts
Then the resolved home page is the House Overview page

## 6. Technical constraints

- Follow existing module/service patterns across backend/admin/panel.
- Do not introduce new dependencies unless really needed.
- Do not modify generated code.
- Tests are expected for new logic and fallbacks.
- Keep changes incremental and additive.

## 7. Implementation hints (optional)

- Centralize all “home page resolution” logic in a single backend service.
- Treat new page types like other dashboard page plugins: create -> assign -> render via read model.
- For house modes, start with deterministic light actions only (all off / night lighting), and publish a single domain event for integrations.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this epic and its child tasks.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
