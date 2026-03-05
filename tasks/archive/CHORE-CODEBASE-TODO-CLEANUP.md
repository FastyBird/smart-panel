# Task: Codebase TODO Cleanup
ID: CHORE-CODEBASE-TODO-CLEANUP
Type: chore
Scope: backend, admin, panel
Size: large
Parent: (none)
Status: done

## 1. Business goal

In order to improve code quality and complete unfinished features
As a developer
I want to address all TODO comments and incomplete implementations across the codebase

## 2. Context

- **Total items found**: 28 TODOs/incomplete implementations
- **Distribution**: Panel (13), Admin (10), Backend (5)
- **Priority levels**: High (16), Medium (9), Low (3)
- Related features that left TODOs:
  - Space undo history (climate restoration)
  - Panel space page API integration
  - Admin device controls and route handling

## 3. Scope

**In scope**

- Address all TODO comments documented below
- Complete placeholder implementations
- Add proper error handling where missing
- Integrate Panel API calls after OpenAPI regeneration

**Out of scope**

- New feature development beyond completing existing stubs
- Major architectural changes
- Third-party plugin development (Shelly-NG input processing)

## 4. Acceptance criteria

### Phase 1: Backend - Climate Undo Support
- [x] Implement climate state restoration in `SpaceUndoHistoryService.restoreSnapshot()`
- [x] Enable climate undo snapshot capture in `SpaceIntentService`
- [x] Add tests for climate undo functionality

### Phase 2: Admin - Route Error Handling
- [x] Implement proper error handling in `view-channel-property-add.vue` (5 locations)
- [x] Implement proper error handling in `view-channel-property-edit.vue` (2 locations)
- [x] Add user-facing error messages for route navigation failures

### Phase 3: Admin - Device Controls
- [x] Implement device controls loading in `view-device.vue:408`
- [x] Test controls are displayed correctly in device view

### Phase 4: Admin - Auth Features
- [x] Implement user edit handler in `session.store.ts:221`
- [x] Implement user registration handler in `session.store.ts:227`
- [x] Add proper API calls for user management

### Phase 5: Admin - Event Handling
- [x] Implement channel property event handling in `devices.module.ts:178`

### Phase 6: Panel - API Integration
- [x] Run `melos rebuild-api` to generate API client
- [x] Integrate lighting state loading (`space.dart:142`)
- [x] Integrate climate state loading (`space.dart:183`)
- [x] Integrate set climate setpoint (`space.dart:225`)
- [x] Integrate set lighting mode (`space.dart:265`)
- [x] Integrate apply suggestion (`space.dart:311`)
- [x] Integrate dismiss suggestion (`space.dart:382`)
- [x] Integrate execute intent (`space.dart:423`)
- [x] Integrate apply quick action (`space.dart:466`)
- [x] Integrate execute quick action (`space.dart:526`)
- [x] Integrate execute quick action with parameter (`space.dart:594`)
- [x] Integrate undo state refresh (`space.dart:631`)
- [x] Integrate device list rendering (`space.dart:1898`)

### Phase 7: Panel - Localization
- [x] Run `flutter gen-l10n` and integrate localization (`space.dart:99`)

### Phase 8: Low Priority / Future
- [x] Document Shelly-NG input processing for future implementation (`device-manager.service.ts:772`)

---

## 5. Detailed TODO Inventory

### HIGH PRIORITY - Backend Climate Support

#### 1. Climate State Restoration
**File**: `apps/backend/src/modules/spaces/services/space-undo-history.service.ts:259`
```typescript
// TODO: Restore climate state when supported
```
**Description**: Undo history only restores lighting state, not climate state.

#### 2. Climate Undo Snapshot
**File**: `apps/backend/src/modules/spaces/services/space-intent.service.ts:678-680`
```typescript
// NOTE: Climate undo is not captured because restoreSnapshot() only restores lighting.
// TODO: Enable this once SpaceUndoHistoryService.restoreSnapshot() supports climate restoration.
```
**Description**: Climate snapshot capture is disabled pending restoration support.

---

### HIGH PRIORITY - Admin Device Controls

#### 3. Device Controls Loading
**File**: `apps/admin/src/modules/devices/views/view-device.vue:408`
```typescript
// TODO: Load controls
```
**Description**: Device control loading returns empty array. Controls UI is non-functional.

---

### MEDIUM PRIORITY - Admin Route Handling

#### 4-8. Invalid Route Handling (view-channel-property-add.vue)
**File**: `apps/admin/src/modules/devices/views/view-channel-property-add.vue`
**Lines**: 288, 314, 351, 401, 426
```typescript
// TODO: Handle invalid route
```
**Description**: Empty catch blocks silently ignore route navigation errors.

#### 9-10. Invalid Route Handling (view-channel-property-edit.vue)
**File**: `apps/admin/src/modules/devices/views/view-channel-property-edit.vue`
**Lines**: 293, 319
```typescript
// TODO: Handle invalid route
```
**Description**: Same issue - 2 instances of unimplemented route error handling.

---

### MEDIUM PRIORITY - Admin Auth/User Management

#### 11. User Edit Handler
**File**: `apps/admin/src/modules/auth/store/session.store.ts:221`
```typescript
// TODO: Handle edit
```
**Description**: User edit functionality only logs payload, doesn't process it.

#### 12. User Registration Handler
**File**: `apps/admin/src/modules/auth/store/session.store.ts:227`
```typescript
// TODO: Handle registration
```
**Description**: User registration functionality only logs payload, doesn't process it.

---

### MEDIUM PRIORITY - Admin Event Handling

#### 13. Property Event Handling
**File**: `apps/admin/src/modules/devices/devices.module.ts:178`
```typescript
// TODO: handle property event
```
**Description**: Channel property set events are not being processed.

---

### HIGH PRIORITY - Panel API Integration

All in `apps/panel/lib/features/dashboard/presentation/pages/space.dart`:

| # | Line | Method | Description |
|---|------|--------|-------------|
| 14 | 99 | - | Localization strings hardcoded |
| 15 | 142 | `_loadLightingState()` | Lighting state loading placeholder |
| 16 | 183 | `_loadClimateState()` | Climate state loading placeholder |
| 17 | 225 | - | Set climate setpoint placeholder |
| 18 | 265 | - | Set lighting mode placeholder |
| 19 | 311 | - | Apply suggestion placeholder |
| 20 | 382 | - | Dismiss suggestion placeholder |
| 21 | 423 | - | Execute intent placeholder |
| 22 | 466 | - | Apply quick action placeholder |
| 23 | 526 | - | Execute quick action placeholder |
| 24 | 594 | - | Execute quick action with param placeholder |
| 25 | 631 | - | Undo state refresh disabled |
| 26 | 1898 | - | Device list rendering placeholder |

---

### LOW PRIORITY - Future Enhancement

#### 27. Shelly-NG Device Input Processing
**File**: `apps/backend/src/plugins/devices-shelly-ng/services/device-manager.service.ts:772`
```typescript
// TODO: To be implemented in the future
```
**Description**: Device input status handling for Shelly-NG devices is logged but not processed.

---

## 6. Technical constraints

- Follow the existing module/service structure
- Do not introduce new dependencies unless really needed
- Do not modify generated code (OpenAPI specs, API clients)
- Tests are expected for new logic
- Panel API changes require running `melos rebuild-api` first
- Localization changes require running `flutter gen-l10n`

## 7. Implementation hints

### Climate Undo
- Look at `SpaceUndoHistoryService.restoreSnapshot()` for lighting restoration pattern
- Extend `SpaceStateSnapshot` model if needed for climate data
- Follow same pattern used for lighting in `SpaceIntentService`

### Admin Route Handling
- Use Vue Router error handling patterns
- Show toast/notification for route errors
- Consider redirect to safe fallback route

### Panel API Integration
- Generate API client: `melos rebuild-api`
- Follow existing API call patterns in other pages
- Handle loading states and errors consistently

## 8. AI instructions

- Read this file entirely before making any code changes
- Start by replying with a short implementation plan (max 10 steps)
- Keep changes scoped to this task
- For each acceptance criterion, either implement it or explain why it's skipped
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`
- Prioritize phases in order (Backend → Admin → Panel)
- Run tests after each phase to ensure no regressions

## 9. Progress tracking

| Phase | Status | Notes |
|-------|--------|-------|
| 1. Backend Climate Undo | ✅ done | Implemented climate state restoration and enabled snapshot capture |
| 2. Admin Route Handling | ✅ done | Fixed 7 locations with channels list fallback |
| 3. Admin Device Controls | ✅ done | Implemented controls loading via store |
| 4. Admin Auth Features | ✅ done | Implemented edit and register handlers |
| 5. Admin Event Handling | ✅ done | Implemented CHANNEL_PROPERTY_SET event handling |
| 6. Panel API Integration | ✅ done | Generated APIs with swagger_parser + build_runner, integrated into space.dart |
| 7. Panel Localization | ✅ done | Generated l10n with flutter gen-l10n, integrated localized strings |
| 8. Future Items | ✅ done | Documented Shelly-NG input processing |
