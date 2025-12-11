# Display Registration and Token Handling - Validation Summary

## ✅ Implemented Scenarios

### 1. New Display is Connected
- **Flow**: App starts → No token → Check registration status → Register display → Store token → Initialize
- **Error Handling**: 
  - 403: Registration closed (permit join not active)
  - 409: Display already registered with this IP
  - Network errors: Clear error messages
- **Location**: `startup_manager.dart:_registerDisplay()`

### 2. Existing Display with Lost Access Token
- **Flow**: App starts → Token exists → Try to fetch display → Fails → Clear token → Register again
- **Error Handling**: Detects authentication failure and automatically re-registers
- **Location**: `startup_manager.dart:_tryInitializeWithStoredToken()`

### 3. Existing Display with Expired Token (Offline → Online)
- **Flow**: App starts → Token exists → Fetch display → 401 → Refresh token → Retry fetch
- **Error Handling**: Automatic token refresh on 401, retry once
- **Location**: `display.dart:fetchCurrentDisplay()`

### 4. Token Expires During Runtime (Mid-Session)
- **Flow**: API call → 401 → `TokenRefreshInterceptor` → Refresh token → Retry request
- **Features**:
  - Automatic token refresh on all API calls
  - Queues concurrent requests during refresh
  - Prevents infinite refresh loops
  - Updates all pending requests with new token
- **Location**: `core/interceptors/token_refresh_interceptor.dart`

### 5. Backend is Down
- **Flow**: App starts → Wait for backend (30s timeout) → Ping health endpoint → Fail → Return connectionFailed
- **Current Behavior**: Returns `InitializationResult.connectionFailed`, clears stored URL
- **Location**: `startup_manager.dart:_waitForBackend()`

## Important Notes

### Token Refresh vs Re-registration

- **Token Refresh** (expired token): Does NOT require permit join
  - Uses authenticated endpoint `/me/refresh-token`
  - Works automatically via `TokenRefreshInterceptor`
  - No user/admin action needed

- **Re-registration** (lost/invalid token): REQUIRES permit join
  - No token available for authentication
  - Must go through registration endpoint
  - Admin must enable permit join in admin panel

See `TOKEN_REFRESH_PERMIT_JOIN.md` for detailed explanation.

## ⚠️ Scenarios Requiring Manual Testing

### 6. Network Interruption During Registration
- **Expected**: Network errors should be caught and displayed to user
- **Test**: Disconnect network during registration, verify error handling

### 7. Backend Restart During Session
- **Expected**: Socket should disconnect, but API calls should still work
- **Test**: Restart backend during active session, verify socket reconnection

### 8. Multiple Concurrent API Calls with Expired Token
- **Expected**: All requests should be queued, token refreshed once, all retried
- **Test**: Make multiple API calls simultaneously with expired token

### 9. Token Refresh Fails (Token Revoked)
- **Expected**: Should return authentication failed, trigger re-registration
- **Test**: Revoke token in admin, verify app handles gracefully

## Testing Checklist

- [ ] New display registration (first time)
- [ ] Existing display with valid token
- [ ] Existing display with expired token (offline → online)
- [ ] Token expires during runtime (mid-session API call)
- [ ] Backend down on startup
- [ ] Network interruption during registration
- [ ] Backend restart during session
- [ ] Multiple concurrent API calls with expired token
- [ ] Token refresh fails (token revoked)
- [ ] Display deleted in admin (404 handling)
- [ ] Permit join closed (403 handling)
- [ ] Already registered IP (409 handling)

## Key Implementation Details

### Token Refresh Interceptor
- Automatically intercepts all 401 responses
- Queues concurrent requests during refresh
- Prevents infinite refresh loops
- Updates Dio headers with new token
- Retries original request after refresh

### Registration Flow
- Checks registration status before attempting
- Handles all error codes (403, 409, network errors)
- Stores token securely
- Initializes display data from registration response

### Error Handling
- Clear error messages for each scenario
- Automatic retry for token refresh
- Graceful degradation on failures
- Proper cleanup on errors
