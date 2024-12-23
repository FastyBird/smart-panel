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
