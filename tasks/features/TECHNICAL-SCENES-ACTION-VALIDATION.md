# Task: Scene action validation & typing

ID: TECHNICAL-SCENES-ACTION-VALIDATION
Type: technical
Scope: backend
Size: small
Parent: EPIC-SCENES-MVP
Status: done

## 1. Business goal

In order to prevent misconfigured scenes from causing runtime errors,
As a developer,
I want strong validation for scene actions (references + value typing) at API boundaries.

## 2. Context

- Device properties have a schema/spec (type, unit, format, permissions).
- Devices module already stores and exposes property metadata.
- Admin UI relies on backend validation as source of truth.

## 3. Scope

**In scope**

- Validate that each action’s target exists:
  - deviceId exists
  - propertyId exists (and belongs to device/channel)
- Validate “settable” permission (write) where applicable.
- Validate value type:
  - boolean/number/string/enum/tuple best-effort conversion rules
  - provide clear error messages (field path + reason)

**Out of scope**

- Advanced coercion for all integrations
- Unit conversion

## 4. Acceptance criteria

- [x] Invalid references return 400 with clear field errors
- [x] Non-writable property action is rejected
- [x] Value type mismatch is rejected with an explicit reason
- [x] Validation is covered by unit tests

## 6. Technical constraints

- Reuse existing property spec metadata (no new dependency).
- Tests required.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to backend.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
