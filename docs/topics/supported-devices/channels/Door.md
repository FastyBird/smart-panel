# Door Channel

**Channel Category**: `door`

Manages the open/close states of doors, including garage and entry doors.

---

## Required Properties {id="required-properties"}

| **Property**  | **Data Type** | **Range**                             | **Unit** | **Permissions** |
|---------------|---------------|---------------------------------------|----------|-----------------|
| `obstruction` | `Boolean`     | `true/false`                          | -        | RO (Read-Only)  |
| `status`      | `Enum`        | `open/closed/opening/closing/stopped` | -        | RW (Read/Write) |
| `position`    | `Enum`        | `open/close/stop`                     | -        | RW (Read/Write) |
| `type`        | `Enum`        | `door/garage`                         | -        | RO (Read-Only)  |

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

Defines the type of door:

- Possible values:
  - `door`: Standard door.
  - `garage`: Garage door.

---

## Optional Properties {id="optional-properties"}

| **Property**  | **Data Type** | **Range** | **Unit** | **Permissions** |
|---------------|---------------|-----------|----------|-----------------|
| `percentage`  | `Uchar `      | `0–100`   | %        | RO (Read-Only)  |
| `fault`       | `Uchar`       | `0–255`   | -        | RO (Read-Only)  |

---

### Property Details {id="optional-properties-details"}

#### `percentage`

Indicates the percentage the door is open:

- `0%`: Fully closed.
- `100%`: Fully open.
- Intermediate values indicate partial opening.

#### `fault`

Represents the fault state of the sensor:

- `0`: No fault detected.
- Non-zero: A fault has been detected, potentially affecting functionality.