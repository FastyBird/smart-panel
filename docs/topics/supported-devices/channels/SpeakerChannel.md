# Speaker Channel

**Channel Category**: `speaker`

Controls speaker devices, including volume, mute state, and audio output modes.

---

## Required Properties {id="required-properties"}

| **Property** | **Data Type** | **Range**    | **Unit** | **Permissions** |
|--------------|---------------|--------------|----------|-----------------|
| `active`     | `Bool`        | `true/false` | -        | RW (Read/Write) |

---

### Property Details {id="required-properties-details"}

#### `active`

Indicates whether the speaker is muted:

- `true`: Audio output is active.
- `false`: Audio output is muted.

---

## Optional Properties {id="optional-properties"}

| **Property** | **Data Type** | **Range**              | **Unit** | **Permissions** |
|--------------|---------------|------------------------|----------|-----------------|
| `volume`     | `Uchar`       | `0–100`                | %        | RW (Read/Write) |
| `mode`       | `Enum`        | `stereo/mono/surround` | -        | RW (Read/Write) |

---

### Property Details {id="optional-properties-details"}

#### `volume`

Represents the current volume level as a percentage:

- `0`: Minimum volume (silent).
- `100`: Maximum volume (full audio output).

#### `mode`

Represents the playback mode of the speaker.

Possible values:
- `stereo`: Standard stereo output (left and right channels).
- `mono`: Single-channel audio.
- `surround`: Multi-channel surround sound (e.g., 5.1 or 7.1 configurations).