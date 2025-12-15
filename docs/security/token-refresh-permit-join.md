# Token Refresh and Permit Join Requirements

## Question 1: Does Token Refresh Require Permit Join?

### Answer: ❌ **NO** - Token refresh does NOT require permit join

**Reasoning:**
- Token refresh endpoint (`/modules/displays/displays/me/refresh-token`) is an **authenticated endpoint**
- It requires a valid token to access (uses `@AuthGuard`)
- It's only accessible by displays (checks `TokenOwnerType.DISPLAY`)
- Permit join is only required for **new registrations**, not for existing displays refreshing their tokens
- Location: `apps/backend/src/modules/displays/controllers/displays.controller.ts:114-143`

**Flow:**
1. Display has expired token
2. API call fails with 401
3. `TokenRefreshInterceptor` intercepts the error
4. Calls `/me/refresh-token` with the expired token (still valid for authentication)
5. Backend validates the token and issues a new one
6. No permit join check is performed

**Backend Implementation:**
```typescript
@Post('me/refresh-token')
@ApiOperation({
  summary: 'Refresh display token',
  description: 'Refreshes the current display token. Returns a new long-lived token and revokes the old one. Only accessible by displays.',
})
async refreshToken(@Req() req: AuthenticatedRequest) {
  // Requires valid authentication (AuthGuard)
  // Checks that requester is a display
  // Does NOT check permit join status
  // ...
}
```

## Question 2: Lost Token Scenario - Refresh or Re-registration?

### Answer: ✅ **Re-registration required** - Lost token requires permit join

**Reasoning:**
- If token is lost from storage (`_apiSecret == null`), there's no way to authenticate
- Without authentication, the refresh endpoint cannot be accessed
- The app must go through the registration process
- Registration requires permit join to be enabled (unless localhost in ALL_IN_ONE/COMBINED mode)

**Flow:**
1. App starts, tries to read token from storage
2. Token is `null` (lost/corrupted/deleted)
3. `_apiSecret == null` → skips `_tryInitializeWithStoredToken()`
4. Goes directly to `_registerDisplay()`
5. `_registerDisplay()` calls `_checkRegistrationStatus()`
6. If permit join is closed → throws error: "Registration is not currently permitted"
7. If permit join is open → proceeds with registration

**Code Location:**
- Token check: `startup_manager.dart:228-232`
- Initialization logic: `startup_manager.dart:451-472`
- Registration: `startup_manager.dart:534-684`

**Implementation:**
```dart
Future<void> _initialize() async {
  // Try to initialize with stored token if available
  if (_apiSecret != null) {
    final success = await _tryInitializeWithStoredToken();
    if (success) {
      return; // Success with stored token
    }
    // Token invalid - clear it and re-register
    await _clearStoredApiSecret();
  }
  
  // No valid token - register the display
  // This REQUIRES permit join to be enabled
  await _registerDisplay();
}
```

## Scenarios Summary

| Scenario | Token Status | Permit Join Required? | Action |
|----------|-------------|----------------------|--------|
| **Token Expired** | Expired but exists | ❌ NO | Automatic refresh via interceptor |
| **Token Lost** | Not in storage | ✅ YES | Re-registration required |
| **Token Invalid** | Invalid/revoked | ✅ YES | Re-registration required |
| **Token Valid** | Valid | ❌ NO | Normal operation |
| **New Display** | No token | ✅ YES | Initial registration |

## Key Points

1. **Token Refresh** = Authenticated operation, no permit join needed
   - Uses existing (even if expired) token for authentication
   - Backend validates token and issues new one
   - Works automatically via `TokenRefreshInterceptor`

2. **Re-registration** = Public operation, permit join required
   - No token available for authentication
   - Must go through registration endpoint
   - Requires permit join to be active (or localhost exception)

3. **Lost Token Recovery**
   - Cannot be recovered automatically
   - Must re-register with permit join enabled
   - Admin must activate permit join in admin panel

## Recommendations

### For Users
- **Token expired**: No action needed - app refreshes automatically
- **Token lost**: Contact admin to enable permit join, then restart app

### For Administrators
- Keep permit join disabled for security
- Enable permit join only when:
  - New displays need to register
  - Existing displays have lost their tokens
  - After enabling, displays can register within the time window

### For Developers
- Token refresh is transparent to users
- Lost token scenario requires user/admin intervention
- Consider adding UI notification when permit join is required
