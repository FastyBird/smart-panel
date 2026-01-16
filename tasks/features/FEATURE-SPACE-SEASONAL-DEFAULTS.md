# Task: Seasonal baseline adjustments
ID: FEATURE-SPACE-SEASONAL-DEFAULTS
Type: feature
Scope: backend, admin
Size: small
Parent: EPIC-EXPAND-SMART-PANEL-DOMAINS
Status: planned

## 1. Business goal

In order to have my home automatically adapt to seasonal changes,
As a smart home user,
I want the system to adjust baseline settings (climate setpoints, cover positions) based on the time of year without manual reconfiguration.

## 2. Context

### Existing Code References
- **Space modes**: `FEATURE-SPACE-ACTIVITY-MODES` (dependency)
- **Climate domain**: Already has setpoint controls
- **Covers domain**: Already has position controls

### Seasonal Patterns (Northern Hemisphere)
| Season | Climate | Covers | Lighting |
|--------|---------|--------|----------|
| **Summer** | Higher setpoints (24°C), cooling priority | Close during peak sun | Later evening modes |
| **Winter** | Lower setpoints (21°C), heating priority | Open for solar gain, close at night | Earlier evening modes |
| **Spring/Autumn** | Moderate (22°C), natural ventilation | Dynamic based on temperature | Standard timing |

### Adjustment Types
1. **Climate baseline** - Adjust default setpoints per season
2. **Covers strategy** - Change default positions/modes
3. **Schedule offsets** - Shift time-based modes with daylight

## 3. Scope

**In scope**

Backend:
- Define `Season` enum (SPRING, SUMMER, AUTUMN, WINTER)
- Create `SeasonalAdjustmentService` for:
  - Determining current season
  - Applying seasonal offsets to mode configurations
- Store seasonal adjustments as configuration
- Apply adjustments transparently when modes activate

Admin:
- Enable/disable seasonal adjustments globally
- View current season and active adjustments
- Optional: customize seasonal offsets

**Out of scope**
- Weather-based real-time adjustments
- Daylight/sunrise-sunset calculations
- Location-based season detection
- Southern hemisphere support (MVP: northern only)
- Per-space seasonal configuration

## 4. Acceptance criteria

- [ ] System determines current season based on date
- [ ] Climate setpoints are adjusted by seasonal offset
- [ ] Covers default positions are adjusted by season
- [ ] Adjustments are applied automatically when modes activate
- [ ] Admin can enable/disable seasonal adjustments
- [ ] Admin can view current season and active adjustments
- [ ] Adjustments are additive (mode value + seasonal offset)
- [ ] Unit tests cover:
  - [ ] Season determination
  - [ ] Offset application
  - [ ] Edge cases (season transitions)

## 5. Example scenarios

### Scenario: Summer climate adjustment

Given current date is July 15 (Summer)
And seasonal adjustments are enabled
And default Work mode setpoint is 21°C
And summer climate offset is +2°C
When Work mode is activated
Then climate setpoint is 23°C (21 + 2)

### Scenario: Winter covers adjustment

Given current date is January 10 (Winter)
And seasonal adjustments are enabled
And Relax mode default covers position is 100% (open)
And winter evening strategy is "close at sunset"
When Relax mode is activated after sunset
Then covers position is 0% (closed)

### Scenario: Disabled adjustments

Given seasonal adjustments are disabled
When Work mode is activated in Summer
Then climate setpoint is default 21°C (no offset)

## 6. Technical constraints

- Keep adjustments simple and predictable
- Use fixed date ranges for seasons (not astronomical)
- Adjustments should be transparent to users
- Do not modify generated code
- Tests are expected for new logic

## 7. Implementation hints

### Season Determination
```typescript
enum Season {
  SPRING = 'spring',   // Mar 20 - Jun 20
  SUMMER = 'summer',   // Jun 21 - Sep 22
  AUTUMN = 'autumn',   // Sep 23 - Dec 20
  WINTER = 'winter',   // Dec 21 - Mar 19
}

function getCurrentSeason(date: Date = new Date()): Season {
  const month = date.getMonth(); // 0-11
  const day = date.getDate();

  if ((month === 2 && day >= 20) || month === 3 || month === 4 || (month === 5 && day <= 20)) {
    return Season.SPRING;
  }
  if ((month === 5 && day >= 21) || month === 6 || month === 7 || (month === 8 && day <= 22)) {
    return Season.SUMMER;
  }
  if ((month === 8 && day >= 23) || month === 9 || month === 10 || (month === 11 && day <= 20)) {
    return Season.AUTUMN;
  }
  return Season.WINTER;
}
```

### Seasonal Offsets Configuration
```typescript
interface SeasonalOffsets {
  climate: {
    setpointDelta: number; // Added to mode setpoint
  };
  covers: {
    positionStrategy: 'default' | 'solar_gain' | 'heat_retention';
  };
  schedule: {
    eveningOffsetMinutes: number; // Shift evening modes
  };
}

const DEFAULT_SEASONAL_OFFSETS: Record<Season, SeasonalOffsets> = {
  [Season.SPRING]: {
    climate: { setpointDelta: 0 },
    covers: { positionStrategy: 'default' },
    schedule: { eveningOffsetMinutes: 0 },
  },
  [Season.SUMMER]: {
    climate: { setpointDelta: 2 }, // Warmer setpoints
    covers: { positionStrategy: 'solar_gain' }, // Block afternoon sun
    schedule: { eveningOffsetMinutes: 60 }, // Later evening modes
  },
  [Season.AUTUMN]: {
    climate: { setpointDelta: 0 },
    covers: { positionStrategy: 'default' },
    schedule: { eveningOffsetMinutes: -30 }, // Earlier evening modes
  },
  [Season.WINTER]: {
    climate: { setpointDelta: -1 }, // Slightly cooler (energy saving)
    covers: { positionStrategy: 'heat_retention' }, // Max solar gain, close at night
    schedule: { eveningOffsetMinutes: -60 }, // Much earlier evening modes
  },
};
```

### Integration with Mode Activation
```typescript
// In SpaceModeService.activateMode()
async activateMode(spaceId: string, mode: ActivityMode): Promise<ModeResult> {
  const config = await this.getModeConfig(spaceId, mode);

  // Apply seasonal adjustments if enabled
  if (this.seasonalService.isEnabled()) {
    const season = this.seasonalService.getCurrentSeason();
    config = this.seasonalService.applyAdjustments(config, season);
  }

  // Continue with mode activation...
}
```

### Admin Configuration UI
```
┌─────────────────────────────────────────────┐
│ Seasonal Adjustments                   [ON] │
├─────────────────────────────────────────────┤
│ Current season: Summer ☀️                    │
│                                             │
│ Active adjustments:                         │
│ • Climate: +2°C setpoint offset             │
│ • Covers: Solar gain strategy               │
│ • Schedule: Evening modes +60 min later     │
└─────────────────────────────────────────────┘
```

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- This task depends on `FEATURE-SPACE-ACTIVITY-MODES`.
- Keep the implementation simple and predictable.
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
