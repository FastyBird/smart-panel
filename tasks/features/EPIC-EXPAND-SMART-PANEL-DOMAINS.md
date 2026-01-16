# Epic: Expand Smart Panel Domains and Unified Room Modes
ID: EPIC-EXPAND-SMART-PANEL-DOMAINS
Type: feature
Scope: backend, admin, panel
Size: large
Parent: (none)
Status: planned

## 1. Business goal

In order to transform the Smart Panel from a "device controller" into a "lifestyle controller",
As a smart home user,
I want to control my home through simple activity-based modes (Work, Relax, Sleep, etc.) that orchestrate all domains (lighting, climate, covers, media, security) simultaneously with a single tap.

## 2. Context

### Current State
- **Lighting domain**: Fully implemented with roles (MAIN, TASK, AMBIENT, ACCENT, NIGHT) and modes (WORK, RELAX, NIGHT)
- **Climate domain**: Fully implemented with roles (HEATING_ONLY, COOLING_ONLY, AUTO, AUXILIARY, SENSOR) and modes (HEAT, COOL, AUTO, OFF)
- **Covers domain**: Device spec exists, device page exists, but NO space-level intents
- **Media domain**: Device spec exists, but NO space-level intents
- **Security domain**: Device spec exists, but NO space-level intents
- **House modes**: Basic implementation (HOME, AWAY, NIGHT) exists but only affects lighting

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
- [ ] Covers domain has space-level intents (open, close, set_position, role_position)
- [ ] Media domain has space-level intents (power_on, power_off, volume_set, mute)
- [ ] Security domain has space-level intents (lock_all, unlock_all, arm, disarm)
- [ ] Each new domain follows the existing role-based architecture

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

- Follow the existing domain pattern in `apps/backend/src/modules/spaces/`
- Reuse `SpaceIntentService` facade pattern for new domains
- Use YAML-based spec definitions for intents (like lighting/climate)
- Do not introduce new dependencies unless really needed
- Do not modify generated code
- Tests are expected for new business logic
- Keep house-wide modes separate from space-level modes

## 7. Implementation hints

### Domain Architecture Pattern
Each new domain should follow the existing pattern:
1. Add constants in `spaces.constants.ts` (roles, modes, intent types)
2. Create `Space*RoleEntity` for role mapping
3. Create `*IntentService` extending `SpaceIntentBaseService`
4. Create DTOs with validation
5. Create YAML spec definitions
6. Update `SpaceIntentService` facade
7. Add to `SpacesResponseModel` for read models

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

### Phase 1: Domain Completion
| ID | Task | Size | Status |
|----|------|------|--------|
| FEATURE-SPACE-COVERS-DOMAIN | Add covers domain intents for spaces | medium | planned |
| FEATURE-SPACE-MEDIA-DOMAIN | Add media domain intents for spaces | medium | planned |
| FEATURE-SPACE-SECURITY-DOMAIN | Add security domain intents for spaces | medium | planned |

### Phase 2: Unified Room Modes
| ID | Task | Size | Status |
|----|------|------|--------|
| FEATURE-SPACE-ACTIVITY-MODES | Add activity-based room modes | large | planned |
| FEATURE-SPACE-MODE-ADMIN-UI | Admin UI for configuring space modes | medium | planned |
| FEATURE-SPACE-MODE-PANEL-UI | Panel UI for activating space modes | medium | planned |

### Phase 3: Automation Triggers
| ID | Task | Size | Status |
|----|------|------|--------|
| FEATURE-SPACE-TIME-SCHEDULING | Time-based mode scheduling | medium | planned |
| FEATURE-SPACE-OCCUPANCY-MODES | Occupancy-based mode triggers | medium | planned |
| FEATURE-SPACE-SEASONAL-DEFAULTS | Seasonal baseline adjustments | small | planned |
