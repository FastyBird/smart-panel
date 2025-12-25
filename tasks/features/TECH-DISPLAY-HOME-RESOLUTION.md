# Task: Resolve display home page automatically using Space context (SpacePage-first fallback rules)
ID: TECH-DISPLAY-HOME-RESOLUTION
Type: technical
Scope: backend, panel, admin
Size: small
Parent: EPIC-SPACES-FIRST-UX
Status: planned

## 1. Business goal

In order to make the panel feel like a product out of the box,
As an administrator,
I want each display to open to the correct home screen automatically, using its Space assignment when available.

## 2. Context

- Displays can be linked to a Space (`display.spaceId`).
- Space pages exist as a new dashboard page type (`space`).
- Displays can have multiple pages and users can swipe between them.

Constraints:
- Must not break existing “manual home page” selection behavior.
- Must be deterministic and easy to reason about.

## 3. Scope

**In scope**

Backend:
- Implement a “home resolution” rule for displays:
  1) If display has explicit `homePageId` configured -> use it
  2) Else if display has `spaceId` and a SpacePage exists for that space -> use it
  3) Else fallback to first assigned page (stable ordering) or a safe default view
- Expose the resolved home page to the panel via existing display/page APIs (avoid new endpoints if possible).

Admin:
- Add a display setting to choose home behavior:
  - `homeMode = explicit | autoSpace | firstPage`
  - defaults should preserve current behavior (choose a safe default)
- UI should clearly show what home will resolve to.

Panel:
- Use resolved home page when the panel starts or reconnects.
- Ensure no crash if resolved page is missing; fallback gracefully.

**Out of scope**

- Cross-space / house overview home modes.
- “Recently used” home heuristics.

## 4. Acceptance criteria

- [ ] Display home resolution follows the documented precedence rules.
- [ ] Existing installations using explicit home pages keep working.
- [ ] AutoSpace mode opens SpacePage for the display’s assigned space when available.
- [ ] Fallback is deterministic and stable.
- [ ] Panel starts on the resolved home page and handles missing pages gracefully.
- [ ] Unit tests cover precedence rules and fallback behaviors.

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: AutoSpace home for a display

Given Display "Panel-Office" has `spaceId=Office`  
And a SpacePage exists for Space "Office"  
And no explicit home page is set  
When the panel starts  
Then the panel opens on the Office SpacePage

## 6. Technical constraints

- Follow existing module / service structure in backend/admin/panel.
- Do not introduce new dependencies unless really needed.
- Do not modify generated code.
- Tests are expected for new logic.

## 7. Implementation hints (optional)

- Keep resolution logic in a single backend service function to avoid duplication.
- If “first assigned page” order is currently undefined, define it explicitly (e.g., by creation time or explicit order field).

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
