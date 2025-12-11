# Token and Display Reset Analysis

## User Question
When a user removes a token or display, will the panel app be safely reset? The user wants to ensure that only the access token is cleared, not other important state.

## Current Implementation

### What Gets Cleared

1. **Access Token** ✅
   - Cleared from secure storage (`_clearStoredApiSecret()`)
   - Removed from API client headers
   - Location: `startup_manager.dart:530-538`

2. **Display Model** ✅ (Now explicitly cleared)
   - Display model is cleared before re-registration
   - Ensures no stale data remains
   - Location: `startup_manager.dart:472-482`, `display.dart:101-104`

### What Gets Preserved

1. **Backend URL** ✅
   - `_currentBackendUrl` is preserved
   - Stored backend URL remains in secure storage
   - App doesn't need to rediscover the backend
   - Location: `startup_manager.dart:76`

2. **API Client Configuration** ✅
   - API client is recreated/updated with new token
   - Base URL remains the same
   - Location: `startup_manager.dart:190`

3. **Socket Service** ✅
   - Socket service is reinitialized with new token
   - Connection URL remains the same
   - Location: `startup_manager.dart:291`

4. **Other Module State** ✅
   - Other modules (config, system, weather, devices, dashboard) remain registered
   - Their state is preserved (they don't depend on display token)

## Reset Flow

### Scenario 1: Token Revoked/Deleted

```
1. API call → 401 Unauthorized
2. TokenRefreshInterceptor → Attempts refresh
3. Refresh fails → Returns authenticationFailed
4. _clearStoredApiSecret() → Clears token only
5. Display model cleared (if module registered)
6. Re-registration → New token + new display model
```

### Scenario 2: Display Deleted

```
1. API call to /me → 404 Not Found
2. fetchCurrentDisplay() → Returns notFound
3. _clearStoredApiSecret() → Clears token only
4. Display model cleared (if module registered)
5. Re-registration → New token + new display model
```

## Safety Guarantees

✅ **Only Token Cleared**: The `_clearStoredApiSecret()` method only clears:
- Token from secure storage
- Authorization header from API client
- Does NOT clear backend URL or other state

✅ **Display Model Cleared**: Display model is explicitly cleared before re-registration to prevent stale data

✅ **Backend URL Preserved**: Backend URL is preserved, so app doesn't need to rediscover

✅ **Clean Re-registration**: New display model is set from registration response, ensuring fresh data

## Code Changes Made

1. **Made `setDisplay()` nullable** (`display.dart:101-104`)
   - Allows clearing display model by passing `null`
   - Type-safe implementation

2. **Added explicit display model clearing** (`startup_manager.dart:472-482`)
   - Clears display model before re-registration
   - Only clears if module is registered (safe check)
   - Prevents stale data issues

## Verification

- ✅ Dart analyzer passes
- ✅ Only token is cleared (not backend URL)
- ✅ Display model is explicitly cleared
- ✅ Backend URL and other state preserved
- ✅ Clean re-registration flow

## Conclusion

✅ **The panel app is safely reset:**
- Only the access token is cleared (as requested)
- Display model is explicitly cleared to prevent stale data
- Backend URL and other important state are preserved
- Clean re-registration ensures fresh data

The implementation ensures that when a token or display is removed, the app safely resets only the necessary authentication state while preserving important configuration like the backend URL.
