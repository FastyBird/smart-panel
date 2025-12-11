# Display Registration and Token Handling - Validation Scenarios

## Current Implementation Analysis

### ✅ Scenario 1: New Display is Connected
**Status**: ✅ Handled
- Flow: `_registerDisplay()` → Registration endpoint → Store token → Initialize display
- Error handling: Handles 403 (permit join closed), 409 (already registered)
- Location: `startup_manager.dart:526-676`

### ✅ Scenario 2: Existing Display with Lost Access Token
**Status**: ✅ Handled
- Flow: `_tryInitializeWithStoredToken()` → Fails → Clear token → `_registerDisplay()`
- Error handling: Detects authentication failure and re-registers
- Location: `startup_manager.dart:469-512`

### ✅ Scenario 3: Existing Display with Expired Token (Offline → Online)
**Status**: ✅ Handled
- Flow: `fetchCurrentDisplay()` → 401 → `refreshToken()` → Retry
- Location: `display.dart:273-380`

### ⚠️ Scenario 4: Backend is Down
**Status**: ⚠️ Partially Handled
- Flow: `_waitForBackend()` → Pings health endpoint → Timeout after 30s
- Issue: No retry mechanism after timeout, user must restart app
- Location: `startup_manager.dart:745-772`

### ✅ Scenario 5: Token Expires During Runtime (Mid-Session)
**Status**: ✅ Handled
- Implementation: Dio interceptor automatically refreshes token on 401 errors
- Flow: API call → 401 → `TokenRefreshInterceptor` → `refreshToken()` → Retry request
- Features:
  - Queues concurrent requests during refresh
  - Prevents infinite refresh loops
  - Updates all pending requests with new token
- Location: `core/interceptors/token_refresh_interceptor.dart`

### ❌ Scenario 6: Network Interruption During Registration
**Status**: ❌ Partially Handled
- Issue: Network errors during registration might not be clearly communicated
- Missing: Better error messages for network failures

### ❌ Scenario 7: Backend Restart During Session
**Status**: ❌ Not Handled
- Issue: If backend restarts, socket connection is lost but not re-established
- Missing: Socket reconnection logic with token refresh

## Implemented Improvements

1. ✅ **Dio Interceptor for Automatic Token Refresh** (IMPLEMENTED)
   - Intercepts all 401 responses
   - Attempts token refresh automatically
   - Retries original request with new token
   - Prevents infinite refresh loops
   - Queues concurrent requests during refresh
   - Location: `lib/core/interceptors/token_refresh_interceptor.dart`

## Remaining Recommendations

1. **Improve Backend Down Handling**
   - Add retry mechanism with exponential backoff
   - Show user-friendly error messages
   - Allow manual retry

3. **Add Socket Reconnection Logic**
   - Detect socket disconnection
   - Reconnect with current token
   - Refresh token if needed

4. **Better Error Messages**
   - Network errors: "Cannot connect to server"
   - Authentication errors: "Session expired, please restart"
   - Registration errors: Clear messages for each error code

5. **Add Comprehensive Tests**
   - Unit tests for each scenario
   - Integration tests for token refresh flow
   - E2E tests for registration flow
