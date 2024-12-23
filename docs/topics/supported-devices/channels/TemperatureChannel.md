# Temperature Channel

**Channel Category**: `temperature`

Measures the current temperature in an environment, reported in degrees Celsius .

---

## Required Properties {id="required-properties"}

| **Property**   | **Data Type** | **Range**   | **Unit** | **Permissions** |
|----------------|---------------|-------------|----------|-----------------|
| `temperature`  | `Float`       | `0.0–100.0` | °C       | RO (Read-Only)  |

---

### Property Details {id="required-properties-details"}

#### `temperature`

Reports the environmental temperature:

- Measured in degrees Celsius (`°C`).
- **Range**: `0.0–100.0°C`.

---

## Optional Properties {id="optional-properties"}

| **Property**   | **Data Type** | **Range**       | **Unit** | **Permissions** |
|----------------|---------------|-----------------|----------|-----------------|
| `active`       | `Bool`        | `true/false`    | -        | RO (Read-Only)  |
| `fault`        | `Uchar`       | `0–255`         | -        | RO (Read-Only)  |

---

### Property Details {id="optional-properties-details"}

#### `active`

Indicates the channel's current working status:

- `true`: The sensor is active and functioning correctly.
- `false`: The sensor is inactive or non-functional.

#### `fault`

Represents the fault state of the sensor:

- `0`: No fault detected.
- Non-zero: A fault has been detected, potentially affecting functionality.
