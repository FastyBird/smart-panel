# Television Channel

**Channel Category**: `television`

Provides control for TVs, including input source, brightness, and power state.

---

## Required Properties {id="required-properties"}

| **Property**   | **Data Type** | **Range**            | **Unit** | **Permissions** |
|----------------|---------------|----------------------|----------|-----------------|
| `on`           | `Boolean`     | `true/false`         | -        | RW (Read/Write) |
| `brightness`   | `Uchar`       | `0–100`              | %        | RW (Read/Write) |
| `input_source` | `Enum`        | `tv/hdmi/hdmi-X/app` | -        | RW (Read/Write) |

---

### Property Details {id="required-properties-details"}

#### `on`

Indicates whether the television is powered on or off:

- `true`: The television is on.
- `false`: The television is off.

#### `brightness`

Represents the brightness level of the display:

- Measured as a percentage (`%`).
- `0%`: Minimum brightness.
- `100%`: Maximum brightness.

#### `input_source`

Specifies the current input source:

- Possible values:
    - `tv`: Built-in tuner.
    - `hdmi`: HDMI input. If the TV has more HDMI inputs, it is allowed to use hdmi-X values
    - `app`: Integrated streaming app.
    - `hdmi-X`: Specific HDMI inputs if multiple are available (e.g., `hdmi-1`, `hdmi-2`).

---

## Optional Properties {id="optional-properties"}

| **Property**     | **Data Type** | **Range**                                                                                                       | **Unit** | **Permissions** |
|------------------|---------------|-----------------------------------------------------------------------------------------------------------------|----------|-----------------|
| `remote_key`     | `Enum`        | `rewind/fast-forward/next/previous/arrow-up/arrow-down/arrow-left/arrow-right/select/back/exit/info/play/pause` | -        | RW (Read/Write) |

---

### Property Details {id="optional-properties-details"}

#### `remote_key`

Represents the key pressed on a virtual or physical remote control:

- Possible values:
    - Navigation: `arrow-up`, `arrow-down`, `arrow-left`, `arrow-right`.
    - Playback: `rewind`, `fast-forward`, `play`, `pause`.
    - Control: `select`, `back`, `exit`, `info`.