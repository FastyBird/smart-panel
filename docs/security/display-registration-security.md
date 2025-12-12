# Display Registration Security Enhancement Plan

## Overview
Implement security levels for display registration based on three deployment modes:
1. **Standalone Gateway** - Each display is a separate device/app
2. **All-in-One** - Backend, admin, and panel on one device (localhost communication)
3. **Combined** - All-in-One + allows other standalone displays via network

## Current State
- Registration endpoint: `POST /modules/displays/register`
- Currently: `@Public()` - no authentication required
- Protection: Only User-Agent validation
- No IP-based restrictions
- No time-based access control

## Implementation Plan

### Phase 1: Backend - Configuration & Infrastructure

#### 1.1 Add Deployment Mode Configuration
**File**: `apps/backend/src/modules/displays/displays.constants.ts` or new config file

```typescript
export enum DeploymentMode {
  STANDALONE = 'standalone',
  ALL_IN_ONE = 'all-in-one',
  COMBINED = 'combined',
}

export const PERMIT_JOIN_DURATION_MS = 2 * 60 * 1000; // 2 minutes
export const LOCALHOST_IPS = ['127.0.0.1', '::1', 'localhost'];
```

**Environment Variable**: `DISPLAYS_DEPLOYMENT_MODE` (default: `standalone`)

#### 1.2 Create Permit Join Service
**File**: `apps/backend/src/modules/displays/services/permit-join.service.ts`

**Responsibilities**:
- Manage permit join state (in-memory or Redis)
- Track when permit join was activated
- Check if permit join is currently active
- Auto-expire after 2 minutes

**Interface**:
```typescript
@Injectable()
export class PermitJoinService {
  private permitJoinActive: boolean = false;
  private permitJoinExpiresAt: Date | null = null;
  
  activatePermitJoin(): void;
  isPermitJoinActive(): boolean;
  deactivatePermitJoin(): void;
  getRemainingTime(): number | null;
}
```

#### 1.3 Create Registration Guard
**File**: `apps/backend/src/modules/displays/guards/registration.guard.ts`

**Responsibilities**:
- Check deployment mode
- For modes 1 & 3: Verify permit join is active
- For mode 2: Verify IP is localhost (127.0.0.1)
- For mode 2: Check if localhost display already exists
- Extract client IP from request

#### 1.4 Update Registration Controller
**File**: `apps/backend/src/modules/displays/controllers/registration.controller.ts`

**Changes**:
- Add `@UseGuards(RegistrationGuard)` to register endpoint
- Extract client IP from request
- Pass IP to registration service
- Update error handling for 403/409 responses

#### 1.5 Update Registration Service
**File**: `apps/backend/src/modules/displays/services/registration.service.ts`

**Changes**:
- Accept client IP parameter
- For mode 2: Store/check localhost IP association
- Add method to check if display exists with localhost IP
- Update `registerDisplay` signature: `registerDisplay(dto, userAgent, clientIp)`

#### 1.6 Add Registration Status Endpoint
**File**: `apps/backend/src/modules/displays/controllers/registration.controller.ts`

**New Endpoint**:
```typescript
@Get('status')
@Public()
@ApiOperation({
  summary: 'Check registration status',
  description: 'Returns whether registration is currently open',
})
async getRegistrationStatus(): Promise<{ open: boolean; remainingTime?: number }> {
  // Returns 200 with { open: true/false, remainingTime?: ms }
}
```

### Phase 2: Backend - Admin API

#### 2.1 Add Permit Join Controller
**File**: `apps/backend/src/modules/displays/controllers/displays.controller.ts`

**New Endpoint**:
```typescript
@Post('permit-join')
@Roles(UserRole.OWNER, UserRole.ADMIN)
@ApiOperation({
  summary: 'Permit display join',
  description: 'Opens registration endpoint for 2 minutes',
})
async permitJoin(): Promise<{ success: boolean; expiresAt: Date }> {
  // Activate permit join
  // Return expiration time
}
```

#### 2.2 Add Permit Join Status Endpoint
**File**: `apps/backend/src/modules/displays/controllers/displays.controller.ts`

**New Endpoint**:
```typescript
@Get('permit-join/status')
@Roles(UserRole.OWNER, UserRole.ADMIN)
async getPermitJoinStatus(): Promise<{ active: boolean; expiresAt?: Date; remainingTime?: number }> {
  // Return current permit join status
}
```

### Phase 3: Admin UI

#### 3.1 Add Permit Join Button
**File**: `apps/admin/src/modules/displays/views/view-displays.vue`

**Location**: In the view-header extra slot (next to other action buttons)

**Features**:
- Button: "Permit Join" / "Permit Join Active (X seconds remaining)"
- Disabled when already active
- Shows countdown timer when active
- Calls permit join API endpoint

#### 3.2 Add Permit Join Composable
**File**: `apps/admin/src/modules/displays/composables/usePermitJoin.ts`

**Responsibilities**:
- Call permit join API
- Poll for status updates
- Manage countdown timer
- Handle errors

#### 3.3 Update Displays Store
**File**: `apps/admin/src/modules/displays/store/displays.store.ts`

**Add Actions**:
- `permitJoin()` - Activate permit join
- `getPermitJoinStatus()` - Get current status

#### 3.4 Add Localization
**File**: `apps/admin/src/modules/displays/locales/en-US.json`

**Add Keys**:
```json
{
  "actions": {
    "permitJoin": "Permit Join",
    "permitJoinActive": "Permit Join Active",
    "permitJoinExpiresIn": "Expires in {seconds}s"
  },
  "messages": {
    "permitJoinActivated": "Registration is now open for 2 minutes",
    "permitJoinFailed": "Failed to activate permit join"
  }
}
```

### Phase 4: Panel App

#### 4.1 Update Registration Flow
**File**: `apps/panel/lib/core/services/startup_manager.dart`

**Changes**:
- Before registration attempt, call status endpoint
- If status returns `open: false`, show error to user
- Handle 403 Forbidden response with user-friendly message
- Handle 409 Conflict for localhost re-registration

#### 4.2 Add Registration Status Check
**File**: `apps/panel/lib/core/services/startup_manager.dart`

**New Method**:
```dart
Future<bool> checkRegistrationStatus() async {
  try {
    final response = await _apiClient.get('/modules/displays/register/status');
    return response.data['open'] == true;
  } catch (e) {
    return false;
  }
}
```

#### 4.3 Update Error Handling
**File**: `apps/panel/lib/core/services/startup_manager.dart`

**Changes**:
- Handle 403: Show "Registration not permitted. Please activate 'Permit Join' in admin."
- Handle 409: Show "Display already registered with localhost IP"
- Handle other errors: Existing error handling

#### 4.4 Add User-Facing Error Messages
**File**: `apps/panel/lib/core/services/startup_manager.dart` or error handling service

**Messages**:
- "Registration is currently closed. Please activate 'Permit Join' in the admin panel."
- "This display is already registered with localhost IP address."
- "Registration failed. Please try again."

### Phase 5: Database/Storage

#### 5.1 Localhost Display Tracking
**Option A**: Store in display entity
- Add `registeredFromIp` field to `DisplayEntity`
- Index on this field for quick lookup

**Option B**: In-memory tracking
- Track in service (simpler, but lost on restart)

**Recommendation**: Option A (persistent storage)

#### 5.2 Permit Join State
**Option A**: In-memory (Redis)
- Fast, auto-expires
- Lost on restart (acceptable for 2-minute window)

**Option B**: Database
- Persistent but needs cleanup job

**Recommendation**: Option A (in-memory with Redis if available, fallback to simple in-memory)

### Phase 6: Testing

#### 6.1 Backend Unit Tests
- Registration guard tests for all modes
- Permit join service tests
- Registration service localhost checks
- Status endpoint tests

#### 6.2 Backend E2E Tests
- Test registration in each mode
- Test permit join activation/expiration
- Test localhost restrictions
- Test 403/409 responses

#### 6.3 Admin UI Tests
- Permit join button functionality
- Countdown timer
- Status polling

#### 6.4 Panel App Tests
- Registration status check
- Error handling
- Localhost registration flow

## Implementation Order

1. **Backend Infrastructure** (Phase 1)
   - Configuration
   - Permit join service
   - Registration guard
   - IP extraction utility

2. **Backend API** (Phase 2)
   - Permit join endpoints
   - Status endpoint
   - Update registration controller

3. **Admin UI** (Phase 3)
   - Permit join button
   - Status polling
   - UI feedback

4. **Panel App** (Phase 4)
   - Status check before registration
   - Error handling updates
   - User messages

5. **Testing** (Phase 6)
   - Unit tests
   - E2E tests
   - Integration tests

## Configuration

### Environment Variables
```bash
# Deployment mode: standalone | all-in-one | combined
DISPLAYS_DEPLOYMENT_MODE=standalone

# Permit join duration (ms) - optional, defaults to 2 minutes
DISPLAYS_PERMIT_JOIN_DURATION_MS=120000
```

### Default Behavior
- If `DISPLAYS_DEPLOYMENT_MODE` not set: `standalone` mode
- Permit join: 2 minutes (configurable)
- Localhost IPs: `127.0.0.1`, `::1`, `localhost`

## Security Considerations

1. **Permit Join Window**: 2 minutes is a balance between security and usability
2. **Localhost Trust**: Only in all-in-one mode, with single display restriction
3. **IP Validation**: Properly extract IP from headers (X-Forwarded-For, etc.)
4. **Rate Limiting**: Consider adding rate limiting to status endpoint
5. **Audit Logging**: Log all permit join activations and registration attempts

## Migration Notes

- Existing displays: No migration needed
- New deployments: Set `DISPLAYS_DEPLOYMENT_MODE` appropriately
- All-in-one mode: First registration will work, subsequent will return 409

## Open Questions

1. Should permit join be extendable (reset timer)?
2. Should there be a maximum number of permit join activations per hour?
3. Should localhost display be automatically deleted if panel app uninstalled?
4. Should we support IPv6 localhost (`::1`) in addition to `127.0.0.1`?
