# Task: Fix pattern detector timezone and DST handling

ID: TECH-BUDDY-TIMEZONE-SAFETY
Type: technical
Scope: backend
Size: small
Parent: EPIC-BUDDY-HARDENING
Status: planned

## 1. Business goal

In order to get accurate time-of-day pattern suggestions regardless of server timezone or daylight saving transitions,
As a home operator,
I want the pattern detector to correctly cluster actions by local time.

## 2. Context

- `PatternDetectorService` uses `getHours()` and `getMinutes()` on JavaScript `Date` objects to determine time-of-day for clustering.
- These methods return values in the **system's local timezone**, which can shift during DST transitions.
- If the server timezone changes or DST kicks in, the same physical event (e.g., "turn off lights at bedtime") will appear at a different minute-of-day, breaking cluster continuity.
- The `clusterByTimeOfDay` utility in `buddy.utils.ts` also operates on local time values.
- The `BuddyContextService` correctly uses `toLocaleString` with a timezone parameter for display, but the pattern detector does not use this approach.

### Impact

- A user who turns off lights at 23:00 every night will see the pattern break twice a year during DST transitions (actions suddenly appear at 22:00 or 00:00).
- Servers in UTC-offset zones may detect patterns at wrong times.

## 3. Scope

**In scope**

- Convert pattern detector time extraction to use a configured or system timezone consistently
- Update `clusterByTimeOfDay` utility to accept timezone parameter
- Update `formatTimeLabel` utility for timezone consistency
- Add unit tests covering DST transition scenarios
- Use the system language/timezone from config module if available

**Out of scope**

- Multi-timezone support (one house = one timezone)
- User-specific timezone preferences
- Changes to suggestion display format

## 4. Acceptance criteria

- [ ] Pattern detector extracts time-of-day using a consistent timezone (configured or system default)
- [ ] `clusterByTimeOfDay` utility accepts an optional timezone parameter
- [ ] Time clustering produces identical results regardless of when DST transitions occur
- [ ] `formatTimeLabel` respects the configured timezone
- [ ] Unit tests cover: normal operation, DST spring-forward, DST fall-back, UTC server
- [ ] No changes to suggestion API response format

## 5. Example scenarios

### Scenario: DST spring-forward

Given the user turns off lights at 23:00 local time for 7 consecutive days
And DST spring-forward occurs on day 4 (clocks move from 02:00 to 03:00)
When the pattern detector clusters actions
Then all 7 actions cluster together at approximately 23:00
And the pattern confidence is not reduced by the DST shift

### Scenario: Server in UTC

Given the server runs in UTC timezone
And the configured house timezone is "Europe/Prague" (UTC+1 / UTC+2)
When the user turns off lights at 23:00 Prague time (22:00 / 21:00 UTC)
Then the pattern detector clusters at 23:00 (local time), not at the UTC time

## 6. Technical constraints

- Follow existing utility patterns in `buddy.utils.ts`
- Use `Intl.DateTimeFormat` or similar standard APIs (no new dependencies)
- The configured timezone should come from the system/config module if available, with fallback to `Intl.DateTimeFormat().resolvedOptions().timeZone`
- Do not change the `ActionObserverService` buffer format — timestamps are stored as `Date` objects

## 7. Implementation hints

- Create a helper function `getLocalTimeOfDay(date: Date, timezone: string): { hour: number; minute: number }`:
  ```typescript
  function getLocalTimeOfDay(date: Date, timezone: string): { hour: number; minute: number } {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(date);
    return {
      hour: Number(parts.find(p => p.type === 'hour')?.value ?? 0),
      minute: Number(parts.find(p => p.type === 'minute')?.value ?? 0),
    };
  }
  ```
- Inject the timezone into `PatternDetectorService` (from config module or system settings)
- Update `clusterByTimeOfDay` signature: `clusterByTimeOfDay(items, windowMinutes, timezone?)`
- Test with fixed `Date` objects that span a DST boundary

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
