# Nitrogen Dioxide Sensor Channel

**Channel Category**: `nitrogen_dioxide`

Monitors the concentration of NO₂ in the air, often used in environmental and industrial monitoring.

---

## Required Properties {id="required-properties"}

| **Property** | **Data Type** | **Range**       | **Unit**      | **Permissions** |
|--------------|---------------|-----------------|---------------|-----------------|
| `detected`   | `Bool`        | `true/false`    | -             | RO (Read-Only)  |
| `density`    | `Float`       | `0.0–100,000.0` | micrograms/m³ | RO (Read-Only)  |
| `mode `      | `Enum`        | `annual/1_hour` | -             | RO (Read-Only)  |

---

### Property Details {id="required-properties-details"}

#### `detected`

Indicates whether the sensor detects abnormal levels of nitrogen dioxide:

- `true`: Abnormal NO₂ levels detected.
- `false`: NO₂ levels are within normal limits.

#### `density`

Reports the current detected nitrogen dioxide (NO₂) concentration:

- Measured in micrograms per cubic meter (`micrograms/m³`).
- Reflects real-time NO₂ levels in the environment.

#### `mode`

Specifies the type of measurement provided by the sensor:

- `annual`: The sensor measures long-term average NO₂ levels over a year.
- `1_hour`: The sensor measures short-term NO₂ levels as a 1-hour average.

> [!Notes]:
Either `detected` or `density` must be included, depending on the use case. If only `density` is provided, values
exceeding **40 micrograms/m³** (annual mean) or **200 micrograms/m³** (1-hour mean) are considered poor air quality
per WHO guidelines and will be displayed as a warning

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
