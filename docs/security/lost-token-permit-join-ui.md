# Lost Token and Permit Join UI Implementation

## Current Implementation Status

### ✅ Lost/Corrupted Token Handling

**Status**: ✅ **Fully Covered**

When a token is lost or corrupted:
1. App reads from storage → `_apiSecret == null`
2. Skips `_tryInitializeWithStoredToken()` (no token to try)
3. Goes directly to `_registerDisplay()`
4. `_registerDisplay()` checks permit join status
5. If permit join is closed → throws `InitializationException` with clear message
6. App shows error screen with permit join instructions

**Code Flow:**
```dart
// startup_manager.dart:451-472
if (_apiSecret != null) {
  // Try with stored token (even if expired)
  final success = await _tryInitializeWithStoredToken();
  if (success) return; // Success
  // Token invalid - clear and re-register
  await _clearStoredApiSecret();
}

// No valid token (lost/corrupted/invalid) - register
// This checks permit join and throws if closed
await _registerDisplay();
```

### ✅ Permit Join Error UI

**Status**: ✅ **Implemented**

When permit join is closed and registration fails:
1. `InitializationException` is thrown with message: "Registration is not currently permitted. Please activate permit join in the admin panel."
2. Exception is caught in `app.dart` and stored in `_errorMessage`
3. `AppError` widget displays:
   - The specific error message
   - Special info box if message contains "permit join"
   - Instructions to ask administrator to activate permit join
   - "Restart application" button

**UI Features:**
- Shows the actual error message (not generic)
- Detects permit join errors and shows special instructions
- Clear call-to-action for administrator
- Restart button to retry after permit join is enabled

**Code Location:**
- Error widget: `apps/panel/lib/app/app/error.dart`
- Error handling: `apps/panel/lib/app/app.dart:114-122`

## Scenarios Covered

| Scenario | Token Status | App Behavior | UI State |
|----------|-------------|--------------|----------|
| **Token Lost** | Not in storage | Goes to registration → Checks permit join | Error screen with permit join message |
| **Token Corrupted** | Invalid format | Goes to registration → Checks permit join | Error screen with permit join message |
| **Token Invalid** | Invalid/revoked | Goes to registration → Checks permit join | Error screen with permit join message |
| **Permit Join Closed** | Any (during registration) | Registration fails → Throws exception | Error screen with permit join instructions |
| **Permit Join Open** | Lost/invalid | Registration succeeds | App initializes normally |

## UI Screenshots Description

### Error Screen (Permit Join Required)
```
┌─────────────────────────────────┐
│         ⚠️ Alert Icon           │
│                                 │
│  Failed to start application!   │
│                                 │
│  Registration is not currently  │
│  permitted. Please activate     │
│  permit join in the admin       │
│  panel.                         │
│                                 │
│  ┌───────────────────────────┐ │
│  │ ℹ️ Please ask the         │ │
│  │ administrator to activate │ │
│  │ "Permit Join" in the      │ │
│  │ admin panel, then restart │ │
│  │ the application.           │ │
│  └───────────────────────────┘ │
│                                 │
│  Please try to restart the      │
│  application after the           │
│  administrator has enabled      │
│  permit join.                   │
│                                 │
│  [ Restart application ]        │
└─────────────────────────────────┘
```

## First Boot Mode

**Question**: Will the app be in "first boot" mode?

**Answer**: ✅ **YES** - The app behaves like first boot when:
- Token is lost/corrupted
- Token is invalid/revoked
- Display needs to re-register

**Behavior:**
- App goes through the same initialization flow as first boot
- Checks permit join status (same as new display)
- Shows error screen if permit join is closed
- Shows discovery screen if backend URL is lost
- User must wait for administrator to enable permit join

## User Experience Flow

### Scenario: Lost Token + Permit Join Closed

1. **App Starts**
   - Reads storage → No token found
   - Goes to registration flow

2. **Registration Attempt**
   - Checks permit join status → Closed
   - Throws `InitializationException`

3. **Error Screen Displayed**
   - Shows error message
   - Shows permit join instructions
   - Shows restart button

4. **User Action Required**
   - User sees message: "Please ask administrator to activate Permit Join"
   - Administrator enables permit join in admin panel
   - User clicks "Restart application"
   - App retries registration → Success

### Scenario: Lost Token + Permit Join Open

1. **App Starts**
   - Reads storage → No token found
   - Goes to registration flow

2. **Registration Attempt**
   - Checks permit join status → Open
   - Registration succeeds
   - Token stored
   - App initializes normally

## Implementation Details

### Error Message Detection
```dart
// Detects permit join errors in error message
final hasPermitJoinError = _errorMessage != null &&
    _errorMessage!.toLowerCase().contains('permit join');
```

### Special UI for Permit Join Errors
- Shows info box with instructions
- Changes restart message to mention permit join
- Provides clear call-to-action

### Restart Functionality
- "Restart application" button calls `_restartApp()`
- Retries initialization
- If permit join is now enabled → registration succeeds
- If still closed → shows error again

## Testing Checklist

- [ ] Lost token → Shows error screen with permit join message
- [ ] Corrupted token → Shows error screen with permit join message
- [ ] Invalid token → Shows error screen with permit join message
- [ ] Permit join closed → Shows error screen with instructions
- [ ] Permit join open → Registration succeeds
- [ ] Restart after permit join enabled → Registration succeeds
- [ ] Error message is displayed (not generic)
- [ ] Info box appears for permit join errors
- [ ] Restart button works correctly

## Summary

✅ **Lost/Corrupted Token**: Fully covered - app goes to registration flow
✅ **Permit Join UI**: Implemented - shows clear error message and instructions
✅ **First Boot Mode**: Yes - behaves like first boot when token is lost
✅ **User Instructions**: Clear - tells user to ask admin to enable permit join

The implementation ensures users understand what's happening and what action is needed from the administrator.
