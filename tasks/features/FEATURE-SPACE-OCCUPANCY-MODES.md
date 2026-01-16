# Task: Occupancy-based mode triggers
ID: FEATURE-SPACE-OCCUPANCY-MODES
Type: feature
Scope: backend, admin, panel
Size: medium
Parent: EPIC-EXPAND-SMART-PANEL-DOMAINS
Status: planned

## 1. Business goal

In order to have my rooms respond to my presence,
As a smart home user,
I want rooms to automatically adjust when I enter or leave, saving energy when vacant and providing comfort when occupied.

## 2. Context

### Existing Code References
- **Space modes**: `FEATURE-SPACE-ACTIVITY-MODES` (dependency)
- **Motion sensors**: Device spec includes motion detection
- **Climate sensors**: Already used in climate domain

### Occupancy Detection Methods
1. **Motion sensors** - Detect movement in space
2. **Door sensors** - Detect entry/exit
3. **Presence sensors** - mmWave, ultrasonic (more accurate)
4. **Camera-based** - Person detection (out of scope)

### Occupancy States
| State | Trigger | Typical Actions |
|-------|---------|-----------------|
| **Occupied** | Motion detected | Resume comfort mode |
| **Recently Occupied** | No motion for 5 min | Keep current mode |
| **Vacant** | No motion for 15 min | Energy saving mode |
| **Extended Vacant** | No motion for 1 hour | Deep setback |

## 3. Scope

**In scope**

Backend:
- Track occupancy state per space based on sensor data
- Create `SpaceOccupancyService` for:
  - Aggregating sensor data
  - Managing occupancy state machine
  - Triggering mode changes based on state
- Configure vacancy timeout per space
- Configure occupied/vacant modes per space

Admin:
- Enable/disable occupancy-based modes per space
- Configure vacancy timeout
- Select which sensors to use for occupancy
- Configure occupied/vacant mode mapping

Panel:
- Show occupancy status indicator
- Show when occupancy mode is active vs manual

**Out of scope**
- Person counting (how many people)
- Person identification (who is present)
- Cross-space tracking (following users between rooms)
- Geofencing (phone-based presence)

## 4. Acceptance criteria

- [ ] Occupancy state is tracked per space (Occupied/Vacant)
- [ ] Motion sensor events update occupancy state
- [ ] Configurable vacancy timeout (default 15 min)
- [ ] Vacant mode triggers after timeout expires
- [ ] Motion detection returns space to Occupied state
- [ ] Admin can enable/disable occupancy automation per space
- [ ] Admin can configure which mode to use for Occupied/Vacant
- [ ] Manual mode activation overrides occupancy automation
- [ ] Panel shows occupancy indicator
- [ ] Unit tests cover:
  - [ ] State transitions
  - [ ] Timeout behavior
  - [ ] Multiple sensors in space
  - [ ] Manual override behavior

## 5. Example scenarios

### Scenario: Room becomes vacant

Given Space "Office" has occupancy automation enabled
And vacancy timeout is 15 minutes
And Vacant mode is configured as "Away"
When no motion is detected for 15 minutes
Then space state changes to Vacant
And "Away" mode is activated
And lights turn off, climate setback applied

### Scenario: User returns to room

Given Space "Office" is in Vacant state
And "Away" mode is active
When motion is detected
Then space state changes to Occupied
And previous mode (before Vacant) is restored
Or configured Occupied mode is activated

### Scenario: Manual override

Given Space "Living Room" occupancy automation is enabled
When user manually activates "Entertainment" mode
Then occupancy automation is paused
And state changes but mode doesn't auto-switch
Until user deactivates manual override

### Scenario: Multiple sensors

Given Space "Living Room" has 2 motion sensors
When sensor 1 detects motion
Then space is Occupied
When sensor 1 stops detecting but sensor 2 detects
Then space remains Occupied
When both sensors stop detecting for 15 min
Then space becomes Vacant

## 6. Technical constraints

- Use existing sensor data streams (WebSocket events)
- Debounce motion events to avoid rapid state changes
- Persist occupancy state for dashboard display
- Handle sensor unavailability gracefully
- Do not modify generated code
- Tests are expected for new logic

## 7. Implementation hints

### Occupancy State Machine
```
               motion detected
         ┌─────────────────────────┐
         │                         │
         ▼                         │
    ┌─────────┐   timeout    ┌─────────┐
    │ Occupied│────────────▶│  Vacant │
    └─────────┘              └─────────┘
         ▲                         │
         │     motion detected     │
         └─────────────────────────┘
```

### Service Structure
```typescript
@Injectable()
export class SpaceOccupancyService {
  private readonly occupancyState = new Map<string, OccupancyState>();
  private readonly vacancyTimers = new Map<string, NodeJS.Timeout>();

  // Called when motion sensor event received
  async handleMotionEvent(deviceId: string, detected: boolean): Promise<void> {
    const spaceId = await this.getSpaceForDevice(deviceId);
    if (!spaceId) return;

    const config = await this.getOccupancyConfig(spaceId);
    if (!config.enabled) return;

    if (detected) {
      this.setOccupied(spaceId);
    } else {
      this.startVacancyTimer(spaceId, config.vacancyTimeoutMs);
    }
  }

  private setOccupied(spaceId: string): void {
    this.cancelVacancyTimer(spaceId);
    const previousState = this.occupancyState.get(spaceId);
    this.occupancyState.set(spaceId, OccupancyState.OCCUPIED);

    if (previousState === OccupancyState.VACANT) {
      this.triggerOccupiedMode(spaceId);
    }
  }

  private async triggerVacant(spaceId: string): Promise<void> {
    this.occupancyState.set(spaceId, OccupancyState.VACANT);
    const config = await this.getOccupancyConfig(spaceId);
    if (config.vacantMode) {
      await this.spaceModeService.activateMode(spaceId, config.vacantMode);
    }
  }
}
```

### Configuration Entity
```typescript
@Entity()
export class SpaceOccupancyConfigEntity extends BaseEntity {
  @OneToOne(() => SpaceEntity)
  @JoinColumn()
  space: SpaceEntity;

  @Column({ default: false })
  enabled: boolean;

  @Column({ default: 900000 }) // 15 minutes
  vacancyTimeoutMs: number;

  @Column({ type: 'enum', enum: ActivityMode, nullable: true })
  occupiedMode?: ActivityMode; // null = restore previous

  @Column({ type: 'enum', enum: ActivityMode, nullable: true })
  vacantMode?: ActivityMode; // null = no change
}
```

### Admin UI Configuration
```
┌─────────────────────────────────────────────┐
│ Occupancy Automation                   [ON] │
├─────────────────────────────────────────────┤
│ Vacancy timeout:        [15] minutes        │
│ When occupied:          [Restore previous ▼]│
│ When vacant:            [Away            ▼] │
│                                             │
│ Motion sensors:                             │
│ ☑ Living Room Motion                        │
│ ☑ Hallway Motion                            │
│ ☐ Kitchen Motion (excluded)                 │
└─────────────────────────────────────────────┘
```

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- This task depends on `FEATURE-SPACE-ACTIVITY-MODES`.
- Follow existing event handling patterns for sensor data.
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
