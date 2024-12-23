# Media Input Channel

**Channel Category**: `media_input`

Manages the input sources of multimedia devices like TVs, projectors, or audio receivers.

---

## Required Properties {id="required-properties"}

| **Property** | **Data Type** | **Range**                 | **Unit** | **Permissions** |
|--------------|---------------|---------------------------|----------|-----------------|
| `source`     | `Enum`        | `hdmi1/hdmi2/usb/optical` | -        | RW (Read-Write) |

---

### Property Details {id="required-properties-details"}

#### `source`

- Represents the selected input source.
- Example values:
    - `hdmi1`, `hdmi2`, `usb`, `optical`, `streaming`.

---

## Optional Properties {id="optional-properties"}

| **Property** | **Data Type** | **Range**    | **Unit** | **Permissions** |
|--------------|---------------|--------------|----------|-----------------|
| `active`     | `Bool`        | `true/false` | -        | RO (Read-Only)  |

---

### Property Details {id="optional-properties-details"}

#### `active`

- Indicates whether the selected input is actively in use.
