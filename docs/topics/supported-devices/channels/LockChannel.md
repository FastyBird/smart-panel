# Lock Channel

**Channel Category**: `lock`

Manages the locked/unlocked state of physical locks for doors, safes, or other secure areas.

---

## Required Properties {id="required-properties"}

| **Property** | **Data Type** | **Range**         | **Unit** | **Permissions** |
|--------------|---------------|-------------------|----------|-----------------|
| `on`         | `Bool`        | `true/false`      | -        | RW (Read/Write) |
| `status`     | `Enum`        | `locked/unlocked` | -        | RO (Read-Only)  |

---

### Property Details {id="required-properties-details"}

#### `on`

Controls whether the lock is actively engaged:

- `true`: The lock is engaged (locked).
- `false`: The lock is disengaged (unlocked).

#### `status`

Indicates the current status of the lock:

- Possible values:
    - `locked`: The lock is currently engaged.
    - `unlocked`: The lock is currently disengaged.

---

## Optional Properties {id="optional-properties"}

| **Property** | **Data Type** | **Range**    | **Unit** | **Permissions** |
|--------------|---------------|--------------|----------|-----------------|
| `active`     | `Bool`        | `true/false` | -        | RO (Read-Only)  |
| `fault`      | `Uchar`       | `0–255`      | -        | RO (Read-Only)  |
| `tampered`   | `Bool`        | `true/false` | -        | RO (Read-Only)  |

---

### Property Details {id="optional-properties-details"}

#### `fault`

Represents the fault state of the actor:

- `0`: No fault detected.
- Non-zero: A fault has been detected, potentially affecting functionality.

#### `tampered`

Indicates whether the channel has been tampered with:

- `true`: The channel has been tampered with.
- `false`: The channel is in a normal, non-tampered state.
