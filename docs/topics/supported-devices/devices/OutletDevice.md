# Outlet Device

**Device Category**: `outlet`

The **Outlet** device represents a power outlet with advanced monitoring and control features, enabling remote operation and energy tracking. It supports single or multiple outlets for flexible power management.

---

## Required Channels {id="required-channels"}

These channels are mandatory for the functionality of the outlet device:

| **Channel**         | **Description**                                                                | **Multiple** | **Details**                                |
|---------------------|--------------------------------------------------------------------------------|--------------|--------------------------------------------|
| `outlet`            | Controls the on/off state of the power outlet(s).                              | Yes          | [See details](OutletChannel.md)            |
| `deviceInformation` | Provides metadata about the device, such as manufacturer, model, and firmware. | No           | [See details](DeviceInformationChannel.md) |

---

## Optional Channels {id="optional-channels"}

These channels are optional and provide additional features:

| **Channel**        | **Description**                             | **Multiple** | **Details**                               |
|--------------------|---------------------------------------------|--------------|-------------------------------------------|
| `electricalEnergy` | Tracks total energy consumption over time.  | No           | [See details](ElectricalEnergyChannel.md) |
| `electricalPower`  | Provides real-time power usage information. | No           | [See details](ElectricalPowerChannel.md)  |

---

### Use Case Scenarios {id="use-case-scenarios"}

1. **Power Control**:
   - Use the `outlet` channel to turn the power supply on or off remotely.
   - Manage multiple outlets independently if supported.

2. **Energy Monitoring**:
   - Monitor power usage and track energy consumption using the `electricalPower` and `electricalEnergy` channels.

3. **Device Metadata**:
   - Access outlet-specific information such as manufacturer, model, and firmware through the `deviceInformation` channel.

---

## Developer Notes {id="developer-notes"}

1. **Channel Implementation**:
   - Implement all required channels for basic outlet control functionality.
   - Add optional channels for energy monitoring features if supported by the hardware.

2. **Integration**:
   - Ensure each `outlet` channel is linked to the corresponding physical relay controlling the power supply.
   - Include the `deviceInformation` channel for proper identification and metadata access.

3. **Extensibility**:
   - Optional channels like `electricalEnergy` and `electricalPower` can enhance the device's utility for energy management applications.
   - Support multiple `outlet` channels for power strips or multi-outlet devices.
