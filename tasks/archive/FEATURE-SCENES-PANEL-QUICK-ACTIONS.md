# Task: Panel – show room scenes as quick actions

ID: FEATURE-SCENES-PANEL-QUICK-ACTIONS
Type: feature
Scope: panel
Size: medium
Parent: EPIC-SCENES-MVP
Status: done

## 1. Business goal

In order to let end users control the room with intent-based actions,
As a home user,
I want scenes to appear as quick action tiles/buttons in the room view and be executable with one tap.

## 2. Context

- Panel app already renders room/space views and can trigger commands via backend.
- UI patterns exist for tiles/buttons and feedback (toast/snackbar).
- Spaces: each display is assigned to a room; room view is the primary landing.

## 3. Scope

**In scope**

- Fetch scenes for the current room from backend.
- Render scenes as a “Quick actions” section (pills/tiles) at top of room view.
- On tap:
  - call apply endpoint
  - show success/failure feedback
  - optionally show per-action partial failure message (collapsed)

**Out of scope**

- Scene editing in panel
- Voice/AI integration
- Animations/transitions

## 4. Acceptance criteria

- [x] Room view shows scenes associated with that room
- [x] Tapping a scene triggers apply call
- [x] UI shows feedback on success/failure
- [x] Handles offline/backend error gracefully

## 6. Technical constraints

- Reuse existing API client patterns.
- No new dependencies.
- Do not modify generated code.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to panel.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
