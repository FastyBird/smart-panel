# Thermostat Channel

**Channel Category**: `thermostat`

Manages climate control systems, allowing adjustments to heating, cooling, and fan settings.

---

## Required Properties {id="required-properties"}

| **Property** | **Data Type** | **Range**    | **Unit** | **Permissions** |
|--------------|---------------|--------------|----------|-----------------|
| `active`     | `Boolean`     | `true/false` | -        | RW (Read/Write) |

---

### Property Details {id="required-properties-details"}

#### `active`

Indicates whether the thermostat channel is currently active:

- `true`: The thermostat is active.
- `false`: The thermostat is inactive.

---

## Optional Properties {id="optional-properties"}

| **Property** | **Data Type** | **Range**            | **Unit** | **Permissions** |
|--------------|---------------|----------------------|----------|-----------------|
| `locked`     | `Boolean`     | `true/false`         | -        | RW (Read/Write) |
| `units`      | `Enum`        | `celsius/fahrenheit` | -        | RW (Read/Write) |

---

### Property Details {id="optional-properties-details"}

#### `locked`

Specifies whether the physical controls of the device are locked:

- `true`: Controls are locked (e.g., child lock enabled).
- `false`: Controls are unlocked.

#### `units`

Describes the temperature units used for display and presentation:

- Possible values:
    - `celsius`
    - `fahrenheit`
