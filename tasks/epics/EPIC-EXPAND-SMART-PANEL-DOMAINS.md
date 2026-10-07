# Epic: Expand Smart Panel Domains and Unified Room Modes
ID: EPIC-EXPAND-SMART-PANEL-DOMAINS
Type: feature
Scope: backend, admin, panel
Size: large
Parent: (none)
Status: in-progress
Tracking: #1287

## 1. Business goal

In order to transform the Smart Panel from a "device controller" into a "lifestyle controller",
As a smart home user,
I want to control my home through simple activity-based modes (Work, Relax, Sleep, etc.) that orchestrate all domains (lighting, climate, covers, media, security) simultaneously with a single tap.

## 2. Context

### Current State
- **Lighting domain**: Fully implemented with roles (MAIN, TASK, AMBIENT, ACCENT, NIGHT) and modes (WORK, RELAX, NIGHT)
- **Climate domain**: Fully implemented with roles (HEATING_ONLY, COOLING_ONLY, AUTO, AUXILIARY, SENSOR) and modes (HEAT, COOL, AUTO, OFF)
- **Covers domain**: Fully implemented with space-level intents (done)
- **Media domain**: Fully implemented with space-level intents (done)
- **Security domain**: Device spec exists, but NO space-level roles or intents (the house-level `security` module with alerts and providers exists, the space-level domain does not)
- **House modes**: Basic implementation (HOME, AWAY, NIGHT) exists but only affects lighting
- **Space domain code** lives in the `spaces-home-control` plugin (Spaces refactor, PRs #578-#592): backend `apps/backend/src/plugins/spaces-home-control/`, admin `apps/admin/src/plugins/spaces-home-control/`, panel `apps/panel/lib/plugins/spaces-home-control/`
- **Not present yet**: activity modes, scheduling, seasonal adjustments, occupancy state machine. `SpaceActivityService` (#1143) is only a last-activity timestamp and is unrelated to activity modes. `space-sensor-state.service.ts` already aggregates motionDetected/occupancyDetected (input level only)

### Vision
The smart panel should act as a bridge between users and their smart devices. Instead of configuring complex automation rules in multiple apps, users should:
1. Assign devices to spaces (rooms/zones)
2. Assign roles to devices within each domain
3. Select activity modes that orchestrate all domains automatically

### Related Tasks
- `FEATURE-HOUSE-MODES-MVP` (done) - Basic house modes
- `FEATURE-HOUSE-MODES-MVP-V2` (done) - House modes with deterministic actions
- `FEATURE-SPACE-CLIMATE-MVP` (done) - Climate intents for spaces
- `FEATURE-SPACE-INTENTS-LIGHTING-MVP` (done) - Lighting intents for spaces
- `FEATURE-WINDOW-COVERING-DEVICE-PAGE` (done) - Covers device control
- `EPIC-SCENES-MVP` (done) - Room-scoped scenes

## 3. Scope

**In scope**

### Phase 1: Complete Domain Coverage
- **Covers domain intents** - Space-level control of window coverings
- **Media domain intents** - Space-level control of TVs, speakers, media players
- **Security domain intents** - Space-level control of locks, alarms (basic)

### Phase 2: Unified Room Modes
- **Activity modes** - Work, Relax, Sleep, Entertainment, Cooking, etc.
- **Mode orchestration** - Single mode triggers multiple domain intents
- **Mode configuration** - Admin can customize what each mode does per space

### Phase 3: Automation Triggers
- **Time-based modes** - Automatic mode changes based on time of day
- **Occupancy modes** - Occupied/Vacant detection and response
- **Seasonal adjustments** - Weather-aware baseline settings

**Out of scope**
- Complex automation rules engine (use scenes for custom sequences)
- Voice assistant integration (separate epic)
- Geofencing/phone-based presence (requires mobile app)
- Learning/AI-based predictions (future enhancement)
- Multi-backend coordination (Redis, etc.)

## 4. Acceptance criteria

### Domain Completion
- [x] Covers domain has space-level intents (open, close, set_position, role_position)
- [x] Media domain has space-level intents (power_on, power_off, volume_set, mute)
- [ ] Security domain has space-level intents (lock_all, unlock_all, arm, disarm)
- [x] Each new domain follows the existing role-based architecture

### Unified Modes
- [ ] Activity modes can be defined and assigned to spaces
- [ ] Activating a mode triggers appropriate intents across all domains
- [ ] Modes are configurable per space (admin can customize domain behavior)
- [ ] Panel shows available modes as quick actions on space pages

### Triggers
- [ ] Time-based mode scheduling can be configured per space
- [ ] Occupancy sensors can trigger Occupied/Vacant mode changes
- [ ] Manual mode override is always available and takes priority

## 5. Example scenarios

### Scenario: Activate "Movie" mode in Living Room

Given Space "Living Room" has:
  - 4 lights with roles (MAIN, TASK, AMBIENT x2)
  - 1 thermostat
  - 2 window coverings (PRIVACY, BLACKOUT)
  - 1 TV (PRIMARY)
  - 2 speakers (PRIMARY, BACKGROUND)
When the user taps "Movie" mode on the panel
Then:
  - Lighting: AMBIENT at 30%, MAIN/TASK off
  - Climate: setpoint 22°C
  - Covers: BLACKOUT closed, PRIVACY open
  - Media: TV on, PRIMARY speaker at 50%, BACKGROUND muted
And the mode indicator shows "Movie" is active

### Scenario: Automatic Night mode at 22:00

Given Space "Bedroom" has time-based scheduling enabled
And Night mode is scheduled for 22:00
When the time reaches 22:00
Then Night mode is automatically activated
And the user can still manually override

### Scenario: Room becomes vacant

Given Space "Office" has occupancy detection enabled
And no motion detected for 15 minutes
When the Vacant mode triggers
Then:
  - Lighting: OFF
  - Climate: setpoint -2°C (setback)
  - Media: OFF
And the mode reverts when motion is detected again

## 6. Technical constraints

- Follow the existing domain pattern in `apps/backend/src/plugins/spaces-home-control/`
- Reuse `SpaceIntentService` facade pattern (`services/space-intent.service.ts`) for new domains
- Use YAML-based spec definitions for intents in `spec/definitions/` (like lighting/climate)
- New role types go into the unified `SpaceRoleEntity` hierarchy via an incremental migration
- Do not introduce new dependencies unless really needed
- Do not modify generated code
- Tests are expected for new business logic
- Keep house-wide modes separate from space-level modes

## 7. Implementation hints

### Domain Architecture Pattern
Each new domain should follow the existing pattern:
1. Add constants (roles, modes, intent types) to the `spaces-home-control` plugin constants
2. Add a `Space*RoleEntity` as a new discriminator of the unified `SpaceRoleEntity` hierarchy (existing: lighting, climate, covers, sensor, media_binding, active_media) with an incremental migration
3. Create `*IntentService` extending `SpaceIntentBaseService` in `services/`
4. Create DTOs with validation
5. Create YAML spec definitions in `spec/definitions/`
6. Update `SpaceIntentService` facade
7. Add to the plugin's response models for read models

### Mode Orchestration Pattern
```
SpaceModeService
  ├── getAvailableModes(spaceId) -> Mode[]
  ├── activateMode(spaceId, modeId)
  │   ├── Resolve mode definition
  │   ├── For each domain in mode:
  │   │   └── spaceIntentService.execute*Intent()
  │   └── Return aggregated results
  └── getActiveMode(spaceId) -> Mode | null
```

### Priority Stack for Modes
1. Emergency (highest)
2. Manual override
3. Occupancy-based
4. Activity-based (user selected)
5. Time-based (scheduled)
6. Seasonal defaults (baseline)

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start with Phase 1 tasks (domain completion) as they are prerequisites for Phase 2.
- Each subtask should be completable independently.
- Follow the existing patterns established in lighting and climate domains.
- Keep changes scoped to the specific task and its `Scope`.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.

## 9. Subtasks

Tracking: epic #1287.

### Phase 1: Domain Completion
Security domain = #1288 to #1291.

| ID | Task | Size | Status |
|----|------|------|--------|
| FEATURE-SPACE-COVERS-DOMAIN | Add covers domain intents for spaces | medium | done |
| FEATURE-SPACE-MEDIA-DOMAIN | Add media domain intents for spaces | medium | done |
| FEATURE-SPACE-SECURITY-DOMAIN | Add security domain intents for spaces (#1288 roles, #1289 intents, #1290 admin, #1291 panel) | medium | planned |

### Phase 2: Unified Room Modes
Phase 2 = #1292 to #1296.

| ID | Task | Size | Status |
|----|------|------|--------|
| FEATURE-SPACE-ACTIVITY-MODES | Add activity-based room modes (#1292 definitions and config, #1293 orchestration, #1294 activation endpoints and events) | large | planned |
| FEATURE-SPACE-MODE-ADMIN-UI | Admin UI for configuring space modes (#1295) | medium | planned |
| FEATURE-SPACE-MODE-PANEL-UI | Panel UI for activating space modes (#1296) | medium | planned |

### Phase 3: Automation Triggers
Phase 3 = #1297 to #1302. The UniFi epic (#1221) adds camera person detections as an additional occupancy input for FEATURE-SPACE-OCCUPANCY-MODES.

| ID | Task | Size | Status |
|----|------|------|--------|
| FEATURE-SPACE-TIME-SCHEDULING | Time-based mode scheduling (#1297 backend, #1298 admin schedule editor) | medium | planned |
| FEATURE-SPACE-OCCUPANCY-MODES | Occupancy-based mode triggers (#1299 state machine, #1300 admin config; input #1221) | medium | planned |
| FEATURE-SPACE-SEASONAL-DEFAULTS | Seasonal baseline adjustments (#1301 backend, #1302 admin) | small | planned |
