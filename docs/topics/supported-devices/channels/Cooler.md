# Cooler Channel

**Channel Category**: `cooler`

Controls devices that lower air or liquid temperatures, such as air conditioners or refrigeration systems.

---

## Required Properties {id="required-properties"}

| **Property**   | **Data Type** | **Range**    | **Unit** | **Permissions** |
|----------------|---------------|--------------|----------|-----------------|
| `temperature`  | `Float`       | `0.0–100.0`  | °C       | RW (Read/Write) |
| `status`       | `Boolean`     | `true/false` | -        | RO (Read-Only)  |

---

### Property Details {id="required-properties-details"}

#### `temperature`

Defines the cooling threshold in Celsius:

- Specifies the maximum temperature before the cooling mechanism activates.

> [!Example]:
If the current temperature exceeds this value, the cooler turns on to reduce the temperature until the desired range
is reached.

#### `status`

Indicates the current state of the cooler:

- `true`: The cooler is cooling.
- `false`: The cooler is inactive.