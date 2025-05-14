# Heater Channel

**Channel Category**: `heater`

Manages heating devices, allowing control of temperature settings and modes.

---

## Required Properties {id="required-properties"}

| **Property**  | **Data Type** | **Range**    | **Unit** | **Permissions** |
|---------------|---------------|--------------|----------|-----------------|
| `on`          | `Bool`        | `true/false` | -        | RW (Read/Write) |
| `temperature` | `Float`       | `0.0–100.0`  | °C       | RW (Read/Write) |
| `status`      | `Bool`        | `true/false` | -        | RO (Read-Only)  |

---

### Property Details {id="required-properties-details"}

#### `temperature`

Defines the heating threshold in Celsius:

- Specifies the maximum temperature before the heating mechanism activates.

> [!Example]:
If the current temperature goes below the minimum temperature, then the heating mechanism should turn on to increase
the current temperature until the minimum temperature is reached.

#### `status`

Indicates the current state of the heater:

- `true`: The heater is heating.
- `false`: The heater is inactive.
