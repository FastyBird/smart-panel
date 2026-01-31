# Media Domain – Developer / Contributor Guide

## Architecture at a Glance

```
Devices → Capabilities → Endpoints → Bindings → Plan → Executor
```

### Pipeline

1. **Devices**: Physical devices assigned to a space (TV, Receiver, Streamer, etc.)
2. **Capabilities**: Extracted from device channels/properties (power, volume, inputSelect, playback, mute)
3. **Endpoints**: Derived functional roles (display, audio_output, source, remote_target) with capability links
4. **Bindings**: User/admin configuration mapping activities to endpoint slots
5. **Plan**: Ordered execution steps built from bindings + endpoint capabilities
6. **Executor**: Runs the plan with per-step timeouts, partial success, and structured failure reporting

### Key Services

| Service                              | File                                                  | Responsibility                          |
|--------------------------------------|-------------------------------------------------------|-----------------------------------------|
| `MediaCapabilityService`             | `media-capability.service.ts`                         | Derive capability summaries from devices |
| `DerivedMediaEndpointService`        | `derived-media-endpoint.service.ts`                   | Build endpoints from device capabilities |
| `SpaceMediaActivityBindingService`   | `space-media-activity-binding.service.ts`             | Binding CRUD + smart defaults            |
| `SpaceMediaActivityService`          | `space-media-activity.service.ts`                     | Activation, deactivation, dry-run        |

All services are in `apps/backend/src/modules/spaces/services/`.

### Constants & Enums

Defined in `apps/backend/src/modules/spaces/spaces.constants.ts`:

- `MediaActivityKey`: watch, listen, gaming, background, off
- `MediaEndpointType`: display, audio_output, source, remote_target
- `MediaActivationState`: activating, active, failed, deactivated
- Event types: `MEDIA_ACTIVITY_ACTIVATING`, `MEDIA_ACTIVITY_ACTIVATED`, `MEDIA_ACTIVITY_FAILED`, `MEDIA_ACTIVITY_DEACTIVATED`

### Models

Response models in `apps/backend/src/modules/spaces/models/media-activity.model.ts`:

- `MediaActivityExecutionPlanModel` — ordered steps with resolved device IDs
- `MediaActivityActivationResultModel` — final state + summary
- `MediaActivityDryRunPreviewModel` — preview with warnings
- `MediaActivityLastResultModel` — step counts, failures, warnings, errors

## How Endpoint Derivation Works

`DerivedMediaEndpointService.buildEndpointsForSpace(spaceId)`:

1. Loads all devices assigned to the space
2. For each device, iterates channels looking for known capability patterns
3. Maps device category + channel capabilities → endpoint type:
   - TV/Monitor → `display`
   - Receiver/Speaker → `audio_output`
   - Streamer/Console → `source`
   - Any device with playback → `remote_target`
4. Each endpoint records boolean capabilities and property ID links

### Adding a New Device Capability Extractor

To support a new device type:

1. Add the device category mapping in `DerivedMediaEndpointService.mapDeviceToEndpointType()`
2. Add capability extraction logic in `DerivedMediaEndpointService.extractCapabilities()`
3. Ensure the device's channels expose the expected property categories
4. Add test cases in `derived-media-endpoint.service.spec.ts`

## How Default Bindings Work

`SpaceMediaActivityBindingService.applyDefaults(spaceId)`:

1. Builds derived endpoints for the space
2. For each activity key, checks if a binding already exists
3. If not, creates one using heuristics:
   - Watch: picks first display + first audio + first source
   - Listen: picks first audio + optional source (no display)
   - Gaming: picks first display + first audio + console-type source
   - Background: picks first audio only
4. Sets volume presets per activity defaults

## Execution Plan & Executor

`SpaceMediaActivityService.activate(spaceId, activityKey)`:

1. Loads binding for the activity
2. Resolves endpoint IDs → device IDs via derived endpoints
3. Builds ordered steps: Power → Input → Volume
4. Executes steps sequentially with 5-second timeout per device
5. On critical failure: aborts remaining steps
6. On non-critical failure: continues, records warning
7. Persists final state (active/failed) with structured result

### Step Criticality

| Step Type     | Critical for Watch/Gaming | Critical for Listen/Background |
|---------------|---------------------------|--------------------------------|
| Power on      | Yes                       | No                             |
| Set input     | Yes (if configured)       | N/A                            |
| Set volume    | No                        | No                             |

## WebSocket Events

All events include `spaceId` and `activityKey`:

- `MEDIA_ACTIVITY_ACTIVATING` — plan built, execution starting
- `MEDIA_ACTIVITY_ACTIVATED` — success (may include warnings)
- `MEDIA_ACTIVITY_FAILED` — critical failure occurred
- `MEDIA_ACTIVITY_DEACTIVATED` — activity stopped

Events are consumed by both Panel (Dart) and Admin (Vue) for real-time UI updates.

## Where to Add Future Features

| Feature       | Where to Start                                           |
|---------------|----------------------------------------------------------|
| Queue/Playlist | New entity + service alongside `SpaceMediaActivityService` |
| Multiroom     | Extend bindings to reference endpoints from multiple spaces |
| Automations   | Listen to `MEDIA_ACTIVITY_*` events in an automation module |
| New device type | `DerivedMediaEndpointService` capability extraction       |

## Testing

- Unit tests: `*.spec.ts` files alongside each service
- Regression harness: `media-scenario-regression.spec.ts` — simulated spaces with predefined device setups
- Run: `pnpm run test:unit`
