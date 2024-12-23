# Outlet Channel

**Channel Category**: `outlet`

Controls and monitors electrical outlets.

---

## Required Properties {id="required-properties"}

| **Property** | **Data Type** | **Range**    | **Unit** | **Permissions** |
|--------------|---------------|--------------|----------|-----------------|
| `on`         | `Bool`        | `true/false` | -        | RW (Read/Write) |

---

### Property Details {id="required-properties-details"}

#### `on`

Indicates the operational state of the outlet:

- `true`: The outlet is powered on.
- `false`: The outlet is powered off.

---

## Optional Properties {id="optional-properties"}

| **Property** | **Data Type** | **Range**    | **Unit** | **Permissions** |
|--------------|---------------|--------------|----------|-----------------|
| `in_use`     | `Bool`        | `true/false` | -        | RO (Read-Only)  |

---

### Property Details {id="optional-properties-details"}

#### `in_use`

Indicates whether the outlet is actively being used:

- `true`: A device is connected and drawing power.
- `false`: No device is currently using the outlet.
