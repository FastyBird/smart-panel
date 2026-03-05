# Task: Central intent catalog
ID: TECH-INTENT-CATALOG
Type: technical
Scope: backend
Size: small
Parent: EPIC-SPACES-FIRST-UX
Status: done

## 1. Business goal

In order to provide a discoverable and self-documenting API for intent-based control,
As a UI developer or admin interface,
I want a central catalog endpoint that lists all available intents, their parameters, and UI metadata.

## 2. Context

- The intent system includes lighting and climate categories.
- Each intent type has specific parameters (mode, delta, value, etc.).
- Quick actions are predefined combinations of intents.
- Lighting roles define how lights behave within modes.
- UI clients need to discover what's available without hard-coding.

Constraints:
- Must be read-only and stateless (no database queries).
- Must include human-readable labels, descriptions, and icons.
- Must document parameter types and valid values.

## 3. Scope

**In scope**

Backend:
- Define intent catalog types and metadata in constants.
- Create response models for the catalog endpoint.
- Add `GET /spaces/intents/catalog` endpoint.
- Include all intent categories, intent types, parameters, quick actions, and lighting roles.
- Provide labels, descriptions, and icons for UI rendering.

**Out of scope**

- Space-specific availability based on devices.
- Dynamic catalog based on user permissions.
- Internationalization of labels.

## 4. Acceptance criteria

- [x] `GET /spaces/intents/catalog` returns the complete intent catalog.
- [x] Catalog includes lighting and climate intent categories.
- [x] Each intent type includes parameters with types and valid values.
- [x] Catalog includes all quick action types with metadata.
- [x] Catalog includes all lighting roles with metadata.
- [x] All items include labels, descriptions, and icons.
- [x] Unit tests verify the catalog structure.

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Fetch intent catalog

Given a user is authenticated
When they call GET /spaces/intents/catalog
Then they receive a response with:
  - categories array containing lighting and climate
  - quick_actions array with all available quick actions
  - lighting_roles array with all available roles
And each item includes label, description, and icon

## 6. Technical constraints

- Follow existing module / service structure in backend.
- Do not introduce new dependencies.
- Do not modify generated code.
- Tests are expected for new logic.

## 7. Implementation hints (optional)

- Use static constants for catalog data (no database).
- Transform constants to response models in controller.
- Group enum metadata with their corresponding enums.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
