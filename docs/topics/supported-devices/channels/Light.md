# Light Channel

**Channel Category**: `light`

Controls lighting devices, supporting brightness, color temperature, and color adjustments.

---

## Required Properties {id="required-properties"}

| **Property** | **Data Type** | **Range**    | **Unit** | **Permissions** |
|--------------|---------------|--------------|----------|-----------------|
| `on`         | `Boolean`     | `true/false` | -        | RW (Read/Write) |

---

### Property Details {id="required-properties-details"}

#### `on`

Indicates the on/off state of the light:

- `true`: The light is on.
- `false`: The light is off.

---

## Optional Properties {id="optional-properties"}

| **Property**          | **Data Type** | **Range**     | **Unit** | **Permissions** |
|-----------------------|---------------|---------------|----------|-----------------|
| `brightness`          | `Uchar`       | `0–100`       | %        | RW (Read/Write) |
| `color_red`           | `Ushort`      | `0–255`       | -        | RW (Read/Write) |
| `color_green`         | `Ushort`      | `0–255`       | -        | RW (Read/Write) |
| `color_blue`          | `Ushort`      | `0–255`       | -        | RW (Read/Write) |
| `color_white`         | `Ushort`      | `0–255`       | -        | RW (Read/Write) |
| `color_temperature`   | `Ushort`      | `2,700–6,500` | K        | RW (Read/Write) |
| `hue`                 | `Ushort`      | `0–360`       | degrees  | RW (Read/Write) |
| `saturation`          | `Ushort`      | `0–100`       | %        | RW (Read/Write) |

---

### Property Details {id="optional-properties-details"}

#### `brightness`

Represents the perceived level of brightness:

- Expressed as a percentage (`0–100%`) of the maximum supported brightness.

#### `color_red`, `color_green`, `color_blue`

Define the RGB color values:

- Must be defined together for accurate color selection.

#### `color_white`

Represents the intensity of white light in the RGB spectrum.

#### `color_temperature`

Describes the color temperature of the light:

- Measured in Kelvin (`K`).
- Range: `2,700–6,500` Kelvin.

#### `hue`

Represents the hue or shade of color:

- Range: `0–360` degrees on the color wheel.

#### `saturation`

Indicates the color saturation:

- Expressed as a percentage (`0–100%`).

---

> [!Notes]:
The `color_red`, `color_green`, and `color_blue` properties must be defined together to set the RGB color accurately.
This channel also supports hue and saturation. Both `hue` and `saturation` must be configured together for proper operation.