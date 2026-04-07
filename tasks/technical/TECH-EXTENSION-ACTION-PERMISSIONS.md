# Task: Role-based Action Access Control

ID: TECH-EXTENSION-ACTION-PERMISSIONS
Type: technical
Scope: backend
Size: small
Parent: EPIC-EXTENSION-ACTIONS
Status: done

## 1. Business goal

In order to prevent unauthorized users from executing potentially dangerous extension actions,
As a system owner,
I want actions to declare required user roles, and the system to enforce them before execution.

## 2. Context

Currently, the actions controller uses `@Roles(UserRole.OWNER, UserRole.ADMIN)` for all actions uniformly. Some actions (like "Set Connection State" or "Load Scenario with truncate") should be restricted to owners only, while read-only actions (like "Simulate All") could be available to admins.

**Existing code:**
- `apps/backend/src/modules/users/guards/roles.guard.ts` — Existing role guard
- `apps/backend/src/modules/extensions/services/extension-action.interface.ts` — Action interface
- `apps/backend/src/modules/extensions/controllers/actions.controller.ts` — Actions controller

## 3. Scope

**In scope**

- Add optional `requiredRoles` field to `IExtensionAction` interface
- Actions controller checks user roles against action-level requirements
- Default: OWNER and ADMIN if not specified (backward compatible)
- Admin UI shows disabled actions with tooltip for insufficient permissions

**Out of scope**

- Custom permission definitions beyond existing user roles
- Per-parameter permission checks
- Permission management UI

## 4. Acceptance criteria

- [x] `IExtensionAction` has optional `requiredRoles?: UserRole[]` field
- [x] Actions controller validates user role against action's required roles
- [x] Actions API response includes `allowed` field based on current user
- [x] Admin UI disables actions the current user cannot execute
- [x] Existing actions work without specifying roles (defaults to OWNER + ADMIN)
- [x] Dangerous actions default to OWNER only

## 5. Technical constraints

- Must be backward compatible with existing action registrations
- Use existing `Roles` guard infrastructure
- Do not add new dependencies

## 6. AI instructions

- Read this file entirely before making any code changes
- Keep changes minimal — this is a small enhancement
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`
