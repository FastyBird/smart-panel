# Carbon Monoxide Sensor Channel

**Channel Category**: `carbon_monoxide`

Detects the presence of carbon monoxide (CO) to ensure safety in enclosed spaces.

---

## Required Properties {id="required-properties"}

| **Property** | **Data Type** | **Range**    | **Unit** | **Permissions** |
|--------------|---------------|--------------|----------|-----------------|
| `detected`   | `Boolean`     | `true/false` | -        | RO (Read-Only)  |
| `density`    | `Float`       | `0.0–100.0`  | ppm      | RO (Read-Only)  |

---

### Property Details {id="required-properties-details"}

#### `detected`

Indicates whether the sensor detects abnormal levels of carbon monoxide:

- `true`: Abnormal CO levels detected.
- `false`: CO levels have returned to normal.

#### `density`

Reports the current detected carbon monoxide (CO) level in parts per million (ppm).

> [!Notes]:
Either `detected` or `density` must be included, depending on the use case. If only `density` is provided, values
of **9 ppm** or higher are considered poor air quality, and values exceeding **35 ppm** may indicate dangerous
conditions requiring immediate attention. Value above provided thresholds will be displayed as warning and
error respectively

---

## Optional Properties {id="optional-properties"}

| **Property**  | **Data Type** | **Range**    | **Unit** | **Permissions** |
|---------------|---------------|--------------|----------|-----------------|
| `peak_level`  | `Float`       | `0.0–100.0`  | ppm      | RO (Read-Only)  |
| `active`      | `Boolean`     | `true/false` | -        | RO (Read-Only)  |
| `fault`       | `Uchar`       | `0–255`      | -        | RO (Read-Only)  |
| `tampered`    | `Boolean`     | `true/false` | -        | RO (Read-Only)  |

---

### Property Details {id="optional-properties-details"}

#### `peak_level`

Indicates the highest carbon monoxide (CO) level detected by the sensor, in parts per million (ppm).

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