# Camera Channel

**Channel Category**: `camera`

Provides video and image data streams from surveillance or monitoring cameras. This channel supports configuration and control of camera devices, such as surveillance cameras or babysitting monitors.

---

## Required Properties {id="required-properties"}

| **Property** | **Data Type** | **Range**                                                 | **Unit** | **Permissions** |
|--------------|---------------|-----------------------------------------------------------|----------|-----------------|
| `status`     | `Enum`        | `available/in_use/unavailable/offline/initializing/error` | -        | RO (Read-Only)  |
| `source`     | `String`      | `rtsp://path.to.camera`                                   | -        | RO (Read-Only)  |

---

### Property Details {id="required-properties-details"}

#### `status`

Defines whether the camera is operational, currently in use, or unavailable for use:

- `available`: The camera is ready and operational.
- `in_use`: The camera is currently being accessed or streamed.
- `unavailable`: The camera is not operational.
- `offline`: The camera is powered off or disconnected.
- `initializing`: The camera is booting or preparing.
- `error`: The camera encountered a malfunction.

#### `source`

Contains the URL or path for accessing the camera’s video feed, typically in RTSP format.

---

## Optional Properties {id="optional-properties"}

| **Property** | **Data Type** | **Range**    | **Unit** | **Permissions** |
|--------------|---------------|--------------|----------|-----------------|
| `zoom`       | `Float`       | `1.0–10.0`   | -        | RW (Read/Write) |
| `pan`        | `Float`       | `-180–180`   | degrees  | RW (Read/Write) |
| `tilt`       | `Float`       | `-90–90`     | degrees  | RW (Read/Write) |
| `infrared`   | `Boolean`     | `true/false` | -        | RW (Read/Write) |
| `fault`      | `Uchar`       | `0–255`      | -        | RO (Read-Only)  |

---

### Property Details {id="optional-properties-details"}

#### `zoom`

Controls the camera’s zoom level. The range may vary by device, but `1.0–10.0` is a common default:

- Adjustable for PTZ (pan-tilt-zoom) cameras.

#### `pan` / `tilt`

Allows controlling camera movement in horizontal (`pan`) and vertical (`tilt`) directions:

- `pan`: Adjusts the horizontal angle within `-180°` to `180°`.
- `tilt`: Adjusts the vertical angle within `-90°` to `90°`.

#### `infrared`

Toggles infrared mode for night vision functionality:

- `true`: Infrared mode is active.
- `false`: Infrared mode is inactive.

#### `fault`

Represents the fault state of the camera:

- `0`: No fault detected.
- Non-zero: A fault has been detected, potentially affecting functionality.