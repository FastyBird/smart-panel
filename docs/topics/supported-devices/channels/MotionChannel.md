# Motion Sensor Channel

**Channel Category**: `motion`

Detects motion in an area to trigger alerts or automate responses.

---

## Required Properties {id="required-properties"}

| **Property** | **Data Type** | **Range**    | **Unit** | **Permissions** |
|--------------|---------------|--------------|----------|-----------------|
| `detected`   | `Bool`        | `true/false` | -        | RO (Read-Only)  |

---

### Property Details {id="required-properties-details"}

#### `detected`

Indicates whether the sensor detects a motion event:

- `true`: Motion is detected.
- `false`: Motion is not detected.

---

## Optional Properties {id="optional-properties"}

| **Property** | **Data Type** | **Range**    | **Unit** | **Permissions** |
|--------------|---------------|--------------|----------|-----------------|
| `distance`   | `Float`       | `0.0–100.0`  | m        | RO (Read-Only)  |
| `active`     | `Bool`        | `true/false` | -        | RO (Read-Only)  |
| `fault`      | `Uchar`       | `0–255`      | -        | RO (Read-Only)  |
| `tampered`   | `Bool`        | `true/false` | -        | RO (Read-Only)  |

---

### Property Details {id="optional-properties-details"}

#### `distance`

Represents the distance from the sensor to the detected object:

- Measured in meters (m).

#### `active`

Indicates the channel's current working status:

- `true`: The sensor is active and functioning correctly.
- `false`: The sensor is inactive or non-functional.

#### `fault`

Represents the fault state of the sensor:

- `0`: No fault detected.
- Non-zero: A fault has been detected, potentially affecting functionality.

#### `tampered`

Indicates whether the channel has been tampered with:

- `true`: The channel has been tampered with.
- `false`: The channel is in a normal, non-tampered state.
