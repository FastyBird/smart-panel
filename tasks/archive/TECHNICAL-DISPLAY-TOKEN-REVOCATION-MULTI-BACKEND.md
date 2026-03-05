# Task: Display Token Revocation and Multi-Backend Migration Support
ID: TECHNICAL-DISPLAY-TOKEN-REVOCATION-MULTI-BACKEND
Type: technical
Scope: backend, admin, panel
Size: large
Parent: (none)
Status: done

## 1. Business goal

In order to support multiple backend instances and enable secure display management across different backends
As a system administrator
I want displays to gracefully handle token revocation, display deletion, and migration between backends with proper state reset and backend switching capabilities

## 2. Context

- **Existing implementation:**
  - Display registration with permit join security mechanism
  - Token refresh mechanism via Dio interceptor
  - WebSocket connections for real-time updates
  - Backend discovery via mDNS
  - Display deletion removes display entity and tokens

- **Current limitations:**
  - No socket notifications for token revocation or display deletion
  - No way to reset panel app to discovery state when display is removed
  - No support for migrating displays between different backend instances
  - Panel app doesn't handle backend switching during re-registration

- **Reference locations:**
  - Backend: `apps/backend/src/modules/displays/`
  - Admin: `apps/admin/src/modules/displays/`
  - Panel: `apps/panel/lib/modules/displays/`, `apps/panel/lib/core/services/startup_manager.dart`

## 3. Scope

**In scope**

### Backend Changes
- Add `DISPLAY_TOKEN_REVOKED` event type
- Emit token revoked event when token is revoked via admin
- Emit display deleted event (already exists, verified)
- Ensure events are sent to `DISPLAY_INTERNAL_ROOM` via WebSocket
- Add explicit page-display relation cleanup on display deletion
- Inject `DataSource` into `DisplaysService` for join table cleanup

### Panel App Changes
- Add socket event handlers for `DISPLAY_TOKEN_REVOKED` and `DISPLAY_DELETED`
- Implement `resetToDiscovery()` method in `StartupManagerService`
- Add EventBus integration for reset events
- Handle token revocation via socket (attempt refresh, reset if fails)
- Handle display deletion via socket (reset to discovery state)
- Clear display model and disconnect sockets on reset
- Support backend switching during re-registration (via existing discovery screen)
- Make `setDisplay()` nullable to allow clearing display model
- Add explicit display model clearing before re-registration
- Improve error messages for token revocation and display deletion scenarios

### Admin App Changes
- No changes required (existing permit join UI is sufficient)

**Out of scope**

- Website changes
- Documentation changes (handled separately)
- Changes to permit join mechanism (already implemented)
- Changes to registration flow (already implemented)

## 4. Acceptance criteria

### Backend
- [x] `DISPLAY_TOKEN_REVOKED` event type added to constants
- [x] Token revocation endpoint emits socket event
- [x] Display deleted event is emitted to `DISPLAY_INTERNAL_ROOM`
- [x] All events are properly transformed and sent via WebSocket gateway
- [x] Explicit page-display relation cleanup on display deletion
- [x] Join table entries removed when display is deleted
- [x] Unit tests updated to verify cleanup
- [x] Unit tests pass
- [x] TypeScript checks pass
- [x] Linter checks pass

### Panel App
- [x] Socket event handler for `DISPLAY_TOKEN_REVOKED` implemented
- [x] Socket event handler for `DISPLAY_DELETED` implemented
- [x] `resetToDiscovery()` method clears token, backend URL, disconnects sockets
- [x] EventBus integration triggers app state change to discovery
- [x] Display model is cleared on reset
- [x] `setDisplay()` method made nullable to allow clearing
- [x] Explicit display model clearing before re-registration
- [x] Token revocation via socket attempts refresh, resets if fails
- [x] Display deletion via socket resets to discovery state immediately
- [x] Discovery screen allows backend switching (mDNS or manual)
- [x] Re-registration supports new backend URL
- [x] Improved error messages for different scenarios
- [x] All error scenarios handled gracefully
- [x] Dart analyzer passes

### Integration
- [x] Display removed while online → Socket event → Reset to discovery
- [x] Display removed while offline → Token refresh fails → Reset to discovery
- [x] Token revoked via admin → Socket event → Attempt refresh → Reset if fails
- [x] Backend switching works via discovery screen
- [x] All state is properly cleaned up on reset

## 5. Example scenarios

### Scenario: Display Removed While Panel is Online

Given a panel app is connected to backend A
And the display is registered and authenticated
When an administrator removes the display in the admin app
Then the backend emits `DISPLAY_DELETED` event via WebSocket
And the panel app receives the event
And the panel app clears the display model
And the panel app disconnects from sockets
And the panel app resets to discovery state
And the user can select a new backend (backend B) via discovery screen
And the panel app re-registers with backend B

### Scenario: Display Removed While Panel is Offline

Given a panel app is offline
And the display was registered with backend A
When an administrator removes the display in the admin app
And the panel app is turned on
Then the panel app attempts to fetch display with stored token
And the API call returns 404 Not Found
And the panel app clears the token and display model
And the panel app goes to re-registration flow
And the user can change backend URL before re-registering
And the panel app re-registers with the selected backend

### Scenario: Token Revoked Via Admin

Given a panel app is connected to backend A
And the display has an active token
When an administrator revokes the token in the admin app
Then the backend emits `DISPLAY_TOKEN_REVOKED` event via WebSocket
And the panel app receives the event
And the panel app attempts to refresh the token
And if refresh fails (token already revoked), the panel app resets to discovery state
And the user can select a new backend if needed
And the panel app re-registers with permit join enabled

## 6. Technical constraints

- Must use existing EventBus for app state changes
- Must use existing WebSocket gateway for event emission
- Must follow existing module structure
- Must maintain backward compatibility
- Must not break existing registration flow
- Must preserve backend URL in storage until explicitly cleared
- Must properly clean up all state on reset

## 7. Implementation hints

- Use `EventEmitter2` in backend controllers to emit events
- WebSocket gateway automatically sends events to `DISPLAY_INTERNAL_ROOM`
- Use `ResetToDiscoveryEvent` via EventBus to trigger app state change
- Discovery screen already supports mDNS and manual URL entry
- Socket service already handles disconnection properly
- Display model clearing is safe (nullable setDisplay method)

## 8. AI instructions

- Read this file entirely before making any code changes
- Review existing socket event handling patterns
- Review existing EventBus usage in panel app
- Ensure all state cleanup is comprehensive
- Test all scenarios manually after implementation
- Verify no memory leaks or resource leaks on reset

## Implementation Summary

### Backend Changes

**Files Modified:**
- `apps/backend/src/modules/displays/displays.constants.ts`
  - Added `DISPLAY_TOKEN_REVOKED` event type

- `apps/backend/src/modules/displays/controllers/displays.controller.ts`
  - Added `EventEmitter2` injection
  - Emit `DISPLAY_TOKEN_REVOKED` event when token is revoked
  - Display deleted event already emitted via service

- `apps/backend/src/modules/displays/services/displays.service.ts`
  - Added `DataSource` injection
  - Added explicit cleanup of page-display join table on display deletion
  - Ensures no orphaned relations remain

- `apps/backend/src/modules/displays/services/displays.service.spec.ts`
  - Updated tests to verify join table cleanup
  - Added `DataSource` mock

**Key Implementation:**
```typescript
// Emit token revoked event
this.eventEmitter.emit(EventType.DISPLAY_TOKEN_REVOKED, { id: display.id });

// Clean up page-display relations on display deletion
await this.dataSource.query('DELETE FROM dashboard_module_pages_displays WHERE displayId = ?', [id]);
```

### Panel App Changes

**Files Modified:**
- `apps/panel/lib/modules/displays/constants.dart`
  - Added `displayTokenRevokedEvent` constant

- `apps/panel/lib/modules/displays/module.dart`
  - Added `_registerSocketEventHandlers()` method
  - Added `_unregisterSocketEventHandlers()` method
  - Added `_socketDisplayDeletedHandler()` method
  - Added `_socketTokenRevokedHandler()` method
  - Handles display deletion → reset to discovery
  - Handles token revocation → attempt refresh → reset if fails

- `apps/panel/lib/modules/displays/repositories/display.dart`
  - Made `setDisplay()` method nullable to allow clearing display model
  - Improved error messages for token revocation and display deletion

- `apps/panel/lib/core/services/startup_manager.dart`
  - Added explicit display model clearing before re-registration
  - Improved error messages distinguishing between scenarios

- `apps/panel/lib/core/services/startup_manager.dart`
  - Added `resetToDiscovery()` method
  - Clears token, backend URL, disconnects sockets
  - Clears display model
  - Emits `ResetToDiscoveryEvent` via EventBus

- `apps/panel/lib/app/app.dart`
  - Added EventBus listener for `ResetToDiscoveryEvent`
  - Transitions app to discovery state on reset event
  - Properly disposes subscription

**Key Implementation:**
```dart
// Reset to discovery
Future<void> resetToDiscovery() async {
  await _clearStoredApiSecret();
  await _clearStoredBackendUrl();
  _socketClient.dispose();
  displaysModule.displayRepository.setDisplay(null);
  _eventBus.fire(ResetToDiscoveryEvent());
}
```

### Integration Points

1. **Socket Events:**
   - Backend emits events to `DISPLAY_INTERNAL_ROOM`
   - Panel app registers handlers for specific events
   - Events trigger appropriate actions (refresh or reset)

2. **State Management:**
   - EventBus coordinates app state changes
   - StartupManager handles cleanup
   - DisplayRepository manages display model state

3. **Backend Switching:**
   - Discovery screen provides mDNS and manual entry
   - Re-registration uses new backend URL
   - All state is properly reset before switching

4. **Data Integrity:**
   - Page-display relations explicitly cleaned up on display deletion
   - No orphaned join table entries remain
   - Database integrity maintained

## Testing Checklist

### Backend
- [x] Token revocation emits socket event
- [x] Display deletion emits socket event
- [x] Events are sent to correct room
- [x] Page-display relations cleaned up on display deletion
- [x] Join table cleanup verified in tests
- [x] Unit tests pass
- [x] TypeScript checks pass
- [x] Linter checks pass

### Panel App
- [x] Socket event handlers registered correctly
- [x] Display deleted event triggers reset
- [x] Token revoked event attempts refresh
- [x] Reset clears all state properly
- [x] EventBus triggers app state change
- [x] Discovery screen allows backend switching
- [x] Re-registration works with new backend
- [x] Dart analyzer passes

### Integration
- [x] Display removed while online → Reset works
- [x] Display removed while offline → Re-registration works
- [x] Token revoked → Refresh attempt → Reset if fails
- [x] Backend switching via discovery screen
- [x] Page-display relations cleaned up when display deleted
- [x] All state properly cleaned up
- [x] No memory leaks or resource leaks
- [x] No orphaned database relations

## Related Documentation

- See `docs/architecture/Multi-Backend-Migration.md` for detailed implementation
- See `docs/domain/Display-Deletion-Revocation.md` for deletion scenarios
- See `docs/security/Token-Refresh-Permit-Join.md` for token handling
