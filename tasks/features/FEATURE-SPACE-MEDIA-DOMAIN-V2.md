# Task: Redesign Media Domain – Data-Driven, Activity-First Architecture
ID: FEATURE-SPACE-MEDIA-DOMAIN-V2
Type: feature
Scope: backend, admin, panel
Size: large
Parent: EPIC-EXPAND-SMART-PANEL-DOMAINS
Status: in-progress

## 1. Business goal

In order to control entertainment devices with an intuitive, activity-first experience,
As a smart home user,
I want to select activities like "Watch", "Listen", or "Gaming" and have the system configure all devices automatically.

## 2. Context

### Current State
- The existing media domain uses **role-based** assignment (PRIMARY, SECONDARY, BACKGROUND, GAMING, HIDDEN)
- Roles are deprecated and will be replaced with a more flexible **endpoint/routing** architecture
- Other domains (lighting, coverings) use domain-level intents, media will follow with routing activation

### Key Design Decisions
1. **Roles are deprecated** - No more PRIMARY/SECONDARY/BACKGROUND/GAMING roles
2. **Endpoints** are functional projections of devices (display, audio_output, source, remote_target)
3. **Routings** are activity presets that define which endpoints work together
4. **Domain-level intent** activates a routing, not individual devices

### Reference Implementation
- Lighting domain: `apps/backend/src/modules/spaces/services/lighting-intent.service.ts`
- Covers domain: `apps/backend/src/modules/spaces/services/covers-intent.service.ts`
- Device/Channel/Property model: `apps/backend/src/modules/devices/`

## 3. Scope

**In scope**

Backend:
- Replace `SpaceMediaRoleEntity` with `SpaceMediaEndpointEntity`
- Add `SpaceMediaRoutingEntity` for activity presets
- Create `MediaCapabilitySummaryModel` (read model from device properties)
- Create `MediaExecutionPlanModel` for routing activation
- New endpoint types: `display`, `audio_output`, `source`, `remote_target`
- New routing presets: Watch, Listen, Gaming, Background, Off, Custom
- Domain-level intent: `media.routing.activate(routingId)`
- Device-scoped controls derived from active routing

Admin:
- Media endpoint configuration UI (replacing role assignment)
- Media routing configuration UI

Panel:
- Activity-first media domain screen
- Activity selector (Watch / Listen / Gaming / Off)
- Active routing card with relevant controls

**Out of scope**
- Queue/playlist support (future capability)
- Multiroom audio synchronization (future)
- Streaming source selection (future)

## 4. Acceptance criteria

- [x] `MediaEndpointType` enum exists: DISPLAY, AUDIO_OUTPUT, SOURCE, REMOTE_TARGET
- [x] `MediaRoutingType` enum exists: WATCH, LISTEN, GAMING, BACKGROUND, OFF, CUSTOM
- [x] `SpaceMediaEndpointEntity` replaces `SpaceMediaRoleEntity`
- [x] `SpaceMediaRoutingEntity` defines activity presets with endpoint slots
- [x] `MediaCapabilitySummaryModel` derives capabilities from device properties
- [x] Backend can activate/deactivate media routings
- [x] Execution plan builds ordered steps for routing activation
- [ ] Admin can configure media endpoints (API implemented)
- [ ] Admin can configure media routings (API implemented)
- [ ] Panel shows activity-first media UI (panel scope)
- [x] Unit tests cover:
  - [x] Endpoint capability detection
  - [x] Routing activation execution
  - [x] Execution plan generation

## 5. Example scenarios

### Scenario: Activate Watch routing

Given Space "Living Room" has a TV (display), AVR (audio_output), and Apple TV (source)
And a "Watch" routing is configured with these endpoints
When the user activates the "Watch" routing
Then the TV powers on and switches to HDMI input
And the AVR powers on, sets volume to 50%, selects optical input
And the Apple TV powers on
And panel shows "Watch" as active routing

### Scenario: Deactivate routing (Off)

Given Space "Living Room" has an active "Watch" routing
When the user activates the "Off" routing
Then all endpoints in the previous routing power off
And panel shows "Off" as active state

### Scenario: Volume control while routing active

Given Space "Living Room" has "Watch" routing active with AVR as audio_output
When the user adjusts volume
Then only the AVR (audio_output endpoint) receives volume command
And the TV volume is not affected

## 6. Technical constraints

- Follow existing entity patterns from lighting/covers domains
- Use `SpaceIntentBaseService` for value extraction and clamping
- Reuse `PlatformRegistryService` for command dispatch
- Do not modify generated code
- Tests expected for new logic
- Support graceful degradation for offline devices

## 7. Implementation hints

### New Entities

```typescript
// SpaceMediaEndpointEntity
@Entity('spaces_module_media_endpoints')
export class SpaceMediaEndpointEntity extends BaseEntity {
  spaceId: string;
  deviceId: string;
  channelId: string | null;
  type: MediaEndpointType; // display, audio_output, source, remote_target
  name: string | null;
  capabilities: string; // JSON: { power: true, volume: true, mute: true, input: true }
  preferredFor: string | null; // JSON array: ['watch', 'listen']
}

// SpaceMediaRoutingEntity
@Entity('spaces_module_media_routings')
export class SpaceMediaRoutingEntity extends BaseEntity {
  spaceId: string;
  type: MediaRoutingType; // watch, listen, gaming, background, off, custom
  name: string;
  icon: string | null;
  displayEndpointId: string | null;
  audioEndpointId: string | null;
  sourceEndpointId: string | null;
  remoteTargetEndpointId: string | null;
  displayInput: string | null; // Input to switch to on display
  audioInput: string | null; // Input to switch to on audio
  audioVolumePreset: number | null; // Default volume when activated
  powerPolicy: string; // 'on' | 'off' | 'unchanged'
  isDefault: boolean; // Auto-created routing
}
```

### Capability Mapping

| Device Property | Capability |
|-----------------|------------|
| television.on / switcher.on | power (RW) |
| speaker.volume / television.volume | volume (RW) |
| speaker.mute / television.mute | mute (RW) |
| media_playback.command | playback (W) |
| media_playback.state | playback_state (R) |
| television.source / media_input.source | input (RW) |
| television.remote_key | remote (W) |

### Execution Plan Structure

```typescript
interface MediaExecutionPlan {
  routingId: string;
  spaceId: string;
  steps: ExecutionStep[];
}

interface ExecutionStep {
  order: number;
  endpointId: string;
  deviceId: string;
  channelId: string;
  propertyId: string;
  action: 'set_property' | 'send_command';
  value: unknown;
  critical: boolean; // If false, failure doesn't abort plan
}
```

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Follow existing entity patterns in the spaces module.
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
- Do NOT delete the old role-based entities yet - they will be migrated in a separate task.
