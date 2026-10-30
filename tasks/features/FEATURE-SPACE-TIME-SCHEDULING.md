# Task: Time-based mode scheduling

ID: FEATURE-SPACE-TIME-SCHEDULING
Type: feature
Scope: backend, admin, panel
Size: medium
Parent: EPIC-EXPAND-SMART-PANEL-DOMAINS
Status: done (software implementation; deployment and installed qualification are separate)
Tracking: #1287
Issues: #1297 (backend), #1298 (admin schedule editor), #1362 (panel current/next mode)

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

| Time        | Mode          | Typical Rooms    |
| ----------- | ------------- | ---------------- |
| 06:00-08:00 | Morning       | Bedroom, Kitchen |
| 08:00-17:00 | Work          | Office           |
| 17:00-20:00 | Relax         | Living Room      |
| 20:00-22:00 | Entertainment | Living Room      |
| 22:00-06:00 | Sleep         | Bedroom          |

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

- Show current/next scheduled mode (informational; tracked by #1362)
- Manual override indicator when schedule is overridden

**Out of scope**

- Sunrise/sunset relative scheduling (requires location/weather)
- Holiday/vacation schedules
- Complex conditions (if temperature > X, then...)
- Integration with calendar services

## 4. Acceptance criteria

- [x] Schedules can be created per space with time and mode
- [x] Schedules support daily, weekday, weekend, and per-day patterns
- [x] Scheduler checks and triggers modes at scheduled times
- [x] Manual mode activation overrides schedule until next trigger
- [x] Admin can view and edit schedules in weekly format
- [x] Admin can enable/disable scheduling per space
- [x] Panel shows current/next scheduled mode (informational)
- [x] Scheduler handles timezone correctly
- [x] Unit tests cover:
  - [x] Schedule creation and validation
  - [x] Trigger time calculation
  - [x] Manual override behavior
  - [x] Timezone edge cases

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

## Scheduling behavior

The shared scheduler activates existing activity modes; it does not create another thermostat scheduler or infer presets from mode names. Scheduling starts disabled with no entries. The Admin owns editing; Panel remains informational.

- Entries use local `HH:MM` and selected weekdays (Sunday=0). Daily, weekday and weekend presets are equivalent weekday selections. Each space may override the configured house IANA timezone.
- A missing DST wall time is skipped. An ambiguous wall time runs only at its first UTC instant, including non-hour DST transitions.
- Each current-minute occurrence is durably consumed before activation. Duplicate ticks, restart and backward clock movement cannot replay it. Configuration edits apply to future occurrences and do not reset the durable UTC watermark.
- Startup evaluates the current/next plan for display but never replays missed actions. An interrupted claimed occurrence remains interrupted. A backward clock withholds new automatic admission until the durable watermark is reached again.
- Manual activity selection or clearing takes precedence until the next future trigger. A delayed tick cannot overwrite a manual request admitted after the trigger's nominal time. Configuration revision, original activation identity and the scheduler lifetime are rechecked in the original native activity transaction through COMMIT.
- A conflict or unavailable/disabled mode consumes that occurrence without retry or an actuation backlog. Existing activity per-domain results and the independent thermostat override/OFF/protection policies retain their meaning.
- Current/next _planned_ mode is not proof of activation or device state. Reads expose availability, manual precedence and the last attempt separately. Deleting/type-changing a space removes its owned schedule atomically.

## 7. Implementation and verification

- Persistence: `SpaceModeScheduleEntity`, incremental migration `1000000000050-AddSpaceModeSchedules.ts`,
  and the existing space lifecycle registry. Runtime claim/watermark fields are excluded from API serialization.
- Configuration: `SpaceModeScheduleConfigService` and `SpaceModeSchedulesController`. Authenticated GET is read-only;
  owner/admin PUT replaces the complete configuration with `expected_revision`. Entry CRUD is atomic through this PUT.
- Runtime: managed `SpaceModeSchedulerService`, existing `cron` wall-minute job, and `SpaceModeService` native admission.
  Calendar calculations are in `schedule/schedule-time.ts`; the existing activity/climate bridge owns actual execution.
- Admin: `SpaceModeScheduleSection.vue` and `useSpaceModeSchedule.ts`. Editing is local until explicit save;
  stale revisions retain the draft without automatic retries/rebasing. Strings are localized in all six supported locales.
- Panel: `ModeScheduleRepository`, owned registry sessions and `ModeScheduleSection`, using the generated API schema.
  Authored local wall time and timezone are shown without converting them to the display's operating-system timezone.

Routes below `/api/v1/modules/spaces/spaces/{id}/schedules`:

```http
GET /
PUT /
GET /state
```

Example PUT body (adding, editing or removing entries uses the same full replacement):

```json
{
  "data": {
    "expected_revision": 1,
    "enabled": true,
    "timezone": "Europe/Prague",
    "entries": [
      {
        "id": "6b486b88-758d-4f8c-8cfb-71264b48ed30",
        "mode": "work",
        "time": "08:00",
        "days_of_week": [1, 2, 3, 4, 5],
        "enabled": true
      }
    ]
  }
}
```

Verification sources:

| Boundary                                                                                       | Tests                                                                 |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Weekdays, midnight, DST gap/fold and half-hour transitions                                     | `schedule/schedule-time.spec.ts`                                      |
| Native occurrence deduplication, manual selection/clear, expiry, restart, disable/delete/stop  | `space-mode-scheduler.integration.spec.ts`                            |
| Existing-installation upgrade, disabled backfill, durable reopen and cascade                   | `migrations/__tests__/1000000000050-AddSpaceModeSchedules.spec.ts`    |
| Authenticated API, validation, CAS and composed explicit climate preset/manual hold            | `test/space-climate-automation.e2e-spec.ts`                           |
| Mounted weekly editing, six locales, stale saves, space rebinding and read-only roles          | `space-mode-schedule-section.spec.ts`, `view-space-configure.spec.ts` |
| Read-only planned state, transitions, unavailable state, retained sessions and polling cleanup | `test/plugins/spaces-home-control/mode_schedule_test.dart`            |

See [activity-mode execution and scheduling](../../docs/space-activity-modes.md#time-schedules) for the runtime contract.
Scheduling completes the time-based part of #1458; presence/occupancy and its composed acceptance remain open.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- This task depends on `FEATURE-SPACE-ACTIVITY-MODES`.
- Follow existing cron/scheduler patterns in the codebase.
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
