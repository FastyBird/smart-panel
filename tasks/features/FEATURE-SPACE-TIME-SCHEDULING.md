# Task: Time-based mode scheduling
ID: FEATURE-SPACE-TIME-SCHEDULING
Type: feature
Scope: backend, admin, panel
Size: medium
Parent: EPIC-EXPAND-SMART-PANEL-DOMAINS
Status: planned

## 1. Business goal

In order to have my rooms automatically adjust throughout the day,
As a smart home user,
I want to schedule activity modes to activate at specific times without manual intervention.

## 2. Context

### Existing Code References
- **Space modes**: `FEATURE-SPACE-ACTIVITY-MODES` (dependency)
- **House modes**: Has basic activation but no scheduling
- **Scenes**: No scheduling capability yet

### Common Time-Based Patterns
| Time | Mode | Typical Rooms |
|------|------|---------------|
| 06:00-08:00 | Morning | Bedroom, Kitchen |
| 08:00-17:00 | Work | Office |
| 17:00-20:00 | Relax | Living Room |
| 20:00-22:00 | Entertainment | Living Room |
| 22:00-06:00 | Sleep | Bedroom |

### Schedule Types
1. **Daily** - Same time every day
2. **Weekday/Weekend** - Different schedules
3. **Day-specific** - Individual day configuration
4. **Sunrise/Sunset** - Relative to sun position (future)

## 3. Scope

**In scope**

Backend:
- Create `SpaceModeScheduleEntity` for storing schedules
- Create `SpaceModeSchedulerService` for:
  - Managing schedules (CRUD)
  - Triggering modes at scheduled times
  - Handling timezone and DST
- Background job/cron for checking schedules
- REST endpoints for schedule management

Admin:
- Schedule configuration UI per space
- Weekly schedule view/editor
- Enable/disable scheduling per space

Panel:
- Show next scheduled mode (optional, informational)
- Manual override indicator when schedule is overridden

**Out of scope**
- Sunrise/sunset relative scheduling (requires location/weather)
- Holiday/vacation schedules
- Complex conditions (if temperature > X, then...)
- Integration with calendar services

## 4. Acceptance criteria

- [ ] Schedules can be created per space with time and mode
- [ ] Schedules support daily, weekday, weekend, and per-day patterns
- [ ] Scheduler checks and triggers modes at scheduled times
- [ ] Manual mode activation overrides schedule until next trigger
- [ ] Admin can view and edit schedules in weekly format
- [ ] Admin can enable/disable scheduling per space
- [ ] Panel shows current/next scheduled mode (informational)
- [ ] Scheduler handles timezone correctly
- [ ] Unit tests cover:
  - [ ] Schedule creation and validation
  - [ ] Trigger time calculation
  - [ ] Manual override behavior
  - [ ] Timezone edge cases

## 5. Example scenarios

### Scenario: Daily Work mode in Office

Given Space "Office" has schedule:
  - Mon-Fri 08:00: Work mode
  - Mon-Fri 18:00: Away mode
When time reaches 08:00 on Monday
Then Work mode is automatically activated
And panel shows "Work" as active

### Scenario: Manual override

Given Space "Office" is scheduled for Work mode at 08:00
And user manually activates Relax mode at 10:00
Then Relax mode remains active
Until 18:00 when Away mode triggers (next schedule)

### Scenario: Weekend different schedule

Given Space "Living Room" has schedule:
  - Weekdays 18:00: Relax mode
  - Weekends 10:00: Relax mode
When Saturday 10:00 arrives
Then Relax mode activates

## 6. Technical constraints

- Use existing job/cron patterns in the backend
- Store schedules in database with proper indexes
- Handle timezone per user/system setting
- Keep scheduler lightweight (check every minute max)
- Do not modify generated code
- Tests are expected for new logic

## 7. Implementation hints

### Schedule Entity
```typescript
@Entity()
export class SpaceModeScheduleEntity extends BaseEntity {
  @ManyToOne(() => SpaceEntity)
  space: SpaceEntity;

  @Column({ type: 'enum', enum: ActivityMode })
  mode: ActivityMode;

  @Column({ type: 'time' })
  time: string; // HH:MM format

  @Column({ type: 'simple-array' })
  daysOfWeek: number[]; // 0=Sun, 1=Mon, ..., 6=Sat

  @Column({ default: true })
  enabled: boolean;

  @Column({ type: 'varchar', nullable: true })
  timezone?: string; // Override system timezone
}
```

### Scheduler Service
```typescript
@Injectable()
export class SpaceModeSchedulerService {
  // Run every minute via @Cron('* * * * *')
  async checkSchedules(): Promise<void> {
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = format(now, 'HH:mm');

    const dueSchedules = await this.findDueSchedules(currentDay, currentTime);

    for (const schedule of dueSchedules) {
      if (!this.isOverridden(schedule.space.id)) {
        await this.spaceModeService.activateMode(
          schedule.space.id,
          schedule.mode
        );
      }
    }
  }

  private isOverridden(spaceId: string): boolean {
    // Check if manual override is active
    // Override expires at next scheduled trigger
  }
}
```

### API Endpoints
```
GET    /api/v1/spaces/{spaceId}/schedules
POST   /api/v1/spaces/{spaceId}/schedules
PATCH  /api/v1/spaces/{spaceId}/schedules/{scheduleId}
DELETE /api/v1/spaces/{spaceId}/schedules/{scheduleId}
```

### Weekly Schedule View (Admin)
```
         Mon    Tue    Wed    Thu    Fri    Sat    Sun
06:00    -      -      -      -      -      -      -
08:00    Work   Work   Work   Work   Work   -      -
10:00    -      -      -      -      -      Relax  Relax
18:00    Relax  Relax  Relax  Relax  Relax  -      -
22:00    Sleep  Sleep  Sleep  Sleep  Sleep  Sleep  Sleep
```

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- This task depends on `FEATURE-SPACE-ACTIVITY-MODES`.
- Follow existing cron/scheduler patterns in the codebase.
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
