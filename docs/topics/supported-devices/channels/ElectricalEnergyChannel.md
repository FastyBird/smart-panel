# Electrical Energy Channel

**Channel Category**: `electrical_energy`

Measures the total energy consumption over time, typically reported in kilowatt-hours (kWh).

---

## Required Properties {id="required-properties"}

| **Property**  | **Data Type** | **Range**      | **Unit** | **Permissions** |
|---------------|---------------|----------------|----------|-----------------|
| `consumption` | `Float`       | `0.0–10,000.0` | kWh      | RO (Read-Only)  |

---

### Property Details {id="required-properties-details"}

#### `consumption`

Represents the total energy consumed over a period of time:

- Measured in kilowatt-hours (`kWh`).
- Example: `12.5` indicates the device has consumed 12.5 kWh.

---

## Optional Properties {id="optional-properties"}

| **Property** | **Data Type** | **Range**     | **Unit** | **Permissions** |
|--------------|---------------|---------------|----------|-----------------|
| `rate`       | `Float`       | `0.0–100.0`   | kW       | RO (Read-Only)  |
| `active`     | `Bool`        | `true/false`  | -        | RO (Read-Only)  |
| `fault`      | `Uchar`       | `0–255`       | -        | RO (Read-Only)  |

---

### Property Details {id="optional-properties-details"}

#### `rate`

Indicates the current rate of energy consumption:

- Measured in kilowatts (`kW`).
- Example: `1.5` means the device is consuming energy at a rate of 1.5 kW.

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
