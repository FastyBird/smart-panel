# Electrical Power Channel

**Channel Category**: `electrical_power`

Reports real-time power metrics such as voltage, current, and wattage for monitoring and diagnostics.

---

## Required Properties {id="required-properties"}

| **Property** | **Data Type** | **Range**      | **Unit** | **Permissions** |
|--------------|---------------|----------------|----------|-----------------|
| `power`      | `Float`       | `0.0–10,000.0` | W        | RO (Read-Only)  |
| `voltage`    | `Float`       | `0.0–500.0`    | V        | RO (Read-Only)  |
| `current`    | `Float`       | `0.0–100.0`    | A        | RO (Read-Only)  |
| `frequency`  | `Float`       | `50.0–60.0`    | Hz       | RO (Read-Only)  |

---

### Property Details {id="required-properties-details"}

#### `power`
Represents the current power usage of the device:

- Measured in watts (`W`).
- Example: `750` indicates the device is consuming 750 W.

#### `voltage`

Indicates the voltage supplied to the device:

- Measured in volts (`V`).
- Example: `230` indicates the device is operating at 230 V.

#### `current`

Indicates the current flowing through the device:

- Measured in amperes (`A`).
- Example: `2.5` means the device is drawing 2.5 A.

#### `frequency`

Represents the frequency of the power supply:

- Measured in hertz (`Hz`).
- Typically `50` or `60` Hz depending on the region.

---

## Optional Properties {id="optional-properties"}

| **Property**   | **Data Type** | **Range**    | **Unit** | **Permissions** |
|----------------|---------------|--------------|----------|-----------------|
| `over_current` | `Bool`        | `true/false` | -        | RO (Read-Only)  |
| `over_voltage` | `Bool`        | `true/false` | -        | RO (Read-Only)  |
| `active`       | `Bool`        | `true/false` | -        | RO (Read-Only)  |
| `fault`        | `Uchar`       | `0–255`      | -        | RO (Read-Only)  |

---

### Property Details {id="optional-properties-details"}

#### `over_current`

Indicates whether an overcurrent condition is detected:

- `true`: Over current detected.
- `false`: No over current.

#### `over_voltage`

Indicates whether an overvoltage condition is detected:

- `true`: Over voltage detected.
- `false`: No over voltage.

#### `active`

Indicates the channel's current working status:

- `true`: The sensor is active and functioning correctly.
- `false`: The sensor is inactive or non-functional.

#### `fault`

Represents the fault state of the sensor:

- `0`: No fault detected.
- Non-zero: A fault has been detected, potentially affecting functionality.
