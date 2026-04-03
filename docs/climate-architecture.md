# Climate Domain Architecture

This document describes the architecture of the climate control system in the Smart Panel backend.

## Overview

The climate domain provides multi-device climate control with support for:
- **Thermostats** - Combined heating/cooling with setpoint control
- **Heating Units** - Dedicated heaters with temperature setpoints
- **Air Conditioners** - Cooling devices with optional fan control

## Service Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SpacesController                          │
│                     POST /spaces/:id/climate                     │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ClimateIntentService                        │
│  - executeClimateIntent()                                        │
│  - Intent routing (SET_MODE, SETPOINT_SET, etc.)                │
│  - Per-device command execution                                  │
│  - InfluxDB storage                                              │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
┌───────────────────┐ ┌─────────────────┐ ┌──────────────────────┐
│ SpaceClimateState │ │ PlatformRegistry│ │ IntentTimeseries     │
│     Service       │ │    Service      │ │     Service          │
│ - getClimateState │ │ - get(device)   │ │ - storeClimateMode   │
│ - getPrimaryDevices│ │ - processBatch()│ │   Change()           │
└───────────────────┘ └─────────────────┘ └──────────────────────┘
```

## Key Services

### ClimateIntentService

**Location:** `apps/backend/src/modules/spaces/services/climate-intent.service.ts`

Handles all climate intent operations:

1. **SET_MODE** - Change climate mode (HEAT, COOL, AUTO, OFF)
2. **SETPOINT_SET** - Set specific temperature setpoint
3. **SETPOINT_DELTA** - Adjust setpoint by delta (SMALL: 0.5°C, MEDIUM: 1°C, LARGE: 2°C)
4. **CLIMATE_SET** - Atomic mode + setpoint change

Each intent:
- Creates an Intent record for tracking
- Executes commands on all applicable devices
- Stores results to InfluxDB for historical tracking
- Emits WebSocket events for real-time UI updates

### SpaceClimateStateService

**Location:** `apps/backend/src/modules/spaces/services/space-climate-state.service.ts`

Calculates aggregated climate state for a space:

- **Mode Detection** - Determines current mode from device states
- **Temperature Averaging** - Averages readings from multiple sensors
- **Setpoint Consensus** - Detects if devices have consistent setpoints
- **Capability Aggregation** - Combines heating/cooling support across devices

### SpaceClimateStateListener

**Location:** `apps/backend/src/modules/spaces/listeners/space-climate-state.listener.ts`

Reacts to device property changes and emits `CLIMATE_STATE_CHANGED` events.

**Triggering Properties:**
- `TEMPERATURE` - Temperature readings or setpoints
- `ON` - Heater/cooler power state
- `STATUS` - Active heating/cooling status
- `HUMIDITY` - Humidity readings
- `LOCKED` - Child lock status

**Event Flow:**
```
Device Property Change
        │
        ▼
┌───────────────────────────────────────┐
│  SpaceClimateStateListener            │
│  @OnEvent(CHANNEL_PROPERTY_VALUE_SET) │
│  @OnEvent(CHANNEL_PROPERTY_UPDATED)   │
└───────────────────────────────────────┘
        │
        ▼ (if climate-relevant)
┌───────────────────────────────────────┐
│  SpaceClimateStateService             │
│  getClimateState(roomId)              │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│  EventEmitter2                        │
│  emit(CLIMATE_STATE_CHANGED, ...)     │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│  WebSocket Gateway                    │
│  Broadcasts to connected clients      │
└───────────────────────────────────────┘
```

## Climate Modes

| Mode | Description | Heater | Cooler |
|------|-------------|--------|--------|
| OFF  | All climate devices off | OFF | OFF |
| HEAT | Heating active | ON | OFF |
| COOL | Cooling active | OFF | ON |
| AUTO | Both available | ON | ON |

## Device Roles

Devices can be assigned roles to control their participation in climate commands:

| Role | Description |
|------|-------------|
| AUTO | Responds to all climate modes |
| HEATING_ONLY | Only responds to HEAT mode |
| COOLING_ONLY | Only responds to COOL mode |
| SENSOR | Temperature reading only, no control |
| HIDDEN | Excluded from climate state calculation |

## Climate State Calculation

```typescript
interface ClimateState {
  hasClimate: boolean;           // Space has climate devices
  mode: ClimateMode;             // Current detected mode
  currentTemperature: number;    // Averaged temperature
  currentHumidity: number;       // Averaged humidity
  heatingSetpoint: number;       // Consensus heating setpoint
  coolingSetpoint: number;       // Consensus cooling setpoint
  minSetpoint: number;           // Minimum allowed setpoint
  maxSetpoint: number;           // Maximum allowed setpoint
  supportsHeating: boolean;      // Any device supports heating
  supportsCooling: boolean;      // Any device supports cooling
  isHeating: boolean;            // Any device actively heating
  isCooling: boolean;            // Any device actively cooling
  isMixed: boolean;              // Devices have different setpoints
  devicesCount: number;          // Number of climate devices
  lastAppliedMode: ClimateMode;  // Last user-applied mode (from InfluxDB)
  lastAppliedAt: Date;           // When mode was last applied
}
```

### Mode Detection Algorithm

```
1. For each device:
   - Check heater.on AND heater.status → isHeating
   - Check cooler.on AND cooler.status → isCooling

2. Aggregate across devices:
   - Any device heating AND cooling → AUTO
   - Any device only heating → HEAT
   - Any device only cooling → COOL
   - No active devices → OFF
```

### Setpoint Consensus

When multiple devices have setpoints:
1. Calculate average setpoint
2. Check if all devices are within `SETPOINT_CONSENSUS_TOLERANCE` (0.5°C)
3. If not → mark `isMixed: true`

## Constants

```typescript
// Setpoint precision for rounding (degrees Celsius)
export const SETPOINT_PRECISION = 0.5;

// Setpoint consensus tolerance (degrees Celsius)
export const SETPOINT_CONSENSUS_TOLERANCE = 0.5;

// Default setpoint range
export const DEFAULT_MIN_SETPOINT = 5;
export const DEFAULT_MAX_SETPOINT = 35;

// Absolute limits
export const ABSOLUTE_MIN_SETPOINT = -10;
export const ABSOLUTE_MAX_SETPOINT = 50;
```

## InfluxDB Storage

Climate mode changes are stored in InfluxDB for historical tracking:

**Measurement:** `space_intent`
**Tags:**
- `space_id` - Space UUID
- `type` - Intent type (e.g., `climate.setMode`)

**Fields:**
- `mode` - Climate mode
- `heating_setpoint` - Heating setpoint value
- `cooling_setpoint` - Cooling setpoint value
- `total_devices` - Number of targeted devices
- `affected_devices` - Successfully updated devices
- `failed_devices` - Failed device updates

## Error Handling

1. **Device failures** - Partial success allowed (at least one device must succeed)
2. **Platform not found** - Device skipped, counted as failed
3. **Property change events** - Errors logged, event processing continues
4. **InfluxDB writes** - Fire-and-forget with internal error handling

## Performance Optimizations

The climate domain is optimized for low-resource devices:

### Query Optimization
- **Parallel data fetching** - `getClimateState()` fetches devices, role map, and InfluxDB state in parallel using `Promise.all()`
- **Data reuse** - Internal methods reuse already-fetched devices and role maps to avoid redundant database queries
- **Early exits** - Returns early when space has no devices or no climate capabilities

### Event Debouncing
- **SpaceClimateStateListener** debounces `CLIMATE_STATE_CHANGED` events (100ms delay)
- Prevents WebSocket flooding when devices update multiple properties simultaneously
- Single state recalculation per debounce window regardless of property change count

### Code Design
- **Synchronous extraction** - `extractPrimaryClimateDevices()` and `extractSensorTemperatures()` are synchronous when data is already fetched
- **Fire-and-forget InfluxDB writes** - Non-blocking storage of mode changes
- **Minimal allocations** - Reuses data structures where possible

## Testing

Unit tests cover all critical services:

- `climate-intent.service.spec.ts` - Intent execution tests
- `space-climate-state.service.spec.ts` - State calculation tests
- `space-climate-state.listener.spec.ts` - Event handling tests

Run tests:
```bash
cd apps/backend
npx jest "climate" --no-coverage
```
