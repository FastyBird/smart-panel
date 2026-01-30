# Media Domain – Admin Guide

## Overview

The Media domain enables activity-based entertainment control within spaces. As an admin, you configure how devices are grouped and controlled for each activity (Watch, Listen, Gaming, Background, Off).

## Core Concepts

### Media Endpoints

Endpoints are **functional roles** derived automatically from devices assigned to a space. They are not manually created — the backend inspects each device's capabilities and produces endpoints.

| Endpoint Type     | Description                                | Example Devices          |
|-------------------|--------------------------------------------|--------------------------|
| **Display**       | Visual output (screen, projector)          | TV, Monitor, Projector   |
| **Audio Output**  | Sound output with volume control           | Receiver, Soundbar       |
| **Source**         | Content provider                           | Streamer, Console, PC    |
| **Remote Target** | Device accepting remote/playback commands  | TV with CEC, Streamer    |

Each endpoint exposes a set of **capabilities** (power, volume, inputSelect, playback, mute) and **links** mapping those capabilities to concrete device properties.

### Media Activities

Activities define *what the user wants to do*. Each activity has **bindings** that map it to specific endpoints:

- **Watch** — Display + Audio + Source (volume preset: 50)
- **Listen** — Audio + optional Source (volume preset: 40)
- **Gaming** — Display + Audio + Console source (volume preset: 60)
- **Background** — Audio only at low volume (volume preset: 25)
- **Off** — Deactivates everything

### Bindings vs Execution

- **Bindings** are the *configuration*: which endpoint fills each slot, what input to use, what volume to set.
- **Execution** is the *runtime*: the backend builds an ordered plan from bindings, then sends commands to devices.

Bindings are static. Execution is dynamic and handles failures gracefully.

## Configuration Flow

### 1. Check Endpoints

`GET /api/v1/spaces/{spaceId}/media/endpoints`

Review the auto-detected endpoints. Each endpoint shows:
- Device name and ID
- Endpoint type (display, audio_output, source, remote_target)
- Capabilities (boolean flags: power, volume, inputSelect, playback, mute)
- Links (property IDs for each capability)

If no endpoints appear, the space has no media-capable devices.

### 2. Apply Defaults

`POST /api/v1/spaces/{spaceId}/media/bindings/apply-defaults`

Generates sensible default bindings for all activities based on available endpoints. Safe to call multiple times — it only creates bindings that don't already exist.

### 3. Adjust Bindings

`PATCH /api/v1/spaces/{spaceId}/media/bindings/{bindingId}`

Fine-tune individual bindings:
- Change which endpoint fills each slot (displayEndpointId, audioEndpointId, etc.)
- Set display input (displayInputId)
- Adjust volume preset (audioVolumePreset: 0–100)

### 4. Preview (Dry Run)

`POST /api/v1/spaces/{spaceId}/media/activities/{activityKey}/activate?dryRun=true`

Returns the execution plan without sending any commands. Shows:
- Ordered steps with labels and criticality
- Skip warnings (e.g., "Volume preset skipped — device has no volume capability")
- Resolved device IDs

Use this to verify configuration before testing with real devices.

### 5. Test Activity

`POST /api/v1/spaces/{spaceId}/media/activities/{activityKey}/activate`

Executes the activity. The response includes:
- Final state (active / failed)
- Step-by-step results (succeeded / failed / warning counts)
- Structured error and warning details

## Reading Warnings vs Errors

| Type        | Meaning                                            | Action Required?         |
|-------------|----------------------------------------------------|--------------------------|
| **Warning** | Non-critical step was skipped or failed             | Review, but not blocking |
| **Error**   | Critical step failed, activity did not fully activate | Fix configuration or device |

Examples:
- Warning: "Volume preset skipped (Speaker has no volume capability)" — the speaker works but can't be volume-controlled via the system.
- Error: "Device not found" — the endpoint references a device that was removed from the space.

## Common Pitfalls

### Missing Volume Capability
Some speakers or TVs don't expose volume control. The activity will still activate — volume preset is simply skipped. The dry-run preview will flag this.

### TV Without inputSelect
If a TV doesn't report HDMI input switching, the display input step is skipped. The TV will stay on whatever input it was already using. Consider checking CEC or IR integration support.

### Partial Failures Are OK
Media activation is designed for **partial success**. If volume fails but everything else works, the activity is marked as Active with warnings. Only critical failures (display/audio power-on for Watch) cause a Failed state.

### Endpoint Not Found
If a binding references an endpoint ID that no longer exists (device was removed), the activation will warn or fail depending on whether that slot is critical for the activity.
