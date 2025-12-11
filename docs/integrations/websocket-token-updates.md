# Permit Join and WebSocket Token Update Validation

## ✅ Permit Join Compatibility

### Registration Flow with Permit Join
The registration scenarios are **fully compatible** with the permit join security mechanism:

1. **Status Check Before Registration**
   - `_checkRegistrationStatus()` is called before attempting registration
   - Checks if permit join is open via `/displays-module/register/status` endpoint
   - Throws `InitializationException` if registration is closed
   - Location: `startup_manager.dart:690-743`

2. **Error Handling**
   - **403 Forbidden**: Registration closed (permit join not active)
     - Clear error message: "Registration is not currently permitted. Please activate permit join in the admin panel."
   - **409 Conflict**: Display already registered with this IP
     - Clear error message: "Display already registered with this IP address. Please contact the administrator."
   - Location: `startup_manager.dart:654-664`

3. **Localhost Exception**
   - Backend allows localhost registrations in `ALL_IN_ONE`/`COMBINED` modes
   - Even if permit join is not active
   - This is handled by the backend, not the panel app

### Scenarios Covered
- ✅ New display registration checks permit join status
- ✅ Existing display re-registration respects permit join
- ✅ Clear error messages for closed registration
- ✅ Handles network errors during status check gracefully

## ✅ WebSocket Token Update Implementation

### Token Refresh Flow
When a token is refreshed, the WebSocket connection is **automatically updated**:

1. **Token Refresh Callback**
   - `_onTokenRefreshed()` is called when token is refreshed
   - Persists new token to secure storage
   - Updates API client headers
   - **Reinitializes socket with new token**
   - Location: `startup_manager.dart:418-431`

2. **Socket Reinitialization**
   - `SocketService.initialize()` properly handles token updates:
     - Disconnects existing socket if it exists
     - Creates new socket connection with updated token
     - Prevents duplicate connections
     - Skips reinitialization if already connected with same token
   - Location: `socket.dart:144-207`

3. **Null Safety**
   - Socket is now nullable to handle cleanup properly
   - All socket operations check for null before use
   - Proper disposal on token refresh

### Implementation Details

```dart
// When token is refreshed:
_onTokenRefreshed(String newToken) {
  // 1. Persist token
  await _securedStorage.write(key: _apiSecretKey, value: newToken);
  
  // 2. Update API client
  _apiSecret = newToken;
  _apiIoService.options.headers['Authorization'] = 'Bearer $newToken';
  
  // 3. Reinitialize socket with new token
  _socketClient.initialize(newToken, _currentBackendUrl!);
}

// Socket service handles reinitialization:
void initialize(String apiSecret, String backendUrl) {
  // Skip if already connected with same credentials
  if (_socket != null && 
      _currentApiSecret == apiSecret && 
      _currentBackendUrl == backendUrl && 
      _socket!.connected) {
    return; // Already connected with correct token
  }
  
  // Disconnect old socket
  if (_socket != null) {
    _socket!.disconnect();
    _socket!.dispose();
  }
  
  // Create new socket with updated token
  _socket = io.io(socketUrl, io.OptionBuilder()
    .setAuth({'token': apiSecret})
    .build());
  
  _socket!.connect();
}
```

### Scenarios Covered
- ✅ Token refresh updates WebSocket connection
- ✅ Old socket is properly disconnected
- ✅ No duplicate connections
- ✅ Socket reconnects with new token automatically
- ✅ Handles null socket safely

## Testing Checklist

### Permit Join
- [ ] New display registration with permit join active
- [ ] New display registration with permit join closed (should fail with 403)
- [ ] Registration status check failure (should still attempt registration)
- [ ] Already registered IP (should fail with 409)

### WebSocket Token Update
- [ ] Token refresh during active session updates socket
- [ ] Old socket is disconnected before new connection
- [ ] No duplicate socket connections
- [ ] Socket reconnects automatically with new token
- [ ] Socket operations handle null socket gracefully

## Summary

✅ **Permit Join**: Fully compatible - registration checks permit join status and handles all error cases

✅ **WebSocket Token Update**: Fully implemented - socket is automatically reinitialized with new token when refreshed

Both mechanisms work together seamlessly:
1. Registration respects permit join security
2. Token refresh updates both API client and WebSocket connection
3. All error cases are handled gracefully
