# Task: Media Domain – Backend Refactor & Runtime Specification

## Scope
This task follows the Media Domain redesign (routing-based, activity-first).
Its goal is to define **backend data models, APIs, and runtime behavior**
required to implement the Media domain end-to-end.

This task is implementation-oriented.
Backward compatibility is NOT required.

---

## 1. Architectural Boundaries (Must Be Explicit)

### Decisions already made
- Media domain is **routing-based**, not role-based
- Media is **activity-first**, not device-first
- There is **no session-centric model**
- Roles (primary / secondary / gaming / background) are deprecated
- Queue / playlist is NOT required for MVP

### Sources of truth
- Device state = properties / commands on devices
- Media routing configuration = backend persisted data
- Media endpoints & capabilities = derived read models

---

## 2. Backend Data Model

### 2.1 Persisted Entities

#### MediaRouting
Represents a user-defined or auto-generated media activity.

Required fields:
- id
- spaceId
- name
- type (`watch | listen | gaming | background | off | custom`)
- icon (optional)
- slots:
  - display?
  - audio?
  - source?
  - remoteTarget?
- policies:
  - powerPolicy
  - inputPolicy
  - conflictPolicy
  - offlinePolicy
- createdAt / updatedAt

Routing MUST NOT reference roles.
Routing MUST reference **endpointIds** only.

---

#### ActiveMediaRouting
Represents current active routing per space.

- spaceId
- routingId (nullable for Off)
- activatedAt
- activationState (`activating | active | failed | deactivated`)
- lastError? (for partial failures)

Only ONE active routing per space is allowed.

---

### 2.2 Derived / Read Models (Not Primary Storage)

#### MediaCapabilitySummary
Flattened capabilities per device.

For each device:
- deviceId
- supported capabilities:
  - power
  - volume
  - mute
  - playback
  - track
  - inputSelect
  - remoteCommands
- mapping of capability → propertyId / commandId

This model is derived from:
Space → Devices → Channels → Properties

---

#### MediaEndpoint
Functional abstraction over devices.

Fields:
- endpointId (stable)
- spaceId
- deviceId
- type (`display | audio_output | source | remote_target`)
- linked capabilities (propertyId / commandId references)
- traits (optional: latency, preferredFor, etc.)

Endpoints may be computed or persisted, but MUST be addressable by ID.

---

## 3. Capability Extractors (Critical)

Define explicit extractor rules for each media device category:

### Required extractor specs
- TV
- AV Receiver
- Speaker
- Streamer / Cast target
- Console (limited, mostly input-based)

Each extractor must define:
- required properties/commands
- optional properties/commands
- fallback rules (e.g. audio via receiver instead of TV)
- unsupported capability behavior (skip vs error)

Extractor output = MediaCapabilitySummary entries.

---

## 4. Routing Resolver (Planning Phase)

### Responsibility
Convert `MediaRouting` → `MediaExecutionPlan`

### Resolver must:
- validate referenced endpoints still exist
- resolve deviceIds from endpoints
- determine execution order:
  1. power
  2. input selection
  3. playback / volume
  4. conflict resolution
- skip steps that cannot be executed
- mark steps as critical or optional

Resolver MUST NOT:
- assume queue support
- assume all devices support power/input

---

## 5. Execution Engine (Runtime Phase)

### MediaExecutionPlan
- routingId
- spaceId
- resolved endpoints (display/audio/source)
- ordered steps:
  - setProperty
  - sendCommand
- critical vs non-critical steps

### Executor requirements
- sequential execution
- timeout per step
- partial success allowed
- failure reporting per routing activation

Execution results must update `ActiveMediaRouting`.

---

## 6. API Contracts

### Required APIs

- `GET /spaces/:spaceId/media/capabilities`
- `GET /spaces/:spaceId/media/endpoints`
- `GET /spaces/:spaceId/media/routings`
- `POST /spaces/:spaceId/media/routings`
- `POST /spaces/:spaceId/media/routings/:id/activate`
- `POST /spaces/:spaceId/media/routings/deactivate`

### WebSocket / Events
- `media.routing.activating`
- `media.routing.activated`
- `media.routing.failed`
- `media.routing.deactivated`
- `media.endpoint.updated` (device capability change)

---

## 7. Default Routing Generation

On space initialization or device changes:
- auto-generate default routings:
  - Watch (if display exists)
  - Listen (if audio source exists)
  - Gaming (if console + display exist)
  - Off (always)

Generated routings MUST be editable by the user.

---

## 8. UI Contract (Backend Responsibilities)

Backend must provide enough data so UI can:
- show activity selector
- render "active routing card"
- know which controls are valid (capabilities)
- explain routing composition (TV + Receiver + Console)

UI MUST NOT guess behavior.

---

## 9. Migration & Cleanup

Since BC is not required:
- remove role-based logic
- remove role-dependent intents
- remove unused lighting/covering assumptions from media domain

---

## 10. Deliverables

Please produce:

1. Final backend data model (entities + relations)
2. API contract definitions (request/response shapes)
3. Capability extractor specification
4. Resolver & executor flow description
5. Notes on future extensions:
   - multiroom
   - queue
   - grouping
   - scenes / automation

Avoid:
- role-based logic
- session-centric playback
- implicit assumptions about device behavior

---

## Implementation Status

### Completed
- [x] Task specification saved to docs/features
- [x] ActiveMediaRouting entity created
- [x] Policy enums added (inputPolicy, conflictPolicy, offlinePolicy)
- [x] MediaRouting entity updated with new policy fields
- [x] Capability extractor specification documented
- [x] API endpoints implemented
- [x] WebSocket events for routing activation states
- [x] Default routing generation enhanced
- [x] Database migration created

### Architecture Notes

The implementation follows the routing-based, activity-first architecture:

1. **Entities**:
   - `SpaceMediaEndpointEntity` - Functional device projections
   - `SpaceMediaRoutingEntity` - Activity presets with endpoint references
   - `SpaceActiveMediaRoutingEntity` - Tracks active routing state per space

2. **Services**:
   - `SpaceMediaEndpointService` - Manages endpoints and capability detection
   - `SpaceMediaRoutingService` - Handles routing CRUD, activation, and state

3. **Events**:
   - `MEDIA_ROUTING_ACTIVATING` - Routing activation started
   - `MEDIA_ROUTING_ACTIVATED` - Routing successfully activated
   - `MEDIA_ROUTING_FAILED` - Routing activation failed
   - `MEDIA_ROUTING_DEACTIVATED` - Routing deactivated

4. **Capability Extractors**:
   - TV/Projector → Display + Audio Output + Remote Target
   - AV Receiver → Audio Output + Source (input routing)
   - Speaker → Audio Output
   - Streamer/STB/Console → Source + Remote Target
