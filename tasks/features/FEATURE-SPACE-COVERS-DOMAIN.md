# Task: Add covers domain intents for spaces
ID: FEATURE-SPACE-COVERS-DOMAIN
Type: feature
Scope: backend, admin, panel
Size: medium
Parent: EPIC-EXPAND-SMART-PANEL-DOMAINS
Status: planned

## 1. Business goal

In order to control window coverings (blinds, curtains, shutters) at a room level,
As a smart home user,
I want to use simple intents like "open all covers" or "privacy mode" instead of controlling each device individually.

## 2. Context

### Related Tasks (NOT Overlapping - Different Scopes)
- **`FEATURE-WINDOW-COVERING-DEVICE-PAGE`** (done) - **Device-level** UI page for controlling a single window covering device. This task is about **space-level intents** that control ALL covers in a room/zone simultaneously.
- **`FEATURE-SPACE-CLIMATE-MVP`** (done) - Pattern reference for domain intent implementation.
- **`FEATURE-SPACE-INTENTS-LIGHTING-MVP`** (done) - Pattern reference for domain intent implementation.

### Existing Code References
- **Lighting domain**: `apps/backend/src/modules/spaces/services/lighting-intent.service.ts`
- **Climate domain**: `apps/backend/src/modules/spaces/services/climate-intent.service.ts`
- **Covers device page**: `apps/panel/lib/features/dashboard/presentation/devices/window_covering.dart` (done)
- **Device spec**: `spec/devices/channels.json` includes window_covering channel

### Device Capabilities (from spec)
| Property | Type | Permissions | Description |
|----------|------|-------------|-------------|
| `status` | enum | ro | opened, closed, opening, closing, stopped |
| `position` | uchar | rw | 0-100% (0=closed, 100=open) |
| `type` | enum | ro | curtain, blind, roller, outdoor_blind |
| `command` | enum | wo | open, close, stop |
| `tilt` | float | rw | -90° to 90° (optional, for blinds) |

### Role Concept
Similar to lighting roles, covers can have roles:
- **PRIMARY**: Main window covering in the space
- **BLACKOUT**: Light-blocking covers (for sleep/movie)
- **SHEER/PRIVACY**: Semi-transparent covers for privacy while allowing light
- **OUTDOOR**: External shutters/awnings
- **HIDDEN**: Excluded from space-level control

## 3. Scope

**In scope**

Backend:
- Add `CoversRole` enum to `spaces.constants.ts`
- Add `CoversIntentType` enum for space-level intents
- Add `CoversMode` enum for preset positions
- Create `SpaceCoversRoleEntity` for role mapping
- Create `CoversIntentService` extending `SpaceIntentBaseService`
- Add covers intent endpoints to `SpaceIntentService` facade
- Create YAML spec definitions for covers intents

Admin:
- Add covers role assignment UI (similar to lighting roles)
- Show covers in space configuration

Panel:
- Add covers section to SpacePage when covers exist in space
- Show position controls and mode buttons

**Out of scope**
- Tilt control at space level (keep for device-level only)
- Sun tracking automation (future feature)
- Integration with weather API for smart positioning

## 4. Acceptance criteria

- [ ] `CoversRole` enum exists: PRIMARY, BLACKOUT, SHEER, OUTDOOR, HIDDEN
- [ ] `CoversIntentType` enum exists: open, close, set_position, position_delta, role_position, set_mode
- [ ] `CoversMode` enum exists: OPEN, CLOSED, PRIVACY, DAYLIGHT
- [ ] Backend can execute covers intents for a space
- [ ] Role-based selection works (e.g., "close BLACKOUT covers only")
- [ ] Position commands are clamped to 0-100 range
- [ ] Admin can assign covers roles to devices in a space
- [ ] Panel shows covers section with position slider and mode buttons
- [ ] Unit tests cover:
  - [ ] Space with no covers (no-op)
  - [ ] Space with position-capable covers
  - [ ] Space with command-only covers
  - [ ] Role-specific intents

## 5. Example scenarios

### Scenario: Close all covers in bedroom

Given Space "Bedroom" has 2 window coverings (1 blackout, 1 sheer)
When the user executes intent "close"
Then both covers receive position=0 command
And the panel shows 0% position

### Scenario: Privacy mode in living room

Given Space "Living Room" has covers with roles BLACKOUT and SHEER
When the user executes intent "set_mode(PRIVACY)"
Then SHEER covers are set to position=50
And BLACKOUT covers remain open (position=100)
And panel shows "Privacy" mode active

### Scenario: Close only blackout covers

Given Space "Bedroom" has BLACKOUT and SHEER covers
When the user executes intent "role_position(role=BLACKOUT, position=0)"
Then only BLACKOUT covers close
And SHEER covers remain unchanged

## 6. Technical constraints

- Follow the existing domain pattern (lighting/climate)
- Use the `SpaceIntentBaseService` for value extraction and clamping
- Reuse `PlatformRegistryService` for command dispatch
- Do not modify generated code
- Tests are expected for new logic
- Handle devices with only `command` property (no `position`)

## 7. Implementation hints

### Constants to add (`spaces.constants.ts`)
```typescript
export enum CoversRole {
  PRIMARY = 'primary',
  BLACKOUT = 'blackout',
  SHEER = 'sheer',
  OUTDOOR = 'outdoor',
  HIDDEN = 'hidden',
}

export enum CoversIntentType {
  OPEN = 'open',
  CLOSE = 'close',
  SET_POSITION = 'set_position',
  POSITION_DELTA = 'position_delta',
  ROLE_POSITION = 'role_position',
  SET_MODE = 'set_mode',
}

export enum CoversMode {
  OPEN = 'open',       // All at 100%
  CLOSED = 'closed',   // All at 0%
  PRIVACY = 'privacy', // Sheer down (50%), blackout open
  DAYLIGHT = 'daylight', // Optimize for natural light
}
```

### Mode Definitions
| Mode | PRIMARY | BLACKOUT | SHEER | OUTDOOR |
|------|---------|----------|-------|---------|
| OPEN | 100% | 100% | 100% | 100% |
| CLOSED | 0% | 0% | 0% | 0% |
| PRIVACY | 100% | 100% | 50% | 100% |
| DAYLIGHT | 75% | 100% | 75% | 50% |

### Channel Property Mapping
```typescript
// Position-capable covers
{ channel: 'window_covering', property: 'position' }

// Command-only covers (map mode to command)
{ channel: 'window_covering', property: 'command' }
// OPEN mode -> command='open', CLOSED mode -> command='close'
```

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Follow the exact pattern from `lighting-intent.service.ts` and `climate-intent.service.ts`.
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
