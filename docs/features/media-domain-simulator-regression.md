# Media Domain – Simulator Scenarios & Regression Suite

## Overview

The media domain regression suite provides **deterministic simulator scenario templates** and a comprehensive test suite that validates endpoint derivation, binding defaults, activation, failure handling, and WebSocket events.

## Running the Tests

```bash
# Run media regression suite only
pnpm run test:unit -- --testPathPattern=media-scenario-regression

# Run all media-related unit tests
pnpm run test:unit -- --testPathPattern=spaces/services/.*media
```

## Scenario Templates

Located at: `apps/backend/src/modules/spaces/services/__fixtures__/media-scenario-templates.ts`

| Template | Devices | Purpose |
|----------|---------|---------|
| `mediaTvOnly()` | 1× TV (power, input, remote; optional volume) | Basic single-display setup |
| `mediaSpeakerOnly()` | 1× Speaker (volume, playback, track; optional mute) | Audio-only setup |
| `mediaTvAvrConsoleStreamer()` | TV + AVR + Streamer + Console (optional background speaker) | Full "Media Rig" topology |
| `mediaMultiOutput()` | 2× Displays (TV + Projector) + 2× Audio (AVR + Speaker) | Edge case: multi-output selection stability |

All templates use **stable device IDs** so assertions are deterministic across runs.

## Test Harness

Located at: `apps/backend/src/modules/spaces/services/__fixtures__/media-test-harness.ts`

The `MediaTestHarness` class provides:
- Pre-configured mocks for all media services (spaces, endpoints, bindings, platform registry, event emitter)
- `loadScenario(scenario)` – wires up mocks from a template
- `buildEndpoint()` / `buildBinding()` / `buildMockDevice()` – factory helpers
- `getEmittedEvents(eventType)` – query captured WS events

## Regression Coverage

| Section | What it validates |
|---------|-------------------|
| 3.1 Endpoints | Count by type, deterministic IDs, capability flags per device |
| 3.2 Defaults | Slot assignment heuristics (AVR > TV speaker, speaker for listen, console for gaming), no-overwrite |
| 3.3 Activation | Plan execution, state transitions, resolved device IDs |
| 3.4 Failures | Non-critical → ACTIVE with warnings; critical → FAILED |
| 3.5 WS Events | Event types (activating/activated/failed/deactivated), payload structure, ordering |

## Adding a New Scenario

1. Open `media-scenario-templates.ts`
2. Define stable device IDs as constants (e.g. `DEVICE_SOUNDBAR`)
3. Create a factory function returning a `MediaScenario`:
   ```ts
   export function mediaNewScenario(): MediaScenario {
       resetIds();
       return {
           name: 'media_new_scenario',
           description: 'Description of the topology',
           spaceId: SPACE_ID,
           devices: [
               { deviceId: DEVICE_TV, deviceName: 'TV', ... },
           ],
       };
   }
   ```
4. Import and use in `media-scenario-regression.spec.ts`
5. Add describe blocks for each regression section as needed
