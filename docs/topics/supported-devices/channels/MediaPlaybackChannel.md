
# Media Playback Channel

**Channel Category**: `media_playback`

Provides playback controls for multimedia devices, excluding volume control (handled by **Speaker** and **Microphone** channels).

---

## Required Properties {id="required-properties"}

| **Property** | **Data Type** | **Range**                 | **Unit** | **Permissions** |
|--------------|---------------|---------------------------|----------|-----------------|
| `status`     | `Enum`        | `playing/paused/stopped`  | -        | RW (Read-Write) |

---

### Property Details {id="required-properties-details"}

#### `status`

- Represents the current playback state:
    - `playing`: Media is playing.
    - `paused`: Media is paused.
    - `stopped`: Media is stopped.

---

## Optional Properties {id="optional-properties"}

| **Property** | **Data Type** | **Range**    | **Unit** | **Permissions** |
|--------------|---------------|--------------|----------|-----------------|
| `track`      | `String`      | -            | -        | RO (Read-Only)  |
| `duration`   | `Uint`        | `0–86400`    | seconds  | RO (Read-Only)  |
| `position`   | `Uint`        | `0–86400`    | seconds  | RW (Read-Write) |

---

### Property Details {id="optional-properties-details"}

#### `track`

- Displays the name or identifier of the currently playing media.

#### `duration`

- Total duration of the media in seconds.

#### `position`

- Current playback position in seconds.
