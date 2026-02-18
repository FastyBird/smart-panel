# Media Domain

This document describes the media domain implementation for the Smart Panel, including activity-based control, endpoint derivation, admin configuration, panel UI, and testing.

## Overview

The Media domain enables activity-based entertainment control within spaces. Instead of controlling each device individually, users select an **activity** (Watch, Listen, Gaming, Background, Off) and the system orchestrates all necessary device commands automatically.

The media domain is implemented entirely within the **spaces module** (`apps/backend/src/modules/spaces/`). Endpoints are computed on-the-fly from device capabilities rather than persisted, keeping the system lightweight for embedded devices.

## Activities

| Activity       | What it does                                                        | Typical Endpoints               |
|----------------|---------------------------------------------------------------------|---------------------------------|
| **Watch**      | Powers on display + audio, sets inputs, applies volume preset       | Display + Audio + Source        |
| **Listen**     | Powers on audio output (and optionally a source), sets volume       | Audio + Source                  |
| **Gaming**     | Powers on display + audio + console, sets console input             | Display + Audio + Console       |
| **Background** | Powers on audio at a low volume for ambient music                   | Audio only                      |
| **Off**        | Deactivates the current activity and stops playback                 | All endpoints powered off       |

Only **one activity** can be active per room at a time. Selecting a new activity replaces the current one.

## How Media Differs from Other Domains

- **Lights and Coverings** control individual devices directly (turn on light, open blinds).
- **Media** is **activity-based**: you choose *what you want to do*, and the system figures out which devices to control and how.
- Media coordinates **multiple devices** together (display + audio + source) as a single action.

## Architecture

### Pipeline

```
Devices → Capabilities → Endpoints → Bindings → Plan → Executor
```

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

### Constants and Enums

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

## Endpoint Types

| Endpoint Type     | Description                                | Example Devices          |
|-------------------|--------------------------------------------|--------------------------|
| **Display**       | Visual output (screen, projector)          | TV, Monitor, Projector   |
| **Audio Output**  | Sound output with volume control           | Receiver, Soundbar       |
| **Source**         | Content provider                           | Streamer, Console, PC    |
| **Remote Target** | Device accepting remote/playback commands  | TV with CEC, Streamer    |

Each endpoint exposes a set of **capabilities** (power, volume, inputSelect, playback, mute) and **links** mapping those capabilities to concrete device properties.

## Endpoint Derivation

`DerivedMediaEndpointService.buildEndpointsForSpace(spaceId)`:

1. Loads all devices assigned to the space
2. For each device, iterates channels looking for known capability patterns
3. Maps device category + channel capabilities → endpoint type:
   - TV/Monitor → `display`
   - Receiver/Speaker → `audio_output`
   - Streamer/Console → `source`
   - Any device with playback → `remote_target`
4. Each endpoint records boolean capabilities and property ID links

Endpoint IDs are deterministic: `${spaceId}:${type}:${deviceId}`.

### Channel Capability Detection

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

### Adding a New Device Capability Extractor

To support a new device type:

1. Add the device category mapping in `DerivedMediaEndpointService.mapDeviceToEndpointType()`
2. Add capability extraction logic in `DerivedMediaEndpointService.extractCapabilities()`
3. Ensure the device's channels expose the expected property categories
4. Add test cases in `derived-media-endpoint.service.spec.ts`

## Bindings and Defaults

### Bindings vs Execution

- **Bindings** are the *configuration*: which endpoint fills each slot, what input to use, what volume to set.
- **Execution** is the *runtime*: the backend builds an ordered plan from bindings, then sends commands to devices.

Bindings are static. Execution is dynamic and handles failures gracefully.

### Default Bindings

`SpaceMediaActivityBindingService.applyDefaults(spaceId)`:

1. Builds derived endpoints for the space
2. For each activity key, checks if a binding already exists
3. If not, creates one using heuristics:
   - Watch: picks first display + first audio + first source
   - Listen: picks first audio + optional source (no display)
   - Gaming: picks first display + first audio + console-type source
   - Background: picks first audio only
4. Sets volume presets per activity defaults (Watch: 50, Listen: 40, Gaming: 60, Background: 25)

## Execution Plan

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

## API Endpoints

### Endpoints Discovery

`GET /api/v1/spaces/{spaceId}/media/endpoints`

Returns auto-detected endpoints. Each endpoint shows:
- Device name and ID
- Endpoint type (display, audio_output, source, remote_target)
- Capabilities (boolean flags: power, volume, inputSelect, playback, mute)
- Links (property IDs for each capability)

If no endpoints appear, the space has no media-capable devices.

### Bindings Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/{spaceId}/media/bindings` | List all activity bindings for a space |
| `POST` | `/{spaceId}/media/bindings` | Create a binding |
| `POST` | `/{spaceId}/media/bindings/{bindingId}` | Update a binding |
| `GET`  | `/{spaceId}/media/bindings/validate` | Validate all bindings and report issues |
| `POST` | `/{spaceId}/media/bindings/apply-defaults` | Auto-create bindings with default endpoint selections |

### Activity Control

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/{spaceId}/media/activities/active` | Get current active activity state |
| `POST` | `/{spaceId}/media/activities/{activityKey}/preview` | Dry-run preview (no execution) |
| `POST` | `/{spaceId}/media/activities/{activityKey}/activate` | Activate an activity |
| `POST` | `/{spaceId}/media/activities/deactivate` | Deactivate current activity |

## WebSocket Events

All events include `spaceId` and `activityKey`:

| Event | Trigger | Payload |
|-------|---------|---------|
| `MEDIA_ACTIVITY_ACTIVATING` | Activity activation started | space_id, activity_key, steps |
| `MEDIA_ACTIVITY_ACTIVATED` | Activation successful | state, activity_key, resolved, last_result |
| `MEDIA_ACTIVITY_FAILED` | Activation failed | state: failed, activity_key, last_result |
| `MEDIA_ACTIVITY_DEACTIVATED` | Activity deactivated | state: deactivated, activity_key: null |

Events are consumed by both Panel (Dart) and Admin (Vue) for real-time UI updates.

## Real-Time Connection

Media requires an active WebSocket connection to function properly. The panel communicates with the backend in real time to:

- Send activation commands
- Receive status updates (activating → active / failed)
- Get live feedback on partial failures or warnings

If the WebSocket connection is lost:
- The current activity status may become stale
- New activations will not work until the connection is restored
- The panel will indicate when the connection is unavailable

## Admin Configuration

### Configuration Flow

1. **Check Endpoints** — `GET /api/v1/spaces/{spaceId}/media/endpoints` to review auto-detected endpoints
2. **Apply Defaults** — `POST /api/v1/spaces/{spaceId}/media/bindings/apply-defaults` to generate sensible defaults (safe to call multiple times)
3. **Adjust Bindings** — Fine-tune endpoint slots, display input, and volume presets
4. **Preview (Dry Run)** — `POST /api/v1/spaces/{spaceId}/media/activities/{activityKey}/preview` to verify configuration
5. **Test Activity** — `POST /api/v1/spaces/{spaceId}/media/activities/{activityKey}/activate` to execute

### Warnings vs Errors

| Type        | Meaning                                            | Action Required?         |
|-------------|----------------------------------------------------|--------------------------|
| **Warning** | Non-critical step was skipped or failed             | Review, but not blocking |
| **Error**   | Critical step failed, activity did not fully activate | Fix configuration or device |

### Common Pitfalls

**Missing Volume Capability** — Some speakers or TVs don't expose volume control. The activity will still activate — volume preset is simply skipped. The dry-run preview will flag this.

**TV Without inputSelect** — If a TV doesn't report HDMI input switching, the display input step is skipped. The TV will stay on whatever input it was already using.

**Partial Failures Are OK** — Media activation is designed for **partial success**. If volume fails but everything else works, the activity is marked as Active with warnings. Only critical failures cause a Failed state.

**Endpoint Not Found** — If a binding references an endpoint ID that no longer exists (device was removed), the activation will warn or fail depending on whether that slot is critical for the activity.

## Panel UI

### Activity Status

Each activity shows its current state:
- **Activating** — the system is sending commands to your devices
- **Active** — everything is running
- **Failed** — something went wrong (details are shown)
- **Deactivated** — no activity is currently active

### First-Time Experience

When you open the Media domain for a room, the system automatically detects your media devices and creates default activity configurations. Available activities appear immediately — no manual setup required.

### Failure Handling

- **Partial failures** are normal — for example, volume might fail to set while the TV still turns on. The system continues with non-critical steps and reports what happened.
- **Critical failures** (e.g., TV won't power on for Watch) cause the activity to fail, with a clear error message.
- If no media devices are detected in a room, the Media domain will show a message explaining why it's unavailable.

## Error Handling

1. **Critical step failure** - Activity activation aborted, state set to FAILED
2. **Non-critical step failure** - Activation continues, partial success reported
3. **Device offline** - Handled per offline policy (SKIP, FAIL, or WAIT)
4. **Platform not found** - Step failed, counted in stepsFailed

## Testing

### Running Tests

```bash
# Run media regression suite only
pnpm run test:unit -- --testPathPattern=media-scenario-regression

# Run all media-related unit tests
pnpm run test:unit -- --testPathPattern=spaces/services/.*media
```

### Simulator Scenario Templates

Located at: `apps/backend/src/modules/spaces/services/__fixtures__/media-scenario-templates.ts`

| Template | Devices | Purpose |
|----------|---------|---------|
| `mediaTvOnly()` | 1x TV (power, input, remote; optional volume) | Basic single-display setup |
| `mediaSpeakerOnly()` | 1x Speaker (volume, playback, track; optional mute) | Audio-only setup |
| `mediaTvAvrConsoleStreamer()` | TV + AVR + Streamer + Console (optional background speaker) | Full "Media Rig" topology |
| `mediaMultiOutput()` | 2x Displays (TV + Projector) + 2x Audio (AVR + Speaker) | Edge case: multi-output selection stability |

All templates use **stable device IDs** so assertions are deterministic across runs.

### Test Harness

Located at: `apps/backend/src/modules/spaces/services/__fixtures__/media-test-harness.ts`

The `MediaTestHarness` class provides:
- Pre-configured mocks for all media services (spaces, endpoints, bindings, platform registry, event emitter)
- `loadScenario(scenario)` – wires up mocks from a template
- `buildEndpoint()` / `buildBinding()` / `buildMockDevice()` – factory helpers
- `getEmittedEvents(eventType)` – query captured WS events

### Regression Coverage

| Section | What it validates |
|---------|-------------------|
| Endpoints | Count by type, deterministic IDs, capability flags per device |
| Defaults | Slot assignment heuristics (AVR > TV speaker, speaker for listen, console for gaming), no-overwrite |
| Activation | Plan execution, state transitions, resolved device IDs |
| Failures | Non-critical → ACTIVE with warnings; critical → FAILED |
| WS Events | Event types (activating/activated/failed/deactivated), payload structure, ordering |

### Adding a New Scenario

1. Open `media-scenario-templates.ts`
2. Define stable device IDs as constants
3. Create a factory function returning a `MediaScenario`
4. Import and use in `media-scenario-regression.spec.ts`
5. Add describe blocks for each regression section as needed

## Where to Add Future Features

| Feature       | Where to Start                                           |
|---------------|----------------------------------------------------------|
| Queue/Playlist | New entity + service alongside `SpaceMediaActivityService` |
| Multiroom     | Extend bindings to reference endpoints from multiple spaces |
| Automations   | Listen to `MEDIA_ACTIVITY_*` events in an automation module |
| New device type | `DerivedMediaEndpointService` capability extraction       |

## File Structure

### Backend

```
apps/backend/src/modules/spaces/
├── entities/
│   ├── space-media-activity-binding.entity.ts
│   └── space-active-media-activity.entity.ts
├── services/
│   ├── media-capability.service.ts
│   ├── derived-media-endpoint.service.ts
│   ├── space-media-activity-binding.service.ts
│   └── space-media-activity.service.ts
├── models/
│   ├── derived-media-endpoint.model.ts
│   ├── media-activity.model.ts
│   └── media-routing.model.ts
├── dto/
│   └── media-activity-binding.dto.ts
└── spaces.constants.ts (MediaActivityKey, etc.)
```

### Admin

```
apps/admin/src/modules/spaces/components/
├── space-media-activities-dialog.vue
└── space-media-activities-summary.vue
```

### Panel

```
apps/panel/lib/modules/spaces/
├── models/media_activity/
│   └── media_activity.dart
├── services/
│   └── media_activity_service.dart
└── repositories/
    └── media_activity.dart
```
