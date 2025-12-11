# Multi-Backend Display Migration Implementation

## Requirements

1. **When display is removed while panel is online:**
   - Disconnect from sockets
   - Reset display state
   - Show prepare screen with option to switch backend (mdns or manual)

2. **When display is removed while panel is offline, then turned on:**
   - Token refresh fails
   - Re-registration kicks in
   - User should be able to change backend on the screen

3. **Socket notifications for token revocation/display removal:**
   - When token revoked via socket → try to refresh
   - When display removed via socket → reset to blank state

## Implementation Steps

### Backend Changes
1. ✅ Add `DISPLAY_TOKEN_REVOKED` event type
2. ✅ Emit token revoked event when token is revoked
3. ✅ Display deleted event already exists and is emitted

### Panel App Changes
1. Add socket event handlers for:
   - `DISPLAY_TOKEN_REVOKED` → Attempt token refresh
   - `DISPLAY_DELETED` → Reset to discovery state
2. Add method to reset app to discovery state
3. Update registration flow to allow backend switching
4. Handle socket disconnection gracefully

## Files Modified

### Backend
- `apps/backend/src/modules/displays/displays.constants.ts` ✅
- `apps/backend/src/modules/displays/controllers/displays.controller.ts` ✅

### Panel App
- `apps/panel/lib/modules/displays/constants.dart` ✅
- `apps/panel/lib/modules/displays/module.dart` (add event handlers) ✅
- `apps/panel/lib/core/services/startup_manager.dart` (add reset method) ✅
- `apps/panel/lib/app/app.dart` (handle reset state) ✅

## How It Works

### 1. Display Removed While Online
- Backend emits `DISPLAY_DELETED` event via WebSocket
- Panel receives event → clears display model → disconnects sockets → resets to discovery
- User sees discovery screen and can select a new backend

### 2. Display Removed While Offline, Then Turned On
- Token refresh fails → returns `authenticationFailed` or `notFound`
- App clears token and display model → goes to re-registration
- Re-registration requires permit join, but user can change backend URL first

### 3. Token Revoked Via Socket
- Backend emits `DISPLAY_TOKEN_REVOKED` event via WebSocket
- Panel receives event → attempts token refresh
- If refresh fails → resets to discovery state

## Backend Switching

The discovery screen (`BackendDiscovery`) already supports:
- mDNS discovery of backends
- Manual backend URL entry
- Backend selection

When the app resets to discovery state, users can:
1. Select a discovered backend via mDNS
2. Manually enter a backend URL
3. Re-register with the new backend
