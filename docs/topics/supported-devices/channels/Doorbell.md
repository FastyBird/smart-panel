# Doorbell Channel

**Channel Category**: `doorbell`

Represents smart doorbells, providing features such as button press detection and optional camera integration.

---

## Required Properties {id="required-properties"}

| **Property** | **Data Type** | **Range**                              | **Unit** | **Permissions** |
|--------------|---------------|----------------------------------------|----------|-----------------|
| `event`      | `Enum`        | `single_press/double_press/long_press` | -        | RO (Read-Only)  |

---

### Property Details {id="required-properties-details"}

#### `event`

Describes an event triggered by the doorbell button.

- **Reads**: Returns the last event generated by the button.

- Possible values:
    - `single_press`
    - `double_press`
    - `long_press`

---

## Optional Properties {id="optional-properties"}

| **Property** | **Data Type** | **Range**    | **Unit** | **Permissions** |
|--------------|---------------|--------------|----------|-----------------|
| `brightness` | `Uchar`       | `0–100`      | %        | RW (Read/Write) |
| `tampered`   | `Boolean`     | `true/false` | -        | RO (Read-Only)  |

---

### Property Details {id="optional-properties-details"}

#### `brightness`

Controls the perceived brightness level of the doorbell's backlight:

- Represents the percentage of the maximum brightness supported by the channel.
- **Range**: `0–100%`.

#### `tampered`

Indicates whether the channel has been tampered with:

- `true`: The channel has been tampered with.
- `false`: The channel is in a normal, non-tampered state.