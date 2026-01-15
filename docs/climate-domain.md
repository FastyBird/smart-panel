# Climate Domain

This document describes the climate domain implementation for the Smart Panel, including multi-device control, intent handling, and state aggregation.

## Overview

The climate domain enables intelligent control of heating and cooling devices within a space. Unlike simple thermostat control, the climate domain:

- Aggregates state from **all** primary climate devices in a space
- Executes intents across **multiple** devices simultaneously
- Automatically filters devices based on their role and capability
- Provides unified temperature and humidity readings
- Supports **mixed state** detection when devices are out of sync

## Device Categories

The following device categories belong to the climate domain:

| Category | Description | Primary Control |
|----------|-------------|-----------------|
| `thermostat` | Temperature control units | Yes |
| `air_conditioner` | Cooling systems | Yes |
| `heating_unit` | Heating systems | Yes |
| `air_humidifier` | Humidity addition | No |
| `air_dehumidifier` | Humidity removal | No |
| `air_purifier` | Air filtration | No |
| `fan` | Air circulation | No |

**Primary climate devices** are `thermostat`, `air_conditioner`, and `heating_unit`. These are the devices controlled by climate intents.

## Climate Roles

Each climate device can be assigned a role that determines its behavior:

| Role | Value | Description |
|------|-------|-------------|
| **Auto** | `auto` or `null` | Device supports both heating and cooling. Controlled in all modes. |
| **Heating Only** | `heating_only` | Device can only heat. Controlled only in HEAT mode. |
| **Cooling Only** | `cooling_only` | Device can only cool. Controlled only in COOL mode. |
| **Sensor** | `sensor` | Device used for monitoring only. Not controlled by intents. |
| **Hidden** | `hidden` | Device excluded from UI and intents. |

If a device has no role assigned, it is treated as `auto`.

## Climate Modes

The climate domain operates in one of four modes:

| Mode | Description | Device Control |
|------|-------------|----------------|
| **HEAT** | Heating is active | Control devices with role AUTO or HEATING_ONLY that have HEATER channel |
| **COOL** | Cooling is active | Control devices with role AUTO or COOLING_ONLY that have COOLER channel |
| **AUTO** | System maintains temperature range | Control all devices within heating/cooling setpoints |
| **OFF** | Climate control disabled | Turn off heater.on, cooler.on, thermostat.active |

### Mode Detection

The current mode is detected from device states:

1. If any device has `heater.on = true` → Mode is **HEAT**
2. Else if any device has `cooler.on = true` → Mode is **COOL**
3. Else if all devices have `heater.on = false` and `cooler.on = false` → Mode is **OFF**
4. Default: **AUTO** (when devices have thermostat control but no explicit heating/cooling)

## Device Capability Detection

A device's heating/cooling capability is determined by channel presence:

| Capability | Detection Method |
|------------|------------------|
| Supports Heating | Device has `HEATER` channel |
| Supports Cooling | Device has `COOLER` channel |

This allows the system to properly route intents to capable devices.

## State Aggregation

### Temperature Averaging

Current temperature is averaged from all primary climate devices:

```
currentTemperature = average(device1.temp, device2.temp, ...)
```

Only primary devices (thermostat, heater, AC) are included by default. This is configurable via `TEMPERATURE_AVERAGING_STRATEGY`:
- `PRIMARY_ONLY` (default): Only primary climate devices
- `ALL_SOURCES`: Include standalone sensors

### Humidity Averaging

Current humidity is averaged from all devices that have humidity sensors:

```
currentHumidity = average(device1.humidity, device2.humidity, ...)
```

### Setpoint Range Calculation

The min/max setpoint range uses **intersection** (most restrictive):

```
minSetpoint = max(device1.minSetpoint, device2.minSetpoint, ...)
maxSetpoint = min(device1.maxSetpoint, device2.maxSetpoint, ...)
```

This ensures any setpoint value is valid for all devices.

### Target Temperature

- **HEAT/COOL modes**: Single setpoint (`targetTemperature`)
- **AUTO mode**: Dual setpoints (`heatingSetpoint` and `coolingSetpoint`)

When devices have different setpoints, the system reports:
- Average value for display
- `isMixed = true` flag to indicate inconsistency

## Climate Intents

### Intent Types

| Intent Type | Description | Parameters |
|-------------|-------------|------------|
| `SETPOINT_SET` | Set target temperature directly | `value`, or `heatingSetpoint` & `coolingSetpoint` |
| `SETPOINT_DELTA` | Adjust temperature by increment | `delta` (SMALL/MEDIUM/LARGE), `increase` (boolean) |
| `SET_MODE` | Change climate mode | `mode` (HEAT/COOL/AUTO/OFF) |

### Delta Steps

| Delta Size | Temperature Change |
|------------|-------------------|
| `SMALL` | 0.5°C |
| `MEDIUM` | 1.0°C |
| `LARGE` | 2.0°C |

### Intent Execution

When an intent is executed:

1. **Get primary devices** - Find all primary climate devices in the space
2. **Filter by role** - Apply role-based filtering for the current mode
3. **Filter by capability** - Only control devices that have the required channel
4. **Execute on each device** - Send commands to all matching devices
5. **Report results** - Return success/failure counts and new state

### Device Filtering Logic

For **HEAT** mode intent:
```
devices = primaryDevices.filter(d =>
  (d.role === AUTO || d.role === HEATING_ONLY || d.role === null) &&
  d.supportsHeating === true
)
```

For **COOL** mode intent:
```
devices = primaryDevices.filter(d =>
  (d.role === AUTO || d.role === COOLING_ONLY || d.role === null) &&
  d.supportsCooling === true
)
```

For **AUTO** mode intent:
- Heating setpoint → sent to devices that support heating
- Cooling setpoint → sent to devices that support cooling

For **OFF** mode intent:
- All primary devices: `heater.on = false`, `cooler.on = false`, `thermostat.active = false`

## Mixed State

Similar to the lighting domain, climate supports **mixed state** detection.

A space is in mixed state when:
- Multiple devices have different target temperatures
- Heating and cooling setpoints are out of sync across devices

When `isMixed = true`:
- The UI may show a "mixed" indicator
- Temperature values shown are averages
- Setting a new setpoint will synchronize all devices

## Channel and Property Structure

### HEATER Channel

| Property | Category | Description |
|----------|----------|-------------|
| on | `ON` | Heater active state |
| temperature | `TEMPERATURE` | Heating setpoint |

### COOLER Channel

| Property | Category | Description |
|----------|----------|-------------|
| on | `ON` | Cooler active state |
| temperature | `TEMPERATURE` | Cooling setpoint |

### THERMOSTAT Channel

| Property | Category | Description |
|----------|----------|-------------|
| active | `ACTIVE` | Thermostat active state |
| mode | `MODE` | Thermostat operating mode |

### TEMPERATURE Channel (Sensor)

| Property | Category | Description |
|----------|----------|-------------|
| temperature | `TEMPERATURE` | Current temperature reading |

### HUMIDITY Channel (Sensor)

| Property | Category | Description |
|----------|----------|-------------|
| humidity | `HUMIDITY` | Current humidity reading |

## API Endpoints

### Get Climate State

```http
GET /spaces/{spaceId}/climate
```

Returns:
```json
{
  "data": {
    "has_climate": true,
    "mode": "heat",
    "current_temperature": 22.5,
    "current_humidity": 45,
    "target_temperature": 21.0,
    "heating_setpoint": 21.0,
    "cooling_setpoint": null,
    "min_setpoint": 15,
    "max_setpoint": 30,
    "can_set_setpoint": true,
    "supports_heating": true,
    "supports_cooling": true,
    "is_mixed": false,
    "devices_count": 2
  }
}
```

### Execute Climate Intent

```http
POST /spaces/{spaceId}/intents/climate
```

**Setpoint Set (single value):**
```json
{
  "data": {
    "type": "setpoint_set",
    "value": 22.0
  }
}
```

**Setpoint Set (dual setpoints for AUTO mode):**
```json
{
  "data": {
    "type": "setpoint_set",
    "heating_setpoint": 20.0,
    "cooling_setpoint": 24.0
  }
}
```

**Setpoint Delta:**
```json
{
  "data": {
    "type": "setpoint_delta",
    "delta": "medium",
    "increase": true
  }
}
```

**Set Mode:**
```json
{
  "data": {
    "type": "set_mode",
    "mode": "heat"
  }
}
```

Response:
```json
{
  "data": {
    "success": true,
    "affected_devices": 2,
    "failed_devices": 0,
    "mode": "heat",
    "new_setpoint": 22.0,
    "heating_setpoint": 22.0,
    "cooling_setpoint": null
  }
}
```

## Examples

### Example 1: Living Room with Multiple Devices

Space contains:
- Thermostat (role: auto, supports heating & cooling)
- Floor heater (role: heating_only, supports heating only)
- Portable AC (role: cooling_only, supports cooling only)

**Intent: Set to HEAT mode at 21°C**

Result:
- Thermostat: `heater.on = true`, `heater.temperature = 21`
- Floor heater: `heater.on = true`, `heater.temperature = 21`
- Portable AC: Not affected (wrong role for HEAT mode)

**Intent: Set to COOL mode at 24°C**

Result:
- Thermostat: `cooler.on = true`, `cooler.temperature = 24`
- Floor heater: Not affected (wrong role for COOL mode)
- Portable AC: `cooler.on = true`, `cooler.temperature = 24`

### Example 2: Mixed State Scenario

Two thermostats in a space:
- Thermostat A: target = 21°C
- Thermostat B: target = 23°C

State response:
```json
{
  "target_temperature": 22.0,
  "is_mixed": true,
  "devices_count": 2
}
```

Setting a new setpoint (22.5°C) will synchronize both:
- Thermostat A: target = 22.5°C
- Thermostat B: target = 22.5°C
- `is_mixed` becomes `false`

## Constants Reference

```typescript
// Climate modes
enum ClimateMode {
  HEAT = 'heat',
  COOL = 'cool',
  AUTO = 'auto',
  OFF = 'off',
}

// Climate roles
enum ClimateRole {
  AUTO = 'auto',
  HEATING_ONLY = 'heating_only',
  COOLING_ONLY = 'cooling_only',
  SENSOR = 'sensor',
  HIDDEN = 'hidden',
}

// Intent types
enum ClimateIntentType {
  SETPOINT_DELTA = 'setpoint_delta',
  SETPOINT_SET = 'setpoint_set',
  SET_MODE = 'set_mode',
}

// Setpoint delta sizes
enum SetpointDelta {
  SMALL = 'small',   // 0.5°C
  MEDIUM = 'medium', // 1.0°C
  LARGE = 'large',   // 2.0°C
}

// Temperature limits
const ABSOLUTE_MIN_SETPOINT = 5;
const ABSOLUTE_MAX_SETPOINT = 40;
```

## Undo Support

Climate intents support undo via the space context snapshot system. When an intent is executed:

1. Current state is captured before execution
2. State includes target temperatures and device states
3. Undo restores the captured setpoint values

Note: Undo currently restores only the primary thermostat (first device with setpoint capability) for backward compatibility.
