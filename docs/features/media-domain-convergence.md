# Task: Media Domain – Convergence Phase (Contracts, Stability, UX Readiness)

## Purpose

This task finalizes the Media domain design so it can safely move into
full backend implementation and UI integration.

The goal is to:
- eliminate remaining ambiguities,
- stabilize contracts,
- define clear boundaries between backend, runtime logic, and UI,
- and ensure the Media domain can evolve without rework.

This task assumes:
- routing-based Media domain,
- endpoint abstraction,
- no role-based logic,
- no queue support for MVP.

---

## 1. Final Domain Invariants (Must Be Enforced)

Explicitly define and lock the following invariants:

### 1.1 Space-level rules
- Only **one active media routing per space** is allowed.
- Media routings are **space-scoped**, not global.
- Media domain behavior must be explainable purely from:
  Space → Devices → Endpoints → Routing.

### 1.2 Routing rules
- Routing activation is **idempotent**.
- Activating the same routing twice must not re-run destructive steps.
- Routing activation may result in:
  - full success
  - partial success
  - failure
- Partial success is acceptable and must be visible to UI.

### 1.3 Endpoint rules
- Endpoints are **functional**, not physical.
- Endpoints must never hide missing capabilities.
- If a capability is missing, the UI must know it is missing.

---

## 2. Stable Identifier Strategy

### 2.1 Endpoint IDs
Define and document:
- how endpoint IDs are generated,
- when they change,
- and how stability across restarts is ensured.

Constraints:
- UI must be able to store references to endpointIds.
- Routing definitions must not silently break on device reloads.

Propose and justify one strategy:
- deterministic IDs (space + device + type)
- or persisted endpoint registry

---

## 3. Capability Contracts (Finalization)

Convert previous extractor ideas into **explicit contracts**.

For each media device category:
- TV
- AV Receiver
- Speaker
- Streamer / Cast Target
- Console (limited)

Define:
- required capabilities
- optional capabilities
- forbidden assumptions
- fallback behavior

Example questions to answer explicitly:
- If TV has no volume, where does volume go?
- If receiver exists but is off, should it be powered on?
- If source endpoint has playback but no track metadata, what does UI show?

This section must remove guesswork for integrators and UI.

---

## 4. Routing Semantics (User Mental Model)

For each core routing type:
- Watch
- Listen
- Gaming
- Background
- Off

Define in plain language:
- what the user expects to happen,
- which endpoints are involved,
- which devices may be affected outside the routing,
- what is explicitly *out of scope*.

This is the **UX contract**, not implementation details.

---

## 5. Execution Guarantees & Failure Model

Define:
- which steps are considered **critical**
- which are **best-effort**
- when activation must abort
- when activation continues with warnings

Specify:
- how executor reports partial failures,
- how UI should represent them,
- when ActiveMediaRouting is considered "active".

---

## 6. UI–Backend Contract (Final)

Define exactly what backend guarantees to UI:

### Backend guarantees
- UI will always know:
  - active routing
  - involved endpoints
  - which controls are valid
- Backend will never:
  - guess UI behavior
  - hide unsupported capabilities

### UI responsibilities
- UI must not:
  - infer device behavior
  - assume routing completeness
- UI must:
  - render based on capabilities
  - handle partial routing states gracefully

This must be explicit to avoid UI/back-end drift.

---

## 7. Offline & Degraded Mode Policy

Define final behavior for:
- WebSocket unavailable
- Device temporarily offline
- Capability changes mid-routing

Clarify:
- which actions are blocked
- which are allowed
- how UI communicates this

Media domain is allowed to be **strict** here.

---

## 8. Readiness Checklist (Gate to Implementation)

Produce a checklist that must be true before coding begins:

- [ ] Endpoint ID strategy approved
- [ ] Capability contracts finalized
- [ ] Routing semantics documented
- [ ] API & WS payloads frozen
- [ ] Failure model agreed
- [ ] Default routings defined

Only after this checklist is complete should full implementation start.

---

## 9. Deliverables

Please produce:

1. Final Media Domain invariants document
2. Endpoint ID strategy proposal
3. Capability contracts per device category
4. Routing semantics description (user-facing)
5. Execution & failure model
6. Final UI–backend responsibility split

This task should **not introduce new concepts**.
It should converge the design, not expand it.

---

## Implementation Status

### Completed
- [x] Task specification saved to docs/features
- [x] Domain invariants documented
- [x] Endpoint ID strategy defined (persisted registry)
- [x] Capability contracts finalized per device category
- [x] Routing semantics documented (user-facing)
- [x] Execution and failure model specified
- [x] UI-backend responsibility split documented
- [x] Offline and degraded mode policy defined
- [x] Readiness checklist created

---

# Convergence Deliverables

## Deliverable 1: Final Media Domain Invariants

### Space-Level Invariants

| Invariant | Description | Enforcement |
|-----------|-------------|-------------|
| Single Active Routing | Only one routing can be active per space at any time | `SpaceActiveMediaRoutingEntity` has unique constraint on `spaceId` |
| Space Scope | All media entities (endpoints, routings) are space-scoped | Foreign key constraints to `SpaceEntity` |
| Explainable State | Media state is derivable from Space → Devices → Endpoints → Routing chain | No hidden state; all data accessible via API |

### Routing Invariants

| Invariant | Description | Implementation |
|-----------|-------------|----------------|
| Idempotent Activation | Re-activating the same routing is a no-op for already-applied steps | IF_DIFFERENT input policy skips unchanged inputs; power policy checks current state |
| Partial Success Allowed | Routing can be "active" even if non-critical steps failed | `MediaActivationState.ACTIVE` set when critical steps succeed |
| Conflict Resolution | Only one routing active; conflicts resolved per `conflictPolicy` | REPLACE, FAIL_IF_ACTIVE, or DEACTIVATE_FIRST policies |
| Type Uniqueness | Only one routing per type per space (e.g., one WATCH routing) | Validation in `create()` method |

### Endpoint Invariants

| Invariant | Description | Implementation |
|-----------|-------------|----------------|
| Functional Abstraction | Endpoints represent capabilities, not physical devices | One device can expose multiple endpoints (TV → DISPLAY + AUDIO_OUTPUT) |
| Capability Transparency | Missing capabilities are explicitly null, never hidden | Capabilities JSON stored on endpoint entity |
| Device Uniqueness per Type | One endpoint per device per type per space | Unique constraint on (spaceId, deviceId, type) |
| Persistent IDs | Endpoint IDs survive restarts and resyncs | UUIDs persisted in database |

---

## Deliverable 2: Endpoint ID Strategy

### Strategy: Persisted Endpoint Registry

**Decision**: Endpoint IDs are UUIDs generated at creation time and persisted in the database.

### Rationale

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| Deterministic (space+device+type) | Predictable, no storage needed | IDs change if device ID changes; collision risk | Rejected |
| Persisted Registry | Stable across restarts; survives device reconnects | Requires database storage | **Selected** |

### ID Generation Rules

1. **Creation**: UUID generated by TypeORM `@PrimaryGeneratedColumn('uuid')`
2. **Stability**: ID never changes once endpoint is created
3. **Deletion**: Deleting an endpoint removes the ID permanently
4. **Re-creation**: Creating a new endpoint for same device+type gets a new UUID

### UI Contract for Endpoint IDs

```typescript
// UI can safely store endpoint references
interface StoredRoutingPreference {
  routingId: string;           // Stable UUID
  displayEndpointId: string;   // Stable UUID
  audioEndpointId: string;     // Stable UUID
  // These IDs will not change unless:
  // 1. Endpoint is explicitly deleted
  // 2. Associated device is removed from space
}
```

### Device Reconnection Handling

| Scenario | Endpoint Impact | Routing Impact |
|----------|-----------------|----------------|
| Device temporarily offline | Endpoint preserved | Routing references preserved; offline policy applies |
| Device removed from space | Endpoints deleted (cascade) | Routing references cleared (nullable FK) |
| Device reconnects with same ID | No change | No change |
| Device replaced (new ID) | New endpoints must be created | Routings must be updated |

---

## Deliverable 3: Capability Contracts by Device Category

### Television (TV) / Projector

| Capability | Required | Optional | Property Category | Notes |
|------------|----------|----------|-------------------|-------|
| Power | Yes | - | ON / ACTIVE | Must support power on/off |
| Volume | No | Yes | VOLUME | If missing, audio goes to external |
| Mute | No | Yes | MUTE | Only if volume present |
| Input Select | No | Yes | SOURCE | For HDMI/input switching |
| Remote Commands | No | Yes | REMOTE_KEY | For D-pad, menu navigation |

**Suggested Endpoint Types**: DISPLAY, AUDIO_OUTPUT (if volume), REMOTE_TARGET (if remote)

**Fallback Rules**:
- If TV has no volume → audio routing must use separate AUDIO_OUTPUT endpoint
- If TV has no input select → input switching skipped (no error)
- UI must show volume controls only if capability present

### AV Receiver

| Capability | Required | Optional | Property Category | Notes |
|------------|----------|----------|-------------------|-------|
| Power | Yes | - | ON / ACTIVE | Must support power control |
| Volume | Yes | - | VOLUME | Primary audio control |
| Mute | Yes | - | MUTE | Required for receiver |
| Input Select | Yes | - | SOURCE | Core receiver function |

**Suggested Endpoint Types**: AUDIO_OUTPUT, SOURCE

**Fallback Rules**:
- If receiver is off when routing activates → power on if `powerPolicy: ON`
- If receiver has no input matching routing → activation continues, input step skipped
- Volume preset applied after power and input steps

### Speaker (Standalone)

| Capability | Required | Optional | Property Category | Notes |
|------------|----------|----------|-------------------|-------|
| Power | No | Yes | ON / ACTIVE | Many speakers auto-power |
| Volume | Yes | - | VOLUME | Must have volume control |
| Mute | No | Yes | MUTE | Optional |

**Suggested Endpoint Types**: AUDIO_OUTPUT

**Fallback Rules**:
- If speaker has no power control → power step skipped (speaker assumed always-on)
- Background routing typically targets speakers at low volume
- No input selection expected

### Streamer / Set-Top Box / Cast Target

| Capability | Required | Optional | Property Category | Notes |
|------------|----------|----------|-------------------|-------|
| Power | No | Yes | ON / ACTIVE | Some streamers always-on |
| Playback | No | Yes | COMMAND | Play/pause/stop/next/prev |
| Playback State | No | Yes | STATE | Current playback status |
| Track Metadata | No | Yes | Various | Artist, title, artwork |
| Remote Commands | No | Yes | REMOTE_KEY | Navigation |

**Suggested Endpoint Types**: SOURCE, REMOTE_TARGET (if remote)

**Fallback Rules**:
- If no playback capability → UI hides playback controls
- If no track metadata → UI shows "No track info" placeholder
- Source endpoint represents content origin, not physical location

### Game Console

| Capability | Required | Optional | Property Category | Notes |
|------------|----------|----------|-------------------|-------|
| Power | No | Yes | ON / ACTIVE | Often controlled via IR blaster |
| Remote Commands | No | Yes | REMOTE_KEY | Limited to power toggle typically |

**Suggested Endpoint Types**: SOURCE, REMOTE_TARGET (if remote)

**Fallback Rules**:
- Gaming routing primarily about input switching on TV/receiver
- Console power control is best-effort
- UI should not assume console supports advanced media controls

### Capability Permission Matrix

| Capability | Read | Write | Notes |
|------------|------|-------|-------|
| Power | Yes | Yes | Read current state, write to change |
| Volume | Yes | Yes | Read level, write to adjust |
| Mute | Yes | Yes | Read state, write to toggle |
| Input | Yes | Yes | Read current, write to switch |
| Playback | Write | Yes | Commands are write-only |
| Playback State | Yes | No | Read-only status |
| Track Metadata | Yes | No | Read-only info |
| Remote | Write | Yes | Key commands are write-only |

---

## Deliverable 4: Routing Semantics (User Mental Model)

### WATCH Routing

**User Expectation**: "I want to watch TV/movies"

| Aspect | Description |
|--------|-------------|
| **What happens** | TV turns on, receiver/soundbar activates, input switches to selected source |
| **Display** | Powers on, switches to configured HDMI input |
| **Audio** | Volume set to comfortable level (default: 50%), receiver input set |
| **Source** | If specified, powers on (e.g., Apple TV, cable box) |
| **Volume control** | Controls audio endpoint (receiver if present, TV if not) |
| **Out of scope** | Does not start any specific content; does not adjust lighting |

### LISTEN Routing

**User Expectation**: "I want to listen to music"

| Aspect | Description |
|--------|-------------|
| **What happens** | Audio system activates for music playback |
| **Display** | Not affected (may remain off or on previous state) |
| **Audio** | Speakers/receiver power on, volume set (default: 40%) |
| **Source** | Streaming device may activate if specified |
| **Volume control** | Controls audio endpoint directly |
| **Out of scope** | Does not select specific playlist; display remains unchanged |

### GAMING Routing

**User Expectation**: "I want to play games"

| Aspect | Description |
|--------|-------------|
| **What happens** | TV and audio optimized for gaming, input switches to console |
| **Display** | Powers on, switches to console HDMI input |
| **Audio** | Volume set to gaming level (default: 60%), receiver input set |
| **Source** | Console may be powered on (if supported) |
| **Volume control** | Controls audio endpoint |
| **Out of scope** | Does not change TV picture mode (future feature) |

### BACKGROUND Routing

**User Expectation**: "I want ambient/background music while doing other things"

| Aspect | Description |
|--------|-------------|
| **What happens** | Audio plays at low volume, no visual distraction |
| **Display** | Not affected (typically off) |
| **Audio** | Speakers activate at low volume (default: 25%) |
| **Source** | May activate streaming source |
| **Volume control** | Controls audio endpoint at lower range |
| **Out of scope** | Does not dim/turn off displays automatically |

### OFF Routing

**User Expectation**: "Turn everything off"

| Aspect | Description |
|--------|-------------|
| **What happens** | All media devices in the routing power off |
| **Display** | Powers off |
| **Audio** | Powers off |
| **Source** | Powers off (if power control available) |
| **Volume control** | Disabled (no active audio endpoint) |
| **Out of scope** | Does not turn off non-media devices (lights, etc.) |

### User-Facing Guarantees

1. **Routing changes are explicit** - User must select a routing; nothing happens automatically
2. **Volume is predictable** - Active routing always has one designated volume endpoint
3. **State is visible** - UI shows which routing is active and its status
4. **Partial states are shown** - If some devices failed, UI indicates which ones
5. **OFF is always available** - User can always deactivate media

---

## Deliverable 5: Execution and Failure Model

### Execution Steps Classification

| Step Type | Critical | Abort on Failure | Example |
|-----------|----------|------------------|---------|
| Display Power ON | Yes | Yes | TV must be on for watch routing |
| Audio Power ON | Yes | Yes | Audio system must be available |
| Source Power ON | No | No | Nice to have, not essential |
| Input Switching | No | No | Routing works even if input fails |
| Volume Preset | No | No | User can adjust manually |
| Remote Target Setup | No | No | Navigation still possible via other means |

### Failure Scenarios and Handling

| Scenario | Handling | Final State | UI Display |
|----------|----------|-------------|------------|
| All steps succeed | Complete | ACTIVE | "Watch mode active" |
| Critical step fails | Abort remaining | FAILED | "Failed to activate: TV offline" |
| Non-critical step fails | Continue | ACTIVE | "Watch mode active (volume preset skipped)" |
| Device offline (SKIP policy) | Skip device steps | ACTIVE | "Active (1 device offline)" |
| Device offline (FAIL policy) | Abort if critical | FAILED | "Failed: critical device offline" |
| Device offline (WAIT policy) | Wait with timeout | ACTIVE or FAILED | "Waiting for device..." → result |

### Activation State Machine

```
┌──────────────┐
│   (none)     │ ◄── Initial state (no routing activated yet)
└──────┬───────┘
       │ activate()
       ▼
┌──────────────┐
│  ACTIVATING  │ ◄── Execution in progress
└──────┬───────┘
       │
       ├─────────────────────┐
       │ all critical pass   │ any critical fails
       ▼                     ▼
┌──────────────┐      ┌──────────────┐
│    ACTIVE    │      │    FAILED    │
└──────┬───────┘      └──────────────┘
       │
       │ deactivate() or new routing
       ▼
┌──────────────┐
│  DEACTIVATED │
└──────────────┘
```

### Step Execution Result Schema

```typescript
interface MediaExecutionStepResultModel {
  order: number;           // Step sequence number
  deviceId: string;        // Device that was targeted
  status: 'success' | 'failed' | 'skipped';
  error?: string;          // Error message if failed/skipped
}

interface MediaRoutingActivationResultModel {
  success: boolean;        // Overall activation success
  routingId: string;
  routingType: MediaRoutingType;
  stepsExecuted: number;   // Successfully executed steps
  stepsFailed: number;     // Failed steps
  stepsSkipped: number;    // Skipped steps (offline, policy)
  stepResults?: MediaExecutionStepResultModel[];
  offlineDeviceIds?: string[];  // Devices that were offline
}
```

### When is Routing Considered "Active"?

| Condition | Result |
|-----------|--------|
| All critical steps succeed | ACTIVE |
| Some non-critical steps fail | ACTIVE (with warnings) |
| Any critical step fails | FAILED |
| Zero steps to execute (empty routing) | ACTIVE (trivially) |

---

## Deliverable 6: UI–Backend Responsibility Split

### Backend Guarantees to UI

| Guarantee | Implementation | API Endpoint |
|-----------|----------------|--------------|
| Active routing is always known | `activeRoutingId` in media state | GET /spaces/:id/media/state |
| Endpoint capabilities are explicit | `capabilities` JSON on endpoint | GET /spaces/:id/media/endpoints |
| Activation status is real-time | WebSocket events | WS: media.routing.* events |
| Missing capabilities = null | Never hide as default value | Capability fields are nullable |
| Partial success is visible | `stepsExecuted/Failed/Skipped` | POST .../activate response |

### Backend Will Never...

| Anti-pattern | Why |
|--------------|-----|
| Guess UI layout | UI decides based on capabilities |
| Hide errors | All failures exposed in step results |
| Auto-retry silently | User must be aware of retry |
| Assume device behavior | Only act on explicit capability info |
| Change routing without request | No background auto-switching |

### UI Responsibilities

| Responsibility | Implementation |
|----------------|----------------|
| Render based on capabilities | Check each capability before showing control |
| Handle partial states | Show warnings when `stepsFailed > 0` |
| Show offline indicators | Use `offlineDevicesCount` from state |
| Disable invalid controls | Grey out volume if no audio endpoint |
| Confirm destructive actions | Prompt before OFF routing if content playing |

### UI Must Never...

| Anti-pattern | Why |
|--------------|-----|
| Infer capabilities | If not in capabilities, don't show control |
| Assume routing completeness | Always check activation result |
| Cache routing state locally | Always fetch fresh from backend |
| Make direct device calls | All control goes through routing service |

### Control Availability Matrix (UI Reference)

| Control | Available When | Hidden When |
|---------|----------------|-------------|
| Volume slider | Audio endpoint has volume capability | No active audio endpoint |
| Mute toggle | Audio endpoint has mute capability | No mute capability |
| Play/Pause | Source endpoint has playback capability | No source or no playback |
| Track info | Source has track_metadata | No metadata capability |
| Input selector | Display has input capability | No input capability |
| Power toggle | Any endpoint has power | No power capabilities |

---

## Deliverable 7: Offline and Degraded Mode Policy

### WebSocket Unavailable

| Scenario | Behavior | UI Indication |
|----------|----------|---------------|
| WS connection lost | No real-time updates | "Connection lost" banner |
| WS reconnects | State refresh triggered | Banner clears, state updates |
| WS unavailable for >30s | Polling fallback (optional) | "Reconnecting..." |

**Allowed Actions**: View cached state, queue routing requests
**Blocked Actions**: None (requests queued)

### Device Temporarily Offline

| Policy | Behavior | Use Case |
|--------|----------|----------|
| SKIP | Skip offline device, continue | Default for most routings |
| FAIL | Abort if critical device offline | Strict mode for reliability |
| WAIT | Wait up to 10s for device | Wake-on-LAN scenarios |

**UI Behavior**:
- Show offline device indicator
- Show which endpoints are unavailable
- Allow routing activation (with SKIP policy warning)

### Capability Changes Mid-Routing

| Scenario | Behavior | UI Impact |
|----------|----------|-----------|
| Device goes offline during routing | Routing remains "active", controls disabled | Greyed-out controls + warning |
| Device comes online | Controls become available | Warning clears |
| Device removed from space | Endpoints cascade-deleted | Routing references cleared |
| New capability discovered | Endpoint capabilities updated | New controls appear |

### Strict Mode Behaviors

The Media domain enforces strict rules for reliability:

1. **No Optimistic Updates**: UI shows confirmed state only
2. **No Silent Retries**: User must explicitly retry failed actions
3. **No Background Changes**: Routing only changes on user request
4. **No Capability Guessing**: If capability missing, control hidden

### Degraded Mode Communication

```typescript
interface MediaDegradedModeState {
  wsConnected: boolean;           // WebSocket connection status
  offlineEndpointIds: string[];   // Endpoints with offline devices
  lastSyncAt: Date;               // Last successful state sync
  degradedReason?: string;        // Human-readable explanation
}
```

---

## Readiness Checklist (Gate to Full Implementation)

### Contracts and Strategy

- [x] **Endpoint ID strategy approved**: Persisted registry with UUID
- [x] **Capability contracts finalized**: Per-device-category contracts documented
- [x] **Routing semantics documented**: User-facing expectations defined
- [x] **Failure model agreed**: Critical vs non-critical steps defined

### Technical Readiness

- [x] **API payloads frozen**: Request/response models documented
- [x] **WS payloads frozen**: Event types and payloads defined
- [x] **Default routings defined**: WATCH, LISTEN, OFF auto-created
- [x] **Offline policies defined**: SKIP, FAIL, WAIT policies implemented

### Implementation Complete

- [x] **Entities created**: Endpoint, Routing, ActiveRouting
- [x] **Services implemented**: EndpointService, RoutingService
- [x] **API endpoints deployed**: CRUD + activate/deactivate
- [x] **WebSocket events emitting**: routing.activating/activated/failed/deactivated

### Documentation

- [x] **Invariants documented**: All rules explicitly stated
- [x] **UI-backend contract defined**: Responsibilities split documented
- [x] **Degraded mode policy documented**: Offline/reconnect behavior defined

---

## References

- Original design: `docs/features/media-domain-backend-refactor.md`
- Architecture overview: `.ai-rules/MEDIA_ARCHITECTURE.md`
- Constants and types: `apps/backend/src/modules/spaces/spaces.constants.ts`
- Routing service: `apps/backend/src/modules/spaces/services/space-media-routing.service.ts`
- Endpoint service: `apps/backend/src/modules/spaces/services/space-media-endpoint.service.ts`
