# Task: Smoke tests for home resolution and house modes (load-bearing behaviors)
ID: TECH-HOUSE-CONTROL-SMOKE-TESTS
Type: technical
Scope: backend
Size: small
Parent: EPIC-DISPLAY-ROLES-HOUSE-CONTROL-V2
Status: planned

## 1. Business goal

In order to safely iterate without local manual testing,
As a maintainer,
I want automated tests that lock down precedence rules and best-effort house-mode actions.

## 2. Context

- CI is the merge gate right now.
- Precedence/fallback regressions are the highest risk.

## 3. Scope

**In scope**
- Tests for:
  - role defaulting/backward compatibility
  - home resolution precedence ordering (explicit > auto)
  - missing page fallbacks do not throw
  - house mode persistence and transitions
  - away/night action dispatch selection (mocked)

**Out of scope**
- Full UI end-to-end tests.

## 4. Acceptance criteria

- [ ] Tests cover all precedence branches.
- [ ] Tests cover Away + Night semantics and persistence.
- [ ] Tests are deterministic in CI.

## 6. Technical constraints

- Use existing test stack; do not add dependencies unless required.
- Mock dispatch/integrations; do not require external services.
