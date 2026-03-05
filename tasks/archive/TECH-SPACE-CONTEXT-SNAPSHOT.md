# Task: Capture Space context snapshots
ID: TECH-SPACE-CONTEXT-SNAPSHOT
Type: technical
Scope: backend
Size: medium
Parent: EPIC-SPACES-FIRST-UX
Status: done

## 1. Business goal

In order to support undo functionality, scene saving, and provide context for automation decisions,
As a panel or automation system,
I want to capture a complete snapshot of the current state of all devices in a space.

## 2. Context

- Spaces contain lighting devices and climate devices.
- The panel needs to know the current state before executing intent commands for potential undo.
- Automation systems need context about current device states for decision making.
- Scene saving features will need to capture current state.

## 3. Scope

**In scope**

Backend:
- Create SpaceContextSnapshotService with `captureSnapshot(spaceId)` method
- Capture lighting state for each light: on/off, brightness, color temperature, color
- Capture lighting roles for each light
- Reuse existing climate state from SpaceIntentService
- Add response models for snapshot data
- Add `GET /spaces/:id/context/snapshot` endpoint
- Add unit tests

**Out of scope**

- Storing snapshots in database
- Restoring snapshots (applying saved state)
- Capturing cover/media device states

## 4. Acceptance criteria

- [x] `GET /spaces/:id/context/snapshot` returns complete context snapshot
- [x] Lighting snapshot includes all lights with on/off, brightness, color temp, color
- [x] Lighting snapshot includes role assignments for each light
- [x] Lighting summary includes total lights, lights on, and average brightness
- [x] Climate state is included in snapshot
- [x] Snapshot includes timestamp
- [x] Unit tests cover snapshot capture logic
- [x] OpenAPI spec is regenerated

## 5. Implementation

### Files Created
- `apps/backend/src/modules/spaces/services/space-context-snapshot.service.ts` - Main service
- `apps/backend/src/modules/spaces/services/space-context-snapshot.service.spec.ts` - Unit tests

### Files Modified
- `apps/backend/src/modules/spaces/models/spaces-response.model.ts` - Added snapshot response models
- `apps/backend/src/modules/spaces/controllers/spaces.controller.ts` - Added endpoint
- `apps/backend/src/modules/spaces/spaces.module.ts` - Registered service

### API Response

The `GET /spaces/:id/context/snapshot` endpoint returns:

```json
{
  "data": {
    "space_id": "uuid",
    "space_name": "Living Room",
    "captured_at": "2025-01-25T12:00:00Z",
    "lighting": {
      "summary": {
        "total_lights": 3,
        "lights_on": 2,
        "average_brightness": 75
      },
      "lights": [
        {
          "device_id": "uuid",
          "device_name": "Ceiling Light",
          "channel_id": "uuid",
          "channel_name": "Light",
          "role": "main",
          "is_on": true,
          "brightness": 80,
          "color_temperature": 4000,
          "color": null
        }
      ]
    },
    "climate": {
      "has_climate": true,
      "current_temperature": 22.5,
      "target_temperature": 21.0,
      "min_setpoint": 5,
      "max_setpoint": 35,
      "can_set_setpoint": true,
      "primary_thermostat_id": "uuid",
      "primary_sensor_id": "uuid"
    }
  }
}
```

## 6. Technical constraints

- Follow existing module / service structure in backend.
- Do not introduce new dependencies.
- Do not modify generated code.
- Tests are expected for new logic.

## 7. AI instructions

- Read this file entirely before making any code changes.
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
