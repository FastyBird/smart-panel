# Microphone Channel

**Channel Category**: `microphone`

Represents audio input devices, reporting activity or capturing sound.

---

## Required Properties {id="required-properties"}

| **Property** | **Data Type** | **Range**    | **Unit** | **Permissions** |
|--------------|---------------|--------------|----------|-----------------|
| `active`     | `Bool`        | `true/false` | -        | RW (Read/Write) |

---

### Property Details {id="required-properties-details"}

#### `active`

Indicates whether the microphone is muted:

- `true`: Audio input is active.
- `false`: Audio input is muted.

---

## Optional Properties {id="optional-properties"}

| **Property** | **Data Type** | **Range** | **Unit** | **Permissions** |
|--------------|---------------|-----------|----------|-----------------|
| `volume`     | `Uchar`       | `0–100`   | %        | RW (Read/Write) |

---

### Property Details {id="optional-properties-details"}

#### `volume`

Represents the current volume level as a percentage:

- `0`: Minimum volume (silent).
- `100`: Maximum volume (full audio input).
