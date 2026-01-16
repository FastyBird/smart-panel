# Task: Add activity-based room modes
ID: FEATURE-SPACE-ACTIVITY-MODES
Type: feature
Scope: backend, admin, panel
Size: large
Parent: EPIC-EXPAND-SMART-PANEL-DOMAINS
Status: planned

## 1. Business goal

In order to control my entire room with a single tap,
As a smart home user,
I want to activate activity-based modes (Work, Relax, Sleep, etc.) that automatically orchestrate lighting, climate, covers, media, and security for the selected activity.

## 2. Context

### Related Tasks (NOT Overlapping - Different Scopes)
- **`FEATURE-HOUSE-MODES-MVP-V2`** (done) - **House-wide** modes (Home/Away/Night) that affect the ENTIRE house from entry panels. This task is about **space-level** activity modes (Work/Relax/Sleep) that affect a SINGLE room.
- **`EPIC-SCENES-MVP`** (done) - Room-scoped scenes with arbitrary device commands. Activity modes are higher-level abstractions with sensible defaults.

### Existing Code References
- **House modes**: `apps/backend/src/modules/system/` (HOME, AWAY, NIGHT)
- **Lighting modes**: WORK, RELAX, NIGHT (lighting domain only)
- **Scenes**: `apps/backend/src/modules/scenes/` (arbitrary device commands)
- **Space intents**: `apps/backend/src/modules/spaces/services/`

### Concept Differentiation (Key Distinction)
| Concept | Scope | Orchestration | Customization |
|---------|-------|---------------|---------------|
| **House Modes** | House-wide | All spaces | Fixed actions |
| **Activity Modes** | Per-space | All domains | Configurable per space |
| **Scenes** | Per-space | Specific devices | Fully custom |

Activity modes sit between house modes (too broad) and scenes (too specific), providing sensible defaults that users can customize.

### Proposed Activity Modes
| Mode | Primary Use Case | Typical Settings |
|------|------------------|------------------|
| **Work** | Home office | Bright lights, cool temp, covers anti-glare, media off |
| **Relax** | Unwinding | Dim ambient, warm temp, covers open, background music |
| **Sleep** | Bedtime | Lights off, cool temp, blackout covers, media off |
| **Entertainment** | Movies/TV | Accent lights, comfortable temp, blackout, focused audio |
| **Cooking** | Kitchen use | Bright task lights, cool temp, covers open, background music |
| **Gaming** | Gaming session | Accent lights, cool temp, blackout, gaming audio |
| **Reading** | Reading time | Task lights, comfortable temp, natural light, quiet |
| **Conversation** | Social | Ambient lights, comfortable temp, open, media off |
| **Away** | Leaving room | All off, setback temp, covers as-is, media off |
| **Custom** | User-defined | Fully configurable |

## 3. Scope

**In scope**

Backend:
- Create `SpaceModesModule` or extend `SpacesModule`
- Define `ActivityMode` enum with preset modes
- Create `SpaceModeEntity` for storing active mode per space
- Create `SpaceModeConfigEntity` for per-space mode customization
- Create `SpaceModeService` for mode orchestration:
  - `getAvailableModes(spaceId)` - list modes applicable to space
  - `activateMode(spaceId, modeId)` - execute mode
  - `getActiveMode(spaceId)` - get current mode
  - `deactivateMode(spaceId)` - return to manual control
- Define default mode configurations (what each mode does)
- Expose REST endpoints for mode operations

Admin:
- View available modes for a space
- Customize mode behavior per space (which domains, what values)
- Enable/disable specific modes per space

Panel:
- Display available modes as quick action buttons
- Show currently active mode indicator
- One-tap mode activation

**Out of scope**
- Automatic mode triggers (time, occupancy) - separate task
- Cross-space mode propagation
- Mode history/logging
- AI-suggested modes

## 4. Acceptance criteria

- [ ] `ActivityMode` enum exists with at least: WORK, RELAX, SLEEP, ENTERTAINMENT, AWAY
- [ ] Each mode has a default configuration specifying per-domain intents
- [ ] `SpaceModeService.activateMode()` executes appropriate intents for all domains
- [ ] Mode activation returns aggregated results from all domain intents
- [ ] Active mode is persisted per space
- [ ] Admin can customize mode behavior per space
- [ ] Admin can enable/disable modes per space
- [ ] Panel shows available modes and allows one-tap activation
- [ ] Panel shows active mode indicator
- [ ] Modes only affect domains that have devices in the space
- [ ] Unit tests cover:
  - [ ] Mode activation with all domains present
  - [ ] Mode activation with partial domains (e.g., no media)
  - [ ] Mode customization override
  - [ ] Partial failure handling (some domains fail)

## 5. Example scenarios

### Scenario: Activate Work mode in home office

Given Space "Office" has:
  - 2 lights (MAIN, TASK)
  - 1 thermostat
  - 1 window covering
  - No media devices
When the user taps "Work" mode
Then:
  - Lighting: WORK mode (100% MAIN and TASK)
  - Climate: setpoint 21°C
  - Covers: anti-glare position (75%)
  - Media: skipped (no devices)
And panel shows "Work" mode active
And mode is persisted as active

### Scenario: Customized Relax mode

Given Space "Living Room" has customized Relax mode:
  - Lighting: 40% (instead of default 50%)
  - Climate: 23°C (instead of default 22°C)
When the user taps "Relax" mode
Then custom values are applied instead of defaults

### Scenario: Partial domain failure

Given Space "Bedroom" is in Work mode
When mode activation fails for climate (device offline)
Then lighting and covers still apply successfully
And mode activation returns partial success
And panel shows "Work" mode with warning indicator

## 6. Technical constraints

- Follow existing module/service patterns
- Mode orchestration should use existing domain intent services
- Each domain intent should be executed independently (partial success)
- Mode configuration should be stored in database (not hardcoded)
- Do not modify generated code
- Tests are expected for new logic
- Modes should be space-type aware (room modes vs zone modes)

## 7. Implementation hints

### Mode Configuration Structure
```typescript
interface ModeConfiguration {
  id: string;
  mode: ActivityMode;
  spaceId?: string; // null = default, set = space override

  lighting?: {
    enabled: boolean;
    mode?: LightingMode;
    brightness?: number;
  };

  climate?: {
    enabled: boolean;
    setpoint?: number;
    setpointDelta?: number;
    mode?: ClimateMode;
  };

  covers?: {
    enabled: boolean;
    mode?: CoversMode;
    position?: number;
  };

  media?: {
    enabled: boolean;
    mode?: MediaMode;
    volume?: number;
  };

  security?: {
    enabled: boolean;
    mode?: SecurityMode;
  };
}
```

### Default Mode Definitions
```typescript
const DEFAULT_MODES: Record<ActivityMode, ModeConfiguration> = {
  [ActivityMode.WORK]: {
    lighting: { enabled: true, mode: LightingMode.WORK },
    climate: { enabled: true, setpoint: 21 },
    covers: { enabled: true, position: 75 }, // anti-glare
    media: { enabled: true, mode: MediaMode.OFF },
    security: { enabled: false },
  },
  [ActivityMode.RELAX]: {
    lighting: { enabled: true, mode: LightingMode.RELAX },
    climate: { enabled: true, setpoint: 22 },
    covers: { enabled: true, mode: CoversMode.OPEN },
    media: { enabled: true, mode: MediaMode.BACKGROUND },
    security: { enabled: false },
  },
  [ActivityMode.SLEEP]: {
    lighting: { enabled: true, mode: LightingMode.NIGHT, brightness: 0 },
    climate: { enabled: true, setpoint: 18 },
    covers: { enabled: true, mode: CoversMode.CLOSED },
    media: { enabled: true, mode: MediaMode.OFF },
    security: { enabled: false },
  },
  // ... more modes
};
```

### Orchestration Flow
```typescript
async activateMode(spaceId: string, mode: ActivityMode): Promise<ModeResult> {
  const config = await this.getModeConfig(spaceId, mode);
  const results: DomainResult[] = [];

  // Execute each domain in parallel
  const promises = [];

  if (config.lighting?.enabled) {
    promises.push(this.executeLighting(spaceId, config.lighting));
  }
  if (config.climate?.enabled) {
    promises.push(this.executeClimate(spaceId, config.climate));
  }
  if (config.covers?.enabled) {
    promises.push(this.executeCovers(spaceId, config.covers));
  }
  if (config.media?.enabled) {
    promises.push(this.executeMedia(spaceId, config.media));
  }
  if (config.security?.enabled) {
    promises.push(this.executeSecurity(spaceId, config.security));
  }

  const domainResults = await Promise.allSettled(promises);

  // Update active mode
  await this.setActiveMode(spaceId, mode);

  return this.aggregateResults(domainResults);
}
```

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- This task depends on the domain tasks (covers, media, security) - implement those first or stub them.
- Follow existing module/service patterns in the codebase.
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
