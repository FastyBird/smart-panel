# Display Deletion and Token Revocation Scenarios

## Current Implementation Analysis

### ✅ Scenario 1: User Revokes Display Token in Admin

**Status**: ✅ **Handled**

**Backend Behavior:**
- Token is marked as `revoked: true` in database
- Token still exists but is invalid
- Location: `displays.controller.ts:273-282`

**Panel App Behavior:**
- Next API call → 401 Unauthorized
- `TokenRefreshInterceptor` intercepts → Attempts refresh
- Refresh endpoint checks `storedToken.revoked` → Throws `UnauthorizedException('Token has been revoked')`
- Refresh fails → Returns `FetchDisplayResult.authenticationFailed`
- App clears token and re-registers
- **Requires permit join** for re-registration

**Flow:**
```
Token Revoked → API Call → 401 → Interceptor → Refresh Attempt → 401 (revoked) → 
Authentication Failed → Clear Token → Re-register → Permit Join Required
```

**Location:**
- Backend: `registration.service.ts:126-129`
- Panel: `display.dart:340-360`, `startup_manager.dart:499-503`

### ✅ Scenario 2: User Manually Deletes Token from Database

**Status**: ✅ **Handled**

**Backend Behavior:**
- Token row deleted from `auth_long_live_tokens` table
- Token no longer exists in database
- Display entity still exists

**Panel App Behavior:**
- Next API call → 401 Unauthorized
- `TokenRefreshInterceptor` intercepts → Attempts refresh
- Refresh endpoint: `storedToken` is `null` → Throws `UnauthorizedException('Invalid token')`
- Refresh fails → Returns `FetchDisplayResult.authenticationFailed`
- App clears token and re-registers
- **Requires permit join** for re-registration

**Flow:**
```
Token Deleted → API Call → 401 → Interceptor → Refresh Attempt → 401 (not found) → 
Authentication Failed → Clear Token → Re-register → Permit Join Required
```

**Location:**
- Backend: `registration.service.ts:121-124`
- Panel: `display.dart:340-360`, `startup_manager.dart:499-503`

### ✅ Scenario 3: User Removes Display from Admin/Database

**Status**: ✅ **Handled**

**Backend Behavior:**
- Display entity deleted from database
- **Page-display relations explicitly cleaned up** (join table entries removed)
- Location: `displays.service.ts:95-105`

**Panel App Behavior:**
- Next API call to `/me` → 404 Not Found
- `fetchCurrentDisplay()` returns `FetchDisplayResult.notFound`
- App clears token and re-registers
- **Requires permit join** for re-registration

**Flow:**
```
Display Deleted → API Call → 404 → Not Found → Clear Token → Re-register → Permit Join Required
```

**Location:**
- Backend: `displays.service.ts:95-105`
- Panel: `display.dart:369-370`, `startup_manager.dart:505-509`

## ✅ Extra Task: Page-Display Relation Cleanup

**Status**: ✅ **Implemented**

**Implementation:**
- Explicit cleanup added in `DisplaysService.remove()`
- Deletes entries from `dashboard_module_pages_displays` join table before removing display
- Ensures no orphaned relations remain
- Location: `displays.service.ts:100-102`

**Code:**
```typescript
async remove(id: string): Promise<void> {
  const display = await this.getOneOrThrow(id);
  
  // Explicitly clean up page-display relations in the join table
  await this.dataSource.query('DELETE FROM dashboard_module_pages_displays WHERE displayId = ?', [id]);
  
  await this.repository.remove(display);
  this.eventEmitter.emit(EventType.DISPLAY_DELETED, { id });
}
```

**Verification:**
- When display is deleted, join table entries are removed
- Pages no longer reference the deleted display
- No orphaned relations remain in database

## Summary

| Scenario | Backend Behavior | Panel App Behavior | Permit Join Required? |
|----------|-----------------|-------------------|----------------------|
| **Token Revoked** | Token marked `revoked: true` | 401 → Refresh fails → Re-register | ✅ YES |
| **Token Deleted** | Token row deleted | 401 → Refresh fails → Re-register | ✅ YES |
| **Display Deleted** | Display + relations cleaned up | 404 → Re-register | ✅ YES |

## Key Points

1. **All scenarios are handled** - App gracefully handles all failure cases
2. **Page-display relations are cleaned up** - Explicit cleanup ensures no orphaned data
3. **Re-registration required** - All scenarios require permit join for re-registration
4. **Clear error messages** - Improved logging distinguishes between scenarios

## Testing Checklist

- [ ] Token revoked → App handles gracefully → Re-registers with permit join
- [ ] Token deleted from DB → App handles gracefully → Re-registers with permit join
- [ ] Display deleted → App handles gracefully → Re-registers with permit join
- [ ] Display deleted → Page-display relations cleaned up (join table entries removed)
- [ ] Error messages are clear and specific
- [ ] All scenarios show appropriate UI messages
