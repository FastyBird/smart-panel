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

- Migration of existing display data (handled separately)
- Changes to AccessToken/RefreshToken structure (they remain user-only)
- Changes to WebSocket protocol
- Changes to admin UI (handled in separate task)

## 4. Acceptance criteria

- [x] New `displays` module created with `DisplayEntity` containing all display fields
- [x] `LongLiveTokenEntity` supports `TokenOwnerType.DISPLAY` with `ownerType` and `ownerId` columns
- [x] Display registration endpoint creates display and issues long-lived token
- [x] WebSocket authentication accepts display tokens
- [x] `DisplayInstanceEntity` removed from users module
- [x] `DisplayProfileEntity` removed from system module
- [x] `DisplayConfigModel` removed from config module
- [x] `UserRole.DISPLAY` removed from users module
- [x] Dashboard module references new `DisplayEntity`
- [x] All tests pass
- [x] Database migration created and tested

## 5. Example scenarios (optional)

### Scenario: Display Registration
1. Panel app calls `POST /displays-module/register` with MAC address and device info
2. Backend creates `DisplayEntity` with all provided information
3. Backend generates long-lived token with `TokenOwnerType.DISPLAY`
4. Backend returns token and display data to panel app
5. Panel app stores token and uses it for subsequent API calls

### Scenario: Display WebSocket Connection
1. Panel app connects to WebSocket with display token in auth
2. Backend validates token and extracts `ownerType` and `ownerId`
3. Backend assigns display to `DISPLAY_INTERNAL_ROOM`
4. Display receives real-time updates via WebSocket

## 6. Technical constraints

- Must use TypeORM for database operations
- Must follow existing module structure (controllers, services, entities, DTOs)
- Must maintain OpenAPI specification compatibility
- Must support existing WebSocket authentication flow
- Token expiration: 1 year (configurable)

## 7. Implementation hints (optional)

- Start with creating the new `displays` module structure
- Create `DisplayEntity` by merging fields from `DisplayInstanceEntity`, `DisplayProfileEntity`, and `DisplayConfigModel`
- Update `LongLiveTokenEntity` to support polymorphic ownership
- Create registration endpoint with `@Public()` decorator (no auth required)
- Update WebSocket auth service to handle display tokens
- Remove old entities after all references are updated

## 8. AI instructions (for Junie / AI)

When implementing this task:
1. Create new `displays` module following existing module patterns
2. Merge display-related fields from users, system, and config modules
3. Implement token-based authentication for displays
4. Update all references to old display entities
5. Ensure backwards compatibility where possible
6. Write comprehensive tests for new functionality
7. Update OpenAPI specifications
8. Create database migration

## Implementation Summary

### New Files Created

- `apps/backend/src/modules/displays/` - New displays module
  - `displays.module.ts` - Module definition
  - `displays.constants.ts` - Constants and enums
  - `entities/displays.entity.ts` - Unified DisplayEntity
  - `controllers/displays.controller.ts` - Display management endpoints
  - `controllers/registration.controller.ts` - Display registration endpoint
  - `services/displays.service.ts` - Display business logic
  - `services/registration.service.ts` - Registration logic
  - `dto/update-display.dto.ts` - Update DTO
  - `guards/registration.guard.ts` - Registration guard
  - `models/displays-response.model.ts` - Response models
  - `exceptions/displays.exceptions.ts` - Custom exceptions

### Key Changes by Module

**Auth Module:**
- Added `TokenOwnerType` enum (USER, DISPLAY, THIRD_PARTY)
- Updated `LongLiveTokenEntity` with `ownerType` and `ownerId` columns
- Updated `TokensService` to support display tokens
- Updated `WsAuthService` to authenticate display tokens

**Users Module:**
- Removed `DisplayInstanceEntity`
- Removed `UserRole.DISPLAY`
- Updated user-related services to exclude display logic

**System Module:**
- Removed `DisplayProfileEntity`
- Removed display-related methods

**Config Module:**
- Removed `DisplayConfigModel`
- Removed display-related configuration

**Dashboard Module:**
- Updated `PageEntity` to reference new `DisplayEntity`
- Updated services to use new display entity

### Database Schema Changes

- New table: `displays_module_displays` with all display fields
- Updated table: `auth_long_live_tokens` with `ownerType` and `ownerId` columns
- Removed tables: `users_module_display_instances`, `system_module_display_profiles`
- Migration created to handle data migration
