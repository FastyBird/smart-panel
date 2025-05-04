# Air Particulate Channel

**Channel Category**: `air_particulate`

Monitors the concentration of particulate matter (e.g., PM2.5 and PM10) in the air, providing insights into air quality
and pollution levels.

---

## Required Properties {id="required-properties"}

| **Property** | **Data Type** | **Range**     | **Unit** | **Permissions** |
|--------------|---------------|---------------|----------|-----------------|
| `detected`   | `Bool`        | `true/false`  | -        | RO (Read-Only)  |
| `density`    | `Float`       | `0.0–1,000.0` | µg/m³    | RO (Read-Only)  |
| `mode`       | `Enum`        | `pm2_5/pm10`  | -        | RO (Read-Only)  |

---

### Property Details {id="required-properties-details"}

#### `detected`

Indicates whether the sensor detects abnormal levels of particulate matter in the air:

- `true`: Abnormal particulate matter in the air levels detected.
- `false`: Particulate matter in the air levels have returned to normal.

#### `density`

Indicates the current density of particulate matter:

- Measured in micrograms per cubic meter (`µg/m³`).
- Represents either PM2.5 or PM10 particles, depending on the `mode` property.

#### `mode`

Specifies the type of particulate matter being measured:
 
- Possible values:
    - `pm2_5`: Measures particulate matter smaller than 2.5 µm.
    - `pm10`: Measures particulate matter smaller than 10 µm.
- Determines how the `density` property is interpreted.

---

## Optional Properties {id="optional-properties"}

| **Property** | **Data Type** | **Range**    | **Unit** | **Permissions** |
|--------------|---------------|--------------|----------|-----------------|
| `active`     | `Bool`        | `true/false` | -        | RO (Read-Only)  |
| `fault`      | `Uchar`       | `0–255`      | -        | RO (Read-Only)  |
| `tampered`   | `Bool`        | `true/false` | -        | RO (Read-Only)  |

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

#### `tampered`

Indicates whether the channel has been tampered with:

- `true`: The channel has been tampered with.
- `false`: The channel is in a normal, non-tampered state.
