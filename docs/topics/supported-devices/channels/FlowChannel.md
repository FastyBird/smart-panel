# Flow Channel

**Channel Category**: `flow`

Monitors the rate of fluid or air flow, typically measured in cubic meters per hour (m³/h).

---

## Required Properties {id="required-properties"}

| **Property** | **Data Type** | **Range**      | **Unit** | **Permissions** |
|--------------|---------------|----------------|----------|-----------------|
| `rate`       | `Float`       | `0.0–65,533.0` | m³/h     | RO (Read-Only)  |

---

### Property Details {id="required-properties-details"}

#### `rate`

Represents the current flow rate:

- Measured in cubic meters per hour (`m³/h`).
- Reflects the real-time value provided by the flow sensor.

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
