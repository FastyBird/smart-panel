# Task: Add security domain intents for spaces
ID: FEATURE-SPACE-SECURITY-DOMAIN
Type: feature
Scope: backend, admin, panel
Size: medium
Parent: EPIC-EXPAND-SMART-PANEL-DOMAINS
Status: planned

## 1. Business goal

In order to control security devices (locks, alarms) at a room or zone level,
As a smart home user,
I want to use simple intents like "lock all" or "arm perimeter" instead of controlling each device individually.

## 2. Context

### Existing Code References
- **Lighting domain**: `apps/backend/src/modules/spaces/services/lighting-intent.service.ts`
- **Climate domain**: `apps/backend/src/modules/spaces/services/climate-intent.service.ts`
- **Device categories**: lock, alarm, door, doorbell (from device spec)

### Device Capabilities (expected from spec)
| Device | Property | Type | Permissions | Description |
|--------|----------|------|-------------|-------------|
| lock | `locked` | bool | rw | Lock state |
| lock | `lock` | enum | wo | lock, unlock commands |
| alarm | `armed` | bool | rw | Arm state |
| alarm | `mode` | enum | rw | home, away, night, disarmed |
| door | `contact` | bool | ro | Open/closed state |
| doorbell | `ring` | bool | ro | Ring event |

### Role Concept
Security devices can have roles based on their location/function:
- **ACCESS**: Entry point locks (front door, garage)
- **PERIMETER**: Perimeter monitoring (windows, motion sensors)
- **INTERIOR**: Interior locks (office, safe room)
- **MONITORING**: Cameras, motion sensors (read-only)
- **ALERT**: Alarm systems, sirens
- **HIDDEN**: Excluded from space-level control

### Security Considerations
- Lock/unlock operations should be logged
- Alarm arming should have optional confirmation
- Failed operations should be clearly reported
- Consider adding delay before arming

## 3. Scope

**In scope**

Backend:
- Add `SecurityRole` enum to `spaces.constants.ts`
- Add `SecurityIntentType` enum for space-level intents
- Add `SecurityMode` enum for preset configurations
- Create `SpaceSecurityRoleEntity` for role mapping
- Create `SecurityIntentService` extending `SpaceIntentBaseService`
- Add security intent endpoints to `SpaceIntentService` facade
- Create YAML spec definitions for security intents

Admin:
- Add security role assignment UI
- Show security devices in space configuration
- Configuration for confirmation requirements

Panel:
- Add security section to SpacePage when security devices exist
- Show lock status and arm/disarm controls
- Optional confirmation dialog for sensitive operations

**Out of scope**
- Camera streaming/viewing
- Motion sensor history/graphs
- Complex alarm zone configuration
- Entry/exit delay configuration
- User access codes management
- Audit logging (separate feature)

## 4. Acceptance criteria

- [ ] `SecurityRole` enum exists: ACCESS, PERIMETER, INTERIOR, MONITORING, ALERT, HIDDEN
- [ ] `SecurityIntentType` enum exists: lock_all, unlock_all, role_lock, arm, disarm, set_mode
- [ ] `SecurityMode` enum exists: DISARMED, HOME, AWAY, NIGHT
- [ ] Backend can execute security intents for a space
- [ ] Role-based selection works (e.g., "lock ACCESS only")
- [ ] Admin can assign security roles to devices in a space
- [ ] Panel shows security section with lock status and mode controls
- [ ] Unit tests cover:
  - [ ] Space with no security devices (no-op)
  - [ ] Space with locks only
  - [ ] Space with alarm only
  - [ ] Role-specific intents
  - [ ] Mixed lock success/failure scenarios

## 5. Example scenarios

### Scenario: Lock all doors when leaving

Given Space "Entry" has 2 locks (front door, garage)
When the user executes intent "lock_all"
Then both locks receive locked=true command
And the panel shows all locks secured

### Scenario: Arm for night

Given Space "House" (zone) has alarm system and perimeter sensors
When the user executes intent "set_mode(NIGHT)"
Then alarm is armed in night mode
And perimeter sensors are active
And interior motion sensors are disabled (if applicable)

### Scenario: Partial lock failure

Given Space "Entry" has 2 locks
When the user executes intent "lock_all"
And front door lock succeeds but garage lock fails
Then intent completes with partial status
And panel shows garage lock as "not synced"
And user is notified of the failure

## 6. Technical constraints

- Follow the existing domain pattern (lighting/climate)
- Use the `SpaceIntentBaseService` for value extraction
- Reuse `PlatformRegistryService` for command dispatch
- Do not modify generated code
- Tests are expected for new logic
- Security operations should fail safely (prefer locked state on error)
- Consider logging security-sensitive operations

## 7. Implementation hints

### Constants to add (`spaces.constants.ts`)
```typescript
export enum SecurityRole {
  ACCESS = 'access',       // Entry locks
  PERIMETER = 'perimeter', // Window/perimeter sensors
  INTERIOR = 'interior',   // Interior locks
  MONITORING = 'monitoring', // Cameras, motion (read-only)
  ALERT = 'alert',         // Alarms, sirens
  HIDDEN = 'hidden',
}

export enum SecurityIntentType {
  LOCK_ALL = 'lock_all',
  UNLOCK_ALL = 'unlock_all',
  ROLE_LOCK = 'role_lock',
  ARM = 'arm',
  DISARM = 'disarm',
  SET_MODE = 'set_mode',
}

export enum SecurityMode {
  DISARMED = 'disarmed', // All security relaxed
  HOME = 'home',         // Perimeter armed, access unlocked
  AWAY = 'away',         // Everything locked and armed
  NIGHT = 'night',       // Perimeter armed, interior unlocked
}
```

### Mode Definitions
| Mode | ACCESS | PERIMETER | INTERIOR | ALERT |
|------|--------|-----------|----------|-------|
| DISARMED | unlock | inactive | unlock | disarmed |
| HOME | unlock | active | unlock | armed_home |
| AWAY | lock | active | lock | armed_away |
| NIGHT | lock | active | unlock | armed_night |

### Channel Property Mapping
```typescript
// Lock control
{ channel: 'lock', property: 'locked' }
{ channel: 'lock', property: 'lock' } // command: lock/unlock

// Alarm control
{ channel: 'alarm', property: 'armed' }
{ channel: 'alarm', property: 'mode' }

// Read-only sensors
{ channel: 'door', property: 'contact' } // read-only
{ channel: 'motion', property: 'detected' } // read-only
```

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Follow the exact pattern from `lighting-intent.service.ts` and `climate-intent.service.ts`.
- Security operations should be fail-safe (prefer secure state).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
