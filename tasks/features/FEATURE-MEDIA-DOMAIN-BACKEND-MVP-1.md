# Task: Media Domain – Backend MVP #1 (Endpoints Read Model + API)
ID: FEATURE-MEDIA-DOMAIN-BACKEND-MVP-1
Type: feature
Scope: backend
Size: medium
Parent: FEATURE-SPACE-MEDIA-DOMAIN-V2
Status: done

## Purpose

Implement the backend foundation for the new Media domain by exposing a stable, device-driven
**Media Endpoints** read model for a given Space.

This PR is intentionally **read-only** (no routing activation yet).
It provides enough data for the Admin app to start configuring Media activities/routings later.

Backward compatibility is NOT required.

---

## Scope

### 1) MediaCapabilitySummary builder (derived)

Implement a builder that flattens a Space's devices into media-relevant capabilities.

**Input**: `Space → Devices → Channels → Properties/Commands`

**Output**: `MediaCapabilitySummary[]` (per device)

Each summary includes:
- `deviceId`
- `capabilities` flags (boolean):
  - `power` (RW/W)
  - `volume` (RW)
  - `mute` (RW)
  - `playback` (commands + optional state property)
  - `track` (title/artist/artwork/duration/position/progress)
  - `inputSelect` (RW enum/string)
  - `remoteCommands` (W-only set)
- `links`: mapping capability → concrete propertyId / commandId

This is a read model — no DB persistence required.

### 2) MediaEndpoint builder (derived)

Converts capability summaries into **functional endpoints**.

**Endpoint types**: `display`, `audio_output`, `source`, `remote_target`

**Rules**:
- A single device may expose multiple endpoints.
- Endpoints must not assume queue support.

**Endpoint ID strategy (MVP – deterministic)**:
`endpointId = "${spaceId}:${type}:${deviceId}"`

IDs must be stable across restarts and not depend on runtime ordering.

**Endpoint fields (minimum)**:
- `endpointId`, `spaceId`, `deviceId`, `type`
- `name` (device name + type label)
- `capabilities` (boolean flags for supported capabilities)
- `links` (propertyId/commandId mapping)

### 3) API endpoint

`GET /spaces/:spaceId/media/endpoints`

Returns:
- `spaceId`
- `endpoints: DerivedMediaEndpoint[]`

Suitable for Admin UI dropdown selection, diagnostics, and future routing configuration.

---

## Non-Goals

- No persistence for routings/bindings
- No routing activation / execution plan / executor
- No WS events
- No queue modeling
- No UI work

---

## Device Category Coverage (MVP)

- **TV**: display + remote_target, optional audio_output/source
- **Speaker**: audio_output + source, optional playback/track
- **AV Receiver**: audio_output, optional inputSelect/power
- **Streamer/Cast target**: source + remote_target if applicable

Missing capabilities must be omitted/false, not guessed.

---

## Acceptance Criteria

### Functional
- [x] `GET /spaces/:spaceId/media/endpoints` returns deterministic endpoint IDs
- [x] Each returned endpoint has correct `type` and `deviceId`
- [x] Capabilities and links accurately reflect existing device properties/commands
- [x] Missing capabilities are not inferred (no silent fallbacks)
- [x] Endpoint list contains multiple endpoints per device when applicable

### Quality
- [x] Unit tests for endpointId stability and endpoint generation
- [x] Unit tests with at least 3 simulated spaces (TV-only, Speaker-only, TV + Receiver + Speaker + Streamer)
- [x] Clear logging for endpoint generation
