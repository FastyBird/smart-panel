# Humidity Channel

**Channel Category**: `humidity`

Measures the relative humidity in the environment, reported as a percentage.

---

## Required Properties {id="required-properties"}

| **Property**   | **Data Type** | **Range**    | **Unit** | **Permissions** |
|----------------|---------------|--------------|----------|-----------------|
| `humidity`     | `Uchar`       | `0–100`      | %        | RO (Read-Only)  |

---

### Property Details {id="required-properties-details"}

#### `humidity`

Describes the relative humidity of the channel's environment:

- Expressed as a percentage (`0–100%`).

---

## Optional Properties {id="optional-properties"}

| **Property**   | **Data Type** | **Range**       | **Unit** | **Permissions** |
|----------------|---------------|-----------------|----------|-----------------|
| `active`       | `Boolean`     | `true/false`    | -        | RO (Read-Only)  |
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