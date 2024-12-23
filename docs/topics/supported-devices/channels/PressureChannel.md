# Pressure Channel

**Channel Category**: `pressure`

Reports atmospheric or liquid pressure values, typically measured in pascals (kPa).

---

## Required Properties {id="required-properties"}

| **Property** | **Data Type** | **Range**      | **Unit** | **Permissions** |
|--------------|---------------|----------------|----------|-----------------|
| `measured`   | `Float`       | `0.0–32,767.0` | kPa      | RO (Read-Only)  |

---

### Property Details {id="required-properties-details"}

#### `measured`

Represents the current pressure level:

- Measured in kilopascals (`kPa`).
- Reflects the real-time atmospheric or other environmental pressure.

---

## Optional Properties {id="optional-properties"}

| **Property** | **Data Type** | **Range**    | **Unit** | **Permissions** |
|--------------|---------------|--------------|----------|-----------------|
| `active`     | `Bool`        | `true/false` | -        | RO (Read-Only)  |
| `fault`      | `Uchar`       | `0–255`      | -        | RO (Read-Only)  |

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
