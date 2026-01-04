# Task: Add canRemove Field to Extensions OpenAPI Spec
ID: TECH-EXTENSIONS-CAN-REMOVE-OPENAPI
Type: technical
Scope: backend
Size: tiny
Parent: CHORE-EXTENSIONS-CORE-CONTROL
Status: planned

## 1. Business goal

In order to have complete API documentation
As an API consumer
I want the canRemove field documented in the OpenAPI specification

## 2. Context

- Extensions core control was implemented in CHORE-EXTENSIONS-CORE-CONTROL
- OpenAPI spec regeneration with canRemove field was deferred

## 3. Scope

**In scope**

- Add canRemove field to extension response models
- Regenerate OpenAPI specification

**Out of scope**

- Backend logic changes (already implemented)
- Admin UI changes

## 4. Acceptance criteria

- [ ] canRemove field is documented in OpenAPI spec
- [ ] Field type and description are accurate
- [ ] Generated admin client includes the field

## 5. Technical constraints

- Run pnpm run generate:openapi after changes

## 6. AI instructions

- Read this file entirely before making any code changes.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
