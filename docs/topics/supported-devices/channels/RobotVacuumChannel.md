# Robotic Vacuum Cleaner Channel

**Channel Category**: `robot_vacuum`

Controls robotic vacuum cleaners, providing commands for start, stop, docking, and monitoring states.

---

## Required Properties {id="required-properties"}

| **Property** | **Data Type** | **Range**                                          | **Unit** | **Permissions** |
|--------------|---------------|----------------------------------------------------|----------|-----------------|
| `on`         | `Bool`        | `true/false`                                       | -        | RW (Read/Write) |
| `status`     | `Enum`        | `idle/cleaning/vacuuming/mopping/docking/charging` | -        | RO (Read-Only)  |

---

### Property Details {id="required-properties-details"}

#### `on`

Controls whether the robotic vacuum is powered on and actively operating:

- `true`: The robot is actively operating (cleaning or moving).
- `false`: The robot is idle and not performing any tasks.

#### `status`

Indicates the current operational state of the robotic vacuum:

- Possible values:
    - `idle`: The robot is powered on but not performing any tasks.
    - `cleaning`: The robot is actively cleaning.
    - `vacuuming`: The robot is specifically vacuuming.
    - `mopping`: The robot is mopping the floor.
    - `docking`: The robot is returning to its charging dock.
    - `charging`: The robot is charging its battery.

---

## Optional Properties {id="optional-properties"}

| **Property** | **Data Type** | **Range**          | **Unit** | **Permissions** |
|--------------|---------------|--------------------|----------|-----------------|
| `mode`       | `Enum`        | `auto/spot/manual` | -        | RW (Read/Write) |
| `fault`      | `Uchar`       | `0–255`            | -        | RO (Read-Only)  |

---

### Property Details {id="optional-properties-details"}

#### `mode`

Defines the operating mode of the robotic vacuum:

- Possible values:
    - `auto`: The robot operates automatically according to predefined schedules or areas.
    - `spot`: The robot cleans a localized area.
    - `manual`: The robot is controlled manually (e.g., via remote or app).

#### `fault`

Represents the fault state of the robot:

- `0`: No fault detected.
- Non-zero: A fault has been detected, potentially affecting functionality.
