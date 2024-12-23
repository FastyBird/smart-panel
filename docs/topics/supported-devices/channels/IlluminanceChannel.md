# Illuminance Sensor Channel

**Channel Category**: `illuminance`

Detects ambient light levels, typically measured in lux, to monitor brightness in a space.

---

## Required Properties {id="required-properties"}

| **Property** | **Data Type** | **Range**                    | **Unit** | **Permissions** |
|--------------|---------------|------------------------------|----------|-----------------|
| `density`    | `Float`       | `0.0–100,000.0`              | lx       | RO (Read-Only)  |
| `level`      | `Enum`        | `bright/moderate/dusky/dark` | -        | RO (Read-Only)  |

---

### Property Details {id="required-properties-details"}

#### `density`

Represents the current illuminance density detected by the sensor:

- Measured in lux (`lx`).
- Reflects the real-time light intensity in the environment.

#### `level`

Provides a qualitative assessment of the light conditions:

- Possible values:
  - `bright`: High light intensity (e.g., daylight indoors or direct sunlight).
  - `moderate`: Adequate lighting for most tasks (e.g., office lighting).
  - `dusky`: Low light conditions (e.g., evening or heavily shaded areas).
  - `dark`: Very low or no light (e.g., nighttime without artificial lighting).

- Mapping to measured Lux:
  - `bright`: >10,000 lx
  - `moderate`: 1,000–10,000 lx
  - `dusky`: 100–1,000 lx
  - `dark`: <100 lx

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
