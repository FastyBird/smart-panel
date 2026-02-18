# Media Domain Architecture

This document describes the architecture of the media control system in the Smart Panel backend.

> See `docs/media-domain.md` for the full media domain documentation.

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

## Activity Types (MediaActivityKey)

| Key | Description | Typical Endpoints |
|-----|-------------|-------------------|
| watch | Watch video content | Display + Audio + Source |
| listen | Listen to audio | Audio + Source |
| gaming | Play games | Display + Audio + Console |
| background | Ambient audio | Audio only |
| off | All media off | All endpoints powered off |

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
| `MEDIA_ACTIVITY_ACTIVATING` | Activity activation started | space_id, activity_key |
| `MEDIA_ACTIVITY_ACTIVATED` | Activation successful | space_id, activity_key |
| `MEDIA_ACTIVITY_FAILED` | Activation failed | space_id, activity_key, error |
| `MEDIA_ACTIVITY_DEACTIVATED` | Activity deactivated | space_id |

**Event Flow:**
```
SpaceMediaActivityService.activate()
        │
        ▼
┌───────────────────────────────────────┐
│  SpaceMediaActivityService            │
│  buildPlan() → executePlan()          │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│  EventEmitter2                        │
│  emit(MEDIA_ACTIVITY_*, ...)          │
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

1. **Critical step failure** - Activity activation aborted, state set to FAILED
2. **Non-critical step failure** - Activation continues, partial success reported
3. **Device offline** - Handled per offline policy (SKIP, FAIL, or WAIT)
4. **Platform not found** - Step failed, counted in stepsFailed

## Performance Optimizations

The media domain is optimized for low-resource devices:

### Event Design
- Activity events are emitted at key points (activating, activated, failed, deactivated)
- No device-property debouncing; activation is user-initiated

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
| Control Model | Role-based intents | Activity-based activation |
| Primary Control | Temperature setpoint | Activity preset (Watch/Listen/etc.) |
| Secondary Control | Mode selection | Power, Input, Volume (direct device commands) |
| State Detection | Based on heating/cooling status | Based on active activity + device state |

## Documentation References

- **Full Media Domain Docs**: `docs/media-domain.md`
- **Constants**: `apps/backend/src/modules/spaces/spaces.constants.ts`
