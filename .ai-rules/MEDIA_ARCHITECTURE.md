# Media Domain Architecture

This document describes the architecture of the media control system in the Smart Panel backend.

> See `docs/features/media-domain-convergence.md` for the finalized design contracts and invariants.

## Architecture Summary

The Media domain uses an **activity-based architecture**:
- **Endpoints**: Functional abstractions (display, audio_output, source, remote_target) — computed on-the-fly by `DerivedMediaEndpointService`, not persisted
- **Bindings**: Activity presets that map activities to endpoint IDs (Watch → display/audio/source/remote)
- **Activities**: Named modes (Watch, Listen, Gaming, Background, Off) — one active per space
- **Explicit Capabilities**: Capabilities are never hidden; UI renders based on what's available

### Key Services
- `MediaCapabilityService` - Derives capability summaries from devices (used by derived endpoints and bindings)
- `DerivedMediaEndpointService` - Builds endpoints on-the-fly from device capabilities
- `SpaceMediaActivityBindingService` - Manages activity→endpoint bindings
- `SpaceMediaActivityService` - Handles activity activation, deactivation, and execution

### Key Entities
- `SpaceMediaActivityBindingEntity` - Activity preset with endpoint ID references
- `SpaceActiveMediaActivityEntity` - Tracks current active activity per space

---

## Endpoint Types

| Type | Description | Typical Devices |
|------|-------------|-----------------|
| DISPLAY | Visual output | TV, Projector |
| AUDIO_OUTPUT | Sound output | Receiver, Speaker, TV |
| SOURCE | Content source | Streamer, Console, STB |
| REMOTE_TARGET | Remote control target | TV, Streamer |

## Routing Types

| Type | Description | Default Endpoints |
|------|-------------|-------------------|
| WATCH | Watch video content | Display + Audio + Source |
| LISTEN | Listen to audio | Audio + Source |
| GAMING | Play games | Display + Audio + Console |
| BACKGROUND | Ambient audio | Audio only |
| OFF | All media off | All endpoints powered off |
| CUSTOM | User-defined | Any combination |

## Activation Policies

| Policy | Options | Default | Description |
|--------|---------|---------|-------------|
| Power Policy | ON, OFF, UNCHANGED | Per routing type | Power state for endpoints |
| Input Policy | ALWAYS, IF_DIFFERENT, NEVER | ALWAYS | When to switch inputs |
| Conflict Policy | REPLACE, FAIL_IF_ACTIVE, DEACTIVATE_FIRST | REPLACE | How to handle existing routing |
| Offline Policy | SKIP, FAIL, WAIT | SKIP | How to handle offline devices |

## Service Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SpacesController                          │
│     GET /media/endpoints  |  POST /media/activities/:key/activate│
└───────────────────────────────┬─────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
┌──────────────────────┐ ┌─────────────────────┐ ┌────────────────────┐
│ DerivedMediaEndpoint │ │ SpaceMediaActivity  │ │ MediaCapability     │
│     Service          │ │     Service         │ │     Service         │
│ - buildEndpoints()   │ │ - activate()        │ │ - getCapabilities() │
└──────────┬───────────┘ │ - deactivate()      │ └──────────┬─────────┘
           │             └─────────────────────┘            │
           │                           │                    │
           └───────────────────────────┼────────────────────┘
                                       │
                           ┌───────────▼───────────┐
                           │ SpaceMediaActivity    │
                           │ BindingService        │
                           └───────────────────────┘
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

## WebSocket Events

| Event | Trigger | Payload |
|-------|---------|---------|
| `MEDIA_ROUTING_ACTIVATING` | Activation started | space_id, routing_id, routing_type |
| `MEDIA_ROUTING_ACTIVATED` | Activation successful | space_id, routing_id, routing_type |
| `MEDIA_ROUTING_FAILED` | Activation failed | space_id, routing_id, routing_type, error |
| `MEDIA_ROUTING_DEACTIVATED` | Routing deactivated | space_id, routing_id, routing_type |
| `MEDIA_STATE_CHANGED` | Media state changed | space_id, state object |

**Event Flow:**
```
Device Property Change
        │
        ▼ (if media-relevant, debounced 100ms)
┌───────────────────────────────────────┐
│  SpaceMediaRoutingService             │
│  getMediaStateV2(spaceId)             │
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

## Constants

```typescript
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

## Error Handling

1. **Critical step failure** - Routing activation aborted, state set to FAILED
2. **Non-critical step failure** - Routing continues, partial success reported
3. **Device offline** - Handled per offline policy (SKIP, FAIL, or WAIT)
4. **Platform not found** - Step failed, counted in stepsFailed

## Performance Optimizations

The media domain is optimized for low-resource devices:

### Event Debouncing
- `MEDIA_STATE_CHANGED` events are debounced (100ms delay)
- Prevents WebSocket flooding when devices update multiple properties simultaneously

### Code Design
- **Fire-and-forget** state change events - Non-blocking
- **Early exits** - Returns early when space has no media endpoints

## Testing

Run tests:
```bash
cd apps/backend
npx jest "media" --no-coverage
```

## Comparison with Climate Domain

| Aspect | Climate | Media |
|--------|---------|-------|
| Device Types | Thermostats, Heaters, ACs | TVs, Speakers, AVRs |
| Control Model | Role-based intents | Routing-based activation |
| Primary Control | Temperature setpoint | Volume level |
| Secondary Control | Mode selection | Power, Input, Mute |
| State Detection | Based on heating/cooling status | Based on active routing + device state |

## Unused Code

The following code exists in the codebase from an earlier unreleased design and should not be used:
- `MediaRole` enum
- `SpaceMediaRoleService`
- `MediaMode` enum
- `MediaIntentService`
- `SpaceMediaStateService`

New development must use `SpaceMediaActivityService`, `DerivedMediaEndpointService`, and `MediaCapabilityService`.

## Documentation References

- **Convergence Phase**: `docs/features/media-domain-convergence.md`
- **Backend Refactor Spec**: `docs/features/media-domain-backend-refactor.md`
- **Constants**: `apps/backend/src/modules/spaces/spaces.constants.ts`
