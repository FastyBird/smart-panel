# Task: Panel UI — Room quick actions for Scenes
ID: FEATURE-SCENES-PANEL-ROOM-ACTIONS
Type: feature
Scope: panel
Size: medium
Parent: EPIC-SCENES-PLUGIN-MVP
Status: done

## 1. Business goal

In order to make room control feel “intent-driven”,
As a user standing at a room panel,
I want to see and trigger Scenes as quick actions for the current Room.

## 2. Context

- Panel app has room/space context (or can get it from display assignment).
- MVP Scenes are room-scoped and should be listed by `spaceId`.

## 3. Scope

**In scope**

- Fetch scenes for current room:
  - `GET /scenes?spaceId=<roomId>&enabled=true`
- Render scenes as quick actions:
  - simple list/buttons (initially)
  - show icon/name
- Trigger apply:
  - `POST /scenes/:id/apply`
  - show transient feedback: success/partial/failed
- Ensure errors do not break the UI (graceful fallback).

## 4. Acceptance criteria

- [x] Scenes appear on the room screen as quick actions.
- [x] Triggering a scene calls backend apply endpoint.
- [x] User gets feedback for success/partial/failure.
- [x] Integration is covered by at least one widget/unit test (where applicable).

## 6. Technical constraints

- Follow the existing panel architecture and state management.
- Do not introduce new dependencies unless really needed.
- Do not modify generated code.
- Tests are expected for new logic.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
