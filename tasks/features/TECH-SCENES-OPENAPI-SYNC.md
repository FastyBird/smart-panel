# Task: Scenes — OpenAPI models + client sync tests
ID: TECH-SCENES-OPENAPI-SYNC
Type: technical
Scope: backend, admin, panel
Size: small
Parent: EPIC-SCENES-PLUGIN-MVP
Status: planned

## 1. Business goal

In order to keep backend, admin, and panel clients consistent,
As a maintainer,
I want OpenAPI models for Scenes and automated tests that detect schema drift.

## 2. Context

- The project relies on OpenAPI generation and unit tests to detect schema changes.
- Scenes introduce new endpoints and DTOs.

## 3. Scope

**In scope**

- Add/extend OpenAPI definitions for:
  - Scene entity (core fields: id, name, type, config, enabled, spaceId)
  - Apply endpoints and ApplyResult model
  - SceneTypes list endpoint
- Ensure admin and panel clients regenerate types appropriately (respect existing tooling).
- Add/extend tests that fail when OpenAPI models drift from expected.

## 4. Acceptance criteria

- [ ] OpenAPI spec includes Scenes endpoints and models.
- [ ] Types are regenerated (or build pipeline remains green).
- [ ] A test exists that detects model drift for scenes.

## 6. Technical constraints

- Do not modify generated code manually.
- Tests are expected for new logic.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
