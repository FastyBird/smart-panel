# Valve Channel

**Channel Category**: `valve`

Controls fluid or gas valves, managing open/close states or flow rates.

---

## Required Properties {id="required-properties"}

| **Property** | **Data Type** | **Range**                                     | **Unit** | **Permissions** |
|--------------|---------------|-----------------------------------------------|----------|-----------------|
| `on`         | `Bool`        | `true/false`                                  | -        | RW (Read/Write) |
| `type`       | `Enum`        | `generic/irrigation/shower_head/water_faucet` | -        | RO (Read-Only)  |

---

### Property Details {id="required-properties-details"}

#### `on`

Indicates whether the valve is open or closed:

- `true`: The valve is open, allowing water to flow.
- `false`: The valve is closed, stopping the flow of water.

#### `type`

Specifies the type of valve being controlled:

- Possible values:
    - `generic`: A general-purpose valve.
    - `irrigation`: A valve used in irrigation systems.
    - `shower_head`: A valve integrated into a shower head.
    - `water_faucet`: A valve associated with a water faucet.

---

## Optional Properties {id="optional-properties"}

| **Property** | **Data Type** | **Range**          | **Unit** | **Permissions** |
|--------------|---------------|--------------------|----------|-----------------|
| `duration`   | `Ushort`      | `0–3600`           | s        | RW (Read/Write) |
| `remaining`  | `Ushort`      | `0–3600`           | s        | RO (Read-Only)  |
| `mode`       | `Enum`        | `manual/scheduled` | -        | RW (Read/Write) |
| `fault`      | `Uchar`       | `0–255`            | -        | RO (Read-Only)  |

---

### Property Details {id="optional-properties-details"}

#### `duration`

Specifies the duration for which the valve should remain open:

- Measured in seconds (`s`).
- Example: `duration = 300` keeps the valve open for 5 minutes.

#### `remaining`

Indicates the time remaining before the valve automatically closes:

- Measured in seconds (`s`).
- Example: If `remaining = 120`, the valve will close in 2 minutes.

#### `mode`

Specifies how the valve is being operated:

- Possible values:
    - `manual`: The valve is controlled directly by the user.
    - `scheduled`: The valve is controlled according to a predefined schedule.

#### `fault`

Represents the fault state of the actor:

- `0`: No fault detected.
- Non-zero: A fault has been detected, potentially affecting functionality.
