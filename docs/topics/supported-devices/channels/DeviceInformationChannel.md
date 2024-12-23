# Device Information Channel

**Channel Category**: `device_information`

This channel provides metadata about the device, including manufacturer details, model information, and operational statuses.

---

## Required Properties {id="required-properties"}

| **Property**        | **Data Type** | **Range**    | **Unit** | **Permissions** |
|---------------------|---------------|--------------|----------|-----------------|
| `manufacturer`      | `String`      | -            | -        | RO (Read-Only)  |
| `model`             | `String`      | -            | -        | RO (Read-Only)  |
| `serial_number`     | `String`      | -            | -        | RO (Read-Only)  |
| `firmware_revision` | `String`      | -            | -        | RO (Read-Only)  |

---

### Property Details {id="required-properties-details"}

#### `manufacturer`

- Represents the name of the company that manufactured the device.
- Example: `Acme Devices Inc.`

#### `model`

- Specifies the model identifier of the device.
- Example: `SmartPanel X100`.

#### `serial_number`

- Indicates the unique serial number assigned to the device by the manufacturer.
- Example: `SN-12345-67890`.

#### `firmware_revision`

- Reports the version of the firmware installed on the device.
- Example: `v1.2.3`.

---

## Optional Properties {id="optional-properties"}

| **Property**        | **Data Type** | **Range**                     | **Unit** | **Permissions** |
|---------------------|---------------|-------------------------------|----------|-----------------|
| `hardware_revision` | `String`      | -                             | -        | RO (Read-Only)  |
| `link_quality`      | `Uchar`       | `0–100`                       | %        | RO (Read-Only)  |
| `connection_type`   | `Enum`        | `wired/wifi/zigbee/bluetooth` | -        | RO (Read-Only)  |
| `fault`             | `Uchar`       | `0–255`                       | -        | RO (Read-Only)  |

---

### Property Details {id="optional-properties-details"}

#### `hardware_revision`

- Represents the version of the device's hardware.
- Example: `v3.1`.

#### `link_quality`

- Indicates the signal quality or connection strength of the device.
- Measured as a value between `0` (poor) and `100` (excellent).

#### `fault`

Represents the fault state of the sensor:

- `0`: No fault detected.
- Non-zero: A fault has been detected, potentially affecting functionality.
