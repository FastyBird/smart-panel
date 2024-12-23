# Window Covering Channel

**Channel Category**: `window_covering`

Controls coverings like blinds, curtains, and shutters, including position and tilt adjustments.

---

## Required Properties {id="required-properties"}

| **Property**  | **Data Type** | **Range**                             | **Unit** | **Permissions** |
|---------------|---------------|---------------------------------------|----------|-----------------|
| `obstruction` | `Bool`        | `true/false`                          | -        | RO (Read-Only)  |
| `status`      | `Enum`        | `open/closed/opening/closing/stopped` | -        | RO (Read-Only)  |
| `position`    | `Enum`        | `open/close/stop`                     | -        | RW (Read/Write) |
| `type`        | `Enum`        | `curtain/blind/roller/outdoor_blind`  | -        | RO (Read-Only)  |

---

### Property Details {id="required-properties-details"}

#### `obstruction`

Indicates whether the door is obstructed:

- `true`: An obstruction is detected, preventing the door from moving.
- `false`: No obstruction is detected.

#### `status`

Describes the state of the door:

- Possible values:
    - `open`: The door is fully open.
    - `closed`: The door is fully closed.
    - `opening`: The door is in the process of opening.
    - `closing`: The door is in the process of closing.
    - `stopped`: The door has stopped mid-operation.

#### `position`

Describes the target position of the door:

- Possible values:
    - `open`: Open the door.
    - `close`: Close the door.
    - `stopp`: Stop the door movement.

#### `type`

Defines the type of window covering:

- Possible values:
    - `curtain`: Indoor curtains.
    - `blind`: Indoor blinds.
    - `roller`: Roll-up coverings.
    - `outdoor_blind`: Outdoor blinds.

---

## Optional Properties {id="optional-properties"}

| **Property** | **Data Type** | **Range** | **Unit** | **Permissions** |
|--------------|---------------|-----------|----------|-----------------|
| `percentage` | `Uchar`       | `0–100`   | %        | RW (Read/Write) |
| `tilt`       | `Char`        | `-90–90`  | degrees  | RW (Read/Write) |
| `fault`      | `Uchar`       | `0–255`   | -        | RO (Read-Only)  |

---

### Property Details {id="optional-properties-details"}

#### `percentage`

Indicates the percentage the covering is open:

- `0%`: Fully closed.
- `100%`: Fully open.
- Intermediate values indicate partial opening.

#### `angle`

Represents the tilt angle of the covering:

- `0`: Neutral position.
- Negative values: Tilt towards one direction.
- Positive values: Tilt towards the opposite direction.

#### `fault`

Represents the fault state of the actor:

- `0`: No fault detected.
- Non-zero: A fault has been detected, potentially affecting functionality.
