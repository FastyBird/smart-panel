# Task: Align merged implementation to v2 specification (gap report + fixes)
ID: TECH-EPIC-HOUSE-CONTROL-ALIGNMENT
Type: technical
Scope: backend, admin, panel
Size: small
Parent: EPIC-DISPLAY-ROLES-HOUSE-CONTROL-V2
Status: done

## 1. Business goal

In order to prevent “AI guessed behavior” drift,
As a maintainer,
I want the merged implementation to be audited and adjusted to match the v2 spec.

## 2. Context

- Previous tasks were incomplete, so the implementation may not match intended precedence/behavior.

## 3. Scope

**In scope**
- Produce a spec gap report (bullet list) vs v2 tasks.
- Apply minimal fixes to match:
  - home resolution precedence rules
  - robust fallbacks
  - house mode deterministic semantics (no global restore)
  - house overview drill-down behavior

**Out of scope**
- New features beyond the v2 spec.
- Visual polish.

## 4. Acceptance criteria

- [x] A gap report is posted in the PR description/comment.
- [x] Home resolution precedence matches v2 spec exactly.
- [x] House Overview behaves read-mostly and is robust to missing SpacePages.
- [x] House Modes match v2 semantics (Away/ Night actions, Home non-destructive).
- [x] Any accidental breaking changes are reverted or made backward compatible.

## 8. AI instructions

- Start with the gap report, then implement only necessary fixes.
