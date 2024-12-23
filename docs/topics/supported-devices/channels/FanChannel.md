# Fan Channel

**Channel Category**: `fan`

Controls fan devices, including speed, oscillation, and modes for air circulation.

---

## Required Properties {id="required-properties"}

| **Property** | **Data Type** | **Range**    | **Unit** | **Permissions** |
|--------------|---------------|--------------|----------|-----------------|
| `on`         | `Bool`        | `true/false` | -        | RW (Read/Write) |

---

### Property Details {id="required-properties-details"}

#### `on`

Indicates the on/off state of the fan:

- `true`: The fan is on.
- `false`: The fan is off.

---

## Optional Properties {id="optional-properties"}

| **Property** | **Data Type** | **Range**                     | **Unit** | **Permissions** |
|--------------|---------------|-------------------------------|----------|-----------------|
| `swing`      | `Bool`        | `true/false`                  | -        | RW (Read/Write) |
| `speed`      | `Uchar`       | `0–100`                       | %        | RW (Read/Write) |
| `direction`  | `Enum`        | `clockwise/counter_clockwise` | -        | RW (Read/Write) |

---

### Property Details {id="optional-properties-details"}

#### `swing`

Indicates whether the swing mode is enabled:

- `true`: Swing mode is enabled.
- `false`: Swing mode is disabled.

#### `speed`

Represents the rotation speed of the fan:

- Expressed as a percentage (`0–100%`) of the maximum supported speed.

#### `direction`

Specifies the direction of the fan’s rotation:

- Possible values:
    - `clockwise`
    - `counter_clockwise`
