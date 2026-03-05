# Task: Scenes Admin UI (CRUD + action editor)

ID: FEATURE-SCENES-ADMIN-UI
Type: feature
Scope: admin
Size: medium
Parent: EPIC-SCENES-MVP
Status: done

## 1. Business goal

In order to configure scenes without manual API calls,
As an administrator,
I want an Admin UI to create and manage room scenes and their actions.

## 2. Context

- Element Plus UI patterns already exist (tables, modals, inline edit).
- Spaces UI exists; scenes must be room-scoped.
- Use existing stores/composables patterns (Pinia, openapi-fetch).

## 3. Scope

**In scope**

- Add a Scenes section to Admin navigation.
- Scenes list:
  - filter by room (space) and/or search by name
  - show name, room, order, enabled, actions count
- Scene detail/edit:
  - edit metadata (name, icon, order, enabled)
  - select Room spaceId (rooms only)
  - manage actions list:
    - add action: select device → property → value input
    - reorder actions
    - remove action
- Trigger “Apply” from admin (optional but useful for testing) as a button.

**Out of scope**

- Bulk import/export
- Fancy editors for complex value types beyond MVP

## 4. Acceptance criteria

- [x] Scenes list page exists and loads data from backend
- [x] Create/Edit Scene works end-to-end
- [x] Action editor prevents obviously invalid inputs (basic client-side checks)
- [x] Room selector only shows room spaces
- [x] Apply button triggers apply endpoint and shows result feedback
- [x] Unit tests for stores (CRUD + apply action) where you already test stores

## 6. Technical constraints

- No new dependencies.
- Reuse existing table/form components and patterns.
- Do not modify generated code.
- Tests expected for new store logic.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to admin.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
