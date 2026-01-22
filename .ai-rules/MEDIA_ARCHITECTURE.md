# Media Domain Architecture

This document describes the architecture of the media control system in the Smart Panel backend.

## Overview

The media domain provides multi-device media control with support for:
- **Televisions** - Power, volume, mute, and input control
- **Speakers** - Volume and mute control
- **AV Receivers** - Power, volume, and input switching
- **Set-Top Boxes** - Power and input control
- **Game Consoles** - Power control
- **Projectors** - Power and input control
- **Media Players** - Playback control (play, pause, next, previous)

## Service Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SpacesController                          │
│                     POST /spaces/:id/media                       │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       MediaIntentService                         │
│  - executeMediaIntent()                                          │
│  - Intent routing (SET_MODE, VOLUME_DELTA, PLAY, etc.)          │
│  - Role-based orchestration via selectMediaForMode()            │
│  - Per-device command execution                                  │
│  - InfluxDB storage                                              │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
┌───────────────────┐ ┌─────────────────┐ ┌──────────────────────┐
│ SpaceMediaState   │ │ PlatformRegistry│ │ IntentTimeseries     │
│     Service       │ │    Service      │ │     Service          │
│ - getMediaState   │ │ - get(device)   │ │ - storeMediaState    │
│ - detectMode      │ │ - processBatch()│ │   Change()           │
│ - aggregateByRole │ │                 │ │ - getLastMediaState  │
└───────────────────┘ └─────────────────┘ └──────────────────────┘
```

## Key Services

### MediaIntentService

**Location:** `apps/backend/src/modules/spaces/services/media-intent.service.ts`

Handles all media intent operations:

1. **SET_MODE** - Apply a media mode (OFF, BACKGROUND, FOCUSED, PARTY)
2. **POWER_ON/POWER_OFF** - Turn all media devices on/off
3. **VOLUME_SET** - Set specific volume level (0-100)
4. **VOLUME_DELTA** - Adjust volume by delta (SMALL: 5%, MEDIUM: 10%, LARGE: 20%)
5. **MUTE/UNMUTE** - Mute or unmute all devices
6. **PLAY/PAUSE/STOP/NEXT/PREVIOUS** - Playback control
7. **INPUT_SET** - Set input source on supported devices
8. **ROLE_POWER/ROLE_VOLUME** - Control specific role's devices

Each intent:
- Creates an Intent record for tracking
- Selects devices based on role configuration using `selectMediaForMode()`
- Executes commands on all applicable devices
- Stores results to InfluxDB for historical tracking
- Emits WebSocket events for real-time UI updates

#### selectMediaForMode() Pure Function

**Location:** `apps/backend/src/modules/spaces/services/media-intent.service.ts`

A deterministic pure function that handles device selection:

1. **No roles configured** (MVP fallback) - All devices get PRIMARY role rules
2. **Roles configured** - Each device gets its role-specific rules
3. **Unassigned devices** - Treated as SECONDARY (fallback behavior)
4. **HIDDEN devices** - Always skipped

### SpaceMediaStateService

**Location:** `apps/backend/src/modules/spaces/services/space-media-state.service.ts`

Calculates aggregated media state for a space:

- **Mode Detection** - Determines current mode by matching device states to mode rules
- **Per-Role Aggregation** - Aggregates volume/mute state per role
- **Mixed State Detection** - Detects when devices have inconsistent states
- **Last Applied Mode** - Retrieves last user-applied mode from InfluxDB

### SpaceMediaRoleService

**Location:** `apps/backend/src/modules/spaces/services/space-media-role.service.ts`

Manages device-level role assignments:

- **Role CRUD** - Create, read, update, delete role assignments
- **Bulk Operations** - Set multiple roles in one operation
- **Default Role Inference** - Auto-assign roles based on device category
- **Media Target Discovery** - List all media devices with their capabilities

### SpaceMediaStateListener

**Location:** `apps/backend/src/modules/spaces/listeners/space-media-state.listener.ts`

Reacts to device property changes and emits `MEDIA_STATE_CHANGED` events.

**Triggering Properties:**
- `ON` / `ACTIVE` - Power state changes
- `VOLUME` - Volume level changes
- `MUTE` - Mute state changes
- `COMMAND` / `REMOTE_KEY` - Playback changes

**Event Flow:**
```
Device Property Change
        │
        ▼
┌───────────────────────────────────────┐
│  SpaceMediaStateListener              │
│  @OnEvent(CHANNEL_PROPERTY_VALUE_SET) │
│  @OnEvent(CHANNEL_PROPERTY_UPDATED)   │
└───────────────────────────────────────┘
        │
        ▼ (if media-relevant, debounced 100ms)
┌───────────────────────────────────────┐
│  SpaceMediaStateService               │
│  getMediaState(roomId)                │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│  EventEmitter2                        │
│  emit(MEDIA_STATE_CHANGED, ...)       │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│  WebSocket Gateway                    │
│  Broadcasts to connected clients      │
└───────────────────────────────────────┘
```

## Media Modes

| Mode | Description | PRIMARY | SECONDARY | BACKGROUND | GAMING |
|------|-------------|---------|-----------|------------|--------|
| OFF | All media devices off | OFF | OFF | OFF | OFF |
| BACKGROUND | Background music only | OFF | OFF | ON @ 30% | OFF |
| FOCUSED | Main device active | ON @ 50% | OFF | ON (muted) | OFF |
| PARTY | All devices at high volume | ON @ 70% | ON @ 70% | ON @ 70% | ON @ 70% |

## Device Roles

Devices can be assigned roles to control their participation in media modes:

| Role | Description | Default Assignment |
|------|-------------|-------------------|
| PRIMARY | Main entertainment device (TV/Projector) | First TV or Projector |
| SECONDARY | Secondary displays/speakers | AV Receiver, Set-Top Box, other TVs |
| BACKGROUND | Background music speakers | Speakers |
| GAMING | Gaming-optimized devices | Game Consoles |
| HIDDEN | Excluded from space-level control | Manual assignment only |

### Role Auto-Assignment

When `inferDefaultMediaRoles()` is called:
1. **Television/Projector** → First one becomes PRIMARY, others SECONDARY
2. **AV Receiver/Set-Top Box/Media/Streaming Service** → SECONDARY
3. **Speaker** → BACKGROUND
4. **Game Console** → GAMING

## Media State Calculation

```typescript
interface SpaceMediaState {
  // Mode detection
  detectedMode: MediaMode | null;     // Current detected mode
  modeConfidence: 'exact' | 'approximate' | 'none';
  modeMatchPercentage: number | null;

  // Last applied mode (from InfluxDB)
  lastAppliedMode: MediaMode | null;
  lastAppliedVolume: number | null;
  lastAppliedMuted: boolean | null;
  lastAppliedAt: Date | null;

  // Summary
  totalDevices: number;               // Number of media devices
  devicesOn: number;                  // Devices currently on
  averageVolume: number | null;       // Average volume across devices
  anyMuted: boolean;                  // Any device muted

  // Per-role state
  roles: Partial<Record<MediaRole, RoleMediaAggregatedState>>;

  // Devices without role
  other: OtherMediaState;
}

interface RoleMediaAggregatedState {
  role: MediaRole;
  isOn: boolean;
  isOnMixed: boolean;                 // Some on, some off
  volume: number | null;              // null if mixed
  isMuted: boolean;
  isVolumeMixed: boolean;
  isMutedMixed: boolean;
  devicesCount: number;
  devicesOn: number;
}
```

### Mode Detection Algorithm

```
1. For each device with a role:
   - Get device's current state (power, volume, mute)
   - Get expected rule from mode orchestration

2. Check if device matches the rule:
   - Power matches (or rule doesn't specify)
   - Volume within VOLUME_MATCH_TOLERANCE (5%) (or rule doesn't specify)
   - Mute matches (or rule doesn't specify)

3. Calculate match percentage:
   - Exact match (100%) → 'exact' confidence
   - 80%+ match → 'approximate' confidence
   - < 80% → no mode detected

4. Return best matching mode
```

## Channel Capability Detection

Power detection (for isOn state):
- **TELEVISION channel** → `ON` or `ACTIVE` property
- **SWITCHER channel** → `ON` or `ACTIVE` property
- **SPEAKER channel** → No power detection (speakers follow volume/mute only)

Volume/Mute detection:
- **SPEAKER channel** → `VOLUME` and `MUTE` properties
- **TELEVISION channel** → `VOLUME` and `MUTE` properties (integrated TVs)

Playback detection:
- **MEDIA_PLAYBACK channel** → `COMMAND` property
- **TELEVISION channel** → `REMOTE_KEY` property (for remote control simulation)

## Constants

```typescript
// Volume match tolerance for mode detection (percentage points)
const VOLUME_MATCH_TOLERANCE = 5;

// Volume delta steps
export const VOLUME_DELTA_STEPS: Record<VolumeDelta, number> = {
  [VolumeDelta.SMALL]: 5,    // 5%
  [VolumeDelta.MEDIUM]: 10,  // 10%
  [VolumeDelta.LARGE]: 20,   // 20%
};

// Media device categories
export const MEDIA_DEVICE_CATEGORIES = [
  DeviceCategory.MEDIA,
  DeviceCategory.SPEAKER,
  DeviceCategory.TELEVISION,
  DeviceCategory.AV_RECEIVER,
  DeviceCategory.SET_TOP_BOX,
  DeviceCategory.GAME_CONSOLE,
  DeviceCategory.PROJECTOR,
  DeviceCategory.STREAMING_SERVICE,
];

// Media channel categories
export const MEDIA_CHANNEL_CATEGORIES = [
  ChannelCategory.SWITCHER,
  ChannelCategory.SPEAKER,
  ChannelCategory.TELEVISION,
  ChannelCategory.MEDIA_INPUT,
  ChannelCategory.MEDIA_PLAYBACK,
];
```

## InfluxDB Storage

Media mode changes are stored in InfluxDB for historical tracking:

**Measurement:** `space_intent`
**Tags:**
- `space_id` - Space UUID
- `type` - Intent type (e.g., `space.media.setMode`)

**Fields:**
- `mode` - Media mode
- `volume` - Volume value (for volume intents)
- `muted` - Mute state
- `total_devices` - Number of targeted devices
- `affected_devices` - Successfully updated devices
- `failed_devices` - Failed device updates

## Error Handling

1. **Device failures** - Partial success allowed (at least one device must succeed)
2. **Platform not found** - Device skipped, counted as failed
3. **Property change events** - Errors logged, event processing continues
4. **InfluxDB writes** - Fire-and-forget with internal error handling

## Performance Optimizations

The media domain is optimized for low-resource devices:

### Query Optimization
- **Parallel data fetching** - `getMediaState()` fetches devices, role map, and InfluxDB state in parallel
- **Data reuse** - Internal methods reuse already-fetched devices and role maps
- **Early exits** - Returns early when space has no devices or no media capabilities

### Event Debouncing
- **SpaceMediaStateListener** debounces `MEDIA_STATE_CHANGED` events (100ms delay)
- Prevents WebSocket flooding when devices update multiple properties simultaneously
- Single state recalculation per debounce window regardless of property change count

### Code Design
- **Pure function for mode selection** - `selectMediaForMode()` is a deterministic pure function
- **Fire-and-forget InfluxDB writes** - Non-blocking storage of mode changes
- **Minimal allocations** - Reuses data structures where possible

## Testing

Unit tests cover all critical services:

- `media-intent.service.spec.ts` - Intent execution and selectMediaForMode tests
- `space-media-role.service.spec.ts` - Role service tests
- `space-media-state.service.spec.ts` - State calculation and mode detection tests

Run tests:
```bash
cd apps/backend
npx jest "media" --no-coverage
```

## Comparison with Climate Domain

| Aspect | Climate | Media |
|--------|---------|-------|
| Device Types | Thermostats, Heaters, ACs | TVs, Speakers, AVRs |
| Modes | OFF, HEAT, COOL, AUTO | OFF, BACKGROUND, FOCUSED, PARTY |
| Role Types | AUTO, HEATING_ONLY, COOLING_ONLY, SENSOR, HIDDEN | PRIMARY, SECONDARY, BACKGROUND, GAMING, HIDDEN |
| Primary Control | Temperature setpoint | Volume level |
| Secondary Control | Mode selection | Power, Mute |
| State Detection | Based on heating/cooling status | Based on power/volume/mute matching |
