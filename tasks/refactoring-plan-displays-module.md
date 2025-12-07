# Task: Consolidate Display Modules into Unified Displays Module
ID: REFACTOR-DISPLAYS-CONSOLIDATION
Type: technical
Scope: backend
Size: large
Parent: (none)
Status: done

## 1. Business goal

In order to simplify display management and enable displays to authenticate independently from users
As a system architect
I want to consolidate display definitions from the `users` and `system` modules into a new, dedicated `displays` module with unified entity and independent authentication

## 2. Context

- **Existing code to reference:**
  - `users/entities/users.entity.ts` - Contains `DisplayInstanceEntity` (MAC address, version, build)
  - `system/entities/system.entity.ts` - Contains `DisplayProfileEntity` (screen dimensions, grid settings)
  - `config/models/config.model.ts` - Contains `DisplayConfigModel` (brightness, dark mode, screen lock)
  - `auth/entities/auth.entity.ts` - Token entities with user relations

- **Current architecture issues:**
  - Display information is split across three modules (users, system, config)
  - Displays are tied to user entities through `UserRole.DISPLAY`
  - Display authentication relies on shared secrets cached in memory
  - Dashboard pages reference `DisplayProfileEntity` from system module

- **Constraints:**
  - Must maintain backwards compatibility for existing dashboard pages
  - Must not break WebSocket authentication for displays
  - AccessToken and RefreshToken must keep direct FK relations to UserEntity

## 3. Scope

**In scope**

- Create new `displays` module with unified `DisplayEntity`
- Implement long-lived token authentication for displays
- Add `TokenOwnerType` enum to support user/display/third-party token ownership
- Update `LongLiveTokenEntity` to use `ownerType` and `ownerId` columns
- Remove `DisplayInstanceEntity` from users module
- Remove `DisplayProfileEntity` from system module
- Remove `DisplayConfigModel` from config module
- Remove `UserRole.DISPLAY` enum value
- Update dashboard module to reference new `DisplayEntity`
- Update WebSocket authentication to support display tokens
- Update initial database migration

**Out of scope**

- Changes to AccessToken/RefreshToken entity structures
- Changes to user authentication flow
- Frontend/panel application changes
- Admin UI changes

## 4. Acceptance criteria

- [x] New `DisplayEntity` combines all display properties (MAC, version, screen dimensions, grid settings, brightness, dark mode)
- [x] `UserRole.DISPLAY` enum value is removed
- [x] `LongLiveTokenEntity` uses `ownerType` (user/display/third_party) and `ownerId` (plain UUID, no FK)
- [x] `AccessToken` and `RefreshToken` keep direct FK relations to `UserEntity`
- [x] Display registration endpoint returns a long-lived JWT token
- [x] WebSocket authentication works for displays using long-lived tokens
- [x] Dashboard pages correctly reference the new `DisplayEntity`
- [x] All 633 unit tests pass
- [x] Build compiles without errors
- [x] Linting passes without errors
- [x] Initial migration script is updated for new schema

## 5. Example scenarios (optional)

### Scenario: Display Registration

Given a display device with MAC address "AA:BB:CC:DD:EE:FF"
When it sends a POST request to `/displays-module/register` with valid User-Agent
Then it receives a long-lived JWT access token
And a new `DisplayEntity` is created in the database
And a `LongLiveTokenEntity` is created with `ownerType: 'display'` and `ownerId: <display.id>`

### Scenario: Display WebSocket Connection

Given a registered display with a valid long-lived token
When it connects to the WebSocket gateway with the token in Authorization header
Then the connection is authenticated
And the client is marked with `type: 'display'` in socket data

## 6. Technical constraints

- Follow the existing module/service structure in `apps/backend/src/modules/`
- Do not introduce new dependencies
- Do not modify AccessToken/RefreshToken entity relations
- Tests are required for all new services and controllers
- Use existing base classes (BaseEntity, BaseSuccessResponseModel)

## 7. Implementation hints (optional)

- Look at `auth/entities/auth.entity.ts` for token entity patterns
- Reuse `BaseEntity` from `common/entities/base.entity.ts` for the new DisplayEntity
- Use `@Public()` decorator for the registration endpoint
- The `findPrimary()` method should return the first display (by creation date)
- WebSocket auth should check `user.type === 'display'` instead of `user.role === UserRole.DISPLAY`

## 8. AI instructions (for Junie / AI)

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.

---

## Implementation Summary

### New Files Created

```
apps/backend/src/modules/displays/
├── controllers/
│   ├── displays.controller.ts      # CRUD endpoints for displays
│   └── registration.controller.ts  # Public registration endpoint
├── dto/
│   ├── register-display.dto.ts     # Registration request DTO
│   └── update-display.dto.ts       # Update display DTO
├── entities/
│   └── displays.entity.ts          # Unified DisplayEntity
├── models/
│   └── displays-response.model.ts  # API response models
├── services/
│   ├── displays.service.ts         # CRUD operations
│   ├── registration.service.ts     # Registration logic with token generation
│   └── module-reset.service.ts     # Factory reset handler
├── validators/
│   └── display-exists-constraint.validator.ts
├── displays.constants.ts           # Module constants and event types
├── displays.exceptions.ts          # Custom exceptions
├── displays.module.ts              # Module definition
└── displays.openapi.ts             # Swagger models registration
```

### Key Changes by Module

| Module | Changes |
|--------|---------|
| **Auth** | Added `TokenOwnerType` enum; Updated `LongLiveTokenEntity` with `ownerType`/`ownerId`; Removed display registration endpoint |
| **Users** | Removed `DisplayInstanceEntity`, `UserRole.DISPLAY`, display services/controllers |
| **System** | Removed `DisplayProfileEntity`, display services/controllers |
| **Config** | Removed `SectionType.DISPLAY`, `DisplayConfigModel` |
| **Dashboard** | Updated `PageEntity` to reference `DisplayEntity`; Updated services and DTOs |
| **WebSocket** | Updated authentication to use `type: 'display'` |
| **Devices** | Updated property command service auth check |

### Database Schema Changes

- **New table:** `displays_module_displays` (unified display entity)
- **Removed tables:** `system_module_displays_profiles`, `users_module_displays_instances`
- **Modified table:** `auth_module_tokens` (added `ownerType` column)
- **Modified table:** `users_module_users` (removed 'display' from role enum)
