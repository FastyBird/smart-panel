# Task: Apply scene feedback & idempotency (polish)

ID: CHORE-SCENES-APPLY-FEEDBACK
Type: chore
Scope: backend, panel
Size: small
Parent: EPIC-SCENES-MVP
Status: planned

## 1. Business goal

In order to avoid confusing behavior when a scene is applied repeatedly,
As a user,
I want applying a scene multiple times to be safe and to receive clear feedback.

## 2. Context

- Many scenes will set properties to fixed values.
- Users may tap multiple times.

## 3. Scope

**In scope**

- Backend: ensure apply returns deterministic response:
  - per-action status: dispatched / skipped / failed
  - optional “skipped” when the value is already set (best-effort)
- Panel: show a concise toast:
  - success
  - partial success
  - failure

**Out of scope**

- Complex diffing across integrations
- Rollback

## 4. Acceptance criteria

- [ ] Apply response includes per-action status
- [ ] Panel renders partial success state clearly
- [ ] Backend response formatting has unit tests

## 6. Technical constraints

- No new dependencies.
- Tests expected for backend response formatting.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
