# Task: House Overview page (master panel home) (v2)
ID: FEATURE-HOUSE-OVERVIEW-PAGE-V2
Type: feature
Scope: backend, admin, panel
Size: medium
Parent: EPIC-DISPLAY-ROLES-HOUSE-CONTROL-V2
Status: planned

## 1. Business goal

In order to provide a central “whole-home” view,
As a master panel user,
I want a House Overview page that shows all Spaces with compact status and allows drill-down to SpacePage.

## 2. Context

- SpacePage is optimized for a single Space.
- A large master panel needs a different UX: overview first, drill-down second.
- Status summarization can be derived from Space/device state (best-effort).

Constraints:
- This page should be read-mostly (no complex editing).
- Must not require all Spaces to have SpacePages; drill-down is best-effort.

## 3. Scope

**In scope**

Backend:
- New dashboard page type `house_overview` (plugin-style, consistent with other page types).
- Read model includes:
  - list of Spaces (id, name, type)
  - per-space summary (best-effort):
    - lights: total + on count
    - temperature: current temp if available
    - alerts: boolean + count (limited to offline/error states if available)
- Drill-down mapping:
  - preferred target is SpacePage for that space if it exists
  - otherwise no-op with a friendly message

Admin:
- Create House Overview page.
- Assign it to displays (primarily role=master) and/or mark as global default for master role (choose what fits existing model).

Panel:
- Render grid/list optimized for large displays:
  - Space cards with name + key badges
- Tap a Space card to open its SpacePage when available.
- If no SpacePage exists, show a non-blocking message (“No room page configured”).

**Out of scope**
- Batch controls (all lights off) from the overview.
- Filtering/searching.
- Historical charts.

## 4. Acceptance criteria

- [ ] House Overview page type can be created and assigned in admin.
- [ ] Panel renders Space cards with at least lights + temperature summary when available.
- [ ] Drill-down to SpacePage works when it exists.
- [ ] Missing SpacePage does not break the page; user gets a gentle message.
- [ ] Unit tests cover read model generation (empty list, missing data, basic summaries).

## 6. Technical constraints

- Keep read model generation robust to missing capabilities/properties.
- Do not introduce new dependencies unless needed.
- Do not modify generated code.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
