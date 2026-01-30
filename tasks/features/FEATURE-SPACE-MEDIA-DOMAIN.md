# Task: Add media domain intents for spaces
ID: FEATURE-SPACE-MEDIA-DOMAIN
Type: feature
Scope: backend, admin, panel
Size: medium
Parent: EPIC-EXPAND-SMART-PANEL-DOMAINS
Status: done

## 1. Business goal

In order to control entertainment devices (TVs, speakers, media players) at a room level,
As a smart home user,
I want to use simple intents like "media off" or "movie mode" instead of controlling each device individually.

## 2. Context

### Existing Code References
- **Lighting domain**: `apps/backend/src/modules/spaces/services/lighting-intent.service.ts`
- **Climate domain**: `apps/backend/src/modules/spaces/services/climate-intent.service.ts`
- **Device categories**: media, speaker, television (from device spec)

### Device Capabilities (expected from spec)
| Property | Type | Permissions | Description |
|----------|------|-------------|-------------|
| `on` | bool | rw | Power state |
| `volume` | uchar | rw | 0-100% volume level |
| `mute` | bool | rw | Mute state |
| `input` | enum | rw | Input source selection |
| `playback` | enum | rw | play, pause, stop (optional) |

### Role Concept
Media devices can have roles based on their function:
- **PRIMARY**: Main entertainment device (e.g., living room TV)
- **SECONDARY**: Secondary display/speaker
- **BACKGROUND**: Background music speakers
- **GAMING**: Gaming-optimized devices
- **HIDDEN**: Excluded from space-level control

## 3. Scope

**In scope**

Backend:
- Add `MediaRole` enum to `spaces.constants.ts`
- Add `MediaIntentType` enum for space-level intents
- Add `MediaMode` enum for preset configurations
- Create `SpaceMediaRoleEntity` for role mapping
- Create `MediaIntentService` extending `SpaceIntentBaseService`
- Add media intent endpoints to `SpaceIntentService` facade
- Create YAML spec definitions for media intents

Admin:
- Add media role assignment UI
- Show media devices in space configuration

Panel:
- Add media section to SpacePage when media devices exist
- Show power, volume controls and mode buttons

**Out of scope**
- Input source switching (complex, device-specific)
- Playback control (play/pause/stop)
- Multi-room audio synchronization
- Casting/streaming source selection

## 4. Acceptance criteria

- [x] `MediaRole` enum exists: PRIMARY, SECONDARY, BACKGROUND, GAMING, HIDDEN
- [x] `MediaIntentType` enum exists: power_on, power_off, volume_set, volume_delta, mute, unmute, role_power, role_volume, set_mode
- [x] `MediaMode` enum exists: OFF, BACKGROUND, FOCUSED, PARTY
- [x] Backend can execute media intents for a space
- [x] Role-based selection works (e.g., "set BACKGROUND volume to 30%")
- [x] Volume commands are clamped to 0-100 range
- [x] Admin can assign media roles to devices in a space (API implemented)
- [ ] Panel shows media section with power toggle and volume controls (panel scope - not implemented)
- [x] Unit tests cover:
  - [x] Space with no media devices (no-op)
  - [x] Space with volume-capable devices
  - [x] Space with power-only devices
  - [x] Role-specific intents

## 5. Example scenarios

### Scenario: Turn off all media in living room

Given Space "Living Room" has 1 TV and 2 speakers
When the user executes intent "power_off"
Then all 3 devices receive on=false command
And the panel shows media OFF state

### Scenario: Movie mode preparation

Given Space "Living Room" has media roles PRIMARY (TV), BACKGROUND (speakers)
When the user executes intent "set_mode(FOCUSED)"
Then PRIMARY device powers on, volume=50%
And BACKGROUND devices are muted
And panel shows "Focused" mode active

### Scenario: Party mode

Given Space "Living Room" has PRIMARY and BACKGROUND media devices
When the user executes intent "set_mode(PARTY)"
Then all devices power on
And all devices set to volume=70%

## 6. Technical constraints

- Follow the existing domain pattern (lighting/climate)
- Use the `SpaceIntentBaseService` for value extraction and clamping
- Reuse `PlatformRegistryService` for command dispatch
- Do not modify generated code
- Tests are expected for new logic
- Handle devices without volume control (power only)

## 7. Implementation hints

### Constants to add (`spaces.constants.ts`)
```typescript
export enum MediaRole {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  BACKGROUND = 'background',
  GAMING = 'gaming',
  HIDDEN = 'hidden',
}

export enum MediaIntentType {
  POWER_ON = 'power_on',
  POWER_OFF = 'power_off',
  VOLUME_SET = 'volume_set',
  VOLUME_DELTA = 'volume_delta',
  MUTE = 'mute',
  UNMUTE = 'unmute',
  ROLE_POWER = 'role_power',
  ROLE_VOLUME = 'role_volume',
  SET_MODE = 'set_mode',
}

export enum MediaMode {
  OFF = 'off',           // All media off
  BACKGROUND = 'background', // Background at 30%, others off
  FOCUSED = 'focused',   // Primary at 50%, others muted
  PARTY = 'party',       // All at 70%
}
```

### Mode Definitions
| Mode | PRIMARY | SECONDARY | BACKGROUND | GAMING |
|------|---------|-----------|------------|--------|
| OFF | off | off | off | off |
| BACKGROUND | off | off | on, 30% | off |
| FOCUSED | on, 50% | off | muted | off |
| PARTY | on, 70% | on, 70% | on, 70% | on, 70% |

### Channel Property Mapping
```typescript
// Power control
{ channel: 'media', property: 'on' }
{ channel: 'speaker', property: 'on' }
{ channel: 'television', property: 'on' }

// Volume control
{ channel: 'media', property: 'volume' }
{ channel: 'speaker', property: 'volume' }
{ channel: 'television', property: 'volume' }

// Mute control
{ channel: 'media', property: 'mute' }
{ channel: 'speaker', property: 'mute' }
{ channel: 'television', property: 'mute' }
```

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Follow the exact pattern from `lighting-intent.service.ts` and `climate-intent.service.ts`.
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
