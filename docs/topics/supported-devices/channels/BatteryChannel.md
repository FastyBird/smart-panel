# Battery Channel

**Channel Category**: `battery`

Reports the status of a device's battery, including level, charging state, and operational health.

---

## Required Properties {id="required-properties"}

| **Property** | **Data Type** | **Range**         | **Unit** | **Permissions** |
|--------------|---------------|-------------------|----------|-----------------|
| `percentage` | `Uchar`       | `0–100`           | %        | RO (Read-Only)  |
| `status`     | `Enum`        | `ok/low/charging` | -        | RO (Read-Only)  |

---

### Property Details {id="required-properties-details"}

#### `percentage`

Represents the current battery level as a percentage.

#### `status`

Indicates the current status of the battery:

- `ok`: The battery level is sufficient.
- `low`: The battery level is critically low and may require recharging or replacement.
- `charging`: The battery is currently charging.

---

## Optional Properties {id="optional-properties"}

| **Property** | **Data Type** | **Range** | **Unit** | **Permissions** |
|--------------|---------------|-----------|----------|-----------------|
| `fault`      | `Uchar`       | `0–255`   | -        | RO (Read-Only)  |

---

### Property Details {id="optional-properties-details"}

#### `fault`

Represents the fault state of the battery:

- `0`: No fault detected.
- Non-zero: A fault has been detected, potentially affecting functionality.
