# Volatile Organic Compounds Sensor Channel

**Channel Category**: `volatile_organic_compounds`

Monitors the concentration of VOCs in the air to track pollution or air quality.

---

## Required Properties {id="required-properties"}

| **Property** | **Data Type** | **Range**         | **Unit** | **Permissions** |
|--------------|---------------|-------------------|----------|-----------------|
| `detected`   | `Boolean`     | `true/false`      | -        | RO (Read-Only)  |
| `density`    | `Float`       | `0.0–1,000.0`     | µg/m³    | RO (Read-Only)  |
| `level`      | `Enum`        | `low/medium/high` | -        | RO (Read-Only)  |

---

### Property Details {id="required-properties-details"}

#### `detected`

Indicates whether the sensor detects abnormal levels of VOCs:

- `true`: Abnormal VOC levels detected.
- `false`: VOC levels are within normal limits.

#### `density`

Reports the current volatile organic compounds (VOC) concentration:

- Measured in micrograms per cubic meter (`µg/m³`).
- Reflects real-time VOC levels in the environment.

#### `level`

Provides a qualitative assessment of VOC levels:

- Possible values:
    - `low`: Safe VOC levels.
    - `medium`: Moderate VOC levels that may require attention.
    - `high`: High VOC levels, potentially hazardous to health.

> [!Notes]:
At least one of the required properties (`detected`, `density`, or `level`) must be present. Additionally, either
`density` or `level` can be provided, but not both simultaneously.

### Additional info {id="required-additional-info"}

For the `density` property, no universally agreed threshold exists for VOCs as their composition can vary significantly.

However:
- **Low VOC levels** are generally considered safe for humans and the environment.
- **Medium levels** may indicate the need for better ventilation or caution.
- **High levels** are often linked to poor air quality and potential health risks.

The `level` property should be mapped to specific `density` ranges based on application or regulatory requirements:
- `low`: `0–500 µg/m³`
- `medium`: `501–1,000 µg/m³`
- `high`: `>1,000 µg/m³`

---

## Optional Properties {id="optional-properties"}

| **Property** | **Data Type** | **Range**    | **Unit** | **Permissions** |
|--------------|---------------|--------------|----------|-----------------|
| `active`     | `Boolean`     | `true/false` | -        | RO (Read-Only)  |
| `fault`      | `Uchar`       | `0–255`      | -        | RO (Read-Only)  |
| `tampered`   | `Boolean`     | `true/false` | -        | RO (Read-Only)  |

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
